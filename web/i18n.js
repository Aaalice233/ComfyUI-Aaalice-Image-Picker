import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const EN = {
	title: "Choose images",
	mode: { single: "Single selection", multiple: "Multiple selection" },
	timer: { label: "Time remaining", urgent: "Time is running out", expired: "Applying timeout action…" },
	timeoutAction: { cancel: "Cancel execution", submit_selected: "Submit current selection", submit_all: "Submit all images", submit_first: "Submit first image", submit_last: "Submit last image" },
	instructions: { title: "Instructions", expand: "Show instructions", collapse: "Hide instructions", error: "The Markdown instructions could not be rendered safely." },
	button: { selectAll: "Select all", clear: "Clear", cancel: "Cancel", confirm: "Confirm selection", back: "Back to gallery", previous: "Previous image", next: "Next image", zoomIn: "Zoom in", zoomOut: "Zoom out", resetZoom: "Reset zoom", selectCurrent: "Select current image", deselectCurrent: "Deselect current image", enlarge: "Open large preview" },
	selection: { count: "{count} of {total} selected", none: "No images selected", selected: "Image {number} selected", deselected: "Image {number} deselected" },
	preview: { position: "Image {number} of {total}", zoom: "{percent}%", loading: "Loading full preview…" },
	cardZoom: { value: "{number} · {percent}%", hint: "Wheel to zoom", changed: "Card zoom {percent}%", panned: "Image view moved" },
	status: { loading: "Loading image picker…", empty: "No images are available.", waiting: "Waiting for your selection", submitting: "Submitting selection…", cancelling: "Cancelling execution…", done: "Selection completed", restored: "Active selection restored", imageFailed: "The image preview could not be loaded." },
	shortcut: { gallery: "Wheel zooms · Drag pans · Shift+wheel scrolls the gallery · Arrow keys move · Shift+arrows pan · Space selects · Enter previews · +/- zoom · 0 resets · Esc cancels", preview: "←/→ switch · Space selects · +/- zoom · 0 resets · Esc returns" },
	aria: { modal: "Image selection dialog", gallery: "Images available for selection", galleryHelp: "On a card, use the wheel or plus and minus keys to zoom, Shift plus arrow keys to pan, zero to reset, Shift plus wheel to scroll the gallery, Space to select, and Enter for the large preview.", countdown: "Time remaining: {time}. On timeout: {action}.", image: "Image {number}", selectedImage: "Image {number}, selected", cardZoom: "Zoom {percent}%.", instructions: "Markdown instructions", preview: "Large image preview", live: "Image picker status" },
	error: { network: "The request failed. Check the ComfyUI connection and try again.", session_not_found: "This selection session no longer exists.", session_expired: "This selection session has expired.", session_finished: "This selection session has already finished.", invalid_session_id: "The selection session ID is invalid.", client_mismatch: "This selection belongs to another ComfyUI client.", client_required: "A ComfyUI client ID is required.", stale_revision: "A newer selection has already reached the server.", invalid_revision: "The selection revision is invalid.", invalid_selection: "The selected image indexes are invalid.", duplicate_selection: "The selection contains duplicate image indexes.", selection_out_of_range: "A selected image index is out of range.", single_selection_required: "Single mode accepts only one image.", invalid_action: "The requested picker action is invalid.", invalid_json: "The server could not read the request.", invalid_response: "The server returned an invalid response.", unknown: "The image picker encountered an unexpected error." },
};

let catalog = null;
let loadPromise = null;

function locale() {
	const value = String(app.extensionManager?.setting?.get?.("Comfy.Locale") || "en").toLowerCase();
	if (["zh-tw", "zh-hk", "zh-mo", "zh-hant"].includes(value) || value.startsWith("zh-hant-")) return "zh-TW";
	if (value === "zh" || value === "zh-cn" || value === "zh-hans" || value.startsWith("zh-hans-")) return "zh";
	return "en";
}

function read(root, path) {
	return path.split(".").reduce((value, part) => value && typeof value === "object" ? value[part] : undefined, root);
}

export async function ensureI18n() {
	if (catalog) return;
	if (!loadPromise) {
		loadPromise = (async () => {
			try {
				catalog = typeof api.getCustomNodesI18n === "function"
					? await api.getCustomNodesI18n()
					: await (await api.fetchApi("/i18n")).json();
			} catch (error) {
				console.warn("[Aaalice Image Picker] i18n load failed", error);
				catalog = {};
			}
		})();
	}
	await loadPromise;
}

export function t(path, values = {}) {
	const language = locale();
	const roots = [catalog?.[language]?.aaaliceImagePicker, language === "zh-TW" ? catalog?.zh?.aaaliceImagePicker : null, catalog?.en?.aaaliceImagePicker, EN];
	const text = roots.map((root) => read(root, path)).find((value) => typeof value === "string") || path;
	return text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

export function tNodeOption(inputName, value) {
	const language = locale();
	const path = `nodeDefs.AaaliceImagePicker.inputs.${inputName}.options.${value}`;
	const roots = [catalog?.[language], language === "zh-TW" ? catalog?.zh : null, catalog?.en];
	return roots.map((root) => read(root, path)).find((label) => typeof label === "string") || value;
}
