# M19-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M19-02(セットプレイ自動提案のテコ入れ)v1.1.2 |
| レビュー範囲 | commit `2bb87a5`..`HEAD`(fc0426f / b4be277 / db6e4b2 / 2e77086 / 48ade85) |
| レビュー担当 | 品質レビュー(read-only) |
| 実施日 | 2026-07-26 |
| 判定 | **合格（重大ゼロ）**。§10 軽微・情報提供のみ持ち越し可 |

## 総評

最重要ゲート 4 点(打ち切りのランキング後化・受理帯恒等式と meaty 不変・スキーマ非変更・M19-01/FR011 非破壊)はいずれも満たされている。受理帯の一般化は `NMin/Active` → `nLo/nHi` の純粋な変数置換で、`Band==nil` を `[NMin, Active]` に写像することで meaty を完全一致させており、既存エンジンテスト(setplay_test.go)は削除ゼロ・修正ゼロで、gap 用 11 観点が末尾に追記されているのみ。`go build` / `go vet` / `go test ./...` は全 PASS(非回帰)、golden-case は 4/4 実測。filler 規則の是正・負 KA・gap・打ち切り是正・制約告知 9 点・doc comment 是正・BE 側 system 除外まで指示書どおり実装され、テストで裏取りされている。実装品質は高く、修正を要する指摘はない。以下は将来対応・情報提供レベルの所見のみ。

## 設計準拠性レビュー結果

