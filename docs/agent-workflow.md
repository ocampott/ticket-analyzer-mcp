# Shared agent workflow

`ticket-analyzer-mcp` is a standard, client-neutral MCP server. The consuming agent performs repository exploration and interpretation; the server provides provider data and deterministic structured evidence.

The canonical instructions are in the repository root [`AGENTS.md`](../AGENTS.md). Claude Code's model-invoked skill and the Codex adapter both point to that contract. The Codex-installable snapshot is [`integrations/codex/AGENTS.template.md`](../integrations/codex/AGENTS.template.md).

## Contract

1. Detect the provider from explicit user wording, then identifier format: Jira keys such as `PROJ-123`, numeric Azure DevOps IDs such as `1646`, and other opaque IDs as Trello card IDs. Ask when ambiguous.
2. Fetch the complete ticket with the provider tool. Start with images and text attachments disabled; fetch a specific attachment only when it can affect the plan. Read every Azure child and never plan from a truncated tree.
3. Use `analyze_ticket` only for supporting structured evidence. It does not replace the consuming agent's interpretation or implementation plan.
4. Read recent cached project context and known patterns, then inspect the exact relevant source files. Analysis is read-only.
5. Return a concise plan with exact paths, dependencies, verification, risks, and size. Azure plans additionally include an estimate by work area and always include QA.
6. Wait for an explicit implementation confirmation before editing code, running migrations, or posting ticket comments.

Natural-language requests are the primary interface. Client slash commands, where available, are compatibility aliases and must not be the only route to this workflow.

## Version alignment

The server package, Claude plugin metadata, root instructions, Claude model-invoked skill, and Codex adapter are aligned at **2.0.0**. Update the adapter snapshot whenever the workflow contract changes.
