# 搬送段(設計成果物の disk 着地)総点検レポート

| 項目 | 内容 |
|------|------|
| 文書ID | TRANSPORT-AUDIT-20260725 |
| 実施日 | 2026-07-25 |
| 実施者 | 搬送段監査担当 Claude Code(製造・レビュー・設計のいずれとも別セッション) |
| 対象 | A. 設計書本体の版と errata / B. CHANGE 通知書 / C. registry / D. マイグレーション / E. 指示書・overview / F. 引き継ぎ資料 / G. CLAUDE.md §10.X / H. 実装の一次事実 |
| 監査ブランチ | `chore/docupd-and-auditM19-01`(HEAD `4a51c6d`) |
| 検証方式 | **完全 read-only**。ファイルの作成・編集・削除、git commit/push、マイグレーション実行を行っていない(本レポートの出力のみ開発者指示により実施)。見つからないものは「不在」と記載し、推測で補完していない |
| 関連 | 先行監査 = `docs/progress/M19-audit-20260725.md`(HEAD `cd331f0` 時点)。本書はその後の `4a51c6d` を含む時点での搬送段の再点検 |

---

## 0. サマリ

**着地しているもの**: DES-003/004 への M18-01・M19 errata 反映(A-1〜A-5)、CHANGE-078〜085 の notification 8 件(B-1)、マイグレ 000040/000041(D)、M18/M19 の指示書・レビューチェックリスト一式(E)、実装側の確定反撃サーチ・セットプレイ提案(H)。

**不在／未更新のもの(8 件)**:

| # | 項目 | 節 |
|---|------|-----|
| 1 | hit_type 4 値の表示ラベルが **§5.4 ではなく §5.7** にあり、DES-005 ステータス欄の節番号記載も §5.4 のまま | A-6 |
| 2 | `change-report-083` / `-084` / `-085` が **3 件とも不在** | B-1 |
| 3 | registry §1 に 083 以降のエントリなし(「083 以降＝空き」のまま)／`"085"` 0 ヒット／§4 最新は 1.74.0(CHANGE-078〜082 まで) | C |
| 4 | `retrospective-log.md` は 1.0.47(2026-07-08・M16 まで)で M17〜M19 未記載。`retrospective-pending-M18.md` はリポジトリ全体に不在。`model-allocation.md` は `docs/handover/` になく `docs/human-notes/` に所在 | F |
| 5 | followup-backlog §C の dash-total-backfill 行が「12 キャラ・`dash_forward` のみ」のままで、マイグレ 000041 の実体(10 キャラ×5 code＝50 行)と不一致 | F-2 |
| 6 | `setplay-notice-seen-v1` が CLAUDE.md §10.X に不在(CHANGE-085 addendum の要求が未反映) | G |
| 7 | `intake-helper-user-rules-v1` / `combo-list-filters-v1` / `combo-list-expanded-ids-v1` の 3 キーも §10.X 未記載 | H-4 |
| 8 | **`combo_punish_starters`(CHANGE-083・マイグレ 000040)が DES-003 に 0 ヒット** = 新テーブルが実在するのにデータモデル正典に不在 | 補-1 |

このうち **#8 が最も重い**(スキーマ正典と実 DB の乖離)。#1〜#7 は台帳・派生資料の追随遅れ。

---

## A. 設計書本体の版と errata の着地(`docs/design/`)

### A-0. 版一覧(各ファイル冒頭メタデータ表の「バージョン」欄)

| ファイル | 文書ID | バージョン |
|---|---|---|
| `requirements.md` | REQ-001 | **2.17.0** |
| `01-tech-stack.md` | DES-001 | **1.4.0** |
| `02-architecture.md` | DES-002 | **1.34.0** |
| `03-data-model.md` | DES-003 | **1.33.0** |
| `04-notation-spec.md` | DES-004 | **1.15.0** |
| `05-screen-design.md` | DES-005 | **2.48.0** |
| `06-validation.md` | DES-006 | **1.21.0** |
| `supp-001-detailed-design.md` | SUPP-001 | **1.27.0** |

