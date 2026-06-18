import { HttpError, withRetry } from "./retry.js";
import { getJiraCustomFields } from "./fields.js";

export interface JiraImage {
  name: string;
  mimeType: string;
  base64: string;
}

export interface JiraComment {
  author: string;
  date: string;
  text: string;
}

export interface JiraIssueResult {
  key: string;
  summary: string;
  issueType: string;
  status: string;
  priority: string | null;
  assignee: string | null;
  labels: string[];
  components: string[];
  description: string;
  comments: JiraComment[];
  attachments: { name: string; mimeType: string; url: string }[];
  subtasks: { key: string; summary: string; status: string }[];
  parent: { key: string; summary: string } | null;
  sprint: string | null;
  epic: string | null;
}

export interface JiraIssueData {
  issue: JiraIssueResult;
  images: JiraImage[];
}

function getCredentials(): { host: string; authHeader: string } {
  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!host || !email || !token) {
    throw new Error(
      "Missing Jira credentials: JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN environment variables are required."
    );
  }

  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  return { host: cleanHost, authHeader };
}

async function fetchJira<T>(url: string, authHeader: string): Promise<T> {
  return withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error("issue no encontrado");
      if (response.status === 401) throw new Error("revisar credenciales de Jira");
      throw new HttpError(response.status, `Jira API error: HTTP ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  });
}

// Converts Atlassian Document Format (ADF) JSON to plain text.
// Unknown node types fall through to child recursion so the function never throws.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adfToText(node: any): string {
  if (!node) return "";

  if (node.type === "text") {
    let text: string = node.text ?? "";
    for (const mark of node.marks ?? []) {
      if (mark.type === "link" && mark.attrs?.href) {
        text = `${text} (${mark.attrs.href})`;
      }
    }
    return text;
  }

  const children: string = (node.content ?? []).map(adfToText).join("");

  switch (node.type) {
    case "doc":
    case "blockquote":
    case "panel":
      return children;
    case "paragraph":
      return children + "\n";
    case "hardBreak":
      return "\n";
    case "heading":
      return `${"#".repeat(node.attrs?.level ?? 1)} ${children}\n`;
    case "bulletList":
    case "orderedList":
      return children;
    case "listItem":
      return `- ${children.trim()}\n`;
    case "codeBlock":
      return `\`\`\`\n${children}\`\`\`\n`;
    case "table":
      return children + "\n";
    case "tableRow":
      return `| ${children.trim()} |\n`;
    case "tableCell":
    case "tableHeader":
      return ` ${children.trim()} |`;
    case "mention":
      return node.attrs?.text ?? node.attrs?.displayName ?? "@usuario";
    case "emoji":
      return node.attrs?.text ?? "";
    case "inlineCard":
      return node.attrs?.url ?? "";
    case "mediaSingle":
    case "media":
      // Images are handled via the attachment list, not inline ADF nodes
      return "";
    default:
      return children;
  }
}

function extractSprint(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const active = (raw as { name?: string; state?: string }[]).find(
    (s) => s.state === "active"
  );
  const sprint = active ?? (raw as { name?: string }[])[raw.length - 1];
  return typeof sprint?.name === "string" ? sprint.name : null;
}

function extractEpic(raw: unknown): string | null {
  if (typeof raw === "string") return raw || null;
  if (raw && typeof raw === "object" && "name" in raw) {
    return String((raw as { name: string }).name) || null;
  }
  return null;
}

interface RawComment {
  author: { displayName: string };
  created: string;
  body: unknown;
}

interface RawCommentsPage {
  comments: RawComment[];
  total: number;
  maxResults: number;
  startAt: number;
}

interface JiraIssueRaw {
  key: string;
  fields: {
    summary: string;
    issuetype?: { name: string };
    status?: { name: string };
    priority?: { name: string } | null;
    assignee?: { displayName: string } | null;
    labels?: string[];
    components?: { name: string }[];
    description?: unknown;
    comment?: Omit<RawCommentsPage, "startAt">;
    attachment?: { id: string; filename: string; mimeType: string; content: string }[];
    subtasks?: { key: string; fields: { summary: string; status: { name: string } } }[];
    parent?: { key: string; fields: { summary: string } } | null;
    [key: string]: unknown;
  };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function downloadJiraImage(url: string, authHeader: string): Promise<string | null> {
  console.error(`[jira] Downloading image: ${url}`);

  try {
    // Use manual redirect so we don't forward the Basic auth header to signed S3 URLs
    const initialResponse = await fetch(url, {
      headers: { Authorization: authHeader },
      redirect: "manual",
    });

    let finalResponse: Response;

    const status = initialResponse.status;
    if (status === 301 || status === 302 || status === 307 || status === 308) {
      const location = initialResponse.headers.get("location");
      if (!location) {
        console.error(`[jira] Redirect without Location header: ${url}`);
        return null;
      }
      finalResponse = await fetch(location);
    } else if (initialResponse.ok) {
      finalResponse = initialResponse;
    } else {
      console.error(`[jira] Image download failed: HTTP ${status}`);
      return null;
    }

    if (!finalResponse.ok) {
      console.error(`[jira] Image download failed: HTTP ${finalResponse.status}`);
      return null;
    }

    const buffer = await finalResponse.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      console.error(`[jira] Skipping image > 5MB: ${url}`);
      return null;
    }

    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error(`[jira] Image download error for ${url}:`, err);
    return null;
  }
}

