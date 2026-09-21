# change-report CHANGE-085（M19-01 セットプレイ自動提案・実装反映報告）

> **★★★【2026-09-21 errata＝`D-924`】本書の 2 箇所が失効している。⇒ 本文は歴史記録として書き換えない**（`D-274` (3)）**。**
>
> **★★★失効したのは `L58` と `L109` の 2 行である**〔逐語＝「`combo-list-expanded-ids-v1` は `browser-storage.ts` を経由せず `useSessionStorage` を直接使用しており実装ガイドラインと非整合。**是正は followup 扱い**とし、新規実装では踏襲しない旨を明記した」〕**。**
>
> **★★★`M40-02`**（2026-09-20・受理＝`D-924`）**が是正した。⇒ `useSessionStorage.ts` は `createSessionStorageHelper` 経由になり、raw の `sessionStorage.getItem` / `setItem` を呼ばない。★あわせて `scripts/check-browser-storage-keys.sh` の `DIRECT_ALLOW` から同フックのエントリを外した。**
>
> **★★したがって「非整合が残っている」「新規実装では踏襲しない」と読まないこと。⇒ 現行の as-built は `web/CLAUDE.md` §1 脚注が持つ。**


| 項目 | 内容 |
|------|------|
| 対象 CHANGE | **085**（＋ **addendum 2 件**を反映範囲に含む） |
| サブマイルストーン | M19-01（エンジン移植・窓化・提案 API・提案 UI・採択保存） |
| 作成日 | 2026-07-26 |
| 作成者 | 設計担当 Claude（M18/M19 並列期・中央／セッション2） |
| 実装 | **PR #10**（ブランチ `claude/m19-01-setplay-suggestion-atcbdg`・13 コミット・push 済・**未マージ**） |
| 指示書 | M19-01 v1.4.0／レビューチェックリスト v1.4.0 |
| 判定 | **受理**（M19 指示書担当の一次受け v1.2.0＝DoD 充足・独立 clean-room レビュー重大 0・非回帰 green・E-11 の実データ/実 UI 確認済）。**独立監査**（`M19-audit-20260725.md`・製造/レビュー/設計いずれとも別セッション）でも**実装に欠陥なし**を再確認 |
| 消費連番 | **なし**（スキーマ変更なし・マイグレ非消費） |

---

## 1. 実装結果サマリ

既存コンボの `knockdown_advantage`（KA）から**成立するセットプレイのレシピを算出して提示**し、利用者が検証・採用したものだけを既存機構（`setups`＋`setup_steps`＋`combo_setups`）へ保存する機能を新設した。中核ロジックは別リポ `autopilot-combomgr/projects/setplay-suggestion` のフレーム導出エンジン（Go 1.24・stdlib のみ）を本体 `internal/service/setplay` へ**移植**し、受理条件を**完全一致から受理帯（窓）方式へ変更**した。

**スキーマ変更なし**（新テーブル・新列・マイグレなし。提案結果は非永続）。

## 2. 検証結果（一次受け・独立監査）

- **golden-case 4/4 PASS**（`N_min=1`）。N＝4/3/3/2・着弾 41/28/28/35・S＝38/26/26/34。**指示書担当の事前照合値と完全一致**。
- **golden の frame 値を seed CSV と 8/8 独立照合**（テストのリテラルが実データと一致＝テストが実態から乖離していない）。
- **受理帯方式の縮退性**：`band=0` で完全一致に縮退するため**移植元テストは無改変**（期待値の再計算 0 件）。移植 18＋窓化 10＝28 テスト。
- **納品契約 vs 実装 20 項目すべて一致**（**撤回済みの `setup_only` 絞り込みを実装していないことも確認**＝撤回仕様の残存なし）。
- **`M19-LIMITATION-NOTICE`**：要件 4 箇所に対し **6 箇所／5 ファイル**（Go 3・i18n ja/en・コンポーネント）で相互名指しあり。
- **VAL-S04（409）／VAL-S05（comboId 必須）**：E2E-C で再採用が 409 →`alreadyAdopted` 表示。
- **既存 FR011 非破壊**：`SetupCandidateList` 不変・`selectedIds` 非入口。
- **E2E A/B/C 3/3**・ja/en parity 28 キー。

## 3. 反映範囲（★起票時より広い）

CHANGE-085 は着手前ゲート時点の通知書より**実反映範囲が広い**。以下を**すべて 085 の範囲として反映**する（**番号を増やさない**＝M19-01 が 1 サブで不可分に届き change-report も 1 本になるため。CHANGE-083 と同じ論理）。

### 3.1 相乗り先の是正（最重要）

| | 起票時（通知書 §2-b） | **as-built（正）** |
|---|---|---|
| 提案 UI の相乗り先 | DES-005 §5.6 項目11 の **`SetupSelectorModal`** | **コンボ詳細（§5.6）の FR011 候補面 `SetupCandidateList`** |

