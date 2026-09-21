# M12-01 レビュー報告書

レビュー担当: 独立レビュアー(Opus 4.8)/ 2026-06-22
基準コミット: `25e1c9b` → HEAD(`b3613cd`, feature/m12-01)
対象: 指示書 M12-01(表記・文言 + ソート/フィルタ UX + 戻り時のフィルタ保持、15 項目)
判定根拠: 実コード(`git diff 25e1c9b..HEAD -- web/`)/ DES-005 §5.4-5.5 / DES-004 §4 / SUPP-001 §3.3.1 / レビューチェックリスト §1-§9

## 総評

15 項目すべてが実装され、§9 の重大判定基準(C-18 でのソート/フィルタ除去、起き攻め表示・ラベル変更、en.json 変更、起き攻め DR の変更、恒久ブラウザストレージ化、BE 逸脱)に**該当する違反はゼロ**。着手前確認の分岐判断(C-18 の opponent_stance がソートに不在=方針転換どおり温存+控えめ表示、C-19 の position/hit_type が既存=追加不要、C-22 の link=目押しが SUPP-001 §3.3.1 既定義)はいずれも実コードで裏取りでき、製造担当の報告と一致した。BE 変更は 0 件で `web/` のみ。テスト(C-23/C-05/C-02/C-01/N-30 等)も追加されている。完了承認を妨げる問題は見当たらない。軽微な持ち越し候補が数点あるのみ。

## 設計準拠性レビュー結果

### §1 着手前確認の実施(最重要)

- §1.1 ソート/フィルタ/表示項目の対応表 … **◎**
  - 実ソート項目 = `["default","updated_at","damage","starter_move_id"]`(`web/src/constants/combo-list.ts:1-6`)。DES-005 §5.4 L199(始動状況/更新日時/ダメージ/starter_move_id)と 1:1 一致。
  - **C-18 分岐**: `opponent_stance` は SORT_FIELD_VALUES に**存在しない**(同 :1-6)。一方フィルタには温存(`OPPONENT_STANCE_VALUES` :42-48、`useComboListFilters` の `opponentStance` :82/:99-100)。方針転換どおり「ソートから除去せず・フィルタ温存」を満たす。**◎**
  - **C-19 分岐**: `formatStarterStatus`(`web/src/features/combo/utils.ts:47-59`)が既に始動技 + hit_type + position を表示(CHANGE-002)。よって追加不要=製造判断は妥当。**◎**(※「ソート確認用の強調」までは行っていないが、指示書 §3.4.2 は「既存なら強調/明示」を許容範囲としており充足判断は妥当)
  - **C-17**: ソート UI を `ComboSortControls.tsx`(新規)へ部品化し、一覧(`ComboListFilters.tsx:245-251`)とマイコンボ(`MyComboPage.tsx:810-816`)が共通利用。DES-005 §5.5 L253「同様」に整合。**◎**

- §1.2 i18n キー特定 … **◎**
  - C-06「DR」全箇所: 非起き攻めの DR は `labels.ts:90-91` の `MODIFIER_NON_MOVE_TYPES` 2 件(パリィからの/通常技キャンセル)のみ→「ドライブラッシュ」化。起き攻め系(`OKI_FIELDS` の "+ DR" `labels.ts:109,111`、`compare.oki.drNone/drYes` `ja.json:167-168` / `CompareTable.tsx:139-143`)は**未変更**。R-1=M12-03 委譲の線引きが正確。
  - C-22「link」: SUPP-001 §3.3.1 L313 が `link`=「目押し」と既定義。`MODIFIER_FLAGS`(`labels.ts:81`)を設計定義へ整合させたもので、純 UI 改変ではなく既定義への追従。**CHANGE 不要との製造主張は妥当**。なお DES-004 §4 L211 の「リンク」は連結子(コネクタ)の説明文であり modifiers.flags とは別概念のため対象外で正しい。

### §2 表記・文言

- C-16 「タグを選択、または、新規登録」 … **◎**(`TagSelector.tsx:81`、テスト `TagSelector.test.tsx:46`)
- C-20 内部値の露出除去 … **◎**(`ComboEditorBasicFields.tsx:67` 「始動技(starter_move_id)」→「始動技」)
- C-21 「(0〜6本)」 … **◎**(`ComboEditorBasicFields.tsx:208`。ja のみ、ハードコード日本語ラベル。SA ゲージ(0〜3)は対象外で不変=正しい)
- C-22 「目押し」 … **◎**(`labels.ts:81`、テスト `ModifiersEditor.test.tsx:65`)。残存「リンク」表示は 0 件(grep 確認)
- en.json 不変 … **◎**(`git diff 25e1c9b..HEAD -- web/src/locales/en.json` = 空)

