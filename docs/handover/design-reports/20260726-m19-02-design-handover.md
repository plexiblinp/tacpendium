# M19-02 → 設計担当 設計伝達レポート(セットプレイ提案テコ入れ)

| 項目 | 内容 |
|------|------|
| 対象 | Web 版設計担当 Claude(フェーズ3 継続担当) |
| 発信 | 製造担当 Claude Code / 2026-07-26(2026-07-27 更新：gap 定義の是正・「汚連携」改称を反映) |
| 対象指示書 | `docs/instructions/M19-02-suggestion-refinement.md` **v1.1.2** |
| 実装コミット | ブランチ `claude/m19-02-suggestion-refinement-x0mg0n`(**push 済・全 12 コミット `fc0426f`〜`be021d4`**)。内訳：M19-02 本体(`fc0426f`〜`1cb708e`)＋`n_max`(§1-6・CHANGE-086 範囲外)＋**gap 定義の 2 段是正**(`146d848` 第1active前→`0b56bfb` 完全空振り。§1-7)＋**gap 日本語名を「汚連携」へ改称**(`be021d4`・§1-8) |
| 関連 | 完了報告 `docs/progress/M19-02-report.md` / レビュー報告 `docs/progress/m19-02-review.md`(合格・重大ゼロ) / **CHANGE-086 通知書 v5**(`docs/change-notes/CHANGE-086-notification.md`) |
| 位置づけ | 製造は DES 本体を直接編集しない(CLAUDE.md §8)。本レポートは差分主義=**指示書・CHANGE-086 に既記の内容は割愛**し、①独自確定仕様 ②製造判断 ③残課題に絞る |

本サブは **CHANGE-086 が反映先(DES-002 §4.2・DES-005 §5.6 項目12・DES-006)と反映項目(filler 規則・負 KA・mode/g/limit/totalFound/reason)を既に指定済み**である。そのため本レポートは「何を反映するか」ではなく、**CHANGE-086 が意図的に数値を固定していない(§4.15)ために実装で確定した『実測値・厳密セマンティクス』**と、**設計担当が未把握の残課題**に集中する。

> **最重要は §1-1(打ち切り定数の実測値)・§1-2(`truncated` セマンティクスの狭義化=既存フィールドの意味変更)・§3-1(gap 全種別で maxLimit 頭打ち)**。

---

## ★ 手動反映チェックリスト(先に結論)

| # | 反映先 | 内容(CHANGE-086 反映時に数値・挙動を確定させるべき点) | 本レポート節 |
|---|--------|------|------------|
| 1 | **DES-002 §4.2** | `limit` の**既定 200・上限 3000・超過丸め**、`totalFound` の定義(ランキング対象総解数)、`engineSafetyCap`(=安全上限・実装値 6000)の位置づけ | §1-1 |
| 2 | **DES-002 §4.2** | **`truncated` の意味を「安全上限到達」に狭義化**(M19-01 の「MaxResults 到達等」から意味が変わった)。`limit` 切りは `truncated` にしない | §1-2 |
| 3 | **DES-002 §4.2** | mode/g_min/g_max/limit の**既定・丸め規則の全量**、`reason` の文字列値、gap の `sort=n`=G 昇順、gap で `n>active`・meaty で `g=0` | §1-3 |
| ★ | **指示書 M19-02 §4.4 の訂正依頼** | **gap は完全空振り＝「target の最終 active が起き上がりの G フレーム前」が正**(開発者確認 2026-07-26)。指示書の `S=KA+1+G`／`G=1−N`／帯 `[1−Gmax,1−Gmin]` は誤り。正: `G=N−active`／帯 `[active+Gmin,active+Gmax]`。**コードは是正済み・単一コミットで revert 可**、指示書・設計反映を要訂正 | §1-7 |
| 4 | **DES-005 §5.6 項目12**(＋DES-003 §3.3) | **明示 `target_move_id` 指定時も `category=system` を BE で除外**(多層防御・§4.6-2)。M19-01 は FE ピッカーのみ除外だった | §1-4 |
| 5 | **DES-005 §5.6 項目12** | 制約告知の**確定 9 点**と **#3 の全面改稿**(旧「派生技・ラッシュ版・状態変種は対象外」を除去)。追加 i18n キー 5 種 | §1-5 |
| 6 | **DES-002 §4.2＋DES-005 §5.6 項目12** | **【CHANGE-086 範囲外・開発者追加要望】`n_max`(N の上限・meaty のみ)**。持続の長い技(波動拳等)で深い N を切り落とし候補を絞る。要 CHANGE への追補 or 新規起票 | §1-6 |
| 7 | **DES-005 §5.6 項目12** | **gap モードの日本語表示名を「汚連携」に確定**(開発者要望 2026-07-27。日本語圏の一般呼称)。英語は `Deliberate gap` のまま。DES-005 の UI 文言に反映 | §1-8 |

