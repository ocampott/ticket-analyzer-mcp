import crypto from "node:crypto";
import path from "node:path";
import { lstat as nativeLstat, readFile as nativeReadFile, realpath as nativeRealpath } from "node:fs/promises";
import {
  CODEX_RELATIVE_CONFIG_PATH,
  ENV_PRECEDENCE_WARNING,
  PROVIDER_ENV_VARS,
  editProviderEnv,
  inspectSidecarIgnoreRuleFile,
  resolveManagedEnvPath,
  validateProjectPath,
} from "./setup-files.js";
import { ClaudeAdapter, CodexAdapter, inspectClaudeProjectConfig } from "./setup-adapters.js";

const notFound = (error) => error?.code === "ENOENT";
const nativeFilesystem = { lstat: nativeLstat, realpath: nativeRealpath, readFile: nativeReadFile };
const privatePlanInputs = new WeakMap();
const SECRET_VALUE_PATTERN = /((?:token|secret|password|api[_-]?key|pat)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi;

function redactText(value, secretValues = []) {
  let safe = String(value ?? "");
  for (const secret of [...new Set(secretValues)].filter((item) => typeof item === "string" && item.length > 0).sort((a, b) => b.length - a.length)) {
    safe = safe.replaceAll(secret, "[redacted]");
  }
  return safe.replace(SECRET_VALUE_PATTERN, "$1[redacted]");
}

function redactValue(value, secretValues = []) {
  if (typeof value === "string") return redactText(value, secretValues);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secretValues));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item, secretValues)]));
}

async function kind(filesystem, target) {
  try {
    const stat = await filesystem.lstat(target);
    return stat.isSymbolicLink?.() ? "symlink" : stat.isDirectory?.() ? "directory" : stat.isFile?.() ? "file" : "other";
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

function ancestors(start) {
  const result = [];
  let current = path.resolve(start);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) return result;
    current = parent;
  }
}

export async function resolveProjectRoot(cwd, filesystem) {
  if (!filesystem?.realpath || !filesystem?.lstat) throw new Error("Project-root resolution requires an injected filesystem.");
  const canonicalCwd = await filesystem.realpath(cwd);
  for (const candidate of ancestors(canonicalCwd)) {
    const git = await kind(filesystem, path.join(candidate, ".git"));
    if (git === "directory" || git === "file") return { root: candidate, canonicalRoot: candidate };
  }
  for (const candidate of ancestors(canonicalCwd)) {
    if ((await kind(filesystem, path.join(candidate, "package.json"))) === "file") {
      return { root: candidate, canonicalRoot: candidate };
    }
  }
  throw new Error("Cannot resolve a project root: run setup inside a Git worktree or a project containing package.json.");
}

function canonical(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function stable(value) {
  return JSON.stringify(canonical(value));
}

function digest(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function redactedProviderOperation(operation = {}, secretValues = []) {
  const safe = redactValue(operation, secretValues);
  return {
    provider: safe.provider,
    action: safe.action ?? safe.kind ?? "update",
    affectedLines: (safe.affectedLines ?? []).map(({ key, action, before, after }) => ({
      key, action, before, after,
    })),
    redactedDiff: safe.redactedDiff ?? "",
    warning: safe.warning ?? ENV_PRECEDENCE_WARNING,
  };
}

function publicFiles(files = {}, secretValues = []) {
  return Object.fromEntries(Object.entries(files).map(([name, file = {}]) => {
    const safe = redactValue(file, secretValues);
    const result = { path: safe.path, action: safe.action, diff: safe.diff, change: safe.change };
    if (name !== "env") {
      if (safe.before !== undefined) result.before = safe.before;
      if (safe.after !== undefined) result.after = safe.after;
    }
    return [name, Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined))];
  }));
}

function safeSnapshotEntries(snapshots = {}) {
  return Object.fromEntries(Object.entries(snapshots).filter(([key]) => !/(?:trust|codex[_-]?home|home[\\/]|homeConfig|^home$)/i.test(key)));
}

function publicSnapshots(snapshots = {}) {
  const safe = safeSnapshotEntries(snapshots);
  return Object.fromEntries(Object.keys(safe).sort().map((key) => [key, digest(safe[key])]));
}

function identityInput(input, files, snapshots, providerOperations, clientOperations, blockedOperations) {
  return {
    root: input.canonicalRoot ?? input.root,
    selections: input.selections ?? {},
    providerOperations,
    clientOperations,
    blockedOperations,
    files,
    decisions: input.decisions ?? {},
    snapshots,
    executables: input.executables ?? {},
  };
}

