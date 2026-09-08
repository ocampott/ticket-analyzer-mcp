# OpenAI Codex setup

`ticket-analyzer-mcp` 2.0.0 supports Codex through the standard MCP interface. The server stays client-neutral; this directory contains only the Codex instruction adapter.

## 1. Register the server

Run the command with the credentials for the providers you use. Omit unrelated `--env` options. Keep secrets local and do not commit this command or a generated Codex config.

```bash
codex mcp add ticket-analyzer \
  --env TRELLO_API_KEY=... \
  --env TRELLO_TOKEN=... \
  --env JIRA_HOST=... \
  --env JIRA_EMAIL=... \
  --env JIRA_API_TOKEN=... \
  --env AZURE_DEVOPS_ORG=... \
  --env AZURE_DEVOPS_PROJECT=... \
  --env AZURE_DEVOPS_PAT=... \
  -- npx -y ticket-analyzer-mcp@latest
```

Use only the variables for the selected integration:

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Verify the entry with `codex mcp list`. Restart Codex after changing the entry so the server starts with the new environment.

## 2. Merge the instructions

Copy `AGENTS.template.md` into the target project and merge it with the project's existing `AGENTS.md`. Preserve existing instructions and headings; append or integrate the ticket-analysis section rather than replacing the file. If the project has no `AGENTS.md`, copy the template as the initial file.

The template is an adapter snapshot. Keep its **2.0.0** version aligned with the npm server and the root `AGENTS.md` when upgrading.

## 3. Use it

Ask Codex naturally, for example:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
```

The agent fetches and explores first, then waits for explicit confirmation before editing code or posting comments.

## Credentials

- Trello: create an API key and token at <https://trello.com/app-key>.
- Jira: create an API token at <https://id.atlassian.com/manage-profile/security/api-tokens>; `JIRA_HOST` is the host such as `company.atlassian.net`.
- Azure DevOps: create a PAT at `https://dev.azure.com/{ORG}/_usersSettings/tokens` with **Work Items: Read** (add write scope only to post comments).

## Updates

The command intentionally uses `npx -y ticket-analyzer-mcp@latest`. Refreshes are picked up the next time Codex launches or restarts the MCP server. Re-merge the updated instruction template when the adapter changes; the server and instruction adapter must remain on the same version.
