# Text Attachment Parsing (Trello + Jira) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `get_trello_card` and `get_jira_issue` to download and embed the text content of `.html`, `.sql`, `.txt`, `.json`, and other text-type attachments in the tool result when `include_text_attachments: true` is set.

**Architecture:** Add a detection helper (`isTextAttachment`) and download function (`downloadTextAttachment` / `downloadJiraText`) in each module. Extend `TrelloCardData` and `JiraIssueData` with a `textAttachments: TextAttachment[]` field. Add `include_text_attachments: boolean` (default `false`) to both MCP tools. Update the markdown formatters in `index.ts` to render a `## Contenido de adjuntos` fenced-code section. Update the CLAUDE.md analysis workflow to ask users about text attachments alongside images.

**Tech Stack:** TypeScript, Node.js, Trello REST API, Jira REST API v3, Jest + ts-jest

## Global Constraints

- Max text size: 50 000 characters per file; truncate with `\n[truncado: archivo excede 50 000 caracteres]` if exceeded
- `include_text_attachments` defaults to `false` (opt-in)
- Text detection: mimeType `text/*`, `application/json`, `application/sql`, `application/xml`, OR extension `.html .htm .sql .txt .md .json .csv .xml .yaml .yml`
- `card.attachments` / `issue.attachments` always list all non-image attachments (including text ones) — `textAttachments` is additive content
- Run tests with: `npm test`; all existing tests must keep passing

---

### Task 1: Text detection + download for Trello

**Files:**
- Modify: `src/trello.ts`
- Modify: `src/trello.test.ts`

**Interfaces produced:**
- `export interface TextAttachment { name: string; mimeType: string; content: string; truncated: boolean; }`
- `export function isTextAttachment(name: string, mimeType: string): boolean`
- `export async function downloadTextAttachment(url: string): Promise<{ content: string; truncated: boolean } | null>`

- [ ] **Step 1: Add `makeTextResponse` helper to `trello.test.ts` and write failing tests**

Add this function after the existing `makeResponse` function (after line 24):

```ts
function makeTextResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}
```

Update the import at the top of `trello.test.ts` to include the new exports:

```ts
import {
  getTrelloCard,
  TrelloCard,
  TrelloComment,
  listTrelloCards,
  addTrelloComment,
  isTextAttachment,
  downloadTextAttachment,
} from "./trello.js";
```

Add these two new `describe` blocks at the end of `trello.test.ts`:

```ts
describe("isTextAttachment", () => {
  it("detects text/html mimeType", () => {
    expect(isTextAttachment("file.html", "text/html")).toBe(true);
  });
  it("detects text/* prefix", () => {
    expect(isTextAttachment("file.txt", "text/plain")).toBe(true);
  });
  it("detects application/json", () => {
    expect(isTextAttachment("data.json", "application/json")).toBe(true);
  });
  it("detects application/sql", () => {
    expect(isTextAttachment("schema.sql", "application/sql")).toBe(true);
  });
  it("detects application/xml", () => {
    expect(isTextAttachment("data.xml", "application/xml")).toBe(true);
  });
  it("falls back to .sql extension when mimeType is generic", () => {
    expect(isTextAttachment("schema.sql", "application/octet-stream")).toBe(true);
  });
  it("falls back to .html extension when mimeType is empty", () => {
    expect(isTextAttachment("page.html", "")).toBe(true);
  });
  it("detects .yml extension", () => {
    expect(isTextAttachment("config.yml", "application/octet-stream")).toBe(true);
  });
  it("returns false for .pdf", () => {
    expect(isTextAttachment("doc.pdf", "application/pdf")).toBe(false);
  });
  it("returns false for image/png", () => {
    expect(isTextAttachment("photo.png", "image/png")).toBe(false);
  });
});

describe("downloadTextAttachment", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TRELLO_API_KEY: "test-key", TRELLO_TOKEN: "test-token" };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns text content when download succeeds", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse(200, "SELECT * FROM users;"));
    const result = await downloadTextAttachment("https://trello.com/att1");
    expect(result).not.toBeNull();
    expect(result!.content).toBe("SELECT * FROM users;");
    expect(result!.truncated).toBe(false);
  });

  it("truncates content exceeding 50 000 characters", async () => {
    const longText = "a".repeat(60_000);
    mockFetch.mockResolvedValueOnce(makeTextResponse(200, longText));
    const result = await downloadTextAttachment("https://trello.com/att1");
    expect(result).not.toBeNull();
    expect(result!.truncated).toBe(true);
    expect(result!.content).toContain("[truncado: archivo excede 50 000 caracteres]");
    expect(result!.content.startsWith("a".repeat(50_000))).toBe(true);
  });

  it("returns null on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse(403, "Forbidden"));
    const result = await downloadTextAttachment("https://trello.com/att1");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await downloadTextAttachment("https://trello.com/att1");
    expect(result).toBeNull();
  });

  it("uses OAuth Authorization header", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse(200, "content"));
    await downloadTextAttachment("https://trello.com/att1");
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toContain("OAuth");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=trello
```

