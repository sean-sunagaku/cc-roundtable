from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
HOOKS_DIR = REPO_ROOT / "src" / "packages" / "meeting-room-hooks"


def reserve_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class HookScriptTestCase(unittest.TestCase):
    maxDiff = None

    def run_hook(
        self,
        script_name: str,
        payload: dict,
        *,
        env: dict[str, str] | None = None,
        cwd: Path | None = None,
    ) -> subprocess.CompletedProcess[str]:
        merged_env = dict(env or {})
        return subprocess.run(
            [sys.executable, str(HOOKS_DIR / script_name)],
            input=json.dumps(payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            cwd=str(cwd or REPO_ROOT),
            env={**dict(os_environ_subset()), **merged_env},
            check=False,
        )


def os_environ_subset() -> dict[str, str]:
    keys = ("PATH", "PYTHONPATH", "HOME", "TMPDIR", "TMP", "TEMP")
    result: dict[str, str] = {}
    for key in keys:
        value = os.environ.get(key)
        if isinstance(value, str):
            result[key] = value
    return result


class HookBehaviorTests(HookScriptTestCase):
    def create_active_file(self, root: Path) -> Path:
        active_file = root / ".claude" / "meeting-room" / ".active"
        active_file.parent.mkdir(parents=True, exist_ok=True)
        active_file.write_text("", encoding="utf-8")
        return active_file

    def test_enforce_broadcast_blocks_directed_message(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active_file = self.create_active_file(root)

            result = self.run_hook(
                "enforce-broadcast.py",
                {"tool_input": {"type": "message", "content": "private"}},
                env={"MEETING_ROOM_ACTIVE_FILE": str(active_file)},
                cwd=root,
            )

            self.assertEqual(result.returncode, 2)
            self.assertIn("directed", result.stderr)

    def test_approval_gate_allows_open_mode(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active_file = self.create_active_file(root)
            approval_file = root / "approval.json"
            approval_file.write_text(json.dumps({"mode": "open"}), encoding="utf-8")

            result = self.run_hook(
                "approval-gate.py",
                {},
                env={
                    "MEETING_ROOM_ACTIVE_FILE": str(active_file),
                    "MEETING_ROOM_APPROVAL_FILE": str(approval_file),
                },
                cwd=root,
            )

            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stderr, "")

    def test_ws_relay_falls_back_to_discussion_log(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active_file = self.create_active_file(root)
            fallback_log = root / "discussion.jsonl"

            result = self.run_hook(
                "ws-relay.py",
                {
                    "hook_event_name": "PostToolUse",
                    "tool_name": "SendMessage",
                    "tool_input": {"type": "broadcast", "content": "hello team"},
                    "tool_response": {"routing": {"sender": "planner", "content": "hello team"}},
                    "metadata": {"team": "alpha", "meetingId": "meeting-1"},
                    "agent_id": "planner@alpha",
                },
                env={
                    "MEETING_ROOM_ACTIVE_FILE": str(active_file),
                    "MEETING_ROOM_FALLBACK_LOG": str(fallback_log),
                    "MEETING_ROOM_WS_PORT": str(reserve_tcp_port()),
                },
                cwd=root,
            )

            self.assertEqual(result.returncode, 0)
            lines = fallback_log.read_text(encoding="utf-8").splitlines()
            self.assertEqual(len(lines), 1)
            entry = json.loads(lines[0])
            self.assertEqual(entry["sender"], "planner")
            self.assertEqual(entry["team"], "alpha")
            self.assertEqual(entry["meetingId"], "meeting-1")
            self.assertEqual(entry["content"], "hello team")

    def test_stop_relay_falls_back_with_markers(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active_file = self.create_active_file(root)
            fallback_log = root / "stop.jsonl"

            result = self.run_hook(
                "stop-relay.py",
                {
                    "hook_event_name": "Stop",
                    "assistant_message": "最終回答です",
                },
                env={
                    "MEETING_ROOM_ACTIVE_FILE": str(active_file),
                    "MEETING_ROOM_FALLBACK_LOG": str(fallback_log),
                    "MEETING_ROOM_WS_PORT": str(reserve_tcp_port()),
                    "CLAUDE_AGENT_NAME": "leader",
                    "CLAUDE_TEAM_NAME": "alpha",
                    "MEETING_ROOM_MEETING_ID": "meeting-2",
                },
                cwd=root,
            )

            self.assertEqual(result.returncode, 0)
            entry = json.loads(fallback_log.read_text(encoding="utf-8").splitlines()[0])
            self.assertIn("[[[MEETING_ROOM_RESPONSE_START]]]", entry["content"])
            self.assertIn("最終回答です", entry["content"])
            self.assertEqual(entry["meetingId"], "meeting-2")

    def test_subagent_status_relay_uses_status_log_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active_file = self.create_active_file(root)
            status_log = root / "status.jsonl"

            result = self.run_hook(
                "subagent-status-relay.py",
                {"hook_event_name": "PostToolUse"},
                env={
                    "MEETING_ROOM_ACTIVE_FILE": str(active_file),
                    "MEETING_ROOM_STATUS_LOG": str(status_log),
                    "MEETING_ROOM_WS_PORT": str(reserve_tcp_port()),
                    "CLAUDE_SUBAGENT_NAME": "implementer",
                    "CLAUDE_TEAM_NAME": "alpha",
                },
                cwd=root,
            )

            self.assertEqual(result.returncode, 0)
            entry = json.loads(status_log.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(entry["sender"], "implementer")
            self.assertEqual(entry["status"], "completed")

    def test_team_event_relay_falls_back_for_task(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active_file = self.create_active_file(root)
            fallback_log = root / "team-event.jsonl"

            result = self.run_hook(
                "team-event-relay.py",
                {
                    "hook_event_name": "PostToolUse",
                    "tool_name": "Task",
                    "tool_input": {"description": "Investigate duplicated hook utilities"},
                },
                env={
                    "MEETING_ROOM_ACTIVE_FILE": str(active_file),
                    "MEETING_ROOM_FALLBACK_LOG": str(fallback_log),
                    "MEETING_ROOM_WS_PORT": str(reserve_tcp_port()),
                    "CLAUDE_TEAM_NAME": "alpha",
                },
                cwd=root,
            )

            self.assertEqual(result.returncode, 0)
            entry = json.loads(fallback_log.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(entry["sender"], "system")
            self.assertEqual(entry["rawType"], "task")
            self.assertIn("Task を作成", entry["content"])


if __name__ == "__main__":
    unittest.main()
