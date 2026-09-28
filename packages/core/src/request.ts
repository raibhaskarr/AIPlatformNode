import type { AiMessage } from "./content";

export type DataClassification = "Unspecified" | "Public" | "Internal" | "Confidential" | "Restricted";

/**
 * Fresh per request. Every field but `correlationId` is optional — products populate what they
 * know; `correlationId` is auto-generated if not supplied so every call is traceable end to end.
 */
export interface AiExecutionContext {
  productId?: string;
  tenantId?: string;
  featureId?: string;
  userId?: string;
  correlationId: string;
  promptId?: string;
  promptVersion?: string;
  dataClassification?: DataClassification;
  tags?: Record<string, string>;
}

export function createExecutionContext(
  overrides: Partial<Omit<AiExecutionContext, "correlationId">> & { correlationId?: string } = {}
): AiExecutionContext {
  const { correlationId, ...rest } = overrides;
  return {
    correlationId: correlationId ?? crypto.randomUUID(),
    ...rest,
  };
}

export interface AiRequestOptions {
  /** Raw, provider-specific model name. Tier→model mapping is a product-side concern. */
  modelOverride?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  /** Extension point: providers that support it implement `generateStream`. */
  stream?: boolean;
}

export interface AiRequest {
  systemPrompt?: string;
  messages: AiMessage[];
  options?: AiRequestOptions;
  executionContext?: AiExecutionContext;
}
