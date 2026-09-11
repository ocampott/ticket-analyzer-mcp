import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(`${repoRoot}/${relativePath}`, "utf8");
}

function packageJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

const ACTIVE_USER_DOCS = [
  "README.md",
  "docs/codex-install.md",
  "docs/pi-install.md",
  "integrations/codex/README.md",
  "docs/agent-workflow.md",
  "skills/setup/SKILL.md",
];

// The suites run against the working tree, where every module exists. Only the packed
// tarball can prove that `files` still covers what the binary actually imports.
function packedFiles(): string[] {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: repoRoot, encoding: "utf8" });
  return (JSON.parse(output) as Array<{ files: Array<{ path: string }> }>)[0].files.map((entry) => entry.path);
}

function reachableFrom(entry: string): Set<string> {
  const reachable = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const [, specifier] of read(current).matchAll(/from\s+"(\.[^"]+)"/g)) {
      pending.push(path.posix.join(path.posix.dirname(current), specifier));
    }
  }
  return reachable;
}

describe("published package completeness", () => {
  test("ships every module the binary imports", () => {
    const published = new Set(packedFiles());
    const entry = (packageJson("package.json").bin as Record<string, string>)["ticket-analyzer-mcp"];

    for (const module of reachableFrom(entry)) {
      expect([module, published.has(module)]).toEqual([module, true]);
    }
  });
});

describe("documented commands are runnable", () => {
  test("never advertises a dry-run without the selections it requires", () => {
    for (const doc of ACTIVE_USER_DOCS) {
      for (const [invocation] of read(doc).matchAll(/ticket-analyzer-mcp setup[^\n`]*--dry-run[^\n`]*/g)) {
        expect([doc, invocation.includes("--providers") && invocation.includes("--clients")]).toEqual([doc, true]);
      }
    }
  });
});

