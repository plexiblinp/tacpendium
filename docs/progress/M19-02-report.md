# M19-02 完了報告書（セットプレイ自動提案のテコ入れ）

| 項目 | 内容 |
|------|------|
| 版 | **v1.1.0**（2026-07-27 改訂。改訂履歴は下記） |
| 指示書 | `docs/instructions/M19-02-suggestion-refinement.md` **v1.2.0**（gap 定義の訂正版。本ブランチのファイルは v1.1.2 のまま＝中央が同期予定） |
| CHANGE | **CHANGE-086 v5**（中央払い出し済み・マイグレ非消費。通知書 `docs/change-notes/CHANGE-086-notification.md` 現物は v5） |
| 使用モデル | Opus 4.8 |
| 実施日 | **2026-07-26 着手／2026-07-27 gap 定義の是正・`n_max` 追加・「汚連携」改称** |
| ブランチ | `claude/m19-02-suggestion-refinement-x0mg0n` |

製造担当は **DES 本体を編集していない**（中央が三点セットで反映）。**マイグレ連番 `000042` を消費していない**（スキーマ非変更）。

## 改訂履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| v1.0.0 | 2026-07-26 | 初版（gap 定義是正前）。指示書 v1.1.2・CHANGE-086 v4 準拠。 |
| **v1.1.0** | **2026-07-27** | **一次受けの条件付き受理（2 点）を解消**：①gap 定義の是正（「起き上がり後・`G=1−N`」→「完全空振り・`G=N−active`・帯 `[active+Gmin,active+Gmax]`」）を §2/§3/§5/§8 の 5 箇所へ反映。②レビュー未通過の後乗せ 3 群（`n_max` 新設・gap 定義の 2 段是正・「汚連携」改称）の差分レビュー結果（§11）と記載追加（§2.n_max・§10 確定化）。指示書 v1.2.0・CHANGE-086 v5 へ追従。**コードは是正済みが正／報告書を追従させた**（コードは戻していない）。 |

> **重要**: 本改訂は**報告書を as-built（正しいコード）に合わせた**ものであり、コードを旧報告書に合わせて戻したものではない。gap の正＝現在のコード（`gapBand()` が `[active+Gmin, active+Gmax]`・`g=N−active`・`rank` が `Proposal.G` を直接比較・i18n `gapBeforeWakeup`）。

---

## 1. Plan Mode 実査結果（§3.3 の 5 項目）

| # | 項目 | 実測結果 |
|---|------|---------|
| 3.3-1 | 提案総数の分布（meaty） | 実測（filler 是正後）。下表参照 |
| 3.3-1 | 提案総数の分布（gap） | 実測。下表参照 |
| 3.3-2 | M18-03 突合（E-14） | **M18-03a（punish-mylist）は未実装**（設計 outline のみ・punish mylist コンポーネント不在・`ComboDetailPage.tsx` の最終更新は M19-01）。本サブ対象ファイル（`web/src/features/setplay/*`・`ComboDetailPage.tsx`）と**重複なし**。相乗り面の再設計・要素移動は行っていない |
| 3.3-3 | `category` 実値域と `target_combo` 実件数 | 値域＝normal/special/unique/super_art/critical_art/throw/system/**target_combo**/rush_variant/drive_impact。`target_combo` = **67 行**（`total≥1` が **64 行**）＝除外は空振りしない |
| 3.3-4 | `M19-LIMITATION-NOTICE` 現在地 | 実装前 **6 箇所**（`service.go:185/204/275`・`ja.json:424`・`en.json:424`・`SetplayLimitationNotice.tsx:14`）。§5 参照 |
| 3.3-5 | 負 KA コンボの実在 | 0 件（combos はユーザーデータ・未 seed）。テストは Go で `newCombo(ptr(-5))`、E2E は `knockdown_advantage:-5` のコンボを作成（VAL-C10 が保存を許容） |

### 1.1 提案総数の分布・応答時間（§3.3-1／使い捨て測定・engineSafetyCap を無効化して全列挙）

`character_data/*.csv` の実フレーム値を service 経由（filler 収集・target 列挙・エンジンを込み）で計測。

