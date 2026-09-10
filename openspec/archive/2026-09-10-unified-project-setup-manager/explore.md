# Exploration — unified-project-setup-manager

## Scope and constraints

Design only: turn `ticket-analyzer-mcp setup` into one project setup manager for project-scoped Claude, Codex, and Pi integrations plus the project’s shared provider credentials. The global npm binary remains the sole central package installation.

Confirmed product rules:

- Providers are Trello, Jira, and Azure DevOps; their credentials live in the project `.env`.
- Removing a provider deletes only that provider’s variables and requires explicit confirmation.
- Removing a client deletes only its project integration; it never removes the global npm package, a Claude marketplace entry, or credentials.
- Every mutation must have a non-secret plan before confirmation.
- Legacy setup migrates to the unified manager.
- Claude supports project-scope MCP add/remove, Pi supports project-local `-l` install/remove, and Codex uses trusted-project `.codex/config.toml`; the installed Codex CLI’s add/remove/list commands do not expose scope flags, so direct configuration-file management may be required.

No client/provider command or credential file was invoked/read during this exploration.

## Current implementation map

| Area | Exact paths/symbols | Current behavior relevant to the change |
|---|---|---|
| CLI entry and setup orchestration | `bin/pm-mcp.js`; `bin/cli.js`: `runCli`, `setupCommand`, `parseSetupArgs`, `configureSelectedClients` | `setup` accepts only `--configure-clients` and `--dry-run`; it first collects selected provider values, writes `.env`, then prompts clients. Without `--configure-clients`, it prints manual next steps. |
| Provider credentials | `bin/cli.js`: `PROVIDERS`, `updateEnvContent`, `readExistingEnv`, `resolveEnvFilePath`; `src/env.ts`: `PROVIDER_ENV_VARS`, `resolveEnvFile`, `readEnvFile`, `loadTicketEnvironment` | Provider fields are duplicated in JS and TS. Writes preserve unrelated `.env` lines/keys but only support replacement/addition; no provider-key deletion exists. Runtime resolves `TICKET_ANALYZER_ENV_FILE` relative to process CWD, defaulting to `.env`, and real environment variables override file values. |
| Existing client actions | `bin/cli.js`: `CLIENT_COMMANDS`, `CLIENT_EXECUTABLES`, `resolveExecutable`, `runCommand`, `deriveClientEnvironment` | Claude runs marketplace add plus plugin install; Codex uses `codex mcp add ticket-analyzer --env TICKET_ANALYZER_ENV_FILE=<absolute path> -- ticket-analyzer-mcp`; Pi uses `pi install -l npm:ticket-analyzer-mcp@2.3.1`. There is no registration discovery, update, removal, ownership model, or config-file parser. Client subprocesses are shell-free, time-bounded, output-bounded, and stripped of provider credentials. |
| Pi runtime | `package.json`: `pi`; `extensions/ticket-analyzer.js`: `TICKET_ENV_VARS`, `getTicketEnvironment`, `ticketAnalyzerExtension` | Pi’s extension launches the server with `ctx.cwd` and forwards only ticket-related environment variables. It can therefore use `<ctx.cwd>/.env` when the env-file variable is absent, but no project-install metadata or explicit env-file binding is managed here. |
| Static MCP template | `.mcp.json`; `src/release.test.ts` test `uses the globally installed binary in the MCP template without credentials` | The published template has `pm.command = "ticket-analyzer-mcp"` and no environment mapping. It cannot bind a consumer project’s `.env` by itself. |
| Claude distribution | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`; `skills/setup/SKILL.md` | The current client flow owns marketplace/plugin installation commands, not a project-scoped Claude MCP registration. This conflicts with the requested client-removal boundary unless the unified design switches to project MCP ownership or clearly excludes marketplace state from management. |
| Codex distribution | `docs/codex-install.md`; `integrations/codex/README.md`; `integrations/codex/AGENTS.md`; `integrations/codex/AGENTS.template.md` | All current guidance describes CLI-level Codex add/remove, an absolute env-file path, and a manually merged `AGENTS.md` adapter. It does not define `.codex/config.toml` mutation, project trust handling, or preservation rules. |
| Active documentation | `README.md`; `docs/agent-workflow.md`; `docs/codex-install.md`; `docs/pi-install.md`; `integrations/codex/README.md`; `skills/setup/SKILL.md` | These documents describe additive, opt-in client creation and say legacy setup is credential-only. They will need aligned migration semantics. |
| Tests | `bin/cli.test.js`; `src/env.test.ts`; `extensions/ticket-analyzer.test.js`; `src/release.test.ts` | Tests cover setup input, additions, `.env` preservation and mode, non-secret output, client safe spawning, absolute Codex path emission, Pi extension env forwarding, and published-doc invariants. They do not cover discovery, removal, ownership, TOML/JSON preservation, project trust, or migration. |

## Design tensions and risks

1. **Claude ownership conflict:** current Claude commands mutate marketplace/plugin state, while the new removal rule forbids touching it. Project-scoped Claude MCP management and the existing plugin/skill distribution are distinct concerns that must not be silently conflated.
2. **Codex direct-file conflict:** supplied capability evidence establishes project `.codex/config.toml` and project trust, but not an implementation-safe TOML parser/preserver. `package.json` has no TOML dependency. Re-serializing a tracked or hand-edited config risks comments, formatting, unknown fields, and foreign registrations.
3. **Foreign-registration ownership:** current behavior deliberately does not inspect, replace, or remove registrations. A manager needs discovery and a rule for an existing same-name registration versus unrelated client configuration; structural matching alone may be unsafe without a durable ownership marker or explicit adoption flow.
4. **Tracked configuration files:** `.mcp.json` is tracked in this package and consumer `.codex/config.toml` or project client files may be tracked. Project setup must not assume it may modify tracked files or normalize their contents without an explicit policy and a shown diff/plan.
5. **Environment-path semantics:** runtime supports relative `TICKET_ANALYZER_ENV_FILE`, but existing Codex guidance emits an absolute path. The required canonical path form, custom-env-file support, and client-specific CWD behavior are not settled. Relative paths could bind a different file if a client changes CWD.
6. **Provider deletion versus precedence:** only `.env` is writable by this CLI; real environment values take precedence and cannot safely be removed by project setup. A plan must distinguish deleting stored provider variables from the provider remaining effectively configured through inherited environment variables.
7. **Migration and compatibility:** the legacy command, accepted flags, prompt sequence, non-TTY behavior, dry-run semantics, and existing docs all encode additive credential-first behavior. Changing it requires an explicit compatibility contract rather than an implicit flag repurpose.
8. **Partial failure and recovery:** a multi-client/provider plan can span `.env`, client CLIs, and direct config files. The transactional boundary, ordering, rollback guarantees, and state after a failed client mutation are not defined.

## Evidence-based implementation surface

Likely production ownership centers on `bin/cli.js`; the TypeScript server runtime should remain limited to its established `src/env.ts` contract unless a chosen design needs a shared environment/config domain module. The implementation will need new focused tests beside `bin/cli.test.js` for manager state, plans, confirmations, mutation boundaries, and failure recovery; `src/env.test.ts` for any retained/changed path contract; `extensions/ticket-analyzer.test.js` if Pi’s project/env behavior changes; and `src/release.test.ts` plus the active documentation list if published guidance changes.

The number of new state transitions, client adapters, config-preservation cases, and bilingual/distribution docs makes a single under-400-line delivery unlikely. Under `ask-on-risk`, proposal/tasks must forecast the changed lines and request a delivery decision if the forecast exceeds 400; no chain strategy or size exception is selected here.

## Grouped decisions needed before proposal

Please answer this single grouped prompt; the answers determine the proposal rather than being assumed:

1. **Client contract and ownership:** Should unified setup manage only project MCP/package registrations (Claude project MCP, Codex project config, Pi project package) and leave Claude marketplace/plugin/`AGENTS.md` installation strictly manual and never-owned? If a matching or foreign registration already exists, should setup (a) report and require an explicit adopt/replace choice, (b) refuse and prescribe manual recovery, or (c) use another ownership rule you specify?
2. **Configuration-file authority:** May setup mutate a tracked project client config after showing its exact planned change, or must it refuse tracked files? For Codex TOML and any JSON config, must comments/order/formatting be preserved byte-for-byte outside the managed entry, and is adding a manager-owned marker/sidecar manifest acceptable?
3. **Environment binding:** Is the managed credential target always `<project-root>/.env`, or may users keep `TICKET_ANALYZER_ENV_FILE` overrides? For client registrations, should the non-secret path always be absolute, or is a project-relative path required where a client supports it?
4. **Trust, migration, and confirmation:** If Codex project trust is absent, should setup only plan/instruct the user to establish trust, or may it create/modify the trust setting after its own confirmed plan? Should bare `ticket-analyzer-mcp setup` become the unified interactive manager immediately, and what compatibility behavior is required for `--configure-clients` and `--dry-run`? For a multi-step plan, do you require an explicit confirmation for each listed mutation or one explicit confirmation that authorizes the entire displayed plan?
5. **Failure policy:** When a later client mutation fails after provider or earlier client changes succeeded, should the manager stop and report the completed state, attempt rollback only for files it owns, or require a different recovery policy?

## Exploration result

- **change:** `unified-project-setup-manager`
- **artifact_store:** `openspec`
- **artifact:** `openspec/changes/unified-project-setup-manager/explore.md`
- **status:** blocked on the grouped product decisions above before a non-speculative proposal can be written.
- **skill_resolution:** `paths-injected` (the `work-unit-commits` skill)
