import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChannelBarRows,
  formatChannelDeviations,
  withAlpha,
} from "../app/tools/opacity-match-chart-data.js";

test("withAlpha encodes alpha in rgba()", () => {
  assert.equal(withAlpha("#ef4444", 0.5), "rgba(239, 68, 68, 0.5)");
});

test("buildChannelBarRows emits base, target, and blended rows per channel", () => {
  const rows = buildChannelBarRows(
    { r: 252, g: 175, b: 124 },
    { r: 255, g: 170, b: 118 },
    { r: 249, g: 180, b: 120 }
  );

  assert.equal(rows.length, 9);
  assert.deepEqual(rows[0], {
    channel: "Red",
    series: "Base",
    value: 252,
    channelColor: "#ef4444",
  });
  assert.deepEqual(rows[1], {
    channel: "Red",
    series: "Target",
    value: 255,
    channelColor: "#ef4444",
  });
  assert.deepEqual(rows[2], {
    channel: "Red",
    series: "Blended",
    value: 249,
    channelColor: "#ef4444",
  });
  assert.deepEqual(rows[7], {
    channel: "Blue",
    series: "Target",
    value: 118,
    channelColor: "#3b82f6",
  });
});

test("buildChannelBarRows preserves independent values per series", () => {
  const rows = buildChannelBarRows(
    { r: 100, g: 200, b: 150 },
    { r: 120, g: 180, b: 160 },
    { r: 110, g: 190, b: 150 }
  );

  assert.equal(rows.find((row) => row.channel === "Green" && row.series === "Base")?.value, 200);
  assert.equal(rows.find((row) => row.channel === "Green" && row.series === "Target")?.value, 180);
  assert.equal(rows.find((row) => row.channel === "Green" && row.series === "Blended")?.value, 190);
});

test("formatChannelDeviations shows signed blended minus base per channel", () => {
  assert.equal(
    formatChannelDeviations({ r: 249, g: 180, b: 120 }, { r: 252, g: 175, b: 124 }),
    "red -3, green +5, blue -4"
  );
});

test("formatChannelDeviations omits channels with zero deviation", () => {
  assert.equal(
    formatChannelDeviations({ r: 252, g: 180, b: 124 }, { r: 252, g: 175, b: 124 }),
    "green +5"
  );
  assert.equal(
    formatChannelDeviations({ r: 252, g: 175, b: 124 }, { r: 252, g: 175, b: 124 }),
    ""
  );
});
