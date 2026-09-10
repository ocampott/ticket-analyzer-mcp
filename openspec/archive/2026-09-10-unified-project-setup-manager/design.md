# Technical Design: Unified Project Setup Manager

**Change:** `unified-project-setup-manager`  
**Status:** Design complete; implementation is not authorized  
**Routing:** `openai-codex/gpt-5.6-terra`  
**Artifact store:** OpenSpec

## 1. Decision summary

`ticket-analyzer-mcp setup` becomes the sole interactive, project-scoped setup manager. `setup --configure-clients` is accepted as an alias with identical behavior; it neither enables a legacy path nor changes the plan. `setup --dry-run` is accepted without that alias and is fully mutation-free, including provider files and sidecar state.

The manager resolves a canonical project root once, uses only `<root>/.env` for provider writes, plans all selected operations from a discovery snapshot, renders a redacted complete plan, and accepts one final confirmation for that exact snapshot. It then re-discovers and validates the snapshot before each mutation. A mismatch invalidates confirmation and returns to planning; it never applies a stale plan.

The manager owns only:

- Claude's `ticket-analyzer` **project-scope MCP** registration;
- Codex's `[mcp_servers.ticket-analyzer]` project entry in `<root>/.codex/config.toml`;
- Pi's local (`-l`) `npm:ticket-analyzer-mcp@<installed-cli-version>` package action; and
- the selected provider keys in `<root>/.env`.

It never manages Claude marketplace/plugin state, `AGENTS.md`, a global Pi/npm installation, Codex trust, or inherited provider environment values.

## 2. Project root and environment resolution

### Root algorithm

`resolveProjectRoot(cwd, filesystem): Promise<ProjectRoot>` will:

1. canonicalize `cwd` with `realpath`; failure is a non-mutating error;
2. walk ancestors to the filesystem root;
3. return the nearest ancestor containing `.git` (a directory **or** worktree `.git` file); if none exists, return the nearest ancestor containing `package.json` as a regular file;
4. otherwise safely exit with `Cannot resolve a project root: run setup inside a Git worktree or a project containing package.json.`

No fallback to an arbitrary current directory is permitted. This avoids silently making an incidental directory into a credential/configuration scope. The resolved absolute root is rendered in the plan and is an input to plan identity.

`resolveManagedEnvPath(root)` is deliberately separate from the runtime `resolveEnvFile` function: it always returns `path.join(root, ".env")`, after validating the root boundary. It ignores an inherited `TICKET_ANALYZER_ENV_FILE`; that variable must not redirect setup writes. The manager reads provider values only from this file and never reads inherited provider values. Runtime behavior remains unchanged: an actual process variable overrides a value loaded from the file. Every provider removal plan and result repeats that this manager can delete only the stored `.env` values, not an inherited effective value.

For all manager-created Claude and Codex registrations, `TICKET_ANALYZER_ENV_FILE` is the canonical, absolute managed-env path. It contains no credential. A path is never made relative to the client CWD.

### Safe file boundary

Before a mutable file action, the manager rejects a symlink at the file or an existing parent component below the project root. It does not follow a symlink to write a file outside the root. The applicable targets are exactly:

- `<root>/.env`
- `<root>/.codex/config.toml`
- `<root>/.ticket-analyzer/setup-state.json`
- `<root>/.gitignore` (only for the single literal sidecar-state rule defined below)

Claude is changed through its project-scope command, not by a manager-written file. The manager may inspect its conventional project `.mcp.json` only when needed for discovery; it never rewrites that file directly.

## 3. Proposed module boundaries and interfaces

Implementation remains in the existing JavaScript CLI layer, so no production TypeScript/server API is required for the manager.

