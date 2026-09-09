# Shared agent workflow

`ticket-analyzer-mcp` is a standard, client-neutral MCP server. The consuming agent explores the repository and interprets the ticket; the server provides provider data and deterministic structured evidence.

## Secure setup and central distribution

Install one machine-wide published CLI version:

```bash
npm install --global ticket-analyzer-mcp@2.3.1
```

From the project that should own credentials, run:

```bash
ticket-analyzer-mcp setup
```

Setup writes selected credentials to the ignored project-local `.env`, preserves unrelated keys, and never modifies client configuration or prints secrets. Users update the central version with `npm update --global ticket-analyzer-mcp`; reinstall an exact global version to pin it. The alternative `npm install ticket-analyzer-mcp@2.3.1` is isolated to one project.

Client configuration is explicitly opt-in:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

Normal mode detects `claude`, `codex`, and `pi` on `PATH`, prints one non-secret plan, and asks once per selected available client before executing its create/install commands. Client CLIs run with a limited environment and no provider credentials. Unavailable or declined clients are nonfatal. `--dry-run` prints the same plan without confirmation or child execution, but may write `.env` if providers are selected. Legacy `setup` remains credential-only. The wizard does not inspect, replace, or remove existing client registrations; users must update those manually and restart the relevant client after configuration or updates. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

Use the direct binary for the standalone server and diagnostics:

```bash
ticket-analyzer-mcp
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
```

Setup and client adapters never use a checkout or filesystem package path. The no-argument command starts the MCP server over stdio. `doctor` checks Node, `.env`, provider completeness, and live connections. `status` checks only local configuration completeness and never calls a provider.

## Environment behavior

The server loads the path in `TICKET_ANALYZER_ENV_FILE`, or `<cwd>/.env` when unset. Real environment variables take precedence over file values and are never overwritten. Credentials never belong in Pi, Claude Code, or Codex configuration; Codex receives only the non-secret env-file path.

## Contract

1. Detect the provider from explicit user wording, then identifier format: Jira keys such as `PROJ-123`, numeric Azure DevOps IDs such as `1646`, and other opaque IDs as Trello card IDs. Ask when ambiguous.
2. Fetch all ticket evidence that can affect the work, including comments, child items, checklists, refinement decisions, attachment inventory, and relevant attachment contents. Start with images and text attachments disabled; read every Azure child and never plan from a truncated tree.
3. Use `analyze_ticket` only for deterministic ticket-only supporting evidence. Its hypotheses are repository-unverified and not confirmed requirements, blockers, or estimates; it does not replace the consuming agent's interpretation or implementation plan.
4. Read `.claude/project-context.md` and `.claude/patterns.md` when present as navigation hints only, regardless of age, then inspect the exact relevant source files. Re-read referenced code on every reuse and record actual revision plus dirty/unknown status. Analysis is read-only.
5. Map every requested behavior and restriction to evidence, current implementation, necessary delta, complete plan, and proportional verification. Include Backend, Infra, or other repositories when proven by the ticket or inspected code, not by keyword guesses. Return a concise complete plan with exact paths, dependencies, verification, risks, and size. Azure plans additionally include an estimate by actual work area, justified assumptions, and always include QA.
6. A CACHE WRITE requires explicit bounded cache-only consent for only `.claude/project-context.md` and/or `.claude/patterns.md`, after verifying those paths are ignored; it authorizes no application changes, migrations, comments, or `.gitignore` edits. Analyze permission and cache-write consent are distinct. Cache only verified, reusable repository patterns with exact repository-relative source paths and symbols, actual revision/date, dirty or unknown status, applicability, and limits; never persist raw ticket descriptions, comments, or attachments, credentials or secrets, sensitive ticket or person identifiers, or private external context; never fabricate source references or revisions, and never promote guesses to facts.
7. Wait for explicit implementation confirmation before editing code or posting ticket comments.

The complete necessary change is the goal, not a minimized file count or diff. Natural-language requests are the primary interface. Client slash commands, where available, are compatibility aliases and are not the only route to this workflow.

### Synthetic inspection example

A ticket requests hiding an action bar action for a role. If exact source inspection proves the UI check exists but the corresponding backend endpoint lacks enforcement, the necessary plan includes both Frontend and Backend. If the endpoint already enforces the role, record that as already exists and limit the necessary delta to the UI; if the endpoint cannot be inspected, label the backend inference repository-unverified rather than assuming frontend-only or inventing a blocker. This example is guidance for an analyzer, not a heuristic.
