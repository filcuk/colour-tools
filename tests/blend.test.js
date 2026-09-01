import test from "node:test";
import assert from "node:assert/strict";
import { colorMatchPercent } from "../app/tools/opacity-match-calc.js";
import {
  blendChannel,
  blendOver,
  colorsMatch,
  solveAlpha,
  solveAlphaBestEffort,
  solveForeground,
} from "../app/utils/blend.js";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

test("blendChannel blends foreground over background", () => {
  assert.equal(blendChannel(255, 255, 0.5), 255);
  assert.equal(blendChannel(0, 255, 0.5), 128);
  assert.equal(blendChannel(255, 0, 0.5), 128);
});

test("blendOver composites all channels", () => {
  const blended = blendOver({ r: 255, g: 0, b: 0 }, WHITE, 0.5);
  assert.deepEqual(blended, { r: 255, g: 128, b: 128 });
});

test("solveForeground re-blends to the rounded result", () => {
  const foreground = { r: 255, g: 102, b: 0 };
  const alpha = 0.5;
  const result = blendOver(foreground, WHITE, alpha);
  assert.ok(result);
  const solved = solveForeground(result, WHITE, alpha);
  assert.ok(solved);
  assert.ok(colorsMatch(blendOver(solved, WHITE, alpha), result, 0));
});

test("solveAlpha inverts blendOver for an exact blend", () => {
  const foreground = { r: 200, g: 100, b: 50 };
  const alpha = 0.4;
  const result = blendOver(foreground, WHITE, alpha);
  assert.ok(result);
  const solvedAlpha = solveAlpha(result, foreground, WHITE);
  assert.ok(solvedAlpha !== null);
  assert.ok(Math.abs(solvedAlpha - alpha) < 0.001);
});

test("solveForeground for #FCAF7C on white at 50% opacity", () => {
  const result = { r: 252, g: 175, b: 124 };
  const solved = solveForeground(result, WHITE, 0.5);
  assert.deepEqual(solved, { r: 249, g: 95, b: 0 });
});

test("solveAlpha for #FCAF7C with #FF6600 on white is approximate", () => {
  const result = { r: 252, g: 175, b: 124 };
  const foreground = { r: 255, g: 102, b: 0 };
  const alpha = solveAlpha(result, foreground, WHITE);
  assert.ok(alpha !== null);
  // Not exactly 50% — channels only agree within ~1% (8-bit rounding).
  assert.ok(Math.abs(alpha - 0.518) < 0.01);
});

test("solveAlpha returns null when channels disagree", () => {
  const result = { r: 128, g: 64, b: 192 };
  const foreground = { r: 255, g: 0, b: 255 };
  const solved = solveAlpha(result, foreground, { r: 0, g: 128, b: 0 });
  assert.equal(solved, null);
});

test("solveAlphaBestEffort returns closest alpha when channels disagree", () => {
  const result = { r: 128, g: 64, b: 192 };
  const foreground = { r: 255, g: 0, b: 255 };
  const background = { r: 0, g: 128, b: 0 };
  const { alpha, exact } = solveAlphaBestEffort(result, foreground, background);
  assert.equal(exact, false);
  assert.ok(alpha >= 0 && alpha <= 1);

  const blended = blendOver(foreground, background, alpha);
  assert.ok(blended);
  assert.ok(colorMatchPercent(blended, result) >= 70);
});

test("solveAlphaBestEffort keeps exact solves exact", () => {
  const foreground = { r: 200, g: 100, b: 50 };
  const alpha = 0.4;
  const result = blendOver(foreground, WHITE, alpha);
  assert.ok(result);
  const solved = solveAlphaBestEffort(result, foreground, WHITE);
  assert.equal(solved.exact, true);
  assert.ok(Math.abs(solved.alpha - alpha) < 0.001);
});

test("blendOver rejects alpha outside 0…1", () => {
  assert.equal(blendOver(WHITE, BLACK, -0.1), null);
  assert.equal(blendOver(WHITE, BLACK, 1.1), null);
});

test("solveForeground rejects alpha of zero", () => {
  assert.equal(solveForeground(WHITE, BLACK, 0), null);
});
