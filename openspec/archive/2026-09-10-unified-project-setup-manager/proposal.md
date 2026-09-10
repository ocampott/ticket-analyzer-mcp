# Proposal: Unified Project Setup Manager

## Intent

Turn `ticket-analyzer-mcp setup` into the single, project-scoped manager for shared provider credentials and supported client integrations. It will let a project safely discover, plan, add, adopt, replace, and remove its Claude MCP, Codex MCP, and Pi package registrations without managing global installations or unrelated client assets.

This proposal is limited to the product contract and implementation planning. It does not perform setup, read credentials, mutate client configuration, run client CLIs, publish, or commit.

## Problem

The current setup flow is additive and split across credential prompts, opt-in client commands, static templates, and manual documentation. It has no durable record of entries it owns, cannot safely reconcile existing registrations, and cannot remove or update a project integration without risking unrelated client state. Its behavior also differs across Claude, Codex, and Pi, while all three require the same project credentials.

## Scope

### In scope

- Make bare `ticket-analyzer-mcp setup` the unified interactive setup manager.
- Retain `--configure-clients` as a compatibility alias and retain `--dry-run` as plan-only mode.
- Manage only these project-level integrations:
  - Claude project-scope MCP registration.
  - Codex project `.codex/config.toml` MCP registration.
  - Pi project-local package installation/registration.
- Manage Trello, Jira, and Azure DevOps credential variables in `<project-root>/.env`.
- Discover existing managed, matching, and foreign registrations before proposing a change.
- Show a non-secret, complete plan and exact planned file/config changes before one explicit confirmation authorizes the entire plan.
- Support provider and client additions, updates, and removals with a durable local sidecar state that records manager-owned entries without storing credentials.
- Use absolute, non-secret `<project-root>/.env` paths in client registrations so client CWD cannot change the credential file selected.
- Preserve unrelated configuration content and make tracked client configuration mutable only after its exact proposed diff is shown and the full plan is confirmed.
- Migrate the static MCP template contract so project registrations are materialized by the manager with the absolute environment-file binding, while the distributed template remains credential-free.
- Define safe handling for unknown, malformed, untrusted, or otherwise non-actionable client configurations.
- Define partial-failure reporting and operator recovery guidance.

### Out of scope

- Installing, removing, or updating the global npm package.
- Claude marketplace or plugin installation/removal.
- Creating, merging, or removing `AGENTS.md` content.
- Changing Codex project trust or any trust/security setting.
- Removing credentials from inherited process environments or other non-project sources.
- Automatic rollback after a partial failure.
- Managing client integrations outside the active project.

## Proposed product behavior

### Project and environment contract

1. The manager resolves one project root and treats `<project-root>/.env` as the only writable credential target.
2. Provider mutations affect only the selected provider's known variables and preserve unrelated `.env` content, keys, formatting where practical, and file permissions.
3. Client registrations receive the absolute path to that `.env` through a non-secret environment-file setting. The plan must warn that a real process environment variable takes precedence over the file at runtime; deleting a `.env` value therefore does not guarantee the provider is inactive in an inherited environment.
4. The manager writes manager-owned local sidecar state for the registrations it creates, adopts, or replaces. That state contains no credentials and is used to distinguish manager-owned entries from foreign entries on later runs.

### Discovery, ownership, and reconciliation

1. Before any mutation, the manager discovers the applicable project registration and sidecar ownership state for each selected client.
2. A manager-owned registration may be updated or removed according to the confirmed plan.
3. A matching unowned registration and a foreign/conflicting registration must each be displayed with its relevant non-secret diff and require an explicit **adopt** or **replace** choice; the manager must not silently claim, overwrite, or delete either one.
4. Adopting records the accepted registration in manager state without needlessly rewriting unrelated client configuration. Replacing removes or changes only the targeted project entry after it is prominently listed as a removal/replacement in the full plan.
5. Unknown, malformed, unsupported, or unsafe-to-preserve configuration is a safe exit for that client: explain why no mutation will occur and prescribe manual recovery rather than guessing or normalizing the file.

### Client-specific boundaries

- **Claude:** Manage the project-scope MCP registration only. Marketplace/plugin distribution remains manual and never appears as manager-owned state.
- **Codex:** Manage the project MCP entry in `.codex/config.toml` only when Codex already considers the project trusted. If trust is absent, explain that constraint and stop the Codex mutation; never create or modify trust. Any other independently planned mutation remains governed by the displayed full plan.
- **Pi:** Manage the project-local package integration only. It must not alter global Pi/package state.

### Plan, confirmation, and dry-run

