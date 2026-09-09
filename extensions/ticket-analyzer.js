import { fileURLToPath } from "node:url";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const TICKET_ENV_VARS = Object.freeze([
  "TICKET_ANALYZER_ENV_FILE",
  "TRELLO_API_KEY",
  "TRELLO_TOKEN",
  "TRELLO_DEFAULT_BOARD_ID",
  "JIRA_HOST",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "AZURE_DEVOPS_ORG",
  "AZURE_DEVOPS_PROJECT",
  "AZURE_DEVOPS_PAT",
]);

export const READ_ONLY_TOOLS = new Set([
  "get_trello_card",
  "list_trello_cards",
  "get_jira_issue",
  "search_jira_issues",
  "get_azure_work_item",
  "search_azure_work_items",
  "get_status",
  "analyze_ticket",
]);

const SERVER_PATH = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const EMPTY_PARAMETERS = { type: "object", properties: {} };

export function getTicketEnvironment(source = process.env) {
  const env = {};
  for (const name of TICKET_ENV_VARS) {
    if (typeof source[name] === "string") env[name] = source[name];
  }
  return env;
}

export function isReadOnlyTool(name) {
  return READ_ONLY_TOOLS.has(name);
}

export function getToolParameters(tool) {
  return tool.inputSchema ?? EMPTY_PARAMETERS;
}

export function toPiToolResult(result) {
  const content = (result?.content ?? []).flatMap((block) => {
    if (block?.type === "text" && typeof block.text === "string") {
      return [{ type: "text", text: block.text }];
    }
    if (
      block?.type === "image" &&
      typeof block.data === "string" &&
      typeof block.mimeType === "string"
    ) {
      return [{ type: "image", data: block.data, mimeType: block.mimeType }];
    }
    return [];
  });

  if (content.length === 0) {
    content.push({
      type: "text",
      text: result?.structuredContent
        ? JSON.stringify(result.structuredContent)
        : result?.isError
          ? "MCP tool returned an error without details."
          : "MCP tool returned no text or image content.",
    });
  }

  return {
    content,
    details: result?.structuredContent ?? {},
    ...(result?.isError ? { isError: true } : {}),
  };
}

export async function confirmToolCall(name, ctx) {
  if (isReadOnlyTool(name)) return true;
  if (!ctx.hasUI) return false;
  return ctx.ui.confirm(
    `Allow MCP tool: ${name}?`,
    "This tool is not on the read-only allowlist and may modify remote ticket data. The approval applies only to this call.",
  );
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: message }],
    details: {},
    isError: true,
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export default function ticketAnalyzerExtension(pi) {
  let client;
  let transport;
  let connecting;
  const registeredToolNames = new Set();

  const callTool = async (name, params, signal) => {
    try {
      const result = await client.callTool(
        { name, arguments: params ?? {} },
        undefined,
        signal ? { signal } : undefined,
      );
      return toPiToolResult(result);
    } catch (error) {
      return errorResult(`MCP error from ${name}: ${errorMessage(error)}`);
    }
  };

  const registerDiscoveredTools = (tools) => {
    for (const tool of tools) {
      if (!tool?.name || registeredToolNames.has(tool.name)) continue;
      registeredToolNames.add(tool.name);
      const gated = !isReadOnlyTool(tool.name);

      pi.registerTool({
        // Keep the MCP name unchanged: skills and prompts refer to these names.
        name: tool.name,
        label: tool.name,
        description: tool.description ?? `Call the MCP tool ${tool.name}.`,
        parameters: getToolParameters(tool),
        ...(gated ? { executionMode: "sequential" } : {}),
        async execute(_toolCallId, params, signal, _onUpdate, ctx) {
          await ensureClient(ctx);
          if (!(await confirmToolCall(tool.name, ctx))) {
            return errorResult(
              ctx.hasUI
                ? `MCP tool call denied by user: ${tool.name}`
                : `MCP tool call denied: ${tool.name} requires interactive confirmation`,
            );
          }
          // Keep confirmation immediately before the MCP call for gated tools.
          return callTool(tool.name, params, signal);
        },
      });
    }
  };

  const ensureClient = async (ctx) => {
    if (client) return client;
    if (connecting) return connecting;

    connecting = (async () => {
      const nextTransport = new StdioClientTransport({
        command: process.execPath,
        args: [SERVER_PATH],
        env: getTicketEnvironment(),
        cwd: ctx.cwd,
        stderr: "inherit",
      });
      const nextClient = new Client(
        { name: "ticket-analyzer-pi", version: "2.2.1" },
        { capabilities: {} },
      );
      transport = nextTransport;
      client = nextClient;

      try {
        await nextClient.connect(nextTransport);
        const { tools } = await nextClient.listTools();
        registerDiscoveredTools(tools);
        return nextClient;
      } catch (error) {
        if (client === nextClient) client = undefined;
        if (transport === nextTransport) transport = undefined;
        await nextTransport.close().catch(() => {});
        throw error;
      }
    })();

    try {
      return await connecting;
    } finally {
      connecting = undefined;
    }
  };

  pi.on("session_start", async (_event, ctx) => {
    try {
      await ensureClient(ctx);
    } catch (error) {
      if (ctx.hasUI) {
        ctx.ui.notify(`ticket-analyzer MCP startup failed: ${errorMessage(error)}`, "error");
      }
    }
  });

  pi.on("session_shutdown", async () => {
    const pending = connecting;
    if (pending) await pending.catch(() => {});

    const activeClient = client;
    const activeTransport = transport;
    client = undefined;
    transport = undefined;

    if (activeTransport) {
      await activeTransport.close().catch(() => {});
    } else if (activeClient) {
      await activeClient.close().catch(() => {});
    }
  });
}
