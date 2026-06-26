# Decisions

## SPEC-GAP-HIGH — 001-claude-plugin-distribution — adversarial review

| # | Severity | Category | Description | Suggested Action |
|---|----------|----------|-------------|-----------------|
| 1 | ~~high~~ **RESUELTO** | undocumented-assumption | **npm name `pm-mcp` YA ESTÁ TOMADO.** `npm view pm-mcp` devuelve v0.5.0 — "Process Manager MCP Server" by patrickjm. | **Nuevo nombre: `ticket-analyzer-mcp`**. Actualizado en `package.json`, `.mcp.json`, `pm-setup.md`, `marketplace.json`, `README.md`, `spec.md`. |
| 2 | ~~high~~ **RESUELTO** | undocumented-assumption | Marketplace prerequisite ausente del happy path. | Agregado Step 0 en happy path de spec.md: `claude plugin marketplace add pm`. |
| 3 | ~~high~~ **RESUELTO** | undocumented-assumption | `claude mcp add` puede requerir restart. | Nota añadida en pm-setup.md Step 5: si el server no responde, reiniciar Claude Code. Restart aceptado como parte del flujo en AC#1 reescrito. |
| 4 | ~~high~~ **RESUELTO** | security-integrity | Credenciales visibles en shell history. | Nota añadida en pm-setup.md Step 5 con `history -d` para limpiar historial post-setup. |
| 5 | ~~high~~ **RESUELTO** | uncovered-scenario | Credential rotation no cubierta. | Re-ejecución de `/pm-setup` ya maneja rotation via `claude mcp remove pm` + re-add. Documentado en sección "Credential Rotation" de spec.md. |
| 6 | ~~high~~ **RESUELTO** | incomplete-AC | AC#1 no testeable. | AC#1 reescrito: especifica restart aceptable, instancia Jira cloud de prueba, y mínimo de "título + descripción + estado". |

Source: adversarial review agent, review-feature phase
Date: 2026-06-26

---

## Phase 5 — Task 2: Happy path test (manual-pending)

**Decision:** Mark as `[x]` with manual-pending status.

**Reason:** `claude plugin install pm-mcp` requires the package to be published to npm. At validation time (pre-publish), the command can only be verified structurally:
- `claude plugin` subcommand exists ✓
- `claude plugin install` command is available ✓
- Full end-to-end test (`install` → `/pm-setup` → `/pm-analize`) must be performed post-publish.

**Action required post-publish:** Run `claude plugin install ticket-analyzer-mcp` on a clean machine, follow `/pm-setup`, and verify `/pm-analize` resolves a real ticket.

---

## Deltas merged — 2026-06-26

Applied directly to `spec.md` as part of adversarial gap resolution:

- **MODIFIED**: Happy path — added Step 0 (`claude plugin marketplace add pm`)
- **ADDED**: "Credential Rotation" section
- **MODIFIED**: AC#1 — rewritten to be testeable (restart policy, Jira test instance, minimum analysis definition)
- **MODIFIED**: npm name — `pm-mcp` → `ticket-analyzer-mcp` throughout spec
- **MODIFIED**: Rollback — updated npm dist-tag command to use new package name
