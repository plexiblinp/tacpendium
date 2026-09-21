# M16-07 レビュー報告書

対象コミット: `98961e6`（feat(M16-07/custom-states): int ストックを始動最低/終了2値化＋増減表示）
レビュー日: 2026-07-08 / レビュー担当: 品質レビュー Claude（read-only）

## 総評

指示書 v1.0.0・チェックリスト v1.0.0 の最重要ゲート（situation opaque＝スキーマ/DTO/BE 不変・dup/recipe 非波及・移行 graceful・show_delta 分岐・消費非構築・Ingrid 実装/4 キャラ後回し）はいずれも実コードで満たされている。非波及は BE 側（DuplicateCheckFields／DuplicateKey／CalcRecipeHash／RecomputeComboCache）を実査して裏取り済みで、マイグレ 000023 は既存 seed を触らず `states[0].code='sun_crest'` ガード付きの JSON patch で up/down 対称。ラベルは `customStates.ts` 単一 SSOT に集約され、i18n 境界（詳細/比較=locale 連動 en・export/入力欄=ja）も M16-06 に沿う。tsc / go build / 変更 3 テストファイル 58 件 / infra マイグレテストいずれも green。
唯一の実質的な欠けは **DoD §5.2 の Ingrid E2E が本コミットに追加されていない**点（Ingrid は seed 済みで testable なため実装可能だが未実施）。ただしチェックリスト §9「完了承認を妨げる重大」の列挙項目には該当せず、機能ロジックは単体/コンポーネントテストで厚く担保されている。したがって **§9 重大はゼロ**、Ingrid E2E とテスト網羅の一部を中〜低の持ち越しとする。

## 設計準拠性レビュー結果

### §1.1 situation の 2 値化（指示書 §4.1・§3.4-1）— ◎
- int 値は `{start_min, end}` 構造化で格納（`buildSituation` customStates.ts:189-236、格納は L223 `{ start_min, end }`）。旧スカラは `normalizeIntValue` で ②(end) へ写像（L113-116）。
- スキーマ/DTO/BE 不変を確認：`model/combo.go:129` `Situation *string`（生 JSON 素通し）。BE 側に situation 整形コードなし。◎

### §1.2 DEF `show_delta`（指示書 §4.2・§3.4-2）— ◎
- マイグレ 000023 up: `json_set(custom_states,'$.states[0].show_delta', json('true'))`、`WHERE code='ingrid' AND ... json_extract(...,'$.states[0].code')='sun_crest'`。既存 seed 000015 非編集。down は `json_remove` で対称。
- 実 seed の int state は Ingrid `sun_crest` のみ。Mai/Lily/Juri/Kimberly は**キャラ行自体が未 seed**（000014 は ken/ingrid/c_viper/dhalsim のみ）→ def フラグ・E2E とも M14-03b へ委譲、と報告書に明記。指示書 §3.4-2 の想定（「def フラグ設定のみ」）から「キャラ行がないため丸ごと委譲」への逸脱理由も進捗ログに記録済みで妥当。◎
- CHANGE-067 見込みは `docs/handover/M16-07-to-design-memo.md` で申し送り、DES 本体は未編集。◎

### §1.3 ラベル生成・i18n 境界（指示書 §4.3・§3.4-3）— ◎
- SSOT: `STOCK_PHRASE`（customStates.ts:247-251）＋ `customStateIntLabel(def,kind,locale)`（L265-272）。総称「ストック」・仮ラベル明記（L241）。
- 詳細（ComboDetailHeader.tsx）・比較（CompareTable.tsx）は `toCustomStateLocale(i18n.language)` で locale 連動 en、export（export-model.ts:96 コメント）は resolver 既定 `locale="ja"` 固定。M16-06 境界に整合。◎
- flag 型ラベルは en サーフェスでも `name_ja` のまま（L311・スコープ外・開発者確定）。M16-07 は int 限定のためスコープ厳守として妥当（下記「設計準拠性以外」に観察を記載）。

