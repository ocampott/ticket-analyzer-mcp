# Install with OpenAI Codex

## Requirements

Use Node.js 18 or newer. Setup requires a TTY and writes credentials only to the target project's ignored `.env`.

## Central npm CLI

Install one machine-wide package version:

```bash
npm install --global ticket-analyzer-mcp@3.0.0
```

From the project that should own the credentials, run the published setup wizard:

```bash
ticket-analyzer-mcp setup
```

Select Codex and the required providers. Setup prints only the absolute `.env` path, never provider secrets, and does not execute client CLIs or change client settings.

To opt in to client configuration after the provider phase, run:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --dry-run --providers trello,jira --clients codex
```

Normal mode detects available clients, prints one non-secret plan, and asks for one confirmation per selected available client. It executes only confirmed clients, using a limited environment without provider credentials. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. The legacy `ticket-analyzer-mcp setup` remains credential-only. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

### Codex project trust is your responsibility

Setup never reads, creates, or changes any Codex trust setting, and never inspects `$CODEX_HOME` or any file in your home directory. Mark the project as trusted from Codex itself before selecting the Codex integration; setup asks you to confirm that you did, and treats your answer as an assertion it does not verify. Without that confirmation Codex is reported as blocked and nothing is written, while any other selected operation keeps its own place in the plan.

### What setup owns in `.codex/config.toml`

Setup reconciles exactly one entry: the `[mcp_servers.ticket-analyzer]` table in the project's own `.codex/config.toml`, together with its `[mcp_servers.ticket-analyzer.env]` subtable, bound to the absolute project `.env` path. Every byte outside that entry is preserved, and the exact textual diff appears in the plan before you confirm it.

An entry that already matches must be adopted explicitly, and a conflicting one must be replaced explicitly. Replacing rewrites the targeted entry from its canonical form, so comments and formatting inside that entry are discarded. Whenever the entry cannot be targeted without ambiguity — a duplicate table, an array of tables, a malformed header, an unterminated or multiline value, or an `.env` subtable that is not adjacent to its table — setup reports Codex as blocked and changes nothing, leaving the file for you to reconcile by hand. `AGENTS.md` is never created, merged, or modified.

Register the global server binary with Codex:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- ticket-analyzer-mcp
```

This uses only the non-secret `TICKET_ANALYZER_ENV_FILE` setting. `codex mcp remove ticket-analyzer` removes the registration when needed. Restart Codex after changing the registration or updating the package.

Update the central version with `npm update --global ticket-analyzer-mcp`. For a central pin, install an exact version such as `npm install --global ticket-analyzer-mcp@3.0.0`. The project-local alternative, `npm install ticket-analyzer-mcp@3.0.0`, is isolated to that project and is not the recommended central policy.

Do not replace the global command with a checkout, filesystem package path, or direct Node entrypoint.

## Provider fields

- Trello: `TRELLO_API_KEY`, `TRELLO_TOKEN`
- Jira: `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- Azure DevOps: `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`

The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence. Do not put provider secrets in Codex configuration or shell history.

## Merge the instructions

Merge [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md) into the target project's existing `AGENTS.md`; preserve local instructions and headings. Do not overwrite local guidance.

## Updates and diagnostics

Restart Codex after updating the package. Use these commands from the project whose `.env` should be checked:

```bash
npm update --global ticket-analyzer-mcp
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

`status` is local-only. `doctor` may contact providers and reports connection errors without secrets. The no-argument command is the MCP stdio server.
