import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { AiProviderError, textMessage, type AiRequest, type AiResponse, type AiStreamChunk } from "@pravnix/ai-core";
import type { AiProvider, AiTelemetryEvent, AiTelemetrySink } from "@pravnix/ai-abstractions";
import { FakeAiProvider } from "@pravnix/ai-provider-fake";
import { AiOrchestratorImpl } from "./orchestrator";
import { DictionaryAiProviderResolver } from "./resolver";

class RecordingSink implements AiTelemetrySink {
  events: AiTelemetryEvent[] = [];
  record(event: AiTelemetryEvent): void {
    this.events.push(event);
  }
}

class ThrowingProvider implements AiProvider {
  readonly name = "throwing";
  readonly supportsStructuredOutput = true;
  readonly supportsStreaming = false;
  constructor(private readonly toThrow: unknown) {}
  async generate(): Promise<AiResponse> {
    throw this.toThrow;
  }
}

class StaticProvider implements AiProvider {
  readonly name = "static";
  readonly supportsStructuredOutput = true;
  readonly supportsStreaming = true;
  constructor(private readonly texts: string[]) {}
  private callIndex = 0;
  async generate(): Promise<AiResponse> {
    const text = this.texts[Math.min(this.callIndex, this.texts.length - 1)];
    this.callIndex += 1;
    return { text, model: { provider: this.name, model: "static-model" }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: "stop" };
  }
  async *generateStream(): AsyncIterable<AiStreamChunk> {
    for (const word of this.texts[0].split(" ")) {
      yield { delta: `${word} `, done: false };
    }
    yield { delta: "", done: true, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
  }
}

function makeOrchestrator(providers: AiProvider[], sink: AiTelemetrySink = new RecordingSink()) {
  const resolver = new DictionaryAiProviderResolver(providers);
  return { orchestrator: new AiOrchestratorImpl({ resolver, telemetrySink: sink, defaultProvider: "fake" }), sink };
}

const req = (): AiRequest => ({ messages: [textMessage("user", "hello")] });

test("execute succeeds against a healthy provider and records one telemetry event", async () => {
  const sink = new RecordingSink();
  const { orchestrator } = makeOrchestrator([new FakeAiProvider()], sink);
  const result = await orchestrator.execute({ name: "op", request: req() });
  assert.equal(result.success, true);
  if (result.success) assert.ok(result.response.text.length > 0);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0].success, true);
});

test("execute fails with InvalidConfiguration when messages is empty", async () => {
  const { orchestrator } = makeOrchestrator([new FakeAiProvider()]);
  const result = await orchestrator.execute({ name: "op", request: { messages: [] } });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, "InvalidConfiguration");
});

test("execute fails with UnsupportedProvider and never silently falls back", async () => {
  const { orchestrator } = makeOrchestrator([new FakeAiProvider({ name: "fake" })]);
  const result = await orchestrator.execute({ name: "op", request: req(), provider: "nonexistent" });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, "UnsupportedProvider");
});

test("execute normalizes an unrecognized thrown error to Unknown", async () => {
  const { orchestrator } = makeOrchestrator([new ThrowingProvider(new Error("boom"))]);
  const result = await orchestrator.execute({ name: "op", request: req(), provider: "throwing" });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, "Unknown");
});

test("execute passes through an AiProviderError's code unchanged", async () => {
  const providerError = new AiProviderError({ code: "RateLimited", safeMessage: "slow down", retryable: true });
  const { orchestrator } = makeOrchestrator([new ThrowingProvider(providerError)]);
  const result = await orchestrator.execute({ name: "op", request: req(), provider: "throwing" });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, "RateLimited");
    assert.equal(result.error.retryable, true);
  }
});

test("execute propagates an aborted signal as a real exception, never as a failed Result", async () => {
  const { orchestrator } = makeOrchestrator([new FakeAiProvider()]);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => orchestrator.execute({ name: "op", request: req() }, controller.signal), /AbortError|aborted/i);
});

const PersonSchema = z.object({ name: z.string(), age: z.number() });

test("executeStructured succeeds when the first response already parses", async () => {
  const { orchestrator } = makeOrchestrator([new StaticProvider(['{"name":"Ada","age":30}'])]);
  const result = await orchestrator.executeStructured({
    name: "op",
    request: req(),
    provider: "static",
    schema: PersonSchema,
  });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.value, { name: "Ada", age: 30 });
});

test("executeStructured repairs once and succeeds, reporting repairCount 1", async () => {
  const { orchestrator } = makeOrchestrator([new StaticProvider(["not json", '{"name":"Ada","age":30}'])]);
  const result = await orchestrator.executeStructured({
    name: "op",
    request: req(),
    provider: "static",
    schema: PersonSchema,
    maxRepairAttempts: 1,
  });
  assert.equal(result.success, true);
  assert.equal(result.metadata.repairCount, 1);
});

test("executeStructured is bounded by maxRepairAttempts and fails with RepairFailure", async () => {
  const { orchestrator } = makeOrchestrator([new StaticProvider(["not json", "still not json", "still not json"])]);
  const result = await orchestrator.executeStructured({
    name: "op",
    request: req(),
    provider: "static",
    schema: PersonSchema,
    maxRepairAttempts: 2,
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.code, "RepairFailure");
  assert.equal(result.metadata.repairCount, 2);
});

test("executeStructured with maxRepairAttempts 0 fails immediately without retrying", async () => {
  const { orchestrator } = makeOrchestrator([new StaticProvider(["not json"])]);
  const result = await orchestrator.executeStructured({
    name: "op",
    request: req(),
    provider: "static",
    schema: PersonSchema,
    maxRepairAttempts: 0,
  });
  assert.equal(result.success, false);
  assert.equal(result.metadata.repairCount, 0);
});

test("executeStream yields chunks and records exactly one telemetry event", async () => {
  const sink = new RecordingSink();
  const { orchestrator } = makeOrchestrator([new StaticProvider(["hello world"])], sink);
  const chunks: AiStreamChunk[] = [];
  for await (const chunk of orchestrator.executeStream({ name: "op", request: req(), provider: "static" })) {
    chunks.push(chunk);
  }
  assert.ok(chunks.some((c) => c.done));
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0].success, true);
});

test("executeStream throws for a provider that does not support streaming", async () => {
  const provider = new FakeAiProvider();
  Object.defineProperty(provider, "supportsStreaming", { value: false });
  const { orchestrator } = makeOrchestrator([provider]);
  const iterate = async () => {
    for await (const _ of orchestrator.executeStream({ name: "op", request: req() })) {
      // no-op
    }
  };
  await assert.rejects(iterate, /streaming/i);
});
