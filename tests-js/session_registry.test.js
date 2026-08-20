import test from "node:test";
import assert from "node:assert/strict";

import { SessionRegistry } from "../web/lib/session_registry.js";

test("duplicate open and close events are idempotent", () => {
	const registry = new SessionRegistry();
	assert.equal(registry.open({ session_id: "one" }), true);
	assert.equal(registry.open({ session_id: "one" }), false);
	registry.close("one");
	assert.equal(registry.open({ session_id: "one" }), false);
	registry.close("one");
	assert.equal(registry.next(), undefined);
});

test("reconcile removes sessions missing from authoritative recovery", () => {
	const registry = new SessionRegistry();
	registry.open({ session_id: "stale" });
	registry.open({ session_id: "active" });
	assert.deepEqual(registry.reconcile([{ session_id: "active" }, { session_id: "new" }]), ["stale"]);
	assert.deepEqual([...registry.sessions.keys()], ["active", "new"]);
});

test("recovered sessions retain queue order and clear releases state", () => {
	const registry = new SessionRegistry();
	registry.open({ session_id: "one", revision: 2 });
	registry.open({ session_id: "two", revision: 0 });
	assert.equal(registry.next().session_id, "one");
	registry.close("one");
	assert.equal(registry.next().session_id, "two");
	registry.clear();
	assert.equal(registry.next(), undefined);
	assert.equal(registry.closed.size, 0);
});
