import test from "node:test";
import assert from "node:assert/strict";
import {
  alphaByteFromOpacity,
  colorMatchPercent,
  opacityFromAlphaByte,
  solveOpacityForMatch,
  solveTargetColour,
} from "../app/tools/opacity-match-calc.js";
import { hexToRgb, rgbToHex } from "../app/utils/color.js";

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

test("alphaByteFromOpacity and opacityFromAlphaByte round-trip hex AA", () => {
  assert.equal(alphaByteFromOpacity(0.5), 128);
  assert.equal(opacityFromAlphaByte(128), 128 / 255);
  const output = rgbToHex({ r: 255, g: 102, b: 0, a: 128 / 255 }, { alpha: true });
  assert.equal(output.slice(-2), "80");
});

test("solveOpacityForMatch quantises alpha to a byte matching #RRGGBBAA", () => {
  const result = solveOpacityForMatch(BASE, WHITE, ORANGE_TARGET);
  assert.ok(result);
  assert.equal(result.alphaByte, alphaByteFromOpacity(0.5228758169934641));
  assert.equal(result.opacity, result.alphaByte / 255);
  assert.ok(result.reblended);
  assert.ok(result.matchPercent >= 99);
  const output = rgbToHex({ r: 255, g: 102, b: 0, a: result.opacity }, { alpha: true });
  assert.equal(output.slice(-2), result.alphaByte.toString(16).padStart(2, "0").toUpperCase());
});

test("solveOpacityForMatch does not warn when solver reports an exact alpha", () => {
  const result = solveOpacityForMatch(BASE, WHITE, ORANGE_TARGET);
  assert.ok(result);
  assert.equal(result.exact, true);
  assert.equal(result.shouldWarnClosest, false);
});

test("solveTargetColour returns null at 0 alpha", () => {
  assert.equal(solveTargetColour(BASE, WHITE, 0), null);
});
