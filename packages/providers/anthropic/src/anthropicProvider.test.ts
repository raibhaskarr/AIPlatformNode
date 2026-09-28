import assert from "node:assert/strict";
import { test } from "node:test";
import { runProviderContractTests } from "@pravnix/ai-provider-support";
import { AnthropicAiProvider } from "./anthropicProvider";

const apiKey = process.env.ANTHROPIC_API_KEY;

test("AnthropicAiProvider throws at construction when apiKey is missing", () => {
  assert.throws(() => new AnthropicAiProvider({ apiKey: "" }), /apiKey/i);
});

runProviderContractTests("AnthropicAiProvider", () => new AnthropicAiProvider({ apiKey: apiKey ?? "test-key" }), {
  skipNetworkTests: !apiKey,
});
