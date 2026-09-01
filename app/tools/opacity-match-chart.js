/**
 * Horizontal grouped bar chart — base, target, and blended channel values.
 */

import { defineChart } from "../vendor/tanstack-charts/scene.js";
import { barX } from "../vendor/tanstack-charts/bar.js";
import { group } from "../vendor/tanstack-charts/group.js";
import { tooltip } from "../vendor/tanstack-charts/tooltip.js";
import { scaleBand } from "../vendor/tanstack-charts/scales/band.js";
import { scaleLinear } from "../vendor/tanstack-charts/scales/linear.js";
import {
  BAR_SERIES_ORDER,
  buildChannelBarRows,
  withAlpha,
} from "./opacity-match-chart-data.js";

const TICK_FONT_SIZE = 13;
const CHANNEL_VALUE_SCALE = scaleLinear().domain([0, 255]).clamp(true);
/** @type {readonly number[]} */
const CHANNEL_VALUE_TICKS = Array.from({ length: 18 }, (_, index) => index * 15);

/**
 * @param {{ r: number, g: number, b: number }} base
 * @param {{ r: number, g: number, b: number }} target
 * @param {{ r: number, g: number, b: number }} blended
 */
export function buildChannelChartDefinition(base, target, blended) {
  const rows = buildChannelBarRows(base, target, blended);

  return defineChart({
    color: {
      domain: [...BAR_SERIES_ORDER],
      range: ["var(--accent)", "var(--muted)", "var(--text)"],
    },
    marks: [
      barX(rows, {
        id: "opacity-match-channel-bars",
        x: "value",
        y: "channel",
        z: "series",
        fill: (datum) => {
          if (datum.series === "Base") return datum.channelColor;
          if (datum.series === "Target") return withAlpha(datum.channelColor, 0.72);
          return withAlpha(datum.channelColor, 0.45);
        },
        layout: group({ padding: 0.1 }),
        radius: 3,
        maxThickness: 18,
        inset: 0.12,
      }),
    ],
    x: {
      scale: CHANNEL_VALUE_SCALE,
      nice: false,
      grid: true,
      axis: {
        label: "Value",
        ticks: { values: [...CHANNEL_VALUE_TICKS] },
        tickLabels: { fontSize: TICK_FONT_SIZE },
      },
    },
    y: {
      scale: () => scaleBand().padding(0.35),
      axis: {
        label: "Channel",
        tickLabels: { fontSize: TICK_FONT_SIZE },
      },
    },
    tooltip,
  });
}
