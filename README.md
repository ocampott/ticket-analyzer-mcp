# ticket-analyzer-mcp

Client-neutral MCP server for reading, searching, and analyzing Trello, Jira, and Azure DevOps tickets.

[Español](#español) | [English](#english)

## Español

### Instalación central

Desde cualquier proyecto consumidor, instalá una sola versión global para toda la máquina:

```bash
npm install --global ticket-analyzer-mcp@2.2.2
```

Usá el wizard y los comandos publicados desde el proyecto que debe conservar las credenciales:

```bash
ticket-analyzer-mcp setup
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

`setup` guarda las credenciales en el `.env` ignorado del proyecto, conserva las claves existentes y no modifica la configuración del cliente. `status` es local y `doctor` puede consultar los proveedores. Para actualizar la versión central:

```bash
npm update --global ticket-analyzer-mcp
```

Para fijar otra versión central, reinstalala con una versión exacta, por ejemplo `npm install --global ticket-analyzer-mcp@2.2.2`.

### Comparación de alcance

- Sin `--global`: versión aislada por proyecto.
- Con `--global`: una versión central para toda la máquina.

La alternativa aislada es instalar explícitamente en un proyecto: `npm install ticket-analyzer-mcp@2.2.2`. No es la instalación recomendada para usuarios que deben compartir una versión central.

### Clientes

**Claude Code** — instalá el plugin desde el marketplace y reiniciá Claude Code:

```bash
claude plugin marketplace add ocampott/ticket-analyzer-mcp
claude plugin install ticket-analyzer@ticket-analyzer-mcp
claude plugin marketplace update ticket-analyzer-mcp
claude plugin update ticket-analyzer@ticket-analyzer-mcp
```

**Codex** — registrá solamente la ruta no secreta al `.env`; el servidor usa el binario global:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/ruta/absoluta/al/proyecto/.env \
  -- ticket-analyzer-mcp
```

**Pi** — Pi administra su propio paquete publicado; no lo reemplaces con la instalación npm global:

```bash
pi install -l npm:ticket-analyzer-mcp@2.2.2
pi update npm:ticket-analyzer-mcp
```

No uses checkouts ni rutas locales al paquete.

### Credenciales y flujo seguro

Guardá las credenciales en `.env` (ver [`.env.example`](.env.example)): Trello usa `TRELLO_API_KEY` y `TRELLO_TOKEN`; Jira, `JIRA_HOST`, `JIRA_EMAIL` y `JIRA_API_TOKEN`; Azure DevOps, `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT` y `AZURE_DEVOPS_PAT`. `TICKET_ANALYZER_ENV_FILE` puede señalar otro archivo; las variables de entorno reales tienen precedencia. Nunca pongas secretos en la configuración del cliente, el historial o el transcript.

Flujo recomendado: **analizá** el ticket y la evidencia → **pedí un plan** → **confirmá explícitamente** antes de implementar o comentar.

## English

### Central installation

Install one machine-wide version for all projects:

```bash
npm install --global ticket-analyzer-mcp@2.2.2
```

Run setup and the published commands from the project that owns the credentials:

```bash
ticket-analyzer-mcp setup
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

Update the central version with:

```bash
npm update --global ticket-analyzer-mcp
```

For a central version pin, install the exact version again, such as `npm install --global ticket-analyzer-mcp@2.2.2`. The project-local alternative is `npm install ticket-analyzer-mcp@2.2.2`; it affects only that project.

- Without --global: version isolated per project.
- With --global: one central version for the whole machine.

Codex registration uses the global binary:

```bash
codex mcp add ticket-analyzer \
  --env TICKET_ANALYZER_ENV_FILE=/absolute/path/to/project/.env \
  -- ticket-analyzer-mcp
```

Pi remains a Pi-managed published package with an exact version when pinned:

```bash
pi install -l npm:ticket-analyzer-mcp@2.2.2
pi update npm:ticket-analyzer-mcp
```

Claude Code continues to use the marketplace commands above. Keep provider credentials in the project `.env`; `TICKET_ANALYZER_ENV_FILE` may point to another file and real environment variables take precedence.

See the detailed [agent workflow](docs/agent-workflow.md), [Codex](docs/codex-install.md), and [Pi](docs/pi-install.md) guides.