(`docs/design/` には上記 8 点に加え `testid-convention.md` が存在)

### A-1. 03-data-model.md §3.4 の重ね判定記述 → **○(ただし文字列は完全一致せず)**

§3.4 は L334–448。当該記述は **L354**(`knockdown_advantage` 行)に着地。

| 求めた文字列 | §3.4 本文での着地 |
|---|---|
| 「無敵時間」 | ○ L354「ダウン中の『無敵時間』のフレーム数」 |
| 「KA+1」 | ○ 意味は着地。本文表記は **`knockdown_advantage + 1` フレーム目**(略記 `KA` は本文に不在) |
| 「N = KA+2−S」 | ○ 意味は着地。本文表記は **`N = knockdown_advantage + 2 − S`** |
| 「1 ≤ N ≤ active」 | ○ 本文表記は **`1 ≤ N ≤ target.active`** |

※ 略記 `KA+1` / `N = KA+2−S` / `1 ≤ N ≤ active` の**リテラルはメタデータ表のステータス欄(L8)にのみ存在**し、§3.4 本文はフルカラム名表記。

### A-2. 03-data-model.md §3.3 drive_parry に「実データが正」 → **○**

§3.3 は L266–333。**L301** に着地。旧記述(active 空・raw_data 退避)を残置したうえで括弧内に errata を追記:

> 2026-07-23 errata:この記述は CSV 取込〔FR701〕前提のものであり、現行の実データとは一致しない。…現在は手入力 seed により **全 10 キャラ一律 `startup=1 / active=12 / total=45 / recovery=33`・`raw_data=NULL`** が入っている。**実データが正**＝active は空ではなく 12。

要求の `active=12` / `raw_data=NULL` とも一致。

### A-3. 04-notation-spec.md §2.1 の `jumping_` / `jump_` 区別 → **○**

§2.1 は L55–120。

- **L73**: 通常技(ジャンプ攻撃)行に `jumping_<強度>_<ボタン>` / 例 **`jumping_heavy_punch`**
- **L107**: 「**接頭辞は厳密に区別する**:**`jumping_` ＝空中攻撃技**」(`jump_` ＝移動 system move の対比あり)

### A-4. 03-data-model.md の M18-01 スキーマ 4 件 → **全て ○**

| 対象 | 着地箇所 |
|---|---|
| §3.15 `combo_punishes` | ○ L615 |
| §3.16 `combo_punish_prunings` | ○ L633 |
| §3.17 `combo_punish_curations` | ○ L649 |
| `combos.materialized_from_combo_id` | ○ L340(§3.4 内・self-FK / CHANGE-080 / マイグレ 000038) |
| `moves.is_projectile` | ○ L282(§3.3 内・INTEGER NOT NULL DEFAULT 0 / CHANGE-081 / マイグレ 000039) |

### A-5. 06-validation.md §2.7 の hit_type 4 値 → **○**

**L151** に `### 2.7 hit_type の許容値 — ジャストパリィ確定反撃区分の追加(CHANGE-082・M18-01)`、L153 に 4 値(`normal` / `counter` / `punish_counter` / `just_parry_punish_counter`)。

**節順の乱れ(事実)**: 目次順が `2.5(L91) → 2.7(L151) → 2.6(L162)` となっており、**§2.7 が §2.6 より前**に置かれている。加えて §2.5〜2.7 は `## 3.`(L102) / `## 4.`(L119) / `## 5.`(L141) より**後方**に配置されている(§2 系の節が §5 の後ろに来ている)。

### A-6. 05-screen-design.md §5.4 の「パニッシュカウンター(ジャストパリィ反撃)」 → **×(§5.4 には不在。実体は §5.7)**