| Proposed path | Responsibility |
| --- | --- |
| `bin/cli.js` | Retain command dispatch, export `parseSetupArgs`, and delegate `setupCommand` to the manager. Remove the legacy credential-first/client-per-confirmation path. Retain hardened `runCommand` and executable resolution behind injected interfaces. |
| `bin/setup-manager.js` | Root resolution, interactive orchestration, discovery, reconciliation prompts, plan construction/rendering, plan identity checks, ordered execution, and non-secret outcome reporting. |
| `bin/setup-files.js` | Conservative `.env` range editor, root `.gitignore` sidecar-rule inspector/appender, atomic writer, sidecar reader/writer, redacted unified diff renderer, snapshot hashes, and root/symlink validation. |
| `bin/setup-adapters.js` | `ClaudeAdapter`, `CodexAdapter`, and `PiAdapter`, their discovery classifications, exact operation builders, structured project-local configuration inspectors, and no-secret subprocess boundary. |
| `bin/setup-manager.test.js` | Focused strict-TDD manager, plan, state, adapters, failure, and file-preservation tests. |
| `bin/cli.test.js` | Update compatibility/dispatch and retain process-spawn regressions. |
| `extensions/ticket-analyzer.js` and `extensions/ticket-analyzer.test.js` | Make the local Pi runtime derive the absolute `<ctx.cwd>/.env` binding only when Pi has not supplied `TICKET_ANALYZER_ENV_FILE`; never forward provider credentials from the manager. |
| Root `.gitignore` and focused setup-manager tests | Add only the literal repository-local state-file ignore rule as part of the same confirmed plan when it is absent and safely appendable; never ignore client configuration. |
| `.mcp.json`, `src/release.test.ts`, and active setup guidance tests | Migrate the distributed, credential-free static-template contract and remove assertions for marketplace/client-wizard behavior. Product documentation changes belong to the same later migration work unit, not this design artifact. |

Core interfaces (names are proposed and are intentionally dependency-injected for tests):

```js
/** @typedef {'owned'|'matching'|'foreign'|'unknown'} RegistrationClass */

export async function resolveProjectRoot(cwd, fs) // => { root, canonicalRoot }
export function resolveManagedEnvPath(root) // => absolute <root>/.env
export function editProviderEnv(before, providerOps) // => { after, affectedLines, redactedDiff } | SafeExit
export function buildPlan(input) // => SetupPlan
export function computePlanId(plan, secretInputs, snapshots) // in-memory SHA-256 only
export async function executePlan(plan, dependencies) // => ExecutionReport

class ClientAdapter {
  async discover(context) {} // => ClientDiscovery
  buildOperation(intent, discovery, context) {} // => PlannedOperation | BlockedOperation
  async verify(snapshot, context) {} // => { current: boolean, reason?: string }
  async execute(operation, context) {} // => OperationResult
}
```

`ClientDiscovery` has `{ client, classification, target, observed, snapshot, limitations?, recovery? }`. `observed` contains only non-secret registration data. `SetupPlan` is immutable after construction and includes ordered operations, blocked operations, exact rendered changes, snapshots, and an in-memory-only `planId`. No plan, report, sidecar, or exception serializes credential values.

## 4. Ownership sidecar

### Location, permissions, ignore rule, and schema

The durable ownership record is the **repository-local ignored operational-state** file `<root>/.ticket-analyzer/setup-state.json`. It is intentionally separate from client configuration so adoption does not rewrite a matching entry. Because it contains the canonical absolute root, it MUST NOT be left as a tracked consumer artifact. The manager creates `.ticket-analyzer` with mode `0700` where the platform permits and creates the state file with mode `0600`.

A plan that creates or retains sidecar state MUST also establish this one root `.gitignore` rule when it is not already present:

```gitignore
/.ticket-analyzer/setup-state.json
```

The manager may inspect only the root `<root>/.gitignore` for this purpose, after the same root/symlink checks. Its intentionally narrow `inspectSidecarIgnoreRule` recognizes the exact unnegated, root-anchored literal above (with an optional terminal CR) as already satisfying the rule. It safely appends exactly that line—using the existing LF/CRLF and final-newline convention, or a new LF file—only when no existing line or pattern refers to `.ticket-analyzer` or `setup-state.json`. Any negation, wildcard, directory pattern, escaped form, duplicate, or other rule that might include or exclude the state path is ambiguous: no `.gitignore`, sidecar, or associated client mutation is offered, and the plan gives manual recovery guidance. It never writes a wildcard, a directory-wide rule, a global exclude, or any ignore entry for `.mcp.json`, `.codex/config.toml`, `.pi/settings.json`, `.env`, or another consumer configuration.

