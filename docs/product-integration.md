# Product Integration

See [versioning-and-releases.md](versioning-and-releases.md) for how to actually install
`@pravnix/ai-node` into your product (a sibling-checkout `file:` dependency today — the git
`:subdirectory` syntax you might expect does **not** work with plain npm).

## Build your own facade

Never call `@pravnix/ai-orchestration` or inject `orchestrator` directly into a controller/route
handler. Build your product's own facade on top of it — e.g. `IPravnyaAiService` — the same way
PranTrackingSystem's `backend/src/modules/ai/ai.factory.ts` already wraps its own provider
abstraction. Your facade is where prompts, schemas, tier→model mapping, and per-feature failure
policy live. This platform provides none of that on purpose — see
[ADR 0001](adr/0001-shared-ai-execution-platform.md).

```ts
import { textMessage, type AiRequest } from "@pravnix/ai-core";
import { createAiPlatform, createAnthropicProvider, createGeminiProvider } from "@pravnix/ai-node";
import { z } from "zod";

const { orchestrator } = createAiPlatform({
  providers: [
    createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY! }),
  ],
  defaultProvider: "claude",
});

const GoalSuggestionSchema = z.object({
  title: z.string(),
  rationale: z.string(),
});

export async function suggestGoal(kidContext: string) {
  const result = await orchestrator.executeStructured({
    name: "pravnyaadmin.suggest-goal",
    request: {
      systemPrompt: "You are a pediatric therapy goal-writing assistant...", // YOUR prompt, lives here
      messages: [textMessage("user", kidContext)],
    },
    schema: GoalSuggestionSchema,
  });

  if (!result.success) {
    // YOUR failure policy: degrade, no-op, or propagate. The platform doesn't decide this for you.
    throw new Error(result.error.safeMessage);
  }
  return result.value;
}
```

## Per-operation failure policy

Each product decides its own failure policy per feature — there is no single right answer:

- **Degraded fallback**: e.g. an activity-card suggestion feature might fall back to a static
  template list if AI generation fails.
- **No-op / empty result**: a "smart insights" widget might just render nothing.
- **Propagate**: a synchronous, user-initiated action (e.g. "generate my goal now") should surface
  the failure to the user.

## Populate `AiExecutionContext` from day one

Always pass `productId`, and `tenantId`/`userId`/`featureId` where known — this is what makes
telemetry and cost tracking usable across products once more than one integrates.

```ts
import { createExecutionContext } from "@pravnix/ai-core";

const executionContext = createExecutionContext({
  productId: "pravnyaadmin",
  tenantId: tenant.id,
  featureId: "suggest-goal",
});
```

## Testing

Test against `createFakeProvider` — never a hand-rolled mock of `AiProvider`. It's deterministic,
supports structured output and streaming, and needs no network or API key.

```ts
import { createAiPlatform, createFakeProvider } from "@pravnix/ai-node";

const { orchestrator } = createAiPlatform({
  providers: [createFakeProvider({ responseSelector: () => '{"title":"...","rationale":"..."}' })],
  defaultProvider: "fake",
});
```

## Multimodal input

Build `AiContentPart[]` for image/audio/video directly — see
[ADR 0002](adr/0002-ts-port-divergences.md) for the shape:

```ts
const message = {
  role: "user" as const,
  content: [
    { type: "text" as const, text: "What does this IEP goal say?" },
    { type: "image" as const, data: { base64: imageBase64 }, mimeType: "image/png" },
  ],
};
```
