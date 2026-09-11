import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";
import { chmod, mkdtemp, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  doctorCommand,
  parseSetupArgs,
  resolveExecutable,
  runCli,
  runCommand,
  setupCommand,
  statusCommand,
} from "./cli.js";

describe("ticket-analyzer CLI", () => {
  test("default dispatch starts the MCP server", async () => {
    const startServer = jest.fn().mockResolvedValue(undefined);
    await runCli([], { startServer });
    expect(startServer).toHaveBeenCalledTimes(1);
  });

  test("help uses the globally installed binary", async () => {
    const output = [];
    await runCli(["--help"], { stdout: { write: (text) => output.push(text) } });
    const text = output.join(" ");
    expect(text).toContain("ticket-analyzer-mcp 3.0.0");
    expect(text).toContain("ticket-analyzer-mcp setup");
    expect(text).toContain("--configure-clients");
    expect(text).toMatch(/--providers a,b.*trello, jira, azure/i);
    expect(text).toMatch(/--clients a,b.*claude, codex, pi/i);
    expect(text).toMatch(/--dry-run.*complete redacted plan.*needs the flags above/i);
    expect(text).not.toContain("npx");
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

  test.each([
    [[], { configureClients: false, dryRun: false }],
    [["--dry-run"], { configureClients: false, dryRun: true }],
    [["--configure-clients"], { configureClients: true, dryRun: false }],
    [["--dry-run", "--configure-clients"], { configureClients: true, dryRun: true }],
    [["--configure-clients", "--dry-run"], { configureClients: true, dryRun: true }],
  ])("parses client setup flags: %p", (args, expected) => {
    expect(parseSetupArgs(args)).toEqual(expected);
  });

  test.each([
    ["--configure-clients", "--configure-clients"],
    ["--dry-run", "--dry-run"],
    ["--configure-clients", "unexpected"],
  ])("rejects invalid setup arguments: %p", (args) => {
    expect(() => parseSetupArgs(args)).toThrow(/invalid setup argument/i);
  });

  // Without these flags there is no way to reach --dry-run from a shell: the manager
  // requires explicit selections in that mode and refuses to prompt for them.
  test.each([
    [["--providers", "trello"], { providers: ["trello"] }],
    [["--providers=trello,jira,azure"], { providers: ["trello", "jira", "azure"] }],
    [["--clients", "claude,pi"], { clients: ["claude", "pi"] }],
    [["--providers", "jira", "--clients", "codex"], { providers: ["jira"], clients: ["codex"] }],
    [["--providers", "trello,trello"], { providers: ["trello"] }],
  ])("parses explicit setup selections: %p", (args, selections) => {
    expect(parseSetupArgs(args).selections).toEqual(selections);
  });

  test("omits selections entirely when neither flag is given, so prompting still applies", () => {
    expect(parseSetupArgs(["--dry-run"]).selections).toBeUndefined();
  });

  test.each([
    ["--providers", "bitbucket"],
    ["--clients", "vscode"],
    ["--providers", ""],
    ["--providers"],
    ["--providers", "trello", "--providers", "jira"],
  ])("rejects unusable selection arguments: %p", (...args) => {
    expect(() => parseSetupArgs(args)).toThrow(/invalid setup argument/i);
  });


  test("setup dry-run delegates the unified manager instead of legacy client commands", async () => {
    const setupManager = jest.fn().mockResolvedValue(0);

    await expect(runCli(["setup", "--dry-run"], { setupManager })).resolves.toBe(0);

    expect(setupManager).toHaveBeenCalledWith(expect.objectContaining({ configureClients: false, dryRun: true }));
  });


  test("setup compatibility alias delegates the same unified manager contract", async () => {
    const setupManager = jest.fn().mockResolvedValue(0);

    await expect(runCli(["setup", "--configure-clients"], { setupManager })).resolves.toBe(0);

    expect(setupManager).toHaveBeenCalledWith(expect.objectContaining({ configureClients: true, dryRun: false }));
  });



  test("runCommand derives a client-safe environment and uses safe spawn options", async () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const spawnProcess = jest.fn(() => {
      queueMicrotask(() => child.emit("close", 0));
      return child;
    });
    const cwd = "/workspace/project";

    await runCommand("/bin/client", ["configure"], {
      cwd,
      clientEnv: {
        PATH: "/safe/bin",
        HOME: "/home/person",
        USERPROFILE: "C:\\Users\\person",
        TICKET_ANALYZER_ENV_FILE: "/workspace/project/.env",
        TRELLO_API_KEY: "provider-key",
        TRELLO_TOKEN: "provider-token",
        JIRA_HOST: "jira.example.com",
        JIRA_EMAIL: "person@example.com",
        JIRA_API_TOKEN: "jira-token",
        AZURE_DEVOPS_ORG: "org",
        AZURE_DEVOPS_PROJECT: "project",
        AZURE_DEVOPS_PAT: "azure-pat",
        CUSTOM_SECRET: "secret",
        ACCESS_TOKEN: "access-token",
      },
      spawnProcess,
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      "/bin/client",
      ["configure"],
      expect.objectContaining({
        shell: false,
        cwd,
        env: { PATH: "/safe/bin", HOME: "/home/person", USERPROFILE: "C:\\Users\\person" },
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  });



  // The runner hardening below is asserted at the runCommand boundary rather than through a
  // setup path, so the guarantees survive whichever caller drives the child process.
  test("runCommand keeps the env-file path in argv and out of the child environment", async () => {
    const envFile = "/workspace/folder with spaces/project.env";
    const spawnProcess = jest.fn(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => child.emit("close", 0));
      return child;
    });
    const argv = ["mcp", "add", "ticket-analyzer", "--env", `TICKET_ANALYZER_ENV_FILE=${envFile}`, "--", "ticket-analyzer-mcp"];

    await runCommand("/safe/bin/codex", argv, {
      clientEnv: { PATH: "/safe/bin", HOME: "/home/person", TICKET_ANALYZER_ENV_FILE: envFile, JIRA_API_TOKEN: "provider-token" },
      spawnProcess,
    });

    expect(spawnProcess.mock.calls[0][1]).toEqual(argv);
    expect(spawnProcess.mock.calls[0][2].env).toEqual({ PATH: "/safe/bin", HOME: "/home/person" });
  });

  test("runCommand kills a child that exceeds its timeout and reports the bound", async () => {
    jest.useFakeTimers();
    try {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = jest.fn(() => true);
      let resolveStarted;
      const started = new Promise((resolve) => { resolveStarted = resolve; });
      const spawnProcess = jest.fn(() => { resolveStarted(); return child; });

      const settled = runCommand("/bin/codex", ["mcp", "add"], { timeoutMs: 25, spawnProcess }).catch((error) => error);
      await started;
      await jest.advanceTimersByTimeAsync(25);

      expect(await settled).toMatchObject({ message: expect.stringMatching(/timed out after 25ms/i), code: "ETIMEDOUT" });
      expect(child.kill).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("runCommand redacts provider values in child failures", async () => {
    const privateValue = ["provider", "value"].join("-");
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const spawnProcess = jest.fn(() => {
      queueMicrotask(() => {
        child.stderr.emit("data", Buffer.from(`failed with ${privateValue} and token=${privateValue}`));
        child.emit("close", 1);
      });
      return child;
    });

    const failure = await runCommand("/bin/codex", [], { secretValues: [privateValue], spawnProcess }).catch((error) => error);
    expect(failure.message).not.toContain(privateValue);
    expect(failure.message).toContain("[redacted]");
  });

  test("runCommand bounds captured stdout and stderr", async () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const spawnProcess = jest.fn(() => {
      queueMicrotask(() => {
        child.stdout.emit("data", Buffer.from("0123456789abcdefEXTRA"));
        child.stderr.emit("data", Buffer.from("fedcba9876543210EXTRA"));
        child.emit("close", 0);
      });
      return child;
    });

    const result = await runCommand("client", [], { maxOutputBytes: 16, spawnProcess });
    expect(Buffer.byteLength(result.stdout)).toBe(16);
    expect(Buffer.byteLength(result.stderr)).toBe(16);
  });

  test("resolveExecutable treats empty and relative PATH entries as cwd-relative", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    const relativeDirectory = path.join(cwd, "relative-bin");
    await mkdir(relativeDirectory);
    await writeFile(path.join(cwd, "empty-client"), "#!/bin/sh\n");
    await writeFile(path.join(relativeDirectory, "relative-client"), "#!/bin/sh\n");
    await chmod(path.join(cwd, "empty-client"), 0o755);
    await chmod(path.join(relativeDirectory, "relative-client"), 0o755);

    expect(resolveExecutable("empty-client", { PATH: `${path.delimiter}${relativeDirectory}` }, cwd)).toBe(
      path.join(cwd, "empty-client"),
    );
    expect(resolveExecutable("relative-client", { PATH: "relative-bin" }, cwd)).toBe(
      path.join(relativeDirectory, "relative-client"),
    );
  });

  test("resolveExecutable never accepts Windows cmd or bat shims", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    const bin = path.join(cwd, "bin");
    await mkdir(bin);
    await writeFile(path.join(bin, "client.cmd"), "@echo off\r\n");
    await writeFile(path.join(bin, "client.bat"), "@echo off\r\n");

    expect(resolveExecutable("client", { PATH: bin, PATHEXT: ".CMD;.BAT" }, cwd, "win32")).toBeNull();
  });

  test("bare setup and its alias delegate one compatible manager contract", async () => {
    const calls = [];
    const setupManager = jest.fn(async (options) => { calls.push(options); return 0; });
    await expect(runCli(["setup"], { setupManager })).resolves.toBe(0);
    await expect(runCli(["setup", "--configure-clients"], { setupManager })).resolves.toBe(0);
    await expect(runCli(["setup", "--dry-run"], { setupManager })).resolves.toBe(0);
    expect(setupManager).toHaveBeenCalledTimes(3);
    expect(calls[0]).toEqual(expect.objectContaining({ configureClients: false, dryRun: false }));
    expect(calls[1]).toEqual(expect.objectContaining({ configureClients: true, dryRun: false }));
    expect(calls[2]).toEqual(expect.objectContaining({ configureClients: false, dryRun: true }));
  });

  test("setup delegates to the unified manager without an injected manager option", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, "package.json"), "{}\n");
    const output = [];
    const promptAdapter = { providers: jest.fn(), client: jest.fn(), input: jest.fn(), password: jest.fn(), confirm: jest.fn() };

    await expect(setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: false },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
      selections: { providers: [], clients: [] },
      dryRun: true,
    })).resolves.toBe(0);

    expect(output.join(" ")).toMatch(/unified project setup plan/i);
    expect(promptAdapter.providers).not.toHaveBeenCalled();
  });

  test("setup still reports which providers the project is missing after delegating", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, "package.json"), "{}\n");
    await writeFile(path.join(cwd, ".env"), "TRELLO_API_KEY=\nJIRA_HOST=example.com\nAZURE_DEVOPS_PAT=secret\n");
    const output = [];

    await setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: false },
      stdout: { isTTY: false, write: (text) => output.push(text) },
      selections: { providers: [], clients: [] },
      dryRun: true,
    });

    const text = output.join(" ");
    expect(text).toMatch(/no ticket integration is configured/i);
    expect(text).toMatch(/Trello: incomplete \(missing TRELLO_API_KEY, TRELLO_TOKEN\)/i);
    expect(text).toMatch(/Jira: incomplete \(missing JIRA_EMAIL, JIRA_API_TOKEN\)/i);
    expect(text).not.toContain("secret");
  });

  test("setup stays quiet about completeness when a provider is already configured", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, "package.json"), "{}\n");
    await writeFile(path.join(cwd, ".env"), "TRELLO_API_KEY=key\nTRELLO_TOKEN=token\n");
    const output = [];

    await setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: false },
      stdout: { isTTY: false, write: (text) => output.push(text) },
      selections: { providers: [], clients: [] },
      dryRun: true,
    });

    expect(output.join(" ")).not.toMatch(/no ticket integration is configured/i);
  });

  test("setup refuses to mutate from a non-TTY without throwing", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, "package.json"), "{}\n");
    const output = [];

    await expect(setupCommand({
      cwd,
      env: {},
      stdin: { isTTY: false },
      stdout: { isTTY: false, write: (text) => output.push(text) },
    })).resolves.toBe(1);

    expect(output.join(" ")).toMatch(/non-TTY/i);
  });

  test("runCli supplies hardened defaults to the unified setup manager", async () => {
    const setupManager = jest.fn().mockResolvedValue(0);
    await expect(runCli(["setup"], { setupManager })).resolves.toBe(0);
    expect(setupManager).toHaveBeenCalledWith(expect.objectContaining({
      resolveExecutable,
      runCommand,
    }));
  });

test("dry-run with explicit selections renders without prompts, writes, or spawns", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    await writeFile(path.join(cwd, "package.json"), "{}\\n");
    const output = [];
    const promptAdapter = { providers: jest.fn(), client: jest.fn(), input: jest.fn(), password: jest.fn(), confirm: jest.fn() };
    const executeOperation = jest.fn();
    await expect(setupCommand({ cwd, env: {}, stdin: { isTTY: false }, stdout: { write: (text) => output.push(text) }, promptAdapter, selections: { providers: [], clients: [] }, dryRun: true, executeOperation })).resolves.toBe(0);
    expect(output.join(" ")).toMatch(/unified project setup plan/i);
    expect(promptAdapter.providers).not.toHaveBeenCalled();
    expect(promptAdapter.client).not.toHaveBeenCalled();
    expect(promptAdapter.confirm).not.toHaveBeenCalled();
    expect(executeOperation).not.toHaveBeenCalled();
  });

test("runCli rejects arguments for non-setup commands", async () => {
    const output = [];
    await expect(runCli(["status", "unexpected"], { stderr: { write: (text) => output.push(text) } })).resolves.toBe(1);
    expect(output.join(" ")).toMatch(/invalid argument.*status.*unexpected/i);
  });
});
