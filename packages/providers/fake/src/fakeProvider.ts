import type { AiRequest, AiResponse, AiStreamChunk } from "@pravnix/ai-core";
import type { AiProvider } from "@pravnix/ai-abstractions";
import { estimateUsage } from "./usage";

export interface FakeAiProviderOptions {
  name?: string;
  model?: string;
  responseSelector?: (request: AiRequest) => string;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

/**
 * Deterministic, network-free AiProvider. Used for orchestrator tests, product-side unit tests,
 * and local development without real API keys — never a hand-rolled mock, per docs/product-integration.md.
 */
export class FakeAiProvider implements AiProvider {
  readonly name: string;
  readonly supportsStructuredOutput = true;
  readonly supportsStreaming = true;
  private readonly model: string;
  private readonly responseSelector: (request: AiRequest) => string;

  constructor(options: FakeAiProviderOptions = {}) {
    this.name = options.name ?? "fake";
    this.model = options.model ?? "fake-model";
    this.responseSelector = options.responseSelector ?? (() => "This is a deterministic fake response.");
  }

  async generate(request: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
    if (signal?.aborted) throw abortError();
    const text = this.responseSelector(request);
    return {
      text,
      model: { provider: this.name, model: this.model },
      usage: estimateUsage(request, text),
      finishReason: "stop",
    };
  }

  async *generateStream(request: AiRequest, signal?: AbortSignal): AsyncIterable<AiStreamChunk> {
    if (signal?.aborted) throw abortError();
    const text = this.responseSelector(request);
    const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);

    for (const token of tokens) {
      if (signal?.aborted) throw abortError();
      yield { delta: token, done: false };
    }
    yield { delta: "", done: true, usage: estimateUsage(request, text) };
  }
}
