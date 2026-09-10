# Apply Progress: unified-project-setup-manager

## Phase status

- Status: completed for assigned work unit PR 1.
- Parent status consumed: authoritative `applyState: ready`, `changeName: unified-project-setup-manager`, OpenSpec store, repo-local action context, allowed edit root the repository root.
- Action-context warning consumed: `openspec` is untracked; no edit-root violation occurred.
- Delivery boundary: stacked-to-main PR 1, project-root and provider `.env` guardrails only.
- Review budget: 286 authored source/test lines versus `main`, below the 400 changed-line limit (OpenSpec metadata files excluded from this source count).
- Runtime harness: N/A; injected filesystem seams exercised the complete PR 1 boundary and no client/provider process or credential was invoked.

## Completed task and persisted checkbox

- Completed the PR 1 implementation row in `openspec/changes/unified-project-setup-manager/tasks.md` and changed it from `- [ ]` to `- [x]`.
- Re-read the persisted tasks artifact after the update; the PR 1 row is visibly checked and nine later task rows remain unchecked.

## Files changed

- `bin/setup-manager.js` — injected canonical Git/worktree or regular `package.json` project-root resolution.
- `bin/setup-files.js` — canonical project `.env` path, root/symlink boundary validation, provider allowlists, conservative line-preserving edit/removal planning, redacted diffs, precedence warning, and atomic-write preparation.
- `bin/setup-manager.test.js` — focused strict-TDD tests for root selection/rejection, env-file override isolation, symlink safety, preservation, formatting, safe exits, redaction, and modes.
- `openspec/changes/unified-project-setup-manager/tasks.md` — PR 1 checkbox only.
- `openspec/changes/unified-project-setup-manager/apply-progress.md` — this cumulative record.

## TDD Cycle Evidence

| Cycle | Concrete evidence |
|---|---|
| RED | `npm test -- bin/setup-manager.test.js` failed before implementation because `./setup-files.js` was missing; no production helper existed when the initial focused test was written. |
| GREEN | `npm test -- bin/setup-manager.test.js` passed with 5 tests after the first implementation. |
| TRIANGULATE | Added root-symlink and inline-comment/no-final-newline cases; the focused run failed 2 tests, exposing missing root checks and comment preservation. |
| REFACTOR | Isolated `splitValue`/format handling, added root validation, preserved comment tails, and reran `npm test -- bin/setup-manager.test.js`: 1 suite and 6 tests passed. |

## Verification evidence

- `npm test -- bin/setup-manager.test.js` — PASS, 1 suite, 6 tests.
- `npm test` — PASS, 27 suites, 309 tests.
- `npm run build` — PASS, `tsc` exit code 0.

## Deviations and scope protection

No design deviations. CLI dispatch, plans/prompts, sidecar/ignore state, client adapters, runtime extension, docs, real client/provider invocation, credential acquisition, mutations, commits, and publishing remain out of scope for PR 1.

## Remaining tasks

The following exact unchecked rows remain in `tasks.md`:

- [x] **RED:** add focused state cases for schema-v1 validation at the project-local sidecar path `.ticket-analyzer/setup-state.json`, no-secret serialization, absolute-root mismatch/stale-record rejection, duplicate/invalid client records, symlink rejection, and atomic state-write failure. **GREEN:** implement private-temp/fsync/rename sidecar IO and non-secret ownership facts. **TRIANGULATE:** test that state changes only after its associated successful action/adoption and a Pi record disagreement is `unknown`. **REFACTOR:** keep state independent from client config serialization. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [x] **RED:** add ignore-rule cases for the exact project-root sidecar ignore-rule recognition/append and exact tracked-file diff. **GREEN:** implement root-only literal inspection/append as a planned sidecar prerequisite. **TRIANGULATE:** preserve LF/CRLF/final-newline style and safely exit on negation, wildcard, directory, escaped, duplicate, symlinked, or other relevant ambiguous rules; prove no consumer config or broad wildcard is ignored. **REFACTOR:** keep ignore syntax recognition deliberately narrower than general gitignore parsing. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add plan tests for redacted complete rendering, sidecar/ignore-file entries, plan IDs, changed selection/reconciliation/file/sidecar/ignore/executable invalidation, and the unpersisted Codex precondition acknowledgement. Add CLI tests for bare `setup`, `--configure-clients`, and independent `--dry-run`. **GREEN:** implement immutable in-memory plan construction, snapshots, one final confirmation, alias-compatible delegation, dry-run rendering, and non-TTY safe exits. **TRIANGULATE:** prove dry-run has no prompts/writes/spawns and confirmation is re-requested after every changed input; no trust file is ever a snapshot input. **REFACTOR:** retain `parseSetupArgs` and hardened command boundaries. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.
- [x] **RED:** add fixture-driven Claude cases for owned/matching/foreign/unknown classifications, explicit adopt/replace decisions, unavailable or ambiguous inspection, unsafe conventional `.mcp.json`, and tracked-config blocking. **GREEN:** add `ClaudeAdapter` with only project-scope add/remove argv, semantic post-command verification, and target-before-sidecar ordering. **TRIANGULATE:** prove no marketplace/plugin/`AGENTS.md` argv or ownership, exact shell-free semantic operation rendering when byte diffs are unavailable, and bounded redacted child environment/output. **REFACTOR:** share only narrow adapter result interfaces. **Docs:** update only the allowed Claude sections to state project MCP ownership and manual marketplace/plugin responsibility. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add Codex tests for per-run trust-precondition acknowledgement, blocked-but-independent outcomes, exact append/update/delete/replacement diffs, and conservative target rejection. **GREEN:** implement project-only `.codex/config.toml` range inspection/editing for `[mcp_servers.ticket-analyzer]` and its `.env` subtable through atomic source-snapshot checks. **TRIANGULATE:** cover comments, CRLF, foreign-byte preservation, tracked-file diffs, duplicate/array/malformed/unterminated target safe exits, and targeted-entry-only replacement loss. Assert no `$HOME`, `$CODEX_HOME`, home config, trust reader/snapshot, Codex subprocess, or trust mutation exists. **REFACTOR:** keep the acknowledgement unpersisted and separate from TOML facts. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add adapter/manager tests for owned/matching/foreign/unknown Codex outcomes, explicit adoption/replacement, plan invalidation before execution, and sidecar update only after verified target success. **GREEN:** wire the PR 5 editor into `CodexAdapter` operations and blocked manual recovery. **TRIANGULATE:** verify exact planned diffs remain required for tracked config, acknowledgement absence performs no mutation, and independent provider/Claude operations remain available. **REFACTOR:** avoid widening the project-file-only Codex authority. **Docs:** update only the allowed Codex guides to require user-established trust and preserve manual `AGENTS.md` responsibility. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add fixture cases for strict project-local `.pi/settings.json` schema acceptance and absent/matching/foreign/owned/unknown classification with sidecar agreement. **GREEN:** implement `PiSettingsInspector`/`PiAdapter` that inspect only the project file and gate exact local install/remove argv on a version-pinned safe action contract. **TRIANGULATE:** reject JSONC, duplicate keys, aliases, malformed/unsupported layouts, duplicate targets, stale state, tracked settings lacking an exact-preservation contract, `pi list`, global state, and filesystem package actions; prove matching adoption does not rewrite settings and blocked/manual recovery is non-mutating. **REFACTOR:** isolate schema/action allowlists from general JSON handling. **Docs:** update `docs/pi-install.md` with the project-local/manual-recovery boundary. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add manager-seam and CLI regressions for fixed provider → ignore-rule → `claude` → `codex` → `pi` ordering, per-operation rediscovery, stale-plan invalidation, first failure, and bare/alias dispatch. **GREEN:** finish `executePlan` orchestration and delegate `setupCommand` while retaining hardened executable/runner interfaces. **TRIANGULATE:** assert completed/failed/unattempted and known remaining state, no automatic rollback, no secret output, blocked-client independence, client target-before-state removal, and truthful state-write failure reporting. **REFACTOR:** centralize redaction/result formatting and remove only the legacy credential-first/per-client-confirmation path. **Docs:** update allowed generic guidance for bare setup, alias, dry-run, one confirmation, explicit deletion, safe exits, and recovery. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** update focused failing assertions for Pi's absolute `<ctx.cwd>/.env` fallback and the credential-free `ticket-analyzer` static template. **GREEN:** implement the extension fallback only when Pi has not supplied `TICKET_ANALYZER_ENV_FILE`, and migrate `.mcp.json`/release assertions to the published command/key without an `env` object. **TRIANGULATE:** prove an existing Pi env-file binding wins, fallback is absolute, no provider credential is forwarded, and the template contains no credential or consumer-specific path. **REFACTOR:** keep extension environment construction independent from setup-manager state. **Verify:** `npm test -- extensions/ticket-analyzer.test.js src/release.test.ts`; then `npm test`; then `npm run build`.

