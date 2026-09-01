/**
 * Opacity match — given base, background, and either opacity or target colour,
 * calculate the other using sRGB channel blending.
 */

import { hideBanner, showBanner } from "../components/banner.js";
import { initAboutDialog } from "../components/about-dialog.js";
import { initChart } from "../components/charts.js";
import { initColorInput } from "../components/color-input.js";
import { initSlider } from "../components/slider.js";
import { initTutorial } from "../components/tutorial.js";
import { blendOver, colorsMatch } from "../utils/blend.js";
import {
  prepareButtonLabelFlash,
  flashButtonLabel,
  setButtonLabelFlash,
} from "../utils/button-label.js";
import { copyText } from "../utils/clipboard.js";
import { setHidden } from "../utils/dom.js";
import { mountIcon } from "../utils/icons.js";
import { hexToRgb, rgbToHex } from "../utils/color.js";
import { buildChannelChartDefinition } from "./opacity-match-chart.js";
import { colorMatchPercent, solveOpacityForMatch, solveTargetColour } from "./opacity-match-calc.js";
import { formatChannelDeviations } from "./opacity-match-chart-data.js";

const COLOR_FIELDS = /** @type {const} */ (["base", "background", "target"]);
const DEBOUNCE_MS = 150;
const STATE_STORAGE_KEY = "colour-tools-opacity-match";
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
 * @param {number} percent
 * @returns {string}
 */
function formatMatchPercent(percent) {
  return `${percent.toFixed(1)}%`;
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
 * @param {string | null | undefined} value
 * @returns {value is string}
 */
function isValidHexColor(value) {
  return typeof value === "string" && hexToRgb(value) !== null;
}

/**
 * @returns {{ base?: string, background?: string, target?: string, opacityPercent?: number } | null}
 */
function readSavedState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   base: string | null,
 *   background: string | null,
 *   target: string | null,
 *   opacityPercent: number | null,
 * }} values
 */
