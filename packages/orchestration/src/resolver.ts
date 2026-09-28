import type { AiProvider, AiProviderResolver } from "@pravnix/ai-abstractions";

export class DictionaryAiProviderResolver implements AiProviderResolver {
  private readonly providers: Map<string, AiProvider>;

  constructor(providers: AiProvider[]) {
    this.providers = new Map(providers.map((p) => [p.name, p]));
  }

  tryResolve(name: string): AiProvider | undefined {
    return this.providers.get(name);
  }
}
