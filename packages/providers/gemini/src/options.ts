export interface GeminiProviderOptions {
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxRetries?: number;
}

export interface ResolvedGeminiProviderOptions {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  maxRetries: number;
}

export function resolveGeminiOptions(options: GeminiProviderOptions): ResolvedGeminiProviderOptions {
  if (!options.apiKey) {
    throw new Error("@pravnix/ai-provider-gemini: apiKey is required.");
  }
  return {
    apiKey: options.apiKey,
    // Google's current recommended default general-purpose model (2026-09). Bump when a newer
    // model line ships — callers can always override via `model`.
    model: options.model ?? "gemini-3.8-flash",
    maxOutputTokens: options.maxOutputTokens ?? 4000,
    temperature: options.temperature ?? 0.2,
    maxRetries: options.maxRetries ?? 3,
  };
}
