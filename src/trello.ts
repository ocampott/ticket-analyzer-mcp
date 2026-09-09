import { downloadBytes, mapWithConcurrency } from "./download.js";
import { assertFiniteInteger } from "./validation.js";

export interface TrelloCard {
  name: string;
  desc: string;
  due?: string | null;
  labels?: { id: string; name: string; color: string }[];
  members?: { id: string; fullName: string }[];
  checklists?: {
    id: string;
    name: string;
    checkItems: { id: string; name: string; state: "complete" | "incomplete" }[];
  }[];
  list?: { id: string; name: string } | null;
  actions?: TrelloAction[];
  attachments?: TrelloAttachmentRaw[];
}

export interface TrelloAction {
  id?: string;
  memberCreator: { fullName: string };
  date: string;
  data: { text: string };
}

export interface TrelloComment {
  author: string;
  date: string;
  text: string;
}

export interface TrelloAttachmentRaw {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  isUpload: boolean;
  bytes: number;
}

export interface TrelloImage {
  name: string;
  mimeType: string;
  base64: string;
  url?: string;
}

export interface TrelloChecklistItem {
  text: string;
  done: boolean;
}

export interface TrelloChecklistResult {
  name: string;
  items: TrelloChecklistItem[];
}

export interface CommentPagination {
  complete: boolean;
  nextCursor: string | null;
  fetched: number;
  budget: number;
  reason?: "budget" | "cursor_unavailable" | "page_budget";
}

export interface TrelloCardResult {
  name: string;
  description: string;
  list: string | null;
  labels: string[];
  due: string | null;
  members: string[];
  comments: TrelloComment[];
  commentPagination: CommentPagination;
  checklists: TrelloChecklistResult[];
  attachments: { name: string; url: string; mimeType: string }[];
}

export interface TrelloCardData {
  card: TrelloCardResult;
  images: TrelloImage[];
  textAttachments: TextAttachment[];
}

const TEXT_MIME_EXACT = new Set(["application/json", "application/sql", "application/xml"]);
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".sql", ".txt", ".md", ".json", ".csv", ".xml", ".yaml", ".yml"]);
const MAX_TEXT_BYTES = 200_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMMENT_BUDGET = 200;
const COMMENT_PAGE_SIZE = 100;
const MAX_COMMENT_PAGES = 10;
const TRELLO_API_ORIGIN = "https://api.trello.com";
const TRELLO_ATTACHMENT_ORIGINS = [TRELLO_API_ORIGIN, "https://trello.com"];

function stripHtmlNoise(content: string): string {
  return content
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export interface TextAttachment {
  name: string;
  mimeType: string;
  content: string;
  truncated: boolean;
}

export function isTextAttachment(name: string, mimeType: string): boolean {
  if (mimeType.startsWith("text/")) return true;
  if (TEXT_MIME_EXACT.has(mimeType)) return true;
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

export async function downloadTextAttachment(url: string): Promise<{ content: string; truncated: boolean } | null> {
  const { apiKey, token } = getCredentials();
  const bytes = await downloadBytes(url, {
    maxBytes: MAX_TEXT_BYTES,
    allowTruncated: true,
    headers: { Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"` },
    credentialOrigins: TRELLO_ATTACHMENT_ORIGINS,
    allowedOrigins: TRELLO_ATTACHMENT_ORIGINS,
  });
  if (!bytes) return null;
  let text = new TextDecoder().decode(bytes);
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") text = stripHtmlNoise(text);
  return bytes.byteLength >= MAX_TEXT_BYTES
    ? { content: text.slice(0, MAX_TEXT_BYTES) + "\n[truncado: archivo excede 200 000 caracteres]", truncated: true }
    : { content: text, truncated: false };
}

function getCredentials(): { apiKey: string; token: string } {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!apiKey || !token) {
    throw new Error(
      "Trello credentials not configured. Run /ticket-analyzer:setup to set up your API key and token."
    );
  }

  return { apiKey, token };
}

async function fetchTrello<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("tarjeta no encontrada");
    }
    if (response.status === 401) {
      throw new Error("revisar credenciales");
    }
    throw new Error(
      `Trello API error: HTTP ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function downloadImage(url: string): Promise<string | null> {
  const { apiKey, token } = getCredentials();
  const bytes = await downloadBytes(url, {
    maxBytes: MAX_IMAGE_BYTES,
    headers: { Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"` },
    credentialOrigins: TRELLO_ATTACHMENT_ORIGINS,
    allowedOrigins: TRELLO_ATTACHMENT_ORIGINS,
  });
  return bytes ? Buffer.from(bytes).toString("base64") : null;
}

