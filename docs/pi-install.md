# Install with Pi

The Pi package includes an extension that starts the bundled MCP server directly with Node and exposes the server's discovered tools to Pi.

## One-command setup

After publishing 2.1.0, from the project whose credentials should be used:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

For local development before 2.1.0 is published, run setup from the checkout instead:

```bash
node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup
```

Select Pi alone or with Claude Code and/or OpenAI Codex, then use the exact local package path printed by the wizard. If Pi already lists that path, reload Pi instead. After publishing, use the npm command below.

Use the TTY checkbox multi-select to choose Trello cards, Jira issues, and/or Azure DevOps work items, then select any client combination. Leave all clients unchecked to configure later. Selecting no providers leaves ticket integrations unavailable until the required values are added to `.env` or setup is rerun. Setup prints one grouped, non-secret next step for every selected client; it does not execute Pi or other client CLIs or change their settings. For provider prompts, Trello uses the API key and token from `https://trello.com/app-key`, Jira uses the site hostname, account email, and Atlassian API token, and Azure DevOps uses the organization, project, and a PAT with minimum `Work Items: Read` scope. `Work Items: Read & Write` is needed only for comments. The Pi next step is:

```bash
pi install -l npm:ticket-analyzer-mcp
```

The setup CLI writes credentials to the project-local `.env`; it does not modify Pi settings, execute client commands, or print secrets. If no client is selected, it explicitly reports that credentials are ready locally but no agent client has been configured yet. The extension starts the no-argument MCP stdio command automatically after installation.

## Advanced environment behavior

The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`. Real environment variables take precedence over file values. The extension forwards only the provider credential allowlist plus the non-secret `TICKET_ANALYZER_ENV_FILE` path; it never forwards all host environment variables.

You can also install globally:

```bash
pi install npm:ticket-analyzer-mcp
```

Project-local packages are loaded only after the project is trusted. Do not put real credentials in `.pi/settings.json`, a committed shell script, or a session transcript.

## Update

```bash
pi update npm:ticket-analyzer-mcp
```

Restart Pi after updating if the extension or skills are not visible.

## Use

After installation, ask Pi naturally or call tools such as `get_azure_work_item`, `search_jira_issues`, `get_status`, and `analyze_ticket`. Read-only tools run directly; comment-writing tools require interactive confirmation.
