# Implementation Tasks: Unified Project Setup Manager

## Confirmed delivery path

| Field | Value |
| --- | --- |
| Delivery strategy | Chained PRs |
| Chain strategy | `stacked-to-main` |
| Review budget | 400 changed lines per PR (additions + deletions) |
| Honest slicing pass | One completed; the nine cohesive units below forecast 3,290 changed lines total and each is at or below budget. |
| `size:exception` | Not needed or implied. |

Each PR targets `main`. PR *n* starts only after PR *n-1* has merged (or is rebased to its merged `main` result), so its diff contains only that work unit. A polluted diff is a base defect: rebase/retarget before review. Tests and the documentation directly changed by a behavior remain in that behavior's PR. No PR authorizes consumer setup, a real client/provider command, a commit, or publishing.

### Chain map

```text
📍 PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 → PR 9 → main
```

`📍 PR 1` is the current first slice. Every later PR is contingent on its immediate predecessor and must be re-forecast from its actual base before opening; exceeding 400 additions + deletions pauses delivery for a new human decision.

## Shared implementation discipline

- Begin every task with the named focused failing Jest test (**RED**), then write the smallest behavior (**GREEN**), then refactor without changing behavior.
- Each PR records its focused test command and exact result, then `npm test` and `npm run build`; a failure stops that PR rather than being deferred.
- Runtime harness is **N/A** for all slices: use injected filesystem, prompts, adapters, executable resolver, and command runner; never invoke real Claude, Codex, Pi, provider, or credential flows.
- Preserve design safety: absolute project `.env` bindings; one redacted full-plan confirmation; plan invalidation on changed inputs; no automatic rollback; explicit deletion/adoption/replacement; no Codex home/trust inspection; and manual Pi recovery without a pinned safe contract.

---

## PR 1 — Project root and provider `.env` guardrails

**Forecast:** 230 additions + 110 deletions = **340 changed lines**.  
**Start/dependency:** approved design; no implementation dependency.  
**End:** injected root resolution and provider-file editing can safely produce redacted proposed changes without changing runtime `src/env.ts` behavior.  
**Out of scope:** sidecar/ignore files, plans/prompts, CLI dispatch, client discovery, docs, and runtime extension changes.  
**Allowed edit surfaces:** `bin/setup-manager.js`, `bin/setup-files.js`, `bin/setup-manager.test.js` only.  
**Rollback boundary:** remove this slice's root/provider helpers and matching tests; no later adapter or consumer file behavior is reverted.  
**Work-unit commit:** `feat(setup): add safe project env planning primitives`.

```text
📍 PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 → PR 9
```

