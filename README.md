# ticket-analyzer-mcp

A client-neutral MCP server for reading, searching, and analyzing tickets from **Trello, Jira, and Azure DevOps**. It works with Claude Code, OpenAI Codex, Pi, and other MCP-compatible clients.

## One-command setup

After publishing 2.1.0, from the project that should own the credentials, run:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

For local development before 2.1.0 is published, run setup from the checkout instead:

```bash
node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup
```

The wizard prints a local package path for Pi, a local Node command for Codex, or the Claude Code plugin commands. Use the exact local path it prints; if Pi already lists that path, reload Pi instead. After publishing, use the npm commands below.

The interactive setup uses TTY checkbox multi-selects for Trello, Jira, and Azure DevOps and for Claude Code, OpenAI Codex, and Pi. Select any client combination, or leave all clients unchecked to configure later. It validates required values, preserves unrelated `.env` keys, and writes the project-local `.env` with restrictive permissions where supported. It never changes Claude Code, Codex, or Pi configuration, executes client CLIs, or prints secret values. It prints one clearly grouped, non-secret next step for every selected client. Selecting no providers leaves ticket integrations unavailable until the required values are added to `.env` or setup is rerun.

The command must run from a TTY. For diagnostics, use `doctor`; for a local, no-network configuration check, use `status`.

```bash
npx -y ticket-analyzer-mcp@latest doctor
npx -y ticket-analyzer-mcp@latest status
```

The no-argument command is different: it starts the MCP server over stdio for an MCP client.

```bash
npx -y ticket-analyzer-mcp@latest
```

## What it provides

- Fetch complete Trello cards, Jira issues, and Azure DevOps work-item trees.
- Search Trello, Jira, and Azure DevOps.
- Include descriptions, comments, acceptance criteria, attachments, and Azure child work items.
- Return deterministic, structured `analyze_ticket` evidence.
- Post comments only through explicitly requested write-capable tools.

Read tools include `get_trello_card`, `list_trello_cards`, `search_jira_issues`, `get_jira_issue`, `get_azure_work_item`, `search_azure_work_items`, `get_status`, and `analyze_ticket`.

## Credentials and `.env`

Credentials are loaded from `TICKET_ANALYZER_ENV_FILE` when set; otherwise from `<cwd>/.env`. Real environment variables always take precedence over file values and are never overwritten. During setup, each provider is labeled by purpose and the wizard explains the exact source and format before prompting. Trello uses the API key and token from `https://trello.com/app-key`; Jira uses the site hostname, account email, and API token from Atlassian account security; Azure DevOps uses the organization, project, and a PAT with minimum `Work Items: Read` scope (`Work Items: Read & Write` is needed only for comments). Only the following provider variables are needed:

| Provider | Variables |
|---|---|
| Trello | `TRELLO_API_KEY`, `TRELLO_TOKEN` |
| Jira | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Azure DevOps | `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` |

`.env` is project-local and ignored by Git. Use [`.env.example`](.env.example) for placeholder names only. Credentials are not stored in Pi, Claude Code, or Codex configuration. Never commit credentials or paste them into a session transcript.

## Claude Code

Install or update the plugin, restart Claude Code, and run the secure setup CLI from the target project:

```bash
claude plugin marketplace add ticket-analyzer-mcp --source github --repo ocampott/ticket-analyzer-mcp
claude plugin install ticket-analyzer@ticket-analyzer-mcp
npx -y ticket-analyzer-mcp@latest setup
```

For an existing installation, use `claude plugin marketplace update ticket-analyzer-mcp` and `claude plugin update ticket-analyzer@ticket-analyzer-mcp`, then restart Claude Code. The compatibility `/ticket-analyzer:setup` skill directs users to the secure CLI and does not pass secrets to `claude mcp add`.

## OpenAI Codex

Run the setup CLI and select Codex (alone or with other clients). The resulting registration uses only the non-secret absolute env-file path:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@latest
```

Restart Codex after changing the MCP configuration. Full details: [`docs/codex-install.md`](docs/codex-install.md).

## Pi

Run the setup CLI and select Pi (alone or with other clients), or install directly:

```bash
pi install -l npm:ticket-analyzer-mcp
```

The Pi extension starts the bundled no-argument stdio server with the project working directory. It forwards only the ticket credential allowlist and `TICKET_ANALYZER_ENV_FILE`; it does not forward the host environment wholesale. Full details: [`docs/pi-install.md`](docs/pi-install.md).

## Safe workflow

1. Fetch the ticket and relevant evidence.
2. Explore the target codebase and produce a concise plan.
3. Wait for explicit confirmation.
4. Implement only the agreed scope.

A request to analyze or plan never authorizes code changes or ticket comments.

## Requirements and development

- Node.js 18+
- Claude Code, OpenAI Codex, Pi, or another MCP-compatible client

```bash
npm install
npm run build
npm test
```

More documentation:

- [`docs/agent-workflow.md`](docs/agent-workflow.md)
- [`docs/codex-install.md`](docs/codex-install.md)
- [`docs/pi-install.md`](docs/pi-install.md)
- [`CHANGELOG.md`](CHANGELOG.md)
