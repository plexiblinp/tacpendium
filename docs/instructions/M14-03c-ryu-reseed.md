# 指示書 M14-03c: ryu 正規再 seed（moves 差し替え＋combos クリア）

| 項目 | 内容 |
|------|------|
| 指示書ID | M14-03c |
| バージョン | 1.0.2 |
| 推奨モデル | **Opus 4.8（Plan Mode 必須）**（破壊的 DELETE＋再 seed・combos クリア・既存ユーザ影響の判断） |
| Plan Mode | **必須**（§3.3 の項目を実コード確認のうえ計画提示） |
| 機械レビュー | 必須（別チェックリスト: `M14-03c-review-checklist.md`） |
| 並列性 | **直列（M14-03b 後）**。M14-03b の変換インフラ（§4.1）を再利用するため後続。**本サブは直列運用で走る**（開発者決定 2026-07-16＝worktree 並列を用いない）＝**M17-01 とのマイグレ連番の先着調整は不要**（§2.1） |
| 依存 | **M14-03b 完了**（変換インフラ・移動 system move 全キャラ seed）＝**充足済み**（製造完了・レビュー重大ゼロ・2026-07-15）。**ryu の手入力 CSV 受領＝充足済み**（開発者確認 2026-07-16） |
| 想定所要時間 | 120〜180 分（Plan Mode 込み） |
| 作成者・作成日 | 設計担当 Claude（M14-03b/M17 期）/ 2026-07-09 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.2 | 2026-07-16 | **Plan Mode 回答の反映**（製造の問い＝「seedgen は 000026 固定・`FirstWaveOrder` に ryu 非含有のため無改変では ryu の seed SQL を生成できない」）。**§4.3.1 を新設＝seedgen の追加的拡張を条件付きで許容**（I/O 境界のみ・変換規則は無改変・既存出力の byte-identical を golden＋`-check` で回帰ゲート化・ryu ハードコードでなく対象キャラのパラメータ化）。§2.2/§2.3 の「改変しない」の粒度を**変換規則 vs I/O 境界**に切り分けて明確化（v1.0.1 以前の記述が両者を区別しておらず、製造が Plan Mode で正しく停止した）。§5.1/§7 に回帰ゲートを追加。**設計変更ではなく粒度の明確化**（CHANGE 不要＝seedgen はランタイム非経路）。 |
| 1.0.1 | 2026-07-16 | 着手前の状態同期（内容の設計変更なし）。(1) **マイグレ連番を 000029 に確定**（M14-03b が 000024〜000028 を消費・直列運用のため先着調整は不要）、(2) **§11 確認事項 2 件を回答済みへ反映**（ryu CSV 受領済み・combos クリアは承認済み＝友人影響なし）、(3) §1.4 前提に **友人影響なし**（開発者確認 2026-07-16）を明記＝破壊的 DELETE の影響範囲を指示書側で確定（教訓 D-1 の再発防止）。 |
| 1.0.0 | 2026-07-09 | 初版。RESEARCH-02〔F-1〕で ryu 既存 seed（000004・仮・独自 code 体系）が手入力 CSV と共通 15/67 件のみと判明。開発者確定（C・2026-07-09）: ryu を手入力 CSV 由来へ差し替え・既存 ryu コンボは消えてよい（moves 差し替え＋combos クリア）。M14-03b から分離。 |

---

## 1. 背景と目的

### 1.1 背景

現行 ryu の moves seed（`000004_seed_moves_ryu`）は**仮データ**（開発者回答 F-1・2026-07-09）で、move_code の体系が手入力 CSV（moves-input-tool 出力）と異なる（RESEARCH-02〔F-1〕: 共通 15/67 件のみ。例 seed `crouch_light_punch` ⇔ CSV `crouching_light_punch`、seed `forward_throw` ⇔ CSV `throw_forward`）。配布 DB を手入力 CSV 由来で一貫させるには、ryu だけ旧体系のまま残すわけにいかない。

