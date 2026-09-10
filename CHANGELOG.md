# Changelog

## [3.0.0] - 2026-09-10

### Removed

- **Breaking.** The Pi runtime no longer forwards provider credentials from its own process environment to the MCP child. It passes only `TICKET_ANALYZER_ENV_FILE`, and the server reads the credentials itself. Anyone who kept credentials only in a shell profile, never in a project `.env`, will now find the server unconfigured; write them to the project `.env` (`setup` does this) to restore it.
- **Breaking.** `--configure-clients` no longer selects an opt-in wizard. It is accepted as an inert compatibility alias because `setup` always configures clients now.

### Added

- Added the unified setup manager: `setup` builds a complete plan, confirms it once, and then applies it in a fixed order (provider credentials, ignore rule, `claude`, `codex`, `pi`).
- Added an ownership sidecar at `.ticket-analyzer/setup-state.json` that records what the manager created, written atomically and without credentials.
- Added five-way discovery for every client — `owned`, `matching`, `foreign`, `absent`, `unknown` — where an unowned or unknown target stops the run instead of being overwritten.
- Added `--providers` and `--clients` for selecting up front, which is also what makes `--dry-run` reachable from a shell; the manager requires explicit selections in that mode and will not prompt for them.
- Added `--dry-run`, which reports the whole redacted plan and writes nothing.
- Added a release guard that packs the tarball and fails when a module the binary imports is missing from `files`.

### Fixed

- Fixed the published package omitting `bin/setup-manager.js`, `bin/setup-adapters.js`, and `bin/setup-files.js`, which made every command of the installed binary fail with `ERR_MODULE_NOT_FOUND`.
- Fixed a multi-provider `setup` run keeping only the last provider's `.env` edit instead of all of them.
- Fixed the `.mcp.json` server key, renamed from `pm` to `ticket-analyzer`.

### Changed

- State is re-read before every operation, so a target reconfigured mid-run invalidates the confirmed plan rather than being overwritten.
- A failed run performs no automatic rollback and reports exactly what completed, what failed, and what was never attempted; completed stages stay applied.
- Setup never replaces an existing registration without an explicit decision. Codex trust, Pi package installation, and Claude marketplace/plugin actions remain deliberately manual.

## [2.3.1] - 2026-09-09

### Changed

- Added reproducible local metadata ignores for worktrees, caches, and OS files while preserving the shared `.claude/skills-manifest.md`.

## [2.3.0] - 2026-09-09

### Added

- Added the opt-in client configuration wizard with `--configure-clients` and a non-executing `--dry-run` plan for Claude Code, Codex, and Pi.
- Added safe command execution without a shell, with bounded output, limited child environments, and provider-credential redaction.
- Added the global MCP manifest entry for the published `ticket-analyzer-mcp` binary.

### Changed

- Documented confirmation per available selected client, manual restart guidance, and the rule that existing registrations are never inspected, replaced, or removed.

## [2.2.2] - 2026-09-09

### Changed

- Made the machine-wide npm installation and update policy explicit: `npm install --global ticket-analyzer-mcp@2.2.2` installs the central version and `npm update --global ticket-analyzer-mcp` updates it.
- Documented `npm install ticket-analyzer-mcp@2.2.2` as the project-local alternative, isolated from the central version.
- Updated CLI, Codex, Pi, and active user documentation to use the global binary without checkout or local package paths.

## [2.2.1] - 2026-09-09

### Changed

- Enforced npm/npx-only distribution for user setup, update, server, and diagnostic commands.
- Updated the CLI to emit published npm commands only and never emit checkout or filesystem package paths.
- Aligned package, MCP server, Pi extension, Claude plugin, and marketplace metadata at `2.2.1`.

This patch prepares the npm distribution policy; provider end-to-end behavior was not claimed or validated here.

## [2.2.0] - 2026-09-09

### Added

- Added safe, bounded attachment handling with validation, pagination, and hierarchy evidence across provider responses.
- Added complete necessary-scope guidance and consented repository-pattern caching rules to the shipped analysis workflow.

### Changed

- Corrected Claude Code marketplace installation guidance to use `claude plugin marketplace add ocampott/ticket-analyzer-mcp` and the supported plugin install/update commands.
- Aligned npm, MCP server, Pi extension, Claude plugin, and marketplace metadata at `2.2.0`.
- Clarified latest-versus-pinned update behavior and local-checkout rebuild/reload steps for Claude Code, Codex, and Pi.

## [2.1.0] - 2026-09-09

### Added

- Added the secure `setup`, `doctor`, and `status` CLI commands with project-local `.env` loading, environment precedence, and secret-safe client guidance.
- Added a placeholder-only `.env.example` and dotenv-backed environment resolution.

### Changed

- Bumped package, MCP server, Pi extension, Claude plugin, and marketplace metadata to `2.1.0`.
- Updated client documentation and the Claude compatibility setup skill to keep provider secrets out of client configuration.

## [2.0.1] - 2026-09-08

### Changed

- Simplified the README and install documentation; it now documents Claude Code, Codex, Pi, npm, and Azure DevOps.

## [2.0.0] - 2026-09-08

### Added

- Canonical client-neutral `AGENTS.md` workflow for ticket detection, MCP provider selection, codebase exploration, structured evidence, concise plans, and explicit confirmation before implementation.
- Claude Code model-invoked ticket-analysis skill for natural-language requests such as “analyze Azure ticket 1646”. The existing slash skills remain compatibility-only aliases.
- OpenAI Codex adapter with a merge-safe `AGENTS.template.md` and `codex mcp add` setup using `npx -y ticket-analyzer-mcp@latest`.
- Native Pi package support with an MCP-backed extension, explicit read-only allowlist, per-call confirmation for non-read tools, and compatible Pi skills.
- Installation, credential, update, and version-alignment documentation for Claude Code, Codex, and Pi.

### Changed

- Bumped the npm package and Claude marketplace/plugin metadata to `2.0.0`.
- Documented the safe analyze → plan → explicit-confirmation → implement workflow.

### Release notes

This release was published to npm as `ticket-analyzer-mcp@2.0.0` and tagged `v2.0.0`.