#1〜#5 は **CHANGE-086(DES-002＋DES-005＋DES-006)の実装後反映に折り込む**もの。**#6(`n_max`)のみ CHANGE-086 の範囲外**(実装後に開発者が「候補が多すぎてテストしづらい/波動拳の弾持続が主因」として追加要望・2026-07-26)。マイグレ・スキーマ変更は**ゼロ**(既存 `category` 条件追加＋API パラメータ追加のみ)。

---

## 1. 製造が独自に確定した実装仕様(DES 反映が要るもの)

### 1-1.【最重要】打ち切り定数を実測で確定(CHANGE-086 は数値を固定していない=§4.15)
CHANGE-086 §2-h は「安全上限まで列挙 → ランキング → 上位を返す」「`totalFound`・`limit` を追加」とのみ規定し、**具体値は実装の実測に委ねている**。§3.3-1 の使い捨て測定(engineSafetyCap 無効化で全列挙)で以下を確定した。

| キャラ | KA | meaty(既定3種別) | meaty(全種別) | gap(既定3種別) | gap(全種別) |
|--------|----|-----------------:|--------------:|---------------:|------------:|
| juri(最大) | 40 | **323** | **677** | **2875** | **4884** |
| ryu | 40 | 191 | 388 | 1531 | 2656 |

- 応答時間: 最大 **juri gap 全種別 = 25.6ms**(4884 件)。**NFR001(100ms)に十分収まる**。
- 確定した定数(`internal/service/setplay/service.go:29-45`):

| 定数 | 実装値 | 根拠 |
|------|-------:|------|
| `engineSafetyCap`(1 target あたり全列挙の安全上限) | **6000** | 集計 TotalFound 最大 4884 が多数 target へ分散するため 1 target あたりはさらに小。実データ非発火の後段防御。到達時のみ `truncated` |
| `defaultLimit`(返却既定) | **200** | 指示書 §11-2 暫定案。meaty 既定種別(最大 323)は 2 ページ目で全件到達 |
| `maxLimit`(返却上限・超過丸め) | **3000** | meaty 全種別(677)・gap 既定種別(2875)を包含 |
| 「さらに表示」増分(FE) | **200** | 指示書 §11-2 暫定案 |

- ⇒ **DES-002 §4.2 に `limit` の既定/上限/丸め、`totalFound` の定義、安全上限の位置づけを明文化**してほしい(実装が一次源。ryu KA40 既定が M19-01 as-built の 210 → **191** に減ったのは filler 是正で `target_combo` を除外した結果=R-D の 9.0% と整合)。

### 1-2.【最重要】`truncated` のセマンティクスが狭義化した(既存フィールドの意味変更)
M19-01 の `truncated` は「`MaxResults` 到達**等**で打ち切ったか」(`dto.go` コメント)だった。本サブで **`truncated` = 「エンジンが安全上限 `engineSafetyCap` に到達し数え切れていない」ときのみ true** に**狭義化**した。`limit` で切っただけの状態は `truncated=false`(件数の乖離は `totalFound > len(items)` で表現)。

- 型・フィールド名は不変=**後方互換だが意味が変わった**。UI もこれに追従(安全上限時のみ「条件を絞ってください」を表示、`limit` 切りとは区別)。
- 実測上、実データでは `engineSafetyCap` に到達しないため **`truncated` は実質的に病的入力専用**になった。
- 根拠: `service.go:308-323`、`SetplaySuggestionSection.test.tsx`(truncated と limit 切りの区別テスト)。
- ⇒ **DES-002 §4.2 の `truncated` 説明を「安全上限到達に限定」へ補正**してほしい(M19-01 の「MaxResults 到達等」からの意味変更を明記)。

### 1-3. mode/g/limit/reason の**厳密な既定・丸め規則**(CHANGE-086 は項目のみ列挙)
CHANGE-086 §2-b/-g/-h は `mode`/`g_min`/`g_max`/`g`/`limit`/`totalFound`/`reason` の**存在**を規定するが、既定値・丸め・境界挙動は実装で確定した(`handler.go`・`service.go`)。