開発者確定（C・2026-07-09）: **ryu の moves を手入力 CSV 由来へ差し替える。既存 ryu コンボは消えてよい**（moves 差し替え＋ryu の combos をクリア）。これにより move_code 変更に伴う combo_steps.move_id 参照の整合を気にせず（参照元コンボを消すため）clean に差し替えられる。

### 1.2 目的

- ryu の**旧 moves（000004 由来の仮 seed）を削除**し、**手入力 CSV 由来の ryu moves を新規 seed** する。
- ryu の **combos および従属行（combo_steps / combo_setups / combo_oki_options / combo_tags）をクリア**（削除）する。
- 移動 system move＋alias は M14-03b の (a) で全キャラ静的 seed 済み＝**本サブで ryu 移動 move を再投入しない**（重複回避）。
- clean マイグレ由来 DB で構築する（消える実コンボは dev DB のみ＝配布 DB に ryu の実コンボ seed は無い）。

### 1.3 このサブで作らないもの（スコープ外）

- 変換インフラ本体（M14-03b §4.1 を再利用）。
- 他キャラの seed（M14-03b／第二波）。
- 移動 system move の再投入（M14-03b (a) で投入済み）。
- ryu コンボの保全・移行（**消してよい**＝移行しない）。
- スキーマ変更（データ差し替えのみ）。

### 1.4 前提

- M14-03b 完了（変換インフラ・移動 system move 全キャラ seed・索引器 IF）＝**充足済み**（2026-07-15 製造完了・レビュー重大ゼロ・マイグレ 000024〜000028）。
- ryu の手入力 CSV 受領＝**充足済み**（開発者確認 2026-07-16。moves-input-tool 出力・**20 列**＝19＋`is_derived`）。
- **【重要】友人影響なし**（開発者確認 2026-07-16）: **友人は ryu を記録していない**（ryu/ken のコンボデータは dev DB にのみ存在）＝**ryu の combos クリアは設計どおり実行してよい**。※本サブは破壊的 DELETE を含むため、影響範囲を指示書側で確定させておく（先行リリース済み＝実ユーザーの手元でもマイグレが走る）。
- **マイグレ連番＝000029 起点**（§2.1・§3.2）。

---

## 2. 成果物

### 2.1 作成/修正するファイル

| ファイル | 内容 |
|---|---|
| マイグレ **000029〜**（M14-03b が 000024〜000028 を消費＝**次は 000029**。**直列運用のため先着調整は不要**。分割数は Plan Mode で確定＝§9.2） | (1) ryu の combos 従属行クリア（combo_tags→combo_oki_options→combo_setups→combo_steps→combos の FK 逆順）、(2) ryu の旧 moves 削除、(3) ryu の手入力 CSV 由来 moves を新規 seed＋alias。down 整合 |
| テスト fixture | ryu 件数前提の既存テストを新 seed へ追従（`dbtest.Setup` 波及） |

### 2.2 変更しないもの

- スキーマ（データ差し替えのみ）。
- 既存マイグレ 000001〜（M14-03b の seed マイグレ含む）を非改変＝新規連番で追加。
- 移動 system move（M14-03b で投入済み・ryu 分も既存）。
- 他キャラの seed・combos。
- **変換規則そのもの**（remap の変換ロジック・正準形検証・alias 対・recovery 単一値・`is_derived`／`target_combo` passthrough・移動 9 種 drop・dup スキャン）＝**1 行も変えない**。索引器（`internal/moveindex`）＝**改変しない**。
  - ※ **seedgen の I/O 境界**（対象キャラの選択・出力先ファイル名/ヘッダ文字列）の**追加的拡張は §4.3.1 で許容**する。「改変しない」の対象は**変換規則**であって CLI の入出力ではない。

### 2.3 例外条項

