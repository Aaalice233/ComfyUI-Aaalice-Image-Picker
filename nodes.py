from __future__ import annotations

import logging

import torch
from typing_extensions import override

import comfy.model_management
from comfy_api.latest import ComfyExtension, io
from nodes import PreviewImage
from server import PromptServer

from .session_store import SESSION_STORE

logger = logging.getLogger(__name__)


def processing_interrupted() -> bool:
    try:
        comfy.model_management.throw_exception_if_processing_interrupted()
    except comfy.model_management.InterruptProcessingException:
        return True
    return False


class AaaliceImagePicker(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="AaaliceImagePicker",
            display_name="🖼️ Aaalice Image Picker",
            category="Aaalice/image",
            description="Pause execution and manually choose which images continue through the workflow.",
            inputs=[
                io.Image.Input("images", tooltip="The image batch to review."),
                io.String.Input(
                    "instructions",
                    optional=True,
                    force_input=True,
                    tooltip="Optional Markdown instructions from a connected string node.",
                ),
                io.Combo.Input(
                    "selection_mode",
                    options=["single", "multiple"],
                    default="multiple",
                    tooltip="Choose one image or any number of images before confirming.",
                ),
                io.Int.Input(
                    "timeout",
                    default=300,
                    min=1,
                    max=86400,
                    step=1,
                    tooltip="Seconds before the server applies the timeout action.",
                ),
                io.Combo.Input(
                    "timeout_action",
                    options=["cancel", "submit_selected", "submit_all", "submit_first", "submit_last"],
                    default="cancel",
                    tooltip="Action applied by the server when the countdown expires.",
                ),
            ],
            outputs=[io.Image.Output("images", tooltip="The selected images in original batch order.")],
            hidden=[io.Hidden.unique_id],
            not_idempotent=True,
        )

    @classmethod
    def execute(
        cls,
        images: torch.Tensor,
        instructions: str | None = None,
        selection_mode: str = "multiple",
        timeout: int = 300,
        timeout_action: str = "cancel",
    ) -> io.NodeOutput:
        cls._validate_images(images)
        server = PromptServer.instance
        client_id = server.client_id
        if not client_id:
            raise RuntimeError("Aaalice Image Picker requires a connected ComfyUI client.")

        preview_output = PreviewImage().save_images(images, filename_prefix="AaaliceImagePicker")
        previews = preview_output["ui"]["images"]
        session = SESSION_STORE.create(
            client_id=client_id,
            node_id=cls.hidden.unique_id,
            previews=previews,
            image_count=images.shape[0],
            selection_mode=selection_mode,
            instructions=instructions or "",
            timeout=timeout,
            timeout_action=timeout_action,
        )

        try:
            server.send_sync("aaalice-image-picker-open", SESSION_STORE.payload(session), client_id)
            selected = SESSION_STORE.wait(session, processing_interrupted)
            if not selected:
                raise comfy.model_management.InterruptProcessingException()
            return io.NodeOutput(cls.select_images(images, selected))
        finally:
            try:
                server.send_sync("aaalice-image-picker-close", {"session_id": session.session_id}, client_id)
            except Exception:
                logger.exception("Failed to close Aaalice Image Picker session %s on client %s", session.session_id, client_id)
            finally:
                SESSION_STORE.cleanup(session)

    @staticmethod
    def _validate_images(images: torch.Tensor) -> None:
        if not isinstance(images, torch.Tensor):
            raise TypeError("images must be a torch.Tensor.")
        if images.ndim != 4:
            raise ValueError("images must use ComfyUI IMAGE layout [batch, height, width, channels].")
        if images.shape[0] < 1:
            raise ValueError("Aaalice Image Picker cannot display an empty image batch.")
        if any(size < 1 for size in images.shape[1:]):
            raise ValueError("Aaalice Image Picker requires non-empty image dimensions and channels.")

    @staticmethod
    def select_images(images: torch.Tensor, selected: tuple[int, ...]) -> torch.Tensor:
        return images[list(selected)]


class AaaliceImagePickerExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [AaaliceImagePicker]
