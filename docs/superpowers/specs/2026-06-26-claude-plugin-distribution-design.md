# pm-mcp → Claude Code Plugin: Diseño de Distribución

**Fecha:** 2026-06-26  
**Estado:** Aprobado

---

## Objetivo

Transformar pm-mcp de un MCP server de instalación manual en un plugin nativo de Claude Code que cualquier usuario de la comunidad pueda instalar con dos comandos.

**Instalación actual (7+ pasos):**
```bash
git clone https://github.com/ocampott/pm-mcp.git
cd pm-mcp && npm install && npm run build
claude mcp add trello -e TRELLO_API_KEY=... -- node /ruta/dist/index.js
claude mcp add jira -e JIRA_HOST=... -- node /ruta/dist/index.js
cp -r .claude/skills/pm ~/.claude/skills/pm
```

**Instalación objetivo (2 pasos):**
```bash
claude plugin install pm-mcp
/pm-setup
```

---

## Arquitectura

### Estructura del repo

```
pm-mcp/
├── .claude-plugin/
│   ├── plugin.json          # Metadata del plugin (name, version, author…)
│   └── marketplace.json     # Registro del marketplace propio
├── skills/
│   └── pm/
│       ├── pm-analize.md       # Movido desde .claude/skills/pm/commands/
│       ├── pm-search-ticket.md
│       ├── pm-update.md
│       └── pm-setup.md         # NUEVO: wizard de credenciales
├── .mcp.json                   # Configura el servidor MCP via npx
├── src/                        # Sin cambios (TypeScript source)
├── dist/                       # Sin cambios (output de tsc, para dev local)
├── package.json                # Agregar bin entry para npm
└── README.md                   # Actualizar instrucciones
```

### Archivos nuevos / modificados

| Archivo | Acción | Descripción |
|---|---|---|
| `.claude-plugin/plugin.json` | Crear | Metadata del plugin |
| `.claude-plugin/marketplace.json` | Crear | Permite que el repo sea un marketplace |
| `.mcp.json` | Crear | Configura `npx pm-mcp@latest` como servidor |
| `skills/pm/pm-setup.md` | Crear | Wizard interactivo de credenciales |
| `skills/pm/pm-analize.md` | Mover | Desde `.claude/skills/pm/commands/` |
| `skills/pm/pm-search-ticket.md` | Mover | Desde `.claude/skills/pm/commands/` |
| `skills/pm/pm-update.md` | Mover | Desde `.claude/skills/pm/commands/` |
| `package.json` | Modificar | Agregar `bin` entry |

---

## Componentes

### 1. `.claude-plugin/plugin.json`

```json
{
  "name": "pm-mcp",
  "description": "Connect Claude Code to Trello and Jira. Fetch tickets, analyze them in the context of your codebase, and get implementation plans.",
  "version": "1.0.0",
  "author": {
    "name": "Tomás Ocampo",
    "email": "tomas@xoolix.com"
  },
  "homepage": "https://github.com/ocampott/pm-mcp",
  "repository": "https://github.com/ocampott/pm-mcp",
  "license": "MIT",
  "keywords": ["jira", "trello", "pm", "project-management", "tickets"]
}
```

