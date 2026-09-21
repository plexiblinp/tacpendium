# M18-03b 完了報告: materialize（パニッシュカウンター版の生成）＋採用の引き継ぎ

| 項目 | 内容 |
|------|------|
| 文書ID | M18-03b-REPORT |
| 作成日 | 2026-07-27 |
| 対応指示書 | `docs/instructions/phase3/M18-03b-materialize.md` **v1.0.1**（`/implement_plan_full` の引数は `M18-03b-design-outline.md`(骨子)だったが、開発者確認により製造指示書 `M18-03b-materialize.md` を実装ソースに確定） |
| 準拠範囲 | 指示書 v1.0.1 ＋ **2026-07-27 の 2 件のチャット裁定**（(a) 丸め規則＝整数除算で進行・後日実測、(b) 変換時に基底の採用を第3セクションから解除）。いずれも本報告に記録し、事後 CHANGE addendum で反映予定 |
| 消費した CHANGE 番号 | **CHANGE-089**（中央払い出し値。**自採番していない**） |
| 消費したマイグレ連番 | **なし（0 本）**。`migrations/` の末尾は **000041** のまま（`combos.materialized_from_combo_id` は M18-01/000038 で作成済） |
| ブランチ | `claude/m18-03b-design-outline-bjv1ri` |
| 受理状態 | **受理**（DoD 全項目充足。§7.4 の開発者実出力目視〔E-17〕**実施済み・2026-07-27**。下記 §6） |

---

## 1. §3.3 Plan Mode 実査結果（実値）

**基準時点 2026-07-27。** devContainer に `sqlite3` CLI と dev DB が無い(リモート実行のクリーンクローン)ため、`moves.damage` の正典である seed CSV `character_data/*.csv` に対して計測した。`internal/seedgen/csv.go:100` が `damage` 列(0基点 index 10)を `parseNullableInt` で **verbatim 格納**(変換・按分なし)することをコードで確認済みのため、CSV 値＝`moves.damage`。

### 1-1. 【最重要・裁定1】`moves.damage % 5 <> 0` の実測 = **10 件（≠ 0）**

計測: `awk -F',' 'FNR>1 && $11 ~ /^[0-9]+$/ && ($11 % 5)!=0'`（damage 列＝11 列目・非空整数のみ・全 15 キャラ CSV）。件数の数え方＝「`moves.damage` が非 NULL かつ 5 の倍数でない行数・seed CSV 基準・2026-07-27」。**category は seed 実値**。

| character | move_code | damage | seed category | 開発者インゲーム実測(PC) |
|---|---|---|---|---|
| jamie | forward_throw_reach_drink_lv4 | 1259 | throw | 2141 |
| jamie | tenshin_od | 682 | special（OD コマ投げ） | 784 |
| kimberly | throw_forward | 1082 | throw | 1838 |
| kimberly | throw_back | 1082 | throw | 1839（※後述の実機バグで +1） |
| kimberly | bushin_prism_strikes_2hits | 558 | target_combo | 計測不可（target combo） |
| kimberly | bushin_prism_strikes_3hits | 866 | target_combo | 計測不可（target combo） |
| kimberly | bushin_prism_strikes | 1178 | target_combo | 計測不可（target combo） |
| kimberly | bushin_hellchain_3hits | 964 | target_combo | 計測不可（target combo） |
| kimberly | bushin_hellchain | 1414 | target_combo | 計測不可（target combo） |
| kimberly | bushin_hellchain_throw | 1414 | target_combo | 計測不可（target combo） |

**【実測確認済・2026-07-27】** 該当 10 技の seed category は **throw ×3 / special(OD投げ) ×1 / target_combo ×6** で、いずれも `normal` でなく非空中。開発者のインゲーム実測でも投げ 3 技・OD コマ投げ 1 技は PC 値を計測でき、target_combo 6 技は「計測不可（target combo であり materialize 始動として成立しない）」と確認された。**したがって 10 技はいずれも materialize の始動技(`starter_move_id`)になり得ない。** ダメージ式 `base.damage + round(starterMove.damage × 0.2)` の × 0.2 対象は始動技のみのため、**丸め規則の適用面は存在しない**（× 0.2 は常に 5 の倍数に当たり整数化する）。

### 1-2. 【推測で進めた点・要・後日インゲーム実測】丸め規則

