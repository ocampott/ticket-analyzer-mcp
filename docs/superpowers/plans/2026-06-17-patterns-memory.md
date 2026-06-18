# Patterns Memory (`patterns.md`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar `.claude/patterns.md` como segundo archivo de memoria incremental que acumula patrones reutilizables descubiertos en análisis anteriores, reduciendo la re-exploración del codebase.

**Architecture:** Cambios puramente en instrucciones (CLAUDE.md archivos). El flujo de análisis existente de 9 pasos se extiende a 11: Paso 3 lee ambos archivos de cache, Paso 5 inyecta ambos en el prompt del agente y espera una sección `## Patrones encontrados`, Paso 6 se divide en 6A (generación inicial) y 6B (actualización incremental). Sin cambios en TypeScript.

**Tech Stack:** Markdown, instrucciones de Claude Code (CLAUDE.md).

## Global Constraints

- No modificar archivos `.ts` ni `package.json`.
- Los cambios en `CLAUDE.md` (proyecto) deben replicarse exactamente en `~/.claude/CLAUDE.md` (global), ya que el proyecto lo documenta como fuente de verdad.
- `patterns.md` no tiene expiración de 30 días (a diferencia de `project-context.md`).
- El criterio de guardado de patrones es cualitativo: ≥2 archivos, flujo complejo, o referencia primaria del análisis.

---

## File Map

| Archivo | Acción |
|---|---|
| `CLAUDE.md` (proyecto) | Modificar — fuente de verdad |
| `~/.claude/CLAUDE.md` (global) | Modificar — sincronizar con proyecto |
| `docs/superpowers/specs/2026-06-17-patterns-memory-design.md` | Ya creado (spec) |

---

### Task 1: Actualizar Paso 3 en CLAUDE.md (proyecto)

**Files:**
- Modify: `CLAUDE.md` (raíz del proyecto)

**Interfaces:**
- Consumes: nada
- Produces: instrucción para leer `patterns.md` junto con `project-context.md`

- [ ] **Step 1: Editar Paso 3 para incluir lectura de `patterns.md`**

Aplicar este cambio en `CLAUDE.md`:

Reemplazar:
```
### Paso 3 — Contexto del proyecto
Intentá leer `.claude/project-context.md`:
- **Existe y es reciente** (< 30 días): tenés el contexto listo.
- **Existe pero tiene más de 30 días** (o el usuario dijo que el proyecto cambió): borralo y tratalo como no existente.
- **No existe**: Opus va a explorar el proyecto y vas a escribir el archivo después.
```

Con:
```
### Paso 3 — Contexto del proyecto
Intentá leer `.claude/project-context.md`:
- **Existe y es reciente** (< 30 días): tenés el contexto listo.
- **Existe pero tiene más de 30 días** (o el usuario dijo que el proyecto cambió): borralo y tratalo como no existente.
- **No existe**: Opus va a explorar el proyecto y vas a escribir el archivo después.

Además, intentá leer `.claude/patterns.md`:
- **Existe**: incluirlo en el prompt del agente (no tiene expiración — los patrones son estables).
- **No existe**: el agente puede generar la primera versión si detecta patrones importantes.
```

- [ ] **Step 2: Verificar el cambio**

Leer `CLAUDE.md` líneas 22-27 y confirmar que aparecen las dos nuevas líneas sobre `patterns.md`.

---

### Task 2: Actualizar Paso 5 en CLAUDE.md (proyecto) — prompt del agente

**Files:**
- Modify: `CLAUDE.md` (raíz del proyecto)

**Interfaces:**
- Consumes: `patterns.md` cacheado (si existe)
- Produces: sección `## Patrones encontrados` en el output del agente

- [ ] **Step 1: Agregar bloque de patrones cacheados en el prompt del agente**

En `CLAUDE.md`, dentro del prompt del agente (Paso 5), agregar el bloque de patrones DESPUÉS del bloque de contexto cacheado existente.

Reemplazar:
```
[INCLUIR SI HAY CONTEXTO CACHEADO:]
**Contexto del proyecto (cacheado):**
{contenido de .claude/project-context.md}

Usá este contexto para encontrar eficientemente los archivos específicos del ticket sin explorar todo el codebase desde cero. Aun así, inspeccioná los archivos relevantes para el ticket antes de responder.

[INCLUIR SI NO HAY CONTEXTO CACHEADO:]
```

