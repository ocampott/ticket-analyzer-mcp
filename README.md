# pm-mcp

Un MCP para Claude Code que conecta Trello y Jira, analiza tickets dentro del contexto de tu código y construye memoria local del proyecto para evitar exploraciones repetitivas.

La idea es simple:

En vez de copiar tickets manualmente, pegar contexto en el chat y hacer que Claude explore todo el repositorio desde cero cada vez, le das acceso directo a la tarjeta o issue y te ayuda a entender cómo implementar ese trabajo dentro del código existente.

---

# ¿Qué hace?

pm-mcp expone seis herramientas:

**Lectura**
* `get_trello_card` — lee una card de Trello por ID
* `get_jira_issue` — lee un issue de Jira por clave

**Búsqueda**
* `list_trello_cards` — lista cards de un board o busca globalmente
* `search_jira_issues` — busca issues con JQL

**Escritura**
* `add_trello_comment` — deja un comentario en una card
* `add_jira_comment` — deja un comentario en un issue

Claude puede leer directamente:

* título, descripción, comentarios
* checklists (ítems pendientes y completados)
* labels con colores (`red: Blocker`, `yellow: Importante`)
* asignados, fechas de vencimiento
* adjuntos e imágenes (opcional)
* subtareas, issue padre, sprint y épica (Jira)

---

# Comandos

Una vez instalado, podés usar estos comandos directamente en Claude Code:

## /pm-analize [id]

Analiza un ticket por ID. Auto-detecta si es Jira o Trello:

```text
/pm-analize PROJ-123
/pm-analize abc123xyz
```

Jira: cualquier clave con formato `PROJ-123` (letras-guión-número).
Trello: cualquier otra cosa.

## /pm-search-ticket [jira|trello] [query]

Busca tickets en lenguaje natural, muestra una lista numerada y te deja elegir cuál analizar:

```text
/pm-search-ticket jira tickets del sprint actual en doing sobre autenticación
/pm-search-ticket trello cards de la lista In Progress sobre pagos
```

Para Jira, Claude traduce el query a JQL automáticamente.

## /pm-update

Actualiza pm-mcp a la última versión sin salir de Claude Code:

```text
/pm-update
```

Detecta automáticamente dónde está instalado el repo, hace `git pull`, reconstruye y reinstala los comandos. Pedirá que reinicies Claude Code al terminar.

---

# ¿Por qué existe?

Porque los tickets suelen decir qué hay que hacer.

Pero normalmente no dicen:

* dónde tocar código
* qué archivos modificar
* qué patrón reutilizar
* qué implementación similar ya existe
* qué riesgos existen
* qué partes del sistema están involucradas

pm-mcp ayuda a cerrar esa brecha.

---

# Flujo típico

```text
Ticket
 ↓
pm-mcp
 ↓
Claude analiza el ticket
 ↓
Consulta contexto y patrones existentes
 ↓
Explora el proyecto si hace falta
 ↓
Identifica impacto técnico
 ↓
Genera plan de implementación
```

El objetivo no es resumir tickets.

El objetivo es responder:

> "¿Cómo implementamos esto en ESTE proyecto?"

---

# ¿Qué pasa cuando Claude analiza un ticket?

Cuando le pedís algo como:

```text
/pm-analize PROJ-123
```

Claude:

1. Lee el contenido del ticket.
2. Consulta el contexto local del proyecto (`.claude/project-context.md`).
3. Consulta patrones previamente descubiertos (`.claude/patterns.md`).
4. Explora el repositorio solo cuando hace falta.
5. Identifica archivos impactados.
6. Busca implementaciones similares ya existentes.
7. Detecta patrones reutilizables.
8. Señala riesgos, dependencias y dudas.
9. Genera un plan de implementación concreto.

La idea es minimizar exploración repetitiva y maximizar reutilización de código existente.

---

# Requisitos

* Node.js 18+
* Claude Code
* Credenciales de Trello y/o Jira

Verificá Node:

```bash
node --version
```

Instalá Claude Code:

```bash
npm install -g @anthropic-ai/claude-code
```

---

# Instalación

## 1. Clonar el repositorio

```bash
git clone https://github.com/ocampott/pm-mcp.git
cd pm-mcp
npm install
npm run build
```

## 2. Registrar el MCP en Claude Code

Reemplazá `/ruta/al/repo` por la ruta donde clonaste el proyecto.

### Trello

```bash
claude mcp add trello \
  -e TRELLO_API_KEY=tu_api_key \
  -e TRELLO_TOKEN=tu_token \
  -- node /ruta/al/repo/dist/index.js
```

