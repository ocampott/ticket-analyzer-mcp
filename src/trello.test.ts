import { jest } from "@jest/globals";

// Mock fetch globally before importing trello module
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as typeof fetch;

import {
  getTrelloCard,
  TrelloCard,
  TrelloComment,
  listTrelloCards,
  addTrelloComment,
} from "./trello.js";

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : status === 401 ? "Unauthorized" : "Error",
    json: async () => body,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

describe("getTrelloCard", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TRELLO_API_KEY: "test-key", TRELLO_TOKEN: "test-token" };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns card name and desc", async () => {
    const card: TrelloCard = { name: "My Card", desc: "Description", actions: [], attachments: [] };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123");
    expect(result.name).toBe("My Card");
    expect(result.description).toBe("Description");
  });

  it("returns mapped comments from actions field", async () => {
    const card: TrelloCard = {
      name: "My Card",
      desc: "Description",
      actions: [
        { memberCreator: { fullName: "Alice" }, date: "2024-01-01T00:00:00.000Z", data: { text: "Hello!" } },
        { memberCreator: { fullName: "Bob" }, date: "2024-01-02T00:00:00.000Z", data: { text: "World!" } },
      ],
      attachments: [],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123");
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]).toEqual<TrelloComment>({
      author: "Alice",
      date: "2024-01-01T00:00:00.000Z",
      text: "Hello!",
    });
    expect(result.comments[1]).toEqual<TrelloComment>({
      author: "Bob",
      date: "2024-01-02T00:00:00.000Z",
      text: "World!",
    });
  });

  it("returns empty comments when actions is empty", async () => {
    const card: TrelloCard = { name: "Silent Card", desc: "", actions: [], attachments: [] };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123");
    expect(result.comments).toEqual([]);
  });

  it("returns empty comments when actions is null/undefined", async () => {
    const card: TrelloCard = { name: "Silent Card", desc: "" };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123");
    expect(result.comments).toEqual([]);
  });

  it("throws 'tarjeta no encontrada' on 404", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, {}));
    await expect(getTrelloCard("bad-id")).rejects.toThrow("tarjeta no encontrada");
  });

  it("throws 'revisar credenciales' on 401", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(getTrelloCard("any-id")).rejects.toThrow("revisar credenciales");
  });

  it("throws generic error on 500", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, {}));
    await expect(getTrelloCard("any-id")).rejects.toThrow("Trello API error: HTTP 500");
  });

  it("throws 'Missing Trello credentials' when env vars missing", async () => {
    delete process.env.TRELLO_API_KEY;
    await expect(getTrelloCard("any-id")).rejects.toThrow("Missing Trello credentials");
  });

  it("skips image download when includeImages is false", async () => {
    const card: TrelloCard = {
      name: "My Card",
      desc: "Description",
      actions: [],
      attachments: [
        { id: "att1", name: "screenshot.png", url: "https://trello.com/att1", mimeType: "image/png", isUpload: true, bytes: 1024 },
      ],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result, images } = await getTrelloCard("abc123", false);
    expect(images).toEqual([]);
    // Only 1 fetch call for the card itself — no download fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // The image attachment should NOT appear in card.attachments (it's image type)
    expect(result.attachments).toHaveLength(0);
  });

  it("downloads images when includeImages is true", async () => {
    const imageData = new Uint8Array([1, 2, 3]).buffer;
    const card: TrelloCard = {
      name: "My Card",
      desc: "Description",
      actions: [],
      attachments: [
        { id: "att1", name: "screenshot.png", url: "https://trello.com/att1", mimeType: "image/png", isUpload: true, bytes: 1024 },
      ],
    };
    const imageResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-length": "3" }),
      arrayBuffer: async () => imageData,
      json: async () => ({}),
    } as unknown as Response;

    mockFetch
      .mockResolvedValueOnce(makeResponse(200, card))
      .mockResolvedValueOnce(imageResponse);

    const { images } = await getTrelloCard("abc123", true);
    expect(images).toHaveLength(1);
    expect(images[0].name).toBe("screenshot.png");
    expect(images[0].mimeType).toBe("image/png");
    // 2 fetch calls: one for card, one for image download
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("includes color in label name when color is set", async () => {
    const card: TrelloCard = {
      name: "My Card",
      desc: "",
      actions: [],
      attachments: [],
      labels: [
        { id: "1", name: "Blocker", color: "red" },
        { id: "2", name: "Nice to have", color: "yellow" },
      ],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123", false);
    expect(result.labels).toEqual(["red: Blocker", "yellow: Nice to have"]);
  });

  it("shows completed checklist items with done:true", async () => {
    const card: TrelloCard = {
      name: "My Card",
      desc: "",
      actions: [],
      attachments: [],
      checklists: [
        {
          id: "cl1",
          name: "Steps",
          checkItems: [
            { id: "i1", name: "Todo item", state: "incomplete" },
            { id: "i2", name: "Done item", state: "complete" },
          ],
        },
      ],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123", false);
    expect(result.checklists[0].items).toHaveLength(2);
    expect(result.checklists[0].items[0]).toEqual({ text: "Todo item", done: false });
    expect(result.checklists[0].items[1]).toEqual({ text: "Done item", done: true });
  });

  it("truncates comments to maxComments most recent", async () => {
    const card: TrelloCard = {
      name: "My Card",
      desc: "",
      actions: [
        { memberCreator: { fullName: "A" }, date: "2024-01-01T00:00:00.000Z", data: { text: "First" } },
        { memberCreator: { fullName: "B" }, date: "2024-01-02T00:00:00.000Z", data: { text: "Second" } },
        { memberCreator: { fullName: "C" }, date: "2024-01-03T00:00:00.000Z", data: { text: "Third" } },
      ],
      attachments: [],
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, card));

    const { card: result } = await getTrelloCard("abc123", false, 2);
    expect(result.comments).toHaveLength(2);
    // Trello returns actions newest-first; slice(0, 2) = most recent 2
    expect(result.comments[0].text).toBe("First");
    expect(result.comments[1].text).toBe("Second");
  });
});

