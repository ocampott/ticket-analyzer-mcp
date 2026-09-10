import { describe, expect, test } from "@jest/globals";
import path from "node:path";
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
} from "./setup-files.js";
import { resolveProjectRoot } from "./setup-manager.js";

const ENOENT = () => Object.assign(new Error("missing"), { code: "ENOENT" });
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
      pi: { settingsPath: ".pi/settings.json", packageName: "ticket-analyzer-mcp", packageSpec: "npm:ticket-analyzer-mcp@2.3.1", scope: "local", environmentBinding: "runtime-cwd-env" },
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
      pi: { settingsPath: ".pi/settings.json", packageName: "ticket-analyzer-mcp", packageSpec: "npm:ticket-analyzer-mcp@2.3.1", scope: "local", environmentBinding: "runtime-cwd-env" },
    });
    const observed = { settingsPath: ".pi/settings.json", packageName: "ticket-analyzer-mcp", packageSpec: "npm:ticket-analyzer-mcp@2.3.1", scope: "local", environmentBinding: "runtime-cwd-env" };
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
});