- **破壊的 DELETE を許容**（ryu の旧 moves・combos）。これが本サブの主目的。ただし**対象は ryu の character_id に限定**（他キャラに波及しないことを WHERE で厳密化）。
- **seedgen の追加的拡張を許容**（§4.3.1・条件付き）。**変換規則の改変・コピー実装・手作業生成は不可**。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- **M14-03b 指示書 v2.3.0**（変換インフラ §4.1・索引器 §4.8・移動 seed §4.2）。
- **M14-RESEARCH-02-report** §F-1（ryu code 体系相違）・§C-3（テリー CSV 構造＝ryu CSV も同構造の想定）。
- **DES-003** §3.3（moves）・§3.9（preset_aliases）・combos と従属テーブルの FK 関係。
- **code-facts** §8（Combo/Move model）・§9（repository）・§10（000004 の DDL・combos 従属テーブルの FK）。
- **retrospective-digest** §5（FK=OFF×明示 DELETE 非同居・破壊的マイグレ）。
- **followup-backlog** §C（clean DB 制約）。

### 3.2 前提事実（実ファイルで確認・Plan Mode で再確認）

- ryu の旧 moves は `000004_seed_moves_ryu`（56 技＝50＋rush 6）。
- ryu の combos 従属テーブル: combos / combo_steps / combo_setups / combo_oki_options / combo_tags（FK 関係は code-facts §10 で確認）。
- 移動 system move（9 種）は M14-03b (a) で全キャラ投入済み＝ryu も投入済み＝**本サブで触らない**。
- clean マイグレ DB では ryu の実コンボは存在しない（dev DB のみ 78/79/80 等）。**友人は ryu を記録していない**＝既存ユーザ DB でも実害なし（開発者確認 2026-07-16・§1.4）。
- **マイグレは 000028 まで消費済み＝本サブは 000029 起点**（M14-03b が 000024〜000028）。**直列運用**（開発者決定 2026-07-16）のため **M17-01 との連番先着調整は不要**。
- 手入力 CSV は **20 列**（19＋`is_derived`。M14-03b 実査で確認）。`move_code` は **input-tool の自前採番**（importer CSV の code を prefill で引き継ぐ経路は存在しない＝開発者確認 2026-07-16）＝**CSV の値が正・再採番しない**。

### 3.3 着手前の確認（Plan Mode 必須）

1. **削除対象の FK 依存順**: ryu の combos 従属行を FK 逆順（combo_tags→combo_oki_options→combo_setups→combo_steps→combos）で削除する順序を実 DDL で確定。FK=OFF に頼らず明示順で消す（FK=OFF と明示 DELETE を同居させない＝digest §5）。
2. **旧 moves 削除の波及**: ryu 旧 moves を参照する行（combo_steps.move_id・preset_aliases.move_id・rush_variant の original_move_id）を洗い出し、combos クリア後に moves を消す順序（moves を参照する combo_steps が先に消える）を確定。preset_aliases（移動 move の alias は M14-03b・ryu 旧 moves の alias は旧 moves と一緒に消す）の扱い。
3. **移動 move の非重複**: M14-03b で投入済みの ryu 移動 system move（9 種）を**再投入しない**こと。手入力 CSV に移動 9 種が含まれても drop（M14-03b §4.1 と同じ）。
4. **新 seed の適用**: M14-03b の変換インフラ（§4.1）で ryu 手入力 CSV → seed SQL 生成。move_code はツール採番値（再採番しない）。alias 対・recovery 単一値・is_derived・target_combo passthrough は M14-03b と同一規則。
5. **dbtest 波及**: ryu 件数前提の既存テスト（56 技前提等）を新 seed の技数へ追従。`dbtest.Setup` 全テスト通過。
6. **down 整合**: down で新 seed を消し、旧状態（000004 の仮 moods・空 combos）へ戻せるか。ただし**消した dev DB の実コンボは down で復元不能**（開発者了解済み＝消してよい）。down の限界を明記。

---

## 4. 詳細仕様

### 4.1 ryu combos クリア

- ryu（character_id 限定）の combos 従属行を FK 逆順で削除:
  combo_tags → combo_oki_options → combo_setups → combo_steps → combos。
- **WHERE を ryu の character_id に厳密化**（他キャラ非波及）。combo_setups/combo_steps は combos 経由で ryu 分を特定（サブクエリ or JOIN）。
- FK=OFF を使わず明示順で削除（digest §5）。

### 4.2 ryu 旧 moves 削除

