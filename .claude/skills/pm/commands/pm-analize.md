---
description: Analyze a PM ticket (Trello card or Jira issue) by ID. Auto-detects platform from ID format.
---

You are analyzing a PM ticket. The ID provided as argument is: **{{args}}**

## Step 1 — Detect Platform

Check the format of `{{args}}`:
- Matches regex `^[A-Z][A-Z0-9]+-\d+$` (e.g. `PROJ-123`, `AUTH-42`, `MYAPP-1`) → **Jira** → use `get_jira_issue`
- Anything else (e.g. `5e8f8f8e`, `abc123xyz`) → **Trello** → use `get_trello_card`

## Step 2 — Run Analysis Workflow

Follow the full analysis workflow defined in `## Análisis de tarjetas y issues` in your CLAUDE.md, starting from **Paso 1** (preguntarle al usuario sobre imágenes), using the detected ticket ID.

Do not skip any steps. CLAUDE.md is the source of truth for the workflow.
