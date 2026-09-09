---
description: Securely configure ticket-analyzer credentials in the current project's local .env.
disable-model-invocation: true
user-invocable: true
---

# Secure ticket-analyzer setup

Use the published npm CLI setup wizard instead of collecting credentials in Claude Code:

```bash
npx -y ticket-analyzer-mcp@2.2.1 setup
```

Run it from the project that should own the credentials. It requires an interactive terminal, uses purpose-labeled checkbox choices for Trello cards, Jira issues, and Azure DevOps work items, validates required values, preserves unrelated `.env` keys, and writes selected credentials to the ignored project-local `.env`. Before prompting each selected provider, explain the exact credential source and format: Trello API key and token from `https://trello.com/app-key`; Jira site hostname, account email, and Atlassian API token; Azure DevOps organization, project, and PAT with minimum `Work Items: Read` scope. `Work Items: Read & Write` is needed only for comments. Credentials are loaded from `.env` by the MCP server; real environment variables take precedence.

Do not pass provider secrets to `claude mcp add`, `claude plugin`, shell commands, or any client configuration. In particular, never generate or execute a command containing `--env TRELLO_TOKEN=...`, `--env JIRA_API_TOKEN=...`, `--env AZURE_DEVOPS_PAT=...`, or any other secret. The CLI does not modify Claude Code, Codex, or Pi configuration, execute client CLIs, or print, echo, log, or include secret values in commands.

After provider setup, select any combination of Claude Code, OpenAI Codex, and Pi with the checkbox selector. Leave all clients unchecked to configure later. Follow every grouped, client-specific next step it prints:

- Claude Code: `claude plugin marketplace add ocampott/ticket-analyzer-mcp`, then `claude plugin install ticket-analyzer@ticket-analyzer-mcp`; update with `claude plugin marketplace update ticket-analyzer-mcp` and `claude plugin update ticket-analyzer@ticket-analyzer-mcp`, then restart Claude Code.
- Pi: project-local `pi install -l npm:ticket-analyzer-mcp` or user-global `pi install npm:ticket-analyzer-mcp`; update with `pi update npm:ticket-analyzer-mcp`, then restart or reload Pi. Pi packages run with full system access, so review the package source.
- Codex: register only the non-secret absolute env-file path with `codex mcp add ticket-analyzer --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env -- npx -y ticket-analyzer-mcp@2.2.1`, then restart Codex.
- No client: setup explicitly reports that credentials are ready locally but no agent client has been configured yet.

All distributed installation, update, server, setup, and diagnostic commands use the published npm/npx package. Do not replace them with a checkout, filesystem path, or direct Node entrypoint. The CLI has no `update` subcommand.

For diagnostics:

```bash
npx -y ticket-analyzer-mcp@2.2.1 doctor
npx -y ticket-analyzer-mcp@2.2.1 status
```

`doctor` may contact providers and reports connection errors without secrets. `status` is local-only and never makes network calls. The no-argument command remains the MCP stdio server command; it is not the setup wizard.
