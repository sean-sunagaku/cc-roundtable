"""Shared text filters for Meeting Room hook scripts."""

from __future__ import annotations

import re

from contracts import ResponseMarkers as M

PATH_ONLY_PATTERN = re.compile(r"^(?:/Users/|/home/|[A-Za-z]:\\).+\.(?:jsonl|json|md|txt|log)$")


def is_path_only_reference(value: str) -> bool:
    return bool(PATH_ONLY_PATTERN.match(value.strip()))


def is_single_line_prompt(value: str) -> bool:
    compact = value.strip()
    return compact.startswith("@") and "❯" in compact and "\n" not in compact


def is_valid_message_content(value: str) -> bool:
    compact = value.strip()
    if not compact:
        return False
    if compact.startswith(M.START):
        return False
    if is_single_line_prompt(compact):
        return False
    if is_path_only_reference(compact):
        return False
    return True


def is_valid_assistant_text(value: str) -> bool:
    compact = value.strip()
    if not compact:
        return False
    if is_single_line_prompt(compact):
        return False
    if is_path_only_reference(compact):
        return False
    return True
