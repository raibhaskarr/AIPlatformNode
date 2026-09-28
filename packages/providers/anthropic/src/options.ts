export interface AnthropicProviderOptions {
  apiKey: string;
  /** Provider-specific model name. No tier mapping here — that's a product-side concern. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseUrl?: string;
}

export interface ResolvedAnthropicProviderOptions {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  baseUrl?: string;
}

/** Fails loudly at construction on missing config — never a silent fallback. */
export function resolveAnthropicOptions(options: AnthropicProviderOptions): ResolvedAnthropicProviderOptions {
  if (!options.apiKey) {
    throw new Error("@pravnix/ai-provider-anthropic: apiKey is required.");
  }
  return {
    apiKey: options.apiKey,
    model: options.model ?? "claude-sonnet-4-5",
    maxTokens: options.maxTokens ?? 4000,
    temperature: options.temperature ?? 0.2,
    timeoutMs: options.timeoutMs ?? 60_000,
    maxRetries: options.maxRetries ?? 3,
    baseUrl: options.baseUrl,
  };
}