## Work-unit rollback boundary

Remove only `bin/setup-manager.js`, `bin/setup-files.js`, and `bin/setup-manager.test.js`, plus the PR 1 checkbox/progress records. This does not revert later adapter, sidecar, CLI, consumer, or documentation behavior.

## Independent-verification remediation

- Remediated only the PR 1 independent-verification findings: temporary paths are absolute, validated under the canonical project root, distinct from and in the same directory as the target, and checked for symlink/non-regular path hazards before an atomic-write preparation object is returned.
- File-path validation now explicitly requires the injected `lstat` seam and rejects non-directory or symlinked roots; target and temporary path validation share the same root-boundary checks.
- Continuation detection now counts all trailing backslashes and rejects every odd parity (`1`, `3`, and `5` tested) while permitting even parity (`2` and `4` tested).
- Public `affectedLines` entries contain only provider key/action and redacted before/after lines; credential-bearing source text remains limited to the write content needed by the internal file transaction.
- TDD remediation evidence: RED focused run failed with three expected regressions (raw affected lines, odd-backslash handling, and synchronous atomic preparation); GREEN passed 8 focused tests; TRIANGULATE covered odd/even parity, relative/outside/same-directory/temp symlink paths, non-directory/symlink roots, and redacted affected lines; REFACTOR added explicit parity counting, injected-filesystem requirements, normalized temporary-path validation, and retained green focused tests.
- Verification after remediation: `npm test -- bin/setup-manager.test.js` — PASS, 1 suite and 8 tests; `npm test` — PASS, 27 suites and 311 tests; `npm run build` — PASS, `tsc` exit code 0.
- Actual PR 1 source/test diff count is 286 authored lines versus `main`, below the 400-line budget; the current boundary remains stacked-to-main PR 1 and no later slice was touched.
- Structured status consumed: `unified-project-setup-manager`, OpenSpec, `applyState: ready`, `actionContext.mode: repo-local`, allowed root the repository root, delivery `stacked-to-main`, current slice `PR1`; no action-context warning beyond the existing untracked OpenSpec note.
- Skill resolution: `paths-injected` for the `work-unit-commits` skill and the `chained-pr` skill.
- Remaining tasks: nine later implementation rows remain unchecked; their exact unchecked `- [ ]` lines are preserved in the existing **Remaining tasks** section above.

## Public-redaction remediation retry

- Rechecked the PR 1 implementation row in `openspec/changes/unified-project-setup-manager/tasks.md`; it is now visibly marked `- [x]` after the remediation evidence passed.
- Changed only `bin/setup-files.js` and `bin/setup-manager.test.js` for the remediation; the raw edited file content now remains in a module-private `WeakMap`, while atomic-write content is non-enumerable and consumed through the private edit result path.
- Added regression coverage proving edit, add, and remove results expose no `after` field and serialize no old or new credential values; preservation tests verify the private write path still produces exact content.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| PR1 public redaction | `bin/setup-manager.test.js` | Unit | ✅ 8/8 focused | ✅ 1 expected failure for public `after` | ✅ 9/9 focused after private-path implementation | ✅ add/edit/remove redaction and non-enumerable write content | ✅ focused suite remained green after cleanup |

### Verification evidence

- `npm test -- bin/setup-manager.test.js` — PASS, 1 suite and 10 tests.
- `npm test` — PASS, 27 suites and 313 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- Runtime harness: N/A; injected filesystem and pure provider-edit seams were used, with no real client/provider calls or credentials.
- Review boundary: stacked-to-main PR 1 public-redaction remediation; authored source/test change remains within the 400-line PR budget, and no later PR slice was touched.
- No design deviation beyond the remediation contract: public `editProviderEnv` results no longer expose raw `after`; private write content remains available only through the module-private result map and non-enumerable atomic preparation field.
- Structured status consumed: authoritative manual-compatible `spec-driven` status for `unified-project-setup-manager`, OpenSpec store, `applyState: ready`, repo-local root the repository root, allowed edit root limited to that repository, and warning that OpenSpec/PR1 files are untracked.
- Skill resolution: `paths-injected` for the required work-unit and chained-PR skills.

## PR 2 — Ignored ownership sidecar foundation

- Status: completed for assigned PR 2 work unit; both PR 2 implementation rows are visibly checked in `tasks.md`.
- Structured status consumed: parent-authoritative `changeName: unified-project-setup-manager`, OpenSpec store, `applyState: ready`, repo-local action context, and allowed root the repository root.
- Authentication: `gentle-ai sdd-attempt acquire` request `44ec216a-1b53-4a81-a690-c6fae3a33e20` returned `state: proceed`; no settle command was run because no commit/PR/delivery operation was requested.
- Reconciled timed-out Luna work rather than discarding it: repaired escaped literals/regular expressions, source JSON/newline serialization, and exact append-diff construction; retained the existing RED coverage and completed its atomic write seam.
- Files changed: `bin/setup-files.js`, `bin/setup-manager.test.js`, `openspec/changes/unified-project-setup-manager/tasks.md`, and this cumulative progress artifact. `bin/setup-manager.js` was intentionally untouched.
- Sidecar behavior: schema-v1 accepts only canonical-root, exact client facts; serialization is secret-free; reads/writes reject symlinks; writes use exclusive same-directory private temps, file fsync, `0600`, rename, and directory fsync; ownership persists only after a successful action and Pi disagreements are `unknown`.
- Ignore behavior: only `/.ticket-analyzer/setup-state.json` is recognized/appended; root `.gitignore` inspection is root-bound and symlink-safe; LF/CRLF and final-newline conventions are retained; relevant negation, wildcard, directory, escaped, duplicate, or sidecar-related rules safely exit; generated plans render the exact textual diff without broad consumer-config ignores.
- Verification: `npm test -- bin/setup-manager.test.js` — PASS, 1 suite / 14 tests; `npm test` — PASS, 27 suites / 317 tests; `npm run build` — PASS (`tsc`, exit 0); `git diff --check` — PASS.
- Runtime harness: N/A. Unit seams exercised filesystem and pure planning boundaries; no real provider/client CLI, credential, mutation, commit, push, or PR action occurred.
- Workload / PR boundary: stacked-to-main PR 2 only; actual source/test diff from `main` is 347 additions + 0 deletions = 347 changed lines, within the 400-line limit. Rollback removes only PR 2 sidecar/ignore helpers and their tests, preserving PR 1 provider primitives.
- Deviations: none. The only action-context warning is that OpenSpec artifacts are untracked; no edit root was exceeded.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 2 sidecar state | `bin/setup-manager.test.js` | Unit | Existing focused suite: 10 PR 1 tests passed; timed-out PR 2 RED cases then failed | 4 expected failures exposed escaped validation/serialization seams | 14/14 focused passed after minimal repair | Canonical-root mismatch, duplicate JSON key, Pi disagreement, failed action, symlink, failure-before-rename, and successful fsync/rename paths | Corrected literal/regex handling and kept state independent from client serialization |
| PR 2 ignore rule | `bin/setup-manager.test.js` | Unit | Same focused baseline | Existing RED case failed exact CRLF append-diff behavior | 14/14 focused passed | LF/no-final-newline, CRLF/final-newline, exact existing rule, negation, wildcard, directory, escaped, duplicate, and symlink inputs | Narrow root-only recognition retained; no general gitignore parser added |