Expected: FAIL — `isTextAttachment is not a function` and `downloadTextAttachment is not a function`

- [ ] **Step 3: Implement the new exports in `src/trello.ts`**

Add the following block after the `TrelloCardData` interface (after line 69 in trello.ts, before `function getCredentials`):

```ts
const TEXT_MIME_EXACT = new Set(["application/json", "application/sql", "application/xml"]);
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".sql", ".txt", ".md", ".json", ".csv", ".xml", ".yaml", ".yml"]);
const MAX_TEXT_BYTES = 50_000;

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

export async function downloadTextAttachment(
  url: string
): Promise<{ content: string; truncated: boolean } | null> {
  const { apiKey, token } = getCredentials();
  console.error(`[trello] Downloading text attachment: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`,
      },
    });
    if (!response.ok) {
      console.error(`[trello] Text download failed: HTTP ${response.status} for ${url}`);
      return null;
    }
    const text = await response.text();
    if (text.length > MAX_TEXT_BYTES) {
      return {
        content: text.slice(0, MAX_TEXT_BYTES) + "\n[truncado: archivo excede 50 000 caracteres]",
        truncated: true,
      };
    }
    return { content: text, truncated: false };
  } catch (err) {
    console.error(`[trello] Text download error for ${url}:`, err);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=trello
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/trello.ts src/trello.test.ts
git commit -m "feat(trello): add isTextAttachment helper and downloadTextAttachment"
```

---

### Task 2: `getTrelloCard` text attachment integration

**Files:**
- Modify: `src/trello.ts`
- Modify: `src/trello.test.ts`

**Interfaces:**
- Consumes: `TextAttachment`, `isTextAttachment`, `downloadTextAttachment` from Task 1
- Modifies: `TrelloCardData` — adds `textAttachments: TextAttachment[]`
- Modifies: `getTrelloCard(cardId, includeImages?, maxComments?, includeTextAttachments?)` — new 4th param (default `false`)

- [ ] **Step 1: Write failing tests inside the existing `describe("getTrelloCard", ...)` block**

Add these three `it` blocks at the end of `describe("getTrelloCard", ...)` (before its closing `}`):

