import { dependencyExtractor } from "./dependencies.js";
import { deriveSignals } from "../signals.js";
import { loginGoogle, spanishOnly } from "../__fixtures__/tickets.js";
import type { AnalysisContext, NormalizedTicket } from "../types.js";

function ctx(ticket: NormalizedTicket): AnalysisContext {
  return { ticket, signals: deriveSignals(ticket), partial: {} };
}

test("infers OAuth + session management from google login", () => {
  const out = dependencyExtractor.analyze(ctx(loginGoogle));
  const names = (out.dependencies ?? []).map((dependency) => dependency.name);
  expect(names).toContain("OAuth");
  expect(names).toContain("Session Management");
});

test("inferred dependencies carry confidence and evidence", () => {
  const out = dependencyExtractor.analyze(ctx(loginGoogle));
  const oauth = out.dependencies?.find((dependency) => dependency.name === "OAuth");
  expect(oauth?.inferred).toBe(true);
  expect(oauth?.evidence.length).toBeGreaterThan(0);
  expect(oauth?.confidence).toBeGreaterThan(0);
});

test("infers notification + email provider from email ticket", () => {
  const out = dependencyExtractor.analyze(ctx(spanishOnly));
  const names = (out.dependencies ?? []).map((dependency) => dependency.name);
  expect(names).toContain("Email Provider");
});
