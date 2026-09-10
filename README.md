# ticket-analyzer-mcp

Client-neutral MCP server for reading, searching, and analyzing Trello, Jira, and Azure DevOps tickets.

[Español](#español) | [English](#english)

## Español

### Instalación central

Desde cualquier proyecto consumidor, instalá una sola versión global para toda la máquina:

```bash
npm install --global ticket-analyzer-mcp@3.0.0
```

Usá el wizard y los comandos publicados desde el proyecto que debe conservar las credenciales:

```bash
ticket-analyzer-mcp setup
ticket-analyzer-mcp status
ticket-analyzer-mcp doctor
ticket-analyzer-mcp
```

`setup` planifica proveedores y clientes en una sola pasada: guarda las credenciales en el `.env` ignorado del proyecto, conserva las claves existentes y reconcilia solo los registros que administra. `status` es local y `doctor` puede consultar los proveedores.

### Cómo funciona `setup`

`setup` muestra un plan completo sin secretos y pide **una sola confirmación para todo el plan**. Recién ahí ejecuta, siempre en el mismo orden: el `.env` del proyecto, la regla de ignore, y después Claude Code, Codex y Pi.

```bash
ticket-analyzer-mcp setup
ticket-analyzer-mcp setup --dry-run --providers trello,jira --clients claude,codex,pi
```

`--dry-run` muestra el mismo plan y no escribe nada ni ejecuta ningún proceso hijo. Necesita `--providers` y `--clients` porque nunca pregunta; ambos aceptan valores separados por coma (`trello`, `jira`, `azure` y `claude`, `codex`, `pi`), y cualquiera de los dos se puede usar solo para saltear esa pregunta en una corrida normal. `--configure-clients` se sigue aceptando como alias de compatibilidad, pero ya no cambia nada: la configuración de clientes es parte del flujo normal.

Antes de proponer cada cambio, el manager inspecciona lo que ya existe y lo clasifica como propio, coincidente, ajeno, ausente o desconocido. Adoptar un registro coincidente o reemplazar uno ajeno requiere una decisión explícita, y eliminar algo requiere pedirlo explícitamente. Un estado desconocido nunca habilita una acción: el manager frena y explica cómo recuperarlo a mano.

Si una etapa falla, el manager corta ahí y **no revierte nada automáticamente**. El reporte dice qué quedó aplicado, qué falló y qué no se intentó, para que sepas exactamente en qué estado quedó el proyecto. Un cliente bloqueado no impide que se apliquen los demás.

Las CLI de clientes se ejecutan con un entorno limitado y sin credenciales de proveedores. En Windows, `shell: false` no puede usar shims `.cmd` ni `.bat`: hace falta un ejecutable directo.

#### Claude Code

El administrador solo posee el registro MCP de proyecto `ticket-analyzer` de Claude y le asigna la ruta absoluta del `.env` del proyecto. El marketplace, los plugins y `AGENTS.md` siguen siendo responsabilidad manual y nunca son instalados, eliminados ni registrados por el administrador.

Para actualizar la versión central:

```bash
npm update --global ticket-analyzer-mcp
```

Para fijar otra versión central, reinstalala con una versión exacta, por ejemplo `npm install --global ticket-analyzer-mcp@3.0.0`.

### Comparación de alcance

- Sin `--global`: versión aislada por proyecto.
- Con `--global`: una versión central para toda la máquina.

La alternativa aislada es instalar explícitamente en un proyecto: `npm install ticket-analyzer-mcp@3.0.0`. No es la instalación recomendada para usuarios que deben compartir una versión central.

### Configuración manual

Si un cliente no está disponible, `setup` lo reporta bloqueado o su estado quedó desconocido, seguí la guía detallada correspondiente para recuperarlo o actualizarlo: [Claude Code y flujo de agentes](docs/agent-workflow.md), [Codex](docs/codex-install.md) o [Pi](docs/pi-install.md). `setup` nunca reemplaza un registro existente sin una decisión explícita. No uses checkouts ni rutas locales al paquete.

### Credenciales y flujo seguro

Guardá las credenciales en `.env` (ver [`.env.example`](.env.example)): Trello usa `TRELLO_API_KEY` y `TRELLO_TOKEN`; Jira, `JIRA_HOST`, `JIRA_EMAIL` y `JIRA_API_TOKEN`; Azure DevOps, `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT` y `AZURE_DEVOPS_PAT`. `TICKET_ANALYZER_ENV_FILE` puede señalar otro archivo; las variables de entorno reales tienen precedencia. Nunca pongas secretos en la configuración del cliente, el historial o el transcript.

Flujo recomendado: **analizá** el ticket y la evidencia → **pedí un plan** → **confirmá explícitamente** antes de implementar o comentar.

## English

### Central installation

Install one machine-wide version for all projects:

```bash
npm install --global ticket-analyzer-mcp@3.0.0
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

For a central version pin, install the exact version again, such as `npm install --global ticket-analyzer-mcp@3.0.0`. The project-local alternative is `npm install ticket-analyzer-mcp@3.0.0`; it affects only that project.

- Without --global: version isolated per project.
- With --global: one central version for the whole machine.

### How `setup` works

`setup` plans providers and clients in a single pass. It prints a complete, secret-free plan and asks for **one confirmation covering the whole plan**. Only then does it execute, always in the same order: the project `.env`, the ignore rule, then Claude Code, Codex, and Pi.

```bash
ticket-analyzer-mcp setup
ticket-analyzer-mcp setup --dry-run --providers trello,jira --clients claude,codex,pi
```

`--dry-run` prints the same plan and writes nothing, spawning no child process. It needs `--providers` and `--clients` because it never prompts; both accept comma-separated values (`trello`, `jira`, `azure` and `claude`, `codex`, `pi`), and either flag can also be used on its own to skip that prompt in a normal run. `--configure-clients` is still accepted as a compatibility alias, but it no longer changes anything: client configuration is part of the normal flow.

Before proposing a change, the manager inspects what already exists and classifies it as owned, matching, foreign, absent, or unknown. Adopting a matching registration or replacing a foreign one takes an explicit decision, and removing anything has to be asked for explicitly. An unknown state is never permission to act: the manager stops and explains how to recover by hand.

If a stage fails, the manager stops there and **rolls nothing back automatically**. The report names what was applied, what failed, and what was never attempted, so the project's state is never a guess. A blocked client does not prevent the others from being applied.

Client CLIs run with a limited environment and no provider credentials. On Windows, `shell: false` cannot use `.cmd` or `.bat` shims; a direct executable is required. Keep provider credentials in the project `.env`; `TICKET_ANALYZER_ENV_FILE` may point to another file and real environment variables take precedence.

#### Claude Code

The manager owns only Claude's `ticket-analyzer` project MCP registration and binds it to the project's absolute `.env` path. Marketplace and plugin actions, plus `AGENTS.md`, remain manual responsibilities and are never installed, removed, or recorded by the manager.

### Manual recovery

If a client is unavailable, `setup` reports it as blocked, or its state came back unknown, use the relevant detailed guide to recover or update it: [Claude Code and agent workflow](docs/agent-workflow.md), [Codex](docs/codex-install.md), or [Pi](docs/pi-install.md). `setup` never replaces an existing registration without an explicit decision. Do not use checkouts or local package paths.
