import assert from "node:assert/strict";
import { test } from "node:test";
import { runProviderContractTests } from "@pravnix/ai-provider-support";
import { OpenAiProvider } from "./openaiProvider";

const apiKey = process.env.OPENAI_API_KEY;

test("OpenAiProvider throws at construction when apiKey is missing", () => {
  assert.throws(() => new OpenAiProvider({ apiKey: "" }), /apiKey/i);
});

runProviderContractTests("OpenAiProvider", () => new OpenAiProvider({ apiKey: apiKey ?? "test-key" }), {
  skipNetworkTests: !apiKey,
});
