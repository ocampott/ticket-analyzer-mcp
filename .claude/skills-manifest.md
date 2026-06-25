# Global Skills Manifest

This file documents the global skills created for the pm-mcp project.

## Skills Location

Skills are installed at: `~/.claude/skills/pm/commands/`

### 1. pm-analize

**File:** `~/.claude/skills/pm/commands/pm-analize.md`

Analyzes a PM ticket (Trello card or Jira issue) by ID.
- Auto-detects platform from ID format (Jira: `^[A-Z][A-Z0-9]+-\d+$`, else Trello)
- Runs full analysis workflow from CLAUDE.md
- Usage: `/pm-analize PROJ-123` or `/pm-analize abc123xyz`

### 2. pm-search-ticket

**File:** `~/.claude/skills/pm/commands/pm-search-ticket.md`

Searches Jira or Trello tickets using natural language.
- Usage: `/pm-search-ticket [jira|trello] [free query]`
- For Jira: translates query to JQL, calls `search_jira_issues`
- For Trello: calls `list_trello_cards`
- Shows numbered results, allows user to pick one for analysis

### 3. pm-update

**File:** `~/.claude/skills/pm/commands/pm-update.md`

Updates pm-mcp to the latest version.
- Finds the repo via `claude mcp list`
- Runs `git pull`, `npm install`, `npm run build`
- Reinstalls the skills plugin
- Usage: `/pm-update`

## Installation

```bash
cp -r .claude/skills/pm ~/.claude/skills/pm
```

Then restart Claude Code or run `/reload-plugins`. Verify with `claude plugin list`.

## Invoking

- `/pm-analize PROJ-123`
- `/pm-search-ticket jira sprint actual en doing`
- `/pm-update`
