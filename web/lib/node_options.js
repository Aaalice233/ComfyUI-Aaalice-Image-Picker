const LOCALIZED_COMBO_INPUTS = new Set(["selection_mode", "timeout_action"]);

export function installNodeOptionLabels(node, translate) {
	if (node?.comfyClass !== "AaaliceImagePicker") return false;

	let installed = false;
	for (const widget of node.widgets ?? []) {
		if (!LOCALIZED_COMBO_INPUTS.has(widget.name)) continue;
		widget.options ??= {};
		widget.options.getOptionLabel = (value) => translate(widget.name, value == null ? "" : String(value));
		installed = true;
	}
	return installed;
}