export function computePlanId(plan, secretInputs = [], snapshots) {
  const stored = privatePlanInputs.get(plan);
  const input = stored?.identity ?? {
    root: plan.root,
    selections: plan.selections,
    providerOperations: plan.providerOperations,
    clientOperations: plan.clientOperations,
    blockedOperations: plan.blockedOperations,
    files: plan.files,
    decisions: plan.decisions,
    snapshots: snapshots ?? plan.snapshots,
    executables: plan.executables,
  };
  const identity = snapshots === undefined ? input : { ...input, snapshots: safeSnapshotEntries(snapshots) };
  const secretDigest = secretInputs.length > 0 ? digest(secretInputs) : stored?.secretDigest ?? digest([]);
  return digest({ identity, secretDigest });
}

export function buildPlan(input = {}) {
  const secretValues = [...new Set(input.secretInputs ?? [])].filter((value) => typeof value === "string" && value.length > 0);
  const providerOperations = (input.providerOperations ?? []).map((operation) => redactedProviderOperation(operation, secretValues));
  const clientOperations = (input.clientOperations ?? []).map((operation) => {
    const safe = redactValue(operation, secretValues);
    return {
      ...safe,
      argv: safe.argv ? [...safe.argv] : [],
      before: safe.before,
      after: safe.after,
    };
  });
  const blockedOperations = (input.blockedOperations ?? []).map((operation) => redactValue(operation, secretValues));
  const snapshots = safeSnapshotEntries(input.snapshots ?? {});
  const files = publicFiles(input.files ?? {}, secretValues);
  const operations = (input.operations ?? []).map((operation) => redactValue(operation, secretValues));
  const identity = identityInput(input, input.files ?? {}, snapshots, providerOperations, clientOperations, blockedOperations);
  const plan = {
    version: 1,
    root: input.canonicalRoot ?? input.root,
    envPath: input.envPath ?? (input.root ? resolveManagedEnvPath(input.root) : undefined),
    selections: input.selections ?? { providers: [], clients: [] },
    providerOperations,
    files,
    clientOperations,
    blockedOperations,
    operations,
    decisions: redactValue(input.decisions ?? {}, secretValues),
    snapshots: publicSnapshots(snapshots),
    executables: redactValue(input.executables ?? {}, secretValues),
    planId: "",
  };
  const secretDigest = digest(secretValues);
  plan.planId = digest({ identity, secretDigest });
  privatePlanInputs.set(plan, { identity, secretDigest, snapshots, secretValues });
  return freeze(plan);
}

