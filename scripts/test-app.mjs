/**
 * Fork test runner for colour-tools.
 *
 * The trimmed component set does not ship the full SMA1 catalogue, so
 * The default glob (all tests under tests/) imports missing modules on this fork.
 * CI uses this script instead of the framework default glob.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Tests that pass against the locked 17-component fork. */
const FORK_TESTS = [
  "tests/also-see-svg.test.js",
  "tests/also-see.test.js",
  "tests/brand-icon.test.js",
  "tests/button-label.test.js",
  "tests/blend.test.js",
  "tests/color-picker.test.js",
  "tests/document-listeners.test.js",
  "tests/dom.test.js",
  "tests/framework-sync.test.js",
  "tests/heading-link.test.js",
  "tests/icons.test.js",
  "tests/menu-grid.test.js",
  "tests/opacity-match-chart.test.js",
  "tests/opacity-match.test.js",
  "tests/title-numbering.test.js",
  "tests/tutorial.test.js",
];

const result = spawnSync(process.execPath, ["--test", ...FORK_TESTS], {
  cwd: ROOT,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