- 文字列「パニッシュカウンター(ジャストパリィ反撃)」は **L344 の 1 箇所のみ**。
- §5.4(コンボ一覧)は **L190–246**。§5.7(コンボ登録・編集)は **L292–398**。**L344 は §5.7 の範囲内**。
- §5.4 内で `hit_type` に触れるのは「状況フィルタ(position、hit_type、opponent_stance等)」の 1 行のみで、**4 値化・表示ラベルの記述は不在**。
- なお **メタデータ欄(L8)自身が「§5.4 コンボ登録の hit_type プルダウンを 4 値化」と記載**しており、ステータス欄の節番号が本文の実配置(§5.7)と食い違っている。

---

## B. CHANGE 通知書(`docs/change-notes/`)

### B-1. CHANGE-078〜085 の実在

| 番号 | notification | change-report |
|---|---|---|
| 078 | ○ `CHANGE-078-notification.md` | ○ **`change-report-078-082.md`**(078〜082 を 1 本に統合) |
| 079 | ○ `CHANGE-079-notification.md` | ○ 同上(統合) |
| 080 | ○ `CHANGE-080-notification.md` | ○ 同上(統合) |
| 081 | ○ `CHANGE-081-notification.md` | ○ 同上(統合) |
| 082 | ○ `CHANGE-082-notification.md` | ○ 同上(統合) |
| 083 | ○ `CHANGE-083-notification.md` | **× 不在** |
| 084 | ○ `CHANGE-084-notification.md` | **× 不在** |
| 085 | ○ `CHANGE-085-notification.md`(65 行) | **× 不在** |

- `change-report-083.md` / `change-report-084.md` / `change-report-085.md` は**いずれも不在**。ディレクトリ内の change-report 系の最終は `change-report-078-082.md`。
- 参考: `CHANGE-056` のみ `CHANGE-056-notification.md` + `CHANGE-056-change-report.md` の 2 ファイル形式で、他番号の `change-report-NNN.md` と命名が非統一。

### B-2. CHANGE-085 の addendum 系(全件)

- `CHANGE-085-addendum-setplay-localstorage-key.md`
- `CHANGE-085-addendum-setplay-target-filter.md`

(addendum は上記 2 件のみ。他番号の addendum ファイルは `docs/change-notes/` 直下に不在)

---

## C. registry(`docs/handover/change-number-registry.md`)

| 項目 | 実測値 |
|---|---|
| (1) §4 更新履歴の最新版番号 | **1.74.0**(2026-07-22。内容＝「CHANGE-078〜082 を『起票』→『反映済』へ(M18-01 三点セット完了)」) |
| (2) §1 で「空き」と書かれている最小番号 | **083**(L114: `| **083 以降** | **空き** | … 次回起票は 083 から採番(欠番 008/009/014)`) |
| (3) 文字列 `"085"` のヒット行数 | **0 行** |

**突合結果**: §1 番号表の最終エントリは `082`(反映済)で、**083 / 084 / 085 の行は registry に存在しない**。一方 `docs/change-notes/` には CHANGE-083 / 084 / 085 の notification が実在する。registry §1・§4 とも **CHANGE-083 以降が未搬送**。

---

## D. マイグレーション(`migrations/`)

連番の末尾 3 本(up/down ペアでそのまま列挙):

```
000039_add_moves_is_projectile.down.sql
000039_add_moves_is_projectile.up.sql
000040_create_combo_punish_starters.down.sql
000040_create_combo_punish_starters.up.sql
000041_backfill_movement_total.down.sql
000041_backfill_movement_total.up.sql
```

- **000040**: `000040_create_combo_punish_starters.up.sql` / `000040_create_combo_punish_starters.down.sql`
- **000041**: `000041_backfill_movement_total.up.sql` / `000041_backfill_movement_total.down.sql`

000041 の冒頭コメント(一次事実):

