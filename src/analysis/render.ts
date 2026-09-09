import type { ContextPackage } from "./types.js";

export function renderMarkdown(pkg: ContextPackage): string {
  const lines: string[] = [];
  lines.push("# Análisis del ticket");
  lines.push("Evidencia determinística del ticket únicamente; las inferencias no verificadas en el repositorio están etiquetadas y esto no es un plan final de implementación.");
  lines.push("");
  lines.push(`Tipo: ${pkg.ticketType.type} (conf. ${pkg.ticketType.confidence}) | Complejidad: ${pkg.complexity.level} | Riesgo general: ${pkg.overallRisk} | Calidad: ${pkg.qualityScore.score}/100`);
  lines.push("");
  lines.push("## Resumen ejecutivo");
  lines.push(pkg.executiveSummary);
  lines.push("");
  lines.push("## Resumen para ingeniería");
  lines.push(pkg.engineerSummary);

  if (pkg.objective) lines.push("", "## Objetivo", pkg.objective);
  if (pkg.businessContext) lines.push("", "## Contexto de negocio", pkg.businessContext);
  if (pkg.technicalContext) lines.push("", "## Contexto técnico", pkg.technicalContext);

  if (pkg.dependencies.length) {
    lines.push("", "## Dependencias");
    for (const dependency of pkg.dependencies) {
      lines.push(`- ${dependency.name} ${dependency.inferred ? "(inferida)" : "(declarada)"} — conf. ${dependency.confidence} — evidencia: ${dependency.evidence.join(", ")}`);
    }
  }

  if (pkg.risks.length) {
    lines.push("", "## Riesgos");
    for (const risk of pkg.risks) {
      lines.push(`- [${risk.severity}] ${risk.category}: ${risk.description} (evidencia: ${risk.evidence.join(", ")})`);
    }
  }

  if (pkg.missingInformation.length) {
    lines.push("", "## Información faltante");
    for (const item of pkg.missingInformation) {
      lines.push(`- [${item.severity}] ${item.reason} → ${item.recommendation}`);
    }
  }

  if (pkg.openQuestions.length) {
    lines.push("", "## Preguntas abiertas");
    for (const question of pkg.openQuestions) lines.push(`- ${question}`);
  }

  if (pkg.constraints.length) {
    lines.push("", "## Restricciones");
    for (const constraint of pkg.constraints) lines.push(`- ${constraint}`);
  }

  if (pkg.recommendations.length) {
    lines.push("", "## Recomendaciones");
    for (const recommendation of pkg.recommendations) lines.push(`- ${recommendation}`);
  }

  if (pkg.blockingIssues.length) {
    lines.push("", "## Bloqueantes");
    for (const issue of pkg.blockingIssues) lines.push(`- ${issue}`);
  }

  return lines.join("\n");
}