| キャラ | KA | meaty(既定3種別) | meaty(全種別) | gap(既定3種別) | gap(全種別) |
|--------|----|-----------------:|--------------:|---------------:|------------:|
| ryu    | 40 | 191 | 388 | 1531 | 2656 |
| ryu    | 27 | 38  | 75  | 373  | 639  |
| juri   | 40 | **323** | **677** | **2875** | **4884** |
| guile  | 34 | 248 | 371 | 2113 | 3116 |
| terry  | 27 | 21  | 52  | 277  | 509  |
| ken    | 40 | 150 | 411 | 1465 | 2814 |
| luke   | 40 | 94  | 180 | 852  | 1377 |
| zangief| 40 | 103 | 238 | 727  | 1728 |

- 応答時間（`SuggestForCombo` 実測）: 最大は **juri gap 全種別 = 25.6ms**（4884 件）。meaty は概ね 1〜4ms。**NFR001（100ms 目標）に対し十分な余裕**。
- 参考: audit（M19-audit-20260725）の Ryu KA40 既定=210 に対し本測定は **191**。差の 19 件は **filler 規則の是正で `target_combo` fillers を除外した結果**（R-D の 9.0% と整合。是正が効いていることの裏取り）。
- **【v1.1.0 注記】gap 列の件数は初期 gap 実装（第 1 active 基準）時点の測定値**。最終確定の**完全空振り（`G=N−active`・帯 `[active+Gmin,active+Gmax]`）**でも帯幅は 13 で同等のため**件数は同オーダー・応答時間も同水準**であり、これに基づく定数（`engineSafetyCap=6000`／`maxLimit=3000`）は余裕を持って妥当（再測定しても結論は不変）。**meaty 列は meaty 非改変のため影響なし**。厳密な whiff 定義下の gap 分布が必要な場合は再測定可能。

### 1.2 打ち切り定数の決定（実測根拠・§7.2）

| 定数 | 値 | 根拠 |
|------|----|------|
| `engineSafetyCap`（エンジン 1 target あたりの安全上限） | **6000** | 集計 TotalFound 最大でも 4884（多数 target へ分散するため 1 target あたりはさらに小）。実データでは発火しない病的入力向けの後段防御。到達時のみ `truncated=true` |
| `defaultLimit`（返却既定） | **200** | §11-2 暫定案（現行表示件数と同じ）。meaty 既定種別（最大 323）でも 2 ページ目で全件到達 |
| `maxLimit`（返却上限） | **3000** | meaty 全種別最大 677・gap 既定種別最大 2875 を包含。既定運用（meaty・gap 既定種別）は全件到達可能。全種別 gap の 4884 は上位優先表示（ランキング後に切るため隠れるのは価値の低い分＝§4.3 設計意図） |
| 「さらに表示」増分（FE） | **200** | §11-2 暫定案 |

**§9.3 判断**: gap は最大 4884 件と meaty より大きいが、**応答時間は 25ms と NFR001 に十分収まる**ため、`G` の既定範囲（1〜13・開発者確定）は狭めず暫定案どおり実装した。全種別 gap のみ maxLimit(3000) を超えるが、上位ランキング表示で設計意図を満たす。**`G` 範囲を実装都合で変えていない**（§9.1-6）。

---

## 2. 変更点

### バックエンド
- `internal/service/setplay/setplay.go`: 受理帯を `Options.Band(*NBand{Lo,Hi})` で一般化。**`Band==nil` は meaty で `[NMin, Active]` に写像＝一般化前と完全一致**（既存テスト無改修 PASS）。`budgetMax=KA+2−nLo−Startup`／受理 `0≤remaining≤nHi−nLo`／`S=KA+2−nLo−remaining`／`N=remaining+nLo`。探索構造（反復深化・少手数優先・枝刈り・`sanitize`・`computeMaxDepth`）不変。
- `internal/service/setplay/service.go`:
  - filler 規則を `total≥1 かつ category!=target_combo` に是正（§4.1）。`is_derived`/`rush_variant`/`setup_only` は除外しない。
  - 負 KA（`KA<0`）は **200 相当＋`Reason=knockdown_advantage_negative`＋空**（エラーにしない・§4.2）。KA NULL は既存 `ErrKnockdownNotSet`（400）不変。
  - 打ち切りを **ランキング後**へ（`engineSafetyCap` 全列挙 → `rank` → `TotalFound` → `limit` で切る）。`truncated` は安全上限到達時のみ。**`alreadyAdopted` を返却分（≤limit）だけ算出＝N+1 解消**（§4.3）。
  - **汚連携（gap）モード**（`Mode`/`GMin`/`GMax`）を band 差し替えで新設（§4.4）。**【v1.1.0 訂正】完全空振り**＝target の最終 active が起き上がりの G フレーム前に出る。**`g = n − active`**、受理帯 **`[active+Gmin, active+Gmax]`**（**target ごとの `active` に依存**）。`G≥1` で完全空振り・`N > active` で **meaty（`N ≤ active`）と完全排他**。`g_min<1→1`・`g_max>13→13`・`g_min>g_max→`空。`gapBand(gMin,gMax,active)`・`buildProposal` の `g=N−active`・`rank` の gap 分岐は `Proposal.G` を直接比較。ロールバック点は `M19-02-GAP-DEF` マーカー。
  - **`n_max`（最大持続・meaty のみ）**を追加（§2.n_max・CHANGE-086 範囲外）。受理帯を `[max(1,n_min), min(target.active, n_max)]` に絞るのみ。0/未指定は上限なし（既定挙動不変）、`n_max<n_min` は空（エラーにしない）、gap では無視。下限・`budgetMax` の起点・恒等式は不変。
  - 明示 `target_move_id` でも `category=system` を BE で除外（§4.6-2）。
  - 保守マーカー e（負 KA）・f（gap）・g（打ち切り）を新設。