- combos クリア後（combo_steps が消えた後）に ryu の旧 moves（000004 由来）を削除。
- **移動 system move（9 種）は M14-03b 投入分＝削除対象外**（WHERE で category=system の移動 9 種を除外、または「000004 由来の旧 code のみ」を対象に）。**Plan Mode で「どの行が旧 moves か」を code 体系で厳密特定**（移動 move・drive_parry を巻き込まない）。
- ryu 旧 moves に紐づく preset_aliases も削除（移動 move の alias は残す）。

### 4.3 ryu 新 moves seed

- M14-03b の変換インフラで ryu 手入力 CSV → seed SQL。move_code はツール採番値の正準形検証（再採番しない）。
- alias（official_ja_move）対・recovery 単一値・`is_derived`・target_combo passthrough・移動 9 種 drop は M14-03b と同一規則。
- FK 依存順（moves→preset_aliases）。dup スキャン（M14-03b §4.6）を ryu 新 moves にも適用。

### 4.3.1 seedgen の追加的拡張（許容・条件付き。設計担当の回答 2026-07-16）

**背景（製造の Plan Mode 提起）**: `cmd/seedgen` は出力先が **000026 固定**・対象キャラ一覧（`FirstWaveOrder`）に **ryu 非含有**のため、**無改変では ryu の seed SQL を生成できない**。

**回答＝追加的拡張を認める**。理由: §2.2 の「改変しない」は**変換規則**を指すのであって、CLI の入出力境界を凍結する意味ではない。手作業生成・一時スクリプト（案 2）は**コピー実装＝「二度作らない」違反**（チェックリスト §9）に該当し、かつ dup スキャン・正準形検証・alias 対といった**安全機構を迂回**するため採らない。

**許容範囲（この 3 条件を満たすこと）**:

1. **拡張は I/O 境界に限る**: (a) **対象キャラの選択**、(b) **出力先ファイル名**、(c) **生成 SQL のヘッダ文字列**のパラメータ化のみ。**変換規則（§2.2 に列挙）は 1 行も変えない**。
2. **既存出力の byte-identical を回帰ゲートにする**（製造提案を採用）: 既定値（`FirstWaveOrder`）での生成物が**現行 `000026` と byte 単位で一致**することを **golden テスト**で固定し、`-check` と併せて回帰ゲートにする。**1 byte でも差分が出たら止めて報告**（変換規則に触れた証拠）。
3. **ryu をハードコードしない**: 「ryu 生成モード」という**専用フラグにしない**。**対象キャラはパラメータ**（既定＝`FirstWaveOrder`）とし、出力先・ヘッダも同様にパラメータ化する。理由: **残り 20 キャラの第二波 seed で同じ改修が再発する**（ryu 専用にすると 3 度目の改修が要る）。CLI の具体形（フラグ名・引数の取り方）は製造に委ねる。

**帰結**:

- **CHANGE 不要・DES 反映不要**: seedgen は dev/seed 責務で**本体ランタイム非経路＝外部契約でない**（M14-03b で CHANGE 起票なしとした判断と同一＝「実装したから DES に書く」でなく「外部契約になったから書く」）。
- **完了報告に経緯を明記**（拡張した関数・パラメータ・golden テストの結果＝000026 byte 一致）。レビュー担当は §2.2 の変換規則が無改変であることを diff で確認する。

### 4.4 検証

- ryu 新 moves が既存 VAL に適合。move_code UNIQUE（旧 moves 削除後なので衝突しない）。
- `make e2e`（seed 非依存 self-contained）が新 seed 下で通過。
- ryu の combos が空（clean DB）であること。

---

## 5. テスト要件（ケース数で語る）

### 5.1 Go

- **seedgen 回帰（必須ゲート・§4.3.1-2）**: 既定値での生成物が現行 `000026` と **byte-identical**（golden テスト）。`-check` 通過。**変換規則の無改変を diff で担保**。
- マイグレ up: ryu 旧 moves・combos 従属行が消え、新 moves＋alias が入る。他キャラ非波及（件数で確認）。
- マイグレ down: 新 seed が消える（実コンボ復元不能の限界を明記）。
- FK 依存順で FK 違反が出ない。FK=OFF×明示 DELETE 非同居。
- `dbtest.Setup` 経由の全テスト通過（ryu 件数前提テストの追従）。

