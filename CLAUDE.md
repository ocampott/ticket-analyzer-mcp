# pm-mcp — Instrucciones para Claude Code

## Qué es esto

`pm-mcp` es un servidor MCP que expone los tools `get_trello_card` y `get_jira_issue` para traer el contenido de tarjetas e issues directamente en Claude Code.

Para que Claude analice los resultados automáticamente con Opus, copiá la sección de abajo a tu `~/.claude/CLAUDE.md` (configuración global) o al `CLAUDE.md` de tu proyecto. Esta sección es la fuente de verdad — si la actualizás acá, actualizala también en el global.

---

## Análisis de tarjetas y issues

Cuando uses `get_trello_card` o `get_jira_issue`, seguí estos pasos:

### Paso 1 — Imágenes
Preguntale al usuario: "¿Querés que analice las imágenes adjuntas? Omitirlas ahorra tokens si no son necesarias."
Usá `include_images: true/false` según la respuesta.

### Paso 2 — Llamá al tool
Con el `include_images` adecuado.

### Paso 3 — Contexto del proyecto
Intentá leer `.claude/project-context.md`:
- **Existe y es reciente** (< 30 días): tenés el contexto listo.
- **Existe pero tiene más de 30 días** (o el usuario dijo que el proyecto cambió): borralo y tratalo como no existente.
- **No existe**: Opus va a explorar el proyecto y vas a escribir el archivo después.

Además, intentá leer `.claude/patterns.md`:
- **Existe**: incluirlo en el prompt del agente (no tiene expiración — los patrones son estables).
- **No existe**: el agente puede generar la primera versión si detecta patrones importantes.

### Paso 4 — Evaluá la complejidad del ticket

Leé el contenido del ticket y verificá si cumple alguno de estos criterios de escalación a Opus:
- Más de 10 archivos probablemente afectados
- Requiere cambios en schema de base de datos
- Múltiples servicios/módulos a modificar
- Integraciones externas involucradas
- Autenticación o permisos impactados
- Arquitectura existente en conflicto con el feature
- Alta ambigüedad en los requerimientos
- Riesgo alto en producción

**Si no hay cache** → siempre Opus (exploración completa del proyecto).
**Si hay cache + ticket cumple algún criterio** → Opus.
**Si hay cache + ticket no cumple ningún criterio** → Sonnet.

### Paso 5 — Lanzá el agente

Usá el `Agent` tool con el modelo adecuado (paso 4) y este prompt:

---

You are a Senior Software Analyst and Technical Lead.
Your job: analyze the ticket and produce the smallest possible output with all critical implementation information.

Rules:
- Think deeply, answer briefly. Bullets over paragraphs.
- Mention exact files whenever possible.
- Reuse existing patterns — never introduce new ones.
- Maximum 15 bullet points total across all sections.
- No code. No architecture essays. No reasoning narration.
- Output in Spanish.

[INCLUIR SI HAY CONTEXTO CACHEADO:]
**Contexto del proyecto (cacheado):**
{contenido de .claude/project-context.md}

Usá este contexto para encontrar eficientemente los archivos específicos del ticket sin explorar todo el codebase desde cero. Aun así, inspeccioná los archivos relevantes para el ticket antes de responder.

[INCLUIR SI NO HAY CONTEXTO CACHEADO:]
No hay contexto cacheado. Explorá el proyecto primero usando `find`, `ls`, `Read`.
Entendé: estructura de carpetas, tech stack, convenciones de nombres, patrones de código, organización de funciones.
Al final de tu respuesta incluí una sección `## Contexto del proyecto`: resumen estructurado en ≤200 palabras (tech stack, carpetas, convenciones clave, patrones importantes). Solo lo esencial.

**Ticket:**
{contenido del ticket}

**Antes de responder:**
1. Analizá el ticket.
2. Inspeccioná el codebase (guiado por el contexto cacheado si existe).
3. Encontrá archivos, servicios, APIs, modelos, componentes e implementaciones existentes relacionados.
4. Identificá patrones reutilizables ya usados en el repositorio.
5. Detectá riesgos y blockers.
6. Detectá requerimientos faltantes o ambigüedades.
7. Proponé la solución más simple alineada con la arquitectura actual.
8. Evitá introducir patrones nuevos si los existentes alcanzan.

**Output ÚNICAMENTE en este formato:**

## Resumen
<1-2 oraciones>

## Impacto
- archivo/ruta
- archivo/ruta

## Implementación
- Paso 1
- Paso 2
- Paso 3

## Riesgos
*(omitir si no hay riesgos reales)*
- Riesgo 1

## Dudas
*(omitir si los requerimientos son claros)*
- Pregunta 1

## Estimación
S | M | L | XL

---

### Paso 6 — Guardá el contexto (solo si el agente exploró)
Si no había cache, escribí `.claude/project-context.md`:
```
<!-- Generado: YYYY-MM-DD -->
[contenido de la sección ## Contexto del proyecto del agente]
```
Este archivo está en `.gitignore` — es local de cada dev.

### Paso 7 — Presentá el análisis
Mostrá el análisis al usuario (sin la sección `## Contexto del proyecto`).

### Paso 8 — Dudas abiertas
Si hay "Dudas", presentalas con `AskUserQuestion`:
- Preguntas con opciones discretas (sí/no, A/B) → opciones seleccionables (máx 4 por pregunta)
- Preguntas genuinamente abiertas → numeradas en texto, pedile al usuario que responda con número + respuesta
- Priorizá las que bloquean el diseño

### Paso 9 — Handoff a /sdd-new
Una vez resueltas las dudas, ofrecé:
"¿Querés arrancar la implementación con `/sdd-new`? El contexto del análisis ya está en la conversación."

Si dice que sí:
> Escribí `/sdd-new` para arrancar. No hace falta que pegues nada — el skill toma el contexto de la conversación automáticamente.

**No intentes invocar el skill automáticamente** (tiene `disable-model-invocation`). El usuario lo inicia manualmente.
