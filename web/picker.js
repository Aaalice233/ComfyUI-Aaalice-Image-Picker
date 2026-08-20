import { api } from "../../scripts/api.js";
import { t } from "./i18n.js";
import { renderSafeMarkdown } from "./lib/markdown.js";
import { SessionRegistry } from "./lib/session_registry.js";
import { buildDraftPayload, buildResponsePayload, formatDuration, moveGridFocus, secondsRemaining, selectAll, toggleSelection } from "./lib/state.js";
import { MAX_SCALE, MIN_SCALE, clampPan, exceedsDragThreshold, galleryScrollDelta, panBy, resetZoom, shouldCaptureCardWheel, wheelZoomScale, zoomAt } from "./lib/zoom.js";

const TERMINAL_SESSION_ERRORS = new Set(["session_not_found", "session_expired", "session_finished"]);

const ICONS = {
	check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5"/></svg>',
	expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5m13 5h5v-5"/></svg>',
	close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
	back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
	left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 18-6-6 6-6"/></svg>',
	right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>',
	plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
	minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
	reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V3m0 0h5M4 3l4 4a7 7 0 1 1-2 8"/></svg>',
	panel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM9 5v14"/></svg>',
};

function el(tag, className, attributes = {}) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	for (const [key, value] of Object.entries(attributes)) {
		if (value !== undefined) element.setAttribute(key, String(value));
	}
	return element;
}

function button(className, label, icon = "") {
	const element = el("button", className, { type: "button", "aria-label": label, title: label });
	if (icon) element.innerHTML = icon;
	else element.textContent = label;
	return element;
}

function imageUrl(descriptor) {
	const query = new URLSearchParams({
		filename: descriptor.filename,
		subfolder: descriptor.subfolder || "",
		type: descriptor.type || "temp",
	});
	return api.apiURL(`/view?${query}`);
}

