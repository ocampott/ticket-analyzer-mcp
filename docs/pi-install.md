# Install with Pi

`ticket-analyzer-mcp@2.0.1` is a Pi package. It includes a small extension that starts the bundled MCP server directly with Node and exposes the server's discovered tools to Pi.

## Install from npm

Install globally for use across projects:

```bash
pi install npm:ticket-analyzer-mcp
```

Install only for the current project:

```bash
pi install -l npm:ticket-analyzer-mcp
```

Project-local packages are loaded only after the project is trusted. Global packages are configured in `~/.pi/agent/settings.json`; project-local packages are configured in `.pi/settings.json`.

## Install from a local checkout

From this repository, use either scope:

```bash
# Global Pi installation
pi install /absolute/path/to/ticket-analyzer-mcp

# Project-local installation
pi install -l /absolute/path/to/ticket-analyzer-mcp
```

The local path is referenced rather than copied, so edits to the checkout are visible to Pi. Use the npm form for a reproducible installed package.

## Configure credentials

Export only the provider variables you need in the shell that launches Pi, or provide them through your secret manager. Do not put real credentials in this repository, `.pi/settings.json`, a committed shell script, or a session transcript.

```bash
export TRELLO_API_KEY="<trello-api-key>"
export TRELLO_TOKEN="<trello-token>"
export TRELLO_DEFAULT_BOARD_ID="<optional-default-board-id>"

export JIRA_HOST="company.atlassian.net"
export JIRA_EMAIL="you@example.com"
export JIRA_API_TOKEN="<jira-api-token>"

export AZURE_DEVOPS_ORG="<organization>"
export AZURE_DEVOPS_PROJECT="<project>"
export AZURE_DEVOPS_PAT="<pat-with-work-items-read>"
```

The Pi extension forwards only these ticket credential variables to the child MCP process. The extension does not invoke a shell or `npx`.

## Update

Update this package while keeping the current scope:

```bash
pi update npm:ticket-analyzer-mcp
```

Restart Pi after updating if the extension or skills are not visible. An unversioned npm spec follows the package's current release; use `npm:ticket-analyzer-mcp@2.0.1` when you need to pin this release.

## Use

After installation, ask Pi naturally or call the exposed tools by their exact MCP names, such as `get_azure_work_item`, `search_jira_issues`, `get_status`, and `analyze_ticket`.

The compatible Pi skills can also be invoked explicitly:

```text
/skill:analyze-ticket 1646
/skill:search jira bugs in the current sprint
/skill:status
```

Read-only tools run directly. Any other discovered MCP tool, including future tools and comment-writing tools, requires an interactive confirmation and is denied in non-UI modes. Approval is per call and is never persisted.

> **Security and trust:** Pi extensions run with full system permissions, and skills can instruct the model to take actions. Review the package source before installing it. Trust project-local packages only in repositories you control.

The `skills/setup` skill is Claude-specific and is not included in the Pi manifest or loaded by Pi. Configure credentials in the shell environment as described above; do not run the Claude `/ticket-analyzer:setup` command from Pi.
