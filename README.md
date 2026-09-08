# ticket-analyzer-mcp

A client-neutral MCP server for reading, searching, and analyzing tickets from **Trello, Jira, and Azure DevOps**. It works with Claude Code, OpenAI Codex, Pi, and other MCP-compatible clients.

The server does not embed an LLM. It returns ticket evidence; the consuming agent explores the codebase, creates the plan, and asks for confirmation before changing code.

## What it provides

- Fetch complete Trello cards, Jira issues, and Azure DevOps work-item trees.
- Search Trello, Jira, and Azure DevOps.
- Include descriptions, comments, acceptance criteria, attachments, and Azure child work items.
- Return deterministic, structured `analyze_ticket` evidence.
- Post comments only through explicitly requested write-capable tools.
- Keep credentials in the client environment; never store them in the repository.

Read tools include:

```text
get_trello_card       list_trello_cards       search_jira_issues
get_jira_issue        get_azure_work_item    search_azure_work_items
get_status            analyze_ticket
```

Write tools:

```text
add_trello_comment    add_jira_comment       add_azure_comment
```

## Claude Code

### Install

```bash
claude plugin marketplace add ticket-analyzer-mcp \
  --source github \
  --repo ocampott/ticket-analyzer-mcp

claude plugin install ticket-analyzer@ticket-analyzer-mcp
```

Configure credentials inside Claude Code:

```text
/ticket-analyzer:setup
```

Then ask naturally:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
Analyze Jira issue PROJ-123 in the context of this repository.
Understand Trello card abc123 before we code it.
```

The existing slash commands remain available as compatibility shortcuts:

```text
/ticket-analyzer:analize 1646
/ticket-analyzer:search jira bugs in the current sprint
/ticket-analyzer:status
```

### Update

```bash
claude plugin marketplace update ticket-analyzer-mcp
claude plugin update ticket-analyzer@ticket-analyzer-mcp
```

Restart Claude Code if the updated server or skills are not visible.

## OpenAI Codex

Register the npm package with the credentials for the integrations you use:

```bash
codex mcp add ticket-analyzer \
  --env AZURE_DEVOPS_ORG=... \
  --env AZURE_DEVOPS_PROJECT=... \
  --env AZURE_DEVOPS_PAT=... \
  -- npx -y ticket-analyzer-mcp@latest
```

Merge [`integrations/codex/AGENTS.template.md`](integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`. Do not overwrite local instructions.

Restart Codex after changing the MCP configuration. Full setup details: [`docs/codex-install.md`](docs/codex-install.md).

## Pi

Install the npm package globally or only for the current project:

```bash
pi install npm:ticket-analyzer-mcp
# or:
pi install -l npm:ticket-analyzer-mcp
```

Set credentials before starting Pi:

```bash
export AZURE_DEVOPS_ORG="..."
export AZURE_DEVOPS_PROJECT="..."
export AZURE_DEVOPS_PAT="..."
pi
```

Pi exposes the MCP tools directly. Read-only tools run without confirmation; comment-writing and future unknown tools require an interactive confirmation and are denied in non-UI modes.

Update Pi packages with:

```bash
pi update npm:ticket-analyzer-mcp
```

Full setup details: [`docs/pi-install.md`](docs/pi-install.md).

## Credentials

Set only the variables for the providers you use:

| Provider | Variables |
|---|---|
| Trello | `TRELLO_API_KEY`, `TRELLO_TOKEN` |
| Jira | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Azure DevOps | `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` |

- Trello credentials: <https://trello.com/app-key>
- Jira API tokens: <https://id.atlassian.com/manage-profile/security/api-tokens>
- Azure PATs: `https://dev.azure.com/{ORG}/_usersSettings/tokens` with **Work Items: Read**

Never commit credentials or paste them into a session transcript.

## Safe workflow

1. Fetch the ticket and its relevant attachments.
2. Explore the target codebase and produce a concise plan.
3. Wait for explicit confirmation.
4. Implement only the agreed scope.

A request to analyze or plan never authorizes code changes or ticket comments.

## Install the server directly

MCP-compatible clients can launch the server with:

```bash
npx -y ticket-analyzer-mcp@latest
```

Pin a release when reproducibility matters:

```bash
npx -y ticket-analyzer-mcp@2.0.1
```

## Requirements

- Node.js 18+
- Claude Code, OpenAI Codex, Pi, or another MCP-compatible client

## Development

```bash
npm install
npm run build
npm test
```

More documentation:

- [`AGENTS.md`](AGENTS.md) — canonical agent workflow
- [`docs/agent-workflow.md`](docs/agent-workflow.md) — shared workflow details
- [`docs/codex-install.md`](docs/codex-install.md) — Codex setup
- [`docs/pi-install.md`](docs/pi-install.md) — Pi setup
- [`CHANGELOG.md`](CHANGELOG.md) — release history

GitHub: <https://github.com/ocampott/ticket-analyzer-mcp>
