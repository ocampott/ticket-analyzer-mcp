# pm-mcp v2 — Design Spec

**Date:** 2026-06-18  
**Status:** Approved

---

## Overview

Extend pm-mcp with search tools, write operations, richer Jira/Trello data, and two new Claude Code skills that surface the MCP as natural-language commands.

---

## 1. New Skills

### `/pm-analize [id]`

**Location:** `~/.claude/plugins/local/pm/skills/pm-analize.md`

**Behavior:**
- Detects platform by regex on `[id]`:
  - `/^[A-Z][A-Z0-9]+-\d+$/` → Jira → calls `get_jira_issue`
  - Anything else → Trello → calls `get_trello_card`
- Executes the full analysis workflow already defined in `CLAUDE.md` (Steps 1–9).
- The skill only does routing. `CLAUDE.md` remains the source of truth for the analysis workflow.

---

### `/pm-search-ticket [jira|trello] [free query]`

**Location:** `~/.claude/plugins/local/pm/skills/pm-search-ticket.md`

**Behavior:**

For **Jira**:
1. Claude translates the free query to JQL.
   - Example: `"tickets del sprint actual en doing sobre auth"` → `sprint in openSprints() AND status = "In Progress" AND text ~ "auth"`
2. Calls `search_jira_issues(jql, max_results?)`.
3. Shows results as a numbered list: `key | summary | status | assignee`.
4. Asks: "¿Querés analizar alguno? Decime el key o el número de la lista."
5. If the user picks one, runs the full analysis workflow (same as `/pm-analize`).

For **Trello**:
1. Claude maps the free query to search parameters (text, list name, labels).
2. Calls `list_trello_cards(board_id?, query?)`.
3. Same results → selection → analysis flow as Jira.

**Skills are global** (`~/.claude/plugins/local/pm/`) so they are available in any project where the MCP is active.

---

## 2. New MCP Tools

### Search tools

**`search_jira_issues(jql, max_results?)`**
- `GET /rest/api/3/search?jql={jql}&maxResults={max_results}&fields=summary,status,assignee,priority`
- Default `max_results: 20`
- Returns: `{ issues: { key, summary, status, assignee, priority }[] }`

**`list_trello_cards(board_id?, list_name?, query?)`**
- At least one of `board_id` or `query` must be provided (validated at call time).
- If `board_id` provided: `GET /1/boards/{board_id}/cards/open?fields=name,idList,labels,due&lists=open`, then filters client-side by `list_name` and/or `query`.
- If only `query` provided (no `board_id`): uses Trello search API `GET /1/search?query={query}&modelTypes=cards&card_fields=name,idList,labels,due`.
- If `TRELLO_DEFAULT_BOARD_ID` env var is set, it is used as the default `board_id` when none is passed explicitly.
- Returns: `{ cards: { id, name, list, labels, due }[] }`

### Write tools

**`add_jira_comment(issue_key, text)`**
- `POST /rest/api/3/issue/{key}/comment`
- Body: minimal ADF (single paragraph, plain text).
- Claude generates `text` with the agreed format: **Resumen + Implementación + Estimación**, max ~10 bullets.

**`add_trello_comment(card_id, text)`**
- `POST /1/cards/{card_id}/actions/comments`
- Plain markdown text, same summarized format as Jira.

---

## 3. Jira Enhancements

### Subtasks
- Add `"subtasks"` to the `fields` array in `getJiraIssue`.
- API returns: `[{ key, fields: { summary, status: { name } } }]`
- New field in `JiraIssueResult`: `subtasks: { key, summary, status }[]`
- Rendered in markdown under `## Subtasks`.

### Parent
- Add `"parent"` to the `fields` array.
- API returns: `{ key, fields: { summary } }`
- New optional field in `JiraIssueResult`: `parent: { key, summary } | null`
- Rendered as a single line in the metadata block.

### Epic / Sprint (auto-detection)
- **New file:** `src/fields.ts` — exports `getJiraCustomFields()`.
- Called once in `main()` before the server starts accepting requests.
- Calls `GET /rest/api/3/field` and searches for fields whose `name` contains "sprint" or "epic link" (case-insensitive).
- Caches result in memory: `{ sprintField: string | null, epicField: string | null }`.
- If Jira credentials are not set at startup, skips silently (logs warning to stderr).
- If fields are found, their IDs are added dynamically to the `fields` array in `getJiraIssue`.
- Rendered in the metadata block: `Sprint: <name>` and `Epic: <key or name>`.

### `max_comments`
- New optional parameter on `get_jira_issue` (default: no limit).
- If set, `fetchAllComments` stops fetching after N total comments, taking the most recent ones first (sorted by `created` desc).

### Retry
- **New file:** `src/retry.ts` — exports `withRetry(fn, options?)`.
- Retries up to 2 times with 1s backoff on HTTP 429 and network errors.
- 4xx errors (except 429) are not retried.
- `fetchJira` wraps its `fetch` call with `withRetry`.

---

## 4. Trello Enhancements

### Label colors
- Change `.map((l) => l.name)` to include color: `l.color && l.name ? \`${l.color}: ${l.name}\` : l.name ?? l.color`.
- Example output: `"red: Blocker"`, `"yellow: Importante"`.

### Completed checklist items
- Show completed items with strikethrough markdown `~~text~~` after pending items.
- Previously only counted in the header (`2/5 hechos`), now visible.

### `max_comments`
- Same pattern as Jira. Trello comments come from `actions` (type `commentCard`).
- If `max_comments` set, slice the most recent N from the already-sorted actions array.

---

## 5. File Structure

**Modified:**
| File | Changes |
|------|---------|
| `src/jira.ts` | Subtasks, parent, epic/sprint fields, retry, max_comments, `add_jira_comment`, `search_jira_issues` |
| `src/trello.ts` | Label colors, completed checklists, max_comments, `add_trello_comment`, `list_trello_cards` |
| `src/index.ts` | Register 4 new tools, call `getJiraCustomFields()` at startup, update formatters |

**New:**
| File | Purpose |
|------|---------|
| `src/fields.ts` | Jira custom field auto-detection, cached in memory |
| `src/retry.ts` | Generic retry wrapper with exponential backoff |
| `~/.claude/plugins/local/pm/skills/pm-analize.md` | `/pm-analize` skill |
| `~/.claude/plugins/local/pm/skills/pm-search-ticket.md` | `/pm-search-ticket` skill |

**Unchanged:**
- `CLAUDE.md` (repo + global) — analysis workflow unchanged
- `package.json` — no new dependencies (all native `fetch`)

---

## 6. Testing

| File | New cases |
|------|-----------|
| `src/jira.test.ts` | Subtasks in response, max_comments truncation, retry on 429, `add_jira_comment` POST mock |
| `src/trello.test.ts` | Label colors format, completed checklist items rendered, `list_trello_cards` filtering |
| `src/fields.test.ts` | Auto-detection with mocked field list, fallback when fields not found |

---

## 7. Out of Scope

- `transition_jira_issue` — status transitions explicitly excluded.
- LLM inside the MCP server for query translation — Claude handles this in the skill.
- Persistent field ID cache (disk) — in-memory cache per server process is sufficient.
