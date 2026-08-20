import DOMPurify from "../vendor/purify.es.js";
import { marked } from "../vendor/marked.esm.js";

const ALLOWED_TAGS = [
	"a", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
	"img", "input", "li", "ol", "p", "pre", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul",
];
const ALLOWED_ATTR = ["align", "alt", "checked", "disabled", "href", "rel", "src", "start", "target", "title", "type"];

export function isSafeUrl(value, base = globalThis.location?.href || "http://localhost/") {
	try {
		const parsed = new URL(String(value || ""), base);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

export function isSafeSameOriginUrl(value, base = globalThis.location?.href || "http://localhost/") {
	try {
		const parsed = new URL(String(value || ""), base);
		const origin = new URL(base).origin;
		return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin === origin;
	} catch {
		return false;
	}
}

export function parseMarkdown(markdown) {
	return marked.parse(String(markdown || ""), { gfm: true, breaks: false });
}

export function renderSafeMarkdown(markdown) {
	const sanitized = DOMPurify.sanitize(parseMarkdown(markdown), {
		ALLOWED_ATTR,
		ALLOWED_TAGS,
		ALLOW_DATA_ATTR: false,
		ALLOW_UNKNOWN_PROTOCOLS: false,
	});
	const template = document.createElement("template");
	template.innerHTML = sanitized;
	for (const link of template.content.querySelectorAll("a[href]")) {
		if (!isSafeUrl(link.getAttribute("href"))) link.removeAttribute("href");
	}
	for (const image of template.content.querySelectorAll("img[src]")) {
		if (!isSafeSameOriginUrl(image.getAttribute("src"))) image.removeAttribute("src");
	}
	for (const input of template.content.querySelectorAll("input")) {
		if (input.type !== "checkbox") input.remove();
		else {
			input.disabled = true;
			input.tabIndex = -1;
		}
	}
	for (const link of template.content.querySelectorAll("a[href]")) {
		link.target = "_blank";
		link.rel = "noopener noreferrer";
	}
	for (const image of template.content.querySelectorAll("img[src]")) {
		image.loading = "lazy";
		image.decoding = "async";
		image.referrerPolicy = "no-referrer";
	}
	return template.content;
}
