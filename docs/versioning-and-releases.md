# Versioning and Releases

## Current state

All packages share one version, `0.1.0-preview.1`. Nothing is published to any npm registry yet —
consumers install via npm's git-subdirectory syntax (below), mirroring the .NET platform's own
Phase 1 stance ("project references during coordinated development").

## Semantic versioning policy (once published)

- `0.x.y-preview.N` while the public API is still settling — breaking changes allowed between
  preview releases, called out in release notes.
- `1.0.0` once `@pravnix/ai-abstractions` and `@pravnix/ai-core` are considered stable enough that
  a second real product (beyond the first integration) has successfully integrated against them.
- After `1.0.0`: standard SemVer. Breaking changes to any public type/interface require a major
  version bump across all packages simultaneously — they are versioned and released together, not
  independently, to avoid a combinatorial compatibility matrix between e.g. `@pravnix/ai-core 1.3`
  and `@pravnix/ai-orchestration 1.1`.

## Interim consumption strategy

npm supports installing a subdirectory of a git repository directly, as long as that subdirectory
has its own `package.json` — which every package here does:

```bash
npm install "@pravnix/ai-node@git+https://github.com/raibhaskarr/AIPlatformNode.git#main:packages/node"
```

This is the fastest path for coordinated development across repos, with zero packaging overhead,
and needs no private registry. Its limitation: npm resolves and rebuilds straight from source on
every install (no prebuilt artifact caching from a registry), and it depends on this repo's `main`
branch being buildable at all times.

**Actually wiring PravnyaAdmin/Pravnya to consume this package is a separate, later integration
pass — not part of this repo's initial build-out.**

## Target end state

A private npm registry (GitHub Packages, or similar) scoped to the Pravnix organization, publishing
versioned, immutable tarballs consumable from any CI runner with registry credentials. Not yet
configured — no publish workflow exists in `.github/workflows/` today.

## CI

On push/PR to `main`: install, typecheck (`tsc -b`, which also emits — for a library, building and
type-checking are the same operation), test (`node --import tsx --test`, real-provider suites
auto-skip without API keys). No publish job exists yet.