| param | 値 | 既定 | 丸め・境界 |
|-------|----|------|-----------|
| `mode` | `meaty` \| `gap` | `meaty` | 未知値は **400**(`invalid_query_parameter`) |
| `g_min` | int | 1 | `<1 → 1`(gap のみ有効。meaty では無視) |
| `g_max` | int | 13 | `>13 または未指定 → 13`。`g_min>g_max → 空結果`(エラーにしない) |
| `limit` | int | 200 | `≤0 → 200`・`>3000 → 3000`(エラーにしない) |

- **`reason` の文字列値 = `knockdown_advantage_negative`**(負 KA・200。NULL の 400 `knockdown_advantage_required` とは別コード)。`items` は空配列。
- **gap の `sort=n` = G 昇順(隙間が小さい順)**。**【訂正後・§1-7】`G = N − active`** は target ごとに active が異なるため、`rank()` は N ではなく **`Proposal.G` を直接比較**して昇順にする(gap 分岐。meaty は N 降順のまま)。`sort=target` は target code が第 1 キーで共通。
- **DTO の `n` の型・意味は不変**。**【訂正後】gap では `n > active`**(技を丸ごと空振り＝完全に重ねない)。`g` は gap で **`n − active`**、**meaty では常に 0**。
- ⇒ **DES-002 §4.2 に上記の既定・丸め・境界と `reason` 文字列・gap ソート(G 昇順)を明記**してほしい。**gap の定義は「起き上がりの G フレーム前に完全空振り」(下記 §1-7 の訂正を反映)**。

### 1-4. 明示 `target_move_id` 指定時も `category=system` を **BE で除外**(多層防御・§4.6-2)
M19-01 as-built では `system` 除外は **FE ピッカーのみ**(BE は明示指定を種別/damage/is_derived/is_aerial ごとバイパスしていた=M19-01 レポート §1-3 の裏返し)。本サブで **BE 側の明示指定分岐にも `category=system` 除外を追加**した(`service.go:369-377`、`TestRefine_ExplicitTargetExcludesSystem`)。バイパスするのは種別・ダメージ・派生・空中であり、**`system` はバイパスしない**。
- ⇒ **DES-005 §5.6 項目12「`category=system` は常に対象外」に「明示指定でも BE で除外(多層防御)」を補足**してほしい。

### 1-5. 制約告知の確定 9 点＋#3 全面改稿＋追加 i18n キー
CHANGE-086 §2-d は「文面追従」とのみ規定。実装で確定した告知内容は以下(`SetplayLimitationNotice.tsx`・`locales/{ja,en}.json`)。

- **既存 4＋追加 5=9 点**: (追加) ⑤つなぎに状態前提技が混じり得る / ⑥弱攻撃の連続キャンセル未考慮 / ⑦有利フレームがマイナスのコンボは提案不可 / ⑧「汚連携」は相手依存(§1-8 で改称) / ⑨候補が多い場合は上位のみ表示。
- **#3(対象外リスト)を全面改稿**: 有利フレーム未入力/**マイナス**/active 未入力/空中技/**OFF 種別(special・throw・normal_rush・unique_rush)**/ダメージ0/**派生技(target_combo)はつなぎに使わない**を列挙。**旧「派生技・ラッシュ版・状態変種は対象外」記述を除去**(rush は種別で選択可・状態変種は filler に含まれるため。否定形確認 §5.6-6 で 0 件確認済み)。
- 追加 i18n キー(ja/en parity): `setplay.modeLabel/modeMeaty/modeGap/gapRangeLabel/gapMinLabel/gapMaxLabel/gapAfterWakeup/negativeKnockdown/countLabel/showMore`、`setplay.limitations.{stateFiller,weakChain,negativeKnockdown,gapDependsOpponent,topOnly}`。
- ⇒ **DES-005 §5.6 項目12 の制約告知仕様に確定 9 点と #3 改稿を反映**してほしい。

