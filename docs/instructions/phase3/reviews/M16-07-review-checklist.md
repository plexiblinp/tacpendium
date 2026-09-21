# M16-07 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M16-07-custom-states-stock.md` v1.0.0（int custom_states の始動最低/終了 2 値化＋増減・FB⑬ 深掘り） |
| 対象指示書ID | M16-07 |
| レビューモデル | Sonnet 4.6（model-allocation v1.29.0。実使用は開発者判断） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-08 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-08 | 初版（指示書 v1.0.0 と対）。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: 指示書 v1.0.0、M16-overview v1.2.6 §4.9、architecture-patterns §9.1（custom_states・B-1）、DES-003 §3.2/§3.4、DES-005 §5.6/§5.7/§5.8/§5.13、code-facts（`Combo.Situation`・`ComboEditorBasicFields`・`customStates.ts`・`CustomStateDef`・seed 000015）、M16-02（drive/SA 先例）、M16-06（en 境界）、retrospective-digest §4/§7。
- **Plan Mode 着手前確認結果の確認（必須・playbook §8.4.4）**: 指示書 §3.4 の **9 項目すべて**（1 situation read/write / 2 show_delta def 技法 / 3 ラベル SSOT・i18n 境界 / 4 増減 calc / 5 editor 1→2 / 6 display surfaces / 7 移行 / 8 dup/recipe/BE 非波及 / 9 5 キャラ def 実査）に Plan Mode 質問書＋開発者回答が残っているか。未確認のまま実装した項目があればその時点で重大（§9）。

### 0.2 レビューの基本姿勢

- **承認ゲート（データモデル判断・着手前承認）**: def・値表現の変更着手前に開発者承認の証跡があるか。
- **本サブの肝＝「situation は opaque・スキーマ/DTO/BE 不変・dup/recipe 非波及」**。この非波及がコードとテストで裏取りされているか。
- **消費セマンティクスの一般構築をしていない**（B-1 据え置き＝表示用 2 値＋派生増減のみ）ことを確認。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。

---

## 1. 設計書本体・上位文書との照合（最重要）

### 1.1 situation 値の 2 値化（指示書 §4.1・§3.4-1）

- [ ] int state 値が `{"<code>": {"start_min": n, "end": m}}` 構造化で situation.custom_states に格納されるか。**スキーマ/DTO/BE が不変**（`situation *string` 素通し・DDL/DTO 変更なし）か。
- [ ] 旧スカラ `{"<code>": n}` の graceful 読取り（移行）が壊れていないか。

### 1.2 DEF `show_delta`（指示書 §4.2・§3.4-2）

- [ ] `characters.custom_states` の Ingrid `sun_crest` def に `show_delta: true`、他 4 キャラ（seed 済みなら）false が付与されているか。既存マイグレを編集せず新規マイグレ 000023 or seed で追加しているか。DES-003 §3.2 拡張の CHANGE-067 見込みが伝達メモにあるか。

### 1.3 ラベル生成（指示書 §4.3・§3.4-3）

- [ ] ①②③ ラベルが name_ja/en＋固定句で SSOT 生成されているか（総称「ストック」・仮）。en は i18n サーフェス（詳細/比較）のみ・エクスポート/入力欄は ja（M16-06 境界）か。

### 1.4 ③増減（指示書 §4.4）

- [ ] ③＝②−①（符号付き）で、**`show_delta=true` の state のみ表示**（Ingrid=表示／他=非表示）か。入力でなく派生表示か。

### 1.5 editor / display（指示書 §4.5/§4.6）

- [ ] editor で int state が①②の 2 欄（min/max 尊重・整数・既存方式）＋`show_delta` 時③calc 表示か。flag 型は不変か。
- [ ] 詳細/比較/エクスポートで①②（③）が明示ラベル表示か（現状 1 項目からの拡張）。

### 1.6 DES 直接編集の禁止

- [ ] def・表示の変更を製造担当が DES に直接書いていないか（設計担当が CHANGE-067 起票）。

---

## 2. 非波及・非破壊（本サブの肝）

- [ ] **situation が `DuplicateKey`（6 フィールド）・`recipe_hash`（steps）・recipe_cache・BE 検証に非対象**で、本変更が波及しないことがコード/テストで裏取りされているか。
- [ ] スキーマ/DTO/BE/CSV が不変か（situation opaque・素通し）。
- [ ] 消費セマンティクスの一般構築（逐次減少・技可用性・バリデーション連動）をしていないか（B-1 据え置き）。

## 3. スコープの限定

