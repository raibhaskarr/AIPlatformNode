import assert from "node:assert/strict";
import { test } from "node:test";
import type { AiRequest } from "@pravnix/ai-core";
import { textMessage } from "@pravnix/ai-core";
import type { AiProvider } from "@pravnix/ai-abstractions";

/**
 * A single behavioral contract every AiProvider must satisfy, applied identically to Fake and
 * every real provider. Network-dependent assertions (generate/generateStream against a live API)
 * are skipped, not failed, when `skipNetworkTests` is true — real providers gate this on whether
 * an API key is present in the environment; Fake always runs the full suite.
 */
export function runProviderContractTests(
  suiteName: string,
  makeProvider: () => AiProvider,
  options: { skipNetworkTests?: boolean } = {}
): void {
  const { skipNetworkTests = false } = options;

  test(`${suiteName}: exposes a non-empty name and capability flags`, () => {
    const provider = makeProvider();
    assert.ok(provider.name.length > 0);
    assert.equal(typeof provider.supportsStructuredOutput, "boolean");
    assert.equal(typeof provider.supportsStreaming, "boolean");
  });

  test(`${suiteName}: generate returns a well-formed AiResponse`, { skip: skipNetworkTests }, async () => {
    const provider = makeProvider();
    const request: AiRequest = { messages: [textMessage("user", "Say hello in one word.")] };
    const response = await provider.generate(request);

    assert.equal(typeof response.text, "string");
    assert.ok(response.text.length > 0);
    assert.equal(response.model.provider, provider.name);
    assert.equal(typeof response.usage.inputTokens, "number");
    assert.equal(typeof response.usage.outputTokens, "number");
    assert.equal(typeof response.usage.totalTokens, "number");
  });

  test(`${suiteName}: generate rejects when the signal is already aborted`, { skip: skipNetworkTests }, async () => {
    const provider = makeProvider();
    const controller = new AbortController();
    controller.abort();
    const request: AiRequest = { messages: [textMessage("user", "hello")] };

    await assert.rejects(() => provider.generate(request, controller.signal));
  });

  test(`${suiteName}: generateStream yields a terminal done chunk when supported`, { skip: skipNetworkTests }, async () => {
    const provider = makeProvider();
    if (!provider.supportsStreaming || !provider.generateStream) {
      return;
    }
    const request: AiRequest = { messages: [textMessage("user", "Count to three.")] };
    let sawDone = false;
    let text = "";
    for await (const chunk of provider.generateStream(request)) {
      text += chunk.delta;
      if (chunk.done) sawDone = true;
    }
    assert.ok(sawDone, "stream must terminate with a done:true chunk");
    assert.ok(text.length > 0);
  });
}
