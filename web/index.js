import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ensureI18n, t, tNodeOption } from "./i18n.js";
import { installNodeOptionLabels } from "./lib/node_options.js";
import { ImagePickerManager } from "./picker.js";

const STYLE_ID = "aaalice-image-picker-styles";
let manager;

function installStyles() {
	if (document.getElementById(STYLE_ID)) return;
	const link = document.createElement("link");
	link.id = STYLE_ID;
	link.rel = "stylesheet";
	link.href = new URL("./picker.css", import.meta.url).href;
	document.head.append(link);
}

function toast(detail, severity = "error") {
	app.extensionManager?.toast?.add?.({
		severity,
		summary: t("title"),
		detail,
		life: 5000,
	});
}

async function recoverSessions() {
	const clientId = api.clientId;
	if (!clientId) return;
	try {
		let response;
		try {
			response = await api.fetchApi(`/aaalice/image-picker/sessions?client_id=${encodeURIComponent(clientId)}`);
		} catch {
			throw new Error(t("error.network"));
		}
		let data;
		try {
			data = await response.json();
		} catch {
			throw new Error(t("error.invalid_response"));
		}
		if (!response.ok) throw new Error(t(`error.${data?.error?.code || "unknown"}`));
		if (!Array.isArray(data.sessions)) throw new Error(t("error.invalid_response"));
		manager.reconcile(data.sessions, clientId);
		if (data.sessions.length) toast(t("status.restored"), "info");
	} catch (error) {
		console.error("[Aaalice Image Picker] Session recovery failed", error);
		toast(error.message || t("error.network"));
	}
}

app.registerExtension({
	name: "ComfyUI.Aaalice.ImagePicker",

	nodeCreated(node) {
		if (installNodeOptionLabels(node, tNodeOption)) node.setDirtyCanvas(true, true);
	},

	async setup() {
		installStyles();
		await ensureI18n();
		manager = new ImagePickerManager({ onError: (message) => toast(message) });
		api.addEventListener("aaalice-image-picker-open", (event) => manager.open(event.detail, api.clientId));
		api.addEventListener("aaalice-image-picker-close", (event) => manager.close(event.detail?.session_id));
		api.addEventListener("reconnected", () => void recoverSessions());
		await recoverSessions();
	},
});