## Remaining tasks

Seven later implementation rows remain unchecked; their exact current `- [ ]` rows are retained above in this cumulative artifact and in the persisted `tasks.md` artifact (PRs 3–9).

## PR 2 root-ordering remediation

- Status: completed only for `pr-2-root-ordering-remediation`; no later PR behavior was edited.
- Authentication: `gentle-ai sdd-attempt acquire` returned `state: proceed` for this work unit. Per instruction, no settle command was run.
- Corrected `writeOwnershipState` to validate the canonical project root and `.ticket-analyzer/setup-state.json` target before `ensureSidecarDirectory` can call `mkdir`.
- Added a strict-TDD regression proving both a symlinked root and a non-directory root reject before directory creation; the injected `mkdir` seam receives no calls.
- Files changed: `bin/setup-files.js`, `bin/setup-manager.test.js`, and this cumulative progress artifact. The PR 2 implementation rows in `tasks.md` were already visibly checked (`- [x]`), so their persisted checkbox state required no further transition.
- Verification: `npm test -- bin/setup-manager.test.js` — PASS, 1 suite / 15 tests; `npm test` — PASS, 27 suites / 318 tests; `npm run build` — PASS; `git diff --check` — PASS.
- Workload / PR boundary: stacked-to-main PR 2 remediation only; current source/test diff from `main` is 263 additions in `bin/setup-files.js` plus 99 additions in `bin/setup-manager.test.js` = 362 changed lines, within the 400-line budget.
- Deviations: none. The authoritative status was `applyState: ready`, OpenSpec store, repo-local action context, with the repository root as the allowed edit root. The OpenSpec directory remains untracked as previously warned.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 2 root ordering | `bin/setup-manager.test.js` | Unit | 14/14 focused passed | 15th test failed: symlink root reached `mkdir` and returned `ENOENT` | 15/15 focused passed after pre-validating root and target | Symlinked and regular-file roots both reject with zero `mkdir` calls | No additional refactor; explicit target binding keeps validation and write target aligned |

## Remaining tasks

Seven later implementation rows remain unchecked; their exact `- [ ]` rows remain in the earlier cumulative **Remaining tasks** section and the persisted `tasks.md` artifact (PRs 3–9).

## PR 3 — Immutable plan and safe setup interaction

- Status: completed for the assigned PR 3 work unit; the persisted PR 3 task checkbox is visibly checked.
- Structured status consumed: authoritative `changeName: unified-project-setup-manager`, OpenSpec store, `applyState: ready`, repo-local root the repository root, allowed edit roots limited to that repository, and chained `stacked-to-main` delivery with PR 3 forecast 370 changed lines.
- Authentication: `gentle-ai sdd-attempt acquire` returned `state: proceed` for work unit `pr-3-immutable-setup-plan`; no settle command was run, as requested.
- Files changed: `bin/setup-manager.js`, `bin/setup-manager.test.js`, `bin/cli.js`, and `bin/cli.test.js`. No `setup-files.js` behavior changed.
- Implemented immutable recursively frozen plans with redacted provider entries, complete file/sidecar/ignore entries, SHA-256 in-memory plan IDs, safe snapshot hashing, executable/selection/reconciliation invalidation, and exclusion of trust/home file snapshots.
- Implemented one final confirmation boundary, stale-plan rejection before operations, dry-run no-prompt/no-write/no-spawn handling when explicit inputs are supplied, non-TTY safe exits, and CLI delegation for bare setup, the compatibility alias, and independent `--dry-run`.
- Runtime harness: N/A; tests use injected plans, snapshots, prompts, and operation seams, with no client/provider process, credential flow, commit, push, or publishing.
- Verification: `npm test -- --runInBand bin/setup-manager.test.js bin/cli.test.js` — PASS, 2 suites / 57 tests; `npm test` — PASS, 27 suites / 325 tests; `npm run build` — PASS (`tsc`, exit 0); `git diff --check` — PASS.
- Workload / PR boundary: PR 3 only; the working diff is 443 additions and 13 deletions (456 changed lines), exceeding the 400-line authenticated cap despite the 370-line forecast. This is reported honestly as a `size:exception` recommendation; no exception was inferred or authorized.
- Deviations: direct programmatic `setupCommand` calls without a manager/plan remain legacy-compatible, while CLI `setup` dispatch always injects the unified manager. Client-specific discovery and mutation remain blocked for later PRs.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 3 immutable plans | `bin/setup-manager.test.js` | Unit | 15/15 focused baseline | Import failed because plan exports were absent | 19/19 focused after implementation | Redaction, frozen state, plan-ID changes for selections/decisions/files/executable, trust-file exclusion, and stale snapshots | Snapshot filtering and root/executable identity checks retained green tests |
| PR 3 CLI interaction | `bin/cli.test.js` | Unit | 35/35 existing CLI baseline | New alias/dry-run tests failed before delegation and independent flag support | 38/38 focused after delegation | Bare/alias/independent dry-run dispatch and explicit dry-run no prompts/writes/spawns | Preserved hardened command runner and legacy direct-call compatibility |

## PR 3 safety remediation

- Status: completed for the assigned `pr-3-safety-remediation` work unit; the PR 3 implementation checkbox is visibly checked in `tasks.md` after all evidence passed.
- Structured status consumed: authoritative OpenSpec store, change `unified-project-setup-manager`, repo-local action context rooted at the repository root, and allowed edits limited to the repository and named PR 3 artifacts.- Routing: saved `openai-codex/gpt-5.6-terra` configuration was preserved.
- Authentication: the supplied `gentle-ai sdd-attempt acquire` returned `state: proceed`; its settle obligation was intentionally not settled, per instruction.
- Reconciled the existing timed-out PR 3 partial diff in place; no files were discarded blindly, and no client/provider command, credential flow, commit, push, PR, or publishing call was made.
- Safety fixes: interactive setup now requires both stdin and stdout TTYs unless explicit confirmation is supplied; snapshot drift rebuilds through the fresh-plan seam, renders the new plan, and requests fresh confirmation; setup-command wiring refreshes provider/file snapshots; client argv, before/after values, arbitrary operation output, and error stdout/stderr are redacted before plan/report exposure.
- Files changed in this remediation: `bin/setup-manager.js`, `bin/setup-manager.test.js`, and this cumulative progress artifact. Existing PR 3 changes in `bin/cli.js` and `bin/cli.test.js` were retained and reconciled, not broadened.

### TDD Cycle Evidence

| Task | Test File | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| PR 3 TTY, drift, and redaction safety | `bin/setup-manager.test.js` | Focused run failed on stdout-only TTY handling and incomplete drift/redaction regression setup | Focused manager/CLI run passed: 2 suites, 63 tests | Covered both non-TTY streams, pre-confirmation and pre-operation replanning, fresh render/confirmation, argv/before/after/output redaction, and error stdout/stderr redaction | Centralized fresh-plan creation for setup-command retries and retained hardened command boundaries |

### Verification evidence

- `npm test -- --runInBand bin/setup-manager.test.js bin/cli.test.js` — PASS, 2 suites / 63 tests.
- `npm test` — PASS, 27 suites / 330 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- No real runtime harness, client/provider invocation, credential call, or publishing action was used.

### Workload and delivery boundary

