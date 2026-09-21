# M14-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M14-02（取込パイプライン段階削除＝共有シンボル中立移設→`movesimport` 削除→画面17 除去・FR704 降格） |
| 対象ブランチ | `feature/M14-02`（`a1f498c..HEAD`、コミット 994d4da / b4cdd5c / b5b74de） |
| レビュー担当 | 品質レビュー担当 Claude（Opus 4.8）/ 2026-06-30 |
| 判定 | **合格（重大ゼロ）**。§9 重大判定基準に該当する指摘なし。 |

## 総評

逆依存解消（技編集→取込パッケージ）の本質を正しく捉えた、非常にクリーンな段階削除である。共有シンボル `WarningCode`/`StoredMove`/`DeriveStoredWarnings` を中立 `internal/service/movewarning` へ移設し、`movesimport` の Go/FE/repository/テスト/e2e/ルート/ナビを過不足なく除去している。`go build` / `go vet` / `go test ./...` / `pnpm tsc --noEmit` を当方で再実行し全て通過、`movesimport` への実コード参照ゼロ（残存はコメントのみ）、取込エンドポイント未登録、温存対象（技編集・SSOT・スキーマ・comboio）の非破壊を確認した。死蔵 3 ラベルの整理・取込専用 repository メソッド削除・F1 dead code 削除も完遂しており死蔵残置なし。指示書 v1.0.1 の追加要件をすべて満たす。重大・高指摘なし、軽微の持ち越しのみ。

## 設計準拠性レビュー結果

### §1 設計書本体・上位文書との照合

- **§1.1 共有シンボル移設 ◎**: `movewarning.go` に `WarningCode`(`total_null`/`extra_throw`)・`StoredMove`・`DeriveStoredWarnings` を移設。`api/move/dto.go`・`handler.go` の参照を中立へ差し替え済み。`IsKnownProperty` は移設せず `movesimport` ごと削除（消費者ゼロを `grep` で確認＝`service/move` から完全消失、コメント言及のみ）。依存方向は技編集→`movewarning` の一方向で逆依存解消。FE `move-warning.ts` は `total_null`/`extra_throw` のみへ縮小しファイル温存。すべて指示書 §4.1・§2.2 どおり。
- **§1.2 `movesimport` 削除 ◎**: `internal/service/movesimport/`・`internal/api/movesimport/` がディレクトリごと消滅（`ls` で不存在確認）。F1 dead code（`validateComboScaling`/`comboScalingKeys`）も同時消滅。取込エンドポイント登録・ハンドラ・取込テスト（commit_test/parse_test）除去。取込専用 repository メソッド `UpsertMove`/`UpsertOfficialJaAlias` を `upsert.go`・interface 宣言・`service_test.go` fakeRepo モックの 3 箇所すべてから除去済み。
- **§1.3 画面17・FE 取込削除 ◎**: `web/src/features/import/`・`ImportMovesPage.tsx`(+test) 削除、`router.tsx` から `/import/moves` ルート除去、`Header.tsx` から「技取込」ナビ除去、`web/e2e/import-moves.spec.ts` 削除。画面18（技編集）の型・導線・SSOT 参照は不変。
- **§1.4 DES 直接編集禁止 ◎**: `git diff a1f498c..HEAD --stat -- docs/design/` は空＝REQ-001/DES-002/DES-005 本体への直接編集なし。`docs/progress/m14-02-design-handoff.md` で CHANGE-055 材料（FR704 降格・§4.2/§7.5・§5.17/§4.1）を申し送り。正しい運用。

### §2 段階削除の健全性 ◎

コミット粒度が「Go 段階（994d4da）→ FE 段階（b4cdd5c）→ docs（b5b74de）」に分離され、中立移設＋参照差し替え＋取込削除を 1 コミットに束ねた Go 段階単独で `go build` が通る構成（当方で HEAD において build/vet/test 全通過を確認）。移設前に取込を削除して技編集がコンパイル不能になる順序破綻はなし。repository interface の取込専用判定（技編集は `ListByCharacter`/`GetByID`/`UpdateFields`/`InsertRushVariant` のみ使用）も正確で、共有メソッドの誤削除なし。