指示書 §3.3-2 の原則は「1 件以上なら実装を止めて開発者のインゲーム実測を待つ」。本サブでは **開発者裁定(2026-07-27)** により「該当技は始動技になり得ず、後から違っても訂正容易(1 行・生成物は独立フォークでユーザー編集可)なため整数除算で進めてよい。該当技を報告し後日インゲーム実測させること」と確定し、その後 **同日中に開発者がインゲーム実測を完了**した。

- **採用: 整数除算 `starterMove.damage / 5`（丸め関数を持ち込まない）。** 実装は `internal/service/combo/service.go` の `Materialize` step4。
- **✅ 実測完了(2026-07-27)**: §1-1 表のとおり非5倍数 10 技は throw/OD投げ/target_combo で、**materialize の始動技になり得ないことが実測で確認**された。× 0.2 が非整数になる経路が存在しないため、**丸め規則の適用面は無く、整数除算のままで確定**。実測後にコードコメントも「推測」→「実測確認済」へ更新。**DES には丸め規則を書かない**（適用面が無いため。§5 参照）。
- **副次発見（実機バグ・所見）**: 計測中に SF6 の実機バグ「一部キャラで後ろ投げのみダメージが +1（PC・通常投げとも）」を発見（例: kimberly `throw_back` の PC 実測 1839 vs `throw_forward` 1838）。seed は前投げ基準で両者同値(1082)＝**バグはデータに反映しない**（開発者方針「前投げを基準」）。詳細は `docs/progress/progress-log.md` に記録。

### 1-3. PUT 経路の子テーブル複製機序（§3.3-3・L-1 実引用）

`internal/service/combo/service.go` `UpdateWithKeyChange`(単一 Tx: `BeginTx`→`Commit`、deferred rollback)。旧コンボは論理削除のみ(`UPDATE combos SET deleted_at=…, updated_at=… WHERE id=? AND version=? AND deleted_at IS NULL`)。子テーブルの作り直し方は 2 種:
- **steps / tags / oki** … リクエストから **newID で再構築**(`InsertSteps` / `ReplaceTagAssociations` / `ReplaceOkiOptions`)。
- **setups** … **FK 再ポイント**(`UpdateSetupReferences`＝`UPDATE combo_setups SET combo_id=? WHERE combo_id=?`、`SetupCarryOptions` の mode 分岐)。

**§4.6 の採用引き継ぎは setups と同型の FK 再ポイント**を採用(`MovePunishReferences`＝`combo_punishes` / `combo_punish_curations` の `combo_id` を旧→新へ UPDATE)。materialize の子テーブル複製は上記の既存 `InsertSteps` / `ReplaceOkiOptions` / `ReplaceTagAssociations` / `RecomputeComboCache` を再利用(独自実装なし)。

### 1-4. その他の実査
- `ls migrations/` 末尾 = **000041**。新規マイグレを作らずに進めた。
- `DuplicateKey`(6 項)・`FindActiveByDuplicateKey` の WHERE 固定 `is_draft=0`/`deleted_at IS NULL`・nil→`col IS NULL` をコードで確認(RESEARCH-02 A-2 の再確認)。`CalcRecipeHash` 入力は steps のみ。
- `internal/service/setplay/`(M19-01)は `ComboReader.FindByID` で `model.Combo` を読むが `CharacterID`/`KnockdownAdvantage` のみ利用。フィールド 1 個追加の影響なし。**回帰対象に含め、全 Go テスト green を確認**(実装は不変)。
- `*divergence*` テストは `internal/repository/move/divergence_test.go`(move 用・`MoveListItem`↔`model.Move`)のみ。**Combo 用の divergence guard は存在しない**ため、move の当該テストは本サブと無関係に green のまま。
- `combo_punishes` の行数: クリーンクローンのため 0(seed に無し)。テストは各自の使い捨て DB で採用行を作って検証。

---

## 2. 実装サマリ（成果物）

