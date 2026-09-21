# 調査報告: 空振り不可の技の判別軸の記録探索

| 項目 | 内容 |
|---|---|
| 実施日 | 2026-08-02 |
| 実施時の HEAD | `ca66773ed34796576829f793cf07ba57b2090912` |
| 結論 | **該当あり** |

## 1. 結論（3 行以内）

`category=target_combo` の 3 類型については、**パターン1/2（前段のヒットまたはガードが必要）を `is_derived=true`、パターン3（空振りでも出る）を `is_derived=false` として持つ**確定記録がある（`docs/seed-data/target-combo-and-derived-flag-rules.md:54-102,154-190`）。
後続の RESEARCH-03 は `category=target_combo AND is_derived=true` が 63 件を捕捉する一方、target_combo 外の状態前提技等を含む一般判別は現行スキーマで不能と記録している（`docs/progress/M19-RESEARCH-03-report.md:100-112,188-191`）。
`M19-DESIGN-07-frame-cost-model.md` は対象外という結論を記すが、現実装は `category != target_combo` の一律除外であり、`startup_basis`／`move_derivations`／派生条件による消費はまだ無い（`internal/service/setplay/service.go:267-281,390-435`）。

## 2. §3.1 RESEARCH-03 の R-C

### 2.1 ファイルの特定

`docs/` 配下で `RESEARCH-03` を検索し、R-A〜R-E を持つ報告本体を `docs/progress/M19-RESEARCH-03-report.md` と特定した。同名系ファイルとして `docs/progress/M19-RESEARCH-03-is-derived-semantics.md` と `docs/instructions/M19-RESEARCH-03-is-derived-semantics.md` も存在し、両者は調査指示書である（両ファイルとも見出しは `:1,41-66`）。R-C の調査結果本文は report の `:116-140` にある。

### 2.2 R-C 全文（原文）

出典: `docs/progress/M19-RESEARCH-03-report.md:116-140`

> ## R-C. `target_combo.total` の意味
>
> ### 実態
>
> 1. **算出式の内部整合性**: `internal/seedgen/generate.go:140-141` は全カテゴリ一律で `csv.total == startup + active - 1 + recovery` を検証する(target_combo 専用のロジック分岐は無い)。これは当該行**自身**の内部整合性を保証するのみで、親技との加算関係(累積か否か)には無関係。
> 2. **NULL化の設計意図との乖離**: `tmp/target-combo-and-derived-flag-rules.md` §2.5 は「TC 2段目以降は `startup`/`total` を NULL とし `active`/`recovery`/`on_hit`/`on_block` のみ登録する」ことを開発者確認済みとして記録している。しかし実データでは `category=target_combo` 67行中 **`startup` 非NULL 65行(97%)・`total` 非NULL 64行(96%)** であり、この設計意図どおりには運用されていない(事実。是非は判断しない)。
> 3. **親技との加算関係の検算**(`command` のチェイン先頭トークンで親を特定。`original_move_id` は target_combo では常にNULLのため使えない): 15例中一部を抜粋——
>
>    | 子(target_combo) | 子total | 親(chain先頭トークン一致) | 親total | 差分 |
>    |---|---:|---|---:|---:|
>    | guile `recoil_cannon` | 44 | `standing_medium_punch` | 24 | +20 |
>    | guile `double_shot` | 30 | `crouching_medium_punch` | 24 | +6 |
>    | guile `phantom_cutter` | 37 | `crouching_heavy_kick` | 50 | **-13** |
>    | jamie `full_moon_kick` | 84 | `falling_star_kick` | 44 | +40 |
>
>    差分が案件ごとに大きくばらつき(+6〜+40)、**負値も発生する**(親totalの方が大きい)。単純な「親total+子固有分」の加算では説明できない。
> 4. **`docs/progress/M19-RESEARCH-02-report.md` R-C-4** は、ケン `thunder_kick`(category=unique・startup=29)について「startup が単体公式値か派生時実測値かを記録するフィールドは存在しない」として明示的に「判別不能」と結論済み。同報告書の「引き渡し事実 5」も「派生技startupのprovenanceを記録するフィールドは存在しない」と一般化している。
>
> ### 機械判別の可否
> `target_combo.total` が「派生部分のみ」か「連携全体」かを判別できる列・情報は存在しない。加算検算も一貫したパターンを示さない。
>
> ### 結論: **判別不能**
>
> ### filler規則への含意(事実のみ)
> - `target_combo.total` を filler の消費フレームとしてそのまま加算する場合、その値が「その段だけの空振りフレーム」なのか「連携全体を含む値」なのかが不明なため、**加算した合計フレーム数(S)の意味が確定しない**。

### 2.3 R-A / R-B / R-D / R-E の判別軸記録

R-A は、target_combo 内の空振り可否について別の確定メモと実データの整合を記録している。

出典: `docs/progress/M19-RESEARCH-03-report.md:74-78`

> ### 想定外の発見(事実)
>
> - **`target_combo` の全行が `is_derived=true` ではない**。全15キャラで `category=target_combo` は67行あるが、うち**4行**(ザンギーフ `machine_gun_chops`/`machine_gun_chops_2hits`/`power_stomps`/`power_stomps_2hits`)は `is_derived=false`。これは `tmp/target-combo-and-derived-flag-rules.md`(2026-07-09 設計判断メモ)が定義する「パターン3(前段が空振りでも出る。例としてザンギ中P連打を明記)」の実例と一致する。同メモは「パターン3→`is_derived=false`(索引対象・空振りフレーム重視)、パターン1/2→`is_derived=true`(索引外)」と規定しており、実データはこの規定と整合していた。
> - 同メモは「必殺技の派生(強度/状態違いの分岐技)は `is_derived=true` の第4のパターン」であり、理由は指示書の(a)(単独不可)・(b)(コマンド衝突)いずれとも異なる「決定論的に一意解決できない(分岐が複雑)」であると明記している。R-A の `denjin_charge_*`・`thunder_kick`・`kasai_thrust_kick_during_od_*` はこのパターンの実例と整合する。
> - 同メモは「ホールド版・溜め版は command が異なるため `is_derived=false` のはず。ツールが実際にトークンを付けているか要確認」と自己点検を促していたが、`luke/flash_knuckle_perfect_light` は `hold` トークンが付いて command が異なるにもかかわらず `is_derived=true` であり、**メモが想定した「トークンが付けば false」という前提と実データが食い違う実例**が見つかった。

R-B の原文:

出典: `docs/progress/M19-RESEARCH-03-report.md:100-112`

