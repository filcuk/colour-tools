import test from "node:test";
import assert from "node:assert/strict";
import {
  colorMatchPercent,
  solveOpacityForMatch,
  solveTargetColour,
} from "../app/tools/opacity-match-calc.js";
import { hexToRgb } from "../app/utils/color.js";

const WHITE = "#FFFFFF";
const BASE = "#FCAF7C";
const ORANGE_TARGET = "#FF6600";

test("solveTargetColour for #FCAF7C on white at 50% returns inverted foreground", () => {
  const result = solveTargetColour(BASE, WHITE, 0.5);
  assert.ok(result);
  assert.equal(result.targetHex, "#F95F00");
  assert.deepEqual(result.targetRgb, { r: 249, g: 95, b: 0 });
});

test("solveTargetColour re-blends red and green exactly; blue rounds within one step", () => {
  const result = solveTargetColour(BASE, WHITE, 0.5);
  assert.ok(result?.reblended);
  assert.equal(result.reblended.r, 252);
  assert.equal(result.reblended.g, 175);
  assert.equal(result.reblended.b, 128);
  assert.equal(result.isExactMatch, false);
  assert.ok(colorMatchPercent(result.reblended, hexToRgb(BASE)) >= 98);
});

test("solveOpacityForMatch for #FF6600 on white rounds to 52% opacity", () => {
  const result = solveOpacityForMatch(BASE, WHITE, ORANGE_TARGET);
  assert.ok(result);
  assert.equal(result.opacityPercent, 52);
  assert.ok(result.reblended);
  assert.ok(result.matchPercent >= 99);
});

test("solveOpacityForMatch does not warn when solver reports an exact alpha", () => {
  const result = solveOpacityForMatch(BASE, WHITE, ORANGE_TARGET);
  assert.ok(result);
  assert.equal(result.exact, true);
  assert.equal(result.shouldWarnClosest, false);
});

test("solveTargetColour returns null at 0% opacity", () => {
  assert.equal(solveTargetColour(BASE, WHITE, 0), null);
});
