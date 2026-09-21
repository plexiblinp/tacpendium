# M17-01 完了報告(G-j メディア 3 フィールド: link・video_path・image_path)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M17-01-media-fields.md` v1.0.2 |
| レビューチェックリスト | `docs/instructions/phase3/reviews/M17-01-review-checklist.md` v1.0.0 |
| 実施日 | 2026-07-16 |
| 実行フロー | `/implement_plan_full`(実装→fresh subagent レビュー→自動トリアージ) |
| 承認記録 | Plan 承認 2026-07-16。開発者回答 3 件(同日): マイグレ連番 000031(指示書 v1.0.2 是正)・CSV へ VAL-I10 適用(memo 同様)・i18n は既存流儀(詳細/比較=i18n 両ロケール、編集/エクスポート=固定日本語) |

---

## 1. Plan Mode 確定方式(指示書 §3.3 の 6 項目・実査結果)

1. **マイグレ連番=000031**: 着手時実査で M14-03c が 000029(手書きクリア)+000030(seedgen 生成 seed)の **2 連番**を消費済みと判明(指示書 v1.0.1 の「000030」は陳腐化)。§3.3-1 のフォールバック「ズレていれば次の空き番号」に該当、開発者確認のうえ **000031 で確定**(指示書 v1.0.2 に反映済み)。既存 000001〜000030 は非改変。
2. **model/DTO/repository**: memo/situation を範に同型追加。model `internal/model/combo.go`(`*string`+db/json タグ)、DTO `internal/api/combo/dto.go`(CreateRequest=`*string`/UpdateMetadataRequest=`comborepo.Optional[string]`/ComboResponse=`*string`+変換 3 関数)、repository `internal/repository/combo/repository.go`(INSERT+SELECT 5 本+`scanCombo`+`UpdateMetadataInput`+`UpdateMetadata` の Present ブロック)、service `internal/service/combo/service.go`(CreateInput/buildComboFromInput/applyMetadataInput)。
3. **CSV**: `csvcore/contract.go` の `CSVColumns` **末尾**に 3 列追加+`optionalImportColumns` 登録(`requiredImportColumns` は差分自動算出のため非必須が自動充足=旧 CSV 後方互換)。export/import は memo と同じ `sanitizeFreeText`/`desanitizeFreeText`(VAL-I10)を対称適用(開発者確認)= verbatim 往復不変。
4. **表示/VAL-I08 流用可否**: **既存の安全 URL ヘルパは存在しない**(VAL-I08 は「リンク化しない」という設計ルールのみでコード実体なし)→ `web/src/lib/safe-url.ts` の `isSafeHttpUrl` を新設(trim+小文字化して `http://`/`https://` 前方一致のみ true)。**スキーム制限方式=前方一致ヘルパ**。
5. **dup/recipe 非波及(実コード確認)**: repo `DuplicateKey`(6 キー)・validation 層 `DuplicateKey`(同 6 キー)・`DuplicateCheckFields`・`CalcRecipeHash`(steps の move_id+modifiers のみ)・`RecomputeComboCache`(steps+presets のみ)のいずれもメタデータ列を参照しない=**変更 0 件**。PATCH 経路(`UpdateMetadata`)は `RecomputeComboCache` を呼ばない(呼び出しは Create/PUT/Restore の 3 箇所のみ)ことを実査確認=メディア PATCH で cache 再計算は構造的に発生しない。
6. **i18n**: 詳細=`comboDetail.metadata.media|link|videoPath|imagePath`、比較=`compare.row.link|videoPath|imagePath` を ja/en 両ロケールに追加。編集画面ラベル・PDF/PNG エクスポートラベルは既存流儀どおり固定日本語(開発者確認)。

## 2. 成果物

