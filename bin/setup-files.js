import path from "node:path";
import { mkdir as nativeMkdir, open as nativeOpen, readFile as nativeReadFile, rename as nativeRename, rm as nativeRm } from "node:fs/promises";

export const PROVIDER_ENV_VARS = Object.freeze({
  trello: ["TRELLO_API_KEY", "TRELLO_TOKEN"],
  jira: ["JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  azure: ["AZURE_DEVOPS_ORG", "AZURE_DEVOPS_PROJECT", "AZURE_DEVOPS_PAT"],
});
export const ENV_PRECEDENCE_WARNING =
  "An inherited process environment variable overrides .env and is outside this manager; deleting this file value does not prove the provider inactive.";

const assignment = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;
const privateAfter = new WeakMap();
const missing = (error) => error?.code === "ENOENT";
const quote = (value) => `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
const splitValue = (value) => {
  let quoteChar = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (quoteChar) { if (character === quoteChar) quoteChar = null; continue; }
    if (character === '"' || character === "'") { quoteChar = character; continue; }
    if (character === "#" && (index === 0 || /\s/.test(value[index - 1]))) {
      const valuePart = value.slice(0, index).trimEnd();
      return { value: valuePart, tail: value.slice(valuePart.length) };
    }
  }
  return { value, tail: "" };
};
const hasOddTrailingBackslashes = (value) => {
  let count = 0;
  for (let index = value.length - 1; index >= 0 && value[index] === "\\"; index -= 1) count += 1;
  return count % 2 === 1;
};
const unsafeValue = (value) => hasOddTrailingBackslashes(value) || ((value.match(/(?<!\\)["']/g) ?? []).length % 2 === 1);
const parts = (content) => {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const finalNewline = content.endsWith(eol);
  const body = finalNewline ? content.slice(0, -eol.length) : content;
  return { eol, finalNewline, lines: body ? body.split(/\r\n|\n/) : [] };
};
const redacted = (line, key) => {
  const match = assignment.exec(line);
  return match ? `${match[1]}${key}${match[3]}[redacted]${splitValue(match[4]).tail}` : `${key}=[redacted]`;
};

export function resolveManagedEnvPath(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new Error("Project root must be absolute.");
  return path.join(root, ".env");
}

export async function validateProjectPath(root, target, filesystem = {}) {
  if (!path.isAbsolute(root) || !path.isAbsolute(target)) throw new Error("Project paths must be absolute.");
  if (typeof filesystem.lstat !== "function") throw new Error("Project path validation requires an injected filesystem.");
  const canonicalRoot = path.resolve(root);
  const rootStat = await filesystem.lstat(canonicalRoot);
  if (rootStat.isSymbolicLink?.()) throw new Error(`Refusing symlinked project root: ${canonicalRoot}`);
  if (!rootStat.isDirectory?.()) throw new Error(`Project root is not a directory: ${canonicalRoot}`);
  const absoluteTarget = path.resolve(target);
  const relative = path.relative(canonicalRoot, absoluteTarget);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing mutable path outside project root: ${absoluteTarget}`);
  }
  let current = canonicalRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = await filesystem.lstat(current);
      if (stat.isSymbolicLink?.()) throw new Error(`Refusing symlinked project path: ${current}`);
      if (current === absoluteTarget && !stat.isFile?.()) throw new Error(`Mutable project path is not a regular file: ${current}`);
    } catch (error) {
      if (!missing(error)) throw error;
      break;
    }
  }
  return absoluteTarget;
}

