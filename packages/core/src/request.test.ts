import assert from "node:assert/strict";
import { test } from "node:test";
import { createExecutionContext } from "./request";

test("createExecutionContext auto-generates a correlationId when omitted", () => {
  const ctx = createExecutionContext();
  assert.equal(typeof ctx.correlationId, "string");
  assert.ok(ctx.correlationId.length > 0);
});

test("createExecutionContext preserves an explicit correlationId", () => {
  const ctx = createExecutionContext({ correlationId: "fixed-id", productId: "pravnya" });
  assert.equal(ctx.correlationId, "fixed-id");
  assert.equal(ctx.productId, "pravnya");
});

test("createExecutionContext generates distinct ids across calls", () => {
  const a = createExecutionContext();
  const b = createExecutionContext();
  assert.notEqual(a.correlationId, b.correlationId);
});
