import { jest } from "@jest/globals";
import { featureAmbiguous } from "./__fixtures__/tickets.js";

const sampleIssue = {
  key: "PROJ-16",
  fields: {
    summary: "Agregar login con Google", issuetype: { name: "Story" },
    status: { name: "To Do" }, priority: { name: "High" }, assignee: { displayName: "Ana" },
    labels: ["auth"], components: [{ name: "web" }],
    description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Permitir login con Google (OAuth)." }] }] },
    comment: { comments: [], total: 0, maxResults: 0 }, attachment: [], subtasks: [], parent: null,
  },
};

describe("analyze_ticket handler", () => {
  beforeEach(() => {
    process.env.JIRA_HOST = "example.atlassian.net";
    process.env.JIRA_EMAIL = "e@example.com";
    process.env.JIRA_API_TOKEN = "tok";
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes("/rest/api/3/field")) return { ok: true, json: async () => [] } as Response;
      if (url.includes("/rest/api/3/issue/")) return { ok: true, json: async () => sampleIssue } as Response;
      return { ok: false, status: 404, statusText: "Not Found" } as Response;
    }) as unknown as typeof fetch;
  });

  test("auto-detects Jira and returns markdown + JSON block", async () => {
    const { handleAnalyzeTicket } = await import("./tool.js");
    const result = await handleAnalyzeTicket({ id: "PROJ-16" });
    const text = result.content.map((content) => content.text).join("\n");
    expect(text).toContain("# Análisis del ticket");
    expect(text).toContain("```json");
    const json = JSON.parse(text.split("```json")[1].split("```")[0]);
    expect(json.ticketType).toBeDefined();
  });

  test("analyzes a normalized ticket without fetching a provider", async () => {
    const { handleAnalyzeTicket } = await import("./tool.js");
    const result = await handleAnalyzeTicket({ ticket: featureAmbiguous, format: "json" });
    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text.startsWith("```json\n")).toBe(true);
    expect(JSON.parse(text.split("```json")[1].split("```")[0]).objective).toBe("Mejorar la búsqueda");
    expect(result).toHaveProperty("structuredContent");
    expect((result as { structuredContent?: { objective?: string } }).structuredContent?.objective).toBe("Mejorar la búsqueda");
  });

  test("keeps structured output available when text format is markdown", async () => {
    const { handleAnalyzeTicket } = await import("./tool.js");
    const result = await handleAnalyzeTicket({ ticket: featureAmbiguous, format: "markdown" });
    expect(result.content[0].text).toContain("# Análisis del ticket");
    expect(result.content[0].text).not.toContain("```json");
    expect(result.structuredContent).toMatchObject({ objective: "Mejorar la búsqueda" });
  });

  test("publishes the supported object output schema", async () => {
    const { ANALYZE_TICKET_OUTPUT_SCHEMA } = await import("./tool.js");
    expect(ANALYZE_TICKET_OUTPUT_SCHEMA.type).toBe("object");
    expect(ANALYZE_TICKET_OUTPUT_SCHEMA.required).toContain("executiveSummary");
    expect(ANALYZE_TICKET_OUTPUT_SCHEMA.properties.ticketType).toMatchObject({ type: "object" });
  });

  test("rejects a request without a provider id or normalized ticket", async () => {
    const { handleAnalyzeTicket } = await import("./tool.js");
    const result = await handleAnalyzeTicket({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("id o ticket");
  });
});