- `internal/api/setplay/dto.go`: `SuggestionDTO` に `mode`/`g`、`SuggestionsResponse` に `totalFound`/`reason`（追加のみ・後方互換）。
- `internal/api/setplay/handler.go`: `mode`/`g_min`/`g_max`/`limit` 受理、**doc comment を `sort=n|target` へ是正**（§4.6-1）、負 KA は 200 で `reason` 透過。

### フロントエンド
- `types.ts`/`api/setplayApi.ts`/`hooks/useSetplaySuggestions.ts`: `mode`/`gMin`/`gMax`/`limit` 送出、`totalFound`/`reason`/`g` 受領。**queryKey は `applied`（全条件を含む）ため条件変更・「さらに表示」で再取得**。
- `components/SetplaySuggestionSection.tsx`: モード切替（**重ねる／汚連携**〔ja。en=Meaty/Deliberate gap〕・既定重ねる）、gap は N を隠し **G 範囲コントロール**表示、**件数表示「全N件中M件」＋「さらに表示」**、**負 KA 専用文言**（KA NULL と区別）、**`truncated`（安全上限）と `limit` 切りの区別**、行の **G/N 切替**（gap 行は **`gapBeforeWakeup`「起き上がりの{G}F前に空振り（重ねない）」**）、**meaty のみ「最小/最大持続」2 枠＋`n_max<n_min` 注記**。**採用ダイアログは不変**（§1.3）。
- `components/SetplayLimitationNotice.tsx` ＋ i18n（ja/en parity）: 制約告知を **9 点**に拡張（#3 更新・旧「派生技・ラッシュ版・状態変種は対象外」記述を除去）。**gap モードの日本語表示名を「汚連携」に確定**（開発者要望 2026-07-27。en は `Deliberate gap`）。告知 #8 の参照文言も「汚連携」に統一。
- `web/e2e/m19-02-suggestion-refinement.spec.ts`: E2E **A/B/C/D/E** 新設（E=`n_max` で候補が減る）。

---

## 3. 自己テスト結果（§7.2）

- **go build / go vet / go test ./...**: **全 PASS**（非回帰）。M19-01 由来の既存エンジンテスト（移植18＋窓化10）・golden は**無改修**で通過。
- **§5.1 エンジン単体（受理帯 Band 機構・11 観点）**: PASS（meaty 互換・恒等式・帯の下限/上限/帯外/シフト帯・`nLo>nHi` 空・`Active<1` エラー・枝刈り健全性・重複列挙なし・`budgetMax<0` 空）。**【v1.1.0】これらは mode 非依存の generic band テスト**（`TestBand_*`）に整理。gap のセマンティクス（`G=N−active`・`N>active`＝meaty 排他・完全空振り）は **service 層 `refine_test.go`** で検証。
- **§5.2 グルー/API**: サービス系＋ハンドラ系 PASS。中核の**「ランキング後に切っている」**は `limit` 結果＝ランク全体の上位 limit 件と一致することで検証。**`n_max` テスト 4 件**（絞り込み効果／`n_max<n_min` 空／恒等式維持／gap 無視）追加。gap は `G=N−active`・`N>active`（meaty 排他）・**完全空振り（最終 active < 起き上がり）**を検証。
- **§5.4 Vitest**: 追加分 PASS（負 KA 文言／件数／さらに表示／truncated 区別／モード切替 G 表示／queryKey 条件／**`n_max` 反映・`n_max<n_min` 注記**）。setplay 全体・フロント全体 **823 件 PASS**（`locales.test.ts` の ja/en parity 含む）。tsc `--noEmit` クリーン・vite build 成功。