### §1.4 ③増減（指示書 §4.4）— ◎
- `intStateDelta = end - start_min`（符号付き・L127-129）。`show_delta` の state のみ resolver が ③行を push（L335-343）。派生表示（入力欄なし）。◎

### §1.5 editor / display（指示書 §4.5/§4.6）— ◎
- editor：int を ①start / ②end の 2 欄化（ComboEditorBasicFields.tsx:412-435、min/max・`blockNonNumericKeys`・`Math.trunc`+クランプ踏襲）。`show_delta` 時のみ ③ calc 表示（L436-443、入力不可）。flag は Switch 不変（L382-400）。◎
- display：詳細/比較/export いずれも `resolveCustomStatesForDisplay` 経由で ①②（③）明示ラベル。1 state→複数行のため map key を `code-kind` 化（ComboDetailHeader.tsx:108・CompareTable.tsx:130）。◎

### §1.6 DES 直接編集の禁止 — ◎
- DES 本体変更なし、伝達メモで CHANGE-067 起票を設計担当へ委譲。◎

### §2 非波及・非破壊（本サブの肝）— ◎
- `DuplicateCheckFields`（duplicate_keys.go:23-31）＝character_id / recipe_hash / starter_move_id / position / opponent_stance / hit_type / opponent_size。situation 非含。
- `validation.DuplicateKey`（combo.go:74-81）にも Situation フィールドなし。
- `CalcRecipeHash`（duplicate_keys.go:45-）は combo_steps のみ。`RecomputeComboCache`（cache.go:62-）は presets＋steps のみ、situation 未読取。
- スキーマ/DTO/BE/CSV 不変（situation opaque・素通し）。消費セマンティクス一般構築なし（B-1 据え置き、表示用 2 値＋派生増減のみ）。◎

### §3 スコープの限定 — ◎
- Ingrid のみ実装、他 4 キャラは未 seed で M14-03b 委譲。flag 型・drive/SA（M16-02）不変。◎

### §4 テストの妥当性 — ○（Ingrid E2E 欠落・一部サーフェス直接テストなし）
- §4.1 単体/コンポーネント：`customStates.test.ts`（22 件）で構造化往復・旧スカラ graceful（→②写像）・`normalizeIntValue` 各分岐・resolver の ①②③展開／`show_delta` 分岐／locale ja/en／delta 符号（+2 / -2）を網羅。`ComboEditorBasicFields.test.tsx`（33 件）で 2 欄描画・min/max・show_delta 有無・① 入力の構造化 onChange・旧スカラ→②欄。`ComboDetailHeader.test.tsx`（3 件）で ①②③明示ラベル＋符号＋移行。◎
- dup 非回帰：実コードで裏取り（§2）。既存 round-trip/NULL 後方互換テストは非回帰。◎
- **§4.2 Ingrid E2E：本コミットに追加なし（△）**。既存 `web/e2e/combo-custom-states.spec.ts` は ryu の flag（denjin_charge）のみで、Ingrid int の ①②入力→保存→詳細/比較/export ①②③・移行の E2E は未整備。指示書 §5.2・DoD §7.2 の Ingrid E2E 項目が形式上未充足（機能は単体/コンポーネントで担保）。
- CompareTable の int/locale 分岐・export-model の int 整形分岐は、コンポーネント/統合レベルの直接テストがなく `resolveCustomStatesForDisplay` 単体テストと詳細ヘッダテストによる間接担保にとどまる（△）。

### §5 設計意図との整合 — ◎
- 意味の明示（1 項目→①②③）・スキーマ据え置き FE 整形・表示用 2 値限定・Ingrid 実装＋4 キャラ後回し、いずれも精神に合致。◎

### §6 コード品質・規約 — ◎
- 変更 5 ファイルに `console.log`／`fmt.Print` 残置なし。SSOT 集約・全 read/write/ラベル箇所の grep が進捗ログに記録。曖昧語依存・簡体字・「DR」略記の混入なし。◎

