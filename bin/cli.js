import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { checkbox, input as inquirerInput, password } from "@inquirer/prompts";
import dotenv from "dotenv";

const VERSION = "2.2.1";
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

export function createPromptAdapter(stdin = process.stdin, stdout = process.stdout) {
  const context = { input: stdin, output: stdout };
  return {
    providers: () => checkbox({ message: "Providers to configure:", choices: PROVIDER_CHOICES }, context),
    client: () => checkbox({ message: "Clients to configure (leave all unchecked to configure later):", choices: CLIENT_CHOICES }, context),
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

export async function setupCommand(options = {}) {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  if (!stdin.isTTY) {
    writeOutput(stdout, "Setup requires an interactive terminal. Run `npx -y ticket-analyzer-mcp setup` from a TTY.");
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
          writeOutput(stdout, "Next step for Pi: pi install -l npm:ticket-analyzer-mcp@2.2.1");
        } else if (client === "codex") {
          const serverCommand = "npx -y ticket-analyzer-mcp@2.2.1";
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
    "ticket-analyzer-mcp 2.2.1",
    "",
    "Usage:",
    "  npx -y ticket-analyzer-mcp              Start the MCP server over stdio",
    "  npx -y ticket-analyzer-mcp setup        Configure selected providers in the project .env",
    "  npx -y ticket-analyzer-mcp doctor       Diagnose Node, .env, provider, and connection status",
    "  npx -y ticket-analyzer-mcp status       Check local provider configuration without network calls",
    "  npx -y ticket-analyzer-mcp --help       Show this help",
  ].join("\n");
}

export async function runCli(argv = process.argv.slice(2), options = {}) {
  const command = argv[0];
  if (command === "--help" || command === "-h" || command === "help") {
    writeOutput(options.stdout ?? process.stdout, helpText());
    return 0;
  }
  if (command === "setup") {
    await setupCommand(options);
    return 0;
  }
  if (command === "doctor") {
    await doctorCommand(options);
    return 0;
  }
  if (command === "status") {
    await statusCommand(options);
    return 0;
  }
  if (command) {
    writeOutput(options.stderr ?? process.stderr, `Unknown command: ${command}. Run with --help for usage.`);
    return 1;
  }
  if (options.startServer) return options.startServer();
  await import("../dist/index.js");
  return 0;
}
