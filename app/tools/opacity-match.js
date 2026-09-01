/**
 * Opacity match — given base, background, and either opacity or target colour,
 * calculate the other using sRGB channel blending.
 */

import { hideBanner, showBanner } from "../components/banner.js";
import { initChart } from "../components/charts.js";
import { initColorInput } from "../components/color-input.js";
import { initSlider } from "../components/slider.js";
import { blendOver, solveAlphaBestEffort, solveForeground } from "../utils/blend.js";
import {
  prepareButtonLabelFlash,
  flashButtonLabel,
} from "../utils/button-label.js";
import { copyText } from "../utils/clipboard.js";
import { setHidden } from "../utils/dom.js";
import { mountIcon } from "../utils/icons.js";
import { hexToRgb, rgbToHex } from "../utils/color.js";
import { buildChannelChartDefinition } from "./opacity-match-chart.js";

const COLOR_FIELDS = /** @type {const} */ (["base", "background", "target"]);
const DEBOUNCE_MS = 150;
const RESULT_BANNER_TONES = /** @type {const} */ ({
  warning: "banner-warning",
  error: "banner-error",
  info: "banner-info",
});
const RESULT_BANNER_ICONS = /** @type {const} */ ({
  warning: "warning",
  error: "error",
  info: "info",
});

/**
 * @param {{ r: number, g: number, b: number }} a
 * @param {{ r: number, g: number, b: number }} b
 * @returns {number} Whole-number match percentage from 0 to 100.
 */
function colorMatchPercent(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);
  const maxDistance = Math.sqrt(3 * 255 * 255);
  return Math.max(0, Math.min(100, Math.round(100 - (distance / maxDistance) * 100)));
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
 * @param {HTMLElement} root
 */
