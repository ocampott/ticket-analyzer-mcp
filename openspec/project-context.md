# SDD Project Context — ticket-analyzer-mcp

## Initialization record

- **Artifact store:** OpenSpec.
- **Execution mode:** auto.
- **Authorized model for this phase:** `openai-codex/gpt-5.6-terra`.
- **Delivery strategy:** `ask-on-risk`; the review budget is 400 changed lines.
- **Workflow order:** proposal, specification, and design must be reviewable before implementation.
- **Persistence:** this file is the active project-context artifact for `sdd-init/ticket-analyzer-mcp`.

## Repository baseline

- Repository: `ticket-analyzer-mcp` v2.3.1.
- Stack: TypeScript ESM using `module`/`moduleResolution: NodeNext`, targeting ES2022.
- Primary commands: `npm test` (Jest with ts-jest and ESM) and `npm run build` (TypeScript compiler).
- Test inventory at initialization: 22 TypeScript test files under `src/`; CLI and extension tests also exist under `bin/` and `extensions/`.
- The repository working tree was clean at initialization, and the latest observed revision was `c81f934` (`release: v2.3.1`).
- `.atl/skill-registry.md` exists and indexes available project and user skills.

## Requested change intent (design/specification only)

Design a unified `ticket-analyzer-mcp setup` project setup manager that manages both:

1. Project-scoped client integrations for Claude, Codex, and Pi.
2. Project-scoped provider credentials stored in the shared project `.env`.

This initialization does **not** authorize product implementation, application-documentation changes, client configuration changes, commits, publishing, secret reads, or execution of client/provider CLIs.

## Known evidence to preserve for proposal/spec/design

- The package is installed as one global npm binary, while each client integration is configured per project.
- Provider credentials are shared through the project `.env`.
- Removing a provider must delete that provider's variables only after confirmation.
- Removing a client must remove only its project integration; it must never remove the global package, a marketplace entry, or provider credentials.
- Every change must show a plan and obtain confirmation.
- Verified client facts: Claude supports `--scope project`; Pi supports `project -l model`; official Codex documentation supports project MCP configuration in `.codex/config.toml` when the project is trusted.
- Current behavior performs additive provider setup and opt-in client actions; replacement and removal behavior are new design scope, not implemented behavior.

## Constraints and review gates

- Preserve human confirmation for destructive, credential/security, publishing, ambiguous-scope, provider-removal, and client-removal actions.
- Do not infer `size:exception`; under `ask-on-risk`, pause for a delivery decision when the forecast exceeds 400 changed lines.
- Future implementation follows strict TDD: create a focused failing test before the corresponding production behavior, then run focused tests and `npm run build`.
- Plan future work as independently reviewable work units with tests and relevant user-facing documentation in the same unit.

## Next SDD artifact expectations

The next phase should produce a reviewable proposal/spec/design that defines setup-manager states, discovery and project trust handling, non-secret planning output, confirmation boundaries, add/update/remove semantics, idempotency, dry-run behavior, failure/recovery behavior, and proportional test scenarios before any implementation starts.
