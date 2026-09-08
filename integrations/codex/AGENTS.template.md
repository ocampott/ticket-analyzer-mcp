# Ticket analysis workflow

This project uses `ticket-analyzer-mcp` 2.0.0. Apply these instructions to natural-language requests; no slash command is required.

## Ticket analysis

1. Detect the provider from explicit wording first. Otherwise, Jira keys match `^[A-Z][A-Z0-9]+-\d+$`, numeric IDs are Azure DevOps work items, and other opaque IDs are Trello card IDs. Ask if the provider is genuinely ambiguous.
2. Fetch with the matching MCP tool: `get_jira_issue` (`issue_key`), `get_azure_work_item` (`work_item_id` as a number), or `get_trello_card` (`card_id`). Start with `include_images: false` and `include_text_attachments: false`.
3. For Azure, read every returned child before planning. If the result says `_Árbol truncado_`, refetch with higher `max_depth` or `max_nodes`; never plan from a partial tree.
4. Use `analyze_ticket` as supporting structured evidence when useful. The consuming agent must interpret the MCP context and produce the final plan.
5. Explore and read the exact relevant project files. Check `.claude/project-context.md` when recent and `.claude/patterns.md` when present, but verify cached guidance against source. Reuse existing patterns.

## Output

For Jira and Trello, return:

```markdown
## Plan de implementación

**Contexto**
Qué debe saber un agente que arranca en frío.

**Pasos**
1. `ruta/exacta` — cambio y mecanismo.

**No toques**
- Riesgos de alcance, comportamiento compartido o atajos que rompen otra cosa.

**Verificación**
Comandos exactos o comportamiento observable.

**Talla:** XS | S | M | L | XL
```

For Azure, return `## Análisis y estimación` plus `## Detalle técnico`, grouped by the areas with real work (`Frontend`, `Backend`, `QA`, `Infra`). Include QA in the estimate and identify work required outside this repository.

Use the project's established language convention (normally concise professional Rioplatense Spanish). Keep technical paths, identifiers, tool names, and commands exact.

## Confirmation gate

Analysis and planning are read-only. Do not edit files, run migrations, or post comments until the user explicitly confirms implementation (for example, “yes, implement it”). After confirmation, implement only the agreed scope, preserve unrelated changes, validate it, and report changed paths and risks.
