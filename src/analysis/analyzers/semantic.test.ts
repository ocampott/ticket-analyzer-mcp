import { semanticAnalyzer } from "./semantic.js";
import { deriveSignals } from "../signals.js";
import { bugReport, loginGoogle, infraMigration } from "../__fixtures__/tickets.js";
import type { AnalysisContext, NormalizedTicket } from "../types.js";

function ctx(ticket: NormalizedTicket): AnalysisContext {
  return { ticket, signals: deriveSignals(ticket), partial: {} };
}

test("classifies a bug report as bug with evidence", () => {
  const out = semanticAnalyzer.analyze(ctx(bugReport));
  expect(out.ticketType?.type).toBe("bug");
  expect(out.ticketType?.evidence.length).toBeGreaterThan(0);
  expect(out.ticketType?.confidence).toBeGreaterThan(0);
  expect(out.ticketType?.confidence).toBeLessThanOrEqual(1);
});

test("classifies a migration as infrastructure", () => {
  const out = semanticAnalyzer.analyze(ctx(infraMigration));
  expect(out.ticketType?.type).toBe("infrastructure");
});

test("derives stakeholders from assignee", () => {
  const out = semanticAnalyzer.analyze(ctx(loginGoogle));
  expect(out.stakeholders?.some((stakeholder) => stakeholder.name === "Ana")).toBe(true);
});

test("objective is non-empty and complexity has factors", () => {
  const out = semanticAnalyzer.analyze(ctx(loginGoogle));
  expect(out.objective?.length).toBeGreaterThan(0);
  expect(out.complexity?.factors.length).toBeGreaterThan(0);
});