The displayed unified plan includes the exact non-secret textual `.gitignore` diff, including for a tracked `.gitignore`, and the sidecar and ignore-rule changes are covered by the same final confirmation and snapshots. The append is never an unshown prerequisite or a separate confirmation. A later plan may remove only the exact literal rule only after all manager sidecar records are absent and an equally exact confirmed diff is displayed; otherwise it leaves the rule intact. Failure or ambiguity while establishing the required rule is a safe exit before any state-dependent adoption or client mutation.

Schema version 1:

```json
{
  "schemaVersion": 1,
  "projectRoot": "/absolute/canonical/project/root",
  "clients": {
    "claude": {
      "registrationId": "ticket-analyzer",
      "scope": "project",
      "command": "ticket-analyzer-mcp",
      "envFile": "/absolute/canonical/project/root/.env"
    },
    "codex": {
      "configPath": ".codex/config.toml",
      "table": "mcp_servers.ticket-analyzer",
      "command": "ticket-analyzer-mcp",
      "envFile": "/absolute/canonical/project/root/.env"
    },
    "pi": {
      "settingsPath": ".pi/settings.json",
      "packageName": "ticket-analyzer-mcp",
      "packageSpec": "npm:ticket-analyzer-mcp@2.3.1",
      "scope": "local",
      "environmentBinding": "runtime-cwd-env"
    }
  }
}
```

The version shown is illustrative; implementation obtains the installed CLI package version from existing package metadata, not a user-controlled string. State contains no provider key name/value pair, token, process environment, command output, home path, timestamp, executable path, or arbitrary client output. Unknown schema, root mismatch, duplicate client keys, invalid types, a symlink, or a Pi record that does not agree with the structured project-local entry is `unknown`: the affected client is not mutated and the operator receives manual recovery guidance. State is only changed after its associated client mutation/adoption succeeds.

The writer uses a same-directory private temporary file (`open` with exclusive creation), writes and `fsync`s it, applies the intended mode, renames it atomically, then `fsync`s the directory on platforms that support it. It preserves no secret because none is accepted into this data model. A state write failure after a client mutation is reported as partial failure; automatic rollback is prohibited.

### Ownership/adoption/replacement rules

A client is `owned` only when a valid sidecar record for this canonical root and an adapter-observed target both match the canonical registration shape. A stale record does not prove ownership of a different target. A valid sidecar record with an absent, duplicate, unsafe, or unverifiable target is `unknown`, not permission to recreate/delete arbitrary state.

- **Matching, unowned:** show the canonical non-secret semantic diff (empty registration delta plus the required sidecar/ignore-rule addition), require `adopt`, and write only the sidecar after the rule is safely established.
- **Foreign, unowned:** show the observed targeted entry and replacement/removal delta, require `replace`; replacement changes only the target entry, then writes ownership state.
- **Owned:** update/remove only the canonical target after it appears in the full plan.
- **Unknown:** never adopt, replace, normalize, or delete. Report why and give a client-specific manual recovery path.

A client removal must be selected explicitly. It deletes the client target first and its sidecar record second; if the second step fails, the report truthfully says the registration was removed but stale ownership state remains. It does not remove the `.gitignore` rule as recovery or rollback. A retry requires discovery/reconciliation rather than assuming rollback.

## 5. Discovery and client adapters

### Claude

The Claude adapter manages a project MCP registration named `ticket-analyzer` only. Its exact command vectors are:

```text
claude mcp add --scope project ticket-analyzer --env TICKET_ANALYZER_ENV_FILE=<absolute-root/.env> -- ticket-analyzer-mcp
claude mcp remove --scope project ticket-analyzer
```

It never constructs `claude plugin`, `marketplace`, `plugin install`, `plugin update`, or `AGENTS.md` commands, and sidecar state never records those assets.

