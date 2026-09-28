import type { StructuredParseResult } from "@pravnix/ai-structured-output";

export function buildRepairInstruction<T>(failure: Extract<StructuredParseResult<T>, { success: false }>): string {
  return [
    "Your previous response could not be used because of the following problem:",
    `${failure.reason}: ${failure.safeMessage}`,
    "Respond again with ONLY valid JSON matching the requested schema — no prose, no markdown code fences.",
  ].join(" ");
}
