import { analyzeTicket } from "./index.js";
import { ALL_FIXTURES } from "./__fixtures__/tickets.js";

test("every fixture produces a valid ContextPackage with invariants held", () => {
  for (const { name, ticket } of ALL_FIXTURES) {
    const pkg = analyzeTicket(ticket);
    expect(pkg.ticketType.confidence).toBeGreaterThanOrEqual(0);
    expect(pkg.ticketType.confidence).toBeLessThanOrEqual(1);
    expect(pkg.complexity.factors.length).toBeGreaterThan(0);
    for (const d of pkg.dependencies) {
      expect(typeof d.confidence).toBe("number");
      expect(Array.isArray(d.evidence)).toBe(true);
    }
    for (const risk of pkg.risks) {
      expect(typeof risk.confidence).toBe("number");
      expect(risk.evidence.length).toBeGreaterThan(0);
    }
    expect(pkg.qualityScore.score).toBeGreaterThanOrEqual(0);
    expect(pkg.qualityScore.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high"]).toContain(pkg.overallRisk);
    expect(name.length).toBeGreaterThan(0);
  }
});

test("ambiguous feature is lower quality than clear feature", () => {
  const clear = analyzeTicket(ALL_FIXTURES.find((f) => f.name === "featureClear")!.ticket);
  const vague = analyzeTicket(ALL_FIXTURES.find((f) => f.name === "featureAmbiguous")!.ticket);
  expect(clear.qualityScore.score).toBeGreaterThan(vague.qualityScore.score);
});
