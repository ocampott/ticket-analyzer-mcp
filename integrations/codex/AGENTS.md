# Codex adapter for ticket-analyzer-mcp

**Instruction adapter version: 2.0.0**

Use this adapter with the canonical workflow in the repository root `AGENTS.md` (server distribution `2.1.0`). When installing into another project, merge `AGENTS.template.md` into that project's existing `AGENTS.md`; do not overwrite its instructions.

The adapter makes natural-language ticket requests primary. Recognize requests such as:

- “Analyze Azure DevOps ticket 1646.”
- “Make an implementation plan for Jira PROJ-123.”
- “Understand Trello card abc123 before we code it.”

For each request, detect the provider from explicit wording or the identifier, call the corresponding MCP tool, read the complete ticket and relevant codebase files, and report a concise implementation plan. Use `analyze_ticket` only as deterministic supporting evidence; the consuming agent owns interpretation and the final plan.

Always analyze and plan first. Do not edit files, run migrations, or post ticket comments until the user explicitly confirms implementation. Preserve unrelated changes and name exact paths in the plan.