- PR 3 remains the sole delivery boundary, with the previously authorized 456-line `size:exception`; no new functional area was added.
- The current tracked source/test diff is 668 additions and 13 deletions, or 681 changed lines before OpenSpec metadata, because the reconciled partial PR 3 diff includes its existing implementation and regression tests; this does not expand scope beyond the authorized PR 3 safety remediation.
- At that time, remaining implementation work was PRs 4–9 only; this record is superseded for PR 4 by the completion entry below.

## Remaining tasks — exact unchecked persisted rows

- [x] **RED:** add fixture-driven Claude cases for owned/matching/foreign/unknown classifications, explicit adopt/replace decisions, unavailable or ambiguous inspection, unsafe conventional `.mcp.json`, and tracked-config blocking. **GREEN:** add `ClaudeAdapter` with only project-scope add/remove argv, semantic post-command verification, and target-before-sidecar ordering. **TRIANGULATE:** prove no marketplace/plugin/`AGENTS.md` argv or ownership, exact shell-free semantic operation rendering when byte diffs are unavailable, and bounded redacted child environment/output. **REFACTOR:** share only narrow adapter result interfaces. **Docs:** update only the allowed Claude sections to state project MCP ownership and manual marketplace/plugin responsibility. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add Codex tests for per-run trust-precondition acknowledgement, blocked-but-independent outcomes, exact append/update/delete/replacement diffs, and conservative target rejection. **GREEN:** implement project-only `.codex/config.toml` range inspection/editing for `[mcp_servers.ticket-analyzer]` and its `.env` subtable through atomic source-snapshot checks. **TRIANGULATE:** cover comments, CRLF, foreign-byte preservation, tracked-file diffs, duplicate/array/malformed/unterminated target safe exits, and targeted-entry-only replacement loss. Assert no `$HOME`, `$CODEX_HOME`, home config, trust reader/snapshot, Codex subprocess, or trust mutation exists. **REFACTOR:** keep the acknowledgement unpersisted and separate from TOML facts. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add adapter/manager tests for owned/matching/foreign/unknown Codex outcomes, explicit adoption/replacement, plan invalidation before execution, and sidecar update only after verified target success. **GREEN:** wire the PR 5 editor into `CodexAdapter` operations and blocked manual recovery. **TRIANGULATE:** verify exact planned diffs remain required for tracked config, acknowledgement absence performs no mutation, and independent provider/Claude operations remain available. **REFACTOR:** avoid widening the project-file-only Codex authority. **Docs:** update only the allowed Codex guides to require user-established trust and preserve manual `AGENTS.md` responsibility. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add fixture cases for strict project-local `.pi/settings.json` schema acceptance and absent/matching/foreign/owned/unknown classification with sidecar agreement. **GREEN:** implement `PiSettingsInspector`/`PiAdapter` that inspect only the project file and gate exact local install/remove argv on a version-pinned safe action contract. **TRIANGULATE:** reject JSONC, duplicate keys, aliases, malformed/unsupported layouts, duplicate targets, stale state, tracked settings lacking an exact-preservation contract, `pi list`, global state, and filesystem package actions; prove matching adoption does not rewrite settings and blocked/manual recovery is non-mutating. **REFACTOR:** isolate schema/action allowlists from general JSON handling. **Docs:** update `docs/pi-install.md` with the project-local/manual-recovery boundary. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** add manager-seam and CLI regressions for fixed provider → ignore-rule → `claude` → `codex` → `pi` ordering, per-operation rediscovery, stale-plan invalidation, first failure, and bare/alias dispatch. **GREEN:** finish `executePlan` orchestration and delegate `setupCommand` while retaining hardened executable/runner interfaces. **TRIANGULATE:** assert completed/failed/unattempted and known remaining state, no automatic rollback, no secret output, blocked-client independence, client target-before-state removal, and truthful state-write failure reporting. **REFACTOR:** centralize redaction/result formatting and remove only the legacy credential-first/per-client-confirmation path. **Docs:** update allowed generic guidance for bare setup, alias, dry-run, one confirmation, explicit deletion, safe exits, and recovery. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.
- [ ] **RED:** update focused failing assertions for Pi's absolute `<ctx.cwd>/.env` fallback and the credential-free `ticket-analyzer` static template. **GREEN:** implement the extension fallback only when Pi has not supplied `TICKET_ANALYZER_ENV_FILE`, and migrate `.mcp.json`/release assertions to the published command/key without an `env` object. **TRIANGULATE:** prove an existing Pi env-file binding wins, fallback is absolute, no provider credential is forwarded, and the template contains no credential or consumer-specific path. **REFACTOR:** keep extension environment construction independent from setup-manager state. **Verify:** `npm test -- extensions/ticket-analyzer.test.js src/release.test.ts`; then `npm test`; then `npm run build`.

## PR 4 — Claude project-MCP reconciliation and guidance

- Status: completed for the assigned `pr-4-claude-reconciliation` work unit; the persisted PR 4 implementation checkbox is visibly checked.
- Authentication: `gentle-ai sdd-attempt acquire` request `fe4c610e-f6a9-4191-9061-8c50e6adc879` returned `state: proceed`; no settle command was run as instructed.
- Files changed: `bin/setup-adapters.js`, `bin/setup-manager.test.js`, `README.md` (Claude sections only), `docs/agent-workflow.md` (Claude section only), plus this task/progress artifact. `bin/setup-manager.js` and `bin/cli.test.js` were intentionally not changed.
- Implemented fixture-pinned Claude project-MCP discovery for owned, matching, foreign, unavailable, ambiguous, unsafe, and tracked states; unowned matching/foreign targets require explicit `adopt`/`replace`; only project-scope add/remove argv are constructed; semantic post-command verification precedes sidecar persistence; and child commands receive a bounded, allowlisted, redacted environment with `shell: false`.
- Scope protection: the adapter has no marketplace, plugin, or `AGENTS.md` mutation/ownership path. No real client, provider, credential, commit, push, PR, or publishing action was run.
- Verification: focused `npm test -- --runInBand bin/setup-manager.test.js` — PASS, 1 suite / 30 tests; focused `npm test -- --runInBand bin/setup-manager.test.js bin/cli.test.js` — PASS, 2 suites / 68 tests; full `npm test` — PASS, 27 suites / 336 tests; `npm run build` — PASS (`tsc` exit 0); `git diff --check` and the new-file no-index diff check — PASS.
- Workload / PR boundary: PR 4 only, stacked-to-main from merged PR 3 (`7626eed`). Source/test/docs diff is 187 additions and 1 deletion, or 188 changed lines, before untracked OpenSpec artifacts; it is below both the 390 forecast and 400-line cap. No deviation from the design.
- Remaining tasks: PRs 5–9 remain unchecked; their exact `- [ ]` rows remain above in this cumulative progress artifact and in the persisted `tasks.md` artifact.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 4 Claude adapter | `bin/setup-manager.test.js` | Unit | 63 focused tests passed | Missing `setup-adapters.js` caused the focused import to fail | 28 focused tests passed after the minimal adapter | Added unavailable, ambiguous, unsafe, tracked, foreign, owned, removal, post-verification, output-redaction, and sidecar-order cases; 30 passed | Extracted narrow facts, fixture parsing, child-environment, and rendering helpers; focused tests remained green |


### PR 4 final ordering refinement

- Added the final RED regression for sidecar-rule ordering: state-creating Claude operations establish the exact ignore prerequisite before the target command and write ownership only after semantic post-command verification; removal performs target removal before sidecar deletion and does not alter the ignore rule.
- The new RED focused run failed in exactly those two order assertions; GREEN moved the ignore prerequisite ahead of add/replace/adopt and omitted it for removal; the focused manager/CLI suite, full suite, build, and diff checks then passed again.
- Final verification remains `npm test -- --runInBand bin/setup-manager.test.js bin/cli.test.js` — PASS, 2 suites / 68 tests; `npm test` — PASS, 27 suites / 336 tests; `npm run build` — PASS; `git diff --check` and no-index new-file diff check — PASS.

