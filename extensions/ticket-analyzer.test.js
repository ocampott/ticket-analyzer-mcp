import { jest } from "@jest/globals";
import path from "node:path";
import {
  confirmToolCall,
  getTicketEnvironment,
  getToolParameters,
  isReadOnlyTool,
  toPiToolResult,
} from "./ticket-analyzer.js";

describe("ticket-analyzer Pi extension helpers", () => {
  test("forwards the env-file binding and no provider credential", () => {
    const env = getTicketEnvironment({
      source: {
        TICKET_ANALYZER_ENV_FILE: "/workspace/project/.env",
        TRELLO_API_KEY: "trello-key",
        TRELLO_TOKEN: "trello-token",
        JIRA_API_TOKEN: "jira-token",
        AZURE_DEVOPS_PAT: "azure-pat",
        PATH: "/should/not/be-forwarded",
        SECRET: "should-not-be-forwarded",
      },
      cwd: "/workspace/project",
    });

    expect(env).toEqual({ TICKET_ANALYZER_ENV_FILE: "/workspace/project/.env" });
  });

  test("falls back to the absolute project .env only when Pi supplied no binding", () => {
    expect(getTicketEnvironment({ source: {}, cwd: "/workspace/project" }))
      .toEqual({ TICKET_ANALYZER_ENV_FILE: path.join("/workspace/project", ".env") });
    expect(getTicketEnvironment({ source: { TICKET_ANALYZER_ENV_FILE: "/elsewhere/team.env" }, cwd: "/workspace/project" }))
      .toEqual({ TICKET_ANALYZER_ENV_FILE: "/elsewhere/team.env" });
  });

  test("resolves a relative binding and a relative cwd against an absolute path", () => {
    const relative = getTicketEnvironment({ source: { TICKET_ANALYZER_ENV_FILE: "config/team.env" }, cwd: "/workspace/project" });
    expect(path.isAbsolute(relative.TICKET_ANALYZER_ENV_FILE)).toBe(true);
    expect(relative.TICKET_ANALYZER_ENV_FILE).toBe(path.join("/workspace/project", "config", "team.env"));
  });

  test("omits the binding when no working directory is known", () => {
    expect(getTicketEnvironment({ source: {}, cwd: undefined })).toEqual({});
  });

  test("keeps the discovered MCP JSON schema unchanged", () => {
    const schema = {
      type: "object",
      properties: { issue_key: { type: "string" } },
      required: ["issue_key"],
    };
    expect(getToolParameters({ inputSchema: schema })).toBe(schema);
    expect(getToolParameters({})).toEqual({ type: "object", properties: {} });
  });

  test("forwards text and image content and preserves MCP errors", () => {
    expect(
      toPiToolResult({
        content: [
          { type: "text", text: "card details" },
          { type: "image", data: "base64-data", mimeType: "image/png" },
        ],
        isError: true,
      }),
    ).toEqual({
      content: [
        { type: "text", text: "card details" },
        { type: "image", data: "base64-data", mimeType: "image/png" },
      ],
      details: {},
      isError: true,
    });
  });

  test("allows read-only tools without UI and confirms gated tools", async () => {
    expect(isReadOnlyTool("get_status")).toBe(true);
    expect(await confirmToolCall("get_status", { hasUI: false })).toBe(true);
    expect(await confirmToolCall("add_trello_comment", { hasUI: false })).toBe(false);

    const confirm = jest.fn().mockResolvedValue(true);
    expect(await confirmToolCall("add_trello_comment", { hasUI: true, ui: { confirm } })).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});
