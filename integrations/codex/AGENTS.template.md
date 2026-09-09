# Ticket analysis workflow

This project uses `ticket-analyzer-mcp` 2.2.2. Apply these instructions to natural-language requests; no slash command is required. The package canonical workflow is [`../../AGENTS.md`](../../AGENTS.md) in this distribution; when copying this template, preserve the consumer project's local `AGENTS.md` safety and local instructions. Do not treat the consumer `AGENTS.md` as package authority.

## Ticket analysis

1. Detect the provider from explicit wording first. Otherwise, Jira keys match `^[A-Z][A-Z0-9]+-\d+$`, numeric IDs are Azure DevOps work items, and other opaque IDs are Trello card IDs. Ask if the provider is genuinely ambiguous.
2. Fetch with the matching MCP tool: `get_jira_issue` (`issue_key`), `get_azure_work_item` (`work_item_id` as a number), or `get_trello_card` (`card_id`). Start with `include_images: false` and `include_text_attachments: false`, then read all ticket evidence that can affect the work: comments, children, checklists, refinement decisions, attachment inventory, and relevant attachment contents.
3. For Azure, read every returned child before planning. If the result says `_Árbol truncado_`, refetch with higher `max_depth` or `max_nodes`; never plan from a partial tree.
4. Use `analyze_ticket` as deterministic ticket-only supporting evidence when useful. Its hypotheses are not confirmed requirements, blockers, or estimates; the consuming agent must interpret the MCP context and produce the final plan.
5. Explore and read the exact relevant project files. Check `.claude/project-context.md` and `.claude/patterns.md` when present as navigation hints only, regardless of age. Re-read exact referenced source on every reuse, record actual revision and dirty/unknown status, and never fabricate pattern paths or symbols. Pattern records require a name, exact repo-relative paths and symbols, verified date/revision, dirty/unknown marker, applicability, and limits.
6. Map every requested behavior and restriction to evidence, current implementation, necessary delta, complete plan, and proportional verification. Include Backend, Infra, or other repositories when proven by the ticket or inspected code; otherwise label repository-unverified inferences.

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

Use the project's established language convention (normally concise professional Rioplatense Spanish). Keep technical paths, identifiers, tool names, and commands exact. The complete necessary change is the goal, not a minimized file count or diff. Cache only verified, reusable repository patterns with exact repository-relative source paths and symbols, actual revision/date, dirty or unknown status, applicability, and limits; never persist raw ticket descriptions, comments, or attachments, credentials or secrets, sensitive ticket or person identifiers, or private external context; never fabricate source references or revisions, and never promote guesses to facts.

Analysis is read-only. A CACHE WRITE requires explicit bounded cache-only consent for only `.claude/project-context.md` and/or `.claude/patterns.md`, after verifying they are ignored; it does not authorize application changes, migrations, comments, or `.gitignore` edits; analyze permission and cache-write consent are distinct.

## Confirmation gate

Analysis and planning are read-only. Do not edit files, run migrations, or post comments until the user explicitly confirms implementation (for example, “yes, implement it”). After confirmation, implement the complete necessary scope supported by evidence, preserve unrelated changes, validate proportionally, and report changed paths and risks.
