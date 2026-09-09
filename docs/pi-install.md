# Install with Pi

The published Pi package includes an extension that starts the MCP server and exposes the server's discovered tools to Pi.

> **Security:** Pi packages run with full system access. Review this package's extension and skills before installing or enabling it.

## Central npm CLI

The setup, diagnostics, and standalone server CLI use one machine-wide npm version:

```bash
npm install --global ticket-analyzer-mcp@2.3.0
ticket-analyzer-mcp setup
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

Update that central CLI version with:

```bash
npm update --global ticket-analyzer-mcp
```

For a central version pin, install an exact version such as `npm install --global ticket-analyzer-mcp@2.3.0`. The alternative `npm install ticket-analyzer-mcp@2.3.0` is isolated to one project and is not the recommended central policy.

Setup writes credentials to the project-local `.env`; it does not modify Pi settings, execute client commands, or print secrets. The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence.

To opt in to client configuration after the provider phase, run:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

Normal mode detects available clients, prints one non-secret plan, and asks for one confirmation per selected available client. It executes only confirmed clients, using a limited environment without provider credentials. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. The legacy `ticket-analyzer-mcp setup` remains credential-only. The wizard does not inspect, replace, or remove existing Pi registrations; update them manually when needed and restart or reload Pi after configuration or updates. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

## Pi package

Pi is managed by Pi, not by the npm global CLI. Install the published package with its exact aligned version:

```bash
pi install -l npm:ticket-analyzer-mcp@2.3.0
```

Update the Pi package separately, then restart or reload Pi:

```bash
pi update npm:ticket-analyzer-mcp
```

Pi installation and update commands must use the published `npm:` package spec. Do not install this package from a checkout or filesystem path.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Azure DevOps needs `Work Items: Read`; `Work Items: Read & Write` is needed only for comments. Do not put real credentials in `.pi/settings.json`, a committed shell script, or a session transcript.

## Use

After installation, ask Pi naturally or call tools such as `get_azure_work_item`, `search_jira_issues`, `get_status`, and `analyze_ticket`. Read-only tools run directly; comment-writing tools require interactive confirmation.
