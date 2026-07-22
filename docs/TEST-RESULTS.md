# 品質テスト実施記録

## 実行中の品質ループ

全319ケースの完了までは本書を継続更新する。部分合格を製品全体の合格とは扱わない。

### 2026-07-23 / P0回帰セット 1

| 対象 | 環境 | 結果 | 証跡 |
|---|---|---|---|
| `VIS-001`, `VIS-017`, `VIS-018` | Unit、Chrome、Firefox、WebKit | 合格 | 5倍率×左右反転の描画順Unit、6枚のVisual Regression基準画像 |
| `DIR-006`, `DIR-008`, `DIR-009` | Chrome、Firefox、WebKit | 合格 | 図全体、`m`、`θ`の実CanvasドラッグE2E |
| `SHL-001`, `SHL-003`, `TPL-001` | Chrome、Firefox、WebKit | 合格 | 初期シェル、不要UI不在、テンプレート開閉・適用E2E |
| `SHL-004`, `REL-001`, `REL-002` | Chrome、Firefox、WebKit | 合格 | 保存中→保存済み、編集後リロード復元E2E |
| `REL-003` | Chrome、Firefox、WebKit | 合格 | UI密度と倍率の再読込復元E2E |
| `REL-004`, `REL-005` | Unit、Chrome、Firefox、WebKit | 合格 | 旧形式移行、不正JSONからの安全復旧 |
| `REL-006` | Chrome、Firefox、WebKit | 合格 | QuotaExceededError時の保存失敗表示E2E |
| `PHY-039`, `ARC-012`（保存入力範囲） | Unit | 合格 | 非有限値・範囲外値の正規化、ページID重複回避 |

### コマンド結果

| コマンド群 | 結果 |
|---|---|
| Unit | 2ファイル、9テスト合格 |
| E2E | 3ブラウザ、30テスト合格 |
| TypeScript | 合格 |
| ESLint | 合格 |
| Production build / server render | 合格 |

### 未解決

- 全319ケースのうち上表以外は未実施または未実装であり、品質ループは継続中。
- 本番依存関係の監査でNext.js配下のPostCSS/Sharpに3件の既知警告が残る。破壊的な自動修正は行わず、互換性を検証できる更新で解消する。
