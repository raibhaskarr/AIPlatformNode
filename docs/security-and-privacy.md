# Security and Privacy

## Telemetry is metadata-only by default

`AiTelemetryEvent` (`@pravnix/ai-abstractions`) structurally has no field that can hold a prompt or
a response — `operationName`, `provider`, `model`, `success`, `latencyMs`, `retryCount`,
`repairCount`, `errorCode`, `correlationId`, `usage`. This is enforced by the type, not by
convention.

`ContentLoggingPolicy` (`None | MetadataOnly | Redacted | DevelopmentFullContent`) exists as an
extension point, but `@pravnix/ai-observability`'s default `ConsoleAiTelemetrySink` can only ever
honor `None` (suppress) or `MetadataOnly` (log the event as-is) — it has no content to redact or
log in the first place. A product that genuinely needs content logging must build its own sink at
the product boundary and opt in explicitly; it must never happen inside this platform.

## Secrets

Provider API keys come from environment variables or a secret manager, passed explicitly into
`createAnthropicProvider`/`createGeminiProvider`/`createOpenAiProvider` — never checked into
config files in this repo. All three providers throw at construction time if `apiKey` is missing —
fail loudly, never silently fall back to an unauthenticated or misconfigured state.

## Error messages never leak provider internals

`AiError.safeMessage` is hand-written per failure case in `@pravnix/ai-provider-support`'s
`mapHttpStatusToAiError` and each provider's own error mapping — it never echoes a raw response
body, header, or stack trace from the underlying SDK.

## Multimodal payload handling

Image/audio/video content (`AiContentPart` with `type: "image" | "audio" | "video"`) can carry
either inline base64 data or a URI. This platform does not persist, log, or cache multimodal
payloads anywhere — they pass straight through to the provider SDK call and are discarded. Any
retention (e.g. storing an uploaded IEP image) is a product-level decision and happens entirely
outside this platform.

## Cancellation

Every `generate`/`generateStream`/`execute*` call accepts an optional `AbortSignal`. Aborting a
request always surfaces as a real thrown exception (`error.name === "AbortError"`), never as a
failed `AiExecutionResult` — callers must not treat a cancelled request as a normal failure to
retry or report.
