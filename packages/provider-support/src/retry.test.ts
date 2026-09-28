import assert from "node:assert/strict";
import { test } from "node:test";
import { withRetry } from "./retry";

test("withRetry returns on first success without retrying", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      return "ok";
    },
    { maxRetries: 3, isRetryable: () => true, sleep: async () => {} }
  );
  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("withRetry retries retryable failures up to maxRetries then throws", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls += 1;
          throw new Error("transient");
        },
        { maxRetries: 2, isRetryable: () => true, sleep: async () => {} }
      ),
    /transient/
  );
  assert.equal(calls, 3);
});

test("withRetry does not retry a non-retryable error", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls += 1;
          throw new Error("fatal");
        },
        { maxRetries: 3, isRetryable: () => false, sleep: async () => {} }
      ),
    /fatal/
  );
  assert.equal(calls, 1);
});

test("withRetry succeeds after a transient failure", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error("transient");
      return "recovered";
    },
    { maxRetries: 3, isRetryable: () => true, sleep: async () => {} }
  );
  assert.equal(result, "recovered");
  assert.equal(calls, 2);
});
