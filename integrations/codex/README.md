# OpenAI Codex setup

`ticket-analyzer-mcp` supports Codex through the standard MCP interface. The server remains client-neutral; this directory contains the Codex instruction adapter.

## One-command setup

From the target project, run the secure interactive wizard:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

Choose the required providers with the checkbox selector, enter their credentials, then select **Codex** alone or with Claude Code and/or Pi. Leave all clients unchecked to configure later. Provider choices are labeled by purpose: Trello cards, Jira issues, and Azure DevOps work items. Before each provider prompt, the wizard explains the exact credential source and format. Azure DevOps requires a PAT with minimum `Work Items: Read`; `Work Items: Read & Write` is needed only for comments. The wizard writes secrets only to the ignored project-local `.env` and prints a grouped, non-secret registration command:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@latest
```

Never put provider credentials in `codex mcp add`, shell history, or Codex configuration. The wizard never prints, echoes, logs, or includes credential values in commands, and it does not execute client CLIs or mutate client settings. Restart Codex after registering the server. If no client is selected, setup reports that credentials are ready locally but no agent client has been configured yet.

### Local development before publication

When the wizard is run directly from a local checkout, it prints a local Codex command instead of an unavailable npm version. Use that command until the release is published.

## Merge the instructions

Merge `AGENTS.template.md` into the target project's existing `AGENTS.md`. Preserve existing instructions and headings; append or integrate the ticket-analysis section rather than replacing the file. If the project has no `AGENTS.md`, copy the template as the initial file.

The template is an adapter snapshot. Keep its instruction contract aligned with the repository root `AGENTS.md`; update server installation separately through npm.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`. Real environment variables take precedence over file values.

## Use

Ask Codex naturally, for example:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
```

The agent fetches and explores first, then waits for explicit confirmation before editing code or posting comments.

## Updates

Keep `npx -y ticket-analyzer-mcp@latest` in the Codex MCP entry. Restart Codex after an update. Re-merge the instruction template only when its instruction contract changes.
