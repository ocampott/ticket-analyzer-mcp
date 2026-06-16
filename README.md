# pm-mcp

MCP server para Claude Code que le permite leer tarjetas de **Trello** e issues de **Jira** directamente, sin que tengas que copiar y pegar nada.

---

## ¿Qué hace esto?

Cuando trabajás con Claude Code y tenés una tarea en Trello o Jira, normalmente tenés que copiar el título, la descripción, los comentarios y pegar todo en el chat. Con este MCP eso desaparece.

Le decís a Claude: "mirá la tarjeta de Trello `abc123`" o "leé el issue `PROJ-456`" y Claude lo trae solo. Ve el título, la descripción, los comentarios, los archivos adjuntos, y si hay imágenes (wireframes, capturas de pantalla, etc.) las ve también y las puede analizar.

Después de leer la tarjeta, Claude no se lanza a codear. Primero te resume lo que entendió, te hace preguntas para confirmar el alcance y los detalles, y espera tu ok antes de proponer cualquier cosa.

---

## Cómo trabaja Claude cuando lee una tarjeta

El workflow funciona así:

1. **Lee todo**: título, descripción, lista/columna, labels, fecha de vencimiento, asignados, comentarios, checklists e imágenes adjuntas.
2. **Resume su entendimiento**: explica con sus palabras qué leyó, qué muestran las imágenes y los puntos clave de los comentarios.
3. **Hace preguntas de aclaración**: alcance, comportamiento esperado, tecnología a usar, casos borde, criterios de aceptación.
4. **Espera tu confirmación** antes de proponer o escribir cualquier código.

Esto evita que Claude asuma cosas y arranque a implementar en la dirección equivocada.

---

## Requisitos

- **Node.js 18+** — verificá con `node --version`
- **Claude Code** — instalalo con `npm install -g @anthropic-ai/claude-code`
- Credenciales de Trello y/o Jira

---

## Instalación

### 1. Clonar y buildear

```bash
git clone https://github.com/tu-usuario/pm-mcp.git
cd pm-mcp
npm install
npm run build
```

### 2. Registrar el MCP en Claude

Ejecutá **uno o ambos** comandos según lo que uses. Reemplazá `/ruta/al/repo` con la ruta absoluta donde clonaste el proyecto (ej: `/Users/tu-usuario/pm-mcp`).

**Para Trello:**

```bash
claude mcp add trello \
  -e TRELLO_API_KEY=tu_api_key \
  -e TRELLO_TOKEN=tu_token \
  -- node /ruta/al/repo/dist/index.js
```

**Para Jira:**

```bash
claude mcp add jira \
  -e JIRA_HOST=tu-empresa.atlassian.net \
  -e JIRA_EMAIL=tu@email.com \
  -e JIRA_API_TOKEN=tu_token \
  -- node /ruta/al/repo/dist/index.js
```

> Podés registrar ambos con nombres distintos (`trello` y `jira`) y el mismo binario los maneja.

Para verificar que quedó registrado:

```bash
claude mcp list
```

---

## Cómo obtener tus credenciales

### Trello

1. Entrá a [https://trello.com/app-key](https://trello.com/app-key)
2. Copiá la **API Key**
3. Hacé click en el link **"Token"** de la misma página y autorizá la app
4. Copiá el token generado

### Jira

1. Entrá a [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click en **"Create API token"**, poné un nombre descriptivo
3. Copiá el token (solo aparece una vez)
4. El `JIRA_HOST` es tu dominio de Atlassian: `mi-empresa.atlassian.net` (sin `https://`)

---

## Paso a paso: cómo usarlo en Claude Code

1. Abrí Claude Code en la terminal: `claude`
2. Verificá que el MCP esté activo con `/mcp` — vas a ver `trello` y/o `jira` en la lista
3. Pedile a Claude que lea una tarjeta o issue:
   - Trello: `"Leé la tarjeta de Trello con ID abc123def456"`
   - Jira: `"Leé el issue de Jira PROJ-456"`
   - También podés pegar la URL completa y Claude extrae el ID solo
4. Claude va a resumir lo que leyó y hacerte preguntas antes de arrancar

**¿Dónde encuentro el ID de una tarjeta de Trello?**  
En la URL de la tarjeta: `https://trello.com/c/`**`abc123`**`/nombre-de-la-tarjeta`

**¿Dónde encuentro la clave de un issue de Jira?**  
Es el prefijo que aparece en el título del issue: **`PROJ-456`** — nombre del proyecto + número.

---

## Técnico: arquitectura y herramientas

### Herramientas MCP expuestas

| Herramienta | Parámetro | Descripción |
|---|---|---|
| `get_trello_card` | `card_id: string` | Fetcha una tarjeta de Trello por ID |
| `get_jira_issue` | `issue_key: string` | Fetcha un issue de Jira por clave (ej: PROJ-123) |

### Qué devuelve cada herramienta

Ambas herramientas devuelven un array de bloques MCP:

- Un bloque **texto** con el contenido formateado en Markdown (título, metadatos, descripción, comentarios, adjuntos)
- Un bloque **texto** + un bloque **imagen** por cada imagen adjunta (base64, máx 5MB cada una)

### Datos que se traen

**Trello:**
- Nombre, descripción, lista/columna, labels, fecha de vencimiento
- Miembros asignados, URL corta
- Comentarios (autor, fecha, texto)
- Checklists con estado de cada ítem
- Adjuntos no-imagen (nombre, tipo MIME)
- Imágenes adjuntas (descargadas y embebidas)

**Jira:**
- Resumen, tipo de issue, estado, prioridad
- Asignado, reportado por, labels, componentes
- Descripción (convertida de Atlassian Document Format a texto plano)
- Comentarios (con paginación automática si hay muchos)
- Adjuntos no-imagen
- Imágenes adjuntas (con manejo correcto de redirects a URLs firmadas de Atlassian)

### Stack técnico

- **TypeScript** con modo estricto, target ES2022, módulos ESM (NodeNext)
- **@modelcontextprotocol/sdk** — transport stdio
- **Node.js fetch nativo** (18+) — sin dependencias HTTP externas
- Llamadas a APIs en paralelo con `Promise.all()`
- Tests con **Jest + ts-jest**

### Estructura del proyecto

```
pm-mcp/
├── src/
│   ├── index.ts         # Servidor MCP y handlers de herramientas
│   ├── trello.ts        # Cliente de la API de Trello
│   ├── jira.ts          # Cliente de la API de Jira
│   └── trello.test.ts   # Tests unitarios
├── dist/                # JS compilado (generado por npm run build)
└── package.json
```

### Comandos de desarrollo

```bash
npm run build   # Compilar TypeScript
npm test        # Correr tests
npm start       # Iniciar el servidor directamente (para debug)
```

---

## Preguntas frecuentes

**¿Mis credenciales son seguras?**  
Las credenciales se pasan directamente como variables de entorno en el comando `claude mcp add` y nunca quedan en el código ni en el repositorio.

**¿Cómo desregistro el MCP?**

```bash
claude mcp remove trello
claude mcp remove jira
```