- [ ] **Ingrid（唯一の testable）が実装**され、**他 4 キャラは def フラグのみ**（実データ E2E は M14-03b 連動で後回し）か。flag 型・drive/SA（M16-02）は不変か。

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 FE（Vitest / tsc）

- [ ] situation 構造化往復・旧スカラ graceful 読取り。①② editor→situation。`show_delta` 分岐（Ingrid=③表示／他=非表示）。ラベル ja/en 境界。詳細/比較/エクスポート表示。
- [ ] dup 非回帰（situation 変更が DuplicateKey/recipe_hash 非波及）。

### 4.2 Ingrid E2E

- [ ] Ingrid で①②入力→保存→詳細/比較/エクスポートに①②③・移行 graceful。

## 5. 設計意図との整合（精神の確認）

- [ ] **「意味の明示」**: 1 項目（何か不明）→①②③の明示ラベルで意味が分かる。
- [ ] **「スキーマ据え置き・FE 整形」**: situation opaque を活かし DDL/DTO/BE 不変で 2 値化。
- [ ] **「表示用 2 値に限定」**: 消費セマンティクス一般構築をせず（B-1 据え置き）、始動最低/終了/増減の表示に留めた。
- [ ] **「Ingrid 実装＋4 キャラ後回し」**: testable な Ingrid で実装、他はフラグのみで M14-03b 連動。

## 6. コード品質・規約遵守

- [ ] 曖昧語依存でない。`console.log` 残置なし。簡体字・「DR」略記なし。
- [ ] situation/custom_states の全 read/write・ラベル全箇所 grep（SSOT）が完了報告にあるか。

## 7. 既存挙動の温存（非破壊性）

- [ ] flag 型 custom_states・drive/SA ゲージ・重複判定・recipe_cache・M13 CSV が不変か。
- [ ] 既存 custom_states を持つコンボ（旧スカラ）が移行後も破綻しないか。

## 8. ドキュメント・進捗ログ

- [ ] 完了報告に Plan Mode 確定方式（9 項目）・show_delta 追加技法（000023 or seed）・5 キャラ def 実査・他 4 キャラ E2E 後回し・dup/recipe/BE 非波及が含まれるか。
- [ ] DES-003 §3.2・DES-005 §5.6/§5.7/§5.8/§5.13・DES-006 の CHANGE-067 見込みを設計担当への伝達メモで申し送っているか。

## 9. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 9 項目（§3.4）のいずれかが未確認のまま実装されている（推測実装）。
- **承認ゲート（データモデル判断）の着手前承認を経ずに def/値表現を変更している**。
- **situation を `DuplicateKey`/`recipe_hash`/recipe_cache/BE 検証に波及させた**（非対象前提に反する）、または**スキーマ/DTO/BE を変更した**（situation opaque 前提に反する）。
- **旧スカラの移行で既存 custom_states データを破壊した**（graceful でない）。
- **消費セマンティクスの一般構築をした**（B-1 据え置きに反する）。
- **③増減を `show_delta=false` の state で表示した**、または `show_delta` フラグを無視した。
- **他 4 キャラの E2E をスコープに入れて実装をブロックした**（def フラグのみのはず）／既存マイグレ改変。
- 「DR」略記を画面に使った。製造担当が DES 本体を直接編集。

## 10. 軽微な問題の判定基準（持ち越し許容）

- 仮ラベルの固定句の文言（開発者が後で修正指示・出力を見て調整）。
- ①②の editor レイアウト・③の表示位置細部。
- ラベル SSOT の集約先ファイル細部（既存規約に沿えば）。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / DES-003（実パス）§3.2 / DES-005 §Y / code-facts に対し実装が Z。意図確認したい」の形で根拠節を併記。situation が dup/recipe に関与する疑い・5 キャラ def が想定と異なる場合は状況を明記して照会。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ（**特に situation 非波及・スキーマ/DTO/BE 不変・移行 graceful・show_delta 分岐・消費非構築・Ingrid 実装/4 キャラ後回し**）、§0.1 の Plan Mode 着手前確認（9 項目）が揃っている。§10 軽微は持ち越し可。

---

*以上、M16-07 レビューチェックリスト v1.0.0。配置 `docs/instructions/phase3/reviews/M16-07-review-checklist.md`。指示書 v1.0.0 と対。**situation opaque（スキーマ/DTO/BE 不変・dup/recipe 非波及）・2 値化と show_delta 増減・移行 graceful・消費セマンティクス非構築（B-1 据え置き）・Ingrid 実装＋4 キャラ def フラグのみ（E2E は M14-03b 連動）**を最重要ゲートとする。着手前承認（データモデル判断）を確認すること。*
