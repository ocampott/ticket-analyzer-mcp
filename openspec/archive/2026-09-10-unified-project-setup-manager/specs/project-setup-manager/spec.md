# Project Setup Manager Specification

## Purpose

Provide one safe, project-scoped setup manager for shared provider credentials and Claude, Codex, and Pi integrations without taking ownership of global or unrelated client state.

## Non-Goals

The manager SHALL NOT install, update, or remove a global package; install or remove a Claude marketplace item or plugin; create, merge, or remove `AGENTS.md`; change Codex trust or another trust/security setting; mutate integrations outside the resolved project; read or remove inherited credential environment values; or automatically roll back after a failure.

## Requirements

### Requirement: Unified Setup Invocation and Legacy Non-TTY Safety

Bare `ticket-analyzer-mcp setup` MUST invoke the unified project setup manager. `--configure-clients` MUST remain a compatibility alias for the same manager behavior. When a run needs an interactive selection, decision, or confirmation but standard input/output is not interactive, the manager MUST NOT block, infer a response, or mutate; it MUST return a non-secret explanation of the required interactive or explicitly supplied input. `--dry-run` MAY render a plan in a non-TTY context when all inputs needed to form it are available.

#### Scenario: Bare setup opens the unified manager

- GIVEN an interactive terminal in a resolved project
- WHEN the operator runs `ticket-analyzer-mcp setup`
- THEN the manager offers unified provider and client setup planning rather than a credential-only flow or manual client instructions.

#### Scenario: Compatibility alias has the same contract

- GIVEN equivalent project state and selections
- WHEN the operator runs `setup --configure-clients` instead of bare `setup`
- THEN the displayed plan, confirmation boundary, and mutation scope are equivalent.

#### Scenario: Legacy non-TTY run requires interaction

- GIVEN setup requires a selection, adoption decision, or confirmation
- WHEN it is run without an interactive terminal and without sufficient explicit inputs
- THEN it performs no mutation and reports why interactive or explicit input is required.

### Requirement: Project-Scoped Credential Management

The manager MUST resolve one project root and MUST use only `<project-root>/.env` as its writable credential target. It MUST support selected Trello, Jira, and Azure DevOps provider additions, edits, and removals. A removal MUST affect only the selected provider's known variables, MUST be explicitly selected, and MUST be presented as a deletion in the confirmed plan. It MUST preserve unrelated `.env` content and unrelated variables; it SHOULD preserve existing formatting and file permissions where the platform permits. Plans and completion reports MUST state that a real process environment variable takes precedence over the project `.env`, so a removed file value does not establish that the provider is inactive in an inherited environment.

#### Scenario: Edit one provider without disturbing unrelated values

- GIVEN `<project-root>/.env` contains Jira variables and unrelated entries
- WHEN the operator confirms an edit to a Trello variable
- THEN only the selected Trello variable is changed and the unrelated entries remain.

#### Scenario: Remove a selected provider

- GIVEN the project `.env` contains variables for Trello and Jira
- WHEN the operator explicitly selects Trello removal and confirms the plan
- THEN only Trello's known variables are removed and the plan and result include the environment-precedence notice.

### Requirement: Durable Client Ownership and Discovery Classification

Before proposing a client mutation, the manager MUST discover the applicable project registration and its local ownership state. It MUST persist credential-free local sidecar state for entries it creates, adopts, or replaces, and use that state on later runs. Discovery MUST classify each applicable target as `owned`, `matching`, `foreign`, or `unknown`: `owned` is a verifiably manager-owned target; `matching` is an unowned target that already has the intended effective registration; `foreign` is an unowned target that conflicts with the intended registration; and `unknown` is malformed, unsupported, untrusted, or unsafe-to-preserve state. An unknown target MUST be a safe non-mutating exit for that client with a non-secret explanation and manual recovery guidance.

The concrete parser, marker, and sidecar-location mechanics are design details. They MUST produce the observable classifications and safety outcomes defined here rather than becoming ambiguous product behavior.

#### Scenario: Existing manager-owned registration is recognized

- GIVEN a client registration and matching credential-free manager ownership state exist for the project
- WHEN the manager discovers that client
- THEN it classifies the registration as `owned` and may plan the selected update or removal.

