import { describe, expect, jest, test } from "@jest/globals";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  PROVIDER_ENV_VARS,
  editProviderEnv,
  prepareAtomicWrite,
  resolveManagedEnvPath,
  validateProjectPath,
  buildOwnershipState,
  validateOwnershipState,
  parseOwnershipState,
  serializeOwnershipState,
  readOwnershipState,
  writeOwnershipState,
  persistOwnershipAfterSuccess,
  classifyOwnership,
  SIDECAR_IGNORE_RULE,
  inspectSidecarIgnoreRule,
  planSidecarIgnoreRule,
  inspectSidecarIgnoreRuleFile,
  CODEX_RELATIVE_CONFIG_PATH,
  CODEX_TARGET_TABLE,
  CODEX_TRUST_PRECONDITION,
  CODEX_REPLACEMENT_LOSS_WARNING,
  acknowledgeCodexTrust,
  locateCodexEntry,
  planCodexEntry,
} from "./setup-files.js";
import {
  CLIENT_EXECUTION_ORDER,
  buildPlan,
  computePlanId,
  executePlan,
  orderSetupOperations,
  renderPlan,
  resolveProjectRoot,
  setupCommand,
} from "./setup-manager.js";
import {
  ClaudeAdapter,
  CodexAdapter,
  PiAdapter,
  PiSettingsInspector,
  PI_MANUAL_RECOVERY,
  PI_SETTINGS_RELATIVE_PATH,
  inspectClaudeProjectConfig,
  renderClaudeOperation,
} from "./setup-adapters.js";

const ENOENT = () => Object.assign(new Error("missing"), { code: "ENOENT" });
// Bound a source-boundary assertion to one declaration so it cannot silently widen to
// whatever module code happens to follow it.
function declarationSource(source, marker) {
  const body = source.slice(source.indexOf(marker));
  const next = body.indexOf("\nexport ", 1);
  return next === -1 ? body : body.slice(0, next);
}
function memoryFs(entries, canonical = "/workspace/repo") {
  return {
    async realpath(value) { return value === "/workspace/link" ? canonical : value; },
    async lstat(value) {
      const item = entries[value];
      if (!item) throw ENOENT();
      return { isDirectory: () => item === "dir", isFile: () => item === "file", isSymbolicLink: () => item === "link" };
    },
  };
}

