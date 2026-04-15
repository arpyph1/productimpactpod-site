#!/usr/bin/env python3
"""
Trigger a Cloudflare Pages rebuild after publish_articles.py finishes
writing to Supabase.

The GitHub Actions workflow at .github/workflows/publish-trigger.yml
listens for a `repository_dispatch` event of type `content-published`.
When received, it pings the Cloudflare Pages deploy hook, which rebuilds
the site (pulling fresh data from Supabase in the process).

Usage:
  python3 dispatch_rebuild.py
  python3 dispatch_rebuild.py --payload '{"articleSlug":"foo"}'

Requires one of:
  GITHUB_TOKEN env var           (PAT with `repo` scope on the site repo)
  GH_TOKEN env var               (same, checked as fallback)

Exit code:
  0 = dispatch accepted (204 No Content from GitHub)
  1 = dispatch failed (authentication, network, or 4xx/5xx)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

GITHUB_OWNER = "arpyph1"
GITHUB_REPO = "productimpactpod-site"
EVENT_TYPE = "content-published"


def dispatch(payload: dict | None = None, token: str | None = None) -> tuple[bool, str]:
    """Send a repository_dispatch event to GitHub. Returns (ok, message)."""
    token = token or os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        return False, "No GITHUB_TOKEN or GH_TOKEN set in environment"

    body = json.dumps({
        "event_type": EVENT_TYPE,
        "client_payload": payload or {},
    }).encode("utf-8")

    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/dispatches"
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "productimpactpod-publisher/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            # GitHub returns 204 No Content on success
            if resp.status == 204:
                return True, "dispatch accepted — CF Pages rebuild queued"
            body = resp.read().decode("utf-8", errors="replace")
            return False, f"unexpected status {resp.status}: {body}"
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        return False, f"HTTP {e.code}: {err_body}"
    except urllib.error.URLError as e:
        return False, f"network error: {e}"


def _main(argv: list[str]) -> int:
    payload: dict = {}
    if "--payload" in argv:
        idx = argv.index("--payload")
        if idx + 1 >= len(argv):
            print("Usage: dispatch_rebuild.py [--payload JSON]", file=sys.stderr)
            return 2
        try:
            payload = json.loads(argv[idx + 1])
        except json.JSONDecodeError as e:
            print(f"✗ invalid --payload JSON: {e}", file=sys.stderr)
            return 2

    ok, msg = dispatch(payload)
    stream = sys.stdout if ok else sys.stderr
    prefix = "✓" if ok else "✗"
    print(f"{prefix} {msg}", file=stream)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