export function editProviderEnv(content, operation) {
  const provider = operation?.provider;
  const allowed = PROVIDER_ENV_VARS[provider];
  if (!allowed) return { safe: false, reason: `Unknown provider: ${provider}` };
  const updates = operation?.updates ?? operation?.values ?? {};
  const removals = operation?.remove === true ? allowed : new Set(operation?.remove ?? []);
  const updateKeys = Object.keys(updates);
  if (updateKeys.some((key) => !allowed.includes(key)) || [...removals].some((key) => !allowed.includes(key))) {
    return { safe: false, reason: "Provider operation contains an undeclared environment variable." };
  }
  const parsed = parts(String(content ?? ""));
  const found = new Map();
  const changes = [];
  for (const line of parsed.lines) {
    const match = assignment.exec(line);
    if (!match || !allowed.includes(match[2])) continue;
    if (found.has(match[2]) || unsafeValue(splitValue(match[4]).value)) return { safe: false, reason: `Selected provider assignment is duplicate or multiline: ${match[2]}` };
    found.set(match[2], line);
  }
  const nextLines = parsed.lines.flatMap((line) => {
    const match = assignment.exec(line);
    if (!match || !allowed.includes(match[2])) return [line];
    const key = match[2];
    if (removals.has(key)) {
      changes.push({ key, action: "remove", before: line, after: null });
      return [];
    }
    if (!Object.hasOwn(updates, key)) return [line];
    const next = `${match[1]}${key}${match[3]}${quote(updates[key])}${splitValue(match[4]).tail}`;
    changes.push({ key, action: "edit", before: line, after: next });
    return [next];
  });
  for (const [key, value] of Object.entries(updates)) {
    if (found.has(key)) continue;
    const next = `${key}=${quote(value)}`;
    nextLines.push(next);
    changes.push({ key, action: "add", before: null, after: next });
  }
  const after = nextLines.join(parsed.eol) + (parsed.finalNewline ? parsed.eol : "");
  const diff = changes.flatMap(({ key, before, after: changed }) => [
    before === null ? `+ ${redacted(changed, key)}` : `- ${redacted(before, key)}`,
    changed === null ? [] : before === null ? [] : `+ ${redacted(changed, key)}`,
  ]).flat().join("\n");
  const affectedLines = changes.map(({ key, action, before, after: changed }) => ({
    key,
    action,
    before: before === null ? null : redacted(before, key),
    after: changed === null ? null : redacted(changed, key),
  }));
  const result = { safe: true, changed: after !== content, affectedLines, redactedDiff: diff, warning: ENV_PRECEDENCE_WARNING };
  privateAfter.set(result, after);
  return result;
}

export async function prepareAtomicWrite({ root, target, before, editResult, mode, existing = true, tempPath, filesystem }) {
  const after = privateAfter.get(editResult);
  if (typeof after !== "string") throw new Error("Atomic write preparation requires a safe provider edit result.");
  if (!path.isAbsolute(root) || !path.isAbsolute(target)) throw new Error("Project paths must be absolute.");
  if (typeof filesystem?.lstat !== "function") throw new Error("Atomic write preparation requires an injected filesystem.");

  const absoluteTarget = await validateProjectPath(root, target, filesystem);
  const requestedTemp = tempPath ?? `${absoluteTarget}.tmp-setup-manager`;
  if (typeof requestedTemp !== "string" || !path.isAbsolute(requestedTemp)) throw new Error("Temporary write path must be absolute.");
  const absoluteTemp = path.resolve(requestedTemp);
  if (absoluteTemp === absoluteTarget) throw new Error("Temporary write path must differ from the target.");
  await validateProjectPath(root, absoluteTemp, filesystem);
  if (path.dirname(absoluteTemp) !== path.dirname(absoluteTarget)) {
    throw new Error(`Temporary write path must be in the same directory as the target: ${absoluteTemp}`);
  }

  const preparation = {
    operation: "atomic-write",
    target: absoluteTarget,
    tempPath: absoluteTemp,
    expected: before,
    mode: existing ? mode : 0o600,
  };
  Object.defineProperty(preparation, "content", { value: after, enumerable: false });
  return preparation;
}

export const SIDECAR_RELATIVE_PATH = ".ticket-analyzer/setup-state.json";
export const SIDECAR_IGNORE_RULE = "/.ticket-analyzer/setup-state.json";
const SIDECAR_CLIENT_KEYS = {
  claude: ["registrationId", "scope", "command", "envFile"],
  codex: ["configPath", "table", "command", "envFile"],
  pi: ["settingsPath", "packageName", "packageSpec", "scope", "environmentBinding"],
};
const stateError = (reason) => ({ safe: false, reason });
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));
const canonicalRoot = (root) => typeof root === "string" && path.isAbsolute(root) && path.resolve(root) === root;
const canonicalEnv = (root) => path.join(root, ".env");
const missingFile = (error) => error?.code === "ENOENT";
const sidecarPath = (root) => path.join(root, SIDECAR_RELATIVE_PATH);
const fsMethod = (filesystem, name, fallback) => filesystem?.[name] ?? fallback;

