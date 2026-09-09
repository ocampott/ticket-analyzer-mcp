import { HttpError, withRetry } from "./retry.js";
import { assertFiniteInteger } from "./validation.js";
import { downloadBytes, mapWithConcurrency } from "./download.js";

export interface AzureImage {
  name: string;
  mimeType: string;
  base64: string;
  url?: string;
}

export interface AzureComment {
  author: string;
  date: string;
  text: string;
}

export interface AzureAttachment {
  name: string;
  mimeType: string;
  url: string;
}

export interface AzureLink {
  id: number;
  title: string;
  type: string;
}

// A work item and, recursively, every work item hanging below it.
// A User Story, its Tasks and its Bugs are all the same shape — the whole ticket,
// not a title-and-state summary, because the real requirement often lives in a child.
export interface AzureWorkItemNode {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  reason: string | null;
  priority: number | null;
  assignee: string | null;
  createdBy: string | null;
  storyPoints: number | null;
  remainingWork: number | null;
  tags: string[];
  iterationPath: string | null;
  areaPath: string | null;
  description: string;
  acceptanceCriteria: string;
  reproSteps: string;
  comments: AzureComment[];
  commentPagination?: { complete: boolean; nextCursor: string | null; fetched: number; budget: number };
  attachments: AzureAttachment[];
  children: AzureWorkItemNode[];
  url: string;
}

export interface AzureWorkItemResult extends AzureWorkItemNode {
  parent: AzureLink | null;
  related: AzureLink[];
  /** Node count reached the cap — the tree below is incomplete. */
  truncated: boolean;
  /** Total work items in the tree, root included. */
  nodeCount: number;
  missingChildren: { id: number; reason: "inaccessible" | "depth_cap" | "node_cap" }[];
  missingLinks: { id: number; relation: "parent" | "related"; reason: "inaccessible" | "node_cap" }[];
}

// ponytail: TextAttachment / isTextAttachment are also defined in jira.ts and trello.ts.
// Left duplicated so this provider stays self-contained; extract to attachments.ts if a 4th appears.
export interface TextAttachment {
  name: string;
  mimeType: string;
  content: string;
  truncated: boolean;
}

const TEXT_MIME_EXACT = new Set(["application/json", "application/sql", "application/xml"]);
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".sql", ".txt", ".md", ".json", ".csv", ".xml", ".yaml", ".yml"]);
const MAX_TEXT_BYTES = 200_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BATCH_LIMIT = 200;
const MAX_COMMENT_BUDGET = 200;
const MAX_SEARCH_RESULTS = 100; // Azure DevOps caps the work item batch endpoint at 200 ids
const AZURE_ATTACHMENT_ORIGIN = "https://dev.azure.com";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

// Azure DevOps does not return a MIME type for attachments, only the file name.
export function mimeFromName(name: string): string {
  const ext = extensionOf(name);
  if (IMAGE_MIME[ext]) return IMAGE_MIME[ext];
  if (TEXT_EXTENSIONS.has(ext)) return ext === ".json" ? "application/json" : `text/${ext.slice(1)}`;
  return "application/octet-stream";
}

export function isImageAttachment(name: string): boolean {
  return extensionOf(name) in IMAGE_MIME;
}

export function isTextAttachment(name: string, mimeType: string): boolean {
  if (mimeType.startsWith("text/")) return true;
  if (TEXT_MIME_EXACT.has(mimeType)) return true;
  return TEXT_EXTENSIONS.has(extensionOf(name));
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "'", lsquo: "'",
  ldquo: "“", rdquo: "”", middot: "·", deg: "°", euro: "€", pound: "£",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name] ?? match);
}

// A base64 payload never contains ">", so [^>]* reliably spans the whole <img> tag.
const IMG_TAG_RE = /<img\b[^>]*>/gi;
// Read the src attribute out first — quoted or bare — then decide whether it is a data URI.
// Matching the payload directly is fragile: a wrapped base64 blob contains whitespace.
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const DATA_URI_RE = /^data:(image\/[a-z+]+);base64,([\s\S]*)$/i;

