# M9-04 レビュー報告書

## 総評

FR703 編集グリッド仕上げ（要確認再導出・ラッシュボタン非活性化・表示順並び替え）の実装は、指示書 v1.0.2・チェックリスト v1.0.0・CHANGE-034 の全要求を満たしており、**完了承認可（重大ゼロ）**と判断する。Plan Mode 2 項目（接地点＝`MoveResponse.warnings` 後方互換加算 / 判定一致＝`movesimport` 共有・dedup）が確定どおり実装され、取込プレビューと編集グリッドの WarningCode 判定が単一ホワイトリスト・単一関数（`DeriveStoredWarnings` ＋ `normalizeProperties`/`validateComboScaling`）に集約されている。`move/service.go` の重複 `knownProperties` も `movesimport.IsKnownProperty` へ寄せられ、フロントも `web/src/constants/move-warning.ts` を単一情報源化した。MoveResponse 既存契約は不変で、`comboScaling` は算出内部使用のみ・JSON 非露出。テスト・E2E も全パスを確認。指摘は低優先の観察のみ。

## 設計準拠性レビュー結果

### §1.1 要確認再導出（指示書 §4.1 / DES-002 §4.2 / DES-005 §5.17）— ◎
- `MoveResponse` に `warnings: WarningCode[]` を加算（`dto.go:32`、`json:"warnings"` omitempty なし＝常時 `[]`）。`handler.go:55-73` の `List` でサーバ算出。`DeriveStoredWarnings` は `make([]WarningCode, 0)` を返すため null になり得ず、`TestHandler_List_Warnings` が JSON レベルで `warnings` キー常時出力を検証済み。
- 算出4種を網羅：`total_null` / `unknown_properties` / `unknown_combo_scaling_key` / `extra_throw`（`warning.go:36-52`）。recovery_word は再導出不可で total_null 吸収＝設計どおり（`warning.go:8-9` コメント明記）。
- `unknown_combo_scaling_key` は `validateComboScaling`（正準4キー `comboScalingKeys`、parse 失敗も検出）を取込プレビューと共有。`unknown_properties` は `knownProperties`（high/mid/low/throw/projectile/air_projectile）を共有。
- `extra_throw` はキャラ内通常投げ 3 件目以降。`ListByCharacter` が `ORDER BY m.id`（`queries.go:30`）で取込順＝ID 昇順を保証し、`List` が当該キャラ全行をまとめて `DeriveStoredWarnings` に渡すため採番が取込プレビュー（`parse.go:215-219`）と一致。

### §1.2 判定ロジックの一致（指示書 §3.4-2 / §4.1）— ◎
- 取込プレビュー（`parse.go` parseRow）と再導出（`warning.go`）が**同一述語**（`knownProperties` / `comboScalingKeys` / `validateComboScaling`）を参照。二重実装なし。
- `TestStoredWarnings_ShareWhitelistWithPreview`（`warning_test.go:134-159`）が properties・combo_scaling とも「同一入力 → 同一結果」を述語レベルで検証。後述の properties end-to-end 差分も明示的に文書化済み。

### §1.3 表示順（指示書 §4.3 / DES-005 §5.18）— ◎
- クライアント列ソートのみ（`MoveEditGrid.tsx:407,420-423`）。`null` 安定末尾送り（`compareBySort`）、`localeCompare(..., "ja")`。DB 並び・主キー・API・スキーマ不変。`localStorage` 等の永続化なし（CLAUDE.md §10.X 遵守）。Vitest が「ソートで順序変化 ＆ API 不呼出」を検証（`MoveEditGrid.test.tsx:190-218`）。

### §2 API 整合性 — ◎
- `warnings` は後方互換の純加算。MoveResponse 既存フィールドは `toMoveResponse` で不変（`dto.go:40-58`）。`TestHandler_List_Warnings` が既存キー存在 ＋ `comboScaling` 非露出を JSON で検証。
- `PATCH` / `rush-variant` / `GET /api/moves/:id` の既存契約（CHANGE-031/032）に変更なし（`MoveDetailResponse`・ハンドラ未変更）。

### §3 フロントエンド動作仕様 — ◎
- warnings 全種を `WARNING_LABEL_JA` で §5.17 同表現の Badge 強調（`MoveEditGrid.tsx:179-183`）。`moveNeedsConfirmation` を warnings ベースへ変更（`types.ts:103-105`）。
- ラッシュ版ボタン：既存活性条件（`isRushEligible` ∧ 非 dirty〔`isAerialDirty`〕）に「未生成」を AND（`MoveEditGrid.tsx:269-271`）。後段 409 経路も保険として残置（`handleRush` の 409 ハンドリング `:160-163`、サーバ `handler.go:137-140`）。
- 表示順並び替え（列ソート）動作。