**理由**：`SetupSelectorModal` は `comboId` を持たず、**採用保存（VAL-S05＝親コンボ ID 必須）が成立しない**ことが実装時に判明した。指示書の「UI 面は推測しない」規定に従い開発者確認のうえ相乗り先を確定している。**指示書の同定ミス**であり、実装は正しい。**DES は実体に合わせて是正**した。

### 3.2 addendum 2 件（製造起票・中央裁定）

| addendum | 内容 | 中央の裁定 |
|---|---|---|
| `CHANGE-085-addendum-setplay-target-filter.md` | target 種別フィルタ／`damage>0` 既定除外／提案生成の 1 ステップ化／技ピッカー／発生（S）非表示／`sort=n\|target`（手数ソート廃止） | **085 の反映範囲に含める**（DES-005 §5.6 項目12・DES-002 §4.2） |
| `CHANGE-085-addendum-setplay-localstorage-key.md` | `setplay-notice-seen-v1` を CLAUDE.md §10.X 公認キー表へ追記してよいか | **許容・追記**（§3.3） |

**ラッシュ版 target（`normal_rush`／`unique_rush`・既定 OFF）は開発者指示（2026-07-24）で M19-01 へ前倒し**され、target-filter addendum に内包されている（**独立した 3 件目の addendum は存在しない**）。

### 3.3 CLAUDE.md §10.X の裁定と付随是正

- **`setplay-notice-seen-v1` を公認キーへ追記**した。用途は boolean 1 個の UI 状態で禁止用途に該当せず、`onboarding-seen-v1` と同一の `<feature>-seen-v1` 命名・専用ヘルパ経由・try-catch・キーバージョニングを踏襲している。
- **あわせて未記載だった 3 キーを追記**した（搬送段監査 H-4 で判明）：`intake-helper-user-rules-v1`（localStorage・M17-05d）／`combo-list-filters-v1`・`combo-list-expanded-ids-v1`（**sessionStorage**・M12-01 系）。**§10.X の対象を localStorage と sessionStorage の双方**とし、「3用途とも事前確定」という見出しなのに #3 の行が存在しない不整合も是正した。
- **`combo-list-expanded-ids-v1` は `browser-storage.ts` を経由せず `useSessionStorage` を直接使用**しており実装ガイドラインと非整合。**是正は followup 扱い**とし、新規実装では踏襲しない旨を明記した。
- **`virtual-controller-layout-v1` は実装コードに 0 ヒット＝未実装**である旨を表に明記した。

## 4. 確定した設計判断

| 項目 | 判断 |
|------|------|
| 受理条件 | **受理帯（窓）方式**＝`0 ≤ remaining ≤ target.Active − NMin`。`==KA`／`==KA+1` の**等値にしない**（等値は N 固定で golden-case を落とす） |
| エンジン | 別リポから**移植**（移植元は read-only・変更しない）。**stdlib 以外の依存を増やさない**＝NFR303/304 維持・DES-001 不変 |
| target 除外 | `startup≥1 ∧ active≥1`／`is_derived=false`／`is_aerial=false`。**`target_move_id` 明示指定時は後 2 者を適用しない** |
| target 種別 | `normal`・`unique`・`special_projectile` 既定 ON／`special`・`throw`・`normal_rush`・`unique_rush` 既定 OFF。**rush 種別選択時のみ `is_derived` 除外を外す** |
| damage | 既定 `damage>0` のみ。トグルで opt-in。**`category=system` は常に対象外** |
| filler | **`total ≥ 1` の全技**（as-built）。**`setup_only` による絞り込みは行わない**（実セマンティクス＝セットプレイ専用 move の行区分であって有用性フラグではない）。**★本規則は M19-02 で変更予定**（§6-1） |
| 永続 | **提案結果は非永続**（localStorage にも置かない）。採用物のみ既存機構へ |
| 「不採用」 | クライアント側の一時非表示・**再検索でリセット＝非永続** |
| 自動確定 | **しない**（FR307）。採用は必ず利用者の操作 |

## 5. DES 本体への反映（中央実施・本 report と同時）

| 文書 | 版 | 反映内容 |
|---|---|---|
| **DES-005** | 2.49.0 → **2.50.0**（第61版） | **§5.6 に項目12「セットプレイ自動提案」新設**（旧項目12 メタデータは 13 へ繰り下げ）。相乗り先の是正・`selectedIds` 非入口・条件パネル＋生成ゲート・種別フィルタ・damage 既定除外・技ピッカー・N 併記／S 非表示・`sort=n\|target`・採用/不採用・制約告知・非永続 |
| **DES-002** | 1.35.0 → **1.36.0**（第38版） | **§4.2 に `GET /api/combos/:comboId/setplay-suggestions`**（query 5 種・既定値・エラーコード・受理帯方式・FR011 と別系統・`is_derived`／`is_projectile`／`original_move_id` は BE の SELECT のみ） |
| **DES-003** | 1.34.0（**版据置＝errata③**） | §3.3 の `is_derived`／`is_projectile`／`setup_only` の**排他的断定を実態へ是正**（§5.1） |
| DES-001 | 1.4.0（**据置**） | stdlib のみ＝**外部依存の増加なし** |
| DES-004・DES-006・SUPP-001・REQ-001 | **据置** | KA 意味論は errata②（2026-07-23）で明文化済。VAL は既存（S04／S05）で足りる |

