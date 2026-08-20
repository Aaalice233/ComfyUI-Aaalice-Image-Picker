from __future__ import annotations

from aiohttp import web

from server import PromptServer

from .session_store import SESSION_STORE, SessionError

_REGISTERED = False


def _error_response(error: SessionError) -> web.Response:
    return web.json_response(
        {"error": {"code": error.code, "message": str(error)}},
        status=error.status,
    )


async def _json_body(request: web.Request) -> dict:
    try:
        body = await request.json()
    except (ValueError, TypeError):
        raise SessionError(400, "invalid_json", "The request body must be valid JSON.") from None
    if not isinstance(body, dict):
        raise SessionError(400, "invalid_json", "The request body must be a JSON object.")
    return body


async def active_sessions(request: web.Request) -> web.Response:
    try:
        sessions = SESSION_STORE.active_for_client(request.rel_url.query.get("client_id", ""))
        return web.json_response({"sessions": sessions})
    except SessionError as error:
        return _error_response(error)


async def update_draft(request: web.Request) -> web.Response:
    try:
        body = await _json_body(request)
        result = SESSION_STORE.update_draft(
            body.get("session_id", ""),
            body.get("client_id", ""),
            body.get("revision"),
            body.get("selected"),
        )
        return web.json_response(result)
    except SessionError as error:
        return _error_response(error)


async def respond(request: web.Request) -> web.Response:
    try:
        body = await _json_body(request)
        result = SESSION_STORE.respond(
            body.get("session_id", ""),
            body.get("client_id", ""),
            body.get("action", ""),
            body.get("selected"),
        )
        return web.json_response(result)
    except SessionError as error:
        return _error_response(error)


def register_routes() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    routes = PromptServer.instance.routes
    routes.get("/aaalice/image-picker/sessions")(active_sessions)
    routes.post("/aaalice/image-picker/draft")(update_draft)
    routes.post("/aaalice/image-picker/respond")(respond)
    _REGISTERED = True