Discovery uses the Claude project's registration inspection capability for that name and scope, through a hardened adapter command. The implementation must pin the supported Claude command/output contract in adapter fixtures before enabling mutations. If the installed client cannot provide an unambiguous project-scope result, has unexpected output, is unavailable, or a relevant project `.mcp.json` is unsafe to inspect, discovery is `unknown` and no Claude operation is offered.

Claude owns its config serialization. Therefore the manager can render the exact shell-free argv and exact semantic entry before/after, but it must **not** promise byte-for-byte preservation or a textual `.mcp.json` diff that the Claude CLI does not expose. If the conventional Claude config is tracked, the adapter reports that limitation and safely blocks a command which could rewrite it; the operator must use Claude manually. For an untracked safe target, the plan calls the operation a client command/config operation rather than claiming a file diff. After a successful command, the adapter re-discovers and requires exact canonical semantics before state is written.

### Codex

Codex is changed directly and only at `<root>/.codex/config.toml`; the manager neither invokes a Codex mutation CLI nor creates, edits, detects, reads, parses, or otherwise inspects any Codex trust setting.

Codex project trust is a user-established precondition, not manager-discoverable state. Before selecting a Codex mutation, the operator must establish the project as trusted in Codex using Codex itself and re-run setup. The manager requires an explicit per-run acknowledgement that this prerequisite was completed; without it, Codex is a blocked, non-mutating operation with that recovery instruction. The acknowledgement is an operator assertion, not evidence that the manager attempts to verify, and it is never persisted as trust state.

In particular, no path under `$HOME`, `$CODEX_HOME`, or another home/config directory is read, parsed, rendered, copied, created, or modified. There is no `CodexTrustReader`, no trust-reader test seam, no trust file in plan snapshots, and no trust state in the sidecar or plan identity. The absence of trust inspection does not weaken configuration safety: discovery is restricted to the resolved project's `.codex/config.toml`, its target table is accepted only by the conservative editor below, its exact project-file diff and source snapshot are planned, and every mutation still requires the full confirmed plan. A user who has not established trust receives no Codex mutation; a user whose assertion is inaccurate must resolve trust in Codex and re-run rather than having setup probe or modify sensitive home configuration. A blocked Codex operation never blocks independently safe provider, Claude, or Pi operations.

Because there is no TOML dependency, `CodexTomlEditor` is a conservative token/range editor, not a parse-and-reserialize implementation. It supports only a unique contiguous target table headed `[mcp_servers.ticket-analyzer]`, including its contiguous `[mcp_servers.ticket-analyzer.env]` subtable. It requires a structurally recognizable header/key layout, rejects duplicate target tables, TOML arrays-of-tables, malformed headers, unterminated quoted/multiline values inside the target, or any target form whose boundaries are ambiguous. It preserves every byte outside the target range. For a new empty/missing config it appends this exact canonical fragment, maintaining the file's detected LF/CRLF convention:

```toml
[mcp_servers.ticket-analyzer]
command = "ticket-analyzer-mcp"
args = []

[mcp_servers.ticket-analyzer.env]
TICKET_ANALYZER_ENV_FILE = "/absolute/canonical/project/root/.env"
```

The plan contains the exact unified text diff for this file, including a tracked file, and mutation uses the same atomic writer/snapshot check as the sidecar. Replacing a foreign target may discard comments or formatting **inside that targeted entry only**; the plan states this. It preserves bytes outside the entry but does not claim byte preservation within an explicitly replaced target. If this editor cannot prove those boundaries, Codex is `unknown` and exits safely rather than normalizing TOML.

### Pi

Pi is scoped to a project-local package integration only. The intended action vectors, if and only if a version-pinned safe Pi action contract is established, are:

```text
pi install -l npm:ticket-analyzer-mcp@<installed-cli-version>
pi remove -l npm:ticket-analyzer-mcp
```

Both run with `cwd` set to the resolved root. They never use a filesystem package path, global command, update command, or another package manager. The adapter MUST NOT infer local presence from `pi list`, generic `PATH`, global state, or any human-formatted output.

#### Project-local structured discovery and ownership