#### Scenario: Unsafe configuration is not normalized

- GIVEN a selected client's applicable project configuration is malformed or cannot be safely preserved
- WHEN discovery runs
- THEN the manager classifies it as `unknown`, makes no mutation for that client, and provides manual recovery guidance.

### Requirement: Explicit Reconciliation of Unowned Registrations

For every `matching` or `foreign` registration selected for reconciliation, the manager MUST show a relevant non-secret proposed diff and require an explicit `adopt` or `replace` decision. It MUST NOT silently claim, overwrite, or delete an unowned registration. Adoption MUST record ownership state without needlessly rewriting unrelated client configuration. Replacement MUST change or remove only the targeted project entry and MUST be prominently identified as a replacement or removal in the full plan.

#### Scenario: Matching registration is adopted

- GIVEN discovery finds an unowned registration that matches the intended project integration
- WHEN the operator chooses `adopt` and confirms the plan
- THEN the registration remains intact except for any required targeted ownership recording and later discovery reports it as owned.

#### Scenario: Foreign registration requires a replace decision

- GIVEN discovery finds an unowned conflicting registration
- WHEN the operator has not explicitly chosen `replace`
- THEN no mutation of that registration occurs and the displayed diff identifies the conflict.

### Requirement: Complete Plan, Exact Confirmation, and Mutation-Free Dry Run

Every potentially mutating run MUST first render one complete non-secret plan. The plan MUST identify selected provider-variable operations, client additions, updates, removals or replacements, blocked clients, affected files or project configuration operations, sidecar-state changes, and the exact proposed non-secret diff or change for every mutable file. Credential values MUST be redacted. One explicit final confirmation MUST authorize exactly the displayed plan, including every deletion. A changed selection, discovery result, adoption/replacement decision, or plan content MUST invalidate prior confirmation and require a newly rendered plan and confirmation. `--dry-run` MUST perform applicable discovery and render the same plan but MUST NOT prompt for confirmation, write files or sidecar state, invoke a mutating client operation, or otherwise mutate state.

#### Scenario: Confirmation is bound to the plan

- GIVEN a full plan has been displayed
- WHEN discovery changes before execution or the operator changes a selected operation
- THEN the prior confirmation is invalid and the manager displays the revised plan before accepting a new confirmation.

#### Scenario: Dry run is fully mutation-free

- GIVEN a dry-run includes provider edits, a client replacement, and an ownership-state update
- WHEN the operator runs `setup --dry-run`
- THEN it shows the same redacted complete plan without prompting and makes none of the planned changes.

### Requirement: Exact and Preserving Client Configuration Changes

The manager MUST mutate a tracked project client configuration only after its exact proposed non-secret diff is displayed and the complete plan is confirmed. It MUST preserve unrelated configuration content, entries, and project assets. When exact targeted preservation cannot be assured, it MUST classify the client as unknown and make no client configuration mutation.

#### Scenario: Tracked configuration receives a confirmed targeted edit

- GIVEN a selected tracked client configuration has unrelated hand-maintained entries
- WHEN the plan displays the exact targeted diff and the operator confirms it
- THEN only the managed entry changes and the unrelated entries remain unchanged.

#### Scenario: Preservation cannot be assured

- GIVEN a configuration representation cannot be changed without rewriting or risking unrelated content
- WHEN the manager prepares the plan
- THEN it does not offer a mutation for that client and explains the safe manual recovery path.

### Requirement: Claude Project MCP Boundary and Environment Binding

The manager MUST manage only the Claude project-scope MCP registration. Every managed Claude registration MUST bind `TICKET_ANALYZER_ENV_FILE` to the absolute, non-secret path `<project-root>/.env`. It MUST NOT install, remove, or record ownership of Claude marketplace or plugin state. Distributed static MCP templates MUST remain credential-free and MUST NOT contain a consumer-specific environment-file path; the manager MUST materialize the project-specific absolute binding in the managed project registration.

#### Scenario: Claude registration is project-scoped and credential-free

- GIVEN the operator selects Claude integration for a project
- WHEN the confirmed plan is executed
- THEN it adds or updates only the project MCP registration with an absolute `.env` binding and does not perform marketplace or plugin operations.

