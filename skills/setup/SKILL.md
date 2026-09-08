---
description: Set up ticket-analyzer credentials interactively. Wizard for configuring Trello, Jira, and/or Azure DevOps integrations.
disable-model-invocation: true
user-invocable: true
---

You are running the ticket-analyzer setup wizard. Guide the user step by step through credential configuration.

## Step 1 — Check Node Version

Run via Bash:
```bash
node --version
```

Parse the version number (e.g. `v18.12.0` → major = 18).

If major < 18:
> "ticket-analyzer requiere Node.js 18 o superior. Tu versión actual es [version]. Descargá la última LTS desde https://nodejs.org y volvé a intentarlo."

Then STOP — do not continue.

---

## Step 2 — Check for Legacy Manual Installations

Run via Bash:
```bash
claude mcp list 2>/dev/null
```

Scan the output for MCP server names that match any of: `trello`, `jira`, `pm-mcp`, `pm_mcp`.

If legacy entries are found, tell the user:
> "Encontré instalaciones manuales anteriores de ticket-analyzer: [list names]. Estas pueden entrar en conflicto con la instalación via plugin."

Then ask (AskUserQuestion with selectable options):
> "¿Querés eliminar estas instalaciones manuales antes de continuar?"
Options: "Sí, eliminarlas", "No, dejarlas"

If the user selects "Sí, eliminarlas", for each found name run:
```bash
claude mcp remove [name]
```
Report which ones were removed.

---

## Step 3 — Choose Integration

Ask the user (AskUserQuestion, `multiSelect: true`):
> "¿Qué integraciones querés configurar?"
Options:
- "Trello"
- "Jira"
- "Azure DevOps"

Store the selection as `chosen_integrations`.

---

## Step 4 — Collect Credentials

### For Trello (if selected)

Ask the user (AskUserQuestion — open text, one call for both fields):
> "Necesito las credenciales de Trello. Podés obtenerlas en https://trello.com/app-key\n\n1. TRELLO_API_KEY (la clave de la API)\n2. TRELLO_TOKEN (el token de acceso — en la misma página, hacé clic en 'Token')"

Ask for each value in separate AskUserQuestion calls if needed, or accept as numbered responses.

Store as `TRELLO_API_KEY` and `TRELLO_TOKEN`.

### For Jira (if selected)

Ask the user (AskUserQuestion — open text):
> "Necesito las credenciales de Jira.\n\n1. JIRA_HOST — tu subdominio de Atlassian (ej: miempresa.atlassian.net)\n2. JIRA_EMAIL — tu email de la cuenta Atlassian\n3. JIRA_API_TOKEN — generalo en https://id.atlassian.com/manage-profile/security/api-tokens"

Collect each value. Store as `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.

### For Azure DevOps (if selected)

Ask the user (AskUserQuestion — open text):
> "Necesito los datos de Azure DevOps.\n\n1. AZURE_DEVOPS_ORG y 2. AZURE_DEVOPS_PROJECT — salen de la URL de tu tablero: `https://dev.azure.com/{ORG}/{PROJECT}/_workitems`\n3. AZURE_DEVOPS_PAT — generalo en `https://dev.azure.com/{ORG}/_usersSettings/tokens` → **+ New Token** → Scopes: **Custom defined** → **Work Items: Read** (agregá *Read & Write* solo si querés poder comentar desde acá). El token se muestra una sola vez."

Collect each value. Store as `AZURE_DEVOPS_ORG`, `AZURE_DEVOPS_PROJECT`, `AZURE_DEVOPS_PAT`.

Pass the project name with real spaces if it has any — the server URL-encodes it.

---

## Step 5 — Register MCP Server

Build the `claude mcp add` command based on the credentials collected.

**Template:**
```bash
claude mcp add pm \
  --transport stdio \
  --env KEY=VALUE \
  -- npx ticket-analyzer-mcp@latest
```

Add only the env vars for the integrations the user chose:
- Trello: `--env TRELLO_API_KEY=[value] --env TRELLO_TOKEN=[value]`
- Jira: `--env JIRA_HOST=[value] --env JIRA_EMAIL=[value] --env JIRA_API_TOKEN=[value]`
- Azure DevOps: `--env AZURE_DEVOPS_ORG=[value] --env AZURE_DEVOPS_PROJECT=[value] --env AZURE_DEVOPS_PAT=[value]`

Run the command. Report success or failure.

If it fails with "already exists":
```bash
claude mcp remove pm
```
Then retry the `claude mcp add` command.

> **Nota de seguridad:** Las credenciales pasadas con `--env` quedan visibles en el historial de shell. Si querés limpiarlas, ejecutá `history -d $(history 1)` (zsh/bash) después del setup.

> **Nota:** Si Claude Code no detecta el server tras el setup, puede que sea necesario reiniciar Claude Code para que cargue el nuevo MCP.

---

## Step 6 — Verify Connection

After registering, call `get_status`. It reports every configured integration at once and needs no placeholder IDs.

Read the result:
- A `✓` on an integration means it authenticated.
- A `✗` means the credentials were rejected — the line carries the reason.
- A `—` means it was not configured.

If `get_status` is unavailable, fall back to a per-integration probe (`get_jira_issue` with `TEST-1`, `get_trello_card` with any ID, `get_azure_work_item` with `1`). A "not found" error still proves the server is running and authenticated.

> **Azure DevOps**: an expired or wrongly-scoped PAT answers HTTP 203 with a sign-in page rather than 401. `get_status` already translates that into "credenciales inválidas o PAT sin scope Work Items" — if you see it, regenerate the PAT with the **Work Items (Read)** scope.

**If the tool call succeeds or returns an expected API error (404, issue not found, card not found):**
> "Conexión verificada. ticket-analyzer está listo."

**If the tool call returns a credential/auth error:**

Remove the already-saved (invalid) MCP entry so no bad credentials persist:
```bash
claude mcp remove pm
```

Then tell the user:
> "Hubo un error de autenticación: [error message]. Las credenciales ingresadas no son válidas — no se guardó nada. Vamos a pedirte las credenciales de nuevo."

Then loop back to **Step 4** to re-collect credentials (do NOT exit the wizard).

**If the tool is not found / server didn't start:**
> "El servidor MCP no respondió. Reiniciá Claude Code y ejecutá `/ticket-analyzer:setup` de nuevo."

---

## Step 7 — Confirm and Summarize

Tell the user:
> "Setup completado. Integraciones configuradas: [list]. Podés usar `/ticket-analyzer:analize [ID]` para analizar tickets o `/ticket-analyzer:search [jira|trello] [query]` para buscar."

If there were any errors that were not resolved, list them clearly so the user knows what to fix manually.
