import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(`${repoRoot}/${relativePath}`, "utf8");
}

const instructionPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "skills/analyze-ticket/SKILL.md",
  "skills/analize/SKILL.md",
  "integrations/codex/AGENTS.template.md",
  "integrations/codex/AGENTS.md",
  "docs/agent-workflow.md",
];

describe("shipped ticket-analysis workflow", () => {
  test("canonical workflow requires complete, evidence-grounded coverage", () => {
    const canonical = read("AGENTS.md");
    const toolSource = read("src/index.ts");

    expect(canonical).toMatch(/all ticket evidence/i);
    expect(canonical).toMatch(/refinement decisions/i);
    expect(canonical).toMatch(/already exists/i);
    expect(canonical).toMatch(/necessary delta/i);
    expect(canonical).toMatch(/complete plan/i);
    expect(canonical).toMatch(/proportional verification/i);
    expect(canonical).toMatch(/implementation-changing questions/i);
    expect(canonical).toMatch(/repository-unverified/i);
    expect(canonical).toMatch(/deterministic.*not.*final.*implementation plan/is);
    expect(canonical).toMatch(/bounded cache-only consent/i);
    expect(canonical).toMatch(/fresh.*revision|revision.*fresh/i);
    expect(canonical).toMatch(/dirty/i);
    expect(canonical).toMatch(/analyze.*cache-write.*distinct/is);
    expect(canonical).toMatch(/never fabricate/i);
    expect(canonical).toMatch(/justified assumptions/i);
    expect(toolSource).toMatch(/deterministic ticket-only evidence/i);
    expect(toolSource).toMatch(/repository-unverified inferences/i);
    expect(toolSource).toMatch(/not a final implementation plan/i);
  });

  test("every shipped workflow variant states the complete privacy boundary", () => {
    for (const path of instructionPaths) {
      const instructions = read(path);

      expect(instructions).toMatch(
        /cache only verified, reusable repository patterns.*never persist raw ticket descriptions, comments, or attachments, credentials or secrets, sensitive ticket or person identifiers, or private external context.*never fabricate source references or revisions.*never promote guesses to facts/is,
      );
      expect(instructions).toMatch(/exact repository-relative source paths and symbols/i);
      expect(instructions).toMatch(/cache-only consent/i);
      expect(instructions).toMatch(/ignored|ignore/i);
    }
  });

  test("standalone adapters carry the necessary-change and cache boundary", () => {
    for (const path of instructionPaths.slice(1)) {
      const instructions = read(path);
      expect(instructions).toMatch(/complete necessary|completo necesario/i);
      expect(instructions).toMatch(/cache-only consent/i);
      expect(instructions).toMatch(/repository-unverified/i);
    }
  });

  test("natural-language analysis remains self-contained without package instructions", () => {
    const naturalLanguage = read("skills/analyze-ticket/SKILL.md");

    expect(naturalLanguage).toMatch(/package canonical.*AGENTS\.md.*package canonical workflow is unavailable.*standalone contract/is);
    expect(naturalLanguage).toMatch(/package canonical.*AGENTS\.md.*consuming repository.*local safety.*project instructions.*consumer file as package authority/is);
    expect(naturalLanguage).toMatch(/## Análisis y estimación/);
    expect(naturalLanguage).toMatch(/## Detalle técnico/);
    expect(naturalLanguage).toMatch(/## Plan de implementación/);
    expect(naturalLanguage).toMatch(/Azure.*Frontend.*Backend.*QA.*Infra/is);
    expect(naturalLanguage).toMatch(/Jira.*Trello|Trello.*Jira/is);
    expect(naturalLanguage).toMatch(/every requested behavior and restriction.*evidence.*necessary delta/is);
    expect(naturalLanguage).toMatch(/every implementation step names an exact path/is);
    expect(naturalLanguage).toMatch(/complete necessary change/i);
    expect(naturalLanguage).toMatch(/cache only verified, reusable repository patterns/is);
  });

  test("Codex copying distinguishes package authority from consumer instructions", () => {
    for (const path of [
      "integrations/codex/AGENTS.template.md",
      "integrations/codex/AGENTS.md",
    ]) {
      const instructions = read(path);
      expect(instructions).toMatch(/package canonical.*AGENTS\.md/is);
      expect(instructions).toMatch(/consumer.*AGENTS\.md.*local instructions/is);
      expect(instructions).toMatch(/do not treat.*consumer.*AGENTS\.md.*package authority/is);
    }
  });

  test("the guidance calibrates a proven backend countercase without hardcoding frontend-only", () => {
    const workflow = read("docs/agent-workflow.md");

    expect(workflow).toMatch(/synthetic.*action bar.*role/is);
    expect(workflow).toMatch(/backend.*proven|proven.*backend/is);
    expect(workflow).toMatch(/already exists.*necessary delta/is);
    expect(workflow).toMatch(/not.*keyword|keyword.*not/is);
  });

  test("standalone instructions do not minimize a necessary change", () => {
    for (const path of instructionPaths) {
      expect(read(path)).not.toMatch(/smallest change|minimal file|minimum change/i);
    }
  });
});