function validateClientRecord(client, record, root) {
  if (!isPlainObject(record) || !exactKeys(record, SIDECAR_CLIENT_KEYS[client])) return stateError(`Invalid ${client} ownership record.`);
  if (SIDECAR_CLIENT_KEYS[client].some((key) => typeof record[key] !== "string")) return stateError(`Invalid ${client} ownership record types.`);
  if (client === "claude" && (record.registrationId !== "ticket-analyzer" || record.scope !== "project" || record.command !== "ticket-analyzer-mcp" || record.envFile !== canonicalEnv(root))) return stateError("Claude ownership record does not match the canonical project binding.");
  if (client === "codex" && (record.configPath !== CODEX_RELATIVE_CONFIG_PATH || record.table !== CODEX_TARGET_TABLE || record.command !== CODEX_COMMAND || record.envFile !== canonicalEnv(root))) return stateError("Codex ownership record does not match the canonical project binding.");
  if (client === "pi" && (record.settingsPath !== ".pi/settings.json" || record.packageName !== "ticket-analyzer-mcp" || !/^npm:ticket-analyzer-mcp@[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/.test(record.packageSpec) || record.scope !== "local" || record.environmentBinding !== "runtime-cwd-env")) return stateError("Pi ownership record does not match the canonical project binding.");
  return { safe: true };
}

export function validateOwnershipState(state, expectedRoot) {
  if (!isPlainObject(state) || state.schemaVersion !== 1 || !canonicalRoot(state.projectRoot) || state.projectRoot !== expectedRoot || !isPlainObject(state.clients) || !exactKeys(state, ["schemaVersion", "projectRoot", "clients"]) || !Object.keys(state.clients).every((client) => Object.hasOwn(SIDECAR_CLIENT_KEYS, client))) return stateError("Ownership state has an invalid schema or canonical project root.");
  for (const [client, record] of Object.entries(state.clients)) {
    const result = validateClientRecord(client, record, expectedRoot);
    if (!result.safe) return result;
  }
  return { safe: true, state };
}

export function buildOwnershipState(projectRoot, clients = {}) {
  const state = { schemaVersion: 1, projectRoot, clients: {} };
  for (const client of Object.keys(clients)) {
    if (!Object.hasOwn(SIDECAR_CLIENT_KEYS, client)) throw new Error(`Unsupported ownership client: ${client}`);
    state.clients[client] = Object.fromEntries(SIDECAR_CLIENT_KEYS[client].map((key) => [key, clients[client]?.[key]]));
  }
  const result = validateOwnershipState(state, projectRoot);
  if (!result.safe) throw new Error(result.reason);
  return state;
}

export function hasDuplicateJsonKeys(source) {
  let index = 0;
  const whitespace = () => { while (/\s/.test(source[index] ?? "")) index += 1; };
  const string = () => {
    if (source[index++] !== '"') throw new Error("Expected JSON string");
    while (index < source.length) {
      if (source[index] === "\\") { index += 2; continue; }
      if (source[index++] === '"') return;
    }
    throw new Error("Unterminated JSON string");
  };
  const value = () => {
    whitespace();
    if (source[index] === '"') { string(); return; }
    if (source[index] === "{") { object(); return; }
    if (source[index] === "[") { array(); return; }
    const start = index;
    while (index < source.length && !/[,\]}\s]/.test(source[index])) index += 1;
    if (start === index) throw new Error("Expected JSON value");
  };
  const object = () => {
    index += 1;
    const keys = new Set();
    whitespace();
    if (source[index] === "}") { index += 1; return; }
    while (index < source.length) {
      whitespace();
      const start = index;
      string();
      const key = JSON.parse(source.slice(start, index));
      if (keys.has(key)) throw new Error(`Duplicate JSON key: ${key}`);
      keys.add(key);
      whitespace();
      if (source[index++] !== ":") throw new Error("Expected JSON colon");
      value();
      whitespace();
      if (source[index] === "}") { index += 1; return; }
      if (source[index++] !== ",") throw new Error("Expected JSON comma");
    }
    throw new Error("Unterminated JSON object");
  };
  const array = () => {
    index += 1;
    whitespace();
    if (source[index] === "]") { index += 1; return; }
    while (index < source.length) {
      value();
      whitespace();
      if (source[index] === "]") { index += 1; return; }
      if (source[index++] !== ",") throw new Error("Expected JSON comma");
    }
    throw new Error("Unterminated JSON array");
  };
  try { value(); whitespace(); if (index !== source.length) throw new Error("Trailing JSON data"); return false; } catch { return true; }
}