function display(value) {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function renderPlan(plan) {
  const lines = ["Unified project setup plan", `Project root: ${plan.root}`, `Plan ID: ${plan.planId}`];
  const providers = plan.selections?.providers ?? [];
  const clients = plan.selections?.clients ?? [];
  lines.push(`Selected providers: ${providers.length ? providers.join(", ") : "none"}`);
  lines.push(`Selected clients: ${clients.length ? clients.join(", ") : "none"}`);
  for (const operation of plan.providerOperations ?? []) {
    lines.push(`Provider ${operation.provider}: ${operation.action}`);
    if (operation.redactedDiff) lines.push(operation.redactedDiff);
    for (const line of operation.affectedLines ?? []) lines.push(`  ${line.action} ${line.key}: ${line.before ?? "(absent)"} -> ${line.after ?? "(absent)"}`);
    if (operation.warning) lines.push(`  ${operation.warning}`);
  }
  for (const [name, file] of Object.entries(plan.files ?? {})) {
    lines.push(`File ${name}: ${file.path}`);
    if (file.diff) lines.push(file.diff);
    if (file.change) lines.push(display(file.change));
  }
  for (const operation of plan.clientOperations ?? []) {
    lines.push(`Client ${operation.client ?? "unknown"}: ${operation.kind ?? operation.action ?? "operation"}`);
    if (operation.executable) lines.push(`  executable: ${operation.executable}`);
    if (operation.argv) lines.push(`  argv: ${JSON.stringify(operation.argv)}`);
    if (operation.before !== undefined) lines.push(`  before: ${display(operation.before)}`);
    if (operation.after !== undefined) lines.push(`  after: ${display(operation.after)}`);
  }
  for (const blocked of plan.blockedOperations ?? []) lines.push(`Blocked ${blocked.client ?? blocked.id ?? "operation"}: ${blocked.reason}`);
  if (plan.operations?.length) lines.push(`Operations: ${plan.operations.map((operation) => operation.id ?? operation.client ?? "operation").join(" -> ")}`);
  lines.push("No provider credential values are displayed or persisted.");
  return lines.join("\n");
}

function currentSnapshotMatches(plan, current) {
  if (!current) return true;
  if (current.planId && current.planId !== plan.planId) return false;
  if (current.root && current.root !== plan.root) return false;
  return stable(publicSnapshots(current)) === stable(plan.snapshots);
}

function failureMessage(error, secretValues = []) {
  const details = error instanceof Error
    ? [error.message, error.stdout, error.stderr, error.output]
    : [error?.message, error?.stdout, error?.stderr, error?.output, error];
  return details.filter((detail) => detail !== undefined && detail !== null).map((detail) => redactText(detail, secretValues)).join(" | ");
}

function operationId(operation) {
  return operation.id ?? operation.client ?? "operation";
}

function operationFingerprint(operation) {
  return stable({ ...operation, execute: undefined });
}

async function replan(currentPlan, reason, completed, dependencies) {
  if (typeof dependencies.replan !== "function") return null;
  const nextPlan = await dependencies.replan(currentPlan, { reason, completed: [...completed] });
  if (!nextPlan || nextPlan === currentPlan) return null;
  await dependencies.renderPlan?.(nextPlan);
  return nextPlan;
}

export async function executePlan(initialPlan, dependencies = {}) {
  const initialPrivate = privatePlanInputs.get(initialPlan);
  let plan = initialPlan;
  let operations = plan.operations ?? [];
  let index = 0;
  let confirmationNeeded = true;
  let replans = 0;
  const completed = [];
  const completedOperations = new Map();
  const maxReplans = dependencies.maxReplans ?? 3;

  while (true) {
    if (confirmationNeeded) {
      const current = await dependencies.current?.();
      if (!currentSnapshotMatches(plan, current)) {
        if (replans >= maxReplans) {
          return { status: "invalidated", reason: "Setup plan is stale because a selected input changed; a new plan and confirmation are required.", completed, failed: null, unattempted: operations.slice(index).map(operationId) };
        }
        const nextPlan = await replan(plan, "Setup plan is stale because a selected input changed.", completed, dependencies);
        if (!nextPlan) {
          return { status: "invalidated", reason: "Setup plan is stale because a selected input changed; a new plan and confirmation are required.", completed, failed: null, unattempted: operations.slice(index).map(operationId) };
        }
        plan = nextPlan;
        operations = plan.operations ?? [];
        index = 0;
        replans += 1;
        continue;
      }
      const confirmed = dependencies.confirm ? await dependencies.confirm(plan) : true;
      if (!confirmed) return { status: "cancelled", completed, failed: null, unattempted: operations.slice(index).map(operationId) };
      confirmationNeeded = false;
    }

    for (; index < operations.length; index += 1) {
      const current = await dependencies.current?.();
      if (!currentSnapshotMatches(plan, current)) {
        if (replans >= maxReplans) {
          return { status: "invalidated", reason: "Setup plan changed before execution; confirmation is no longer valid.", completed, failed: null, unattempted: operations.slice(index).map(operationId) };
        }
        const nextPlan = await replan(plan, "Setup plan changed before execution; confirmation is no longer valid.", completed, dependencies);
        if (!nextPlan) {
          return { status: "invalidated", reason: "Setup plan changed before execution; confirmation is no longer valid.", completed, failed: null, unattempted: operations.slice(index).map(operationId) };
        }
        plan = nextPlan;
        operations = plan.operations ?? [];
        index = 0;
        replans += 1;
        confirmationNeeded = true;
        break;
      }
      const operation = operations[index];
      const id = operationId(operation);
      if (completedOperations.get(id) === operationFingerprint(operation)) continue;
      try {
        if (typeof dependencies.executeOperation === "function") await dependencies.executeOperation(operation, plan);
        else if (typeof operation.execute === "function") await operation.execute(plan);
        completed.push(id);
        completedOperations.set(id, operationFingerprint(operation));
      } catch (error) {
        const secretValues = [...new Set([
          ...(initialPrivate?.secretValues ?? []),
          ...(privatePlanInputs.get(plan)?.secretValues ?? []),
        ])];
        return {
          status: "failed",
          completed,
          failed: { id, reason: failureMessage(error, secretValues) },
          unattempted: operations.slice(index + 1).map(operationId),
          rollback: "not attempted",
        };
      }
    }
    if (index < operations.length) continue;
    return { status: "completed", completed, failed: null, unattempted: [] };
  }
}

function writeOutput(stdout, text) {
  stdout.write(`${text}\n`);
}

function clientAdapter(client, adapters, dependencies) {
  if (adapters?.[client]) return adapters[client];
  if (client === "codex") {
    return new CodexAdapter({
      readConfig: dependencies.readCodexConfig ?? ((context) => readCodexProjectConfig({ ...context, filesystem: dependencies.filesystem })),
      writeConfig: dependencies.writeCodexConfig,
    });
  }
  if (client !== "claude") return null;
  return new ClaudeAdapter({
    resolveExecutable: dependencies.resolveExecutable,
    runCommand: dependencies.runCommand,
    inspectProjectConfig: dependencies.inspectProjectConfig ?? ((context) => inspectClaudeProjectConfig({ ...context, filesystem: dependencies.filesystem })),
  });
}

async function readCodexProjectConfig({ root, filesystem = nativeFilesystem }) {
  const target = path.join(root, CODEX_RELATIVE_CONFIG_PATH);
  await validateProjectPath(root, target, filesystem);
  try {
    return String(await (filesystem.readFile ?? nativeReadFile)(target, "utf8"));
  } catch (error) {
    if (notFound(error)) return "";
    throw error;
  }
}

async function discoverClientOperations({
  clients = [],
  root,
  state,
  environment = {},
  decisions = {},
  intents = {},
  acknowledgements = {},
  adapters = {},
  dependencies = {},
} = {}) {
  const clientOperations = [];
  const blockedOperations = [];
  const operations = [];
  const discoveries = {};

  for (const client of clients) {
    const adapter = clientAdapter(client, adapters, dependencies);
    if (!adapter) {
      blockedOperations.push({ client, reason: "Client-specific discovery is not enabled in this work unit; rerun setup after the client adapter is available." });
      continue;
    }
    let discovery;
    try {
      discovery = await adapter.discover({ root, state, environment, acknowledgement: acknowledgements[client] });
    } catch {
      blockedOperations.push({ client, reason: "Client discovery failed safely; recover the project registration manually." });
      continue;
    }
    discoveries[client] = discovery;
    const operation = adapter.buildOperation({ discovery, decision: decisions[client], intent: intents[client] ?? "add", acknowledgement: acknowledgements[client] });
    if (operation?.blocked) {
      blockedOperations.push({ client, reason: operation.reason ?? discovery?.reason ?? "Client operation is unavailable." });
      continue;
    }
    clientOperations.push(operation);
    operations.push({
      ...operation,
      id: client,
      execute: async () => adapter.execute(operation, {
        state,
        environment,
        runCommand: dependencies.runCommand,
        ensureIgnoreRule: dependencies.ensureIgnoreRule,
        writeOwnership: dependencies.writeOwnership,
        discover: async ({ root: operationRoot }) => adapter.discover({ root: operationRoot, state, environment }),
      }),
    });
  }

  return { clientOperations, blockedOperations, operations, discoveries };
}

export async function setupCommand(options = {}) {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const prompt = options.promptAdapter ?? {};
  if (!options.dryRun && typeof options.confirm !== "function" && (!stdin.isTTY || !stdout.isTTY)) {
    writeOutput(stdout, "Setup requires interactive input and output, or explicit inputs; refusing to mutate from a non-TTY.");
    return 1;
  }
  if (options.plan) {
    writeOutput(stdout, renderPlan(options.plan));
    if (options.dryRun) {
      writeOutput(stdout, "Dry-run: no prompts, writes, or client processes are executed.");
      return 0;
    }
    const result = await executePlan(options.plan, {
      confirm: options.confirm ?? (async (plan) => prompt.confirm?.({ message: `Apply the complete setup plan ${plan.planId}?` }) ?? false),
      current: options.current,
      replan: options.replan,
      renderPlan: async (plan) => writeOutput(stdout, renderPlan(plan)),
      executeOperation: options.executeOperation,
    });
    if (result.status !== "completed") writeOutput(stdout, `Setup stopped: ${result.reason ?? result.failed?.reason ?? result.status}.`);
    return result.status === "completed" ? 0 : 1;
  }

  const cwd = options.cwd ?? process.cwd();
  const filesystem = options.filesystem ?? nativeFilesystem;
  let project;
  try {
    project = await resolveProjectRoot(cwd, filesystem);
  } catch (error) {
    writeOutput(stdout, error.message);
    return 1;
  }
  const root = project.canonicalRoot;
  const suppliedSelections = options.selections ?? (options.dryRun ? null : undefined);
  if (options.dryRun && !suppliedSelections) {
    writeOutput(stdout, "Dry-run requires explicit provider and client selections; no prompts or mutations were performed.");
    return 1;
  }
  const selectedProviders = options.selections?.providers ?? (await prompt.providers?.() ?? []);
  const selectedClients = options.selections?.clients ?? (await prompt.client?.() ?? []);
  const providers = [...new Set(selectedProviders)].filter(Boolean);
  const clients = [...new Set(selectedClients)].filter(Boolean);
  const envPath = resolveManagedEnvPath(root);
  const providerValues = {};
  const secretInputs = [];
  for (const provider of providers) {
    const values = {};
    const suppliedValues = options.providerValues?.[provider] ?? {};
    for (const key of PROVIDER_ENV_VARS[provider] ?? []) {
      const value = suppliedValues[key] ?? (options.dryRun ? undefined : await prompt.password?.({ message: `${key}: ` }) ?? await prompt.input?.({ message: `${key}: ` }));
      if (value) { values[key] = value; secretInputs.push(value); }
    }
    providerValues[provider] = values;
  }
  const makePlan = async () => {
    let envBefore = "";
    try { envBefore = String(await (filesystem.readFile ?? nativeReadFile)(envPath, "utf8")); } catch (error) { if (!notFound(error)) throw error; }
    const providerOperations = [];
    for (const provider of providers) {
      const values = providerValues[provider] ?? {};
      if (Object.keys(values).length) {
        const edit = editProviderEnv(envBefore, { provider, updates: values });
        if (!edit.safe) providerOperations.push({ provider, action: "blocked", redactedDiff: edit.reason });
        else providerOperations.push({ provider, action: "update", ...edit });
      }
    }
    let ignore;
    let ignoreBefore = "";
    if (clients.length) {
      try { ignore = await inspectSidecarIgnoreRuleFile({ root, filesystem }); ignoreBefore = ignore.before; } catch (error) { ignore = { safe: false, reason: error.message }; }
    }
    const clientPlan = await discoverClientOperations({
      clients,
      root,
      state: options.state,
      environment: options.environment ?? options.env ?? process.env,
      decisions: options.decisions,
      intents: options.clientIntents,
      acknowledgements: options.acknowledgements,
      adapters: options.adapters,
      dependencies: {
        resolveExecutable: options.resolveExecutable,
        runCommand: options.runCommand,
        inspectProjectConfig: options.inspectProjectConfig,
        readCodexConfig: options.readCodexConfig,
        writeCodexConfig: options.writeCodexConfig,
        filesystem,
        ensureIgnoreRule: options.ensureIgnoreRule,
        writeOwnership: options.writeOwnership,
      },
    });
    return buildPlan({
      root,
      envPath,
      selections: { providers, clients },
      providerOperations,
      clientOperations: clientPlan.clientOperations,
      files: {
        env: { path: envPath, diff: providerOperations.map((operation) => operation.redactedDiff).filter(Boolean).join("\\n") },
        ...(clients.length ? { ignore: { path: path.join(root, ".gitignore"), diff: ignore?.diff ?? "", action: ignore?.action } } : {}),
      },
      blockedOperations: clientPlan.blockedOperations,
      decisions: options.decisions ?? {},
      snapshots: { env: envBefore, ignore: ignoreBefore, selections: { providers, clients }, clientDiscovery: clientPlan.discoveries },
      secretInputs,
      operations: options.operations ?? clientPlan.operations,
    });
  };
  const plan = await makePlan();
  writeOutput(stdout, renderPlan(plan));
  if (options.dryRun) {
    writeOutput(stdout, "Dry-run: no prompts, writes, or client processes are executed.");
    return 0;
  }
  const result = await executePlan(plan, {
    confirm: options.confirm ?? (async (currentPlan) => prompt.confirm?.({ message: `Apply the complete setup plan ${currentPlan.planId}?` }) ?? false),
    current: options.current ?? (async () => {
      let currentEnv = "";
      try { currentEnv = String(await (filesystem.readFile ?? nativeReadFile)(envPath, "utf8")); } catch (error) { if (!notFound(error)) throw error; }
      let currentIgnore = "";
      try { currentIgnore = String(await (filesystem.readFile ?? nativeReadFile)(path.join(root, ".gitignore"), "utf8")); } catch (error) { if (!notFound(error)) throw error; }
      return { env: currentEnv, ignore: currentIgnore, selections: { providers, clients } };
    }),
    replan: options.replan ?? (async () => makePlan()),
    renderPlan: async (currentPlan) => writeOutput(stdout, renderPlan(currentPlan)),
    executeOperation: options.executeOperation,
  });
  if (result.status === "completed") writeOutput(stdout, "Setup plan confirmed; no client-specific mutations are available in this work unit.");
  else writeOutput(stdout, `Setup stopped: ${result.reason ?? result.failed?.reason ?? result.status}.`);
  prompt.close?.();
  return result.status === "completed" ? 0 : 1;
}