> 【対象】**10 キャラ × 移動 5 code = 50 行**(dash_forward 10 / dash_back 10 / jump_* 30)。
> ジャンプ 3 code(jump_neutral/jump_forward/jump_back)は前・後ろ・垂直で値が変わらない＝同値。
> c_viper / dhalsim は対象外(仮登録キャラ・攻撃技 0 件で候補生成に寄与しない)＝total は NULL のまま。
> 【値の出所】開発者提供・実測値・2026-07-23 受領。CHANGE-084 v2 §3.1 の表が一次源。

---

## E. 指示書・overview(`docs/instructions/`)

| ファイル名 | 冒頭の版番号 |
|---|---|
| `M18-overview.md` | **v0.1.7**(2026-07-25／M18-02 実装完了を反映＝レビュー合格・重大ゼロ。DES 反映は中央待ち) |
| `M19-overview.md` | **1.4.2**(2026-07-25。独立監査反映＝§3.4 未反映は系統的搬送停止と確定) |
| `M18-02-punish-search.md`(実装指示書) | **v1.0.1**(2026-07-23・マイグレ連番の中央払い出し 000040/000041 を確定反映。要件は v1.0.0 から不変) |
| `M18-02-design-outline.md` | **v0.7.0**(2026-07-23・ダッシュ調査＝ケース B 反映＋ジャンプ攻撃をスコープへ復帰) |
| `M19-01-setplay-suggestion-engine-and-ui.md` | **1.4.0**(中央レビュー是正反映・製造投入可) |
| `reviews/M18-02-review-checklist.md` | **v1.0.1**(指示書 v1.0.1 と 1:1・連番確定を反映。検証項目は v1.0.0 から不変) |
| `reviews/M19-01-review-checklist.md` | **1.4.0** |

参考(同族ファイル・不在確認):

- `M18-01-schema-foundation.md` **v0.2.3** / `reviews/M18-01-review-checklist.md` **v0.2.3**(1:1)
- `M18-02-RESEARCH-01-dash-frames.md` **v1.1.0**
- `M18-01-delegation-package.md` は存在
- **`reviews/M18-overview-*` / `reviews/M19-overview-*` は不在**(overview にレビューチェックリストは存在しない)
- `reviews/` の最終エントリは `M19-01-review-checklist.md`。**M19-02 以降のチェックリストは不在**

---

## F. 引き継ぎ資料(`docs/handover/`)

| 項目 | 実測 |
|---|---|
| `retrospective-log.md` の版 | **メタデータ表に「バージョン」欄が存在しない**(文書ID / 用途 / 対象読者 / 更新頻度 / 関連資料 のみ)。§8 更新履歴の最新エントリは **1.0.47(2026-07-08)** ＝「§6.6.10『M16-04〜07 完了＝M16 全工程確定』を新設」。**M17 / M18 / M19 期間の反省は未記載** |
| `retrospective-pending-M18.md` | **不在**(`docs/handover/` 直下のみならずリポジトリ全体を `find` しても 0 件) |
| `model-allocation.md` の版 | **`docs/handover/` には不在**。実在パスは **`docs/human-notes/model-allocation.md`**、**バージョン 1.39.0**(作成日 2026-04-30 / 更新日 **2026-07-19**) |

### F-2. `followup-backlog.md` §C の `M14-03-dash-total-backfill` 行 → **「12 キャラ」のまま。未更新**

L132 の原文(抜粋):

> CHANGE-084(M18-02)で **`dash_forward`** の `total` に全体フレームを **12 キャラ backfill** したが…

- 「**12 キャラ**」と書かれている(＝旧記述のまま)。
- 「**10 キャラ×5 code＝50 行**」への更新は**されていない**。文字列「10 キャラ」「50 行」「5 code」は `followup-backlog.md` 内に **0 ヒット**。
- 対象 code についても **`dash_forward` のみ**の記述で、実マイグレ 000041 が対象とする `dash_back` / `jump_neutral` / `jump_forward` / `jump_back` に言及なし。
- 状態欄は「未着手(各 seed 波の必須作業項目)」、出典欄は「CHANGE-084 §6 申し送り・M18-02 承認請求 v1.1.0 §4-2」。

