# Install with OpenAI Codex

## Requirements

Use Node.js 18 or newer. Setup requires a TTY and writes credentials only to the target project's ignored `.env`.

## Central npm CLI

Install one machine-wide package version:

```bash
npm install --global ticket-analyzer-mcp@2.3.0
```

From the project that should own the credentials, run the published setup wizard:

```bash
ticket-analyzer-mcp setup
```

Select Codex and the required providers. Setup prints only the absolute `.env` path, never provider secrets, and does not execute client CLIs or change client settings.

To opt in to client configuration after the provider phase, run:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

Normal mode detects available clients, prints one non-secret plan, and asks for one confirmation per selected available client. It executes only confirmed clients, using a limited environment without provider credentials. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. The legacy `ticket-analyzer-mcp setup` remains credential-only. The wizard does not inspect, replace, or remove existing Codex registrations; update registrations manually when needed and restart Codex after configuration or updates. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

Register the global server binary with Codex:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- ticket-analyzer-mcp
```

This uses only the non-secret `TICKET_ANALYZER_ENV_FILE` setting. `codex mcp remove ticket-analyzer` removes the registration when needed. Restart Codex after changing the registration or updating the package.

Update the central version with `npm update --global ticket-analyzer-mcp`. For a central pin, install an exact version such as `npm install --global ticket-analyzer-mcp@2.3.0`. The project-local alternative, `npm install ticket-analyzer-mcp@2.3.0`, is isolated to that project and is not the recommended central policy.

Do not replace the global command with a checkout, filesystem package path, or direct Node entrypoint.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence. Do not put provider secrets in Codex configuration or shell history.

## Merge the instructions

Merge [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`; preserve local instructions and headings. Do not overwrite local guidance.

## Updates and diagnostics

Restart Codex after updating the package. Use these commands from the project whose `.env` should be checked:

```bash
npm update --global ticket-analyzer-mcp
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

`status` is local-only. `doctor` may contact providers and reports connection errors without secrets. The no-argument command is the MCP stdio server.
