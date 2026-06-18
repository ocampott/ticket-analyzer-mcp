import { jest } from "@jest/globals";

// Mock fetch globally before importing jira module
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as typeof fetch;

import { adfToText, getJiraIssue, searchJiraIssues, addJiraComment } from "./jira.js";
import { resetFieldCache } from "./fields.js";

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

interface MockJiraRaw {
  key: string;
  fields: {
    summary: string;
    issuetype?: { name: string };
    status?: { name: string };
    priority?: { name: string } | null;
    assignee?: { displayName: string } | null;
    reporter?: { displayName: string } | null;
    labels?: string[];
    components?: { name: string }[];
    description?: unknown;
    comment?: { comments: unknown[]; total: number; maxResults: number };
    attachment?: unknown[];
    subtasks?: { key: string; fields: { summary: string; status: { name: string } } }[];
    parent?: { key: string; fields: { summary: string } } | null;
    [key: string]: unknown;
  };
}

// ─── Part A: adfToText tests ─────────────────────────────────────────────────

describe("adfToText", () => {
  it("returns empty string for null input", () => {
    expect(adfToText(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(adfToText(undefined)).toBe("");
  });

  it("returns text for text node", () => {
    expect(adfToText({ type: "text", text: "hello" })).toBe("hello");
  });

  it("returns text with URL for text node with link mark", () => {
    const node = {
      type: "text",
      text: "click here",
      marks: [{ type: "link", attrs: { href: "https://example.com" } }],
    };
    expect(adfToText(node)).toBe("click here (https://example.com)");
  });

  it("returns paragraph text with trailing newline", () => {
    const node = {
      type: "paragraph",
      content: [{ type: "text", text: "hello" }],
    };
    expect(adfToText(node)).toBe("hello\n");
  });

  it("returns heading with ## prefix and trailing newline for level 2", () => {
    const node = {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Section" }],
    };
    expect(adfToText(node)).toBe("## Section\n");
  });

  it("returns newline for hardBreak node", () => {
    expect(adfToText({ type: "hardBreak" })).toBe("\n");
  });

  it("returns bullet list items with - prefix", () => {
    const node = {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item1" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item2" }] }] },
      ],
    };
    const result = adfToText(node);
    expect(result).toContain("- item1");
    expect(result).toContain("- item2");
  });

  it("returns ordered list items with - prefix", () => {
    const node = {
      type: "orderedList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item1" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item2" }] }] },
      ],
    };
    const result = adfToText(node);
    expect(result).toContain("- item1");
    expect(result).toContain("- item2");
  });

  it("returns code block with fenced markdown", () => {
    const node = {
      type: "codeBlock",
      content: [{ type: "text", text: "const x = 1;" }],
    };
    expect(adfToText(node)).toBe("```\nconst x = 1;```\n");
  });

  it("returns displayName for mention node", () => {
    const node = {
      type: "mention",
      attrs: { text: "@alice", displayName: "Alice" },
    };
    expect(adfToText(node)).toBe("@alice");
  });

  it("returns emoji text for emoji node", () => {
    const node = {
      type: "emoji",
      attrs: { text: "😀" },
    };
    expect(adfToText(node)).toBe("😀");
  });

  it("recurses to children for unknown node types", () => {
    const node = {
      type: "unknownNode",
      content: [{ type: "text", text: "child text" }],
    };
    expect(adfToText(node)).toBe("child text");
  });

  it("handles doc node with nested paragraphs", () => {
    const node = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second" }] },
      ],
    };
    expect(adfToText(node)).toBe("First\nSecond\n");
  });
});

// ─── Part B: getJiraIssue tests ───────────────────────────────────────────────

