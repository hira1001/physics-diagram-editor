# Workspace Behavioral Rules

1. **チケット単位の開発フロー (Per-Ticket Workflow)**:
   - 以降の機能実装・バグ修正は、必ず**チケット1件ずつ**以下のサイクルを厳格に実行すること：
     1. チケット仕様の実装
     2. テストの実行・検証 (`npm run typecheck` & `npm run test:unit`)
     3. コミット (`git commit`)
     4. リモートへプッシュ (`git push`)
