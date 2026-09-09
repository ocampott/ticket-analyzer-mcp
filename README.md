# ticket-analyzer-mcp

Client-neutral MCP server for reading, searching, and analyzing Trello, Jira, and Azure DevOps tickets.

[Español](#español) | [English](#english)

## Español

### Instalación central

Desde cualquier proyecto consumidor, instalá una sola versión global para toda la máquina:

```bash
npm install --global ticket-analyzer-mcp@2.3.1
```

Usá el wizard y los comandos publicados desde el proyecto que debe conservar las credenciales:

```bash
ticket-analyzer-mcp setup
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

`setup` guarda las credenciales en el `.env` ignorado del proyecto, conserva las claves existentes y no modifica la configuración del cliente. `status` es local y `doctor` puede consultar los proveedores.

### Configuración opt-in de clientes

Después de la fase de credenciales, usá este wizard como método principal para configurar solo los clientes que elijas:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

El modo normal detecta Claude Code, Codex y Pi en `PATH`, muestra un plan no secreto y pide una confirmación por cada cliente disponible seleccionado. Las CLI se ejecutan con un entorno limitado y sin credenciales de proveedores. `--dry-run` muestra el mismo plan, no pide confirmaciones ni ejecuta procesos de clientes; puede escribir `.env` si seleccionás proveedores. El `setup` legado no detecta ni configura clientes. El wizard no inspecciona, reemplaza ni elimina registros existentes: actualizá manualmente cuando corresponda y reiniciá el cliente después de configurar o actualizarlo.

Para actualizar la versión central:

```bash
npm update --global ticket-analyzer-mcp
```

Para fijar otra versión central, reinstalala con una versión exacta, por ejemplo `npm install --global ticket-analyzer-mcp@2.3.1`.

### Comparación de alcance

- Sin `--global`: versión aislada por proyecto.
- Con `--global`: una versión central para toda la máquina.

La alternativa aislada es instalar explícitamente en un proyecto: `npm install ticket-analyzer-mcp@2.3.1`. No es la instalación recomendada para usuarios que deben compartir una versión central.

### Configuración manual

Si un cliente no está disponible, rechazaste su configuración en el wizard o ya tiene un registro, seguí la guía detallada correspondiente para recuperarlo o actualizarlo: [Claude Code y flujo de agentes](docs/agent-workflow.md), [Codex](docs/codex-install.md) o [Pi](docs/pi-install.md). El wizard no reemplaza los registros existentes. No uses checkouts ni rutas locales al paquete.

### Credenciales y flujo seguro

Guardá las credenciales en `.env` (ver [`.env.example`](.env.example)): Trello usa `TRELLO_API_KEY` y `TRELLO_TOKEN`; Jira, `JIRA_HOST`, `JIRA_EMAIL` y `JIRA_API_TOKEN`; Azure DevOps, `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT` y `AZURE_DEVOPS_PAT`. `TICKET_ANALYZER_ENV_FILE` puede señalar otro archivo; las variables de entorno reales tienen precedencia. Nunca pongas secretos en la configuración del cliente, el historial o el transcript.

Flujo recomendado: **analizá** el ticket y la evidencia → **pedí un plan** → **confirmá explícitamente** antes de implementar o comentar.

## English

### Central installation

Install one machine-wide version for all projects:

```bash
npm install --global ticket-analyzer-mcp@2.3.1
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

For a central version pin, install the exact version again, such as `npm install --global ticket-analyzer-mcp@2.3.1`. The project-local alternative is `npm install ticket-analyzer-mcp@2.3.1`; it affects only that project.

- Without --global: version isolated per project.
- With --global: one central version for the whole machine.

### Opt-in client configuration wizard

Use this wizard as the primary client configuration method to detect available clients and configure only the selected clients after one confirmation per available client:

```bash
ticket-analyzer-mcp setup --configure-clients
ticket-analyzer-mcp setup --configure-clients --dry-run
```

Normal mode detects available clients, prints a non-secret plan, and executes only confirmed commands. Client CLIs run with a limited environment and no provider credentials. `--dry-run` prints the same plan without confirmations or child processes; it may write `.env` when providers are selected. The legacy `ticket-analyzer-mcp setup` remains credential-only and never detects or configures clients. The wizard does not inspect, replace, or remove existing registrations; update them manually when needed and restart the client after configuration or updates. Keep provider credentials in the project `.env`; `TICKET_ANALYZER_ENV_FILE` may point to another file and real environment variables take precedence.

### Manual recovery

If a client is unavailable, you declined its wizard configuration, or it is already registered, use the relevant detailed guide to recover or update it: [Claude Code and agent workflow](docs/agent-workflow.md), [Codex](docs/codex-install.md), or [Pi](docs/pi-install.md). The wizard does not replace existing registrations. Do not use checkouts or local package paths.
