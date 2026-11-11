import { test } from "node:test";
import assert from "node:assert/strict";
import { strategies } from "./quota-floor.gateway.js";

const seat = (o) => ({ key: "k", account: "a", known: true, learns: 0, used: 0, soon: 0, pace: 0, weight: 1, resting: 0, tokens: 0, ...o });
const order = (seats, options) => strategies.keep("group", seats, options || {}).map((i) => seats[i].key);

test("a seat at the floor waits for the others", () => {
  const seats = [seat({ key: "codex", used: 100 }), seat({ key: "other", used: 12 })];
  assert.deepEqual(order(seats), ["other", "codex"]);
});

test("one percent is kept: 99 waits, 98 does not", () => {
  const at99 = [seat({ key: "codex", used: 99 }), seat({ key: "other", used: 50 })];
  assert.deepEqual(order(at99), ["other", "codex"]);
  const at98 = [seat({ key: "codex", used: 98 }), seat({ key: "other", used: 99 })];
  assert.deepEqual(order(at98), ["codex", "other"]);
});

test("floor is an option", () => {
  // an unknown-usage seat sits below a used one only while the used one is
  // still above the floor
  const seats = [seat({ key: "codex", used: 96 }), seat({ key: "key", known: false })];
  assert.deepEqual(order(seats, { floor: 5 }), ["key", "codex"]);
  assert.deepEqual(order(seats, { floor: 1 }), ["codex", "key"]);
});

test("above the soft cap it still goes, after the calm ones", () => {
  const seats = [seat({ key: "codex", used: 97 }), seat({ key: "other", used: 80 }), seat({ key: "calm", used: 3 })];
  assert.deepEqual(order(seats, { floor: 1, softCap: 95 }), ["calm", "other", "codex"]);
});

test("unknown usage is not counted as free", () => {
  const seats = [seat({ key: "key", known: false }), seat({ key: "codex", used: 40 })];
  assert.deepEqual(order(seats), ["codex", "key"]);
});

test("a resting seat goes last", () => {
  const seats = [seat({ key: "resting", used: 1, resting: 5 }), seat({ key: "codex", used: 90 })];
  assert.deepEqual(order(seats), ["codex", "resting"]);
});

test("it always answers a permutation", () => {
  const seats = [seat({ key: "a", used: 99 }), seat({ key: "b", known: false }), seat({ key: "c", used: 0 }), seat({ key: "d", resting: 2 })];
  const got = strategies.keep("group", seats, {}).slice().sort();
  assert.deepEqual(got, [0, 1, 2, 3]);
});

test("nothing to order is no order", () => {
  assert.deepEqual(strategies.keep("group", [], {}), []);
});
