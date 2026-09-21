# M19-01 完了報告: セットプレイ自動提案(エンジン移植・窓化・提案 API・提案 UI・採択保存)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M19-01-setplay-suggestion-engine-and-ui.md` v1.4.0 |
| レビューチェックリスト | `docs/instructions/reviews/M19-01-review-checklist.md` v1.4.0 |
| 完了日 | 2026-07-24 |
| ブランチ | `claude/m19-01-setplay-suggestion-atcbdg` |
| 関連 CHANGE | CHANGE-085(中央起票・DES-002＋DES-005 集約・マイグレ非消費)＋ 本 §10.X addendum |

---

## 1. 自己テスト結果(§7.2)

| テスト | 結果 | 件数 |
|--------|------|------|
| エンジン単体(`internal/service/setplay`、§5.1 の 10 観点) | ✅ PASS | 移植 18 + 窓化 10 = **28** 関数 |
| グルー・API(§5.2) | ✅ PASS | service 10 + handler 6 = **16** |
| golden-case(§5.3) | ✅ **4/4** | GC-1/3/4/5 |
| フロント Vitest(§5.4) | ✅ PASS | 制約告知 4 + 提案セクション 6 = **10**(既存含め全 794 PASS) |
| E2E(§5.5、A/B/C) | ✅ **3/3 PASS** | Playwright |
| `go build` / `go vet` / `go test ./...` | ✅ PASS(42 パッケージ) | 非回帰 |
| `tsc --noEmit` / locales parity | ✅ PASS | ja/en 完全一致(28 setplay キー) |

### golden-case 実測値(N_min=1)

| # | キャラ | KA | 期待レシピ | N(実測) | 着弾(実測) | S(実測) |
|---|--------|----|-----------|--------|-----------|--------|
| GC-1 | リュウ | 40 | 立ち弱K > 鎖骨割り | 4 | 41 | 38 |
| GC-3 | ジュリ | 27 | 立ち中P > 前投げ | 3 | 28 | 26 |
| GC-4 | テリー | 27 | しゃがみ弱K > 中K | 3 | 28 | 26 |
| GC-5 | ガイル | 34 | ニーバズーカ > 立ち中P | 2 | 35 | 34 |

GC-2(ケン・派生技)は through target を要するため対象外(M19-02)。

### E2E シナリオ結果(§5.5)

- **A**: KA=40 の Ryu コンボを開く → 提案表示 → N_min=3 で候補が絞られる(件数が増えない) → 1 件採択・保存 → コンボの `setups` に紐付く。✅
- **B**: KA=NULL のコンボ → 提案セクションは理由(`setplay.noKnockdown`)のみ・提案行 0 件。✅
- **C**: 提案 1 件を採択 → 同一レシピの再採択 API が **VAL-S04(409)** で拒否 → 詳細再表示で当該行が `alreadyAdopted`「採択済み」表示。✅

### MaxResults 到達・応答時間

- golden-case・E2E とも `truncated=false`(MaxResults=200 未到達)。
- グルーは全 target を集約後にランキングし、応答は最大 `maxProposals=200` 件で打ち切る(超過時 `truncated=true`)。engine 単体の応答は golden 4 件で 0.00s(Go test 計測)、実 UI(E2E・seed DB)でも体感即時(NFR001 参考)。

## 2. Plan Mode 実査結果(§3.3 の 7 項目)

| # | 項目 | 実査結果 |
|---|------|---------|
| 1 | `moves.active` 充足率 | ハンド入力源泉 `character_data/*.csv` 全 1294 行中 **active 非NULL 1289(99.6%)**。target 母集団は痩せない。 |
| 2 | 非攻撃技・欠損分布 | active NULL は **5 行**(ドライブパリィ等)→ 条件1(active≥1)で自動除外。damage 空 or 0 は 67 行だが、投げ(前投げ等)は active を持ち正当な target(GC-3)。active を持たない非攻撃技は条件1 で落ちる。追加除外条件は不要と判断。 |
| 3 | 既存の配置・命名・エラー規約 | 実構成は `internal/api/<domain>/`(handler+dto+routes)・`internal/service/<domain>/`・`internal/repository/<domain>/`＋フラット `internal/model/`。指示書 §2.1 想定の `internal/handler/`・`SuggestionDTO in model` は**実構成へ整合**(api/setplay に DTO 配置)。 |
| 4 | `SetupSelectorModal` 現行構造 | エディタの C-08「既存から紐付け」モーダル(comboId を持たない)。**採択→保存には comboId 必須**のため相乗り不可 → §9.1-1 に従い**開発者確認**(下記 §5)。 |
| 5 | M18 マージ状況 | `is_projectile`(000039)・`is_derived`(000032)は反映済み・DB 専用列。触るファイルは M18-03 と重ならず。 |
| 6 | 移植元現物 | `autopilot-combomgr/projects/setplay-suggestion/setplay/{setplay.go,setplay_test.go}` を view。18 テスト・受理条件 `remaining==0`・`TotalFrames=ka` を確認。 |
| 7 | 既存「初回のみ表示」パターン | **`onboarding-seen-v1`**(`web/src/features/onboarding/onboarding-storage.ts`＋`OnboardingBanner.tsx`、`<feature>-seen-v1` boolean・lazy useState)。本サブは同流儀で `setplay-notice-seen-v1` を新設。 |