### 2. `.claude-plugin/marketplace.json`

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "pm-mcp",
  "description": "PM tools for Claude Code: Trello and Jira integration",
  "owner": {
    "name": "Tomás Ocampo",
    "email": "tomas@xoolix.com"
  },
  "plugins": [
    {
      "name": "pm-mcp",
      "description": "Connect Claude Code to Trello and Jira. Fetch tickets, analyze them in the context of your codebase, and get implementation plans.",
      "version": "1.0.0",
      "source": "./"
    }
  ]
}
```

### 3. `.mcp.json`

```json
{
  "mcpServers": {
    "pm": {
      "command": "npx",
      "args": ["-y", "pm-mcp@latest"]
    }
  }
}
```

Las credenciales NO van en el `.mcp.json` del repo — las gestiona `/pm-setup` por usuario.

### 4. `package.json` — cambios

Agregar `bin` entry para que `npx pm-mcp` funcione:

```json
{
  "bin": {
    "pm-mcp": "dist/index.js"
  }
}
```

El `dist/index.js` generado por tsc no incluye shebang. La solución: un wrapper `bin/pm-mcp.js` con shebang que importa `dist/index.js`:

```js
#!/usr/bin/env node
import "../dist/index.js";
```

El `package.json` apunta a ese wrapper: `"bin": { "pm-mcp": "bin/pm-mcp.js" }`. No se modifica el output de tsc.

### 5. Skill `/pm-setup` (nuevo)

Wizard interactivo que:

1. Pregunta al usuario qué integración configurar: Trello / Jira / ambas
2. Muestra instrucciones para obtener las credenciales (URLs exactas)
3. Pide que el usuario ingrese cada key
4. Corre `claude mcp add pm -e KEY=value... -- npx pm-mcp@latest` para registrar las env vars
5. Verifica la conexión con una llamada liviana (`list_trello_cards` sin parámetros o `search_jira_issues` con JQL mínimo)
6. Confirma éxito o muestra el error con instrucciones de troubleshooting

El skill reemplaza el paso manual de `claude mcp add` con env vars.

### 6. `skills/pm/` — reorganización

Los skills existentes se mueven de `.claude/skills/pm/commands/` a `skills/pm/` en la raíz del repo. El contenido de los archivos no cambia.

El directorio `.claude/skills/pm/` del repo se puede eliminar — Claude Code lo maneja cuando instala el plugin.

---

## Distribución

### Marketplace propio (lanzamiento)

El repo `ocampott/pm-mcp` funciona como su propio marketplace. Usuarios que quieran instalar el plugin:

```bash
claude plugin marketplace add pm --source github --repo ocampott/pm-mcp
claude plugin install pm-mcp
/pm-setup
```

### Marketplace oficial de Anthropic (post-lanzamiento)

Una vez estable, abrir PR a `anthropics/claude-plugins-official` agregando una entrada en su `marketplace.json`. Si se aprueba, la instalación se reduce a:

```bash
claude plugin install pm-mcp
/pm-setup
```

### npm (paralelo)

Publicar `pm-mcp` en npmjs.com con `npm publish --access public`. Esto habilita `npx pm-mcp@latest` que es lo que usa el `.mcp.json`. También permite que usuarios avanzados instalen el servidor directamente sin el plugin.

---

## Flujo completo del usuario final

```
claude plugin install pm-mcp
        │
        ▼
Claude Code clona el repo
Copia skills/ → ~/.claude/skills/pm/
Registra .mcp.json (npx pm-mcp@latest)
        │
        ▼
/pm-setup
        │
        ▼
Wizard: elegir Trello / Jira / ambas
Instrucciones de credenciales
Usuario ingresa keys
claude mcp add pm -e TRELLO_API_KEY=... -e JIRA_HOST=... -- npx pm-mcp@latest
Verificación de conexión
        │
        ▼
Listo. /pm-analize PROJ-123 funciona.
```

---

## Lo que NO cambia

- Todo el código TypeScript en `src/` — sin tocar
- Las 6 herramientas MCP expuestas — sin tocar
- El workflow de análisis en `CLAUDE.md` — sin tocar
- El contenido de los skills pm-analize, pm-search-ticket, pm-update — sin tocar

---

## Consideraciones

### Credenciales y seguridad

- Las API keys nunca van en el repo
- Se guardan en la configuración local de Claude (`~/.claude/`) via `claude mcp add`
- Los usuarios con Trello pero sin Jira (o viceversa) pueden configurar solo lo que usan

### Compatibilidad con instalación actual

Los usuarios que ya tienen pm-mcp instalado manualmente no se ven afectados. El plugin es una segunda forma de instalación, no reemplaza la manual.

### Versioning

El `.mcp.json` usa `pm-mcp@latest` para que los usuarios reciban actualizaciones automáticamente. Si se prefiere estabilidad, se puede versionar explícitamente: `pm-mcp@1.x`.

### pm-update skill

El skill `/pm-update` existente asume instalación manual (git pull + npm build). Necesita actualizarse para el contexto de plugin: detectar si está instalado via plugin y correr `claude plugin update pm-mcp` en ese caso.

---

## Estimación

**M** — Cambios de estructura/configuración sin lógica nueva. La parte más costosa es el skill `/pm-setup` (wizard interactivo) y el proceso de publicación a npm.

| Tarea | Tamaño |
|---|---|
| Crear `.claude-plugin/` y `.mcp.json` | XS |
| Mover/reorganizar skills | XS |
| Agregar `bin` entry + shebang en package.json | S |
| Publicar a npm | S |
| Escribir skill `/pm-setup` | M |
| Actualizar `/pm-update` para detectar plugin | S |
| Actualizar README | S |
| PR al marketplace oficial | S |