`PiSettingsInspector` may inspect **only** `<root>/.pi/settings.json`, after root/symlink validation, as a bounded project-local structured inspection. It reads no Pi home, global, cache, or user configuration. It accepts a file only when it is regular, bounded UTF-8 strict JSON and matches a versioned, fixture-pinned Pi settings schema that exposes one unambiguous local-package collection and one unambiguous `ticket-analyzer-mcp` identity. The supported-schema registry is deliberately allowlisted rather than a best-effort JSON walk; unsupported JSONC/comments, duplicate keys, unrecognized collection layout, package aliases, duplicate matching identities, malformed entries, or an unsafe file are `unknown` and cause a safe Pi exit. The inspector returns only the target package identity/specification and structural location, never unrelated settings values.

The design does not presume that such a schema or a direct Pi action/query contract is currently available. Before the allowlist and action contract are proven in fixtures for a specific Pi version, Pi remains blocked/manual; it must not fall back to `pi list` or an inferred install/remove. Manual `pi install -l` or `pi remove -l` recovery is the result in that case. If a future supported contract is enabled, the plan must show its exact shell-free argv, the recognized target's non-secret semantic before/after state, and the source snapshot; a tracked `.pi/settings.json` is blocked unless that contract also supplies the exact proposed textual diff and proves preservation of every unrelated byte. The manager never directly reserializes or normalizes `.pi/settings.json`. For an untracked file, a contract must still prove with fixture-backed pre/post structured checks that unrelated settings and non-target package entries are preserved; otherwise the operation remains manual.

Within a recognized schema, classification is precise:

- **Absent:** no target package entry and no Pi sidecar record; an add is eligible only when the safe action contract is available.
- **Matching:** exactly one unowned entry has the canonical local `npm:ticket-analyzer-mcp@<installed-cli-version>` specification.
- **Foreign:** exactly one unowned entry identifies `ticket-analyzer-mcp` but has a different or conflicting local specification; it requires the ordinary explicit `replace` decision.
- **Owned:** exactly one target entry agrees with a valid canonical-root sidecar Pi record for `settingsPath: ".pi/settings.json"`, `scope: "local"`, package name, and canonical package specification.
- **Unknown:** any sidecar/entry disagreement, stale sidecar, duplicate target, schema ambiguity, missing safe action contract for the requested operation, or inability to preserve the file. Unknown is never permission to install, remove, adopt, replace, or normalize.

Adopting a `matching` Pi entry writes only the sidecar after the required `.gitignore` rule is safely established; it does not rewrite Pi settings. A `foreign` target is never claimed silently. Pi removal first executes the verified project-local target action, then removes only the Pi sidecar record; it never touches global Pi/package state. If the direct action has no safe query/action contract, all add, replace, and remove cases retain manual recovery rather than guessing from a human CLI listing.

Pi has no registration-level environment binding in the established evidence. The Pi extension change supplies `TICKET_ANALYZER_ENV_FILE=path.resolve(ctx.cwd, ".env")` only when the Pi process did not already pass that variable, and passes no provider variables from setup. This yields the required absolute project binding when Pi's local project context has `ctx.cwd === root`; if Pi cannot provide that project context, the adapter reports the limitation rather than asserting a persistent configuration binding.

## 6. Provider environment editing

`editProviderEnv` accepts operations only for the provider's declared `PROVIDER_ENV_VARS`. Add/edit writes the selected keys; removal deletes only complete logical assignments for those keys. It never deletes a comment, another provider, or an unrecognized key.

The editor is a line-preserving scanner, not a dotenv parse/reserialize cycle. It recognizes a unique single-line `KEY=value` or `export KEY=value` assignment with an unambiguous comment boundary. It preserves untouched lines byte-for-byte, retains LF versus CRLF and final-newline style, and retains an edited line's `export`/spacing style where safe. Duplicate selected keys, multiline/unterminated values, or unsupported syntax make that provider operation `unknown` and non-mutating; they are not silently deduplicated. Addition uses a canonical quoted value line at EOF. A newly created `.env` is mode `0600`; an existing file retains its original mode and is not forcibly chmodded.

The rendered `.env` diff contains only affected provider variable names and `[redacted]` values, never surrounding unrelated values or secret text. It is still exact about add/change/delete targets. The displayed plan/result includes: `An inherited process environment variable overrides .env and is outside this manager; deleting this file value does not prove the provider inactive.`

