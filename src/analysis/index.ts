import type { ContextPackage, NormalizedTicket } from "./types.js";
import { runPipeline } from "./pipeline.js";
import { semanticAnalyzer } from "./analyzers/semantic.js";
import { dependencyExtractor } from "./analyzers/dependencies.js";
import { riskAnalyzer } from "./analyzers/risks.js";
import { missingInfoDetector } from "./analyzers/missingInfo.js";

// Analyzer order matters: later analyzers may read ctx.partial from earlier ones.
const ANALYZERS = [semanticAnalyzer, dependencyExtractor, riskAnalyzer, missingInfoDetector];

export function analyzeTicket(ticket: NormalizedTicket): ContextPackage {
  return runPipeline(ANALYZERS, ticket);
}

export type { ContextPackage, NormalizedTicket };
