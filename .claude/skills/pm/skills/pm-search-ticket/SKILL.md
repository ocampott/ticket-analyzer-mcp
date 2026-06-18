---
name: pm-search-ticket
description: Search Jira or Trello tickets using natural language. Usage: /pm-search-ticket [jira|trello] [free query]
---

The user wants to search PM tickets. Input received: **{{args}}**

## Parse Input

Split `{{args}}`:
- **First word** = platform (`jira` or `trello`)
- **Everything after** = the free-text query

If the platform word is missing or not `jira`/`trello`, reply:
> "Usá `/pm-search-ticket jira [query]` o `/pm-search-ticket trello [query]`."
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

**5. When the user replies**, run the full analysis workflow from CLAUDE.md (Pasos 1–9) with that issue key, as if the user had called `/pm-analize [key]`.

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

**5. When the user replies**, run the full analysis workflow from CLAUDE.md (Pasos 1–9) with that card ID.
