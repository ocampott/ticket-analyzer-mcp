# Plan: Feature 001 — Claude Code Plugin Distribution

## 1. Domain Analysis

| Domain | Scope | Size |
|--------|-------|------|
| Plugin structure | Move `.claude-plugin/` to root; add `skills/pm/` at root | SMALL |
| npm publish | Add `bin/`, `files` field; shebang wrapper | SMALL |
| Skills | Move 3 existing skills; create `/pm-setup` | MEDIUM |
| CI/CD | GitHub Actions: ci.yml + publish.yml | SMALL |

**Overall: MEDIUM**

## 2. Current State

| Item | Current | Target |
|------|---------|--------|
| Plugin manifest | `.claude/skills/pm/.claude-plugin/plugin.json` | `.claude-plugin/plugin.json` (root) |
| Skills dir | `.claude/skills/pm/commands/` | `skills/pm/commands/` (root) |
| MCP server bin | none | `bin/pm-mcp.js` |
| npm files field | absent; `dist/` in .gitignore | `["dist/", "bin/", "skills/", ".claude-plugin/", ".mcp.json"]` |
| .mcp.json | none | root (template, no credentials) |
| CI/CD | none | `.github/workflows/ci.yml` + `publish.yml` |
| /pm-setup skill | none | `skills/pm/commands/pm-setup.md` |

## 3. Proposed Design

**File tree (additions/moves):**
```
pm-mcp/
├── .claude-plugin/
│   └── plugin.json          ← MOVER desde .claude/skills/pm/.claude-plugin/ + bump v1.2.0
├── .mcp.json                ← CREAR
├── bin/
│   └── pm-mcp.js            ← CREAR
├── skills/
│   └── pm/
│       └── commands/
│           ├── pm-analize.md         ← MOVER
│           ├── pm-search-ticket.md   ← MOVER
│           ├── pm-update.md          ← MOVER
│           └── pm-setup.md           ← CREAR
└── .github/
    └── workflows/
        ├── ci.yml            ← CREAR
        └── publish.yml       ← CREAR
```

**`.mcp.json`** (template — sin credenciales; `/pm-setup` las inyecta vía `claude mcp add`):
```json
{
  "mcpServers": {
    "pm-mcp": {
      "command": "node",
      "args": ["bin/pm-mcp.js"],
      "env": {
        "TRELLO_API_KEY": "",
        "TRELLO_TOKEN": "",
        "JIRA_BASE_URL": "",
        "JIRA_EMAIL": "",
        "JIRA_API_TOKEN": ""
      }
    }
  }
}
```

**`.claude-plugin/plugin.json`:**
```json
{
  "$schema": "https://anthropic.com/claude-code/plugin.schema.json",
  "name": "pm",
  "version": "1.2.0",
  "description": "PM tools for analyzing and searching Trello cards and Jira issues inside Claude Code",
  "author": { "name": "ocampott" },
  "mcp": ".mcp.json"
}
```

**`package.json` delta** (solo campos que cambian):
```json
{
  "version": "1.2.0",
  "bin": { "pm-mcp": "bin/pm-mcp.js" },
  "files": ["dist/", "bin/", "skills/", ".claude-plugin/", ".mcp.json"],
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

**`bin/pm-mcp.js`** (shebang ESM wrapper):
```js
#!/usr/bin/env node
import "../dist/index.js";
```

**`.github/workflows/` estructura:**
- `ci.yml`: trigger `push` + `pull_request` → `npm ci` → `npm run build` → `npm test`
- `publish.yml`: trigger tag `v*` → `npm ci` → `npm run build` → `npm publish --access public` (secret: `NPM_TOKEN`)

## 4. Touched Files

| Archivo | Acción |
|---------|--------|
| `.claude/skills/pm/.claude-plugin/plugin.json` | MOVER → `.claude-plugin/plugin.json` + bump v1.2.0 |
| `.claude/skills/pm/commands/pm-analize.md` | MOVER → `skills/pm/commands/pm-analize.md` |
| `.claude/skills/pm/commands/pm-search-ticket.md` | MOVER → `skills/pm/commands/pm-search-ticket.md` |
| `.claude/skills/pm/commands/pm-update.md` | MOVER → `skills/pm/commands/pm-update.md` |
| `.claude/skills/pm/` | ELIMINAR (vacía post-move) |
| `skills/pm/commands/pm-setup.md` | CREAR |
| `bin/pm-mcp.js` | CREAR |
| `.mcp.json` | CREAR |
| `.claude-plugin/plugin.json` | CREAR (destino del move) |
| `package.json` | MODIFICAR (bin, files, prepublishOnly, version) |
| `.github/workflows/ci.yml` | CREAR |
| `.github/workflows/publish.yml` | CREAR |

## 5. Migration Strategy

Devs con repo clonado tienen `.claude/skills/pm/` local:

1. El directorio estaba trackeado en git → `git pull` lo elimina automáticamente al hacer el move.
2. Actualizar `pm-update.md` para detectar path viejo (`.claude/skills/pm/`) y alertar al usuario si existe post-actualización.
3. Agregar nota en CHANGELOG/README: si el directorio persiste tras `git pull`, correr `rm -rf .claude/skills/pm/`.

## 6. Test Strategy

| Verificación | Tipo |
|-------------|------|
| `npm run build` sin errores | Automático (CI) |
| `npm test` pasa | Automático (CI) |
| `npm pack --dry-run` incluye `dist/`, `bin/`, `skills/`, `.claude-plugin/`, `.mcp.json` | Manual pre-publish |
| `node bin/pm-mcp.js` arranca sin crash | Automático (CI smoke) |
| `claude plugin install pm-mcp` instala sin errores | Manual |
| `/pm-setup` flujo completo: Node check → preguntas → `claude mcp add` → verificación | Manual |
| `/pm-analize` funciona post-setup | Manual |
| Edge: Node <18 → mensaje de error claro | Manual |
| Edge: credenciales inválidas → no se guardan, ofrece reintentar | Manual |
| Edge: instalación manual previa → detecta y ofrece limpiar | Manual |

## 7. Risks

| Riesgo | Mitigación |
|--------|-----------|
| `claude plugin install` CLI no existe aún o tiene API diferente | Verificar con `claude plugin --help` antes de codificar pm-setup; fallback: documentar instalación manual como alternativa |
| `dist/` en `.gitignore` excluido de npm publish | El campo `files` en package.json bypasea `.gitignore` — confirmar con `npm pack --dry-run` antes de publicar |
| Colisión de nombre `pm` en el plugin registry de Claude Code | Si hay conflicto, usar `"name": "pm-mcp"` en plugin.json y actualizar referencias en skills; testear con `claude plugin search pm` antes de publish |
