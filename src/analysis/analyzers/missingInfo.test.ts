import { missingInfoDetector } from "./missingInfo.js";
import { deriveSignals } from "../signals.js";
import { featureClear, featureAmbiguous } from "../__fixtures__/tickets.js";
import type { AnalysisContext, NormalizedTicket } from "../types.js";

function ctx(t: NormalizedTicket): AnalysisContext {
  return { ticket: t, signals: deriveSignals(t), partial: {} };
}

test("well-written ticket scores higher than ambiguous one", () => {
  const clear = missingInfoDetector.analyze(ctx(featureClear));
  const vague = missingInfoDetector.analyze(ctx(featureAmbiguous));
  expect(clear.qualityScore!.score).toBeGreaterThan(vague.qualityScore!.score);
});

test("ambiguous ticket reports missing acceptance criteria with recommendation", () => {
  const out = missingInfoDetector.analyze(ctx(featureAmbiguous));
  const item = out.missingInformation?.find((m) => m.field === "acceptance_criteria");
  expect(item).toBeDefined();
  expect(item?.recommendation.length).toBeGreaterThan(0);
  expect(item?.confidence).toBeGreaterThan(0);
});

test("qualityScore.deductions explains the score", () => {
  const out = missingInfoDetector.analyze(ctx(featureAmbiguous));
  expect(out.qualityScore!.deductions.length).toBeGreaterThan(0);
  expect(out.qualityScore!.score).toBeLessThan(100);
});
