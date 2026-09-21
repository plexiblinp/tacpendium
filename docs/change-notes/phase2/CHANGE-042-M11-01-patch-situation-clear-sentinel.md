# CHANGE-042 通知書: custom_states クリア不能バグ修正に伴う PATCH situation トライステートの正典化

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-042 |
| サブマイルストーン | M11-01(事後バグ修正) |
| 起票日 | 2026-06-20 |
| 起票者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当。製造担当ドラフトを確定) |
| 承認者 | 開発者(空文字センチネル方式を 2026-06-20 選択・実機 E2E 確認済) |
| ステータス | **反映** |
| 影響設計書 | DES-002(v1.21.0→v1.22.0) |

> 本通知書は製造担当起票のドラフト（`CHANGE-042-M11-01-patch-situation-clear-sentinel.md`）を設計担当が確定したもの。コード修正・全テスト・開発者 E2E は完了済み。

---

## 1. 変更の概要

CHANGE-041 で PATCH の `situation` を `nil=不変更` としたが、フロントが全状態 off 時に `null` を送るため Go が nil ポインタにアンマーシャルし「不変更」となり、**custom_states を「あり→なし」にクリアできない**不具合が判明した。`PATCH /api/combos/{id}` の `situation` に「**空文字 `""` = NULL クリア**」の細則を加え、トライステート（未指定／null=不変更・""=NULL クリア・非空=更新）を正典化する。

## 2. 変更の理由(根本原因)

- フロントの意図は「全 off → situation 未送信＝NULL 保存」だが、`buildPatchPayload` の `?? null` で `"situation": null` が送られていた。
- Go の `json.Unmarshal` は JSON `null` を `*string` の nil に落とす（`omitempty` はマーシャル時のみ）。`UpdateMetadata` は `nil=不変更`（CHANGE-041）で SET 句から除外 → 旧値温存。
- CREATE/PUT は INSERT で列を無条件に書くため NULL 保存でき、**PATCH 経路だけ**がクリアを表現できなかった（非対称）。
- `nil=不変更`（部分更新・CHANGE-041 / repository_test 17）を壊さずにクリアを表現する最小手段として、**空文字センチネル**を採用（開発者選択、2026-06-20）。`""` は正当な situation 値（JSON オブジェクト文字列）としては現れないため曖昧さがない。

## 3. 変更の内容

### 3.1 DES-002 §4.2 `PATCH /api/combos/{id}`（situation のトライステート）

- 未指定 / JSON `null` → **不変更**（従来どおり）
- **空文字 `""` → NULL クリア**（custom_states 全 off）
- 非空文字列 → その JSON 値で更新

これで CREATE / PUT / PATCH の3経路がクリア挙動でも対称化する。

- 実装上の扱い（非規範補足）: `repository.UpdateMetadata` は `situation == ""` のとき `add("situation", nil)` で NULL を SET、非空はその値、`nil` は SET から除外（従来）。フロント `buildPatchPayload` は situation を `?? ""`（PATCH のクリア＝空文字）。`buildCreatePayload`／`runPut`／`buildSituation` は不変（POST/PUT は INSERT で NULL 保存でき正しい）。

## 4. 影響範囲

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-002 §4.2（v1.21.0→**v1.22.0**） | 上記 3.1 |
| 設計書本体 | DES-005 / DES-006 / DES-003 | **変更なし**（画面の付与/表示〔§5.7 表示項目6・§5.6 表示項目5〕は off で非表示＝既に規定済み。検証なし〔§2.4〕も不変。スキーマ TEXT 不変） |
| 実装（製造担当・完了済） | `repository.go`／`ComboEditor.tsx`(buildPatchPayload)／`ComboEditorBasicFields.tsx`(testid)／各テスト／E2E 新規／testid-convention.md | コード反映済・開発者 E2E green |

## 5. 移行影響

- **スキーマ変更なし**（`combos.situation` は TEXT 既存）。
- **後方互換**: situation 未指定／null の PATCH は従来どおり不変更。空文字を送らない既存クライアントに影響なし。
- データ移行: 不要。

## 6. リスク

- 低。`""` は正当な situation 値として現れず、センチネルとして安全。クリア結果は NULL（ingrid/c_viper の初期状態と同じ「状態なし」）。
- 留意（§5.1 申し送り）: 他 nullable メタデータ（memo／damage／ゲージ等）は同型のクリア不能が残存（本 CHANGE のスコープ外。別途方針決定）。

## 7. 承認・反映記録

- 開発者が空文字センチネル方式を選択（2026-06-20）、実機 E2E で あり→なし 永続化を確認。
- DES-002 v1.22.0 反映済。change-report-042 作成・change-number-registry 更新（042 使用済・次番号 043）。

---

*以上、CHANGE-042 通知書。配置 `docs/change-notes/CHANGE-042-M11-01-patch-situation-clear-sentinel.md`。*