> ### (a)/(b) の判別式の検証
>
> - **`category=target_combo`** は指示書(a)(「親技を出さないと出せない」)の**候補判別式**として提示されているが、R-A の発見のとおり `category=target_combo` の中にも `is_derived=false`(パターン3・4行)が含まれるため、**`category=target_combo` ⇔ (a)」の1対1対応ではない**(`category=target_combo AND is_derived=true` の63行が(a)相当という条件付きの対応)。
> - 一方で、(a)相当の性質(前段または特定状態を経ないと出せない)を持つと考えられる行が `target_combo` 以外にも実在する: `ryu/denjin_charge_hadoken`(要 電刃錬気状態)、`ken/thunder_kick`(要 `quick_dash` 状態。`command=k_m` 単体は通常の中Kと解決不能に衝突するため、単なる「単独では出せるがコマンドが被る」(b)としても説明はつくが、ゲーム上は `quick_dash` の状態を経ないと同技は出ない)。これらの行は `category`(special/unique)・`original_move_id`(NULL)・`is_derived`(true)のいずれの列を見ても、指示書(b)の教科書的な例(`guile/perfect_timing_light_sonic_boom` のような単純コマンド衝突)と**スキーマ上区別できない**。
> - `original_move_id` は `rush_variant` 専用列であり((c)以外では常にNULL)、(a)/(b)を分ける情報を持たない(`docs/design/03-data-model.md:277`)。
> - `docs/progress/M19-RESEARCH-02-report.md` R-C-2/R-C-4 も同型の結論(`thunder_kick` の起源は「判別不能」・汎用の親子リンクはスキーマに不在)に既に達している。
>
> ### 機械判別の可否: **no**
>
> 現状のスキーマ列・条件だけで (a) と (b) を機械的に判別することはできない。`category=target_combo AND is_derived=true` は(a)の**十分だが網羅的ではない**候補(63件)を捕捉できる一方、`category` が `target_combo`/`rush_variant` 以外の214件については、コマンド完全一致の有無(R-A の98件)で(b)の一部を絞り込めるにとどまり、残る116件(分岐元ありの36件+不明74件+状態接頭辞6件)は(a)相当・(b)相当のいずれとも確定できない。
>
> ### filler規則への含意(事実のみ)
> - 「(a)だけを機械的に除外する」規則は、`category=target_combo AND is_derived=true` を条件にすれば63件については実現できるが、それ以外に(a)相当(前段/状態前提で単独入力不可)の性質を持つ可能性がある行(denjin_charge系・thunder_kick等)は、この条件では除外できない(取りこぼす)。

報告末尾にも同じ判別式が記録されている。

出典: `docs/progress/M19-RESEARCH-03-report.md:188-191`

> ## M19 filler規則の判断材料((a)機械判別の可否)
>
> - **(a)を機械的に除外する条件式は `category=target_combo AND is_derived=true` のみ**であり、これは (a)群の一部(63件)しか捕捉できない。同種の性質を持つ可能性がある denjin_charge系等(必殺技派生・R-A不明群の一部)は同条件では捕捉できない。
> - 現行規則のまま filler を運用した場合、リュウ・KA=40・既定3種別という代表的な条件だけでも、提案の約9%が(a)群fillerを含む(R-D実測)。

R-D は filler と target の実測時の述語を次のように記録する。

出典: `docs/progress/M19-RESEARCH-03-report.md:150-152`

> - filler候補: リュウ全技のうち `total≥1` の84技(現行規則どおり、is_derivedを問わない)。うち R-A の(a)群(`category=target_combo`)は `fuwa_triple_strike`・`fuwa_triple_strike_2hits`・`high_double_strike` の3技。必殺技派生群(denjin_charge系)は8技。
> - target候補: 既定3種別(通常技・特殊技・必殺技(弾))で `collectTargets` を再現した結果、21技(`is_aerial`除外・非rush派生技除外・`damage>0`のみ、を適用済み)。
> - KA=40(監査 `M19-audit-20260725.md` B-add-1 が用いた値を踏襲。GC-1 のKAとも一致)。

R-E は rush_variant の起点の調査であり、ヒット／ガード限定派生の判別軸は記録していない（同 report `:168-178`）。

### 2.4 最優先探索で見つかった一次の設計判断メモ

RESEARCH-03 が `tmp/target-combo-and-derived-flag-rules.md` と呼ぶ文書は、現物では `docs/seed-data/target-combo-and-derived-flag-rules.md` にある。Git 履歴では `99cda67` で現パスに追加されている。

出典: `docs/seed-data/target-combo-and-derived-flag-rules.md:54-64`

> ## 相談 1: ターゲットコンボの 3 類型（空振り可否の区別）
>
> ### 1.1 開発者の発見（事実）
>
> TC には前段の成立条件で 3 類型ある:
>
> - **パターン1**: 一つ前の段が**ヒット時のみ**出る（ガードでは出ない）。
> - **パターン2**: 一つ前の段が**ヒット/ガード問わず当たれば**出る（＝ブロッキング時も出る）。
> - **パターン3**: 一つ前の段が**空振りでも出る**（例: ザンギの中P中P中P）。
>
> 本アプリはセットプレイに**空振りフレーム**が重要なため、**パターン3 は区別が必要**（空振りでも繋がる＝単独の連続技として空振りフレームが意味を持つ）。パターン1/2 は前段が当たらないと出ない＝空振りフレーム単体の意味が薄い。

出典: 同 `:77-102`

> **提案: `is_derived` の判定と整合する形で、パターン3 だけ扱いを変える。**
>
> ここで相談 0（派生技フラグ）と接続します。3 類型を派生技フラグの観点で見ると:
>
> | 類型 | 単独で出せるか | is_derived | 空振りフレームの意味 |
> |------|--------------|-----------|-------------------|
> | パターン1（ヒット限定） | 出せない（前段ヒット必須） | **true** | 薄い（前段当たらないと出ない） |
> | パターン2（当たれば） | 出せない（前段ガード以上必須） | **true** | 薄い |
> | パターン3（空振りでも） | **実質出せる**（前段空振りでも繋がる＝入力さえすれば出る） | **false（！）** | **重要** |
>
> **パターン3 は「入力すれば前段の成否に関係なく出る」＝コマンド入力解決の観点では単独で出せる技に近い**。よって:
>
> - **パターン3 → `is_derived=false`**（索引に載る＝段階2 で解決対象）。空振りフレームを持つ。
> - **パターン1/2 → `is_derived=true`**（索引に載らない＝直接指定）。空振りフレームは薄いので当てフレーム主体でよい。
>
> これで**新 type を作らずに**、派生技フラグ（既に導入する `is_derived`）がパターン3 の区別を兼ねられます。category は 3 類型とも `target_combo` のまま（ユーザーの技選択分類は一貫）、`is_derived` で「空振りでも出る＝索引対象＝フレーム重視」を表現。
>
> - **例外の確認**: パターン3 でも「前段の入力タイミングに依存する」等で厳密には単独と違う場合があるが、**セットプレイで空振りフレームが要る＝索引に載せたい**なら false、という運用基準で足ります。迷ったら「このコンボ段を、単発の技として空振りフレームで扱いたいか？」で判断。
>
> ### 1.4 パターン3 の判定運用（AI 判別不能・開発者手作業）
>
> - **パターン3（空振りでも出る）は公式データ・手入力データから機械判別できない**（前段の成立条件はゲーム内挙動でありデータに明示されない）。よって AI に `is_derived` を自動付与させない。
> - **AI チェックの役割**: 「パターン3 に該当しそうな入力技（同ボタン連打系 TC・空振り連携が疑われる TC 等）を**リストアップするだけ**」。実際の `is_derived=false` 付与は**開発者が手作業**で判断（ゲーム内挙動の知識が要るため）。
> - これは投入前 AI チェックプロンプト（`pre-seed-data-check-prompt.md`）の対象に追加すべき項目（下記 §4）。
>
> **確認 1-A**: パターン3 を `is_derived=false`（＝target_combo だが索引に載せ空振りフレーム重視）、パターン1/2 を `is_derived=true`（索引外・当てフレーム主体）とする方針でよいか。これなら category 追加も type 新設も不要。

開発者回答の反映状況:

出典: 同 `:180-190`

