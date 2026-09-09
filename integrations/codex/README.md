# OpenAI Codex setup

`ticket-analyzer-mcp` supports Codex through the standard MCP interface. This directory contains the Codex instruction adapter.

## Published package

From the target project, run the published npm setup wizard:

```bash
npx -y ticket-analyzer-mcp@2.2.1 setup
```

Choose the required providers, enter their credentials, then select **Codex** alone or with Claude Code and/or Pi. The wizard writes secrets only to the ignored project-local `.env` and prints a grouped, non-secret registration command:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@2.2.1
```

The command follows `codex mcp add <NAME> --env KEY=VALUE -- COMMAND...`; use `codex mcp remove ticket-analyzer` to remove the registration. Never put provider credentials in Codex configuration or shell history. Setup does not execute client CLIs or mutate client settings.

Restart Codex after registering the server or updating the published npm package. The server registration must remain the published `npx` command; do not replace it with a checkout, filesystem path, or direct Node entrypoint.

## Merge the instructions

Merge `AGENTS.template.md` into the target project's existing `AGENTS.md`. Preserve existing instructions and headings; append or integrate the ticket-analysis section rather than replacing it. If the project has no `AGENTS.md`, copy the template as the initial file.

The template is an adapter snapshot. Keep its instruction contract aligned with the repository root `AGENTS.md`; update server installation separately through npm.

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

The agent fetches and explores first, then waits for explicit confirmation before editing code or posting comments. For diagnostics, use the published npm package:

```bash
npx -y ticket-analyzer-mcp@2.2.1 status
npx -y ticket-analyzer-mcp@2.2.1 doctor
```
