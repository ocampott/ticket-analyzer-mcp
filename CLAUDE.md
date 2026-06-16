# pm-mcp — Instrucciones para Claude Code

## Qué es esto

`pm-mcp` es un servidor MCP que expone los tools `get_trello_card` y `get_jira_issue` para traer el contenido de tarjetas e issues directamente en Claude Code.

Para que Claude analice los resultados automáticamente con Opus, copiá la sección de abajo a tu `~/.claude/CLAUDE.md` (configuración global) o al `CLAUDE.md` de tu proyecto. Esta sección es la fuente de verdad — si la actualizás acá, actualizala también en el global.

---

## Análisis de tarjetas y issues con Opus

Cuando uses `get_trello_card` o `get_jira_issue`, **siempre** lanzá un agente Opus para analizar los requerimientos antes de responder al usuario. Seguí estos pasos:

1. **Preguntale al usuario si quiere incluir imágenes en el análisis.**
   Decile: "¿Querés que analice las imágenes adjuntas? Omitirlas ahorra tokens si no son necesarias."
   Según la respuesta, usá `include_images: true` o `include_images: false` en el siguiente paso.

2. **Llamá al tool** con el parámetro `include_images` adecuado.

3. **Intentá leer el archivo de contexto del proyecto**: `.claude/project-context.md`.
   - Si **el archivo existe**: leé la primera línea para ver la fecha de generación. Si tiene más de 30 días o el usuario mencionó que el proyecto cambió mucho, borralo y tratalo como si no existiera.
   - Si **existe y es reciente**: tenés el contexto listo, no hace falta explorar el código.
   - Si **no existe**: Opus va a explorar el proyecto y vas a escribir el archivo después.

4. **Lanzá un agente Opus** (`Agent` tool con `model: "opus"`) con el contenido del issue y según el caso:

   - Si **tenés contexto cacheado**: incluilo en el prompt bajo el título "Contexto del proyecto (cacheado)". Indicale que no necesita explorar el código.
   - Si **no tenés contexto**: pedile que explore el proyecto usando `Read`, `Bash` con `find`/`ls`, etc. Que entienda: estructura de carpetas, tecnologías, convenciones de nombres, patrones de código, organización de funciones. Que incluya al final de su respuesta una sección `## Contexto del proyecto` con un resumen **conciso de máximo 200 palabras**, en formato estructurado (tech stack, estructura de carpetas, convenciones clave, patrones importantes). Solo lo esencial para entender cómo está hecho el proyecto.

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

5. **Si Opus exploró el proyecto** (porque no había cache), escribí el archivo `.claude/project-context.md` con este formato:
   ```
   <!-- Generado: YYYY-MM-DD -->
   [contenido de la sección ## Contexto del proyecto que devolvió Opus]
   ```
   Este archivo está en `.gitignore` — es local de cada dev.

6. **Presentá el análisis de Opus** al usuario (sin la sección de contexto, que es interna).
7. **Esperá confirmación** de que el análisis es correcto.
8. **¿Continuar con /sdd-new?** Una vez confirmado el análisis, preguntale:
   "¿Querés arrancar la implementación con `/sdd-new`? Te paso todo el contexto analizado para que no tenga que re-preguntar lo que ya sabemos."

   Si dice que sí, invocá el skill `sdd-new` (via Skill tool) pasando como `args` el siguiente bloque construido con la info del análisis de Opus:

   ```
   [Título del issue/card]

   Qué hay que hacer: [contenido de ¿Qué hay que hacer?]

   Puntos clave: [contenido de Puntos clave]

   Criterios de aceptación:
   [contenido de ¿Cuándo está listo?]

   Ambigüedades sin resolver:
   [contenido de Preguntas abiertas]

   Propuesta técnica inicial:
   [contenido de Cómo lo haría]
   ```

   /sdd-new va a usar este contexto para decidir la lane (fix/quick/full) y reducir el grill interview solo a las dudas genuinas que el análisis no pudo resolver.
