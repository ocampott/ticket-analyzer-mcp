import { jest } from "@jest/globals";

// Mock fetch globally before importing trello module
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as typeof fetch;

import {
  getCard,
  getComments,
  getTrelloCard,
  TrelloCard,
  TrelloAction,
  TrelloComment,
  TrelloAttachmentRaw,
} from "./trello.js";

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : status === 401 ? "Unauthorized" : "Error",
    json: async () => body,
  } as unknown as Response;
}

describe("trello module", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TRELLO_API_KEY: "test-key", TRELLO_TOKEN: "test-token" };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("getCard", () => {
    it("returns card name and desc on success", async () => {
      const card: TrelloCard = { name: "My Card", desc: "Some description" };
      mockFetch.mockResolvedValueOnce(makeResponse(200, card));

      const result = await getCard("abc123");
      expect(result.name).toBe("My Card");
      expect(result.desc).toBe("Some description");
    });

    it("throws 'tarjeta no encontrada' on 404", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, {}));
      await expect(getCard("bad-id")).rejects.toThrow("tarjeta no encontrada");
    });

    it("throws 'revisar credenciales' on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
      await expect(getCard("any-id")).rejects.toThrow("revisar credenciales");
    });

    it("throws generic error on other HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, {}));
      await expect(getCard("any-id")).rejects.toThrow("Trello API error: HTTP 500");
    });

    it("throws when env vars are missing", async () => {
      delete process.env.TRELLO_API_KEY;
      await expect(getCard("any-id")).rejects.toThrow("Missing Trello credentials");
    });
  });

  describe("getComments", () => {
    it("returns mapped comments array on success", async () => {
      const actions: TrelloAction[] = [
        {
          memberCreator: { fullName: "Alice" },
          date: "2024-01-01T00:00:00.000Z",
          data: { text: "Hello!" },
        },
        {
          memberCreator: { fullName: "Bob" },
          date: "2024-01-02T00:00:00.000Z",
          data: { text: "World!" },
        },
      ];
      mockFetch.mockResolvedValueOnce(makeResponse(200, actions));

      const result = await getComments("abc123");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual<TrelloComment>({
        author: "Alice",
        date: "2024-01-01T00:00:00.000Z",
        text: "Hello!",
      });
      expect(result[1]).toEqual<TrelloComment>({
        author: "Bob",
        date: "2024-01-02T00:00:00.000Z",
        text: "World!",
      });
    });

    it("returns empty array when no comments", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, []));
      const result = await getComments("abc123");
      expect(result).toEqual([]);
    });

    it("returns empty array when response is null/undefined", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, null));
      const result = await getComments("abc123");
      expect(result).toEqual([]);
    });

    it("throws 'tarjeta no encontrada' on 404", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, {}));
      await expect(getComments("bad-id")).rejects.toThrow("tarjeta no encontrada");
    });

    it("throws 'revisar credenciales' on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
      await expect(getComments("any-id")).rejects.toThrow("revisar credenciales");
    });
  });

  describe("getTrelloCard", () => {
    it("returns combined card data with comments and no images", async () => {
      const card: TrelloCard = { name: "Test Card", desc: "Test description" };
      const actions: TrelloAction[] = [
        {
          memberCreator: { fullName: "Charlie" },
          date: "2024-03-01T12:00:00.000Z",
          data: { text: "A comment" },
        },
      ];
      const attachments: TrelloAttachmentRaw[] = [];
      mockFetch
        .mockResolvedValueOnce(makeResponse(200, card))
        .mockResolvedValueOnce(makeResponse(200, actions))
        .mockResolvedValueOnce(makeResponse(200, attachments));

      const { card: result, images } = await getTrelloCard("abc123");
      expect(result.name).toBe("Test Card");
      expect(result.description).toBe("Test description");
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].author).toBe("Charlie");
      expect(result.comments[0].text).toBe("A comment");
      expect(images).toEqual([]);
    });

    it("returns empty comments when card has no comments", async () => {
      const card: TrelloCard = { name: "Silent Card", desc: "" };
      mockFetch
        .mockResolvedValueOnce(makeResponse(200, card))
        .mockResolvedValueOnce(makeResponse(200, []))
        .mockResolvedValueOnce(makeResponse(200, []));

      const { card: result } = await getTrelloCard("abc123");
      expect(result.name).toBe("Silent Card");
      expect(result.description).toBe("");
      expect(result.comments).toEqual([]);
    });

    it("propagates 404 error from getCard", async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(404, {}))
        .mockResolvedValueOnce(makeResponse(200, []))
        .mockResolvedValueOnce(makeResponse(200, []));

      await expect(getTrelloCard("bad-id")).rejects.toThrow("tarjeta no encontrada");
    });

    it("propagates 401 error", async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(401, {}))
        .mockResolvedValueOnce(makeResponse(401, {}))
        .mockResolvedValueOnce(makeResponse(401, {}));

      await expect(getTrelloCard("any-id")).rejects.toThrow("revisar credenciales");
    });
  });
});
