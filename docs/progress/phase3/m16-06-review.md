# M16-06 レビュー報告書

対象コミット: `810bd86`（feat(M16-06/notation)）/ 指示書 v1.0.1・チェックリスト v1.0.1
レビュー日: 2026-07-08 / レビュー担当: 品質レビュー担当 Claude Code（読み取りのみ）

## 総評

M16-06（非スキーマ表記 rollout）の 4 論点（A-3 始動/消費ラベル正典化・A-1 消費エクスポート・F-1(a) 始動クランプ・FB⑥ fallback 最小整合）はいずれも指示書 v1.0.1・チェックリストの重大判定基準を満たしており、承認可能と判断する。始動ラベルの 2 表記並立（「始動残量」「開始残量」/`(start)`）は詳細・比較・入力欄・エクスポート・ja/en 全サーフェスで「コンボ開始時の◯◯ゲージ残量」/「... gauge at combo start」へ統一され、grep でも実 UI ラベルに残存ゼロを確認した。非スキーマ・非破壊（internal/ 変更なし・DTO/data-testid/export キー semantics・BE/CSV 範囲非連動不変）も担保されている。消費エクスポートは EXPORT_ITEMS 汎用 map + DEFAULT_SELECTED_ITEMS により UI トグル/画像/PDF/クリップボードへ自動反映され既定 ON で始動と対称、始動クランプも各欄自身の min/max で消費と対称。重大（§9）・高優先の指摘はなし。以下は低優先の観察のみ。

## 設計準拠性レビュー結果

### 1.1 始動/消費ラベルの横断正典化（A-3・FB⑨⑪⑬）: ◎
- ja 正典「コンボ開始時の◯◯ゲージ残量」統一を全サーフェスで確認:
  - 詳細: `ja.json comboDetail.metadata.driveGauge/saGauge`（94-95行）→ `ComboDetailMetadata.tsx` が `t()` 参照。
  - 比較: `ja.json compare.row.driveAvailableAtStart/saAvailableAtStart`（164-165行）→ `CompareTable.tsx` が `t(labelKey)` 参照。
  - 入力欄: `ComboEditorBasicFields.tsx` が `GAUGE_AT_START_LABEL_JA.{drive,sa}` を参照。
  - エクスポート: `export-items.ts`/`export-model.ts` が同定数を参照。
- en parity（`Drive/SA gauge at combo start` / `... consumed`）を en.json 詳細（94-95）・比較（164-165）で確認。`(start)`/`consumed` の語法非対称は解消。en は英語圏で自然な表現。
- 消費ラベル「◯◯ゲージ消費」は不変・全所在で維持（指示書どおり定数化せず）。
- 残存検証（自分でも grep 実施）: `始動残量`/`開始残量`/`gauge (start)`/`(start)` は **実 UI ラベルに残存ゼロ**。ヒットは全てコメント・テスト記述・変数名（`driveAvailableAtStart` 等の内部識別子）のみ。
- SSOT 集約: 非 i18n 文脈（export・入力欄）向けに `GAUGE_AT_START_LABEL_JA` を `labels.ts` へ集約。i18n サーフェスはロケールファイルが SSOT という分担がコメントで明示され妥当。

### 1.2 消費エクスポート項目（A-1）: ◎
- `ExportItemKey` に `driveConsumed`/`saConsumed` を追加、`EXPORT_ITEMS` で始動 2 項目の直後に対称配置。
- `ALL_EXPORT_ITEM_KEYS = EXPORT_ITEMS.map(...)`・`DEFAULT_SELECTED_ITEMS = new Set(ALL_EXPORT_ITEM_KEYS)` により**既定 ON（始動と対称）**。
- UI トグルは `ComboExportPage.tsx:246` が `EXPORT_ITEMS.map` で描画し、初期 state（55-57行）が `DEFAULT_SELECTED_ITEMS` → 新項目が自動でトグル出現かつ既定選択。
- 画像/PDF/クリップボードは `buildComboFields`（selectedItems 汎用 map）経由のため自動反映。`export-model.ts` に消費 2 行を始動直後へ追加・フォーマッタ null/undef→"-"。
- テスト（export-model.test.ts）で消費値出力・全選択行数 25・ALL への包含を検証。

