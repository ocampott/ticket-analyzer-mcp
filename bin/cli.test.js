import { jest } from "@jest/globals";
import { mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  doctorCommand,
  runCli,
  setupCommand,
  statusCommand,
} from "./cli.js";

describe("ticket-analyzer CLI", () => {
  test("default dispatch starts the MCP server", async () => {
    const startServer = jest.fn().mockResolvedValue(undefined);
    await runCli([], { startServer });
    expect(startServer).toHaveBeenCalledTimes(1);
  });

  test("setup refuses non-interactive stdin before reading credentials", async () => {
    const output = [];
    await expect(
      setupCommand({
        stdin: { isTTY: false },
        stdout: { write: (text) => output.push(text) },
      }),
    ).rejects.toThrow(/interactive terminal/i);
    expect(output.join(" ")).toMatch(/run .* setup/i);
  });

  test("setup preserves unrelated keys, uses mode 0600, and never prints secrets", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, ".env"), "KEEP_ME=untouched\nJIRA_HOST=old.example.com\n");
    const output = [];
    const values = ["new.example.com", "person@example.com", "super-secret-token"];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue(["jira"]),
      input: jest.fn().mockImplementation(async () => values.shift()),
      password: jest.fn().mockImplementation(async () => values.shift()),
      client: jest.fn().mockResolvedValue("pi"),
    };

    await setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
    });

    const content = await readFile(path.join(cwd, ".env"), "utf8");
    expect(content).toContain("KEEP_ME=untouched");
    expect(content).toContain('JIRA_HOST="new.example.com"');
    expect(content).toContain('JIRA_EMAIL="person@example.com"');
    expect(content).toContain('JIRA_API_TOKEN="super-secret-token"');
    expect(output.join(" ")).not.toContain("super-secret-token");
    expect(promptAdapter.providers).toHaveBeenCalledTimes(1);
    expect(promptAdapter.client).toHaveBeenCalledTimes(1);
    const text = output.join(" ");
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    expect(text).toContain(`Next step for Pi: pi install -l ${packageRoot}`);
    expect(text).toMatch(/If Pi already lists this path, reload Pi instead/i);
    expect(text).not.toContain("npm:ticket-analyzer-mcp@2.2.0");
    expect((await stat(path.join(cwd, ".env"))).mode & 0o777).toBe(0o600);
  });

  test("setup prints grouped next steps for every selected client", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
        const output = [];
        const promptAdapter = {
          providers: jest.fn().mockResolvedValue([]),
          client: jest.fn().mockResolvedValue(["claude", "codex", "pi"]),
        };

        await setupCommand({
          cwd,
          env: {},
          stdin: { isTTY: true },
          stdout: { write: (text) => output.push(text) },
          promptAdapter,
        });

        const text = output.join(" ");
        expect(text).toMatch(/Next steps.*does not execute client CLIs or change client settings/i);
        expect(text).toMatch(/Next step for Claude Code:/i);
        expect(text).toMatch(/Next step for Codex:/i);
        expect(text).toMatch(/Next step for Pi:/i);
        expect(promptAdapter.client).toHaveBeenCalledTimes(1);
      });

      test("setup reports when credentials are ready but no client is selected", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
        const output = [];
        const promptAdapter = {
          providers: jest.fn().mockResolvedValue([]),
          client: jest.fn().mockResolvedValue([]),
        };

        await setupCommand({
          cwd,
          env: {},
          stdin: { isTTY: true },
          stdout: { write: (text) => output.push(text) },
          promptAdapter,
        });

        expect(output.join(" ")).toMatch(/credentials are ready locally but no agent client has been configured yet/i);
      });

      test("setup explains provider credentials without exposing their values", async () => {
        const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
        const output = [];
        const values = ["example", "project", "azure-secret-pat"];
        const promptAdapter = {
          providers: jest.fn().mockResolvedValue(["azure"]),
          input: jest.fn().mockImplementation(async () => values.shift()),
          password: jest.fn().mockImplementation(async () => values.shift()),
          client: jest.fn().mockResolvedValue([]),
        };

        await setupCommand({
          cwd,
          env: {},
          stdin: { isTTY: true },
          stdout: { write: (text) => output.push(text) },
          promptAdapter,
        });

        const text = output.join(" ");
        expect(text).toMatch(/Azure DevOps.*work items/i);
        expect(text).toMatch(/Work Items: Read/i);
        expect(text).toMatch(/Work Items: Read & Write.*comments/i);
        expect(text).not.toContain("azure-secret-pat");
      });

      test("setup uses the local source for Codex registration", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    const packageRoot = path.resolve(cwd, "ticket-analyzer-mcp-checkout");
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue("codex"),
    };

    await setupCommand({
      cwd,
      packageRoot,
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
    });

    const text = output.join(" ");
    expect(text).toContain(`-- node ${path.join(packageRoot, "bin", "pm-mcp.js")}`);
    expect(text).not.toContain("npx -y ticket-analyzer-mcp@2.2.0");
  });

  test("setup keeps npm guidance for a package installed under node_modules", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    const packageRoot = path.join(cwd, "node_modules", "ticket-analyzer-mcp");
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue("codex"),
    };

    await setupCommand({
      cwd,
      packageRoot,
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
    });

    const text = output.join(" ");
    expect(text).toContain("-- npx -y ticket-analyzer-mcp@2.2.0");
    expect(text).not.toContain(path.join(packageRoot, "bin", "pm-mcp.js"));
  });

  test("setup keeps npm guidance for Pi from a package installed under node_modules", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    const packageRoot = path.join(cwd, "node_modules", "ticket-analyzer-mcp");
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue("pi"),
    };

    await setupCommand({
      cwd,
      packageRoot,
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
    });

    const text = output.join(" ");
    expect(text).toContain("Next step for Pi: pi install -l npm:ticket-analyzer-mcp@2.2.0");
    expect(text).not.toContain(packageRoot);
  });

  test("setup does not warn when no providers are selected but an existing provider is complete", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, ".env"), "AZURE_DEVOPS_ORG=example\nAZURE_DEVOPS_PROJECT=project\nAZURE_DEVOPS_PAT=secret\n");
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue("later"),
    };

    await setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
    });

    expect(output.join(" ")).not.toMatch(/no ticket integration is configured/i);
    expect(output.join(" ")).not.toContain("secret");
  });

  test("setup warns when no providers are selected and no provider is complete", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(
      path.join(cwd, ".env"),
      "TRELLO_API_KEY=\nJIRA_HOST=example.com\nAZURE_DEVOPS_PAT=secret\n",
    );
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue("later"),
    };

    await setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
    });

    const text = output.join(" ");
    expect(text).toMatch(/no ticket integration is configured/i);
    expect(text).toMatch(/add the required provider values to the project \.env/i);
    expect(text).toMatch(/Trello: incomplete \(missing TRELLO_API_KEY, TRELLO_TOKEN\)/i);
    expect(text).toMatch(/Jira: incomplete \(missing JIRA_EMAIL, JIRA_API_TOKEN\)/i);
    expect(text).toMatch(/Azure DevOps: incomplete \(missing AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT\)/i);
    expect(text).not.toContain("secret");
  });

  test("status reports when the project env file exists", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, ".env"), "AZURE_DEVOPS_ORG=example\nAZURE_DEVOPS_PROJECT=project\nAZURE_DEVOPS_PAT=token\n");
    const output = [];

    await statusCommand({ cwd, env: {}, stdout: { write: (text) => output.push(text) } });

    expect(output.join(" ")).toMatch(/\.env: found at/i);
    expect(output.join(" ")).toMatch(/Azure DevOps: configured locally/i);
  });

  test("status is configuration-only", async () => {
    const output = [];
    const networkCall = jest.fn().mockRejectedValue(new Error("network must not be used"));
    await statusCommand({
      env: { JIRA_HOST: "example.com", JIRA_EMAIL: "person@example.com" },
      stdout: { write: (text) => output.push(text) },
      providerStatus: { jira: networkCall },
    });
    expect(networkCall).not.toHaveBeenCalled();
    expect(output.join(" ")).toMatch(/Jira.*missing.*JIRA_API_TOKEN/i);
  });

  test("doctor reports provider responses without exposing credentials", async () => {
    const output = [];
    await doctorCommand({
      env: {
        JIRA_HOST: "example.com",
        JIRA_EMAIL: "person@example.com",
        JIRA_API_TOKEN: "super-secret-token",
      },
      stdout: { write: (text) => output.push(text) },
      providerStatus: {
        trello: async () => ({ configured: false, connected: false }),
        jira: async () => ({ configured: true, connected: false, host: "example.com", error: "invalid credentials" }),
        azure: async () => ({ configured: false, connected: false }),
      },
    });
    expect(output.join(" ")).toMatch(/Jira.*error.*invalid credentials/i);
    expect(output.join(" ")).not.toContain("super-secret-token");
  });
});
