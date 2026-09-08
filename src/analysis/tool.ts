import { getAzureWorkItem } from "../azure.js";
import { getJiraIssue } from "../jira.js";
import { getTrelloCard } from "../trello.js";
import { analyzeTicket } from "./index.js";
import { normalizeAzure, normalizeJira, normalizeTrello } from "./normalize.js";
import { renderMarkdown } from "./render.js";
import type { ContextPackage, NormalizedTicket } from "./types.js";

const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;
const AZURE_ID_RE = /^\d+$/;

type AnalyzeTicketArgs = {
  id?: string;
  ticket?: NormalizedTicket;
  source?: "jira" | "trello" | "azure" | "auto";
  format?: "both" | "json" | "markdown";
};

export async function handleAnalyzeTicket(args: AnalyzeTicketArgs): Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}> {
  const id = args.id;
  const format = args.format ?? "both";

  if (!args.ticket && (!id || typeof id !== "string")) {
    return { content: [{ type: "text", text: "Error: se requiere el parámetro id o ticket" }], isError: true };
  }

  console.error(`[analysis] analyze_ticket(${id ?? args.ticket?.id ?? "normalized"}) source=${args.source ?? "auto"}`);

  try {
    let pkg: ContextPackage;
    if (args.ticket) {
      pkg = analyzeTicket(args.ticket);
    } else {
      const source = args.source && args.source !== "auto"
        ? args.source
        : JIRA_KEY_RE.test(id!) ? "jira" : AZURE_ID_RE.test(id!) ? "azure" : "trello";

      if (source === "jira") {
        const { issue } = await getJiraIssue(id!, false);
        pkg = analyzeTicket(normalizeJira(issue));
      } else if (source === "azure") {
        const workItemId = Number(id);
        if (!Number.isSafeInteger(workItemId) || workItemId <= 0) {
          return { content: [{ type: "text", text: "Error: id de Azure debe ser un entero positivo" }], isError: true };
        }
        const { workItem } = await getAzureWorkItem(workItemId, false);
        pkg = analyzeTicket(normalizeAzure(workItem));
      } else {
        const { card } = await getTrelloCard(id!, false);
        pkg = analyzeTicket(normalizeTrello(card, id!));
      }
    }

    const parts: string[] = [];
    if (format !== "json") parts.push(renderMarkdown(pkg));
    if (format !== "markdown") parts.push("```json\n" + JSON.stringify(pkg, null, 2) + "\n```");
    return { content: [{ type: "text", text: parts.join("\n\n") }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[analysis] Error: ${message}`);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}