### §3 ソート/フィルタ UX

- C-02 既定ソート=更新日時(降順) … **◎**(`combo-list.ts:13-14` `DEFAULT_SORT_FIELD/ORDER`、`useComboListFilters.ts:84`、`MyComboPage.tsx:70` 両画面)。BE は `updated_at` を既存ホワイトリストに持つため BE 変更なし。
- C-05 リセットボタン露出 … **◎**(`ComboListFilters.tsx:255-262`、`disabled={!hasActiveFilters}` 連動、`ComboListPage.tsx:186-187`。テスト `ComboListFilters.test.tsx:127-145`)
- C-07 マイコンボ件数の紛らわしさ解消 … **◎**(`CharacterInfoBar.tsx` のステータス別 3 件内訳を廃し合計件数 `comboList.registeredCount` 表示へ。タブ側の counts と役割分離。テスト更新済 `CharacterInfoBar.test.tsx`)
- C-18 相手スタンスの一覧控えめ表示 … **◎**(`ComboTableRow.tsx:98-104`。`opponentStance && !== "any"` 条件で「不問/未設定」を非表示、`text-xs text-slate-400` の淡色。§9.2 の控えめ表示の製造判断が完了報告に明記されており妥当)
- C-19 position/hit_type の一覧表示 … **◎**(既存 `formatStarterStatus` で識別可能、上述)
- C-23 列メニュー連続トグル … **◎**(`ColumnVisibilityMenu.tsx:55` `onSelect={(e)=>e.preventDefault()}` で Radix の選択時クローズを抑止。テスト `ColumnVisibilityMenu.test.tsx:26-41`)
- C-24 タグ表示崩れ解消 … **○**(`ComboListFilters.tsx:208/213/218/227` で `max-w-md` / `max-h-24 overflow-y-auto` / バッジ `max-w-[12rem]` + `truncate`。妥当な対処。視覚的最終確認は実機 §制約)

### §4 戻り時の保持(C-01 + N-30)

- フィルタ(キャラ含む)/ソート/仮登録トグルの保持 … **◎**
  - URL クエリ全体を sessionStorage(`combo-list-filters-v1`)にミラー(`useComboListFilters.ts:71-73`)、空 URL での再マウント時に復元(:59-68)。キャラ(character_id)・仮登録(is_draft)を含む全クエリが対象。
  - N-30(編集/登録から戻る)は URL クエリ保持に包含。
  - 保持手段は **sessionStorage(in-app セッション内)**で恒久 localStorage 化していない(`createSessionStorageHelper` 新設 `browser-storage.ts:11-15`)。**恒久化スコープ逸脱なし**。CLAUDE.md §10.X のキー命名(`-v1` suffix)・専用ヘルパ経由・try-catch・JSON シリアライズの各ガイドラインを遵守。
  - テスト: `useComboListFilters.test.tsx:485-505`(round-trip 復元)、`browser-storage.test.ts:65-94`(session/local 分離)。

### §5 設計意図との整合

- C-18 方針転換どおり … **◎** / C-06 起き攻め以外限定 … **◎** / 控えめ表示の視覚表現が既存スタイル(淡色小サイズ)に整合 … **◎**

## 設計準拠性以外の指摘事項

### §6 コード品質・規約
- camelCase / 命名規約 … **◎**。新規 `ComboSortControls` は Props 命名・import 順とも規約準拠。
- 部品化が過剰抽象でないか … **◎**。ソート UI(項目 select + 昇降 select、default 時昇降非表示)を 1 コンポーネントに集約しただけで、個人開発の規模感として適切。重複の解消にちょうど寄与している。
- console.log/warn 追加 … **なし**(diff で確認)。`browser-storage.ts` の `console.warn` は既存ヘルパ由来で共通化に伴い保持されたもの、新規追加ではない。

### §7 既存挙動の温存(非破壊性)
- 起き攻め表示(詳細/比較/編集)… **不変**(`OKI_FIELDS`・`compare.oki.*` 未変更)。**◎**
- 列表示のブラウザストレージ保持(L200)・展開状態のセッション保持(L224)… 当該ファイル(`useColumnVisibility` / 展開状態 hook)に変更なし。**◎**
- BE … `internal/` への変更 0 件。`GET /api/combos` の sort 実装に追従不要(updated_at は既存)。§2.4 最小範囲すら使わず=最良。**◎**

### §8 ドキュメント
- CHANGE 要否の列挙は完了報告側の責務(製造担当が DES 本体を直接編集していないことは確認済=`docs/design/` に diff なし)。設計担当が C-02/C-18/C-19/C-01(DES-005 §5.4/§5.5 改訂)を起票する前提で問題なし。**◎**

