import test from "node:test";
import assert from "node:assert/strict";

import { clampPan, exceedsDragThreshold, galleryScrollDelta, normalizeWheelDelta, panBy, resetZoom, shouldCaptureCardWheel, wheelZoomScale, zoomAt } from "../web/lib/zoom.js";

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

test("wheel zoom normalizes pixel, line, and page deltas", () => {
	assert.equal(normalizeWheelDelta(2, 1), 32);
	assert.equal(normalizeWheelDelta(2, 2, 600), 1200);
	assert.equal(wheelZoomScale(1, -16), wheelZoomScale(1, -1, 1));
	assert.equal(wheelZoomScale(1, -600), wheelZoomScale(1, -1, 2, 600));
	assert.ok(wheelZoomScale(2, -100) > 2);
	assert.ok(wheelZoomScale(2, 100) < 2);
	assert.equal(galleryScrollDelta(0, 2, 1), 32);
	assert.equal(galleryScrollDelta(100, 20), 100);
});

test("card zoom captures intentional wheel gestures and releases scrolling at both scale limits", () => {
	const event = { scale: 1, deltaX: 0, deltaY: -100, overImage: true, ctrlKey: false, metaKey: false, shiftKey: false };
	assert.equal(shouldCaptureCardWheel(event), true);
	assert.equal(shouldCaptureCardWheel({ ...event, overImage: false }), false);
	assert.equal(shouldCaptureCardWheel({ ...event, deltaY: 100 }), false);
	assert.equal(shouldCaptureCardWheel({ ...event, scale: 2, deltaY: 100, overImage: false }), true);
	assert.equal(shouldCaptureCardWheel({ ...event, scale: 8, deltaY: -100 }), false);
	assert.equal(shouldCaptureCardWheel({ ...event, scale: 8, deltaY: 100 }), true);
	assert.equal(shouldCaptureCardWheel({ ...event, ctrlKey: true }), false);
	assert.equal(shouldCaptureCardWheel({ ...event, shiftKey: true }), false);
	assert.equal(shouldCaptureCardWheel({ ...event, deltaX: 120 }), false);
});

test("drag intent starts only after the pointer clears the movement threshold", () => {
	assert.equal(exceedsDragThreshold({ x: 10, y: 10 }, { x: 13, y: 13 }), false);
	assert.equal(exceedsDragThreshold({ x: 10, y: 10 }, { x: 14, y: 13 }), true);
});