### Requirement: Codex Trusted Project TOML Safety

The manager MUST manage only the targeted project MCP entry in `<project-root>/.codex/config.toml` and only when Codex already considers the project trusted. It MUST NOT create, edit, or otherwise change Codex trust. A missing trust condition MUST produce a non-mutating explanation for the Codex operation while independently planned operations remain subject to their displayed plan. The manager MUST preserve unrelated TOML content and MUST refuse Codex mutation when it cannot safely target the required entry. Every managed Codex MCP entry MUST bind `TICKET_ANALYZER_ENV_FILE` to the absolute, non-secret `<project-root>/.env` path.

#### Scenario: Untrusted Codex project is not modified

- GIVEN Codex does not consider the project trusted
- WHEN the operator selects Codex integration
- THEN the plan reports Codex as blocked, does not edit `.codex/config.toml` or trust settings, and gives guidance to establish trust manually.

#### Scenario: Safe Codex entry update preserves TOML

- GIVEN the project is trusted and its TOML entry can be safely targeted
- WHEN the operator confirms the exact diff for an owned Codex registration
- THEN only that MCP entry is updated with the absolute environment-file binding and unrelated TOML remains unchanged.

### Requirement: Pi Project-Local Integration Boundary

The manager MUST manage Pi only through the selected project's local package integration. It MUST NOT install, remove, update, or claim ownership of a global Pi or package installation. A managed Pi integration MUST use the project `.env` contract through an absolute, non-secret `<project-root>/.env` binding where the registration supports environment binding.

#### Scenario: Pi removal is local only

- GIVEN the project has a manager-owned Pi integration
- WHEN the operator explicitly selects its removal and confirms the full plan
- THEN only the project's local Pi integration and its ownership state are removed; no global package state is changed.

### Requirement: Secret-Safe Rendering and Subprocess Boundary

The manager MUST NOT display, persist in ownership state, or include in error/report output any credential value. Credential plan entries MUST identify only the provider and variable name with a redacted value. Any subprocess used for a client operation MUST receive only the environment required for that operation and MUST NOT receive provider credential values unless the operation itself requires a non-secret environment-file path. Subprocess invocation and captured output MUST NOT expose credential values.

#### Scenario: Plan and failure output redact credentials

- GIVEN a provider value is added or changed and a later client operation fails
- WHEN the manager renders the plan and failure report
- THEN both identify affected provider variables without revealing their values.

#### Scenario: Client subprocess has no provider secrets

- GIVEN a client operation is executed after confirmation
- WHEN the manager creates the subprocess environment
- THEN provider credential variables are absent while the non-secret absolute environment-file path is available when required.

### Requirement: Stop-on-Failure Reporting Without Rollback

After confirmation, the manager MUST execute planned mutations in the displayed order and stop at the first failed operation. It MUST NOT automatically roll back completed operations. Its non-secret failure report MUST identify completed operations, the failed operation, unattempted operations, known remaining project state, and safe manual recovery or re-run steps. It MUST NOT claim that rollback occurred.

#### Scenario: Later operation fails after earlier completion

- GIVEN a confirmed plan first updates a provider and then configures two clients
- WHEN the first client operation succeeds and the second fails
- THEN the manager stops before later operations, reports the provider and first client as completed, the second client as failed, later operations as unattempted, and gives recovery guidance without rollback.

## Acceptance Scenarios

- GIVEN an existing unowned client registration, WHEN reconciliation is selected, THEN an exact non-secret diff and explicit adopt-or-replace decision are required before any ownership or configuration mutation.
- GIVEN a plan includes any provider or client deletion, WHEN the operator has not confirmed that exact displayed plan, THEN no deletion occurs.
- GIVEN a project has inherited provider environment variables, WHEN the manager plans or reports a `.env` removal, THEN it warns that inherited values still take precedence and are outside its mutation scope.
- GIVEN any selected client is malformed, untrusted, unsupported, or unsafe to preserve, WHEN the plan is formed, THEN that client is reported as non-mutating with manual recovery guidance while safe independently selected operations retain their own plan status.
- GIVEN a confirmed plan spans client and provider operations, WHEN any operation fails, THEN execution stops, reports completed/failed/unattempted states without secrets, and performs no rollback.
