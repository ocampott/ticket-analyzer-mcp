# ticket-analyzer-mcp

A client-neutral MCP server for reading, searching, and analyzing tickets from **Trello, Jira, and Azure DevOps**. It works with Claude Code, OpenAI Codex, Pi, and other MCP-compatible clients.

## Requirements

- Node.js 18 or newer
- The client CLI you plan to configure: Claude Code, Codex, or Pi
- Provider credentials for the integrations you select (the setup wizard creates or updates the project-local `.env`)

## One-command setup

From the project that should own the credentials, run the interactive setup wizard in a TTY:

```bash
npx -y ticket-analyzer-mcp@latest setup
```

Choose the providers and clients to configure. Setup writes selected credentials to the ignored project-local `.env`, preserves unrelated keys, and prints grouped, non-secret next steps. It does not execute client CLIs, change client configuration, or print secret values. Leave all clients unchecked to configure them later.

For a local checkout, install the build prerequisites and build before running setup:

```bash
cd /absolute/path/to/ticket-analyzer-mcp
npm install
npm run build
cd /absolute/path/to/your-project
node /absolute/path/to/ticket-analyzer-mcp/bin/pm-mcp.js setup
```

The local wizard detects that it is running from a checkout and prints a local Pi package path and a local Node command for Codex. Use the exact path it prints; if Pi already lists that path, reload Pi. A package installed under `node_modules` is treated as a published package and prints the reproducible `2.2.0` npm examples instead.

## CLI commands

The CLI has no `update` subcommand. The no-argument command starts the MCP server over stdio; `setup` is the only interactive command.

```bash
npx -y ticket-analyzer-mcp@latest doctor  # provider connectivity diagnostics
npx -y ticket-analyzer-mcp@latest status  # local-only configuration check
npx -y ticket-analyzer-mcp@latest         # MCP server over stdio
```

`status` never calls a provider. `doctor` may contact providers and reports connection errors without secrets. Setup, doctor, and status load `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence.

## Claude Code

Install the plugin from the GitHub marketplace, run setup, and restart Claude Code:

```bash
claude plugin marketplace add ocampott/ticket-analyzer-mcp
claude plugin install ticket-analyzer@ticket-analyzer-mcp
npx -y ticket-analyzer-mcp@latest setup
```

For an existing installation, update the marketplace and plugin, then restart Claude Code:

```bash
claude plugin marketplace update ticket-analyzer-mcp
claude plugin update ticket-analyzer@ticket-analyzer-mcp
```

The setup skill directs users to the secure CLI and never passes provider secrets to Claude configuration.

## OpenAI Codex

Run setup and select Codex. Register only the non-secret absolute env-file path:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@latest
```

The command shape is `codex mcp add <NAME> --env KEY=VALUE -- COMMAND...`; `codex mcp remove <NAME>` removes an existing registration. Do not put provider secrets in Codex configuration or shell history.

The `@latest` command resolves the current npm package when a new MCP process starts. After changing registration or updating the package, restart Codex. There is no documented Codex configuration-update command in this package, so do not rerun setup merely to change a package version when the registration already uses `@latest`.

Full details: [`docs/codex-install.md`](docs/codex-install.md).

## Pi

Run setup and select Pi, or install the project-local package directly:

```bash
pi install -l npm:ticket-analyzer-mcp
```

A user-global install is also supported:

```bash
pi install npm:ticket-analyzer-mcp
```

Update this MCP package explicitly:

```bash
pi update npm:ticket-analyzer-mcp
```

`pi update` by itself updates Pi, not this MCP package. The default unpinned npm spec allows package updates to move to the latest release. A reproducible pinned install uses `npm:ticket-analyzer-mcp@2.2.0`, but pinned specs are skipped by package updates; move the pin with an explicit install of the new version:

```bash
pi install -l npm:ticket-analyzer-mcp@NEW_VERSION
```

Replace `NEW_VERSION` with the release you want to use.

For a local checkout, build first and register its absolute package path:

```bash
cd /absolute/path/to/ticket-analyzer-mcp
npm install
npm run build
cd /absolute/path/to/your-project
pi install -l /absolute/path/to/ticket-analyzer-mcp
```

A local path must be rebuilt after source changes and then reloaded in Pi; `pi update npm:ticket-analyzer-mcp` does not update a local checkout. Pi extensions run with full system access, so review the package source before enabling it.

The extension starts the bundled no-argument stdio server with the project working directory and forwards only the ticket credential allowlist plus `TICKET_ANALYZER_ENV_FILE`.

Full details: [`docs/pi-install.md`](docs/pi-install.md).

## Credentials and `.env`

Only these provider variables are required:

| Provider | Variables |
|---|---|
| Trello | `TRELLO_API_KEY`, `TRELLO_TOKEN` |
| Jira | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Azure DevOps | `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT` |

Use [`.env.example`](.env.example) for placeholder names only. Credentials are never stored in Pi, Claude Code, or Codex configuration. Never commit credentials or paste them into a session transcript.

## Safe workflow

1. Fetch the ticket and relevant evidence.
2. Explore the target codebase and produce a concise plan.
3. Wait for explicit confirmation.
4. Implement only the agreed scope.

A request to analyze or plan never authorizes code changes or ticket comments.

## Development

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
