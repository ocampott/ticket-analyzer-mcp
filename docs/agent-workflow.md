# Shared agent workflow

`ticket-analyzer-mcp` is a standard, client-neutral MCP server. The consuming agent explores the repository and interprets the ticket; the server provides provider data and deterministic structured evidence.

## Secure setup

From the project that should own credentials:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

Before the release is published, run `node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup` from the local checkout instead. Choose the providers and clients interactively. Setup writes selected credentials to the ignored project-local `.env`, preserves unrelated keys, and never modifies client configuration or prints secrets. The compatibility Claude setup skill points to this command rather than passing secrets to `claude mcp add`.

The command with no subcommand is not setup: it starts the MCP server over stdio for a client. `doctor` checks Node, `.env`, provider completeness, and live connections. `status` checks only local configuration completeness and never calls a provider.

## Environment behavior

The server loads the path in `TICKET_ANALYZER_ENV_FILE`, or `<cwd>/.env` when unset. Real environment variables take precedence over file values and are never overwritten. Credentials never belong in Pi, Claude Code, or Codex configuration; Codex receives only the non-secret env-file path.

## Contract

1. Detect the provider from explicit user wording, then identifier format: Jira keys such as `PROJ-123`, numeric Azure DevOps IDs such as `1646`, and other opaque IDs as Trello card IDs. Ask when ambiguous.
2. Fetch the complete ticket with the provider tool. Start with images and text attachments disabled; fetch a specific attachment only when it can affect the plan. Read every Azure child and never plan from a truncated tree.
3. Use `analyze_ticket` only for supporting structured evidence. It does not replace the consuming agent's interpretation or implementation plan.
4. Read recent cached project context and known patterns, then inspect the exact relevant source files. Analysis is read-only.
5. Return a concise plan with exact paths, dependencies, verification, risks, and size. Azure plans additionally include an estimate by work area and always include QA.
6. Wait for explicit implementation confirmation before editing code or posting ticket comments.

Natural-language requests are the primary interface. Client slash commands, where available, are compatibility aliases and are not the only route to this workflow.
