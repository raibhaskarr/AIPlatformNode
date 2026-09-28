import Anthropic from "@anthropic-ai/sdk";
import { AiProviderError, isAbortError, type AiRequest, type AiResponse, type AiStreamChunk, type AiUsage } from "@pravnix/ai-core";
import type { AiProvider } from "@pravnix/ai-abstractions";
import { isRetryableHttpStatus, mapHttpStatusToAiError, withRetry } from "@pravnix/ai-provider-support";
import { mapMessages } from "./mapping";
import { resolveAnthropicOptions, type AnthropicProviderOptions, type ResolvedAnthropicProviderOptions } from "./options";

export class AnthropicAiProvider implements AiProvider {
  readonly name = "claude";
  readonly supportsStructuredOutput = true;
  readonly supportsStreaming = true;
  private readonly client: Anthropic;
  private readonly options: ResolvedAnthropicProviderOptions;

  constructor(options: AnthropicProviderOptions) {
    this.options = resolveAnthropicOptions(options);
    this.client = new Anthropic({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      timeout: this.options.timeoutMs,
    });
  }

  async generate(request: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    const model = request.options?.modelOverride ?? this.options.model;
    try {
      const message = await withRetry(
        () =>
          this.client.messages.create(
            {
              model,
              max_tokens: request.options?.maxOutputTokens ?? this.options.maxTokens,
              temperature: request.options?.temperature ?? this.options.temperature,
              system: request.systemPrompt,
              messages: mapMessages(request.messages),
            },
            { signal }
          ),
        {
          maxRetries: request.options?.maxRetries ?? this.options.maxRetries,
          isRetryable: (err) => this.isRetryable(err),
        }
      );

      const text = message.content
        .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      const usage: AiUsage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      };
      return {
        text,
        model: { provider: this.name, model: message.model },
        usage,
        finishReason: message.stop_reason ?? "stop",
      };
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof AiProviderError) throw err;
      throw this.toAiProviderError(err);
    }
  }

  async *generateStream(request: AiRequest, signal?: AbortSignal): AsyncIterable<AiStreamChunk> {
    const model = request.options?.modelOverride ?? this.options.model;
    const stream = this.client.messages.stream(
      {
        model,
        max_tokens: request.options?.maxOutputTokens ?? this.options.maxTokens,
        temperature: request.options?.temperature ?? this.options.temperature,
        system: request.systemPrompt,
        messages: mapMessages(request.messages),
      },
      { signal }
    );

    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { delta: event.delta.text, done: false };
        }
      }
      const finalMessage = await stream.finalMessage();
      const usage: AiUsage = {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      };
      yield { delta: "", done: true, usage };
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw this.toAiProviderError(err);
    }
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof Anthropic.APIError && typeof err.status === "number") {
      return isRetryableHttpStatus(err.status);
    }
    return false;
  }

  private toAiProviderError(err: unknown): AiProviderError {
    if (err instanceof Anthropic.APIError && typeof err.status === "number") {
      return new AiProviderError(mapHttpStatusToAiError(err.status, this.name));
    }
    return new AiProviderError({
      code: "Unknown",
      safeMessage: "Claude provider encountered an unexpected error.",
      retryable: false,
    });
  }
}
