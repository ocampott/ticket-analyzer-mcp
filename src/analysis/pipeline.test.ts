import { analyzeTicket } from "./index.js";
import { bugReport, loginGoogle } from "./__fixtures__/tickets.js";

test("analyzeTicket returns a ContextPackage with all required keys", () => {
  const pkg = analyzeTicket(loginGoogle);
  for (const key of [
    "objective", "ticketType", "complexity", "businessContext", "technicalContext",
    "stakeholders", "dependencies", "risks", "missingInformation", "qualityScore",
    "openQuestions", "constraints", "recommendations", "overallRisk",
    "blockingIssues", "executiveSummary", "engineerSummary",
  ]) {
    expect(pkg).toHaveProperty(key);
  }
});

test("ticketType carries confidence and evidence", () => {
  const pkg = analyzeTicket(bugReport);
  expect(typeof pkg.ticketType.confidence).toBe("number");
  expect(Array.isArray(pkg.ticketType.evidence)).toBe(true);
});

test("complexity.factors is always populated", () => {
  const pkg = analyzeTicket(bugReport);
  expect(pkg.complexity.factors.length).toBeGreaterThan(0);
});