### §5.3 golden-case（回帰ゲート・4/4 実測）

| # | キャラ | KA | 期待レシピ | N | 着弾 | 結果 |
|---|--------|----|-----------|---|------|------|
| GC-1 | リュウ | 40 | 立ち弱K > 鎖骨割り | 4 | 41 | **PASS** |
| GC-3 | ジュリ | 27 | 立ち中P > 前投げ | 3 | 28 | **PASS** |
| GC-4 | テリー | 27 | しゃがみ弱K > 立ち中K | 3 | 28 | **PASS** |
| GC-5 | ガイル | 34 | ニーバズーカ > 立ち中P | 2 | 35 | **PASS** |

**4/4**。filler 規則の是正（`target_combo` 除外）で期待レシピは消えていない。**GC-2（ケン）は through target 必須のため本サブ対象外**（中央スキーマ反映後）。

### §5.5 E2E（実データ・実 UI・§9.4）

`make e2e` 相当の独立スタックで実行（pre-installed Chromium 使用）。

- **A**（さらに表示 → 採用保存）: PASS。**全種別 ON で候補 > 200（実データ）にして「さらに表示」を実操作**し、行数が増えることを確認。採用→保存も従来どおり。
- **B**（負 KA 専用文言・FR011 不変）: PASS。専用文言表示＋提案 0 件、`reason=knockdown_advantage_negative`（200）、`setup-candidates` 応答も不変。
- **C**（汚連携で G 表示・採用保存）: PASS。各行に **「起き上がりの{G}F前に空振り（重ねない）」**（`gapBeforeWakeup`）、採用保存も成功。
- **D**（採用済み抑止・非回帰）: PASS。
- **E**（`n_max` で候補が減る）: PASS。全種別 ON で総数取得 → `n_max=2` で再取得し総数が減ることを実データ確認。
- **M19-01 の既存 E2E（A/B/C）も再実行して 3/3 PASS**（delivered 契約の非回帰）。

---

## 4. `M19-LIMITATION-NOTICE` grep 結果（§7.4）

実装後（コード内・9 マーカー / 4 ファイル。**実装前 6 から減っていない**。新規 §4.1〜§4.4 箇所に付与）:

```
internal/service/setplay/service.go: (b) target 列挙 / (c) filler 規則(§4.1) / (d) KA NULL / (e) 負 KA(§4.2) / (f) gap(§4.4) / (g) 打ち切り(§4.3)
web/src/locales/ja.json: _marker
web/src/locales/en.json: _marker
web/src/features/setplay/components/SetplayLimitationNotice.tsx: マーカー
```

- 追加: (e) 負 KA・(f) gap・(g) 打ち切り の 3 マーカー。既存 (b)(c)(d) 維持。i18n `_marker`・コンポーネントの相互参照文面も新規則（`category!=target_combo`・負 KA・gap・打ち切り）へ追従。
- （注: 指示書は「6 箇所/5 ファイル」だが、実体は元々 **6 箇所/4 ファイル**〔service.go の 3 マーカーを 1 ファイルとして数える〕。ファイル数は不変、マーカー数は 6→9 に増加。）

---

## 5. §5.6 否定形確認（撤回済み仕様の残存なし・全 0 件）

| # | 走査キーワード（コマンド） | ヒット | 判定 |
|---|---|---|---|
| 1 | `grep -rn 'sort=n\|steps\|SortBySteps' internal/ web/src/` | 0 | OK（delivered は `sort=n\|target`。doc comment も是正） |
| 2 | `setup_only` による filler 絞り込み | 0（テストは「含まれる」ことの確認のみ） | OK |
| 3 | `grep -rn 'SetupSelectorModal' web/src/features/setplay/` | 0 | OK（相乗り先は `SetupCandidateList`） |
| 4 | `== KA` / `== KA+1` 等値受理（非テスト） | 0 | OK（受理帯方式が正） |
| 5 | 「全技を filler」「total≥1 のみ」 | 0 | OK（`category!=target_combo` が加わった） |
| 5b | **旧 gap 定義の残骸**（`1−N`／`gapAfterWakeup`／`KA+1+G`／`1−Gmax`／`G=1−N`） | 0 | OK（**【v1.1.0】差分レビューで検出→是正**。engine テストを generic band 化・`refine_test` コメント是正。§11 参照） |
| 6 | 「派生技・ラッシュ版・状態変種は対象外」旧告知 | 0 | OK（§4.5 #3 更新で除去） |

