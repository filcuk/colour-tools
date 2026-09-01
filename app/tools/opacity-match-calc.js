/**
 * Pure calculate-target / calculate-opacity logic for opacity match.
 */

import { blendOver, solveAlphaBestEffort, solveForeground, colorsMatch } from "../utils/blend.js";
import { hexToRgb, rgbToHex } from "../utils/color.js";

/**
 * @param {number} opacity 0–1
 * @returns {number} Alpha byte 0–255 (hex AA channel).
 */
export function alphaByteFromOpacity(opacity) {
  return Math.max(0, Math.min(255, Math.round(opacity * 255)));
}

/**
 * @param {number} alphaByte 0–255
 * @returns {number} Opacity 0–1 for blend math.
 */
export function opacityFromAlphaByte(alphaByte) {
  return alphaByte / 255;
}

/**
 * @param {number} opacity 0–1
 * @returns {number} Opacity quantised to an 8-bit alpha channel.
 */
export function quantizeOpacity(opacity) {
  return opacityFromAlphaByte(alphaByteFromOpacity(opacity));
}

/**
 * @param {{ r: number, g: number, b: number }} a
 * @param {{ r: number, g: number, b: number }} b
 * @returns {number} Match percentage from 0 to 100, one decimal place.
 */
export function colorMatchPercent(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);
  const maxDistance = Math.sqrt(3 * 255 * 255);
  const raw = Math.max(0, Math.min(100, 100 - (distance / maxDistance) * 100));
  return Math.round(raw * 10) / 10;
}

/**
 * Calculate the opaque target colour at a given opacity (calculate-target flow).
 *
 * @param {string} baseHex
 * @param {string} backgroundHex
 * @param {number} opacity 0–1
 * @returns {{
 *   targetHex: string,
 *   targetRgb: { r: number, g: number, b: number },
 *   reblended: { r: number, g: number, b: number } | null,
 *   isExactMatch: boolean,
 * } | null}
 */
export function solveTargetColour(baseHex, backgroundHex, opacity) {
  const baseRgb = hexToRgb(baseHex);
  const backgroundRgb = hexToRgb(backgroundHex);
  if (!baseRgb || !backgroundRgb || !Number.isFinite(opacity)) return null;

  const solved = solveForeground(baseRgb, backgroundRgb, opacity);
  if (!solved) return null;

  const reblended = blendOver(solved, backgroundRgb, opacity);
  return {
    targetHex: rgbToHex(solved),
    targetRgb: solved,
    reblended,
    isExactMatch: reblended !== null && colorsMatch(reblended, baseRgb, 0),
  };
}

/**
 * Calculate opacity for a target to match base on a background (calculate-opacity flow).
 *
 * @param {string} baseHex
 * @param {string} backgroundHex
 * @param {string} targetHex
 * @returns {{
 *   alphaByte: number,
 *   opacity: number,
 *   exact: boolean,
 *   reblended: { r: number, g: number, b: number } | null,
 *   shouldWarnClosest: boolean,
 *   matchPercent: number | null,
 * } | null}
 */
export function solveOpacityForMatch(baseHex, backgroundHex, targetHex) {
  const baseRgb = hexToRgb(baseHex);
  const backgroundRgb = hexToRgb(backgroundHex);
  const targetRgb = hexToRgb(targetHex);
  if (!baseRgb || !backgroundRgb || !targetRgb) return null;

  const { alpha, exact } = solveAlphaBestEffort(baseRgb, targetRgb, backgroundRgb);
  const alphaByte = alphaByteFromOpacity(alpha);
  const opacity = opacityFromAlphaByte(alphaByte);
  const reblended = blendOver(targetRgb, backgroundRgb, opacity);

  const shouldWarnClosest =
    !exact && (reblended === null || !colorsMatch(reblended, baseRgb, 0));

  return {
    alphaByte,
    opacity,
    exact,
    reblended,
    shouldWarnClosest,
    matchPercent: reblended ? colorMatchPercent(reblended, baseRgb) : null,
  };
}
