from __future__ import annotations

import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import torch

from plugin_loader import plugin_module
from aaalice_image_picker.nodes import AaaliceImagePicker
from aaalice_image_picker import nodes as nodes_module
from aaalice_image_picker import routes as routes_module
from aaalice_image_picker.session_store import SessionStore


class ImagePickerNodeTests(unittest.TestCase):
    def test_extension_entrypoint_registers_routes_and_node(self):
        class FakeRoutes:
            def __init__(self):
                self.registered = []

            def get(self, path):
                return lambda handler: self.registered.append(("GET", path, handler)) or handler

            def post(self, path):
                return lambda handler: self.registered.append(("POST", path, handler)) or handler

        fake_routes = FakeRoutes()
        server = SimpleNamespace(routes=fake_routes)
        with patch.object(routes_module, "_REGISTERED", False), \
                patch.object(routes_module.PromptServer, "instance", server, create=True):
            extension = asyncio.run(plugin_module.comfy_entrypoint())
        self.assertEqual(3, len(fake_routes.registered))
        self.assertEqual(AaaliceImagePicker, asyncio.run(extension.get_node_list())[0])

    def test_schema_contract(self):
        schema = AaaliceImagePicker.define_schema()
        self.assertEqual("AaaliceImagePicker", schema.node_id)
        self.assertEqual("Aaalice/image", schema.category)
        self.assertTrue(schema.not_idempotent)
        self.assertEqual(["images"], [output.id for output in schema.outputs])
        inputs = {item.id: item for item in schema.inputs}
        self.assertTrue(inputs["instructions"].optional)
        self.assertTrue(inputs["instructions"].force_input)
        self.assertEqual(300, inputs["timeout"].default)
        self.assertEqual(1, inputs["timeout"].min)
        self.assertEqual(86400, inputs["timeout"].max)
        self.assertEqual(["single", "multiple"], inputs["selection_mode"].options)
        self.assertEqual(["cancel", "submit_selected", "submit_all", "submit_first", "submit_last"], inputs["timeout_action"].options)

    def test_selected_batch_order_shape_and_dtype(self):
        images = torch.arange(4 * 2 * 3 * 3, dtype=torch.float32).reshape(4, 2, 3, 3)
        output = AaaliceImagePicker.select_images(images, (0, 2))
        self.assertEqual((2, 2, 3, 3), tuple(output.shape))
        self.assertEqual(images.dtype, output.dtype)
        self.assertEqual(images.device, output.device)
        self.assertTrue(torch.equal(output[0], images[0]))
        self.assertTrue(torch.equal(output[1], images[2]))

        single = AaaliceImagePicker.select_images(images, (3,))
        self.assertEqual((1, 2, 3, 3), tuple(single.shape))

    def test_invalid_image_inputs_fail_clearly(self):
        with self.assertRaises(TypeError):
            AaaliceImagePicker._validate_images([])
        with self.assertRaisesRegex(ValueError, "layout"):
            AaaliceImagePicker._validate_images(torch.empty(2, 3, 4))
        with self.assertRaisesRegex(ValueError, "empty"):
            AaaliceImagePicker._validate_images(torch.empty(0, 2, 2, 3))
        with self.assertRaisesRegex(ValueError, "dimensions"):
            AaaliceImagePicker._validate_images(torch.empty(1, 0, 2, 3))

    def test_websocket_events_are_targeted_to_initiating_client(self):
        class Session:
            session_id = "session-id"

            def payload(self):
                return {"session_id": self.session_id}

        class Store:
            def __init__(self):
                self.created = None
                self.cleaned = False

            def create(self, **kwargs):
                self.created = kwargs
                return Session()

            def payload(self, session):
                return session.payload()

            def wait(self, session, interrupt_check):
                return (0,)

            def cleanup(self, session):
                self.cleaned = True

        class Preview:
            def save_images(self, images, filename_prefix):
                return {"ui": {"images": [{"filename": "1.png", "subfolder": "", "type": "temp"}]}}

        server = SimpleNamespace(client_id="client-a", calls=[])
        server.send_sync = lambda event, payload, client_id: server.calls.append((event, payload, client_id))
        store = Store()
        images = torch.zeros(1, 2, 2, 3)
        with patch.object(nodes_module, "SESSION_STORE", store), \
                patch.object(nodes_module, "PreviewImage", Preview), \
                patch.object(nodes_module.PromptServer, "instance", server, create=True), \
                patch.object(AaaliceImagePicker, "hidden", SimpleNamespace(unique_id="7"), create=True):
            AaaliceImagePicker.execute(images)

        self.assertEqual("client-a", store.created["client_id"])
        self.assertEqual(["client-a", "client-a"], [call[2] for call in server.calls])
        self.assertEqual(["aaalice-image-picker-open", "aaalice-image-picker-close"], [call[0] for call in server.calls])
        self.assertTrue(store.cleaned)

    def test_close_event_failure_does_not_mask_interrupt(self):
        session = SimpleNamespace(session_id="session-id", payload=lambda: {"session_id": "session-id"})
        store = SimpleNamespace(
            create=lambda **kwargs: session,
            payload=lambda current: current.payload(),
            wait=lambda current, interrupt_check: (),
            cleanup=lambda current: None,
        )

        class Preview:
            def save_images(self, images, filename_prefix):
                return {"ui": {"images": [{"filename": "1.png", "subfolder": "", "type": "temp"}]}}

        def send(event, payload, client_id):
            if event == "aaalice-image-picker-close":
                raise RuntimeError("socket closed")

        server = SimpleNamespace(client_id="client-a", send_sync=send)
        with patch.object(nodes_module, "SESSION_STORE", store), \
                patch.object(nodes_module, "PreviewImage", Preview), \
                patch.object(nodes_module.PromptServer, "instance", server, create=True), \
                patch.object(AaaliceImagePicker, "hidden", SimpleNamespace(unique_id="7"), create=True), \
                self.assertLogs(nodes_module.logger, level="ERROR"):
            with self.assertRaises(nodes_module.comfy.model_management.InterruptProcessingException):
                AaaliceImagePicker.execute(torch.zeros(1, 2, 2, 3))