### §7 既存挙動の温存 — ◎
- flag 型・drive/SA・重複判定・recipe_cache・M13 CSV 不変。旧スカラ既存コンボは移行後も破綻しない（テスト済み）。◎

### §8 ドキュメント・進捗ログ — ◎
- 進捗ログに Plan Mode 9 項目・show_delta 追加技法（000023）・5 キャラ def 実査・4 キャラ E2E 後回し・dup/recipe/BE 非波及を記載。伝達メモで CHANGE-067 三点セット申し送り済み。◎

## 設計準拠性以外の指摘事項

1. **kind 語彙の二重化（低・命名）**: `IntStateLabelKind = "startMin" | "end" | "delta"`（camelCase）と `ResolvedCustomState.kind = "flag" | "start_min" | "end" | "delta"`（snake_case）が同概念に対し別綴りで併存（customStates.ts:244・293）。型安全で機能上は無害（`formatIntStateValue` は `"delta"` のみ分岐）だが、将来の混同リスクあり。どちらかへ統一するとより明快。

2. **editor の ③行のセパレータ混在（低・体裁）**: ComboEditorBasicFields.tsx:441 は `{customStateIntLabel(def,"delta","ja")}: {formatIntStateValue(...)}` で、ラベル末尾（全角「：」を含む固定句）に半角 `: ` を追加し「サンシンボル：ストック増減: +2」と全角/半角の区切りが混在する。詳細/比較（dt/dd 分離）では発生しない editor 固有の軽微な体裁。チェックリスト §10（表示位置細部）許容範囲だが、仮ラベル確定時に合わせて調整推奨。

3. **flag 型ラベルの en 非対応（観察・スコープ外）**: en i18n サーフェスでも flag は `name_ja` 表示（L311）。M16-07 は int 限定で意図的（開発者確定）だが、将来 flag も en 化する場合は同 SSOT で扱えるよう含みを残すと良い。今回の指摘対象外。

4. **エクスポートの locale 既定依存（低）**: export-model.ts はコメントで「resolver の locale 既定 = ja」に依存している（引数省略）。既定値が将来変わると export が en 化しうる。堅牢性のため明示的に `"ja"` を渡す選択肢もあるが、現状の設計意図（既定 ja）とは整合しており必須ではない。

## 推奨修正（優先度別）

- **高（M16 完了前に修正必須）**: なし（チェックリスト §9 重大ゼロ。situation 非波及・スキーマ/DTO/BE 不変・移行 graceful・show_delta 分岐・消費非構築・Ingrid 実装/4 キャラ後回しをすべて満たす）。
- **中（M17 着手と並行可）**:
  - DoD §5.2 の **Ingrid int E2E**（①②入力→保存→詳細/比較/export ①②③・旧スカラ移行）を `web/e2e/combo-custom-states.spec.ts` に追補。Ingrid は seed 済みで即 testable。形式上の DoD 未充足を閉じる。
  - CompareTable の int/locale 分岐・export-model の int 整形分岐に対する直接テスト追加（現状は間接担保）。
- **低（将来対応）**:
  - `IntStateLabelKind` と `ResolvedCustomState.kind` の綴り統一（指摘 1）。
  - editor ③行のセパレータ体裁（指摘 2）・export の `"ja"` 明示（指摘 4）は仮ラベル確定時にまとめて。

## 良かった点

