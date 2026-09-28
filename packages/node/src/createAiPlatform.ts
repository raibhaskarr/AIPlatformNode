import type { AiProvider, AiTelemetrySink, ContentLoggingPolicy } from "@pravnix/ai-abstractions";
import { ConsoleAiTelemetrySink } from "@pravnix/ai-observability";
import { AiOrchestratorImpl, DictionaryAiProviderResolver } from "@pravnix/ai-orchestration";

export interface CreateAiPlatformOptions {
  providers: AiProvider[];
  defaultProvider?: string;
  telemetrySink?: AiTelemetrySink;
  contentLoggingPolicy?: ContentLoggingPolicy;
}

export interface AiPlatform {
  orchestrator: AiOrchestratorImpl;
}

/**
 * The single wiring entry point a product calls once at startup — the Node-idiomatic equivalent
 * of the .NET platform's `AddPravnixAiOrchestration`. Products build their OWN facade on top of
 * `orchestrator`; never inject it directly into a controller/route handler. See
 * docs/product-integration.md.
 */
export function createAiPlatform(options: CreateAiPlatformOptions): AiPlatform {
  const resolver = new DictionaryAiProviderResolver(options.providers);
  const telemetrySink = options.telemetrySink ?? new ConsoleAiTelemetrySink({ policy: options.contentLoggingPolicy ?? "MetadataOnly" });
  const orchestrator = new AiOrchestratorImpl({
    resolver,
    telemetrySink,
    defaultProvider: options.defaultProvider ?? "fake",
  });
  return { orchestrator };
}