### BE
- `internal/model/combo.go` … `MaterializedFromComboID *int64`(DB マップ 26→27 フィールド)。※指示書表記「27→28」は数え方の差で、追加は正確に **1 フィールド**。
- `internal/repository/combo/repository.go` … INSERT 列 **22→23**、`scanCombo` ＋ **5 本の SELECT**(`selectComboByIDSQL`/`…AllowDeleted`/`List`/`FindActiveByDuplicateKey`/`listAllActiveCombos`)へ列追加。`MovePunishReferences`/`InsertPunish`/`RemovePunishLink`(いずれも tx 対応・`UpdateSetupReferences` と同型)を追加。**`DuplicateKey`/`CalcRecipeHash`/`RecomputeComboCache` は不変**。
- `internal/api/combo/dto.go` … `ComboResponse` に `materializedFromComboId` を露出(生成元バッジ用)。**`CreateRequest` には足さない**(出自詐称経路を作らない)。
- `internal/service/combo/service.go` … `Materialize`(対象判定→FR301→ダメージ→`combos` INSERT→子テーブル複製→`combo_punishes` INSERT を単一 Tx)、`ErrMaterializeIneligibleHitType`、理由コード定数。`UpdateWithKeyChange` に `MovePunishReferences`(§4.6)。**基底採用の解除**(§5.3-A/§1.1・下記 §3)。
- `internal/api/combo/materialize_handler.go`＋`routes.go` … `POST /api/combos/:id/materialize`。対象外 hit_type は **400＋`hit_type_not_materializable`**。
- `internal/service/punishlist/`＋`internal/repository/punish/` … `ComboNode`/`PunishEntry`/`listPunishEntriesBaseSQL`/scan に `materialized_from_combo_id` を配線(バッジ用)。
- `internal/service/punishfinder/service.go` … 孫コンボ `ComboNode` に **出力専用フィールド `HitType`** を追加(FE の変換ボタン表示条件用)。**走査述語・フレーム/レーン判定は非改変**(案C は 03c)。

### FE
- `web/src/features/punish/api.ts` … `useMaterialize`(成功後 `useInvalidatePunish()`＋`["combos"]`＋`["combo",id]` を無効化。FR301 既存一致は `alreadyExisted` で非エラー分岐)。
- `web/src/features/punish/components/PunishTree.tsx` / `PunishList.tsx` … 変換ボタン 2 箇所(孫ツリー・第3セクション。`PUNISH_COUNTER_HIT_TYPES` で PC 系は非表示)、生成元バッジ「PC版(生成)」、告知文書き換え、既存あり表示＋`/combos/{id}` リンク、加算しなかった理由表示。
- `web/src/constants/punish.ts` … `PUNISH_COUNTER_HIT_TYPES`/`MATERIALIZED_BADGE_LABEL`/`MATERIALIZE_DAMAGE_SKIP_LABELS`(BE 理由コードと 1:1・L-7)。

---

## 3. 【裁定・2026-07-27】基底採用の入力キュー解除（§5.3-A/§1.1）

指示書 §4.4 の処理順は「生成」のみ記載だが、§5.3-A/§1.1 は「変換後に基底が第3セクションから消える(入力キューを処理する)」と明記している。この乖離を開発者に照会し、**「基底の採用(combo_punishes(基底, 相手技))と同キー curation を解除して第3セクションから外す。基底コンボ自体は独立フォークとして残す」** と裁定(2026-07-27)。

- 実装: 生成経路は同一 Tx 内で `RemovePunishLink(基底, 相手技)`、FR301 既存一致経路は `drainBasePunish`(短命 Tx)。いずれも対象が無ければ **no-op(冪等)**＝探す画面孫ツリーからの未採用変換では何も消さない。
- テスト: `TestMaterialize_DrainsBaseAdoption`/`TestMaterialize_Drain_NoOpWhenBaseNotAdopted`、E2E-A で第3セクションから消えることを確認。
- **DES 反映要点に追記**(§5)。

---

## 4. 自己テスト結果（§7.2）

- **`go test ./...` = 全 green**(2026-07-27・full suite exit 0)。materialize 対象判定/ダメージ/縁3/コピー範囲(setups 非複製含む)/FR301(nil 一致・穴2ケース「生成される」明示)/原子性/§4.6 引き継ぎ(移動・note 不変・同一 id 編集は無変化・強制失敗ロールバック)/基底非衝突/入力キュー解除、handler 5 本(200 生成・200 既存・400 欠落・400 非対象・404)。
- **`pnpm test`(Vitest) = 834 tests green**。`tsc --noEmit` green・`pnpm run build` 成功。FE: 変換ボタン表示条件・バッジ・mutation 呼び出し・告知文書換を検証。
- **E2E `web/e2e/m18-03b-materialize.spec.ts`(A〜D)= 単独実行 4/4 green**(2026-07-27)。実行環境の pin: `make e2e` の `playwright install` は行わず、環境同梱 Chromium(`PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`)を使用。単独実行のため §5.3 記載の並列 worker flaky は発生せず。追加 spec は `moves` へ書き込まない(combo_punishes を API で用意)。
  - A: 採用→第3セクション→変換→生成元バッジ付きで punish_counter タブに出る→第3セクションから消える。
  - B: FR301＝2 回目は生成されず既存 id(件数不変)。
  - C: 識別キー変更編集で採用が新コンボへ引き継がれマイリストから消えない。
  - D: materialize 後もコンボ CRUD 非回帰(既存スイートが D 全体をカバー)。

