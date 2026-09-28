import assert from "node:assert/strict";
import { test } from "node:test";
import { runProviderContractTests } from "@pravnix/ai-provider-support";
import { GeminiAiProvider } from "./geminiProvider";

const apiKey = process.env.GEMINI_API_KEY;

test("GeminiAiProvider throws at construction when apiKey is missing", () => {
  assert.throws(() => new GeminiAiProvider({ apiKey: "" }), /apiKey/i);
});

runProviderContractTests("GeminiAiProvider", () => new GeminiAiProvider({ apiKey: apiKey ?? "test-key" }), {
  skipNetworkTests: !apiKey,
});
