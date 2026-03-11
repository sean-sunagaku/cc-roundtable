# Web Interface Parity Plan

## Objective

Electron と同等の会議体験を、daemon-first のまま Web UI でも提供する。

## Delivery Order

1. Planning / nested TODO / review workflow
2. Backend parity (agent profiles, default project dir, init prompt, summary)
3. Web UI parity (setup, meeting, approval, terminal/debug, recovering)
4. Build / serve / E2E integration
5. Docs sync and final verification

## Review Workflow

- 細かい ToDo が終わるたびに、実装担当とは別レビュー担当で差分確認を行う。
- 指摘が残る場合は `doing` に戻し、修正後に再レビューする。
- レビュー結果は `plans/tasks/current-tasks.md` の review log に残す。
- 実装中に不足タスクが見つかったら、この plan と `plans/tasks/current-tasks.md` の両方へ追記する。

## Current Focus

- W2-W4: backend parity / Web shell / build-serve / Web E2E まで実装済み
- W5.1: `npm --prefix src/apps/desktop run e2e:web` と `npm --prefix src/apps/desktop run verify:final` は成功
- W5.2: `chrome-devtools` tool が `Transport closed` で復旧できず、手動確認だけ blocked
- W6: README / service-overview / AGENTS / CLAUDE / TODO を同期済み
