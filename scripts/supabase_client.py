"""Shared Supabase REST client helpers for Python scripts."""

import os
import json
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

_here = Path(__file__).resolve().parent
_loaded = False


def _ensure_env():
    global _loaded
    if _loaded:
        return
    _loaded = True
    env_path = _here.parent / ".env"
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip()
            if not os.environ.get(key):
                os.environ[key] = value


def get_url() -> str:
    _ensure_env()
    return os.environ.get("PUBLIC_SUPABASE_URL", os.environ.get("SUPABASE_URL", ""))


def get_key() -> str:
    _ensure_env()
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def headers() -> dict:
    key = get_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def rest_get(table: str, params: str = "") -> list:
    url = f"{get_url()}/rest/v1/{table}?{params}" if params else f"{get_url()}/rest/v1/{table}"
    req = Request(url, headers=headers())
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def rest_post(table: str, body: list | dict, extra_headers: dict | None = None) -> int:
    url = f"{get_url()}/rest/v1/{table}"
    h = {**headers(), **(extra_headers or {})}
    data = json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=h, method="POST")
    with urlopen(req, timeout=30) as resp:
        return resp.status


def rest_patch(table: str, params: str, body: dict) -> int:
    url = f"{get_url()}/rest/v1/{table}?{params}"
    data = json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=headers(), method="PATCH")
    with urlopen(req, timeout=30) as resp:
        return resp.status
