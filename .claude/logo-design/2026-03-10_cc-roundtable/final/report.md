# cc-roundtable Logo — Final Report

## Selected Design: Spiral Inward Glow (v4)

3本のグラデーションアーク（teal→amber）が中心の暖かい光に収束するピンホイール。
「複数のエージェントが集まり、重なり合うことで良いものが生まれる」を表現。

### デザイン要素

| 要素 | 説明 |
|------|------|
| **3本のアーク** | 3つのエージェントが集まる動き。teal系3色で各エージェントの個性 |
| **teal→amber グラデーション** | 外側（冷・個別）→ 中心（温・融合）への変化 |
| **中心の暖色円** | 議論から生まれる成果・価値。roundtable の中心 |
| **3回回転対称** | `<defs>` + `<use>` + `rotate(120°)` で完璧な幾何学的対称 |

### カラーパレット

| 名前 | Hex | 用途 |
|------|-----|------|
| Teal 700 | `#0D9488` | アーク1 グラデーション起点 |
| Teal 400 | `#14B8A6` | アーク2 グラデーション起点 |
| Teal 800 | `#0F766E` | アーク3 グラデーション起点 |
| Amber 500 | `#F59E0B` | 全アーク グラデーション終点 |
| Amber 100 | `#FDE68A` | 中心の暖色円 |
| Slate 900 | `#0F172A` | ダークBG版の背景 |

### 出力ファイル

```
final/logos/
├── icon-color.svg       # フルカラー（透過背景）
├── icon-dark-bg.svg     # ダークBG付き（Slate 900 + rx=28）
├── icon-light-bg.svg    # ライトBG付き（Slate 50 + rx=28）
├── icon-mono-dark.svg   # モノクロ白（暗い背景用）
└── icon-mono-light.svg  # モノクロ黒（明るい背景用）

src/apps/desktop/assets/
├── icon.png             # 1024x1024 PNG（Electron ランタイム用）
└── icon.icns            # macOS アプリアイコン（全サイズ内包）
```

### 設定変更

- `electron-builder.yml`: `mac.icon: assets/icon.icns` 追加、`files` に `assets/**` 追加
- `src/main/index.ts`: `BrowserWindow` に `icon` プロパティ追加

## PDCA 経過サマリー

| Step | 方向性 | 結果 |
|------|--------|------|
| Step 1 | 円卓・コード記号・モノグラム | 「部屋の感覚がない」→ 空間性が必要 |
| Step 2 | 重なる円・リング | V3 Ring Overlap が有望 → もっと明るく、Claude感を |
| Step 3 | リングに装飾（スパークル・ドット）追加 | 「ダサい、まとまりがない」→ 根本的に再考 |
| Step 4 | エージェントチーム再議論、統合シンボル重視 | V5 Negative Room が方向性合致 |
| Step 5 | V5ベースでピンホイール・グラデーション展開 | **V4 Spiral Inward Glow を採用** |

### 却下された案とその理由

| コンセプト | 却下理由 |
|-----------|---------|
| コードブラケット `<>` | 汎用的すぎて cc-roundtable 固有の意味がない |
| CCモノグラム | ブランド名は伝わるがサービスの本質（議論・集合）が見えない |
| 装飾スパークル | 意味のない飾りはまとまりを崩す。全要素に意味が必要 |
| ベン図（重なる円）| 方向としては正しいが、3つの独立した円は「集合」より「分離」に見える |
| ボロメアン結び目 | 複雑すぎて小サイズで認識不能 |

## 技術ノート

### 対称性の保証方法

```xml
<defs>
  <path id="arc" d="M 44.5,36.2 A 34,34 0 0,1 94.8,49.6"/>
</defs>
<use href="#arc" transform="rotate(0, 64, 64)"/>
<use href="#arc" transform="rotate(120, 64, 64)"/>
<use href="#arc" transform="rotate(240, 64, 64)"/>
```

1つのパスを定義し `rotate()` で複製することで、数学的に完璧な3回回転対称を実現。
手動の座標計算によるズレを完全に排除。
