# Install with OpenAI Codex

This is the Codex installation path for `ticket-analyzer-mcp` 2.0.1. It uses the standard MCP server and the instruction adapter in [`integrations/codex/`](../integrations/codex/).

## Register the MCP server

```bash
codex mcp add ticket-analyzer \
  --env AZURE_DEVOPS_ORG=... \
  --env AZURE_DEVOPS_PROJECT=... \
  --env AZURE_DEVOPS_PAT=... \
  -- npx -y ticket-analyzer-mcp@latest
```

Replace the Azure variables with the provider variables you need, or add the equivalent Trello/Jira variables:

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Run `codex mcp list`, then restart Codex. Never commit credentials or a generated MCP configuration.

## Merge project instructions

Merge [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`. Do not overwrite existing instructions. Preserve local rules and add the ticket workflow section; if no file exists, the template can be copied as the initial `AGENTS.md`.

Keep the server version at **2.0.1**. Keep the root `AGENTS.md` and copied Codex adapter at their instruction-contract version, **2.0.0**.

## Credentials

- Trello: <https://trello.com/app-key>
- Jira: <https://id.atlassian.com/manage-profile/security/api-tokens>; use a host such as `company.atlassian.net` for `JIRA_HOST`.
- Azure DevOps: `https://dev.azure.com/{ORG}/_usersSettings/tokens`; use a PAT with **Work Items: Read**. Add write scope only when comments are required.

## Updates

Keep `npx -y ticket-analyzer-mcp@latest` in the Codex MCP entry. The latest server is resolved when the MCP process launches, so refresh it on the next Codex launch/restart. Re-merge the instruction template when its version changes; server and instruction adapter versions must stay aligned.
