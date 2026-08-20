from __future__ import annotations

from .nodes import AaaliceImagePickerExtension

WEB_DIRECTORY = "./web"


async def comfy_entrypoint() -> AaaliceImagePickerExtension:
    from .routes import register_routes

    register_routes()
    return AaaliceImagePickerExtension()


__all__ = ["WEB_DIRECTORY", "comfy_entrypoint"]