> ## 5. 開発者回答の反映状況（2026-07-09）
>
> | 確認 | 回答 | 反映 |
> |------|------|------|
> | 1-A（TC 3 類型・is_derived・category 増設なし） | OK | §1.3/§3 |
> | 2（派生技フラグ理解＋パターン3 運用） | **修正**: パターン3 TC は AI 判別不能＝AI はリストアップのみ・付与は開発者手作業。必殺技派生は is_derived=true（複雑分岐・直接指定）。フラグを立てるだけ（派生系譜の DB 化なし） | §0.1/§1.4 |
> | 3（TC 登録ルール・累積・n 段止め・(N hits)） | OK | §2 |
> | 2-A（地上不成立 TC の例外注記） | OK | §2.4 |
> | 2-B（TC 2 段目以降 NULL 吸収） | OK | §2.5 |
>
> **残る確認**: なし（必殺技派生の「情報を入れる」＝is_derived=true を立てるだけ、と解釈。派生系譜の DB 構造化はしない。この解釈で相違なければセルフチェック続行可）。相違があればご指摘ください。

## 3. §3.2 setup_only の否定形記録

### 3.1 M19-overview の節番号

現物の見出しは **`## 8. 確定済みで再検討しない事項（否定形の記録）`** であり、伝聞どおり §8 だった。

出典: `docs/instructions/M19-overview.md:166-171`

> ## 8. 確定済みで再検討しない事項（否定形の記録）
>
> | 事項 | 確定内容 | 出所 |
> |---|---|---|
> | `setup_only` の意味 | **「セットプレイ専用 move の行区分」**（コンボ登録 UI の技選択から除外）。**filler 絞り込みには使わない** | DES-003 §3.3 errata③・followup §H(c) |
> | `is_derived` の意味 | 「入力トークン単独では技を解決できない」。**単独で出せる技にも true が付く**（コマンド衝突回避） | DES-003 §3.3 errata③ |

### 3.2 DES-003 の節番号・errata 日付

現物の見出しは **`### 3.3 moves（技マスタ）`**（`docs/design/03-data-model.md:269`）であり、伝聞どおり §3.3。errata 日付は **2026-07-26**。

出典: `docs/design/03-data-model.md:319-321`

> | is_derived | BOOLEAN | NOT NULL, DEFAULT false | **派生技フラグ**（CHANGE-069・M17-02・マイグレ 000032）。**主たる役割＝段階2 のコマンド入力解決の索引から除外すること**（DES-004 §2.4）。**当初の判定原理**＝**「コントローラでこの技だけをいきなり出せるか？ 出せない → true」**（前段の技で特殊状態になってからの追加入力／ターゲットコンボ 2 段目以降／必殺技の派生／特定状態でのみ出る強化版・ジャスト版＝true。ターゲットコンボ 1 段目・通常の必殺技/特殊技・空中特殊技・ホールド版/溜め版＝false）。**判定源は入力ツール側の人手付与＝本体は CSV 値を信頼し導出しない**（CHANGE-065 と同型）。**`rush_variant` は true**（ドライブラッシュ状態でのみ出る＝画面18〔FR703〕の生成時に定数で立てる）。`DuplicateKey`・`recipe_hash` 非対象。**model の `Move` 構造体には持たせていない**＝`GET /api/moves` のレスポンスに出ない（UI で使う場合は model／DTO／SELECT 列の同期追加が要る） | **【2026-07-26 errata③・重要】この判定原理だけでは実データを説明できない**：`is_derived=true` の 514 行のうち**少なくとも 96 行は「単独では出せるが他技とコマンドが完全一致するため索引衝突を避ける」ことが付与理由**である（開発者確認 2026-07-26＝**「単独で出せても、他とコマンドが被る可能性があるものは true」**／M19-RESEARCH-03 の分布実測）。したがって **`is_derived=true` を「単独入力が不可能」と読み替えてはならない**。**「単独入力が不可能」と「コマンドが被る」は現行スキーマでは機械判別できない**（同一シグネチャの実例が存在する）。**消費側の含意**：本列を「入力可能性」の代理として使う設計（例＝セットプレイ提案の filler 除外）は**成立しない**。実際、セットプレイ自動提案の filler 規則は本列ではなく `category != target_combo` で定めている（M19-02）。また **`category=target_combo` と本列は 1 対 1 ではない**（`is_derived=false` の target_combo が 4 行実在）。付与は入力ツール側の人手であり、**本体は CSV 値を信頼して導出しない**（この方針は不変）。
> | is_aerial | BOOLEAN | NOT NULL, DEFAULT false | 空中判定。ジャンプ攻撃・空中技は true。ラッシュ可否（`category ∈ {normal, unique}` かつ `is_aerial = false`）の判定に用いる。**さらに段階2 の解決表の除外条件として機能する**（`is_aerial = true` は解決表に載せない＝**空中特殊技は段階2 スコープ外＝直接指定**。DES-004 §2.4・CHANGE-069）。**この列の精度が段階2 解決の正しさに効く**（実例: `lily/great_spin`・`kimberly/elbow_drop` は `is_aerial=true`・command が `d plus p_h`／`d plus p_m` で、false のままだと しゃがみ強P／しゃがみ中P と索引衝突する）。**空中特殊技は true が必須**（空中必殺技の false は無害＝command が方向の列で段階2 スコープ外）。取込時は公式名に「ジャンプ／（ジャンプ中に）」を含む技を true、接頭辞の付かない空中技（ジャンプから出す特殊技等）は利用者が FR703 で手動 true 化（CHANGE-022） |
> | setup_only | BOOLEAN | NOT NULL, DEFAULT false | セットプレイ専用フラグ。true の move はコンボ登録UIの技選択から除外する（CHANGE-022）。**【2026-07-26 errata③】従来の「将来のセットプレイ自動提案機能のための予約列・利用ロジックは未実装」という記述は陳腐化した**：セットプレイ自動提案は M19-01 で実装済みだが、**本列による filler の絞り込みは行わない**と確定している。理由＝本列の実セマンティクスは**「セットプレイ専用 move の行区分」**であって**「セットプレイに有用な技」を意味するフラグではない**ため（絞り込みに使うと有効な filler を落とす）。したがって本列の役割は**コンボ登録 UI からの除外のみ**である |

### 3.3 setup_only 列の実在

存在する。

出典: `migrations/000013_add_moves_frame_columns.up.sql:4-11`

```sql
ALTER TABLE moves ADD COLUMN startup                    INTEGER;
ALTER TABLE moves ADD COLUMN active                     INTEGER;
ALTER TABLE moves ADD COLUMN total                      INTEGER;
ALTER TABLE moves ADD COLUMN on_hit                     INTEGER;
ALTER TABLE moves ADD COLUMN on_block                   INTEGER;
ALTER TABLE moves ADD COLUMN drive_gauge_decrease_guard INTEGER;
ALTER TABLE moves ADD COLUMN is_aerial                  INTEGER NOT NULL DEFAULT 0;  -- BOOLEAN
ALTER TABLE moves ADD COLUMN setup_only                 INTEGER NOT NULL DEFAULT 0;  -- BOOLEAN
```

## 4. §3.3 filler 規則の設計本体

`ls docs/handover/` の現物は次の 2 ファイルだった。

- `docs/handover/M19-DESIGN-02-suggestion-logic.md`
- `docs/handover/M19-DESIGN-05-startup-moves-frame-model.md`

### 4.1 M19-DESIGN-02 の target 候補

出典: `docs/handover/M19-DESIGN-02-suggestion-logic.md:36-43`

