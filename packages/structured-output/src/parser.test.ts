import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { parseStructured, parseWithRepair } from "./parser";

const Person = z.object({
  name: z.string(),
  age: z.number(),
});

test("valid JSON parses successfully", () => {
  const result = parseStructured('{"name":"Ada","age":30}', Person);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.value, { name: "Ada", age: 30 });
});

test("fenced JSON (```json ... ```) parses successfully", () => {
  const raw = '```json\n{"name":"Ada","age":30}\n```';
  const result = parseStructured(raw, Person);
  assert.equal(result.success, true);
});

test("prose-wrapped JSON is extracted from surrounding text", () => {
  const raw = 'Sure, here is the result:\n{"name":"Ada","age":30}\nLet me know if you need anything else.';
  const result = parseStructured(raw, Person);
  assert.equal(result.success, true);
});

test("empty output fails with EmptyOutput", () => {
  const result = parseStructured("", Person);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "EmptyOutput");
});

test("whitespace-only output fails with EmptyOutput", () => {
  const result = parseStructured("   \n\t  ", Person);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "EmptyOutput");
});

test("malformed JSON fails with MalformedJson", () => {
  const result = parseStructured("{name: Ada, age:}", Person);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "MalformedJson");
});

test("wrong property type fails with SchemaMismatch", () => {
  const result = parseStructured('{"name":"Ada","age":"thirty"}', Person);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "SchemaMismatch");
});

test("missing required property fails with SchemaMismatch", () => {
  const result = parseStructured('{"name":"Ada"}', Person);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "SchemaMismatch");
});

test("unexpected property fails with SchemaMismatch under strict schema", () => {
  const Strict = Person.strict();
  const result = parseStructured('{"name":"Ada","age":30,"extra":true}', Strict);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "SchemaMismatch");
});

test("nested object schema parses successfully", () => {
  const Nested = z.object({ person: Person, tags: z.array(z.string()) });
  const result = parseStructured('{"person":{"name":"Ada","age":30},"tags":["a","b"]}', Nested);
  assert.equal(result.success, true);
});

test("array-of-objects schema parses successfully", () => {
  const ListSchema = z.array(Person);
  const result = parseStructured('[{"name":"Ada","age":30},{"name":"Grace","age":40}]', ListSchema);
  assert.equal(result.success, true);
});

test("null value for a required field fails with SchemaMismatch", () => {
  const result = parseStructured('{"name":null,"age":30}', Person);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.reason, "SchemaMismatch");
});

test("parseStructured never returns a default value on failure", () => {
  const result = parseStructured("not json at all", Person);
  assert.equal(result.success, false);
  assert.equal((result as { value?: unknown }).value, undefined);
});

test("parseWithRepair succeeds without invoking repair when input already parses", async () => {
  let repairCalls = 0;
  const outcome = await parseWithRepair({
    rawText: '{"name":"Ada","age":30}',
    schema: Person,
    repair: async () => {
      repairCalls += 1;
      return "";
    },
    maxRepairAttempts: 1,
  });
  assert.equal(outcome.result.success, true);
  assert.equal(outcome.repairCount, 0);
  assert.equal(repairCalls, 0);
});

test("parseWithRepair retries via the repair callback and succeeds", async () => {
  const outcome = await parseWithRepair({
    rawText: "not json",
    schema: Person,
    repair: async () => '{"name":"Ada","age":30}',
    maxRepairAttempts: 1,
  });
  assert.equal(outcome.result.success, true);
  assert.equal(outcome.repairCount, 1);
});

test("parseWithRepair is bounded and fails with RepairExhausted", async () => {
  const outcome = await parseWithRepair({
    rawText: "not json",
    schema: Person,
    repair: async () => "still not json",
    maxRepairAttempts: 2,
  });
  assert.equal(outcome.result.success, false);
  assert.equal(outcome.repairCount, 2);
  if (!outcome.result.success) assert.equal(outcome.result.reason, "RepairExhausted");
});

test("maxRepairAttempts = 0 disables repair entirely", async () => {
  let repairCalls = 0;
  const outcome = await parseWithRepair({
    rawText: "not json",
    schema: Person,
    repair: async () => {
      repairCalls += 1;
      return '{"name":"Ada","age":30}';
    },
    maxRepairAttempts: 0,
  });
  assert.equal(outcome.repairCount, 0);
  assert.equal(repairCalls, 0);
  assert.equal(outcome.result.success, false);
});
