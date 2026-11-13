import logging
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings
from .routers import account, admin, assistant, auth, catalog, content, insights, learning, programs, public, training, users

log = logging.getLogger("salam")
if not log.handlers:  # make the app's own warnings visible in the host's logs (uvicorn only configures its own loggers)
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    log.addHandler(_h)
    log.setLevel(logging.INFO)
MAX_BODY = 1_000_000
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _origin(url: str) -> str:
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"


class Guard(BaseHTTPMiddleware):
    """Origin check for state-changing requests (defence in depth on top of SameSite cookies and the CSRF token),
    body size limit, and security headers on every response."""

    async def dispatch(self, request: Request, call_next):
        s = get_settings()
        if request.method in UNSAFE and request.url.path.startswith("/api/"):
            allowed = _origin(s.app_url)
            origin = request.headers.get("origin") or (_origin(request.headers["referer"]) if request.headers.get("referer") else None)
            if origin != allowed:
                return JSONResponse({"detail": {"code": "bad_origin"}}, status_code=403)
            limit = 4 * 1024 * 1024 if request.url.path == "/api/admin/content/identity" else MAX_BODY  # course bundle (staff only)
            if int(request.headers.get("content-length") or 0) > limit:
                return JSONResponse({"detail": {"code": "payload_too_large"}}, status_code=413)
        resp = await call_next(request)
        resp.headers.setdefault("Cache-Control", "no-store")
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "same-origin"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        resp.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        if s.cookie_secure:
            resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return resp


def create_app() -> FastAPI:
    s = get_settings()
    docs = s.environment == "development"
    app = FastAPI(title="Salam Academy API", version="1.0.0", docs_url="/api/docs" if docs else None, redoc_url=None, openapi_url="/api/openapi.json" if docs else None)
    app.add_middleware(Guard)
    for r in (auth, account, users, programs, learning, training, admin, catalog, public, content, assistant, insights):
        app.include_router(r.router)

    @app.get("/api/health")
    def health():
        return {"ok": True}

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        return JSONResponse({"detail": {"code": "validation_error", "errors": [{"loc": e.get("loc"), "msg": e.get("msg")} for e in exc.errors()]}}, status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse({"detail": {"code": "server_error"}}, status_code=500)

    return app


app = create_app()
