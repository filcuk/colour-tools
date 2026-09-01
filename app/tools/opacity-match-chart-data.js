const CHANNELS = /** @type {const} */ ([
  { key: "r", label: "Red", color: "#ef4444" },
  { key: "g", label: "Green", color: "#22c55e" },
  { key: "b", label: "Blue", color: "#3b82f6" },
]);

/** @type {readonly ["Base", "Target", "Blended"]} */
export const BAR_SERIES_ORDER = ["Base", "Target", "Blended"];

/**
 * @param {string} hex `#RRGGBB`
 * @param {number} alpha 0–1
 * @returns {string}
 */
export function withAlpha(hex, alpha) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * @param {{ r: number, g: number, b: number }} blended
 * @param {{ r: number, g: number, b: number }} base
 * @returns {string} e.g. "red +1, green −2, blue −5"
 */
export function formatChannelDeviations(blended, base) {
  return CHANNELS.map(({ key, label }) => {
    const delta = blended[key] - base[key];
    const sign = delta > 0 ? "+" : "";
    return { label, text: `${label.toLowerCase()} ${sign}${delta}`, delta };
  })
    .filter(({ delta }) => delta !== 0)
    .map(({ text }) => text)
    .join(", ");
}

/**
 * @param {{ r: number, g: number, b: number }} base
 * @param {{ r: number, g: number, b: number }} target
 * @param {{ r: number, g: number, b: number }} blended
 */
export function buildChannelBarRows(base, target, blended) {
  return CHANNELS.flatMap(({ key, label, color }) => [
    {
      channel: label,
      series: "Base",
      value: base[key],
      channelColor: color,
    },
    {
      channel: label,
      series: "Target",
      value: target[key],
      channelColor: color,
    },
    {
      channel: label,
      series: "Blended",
      value: blended[key],
      channelColor: color,
    },
  ]);
}