const EXT_FOR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

const ATTACHMENT_URL_RE = /\/_apis\/wit\/attachments\/[0-9a-f-]{36}/i;

export interface AzureImageRef {
  name: string;
  url: string;
}

function extensionFromFileName(url: string): string | null {
  const fileName = /[?&]fileName=([^&]+)/i.exec(url)?.[1];
  if (!fileName) return null;
  const ext = extensionOf(decodeURIComponent(fileName)).replace(".", "");
  return ext || null;
}

/**
 * Pulls the images out of an Azure HTML body. There are two kinds and NEITHER shows up
 * in the AttachedFile relations, so the attachment path alone silently loses both:
 *
 *  - `<img src="data:image/...;base64,...">` — pasted straight into the body.
 *  - `<img src="https://.../_apis/wit/attachments/{guid}?fileName=image.png">` — an
 *    upload referenced by URL. Verified on this board: 17 such images were referenced
 *    across one ticket's tree and not one of them appeared as an AttachedFile relation.
 *
 * On a QA task the pasted screenshot is usually the entire evidence, so each image
 * leaves a named marker behind and the caller downloads the referenced ones.
 */
export function extractBodyImages(
  html: string,
  prefix: string,
  startIndex = 1
): { html: string; inline: AzureImage[]; referenced: AzureImageRef[] } {
  const inline: AzureImage[] = [];
  const referenced: AzureImageRef[] = [];
  let n = startIndex;

  const replaced = html.replace(IMG_TAG_RE, (tag) => {
    const src = SRC_ATTR_RE.exec(tag);
    if (!src) return tag;

    const value = (src[1] ?? src[2] ?? src[3] ?? "").trim();
    const dataUri = DATA_URI_RE.exec(value);

    if (dataUri) {
      const [, mimeType, rawData] = dataUri;
      const base64 = rawData.replace(/\s+/g, "");
      // base64 carries 3 bytes per 4 chars
      if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
        console.error(`[azure] Skipping inline image > 5MB in ${prefix}`);
        return "[imagen embebida omitida: supera 5MB]";
      }
      const name = `${prefix}-${n++}.${EXT_FOR_MIME[mimeType.toLowerCase()] ?? "bin"}`;
      inline.push({ name, mimeType, base64 });
      return `[imagen embebida: ${name}]`;
    }

    if (ATTACHMENT_URL_RE.test(value)) {
      const name = `${prefix}-${n++}.${extensionFromFileName(value) ?? "png"}`;
      referenced.push({ name, url: value });
      return `[imagen: ${name}]`;
    }

    // Some other image — leave the tag alone, htmlToText turns it into its own marker
    return tag;
  });

  return { html: replaced, inline, referenced };
}

