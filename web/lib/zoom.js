export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

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

export function resetZoom() {
	return { scale: 1, x: 0, y: 0 };
}