Con:
```
[INCLUIR SI HAY CONTEXTO CACHEADO:]
**Contexto del proyecto (cacheado):**
{contenido de .claude/project-context.md}

Usá este contexto para encontrar eficientemente los archivos específicos del ticket sin explorar todo el codebase desde cero. Aun así, inspeccioná los archivos relevantes para el ticket antes de responder.

[INCLUIR SI HAY patterns.md:]
**Patrones conocidos del proyecto:**
{contenido de .claude/patterns.md}

Antes de explorar el codebase, cruzá estos patrones con el ticket. Si el ticket involucra una funcionalidad cuyo patrón ya está documentado, reutilizá la referencia directamente sin re-explorar esos archivos.

[INCLUIR SI NO HAY CONTEXTO CACHEADO:]
```

- [ ] **Step 2: Agregar ítem 0 en "Antes de responder"**

Reemplazar:
```
**Antes de responder:**
1. Analizá el ticket.
2. Inspeccioná el codebase (guiado por el contexto cacheado si existe).
```

Con:
```
**Antes de responder:**
0. Si hay patrones cacheados, cruzalos con el ticket antes de explorar el codebase. Reutilizá referencias documentadas directamente.
1. Analizá el ticket.
2. Inspeccioná el codebase (guiado por el contexto cacheado si existe).
```

- [ ] **Step 3: Agregar sección `## Patrones encontrados` en el output esperado**

Reemplazar:
```
## Implementación
- Paso 1
- Paso 2
- Paso 3

## Riesgos
*(omitir si no hay riesgos reales)*
- Riesgo 1
```

Con:
```
## Implementación
- Paso 1
- Paso 2
- Paso 3

## Patrones encontrados
*(omitir si no hay patrones reutilizables relevantes para el ticket)*
**Referencia:** ruta/al/componente-o-módulo
**Archivos:** archivo1.js, archivo2.js
**Uso:** Para qué sirve este patrón en el contexto del ticket.

## Riesgos
*(omitir si no hay riesgos reales)*
- Riesgo 1
```

- [ ] **Step 4: Verificar el prompt completo**

Leer el bloque completo del prompt del agente en `CLAUDE.md` (aproximadamente líneas 44-110) y confirmar que:
- Aparece el bloque `[INCLUIR SI HAY patterns.md:]`
- Aparece el ítem `0.` en "Antes de responder"
- Aparece la sección `## Patrones encontrados` en el output format

---

### Task 3: Dividir Paso 6 en 6A y 6B en CLAUDE.md (proyecto)

**Files:**
- Modify: `CLAUDE.md` (raíz del proyecto)

**Interfaces:**
- Consumes: sección `## Patrones encontrados` del output del agente (Task 2)
- Produces: instrucciones para generar/actualizar `patterns.md`

- [ ] **Step 1: Reemplazar Paso 6 con 6A + 6B**

