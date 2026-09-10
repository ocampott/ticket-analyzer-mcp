# Install with Pi

The published Pi package includes an extension that starts the MCP server and exposes the server's discovered tools to Pi.

> **Security:** Pi packages run with full system access. Review this package's extension and skills before installing or enabling it.

## Central npm CLI

The setup, diagnostics, and standalone server CLI use one machine-wide npm version:

```bash
npm install --global ticket-analyzer-mcp@2.3.1
ticket-analyzer-mcp setup
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

Update that central CLI version with:

```bash
npm update --global ticket-analyzer-mcp
```

For a central version pin, install an exact version such as `npm install --global ticket-analyzer-mcp@2.3.1`. The alternative `npm install ticket-analyzer-mcp@2.3.1` is isolated to one project and is not the recommended central policy.

Setup writes credentials to the project-local `.env`; it does not modify Pi settings, execute client commands, or print secrets. The server loads `TICKET_ANALYZER_ENV_FILE` when set, otherwise `<cwd>/.env`; real environment variables take precedence.

To opt in to client configuration after the provider phase, run:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

Normal mode detects available clients, prints one non-secret plan, and asks for one confirmation per selected available client. It executes only confirmed clients, using a limited environment without provider credentials. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. The legacy `ticket-analyzer-mcp setup` remains credential-only. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required.

### What setup can and cannot do for Pi

Pi installation stays a manual step. Setup has no version-pinned contract proving which Pi commands are safe to run and which settings layouts it can preserve, so rather than guessing it reports Pi as blocked with recovery guidance and changes nothing. Run `pi install -l npm:ticket-analyzer-mcp@2.3.1` yourself from the project root, then re-run setup.

What setup does do is read, never write, the project's own `.pi/settings.json`, so it can tell you whether the local package is already there. That inspection is deliberately narrow: it accepts only a pinned settings schema and reports everything else as unknown rather than interpreting it. JSONC or comments, duplicate keys, an unrecognized package collection, an entry whose name disagrees with its `npm:` specification, a duplicated `ticket-analyzer-mcp` entry, and a file above the bounded read size are all unknown. Setup never infers your install state from `pi list` or any other human-readable output, never looks at global or home Pi configuration, and never installs from a checkout or filesystem path.

If your project-local package already matches the expected specification, you can adopt it. Adoption records ownership in the ignored sidecar and does not rewrite `.pi/settings.json`. A tracked `.pi/settings.json` is reported as unknown, because no contract yet proves setup could modify it while preserving every unrelated byte.

Pi has no registration-level environment binding. The extension resolves `<cwd>/.env` at runtime when Pi has not already supplied `TICKET_ANALYZER_ENV_FILE`, which gives the absolute project binding whenever Pi's project context is the project root.

## Pi package

Pi is managed by Pi, not by the npm global CLI. Install the published package with its exact aligned version:

```bash
pi install -l npm:ticket-analyzer-mcp@2.3.1
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