### §3 温存対象の非破壊 ◎

- 技編集（`service/move`・GET/PATCH `/api/moves`・rush・notes_tool）は参照先パッケージ差し替えのみで挙動不変。`go test ./internal/service/move/... ./internal/api/move/...` 通過。
- `move-warning.ts` SSOT はファイル温存・2 種へ縮小。`features/moves/types.ts`・`MoveEditGrid.tsx` が新値域を参照し `tsc` 通過。画面18 の warnings 表示は live 2 種で機能。
- moves スキーマ・comboio（export/import・`csvcore`）は不変（`rules.go` の変更はコメント 1 行除去のみで挙動影響なし）。FR701 別ツールは未接触。

### §4 テストの妥当性 ◎

- Go: `movewarning_test.go`（移設先で `DeriveStoredWarnings` の total_null/extra_throw/キャラ別採番/空形状を 5 関数で網羅）通過。`api/move` ハンドラの warnings 再導出テスト温存。`dbtest.Setup` 経由の残テストは `go test ./...` 全通過で参照切れなし。
- 取込エンドポイント 404: `main.go` から `RegisterRoutes` 除去でルート未登録（コード上で確認。実 HTTP 404 は実機確認推奨＝制約事項）。
- FE: `tsc --noEmit` 通過。死蔵ラベルへの実参照ゼロ（残存はコメントのみ）。

### §5 設計意図との整合 ◎

逆依存を断つ移設→削除の順序を厳守、技編集温存、IsKnownProperty を消費者消失に基づき移設せず削除（不要な移設残置なし）。設計の精神を完全に踏襲。

### §6 コード品質・規約遵守 ◎

中立パッケージ名 `movewarning`・配置 `internal/service/` は既存規約に整合。package doc コメントで移設経緯・依存方向・recovery_word 消滅理由を明記。F1 dead code 残置なし。

### §7 既存挙動の温存 ◎

画面18 編集・warnings・rush・notes_tool 不変、スキーマ・comboio 不変、取込が退避キーを再生成しない（F3 恒久解消＝取込パッケージ自体が消滅）。

### §8 ドキュメント・進捗ログ ◎

`progress-log.md` M14-02 節・`m14-02-design-handoff.md` に Plan Mode 7 項目・段階削除順・テスト・F1/F2/F3 解消・FR704 降格申し送りを記録。

## 設計準拠性以外の指摘事項

- **コード規約**: JSON タグ camelCase（`warnings`）維持、godoc コメント完備、マジックストリングなし。`console.log`/`fmt.Println` 残置なし。良好。
- **命名**: `movewarning` / `WarnTotalNull` / `WarnExtraThrow` は既存命名規則に沿う。
- **ライブラリ/セキュリティ**: 新規依存追加なし、ブラウザストレージ不使用、セキュリティ関連の自己判断なし。指摘なし。

## 推奨修正（優先度別）

- **高（M14 完了前に修正必須）**: なし。
- **中（M15 着手と並行可）**: なし。
- **低（将来対応）**:
  1. `web/e2e/moves-edit.spec.ts` は `test.describe.skip` 化されているが、skip ブロック内 L72 に削除済みルート `/import/moves` へ `page.goto` する記述が残る。skip 中は実行されず無害かつ `TODO(M14-03)` で再有効化方針が明記されているため許容範囲だが、M14-03 で seed 経路を import 非依存へ書き換える際に確実に解消すること（伝達メモ §4 と一致、追跡済み）。
  2. 指示書 v1.0.0→1.0.1 のバージョンバンプが docs コミット b5b74de に含まれる。handoff メモ §3 は「指示書 §1.3/§2.2/§2.4 は本サブ着手前に開発者が是正済み」と記すが、当該編集が製造側 docs コミットに混在しているため、是正主体・時系列のトレーサビリティがやや不明瞭。コード品質には無影響（質問: 指示書 v1.0.1 化は開発者着手前是正か製造取り込みか、記録の一貫性のため確認したい）。

