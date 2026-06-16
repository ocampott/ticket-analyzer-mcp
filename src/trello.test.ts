import { jest } from "@jest/globals";

// Mock fetch globally before importing trello module
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as typeof fetch;

import {
  getTrelloCard,
  TrelloCard,
  TrelloComment,
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
});
