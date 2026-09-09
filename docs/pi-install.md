# Install with Pi

The Pi package includes an extension that starts the bundled MCP server directly with Node and exposes the server's discovered tools to Pi.

> **Security:** Pi packages run with full system access. Review this package's extension and skills before installing or enabling it.

## Published package

From the project whose credentials should be used, run setup in a TTY:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

Select Pi alone or with Claude Code and/or OpenAI Codex, then use the exact package path printed by the wizard. Setup writes credentials to the project-local `.env`; it does not modify Pi settings, execute client commands, or print secrets.

For a project-local install:

```bash
pi install -l npm:ticket-analyzer-mcp
```

For a user-global install:

```bash
pi install npm:ticket-analyzer-mcp
```

Project-local packages load after the project is trusted. The extension starts the no-argument MCP stdio server with the project working directory.

## Updates and version pins

Update this package explicitly:

```bash
pi update npm:ticket-analyzer-mcp
```

`pi update` alone updates Pi itself, not this MCP package. An unpinned `npm:ticket-analyzer-mcp` spec is the normal updateable install. A pinned spec such as `npm:ticket-analyzer-mcp@2.2.0` is skipped by package updates; move it with an explicit install of the new version:

```bash
pi install -l npm:ticket-analyzer-mcp@2.2.0
```

For a later release, replace the version in the generated command and run it explicitly:

```bash
pi install -l npm:ticket-analyzer-mcp@NEW_VERSION
```

Replace `NEW_VERSION` with the release you want to use.

Restart or reload Pi after an update if the extension or skills are not visible.

## Local checkout

Build the checkout before registering its local package path:

```bash
cd /absolute/path/to/ticket-analyzer-mcp
npm install
npm run build
cd /absolute/path/to/your-project
pi install -l /absolute/path/to/ticket-analyzer-mcp
```

A local path is loaded without copying. Rebuild after source changes and reload Pi; `pi update npm:ticket-analyzer-mcp` does not update a local checkout. If Pi already lists the path printed by local setup, reload Pi instead of adding it again.

## Environment behavior

The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`. Real environment variables take precedence. The extension forwards only the provider credential allowlist plus the non-secret `TICKET_ANALYZER_ENV_FILE` path; it never forwards the host environment wholesale.

Use [`.env.example`](../.env.example) for placeholder names only. Do not put real credentials in `.pi/settings.json`, a committed shell script, or a session transcript.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

Azure DevOps needs `Work Items: Read`; `Work Items: Read & Write` is needed only for comments.

## Use

After installation, ask Pi naturally or call tools such as `get_azure_work_item`, `search_jira_issues`, `get_status`, and `analyze_ticket`. Read-only tools run directly; comment-writing tools require interactive confirmation.