async function fetchAllComments(
  issueKey: string,
  baseUrl: string,
  authHeader: string,
  initial: Omit<RawCommentsPage, "startAt">,
  maxComments?: number
): Promise<RawComment[]> {
  if (maxComments !== undefined) {
    if (initial.total <= initial.maxResults) {
      // All comments are already in initial page — take the last N
      return initial.comments.slice(Math.max(0, initial.comments.length - maxComments));
    }
    // Fetch only the page containing the most recent N comments
    const startAt = Math.max(0, initial.total - maxComments);
    const page = await fetchJira<RawCommentsPage>(
      `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?startAt=${startAt}&maxResults=${maxComments}`,
      authHeader
    );
    return page.comments;
  }

  const all = [...initial.comments];
  if (initial.total <= initial.maxResults) return all;

  let startAt = initial.maxResults;
  while (startAt < initial.total) {
    const page = await fetchJira<RawCommentsPage>(
      `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?startAt=${startAt}&maxResults=100`,
      authHeader
    );
    all.push(...page.comments);
    startAt += page.comments.length;
    if (page.comments.length === 0) break;
  }

  return all;
}

export async function getJiraIssue(
  issueKey: string,
  includeImages = true,
  maxComments?: number
): Promise<JiraIssueData> {
  const { host, authHeader } = getCredentials();
  const baseUrl = `https://${host}`;
  const { sprintField, epicField } = await getJiraCustomFields();

  const staticFields = [
    "summary", "description", "status", "assignee",
    "labels", "priority", "comment", "attachment",
    "issuetype", "components", "subtasks", "parent",
  ];
  const dynamicFields = [sprintField, epicField].filter(
    (f): f is string => f !== null
  );
  const fields = [...staticFields, ...dynamicFields].join(",");

  console.error(`[jira] GET issue ${issueKey}`);
  const raw = await fetchJira<JiraIssueRaw>(
    `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${fields}`,
    authHeader
  );

  const f = raw.fields;

  const initialComments = f.comment ?? { comments: [], total: 0, maxResults: 0 };
  const allComments = await fetchAllComments(
    issueKey,
    baseUrl,
    authHeader,
    initialComments,
    maxComments
  );

  const comments: JiraComment[] = allComments.map((c) => ({
    author: c.author.displayName,
    date: c.created,
    text: adfToText(c.body).trim(),
  }));

  const rawAttachments = f.attachment ?? [];
  const imageAttachments = rawAttachments.filter((a) =>
    a.mimeType?.startsWith("image/")
  );
  const nonImageAttachments = rawAttachments.filter(
    (a) => !a.mimeType?.startsWith("image/")
  );

  let images: JiraImage[] = [];
  if (includeImages) {
    const downloadedImages = await Promise.all(
      imageAttachments.map(async (a): Promise<JiraImage | null> => {
        const base64 = await downloadJiraImage(a.content, authHeader);
        if (!base64) return null;
        return { name: a.filename, mimeType: a.mimeType, base64 };
      })
    );
    images = downloadedImages.filter((img): img is JiraImage => img !== null);
  }

  const issue: JiraIssueResult = {
    key: raw.key,
    summary: f.summary,
    issueType: f.issuetype?.name ?? "Issue",
    status: f.status?.name ?? "",
    priority: f.priority?.name ?? null,
    assignee: f.assignee?.displayName ?? null,
    labels: f.labels ?? [],
    components: (f.components ?? []).map((c) => c.name),
    description: f.description ? adfToText(f.description).trim() : "",
    comments,
    attachments: nonImageAttachments.map((a) => ({
      name: a.filename,
      mimeType: a.mimeType,
      url: a.content,
    })),
    subtasks: (f.subtasks ?? []).map((s) => ({
      key: s.key,
      summary: s.fields.summary,
      status: s.fields.status.name,
    })),
    parent: f.parent
      ? { key: f.parent.key, summary: f.parent.fields.summary }
      : null,
    sprint: sprintField ? extractSprint(f[sprintField]) : null,
    epic: epicField ? extractEpic(f[epicField]) : null,
  };

  return { issue, images };
}

export interface JiraSearchResult {
  issues: {
    key: string;
    summary: string;
    status: string;
    assignee: string | null;
    priority: string | null;
  }[];
  total: number;
}

export async function searchJiraIssues(
  jql: string,
  maxResults = 20
): Promise<JiraSearchResult> {
  const { host, authHeader } = getCredentials();
  const baseUrl = `https://${host}`;

  interface RawSearchResponse {
    total: number;
    issues: {
      key: string;
      fields: {
        summary: string;
        status?: { name: string };
        assignee?: { displayName: string } | null;
        priority?: { name: string } | null;
      };
    }[];
  }

  const raw = await fetchJira<RawSearchResponse>(
    `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,assignee,priority`,
    authHeader
  );

  return {
    total: raw.total,
    issues: raw.issues.map((i) => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status?.name ?? "",
      assignee: i.fields.assignee?.displayName ?? null,
      priority: i.fields.priority?.name ?? null,
    })),
  };
}

export async function addJiraComment(
  issueKey: string,
  text: string
): Promise<void> {
  const { host, authHeader } = getCredentials();
  const baseUrl = `https://${host}`;

  const body = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ],
    },
  };

  const response = await fetch(
    `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Jira comment failed: HTTP ${response.status} ${response.statusText}`
    );
  }
}
