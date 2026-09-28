# Versioning and Releases

## Current state

All packages share one version, `0.1.0-preview.1`. Nothing is published to any npm registry yet —
consumers install via a sibling-checkout `file:` dependency (below), mirroring the .NET platform's
own Phase 1 stance ("project references during coordinated development").

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

**npm's `<git-url>#<commit>:<subdirectory>` syntax does not do what it looks like it does** — this
was the original plan documented here, and it turned out to be wrong. Verified directly: installing
`@pravnix/ai-node@git+https://github.com/raibhaskarr/AIPlatformNode.git#main:packages/node` clones
the *whole* repo and installs its private, unbuilt monorepo root (`name: "aiplatformnode"`) as the
package — the `:packages/node` suffix is silently ignored by npm. (Some tools, like pip, support a
"subdirectory" selector on a VCS URL; plain npm does not.) Don't use this form.

**What actually works: a sibling git checkout consumed via a `file:` dependency.**

1. Clone this repo as a sibling of the consuming product's repo (same parent directory) and build
   it once:
   ```bash
   git clone https://github.com/raibhaskarr/AIPlatformNode.git ../AIPlatformNode
   (cd ../AIPlatformNode && npm install && npm run build)
   ```
2. In the product's `package.json`, depend on the one package you actually need via a relative
   `file:` path into that sibling checkout:
   ```json
   { "dependencies": { "@pravnix/ai-node": "file:../AIPlatformNode/packages/node" } }
   ```
3. `npm install` in the product repo. This is enough — you do **not** need to separately list every
   other `@pravnix/*` package `@pravnix/ai-node` itself depends on. npm creates a symlink for
   `@pravnix/ai-node`; Node's module resolution follows that symlink to its real location inside the
   AIPlatformNode checkout and finds all of *that* checkout's own already-built, already-linked
   workspace siblings there (from step 1's `npm install`) — the same way it would if you were
   running code from inside this repo directly. Verified end-to-end: `require("@pravnix/ai-node")`
   from an unrelated sibling project resolves `createAiPlatform`, every provider factory, and a real
   orchestrator call against the fake provider, with only one entry in the consuming project's own
   `package.json`.

This needs both repos checked out as siblings (same limitation the .NET platform's own Phase 1 project-references
approach has) — in CI, add a step that clones and builds this repo into a sibling path *before* the
product's own install/build step. See PravnyaAdmin's `.github/workflows/deploy.yml` for a working
example once that integration lands.

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
