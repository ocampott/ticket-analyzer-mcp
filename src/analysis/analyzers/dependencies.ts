import type { Analyzer, AnalysisContext, Dependency } from "../types.js";
import { countHits } from "../signals.js";
import { DEPENDENCY_INFERENCE, EXPLICIT_DEPENDENCY_MARKERS } from "../keywords.js";

function inferred(ctx: AnalysisContext): Dependency[] {
  const byName = new Map<string, Dependency>();
  for (const rule of DEPENDENCY_INFERENCE) {
    const hits = countHits(ctx.signals, rule.match);
    if (hits.length === 0) continue;
    const confidence = Math.min(1, 0.6 + 0.1 * hits.length);
    for (const name of rule.implies) {
      const existing = byName.get(name);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, round(confidence));
        existing.evidence = Array.from(new Set([...existing.evidence, ...hits]));
      } else byName.set(name, { name, inferred: true, confidence: round(confidence), evidence: hits });
    }
  }
  return [...byName.values()];
}

function explicit(ctx: AnalysisContext): Dependency[] {
  const hits = countHits(ctx.signals, EXPLICIT_DEPENDENCY_MARKERS);
  return hits.length === 0 ? [] : [{ name: "Dependencia declarada en el ticket", inferred: false, confidence: 0.9, evidence: hits }];
}

function round(n: number): number { return Math.round(n * 100) / 100; }

export const dependencyExtractor: Analyzer = {
  name: "dependencies", version: "1.0.0",
  analyze(ctx) { return { dependencies: [...explicit(ctx), ...inferred(ctx)] }; },
};
