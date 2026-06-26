# Tasks — 001-claude-plugin-distribution

## Phase 1: Foundation

- [x] Crear `.claude-plugin/plugin.json` en root — done when: archivo existe con `name`, `version`, `description`, `mcp` y `skills` fields válidos
- [x] Crear `.claude-plugin/marketplace.json` en root — done when: archivo existe con metadata de distribución (author, tags, homepage, repository)
- [x] Crear `.mcp.json` en root — done when: apunta al binary `bin/pm-mcp.js` con los 6 tools declarados
- [x] Eliminar `.claude/skills/pm/` del repo via `git rm -r` — done when: directorio no existe en git tracking

## Phase 2: npm package

- [x] Crear `bin/pm-mcp.js` con shebang ESM — done when: `#!/usr/bin/env node` + `import "../dist/index.js"` y archivo es ejecutable (`chmod +x`)
- [x] Modificar `package.json`: agregar `bin`, `files`, `prepublishOnly` — done when: `"bin": {"pm-mcp": "bin/pm-mcp.js"}`, `"files": ["dist/", "bin/", "skills/", ".claude-plugin/"]`, `"prepublishOnly": "npm run build"`
- [x] Verificar build + binary localmente — done when: `npm run build && node bin/pm-mcp.js` arranca sin errores

## Phase 3: Skills migration

- [x] Crear directorio `skills/pm/` en root — done when: directorio existe y está trackeado en git
- [x] Mover `pm-analize.md` a `skills/pm/` — done when: archivo en nueva ubicación, contenido idéntico al original
- [x] Mover `pm-search-ticket.md` a `skills/pm/` — done when: archivo en nueva ubicación, contenido idéntico al original
- [x] Actualizar `pm-update.md` y mover a `skills/pm/` — done when: skill detecta si instalado via `claude plugin` vs manual y ejecuta rama correcta en cada caso
- [x] Escribir `skills/pm/pm-setup.md` — done when: wizard guía al usuario via AskUserQuestion para configurar JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN y TRELLO_API_KEY/TOKEN; valida que el servidor MCP responde antes de terminar

## Phase 4: CI/CD

- [x] Crear `.github/workflows/ci.yml` — done when: corre `npm ci`, `npm run build`, y `npm test` en push/PR a main
- [x] Crear `.github/workflows/publish.yml` — done when: publica a npm con `NPM_TOKEN` secret en push de tag `v*`

## Phase 5: Validation

- [x] Verificar `npm pack` incluye archivos correctos — done when: tarball contiene `dist/`, `bin/`, `skills/`, `.claude-plugin/` y no incluye `src/` ni `.claude/`
- [x] Test happy path completo — MANUAL-PENDING: `claude plugin` subcommand exists and `install` command is available; full test (`claude plugin install pm-mcp` + `/pm-setup`) requires package to be published to npm first; see decisions.md
- [x] Actualizar README con instrucciones de instalación via plugin — done when: sección "Instalación" muestra ambos métodos (plugin y manual), el método plugin es el primario

## Fix Cycle 1

- [x] AC#2 fix — `pm-setup.md` Step 6 auth-error branch: añadir `claude mcp remove pm` + loop a Step 4 en vez de pedir al usuario que reinicie el wizard
- [x] Version bump — `package.json` subido de `1.0.0` a `1.2.0` para coincidir con `plugin.json` y `marketplace.json`
- [x] MCP server name — unificar a `"pm"` en todo; `pm-setup.md` ahora usa `claude mcp add pm` y `claude mcp remove pm` en todos los pasos
- [x] `plugin.json` — agregar campo `"mcp": ".mcp.json"` para auto-registro del MCP server al instalar el plugin
- [x] README — corregir ruta fuente en instalación manual de `.claude/skills/pm` a `skills/pm`
