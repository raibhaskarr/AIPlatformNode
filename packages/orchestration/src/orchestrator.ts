import {
  AiProviderError,
  createAiError,
  createExecutionContext,
  failureResult,
  failureResultOf,
  isAbortError,
  successResult,
  successResultOf,
  type AiError,
  type AiExecutionMetadata,
  type AiExecutionResult,
  type AiExecutionResultOf,
  type AiMessage,
  type AiOperation,
  type AiRequest,
  type AiResponse,
  type AiStreamChunk,
  type AiUsage,
  type StructuredAiOperation,
  DEFAULT_MAX_REPAIR_ATTEMPTS,
} from "@pravnix/ai-core";
import type { AiProvider, AiProviderResolver, AiTelemetryEvent, AiTelemetrySink } from "@pravnix/ai-abstractions";
import { parseStructured } from "@pravnix/ai-structured-output";
import { buildRepairInstruction } from "./repairInstruction";
import { validateRequest } from "./validate";

export interface AiOrchestratorOptions {
  resolver: AiProviderResolver;
  telemetrySink: AiTelemetrySink;
  defaultProvider?: string;
}

type GenerateOutcome = { ok: true; response: AiResponse } | { ok: false; error: AiError };

/**
 * The only class implementing both the raw-text and structured execution contracts, mirroring
 * the .NET platform's `AiOrchestrator`. See docs/architecture.md for the pipeline this follows
 * step for step.
 */
export class AiOrchestratorImpl {
  private readonly resolver: AiProviderResolver;
  private readonly telemetrySink: AiTelemetrySink;
  private readonly defaultProvider: string;

  constructor(options: AiOrchestratorOptions) {
    this.resolver = options.resolver;
    this.telemetrySink = options.telemetrySink;
    this.defaultProvider = options.defaultProvider ?? "fake";
  }

  async execute(operation: AiOperation, signal?: AbortSignal): Promise<AiExecutionResult> {
    const start = Date.now();
    const correlationId = operation.request.executionContext?.correlationId ?? createExecutionContext().correlationId;

    const validationError = validateRequest(operation.request);
    if (validationError) {
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, validationError, undefined, metadata, undefined);
      return failureResult(validationError, metadata);
    }