export async function getTrelloCard(
  cardId: string,
  includeImages = true,
  maxComments?: number,
  includeTextAttachments = false
): Promise<TrelloCardData> {
  if (maxComments !== undefined) assertFiniteInteger(maxComments, "max_comments", { min: 0, max: MAX_COMMENT_BUDGET });
  const { apiKey, token } = getCredentials();
  const url = `https://api.trello.com/1/cards/${cardId}?fields=name,desc,due,labels&members=true&member_fields=fullName&checklists=all&list=true&list_fields=name&actions=commentCard&actions_limit=100&attachments=true&attachment_fields=name,url,mimeType,isUpload,bytes&key=${apiKey}&token=${token}`;

  console.error(`[trello] GET card ${cardId}`);
  const card = await fetchTrello<TrelloCard>(url);

  const rawActions = card.actions ?? [];
  const budget = maxComments ?? MAX_COMMENT_BUDGET;
  let fetchCursor = rawActions.at(-1)?.id ?? null;
  let commentPages = 1;
  while (rawActions.length < budget && rawActions.length >= COMMENT_PAGE_SIZE && fetchCursor && commentPages < MAX_COMMENT_PAGES) {
    const page = await fetchTrello<TrelloAction[]>(`https://api.trello.com/1/cards/${cardId}/actions?filter=commentCard&limit=${Math.min(COMMENT_PAGE_SIZE, budget - rawActions.length)}&before=${encodeURIComponent(fetchCursor)}&key=${apiKey}&token=${token}`);
    rawActions.push(...page);
    fetchCursor = page.at(-1)?.id ?? null;
    commentPages++;
    if (page.length < COMMENT_PAGE_SIZE) break;
  }
  const comments: TrelloComment[] = rawActions.slice(0, budget).map((action) => ({
    author: action.memberCreator.fullName,
    date: action.date,
    text: action.data.text,
  }));

  const rawAttachments = card.attachments ?? [];
  const imageAttachments = rawAttachments.filter((a) =>
    a.mimeType?.startsWith("image/")
  );
  const nonImageAttachments = rawAttachments.filter(
    (a) => !a.mimeType?.startsWith("image/")
  );

  let images: TrelloImage[] = [];

  if (includeImages) {
    const downloadedImages = await mapWithConcurrency(
      imageAttachments,
      3,
      async (a): Promise<TrelloImage | null> => {
        const base64 = await downloadImage(a.url);
        if (!base64) return null;
        return { name: a.name, mimeType: a.mimeType, base64, url: a.url };
      }
    );
    images = downloadedImages.filter((img): img is TrelloImage => img !== null);
  }

  let textAttachments: TextAttachment[] = [];
  if (includeTextAttachments) {
    const textCandidates = nonImageAttachments.filter((a) =>
      isTextAttachment(a.name, a.mimeType ?? "")
    );
    const downloaded = await mapWithConcurrency(
      textCandidates,
      3,
      async (a): Promise<TextAttachment | null> => {
        const result = await downloadTextAttachment(a.url);
        if (!result) return null;
        return { name: a.name, mimeType: a.mimeType, content: result.content, truncated: result.truncated };
      }
    );
    textAttachments = downloaded.filter((t): t is TextAttachment => t !== null);
  }

  return {
    card: {
      name: card.name,
      description: card.desc,
      list: card.list?.name ?? null,
      labels: (card.labels ?? []).map((l) => {
        if (l.color && l.name) return `${l.color}: ${l.name}`;
        return l.name || l.color || "";
      }).filter(Boolean),
      due: card.due ?? null,
      members: (card.members ?? []).map((m) => m.fullName),
      comments,
      commentPagination: {
            complete: rawActions.length < budget && commentPages < MAX_COMMENT_PAGES,
            nextCursor: comments.at(-1) ? rawActions[Math.min(budget, rawActions.length) - 1]?.id ?? null : null,
            fetched: comments.length,
            budget,
            ...(rawActions.length >= budget ? { reason: "budget" as const } : {}),
          },
      checklists: (card.checklists ?? []).map((cl) => ({
        name: cl.name,
        items: [
          ...cl.checkItems
            .filter((i) => i.state === "incomplete")
            .map((i) => ({ text: i.name, done: false })),
          ...cl.checkItems
            .filter((i) => i.state === "complete")
            .map((i) => ({ text: i.name, done: true })),
        ],
      })),
      attachments: rawAttachments.map((a) => ({
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
      })),
    },
    images,
    textAttachments,
  };
}

