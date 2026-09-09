# Codex adapter for ticket-analyzer-mcp

**Instruction adapter version: 3.0.0**

Use this adapter with the package canonical workflow in the repository root [`AGENTS.md`](../../AGENTS.md) (server distribution `2.2.1`). When installing into another project, resolve and copy that package workflow from this distribution, then merge `AGENTS.template.md` into the consumer project's existing `AGENTS.md`; do not overwrite its local instructions. The consumer `AGENTS.md` supplies local safety and project guidance. Do not treat the consumer `AGENTS.md` as package authority or as a substitute for the package canonical workflow.

The adapter makes natural-language ticket requests primary. It is standalone: merge it with an existing consumer `AGENTS.md` rather than replacing the adapter contract with unrelated repository instructions. Recognize requests such as:

- “Analyze Azure DevOps ticket 1646.”
- “Make an implementation plan for Jira PROJ-123.”
- “Understand Trello card abc123 before we code it.”

For each request, detect the provider from explicit wording or the identifier, call the corresponding MCP tool, read all ticket evidence and relevant refinement decisions, then read the exact source in the consuming repository. Map every requested behavior and restriction to evidence, current implementation, necessary delta, complete plan, and proportional verification. Include Backend, Infra, or other repositories when the ticket or inspected code proves they are needed; otherwise label repository-unverified inferences. Use `analyze_ticket` only as deterministic ticket-only supporting evidence; its hypotheses are not confirmed requirements, blockers, or estimates, and the consuming agent owns interpretation and the final plan.

The complete necessary change is the goal, not a minimized file count or diff. Cached `.claude/project-context.md` and `.claude/patterns.md` are navigation hints only; re-read exact referenced source every time, record actual revision and dirty/unknown status, and never fabricate pattern paths or symbols. Pattern records require a name, exact repo-relative paths and symbols, verified date/revision, dirty/unknown marker, applicability, and limits. A CACHE WRITE requires explicit bounded cache-only consent for only those two paths after verifying they are ignored; it does not authorize application changes, migrations, comments, or `.gitignore` edits; analyze permission and cache-write consent are distinct. Cache only verified, reusable repository patterns with exact repository-relative source paths and symbols, actual revision/date, dirty or unknown status, applicability, and limits; never persist raw ticket descriptions, comments, or attachments, credentials or secrets, sensitive ticket or person identifiers, or private external context; never fabricate source references or revisions, and never promote guesses to facts.

Always analyze and plan first. Do not edit files, run migrations, or post ticket comments until the user explicitly confirms implementation. Preserve unrelated changes and name exact paths in the plan.
