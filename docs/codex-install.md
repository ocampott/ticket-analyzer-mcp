# Install with OpenAI Codex

## One-command setup

After publishing 2.1.0, from the target project, run:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

For local development before 2.1.0 is published, run setup from the checkout instead:

```bash
node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup
```

Select Codex alone or with Claude Code and/or Pi, then use the local Node command printed by the wizard. After publishing, use the npm command below.

Use the TTY checkbox multi-select to choose Trello cards, Jira issues, and/or Azure DevOps work items, then select any client combination. Leave all clients unchecked to configure later. Selecting no providers leaves ticket integrations unavailable until the required values are added to `.env` or setup is rerun. Setup prints one grouped, non-secret next step for every selected client and does not execute client CLIs or change client settings. Before each provider prompt it explains the credential source and format: Trello uses the API key and token from `https://trello.com/app-key`, Jira uses the site hostname, account email, and Atlassian API token, and Azure DevOps uses the organization, project, and a PAT with minimum `Work Items: Read` scope. `Work Items: Read & Write` is needed only for comments. The Codex next step uses only the absolute project `.env` path:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@latest
```

Do not put provider secrets in `codex mcp add`, shell history, or Codex configuration. The wizard never prints, echoes, logs, or includes credential values in commands. Restart Codex after changing the MCP configuration. If no client is selected, setup reports that credentials are ready locally but no agent client has been configured yet.

## Advanced environment behavior

The no-argument command starts the MCP server over stdio. It loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence over file values. `status` performs only local checks, while `doctor` also checks provider connections.

Merge [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`. Do not overwrite local instructions.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Use [`.env.example`](../.env.example) for placeholder names only. Keep the generated `.env` project-local and ignored.