### 1.3 始動入力欄クランプ（F-1(a)）: ◎
- 始動欄 drive を `clampNumericString(v,0,6)`・SA を `clampNumericString(v,0,3)` で各欄自身の min/max にクランプ（消費欄と対称）。
- `clampNumericString`（497行）は範囲外のみ min/max へ丸め、途中入力（""/"1."）は保持・**保存ブロック range ERROR は付けない** → BE/CSV 範囲非連動が不変（① 方針維持）。
- テストで上限超過値（9→6 / 5→3）のクランプ onChange を検証。

### 1.4 FB⑥ fallback 最小整合（as-built v1.0.1）: ◎
- `SetupRecipeEditor.tsx:38-39`: 短縮「共通システム」→ 正典「共通システム（移動・その他）」。同ファイルの option ラベル（196/225行）と一致し SSOT 整合。
- `StepRow.tsx:88-93`: 生 `modifiers.type` fallback を排除し、既知 type は `MODIFIER_NON_MOVE_TYPES` のラベル、未知は既存プレースホルダ「(不明なステップ)」へルーティング。ad-hoc ラベル新設なし・生コード非露出。
- 対象外の維持を確認: `StepRow.tsx:95`（最終「(不明なステップ)」）・`SetupRecipeEditor.tsx:41-42`（「技 #id」）は diff で未変更。詳細/比較/出力にも手が入っていない。
- 生「技/非技ステップ」表現が rendered UI に不在（残存はコメント/テストのみ）という前提も grep で追認。

### 2. 非破壊性: ◎
- `git show --name-only` で **internal/・migrations/ 等の非 web 変更ゼロ**（Go 側完全不変）。
- 内部識別子（`driveAvailableAtStart`/`sa_gauge_consumed`/`_dr` 等 camelCase・snake_case）・`data-testid`（`combo-editor-drive-available`/`sa-available`）・export キー semantics 不変。
- 一覧列への始動/消費追加なし。CSV 契約・BE 検証不変（表示・エクスポート設定・入力挙動のみ）。

### 3. レイアウト/レスポンシブ: ○（コード上は妥当・実機は別途）
- 詳細メタ: `dl grid grid-cols-2 md:grid-cols-4`・`dt text-xs`。長ラベルはセル内折返しで収容。
- 比較表: ラベル列 `sticky left-0 ... whitespace-nowrap`（79行）＋外側 `overflow-x-auto`（295行）。長ラベルは折返さず列幅を広げるが横スクロールで吸収。既存の oki ラベル（例「投げ重ね(その場受け身・ドライブラッシュ)」）が既により長く列幅を規定している点からも新ラベルで新規崩れは生じない設計。
- 入力欄: `Field` の `Label text-xs`。
- コード上の破綻要因は認めない。実際のスマホ幅ピクセル描画確認は本レビュー範囲外（下記制約事項）。

### 4-5. テスト妥当性・設計意図整合: ◎
- 正典ラベル（export-model / CompareTable / ComboEditorBasicFields）・消費エクスポート（既定 ON・値出力・行数）・始動クランプ（上限超過）の各ケースが追加。既存テストの旧ラベル期待も正典へ更新。FE 668 件パス・tsc clean の報告と整合（テスト内容はコード読解で確認、実行は再走査せず）。

## 設計準拠性以外の指摘事項

- コーディング規約: JSON タグ/DTO は非対象（FE のみ）。`console.log`/`fmt.Println` の新規残置なし。簡体字なし。画面向け「DR」略記なし（内部識別子 `_dr` は不変・規約どおり）。曖昧語依存の実装なし。
- 命名・定数化: `GAUGE_AT_START_LABEL_JA` は SCREAMING_SNAKE_CASE + `as const`。マジックストリング散在を抑制。コメントで SSOT 分担（i18n=ロケール / 非 i18n=定数）を明示しており可読性良好。
- import 順・エイリアス（`@/features/combo/labels`）規約準拠。
- セキュリティ/ストレージ: localStorage 等の新規使用なし。該当なし。

