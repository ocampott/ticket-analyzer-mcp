import { ALL_FIXTURES, loginGoogle } from "./tickets.js";

test("fixture set covers all required categories", () => {
  const names = ALL_FIXTURES.map((f) => f.name);
  for (const required of [
    "featureClear", "featureAmbiguous", "bugReport", "techDebt",
    "infraMigration", "spanishOnly", "englishOnly", "mixedLanguage", "loginGoogle",
  ]) {
    expect(names).toContain(required);
  }
});

test("every fixture is a structurally valid NormalizedTicket", () => {
  for (const { ticket } of ALL_FIXTURES) {
    expect(typeof ticket.title).toBe("string");
    expect(ticket.title.length).toBeGreaterThan(0);
    expect(["jira", "trello", "azure"]).toContain(ticket.source);
    expect(Array.isArray(ticket.comments)).toBe(true);
  }
});

test("loginGoogle mentions google login for inference cases", () => {
  expect(`${loginGoogle.title} ${loginGoogle.description}`.toLowerCase()).toContain("google");
});
