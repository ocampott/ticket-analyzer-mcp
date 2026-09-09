---
description: Search Jira, Trello, or Azure DevOps tickets using natural language. Usage: /ticket-analyzer:search [jira|trello|azure] [free query]
disable-model-invocation: true
user-invocable: true
---

The user wants to search PM tickets. Input received: **{{args}}**

## Parse Input

Split `{{args}}`:
- **First word** = platform (`jira`, `trello`, or `azure`)
- **Everything after** = the free-text query

If the platform word is missing or not one of those, reply:
> "Usá `/ticket-analyzer:search jira [query]`, `trello [query]` o `azure [query]`."
Then stop.

---

## For Jira

**1. Translate the query to JQL.** Use these mappings as building blocks:

| User says | JQL fragment |
|-----------|-------------|
| "sprint actual" / "sprint corriente" | `sprint in openSprints()` |
| "en doing" / "en progreso" / "in progress" | `status = "In Progress"` |
| "sin asignar" | `assignee is EMPTY` |
| "bugs" / "errores" | `issuetype = Bug` |
| "alta prioridad" | `priority = High` |
| "sobre X" / keyword topic | `text ~ "X"` |

Combine fragments with `AND`. Example: `"tickets del sprint actual en doing sobre auth"` → `sprint in openSprints() AND status = "In Progress" AND text ~ "auth"`.

**2. Call `search_jira_issues`** with the JQL and `max_results: 10`.

**3. Display results** as a numbered list:
```
1. PROJ-123 — Summary of the ticket
   In Progress | Alice García | High
2. PROJ-124 — Another ticket
   To Do | (sin asignar)
```

**4. Ask:** "¿Querés analizar alguno? Escribí el número o el key."

**5. When the user replies**, run the current ticket-analysis workflow from the canonical package guidance with that issue key, as if the user had called `/ticket-analyzer:analize [key]`.

---

## For Trello

**1. Determine board context:**
- If the user mentioned a board name or ID in the query, extract it as `board_id`.
- Otherwise, omit `board_id` (the tool uses `TRELLO_DEFAULT_BOARD_ID` env var if set, or falls back to global search).

**2. Call `list_trello_cards`** with:
- `board_id`: if determined above
- `query`: the free-text portion of the search

**3. Display results** as a numbered list:
```
1. `5e8f8f8e` — Card name here
   Lista: In Progress | Labels: red: Blocker
2. `abc12345` — Another card
   Lista: To Do
```

**4. Ask:** "¿Querés analizar alguna? Escribí el número."

**5. When the user replies**, run the current ticket-analysis workflow from the canonical package guidance with that card ID.

---

## For Azure DevOps

**1. Translate the query to a WIQL `WHERE` clause.** Use these mappings as building blocks:

| User says | WIQL fragment |
|-----------|--------------|
| "iteración actual" / "sprint actual" | `[System.IterationPath] = @CurrentIteration` |
| "en doing" / "en progreso" | `[System.State] = 'Active'` |
| "cerrados" / "terminados" | `[System.State] = 'Closed'` |
| "sin asignar" | `[System.AssignedTo] = ''` |
| "míos" / "asignados a mí" | `[System.AssignedTo] = @Me` |
| "bugs" / "errores" | `[System.WorkItemType] = 'Bug'` |
| "historias" / "user stories" | `[System.WorkItemType] = 'User Story'` |
| "tasks" / "tareas" | `[System.WorkItemType] = 'Task'` |
| "alta prioridad" | `[Microsoft.VSTS.Common.Priority] <= 2` |
| "sobre X" / keyword topic | `[System.Title] CONTAINS 'X'` |
| "con el tag X" | `[System.Tags] CONTAINS 'X'` |

Combine with `AND`. Example: `"user stories activas sobre pagos"` → `[System.WorkItemType] = 'User Story' AND [System.State] = 'Active' AND [System.Title] CONTAINS 'pagos'`.

**2. Call `search_azure_work_items`** with the clause as `wiql` and `max_results: 10`. The tool wraps a bare `WHERE` clause into a full query — only send a full `SELECT` when the user needs custom ordering.

**3. Display results** as a numbered list:
```
1. 1596 — [CMMC] Asignaciones y conteo proveniente de memoq
   User Story | Active | Tomas Ocampo | TerraSoft\124
2. 1660 — No se crean entregas
   Task | New | Tomas Ocampo
```

**4. Ask:** "¿Querés analizar alguno? Escribí el número o el ID."

**5. When the user replies**, run the current ticket-analysis workflow from the canonical package guidance with that work item ID.
