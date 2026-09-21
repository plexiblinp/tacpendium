# CHANGE-043 通知書(ドラフト): PATCH メタデータのクリア規約を presence-detection 単一トライステートへ一般化

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-043 |
| サブマイルストーン | M11-02 |
| 起票日 | 2026-06-21 |
| 起票者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 承認者 | 開発者(統一案=presence-detection を 2026-06-21 確定。本通知書は反映用ドラフト) |
| ステータス | **ドラフト(反映待ち)** |
| 影響設計書 | DES-002(v1.22.0→v1.23.0) |

---

## 1. 変更の概要

`PATCH /api/combos/{id}` の nullable メタデータのクリア規約を、フィールド別の個別扱い(situation のみ `""`=NULL クリア＝CHANGE-042)から、**全 nullable メタデータ共通の presence-detection トライステート**へ一般化する:

- **キー不在(送信なし)＝不変更**
- **JSON `null`＝NULL クリア**
- **値あり＝その値で更新**

situation も本規約に統一し、CHANGE-042 の空文字 `""` センチネルを**置換**する(クリアの成果＝NULL 保存は不変)。

## 2. 変更の理由

- M11-01 事後に判明した「nullable メタデータ(memo / damage / drive_damage / ゲージ / knockdown_advantage / 起き攻め)を編集で空に戻しても永続化されない」同型バグ(M11-RESEARCH-02 Q4)を一般解で修正するため。
- M11-RESEARCH-02 の確定事実:
  - 現 DTO `UpdateMetadataRequest` は全フィールド `*T` のため **「キー不在」と「キーあり null」を区別できない**(Q2-b)。
  - フロント `buildPatchPayload` は全フィールドを毎回送り、空入力を `null`/`""` で明示送信する(Q1)。一方 `PromoteToFinalButton` は `{version, isDraft}` の **2 キーのみ**送る部分 PATCH(Q6)。
  - このため **full-replace(送られない=クリア)は採れない**(昇格経路で他フィールドが一括誤クリアされる)。**presence-detection** なら、編集経路は `null`=クリアでクリアが効き、昇格経路は不在=不変更で温存され、両立する。
- situation の `""` センチネル(CHANGE-042)は、presence-detection 導入により `null`=クリアで代替でき、**不要な特例**となるため単一規約へ統一する。

## 3. 変更の内容

### 3.1 DES-002 §4.2 `PATCH /api/combos/{id}`(nullable メタデータのクリア規約)

- nullable メタデータ各項目について:
  - **キー不在＝不変更**(部分 PATCH を安全に許容。例: 昇格 `{version, isDraft}`)
  - **`null`＝NULL クリア**
  - **値あり＝更新**
- 対象: memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / 起き攻め 6 BOOLEAN。
- 重複判定キー(レシピ本体・始動技・position・opponent_stance・hit_type・opponent_size)変更時に POST へ誘導する既存規定は不変。
- situation は本規約に統一(CHANGE-042 の `""`=NULL クリア記述を本トライステートへ**置換**。クリア成果は不変)。`is_draft` は非 nullable のためクリア対象外(不在=不変更 / 値=更新)。tagIds は service の関連置換で空配列＝クリア(本規約の対象外)。
- 実装上の扱い(非規範補足): DTO は presence 検出(キーが来たか)を実装し、不在/null/値の3状態を repository へ伝える。`UpdateMetadata` は「present のみ SET、present+null は NULL、present+値は値」で UPDATE。

## 4. 影響範囲

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-002 §4.2(v1.22.0→**v1.23.0**) | 上記 3.1。CHANGE-042 の situation `""` センチネル記述を置換 |
| 設計書本体 | DES-005 / DES-006 / DES-003 | **変更なし**(画面の付与/表示・検証なし・スキーマは不変。クリアは API 層の規約) |
| 実装 | M11-02(BE: DTO presence + Input 3状態 + repo UpdateMetadata / FE: buildPatchPayload の situation を `?? null` へ移行 / テスト・E2E) | 指示書 M11-02 で規定 |

## 5. 移行影響

- **スキーマ変更なし**(対象列はすべて nullable 既存)。
- **後方互換**: キー不在の PATCH(昇格等)は従来どおり不変更。既存クライアントで `null` を送っていなかった経路に影響なし。
- situation: フロントが `""`→`null` 送信へ移行。バックエンドは `null`=クリアで受ける(成果 NULL は不変)。
- CHANGE-042 の `""` センチネルは本 CHANGE で置換(situation の `""` は以後使用しない)。

## 6. リスク

- 中。`null`=クリアの新意味により、編集経路で「空に戻したフィールドが NULL クリアされる」のが新挙動(=修正の本体)。**部分 PATCH 経路(PromoteToFinalButton 等)が「不在=不変更」で温存されること**を実コードとテストで担保する必要がある(M11-RESEARCH-02 Q6)。
- 起き攻め 6 BOOLEAN は本規約下で `null`=NULL クリアが可能になる(従来は不変更)。フォーム状態を正とする挙動として整合だが、テストで明示確認する。

## 7. 承認チェックリスト

- [ ] PATCH nullable メタデータのクリア規約 = presence-detection 単一トライステート(不在=不変更 / null=クリア / 値=更新)で良いか。
- [ ] situation を本規約へ統一(`""` センチネル＝CHANGE-042 を置換)で良いか。
- [ ] バージョン: DES-002 v1.23.0 で良いか。

---

> 承認後、設計担当が DES-002 を改訂・change-report-043・change-number-registry 更新(次番号 044)。実装(M11-02)と並行反映で可。

*以上、CHANGE-043 通知書ドラフト。配置 `docs/change-notes/CHANGE-043-M11-02-patch-clear-tristate.md`。*
