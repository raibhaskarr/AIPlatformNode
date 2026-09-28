import { GoogleGenerativeAI } from "@google/generative-ai";
import { AiProviderError, isAbortError, type AiRequest, type AiResponse, type AiStreamChunk, type AiUsage } from "@pravnix/ai-core";
import type { AiProvider } from "@pravnix/ai-abstractions";
import { isRetryableHttpStatus, mapHttpStatusToAiError, withRetry } from "@pravnix/ai-provider-support";
import { mapMessages } from "./mapping";
import { resolveGeminiOptions, type GeminiProviderOptions, type ResolvedGeminiProviderOptions } from "./options";

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return undefined;
}

export class GeminiAiProvider implements AiProvider {
  readonly name = "gemini";
  readonly supportsStructuredOutput = true;
  readonly supportsStreaming = true;
  private readonly client: GoogleGenerativeAI;
  private readonly options: ResolvedGeminiProviderOptions;

  constructor(options: GeminiProviderOptions) {
    this.options = resolveGeminiOptions(options);
    this.client = new GoogleGenerativeAI(this.options.apiKey);
  }

  private getModel(request: AiRequest) {
    return this.client.getGenerativeModel({
      model: request.options?.modelOverride ?? this.options.model,
      systemInstruction: request.systemPrompt,
    });
  }

  async generate(request: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    const model = this.getModel(request);
    try {
      const result = await withRetry(
        () =>
          model.generateContent(
            {
              contents: mapMessages(request.messages),
              generationConfig: {
                temperature: request.options?.temperature ?? this.options.temperature,
                maxOutputTokens: request.options?.maxOutputTokens ?? this.options.maxOutputTokens,
              },
            },
            { signal }
          ),
        {
          maxRetries: request.options?.maxRetries ?? this.options.maxRetries,
          isRetryable: (err) => {
            const status = extractStatus(err);
            return status !== undefined && isRetryableHttpStatus(status);
          },
        }
      );

      const usageMeta = result.response.usageMetadata;
      const usage: AiUsage = {
        inputTokens: usageMeta?.promptTokenCount ?? 0,
        outputTokens: usageMeta?.candidatesTokenCount ?? 0,
        totalTokens: usageMeta?.totalTokenCount ?? 0,
      };
      return {
        text: result.response.text(),
        model: { provider: this.name, model: request.options?.modelOverride ?? this.options.model },
        usage,
        finishReason: result.response.candidates?.[0]?.finishReason ?? "stop",
      };
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err instanceof AiProviderError) throw err;
      throw this.toAiProviderError(err);
    }
  }

  async *generateStream(request: AiRequest, signal?: AbortSignal): AsyncIterable<AiStreamChunk> {
    const model = this.getModel(request);
    try {
      const result = await model.generateContentStream(
        {
          contents: mapMessages(request.messages),
          generationConfig: {
            temperature: request.options?.temperature ?? this.options.temperature,
            maxOutputTokens: request.options?.maxOutputTokens ?? this.options.maxOutputTokens,
          },
        },
        { signal }
      );

      for await (const chunk of result.stream) {
        yield { delta: chunk.text(), done: false };
      }

      const finalResponse = await result.response;
      const usageMeta = finalResponse.usageMetadata;
      const usage: AiUsage = {
        inputTokens: usageMeta?.promptTokenCount ?? 0,
        outputTokens: usageMeta?.candidatesTokenCount ?? 0,
        totalTokens: usageMeta?.totalTokenCount ?? 0,
      };
      yield { delta: "", done: true, usage };
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw this.toAiProviderError(err);
    }
  }

  private toAiProviderError(err: unknown): AiProviderError {
    const status = extractStatus(err);
    if (status !== undefined) {
      return new AiProviderError(mapHttpStatusToAiError(status, this.name));
    }
    return new AiProviderError({
      code: "Unknown",
      safeMessage: "Gemini provider encountered an unexpected error.",
      retryable: false,
    });
  }
}