---

## 6. E-14 突合結果（§3.3-2）

- M18-03a（punish-mylist）は**実装コミットが存在しない**（設計 outline `M18-03a-punish-mylist.md` のみ）。punish mylist 系コンポーネントは未作成、`ComboDetailPage.tsx` の最終更新は M19-01（f844910）。
- 本サブが触ったファイル（`internal/service/setplay/*`・`internal/api/setplay/*`・`web/src/features/setplay/*`・`web/src/locales/*.json`）と **M18-03a の想定編集先に重複なし**。相乗り面（`ComboDetailPage` の `SetupCandidateList` 直下）は再設計せず、既存構造への追加に留めた（§9.1-1）。

---

## 7. 既知の制約（§7.4）

- **判別不能な状態前提技**（`denjin_charge` 等）が filler に混じり得る（現行スキーマで機械判別不能＝R-B。告知 #5 で吸収）。
- **through target（派生技）が未解禁**であり golden-case は **4/4** に留まる（GC-2 は中央スキーマ反映後）。
- **弱攻撃の連続キャンセルが未考慮**（M19-DESIGN-05 へ。告知 #6）。
- **§4.1 の filler 規則は `M19-DESIGN-05`（(i)+(j)）の結論を反映していない暫定**。`target_combo` 除外は「`total` の意味が判別不能」を根拠とするため、(j) で判別可能になれば除外を**解除できる**（候補集合の緩和＝本サブの誤りではない）。§10-4 の突合ゲートで扱う。
- **空振り時硬直変動技が未対応**（既知割り切り・followup §H(d)）。

---

## 8. 命名・推測で進めた事項（§9.2）

- 理由コード `knockdown_advantage_negative`（既存 `knockdown_advantage_required` の命名に合わせた）。
- 定数 `engineSafetyCap`/`defaultLimit`/`maxLimit`、パラメータ `mode`/`g_min`/`g_max`/`limit`（既存規約・語彙に整合）。
- i18n キー（`setplay.modeLabel`/`modeMeaty`/`modeGap`〔ja=**汚連携**〕/`gapRangeLabel`/**`gapBeforeWakeup`**/`negativeKnockdown`/`countLabel`/`showMore`/`nMaxLabel`/`nMaxBelowMinHint`、`limitations.*` の追加 5 点）。負 KA 文言は**開発者確定表現をそのまま**使用。
- **gap `sort=n`＝G 昇順（隙間が小さい順）**。**【v1.1.0 訂正】`G=N−active` は target ごとに `active` が異なるため、`rank` は N ではなく `Proposal.G` を直接比較する gap 分岐を新設した**（meaty は N 降順のまま）。※ 旧記述「`G=1−N` により N 降順と同一比較子で既存 rank を流用」は**結論が逆で誤り**。N 順では G 順にならない。
- gap の G 表示・「さらに表示」・G 範囲コントロール・`n_max` 2 枠の配置（既存の条件パネル内に収めた）。

---

## 9. 後続へ送った項目（§10）

- **through target 解禁・表記展開・親なし子警告・GC-2 を加えた golden 5/5・§4.1 filler 規則の緩和**: `M19-DESIGN-05`（(i)+(j)）の結論とスキーマ反映後の後続実装サブ（M19-overview を正）。
- **弱攻撃チェーンの本体対応**: `M19-DESIGN-05`。
- **セットプレイ成立条件の記録（構造化版・新テーブル `combo_setup_results`）**: M19-03（`M19-DESIGN-06` v1.1.0）。
- **CHANGE-086 の DES 反映**: 中央が三点セット（見込み＝DES-002 §4.2・DES-005 §5.6 項目12）。

---

## 10. 確定事項（開発者承認済み・2026-07-27）

**【v1.1.0】以下 2 点は開発者が確定済み**（旧版の「確認事項」から「確定事項」へ）。

