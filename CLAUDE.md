# pm-mcp — Instrucciones para Claude Code

## Qué es esto

`pm-mcp` es un servidor MCP que expone los tools `get_trello_card` y `get_jira_issue` para traer el contenido de tarjetas e issues directamente en Claude Code.

Para que Claude analice los resultados automáticamente con Opus, copiá la sección de abajo a tu `~/.claude/CLAUDE.md` (configuración global) o al `CLAUDE.md` de tu proyecto.

---

## Análisis de tarjetas y issues con Opus

Cuando uses `get_trello_card` o `get_jira_issue`, **siempre** lanzá un agente Opus para analizar los requerimientos antes de responder al usuario. Seguí estos pasos:

1. **Llamá al tool** para obtener los datos del issue/tarjeta (descripción, comentarios, subtasks, imágenes).

2. **Buscá contexto del proyecto en Engram** con `mem_search` usando el nombre o path del proyecto actual. Buscá entradas con `topic_key` que empiece con `project-context/`.
   - Si **encontrás contexto guardado**: tenés el resumen del proyecto listo para usar, no hace falta releer el código.
   - Si **no encontrás nada**: Opus va a explorar el proyecto y vos vas a guardar los hallazgos en Engram después.

3. **Lanzá un agente Opus** (`Agent` tool con `model: "opus"`) con el contenido del issue y según el caso:

   - Si **tenés contexto en Engram**: incluilo en el prompt bajo el título "Contexto del proyecto (cacheado)". Indicale que no necesita explorar el código porque ya tenés esa información.
   - Si **no tenés contexto**: pedile que primero explore el proyecto usando `Read`, `Bash` con `find`/`ls`, etc. Que entienda: estructura de carpetas, tecnologías, convenciones de nombres, patrones de código, manejo de estilos, organización de funciones. Que incluya al final de su respuesta una sección llamada `## Contexto del proyecto` con un resumen estructurado de lo que encontró.

   En ambos casos, el análisis debe estar en español, con un tono **amigable y conversacional**, como si le explicara a un colega. Sin jerga técnica innecesaria. Con estas secciones:

   **¿Qué hay que hacer?**
   Explicación clara y simple de qué se necesita construir o resolver.

   **Puntos clave**
   Los aspectos más importantes del requerimiento, en lenguaje llano.

   **¿Qué hay que tener en cuenta?**
   Restricciones, casos borde o detalles que puedan complicar la implementación.

   **¿Cuándo está listo?**
   Criterios de aceptación inferidos: qué debe cumplir la solución para darse por terminada.

   **Preguntas abiertas**
   Ambigüedades o decisiones no definidas que sería bueno aclarar antes de arrancar.

   **Cómo lo haría**
   Propuesta concreta de implementación **basada en el código real del proyecto**. Incluir:
   - El enfoque recomendado, alineado con los patrones que ya existen en el código
   - Los pasos principales para llevarlo a cabo (a alto nivel)
   - Tecnologías o patrones del proyecto que aplican bien a este caso
   - Qué evitar o qué podría salir mal, considerando el estado actual del código

4. **Si Opus exploró el proyecto** (porque no había cache en Engram), guardá la sección `## Contexto del proyecto` de su respuesta en Engram con `mem_save`:
   - `title`: `"Contexto del proyecto: [nombre del proyecto]"`
   - `type`: `"discovery"`
   - `topic_key`: `"project-context/[nombre-del-proyecto]"` (así se sobreescribe si ya existe)
   - `content`: el resumen estructurado que devolvió Opus

5. **Presentá el análisis de Opus** al usuario (sin la sección de contexto del proyecto, que es interna).
6. **Esperá confirmación** de que el análisis es correcto antes de proponer o escribir cualquier código.