describe("listTrelloCards", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TRELLO_API_KEY: "test-key", TRELLO_TOKEN: "test-token" };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("fetches cards and lists from board and returns mapped results", async () => {
    const cards = [
      { id: "card1", name: "Fix bug", idList: "list1", labels: [{ name: "Blocker", color: "red" }], due: null },
      { id: "card2", name: "Add feature", idList: "list2", labels: [], due: "2024-06-01T00:00:00.000Z" },
    ];
    const lists = [
      { id: "list1", name: "In Progress" },
      { id: "list2", name: "To Do" },
    ];
    mockFetch
      .mockResolvedValueOnce(makeResponse(200, cards))
      .mockResolvedValueOnce(makeResponse(200, lists));

    const result = await listTrelloCards({ boardId: "board1" });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "card1",
      name: "Fix bug",
      list: "In Progress",
      labels: ["red: Blocker"],
      due: null,
    });
    expect(result[1].list).toBe("To Do");
  });

  it("filters by listName case-insensitively", async () => {
    const cards = [
      { id: "c1", name: "Card A", idList: "l1", labels: [], due: null },
      { id: "c2", name: "Card B", idList: "l2", labels: [], due: null },
    ];
    const lists = [{ id: "l1", name: "In Progress" }, { id: "l2", name: "Done" }];
    mockFetch
      .mockResolvedValueOnce(makeResponse(200, cards))
      .mockResolvedValueOnce(makeResponse(200, lists));

    const result = await listTrelloCards({ boardId: "board1", listName: "in progress" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });

  it("filters by query string", async () => {
    const cards = [
      { id: "c1", name: "Auth bug", idList: "l1", labels: [], due: null },
      { id: "c2", name: "Unrelated", idList: "l1", labels: [], due: null },
    ];
    mockFetch
      .mockResolvedValueOnce(makeResponse(200, cards))
      .mockResolvedValueOnce(makeResponse(200, [{ id: "l1", name: "To Do" }]));

    const result = await listTrelloCards({ boardId: "board1", query: "auth" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Auth bug");
  });

  it("uses search API when no boardId provided", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {
      cards: [{ id: "c1", name: "Found card", idList: "l1", labels: [], due: null }],
    }));

    const result = await listTrelloCards({ query: "auth" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/1/search");
    expect(url).toContain("auth");
  });

  it("throws when neither boardId nor query provided", async () => {
    await expect(listTrelloCards({})).rejects.toThrow("board_id or query is required");
  });
});

describe("addTrelloComment", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TRELLO_API_KEY: "test-key", TRELLO_TOKEN: "test-token" };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("POSTs comment and resolves", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: "action1" }));
    await expect(addTrelloComment("card123", "Hello!")).resolves.toBeUndefined();

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/1/cards/card123/actions/comments");
    expect(url).toContain("key=test-key");
    expect(url).toContain("token=test-token");
    expect(url).toContain("text=");
    expect((options as RequestInit).method).toBe("POST");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(403, {}));
    await expect(addTrelloComment("card123", "Hello!")).rejects.toThrow("Trello comment failed: HTTP 403");
  });
});
