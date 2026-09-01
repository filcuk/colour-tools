import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChannelStackRows,
  withAlpha,
} from "../app/tools/opacity-match-chart-data.js";

test("withAlpha encodes alpha in rgba()", () => {
  assert.equal(withAlpha("#ef4444", 0.5), "rgba(239, 68, 68, 0.5)");
});

test("buildChannelStackRows stacks lower value and difference per channel", () => {
  const rows = buildChannelStackRows(
    { r: 252, g: 175, b: 124 },
    { r: 249, g: 180, b: 120 }
  );

  assert.equal(rows.length, 6);
  assert.deepEqual(rows[0], {
    channel: "Red",
    series: "Base",
    value: 249,
    base: 252,
    blended: 249,
    delta: 3,
    channelColor: "#ef4444",
  });
  assert.deepEqual(rows[1], {
    channel: "Red",
    series: "Difference",
    value: 3,
    base: 252,
    blended: 249,
    delta: 3,
    channelColor: "#ef4444",
  });
  assert.equal(rows[2].series, "Base");
  assert.equal(rows[2].value, 175);
  assert.equal(rows[3].value, 5);
  assert.equal(rows[4].value, 120);
  assert.equal(rows[5].value, 4);
});

test("buildChannelStackRows omits a difference slice when values match", () => {
  const rows = buildChannelStackRows(
    { r: 200, g: 200, b: 200 },
    { r: 200, g: 199, b: 200 }
  );

  assert.equal(rows.find((row) => row.channel === "Red" && row.series === "Difference")?.value, 0);
  assert.equal(rows.find((row) => row.channel === "Green" && row.series === "Difference")?.value, 1);
});
