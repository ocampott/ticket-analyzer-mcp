import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { accessSync, constants as fsConstants, existsSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { checkbox, confirm, input as inquirerInput, password } from "@inquirer/prompts";
import dotenv from "dotenv";
import { setupCommand as runSetupManager } from "./setup-manager.js";

const VERSION = "2.3.1";
const ENV_FILE_VARIABLE = "TICKET_ANALYZER_ENV_FILE";
const PROVIDERS = {
  trello: ["TRELLO_API_KEY", "TRELLO_TOKEN"],
  jira: ["JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  azure: ["AZURE_DEVOPS_ORG", "AZURE_DEVOPS_PROJECT", "AZURE_DEVOPS_PAT"],
};
const PROVIDER_LABELS = { trello: "Trello", jira: "Jira", azure: "Azure DevOps" };
    const PROVIDER_GUIDANCE = {
      trello:
        "Trello cards: get the API key from https://trello.com/app-key and the token from the Token link on that page. Enter plain values for TRELLO_API_KEY and TRELLO_TOKEN.",
      jira:
        "Jira issues: use the Atlassian site hostname (for example, company.atlassian.net), your Atlassian account email, and an API token from https://id.atlassian.com/manage-profile/security/api-tokens. Enter them as JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN.",
      azure:
        "Azure DevOps work items: use the organization and project names from https://dev.azure.com/{organization}/{project}, then create a PAT in Azure DevOps User settings. Enter AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, and the PAT; the minimum PAT scope is Work Items: Read. Work Items: Read & Write is needed only for comments.",
    };
const NO_INTEGRATION_WARNING =
  "Warning: no ticket integration is configured. Add the required provider values to the project .env (or rerun setup) before tickets can work.";
const SECRET_KEYS = new Set([
  "TRELLO_TOKEN",
  "JIRA_API_TOKEN",
  "AZURE_DEVOPS_PAT",
]);

export function resolveEnvFilePath(cwd = process.cwd(), env = process.env) {
  const configured = typeof env[ENV_FILE_VARIABLE] === "string" ? env[ENV_FILE_VARIABLE].trim() : "";
  return path.resolve(cwd, configured || ".env");
}

function writeOutput(stdout, text) {
  stdout.write(`${text}\n`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function formatEnvValue(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
}

export function updateEnvContent(content, updates) {
  const lines = content ? content.split(/\r?\n/) : [];
  const written = new Set();
  const keyPattern = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=).*$/;
  const replaced = lines.map((line) => {
    const match = keyPattern.exec(line);
    if (!match || !(match[2] in updates)) return line;
    written.add(match[2]);
    return `${match[1]}${match[2]}${match[3]}${formatEnvValue(updates[match[2]])}`;
  });

  const additions = Object.entries(updates)
    .filter(([key]) => !written.has(key))
    .map(([key, value]) => `${key}=${formatEnvValue(value)}`);
  const output = [...replaced.filter((line, index) => index < replaced.length - 1 || line !== ""), ...additions];
  return `${output.join("\n")}\n`;
}

async function readExistingEnv(filePath) {
  if (!existsSync(filePath)) return { exists: false, content: "", values: {} };
  const content = await readFile(filePath, "utf8");
  return { exists: true, content, values: dotenv.parse(content) };
}

function parseProviders(answer) {
  const selected = Array.isArray(answer) ? [...new Set(answer)] : [];
  const invalid = selected.filter((item) => !Object.hasOwn(PROVIDERS, item));
  if (invalid.length > 0) {
    throw new Error("Choose providers from the checkbox list.");
  }
  return selected;
}

const PROVIDER_CHOICES = [
      { name: "Trello — cards", value: "trello" },
      { name: "Jira — issues", value: "jira" },
      { name: "Azure DevOps — work items", value: "azure" },
    ];
const CLIENT_CHOICES = [
  { name: "Claude Code", value: "claude" },
  { name: "OpenAI Codex", value: "codex" },
  { name: "Pi", value: "pi" },
];
const CLIENT_LABELS = { claude: "Claude Code", codex: "OpenAI Codex", pi: "Pi" };
export function parseSetupArgs(args) {
  const seen = new Set();
  for (const arg of args) {
    if (arg !== "--configure-clients" && arg !== "--dry-run") {
      throw new Error(`Invalid setup argument: ${arg}`);
    }
    if (seen.has(arg)) throw new Error(`Invalid setup argument: duplicate ${arg}`);
    seen.add(arg);
  }
  const configureClients = seen.has("--configure-clients");
  const dryRun = seen.has("--dry-run");
  return { configureClients, dryRun };
}

const CLIENT_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "XDG_CONFIG_HOME",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "TERM",
]);
const SECRET_KEY_PATTERN = /token|secret|password|api[_-]?key|(?:^|[_-])pat$/i;
const PROVIDER_SECRET_KEYS = new Set(Object.values(PROVIDERS).flat());

export function deriveClientEnvironment(sourceEnv = process.env) {
  const safeEnv = {};
  for (const [key, value] of Object.entries(sourceEnv ?? {})) {
    if (
      CLIENT_ENV_KEYS.has(key) &&
      key !== ENV_FILE_VARIABLE &&
      !PROVIDER_SECRET_KEYS.has(key) &&
      !SECRET_KEY_PATTERN.test(key) &&
      typeof value === "string"
    ) {
      safeEnv[key] = value;
    }
  }
  return safeEnv;
}

export function resolveExecutable(name, env = process.env, cwd = process.cwd(), platform = process.platform) {
  const pathValue = typeof env.PATH === "string" ? env.PATH : "";
  const delimiter = platform === "win32" ? ";" : path.delimiter;
  const extensions = platform === "win32" ? [".exe"] : [""];
  for (const directory of pathValue.split(delimiter)) {
    const resolvedDirectory = directory ? path.resolve(cwd, directory) : cwd;
    for (const extension of extensions) {
      const candidate = path.join(resolvedDirectory, `${name}${extension}`);
      try {
        const mode = statSync(candidate).mode;
        accessSync(candidate, platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
        if (statSync(candidate).isFile() && (platform === "win32" || mode & 0o111)) return candidate;
      } catch {
        // Continue searching PATH without invoking a shell or `which`.
      }
    }
  }
  return null;
}

function boundedOutput(capture, chunk, limit) {
  const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  const remaining = Math.max(0, limit - capture.bytes);
  if (remaining > 0) {
    const bounded = bytes.subarray(0, remaining);
    capture.chunks.push(bounded.toString());
    capture.bytes += bounded.byteLength;
  }
}

function redactSecretLikeValues(text, secretValues = []) {
  let safe = String(text ?? "");
  for (const secret of [...new Set(secretValues)].filter(nonEmpty).sort((a, b) => b.length - a.length)) {
    safe = safe.replaceAll(secret, "[redacted]");
  }
  return safe.replace(/((?:token|pat|secret|password|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]");
}

export function runCommand(file, args, options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? 16 * 1024;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const secretValues = options.secretValues ?? [];
  const spawnProcess = options.spawnProcess ?? spawn;
  const safeEnv = deriveClientEnvironment(options.clientEnv ?? options.env ?? process.env);
  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    let timer;
    const stdout = { chunks: [], bytes: 0 };
    const stderr = { chunks: [], bytes: 0 };
    const onStdout = (chunk) => boundedOutput(stdout, chunk, maxOutputBytes);
    const onStderr = (chunk) => boundedOutput(stderr, chunk, maxOutputBytes);
    const onError = (error) => settleFailure(error?.message ?? String(error), error?.code);
    const onClose = (code) => {
      if (code === 0) {
        settleSuccess({ stdout: redactSecretLikeValues(stdout.chunks.join(""), secretValues), stderr: redactSecretLikeValues(stderr.chunks.join(""), secretValues) });
        return;
      }
      const details = stderr.chunks.join("") || stdout.chunks.join("") || `exit code ${code}`;
      settleFailure(details);
    };
    const removeListener = (target, event, listener) => target?.removeListener?.(event, listener);
    const cleanup = () => {
      clearTimeout(timer);
      removeListener(child, "error", onError);
      removeListener(child, "close", onClose);
      removeListener(child?.stdout, "data", onStdout);
      removeListener(child?.stderr, "data", onStderr);
    };
    const settleFailure = (message, code) => {
      if (settled) return;
      settled = true;
      cleanup();
      const error = new Error(redactSecretLikeValues(message, secretValues));
      if (code) error.code = code;
      reject(error);
    };
    const settleSuccess = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    try {
      child = spawnProcess(file, args, {
        cwd: options.cwd,
        env: safeEnv,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout?.on("data", onStdout);
      child.stderr?.on("data", onStderr);
      child.once("error", onError);
      child.once("close", onClose);
      timer = setTimeout(() => {
        if (settled) return;
        const timeoutError = new Error(`Client command timed out after ${timeoutMs}ms`);
        timeoutError.code = "ETIMEDOUT";
        settled = true;
        cleanup();
        try {
          child.kill?.();
        } catch {
          // The timeout result remains authoritative even if termination fails.
        }
        reject(timeoutError);
      }, timeoutMs);
    } catch (error) {
      settleFailure(error?.message ?? String(error), error?.code);
    }
  });
}

export function createPromptAdapter(stdin = process.stdin, stdout = process.stdout) {
  const context = { input: stdin, output: stdout };
  return {
    providers: () => checkbox({ message: "Providers to configure:", choices: PROVIDER_CHOICES }, context),
    client: () => checkbox({ message: "Clients to configure (leave all unchecked to configure later):", choices: CLIENT_CHOICES }, context),
    confirmClient: ({ message }) => confirm({ message }, context),
    input: ({ message }) => inquirerInput({ message }, context),
    password: ({ message }) => password({ message, mask: "*" }, context),
    close: () => {},
  };
}

function parseClients(answer) {
  const raw = Array.isArray(answer) ? answer : [answer];
  const selected = [...new Set(raw.map((item) => String(item ?? "").trim().toLowerCase()))].filter(Boolean);
  if (selected.length === 0 || (selected.length === 1 && ["none", "later", "configure later"].includes(selected[0]))) return [];
  if (selected.includes("none") || selected.includes("later") || selected.includes("configure later")) {
    throw new Error("Choose clients from the checkbox list, or leave all clients unchecked.");
  }
  const invalid = selected.filter((item) => !Object.hasOwn(CLIENT_LABELS, item));
  if (invalid.length > 0) throw new Error("Choose clients from the checkbox list.");
  return selected;
}

async function askRequired(ask, label, existing) {
  const canKeepExisting = nonEmpty(existing);
  while (true) {
    const value = await ask({
      message: `${label}${canKeepExisting ? " (leave blank to keep the current value)" : ""}: `,
    });
    if (nonEmpty(value)) return value.trim();
    if (canKeepExisting) return existing.trim();
    writeOutput(process.stderr, `${label} is required and must not be empty.`);
  }
}

function providerStatusLine(label, status, localStatus) {
  if (!localStatus.configured) return `${label}: incomplete (missing ${localStatus.missing.join(", ")})`;
  if (status?.connected) return `${label}: connected`;
  if (status?.configured && status.error) return `${label}: error (${String(status.error)})`;
  if (status?.configured) return `${label}: configured but not connected`;
  return `${label}: configured locally; connection status unavailable`;
}

function localStatus(values, provider) {
  const missing = PROVIDERS[provider].filter((name) => !nonEmpty(values[name]));
  return { configured: missing.length === 0, missing };
}

function reportSetupCompleteness(stdout, values) {
  const statuses = Object.keys(PROVIDERS).map((provider) => ({
    provider,
    status: localStatus(values, provider),
  }));
  const complete = statuses.some(({ status }) => status.configured);
  if (!complete) writeOutput(stdout, NO_INTEGRATION_WARNING);
  if (!complete) {
    for (const { provider, status } of statuses) {
      writeOutput(stdout, providerStatusLine(PROVIDER_LABELS[provider], undefined, status));
    }
  }
}

async function loadCommandEnvironment(options) {
  const env = options.env ?? process.env;
  const filePath = resolveEnvFilePath(options.cwd, env);
  const file = await readExistingEnv(filePath);
  const values = { ...file.values };
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === "string") values[name] = value;
  }
  for (const [name, value] of Object.entries(file.values)) {
    if (env[name] === undefined) env[name] = value;
  }
  return { env, values, filePath, file };
}

async function legacySetupCommand(options = {}) {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  if (!stdin.isTTY) {
    writeOutput(stdout, "Setup requires an interactive terminal. Run `ticket-analyzer-mcp setup` from a TTY.");
    throw new Error("Setup requires an interactive terminal; refusing to read credentials from non-TTY stdin.");
  }

  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const filePath = resolveEnvFilePath(cwd, env);
  const existing = await readExistingEnv(filePath);
  const promptAdapter = options.promptAdapter ?? createPromptAdapter(stdin, stdout);
  const updates = {};

  try {
    const selected = parseProviders(await promptAdapter.providers());
    for (const provider of selected) {
      writeOutput(stdout, PROVIDER_GUIDANCE[provider]);
      for (const name of PROVIDERS[provider]) {
        if (nonEmpty(env[name])) continue;
        const prompt = SECRET_KEYS.has(name) ? promptAdapter.password : promptAdapter.input;
        updates[name] = await askRequired(prompt, name, existing.values[name]);
      }
    }

    if (Object.keys(updates).length > 0) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, updateEnvContent(existing.content, updates), { mode: 0o600 });
      try {
        await chmod(filePath, 0o600);
      } catch {
        // Some operating systems do not support POSIX mode bits; keep setup usable there.
      }
      writeOutput(stdout, `Saved selected provider configuration to ${filePath}.`);
    } else {
      writeOutput(stdout, "No provider credentials selected; no credentials were changed.");
    }

    const finalValues = { ...existing.values, ...updates };
    for (const [name, value] of Object.entries(env)) {
      if (typeof value === "string") finalValues[name] = value;
    }
    reportSetupCompleteness(stdout, finalValues);

    const clients = parseClients(await promptAdapter.client());
    if (clients.length === 0) {
      writeOutput(stdout, "Credentials are ready locally but no agent client has been configured yet.");
    } else {
      writeOutput(stdout, "Next steps (setup does not execute client CLIs or change client settings):");
      for (const client of clients) {
        writeOutput(stdout, `${CLIENT_LABELS[client]}:`);
        if (client === "pi") {
          writeOutput(stdout, "Next step for Pi: pi install -l npm:ticket-analyzer-mcp@2.3.1");
        } else if (client === "codex") {
          const serverCommand = "ticket-analyzer-mcp";
          writeOutput(stdout, `Next step for Codex: codex mcp add ticket-analyzer --env ${ENV_FILE_VARIABLE}=${shellQuote(filePath)} -- ${serverCommand}`);
        } else {
          writeOutput(stdout, "Next step for Claude Code: install or update ticket-analyzer@ticket-analyzer-mcp from the ticket-analyzer-mcp marketplace, then restart Claude Code.");
          writeOutput(stdout, "Install: claude plugin marketplace add ocampott/ticket-analyzer-mcp && claude plugin install ticket-analyzer@ticket-analyzer-mcp");
          writeOutput(stdout, "Update: claude plugin marketplace update ticket-analyzer-mcp && claude plugin update ticket-analyzer@ticket-analyzer-mcp");
        }
      }
    }
  } finally {
    promptAdapter.close?.();
  }
}

