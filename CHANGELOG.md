# Changelog

## [2.1.0] - Unreleased

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