```ts
it("returns empty textAttachments when includeTextAttachments is false (default)", async () => {
  const card: TrelloCard = {
    name: "Card",
    desc: "",
    actions: [],
    attachments: [
      { id: "att1", name: "schema.sql", url: "https://trello.com/att1", mimeType: "application/sql", isUpload: true, bytes: 100 },
    ],
  };
  mockFetch.mockResolvedValueOnce(makeResponse(200, card));

  const { textAttachments } = await getTrelloCard("abc123", false);
  expect(textAttachments).toEqual([]);
  expect(mockFetch).toHaveBeenCalledTimes(1); // no download
});

it("downloads and returns text attachments when includeTextAttachments is true", async () => {
  const card: TrelloCard = {
    name: "Card",
    desc: "",
    actions: [],
    attachments: [
      { id: "att1", name: "schema.sql", url: "https://trello.com/att1", mimeType: "application/sql", isUpload: true, bytes: 100 },
    ],
  };
  mockFetch
    .mockResolvedValueOnce(makeResponse(200, card))
    .mockResolvedValueOnce(makeTextResponse(200, "CREATE TABLE foo (id INT);"));

  const { textAttachments } = await getTrelloCard("abc123", false, undefined, true);
  expect(textAttachments).toHaveLength(1);
  expect(textAttachments[0].name).toBe("schema.sql");
  expect(textAttachments[0].mimeType).toBe("application/sql");
  expect(textAttachments[0].content).toBe("CREATE TABLE foo (id INT);");
  expect(textAttachments[0].truncated).toBe(false);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it("text attachments still appear in card.attachments regardless of includeTextAttachments", async () => {
  const card: TrelloCard = {
    name: "Card",
    desc: "",
    actions: [],
    attachments: [
      { id: "att1", name: "schema.sql", url: "https://trello.com/att1", mimeType: "application/sql", isUpload: true, bytes: 100 },
    ],
  };
  mockFetch.mockResolvedValueOnce(makeResponse(200, card));

  const { card: result } = await getTrelloCard("abc123", false);
  expect(result.attachments).toHaveLength(1);
  expect(result.attachments[0].name).toBe("schema.sql");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=trello
```

Expected: FAIL — `textAttachments` is undefined on destructured `TrelloCardData`

- [ ] **Step 3: Update `TrelloCardData` in `src/trello.ts`**

Replace:
```ts
export interface TrelloCardData {
  card: TrelloCardResult;
  images: TrelloImage[];
}
```

With:
```ts
export interface TrelloCardData {
  card: TrelloCardResult;
  images: TrelloImage[];
  textAttachments: TextAttachment[];
}
```

- [ ] **Step 4: Update `getTrelloCard` signature in `src/trello.ts`**

Replace:
```ts
export async function getTrelloCard(
  cardId: string,
  includeImages = true,
  maxComments?: number
): Promise<TrelloCardData> {
```

With:
```ts
export async function getTrelloCard(
  cardId: string,
  includeImages = true,
  maxComments?: number,
  includeTextAttachments = false
): Promise<TrelloCardData> {
```

- [ ] **Step 5: Add text attachment download logic and update the return in `src/trello.ts`**

After the closing `}` of the `if (includeImages)` block (around line 179), add:

```ts
  let textAttachments: TextAttachment[] = [];
  if (includeTextAttachments) {
    const textCandidates = nonImageAttachments.filter((a) =>
      isTextAttachment(a.name, a.mimeType ?? "")
    );
    const downloaded = await Promise.all(
      textCandidates.map(async (a): Promise<TextAttachment | null> => {
        const result = await downloadTextAttachment(a.url);
        if (!result) return null;
        return { name: a.name, mimeType: a.mimeType, content: result.content, truncated: result.truncated };
      })
    );
    textAttachments = downloaded.filter((t): t is TextAttachment => t !== null);
  }
```

Update the `return` statement to include `textAttachments`:

```ts
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
    textAttachments,
  };
```

- [ ] **Step 6: Run all tests**

```bash
npm test -- --testPathPattern=trello
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/trello.ts src/trello.test.ts
git commit -m "feat(trello): extend getTrelloCard with include_text_attachments param"
```

---

### Task 3: Trello formatter + `index.ts` tool schema and handler

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `TextAttachment` from `./trello.js`; `TrelloCardData.textAttachments` from Task 2

- [ ] **Step 1: Add `TextAttachment` to the trello import and add `langHintFromName` helper**

Update the trello import at the top of `src/index.ts`:

