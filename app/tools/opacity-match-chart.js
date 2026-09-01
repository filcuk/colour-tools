/**
 * Horizontal stacked bar chart — base channel value with a difference segment.
 */

import { defineChart } from "../vendor/tanstack-charts/scene.js";
import { barX } from "../vendor/tanstack-charts/bar.js";
import { stack } from "../vendor/tanstack-charts/stack.js";
import { tooltip } from "../vendor/tanstack-charts/tooltip.js";
import { scaleBand } from "../vendor/tanstack-charts/scales/band.js";
import { scaleLinear } from "../vendor/tanstack-charts/scales/linear.js";
import {
  buildChannelStackRows,
  STACK_SERIES_ORDER,
  withAlpha,
} from "./opacity-match-chart-data.js";

const TICK_FONT_SIZE = 13;
const CHANNEL_VALUE_SCALE = scaleLinear().domain([0, 255]).clamp(true);
/** @type {readonly number[]} */
const CHANNEL_VALUE_TICKS = Array.from({ length: 18 }, (_, index) => index * 15);

/**
 * @param {{ r: number, g: number, b: number }} base
 * @param {{ r: number, g: number, b: number }} blended
 */
export function buildChannelChartDefinition(base, blended) {
  const rows = buildChannelStackRows(base, blended);

  return defineChart({
    color: {
      domain: [...STACK_SERIES_ORDER],
      range: ["var(--accent)", "var(--muted)"],
    },
    marks: [
      barX(rows, {
        id: "opacity-match-channel-bars",
        x: "value",
        y: "channel",
        z: "series",
        fill: (datum) =>
          datum.series === "Base"
            ? datum.channelColor
            : withAlpha(datum.channelColor, 0.72),
        layout: stack({ order: [...STACK_SERIES_ORDER] }),
        radius: 4,
        maxThickness: 28,
        inset: 0.22,
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