export function serializeOwnershipState(state) {
  const checked = validateOwnershipState(state, state?.projectRoot);
  if (!checked.safe) throw new Error(checked.reason);
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function parseOwnershipState(content, expectedRoot) {
  try {
    if (typeof content !== "string" || hasDuplicateJsonKeys(content)) return stateError("Ownership state is malformed or contains duplicate keys.");
    const state = JSON.parse(content);
    const checked = validateOwnershipState(state, expectedRoot);
    return checked.safe ? { safe: true, state } : checked;
  } catch (error) { return stateError(`Ownership state is invalid: ${error.message}`); }
}

export async function readOwnershipState({ root, filesystem = {}, readFile }) {
  const target = sidecarPath(root);
  await validateProjectPath(root, target, filesystem);
  let stat;
  try { stat = await filesystem.lstat(target); } catch (error) { if (missingFile(error)) return { exists: false, state: null }; throw error; }
  if (stat.isSymbolicLink?.()) throw new Error(`Refusing symlinked sidecar: ${target}`);
  if (!stat.isFile?.()) throw new Error(`Sidecar is not a regular file: ${target}`);
  const reader = readFile ?? fsMethod(filesystem, "readFile", nativeReadFile);
  const content = String(await reader(target, "utf8"));
  const parsed = parseOwnershipState(content, path.resolve(root));
  if (!parsed.safe) throw new Error(parsed.reason);
  return { exists: true, state: parsed.state, content };
}

async function ensureSidecarDirectory(root, filesystem) {
  const directory = path.join(root, ".ticket-analyzer");
  try {
    const stat = await filesystem.lstat(directory);
    if (stat.isSymbolicLink?.()) throw new Error(`Refusing symlinked sidecar directory: ${directory}`);
    if (!stat.isDirectory?.()) throw new Error(`Sidecar parent is not a directory: ${directory}`);
  } catch (error) {
    if (!missingFile(error)) throw error;
    await fsMethod(filesystem, "mkdir", nativeMkdir)(directory, { recursive: true, mode: 0o700 });
    const stat = await filesystem.lstat(directory);
    if (stat.isSymbolicLink?.() || !stat.isDirectory?.()) throw new Error(`Unsafe sidecar directory: ${directory}`);
  }
}

export async function atomicTextWrite({ root, target, before, after, filesystem, tempPath, mode = 0o600 }) {
  await validateProjectPath(root, target, filesystem);
  const absoluteTarget = path.resolve(target);
  const absoluteTemp = path.resolve(tempPath ?? `${absoluteTarget}.tmp-${process.pid}-${Date.now()}`);
  if (absoluteTemp === absoluteTarget || path.dirname(absoluteTemp) !== path.dirname(absoluteTarget)) throw new Error("Atomic temporary file must be beside its target.");
  await validateProjectPath(root, absoluteTemp, filesystem);
  let current = null;
  try { current = String(await fsMethod(filesystem, "readFile", nativeReadFile)(absoluteTarget, "utf8")); } catch (error) { if (!missingFile(error)) throw error; }
  if (before !== undefined && current !== before) throw new Error(`Atomic source changed before writing: ${absoluteTarget}`);
  let handle;
  try {
    handle = await fsMethod(filesystem, "open", nativeOpen)(absoluteTemp, "wx", mode);
    await handle.writeFile(after, "utf8");
    await handle.sync();
    await handle.chmod?.(mode);
    await handle.close();
    handle = null;
    await fsMethod(filesystem, "rename", nativeRename)(absoluteTemp, absoluteTarget);
    const syncDirectory = filesystem.fsyncDirectory ?? (async (directory) => {
      const directoryHandle = await nativeOpen(directory, "r");
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    });
    try { await syncDirectory(path.dirname(absoluteTarget)); } catch (error) { if (!["ENOTSUP", "EINVAL", "EISDIR"].includes(error?.code)) throw error; }
  } catch (error) {
    await handle?.close?.().catch?.(() => {});
    await fsMethod(filesystem, "rm", nativeRm)(absoluteTemp, { force: true }).catch?.(() => {});
    throw error;
  }
  return { safe: true, target: absoluteTarget };
}

export async function writeOwnershipState({ root, state, filesystem = {}, before, tempPath }) {
  const checked = validateOwnershipState(state, path.resolve(root));
  if (!checked.safe) throw new Error(checked.reason);
  const target = sidecarPath(root);
  await validateProjectPath(root, target, filesystem);
  await ensureSidecarDirectory(root, filesystem);
  return atomicTextWrite({ root, target, before, after: serializeOwnershipState(state), filesystem, tempPath, mode: 0o600 });
}

export async function persistOwnershipAfterSuccess({ action, state, write }) {
  if (action?.success !== true) return { updated: false, state, reason: "Ownership state waits for a successful associated action." };
  if (typeof write !== "function") throw new Error("Ownership persistence requires a write function.");
  await write(state);
  return { updated: true, state };
}

const comparable = (client, value) => value && SIDECAR_CLIENT_KEYS[client].every((key) => value[key] === undefined || typeof value[key] === "string") ? Object.fromEntries(SIDECAR_CLIENT_KEYS[client].filter((key) => value[key] !== undefined).map((key) => [key, value[key]])) : null;
const sameFacts = (left, right) => left && right && Object.keys(left).every((key) => left[key] === right[key]) && Object.keys(right).every((key) => left[key] === right[key]);

export function classifyOwnership({ client, state, observed, canonical }) {
  if (!Object.hasOwn(SIDECAR_CLIENT_KEYS, client) || observed?.safe === false) return { classification: "unknown", reason: "Unsupported or unsafe ownership observation." };
  const facts = comparable(client, observed);
  if (!facts) return { classification: "unknown", reason: "Ownership observation has invalid fields." };
  const validState = state && validateOwnershipState(state, state.projectRoot).safe;
  const record = validState ? state.clients[client] : undefined;
  if (state && !validState) return { classification: "unknown", reason: "Ownership sidecar is invalid or stale." };
  if (record) return sameFacts(record, facts) ? { classification: "owned" } : { classification: "unknown", reason: "Sidecar and project target disagree." };
  if (observed.absent === true) return { classification: "absent" };
  const intended = comparable(client, canonical);
  return intended && sameFacts(intended, facts) ? { classification: "matching" } : { classification: "foreign" };
}

function ignoreLines(content) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const finalNewline = content.endsWith(eol);
  const body = finalNewline ? content.slice(0, -eol.length) : content;
  return { eol, finalNewline, lines: body ? body.split(/\r\n|\n/) : [] };
}

