# change-report CHANGE-089（M18-03b materialize コア・実装反映報告）

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | **089** |
| サブマイルストーン | M18-03b（materialize コア） |
| 作成日 | 2026-07-27 |
| 作成者 | 設計担当 Claude（M18/M19 並列期・中央／セッション2） |
| 実装 | ブランチ `claude/m18-03b-design-outline-bjv1ri`（リモート反映済・`aae9ea9..HEAD` = 15 commits） |
| 判定 | **受理（確定・条件なし）**。M18 指示書担当の一次受け v1.0.0＝**DoD 全充足**（**E-17 実出力目視も開発者実施済 2026-07-27**）・レビュー重大ゼロ |
| 消費連番 | **マイグレ 0 本**（末尾 000041 のまま） |

---

## 1. 実装結果サマリ

確定反撃版を**別コンボとして materialize（実体化）**する中核機能を実装した。**combo 中核の凍結を開けるサブ**（`model.Combo` 27→28 フィールド・`combos` INSERT 22→23 列）だったが、**開けた範囲は指示書の指定どおりに収まっている**（本サブで最も重要な確認点）。

## 2. 非破壊性の証跡

- **`DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache` の判定内容が不変**（`materialized_from_combo_id` を混ぜていない）。
- **`CreateRequest` に出自を足していない**（＝**詐称経路を作っていない**。出自は materialize 経由でのみ入る）。
- **CSV export に `materialized_from_combo_id` の混入 0 件**（裁定6＝CSV には出さない）。
- 新マイグレ **0 本**（末尾 000041）。`internal/seedgen`・`Header.tsx`・`ComboEditor` Props **非改変**。
- **M19-01 資産（`internal/service/setplay/`）非改変**＝**並列期の相互不干渉を 2 サブ連続で実証**。
- `go test ./...` 全 green／FE 834 tests green／E2E A〜D 4/4 green。

## 3. 設計判断の実装時確定

| 項目 | 確定内容 |
|---|---|
| **★materialize は基底コンボの採用を解除する** | 生成時（同一 Tx 内 `RemovePunishLink`）または FR301 既存一致時（短命 Tx `drainBasePunish`）に `combo_punishes`(基底, 相手技) と同キー curation を削除。**基底コンボ自体は独立フォークとして残す**。**未採用の基底からの変換では何も消さない＝冪等・no-op**。`combo_punishes` と `combo_punish_curations` を**ペアで削除して孤児を作らない**（M18-03a の規則に忠実） |
| materialize の応答契約 | `{ comboId, alreadyExisted, damageAdded, damageSkipReason? }`。**生成でも既存一致でも 200**（既存一致はエラーではない）。**対象外 `hit_type` は 400 ＋ `hit_type_not_materializable`**（**BE でも弾く**＝多層防御） |
| 孫 `ComboNode` の `hitType` | **出力専用・後方互換の追加**。**走査述語・フレーム/レーン判定・除外規則は一切変更していない**（03c の案C と同一ファイルであることを意識した最小変更） |
| 編集時の引き継ぎ | `combo_punishes`／`combo_punish_curations` の `combo_id` を**旧→新へ FK 再ポイント**（同一 Tx・原子的・`opponent_move_id`／`note` は不変）。実装は `setups` の `UpdateSetupReferences` と同型。**`MovePunishReferences` は combo リポジトリに配置**（combo リポジトリが既にキー変更 Tx で `combo_setups` を FK 再ポイントしている先例に合わせた） |
| **ダメージ丸め規則** | **DES に書かない**。`damage % 5 <> 0` の実査で **10 件**が出たため実装を停止し、開発者がインゲーム実測した結果、**10 技はすべて非始動技**（throw × 3／special(OD 投げ) × 1／target_combo × 6）＝**`× 0.2` が非整数になる適用面が存在しない**と判明。**整数除算（`/5`）で確定し丸め関数を持ち込まない** |

> **裁定1 の運用（実測が出るまで確定させない）が正しく機能した。** 机上で四捨五入を選んでいたら、**存在しない問題に対する規則を正典化していた**ことになる。

## 4. 件数・基準時点（E-24）

