---
description: Set up pm-mcp credentials interactively. Wizard for configuring Trello and/or Jira integrations.
---

You are running the pm-mcp setup wizard. Guide the user step by step through credential configuration.

## Step 1 — Check Node Version

Run via Bash:
```bash
node --version
```

Parse the version number (e.g. `v18.12.0` → major = 18).

If major < 18:
> "pm-mcp requiere Node.js 18 o superior. Tu versión actual es [version]. Descargá la última LTS desde https://nodejs.org y volvé a intentarlo."

Then STOP — do not continue.

---

## Step 2 — Check for Legacy Manual Installations

Run via Bash:
```bash
claude mcp list 2>/dev/null
```

Scan the output for MCP server names that match any of: `trello`, `jira`, `pm-mcp`, `pm_mcp`.

If legacy entries are found, tell the user:
> "Encontré instalaciones manuales anteriores de pm-mcp: [list names]. Estas pueden entrar en conflicto con la instalación via plugin."

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

Ask the user (AskUserQuestion with selectable options):
> "¿Qué integraciones querés configurar?"
Options:
- "Solo Trello"
- "Solo Jira"
- "Ambas (Trello + Jira)"

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

---

## Step 5 — Register MCP Server

Build the `claude mcp add` command based on the credentials collected.

**Template:**
```bash
claude mcp add pm-mcp \
  --transport stdio \
  --env KEY=VALUE \
  -- npx pm-mcp@latest
```

Add only the env vars for the integrations the user chose:
- Trello: `--env TRELLO_API_KEY=[value] --env TRELLO_TOKEN=[value]`
- Jira: `--env JIRA_HOST=[value] --env JIRA_EMAIL=[value] --env JIRA_API_TOKEN=[value]`

Run the command. Report success or failure.

If it fails with "already exists":
```bash
claude mcp remove pm-mcp
```
Then retry the `claude mcp add` command.

---

## Step 6 — Verify Connection

After registering, test the connection by calling a lightweight MCP tool:

- **If Jira was configured**: call `get_jira_issue` with a placeholder key like `TEST-1`. A "not found" error is fine — it proves the server is running and authenticated.
- **If only Trello was configured**: call `get_trello_card` with a placeholder ID. Same — any response (including error) that comes from the server proves connectivity.

**If the tool call succeeds or returns an expected API error (404, issue not found, card not found):**
> "Conexión verificada. pm-mcp está listo."

**If the tool call returns a credential/auth error:**
> "Hubo un error de autenticación: [error message]. Verificá las credenciales e intentá de nuevo con `/pm-setup`."

**If the tool is not found / server didn't start:**
> "El servidor MCP no respondió. Reiniciá Claude Code y ejecutá `/pm-setup` de nuevo."

---

## Step 7 — Confirm and Summarize

Tell the user:
> "Setup completado. Integraciones configuradas: [list]. Podés usar `/pm-analize [ID]` para analizar tickets o `/pm-search-ticket [jira|trello] [query]` para buscar."

If there were any errors that were not resolved, list them clearly so the user knows what to fix manually.
