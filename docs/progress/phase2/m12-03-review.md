# M12-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M12-03 実装(ブランチ `feature/m12-03`、`main..HEAD` 7 コミット)|
| レビュー HEAD | `960e438` |
| レビュー実施 | 2026-06-24 / 品質レビュー担当 Claude(Opus 4.8)|
| チェックリスト | `docs/instructions/reviews/M12-03-review-checklist.md` v1.1.0 |

## 総評

6 関心(R-1 / C-12 / C-03 / C-08 / C-10 / C-11)はいずれも end-state を満たしており、重大指摘はゼロです。最重点 4 項目 — (a) R-1 ラベル統一の 3 系統網羅、(b) C-11 マイグレーションの非破壊性 + dbtest/migrate 波及、(c) C-12 starter 一本化と **VAL-C03 の BE 維持**、(d) §10 設計判断の実装一致 — はすべてチェックリスト基準を通過しました。`go build ./...` / `go test`(関連 7 パッケージ)/ `tsc --noEmit` / Vitest(関連 4 ファイル 31 ケース)はすべてグリーンです。マイグレーション 000016 のテーブル再構築は FK=OFF の migrate 接続前提を正しく押さえ、子テーブルの連鎖削除を回避する設計で、コメントも丁寧。残課題は軽微なデッドコード/オーファン i18n キー/テスト網羅の補強のみで、いずれも M12 完了を妨げません。

## 設計準拠性レビュー結果

### R-1 起き攻め統一 — ◎
- 編集(`labels.ts` `OKI_FIELDS`)・詳細(`ja.json` `comboDetail.oki.*`)・比較(`CompareTable.tsx`)で **同一文言に統一**。誤訳「中段攻め」→「重ね」、略記「DR」→「ドライブラッシュ」、表記揺れ「中央受け身」→「その場受け身」が全 3 系統から消えていることを grep で確認(残存 0 件)。
- 比較は旧「2 行集約 + shimmy 畳み込み」を廃し、`OkiYesNo`(✓/✗/-)で **詳細と同一の 6 個別行・同一ラベルキー(`comboDetail.oki.*` を再利用)** に統一。DES-005 §5.8 spec へ整合(§10-3 確定どおり)。
- 有利フレーム整形も詳細を `formatKnockdownAdvantage`(+nF)に寄せ、比較と統一。
- 列・意味・整合検証(VAL-C11)は不変(`validation/combo.go` の VAL-C11 ロジック・6 BOOLEAN 列とも差分なし)。
- `en.json` 不変を確認(`git diff --stat` で対象外)。

### C-12 始動技自動化 — ◎
- `effectiveStarterMoveId = autoStarterMoveId`(手動参照を廃止、`ComboEditor.tsx` L125)。`BasicFieldsValue.starterMoveId` フィールド削除、`initialBasic` から初期化除去、`ComboEditorBasicFields` の始動技プルダウン(select)を読み取り専用表示へ置換。
- `extractKeyFields` がレシピ先頭 move から starter を導出するよう変更され、保存側 `currentKey.starterMoveId = effectiveStarterMoveId`(=auto)と **両側が同一導出基準**になり、キー比較の整合が保たれている。
- **VAL-C03 は BE に維持**(`validateC03StarterMatchesStep1` 健在、L117/L190。WARNING)。§10-2 確定どおりで、削除違反なし(重大判定回避)。
- 重複判定キー(VAL-C02 / `duplicate_keys.go`)は不変(差分なし)。

### C-03 セットプレイ名必須 — ◎
- FE: `SetupBasicInfoForm`(必須ラベル・`required`/`aria-required`・空時インラインエラー)、`SetupEditorPage`(name 空で保存ボタン disabled)。
- BE: `VAL-S06`(ERROR)を `ValidateSetupCreate`(create)と `ValidateSetupUpdate`(update、空クリア禁止・nil スキップ)の両方に追加。
- **bundled setup 経路も担保**: 同時登録は `CreateSetupInTx` 経由で `ValidateSetupCreate` を通り、combo service(L212-237)が setup の検証エラーを `setups[i].name` にマップして rollback + 返却。create/update/bundled の三経路で必須化が揃っている。

### C-08 紐付け候補 knockdown 絞り — ◎
- 新エンドポイント `GET /api/setups/candidates?characterId=X&knockdownAdvantage=Y` を追加。`routes.go` で `/setups/:id` より **前** に登録され、`candidates` が `:id` パラメータに誤マッチしない(順序正しい)。
- `GetSetupCandidatesByKnockdown` は既存 `FindCandidateSetups(characterID, knockdownAdvantage, excludeComboID=0)` を再利用。`excludeComboID=0` は `c.id != 0`(常に真)+ `combo_id=0` の NOT IN(空)で **実質無効化**でき、既存抽出条件(同一キャラ + knockdown 一致)をそのまま流用する妥当な設計。`knockdownAdvantage == nil` 時は repo が空配列返却。
- FE: `SetupSelectorModal` を `useCharacterSetups`(全件)→ `useSetupCandidatesByKnockdown`(knockdown 一致)へ切替。hook は `knockdownAdvantage` null 時 `enabled:false` で候補なし。`SetupRegistrationSection` が現フォームの `knockdownAdvantage` を伝播。

