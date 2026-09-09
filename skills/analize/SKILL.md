---
description: Analyze a PM ticket (Trello card, Jira issue, or Azure DevOps work item) by ID. Auto-detects platform, fetches full content, explores your codebase, and produces a concrete implementation plan.
disable-model-invocation: true
user-invocable: true
---

You are analyzing a PM ticket. The ticket ID is: **$ARGUMENTS**

Think deeply, answer briefly. Compress the output, never the thinking. Never spend a turn on something that fits in the current message.

---

## Step 1 — Fetch the ticket

Detect the platform from the format of `$ARGUMENTS`:
- `^[A-Z][A-Z0-9]+-\d+$` (e.g. `PROJ-123`) → **Jira** → `get_jira_issue` with `issue_key`
- `^\d+$` (e.g. `1596`) → **Azure DevOps** → `get_azure_work_item` with `work_item_id` (a number, not a string)
- anything else (e.g. `5e8f8f8e`) → **Trello** → `get_trello_card` with `card_id`

If only one integration is configured, prefer it over the format guess. Call `get_status` only when the format is genuinely ambiguous.

**Fetch with `include_images: false` and `include_text_attachments: false`, and do not ask first.** The response lists every attachment by name, which is what tells you whether any of them are worth the tokens. Most tickets never need a second fetch.

Fetch again **only** when a specific attachment decides the implementation: a wireframe on a UI ticket, a `.sql` on a data ticket, a `.csv`/`.json` when the ticket is about parsing that exact shape, or a screenshot on a bug whose description does not explain the failure. Otherwise move on. If you are unsure whether one matters, name it in the same message as the analysis instead of stopping. Read all comments, children, checklists, refinement decisions, and relevant attachment contents before concluding.

**Azure only**: the response is the whole ticket tree — every Task, Bug and child Story with its own description, acceptance criteria, repro steps and comments. Read the children before exploring the codebase; the real requirement is usually written in a child, not in the root Story. If the output says `_Árbol truncado_`, raise `max_depth` (default 3) or `max_nodes` (default 40) — never analyze a truncated tree as if it were complete.

---

## Step 2 — Explore the codebase

Read `.claude/project-context.md` and `.claude/patterns.md` when present, regardless of age. They are navigation hints only, not proof: re-read exact referenced source on every reuse, record actual revision plus dirty/unknown status, and never trust a fresh date or SHA alone.

- **With cache**: use it to navigate, then read the exact files the ticket requires.
- **Without cache**: explore with `find`, `ls`, `Read` — folder structure, stack, conventions, entry points.

Each reusable pattern record requires a name, exact repo-relative paths and symbols, verified date/revision, dirty/unknown marker, applicability, and limits. Update or deduplicate stale records; never fabricate them. Map every behavior and restriction to evidence, current implementation, necessary delta, complete plan, and proportional verification. Include Backend, Infra, or other repositories only when proven by the ticket or inspected code; otherwise label repository-unverified inferences.

---

## Step 3 — Answer

The complete necessary change is the goal; the deliverable must not minimize file count or diff. `analyze_ticket` is deterministic ticket-only evidence; its hypotheses are not confirmed requirements, blockers, or estimates, and its output is not the final implementation plan.

The deliverable depends on the platform, because the reader does:

- **Azure DevOps** → an estimate to agree on, pasted into the analysis task. Two parts.
- **Trello / Jira** → an implementation plan, about to be handed to a coding agent. No hours.

Either way the output is short. Both are summaries, not explanations — the reasoning goes in the private section at the end, never in the copyable block.

Register: natural Rioplatense Spanish, professional. Impersonal or first person plural, never addressing the reader as `vos`.

---

### Azure — Part 1: Análisis y estimación

No jargon. **Never** name a file, function, variable, action or permission here.

Split by area, and include **only the areas that actually have work**: `Frontend`, `Backend`, `QA`, `Infra`. One area alone is fine. Per area: the hours, then **one or two lines** saying what gets done. If the ticket asks for something different from what the code actually needs, compress that into a single clause.

```markdown
## Análisis y estimación

**Frontend** · 6 h
Una o dos líneas de qué se va a hacer. Nada más.

**QA** · 2 h
Una o dos líneas de qué se verifica.

**Total: 8 h — S**
```

**Estimating hours**

- Estimate the realistic time, add roughly a third as buffer, round up to a whole hour. Ticket estimates are wrong low far more often than wrong high, and the padding is the point.
- Never estimate an area below `1 h`. **QA is always present** — if the ticket needs no QA, you have misread it.
- After the total, the T-shirt: `XS`, `S`, `M`, `L`, `XL`. If it lands on `XL`, add one line proposing how to split it.

### Azure — Part 2: Detalle técnico