---

## G. CLAUDE.md §10.X 公認ブラウザストレージキー

§10.X には表が 2 つある。**両方の表に現れるキー名を全列挙**:

**「許容される用途」表(L311–315 付近)**

| # | 用途 | キー名 |
|---|---|---|
| 1 | コンボ一覧の表示列カスタマイズ | (キー名の記載なし。用途のみ) |
| 2 | 仮想コントローラの種類選択保持 | (キー名の記載なし。用途のみ) |
| 3 | 初回オンボーディング既読フラグ | **`onboarding-seen-v1`** |

**「キー命名規則(3用途とも事前確定)」表(L332–335)**

| # | キー名 |
|---|---|
| 1 | **`combo-list-columns-v1`** |
| 2 | ~~**`virtual-controller-layout-v1`**~~(取り消し線。「フェーズ 3 以降に変更」注記付き) |

→ **CLAUDE.md §10.X に載っているキー名は計 3 件**: `onboarding-seen-v1` / `combo-list-columns-v1` / ~~`virtual-controller-layout-v1`~~(取り消し済)。
なお「キー命名規則」表は見出しが「**3用途とも事前確定**」でありながら **#3 の行が存在しない**(`onboarding-seen-v1` は用途表側にのみ記載)。

### `setplay-notice-seen-v1` の有無 → **× 不在**

- `grep "setplay-notice-seen-v1" CLAUDE.md` → **0 ヒット**。
- 実装側には実在: `web/src/features/setplay/setplay-notice-storage.ts:6` に `export const SETPLAY_NOTICE_STORAGE_KEY = "setplay-notice-seen-v1";`
- `docs/change-notes/CHANGE-085-addendum-setplay-localstorage-key.md:34` は「CLAUDE.md §10.X 冒頭『許容される用途』表 / 『キー命名規則』表への **#4 追記**」を求めているが、**CLAUDE.md 側は未反映**。

---

## H. 実装の一次事実

### H-1. `combo_punish_starters` 参照ファイルと確定反撃「探す」画面

**`combo_punish_starters` を含むファイル(Go / TS / SQL 全列挙)**

| 区分 | パス |
|---|---|
| Go | `internal/model/punish.go` |
| Go | `internal/repository/punish/queries.go` |
| Go | `internal/repository/punish/repository.go` |
| Go | `internal/service/punishfinder/constants.go` |
| Go(テスト) | `internal/infra/migration/migrate_m1802_test.go` |
| TS | `web/src/constants/punish.ts`(コメント内で BE `internal/model/punish.go` と 1:1 同期する旨を明記) |
| SQL | `migrations/000040_create_combo_punish_starters.up.sql` / `.down.sql` |

**確定反撃「探す」画面**

| 項目 | 実測値 |
|---|---|
| ルートパス | **`/punish/search`**(`web/src/router.tsx:41`) |
| トップレベルコンポーネント | **`PunishSearchPage`**(`web/src/pages/PunishSearchPage.tsx:24`、`export default function`) |
| ヘッダ導線 | `web/src/components/Header.tsx:24` — `{ to: "/punish/search", label: "確定反撃サーチ" }` |
| 画面見出し(h1) | 「**確定反撃サーチ**」(`PunishSearchPage.tsx:45`) |
| URL query | `self` / `opp` / `guard`(`guard` 既定 = `PUNISH_GUARD_TYPE_JUST_PARRY` = `"just_parry"`) |
| BE エンドポイント | `GET /api/punish-finder?self_character_id=&opponent_character_id=&guard_type=` |

**ツリーの階層構成**(`web/src/features/punish/types.ts` の DTO と `PunishTree.tsx` の render 実測)

