import test from "node:test";
import assert from "node:assert/strict";

import { clampPan, panBy, resetZoom, zoomAt } from "../web/lib/zoom.js";

const bounds = { viewportWidth: 800, viewportHeight: 600, imageWidth: 800, imageHeight: 400 };

test("cursor-anchored zoom preserves the image coordinate under the pointer", () => {
	const initial = resetZoom();
	const anchor = { x: 180, y: 80 };
	const zoomed = zoomAt(initial, 2, anchor, bounds);
	const beforeX = (anchor.x - initial.x) / initial.scale;
	const beforeY = (anchor.y - initial.y) / initial.scale;
	const afterX = (anchor.x - zoomed.x) / zoomed.scale;
	const afterY = (anchor.y - zoomed.y) / zoomed.scale;
	assert.equal(afterX, beforeX);
	assert.equal(afterY, beforeY);
});

test("zoom and pan are clamped to scale and visible boundaries", () => {
	assert.deepEqual(zoomAt(resetZoom(), 99, { x: 0, y: 0 }, bounds), { scale: 8, x: 0, y: 0 });
	assert.deepEqual(panBy({ scale: 2, x: 0, y: 0 }, { x: 9999, y: -9999 }, bounds), { scale: 2, x: 400, y: -100 });
	assert.deepEqual(clampPan({ scale: 1, x: 30, y: 30 }, bounds), resetZoom());
});
