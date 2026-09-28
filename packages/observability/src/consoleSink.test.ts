import assert from "node:assert/strict";
import { test } from "node:test";
import type { AiTelemetryEvent } from "@pravnix/ai-abstractions";
import { ConsoleAiTelemetrySink, NoopAiTelemetrySink } from "./consoleSink";

const sampleEvent: AiTelemetryEvent = {
  operationName: "test-op",
  provider: "fake",
  success: true,
  latencyMs: 12,
  retryCount: 0,
  repairCount: 0,
  correlationId: "abc-123",
};

test("ConsoleAiTelemetrySink logs one line per event by default", () => {
  const lines: string[] = [];
  const sink = new ConsoleAiTelemetrySink({ log: (line) => lines.push(line) });
  sink.record(sampleEvent);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.operationName, "test-op");
  assert.equal(parsed.correlationId, "abc-123");
});

test("ConsoleAiTelemetrySink with policy 'None' logs nothing", () => {
  const lines: string[] = [];
  const sink = new ConsoleAiTelemetrySink({ policy: "None", log: (line) => lines.push(line) });
  sink.record(sampleEvent);
  assert.equal(lines.length, 0);
});

test("NoopAiTelemetrySink never throws", () => {
  const sink = new NoopAiTelemetrySink();
  assert.doesNotThrow(() => sink.record(sampleEvent));
});
