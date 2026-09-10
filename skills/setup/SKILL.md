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

`setup` plans providers and clients in a single pass. It prints one complete, secret-free plan and asks for a single confirmation covering the whole plan, then executes in a fixed order: the project `.env`, the ignore rule, then `claude`, `codex`, and `pi`.

```bash
ticket-analyzer-mcp setup --dry-run
```

`--dry-run` prints the same plan and writes nothing, spawning no child process. `--configure-clients` is still accepted as a compatibility alias, but client configuration is part of the normal flow and the flag no longer changes anything.

Before proposing a change, setup inspects the existing registration and classifies it as owned, matching, foreign, absent, or unknown. Adopting a matching registration or replacing a foreign one requires an explicit decision, and removal requires explicit intent. An unknown state is never permission to act: setup stops and explains manual recovery instead of guessing.

A failed stage stops the run and nothing is rolled back automatically. The result names the completed, failed, and unattempted stages, so the project state is explicit rather than inferred. A blocked client leaves the others applicable. Client CLIs run with a limited environment and no provider credentials. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

Run it from the project that should own the credentials. It requires an interactive terminal, uses purpose-labeled checkbox choices for Trello cards, Jira issues, and Azure DevOps work items, validates required values, preserves unrelated `.env` keys, and writes selected credentials to the ignored project-local `.env`. Before prompting each selected provider, explain the exact credential source and format: Trello API key and token from `https://trello.com/app-key`; Jira site hostname, account email, and Atlassian API token; Azure DevOps organization, project, and PAT with minimum `Work Items: Read` scope. `Work Items: Read & Write` is needed only for comments. Credentials are loaded from `.env` by the MCP server; real environment variables take precedence.

Update the central CLI with `npm update --global ticket-analyzer-mcp`. An exact global install pins the machine-wide version; `npm install ticket-analyzer-mcp@2.3.1` is an alternative isolated to one project. Do not pass provider secrets to `claude mcp add`, `claude plugin`, shell commands, or any client configuration. In particular, never generate or execute a command containing `--env TRELLO_TOKEN=...`, `--env JIRA_API_TOKEN=...`, `--env AZURE_DEVOPS_PAT=...`, or any other secret. The CLI never prints, echoes, logs, or includes secret values in commands, and it changes only the registrations it manages, after the plan is confirmed.

Select any combination of Claude Code, OpenAI Codex, and Pi with the checkbox selector. Leave all clients unchecked to configure later. Some work stays manual by design, and setup reports it rather than attempting it:

- Codex project trust is never read or changed by setup. Mark the project as trusted from Codex itself, then re-run setup.
- Pi has no version-pinned safe action contract in this release, so its project-local package is reported and left for you to reconcile.
- Claude marketplace and plugin actions, and every `AGENTS.md` change, remain manual.

Follow every grouped, client-specific next step it prints:

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