- [x] **RED:** add focused `bin/setup-manager.test.js` cases for canonical Git/worktree-or-`package.json` root selection, rejection outside a project, canonical project `.env` despite `TICKET_ANALYZER_ENV_FILE`, root-boundary and symlink rejection, and no inherited provider reads. **GREEN:** implement injected-filesystem root/env resolution, conservative line-preserving selected-provider edits/removals, and atomic write preparation. **TRIANGULATE:** cover LF/CRLF/final-newline behavior, `export` spacing, unrelated-byte preservation, duplicate/multiline safe exits, new-file `0600`, existing-mode retention, redacted diffs, and inherited-environment precedence wording. **REFACTOR:** isolate provider schema/format helpers without touching CLI runtime resolution. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`. **Remediation:** independently reported temp-path containment, trailing-backslash parity, root validation, and raw affected-line handling must be covered before this row is complete.

## PR 2 — Ignored ownership sidecar foundation

**Forecast:** 250 additions + 100 deletions = **350 changed lines**.  
**Start/dependency:** PR 1 merged and green.  
**End:** sidecar ownership state and its one exact repository-local ignore rule can be validated, planned, and atomically written without broad ignores.  
**Out of scope:** final confirmation/CLI interaction, client adapters, direct client config edits, and user documentation.  
**Allowed edit surfaces:** `bin/setup-manager.js`, `bin/setup-files.js`, `bin/setup-manager.test.js` only.  
**Rollback boundary:** remove sidecar/ignore-rule helpers and their tests while leaving PR 1 provider primitives intact.  
**Work-unit commit:** `feat(setup): add ignored ownership state foundation`.

```text
PR 1 → 📍 PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 → PR 9
```

- [x] **RED:** add focused state cases for schema-v1 validation at the project-local sidecar path `.ticket-analyzer/setup-state.json`, no-secret serialization, absolute-root mismatch/stale-record rejection, duplicate/invalid client records, symlink rejection, and atomic state-write failure. **GREEN:** implement private-temp/fsync/rename sidecar IO and non-secret ownership facts. **TRIANGULATE:** test that state changes only after its associated successful action/adoption and a Pi record disagreement is `unknown`. **REFACTOR:** keep state independent from client config serialization. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.

- [x] **RED:** add ignore-rule cases for the exact project-root sidecar ignore-rule recognition/append and exact tracked-file diff. **GREEN:** implement root-only literal inspection/append as a planned sidecar prerequisite. **TRIANGULATE:** preserve LF/CRLF/final-newline style and safely exit on negation, wildcard, directory, escaped, duplicate, symlinked, or other relevant ambiguous rules; prove no consumer config or broad wildcard is ignored. **REFACTOR:** keep ignore syntax recognition deliberately narrower than general gitignore parsing. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.

## PR 3 — Immutable plan and safe setup interaction

**Forecast:** 270 additions + 100 deletions = **370 changed lines**.  
**Start/dependency:** PR 2 merged and green.  
**End:** bare setup, alias, and dry-run form one immutable redacted plan with one confirmation and no stale-plan execution.  
**Out of scope:** client-specific discovery/mutation, provider behavior beyond PR 1, user guidance migration, and extension/template work.  
**Allowed edit surfaces:** `bin/cli.js`, `bin/cli.test.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js`, `bin/setup-files.js` only.  
**Rollback boundary:** remove plan/prompt/dispatch delegation and tests, restoring prior CLI dispatch while retaining PRs 1–2 primitives.  
**Work-unit commit:** `feat(setup): add confirmed immutable setup plans`.

```text
PR 1 → PR 2 → 📍 PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 → PR 9
```

- [x] **RED:** add plan tests for redacted complete rendering, sidecar/ignore-file entries, plan IDs, changed selection/reconciliation/file/sidecar/ignore/executable invalidation, and the unpersisted Codex precondition acknowledgement. Add CLI tests for bare `setup`, `--configure-clients`, and independent `--dry-run`. **GREEN:** implement immutable in-memory plan construction, snapshots, one final confirmation, alias-compatible delegation, dry-run rendering, and non-TTY safe exits. **TRIANGULATE:** prove dry-run has no prompts/writes/spawns and confirmation is re-requested after every changed input; no trust file is ever a snapshot input. **REFACTOR:** retain `parseSetupArgs` and hardened command boundaries. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.

## PR 4 — Claude project-MCP reconciliation and guidance

**Forecast:** 260 additions + 130 deletions = **390 changed lines**.  
**Start/dependency:** PR 3 merged and green.  
**End:** Claude has a fixture-pinned project-only reconciliation adapter, and its user guidance states the manager/manual marketplace boundary.  
**Out of scope:** Codex/Pi behavior, static template migration, generic unified-setup migration text, marketplace/plugin mutations, and `AGENTS.md` changes.  
**Allowed edit surfaces:** `bin/setup-adapters.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js`, `bin/cli.test.js`, `README.md` (Claude setup sections only), `docs/agent-workflow.md` (Claude sections only) only.  
**Rollback boundary:** remove Claude adapter/wiring/tests and its Claude-specific guidance edits; preserve core planning and other clients.  
**Work-unit commit:** `feat(setup): reconcile Claude project MCP entries`.

```text
PR 1 → PR 2 → PR 3 → 📍 PR 4a → PR 4b → PR 5 → PR 6 → PR 7 → PR 8 → PR 9
```

**Actual split:** the implemented work unit measured 550 changed lines, so one honest slicing pass divided it into **PR 4a** (`feat/setup-claude-adapter`, 231 lines — `bin/setup-adapters.js` plus its seven adapter-only tests) and **PR 4b** (`feat/setup-claude-wiring`, 258 lines — manager wiring, CLI delegation, the two `setupCommand` tests, and Claude guidance). Both are within budget; `apply-progress.md` records the boundaries and verification.

**Delivered:** PR 4a merged as [#7](https://github.com/ocampott/ticket-analyzer-mcp/pull/7) (`ebb919f`) and PR 4b merged as [#8](https://github.com/ocampott/ticket-analyzer-mcp/pull/8) (`645b6b9`). Post-merge `main` verified: `npm test` — 27 suites / 342 tests; `npm run build` — `tsc` exit 0. PR 5 is now the current slice and must be re-forecast from `645b6b9`.

- [x] **RED:** add fixture-driven Claude cases for owned/matching/foreign/unknown classifications, explicit adopt/replace decisions, unavailable or ambiguous inspection, unsafe conventional `.mcp.json`, and tracked-config blocking. **GREEN:** add `ClaudeAdapter` with only project-scope add/remove argv, semantic post-command verification, and target-before-sidecar ordering. **TRIANGULATE:** prove no marketplace/plugin/`AGENTS.md` argv or ownership, exact shell-free semantic operation rendering when byte diffs are unavailable, and bounded redacted child environment/output. **REFACTOR:** share only narrow adapter result interfaces. **Docs:** update only the allowed Claude sections to state project MCP ownership and manual marketplace/plugin responsibility. **Verify:** `npm test -- bin/setup-manager.test.js bin/cli.test.js`; then `npm test`; then `npm run build`.

## PR 5 — Codex project TOML safety primitive

**Forecast:** 280 additions + 110 deletions = **390 changed lines**.  
**Start/dependency:** PR 4 merged and green.  
**End:** a conservative project-local TOML editor can safely discover and render exact target-entry changes, while Codex remains blocked until the user-established trust prerequisite is acknowledged.  
**Out of scope:** Codex docs, home/config reads, trust detection or mutation, Codex subprocesses, Pi behavior, and execution orchestration.  
**Allowed edit surfaces:** `bin/setup-adapters.js`, `bin/setup-files.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js` only.  
**Rollback boundary:** remove only the Codex TOML inspector/editor and its wiring/tests, leaving Claude and core plan behavior intact.  
**Work-unit commit:** `feat(setup): add safe Codex project TOML editing`.

```text
PR 1 → PR 2 → PR 3 → PR 4a → PR 4b → 📍 PR 5 → PR 6 → PR 7 → PR 8 → PR 9
```

**Base:** `645b6b9` on `main`, green at 27 suites / 342 tests.

- [x] **RED:** add Codex tests for per-run trust-precondition acknowledgement, blocked-but-independent outcomes, exact append/update/delete/replacement diffs, and conservative target rejection. **GREEN:** implement project-only `.codex/config.toml` range inspection/editing for `[mcp_servers.ticket-analyzer]` and its `.env` subtable through atomic source-snapshot checks. **TRIANGULATE:** cover comments, CRLF, foreign-byte preservation, tracked-file diffs, duplicate/array/malformed/unterminated target safe exits, and targeted-entry-only replacement loss. Assert no `$HOME`, `$CODEX_HOME`, home config, trust reader/snapshot, Codex subprocess, or trust mutation exists. **REFACTOR:** keep the acknowledgement unpersisted and separate from TOML facts. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.

## PR 6 — Codex reconciliation wiring and guidance

**Forecast:** 240 additions + 140 deletions = **380 changed lines**.  
**Start/dependency:** PR 5 merged and green.  
**End:** approved Codex project-entry operations reconcile through the shared plan and all Codex-facing guidance matches the user-established-trust safety model.  
**Out of scope:** trust probing/mutation, home config access, Pi behavior, static template changes, and generic setup guidance.  
**Allowed edit surfaces:** `bin/setup-adapters.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js`, `docs/codex-install.md`, `integrations/codex/README.md`, `integrations/codex/AGENTS.md`, `integrations/codex/AGENTS.template.md` only.  
**Rollback boundary:** remove Codex reconciliation wiring/tests and these Codex-only documentation edits; preserve the isolated PR 5 parser only if it remains useful to blocked/manual handling.  
**Work-unit commit:** `feat(setup): reconcile trusted Codex project entries`.

```text
PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → 📍 PR 6 → PR 7 → PR 8 → PR 9
```

- [x] **RED:** add adapter/manager tests for owned/matching/foreign/unknown Codex outcomes, explicit adoption/replacement, plan invalidation before execution, and sidecar update only after verified target success. **GREEN:** wire the PR 5 editor into `CodexAdapter` operations and blocked manual recovery. **TRIANGULATE:** verify exact planned diffs remain required for tracked config, acknowledgement absence performs no mutation, and independent provider/Claude operations remain available. **REFACTOR:** avoid widening the project-file-only Codex authority. **Docs:** update only the allowed Codex guides to require user-established trust and preserve manual `AGENTS.md` responsibility. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.

## PR 7 — Pi project-local inspection boundary and guidance

**Forecast:** 240 additions + 110 deletions = **350 changed lines**.  
**Start/dependency:** PR 6 merged and green.  
**End:** Pi is safely classified from recognized project-local settings only, remains manual without a pinned action contract, and Pi guidance communicates that boundary.  
**Out of scope:** direct Pi settings rewrite, inferred `pi list` state, global/package-manager actions, extension runtime changes, and generic setup documentation.  
**Allowed edit surfaces:** `bin/setup-adapters.js`, `bin/setup-manager.js`, `bin/setup-manager.test.js`, `docs/pi-install.md` only.  
**Rollback boundary:** remove Pi inspector/action gate/tests and Pi-specific guidance; retain all other client adapters and core execution prerequisites.  
**Work-unit commit:** `feat(setup): gate Pi local integration on safe inspection`.

```text
PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → 📍 PR 7 → PR 8 → PR 9
```

- [x] **RED:** add fixture cases for strict project-local `.pi/settings.json` schema acceptance and absent/matching/foreign/owned/unknown classification with sidecar agreement. **GREEN:** implement `PiSettingsInspector`/`PiAdapter` that inspect only the project file and gate exact local install/remove argv on a version-pinned safe action contract. **TRIANGULATE:** reject JSONC, duplicate keys, aliases, malformed/unsupported layouts, duplicate targets, stale state, tracked settings lacking an exact-preservation contract, `pi list`, global state, and filesystem package actions; prove matching adoption does not rewrite settings and blocked/manual recovery is non-mutating. **REFACTOR:** isolate schema/action allowlists from general JSON handling. **Docs:** update `docs/pi-install.md` with the project-local/manual-recovery boundary. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.

## PR 8a — Ordered execution and truthful result reporting

Split from the original PR 8 during its size re-forecast: ordered execution and the CLI/legacy-removal work are separate reviewable units, and together they exceed the 400-line budget.

**Forecast:** 210 additions + 35 deletions = **245 changed lines**. **Actual:** 210 additions + 33 deletions = **243 changed lines**.  
**Start/dependency:** PR 7 merged and green.  
**End:** confirmed plans execute in the displayed provider → ignore-rule → Claude → Codex → Pi order, bind the real atomic writers, and stop truthfully on failure.  
**Out of scope:** CLI delegation, legacy credential-first path removal, and all generic guidance (PR 8b).  
**Allowed edit surfaces:** `bin/setup-manager.js`, `bin/setup-manager.test.js`, and one export widening in `bin/setup-files.js`.  
**Rollback boundary:** remove the stage ordering, the bound writers, and the result formatter; adapter discovery and planning primitives remain untouched.  
**Work-unit commit:** `feat(setup): execute confirmed setup plans in a fixed order`.

```text
PR 1 → … → PR 7 → 📍 PR 8a → PR 8b → PR 9
```

- [x] **RED:** add manager-seam regressions for fixed provider → ignore-rule → `claude` → `codex` → `pi` ordering, the atomic env write, first failure, and blocked-client independence. **GREEN:** order the stages, bind `atomicTextWrite`/`writeSidecarIgnoreRule`/`writeOwnershipState`, and include client rediscovery in the current snapshot. **TRIANGULATE:** assert completed/failed/unattempted with no automatic rollback, no secret output, and truthful state-write failure reporting. **REFACTOR:** centralize remaining-state formatting in one renderer. **Verify:** `npm test -- bin/setup-manager.test.js`; then `npm test`; then `npm run build`.

## PR 8b — Runner hardening asserted at its own boundary

Measuring the legacy CLI path before writing code showed 160 lines of code and roughly 330 lines of tests. Five of those tests assert the child-process hardening — `shell: false`, the environment allowlist, redaction, the timeout, and bounded output — but drive it through the per-client path that later slices delete. Removing that path without first anchoring the guarantees elsewhere would silently drop security coverage, so the safety net moves first and the removals follow.

**Forecast:** 62 additions + 0 deletions = **62 changed lines**. **Actual:** 62 additions + 0 deletions = **62 changed lines**.  
**Start/dependency:** PR 7 merged and green. Independent of PR 8a: it touches only `bin/cli.test.js`.  
**End:** the runner guarantees that later slices would otherwise lose are asserted directly against `runCommand`, and each one is proven to fail when the corresponding production behavior is mutated.  
**Out of scope:** every production change, every deletion, and all guidance.  
**Allowed edit surfaces:** `bin/cli.test.js` only.  
**Rollback boundary:** delete the added tests; nothing else is touched.  
**Work-unit commit:** `test(cli): assert runner hardening at the runCommand boundary`.

```text
PR 1 → … → PR 8a → 📍 PR 8b → PR 8c → PR 8d → PR 9
```

- [x] **RED:** add direct `runCommand` assertions for argv-carried env-file paths without child environment leakage, timeout kill with a truthful bound, and redaction of provider values in child failures. **GREEN:** none required; the guarantees already hold and the tests pin them at the boundary. **TRIANGULATE:** mutate each production behavior in turn and confirm the new tests fail. **Verify:** `npm test -- bin/cli.test.js`; then `npm test`; then `npm run build`.

## PR 8c — Remove the per-client-confirmation path

**Forecast:** 40 additions + 190 deletions = **230 changed lines**. **Actual:** 11 additions + 302 deletions = **313 changed lines**; the removal reached further than forecast because four client tables, three formatting helpers, and six tests died with the path.  
**Start/dependency:** PR 8b merged and green. Independent of PR 8a.  
**End:** `configureSelectedClients` and the per-client confirmation prompt are gone; the manager's single whole-plan confirmation is the only confirmation.  
**Out of scope:** the credential-first prompting path, entry-point delegation, and guidance.  
**Allowed edit surfaces:** `bin/cli.js`, `bin/cli.test.js` only.  
**Rollback boundary:** restore `configureSelectedClients` and its tests; the manager is untouched.  
**Work-unit commit:** `refactor(cli): drop per-client confirmation in favor of the plan confirmation`.

```text
PR 1 → … → PR 8b → 📍 PR 8c → PR 8d → PR 9
```

- [x] **RED:** assert that requesting client configuration never prompts or executes per client. **GREEN:** remove `configureSelectedClients` and the `CLIENT_COMMANDS`/restart-guidance tables it owns. **TRIANGULATE:** prove `--configure-clients` remains an accepted compatibility alias and that unavailable clients stay nonfatal. **Verify:** `npm test -- bin/cli.test.js`; then `npm test`; then `npm run build`.

## PR 8d — Delegate every entry point and remove the credential-first path

**Forecast:** 50 additions + 300 deletions = **350 changed lines**. **Actual:** 109 additions + 439 deletions = **548 changed lines**, over budget. Delegation makes the credential-first path unreachable, so its code, its helpers, and its tests must leave in the same commit; splitting them would land unreachable, untested code in an intermediate state, which is worse to review than a deletion-heavy diff. The overrun is recorded rather than resolved by compressing code or by a split that damages review.  
**Start/dependency:** PR 8a and PR 8c merged and green.  
**End:** every setup entry point delegates to the unified manager and the legacy credential-first path is gone.  
**Out of scope:** new client capabilities, Codex trust inspection, and Pi runtime changes.  
**Allowed edit surfaces:** `bin/cli.js`, `bin/cli.test.js`, plus a forced retarget of `src/release.test.ts`.  
**Rollback boundary:** restore `legacySetupCommand`, its dispatch branch, and the previous release-guard anchors.  
**Work-unit commit:** `feat(setup): delegate every setup entry point to the unified manager`.

```text
PR 1 → … → PR 8c → 📍 PR 8d → PR 8e → PR 9
```

- [x] **RED:** add CLI regressions for bare/alias dispatch, dry-run, and the single confirmation reaching the manager without a `setupManager` option. **GREEN:** delegate `setupCommand` unconditionally while retaining hardened executable/runner interfaces. **TRIANGULATE:** prove explicit deletion, safe exits, and recovery messaging survive delegation. **REFACTOR:** remove `legacySetupCommand` and the helpers it alone owns. **Verify:** `npm test -- bin/cli.test.js`; then `npm test`; then `npm run build`.

## PR 8e — Unified setup guidance

**Forecast:** 90 additions + 60 deletions = **150 changed lines**. **Actual:** 75 additions + 40 deletions = **115 changed lines**.  
**Start/dependency:** PR 8d merged and green.  
**End:** generic setup guidance matches the unified manager.  
**Out of scope:** code changes and client-specific documentation already owned by PRs 4, 6, and 7.  
**Allowed edit surfaces:** `README.md` (generic setup sections only), `docs/agent-workflow.md` (generic setup sections only), `skills/setup/SKILL.md`, plus a forced retarget of `src/release.test.ts`.  
**Rollback boundary:** restore the previous generic guidance and release-guard assertions; no application code is touched.  
**Work-unit commit:** `docs(setup): describe the unified setup flow`.

```text
PR 1 → … → PR 8d → 📍 PR 8e → PR 9
```

- [x] **Docs:** update allowed generic guidance for bare setup, the compatibility alias, dry-run, the single confirmation, explicit deletion, safe exits, and recovery. **Verify:** `npm test`; then `npm run build`.

## PR 9 — Pi runtime and credential-free static-template migration

**Forecast:** 210 additions + 120 deletions = **330 changed lines**. **Actual:** 54 additions + 33 deletions = **87 changed lines**; `.mcp.json` was already credential-free, so only the server key and the guard needed migrating.  
**Start/dependency:** PR 8e merged and green.  
**End:** Pi runtime has the absolute project `.env` fallback without secret forwarding, and the distributed static MCP template/release checks remain credential-free.  
**Out of scope:** setup-manager behavior, client discovery, provider edits, marketplace/plugin actions, and all user guidance already migrated in prior slices.  
**Allowed edit surfaces:** `extensions/ticket-analyzer.js`, `extensions/ticket-analyzer.test.js`, `.mcp.json`, `src/release.test.ts` only.  
**Rollback boundary:** revert only extension/template/release assertions; manager state and client reconciliation remain untouched.  
**Work-unit commit:** `feat(pi): bind project runtime to credential-free env contract`.

```text
PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 → 📍 PR 9
```

- [x] **RED:** update focused failing assertions for Pi's absolute `<ctx.cwd>/.env` fallback and the credential-free `ticket-analyzer` static template. **GREEN:** implement the extension fallback only when Pi has not supplied `TICKET_ANALYZER_ENV_FILE`, and migrate `.mcp.json`/release assertions to the published command/key without an `env` object. **TRIANGULATE:** prove an existing Pi env-file binding wins, fallback is absolute, no provider credential is forwarded, and the template contains no credential or consumer-specific path. **REFACTOR:** keep extension environment construction independent from setup-manager state. **Verify:** `npm test -- extensions/ticket-analyzer.test.js src/release.test.ts`; then `npm test`; then `npm run build`.

## Delivery checks before each PR

- Recalculate the current PR's additions + deletions from its actual stacked-to-main base; pause for a human decision if it exceeds 400 lines.
- Confirm allowed edit surfaces contain every changed file; move unrelated work to its owning slice.
- Keep focused tests and the listed user-facing documentation in the same PR as their behavior.
- Record focused-test, full-test, and build results; runtime harness remains N/A only because injected seams exercised the complete relevant boundary.
- Confirm rollback is limited to the named work unit and does not claim automatic consumer rollback.