async function request(path, payload) {
	let response;
	try {
		response = await api.fetchApi(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	} catch (error) {
		throw Object.assign(new Error(t("error.network")), { code: "network", cause: error });
	}
	let data;
	try {
		data = await response.json();
	} catch {
		throw Object.assign(new Error(t("error.invalid_response")), { code: "invalid_response" });
	}
	if (!response.ok) {
		const code = data?.error?.code || "unknown";
		const key = `error.${code}`;
		const localized = t(key);
		const message = localized === key ? t("error.unknown") : localized;
		throw Object.assign(new Error(message), { code, status: response.status });
	}
	return data;
}

function withLocalDeadline(payload) {
	return {
		...payload,
		local_deadline_epoch_ms: Number.isFinite(payload.remaining_ms) ? Date.now() + Math.max(0, payload.remaining_ms) : payload.deadline_epoch_ms,
	};
}

function focusable(root) {
	return [...root.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((item) => !item.hidden && !item.closest("[inert]") && item.getClientRects().length > 0);
}

export class ImagePickerModal {
	constructor(payload, clientId, callbacks = {}) {
		this.payload = payload;
		this.clientId = clientId;
		this.callbacks = callbacks;
		this.selected = [...payload.selected].sort((a, b) => a - b);
		this.revision = payload.revision || 0;
		this.focusedIndex = this.selected[0] ?? 0;
		this.previewIndex = null;
		this.zoom = resetZoom();
		this.bounds = null;
		this.cardViews = payload.images.map(() => ({ zoom: resetZoom(), bounds: null }));
		this.cardPointer = null;
		this.suppressedCardClick = null;
		this.previousFocus = document.activeElement;
		this.destroyed = false;
		this.busy = false;
		this.lastSecond = null;
		this.deadlineEpochMs = payload.local_deadline_epoch_ms ?? (Number.isFinite(payload.remaining_ms) ? Date.now() + Math.max(0, payload.remaining_ms) : payload.deadline_epoch_ms);
		this.abort = new AbortController();
		this.build();
	}

	build() {
		this.root = el("div", "aaip-backdrop");
		this.dialog = el("section", "aaip-dialog", { role: "dialog", "aria-modal": "true", "aria-label": t("aria.modal") });
		this.root.append(this.dialog);
		this.dialog.append(this.buildHeader(), this.buildContent(), this.buildFooter(), this.buildPreview());
		this.live = el("div", "aaip-sr-only", { "aria-live": "polite", "aria-atomic": "true", "aria-label": t("aria.live") });
		this.dialog.append(this.live);
		document.body.append(this.root);

		this.dialog.addEventListener("keydown", (event) => this.onKeyDown(event), { signal: this.abort.signal });
		window.addEventListener("resize", () => this.onResize(), { signal: this.abort.signal });
		this.timer = window.setInterval(() => this.updateTimer(), 250);
		this.updateTimer();
		this.renderSelection();
		requestAnimationFrame(() => this.cardButtons[this.focusedIndex]?.focus());
	}

	buildHeader() {
		const header = el("header", "aaip-header");
		this.header = header;
		const identity = el("div", "aaip-identity");
		const title = el("h1", "aaip-title");
		title.textContent = t("title");
		const mode = el("span", "aaip-mode");
		mode.textContent = t(`mode.${this.payload.selection_mode}`);
		identity.append(title, mode);

		const actions = el("div", "aaip-header-actions");
		if (this.payload.instructions.trim()) {
			this.panelToggle = button("aaip-icon-button", t("instructions.collapse"), ICONS.panel);
			this.panelToggle.setAttribute("aria-expanded", "true");
			this.panelToggle.addEventListener("click", () => this.toggleInstructions(), { signal: this.abort.signal });
			actions.append(this.panelToggle);
		}
		this.timeoutActionLabel = t(`timeoutAction.${this.payload.timeout_action}`);
		this.timerElement = el("div", "aaip-timer", { role: "timer", title: this.timeoutActionLabel });
		this.timerLabel = el("span", "aaip-timer-label");
		this.timerLabel.textContent = t("timer.label");
		this.timerValue = el("strong", "aaip-timer-value");
		this.timerElement.append(this.timerLabel, this.timerValue);
		actions.append(this.timerElement);
		header.append(identity, actions);
		return header;
	}

	buildContent() {
		this.content = el("div", `aaip-content${this.payload.instructions.trim() ? " aaip-has-instructions" : ""}`);
		if (this.payload.instructions.trim()) this.content.append(this.buildInstructions());
		const helpId = `aaip-gallery-help-${this.payload.session_id}`;
		this.galleryHelp = el("p", "aaip-sr-only", { id: helpId });
		this.galleryHelp.textContent = t("aria.galleryHelp");
		this.content.append(this.galleryHelp);
		this.gallery = el("div", `aaip-gallery aaip-count-${Math.min(this.payload.image_count, 5)}`, {
			role: "list",
			"aria-label": t("aria.gallery"),
			"aria-describedby": helpId,
		});
		this.cardButtons = [];
		this.cardImages = [];
		this.cardZoomValues = [];
		this.cards = this.payload.images.map((descriptor, index) => this.buildCard(descriptor, index));
		this.gallery.append(...this.cards);
		this.gallery.addEventListener("wheel", (event) => this.onGalleryWheel(event), { passive: false, signal: this.abort.signal });
		this.content.append(this.gallery);
		this.cardResizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) this.refreshCardBounds(Number(entry.target.dataset.aaipIndex));
		});
		this.cardButtons.forEach((item) => this.cardResizeObserver.observe(item));
		return this.content;
	}

	buildInstructions() {
		this.instructionsPanel = el("aside", "aaip-instructions", { "aria-label": t("aria.instructions") });
		const heading = el("h2", "aaip-instructions-title");
		heading.textContent = t("instructions.title");
		const body = el("div", "aaip-markdown");
		try {
			body.append(renderSafeMarkdown(this.payload.instructions));
		} catch (error) {
			console.error("[Aaalice Image Picker] Markdown render failed", error);
			body.classList.add("aaip-markdown-error");
			body.textContent = t("instructions.error");
		}
		this.instructionsPanel.append(heading, body);
		return this.instructionsPanel;
	}

	buildCard(descriptor, index) {
		const card = el("article", "aaip-card", { role: "listitem" });
		const select = el("button", "aaip-card-select", {
			type: "button",
			"aria-pressed": "false",
			"aria-label": t("aria.image", { number: index + 1 }),
			"aria-description": t("aria.cardZoom", { percent: 100 }),
			"data-aaip-index": index,
			tabindex: index === this.focusedIndex ? "0" : "-1",
		});
		const image = el("img", "aaip-thumbnail", { alt: "", loading: "lazy", decoding: "async", src: imageUrl(descriptor), draggable: "false" });
		const failed = el("span", "aaip-image-failed", { hidden: "" });
		failed.textContent = t("status.imageFailed");
		image.addEventListener("load", () => this.refreshCardBounds(index), { signal: this.abort.signal });
		image.addEventListener("error", () => { image.hidden = true; failed.hidden = false; }, { signal: this.abort.signal });
		const shade = el("span", "aaip-selection-shade", { "aria-hidden": "true" });
		shade.innerHTML = ICONS.check;
		const number = el("span", "aaip-image-number", { "aria-hidden": "true" });
		number.textContent = String(index + 1).padStart(2, "0");
		const zoomValue = el("span", "aaip-card-zoom-value", { "aria-hidden": "true", hidden: "" });
		const zoomCue = el("span", "aaip-card-zoom-cue", { "aria-hidden": "true" });
		zoomCue.textContent = t("cardZoom.hint");
		select.append(image, failed, shade, number, zoomValue, zoomCue);
		select.addEventListener("click", (event) => this.onCardClick(event, index), { signal: this.abort.signal });
		select.addEventListener("focus", () => { this.focusedIndex = index; this.updateRovingTabIndex(); }, { signal: this.abort.signal });
		select.addEventListener("wheel", (event) => this.onCardWheel(event, index), { passive: false, signal: this.abort.signal });
		select.addEventListener("pointerdown", (event) => this.onCardPointerDown(event, index), { signal: this.abort.signal });
		select.addEventListener("pointermove", (event) => this.onCardPointerMove(event), { signal: this.abort.signal });
		select.addEventListener("pointerup", (event) => this.onCardPointerUp(event), { signal: this.abort.signal });
		select.addEventListener("pointercancel", (event) => this.onCardPointerUp(event), { signal: this.abort.signal });
		select.addEventListener("lostpointercapture", (event) => this.onCardPointerCaptureLost(event), { signal: this.abort.signal });

		const expand = button("aaip-expand", t("button.enlarge"), ICONS.expand);
		expand.addEventListener("click", () => this.openPreview(index), { signal: this.abort.signal });
		card.append(select, expand);
		this.cardButtons[index] = select;
		this.cardImages[index] = image;
		this.cardZoomValues[index] = zoomValue;
		return card;
	}

	buildFooter() {
		const footer = el("footer", "aaip-footer");
		this.footer = footer;
		const summary = el("div", "aaip-summary");
		this.selectionCount = el("strong", "aaip-selection-count");
		const shortcut = el("span", "aaip-shortcut", { title: t("shortcut.gallery") });
		shortcut.textContent = t("shortcut.gallery");
		summary.append(this.selectionCount, shortcut);

		const actions = el("div", "aaip-footer-actions");
		if (this.payload.selection_mode === "multiple") {
			this.selectAllButton = button("aaip-button aaip-button-quiet", t("button.selectAll"));
			this.clearButton = button("aaip-button aaip-button-quiet", t("button.clear"));
			this.selectAllButton.addEventListener("click", () => this.setSelection(selectAll(this.payload.image_count, "multiple")), { signal: this.abort.signal });
			this.clearButton.addEventListener("click", () => this.setSelection([]), { signal: this.abort.signal });
			actions.append(this.selectAllButton, this.clearButton);
		}
		this.cancelButton = button("aaip-button aaip-button-secondary", t("button.cancel"));
		this.confirmButton = button("aaip-button aaip-button-primary", t("button.confirm"));
		this.cancelButton.addEventListener("click", () => void this.respond("cancel"), { signal: this.abort.signal });
		this.confirmButton.addEventListener("click", () => void this.respond("confirm"), { signal: this.abort.signal });
		actions.append(this.cancelButton, this.confirmButton);
		footer.append(summary, actions);
		return footer;
	}

	buildPreview() {
		this.preview = el("div", "aaip-preview", { role: "region", "aria-label": t("aria.preview"), hidden: "" });
		const toolbar = el("div", "aaip-preview-toolbar");
		this.previewBack = button("aaip-icon-button aaip-preview-back", t("button.back"), ICONS.back);
		this.previewPosition = el("strong", "aaip-preview-position");
		const controls = el("div", "aaip-preview-controls");
		this.previewPrevious = button("aaip-icon-button", t("button.previous"), ICONS.left);
		this.previewNext = button("aaip-icon-button", t("button.next"), ICONS.right);
		this.zoomOut = button("aaip-icon-button", t("button.zoomOut"), ICONS.minus);
		this.zoomValue = el("span", "aaip-zoom-value");
		this.zoomIn = button("aaip-icon-button", t("button.zoomIn"), ICONS.plus);
		this.zoomReset = button("aaip-icon-button", t("button.resetZoom"), ICONS.reset);
		this.previewSelect = button("aaip-button aaip-button-primary aaip-preview-select", t("button.selectCurrent"));
		controls.append(this.previewPrevious, this.previewNext, this.zoomOut, this.zoomValue, this.zoomIn, this.zoomReset, this.previewSelect);
		toolbar.append(this.previewBack, this.previewPosition, controls);

		this.previewStage = el("div", "aaip-preview-stage");
		this.previewLoading = el("span", "aaip-preview-loading");
		this.previewLoading.textContent = t("preview.loading");
		this.previewImage = el("img", "aaip-preview-image", { alt: "", draggable: "false" });
		this.previewStage.append(this.previewLoading, this.previewImage);
		const hint = el("div", "aaip-preview-hint");
		hint.textContent = t("shortcut.preview");
		this.preview.append(toolbar, this.previewStage, hint);

		this.previewBack.addEventListener("click", () => this.closePreview(), { signal: this.abort.signal });
		this.previewPrevious.addEventListener("click", () => this.changePreview(-1), { signal: this.abort.signal });
		this.previewNext.addEventListener("click", () => this.changePreview(1), { signal: this.abort.signal });
		this.zoomOut.addEventListener("click", () => this.zoomCentered(this.zoom.scale / 1.25), { signal: this.abort.signal });
		this.zoomIn.addEventListener("click", () => this.zoomCentered(this.zoom.scale * 1.25), { signal: this.abort.signal });
		this.zoomReset.addEventListener("click", () => this.resetPreviewZoom(), { signal: this.abort.signal });
		this.previewSelect.addEventListener("click", () => this.toggle(this.previewIndex), { signal: this.abort.signal });
		this.previewImage.addEventListener("load", () => this.fitPreview(), { signal: this.abort.signal });
		this.previewImage.addEventListener("error", () => { this.previewLoading.hidden = false; this.previewLoading.textContent = t("status.imageFailed"); }, { signal: this.abort.signal });
		this.previewStage.addEventListener("wheel", (event) => this.onWheel(event), { passive: false, signal: this.abort.signal });
		this.previewStage.addEventListener("pointerdown", (event) => this.onPointerDown(event), { signal: this.abort.signal });
		this.previewStage.addEventListener("pointermove", (event) => this.onPointerMove(event), { signal: this.abort.signal });
		this.previewStage.addEventListener("pointerup", (event) => this.onPointerUp(event), { signal: this.abort.signal });
		this.previewStage.addEventListener("pointercancel", (event) => this.onPointerUp(event), { signal: this.abort.signal });
		return this.preview;
	}

	toggleInstructions() {
		const collapsed = this.content.classList.toggle("aaip-instructions-collapsed");
		this.panelToggle.setAttribute("aria-expanded", String(!collapsed));
		this.panelToggle.setAttribute("aria-label", t(collapsed ? "instructions.expand" : "instructions.collapse"));
		this.panelToggle.title = t(collapsed ? "instructions.expand" : "instructions.collapse");
	}

	refreshCardBounds(index) {
		const view = this.cardViews[index];
		const select = this.cardButtons[index];
		const image = this.cardImages[index];
		if (!view || !select || !image?.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
		const style = getComputedStyle(select);
		const viewportWidth = Math.max(1, select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
		const viewportHeight = Math.max(1, select.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
		view.bounds = {
			viewportWidth,
			viewportHeight,
			imageWidth: Math.max(1, image.offsetWidth),
			imageHeight: Math.max(1, image.offsetHeight),
		};
		view.zoom = clampPan(view.zoom, view.bounds);
		this.updateCardZoomTransform(index);
	}

	onGalleryWheel(event) {
		if (!event.shiftKey || event.ctrlKey || event.metaKey) return;
		const delta = galleryScrollDelta(event.deltaX, event.deltaY, event.deltaMode, this.gallery.clientHeight);
		if (delta === 0) return;
		event.preventDefault();
		this.gallery.scrollTop += delta;
	}

	onCardWheel(event, index) {
		if (this.busy) return;
		const view = this.cardViews[index];
		if (!view.bounds) this.refreshCardBounds(index);
		if (!view.bounds) return;
		let overImage = true;
		if (view.zoom.scale <= MIN_SCALE) {
			const imageRect = this.cardImages[index].getBoundingClientRect();
			overImage = event.clientX >= imageRect.left && event.clientX <= imageRect.right && event.clientY >= imageRect.top && event.clientY <= imageRect.bottom;
		}
		if (!shouldCaptureCardWheel({
			scale: view.zoom.scale,
			deltaX: event.deltaX,
			deltaY: event.deltaY,
			overImage,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			shiftKey: event.shiftKey,
		})) return;

		event.preventDefault();
		const rect = this.cardButtons[index].getBoundingClientRect();
		const anchor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
		const scale = wheelZoomScale(view.zoom.scale, event.deltaY, event.deltaMode, view.bounds.viewportHeight);
		view.zoom = zoomAt(view.zoom, scale, anchor, view.bounds);
		this.updateCardZoomTransform(index);
	}

	onCardPointerDown(event, index) {
		if (this.busy || event.button !== 0 || this.cardViews[index].zoom.scale <= MIN_SCALE) return;
		if (this.cardPointer) {
			event.preventDefault();
			return;
		}
		window.clearTimeout(this.suppressedCardClickTimer);
		this.suppressedCardClick = null;
		this.cardPointer = {
			id: event.pointerId,
			index,
			start: { x: event.clientX, y: event.clientY },
			last: { x: event.clientX, y: event.clientY },
			moved: false,
		};
		this.cardButtons[index].setPointerCapture(event.pointerId);
	}

	onCardPointerMove(event) {
		const pointer = this.cardPointer;
		if (!pointer || pointer.id !== event.pointerId) return;
		const point = { x: event.clientX, y: event.clientY };
		if (!pointer.moved && !exceedsDragThreshold(pointer.start, point)) return;
		if (!pointer.moved) {
			pointer.moved = true;
			this.cards[pointer.index].classList.add("aaip-card-dragging");
		}
		event.preventDefault();
		const view = this.cardViews[pointer.index];
		view.zoom = panBy(view.zoom, { x: point.x - pointer.last.x, y: point.y - pointer.last.y }, view.bounds);
		pointer.last = point;
		this.applyCardZoomTransform(pointer.index);
	}

	onCardPointerUp(event) {
		const pointer = this.cardPointer;
		if (!pointer || pointer.id !== event.pointerId) return;
		this.clearCardPointer();
		if (this.cardButtons[pointer.index].hasPointerCapture(event.pointerId)) this.cardButtons[pointer.index].releasePointerCapture(event.pointerId);
		if (!pointer.moved || event.type !== "pointerup") return;
		this.suppressedCardClick = pointer.index;
		this.suppressedCardClickTimer = window.setTimeout(() => {
			if (this.suppressedCardClick === pointer.index) this.suppressedCardClick = null;
		}, 0);
	}

	onCardPointerCaptureLost(event) {
		if (this.cardPointer?.id === event.pointerId) this.clearCardPointer();
	}

	clearCardPointer() {
		if (!this.cardPointer) return;
		this.cards[this.cardPointer.index].classList.remove("aaip-card-dragging");
		this.cardPointer = null;
	}

	onCardClick(event, index) {
		if (this.suppressedCardClick === index) {
			event.preventDefault();
			window.clearTimeout(this.suppressedCardClickTimer);
			this.suppressedCardClick = null;
			return;
		}
		this.toggle(index);
	}

	zoomCardCentered(index, requestedScale, announce = false) {
		const view = this.cardViews[index];
		if (!view.bounds) this.refreshCardBounds(index);
		if (!view.bounds) return;
		view.zoom = zoomAt(view.zoom, requestedScale, { x: 0, y: 0 }, view.bounds);
		this.updateCardZoomTransform(index);
		if (announce) this.announce(t("cardZoom.changed", { percent: Math.round(view.zoom.scale * 100) }));
	}

	panCard(index, delta) {
		const view = this.cardViews[index];
		if (!view.bounds || view.zoom.scale <= MIN_SCALE) return;
		const previous = view.zoom;
		view.zoom = panBy(view.zoom, delta, view.bounds);
		this.applyCardZoomTransform(index);
		if (view.zoom.x !== previous.x || view.zoom.y !== previous.y) this.announce(t("cardZoom.panned"));
	}

	resetCardZoom(index, announce = false) {
		const view = this.cardViews[index];
		if (!view || view.zoom.scale === MIN_SCALE) return;
		view.zoom = resetZoom();
		this.updateCardZoomTransform(index);
		if (announce) this.announce(t("cardZoom.changed", { percent: 100 }));
	}

	applyCardZoomTransform(index) {
		const view = this.cardViews[index];
		const image = this.cardImages[index];
		if (!view || !image) return;
		image.style.transform = `translate3d(${view.zoom.x}px, ${view.zoom.y}px, 0) scale(${view.zoom.scale})`;
	}

	updateCardZoomTransform(index) {
		const view = this.cardViews[index];
		if (!view || !this.cardImages[index]) return;
		const zoomed = view.zoom.scale > MIN_SCALE;
		const percent = Math.round(view.zoom.scale * 100);
		this.applyCardZoomTransform(index);
		this.cards[index].classList.toggle("aaip-card-zoomed", zoomed);
		this.cardZoomValues[index].hidden = !zoomed;
		this.cardZoomValues[index].textContent = t("cardZoom.value", { number: String(index + 1).padStart(2, "0"), percent });
		this.cardButtons[index].setAttribute("aria-description", t("aria.cardZoom", { percent }));
	}

	toggle(index) {
		if (index == null || this.busy) return;
		const wasSelected = this.selected.includes(index);
		this.setSelection(toggleSelection(this.selected, index, this.payload.selection_mode));
		this.announce(t(wasSelected ? "selection.deselected" : "selection.selected", { number: index + 1 }));
	}

	setSelection(selected) {
		this.selected = selected;
		this.revision += 1;
		this.renderSelection();
		this.scheduleDraft();
	}

	renderSelection() {
		const selectedSet = new Set(this.selected);
		this.cards.forEach((card, index) => {
			const active = selectedSet.has(index);
			card.classList.toggle("aaip-selected", active);
			this.cardButtons[index].setAttribute("aria-pressed", String(active));
			this.cardButtons[index].setAttribute("aria-label", t(active ? "aria.selectedImage" : "aria.image", { number: index + 1 }));
		});
		this.selectionCount.textContent = this.selected.length
			? t("selection.count", { count: this.selected.length, total: this.payload.image_count })
			: t("selection.none");
		this.confirmButton.disabled = this.busy || this.selected.length === 0;
		if (this.clearButton) this.clearButton.disabled = this.busy || this.selected.length === 0;
		if (this.selectAllButton) this.selectAllButton.disabled = this.busy || this.selected.length === this.payload.image_count;
		if (this.previewIndex != null) this.updatePreviewSelection();
	}

	scheduleDraft() {
		window.clearTimeout(this.draftTimer);
		const revision = this.revision;
		const selected = [...this.selected];
		this.draftTimer = window.setTimeout(async () => {
			try {
				await request("/aaalice/image-picker/draft", buildDraftPayload(this.payload.session_id, this.clientId, revision, selected));
			} catch (error) {
				if (TERMINAL_SESSION_ERRORS.has(error.code)) {
					if (!this.destroyed && !this.busy) this.reportError(error);
					this.callbacks.finished?.(this.payload.session_id);
				} else if (error.code !== "stale_revision" && !this.busy && !this.destroyed) this.reportError(error);
			}
		}, 60);
	}

	async respond(action) {
		if (this.busy || (action === "confirm" && this.selected.length === 0)) return;
		this.busy = true;
		window.clearTimeout(this.draftTimer);
		this.setControlsDisabled(true);
		this.announce(t(action === "confirm" ? "status.submitting" : "status.cancelling"));
		try {
			await request("/aaalice/image-picker/respond", buildResponsePayload(this.payload.session_id, this.clientId, action, this.selected));
			this.callbacks.finished?.(this.payload.session_id);
		} catch (error) {
			if (TERMINAL_SESSION_ERRORS.has(error.code)) {
				this.reportError(error);
				this.callbacks.finished?.(this.payload.session_id);
				return;
			}
			this.busy = false;
			this.setControlsDisabled(false);
			this.renderSelection();
			this.reportError(error);
		}
	}

	setControlsDisabled(disabled) {
		for (const control of this.dialog.querySelectorAll("button")) control.disabled = disabled;
	}

	reportError(error) {
		console.error("[Aaalice Image Picker]", error);
		this.announce(error.message || t("error.unknown"));
		this.callbacks.error?.(error.message || t("error.unknown"));
	}

	updateTimer() {
		const seconds = secondsRemaining(this.deadlineEpochMs);
		if (seconds === this.lastSecond) return;
		const previousSecond = this.lastSecond;
		this.lastSecond = seconds;
		const time = formatDuration(seconds);
		this.timerValue.textContent = time;
		this.timerElement.setAttribute("aria-label", t("aria.countdown", { time, action: this.timeoutActionLabel }));
		this.timerElement.classList.toggle("aaip-timer-urgent", seconds > 0 && seconds <= 10);
		if (seconds === 0) {
			this.timerLabel.textContent = t("timer.expired");
			if (previousSecond !== 0) this.announce(t("timer.expired"));
		} else if (seconds <= 10) {
			this.timerLabel.textContent = t("timer.urgent");
			if (previousSecond == null || previousSecond > 10) this.announce(`${t("timer.urgent")}: ${time}`);
		} else {
			this.timerLabel.textContent = t("timer.label");
		}
	}

	updateRovingTabIndex() {
		this.cardButtons.forEach((item, index) => { item.tabIndex = index === this.focusedIndex ? 0 : -1; });
	}

	onKeyDown(event) {
		if (event.key === "Tab") {
			const items = focusable(this.dialog);
			if (!items.length) return;
			const first = items[0];
			const last = items.at(-1);
			if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
			return;
		}
		if (this.previewIndex != null) {
			this.onPreviewKeyDown(event);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			void this.respond("cancel");
			return;
		}
		if (!this.cardButtons.includes(document.activeElement)) return;
		const arrowKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
		if (event.shiftKey && arrowKeys.includes(event.key) && this.cardViews[this.focusedIndex].zoom.scale > MIN_SCALE) {
			event.preventDefault();
			const delta = {
				ArrowLeft: { x: 48, y: 0 },
				ArrowRight: { x: -48, y: 0 },
				ArrowUp: { x: 0, y: 48 },
				ArrowDown: { x: 0, y: -48 },
			}[event.key];
			this.panCard(this.focusedIndex, delta);
		} else if (arrowKeys.includes(event.key)) {
			event.preventDefault();
			const columns = Math.max(1, Math.round(this.gallery.clientWidth / this.cards[0].getBoundingClientRect().width));
			this.focusedIndex = moveGridFocus(this.focusedIndex, event.key, columns, this.cards.length);
			this.updateRovingTabIndex();
			this.cardButtons[this.focusedIndex].focus();
		} else if (event.key === " ") {
			event.preventDefault();
			this.toggle(this.focusedIndex);
		} else if (event.key === "Enter") {
			event.preventDefault();
			this.openPreview(this.focusedIndex);
		} else if (event.key === "+" || event.key === "=") {
			event.preventDefault();
			this.zoomCardCentered(this.focusedIndex, this.cardViews[this.focusedIndex].zoom.scale * 1.25, true);
		} else if (event.key === "-") {
			event.preventDefault();
			this.zoomCardCentered(this.focusedIndex, this.cardViews[this.focusedIndex].zoom.scale / 1.25, true);
		} else if (event.key === "0") {
			event.preventDefault();
			this.resetCardZoom(this.focusedIndex, true);
		}
	}

	onPreviewKeyDown(event) {
		if (event.key === "Escape") { event.preventDefault(); this.closePreview(); }
		else if (event.key === "ArrowLeft") { event.preventDefault(); this.changePreview(-1); }
		else if (event.key === "ArrowRight") { event.preventDefault(); this.changePreview(1); }
		else if (event.key === " ") { event.preventDefault(); this.toggle(this.previewIndex); }
		else if (event.key === "+" || event.key === "=") { event.preventDefault(); this.zoomCentered(this.zoom.scale * 1.25); }
		else if (event.key === "-") { event.preventDefault(); this.zoomCentered(this.zoom.scale / 1.25); }
		else if (event.key === "0") { event.preventDefault(); this.resetPreviewZoom(); }
	}

	openPreview(index) {
		this.previewIndex = index;
		this.preview.hidden = false;
		for (const element of [this.header, this.content, this.footer]) element.inert = true;
		this.dialog.classList.add("aaip-preview-open");
		this.loadPreviewImage();
		this.previewBack.focus();
	}

	closePreview() {
		if (this.previewIndex == null) return;
		const index = this.previewIndex;
		this.previewIndex = null;
		this.preview.hidden = true;
		for (const element of [this.header, this.content, this.footer]) element.inert = false;
		this.dialog.classList.remove("aaip-preview-open");
		this.cardButtons[index]?.focus();
	}

	changePreview(delta) {
		this.previewIndex = (this.previewIndex + delta + this.payload.image_count) % this.payload.image_count;
		this.loadPreviewImage();
	}

	loadPreviewImage() {
		this.zoom = resetZoom();
		this.bounds = null;
		this.previewImage.classList.remove("aaip-loaded");
		this.previewLoading.hidden = false;
		this.previewLoading.textContent = t("preview.loading");
		this.previewImage.removeAttribute("style");
		this.previewImage.src = imageUrl(this.payload.images[this.previewIndex]);
		this.previewPosition.textContent = t("preview.position", { number: this.previewIndex + 1, total: this.payload.image_count });
		this.updatePreviewSelection();
		this.updateZoomTransform();
	}

	fitPreview() {
		if (this.previewIndex == null) return;
		const rect = this.previewStage.getBoundingClientRect();
		const fit = Math.min(rect.width / this.previewImage.naturalWidth, rect.height / this.previewImage.naturalHeight);
		const width = Math.max(1, this.previewImage.naturalWidth * fit);
		const height = Math.max(1, this.previewImage.naturalHeight * fit);
		this.previewImage.style.width = `${width}px`;
		this.previewImage.style.height = `${height}px`;
		this.bounds = { viewportWidth: rect.width, viewportHeight: rect.height, imageWidth: width, imageHeight: height };
		this.zoom = resetZoom();
		this.previewLoading.hidden = true;
		this.previewImage.classList.add("aaip-loaded");
		this.updateZoomTransform();
	}

	updatePreviewSelection() {
		const active = this.selected.includes(this.previewIndex);
		const label = t(active ? "button.deselectCurrent" : "button.selectCurrent");
		this.previewSelect.textContent = label;
		this.previewSelect.setAttribute("aria-label", label);
		this.previewSelect.title = label;
		this.previewSelect.classList.toggle("aaip-current-selected", active);
	}

	zoomCentered(scale) {
		if (!this.bounds) return;
		this.zoom = zoomAt(this.zoom, scale, { x: 0, y: 0 }, this.bounds);
		this.updateZoomTransform();
	}

	resetPreviewZoom() {
		this.zoom = resetZoom();
		this.updateZoomTransform();
	}

	onWheel(event) {
		if (!this.bounds) return;
		event.preventDefault();
		const rect = this.previewStage.getBoundingClientRect();
		const anchor = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
		const scale = wheelZoomScale(this.zoom.scale, event.deltaY, event.deltaMode, this.bounds.viewportHeight);
		this.zoom = zoomAt(this.zoom, scale, anchor, this.bounds);
		this.updateZoomTransform();
	}

	onPointerDown(event) {
		if (!this.bounds || this.zoom.scale <= MIN_SCALE || event.button !== 0) return;
		this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
		this.previewStage.setPointerCapture(event.pointerId);
		this.previewStage.classList.add("aaip-dragging");
	}

	onPointerMove(event) {
		if (!this.pointer || this.pointer.id !== event.pointerId || !this.bounds) return;
		const delta = { x: event.clientX - this.pointer.x, y: event.clientY - this.pointer.y };
		this.pointer.x = event.clientX;
		this.pointer.y = event.clientY;
		this.zoom = panBy(this.zoom, delta, this.bounds);
		this.updateZoomTransform();
	}

	onPointerUp(event) {
		if (!this.pointer || this.pointer.id !== event.pointerId) return;
		this.pointer = null;
		this.previewStage.classList.remove("aaip-dragging");
	}

	updateZoomTransform() {
		this.previewImage.style.transform = `translate3d(calc(-50% + ${this.zoom.x}px), calc(-50% + ${this.zoom.y}px), 0) scale(${this.zoom.scale})`;
		this.zoomValue.textContent = t("preview.zoom", { percent: Math.round(this.zoom.scale * 100) });
		this.zoomOut.disabled = this.busy || this.zoom.scale <= MIN_SCALE;
		this.zoomIn.disabled = this.busy || this.zoom.scale >= MAX_SCALE;
		this.zoomReset.disabled = this.busy || this.zoom.scale === MIN_SCALE;
		this.previewStage?.classList.toggle("aaip-can-drag", this.zoom.scale > MIN_SCALE);
	}

	onResize() {
		this.cardViews.forEach((_, index) => this.refreshCardBounds(index));
		if (this.previewIndex != null && this.previewImage.complete && this.previewImage.naturalWidth > 0 && this.previewImage.naturalHeight > 0) this.fitPreview();
	}

	announce(message) {
		this.live.textContent = "";
		requestAnimationFrame(() => { if (!this.destroyed) this.live.textContent = message; });
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		window.clearInterval(this.timer);
		window.clearTimeout(this.draftTimer);
		window.clearTimeout(this.suppressedCardClickTimer);
		this.cardResizeObserver?.disconnect();
		this.abort.abort();
		this.root.remove();
		if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected) this.previousFocus.focus();
	}
}

export class ImagePickerManager {
	constructor({ onError } = {}) {
		this.registry = new SessionRegistry();
		this.active = null;
		this.onError = onError;
	}

	open(payload, clientId) {
		const localized = withLocalDeadline(payload);
		if (!this.registry.open(localized)) return;
		if (!this.active) this.show(localized, clientId);
	}

	reconcile(payloads, clientId) {
		const localized = payloads.map(withLocalDeadline);
		const removed = this.registry.reconcile(localized);
		const refreshedActive = this.active && localized.find((payload) => payload.session_id === this.active.payload.session_id);
		if (refreshedActive) {
			this.active.deadlineEpochMs = refreshedActive.local_deadline_epoch_ms;
			this.active.payload.deadline_epoch_ms = refreshedActive.deadline_epoch_ms;
			this.active.payload.remaining_ms = refreshedActive.remaining_ms;
		}
		if (this.active && removed.includes(this.active.payload.session_id)) {
			this.active.destroy();
			this.active = null;
		}
		if (!this.active) {
			const next = this.registry.next();
			if (next) this.show(next, clientId);
		}
	}

	show(payload, clientId) {
		this.active = new ImagePickerModal(payload, clientId, {
			finished: (sessionId) => this.close(sessionId),
			error: (message) => this.onError?.(message),
		});
	}

	close(sessionId) {
		this.registry.close(sessionId);
		if (this.active?.payload.session_id !== sessionId) return;
		this.active.destroy();
		this.active = null;
		const next = this.registry.next();
		if (next) this.show(next, api.clientId);
	}

	destroy() {
		this.active?.destroy();
		this.active = null;
		this.registry.clear();
	}
}
