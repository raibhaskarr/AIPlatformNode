import assert from "node:assert/strict";
import { test } from "node:test";
import { textMessage } from "@pravnix/ai-core";
import { createAiPlatform, createFakeProvider } from "./index";

test("createAiPlatform wires a working orchestrator against the fake provider", async () => {
  const { orchestrator } = createAiPlatform({
    providers: [createFakeProvider({ responseSelector: () => "wired correctly" })],
    defaultProvider: "fake",
  });
  const result = await orchestrator.execute({ name: "smoke", request: { messages: [textMessage("user", "hi")] } });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.response.text, "wired correctly");
});

test("createAiPlatform never falls back silently to an unregistered provider", async () => {
  const { orchestrator } = createAiPlatform({ providers: [createFakeProvider()], defaultProvider: "fake" });
  const result = await orchestrator.execute({
    name: "smoke",
    request: { messages: [textMessage("user", "hi")] },
    provider: "does-not-exist",
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, "UnsupportedProvider");
});
