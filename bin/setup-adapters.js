import path from "node:path";
import { lstat as nativeLstat, readFile as nativeReadFile } from "node:fs/promises";
import { classifyOwnership } from "./setup-files.js";

const CLIENT_ENV_KEYS = new Set(["PATH", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "LANG", "LC_ALL", "TERM"]);
const manualRecovery = "Claude project MCP state could not be verified safely; recover it manually in Claude Code.";

function facts(root) {
  return { registrationId: "ticket-analyzer", scope: "project", command: "ticket-analyzer-mcp", envFile: path.join(root, ".env") };
}

function sameFacts(left, right) {
  return left && right && Object.keys(left).every((key) => left[key] === right[key]) && Object.keys(right).every((key) => left[key] === right[key]);
}

function safeChildEnvironment(environment = {}) {
  return Object.fromEntries(Object.entries(environment).filter(([key, value]) => CLIENT_ENV_KEYS.has(key) && typeof value === "string"));
}

function unknown(reason) {
  return { client: "claude", classification: "unknown", reason, recovery: manualRecovery };
}

const nativeFilesystem = { lstat: nativeLstat, readFile: nativeReadFile };

function unsafeProjectConfig(reason) {
  return { safe: false, reason };
}

/**
 * Inspect only the conventional project-local Claude config before command discovery.
 * An existing config remains blocked unless a caller supplies a fixture-pinned inspector
 * that can prove it is safe to preserve without an exact textual diff.
 */
export async function inspectClaudeProjectConfig({ root, filesystem = nativeFilesystem } = {}) {
  if (!path.isAbsolute(root) || typeof filesystem?.lstat !== "function" || typeof filesystem?.readFile !== "function") {
    return unsafeProjectConfig("Claude project-config inspection dependencies are unavailable.");
  }
  try {
    const rootStat = await filesystem.lstat(root);
    if (!rootStat?.isDirectory?.() || rootStat.isSymbolicLink?.()) return unsafeProjectConfig("Claude project root is unsafe to inspect.");
  } catch {
    return unsafeProjectConfig("Claude project root is unavailable for inspection.");
  }
  const configPath = path.join(root, ".mcp.json");
  let configStat;
  try {
    configStat = await filesystem.lstat(configPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { safe: true, tracked: false };
    return unsafeProjectConfig("Claude project config is unavailable for inspection.");
  }
  if (!configStat?.isFile?.() || configStat.isSymbolicLink?.()) return unsafeProjectConfig("The conventional Claude .mcp.json is unsafe to inspect.");
  try {
    const parsed = JSON.parse(String(await filesystem.readFile(configPath, "utf8")));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid JSON object");
  } catch {
    return unsafeProjectConfig("The conventional Claude .mcp.json is malformed or unreadable.");
  }
  return unsafeProjectConfig("Claude project config exists and cannot be safely preserved without an exact diff.");
}

function parseFixture(output, root) {
  try {
    const value = JSON.parse(output);
    if (value === null) return { absent: true, root };
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "command,env,name,scope" || value.name !== "ticket-analyzer" || value.scope !== "project" || typeof value.command !== "string" || !value.env || typeof value.env !== "object" || Array.isArray(value.env) || !Object.keys(value.env).every((key) => key === "TICKET_ANALYZER_ENV_FILE") || (value.env.TICKET_ANALYZER_ENV_FILE !== undefined && typeof value.env.TICKET_ANALYZER_ENV_FILE !== "string")) return null;
    return { registrationId: value.name, scope: value.scope, command: value.command, envFile: value.env.TICKET_ANALYZER_ENV_FILE ?? "", root };
  } catch {
    return null;
  }
}

export function renderClaudeOperation(operation) {
  return [
    "Claude project MCP operation",
    `kind: ${operation.kind}`,
    `argv: ${JSON.stringify(operation.argv ?? [])}`,
    `before: ${JSON.stringify(operation.before ?? null)}`,
    `after: ${JSON.stringify(operation.after ?? null)}`,
  ].join("\n");
}

export class ClaudeAdapter {
  constructor(dependencies = {}) {
    this.resolveExecutable = dependencies.resolveExecutable;
    this.runCommand = dependencies.runCommand;
    this.inspectProjectConfig = dependencies.inspectProjectConfig;
  }