### §4 テスト妥当性 — ◎
- Go：種別別付与・extra_throw 採番（非 throw 無視含む）・空配列形状・述語パリティ（`warning_test.go`）。ハンドラで warnings 付与・既存不変・comboScaling 非露出（`handler_test.go:122-210`）。`go test ./internal/...`（対象3パッケージ）パス確認。
- Vitest：warnings 全種強調 / 空時非強調 / rush 既存非活性 / ソートが API 不呼出（`MoveEditGrid.test.tsx` 12 ケース）。当方でも `vitest run` 12/12 パス確認。
- E2E：完了報告に `make e2e` 3 spec パスの記録あり（当方は実行せず＝制約事項）。

### §5 設計意図 — ◎ / §6 規約 — ◎ / §7 非破壊性 — ◎ / §8 ドキュメント — ○
- 単一判定実装・読取時算出（スキーマ不変・列追加なし）・表示順表示のみ、いずれも充足。
- camelCase 統一（`warnings` / `comboScaling`）。WarningCode enum はバックエンド `types.go`（5値）とフロント `WARNING_CODE_VALUES`（5値）が一致同期。`import/types.ts` は後方互換エイリアス再エクスポートで非破壊集約。
- §8：DES-002/DES-005 の改訂は CHANGE-034 記載文と**逐語一致**し、版数（v1.18.0 / v2.19.0）・ステータス行履歴も整備されている＝設計担当による反映の体裁。製造担当が独自に DES 本体を改変した形跡はない（OK）。ただし当該編集が本 feature ブランチ上にコミットされている点は、コミット主体をコード上から断定できないため後述「不明」に記載。

## 設計準拠性以外の指摘事項

- **命名・構造**：`movesimport.StoredMove` / `DeriveStoredWarnings` / `IsKnownProperty` の責務分割が明快で godoc も充実。`move` ハンドラ → `movesimport` の依存方向は単方向で循環なし（指示書 §4.1 要件を満たす）。
- **ラッシュ非活性の判定キー**：指示書 §4.2 は「`code = rush_<元技code>` の存在」を例示するが、実装は `category === "rush_variant" && originalMoveId` で元技 id 集合を作る方式（`MoveEditGrid.tsx:410-418`）。`original_move_id` は生成時必須設定のため文字列 code 照合より堅牢で、意味的に等価。逸脱ではなく改善と評価。
- `console.log` / `fmt.Println` 等のデバッグ残骸なし。`eslint-disable` / `nolint` 濫用なし。

## 推奨修正（優先度別）

- **高（M9 完了前に修正必須）**：なし。
- **中（M10 着手と並行可）**：なし。
- **低（将来対応）**：
  1. `DeriveStoredWarnings` の extra_throw 採番は「渡されたスライスがキャラ単位・ID 昇順」前提（godoc 明記済み）。現状唯一の呼出元 `List` はこの前提を満たすが、将来別キャラ混在で呼ぶと採番が崩れる。防御的にキャラ ID をキーにカウントする／前提を assert する余地（実害は現状なし）。
  2. properties のパリティは end-to-end では不一致が正（取込時 `normalizeProperties` が未知主属性を raw_data 退避し列を NULL 化）。`TestStoredWarnings_ShareWhitelistWithPreview` 冒頭コメントと progress-log で十分に文書化されているが、再導出 `unknown_properties` は実質「PATCH 等で値域外値が保存された場合の防御検出」に限られる旨を DES 側脚注に残すと将来の誤解防止になる（設計担当判断・任意）。
  3. M9-04-overview.md に delete→restore→delete の往復履歴が残る（progress-log 申し送り済み）。push 前に開発者が squash 整理する想定で問題なし。

## 良かった点（Claude Code へのフィードバック）

- Plan Mode 確定事項を逸脱なく実装し、**二重実装の乖離防止**という設計意図を述語・関数・ホワイトリストの3レベルで単一情報源化した点が秀逸（バックエンド `IsKnownProperty` 集約、フロント `move-warning.ts` 集約）。
- パリティの「end-to-end では一致しないが述語レベルでは一致する」という非自明な性質を、テストコメント・progress-log で正確に言語化し、誤った end-to-end パリティテストを書かなかった判断が的確。
- MoveResponse 契約不変（`comboScaling` 非露出）を JSON レベルでアサートするテストを置き、後方互換加算の検証を機械化している。
- スコープ厳守：列追加・API 変更・余計なリファクタに踏み込まず、dedup も指示された範囲（重複 `knownProperties`）に限定。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実機での視覚/レスポンシブ確認・`make e2e` の実走（完了報告の記録に依拠）・パフォーマンス計測は別途実施が必要。
- **不明**：DES-002/DES-005 の改訂コミット（範囲内 `3304c54` 等）が設計担当・開発者・製造担当のいずれの手によるものか、コミット作者情報からは断定できない。内容は CHANGE-034 と逐語一致し設計担当反映の体裁を満たすため §8 は OK と判定したが、運用上「製造担当が DES 本体を直接編集していない」ことの最終確認は開発者に委ねる。
