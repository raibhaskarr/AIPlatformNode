import type {
  AiExecutionResult,
  AiExecutionResultOf,
  AiOperation,
  AiStreamChunk,
  StructuredAiOperation,
} from "@pravnix/ai-core";

export interface AiOrchestratorContract {
  execute(operation: AiOperation, signal?: AbortSignal): Promise<AiExecutionResult>;
  executeStructured<T>(
    operation: StructuredAiOperation<T>,
    signal?: AbortSignal
  ): Promise<AiExecutionResultOf<T>>;
}

/** Typed-only entry point for products that never need the raw-text path. */
export interface IStructuredAiClient {
  executeStructured<T>(
    operation: StructuredAiOperation<T>,
    signal?: AbortSignal
  ): Promise<AiExecutionResultOf<T>>;
}

export interface AiStreamingOrchestratorContract {
  executeStream(operation: AiOperation, signal?: AbortSignal): AsyncIterable<AiStreamChunk>;
}
