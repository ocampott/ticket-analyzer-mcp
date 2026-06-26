# Discovery Report
status: findings-present

## High-impact findings

- [conflict] Plugin structure path mismatch: `.claude-plugin/plugin.json` existe en `.claude/skills/pm/.claude-plugin/`, no en repo root. El spec requiere `.claude-plugin/` en root. [impact: high]
- [conflict] Skills location conflict: Skills tracked en git en `.claude/skills/pm/commands/`. El plugin distributable los necesita en `skills/pm/` en repo root. Hay que definir qué pasa con la estructura actual. [impact: high]

## Other findings

- [edge-case] ESM-only + bin entry: `"type": "module"` requiere shebang + wrapper para el bin entry. No existe `bin/` directory ni entrada en package.json. [impact: medium]
- [simplification] `dist/` en `.gitignore` sin `files` field: npm publish saltearía dist/ por default. Necesita `"files": ["dist/", "bin/"]` en package.json. [impact: medium]
- [edge-case] Plugin discovery mechanism: `.mcp.json` no existe en root. Sin `skills/` en root tampoco. [impact: medium]
- [edge-case] Zero CI/CD infrastructure: No `.github/`. Workflows deben crearse desde cero. [impact: medium]
- [reuse] tsconfig correcto para ESM distribution. No requiere cambios. [impact: low]

## User decisions

- DISCOVERY-ACCEPTED: Plugin path mismatch. La estructura `.claude/skills/pm/` es la instalación local de dev, no el formato distributable. Los plugins distribuibles (engram, superpowers) tienen `.claude-plugin/` en root. El plan es: crear `.claude-plugin/` en root y ELIMINAR `.claude/skills/pm/` del repo (los usuarios reciben los skills via `claude plugin install`, no vía git checkout). No cambia el scope.

- DISCOVERY-ACCEPTED: Skills location conflict. La migración de `.claude/skills/pm/commands/` → `skills/pm/` (en root) es parte del plan desde el brainstorming. El directorio `.claude/skills/pm/` queda fuera del repo una vez que el plugin es la fuente de verdad. No cambia el scope.

- DISCOVERY-ACCEPTED: ESM bin wrapper. Usar `bin/pm-mcp.js` con `#!/usr/bin/env node` + `import "../dist/index.js"`. Compatible con ESM (type: module). Ya documentado en el design spec.

- DISCOVERY-ACCEPTED: dist/ en .gitignore. Agregar `"files": ["dist/", "bin/"]` al package.json para garantizar que npm publish incluya los archivos compilados. Fix de una línea.
