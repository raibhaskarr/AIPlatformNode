# ADR 0002: Deliberate Divergences in the TypeScript Port

## Status

Accepted.

## Context

This repo ports the .NET `pravnix-ai-platform`'s architecture, not its code, verbatim. Three
points depart from the .NET source. Each is called out here explicitly so the divergence is a
decision on record, not something a future reader has to reverse-engineer from a diff against the
.NET repo.

## Decision 1: Multimodal input from day one

The .NET platform's `AiContentPart` is text-only, by explicit design — its own ADR/architecture
notes defer image/audio/video "until a real caller needs it." This port's `AiContentPart`
(`@pravnix/ai-core`) is a discriminated union over `text | image | audio | video` from the first
commit.

**Why**: PranTrackingSystem's existing embedded AI module already has real, shipped callers for all
three — IEP/term-report image OCR, audio transcription, video session analysis — that this
platform is explicitly meant to be able to support. There is no "wait for a real caller" question
here; the caller already exists and this port's purpose is to be able to serve it.

## Decision 2: Streaming built in, not deferred

The .NET platform has no streaming concept at all. This port's `AiProvider`/`AiClient` interfaces
carry an optional `generateStream`, and `AiOrchestratorImpl` exposes `executeStream`.

**Why**: PranTrackingSystem's Ask Pravnya conversational feature streams tokens to the client
today. Matching that capability was an explicit requirement for this port, not a speculative
addition.

## Decision 3: Official provider SDKs instead of raw HTTP

The .NET Anthropic provider talks to `/v1/messages` over raw `HttpClient` calls with hand-written
wire DTOs — reasonable when it was built, given the state of .NET SDK options at the time. This
port's providers use `@anthropic-ai/sdk`, `@google/generative-ai`, and `openai` directly.

**Why**: these are the same official SDKs PranTrackingSystem's embedded AI module already depends
on and trusts. Hand-rolling wire mapping in TypeScript for three separate provider APIs would be
pure duplicated maintenance burden with no offsetting benefit — the boundary the .NET platform
protects (provider wire types never leaking past the provider's own package) is preserved just as
well by wrapping an SDK as by wrapping raw HTTP.

## What does not change

[ADR 0001](0001-shared-ai-execution-platform.md)'s central rule is unaffected by any of the above:
prompts, schemas, and business validation still never move into this platform. None of these three
divergences expand what the platform owns in that sense — they expand the *shape* of a request/response
(content parts, stream chunks) and the *transport* used to fulfill it, not who owns what content
goes into a prompt.
