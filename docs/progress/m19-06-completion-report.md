# M19-06 完了報告（成立条件による絞り込み）

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M19-06-setup-result-filter.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M19-06-review-checklist.md` v1.0.0 |
| 実装日 | 2026-08-09 |
| ブランチ | `claude/m19-06-result-filter-setup-xu6h2p` |
| マイグレ | **消費なし**（`migrations/` に新規ファイル 0） |
| CHANGE | **要**（判定は §7）。**起票は設計卓。製造は DES 本体を編集していない** |
| 関連 | 設計伝達レポート `docs/handover/design-reports/20260809-m19-06-design-exceptions.md` |

---

## 1. §2.5 対象画面 4 項目の判定（触った／触らなかった・**理由つき**）

| # | 画面 | 判定 | 理由 |
|---|---|---|---|
| 1 | **コンボ一覧**（`DES-005` §5.4） | **触った** | 本サブの主対象。`ComboListPage` / `useComboListFilters` / `ComboListFilters` / `combo/api.ts` |
| 2 | **マイコンボ**（同 §5.5） | **触らない** | **フィルタ機構を共有していない。** `web/src/features/mycombo/components/MyComboPage.tsx` は `useComboListFilters` を使わず、`useSearchParams` から `characterId` / `status` / `sort` / `order` を独自に読み、`apiFilter` は `characterId` / `sort` / `order` / ステータスタグの `tagIds` だけを組む（同 147-158 行）。共有部品は `ComboSortControls` と `useColumnVisibility` のみ。**ここへ絞り込みを足すのは「新しい面を作る」ことになる** |
| 3 | **エクスポート**（同 §5.13a） | **触らない** | **`range=all` でも現在のフィルタを自動反映しない。** `internal/service/comboio/export.go:101-110` が `ExportQuery` の 6 フィールド（`CharacterID` / `TagIDs` / `Position` / `HitType` / `OpponentStance` / `IsDraft`）を**明示列挙**して `ListFilter` へ詰め替える形であり、新項目は流れない。反映させるには `ExportQuery` と export API のクエリ契約の拡張が要り、指示書 §1.3 のスコープ外 |
| 4 | **「検索」に相当する独立の面** | **存在しない** | `web/src/router.tsx` の全 19 ルートを実査。コンボの検索画面は無い（`/punish/search` は確定反撃サーチ＝別系統で `combos` 一覧フィルタではない）。**「一覧のフィルタが検索である」** |

**★2〜4 はいずれも「気づかなかった」のではなく「実査して触らないと判断した」。** 既存の面の挙動を変える必要は生じていない（§7.3 の上申案件に該当なし）。

---

## 2. `ListFilter` へ追加した項目名と型

`internal/repository/combo/repository.go`（既存 13 フィールドは**不変**）:

```go
// SetupResult / SetupTechType / SetupInCorner はセットプレイ成立条件
// (combo_setup_results)による絞り込み(M19-06)。
//
// ★SetupResult が nil のときは SetupTechType / SetupInCorner も効かせない。
SetupResult   *string // nil=絞り込みなし。model.SetupResultOK / NG / Unverified
SetupTechType *string // nil=不問。model.OkiTechTypeNeutral / Back
SetupInCorner *bool   // nil=不問
```

対応するクエリパラメータ（`GET /api/combos`）: **`setup_result` / `setup_tech_type` / `setup_in_corner`**。

対応する FE state（`ComboListFiltersState`、既存 8 フィールドは不変）: **`setupResult` / `setupTechType` / `setupInCorner`**。

**「成立状態が nil のときは軸を効かせない」の実装上の担保**: `List` は `if filter.SetupResult != nil` の中でしか軸を参照しない（`setupResultWhere` へ渡すのがその 1 か所だけ）。この扱いは `ListFilter` のフィールドコメントと `List` 内のコメントの両方に明記した。

---

## 3. 3 値それぞれの述語（実装した SQL の形）

軸の条件（`<cell>`）は指定された軸だけを AND する（両方 nil なら空）:

```
<cell> = [" AND csr.tech_type = ?"] + [" AND csr.in_corner = ?"]
```

| 値 | 述語 |
|---|---|
| **`ok`** | `EXISTS (SELECT 1 FROM combo_setup_results csr JOIN setups s ON s.id = csr.setup_id AND s.deleted_at IS NULL WHERE csr.combo_id = combos.id AND csr.result = 'ok' <cell>)` |
| **`ng`** | `EXISTS (SELECT 1 FROM combo_setup_results csr JOIN setups s ON … WHERE csr.combo_id = combos.id <cell> GROUP BY csr.tech_type, csr.in_corner HAVING SUM(CASE WHEN csr.result='ng' THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN csr.result='ok' THEN 1 ELSE 0 END) = 0)` |
| **`unverified`** | `(EXISTS (SELECT 1 FROM combo_setups cs JOIN setups s ON … WHERE cs.combo_id = combos.id) AND (SELECT COUNT(DISTINCT csr.tech_type ‖ ':' ‖ csr.in_corner) FROM combo_setup_results csr JOIN setups s ON … WHERE csr.combo_id = combos.id <cell>) < <対象セル数>)` |
| （未指定） | 条件を足さない（軸を指定しても足さない） |

**★判定の単位は「セル」（`tech_type` × `in_corner` の組）である**（開発者裁定 2026-08-09。§3-5）。3 値とも「**対象セルのいずれかで成り立つか**」を問う＝**「不問」は各セルの答えの OR** であり、**3 値とも単調増加**する（個別指定の結果は必ず「全て」の部分集合）。

**要点**:

- **`ok` は EXISTS 意味論**——複数セットプレイの一部が `ng` でも、1 つでも `ok` があれば該当する（セットプレイは選択肢であり、1 つ成立すればその状況に対応できる）。**`ok` はセル単位に分けても結果が同じ**なので（`EXISTS` はセルの OR に対して分配的）素の `EXISTS` のままである。
- **`ng` は `ok` の単純な否定ではない**——**セルごとに集約**し、「`ng` があり `ok` が無い」セルが 1 つでもあるかを見る。`GROUP BY` はセットプレイ横断でセルをまとめるため、**同じセルで一方が `ok` ならそのセルは `ng` にならない**（EXISTS 意味論を維持）。
- **`unverified` は「行が無い」を「不成立」と読み替えていない**——セットプレイを 1 つ以上持つことを要求したうえで、**未記録のセルが 1 つ以上残っているか**を見る。行が無いセルは行を数えても出てこないため「記録済みセル数 < 対象セル数」で表す。**対象セル数は `model.OkiTechTypes` の要素数から導出**する（`tech_type` を増やしても追随する）。
- **★セルを `(setup_id, tech_type, in_corner)` 単位にはしない。** あるセットプレイが `ok`・別が `ng` のコンボが `ng` にも出るようになり、§2.1 (a) の EXISTS 意味論と矛盾するため。
- **★3 値は排他ではない。** 画面端では成立し画面中央では不成立のコンボは `ok` にも `ng` にも出る（実態そのまま）。**「3 値の合計＝セットプレイを持つコンボ数」という検算は成立しない。**
- **セットプレイを 1 つも持たないコンボは 3 値のどれにも該当しない**——`ok` / `ng` は結果行の EXISTS が組の存在を含意するので構造的に外れ、`unverified` は上記の明示 EXISTS で外す。**「該当なし（圏外）」と「未検証」を混ぜない**（`chain_cancel_total` の NULL 2 種＝D-137／D-143 と同じ形）。
- **論理削除された `setups` は 3 述語すべてから除外**（開発者裁定 2026-08-09。設計伝達レポート §1-1）。**論理削除された「コンボ」の扱いは従来どおり `IncludeDeleted` / `OnlyDeleted` に従い、新しい規則を作っていない。**
- 値域外の成立状態は `1 = 0`（1 件も該当しない）に倒す。API 層で 400 に落とすため通常は到達しない。

---

## 4. §3-6・§3-7 の実測値

### 4-1 製造時点 —— **実測不能だった**

**実装した実行環境（クラウド実行・fresh clone）に dev DB が存在しなかった。** `*.db` は `.gitignore:24-27` で管理外であり、リポジトリにも `~/.local/share/combomgr/` にも DB ファイルが無い（`find . -name "*.db"` が 0 件）。

**代替の担保**: リポジトリ層テストで **3 値それぞれの該当コンボと非該当コンボを対で固定**した（「該当した件数」だけでは条件を広く当てすぎても検出できない＝`SUPP-001` §5.5.2 (3)）。fixture は `dbtest.Setup(t)` の使い捨て DB 上に毎回作るため **HEAD 依存にならず、比較区間は自サブに閉じている**（本サブはマイグレを消費しない）。

### 4-2 ★開発者による dev DB 実測（2026-08-09）—— **一部が埋まった**

開発者が dev DB（**`/home/node/.local/share/combomgr/combomgr.db`**＝OS 既定パス。`db path resolved` で確認済み）に対し `GET /api/combos` を実行した結果。

| # | 指示書の要求 | 実測値 |
|---|---|---|
| §3-7 | **セットプレイを 1 つも持たないコンボの件数** | **36 件**（全 **41** 件中。**セットプレイを持つのは 5 件**。`setups` 9 件・`combo_setups` 7 リンク＝**リンク 7 本が 5 コンボに分かれており、少なくとも 1 コンボは 2 つ以上のセットプレイを持つ**） |
| §3-6 | `combo_setup_results` の行数と `result` の分布 | **0 行**（テーブルを直接数えて確定。`ok` / `ng` とも 0 件） |

> **★数字はユーザーデータなので動く。** 同日の 1 回目の計測は **全 35 件・セットプレイ持ち 4 件・圏外 31 件**で、下記の G-2 の確認はこの時点のスナップショットに対して行われた。**確認の成立には影響しない**（圏外がすべて除外されたという関係は件数に依らない）。

**★確認できたこと（G-2 の実データ版・本サブで最も重要な一点）**

**`setup_result=unverified` の結果に、セットプレイを持たない 31 件が 1 件も混ざっていない。** 圏外と未検証を混ぜていれば 35 件すべてが `unverified` に出ていたはずで、**31 件が正しく除外されたことは述語が効いている実証**である。あわせて **3 値の合計（4）が「セットプレイを持つコンボ数」（4）と一致**し、**値域外の `setup_result=maybe` が 400** で弾かれることも実データ経路で確認された。

> **★この実測はセル単位化（B 採用・§3）の前に行われたものである。** **G-2（圏外を 3 値のどれにも入れない）と 400 の確認は B 採用後も有効**だが、**「3 値の合計＝セットプレイを持つコンボ数」の一致は B では成立しない**（3 値が排他でなくなったため）。**検算として使えるのは「単調性＝個別指定の結果 ⊆ 全ての結果」へ置き換わる。**

### 4-3 ★実データでの述語確認 —— **完了**（2026-08-09）

**上記 4-2 の時点では `combo_setup_results` が 0 行で `ok` / `ng` / 軸が未評価だったが、その後の実測で解消した。**

| # | 実測したこと | 結果 |
|---|---|---|
| 1 | 成立条件を 3 行投入し、3 値・軸・EXISTS 意味論を確認 | **3 値が重複なく合計 4 件を分割**（当時の A 意味論）。**同じセルで `ok` と `ng` が混在するコンボは `ok` にのみ分類**（EXISTS 意味論）。**別コンボは `ng` に分類。軸指定は対象セルだけに作用。** 一時データは**完全に削除して原状復帰** |
| 2 | 4 セルすべて記録済みのコンボで `ng` × 画面端の 3 通り | 軸の非単調性が表面化（§3 の裁定へ。設計伝達レポート §4-2c 例①） |
| 3 | **セル単位化（B）採用後**に同じ 3 通りを引き直し | **「意図通りになっていた」ことを開発者が確認**（条件1 が 0 件 → 1 件、条件2・条件3 は従来どおり） |
| 4 | 画面の実機確認（設計伝達レポート §6-2 の 10 ステップ） | **完了** |

**⇒ 3 述語・軸の効き・EXISTS 意味論・圏外の除外・値域外 400 は、いずれも実データ経路で確認済み。** **レビューチェックリスト §11.5（実データで動作確認できなかった場合の上申）には該当しない。**

**★ただし 1 の「3 値が重複なく分割」は A 意味論での確認であり、B 採用後は成立しない**（3 値が排他でなくなったため）。**B 後の検算は単調性（個別指定の結果 ⊆ 全ての結果）へ置き換わる。**

---

## 5. §5 走査結果（「未検証」と「不成立」を混ぜている既存箇所の有無）

**結論: 混入なし。** 3 系統（本番コード／テスト資産／設計文書）すべてを走査した。

### 5-1 `unverified` / `SETUP_RESULT_UNVERIFIED`

| 系統 | 箇所 | 判定 |
|---|---|---|
| 本番コード | `web/src/constants/setup-result.ts:22-24` | **正**。「`unverified` は画面表現のみで、保存値ではない（行が無いこと＝未検証）」と明記 |
| 本番コード | `web/src/features/setup/components/SetupResultEditor.tsx:80,99,109,228,238` | **正**。未検証セルには保存先の行が無いとして保存を抑止している |
| 本番コード | `web/src/features/setup/components/SetupResultGrid.tsx:33,82-83,105-106` | **正**。行が無ければ `unverified` を返す（`ng` に落としていない） |
| テスト資産 | `SetupResultGrid.test.tsx:31,99-101,111` | **正**。行なし・空配列・undefined のいずれも `unverified` として対で固定 |
| テスト資産 | `SetupResultEditor.test.tsx:114,127,241` | **正**。3 状態の指定を直接テストしている |
| テスト資産 | `web/e2e/m19-03-setup-results.spec.ts:378-381` | **正**。`result:"unverified"` を PUT して **400 を期待する否定テスト**＝保存値でないことの固定 |
| 設計文書 | `migrations/000042_create_combo_setup_results.up.sql` 冒頭コメント | **正**。「未検証は行の有無で表す（result に NULL を入れて意味を持たせない）」 |
| 設計文書 | `internal/model/setup.go:45-54,63-66` | **正**。同上 |

### 5-2 `combo_setup_results` の既存消費者

| 箇所 | 用途 | 判定 |
|---|---|---|
| `internal/repository/setup/setup_results.go` | 取得・upsert・削除 | **正**。削除＝未検証へ戻す |
| `internal/repository/combo/repository.go:800,964,1010,1035` | HardDelete 時の明示削除・キー変更編集の再ポイント・紐付け解除時の削除 | **正**。3 状態の解釈に関与しない |
| `internal/api/combo/handler.go:150-168` | 一覧・詳細で `SetupSummary.Results` へ埋める | **正**。行をそのまま渡すだけで、行が無いセルを埋めていない |

**⇒ 「未検証」と「不成立」を混ぜている既存箇所は無いため、本サブの絞り込みが誤りを引き継ぐ恐れはない。§7.3・チェックリスト §11.2 の上申案件は無い。**

---

## 6. 既知の限界

1. ~~**実データでの動作確認をしていない**~~ —— **解消**（§4-3。開発者が実データで 3 述語・軸・EXISTS 意味論・B 採用後の再確認まで完了）。**製造の実行環境に dev DB が無い**という制約自体は残る。
2. **`unverified` は「どのセットプレイがまだ未検証か」を絞るものではない**——判定はセル単位（セットプレイ横断で集約）であり、セットプレイ単位ではない。粒度を変える需要が出た場合は別サブになる。
3. **マイコンボ・エクスポートには効かない**（§1 の 2・3。実査のうえ触らないと判定）。
4. **`GET /api/combos` の 400 エラーコードは既存の 2 系統に割れたまま**（`invalid_query` / `invalid_query_param`）。新項目もそれぞれの前例へ合わせており、統一はしていない（指示書 §8.3）。
5. **★`unverified` の意味が「埋め残しがある」へ変わった**——開発者裁定（2026-08-09）で判定をセル単位にしたため、旧「1 セルも記録が無い（完全に手つかず）」から「**未記録のセルが 1 つ以上残っている**」になった。**`DES-005` §5.4 への明記が要る**（CHANGE-094 の反映範囲。経緯は設計伝達レポート §4-2c）。
6. **★3 値が排他でなくなった**——同じコンボが `ok` にも `ng` にも出る（セルによって答えが違うコンボ）。実態そのままだが、**「3 値の合計＝セットプレイを持つコンボ数」という検算はもう使えない**（§4-2 で開発者が実データ確認に用いていた不変条件）。

---

## 7. CHANGE の要否の判定結果

**要。** 反映先は指示書 §9 のとおり 2 か所で、**起票は設計卓が行う**（製造は `docs/design/` 配下を 1 文字も編集していない）。

| 反映先 | 内容 |
|---|---|
| **`DES-002` §4.2**（`GET /api/combos`） | クエリパラメータ 3 本の追加＝`setup_result`（`ok` / `ng` / `unverified`）／`setup_tech_type`（`OKI_TECH_TYPES` の値域）／`setup_in_corner`（真偽値）。**いずれも値域外は 400**。**`setup_result` が無いときは軸 2 本を読まない**。**3 値の述語（EXISTS 意味論・`ng` は `ok` の否定でない・`unverified` は行の不在＋セットプレイの存在）** |
| **`DES-005` §5.4**（コンボ一覧） | フィルタ 3 項目の追加（native select・既存のフィルタ群の中・既存の保持機構に相乗り）。**成立条件が未指定のあいだは軸 2 つを `disabled`**（設計伝達レポート §1-2）。**列カスタマイズには追加しない**（絞り込みのみ） |
| **（併記を依頼）** | **論理削除された `setups` を 3 述語すべてから除外する**（設計伝達レポート §1-1）。`DES-005` §5.4 か `DES-003` §3.19 のいずれか |
| **（併記を依頼）** | **判定の単位は「セル」であり、軸の「不問」は各セルの答えの OR である**（開発者裁定 2026-08-09。§3-5・設計伝達レポート §4-2c）。**3 値とも単調増加**＝個別指定の結果は必ず「全て」の部分集合になる。**あわせて `unverified` の意味が「未記録のセルが 1 つ以上残っている（埋め残しがある）」であること**と、**3 値が排他でないこと**を明記してほしい |

**次の CHANGE 番号は `docs/handover/change-number-registry.md` の実査により `094`**（092＝欠番〔D-239〕／093＝述語拡張を消費済み）。**マイグレは消費しないため、次の空き連番 `000069` は不変。**

---

## 8. 完了条件の確認

| # | 条件 | 結果 |
|---|---|---|
| 1 | `go test ./...` | **green**（全パッケージ） |
| 2 | `pnpm test`（vitest） | **green**（119 files / 924 tests） |
| 3 | §4 の全要件 | **green**（下表） |
| 4 | `go vet` clean | **出力なし** |
| 5 | `gofmt -l internal/ cmd/` | **出力なし** |
| 6 | FE lint / typecheck（`pnpm run lint` = `tsc --noEmit`） | **clean** |
| 7 | `migrations/` に新規ファイルなし | **diff 0** |
| 8 | `moves` に触っていない（契約 F-1〜F-6） | **diff 0**（`character_data/` も diff 0） |
| 9 | `internal/service/punishfinder/` ／ `setplay/` に diff 0（契約 §3.2） | **diff 0** |
| 10 | `docs/progress/progress-log.md` への追記（D-191） | **済** |
| 11 | 設計伝達レポートの提出（§7） | **済** |

### §4 テスト要件の対応

| # | 要件 | 実装したテスト |
|---|---|---|
| 1 | 3 値それぞれで該当／非該当を対で固定 | `TestRepository_List_SetupResult_ThreeStates`（3 サブテスト。各ケースで期待集合を明示し、**全件該当していないこと**も別途アサート） |
| 2 | 一部 `ok`・一部 `ng` が `ok` に該当し `ng` に該当しない | 同上（fixture の `mixed`。`ok` の期待集合に含み、`ng` の期待集合に含まない） |
| 3 | セットプレイ 0 件が 3 値のどれにも該当しない | `TestRepository_List_SetupResult_ComboWithoutSetupMatchesNone`（3 値 × 軸あり／なしの 6 通り。**絞り込み無しなら返ることも固定**＝「そもそも存在しない」ではないことの担保） |
| 4 | 軸 4 通り | `TestRepository_List_SetupResult_AxesIndependent`（`tech_type` のみ／`in_corner` のみ／両方／どちらも不問 ＋ **逆側の軸**の 2 通り＝計 6 サブテスト）／**セル単位化（B）に伴い 3 本を追加**——`AxisAllIsUnionForNG`（観測された形＝セルによって答えが違うコンボが `ng` の「全て」に出る）／`UnverifiedMeansSomeCellUnrecorded`（`unverified`＝埋め残しがある）／**`AxisIsMonotone`（3 値 × 軸 8 通りで「個別指定 ⊆ 全て」を機械的に固定）** |
| 5 | 成立状態が未指定なら軸を指定しても絞り込まれない | `TestRepository_List_SetupResult_AxesWithoutStateDoNotFilter`（3 通りとも全件一致） |
| 6 | API 層で不正値が 400 | `TestHandler_List_400_InvalidSetupResultFilters`（4 ケース。**サービスが呼ばれないことも固定**）／正常系は `TestHandler_List_SetupResultFilters_Parsed` |
| 7 | 既存のフィルタが不変 | `TestRepository_List_SetupResult_ExistingFiltersUnchanged`（絞り込み無し・`position` の該当／非該当・`is_draft` の両値・`character_id`）／`TestHandler_List_SetupResultFilters_AbsentAreNil`（未指定なら 3 項目とも nil） |
| 8 | FE のフィルタ追加・クリア・保持 | `useComboListFilters.test.tsx`（URL 復元・値域外は未指定扱い・round-trip・`hasActiveFilters` とクリア・セッション保持）／`ComboListFilters.test.tsx`（3 状態の選択肢・onFilterChange・軸の `disabled`・正典ラベル・列を足していないこと） |
| 9 | 論理削除コンボが `IncludeDeleted` / `OnlyDeleted` に従う | `TestRepository_List_SetupResult_RespectsDeletedComboFlags`（既定／`IncludeDeleted`／`OnlyDeleted` の 3 通り） |
| 10 | E2E 非回帰 | 新規 spec は作らず、既存スイートを実行（結果は §9） |

**追加**: `TestRepository_List_SetupResult_SoftDeletedSetupExcluded`（論理削除された `setups` が 3 値のどれにも出ないこと）／`TestRepository_List_SetupResult_UnknownStateMatchesNothing`（値域外）。

**★セル単位化（B）の際、既存 11 本は 1 行も変えずに green だった。** これは「**軸を両方指定したときの結果は変更前と完全に一致する**」ことの機械的な担保になっている（既存テストはいずれも軸を両方指定するか `ok` を使っており、B で挙動が変わる範囲に入らない）。**変わったのは `ng` と `unverified` の「軸に不問を含む場合」だけである。**

---

## 9. E2E 非回帰の実行結果

**結果: 70 passed / 0 failed（1.4 分）。新規 spec は作っていない（非回帰のみ）。**

### ★1 回目の実行が 34 failed になった件（**本サブとは無関係**・切り分け済み）

**症状**: 1 回目の `pnpm e2e` は 36 passed / 34 failed。落ちた spec は `character-default` / `combo-crud` / `m12-*` / `m14-03d/e` / `m15-*` / `m17-*` と広範で、通ったのは `m18-*` / `m19-*` 系が中心だった。

**原因**: **コンテナ初回起動で `config.toml` が未初期化**だったこと。落ちた spec のページスナップショットが軒並み **「初期設定 / ようこそ」**（初回セットアップウィザード）で止まっており、目的の画面へ到達していなかった。**`config.toml` は `.gitignore:72` で管理外のため、fresh clone には存在しない。** `initialize()`（`GET /api/config` → `isInitialized` が false なら `PUT /api/config`）を持つのは `m18-*` / `m19-*` 系の spec だけで、それらは自力で初期化するため通っていた。

**切り分け**: 1 回目の実行中に `m18-*` / `m19-*` 系の spec が `PUT /api/config` で初期化を書き込んだ後、**落ちていた spec 群（`character-default` / `combo-crud` / `m15-02` / `m12-06`）だけを再実行したところ 7/7 green**。続けて全数を再実行して **70/70 green** を得た。

**⇒ 本サブの diff とは無関係の環境要因である。** 本サブが触ったのは一覧のフィルタのみで、初回セットアップウィザードの表示条件には関与しない。

**★申し送り**: **fresh clone での 1 回目の E2E は、初期化の有無で結果が変わる。** 落ちた spec 名だけを見て回帰と読むと誤る。`config.toml` が無い環境では、**`initialize()` を持たない spec が初回に落ちる**。（既知の関連課題として、progress-log 2026-08-08 の「E2E 実行が `config.toml` に E2E 設定を焼き付ける」も参照。本件はその裏返しで、**焼き付けが起きる前は初期化されていない**。）

---

## 10. 変更ファイル一覧

| ファイル | 変更 |
|---|---|
| `internal/model/setup.go` | `SetupResultUnverified` / `IsValidSetupResultFilterValue` を追加 |
| `internal/repository/combo/repository.go` | `ListFilter` に 3 フィールド／`setupResultWhere` を新設／`List` の WHERE に 1 ブロック |
| `internal/api/combo/handler.go` | `List` にクエリ 3 本の解析と 400 |
| `internal/repository/combo/list_setup_result_test.go` | **新設**（リポジトリ層テスト） |
| `internal/api/combo/handler_test.go` | ハンドラテスト 3 本を追加 |
| `web/src/features/combo/hooks/useComboListFilters.ts` | state 3 項目・URL 往復・値域ガード・`hasActiveFilters` |
| `web/src/features/combo/api.ts` | `ComboListFilter` 3 項目・`buildQuery` |
| `web/src/pages/ComboListPage.tsx` | `apiFilter` の組み立て |
| `web/src/features/combo/components/ComboListFilters.tsx` | native select 3 つ |
| `web/src/locales/ja.json` / `en.json` | フィールド見出し 3 キー（両ロケール） |
| 各 `*.test.tsx` | FE テスト |
| `docs/progress/progress-log.md` / `docs/progress/m19-06-completion-report.md` / `docs/handover/design-reports/20260809-m19-06-design-exceptions.md` | ドキュメント |

**`web/src/constants/` は変更していない**（既存の `setup-result.ts` / `oki.ts` をそのまま再利用＝第 3 の語彙を作らない）。**`ColumnVisibility` にも触っていない。**

---

*以上、M19-06 完了報告。*
