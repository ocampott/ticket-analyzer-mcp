---
description: Securely configure ticket-analyzer credentials in the current project's local .env.
disable-model-invocation: true
user-invocable: true
---

# Secure ticket-analyzer setup

Use the machine-wide published npm CLI instead of collecting credentials in Claude Code:

```bash
npm install --global ticket-analyzer-mcp@2.3.1
ticket-analyzer-mcp setup
```

Run the client configuration only when explicitly requested:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

Normal mode detects `claude`, `codex`, and `pi` on `PATH`, prints one non-secret plan, and asks for one confirmation per selected available client before executing create/install commands. Client CLIs run with a limited environment and no provider credentials. Unavailable or declined clients are nonfatal. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. The legacy `ticket-analyzer-mcp setup` remains credential-only and never detects or configures clients. The wizard does not inspect, replace, or remove existing client registrations; update them manually when needed and restart or reload the relevant client after configuration or updates. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

Run it from the project that should own the credentials. It requires an interactive terminal, uses purpose-labeled checkbox choices for Trello cards, Jira issues, and Azure DevOps work items, validates required values, preserves unrelated `.env` keys, and writes selected credentials to the ignored project-local `.env`. Before prompting each selected provider, explain the exact credential source and format: Trello API key and token from `https://trello.com/app-key`; Jira site hostname, account email, and Atlassian API token; Azure DevOps organization, project, and PAT with minimum `Work Items: Read` scope. `Work Items: Read & Write` is needed only for comments. Credentials are loaded from `.env` by the MCP server; real environment variables take precedence.

Update the central CLI with `npm update --global ticket-analyzer-mcp`. An exact global install pins the machine-wide version; `npm install ticket-analyzer-mcp@2.3.1` is an alternative isolated to one project. Do not pass provider secrets to `claude mcp add`, `claude plugin`, shell commands, or any client configuration. In particular, never generate or execute a command containing `--env TRELLO_TOKEN=...`, `--env JIRA_API_TOKEN=...`, `--env AZURE_DEVOPS_PAT=...`, or any other secret. The CLI does not modify Claude Code, Codex, or Pi configuration or execute client CLIs unless `--configure-clients` is explicitly requested, and it never prints, echoes, logs, or includes secret values in commands.

After provider setup, select any combination of Claude Code, OpenAI Codex, and Pi with the checkbox selector. Leave all clients unchecked to configure later. Follow every grouped, client-specific next step it prints:

- Claude Code: `claude plugin marketplace add ocampott/ticket-analyzer-mcp`, then `claude plugin install ticket-analyzer@ticket-analyzer-mcp`; update with `claude plugin marketplace update ticket-analyzer-mcp` and `claude plugin update ticket-analyzer@ticket-analyzer-mcp`, then restart Claude Code.
- Pi: install the published Pi-managed package with `pi install -l npm:ticket-analyzer-mcp@2.3.1`; update with `pi update npm:ticket-analyzer-mcp`, then restart or reload Pi. Pi is managed by Pi, not the npm global CLI. Pi packages run with full system access, so review the package source.
- Codex: register only the non-secret absolute env-file path with `codex mcp add ticket-analyzer --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env -- ticket-analyzer-mcp`, then restart Codex.
- No client: setup explicitly reports that credentials are ready locally but no agent client has been configured yet.

All distributed installation, update, server, setup, and diagnostic commands use the machine-wide published CLI. Do not replace them with a checkout, filesystem path, or direct Node entrypoint. The CLI has no `update` subcommand.

For diagnostics:

```bash
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

`doctor` may contact providers and reports connection errors without secrets. `status` is local-only and never makes network calls. The no-argument command remains the MCP stdio server command; it is not the setup wizard.
