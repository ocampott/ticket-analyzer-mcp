# ticket-analyzer-mcp

A client-neutral MCP server for reading, searching, and analyzing tickets from **Trello, Jira, and Azure DevOps**. It works with Claude Code, OpenAI Codex, Pi, and other MCP-compatible clients.

## Requirements

- Node.js 18 or newer
- The client CLI you plan to configure: Claude Code, Codex, or Pi
- Provider credentials for the integrations you select (the setup wizard creates or updates the project-local `.env`)

## One-command setup

From the project that should own the credentials, run the published npm package in a TTY:

```bash
npx -y ticket-analyzer-mcp@2.2.1 setup
```

Choose the providers and clients to configure. Setup writes selected credentials to the ignored project-local `.env`, preserves unrelated keys, and prints grouped, non-secret next steps. It does not execute client CLIs, change client configuration, or print secret values. Leave all clients unchecked to configure them later.

Users must install and update the published npm package; setup never uses a checkout or filesystem package path.

## CLI commands

The CLI has no `update` subcommand. The no-argument command starts the MCP server over stdio; `setup` is the only interactive command.

```bash
npx -y ticket-analyzer-mcp@2.2.1 doctor  # provider connectivity diagnostics
npx -y ticket-analyzer-mcp@2.2.1 status  # local-only configuration check
npx -y ticket-analyzer-mcp@2.2.1         # MCP server over stdio
```

`status` never calls a provider. `doctor` may contact providers and reports connection errors without secrets. Setup, doctor, and status load `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence.

## Claude Code

Install the plugin from the GitHub marketplace, run the published npm setup wizard, and restart Claude Code:

```bash
claude plugin marketplace add ocampott/ticket-analyzer-mcp
claude plugin install ticket-analyzer@ticket-analyzer-mcp
npx -y ticket-analyzer-mcp@2.2.1 setup
```

For an existing installation, update the marketplace and plugin, then restart Claude Code:

```bash
claude plugin marketplace update ticket-analyzer-mcp
claude plugin update ticket-analyzer@ticket-analyzer-mcp
```

The setup skill directs users to the secure CLI and never passes provider secrets to Claude configuration.

## OpenAI Codex

Run the published npm setup wizard and select Codex. Register only the non-secret absolute env-file path:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- npx -y ticket-analyzer-mcp@2.2.1
```

The command shape is `codex mcp add <NAME> --env KEY=VALUE -- COMMAND...`; `codex mcp remove <NAME>` removes an existing registration. Do not put provider secrets in Codex configuration or shell history.

Restart Codex after registration or after updating the npm package. There is no documented Codex configuration-update command in this package, so do not rerun setup merely to change a package version when the registration already uses the desired npm spec.

Full details: [`docs/codex-install.md`](docs/codex-install.md).

## Pi

Run the published npm setup wizard and select Pi, or install the published package directly:

```bash
pi install -l npm:ticket-analyzer-mcp
```

A user-global install is also supported:

```bash
pi install npm:ticket-analyzer-mcp
```

Update this MCP package explicitly, then restart or reload Pi:

```bash
pi update npm:ticket-analyzer-mcp
```

`pi update` by itself updates Pi, not this MCP package. A reproducible pinned install uses the published npm package:

```bash
pi install -l npm:ticket-analyzer-mcp@2.2.1
```

Pi project-local scope stores the published npm package for that project; it is not a local checkout. Pi installation, update, and restart commands must continue to use the npm package spec.

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

## Contributor development

These commands are for contributors working on the repository itself, not for user installation or client setup:

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