```ts
import { getTrelloCard, TrelloCardResult, listTrelloCards, addTrelloComment, TextAttachment } from "./trello.js";
```

Add `langHintFromName` before `formatCardAsMarkdown` (around line 13):

```ts
function langHintFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  const ext = name.slice(dot).toLowerCase();
  const map: Record<string, string> = {
    ".sql": "sql", ".html": "html", ".htm": "html",
    ".json": "json", ".xml": "xml", ".csv": "csv",
    ".md": "markdown", ".yaml": "yaml", ".yml": "yaml",
  };
  return map[ext] ?? "";
}
```

- [ ] **Step 2: Update `formatCardAsMarkdown` signature and add the `## Contenido de adjuntos` section**

Replace:
```ts
function formatCardAsMarkdown(card: TrelloCardResult, imageNames: string[]): string {
```

With:
```ts
function formatCardAsMarkdown(card: TrelloCardResult, imageNames: string[], textAttachments: TextAttachment[]): string {
```

Add the following block inside `formatCardAsMarkdown`, after the `## Adjuntos` section and before the `imageNames` section:

```ts
  if (textAttachments.length > 0) {
    lines.push("");
    lines.push(`## Contenido de adjuntos (${textAttachments.length})`);
    for (const att of textAttachments) {
      lines.push("");
      lines.push(`### ${att.name}`);
      const lang = langHintFromName(att.name);
      lines.push(`\`\`\`${lang}`);
      lines.push(att.content);
      lines.push("```");
    }
  }
```

- [ ] **Step 3: Add `include_text_attachments` to the `get_trello_card` tool schema**

In the `get_trello_card` tool definition inside `ListToolsRequestSchema` handler, add after the `max_comments` property:

```ts
include_text_attachments: {
  type: "boolean",
  description: "Download and include the content of text attachments (.html, .sql, .txt, .json, etc.) inline in the response. Default: false.",
},
```

- [ ] **Step 4: Update the `get_trello_card` request handler**

Replace:
```ts
    const typedArgs = args as { card_id?: string; include_images?: boolean; max_comments?: number } | undefined;
    const cardId = typedArgs?.card_id;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
```

With:
```ts
    const typedArgs = args as { card_id?: string; include_images?: boolean; max_comments?: number; include_text_attachments?: boolean } | undefined;
    const cardId = typedArgs?.card_id;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
    const includeTextAttachments = typedArgs?.include_text_attachments ?? false;
```

Replace:
```ts
      const { card, images } = await getTrelloCard(cardId, includeImages, maxComments);
```

With:
```ts
      const { card, images, textAttachments } = await getTrelloCard(cardId, includeImages, maxComments, includeTextAttachments);
```

Replace:
```ts
      console.error(
        `[pm-mcp] Success: card "${card.name}", ${card.comments.length} comment(s), ${images.length} image(s)`
      );
```

With:
```ts
      console.error(
        `[pm-mcp] Success: card "${card.name}", ${card.comments.length} comment(s), ${images.length} image(s), ${textAttachments.length} text attachment(s)`
      );
```

Replace:
```ts
      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatCardAsMarkdown(card, imageNames) }];
```

With:
```ts
      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatCardAsMarkdown(card, imageNames, textAttachments) }];
```

- [ ] **Step 5: Build to verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0 with no errors

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(index): add text attachment rendering for Trello cards"
```

---

### Task 4: Text detection + download for Jira

**Files:**
- Modify: `src/jira.ts`
- Modify: `src/jira.test.ts`

**Interfaces produced:**
- `export interface TextAttachment { name: string; mimeType: string; content: string; truncated: boolean; }` (structurally identical to trello.ts — kept separate for module independence)
- `export function isTextAttachment(name: string, mimeType: string): boolean`
- `export async function downloadJiraText(url: string, authHeader: string): Promise<{ content: string; truncated: boolean } | null>`

- [ ] **Step 1: Add `makeTextResponse` helper to `jira.test.ts` and write failing tests**

