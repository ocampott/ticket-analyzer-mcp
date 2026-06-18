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
}

export interface TrelloChecklistItem {
  text: string;
  done: boolean;
}

export interface TrelloChecklistResult {
  name: string;
  items: TrelloChecklistItem[];
}

export interface TrelloCardResult {
  name: string;
  description: string;
  list: string | null;
  labels: string[];
  due: string | null;
  members: string[];
  comments: TrelloComment[];
  checklists: TrelloChecklistResult[];
  attachments: { name: string; url: string; mimeType: string }[];
}

export interface TrelloCardData {
  card: TrelloCardResult;
  images: TrelloImage[];
}

function getCredentials(): { apiKey: string; token: string } {
  const apiKey = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!apiKey || !token) {
    throw new Error(
      "Missing Trello credentials: TRELLO_API_KEY and TRELLO_TOKEN environment variables are required."
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function downloadImage(url: string): Promise<string | null> {
  const { apiKey, token } = getCredentials();
  console.error(`[trello] Downloading image: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`,
      },
    });

    if (!response.ok) {
      console.error(`[trello] Image download failed: HTTP ${response.status} for ${url}`);
      return null;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      console.error(`[trello] Skipping image > 5MB: ${url}`);
      return null;
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      console.error(`[trello] Skipping image > 5MB after download: ${url}`);
      return null;
    }

    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error(`[trello] Image download error for ${url}:`, err);
    return null;
  }
}

export async function getTrelloCard(
  cardId: string,
  includeImages = true,
  maxComments?: number
): Promise<TrelloCardData> {
  const { apiKey, token } = getCredentials();
  const url = `https://api.trello.com/1/cards/${cardId}?fields=name,desc,due,labels&members=true&member_fields=fullName&checklists=all&list=true&list_fields=name&actions=commentCard&actions_limit=1000&attachments=true&attachment_fields=name,url,mimeType,isUpload,bytes&key=${apiKey}&token=${token}`;

  console.error(`[trello] GET card ${cardId}`);
  const card = await fetchTrello<TrelloCard>(url);

  const rawActions = card.actions ?? [];
  const limitedActions =
    maxComments !== undefined ? rawActions.slice(0, maxComments) : rawActions;
  const comments: TrelloComment[] = limitedActions.map((action) => ({
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
    const downloadedImages = await Promise.all(
      imageAttachments.map(async (a): Promise<TrelloImage | null> => {
        const base64 = await downloadImage(a.url);
        if (!base64) return null;
        return { name: a.name, mimeType: a.mimeType, base64 };
      })
    );
    images = downloadedImages.filter((img): img is TrelloImage => img !== null);
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
      attachments: nonImageAttachments.map((a) => ({
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
      })),
    },
    images,
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
