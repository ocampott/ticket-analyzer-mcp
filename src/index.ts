import "./env.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { getTrelloCard, TrelloCardResult, listTrelloCards, addTrelloComment, getTrelloStatus, TextAttachment } from "./trello.js";
import { getJiraIssue, JiraIssueResult, searchJiraIssues, addJiraComment, getJiraStatus } from "./jira.js";
import { getAzureWorkItem, AzureWorkItemResult, AzureWorkItemNode, searchAzureWorkItems, addAzureComment, getAzureStatus, DEFAULT_MAX_DEPTH, DEFAULT_MAX_NODES } from "./azure.js";
import { getJiraCustomFields } from "./fields.js";
import { ANALYZE_TICKET_OUTPUT_SCHEMA, handleAnalyzeTicket } from "./analysis/tool.js";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

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

function metadataOnlyAttachments<T extends { name: string; mimeType: string; url: string }>(
  attachments: T[],
  renderedImages: { name: string; url?: string }[],
): T[] {
  const renderedUrls = new Set(renderedImages.flatMap((image) => image.url ? [image.url] : []));
  return attachments.filter(
    (attachment) => !attachment.mimeType.startsWith("image/") || !renderedUrls.has(attachment.url),
  );
}

function formatCardAsMarkdown(card: TrelloCardResult, renderedImages: { name: string; url?: string }[], textAttachments: TextAttachment[]): string {
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

  const cardAttachments = metadataOnlyAttachments(card.attachments, renderedImages);
  if (cardAttachments.length > 0) {
    lines.push("");
    lines.push(`## Adjuntos (${cardAttachments.length})`);
    for (const att of cardAttachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

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

  return lines.join("\n");
}

function formatIssueAsMarkdown(issue: JiraIssueResult, renderedImages: { name: string; url?: string }[], textAttachments: TextAttachment[]): string {
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

  const issueAttachments = metadataOnlyAttachments(issue.attachments, renderedImages);
  if (issueAttachments.length > 0) {
    lines.push("");
    lines.push(`## Adjuntos (${issueAttachments.length})`);
    for (const att of issueAttachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

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

  return lines.join("\n");
}

function formatNodeBody(node: AzureWorkItemNode, headingLevel: number, renderedImages: { name: string; url?: string }[]): string[] {
  const h = "#".repeat(headingLevel);
  const lines: string[] = [];

  if (node.description) {
    lines.push("");
    lines.push(`${h} Descripción`);
    lines.push(node.description);
  }

  if (node.acceptanceCriteria) {
    lines.push("");
    lines.push(`${h} Criterios de aceptación`);
    lines.push(node.acceptanceCriteria);
  }

  if (node.reproSteps) {
    lines.push("");
    lines.push(`${h} Pasos para reproducir`);
    lines.push(node.reproSteps);
  }

  if (node.comments.length > 0) {
    lines.push("");
    lines.push(`${h} Comentarios (${node.comments.length})`);
    for (const comment of node.comments) {
      lines.push(`${comment.author} (${formatDate(comment.date)}):`);
      lines.push(comment.text);
    }
  }

  const nodeAttachments = metadataOnlyAttachments(node.attachments, renderedImages);
  if (nodeAttachments.length > 0) {
    lines.push("");
    lines.push(`${h} Adjuntos (${nodeAttachments.length})`);
    for (const att of nodeAttachments) {
      lines.push(`- ${att.name} (${att.mimeType})`);
    }
  }

  return lines;
}

function nodeMeta(node: AzureWorkItemNode): string {
  const meta: string[] = [`Estado: ${node.state}`];
  if (node.reason) meta.push(`Motivo: ${node.reason}`);
  if (node.priority !== null) meta.push(`Prioridad: ${node.priority}`);
  if (node.storyPoints !== null) meta.push(`Story Points: ${node.storyPoints}`);
  if (node.remainingWork !== null) meta.push(`Restante: ${node.remainingWork}h`);
  if (node.assignee) meta.push(`Asignado: ${node.assignee}`);
  if (node.iterationPath) meta.push(`Iteración: ${node.iterationPath}`);
  if (node.tags.length > 0) meta.push(`Tags: ${node.tags.join(", ")}`);
  return meta.join(" | ");
}

/** Depth-first list of every descendant, each paired with its parent and its depth. */
function flattenDescendants(
  node: AzureWorkItemNode,
  depth = 1,
  parent: AzureWorkItemNode | null = null
): { node: AzureWorkItemNode; depth: number; parent: AzureWorkItemNode | null }[] {
  return node.children.flatMap((child) => [
    { node: child, depth, parent: node },
    ...flattenDescendants(child, depth + 1, child),
  ]);
}

function formatIndexTree(node: AzureWorkItemNode, depth = 0): string[] {
  return node.children.flatMap((child) => [
    `${"  ".repeat(depth)}- [${child.state}] ${child.workItemType} ${child.id}: ${child.title}`,
    ...formatIndexTree(child, depth + 1),
  ]);
}

function formatWorkItemAsMarkdown(
  item: AzureWorkItemResult,
  renderedImages: { name: string; url?: string }[],
  textAttachments: TextAttachment[]
): string {
  const lines: string[] = [];

  lines.push(`# [${item.id}] ${item.title}`);
  lines.push("");

  const head: string[] = [`Tipo: ${item.workItemType}`, nodeMeta(item)];
  lines.push(head.join(" | "));
  if (item.areaPath) lines.push(`Área: ${item.areaPath}`);
  if (item.createdBy) lines.push(`Creado por: ${item.createdBy}`);
  if (item.parent) lines.push(`Parent: [${item.parent.id}] ${item.parent.title} (${item.parent.type})`);
  lines.push(`URL: ${item.url}`);

  lines.push(...formatNodeBody(item, 2, renderedImages));

  const descendants = flattenDescendants(item);

  if (descendants.length > 0) {
    lines.push("");
    lines.push(`## Árbol del ticket (${item.nodeCount} work items)`);
    lines.push(...formatIndexTree(item));
    if (item.truncated) {
      lines.push("");
      lines.push(
        "_Árbol truncado: hay más work items debajo de los que se trajeron. Subí `max_depth` o `max_nodes` si necesitás el resto._"
      );
    }
  }

  if (item.related.length > 0) {
    lines.push("");
    lines.push(`## Relacionados (${item.related.length})`);
    for (const rel of item.related) {
      lines.push(`- ${rel.type} ${rel.id}: ${rel.title}`);
    }
  }

  for (const { node, parent } of descendants) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`## [${node.id}] ${node.workItemType} — ${node.title}`);
    const meta = nodeMeta(node);
    lines.push(parent ? `Padre: ${parent.id} | ${meta}` : meta);
    lines.push(`URL: ${node.url}`);
    lines.push(...formatNodeBody(node, 3, renderedImages));
  }

  if (textAttachments.length > 0) {
    lines.push("");
    lines.push("---");
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

  return lines.join("\n");
}

const server = new Server(
  { name: "ticket-analyzer-mcp", version: "2.2.1" },
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
              type: "integer",
              minimum: 0,
              maximum: 200,
              description: "Limit number of comments returned (most recent N). Default: 200.",
            },
            include_text_attachments: {
              type: "boolean",
              description: "Download and include the content of text attachments (.html, .sql, .txt, .json, etc.) inline in the response. Default: false.",
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
              type: "integer",
              minimum: 0,
              maximum: 200,
              description: "Limit number of comments returned (most recent N). Default: 200.",
            },
            include_text_attachments: {
              type: "boolean",
              description: "Download and include the content of text attachments (.html, .sql, .txt, .json, etc.) inline in the response. Default: false.",
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
              type: "integer",
              minimum: 1,
              maximum: 100,
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
      {
        name: "get_azure_work_item",
        description: "Fetch a complete Azure DevOps ticket by numeric ID: the work item AND every work item below it in the hierarchy (Tasks, Bugs, child User Stories), each with its own description, acceptance criteria, repro steps, comments and attachments. Also returns parent and related items as summaries. Use this whenever you need to understand what a ticket actually asks for — the requirement is often written in a child, not in the root.",
        inputSchema: {
          type: "object",
          properties: {
            work_item_id: {
              type: "integer",
              minimum: 1,
              maximum: 10000000,
              description: "Azure DevOps work item ID (e.g. 1596)",
            },
            max_depth: {
              type: "integer",
              minimum: 0,
              maximum: 10,
              description: "How many levels of children to descend. Default: 3. Use 0 for the root work item alone.",
            },
            max_nodes: {
              type: "integer",
              minimum: 1,
              maximum: 200,
              description: "Cap on total work items fetched, root included (default: 40). Guards against pulling a whole Epic tree.",
            },
            include_images: {
              type: "boolean",
              description: "Include attached images (default: true). Set false to save tokens.",
            },
            max_comments: {
              type: "integer",
              minimum: 0,
              maximum: 200,
              description: "Limit number of comments returned (most recent N). Default: 200.",
            },
            include_text_attachments: {
              type: "boolean",
              description: "Download and include the content of text attachments (.html, .sql, .txt, .json, etc.) inline in the response. Default: false.",
            },
          },
          required: ["work_item_id"],
        },
      },
      {
        name: "search_azure_work_items",
        description: "Search Azure DevOps work items using WIQL. Accepts a full 'SELECT [System.Id] FROM WorkItems WHERE ...' query, or just the WHERE clause. Returns id, title, type, state, assignee, and iteration.",
        inputSchema: {
          type: "object",
          properties: {
            wiql: {
              type: "string",
              description: "WIQL query, or just the WHERE condition (e.g. \"[System.WorkItemType] = 'User Story' AND [System.State] = 'Active'\")",
            },
            max_results: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              description: "Max results to return (default: 20)",
            },
          },
          required: ["wiql"],
        },
      },
      {
        name: "add_azure_comment",
        description: "Add a comment to an Azure DevOps work item. Requires a PAT with Work Items (Read & Write) scope.",
        inputSchema: {
          type: "object",
          properties: {
            work_item_id: {
              type: "integer",
              minimum: 1,
              maximum: 10000000,
              description: "Azure DevOps work item ID",
            },
            text: {
              type: "string",
              description: "Comment text (basic HTML supported)",
            },
          },
          required: ["work_item_id", "text"],
        },
      },
      {
        name: "analyze_ticket",
        description: "Analyze a Jira issue, Trello card, Azure DevOps work item, or normalized ticket and return deterministic ticket-only evidence. Repository-unverified inferences are labeled; this is not a final implementation plan.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Jira issue key, Trello card ID, or Azure DevOps work item ID" },
            ticket: { type: "object", description: "Optional normalized ticket payload; use this instead of id" },
            source: { type: "string", enum: ["jira", "trello", "azure", "auto"], description: "Platform (default: auto-detect by ID format)" },
            format: { type: "string", enum: ["both", "json", "markdown"], description: "Output format (default: both)" },
          },
          oneOf: [{ required: ["id"] }, { required: ["ticket"] }],
        },
        outputSchema: ANALYZE_TICKET_OUTPUT_SCHEMA,
      },
      {
        name: "get_status",
        description: "Check which integrations are configured and connected. Returns account info for Trello, Jira, and/or Azure DevOps.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_trello_card") {
    const typedArgs = args as { card_id?: string; include_images?: boolean; max_comments?: number; include_text_attachments?: boolean } | undefined;
    const cardId = typedArgs?.card_id;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
    const includeTextAttachments = typedArgs?.include_text_attachments ?? false;

    if (!cardId || typeof cardId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "card_id is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: get_trello_card(${cardId})`);

    try {
      const { card, images, textAttachments } = await getTrelloCard(cardId, includeImages, maxComments, includeTextAttachments);
      console.error(
        `[pm-mcp] Success: card "${card.name}", ${card.comments.length} comment(s), ${images.length} image(s), ${textAttachments.length} text attachment(s)`
      );

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatCardAsMarkdown(card, images, textAttachments) }];

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
    const typedArgs = args as { issue_key?: string; include_images?: boolean; max_comments?: number; include_text_attachments?: boolean } | undefined;
    const issueKey = typedArgs?.issue_key;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
    const includeTextAttachments = typedArgs?.include_text_attachments ?? false;

    if (!issueKey || typeof issueKey !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "issue_key is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: get_jira_issue(${issueKey})`);

    try {
      const { issue, images, textAttachments } = await getJiraIssue(issueKey, includeImages, maxComments, includeTextAttachments);
      console.error(
        `[pm-mcp] Success: issue "${issue.key}", ${issue.comments.length} comment(s), ${images.length} image(s), ${textAttachments.length} text attachment(s)`
      );

      const imageNames = images.map((img) => img.name);

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatIssueAsMarkdown(issue, images, textAttachments) }];

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

  if (name === "get_azure_work_item") {
    const typedArgs = args as { work_item_id?: number; include_images?: boolean; max_comments?: number; include_text_attachments?: boolean; max_depth?: number; max_nodes?: number } | undefined;
    const workItemId = typedArgs?.work_item_id;
    const includeImages = typedArgs?.include_images ?? true;
    const maxComments = typedArgs?.max_comments;
    const includeTextAttachments = typedArgs?.include_text_attachments ?? false;
    const maxDepth = typedArgs?.max_depth ?? DEFAULT_MAX_DEPTH;
    const maxNodes = typedArgs?.max_nodes ?? DEFAULT_MAX_NODES;

    if (typeof workItemId !== "number" || !Number.isInteger(workItemId) || workItemId <= 0) {
      throw new McpError(ErrorCode.InvalidParams, "work_item_id is required and must be a positive integer");
    }
    if (!Number.isInteger(maxDepth) || maxDepth < 0) {
      throw new McpError(ErrorCode.InvalidParams, "max_depth must be a non-negative integer");
    }
    if (!Number.isInteger(maxNodes) || maxNodes < 1) {
      throw new McpError(ErrorCode.InvalidParams, "max_nodes must be a positive integer");
    }

    console.error(`[pm-mcp] Tool called: get_azure_work_item(${workItemId})`);

    try {
      const { workItem, images, textAttachments } = await getAzureWorkItem(workItemId, includeImages, maxComments, includeTextAttachments, maxDepth, maxNodes);
      console.error(
        `[pm-mcp] Success: work item ${workItem.id}, ${workItem.nodeCount} node(s) in tree${workItem.truncated ? " (truncated)" : ""}, ${images.length} image(s), ${textAttachments.length} text attachment(s)`
      );

      const imageNames = images.map((img) => img.name);

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: formatWorkItemAsMarkdown(workItem, images, textAttachments) }];

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

  if (name === "search_azure_work_items") {
    const typedArgs = args as { wiql?: string; max_results?: number } | undefined;
    const wiql = typedArgs?.wiql;
    const maxResults = typedArgs?.max_results ?? 20;

    if (!wiql || typeof wiql !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "wiql is required and must be a string");
    }

    console.error(`[pm-mcp] Tool called: search_azure_work_items`);

    try {
      const result = await searchAzureWorkItems(wiql, maxResults);
      const lines: string[] = [`**${result.total} resultado(s)**\n`];
      result.workItems.forEach((item, i) => {
        lines.push(`${i + 1}. **${item.id}** — ${item.title}`);
        const meta = [item.type, item.state];
        if (item.assignee) meta.push(item.assignee);
        if (item.iterationPath) meta.push(item.iterationPath);
        lines.push(`   ${meta.join(" | ")}`);
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  if (name === "add_azure_comment") {
    const typedArgs = args as { work_item_id?: number; text?: string } | undefined;
    const workItemId = typedArgs?.work_item_id;
    const text = typedArgs?.text;

    if (typeof workItemId !== "number" || !Number.isInteger(workItemId) || workItemId <= 0) {
      throw new McpError(ErrorCode.InvalidParams, "work_item_id is required and must be a positive integer");
    }
    if (!text || typeof text !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "text is required");
    }

    console.error(`[pm-mcp] Tool called: add_azure_comment(${workItemId})`);

    try {
      await addAzureComment(workItemId, text);
      return { content: [{ type: "text", text: `Comentario agregado al work item ${workItemId}.` }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[pm-mcp] Error: ${message}`);
      return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
  }

  if (name === "analyze_ticket") {
    return handleAnalyzeTicket(
      (args ?? {}) as {
        id?: string;
        ticket?: import("./analysis/types.js").NormalizedTicket;
        source?: "jira" | "trello" | "azure" | "auto";
        format?: "both" | "json" | "markdown";
      },
    );
  }

  if (name === "get_status") {
    console.error("[pm-mcp] Tool called: get_status");

    const [trello, jira, azure] = await Promise.all([getTrelloStatus(), getJiraStatus(), getAzureStatus()]);

    const lines: string[] = ["## ticket-analyzer status\n"];

    const trelloIcon = trello.connected ? "✓" : trello.configured ? "✗" : "—";
    lines.push(`**Trello** ${trelloIcon}`);
    if (trello.connected) {
      lines.push(`  Usuario: ${trello.fullName} (@${trello.username})`);
      if (trello.email) lines.push(`  Email: ${trello.email}`);
    } else if (trello.configured) {
      lines.push(`  Error: ${trello.error}`);
    } else {
      lines.push("  No configurado — ejecutá /ticket-analyzer:setup");
    }

    lines.push("");

    const jiraIcon = jira.connected ? "✓" : jira.configured ? "✗" : "—";
    lines.push(`**Jira** ${jiraIcon}`);
    if (jira.connected) {
      lines.push(`  Host: ${jira.host}`);
      lines.push(`  Usuario: ${jira.displayName}`);
      if (jira.email) lines.push(`  Email: ${jira.email}`);
    } else if (jira.configured) {
      lines.push(`  Host: ${jira.host}`);
      lines.push(`  Error: ${jira.error}`);
    } else {
      lines.push("  No configurado — ejecutá /ticket-analyzer:setup");
    }

    lines.push("");

    const azureIcon = azure.connected ? "✓" : azure.configured ? "✗" : "—";
    lines.push(`**Azure DevOps** ${azureIcon}`);
    if (azure.connected) {
      lines.push(`  Organización: ${azure.org}`);
      lines.push(`  Proyecto: ${azure.project}`);
      if (azure.workItemTypes?.length) {
        lines.push(`  Tipos de work item: ${azure.workItemTypes.join(", ")}`);
      }
    } else if (azure.configured) {
      lines.push(`  Organización: ${azure.org} / Proyecto: ${azure.project}`);
      lines.push(`  Error: ${azure.error}`);
    } else {
      lines.push("  No configurado — ejecutá /ticket-analyzer:setup");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
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
