import { jest } from "@jest/globals";
import {
  confirmToolCall,
  getTicketEnvironment,
  getToolParameters,
  isReadOnlyTool,
  toPiToolResult,
} from "./ticket-analyzer.js";

describe("ticket-analyzer Pi extension helpers", () => {
  test("forwards only ticket credentials to the child environment", () => {
    const env = getTicketEnvironment({
      TRELLO_API_KEY: "trello-key",
      JIRA_API_TOKEN: "jira-token",
      PATH: "/should/not/be-forwarded",
      SECRET: "should-not-be-forwarded",
    });

    expect(env).toEqual({
      TRELLO_API_KEY: "trello-key",
      JIRA_API_TOKEN: "jira-token",
    });
    expect(env.PATH).toBeUndefined();
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
