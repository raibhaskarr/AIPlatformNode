export interface OpenAiProviderOptions {
  apiKey: string;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseUrl?: string;
  organization?: string;
}

export interface ResolvedOpenAiProviderOptions {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  baseUrl?: string;
  organization?: string;
}

export function resolveOpenAiOptions(options: OpenAiProviderOptions): ResolvedOpenAiProviderOptions {
  if (!options.apiKey) {
    throw new Error("@pravnix/ai-provider-openai: apiKey is required.");
  }
  return {
    apiKey: options.apiKey,
    model: options.model ?? "gpt-4o",
    maxOutputTokens: options.maxOutputTokens ?? 4000,
    temperature: options.temperature ?? 0.2,
    timeoutMs: options.timeoutMs ?? 60_000,
    maxRetries: options.maxRetries ?? 3,
    baseUrl: options.baseUrl,
    organization: options.organization,
  };
}