> ## 2. target（当てたい技）の列挙規則（MVP 確定案）
>
> target 候補 = 当該キャラの moves のうち、`startup ≥ 1` かつ `active ≥ 1` かつ次のいずれか:
>
> 1. `startup_basis = standalone`（相当）かつ**親参照なし**＝単独入力で出せる技。中央スキーマ確定までの暫定判定は `is_derived = false`（DES-003 判定原理「いきなり出せるか」による保守側ゲート。中央確定後は親参照導出が一次で、is_derived への依存は解消する）。
> 2. `startup_basis = through`（相当）＝通し値の派生技・ジャンプ入力起点の必殺技等。**通し値をそのまま `Target.Startup` に渡す**（親は計上しない）。
>
> 除外: `unknown`（判別未了・警告つき除外）／`standalone ∧ 親参照あり`（パターン 3・5・6＝単独入力不可）／状態変種（親参照なしだが is_derived=true＝MVP は保守側で除外・将来拡張枠）／`is_aerial = true`（C 型ジャンプ攻撃＝着弾可変でスカラー S 非対応）／**B 型 air-only 技**（人手除外マーキング・M19-DESIGN-01 §3-8）。非攻撃技（damage=0 のパリィ・魔身等）の除外基準は M19-01 実装時に確定（小残件・§10）。投げは golden-case GC-3 で target 実績があるため**含める**。列名・判別手段は中央スキーマ確定に依存（M19-DESIGN-01 R4・R7）。中央確定までの暫定 PoC は「golden-case の技を明示指定」で回避可能。

列・値・述語は `startup`、`active`、`startup_basis`（`standalone` / `through` / `unknown`）、親参照、`is_derived`、`is_aerial`、B 型 air-only の人手マーキング、`damage` である（同 `:38-43`）。

### 4.2 M19-DESIGN-02 の filler 候補

出典: 同 `:56-60`

> ## 5. filler（空振り技）候補の規則
>
> - 基本: `total ≥ 1` の技（エンジン sanitize と整合）。through の技も通し total で参加可。
> - `moves.setup_only`（予約列・seed 0 件）は「filler 候補を実用技に絞る」ユーザー付与フィルタとして**活用を開始**する（ON 行が 1 件以上あるキャラはそれのみ、0 件なら全技＝graceful）。付与運用は開発者に委ねる。
> - 空振り時硬直変動技（DES-003 §3.3 注記「空振り時硬直 N フレーム増加は total 非算入」）は total が実挙動とズレるため、**raw_data/notes に当該注記を持つ技を filler から除外しない**が提案理由の注記対象とする（MVP は非対応・既知割り切りを DoD に明記）。

列・値・述語は `total ≥ 1`、`setup_only` のキャラ内 ON 行有無、`raw_data/notes` の注記である（同 `:58-60`）。`setup_only` の規則は後に撤回された（本報告 §3）。

### 4.3 M19-DESIGN-05

このファイルには filler／target の完成した抽出式は無かった。現物は「スタートアップ指示」であり、既存規則と追加確認事項を次のように記録している。

出典: `docs/handover/M19-DESIGN-05-startup-moves-frame-model.md:68-76`

> ## 4. 前提として既に確定していること（ここは動かさない）
>
> - **重ね判定の式**（DES-003 §3.4 に明文化済み）: `knockdown_advantage`（KA）＝ダウン中の無敵時間。相手の起き上がりは **KA+1** フレーム目。`S = Σ(先行ステップの total) + target の startup`（＝当てたい技の第 1 active の絶対フレーム）。`N = KA + 2 − S`。成立条件 `1 ≤ N ≤ active`。
> - **汚連携（あえて重ねない）のギャップ** `G = 1 − N`（M19-02 で実装中）。上式から代数的に導かれます。**新しい式を持ち込まないでください**。
> - **既存列の値の解釈を変えない**（中央の整合観点）。`startup` / `total` の既存値を書き換えると M18-02 の確定反撃走査・既存コンボの表示・CSV 互換に波及します。**新しい意味は新しい列に置く**のが安全側です。
>   - ただし注意: **既存値の意味は現時点で一様ではありません**（通し値・単発値・段の発生が混在）。「既存の解釈を守る」は「**既に入っている数値を書き換えない**」の意であって、「意味が一つに決まっている」という意味ではありません。
> - **`is_derived` は「単独入力不可」ではありません**。実態は「入力トークン単独では技を解決できない（＝コマンド索引から除外する）」であり、**単独で出せる技にもコマンド衝突回避で true が付きます**（514 行中 96 行以上）。**本件のマーカーに流用できません**（DES-003 §3.3 errata③ に明記済み）。
> - **`category = target_combo` は `is_derived` と 1 対 1 ではありません**（`is_derived=false` の target_combo が 4 行実在）。
> - **M19-02 では filler から `category = target_combo` を除外済み**です（`total` の意味が判別不能なため）。あなたの設計で判別できるようになれば、**この除外を解除できます**——それが本設計の成果の 1 つになります。

空振り成立に関する確認事項:

出典: 同 `:84-90`

> 1. **チェーンできる組み合わせは規則で決まるか**（弱P→弱K のように一覧化できるか）、それとも技ごとに個別か。
> 2. **チェーンしたとき親技が実際に消費するフレームは何で決まるか**（キャンセル可能になるフレーム＝技ごとの固定値か／入力タイミングで変動するか）。
> 3. **公式フレーム表の `target_combo` の「全体」は何を指すか**（1 段目から最後までか／その段だけか）。※データ側からは判別不能と結論済み（RESEARCH-03 R-C）なので、**答えは開発者または公式表の読み方からしか得られません**。
> 4. **通し値になっている技は rush 版と `target_combo` 以外にもあるか**（SA キャンセル・必殺技派生など）。
>    > **既に一部わかっています**（M19-DESIGN-01 §3-4）: 同一 CSV 内に**通し値**（流酔拳 2 発止め su33）・**初段発生**（幻酔舞系 TC＝全変種 su12）・**段自体の発生らしき値**（乱酔旋 3 段目 su14/su4）が混在しています。**行単独で意味論を判別する手段がありません**。この既知事実を出発点にしてください。
> 5. **（M19 追加）チェーンキャンセルは「空振り」でも成立するか**。セットプレイの filler は**空振り**です。ヒット時・ガード時にしかチェーンできないなら、**提案の filler としては使えません**（＝(i) は「取りこぼしの回復」ではなく「過大計上の是正」だけが論点になる）。**ここで設計の規模が大きく変わります。最初に確認してください。**
> 6. **（M19 追加）チェーンの短縮量は「親の total を丸ごと消さない」のか**。派生技の通し値規約は「親は計上ゼロ」でしたが、チェーンは「親を途中まで出してからキャンセル」なので**部分消費**のはずです。**同じ規約で吸収できるのか、別の表現が要るのか**が設計の分岐点です。

## 5. §3.4 実装側の現物

### 5.1 filler 候補

出典: `internal/service/setplay/service.go:267-281`

```go
byCode := make(map[string]setplayrepo.MoveCandidate, len(cands))
fillers := make([]Move, 0, len(cands))
for _, m := range cands {
	byCode[m.Code] = m
	// filler 候補: total ≥ 1 かつ category != target_combo(§4.1・RESEARCH-03 R-C/R-D)。
	//   target_combo(多段技 2 段目以降)は単独で空振りできず、total の意味も判別不能なため除外。
	//   is_derived / rush_variant / setup_only では絞らない(§4.1「除外しないもの」)。
	// M19-LIMITATION-NOTICE (c): この filler 規則を変更したら、ヒント文面
	//   (web i18n `setplay.limitations.*`)を同時に更新すること。
	if m.Total != nil && *m.Total >= 1 && m.Category != model.MoveCategoryTargetCombo {
		fillers = append(fillers, Move{Name: m.Code, TotalFrames: *m.Total})
	}
}

targets := collectTargets(cands, params)
```

エンジン側にも非正 total の除外がある。