## 推奨修正(優先度別)

- 高(M12 完了前に修正必須): **なし**

- 中(M12 後続と並行可):
  - (なし。下記低を参照)

- 低(将来対応):
  1. **マイコンボ `setSort` の order 保持挙動の微差**(`MyComboPage.tsx:100-116`): 非 default フィールドへ切替時に既存 `order` パラメータをそのまま残す。一方コンボ一覧 `updateFilters`(`useComboListFilters.ts:103-105`)も order を維持するため挙動は概ね一致するが、`ComboSortControls` で部品化した割にソート state 管理(URL 反映ロジック)は 2 画面に重複が残っている。挙動上の不具合はないため低。将来 hook 側へ寄せると一層の整合に。
  2. **`aria-label="is_aerial" / "combo_scaling" / "notes_tool"`**(`MoveEditGrid.tsx:256/303/311`): 内部値が aria-label に露出。技編集画面は M12-01 スコープ外かつ非可視テキストのため本指示書では不問だが、C-20 の趣旨(内部値を出さない)からは将来の掃除候補。
  3. **C-19 の「ソート中キーの強調」**: position/hit_type は表示済みだが、現在のソートキーを視覚強調するところまでは実装されていない。指示書許容範囲内だが、ソート確認 UX をさらに高めるなら将来検討。

## 良かった点

- 着手前確認の分岐(C-18/C-19/C-22)をいずれも実コード・設計書で裏取りし、「あるはず」で進めず方針転換を正確に反映できている(retrospective-digest §1 パターン A の回避が徹底)。
- スコープの線引きが厳格。起き攻め DR(OKI_FIELDS / compare.oki)と非起き攻め DR(MODIFIER_NON_MOVE_TYPES)を正確に切り分け、M12-03 への委譲境界を侵していない。
- C-22 を「純 UI 改変」ではなく SUPP-001 §3.3.1 の既定義への整合と判断し CHANGE 不要を正しく結論。
- sessionStorage 化が CLAUDE.md §10.X(専用ヘルパ・-v1 suffix・try-catch・JSON)に完全準拠。恒久化との線引きも守られている。
- 変更ごとにテストを追加・更新(C-23/C-05/C-02/C-01/N-30/C-07/C-22)。
- BE 無変更を達成し、リスク面を最小化。

## 制約事項

- 本レビューはコード上で静的に判定可能な範囲のみ。実機での目視確認(C-24 のタグ崩れ・C-18 控えめ表示の見栄え・C-23 の連続トグル体感)、パフォーマンス、E2E シナリオ A〜G の実走は別途。
- 自己テスト結果(tsc 0 / vitest 523 passed / lint 0)は製造担当報告を前提とし、本レビューでは再実行していない。

---

## 取り込み結果(自動トリアージ)

製造担当(implement_plan_full Phase C)による自動トリアージ。採否と理由を事後監査用に記録する。

- **高 の指摘**: ゼロ(本報告書に高はなし)。→ エスカレーション不要。
- **中 の指摘**: ゼロ。
- **低 の指摘 3 件**: いずれも下記理由により**不採用(将来対応へ送り)**。コード変更なし。

| # | 指摘(低) | 採否 | 理由 |
|---|----------|------|------|
| 1 | マイコンボ `setSort` の URL 反映ロジックが 2 画面に重複(`MyComboPage.tsx` vs `useComboListFilters.ts`) | 不採用(将来) | 挙動は一致し、C-17 の目的(ユーザー視点のソート不一致解消)は共通部品 `ComboSortControls` + 共通既定定数 `DEFAULT_SORT_FIELD/ORDER` で達成済み。state 反映ロジックの hook 化は CLAUDE.md §6「過剰な抽象化を避ける(個人開発の規模感)」に照らし、後続で横断的に整理する方が適切と判断。 |
| 2 | `MoveEditGrid.tsx` の aria-label に内部値露出(is_aerial 等) | 不採用(スコープ外) | 技編集画面は M12-01 スコープ外(指示書 §2.3/§9.2)。非可視テキストで C-20 の「画面表示」趣旨に非該当。スコープ厳守のため便乗修正せず、将来の掃除候補として記録。 |
| 3 | C-19 のソート中キー強調が未実装 | 不採用(充足済) | position/hit_type は `formatStarterStatus` で表示済み。開発者 Q1 回答で「position/hit_type は既存表示のまま」を明示承認。§3.4.2 の「強調/明示」は例示(任意)で end-state は充足。 |

トリアージ実施: 2026-06-22 / implement_plan_full(自動)
