# Global Skills Manifest

This file documents the global skills created for the pm-mcp project.

## Skills Location

Both skills are installed at: `~/.claude/plugins/local/pm/skills/`

### 1. pm-analize

**File:** `~/.claude/plugins/local/pm/skills/pm-analize.md`

Analyzes a PM ticket (Trello card or Jira issue) by ID.
- Auto-detects platform from ID format (Jira: `^[A-Z][A-Z0-9]+-\d+$`, else Trello)
- Runs full analysis workflow from CLAUDE.md

### 2. pm-search-ticket

**File:** `~/.claude/plugins/local/pm/skills/pm-search-ticket.md`

Searches Jira or Trello tickets using natural language.
- Usage: `/pm-search-ticket [jira|trello] [free query]`
- For Jira: translates query to JQL, calls `search_jira_issues`
- For Trello: calls `list_trello_cards`
- Shows numbered results, allows user to pick one for analysis

## Installation

These files are already installed in the global Claude Code directory.
To use them, restart Claude Code and invoke with `/pm-analize` or `/pm-search-ticket`.
