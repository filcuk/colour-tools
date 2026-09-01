import { initShell } from "./shell/shell.js";
import { initSegmentedControl } from "./components/segmented-control.js";
import { initOpacityMatch } from "./tools/opacity-match.js";

initShell();
initSegmentedControl(document.getElementById("tool-nav"));
initOpacityMatch(document.getElementById("tool-panel-opacity-match"));
