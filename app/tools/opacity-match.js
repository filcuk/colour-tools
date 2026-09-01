/**
 * Opacity match — given three of base, background, opacity, and target colour,
 * calculate the fourth using sRGB channel blending.
 */

import { initSlider } from "../components/slider.js";
import { blendOver, colorsMatch, solveAlpha, solveForeground } from "../utils/blend.js";
import { hexToRgb, parseHexColor, rgbToHex } from "../utils/color.js";

/** @typedef {"base" | "background" | "opacity" | "target"} FieldKey */

const FIELD_KEYS = /** @type {FieldKey[]} */ (["base", "background", "opacity", "target"]);
const MATCH_TOLERANCE = 2;
const DEBOUNCE_MS = 150;

/**
 * @param {{ r: number, g: number, b: number }} result
 * @param {{ r: number, g: number, b: number }} foreground
 * @param {number} alpha
 * @returns {{ r: number, g: number, b: number } | null}
 */
function solveBackground(result, foreground, alpha) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha >= 1) return null;
  const inv = 1 - alpha;
  return {
    r: Math.max(0, Math.min(255, Math.round((result.r - foreground.r * alpha) / inv))),
    g: Math.max(0, Math.min(255, Math.round((result.g - foreground.g * alpha) / inv))),
    b: Math.max(0, Math.min(255, Math.round((result.b - foreground.b * alpha) / inv))),
  };
}

/**
 * @param {HTMLElement | null | undefined} swatchEl
 * @param {string | null} hex
 */
function paintSwatch(swatchEl, hex) {
  if (!swatchEl) return;
  const parsed = hex ? parseHexColor(hex) : null;
  swatchEl.classList.toggle("is-empty", !parsed);
  if (parsed) {
    swatchEl.style.setProperty("--color-input-preview", parsed);
  } else {
    swatchEl.style.removeProperty("--color-input-preview");
  }
}

/**
 * @param {HTMLInputElement} opacityInput
 * @returns {number | null}
 */
