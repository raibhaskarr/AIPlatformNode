import type { AiProvider } from "@pravnix/ai-abstractions";
import { AnthropicAiProvider, type AnthropicProviderOptions } from "@pravnix/ai-provider-anthropic";
import { FakeAiProvider, type FakeAiProviderOptions } from "@pravnix/ai-provider-fake";
import { GeminiAiProvider, type GeminiProviderOptions } from "@pravnix/ai-provider-gemini";
import { OpenAiProvider, type OpenAiProviderOptions } from "@pravnix/ai-provider-openai";

/**
 * One factory function per provider, mirroring the .NET platform's `AddPravnixXProvider` — there
 * is deliberately no single "add everything" function. A product imports only the providers it
 * needs.
 */
export function createFakeProvider(options: FakeAiProviderOptions = {}): AiProvider {
  return new FakeAiProvider(options);
}

export function createAnthropicProvider(options: AnthropicProviderOptions): AiProvider {
  return new AnthropicAiProvider(options);
}

export function createGeminiProvider(options: GeminiProviderOptions): AiProvider {
  return new GeminiAiProvider(options);
}

export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  return new OpenAiProvider(options);
}