| ファイル | 内容 |
|---|---|
| `migrations/000031_add_combo_media.{up,down}.sql` | up: `ALTER TABLE combos ADD COLUMN` ×3(TEXT・NULL 可・backfill なし)。down: `DROP COLUMN` ×3(範=000020) |
| `internal/model/combo.go` | `Link`/`VideoPath`/`ImagePath`(`*string`・omitempty・db タグ) |
| `internal/repository/combo/repository.go` | 列リスト 7 箇所同期+`UpdateMetadataInput`(Optional ×3)+`UpdateMetadata` トライステート |
| `internal/service/combo/service.go` | CreateInput/buildComboFromInput/applyMetadataInput 追従 |
| `internal/api/combo/dto.go` | Create/PATCH/Response DTO+変換 3 関数(PATCH は presence-detection) |
| `internal/service/comboio/`(csvcore 含む) | CSV 任意列末尾 3 列・VAL-I10 対称適用・緩検証(import 検証エラーなし) |
| `web/src/features/combo/types.ts` | ComboSummary/Combo/CreateComboRequest/UpdateMetadataRequest に 3 フィールド(3 interface 同期の規約遵守) |
| `web/src/lib/safe-url.ts`(新設) | `isSafeHttpUrl`(スキーム制限・XSS 無害化) |
| `web/src/features/combo/components/ComboDetailMetadata.tsx` | メディアセクション(値がある項目のみ表示=tags の hidden-when-empty 流儀)。link のみ `<a rel="noopener noreferrer" target="_blank">`、path 2 種は常にテキスト |
| `web/src/features/combo/components/ComboEditorBasicFields.tsx` / `ComboEditor.tsx` | 「その他情報」節に入力欄 3 つ(空入力=PATCH null=クリア)・hydration・FIELD_LABELS |
| `web/src/features/combo/components/CompareTable.tsx` | メディア 3 行(テキスト表示のみ・列ペアリング不変) |
| `web/src/features/combo-io/export-items.ts` / `export-model.ts` | PDF/PNG/クリップボードに 3 項目(**文字列のみ**・画像実体埋め込みなし) |
| `web/src/locales/ja.json` / `en.json` | 詳細・比較のラベル(両ロケール) |
| `web/e2e/m17-01-media-fields.spec.ts`(新設) | E2E 2 本(下記 §4) |
| `docs/design/testid-convention.md` | 付与済み一覧に 6 件登録(combo-editor-link 等 3+combo-detail-link 等 3) |

### 変更していないもの(非波及の担保)

`internal/service/combo/duplicate_keys.go`・`DuplicateKey`(repo/validation 両層)・`internal/service/notation/cache.go`・setups・既存マイグレ 000001〜000030。

## 3. 推測で進めた箇所(指示書 §9.2 の許容範囲・Plan 提示済み)

- 詳細画面の NULL 項目は**非表示**(tags の hidden-when-empty 流儀。メディアセクション自体、3 列全 NULL なら出さない)。
- ラベル文言は仮: リンク/動画パス/画像パス(en: Link/Video path/Image path)。確定は開発者。
- zod 上限は memo と同じ `max(2000)`(長さ上限は「形式強制」に非該当と解釈)。
- 比較表はリンク化せずテキスト(CHANGE-068 §2.3-j のリンク化要求は詳細画面のみ)。

## 4. テスト結果(ケース数)

- **Go**: `go test ./...` **全通過**(既存テスト修正 0 件)。新規 **9 本**:
  - マイグレ: `TestRun_ComboMediaColumnsAdded`(3 列 TEXT・既存行 NULL・round-trip)/`TestRun_ComboMediaColumnsDownRollback`(up→down(v30)→re-up)
  - repo: `TestRepository_ComboMedia_InsertAndTristate`(INSERT/SELECT+各列トライステート: 不在=不変更/null=クリア/値=更新)
  - handler: `TestHandler_UpdateMetadata_MediaTristate`(実 JSON からの presence デコード 3 状態)
  - service: `TestService_Create_VAL_C02_MediaNotInDuplicateKey`(**メディアだけ異なるコンボが重複判定される**=非 dup)/`TestService_UpdateMetadata_MediaTristate_NoRecipeRecompute`(保存・クリア+**recipe_cache 不変**)
  - CSV: `TestMediaRoundTrip`(verbatim。危険スキーム風・式トリガ先頭も往復不変)/`TestMediaBackwardCompatImport`(旧 CSV→3 列 NULL)/`TestMediaNoValidation`(不正形式でもエラー 0)+golden 行(`TestRoundTrip`)に 3 フィールド追加+`TestMediaFieldsExportImportRoundTrip`(DB→export→import→再 export の統合往復)
