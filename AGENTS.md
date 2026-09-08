# Ticket Analyzer Agent Workflow

**Instruction contract version: 2.0.0**

This file is the canonical, client-neutral workflow for agents consuming `ticket-analyzer-mcp`. It applies to natural-language requests first; slash commands are compatibility aliases supplied by client adapters.

## 1. Detect the ticket and choose the provider

Extract the ticket identifier and any explicit provider from the user's request.

- Jira keys match `^[A-Z][A-Z0-9]+-\d+$`, for example `PROJ-123`.
- Azure DevOps work item IDs are numeric, for example `1646`.
- Other opaque IDs are treated as Trello card IDs.
- If the user names a provider, honor it. If the format and provider disagree, ask a short clarification instead of guessing.
- If the identifier is ambiguous, use `get_status` only to determine which configured provider can handle it.

Use the matching MCP tool:

- Jira: `get_jira_issue` with `issue_key`.
- Azure DevOps: `get_azure_work_item` with numeric `work_item_id`.
- Trello: `get_trello_card` with `card_id`.

For ticket discovery, use `search_jira_issues`, `search_azure_work_items`, or `list_trello_cards` as appropriate. Natural-language search belongs in the consuming agent; translate it into JQL or WIQL only as required by the selected tool.

## 2. Fetch evidence before interpreting it

Start with images and text attachments disabled (`include_images: false`, `include_text_attachments: false`) to keep the first fetch bounded. Fetch a specific attachment only when it can change the implementation or plan, such as a UI wireframe, schema/query file, data-shape example, or unexplained bug screenshot.

Azure responses can contain the complete hierarchy. Read every returned child before exploring the codebase. If the result says `_Árbol truncado_`, do not produce a final plan: refetch with higher `max_depth` or `max_nodes`.

Use `analyze_ticket` when structured evidence is useful. It is deterministic, repo-free supporting evidence over the normalized ticket; it is **not** the final engineering plan. The consuming agent owns interpretation, codebase exploration, and the final recommendation.

Do not post comments, change ticket state, or use write-capable tools unless the user explicitly asks for that action.

## 3. Explore the consuming codebase

Read `.claude/project-context.md` when present and less than 30 days old, then `.claude/patterns.md` when present. Treat cached context as guidance, not proof: read the exact files relevant to the ticket before planning.

Without a useful cache, inspect the repository structure, stack, entry points, tests, configuration, and established implementation patterns. Reuse existing patterns and name their reference paths. Do not modify files during analysis.

## 4. Interpret and report

Analysis is performed by the consuming agent with the MCP context. Keep the result concise and in natural Rioplatense Spanish when the project convention calls for it; technical identifiers, paths, tool names, and commands remain exact.

For Jira and Trello, return a copyable implementation plan:

```markdown
## Plan de implementación

**Contexto**
Qué debe saber un agente que arranca en frío.

**Pasos**
1. `exact/path` — cambio y mecanismo; citar una referencia existente cuando sea útil.

**No toques**
- Radio de impacto, comportamiento compartido o atajos tentadores que hay que evitar.

**Verificación**
Comandos exactos o comportamiento observable.

**Talla:** XS | S | M | L | XL
```

For Azure DevOps, return both `## Análisis y estimación` and `## Detalle técnico`, grouped by the areas that have real work (`Frontend`, `Backend`, `QA`, `Infra`). Include QA in the estimate, never hide work required outside the current repository, and propose a split for `XL` work. Keep private patterns, risks, and unresolved questions outside the copyable block.

Every implementation step must name an exact path or endpoint. Do not invent files when exploration has not established them.

## 5. Explicit implementation gate

Stop after presenting the analysis and plan. Ask whether the user wants implementation to begin. Do not edit code, generate a patch, run migrations, or post a ticket comment before an explicit confirmation such as “yes, implement it”.

After confirmation, implement only the agreed scope, preserve unrelated changes, run the relevant validation, and report changed paths and remaining risks. A request to analyze, explain, or plan alone is never confirmation to modify code.
