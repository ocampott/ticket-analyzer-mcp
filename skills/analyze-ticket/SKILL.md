---
name: analyze-ticket
description: Analyze a Trello card, Jira issue, or Azure DevOps work item from a natural-language request. Use when the user asks to analyze, understand, scope, or plan a ticket, including requests such as "analyze Azure ticket 1646" or "make an implementation plan for PROJ-123". Do not require a slash command.
argument-hint: "[ticket ID or provider + ticket]"
disable-model-invocation: false
user-invocable: false
---

You are handling a ticket-analysis request. Natural language is the primary interface; do not ask the user to restate the request as `/ticket-analyzer:analize`.

1. Read the repository's `AGENTS.md` and follow its ticket workflow. If it is unavailable, apply the same contract: detect the provider, fetch the complete ticket, explore the relevant codebase, and produce a concise plan before changing anything.
2. Extract the provider and identifier from the request. Prefer an explicitly named provider; otherwise use Jira key format, numeric Azure DevOps ID, or Trello ID fallback. Ask only when the provider is genuinely ambiguous.
3. Fetch the ticket with the matching MCP tool and start with `include_images: false` and `include_text_attachments: false`. For Azure, read all returned children and stop if the hierarchy is truncated until it can be fetched completely.
4. Use `analyze_ticket` for structured supporting evidence when helpful. Interpret the MCP context yourself: its deterministic output is not the final implementation plan.
5. Read cached project context and patterns, then explore and read the exact relevant files. Reuse existing codebase patterns and name exact paths in the result.
6. Report in the project's established language convention (normally concise professional Rioplatense Spanish) using the output format in `AGENTS.md`. Keep technical paths, identifiers, tool names, and commands exact.
7. Stop after the analysis. Do not edit files, run migrations, post comments, or invoke write-capable tools until the user explicitly confirms implementation.

The existing `analize` slash skill is a compatibility alias and is intentionally not model-invoked; use this skill for model-invoked natural-language analysis.
