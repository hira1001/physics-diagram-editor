# ISSUE-005: CADスタイルの範囲選択（Window / Crossing Box Selection）機能の実装

## 概要 (Overview)
現状、キャンバス上の空白領域をドラッグしても矩形範囲選択（ラバーバンド / Marquee Selection）が発生せず、複数オブジェクトの一括範囲選択が行えません。
本チケットでは、CADソフト（AutoCAD等）で標準的な2種類の範囲選択方式（Window選択・Crossing選択）および複数選択状態の保持機能を実装します。

## 要求仕様 (Requirements)

1. **CADスタイル矩形範囲選択 (Marquee Box Selection)**:
   - キャンバスの空き領域でドラッグした際、選択ボックス（矩形）を表示する。
   - **Window選択（左 $\rightarrow$ 右方向ドラッグ）**:
     - 表示: 青色の背景 / 実線の枠線
     - 動作: 選択枠の中に**完全に含まれる要素のみ**をまとめて選択。
   - **Crossing選択（右 $\rightarrow$ 左方向ドラッグ）**:
     - 表示: 緑色の背景 / 破線の枠線
     - 動作: 選択枠に**一部でも接触・交差している要素**をまとめて選択。

2. **複数選択状態のサポート**:
   - `selectedIds: string[]`（または複数選択ID）をサポートし、選択された全要素のバウンディングボックスと共通の操作ハンドルを表示。
   - Shiftキー＋クリックで選択要素の追加・解除。
   - 複数要素の一括移動・一括削除・グループ化 (`groupId`) サポート。

## 対象コンポーネント (Affected Files)
- `app/lib/editor-types.ts`: 複数選択状態の型定義 (`selectedIds`)
- `app/components/EditorCanvas.tsx`: ドラッグ範囲選択ハンドラー、Marquee枠の描画、交差判定（Crossing / Window）
- `app/components/InspectorPanel.tsx`: 複数選択時の共通一括操作プロパティ表示

## ステータス (Status)
- **状態**: 起票済み (Open)
- **優先度**: 高 (High)
