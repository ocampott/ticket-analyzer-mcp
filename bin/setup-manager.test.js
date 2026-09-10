import { describe, expect, test } from "@jest/globals";
import path from "node:path";
import {
  PROVIDER_ENV_VARS,
  editProviderEnv,
  prepareAtomicWrite,
  resolveManagedEnvPath,
  validateProjectPath,
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
});
