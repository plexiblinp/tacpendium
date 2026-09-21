# M16-02 追補 v1.0.1 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M16-02 追補 v1.0.1（比較画面のみ・A-1 / CHANGE-060 §7-1） |
| 対象コミット | `f837224`（feat: 比較 4 行掲載）＋ `66d0cf2`（docs: 完了報告 §9 追記） |
| 変更ファイル | `CompareTable.tsx` / `CompareTable.test.tsx` / `locales/ja.json` / `locales/en.json`（＋報告書 §9） |
| レビュー担当 | 品質レビュー Claude（read-only） |
| レビュー日 | 2026-07-05 |
| 判定 | 合格（高・中の必須指摘なし。低=表記の軽微な非対称の申し送りのみ） |

---

## 総評（3〜5 行）

指示書 §9.1（推測禁止事項）・完了報告 §9 の狙いに忠実な、範囲を絞った良い追補。比較画面 `CompareTable` にゲージ 4 行（drive/SA の始動残量・消費）を `damage` 直後の連続ブロックで掲載し、始動なし・消費ありの非対称を解消している。DTO / API 契約 / スキーマ / VAL / 一覧列は無改変で、既存フィールドの表示追加＋消費 2 行の移設に限定されておりスコープ規律が保たれている。`tsc --noEmit` はクリーン（exit 0）、`CompareTable.test.tsx` 11 テスト全通過を実機で確認した。指摘は「比較=始動残量 / 詳細=開始残量」の表記デルタ（§9.3 で M16-06 へ申し送り済み）と en ラベルの軽微な語法非対称のみで、いずれも低優先度。

---

## 設計準拠性レビュー結果（項目別）

### ◎ 比較データの妥当性（4 フィールドが比較データに乗っているか）
- データ経路を実コードで確認: `ComparePage.tsx:46` → `useCompareCombos(ids)` → `useCompareCombos.ts:9` `fetchJSON<ComboDetail>(/api/combos/${id})`。`CompareTable` は `ComboDetail`（`CompareTable.tsx:18,34`）を受け取る。
- `ComboDetail` に 4 フィールドが既載: `web/src/features/combo/types.ts:124-128`（`driveAvailableAtStart` / `saAvailableAtStart` は既存、`saGaugeConsumed` / `driveGaugeConsumed` は本体 M16-02 で追加済み）。3 型（Summary/Detail/Combo）すべてに存在（同 49-53 / 124-128 / 158-162 / 184-188）。
- **DTO / API 契約に変更なし**: 直近 2 コミットの変更対象に `.go` / DTO / migration / repository / schema は一切含まれない（`git diff --name-only` で確認、該当なし）。始動は既存フィールドの表示追加のみ。◎。

### ◎ 始動/消費の判別（friend FB #11）
- 4 行のラベル（ja）: `ドライブゲージ始動残量` / `SAゲージ始動残量` / `ドライブゲージ消費` / `SAゲージ消費`（`ja.json:169-172`）。始動/消費が明確に判別可能。
- **「DR」略記は不使用**（en も `(start)` / `consumed` の正式語で表現、`en.json:169-172`）。
- ja / en 両方にキー追加済み（`driveAvailableAtStart` / `saAvailableAtStart`）。`CompareTable.tsx:208,216` の `labelKey` と一致し raw key 表示バグなし。`tsc` クリーン＋テストで実レンダリング確認済み。◎。

### ◎ VAL 非連動の維持
- 追補は表示層（`CompareTable.tsx` / locale）のみ。`schema.ts`・zod・`internal/service/validation` は無改変（直近 2 コミットに該当ファイルなし）。消費列に範囲 VAL / zod 範囲 ERROR を足していない。本体で是正済みの VAL 非連動方針（`4d66e7f` の zod 範囲 ERROR 除去）を壊していない。◎。

### ◎ スコープ遵守
- 一覧列（ComboList / ComboTable 系）への始動/消費追加なし（`grep AvailableAtStart|GaugeConsumed` → 該当なし）。A-1＝過密回避の現状維持が守られている。
- スキーマ / repository / DTO / migration すべて無改変。変更は 4 ファイル＋報告書のみ。◎。

### ◎ 非回帰（既存比較行・formatter・NULL）
- 既存行はすべて保持（`damage` / `situation` / `customStates` / `knockdownAdvantage` / `oki`×6 / `setups` / `tags` / `memo`）。ゲージ 4 行は `damage` 直後に挿入し、消費 2 行を旧位置（knockdown 直後）から移設。**重複・欠落なし**（`CompareTable.tsx:185-289` で目視確認）。
- formatter 流用が型に整合: `driveAvailableAtStart`（M16-01 で REAL/0.5）・`driveGaugeConsumed`（REAL/0.5）→ `formatDriveGauge`（`toFixed(1).replace(/\.0$/,"")`、`utils.ts:104`）。`saAvailableAtStart`（int 0-3）・`saGaugeConsumed`（int 0-6）→ `formatSAGauge`（`String(value)`、`utils.ts:110`）。いずれも NULL/undefined → `-`（`utils.ts:105,111`）。
- `CompareTable.test.tsx` 11 テスト全通過（実行確認）。値並び（2.5 / 3.5 / 5）・NULL=`-`（≥4）・4 ラベル表示・判別を検証。◎。

