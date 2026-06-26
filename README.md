# ticket-analyzer-mcp

A Claude Code plugin that connects Trello and Jira directly to your coding session. Fetch any ticket, and Claude reads it in full context — description, comments, checklists, attachments, labels, sprint, epic — then maps it to your actual codebase to give you a concrete implementation plan.

No more copy-pasting tickets into the chat. No more asking Claude to explore the whole repo from scratch every time.

---

## What it does

Exposes six MCP tools to Claude:

| Tool | Description |
|------|-------------|
| `get_trello_card` | Fetch a Trello card by ID |
| `get_jira_issue` | Fetch a Jira issue by key |
| `list_trello_cards` | List or search cards on a board |
| `search_jira_issues` | Search issues with natural language (auto-translated to JQL) |
| `add_trello_comment` | Post a comment on a Trello card |
| `add_jira_comment` | Post a comment on a Jira issue |

Claude can also read image attachments (wireframes, mockups) and text attachments (`.html`, `.sql`, `.txt`, `.json`) directly from the ticket — it asks before fetching to keep token usage in check.

---

## Commands

Once installed, use these skills inside Claude Code:

```
/ticket-analyzer:analize PROJ-123       # Jira issue
/ticket-analyzer:analize abc123xyz      # Trello card (auto-detected)

/ticket-analyzer:search jira bugs in current sprint assigned to me
/ticket-analyzer:search trello cards in "In Progress" about payments

/ticket-analyzer:setup                  # Configure credentials (first-time wizard)
/ticket-analyzer:update                 # Update to the latest version
```

---

## Installation

### 1. Add the marketplace source

```bash
claude plugin marketplace add ticket-analyzer --source github --repo ocampott/pm-mcp
```

### 2. Install the plugin

```bash
claude plugin install ticket-analyzer-mcp
```

### 3. Run the setup wizard

Inside Claude Code:

```
/ticket-analyzer:setup
```

The wizard walks you through entering your Trello and/or Jira credentials and verifies the connection before saving anything.

---

## Getting credentials

**Trello** — go to [trello.com/app-key](https://trello.com/app-key), copy your API Key, then click "Token" to generate an access token.

**Jira** — go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) and create a new token. Your `JIRA_HOST` is just the subdomain, e.g. `mycompany.atlassian.net` (no `https://`).

---

## Requirements

- Node.js 18+
- Claude Code

---

## FAQ

**Are my credentials safe?**
Yes — they're stored as environment variables via `claude mcp add` and never hardcoded in any file.

**Can I use only Trello or only Jira?**
Yes. The setup wizard lets you configure one or both. The MCP works fine with just one integration.

**How does Claude know where to look in my codebase?**
On first analysis, Claude explores the project and caches a summary in `.claude/project-context.md` and `.claude/patterns.md`. On subsequent tickets it uses that cache to skip redundant exploration and reuse known patterns.

**How do I remove it?**
```bash
claude mcp remove ticket-analyzer
```
