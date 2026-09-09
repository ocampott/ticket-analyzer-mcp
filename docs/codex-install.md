# Install with OpenAI Codex

## Requirements

Use Node.js 18 or newer. The setup wizard requires a TTY and writes credentials only to the target project's ignored `.env`.

## Published package

From the project that should own the credentials, run the published npm package:

```bash
npx -y ticket-analyzer-mcp@2.2.1 setup
```

Select Codex alone or with Claude Code and/or Pi. Choose the required providers, enter their credentials, then follow the generated Codex command. Setup prints only the absolute `.env` path, never provider secrets, and does not execute client CLIs or change client settings.

The registration shape is:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@2.2.1
```

This uses only the non-secret `TICKET_ANALYZER_ENV_FILE` setting. `codex mcp remove ticket-analyzer` removes the registration when needed. Restart Codex after changing the registration or after updating the npm package.

The server command must remain the published `npx` command. Do not replace it with a checkout, filesystem path, or direct Node entrypoint.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Before each provider prompt, setup explains the credential source and format. Azure DevOps needs `Work Items: Read`; `Work Items: Read & Write` is needed only for comments. Do not put provider secrets in `codex mcp add`, shell history, or Codex configuration.

## Merge the instructions

Merge [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`; preserve local instructions and headings. Do not overwrite local guidance.

## Updates and diagnostics

Restart Codex after updating the published npm package. Use the following commands for local-only status and provider connectivity checks:

```bash
npx -y ticket-analyzer-mcp@2.2.1 status
npx -y ticket-analyzer-mcp@2.2.1 doctor
```