Add after the existing `makeResponse` function in `jira.test.ts`:

```ts
function makeTextResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}
```

Update the import at the top of `jira.test.ts`:

```ts
import { adfToText, getJiraIssue, searchJiraIssues, addJiraComment, isTextAttachment, downloadJiraText } from "./jira.js";
```

Add these two new `describe` blocks at the end of `jira.test.ts`:

```ts
describe("isTextAttachment (jira)", () => {
  it("detects text/html mimeType", () => {
    expect(isTextAttachment("page.html", "text/html")).toBe(true);
  });
  it("detects application/sql mimeType", () => {
    expect(isTextAttachment("schema.sql", "application/sql")).toBe(true);
  });
  it("falls back to .sql extension", () => {
    expect(isTextAttachment("schema.sql", "application/octet-stream")).toBe(true);
  });
  it("returns false for .pdf", () => {
    expect(isTextAttachment("doc.pdf", "application/pdf")).toBe(false);
  });
  it("returns false for image/png", () => {
    expect(isTextAttachment("photo.png", "image/png")).toBe(false);
  });
});

describe("downloadJiraText", () => {
  const OLD_ENV = process.env;
  const authHeader = `Basic ${Buffer.from("user@example.com:test-token").toString("base64")}`;

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

  it("returns text content when download succeeds (direct, no redirect)", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse(200, "SELECT * FROM orders;"));
    const result = await downloadJiraText("https://jira.example.com/att1", authHeader);
    expect(result).not.toBeNull();
    expect(result!.content).toBe("SELECT * FROM orders;");
    expect(result!.truncated).toBe(false);
  });

  it("follows 302 redirect and downloads text (no auth forwarded to S3)", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ location: "https://s3.example.com/file.sql" }),
        text: async () => "",
      } as unknown as Response)
      .mockResolvedValueOnce(makeTextResponse(200, "SELECT 1;"));

    const result = await downloadJiraText("https://jira.example.com/att1", authHeader);
    expect(result).not.toBeNull();
    expect(result!.content).toBe("SELECT 1;");
    // second fetch must NOT include Authorization header (plain S3 URL)
    const [s3Url, s3Options] = mockFetch.mock.calls[1] as [string, RequestInit | undefined];
    expect(s3Url).toBe("https://s3.example.com/file.sql");
    expect(s3Options).toBeUndefined();
  });

  it("truncates content exceeding 50 000 characters", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse(200, "c".repeat(60_000)));
    const result = await downloadJiraText("https://jira.example.com/att1", authHeader);
    expect(result!.truncated).toBe(true);
    expect(result!.content).toContain("[truncado: archivo excede 50 000 caracteres]");
    expect(result!.content.startsWith("c".repeat(50_000))).toBe(true);
  });

  it("returns null on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse(403, "Forbidden"));
    const result = await downloadJiraText("https://jira.example.com/att1", authHeader);
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await downloadJiraText("https://jira.example.com/att1", authHeader);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=jira
```

Expected: FAIL — `isTextAttachment is not a function` and `downloadJiraText is not a function`

- [ ] **Step 3: Add the new types and functions to `src/jira.ts`**

Add the following block after the `JiraIssueData` interface (after line 37, before `function getCredentials`):

