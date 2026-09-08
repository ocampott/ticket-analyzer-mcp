import { analyzeTicket } from "./index.js";
import { featureAmbiguous, loginGoogle, infraMigration } from "./__fixtures__/tickets.js";

test("recommendations are derived and non-empty for a risky feature", () => {
  const pkg = analyzeTicket(loginGoogle);
  expect(pkg.recommendations.length).toBeGreaterThan(0);
  expect(pkg.recommendations.join(" ")).toMatch(/OAuth|aceptación|sesión/i);
});

test("ambiguity raises complexity factors (assembler finalization)", () => {
  const pkg = analyzeTicket(featureAmbiguous);
  expect(pkg.complexity.factors.some((f) => /ambig|información|huecos/i.test(f))).toBe(true);
});

test("dependencies are deduplicated by name", () => {
  const pkg = analyzeTicket(loginGoogle);
  const names = pkg.dependencies.map((d) => d.name);
  expect(new Set(names).size).toBe(names.length);
});

test("overallRisk high and blockingIssues present for migration", () => {
  const pkg = analyzeTicket(infraMigration);
  expect(pkg.overallRisk).toBe("high");
  expect(pkg.blockingIssues.length).toBeGreaterThan(0);
});
