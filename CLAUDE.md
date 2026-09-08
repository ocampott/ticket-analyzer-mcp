# ticket-analyzer-mcp — Instrucciones para Claude Code

## Qué es esto

`ticket-analyzer-mcp` es un servidor MCP que expone los tools `get_trello_card`, `get_jira_issue` y `get_azure_work_item` para traer el contenido de tarjetas, issues y work items directamente en Claude Code.

Para que Claude analice los resultados automáticamente con Opus, copiá la sección de abajo a tu `~/.claude/CLAUDE.md` (configuración global) o al `CLAUDE.md` de tu proyecto. Esta sección es la fuente de verdad — si la actualizás acá, actualizala también en el global.

---

## Análisis de tarjetas y issues

Cuando uses `get_trello_card`, `get_jira_issue` o `get_azure_work_item`, seguí estos pasos.

Regla que manda sobre todo lo demás: **pensá profundo, respondé corto.** Se comprime la salida, nunca el razonamiento. Y no gastes un turno en algo que entra en el mensaje que estás escribiendo.

### Paso 1 — Traé el ticket

- **Jira** → `get_jira_issue` con `issue_key`
- **Trello** → `get_trello_card` con `card_id`
- **Azure DevOps** → `get_azure_work_item` con `work_item_id` (número, no string)

**Pedilo con `include_images: false` e `include_text_attachments: false`, y no preguntes antes.** La respuesta ya lista todos los adjuntos por nombre, que es justamente lo que te dice si alguno vale los tokens. La mayoría de los tickets nunca necesita un segundo fetch.

Volvé a pedirlo **solo** si un adjunto define la implementación: un wireframe en un ticket de UI, un `.sql` en uno de datos, un `.csv`/`.json` cuando el ticket es de parsear ese formato exacto, o una captura en un bug cuya descripción no explica la falla. Si no, seguí de largo. Si dudás si un adjunto importa, nombralo en el mismo mensaje del análisis en vez de frenar.

**Azure**: devuelve el árbol completo — cada Task, Bug e hijo con su propia descripción, criterios de aceptación, pasos para reproducir y comentarios. Leé los hijos antes de explorar el codebase: el requerimiento real suele estar en un hijo, no en la Story raíz. Si dice `_Árbol truncado_`, subí `max_depth` (default 3) o `max_nodes` (default 40) — nunca analices un árbol truncado como si estuviera completo.

### Paso 2 — Contexto del proyecto

Leé `.claude/project-context.md` (ignoralo si tiene más de 30 días) y `.claude/patterns.md` (no vence).

Cruzá los patrones documentados con el ticket antes de explorar. Si un patrón ya cubre lo que el ticket pide, reusá la referencia en vez de releer esos archivos.

### Paso 3 — Decidí si delegás

| Situación | Cómo |
|---|---|
| Hay cache + ticket simple | **Inline, sin agente.** Spawnear cuesta más de lo que ahorra. |
| Hay cache + ticket complejo | Agente con **Opus** |
| No hay cache | Agente con **Opus** (exploración completa) |

Un ticket es complejo si cumple alguno: más de 10 archivos afectados, cambios de schema, múltiples servicios, integraciones externas, auth o permisos, conflicto con la arquitectura, requerimientos ambiguos, o riesgo alto en producción.

Cuando delegues, pasale al agente el contenido del ticket, el contexto cacheado, los patrones conocidos y el formato del Paso 4 tal cual.

### Paso 4 — Formato de salida

El entregable depende de la plataforma, porque el lector también:

- **Azure DevOps** → una estimación para acordar, que se pega en la task de análisis. Dos partes.
- **Trello / Jira** → un plan de implementación, a punto de pasarse a un agente. Sin horas.

En los dos casos la salida es corta. Las dos son un resumen, no una explicación — el razonamiento va en la sección privada del final, nunca en el bloque copiable.

Registro: castellano rioplatense natural y profesional. Impersonal o en primera del plural, nunca tuteando ni voseando al lector.

#### Azure — Parte 1: Análisis y estimación

Sin jerga. **Nunca** nombres un archivo, función, variable, action ni permiso acá.

Dividido por área, y **solo las áreas que tienen trabajo real**: `Frontend`, `Backend`, `QA`, `Infra`. Una sola área está perfecto. Por área: las horas, y **una o dos líneas** de qué se hace. Si lo que pide el ticket no coincide con lo que el sistema necesita, comprimilo en una cláusula.

```markdown
## Análisis y estimación

**Frontend** · 6 h
Una o dos líneas de qué se va a hacer. Nada más.

**QA** · 2 h
Una o dos líneas de qué se verifica.

**Total: 8 h — S**
```

**Cómo estimar las horas**

- Calculá el tiempo realista, sumale como un tercio de colchón y redondeá para arriba a la hora entera. Las estimaciones fallan para abajo mucho más seguido que para arriba, y ese colchón es justamente el punto.
- Ningún área baja de `1 h`. **QA va siempre** — si el ticket no necesita QA, leíste mal el ticket.
- Después del total, la talla: `XS`, `S`, `M`, `L`, `XL`. Si da `XL`, agregá una línea proponiendo cómo partirlo.

#### Azure — Parte 2: Detalle técnico

