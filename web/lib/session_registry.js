export class SessionRegistry {
	constructor(closedLimit = 64) {
		this.sessions = new Map();
		this.closed = new Set();
		this.closedLimit = closedLimit;
	}

	open(payload) {
		const sessionId = payload?.session_id;
		if (!sessionId || this.sessions.has(sessionId) || this.closed.has(sessionId)) return false;
		this.sessions.set(sessionId, payload);
		return true;
	}

	close(sessionId) {
		this.sessions.delete(sessionId);
		if (sessionId) this.closed.add(sessionId);
		while (this.closed.size > this.closedLimit) this.closed.delete(this.closed.values().next().value);
	}

	reconcile(payloads) {
		const incoming = new Set(payloads.map((payload) => payload.session_id));
		const removed = [];
		for (const sessionId of this.sessions.keys()) {
			if (!incoming.has(sessionId)) {
				this.close(sessionId);
				removed.push(sessionId);
			}
		}
		for (const payload of payloads) {
			if (this.sessions.has(payload.session_id)) this.sessions.set(payload.session_id, payload);
			else this.open(payload);
		}
		return removed;
	}

	next() {
		return this.sessions.values().next().value;
	}

	clear() {
		this.sessions.clear();
		this.closed.clear();
	}
}
