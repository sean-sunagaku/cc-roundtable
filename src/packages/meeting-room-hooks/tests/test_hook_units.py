from __future__ import annotations

import io
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


HOOKS_DIR = Path(__file__).resolve().parents[1]
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

import hook_common
import hook_text
import hook_transport
from contracts import ApprovalGateFields as AG
from contracts import HookEnvVars as E
from contracts import RelayPayloadFields as F
from contracts import ResponseMarkers as M


def load_hook_module(module_name: str, filename: str):
    spec = importlib.util.spec_from_file_location(module_name, HOOKS_DIR / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


approval_gate = load_hook_module("approval_gate", "approval-gate.py")
enforce_broadcast = load_hook_module("enforce_broadcast", "enforce-broadcast.py")
stop_relay = load_hook_module("stop_relay", "stop-relay.py")
team_event_relay = load_hook_module("team_event_relay", "team-event-relay.py")
ws_relay = load_hook_module("ws_relay", "ws-relay.py")


class HookCommonTests(unittest.TestCase):
    def test_as_str_and_get_env_str_trim_values(self) -> None:
        self.assertEqual(hook_common.as_str("  value  "), "value")
        self.assertEqual(hook_common.as_str(123), "")
        self.assertEqual(
            hook_common.get_env_str("MEETING_ROOM_TEST", env={"MEETING_ROOM_TEST": "  present  "}),
            "present",
        )

    def test_default_meeting_room_path_uses_cwd(self) -> None:
        path = hook_common.default_meeting_room_path("logs", "hook.jsonl", cwd=Path("/tmp/work"))
        self.assertEqual(path, Path("/tmp/work/.claude/meeting-room/logs/hook.jsonl"))

    def test_candidate_active_paths_include_env_and_default_locations(self) -> None:
        paths = hook_common.candidate_active_paths(
            env={E.ACTIVE_FILE: "/tmp/custom.active"},
            cwd=Path("/tmp/project"),
            home=Path("/tmp/home"),
        )
        self.assertEqual(
            paths,
            [
                Path("/tmp/custom.active"),
                Path("/tmp/project/.claude/meeting-room/.active"),
                Path("/tmp/home/.claude/meeting-room/.active"),
            ],
        )

    def test_is_meeting_mode_active_checks_any_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            active = root / ".claude" / "meeting-room" / ".active"
            active.parent.mkdir(parents=True, exist_ok=True)
            active.write_text("", encoding="utf-8")

            self.assertTrue(
                hook_common.is_meeting_mode_active(
                    env={},
                    cwd=root,
                    home=Path("/tmp/unused-home"),
                )
            )

    def test_is_subagent_context_uses_env(self) -> None:
        self.assertTrue(hook_common.is_subagent_context(env={"CLAUDE_SUBAGENT_NAME": "researcher"}))
        self.assertFalse(hook_common.is_subagent_context(env={}))

    def test_parse_json_stdin_returns_only_dict_payloads(self) -> None:
        self.assertEqual(hook_common.parse_json_stdin(io.StringIO('{"ok": true}')), {"ok": True})
        self.assertEqual(hook_common.parse_json_stdin(io.StringIO('["list"]')), {})
        self.assertEqual(hook_common.parse_json_stdin(io.StringIO("{not-json")), {})

    def test_extract_mapping_returns_dict_only(self) -> None:
        payload = {"meta": {"value": 1}, "content": "hello"}
        self.assertEqual(hook_common.extract_mapping(payload, "meta"), {"value": 1})
        self.assertEqual(hook_common.extract_mapping(payload, "content"), {})

    def test_resolve_repo_root_prefers_settings_then_hooks_then_project(self) -> None:
        settings_env = {E.SETTINGS_FILE: "/repo/.claude/settings.json"}
        self.assertEqual(hook_common.resolve_repo_root(env=settings_env), Path("/repo"))

        hooks_env = {E.HOOKS_DIR: "/repo/src/packages/meeting-room-hooks"}
        self.assertEqual(hook_common.resolve_repo_root(env=hooks_env), Path("/repo/src/packages"))

        project_env = {"CLAUDE_PROJECT_DIR": "/repo/project"}
        self.assertEqual(hook_common.resolve_repo_root(env=project_env), Path("/repo/project"))

    def test_resolve_repo_root_falls_back_to_cwd(self) -> None:
        self.assertEqual(hook_common.resolve_repo_root(env={}, cwd=Path("/tmp/project")), Path("/tmp/project"))

    def test_resolve_approval_file_prefers_direct_path(self) -> None:
        path = hook_common.resolve_approval_file(env={E.APPROVAL_FILE: "/tmp/approval.json"})
        self.assertEqual(path, Path("/tmp/approval.json"))

    def test_resolve_approval_file_returns_none_without_meeting_id(self) -> None:
        self.assertIsNone(hook_common.resolve_approval_file(env={}))

    def test_resolve_approval_file_uses_custom_dir_or_repo_root(self) -> None:
        custom_dir_path = hook_common.resolve_approval_file(
            env={E.MEETING_ID: "meeting-1", E.APPROVAL_DIR: "/tmp/approval"},
        )
        self.assertEqual(custom_dir_path, Path("/tmp/approval/meeting-1.json"))

        repo_root_path = hook_common.resolve_approval_file(
            env={E.MEETING_ID: "meeting-2"},
            repo_root=Path("/repo"),
        )
        self.assertEqual(repo_root_path, Path("/repo/.claude/meeting-room/approval/meeting-2.json"))


class HookTextTests(unittest.TestCase):
    def test_path_only_reference_detection(self) -> None:
        self.assertTrue(hook_text.is_path_only_reference("/Users/test/debug.jsonl"))
        self.assertFalse(hook_text.is_path_only_reference("debug.jsonl is available"))

    def test_single_line_prompt_detection(self) -> None:
        self.assertTrue(hook_text.is_single_line_prompt("@agent ❯ continue"))
        self.assertFalse(hook_text.is_single_line_prompt("@agent\n❯ continue"))

    def test_valid_message_content_filters_internal_noise(self) -> None:
        self.assertFalse(hook_text.is_valid_message_content(""))
        self.assertFalse(hook_text.is_valid_message_content(f"{M.START}\nbody"))
        self.assertFalse(hook_text.is_valid_message_content("@agent ❯ continue"))
        self.assertFalse(hook_text.is_valid_message_content("/Users/test/debug.json"))
        self.assertTrue(hook_text.is_valid_message_content("hello team"))

    def test_valid_assistant_text_filters_prompts_and_paths(self) -> None:
        self.assertFalse(hook_text.is_valid_assistant_text("@agent ❯ continue"))
        self.assertFalse(hook_text.is_valid_assistant_text("/Users/test/debug.json"))
        self.assertTrue(hook_text.is_valid_assistant_text("final answer"))


class HookTransportTests(unittest.TestCase):
    def test_load_ws_config_uses_defaults_and_handles_invalid_values(self) -> None:
        default_config = hook_transport._load_ws_config(env={})
        self.assertEqual(default_config.host, "127.0.0.1")
        self.assertEqual(default_config.port, 9999)
        self.assertEqual(default_config.path, "/")
        self.assertEqual(default_config.timeout, 0.8)

        invalid_config = hook_transport._load_ws_config(
            env={E.WS_PORT: "not-a-port", E.WS_TIMEOUT: "oops", E.WS_HOST: "localhost", E.WS_PATH: "/relay"}
        )
        self.assertEqual(invalid_config.host, "localhost")
        self.assertEqual(invalid_config.port, 9999)
        self.assertEqual(invalid_config.path, "/relay")
        self.assertEqual(invalid_config.timeout, 0.8)

    def test_append_jsonl_and_resolve_log_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            log_path = root / "logs" / "events.jsonl"
            hook_transport.append_jsonl(log_path, {"ok": True})
            self.assertEqual(json.loads(log_path.read_text(encoding="utf-8").splitlines()[0]), {"ok": True})

            resolved = hook_transport.resolve_log_path(
                log_path,
                env_var=E.FALLBACK_LOG,
                env={E.FALLBACK_LOG: str(root / "custom.jsonl")},
            )
            self.assertEqual(resolved, root / "custom.jsonl")

    def test_relay_json_with_fallback_appends_when_ws_send_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fallback_path = root / "fallback.jsonl"

            with mock.patch.object(hook_transport, "send_ws_json", side_effect=RuntimeError("down")):
                hook_transport.relay_json_with_fallback(
                    {"content": "hello"},
                    default_log_path=root / "default.jsonl",
                    fallback_env_var=E.FALLBACK_LOG,
                    env={E.FALLBACK_LOG: str(fallback_path)},
                )

            entry = json.loads(fallback_path.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(entry["content"], "hello")


class ApprovalGateTests(unittest.TestCase):
    def test_parse_approval_state_and_bypass_mode(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "approval.json"
            path.write_text(json.dumps({AG.MODE: "open"}), encoding="utf-8")
            self.assertEqual(approval_gate.parse_approval_state(path), {AG.MODE: "open"})

            invalid_path = Path(temp_dir) / "invalid.json"
            invalid_path.write_text("{oops", encoding="utf-8")
            self.assertIsNone(approval_gate.parse_approval_state(invalid_path))

        self.assertTrue(approval_gate.is_bypass_mode_enabled(True))
        self.assertTrue(approval_gate.is_bypass_mode_enabled(" yes "))
        self.assertFalse(approval_gate.is_bypass_mode_enabled("no"))


class EnforceBroadcastTests(unittest.TestCase):
    def test_extract_send_message_type_prefers_tool_input(self) -> None:
        self.assertEqual(
            enforce_broadcast.extract_send_message_type({"tool_input": {"type": "broadcast"}, "type": "message"}),
            "broadcast",
        )
        self.assertEqual(enforce_broadcast.extract_send_message_type({"type": "message"}), "message")
        self.assertIsNone(enforce_broadcast.extract_send_message_type({}))


class TeamEventRelayTests(unittest.TestCase):
    def test_should_emit_detects_supported_tool_names(self) -> None:
        self.assertEqual(team_event_relay.should_emit({"tool_name": "Task"}), (True, "task"))
        self.assertEqual(
            team_event_relay.should_emit({"metadata": {"tool_name": "create-team"}}),
            (True, "create-team"),
        )
        self.assertEqual(team_event_relay.should_emit({"tool_name": "ReadFile"}), (False, "readfile"))

    def test_build_event_message_formats_team_create_and_task(self) -> None:
        with mock.patch.object(team_event_relay, "get_env_str", side_effect=lambda name: {"CLAUDE_TEAM_NAME": "alpha", E.MEETING_ID: "meeting-1"}.get(name, "")):
            team_message = team_event_relay.build_event_message({"tool_input": {"members": ["a", "b"]}}, "teamcreate")
            task_message = team_event_relay.build_event_message(
                {"tool_input": {"description": "Investigate a very long task " * 20}},
                "task",
            )

        self.assertEqual(team_message[F.SENDER], "system")
        self.assertIn("メンバー数: 2", team_message[F.CONTENT])
        self.assertEqual(team_message[F.MEETING_ID], "meeting-1")
        self.assertIn("Task を作成", task_message[F.CONTENT])
        self.assertTrue(task_message[F.CONTENT].endswith("..."))


class WsRelayTests(unittest.TestCase):
    def test_sender_from_agent_id(self) -> None:
        self.assertEqual(ws_relay._sender_from_agent_id("planner@alpha"), "planner")
        self.assertEqual(ws_relay._sender_from_agent_id("leader"), "leader")

    def test_resolve_message_prefers_routing_sender_and_content(self) -> None:
        payload = {
            "tool_input": {"type": "broadcast", "content": "fallback content"},
            "tool_response": {"routing": {"sender": "planner", "content": "hello team"}},
            "metadata": {"team": "alpha", F.MEETING_ID: "meeting-1"},
            "agent_id": "planner@alpha",
        }
        with mock.patch.object(ws_relay, "get_env_str", return_value=""):
            resolved = ws_relay._resolve_message(payload)

        self.assertEqual(resolved.sender, "planner")
        self.assertEqual(resolved.subagent, "planner")
        self.assertEqual(resolved.content, "hello team")
        self.assertEqual(resolved.team, "alpha")
        self.assertEqual(resolved.meeting_id, "meeting-1")
        self.assertEqual(resolved.raw_type, "broadcast")
        self.assertEqual(resolved.sender_source, "routing")

    def test_resolve_message_falls_back_to_env_or_leader(self) -> None:
        payload = {
            "tool_input": {"content": "/Users/test/debug.jsonl"},
            "metadata": {},
            "agent_id": "",
        }

        def env_lookup(name: str) -> str:
            return {"CLAUDE_SUBAGENT_NAME": "reviewer", "CLAUDE_TEAM_NAME": "beta"}.get(name, "")

        with mock.patch.object(ws_relay, "get_env_str", side_effect=env_lookup):
            resolved = ws_relay._resolve_message(payload)
        self.assertEqual(resolved.sender, "reviewer")
        self.assertEqual(resolved.sender_source, "env_subagent")
        self.assertEqual(resolved.content, "")
        self.assertEqual(resolved.team, "beta")

        with mock.patch.object(ws_relay, "get_env_str", return_value=""):
            fallback = ws_relay._resolve_message({"tool_input": {}, "tool_response": {}, "metadata": {}, "agent_id": ""})
        self.assertEqual(fallback.sender, "leader")
        self.assertEqual(fallback.sender_source, "fallback")

    def test_build_message_and_write_debug(self) -> None:
        resolved = ws_relay.ResolvedMessage(
            sender="planner",
            subagent="planner",
            content="hello team",
            team="alpha",
            meeting_id="meeting-1",
            raw_type="broadcast",
            sender_source="routing",
        )
        message = ws_relay.build_message(resolved)
        self.assertEqual(message[F.SENDER], "planner")
        self.assertEqual(message[F.CONTENT], "hello team")
        self.assertEqual(message[F.MEETING_ID], "meeting-1")

        with tempfile.TemporaryDirectory() as temp_dir:
            debug_path = Path(temp_dir) / "ws-debug.jsonl"
            with mock.patch.object(ws_relay, "get_env_str", side_effect=lambda name: str(debug_path) if name == E.WS_DEBUG_LOG else ""):
                ws_relay.write_debug({"tool_input": {}, "tool_response": {}, "metadata": {}}, resolved)
            entry = json.loads(debug_path.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(entry["resolvedSender"], "planner")
            self.assertEqual(entry[F.MEETING_ID], "meeting-1")


class StopRelayTests(unittest.TestCase):
    def test_extract_text_blocks_and_pick_best_text(self) -> None:
        blocks = stop_relay._extract_text_blocks(
            [
                {"type": "text", "text": "first"},
                {"content": [{"type": "text", "text": "second"}]},
                "third",
            ]
        )
        self.assertEqual(blocks, ["first", "first", "second", "second", "third"])
        self.assertEqual(stop_relay._pick_best_text(["x", "longer text", "x"]), "longer text")

    def test_extract_assistant_text_from_record(self) -> None:
        record = {"role": "assistant", "message": [{"type": "text", "text": "final answer"}]}
        self.assertEqual(stop_relay._extract_assistant_text_from_record(record), "final answer")
        self.assertEqual(stop_relay._extract_assistant_text_from_record({"role": "user"}), "")

    def test_extract_assistant_from_transcript_reads_latest_assistant_message(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            transcript = Path(temp_dir) / "transcript.jsonl"
            transcript.write_text(
                "\n".join(
                    [
                        json.dumps({"role": "user", "message": "hello"}, ensure_ascii=False),
                        json.dumps({"role": "assistant", "message": [{"type": "text", "text": "latest answer"}]}, ensure_ascii=False),
                    ]
                ),
                encoding="utf-8",
            )
            self.assertEqual(
                stop_relay._extract_assistant_from_transcript({"transcript_path": str(transcript)}),
                "latest answer",
            )

    def test_extract_assistant_response_prefers_env_then_direct_then_transcript(self) -> None:
        with mock.patch.object(stop_relay, "get_env_str", side_effect=lambda name: {"CLAUDE_RESPONSE": "env answer"}.get(name, "")):
            self.assertEqual(stop_relay.extract_assistant_response({}), "env answer")

        with mock.patch.object(stop_relay, "get_env_str", return_value=""):
            direct = stop_relay.extract_assistant_response({"assistant_message": "direct answer"})
        self.assertEqual(direct, "direct answer")

        with tempfile.TemporaryDirectory() as temp_dir:
            transcript = Path(temp_dir) / "transcript.jsonl"
            transcript.write_text(
                json.dumps({"role": "assistant", "message": [{"type": "text", "text": "transcript answer"}]}, ensure_ascii=False),
                encoding="utf-8",
            )
            with mock.patch.object(stop_relay, "get_env_str", return_value=""):
                transcript_value = stop_relay.extract_assistant_response({"transcript_path": str(transcript)})
            self.assertEqual(transcript_value, "transcript answer")

    def test_build_message_and_write_debug(self) -> None:
        def env_lookup(name: str) -> str:
            return {
                "CLAUDE_AGENT_NAME": "leader",
                "CLAUDE_TEAM_NAME": "alpha",
                E.MEETING_ID: "meeting-2",
            }.get(name, "")

        with mock.patch.object(stop_relay, "get_env_str", side_effect=env_lookup):
            message = stop_relay.build_message("final answer")
        self.assertEqual(message[F.SENDER], "leader")
        self.assertIn(M.START, message[F.CONTENT])
        self.assertEqual(message[F.MEETING_ID], "meeting-2")

        with tempfile.TemporaryDirectory() as temp_dir:
            debug_path = Path(temp_dir) / "stop-debug.jsonl"

            def debug_env_lookup(name: str) -> str:
                return str(debug_path) if name == E.STOP_DEBUG_LOG else ""

            with mock.patch.object(stop_relay, "get_env_str", side_effect=debug_env_lookup):
                stop_relay.write_debug({"assistant_message": "hello"}, "hello")
            entry = json.loads(debug_path.read_text(encoding="utf-8").splitlines()[0])
            self.assertTrue(entry["hasContent"])
            self.assertEqual(entry["contentPreview"], "hello")


if __name__ == "__main__":
    unittest.main()