### 5.1 DES-003 §3.3 の errata③（版据置・CHANGE 不要）

**先例＝2026-07-23 の drive_parry errata**（記述と実態の齟齬是正は版据置）。一次源＝**M19-RESEARCH-03 の分布実測**＋**開発者のドメイン確認**（2026-07-26）。

1. **`is_derived`**：現行の判定原理「いきなり出せるか？ 出せない → true」**だけでは実データを説明できない**。`is_derived=true` の 514 行のうち**少なくとも 96 行は「単独では出せるが他技とコマンドが完全一致するため索引衝突を避ける」ことが付与理由**。したがって**本列を「単独入力が不可能」と読み替えてはならない**。「単独入力不可」と「コマンド被り」は**現行スキーマでは機械判別できない**（同一シグネチャの実例あり）。
2. **`is_projectile`**：「**唯一の**一次源」は確定反撃の自動走査という**文脈における**一次源の意。セットプレイ提案という**第 2 の consumer** が登場したため断定を緩和。
3. **`setup_only`**：「将来の自動提案のための予約列・未実装」は陳腐化（提案は実装済み。ただし**本列で絞り込まない**）。役割は**コンボ登録 UI からの除外のみ**。
4. **`category=target_combo` は `is_derived` と 1 対 1 ではない**（`is_derived=false` の target_combo が 4 行実在）。
5. **`target_combo` の `total` が「派生部分のみ」か「連携全体」かを確定する列が現行スキーマに無い**（加算検算で +6〜+40 の乖離・負値も発生＝**判別不能**）。

## 6. 残課題・繰越

| # | 項目 | 処遇 |
|---|------|------|
| 1 | **filler 規則の変更** | M19-RESEARCH-03 により **`total ≥ 1` かつ `category != target_combo`** へ変更すると確定。**delivered 契約の変更につき CHANGE-086 を起票**（着手前ゲート）。実装は M19-02 |
| 2 | **`truncated` が通常運用で発生／`alreadyAdopted` の打ち切り前算出** | ryu KA=40 の既定条件で 210 件 > 上限 200。`alreadyAdopted` を**打ち切り後 200 件に限定**する製造是正を **M19-02** で実施（挙動不変・往復のみ削減＝NFR001） |
| 3 | **負 KA の無説明** | KA NULL には専用コードがあるのに負 KA は汎用「提案なし」。**200 ＋ 専用の理由コード**を返し UI で理由表示する方針（M19-02） |
| 4 | **`rush_variant` の通し値の起点** | **+11 は実測で正しい**（開発者確認 2026-07-26）。残る論点は「**生ラッシュ（ニュートラル起点）で測られているか**」のみ。RESEARCH-03 R-E でも seed に一次情報なし＝**実機確認タスク**。rush 種別は既定 OFF のため実害なし |
| 5 | **B 型 air-only の件数が未定量** | `is_aerial=false` かつ実質 air-only の実数が機械判別不能。followup §H(a)（人手マーキングの要否）の判断材料が定量化できていない |
| 6 | **技表示名が日本語固定** | レシピ・自動生成名は `moves.nameJa` を使うため英語 UI でも技名は日本語（moves マスタが ja 単一）。英語 UX の許容可否は設計判断（followup 候補） |
| 7 | **弾を重ねる提案の実用性** | `special_projectile` を既定 ON にしたが実用妥当性は運用後判断。過剰なら OFF 化を検討 |
| 8 | **M19 の FR が REQ-001 に無い** | 実装済み機能に要件番号が無い（FR011 は転用支援＝別機能）＝トレーサビリティの穴。**M19 クローズ時に FR 新設の CHANGE を 1 本**（スコープ確定後） |
| 9 | **`handler.go` の doc コメントが旧契約** | `sort=n\|steps` のまま（実装は `n\|target`）／`target_types`・`include_zero_damage` が未記載。**製造の軽微是正**として M19-02 で処理 |
| 10 | **E-14 突合（M19-02 の DoD）** | 提案 UI 面は **M18-03（マイリスト／登録導線）・followup E-1（F12-3・M23）と同一面**。M19-02 着手時に触ったファイルと改造対象を突合し回帰ゲートを足す |
| 11 | **`combo-list-expanded-ids-v1` のヘルパ非経由** | CLAUDE.md §10.X 実装ガイドラインと非整合。**followup 扱い**（新規実装では踏襲しない旨を §10.X に明記済み） |

---

*以上、change-report CHANGE-085（M19-01）。DES 本体反映・CLAUDE.md 更新・registry 更新は中央が同時実施。*
