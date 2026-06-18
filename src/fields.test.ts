import { jest } from "@jest/globals";

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as typeof fetch;

import { getJiraCustomFields, resetFieldCache } from "./fields.js";

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

describe("getJiraCustomFields", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    resetFieldCache();
    mockFetch.mockReset();
    process.env = {
      ...OLD_ENV,
      JIRA_HOST: "test.atlassian.net",
      JIRA_EMAIL: "test@test.com",
      JIRA_API_TOKEN: "token",
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("detects sprint and epic fields by name", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, [
      { id: "customfield_10020", name: "Sprint" },
      { id: "customfield_10014", name: "Epic Link" },
      { id: "summary", name: "Summary" },
    ]));
    const result = await getJiraCustomFields();
    expect(result.sprintField).toBe("customfield_10020");
    expect(result.epicField).toBe("customfield_10014");
  });

  it("returns null fields when names not found", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, [
      { id: "summary", name: "Summary" },
    ]));
    const result = await getJiraCustomFields();
    expect(result.sprintField).toBeNull();
    expect(result.epicField).toBeNull();
  });

  it("caches result — second call does not fetch again", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, [
      { id: "customfield_10020", name: "Sprint" },
    ]));
    await getJiraCustomFields();
    await getJiraCustomFields();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null fields when credentials missing — no fetch", async () => {
    delete process.env.JIRA_HOST;
    const result = await getJiraCustomFields();
    expect(result.sprintField).toBeNull();
    expect(result.epicField).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null fields when fetch fails", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(403, {}));
    const result = await getJiraCustomFields();
    expect(result.sprintField).toBeNull();
    expect(result.epicField).toBeNull();
  });

  it("caches null result on error — no retry on next call", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, {}));
    await getJiraCustomFields();
    await getJiraCustomFields();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