```ts
const TEXT_MIME_EXACT = new Set(["application/json", "application/sql", "application/xml"]);
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".sql", ".txt", ".md", ".json", ".csv", ".xml", ".yaml", ".yml"]);
const MAX_TEXT_BYTES = 50_000;

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

export async function downloadJiraText(
  url: string,
  authHeader: string
): Promise<{ content: string; truncated: boolean } | null> {
  console.error(`[jira] Downloading text attachment: ${url}`);
  try {
    const initialResponse = await fetch(url, {
      headers: { Authorization: authHeader },
      redirect: "manual",
    });

    let finalResponse: Response;
    const status = initialResponse.status;
    if (status === 301 || status === 302 || status === 307 || status === 308) {
      const location = initialResponse.headers.get("location");
      if (!location) {
        console.error(`[jira] Text redirect without Location header: ${url}`);
        return null;
      }
      finalResponse = await fetch(location);
    } else if (initialResponse.ok) {
      finalResponse = initialResponse;
    } else {
      console.error(`[jira] Text download failed: HTTP ${status}`);
      return null;
    }

    if (!finalResponse.ok) {
      console.error(`[jira] Text download failed: HTTP ${finalResponse.status}`);
      return null;
    }

    const text = await finalResponse.text();
    if (text.length > MAX_TEXT_BYTES) {
      return {
        content: text.slice(0, MAX_TEXT_BYTES) + "\n[truncado: archivo excede 50 000 caracteres]",
        truncated: true,
      };
    }
    return { content: text, truncated: false };
  } catch (err) {
    console.error(`[jira] Text download error for ${url}:`, err);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=jira
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/jira.ts src/jira.test.ts
git commit -m "feat(jira): add isTextAttachment helper and downloadJiraText"
```

---

### Task 5: `getJiraIssue` text attachment integration

**Files:**
- Modify: `src/jira.ts`
- Modify: `src/jira.test.ts`

**Interfaces:**
- Consumes: `TextAttachment`, `isTextAttachment`, `downloadJiraText` from Task 4
- Modifies: `JiraIssueData` — adds `textAttachments: TextAttachment[]`
- Modifies: `getJiraIssue(issueKey, includeImages?, maxComments?, includeTextAttachments?)` — new 4th param (default `false`)

- [ ] **Step 1: Write failing tests inside the existing `describe("getJiraIssue", ...)` block**

Add these three `it` blocks at the end of `describe("getJiraIssue", ...)` (before its closing `}`).

Note: the `describe("getJiraIssue")` `beforeEach` already calls `mockFetch.mockResolvedValueOnce(makeResponse(200, []))` for the fields endpoint — that is mock call #1. Your test body provides mock call #2 (the issue).

```ts
it("returns empty textAttachments when includeTextAttachments is false (default)", async () => {
  const raw: MockJiraRaw = {
    key: "PROJ-50",
    fields: {
      summary: "Task",
      description: null,
      comment: { comments: [], total: 0, maxResults: 50 },
      attachment: [
        { id: "att1", filename: "schema.sql", mimeType: "application/sql", content: "https://jira.example.com/att1" },
      ],
    },
  };
  mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

  const { textAttachments } = await getJiraIssue("PROJ-50", false);
  expect(textAttachments).toEqual([]);
  expect(mockFetch).toHaveBeenCalledTimes(2); // fields + issue, no text download
});

it("downloads and returns text attachments when includeTextAttachments is true", async () => {
  const raw: MockJiraRaw = {
    key: "PROJ-51",
    fields: {
      summary: "Task",
      description: null,
      comment: { comments: [], total: 0, maxResults: 50 },
      attachment: [
        { id: "att1", filename: "schema.sql", mimeType: "application/sql", content: "https://jira.example.com/att1" },
      ],
    },
  };
  mockFetch
    .mockResolvedValueOnce(makeResponse(200, raw))
    .mockResolvedValueOnce(makeTextResponse(200, "CREATE TABLE x (id INT);"));

  const { textAttachments } = await getJiraIssue("PROJ-51", false, undefined, true);
  expect(textAttachments).toHaveLength(1);
  expect(textAttachments[0].name).toBe("schema.sql");
  expect(textAttachments[0].mimeType).toBe("application/sql");
  expect(textAttachments[0].content).toBe("CREATE TABLE x (id INT);");
  expect(textAttachments[0].truncated).toBe(false);
  expect(mockFetch).toHaveBeenCalledTimes(3); // fields + issue + text download
});

it("text attachments still appear in issue.attachments regardless of includeTextAttachments", async () => {
  const raw: MockJiraRaw = {
    key: "PROJ-52",
    fields: {
      summary: "Task",
      description: null,
      comment: { comments: [], total: 0, maxResults: 50 },
      attachment: [
        { id: "att1", filename: "schema.sql", mimeType: "application/sql", content: "https://jira.example.com/att1" },
      ],
    },
  };
  mockFetch.mockResolvedValueOnce(makeResponse(200, raw));

  const { issue } = await getJiraIssue("PROJ-52", false);
  expect(issue.attachments).toHaveLength(1);
  expect(issue.attachments[0].name).toBe("schema.sql");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=jira
```