class FakeRequest:
    def __init__(self, body=None, query=None, error=None):
        self.body = body
        self.error = error
        self.rel_url = SimpleNamespace(query=query or {})

    async def json(self):
        if self.error:
            raise self.error
        return self.body


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.store = SessionStore()
        self.session = self.store.create(
            client_id="client-a",
            node_id="1",
            previews=[{"filename": "1.png", "subfolder": "", "type": "temp"}],
            image_count=1,
            selection_mode="single",
            instructions="",
            timeout=300,
            timeout_action="cancel",
        )

    def call(self, handler, request):
        with patch.object(routes_module, "SESSION_STORE", self.store):
            return asyncio.run(handler(request))

    def body(self, response):
        return json.loads(response.text)

    def test_active_draft_and_response_routes(self):
        active = self.call(routes_module.active_sessions, FakeRequest(query={"client_id": "client-a"}))
        self.assertEqual(200, active.status)
        self.assertEqual(self.session.session_id, self.body(active)["sessions"][0]["session_id"])

        draft = self.call(routes_module.update_draft, FakeRequest({
            "session_id": self.session.session_id,
            "client_id": "client-a",
            "revision": 1,
            "selected": [0],
        }))
        self.assertEqual({"selected": [0], "revision": 1}, self.body(draft))

        confirmed = self.call(routes_module.respond, FakeRequest({
            "session_id": self.session.session_id,
            "client_id": "client-a",
            "action": "confirm",
            "selected": [0],
        }))
        self.assertEqual("confirmed", self.body(confirmed)["terminal"])

    def test_route_error_shapes(self):
        missing_client = self.call(routes_module.active_sessions, FakeRequest())
        self.assertEqual(400, missing_client.status)
        self.assertEqual("client_required", self.body(missing_client)["error"]["code"])

        malformed = self.call(routes_module.update_draft, FakeRequest(error=ValueError("bad json")))
        self.assertEqual(400, malformed.status)
        self.assertEqual("invalid_json", self.body(malformed)["error"]["code"])

        invalid_id = self.call(routes_module.respond, FakeRequest({
            "session_id": [],
            "client_id": "client-a",
            "action": "cancel",
        }))
        self.assertEqual(400, invalid_id.status)
        self.assertEqual("invalid_session_id", self.body(invalid_id)["error"]["code"])

        wrong_client = self.call(routes_module.respond, FakeRequest({
            "session_id": self.session.session_id,
            "client_id": "client-b",
            "action": "cancel",
        }))
        self.assertEqual(403, wrong_client.status)
        self.assertEqual("client_mismatch", self.body(wrong_client)["error"]["code"])


if __name__ == "__main__":
    unittest.main()
