---
description: Analyze a PM ticket (Trello card or Jira issue) by ID. Auto-detects platform, fetches full content, explores your codebase, and produces a concrete implementation plan.
---

You are analyzing a PM ticket. The ticket ID is: **$ARGUMENTS**

---

## Step 1 — Detect Platform

Check the format of `$ARGUMENTS`:
- Matches `^[A-Z][A-Z0-9]+-\d+$` (e.g. `PROJ-123`, `AUTH-42`) → **Jira**
- Anything else (e.g. `5e8f8f8e`, `abc123xyz`) → **Trello**

---

## Step 2 — Ask About Attachments

Before fetching, ask with a single `AskUserQuestion` call containing two questions:

1. "Do you want me to analyze image attachments? (Useful for wireframes and mockups — skipping saves tokens if not needed.)"
   Options: "Yes, include images", "No, skip images"

2. "Do you want me to read text file attachments? (.html, .sql, .txt, .json, etc. — can add tokens depending on file size.)"
   Options: "Yes, include text files", "No, skip them"

Store the answers as `include_images` (true/false) and `include_text_attachments` (true/false).

---

## Step 3 — Fetch the Ticket

Call the appropriate tool:

- **Jira**: `get_jira_issue` with `issue_key: "$ARGUMENTS"`, `include_images`, `include_text_attachments`
- **Trello**: `get_trello_card` with `card_id: "$ARGUMENTS"`, `include_images`, `include_text_attachments`

---

## Step 4 — Load Project Context

Try to read `.claude/project-context.md`:
- **Exists and is recent (< 30 days)**: use it to guide codebase exploration.
- **Exists but older than 30 days**: treat as absent.
- **Absent**: you will explore the project from scratch in Step 5.

Also try to read `.claude/patterns.md`:
- **Exists**: cross-reference known patterns before exploring. Reuse documented references directly.
- **Absent**: detect patterns during exploration if relevant.

---

## Step 5 — Explore the Codebase

**If project context was loaded**: navigate directly to files most likely impacted by this ticket. Still read those files before answering.

**If no project context**: explore from scratch using `find`, `ls`, and `Read`. Understand:
- Folder structure and tech stack
- Naming conventions and code organization
- Key patterns and entry points

Then identify files, services, APIs, models, and components related to the ticket.

---

## Step 6 — Produce the Analysis

Think deeply, answer concisely. Bullets over paragraphs. Mention exact file paths whenever possible. Reuse existing patterns — never introduce new ones. Maximum 15 bullet points total across all sections.

Output **only** in this format:

---

## Summary
<1-2 sentences>

## Impact
- path/to/file
- path/to/file

## Implementation
- Step 1
- Step 2
- Step 3

## Patterns found
*(omit if no reusable patterns are relevant)*
**Reference:** path/to/component-or-module
**Files:** file1.js, file2.js
**Usage:** What this pattern does in the context of this ticket.

## Risks
*(omit if no real risks)*
- Risk 1

## Open questions
*(omit if requirements are clear)*
- Question 1

## Estimate
S | M | L | XL

---

## Step 7 — Save Project Context (only if explored from scratch)

If Step 5 required a full exploration (no cached context), save two files after presenting the analysis:

**`.claude/project-context.md`:**
```
<!-- Generated: YYYY-MM-DD -->
[Structured summary: tech stack, folder structure, key conventions, important patterns. Max 200 words.]
```

**`.claude/patterns.md`** (only if relevant patterns were found):
```
<!-- Generated: YYYY-MM-DD | Last updated: YYYY-MM-DD -->
[Concrete reusable patterns found during exploration]
```

Both files are gitignored — they're local to each developer's machine.

---

## Step 8 — Handle Open Questions

If the analysis includes "Open questions", present them with `AskUserQuestion`:
- Questions with discrete options (yes/no, A/B) → selectable options (max 4 per question)
- Genuinely open questions → numbered list in text, ask the user to reply with number + answer
- Prioritize questions that block the design

---

## Step 9 — Offer Next Step

Once open questions are resolved (or if there were none), say:

> "Analysis ready. Want to start implementing? Just let me know how you'd like to proceed — I can help you plan it out step by step."
