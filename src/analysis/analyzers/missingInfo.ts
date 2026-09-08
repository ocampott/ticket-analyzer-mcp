import type { Analyzer, AnalysisContext, MissingInfoItem, QualityScore } from "../types.js";
import { countHits } from "../signals.js";
import { QUALITY_CHECKS } from "../keywords.js";

export const missingInfoDetector: Analyzer = {
  name: "missingInfo",
  version: "1.0.0",
  analyze(ctx: AnalysisContext) {
    const missingInformation: MissingInfoItem[] = [];
    const deductions: string[] = [];
    let score = 100;

    for (const check of QUALITY_CHECKS) {
      const present = countHits(ctx.signals, check.present);
      if (present.length > 0) continue;
      score -= check.weight;
      deductions.push(`${check.field} ausente (-${check.weight})`);
      missingInformation.push({
        field: check.field,
        severity: check.severity,
        confidence: 0.8,
        reason: check.reason,
        recommendation: check.recommendation,
      });
    }

    const qualityScore: QualityScore = { score: Math.max(0, score), deductions };
    const openQuestions: string[] = [];
    if (ctx.ticket.description.trim().length < 80) {
      openQuestions.push("La descripción es muy breve: ¿cuál es el alcance y el resultado esperado?");
    }

    const constraintHits = countHits(ctx.signals, ["deadline", "no debe", "must not", "target", "límite", "restricción"]);
    const constraints = constraintHits.map((c) => `Restricción mencionada: "${c}"`);

    return { missingInformation, qualityScore, openQuestions, constraints };
  },
};
