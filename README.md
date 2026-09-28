# AIPlatformNode

A shared AI execution platform for the Pravnix product family, in TypeScript. This is a
line-for-line-in-spirit port of the architecture proven in the .NET `pravnix-ai-platform` repo,
extended with multimodal input and token streaming from day one.

See [`docs/architecture.md`](docs/architecture.md) for the full package graph and execution
pipeline, and [`docs/adr/0001-shared-ai-execution-platform.md`](docs/adr/0001-shared-ai-execution-platform.md)
for the single most important rule in this repo: **prompts, schemas, and business validation stay
in each product forever.** This platform only ever provides generic execution.

## Packages

| Package | Purpose |
| --- | --- |
| `@pravnix/ai-core` | Pure, dependency-free models (`AiRequest`, `AiResponse`, `AiError`, ...) |
| `@pravnix/ai-abstractions` | Contracts: `AiProvider`, `AiProviderResolver`, telemetry |
| `@pravnix/ai-structured-output` | Raw model text → typed value or explicit typed failure |
| `@pravnix/ai-provider-support` | Shared retry/backoff, error mapping, provider contract tests |
| `@pravnix/ai-observability` | Default metadata-only telemetry sink |
| `@pravnix/ai-provider-fake` | Deterministic provider for tests/local dev |
| `@pravnix/ai-provider-anthropic` | Claude, via `@anthropic-ai/sdk` |
| `@pravnix/ai-provider-gemini` | Gemini, via `@google/generative-ai` |
| `@pravnix/ai-provider-openai` | OpenAI, via `openai` |
| `@pravnix/ai-orchestration` | `AiOrchestratorImpl`: the execution pipeline |
| `@pravnix/ai-node` | Wiring layer — `createAiPlatform`, the entry point most products use |

## Quick start

```bash
npm install
npm run build
npm run sample   # runs samples/basic-sample against the fake provider
```

```ts
import { textMessage } from "@pravnix/ai-core";
import { createAiPlatform, createAnthropicProvider } from "@pravnix/ai-node";

const { orchestrator } = createAiPlatform({
  providers: [createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })],
  defaultProvider: "claude",
});

const result = await orchestrator.execute({
  name: "my-feature.greet",
  request: { messages: [textMessage("user", "Say hello.")] },
});
```

## Requirements

Node `>=22.3.0 <23`, matching `PravnyaAdmin`/`Pravnya`.

## Docs

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/product-integration.md`](docs/product-integration.md)
- [`docs/security-and-privacy.md`](docs/security-and-privacy.md)
- [`docs/structured-output.md`](docs/structured-output.md)
- [`docs/versioning-and-releases.md`](docs/versioning-and-releases.md)
- [`docs/adr/0001-shared-ai-execution-platform.md`](docs/adr/0001-shared-ai-execution-platform.md)
- [`docs/adr/0002-ts-port-divergences.md`](docs/adr/0002-ts-port-divergences.md)