describe("3.0.0 release metadata and guidance", () => {
  test("aligns published metadata without changing the independent workflow contract", () => {
    const packageManifest = packageJson("package.json");
    const lockfile = packageJson("package-lock.json");
    const lockRoot = (lockfile.packages as Record<string, Record<string, unknown>>)[""];

    expect(packageManifest.version).toBe("3.0.0");
    expect(lockfile.version).toBe("3.0.0");
    expect(lockRoot.version).toBe("3.0.0");
    expect(read("src/index.ts")).toContain('version: "3.0.0"');
    expect(read("bin/cli.js")).toContain('const VERSION = "3.0.0"');
    expect(read("extensions/ticket-analyzer.js")).toContain('version: "3.0.0"');
    expect(packageJson(".claude-plugin/plugin.json").version).toBe("3.0.0");
    expect((packageJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0].version).toBe("3.0.0");
    expect(read("AGENTS.md")).toMatch(/Instruction contract version: 3\.0\.0/);
  });

  test("generates the confirmed Claude marketplace command", () => {
    const skill = read("skills/setup/SKILL.md");

    expect(skill).toContain("claude plugin marketplace add ocampott/ticket-analyzer-mcp");
    expect(skill).toContain("claude plugin install ticket-analyzer@ticket-analyzer-mcp");
    expect(skill).not.toContain("--source github");
    expect(skill).not.toContain("--repo ocampott/ticket-analyzer-mcp");
  });

  test("requires global npm distribution for every active user setup and install guide", () => {
    const forbiddenLocalCommands = [
      /node\s+\/absolute\/path\/to\/ticket-analyzer-mcp/,
      /pi install -l \/absolute\/path\/to\/ticket-analyzer-mcp/,
      /cd \/absolute\/path\/to\/ticket-analyzer-mcp/,
    ];

    for (const doc of [
      ...ACTIVE_USER_DOCS,
      "integrations/codex/README.md",
      "integrations/codex/AGENTS.md",
      "integrations/codex/AGENTS.template.md",
    ]) {
      const contents = read(doc);
      for (const pattern of forbiddenLocalCommands) {
        expect(contents).not.toMatch(pattern);
      }
      expect(contents).not.toContain("npx");
    }
  });

  test("keeps CLI setup published-only and removes local package-root logic", () => {
    const cli = read("bin/cli.js");

    expect(cli).not.toContain("npx");
    expect(cli).toContain("TICKET_ANALYZER_ENV_FILE");
    expect(cli).not.toMatch(/packageRoot|PACKAGE_ROOT|resolvePackageRoot|isPublishedPackageRoot|fileURLToPath/);
    expect(cli).not.toContain("pm-mcp.js");
  });

  test("pins the published package names where the setup manager now owns them", () => {
    expect(read("skills/setup/SKILL.md")).toContain("pi install -l npm:ticket-analyzer-mcp@3.0.0");
    expect(read("bin/setup-adapters.js")).toContain('export const PI_PACKAGE_NAME = "ticket-analyzer-mcp"');
    expect(read("bin/setup-files.js")).toContain('export const CODEX_COMMAND = "ticket-analyzer-mcp"');
  });

  test("uses the globally installed binary in the MCP template without credentials", () => {
    const mcp = JSON.parse(read(".mcp.json")) as {
      mcpServers: Record<string, { command: string; args: string[]; env?: unknown }>;
    };

    expect(Object.keys(mcp.mcpServers)).toEqual(["ticket-analyzer"]);
    expect(mcp.mcpServers["ticket-analyzer"].command).toBe("ticket-analyzer-mcp");
    expect(mcp.mcpServers["ticket-analyzer"].args).toEqual([]);
    expect(mcp.mcpServers["ticket-analyzer"].env).toBeUndefined();
    expect(read(".mcp.json")).not.toContain("npx");
    expect(read(".mcp.json")).not.toMatch(/TRELLO_|JIRA_|AZURE_DEVOPS_|TOKEN|PAT|SECRET/i);
    expect(read(".mcp.json")).not.toMatch(/\/(?:Users|home)\//);
  });

  test("keeps the Pi runtime credential-free and bound only to the env file", () => {
    const extension = read("extensions/ticket-analyzer.js");

    expect(extension).toContain('export const ENV_FILE_VARIABLE = "TICKET_ANALYZER_ENV_FILE"');
    expect(extension).not.toMatch(/TRELLO_|JIRA_|AZURE_DEVOPS_/);
  });

  test("keeps the centralized npm policy and client guidance aligned", () => {
    const readme = read("README.md");
    const piDocs = read("docs/pi-install.md");
    const codexDocs = read("docs/codex-install.md");
    const workflowDocs = read("docs/agent-workflow.md");
    const setupSkill = read("skills/setup/SKILL.md");
    const codexAdapter = read("integrations/codex/README.md");

    expect(readme).toContain("npm install --global ticket-analyzer-mcp@3.0.0");
    expect(readme).toContain("npm update --global ticket-analyzer-mcp");
    expect(readme).toContain("Without --global: version isolated per project.");
    expect(readme).toContain("With --global: one central version for the whole machine.");
    expect(readme).not.toContain("npx");

    for (const doc of [piDocs, codexDocs, workflowDocs, setupSkill, codexAdapter]) {
      expect(doc).toContain("npm install --global ticket-analyzer-mcp@3.0.0");
      expect(doc).toContain("npm update --global ticket-analyzer-mcp");
      expect(doc).not.toContain("npx");
    }
    expect(codexDocs).toContain("-- ticket-analyzer-mcp");
    expect(codexAdapter).toContain("-- ticket-analyzer-mcp");
    expect(piDocs).toContain("pi update npm:ticket-analyzer-mcp");
    expect(readme).not.toMatch(/ticket-analyzer-mcp\s+update\b/);
  });

  test("publishes the bilingual unified setup guidance", () => {
    const readme = read("README.md");

    expect(readme).toContain("### Cómo funciona `setup`");
    expect(readme).toContain("### How `setup` works");
    expect(readme).toContain("ticket-analyzer-mcp setup --dry-run");
    expect(readme).toMatch(/una sola confirmación para todo el plan/i);
    expect(readme).toMatch(/one confirmation covering the whole plan/i);
    expect(readme).toMatch(/limited environment and no provider credentials/i);
    expect(readme).toMatch(/alias de compatibilidad/i);
    expect(readme).toMatch(/compatibility alias/i);
  });

  test("states the safety boundaries the manager actually keeps", () => {
    const readme = read("README.md");

    expect(readme).toMatch(/--dry-run` muestra el mismo plan y no escribe nada/i);
    expect(readme).toMatch(/--dry-run` prints the same plan and writes nothing/i);
    expect(readme).toMatch(/no revierte nada automáticamente/i);
    expect(readme).toMatch(/rolls nothing back automatically/i);
    expect(readme).toMatch(/propio, coincidente, ajeno, ausente o desconocido/i);
    expect(readme).toMatch(/owned, matching, foreign, absent, or unknown/i);
  });

  test("puts the setup flow before labeled manual recovery guidance", () => {
    const readme = read("README.md");
    const spanishFlow = readme.indexOf("### Cómo funciona `setup`");
    const spanishManual = readme.indexOf("### Configuración manual");
    const englishFlow = readme.indexOf("### How `setup` works");
    const englishManual = readme.indexOf("### Manual recovery");

    expect(spanishFlow).toBeGreaterThanOrEqual(0);
    expect(spanishManual).toBeGreaterThan(spanishFlow);
    expect(englishFlow).toBeGreaterThanOrEqual(0);
    expect(englishManual).toBeGreaterThan(englishFlow);
    expect(readme).toMatch(/Configuración manual[\s\S]*cliente no está disponible[\s\S]*Codex/);
    expect(readme).toMatch(/Manual recovery[\s\S]*client is unavailable[\s\S]*Codex/);
    expect(readme).toMatch(/never replaces an existing registration without an explicit decision/i);
  });

  test("keeps the release changelog current and historically ordered", () => {
    const changelog = read("CHANGELOG.md");

    expect(changelog.startsWith("# Changelog\n\n## [3.0.0] - 2026-09-10")).toBe(true);
    expect(changelog.indexOf("## [3.0.0]")).toBeLessThan(changelog.indexOf("## [2.2.2]"));
  });

  test("declares the breaking changes that make this release major", () => {
    // Content guards must read the current entry. Matching the whole file lets a removed
    // behavior keep passing forever on the historical entry that introduced it.
    const current = read("CHANGELOG.md").split("## [2.3.1]")[0];

    expect(current).toMatch(/\*\*Breaking\.\*\*/);
    expect(current).toMatch(/TICKET_ANALYZER_ENV_FILE/);
    expect(current).toMatch(/--configure-clients/);
    expect(current).toMatch(/ERR_MODULE_NOT_FOUND/);
    expect(current).toMatch(/dry-run/i);
  });

  test("aligns the active Codex adapter snapshots without changing their contract", () => {
    for (const doc of ["integrations/codex/AGENTS.md", "integrations/codex/AGENTS.template.md"]) {
      const contents = read(doc);
      expect(contents).toContain("3.0.0");
      expect(contents).not.toContain("2.2.2");
    }
    expect(read("AGENTS.md")).toContain("Instruction contract version: 3.0.0");
  });
});