  async discover({ root, state, environment = {} }) {
    if (!path.isAbsolute(root) || typeof this.resolveExecutable !== "function" || typeof this.runCommand !== "function" || typeof this.inspectProjectConfig !== "function") return unknown("Claude inspection dependencies are unavailable.");
    const executable = await this.resolveExecutable("claude", environment, root);
    if (!executable || !path.isAbsolute(executable)) return unknown("Claude executable is unavailable.");
    const config = await this.inspectProjectConfig({ root });
    if (!config?.safe) return unknown(config?.reason ?? "The conventional Claude .mcp.json is unsafe to inspect.");
    if (config.tracked) return unknown("Claude project configuration is tracked and has no exact textual diff.");
    let result;
    try {
      result = await this.runCommand(executable, ["mcp", "get", "ticket-analyzer", "--scope", "project", "--output", "json"], {
        cwd: root, shell: false, clientEnv: safeChildEnvironment(environment), maxOutputBytes: 16 * 1024, timeoutMs: 60_000,
      });
    } catch {
      return unknown("Claude project MCP inspection failed.");
    }
    const observed = parseFixture(result?.stdout, root);
    if (!observed) return unknown("Claude project MCP inspection output is unsupported or ambiguous.");
    const canonical = facts(root);
    const ownership = classifyOwnership({ client: "claude", state, observed, canonical });
    return { client: "claude", root, executable, observed, canonical, ...ownership, recovery: ownership.classification === "unknown" ? manualRecovery : undefined };
  }

  buildOperation({ discovery, decision, intent = "add" }) {
    if (!discovery || discovery.classification === "unknown") return { client: "claude", blocked: true, reason: discovery?.reason ?? manualRecovery };
    const canonical = discovery.canonical ?? facts(discovery.root);
    if (intent === "remove") {
      if (discovery.classification !== "owned") return { client: "claude", blocked: true, reason: "Only an owned Claude registration can be removed." };
      return { client: "claude", kind: "remove", root: discovery.root, executable: discovery.executable, argv: ["mcp", "remove", "--scope", "project", "ticket-analyzer"], before: discovery.observed, after: null, canonical };
    }
    if (discovery.classification === "matching" && decision !== "adopt") return { client: "claude", blocked: true, reason: "Adopt the matching Claude project MCP registration explicitly." };
    if (discovery.classification === "foreign" && decision !== "replace") return { client: "claude", blocked: true, reason: "Replace the foreign Claude project MCP registration explicitly." };
    if (discovery.classification === "matching") return { client: "claude", kind: "adopt", root: discovery.root, executable: discovery.executable, argv: [], before: discovery.observed, after: canonical, canonical };
    return { client: "claude", kind: discovery.classification === "foreign" ? "replace" : "add", root: discovery.root, executable: discovery.executable, argv: ["mcp", "add", "--scope", "project", "ticket-analyzer", "--env", `TICKET_ANALYZER_ENV_FILE=${canonical.envFile}`, "--", "ticket-analyzer-mcp"], before: discovery.observed ?? null, after: canonical, canonical };
  }

  async execute(operation, dependencies = {}) {
    if (operation?.blocked || operation?.client !== "claude") throw new Error("Claude operation is blocked.");
    const ensureIgnoreRule = dependencies.ensureIgnoreRule ?? (async () => {});
    const writeOwnership = dependencies.writeOwnership ?? (async () => {});
    if (operation.kind !== "remove") await ensureIgnoreRule();
    if (operation.kind !== "adopt") {
      const runner = dependencies.runCommand ?? this.runCommand;
      if (typeof runner !== "function") throw new Error("Claude command runner is unavailable.");
      try {
        await runner(operation.executable, operation.argv, { cwd: operation.root, shell: false, clientEnv: safeChildEnvironment(dependencies.environment), maxOutputBytes: 16 * 1024, timeoutMs: 60_000 });
      } catch {
        throw new Error("Claude project MCP command failed; inspect Claude manually.");
      }
      const discover = dependencies.discover ?? ((context) => this.discover(context));
      const verified = await discover({ root: operation.root, state: dependencies.state, environment: dependencies.environment });
      const verifiedRemoval = operation.kind === "remove" && verified?.classification === "absent";
      const verifiedRegistration = operation.kind !== "remove" && sameFacts(verified?.observed, operation.canonical) && ["matching", "owned"].includes(verified.classification);
      if (!verifiedRemoval && !verifiedRegistration) throw new Error("Claude project MCP post-command verification failed.");
    }
    await writeOwnership(operation.kind === "remove" ? null : operation.canonical);
    return { success: true };
  }
}
