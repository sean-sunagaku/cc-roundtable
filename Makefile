.PHONY: help install dev daemon daemon-dev public-share public-share-dev public-share-ngrok public-share-ngrok-dev public-share-smoke public-share-api public-share-check typecheck build verify verify-web arch arch-new arch-update contracts contracts-check

help: ## コマンド一覧を表示
	@grep -E '^[a-z][a-z-]*:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

install: ## 依存パッケージをインストール
	npm --prefix src/apps/desktop install

dev: ## Electron アプリを起動 (開発モード)
	npm --prefix src/apps/desktop run dev

daemon: ## daemon 単体を起動 → http://127.0.0.1:4417/web/index.html
	npm --prefix src/apps/desktop run daemon:start

daemon-dev: ## daemon 単体を起動 (watch / 自動再起動)
	npm --prefix src/apps/desktop run daemon:start:dev

public-share: ## Public Share Demo をローカル起動 → http://127.0.0.1:4427/share/demo-share
	npm --prefix src/apps/desktop run public-share:start

public-share-dev: ## Public Share Demo を watch 付きで起動
	npm --prefix src/apps/desktop run public-share:start:dev

public-share-ngrok: ## Public Share Demo を ngrok 付きで起動
	npm --prefix src/apps/desktop run public-share:start:ngrok

public-share-ngrok-dev: ## Public Share Demo を watch + ngrok 付きで起動
	npm --prefix src/apps/desktop run public-share:start:ngrok:dev

public-share-smoke: ## Public Share の軽い疎通確認
	npm --prefix src/apps/desktop run smoke:public-share

public-share-api: ## Public Share API の個別スモーク確認
	node e2e/public-share/api-smoke.mjs

public-share-check: ## Public Share の主要スモークをまとめて実行
	npm --prefix src/apps/desktop run smoke:public-share
	node e2e/public-share/api-smoke.mjs

typecheck: ## 全パッケージの型チェック
	npm --prefix src/apps/desktop run typecheck

build: ## 全体ビルド (web + daemon + main + renderer)
	npm --prefix src/apps/desktop run build

verify: contracts-check ## typecheck + build + contracts-check + e2e:gui (リリース前に必ず実行)
	npm --prefix src/apps/desktop run verify:final

verify-web: ## Web UI の e2e テスト
	npm --prefix src/apps/desktop run e2e:web

contracts: ## TS → Python Hook 定数を生成 (src/packages/meeting-room-hooks/contracts.py)
	node scripts/generate-hook-contracts.mjs

contracts-check: ## contracts.py が最新か + Hook に文字列直書きがないか検証
	node scripts/generate-hook-contracts.mjs --check
	node scripts/check-hook-literals.mjs

arch: ## アーキテクチャ図を生成
	npm --prefix src/apps/desktop run architecture

arch-new: ## アーキテクチャ案の雛形を作成 (slug と title は直接 script に渡す)
	@echo '例: node scripts/scaffold-architecture-definition.mjs current-daemon "Current Daemon Architecture" local-daemon-bff'

arch-update: ## docs/architecture-definitions の SVG と INDEX を一括更新
	node scripts/update-architecture-definitions.mjs
