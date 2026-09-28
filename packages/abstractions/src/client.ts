import type { AiRequest, AiResponse, AiStreamChunk } from "@pravnix/ai-core";

export interface AiClient {
  generate(request: AiRequest, signal?: AbortSignal): Promise<AiResponse>;
  /** Optional: providers that support token streaming implement this. */
  generateStream?(request: AiRequest, signal?: AbortSignal): AsyncIterable<AiStreamChunk>;
}

export interface AiProvider extends AiClient {
  readonly name: string;
  readonly supportsStructuredOutput: boolean;
  readonly supportsStreaming: boolean;
}

export interface AiProviderResolver {
  tryResolve(name: string): AiProvider | undefined;
}
