# 001 — Claude Code Plugin Distribution

**Fecha:** 2026-06-26
**Estado:** Ready for planning

## Problema

Instalar pm-mcp requiere 7+ pasos manuales (clonar, build, `claude mcp add`, copiar skills). Esto es una barrera de entrada que impide que la comunidad lo use.

## Objetivo

Transformar pm-mcp en un plugin nativo de Claude Code instalable en 2 pasos:

```bash
claude plugin install ticket-analyzer-mcp
/pm-setup
```

## Trigger

Usuario que quiere instalar pm-mcp desde Claude Code por primera vez.

## Happy Path

| # | Paso |
|---|------|
| 0 | Usuario registra el marketplace: `claude plugin marketplace add pm --source github --repo ocampott/pm-mcp` *(omitir una vez que esté en el marketplace oficial de Anthropic)* |
| 1 | Usuario corre `claude plugin install ticket-analyzer-mcp` |
| 2 | Claude Code clona el repo, copia `skills/pm/` → `~/.claude/skills/pm/`, registra `.mcp.json` |
| 3 | Usuario corre `/pm-setup` |
| 4 | Skill verifica que Node ≥ 18 |
| 5 | Skill pregunta via `AskUserQuestion`: Trello / Jira / ambas |
| 6 | Skill pide credenciales con `AskUserQuestion` (incluye URL de dónde obtenerlas en la descripción) |
| 7 | Skill corre `claude mcp add pm -e KEY=value... -- npx ticket-analyzer-mcp@latest` |
| 8 | Skill verifica conexión con llamada liviana al MCP |
| 9 | Confirma éxito al usuario |
| 10 | Usuario corre `/pm-analize PROJ-123` y ve el análisis completo |

## Dominios

| Dominio | Cambio |
|---|---|
| Plugin structure | Crear `.claude-plugin/`, `skills/pm/`, `.mcp.json` en raíz del repo |
| npm | Publicar `ticket-analyzer-mcp` en npmjs.com con `bin` entry + wrapper shebang |
| Skills | Mover skills existentes a `skills/pm/` + nuevo `/pm-setup` |
| CI/CD | GitHub Actions: tests en PR + publish automático en tag `v*` |

## Edge Cases

| Caso | Comportamiento esperado |
|---|---|
| Credenciales inválidas | `/pm-setup` avisa, reintenta, no guarda nada |
| Instalación manual previa (`trello`/`jira` en mcp list) | `/pm-setup` detecta y elimina la configuración manual antes de continuar |
| Node < 18 | `/pm-setup` verifica versión al inicio, corta con error claro + link de descarga |
| Solo Trello o solo Jira | El MCP funciona perfectamente con una sola integración configurada |
| Plugin ya instalado | `claude plugin install` falla con mensaje "ya está instalado" |

## Acceptance Criteria

1. **Given** un usuario con Claude Code y Node 18+ sin instalación previa de pm-mcp, **When** corre `claude plugin marketplace add pm --source github --repo ocampott/pm-mcp` + `claude plugin install ticket-analyzer-mcp` + `/pm-setup` con credenciales válidas de Jira (incluyendo un reinicio de Claude Code si el MCP no hot-recarga), **Then** `/pm-analize PROJ-123` devuelve una respuesta con al menos: título del issue, descripción, y estado — sin configuración adicional. *Instancia de prueba: cualquier Jira cloud con al menos un issue accesible con el API token provisto.*

2. **Given** un usuario ejecutando `/pm-setup` que ingresa un API token inválido, **When** el skill intenta verificar la conexión, **Then** muestra error claro, vuelve a pedir las credenciales y no guarda nada.

## Credential Rotation

Re-ejecutar `/pm-setup` actualiza las credenciales. El wizard detecta la entrada existente en `claude mcp list` y corre `claude mcp remove pm` antes de re-registrar con los nuevos valores — sin necesidad de instrucciones adicionales.

## Rollback

`npm dist-tag add ticket-analyzer-mcp@X.Y.Z latest` redirige `latest` a la versión estable anterior. Los usuarios con `npx ticket-analyzer-mcp@latest` usan esa versión automáticamente en su próximo uso.

## Criterios de Éxito

- > 10 descargas semanales en npm al mes de publicar
- 0 issues de GitHub sobre instalación fallida en los primeros 7 días

## Lo que NO cambia

- Código TypeScript en `src/` — sin tocar
- Las 6 herramientas MCP — sin tocar
- Workflow de análisis en `CLAUDE.md` — sin tocar
- Contenido de pm-analize, pm-search-ticket — sin tocar