出典: `internal/service/setplay/setplay.go:203-222`

```go
func sanitize(moves []Move) []Move {
	seen := make(map[Move]struct{}, len(moves))
	out := make([]Move, 0, len(moves))
	for _, m := range moves {
		if m.TotalFrames <= 0 {
			continue // 未設定/NULL とみなし黙って除外
		}
		if _, dup := seen[m]; dup {
			continue
		}
		seen[m] = struct{}{}
		out = append(out, m)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].TotalFrames != out[j].TotalFrames {
			return out[i].TotalFrames < out[j].TotalFrames
		}
		return out[i].Name < out[j].Name
	})
	return out
}
```

### 5.2 target 候補

カテゴリから target type への写像:

出典: `internal/service/setplay/service.go:128-156`

```go
func moveTargetType(mc setplayrepo.MoveCandidate, catByID map[int64]string) string {
	switch mc.Category {
	case model.MoveCategoryNormal:
		return TargetTypeNormal
	case model.MoveCategoryUnique:
		return TargetTypeUnique
	case model.MoveCategoryThrow:
		return TargetTypeThrow
	case model.MoveCategorySpecial:
		if mc.IsProjectile {
			return TargetTypeSpecialProjectile
		}
		return TargetTypeSpecial
	case model.MoveCategoryRushVariant:
		// 元技のカテゴリで rush 種別を判定する(元 normal→normal_rush、元 unique→unique_rush)。
		if mc.OriginalMoveID == nil {
			return ""
		}
		switch catByID[*mc.OriginalMoveID] {
		case model.MoveCategoryNormal:
			return TargetTypeNormalRush
		case model.MoveCategoryUnique:
			return TargetTypeUniqueRush
		default:
			return "" // 元 special 等のラッシュは提供しない
		}
	default:
		return ""
	}
}
```

target の全述語:

出典: 同 `:390-435`

```go
func collectTargets(cands []setplayrepo.MoveCandidate, params SuggestParams) []setplayrepo.MoveCandidate {
	typeSet := make(map[string]bool, len(params.TargetTypes))
	for _, t := range params.TargetTypes {
		typeSet[t] = true
	}
	// rush_variant の元技カテゴリ解決用に id→category を作る。
	catByID := make(map[int64]string, len(cands))
	for _, m := range cands {
		catByID[m.ID] = m.Category
	}
	out := make([]setplayrepo.MoveCandidate, 0, len(cands))
	for _, m := range cands {
		// 条件 1: startup ≥ 1 かつ active ≥ 1(いずれか NULL の技は除外)。
		if m.Startup == nil || *m.Startup < 1 || m.Active == nil || *m.Active < 1 {
			continue
		}
		if params.TargetMoveID != nil {
			// 明示指定モード: 指定 move のみ。種別/damage/is_derived/is_aerial は適用しない
			// (ユーザーが技を直接選んだため。§4.2 明示指定)。ただし system は常に対象外
			// (§4.6-2・DES-005 §5.6 項目12「category=system は常に対象外」。BE 側でも除外)。
			if m.ID == *params.TargetMoveID && m.Category != model.MoveCategorySystem {
				out = append(out, m)
			}
			continue
		}
		// 自動列挙。
		// M19-LIMITATION-NOTICE (b): この target 列挙規則(種別 type・is_aerial 除外・
		//   is_derived 除外〔rush 種別は除外しない〕・damage>0 既定)を変更したら、
		//   ヒント文面(web i18n `setplay.limitations.*`)を同時に更新すること。
		ttype := moveTargetType(m, catByID)
		if ttype == "" || !typeSet[ttype] {
			continue // 選択された種別以外(system/SA/元 special ラッシュ等の "" を含む)は対象外
		}
		if m.IsAerial {
			continue
		}
		// rush 種別は is_derived=true が正常。非 rush の派生技(target_combo 2nd hit・状態変種等)は除外。
		if m.IsDerived && !isRushTargetType(ttype) {
			continue
		}
		if !params.IncludeZeroDamage && (m.Damage == nil || *m.Damage <= 0) {
			continue // ダメージ 0/NULL(ドライブパリィ等)は既定で target にしない(重ねる概念がない)
		}
		out = append(out, m)
	}
	return out
}
```

実際の述語は次のとおり。

- filler: `Total != nil`、`Total >= 1`、`Category != target_combo`（`service.go:269-278`）。
- target 共通: `Startup != nil && Startup >= 1 && Active != nil && Active >= 1`（同 `:401-405`）。
- target 自動列挙: 選択 target type、`IsAerial == false`、非 rush の `IsDerived == false`、既定で `Damage > 0`（同 `:415-433`）。
- target 明示指定: startup/active の共通条件と `Category != system` だけで、type／damage／is_derived／is_aerial を適用しない（同 `:402-413`）。

### 5.3 target_combo 除外箇所の全数

`internal/service/setplay/` 配下の `target_combo` 出現を全件確認した。実装上の除外経路は次の 3 件。

1. filler の直接述語 `m.Category != model.MoveCategoryTargetCombo`（`internal/service/setplay/service.go:271-277`）。
2. target 自動列挙のカテゴリ写像に `target_combo` case が無く、default で空文字になり `ttype == ""` で除外（同 `:128-156,419-421`）。
3. target 自動列挙では、target_combo の `IsDerived=true` 行は非 rush 派生除外にも該当する（同 `:423-428`）。ただし 2 が先に成立する。

明示 target はカテゴリによる target_combo 除外を行わない（同 `:406-413`）。`ingrid/satelite_leap` は startup/active が NULL なので、明示 target でも共通条件で先に除外される（`character_data/ingrid.csv:31` と `service.go:402-405`）。

テストの原文:

出典: `internal/service/setplay/refine_test.go:40-65`

```go
func TestRefine_FillerExcludesTargetCombo(t *testing.T) {
	svc := newService(newCombo(ptr(40)), fillerProbeMoves(), nil)
	res, err := svc.SuggestForCombo(context.Background(), 1, SuggestParams{TargetTypes: allTypes()})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Proposals) == 0 {
		t.Fatal("expected proposals")
	}
	if fillerCodesUsed(res)["tc20"] {
		t.Error("category=target_combo move must NOT be used as filler")
	}
}

// §4.1「除外しないもの」: is_derived / rush_variant / setup_only は filler に含まれる。
func TestRefine_FillerIncludesDerivedRushSetupOnly(t *testing.T) {
	svc := newService(newCombo(ptr(40)), fillerProbeMoves(), nil)
	res, err := svc.SuggestForCombo(context.Background(), 1, SuggestParams{TargetTypes: allTypes()})
	if err != nil {
		t.Fatal(err)
	}
	used := fillerCodesUsed(res)
	for _, code := range []string{"normal18", "derived19", "rush20", "setuponly21"} {
		if !used[code] {
			t.Errorf("filler %s must be usable (is_derived/rush/setup_only are not excluded)", code)
		}
	}
}
```

### 5.4 空振り可否に相当するコード／コメント

`internal/service/setplay/` では `空振り` が多数現れるが、技データの空振り可否を表すフィールドは無い。直接該当するコメントは `service.go:271-273` の「target_combo は単独で空振りできず」であり、述語は category 一律除外である。`whiff` は `refine_test.go:202` の gap 境界検証 1 件。`ヒット時のみ`／`ガード時のみ`／`ヒット限定`／`派生条件` は `internal/service/setplay/` に 0 件だった。

## 6. §3.5 横断 grep

### 6.1 件数

