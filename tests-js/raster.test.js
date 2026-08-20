import test from "node:test";
import assert from "node:assert/strict";

import { INTERACTIVE_CANVAS_PIXELS, MAX_CANVAS_DIMENSION, MAX_CANVAS_PIXELS, MAX_CARD_CANVAS_PIXELS, canvasBackingSize, fitImage, sharedCanvasPixelBudget, shouldSmoothImage, visibleImageRegion } from "../web/lib/raster.js";

test("fit size preserves native pixels unless an explicit preview may upscale", () => {
	assert.deepEqual(fitImage(4000, 2000, 400, 300), { scale: 0.1, imageWidth: 400, imageHeight: 200 });
	assert.deepEqual(fitImage(100, 50, 400, 300), { scale: 1, imageWidth: 100, imageHeight: 50 });
	assert.deepEqual(fitImage(100, 50, 400, 300, true), { scale: 4, imageWidth: 400, imageHeight: 200 });
});

test("canvas backing size follows the display without crossing area or dimension limits", () => {
	assert.deepEqual(canvasBackingSize(400, 300, 3), { width: 1200, height: 900 });
	const fourK = canvasBackingSize(3840, 2160, 2);
	assert.ok(fourK.width * fourK.height <= MAX_CANVAS_PIXELS);
	const fractionalBudget = canvasBackingSize(420, 4994, 2);
	assert.ok(fractionalBudget.width * fractionalBudget.height <= MAX_CANVAS_PIXELS);
	const ultraWide = canvasBackingSize(20_000, 1, 1);
	assert.ok(ultraWide.width <= MAX_CANVAS_DIMENSION);
	assert.ok(ultraWide.width * ultraWide.height <= MAX_CANVAS_PIXELS);
});

test("visible card canvases share one aggregate pixel budget with headroom for a new interactive card", () => {
	const perCard = sharedCanvasPixelBudget(MAX_CARD_CANVAS_PIXELS, 7);
	assert.ok(perCard * 7 <= MAX_CARD_CANVAS_PIXELS);
	assert.ok(perCard * 7 + INTERACTIVE_CANVAS_PIXELS <= MAX_CANVAS_PIXELS);
	assert.equal(sharedCanvasPixelBudget(MAX_CARD_CANVAS_PIXELS, 0), MAX_CARD_CANVAS_PIXELS);
});

test("pixel inspection smooths downscaling but never blurs pixels beyond native resolution", () => {
	const region = { source: { width: 800, height: 600 }, destination: { width: 400, height: 300 } };
	assert.equal(shouldSmoothImage(region, 1, 1), true);
	assert.equal(shouldSmoothImage(region, 2, 2), true);
	assert.equal(shouldSmoothImage(region, 3, 3), false);
});

test("visible region samples only the original pixels shown in the viewport", () => {
	const bounds = { viewportWidth: 400, viewportHeight: 300, imageWidth: 400, imageHeight: 200 };
	const centered = visibleImageRegion(4000, 2000, { scale: 8, x: 0, y: 0 }, bounds);
	assert.deepEqual(centered, {
		source: { x: 1750, y: 812.5, width: 500, height: 375 },
		destination: { x: 0, y: 0, width: 400, height: 300 },
	});

	const panned = visibleImageRegion(4000, 2000, { scale: 8, x: 400, y: 0 }, bounds);
	assert.equal(panned.source.x, 1250);
	assert.equal(panned.source.width, 500);
});
