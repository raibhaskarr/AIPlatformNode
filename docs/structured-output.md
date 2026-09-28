# Structured Output

`@pravnix/ai-structured-output` is the single place in the platform that turns raw model text into
a typed value. No provider and no product should hand-roll JSON-fence-stripping or `JSON.parse`
calls of their own — route everything through this package (directly, or via the orchestrator's
`executeStructured`, which uses it internally).

## Pipeline

`parseStructured(rawText, schema)`:

1. `rawText` null/empty/whitespace → `EmptyOutput`.
2. `extractJsonText` strips markdown code fences (` ```json ... ``` ` / ` ``` ... ``` `) and, if
   the model wrapped JSON in prose despite being asked not to, scans for the outermost `{...}` or
   `[...]`.
3. `JSON.parse` — a syntax error becomes `MalformedJson`.
4. `schema.safeParse` (a `zod` schema) — a failure (missing required field, wrong type, or an
   unexpected property under a `.strict()` schema) becomes `SchemaMismatch`.
5. Success → `{ success: true, value }`. **Never** a default/empty value on failure — always an
   explicit `{ success: false, reason, safeMessage }`.

## Declaring your schema

Use `zod` — a missing required field, wrong type, or (under `.strict()`) an unexpected extra field
all become an explicit `SchemaMismatch` instead of silently defaulting:

```ts
import { z } from "zod";

const RawResumeAnalysis = z.object({
  summary: z.string(),
  technicalClaims: z.array(z.object({ claim: z.string() })).default([]),
});
```

If you need to tolerate extra properties from a specific model, don't call `.strict()` on your
schema — but prefer strict by default; a model returning fields you didn't ask for is often a sign
something else is wrong.

## Repair

The orchestrator's `executeStructured` re-invokes the *same* provider with the failed response and
a correction instruction appended, up to `StructuredAiOperation.maxRepairAttempts` (default 1).
`maxRepairAttempts = 0` disables repair entirely for that operation.

Repair is a semantic correction loop (re-asking the model with feedback), not a network retry — see
[architecture.md](architecture.md) for why those are kept separate.

## Testing your own schemas

Exercise `parseStructured` directly in your product's tests — you do not need a live model or even
the fake provider to verify your schema behaves the way you expect for valid, fenced,
prose-wrapped, empty, malformed, wrong-type, missing-required, unexpected-property, nested, array,
and null-value inputs. See `packages/structured-output/src/parser.test.ts` for the full matrix this
package itself is held to.