---

## 5. DES 反映要点（実装完了後に中央へ／採番・改訂は中央）

1. **DES-002 §4.2**: materialize endpoint `POST /api/combos/{id}/materialize`(path param のみ・query なし)。
2. **DES-003 §3.4**: `materialized_from_combo_id` に**初めての消費者**が現れた(未使用でなくなった)。**CSV には出さない**方針(裁定6)。dup/recipe 非対象は不変。
3. **DES-005**: §5.20 の案C は本サブ対象外(03c)。§5.13 出力正典に materialize コンボが従う。**§5.21**(画面21)に生成元バッジ・第3セクションの変換導線。
4. **DES-006**: FR301 の適用面に materialize が加わった。**dup 判定の穴(`is_draft=0`/`deleted_at IS NULL` 固定＝仮登録・ゴミ箱の既存 PC 版は検出されず二重生成)を明文化することを推奨**(§5.2)。
5. **【新規・裁定 2026-07-27】** materialize は基底コンボの採用を第3セクションから解除する(§3)。§4.4 の処理順に「基底採用の解除」を追記推奨。
6. **ダメージ丸め規則**: **DES に丸め規則を書かない**。実測(2026-07-27)で非5倍数ダメージの技は全て非始動技(throw/OD投げ/target_combo)と確認され、× 0.2 が非整数になる適用面が存在しないため(§1-2)。実装は整数除算のまま。将来 damage 非5倍数の技が始動技として現れる設計変更が生じた場合のみ、その時点で丸め規則を実測して確定する。

**製造は DES 本体を直接編集していない。**

---

## 6. 残・申し送り

- ~~【要・開発者対応】E-17 実出力目視(DoD §7.4)~~ … **✅ 完了(2026-07-27・開発者実施)**。materialize コンボを出力正典(DES-005 §5.13＝A4 固定・縮小フィット下限 70%・メディアは link のみ・セットプレイは名称のみ)の条件で出力し目視 OK。DoD §7.4 充足＝**本報告は受理**。
- ~~ダメージ丸めのインゲーム実測~~ … **完了(2026-07-27)**。非5倍数 10 技は全て非始動技と確認、丸め適用面なし・整数除算で確定(§1-2)。
- **【git】** 本ブランチのコミットは committer email=`noreply@anthropic.com` だが GitHub 上「Unverified」(署名なし)。CLAUDE.md §10 が `git config`/`rebase` を deny しているため製造側で是正不可。署名/committer 是正は開発者が実施。
- **【要設計・M18-03c 推奨】materialize 済みノーマル版を「探す」画面の孫から隠す**（開発者要望 2026-07-27）。反撃は必ず PC になるため、PC 版生成後は元のノーマル版を孫候補から消したい。実装骨子は `punishfinder` 孫列から `EXISTS(Y.materialized_from_combo_id = X.id)` を除外（新スキーマ不要）だが、**探す画面の候補集合変更＝DES-005 §5.20 挙動変更**かつ **punishfinder（03c の案C と同一ファイル・凍結中）** を触るため無設計変更の 03b では実装せず。`docs/handover/followup-backlog.md` §I-(d) `punish-hide-normal-after-materialize` に起票。
- レビュー報告書 `docs/progress/phase3/m18-03b-review.md`(重大問題 0 件・条件付き)＋取り込み結果(同末尾)を参照。
- 後続 M18-03c: 案C・手動入力 prefill・手動確認レーン登録・curation 登録の再設計。本サブが触った資産と 03c 改造対象の突合(E-14)を 03c 着手時に行う。

---

*以上、M18-03b 完了報告。materialize と編集経路の silent-drop 解消を実装。新スキーマ・新マイグレとも非消費(CHANGE-089・マイグレ 0 本)。*
