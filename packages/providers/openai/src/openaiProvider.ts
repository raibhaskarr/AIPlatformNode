import OpenAI from "openai";
import { AiProviderError, isAbortError, type AiRequest, type AiResponse, type AiStreamChunk, type AiUsage } from "@pravnix/ai-core";
import type { AiProvider } from "@pravnix/ai-abstractions";
import { isRetryableHttpStatus, mapHttpStatusToAiError, withRetry } from "@pravnix/ai-provider-support";
import { mapMessages } from "./mapping";
import { resolveOpenAiOptions, type OpenAiProviderOptions, type ResolvedOpenAiProviderOptions } from "./options";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly supportsStructuredOutput = true;
  readonly supportsStreaming = true;
  private readonly client: OpenAI;
  private readonly options: ResolvedOpenAiProviderOptions;

  constructor(options: OpenAiProviderOptions) {
    this.options = resolveOpenAiOptions(options);
    this.client = new OpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      organization: this.options.organization,
      timeout: this.options.timeoutMs,
    });
  }

  async generate(request: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    const model = request.options?.modelOverride ?? this.options.model;
    try {
      const completion = await withRetry(
        () =>
          this.client.chat.completions.create(
            {
              model,
              messages: mapMessages(request.systemPrompt, request.messages),
              max_tokens: request.options?.maxOutputTokens ?? this.options.maxOutputTokens,
              temperature: request.options?.temperature ?? this.options.temperature,
            },
            { signal }
          ),
        {
          maxRetries: request.options?.maxRetries ?? this.options.maxRetries,
          isRetryable: (err) => this.isRetryable(err),
        }
      );

      const choice = completion.choices[0];
      const usage: AiUsage = {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        totalTokens: completion.usage?.total_tokens ?? 0,
      };
      return {
        text: choice?.message.content ?? "",
        model: { provider: this.name, model: completion.model },
        usage,
        finishReason: choice?.finish_reason ?? "stop",
      };
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof AiProviderError) throw err;
      throw this.toAiProviderError(err);
    }
  }

  async *generateStream(request: AiRequest, signal?: AbortSignal): AsyncIterable<AiStreamChunk> {
    const model = request.options?.modelOverride ?? this.options.model;
    try {
      const stream = await this.client.chat.completions.create(
        {
          model,
          messages: mapMessages(request.systemPrompt, request.messages),
          max_tokens: request.options?.maxOutputTokens ?? this.options.maxOutputTokens,
          temperature: request.options?.temperature ?? this.options.temperature,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal }
      );

      let usage: AiUsage | undefined;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) yield { delta, done: false };
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }
      yield { delta: "", done: true, usage };
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw this.toAiProviderError(err);
    }
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof OpenAI.APIError && typeof err.status === "number") {
      return isRetryableHttpStatus(err.status);
    }
    return false;
  }

  private toAiProviderError(err: unknown): AiProviderError {
    if (err instanceof OpenAI.APIError && typeof err.status === "number") {
      return new AiProviderError(mapHttpStatusToAiError(err.status, this.name));
    }
    return new AiProviderError({
      code: "Unknown",
      safeMessage: "OpenAI provider encountered an unexpected error.",
      retryable: false,
    });
  }
}