describe("setup manager PR 1 guardrails", () => {
  test("resolves nearest git/worktree root, then package root, and rejects incidental cwd", async () => {
    const fs = memoryFs({ "/workspace/repo": "dir", "/workspace/repo/.git": "file", "/workspace/repo/app": "dir" });
    await expect(resolveProjectRoot("/workspace/repo/app", fs)).resolves.toEqual({ root: "/workspace/repo", canonicalRoot: "/workspace/repo" });
    const packageFs = memoryFs({ "/workspace/pkg": "dir", "/workspace/pkg/app": "dir", "/workspace/pkg/package.json": "file" });
    await expect(resolveProjectRoot("/workspace/pkg/app", packageFs)).resolves.toEqual({ root: "/workspace/pkg", canonicalRoot: "/workspace/pkg" });
    await expect(resolveProjectRoot("/tmp", memoryFs({ "/tmp": "dir" }))).rejects.toThrow(/Cannot resolve a project root/);
  });

  test("uses canonical project .env and never reads inherited provider values", () => {
    expect(resolveManagedEnvPath("/workspace/repo", { TICKET_ANALYZER_ENV_FILE: "/tmp/secret.env" })).toBe(path.join("/workspace/repo", ".env"));
    expect(PROVIDER_ENV_VARS).toEqual({ trello: ["TRELLO_API_KEY", "TRELLO_TOKEN"], jira: ["JIRA_HOST", "JIRA_EMAIL", "JIRA_API_TOKEN"], azure: ["AZURE_DEVOPS_ORG", "AZURE_DEVOPS_PROJECT", "AZURE_DEVOPS_PAT"] });
    const result = editProviderEnv("KEEP=yes\n", { provider: "jira", updates: { JIRA_HOST: "jira.example" } });
    expect(result).toMatchObject({ safe: true, changed: true });
    expect(JSON.stringify(result)).not.toContain("process.env");
  });

  test("rejects symlinked files, roots, and parents outside the root", async () => {
    const fs = memoryFs({ "/repo": "dir", "/repo/.env": "link", "/repo/link": "link", "/repo/sub": "dir" });
    await expect(validateProjectPath("/repo", "/repo/.env", fs)).rejects.toThrow(/symlink/i);
    await expect(validateProjectPath("/repo", "/repo/.env", memoryFs({ "/repo": "link" }))).rejects.toThrow(/symlink/i);
    await expect(validateProjectPath("/repo", "/repo/link/file", fs)).rejects.toThrow(/symlink/i);
    await expect(validateProjectPath("/repo", "/else/.env", fs)).rejects.toThrow(/outside/i);
  });

  test("edits and removes only selected provider assignments while preserving bytes and style", async () => {
    const before = "# keep\r\nexport JIRA_HOST = old\r\nTRELLO_TOKEN=untouched\r\nJIRA_EMAIL=person@example.com\r\n";
    const result = editProviderEnv(before, { provider: "jira", updates: { JIRA_HOST: "new.example" }, remove: ["JIRA_EMAIL"] });
    const prepared = await prepareAtomicWrite({ root: "/repo", target: "/repo/.env", before, editResult: result, filesystem: memoryFs({ "/repo": "dir" }) });
    expect(prepared.content).toBe("# keep\r\nexport JIRA_HOST = \"new.example\"\r\nTRELLO_TOKEN=untouched\r\n");
    expect(Object.keys(prepared)).not.toContain("content");
    expect(result.redactedDiff).toContain("- export JIRA_HOST = [redacted]");
    expect(result.redactedDiff).toContain("+ export JIRA_HOST = [redacted]");
    expect(result.redactedDiff).toContain("- JIRA_EMAIL=[redacted]");
    expect(result.redactedDiff).not.toContain("person@example.com");
    expect(result.warning).toMatch(/inherited process environment variable overrides \.env/i);
    expect(result.affectedLines).toEqual([
      { key: "JIRA_HOST", action: "edit", before: "export JIRA_HOST = [redacted]", after: "export JIRA_HOST = [redacted]" },
      { key: "JIRA_EMAIL", action: "remove", before: "JIRA_EMAIL=[redacted]", after: null },
    ]);
    expect(JSON.stringify(result.affectedLines)).not.toContain("person@example.com");
  });

  test("preserves unambiguous inline comments and no-final-newline style", async () => {
    const inline = editProviderEnv("JIRA_HOST=old # keep this", { provider: "jira", updates: { JIRA_HOST: "new" } });
    const appended = editProviderEnv("KEEP=yes", { provider: "trello", updates: { TRELLO_TOKEN: "x" } });
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", before: "JIRA_HOST=old # keep this", editResult: inline, filesystem: memoryFs({ "/repo": "dir" }) })).resolves.toHaveProperty("content", 'JIRA_HOST="new" # keep this');
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", before: "KEEP=yes", editResult: appended, filesystem: memoryFs({ "/repo": "dir" }) })).resolves.toHaveProperty("content", 'KEEP=yes\nTRELLO_TOKEN="x"');
  });

  test("never exposes raw credential text in the public edit result", () => {
     const secret = "jira-secret-value";
     const result = editProviderEnv("JIRA_API_TOKEN=old-secret\n", { provider: "jira", updates: { JIRA_API_TOKEN: secret } });
     expect(Object.getOwnPropertyNames(result)).not.toContain("after");
     expect(Object.keys(result)).not.toContain("after");
     expect(JSON.stringify(result)).not.toContain(secret);
     expect(JSON.stringify(result)).not.toContain("old-secret");
     expect(result.affectedLines).toEqual([
       { key: "JIRA_API_TOKEN", action: "edit", before: "JIRA_API_TOKEN=[redacted]", after: "JIRA_API_TOKEN=[redacted]" },
     ]);
   });

   test("redacts public add and remove results as well as edits", () => {
    const added = editProviderEnv("KEEP=yes\n", { provider: "trello", updates: { TRELLO_TOKEN: "add-secret" } });
    const removed = editProviderEnv("TRELLO_TOKEN=remove-secret\n", { provider: "trello", remove: ["TRELLO_TOKEN"] });
    for (const result of [added, removed]) {
      expect(Object.getOwnPropertyNames(result)).not.toContain("after");
      expect(JSON.stringify(result)).not.toMatch(/(?:add-secret|remove-secret)/);
    }
    expect(added.affectedLines).toEqual([{ key: "TRELLO_TOKEN", action: "add", before: null, after: "TRELLO_TOKEN=[redacted]" }]);
    expect(removed.affectedLines).toEqual([{ key: "TRELLO_TOKEN", action: "remove", before: "TRELLO_TOKEN=[redacted]", after: null }]);
  });

   test("safe-exits on duplicate, multiline selected values, and odd continuation parity", async () => {
    expect(editProviderEnv("JIRA_HOST=a\nJIRA_HOST=b\n", { provider: "jira", updates: { JIRA_HOST: "c" } })).toMatchObject({ safe: false });
    expect(editProviderEnv("JIRA_HOST=\"unterminated\n", { provider: "jira", updates: { JIRA_HOST: "c" } })).toMatchObject({ safe: false });
    for (const count of [1, 3, 5]) {
      expect(editProviderEnv(`JIRA_HOST=value${"\\".repeat(count)}\n`, { provider: "jira", updates: { JIRA_HOST: "replacement" } })).toMatchObject({ safe: false });
    }
    for (const count of [2, 4]) {
      expect(editProviderEnv(`JIRA_HOST=value${"\\".repeat(count)}\n`, { provider: "jira", updates: { JIRA_HOST: "replacement" } })).toMatchObject({ safe: true });
    }
    const appended = editProviderEnv("", { provider: "trello", updates: { TRELLO_TOKEN: "x" } });
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", before: "", editResult: appended, filesystem: memoryFs({ "/repo": "dir" }) })).resolves.toHaveProperty("content", 'TRELLO_TOKEN="x"');
  });

  test("prepares atomic writes only under a validated directory root and beside the target", async () => {
    const fs = memoryFs({ "/repo": "dir" });
    const editResult = editProviderEnv("", { provider: "trello", updates: { TRELLO_TOKEN: "x" } });
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", before: "", editResult, mode: 0o644, existing: false, filesystem: fs })).resolves.toMatchObject({ mode: 0o600, tempPath: "/repo/.env.tmp-setup-manager" });
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", before: "", editResult, mode: 0o644, existing: true, filesystem: fs })).resolves.toMatchObject({ mode: 0o644 });
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "/tmp/.env.tmp", before: "", editResult, filesystem: fs })).rejects.toThrow(/outside project root/i);
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "relative.tmp", before: "", editResult, filesystem: fs })).rejects.toThrow(/absolute/i);
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "/repo/sub/.env.tmp", before: "", editResult, filesystem: fs })).rejects.toThrow(/same directory/i);
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "/repo/.env", before: "", editResult, filesystem: fs })).rejects.toThrow(/differ/i);
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "/repo/.env.tmp", before: "", editResult, filesystem: memoryFs({ "/repo": "link" }) })).rejects.toThrow(/symlink/i);
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "/repo/.env.tmp", before: "", editResult, filesystem: memoryFs({ "/repo": "file" }) })).rejects.toThrow(/not a directory/i);
    await expect(prepareAtomicWrite({ root: "/repo", target: "/repo/.env", tempPath: "/repo/.env.tmp", before: "", editResult, filesystem: memoryFs({ "/repo": "dir", "/repo/.env.tmp": "link" }) })).rejects.toThrow(/symlink/i);
  });

  test("requires a real directory root for file-path validation", async () => {
    await expect(validateProjectPath("/repo", "/repo/.env", memoryFs({ "/repo": "file" }))).rejects.toThrow(/not a directory/i);
  });

  test("validates schema-v1 ownership facts without serializing secrets or stale roots", () => {
    const state = buildOwnershipState("/repo", {
      claude: { registrationId: "ticket-analyzer", scope: "project", command: "ticket-analyzer-mcp", envFile: "/repo/.env" },
      pi: { settingsPath: ".pi/settings.json", packageName: "ticket-analyzer-mcp", packageSpec: "npm:ticket-analyzer-mcp@3.0.0", scope: "local", environmentBinding: "runtime-cwd-env" },
    });
    const serialized = JSON.stringify(state);
    expect(serialized).not.toMatch(/secret|token|password|process\\.env/i);
    expect(validateOwnershipState(state, "/repo")).toMatchObject({ safe: true });
    expect(validateOwnershipState(state, "/other")).toMatchObject({ safe: false });
    expect(validateOwnershipState({ ...state, clients: { claude: { ...state.clients.claude, envFile: "/tmp/secret.env" } } }, "/repo")).toMatchObject({ safe: false });
    expect(parseOwnershipState('{"schemaVersion":1,"projectRoot":"/repo","clients":{"pi":{},"pi":{}}}', "/repo")).toMatchObject({ safe: false });
  });

  test("classifies Pi disagreement as unknown and persists only after success", async () => {
    const state = buildOwnershipState("/repo", {
      pi: { settingsPath: ".pi/settings.json", packageName: "ticket-analyzer-mcp", packageSpec: "npm:ticket-analyzer-mcp@3.0.0", scope: "local", environmentBinding: "runtime-cwd-env" },
    });
    const observed = { settingsPath: ".pi/settings.json", packageName: "ticket-analyzer-mcp", packageSpec: "npm:ticket-analyzer-mcp@3.0.0", scope: "local", environmentBinding: "runtime-cwd-env" };
    expect(classifyOwnership({ client: "pi", state, observed })).toMatchObject({ classification: "owned" });
    expect(classifyOwnership({ client: "pi", state, observed: { ...observed, packageSpec: "npm:ticket-analyzer-mcp@1.0.0" } })).toMatchObject({ classification: "unknown" });
    expect(classifyOwnership({ client: "pi", observed: { absent: true } })).toMatchObject({ classification: "absent" });
    expect(classifyOwnership({ client: "pi", state, observed: { absent: true } })).toMatchObject({ classification: "unknown" });
    const writes = [];
    await expect(persistOwnershipAfterSuccess({ action: { success: false }, state, write: async () => writes.push("write") })).resolves.toMatchObject({ updated: false });
    expect(writes).toEqual([]);
    await expect(persistOwnershipAfterSuccess({ action: { success: true }, state, write: async (next) => writes.push(next) })).resolves.toMatchObject({ updated: true });
    expect(writes).toHaveLength(1);
  });

  test("rejects symlinked sidecars and atomically fails before rename", async () => {
    const state = buildOwnershipState("/repo", {});
    const symlinkFs = memoryFs({ "/repo": "dir", "/repo/.ticket-analyzer": "dir", "/repo/.ticket-analyzer/setup-state.json": "link" });
    await expect(readOwnershipState({ root: "/repo", filesystem: symlinkFs })).rejects.toThrow(/symlink/i);
    const calls = [];
    const entries = { "/repo": "dir" };
    const filesystem = {
      ...memoryFs(entries),
      async mkdir(target) { calls.push("mkdir"); entries[target] = "dir"; },
      async open() { calls.push("open"); throw new Error("disk full"); },
      async rename() { calls.push("rename"); },
    };
    await expect(writeOwnershipState({ root: "/repo", state, filesystem, tempPath: "/repo/.ticket-analyzer/setup-state.json.tmp" })).rejects.toThrow(/disk full/);
    expect(calls).not.toContain("rename");

    const successfulCalls = [];
    const successfulFs = {
      ...memoryFs({ "/repo": "dir", "/repo/.ticket-analyzer": "dir" }),
      async readFile() { throw ENOENT(); },
      async open(target, flags, mode) {
        successfulCalls.push(`open:${target}:${flags}:${mode.toString(8)}`);
        return { writeFile: async (content) => successfulCalls.push(`write:${content.endsWith("\n")}`), sync: async () => successfulCalls.push("fsync"), chmod: async () => successfulCalls.push("chmod"), close: async () => successfulCalls.push("close") };
      },
      async rename() { successfulCalls.push("rename"); },
      async fsyncDirectory() { successfulCalls.push("directory-fsync"); },
    };
    await expect(writeOwnershipState({ root: "/repo", state, filesystem: successfulFs, before: null, tempPath: "/repo/.ticket-analyzer/setup-state.json.tmp" })).resolves.toMatchObject({ safe: true, target: "/repo/.ticket-analyzer/setup-state.json" });
    expect(serializeOwnershipState(state)).toMatch(/}\n$/);
    expect(successfulCalls).toEqual(["open:/repo/.ticket-analyzer/setup-state.json.tmp:wx:600", "write:true", "fsync", "chmod", "close", "rename", "directory-fsync"]);
  });

  test("validates the sidecar root and target before creating its directory", async () => {
    const state = buildOwnershipState("/repo", {});
    for (const rootKind of ["link", "file"]) {
      const calls = [];
      const filesystem = {
        ...memoryFs({ "/repo": rootKind }),
        async mkdir() { calls.push("mkdir"); },
      };
      await expect(writeOwnershipState({ root: "/repo", state, filesystem })).rejects.toThrow(rootKind === "link" ? /symlink/i : /not a directory/i);
      expect(calls).toEqual([]);
    }
  });

  test("plans only the exact root-sidecar ignore rule while preserving style", async () => {
    expect(SIDECAR_IGNORE_RULE).toBe("/.ticket-analyzer/setup-state.json");
    expect(inspectSidecarIgnoreRule(SIDECAR_IGNORE_RULE)).toMatchObject({ safe: true, action: "existing" });
    expect(planSidecarIgnoreRule("keep\r\n")).toMatchObject({ safe: true, action: "append", after: `keep\r\n${SIDECAR_IGNORE_RULE}\r\n` });
    expect(planSidecarIgnoreRule("keep")).toMatchObject({ safe: true, action: "append", after: `keep\n${SIDECAR_IGNORE_RULE}` });
    expect(planSidecarIgnoreRule("keep\r\n").diff).toBe(`--- .gitignore\n+++ .gitignore\n@@ -1,1 +1,2 @@\n keep\n+${SIDECAR_IGNORE_RULE}`);
    for (const ambiguous of ["!/.ticket-analyzer/setup-state.json\n", "*.json\n", ".ticket-analyzer/\n", "\\/.ticket-analyzer/setup-state.json\n", `${SIDECAR_IGNORE_RULE}\n${SIDECAR_IGNORE_RULE}\n`]) {
      expect(inspectSidecarIgnoreRule(ambiguous)).toMatchObject({ safe: false });
    }
    const filesystem = memoryFs({ "/repo": "dir", "/repo/.gitignore": "file" });
    await expect(inspectSidecarIgnoreRuleFile({ root: "/repo", filesystem, readFile: async () => "" })).resolves.toMatchObject({ safe: true, action: "append" });
    await expect(inspectSidecarIgnoreRuleFile({ root: "/repo", filesystem: memoryFs({ "/repo": "dir", "/repo/.gitignore": "link" }), readFile: async () => "" })).rejects.toThrow(/symlink/i);
  });

  describe("immutable setup plans", () => {
    const baseInput = {
      root: "/repo",
      selections: { providers: ["jira"], clients: ["codex"] },
      providerOperations: [{ provider: "jira", action: "edit", redactedDiff: "- JIRA_HOST=[redacted]\\n+ JIRA_HOST=[redacted]", affectedLines: [{ key: "JIRA_HOST", action: "edit", before: "JIRA_HOST=[redacted]", after: "JIRA_HOST=[redacted]" }] }],
      files: {
        env: { path: "/repo/.env", diff: "- JIRA_HOST=[redacted]\\n+ JIRA_HOST=[redacted]" },
        sidecar: { path: "/repo/.ticket-analyzer/setup-state.json", before: null, after: "[redacted-free state]" },
        ignore: { path: "/repo/.gitignore", diff: "+/.ticket-analyzer/setup-state.json" },
      },
      clientOperations: [{ client: "codex", kind: "replace", executable: "/bin/codex", argv: ["mcp", "add", "ticket-analyzer"] }],
      blockedOperations: [{ client: "pi", reason: "Manual recovery is required." }],
      decisions: { codexTrustAcknowledged: false, reconciliation: { codex: "replace" } },
      snapshots: { env: "env-before", sidecar: "sidecar-before", ignore: "ignore-before", executable: "codex-before" },
      secretInputs: ["super-secret"],
    };

    test("renders a complete frozen redacted plan with identity and state entries", () => {
      const plan = buildPlan(baseInput);
      const text = renderPlan(plan);
      expect(plan.planId).toMatch(/^[a-f0-9]{64}$/);
      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(plan.selections)).toBe(true);
      expect(text).toContain("/repo/.env");
      expect(text).toContain("/.ticket-analyzer/setup-state.json");
      expect(text).toContain(plan.planId);
      expect(text).toContain("replace");
      expect(text).toMatch(/blocked/i);
      expect(text).not.toContain("super-secret");
      expect(JSON.stringify(plan)).not.toContain("super-secret");
    });

    test("changes plan identity for every mutable input but never snapshots trust files", () => {
      const plan = buildPlan(baseInput);
      const variations = [
        { selections: { ...baseInput.selections, providers: ["trello"] } },
        { decisions: { ...baseInput.decisions, reconciliation: { codex: "adopt" } } },
        { snapshots: { ...baseInput.snapshots, env: "changed" } },
        { snapshots: { ...baseInput.snapshots, sidecar: "changed" } },
        { snapshots: { ...baseInput.snapshots, ignore: "changed" } },
        { snapshots: { ...baseInput.snapshots, executable: "changed" } },
        { executables: { codex: "/other/codex" } },
        { decisions: { ...baseInput.decisions, codexTrustAcknowledged: true } },
      ];
      for (const change of variations) {
        expect(buildPlan({ ...baseInput, ...change }).planId).not.toBe(plan.planId);
      }
      expect(JSON.stringify(plan)).not.toMatch(/(?:trust\.json|codex_home|home\/\.codex)/i);
      const withTrustPath = buildPlan({ ...baseInput, snapshots: { ...baseInput.snapshots, trustFile: "/home/user/.codex/trust.json" } });
      expect(JSON.stringify(withTrustPath)).not.toContain("trustFile");
      expect(computePlanId(plan, ["another-secret"])).not.toBe(plan.planId);
    });

    test("replans a changed snapshot before invoking any operation", async () => {
      const execute = jest.fn();
      const initial = buildPlan({ ...baseInput, operations: [{ id: "client", execute }] });
      const replanned = buildPlan({ ...baseInput, snapshots: { ...baseInput.snapshots, env: "changed" }, operations: [{ id: "client", execute }] });
      const confirm = jest.fn().mockResolvedValue(true);
      const render = jest.fn();
      const replan = jest.fn().mockResolvedValue(replanned);
      const result = await executePlan(initial, {
        confirm,
        replan,
        renderPlan: render,
        current: async () => ({ ...baseInput.snapshots, env: "changed" }),
      });
      expect(result.status).toBe("completed");
      expect(replan).toHaveBeenCalledWith(initial, expect.objectContaining({ reason: expect.stringMatching(/changed|stale/i) }));
      expect(render).toHaveBeenCalledWith(replanned);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    test("replans and reconfirms when an input changes before an operation", async () => {
      const confirm = jest.fn().mockResolvedValue(true);
      const execute = jest.fn();
      const initial = buildPlan({ ...baseInput, operations: [{ id: "client", execute }] });
      const replanned = buildPlan({ ...baseInput, snapshots: { ...baseInput.snapshots, ignore: "changed" }, operations: [{ id: "client", execute }] });
      const render = jest.fn();
      let reads = 0;
      const result = await executePlan(initial, {
        confirm,
        replan: async () => replanned,
        renderPlan: render,
        current: async () => (++reads === 1 ? baseInput.snapshots : { ...baseInput.snapshots, ignore: "changed" }),
      });
      expect(result.status).toBe("completed");
      expect(render).toHaveBeenCalledWith(replanned);
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    test("re-renders and reconfirms a replanned snapshot before executing", async () => {
      const execute = jest.fn();
      const confirm = jest.fn().mockResolvedValue(true);
      const initial = buildPlan({ ...baseInput, operations: [{ id: "client", execute }] });
      const replanned = buildPlan({ ...baseInput, snapshots: { ...baseInput.snapshots, ignore: "replanned" }, operations: [{ id: "client", execute }] });
      const currentSnapshots = [baseInput.snapshots, { ...baseInput.snapshots, ignore: "changed" }, { ...baseInput.snapshots, ignore: "replanned" }];
      const render = jest.fn();
      const replan = jest.fn().mockResolvedValue(replanned);
      const result = await executePlan(initial, {
        confirm,
        replan,
        renderPlan: render,
        current: async () => currentSnapshots.shift(),
      });
      expect(result.status).toBe("completed");
      expect(replan).toHaveBeenCalledWith(initial, expect.objectContaining({ reason: expect.stringMatching(/changed|stale/i) }));
      expect(render).toHaveBeenCalledWith(replanned);
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(confirm.mock.calls[1][0]).toBe(replanned);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("PR 4 Claude project-MCP reconciliation", () => {
        const root = "/repo";
        const canonical = { registrationId: "ticket-analyzer", scope: "project", command: "ticket-analyzer-mcp", envFile: "/repo/.env" };
        const adapterFor = ({ output = JSON.stringify({ name: "ticket-analyzer", scope: "project", command: "ticket-analyzer-mcp", env: { TICKET_ANALYZER_ENV_FILE: "/repo/.env" } }), config = { safe: true, tracked: false }, executable = "/bin/claude" } = {}) => new ClaudeAdapter({
          resolveExecutable: async () => executable,
          runCommand: async () => ({ stdout: output, stderr: "" }),
          inspectProjectConfig: async () => config,
        });

        test("classifies fixture-pinned owned, matching, foreign, and safe unknown Claude registrations", async () => {
          const matching = await adapterFor().discover({ root });
          const state = buildOwnershipState(root, { claude: canonical });
          const owned = await adapterFor().discover({ root, state });
          const foreign = await adapterFor({ output: JSON.stringify({ name: "ticket-analyzer", scope: "project", command: "other", env: {} }) }).discover({ root });
          const unknown = await Promise.all([
            adapterFor({ executable: null }).discover({ root }), adapterFor({ output: "[]" }).discover({ root }),
            adapterFor({ config: { safe: false, reason: "unsafe .mcp.json" } }).discover({ root }), adapterFor({ config: { safe: true, tracked: true } }).discover({ root }),
          ]);
          expect([matching.classification, owned.classification, foreign.classification]).toEqual(["matching", "owned", "foreign"]);
          for (const result of unknown) expect(result).toMatchObject({ classification: "unknown", recovery: expect.stringMatching(/manual/i) });
        });

        test("classifies a fixture-pinned absent registration as addable", async () => {
          const adapter = adapterFor({ output: "null" });
          const absent = await adapter.discover({ root });
          const operation = adapter.buildOperation({ discovery: absent });
          expect(absent).toMatchObject({ classification: "absent", observed: { absent: true } });
          expect(operation).toMatchObject({ kind: "add", argv: ["mcp", "add", "--scope", "project", "ticket-analyzer", "--env", "TICKET_ANALYZER_ENV_FILE=/repo/.env", "--", "ticket-analyzer-mcp"] });
        });
        test("rejects malformed or symlinked conventional Claude config before inspection", async () => {
          const malformed = { ...memoryFs({ [root]: "dir", [path.join(root, ".mcp.json")]: "file" }), readFile: async () => "{" };
          const symlink = memoryFs({ [root]: "dir", [path.join(root, ".mcp.json")]: "link" });
          await expect(inspectClaudeProjectConfig({ root, filesystem: malformed })).resolves.toMatchObject({ safe: false });
          await expect(inspectClaudeProjectConfig({ root, filesystem: symlink })).resolves.toMatchObject({ safe: false });
        });

        test("requires explicit adoption or replacement and renders only shell-free project MCP argv", async () => {
          const adapter = adapterFor();
          const matching = await adapter.discover({ root });
          const foreign = await adapterFor({ output: JSON.stringify({ name: "ticket-analyzer", scope: "project", command: "other", env: {} }) }).discover({ root });
          expect(adapter.buildOperation({ discovery: matching })).toMatchObject({ blocked: true });
          expect(adapter.buildOperation({ discovery: matching, decision: "adopt" })).toMatchObject({ kind: "adopt", argv: [] });
          expect(adapter.buildOperation({ discovery: foreign })).toMatchObject({ blocked: true });
          const replace = adapter.buildOperation({ discovery: foreign, decision: "replace" });
          expect(replace.argv).toEqual(["mcp", "add", "--scope", "project", "ticket-analyzer", "--env", "TICKET_ANALYZER_ENV_FILE=/repo/.env", "--", "ticket-analyzer-mcp"]);
          expect(renderClaudeOperation(replace)).toContain(JSON.stringify(replace.argv));
          expect(renderClaudeOperation(replace)).not.toMatch(/plugin|marketplace|AGENTS|shell/i);
        });

        test("removes only an owned project MCP entry before its sidecar", async () => {
          const operation = adapterFor().buildOperation({ discovery: { client: "claude", classification: "owned", root, executable: "/bin/claude", observed: canonical }, intent: "remove" });
          const events = [];
          await expect(adapterFor().execute(operation, { runCommand: async (_file, argv) => events.push(argv), discover: async () => ({ classification: "absent", observed: null }), ensureIgnoreRule: async () => events.push("ignore"), writeOwnership: async (state) => events.push(state) })).resolves.toEqual({ success: true });
          expect(events).toEqual([["mcp", "remove", "--scope", "project", "ticket-analyzer"], null]);
        });

        test("does not persist Claude ownership when post-command semantics differ", async () => {
          const operation = adapterFor().buildOperation({ discovery: { client: "claude", classification: "foreign", root, executable: "/bin/claude", observed: { command: "other" } }, decision: "replace" });
          const writeOwnership = jest.fn();
          await expect(adapterFor().execute(operation, { runCommand: async () => ({}), discover: async () => ({ classification: "foreign", observed: { ...canonical, command: "other" } }), writeOwnership })).rejects.toThrow(/post-command verification/i);
          expect(writeOwnership).not.toHaveBeenCalled();
        });

        test("verifies canonical semantics before sidecar persistence and bounds redacted child handling", async () => {
          const adapter = adapterFor();
          const operation = adapter.buildOperation({ discovery: { client: "claude", classification: "foreign", root, observed: { command: "other" } }, decision: "replace" });
          const calls = [];
          await expect(adapter.execute(operation, {
            runCommand: async (_file, _argv, options) => { calls.push({ step: "target", options }); return { stdout: "token=child-secret", stderr: "" }; },
            discover: async () => ({ classification: "matching", observed: canonical }),
            ensureIgnoreRule: async () => calls.push("ignore"),
            writeOwnership: async (facts) => calls.push({ step: "sidecar", facts }),
            environment: { PATH: "/safe", JIRA_API_TOKEN: "secret", TICKET_ANALYZER_ENV_FILE: "/leak" },
          })).resolves.toEqual({ success: true });
          expect(calls.map((entry) => entry.step ?? entry)).toEqual(["ignore", "target", "sidecar"]);
          expect(calls[1].options).toEqual(expect.objectContaining({ shell: false, cwd: root, maxOutputBytes: 16 * 1024, timeoutMs: 60_000, clientEnv: { PATH: "/safe" } }));
          expect(JSON.stringify(calls)).not.toContain("child-secret");
        });
  });

  describe("PR 5 Codex project TOML safety", () => {
    const envFile = "/repo/.env";
    const managed = [
      "[mcp_servers.ticket-analyzer]",
      'command = "ticket-analyzer-mcp"',
      "args = []",
      "",
      "[mcp_servers.ticket-analyzer.env]",
      `TICKET_ANALYZER_ENV_FILE = "${envFile}"`,
    ].join("\n");

    test("appends the exact canonical fragment to a missing or empty config", () => {
      const created = planCodexEntry({ content: "", envFile, intent: "add" });
      expect(created).toMatchObject({ safe: true, action: "add" });
      expect(created.after).toBe(`${managed}\n`);
      expect(created.diff).toContain(`+TICKET_ANALYZER_ENV_FILE = "${envFile}"`);
    });

    test("appends to an existing config without touching any foreign byte", () => {
      const before = ['# keep me', '[mcp_servers.other]', 'command = "other"', ""].join("\n");
      const planned = planCodexEntry({ content: before, envFile, intent: "add" });
      expect(planned).toMatchObject({ safe: true, action: "add" });
      expect(planned.after.startsWith(before)).toBe(true);
      expect(planned.after).toContain(managed);
    });

    test("preserves the CRLF convention when appending", () => {
      const before = "[mcp_servers.other]\r\ncommand = \"other\"\r\n";
      const planned = planCodexEntry({ content: before, envFile, intent: "add" });
      expect(planned.after.startsWith(before)).toBe(true);
      expect(planned.after.slice(before.length)).toBe(`${managed.replaceAll("\n", "\r\n")}\r\n`);
      expect(planned.after).not.toMatch(/[^\r]\n/);
    });

    test("updates only the target range and preserves surrounding comments and tables", () => {
      const before = [
        "# leading comment",
        "[mcp_servers.other]",
        'command = "other"',
        "",
        "[mcp_servers.ticket-analyzer]",
        'command = "stale"',
        "args = []",
        "",
        "[mcp_servers.ticket-analyzer.env]",
        'TICKET_ANALYZER_ENV_FILE = "/old/.env"',
        "",
        "# trailing comment",
        "[mcp_servers.zzz]",
        'command = "zzz"',
        "",
      ].join("\n");
      const planned = planCodexEntry({ content: before, envFile, intent: "replace" });
      expect(planned).toMatchObject({ safe: true, action: "replace" });
      expect(planned.after).toContain("# leading comment");
      expect(planned.after).toContain("# trailing comment");
      expect(planned.after).toContain('[mcp_servers.zzz]');
      expect(planned.after).toContain(`TICKET_ANALYZER_ENV_FILE = "${envFile}"`);
      expect(planned.after).not.toContain('"/old/.env"');
      expect(planned.after).not.toContain('command = "stale"');
      expect(planned.replacementLossWarning).toMatch(/within the targeted entry/i);
    });

    test("removes the target table and its env subtable only", () => {
      const before = `# top\n\n${managed}\n\n[mcp_servers.other]\ncommand = "other"\n`;
      const planned = planCodexEntry({ content: before, envFile, intent: "remove" });
      expect(planned).toMatchObject({ safe: true, action: "remove" });
      expect(planned.after).toContain("# top");
      expect(planned.after).toContain("[mcp_servers.other]");
      expect(planned.after).not.toContain("ticket-analyzer");
    });

    test("reports an unchanged plan when the target already matches", () => {
      const planned = planCodexEntry({ content: `${managed}\n`, envFile, intent: "add" });
      expect(planned).toMatchObject({ safe: true, changed: false });
      expect(planned.diff).toBe("");
    });

    test("locates the target and reports its observed canonical facts", () => {
      const located = locateCodexEntry(`${managed}\n`);
      expect(located).toMatchObject({
        safe: true,
        present: true,
        observed: { configPath: CODEX_RELATIVE_CONFIG_PATH, table: CODEX_TARGET_TABLE, command: "ticket-analyzer-mcp", envFile },
      });
    });

    test.each([
      ["duplicate target tables", `${managed}\n\n${managed}\n`],
      ["an array of tables", '[[mcp_servers.ticket-analyzer]]\ncommand = "x"\n'],
      ["a malformed header", '[mcp_servers.ticket-analyzer\ncommand = "x"\n'],
      ["an unterminated quoted value", '[mcp_servers.ticket-analyzer]\ncommand = "x\n'],
      ["a multiline value", '[mcp_servers.ticket-analyzer]\ncommand = """\nx\n"""\n'],
      ["an unrecognized key layout", "[mcp_servers.ticket-analyzer]\nnot a key value line\n"],
    ])("safely exits on %s without proposing a mutation", (_case, content) => {
      expect(locateCodexEntry(content)).toMatchObject({ safe: false, reason: expect.any(String) });
      const planned = planCodexEntry({ content, envFile, intent: "replace" });
      expect(planned.safe).toBe(false);
      expect(planned.after).toBeUndefined();
    });

    test("blocks a Codex mutation until the per-run trust precondition is acknowledged", () => {
      const blocked = acknowledgeCodexTrust({ acknowledged: false });
      expect(blocked).toMatchObject({ acknowledged: false, blocked: true });
      expect(blocked.reason).toMatch(/trust/i);
      expect(blocked.recovery).toBe(CODEX_TRUST_PRECONDITION);
      expect(acknowledgeCodexTrust({ acknowledged: true })).toEqual({ acknowledged: true, blocked: false });
    });

    test("keeps the acknowledgement out of persisted ownership state", () => {
      const state = buildOwnershipState("/repo", {
        codex: { configPath: CODEX_RELATIVE_CONFIG_PATH, table: CODEX_TARGET_TABLE, command: "ticket-analyzer-mcp", envFile },
      });
      expect(serializeOwnershipState(state)).not.toMatch(/acknowledg|trust/i);
    });

    test("keeps comments and unrelated keys inside the target out of a pure env-file update", () => {
      const before = [
        "[mcp_servers.ticket-analyzer]",
        '# managed by setup',
        'command = "ticket-analyzer-mcp"',
        "args = []",
        'startup_timeout_ms = 20000',
        "",
        "[mcp_servers.ticket-analyzer.env]",
        'TICKET_ANALYZER_ENV_FILE = "/old/.env"',
        "",
      ].join("\n");
      const planned = planCodexEntry({ content: before, envFile, intent: "replace" });
      expect(planned).toMatchObject({ safe: true, action: "replace", changed: true });
      expect(planned.replacementLossWarning).toBe(CODEX_REPLACEMENT_LOSS_WARNING);
      expect(planned.after).not.toContain("startup_timeout_ms");
      expect(planned.after).not.toContain("# managed by setup");
      expect(planned.observed).toMatchObject({ command: "ticket-analyzer-mcp", envFile: "/old/.env" });
    });

    test("rejects a non-contiguous env subtable instead of guessing its boundary", () => {
      const before = [
        "[mcp_servers.ticket-analyzer]",
        'command = "ticket-analyzer-mcp"',
        "",
        "[mcp_servers.other]",
        'command = "other"',
        "",
        "[mcp_servers.ticket-analyzer.env]",
        `TICKET_ANALYZER_ENV_FILE = "${envFile}"`,
        "",
      ].join("\n");
      expect(locateCodexEntry(before)).toMatchObject({ safe: false, reason: expect.stringMatching(/contiguous/i) });
    });

    test("rejects an env subtable that has no target table", () => {
      expect(locateCodexEntry(`[mcp_servers.ticket-analyzer.env]\nTICKET_ANALYZER_ENV_FILE = "${envFile}"\n`)).toMatchObject({ safe: false });
    });

    test("removal preserves foreign bytes and reports an unchanged plan when absent", () => {
      const absent = planCodexEntry({ content: '[mcp_servers.other]\ncommand = "other"\n', envFile, intent: "remove" });
      expect(absent).toMatchObject({ safe: true, action: "remove", changed: false, diff: "" });
      const present = planCodexEntry({ content: `${managed}\n\n[mcp_servers.other]\ncommand = "other"\n`, envFile, intent: "remove" });
      expect(present.after).toBe('[mcp_servers.other]\ncommand = "other"\n');
    });

    test("requires an absolute managed env-file path", () => {
      expect(planCodexEntry({ content: "", envFile: ".env", intent: "add" })).toMatchObject({ safe: false, reason: expect.stringMatching(/absolute/i) });
    });

    test("preserves a file that has no final newline", () => {
      const before = '[mcp_servers.other]\ncommand = "other"';
      const planned = planCodexEntry({ content: before, envFile, intent: "add" });
      expect(planned.after).toBe(`${before}\n${managed}\n`);
    });

    test("renders an exact unified diff for a tracked config", () => {
      const planned = planCodexEntry({ content: `# tracked\n\n${managed.replace(envFile, "/old/.env")}\n`, envFile, intent: "replace" });
      expect(planned.diff).toContain(`--- ${CODEX_RELATIVE_CONFIG_PATH}`);
      expect(planned.diff).toContain(`+++ ${CODEX_RELATIVE_CONFIG_PATH}`);
      expect(planned.diff).toContain(' # tracked');
      expect(planned.diff).toContain('-TICKET_ANALYZER_ENV_FILE = "/old/.env"');
      expect(planned.diff).toContain(`+TICKET_ANALYZER_ENV_FILE = "${envFile}"`);
    });

    test("never reads home, CODEX_HOME, trust state, or a Codex subprocess", async () => {
      const source = String(await readFile(new URL("./setup-files.js", import.meta.url), "utf8"));
      expect(source).not.toMatch(/CODEX_HOME|process\.env\.HOME|homedir|os\.homedir/);
      expect(source).not.toMatch(/trusted_projects|trustReader|CodexTrustReader|spawn|execFile/);
    });
  });

  describe("PR 7 Pi project-local inspection boundary", () => {
    const root = "/repo";
    const version = "3.0.0";
    const spec = `npm:ticket-analyzer-mcp@${version}`;
    const settings = (local) => JSON.stringify({ version: 1, packages: { local } });
    const piFacts = { settingsPath: PI_SETTINGS_RELATIVE_PATH, packageName: "ticket-analyzer-mcp", packageSpec: spec, scope: "local", environmentBinding: "runtime-cwd-env" };
    const inspectorFor = (content, tracked = false) => new PiSettingsInspector({ readSettings: async () => (content === null ? null : { content, tracked }) });
    const adapterFor = (content, { tracked = false, actionContract } = {}) => new PiAdapter({ inspector: inspectorFor(content, tracked), packageVersion: version, actionContract });

    test("accepts the pinned schema and classifies absent, matching, foreign, and owned entries", async () => {
      const absent = await adapterFor(settings([])).discover({ root });
      const missingFile = await adapterFor(null).discover({ root });
      const matching = await adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }])).discover({ root });
      const foreign = await adapterFor(settings([{ name: "ticket-analyzer-mcp", spec: "npm:ticket-analyzer-mcp@1.0.0" }])).discover({ root });
      const owned = await adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }])).discover({ root, state: buildOwnershipState(root, { pi: piFacts }) });
      expect([absent.classification, missingFile.classification, matching.classification, foreign.classification, owned.classification])
        .toEqual(["absent", "absent", "matching", "foreign", "owned"]);
      expect(matching.observed).toMatchObject(piFacts);
    });

    test.each([
      ["JSONC comments", '{ // hi\n"version": 1, "packages": { "local": [] } }'],
      ["duplicate keys", '{"version":1,"packages":{"local":[]},"packages":{"local":[]}}'],
      ["an unsupported schema version", JSON.stringify({ version: 2, packages: { local: [] } })],
      ["an unrecognized collection layout", JSON.stringify({ version: 1, packages: { global: [] } })],
      ["an unexpected top-level key", JSON.stringify({ version: 1, packages: { local: [] }, extra: true })],
      ["a malformed entry", JSON.stringify({ version: 1, packages: { local: [{ name: "ticket-analyzer-mcp" }] } })],
      ["an aliased entry", JSON.stringify({ version: 1, packages: { local: [{ name: "ta", spec: "npm:ticket-analyzer-mcp@3.0.0" }] } })],
      ["duplicate target identities", JSON.stringify({ version: 1, packages: { local: [{ name: "ticket-analyzer-mcp", spec: "npm:ticket-analyzer-mcp@3.0.0" }, { name: "ticket-analyzer-mcp", spec: "npm:ticket-analyzer-mcp@1.0.0" }] } })],
    ])("treats %s as unknown and exits safely", async (_case, content) => {
      const discovery = await adapterFor(content).discover({ root });
      expect(discovery).toMatchObject({ classification: "unknown", recovery: PI_MANUAL_RECOVERY });
      expect(adapterFor(content).buildOperation({ discovery })).toMatchObject({ blocked: true });
    });

    test("keeps add, replace, and remove manual while no version-pinned action contract exists", async () => {
      const absent = adapterFor(settings([]));
      const foreignAdapter = adapterFor(settings([{ name: "ticket-analyzer-mcp", spec: "npm:ticket-analyzer-mcp@1.0.0" }]));
      const add = absent.buildOperation({ discovery: await absent.discover({ root }) });
      const replace = foreignAdapter.buildOperation({ discovery: await foreignAdapter.discover({ root }), decision: "replace" });
      const owned = adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }]));
      const remove = owned.buildOperation({ discovery: await owned.discover({ root, state: buildOwnershipState(root, { pi: piFacts }) }), intent: "remove" });
      for (const operation of [add, replace, remove]) {
        expect(operation).toMatchObject({ blocked: true, recovery: PI_MANUAL_RECOVERY });
        expect(operation.argv).toBeUndefined();
      }
    });

    test("adopting a matching entry writes only the sidecar, after the ignore rule and without rewriting settings", async () => {
      const events = [];
      const writeSettings = jest.fn();
      const adapter = adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }]));
      const operation = adapter.buildOperation({ discovery: await adapter.discover({ root }), decision: "adopt" });
      expect(operation).toMatchObject({ kind: "adopt", client: "pi" });
      await expect(adapter.execute(operation, {
        ensureIgnoreRule: async () => events.push("ignore"),
        writeOwnership: async (facts) => events.push({ step: "sidecar", facts }),
        writeSettings,
      })).resolves.toEqual({ success: true });
      expect(events.map((event) => event.step ?? event)).toEqual(["ignore", "sidecar"]);
      expect(events[1].facts).toMatchObject(piFacts);
      expect(writeSettings).not.toHaveBeenCalled();
    });

    test("requires an explicit adoption and blocks tracked settings without an exact-preservation contract", async () => {
      const adapter = adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }]));
      expect(adapter.buildOperation({ discovery: await adapter.discover({ root }) })).toMatchObject({ blocked: true, reason: expect.stringMatching(/adopt/i) });
      const tracked = adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }]), { tracked: true });
      const discovery = await tracked.discover({ root });
      expect(discovery).toMatchObject({ classification: "unknown", reason: expect.stringMatching(/tracked/i) });
    });

    test("treats a sidecar that disagrees with the project entry as unknown", async () => {
      const stale = await adapterFor(settings([{ name: "ticket-analyzer-mcp", spec: "npm:ticket-analyzer-mcp@1.0.0" }]))
        .discover({ root, state: buildOwnershipState(root, { pi: piFacts }) });
      expect(stale).toMatchObject({ classification: "unknown", recovery: PI_MANUAL_RECOVERY });
    });

    test("renders exact shell-free local argv only when a version-pinned contract is supplied", async () => {
      const actionContract = { piVersion: "9.9.9", install: true, remove: true };
      const adapter = adapterFor(settings([]), { actionContract });
      const add = adapter.buildOperation({ discovery: await adapter.discover({ root }) });
      expect(add).toMatchObject({ kind: "add", argv: ["install", "-l", spec] });
      const ownedAdapter = adapterFor(settings([{ name: "ticket-analyzer-mcp", spec }]), { actionContract });
      const remove = ownedAdapter.buildOperation({ discovery: await ownedAdapter.discover({ root, state: buildOwnershipState(root, { pi: piFacts }) }), intent: "remove" });
      expect(remove).toMatchObject({ kind: "remove", argv: ["remove", "-l", "npm:ticket-analyzer-mcp"] });
    });

    test("never infers state from pi list, global scope, or a filesystem package path", async () => {
      const source = String(await readFile(new URL("./setup-adapters.js", import.meta.url), "utf8"));
      const piSection = [declarationSource(source, "class PiSettingsInspector"), declarationSource(source, "class PiAdapter")].join("\n");
      expect(piSection).not.toMatch(/"list"|pi list|--global|\s-g\b|file:|npm install/);
      expect(piSection).not.toMatch(/homedir|PI_HOME|process\.env/);
    });
  });

  describe("PR 6 Codex reconciliation wiring", () => {
    const root = "/repo";
    const envFile = "/repo/.env";
    const entry = (file = envFile, command = "ticket-analyzer-mcp") => [
      "[mcp_servers.ticket-analyzer]",
      `command = "${command}"`,
      "args = []",
      "",
      "[mcp_servers.ticket-analyzer.env]",
      `TICKET_ANALYZER_ENV_FILE = "${file}"`,
      "",
    ].join("\n");
    const codexFacts = { configPath: CODEX_RELATIVE_CONFIG_PATH, table: CODEX_TARGET_TABLE, command: "ticket-analyzer-mcp", envFile };
    const adapterFor = (content) => new CodexAdapter({ readConfig: async () => content });
    const acknowledged = { acknowledged: true };

    test("classifies absent, matching, owned, foreign, and unsafe project entries", async () => {
      const absent = await adapterFor("").discover({ root });
      const matching = await adapterFor(entry()).discover({ root });
      const owned = await adapterFor(entry()).discover({ root, state: buildOwnershipState(root, { codex: codexFacts }) });
      const foreign = await adapterFor(entry("/other/.env")).discover({ root });
      const unsafe = await adapterFor(`${entry()}\n${entry()}`).discover({ root });
      expect([absent.classification, matching.classification, owned.classification, foreign.classification]).toEqual(["absent", "matching", "owned", "foreign"]);
      expect(unsafe).toMatchObject({ classification: "unknown", recovery: expect.stringMatching(/manual/i) });
    });

    test("blocks every mutation until the per-run trust precondition is acknowledged", async () => {
      const adapter = adapterFor("");
      const discovery = await adapter.discover({ root });
      const blocked = adapter.buildOperation({ discovery });
      expect(blocked).toMatchObject({ blocked: true, recovery: CODEX_TRUST_PRECONDITION });
      expect(blocked.after).toBeUndefined();
      await expect(adapter.execute(blocked, { writeConfig: jest.fn() })).rejects.toThrow(/blocked/i);
    });

    test("plans an absent entry as an add carrying the exact diff and resulting bytes", async () => {
      const adapter = adapterFor("");
      const operation = adapter.buildOperation({ discovery: await adapter.discover({ root }), acknowledgement: acknowledged });
      expect(operation).toMatchObject({ client: "codex", kind: "add", configPath: CODEX_RELATIVE_CONFIG_PATH });
      expect(operation.after).toBe(entry().trimEnd() + "\n");
      expect(operation.diff).toContain(`+TICKET_ANALYZER_ENV_FILE = "${envFile}"`);
    });

    test("requires an explicit decision for matching and foreign entries", async () => {
      const matching = await adapterFor(entry()).discover({ root });
      const foreign = await adapterFor(entry("/other/.env")).discover({ root });
      const adapter = adapterFor(entry());
      expect(adapter.buildOperation({ discovery: matching, acknowledgement: acknowledged })).toMatchObject({ blocked: true, reason: expect.stringMatching(/adopt/i) });
      expect(adapter.buildOperation({ discovery: foreign, acknowledgement: acknowledged })).toMatchObject({ blocked: true, reason: expect.stringMatching(/replace/i) });
      expect(adapter.buildOperation({ discovery: matching, decision: "adopt", acknowledgement: acknowledged })).toMatchObject({ kind: "adopt", changed: false });
      const replace = adapter.buildOperation({ discovery: foreign, decision: "replace", acknowledgement: acknowledged });
      expect(replace).toMatchObject({ kind: "replace" });
      expect(replace.replacementLossWarning).toMatch(/within the targeted entry/i);
    });

    test("establishes the ignore rule, writes the target, verifies it, then persists ownership", async () => {
      let content = "";
      const events = [];
      const adapter = new CodexAdapter({ readConfig: async () => content });
      const operation = adapter.buildOperation({ discovery: await adapter.discover({ root }), acknowledgement: acknowledged });
      await expect(adapter.execute(operation, {
        ensureIgnoreRule: async () => events.push("ignore"),
        writeConfig: async ({ before, after }) => { events.push({ step: "write", before, after }); content = after; },
        writeOwnership: async (facts) => events.push({ step: "sidecar", facts }),
      })).resolves.toEqual({ success: true });
      expect(events.map((event) => event.step ?? event)).toEqual(["ignore", "write", "sidecar"]);
      expect(events[1]).toMatchObject({ before: "" });
      expect(events[2].facts).toMatchObject(codexFacts);
    });

    test("does not persist ownership when the written entry fails post-write verification", async () => {
      const adapter = new CodexAdapter({ readConfig: async () => "" });
      const operation = adapter.buildOperation({ discovery: await adapter.discover({ root }), acknowledgement: acknowledged });
      const writeOwnership = jest.fn();
      await expect(adapter.execute(operation, { writeConfig: async () => {}, writeOwnership })).rejects.toThrow(/verification/i);
      expect(writeOwnership).not.toHaveBeenCalled();
    });

    test("refuses to execute a plan whose source bytes changed after planning", async () => {
      let content = "";
      const adapter = new CodexAdapter({ readConfig: async () => content });
      const operation = adapter.buildOperation({ discovery: await adapter.discover({ root }), acknowledgement: acknowledged });
      content = entry("/drifted/.env");
      const writeConfig = jest.fn();
      await expect(adapter.execute(operation, { writeConfig, writeOwnership: jest.fn() })).rejects.toThrow(/changed|stale/i);
      expect(writeConfig).not.toHaveBeenCalled();
    });

    test("removes only an owned entry, target before sidecar, without touching the ignore rule", async () => {
      let content = entry();
      const events = [];
      const adapter = new CodexAdapter({ readConfig: async () => content });
      const discovery = await adapter.discover({ root, state: buildOwnershipState(root, { codex: codexFacts }) });
      const operation = adapter.buildOperation({ discovery, intent: "remove", acknowledgement: acknowledged });
      await expect(adapter.execute(operation, {
        ensureIgnoreRule: async () => events.push("ignore"),
        writeConfig: async ({ after }) => { events.push("write"); content = after; },
        writeOwnership: async (facts) => events.push({ step: "sidecar", facts }),
      })).resolves.toEqual({ success: true });
      expect(events.map((event) => event.step ?? event)).toEqual(["write", "sidecar"]);
      expect(events[1].facts).toBeNull();
      expect(content).not.toContain("ticket-analyzer");
    });

    test("keeps Codex authority inside the project file and out of any subprocess or home path", async () => {
      const source = String(await readFile(new URL("./setup-adapters.js", import.meta.url), "utf8"));
      expect(source).not.toMatch(/CODEX_HOME|homedir|trusted_projects/);
      expect(declarationSource(source, "class CodexAdapter")).not.toMatch(/runCommand|resolveExecutable|spawn/);
    });

    test("a blocked Codex client leaves independently selected operations planned", async () => {
      const output = [];
      const result = await setupCommand({
        cwd: root,
        filesystem: memoryFs({ [root]: "dir", [path.join(root, ".git")]: "file" }),
        stdin: { isTTY: false },
        stdout: { isTTY: false, write: (text) => output.push(text) },
        selections: { providers: [], clients: ["claude", "codex"] },
        dryRun: true,
        environment: { PATH: "/safe" },
        resolveExecutable: async () => "/bin/claude",
        runCommand: async () => ({ stdout: "null", stderr: "" }),
        inspectProjectConfig: async () => ({ safe: true, tracked: false }),
        readCodexConfig: async () => "",
      });
      expect(result).toBe(0);
      const text = output.join(" ");
      expect(text).toMatch(/Client claude: add/i);
      expect(text).toMatch(/codex/i);
      expect(text).toMatch(/trust/i);
    });
  });

  describe("PR 8 ordered execution", () => {
    const root = "/repo";
    const baseFs = () => memoryFs({ [root]: "dir", [path.join(root, ".git")]: "file" });
    const run = (options) => {
      const output = [];
      return setupCommand({
        cwd: root,
        filesystem: baseFs(),
        stdin: { isTTY: false },
        stdout: { isTTY: false, write: (text) => output.push(text) },
        environment: { PATH: "/safe" },
        confirm: async () => true,
        ...options,
      }).then((code) => ({ code, text: output.join("\n") }));
    };
    const stubAdapter = (client, record) => ({
      discover: async () => ({ client, classification: "absent" }),
      buildOperation: () => ({ client, kind: "add" }),
      execute: async () => { record.push(client); return { success: true }; },
    });

    test("orders the stages provider, ignore rule, claude, codex, pi regardless of input order", () => {
      expect(CLIENT_EXECUTION_ORDER).toEqual(["claude", "codex", "pi"]);
      const ordered = orderSetupOperations({
        provider: { id: "providers" },
        ignore: { id: "ignore-rule" },
        clients: [{ id: "pi" }, { id: "codex" }, { id: "claude" }],
      });
      expect(ordered.map((operation) => operation.id)).toEqual(["providers", "ignore-rule", "claude", "codex", "pi"]);
      expect(orderSetupOperations({ clients: [{ id: "codex" }] }).map((operation) => operation.id)).toEqual(["codex"]);
    });

    test("executes the provider write, then the ignore rule, then the clients in fixed order", async () => {
      const record = [];
      const adapters = { claude: stubAdapter("claude", record), codex: stubAdapter("codex", record), pi: stubAdapter("pi", record) };
      const { code } = await run({
        selections: { providers: ["trello"], clients: ["pi", "codex", "claude"] },
        providerValues: { trello: { TRELLO_API_KEY: "key", TRELLO_TOKEN: "token" } },
        adapters,
        writeEnvFile: async () => record.push("providers"),
        ensureIgnoreRule: async () => record.push("ignore-rule"),
        writeOwnership: async () => {},
      });
      expect(code).toBe(0);
      expect(record).toEqual(["providers", "ignore-rule", "claude", "codex", "pi"]);
    });

    test("writes the edited env bytes through the atomic writer and skips the stage without provider work", async () => {
      const writeEnvFile = jest.fn();
      await run({ selections: { providers: ["trello"], clients: [] }, providerValues: { trello: { TRELLO_API_KEY: "key" } }, writeEnvFile });
      const preparation = writeEnvFile.mock.calls[0][0];
      expect(preparation).toMatchObject({ operation: "atomic-write", target: resolveManagedEnvPath(root), mode: 0o600 });
      expect(preparation.content).toContain('TRELLO_API_KEY="key"');
      expect(Object.keys(preparation)).not.toContain("content");
      const untouched = jest.fn();
      await run({ selections: { providers: [], clients: [] }, writeEnvFile: untouched });
      expect(untouched).not.toHaveBeenCalled();
    });

    test("stops at the first failure, reports the remaining state, and never rolls back", async () => {
      const record = [];
      const failing = { ...stubAdapter("codex", record), execute: async () => { throw new Error("codex write refused"); } };
      const { code, text } = await run({
        selections: { providers: [], clients: ["claude", "codex", "pi"] },
        adapters: { claude: stubAdapter("claude", record), codex: failing, pi: stubAdapter("pi", record) },
        ensureIgnoreRule: async () => {},
        writeOwnership: async () => {},
      });
      expect(code).toBe(1);
      expect(record).toEqual(["claude"]);
      expect(text).toMatch(/completed: ignore-rule, claude/i);
      expect(text).toMatch(/failed: codex/i);
      expect(text).toMatch(/unattempted: pi/i);
      expect(text).toMatch(/no automatic rollback/i);
    });

    test("keeps provider secrets out of the failure report", async () => {
      const { text } = await run({
        selections: { providers: ["trello"], clients: [] },
        providerValues: { trello: { TRELLO_TOKEN: "super-secret-token" } },
        writeEnvFile: async () => { throw new Error("denied writing super-secret-token"); },
      });
      expect(text).not.toContain("super-secret-token");
      expect(text).toMatch(/\[redacted\]/);
    });

    test("reports a truthful partial state when the target changed but its ownership record did not", async () => {
      const record = [];
      const adapter = {
        ...stubAdapter("claude", record),
        execute: async (operation, dependencies) => { record.push("claude-target"); await dependencies.writeOwnership({}); },
      };
      const { code, text } = await run({
        selections: { providers: [], clients: ["claude"] },
        adapters: { claude: adapter },
        ensureIgnoreRule: async () => {},
        writeOwnership: async () => { throw new Error("sidecar write denied"); },
      });
      expect(code).toBe(1);
      expect(record).toEqual(["claude-target"]);
      expect(text).toMatch(/failed: claude/i);
      expect(text).toMatch(/sidecar write denied/i);
    });

    test("executes the selectable clients even when another one is blocked", async () => {
      const record = [];
      const blocked = { discover: async () => ({ classification: "unknown" }), buildOperation: () => ({ blocked: true, reason: "Pi stays manual." }), execute: jest.fn() };
      const { code, text } = await run({
        selections: { providers: [], clients: ["claude", "pi"] },
        adapters: { claude: stubAdapter("claude", record), pi: blocked },
        ensureIgnoreRule: async () => {},
        writeOwnership: async () => {},
      });
      expect(code).toBe(0);
      expect(record).toEqual(["claude"]);
      expect(text).toMatch(/Pi stays manual/);
      expect(blocked.execute).not.toHaveBeenCalled();
    });
  });

  describe("PR 4 Claude manager wiring", () => {
    const root = "/repo";

    test("uses the default safe project-config inspection for an absent Claude config", async () => {
      const filesystem = { ...memoryFs({ [root]: "dir", [path.join(root, ".git")]: "file" }), readFile: async () => { throw ENOENT(); } };
      const runCommand = jest.fn().mockResolvedValue({ stdout: "null", stderr: "" });
      const output = [];
      const result = await setupCommand({
        cwd: root,
        filesystem,
        stdin: { isTTY: false },
        stdout: { isTTY: false, write: (text) => output.push(text) },
        selections: { providers: [], clients: ["claude"] },
        dryRun: true,
        environment: { PATH: "/safe" },
        resolveExecutable: async () => "/bin/claude",
        runCommand,
      });
      expect(result).toBe(0);
      expect(runCommand).toHaveBeenCalledWith("/bin/claude", ["mcp", "get", "ticket-analyzer", "--scope", "project", "--output", "json"], expect.objectContaining({ shell: false, cwd: root }));
      expect(output.join(" ")).toMatch(/Client claude: add/i);
    });

    test("plans an absent concrete Claude fixture as an add without invoking a mutation", async () => {
      const output = [];
      const runCommand = jest.fn().mockResolvedValue({ stdout: "null", stderr: "" });
      const result = await setupCommand({
        cwd: root,
        filesystem: memoryFs({ [root]: "dir", [path.join(root, ".git")]: "file" }),
        stdin: { isTTY: false },
        stdout: { isTTY: false, write: (text) => output.push(text) },
        selections: { providers: [], clients: ["claude"] },
        dryRun: true,
        environment: { PATH: "/safe" },
        resolveExecutable: async () => "/bin/claude",
        runCommand,
        inspectProjectConfig: async () => ({ safe: true, tracked: false }),
      });
      expect(result).toBe(0);
      expect(runCommand).toHaveBeenCalledWith("/bin/claude", ["mcp", "get", "ticket-analyzer", "--scope", "project", "--output", "json"], expect.objectContaining({ shell: false, cwd: root }));
      expect(output.join(" ")).toMatch(/Client claude: add/i);
      expect(output.join(" ")).not.toMatch(/plugin|marketplace|AGENTS/i);
    });
  });

      describe("PR 3 interaction safety remediation", () => {
    test.each([
      ["stdin", { stdin: { isTTY: false }, stdout: { isTTY: true } }],
      ["stdout", { stdin: { isTTY: true }, stdout: { isTTY: false } }],
    ])("refuses interactive setup when %s is not a TTY", async (_stream, streams) => {
      const providers = jest.fn();
      const output = [];
      const result = await setupCommand({
        ...streams,
        stdout: { ...streams.stdout, write: (text) => output.push(text) },
        promptAdapter: { providers },
      });
      expect(result).toBe(1);
      expect(providers).not.toHaveBeenCalled();
      expect(output.join(" ")).toMatch(/interactive.*non-TTY|non-TTY.*interactive/i);
    });

    test("redacts client argv, before/after values, and execution errors", async () => {
      const secret = "client-secret-value";
      const clientError = Object.assign(new Error(`client failed with ${secret}`), {
        stdout: `stdout contains ${secret}`,
        stderr: `stderr contains ${secret}`,
      });
      const execute = jest.fn().mockRejectedValue(clientError);
      const plan = buildPlan({
        root: "/repo",
        snapshots: { env: "env-before" },
        secretInputs: [secret],
        clientOperations: [{
          client: "codex",
          kind: "replace",
          argv: ["configure", secret],
          before: { token: secret },
          after: { command: `token=${secret}` },
          output: `client output contains ${secret}`,
        }],
        operations: [{ id: "client", argv: [secret], output: `raw output ${secret}`, execute }],
      });
      const rendered = renderPlan(plan);
      expect(rendered).not.toContain(secret);
      expect(JSON.stringify(plan)).not.toContain(secret);
      const result = await executePlan(plan, { confirm: async () => true, current: async () => ({ env: "env-before" }) });
      expect(result.failed.reason).not.toContain(secret);
      expect(result.failed.reason).toContain("stdout contains [redacted]");
      expect(result.failed.reason).toContain("stderr contains [redacted]");
    });

    test("keeps provider values redacted across a fresh plan", async () => {
      const secret = "provider-secret-value";
      const execute = jest.fn().mockRejectedValue(new Error(`client failed with ${secret}`));
      const initial = buildPlan({ root: "/repo", snapshots: { env: "before" }, secretInputs: [secret], operations: [{ id: "client", execute }] });
      const fresh = buildPlan({ root: "/repo", snapshots: { env: "fresh" }, operations: [{ id: "client", execute }] });
      const snapshots = [{ env: "before" }, { env: "changed" }, { env: "fresh" }];
      const result = await executePlan(initial, {
        confirm: async () => true,
        replan: async () => fresh,
        current: async () => snapshots.shift(),
      });
      expect(result.failed.reason).not.toContain(secret);
      expect(result.failed.reason).toContain("[redacted]");
    });

    test("re-renders and reconfirms a fresh setup plan after drift", async () => {
      const execute = jest.fn();
      const initial = buildPlan({ root: "/repo", snapshots: { env: "before" }, operations: [{ id: "client", execute }] });
      const fresh = buildPlan({ root: "/repo", snapshots: { env: "fresh" }, operations: [{ id: "client", execute }] });
      const output = [];
      const confirm = jest.fn().mockResolvedValue(true);
      const replan = jest.fn().mockResolvedValue(fresh);
      const snapshots = [{ env: "before" }, { env: "changed" }, { env: "fresh" }];
      const result = await setupCommand({
        plan: initial,
        stdin: { isTTY: true },
        stdout: { isTTY: true, write: (text) => output.push(text) },
        promptAdapter: { confirm },
        current: async () => snapshots.shift(),
        replan,
      });
      expect(result).toBe(0);
      expect(replan).toHaveBeenCalledWith(initial, expect.objectContaining({ reason: expect.stringMatching(/changed|stale/i) }));
      expect(confirm).toHaveBeenCalledTimes(2);
      expect(confirm.mock.calls[1][0].message).toContain(fresh.planId);
      expect(output.join(" ")).toContain(fresh.planId);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
