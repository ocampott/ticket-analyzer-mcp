import { riskAnalyzer } from "./risks.js";
import { deriveSignals } from "../signals.js";
import { loginGoogle, infraMigration, bugReport } from "../__fixtures__/tickets.js";
import type { AnalysisContext, NormalizedTicket } from "../types.js";

function ctx(t: NormalizedTicket): AnalysisContext {
  return { ticket: t, signals: deriveSignals(t), partial: {} };
}

test("flags an auth risk for google login (high severity)", () => {
  const out = riskAnalyzer.analyze(ctx(loginGoogle));
  const auth = out.risks?.find((r) => r.category === "auth");
  expect(auth).toBeDefined();
  expect(auth?.severity).toBe("high");
  expect(auth?.evidence.length).toBeGreaterThan(0);
});

test("flags database + data-loss risks for a migration", () => {
  const out = riskAnalyzer.analyze(ctx(infraMigration));
  const cats = (out.risks ?? []).map((r) => r.category);
  expect(cats).toContain("database");
  expect(cats).toContain("data-loss");
});

test("a simple bug with no risk keywords yields no risks", () => {
  const out = riskAnalyzer.analyze(ctx(bugReport));
  expect(out.risks).toEqual([]);
});
