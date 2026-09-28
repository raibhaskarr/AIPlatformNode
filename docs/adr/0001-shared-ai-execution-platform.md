# ADR 0001: A Shared AI Execution Platform

## Status

Accepted. Ported from the .NET `pravnix-ai-platform` repo's ADR 0001; the decision and its
reasoning carry over unchanged. See [ADR 0002](0002-ts-port-divergences.md) for the two points
where this TypeScript port deliberately diverges from the .NET source.

## Context

Multiple Pravnix products need to call LLM providers (Anthropic, Gemini, OpenAI, ...) for
generation, structured extraction, and (in this port) streaming. Each product independently
re-solving HTTP transport, retry, structured-output parsing, telemetry, and error normalization is
wasted, divergent effort.

## Decision

Build one shared platform that owns **only generic execution concerns**:

- HTTP transport and provider SDK wiring
- Bounded retry for transient failures
- Structured-output parsing and the repair loop
- Metadata-only telemetry
- Error normalization to a small, stable set of error codes
- (This port only) multimodal request/response shapes and token streaming

The platform **never** owns:

- Prompts or prompt templates
- Response schemas beyond "some zod schema the caller supplies"
- Business validation of any kind
- Domain models

**Prompt ownership is the single most important boundary in this project.** It never moves into
this platform, in this port or any future one, without a separate ADR superseding this one.

Dependency direction is one-way: products depend on this platform; this platform never references
a product repository or knows a product exists.

## Rejected alternatives

- **Shared-project-inside-one-product**: makes the "platform" a de facto dependency of whichever
  product happens to host it, defeating the purpose.
- **Git submodules**: painful DX, easy to get out of sync, no clean versioning story.
- **Copying provider code across products**: exactly the duplicated-effort problem this ADR exists
  to solve.
- **Prompts living in the platform**: breaks the prompt-ownership boundary above — a product's
  prompt is business logic, tuned and iterated against that product's own users and data; it does
  not belong in a repo that has zero knowledge the product exists.
- **A generic agent framework, built speculatively**: nothing in any current or near-term product
  needs multi-step agentic planning. Revisit only when a product has a concrete, validated need —
  same reasoning applies to `AiModelRequirements`-based routing, which exists as an unused
  extension point rather than a built feature.

## Consequences

- Products must build their own facade on top of this platform (see
  [product-integration.md](../product-integration.md)) rather than injecting the orchestrator
  directly into application code.
- Each product decides its own per-operation failure policy — this platform does not decide that
  for you.
- Testing against the fake provider, not hand-rolled mocks, keeps product tests honest about the
  actual `AiProvider` contract.
