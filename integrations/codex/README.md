# OpenAI Codex setup

`ticket-analyzer-mcp` supports Codex through the standard MCP interface. This directory contains the Codex instruction adapter.

## Central npm CLI

Install one machine-wide published version:

```bash
npm install --global ticket-analyzer-mcp@3.0.0
```

From the target project, run the published setup wizard:

```bash
ticket-analyzer-mcp setup
```

Choose the required providers, enter their credentials, then select **Codex** alone or with Claude Code and/or Pi. The legacy wizard writes secrets only to the ignored project-local `.env` and does not execute client CLIs. To opt in to client configuration, run:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --dry-run --providers trello,jira --clients codex
```

Normal mode detects available clients, prints one non-secret plan, and asks for one confirmation per selected available client. It executes only confirmed clients, using a limited environment without provider credentials. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

The generated Codex registration command is:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- ticket-analyzer-mcp
```

The Codex command follows `codex mcp add <NAME> --env KEY=VALUE -- COMMAND...`; use `codex mcp remove ticket-analyzer` to remove a registration. Never put provider credentials in Codex configuration or shell history. Restart Codex after configuration or updates.

Mark the project as trusted from Codex itself before selecting the Codex integration. Setup never reads or changes Codex trust and never touches `$CODEX_HOME` or your home directory; it asks you to confirm the prerequisite and treats that as an unverified assertion. It reconciles only the `[mcp_servers.ticket-analyzer]` entry in the project's own `.codex/config.toml`, shows the exact diff before you confirm, preserves every byte outside that entry, and reports Codex as blocked without writing anything whenever the entry cannot be targeted unambiguously. See [docs/codex-install.md](../../docs/codex-install.md) for the full boundary.

Restart Codex after registering the server or updating the package. Update the central version with `npm update --global ticket-analyzer-mcp`; an exact global install such as `npm install --global ticket-analyzer-mcp@3.0.0` pins it. The project-local alternative `npm install ticket-analyzer-mcp@3.0.0` is isolated to that project.

Do not replace the global command with a checkout, filesystem path, or direct Node entrypoint.

## Merge the instructions

Merge `AGENTS.template.md` into the target project's existing `AGENTS.md`. Preserve existing instructions and headings; append or integrate the ticket-analysis section rather than replacing it. If the project has no `AGENTS.md`, copy the template as the initial file.

The template is an adapter snapshot. Keep its instruction contract aligned with the repository root `AGENTS.md`; update server installation separately through the machine-wide npm package.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`. Real environment variables take precedence. Azure DevOps requires a PAT with minimum `Work Items: Read`; `Work Items: Read & Write` is needed only for comments.

## Use and diagnostics

Ask Codex naturally, for example:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
```

The agent fetches and explores first, then waits for explicit confirmation before editing code or posting comments. For diagnostics, use the global CLI:

```bash
npm update --global ticket-analyzer-mcp
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```
