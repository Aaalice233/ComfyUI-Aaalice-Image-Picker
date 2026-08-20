export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
export const DRAG_THRESHOLD = 5;
const WHEEL_ZOOM_RATE = 0.0015;

export function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

export function clampPan(state, bounds) {
	const overflowX = Math.max(0, (bounds.imageWidth * state.scale - bounds.viewportWidth) / 2);
	const overflowY = Math.max(0, (bounds.imageHeight * state.scale - bounds.viewportHeight) / 2);
	return {
		scale: clamp(state.scale, MIN_SCALE, MAX_SCALE),
		x: clamp(state.x, -overflowX, overflowX),
		y: clamp(state.y, -overflowY, overflowY),
	};
}

export function zoomAt(state, requestedScale, anchor, bounds) {
	const scale = clamp(requestedScale, MIN_SCALE, MAX_SCALE);
	const ratio = scale / state.scale;
	return clampPan({
		scale,
		x: anchor.x - (anchor.x - state.x) * ratio,
		y: anchor.y - (anchor.y - state.y) * ratio,
	}, bounds);
}

export function panBy(state, delta, bounds) {
	return clampPan({ scale: state.scale, x: state.x + delta.x, y: state.y + delta.y }, bounds);
}

export function normalizeWheelDelta(delta, deltaMode = 0, viewportHeight = 800) {
	return deltaMode === 1 ? delta * 16 : deltaMode === 2 ? delta * viewportHeight : delta;
}

export function wheelZoomScale(scale, deltaY, deltaMode = 0, viewportHeight = 800) {
	return scale * Math.exp(-normalizeWheelDelta(deltaY, deltaMode, viewportHeight) * WHEEL_ZOOM_RATE);
}

export function galleryScrollDelta(deltaX, deltaY, deltaMode = 0, viewportHeight = 800) {
	const dominantDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
	return normalizeWheelDelta(dominantDelta, deltaMode, viewportHeight);
}

export function shouldCaptureCardWheel({ scale, deltaX, deltaY, overImage, ctrlKey, metaKey, shiftKey }) {
	if (ctrlKey || metaKey || shiftKey || deltaY === 0 || Math.abs(deltaX) > Math.abs(deltaY)) return false;
	if ((scale <= MIN_SCALE && deltaY > 0) || (scale >= MAX_SCALE && deltaY < 0)) return false;
	return scale > MIN_SCALE || overImage;
}

export function exceedsDragThreshold(start, point, threshold = DRAG_THRESHOLD) {
	return Math.hypot(point.x - start.x, point.y - start.y) >= threshold;
}

export function resetZoom() {
	return { scale: 1, x: 0, y: 0 };
}
