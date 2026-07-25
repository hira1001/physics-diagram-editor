# Workspace Behavioral Rules

0. **プロダクト方針**: [`docs/PRODUCT-ALIGNMENT.md`](../docs/PRODUCT-ALIGNMENT.md) を正とする。エディタ優先・力学+構造力学同格・レガシー斜面不要・319 全件ゲート不要。
1. **チケット単位の開発フロー (Per-Ticket Workflow)**:
   - 以降の機能実装・バグ修正は、必ず**チケット1件ずつ**以下のサイクルを厳格に実行すること：
     1. チケット仕様の実装
     2. テストの実行・検証 (`npm run typecheck` & `npm run test:unit`)
     3. コミット (`git commit`)
     4. リモートへプッシュ (`git push`)
