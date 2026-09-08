import {
  TICKET_TYPE_KEYWORDS, RISK_CATEGORY_KEYWORDS, RISK_BASE_SEVERITY,
  DEPENDENCY_INFERENCE, QUALITY_CHECKS,
} from "./keywords.js";

test("every ticket type has bilingual keywords", () => {
  for (const type of ["feature", "bug", "refactor", "technical_debt", "spike", "infrastructure", "security", "performance"] as const) {
    expect(TICKET_TYPE_KEYWORDS[type].length).toBeGreaterThan(2);
  }
});

test("every risk category has keywords and a base severity", () => {
  for (const category of ["auth", "payments", "security", "database", "infrastructure", "data-loss", "external-provider"] as const) {
    expect(RISK_CATEGORY_KEYWORDS[category].length).toBeGreaterThan(2);
    expect(["low", "medium", "high"]).toContain(RISK_BASE_SEVERITY[category]);
  }
});

test("login google inference rule exists", () => {
  const rule = DEPENDENCY_INFERENCE.find((rule) => rule.match.some((match) => match.includes("google")));
  expect(rule?.implies).toContain("OAuth");
});

test("quality checks cover the seven required fields", () => {
  const fields = QUALITY_CHECKS.map((qualityCheck) => qualityCheck.field);
  for (const field of ["acceptance_criteria", "rollback_plan", "dependencies", "edge_cases", "constraints", "testing_requirements", "success_metrics"]) {
    expect(fields).toContain(field);
  }
});