Las mismas áreas, en el mismo orden. Dónde se toca y de qué forma — nada más. Una línea por archivo o endpoint: la ruta, qué cambia y el mecanismo, en una sola oración. Dos o tres líneas por área. Si un paso tiene un orden que importa o una trampa, va como media cláusula en la misma línea.

```markdown
## Detalle técnico

**Frontend**
`ruta/archivo.jsx` (línea 123) — qué se cambia y cómo. Si hay trampa, media línea.

**Backend**
`POST /recurso` — qué devuelve y cómo se resuelve.
**Base de datos** — nueva columna `tabla.columna`, nullable, migración reversible.
**Activities / jobs** — ninguna.

**QA**
Qué se prueba y qué se espera, en una o dos líneas.

**Infra**
Variables, permisos o pasos de despliegue nuevos.
```

**Omitir un área sin trabajo**, con una excepción: el trabajo que cae en un repo en el que no estás —típicamente Backend— conserva su bloque, marcado `REQUERIDO, fuera de este repo`. Eso es un bloqueante, y esconderlo es como se pierde un sprint. `**Base de datos**` y `**Activities / jobs**` aparecen solo si el ticket los toca; `**Infra**` solo para variables de entorno, credenciales, permisos, orden de despliegue o migraciones que corren antes del deploy.

#### Trello / Jira — Plan de implementación

**Sin horas.** Estos usuarios no están estimando para un tablero: están por pasarle el trabajo a un agente de código (Codex, Claude Code, Cursor, el que usen).

Todo el valor del análisis es que la exploración del codebase ya está hecha. El plan es la forma en que esa exploración le llega al agente para que no la rehaga desde cero. Escribilo para pegarse tal cual en el prompt de un agente, y que se sostenga solo: un agente que arranca en frío con ese texto tiene que saber a dónde ir, qué reusar y qué no tocar.

```markdown
## Plan de implementación

**Contexto**
Una o dos líneas: lo que hay que saber del proyecto para esta tarea.

**Pasos**
1. `ruta/archivo.jsx:123` — qué cambiar y cómo.
2. `ruta/otro.js` — qué cambiar y cómo. Copiar el enfoque de `ruta/referente.jsx`.

**No toques**
- Lo que parece la solución obvia y rompe otra cosa, con el motivo en media línea.

**Verificación**
Cómo se comprueba que quedó bien.

**Talla:** M
```

**Reglas**

- Los pasos van en orden de dependencia, numerados. **Cada paso nombra una ruta exacta** — si no podés, no exploraste lo suficiente en el Paso 2.
- Reusar antes que inventar: si el repo ya resuelve algo equivalente, nombrá ese archivo en el paso. Un agente librado a inventar, inventa.
- `No toques` lleva lo que el análisis descubrió y el agente no puede ver: radio de explosión, un permiso compartido, un orden que importa, un atajo tentador que rompe otra cosa. Es el bloque de más valor del plan. Omitilo solo si de verdad no hay nada.
- `Verificación` es un comando para correr o algo concreto para observar — no "probar que funcione".
- Máximo ~8 pasos. Más que eso y el ticket hay que partirlo: decilo en una línea en vez de escribir el paso 9.
- Sin relleno. Un agente parsea estructura, no adjetivos.

#### Después del entregable — notas privadas

Cerrá con un separador y un título que deje claro que esto **no** va en lo que se copia, y después `Patrones`, `Riesgos` y `Dudas`. Una o dos líneas cada uno, y omitir la sección que no tenga nada real. Un riesgo sin mitigación es una Duda, no un riesgo.

```markdown
---
### Para vos — no va en la tarjeta

**Patrones**
`ruta/al/referente.jsx` — qué copiar de ahí y por qué aplica.

**Riesgos**
El riesgo concreto y cómo se mitiga.

**Dudas**
La pregunta que bloquea, y qué cambia según la respuesta.
```

Las Dudas con opciones discretas van por `AskUserQuestion` (máx 4 por pregunta) y solo las que bloquean de verdad. Las genuinamente abiertas van numeradas en el mismo mensaje. Nunca gastes un turno aparte en una pregunta que no bloquea.

Cerrá con una línea ofreciendo publicar el bloque copiable como comentario —`add_azure_comment`, `add_trello_comment` o `add_jira_comment`— y arrancar la implementación. Nunca publiques la sección privada. No publiques nada sin que te lo pidan, y si las credenciales son de solo lectura avisalo al ofrecer, no después de que falle la llamada.

### Paso 5 — Guardá el cache (solo si exploraste desde cero)

**`.claude/project-context.md`**
```
<!-- Generado: YYYY-MM-DD -->
[Stack, estructura de carpetas, convenciones clave, patrones importantes. Máx 200 palabras.]
```

**`.claude/patterns.md`** (solo si encontraste patrones reusables)
```
<!-- Generado: YYYY-MM-DD | Última actualización: YYYY-MM-DD -->
[Patrones concretos reusables]
```

Si el cache ya existía y encontraste un patrón **nuevo**, agregalo al final y actualizá la fecha. Guardá un patrón solo si aparece en 2+ archivos, es un flujo complejo completo (auth, upload, paginación), o fue la referencia principal para este ticket.

Ambos archivos están en `.gitignore` — son locales de cada dev.
