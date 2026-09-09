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

/** JSON Schema supported by the SDK 1.29 tool output contract. */
export const ANALYZE_TICKET_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    objective: { type: "string" },
    ticketType: {
      type: "object",
      properties: {
        type: { type: "string" },
        confidence: { type: "number" },
        evidence: { type: "array", items: { type: "string" } },
      },
      required: ["type", "confidence", "evidence"],
    },
    complexity: {
      type: "object",
      properties: {
        level: { type: "string" },
        confidence: { type: "number" },
        factors: { type: "array", items: { type: "string" } },
      },
      required: ["level", "confidence", "factors"],
    },
    businessContext: { type: "string" },
    technicalContext: { type: "string" },
    stakeholders: { type: "array", items: { type: "object" } },
    dependencies: { type: "array", items: { type: "object" } },
    risks: { type: "array", items: { type: "object" } },
    missingInformation: { type: "array", items: { type: "object" } },
    qualityScore: { type: "object" },
    openQuestions: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    overallRisk: { type: "string" },
    blockingIssues: { type: "array", items: { type: "string" } },
    executiveSummary: { type: "string" },
    engineerSummary: { type: "string" },
  },
  required: [
    "objective", "ticketType", "complexity", "businessContext", "technicalContext",
    "stakeholders", "dependencies", "risks", "missingInformation", "qualityScore",
    "openQuestions", "constraints", "recommendations", "overallRisk", "blockingIssues",
    "executiveSummary", "engineerSummary",
  ],
};

export async function handleAnalyzeTicket(args: AnalyzeTicketArgs): Promise<{
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
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
    return { content: [{ type: "text", text: parts.join("\n\n") }], structuredContent: { ...pkg } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[analysis] Error: ${message}`);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}