対象は `docs/` と `internal/`。件数は**本レポート作成前**に計測した **マッチ行数**、括弧内はファイル数。大文字小文字を区別しない検索を含む（作成後は本レポート自身の引用がヒットへ加わる）。

| 系統 | キーワード | ヒット件数 |
|---|---|---:|
| 空振り | `空振り` | 220 行（67 ファイル） |
| 空振り | `whiff` | 14 行（7 ファイル） |
| 空振り | `ヒット時のみ` | 3 行（3 ファイル） |
| 空振り | `ガード時のみ` | 0 行（0 ファイル） |
| 空振り | `ヒット限定` | 3 行（3 ファイル） |
| 空振り | `派生条件` | 3 行（3 ファイル） |
| 候補絞り込み | `filler` と `除外` が同一行 | 65 行（24 ファイル） |
| 候補絞り込み | `target_combo` と `除外` が同一行 | 43 行（22 ファイル） |
| 候補列 | `setup_only` | 140 行（60 ファイル） |
| 候補列 | `condition_ja` | 130 行（53 ファイル） |
| 候補列 | `condition_en` | 81 行（43 ファイル） |
| 候補列 | `move_derivations` | 85 行（27 ファイル） |
| 該当技 | `double_shot` | 5 行（4 ファイル） |
| 該当技 | `drake_fang` | 2 行（2 ファイル） |
| 該当技 | `phantom_cutter` | 4 行（4 ファイル） |
| 該当技 | `recoil_cannon` | 5 行（4 ファイル） |
| 該当技 | `satelite_leap` | 5 行（4 ファイル） |

検索コマンド相当は `rg -n -i '<keyword>' docs internal`。件数は同出力を `rg -c '^'` で数え、ファイル数は `rg -l -i '<keyword>' docs internal` を同様に数えた。

### 6.2 判別軸に直接関係した代表箇所

- `ヒット時のみ`／`ヒット限定`／`派生条件`: `docs/seed-data/target-combo-and-derived-flag-rules.md:60,83`、`docs/handover/M19-DESIGN-01-central-requirements.md:27`。
- `空振り`: 同メモ `:62-64,85,89-99`、`docs/handover/M19-DESIGN-07-frame-cost-model.md:161`、`internal/service/setplay/service.go:271-277`。
- `filler`＋`除外`: `docs/instructions/M19-02-suggestion-refinement.md:163-181`、`docs/handover/M19-DESIGN-07-frame-cost-model.md:112-119`、`internal/service/setplay/service.go:271-277`。
- `target_combo`＋`除外`: `docs/instructions/M19-overview.md:109-111`、`docs/instructions/M19-02-suggestion-refinement.md:163-181`、`internal/service/setplay/service.go:271-277`。
- `whiff` の 14 行中、`internal/service/setplay/refine_test.go:202` は gap の境界検証。`docs/human-notes/future-notes/` の `whiff_or_counter` はプレッシャーシーケンス用の別概念（例: `docs/human-notes/future-notes/combmgr-pressure-sequence-consolidated.md:61,94,101,139`）。

### 6.3 候補列の現物

`condition_ja` / `condition_en` は CSV 契約には存在する。

出典: `internal/seedgen/model.go:22-30,74-81`

```go
var csvColumns = []string{
	"character_code", "move_code", "category", "name_ja",
	"startup", "active", "recovery", "total",
	"on_hit", "on_block", "damage",
	"is_aerial", "is_projectile", "is_derived",
	"notes", "notes_tool", "original_move_code",
	"command", "condition_ja", "condition_en",
	"startup_basis", "chain_cancel_total", "fastest_unreachable",
}
```

> `ConditionJA      string // 保全のみ・SQL 非投入`
>
> `ConditionEN      string // 保全のみ・SQL 非投入`

`condition_ja` は moves の DB 列ではなく、000018 で raw_data からも除去済みと記録されている。

出典: `docs/progress/M19-04-completion-report.md:166-168`

> 各行に `character_code` / `move_code` / `name_ja` / `category` / `is_derived` / `is_aerial` / `command` / `startup` / `total` / `original_move_code` / `condition_ja` を添え、`character_code` 順 → `move_code` 順で安定ソートした。
>
> **★`original_move_code` と `condition_ja` は `moves` の列として存在しない**（前者は seedgen が `original_move_id`(INTEGER) へ解決して投入、後者は 000018 で `raw_data` から除去済み）。一覧では `character_data/*.csv` を結合して補った。

`move_derivations` は DDL が存在する。

出典: `migrations/000049_add_moves_frame_cost_columns.up.sql:16-34,49-53`

```sql
-- startup 列に入っている値が「単独で出したときの値」か「連携の中で出した通し値」かの由来。
--   standalone = 単独値 / through = 通し値 / unknown = 未判定（暗黙に単発扱いしない）。
--   既存行は unknown 起点。機械で決まる分は 000050、人手判断分は Phase 2 で埋める。
ALTER TABLE moves ADD COLUMN startup_basis TEXT NOT NULL DEFAULT 'unknown';

-- 派生の親子関係。子＝派生技、親＝表記用の元技。R3 表記展開 / R4 の単独入力可否導出
--   （standalone ∧ 親参照あり → 単独入力不可）/ R6 整合検査に使う。
--   親参照列 1 本ではなく関連テーブルにするのは、複数親を行追加だけで表現するため（DESIGN-07 §3 R5）。
CREATE TABLE move_derivations (
    child_move_id  INTEGER NOT NULL REFERENCES moves(id) ON UPDATE CASCADE,
    parent_move_id INTEGER NOT NULL REFERENCES moves(id) ON UPDATE CASCADE,
    PRIMARY KEY (child_move_id, parent_move_id)
);
```

`migrations/` と `internal/` で `INSERT INTO move_derivations` を検索した結果は 0 件で、現時点では DDL のみ（`migrations/000049_add_moves_frame_cost_columns.up.sql:49-58`）。セットプレイ候補の repository も `startup_basis` と `move_derivations` を取得していない。

出典: `internal/repository/setplay/repository.go:16-29,43-52`

```go
type MoveCandidate struct {
	ID             int64
	Code           string
	Category       string
	OriginalMoveID *int64 // rush_variant の元技(通常技/特殊技)を指す。rush 種別の判定に使う
	Startup        *int
	Active         *int
	Total          *int
	Damage         *int
	IsDerived      bool
	IsAerial       bool
	IsProjectile   bool
	SetupOnly      bool
}

const listCandidatesSQL = `
SELECT m.id, m.code, m.category, m.original_move_id, m.startup, m.active, m.total, m.damage,
       m.is_derived, m.is_aerial, m.is_projectile, m.setup_only
FROM moves m
WHERE m.character_id = ?
ORDER BY m.id`
```

### 6.4 指定された技の現物

CSV ヘッダと各行の原文。5 技とも `category=target_combo`、`is_derived=true`。`condition_ja` / `condition_en` / `startup_basis` は空欄である。

出典: `character_data/guile.csv:1,21-24`、`character_data/ingrid.csv:1,31`

```csv
character_code,move_code,category,name_ja,startup,active,recovery,total,on_hit,on_block,damage,is_aerial,is_projectile,is_derived,notes,notes_tool,original_move_code,command,condition_ja,condition_en,startup_basis,chain_cancel_total,fastest_unreachable
guile,recoil_cannon,target_combo,リコイルキャノン,16,3,26,44,,-9,1200,false,false,true,,,,p_m chain l plus p_h,,,,,
guile,double_shot,target_combo,ダブルバレット,12,3,16,30,,-6,960,false,false,true,,,,d plus p_m chain d plus p_m,,,,,
guile,drake_fang,target_combo,ドレイクファング,20,3,21,43,1,-5,1140,false,false,true,,,,d plus k_m chain r plus p_m,,,,,
guile,phantom_cutter,target_combo,ファントムカッター,10,3,25,37,,-12,930,false,false,true,,ガードフレームはこれが正しい。インゲームで全てガード設定だとCPUが立つのが遅いので-10になる。,,d plus k_h chain dr plus k_h,,,,,
ingrid,satelite_leap,target_combo,サテライトリープ,,,,,,,1400,false,false,true,,,,k_h chain k_h,,,,,
```

