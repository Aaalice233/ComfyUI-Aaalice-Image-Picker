from __future__ import annotations

import threading
import unittest

from plugin_loader import plugin_module  # noqa: F401
from aaalice_image_picker.session_store import SessionError, SessionStore


class Clock:
    def __init__(self):
        self.monotonic_value = 100.0
        self.wall_value = 1_700_000_000.0

    def monotonic(self):
        return self.monotonic_value

    def wall(self):
        return self.wall_value

    def advance(self, seconds):
        self.monotonic_value += seconds
        self.wall_value += seconds


class SessionStoreTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.store = SessionStore(self.clock.monotonic, self.clock.wall)

    def create(self, **overrides):
        values = {
            "client_id": "client-a",
            "node_id": "12",
            "previews": [
                {"filename": "1.png", "subfolder": "", "type": "temp"},
                {"filename": "2.png", "subfolder": "", "type": "temp"},
                {"filename": "3.png", "subfolder": "", "type": "temp"},
            ],
            "image_count": 3,
            "selection_mode": "multiple",
            "instructions": "# Review",
            "timeout": 10,
            "timeout_action": "cancel",
        }
        values.update(overrides)
        return self.store.create(**values)

    def test_create_and_recover_payload(self):
        session = self.create()
        self.assertEqual(36, len(session.session_id))
        self.assertEqual(1_700_000_010_000, session.deadline_epoch_ms)
        payload = self.store.active_for_client("client-a")[0]
        self.assertEqual("12", payload["node_id"])
        self.assertEqual(3, payload["image_count"])
        self.assertEqual("# Review", payload["instructions"])
        self.assertEqual(10_000, payload["remaining_ms"])
        self.assertEqual(1_700_000_000_000, payload["server_epoch_ms"])

    def test_create_rejects_invalid_configuration(self):
        invalid = [
            {"client_id": ""},
            {"image_count": 0, "previews": []},
            {"selection_mode": "other"},
            {"timeout": 0},
            {"timeout_action": "other"},
        ]
        for overrides in invalid:
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                self.create(**overrides)

    def test_revision_selection_and_single_constraint(self):
        session = self.create()
        result = self.store.update_draft(session.session_id, "client-a", 2, [2, 0])
        self.assertEqual([0, 2], result["selected"])
        with self.assertRaisesRegex(SessionError, "newer selection") as stale:
            self.store.update_draft(session.session_id, "client-a", 1, [1])
        self.assertEqual(409, stale.exception.status)

        single = self.create(selection_mode="single")
        with self.assertRaisesRegex(SessionError, "at most one"):
            self.store.update_draft(single.session_id, "client-a", 1, [0, 1])

    def test_invalid_and_cross_client_responses(self):
        session = self.create()
        cases = [
            ([1, 1], "duplicate_selection"),
            ([3], "selection_out_of_range"),
            ([True], "invalid_selection"),
            ("1", "invalid_selection"),
        ]
        for selected, code in cases:
            with self.subTest(code=code), self.assertRaises(SessionError) as raised:
                self.store.update_draft(session.session_id, "client-a", session.revision + 1, selected)
            self.assertEqual(code, raised.exception.code)
        with self.assertRaises(SessionError) as mismatch:
            self.store.respond(session.session_id, "client-b", "cancel")
        self.assertEqual(403, mismatch.exception.status)
        with self.assertRaises(SessionError) as unknown:
            self.store.respond("missing", "client-a", "cancel")
        self.assertEqual(404, unknown.exception.status)

    def test_confirm_cancel_empty_and_late_response(self):
        confirmed = self.create()
        result = self.store.respond(confirmed.session_id, "client-a", "confirm", [2, 0])
        self.assertEqual([0, 2], result["selected"])
        with self.assertRaises(SessionError) as repeated:
            self.store.respond(confirmed.session_id, "client-a", "cancel")
        self.assertEqual(409, repeated.exception.status)

        empty = self.create()
        result = self.store.respond(empty.session_id, "client-a", "confirm", [])
        self.assertEqual("cancelled_empty", result["terminal"])
        self.assertEqual((), self.store.wait(empty, lambda: None, 0))

    def test_all_timeout_actions(self):
        expectations = {
            "cancel": (),
            "submit_selected": (0, 2),
            "submit_all": (0, 1, 2),
            "submit_first": (0,),
            "submit_last": (2,),
        }
        for action, expected in expectations.items():
            with self.subTest(action=action):
                store = SessionStore(self.clock.monotonic, self.clock.wall)
                session = store.create(
                    client_id="client-a", node_id="1", previews=[{"filename": f"{i}.png"} for i in range(3)],
                    image_count=3, selection_mode="multiple", instructions="", timeout=1, timeout_action=action,
                )
                if action == "submit_selected":
                    store.update_draft(session.session_id, "client-a", 1, [2, 0])
                self.clock.advance(1)
                self.assertEqual(expected, store.wait(session, lambda: None, 0))

    def test_empty_submit_selected_cancels(self):
        session = self.create(timeout_action="submit_selected", timeout=1)
        self.clock.advance(1)
        self.assertEqual((), self.store.wait(session, lambda: None, 0))
        self.assertEqual("timed_out_cancel", session.terminal)
        with self.assertRaises(SessionError) as expired:
            self.store.respond(session.session_id, "client-a", "cancel")
        self.assertEqual(410, expired.exception.status)
        self.assertEqual("session_expired", expired.exception.code)

    def test_terminal_race_has_one_winner(self):
        session = self.create()
        barrier = threading.Barrier(3)
        outcomes = []

        def respond(action):
            barrier.wait()
            try:
                self.store.respond(session.session_id, "client-a", action, [1] if action == "confirm" else None)
                outcomes.append(action)
            except SessionError:
                outcomes.append("lost")

        threads = [threading.Thread(target=respond, args=(action,)) for action in ("confirm", "cancel")]
        for thread in threads:
            thread.start()
        barrier.wait()
        for thread in threads:
            thread.join()
        self.assertEqual(1, sum(value != "lost" for value in outcomes))
        self.assertIn(session.terminal, {"confirmed", "cancelled"})

    def test_wait_records_processing_interrupt_and_cleanup(self):
        session = self.create()
        self.assertEqual((), self.store.wait(session, lambda: True, 0))
        self.assertEqual("interrupted", session.terminal)
        self.store.cleanup(session)
        self.assertFalse(session.active)
        with self.assertRaises(SessionError) as removed:
            self.store.get(session.session_id)
        self.assertEqual(404, removed.exception.status)

    def test_confirmed_terminal_wins_before_interrupt_check(self):
        session = self.create()
        self.store.respond(session.session_id, "client-a", "confirm", [1])
        self.assertEqual((1,), self.store.wait(session, lambda: True, 0))
        self.assertEqual("confirmed", session.terminal)

    def test_multi_client_isolation(self):
        first = self.create(client_id="client-a")
        second = self.create(client_id="client-b")
        self.assertEqual([first.session_id], [item["session_id"] for item in self.store.active_for_client("client-a")])
        self.assertEqual([second.session_id], [item["session_id"] for item in self.store.active_for_client("client-b")])


if __name__ == "__main__":
    unittest.main()