### C-10 ドライブダメージ詳細表示 — ◎
- `ComboDetailMetadata` に `driveDamage` 行を追加(`formatDriveDamage`、`comboDetail.metadata.driveDamage`=「ドライブダメージ」を ja.json に追加)。null は「-」表示。

### C-11 drive_damage 小数化 — ◎(マイグレーション非破壊性含む)
- 型追従の全経路を確認: model `*int`→`*float64`、dto(`CreateRequest`/`UpdateMetadataRequest`(`Optional[float64]`)/`ComboResponse`)、service(`CreateInput`)、repository(`UpdateMetadataInput` + 新規 `addOptFloat`)。repository の scan は `model.Combo.DriveDamage *float64` へ自動追従。取込/更新/取得の追従漏れなし。
- VAL-C13(ERROR、-6〜6、null スキップ、小数許容、`%g` 整形)を `ValidateComboForCreate` に追加。CHECK 制約不使用(DES-003 L394 準拠)。
- FE: zod `optFloat(-6,6)`、入力 `min=-6/max=6/step=0.5`、`blockNonNumericKeys(true,true)`(負値・小数許可)、`parseOptFloat`(truncate しない)、`formatDriveDamage`(小数2桁丸め)。
- **マイグレーション 000016 は非破壊**: テーブル再構築(`new_combos` 作成 → 全列コピー → `DROP combos` → RENAME)で既存 drive_damage 値・全行を SELECT で保持。新テーブルは 000008(gauge_consumed 列 DROP)反映済みの現行スキーマと一致(`drive_damage` のみ REAL、他は同一)、インデックスも 000001 と同一に再作成。
- **子テーブル連鎖削除の回避を確認**: migrate 接続(`migrate.go` の `sql.Open` は pragma 無し)は foreign_keys=OFF。一方アプリ接続(`db.go`)は `PRAGMA foreign_keys = ON`。よって migration 中の `DROP TABLE combos` は combo_steps/combo_setups/combo_tags(ON DELETE CASCADE)を連鎖削除しない。`new_combos` 一時名経由で legacy_alter_table の FK 自動書き換えも回避。コメントの安全性根拠は実コードと一致。
- `dbtest.Setup` / 新規 DB 構築での健全性: migration 全適用テスト(`TestRun_FirstAndIdempotent` / `TestRun_AllTablesExist`)がグリーンで、000016 適用後も全テーブル健在。`go test ./internal/infra/migration/...` 通過。

## 設計準拠性以外の指摘事項

1. **デッドプロップ `movesLoading`(軽微)**: `ComboEditorBasicFields` の Props 型に `movesLoading: boolean`(L51)が残るが、C-12 で destructure・本体使用とも削除済みで未使用。`ComboEditor` は引き続き L438/L451 で `movesLoading={movesQ.isLoading}` を渡している。動作影響なし(型エラーにもならない)が、不要 Props は削除が望ましい(retrospective-digest §3「Props は最小限」)。

2. **オーファン i18n キー(軽微)**: 比較の 6 BOOLEAN 統一に伴い `ja.json` の `compare.oki.*`(drNone/drYes/bothPossible/throwOnly/neither)・`compare.row.okiNeutralTech`/`okiBackTech` が参照されなくなった(grep で参照 0 件)。CLAUDE.md §4「不要なコメントアウトコード削除」の趣旨に照らし、未使用 i18n キーも削除が望ましい。en.json は不変方針のため ja のみの判断。

3. **SetupSelectorModal 空状態メッセージの文言(軽微)**: 候補抽出が knockdown 一致ベースに変わったが、空時メッセージは「同一キャラの紐付け候補がありません」のまま。実際は「同一キャラ + 同一有利フレーム」で絞るため、有利フレーム未入力時に候補ゼロになる理由がユーザーに伝わりにくい。「同一有利フレームの紐付け候補がありません」等への調整を検討余地(機能は満たすため軽微)。

4. **PATCH 経路で VAL-C13 が走らない(軽微・既存パターン踏襲)**: `UpdateMetadata`(PATCH)は draft→published 昇格時のみ `ValidateComboForCreate`(VAL-C13 含む)を実行し、既本登録コンボの単純な driveDamage 更新では範囲検証が走らない(インライン検証は VAL-C10 のみ)。ただし VAL-C04/C05 も同様に PATCH では非実行であり、**既存の「軽量 PATCH 検証」方針と一貫**。FE zod(-6〜6)が第一防衛線として効くため実害は低い。設計担当が VAL-C13 を PATCH でも要求するなら別途規定が必要。

