# M7-05 レビュー報告書

## 総評

フェーズ 1 完了マイルストーンの最終サブとして、系統 F(バグ#6 / E-3 / window.confirm / i18n / L-02〜L-04)と系統 G(統合 E2E 記録整備 + リュウデータクリア SQL + 完了判定)が指示書・チェックリストの確定範囲どおりに高品質で実装されている。特に **バグ#6 の真因を「症状から決めつけず」着手前確認で切り分け、指示書の想定(バックエンド分岐欠落)と異なり真因がフロント(`SetupEditorPage` の登録経路に `onError` 欠落)であることを正しく特定**した点は、M7-16 反省(§9.1/§9.2)の意図を完全に汲んでいる。`go test ./...`(23 パッケージ)/ `pnpm exec vitest run`(80 ファイル 435 テスト)/ `tsc --noEmit` をレビュー側でも再実行し全パスを確認。window.confirm 残存ゼロ・UPPER_SNAKE エラーコード残存ゼロも実 grep で裏取り済み。スキーマ変更・スコープ外着手・handover 製造担当作成のいずれも無し。重大問題はなく、フェーズ 1 完了承認を妨げる事項はない。指摘は L-03 の実装方式が指示書文言と微妙にずれる点(設計確認推奨)と、`config.Save` の env override 巻き戻しという軽微なエッジケースのみ。

## 設計準拠性レビュー結果

### 系統 F

| 項目 | 評価 | 所見 |
|------|------|------|
| F-1 バグ#6(VAL-S02) | ◎ | 着手前確認でバックエンド `CreateSetup` は既に `result.HasError() → 400 + details.validations` 分岐を持ち正しいことを確認(既存テスト `TestHandler_CreateSetup_400_ValidationFailed` でカバー済み)。真因はフロント `SetupEditorPage` create 経路の `onError` 欠落 + `setupApi` が `fetchJSON`(status/validations を保持しない)を使っていた点と正しく特定。`features/setup/errors.ts`(`parseSetupApiError`、combo の `parseComboApiError` と同型 = architecture-patterns §3.1 踏襲)+ `requestSetupJSON`(構造化 `ApiError`)+ create/edit 両経路の `onError` + `ValidationDisplay` 全幅表示。回帰テストは真因レイヤに合わせフロント側(`errors.test.ts` / `setupApi.test.ts` / `SetupEditorPage.test.tsx`)に追加。真因切り分けの姿勢が模範的 |
| F-2 E-3(マイコンボ件数) | ◎ | `repository.go listWithUsage` に任意 `characterID` を追加。**フィルタを LEFT JOIN の ON 句に置き `COUNT(c.id)` を使う**(WHERE に置くと当該キャラのコンボを持たないタグが結果から消える)という正しい設計を、その理由のコメント付きで実装。nil 時は全集計で従来挙動を保持。service / handler(`character_id` クエリ、不正値 400)/ `tagApi.list` / `useMyComboStatusCounts(characterId)` / `MyComboPage` まで一貫。repo・handler・hook に回帰テスト追加 |
| F-3 window.confirm | ◎ | 全 3 件(`ComboListPage` / `ComboDetailPage` / `MyComboPage`)を共通 `DeleteComboConfirm`(shadcn/ui AlertDialog)に置換し DRY。`grep -rn "window.confirm" web/src` 残存ゼロ(ヒットはコメント 2 行のみ)をレビュー側でも確認。チェックリスト §3 の grep 証跡明示要件を満たす |
| F-4 i18n クリーンアップ | ◎ | `comboList.sort` の到達不能 camelCase 5 キー(starterStatus/updatedAt/starterMoveId/driveGauge/saGauge)を ja/en 削除。C-1: `common.unknown` を新設し `ComboDetailHeader` のフォールバックを `comboDetail.characterRyu` → `common.unknown` に汎用化、orphan 化した `comboDetail.characterRyu` も削除。**`comboList.characterRyu`(E-2 リュウ固定ラベル、実使用中)は据え置き**という判断も正しい(C-1 対象外)。英語ロケール整備に手を出していない(フェーズ 3 送り = 正) |
| F-5 L-02(エラーコード統一) | ○ | combo / character / tag の UPPER_SNAKE を lower_snake へ、空白入り不正コード `"combo is not in trash"` → `combo_not_in_trash` へ統一。`grep` で UPPER_SNAKE・空白入りコードの残存ゼロを確認。**DES-006 改訂は不要と正しく判定**(DES-006 が規定するのは `VAL-*` バリデーションコードで、HTTP `error.code` は規定対象外。レビュー側でも DES-006 を確認し裏取り)→ CHANGE 不要は妥当。フロント依存は `useTagFormDialog`(`tag_name_duplicate`)1 件のみテストと同期、`usePermanentDelete.test.ts` の既存モック値とも整合(むしろ一致が改善) |
| F-5 L-03(ヘルパ統一) | ○ | 後述「指摘事項」参照。L-03 の本質(per-handler ヘルパの不統一解消)は達成しているが、実装方式が指示書文言と微妙にずれる |
| F-5 L-04(ポート競合) | ◎ | `netutil.ListenAvailable`(連番 +1 探索でリスナ確保、上限 20、65535 上限ガード、`maxAttempts<1` 防御)+ `config.Save`(tmp→fsync→rename のアトミック書込)を新設。DES-002 §3.3「使用ポートは起動ログと設定ファイルに記録」をレビュー側で確認、書き戻しは設計準拠。確保済みリスナを `e.Listener` に設定し二重 bind を回避(echo の非 nil 時非再生成をソース確認したと記録)。空きポート採用 / 競合フォールバック / 探索枯渇の 3 ケースをテスト |
| M-1〜M-4 | ○ | §3.4-2 の Plan Mode 判断でフェーズ 2/3 送り確定(recipeCache API 露出 / queryKey 統一 / useCheckDuplicate の TanStack 化 / SetupSummary 型集約)。確定範囲外として持ち越しは §10 許容範囲。progress-log に handover 素材として整理済み。M7-02 解消済み分の重複対応もなし |

### 系統 G

| 項目 | 評価 | 所見 |
|------|------|------|
| 統合 E2E | ○ | `m7-integration-e2e-results.md` を M6-04 形式踏襲で新設。**自動回帰(製造担当実行分)と手動 UI/レスポンシブ/LAN(開発者記入分)を明確に分離**し、後者は §5.2 の役割分担どおり手順整備に留める判断が適切。系統 F(F-1〜F-5)/ 既存回帰(G-1〜G-9)/ M7 横断(shadcn/ui・3 段階レスポンシブ・複数キャラ・R-2/R-3・M7-15 再確認)/ U-1 を網羅。実機・手動部分は未記入(開発者作業のため正) |
| スマホ LAN(U-1) | ○ | コンテナ制約により手順整備のみ(開発者がホスト OS で実施)。§13.2「検証不可時は未検証のままフェーズ 1 完了と明示記録可」への言及あり |
| リュウデータ全クリア | ◎ | `scripts/clear-validation-data.sql`(物理削除、§3.4-7 確定方式)。子テーブル明示削除 + 本体 + sqlite_sequence リセット + VACUUM。**実行は開発者が統合 E2E 回帰確認後**(§5.3)と明記、DB ファイル自体は削除せず §10 抵触なし・スキーマ変更なし・マスタ/タグ定義保持を明記。リュウ限定版 WHERE も参考併記 |
| フェーズ 1 完了判定 | ○ | M7-overview §13 DoD で確認。「未実装 = 正」項目(ComboEditor キャラ選択 / custom_states / recipe_cache 無効化 / プリセット管理 UI / 本格スマホ UI / i18n 英語)をバグ扱いせずフェーズ 2/3 送り確定として整理(§9.2 遵守、余計な実装なし) |
| handover | ◎ | 製造担当は素材整理のみ。`m7-to-phase2-handover.md` を製造担当が作成していない(設計担当作業として残置) |

### スキーマ非変更・既存非破壊(最重要)

| 項目 | 評価 | 所見 |
|------|------|------|
| スキーマ非変更 | ◎ | ALTER/CREATE TABLE 等なし。E-3 は既存 `combos.character_id` を JOIN で参照するのみ、clear SQL も DELETE のみ |
| seed 非破壊 | ◎ | clear SQL は開発者が E2E 後に実行する設計。マスタ/タグ定義は保持 |
| 全テストパス | ◎ | レビュー側再実行で `go test ./...`(23 pkg ok)/ `vitest run`(80 ファイル 435 テスト pass)/ `tsc --noEmit`(exit 0)を確認 |
| M1〜M6・複数キャラ回帰 | ○ | 自動テスト範囲では回帰なし。手動 UI/複数キャラ回帰は開発者の E2E 記入待ち(コード上は判定不能) |

## 設計準拠性以外の指摘事項

1. **【中〜低】`config.Save` が env override 値を config.toml に巻き戻すエッジケース**: `config.Load` は `applyEnvOverrides` で `COMBOMGR_LOG_LEVEL` → `Logging.Level` を上書きした後の `cfg` を返す。ポート競合フォールバック時の `config.Save(configPath, cfg)` はこの env 上書き済み `cfg` をそのまま書き戻すため、環境変数で一時的に指定したログレベルが config.toml に永続化されてしまう。現状 env override 対象は `COMBOMGR_LOG_LEVEL` の 1 項目のみで影響は限定的だが、env override は通常「一時的な上書き」が意図のため、ファイルへの焼き付けは想定外挙動になりうる。ポート以外のフィールドを保存対象から除く、または保存直前に env override 前の値へ戻す等の配慮が望ましい(将来 env override 項目が増えると影響拡大)。

2. **【低】`config.Save` が TOML のコメント・整形を喪失**: `toml.NewEncoder().Encode` での全書き戻しのため、ユーザーが手編集した config.toml のコメントや並び順が失われる。本アプリの想定規模では実害は小さいが、ポート以外の項目も含め丸ごと再エンコードされる点は留意。

3. **【低】`requestSetupJSON` が `fetchJSON` のロジックを部分的に再実装**: 構造化 `ApiError`(status + details.validations 保持)が必要なため新設した経緯はコメントで明示されており妥当だが、`fetch` ラッパが setup 用に独立した。将来 combo 側の同等処理と共通基盤に寄せる余地あり(今回スコープでは許容)。

4. **【情報】L-03 の実装方式**: 下記「推奨修正」中に記載。

## 推奨修正(優先度別)

- **高(M7 完了前に修正必須)**: なし。重大問題・完了承認を妨げる事項はない。

- **中(フェーズ 3 着手と並行可 / 設計確認推奨)**:
  - **L-03 実装方式の設計確認**: 指示書 §4.5・チェックリスト §5 は「`model.APIErrorResponse` 直接呼出に統一」「独自ヘルパを増やしていないか」と記す。製造担当は約 70 箇所の純インライン化を「冗長・高リスク」と判断し、代わりに **`model` 層に正準コンストラクタ `model.NewAPIError` / `model.NewAPIErrorWithDetails` を新設**して per-package 散在ヘルパ(`comboErrResp`/`comboErrCode`/`charErrResp`/`errResp`/`errRespDetail`)を全削除・集約した。L-03 の本質(ヘルパ不統一)は確かに解消され、churn 最小化の判断には合理性があり progress-log にも判断メモが明記されている。一方で「独自ヘルパを増やさない」という文言とは表面上ずれるため、この方式が architecture-patterns §3 の意図に沿うかを設計担当に確認しておくのが安全(実装としては許容範囲と判断)。
  - 指摘事項 1(`config.Save` の env override 巻き戻し)は、ポート以外を保存対象から除外する小修正で回避可能。実害が顕在化する前(env override 項目追加前)の対応が望ましい。

- **低(将来対応)**:
  - 指摘事項 2(TOML コメント喪失)・3(`requestSetupJSON` 重複)はフェーズ 2/3 のリファクタ機会に検討。

## 良かった点

- **真因レイヤを症状から決めつけなかった**: バグ#6 を指示書の想定(バックエンド分岐欠落)で済ませず、着手前確認で「バックエンドは既に正しい / 真因はフロントの `onError` 欠落」と切り分け、回帰テストも真因レイヤ(フロント)に置いた。M7-16 反省(§9.1/§9.2)を最も重視すべき本マイルストーンで、その意図を完全に体現している。
- **E-3 の SQL 設計が的確**: 「フィルタを WHERE でなく LEFT JOIN ON 句に置く / `COUNT(c.id)` を使う / nil 時は従来集計」という非自明な正解を、理由コメント付きで実装。
- **grep 証跡の自走と明示**(window.confirm / UPPER_SNAKE)、**ターン分割 + 各ターン commit** の運用、**progress-log の判断メモ**(L-02 の DES-006 非該当理由、L-03 の方式判断、L-04 の echo ソース確認)など、レビュー容易性と再現性が極めて高い。
- **スコープ規律**: 「未実装 = 正」項目をバグ扱いせず、M-1〜M-4 / E-2 を Plan Mode 判断でフェーズ 2/3 送り確定、handover は素材整理のみ。スコープ外への波及なし。
- **E2E 記録の役割分担**: 自動回帰(製造担当)と手動/実機(開発者)を明確に分離した記録設計。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。`m7-integration-e2e-results.md` の手動 UI / 3 段階レスポンシブ / 複数キャラ手動回帰 / スマホ LAN 実機検証は開発者記入待ちであり、これらの実動作・パフォーマンス(NFR001/NFR306)・実機表示崩れの有無は本レビューでは判定不能。
- `scripts/clear-validation-data.sql` は実行していない(開発者が E2E 回帰確認後に実行する設計)。SQL の論理は読取確認したが、実 DB への適用結果は未検証。
- L-04 ポート競合フォールバックの実起動挙動(占有ポート下での fallback ログ・config.toml 書換・実ポート bind)は単体テスト範囲で確認済みだが、実プロセスでの E2E(F-5 手順)は開発者検証待ち。
