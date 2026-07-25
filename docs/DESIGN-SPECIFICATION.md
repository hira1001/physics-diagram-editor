# 物理図編集エディタ 厳密設計仕様書 (Design & Architecture Specification)

## 1. システム概要と基本設計原則
本設計仕様書は、全11件の指摘事項・機能向上要求に基づき、バグのない確実な実装を行うための基盤設計・データモデル・幾何計算・UI/UX操作インターフェースを厳密に定義したものです。

### 設計基本原則
1. **Zero State Corruption (状態非破壊原則)**: データの拡張や後方互換性フォールバック処理を徹底し、既存データや操作時の崩れを防ぐ。
2. **Minimum-Click Workflow (最小操作回数原則)**: 最低限の操作で受ける力・成分分解・変数が即座に生成・編集できるプロアクティブなUI構造。
3. **Pure Geometric Invariance (幾何不変性原則)**: 図形の拡大・縮小・回転・移動を行っても、接点比率や相対アタッチメントが破綻しない。

---

## 2. データ構造仕様 (Data Models & State Types)

### 2.1 `DiagramElement` の拡張 (`app/lib/editor-types.ts`)
```typescript
export interface DiagramElement {
  id: string;
  kind: DiagramElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  lineWidth: number;
  fontSize: number;
  label: string;
  locked: boolean;
  visible: boolean;

  // 接続ターゲティングとエッジ比率 (ISSUE-001)
  startTargetId: string | null;
  endTargetId: string | null;
  startTargetRatio?: number; // 0.0 ~ 1.0 (線上・エッジ上の位置比率)
  endTargetRatio?: number;   // 0.0 ~ 1.0
  startEdgeIndex?: number;    // 0: Top, 1: Right, 2: Bottom, 3: Left (多角形用)
  endEdgeIndex?: number;

  // 参照ターゲティング
  referenceTargetId: string | null;

  // 汎用ラベルのオフセット (ISSUE-007)
  labelOffsetX?: number;
  labelOffsetY?: number;

  // 斜面・構造スタイルの拡張 (ISSUE-008)
  shapeStyle?: "wedge" | "line"; // 斜面の台形状 or 単線表示
  fillColor?: string;
  strokeColor?: string;
}
```

### 2.2 `SceneState` の拡張 (`app/lib/editor-types.ts`)
```typescript
export interface SceneState {
  // 選択状態の複数保持 (ISSUE-005)
  selectedId: SelectionId;
  selectedIds?: string[]; // 複数選択時のID配列

  // スナップ＆ガイド状態 (ISSUE-003, ISSUE-004)
  snapEnabled: boolean;
  grid: boolean;
  
  // 既存プロパティの完全互換維持
  elements: DiagramElement[];
  variables: Variable[];
  constraints: Constraint[];
  // ... (そのほかのフィールド)
}
```

---

## 3. 各機能の詳細アルゴリズムと挙動仕様

### 3.1 接点の線上・エッジ接続解決ロジック (ISSUE-001)
- **線分・斜面要素の場合**:
  - 対象要素の始点 $P_{\text{start}}$ と終点 $P_{\text{end}}$ に対し、接続点 $P_{\text{conn}} = (1 - t) P_{\text{start}} + t P_{\text{end}}$ （$t \in [0.0, 1.0]$）。
- **多角形（ブロック等）の場合**:
  - `edgeIndex` (0〜3) の辺セグメントを定義し、その辺上で比率 $t$ による位置を世界座標へ変換（回転角 `rotation` を適用）。

### 3.2 テンプレート適用とシート切り替え (ISSUE-002)
- テンプレート選択時:
  - 既存シートを変更せず、`pages` 配列に新規 `DiagramPage` (`kind: "incline" | "freebody" | "blank"`) を一意のID `page-${Date.now()}` で追加。
  - `activePageId` をその新規追加シートのIDに即時更新。

