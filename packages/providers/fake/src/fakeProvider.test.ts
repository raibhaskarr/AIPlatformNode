import assert from "node:assert/strict";
import { test } from "node:test";
import { textMessage, type AiRequest } from "@pravnix/ai-core";
import { runProviderContractTests } from "@pravnix/ai-provider-support";
import { FakeAiProvider } from "./fakeProvider";

runProviderContractTests("FakeAiProvider", () => new FakeAiProvider());

test("FakeAiProvider uses a custom responseSelector when provided", async () => {
  const provider = new FakeAiProvider({ responseSelector: () => "custom text" });
  const request: AiRequest = { messages: [textMessage("user", "hi")] };
  const response = await provider.generate(request);
  assert.equal(response.text, "custom text");
});

test("FakeAiProvider.generate rejects immediately on an already-aborted signal", async () => {
  const provider = new FakeAiProvider();
  const controller = new AbortController();
  controller.abort();
  const request: AiRequest = { messages: [textMessage("user", "hi")] };
  await assert.rejects(() => provider.generate(request, controller.signal), /AbortError|aborted/i);
});

test("FakeAiProvider.generateStream concatenates deltas back into the full response text", async () => {
  const provider = new FakeAiProvider({ responseSelector: () => "hello world" });
  const request: AiRequest = { messages: [textMessage("user", "hi")] };
  let full = "";
  for await (const chunk of provider.generateStream(request)) {
    full += chunk.delta;
  }
  assert.equal(full, "hello world");
});