## PR 4 — Claude wiring remediation

- Status: completed for the authenticated `pr-4-claude-wiring-remediation` correction work unit; the persisted PR 4 implementation row remains visibly checked in `tasks.md`.
- Authentication: `gentle-ai sdd-attempt acquire` request `738b55b9-f300-40da-8e12-64e4384bd8ba` returned `state: proceed`. No settle command was run.
- Reconciled the existing PR 4 adapter/docs partial diff: the setup manager now discovers Claude through the adapter, renders actionable Claude operations, and supplies those operations to the confirmed-plan execution path. A fixture-pinned `null` inspection result is classified as absent and produces the project-scope add operation.
- Replaced obsolete CLI test expectations for marketplace/plugin commands with unified-manager delegation assertions. Current setup-manager, adapter, and CLI tests contain no marketplace or plugin command vectors; documentation retains those actions and `AGENTS.md` as manual-only boundaries.
- Files changed: `bin/setup-adapters.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js`, `bin/cli.test.js`, `README.md` (Claude sections only), and `docs/agent-workflow.md` (Claude section only), plus this cumulative progress artifact. No real Claude, provider, credential, commit, push, PR, or publishing operation ran.
- Verification: `npm test -- --runInBand bin/setup-manager.test.js bin/cli.test.js` — PASS, 2 suites / 71 tests; `npm test` — PASS, 27 suites / 338 tests; `npm run build` — PASS; `git diff --check` — PASS.
- Workload / PR boundary: PR 4 remediation only, stacked-to-main from `7626eed`; current source/test/docs diff is 308 additions + 74 deletions = 382 changed lines, excluding OpenSpec artifacts, within the 400-line cap. No design deviation.
- Remaining tasks: PRs 5–9 remain unchecked; their exact persisted `- [ ]` rows are retained in the earlier **Remaining tasks — exact unchecked persisted rows** section and in `tasks.md`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 4 Claude wiring remediation | `bin/setup-manager.test.js`, `bin/cli.test.js` | Unit | 68 focused tests passed | Importing the newly required manager wiring export failed before implementation | 32 manager tests passed after wiring and absent-fixture support | Added the concrete dry-run fixture path; 33 manager tests passed without a mutation | Kept client planning internal and removed obsolete marketplace/plugin CLI expectations; focused manager/CLI suite remained green |

## PR 4 — Review-budget split into PR 4a and PR 4b

- Trigger: the accumulated PR 4 work unit was uncommitted on `main` and measured 441 additions + 109 deletions = 550 changed lines against `7626eed`, above the 400-line budget and above the 382 recorded in the preceding remediation entry. The earlier count did not include the 148 untracked lines of `bin/setup-adapters.js`.
- One honest slicing pass produced two cohesive units that both fit the budget, mirroring the Codex primitive/wiring boundary already planned for PRs 5 and 6. No code was compressed, and no comment, blank line, doc, or test was removed to fit.
- Snapshot safety: the full pre-split state is preserved on branch `wip/pr4-claude-full` at `7f7ccfe`. Its whitespace-insensitive diff against the final split contains only the relocation of the two wiring tests into their own describe block.

```text
PR 1 → PR 2 → PR 3 → 📍 PR 4a → PR 4b → PR 5 → PR 6 → PR 7 → PR 8 → PR 9
```

### PR 4a — Claude project MCP reconciliation adapter

- Branch `feat/setup-claude-adapter` at `2c825f3`, based on `main` (`7626eed`). Files: `bin/setup-adapters.js` (new) and the seven adapter-only cases in `bin/setup-manager.test.js`.
- Boundary: fixture-pinned discovery/classification, project-scope add/remove argv construction, explicit adopt/replace gating, post-command semantic verification, and bounded redacted child handling. No manager or CLI wiring, no docs.
- Independently green without any wiring: `npm test -- --runInBand bin/setup-manager.test.js` — PASS, 1 suite / 32 tests; `npm test` — PASS, 27 suites / 338 tests; `npm run build` — PASS.
- Review budget: 230 additions + 1 deletion = 231 changed lines.
- Rollback boundary: remove `bin/setup-adapters.js` and its seven tests; PRs 1–3 primitives are untouched.

### PR 4b — Claude reconciliation wiring and guidance

- Branch `feat/setup-claude-wiring`, stacked on PR 4a. Files: `bin/setup-manager.js`, `bin/cli.js`, `bin/cli.test.js`, `README.md` (Claude sections only), `docs/agent-workflow.md` (Claude section only), and the two `setupCommand` wiring cases in `bin/setup-manager.test.js`.
- Boundary: adapter discovery through the manager, plan rendering and execution supply, hardened CLI runner defaults, removal of the legacy marketplace/plugin client commands, and the Claude ownership statements in user guidance.
- Verification: `npm test -- --runInBand bin/setup-manager.test.js bin/cli.test.js` — PASS, 2 suites / 74 tests; `npm test` — PASS, 27 suites / 342 tests; `npm run build` — PASS; `git diff --check` — PASS.
- Review budget: 182 additions + 76 deletions = 258 changed lines.
- Rollback boundary: remove the wiring, CLI delegation, and Claude guidance edits; the PR 4a adapter remains usable on its own.
- Incidental cleanup inside this unit's own new lines: the misindented `bin/cli.test.js` and `bin/setup-manager.test.js` blocks left by the earlier timed-out reconciliation were realigned. Line counts are unaffected.
- No real Claude, provider, credential, commit-to-`main`, push, PR, or publishing action was performed.

## PR 5 — Codex project TOML safety primitive

- Status: completed for the assigned PR 5 work unit; the PR 5 implementation row is visibly checked in `tasks.md`.
- Branch `feat/setup-codex-toml`, stacked on `main` at `645b6b9` (PRs 4a/4b merged).
- Files changed: `bin/setup-files.js` and `bin/setup-manager.test.js` only. `bin/setup-adapters.js` and `bin/setup-manager.js` were intentionally untouched, since adapter wiring is PR 6.
- Review budget: 359 additions + 1 deletion = **360 changed lines**, within the 400-line cap and below the 390 forecast. No split was needed.

### Behavior

- `locateCodexEntry` finds the unique contiguous `[mcp_servers.ticket-analyzer]` table and its adjacent `.env` subtable, returning observed canonical facts. Trailing blank and comment lines are excluded from the range so they belong to the following section.
- `planCodexEntry` renders the exact unified diff plus the resulting bytes for `add`, `replace`, and `remove`, preserves the detected LF/CRLF convention and final-newline style, and reports `changed: false` when the target already matches the canonical fragment.
- `acknowledgeCodexTrust` is a per-run operator assertion. Without it the Codex operation is blocked and non-mutating with recovery guidance; it is never written to the sidecar.
- Safe exits, all non-mutating: duplicate target tables, arrays of tables, malformed headers anywhere in the file, unterminated or multiline values inside the target, unrecognized key layouts inside the target, a non-contiguous env subtable, an env subtable without its table, and a non-absolute managed env path.
- `CODEX_REPLACEMENT_LOSS_WARNING` states that a replacement rewrites the targeted entry from canonical form while preserving every byte outside it.

### Scope protection

- No `$HOME`, `$CODEX_HOME`, `os.homedir`, trust file, trust reader, trust snapshot, or Codex subprocess exists. A regression test asserts this against the `bin/setup-files.js` source text.
- No adapter wiring, plan integration, execution orchestration, or Codex documentation. Those are PRs 6 and 8.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 5 Codex TOML editor | `bin/setup-manager.test.js` | Unit | 44 focused tests passed on `main` | Suite failed to run: `setup-files.js` provided no `CODEX_RELATIVE_CONFIG_PATH` export | 50 focused tests passed after the range editor | Added comment/extra-key replacement, non-contiguous and orphan subtables, absent removal, non-absolute env path, no-final-newline append, and tracked-config diff. One genuine defect surfaced: removing a target that starts at line 1 left an orphan leading blank line, fixed by trimming leading blanks at that seam. 57 focused tests passed | Removed a dead seam variable and replaced the duplicated Codex literals in `validateClientRecord` with the new shared constants |

