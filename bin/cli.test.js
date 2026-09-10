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
    expect(text).toContain("ticket-analyzer-mcp 2.3.1");
    expect(text).toContain("ticket-analyzer-mcp setup");
    expect(text).toContain("--configure-clients");
    expect(text).toMatch(/--dry-run.*complete redacted plan.*without prompts or mutations/i);
    expect(text).not.toContain("npx");
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
    expect(text).toContain("Next step for Pi: pi install -l npm:ticket-analyzer-mcp@2.3.1");
    expect(text).not.toMatch(/node .*ticket-analyzer-mcp.*pm-mcp\.js/);
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

      test("setup always uses the published npm package for Codex registration", async () => {
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
    expect(text).toContain("-- ticket-analyzer-mcp");
    expect(text).not.toMatch(/node .*ticket-analyzer-mcp.*pm-mcp\.js/);
  });

  test("setup keeps published npm guidance for Codex", async () => {
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
    expect(text).toContain("-- ticket-analyzer-mcp");
    expect(text).not.toContain(path.join(packageRoot, "bin", "pm-mcp.js"));
  });

  test("setup keeps published npm guidance for Pi", async () => {
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
    expect(text).toContain("Next step for Pi: pi install -l npm:ticket-analyzer-mcp@2.3.1");
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

  test("legacy setup never detects or executes client commands", async () => {
    const output = [];
    const resolveExecutable = jest.fn();
    const runCommand = jest.fn();
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["claude"]),
      confirmClient: jest.fn(),
    };

    await setupCommand({
      cwd: await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")),
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
      resolveExecutable,
      runCommand,
    });

    expect(resolveExecutable).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
    expect(promptAdapter.confirmClient).not.toHaveBeenCalled();
    expect(output.join(" ")).toMatch(/does not execute client CLIs/i);
  });

  test("dry-run prints a plan without confirmations or child processes", async () => {
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["claude", "codex", "pi"]),
      confirmClient: jest.fn(),
    };
    const runCommand = jest.fn();

    await setupCommand({
      cwd: await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")),
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
      configureClients: true,
      dryRun: true,
      resolveExecutable: jest.fn().mockImplementation((name) => `/usr/local/bin/${name}`),
      runCommand,
    });

    const text = output.join(" ");
    expect(text).toMatch(/client configuration plan/i);
    expect(text).toMatch(/available.*Claude Code/i);
    expect(text).toContain("claude plugin marketplace add ocampott/ticket-analyzer-mcp");
    expect(text).toContain("codex mcp add ticket-analyzer");
    expect(text).toContain("pi install -l npm:ticket-analyzer-mcp@2.3.1");
    expect(text).toMatch(/dry-run.*does not configure clients/i);
    expect(promptAdapter.confirmClient).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("unavailable clients are reported without confirmation and remain nonfatal", async () => {
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["codex"]),
      confirmClient: jest.fn(),
    };
    const runCommand = jest.fn();

    const result = await setupCommand({
      cwd: await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")),
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
      configureClients: true,
      resolveExecutable: jest.fn().mockReturnValue(null),
      runCommand,
    });

    expect(result).toBe(0);
    expect(output.join(" ")).toMatch(/unavailable.*OpenAI Codex/i);
    expect(promptAdapter.confirmClient).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("executes only confirmed clients with exact argument vectors and shell disabled", async () => {
    const output = [];
    const calls = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["claude", "codex", "pi"]),
      confirmClient: jest.fn().mockImplementation(({ client }) => client !== "codex"),
    };
    const runCommand = jest.fn(async (file, args, options) => {
      calls.push({ file, args, options });
    });

    const result = await setupCommand({
      cwd: await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")),
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
      configureClients: true,
      resolveExecutable: jest.fn().mockImplementation((name) => `/bin/${name}`),
      runCommand,
    });

    expect(result).toBe(0);
    expect(promptAdapter.confirmClient).toHaveBeenCalledTimes(3);
    expect(calls).toEqual([
      {
        file: "/bin/claude",
        args: ["plugin", "marketplace", "add", "ocampott/ticket-analyzer-mcp"],
        options: expect.objectContaining({ shell: false }),
      },
      {
        file: "/bin/claude",
        args: ["plugin", "install", "ticket-analyzer@ticket-analyzer-mcp"],
        options: expect.objectContaining({ shell: false }),
      },
      {
        file: "/bin/pi",
        args: ["install", "-l", "npm:ticket-analyzer-mcp@2.3.1"],
        options: expect.objectContaining({ shell: false }),
      },
    ]);
    expect(calls.some(({ options }) => options.shell === true)).toBe(false);
  });

  test("continues after a client failure and returns nonzero", async () => {
    const output = [];
    const attempted = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["claude", "codex"]),
      confirmClient: jest.fn().mockResolvedValue(true),
    };
    const runCommand = jest.fn(async (file) => {
      attempted.push(file);
      if (file === "/bin/claude") throw new Error("client failed");
    });

    const result = await setupCommand({
      cwd: await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")),
      env: {},
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      stderr: { write: (text) => output.push(text) },
      promptAdapter,
      configureClients: true,
      resolveExecutable: jest.fn().mockImplementation((name) => `/bin/${name}`),
      runCommand,
    });

    expect(result).toBe(1);
    expect(attempted).toContain("/bin/claude");
    expect(attempted).toContain("/bin/codex");
    expect(output.join(" ")).toMatch(/Claude Code.*failed/i);
  });

  test("redacts provider values in errors and quotes env paths in the plan", async () => {
    const output = [];
    const privateValue = ["provider", "value"].join("-");
    const envFile = path.join(await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")), "folder with spaces", "quote'and$path.env");
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["codex"]),
      confirmClient: jest.fn().mockResolvedValue(true),
    };
    const runCommand = jest.fn(async () => {
      throw new Error(`failed with ${privateValue} and token=${privateValue}`);
    });

    const result = await setupCommand({
      cwd: path.dirname(envFile),
      env: { TICKET_ANALYZER_ENV_FILE: envFile, JIRA_API_TOKEN: privateValue },
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      stderr: { write: (text) => output.push(text) },
      promptAdapter,
      configureClients: true,
      resolveExecutable: jest.fn().mockReturnValue("/bin/codex"),
      runCommand,
    });

    const text = output.join(" ");
    expect(result).toBe(1);
    expect(text).toContain("quote'\\''and$path.env");
    expect(runCommand).toHaveBeenCalledWith(
      "/bin/codex",
      ["mcp", "add", "ticket-analyzer", "--env", `TICKET_ANALYZER_ENV_FILE=${envFile}`, "--", "ticket-analyzer-mcp"],
      expect.objectContaining({ shell: false }),
    );
    expect(text).not.toContain(privateValue);
    expect(text).toContain("[redacted]");
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

  test("runCommand passes the Codex env-file path as an argument without child env leakage", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-"));
    const envFile = path.join(cwd, "folder with spaces", "project.env");
    const output = [];
    const promptAdapter = {
      providers: jest.fn().mockResolvedValue([]),
      client: jest.fn().mockResolvedValue(["codex"]),
      confirmClient: jest.fn().mockResolvedValue(true),
    };
    const spawnProcess = jest.fn(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      queueMicrotask(() => child.emit("close", 0));
      return child;
    });

    const result = await setupCommand({
      cwd,
      env: {
        TICKET_ANALYZER_ENV_FILE: envFile,
        JIRA_API_TOKEN: "provider-token",
        PATH: "/safe/bin",
        HOME: "/home/person",
      },
      stdin: { isTTY: true },
      stdout: { write: (text) => output.push(text) },
      promptAdapter,
      configureClients: true,
      resolveExecutable: jest.fn().mockReturnValue("/safe/bin/codex"),
      spawnProcess,
    });

    expect(result).toBe(0);
    expect(spawnProcess).toHaveBeenCalledTimes(1);
    expect(spawnProcess.mock.calls[0][1]).toEqual([
      "mcp", "add", "ticket-analyzer", "--env", `TICKET_ANALYZER_ENV_FILE=${envFile}`, "--", "ticket-analyzer-mcp",
    ]);
    expect(spawnProcess.mock.calls[0][2].env).toEqual({ PATH: "/safe/bin", HOME: "/home/person" });
    expect(output.join(" ")).not.toContain("provider-token");
  });

  test("runCommand times out safely and setup continues with later clients", async () => {
    jest.useFakeTimers();
    try {
      const children = [];
      let resolveStarted;
      const started = new Promise((resolve) => {
        resolveStarted = resolve;
      });
      const spawnProcess = jest.fn(() => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.kill = jest.fn(() => true);
        children.push(child);
        if (children.length === 1) resolveStarted();
        if (children.length > 1) queueMicrotask(() => child.emit("close", 0));
        return child;
      });
      const output = [];
      const promptAdapter = {
        providers: jest.fn().mockResolvedValue([]),
        client: jest.fn().mockResolvedValue(["claude", "codex"]),
        confirmClient: jest.fn().mockResolvedValue(true),
      };
      const setupPromise = setupCommand({
        cwd: await mkdtemp(path.join(os.tmpdir(), "ticket-analyzer-cli-")),
        env: {},
        stdin: { isTTY: true },
        stdout: { write: (text) => output.push(text) },
        stderr: { write: (text) => output.push(text) },
        promptAdapter,
        configureClients: true,
        timeoutMs: 25,
        resolveExecutable: jest.fn().mockImplementation((name) => `/bin/${name}`),
        spawnProcess,
      });

      await started;
      await jest.advanceTimersByTimeAsync(25);
      const result = await setupPromise;
      expect(result).toBe(1);
      expect(children[0].kill).toHaveBeenCalledTimes(1);
      expect(spawnProcess).toHaveBeenCalledTimes(2);
      expect(spawnProcess.mock.calls[1][1][0]).toBe("mcp");
      expect(output.join(" ")).toMatch(/timed out after 25ms/i);
    } finally {
      jest.useRealTimers();
    }
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