// Azure DevOps stores Description, Acceptance Criteria and comments as HTML.
// This is the counterpart of jira.ts adfToText.
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";

  let text = html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // Inline images are attachments rendered in place — keep a marker, not the signed URL
  text = text.replace(/<img\b[^>]*>/gi, "[imagen adjunta]");

  // Mentions render as <a href="#" data-vss-mention=...>@Name</a> — the href carries nothing
  text = text.replace(
    /<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href: string, label: string) => {
      const clean = label.replace(/<[^>]+>/g, "").trim();
      if (!href || href.startsWith("#")) return clean;
      return clean && clean !== href ? `${clean} (${href})` : href;
    }
  );

  // Azure nests <div> inside every <td>, which would put each cell on its own line.
  // Flatten block tags within a cell first so a row stays a row.
  text = text.replace(
    /<t([dh])\b[^>]*>([\s\S]*?)<\/t\1>/gi,
    (_, tag: string, inner: string) => {
      const flat = inner
        .replace(/<\/(p|div|h[1-6])>/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `<t${tag}>${flat}</t${tag}>`;
    }
  );

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(text)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getCredentials(): { org: string; project: string; authHeader: string } {
  const org = process.env.AZURE_DEVOPS_ORG;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const pat = process.env.AZURE_DEVOPS_PAT;

  if (!org || !project || !pat) {
    throw new Error(
      "Azure DevOps credentials not configured. Run /ticket-analyzer:setup to set up your organization, project, and PAT."
    );
  }

  // Azure DevOps PATs authenticate as Basic with an empty username
  const authHeader = `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
  return { org, project, authHeader };
}

function projectUrl(org: string, project: string): string {
  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/wit`;
}

async function fetchAzure<T>(url: string, authHeader: string, init?: RequestInit): Promise<T> {
  return withRetry(async () => {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    // Azure answers an invalid or expired PAT with 203 and an HTML sign-in page.
    // 203 is inside the 2xx range, so response.ok is true — check it before ok.
    if (response.status === 203 || response.status === 401) {
      throw new Error("revisar credenciales de Azure DevOps (PAT vencido o sin scope Work Items)");
    }

    if (!response.ok) {
      if (response.status === 404) throw new Error("work item no encontrado");
      if (response.status === 403) throw new Error("el PAT no tiene permisos sobre este proyecto");
      throw new HttpError(response.status, `Azure DevOps API error: HTTP ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  });
}

async function downloadAttachment(url: string, authHeader: string, maxBytes: number, allowTruncated = false): Promise<Uint8Array | null> {
  return downloadBytes(url, {
    maxBytes,
    allowTruncated,
    headers: { Authorization: authHeader },
    credentialOrigins: [AZURE_ATTACHMENT_ORIGIN],
    allowedOrigins: [AZURE_ATTACHMENT_ORIGIN],
  });
}

export async function downloadAzureImage(url: string, authHeader: string): Promise<string | null> {
  console.error(`[azure] Downloading image: ${url}`);
  const buffer = await downloadAttachment(url, authHeader, MAX_IMAGE_BYTES);
  if (!buffer) return null;
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    console.error(`[azure] Skipping image > 5MB: ${url}`);
    return null;
  }
  return Buffer.from(buffer).toString("base64");
}

export async function downloadAzureText(
  url: string,
  authHeader: string
): Promise<{ content: string; truncated: boolean } | null> {
  console.error(`[azure] Downloading text attachment: ${url}`);
  const buffer = await downloadAttachment(url, authHeader, MAX_TEXT_BYTES, true);
  if (!buffer) return null;

  let text = new TextDecoder().decode(buffer);
  if (/\.html?(\?|$)/i.test(url)) {
    text = text
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }
  if (buffer.byteLength >= MAX_TEXT_BYTES) {
    return {
      content: text.slice(0, MAX_TEXT_BYTES) + "\n[truncado: archivo excede 200 000 caracteres]",
      truncated: true,
    };
  }
  return { content: text, truncated: false };
}

interface RawIdentity {
  displayName?: string;
}

interface RawRelation {
  rel: string;
  url: string;
  attributes?: { name?: string; comment?: string };
}

interface RawWorkItem {
  id: number;
  fields: Record<string, unknown>;
  relations?: RawRelation[];
  _links?: { html?: { href?: string } };
}

interface RawCommentsPage {
  comments: { text: string; createdBy: RawIdentity; createdDate: string }[];
  totalCount: number;
  count: number;
}

function identityName(value: unknown): string | null {
  if (value && typeof value === "object" && "displayName" in value) {
    return String((value as RawIdentity).displayName ?? "") || null;
  }
  return null;
}

function str(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function num(fields: Record<string, unknown>, key: string): number | null {
  const value = fields[key];
  return typeof value === "number" ? value : null;
}

function idFromUrl(url: string): number | null {
  const id = Number(url.split("/").pop());
  return Number.isFinite(id) ? id : null;
}

const SUMMARY_FIELDS = [
  "System.Id",
  "System.Title",
  "System.WorkItemType",
  "System.State",
  "System.AssignedTo",
  "System.IterationPath",
].join(",");

/**
 * Batch-read work items. With `full`, asks for $expand=all so every item comes back
 * with its complete field set *and* its relations — that is what lets the tree walk
 * descend a whole level per HTTP call instead of one call per child.
 */
async function fetchWorkItemsBatch(
  org: string,
  ids: number[],
  authHeader: string,
  full: boolean
): Promise<Map<number, RawWorkItem>> {
  const found = new Map<number, RawWorkItem>();
  if (ids.length === 0) return found;

  const shape = full ? "$expand=all" : `fields=${encodeURIComponent(SUMMARY_FIELDS)}`;

  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    // errorPolicy=omit so one deleted or cross-project link does not fail the whole fetch
    const raw = await fetchAzure<{ value: RawWorkItem[] }>(
      `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems` +
        `?ids=${chunk.join(",")}&${shape}&errorPolicy=omit&api-version=7.1`,
      authHeader
    );
    for (const item of raw.value ?? []) {
      if (item) found.set(item.id, item);
    }
  }

  return found;
}

function childIdsOf(raw: RawWorkItem): number[] {
  return (raw.relations ?? [])
    .filter((r) => r.rel === "System.LinkTypes.Hierarchy-Forward")
    .map((r) => idFromUrl(r.url))
    .filter((id): id is number => id !== null);
}

/**
 * Breadth-first walk down the hierarchy, one batch call per level.
 * Stops at maxDepth or maxNodes, whichever comes first; `visited` also guards
 * against a link cycle putting the walk into an infinite loop.
 */
async function collectTree(
  org: string,
  root: RawWorkItem,
  authHeader: string,
  maxDepth: number,
  maxNodes: number
): Promise<{ nodes: Map<number, RawWorkItem>; truncated: boolean; skipped: Set<number>; inaccessible: Set<number>; nodeCapped: Set<number> }> {
  const nodes = new Map<number, RawWorkItem>([[root.id, root]]);
  const inaccessible = new Set<number>();
  const nodeCapped = new Set<number>();
  let frontier = childIdsOf(root);

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const pending = frontier.filter((id) => !nodes.has(id));
    if (pending.length === 0) {
      frontier = [];
      break;
    }

    const batch = pending.slice(0, Math.max(0, maxNodes - nodes.size));
    if (batch.length === 0) {
      frontier = pending;
      break;
    }

    const fetched = await fetchWorkItemsBatch(org, batch, authHeader, true);
    const next: number[] = [];
    for (const id of batch) {
      const item = fetched.get(id);
      if (!item) {
        inaccessible.add(id);
        continue;
      }
      nodes.set(id, item);
      next.push(...childIdsOf(item));
    }
    const remaining = pending.slice(batch.length);
    if (remaining.length > 0) {
      for (const id of remaining) nodeCapped.add(id);
    }
    frontier = [...remaining, ...next];
    // Do not carry an unvisited sibling into the next depth. It remains a child at
    // this depth and must be disclosed as skipped by the node cap.
    if (remaining.length > 0) break;
  }

  // Anything still unvisited means the walk stopped early — on the node cap or the depth cap.
  // Kept apart from "could not be read" so the output can say which one happened.
  const skipped = new Set(frontier.filter((id) => !nodes.has(id)));
  return { nodes, truncated: skipped.size > 0, skipped, inaccessible, nodeCapped };
}

async function fetchAllComments(
  baseUrl: string,
  workItemId: number,
  authHeader: string,
  maxComments?: number
): Promise<{ comments: AzureComment[]; pagination: { complete: boolean; nextCursor: string | null; fetched: number; budget: number } }> {
  const budget = maxComments ?? 200;
  const rawComments: RawCommentsPage["comments"] = [];
  let skip = 0;
  let totalCount = 0;
  for (let pageNumber = 0; pageNumber < 10 && rawComments.length < budget; pageNumber++) {
    const top = Math.min(100, budget - rawComments.length);
    const page = await fetchAzure<RawCommentsPage>(
      `${baseUrl}/workItems/${workItemId}/comments?$top=${top}&$skip=${skip}&order=desc&api-version=7.1-preview.3`,
      authHeader
    );
    totalCount = page.totalCount ?? rawComments.length;
    rawComments.push(...(page.comments ?? []));
    if (!page.comments?.length || rawComments.length >= totalCount) break;
    skip += page.comments.length;
  }
  const comments = rawComments.map((c) => ({
    author: identityName(c.createdBy) ?? "desconocido",
    date: c.createdDate,
    text: c.text ?? "",
  }));
  const complete = totalCount <= comments.length;
  return { comments: comments.reverse(), pagination: { complete, nextCursor: complete ? null : String(comments.length), fetched: comments.length, budget } };

}

export interface AzureWorkItemData {
  workItem: AzureWorkItemResult;
  images: AzureImage[];
  textAttachments: TextAttachment[];
}

export const DEFAULT_MAX_DEPTH = 3;
export const DEFAULT_MAX_NODES = 40;

function attachmentsOf(raw: RawWorkItem): AzureAttachment[] {
  return (raw.relations ?? [])
    .filter((r) => r.rel === "AttachedFile")
    .map((r) => {
      const name = r.attributes?.name ?? "adjunto";
      return { name, mimeType: mimeFromName(name), url: r.url };
    });
}

export async function getAzureWorkItem(
  workItemId: number,
  includeImages = true,
  maxComments?: number,
  includeTextAttachments = false,
  maxDepth = DEFAULT_MAX_DEPTH,
  maxNodes = DEFAULT_MAX_NODES
): Promise<AzureWorkItemData> {
  assertFiniteInteger(workItemId, "work_item_id", { min: 1, max: 10_000_000 });
  if (maxComments !== undefined) assertFiniteInteger(maxComments, "max_comments", { min: 0, max: MAX_COMMENT_BUDGET });
  assertFiniteInteger(maxDepth, "max_depth", { min: 0, max: 10 });
  assertFiniteInteger(maxNodes, "max_nodes", { min: 1, max: 200 });

  const { org, project, authHeader } = getCredentials();
  const baseUrl = projectUrl(org, project);

  console.error(`[azure] GET work item ${workItemId}`);
  const raw = await fetchAzure<RawWorkItem>(
    `${baseUrl}/workitems/${workItemId}?$expand=all&api-version=7.1`,
    authHeader
  );

  const { nodes, truncated, skipped, inaccessible, nodeCapped } = await collectTree(org, raw, authHeader, maxDepth, maxNodes);
  console.error(`[azure] Tree: ${nodes.size} work item(s)${truncated ? " (truncado)" : ""}`);

  // Comments live on their own endpoint, so this is one call per node — run them together
  const commentsById = new Map<number, AzureComment[]>();
      const commentPaginationById = new Map<number, { complete: boolean; nextCursor: string | null; fetched: number; budget: number }>();
  await mapWithConcurrency([...nodes.keys()], 3, async (id) => {
    const result = await fetchAllComments(baseUrl, id, authHeader, maxComments);
    commentsById.set(id, result.comments);
    commentPaginationById.set(id, result.pagination);
  });

  const rootRelations = raw.relations ?? [];
  const relatedIds = rootRelations
    .filter((r) => r.rel === "System.LinkTypes.Related")
    .map((r) => idFromUrl(r.url))
    .filter((id): id is number => id !== null);

  const parentId =
    rootRelations
      .filter((r) => r.rel === "System.LinkTypes.Hierarchy-Reverse")
      .map((r) => idFromUrl(r.url))
      .find((id): id is number => id !== null) ?? num(raw.fields ?? {}, "System.Parent");

  // Parent and related items stay summaries on purpose — they are context, not the ticket.
  const outsideIds = [...new Set([...relatedIds, ...(parentId !== null ? [parentId] : [])])].filter(
    (id) => !nodes.has(id)
  );
  const outsideBudget = Math.max(0, maxNodes - nodes.size);
  const outsideToFetch = outsideIds.slice(0, outsideBudget);
  const omittedOutsideIds = new Set(outsideIds.slice(outsideBudget));
  const outside = await fetchWorkItemsBatch(org, outsideToFetch, authHeader, false);

  const summarize = (id: number): AzureLink => {
    if (omittedOutsideIds.has(id)) return { id, title: `(work item ${id} omitido por max_nodes)`, type: "" };
    const item = nodes.get(id) ?? outside.get(id);
    if (!item) return { id, title: `(work item ${id} inaccesible)`, type: "" };
    return {
      id,
      title: str(item.fields, "System.Title"),
      type: str(item.fields, "System.WorkItemType"),
    };
  };

  // A child that could not be fetched still shows up, saying why. Dropping it silently
  // would make an incomplete ticket look complete.
  const stubNode = (id: number): AzureWorkItemNode => ({
    id,
    title: skipped.has(id)
      ? "(no traído — árbol truncado, subí max_depth o max_nodes)"
      : "(inaccesible — borrado, de otro proyecto, o fuera del alcance del PAT)",
    workItemType: "",
    state: "",
    reason: null,
    priority: null,
    assignee: null,
    createdBy: null,
    storyPoints: null,
    remainingWork: null,
    tags: [],
    iterationPath: null,
    areaPath: null,
    description: "",
    acceptanceCriteria: "",
    reproSteps: "",
    comments: [],
    attachments: [],
    children: [],
    url: `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${id}`,
  });

  const inlineImages: AzureImage[] = [];
  const referencedImages: AzureImageRef[] = [];
  const seenInline = new Set<string>();
  const seenRefUrls = new Set<string>();

  /** HTML -> text, lifting out every image the body carries. */
  const render = (html: string, prefix: string): string => {
    if (!html) return "";
    if (!includeImages) return htmlToText(html);

    const { html: stripped, inline, referenced } = extractBodyImages(html, prefix, 1);

    for (const img of inline) {
      // The same screenshot often gets pasted into both a description and a comment
      if (seenInline.has(img.base64)) continue;
      seenInline.add(img.base64);
      inlineImages.push(img);
    }

    for (const ref of referenced) {
      if (seenRefUrls.has(ref.url)) continue;
      seenRefUrls.add(ref.url);
      referencedImages.push(ref);
    }

    return htmlToText(stripped);
  };

  const buildNode = (item: RawWorkItem, seen: Set<number>): AzureWorkItemNode => {
    const f = item.fields ?? {};
    seen.add(item.id);

    const children = childIdsOf(item)
      .filter((id) => !seen.has(id))
      .map((id) => {
        const child = nodes.get(id);
        return child ? buildNode(child, seen) : stubNode(id);
      });

    return {
      id: item.id,
      title: str(f, "System.Title"),
      workItemType: str(f, "System.WorkItemType") || "Work Item",
      state: str(f, "System.State"),
      reason: str(f, "System.Reason") || null,
      priority: num(f, "Microsoft.VSTS.Common.Priority"),
      assignee: identityName(f["System.AssignedTo"]),
      createdBy: identityName(f["System.CreatedBy"]),
      storyPoints: num(f, "Microsoft.VSTS.Scheduling.StoryPoints"),
      remainingWork: num(f, "Microsoft.VSTS.Scheduling.RemainingWork"),
      tags: str(f, "System.Tags")
        .split(";")
        .map((t) => t.trim())
        .filter(Boolean),
      iterationPath: str(f, "System.IterationPath") || null,
      areaPath: str(f, "System.AreaPath") || null,
      description: render(str(f, "System.Description"), `wi${item.id}-desc`),
      acceptanceCriteria: render(str(f, "Microsoft.VSTS.Common.AcceptanceCriteria"), `wi${item.id}-ac`),
      reproSteps: render(str(f, "Microsoft.VSTS.TCM.ReproSteps"), `wi${item.id}-repro`),
      comments: (commentsById.get(item.id) ?? []).map((c, i) => ({
        ...c,
        text: render(c.text, `wi${item.id}-com${i + 1}`),
      })),
      commentPagination: commentPaginationById.get(item.id),
      attachments: attachmentsOf(item),
      children,
      url:
        item._links?.html?.href ??
        `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${item.id}`,
    };
  };

  const rootNode = buildNode(raw, new Set());

  // Attachments are gathered across the whole tree — a screenshot on a child Bug
  // is as much part of the ticket as one on the root.
  const allAttachments = [...nodes.values()].flatMap(attachmentsOf);
  const seenUrls = new Set<string>();
  const uniqueAttachments = allAttachments.filter((a) =>
    seenUrls.has(a.url) ? false : (seenUrls.add(a.url), true)
  );

  let images: AzureImage[] = [];
  if (includeImages) {
    const downloaded = await mapWithConcurrency(
      uniqueAttachments.filter((a) => isImageAttachment(a.name)),
      3,
      async (a): Promise<AzureImage | null> => {
          const base64 = await downloadAzureImage(a.url, authHeader);
          return base64 ? { name: a.name, mimeType: a.mimeType, base64, url: a.url } : null;
      }
    );
    // Images referenced by URL from a body but never linked as an AttachedFile relation
    const attachedUrls = new Set(uniqueAttachments.map((a) => a.url));
    const fetchedRefs = await mapWithConcurrency(
      referencedImages.filter((ref) => !attachedUrls.has(ref.url)),
      3,
      async (ref): Promise<AzureImage | null> => {
          const base64 = await downloadAzureImage(ref.url, authHeader);
          return base64 ? { name: ref.name, mimeType: mimeFromName(ref.name), base64, url: ref.url } : null;
      }
    );

    const attached = downloaded.filter((img): img is AzureImage => img !== null);
    const referenced = fetchedRefs.filter((img): img is AzureImage => img !== null);
    images = [...attached, ...referenced, ...inlineImages];
    console.error(
      `[azure] Images: ${attached.length} adjunta(s), ${referenced.length} referenciada(s), ${inlineImages.length} embebida(s)`
    );
  }

  let textAttachments: TextAttachment[] = [];
  if (includeTextAttachments) {
    const downloaded = await mapWithConcurrency(
      uniqueAttachments.filter((a) => !isImageAttachment(a.name) && isTextAttachment(a.name, a.mimeType)),
      3,
      async (a): Promise<TextAttachment | null> => {
          const result = await downloadAzureText(a.url, authHeader);
          if (!result) return null;
          return { name: a.name, mimeType: a.mimeType, content: result.content, truncated: result.truncated };
      }
    );
    textAttachments = downloaded.filter((t): t is TextAttachment => t !== null);
  }

  const missingLinks = [
    ...relatedIds.map((id) => ({ id, relation: "related" as const })),
    ...(parentId !== null ? [{ id: parentId, relation: "parent" as const }] : []),
  ]
    .filter(({ id }) => !nodes.has(id) && (omittedOutsideIds.has(id) || !outside.has(id)))
    .map(({ id, relation }) => ({
      id,
      relation,
      reason: omittedOutsideIds.has(id) ? "node_cap" as const : "inaccessible" as const,
    }));

  const workItem: AzureWorkItemResult = {
    ...rootNode,
    parent: parentId !== null ? summarize(parentId) : null,
    related: relatedIds.map(summarize),
    truncated,
    nodeCount: nodes.size,
    missingChildren: [...[...inaccessible].map((id) => ({ id, reason: "inaccessible" as const }),), ...[...skipped].filter((id) => !inaccessible.has(id)).map((id) => ({ id, reason: nodeCapped.has(id) || nodes.size >= maxNodes ? "node_cap" as const : "depth_cap" as const }))],
    missingLinks,
  };

  return { workItem, images, textAttachments };
}

export interface AzureSearchResult {
  workItems: {
    id: number;
    title: string;
    type: string;
    state: string;
    assignee: string | null;
    iterationPath: string | null;
  }[];
  total: number;
}

const DEFAULT_WIQL_FIELDS = "[System.Id]";

export async function searchAzureWorkItems(
  wiql: string,
  maxResults = 20
): Promise<AzureSearchResult> {
  assertFiniteInteger(maxResults, "max_results", { min: 1, max: MAX_SEARCH_RESULTS });

  const { org, project, authHeader } = getCredentials();
  const baseUrl = projectUrl(org, project);

  const query = wiql.trim().toUpperCase().startsWith("SELECT")
    ? wiql
    : `SELECT ${DEFAULT_WIQL_FIELDS} FROM WorkItems WHERE ${wiql} ORDER BY [System.ChangedDate] DESC`;

  console.error(`[azure] WIQL query`);
  const result = await fetchAzure<{ workItems?: { id: number }[] }>(
    `${baseUrl}/wiql?$top=${maxResults}&api-version=7.1`,
    authHeader,
    { method: "POST", body: JSON.stringify({ query }) }
  );

  const ids = (result.workItems ?? []).map((w) => w.id).slice(0, maxResults);
  const items = await fetchWorkItemsBatch(org, ids, authHeader, false);

  return {
    total: ids.length,
    workItems: ids.map((id) => {
      const item = items.get(id);
      return {
        id,
        title: item ? str(item.fields, "System.Title") : "",
        type: item ? str(item.fields, "System.WorkItemType") : "",
        state: item ? str(item.fields, "System.State") : "",
        assignee: item ? identityName(item.fields["System.AssignedTo"]) : null,
        iterationPath: item ? str(item.fields, "System.IterationPath") || null : null,
      };
    }),
  };
}

export async function addAzureComment(workItemId: number, text: string): Promise<void> {
  assertFiniteInteger(workItemId, "work_item_id", { min: 1, max: 10_000_000 });

  const { org, project, authHeader } = getCredentials();
  const baseUrl = projectUrl(org, project);

  const response = await fetch(
    `${baseUrl}/workItems/${workItemId}/comments?api-version=7.1-preview.3`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (response.status === 203 || response.status === 401) {
    throw new Error("revisar credenciales de Azure DevOps (PAT vencido o sin scope Work Items)");
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("el PAT no tiene permiso de escritura (necesita scope Work Items: Read & Write)");
    }
    throw new Error(`Azure DevOps comment failed: HTTP ${response.status} ${response.statusText}`);
  }
}

export interface AzureStatusResult {
  configured: boolean;
  connected: boolean;
  org?: string;
  project?: string;
  workItemTypes?: string[];
  error?: string;
}

export async function getAzureStatus(): Promise<AzureStatusResult> {
  const org = process.env.AZURE_DEVOPS_ORG;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  const pat = process.env.AZURE_DEVOPS_PAT;

  if (!org || !project || !pat) {
    return { configured: false, connected: false };
  }

  const authHeader = `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;

  try {
    // workitemtypes only needs the Work Items (Read) scope, unlike the projects endpoint
    const response = await fetch(`${projectUrl(org, project)}/workitemtypes?api-version=7.1`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
    });

    // 203 is a 2xx, so it must be caught before response.ok
    if (response.status === 203 || response.status === 401) {
      return {
        configured: true,
        connected: false,
        org,
        project,
        error: "credenciales inválidas o PAT sin scope Work Items",
      };
    }

    if (!response.ok) {
      const msg =
        response.status === 404 ? "organización o proyecto no encontrado" : `HTTP ${response.status}`;
      return { configured: true, connected: false, org, project, error: msg };
    }

    const data = (await response.json()) as { value: { name: string }[] };
    return {
      configured: true,
      connected: true,
      org,
      project,
      workItemTypes: (data.value ?? []).map((t) => t.name),
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      org,
      project,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