### Verification evidence

- `npm test -- --runInBand bin/setup-manager.test.js` — PASS, 1 suite / 57 tests.
- `npm test` — PASS, 27 suites / 365 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Runtime harness: N/A. The editor is pure text planning over injected content; no filesystem, client, provider, credential, or subprocess boundary was crossed.

### Rollback boundary

Remove the Codex constants, `locateCodexEntry`, `planCodexEntry`, `acknowledgeCodexTrust`, and their tests, and restore the inline Codex literals in `validateClientRecord`. PRs 1–4 behavior is untouched.

## Remaining tasks

PRs 6–9 remain unchecked; their exact `- [ ]` rows are preserved in `tasks.md`.

## PR 6 — Codex reconciliation wiring and guidance

- Status: completed for the assigned PR 6 work unit; the PR 6 implementation row is visibly checked in `tasks.md`.
- Branch `feat/setup-codex-wiring`, stacked on `main` at `a3ef20a` (PR 5 merged).
- Files changed: `bin/setup-adapters.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js`, `docs/codex-install.md`, `integrations/codex/README.md`. `bin/setup-files.js` was deliberately untouched, since it is not a PR 6 edit surface.
- Review budget: 297 additions + 7 deletions = **304 changed lines**, below the 380 forecast and the 400 cap.

### Behavior

- `CodexAdapter` reads only the project's own `.codex/config.toml` through an injected reader, classifies the entry as absent, matching, owned, foreign, or unknown, and reuses the PR 5 editor to carry the exact diff and resulting bytes on the operation.
- Trust is a per-run operator acknowledgement supplied by the caller. Without it every operation is blocked with `CODEX_TRUST_PRECONDITION` recovery and performs no mutation; other selected clients keep their own plan status.
- Matching entries require an explicit `adopt`, foreign entries an explicit `replace`; a replacement carries the targeted-entry loss warning.
- Execution re-reads the source and refuses when its bytes changed after planning, establishes the ignore prerequisite before a state-creating write, then writes, re-verifies canonical facts, and only then persists sidecar ownership. Removal writes the target before deleting sidecar state and does not touch the ignore rule.
- The manager builds the adapter for `codex`, threads `acknowledgements` through discovery and operation building, and supplies a root-validated, symlink-checked default config reader.

### Scope protection

- The adapter writes through an injected `writeConfig` seam because `bin/setup-files.js` is not a PR 6 edit surface; the real atomic writer is wired in PR 8.
- A regression test asserts the `CodexAdapter` source contains no `runCommand`, `resolveExecutable`, `spawn`, `CODEX_HOME`, `homedir`, or `trusted_projects`.
- Documentation updates are confined to the Codex guides and state user-established trust plus manual `AGENTS.md` responsibility.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 6 Codex wiring | `bin/setup-manager.test.js` | Unit | 57 focused tests passed on `main` | Suite failed to run: `setup-adapters.js` provided no `CodexAdapter` export | 66 of 67 passed after the adapter; the remaining manager-seam case proved `codex` was still unwired | Covered absent/matching/owned/foreign/unsafe classification, the trust gate, explicit adopt/replace, ordered execution, verification failure, post-planning drift, owned-only removal, and blocked-client independence | Reused the PR 5 planner rather than duplicating TOML handling, and kept the write seam injected so Codex authority stays project-file-only |

### Verification evidence

- `npm test -- --runInBand bin/setup-manager.test.js` — PASS, 1 suite / 67 tests.
- `npm test` — PASS, 27 suites / 375 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Runtime harness: N/A. Injected config reader/writer, ownership, and ignore seams cover the boundary; no real Codex process, provider call, or credential was involved.

### Rollback boundary

Remove `CodexAdapter`, `renderCodexOperation`, the manager's codex branch and acknowledgement threading, their tests, and the Codex guidance edits. The PR 5 editor stays available for blocked and manual handling, and PRs 1–4 behavior is untouched.

## Remaining tasks

PRs 7–9 remain unchecked; their exact `- [ ]` rows are preserved in `tasks.md`.

## PR 7 — Pi project-local inspection boundary and guidance

- Status: completed for the assigned PR 7 work unit; the PR 7 implementation row is visibly checked in `tasks.md`.
- Branch `feat/setup-pi-inspection`, stacked on `main` at `bf72743` (PR 6 merged).
- Review budget: 303 additions + 5 deletions = **308 changed lines**, below the 350 forecast and the 400 cap.

### Behavior

- `PiSettingsInspector` reads only `<root>/.pi/settings.json` through an injected bounded reader and accepts it only against a pinned, allowlisted schema. JSONC/comments, duplicate keys, an unsupported schema version, an unrecognized collection layout, an unexpected top-level key, a malformed entry, a name/specification alias, a duplicated target identity, and an oversized file are each an explicit unknown.
- `PiAdapter` classifies absent, matching, foreign, owned, and unknown, and gates every mutation on a version-pinned safe action contract. With no contract in this release, add, replace, and remove all resolve to blocked with `PI_MANUAL_RECOVERY` and expose no argv.
- Adopting a matching entry writes only the sidecar, after the ignore prerequisite, and never rewrites `.pi/settings.json`.
- A tracked settings file is unknown unless a contract proves preservation of every unrelated byte. A sidecar that disagrees with the project entry is unknown.
- When a contract is supplied, the exact shell-free local argv is `["install", "-l", "npm:ticket-analyzer-mcp@<version>"]` and `["remove", "-l", "npm:ticket-analyzer-mcp"]`.
- The manager builds the Pi adapter with a root-validated, symlink-checked default settings reader, matching how Claude and Codex were wired in their own slices.

### Deviation from the stated edit surfaces

`bin/setup-files.js` is not a PR 7 edit surface, but strict duplicate-key detection is required for `.pi/settings.json` and already exists there as the private `hasDuplicateJsonKeys`. The change is a one-word `export` on that existing function. The accepted alternative — reimplementing a JSON scanner inside `bin/setup-adapters.js` — would have duplicated roughly fifty lines of security-relevant parsing. Recorded here rather than taken silently.

### Test-quality fix carried in this slice

The PR 6 Codex source-boundary assertion sliced from `class CodexAdapter` to end of file, so it silently widened to whatever module code followed. Adding `PiAdapter`, which legitimately uses `runCommand`, made it fail. It now uses a `declarationSource` helper bounded to a single declaration, and the Pi assertion uses the same helper.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 7 Pi inspection | `bin/setup-manager.test.js` | Unit | 67 focused tests passed on `main` | Suite failed to run: `setup-adapters.js` provided no `PiAdapter` export | 81 of 82 passed; the failure was the over-broad PR 6 boundary assertion, not new behavior | Eight rejection fixtures, absent/matching/foreign/owned classification, manual-only add/replace/remove, adoption ordering, tracked blocking, stale sidecar, contract-gated argv, and the source boundary | Bounded the source assertions to single declarations and exported the existing JSON duplicate-key scanner instead of duplicating it |

### Verification evidence

- `npm test -- --runInBand bin/setup-manager.test.js` — PASS, 1 suite / 82 tests.
- `npm test` — PASS, 27 suites / 390 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Runtime harness: N/A. Injected settings reader, ownership, and ignore seams cover the boundary; no real Pi process, package manager, provider call, or credential was involved.

### Rollback boundary

Remove `PiSettingsInspector`, `PiAdapter`, the manager's pi branch and settings reader, their tests, and the `docs/pi-install.md` edits, and restore `hasDuplicateJsonKeys` to a private function. PRs 1–6 behavior is untouched.

