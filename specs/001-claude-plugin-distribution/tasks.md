# Tasks — 001-claude-plugin-distribution

## Phase 1: Foundation

- [ ] Crear `.claude-plugin/plugin.json` en root — done when: archivo existe con `name`, `version`, `description`, `mcp` y `skills` fields válidos
- [ ] Crear `.claude-plugin/marketplace.json` en root — done when: archivo existe con metadata de distribución (author, tags, homepage, repository)
- [ ] Crear `.mcp.json` en root — done when: apunta al binary `bin/pm-mcp.js` con los 6 tools declarados
- [ ] Eliminar `.claude/skills/pm/` del repo via `git rm -r` — done when: directorio no existe en git tracking

## Phase 2: npm package

- [ ] Crear `bin/pm-mcp.js` con shebang ESM — done when: `#!/usr/bin/env node` + `import "../dist/index.js"` y archivo es ejecutable (`chmod +x`)
- [ ] Modificar `package.json`: agregar `bin`, `files`, `prepublishOnly` — done when: `"bin": {"pm-mcp": "bin/pm-mcp.js"}`, `"files": ["dist/", "bin/", "skills/", ".claude-plugin/"]`, `"prepublishOnly": "npm run build"`
- [ ] Verificar build + binary localmente — done when: `npm run build && node bin/pm-mcp.js` arranca sin errores

## Phase 3: Skills migration

- [ ] Crear directorio `skills/pm/` en root — done when: directorio existe y está trackeado en git
- [ ] Mover `pm-analize.md` a `skills/pm/` — done when: archivo en nueva ubicación, contenido idéntico al original
- [ ] Mover `pm-search-ticket.md` a `skills/pm/` — done when: archivo en nueva ubicación, contenido idéntico al original
- [ ] Actualizar `pm-update.md` y mover a `skills/pm/` — done when: skill detecta si instalado via `claude plugin` vs manual y ejecuta rama correcta en cada caso
- [ ] Escribir `skills/pm/pm-setup.md` — done when: wizard guía al usuario via AskUserQuestion para configurar JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN y TRELLO_API_KEY/TOKEN; valida que el servidor MCP responde antes de terminar

## Phase 4: CI/CD

- [ ] Crear `.github/workflows/ci.yml` — done when: corre `npm ci`, `npm run build`, y `npm test` en push/PR a main
- [ ] Crear `.github/workflows/publish.yml` — done when: publica a npm con `NPM_TOKEN` secret en push de tag `v*`

## Phase 5: Validation

- [ ] Verificar `npm pack` incluye archivos correctos — done when: tarball contiene `dist/`, `bin/`, `skills/`, `.claude-plugin/` y no incluye `src/` ni `.claude/`
- [ ] Test happy path completo — done when: `claude plugin install pm-mcp` + `/pm-setup` configura el servidor y `/pm-analize` resuelve un ticket real
- [ ] Actualizar README con instrucciones de instalación via plugin — done when: sección "Instalación" muestra ambos métodos (plugin y manual), el método plugin es el primario