### 5.2 E2E

- ryu の moves が画面18 で新 code で表示・編集できる。
- ryu の combos 一覧が空（clean DB）。
- `make e2e` 全体通過。

---

## 6. レビュー観点（別ファイル）

`M14-03c-review-checklist.md`。重点＝ryu 限定の破壊性（他キャラ非波及）・FK 順・移動 move 非削除・新 code 体系。

## 7. 完了条件（DoD）

- **seedgen の拡張が §4.3.1 の 3 条件を満たす**（I/O 境界のみ・**000026 が byte-identical**〔golden＋`-check`〕・ryu 非ハードコード）。変換規則・索引器は無改変。
- ryu 旧 moves（000004 由来）削除・combos 従属行クリア（ryu 限定）。
- ryu 新 moves（手入力 CSV 由来）＋alias 投入・move_code は CSV 体系。
- 移動 system move（M14-03b 投入分）を削除・再投入していない。
- 他キャラ非波及（件数で担保）。`dbtest.Setup` 全テスト通過・down 整合（実コンボ復元不能の限界明記）。
- `make e2e` 非回帰。

## 8. 参照ドキュメント

| 文書（実パス） | 節 | 用途 |
|------|-----|------|
| M14-03b 指示書 | §4.1/§4.8 | 変換インフラ・索引器の再利用 |
| M14-RESEARCH-02-report | §F-1/§C-3 | ryu code 体系相違・CSV 構造 |
| DES-003 `docs/design/03-data-model.md` | §3.3/§3.9 | moves・alias・combos FK |
| code-facts `docs/handover/code-facts.md` | §8/§9/§10 | model・repository・DDL・FK |

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない

- 削除対象の FK 依存順・ryu character_id の厳密特定（§3.3-1/-2）。
- 「旧 moves」と「移動 move（M14-03b 投入）」の区別（§3.3-3・移動 move を消さない）。

### 9.2 推測で進めてよい

- マイグレの分割数（クリア／削除／seed を 1 本 or 複数）。
- **seedgen 拡張の CLI 具体形**（フラグ名・引数の取り方・既定値の置き場）。§4.3.1 の 3 条件を満たす限り製造判断でよい。

### 9.3 不明時

- 他キャラに波及しそうなら止める（ryu 限定が絶対）。
- 移動 move・drive_parry を巻き込みそうなら止める（M14-03b 投入分の保全）。
- **seedgen の golden（000026）に 1 byte でも差分が出たら止める**（変換規則に触れた証拠＝§4.3.1-2）。

### 9.4 Plan Mode で提示すべき項目

- §3.3 の 6 項目。とくに 1（FK 順）・2（旧 moves の特定）・3（移動 move 非削除）。

## 10. 完了後の次ステップ

- 完了報告を受けて設計担当が DES 反映要否を判断（配布 DB の ryu 正規化＝doc 反映のみの見込み）。
- 配布 DB の全キャラ code 体系が手入力 CSV 由来で一貫する。

## 11. 開発者への確認事項

> **状態（2026-07-16）**: **全 2 件 回答済み＝着手を妨げる未確認事項はない**。以下は回答の記録（製造は再確認不要）。

| # | 論点 | 回答（2026-07-16） |
|---|------|-------------------|
| 1 | ryu 手入力 CSV の受領 | **受領済み**（`character_data/` に存在）。20 列（19＋`is_derived`）。 |
| 2 | combos クリアの範囲 | **承認**。ryu の `character_id` の全 combos＋従属行（draft/trash 含む）を削除してよい。**友人は ryu を記録していない**＝実ユーザ DB でも実害なし（§1.4）。 |

---

*以上、M14-03c 製造指示書 v1.0.2。配置 `docs/instructions/M14-03c-ryu-reseed.md`。M14-03b の変換インフラを再利用し ryu を手入力 CSV 由来へ差し替え（combos クリア）。対のレビューチェックリストは `docs/instructions/reviews/M14-03c-review-checklist.md`。*
