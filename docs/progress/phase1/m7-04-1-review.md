# M7-04-1 レビュー報告書

## grep 全数性確認結果(チェックリスト §0.3 / §1.1 / §7.1 の必須転記)

### §1.1 削除全数性

| コマンド | 対象(コード領域) | ヒット数 | 判定 |
|---------|----------------|---------|------|
| `grep -rni "consumed_total" .` | `.go` / `.ts` / `.tsx` / `.json` / `.sql`、`docs/` + `migrations/000001*` + `migrations/000008*` 除く | **0 件** | ◎ |
| `grep -rni "ConsumedTotal" .` | 同上 | **0 件** | ◎ |
| `grep -rni "GaugeConsumed" .` | 同上 | **0 件** | ◎ |

### §7.1 温存対象の存在確認

| コマンド | 期待値 | 結果 | 判定 |
|---------|-------|------|------|
| `grep -rn "gauge_increase" .` | moves テーブルのカラムが残存 | `internal/model/move.go`・`migrations/000001*.up.sql` に `drive_gauge_increase` / `super_art_gauge_increase` 存在 | ◎ |
| `grep -rn "available_at_start\|AvailableAtStart" .` | 開始残量が残存 | `internal/model/combo.go`、`internal/repository/combo/repository.go`、`internal/service/validation/combo.go`、`web/src/features/combo/components/ComboEditorBasicFields.tsx` 等に存在 | ◎ |
| `grep -rn "formatDriveGauge\|formatSAGauge" .` | 開始残量表示関数が残存 | `web/src/features/combo/utils.ts`、`ComboDetailMetadata.tsx`、`utils.test.ts` に存在 | ◎ |
| `comboDetail.metadata.driveGauge` / `saGauge` in ja.json / en.json | 開始残量 i18n ラベルが残存 | `ja.json` lines 89-90: "ドライブゲージ開始残量" / "SAゲージ開始残量"、`en.json` lines 87-88 同様 | ◎ |

---

## 総評