Same areas, same order. Where it gets touched and how — that is all. One line per file or endpoint: the path, what changes, and the mechanism, in a single sentence. Two or three lines per area. If a step has an order that matters or a trap, add it as a short clause on the same line.

```markdown
## Detalle técnico

**Frontend**
`ruta/archivo.jsx` (línea 123) — qué se cambia y cómo. Si hay una trampa, media línea.

**Backend**
`POST /recurso` — qué devuelve y cómo se resuelve.
**Base de datos** — nueva columna `tabla.columna`, nullable, migración reversible.
**Activities / jobs** — ninguna.

**QA**
Qué se prueba y qué se espera, en una o dos líneas.

**Infra**
Variables, permisos o pasos de despliegue nuevos.
```

**Omit an area with no work**, with one exception: work needed in a repo you are not in — typically Backend — keeps its block, marked `REQUERIDO, fuera de este repo`. That is a blocker, and hiding it is how a sprint gets lost. `**Base de datos**` and `**Activities / jobs**` appear only when the ticket touches them; `**Infra**` only for environment variables, credentials, permissions, deploy order, or migrations that must run before the deploy.

---

### Trello / Jira — Plan de implementación

**No hours.** These users are not estimating for a board — they are about to hand the work to a coding agent (Codex, Claude Code, Cursor, whatever they run).

The whole value of the analysis is that the codebase exploration is already done. The plan is how that exploration reaches the agent so it does not redo it from scratch. Write it to be pasted into an agent prompt as-is, and make it self-contained: an agent starting cold from this text should know where to go, what to reuse, and what not to touch.

```markdown
## Plan de implementación

**Contexto**
Una o dos líneas: lo que hay que saber del proyecto para esta tarea.

**Pasos**
1. `ruta/archivo.jsx:123` — qué cambiar y cómo.
2. `ruta/otro.js` — qué cambiar y cómo. Copiar el enfoque de `ruta/referente.jsx`.

**No toques**
- Lo que parece la solución obvia y rompe otra cosa, con el motivo en media línea.

**Verificación**
Cómo se comprueba que quedó bien.

**Talla:** M
```

**Rules**

- Steps go in dependency order, numbered. **Every step names an exact path** — if you cannot, you did not explore enough in Step 2.
- Reuse over invention: when the repo already solves something equivalent, name that file in the step. An agent left to invent will invent.
- `No toques` carries what the analysis found and the agent cannot see: blast radius, a shared permission, an order that matters, a tempting shortcut that breaks something else. This is the highest-value block in the plan. Omit it only when there is genuinely nothing.
- `Verificación` is a command to run or a concrete thing to observe — not "probar que funcione".
- Max ~8 steps. More than that and the ticket needs splitting; say so in one line instead of writing step 9.
- No prose padding. An agent parses structure, not adjectives.

---

### After the deliverable — private notes

Close with a separator and a heading that makes clear this is **not** part of what gets copied, then `Patrones`, `Riesgos` and `Dudas`. One or two lines each, and omit any section with nothing real in it. A risk with no mitigation is a Duda, not a risk.

```markdown
---
### Para vos — no va en la tarjeta

**Patrones**
`ruta/al/referente.jsx` — qué copiar de ahí y por qué aplica.

**Riesgos**
El riesgo concreto y cómo se mitiga.

**Dudas**
La pregunta que bloquea, y qué cambia según la respuesta.
```

Dudas with discrete options (yes/no, A/B) go through `AskUserQuestion` — max 4 options, and only the ones that actually block. Genuinely open ones go as a numbered list in the same message. Never spend a separate turn on a question that does not block.

Close with one line offering to post the copyable block as a comment — `add_azure_comment`, `add_trello_comment` or `add_jira_comment` — and to start implementing. Never post the private section. Do not post anything without being asked, and if the credentials are read-only say so when offering, not after the call fails.

---

## Step 4 — Save the cache (only with explicit bounded consent)

Analysis is read-only. Do not write consumer files unless the user explicitly grants bounded cache-only consent (CACHE WRITE) for only `.claude/project-context.md` and/or `.claude/patterns.md`, after verifying those paths are ignored. That consent does not authorize application changes, migrations, comments, or `.gitignore` edits; analyze permission and cache-write consent are distinct. Without it, do not write a cache.

With that consent, write only verified knowledge: no secrets, raw ticket content, private external context, or sensitive identifiers. Cache only verified, reusable repository patterns with exact repository-relative source paths and symbols, actual revision/date, dirty or unknown status, applicability, and limits; never persist raw ticket descriptions, comments, or attachments, credentials or secrets, sensitive ticket or person identifiers, or private external context; never fabricate source references or revisions, and never promote guesses to facts. Update and deduplicate stale records rather than appending blindly. Never assume a consuming repo ignores these cache paths.