export function inspectSidecarIgnoreRule(content) {
  const { lines } = ignoreLines(String(content ?? ""));
  let exact = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed === SIDECAR_IGNORE_RULE) { exact += 1; continue; }
    if (trimmed.startsWith("!") || /[\\*?\[\]]/.test(trimmed) || /(?:\.ticket-analyzer|setup-state\.json)/.test(trimmed) || trimmed.endsWith("/")) return stateError("The root ignore rules contain an ambiguous sidecar-related pattern.");
  }
  if (exact > 1) return stateError("The root ignore rule is duplicated.");
  return { safe: true, action: exact === 1 ? "existing" : "append", rule: SIDECAR_IGNORE_RULE };
}

const textDiff = (before, after) => {
  const oldLines = ignoreLines(before).lines;
  const newLines = ignoreLines(after).lines;
  const addedLines = newLines.slice(oldLines.length);
  const lines = ["--- .gitignore", "+++ .gitignore", `@@ -${oldLines.length ? 1 : 0},${oldLines.length} +1,${newLines.length} @@`];
  for (const line of oldLines) lines.push(` ${line}`);
  for (const line of addedLines) lines.push(`+${line}`);
  return lines.join("\n");
};

export function planSidecarIgnoreRule(content) {
  const before = String(content ?? "");
  const inspected = inspectSidecarIgnoreRule(before);
  if (!inspected.safe || inspected.action === "existing") return { ...inspected, before, after: before, diff: "" };
  const { eol, finalNewline } = ignoreLines(before);
  const after = !before ? `${SIDECAR_IGNORE_RULE}\n` : `${before}${finalNewline ? "" : eol}${SIDECAR_IGNORE_RULE}${finalNewline ? eol : ""}`;
  return { ...inspected, before, after, diff: textDiff(before, after) };
}

