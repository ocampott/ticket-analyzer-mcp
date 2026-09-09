import { readFileSync } from "node:fs";
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

describe("2.3.0 release metadata and guidance", () => {
  test("aligns published metadata without changing the independent workflow contract", () => {
    const packageManifest = packageJson("package.json");
    const lockfile = packageJson("package-lock.json");
    const lockRoot = (lockfile.packages as Record<string, Record<string, unknown>>)[""];

    expect(packageManifest.version).toBe("2.3.0");
    expect(lockfile.version).toBe("2.3.0");
    expect(lockRoot.version).toBe("2.3.0");
    expect(read("src/index.ts")).toContain('version: "2.3.0"');
    expect(read("bin/cli.js")).toContain('const VERSION = "2.3.0"');
    expect(read("extensions/ticket-analyzer.js")).toContain('version: "2.3.0"');
    expect(packageJson(".claude-plugin/plugin.json").version).toBe("2.3.0");
    expect((packageJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0].version).toBe("2.3.0");
    expect(read("AGENTS.md")).toMatch(/Instruction contract version: 3\.0\.0/);
  });

  test("generates the confirmed Claude marketplace command", () => {
    const cli = read("bin/cli.js");

    expect(cli).toContain("claude plugin marketplace add ocampott/ticket-analyzer-mcp");
    expect(cli).toContain("claude plugin install ticket-analyzer@ticket-analyzer-mcp");
    expect(cli).not.toContain("--source github");
    expect(cli).not.toContain("--repo ocampott/ticket-analyzer-mcp");
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

    expect(cli).toContain("pi install -l npm:ticket-analyzer-mcp@2.3.0");
    expect(cli).toContain('const serverCommand = "ticket-analyzer-mcp"');
    expect(cli).not.toContain("npx");
    expect(cli).toContain("TICKET_ANALYZER_ENV_FILE");
    expect(cli).not.toMatch(/packageRoot|PACKAGE_ROOT|resolvePackageRoot|isPublishedPackageRoot|fileURLToPath/);
    expect(cli).not.toContain("pm-mcp.js");
  });

  test("uses the globally installed binary in the MCP template without credentials", () => {
    const mcp = JSON.parse(read(".mcp.json")) as {
      mcpServers: { pm: { command: string; args: string[] } };
    };

    expect(mcp.mcpServers.pm.command).toBe("ticket-analyzer-mcp");
    expect(mcp.mcpServers.pm.args).toEqual([]);
    expect(read(".mcp.json")).not.toContain("npx");
    expect(read(".mcp.json")).not.toMatch(/TRELLO_|JIRA_|AZURE_DEVOPS_|TOKEN|PAT|SECRET/i);
  });

  test("keeps the centralized npm policy and client guidance aligned", () => {
    const readme = read("README.md");
    const piDocs = read("docs/pi-install.md");
    const codexDocs = read("docs/codex-install.md");
    const workflowDocs = read("docs/agent-workflow.md");
    const setupSkill = read("skills/setup/SKILL.md");
    const codexAdapter = read("integrations/codex/README.md");

    expect(readme).toContain("npm install --global ticket-analyzer-mcp@2.3.0");
    expect(readme).toContain("npm update --global ticket-analyzer-mcp");
    expect(readme).toContain("Without --global: version isolated per project.");
    expect(readme).toContain("With --global: one central version for the whole machine.");
    expect(readme).toContain("-- ticket-analyzer-mcp");
    expect(readme).toContain("pi install -l npm:ticket-analyzer-mcp@2.3.0");
    expect(readme).not.toContain("npx");

    for (const doc of [piDocs, codexDocs, workflowDocs, setupSkill, codexAdapter]) {
      expect(doc).toContain("npm install --global ticket-analyzer-mcp@2.3.0");
      expect(doc).toContain("npm update --global ticket-analyzer-mcp");
      expect(doc).not.toContain("npx");
    }
    expect(codexDocs).toContain("-- ticket-analyzer-mcp");
    expect(codexAdapter).toContain("-- ticket-analyzer-mcp");
    expect(readme).toContain("claude plugin marketplace update ticket-analyzer-mcp");
    expect(piDocs).toContain("pi update npm:ticket-analyzer-mcp");
    expect(readme).not.toMatch(/ticket-analyzer-mcp\s+update\b/);
  });

  test("publishes the bilingual opt-in client wizard guidance", () => {
    const readme = read("README.md");

    expect(readme).toContain("### Configuración opt-in de clientes");
    expect(readme).toContain("### Opt-in client configuration wizard");
    expect(readme).toContain("ticket-analyzer-mcp setup --configure-clients");
    expect(readme).toContain("ticket-analyzer-mcp setup --configure-clients --dry-run");
    expect(readme).toMatch(/plan no secreto/i);
    expect(readme).toMatch(/limited environment and no provider credentials/i);
    expect(readme).toMatch(/may write `\.env` when providers are selected/i);
    expect(readme).toMatch(/does not inspect, replace, or remove existing registrations/i);
  });

  test("keeps the release changelog current and historically ordered", () => {
    const changelog = read("CHANGELOG.md");

    expect(changelog.startsWith("# Changelog\n\n## [2.3.0] - 2026-09-09")).toBe(true);
    expect(changelog.indexOf("## [2.3.0]")).toBeLessThan(changelog.indexOf("## [2.2.2]"));
    expect(changelog).toMatch(/client configuration wizard/i);
    expect(changelog).toMatch(/dry-run/i);
    expect(changelog).toMatch(/safe command execution/i);
    expect(changelog).toMatch(/global MCP manifest/i);
  });

  test("aligns the active Codex adapter snapshots without changing their contract", () => {
    for (const doc of ["integrations/codex/AGENTS.md", "integrations/codex/AGENTS.template.md"]) {
      const contents = read(doc);
      expect(contents).toContain("2.3.0");
      expect(contents).toContain("3.0.0");
      expect(contents).not.toContain("2.2.2");
    }
    expect(read("AGENTS.md")).toContain("Instruction contract version: 3.0.0");
  });
});
