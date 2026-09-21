# M19-RESEARCH-03 調査報告: `is_derived` 実セマンティクスと `target_combo.total` の実データ確定

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/progress/M19-RESEARCH-03-is-derived-semantics.md`（配置は `docs/instructions/` ではなく `docs/progress/` だが、開発者確認のうえ本指示書として調査対象とした） |
| 版 | 1.0.0 |
| 調査モード | 対話モード（開発者承認 2 回：①補足調査計画、②`tmp/CENTRAL-to-M19-question-is-derived-semantics.md` を追加資料に組み込んだ修正計画） |
| read-only 遵守 | `view`/`grep`/`find`/`git log` 相当の読み取りと、集計用 `/tmp` 使い捨てスクリプト（Python）のみ使用。DB・CSV・コード・設計書は一切変更していない |

## 0. 結論サマリ

1. **R-A**: `is_derived=true` は seed 全 15 キャラで **514 行**（`docs/progress/M19-01-report.md` 記載の既報値と一致）。うち機械的に切り分けられるのは `category=rush_variant`(**237**・指示書(c)) と `category=target_combo`(**63**・指示書(a)相当)のみ。残る **214 行**は `special`/`unique`/`super_art`/`throw`/`normal` にまたがり、コマンド完全一致による衝突を確認できたもの(**96 行**。うちジャスト版名 11 行)、名前はジャスト版だが完全一致衝突が見つからないもの(**2 行**)、状態前提を示す角括弧名でコマンドが空のもの(**6 行**)、コマンドの先頭トークンが分岐元技と一致するもの(**36 行**)、いずれの機械的手がかりも見つからないもの(**74 行**)に分かれる(96+2+6+36+74=214)。
2. **R-B**: **(a) と (b) を現行スキーマの列・条件だけで機械的に判別することはできない(no)**。`category=target_combo` は(a)相当を高い確度で捕捉するが、`category=target_combo` の全行が(a)ではない(後述: パターン3 は `is_derived=false`)。逆に(a)相当の性質(前段・状態依存で単独入力不可)を持つ行が `target_combo` 以外にも実在し(リュウ `denjin_charge_*`・ケン `thunder_kick` 等)、これらは(b)の行と**スキーマ上まったく同じシグネチャ**(`category≠target_combo/rush_variant`・`original_move_id` NULL・`is_derived=true`)を持つため判別式が書けない。
3. **R-C**: `target_combo.total` が「派生部分のみ」か「連携全体」かは**判別不能**。`internal/seedgen/generate.go` の検算は当該行自身の `startup+active-1+recovery` の内部整合性のみを保証し、親技との加算関係とは無関係。実際に親候補との差分を検算しても加算パターンは一貫せず(負値も発生)、`docs/progress/M19-RESEARCH-02-report.md` R-C-4 も同型の `thunder_kick` 事例で「判別不能」と既に結論している。
4. **R-D**: リュウ・KA=40・既定3種別(通常技/特殊技/必殺技(弾))で提案生成を実機コード相当のロジックで再現・実測したところ、**総提案210件中19件(≈9.0%)が (a) 群(target_combo)filler を含む**。監査(`M19-audit-20260725.md` B-add-1)引用の `high_double_strike` は7件、`fuwa_triple_strike_2hits` は12件の提案で filler として使われていた(定量確認)。denjin_charge 系(必殺技派生)filler を含む提案はこの条件では0件だった(他 KA/target では未検証)。
5. **R-E**: rush_variant の +11 が生ラッシュ起点かキャンセルラッシュ起点かを示す一次情報は seed(`notes`/`notes_tool` 列)に**一切無い**(237行中0件が非空)。既存文書(`followup-backlog.md` §H(e)、`M19-01-report.md`)も「未確認」のまま。**実機確認要**(指示書の想定どおり)。

---

## R-A. `is_derived=true` の全行を「なぜ true か」で分類

### 実態

**データソース**: `character_data/*.csv`(全15キャラ)。`is_derived` 列(文字列 `"true"`/`"false"`)で抽出。

**分類方法(機械的手がかりに基づく。推測による(a)/(b)振り分けはしていない)**:
1. `category=rush_variant` → (c)
2. `category=target_combo` → (a)
3. それ以外は、同一キャラ内で **`command` 列が完全一致する非派生技(is_derived=false)** の有無を検査 → あれば (b)(コマンド衝突)
4. (3)で見つからない場合、`command` の `chain` 区切り**先頭トークン**が他の技(非派生・別派生いずれか)と一致するか検査 → あれば「分岐元あり」として区別注記
5. いずれも無く、`name_ja` が `【...】` で始まる(状態接頭辞) → 区別注記
6. いずれも無い → 「不明」

| 群 | 件数 | 判別根拠 |
|----|------|----------|
| **c_rush_variant**(指示書(c)) | 237 | `category=rush_variant` |
| **a_target_combo**(指示書(a)相当) | 63 | `category=target_combo` |
| **b_just_command_identical**(指示書(b)・ジャスト版) | 11 | `command` が非派生の同名技と完全一致 |
| **b_command_collision_other**(指示書(b)) | 85 | `command` が非派生の別技と完全一致(ジャスト以外) |
| **b_just_no_collision_found** | 2 | 名前は「ジャスト」系だが完全一致する非派生技が見つからない |
| **d_special_state_variant_no_collision** | 6 | `【...】`状態接頭辞名・`command` 空・完全一致衝突なし(rashid「強化」システム技群) |
| **unk_no_signal**(不明) | 110 | 上記いずれの機械的手がかりも無し |
| **合計** | **514** | (`docs/progress/M19-01-report.md` の既報 514 件と一致) |

`unk_no_signal` 110 件のうち **36 件**は `command` の先頭トークン(chain 前の入力)が同キャラの別技(多くは自分自身の別強度/別止め段)と一致する「分岐元あり」の技だった(例: jamie `freeflow_strikes_2hits_light`(`d dr r plus p_l chain r plus p`)は `freeflow_strikes_light`(`d dr r plus p_l`)と先頭トークン一致)。残り **74 件**は先頭トークンでも手がかりが見つからない(例: ケン `quick_dash_shoryuken`(`r d dr plus p`)・リュウ `denjin_charge_hadoken`(`d dr r plus p`、非派生の `hadoken_light/medium/heavy` とは強度サフィックスの有無で不一致))。

**キャラ別分布**:

| キャラ | a_target_combo | b_just_command_identical | b_command_collision_other | b_just_no_collision_found | d_special_state | unk_no_signal | c_rush_variant | 計 |
|--------|---:|---:|---:|---:|---:|---:|---:|---:|
| guile | 4 | 8 | 2 | 2 | 0 | 5 | 19 | 40 |
| ingrid | 4 | 0 | 0 | 0 | 0 | 0 | 16 | 20 |
| jamie | 14 | 0 | 9 | 0 | 0 | 36 | 19 | 78 |
| juri | 1 | 0 | 4 | 0 | 0 | 4 | 16 | 25 |
| ken | 3 | 0 | 4 | 0 | 0 | 11 | 12 | 30 |
| kimberly | 7 | 0 | 6 | 0 | 0 | 12 | 15 | 40 |
| lily | 3 | 0 | 11 | 0 | 0 | 3 | 15 | 32 |
| luke | 7 | 3 | 0 | 0 | 0 | 7 | 16 | 33 |
| m_bison | 3 | 0 | 8 | 0 | 0 | 8 | 15 | 34 |
| mai | 3 | 0 | 25 | 0 | 0 | 4 | 14 | 46 |
| manon | 3 | 0 | 0 | 0 | 0 | 8 | 15 | 26 |
| rashid | 1 | 0 | 8 | 0 | 6 | 8 | 16 | 39 |
| ryu | 3 | 0 | 6 | 0 | 0 | 2 | 17 | 28 |
| terry | 7 | 0 | 0 | 0 | 0 | 2 | 13 | 22 |
| zangief | 0 | 0 | 2 | 0 | 0 | 0 | 19 | 21 |

**代表例**:
- (a) `guile/recoil_cannon`(`target_combo`・`p_m chain l plus p_h`)、`ingrid/pretty_heel_kick`(`target_combo`・`p_m chain k_m`)
- (b・ジャスト版、command完全一致) `guile/perfect_timing_light_sonic_boom`(`charge_l r plus p_l`)は非派生の `guile/sonic_boom_light` と完全一致。ただし `luke/flash_knuckle_perfect_light` は `command` が `d dl l plus p_l hold`(`hold` トークン付き)で非派生版 `flash_knuckle_light`(`d dl l plus p_l`)と**文字列としては異なる**にもかかわらず `is_derived=true`。
- (b・他技との衝突) `ken/thunder_kick`(`unique`・`command=k_m`)は非派生の `standing_medium_kick`/`jumping_medium_kick` と完全一致。`kimberly/torso_cleaver` 系(`k_l`)は `standing_light_kick`/`jumping_light_kick` と完全一致。
- (不明・分岐元ありの必殺技派生) `jamie/freeflow_strikes_2hits_light` 等(酔い技の分岐ファミリー)、`ken/kasai_thrust_kick_during_od_gorai_axe_kick`・`kasai_thrust_kick_during_od_senka_snap_kick`(同一技が2つの異なる「親」から分岐、`docs/progress/M19-RESEARCH-02-report.md` R-C-5 と同一事例)。
- (不明・状態前提で衝突なし) `ryu/denjin_charge_hadoken`(`special`・`command=d dr r plus p`)、`ryu/denjin_charge_od_hadoken`(`command=d dr r plus p p`。非派生の `hadoken_od` と完全一致=これは b_command_collision_other 側に分類済み)。`denjin_charge_hadoken` 自体は強度非指定の command のため非派生技と完全一致せず不明群。

### 想定外の発見(事実)

- **`target_combo` の全行が `is_derived=true` ではない**。全15キャラで `category=target_combo` は67行あるが、うち**4行**(ザンギーフ `machine_gun_chops`/`machine_gun_chops_2hits`/`power_stomps`/`power_stomps_2hits`)は `is_derived=false`。これは `tmp/target-combo-and-derived-flag-rules.md`(2026-07-09 設計判断メモ)が定義する「パターン3(前段が空振りでも出る。例としてザンギ中P連打を明記)」の実例と一致する。同メモは「パターン3→`is_derived=false`(索引対象・空振りフレーム重視)、パターン1/2→`is_derived=true`(索引外)」と規定しており、実データはこの規定と整合していた。
- 同メモは「必殺技の派生(強度/状態違いの分岐技)は `is_derived=true` の第4のパターン」であり、理由は指示書の(a)(単独不可)・(b)(コマンド衝突)いずれとも異なる「決定論的に一意解決できない(分岐が複雑)」であると明記している。R-A の `denjin_charge_*`・`thunder_kick`・`kasai_thrust_kick_during_od_*` はこのパターンの実例と整合する。
- 同メモは「ホールド版・溜め版は command が異なるため `is_derived=false` のはず。ツールが実際にトークンを付けているか要確認」と自己点検を促していたが、`luke/flash_knuckle_perfect_light` は `hold` トークンが付いて command が異なるにもかかわらず `is_derived=true` であり、**メモが想定した「トークンが付けば false」という前提と実データが食い違う実例**が見つかった。

### 機械判別の可否
→ R-B で結論。

### filler規則への含意(事実のみ)
- 現行 filler 規則(`total≥1` の全技)は、上記 (a)/(b)/(c)/不明 のいずれも区別せず一律に含めている(`internal/service/setplay/service.go:203-208`)。

---

## R-B. (a) と (b) の機械判別可否

### 実態

`is_derived` の消費者はコードベースに **3 箇所**あり、扱いが異なる(事実):

| 消費者 | 場所 | is_derived 除外規則 |
|--------|------|----------------------|
| `move_commands` 索引(段階2解決表) | `internal/moveindex/moveindex.go:5`、DES-004 §2.4.4 | `is_derived=true` を**無条件**除外(rush 例外なし) |
| setplay target 列挙 | `internal/service/setplay/service.go:278-288` | `is_derived=true` かつ **rush 種別でない**場合のみ除外(rush は許可) |
| setplay filler 選定 | `internal/service/setplay/service.go:203-208` | `is_derived` を**一切参照しない**(`total≥1` のみ) |

### (a)/(b) の判別式の検証

- **`category=target_combo`** は指示書(a)(「親技を出さないと出せない」)の**候補判別式**として提示されているが、R-A の発見のとおり `category=target_combo` の中にも `is_derived=false`(パターン3・4行)が含まれるため、**`category=target_combo` ⇔ (a)」の1対1対応ではない**(`category=target_combo AND is_derived=true` の63行が(a)相当という条件付きの対応)。
- 一方で、(a)相当の性質(前段または特定状態を経ないと出せない)を持つと考えられる行が `target_combo` 以外にも実在する: `ryu/denjin_charge_hadoken`(要 電刃錬気状態)、`ken/thunder_kick`(要 `quick_dash` 状態。`command=k_m` 単体は通常の中Kと解決不能に衝突するため、単なる「単独では出せるがコマンドが被る」(b)としても説明はつくが、ゲーム上は `quick_dash` の状態を経ないと同技は出ない)。これらの行は `category`(special/unique)・`original_move_id`(NULL)・`is_derived`(true)のいずれの列を見ても、指示書(b)の教科書的な例(`guile/perfect_timing_light_sonic_boom` のような単純コマンド衝突)と**スキーマ上区別できない**。
- `original_move_id` は `rush_variant` 専用列であり((c)以外では常にNULL)、(a)/(b)を分ける情報を持たない(`docs/design/03-data-model.md:277`)。
- `docs/progress/M19-RESEARCH-02-report.md` R-C-2/R-C-4 も同型の結論(`thunder_kick` の起源は「判別不能」・汎用の親子リンクはスキーマに不在)に既に達している。

### 機械判別の可否: **no**

現状のスキーマ列・条件だけで (a) と (b) を機械的に判別することはできない。`category=target_combo AND is_derived=true` は(a)の**十分だが網羅的ではない**候補(63件)を捕捉できる一方、`category` が `target_combo`/`rush_variant` 以外の214件については、コマンド完全一致の有無(R-A の98件)で(b)の一部を絞り込めるにとどまり、残る116件(分岐元ありの36件+不明74件+状態接頭辞6件)は(a)相当・(b)相当のいずれとも確定できない。

### filler規則への含意(事実のみ)
- 「(a)だけを機械的に除外する」規則は、`category=target_combo AND is_derived=true` を条件にすれば63件については実現できるが、それ以外に(a)相当(前段/状態前提で単独入力不可)の性質を持つ可能性がある行(denjin_charge系・thunder_kick等)は、この条件では除外できない(取りこぼす)。

---

## R-C. `target_combo.total` の意味

### 実態

1. **算出式の内部整合性**: `internal/seedgen/generate.go:140-141` は全カテゴリ一律で `csv.total == startup + active - 1 + recovery` を検証する(target_combo 専用のロジック分岐は無い)。これは当該行**自身**の内部整合性を保証するのみで、親技との加算関係(累積か否か)には無関係。
2. **NULL化の設計意図との乖離**: `tmp/target-combo-and-derived-flag-rules.md` §2.5 は「TC 2段目以降は `startup`/`total` を NULL とし `active`/`recovery`/`on_hit`/`on_block` のみ登録する」ことを開発者確認済みとして記録している。しかし実データでは `category=target_combo` 67行中 **`startup` 非NULL 65行(97%)・`total` 非NULL 64行(96%)** であり、この設計意図どおりには運用されていない(事実。是非は判断しない)。
3. **親技との加算関係の検算**(`command` のチェイン先頭トークンで親を特定。`original_move_id` は target_combo では常にNULLのため使えない): 15例中一部を抜粋——

   | 子(target_combo) | 子total | 親(chain先頭トークン一致) | 親total | 差分 |
   |---|---:|---|---:|---:|
   | guile `recoil_cannon` | 44 | `standing_medium_punch` | 24 | +20 |
   | guile `double_shot` | 30 | `crouching_medium_punch` | 24 | +6 |
   | guile `phantom_cutter` | 37 | `crouching_heavy_kick` | 50 | **-13** |
   | jamie `full_moon_kick` | 84 | `falling_star_kick` | 44 | +40 |

   差分が案件ごとに大きくばらつき(+6〜+40)、**負値も発生する**(親totalの方が大きい)。単純な「親total+子固有分」の加算では説明できない。
4. **`docs/progress/M19-RESEARCH-02-report.md` R-C-4** は、ケン `thunder_kick`(category=unique・startup=29)について「startup が単体公式値か派生時実測値かを記録するフィールドは存在しない」として明示的に「判別不能」と結論済み。同報告書の「引き渡し事実 5」も「派生技startupのprovenanceを記録するフィールドは存在しない」と一般化している。

### 機械判別の可否
`target_combo.total` が「派生部分のみ」か「連携全体」かを判別できる列・情報は存在しない。加算検算も一貫したパターンを示さない。

### 結論: **判別不能**

### filler規則への含意(事実のみ)
- `target_combo.total` を filler の消費フレームとしてそのまま加算する場合、その値が「その段だけの空振りフレーム」なのか「連携全体を含む値」なのかが不明なため、**加算した合計フレーム数(S)の意味が確定しない**。

---

## R-D. 「単独で空振りできない技」の実害範囲(filler観点)

### 実態(方法論)

`internal/service/setplay/setplay.go`(`Suggest` アルゴリズム)と `internal/service/setplay/service.go`(`collectTargets`・filler選定・既定 target_types)を通読し、同一ロジックを `/tmp` 使い捨て Python スクリプトで再現した。再現の正しさは `golden_test.go` の **GC-1**(リュウ・KA=40・filler=`standing_light_kick`・target=`collarbone_breaker`・期待値 N=4/S=38)で検算し、一致を確認したうえで実行した(スクリプトはリポジトリに残していない)。

- filler候補: リュウ全技のうち `total≥1` の84技(現行規則どおり、is_derivedを問わない)。うち R-A の(a)群(`category=target_combo`)は `fuwa_triple_strike`・`fuwa_triple_strike_2hits`・`high_double_strike` の3技。必殺技派生群(denjin_charge系)は8技。
- target候補: 既定3種別(通常技・特殊技・必殺技(弾))で `collectTargets` を再現した結果、21技(`is_aerial`除外・非rush派生技除外・`damage>0`のみ、を適用済み)。
- KA=40(監査 `M19-audit-20260725.md` B-add-1 が用いた値を踏襲。GC-1 のKAとも一致)。

### 実測結果

- 総提案数: **210件**(21 target × 各 target あたり平均10件、`MaxResults=200`によるtarget単位の打ち切りは発生していない)。
- **(a)群(target_combo)fillerを含む提案: 19件(≈9.0%)**。
  - `high_double_strike` を filler に含む提案: **7件**(例: target=`standing_medium_punch`, filler=[`high_double_strike`], S=38, N=4)
  - `fuwa_triple_strike_2hits` を filler に含む提案: **12件**(例: target=`standing_light_punch`, filler=[`standing_light_punch`,`fuwa_triple_strike_2hits`], S=40, N=2)
  - `fuwa_triple_strike`(フル・3段止め)を filler に含む提案: **0件**(7+12=19件で全数に一致。フル版は total=40 が大きく、この KA=40・既定3種別の窓には filler として一度も収まらなかった)
- 必殺技派生群(denjin_charge系、8技)を filler に含む提案: **0件**(この KA=40・既定3種別の条件では出現しなかった。他の KA・target種別では未検証)。

### filler規則への含意(事実のみ)
- 現行規則(`total≥1` 全技)のもとで、監査が定性的に指摘した (a)群fillerを含む提案が実際に**定量的にも一定数(19/210)存在する**ことを確認した。

---

## R-E. rush_variant の起点(生ラッシュ/キャンセルラッシュ)

### 実態
- 全15キャラの `rush_variant` 237行のうち、`notes`/`notes_tool` 列が非空の行は **0件**。CSV に起点を示す一次情報は無い。
- リュウの17件(`original_move_code`解決可能な全行)で `startup` 差分を検算したところ、**全件 +11 で一定**(既報どおり)。
- `docs/handover/followup-backlog.md` §H(e)「M19-rush-variant-origin」は「生ラッシュ(ニュートラル起点)で測られているか未確認。M19-02着手前に確認」と記載し、未解決のまま。
- `docs/progress/M19-01-report.md` §D は「ラッシュ版の格納startup(例 `rush_standing_light_kick=16`)はラッシュ発動込みの絶対発生ではない可能性がある」と関連する懸念を記録しているが、生/キャンセルいずれかを確定する記述はない。
- `tmp/CENTRAL-to-M19-question-is-derived-semantics.md` §3-4 も「+11は実測で正しいと確認済み。残る論点は生ラッシュ起点かの一点」と明記し、確認タスクとして未解決のまま引き継いでいる。

### 結論
**判別不能(実機確認要)**。seed・設計文書のいずれにも起点を確定する一次情報がない。

---

## 中央への一次源(DES-003 §3.3 記述是正に使える分布事実)

1. `is_derived=true` 514行のうち、DES-003 §3.3 の現行判定原理("コントローラでこの技だけをいきなり出せるか？出せない→true")に文字どおり整合するのは `target_combo`(パターン1/2・63件)と、状態前提が濃厚な一部(denjin_charge系等)にとどまる。**コマンド完全一致による索引衝突回避が理由の行(ジャスト版等・少なくとも96件)**は、この文言だけでは説明が付かない別の付与理由であり、`tmp/target-combo-and-derived-flag-rules.md` の付与ルール(ジャスト版=コマンド同一・必殺技派生=決定論解決不能)の方が実データと整合する。
2. `category=target_combo` は `is_derived` の値と1対1ではない(パターン3の4行は `is_derived=false`)。DES-003 §3.3 で `is_derived` と `target_combo` の関係を記述する際は、この非対称を反映する必要がある(事実提示のみ・文言案は作成しない)。
3. `target_combo.total` の意味(派生部分のみ/連携全体)を確定する列・記録は現行スキーマに存在しない。DES-003 §3.3 には現在この点の定義がない。

## M19 filler規則の判断材料((a)機械判別の可否)

- **(a)を機械的に除外する条件式は `category=target_combo AND is_derived=true` のみ**であり、これは (a)群の一部(63件)しか捕捉できない。同種の性質を持つ可能性がある denjin_charge系等(必殺技派生・R-A不明群の一部)は同条件では捕捉できない。
- 現行規則のまま filler を運用した場合、リュウ・KA=40・既定3種別という代表的な条件だけでも、提案の約9%が(a)群fillerを含む(R-D実測)。

---

*以上、M19-RESEARCH-03 調査報告 v1.0.0。read-only・judgement-free。分類・判別可否は実データの機械的手がかりに基づく事実列挙であり、filler規則の設計判断は含まない。*
