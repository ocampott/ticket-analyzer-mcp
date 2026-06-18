# Design: Memoria Incremental de Patrones (`patterns.md`)

**Fecha:** 2026-06-17
**Proyecto:** pm-mcp
**Estado:** Aprobado

---

## Contexto

`pm-mcp` expone `get_trello_card` y `get_jira_issue` para traer tickets directamente en Claude Code. Tras obtener el ticket, Claude lanza un agente Opus/Sonnet que analiza el codebase del usuario y produce un análisis de implementación.

Actualmente el cache local es un único archivo `.claude/project-context.md` que guarda stack, estructura y convenciones generales. El agente re-descubre en cada análisis implementaciones de referencia, patrones CRUD, flujos de upload, y otros bloques reutilizables — generando exploración redundante.

---

## Objetivo

Agregar un segundo archivo de memoria local `.claude/patterns.md` que actúe como base de conocimiento incremental de patrones concretos reutilizables descubiertos durante análisis anteriores.

---

## Archivos afectados

Solo instrucciones. Sin cambios en código TypeScript:
- `CLAUDE.md` (proyecto) — fuente de verdad
- `~/.claude/CLAUDE.md` (global) — copia sincronizada

---

## Responsabilidades de cada archivo

### `project-context.md` (existente, sin cambios en estructura)
- Tech stack
- Arquitectura general
- Estructura de carpetas
- Convenciones de nombres y código
- Patrones generales del proyecto

### `patterns.md` (nuevo)
- Patrones concretos reutilizables descubiertos en análisis previos
- Solo patrones con referencia a archivos reales
- Actualización incremental — nunca regeneración completa

---

## Formato de `patterns.md`

```markdown
<!-- Generado: YYYY-MM-DD | Última actualización: YYYY-MM-DD -->

# Upload Pattern
**Referencia:** components/shared/upload
**Archivos:** uploadUtils.js, uploadService.js
**Uso:** Cualquier funcionalidad de carga de archivos.

---

# OAuth Pattern
**Referencia:** src/auth/github
**Archivos:** github.service.js, github.controller.js
**Uso:** Agregar nuevos proveedores OAuth.

---

# CRUD Pattern
**Referencia:** pages/customers
**Servicios:** services/customer.js
**Uso:** Nuevas entidades CRUD.
```

---

## Flujo completo (modificado)

El flujo existente tiene 9 pasos. Este diseño los extiende a 11:

### Paso 3 — Contexto del proyecto *(modificado)*

Leer DOS archivos:
1. `.claude/project-context.md` — mismo criterio actual (< 30 días = válido)
2. `.claude/patterns.md` — si existe, leerlo siempre (no tiene expiración)

### Paso 5 — Prompt del agente *(modificado)*

El prompt recibe ambos contextos y produce una sección extra opcional.

**Adiciones al prompt:**

```
[INCLUIR SI HAY patterns.md:]
**Patrones conocidos del proyecto:**
{contenido de .claude/patterns.md}

Antes de explorar el codebase, cruzá estos patrones con el ticket.
Si el ticket involucra una funcionalidad cuyo patrón ya está documentado,
reutilizá la referencia directamente sin re-explorar esos archivos.
```

**Adición al output esperado del agente:**

```
## Patrones encontrados
*(omitir si no hay patrones relevantes para el ticket)*
**Referencia:** ruta/al/componente
**Archivos:** file1.js, file2.js
**Uso:** Para qué sirve reutilizar este patrón.
```

**Reglas para el agente al reportar patrones:**
- Reportar solo si el patrón es directamente relevante al ticket
- Incluir ruta exacta y archivos reales verificados
- Máximo 1-2 patrones por análisis (no inflar)

### Paso 6A — Primera generación de contexto *(modificado)*

Cuando no existe cache (exploración completa):
1. Escribir `project-context.md` (igual que hoy)
2. Además escribir la primera versión de `patterns.md` con los patrones más importantes detectados en la exploración

### Paso 6B — Actualización incremental de patrones *(nuevo)*

Cuando había cache + el agente reportó `## Patrones encontrados`:
1. Leer `patterns.md` si existe. Si no existe (primera vez con este feature activo), crear uno vacío con el encabezado.
2. Para cada patrón reportado:
   - Si **no existe**: agregarlo al final
   - Si **ya existe**: actualizar solo si la nueva info aporta valor concreto (archivos adicionales, mejor descripción)
   - Si es duplicado sin valor nuevo: ignorar
3. Actualizar el timestamp `Última actualización` en el encabezado

Si el agente no reportó nuevos patrones: **no tocar `patterns.md`**.

---

## Criterio de guardado (control de crecimiento)

**Guardar un patrón solo si cumple al menos uno:**
- Aparece en ≥ 2 archivos del proyecto (patrón genuinamente compartido)
- Es un flujo complejo y completo (auth, upload, websocket, pagination)
- El agente lo marcó explícitamente como referencia primaria para el ticket

**No guardar:**
- Tickets, IDs de tickets, contenido de análisis
- Riesgos o decisiones temporales
- Helpers triviales o utilidades de una sola línea
- Patrones que solo existen en un archivo

**Sin límite numérico fijo.** El criterio cualitativo es suficiente — un proyecto típico tiene 5-15 patrones genuinamente reutilizables.

---

## `.gitignore`

Ambos archivos deben estar en `.gitignore` del proyecto del usuario (igual que hoy con `project-context.md`):
```
.claude/project-context.md
.claude/patterns.md
```

Esto ya es responsabilidad del desarrollador — las instrucciones deben mencionarlo.

---

## Consideraciones de coherencia

- `patterns.md` no tiene expiración (los patrones son más estables que el contexto general)
- Si el usuario borra `project-context.md` (por cambios grandes), `patterns.md` se mantiene — los patrones siguen siendo válidos aunque el contexto general sea re-explorado
- Si el usuario borra ambos, en la próxima exploración Opus regenera los dos

---

## Sección excluida del output al usuario

La sección `## Patrones encontrados` se muestra al usuario solo cuando aparece en el análisis. No se oculta como `## Contexto del proyecto`.

---

## Resumen de cambios en CLAUDE.md

| Paso | Cambio |
|---|---|
| Paso 3 | Leer también `patterns.md` si existe |
| Paso 5 | Agregar contexto de patrones al prompt del agente |
| Paso 5 | Agregar sección `## Patrones encontrados` al output esperado |
| Paso 6 | Split en 6A (generación inicial) y 6B (actualización incremental) |
| Paso 6A | Generar `patterns.md` inicial junto con `project-context.md` |
| Paso 6B | Actualizar `patterns.md` incrementalmente post-análisis |
| Paso 7 | Mostrar `## Patrones encontrados` si aparece en el análisis |
