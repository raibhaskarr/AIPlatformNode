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
  // No default -- claude-sonnet-5 (the default model above) rejects `temperature` outright as
  // "deprecated for this model", not just a value that gets overridden. Defaulting this to e.g.
  // 0.2 meant every call silently 400'd until a caller happened to override it. Stays undefined
  // (and the provider omits the field entirely) unless a caller explicitly opts in.
  temperature: number | undefined;
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
    // Anthropic's current general-purpose default (2026-09). Bump when a newer model line ships —
    // callers can always override via `model` without waiting for this default to change.
    model: options.model ?? "claude-sonnet-5",
    maxTokens: options.maxTokens ?? 4000,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs ?? 60_000,
    maxRetries: options.maxRetries ?? 3,
    baseUrl: options.baseUrl,
  };
}
