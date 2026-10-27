import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_RULE_LENGTH, MAX_RULES, parseHouseRules, serializeHouseRules } from "@/lib/house-rules";

test("parse trims, drops blanks and duplicates (any case), collapses spaces", () => {
  assert.deepEqual(parseHouseRules("  No outside food \n\n no OUTSIDE food\nCards   only\n"), ["No outside food", "Cards only"]);
});

test("parse caps the number and length of rules", () => {
  const many = Array.from({ length: 10 }, (_, i) => `Rule ${i}`).join("\n");
  assert.equal(parseHouseRules(many).length, MAX_RULES);
  assert.equal(parseHouseRules("x".repeat(200))[0].length, MAX_RULE_LENGTH);
});

test("parse handles null (column missing or empty)", () => {
  assert.deepEqual(parseHouseRules(null), []);
  assert.deepEqual(parseHouseRules(undefined), []);
});

test("serialize stores one rule per line, or null when empty", () => {
  assert.equal(serializeHouseRules(["Cards only", " ", "Cards only"]), "Cards only");
  assert.equal(serializeHouseRules([]), null);
  // The stored text always fits the 600-character column check.
  assert.ok(serializeHouseRules(Array.from({ length: 9 }, (_, i) => `${i}`.padEnd(200, "x")))!.length <= 600);
});