    const providerName = operation.provider ?? this.defaultProvider;
    const provider = this.resolver.tryResolve(providerName);
    if (!provider) {
      const error = createAiError("UnsupportedProvider", `No provider registered for "${providerName}".`);
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, error, undefined, metadata, providerName);
      return failureResult(error, metadata);
    }

    const outcome = await this.invokeGenerate(provider, operation.request, signal);
    const metadata = this.buildMetadata(start, correlationId, 0, 0);
    if (!outcome.ok) {
      await this.recordTelemetry(operation, outcome.error, undefined, metadata, provider.name);
      return failureResult(outcome.error, metadata);
    }
    await this.recordTelemetry(operation, undefined, outcome.response, metadata, provider.name);
    return successResult(outcome.response, metadata);
  }

  async executeStructured<T>(
    operation: StructuredAiOperation<T>,
    signal?: AbortSignal
  ): Promise<AiExecutionResultOf<T>> {
    const start = Date.now();
    const correlationId = operation.request.executionContext?.correlationId ?? createExecutionContext().correlationId;

    const validationError = validateRequest(operation.request);
    if (validationError) {
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, validationError, undefined, metadata, undefined);
      return failureResultOf(validationError, metadata);
    }

    const providerName = operation.provider ?? this.defaultProvider;
    const provider = this.resolver.tryResolve(providerName);
    if (!provider) {
      const error = createAiError("UnsupportedProvider", `No provider registered for "${providerName}".`);
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, error, undefined, metadata, providerName);
      return failureResultOf(error, metadata);
    }

    const initialOutcome = await this.invokeGenerate(provider, operation.request, signal);
    if (!initialOutcome.ok) {
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, initialOutcome.error, undefined, metadata, provider.name);
      return failureResultOf(initialOutcome.error, metadata);
    }

    const maxRepairAttempts = operation.maxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS;
    let repairCount = 0;
    let currentRequest = operation.request;
    let lastResponse = initialOutcome.response;
    let parseResult = parseStructured(lastResponse.text, operation.schema);

    while (!parseResult.success && repairCount < maxRepairAttempts) {
      const repairMessages: AiMessage[] = [
        ...currentRequest.messages,
        { role: "assistant", content: [{ type: "text", text: lastResponse.text }] },
        { role: "user", content: [{ type: "text", text: buildRepairInstruction(parseResult) }] },
      ];
      currentRequest = { ...currentRequest, messages: repairMessages };

      const repairOutcome = await this.invokeGenerate(provider, currentRequest, signal);
      repairCount += 1;
      if (!repairOutcome.ok) {
        const metadata = this.buildMetadata(start, correlationId, 0, repairCount);
        await this.recordTelemetry(operation, repairOutcome.error, lastResponse, metadata, provider.name);
        return failureResultOf(repairOutcome.error, metadata);
      }
      lastResponse = repairOutcome.response;
      parseResult = parseStructured(lastResponse.text, operation.schema);
    }

    const metadata = this.buildMetadata(start, correlationId, 0, repairCount);
    if (!parseResult.success) {
      const code = repairCount >= maxRepairAttempts && maxRepairAttempts > 0 ? "RepairFailure" : "StructuredOutputParseFailure";
      const error = createAiError(code, parseResult.safeMessage);
      await this.recordTelemetry(operation, error, lastResponse, metadata, provider.name);
      return failureResultOf(error, metadata);
    }

    await this.recordTelemetry(operation, undefined, lastResponse, metadata, provider.name);
    return successResultOf(parseResult.value, metadata);
  }

  async *executeStream(operation: AiOperation, signal?: AbortSignal): AsyncIterable<AiStreamChunk> {
    const start = Date.now();
    const correlationId = operation.request.executionContext?.correlationId ?? createExecutionContext().correlationId;

    const validationError = validateRequest(operation.request);
    if (validationError) {
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, validationError, undefined, metadata, undefined);
      throw new AiProviderError(validationError);
    }

    const providerName = operation.provider ?? this.defaultProvider;
    const provider = this.resolver.tryResolve(providerName);
    if (!provider) {
      const error = createAiError("UnsupportedProvider", `No provider registered for "${providerName}".`);
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, error, undefined, metadata, providerName);
      throw new AiProviderError(error);
    }

    if (!provider.supportsStreaming || !provider.generateStream) {
      const error = createAiError("InvalidConfiguration", `Provider "${provider.name}" does not support streaming.`);
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, error, undefined, metadata, provider.name);
      throw new AiProviderError(error);
    }

    let fullText = "";
    let lastUsage: AiUsage | undefined;

    try {
      for await (const chunk of provider.generateStream(operation.request, signal)) {
        fullText += chunk.delta;
        if (chunk.usage) lastUsage = chunk.usage;
        yield chunk;
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      const error =
        err instanceof AiProviderError
          ? { code: err.code, safeMessage: err.safeMessage, retryable: err.retryable }
          : createAiError("Unknown", "Provider stream threw an unexpected error.");
      const metadata = this.buildMetadata(start, correlationId, 0, 0);
      await this.recordTelemetry(operation, error, undefined, metadata, provider.name);
      throw err instanceof AiProviderError ? err : new AiProviderError(error);
    }

    const response: AiResponse = {
      text: fullText,
      model: { provider: provider.name, model: operation.request.options?.modelOverride ?? "unknown" },
      usage: lastUsage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      finishReason: "stop",
    };
    const metadata = this.buildMetadata(start, correlationId, 0, 0);
    await this.recordTelemetry(operation, undefined, response, metadata, provider.name);
  }

  private async invokeGenerate(
    provider: AiProvider,
    request: AiRequest,
    signal?: AbortSignal
  ): Promise<GenerateOutcome> {
    try {
      const response = await provider.generate(request, signal);
      return { ok: true, response };
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof AiProviderError) {
        return { ok: false, error: { code: err.code, safeMessage: err.safeMessage, retryable: err.retryable } };
      }
      return { ok: false, error: createAiError("Unknown", "Provider threw an unexpected error.") };
    }
  }

  private buildMetadata(start: number, correlationId: string, retryCount: number, repairCount: number): AiExecutionMetadata {
    return { retryCount, repairCount, latencyMs: Date.now() - start, correlationId };
  }

  private async recordTelemetry(
    operation: AiOperation,
    error: AiError | undefined,
    response: AiResponse | undefined,
    metadata: AiExecutionMetadata,
    providerName: string | undefined
  ): Promise<void> {
    const event: AiTelemetryEvent = {
      operationName: operation.name,
      provider: providerName ?? operation.provider ?? this.defaultProvider,
      model: response?.model.model,
      success: !error,
      latencyMs: metadata.latencyMs,
      retryCount: metadata.retryCount,
      repairCount: metadata.repairCount,
      errorCode: error?.code,
      correlationId: metadata.correlationId,
      usage: response?.usage,
    };
    await this.telemetrySink.record(event);
  }
}
