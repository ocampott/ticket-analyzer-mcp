# ticket-analyzer-mcp

A client-neutral MCP server that connects Trello, Jira, and Azure DevOps to consuming coding agents. The agent fetches ticket context, explores the target codebase, and produces an implementation plan before any code is changed.

Version **2.0.0** adds the distribution layer for Claude Code, OpenAI Codex, and Pi. The MCP core remains standard and client-neutral; client-specific adapters live outside the core implementation.

## What it provides

The server exposes tools for:

- Fetching complete Trello cards, Jira issues, and Azure DevOps work-item trees.
- Searching Trello, Jira, and Azure DevOps.
- Posting comments when explicitly requested and credentials permit it.
- Checking integration status.
- Returning deterministic structured `analyze_ticket` evidence. The consuming agent, not this tool, owns the final interpretation and implementation plan.

Azure work-item reads include child Tasks, Bugs, and Stories, plus descriptions, acceptance criteria, comments, and images. Tree depth and node count are bounded and truncation is reported instead of hidden.

## Claude Code

### Install from the GitHub marketplace

```bash
claude plugin marketplace add ticket-analyzer-mcp --source github --repo ocampott/ticket-analyzer-mcp
claude plugin install ticket-analyzer@ticket-analyzer-mcp
```

Configure credentials with the compatibility wizard:

```text
/ticket-analyzer:setup
```

The wizard supports Trello, Jira, and Azure DevOps. Credentials are stored in Claude's local MCP configuration, not in this repository.

### Natural-language use

The primary interface is natural language. For example:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
Analyze Jira issue PROJ-123 in the context of this repository.
Understand Trello card abc123 before we code it.
```

The Claude model-invoked skill recognizes these requests. The existing slash commands remain compatibility aliases:

```text
/ticket-analyzer:analize 1646
/ticket-analyzer:search jira bugs in the current sprint
/ticket-analyzer:status
```

The workflow is safe by default: analyze and plan first, then wait for explicit confirmation before editing code or posting comments. See [`AGENTS.md`](AGENTS.md) and [`docs/agent-workflow.md`](docs/agent-workflow.md).

### Update Claude

Refresh the marketplace metadata and update the installed plugin:

```bash
claude plugin marketplace update ticket-analyzer-mcp
claude plugin update ticket-analyzer@ticket-analyzer-mcp
```

Restart Claude Code if the updated MCP server or skills are not visible. Keep the plugin version and server/instruction adapter versions aligned at `2.0.0`.

## OpenAI Codex

Register the server with the npm package:

```bash
codex mcp add ticket-analyzer \
  --env AZURE_DEVOPS_ORG=... \
  --env AZURE_DEVOPS_PROJECT=... \
  --env AZURE_DEVOPS_PAT=... \
  -- npx -y ticket-analyzer-mcp@latest
```

Use only the variables for the integrations you need. Full instructions and the merge-safe instruction template are in [`docs/codex-install.md`](docs/codex-install.md) and [`integrations/codex/`](integrations/codex/). Merge `integrations/codex/AGENTS.template.md` into the target project's existing `AGENTS.md`; do not overwrite existing instructions.

Ask Codex naturally:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
```

The `@latest` server entry refreshes when Codex launches or restarts the MCP process. Re-merge the instruction template when its version changes. The server and instruction adapter must stay aligned.

## Pi

Install the npm package globally for Pi, or scope it to the current project:

```bash
# Global install (available across projects)
pi install npm:ticket-analyzer-mcp

# Or, install only for the current project
pi install -l npm:ticket-analyzer-mcp
```

Set the ticket credential environment variables before launching Pi (never commit real credentials):

```bash
export AZURE_DEVOPS_ORG=...
export AZURE_DEVOPS_PROJECT=...
export AZURE_DEVOPS_PAT=...
pi
```

Ask Pi naturally, or use the exact exposed MCP tool names:

```text
Analyze Azure DevOps ticket 1646 and make an implementation plan.
get_status
analyze_ticket
```

The package also provides `/skill:analyze-ticket`, `/skill:search`, and `/skill:status`. Read-only tools run without approval; comment-writing and future tools require an interactive confirmation and are denied in non-UI modes. Approval is per call and is never persisted. The bundled extension launches `dist/index.js` directly with Node, without a shell or `npx`, and forwards only ticket credential variables.

Update the package and restart Pi if needed:

```bash
pi update npm:ticket-analyzer-mcp
```

For local installs, credential setup, project-local versus global scope, and trust/security guidance, see [`docs/pi-install.md`](docs/pi-install.md). The Claude-specific `skills/setup` skill is not loaded by Pi.

## Credentials

- **Trello:** create an API key and token at <https://trello.com/app-key>. Set `TRELLO_API_KEY` and `TRELLO_TOKEN`.
- **Jira:** create an API token at <https://id.atlassian.com/manage-profile/security/api-tokens>. Set `JIRA_HOST` (for example `company.atlassian.net`), `JIRA_EMAIL`, and `JIRA_API_TOKEN`.
- **Azure DevOps:** create a PAT at `https://dev.azure.com/{ORG}/_usersSettings/tokens` with **Work Items: Read**. Add write scope only when comments are required. Set `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, and `AZURE_DEVOPS_PAT`.

Never commit credentials. Azure may return HTTP 203 with a sign-in page for an expired or wrongly scoped PAT; regenerate it with **Work Items (Read)**.

## Requirements

- Node.js 18+
- Claude Code, OpenAI Codex, or Pi

## Maintainer release steps (not run by this change)

The `2.0.0` release is prepared but not published. After human approval, run these checks from a clean review state:

```bash
npm run build
npm test
npm pack --dry-run
```

Then choose one publication path. The existing GitHub workflow publishes on a version tag:

```bash
git add \
  AGENTS.md CHANGELOG.md CLAUDE.md README.md \
  .claude-plugin \
  docs/agent-workflow.md docs/codex-install.md docs/pi-install.md \
  extensions integrations \
  package.json package-lock.json run.sh \
  skills \
  src/analysis src/azure.ts src/azure.test.ts src/index.ts
git commit -m "release: v2.0.0"
git tag v2.0.0
git push origin main --tags
```

Or publish directly instead of using the tag-triggered workflow:

```bash
npm publish --access public
```

These commit, tag, push, and publish commands require maintainer action and were not run here.
