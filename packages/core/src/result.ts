import type { AiError } from "./error";
import type { AiResponse } from "./response";

export interface AiExecutionMetadata {
  retryCount: number;
  repairCount: number;
  latencyMs: number;
  correlationId: string;
}

export type AiExecutionResult =
  | { success: true; response: AiResponse; metadata: AiExecutionMetadata }
  | { success: false; error: AiError; metadata: AiExecutionMetadata };

export type AiExecutionResultOf<T> =
  | { success: true; value: T; metadata: AiExecutionMetadata }
  | { success: false; error: AiError; metadata: AiExecutionMetadata };

export function successResult(response: AiResponse, metadata: AiExecutionMetadata): AiExecutionResult {
  return { success: true, response, metadata };
}

export function failureResult(error: AiError, metadata: AiExecutionMetadata): AiExecutionResult {
  return { success: false, error, metadata };
}

export function successResultOf<T>(value: T, metadata: AiExecutionMetadata): AiExecutionResultOf<T> {
  return { success: true, value, metadata };
}

export function failureResultOf<T>(error: AiError, metadata: AiExecutionMetadata): AiExecutionResultOf<T> {
  return { success: false, error, metadata };
}