export async function inspectSidecarIgnoreRuleFile({ root, filesystem = {}, readFile }) {
  const target = path.join(root, ".gitignore");
  await validateProjectPath(root, target, filesystem);
  let content = "";
  try { content = String(await (readFile ?? fsMethod(filesystem, "readFile", nativeReadFile))(target, "utf8")); } catch (error) { if (!missingFile(error)) throw error; }
  return { ...planSidecarIgnoreRule(content), path: target };
}

export async function writeSidecarIgnoreRule({ root, before, filesystem = {}, tempPath }) {
  const target = path.join(root, ".gitignore");
  const plan = planSidecarIgnoreRule(before);
  if (!plan.safe) throw new Error(plan.reason);
  if (plan.action === "existing") return { safe: true, changed: false, target };
  return atomicTextWrite({ root, target, before, after: plan.after, filesystem, tempPath, mode: 0o644 });
}

export const CODEX_RELATIVE_CONFIG_PATH = ".codex/config.toml";
export const CODEX_TARGET_TABLE = "mcp_servers.ticket-analyzer";
export const CODEX_ENV_TABLE = `${CODEX_TARGET_TABLE}.env`;
export const CODEX_ENV_KEY = "TICKET_ANALYZER_ENV_FILE";
export const CODEX_COMMAND = "ticket-analyzer-mcp";
export const CODEX_TRUST_PRECONDITION =
  "Mark this project as trusted from Codex itself, then re-run setup. This manager never reads, creates, or changes any Codex trust setting.";
export const CODEX_REPLACEMENT_LOSS_WARNING =
  "Replacing this entry rewrites it from the canonical form: comments and formatting within the targeted entry are discarded, while every byte outside it is preserved.";

const tableHeader = /^\s*\[(\[?)\s*([^[\]]+?)\s*\](\]?)\s*$/;
const tablePair = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.*)$/;
const basicString = /^"(?:[^"\\]|\\.)*"$/;

