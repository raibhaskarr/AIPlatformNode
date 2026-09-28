# Architecture

## Dependency direction

```
Product application (e.g. PravnyaAdmin, Pravnya)
    ↓
@pravnix/ai-node
    ↓
@pravnix/ai-orchestration ──→ @pravnix/ai-structured-output
    ↓                              ↑
@pravnix/ai-provider-*  ──→ @pravnix/ai-abstractions ──→ @pravnix/ai-core
    ↑
@pravnix/ai-observability   @pravnix/ai-provider-support
```

The platform never references a product repository. Products depend on this platform; this
platform has zero knowledge that PravnyaAdmin, Pravnya, or any other product exists.

## Package boundaries

- **`@pravnix/ai-core`** — pure, dependency-free models (`AiRequest`, `AiResponse`, `AiMessage`,
  `AiExecutionContext`, `AiExecutionResult`/`AiExecutionResultOf<T>`, `AiError`, ...). No behavior,
  no I/O, no wiring.
- **`@pravnix/ai-abstractions`** — the contracts everything else implements or depends on:
  `AiClient` (minimal generate contract), `AiProvider` (a concrete provider — extends `AiClient`
  with identity + capability), `AiProviderResolver`, the orchestrator contracts, and the telemetry
  contracts (`AiTelemetrySink`, `ContentLoggingPolicy`).
- **`@pravnix/ai-structured-output`** — turns raw model text into a typed value or an explicit
  typed failure, validated with `zod`. No provider or wiring knowledge. See
  [structured-output.md](structured-output.md).
- **`@pravnix/ai-provider-support`** — shared retry/backoff, HTTP-status → `AiErrorCode` mapping,
  and the reusable provider contract test suite every provider package is held to.
- **`@pravnix/ai-provider-fake`** / **`@pravnix/ai-provider-anthropic`** /
  **`@pravnix/ai-provider-gemini`** / **`@pravnix/ai-provider-openai`** — concrete `AiProvider`
  implementations. Provider SDK/wire types never leak past their own package.
- **`@pravnix/ai-orchestration`** — `AiOrchestratorImpl`, the only class implementing the raw-text,
  structured, and streaming execution contracts. Owns the execution pipeline (below).
- **`@pravnix/ai-observability`** — the default (metadata-only) telemetry sink.
- **`@pravnix/ai-node`** — `createAiPlatform`, `createFakeProvider`, `createAnthropicProvider`,
  `createGeminiProvider`, `createOpenAiProvider`. No single "add everything" function.

## Execution pipeline (`AiOrchestratorImpl`)

For `execute(operation, signal)`:

1. **Validate** — `AiRequest.messages` must be non-empty, or fail with `InvalidConfiguration`.
2. **Resolve provider** — `operation.provider ?? defaultProvider`, looked up via
   `AiProviderResolver`. Unregistered provider → fail with `UnsupportedProvider`. This never
   silently falls back to a different provider.
3. **Execute** — call `provider.generate`. Provider exceptions are caught and normalized into
   `AiError`; an abort (`error.name === "AbortError"`) is the one exception that is never
   normalized — it always propagates as a real thrown exception, never as a failed
   `AiExecutionResult`.
4. **Telemetry** — exactly one `AiTelemetryEvent` recorded per call, success or failure.
5. **Return** `AiExecutionResult` (`{success, response|error, metadata}`).

For `executeStructured<T>(operation, signal)`, steps 1–3 are identical, then:

4. **Parse** the response text via `@pravnix/ai-structured-output`'s `parseStructured`.
5. **Repair** (if parsing failed and `maxRepairAttempts > 0`) — re-invoke the *same* provider with
   the conversation history plus an appended repair-instruction message, up to
   `maxRepairAttempts` times. This is a semantic correction loop, not a network retry.
6. **Telemetry + return** `AiExecutionResultOf<T>`, with `metadata.repairCount` reflecting how many
   repair attempts were actually used.

For `executeStream(operation, signal)`, steps 1–3 delegate to `provider.generateStream`; chunks are
yielded as they arrive, and exactly one telemetry event is recorded once the stream completes or
errors (latency = time to stream completion).

### Why there is no second retry layer here

A real provider (Anthropic/Gemini/OpenAI) already has its own bounded retry via
`@pravnix/ai-provider-support`'s `withRetry`, for transient network/5xx/429 failures. The
orchestrator does **not** wrap that in a second retry loop — stacking two independent retry layers
on the same transient failure is a retry storm waiting to happen. The only retry-shaped behavior at
the orchestration layer is the structured-output repair loop, which operates on a completely
different failure mode (the model produced text that doesn't parse/validate) and is independently
bounded.

## Error model

See [security-and-privacy.md](security-and-privacy.md) for what error messages may/may not
contain. Error codes: `InvalidConfiguration`, `UnsupportedProvider`, `AuthenticationFailure`,
`RateLimited`, `Timeout`, `ProviderUnavailable`, `Cancelled` (used only as a code value — actual
cancellation is always a thrown exception, never this code, per step 3 above), `InvalidResponse`,
`StructuredOutputParseFailure`, `StructuredOutputValidationFailure`, `RepairFailure`,
`ContentPolicyRejection`, `Unknown`.

## Provider routing

Routing today is name-based only (`AiProviderResolver.tryResolve(name)`), backed by every
`AiProvider` passed into `createAiPlatform`. `AiModelRequirements` exists on `AiOperation` as an
extension point for capability/cost/latency-tier routing, but nothing currently implements
requirement-based selection — see [ADR 0001](adr/0001-shared-ai-execution-platform.md) for why
that's deferred rather than built speculatively. Tier→model-name mapping
(fast/balanced/writer/premium, etc.) is a product-side concern via `AiRequestOptions.modelOverride`.

## Multimodal and streaming

Both are built in from day one — see [ADR 0002](adr/0002-ts-port-divergences.md) for why this repo
diverges from the .NET platform on these two points specifically.