Expected: FAIL — `textAttachments` is undefined on destructured `JiraIssueData`

- [ ] **Step 3: Update `JiraIssueData` in `src/jira.ts`**

Replace:
```ts
export interface JiraIssueData {
  issue: JiraIssueResult;
  images: JiraImage[];
}
```

With:
```ts
export interface JiraIssueData {
  issue: JiraIssueResult;
  images: JiraImage[];
  textAttachments: TextAttachment[];
}
```

- [ ] **Step 4: Update `getJiraIssue` signature in `src/jira.ts`**

Replace:
```ts
export async function getJiraIssue(
  issueKey: string,
  includeImages = true,
  maxComments?: number
): Promise<JiraIssueData> {
```

With:
```ts
export async function getJiraIssue(
  issueKey: string,
  includeImages = true,
  maxComments?: number,
  includeTextAttachments = false
): Promise<JiraIssueData> {
```

- [ ] **Step 5: Add text attachment download logic before the `issue` build in `src/jira.ts`**

After the closing `}` of the `if (includeImages)` block (around line 325), add:

```ts
  let textAttachments: TextAttachment[] = [];
  if (includeTextAttachments) {
    const textCandidates = nonImageAttachments.filter((a) =>
      isTextAttachment(a.filename, a.mimeType ?? "")
    );
    const downloaded = await Promise.all(
      textCandidates.map(async (a): Promise<TextAttachment | null> => {
        const result = await downloadJiraText(a.content, authHeader);
        if (!result) return null;
        return { name: a.filename, mimeType: a.mimeType, content: result.content, truncated: result.truncated };
      })
    );
    textAttachments = downloaded.filter((t): t is TextAttachment => t !== null);
  }
```

- [ ] **Step 6: Update the `return` at the end of `getJiraIssue`**

Replace:
```ts
  return { issue, images };
```

With:
```ts
  return { issue, images, textAttachments };
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/jira.ts src/jira.test.ts
git commit -m "feat(jira): extend getJiraIssue with include_text_attachments param"
```

---

### Task 6: Jira formatter + `index.ts` tool schema and handler

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `TextAttachment` (already imported from `./trello.js` in Task 3 — structurally identical to jira's `TextAttachment`); `JiraIssueData.textAttachments` from Task 5

- [ ] **Step 1: Update `formatIssueAsMarkdown` signature and add the `## Contenido de adjuntos` section**

Replace:
```ts
function formatIssueAsMarkdown(issue: JiraIssueResult, imageNames: string[]): string {
```

With:
```ts
function formatIssueAsMarkdown(issue: JiraIssueResult, imageNames: string[], textAttachments: TextAttachment[]): string {
```

Add this block inside `formatIssueAsMarkdown`, after the `## Adjuntos` section and before the `imageNames` section:

```ts
  if (textAttachments.length > 0) {
    lines.push("");
    lines.push(`## Contenido de adjuntos (${textAttachments.length})`);
    for (const att of textAttachments) {
      lines.push("");
      lines.push(`### ${att.name}`);
      const lang = langHintFromName(att.name);
      lines.push(`\`\`\`${lang}`);
      lines.push(att.content);
      lines.push("```");
    }
  }