Reemplazar:
```
### Paso 6 — Guardá el contexto (solo si el agente exploró)
Si no había cache, escribí `.claude/project-context.md`:
```
<!-- Generado: YYYY-MM-DD -->
[contenido de la sección ## Contexto del proyecto del agente]
```
Este archivo está en `.gitignore` — es local de cada dev.
```

Con:
````
### Paso 6A — Guardá el contexto inicial (solo si el agente exploró)
Si no había cache, escribí los dos archivos:

**`.claude/project-context.md`:**
```
<!-- Generado: YYYY-MM-DD -->
[contenido de la sección ## Contexto del proyecto del agente]
```

**`.claude/patterns.md`** (primera versión con los patrones más importantes detectados durante la exploración):
```
<!-- Generado: YYYY-MM-DD | Última actualización: YYYY-MM-DD -->
[patrones concretos reutilizables encontrados — misma sección ## Patrones encontrados del agente, o los más relevantes de la exploración inicial]
```

Ambos archivos están en `.gitignore` — son locales de cada dev.

### Paso 6B — Actualizá patrones incrementalmente (solo si hubo nuevos)
Si había cache + el agente reportó `## Patrones encontrados`:
1. Leer `.claude/patterns.md`. Si no existe aún (primera vez con este feature), crear el archivo con solo el encabezado: `<!-- Generado: YYYY-MM-DD | Última actualización: YYYY-MM-DD -->`.
2. Para cada patrón reportado:
   - Si **no existe** en el archivo: agregarlo al final.
   - Si **ya existe**: actualizar solo si la nueva info aporta valor concreto (archivos adicionales, mejor descripción).
   - Si es duplicado sin valor nuevo: ignorar.
3. Actualizar el timestamp `Última actualización` en el encabezado.

Si el agente **no** reportó `## Patrones encontrados`: no modificar `patterns.md`.

**Criterio de guardado** — guardar solo si el patrón cumple al menos uno:
- Aparece en ≥ 2 archivos del proyecto
- Es un flujo complejo y completo (auth, upload, websocket, pagination)
- Es la referencia primaria que el agente usó para implementar el ticket
````

- [ ] **Step 2: Verificar el cambio**

Leer la zona del Paso 6 en `CLAUDE.md` y confirmar que aparecen 6A y 6B con instrucciones completas.

---

### Task 4: Actualizar Paso 7 en CLAUDE.md (proyecto)

**Files:**
- Modify: `CLAUDE.md` (raíz del proyecto)

**Interfaces:**
- Consumes: nada
- Produces: aclaración de qué secciones mostrar/ocultar al usuario

- [ ] **Step 1: Actualizar Paso 7**

Reemplazar:
```
### Paso 7 — Presentá el análisis
Mostrá el análisis al usuario (sin la sección `## Contexto del proyecto`).
```

Con:
```
### Paso 7 — Presentá el análisis
Mostrá el análisis al usuario (sin la sección `## Contexto del proyecto`).
La sección `## Patrones encontrados` sí se muestra al usuario cuando aparece en el análisis.
```

- [ ] **Step 2: Verificar y hacer commit del proyecto CLAUDE.md**

Leer `CLAUDE.md` completo para confirmar que los 4 cambios (Pasos 3, 5, 6, 7) son coherentes entre sí.

```bash
git diff CLAUDE.md
git add CLAUDE.md
git commit -m "feat: agregar memoria incremental de patrones (patterns.md) al workflow de análisis"
```

---

### Task 5: Sincronizar cambios a `~/.claude/CLAUDE.md` (global)

**Files:**
- Modify: `~/.claude/CLAUDE.md`

**Interfaces:**
- Consumes: `CLAUDE.md` (proyecto) — fuente de verdad ya actualizada
- Produces: global CLAUDE.md con los mismos 4 cambios

Este archivo tiene solo la sección `## Análisis de tarjetas y issues` (sin el header de pm-mcp). Aplicar exactamente los mismos 4 cambios que en Tasks 1-4.

- [ ] **Step 1: Aplicar Cambio 1 — Paso 3**

En `~/.claude/CLAUDE.md`, reemplazar el bloque del Paso 3 con el mismo texto nuevo de Task 1 Step 1.

- [ ] **Step 2: Aplicar Cambio 2 — Paso 5 (3 sub-ediciones)**

En `~/.claude/CLAUDE.md`, aplicar los mismos 3 cambios de Task 2 (bloque patterns, ítem 0, sección ## Patrones encontrados).

- [ ] **Step 3: Aplicar Cambio 3 — Paso 6**

En `~/.claude/CLAUDE.md`, reemplazar Paso 6 con 6A + 6B, mismo texto que Task 3 Step 1.

- [ ] **Step 4: Aplicar Cambio 4 — Paso 7**

En `~/.claude/CLAUDE.md`, aplicar el mismo cambio de Task 4 Step 1.

- [ ] **Step 5: Verificar consistencia**

Confirmar que la sección `## Análisis de tarjetas y issues` en `~/.claude/CLAUDE.md` es idéntica a la misma sección en `CLAUDE.md` (proyecto).

```bash
# Extraer solo la sección de análisis de cada archivo y diff
diff \
  <(sed -n '/^## Análisis/,$ p' /Users/tomasocampo/Documents/personal/pm-mcp/CLAUDE.md) \
  <(sed -n '/^## Análisis/,$ p' ~/.claude/CLAUDE.md)
```

Resultado esperado: sin diferencias.

- [ ] **Step 6: Commit del plan**

```bash
git add docs/superpowers/plans/2026-06-17-patterns-memory.md docs/superpowers/specs/2026-06-17-patterns-memory-design.md
git commit -m "docs: agregar spec y plan de implementación de patterns.md"
```

---

## Self-Review

**Spec coverage:**
- ✅ `patterns.md` como segundo archivo de memoria → Tasks 1-5
- ✅ Leer ambos archivos antes de explorar → Task 1
- ✅ Prompt del agente con contexto de patrones → Task 2 Step 1
- ✅ Cruzar ticket contra patrones antes de explorar → Task 2 Step 2
- ✅ Sección `## Patrones encontrados` en output → Task 2 Step 3
- ✅ Primera versión de `patterns.md` en exploración inicial → Task 3 (6A)
- ✅ Actualización incremental (no regeneración) → Task 3 (6B)
- ✅ Evitar duplicados → Task 3 (6B, ítem 2)
- ✅ Criterio de guardado (juicio cualitativo) → Task 3 (6B, criterio)
- ✅ Mostrar patrones al usuario → Task 4
- ✅ Sincronizar global CLAUDE.md → Task 5
- ✅ Edge case: `patterns.md` no existe cuando cache sí existe → Task 3 (6B, ítem 1)

**Placeholder scan:** Sin TBDs, TODOs ni pasos vagos. Cada edit muestra el texto viejo y nuevo exacto.

**Type consistency:** N/A (sin código, solo instrucciones en markdown).