export async function setupCommand(options = {}) {
  if (options.setupManager) return options.setupManager(options);
  if (options.plan || options.selections) return runSetupManager(options);
  return legacySetupCommand(options);
}

export async function statusCommand(options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const { values, filePath, file } = await loadCommandEnvironment(options);
  writeOutput(stdout, `ticket-analyzer-mcp ${VERSION} local status`);
  writeOutput(stdout, `Node.js: ${process.version}`);
  writeOutput(stdout, `.env: ${file.exists ? `found at ${filePath}` : `not found at ${filePath}`}`);
  for (const provider of Object.keys(PROVIDERS)) {
    writeOutput(stdout, providerStatusLine(PROVIDER_LABELS[provider], undefined, localStatus(values, provider)));
  }
}

export async function doctorCommand(options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const { env, values, filePath, file } = await loadCommandEnvironment(options);
  writeOutput(stdout, `ticket-analyzer-mcp ${VERSION} doctor`);
  writeOutput(stdout, `Node.js: ${process.version} (${Number.parseInt(process.versions.node, 10) >= 18 ? "ok" : "requires Node.js 18+"})`);
  writeOutput(stdout, `.env: ${file.exists ? `found at ${filePath}` : `not found at ${filePath}`}`);

  let providerStatus = options.providerStatus;
  if (!providerStatus) {
    providerStatus = {
      trello: async () => (await import("../dist/trello.js")).getTrelloStatus(),
      jira: async () => (await import("../dist/jira.js")).getJiraStatus(),
      azure: async () => (await import("../dist/azure.js")).getAzureStatus(),
    };
  }

  for (const provider of Object.keys(PROVIDERS)) {
    let response;
    try {
      response = await providerStatus[provider]?.();
    } catch (error) {
      response = { configured: true, connected: false, error: error instanceof Error ? error.message : String(error) };
    }
    const local = localStatus(values, provider);
    const safeResponse = response && typeof response === "object" ? { ...response } : {};
    for (const key of Object.keys(safeResponse)) {
      if (SECRET_KEYS.has(key) || /token|pat|secret|password/i.test(key)) delete safeResponse[key];
    }
    for (const [name, value] of Object.entries(values)) {
      if (value) {
        safeResponse.error = typeof safeResponse.error === "string" ? safeResponse.error.replaceAll(value, "[redacted]") : safeResponse.error;
      }
    }
    writeOutput(stdout, providerStatusLine(PROVIDER_LABELS[provider], safeResponse, local));
  }
}

