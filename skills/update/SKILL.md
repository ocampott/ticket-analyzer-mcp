---
description: Update ticket-analyzer to the latest version.
---

You are updating ticket-analyzer to the latest version. Follow these steps:

## Step 1 — Detect Install Method

Run: `claude plugin list 2>/dev/null`

- If the output contains a plugin named `ticket-analyzer` or `ticket-analyzer-mcp` → **Plugin install** → go to Step 2A.
- If the command fails or returns no pm-mcp entry → **Manual install** → go to Step 2B.

---

## Step 2A — Plugin Update Path

Run:

```bash
claude plugin update ticket-analyzer
```

If that fails (e.g. plugin name mismatch), try:

```bash
claude plugin update ticket-analyzer-mcp
```

Report the output. Then jump to Step 5.

---

## Step 2B — Manual Update Path

### Find the repository

Run: `claude mcp list`

Look for a server running `dist/index.js` from a path that contains `pm-mcp`. The path will look like:
`node /path/to/pm-mcp/dist/index.js`

Extract the repository root: everything before `/dist/index.js`.

If you cannot find it automatically, ask the user:
> "¿Cuál es la ruta donde clonaste pm-mcp? (ej: `/Users/tomas/Documents/pm-mcp`)"

### Pull latest changes

```bash
cd /path/to/pm-mcp
git pull
```

Report what changed: new commits pulled, or "Already up to date."

### Rebuild

```bash
npm install
npm run build
```

Report success or any errors.

### Reinstall skills

```bash
cp -r skills/pm ~/.claude/skills/pm
```

---

## Step 5 — Done

Tell the user:
> "ticket-analyzer actualizado correctamente. Reiniciá Claude Code (o ejecutá `/reload-plugins`) para que los nuevos comandos tomen efecto."
