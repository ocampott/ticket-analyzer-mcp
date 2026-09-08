import type {
  Analyzer, AnalysisContext, AnalysisResult, ContextPackage,
  NormalizedTicket, Risk, Severity,
} from "./types.js";
import { deriveSignals } from "./signals.js";

const ARRAY_KEYS: (keyof AnalysisResult)[] = [
  "stakeholders", "dependencies", "risks", "missingInformation", "openQuestions", "constraints",
];

// Analyzers contribute; arrays accumulate, scalars overwrite when provided.
// The assembler later dedupes/aggregates. (Composability invariant.)
export function mergePartial(
  acc: Partial<AnalysisResult>,
  next: Partial<AnalysisResult>,
): Partial<AnalysisResult> {
  const out: Record<string, unknown> = { ...acc };
  const arrayKeys = ARRAY_KEYS as string[];
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (arrayKeys.includes(key)) {
      const previous = (out[key] as unknown[]) ?? [];
      out[key] = [...previous, ...(value as unknown[])];
    } else {
      out[key] = value;
    }
  }
  return out as Partial<AnalysisResult>;
}

function defaults(): AnalysisResult {
  return {
    objective: "",
    ticketType: { type: "feature", confidence: 0, evidence: [] },
    complexity: { level: "M", confidence: 0, factors: ["sin señales"] },
    businessContext: "",
    technicalContext: "",
    stakeholders: [],
    dependencies: [],
    risks: [],
    missingInformation: [],
    qualityScore: { score: 100, deductions: [] },
    openQuestions: [],
    constraints: [],
  };
}

function severityRank(s: Severity): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function dedupeByName<T extends { name: string; confidence: number }>(items: T[]): T[] {
  const byName = new Map<string, T>();
  for (const item of items) {
    const previous = byName.get(item.name);
    if (!previous || item.confidence > previous.confidence) byName.set(item.name, item);
  }
  return [...byName.values()];
}

function deriveRecommendations(result: AnalysisResult): string[] {
  const recommendations: string[] = [];
  if (result.missingInformation.some((m) => m.field === "acceptance_criteria")) {
    recommendations.push("Definir criterios de aceptación medibles antes de implementar.");
  }
  for (const dependency of result.dependencies) {
    if (dependency.name === "OAuth") recommendations.push("El flujo OAuth requiere manejo de sesión, scopes y refresh tokens.");
    if (dependency.name === "DB Migration Tooling") recommendations.push("Planificar la migración con backup previo y estrategia de rollback.");
    if (dependency.name === "Payment Gateway") recommendations.push("Probar el flujo de pago en sandbox y manejar webhooks idempotentemente.");
  }
  for (const risk of result.risks) {
    if (risk.severity === "high") {
      recommendations.push(`Mitigar el riesgo de ${risk.category}: ${risk.description}`);
    }
  }
  return Array.from(new Set(recommendations));
}

/** Assemble analyzer contributions into the stable, client-facing ContextPackage. */
export function assembleContext(ctx: AnalysisContext): ContextPackage {
  const result: AnalysisResult = { ...defaults(), ...ctx.partial };

  result.dependencies = dedupeByName(result.dependencies);
  result.stakeholders = dedupeByName(result.stakeholders);
  result.constraints = Array.from(new Set(result.constraints));

  const riskByCategory = new Map<string, Risk>();
  for (const risk of result.risks) {
    const previous = riskByCategory.get(risk.category);
    if (
      !previous
      || severityRank(risk.severity) > severityRank(previous.severity)
      || (severityRank(risk.severity) === severityRank(previous.severity) && risk.confidence > previous.confidence)
    ) {
      riskByCategory.set(risk.category, risk);
    }
  }
  result.risks = [...riskByCategory.values()];

  const missingCount = result.missingInformation.length;
  if (missingCount >= 4) {
    result.complexity = {
      ...result.complexity,
      factors: [...result.complexity.factors, `alta ambigüedad (${missingCount} huecos de información)`],
    };
    if (result.complexity.level === "S") result.complexity.level = "M";
    else if (result.complexity.level === "M") result.complexity.level = "L";
  }
  result.complexity.confidence = Math.min(1, result.complexity.confidence + 0.2);

  const recommendations = deriveRecommendations(result);
  const maxRisk = result.risks.reduce<Severity>(
    (maximum, risk) => severityRank(risk.severity) > severityRank(maximum) ? risk.severity : maximum,
    "low",
  );
  const overallRisk = result.complexity.level === "XL" && maxRisk === "low" ? "medium" : maxRisk;

  const blockingIssues = [
    ...result.risks.filter((risk) => risk.severity === "high")
      .map((risk) => `Riesgo (${risk.category}): ${risk.description}`),
    ...result.missingInformation.filter((item) => item.severity === "high")
      .map((item) => `Falta: ${item.reason}`),
  ];

  const executiveSummary =
    `${result.objective || ctx.ticket.title} — tipo ${result.ticketType.type}, complejidad ${result.complexity.level}, riesgo ${overallRisk}.`;
  const engineerSummary =
    `${result.dependencies.length} dependencia(s), ${result.risks.length} riesgo(s), ${result.missingInformation.length} hueco(s) de información. Calidad: ${result.qualityScore.score}/100.`;

  return { ...result, recommendations, overallRisk, blockingIssues, executiveSummary, engineerSummary };
}

export function runPipeline(analyzers: Analyzer[], ticket: NormalizedTicket): ContextPackage {
  const signals = deriveSignals(ticket);
  const ctx: AnalysisContext = { ticket, signals, partial: {} };
  for (const analyzer of analyzers) {
    ctx.partial = mergePartial(ctx.partial, analyzer.analyze(ctx));
  }
  return assembleContext(ctx);
}