```

- [ ] **Step 2: Add `include_text_attachments` to the `get_jira_issue` tool schema**

In the `get_jira_issue` tool definition, add after the `max_comments` property:

```ts
include_text_attachments: {
  type: "boolean",
  description: "Download and include the content of text attachments (.html, .sql, .txt, .json, etc.) inline in the response. Default: false.",
},
```

- [ ] **Step 3: Update the `get_jira_issue` request handler**

Replace:
```ts
    const typedArgs = args as { issue_key?: string; include_images?: boolean; max_comments?: number } | undefined;
    const issueKey = typedArgs?.issue_key;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
```

With:
```ts
    const typedArgs = args as { issue_key?: string; include_images?: boolean; max_comments?: number; include_text_attachments?: boolean } | undefined;
    const issueKey = typedArgs?.issue_key;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
    const includeTextAttachments = typedArgs?.include_text_attachments ?? false;
```

Replace:
```ts
      const { issue, images } = await getJiraIssue(issueKey, includeImages, maxComments);
```

With:
```ts
      const { issue, images, textAttachments } = await getJiraIssue(issueKey, includeImages, maxComments, includeTextAttachments);
```

Replace:
```ts
      console.error(
        `[pm-mcp] Success: issue "${issue.key}", ${issue.comments.length} comment(s), ${images.length} image(s)`
      );
```

With:
```ts
      console.error(
        `[pm-mcp] Success: issue "${issue.key}", ${issue.comments.length} comment(s), ${images.length} image(s), ${textAttachments.length} text attachment(s)`
      );
```

Replace:
```ts
      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatIssueAsMarkdown(issue, imageNames) }];
```

With:
```ts
      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatIssueAsMarkdown(issue, imageNames, textAttachments) }];
```

- [ ] **Step 4: Build and run all tests**

```bash
npm run build && npm test
```

Expected: build exits 0, all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(index): add text attachment rendering for Jira issues"
```

---

### Task 7: CLAUDE.md workflow update

**Files:**
- Modify: `~/.claude/CLAUDE.md` (global user config — not inside the pm-mcp git repo, no commit needed)

- [ ] **Step 1: Update `Paso 1` in the `## Análisis de tarjetas y issues` section of `~/.claude/CLAUDE.md`**

Find:
```markdown
### Paso 1 — Imágenes
Preguntale al usuario: "¿Querés que analice las imágenes adjuntas? Omitirlas ahorra tokens si no son necesarias."
Usá `include_images: true/false` según la respuesta.
```

Replace with:
```markdown
### Paso 1 — Imágenes y adjuntos de texto
Preguntale al usuario con una sola llamada a `AskUserQuestion` (dos preguntas):
1. "¿Querés que analice las imágenes adjuntas? Omitirlas ahorra tokens si no son necesarias."
2. "¿Querés que lea el contenido de archivos de texto adjuntos (.html, .sql, .txt, .json, etc.)? Puede agregar bastantes tokens según el tamaño de los archivos."

Usá `include_images: true/false` e `include_text_attachments: true/false` según las respuestas.
```

- [ ] **Step 2: Verify the update**

```bash
grep -A 8 "Paso 1" ~/.claude/CLAUDE.md | head -12
```

Expected output:
```
### Paso 1 — Imágenes y adjuntos de texto
Preguntale al usuario con una sola llamada a `AskUserQuestion` (dos preguntas):
1. "¿Querés que analice las imágenes adjuntas? Omitirlas ahorra tokens si no son necesarias."
2. "¿Querés que lea el contenido de archivos de texto adjuntos (.html, .sql, .txt, .json, etc.)? Puede agregar bastantes tokens según el tamaño de los archivos."
```

- [ ] **Step 3: Run final full test suite**

```bash
npm test
```

Expected: all tests PASS — no regressions

- [ ] **Step 4: Commit the pm-mcp plan file**

```bash
git add docs/superpowers/plans/2026-06-25-text-attachments.md
git commit -m "docs: add implementation plan for text attachment parsing"
```