M7-04-1 の実装は、系統 A (CHANGE-019 クリーンアップ、47 箇所)・系統 B (バグ #5) ともに指示書仕様どおりに完成している。削除全数性確認で 3 系統 grep すべて **コード領域 0 件** を達成し、温存対象も全件確認できた。マイグレーション 000008 は SQLite 3.35+ の `ALTER TABLE DROP COLUMN` を使用し down マイグレーションも正しく記述されている。系統 B のバグ #5 修正は `parseComboApiError` 関数の新設により、M7-05 バグ #6 が踏襲しやすい共通パターンとして確立されている。

軽微な問題として、`ValidateComboForCreate` の godoc に廃止済み VAL-C06/C07 スキップ注記が残存、`comboList.sort.driveGauge` / `saGauge` が i18n sort セクションの未使用キーとして残存(製造担当の観察事項として progress-log.md に記録済み)、`window.confirm` の既存問題がある。いずれも機能影響はなく、重大問題はゼロであるため **完了承認可** と判定する。ただし E2E シナリオ 6(バグ #5 の表示見た目)は開発者実機での目視確認が必要。

---

## 設計準拠性レビュー結果

### §1 設計書本体との照合

#### §1.1 削除の全数性
◎ — 上記 grep 全数性確認のとおり、3 系統コード領域 0 件。`migrations/000001` の CREATE TABLE 履歴・新規 `migrations/000008` の DROP/復元記述はチェックリスト許容対象として除外。

#### §1.2 設計書本体規定との整合
- DES-003 v1.15.0 §3.4(消費量カラムなし) ⇔ `model.Combo` フィールドなし、`000008.up.sql` で DROP 実施：◎
- DES-006 v1.10.0(VAL-C06/C07 なし) ⇔ `validateC06*` / `validateC07*` 関数・エラーコード定数・`ValidateComboForCreate` 内呼出が削除されている：◎
- DES-005 v2.12.0 §5.4/§5.5(消費ソートなし) ⇔ `SORT_FIELD_VALUES` に消費キーなし、`sortFieldWhitelist` にも消費キーなし：◎
- DES-005 §5.8(比較表示に消費行なし) ⇔ `CompareTable.tsx` の `rows` 配列に消費行なし：◎

#### §1.3 バリデーション ID の欠番扱い
◎ — VAL-C06/C07 削除後、VAL-C08 以降はリネームなし。`internal/service/validation/combo.go` の定数ブロックは `CodeC08MoveExists` ~ `CodeC12RushVariantOriginal` のままで不変。欠番扱いを示すコメント(`// VAL-C06 / VAL-C07(ゲージ消費量バリデーション)は CHANGE-019 で廃止。ID は欠番とし繰り上げない。`)が適切に挿入されている。

### §2 API 整合性
◎ — `ComboResponse` から両フィールド削除確認。`toComboResponse` のマッピングからも削除確認。`repository.go` の grep 0 件確認で SELECT 5 本・`scanCombo`・INSERT の列/スキャン引数からも削除済みであることを確認。`sortFieldWhitelist` からも消費 2 キーが削除され、他のソートキーは不変。

### §3 フロントエンドの動作仕様

#### §3.1 系統 A(削除)
- `types.ts`: ComboSummary(lines 39-70) / Combo(lines 112-138) から両フィールド削除確認。ComboDetail は ComboSummary を継承するため独立追加不要で正しい対応：◎
- `combo-list.ts`: `SORT_FIELD_VALUES` = `["default", "updated_at", "damage", "starter_move_id"]` の 4 要素になり消費 2 項目が除去済み。`SORT_FIELD_LABELS` も同 4 エントリのみ。`Record<SortField, ...>` の網羅性も保たれていることを型定義で確認：◎
- `CompareTable.tsx`: `rows` 配列に消費関連の行定義がなく、指示書指定の他 10 行(始動状況/ルート/ダメージ/状況/有利フレーム/起き攻め×2/セットプレイ/タグ/備考)は不変：◎
- i18n: `ja.json` / `en.json` の `compare.row` セクションに `driveGauge` / `saGauge` エントリなし確認(消費行ラベル削除)。`comboList.sort` セクションに `drive_gauge_consumed_total` / `sa_gauge_consumed_total` なし確認：◎

#### §3.2 系統 B(バグ #5)
- `errors.ts`(新規): `parseComboApiError` 関数が `ApiError + validations` を検出し、VAL-C02(重複)は `duplicateIssue` として分離、その他バリデーションは `validations` として返す設計：◎
- `PromoteToFinalButton.tsx`: `onValidationError` コールバックを追加し、`parseComboApiError` の結果に基づき重複→DuplicateWarning / バリデーション→onValidationError / 致命エラー→toast という 3 分岐が正しく実装されている：◎
- `ComboDetailPage.tsx`: `promoteError` state を追加し、ボタン行外の全幅に `ValidationDisplay result={promoteError ?? undefined}` を配置。400 のバリデーションエラー内容が通常の ValidationDisplay として表示される経路が成立：◎
- `ComboEditor.tsx`: `PromoteToFinalButton` に `onValidationError={setValidationResult}` が wired されており、同パターン踏襲確認：◎
- 昇格フロー自体(PATCH `/api/combos/{id}` の `is_draft: false`)は変更なし。エラー表示のみの修正：◎

### §4 テストの妥当性

#### §4.1 バックエンドテスト
- `validation/combo_test.go`: TestC06/C07 系 4 件が削除され、代わりに廃止コメントが入っている。TestC08〜TestC12 + TestC01〜C05 は不変：◎
- `go test ./...` は progress-log.md で「パス確認」と記録されている：○(直接実行は行わず製造担当の記録で確認)

#### §4.2 フロントエンドテスト
- `CompareTable.test.tsx`: `makeCombo` フィクスチャから消費フィールドが削除されていることを確認。他のアサーション(各行ラベル・ダメージ値・起き攻め等)は不変：◎
- `useCompareCombos.test.tsx`: `makeCombo` フィクスチャから消費フィールドが削除されていることを確認：◎
- `utils.test.ts`: `formatDriveGauge` / `formatSAGauge` テストが変更されていないことを確認：◎
- `PromoteToFinalButton.test.tsx`(新規): 5 ケース実装。isDraft=false でのレンダリングなし・ボタン表示・確認ダイアログ・PATCH 送信・**400 バリデーションエラー時の `onValidationError` 呼出(バグ #5 検証)**。特に最後のケースが本修正の核心をコンポーネントテストで検証しており適切：◎
- vitest は progress-log.md で「79 ファイル / 427 テスト パス」と記録されている：○

#### §4.3 E2E シナリオ
- progress-log.md に E2E シナリオ 1〜5(回帰)の確認記録あり。シナリオ 6(バグ #5 の表示見た目)は開発者実機の目視確認依頼として明記されている：○

### §5 設計意図との整合
◎ — 削除と温存の境界(消費量のみ削除、増加量・開始残量は温存)が正しく判断されている。`ComboDetailMetadata.tsx` が `driveAvailableAtStart` / `saAvailableAtStart` を使い続けていることを確認。バグ #5 はバリデーション仕様(VAL-C09 = レシピ空は ERROR)を緩めず、エラーを正しく表示する方向での修正である。過去マイグレーション 000001〜000007 は改変なし。

### §6 コード品質・規約遵守
- 削除に伴う未使用 import / 変数の残存はなし(grep で確認)：◎
- エラーコード定数の欠番は適切なコメントで案内されている：◎
- `errors.ts` の命名・型注釈は既存規約に沿っている：◎
- `PromoteToFinalButton.tsx` の `onValidationError` コールバック型定義は `ValidationResult | null` で適切：◎

### §7 既存挙動の温存
◎ — 温存 grep 全数確認で上述のとおり。CompareTable の消費以外の 10 行も不変。

### §8 ドキュメント・進捗ログ
◎ — `progress-log.md` の M7-04-1 セクション(line ~2378)が充実した内容で追記されている。系統 A の 47 箇所実施結果・マイグレーション 000008・系統 B のバグ #5 修正・テスト件数の増減(+1 件)・開発者への依頼事項・観察事項(未使用 i18n キー)が記録されている。

---

## 設計準拠性以外の指摘事項

### [低] VAL-C06/C07 スキップ注記が godoc コメントに残存
**ファイル**: `internal/service/validation/combo.go` lines 96-97

`ValidateComboForCreate` の godoc コメントに以下が残っている:
```
//   - VAL-C06: スキップ
//   - VAL-C07: スキップ
```

関数本体は削除済みで実害はないが、廃止済み VAL-C06/C07 が「スキップ」という形で生き残っているように見え、将来の読者が混乱する可能性がある。また、line 232 には `// VAL-C06 / VAL-C07(ゲージ消費量バリデーション)は CHANGE-019 で廃止` のコメントがあり整合性がやや不完全。指示書の明示削除対象外(RESEARCH-04 で列挙されていない)のため削除しなかった判断は理解できるが、将来対応が望ましい。

### [低] `comboList.sort.driveGauge` / `saGauge` が i18n sort セクションの未使用キーとして残存
**ファイル**: `web/src/locales/ja.json` lines 54-55、`web/src/locales/en.json` lines 54-55

製造担当が progress-log.md の観察事項として自己記録済み。`comboList.sort.${SortField}` の動的参照は snake_case のフィールド値 (`"default"` / `"updated_at"` / `"damage"` / `"starter_move_id"`) を使うため、camelCase キーである `driveGauge` / `saGauge` には到達しない。機能影響なし。スコープ厳守の観点から本タスクで削除しなかった判断は適切。整理要否は設計担当判断。

### [既存問題・スコープ外] `window.confirm` が ComboDetailPage.tsx に残存
**ファイル**: `web/src/pages/ComboDetailPage.tsx` line 43

`window.confirm(t("comboDetail.deleteConfirm"))` が使用されており、architecture-patterns §1.2.4 の `window.confirm` 禁止(shadcn/ui AlertDialog への置換要求)に抵触する。ただし M7-04-1 で新規導入したものではなく、変更前から存在する既存問題。本タスクのスコープ外であり指摘に留める。

---

## 推奨修正(優先度別)

- **高(M7 完了前に修正必須)**:
  - なし

- **中(M8 着手と並行可)**:
  - なし

- **低(将来対応)**:
  - `ValidateComboForCreate` godoc の VAL-C06/C07 スキップ注記を削除または「廃止」注記に修正
  - `comboList.sort.driveGauge` / `saGauge` の未使用 i18n キーを削除(設計担当確認後)
  - `window.confirm` を shadcn/ui AlertDialog に置換(ComboDetailPage.tsx line 43、既存問題)

---

## 良かった点

- **grep 完了条件を製造担当自身が確認し progress-log.md に記録していた**: M7-11 反省(機械レビュー担当が grep を必須実行する趣旨)を先取りする形で製造担当が実施しており、レビュー作業の効率が高まった。
- **`comboList.sort.driveGauge` / `saGauge` 未使用キーについての観察事項記録**: 削除すべきか明確でないキーをスコープ外と判断した理由と事実を progress-log.md に記録しており、将来対応のトレーサビリティが確保されている。
- **`parseComboApiError` の共通化設計**: バグ #5 修正を単なる局所修正にとどめず、`web/src/features/combo/errors.ts` として切り出し、M7-05 バグ #6 が踏襲しやすい形にした点が指示書 §4.2.2 の意図に合致している。
- **PromoteToFinalButton のテスト設計が充実**: バグ #5 の核心「400 バリデーションエラー時に onValidationError が正しく呼ばれること」をコンポーネントテストで検証しており、回帰を防ぐ品質担保ができている。
- **削除と温存の境界が正確**: `formatDriveGauge` / `formatSAGauge` の二重使用 (RESEARCH-04 §0.5 の想定外発見) を正しく理解し、関数は温存・CompareTable の使用箇所のみ削除するという精密な対応がなされている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `go test ./...` / `pnpm exec vitest run` の実行結果は製造担当の progress-log.md 記録に基づく確認(○)であり、本レビューで直接実行した結果ではない。
- E2E シナリオ 6(バグ #5 の「ボタン状」崩れ解消の目視確認)は開発者実機での確認が必要。

---

## 完了承認判定

**完了承認可**

- §1.1 削除全数性 grep = コード領域 0 件(3 系統すべて)— 報告書に実行結果転記済み ✓
- §7.1 温存対象 grep = すべて存在 — 報告書に実行結果転記済み ✓
- §1〜§8 の各チェック項目に重大問題(§9)なし ✓
- バグ #5 解消(parseComboApiError + onValidationError + ValidationDisplay による統一エラー表示)✓
- ビルド / テスト(製造担当記録)パス ✓
- スコープ外への変更なし ✓
- 軽微問題(§10)を上記推奨修正「低」として一覧化 ✓

*以上、M7-04-1 レビュー報告書*
