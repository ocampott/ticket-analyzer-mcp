import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(`${repoRoot}/${relativePath}`, "utf8");
}

function packageJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

describe("2.2.0 release metadata and guidance", () => {
  test("aligns published metadata without changing the independent workflow contract", () => {
    const packageManifest = packageJson("package.json");
    const lockfile = packageJson("package-lock.json");
    const lockRoot = (lockfile.packages as Record<string, Record<string, unknown>>)[""];

    expect(packageManifest.version).toBe("2.2.0");
    expect(lockfile.version).toBe("2.2.0");
    expect(lockRoot.version).toBe("2.2.0");
    expect(read("src/index.ts")).toMatch(/version: "2\.2\.0"/);
    expect(read("bin/cli.js")).toMatch(/const VERSION = "2\.2\.0"/);
    expect(read("extensions/ticket-analyzer.js")).toMatch(/version: "2\.2\.0"/);
    expect(packageJson(".claude-plugin/plugin.json").version).toBe("2.2.0");
    expect((packageJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0].version).toBe("2.2.0");
    expect(read("AGENTS.md")).toMatch(/Instruction contract version: 3\.0\.0/);
  });

  test("generates the confirmed Claude marketplace command", () => {
    const cli = read("bin/cli.js");

    expect(cli).toContain("claude plugin marketplace add ocampott/ticket-analyzer-mcp");
    expect(cli).toContain("claude plugin install ticket-analyzer@ticket-analyzer-mcp");
    expect(cli).not.toContain("--source github");
    expect(cli).not.toContain("--repo ocampott/ticket-analyzer-mcp");
  });

  test("keeps active update guidance aligned with client behavior", () => {
    const readme = read("README.md");
    const piDocs = read("docs/pi-install.md");
    const codexDocs = read("docs/codex-install.md");
    const setupSkill = read("skills/setup/SKILL.md");

    expect(readme).toContain("npx -y ticket-analyzer-mcp@latest setup");
    expect(readme).toContain("claude plugin marketplace update ticket-analyzer-mcp");
    expect(readme).toContain("pi update npm:ticket-analyzer-mcp");
    expect(piDocs).toContain("pi update npm:ticket-analyzer-mcp");
    expect(codexDocs).toContain("npx -y ticket-analyzer-mcp@latest");
    expect(setupSkill).toContain("npx -y ticket-analyzer-mcp@latest setup");
    expect(readme).not.toMatch(/ticket-analyzer-mcp\s+update\b/);
  });

  test("keeps local setup and Pi install commands in checkout/consumer order", () => {
    const readme = read("README.md");
    const piDocs = read("docs/pi-install.md");
    const codexDocs = read("docs/codex-install.md");
    const localSetup = [
      "cd /absolute/path/to/ticket-analyzer-mcp",
      "npm install",
      "npm run build",
      "cd /absolute/path/to/your-project",
      "node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup",
    ].join("\n");
    const localPiInstall = [
      "cd /absolute/path/to/ticket-analyzer-mcp",
      "npm install",
      "npm run build",
      "cd /absolute/path/to/your-project",
      "pi install -l /absolute/path/to/ticket-analyzer-mcp",
    ].join("\n");

    expect(readme).toContain(localSetup);
    expect(codexDocs).toContain(localSetup);
    expect(readme).toContain(localPiInstall);
    expect(piDocs).toContain(localPiInstall);
    expect(readme).toContain("pi install -l npm:ticket-analyzer-mcp@NEW_VERSION");
    expect(piDocs).toContain("pi install -l npm:ticket-analyzer-mcp@NEW_VERSION");
  });
});