- **非波及の裏取りが徹底**: DuplicateCheckFields／DuplicateKey／CalcRecipeHash／RecomputeComboCache を実ファイル・実行番地まで挙げて「situation 未読取」を確認しており、本サブ最大のゲートを確実に押さえている。
- **移行の堅牢さ**: `parseSituationCustomStates` が number をそのまま受理し `normalizeIntValue` で ②へ写像する二段構えで、旧スカラ既存データを壊さない。テストも構造化往復・旧スカラ・欠損・範囲外クランプを個別に検証。
- **マイグレのガード設計**: `states[0].code='sun_crest'` の json_extract ガード＋games.sf6 スコープで、誤対象への patch を防止。up/down 対称で既存 seed 非編集。
- **SSOT とスコープ厳守**: ラベルを単一 TS-SSOT へ集約し表記揺れを防止。flag・drive/SA・消費セマンティクスに手を出さずスコープを厳守。
- **ドキュメント品質**: 進捗ログが Plan Mode 9 項目を実番地付きで網羅し、CHANGE-067 伝達メモも整備。追跡可能性が高い。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実機テスト・E2E 実行・パフォーマンスは別途。
- E2E の欠落は spec ファイル存在有無で判定（`make e2e` 実行はしていない）。

---

## 取り込み結果（自動トリアージ・製造担当 Claude / 2026-07-08）

`/implement_plan_full` Phase C。**優先度「高」の指摘はゼロ**のためエスカレーション不要。各指摘の採否と理由は以下。取り込みは追加コミットで実施（本コミット後）。

| # | 指摘（優先度） | 採否 | 理由 |
|---|----------------|------|------|
| 中-1 | Ingrid int E2E 追補（DoD §5.2） | **不採用（M14-03b へ委譲）** | (a) レビュー自身が「M17 着手と並行可＝M16 完了を妨げない」と評価・§9 重大に非該当。(b) 機能は単体/コンポーネントテスト（customStates 22 件・editor 33 件・detail 3 件＋今回追加の compare/export int 直接テスト）で ①②③/show_delta/移行/locale/符号まで厚く担保。(c) **既存 e2e（`combo-custom-states.spec.ts`）はウィザード既定キャラ ryu の flag を対象**にしており、Ingrid int を実データ E2E する為にはエディタでのキャラ選択フロー駆動が要るが、これは e2e スタックで未確立・Ingrid の move seed 前提も含め **M14-03b（全キャラ seed）で Ingrid＋4 キャラをまとめて E2E するのが整合的**（指示書も 4 キャラ E2E を M14-03b 連動と規定）。→ 完了報告・伝達メモの「E2E は M14-03b 連動」に Ingrid も含める旨を追記。 |
| 中-2 | CompareTable / export-model の int 分岐の直接テスト | **採用（実施済み）** | 間接担保の穴を閉じる。`CompareTable.test.tsx` に int ①②③（show_delta・ja）チップ表示テスト、`export-model.test.ts` に int ①②③ ja 出力テストを追加（各 mock/fixtures に ingrid int def を追加）。FE 682 件 green。 |
| 低-3 | export の locale 既定依存 → `"ja"` 明示 | **採用（実施済み）** | 堅牢性。`export-model.ts` の `resolveCustomStatesForDisplay(..., "ja")` を明示に変更（resolver 既定変更への非依存化）。 |
| 低-1 | `IntStateLabelKind`(camelCase) と `ResolvedCustomState.kind`(snake_case) の綴り併存 | **不採用（低・持ち越し）** | 型安全で機能無害（レビューも明記）。ラベルは仮であり CHANGE-067 での確定句反映時にまとめて整理する方が変更を集約でき安全（テスト波及も同時対応）。 |
| 低-2 | editor ③行の全角「：」+半角「: 」セパレータ混在 | **不採用（低・持ち越し）** | チェックリスト §10（③表示位置細部・仮ラベル文言）で持ち越し許容。比較/エクスポートの int 行も同型（label の全角：＋値区切りの半角:）で、**仮ラベル確定時に全サーフェス一括で体裁調整**するのが整合的。 |
| 観察 | flag 型ラベルの en 非対応 | **対応不要（スコープ外）** | M16-07 は int 限定（開発者確定）。レビューも指摘対象外と明記。 |

**結論**: 高ゼロ・中 1 件採用/1 件は M14-03b 委譲（理由明記）・低は 1 件採用/2 件持ち越し。M16-07 の完了承認を妨げる事項なし。
