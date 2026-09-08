# Changelog

## [2.0.0] - Unreleased

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

This release is prepared but not published. A maintainer must run the approved release checks, commit and tag `v2.0.0`, push the tag to GitHub, and publish the package (or let the existing tag-triggered workflow publish it). See the release commands in `README.md`.
