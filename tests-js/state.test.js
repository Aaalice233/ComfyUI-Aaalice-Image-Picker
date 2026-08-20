import test from "node:test";
import assert from "node:assert/strict";

import { buildDraftPayload, buildResponsePayload, formatDuration, moveGridFocus, secondsRemaining, selectAll, toggleSelection } from "../web/lib/state.js";

test("single selection replaces and toggles the current image", () => {
	assert.deepEqual(toggleSelection([], 2, "single"), [2]);
	assert.deepEqual(toggleSelection([2], 1, "single"), [1]);
	assert.deepEqual(toggleSelection([2], 2, "single"), []);
});

test("multiple selection toggles and submits in source order", () => {
	let selected = toggleSelection([], 3, "multiple");
	selected = toggleSelection(selected, 1, "multiple");
	assert.deepEqual(selected, [1, 3]);
	assert.deepEqual(toggleSelection(selected, 1, "multiple"), [3]);
	assert.deepEqual(selectAll(4, "multiple"), [0, 1, 2, 3]);
	assert.deepEqual(selectAll(4, "single"), []);
});

test("draft revisions and final payloads preserve complete sorted selection", () => {
	assert.deepEqual(buildDraftPayload("s", "c", 4, [2, 0]), {
		session_id: "s", client_id: "c", revision: 4, selected: [0, 2],
	});
	assert.deepEqual(buildResponsePayload("s", "c", "confirm", [2, 0]), {
		session_id: "s", client_id: "c", action: "confirm", selected: [0, 2],
	});
});

test("grid navigation respects rows and bounds", () => {
	assert.equal(moveGridFocus(4, "ArrowUp", 3, 8), 1);
	assert.equal(moveGridFocus(4, "ArrowDown", 3, 8), 7);
	assert.equal(moveGridFocus(7, "ArrowRight", 3, 8), 7);
	assert.equal(moveGridFocus(0, "ArrowLeft", 3, 8), 0);
});

test("deadline display uses a server-provided epoch and stable formatting", () => {
	assert.equal(secondsRemaining(10_001, 9_000), 2);
	assert.equal(secondsRemaining(9_000, 10_000), 0);
	assert.equal(formatDuration(65), "01:05");
	assert.equal(formatDuration(3661), "01:01:01");
});