### §1.1 filler 規則の是正（§4.1） ◎
- `service.go:272` で `m.Total != nil && *m.Total >= 1 && m.Category != model.MoveCategoryTargetCombo` を実装。**除外は service 層 1 箇所に集約**され、`internal/repository/setplay/repository.go` は `category` 列を SELECT するのみで target_combo を WHERE 除外していない(**二重実装なし**、grep 確認済み)。指示書 §4.1 は「repository 修正」を例示するが「いずれか一箇所に集約」を許容しており準拠。
- `is_derived` / `rush_variant`(`MoveCategoryRushVariant`)/ `setup_only` は filler から除外していない。`refine_test.go:55` の `TestRefine_FillerIncludesDerivedRushSetupOnly` が 4 種すべての混入を確認。
- 状態前提技の機械除外なし(告知 #5 で吸収)。

### §1.2 負 KA の専用応答（§4.2） ◎
- `service.go:249` で `ka < 0` は **エラーを返さず** `SuggestResult{Proposals: [], Reason: ReasonKnockdownNegative}`。ハンドラ(`handler.go`)は 200 で `reason` を透過(`TestHandler_NegativeKA_Returns200WithReason`)。
- KA NULL は既存 `ErrKnockdownNotSet` → 400 `knockdown_advantage_required`(不変)。**別コード・別文言**で区別。
- 文言 `negativeKnockdown` は ja/en 両ロケールに存在し、ja は開発者確定表現「有利フレームがマイナスのためセットプレイはありません」と一致。FE で `data-testid="setplay-negative-knockdown"` を KA NULL の `noKnockdown` と分離表示。

### §1.3 打ち切り仕様の是正（§4.3・中核） ◎
- 構造は「`opt.MaxResults = engineSafetyCap` で全列挙 → `rank()` → `totalFound = len(proposals)` → `limit` で切る」(`service.go:284-323`)。**打ち切りはランキング後**。
- `TestRefine_RankThenCut` が中核を検証:`limit` を小さくした結果が rank 済み full の上位 limit 件と `reflect.DeepEqual` で一致、かつ full が N 降順であることを確認。**「少手数順の上位が残る」旧挙動ではない**ことを担保。
- `truncated` は per-target で `len(suggestions) >= engineSafetyCap` のときのみ true(`TestRefine_SafetyCapTruncates` は cap=2 に縮小して発火確認)。**limit 切りは truncated にしない**(`TestRefine_TotalFoundAndLimitCut`)。
- `alreadyAdopted` は返却分(≤limit)だけループ算出(`service.go:326-332`、`TestRefine_AlreadyAdoptedOnReturnedOnly` が dup 呼び出し回数 = 返却件数を確認)。**N+1 を打ち切り前全件から返却分へ限定**。
- `limit` 上限 `maxLimit=3000` で丸め(エラーにしない)。定数の根拠は完了報告 §1.2 に実測(§3.3-1)付きで記載。

### §1.4 gap モード（§4.4） ◎
- 受理帯を `Options.Band(*NBand{Lo,Hi})` で一般化。`budgetMax = KA+2−nLo−Startup` / 受理 `0 ≤ remaining ≤ nHi−nLo` / `N = remaining + nLo`(`setplay.go:160-263`)。**探索構造(反復深化・少手数優先・枝刈り・sanitize・computeMaxDepth)は温存**(差分は変数名置換のみ、git diff で確認)。
- gap は `gapBand()` が `[1−Gmax, 1−Gmin]` を渡す(`service.go:339-347`)。**独自式なし**。`g = 1 − N`(`buildProposal:422`)。
- `TestGap_MeatyEquivalence` が `Band=nil` と `Band{NMin,Active}` の解集合一致を確認。恒等式・帯下限/上限/帯外・`G=1−N`・`nLo>nHi` 空・`Active<1` エラー・枝刈り健全性(両端列挙)・重複列挙なし・`budgetMax<0` 空 の 11 観点すべて存在(`setplay_test.go:512-689`)。
- 丸め:`g_min<1→1`・`g_max>13→13`・`g_min>g_max→`空(`TestRefine_GapRounding`)。`mode=gap` で `n_min` 無視・`mode=meaty` で `g_*` 無視(`TestRefine_MeatyIgnoresGParams`)。`mode` 省略時 meaty。
- gap `sort=n` は G 昇順を既存 `rank()` の N 降順で実現(`G=1−N` より同一比較子)。エレガントで低リスク。

### §2 データ・API 契約・スキーマ不変 ◎
- **マイグレーション追加なし**(diff にマイグレファイルなし・報告も `000042` 非消費を明記)。新テーブル・新列なし。
- `SuggestionDTO`(`mode`/`g` 追加)・`SuggestionsResponse`(`totalFound`/`reason` 追加)は**追加のみの後方互換**。既存フィールドの型・意味不変(`dto.go`)。`reason` は `omitempty`。
- 既存パラメータ(`n_min`/`sort=n|target`/`target_move_id`/`target_types`/`include_zero_damage`)契約不変。target 種別既定値(ON=normal/unique/special_projectile、OFF=special/throw/normal_rush/unique_rush)不変(`types.ts` / `handler.go`)。
- 採択保存は既存 `setupApi.create(comboId, ...)` 経路のまま(`SetplaySuggestionSection.tsx:428-455`)。副作用なしは `TestGoldenCases` 等が dupChecker nil で提案生成のみ実行して担保。

### §3 フロントエンド ◎
- 相乗り先は `ComboDetailPage` の提案セクションのまま(`SetupSelectorModal` 不使用、否定形確認 #3=0 件)。`selectedIds` 非入口。
- 条件パネル＋「提案を出す」ゲート維持(`applied` 確定まで fetch しない、`useSetplaySuggestions` の `enabled`)。モード切替・G 範囲・件数・「さらに表示」は既存条件パネル内への追加に留まり面の再設計なし。
- 件数「全 {total} 件中 {shown} 件」表示、全件表示済み or 上限到達で「さらに表示」非表示(`canShowMore`)。`truncated`(安全上限)のときだけ「条件を絞ってください」(`data-testid="setplay-truncated"`、limit 切りとの区別を `SetplaySuggestionSection.test.tsx` が検証)。
- gap 行は G 表示・N 非表示 / meaty は逆(`setplay-frame-label`)。S は非表示(「発生(S)は表示しない」テストあり)。
- **queryKey 是正**:`["setplaySuggestions", { comboId, applied }]` の `applied` が全条件オブジェクトに変わり、条件変更・「さらに表示」で再取得(react-query 構造ハッシュ)。M19-01 の「applied が bool で条件が反映されない」問題は解消。
- 採用ダイアログ不変(名前自動生成・編集・409 重複ハンドリングは M19-01 のまま)。

### §4 テストの妥当性 ◎
- エンジン §5.1 の 11 観点すべて存在。既存エンジンテスト(移植 18 + 窓化 10)は**削除ゼロ・修正ゼロ**(git diff で setplay_test.go の削除行 0 を確認)。
- グルー/API:`refine_test.go` 12 件 + `handler_test.go` 追加分。中核「ランキング後に切る」検証あり。BE 側 system 除外(`TestRefine_ExplicitTargetExcludesSystem`)あり。
- golden-case 4 件 `N_min=1`・`mode=meaty` で 4/4 PASS、N・着弾・S を検証、`Truncated=false` も確認(`golden_test.go`)。GC-2 対象外を明記。
- Vitest §5.4 の観点(負 KA 文言 / 件数 / さらに表示 / truncated 区別 / モード切替 G 表示 / queryKey 条件包含 / 既存挙動非破壊)存在。E2E A/B/C/D 存在、A は全種別 ON で候補 >200 の実データ操作。

### §5 設計意図との整合 ◎
- 打ち切り是正は「ページング追加」で終わらず、**ランキング後に切る = 隠れるのは価値の低い分**という設計意図に一致。
- gap は「受理帯定数差し替え」でありアルゴリズム新設なし。提案は自動確定せず採用操作を要する(FR307)。FR011 と別系統で共存。成立条件の記録・through target 等スコープ外に手を出していない(`RoleParent` は予約定数のみ、未出力)。

### §6 コード品質・規約 ◎
- 命名は指示書語彙(`NLo/NHi`/`Band`/`totalFound`/`ReasonKnockdownNegative`/`engineSafetyCap`/`defaultLimit`/`maxLimit`)と一致。定数化されマジックナンバー散在なし。
- i18n は ja/en parity(両ロケールの setplay 節キー集合が一致、目視確認)。負 KA 文言は開発者確定表現。
- `handler.go:31` の doc comment が `sort=n|target` へ是正済み(§4.6-1)。`console.log`/`fmt.Print` の残置なし(grep 0 件)。

### §7 既存挙動温存 / §8 ドキュメント ◎
- M19-01 delivered 契約(種別既定値・damage>0 既定・sort=n|target・N 併記・S 非表示・採用/不採用・selectedIds 非入口・非永続・制約告知の初回のみ表示)維持。
- 完了報告に Plan Mode 実査 5 項目・実測分布(meaty/gap)・応答時間(最大 25.6ms)・定数根拠・LIMITATION-NOTICE grep・否定形確認 6 件(全 0)・E-14 突合・既知の制約が記載。DES 本体未編集・マイグレ非消費を明記。

## 設計準拠性以外の指摘事項

いずれも**軽微・情報提供**。修正必須ではない。

1. **`alreadyAdopted` の dup 判定が返却件数ぶんの逐次クエリのまま**(`service.go:326-332`)。指示書要件「返却分に限定」は満たすが、`limit=maxLimit(3000)` まで「さらに表示」した場合、最大 3000 回の逐次 `FindDuplicateInCombo` を発行し得る。将来スケール時はハッシュ集合の一括取得(IN 句/バッチ)に置き換える余地がある。M19-01 教訓(提案 UI を何度も触らない)の観点から本サブでの是正は不要。

2. **`maxLimit(3000) < gap 全種別の最大 totalFound(4884)`**。gap 全種別で 4884 件時、ユーザーは 3000 件で頭打ちになり「さらに表示」ボタンが消えるが `truncated`(安全上限)にも該当しないため「条件を絞って」告知も出ない。件数ラベルは「全 4884 件中 3000 件」を表示するため件数の乖離は可視だが、残りへの導線・注記がない状態になる。完了報告 §1.2 は「上位優先で価値の低い分が隠れる = 設計意図」と説明しており設計判断としては妥当。開発者が本挙動を認識していれば持ち越し可。

3. **`truncated=true`(安全上限到達)時の `totalFound` は過小**。エンジンが数え切っていないため件数ラベルが不正確になり得るが、同時に「条件を絞って」告知が出るため実害は限定的。病的入力のみで実データでは非発火。

4. **LIMITATION-NOTICE のファイル数表記**。指示書は「6 箇所/5 ファイル」だが実体は元から「6 箇所/4 ファイル」(service.go の 3 マーカーを 1 ファイルとして数える)。マーカーは 6→9 に**増加**、ファイル数 4→4 で**減少なし**のため DoD「減っていない」を満たす。完了報告 §4 が差異を透明に説明済み。指示書側の数値誤りであり実装の欠陥ではない。

## 推奨修正（優先度別）

- **高（M19 完了前に修正必須）**: なし。最重要ゲート 4 点すべて充足、重大ゼロ。
- **中（M20 着手と並行可）**: なし。
- **低（将来対応）**:
  - 所見 1: `alreadyAdopted` の dup 判定バッチ化(スケール対策)。
  - 所見 2: gap 全種別で `maxLimit` 頭打ち時の残件への注記/導線を検討(開発者が設計意図として許容するなら不要)。将来 through target 解禁で件数がさらに増えるため、その実装サブで併せて再検討するとよい。

## 良かった点

- 受理帯一般化を**純粋な変数置換**(`nMin/Active`→`nLo/nHi`、`Band==nil` で meaty 完全写像)で実現し、既存エンジンテスト無改修 PASS を構造的に保証している。恒等式 `N=KA+2−S`・`G=1−N` を崩さず、gap を「定数差し替え」で成立させたのはリスク最小化の設計意図に忠実。
- 「ランキング後に切る」中核要件を `TestRefine_RankThenCut` が rank 済み full の上位一致という形で正面から検証しており、要件の精神(隠れるのは価値の低い分)まで担保。
- filler 除外を service 1 箇所に集約し repository と二重実装していない。gap `sort=n` を既存 `rank()` の N 降順比較子で兼ねる(`G=1−N` の代数的性質を利用)など、新規分岐を増やさない実装が随所にある。
- 制約告知 9 点・#3 更新(旧「派生技・ラッシュ版・状態変種は対象外」の除去)・否定形確認 6 件・E-14 突合まで完了報告に事実ベースで整理され、トレーサビリティが高い。ja/en parity・doc comment 是正・BE 側 system 除外(多層防御)まで漏れなし。

## 制約事項

- 本レビューはコード・テスト・ドキュメント上で判定可能な範囲のみを対象とする。実機での起き攻め成立、実 UI の操作感、パフォーマンス(NFR001 に対する実応答)、E2E の実ブラウザ実行結果は、完了報告の記載を前提とし本レビューでは再実行していない(Go 全テスト・build・vet は本レビューでも実行し PASS を確認済み)。
- gap の実戦有用性(G の最適並び順)・`limit` 既定値の運用妥当性は開発者確認事項(完了報告 §10・指示書 §11)であり、暫定案での実装が妥当かは開発者の判断に委ねる。

---

## 取り込み結果（自動トリアージ・implement_plan_full Phase C）

| # | 指摘（優先度） | 採否 | 理由 |
|---|---------------|------|------|
| 1 | `alreadyAdopted` dup 判定のバッチ化（低） | **不採用** | 指示書 §4.3「返却分に限定」は充足済み（N+1 は打ち切り前全件 210〜459 → ≤limit・既定 200 へ縮小）。IN 句バッチ化は setup リポジトリに新メソッドを要する大きめの変更で M19-02 スコープ外・M19-01 教訓①（提案 UI 面を何度も触らない）に反する。将来スケール時に後続で検討。 |
| 2 | gap 全種別 `maxLimit(3000) < totalFound(4884)` の残件注記（低） | **不採用** | 仕様欠落ではない（§4.3.4 は truncated と limit 切りの区別を要求し、それは実装済み。maxLimit 頭打ちの注記までは要求していない）。件数ラベルが「全4884件中3000件」で乖離を可視化済み。設計意図（隠れるのは価値の低い分）は完了報告 §1.2 に記載。レビュアー推奨どおり through target 解禁の後続サブ（件数がさらに増える）で併せて再検討する。 |
| 3 | `truncated=true` 時の `totalFound` 過小（低） | **不採用** | 病的入力のみ（実測で実データは `engineSafetyCap` に非到達）。発火時は「条件を絞って」告知が同時に出るため実害限定。 |
| 4 | LIMITATION-NOTICE の「6箇所/5ファイル」表記（軽微） | **対応不要** | 指示書側の数値誤り（実体はマーカー 6→9・ファイル 4→4 で DoD「減っていない」を充足）。コード欠陥ではなく、完了報告 §4 が差異を透明に説明済み。 |

**安全弁**: 優先度「高」の指摘はゼロ（重大ゼロ）のため、不採用によるエスカレーションは発生しない。中・低の不採用は上記理由により自動で確定。**コード変更なし**（レビューは合格・修正必須の指摘なし）。

---

## 差分レビュー（後乗せ 3 群・2026-07-27 追記）

> **本レビュー本体（上記）の対象範囲は初回の 5 実装コミット `fc0426f`〜`48ade85` まで**（当時のブランチ tip）。その後 `48ade85..be021d4` に 3 群の後乗せがあり、一次受けで「レビュー未通過」と指摘されたため、差分レビューを追加実施した。
>
> **注記（本体の記述の一部は pre-correction 状態）**: 本体「良かった点」の「gap `sort=n` を既存 `rank()` の N 降順比較子で兼ねる（`G=1−N` の代数的性質を利用）」は、**是正前の gap 定義に基づく記述**であり、下記差分レビューで**是正済み**（現行は `G=N−active`・`rank` は `Proposal.G` を直接比較する gap 分岐）。

### 範囲・方法
- 範囲: `48ade85..be021d4`（`n_max` 新設・gap 定義の 2 段是正〔後→第 1 active 前→完全空振り〕・「汚連携」改称）。
- 方法: read-only。`M19-02-review-checklist.md` §1.4／§4／§9 に限定（meaty 経路へ非波及のため全走査は不要）。

### 判定：合格（重大ゼロ）
- **gap（whiff）**: 受理帯 `[active+Gmin, active+Gmax]`（target ごとの `active` 依存）／`g=N−active`／`N>active`（meaty と完全排他）／完全空振り（最終 active < 起き上がり）／`rank` は `Proposal.G` 直接比較。すべて確認。
- **meaty 非改変**: `Band==nil→[NMin,Active]` 維持。M19-01 由来の既存エンジンテスト（移植18＋窓化10）無改修 PASS・golden 4/4 再実測 PASS。
- **`n_max`**: 受理帯上限を絞るのみ・下限/budgetMax/恒等式に不干渉・`n_max<n_min` 空・gap 無視。`TestRefine_NMax*` で担保。
- **スキーマ非変更**（`000042` 未消費）・恒等式保持。

### 是正（1 件・テスト文書のみ・本番コード不変）
- **否定形確認 5b**（旧 gap 定義の残骸）で engine テストの `G=1−N`／`1−Gmax` コメント・ヘルパを検出 → engine テストを generic band テスト（`TestBand_*`）へ改称し残骸を除去。`refine_test` のコメントも是正。**再スキャンで 0 件**。是正コミット `07f559c`。

### 追加確認
- (a) 否定形確認: 5b 0 件・既存 6 件 0 件。
- (b) golden-case: gap 是正・`n_max` 追加後に 4/4 PASS。
- (c) `M19-LIMITATION-NOTICE`: 9 マーカー/4 ファイル（減少なし）。告知 #8 は「汚連携」改称済み・旧 gap 定義前提の表現なし。E2E C は `gapBeforeWakeup` で再実行 PASS。

**重大な指摘はなく、本番コードの変更は不要**（テスト文書の是正のみ）。完了報告は `M19-02-report.md` **v1.1.0** で as-built へ追従済み。