```
PunishTree
├── nodes: OpponentMoveNode[]          ← 第1階層: 相手技(moveId/code/nameJa/advantage。表示「有利 +{advantage}F」)
│     └── starters: StarterNode[]      ← 第2階層: 始動技(moveId/code/nameJa/lane/startup/slack/verdict/note)
│           └── combos: ComboNode[]    ← 第3階層: コンボ(comboId/damage/stepCount/adopted)
└── manualReviewNodes: ManualReviewNode[]  ← 別セクション(moveId/code/nameJa/reasonCode)
```

セクション見出し(表示文字列・`PunishTree.tsx`):

- L308: 「**反撃候補**」(ソース内コメント: 旧「成立レーン」)
- L409: 「**自動判定できない相手技**」(ソース内コメント: 旧「手動確認レーン」)

**レーン名(表示文字列・`web/src/constants/punish.ts` の `PUNISH_LANE_LABELS`)**

| 内部値 | 表示文字列 |
|---|---|
| `ground` | **その場** |
| `dash` | **前方ステップ** |
| `jump` | **ジャンプ経由** |

同ファイルのコメント: 「内部値(ground/dash/jump)は不変で、表示のみドメイン語に合わせる(2026-07-24 開発者確定)」

関連ラベル(同ファイル):

- `PUNISH_GUARD_TYPE_LABELS`: `block`→「ガード」 / `just_parry`→「ジャストパリィ」
- `PUNISH_REASON_LABELS`: `distance_dependent`→「距離依存」 / `data_missing`→「データ不足」 / `unknown_damage`→「ダメージ不明」 / `zero_recovery`→「硬直データ不定」
- `PUNISH_VERDICT_LABELS`: `adopted`→「採用」 / `unreachable`→「不採用」

### H-2. セットプレイ提案エンドポイントの実シグネチャ

**登録**: `internal/api/setplay/routes.go:338-340`

```go
func RegisterRoutes(g *echo.Group, h *Handler) {
	g.GET("/combos/:comboId/setplay-suggestions", h.GetSuggestions)
}
```

`apiGroup := e.Group("/api")`(`cmd/combomgr/main.go:222`)→ 実パスは **`GET /api/combos/:comboId/setplay-suggestions`**。

**query パラメータ(`internal/api/setplay/handler.go` の実装から全列挙)**

| パラメータ | 型 | 省略時の既定値 | 備考 |
|---|---|---|---|
| `n_min` | int | **1**(`params.NMin` は未指定で 0 → エンジンが 1 未満を 1 へ丸める。`SuggestParams.NMin` コメント「0(未指定)は既定 1」) | 非整数は 400 `invalid_query_parameter` |
| `sort` | string | **`n`**(`SortByN` ＝持続が深い順 / N 降順) | 許容値は **`n` / `target`** の 2 値。他は 400 |
| `target_types` | CSV | **`normal,unique,special_projectile`**(`defaultTargetTypes()`) | 定義済み種別: `normal` / `unique` / `special_projectile` / `special` / `throw` / `normal_rush` / `unique_rush` |
| `include_zero_damage` | bool | **`false`**(未指定＝Go zero value) | `strconv.ParseBool` 失敗で 400 |
| `target_move_id` | int64 | **未指定(nil)** | 指定時はその技のみ target。`<= 0` または非整数は 400 |

- パスパラメータ: `:comboId`(不正時 400 `invalid_combo_id`)
- エラー: 404 `not_found`(`ErrComboNotFound`)／400 **`knockdown_advantage_required`**(`ErrKnockdownNotSet`)／500 `internal_error`
- 副作用なし(非永続)

**doc コメントと実装の食い違い(一次事実)**: `handler.go:27-33` の関数 doc コメントは

```
//	?n_min=1              // 省略時 1
//	&sort=n|steps         // 省略時 n(N 降順)
//	&target_move_id=123   // 任意。指定時はその技のみを target とする
```

と書かれており、**(a) `sort` の許容値を `n|steps` と記載しているが実装は `n|target`**、**(b) `target_types` と `include_zero_damage` の 2 パラメータが doc コメントに未記載**。

