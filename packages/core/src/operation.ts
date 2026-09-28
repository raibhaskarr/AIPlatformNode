import type { z } from "zod";
import type { AiRequest } from "./request";

/**
 * Unused extension point, ported as-is from the .NET platform. Nothing implements
 * requirement-based routing today — per ADR 0001, that's deferred until a product has a concrete,
 * validated need. Tier→model-name mapping (fast/balanced/writer/premium, etc.) stays a product-side
 * concern via `AiRequestOptions.modelOverride`.
 */
export interface AiModelRequirements {
  minContextTokens?: number;
  maxCostPerCallUsd?: number;
  preferredTags?: string[];
}

export interface AiOperation {
  name: string;
  request: AiRequest;
  modelRequirements?: AiModelRequirements;
  /** Explicit provider name. Never silently substituted by the orchestrator. */
  provider?: string;
}

export interface StructuredAiOperation<T> extends AiOperation {
  schema: z.ZodType<T>;
  maxRepairAttempts?: number;
}

export const DEFAULT_MAX_REPAIR_ATTEMPTS = 1;
