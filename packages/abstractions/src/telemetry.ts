import type { AiErrorCode, AiUsage } from "@pravnix/ai-core";

/**
 * Metadata-only by construction: this type structurally has no field that could hold prompt or
 * response content. Any content logging is an explicit, separate opt-in — see ContentLoggingPolicy.
 */
export interface AiTelemetryEvent {
  operationName: string;
  provider: string;
  model?: string;
  success: boolean;
  latencyMs: number;
  retryCount: number;
  repairCount: number;
  errorCode?: AiErrorCode;
  correlationId: string;
  usage?: AiUsage;
}

export interface AiTelemetrySink {
  record(event: AiTelemetryEvent): void | Promise<void>;
}

export type ContentLoggingPolicy = "None" | "MetadataOnly" | "Redacted" | "DevelopmentFullContent";