## 推奨修正（優先度別）

- 高（M16 完了前に修正必須）: なし。
- 中（M17 着手と並行可）: なし。
- 低（将来対応）:
  - (L-1) ja 正典文字列「コンボ開始時の◯◯ゲージ残量」が `ja.json`（i18n サーフェス用）と `labels.ts の GAUGE_AT_START_LABEL_JA`（非 i18n サーフェス用）の 2 箇所に literal で存在する。i18n/非 i18n の分割上やむを得ず、コメントでも意図が明示されているが、将来ラベル改称時は両所の同期が必要である点を申し送り事項として残すと安全。
  - (L-2) エクスポート項目ラベル・入力欄ラベルは ja literal 直書き（en 化されていない）。これは M16-06 以前からのエクスポート/入力欄が ja 単一言語である既存仕様に沿ったもので本サブの欠陥ではない。en parity 要件は i18n サーフェス（詳細/比較）に対して達成済み。将来 export/入力の i18n 化を行う場合の対象として記録に留める。

## 良かった点

- 全表示箇所の網羅が徹底され、grep 追認でも 2 表記並立の残存ゼロ。retrospective-digest §4（表示トークン全表示箇所調査）の教訓が実践されている。
- 消費エクスポートを `EXPORT_ITEMS` 汎用 map + `DEFAULT_SELECTED_ITEMS` に乗せたことで、UI トグル・画像・PDF・クリップボードへ個別実装なしに自動反映・既定 ON 対称を最小差分で達成。設計意図（対称性）に忠実。
- FB⑥ を v1.0.1 の as-built（生表現は既に不在・実対象は fallback 2 箇所）に厳密に限定し、エッジ fallback・詳細/比較/出力に一切手を入れていない。スコープ厳守（MEMORY: feedback_scope_discipline）が守られている。
- 始動クランプが保存ブロック ERROR を付けず UI 値クランプのみで BE/CSV 非連動を維持しており、① 方針を正しく理解している。
- コメントに変更根拠（論点 ID・SSOT 分担・非連動理由）が過不足なく記載され、後続の追跡が容易。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト（特に長 ja ラベルのスマホ幅ピクセル描画・エクスポート画像/PDF の実描画・E2E 往復）は別途実施が必要。
- テストは「FE 668 件パス・tsc clean」の事前報告を前提とし、本レビューでは再実行せずコード読解で内容妥当性のみ確認した。

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C により、製造担当 Claude Code が本報告書の各指摘を自動トリアージした（2026-07-08）。人間トリアージ承認を外す代償として採否理由を以下に永続化する。安全弁（優先度「高」指摘の不採用時エスカレーション）の対象となる「高」指摘は本レビューに存在しない。

| 指摘 | 優先度 | 採否 | 理由 |
|------|--------|------|------|
| 重大（§9）指摘 | 高 | — | **該当なし**（重大・高優先ゼロ）。エスカレーション不要。 |
| (L-1) ja 正典文字列が `ja.json` と `labels.ts` の 2 箇所に literal 存在 | 低 | **不採用** | i18n サーフェス（`t()` 参照＝ロケールファイルが SSOT）と非 i18n サーフェス（export-model 等の非コンポーネント文脈・`t()` 不可）を単一 SSOT へ統合する手段が現行 i18n 構成に無く、分割はやむを得ない。両所ともコメントで意図・同期必要性を明示済み。将来の一括改称時の同期注意は §10 完了後の伝達メモへ申し送る。実害なし・非破壊のため本サブでは変更しない。 |
| (L-2) export/入力欄ラベルが ja literal 直書き（en 化なし） | 低 | **不採用** | M16-06 以前からの export/入力欄が ja 単一言語である既存仕様に沿ったもので本サブの欠陥ではない。指示書の en parity 要件は i18n サーフェス（詳細/比較）に対して達成済み（スコープ内）。export/入力の i18n 化はスコープ外（feedback_scope_discipline）。将来 i18n 化を行う場合の記録に留める。 |

**取り込みによるコード変更: なし**（全指摘が低優先・by-design・不採用のため）。実装コミット `810bd86` を最終とする。
