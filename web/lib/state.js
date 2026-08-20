export function normalizeSelection(selected) {
	return [...new Set(selected)].sort((a, b) => a - b);
}

export function toggleSelection(selected, index, mode) {
	if (mode === "single") return selected.includes(index) ? [] : [index];
	return normalizeSelection(selected.includes(index) ? selected.filter((value) => value !== index) : [...selected, index]);
}

export function selectAll(count, mode) {
	return mode === "single" || count < 1 ? [] : Array.from({ length: count }, (_, index) => index);
}

export function moveGridFocus(index, key, columns, count) {
	if (count < 1) return -1;
	const safeIndex = Math.min(Math.max(index, 0), count - 1);
	const step = Math.max(1, columns);
	if (key === "ArrowLeft") return Math.max(0, safeIndex - 1);
	if (key === "ArrowRight") return Math.min(count - 1, safeIndex + 1);
	if (key === "ArrowUp") return Math.max(0, safeIndex - step);
	if (key === "ArrowDown") return Math.min(count - 1, safeIndex + step);
	return safeIndex;
}

export function secondsRemaining(deadlineEpochMs, now = Date.now()) {
	return Math.max(0, Math.ceil((deadlineEpochMs - now) / 1000));
}

export function formatDuration(seconds) {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	return hours > 0
		? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
		: `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function buildDraftPayload(sessionId, clientId, revision, selected) {
	return { session_id: sessionId, client_id: clientId, revision, selected: normalizeSelection(selected) };
}

export function buildResponsePayload(sessionId, clientId, action, selected = []) {
	return { session_id: sessionId, client_id: clientId, action, selected: normalizeSelection(selected) };
}
