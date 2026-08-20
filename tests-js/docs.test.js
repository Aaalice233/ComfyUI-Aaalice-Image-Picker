import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = ["README.md", "README.en.md", "README.zh-TW.md"];
const requiredTokens = [
	"AaaliceImagePicker",
	"instructions",
	"selection_mode",
	"timeout_action",
	"cancel",
	"submit_selected",
	"submit_all",
	"submit_first",
	"submit_last",
	"InterruptProcessingException",
	"marked 15.0.11",
	"DOMPurify 3.4.12",
];

test("the three READMEs keep equivalent structure and behavior tokens", async () => {
	const documents = await Promise.all(files.map((file) => readFile(file, "utf8")));
	const headingShapes = documents.map((document) => [...document.matchAll(/^(#{2,3})\s/gm)].map((match) => match[1]));
	for (const shape of headingShapes.slice(1)) assert.deepEqual(shape, headingShapes[0]);
	for (const [index, document] of documents.entries()) {
		for (const token of requiredTokens) assert.ok(document.includes(token), `${files[index]} is missing ${token}`);
	}
});