**提案 UI のコンポーネントファイルパス**

| 役割 | パス |
|---|---|
| 提案セクション本体(トップレベル) | **`web/src/features/setplay/components/SetplaySuggestionSection.tsx`** |
| 制約告知 | `web/src/features/setplay/components/SetplayLimitationNotice.tsx` |
| target 明示指定ピッカー | `web/src/features/setplay/components/SetplayTargetPicker.tsx` |
| データ取得フック | `web/src/features/setplay/hooks/useSetplaySuggestions.ts` |
| API クライアント | `web/src/features/setplay/api/setplayApi.ts` |
| 型・既定値 | `web/src/features/setplay/types.ts` |
| localStorage ヘルパ | `web/src/features/setplay/setplay-notice-storage.ts` |
| マウント先 | **`web/src/pages/ComboDetailPage.tsx:178`**(import は L16) |

FE 側の初期値(`SetplaySuggestionSection.tsx:40-48`): `nMin=1` / `sort="n"` / `selectedTypes=DEFAULT_TARGET_TYPES`(`normal`, `unique`, `special_projectile`) / `includeZeroDamage=false` / `targetMoveId=null`。FE は省略せず**全パラメータを常時送信**する(`setplayApi.ts` のコメント「無指定時のため常に送る」)。`applied` が null の間は fetch しない(明示「提案を出す」操作が必要)。

### H-3. `M19-LIMITATION-NOTICE` の全出現箇所

**実装コード(6 箇所 / 5 ファイル)**

| パス:行 | 内容 |
|---|---|
| `internal/service/setplay/service.go:185` | (d) KA が NULL のコンボは提案不可 |
| `internal/service/setplay/service.go:204` | (c) filler 規則 |
| `internal/service/setplay/service.go:275` | (b) target 列挙規則(種別 type・is_aerial 除外) |
| `web/src/features/setplay/components/SetplayLimitationNotice.tsx:14` | 文面(i18n `setplay.limitations.*`)は BE の制約実装と対応 |
| `web/src/locales/ja.json:424` | `"_marker"` キー(BE の 3 規則を名指しで相互参照) |
| `web/src/locales/en.json:424` | `"_marker"` キー(同上・英語) |

**ドキュメント側の出現(実装マーカーではない参照)**

| パス:行 |
|---|
| `docs/instructions/M19-01-setplay-suggestion-engine-and-ui.md:327, 331, 334, 427` |
| `docs/instructions/reviews/M19-01-review-checklist.md:97, 149, 167` |
| `docs/instructions/M19-overview.md:42, 71` |
| `docs/change-notes/CHANGE-085-notification.md:42` |
| `docs/progress/M19-01-report.md:87` |
| `docs/progress/M19-audit-20260725.md:247, 361` |
| `docs/handover/design-reports/20260725-m19-01-design-handover.md:136` |

指示書の要求は「最低 4 箇所」。実装側は **6 箇所 / 5 ファイル**で Go ↔ i18n の相互名指しあり。

### H-4. `web/src` 配下で使われているブラウザストレージキー全列挙