function readOpacityPercent(opacityInput) {
  const text = opacityInput.value.trim();
  if (!text) return null;
  const parsed = Number(text.replace(/%$/, "").trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/**
 * @param {FieldKey | null} emptyField
 * @param {{
 *   base: string | null,
 *   background: string | null,
 *   target: string | null,
 *   opacity: number | null,
 * }} values
 * @returns {{ field: FieldKey, value: string | number } | null}
 */
function computeMissing(emptyField, values) {
  const baseRgb = values.base ? hexToRgb(values.base) : null;
  const backgroundRgb = values.background ? hexToRgb(values.background) : null;
  const targetRgb = values.target ? hexToRgb(values.target) : null;
  const alpha = values.opacity;

  if (!emptyField) return null;

  switch (emptyField) {
    case "target": {
      if (!baseRgb || !backgroundRgb || alpha === null) return null;
      const solved = solveForeground(baseRgb, backgroundRgb, alpha);
      if (!solved) return null;
      return { field: "target", value: rgbToHex(solved) };
    }
    case "opacity": {
      if (!baseRgb || !backgroundRgb || !targetRgb) return null;
      const solvedAlpha = solveAlpha(baseRgb, targetRgb, backgroundRgb);
      if (solvedAlpha === null) return null;
      return { field: "opacity", value: Math.round(solvedAlpha * 100) };
    }
    case "base": {
      if (!targetRgb || !backgroundRgb || alpha === null) return null;
      const blended = blendOver(targetRgb, backgroundRgb, alpha);
      if (!blended) return null;
      return { field: "base", value: rgbToHex(blended) };
    }
    case "background": {
      if (!baseRgb || !targetRgb || alpha === null) return null;
      const solved = solveBackground(baseRgb, targetRgb, alpha);
      if (!solved) return null;
      return { field: "background", value: rgbToHex(solved) };
    }
    default:
      return null;
  }
}

/**
 * @param {FieldKey} field
 * @returns {string}
 */
function labelForField(field) {
  switch (field) {
    case "base":
      return "base colour";
    case "background":
      return "background colour";
    case "opacity":
      return "opacity";
    case "target":
      return "target colour";
    default:
      return field;
  }
}

/**
 * @param {HTMLElement} root
 */
export function initOpacityMatch(root) {
  if (!root) return null;

  const fields = {
    base: root.querySelector("#opacity-match-base"),
    background: root.querySelector("#opacity-match-background"),
    target: root.querySelector("#opacity-match-target"),
  };
  const swatches = {
    base: root.querySelector("#opacity-match-base-swatch"),
    background: root.querySelector("#opacity-match-background-swatch"),
    target: root.querySelector("#opacity-match-target-swatch"),
  };
  const opacitySliderEl = root.querySelector("#opacity-match-opacity");
  const opacityInput = opacitySliderEl?.querySelector(".slider-input");
  const statusEl = root.querySelector("#opacity-match-status");
  const previewBlendedSwatch = root.querySelector("#opacity-match-preview-blended");
  const previewBaseSwatch = root.querySelector("#opacity-match-preview-base");
  const previewMatchEl = root.querySelector("#opacity-match-preview-match");

  if (
    !fields.base ||
    !fields.background ||
    !fields.target ||
    !opacitySliderEl ||
    !opacityInput ||
    !statusEl
  ) {
    return null;
  }

  /** @type {ReturnType<typeof initSlider> | null} */
  let opacitySlider = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounceTimer;
  let syncing = false;

  function readValues() {
    const opacityPercent = readOpacityPercent(opacityInput);
    return {
      base: parseHexColor(fields.base.value),
      background: parseHexColor(fields.background.value),
      target: parseHexColor(fields.target.value),
      opacity: opacityPercent === null ? null : opacityPercent / 100,
      opacityPercent,
    };
  }

  /**
   * @param {ReturnType<typeof readValues>} values
   * @returns {FieldKey[]}
   */
  function findEmptyFields(values) {
    /** @type {FieldKey[]} */
    const empty = [];
    if (!values.base) empty.push("base");
    if (!values.background) empty.push("background");
    if (!values.target) empty.push("target");
    if (values.opacityPercent === null) empty.push("opacity");
    return empty;
  }

  function syncSwatches(values) {
    paintSwatch(swatches.base, values.base);
    paintSwatch(swatches.background, values.background);
    paintSwatch(swatches.target, values.target);
    paintSwatch(previewBaseSwatch, values.base);
  }

  function updatePreview(values) {
    const baseRgb = values.base ? hexToRgb(values.base) : null;
    const backgroundRgb = values.background ? hexToRgb(values.background) : null;
    const targetRgb = values.target ? hexToRgb(values.target) : null;
    const alpha = values.opacity;

    if (targetRgb && backgroundRgb && alpha !== null) {
      const blended = blendOver(targetRgb, backgroundRgb, alpha);
      if (blended) {
        paintSwatch(previewBlendedSwatch, rgbToHex(blended));
        if (baseRgb && previewMatchEl) {
          const matches = colorsMatch(blended, baseRgb, MATCH_TOLERANCE);
          previewMatchEl.textContent = matches ? "Matches base" : "Does not match base";
          previewMatchEl.dataset.match = matches ? "yes" : "no";
        } else if (previewMatchEl) {
          previewMatchEl.textContent = "";
          previewMatchEl.removeAttribute("data-match");
        }
        return;
      }
    }

    paintSwatch(previewBlendedSwatch, null);
    if (previewMatchEl) {
      previewMatchEl.textContent = "";
      previewMatchEl.removeAttribute("data-match");
    }
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function applyComputedValue(result) {
    syncing = true;
    if (result.field === "opacity") {
      opacitySlider?.setValue(result.value, { emit: false });
    } else {
      const input = fields[result.field];
      input.value = String(result.value);
      paintSwatch(swatches[result.field], String(result.value));
    }
    syncing = false;
  }

  function recompute() {
    if (syncing) return;

    const values = readValues();
    syncSwatches(values);
    updatePreview(values);

    const emptyFields = findEmptyFields(values);

    if (emptyFields.length === 0) {
      setStatus("All four fields are filled. Adjust the preview above or clear one field to solve for it.");
      return;
    }

    if (emptyFields.length > 1) {
      setStatus("Fill three fields and leave one empty to solve for it.");
      return;
    }

    const solved = computeMissing(emptyFields[0], values);

    if (!solved) {
      setStatus("Cannot solve for that combination — check the other values.");
      return;
    }

    applyComputedValue(solved);

    const nextValues = readValues();
    syncSwatches(nextValues);
    updatePreview(nextValues);
    setStatus(`Calculated ${labelForField(solved.field)}.`);
  }

  function scheduleRecompute() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(recompute, DEBOUNCE_MS);
  }

  FIELD_KEYS.forEach((key) => {
    if (key === "opacity") return;
    fields[key].addEventListener("input", scheduleRecompute);
    fields[key].addEventListener("change", recompute);
  });

  opacitySlider = initSlider(opacitySliderEl, {
    onInput: scheduleRecompute,
    onChange: recompute,
  });

  recompute();

  return { recompute };
}