- **Vitest**: `pnpm test` **102 files / 696 tests 全通過**。新規: `safe-url.test.ts` 4 本(http/https true・javascript:/data:/file:/相対パス false)・`ComboDetailMetadata.test.tsx` 5 本(リンク化 rel/target・危険スキーム非リンク・path テキスト・NULL 非表示・部分表示)・ComboEditor 3 本(hydration・PATCH payload・空クリア=null)・CompareTable 1 本(3 行+非リンク)・export-model 2 本(3 項目文字列・全選択 28 行へ更新)
- **E2E**: `make e2e` **19 passed・exit 0**。新規 spec 2 本(メディア入力→詳細リンク化/テキスト→空クリア温存→削除、javascript: 非リンク化)。flaky 2 件(既知 m12-06+新規 spec 初回 attempt)は retry で吸収=現行 baseline どおり。
- **品質 grep**: 「起き攻け」0・「DR」略記 0・簡体字 0。i18n 両ロケール parity は `locales.test.ts` で担保。

## 5. DES 反映要点(CHANGE-068 三点セット確定用)

- **DES-003 combos 節(注意: CHANGE-068 は「§3.3」と表記するが現行 DES-003 では combos は §3.4・§3.3 は moves=レビュー中-a 指摘)**: combos に `link`/`video_path`/`image_path`(TEXT・NULL 可・非 dup/非 recipe)。PATCH presence-detection トライステート対象に 3 列加算。マイグレ **000031**。
- **DES-002 §7.6**: コンボ CSV 任意列末尾 3 列(`link`,`video_path`,`image_path` の順)。`requiredImportColumns` 非包含=旧 CSV 後方互換。**VAL-I10(sanitize/desanitize 対称)を memo 同様に適用**したうえで verbatim 往復(開発者確認 2026-07-16)。
- **DES-005**: 詳細=メディアセクション(値がある項目のみ表示)。link は `isSafeHttpUrl`(http/https 前方一致・大文字小文字不問)判定時のみ `<a rel="noopener noreferrer" target="_blank">`。編集=「その他情報」節に 3 入力欄(空=クリア)。比較=3 行(テキストのみ)。PDF/PNG/クリップボード=文字列のみ(export-items 3 項目・既定 ON)。
- **DES-006 §6**: メディア 3 列は緩検証(保存は任意文字列可・import 検証エラーなし・閲覧不可許容)。link のスキーム制限は**表示層の無害化**として実装(VAL-I08 とは別枠。VAL-I08 に流用可能な実装は存在しなかった=新設 `web/src/lib/safe-url.ts` が実体)。**長さ上限は UI(zod/maxLength=2000)のみで BE/CSV は非強制**(memo と同一パターン)である旨の明文化を推奨(レビュー低-c)。
- 製造は DES を直接編集していない。

## 6. 開発者への申し送り

- **dev バックエンド再起動が必要**: 実 dev DB へ 000031 を適用し新 DTO を有効化するには `go run` の再起動が必要(dev_backend_restart_pitfall)。未再起動だとメディアが保存されない/表示されないように見える。
- 指示書 v1.0.1→v1.0.2 の連番是正(開発者編集)は未コミット。本ブランチのコミットに含めていないため、扱いは開発者判断。
- **ラベル文言確定時の E2E 追従**(レビュー低-a): `m17-01-media-fields.spec.ts` はプレースホルダ文言セレクタ(規約の優先順位 3)を使用。メディアのラベル/プレースホルダ文言(現状は仮)を確定・変更する際は spec の追従修正(または付与済み `combo-editor-link` 等 testid への移行)をセットで行うこと。