## PR 8a — Ordered execution and truthful result reporting

### Size re-forecast and split

The original PR 8 bundled ordered execution, CLI delegation, legacy-path removal, and three documentation surfaces behind a 390-line forecast. Re-forecasting against merged `main` showed the CLI legacy path alone (`CLIENT_COMMANDS`, `configureSelectedClients`, and their tests) is roughly the size of the execution work. The slice was split at the boundary between manager behavior and the CLI/guidance interface rather than compressing either side to fit the budget.

### Behavior delivered

- A confirmed plan executes in one fixed order — provider `.env`, ignore rule, then `claude`, `codex`, `pi` — regardless of the order the user selected the clients in.
- The provider stage now writes through the real atomic writer, and the ignore-rule and ownership stages bind `writeSidecarIgnoreRule` and `writeOwnershipState`.
- A stopped run states what the project now carries: completed stages, the failed stage with its redacted reason, the unattempted stages, and that nothing is rolled back.

### Two defects found and fixed along the way

- The default `current()` snapshot omitted `clientDiscovery`, which the plan always carries. Every real run that selected a client therefore compared four snapshot keys against three, exhausted its replan budget, and exited as permanently stale. Rediscovering the clients inside `current()` is both the fix and the per-operation rediscovery the slice calls for.
- Each provider edited the original `.env` bytes rather than the previous provider's result, so a multi-provider run would have written only the last provider's edit. Provider edits are now chained through the atomic preparation.

### Deviation from the stated edit surfaces

`bin/setup-files.js` is not a PR 8a edit surface. Binding the real writer for the provider `.env` needs the general atomic writer that already exists there as the private `atomicTextWrite`; the change is a one-word `export`. The alternative was a second atomic write implementation in the manager, beside the security-reviewed one. Recorded here rather than taken silently.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 8a ordered execution | `bin/setup-manager.test.js` | Unit | 82 focused tests passed on `main` | Suite failed to run: `setup-manager.js` provided no `CLIENT_EXECUTION_ORDER` export | 7 new tests passed after ordering the stages, binding the writers, and fixing the stale-snapshot defect | Fixed order under reversed selection, atomic env bytes with a non-enumerable payload, first-failure stop with no rollback, secret redaction in the failure report, truthful partial state when only the ownership write fails, and blocked-client independence | Extracted `renderRemainingState` so every stopped status reports the same shape, and `discoverClients` so planning and rediscovery cannot drift |

### Verification evidence

- `npm test -- --runInBand bin/setup-manager.test.js` — PASS, 1 suite / 89 tests.
- `npm test` — PASS, 27 suites / 397 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Measured size: 210 additions + 33 deletions = 243 changed lines, against a 245-line forecast.
- Runtime harness: N/A. Injected filesystem, writer, adapter, and ownership seams cover the boundary; no real client process, provider call, or credential was involved.

### Rollback boundary

Remove `CLIENT_EXECUTION_ORDER`, `orderSetupOperations`, the bound writer defaults, the rediscovering `current()`, `renderRemainingState`, and their tests, and restore `atomicTextWrite` to a private function. Adapter discovery and planning primitives from PRs 1–7 are untouched.

## PR 8b — Runner hardening asserted at its own boundary

### Why this slice exists

Measuring the legacy CLI path before writing any code showed 160 lines of code and roughly 330 lines of tests. Five of those tests assert child-process hardening — `shell: false`, the environment allowlist, redaction, the timeout, and bounded output — but reach it through the per-client confirmation path that later slices delete. Deleting that path together with its tests would have quietly removed security coverage rather than moving it. The safety net is therefore anchored at the `runCommand` boundary first, in a slice that changes no production code at all.

The remaining PR 8 work was re-split into 8b (this slice), 8c (remove the per-client-confirmation path), 8d (delegate every entry point and remove the credential-first path), and 8e (generic guidance). The original single slice measured about 490 deletions.

### Behavior delivered

No production behavior changed. Three guarantees are now asserted directly against `runCommand`: the env-file path travels in argv while the child environment stays restricted to the allowlist, an over-running child is killed and the reported bound is truthful, and provider values in child failures are redacted.

### Mutation evidence

Because this slice adds no production code, its value is only as good as its ability to fail. Each guarantee was verified by mutating the corresponding production behavior and confirming the new test caught it.

| Mutation in `bin/cli.js` | Result |
|---|---|
| `deriveClientEnvironment(...)` replaced by the raw environment | 2 failed |
| `new Error(redactSecretLikeValues(message, secretValues))` replaced by `new Error(message)` | 1 failed |
| `child.kill?.()` removed from the timeout path | 2 failed |

`bin/cli.js` was restored after each mutation; the committed diff touches `bin/cli.test.js` only.

### Verification evidence

- `npm test -- --runInBand bin/cli.test.js` — PASS, 1 suite / 43 tests.
- `npm test` — PASS, 27 suites / 393 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Measured size: 62 additions + 0 deletions = 62 changed lines.
- Runtime harness: N/A. Injected `spawnProcess` seams cover the boundary; no real client process or credential was involved.

### Rollback boundary

Delete the three added tests. No production file is touched.

## PR 8c — Remove the per-client-confirmation path

### Behavior delivered

Requesting client configuration no longer prompts or executes per client. `configureSelectedClients` is gone, along with the `CLIENT_EXECUTABLES`, `CLIENT_RESTART_GUIDANCE`, and `CLIENT_COMMANDS` tables and the `readableArg`/`readableCommand`/`secretValuesFrom` helpers that only it used. The design's single whole-plan confirmation is now the only confirmation in the codebase.

`--configure-clients` remains an accepted argument. It is a compatibility alias that no longer changes dispatch, so scripted callers do not break.

### Coverage moved, not dropped

Six tests died with the path. Three of them asserted runner hardening that PR 8b had already re-anchored on `runCommand`: the env-file path travelling in argv without child-environment leakage, the timeout kill, and redaction of provider values in child failures. Two asserted output that only `configureSelectedClients` produced — the availability plan and its restart guidance. One, `continues after a client failure and returns nonzero`, asserted behavior the unified manager deliberately reverses: the manager stops at the first failure instead of continuing, which PR 8a already covers.

### Size note

The measured removal is larger than the 230-line forecast. Four client tables and three formatting helpers turned out to be reachable only from the deleted path, and the six tests were longer than estimated. At 313 changed lines the slice still sits inside the 400-line budget, so it was not re-split.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 8c per-client removal | `bin/cli.test.js` | Unit | 43 CLI tests passed on `main`, including the PR 8b runner boundary | New test failed: `confirmClient` and `runCommand` were each called twice | Removing the path left the next-steps output and the new assertion green | `--configure-clients` still parses and dispatches, and the Claude marketplace guidance stays manual | Removed the client tables and formatting helpers that only the deleted path reached |

### Verification evidence

- `npm test -- --runInBand bin/cli.test.js` — PASS, 1 suite / 38 tests.
- `npm test` — PASS, 27 suites / 388 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Measured size: 11 additions + 302 deletions = 313 changed lines.
- Runtime harness: N/A. No client process, provider call, or credential was involved.

### Rollback boundary

Restore `configureSelectedClients`, the three client tables, the formatting helpers, and the six removed tests. The manager, the adapters, and the PR 8b runner assertions are untouched.

## PR 8d — Delegate every entry point and remove the credential-first path

### Behavior delivered

`setupCommand` now delegates unconditionally: `(options.setupManager ?? runSetupManager)(options)`. There is no branch left that prompts for credentials before planning. `legacySetupCommand` is gone, along with `PROVIDER_GUIDANCE`, `updateEnvContent`, `readExistingEnv`'s legacy writers, `parseProviders`, `parseClients`, `askRequired`, `shellQuote`, `CLIENT_LABELS`, and three now-unused `node:fs/promises` imports.

### Two gaps closed rather than inherited

