const CHANNELS = /** @type {const} */ ([
  { key: "r", label: "Red", color: "#ef4444" },
  { key: "g", label: "Green", color: "#22c55e" },
  { key: "b", label: "Blue", color: "#3b82f6" },
]);

/** @type {readonly ["Base", "Difference"]} */
export const STACK_SERIES_ORDER = ["Base", "Difference"];

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
 * Stack rows per channel: base (lower) value plus a difference segment on top.
 * Total bar height equals max(base, blended), so small gaps read as a thin slice.
 *
 * @param {{ r: number, g: number, b: number }} base
 * @param {{ r: number, g: number, b: number }} blended
 */
export function buildChannelStackRows(base, blended) {
  return CHANNELS.flatMap(({ key, label, color }) => {
    const baseValue = base[key];
    const blendedValue = blended[key];
    const lower = Math.min(baseValue, blendedValue);
    const delta = Math.abs(blendedValue - baseValue);

    return [
      {
        channel: label,
        series: "Base",
        value: lower,
        base: baseValue,
        blended: blendedValue,
        delta,
        channelColor: color,
      },
      {
        channel: label,
        series: "Difference",
        value: delta,
        base: baseValue,
        blended: blendedValue,
        delta,
        channelColor: color,
      },
    ];
  });
}
