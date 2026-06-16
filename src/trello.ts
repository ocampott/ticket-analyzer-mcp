export interface TrelloCard {
  name: string;
  desc: string;
  due?: string | null;
  shortUrl?: string;
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
  shortUrl: string;
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

export async function getTrelloCard(cardId: string, includeImages = true): Promise<TrelloCardData> {
  const { apiKey, token } = getCredentials();
  const url = `https://api.trello.com/1/cards/${cardId}?fields=name,desc,due,shortUrl,labels&members=true&member_fields=fullName&checklists=all&list=true&list_fields=name&actions=commentCard&actions_limit=1000&attachments=true&attachment_fields=name,url,mimeType,isUpload,bytes&key=${apiKey}&token=${token}`;

  console.error(`[trello] GET card ${cardId}`);
  const card = await fetchTrello<TrelloCard>(url);

  const rawActions = card.actions ?? [];
  const comments: TrelloComment[] = rawActions.map((action) => ({
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
      shortUrl: card.shortUrl ?? "",
      list: card.list?.name ?? null,
      labels: (card.labels ?? []).map((l) => l.name).filter(Boolean),
      due: card.due ?? null,
      members: (card.members ?? []).map((m) => m.fullName),
      comments,
      checklists: (card.checklists ?? []).map((cl) => ({
        name: cl.name,
        items: cl.checkItems.map((item) => ({
          text: item.name,
          done: item.state === "complete",
        })),
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