### ○ 表記デルタ（比較「始動残量」/ 詳細「開始残量」）
- 実コードでデルタを確認: 比較行 = `始動残量`（`ja.json:169-170`）、詳細メタデータ = `開始残量`（`comboDetail.metadata.driveGauge`=`ドライブゲージ開始残量`、`ja.json:94-95`）。
- 完了報告 §9.3 で「意図的な暫定状態」「M16-06 表記 rollout（FB⑨⑬）で統一」と明示済み。§9.4 伝達メモで CHANGE-061 見込みとして申し送りあり。**許容できる暫定**と判断。恒久放置を避けるため M16-06 での回収が前提。◎ではなく○（暫定デルタの残存という一点のみ）。

### ◎ コーディング規約・禁則表現・簡体字
- 追加 locale 値・コメントは日本語標準漢字のみ（簡体字なし）。禁則表現（「適切に」「必要に応じて」等）の新規混入なし。`console.log` 等の残置なし。`labelKey` は定数キー参照で i18n 経由、リテラル散在なし。◎。

---

## 設計準拠性以外の指摘事項

1. **（低）en ラベルの語法が始動/消費で非対称**: 始動 = `Drive gauge (start)` / `SA gauge (start)`（括弧補足）に対し、消費 = `Drive gauge consumed` / `SA gauge consumed`（形容詞）。判別は明確で機能上の問題はないが、将来の英語表記統一（M16-06 rollout 相当）時に `(start)` / `(consumed)` へ揃えるか検討の余地。該当: `web/src/locales/en.json:169-172`。
2. **（低・情報）ゲージ 4 行の並びは drive→SA→drive→SA**: 完了報告 §9.1 の宣言（drive 始動 / SA 始動 / drive 消費 / SA 消費）どおりで、始動ブロック・消費ブロックとも drive→SA で一貫。旧コードは消費が SA→drive 順だったため実質順序反転しているが、始動と揃えた意図的整合であり問題なし。該当: `web/src/features/combo/components/CompareTable.tsx:207-236`。

---

## 推奨修正（優先度別）

- **高（完了前に修正必須）**: なし。
- **中**: なし。
- **低**:
  - en 始動/消費ラベルの語法統一を M16-06 表記 rollout の対象に含める（上記指摘 1、`en.json:169-172`）。
  - 「比較=始動残量 / 詳細=開始残量」の表記デルタを M16-06 で必ず回収（§9.3 申し送りの実行を担保。放置回避）。

---

## 良かった点

- スキーマ・DTO・repository・VAL を一切触らず、既存フィールドの表示追加＋消費行の移設という最小差分で非対称を解消。スコープ規律（MEMORY: スコープ厳守）に忠実。
- formatter の流用が各フィールドの型（int / REAL・0.5）に正しく対応し、NULL→`-` の既存挙動を素直に継承。新規 formatter を作らず一貫性を維持。
- テストが「4 ラベル表示」「始動/消費の判別」「値並び」「NULL=`-`」を分離して検証し、friend FB #11 の主眼（判別可能性）を明示的にカバー。
- 表記デルタを完了報告 §9.3/§9.4 で意図的暫定＋申し送り先（M16-06 / CHANGE-061）まで明記しており、後工程への引き継ぎが明瞭。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実機・動作確認（比較画面の実描画、レイアウト崩れ、長ラベルの折返し等）は別途。
- `tsc --noEmit`（exit 0）と `CompareTable.test.tsx`（11 テスト通過）はレビュー時に実行確認済み。FE 全 656 テストの再実行は本レビューでは未実施（完了報告 §9.2 の申告に依拠）。

---

## 取り込み結果（自動トリアージ）

`implement_plan_full` Phase C により、製造担当（Opus 4.8）が自動でトリアージ・取り込みを実施（2026-07-05）。判定は**合格（高・中ゼロ）**。低 2 件はいずれもレビュアー自身が「M16-06 表記 rollout の対象に含める」ことを推奨しており、開発者指定（「始動」明示の正典ラベル最終形は M16-06 で確定）と整合するため**据置（M16-06 へ申し送り）**とする。

| # | 指摘（優先度） | 採否 | 理由 |
|---|----------------|------|------|
| 1 | **低**: en 始動/消費ラベルの語法非対称（`(start)` vs `consumed`・`en.json:169-172`） | 据置（M16-06 申し送り） | 機能上問題なし。ラベル正典化は開発者指定で **M16-06 表記 rollout の担当**。今 en 消費側（本体で受理済み）を触るとスコープ逸脱。完了報告 §9.4 の M16-06 連携行に語法統一を追記して回収担保。 |
| 2 | **低**: 「比較=始動残量 / 詳細=開始残量」表記デルタの M16-06 回収担保 | 据置（申し送り済み・担保強化） | 完了報告 §9.3/§9.4 で意図的暫定＋ M16-06 統一として申し送り済み。放置回避のため §9.4 M16-06 行を明示化。 |

**高・中の指摘なし＝追加のコード修正なし**。低 2 件は M16-06 表記 rollout（FB⑨⑬）へ集約して回収する。