## 7. Plan, confirmation, execution, and recovery

### Snapshot identity

A plan snapshots canonical root, selections, provider operation kinds, explicit adoption/replacement decisions, the Codex trust-precondition acknowledgement, adapter discovery classifications/semantic observations, exact client argv, sidecar before/after text, root `.gitignore` before/after text, and raw contents of every mutable project-local file. File content hashes and an intent digest that includes entered credential values are held in memory only; values and hashes are never displayed or persisted. `planId = SHA-256(canonical-private-plan-input)` is an in-process confirmation token, not a user authorization string.

After rendering, the one final prompt explicitly names every deletion/replacement and asks confirmation for the full `planId`. `--dry-run` renders this same plan but never prompts or executes. Before accepting confirmation and again before each operation, the manager re-runs project-local discovery and recomputes relevant source snapshots. A changed selection, decision, Codex trust-precondition acknowledgement, root, executable identity, registration classification, file bytes (including `.gitignore`), sidecar bytes, or operation rendering invalidates confirmation. It prints the revised plan and requires a new confirmation. Codex trust itself is deliberately not detected or snapshotted. This closes the normal prompt-to-execution race; an atomic writer also checks its expected source bytes immediately before rename.

Non-TTY behavior is safe: if a selection, credential, adoption/replacement decision, or final confirmation is absent, it exits without mutation and explains the needed interactive/explicit input. A dry run can execute only read-only discovery when all plan inputs are supplied.

### Ordered operations

The plan order is fixed and rendered before confirmation:

1. root, state, root `.gitignore`, provider file, Codex trust-precondition acknowledgement, and client discovery;
2. selected provider `.env` operations (one atomic file transaction);
3. when any sidecar state is planned, append the exact literal sidecar ignore rule atomically (or verify the recognized rule);
4. for each client in deterministic order `claude`, `codex`, `pi`: targeted client add/update/replace/remove;
5. immediately after each successful client action or adoption, its atomic sidecar update/removal;
6. final result report.

Provider work precedes clients so a successful registration does not intentionally bind a missing newly selected provider file. The narrow ignore-rule action precedes any client action that will create state, so an absolute-root sidecar is never newly written as an unignored operational file. Client state follows its target action so sidecar never claims an action that failed. There is no multi-file atomic transaction and no automatic rollback.

Any failure stops the sequence. The report has `completed`, `failed`, and `unattempted` operation lists; it identifies known remaining state, redacts outputs, says rollback was not attempted, and recommends re-running setup to obtain a new plan or manually restoring only the named project target from version control/backups. Successful earlier operations remain successful in the report. A blocked client is not a failure and does not prevent independent planned operations.

### Subprocess security

All client commands use an absolute resolved executable, argument arrays, `shell: false`, project-root `cwd`, bounded stdout/stderr, timeout/termination, and the existing secret-redacting failure boundary. The child environment is a minimal allowlist for the invoked client (`PATH`, required platform variables, locale/temp, and `HOME` only where that invoked client requires it); it never supplies `CODEX_HOME`, and no Codex subprocess is invoked. It removes every declared provider key, `TICKET_ANALYZER_ENV_FILE`, and secret-like key. Claude receives the env-file binding only as its `--env` argument. Pi receives no provider value. Captured output is redacted before plan/result reporting and never saved into sidecar state.

## 8. Static template migration

`.mcp.json` remains a distributed credential-free example, but is no longer described as the mechanism that creates a managed consumer registration. Its `mcpServers` key is migrated from the ambiguous `pm` name to `ticket-analyzer`, with the published command `ticket-analyzer-mcp` and no `env` object. It deliberately contains no consumer-specific environment path and no provider variable. The unified manager materializes the absolute env binding only in a project's Claude/Codex registration; Pi obtains it through the local extension runtime contract above.

Release tests must assert this narrower promise rather than falsely asserting that the static template itself binds a project's credentials. Documentation migration will remove legacy marketplace automation and credential-only bare-setup claims, while retaining marketplace/plugin and `AGENTS.md` as manual, never-owned actions.

