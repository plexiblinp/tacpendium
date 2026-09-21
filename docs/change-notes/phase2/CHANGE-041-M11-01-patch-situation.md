# CHANGE-041 通知書(ドラフト): custom_states 編集の往復保持に伴う PATCH /api/combos への situation 追加

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-041 |
| サブマイルストーン | M11-01 |
| 起票日 | 2026-06-20 |
| 起票者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 承認者 | 開発者(案1採用を 2026-06-20 確定。本通知書は反映用ドラフト) |
| ステータス | **ドラフト(反映待ち)** |
| 影響設計書 | DES-002(v1.20.0→v1.21.0) |

---

## 1. 変更の概要

M11-01 の Plan Mode で、コンボ編集時に custom_states 単独を変更した場合（識別キーを変えないメタデータ編集）は PATCH 経路（`PATCH /api/combos/:id`、`UpdateMetadataRequest`）を通るが、当該 DTO が `situation` を持たないため custom_states の往復保持（round-trip）が永続化できないことが判明した。`PATCH /api/combos/:id` のメタデータ編集可能項目に **`situation`（custom_states の格納先）を加算的に追加**する。

## 2. 変更の理由

- **custom_states はメタデータ（非アイデンティティ）**: DES-006 §2.4 で custom_states は重複判定 VAL-C02 の対象外（識別キーは character／starter／recipe／position／opponent_stance／hit_type／opponent_size のみ）と確定済み。識別に関与しないメタデータの編集は**メタデータ PATCH 経路が正しい置き場所**である。
- **3経路の非対称の是正**: CREATE（`CreateRequest.Situation`）と PUT（`runPut`→`CreateComboRequest`）は既に `situation` をバックエンドで受領できるが、PATCH（`UpdateMetadataRequest`）のみ欠落していた。この欠落を塞ぎ3経路を対称化する。
- **代替案の不採用**: custom_states 変更を PUT へ誘導する案は、論理削除→再生成（FR004）＋セットプレイ引き継ぎ確認＋新 id 発行を一項目編集で誘発し UX/データ上不適切。custom_states を識別キーへ昇格する案は、アプリが custom_states の消費・帰結をモデル化しない以上、別コンボ化の便益がなく不採用（2026-06-20 開発者確定＝案1）。

## 3. 変更の内容

### 3.1 DES-002 §4.2 `PATCH /api/combos/{id}`

- メタデータ編集可能項目に「**キャラ固有状態（custom_states／`situation` JSON）**」を追加する。
- 重複判定キーに該当する項目（レシピ本体・始動技・position・opponent_stance・hit_type・opponent_size）を変更する場合に POST（新規登録＋旧論理削除）へ誘導する既存規定は**不変**。custom_states は重複判定キーではない（DES-006 §2.4）ため、その編集は**識別変更ではなく PATCH のままで正しい**。
- 実装上の扱い（非規範補足）: `UpdateMetadataRequest` に `situation *string`（nil=不変更、他フィールドと同方式）を加算、`UpdateMetadataInput`／repository の UPDATE SET に `situation` を加算。`situation` は `*string` 素通しで保存し、custom_states に対する検証は行わない（DES-006 §2.4）。

## 4. 影響範囲

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-002 §4.2（v1.20.0→**v1.21.0**） | 上記 3.1 |
| 設計書本体 | DES-005 / DES-006 / DES-003 | **変更なし**（§5.7 表示項目6／§5.6 表示項目5／§2.4 は既に custom_states 付与・表示・非検証を規定済みで整合。round-trip の永続化は API 層の補完であり画面・検証規定は不変） |
| 実装 | M11-01（バックエンド: PATCH の DTO／Input／UPDATE SET 3点 + フロント buildPatchPayload） | 指示書 v1.1.0 で規定 |

## 5. 移行影響

- **スキーマ変更なし**（`combos.situation` は TEXT 既存）。
- **後方互換**: `situation` を指定しない PATCH リクエストは従来どおり（nil=不変更）。既存コンボ・既存クライアントに影響なし。
- データ移行: 不要。

## 6. リスク

- 低。`situation` は全層 `*string` 素通しで、PATCH の他メタデータ項目（memo 等）と同じ nil=不変更パターン。検証を伴わない。
- 確認点: PATCH で他キーの保全マージ（既存 situation を parse → custom_states 差し替え → serialize、指示書 §4.4）が CREATE/PUT と同一規則で適用されること。

## 7. 承認チェックリスト

- [ ] `PATCH /api/combos/{id}` のメタデータ編集可能項目への situation（custom_states）追加で良いか。
- [ ] 重複判定キー（POST 誘導）は不変＝custom_states は PATCH のまま、で良いか。
- [ ] バージョン: DES-002 v1.21.0 で良いか。

---

> 案1（2026-06-20 開発者確定）の API 契約反映。承認後、設計担当が DES-002 を改訂（版・ステータス更新）し change-report-041 作成 + change-number-registry 更新（次番号 042）。実装（M11-01）と並行反映で可（CHANGE-032/034 の前例と同様）。

*以上、CHANGE-041 通知書ドラフト。配置 `docs/change-notes/CHANGE-041-M11-01-patch-situation.md`。*
