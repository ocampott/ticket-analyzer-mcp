import type { TicketType, RiskCategory, Severity } from "./types.js";

export const TICKET_TYPE_KEYWORDS: Record<TicketType, string[]> = {
  bug: ["bug", "error", "fix", "arreglar", "falla", "crash", "crashea", "roto", "no funciona", "defect", "regresión", "regression", "null pointer"],
  feature: ["feature", "agregar", "añadir", "add", "implementar", "implement", "crear", "create", "nueva", "nuevo", "new", "soportar", "support", "exportación", "export"],
  refactor: ["refactor", "refactorizar", "reorganizar", "cleanup", "limpiar", "simplificar", "simplify", "rename", "renombrar"],
  technical_debt: ["deuda técnica", "technical debt", "tech debt", "legacy", "deprecate", "deprecado", "obsoleto", "workaround", "parche", "todo"],
  spike: ["spike", "investigar", "investigate", "research", "explorar", "explore", "poc", "proof of concept", "prueba de concepto", "evaluar", "evaluate"],
  infrastructure: ["infra", "infrastructure", "infraestructura", "deploy", "despliegue", "kubernetes", "docker", "ci/cd", "pipeline", "terraform", "servidor", "server", "migración", "migration", "migrar"],
  security: ["security", "seguridad", "vulnerab", "cve", "xss", "csrf", "injection", "inyección", "encrypt", "cifrar", "owasp", "rate limiting", "rate limit"],
  performance: ["performance", "rendimiento", "slow", "lento", "latency", "latencia", "optimizar", "optimize", "throughput", "memory leak", "cache", "caché"],
};

export const RISK_CATEGORY_KEYWORDS: Record<RiskCategory, string[]> = {
  auth: ["login", "oauth", "sso", "auth", "autenticación", "authentication", "permiso", "permission", "sesión", "session", "token", "jwt", "password", "contraseña"],
  payments: ["pago", "payment", "stripe", "paypal", "checkout", "billing", "facturación", "suscripción", "subscription", "cobro", "invoice"],
  security: ["security", "seguridad", "xss", "csrf", "injection", "inyección", "vulnerab", "encrypt", "cifrar", "sensible", "pii", "rate limiting"],
  database: ["schema", "esquema", "migración", "migration", "base de datos", "database", "tabla", "table", "índice", "index", "query", "consulta", "drop", "alter"],
  infrastructure: ["deploy", "despliegue", "infra", "infrastructure", "kubernetes", "docker", "server", "servidor", "ci/cd", "pipeline", "dns", "load balancer"],
  "data-loss": ["borrar", "delete", "drop", "eliminar", "purge", "wipe", "truncate", "overwrite", "sobrescribir", "pérdida de datos", "data loss"],
  "external-provider": ["api externa", "external api", "integración", "integration", "webhook", "third-party", "tercero", "proveedor", "provider", "sdk"],
};

export const RISK_BASE_SEVERITY: Record<RiskCategory, Severity> = {
  auth: "high", payments: "high", security: "high", database: "medium",
  infrastructure: "medium", "data-loss": "high", "external-provider": "medium",
};

export const DEPENDENCY_INFERENCE: { match: string[]; implies: string[] }[] = [
  { match: ["login con google", "login google", "google login", "oauth google", "iniciar sesión con google"], implies: ["OAuth", "Session Management", "User Service", "Frontend Login Flow"] },
  { match: ["login", "sign in", "iniciar sesión", "autenticación", "authentication"], implies: ["Session Management", "User Service"] },
  { match: ["pago", "payment", "checkout", "stripe"], implies: ["Payment Gateway", "Webhook Handling", "Billing Service"] },
  { match: ["notificación", "notification", "email", "correo"], implies: ["Notification Service", "Email Provider"] },
  { match: ["upload", "subir archivo", "file upload", "adjuntar"], implies: ["File Storage", "Upload Validation"] },
  { match: ["búsqueda", "search", "filtrar", "filter"], implies: ["Search/Index Layer", "Pagination"] },
  { match: ["migración", "migration", "migrar"], implies: ["DB Migration Tooling", "Backup/Restore"] },
];

export const EXPLICIT_DEPENDENCY_MARKERS = ["depends on", "depende de", "bloqueado por", "blocked by", "requires", "requiere", "después de", "luego de"];

export const QUALITY_CHECKS: { field: string; severity: Severity; weight: number; present: string[]; reason: string; recommendation: string }[] = [
  { field: "acceptance_criteria", severity: "high", weight: 15, present: ["acceptance criteria", "criterios de aceptación", "definition of done", "done when", "aceptación"], reason: "No hay criterios de aceptación claros", recommendation: "Definir condiciones medibles de 'terminado' antes de implementar" },
  { field: "rollback_plan", severity: "medium", weight: 10, present: ["rollback", "reversión", "revertir", "feature flag"], reason: "No se menciona plan de rollback", recommendation: "Documentar cómo revertir el cambio si falla en producción" },
  { field: "dependencies", severity: "medium", weight: 10, present: ["depende", "depends", "bloqueado", "blocked", "requiere", "requires"], reason: "No se declaran dependencias", recommendation: "Listar dependencias técnicas y de otros equipos" },
  { field: "edge_cases", severity: "medium", weight: 10, present: ["edge case", "caso límite", "casos borde", "cuando falla", "si falla", "burst"], reason: "No se describen casos límite", recommendation: "Enumerar errores, estados vacíos y límites" },
  { field: "constraints", severity: "low", weight: 5, present: ["constraint", "restricción", "límite", "no debe", "must not", "deadline", "target"], reason: "No se declaran restricciones", recommendation: "Indicar restricciones de tiempo, datos o compatibilidad" },
  { field: "testing_requirements", severity: "medium", weight: 10, present: ["test", "prueba", "qa", "cobertura", "coverage", "load test"], reason: "No se especifican requisitos de testing", recommendation: "Definir qué pruebas validan el cambio" },
  { field: "success_metrics", severity: "low", weight: 5, present: ["métrica", "metric", "kpi", "success metric", "medir", "measure", "target"], reason: "No hay métricas de éxito", recommendation: "Definir cómo se medirá el éxito del cambio" },
];
