import type { Analyzer, AnalysisContext, TicketType, TicketTypeResult, Complexity, Stakeholder } from "../types.js";
import { countHits } from "../signals.js";
import { TICKET_TYPE_KEYWORDS } from "../keywords.js";

const TYPES = Object.keys(TICKET_TYPE_KEYWORDS) as TicketType[];

function classifyType(ctx: AnalysisContext): TicketTypeResult {
  const scored = TYPES.map((type) => {
    const hits = countHits(ctx.signals, TICKET_TYPE_KEYWORDS[type]);
    return { type, hits, score: hits.length };
  });
  const sourceType = (ctx.ticket.type ?? "").toLowerCase();
  if (sourceType.includes("bug")) scored.find((s) => s.type === "bug")!.score += 1;
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];
  const total = scored.reduce((acc, s) => acc + s.score, 0);
  if (winner.score === 0) return { type: "feature", confidence: 0.2, evidence: [] };
  return {
    type: winner.type,
    confidence: round(Math.min(1, winner.score / Math.max(1, total) + 0.2)),
    evidence: winner.hits,
  };
}

function deriveObjective(title: string): string { return title.trim().replace(/^(fix|bug|feat|feature)\s*:\s*/i, ""); }

function deriveStakeholders(ctx: AnalysisContext): Stakeholder[] {
  const out: Stakeholder[] = [];
  const seen = new Set<string>();
  const add = (name: string, confidence: number, evidence: string[]) => {
    if (!name || seen.has(name)) return;
    seen.add(name); out.push({ name, confidence, evidence });
  };
  if (ctx.ticket.metadata.assignee) add(ctx.ticket.metadata.assignee, 0.9, ["assignee"]);
  for (const m of ctx.ticket.metadata.members ?? []) add(m, 0.8, ["member"]);
  for (const role of ["admin", "usuario", "user", "cliente", "customer"]) {
    if (ctx.signals.tokens.has(role)) add(role, 0.5, [role]);
  }
  return out;
}

function preliminaryComplexity(ctx: AnalysisContext, type: TicketTypeResult): Complexity {
  const factors: string[] = [];
  let score = 0;
  const text = ctx.signals.fullText;
  if (/schema|migración|migration|base de datos|database/.test(text)) { score += 2; factors.push("toca base de datos/schema"); }
  if (/auth|login|oauth|permiso|permission/.test(text)) { score += 1; factors.push("afecta auth/permisos"); }
  if (/integración|integration|webhook|api externa|external api/.test(text)) { score += 1; factors.push("integración externa"); }
  if (ctx.ticket.description.length > 600) { score += 1; factors.push("descripción extensa"); }
  if ((ctx.ticket.checklistItems.length + (ctx.ticket.metadata.subtasks?.length ?? 0) + (ctx.ticket.metadata.children?.length ?? 0)) >= 4) {
    score += 1; factors.push("muchos sub-ítems");
  }
  if (type.type === "infrastructure" || type.type === "security") { score += 1; factors.push(`tipo ${type.type}`); }
  if (factors.length === 0) factors.push("sin señales fuertes de complejidad");
  const level = score >= 5 ? "XL" : score >= 3 ? "L" : score >= 1 ? "M" : "S";
  return { level, confidence: 0.5, factors };
}

function round(n: number): number { return Math.round(n * 100) / 100; }

export const semanticAnalyzer: Analyzer = {
  name: "semantic", version: "1.0.0",
  analyze(ctx) {
    const ticketType = classifyType(ctx);
    return {
      objective: deriveObjective(ctx.ticket.title), ticketType,
      complexity: preliminaryComplexity(ctx, ticketType),
      businessContext: ctx.ticket.description.split("\n").find((l) => /como|as a|para|so that/i.test(l))?.trim() ?? "",
      technicalContext: ctx.ticket.metadata.components?.length ? `Componentes: ${ctx.ticket.metadata.components.join(", ")}` : "",
      stakeholders: deriveStakeholders(ctx),
    };
  },
};