## 3. 変更点・配置判断(§9.2 推測で進めた事項)

- **エンジン**: `internal/service/setplay/setplay.go`(移植・stdlib のみ)。受理条件を受理帯へ。`TotalFrames` 意味変更(KA→S)。移植 18 テストは **`Active=NMin=2` で band=0=完全一致を再現**する構成にしたため**期待値の再計算は 0 件**(§4.1.6 の想定 2 件は本構成では不要。S==KA が保たれ `TestExactMatchNoFiller`/`TestSingleFiller` は無改変で通る)。窓方式は新規 10 観点で検証。
- **グルー**: `internal/service/setplay/service.go`(同一パッケージ)。target 列挙・filler 候補・ランキング・DTO・alreadyAdopted。
- **リポジトリ**: `internal/repository/setplay/repository.go`。`is_derived` を含む moves を BE 内 SELECT で参照(**API 非露出**=§2.3 例外の最小適用。model/DTO は変更せず）。
- **API**: `internal/api/setplay/`。`GET /api/combos/:comboId/setplay-suggestions`。KA NULL は 400(code `knockdown_advantage_required`)。副作用なし。`cmd/combomgr/main.go` で配線。
- **フロント**: `web/src/features/setplay/`(型・api・hook・notice-storage・制約告知・提案セクション)。name 自動生成は FE で i18n から(ja/en parity)。`ComboDetailPage` に相乗り。
- **命名**: 3 層とも `setplay` パッケージ(既存 `setup` ドメインに倣う)。

## 4. 既知の制約(§7.4)

1. **target 規則は暫定**。恒久判別(`startup_basis` 等)は中央スキーマ待ち → M19-02。
2. **`rush_variant`・状態変種が target から外れる**(`is_derived=true`。CSV で計 **514 行**が is_derived=true)。**カバレッジ損失であり誤りではない**。解禁は M19-02。
3. **B 型 air-only 技が誤提案として出得る**(`is_derived=false ∧ is_aerial=false` の両ゲート通過・機械判別不能)。**MVP で許容**(開発者確定 2026-07-24)。CSV 上の厳密件数は個別判定を要するため未確定だが、is_aerial=true で除外される空中技は 107 行。恒久対策(人手マーキング)は中央/開発者判断。
4. **空振り時硬直変動技は未対応**(total が実挙動とズレ得るが filler から除外しない。既知割り切り)。
5. **`setup_only` による絞り込みを行わない**(副作用回避。`setup_only=true` も filler 候補に含める。§11-1)。

## 5. 要決定事項・開発者確認した事項(§9.3)

- **提案 UI の相乗り先**: 指示書 §2.1 は `SetupSelectorModal.tsx`(エディタ・comboId 無)を名指すが、**採択→保存(§4.6.2)には comboId が必須**で当該モーダルでは成立しない。§4.6.1 の「DES-005 §5.6 項目 11 単一コンボ候補面」は実体として **ComboDetailPage の FR011 候補(`SetupCandidateList`)** 側。§9.1-1(UI 面は推測しない)に従い**開発者に確認 → ComboDetailPage を相乗り先に決定**。既存 FR011 候補・`SetupCandidateList` は不変(非破壊)、`selectedIds` 不使用。
- **指示書ファイル名**: `M19-01-setplay-suggestion-engine-and-ui.md` を維持(開発者確認)。
- **チェックリストは追加コミット**(指示書は前ターンで単独コミット済み・履歴改変不可のため。開発者確認)。

## 6. CHANGE-085 と DES 本体(§7.4)

- 製造担当は **DES 本体を直接編集していない**(反映は中央が三点セットで実施)。
- 実装は CHANGE-085(DES-002 提案エンドポイント＋DES-005 提案 UI)の範囲内。**超過事項**: 制約告知の localStorage キー `setplay-notice-seen-v1`(§4.6.3 指示)が CLAUDE.md §10.X 公認3キー外 → **`docs/change-notes/CHANGE-085-addendum-setplay-localstorage-key.md`** で設計担当へ §10.X 公認キー表拡張の確認依頼を起票。

## 7. `M19-LIMITATION-NOTICE` grep 結果(§7.4)

```
internal/service/setplay/service.go:116   (d) KA NULL の扱い
internal/service/setplay/service.go:135   (c) filler 候補規則
internal/service/setplay/service.go:196   (b) target 列挙規則
web/src/locales/ja.json:403               (a) ヒント文面 i18n (ja)
web/src/locales/en.json:403               (a) ヒント文面 i18n (en)
web/src/features/setplay/components/SetplayLimitationNotice.tsx:14  (告知コンポーネント)
```

§4.6.3 の最低 4 箇所(a: i18n ja/en・b: target 規則・c: filler 規則・d: KA NULL)すべてに付与済み。各コメントに相互参照先(BE ↔ i18n)を明記。

## 8. 実データ・実 UI 経由での確認(§9.4・E-11)

E2E シナリオ A/B/C を **seed 実データ(Ryu 立ち弱K total18 / 鎖骨割り startup20 active4 等)を持つ使い捨て DB + 実 UI** で実行し、実コンボ(KA=40)から提案 → 実 UI で採択 → `combos.setups` への保存・紐付けまで通した(全 PASS)。「ロジックが正しい」だけでなく「機能が使える」ことを確認。

## 9. 独立レビュー結果

fresh subagent による clean-room レビュー(成果物 diff + 指示書 + チェックリスト、ビルド思考は非共有)を実施。**§9 重大 0 件**。12 観点すべて OK(受理帯・枝刈り健全性・スキーマ非変更・FR011 非破壊・golden 4/4 を含む)。軽微 3 件はいずれも対応不要(UI 相乗り先=開発者決定済み/golden テストのコメント=実データ確認は §9.4 の E2E で担保/`truncated` セマンティクス=指示書準拠)。

## 10. M19-02 へ送った項目

- through target(派生技)の解禁・表記展開・親なし子警告・**GC-2 を加えた 5/5**・`startup_basis` 消費・E-14 突合ゲート(中央スキーマ反映後)。
- **ラッシュ版(rush_variant)を target 種別として解禁**(下記 §11-B の申し送り)。

---

## 11. レビュー指摘対応(実画面確認前の追補・開発者指摘 1〜6)

実画面確認前の開発者レビュー6件に対応。**BE はすべて既存列(category/damage/is_projectile)の SELECT のみ=スキーマ変更・マイグレ0** で実装。

### A. 対応済み(実装)

| # | 指摘 | 対応 |
|---|------|------|
| 1 | 候補が出過ぎ・truncated で採用したいものが隠れる | **条件パネル＋「提案を出す」ゲート**で1ステップ化(押すまで fetch しない)。`SetplaySuggestionSection` の `applied` 状態。 |
| 2 | 当てたい技の種別選択 | **target 種別フィルタ**(BE `category`+`is_projectile` から算出)。既定 ON=通常技/特殊技/**必殺技(弾)**、既定 OFF=必殺技(非弾)/投げ。必殺技(弾)は `is_projectile=true` を別種別化(000039 backfill 済で実データ機能)。 |
| 3 | ドライブパリィ等ダメージ0技が target に出る | 既定で **damage>0 のみ target**。`category=system` は種別 "" で常に自動対象外。「ダメージ0の技も含める」トグルで opt-in(system は含めない)。**実体はドライブパリィ=`category=system,damage=0,active=12` が active≥1 だけで通っていた**。 |
| 4 | 技単位で探索開始 | **`SetplayTargetPicker`**(登録画面の区分フィルタ流儀を踏襲・`system` 除外)→ `target_move_id`。明示指定時は種別/damage/is_derived/is_aerial をバイパス。 |
| 5 | 発生(S)表示不要 | 提案行から **S 表示を削除**(DTO の `s` は契約として保持)。 |
| 6 | ソートは持続深い順＋重ねる技順、手数は不要 | **sort=`n`(持続が深い順)/`target`(重ねる技順)**。手数(steps)ソートを廃止(手数はタイブレークのみ)。 |

- 変更 API パラメータ: `target_types`(カンマ列・既定 `normal,unique,special_projectile`)・`include_zero_damage`・`sort=n|target`。既存 `n_min`/`target_move_id` は継続。
- テスト: BE service/handler/golden(4/4・GC-3 は throw 明示で維持)・FE Vitest 12件・E2E A/B/C 3件、いずれも PASS。全 go 42pkg / web 796 / tsc / locales parity 緑。

### B. 申し送り(スコープ外→M19-02)

- **ラッシュ版(rush_variant)を target 種別として解禁**する指摘(#2 の「なお可能であれば」)は、**M19-02 へ送る**。理由: ラッシュ版 target は `is_derived=true` で §1.3・§4.2 が M19-02(startup_basis 未反映)へ明示的に留保している。ラッシュ版の格納 startup(例 rush_standing_light_kick=16)は**ラッシュ発動込みの絶対発生ではない可能性**があり、S=Σfiller.total+startup にそのまま用いると **N が誤る恐れ**があるため、今は有効化しない(誤提案を出さない安全側)。type タクソノミー側は将来 `rush` キーを足せる形で用意済み。

### C. 設計担当への通知(CHANGE-085 反映範囲の拡張)

- 本追補は指示書 §4.2(target 列挙規則)・§4.6.1(提案 UI)を**超える「target 種別フィルタ UI＋damage 既定除外規則」**を含む。**CHANGE-085(DES-005 提案 UI／DES-002)反映時にこの拡張を含めて反映**されたい。製造担当は DES 本体を編集していない。詳細は本節 §11-A の表。

### D. §6 手動確認チェックリストの訂正(is_derived)

- 先の手動確認 §6「seed に is_derived の backfill が無い」は**誤り**。`migrations/000034_backfill_moves_is_derived.up.sql` が seed 済みキャラの is_derived を CSV 準拠で backfill 済み。**実 seed DB でもラッシュ版・派生技は target/filler から除外される**(is_derived=1)。当該チェック項目は撤回。

---

## 12. レビュー指摘対応 第2弾(実画面確認中の指摘 1〜3)

### 1. ラッシュ版 target 種別の追加(**M19-02 の rush 部分を開発者指示で前倒し消化**)

- **通常技(ラッシュ)=`normal_rush`／特殊技(ラッシュ)=`unique_rush`** を target 種別へ追加(**既定 OFF**)。`category=rush_variant` の move を **`original_move_id` の元技カテゴリ**で分類(元 normal→normal_rush、元 unique→unique_rush、元 special 等→非提供)。
- BE: repo に `original_move_id` を SELECT。service `collectTargets` は **rush 種別のとき is_derived 除外を適用しない**(rush は is_derived=true が正常)。非 rush の派生技(target_combo 2nd hit・状態変種等)は従来どおり除外。スキーマ変更なし。
- **前倒しの位置づけ**: §4.2/§1.3 は rush target を M19-02(startup_basis)へ留保していたが、**開発者の明示指示(2026-07-24)で rush 部分を消化**した。through target 系(target_combo 2nd hit 等・表記展開・GC-2)は引き続き M19-02。
- **フレーム基準の注意(要実機確認)**: rush 版の格納 startup(例 rush 立ち弱K=16)はドライブラッシュ発動込みの値(フレームメーター準拠)として `S=Σfiller.total+startup` に用いる。基準差異が疑われる場合は実機で N のズレを確認されたい(§12-2 の告知でフレーム近似の限界を利用者にも明示)。

### 2. 提案の制約(§4.6.3)にフレームデータ由来の注意を追加

`SetplayLimitationNotice` に「フレームデータ由来の注意(ゲーム内フレームメーター準拠)」として3点を追加(ja/en parity):
- **多段技の持続ギャップ**: 複数当たり判定の技(例 リュウ かかと落とし)はヒット間の当たり判定が無い区間も持続に含めるため、「持続Nフレーム目」が当たり判定の無い区間に当たる場合がある。
- **残る弾**: 画面に残る飛び道具(例 波動拳)は硬直を持続扱い→実際に弾が消えるフレームは表さない。
- **設置系**: 画面に残る設置技(例 ラシード アラビアンサイクロン)は硬直を持続扱い→実際に消えるフレームは表さない。

### 3. 選択技クリアボタン

- 「特定の技から探す」で技を選ぶと種別欄が非活性化するが、戻すのにプルダウンで「技を選択」を選ぶ必要があり不自然だった。**「提案を出す」の横に「選択技をクリア」ボタン**を配置(`targetMoveId != null` 時のみ表示)。押すと種別欄が再活性化。

### 検証

- go 42pkg / web 799テスト / tsc / locales parity 緑。**golden 4/4・E2E A/B/C 3件**は rush 既定 OFF のため不変(回帰なし)。service_test に rush 分類、Vitest に rush 種別・クリアボタン・制約告知3項目を追加。
- CHANGE-085 addendum(target-filter)に rush 種別を追記(下記通知)。

## 13. レビュー指摘対応 第3弾(採用への改称・不採用ボタン)

- **「採択」→「採用」に改称**(ja: `setplay.adopt`「採用」/`adopted`「採用済み」)。en は "Adopt"/"Adopted" のまま。テストは testid / i18n キー参照のため影響なし。
- **「不採用」ボタン**を各提案行に追加。押すと**その行を結果から消す**(クライアント側の一時的な非表示。`suggestionKey`=moveId 列+N で識別)。「提案を出す」で再検索すると**リセット**され再表示される(永続はしない=軽量実装)。
- Vitest に不採用テストを追加。web 800テスト・E2E 3件・tsc・parity 緑。
