import test from "node:test";
import assert from "node:assert/strict";

import { installNodeOptionLabels } from "../web/lib/node_options.js";

test("combo labels are localized without changing serialized values", () => {
	const selectionValues = ["single", "multiple"];
	const timeoutValues = ["cancel", "submit_first"];
	const node = {
		comfyClass: "AaaliceImagePicker",
		widgets: [
			{ name: "selection_mode", value: "multiple", options: { values: selectionValues } },
			{ name: "timeout_action", value: "submit_first", options: { values: timeoutValues } },
			{ name: "timeout", value: 300, options: {} },
		],
	};
	const labels = {
		"selection_mode:single": "单选",
		"selection_mode:multiple": "多选",
		"timeout_action:cancel": "取消执行",
		"timeout_action:submit_first": "提交第一张",
	};

	assert.equal(installNodeOptionLabels(node, (input, value) => labels[`${input}:${value}`] ?? value), true);
	assert.equal(node.widgets[0].options.getOptionLabel("single"), "单选");
	assert.equal(node.widgets[1].options.getOptionLabel("submit_first"), "提交第一张");
	assert.equal(node.widgets[1].options.getOptionLabel("unknown"), "unknown");
	assert.equal(node.widgets[0].value, "multiple");
	assert.equal(node.widgets[1].value, "submit_first");
	assert.equal(node.widgets[0].options.values, selectionValues);
	assert.equal(node.widgets[1].options.values, timeoutValues);
	assert.equal(node.widgets[2].options.getOptionLabel, undefined);
});

test("other nodes are not modified", () => {
	const widget = { name: "selection_mode", options: {} };
	assert.equal(installNodeOptionLabels({ comfyClass: "OtherNode", widgets: [widget] }, () => "translated"), false);
	assert.equal(widget.options.getOptionLabel, undefined);
});
