import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { getTrelloCard, TrelloCardResult, listTrelloCards, addTrelloComment } from "./trello.js";
import { getJiraIssue, JiraIssueResult, searchJiraIssues, addJiraComment } from "./jira.js";
import { getJiraCustomFields } from "./fields.js";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatCardAsMarkdown(card: TrelloCardResult, imageNames: string[]): string {
  const lines: string[] = [];

  lines.push(`# ${card.name}`);
  lines.push("");

  const meta: string[] = [];
  if (card.list) meta.push(`Lista: ${card.list}`);
  if (card.labels.length > 0) meta.push(`Labels: ${card.labels.join(", ")}`);
  if (card.due) meta.push(`Vence: ${formatDate(card.due)}`);
  if (meta.length > 0) lines.push(meta.join(" | "));
  if (card.members.length > 0) lines.push(`Asignados: ${card.members.join(", ")}`);

  if (card.description) {
    lines.push("");
    lines.push("## Descripción");
    lines.push(card.description);
  }

  for (const checklist of card.checklists) {
    const done = checklist.items.filter((i) => i.done);
    const pending = checklist.items.filter((i) => !i.done);
    lines.push("");
    lines.push(`## ${checklist.name} (${done.length}/${checklist.items.length} hechos)`);
    for (const item of pending) {
      lines.push(`- [ ] ${item.text}`);
    }
    for (const item of done) {
      lines.push(`- [x] ~~${item.text}~~`);
    }
  }

  if (card.comments.length > 0) {
    lines.push("");
    lines.push(`## Comentarios (${card.comments.length})`);
    for (const comment of card.comments) {
      lines.push(`${comment.author} (${formatDate(comment.date)}):`);
      lines.push(comment.text);
    }
  }

  if (card.attachments.length > 0) {
    lines.push("");
    lines.push(`## Adjuntos (${card.attachments.length})`);
    for (const att of card.attachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

  if (imageNames.length > 0) {
    lines.push("");
    lines.push(`_Imágenes (${imageNames.length}): ${imageNames.map((n, i) => `[${i + 1}] ${n}`).join(", ")}_`);
  }

  return lines.join("\n");
}

function formatIssueAsMarkdown(issue: JiraIssueResult, imageNames: string[]): string {
  const lines: string[] = [];

  lines.push(`# [${issue.key}] ${issue.summary}`);
  lines.push("");

  const meta: string[] = [];
  meta.push(`Tipo: ${issue.issueType}`);
  meta.push(`Estado: ${issue.status}`);
  if (issue.priority) meta.push(`Prioridad: ${issue.priority}`);
  if (issue.sprint) meta.push(`Sprint: ${issue.sprint}`);
  if (issue.epic) meta.push(`Epic: ${issue.epic}`);
  if (issue.parent) meta.push(`Parent: ${issue.parent.key}`);
  lines.push(meta.join(" | "));

  if (issue.assignee) lines.push(`Asignado: ${issue.assignee}`);
  if (issue.labels.length > 0) lines.push(`Labels: ${issue.labels.join(", ")}`);
  if (issue.components.length > 0) lines.push(`Componentes: ${issue.components.join(", ")}`);

  if (issue.description) {
    lines.push("");
    lines.push("## Descripción");
    lines.push(issue.description);
  }

  if (issue.subtasks.length > 0) {
    lines.push("");
    lines.push(`## Subtasks (${issue.subtasks.length})`);
    for (const sub of issue.subtasks) {
      lines.push(`- [${sub.status}] ${sub.key}: ${sub.summary}`);
    }
  }

  if (issue.comments.length > 0) {
    lines.push("");
    lines.push(`## Comentarios (${issue.comments.length})`);
    for (const comment of issue.comments) {
      lines.push(`${comment.author} (${formatDate(comment.date)}):`);
      lines.push(comment.text);
    }
  }

  if (issue.attachments.length > 0) {
    lines.push("");
    lines.push(`## Adjuntos (${issue.attachments.length})`);
    for (const att of issue.attachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

  if (imageNames.length > 0) {
    lines.push("");
    lines.push(`_Imágenes (${imageNames.length}): ${imageNames.map((n, i) => `[${i + 1}] ${n}`).join(", ")}_`);
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
        description: "Fetch a Trello card by ID. Returns title, description, list, labels, due date, members, comments, and checklists.",
        inputSchema: {
          type: "object",
          properties: {
            card_id: {
              type: "string",
              description: "Trello card ID",
            },
            include_images: {
              type: "boolean",
              description: "Include attached images (default: true). Set false to save tokens.",
            },
            max_comments: {
              type: "number",
              description: "Limit number of comments returned (most recent N). Default: no limit.",
            },
          },
          required: ["card_id"],
        },
      },
      {
        name: "get_jira_issue",
        description: "Fetch a Jira issue by key (e.g. PROJ-123). Returns summary, type, status, priority, assignee, labels, components, description, and comments.",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Jira issue key (e.g. PROJ-123)",
            },
            include_images: {
              type: "boolean",
              description: "Include attached images (default: true). Set false to save tokens.",
            },
            max_comments: {
              type: "number",
              description: "Limit number of comments returned (most recent N). Default: no limit.",
            },
          },
          required: ["issue_key"],
        },
      },
      {
        name: "search_jira_issues",
        description: "Search Jira issues using JQL. Returns a list with key, summary, status, assignee, and priority.",
        inputSchema: {
          type: "object",
          properties: {
            jql: {
              type: "string",
              description: "JQL query string (e.g. 'sprint in openSprints() AND status = \"In Progress\"')",
            },
            max_results: {
              type: "number",
              description: "Max results to return (default: 20)",
            },
          },
          required: ["jql"],
        },
      },
      {
        name: "list_trello_cards",
        description: "List Trello cards from a board or search globally. Requires board_id or query.",
        inputSchema: {
          type: "object",
          properties: {
            board_id: {
              type: "string",
              description: "Trello board ID. Falls back to TRELLO_DEFAULT_BOARD_ID env var if omitted.",
            },
            list_name: {
              type: "string",
              description: "Filter by list name (case-insensitive, partial match)",
            },
            query: {
              type: "string",
              description: "Filter by card name. Used as global search query when no board_id.",
            },
          },
        },
      },
      {
        name: "add_jira_comment",
        description: "Add a plain-text comment to a Jira issue.",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: {
              type: "string",
              description: "Jira issue key (e.g. PROJ-123)",
            },
            text: {
              type: "string",
              description: "Comment text (plain text, recommended max ~500 chars)",
            },
          },
          required: ["issue_key", "text"],
        },
      },
      {
        name: "add_trello_comment",
        description: "Add a comment to a Trello card.",
        inputSchema: {
          type: "object",
          properties: {
            card_id: {
              type: "string",
              description: "Trello card ID",
            },
            text: {
              type: "string",
              description: "Comment text (markdown supported)",
            },
          },
          required: ["card_id", "text"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_trello_card") {
    const typedArgs = args as { card_id?: string; include_images?: boolean; max_comments?: number } | undefined;
    const cardId = typedArgs?.card_id;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;

    if (!cardId || typeof cardId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "card_id is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: get_trello_card(${cardId})`);

    try {
      const { card, images } = await getTrelloCard(cardId, includeImages, maxComments);
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
    const typedArgs = args as { issue_key?: string; include_images?: boolean; max_comments?: number } | undefined;
    const issueKey = typedArgs?.issue_key;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;

    if (!issueKey || typeof issueKey !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "issue_key is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: get_jira_issue(${issueKey})`);

    try {
      const { issue, images } = await getJiraIssue(issueKey, includeImages, maxComments);
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

  if (name === "search_jira_issues") {
    const typedArgs = args as { jql?: string; max_results?: number } | undefined;
    const jql = typedArgs?.jql;
    const maxResults = typedArgs?.max_results ?? 20;

    if (!jql || typeof jql !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "jql is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: search_jira_issues(${jql})`);

    try {
      const result = await searchJiraIssues(jql, maxResults);
      const lines: string[] = [
        `**${result.total} resultado(s) — mostrando ${result.issues.length}**\n`,
      ];
      result.issues.forEach((issue, i) => {
        lines.push(`${i + 1}. **${issue.key}** — ${issue.summary}`);
        const meta = [issue.status];
        if (issue.assignee) meta.push(issue.assignee);
        if (issue.priority) meta.push(issue.priority);
        lines.push(`   ${meta.join(" | ")}`);
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  if (name === "list_trello_cards") {
    const typedArgs = args as { board_id?: string; list_name?: string; query?: string } | undefined;
    const boardId = typedArgs?.board_id;
    const listName = typedArgs?.list_name;
    const query = typedArgs?.query;

    console.error(`[pm-mcp] Tool called: list_trello_cards`);

    try {
      const cards = await listTrelloCards({ boardId, listName, query });
      const lines: string[] = [`**${cards.length} carta(s) encontrada(s)**\n`];
      cards.forEach((card, i) => {
        lines.push(`${i + 1}. \`${card.id}\` — ${card.name}`);
        const meta: string[] = [];
        if (card.list) meta.push(`Lista: ${card.list}`);
        if (card.labels.length > 0) meta.push(`Labels: ${card.labels.join(", ")}`);
        if (card.due) meta.push(`Vence: ${formatDate(card.due)}`);
        if (meta.length > 0) lines.push(`   ${meta.join(" | ")}`);
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  if (name === "add_jira_comment") {
    const typedArgs = args as { issue_key?: string; text?: string } | undefined;
    const issueKey = typedArgs?.issue_key;
    const text = typedArgs?.text;

    if (!issueKey || typeof issueKey !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "issue_key is required");
    }
    if (!text || typeof text !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "text is required");
    }

    console.error(`[pm-mcp] Tool called: add_jira_comment(${issueKey})`);

    try {
      await addJiraComment(issueKey, text);
      return { content: [{ type: "text", text: `Comentario agregado a ${issueKey}.` }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  if (name === "add_trello_comment") {
    const typedArgs = args as { card_id?: string; text?: string } | undefined;
    const cardId = typedArgs?.card_id;
    const text = typedArgs?.text;

    if (!cardId || typeof cardId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "card_id is required");
    }
    if (!text || typeof text !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "text is required");
    }

    console.error(`[pm-mcp] Tool called: add_trello_comment(${cardId})`);

    try {
      await addTrelloComment(cardId, text);
      return { content: [{ type: "text", text: `Comentario agregado a la card ${cardId}.` }] };
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

  // Pre-warm Jira custom field cache (sprint, epic) so first issue fetch is fast
  getJiraCustomFields().catch((err) => {
    console.error("[pm-mcp] Field pre-cache failed:", err);
  });
}

main().catch((error) => {
  console.error("[pm-mcp] Fatal error:", error);
  process.exit(1);
});