調査開始前から未コミット変更だった `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md` には、Guile 4 技について次の記入がある。

出典: 同ファイル `:84-110`

> | guile | `double_shot` | ダブルバレット | target_combo | 1 | 0 | `d plus p_m chain d plus p_m` | 12 | 30 |  |  |　standalone, target_comboだが空振りでは出ない技 |
>
> | guile | `drake_fang` | ドレイクファング | target_combo | 1 | 0 | `d plus k_m chain r plus p_m` | 20 | 43 |  |  | standalone, target_comboだが空振りでは出ない技 |
>
> | guile | `phantom_cutter` | ファントムカッター | target_combo | 1 | 0 | `d plus k_h chain dr plus k_h` | 10 | 37 |  |  | standalone, target_comboだが空振りでは出ない技 |
>
> | guile | `recoil_cannon` | リコイルキャノン | target_combo | 1 | 0 | `p_m chain l plus p_h` | 16 | 44 |  |  | standalone, target_comboだが空振りでは出ない技 |
>
> | ingrid | `satelite_leap` | サテライトリープ | target_combo | 1 | 0 | `k_h chain k_h` |  |  |  |  |  |

## 7. §3.6 未決として閉じた記録

### 7.1 M19-overview §8

§8 は `setup_only` と `is_derived` の否定形を記録するが、本論点専用の行は無い（`docs/instructions/M19-overview.md:166-182`）。関連する原文は本報告 §3.1 に引用した `:170-171`。

### 7.2 followup-backlog

本論点と隣接するスラッグは次の 3 件。ヒット／ガード限定派生の判別軸そのものを名指ししたスラッグは無かった。

出典: `docs/handover/followup-backlog.md:230,235,239`

> | **M19-air-only-exclusion**（a） | **B 型 air-only 技の除外マーキング**。ケン空中竜巻旋風脚のような「最速で出しても当たらない空中技」は `is_derived=false`・`is_aerial=false`・`basis=standalone` の全ゲートを通過し**機械判別できない**。M19-01 では誤提案として出得るが、提案は表示→採択（FR307）のため **MVP は許容**（開発者確定）。恒久対策は `moves` への専用フラグ 1 本が素直（**moves 系＝中央帰属**） | 保留（MVP 許容）・件数は M19-01 完了報告で実測 |
>
> | **M19-flag-semantics-drift**（f） | **`is_derived` / `is_aerial` の実セマンティクス乖離**。`is_derived` の実態は「入力トークン単独では技を解決できない」で酔いレベル変種など非派生技にも true。`is_aerial` の実態は「ラッシュ版自動生成の除外」でジャンプ起点の必殺技は false であり、**DES-003 §3.3「ジャンプ攻撃・空中技は true」の文言と乖離**。CHANGE-069 が `is_aerial` を空中意味論で解決表除外に使っているため**整合確認を推奨**（**moves 系＝中央帰属**） | 中央裁量・派生技モデル設計時に併せて判断 |
>
> | **moves-frame-model-startup-basis**（j） | **【2026-07-26 登録・親チャット帰属】派生技フレームモデル（`startup_basis` ＝ standalone／through／unknown ＋表記用の親参照）**。従来 §H に独立 ID がなく、末尾注記と handover にのみ存在していたため本登録で ID を与える（**参照時の取り違え防止**）。**確定した一次事実**＝`rush_variant` の `startup`／`total`（元技 +11）は**通し値**である（開発者回答 2026-07-26＝「ニュートラル起点で、ラッシュを最速キャンセルして技を出したときの**ラッシュ分＋技分**」＝(e) クローズで確定）。**`target_combo.total` は「派生部分のみ」か「連携全体」か判別不能**（M19-RESEARCH-03 R-C＝加算検算で +6〜+40 の乖離・負値も発生）。**ブロッカー性**＝**M19-02 段階 2（through target 解禁・golden 5/5）の唯一のブロッカー**。**処遇**＝(i) と束ねて 1 課題として設計。設計時に **(f) の整合確認**と **(a) の専用フラグ要否**を併せて判断（§H 末尾注記の履行）。**承認ゲート（新テーブル・新列）** | **未起票（中央で設計論点整理中）** |

`M19-air-only-exclusion` の本文は「技の使用者が空中から出すが地上相手に最速で届かない技」を扱っており、`ingrid/satelite_leap` の「相手が空中にいるときだけ出せる target_combo」は本文に記録されていない（同 `:230`）。

### 7.3 parallel-board §4

現物の見出しは **`## 4. 保留事項（開発者判断待ち）`**（`docs/process/parallel-board.md:331`）。`P-01`〜`P-15` を確認したが、本論点に相当する保留項目は無い（同 `:333-349`）。文書番号の二義性に関係する P-08 は次の原文。

出典: 同 `:342`

> | ~~P-08~~ | ~~`M19-DESIGN-07-frame-cost-model.md` の配置~~ | — | **【2026-07-30 解消】** 実体は `M19-DESIGN-06-frame-cost-model.md` として追跡されており、**二重発番の解消（06 → 07）が文書内部の番号にだけ適用されファイル名に適用されていなかった**ための参照切れだった。開発者が `M19-DESIGN-07-frame-cost-model.md` へリネーム済み（v1.0.4）。**M19-04 のブロッカーは解消**。※ `M19-DESIGN-06-setplay-condition-record.md` v1.1.0 は別文書で 06 のまま正しい |

Git 履歴でも `d710670` に `docs/handover/M19-DESIGN-06-frame-cost-model.md` から `docs/handover/M19-DESIGN-07-frame-cost-model.md` への rename（R099）がある。現存する `M19-DESIGN-06-setplay-condition-record.md` を `空振り|whiff|target_combo|is_derived|filler|派生条件|startup_basis` で検索した結果は 0 件。したがって本報告では、成立条件の別文書を **`M19-DESIGN-06-setplay-condition-record.md`**、フレーム費用モデルを **`M19-DESIGN-07-frame-cost-model.md`（改番前ファイル名 `M19-DESIGN-06-frame-cost-model.md`）** と常にファイル名で区別する。

### 7.4 M19-引き継ぎキットの未決一覧

現物の見出しは **`## 4. M19 側に残った未決事項`**（`docs/handover/M19-引き継ぎキット.md:115`）。全項目の原文:

出典: 同 `:117-125`

> | # | 事項 | 誰が | 状態 |
> |---|------|------|------|
> | 1 | 新列の値の置き場所（CSV vs DB backfill 専用） | 開発者 | 預かり。M19-04 着手前に要決定（§2.1） |
> | 2 | ザンギエフ連打版 3 行の `moves` 登録 | 開発者 | 個別承認待ち（M19-04 着手時） |
> | 3 | B 型 air-only の実件数 | — | `fastest_unreachable` の人手付与で判明する。**事前の定量は不能**（機械判別できないため） |
> | 4 | セーフジャンプ定数のデータ形 | 開発者＋並行 MS | 設計予約のみ（`M19-DESIGN-02` §9）。ジャンプ/ダッシュフレームの整備待ち |
> | 5 | `OKI_TECH_TYPE_LABELS` の i18n 化（EN で受け身ラベルのみ日本語） | 開発者 | 当面許容。英語版をまとめて直す際に対応 |
> | 6 | 未検証セルのメモの永続化 | — | **無理に実現しないほうがよい**。永続化には「未検証の行を許す」＝三値の表現方式そのものの変更が要る。現行の対処（下書き保持＋保存無効化＋明示メッセージ）が最善手 |
> | 7 | FK 強制の接続単位問題の根治 | — | **独立サブ推奨**（全テーブルの FK 挙動を変えるため） |

