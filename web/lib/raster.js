export const MAX_CANVAS_PIXELS = 8_388_608;
export const INTERACTIVE_CANVAS_PIXELS = 2_097_152;
export const MAX_CARD_CANVAS_PIXELS = MAX_CANVAS_PIXELS - INTERACTIVE_CANVAS_PIXELS;
export const MAX_CANVAS_DIMENSION = 16_384;

export function fitImage(naturalWidth, naturalHeight, viewportWidth, viewportHeight, allowUpscale = false) {
	const containedScale = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
	const scale = allowUpscale ? containedScale : Math.min(1, containedScale);
	return {
		scale,
		imageWidth: naturalWidth * scale,
		imageHeight: naturalHeight * scale,
	};
}

export function canvasBackingSize(viewportWidth, viewportHeight, devicePixelRatio = 1, maxPixels = MAX_CANVAS_PIXELS, maxDimension = MAX_CANVAS_DIMENSION) {
	const ratio = Math.min(
		devicePixelRatio,
		Math.sqrt(maxPixels / (viewportWidth * viewportHeight)),
		maxDimension / viewportWidth,
		maxDimension / viewportHeight,
	);
	return {
		width: Math.max(1, Math.floor(viewportWidth * ratio)),
		height: Math.max(1, Math.floor(viewportHeight * ratio)),
	};
}

export function sharedCanvasPixelBudget(totalPixels, itemCount) {
	return Math.floor(totalPixels / Math.max(1, itemCount));
}

export function shouldSmoothImage(region, scaleX, scaleY) {
	return region.destination.width * scaleX <= region.source.width && region.destination.height * scaleY <= region.source.height;
}

export function visibleImageRegion(naturalWidth, naturalHeight, state, bounds) {
	const displayWidth = bounds.imageWidth * state.scale;
	const displayHeight = bounds.imageHeight * state.scale;
	const left = (bounds.viewportWidth - displayWidth) / 2 + state.x;
	const top = (bounds.viewportHeight - displayHeight) / 2 + state.y;
	const right = left + displayWidth;
	const bottom = top + displayHeight;
	const clippedLeft = Math.max(0, left);
	const clippedTop = Math.max(0, top);
	const clippedRight = Math.min(bounds.viewportWidth, right);
	const clippedBottom = Math.min(bounds.viewportHeight, bottom);
	if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) return null;

	return {
		source: {
			x: (clippedLeft - left) / displayWidth * naturalWidth,
			y: (clippedTop - top) / displayHeight * naturalHeight,
			width: (clippedRight - clippedLeft) / displayWidth * naturalWidth,
			height: (clippedBottom - clippedTop) / displayHeight * naturalHeight,
		},
		destination: {
			x: clippedLeft,
			y: clippedTop,
			width: clippedRight - clippedLeft,
			height: clippedBottom - clippedTop,
		},
	};
}