1. Every potentially mutating run produces a complete non-secret plan first. It prominently identifies additions, removals/replacements, affected files, client commands/config operations, provider-variable names, blocked clients, and any sidecar-state change.
2. For files the manager may change, the plan presents the exact proposed non-secret diff/change. Secret values are never echoed; credential changes are represented by provider and variable name with redacted values.
3. One explicit final confirmation authorizes exactly the displayed full plan, including all deletions. Any changed selection, configuration discovery result, or plan content invalidates that confirmation and requires a new plan.
4. `--dry-run` performs discovery and emits the same plan but never prompts for confirmation or makes a mutation.
5. Client and provider removal is never implicit. It must be explicitly selected, listed prominently as a deletion, and included in the final confirmation.

### Failure and recovery

- Mutations run only after confirmation and stop on the first failed operation.
- The manager performs no automatic rollback. It reports the operations that completed, the operation that failed, the known remaining state, and safe manual recovery/re-run steps.
- A completed-state report must distinguish unattempted operations from completed operations and must never include credential values.

## Affected areas

| Area | Expected responsibility |
| --- | --- |
| `bin/cli.js` and CLI tests | Unified command parsing, interactive selections, discovery, plan rendering, confirmations, execution ordering, and partial-failure reporting. |
| Environment helpers and tests | Canonical project `.env` resolution, provider-variable deletion/preservation, and runtime-precedence messaging. |
| New manager state/config adapters and focused tests | Ownership sidecar, Claude/Pi command adapters, Codex configuration inspection/mutation, preservation, and safe exits. |
| `.mcp.json` and release tests | Credential-free static-template migration aligned with manager-materialized absolute environment paths. |
| Pi extension and tests, if required | Ensure Pi project runtime follows the managed environment-file contract without forwarding secrets. |
| README and client/setup documentation | Replace legacy additive instructions with the unified-manager contract; clearly retain manual marketplace/plugin and `AGENTS.md` responsibilities. |

## Delivery and review workload

The anticipated manager state machine, three client adapters, config-preservation behavior, migration, documentation, and focused tests are likely to exceed the 400 changed-line review budget. The selected delivery strategy is `ask-on-risk`; before implementation, the team must receive a concrete forecast and choose a reviewable delivery approach. No chain strategy or `size:exception` is implied by this proposal.

If work is authorized, it should be organized as independently reviewable units with their tests and user-facing documentation: (1) shared plan/state and provider behavior, (2) client discovery and safe reconciliation adapters, and (3) template/documentation migration. The actual slices remain subject to the required delivery decision and strict-TDD sequence.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Rewriting hand-maintained or tracked config damages unrelated content. | Show exact diffs, require full-plan confirmation, mutate only targeted entries, preserve unrelated content, and safely exit when preservation cannot be assured. |
| A foreign registration is mistaken for a manager-owned one. | Use sidecar ownership state and require explicit adopt-or-replace decisions for unowned registrations. |
| A client binds credentials from an unexpected CWD. | Register the absolute project `.env` path for every managed client integration. |
| Users believe deleting `.env` credentials disables a provider when the process environment still supplies it. | State the runtime environment-precedence caveat in plans, results, and relevant guidance. |
| Codex changes fail or broaden scope because project trust is absent. | Never alter trust; explain and skip/stop only the Codex mutation until the user establishes trust. |
| Multi-step execution leaves a partially configured project. | Stop on failure, report completed and unattempted operations, retain truthful sidecar state, and provide manual recovery instructions rather than automatic rollback. |
| Static template migration implies a portable credential path that does not exist. | Keep the distributed template credential-free and let project setup materialize the absolute path. |

## Rollback

Implementation rollback is limited to reverting the setup-manager behavior and its accompanying tests/docs/template migration. For a project already changed by the future manager, recovery is explicit rather than automatic: rerun the manager to produce a new reconciled plan, or manually restore the shown targeted registration, `.env` variables, and manager sidecar entry from project history/backups. It must never remove global packages, Claude marketplace/plugin state, `AGENTS.md`, Codex trust, or inherited environment values as part of rollback.

## Success criteria

1. A project can run bare `ticket-analyzer-mcp setup` to obtain one non-secret, confirmed plan covering selected shared providers and project client integrations.
2. Every managed client registration binds to the absolute `<project-root>/.env` path, and plans explain inherited-environment precedence.
3. The manager never changes marketplace/plugin state, `AGENTS.md`, global packages, or Codex trust.
4. Existing matching and foreign registrations cannot be silently overwritten; users see a diff and make an explicit adopt-or-replace choice.
5. Tracked client configuration is changed only after exact proposed changes and full-plan confirmation, while unrelated content remains intact.
6. Provider and client deletions are explicit, prominent, confirmed, and limited to their owned/selected project state.
7. `--configure-clients` remains compatible, `--dry-run` is mutation-free, and missing Codex trust produces an explanatory non-mutating result.
8. A partial failure stops execution and reports completed, failed, and unattempted operations without exposing credentials or claiming rollback.

## Proposal assumptions and handoff

Research was not selected. This proposal incorporates the confirmed pre-proposal product decisions and requires specification/design to settle implementation-safe parser/preservation mechanics, sidecar schema/location, operation ordering, and exact CLI interaction text without weakening the stated safety boundaries.