本論点に相当する未決項目は無い。なおこの未決一覧の 1・2 は後に parallel-board §4 で解消済みと記録されている（`docs/process/parallel-board.md:335-336`）。

## 8. 設計文書と実装の食い違い

### 8.1 M19-DESIGN-02 の setup_only と後続正典

- `M19-DESIGN-02-suggestion-logic.md:59` は setup_only を filler 絞り込みに使うと記録する。
- `M19-overview.md:153,166-171` は DESIGN-02 §5 の案を撤回済みと明記し、DES-003 §3.3 errata③も filler 絞り込みには使わないと記録する（`docs/design/03-data-model.md:321`）。
- 実装は setup_only を filler 除外に使わない（`internal/service/setplay/service.go:271-277`、`internal/service/setplay/refine_test.go:54-65`）。

### 8.2 target_combo の一律除外と 3 類型記録

- `docs/seed-data/target-combo-and-derived-flag-rules.md:81-102,154-158,180-190` は、target_combo のパターン1/2を `is_derived=true`、空振り可のパターン3を `is_derived=false` として区別すると確定記録する。
- 現行 filler は `category=target_combo` を `is_derived` にかかわらず一律除外する（`internal/service/setplay/service.go:271-277`）。
- M19-02 の実装指示も `category != target_combo` の一律除外であり、「target_combo は多段技の2段目以降で単独で空振りできない」と記録する（`docs/instructions/M19-02-suggestion-refinement.md:163-181`）。

### 8.3 M19-DESIGN-07 の予定と現実装

出典: `docs/handover/M19-DESIGN-07-frame-cost-model.md:112-119`

> ## 5. filler 規則・提案品質への根拠提示（規則変更は M19 担当別サブ・CHANGE 起票マター）
>
> 2. **取りこぼしの回復（緩和）**: チェーン合成単位が filler 候補に加わり、従来 KA に収まらなかった帯の解が成立する（例: リュウ立弱P×2 は 26F でなく 22F）。
> 3. **`category=target_combo` の filler 除外の解除（緩和）**: 除外根拠は「total の意味が判別不能」（RESEARCH-03 R-C）だった。basis 付与により through と確定した行は S の意味が確定するため、**除外条件を「basis=unknown のみ」へ狭められる**。
> 4. **単独入力不可ゲートの追加（是正・設計過程で発見した既存の穴）**: 現行 filler 規則（total ≥ 1）には「単独入力不可」の除外がなく、パターン 3/5/6 の単発値派生技（弱xx＞ODyy の子等）が単独 filler として提案され得る。導出 `standalone ∧ 親参照あり → 単独入力不可` を **filler ゲートにも適用**し、該当行はチェーン合成・表記展開経由でのみ登場させる。ザンギエフ連打版行（§9-1）はこの一般則に乗るだけで特例が要らない。

同文書は既知の限界を次のように記録する。

出典: 同 `:158-163`

> ## 9. 既知の限界と割り切り（MVP）
>
> 2. ヒット/ガード時限定でしか派生できないチェーンコンボ・ターゲットコンボは引き続きセットプレイ対象外（空振り filler の前提に反するため）。
>
> 4. 状態変種 standalone（親参照なし・is_derived=true）の target 除外は暫定 is_derived ゲート継続（DESIGN-01 R4 注記のとおり恒久依存にしない）。

現実装の `MoveCandidate`／SELECT／filler 述語は `startup_basis` と `move_derivations` を参照せず、`category != target_combo` のまま（`internal/repository/setplay/repository.go:16-29,43-52`、`internal/service/setplay/service.go:267-281`）。M19-overview はこれを **M19-05 で変更予定**と記録する（`docs/instructions/M19-overview.md:109-111`）。

### 8.4 指定 5 技のデータ

- 5 技は CSV 上すべて `category=target_combo` かつ `is_derived=true`（`character_data/guile.csv:21-24`、`character_data/ingrid.csv:31`）。
- `condition_ja` / `condition_en` / `startup_basis` は 5 技とも CSV 上空欄（同箇所）。
- 調査開始前から未コミットの開発者判断コピーでは Guile 4 技に `standalone, target_comboだが空振りでは出ない技` と記入されているが、Ingrid `satelite_leap` は未記入（`docs/progress/20260802-M19-04-manual-input-list-developer-decision.md:86-110`）。
- `move_derivations` へのデータ INSERT は `migrations/` と `internal/` に 0 件。

## 9. 想定外の発見

1. **求める判別軸そのものを記した確定メモが RESEARCH-03 の参照先に現存した。** `docs/seed-data/target-combo-and-derived-flag-rules.md:54-102,154-190` は target_combo のパターン1/2と3を `is_derived` で分け、開発者回答「OK」「残る確認なし」まで記録している。
2. **RESEARCH-03 はこの記録を実データで追認していた。** target_combo 67 行のうち `is_derived=true` 63 行、空振り可パターン3の実例 `is_derived=false` 4 行という記録がある（`docs/progress/M19-RESEARCH-03-report.md:34-43,74-78`）。
3. **判別軸の射程が文書内で限定されている。** `category=target_combo AND is_derived=true` は target_combo 63 件を捕捉するが、target_combo 外の状態前提技等は `is_derived` の多義性により一般判別不能と同 report が記録する（同 `:100-112,188-191`）。
4. **`condition_ja` / `condition_en` は CSV にはあるが SQL 非投入で、指定 5 技では空欄。** `condition_ja` は DB の moves 列でもなく、000018 で raw_data から除去済み（`internal/seedgen/model.go:22-30,74-75`、`docs/progress/M19-04-completion-report.md:166-168`）。
5. **`move_derivations` は DDL のみで投入データが無い。** `startup_basis` と同表を setplay repository も取得していない（`migrations/000049_add_moves_frame_cost_columns.up.sql:16-34,49-58`、`internal/repository/setplay/repository.go:16-29,43-52`）。
6. **文書番号の二義性は Git 履歴でも確認できた。** フレーム費用モデルは `d710670` で `M19-DESIGN-06-frame-cost-model.md` から `M19-DESIGN-07-frame-cost-model.md` へ rename。現存する `M19-DESIGN-06-setplay-condition-record.md` は別文書（`docs/process/parallel-board.md:342`）。

## 10. read-only 遵守と作業ツリー

調査開始時の `git status --short`:

```text
 M docs/progress/20260802-M19-04-manual-input-list-developer-decision.md
```

これは調査開始前から存在した未コミット変更で、本調査では編集していない。本調査による書き込みは、依頼 §4 の例外である本レポート `docs/progress/20260802-whiff-discriminator-search-report.md` の新規作成だけである。CHANGE 番号・マイグレーション連番は消費していない。

レポート作成後の `git status --short`:

```text
 M docs/progress/20260802-M19-04-manual-input-list-developer-decision.md
?? docs/progress/20260802-whiff-discriminator-search-report.md
```

したがって、開始前からの変更 1 件を除く本調査の変更は、成果物レポート 1 件のみである。