### 1-6.【CHANGE-086 範囲外・開発者追加要望】`n_max`(最大持続)で候補を絞る
実装後の実データ確認で開発者が「**候補が多すぎてテストしづらい。増える主因は波動拳のように画面に残る弾の存在時間を全て持続として扱っている技**」と判断し、**meaty モードに N の上限 `n_max` を足す**要望を出した(2026-07-26)。既に構築済みの受理帯機構(§1-3 の `Band`)の**自然な拡張**として実装。
- **API**: `GET …/setplay-suggestions?n_max=5`(任意・整数・meaty のみ・gap では無視)。0/未指定=上限なし(既定挙動不変)。
- **セマンティクス**: meaty の受理帯を **`[max(1,n_min), min(target.active, n_max)]`** に絞る(`meatyBand()`・`service.go`)。**下限(=n_min)・budgetMax の起点・恒等式(`N=KA+2−S`・着弾=`KA+1`)は不変**=返る解は「従来解集合を `N≤n_max` で絞った部分集合」。`n_max<n_min` は空結果(エラーにしない)。
- **性能**: 受理帯を狭めるのみ=探索空間は必ず同等か縮小。遅くなる余地なし。
- **UI**: meaty 時に「最小持続/最大持続」の 2 枠(`setplay-n-max`)。`n_max<n_min` のとき押す前に注記表示(`setplay-n-max-hint`)。gap 時は非表示。
- **テスト**: Go 4 件(`TestRefine_NMax*`)・Vitest 2 件(入力反映・注記)・E2E シナリオ E(候補件数が減る)。golden 4/4 維持。
- ⇒ **DES-002 §4.2 に `n_max`(meaty の N 上限・丸め・gap 無視)を追記**。DES-005 §5.6 項目12 に「最大持続」UI を追記。**CHANGE-086 への追補 or 別 CHANGE 起票を設計担当・開発者判断で**(§5)。

### 1-7.【指示書訂正依頼＋ロールバック体制】gap は「完全空振り＝最終 active が起き上がりの G フレーム前」が正
指示書 §4.4.1 は gap(あえて重ねない)を「起き上がり後に隙間を作る」＝**G ＝ 第 1 active が起き上がり(KA+1)の何フレーム“後”か**と定義していた(`S=KA+1+G`・`G=1−N`・帯 `[1−Gmax,1−Gmin]`)。**開発者確認(2026-07-26・最終)で意味が確定**：当てる意図のセットプレイは meaty(重ねる)で実現済みなので、gap は**「当てない」専用＝技を丸ごと空振りさせる**。すなわち **target の“最終” active が起き上がりの G フレーム前に出る**(完全空振り)。
- **正しい定義**: 最終 active `= (KA+1) − G`、最終 active `= S + active − 1`、`N = KA+2 − S` ⟹ **`G = N − active`**。受理帯 **`[active + Gmin, active + Gmax]`**(Gmin=1,Gmax=13。**per-target＝active に依存**)。`G≥1` で最終 active ≤ KA(起き上がり前)＝**完全空振り**、`N > active` ゆえ **meaty(`N ≤ active`)と完全に排他**。
- **コードは是正済み**: `gapBand(gMin,gMax,active)` を `[active+Gmin, active+Gmax]` に、`buildProposal` の `g = N − active` に、`rank` の gap 第 1 キーを **`Proposal.G` 昇順**(target ごとに active が異なるため N ではなく G を直接比較)に、UI 文言を `setplay.gapBeforeWakeup`「起き上がりの{g}F前に空振り(重ねない)」に変更(ja/en)。**meaty 経路は一切不変**(既存エンジン 28・golden 4/4・meaty グルーテストが無改修 PASS)。テスト(engine/glue/Vitest/E2E)も追従。
- ⇒ **指示書 M19-02 §4.4.1〜§4.4.3 の “後(G=1−N・S=KA+1+G・帯 [1−Gmax,1−Gmin])” を “完全空振り(G=N−active・S=KA+2−G−active・帯 [active+Gmin,active+Gmax])” へ訂正**してほしい。DES-002 §4.2・DES-005 §5.6 項目12(gap UI 文言)も同様。**恒等式 `N=KA+2−S`・着弾=`KA+1`・「受理帯の定数差し替えのみ(探索構造不変)」は変わらない**。
- **★ロールバック体制(開発者要望)**: gap 定義は実機フィードバックで覆る可能性があるため、**この是正を単一コミットに隔離**し、`git revert <gap 是正コミット>` で直前状態へ戻せる。gap 定義の実装点はすべて **`grep -rn "M19-02-GAP-DEF" internal/`** で一覧できる(`gapBand`／`gapBand` 呼び出し／`buildProposal` の `g`／`rank` の gap 分岐)。定義を変える場合はこの 4 点＋i18n `gapBeforeWakeup`＋関連テストのみを触ればよい(meaty には波及しない)。