5. **スコープ外ファイルの混入(軽微・情報のみ)**: `docs/human-notes/Memo_Someday.txt` に M12-03 と無関係な開発者メモ 2 件が追記されている。これは開発者の私的メモファイル(設計書/ソースではない)であり CHANGE 対象外。`code-facts.md` の再生成(commit `4bead4c` 反映)は §3.4.1 の運用どおりで適正。

## 推奨修正(優先度別)

- **高(M12 完了前に修正必須)**: なし。

- **中(M13 着手と並行可)**:
  - 指摘 1: `ComboEditorBasicFields` の未使用 Props `movesLoading` を Props 型と呼出側から除去。
  - 指摘 2: `ja.json` のオーファン `compare.oki.*` / `compare.row.okiNeutralTech`/`okiBackTech` を削除。

- **低(将来対応)**:
  - 指摘 3: SetupSelectorModal の空状態文言を knockdown 絞りに合わせる。
  - 指摘 4: PATCH での VAL-C13 要否は設計判断として保留(必要なら設計担当が規定)。
  - マイグレーション 000016 の **データ保存(非破壊)round-trip テスト**の追加(現状は適用成功 + 全テーブル存在までで、行データ保持の明示検証はなし)。指示書 §5.1「既存 int 値の互換」を機械テストで担保すると堅牢。

## 良かった点

- マイグレーション 000016 の SQL コメントが秀逸。FK=OFF 接続前提・一時名経由の理由・000008 反映済みスキーマの根拠まで明記され、retrospective-digest §5(破壊的マイグレと dbtest.Setup 波及)の教訓を正面から押さえている。
- C-08 の `excludeComboID=0` による既存クエリ再利用は、新規 SQL を増やさず抽出条件を 1 箇所に集約する筋の良い設計。`buildCandidateResponses` への共通化も適切。
- C-12 の starter 一本化で、**比較キーの両側(initial/current)を同一導出に揃えた**点が的確。片側だけ変えると重複判定が壊れる罠を回避している。
- VAL-C03 を「UI 廃止 + BE 維持」で正しく実装し、§10-2 の確定判断(API 直叩き防御)を取り違えていない。
- テストが「ファイル有無」でなく具体ケース(float round-trip、VAL-S06 create/update、VAL-C13 OK/範囲外、C-08 handler 200/400)で書かれており、retrospective-digest §1-D の趣旨に合致。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト・E2E 実行は別途必要。
- E2E spec(`m12-03-oki-starter-validation.spec.ts`)はシナリオ A/B/E を整備済みだが C(C-03)/D(C-08)/F(非回帰)は未整備。製造環境ではブラウザ未導入のため未実行であり、実機での確認は開発者ゲート。

---

## 取り込み結果(自動トリアージ)

`/implement_plan_full` Phase C により、本報告書の各指摘を自動トリアージした(2026-06-24)。
**重大(高)指摘はゼロ**のため安全弁(高指摘の不採用エスカレーション)は発動せず。採用分は適用済み、ビルド/テストは全グリーン(go build / go test 全パッケージ・tsc・Vitest 531 ケース)。

| 指摘 | 優先 | 採否 | 対応 / 理由 |
|------|------|------|-------------|
| 1. `movesLoading` デッドProp | 中 | **採用** | `ComboEditorBasicFields` の Props 型・呼出側(`ComboEditor`)・テスト 2 箇所から除去。`RecipeBuilder` 側の `movesLoading` は別用途のため維持。 |
| 2. オーファン i18n キー | 中 | **採用** | `ja.json` の `compare.oki.*`(drNone/drYes/bothPossible/throwOnly/neither)・`compare.row.okiNeutralTech`/`okiBackTech` を削除(参照 0 件)。`en.json` は不変方針のため対象外。 |
| 3. SetupSelectorModal 空状態文言 | 低 | **採用** | 「同一キャラの紐付け候補がありません」→「同一有利フレームの紐付け候補がありません」に変更(C-08 の knockdown 絞りに整合)。対応テストも更新。 |
| 4. PATCH で VAL-C13 非実行 | 低 | **不採用(保留)** | 既存 VAL-C04/C05 も PATCH(`UpdateMetadata`)では非実行であり、**現行の軽量 PATCH 検証方針と一貫**。FE zod(-6〜6)が第一防衛線。検証哲学の変更は設計担当判断のため、本サブのスコープ外として保留。指示書 §4.6 が要求する「新規/昇格時の範囲検証」は VAL-C13 で充足済み。設計担当が PATCH でも要求する場合は CHANGE で別途規定。 |
| 5. マイグレ非破壊 round-trip テスト | 低 | **採用** | `migrate_test.go` に `TestRun_DriveDamageRealRoundTrip` を追加(drive_damage 列型=REAL の確認 + 小数/負値/整数の INSERT→SELECT round-trip)。指示書 §5.1「既存 int 値の互換」をマイグレ層で明示担保。 |

不採用は「低」1 件のみで、理由を上記に明記。**「高」「中」指摘の握り潰しはなし**。
