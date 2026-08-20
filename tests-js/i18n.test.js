import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const languages = ["en", "zh", "zh-TW"];

function flatten(value, prefix = "") {
	const entries = [];
	for (const [key, child] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (child && typeof child === "object" && !Array.isArray(child)) entries.push(...flatten(child, path));
		else entries.push([path, child]);
	}
	return entries;
}

async function load(language, file) {
	return JSON.parse(await readFile(new URL(`../locales/${language}/${file}`, import.meta.url), "utf8"));
}

test("frontend literal translation keys exist in the main catalog", async () => {
	const catalog = (await load("en", "main.json")).aaaliceImagePicker;
	const keys = new Set(flatten(catalog).map(([key]) => key));
	const sources = await Promise.all(["index.js", "picker.js"].map((file) => readFile(new URL(`../web/${file}`, import.meta.url), "utf8")));
	for (const source of sources) {
		for (const match of source.matchAll(/\bt\("([^"]+)"/g)) assert.ok(keys.has(match[1]), `missing translation key ${match[1]}`);
	}
	for (const mode of ["single", "multiple"]) assert.ok(keys.has(`mode.${mode}`));
	for (const action of ["cancel", "submit_selected", "submit_all", "submit_first", "submit_last"]) assert.ok(keys.has(`timeoutAction.${action}`));
});

for (const file of ["main.json", "nodeDefs.json"]) {
	test(`${file} has identical non-empty keys in en, zh, and zh-TW`, async () => {
		const catalogs = await Promise.all(languages.map((language) => load(language, file)));
		const flattened = catalogs.map((catalog) => flatten(catalog));
		const expected = flattened[0].map(([key]) => key).sort();
		for (const [index, values] of flattened.entries()) {
			assert.deepEqual(values.map(([key]) => key).sort(), expected, `${languages[index]} key set`);
			for (const [key, value] of values) assert.equal(typeof value === "string" && value.trim().length > 0, true, `${languages[index]}:${key}`);
		}
	});
}
