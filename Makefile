.PHONY: help install dev daemon daemon-dev typecheck build verify verify-web arch

help: ## コマンド一覧を表示
	@grep -E '^[a-z][a-z-]*:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## 依存パッケージをインストール
	npm --prefix electron install

dev: ## Electron アプリを起動 (開発モード)
	npm --prefix electron run dev

daemon: ## daemon 単体を起動 → http://127.0.0.1:4417/web/index.html
	npm --prefix electron run daemon:start

daemon-dev: ## daemon 単体を起動 (watch / 自動再起動)
	npm --prefix electron run daemon:start:dev

typecheck: ## 全パッケージの型チェック
	npm --prefix electron run typecheck

build: ## 全体ビルド (web + daemon + main + renderer)
	npm --prefix electron run build

verify: ## typecheck + build + e2e:gui (リリース前に必ず実行)
	npm --prefix electron run verify:final

verify-web: ## Web UI の e2e テスト
	npm --prefix electron run e2e:web

arch: ## アーキテクチャ図を生成
	npm --prefix electron run architecture
