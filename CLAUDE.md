# Meeting Room - Claude Entry

Claude 系エージェント向けの入口です。正本は `AGENTS.md` に寄せ、ここは最短導線だけに絞ります。

## このファイルの役割

- Claude 系エージェントが最初に読む短い案内
- 詳細説明は `AGENTS.md` と `docs/` へ誘導
- 実装ルールの正本は `AGENTS.md`

## 最初に読む順番

1. `docs/service-overview.md`
2. `README.md`
3. `AGENTS.md`
4. `docs/design/meeting-room-product-design.md`

## まず押さえること

- 実装コードは `src/` 配下に集約されている
- 主系は daemon-first
- Electron は `src/apps/desktop`
- Browser UI は `src/apps/web`
- daemon は `src/daemon`
- hooks は `src/packages/meeting-room-hooks`

## よく使うコマンド

```bash
make install
make dev
make daemon
make typecheck
make verify
```

## 詳細の置き場所

- 実装・既知不具合・運用ルール: `AGENTS.md`
- サービス概要: `docs/service-overview.md`
- 設計資料: `docs/design/meeting-room-product-design.md`