1. **gap ソート順＝G 昇順で確定。** 隙間が小さいほど相手の起き上がり行動に近く刈りやすい。**定義が完全空振り（`G=N−active`）に変わったことで、この理由付けは一層自然になった**（G 小＝最終 active が起き上がり直前＝相手の暴れに最も近い）。実装は `rank` の gap 分岐が `Proposal.G` を直接比較（`active` が target ごとに異なるため N 順では G 順にならない）。
2. **`limit` 既定/増分＝200/200 で確定。上限 3000。** meaty 既定種別は最大 323 のため 2 ページ目で全件到達。上限 3000 は gap 既定種別最大（初期測定 2875）を包含。

（`G` の範囲 1〜13 も開発者確定・実装都合で変えない＝指示書 §9.1-6。）

---

## 11. 差分レビュー結果（後乗せ 3 群・v1.1.0 で追加）

**範囲**: `48ade85..be021d4`（初回レビュー〔`fc0426f`〜`48ade85`〕未通過の後乗せ分＝`n_max` 新設・gap 定義の 2 段是正・「汚連携」改称）。**read-only** で `M19-02-review-checklist.md` §1.4／§4／§9 に絞って実施。

**判定：合格（重大ゼロ）**。1 件の是正（テスト文書のみ・本番コード不変）を適用。

| 確認点 | 結果 |
|--------|------|
| gap 受理帯＝`[active+Gmin, active+Gmax]`（target ごとの `active` 依存） | ✅ `service.go` gapBand(gMin,gMax,active) |
| `g=N−active` かつ gap 解が `N>active`（meaty `N≤active` と完全排他） | ✅ `refine_test.go` で検証（`N>active`・完全空振り `S+active−1<Landing`） |
| gap `sort=n` が `Proposal.G` を直接比較（N 順では G 順にならない） | ✅ `rank` gap 分岐 |
| meaty 経路が完全不変（`Band==nil→[NMin,Active]`／既存エンジンテスト無改修 PASS） | ✅ 移植18＋窓化10 無改修 PASS・golden 4/4 |
| `n_max` が受理帯を `[max(1,n_min), min(active,n_max)]` に絞るのみ・下限/budgetMax/恒等式に不干渉・`n_max<n_min` 空・gap 無視 | ✅ `meatyBand()`・`TestRefine_NMax*` |
| 恒等式 `N=KA+2−S`・着弾`=KA+1` 保持・等値条件へ戻していない | ✅ |
| スキーマ非変更（`000042` 未消費・新テーブル/列なし） | ✅ |

**追加確認**:
- **(a) 否定形確認 5b（旧 gap 定義の残骸）**: 初回スキャンで engine テストの gap 定義残骸（`G=1−N`／`1−Gmax` コメント・ヘルパ）と `refine_test` の 1 コメントを**検出** → **是正**（engine テストを `TestBand_*` の generic band テストへ改称・コメント是正。本番コードは元から正しく不変）。**再スキャンで 0 件**。既存 6 件も再走し 0 件。
- **(b) golden-case 再実測**: gap 是正・`n_max` 追加**後**に GC-1/3/4/5 を再実行 → **4/4 PASS**（meaty 非波及の裏取り）。
- **(c) `M19-LIMITATION-NOTICE` 再 grep**: **9 マーカー / 4 ファイル**（減少なし）。告知 #8 は「汚連携」へ改称済み・旧 gap 定義（起き上がり後に技が出る等）を前提とした表現なし（相手依存＝方向非依存の表現）。E2E C は `gapBeforeWakeup` 文言で**再実行 PASS**。

**是正コミット**: `07f559c`（テスト文書のみ・挙動不変）。

---

## 12. 教訓（記録用）

**レビュー通過後に仕様が動いた場合、完了報告とレビュー報告の両方を追従させる。** 本サブでは gap 定義が開発者確認で 2 度動き（後→第 1 active 前→完全空振り）、その是正を単一コミット（`M19-02-GAP-DEF` マーカー）に隔離しロールバック体制まで用意した（対応自体は適切・隠していない）。不足していたのは**「レビュー後に動いた分を成果物（完了報告・レビュー報告）へ反映する」手続き**のみ。完了報告は **DES 反映の一次源**であり、報告書が古いまま中央へ渡ると「実装は正しいのに設計書だけ間違う」最も発見しにくい不整合を生む。今回は handover が正しい方を書いていたため一次受けで気づけた。**以後、レビュー後に仕様が動いたら、その場で完了報告・レビュー報告・handover の三点を同時に追従させる。**