### 1-8. gap モードの日本語表示名を「汚連携」に確定(開発者要望 2026-07-27)
UI のモード切替ラベル(ja)を **「あえて重ねない」→「汚連携」** に改称(日本語圏で一般的な呼称)。**英語は `Deliberate gap` のまま**(開発者が英語呼称は不問とし現状維持を指示)。制約告知の参照文言(`setplay.limitations.gapDependsOpponent`)も「汚連携」に統一。実体：`web/src/locales/ja.json`(`setplay.modeGap`)。**BE の機能・API・`mode=gap` の値は不変**(表示名のみ)。
- ⇒ **DES-005 §5.6 項目12 の gap UI 文言を「汚連携(ja)/Deliberate gap(en)」に反映**してほしい。

---

## 2. 製造の判断

### 2-1. 開発者へ確認して確定した点
**本サブは開発者との対話なしの自律実行**のため、セッション中の新規確定はなし。判断の拠り所は指示書 §9.2(推測許容)・§11(暫定案)・CHANGE-086。**下記 §2-2 と §3-3 は開発者の追認余地がある**。

### 2-2. 推測で進めた点(指示書 §9.2 の推測許容・§11 暫定案に基づく・明示)
- **受理帯一般化の実装形**: `Options.Band *NBand{Lo,Hi}` を追加し **`Band==nil` を meaty `[NMin, Active]` に写像**(既存エンジンテストを無改修で通すため。`Hi=0` は gap の正当値=Gmin=1 のため 0 を sentinel にせずポインタ nil で meaty 判定)。`setplay.go`。
- **gap `sort=n`=G 昇順**(指示書 §11-1 暫定案)。**【訂正後・§1-7】`G=N−active`** のため `rank()` は `Proposal.G` を直接比較して昇順(meaty は N 降順のまま)。
- **`limit` 既定/増分 200/200・上限 3000**(指示書 §11-2 暫定案＋§1-1 実測)。
- **命名**: `knockdown_advantage_negative`(既存 `_required` に整合)、`engineSafetyCap`/`defaultLimit`/`maxLimit`、i18n キー(§1-5)。負 KA 文言は**開発者確定表現をそのまま**使用。
- **filler 除外の集約先**: 指示書 §4.1 は repository 修正を例示するが「一箇所に集約」を許容。**service 層 1 箇所**(`service.go`)に集約し repository は SELECT のみ(二重実装回避)。

---

## 3. 設計担当が未把握の残課題・申し送り

| # | 課題 | 扱い |
|---|------|------|
| 3-1 | **gap 全種別で `maxLimit(3000) < 最大 totalFound(4884)`** | gap＋全 7 種別＋高 KA の稀な組合せで、3000 件で「さらに表示」が消え、`truncated`(安全上限)にも非該当のため残件への注記が出ない(件数ラベルは「全4884件中3000件」で乖離は可視)。**設計意図(ランキング後に切る=隠れるのは価値の低い分)としては妥当**。through target 解禁(M19-04)で件数が更に増えるため、**その実装サブで残件導線を併せて再検討**するのが自然(レビュー低指摘 2) |
| 3-2 | **`alreadyAdopted` の dup 判定が返却件数ぶんの逐次クエリ** | 要件「返却分に限定」は充足(打ち切り前全件 210〜459 → ≤limit・既定 200)。ただし `limit=3000` まで表示すると最大 3000 回の逐次 `FindDuplicateInCombo`。将来スケール時は IN 句バッチ化の余地(レビュー低指摘 1) |
| 3-3 | **開発者確認事項が暫定案のまま(指示書 §11)** | ① gap `sort=n`=G 昇順で確定してよいか(実戦的最適点=特定の隙間幅があれば第1キー差し替え) ② `limit` 既定/増分 200/200 でよいか。**いずれも暫定案で実装済み**。開発者の追認を得たい |
| 3-4 | **§4.1 filler 規則は `M19-DESIGN-05`((i)+(j))未反映の暫定** | `target_combo` 除外は「`total` の意味が判別不能」を根拠とするため、(j) で判別可能になれば**除外を解除できる**(候補集合の緩和=本サブの誤りではない)。指示書 §10-4 の突合ゲート(区分1〜3)で扱う。through target・GC-2・golden 5/5 は **M19-04 へ移管**(CHANGE-086 v5) |
| 3-5 | **負 KA コンボの実データ不在** | seed に負 KA コンボは 0 件(combos はユーザーデータ)。分岐は Go テスト(`newCombo(ptr(-5))`)・E2E(`knockdown_advantage:-5`)で到達確認済み。実運用での到達は利用者入力次第 |

