import type { z } from "zod";
import { extractJsonText } from "./extractor";

export type StructuredOutputFailureReason =
  | "EmptyOutput"
  | "MalformedJson"
  | "SchemaMismatch"
  | "RepairExhausted";

export type StructuredParseResult<T> =
  | { success: true; value: T }
  | { success: false; reason: StructuredOutputFailureReason; safeMessage: string };

function ok<T>(value: T): StructuredParseResult<T> {
  return { success: true, value };
}

function fail<T>(reason: StructuredOutputFailureReason, safeMessage: string): StructuredParseResult<T> {
  return { success: false, reason, safeMessage };
}

/**
 * Never returns a default/empty `T` on failure — always an explicit failure result the caller
 * (typically the orchestrator's repair loop) can act on.
 */
export function parseStructured<T>(rawText: string, schema: z.ZodType<T>): StructuredParseResult<T> {
  if (!rawText || rawText.trim().length === 0) {
    return fail("EmptyOutput", "Model returned an empty response.");
  }

  const extracted = extractJsonText(rawText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extracted);
  } catch {
    return fail("MalformedJson", "Model response was not valid JSON.");
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    return fail("SchemaMismatch", "Model response did not match the expected schema.");
  }

  return ok(result.data);
}

export interface ParseWithRepairOptions<T> {
  rawText: string;
  schema: z.ZodType<T>;
  /** Invoked with the failed result to build a correction prompt; returns the model's retry text. */
  repair: (failure: Extract<StructuredParseResult<T>, { success: false }>) => Promise<string>;
  maxRepairAttempts: number;
}

export interface ParseWithRepairResult<T> {
  result: StructuredParseResult<T>;
  repairCount: number;
}

/** `maxRepairAttempts = 0` disables repair entirely. */
export async function parseWithRepair<T>(options: ParseWithRepairOptions<T>): Promise<ParseWithRepairResult<T>> {
  const { schema, repair, maxRepairAttempts } = options;
  let rawText = options.rawText;
  let result = parseStructured(rawText, schema);
  let repairCount = 0;

  while (!result.success && repairCount < maxRepairAttempts) {
    rawText = await repair(result);
    result = parseStructured(rawText, schema);
    repairCount += 1;
  }

  if (!result.success && repairCount >= maxRepairAttempts && maxRepairAttempts > 0) {
    return {
      result: fail("RepairExhausted", `Repair exhausted after ${repairCount} attempt(s): ${result.safeMessage}`),
      repairCount,
    };
  }

  return { result, repairCount };
}
