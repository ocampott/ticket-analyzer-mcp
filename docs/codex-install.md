# Install with OpenAI Codex

## Requirements

Use Node.js 18 or newer. The setup wizard requires a TTY and writes credentials only to the target project's ignored `.env`.

## Published package

From the project that should own the credentials, run:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

Select Codex alone or with Claude Code and/or Pi. Choose the required providers, enter their credentials, then follow the generated Codex command. Setup prints only the absolute `.env` path, never provider secrets, and does not execute client CLIs or change client settings.

The registration shape is:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@latest
```

This uses only the non-secret `TICKET_ANALYZER_ENV_FILE` setting. `codex mcp remove ticket-analyzer` removes the registration when needed. Restart Codex after changing the registration or after updating the package.

`@latest` resolves the current npm package when a new MCP process starts. Keep this registration for normal updates; do not invent a Codex configuration-update command or rerun setup just to change the package version. Pin an explicit npm version only when reproducibility is intentional.

## Local checkout

For local development, build the checkout before setup:

```bash
cd /absolute/path/to/ticket-analyzer-mcp
npm install
npm run build
cd /absolute/path/to/your-project
node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup
```

When setup runs from a checkout, it detects the local package root and prints a local Codex command using `node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js`. Rebuild after source changes and restart Codex. A package under `node_modules` is detected as published-package mode and prints the pinned `2.2.0` npm guidance instead.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Before each provider prompt, setup explains the credential source and format. Azure DevOps needs `Work Items: Read`; `Work Items: Read & Write` is needed only for comments. Do not put provider secrets in `codex mcp add`, shell history, or Codex configuration.

## Merge the instructions

Merge [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`; preserve local instructions and headings. Do not overwrite local guidance.

## Diagnostics

The no-argument command starts the MCP server over stdio. `status` performs local-only checks; `doctor` also checks provider connections:

```bash
npx -y ticket-analyzer-mcp@latest status
npx -y ticket-analyzer-mcp@latest doctor
```