| キー名 | ストレージ種別 | 定義箇所 | CLAUDE.md §10.X 公認 |
|---|---|---|---|
| `combo-list-columns-v1` | **localStorage** | `web/src/features/combo/hooks/useColumnVisibility.ts:8`(`createLocalStorageHelper`) | **○ 公認 #1** |
| `onboarding-seen-v1` | **localStorage** | `web/src/features/onboarding/onboarding-storage.ts:3`(`createLocalStorageHelper`) | **○ 公認 #3** |
| `intake-helper-user-rules-v1` | **localStorage** | `web/src/features/intake/user-rules-storage.ts:8`(`createLocalStorageHelper`) | **× 未記載** |
| `setplay-notice-seen-v1` | **localStorage** | `web/src/features/setplay/setplay-notice-storage.ts:6`(`createLocalStorageHelper`) | **× 未記載**(CHANGE-085 addendum が #4 追記を要求・未反映) |
| `combo-list-filters-v1` | **sessionStorage** | `web/src/features/combo/hooks/useComboListFilters.ts:14`(`createSessionStorageHelper`) | **× 未記載** |
| `combo-list-expanded-ids-v1` | **sessionStorage** | `web/src/features/combo/components/ComboTable.tsx:51`(`useSessionStorage` フック直接使用) | **× 未記載** |

補足(実装事実):

- ヘルパ `web/src/lib/browser-storage.ts` は `createLocalStorageHelper` / `createSessionStorageHelper` の 2 系統を提供。同ファイル L13 のコメントに「in-app ナビゲーション中の UI 状態(フィルタ/ソート等)の一時保持に用いる。恒久化は localStorage 側を使う」とあり、sessionStorage 用途を明示的に位置づけている。
- `combo-list-expanded-ids-v1` のみ **`browser-storage.ts` を経由せず** `web/src/hooks/useSessionStorage.ts` を直接使用(CLAUDE.md §10.X「専用ヘルパ経由」の実装ガイドラインと非整合)。
- `virtual-controller-layout-v1` は `web/src` に **0 ヒット**(未実装)。

---

## 補. 追加で確認した事実

### 補-1. `combo_punish_starters` が DES-003 に不在 → **× 0 ヒット**

- `grep -c "combo_punish_starters" docs/design/03-data-model.md` → **0**。
- DES-003 §3 の節構成は §3.14 `move_commands`(L595) → §3.15 `combo_punishes`(L615) → §3.16 `combo_punish_prunings`(L633) → §3.17 `combo_punish_curations`(L649) → `## 4. インデックス方針`(L669)。**§3.18 に相当する `combo_punish_starters` の節が存在しない**。
- 一方、実体は `migrations/000040_create_combo_punish_starters.up.sql` で作成され、Go(model / repository / service)と TS 定数の双方が参照している(H-1 参照)。
- 対応する CHANGE 番号は **083**(registry §1 に未記載・C 参照)。

**＝ 新テーブルが DB とコードに実在するのに、データモデル正典(DES-003)に載っていない**。本監査で検出した搬送漏れのうち最も影響が大きい項目。

### 補-2. 先行監査(`M19-audit-20260725.md`)からの差分

先行監査は HEAD `cd331f0` 時点。その後 **`4a51c6d`「docs: ドキュメント最新化」**が以下 11 ファイルを変更しており、先行監査の指摘の一部は解消済み。

```
docs/change-notes/CHANGE-085-notification.md            |  65 ++(新規)
docs/design/03-data-model.md                            |   6 +-
docs/design/04-notation-spec.md                         |   4 +-
docs/handover/code-facts.md                             |  60 ++-
docs/handover/design-instruction-playbook.md            |  41 ++-
docs/handover/docs-map.md                               |  13 +-
docs/handover/followup-backlog.md                       |  21 ++
docs/instructions/phase3/M18-01-delegation-package.md          | 112 ++(新規)
docs/instructions/phase3/M18-overview.md                       |   7 +-
docs/instructions/M19-overview.md                       | 131 +-
docs/instructions/phase3/reviews/M18-01-review-checklist.md    |  15 ++
```

| 先行監査の指摘 | `4a51c6d` 後の状態 |
|---|---|
| A-1「DES-003 §3.4 の KA errata が本文に一文字も入っていない」 | **解消**(本書 A-1 = L354 に着地) |
| A-2「CHANGE-085 通知書の本体がリポジトリに存在しない(addendum 2 本のみ)」 | **解消**(`CHANGE-085-notification.md` 65 行が実在) |
| A-7「CHANGE-083 の `combo_punish_starters` が DES-003 に不在」 | **未解消**(本書 補-1 = 依然 0 ヒット) |
| A-10「change-number-registry が 083 未起票のまま停止」 | **未解消**(本書 C) |

---

*以上*
