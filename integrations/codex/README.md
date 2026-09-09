# OpenAI Codex setup

`ticket-analyzer-mcp` supports Codex through the standard MCP interface. The server remains client-neutral; this directory contains the Codex instruction adapter.

## Published package

From the target project, run the secure interactive wizard:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

Choose the required providers, enter their credentials, then select **Codex** alone or with Claude Code and/or Pi. The wizard writes secrets only to the ignored project-local `.env` and prints a grouped, non-secret registration command:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@latest
```

The command follows `codex mcp add <NAME> --env KEY=VALUE -- COMMAND...`; use `codex mcp remove ticket-analyzer` to remove the registration. Never put provider credentials in Codex configuration or shell history. Setup does not execute client CLIs or mutate client settings.

Restart Codex after registering the server. The `@latest` spec resolves the current npm package when a new MCP process starts, so normal updates do not require a configuration edit. Restart Codex after an update. Pin an explicit version only when reproducibility is intentional.

## Local development

Build a local checkout before running its setup wizard:

```bash
cd /absolute/path/to/ticket-analyzer-mcp
npm install
npm run build
node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup
```

Local setup prints a `node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js` Codex command instead of an npm command. Rebuild after source changes and restart Codex. A package under `node_modules` is detected as published-package mode and prints pinned `2.2.0` npm guidance.

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

The agent fetches and explores first, then waits for explicit confirmation before editing code or posting comments. For diagnostics, use `status` for local-only checks or `doctor` for provider connectivity checks.