function persistState(values) {
  try {
    const payload = { ...(readSavedState() ?? {}) };

    if (isValidHexColor(values.base)) {
      payload.base = values.base;
    } else {
      delete payload.base;
    }

    if (isValidHexColor(values.background)) {
      payload.background = values.background;
    } else {
      delete payload.background;
    }

    if (isValidHexColor(values.target)) {
      payload.target = values.target;
    } else {
      delete payload.target;
    }

    if (values.opacityPercent !== null && Number.isFinite(values.opacityPercent)) {
      payload.opacityPercent = values.opacityPercent;
    } else {
      delete payload.opacityPercent;
    }

    if (Object.keys(payload).length === 0) {
      localStorage.removeItem(STATE_STORAGE_KEY);
    } else {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignore quota / private-mode errors.
  }
}

/**
 * @param {HTMLElement | null} wrap
 */
function lockReadOnlyColorField(wrap) {
  const field = wrap?.querySelector(".color-input-field");
  if (!(field instanceof HTMLInputElement)) return;

  field.readOnly = true;
  field.addEventListener("beforeinput", (event) => {
    event.preventDefault();
  });
  field.addEventListener("keydown", (event) => {
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

/** Matches shared-slot hide cleanup in `app/components/tooltip.js`. */
const TOOLTIP_HIDE_CLEANUP_MS = 120;

/**
 * @param {HTMLButtonElement} button
 */
function wireCalcButtonTooltipNowrap(button) {
  const tooltipNowrapClass = "opacity-match-tooltip-nowrap";
  /** @type {ReturnType<typeof setTimeout> | null} */
  let removeTimer = null;
  /** @type {((event: TransitionEvent) => void) | null} */
  let removeTransitionHandler = null;

  const tooltipEl = () => document.getElementById("tooltip");

  const cancelDeferredRemove = () => {
    if (removeTimer !== null) {
      window.clearTimeout(removeTimer);
      removeTimer = null;
    }
    const tip = tooltipEl();
    if (removeTransitionHandler && tip) {
      tip.removeEventListener("transitionend", removeTransitionHandler);
    }
    removeTransitionHandler = null;
  };

  const finishRemoveNowrap = () => {
    cancelDeferredRemove();
    tooltipEl()?.classList.remove(tooltipNowrapClass);
  };

  const enableNowrap = () => {
    cancelDeferredRemove();
    tooltipEl()?.classList.add(tooltipNowrapClass);
  };

  const disableNowrap = () => {
    const tip = tooltipEl();
    if (!tip?.classList.contains(tooltipNowrapClass)) return;

    if (tip.hidden) {
      finishRemoveNowrap();
      return;
    }

    // Tooltip keeps its layout during the opacity fade — defer nowrap removal.
    cancelDeferredRemove();
    removeTransitionHandler = (event) => {
      if (event.target !== tip || event.propertyName !== "opacity") return;
      finishRemoveNowrap();
    };
    tip.addEventListener("transitionend", removeTransitionHandler);
    removeTimer = window.setTimeout(finishRemoveNowrap, TOOLTIP_HIDE_CLEANUP_MS);
  };

  button.addEventListener("pointerenter", enableNowrap);
  button.addEventListener("focusin", enableNowrap);
  button.addEventListener("pointerleave", disableNowrap);
  button.addEventListener("focusout", disableNowrap);
}

/** @type {import("../components/tutorial.js").TutorialStep[]} */
const OPACITY_MATCH_TOUR_STEPS = [
  {
    target: "#opacity-match-base-wrap",
    title: "Base colour",
    body: "The solid colour you want the blend to match.",
    position: "bottom",
  },
  {
    target: "#opacity-match-background-wrap",
    title: "Background colour",
    body: "The surface behind your semi-transparent layer.",
    position: "bottom",
  },
  {
    target: "#opacity-match-opacity",
    title: "Opacity",
    body: "Set the layer opacity, then calculate the target colour needed to hit the base on this background.",
    position: "bottom",
  },
  {
    target: "#opacity-match-target-wrap",
    title: "Target colour",
    body: "Or enter the target colour you need to work with, then calculate the opacity.",
    position: "bottom",
  },
  {
    target: "#opacity-match-output-field",
    title: "Output",
    body: "This displays the colour you need to use.",
    position: "top",
  },
];

function initOpacityMatchHelp() {
  const aboutDialogEl = document.getElementById("opacity-match-about-dialog");
  const aboutOpenBtn = document.getElementById("opacity-match-about-open");
  const guidedTourBtn = document.getElementById("opacity-match-guided-tour");

  const tour = initTutorial({
    id: "opacity-match-tour",
    steps: OPACITY_MATCH_TOUR_STEPS,
  });

  const about = initAboutDialog({
    dialogEl: aboutDialogEl,
    openTriggers: aboutOpenBtn ? [aboutOpenBtn] : [],
  });

  guidedTourBtn?.addEventListener("click", () => {
    about?.closeDialog();
    tour?.start();
  });

  return { about, tour };
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
  const outputWrap = root.querySelector("#opacity-match-output-wrap");
  const opacitySliderEl = root.querySelector("#opacity-match-opacity");
  const opacityInput = opacitySliderEl?.querySelector(".slider-input");
  const calcTargetBtn = root.querySelector("#opacity-match-calc-target");
  const calcOpacityBtn = root.querySelector("#opacity-match-calc-opacity");
  const copyOutputBtn = root.querySelector("#opacity-match-copy-output");
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
    !outputWrap ||
    !opacitySliderEl ||
    !opacityInput ||
    !calcTargetBtn ||
    !calcOpacityBtn ||
    !copyOutputBtn ||
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
  /** @type {ReturnType<typeof initColorInput> | null} */
  let outputInput = null;
  /** @type {ReturnType<typeof initChart> | null} */
  let channelChart = null;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let debounceTimer;
  let syncing = false;
  let persistEnabled = false;
  /** @type {string | null} */
  let outputHex = null;

  const savedState = readSavedState();

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
   * @param {{ r: number, g: number, b: number } | null} targetRgb
   * @param {{ r: number, g: number, b: number } | null} blendedRgb
   */
  function updateChannelChart(baseRgb, targetRgb, blendedRgb) {
    if (!baseRgb || !targetRgb || !blendedRgb) {
      setHidden(channelChartEl, true);
      return;
    }

    const definition = buildChannelChartDefinition(baseRgb, targetRgb, blendedRgb);
    setHidden(channelChartEl, false);

    const mountOrUpdate = () => {
      try {
        if (!channelChart) {
          channelChart = initChart(channelChartEl, {
            definition,
            ariaLabel: "Grouped bar chart of base, target, and blended Red, Green, and Blue values",
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
    outputHex = null;
    copyOutputBtn.disabled = true;

    const baseRgb = values.base ? hexToRgb(values.base) : null;
    const backgroundRgb = values.background ? hexToRgb(values.background) : null;
    const targetRgb = values.target ? hexToRgb(values.target) : null;
    const alpha = values.opacity;

    if (targetRgb && alpha !== null) {
      outputHex = rgbToHex({ ...targetRgb, a: alpha }, { alpha: true });
      outputInput?.setValue(outputHex, { emit: false });
      copyOutputBtn.disabled = false;
    } else {
      outputInput?.setValue("", { emit: false });
    }

    if (targetRgb && backgroundRgb && alpha !== null) {
      const blended = blendOver(targetRgb, backgroundRgb, alpha);
      if (blended) {
        resultInput?.setValue(rgbToHex(blended), { emit: false });

        if (baseRgb) {
          const percent = colorMatchPercent(blended, baseRgb);
          const deviations = formatChannelDeviations(blended, baseRgb);
          const deviationSuffix = deviations ? ` (${deviations})` : "";
          setMatchPercent(`${formatMatchPercent(percent)} match to base${deviationSuffix}`);
          matchPercentEl.dataset.match = colorsMatch(blended, baseRgb, 0) ? "yes" : "partial";
        } else {
          setMatchPercent("Enter a base colour to compare.");
        }

        updateChannelChart(baseRgb, targetRgb, blended);
        return;
      }
    }

    updateChannelChart(null, null, null);
    resultInput?.setValue("", { emit: false });

    if (targetRgb && alpha !== null && !backgroundRgb) {
      setMatchPercent("Enter background colour to preview the blend.");
    } else if (!targetRgb || alpha === null) {
      setMatchPercent("Enter target and opacity for output colour.");
    } else {
      setMatchPercent("Enter target, background, and opacity to preview the blend.");
    }
  }

  function refreshPreview() {
    if (syncing) return;
    clearResultBanner();
    const values = readValues();
    updateResult(values);
    if (persistEnabled) persistState(values);
  }

  function scheduleRefreshPreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshPreview, DEBOUNCE_MS);
  }

  async function copyOutputColour() {
    if (!outputHex) return;

    const ok = await copyText(outputHex);
    flashButtonLabel(copyOutputBtn, ok, {
      success: "Copied",
      fail: "Failed",
      reset: () => {
        copyOutputBtn.setAttribute("aria-label", "Copy output colour");
        setButtonLabelFlash(copyOutputBtn, "Copy");
      },
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

    const solved = solveTargetColour(values.base, values.background, values.opacity);
    if (!solved) {
      setResultBanner("Cannot calculate target at 0% opacity — try a higher value.", "warning");
      return;
    }

    syncing = true;
    colorInputs.target?.setValue(solved.targetHex, { emit: false });
    syncing = false;

    updateResult(readValues());

    if (solved.reblended && !solved.isExactMatch) {
      const matchPercent = colorMatchPercent(solved.reblended, baseRgb);
      setResultBanner(
        `No exact target exists at this opacity — this is the closest match (${formatMatchPercent(matchPercent)}).`,
        "warning"
      );
    }

    persistState(readValues());
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

    const solved = solveOpacityForMatch(values.base, values.background, values.target);
    if (!solved) {
      setResultBanner("Enter valid base, background, and target colours.", "warning");
      return;
    }

    syncing = true;
    opacitySlider?.setValue(solved.opacityPercent, { emit: false });
    syncing = false;

    updateResult(readValues());

    if (solved.shouldWarnClosest) {
      const matchPercent = solved.matchPercent ?? 0;
      if (solved.reblended) {
        setResultBanner(
          `No exact opacity matches base on this background — using closest match (${formatMatchPercent(matchPercent)} match).`,
          "warning"
        );
      } else {
        setResultBanner(
          "No exact opacity matches base on this background — using closest match.",
          "warning"
        );
      }
    }

    persistState(readValues());
  }

  function restoreSavedState() {
    syncing = true;
    if (isValidHexColor(savedState?.base)) {
      colorInputs.base?.setValue(savedState.base, { emit: false });
    }
    if (isValidHexColor(savedState?.background)) {
      colorInputs.background?.setValue(savedState.background, { emit: false });
    }
    if (isValidHexColor(savedState?.target)) {
      colorInputs.target?.setValue(savedState.target, { emit: false });
    }
    if (typeof savedState?.opacityPercent === "number" && Number.isFinite(savedState.opacityPercent)) {
      opacitySlider?.setValue(savedState.opacityPercent, { emit: false });
    }
    syncing = false;
  }

  COLOR_FIELDS.forEach((key) => {
    const savedColor = savedState?.[key];
    colorInputs[key] = initColorInput(wraps[key], {
      defaultValue: isValidHexColor(savedColor) ? savedColor : undefined,
      onChange: refreshPreview,
      onInput: scheduleRefreshPreview,
    });
  });

  resultInput = initColorInput(resultWrap);
  outputInput = initColorInput(outputWrap);
  lockReadOnlyColorField(resultWrap);
  lockReadOnlyColorField(outputWrap);

  opacitySlider = initSlider(opacitySliderEl, {
    defaultValue:
      typeof savedState?.opacityPercent === "number" && Number.isFinite(savedState.opacityPercent)
        ? savedState.opacityPercent
        : undefined,
    onInput: scheduleRefreshPreview,
    onChange: refreshPreview,
  });

  prepareButtonLabelFlash(copyOutputBtn, {
    idle: "Copy",
    success: "Copied",
    fail: "Failed",
  });

  calcTargetBtn.addEventListener("click", calculateTarget);
  calcOpacityBtn.addEventListener("click", calculateOpacity);
  copyOutputBtn.addEventListener("click", copyOutputColour);
  wireCalcButtonTooltipNowrap(calcTargetBtn);
  wireCalcButtonTooltipNowrap(calcOpacityBtn);

  restoreSavedState();
  persistEnabled = true;
  refreshPreview();
  const help = initOpacityMatchHelp();

  return { calculateTarget, calculateOpacity, refreshPreview, ...help };
}
