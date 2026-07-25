# ISSUE-007: 全変数・テキストラベルの自由ドラッグ移動機能の実装

## 概要 (Overview)
図形要素（`DiagramElement`）、力ベクトル（`force`, `velocity`, `tension`等）、角度（`angle-arc`）、制約記号などの「変数ラベル（テキスト）」について、一部の旧プリセット変数以外のラベルがキャンバス上でクリック・ドラッグ移動できないという不具合・機能不足です。

## 不具合・原因分析 (Root Cause)
- `EditorCanvas.tsx` において、ラベル位置オフセットのドラッグ処理（`dragMode`）が `massLabel`, `angleLabel`, `forceGravityLabel`, `forceNormalLabel`, `forceFrictionLabel` の特定5変数に対してのみハードコードされている。
- catalog要素（`DiagramElement`）の汎用ラベル（例: `label` プロパティや記号 $m, T, F, k, v, \theta$ 等）には `labelOffsetX` / `labelOffsetY` のドラッグ領域検出・hitTest が実装されておらず、マウス操作で移動できない。

## 要求仕様 (Requirements)
1. **全要素のラベル用ドラッグ対応**:
   - すべての図形要素・ベクトル・注釈テキスト・変数のラベルについて、ラベル単体をクリックして任意の場所へドラッグ移動できるようにする。
2. **データモデルの共通プロパティ拡張**:
   - `DiagramElement` に `labelOffsetX?: number`, `labelOffsetY?: number` を追加。
3. **インスペクタでの位置数値調整**:
   - ラベル選択時またはプロパティパネルでラベルの相対位置 (X, Y) を数値調整できるようにする。

## 対象コンポーネント (Affected Files)
- `app/lib/editor-types.ts`: `DiagramElement` への `labelOffsetX/Y` 追加
- `app/components/EditorCanvas.tsx`: 汎用ラベルの hitTest / `dragMode === "element-label"` ドラッグ移動ロジック
- `app/lib/scene-export.ts`: SVG出力時へのラベルオフセット反映

## ステータス (Status)
- **状態**: 起票済み (Open)
- **優先度**: 高 (High)
