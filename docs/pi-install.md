# Install with Pi

The published Pi package includes an extension that starts the MCP server and exposes the server's discovered tools to Pi.

> **Security:** Pi packages run with full system access. Review this package's extension and skills before installing or enabling it.

## Published package

From the project whose credentials should be used, run the published npm setup wizard in a TTY:

```bash
npx -y ticket-analyzer-mcp@2.2.1 setup
```

Select Pi alone or with Claude Code and/or OpenAI Codex. Setup writes credentials to the project-local `.env`; it does not modify Pi settings, execute client commands, or print secrets.

For a project-local install:

```bash
pi install -l npm:ticket-analyzer-mcp
```

For a user-global install:

```bash
pi install npm:ticket-analyzer-mcp
```

Project-local scope installs the published npm package for the current project. The extension starts the no-argument MCP stdio server with the project working directory.

## Updates and version pins

Update this package explicitly, then restart or reload Pi:

```bash
pi update npm:ticket-analyzer-mcp
```

`pi update` alone updates Pi itself, not this MCP package. An unpinned `npm:ticket-analyzer-mcp` spec is the normal updateable install. A reproducible pinned install uses the published package:

```bash
pi install -l npm:ticket-analyzer-mcp@2.2.1
```

After a later release, replace the version with the published npm version you want to use and run the install explicitly. Pinned specs are not moved by an unpinned package update.

Restart or reload Pi after an update if the extension or skills are not visible.

Do not install this package from a checkout or filesystem path. Pi installation and update commands must use the `npm:` package spec.

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
