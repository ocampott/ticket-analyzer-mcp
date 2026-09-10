import path from "node:path";

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
