# ISSUE-008: 斜面（Incline）パーツの三角形台（Triangular Wedge）表示対応

## 概要 (Overview)
現状の「斜面（`smooth-incline` / `rough-incline`）」パーツの描画が実質的に1本の「直線（＋斜線）」のみとなっており、物理教科書や試験問題で一般的に用いられる「直角三角形の斜面台（ウェッジ形）」になっていないという指摘事項です。

## 不具合・現状の仕様 (Root Cause)
- `catalog-renderer.ts`, `catalog-svg.ts`, `scene-export.ts` での斜面描画ロジックが、斜線（面）の部分のみを描画する `<path>` 単線構造になっている。
- 底辺（水平面）と垂直辺（高さ）で囲まれた「直角三角形の台（三角ウェッジ / Incline Block）」としての面描画・ハッチング・塗りつぶし表現が用意されていない。

## 要求仕様 (Requirements)
1. **直角三角形斜面台（Triangular Incline Wedge）の描画サポート**:
   - 斜面パーツについて、標準で底辺・高さを有する直角三角形（面構造）として描画するモードを追加。
   - 斜面角度 $\theta$ に応じた直角三角形形状の自動計算。
2. **デザイン表現の充実**:
   - 地面（底辺）のハッチング固定固定表記、台内部の薄い塗りつぶし（または透過パターン）、直角マーク（$\llcorner$）の描画。
   - インスペクタにて「単線表示」と「三角形台表示」の切り替えオプションを提供。

## 対象コンポーネント (Affected Files)
- `app/lib/catalog-renderer.ts`: 斜面コンポーネントの Canvas 描画ロジック
- `app/lib/catalog-svg.ts` & `scene-export.ts`: SVG出力描画
- `app/components/InspectorPanel.tsx`: 斜面形状プロパティ表示

## ステータス (Status)
- **状態**: 起票済み (Open)
- **優先度**: 高 (High)