## 9. Strict-TDD verification plan

Each production behavior starts with a focused failing Jest test, then the smallest implementation, focused `npm test -- <test-path>` result, and `npm run build` before its work unit is complete. Test seams are injected filesystem (`realpath`, `lstat`, read/write/rename/fsync), clock/random temp name, prompt adapter, root `.gitignore` inspector, project-local Codex/Pi inspectors, adapters, executable resolver, and command runner; tests never need a real Claude, Codex, Pi, provider, credential, or home-directory configuration.

Required test groups:

1. Root selection/rejection, canonical `.env` targeting despite inherited env-file override, root/symlink rejection, and no inherited provider reads.
2. `.env` exact targeted edit/removal, duplicates/multiline safe exit, unrelated byte preservation, permissions, redacted diff, and precedence warning.
3. State schema validation, no-secret serialization, absolute-root record handling, root mismatch/stale ownership, atomic write failure, adoption without client rewrite, and replacement/removal state ordering.
4. Root `.gitignore` exact literal append and tracked unified diff, LF/CRLF/final-newline preservation, existing exact-rule recognition, and safe exits for negation, wildcard, directory, duplicate, escaped, symlinked, or otherwise ambiguous relevant rules; assert that no consumer config or broad wildcard can be ignored and that state-dependent mutations do not start before the rule succeeds.
5. Plan rendering and identity invalidation for changed selections, discovery, decisions, Codex precondition acknowledgement, file bytes (including `.gitignore`), sidecar bytes, and executable; dry run has no prompts/writes/spawns; non-TTY exits cleanly.
6. Claude exact project argv/no marketplace argv, unavailable/ambiguous/unsafe/tracked-config safe exit, semantic post-command verification, and child environment/output redaction.
7. Codex precondition acknowledgement blocks mutations until the user establishes trust and re-runs; assert no `$HOME`, `$CODEX_HOME`, home configuration, trust reader, Codex subprocess, or trust snapshot is read or written. Cover TOML append/update/delete/replacement diffs, CRLF/comments/foreign-byte preservation, malformed/duplicate/unsupported safe exits, and independently safe operations continuing when Codex is blocked.
8. Pi structured `.pi/settings.json` inspection accepts only fixture-pinned schema/layout, classifies absent/matching/foreign/owned/unknown precisely with sidecar agreement, preserves unrelated settings through required contract checks, and safely exits for malformed, JSONC, duplicate, alias, stale, or unsupported state. Cover exact local argv only when a pinned safe action contract exists; otherwise assert manual recovery, no `pi list`, no global/local-path action, and no settings rewrite. Cover extension absolute path behavior without forwarding provider secrets.
9. Stop-on-first-failure reports completed/failed/unattempted operations without rollback or secrets; includes an ignore-rule success followed by client failure truthfully; legacy bare/alias parsing and static-template/release migration assertions remain covered.

## 10. Review workload and rollout

The expected implementation and tests materially exceed the 400-line review budget. Under the configured `ask-on-risk` strategy, implementation must pause with a measured forecast and ask for a delivery choice; this design does not select a chain strategy or a `size:exception`.

If authorized, the smallest coherent work-unit slices are:

1. **Core safe planning:** root/env resolution, provider range editing, exact root `.gitignore` sidecar-rule handling, redacted plan/snapshot identity, sidecar atomicity, and their tests.
2. **Reconciliation adapters:** Claude command boundary, Codex project-TOML editor plus user-established trust precondition (without home inspection), Pi structured project-settings inspector/action-contract gate, execution report, and adapter tests.
3. **Migration:** Pi extension path contract, static template/release tests, and all affected user guidance/tests.

Each slice includes its tests and rollback boundary. Slice 1 can be reverted by removing new manager core files, its exact sidecar ignore-rule handling, and CLI delegation; slice 2 by removing the adapters and returning clients to blocked/manual handling; slice 3 by reverting only template/extension/documentation migration. No slice authorizes a product configuration, a client/provider CLI invocation in this design phase, a commit, or publication.