const supportedValue = (raw) => {
  const { value } = splitValue(String(raw).trim());
  const trimmed = value.trim();
  if (!trimmed || /^("""|''')/.test(trimmed)) return false;
  if (trimmed.startsWith('"')) return basicString.test(trimmed);
  if (trimmed.startsWith("'")) return /^'[^']*'$/.test(trimmed);
  if (trimmed.startsWith("[")) return trimmed.endsWith("]") && !/["']/.test(trimmed.slice(1, -1).replaceAll(/"[^"]*"/g, ""));
  return !/["']/.test(trimmed);
};
const unquote = (raw) => {
  const { value } = splitValue(String(raw).trim());
  const trimmed = value.trim();
  if (basicString.test(trimmed)) { try { return JSON.parse(trimmed); } catch { return null; } }
  return /^'[^']*'$/.test(trimmed) ? trimmed.slice(1, -1) : null;
};
const skippable = (line) => !line.trim() || line.trimStart().startsWith("#");
const sectionEnd = (lines, headers, start) => {
  let end = (headers.find((header) => header.index > start)?.index ?? lines.length) - 1;
  while (end > start && skippable(lines[end])) end -= 1;
  return end;
};

export function locateCodexEntry(content) {
  const { lines } = ignoreLines(String(content ?? ""));
  const headers = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trimStart().startsWith("[")) continue;
    const match = tableHeader.exec(line);
    if (!match || Boolean(match[1]) !== Boolean(match[3])) return stateError(`Codex config has a malformed table header on line ${index + 1}.`);
    headers.push({ index, name: match[2], array: Boolean(match[1]) });
  }
  const targets = headers.filter((header) => header.name === CODEX_TARGET_TABLE);
  const envTables = headers.filter((header) => header.name === CODEX_ENV_TABLE);
  if ([...targets, ...envTables].some((header) => header.array)) return stateError("Codex config declares the target as an array of tables.");
  if (targets.length > 1 || envTables.length > 1) return stateError("Codex config declares the target table more than once.");
  if (!targets.length) {
    return envTables.length ? stateError("Codex config has the target env subtable without its table.") : { safe: true, present: false, lines };
  }

  const start = targets[0].index;
  const targetEnd = sectionEnd(lines, headers, start);
  let end = targetEnd;
  if (envTables.length) {
    const following = headers.find((header) => header.index > start);
    if (following?.index !== envTables[0].index) return stateError("Codex env subtable is not contiguous with its target table.");
    end = sectionEnd(lines, headers, envTables[0].index);
  }

  const observed = { configPath: CODEX_RELATIVE_CONFIG_PATH, table: CODEX_TARGET_TABLE, command: null, envFile: null };
  for (let index = start + 1; index <= end; index += 1) {
    const line = lines[index];
    if (skippable(line) || tableHeader.test(line)) continue;
    const pair = tablePair.exec(line);
    if (!pair || !supportedValue(pair[2])) return stateError(`Codex target entry has an unsupported or unterminated value on line ${index + 1}.`);
    if (index <= targetEnd && pair[1] === "command") observed.command = unquote(pair[2]);
    if (index > targetEnd && pair[1] === CODEX_ENV_KEY) observed.envFile = unquote(pair[2]);
  }
  return { safe: true, present: true, start, end, lines, observed };
}

const renderCodexDiff = ({ lines, start, removed, added }) => {
  const context = 3;
  const from = Math.max(0, start - context);
  const to = Math.min(lines.length, start + removed + context);
  return [
    `--- ${CODEX_RELATIVE_CONFIG_PATH}`,
    `+++ ${CODEX_RELATIVE_CONFIG_PATH}`,
    `@@ -${start + 1},${removed} +${start + 1},${added.length} @@`,
    ...lines.slice(from, start).map((line) => ` ${line}`),
    ...lines.slice(start, start + removed).map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    ...lines.slice(start + removed, to).map((line) => ` ${line}`),
  ].join("\n");
};

export function planCodexEntry({ content, envFile, intent = "add" }) {
  const before = String(content ?? "");
  if (typeof envFile !== "string" || !path.isAbsolute(envFile)) return stateError("Codex entry requires an absolute managed env-file path.");
  const located = locateCodexEntry(before);
  if (!located.safe) return located;

  const { eol, finalNewline, lines } = ignoreLines(before);
  const fragment = [
    `[${CODEX_TARGET_TABLE}]`,
    `command = ${quote(CODEX_COMMAND)}`,
    "args = []",
    "",
    `[${CODEX_ENV_TABLE}]`,
    `${CODEX_ENV_KEY} = ${quote(envFile)}`,
  ];
  const unchanged = { safe: true, changed: false, before, after: before, diff: "", observed: located.observed ?? null };

  if (intent === "remove") {
    if (!located.present) return { ...unchanged, action: "remove" };
    const { start, end } = located;
    const nextLines = [...lines.slice(0, start), ...lines.slice(end + 1)];
    let trimmed = nextLines;
    if (start === 0) while (trimmed.length && !trimmed[0].trim()) trimmed = trimmed.slice(1);
    else if (!lines[start - 1].trim() && nextLines[start] !== undefined && !nextLines[start].trim()) {
      trimmed = [...nextLines.slice(0, start), ...nextLines.slice(start + 1)];
    }
    return {
      safe: true,
      action: "remove",
      changed: true,
      before,
      after: trimmed.join(eol) + (finalNewline ? eol : ""),
      diff: renderCodexDiff({ lines, start, removed: end - start + 1, added: [] }),
      observed: located.observed,
    };
  }

  if (!located.present) {
    const prefix = before === "" ? "" : before.endsWith(eol) ? before : `${before}${eol}`;
    return {
      safe: true,
      action: "add",
      changed: true,
      before,
      after: `${prefix}${fragment.join(eol)}${eol}`,
      diff: renderCodexDiff({ lines, start: lines.length, removed: 0, added: fragment }),
      observed: null,
    };
  }

  const { start, end } = located;
  const current = lines.slice(start, end + 1);
  if (current.length === fragment.length && current.every((line, index) => line === fragment[index])) {
    return { ...unchanged, action: "replace" };
  }
  return {
    safe: true,
    action: "replace",
    changed: true,
    before,
    after: [...lines.slice(0, start), ...fragment, ...lines.slice(end + 1)].join(eol) + (finalNewline ? eol : ""),
    diff: renderCodexDiff({ lines, start, removed: end - start + 1, added: fragment }),
    observed: located.observed,
    replacementLossWarning: CODEX_REPLACEMENT_LOSS_WARNING,
  };
}

export function acknowledgeCodexTrust({ acknowledged } = {}) {
  return acknowledged === true
    ? { acknowledged: true, blocked: false }
    : { acknowledged: false, blocked: true, reason: "Codex project trust was not acknowledged for this run.", recovery: CODEX_TRUST_PRECONDITION };
}
