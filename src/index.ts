import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { getTrelloCard, TrelloCardResult } from "./trello.js";
import { getJiraIssue, JiraIssueResult } from "./jira.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function formatCardAsMarkdown(card: TrelloCardResult, imageNames: string[]): string {
  const lines: string[] = [];

  lines.push(`# ${card.name}`);
  lines.push("");

  const meta: string[] = [];
  if (card.list) meta.push(`**Lista:** ${card.list}`);
  if (card.labels.length > 0) meta.push(`**Labels:** ${card.labels.join(", ")}`);
  if (card.due) meta.push(`**Vence:** ${formatDate(card.due)}`);
  if (meta.length > 0) lines.push(meta.join(" | "));

  if (card.members.length > 0) lines.push(`**Asignados:** ${card.members.join(", ")}`);
  if (card.shortUrl) lines.push(`**URL:** ${card.shortUrl}`);

  if (card.description) {
    lines.push("");
    lines.push("## Descripción");
    lines.push(card.description);
  }

  for (const checklist of card.checklists) {
    const done = checklist.items.filter((i) => i.done).length;
    lines.push("");
    lines.push(`## ${checklist.name} (${done}/${checklist.items.length} completados)`);
    for (const item of checklist.items) {
      lines.push(`- [${item.done ? "x" : " "}] ${item.text}`);
    }
  }

  if (card.comments.length > 0) {
    lines.push("");
    lines.push(`## Comentarios (${card.comments.length})`);
    for (const comment of card.comments) {
      lines.push("");
      lines.push(`**${comment.author}** — ${formatDate(comment.date)}:`);
      lines.push(comment.text);
    }
  }

  if (card.attachments.length > 0) {
    lines.push("");
    lines.push(`## Adjuntos no-imagen (${card.attachments.length})`);
    for (const att of card.attachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

  if (imageNames.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push(`_Imágenes adjuntas: ${imageNames.length} (ver bloques a continuación)_`);
    imageNames.forEach((name, i) => {
      lines.push(`_[${i + 1}] ${name}_`);
    });
  }

  return lines.join("\n");
}

function formatIssueAsMarkdown(issue: JiraIssueResult, imageNames: string[]): string {
  const lines: string[] = [];

  lines.push(`# [${issue.key}] ${issue.summary}`);
  lines.push("");

  const meta: string[] = [];
  meta.push(`**Tipo:** ${issue.issueType}`);
  meta.push(`**Estado:** ${issue.status}`);
  if (issue.priority) meta.push(`**Prioridad:** ${issue.priority}`);
  lines.push(meta.join(" | "));

  if (issue.assignee) lines.push(`**Asignado:** ${issue.assignee}`);
  if (issue.reporter) lines.push(`**Reportado por:** ${issue.reporter}`);
  if (issue.labels.length > 0) lines.push(`**Labels:** ${issue.labels.join(", ")}`);
  if (issue.components.length > 0) lines.push(`**Componentes:** ${issue.components.join(", ")}`);

  if (issue.description) {
    lines.push("");
    lines.push("## Descripción");
    lines.push(issue.description);
  }

  if (issue.comments.length > 0) {
    lines.push("");
    lines.push(`## Comentarios (${issue.comments.length})`);
    for (const comment of issue.comments) {
      lines.push("");
      lines.push(`**${comment.author}** — ${formatDate(comment.date)}:`);
      lines.push(comment.text);
    }
  }

  if (issue.attachments.length > 0) {
    lines.push("");
    lines.push(`## Adjuntos no-imagen (${issue.attachments.length})`);
    for (const att of issue.attachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

  if (imageNames.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push(`_Imágenes adjuntas: ${imageNames.length} (ver bloques a continuación)_`);
    imageNames.forEach((name, i) => {
      lines.push(`_[${i + 1}] ${name}_`);
    });
  }

  return lines.join("\n");
}

const server = new Server(
  { name: "pm-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_trello_card",
        description:
          "Fetches a Trello card by ID. Returns the card's title, description, status (list/column), labels, due date, assigned members, comments, checklists, and any attached images. Use this whenever the user references a Trello card URL or card ID to understand what needs to be built.",
        inputSchema: {
          type: "object",
          properties: {
            card_id: {
              type: "string",
              description: "The Trello card ID to fetch",
            },
            include_images: {
              type: "boolean",
              description: "Whether to download and include attached images in the response. Set to false to save tokens when images are not needed for analysis. Defaults to true.",
            },
          },
          required: ["card_id"],
        },
      },
      {
        name: "get_jira_issue",
        description:
          "Fetches a Jira issue by key (e.g. PROJ-123). Returns the issue's summary, type, status, priority, assignee, labels, components, description, comments, and any attached images. Use this whenever the user references a Jira issue key or URL to understand what needs to be built.",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "The Jira issue key to fetch (e.g. PROJ-123)",
            },
            include_images: {
              type: "boolean",
              description: "Whether to download and include attached images in the response. Set to false to save tokens when images are not needed for analysis. Defaults to true.",
            },
          },
          required: ["issue_key"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_trello_card") {
    const typedArgs = args as { card_id?: string; include_images?: boolean } | undefined;
    const cardId = typedArgs?.card_id;
    const includeImages = typedArgs?.include_images ?? true;

    if (!cardId || typeof cardId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "card_id is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: get_trello_card(${cardId})`);

    try {
      const { card, images } = await getTrelloCard(cardId, includeImages);
      console.error(
        `[pm-mcp] Success: card "${card.name}", ${card.comments.length} comment(s), ${images.length} image(s)`
      );

      const imageNames = images.map((img) => img.name);

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatCardAsMarkdown(card, imageNames) }];

      for (const img of images) {
        content.push({ type: "text", text: `[Imagen: ${img.name}]` });
        content.push({ type: "image", data: img.base64, mimeType: img.mimeType });
      }

      return { content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  if (name === "get_jira_issue") {
    const typedArgs = args as { issue_key?: string; include_images?: boolean } | undefined;
    const issueKey = typedArgs?.issue_key;
    const includeImages = typedArgs?.include_images ?? true;

    if (!issueKey || typeof issueKey !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "issue_key is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: get_jira_issue(${issueKey})`);

    try {
      const { issue, images } = await getJiraIssue(issueKey, includeImages);
      console.error(
        `[pm-mcp] Success: issue "${issue.key}", ${issue.comments.length} comment(s), ${images.length} image(s)`
      );

      const imageNames = images.map((img) => img.name);

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatIssueAsMarkdown(issue, imageNames) }];

      for (const img of images) {
        content.push({ type: "text", text: `[Imagen: ${img.name}]` });
        content.push({ type: "image", data: img.base64, mimeType: img.mimeType });
      }

      return { content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[pm-mcp] Server started on stdio");
}

main().catch((error) => {
  console.error("[pm-mcp] Fatal error:", error);
  process.exit(1);
});