- **丸めの「適用面なし」は 2026-07-27 時点の seed データに基づく結論**である。一次源＝dev DB ＋ 開発者のインゲーム実測。
- **前提が動きうる 2 経路**：(1) `character_data/*.csv` は今後増える（**外部から増える母数は一次源にしない**＝M18-01 教訓 L-4）。(2) `combos.starter_move_id` はレシピ 1 ステップ目と常に一致するため、**ユーザーが `target_combo` を 1 手目にしたコンボを登録すれば `target_combo` が始動技になる**（M18-02 実測でも自技側 `startup IS NULL` の脱落 2 件がともに `target_combo` だった）。
- **実装は整数除算のため前提が崩れても例外は起きず、静かに切り捨てが適用される**（壊れないが silent）。→ **実装コメントに基準時点と一次源を残す**（§6-2）。

## 5. DES 本体への反映（中央実施・本 report と同時）

| 文書 | 版 | 反映内容 |
|---|---|---|
| **DES-002** | 1.37.0 → **1.38.0**（第40版） | §4.2 に `POST /api/combos/{id}/materialize`（応答契約・200 の意味・400 の理由コード・**基底採用の解除**）／`GET /api/punish-finder` の孫に `hitType` |
| **DES-003** | 1.35.0 → **1.36.0**（第39版） | §3.4 `materialized_from_combo_id` の初消費者・**CSV 非出力**／§3.15 に **materialize による採用解除**と**識別キー変更編集での FK 再ポイント** |
| **DES-005** | 2.51.0 → **2.52.0**（第63版） | §5.21 生成元バッジ・第3セクションの変換導線・**変換で基底が第3セクションから外れる**／§5.20 孫ツリーの変換導線（PC 系には出さない）／§5.13 出力正典への適合を実出力目視で確認 |
| **DES-006** | 1.21.0 → **1.22.0**（第24版） | §2.3 に **FR301 の適用面として materialize**／**dup 判定の穴**（`is_draft = 0`・`deleted_at IS NULL` 固定＝仮登録／ゴミ箱の既存 PC 版は検出されず二重生成。**既存の全登録経路と一貫**） |

## 6. 残課題・繰越

| # | 項目 | 処遇 |
|---|------|------|
| 1 | **`target_combo` が始動技のときのダメージ加算が過剰になる可能性** | **開発者ドメイン確認中**。`target_combo` の `damage` は**連携全体の累積値**であるため、「始動技ダメージ × 0.2」が「**ターゲットコンボ全体の 20%**」になる。spec §5 の意図（**始動技＝初段にのみ 1.2 倍**）と乖離しうる。**現時点で実害は出ていない**（`target_combo` を 1 手目にしたコンボが登録され、かつ materialize される条件が要る）。→ followup `materialize-target-combo-damage`（§I） |
| 2 | 丸めの基準時点・一次源を実装コメントへ | `service.go` のコメントに**基準時点（2026-07-27）と一次源（dev DB ＋ 開発者インゲーム実測）**が入っているかの確認（E-24） |
| 3 | **materialize 済みノーマル版を探す画面の孫から隠す** | **M18-03c で設計**。followup `punish-hide-normal-after-materialize`（§I）。**論点＝「silent に消さない」思想との緊張**・**隠す範囲は相手技コンテキスト単位** |
| 4 | combo／punish リポジトリの punish 操作の重複 | 低リスク・意図はコメント済み。**03c の curation 登録導線 再設計時に整理を検討** |
| 5 | `getMoveDamage` の層分離 | `moves` は不変の参照データで tx 外は妥当。将来 moves 参照が増えた際の整理候補として記録 |
| 6 | **SF6 実機バグ「後ろ投げ +1」** | 一部キャラで後ろ投げのみダメージ +1（`kimberly.throw_back` PC 実測 1839 vs `throw_forward` 1838）。**seed は前投げ基準で両者同値（1082）＝バグはデータに反映しない**（開発者方針）。**ゲーム側のバグであり本アプリの欠陥ではない**（将来の照合時に迷わないための記録） |

## 7. E-14 突合（M18-03c への申し送り）

`internal/service/punishfinder/service.go`（**案C の述語緩和・ノーマル版非表示と同一ファイル＝回帰ゲート必須**。除外規則・3 レーン境界・**ガードタブ 0 件が正常**を再確認）／`internal/repository/combo/repository.go`（**§6-4 の重複整理をここで**）／`web/src/features/punish/`（**`PunishTree.tsx` は 03a・03b・03c と 3 サブ連続で触る**）／E2E は**同じ流儀**（`moves` へ書き込まない決定論設計）。

---

*以上、change-report CHANGE-089（M18-03b）。DES 本体反映・registry 更新は中央が同時実施。*