## 良かった点

- 共有シンボルの全消費箇所を `grep` で洗い出し、`IsKnownProperty` の消費者ゼロを根拠に「移設せず削除」を選択した判断が的確。不要な中立移設を残さずスコープを最小化している。
- repository interface の取込専用 vs 技編集共有の切り分けが正確で、`UpsertMove`/`UpsertOfficialJaAlias` を interface・実装・fakeRepo モックの 3 箇所同時に整合除去（片落ちなし）。
- 死蔵 3 ラベル整理を SSOT ファイル温存のまま値域縮小で実現し、`move-warning.ts` のコメントに recovery_word/unknown_* の死蔵化理由（取込専用・列削除）を明記。設計意図が後続読者に伝わる。
- `movewarning.go` の package doc が逆依存解消の経緯・一方向依存・recovery_word 消滅理由を簡潔に記録しており、移設の監査証跡として優れる。
- DES/REQ 本体を直接編集せず handoff メモで CHANGE-055 材料を申し送る運用を厳守。スコープ規律も良好。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。取込エンドポイントの実 HTTP 404・画面18 の実機 warnings 表示・Playwright E2E 実行・パフォーマンスは別途実機確認が必要。
- `go build` / `go vet` / `go test ./...` / `pnpm tsc --noEmit` は当方で再実行し全通過を確認済み（Vitest 個別実行は未実施＝tsc 通過で型整合は担保）。

---

## 取り込み結果（自動トリアージ）

> implement_plan_full Phase C。レビュー報告書の各指摘を製造担当 Claude が自動トリアージした記録（事後監査用）。
> 安全弁: 優先度「高」指摘の不採用時のみ開発者へエスカレーションする。本レビューは**重大ゼロ・高ゼロ・中ゼロ**、低 2 件のみのため自動で確定。

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|--------|------|------|------|
| 1 | 低 | skip 化した `web/e2e/moves-edit.spec.ts` の L72 に削除済みルート `/import/moves` への `page.goto` が残存 | **不採用（コード変更せず）／追跡は採用** | 当該テストブロックは `test.describe.skip` で実行されず無害。残る goto は seed 手順の一部であり、M14-03（配布 seed 投入で import 非依存の seed 経路が成立）でブロック全体を書き換えて再有効化する前提。今ここで goto だけ消すと中途半端な非実行テストが残るため、原形を保持して `TODO(M14-03)` で追跡する（伝達メモ §4・progress-log 既知制約と一致）。レビュアー自身も「許容範囲・追跡済み」と評価。 |
| 2 | 低（質問） | 指示書 v1.0.0→1.0.1 のバンプが docs コミット b5b74de に混在し是正主体・時系列がやや不明瞭 | **対応不要（事実回答）** | 指示書 `M14-02-*.md`・チェックリストの編集は **開発者が本サブ着手前に実施**したもの（2026-06-30 のチャット指示「instructions のファイルを指摘やプランモード決定に合わせて少し修正した」）。製造担当はそれを docs コミット b5b74de に同梱しただけで、**製造による一方的な指示書内容変更ではない**。トレーサビリティ補足として本トリアージ表に記録し回答とする。コード無影響。 |

**結論**: コード修正を要する採用指摘はゼロ（重大・高・中なし）。低 2 件は (1) M14-03 で解消予定の意図的 skip・追跡のみ、(2) 開発者起因の事実回答につき、いずれもコード変更せず記録のみ。完了承認可能。エスカレーション不要（高指摘の不採用なし）。
