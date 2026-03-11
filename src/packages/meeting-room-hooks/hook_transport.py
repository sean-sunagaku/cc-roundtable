"""Shared relay transport helpers for Meeting Room hook scripts."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from contracts import HookEnvVars as E
from hook_common import as_str

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


@dataclass(frozen=True)
class WebSocketConfig:
    host: str
    port: int
    path: str
    timeout: float


def _load_ws_config(*, env: Mapping[str, str] | None = None) -> WebSocketConfig:
    values = env if env is not None else os.environ
    host = as_str(values.get(E.WS_HOST)) or "127.0.0.1"
    ws_path = as_str(values.get(E.WS_PATH)) or "/"

    port_raw = as_str(values.get(E.WS_PORT)) or "9999"
    try:
        port = int(port_raw)
    except ValueError:
        port = 9999

    timeout_raw = as_str(values.get(E.WS_TIMEOUT)) or "0.8"
    try:
        timeout = float(timeout_raw)
    except ValueError:
        timeout = 0.8

    return WebSocketConfig(host=host, port=port, path=ws_path, timeout=timeout)


def _recv_until(sock: socket.socket, marker: bytes) -> bytes:
    data = b""
    while marker not in data:
        chunk = sock.recv(4096)
        if not chunk:
            break
        data += chunk
        if len(data) > 65536:
            break
    return data


def _build_ws_frame(payload: bytes) -> bytes:
    first = bytes([0x81])
    mask_bit = 0x80
    size = len(payload)

    if size < 126:
        header = first + bytes([mask_bit | size])
    elif size < (1 << 16):
        header = first + bytes([mask_bit | 126]) + size.to_bytes(2, "big")
    else:
        header = first + bytes([mask_bit | 127]) + size.to_bytes(8, "big")

    mask = secrets.token_bytes(4)
    masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
    return header + mask + masked


def send_ws_json(message: Mapping[str, Any], *, env: Mapping[str, str] | None = None) -> None:
    config = _load_ws_config(env=env)
    body = json.dumps(message, ensure_ascii=False).encode("utf-8")
    key = base64.b64encode(secrets.token_bytes(16)).decode("ascii")
    expected_accept = base64.b64encode(hashlib.sha1(f"{key}{GUID}".encode("ascii")).digest()).decode("ascii")

    request = (
        f"GET {config.path} HTTP/1.1\r\n"
        f"Host: {config.host}:{config.port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode("ascii")

    with socket.create_connection((config.host, config.port), timeout=config.timeout) as sock:
        sock.settimeout(config.timeout)
        sock.sendall(request)
        response = _recv_until(sock, b"\r\n\r\n").decode("latin1", errors="ignore")
        if "101" not in response.split("\r\n", 1)[0]:
            raise RuntimeError("websocket handshake failed")
        if expected_accept not in response:
            raise RuntimeError("invalid websocket accept key")
        sock.sendall(_build_ws_frame(body))


def append_jsonl(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def resolve_log_path(
    default_path: Path,
    *,
    env_var: str | None = None,
    env: Mapping[str, str] | None = None,
) -> Path:
    if env_var:
        values = env if env is not None else os.environ
        custom_path = as_str(values.get(env_var))
        if custom_path:
            return Path(custom_path).expanduser()
    return default_path


def relay_json_with_fallback(
    message: Mapping[str, Any],
    *,
    default_log_path: Path,
    fallback_env_var: str | None = None,
    env: Mapping[str, str] | None = None,
) -> None:
    try:
        send_ws_json(message, env=env)
    except Exception:
        try:
            append_jsonl(
                resolve_log_path(default_log_path, env_var=fallback_env_var, env=env),
                message,
            )
        except Exception:
            pass
