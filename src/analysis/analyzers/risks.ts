import type { Analyzer, AnalysisContext, Risk, RiskCategory, Severity } from "../types.js";
import { countHits } from "../signals.js";
import { RISK_CATEGORY_KEYWORDS, RISK_BASE_SEVERITY } from "../keywords.js";

const CATEGORIES = Object.keys(RISK_CATEGORY_KEYWORDS) as RiskCategory[];

const DESCRIPTIONS: Record<RiskCategory, string> = {
  auth: "Cambios en autenticación/sesión: riesgo de bloquear el acceso de usuarios.",
  payments: "Toca flujos de pago: errores pueden causar cobros incorrectos.",
  security: "Implicaciones de seguridad: validar contra vulnerabilidades comunes.",
  database: "Cambios de base de datos/esquema: requieren migración cuidadosa.",
  infrastructure: "Cambios de infraestructura/despliegue: riesgo de downtime.",
  "data-loss": "Operaciones destructivas: riesgo de pérdida de datos.",
  "external-provider": "Depende de un proveedor externo: riesgo de fallos fuera de control.",
};

function escalate(base: Severity, hitCount: number): Severity {
  if (base === "high") return "high";
  if (hitCount >= 3) return base === "medium" ? "high" : "medium";
  return base;
}

export const riskAnalyzer: Analyzer = {
  name: "risks",
  version: "1.0.0",
  analyze(ctx: AnalysisContext) {
    const risks: Risk[] = [];
    for (const category of CATEGORIES) {
      const evidence = countHits(ctx.signals, RISK_CATEGORY_KEYWORDS[category]);
      if (evidence.length === 0) continue;
      const severity = escalate(RISK_BASE_SEVERITY[category], evidence.length);
      const confidence = Math.min(1, 0.5 + 0.1 * evidence.length);
      risks.push({
        category,
        severity,
        confidence: Math.round(confidence * 100) / 100,
        description: DESCRIPTIONS[category],
        evidence,
      });
    }
    return { risks };
  },
};
