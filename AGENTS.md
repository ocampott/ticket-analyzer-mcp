# Ticket Analyzer Agent Workflow

**Instruction contract version: 3.0.0**

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

Start with images and text attachments disabled (`include_images: false`, `include_text_attachments: false`) to keep the first fetch bounded. Then fetch and read **all ticket evidence** that can affect the work: the description, acceptance criteria, comments, checklists, child items, status/refinement decisions, attachment inventory, and the contents of every relevant attachment. Fetch a specific attachment when it can change the implementation or plan, such as a UI wireframe, schema/query file, data-shape example, or unexplained bug screenshot.

Azure responses can contain the complete hierarchy. Read every returned child before exploring the codebase. If the result says `_Árbol truncado_`, do not produce a final plan: refetch with higher `max_depth` or `max_nodes`. Read relevant refinement decisions in comments and child work items before treating a requirement as settled.

Use `analyze_ticket` when structured evidence is useful. It is deterministic, repo-free supporting evidence over the normalized ticket; its hypotheses are **not confirmed requirements, blockers, or estimates**, and it is **not** the final engineering plan. The consuming agent owns interpretation, codebase exploration, and the final recommendation.

Do not post comments, change ticket state, or use write-capable tools unless the user explicitly asks for that action.

## 3. Explore the consuming codebase

Read `.claude/project-context.md` and `.claude/patterns.md` when present, regardless of age. They are navigation hints only: a fresh date or SHA does not replace re-reading the exact referenced source on every reuse, and a dirty or unknown working tree must be recorded rather than treated as clean. A reusable pattern record requires its name, exact repository-relative paths and symbols, verified date and actual revision, dirty/unknown marker, applicability, and limits. Never fabricate revisions or symbols; update or deduplicate stale records instead of appending blindly.

Without useful cache guidance, inspect the repository structure, stack, entry points, tests, configuration, and established implementation patterns. Reuse patterns only after revalidating their exact source and name those paths. Do not modify files during analysis. Analysis is read-only: a CACHE WRITE requires explicit, bounded cache-only consent covering only `.claude/project-context.md` and/or `.claude/patterns.md`; it never authorizes application changes, migrations, comments, or `.gitignore` edits. Before any such write, verify the consuming repository ignores the cache paths; otherwise pause and report the decision. Permission to analyze/fetch and cache-write consent are distinct; no cache writes are implied by analyzing a ticket. Cache only verified, reusable repository patterns with exact repository-relative source paths and symbols, actual revision/date, dirty or unknown status, applicability, and limits; never persist raw ticket descriptions, comments, or attachments, credentials or secrets, sensitive ticket or person identifiers, or private external context; never fabricate source references or revisions, and never promote guesses to facts. Never fabricate nonexistent symbols, full tickets, or guesses as facts, and use no external memory.

## 4. Interpret and report

Before writing the result, build an evidence map for **every requested behavior and restriction**: ticket/refinement evidence, exact consuming-repository source and symbols, current implementation, and the necessary change. Classify each item as **already exists**, **necessary delta**, or unresolved; then give a complete plan and proportional verification. Include backend, infra, or other repositories when the ticket or inspected source proves they are needed, not from keyword guesses. If code or evidence is unavailable, say it is repository-unverified without claiming unnecessary work or blocking by assumption. Ask only implementation-changing questions.

Analysis is performed by the consuming agent with the MCP context. Keep the result concise but complete, in natural Rioplatense Spanish when the project convention calls for it; technical identifiers, paths, tool names, and commands remain exact. Do not force generic sections when a compact response covers the evidence.

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

For Azure DevOps, return both `## Análisis y estimación` and `## Detalle técnico`, grouped by the areas that have real work (`Frontend`, `Backend`, `QA`, `Infra`). Include QA in the estimate, state justified assumptions, never hide work required outside the current repository, and propose a split for `XL` work. Keep private patterns, risks, and unresolved questions outside the copyable block.

Every implementation step must name an exact path or endpoint. Do not invent files when exploration has not established them.

## 5. Explicit implementation gate

Stop after presenting the analysis and plan. Ask whether the user wants implementation to begin. Do not edit code, generate a patch, run migrations, or post a ticket comment before an explicit confirmation such as “yes, implement it”.

After confirmation, implement the complete necessary scope supported by the evidence and agreed boundary, preserve unrelated changes, run proportional validation, and report changed paths and remaining risks. A request to analyze, explain, or plan alone is never confirmation to modify code.
