from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from threading import Condition, RLock
from typing import Any, Callable

SELECTION_MODES = {"single", "multiple"}
TIMEOUT_ACTIONS = {"cancel", "submit_selected", "submit_all", "submit_first", "submit_last"}


class SessionError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code


@dataclass
class PickerSession:
    session_id: str
    client_id: str
    node_id: str
    previews: tuple[dict[str, str], ...]
    image_count: int
    selection_mode: str
    instructions: str
    timeout_action: str
    deadline_monotonic: float
    deadline_epoch_ms: int
    selected: tuple[int, ...] = ()
    revision: int = 0
    terminal: str | None = None
    result: tuple[int, ...] = ()
    active: bool = True
    condition: Condition = field(default_factory=lambda: Condition(RLock()), repr=False)

    def payload(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "node_id": self.node_id,
            "images": [dict(preview) for preview in self.previews],
            "image_count": self.image_count,
            "selection_mode": self.selection_mode,
            "instructions": self.instructions,
            "timeout_action": self.timeout_action,
            "deadline_epoch_ms": self.deadline_epoch_ms,
            "selected": list(self.selected),
            "revision": self.revision,
        }


class SessionStore:
    def __init__(self, monotonic: Callable[[], float] = time.monotonic, wall_time: Callable[[], float] = time.time):
        self._sessions: dict[str, PickerSession] = {}
        self._lock = RLock()
        self._monotonic = monotonic
        self._wall_time = wall_time

    def create(
        self,
        *,
        client_id: str,
        node_id: str,
        previews: list[dict[str, str]],
        image_count: int,
        selection_mode: str,
        instructions: str,
        timeout: int,
        timeout_action: str,
    ) -> PickerSession:
        if not client_id:
            raise ValueError("The image picker requires a ComfyUI client_id.")
        if image_count < 1 or len(previews) != image_count:
            raise ValueError("The image picker requires at least one preview for every input image.")
        if selection_mode not in SELECTION_MODES:
            raise ValueError(f"Unsupported selection mode: {selection_mode}")
        if timeout_action not in TIMEOUT_ACTIONS:
            raise ValueError(f"Unsupported timeout action: {timeout_action}")
        if not isinstance(timeout, int) or isinstance(timeout, bool) or not 1 <= timeout <= 86400:
            raise ValueError("Timeout must be an integer from 1 to 86400 seconds.")

        now_monotonic = self._monotonic()
        session = PickerSession(
            session_id=str(uuid.uuid4()),
            client_id=client_id,
            node_id=str(node_id),
            previews=tuple(dict(preview) for preview in previews),
            image_count=image_count,
            selection_mode=selection_mode,
            instructions=instructions,
            timeout_action=timeout_action,
            deadline_monotonic=now_monotonic + timeout,
            deadline_epoch_ms=round((self._wall_time() + timeout) * 1000),
        )
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> PickerSession:
        if not isinstance(session_id, str) or not session_id:
            raise SessionError(400, "invalid_session_id", "session_id must be a non-empty string.")
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise SessionError(404, "session_not_found", "The image picker session does not exist or has expired.")
        return session

    def payload(self, session: PickerSession) -> dict[str, Any]:
        with session.condition:
            self._resolve_timeout_locked(session)
            return self._payload_locked(session)

    def active_for_client(self, client_id: str) -> list[dict[str, Any]]:
        if not client_id:
            raise SessionError(400, "client_required", "client_id is required.")
        with self._lock:
            sessions = list(self._sessions.values())
        payloads: list[dict[str, Any]] = []
        for session in sessions:
            with session.condition:
                self._resolve_timeout_locked(session)
                if session.active and session.terminal is None and session.client_id == client_id:
                    payloads.append(self._payload_locked(session))
        return payloads

    def update_draft(self, session_id: str, client_id: str, revision: int, selected: Any) -> dict[str, Any]:
        session = self.get(session_id)
        with session.condition:
            self._assert_available_locked(session, client_id)
            if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
                raise SessionError(400, "invalid_revision", "revision must be a positive integer.")
            if revision <= session.revision:
                raise SessionError(409, "stale_revision", "A newer selection revision has already been received.")
            normalized = self._validate_selection(session, selected)
            session.selected = normalized
            session.revision = revision
            return {"selected": list(normalized), "revision": revision}

    def respond(self, session_id: str, client_id: str, action: str, selected: Any = None) -> dict[str, Any]:
        session = self.get(session_id)
        with session.condition:
            self._assert_available_locked(session, client_id)
            if action == "cancel":
                session.terminal = "cancelled"
                session.result = ()
            elif action == "confirm":
                normalized = self._validate_selection(session, [] if selected is None else selected)
                session.selected = normalized
                session.terminal = "confirmed" if normalized else "cancelled_empty"
                session.result = normalized
            else:
                raise SessionError(400, "invalid_action", "action must be confirm or cancel.")
            session.condition.notify_all()
            return {"terminal": session.terminal, "selected": list(session.result)}

    def wait(self, session: PickerSession, interrupt_check: Callable[[], bool], poll_interval: float = 0.25) -> tuple[int, ...]:
        while True:
            with session.condition:
                self._resolve_timeout_locked(session)
                if session.terminal is not None:
                    return session.result
                remaining = session.deadline_monotonic - self._monotonic()
                session.condition.wait(timeout=min(poll_interval, max(remaining, 0.0)))
                self._resolve_timeout_locked(session)
                if session.terminal is not None:
                    continue
                if interrupt_check():
                    session.terminal = "interrupted"
                    session.result = ()
                    session.condition.notify_all()

    def cleanup(self, session: PickerSession) -> None:
        with self._lock:
            with session.condition:
                session.active = False
                session.condition.notify_all()
                self._sessions.pop(session.session_id, None)

    def _payload_locked(self, session: PickerSession) -> dict[str, Any]:
        payload = session.payload()
        payload["server_epoch_ms"] = round(self._wall_time() * 1000)
        payload["remaining_ms"] = round(max(0.0, session.deadline_monotonic - self._monotonic()) * 1000)
        return payload

    def _assert_available_locked(self, session: PickerSession, client_id: str) -> None:
        if not isinstance(client_id, str) or not client_id:
            raise SessionError(400, "client_required", "client_id is required.")
        if session.client_id != client_id:
            raise SessionError(403, "client_mismatch", "This session belongs to a different ComfyUI client.")
        self._resolve_timeout_locked(session)
        if not session.active or session.terminal in {"timed_out_cancel", "timed_out_submit"}:
            raise SessionError(410, "session_expired", "The image picker session has expired.")
        if session.terminal is not None:
            raise SessionError(409, "session_finished", "The image picker session has already finished.")

    def _resolve_timeout_locked(self, session: PickerSession) -> None:
        if not session.active or session.terminal is not None or self._monotonic() < session.deadline_monotonic:
            return
        if session.timeout_action == "submit_selected":
            result = session.selected
        elif session.timeout_action == "submit_all":
            result = tuple(range(session.image_count))
        elif session.timeout_action == "submit_first":
            result = (0,)
        elif session.timeout_action == "submit_last":
            result = (session.image_count - 1,)
        else:
            result = ()
        session.result = result
        session.terminal = "timed_out_submit" if result else "timed_out_cancel"
        session.condition.notify_all()

    @staticmethod
    def _validate_selection(session: PickerSession, selected: Any) -> tuple[int, ...]:
        if not isinstance(selected, list):
            raise SessionError(400, "invalid_selection", "selected must be an array of image indexes.")
        if any(not isinstance(index, int) or isinstance(index, bool) for index in selected):
            raise SessionError(400, "invalid_selection", "Every selected index must be an integer.")
        if len(set(selected)) != len(selected):
            raise SessionError(400, "duplicate_selection", "Selected indexes must not contain duplicates.")
        if any(index < 0 or index >= session.image_count for index in selected):
            raise SessionError(400, "selection_out_of_range", "A selected image index is out of range.")
        if session.selection_mode == "single" and len(selected) > 1:
            raise SessionError(400, "single_selection_required", "Single mode accepts at most one selected image.")
        return tuple(sorted(selected))


SESSION_STORE = SessionStore()