### 3.3 角度スナップと修飾キー制御 (ISSUE-003)
- ドラッグ回転角度 $\theta_{\text{raw}}$ に対し:
  1. 主要角度セット $\Theta = \{0^\circ, 15^\circ, 30^\circ, 45^\circ, 60^\circ, 75^\circ, 90^\circ, 105^\circ, 120^\circ, 135^\circ, 150^\circ, 165^\circ, 180^\circ, \dots\}$ を定義。
  2. `event.altKey` (Option) が true の場合 $\rightarrow$ スナップなし自由回転。
  3. `event.shiftKey` または `event.ctrlKey` が true の場合 $\rightarrow$ 最も近い $15^\circ$ ステップに固定。
  4. 上記以外 $\rightarrow$ $\min_{\alpha \in \Theta} |\theta_{\text{raw}} - \alpha| \le 3^\circ$ であれば $\alpha$ に吸着、それ以外は自由回転。

### 3.4 スマートガイドスナップ＆CAD風範囲選択 (ISSUE-004 & ISSUE-005)
- **要素移動時**:
  - 移動対象のバウンディングボックス中心 $(X_c, Y_c)$ や各辺が他要素の中心・辺と $\le 8\text{px}$ に接近した際、座標を整列吸着させ、赤（X軸揃え）/青（Y軸揃え）の補助破線ガイドを描画。
- **キャンバス空き領域ドラッグ時 (Marquee)**:
  - ドラッグ開始点 $S(x_1, y_1)$ と現在点 $C(x_2, y_2)$ において:
  - **Window選択 ($x_2 \ge x_1$)**: 青背景 (`rgba(59, 130, 246, 0.15)`) + 実線枠。矩形に完全包含される要素のみを選択。
  - **Crossing選択 ($x_2 < x_1$)**: 緑背景 (`rgba(34, 197, 94, 0.15)`) + 破線枠。矩形に一部でも交差・接触する要素を選択。

### 3.5 8点変形ハンドル＆斜面三角形台 (ISSUE-006 & ISSUE-008)
- **8点変形**:
  - 選択要素の周囲に8個のハンドル (NW, N, NE, E, SE, S, SW, W) を描画。
  - N/S/E/W ドラッグ時: 要素のローカル軸に沿って `height` または `width` のみを単方向ストレッチ。
  - NW/NE/SE/SW ドラッグ時: `width` と `height` を自由リサイズ（`Shift` 押下で縦横比 $W/H$ を固定維持）。
- **斜面パーツ**:
  - デフォルト形状 `shapeStyle: "wedge"`（直角三角形台）。
  - 水平面底辺・垂直高さ・斜面からなる多角形 `<polygon>` または Canvas パスを描画し、直角記号 $\llcorner$ を自動表示。

### 3.6 最小操作回数のアノテーション＆全変数ドラッグ (ISSUE-007, ISSUE-009, ISSUE-011)
- **全変数ラベルの独立移動**:
  - 各 `DiagramElement` やベクトルのテキストラベルのバウンディングボックスに対する hitTest を追加。ドラッグ時に `labelOffsetX`, `labelOffsetY` を更新。
- **浮遊クイックアクションバー (Hover Quick Bar)**:
  - 要素選択時、選択枠の上部中央にコンパクトなボタンバーを表示:
    - `[受ける力を自動生成]`: 垂直抗力 $N$、重力 $mg$、摩擦力 $f$、張力 $T$ を一括付与。
    - `[力を成分分解]`: 直角破線成分ベクトル ＋ $F \cos\theta, F \sin\theta$ を一括生成。
    - `[文字変更]`: ラベルテキストのインライン即時編集。

---

## 4. 検証・品質保証計画 (Quality Assurance Plan)
1. **単体テスト (`tests/`)**:
   - 接点比率 $t$ 計算および回転後の座標変換の幾何計算精度テスト。
   - 範囲選択（Window / Crossing）のバウンディングボックス包含・交差判定テスト。
   - テンプレート適用時の `activePageId` 保持テスト。
2. **統合・手動検証**:
   - 開発サーバー (`http://localhost:3001/`) にて、全11件の指摘項目が期待通りに動作し、回帰バグが発生しないことを実機検証。
