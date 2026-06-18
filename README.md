# pm-mcp

Un MCP para Claudio que lee tarjetas de Trello e issues de Jira y los convierte en contexto útil para desarrollar.

La idea es simple:

En vez de copiar una tarjeta, pegarla en Claudio y explicarle todo el proyecto cada vez, pm-mcp le da acceso directo al ticket y lo ayuda a entender cómo implementarlo dentro del código existente.

## ¿Qué hace?

Actualmente expone dos tools:

* `get_trello_card`
* `get_jira_issue`

Con eso Claudio puede leer:

* título
* descripción
* comentarios
* adjuntos
* imágenes (opcional)

directamente desde Trello o Jira.

## ¿Qué pasa después?

Cuando Claude recibe un ticket:

1. Lee el contenido del ticket.
2. Revisa el contexto local del proyecto (`.claude/project-context.md`).
3. Explora el repositorio cuando hace falta.
4. Identifica archivos impactados.
5. Detecta patrones existentes para reutilizar.
6. Señala riesgos, dependencias y dudas.
7. Genera un plan de implementación concreto.

El objetivo no es resumir tickets.

El objetivo es responder:

> "¿Cómo implementamos esto en ESTE proyecto?"

## ¿Por qué existe?

Porque los tickets suelen decir qué hay que hacer.

Pero no dicen:

* dónde tocar código
* qué archivos modificar
* qué patrón seguir
* qué riesgos hay
* qué partes del sistema están involucradas

pm-mcp ayuda a cerrar esa brecha.

## Flujo típico

```text
Ticket
 ↓
pm-mcp
 ↓
Claude analiza el proyecto
 ↓
Impacto
 ↓
Plan de implementación
 ↓
Desarrollo
```

## Casos de uso

* Analizar tickets antes de desarrollarlos
* Entender impacto técnico
* Detectar requerimientos faltantes
* Encontrar patrones reutilizables
* Reducir tiempo de exploración del repositorio
* Preparar contexto para Claudio

## Filosofía

No intenta reemplazar Jira o Trello.

No intenta gestionar proyectos.

Simplemente le da a Claude el contexto correcto para que pueda trabajar mejor sobre tickets reales.