---

## 4. 参考(触れていない=不変の証跡)

- **マイグレ 0・新テーブル/新列 0**(`migrations/` は 000041 が最新のまま。`000042` 非消費)。**go.mod / package.json 不変**(依存追加なし)。
- **受理帯の恒等式不変**: `N=KA+2−S`・着弾=`KA+1`・**`G=N−active`(訂正後・§1-7)**。等値条件(`==KA`)へ戻していない(否定形確認 §5.6-4 で 0 件)。
- **meaty モード完全不変**: 既存エンジンテスト(移植 18＋窓化 10)は**削除・修正ゼロ**(git diff で削除行 0)。**golden-case 4/4**(GC-1/3/4/5・実フレーム値)。GC-2 は through target 待ちで対象外(M19-04)。
- **M19-01 delivered 契約・既存 FR011 非破壊**: 種別既定値・damage>0 既定・`sort=n|target`・N 併記・S 非表示・採用/不採用・`selectedIds` 非入口・非永続・制約告知の初回のみ表示。`SetupCandidateList`・setup CRUD シグネチャ不変。採用ダイアログ**未改修**(成立条件の記録は M19-03)。
- **別リポ `autopilot-combomgr/projects/setplay-suggestion` 不変**(移植元 read-only)。
- **DTO 追加は後方互換のみ**: `SuggestionDTO` に `mode`/`g`、`SuggestionsResponse` に `totalFound`/`reason`(既存フィールドの型・意味不変)。
- **E2E**: M19-02 **A/B/C/D/E 5 件 PASS**(A は全種別 ON で候補 >200 の実データ操作・E は `n_max` で総数が減ることを実データ検証)・M19-01 A/B/C 3 件 PASS(非回帰)。**独立レビュー重大 0 件**。
- `M19-LIMITATION-NOTICE` マーカー **6→9**(service.go に (e)負KA・(f)gap・(g)打ち切り を追加、(b)(c)(d) 維持)・ファイル 4→4=**減少なし**。

---

## 5. CHANGE 起票のたたき台(設計担当向けチェックリスト)

> **CHANGE-086 は起票済み(v5)**。本サブは実装完了したため、**CHANGE-086 の実装後反映(DES-002／DES-005／DES-006＋change-report-086＋registry)を確定する段階**。下記は反映時に §1 の as-built 値を織り込むためのチェックリスト。番号は起票済み 086 を使用。

- [ ] **DES-002 §4.2**: `limit`(既定200/上限3000/丸め)・`totalFound` 定義・安全上限(§1-1)/ **`truncated` を安全上限到達に狭義化**(§1-2)/ mode・g_min・g_max・reason 文字列・gap `sort=n`=G 昇順・gap で `n>active`/meaty で `g=0`(§1-3)/ **gap の定義を「完全空振り(G=N−active・帯 [active+Gmin,active+Gmax])」へ訂正**(§1-7)。
- [ ] **DES-005 §5.6 項目12**: 明示指定でも BE で `system` 除外(§1-4)/ 制約告知 確定 9 点・#3 改稿(§1-5)/ モード切替・G 範囲・件数・「さらに表示」・負 KA 文言・`truncated` と `limit` 切りの区別。
- [ ] **DES-002 §4.2＋DES-005 §5.6 項目12**: **`n_max`(最大持続・meaty のみ・丸め・gap 無視)＋「最小/最大持続」UI**(§1-6)。**CHANGE-086 の範囲外**のため、**CHANGE-086 への追補として含めるか別 CHANGE を起票するかを設計担当・開発者判断で**(実装は完了・push 済)。
- [ ] **DES-006**: 負 KA を 200＋理由コードで扱う(不正値ではない=VAL-C10)明記(CHANGE-086 §2-e 既記)。
- [ ] **M19-overview / model-allocation**: M19-02 使用モデル実績(Opus 4.8)・through target/GC-2 の **M19-04 移管**を反映(CHANGE-086 v5 既記)。
- [ ] **申し送り(§3)を M19-04 起票時の入力に**: gap 頭打ち残件導線(3-1)・alreadyAdopted バッチ化(3-2)・§11 暫定の開発者追認(3-3)・(j) 突合ゲートによる filler 規則緩和(3-4)。

---

*以上。実装は `claude/m19-02-suggestion-refinement-x0mg0n`(**push 済**。M19-02 本体＋`n_max` 追加＋本レポート)。Web 版側で Sync now 後に GitHub 直読可能。*