function helpText() {
  return [
    "ticket-analyzer-mcp 2.3.1",
    "",
    "Usage:",
    "  ticket-analyzer-mcp              Start the MCP server over stdio",
    "  ticket-analyzer-mcp setup        Plan and confirm project-scoped provider and client setup",
    "      --configure-clients          Compatibility alias for unified setup",
    "      --dry-run                     Show the complete redacted plan without prompts or mutations",
    "  ticket-analyzer-mcp doctor       Diagnose Node, .env, provider, and connection status",
    "  ticket-analyzer-mcp status       Check local provider configuration without network calls",
    "  ticket-analyzer-mcp --help       Show this help",
  ].join("\n");
}

export async function runCli(argv = process.argv.slice(2), options = {}) {
  const command = argv[0];
  const commandArgs = argv.slice(1);
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  if (command === "--help" || command === "-h" || command === "help") {
    if (commandArgs.length > 0) {
      writeOutput(stderr, `Invalid argument for ${command}: ${commandArgs[0]}. Run with --help for usage.`);
      return 1;
    }
    writeOutput(stdout, helpText());
    return 0;
  }
  if (command === "setup") {
    try {
      const setupArgs = parseSetupArgs(commandArgs);
      return (await setupCommand({ ...options, ...setupArgs, setupManager: options.setupManager ?? runSetupManager, resolveExecutable: options.resolveExecutable ?? resolveExecutable, runCommand: options.runCommand ?? runCommand })) ?? 0;
    } catch (error) {
      if (error instanceof Error && /^Invalid setup argument:/i.test(error.message)) {
        writeOutput(stderr, `${error.message}. Run with --help for usage.`);
        return 1;
      }
      throw error;
    }
  }
  if (command === "doctor" || command === "status") {
    if (commandArgs.length > 0) {
      writeOutput(stderr, `Invalid argument for ${command}: ${commandArgs[0]}. Run with --help for usage.`);
      return 1;
    }
    if (command === "doctor") await doctorCommand(options);
    else await statusCommand(options);
    return 0;
  }
  if (command) {
    writeOutput(stderr, `Unknown command: ${command}. Run with --help for usage.`);
    return 1;
  }
  if (options.startServer) return options.startServer();
  await import("../dist/index.js");
  return 0;
}
