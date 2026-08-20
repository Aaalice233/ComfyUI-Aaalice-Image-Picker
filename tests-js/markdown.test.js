import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { isSafeSameOriginUrl, isSafeUrl, parseMarkdown } from "../web/lib/markdown.js";

test("marked renders GFM tables, task lists, strikethrough, links, and images", () => {
	const html = parseMarkdown("- [x] done\n\n~~old~~\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[link](https://example.com) ![image](https://example.com/a.png)");
	assert.match(html, /type="checkbox"/);
	assert.match(html, /<del>old<\/del>/);
	assert.match(html, /<table>/);
	assert.match(html, /href="https:\/\/example.com"/);
	assert.match(html, /<img src="https:\/\/example.com\/a.png"/);
});

test("URL policy separates active links from same-origin images", () => {
	assert.equal(isSafeUrl("javascript:alert(1)"), false);
	assert.equal(isSafeUrl("data:text/html,test"), false);
	assert.equal(isSafeUrl("https://example.com"), true);
	assert.equal(isSafeSameOriginUrl("/view?filename=a.png", "http://localhost:8188/app/"), true);
	assert.equal(isSafeSameOriginUrl("https://example.com/a.png", "http://localhost:8188/app/"), false);
});

test("dangerous raw HTML is passed through an explicit DOMPurify allowlist", async () => {
	const html = parseMarkdown('<img src="x" onerror="alert(1)"><script>alert(1)</script>');
	assert.match(html, /onerror/);
	assert.match(html, /<script>/);
	const source = await readFile(new URL("../web/lib/markdown.js", import.meta.url), "utf8");
	assert.match(source, /DOMPurify\.sanitize/);
	assert.match(source, /ALLOW_DATA_ATTR: false/);
	assert.doesNotMatch(source.match(/const ALLOWED_TAGS = \[[\s\S]*?\];/)[0], /"script"/);
	assert.doesNotMatch(source.match(/const ALLOWED_ATTR = \[[\s\S]*?\];/)[0], /"class"|"style"|"onerror"/);
	assert.match(source, /input\.type !== "checkbox"/);
	assert.match(source, /input\.disabled = true/);
});