export interface TrelloCardSummary {
  id: string;
  name: string;
  list: string | null;
  labels: string[];
  due: string | null;
}

export async function listTrelloCards(options: {
  boardId?: string;
  listName?: string;
  query?: string;
}): Promise<TrelloCardSummary[]> {
  const { apiKey, token } = getCredentials();
  const { boardId, listName, query } = options;

  const effectiveBoardId = boardId ?? process.env.TRELLO_DEFAULT_BOARD_ID;

  if (!effectiveBoardId && !query) {
    throw new Error("board_id or query is required");
  }

  interface RawCardSummary {
    id: string;
    name: string;
    idList: string;
    labels: { name: string; color: string }[];
    due: string | null;
  }

  function mapLabel(l: { name: string; color: string }): string {
    if (l.color && l.name) return `${l.color}: ${l.name}`;
    return l.name || l.color || "";
  }

  if (effectiveBoardId) {
    interface RawList { id: string; name: string }

    const [cards, lists] = await Promise.all([
      fetchTrello<RawCardSummary[]>(
        `https://api.trello.com/1/boards/${effectiveBoardId}/cards/open?fields=name,idList,labels,due&key=${apiKey}&token=${token}`
      ),
      fetchTrello<RawList[]>(
        `https://api.trello.com/1/boards/${effectiveBoardId}/lists/open?fields=name&key=${apiKey}&token=${token}`
      ),
    ]);

    const listMap = new Map(lists.map((l) => [l.id, l.name]));

    let result: TrelloCardSummary[] = cards.map((c) => ({
      id: c.id,
      name: c.name,
      list: listMap.get(c.idList) ?? null,
      labels: c.labels.map(mapLabel).filter(Boolean),
      due: c.due,
    }));

    if (listName) {
      const lower = listName.toLowerCase();
      result = result.filter((c) => c.list?.toLowerCase().includes(lower));
    }

    if (query) {
      const lower = query.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(lower));
    }

    return result;
  }

  // Search API fallback — no boardId
  interface TrelloSearchResponse {
    cards: (RawCardSummary & { idBoard: string })[];
  }

  const data = await fetchTrello<TrelloSearchResponse>(
    `https://api.trello.com/1/search?query=${encodeURIComponent(query!)}&modelTypes=cards&card_fields=name,idList,labels,due&key=${apiKey}&token=${token}`
  );

  return data.cards.map((c) => ({
    id: c.id,
    name: c.name,
    list: null,
    labels: c.labels.map(mapLabel).filter(Boolean),
    due: c.due,
  }));
}

export interface TrelloStatusResult {
  configured: boolean;
  connected: boolean;
  username?: string;
  fullName?: string;
  email?: string;
  error?: string;
}

export async function getTrelloStatus(): Promise<TrelloStatusResult> {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!apiKey || !token) {
    return { configured: false, connected: false };
  }

  try {
    const params = new URLSearchParams({ key: apiKey, token, fields: "fullName,email,username" });
    const response = await fetch(`https://api.trello.com/1/members/me?${params.toString()}`);

    if (!response.ok) {
      const msg = response.status === 401 ? "credenciales inválidas" : `HTTP ${response.status}`;
      return { configured: true, connected: false, error: msg };
    }

    const data = await response.json() as { username: string; fullName: string; email: string };
    return { configured: true, connected: true, username: data.username, fullName: data.fullName, email: data.email };
  } catch (err) {
    return { configured: true, connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function addTrelloComment(
  cardId: string,
  text: string
): Promise<void> {
  const { apiKey, token } = getCredentials();

  const params = new URLSearchParams({ text, key: apiKey, token });
  const response = await fetch(
    `https://api.trello.com/1/cards/${cardId}/actions/comments?${params.toString()}`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(
      `Trello comment failed: HTTP ${response.status} ${response.statusText}`
    );
  }
}