export function initOpacityMatch(root) {
  if (!root) return null;

  const wraps = {
    base: root.querySelector("#opacity-match-base-wrap"),
    background: root.querySelector("#opacity-match-background-wrap"),
    target: root.querySelector("#opacity-match-target-wrap"),
  };
  const resultWrap = root.querySelector("#opacity-match-result-wrap");
  const opacitySliderEl = root.querySelector("#opacity-match-opacity");
  const opacityInput = opacitySliderEl?.querySelector(".slider-input");
  const calcTargetBtn = root.querySelector("#opacity-match-calc-target");
  const calcOpacityBtn = root.querySelector("#opacity-match-calc-opacity");
  const copyResultBtn = root.querySelector("#opacity-match-copy-result");
  const matchPercentEl = root.querySelector("#opacity-match-match-percent");
  const resultBanner = root.querySelector("#opacity-match-result-banner");
  const resultBannerBody = root.querySelector("#opacity-match-result-banner-body");
  const resultBannerIcon = resultBanner?.querySelector(".banner-icon");
  const channelChartEl = root.querySelector("#opacity-match-channel-chart");

  if (
    !wraps.base ||
    !wraps.background ||
    !wraps.target ||
    !resultWrap ||
    !opacitySliderEl ||
    !opacityInput ||
    !calcTargetBtn ||
    !calcOpacityBtn ||
    !copyResultBtn ||
    !matchPercentEl ||
    !resultBanner ||
    !resultBannerBody ||
    !resultBannerIcon ||
    !channelChartEl
  ) {
    return null;
  }

  /** @type {ReturnType<typeof initSlider> | null} */
  let opacitySlider = null;
  /** @type {ReturnType<typeof initColorInput> | null} */
  let resultInput = null;
  /** @type {ReturnType<typeof initChart> | null} */
  let channelChart = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounceTimer;
  let syncing = false;
  /** @type {string | null} */
  let blendedHex = null;

  /** @type {Record<"base" | "background" | "target", ReturnType<typeof initColorInput> | null>} */
  const colorInputs = {
    base: null,
    background: null,
    target: null,
  };

  function readValues() {
    const opacityPercent = readOpacityPercent(opacityInput);
    return {
      base: colorInputs.base?.getValue() ?? null,
      background: colorInputs.background?.getValue() ?? null,
      target: colorInputs.target?.getValue() ?? null,
      opacity: opacityPercent === null ? null : opacityPercent / 100,
      opacityPercent,
    };
  }

  function setMatchPercent(message) {
    matchPercentEl.textContent = message;
    matchPercentEl.removeAttribute("data-match");
  }

  /**
   * @param {string} message
   * @param {"warning" | "error" | "info"} [tone]
   */
  function setResultBanner(message, tone = "warning") {
    Object.values(RESULT_BANNER_TONES).forEach((className) => {
      resultBanner.classList.remove(className);
    });
    resultBanner.classList.add(RESULT_BANNER_TONES[tone]);
    mountIcon(resultBannerIcon, RESULT_BANNER_ICONS[tone], {
      className: "banner-icon-svg",
    });
    resultBannerBody.textContent = message;
    showBanner(resultBanner);
  }

  function clearResultBanner() {
    hideBanner(resultBanner);
  }

  /**
   * @param {{ r: number, g: number, b: number } | null} baseRgb
   * @param {{ r: number, g: number, b: number } | null} blendedRgb
   */
  function updateChannelChart(baseRgb, blendedRgb) {
    if (!baseRgb || !blendedRgb) {
      setHidden(channelChartEl, true);
      return;
    }

    const definition = buildChannelChartDefinition(baseRgb, blendedRgb);
    setHidden(channelChartEl, false);

    const mountOrUpdate = () => {
      try {
        if (!channelChart) {
          channelChart = initChart(channelChartEl, {
            definition,
            ariaLabel: "Stacked bar chart of base and blended Red, Green, and Blue values",
          });
          if (!channelChart) {
            delete channelChartEl.dataset.chartsInit;
          }
          return;
        }

        channelChart.update({ definition });
      } catch {
        delete channelChartEl.dataset.chartsInit;
        channelChart = null;
      }
    };

    requestAnimationFrame(mountOrUpdate);
  }

  function updateResult(values) {
    blendedHex = null;
    copyResultBtn.disabled = true;

    const baseRgb = values.base ? hexToRgb(values.base) : null;
    const backgroundRgb = values.background ? hexToRgb(values.background) : null;
    const targetRgb = values.target ? hexToRgb(values.target) : null;
    const alpha = values.opacity;
    /** @type {{ r: number, g: number, b: number } | null} */
    let blendedRgb = null;

    if (targetRgb && backgroundRgb && alpha !== null) {
      const blended = blendOver(targetRgb, backgroundRgb, alpha);
      if (blended) {
        blendedRgb = blended;
        blendedHex = rgbToHex(blended);
        resultInput?.setValue(blendedHex, { emit: false });
        copyResultBtn.disabled = false;

        if (baseRgb) {
          const percent = colorMatchPercent(blended, baseRgb);
          setMatchPercent(`${percent}% match to base`);
          matchPercentEl.dataset.match = percent === 100 ? "yes" : "partial";
        } else {
          setMatchPercent("Enter a base colour to compare.");
        }

        updateChannelChart(baseRgb, blendedRgb);
        return;
      }
    }

    updateChannelChart(null, null);
    resultInput?.setValue("", { emit: false });
    setMatchPercent("Enter target, background, and opacity to preview the blend.");
  }

  function refreshPreview() {
    if (syncing) return;
    clearResultBanner();
    updateResult(readValues());
  }

  function scheduleRefreshPreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshPreview, DEBOUNCE_MS);
  }

  async function copyBlendedResult() {
    if (!blendedHex) return;

    const ok = await copyText(blendedHex);
    flashButtonLabel(copyResultBtn, ok, {
      success: "Copied",
      fail: "Failed",
    });
  }

  function calculateTarget() {
    clearResultBanner();
    const values = readValues();
    updateResult(values);

    if (!values.base || !values.background) {
      setResultBanner("Enter base and background colours first.", "warning");
      return;
    }
    if (values.opacity === null) {
      setResultBanner("Enter opacity to calculate target.", "warning");
      return;
    }

    const baseRgb = hexToRgb(values.base);
    const backgroundRgb = hexToRgb(values.background);
    if (!baseRgb || !backgroundRgb) {
      setResultBanner("Enter valid base and background colours.", "warning");
      return;
    }

    const solved = solveForeground(baseRgb, backgroundRgb, values.opacity);
    if (!solved) {
      setResultBanner("Cannot calculate target at 0% opacity — try a higher value.", "warning");
      return;
    }

    syncing = true;
    colorInputs.target?.setValue(rgbToHex(solved), { emit: false });
    syncing = false;

    updateResult(readValues());

    const reblended = blendOver(solved, backgroundRgb, values.opacity);
    const matchPercent =
      reblended && baseRgb ? colorMatchPercent(reblended, baseRgb) : null;

    if (matchPercent !== null && matchPercent < 100) {
      setResultBanner(
        `No exact target exists at this opacity — this is the closest match (${matchPercent}%).`,
        "warning"
      );
    }
  }

  function calculateOpacity() {
    clearResultBanner();
    const values = readValues();
    updateResult(values);

    if (!values.base || !values.background) {
      setResultBanner("Enter base and background colours first.", "warning");
      return;
    }
    if (!values.target) {
      setResultBanner("Enter target colour to calculate opacity.", "warning");
      return;
    }

    const baseRgb = hexToRgb(values.base);
    const backgroundRgb = hexToRgb(values.background);
    const targetRgb = hexToRgb(values.target);
    if (!baseRgb || !backgroundRgb || !targetRgb) {
      setResultBanner("Enter valid base, background, and target colours.", "warning");
      return;
    }

    const { alpha, exact } = solveAlphaBestEffort(baseRgb, targetRgb, backgroundRgb);

    syncing = true;
    opacitySlider?.setValue(Math.round(alpha * 100), { emit: false });
    syncing = false;

    updateResult(readValues());

    const updated = readValues();
    const blended =
      updated.target && updated.background && updated.opacity !== null
        ? blendOver(hexToRgb(updated.target), hexToRgb(updated.background), updated.opacity)
        : null;
    const matchPercent = blended ? colorMatchPercent(blended, baseRgb) : null;

    if (!exact) {
      setResultBanner(
        matchPercent === null
          ? "No exact opacity matches base on this background — using closest match."
          : `No exact opacity matches base on this background — using closest match (${matchPercent}% match).`,
        "warning"
      );
    }
  }

  COLOR_FIELDS.forEach((key) => {
    colorInputs[key] = initColorInput(wraps[key], {
      onChange: refreshPreview,
      onInput: scheduleRefreshPreview,
    });
  });

  resultInput = initColorInput(resultWrap);

  const resultField = resultWrap.querySelector(".color-input-field");
  if (resultField instanceof HTMLInputElement) {
    resultField.readOnly = true;
    resultField.addEventListener("beforeinput", (event) => {
      event.preventDefault();
    });
    resultField.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        event.key === "Tab" ||
        event.key.startsWith("Arrow") ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        return;
      }
      event.preventDefault();
    });
  }

  opacitySlider = initSlider(opacitySliderEl, {
    onInput: scheduleRefreshPreview,
    onChange: refreshPreview,
  });

  prepareButtonLabelFlash(copyResultBtn, {
    idle: "Copy",
    success: "Copied",
    fail: "Failed",
  });

  calcTargetBtn.addEventListener("click", calculateTarget);
  calcOpacityBtn.addEventListener("click", calculateOpacity);
  copyResultBtn.addEventListener("click", copyBlendedResult);

  refreshPreview();

  return { calculateTarget, calculateOpacity, refreshPreview };
}