describe("getJiraIssue", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      JIRA_HOST: "mycompany.atlassian.net",
      JIRA_EMAIL: "user@example.com",
      JIRA_API_TOKEN: "test-token",
    };
    mockFetch.mockReset();
    resetFieldCache();
    // Default: no sprint/epic fields detected
    mockFetch.mockResolvedValueOnce(makeResponse(200, []));
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("basic success: returns mapped issue with key, summary, type, status", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-123",
      fields: {
        summary: "Fix the bug",
        issuetype: { name: "Bug" },
        status: { name: "In Progress" },
        priority: { name: "High" },
        assignee: { displayName: "Alice" },
        reporter: { displayName: "Bob" },
        labels: ["backend"],
        components: [{ name: "API" }],
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue, images } = await getJiraIssue("PROJ-123");
    expect(issue.key).toBe("PROJ-123");
    expect(issue.summary).toBe("Fix the bug");
    expect(issue.issueType).toBe("Bug");
    expect(issue.status).toBe("In Progress");
    expect(issue.priority).toBe("High");
    expect(issue.assignee).toBe("Alice");
    expect(issue.labels).toEqual(["backend"]);
    expect(issue.components).toEqual(["API"]);
    expect(images).toEqual([]);
  });

  it("maps description from ADF format", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-1",
      fields: {
        summary: "Task",
        description: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
          ],
        },
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-1");
    expect(issue.description).toBe("Hello world");
  });

  it("maps comments correctly", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-2",
      fields: {
        summary: "Task",
        description: null,
        comment: {
          comments: [
            {
              author: { displayName: "Charlie" },
              created: "2024-03-01T10:00:00.000Z",
              body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A comment" }] }] },
            },
          ],
          total: 1,
          maxResults: 50,
        },
        attachment: [],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-2");
    expect(issue.comments).toHaveLength(1);
    expect(issue.comments[0].author).toBe("Charlie");
    expect(issue.comments[0].date).toBe("2024-03-01T10:00:00.000Z");
    expect(issue.comments[0].text).toBe("A comment");
  });

  it("returns empty subtasks when none", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-3",
      fields: {
        summary: "Task",
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
        subtasks: [],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-3");
    expect(issue.comments).toEqual([]);
  });

  it("throws on 404", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, {}));
    await expect(getJiraIssue("PROJ-999")).rejects.toThrow("issue no encontrado");
  });

  it("throws on 401", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(getJiraIssue("PROJ-1")).rejects.toThrow("revisar credenciales de Jira");
  });

  it("skips image downloads when includeImages=false", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-4",
      fields: {
        summary: "Task with image",
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [
          { id: "att1", filename: "screenshot.png", mimeType: "image/png", content: "https://jira.example.com/att1" },
        ],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { images } = await getJiraIssue("PROJ-4", false);
    expect(images).toEqual([]);
    // 2 calls: fields endpoint + issue endpoint (no image download)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws when credentials are missing", async () => {
    delete process.env.JIRA_HOST;
    await expect(getJiraIssue("PROJ-1")).rejects.toThrow("Missing Jira credentials");
  });

  it("maps subtasks from fields", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-10",
      fields: {
        summary: "Parent issue",
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
        subtasks: [
          { key: "PROJ-11", fields: { summary: "Sub task 1", status: { name: "Done" } } },
          { key: "PROJ-12", fields: { summary: "Sub task 2", status: { name: "To Do" } } },
        ],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-10", false);
    expect(issue.subtasks).toHaveLength(2);
    expect(issue.subtasks[0]).toEqual({ key: "PROJ-11", summary: "Sub task 1", status: "Done" });
    expect(issue.subtasks[1]).toEqual({ key: "PROJ-12", summary: "Sub task 2", status: "To Do" });
  });

  it("maps parent when present", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-11",
      fields: {
        summary: "Sub task 1",
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
        parent: { key: "PROJ-10", fields: { summary: "Parent issue" } },
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-11", false);
    expect(issue.parent).toEqual({ key: "PROJ-10", summary: "Parent issue" });
  });

  it("returns null parent when absent", async () => {
    const raw: MockJiraRaw = {
      key: "PROJ-20",
      fields: {
        summary: "Task",
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-20", false);
    expect(issue.parent).toBeNull();
  });

  it("maps sprint name when sprint field detected", async () => {
    // Override the fields mock set up in beforeEach — reset and re-mock
    mockFetch.mockReset();
    resetFieldCache();
    // Fields endpoint returns sprint field
    mockFetch.mockResolvedValueOnce(makeResponse(200, [
      { id: "customfield_10020", name: "Sprint" },
    ]));
    // Issue with sprint data
    mockFetch.mockResolvedValueOnce(makeResponse(200, {
      key: "PROJ-30",
      fields: {
        summary: "Sprinted issue",
        description: null,
        comment: { comments: [], total: 0, maxResults: 50 },
        attachment: [],
        customfield_10020: [{ id: 1, name: "Sprint 5", state: "active" }],
      },
    }));

    const { issue } = await getJiraIssue("PROJ-30", false);
    expect(issue.sprint).toBe("Sprint 5");
  });

  it("truncates comments to maxComments most recent", async () => {
    const comments = Array.from({ length: 5 }, (_, i) => ({
      author: { displayName: `User${i}` },
      created: `2024-01-0${i + 1}T00:00:00.000Z`,
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Comment ${i}` }] }] },
    }));
    const raw: MockJiraRaw = {
      key: "PROJ-40",
      fields: {
        summary: "Busy issue",
        description: null,
        comment: { comments, total: 5, maxResults: 50 },
        attachment: [],
      },
    };
    mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

    const { issue } = await getJiraIssue("PROJ-40", false, 2);
    expect(issue.comments).toHaveLength(2);
    // Most recent = last 2: Comment 3, Comment 4
    expect(issue.comments[0].text).toBe("Comment 3");
    expect(issue.comments[1].text).toBe("Comment 4");
  });
});

describe("searchJiraIssues", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      JIRA_HOST: "mycompany.atlassian.net",
      JIRA_EMAIL: "user@example.com",
      JIRA_API_TOKEN: "test-token",
    };
    mockFetch.mockReset();
    resetFieldCache();
    mockFetch.mockResolvedValueOnce(makeResponse(200, [])); // fields pre-warm (not called by search, but cache needs reset)
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns mapped issue list", async () => {
    mockFetch.mockReset(); // search doesn't call fields
    mockFetch.mockResolvedValueOnce(makeResponse(200, {
      total: 2,
      issues: [
        {
          key: "PROJ-1",
          fields: {
            summary: "Fix login bug",
            status: { name: "In Progress" },
            assignee: { displayName: "Alice" },
            priority: { name: "High" },
          },
        },
        {
          key: "PROJ-2",
          fields: {
            summary: "Add tests",
            status: { name: "To Do" },
            assignee: null,
            priority: null,
          },
        },
      ],
    }));

    const result = await searchJiraIssues("project = PROJ");
    expect(result.total).toBe(2);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toEqual({
      key: "PROJ-1",
      summary: "Fix login bug",
      status: "In Progress",
      assignee: "Alice",
      priority: "High",
    });
    expect(result.issues[1].assignee).toBeNull();
    expect(result.issues[1].priority).toBeNull();
  });

  it("passes maxResults to API", async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(makeResponse(200, { total: 0, issues: [] }));
    await searchJiraIssues("project = PROJ", 5);
    const url = (mockFetch.mock.calls[0][0] as string);
    expect(url).toContain("maxResults=5");
  });

  it("throws when credentials are missing", async () => {
    delete process.env.JIRA_HOST;
    await expect(searchJiraIssues("project = PROJ")).rejects.toThrow("Missing Jira credentials");
  });
});

describe("addJiraComment", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      JIRA_HOST: "mycompany.atlassian.net",
      JIRA_EMAIL: "user@example.com",
      JIRA_API_TOKEN: "test-token",
    };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("POSTs comment in ADF format and resolves", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(201, { id: "123" }));
    await expect(addJiraComment("PROJ-1", "Hello world")).resolves.toBeUndefined();

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/rest/api/3/issue/PROJ-1/comment");
    expect((options as RequestInit).method).toBe("POST");
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.body.type).toBe("doc");
    expect(body.body.content[0].content[0].text).toBe("Hello world");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(400, {}));
    await expect(addJiraComment("PROJ-1", "text")).rejects.toThrow("Jira comment failed: HTTP 400");
  });
});
