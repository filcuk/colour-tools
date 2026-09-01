/**
 * sRGB channel blend over a solid background (same model as CSS rgba() over a fill).
 *
 * result = foreground × α + background × (1 − α)   per R/G/B, α ∈ 0…1
 */

/** @typedef {{ r: number, g: number, b: number }} Rgb */

const CHANNELS = /** @type {const} */ (["r", "g", "b"]);
const ALPHA_TOLERANCE = 0.01;

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * @param {number} foreground 0–255
 * @param {number} background 0–255
 * @param {number} alpha 0–1
 * @returns {number}
 */
export function blendChannel(foreground, background, alpha) {
  return clampByte(foreground * alpha + background * (1 - alpha));
}

/**
 * @param {Rgb} foreground
 * @param {Rgb} background
 * @param {number} alpha 0–1
 * @returns {Rgb | null}
 */
export function blendOver(foreground, background, alpha) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) return null;
  return {
    r: blendChannel(foreground.r, background.r, alpha),
    g: blendChannel(foreground.g, background.g, alpha),
    b: blendChannel(foreground.b, background.b, alpha),
  };
}

/**
 * @param {number} result 0–255
 * @param {number} background 0–255
 * @param {number} alpha 0–1
 * @returns {number | null}
 */
export function solveForegroundChannel(result, background, alpha) {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) return null;
  return (result - background * (1 - alpha)) / alpha;
}

/**
 * @param {Rgb} result
 * @param {Rgb} background
 * @param {number} alpha 0–1
 * @returns {Rgb | null}
 */
export function solveForeground(result, background, alpha) {
  const channels = CHANNELS.map((key) =>
    solveForegroundChannel(result[key], background[key], alpha)
  );
  if (channels.some((value) => value === null || !Number.isFinite(value))) return null;
  return {
    r: clampByte(/** @type {number} */ (channels[0])),
    g: clampByte(/** @type {number} */ (channels[1])),
    b: clampByte(/** @type {number} */ (channels[2])),
  };
}

/**
 * @param {number} result 0–255
 * @param {number} foreground 0–255
 * @param {number} background 0–255
 * @returns {number | null} Unconstrained when foreground equals background.
 */
export function solveAlphaChannel(result, foreground, background) {
  const delta = foreground - background;
  if (Math.abs(delta) < 1e-9) return null;
  return (result - background) / delta;
}

/**
 * @param {Rgb} result
 * @param {Rgb} foreground
 * @param {Rgb} background
 * @returns {number | null} α in 0…1, or null when inconsistent / impossible.
 */
export function solveAlpha(result, foreground, background) {
  /** @type {number[]} */
  const alphas = [];

  for (const key of CHANNELS) {
    const alpha = solveAlphaChannel(result[key], foreground[key], background[key]);
    if (alpha === null) continue;
    if (alpha < 0 || alpha > 1) return null;
    alphas.push(alpha);
  }

  if (alphas.length === 0) {
    const matchesBackground = CHANNELS.every((key) => result[key] === background[key]);
    return matchesBackground ? null : null;
  }

  const [first, ...rest] = alphas;
  if (!rest.every((alpha) => Math.abs(alpha - first) <= ALPHA_TOLERANCE)) return null;
  return first;
}

/**
 * @param {Rgb} a
 * @param {Rgb} b
 * @param {number} [tolerance=1]
 * @returns {boolean}
 */
export function colorsMatch(a, b, tolerance = 1) {
  return CHANNELS.every((key) => Math.abs(a[key] - b[key]) <= tolerance);
}