Variable opcional: `TRELLO_DEFAULT_BOARD_ID` — si la setés, `list_trello_cards` usa ese board cuando no pasás uno explícito.

### Jira

```bash
claude mcp add jira \
  -e JIRA_HOST=tu-empresa.atlassian.net \
  -e JIRA_EMAIL=tu@email.com \
  -e JIRA_API_TOKEN=tu_token \
  -- node /ruta/al/repo/dist/index.js
```

Podés registrar ambos al mismo tiempo usando nombres distintos.

Verificá que estén activos:

```bash
claude mcp list
```

## 3. Instalar los skills de Claude Code

Los comandos `/pm-analize` y `/pm-search-ticket` son skills de Claude Code incluidos en este repo. Para activarlos copiá el plugin a tu directorio de skills:

```bash
cp -r .claude/skills/pm ~/.claude/skills/pm
```

Luego reiniciá Claude Code o ejecutá `/reload-plugins`. Verificá que esté cargado:

```bash
claude plugin list
```

Deberías ver `pm@skills-dir` con status `loaded`.

---

# Cómo obtener las credenciales

## Trello

1. Entrá a https://trello.com/app-key
2. Copiá tu API Key
3. Hacé click en el link "Token"
4. Autorizá la aplicación
5. Copiá el token generado

Variables necesarias:

```text
TRELLO_API_KEY
TRELLO_TOKEN
```

---

## Jira

1. Entrá a https://id.atlassian.com/manage-profile/security/api-tokens
2. Click en "Create API token"
3. Elegí un nombre
4. Copiá el token generado

Variables necesarias:

```text
JIRA_HOST
JIRA_EMAIL
JIRA_API_TOKEN
```

Ejemplo:

```text
JIRA_HOST=miempresa.atlassian.net
```

Sin `https://`.

---

# Cómo usarlo

## Trello

```text
/pm-analize abc123
```

o pedirle directo a Claude:

```text
Leé la tarjeta de Trello con ID abc123
```

### ¿Dónde encuentro el ID?

En la URL de la card:

```text
https://trello.com/c/abc123/nombre-de-la-tarjeta
                      ^^^^^^
```

---

## Jira

```text
/pm-analize PROJ-123
```

o pedirle directo:

```text
Leé el issue PROJ-123
```

### ¿Dónde encuentro la clave?

```text
PROJ-123
```

aparece en Jira junto al título del issue.

---

# Memoria local del proyecto

pm-mcp puede mantener contexto local dentro de:

```text
.claude/
├── project-context.md
└── patterns.md
```

---

## project-context.md

Contiene una vista resumida del proyecto:

* stack tecnológico
* estructura de carpetas
* convenciones
* arquitectura general
* patrones importantes

Su objetivo es evitar que Claude tenga que redescubrir el proyecto desde cero cada vez.

---

## patterns.md

Contiene conocimiento reutilizable descubierto durante análisis anteriores.

Por ejemplo:

* patrones CRUD
* flujos OAuth
* uploads de archivos
* integraciones externas
* componentes reutilizables

Con el tiempo, Claude construye una especie de mapa mental del proyecto y deja de explorar código que ya conoce.

---

# Preguntas frecuentes

## ¿Mis credenciales son seguras?

Sí. Se pasan como variables de entorno al registrar el MCP y no quedan hardcodeadas en el repositorio.

## ¿Necesito copiar el contenido del ticket?

No. Claude puede leerlo directamente usando las herramientas MCP.

## ¿Claude analiza imágenes?

Sí. Si la tarjeta tiene wireframes, mockups, screenshots o diagramas adjuntos, Claude puede analizarlos junto con el resto del ticket.

## ¿Puedo dejar que Claude comente en el ticket?

Sí. Después de analizar, Claude puede dejar un comentario resumido con los puntos clave del análisis directamente en Jira o Trello.

## ¿Cómo elimino el MCP?

```bash
claude mcp remove trello
claude mcp remove jira
```

---

# Filosofía

pm-mcp no intenta reemplazar Jira ni Trello.

No intenta gestionar proyectos.

No intenta decidir cómo desarrollar una feature.

Su objetivo es darle a Claude el contexto correcto para entender tickets reales y trabajar mejor sobre bases de código reales.

Con cada análisis, Claude puede construir conocimiento local del proyecto mediante `project-context.md` y `patterns.md`, reduciendo exploración repetitiva y reutilizando patrones ya descubiertos.