Delegating exposed two things the manager could not do on its own:

- **Interactive setup had no prompts.** The manager falls back to `options.promptAdapter ?? {}`, and the CLI never supplied one, so a real `ticket-analyzer-mcp setup` would have reached the non-TTY guard or produced empty selections. `runCli` now builds the adapter when stdin is a TTY. `createPromptAdapter` also exposed `confirmClient`, which nothing calls anymore; it now exposes the `confirm` the manager actually asks for.
- **The missing-provider summary would have died with the legacy path.** The manager reports the plan it applied, not what the project still lacks. `reportSetupCompleteness` survives in the delegating wrapper and runs after a successful setup, with its coverage rewritten against the delegated path.

### Forced change outside the stated surfaces

`src/release.test.ts` pinned two strings that existed only inside the removed guidance: `pi install -l npm:ticket-analyzer-mcp@2.3.1` and `const serverCommand = "ticket-analyzer-mcp"` in `bin/cli.js`, plus the Claude marketplace commands. The guard's intent — shipped guidance must use published npm and marketplace commands, never local paths — still holds, so its anchors were retargeted to the files that now own those strings: `skills/setup/SKILL.md` for the user-facing commands, `bin/setup-adapters.js` for `PI_PACKAGE_NAME`, and `bin/setup-files.js` for `CODEX_COMMAND`. The negative assertions against `bin/cli.js` are unchanged.

### Size overrun

Measured 548 changed lines against a 350-line forecast. Delegation makes the credential-first path unreachable, so its code, its helpers, and its tests have to leave in the same commit; splitting them would land unreachable, untested code in an intermediate state, which is worse to review than a deletion-heavy diff. 439 of the 548 lines are deletions of one named path. The overrun is recorded rather than resolved by compressing code or by a split that damages review.

### Coverage accounting for the eleven removed tests

Non-TTY refusal is replaced by a test asserting the manager refuses without throwing. Byte preservation and mode 0600 are covered by `editProviderEnv` and `atomicTextWrite` in `bin/setup-manager.test.js`. The published-package guidance is covered by the retargeted release guard. The two completeness tests were rewritten against the delegated path. The remaining next-steps and per-client tests asserted output that no longer exists.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 8d delegation | `bin/cli.test.js` | Unit | 38 CLI tests and 388 total passed on `main` | Non-TTY test failed: the promise rejected instead of resolving to 1 | Unconditional delegation left 11 legacy tests failing, each accounted for above | Missing-provider reporting through the delegated path, silence when a provider is configured, and bare/alias/dry-run dispatch | Removed `legacySetupCommand`, the helpers only it reached, and three dead imports |

### Verification evidence

- `npm test -- --runInBand bin/cli.test.js` — PASS, 1 suite / 31 tests.
- `npm test` — PASS, 27 suites / 388 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Measured size: 109 additions + 439 deletions = 548 changed lines.
- Runtime harness: N/A. No client process, provider call, or credential was involved.

### Rollback boundary

Restore `legacySetupCommand`, its dispatch branch, the helpers it alone reached, the eleven removed tests, and the previous release-guard anchors.

## PR 8e — Unified setup guidance

### What the guidance said versus what the code does

The shipped guidance still described the pre-manager flow, and several of its claims had become false rather than merely stale:

- "asks for one confirmation per selected available client" — the manager asks once for the whole plan.
- "the legacy `ticket-analyzer-mcp setup` remains credential-only and never detects or configures clients" — there is no legacy path left; bare `setup` is the unified flow.
- "`--dry-run` may write `.env` when providers are selected" — dry-run returns before executing anything and writes nothing.
- "the wizard does not inspect, replace, or remove existing client registrations" — inspection and classification are the first thing it does, and replacement is available with an explicit decision.
- "does not modify client configuration unless `--configure-clients` is explicitly requested" — the flag is now an inert compatibility alias.

### Behavior documented

Each of the three surfaces now states the single whole-plan confirmation, the fixed execution order, the inert alias, the write-free dry-run, the owned/matching/foreign/absent/unknown classification with explicit decisions for adoption, replacement, and removal, unknown as a stop rather than a licence to act, and the absence of automatic rollback with a truthful completed/failed/unattempted report. `skills/setup/SKILL.md` also names the three boundaries that stay manual by design: Codex project trust, Pi's missing version-pinned action contract, and Claude marketplace/plugin actions.

### Forced change outside the stated surfaces

Two `src/release.test.ts` guards pinned the old headings and, worse, asserted two of the now-false claims verbatim — `may write \`.env\` when providers are selected` and `does not inspect, replace, or remove existing registrations`. Leaving them would have made the release guard enforce documentation that contradicts the code. They were retargeted to the new headings and split so the bilingual structure and the safety boundaries are checked separately, with a third guard preserving the ordering check.

### Verification evidence

- `npm test` — PASS, 27 suites / 389 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Measured size: 75 additions + 40 deletions = 115 changed lines, against a 150-line forecast.
- Runtime harness: N/A. Documentation only; no application code changed.

### Rollback boundary

Restore the previous generic guidance and the two original release guards. No application code is touched.

## PR 9 — Pi runtime and credential-free static-template migration

### Behavior delivered

`getTicketEnvironment` used to copy nine provider variables — including `TRELLO_TOKEN`, `JIRA_API_TOKEN`, and `AZURE_DEVOPS_PAT` — from the Pi process environment into the MCP child. It now hands the child exactly one variable, the env-file binding, and nothing else. The child already resolves that path and loads its own credentials through `resolveEnvFile`/`readEnvFile` in `src/env.ts`, so the credentials never need to cross the process boundary.

When Pi supplies no binding, the extension falls back to `<ctx.cwd>/.env`, resolved to an absolute path. A binding Pi did supply always wins, and a relative one is resolved against `ctx.cwd` rather than passed through. With no known working directory the extension emits no binding at all instead of guessing a path.

### Deliberate behavior change worth stating

A Pi user who kept provider credentials only in their shell environment, never in a project `.env`, will now find the server unconfigured. That is the point of the slice: the runtime is credential-free by contract. The recovery is to put the values in the project `.env`, which is exactly what `ticket-analyzer-mcp setup` writes.

### Template migration

`.mcp.json` was already credential-free and already used the published command, so the migration was limited to renaming its server key from `pm` to `ticket-analyzer`, matching Codex's `mcp_servers.ticket-analyzer` table and Claude's `ticket-analyzer` registration id. The release guard was widened accordingly: it now pins the key set, asserts the absence of an `env` object rather than only scanning for credential-shaped text, rejects any consumer-specific home path, and separately asserts that `extensions/ticket-analyzer.js` names no provider variable.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| PR 9 Pi runtime | `extensions/ticket-analyzer.test.js` | Unit | 389 tests passed on `main` | 3 of 4 new assertions failed against the credential-forwarding contract | Reducing the contract to the env-file binding with a `cwd` fallback turned all four green | A supplied binding wins, a relative binding and cwd resolve to an absolute path, an unknown cwd emits nothing, and no provider value survives the boundary | Environment construction takes an explicit `{ source, cwd }` and stays independent of setup-manager state |

### Verification evidence

- `npm test -- --runInBand extensions/ticket-analyzer.test.js` — PASS, 1 suite / 7 tests.
- `npm test` — PASS, 27 suites / 393 tests.
- `npm run build` — PASS, `tsc` exit code 0.
- `git diff --check` — PASS.
- Measured size: 54 additions + 33 deletions = 87 changed lines, against a 330-line forecast.
- Runtime harness: N/A. The transport is constructed from an injected environment; no real Pi session or provider call was involved.

### Rollback boundary

Restore `TICKET_ENV_VARS` and the copying form of `getTicketEnvironment`, the `pm` template key, and the previous release assertions. No setup-manager state or client reconciliation is touched.

## Remaining tasks

None. Every PR row in `tasks.md` is checked.
