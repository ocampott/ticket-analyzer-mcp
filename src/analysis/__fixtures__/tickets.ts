import type { NormalizedTicket } from "../types.js";

function base(p: Partial<NormalizedTicket> & Pick<NormalizedTicket, "id" | "title">): NormalizedTicket {
  return {
    source: "jira", description: "", type: null, status: null, labels: [],
    comments: [], checklistItems: [], metadata: {}, ...p,
  };
}

export const featureClear = base({
  id: "PROJ-10", title: "Agregar exportación a CSV en el listado de usuarios",
  type: "Story", status: "To Do", labels: ["feature"],
  description:
    "Como admin quiero exportar usuarios a CSV.\n\nCriterios de aceptación:\n- Botón 'Exportar' visible para admins.\n- El CSV incluye nombre, email, rol.\n- Edge case: lista vacía descarga un CSV con headers.\n\nTesting: unit test del serializador y un e2e del botón.\nRollback: detrás de feature flag export_csv.",
  metadata: { assignee: "Ana", components: ["web"] },
});

export const featureAmbiguous = base({
  id: "PROJ-11", title: "Mejorar la búsqueda",
  type: "Story", status: "To Do", labels: [],
  description: "Hay que mejorar la búsqueda, está lenta y no encuentra bien las cosas.",
});

export const bugReport = base({
  source: "trello", id: "card-bug-1", title: "Fix: la app crashea al guardar perfil",
  status: "Doing", labels: ["red: Blocker"],
  description: "Cuando el usuario guarda el perfil sin teléfono, la app crashea con un null pointer. Pasa siempre en producción.",
  comments: [{ author: "QA", date: "2026-06-10T00:00:00Z", text: "Repro: dejar teléfono vacío y guardar." }],
});

export const techDebt = base({
  id: "PROJ-12", title: "Refactor del módulo de pagos legacy",
  type: "Task", status: "Backlog", labels: ["tech-debt"],
  description: "El módulo de pagos tiene mucha deuda técnica y código legacy. Hay workarounds y TODOs por todos lados. Refactorizar para simplificar.",
});

export const infraMigration = base({
  id: "PROJ-13", title: "Migrar la base de datos de MySQL 5.7 a 8.0",
  type: "Task", status: "To Do", labels: ["infra"],
  description: "Migración de schema de la base de datos. Requiere actualizar el pipeline de CI/CD y el deploy en Kubernetes. Riesgo de pérdida de datos si la migración falla.",
});

export const spanishOnly = base({
  id: "PROJ-14", title: "Implementar notificaciones por email al crear una orden",
  type: "Story", status: "To Do",
  description: "Cuando un cliente crea una orden, enviar un correo de confirmación. Integrar con el proveedor de email.",
});

export const englishOnly = base({
  source: "trello", id: "card-en-1", title: "Add rate limiting to the public API",
  status: "Todo",
  description: "We must add rate limiting to the public API to prevent abuse. Use a token bucket. Edge case: burst traffic. Testing: load test required.",
});

export const mixedLanguage = base({
  id: "PROJ-15", title: "Optimize el rendimiento del endpoint /reports",
  type: "Story", status: "In Progress",
  description: "El endpoint /reports is very slow (high latency). Necesitamos optimizar la query y agregar cache. Performance target: under 500ms.",
});

export const loginGoogle = base({
  id: "PROJ-16", title: "Agregar login con Google",
  type: "Story", status: "To Do", labels: ["auth", "feature"],
  description: "Permitir que los usuarios inicien sesión con Google (OAuth). Mostrar el botón en la pantalla de login.",
  metadata: { assignee: "Ana", components: ["web", "api"] },
});

export const ALL_FIXTURES: { name: string; ticket: NormalizedTicket }[] = [
  { name: "featureClear", ticket: featureClear },
  { name: "featureAmbiguous", ticket: featureAmbiguous },
  { name: "bugReport", ticket: bugReport },
  { name: "techDebt", ticket: techDebt },
  { name: "infraMigration", ticket: infraMigration },
  { name: "spanishOnly", ticket: spanishOnly },
  { name: "englishOnly", ticket: englishOnly },
  { name: "mixedLanguage", ticket: mixedLanguage },
  { name: "loginGoogle", ticket: loginGoogle },
];
