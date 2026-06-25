---
description: Update pm-mcp to the latest version. Pulls latest code, rebuilds, and reinstalls the skills plugin.
---

You are updating pm-mcp to the latest version. Follow these steps:

## Step 1 — Find the repository

Run: `claude mcp list`

Look for a server running `dist/index.js` from a path that contains `pm-mcp`. The path will look like:
`node /path/to/pm-mcp/dist/index.js`

Extract the repository root: everything before `/dist/index.js`.

If you cannot find it automatically, ask the user:
> "¿Cuál es la ruta donde clonaste pm-mcp? (ej: `/Users/tomas/Documents/pm-mcp`)"

## Step 2 — Pull latest changes

```bash
cd /path/to/pm-mcp
git pull
```

Report what changed: new commits pulled, or "Already up to date."

## Step 3 — Rebuild

```bash
npm install
npm run build
```

Report success or any errors.

## Step 4 — Reinstall skills plugin

```bash
cp -r .claude/skills/pm ~/.claude/skills/pm
```

## Step 5 — Done

Tell the user:
> "pm-mcp actualizado correctamente. Reiniciá Claude Code (o ejecutá `/reload-plugins`) para que los nuevos comandos tomen efecto."
