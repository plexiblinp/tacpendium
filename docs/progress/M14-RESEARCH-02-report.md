# M14-RESEARCH-02 調査報告: 配布 seed 第一波キャラ選定のための特性調査

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/M14-RESEARCH-02-first-wave-roster.md` v1.0.1 |
| 種別 | 実装調査報告（read-only。事実列挙のみ。第一波の最終決定は含めない。§E のみ指示書 §0.3 の例外として候補案を提示） |
| 調査日 | 2026-07-09 |
| 調査担当 | 調査担当 Claude Code（`/research_plan` 対話モード） |
| 成果物 | 本ファイル 1 点のみ。コード・設計書・seed・公式データは一切変更していない |

---

## 結論サマリ

- **公式データは本環境から参照できた**が、指示書が想定した「保持データ」の実体は `combomgr-importer`（別リポジトリ・`.gitignore` 済）の **公式保存 HTML 68 本**（クラシック 30 キャラ × 日英）と、そこから決定論変換された **`dist/*.csv`（22 列）＋ `dist/*.review.md`（要確認レポート 9 節）** であった。軸 A / B / D はこれで充足した。
- **軸 C は 2026-07-09 の第 2 次指示で「全 30 キャラの公式データを対象とする例外類型の洗い出し」へ拡大され、完了した**（§C）。**20 類型を確定**し、うち 16 がキャラ固有。テリーの手入力 CSV（`moves-input-tool` 出力）は依然として本環境に存在しないため、類型は公式データと importer の変換結果に基づく。人間の開発者向けの元データ抜粋・キャラ別 Q&A は `tmp/20260709-official-data-edge-cases.md` に別置した。
- **採番ルールの正本は `combomgr-importer/internal/code/code.go`**: `move_code = MoveCode(name_en)` の 2 ステップのみで、**日本語名は採番に使われない**。「先頭トークンが `l`/`m`/`h`/`od` のときだけ末尾へ移す」という 1 点から、例外類型 T1・T2 が機械的に導かれる。
- **軸 A-6（キャラ固有状態の種別・値域・増減）は調査対象外**（開発者指示 2026-07-09）。22 列 CSV に状態の構造化列は無く、公式データからは読み取れないため、開発者のドメイン知識に依存する。**Mai / Lily / Juri / Kimberly の 4 キャラは増減する**（開発者情報）。本レポートは代替として、現行マイグレの `custom_states` 定義実態のみを事実として記録した（§A-補足）。
- ロスターは **30 キャラ**（`dist/*.csv` 実測）。31 番目のキャラの行は存在しない。モダンは対象外（`testdata/modern/` は未調査）。
- seed 契約のうち **一回転（`circle` トークン）を踏めるのは `lily` と `zangief` の 2 キャラのみ**、**`move_code` の literal `_2` フォールバックが実際に発生しているのは `guile` 1 キャラのみ**であった。この 2 点が第一波のカバレッジ上の最も狭い制約である。
- 想定外の発見を §F に 10 件記録した。とくに **importer CSV の `move_code` は現行 ryu seed（000004）の正準採番と体系が異なる**（共通 15 / 67 件）点は、本レポートの `move_code` 表記をそのまま seed に持ち込めないことを意味する。

---

## 0. 調査の前提と参照したデータの実体

### 0.1 参照できたもの

| 指示書が想定するデータ | 本環境での実体 | 可否 |
|---|---|---|
| 公式データ一式 | `combomgr-importer/testdata/{char}_ja.html` / `{char}_en.html`（計 68 本） | 参照可 |
| 〃（決定論変換済） | `combomgr-importer/dist/*.csv`（30 本・22 列・RFC 4180） | 参照可 |
| 〃（要確認レポート） | `combomgr-importer/dist/*.review.md`（30 本・9 節構成） | 参照可 |
| テリーの手入力 CSV | `moves-input-tool`（`autopilot-combomgr/projects/moves-input-tool/`）は**ソースのみ存在**。出力 CSV・データストア（`~/.movestool`）とも**不在** | **参照不可** |
| M16-RESEARCH-01-report.md | `docs/progress/phase3/M16-RESEARCH-01-report.md` | 参照可 |
| m16-to-m17-handover §3（seed 契約 6 件） | `docs/handover/phase3/m16-to-m17-handover.md` §3 | 参照可 |

`combomgr-importer` / `autopilot-combomgr` はいずれもリポジトリルートの `.gitignore`（L84 / L87）で除外された別 Git リポジトリである。本調査では読み取りのみ行った。

### 0.2 集計手法（再現手順）

- CSV は Python の `csv` モジュールで正規パースした。`awk -F','` は `combo_scaling` 列の JSON（引用符内カンマ、例 `"{""initial_scaling"":20}"`）でフィールドがずれるため使用していない。
- `command` 列は空白区切りでトークン分割し、**完全一致**で判定した。部分一致 grep は誤検出する（例: `grep 'charge_'` は ryu の `denjin_charge_hadoken` / `denjin_charge_od_hadoken` 等 8 行を溜め技として拾う）。
- トークン語彙は `combomgr-importer/README.md`「コマンドトークン語彙表」（TOOL-002 §9.9）を正とした。

### 0.3 判断の扱い

指示書 §0.3 に従い、**§E のみ**候補案を提示する。§A〜§D・§F は事実列挙に留めた。

---

## A. 特性マトリクス（30 行）

列は指示書 §4.1 の項番に対応する。**6（キャラ固有状態）は開発者指示により調査対象外**のため列を設けず、§A-補足で現行マイグレの定義実態のみ記録した。

- **1 溜め**: `command` に `charge_d` / `charge_l` / `charge_r` を含む行数（全 category）
- **2 一回転**: `command` に `circle` トークンを含む行数（全 category）
- **3 単方向+ボタン**: `category=unique` かつ `command` が厳密に `[方向] plus [ボタン]` の 3 トークンである行数
- **4 空中**: `is_aerial=true` かつ `category ∈ {unique, special}` の行数（`normal` のジャンプ攻撃・`throw` の空中投げ・`super_art` は除外。内訳は §A-補足 3）
- **5 TC 相当**: `category=unique` に限定（開発者指示）。`chain` トークンを含む行数 / 名前または `notes` に「段目」を含む行数 / 両者の和集合
- **7 通常投げ**: `category=throw` の行数
- **8 同名衝突**: `{char}.review.md` §3「code 衝突と解決」の記録行数
- **9 総行数**: CSV のデータ行数（ヘッダ除く）

| character_code | 1 溜め | 2 一回転 | 3 単方向+ボタン | 4 空中 | 5 TC 相当 (chain / 段目 / 和) | 7 通常投げ | 8 同名衝突 | 9 総行数 |
|---|---|---|---|---|---|---|---|---|
| `aki` | 0 | 0 | 4 | 1 | 2 / 2 / 2 | 2 | 0 | 56 |
| `akuma` | 1 | 0 | 5 | 7 | 4 / 4 / 6 | 2 | 0 | 83 |
| `alex` | 0 | 0 | 6 | 1 | 3 / 2 / 4 | 3 | 0 | 66 |
| `blanka` | 24 | 0 | 5 | 9 | 0 / 1 / 1 | 3 | 0 | 83 |
| `c_viper` | 0 | 0 | 2 | 6 | 0 / 0 / 0 | 2 | 0 | 61 |
| `cammy` | 0 | 0 | 3 | 2 | 2 / 1 / 2 | 3 | 4 | 67 |
| `chun_li` | 8 | 0 | 5 | 8 | 3 / 4 / 5 | 3 | 0 | 70 |
| `dee_jay` | 9 | 0 | 3 | 2 | 8 / 7 / 9 | 2 | 0 | 97 |
| `dhalsim` | 0 | 0 | 13 | 13 | 0 / 0 / 0 | 3 | 0 | 81 |
| `e_honda` | 9 | 0 | 3 | 1 | 2 / 0 / 2 | 2 | 0 | 62 |
| `ed` | 0 | 0 | 1 | 0 | 6 / 4 / 6 | 2 | 0 | 62 |
| `elena` | 0 | 0 | 4 | 2 | 9 / 9 / 11 | 2 | 0 | 71 |
| `guile` | 18 | 0 | 8 | 0 | 4 / 0 / 4 | 4 | 2 | 72 |
| `ingrid` | 0 | 0 | 2 | 8 | 4 / 4 / 6 | 2 | 0 | 67 |
| `jamie` | 0 | 0 | 6 | 4 | 12 / 16 / 16 | 2 | 0 | 95 |
| `jp` | 0 | 0 | 4 | 0 | 4 / 2 / 5 | 3 | 0 | 61 |
| `juri` | 0 | 0 | 8 | 2 | 2 / 4 / 4 | 3 | 2 | 79 |
| `ken` | 0 | 0 | 0 | 2 | 3 / 2 / 3 | 2 | 3 | 68 |
| `kimberly` | 0 | 0 | 4 | 4 | 7 / 5 / 7 | 2 | 0 | 78 |
| `lily` | 0 | 4 | 4 | 6 | 3 / 3 / 4 | 2 | 0 | 66 |
| `luke` | 0 | 0 | 4 | 3 | 7 / 7 / 8 | 2 | 0 | 68 |
| `m_bison` | 12 | 0 | 3 | 1 | 3 / 0 / 3 | 2 | 0 | 64 |
| `mai` | 0 | 0 | 2 | 0 | 3 / 4 / 4 | 3 | 0 | 82 |
| `manon` | 0 | 0 | 3 | 0 | 4 / 2 / 5 | 2 | 0 | 51 |
| `marisa` | 0 | 0 | 5 | 3 | 8 / 7 / 13 | 2 | 0 | 83 |
| `rashid` | 1 | 0 | 8 | 6 | 1 / 2 / 3 | 3 | 0 | 77 |
| `ryu` | 0 | 0 | 5 | 2 | 3 / 4 / 5 | 2 | 0 | 67 |
| `sagat` | 0 | 0 | 4 | 0 | 4 / 0 / 4 | 2 | 0 | 62 |
| `terry` | 0 | 0 | 1 | 2 | 7 / 0 / 7 | 2 | 0 | 58 |
| `zangief` | 0 | 8 | 7 | 4 | 4 / 5 / 5 | 6 | 0 | 64 |

**ヒット 0 件の領域（明示）**

- 一回転（`circle` トークン）: **28 キャラで 0 件**。非ゼロは `lily`(4) / `zangief`(8) のみ。
- 溜め: **22 キャラで 0 件**。非ゼロは `akuma`(1) / `blanka`(24) / `chun_li`(8) / `dee_jay`(9) / `e_honda`(9) / `guile`(18) / `m_bison`(12) / `rashid`(1) の 8 キャラ。
- 空中（unique/special）: `ed` / `guile` / `jp` / `mai` / `manon` / `sagat` の **6 キャラで 0 件**。
- TC 相当（unique 限定・和集合）: `c_viper` / `dhalsim` の **2 キャラで 0 件**。
- 単方向+ボタン（unique 限定）: `ken` のみ **0 件**。
- 同名衝突: **26 キャラで 0 件**。非ゼロは `cammy`(4) / `guile`(2) / `juri`(2) / `ken`(3) の 4 キャラ。
- `category=target_combo` の行: **30 キャラ全体で 0 件**（§F-3）。

### A-補足 1: 溜め・一回転の根拠行（抜粋）

| キャラ | 種別 | 根拠 |
|---|---|---|
| `blanka` | 溜め | `dist/blanka.csv` `rolling_attack_light` / 弱 ローリングアタック / `command = charge_l r plus p_l` |
| `guile` | 溜め | `dist/guile.csv` の 18 行が `charge_l` または `charge_d` を含む |
| `akuma` | 溜め | `dist/akuma.csv` `demon_swoop` / 百鬼潜影 / `command = charge_d`（方向溜めを伴わない単独 `charge_d`） |
| `rashid` | 溜め | `dist/rashid.csv` `run` / ラン / `command = r charge_r` |
| `zangief` | 一回転 | `dist/zangief.csv` `russian_suplex` ほか 8 行が `circle` トークンを含む（例 `circle plus p_l`） |
| `lily` | 一回転 | `dist/lily.csv` の 4 行が `circle` トークンを含む |

### A-補足 2: 通常投げ 3 件以上のキャラ（採番経路の検証対象・指示書 §4.1-7）

`{char}.review.md` §2「通常投げ（3 件目以降・並び順）」に該当する。ツールは 1 件目を `throw_forward`、2 件目を `throw_back` へ自動採番し、公式名を `notes` へ退避する（`terry.review.md` §2）。3 件目以降は Flagged（異常系）。

| キャラ | 件数 | `category=throw` の `move_code` |
|---|---|---|
| `zangief` | 6 | `throw_forward`, `throw_back`, `german_suplex`, `spinebuster`, `russian_drop`, `brain_buster` |
| `guile` | 4 | `throw_forward`, `throw_back`, `flying_mare`, `flying_buster_drop` |
| `alex` | 3 | `throw_forward`, `throw_back`, `illegal_knees` |
| `blanka` | 3 | `throw_forward`, `throw_back`, `wild_bites` |
| `cammy` | 3 | `throw_forward`, `throw_back`, `leg_scissors_choke` |
| `chun_li` | 3 | `throw_forward`, `throw_back`, `ryuseiraku` |
| `dhalsim` | 3 | `throw_forward`, `throw_back`, `yoga_splash` |
| `jp` | 3 | `throw_forward`, `throw_back`, `tornado` |
| `juri` | 3 | `throw_forward`, `throw_back`, `zanka_sen` |
| `mai` | 3 | `throw_forward`, `throw_back`, `yume_zakura` |
| `rashid` | 3 | `throw_forward`, `throw_back`, `desert_slider` |

残り 19 キャラは 2 件（`throw_forward` / `throw_back` のみ）。

### A-補足 3: 同名衝突と `_2` フォールバックの実態（指示書 §4.1-8）

`{char}.review.md` §3 の記録が正。**ツールが実際に literal `_2` サフィックスを採番したのは `guile` の 1 行のみ**で、他 3 キャラは条件由来の語を付す形で解決している。

| キャラ | 衝突 | ツールの解決後 `move_code` |
|---|---|---|
| `cammy` | 4 | `cannon_strike_forward_jump`, `cannon_strike_od_forward_jump`, `cannon_strike_hooligan_combination`, `cannon_strike_od_hooligan_combination` |
| `guile` | 2 | `rolling_sobat`, **`rolling_sobat_2`** ← 唯一の literal `_2` |
| `juri` | 2 | `chain_combo_neutral_jumping_heavy_kick_jump`, `chain_combo_neutral_jumping_heavy_kick_neutral_jump` |
| `ken` | 3 | `kasai_thrust_kick_kazekama_shin_kick`, `kasai_thrust_kick_gorai_axe_kick`, `kasai_thrust_kick_senka_snap_kick` |

`name_ja` の完全重複は `cammy` 2 組 / `guile` 1 組 / `ken` 1 組、他 27 キャラで 0 件（`juri` は衝突 2 件だが `name_ja` は「[チェーンコンボ]ジャンプ強P」と「[チェーンコンボ]垂直ジャンプ強K」で相違し、衝突したのは英語名由来の `move_code` である）。

> 注: `move_code` の末尾 `_2`〜`_9` は **段目派生行**でも使われており（例 `dee_jay` に 30 行、`sa2_lowkey_sunrise_festival_2`〜`_7` 等）、これは code 衝突ではない。両者を `_N` サフィックスの有無だけで区別してはならない（§F-10）。

### A-補足 4: `custom_states` の現行定義実態（軸 A-6 の代替記録）

軸 A-6 は開発者指示により調査対象外。以下は**公式データではなくマイグレ実ファイルからの事実**である。

| キャラ | 定義 | 根拠 |
|---|---|---|
| `ryu` | `denjin_charge`（電刃錬気） / `type=flag` / `kind=boolean` | `migrations/000015_seed_custom_states_classic3.up.sql` |
| `ingrid` | `sun_crest`（サンシンボル） / `type=level` / `kind=integer, min=0, max=4` | 同上。`show_delta=true` は `migrations/000023_add_show_delta_ingrid_sun_crest.up.sql` |
| `c_viper` | `limit_decoupler`（バウンサーステップ(SA1強化中)） / `type=flag` / `kind=boolean` | `migrations/000015_...up.sql` |

**`mai` / `lily` / `juri` / `kimberly` の `custom_states` は現行マイグレ（000001〜000023）に定義が存在しない。** 開発者情報（2026-07-09）により、この 4 キャラの状態は増減する。

公式データ側では、状態に関する記述は構造化列ではなく `notes` / `condition_ja` / 技名の日本語テキストにのみ現れる（例: `dist/lily.csv` に「風纏いを1つストック」の記述、`dist/juri.csv` に「風水エンジン」の記述）。値域・増減方向を行として読み取れる列は 22 列 CSV に存在しない。

---

## B. seed 契約カバレッジ対応表

`docs/handover/phase3/m16-to-m17-handover.md` §3 の (a)〜(f) と、指示書 §4.2 が列挙する検証観点への対応。**評価は含まない（どのキャラ集合がその経路を踏むか、の対応のみ）。**

| 契約 / 観点 | 出典 | 踏めるキャラ集合 | 第一波選定への依存 |
|---|---|---|---|
| **(a)** 移動 system move 全キャラ seed ＋ `preset_aliases` | handover §3 | **全 30 キャラ**（手入力 CSV 非依存＝SUPP-001 §3.3.2 の seed 管理 move） | 依存しない（M14-03b §1.2 で第一波に限らず全キャラ投入） |
| **(b)** skip 残行の掃き取り follow-up マイグレ | handover §3 | 全キャラ dash seed 完了後に成立 | 依存しない |
| **(c)** dup スキャン＋dup 再測定 | handover §3 | 母集団は seed 済み全キャラ。第一波時点では部分母集団 | 第一波の構成で母集団が決まる（§D 参照） |
| **(d)** `target_combo` passthrough | handover §3 / CHANGE-065 | `category=unique` に TC 相当行を持つ **28 キャラ**。**踏めないのは `c_viper` / `dhalsim`（和集合 0 件）** | 依存する |
| **(e)** `custom_states` `show_delta` 付与（新規） | handover §3 | **`mai` / `lily` / `juri` / `kimberly`**（現行 `custom_states` 未定義。§A-補足 4） | 依存する |
| **(e)** `custom_states` int ①②③ の実データ E2E | handover §3 / M16-07 | **`ingrid`**（`type=level` / `min=0,max=4` / `show_delta=true` が 000023 で定義済） | 依存する |
| **(f)** command 索引の多様性: 単方向 | 指示書 §4.2 | **29 キャラ**（`category=unique` 限定。`ken` のみ 0 件） | ほぼ依存しない |
| **(f)** command 索引の多様性: 溜め | 指示書 §4.2 | **8 キャラ**: `akuma` / `blanka` / `chun_li` / `dee_jay` / `e_honda` / `guile` / `m_bison` / `rashid` | 依存する |
| **(f)** command 索引の多様性: 一回転 | 指示書 §4.2 | **2 キャラのみ**: `lily` / `zangief` | **強く依存する（最も狭い制約）** |
| **(f)** command 索引の多様性: 空中 | 指示書 §4.2 | **24 キャラ**（unique/special 限定。0 件は `ed`/`guile`/`jp`/`mai`/`manon`/`sagat`） | ほぼ依存しない |
| `move_code` `_2` フォールバック | 指示書 §4.2 | **literal `_2` が実在するのは `guile` のみ**。同名衝突自体は `cammy`/`guile`/`juri`/`ken` の 4 キャラ | **強く依存する** |
| 通常投げ採番（3 件以上） | 指示書 §4.2 | **11 キャラ**（§A-補足 2）。最多は `zangief`(6)、次いで `guile`(4) | 依存する |

**単独で「溜め」と「一回転」を同時に踏むキャラは 0 件**（溜め 8 キャラと一回転 2 キャラの積集合は空）。command 索引の全区分を踏むには最低 2 キャラの組合せが要る。

---

## C. 例外事項の類型と該当キャラ対応表

> **調査範囲の変更（開発者指示 2026-07-09・第 2 次）**: テリー 1 キャラの手入力 CSV に限定せず、**全 30 キャラの公式データを対象に例外類型を洗い出す**方針へ拡大された。以下は `combomgr-importer/dist/*.csv`（全 2121 行）・`dist/*.review.md`・公式 HTML の日英技名（全 2361 行を文書順で突合、未整合 0）・`internal/code/code.go`（採番ルールの正本）からの実査結果である。
>
> **手入力 CSV（`moves-input-tool` 出力）は依然として本環境に存在しない**（ツールのソースのみ。データストア既定パス `~/.movestool`（`cmd/movestool/main.go:87`）も未作成）。したがって「手入力ツール側でどう扱ったか」は本レポートの対象外であり、以下は**公式データと importer 側の変換結果**に基づく類型である。
>
> 人間の開発者（手入力担当）向けの元データ抜粋・キャラ別 Q&A は `tmp/20260709-official-data-edge-cases.md` に別途整理した。

### C-0. 採番ルールの正本（類型を読む前提）

`internal/code/code.go`。`move_code = MoveCode(name_en)` の 2 ステップのみで、**日本語名は採番に使われない**。

1. `.` を除去して連結。それ以外の非英数字（空白・`()`・`[]`・`/`・`'`・`-`・`:`・**非 ASCII 文字**）はすべて語境界。小文字化して `_` 連結。
2. **先頭トークンが `l`/`m`/`h`/`od` のときだけ**末尾へ移し `light`/`medium`/`heavy`/`od` にする。

固定 code は `throw_forward`（投げ 1 件目）/ `throw_back`（2 件目）/ `drive_impact` / `drive_parry` の 4 種。衝突解決は「英語 `condition_en` が異なれば前提条件由来サフィックス（ストップワード `during`/`while`/`a`/`an`/`the`/**`od`** を除去）、同一なら `_2`〜」。

### C-1. 例外類型 × 該当キャラ

| # | 類型 | 該当キャラ（件数） | seed / M17 への含意 |
|---|---|---|---|
| **T1** | **強化状態プレフィクスにより強度・OD が `move_code` の中間に残る**（`lightning_beast_l_rolling_attack` ⇔ 無印 `rolling_attack_light`）。手順 2 が「先頭トークンのみ」を対象とするため | `mai`(21) `blanka`(17) `lily`(10) `guile`(9) `m_bison`(9) `rashid`(8) `jamie`(6) `e_honda`(4) `dhalsim`(3) `cammy`(2) `ryu`(2) — 計 **91 行 / 11 キャラ** | `move_code` からの強度パースは不可能。正準採番（DES-004 §2.1）と突き合わせる際、無印と強化版で語順が異なる |
| **T2** | **`OD` が先頭のときだけ後置される結果、強度が先頭に残る** | `jp` のみ（`l_triglav_od` / `m_triglav_od` / `h_triglav_od` の 3 行） | 全キャラ唯一の形。`_od` 接尾と `l_` 接頭が同居する |
| **T3** | **英語名の非 ASCII 文字が語境界となり `move_code` から欠落** | `manon`(21 行)。`Manège Doré`→`man_ge_dor` / **`À Terre`→`terre`**（単語消失）/ **`SA2 Étoile`→`sa2_toile`** | code の可読性・一意性が損なわれる。seed 投入前に正準採番の是正要否を判断する必要 |
| **T4** | **英語名の括弧内が丸ごと code に入り異常に長い**（40 文字超） | `manon`（最長 57 字 `man_ge_dor_attack_changes_according_to_medal_level_medium`）`m_bison`(53) `rashid`(52) `jamie`(44) | `moves.code` の長さ制約・UI 表示幅 |
| **T5** | **公式英語名そのものの誤り** | `juri`: `[チェーンコンボ]ジャンプ強P（空震脚）` に `[Chain combo]Neutral Jumping Heavy Kick`（Punch であるべき）→ 同キャラの垂直ジャンプ強K と英語名が重複し code 衝突を誘発／`luke`: `OD ノーチェイサー` に `OD Chaser`（`No` 欠落）→ `chaser_od`（無印は `no_chaser`） | 英語名由来の採番が破綻。seed 前に人手補正が要る |
| **T6** | **日本語名と英語名が別の技名** | `c_viper`（セービングフォース ⇔ `Focus Force`、サンダースラップ ⇔ `Thunder Dash`）`alex`（デンジャラスアプローチ ⇔ `Dangerous Armbar`、ステップイン ⇔ `Low Rush`、ブレイカー・スタンス ⇔ `Prowler Stance`）`e_honda`（肩屋入り ⇔ `Sumo Spirit`）`ken`（奮迅脚 ⇔ `Quick Dash`）`zangief`（連打版 ⇔ `Rapid cancel version`） | 日本語名から code を推測できない |
| **T7** | **括弧種の日英不一致・キャラ間の揺れ** | ja 隅付き `【】`: `blanka` `guile` `ken` `rashid` ／ ja 角 `[]`: 他 10 キャラ ／ en 丸 `()`: `dee_jay` `guile` `zangief`（他は角 `[]`）。ja `(ホールド)` 半角は `rashid` のみ（他 10 キャラは全角） | 表記正規化の要否 |
| **T8** | **`command` が空欄** | `cammy`(3) `aki`(2) `kimberly`(2) `marisa`(2) `akuma`(1) `sagat`(1) — 計 **11 行**。うち **`aki` の 2 行は `condition` も空**（入力情報ゼロ） | command 索引〔(f)〕の索引源に載らない行 |
| **T9** | **未知トークン `raw{-}`**（公式コマンド欄が `-`） | `blanka`(2: ブランカちゃん爆弾（射出）) `m_bison`(1: サイコマイン（自動爆発）) | 索引に載せられない。語彙拡張の要否 |
| **T10** | **`command` 内に日本語条件 `cond{…}` が残留** | `guile` の `sonic_cross1_od` 1 行（`r plus p p or cond{（ODソニックブレイド中に）} r plus p`） | 索引キーがロケール依存になる唯一の行 |
| **T11** | **`alt_sep`（公式表記の `/` による別コマンド併記）** | `m_bison`(3) `ingrid`(2) — 計 5 行 | 1 move に 2 通りの入力 |
| **T12** | **同一 `command` に複数 move が対応**（command → move_code が一意でない） | **全 30 キャラ・442 グループ**。最多 `mai`(31) `blanka`(23) `juri`(22)。最少 `terry`(8) `manon`(8) `jp`(8) | **M17 段階2 の決定論解決の前提に直結**。索引は 1:N を返す設計が要る |
| **T13** | **`condition` の複数併記（区切り ` / `）** | 18 キャラ・46 行。`cammy`(7) `ingrid`(6) `jamie`(6) `guile`(4) 他。**`ingrid/solar_burst_lv1` のみ 3 併記で 1 つ目と 3 つ目が同一文字列**（公式データ異常） | 条件の構造化パースが必要 |
| **T14** | **`condition` の言い回しが「中に」以外** | `kimberly/step_up`=`（飛箭蹴後に）`／`c_viper/thunder_dash_feint`=`（サンダースラップ攻撃前に）`／`marisa/scutum_physical_counter_version`=`※スクトゥム中に打撃を受ける`（**括弧なし・`※` 始まり**） | 前提条件由来サフィックス（衝突解決）の入力が非定型 |
| **T15** | **`recovery` 列だけ非整数の文字列が生で残る** | **全 30 キャラ・764 行**。`着地後N`(366) `全体 N`(271) `N+着地後N`(97) `※N`(24) 他。他の数値列（`startup`/`active`/`on_hit`/`on_block`/`damage`）の非整数は **0 件**（空欄化＋`notes` へ原文退避） | **`total = startup + active − 1 + recovery`（DES-003 §3.3）が計算不能な行が 764 行**。M14-03b §4.1 の `total` 算出・`recovery` 設定に直撃 |
| **T16** | **`combo_scaling` 列は数値でなく JSON** | 全 30 キャラ・715 行。`{"initial_scaling":20}` 334 他・異なり 38 種 | 取込写像の要確認 |
| **T17** | **通常投げ 3 件目以降は固定 code にならず機械変換に落ちる** | 11 キャラ（`zangief` 6 / `guile` 4 / 他 9 キャラ 3）。公式名は `notes` の `公式名:` へ退避（全 60 件） | 投げ採番経路〔§B〕 |
| **T18** | **code 衝突（前提条件由来サフィックスで解決）** | `cammy`(4) `ken`(3) `guile`(2) `juri`(2) = 5 グループ 11 行。**literal `_2` は `guile/rolling_sobat_2` の 1 行のみ** | `_2` フォールバック検証〔§B〕 |
| **T19** | **`is_aerial` 自動 true 化の取りこぼし** | `mai` の 2 行のみ（`sa2_air_chou_hissatsu_shinobi_bachi` ほか。技名に「空中」を含むが `is_aerial=false`）。ツールの判定根拠は「技名に『ジャンプ』」または条件「（ジャンプ中に）」（`terry.review.md` §5） | seed 投入値の人手補正 |
| **T20** | **`move_code` 末尾 `_N` が「段目」と「衝突解決」の同形** | 段目由来: `dee_jay`(30) `jamie`(13) `elena`(8) `luke`(6) `kimberly`(5) 他。衝突由来: `guile` 1 行 | `_N` の有無で両者を判別してはならない |

### C-2. 例外類型の被覆マトリクス

T12 / T15 / T16 / T20 は**全 30 キャラで発生する**ため除外し、**キャラ固有の 16 類型**（T1〜T11, T13, T14, T17, T18, T19）で被覆数を算出した。

| キャラ | 被覆数 | 踏む類型 |
|---|---|---|
| `guile` | 6 | T1, T7, T10, T13, T17, T18 |
| `blanka` | 5 | T1, T7, T9, T13, T17 |
| `cammy` | 5 | T1, T8, T13, T17, T18 |
| `m_bison` | 5 | T1, T4, T9, T11, T13 |
| `rashid` | 5 | T1, T4, T7, T13, T17 |
| `juri` | 4 | T5, T13, T17, T18 |
| `mai` | 4 | T1, T13, T17, T19 |
| `zangief` | 4 | T6, T7, T13, T17 |
| `alex` | 3 | T6, T13, T17 |
| `jamie` | 3 | T1, T4, T13 |
| `jp` | 3 | T2, T13, T17 |
| `ken` | 3 | T6, T7, T18 |
| `kimberly` | 3 | T8, T13, T14 |
| `manon` | 3 | T3, T4, T13 |
| `akuma` | 2 | T8, T13 |
| `c_viper` | 2 | T6, T14 |
| `chun_li` | 2 | T13, T17 |
| `dhalsim` | 2 | T1, T17 |
| `e_honda` | 2 | T1, T6 |
| `ingrid` | 2 | T11, T13 |
| `lily` | 2 | T1, T13 |
| `marisa` | 2 | T8, T14 |
| `sagat` | 2 | T8, T13 |
| `aki` | 1 | T8 |
| `dee_jay` | 1 | T7 |
| `luke` | 1 | T5 |
| `ryu` | 1 | T1 |
| `ed` | 0 | — |
| `elena` | 0 | — |
| `terry` | 0 | — |

**固有類型 0（＝例外が少なく量産しやすい）**: `terry`（既定メンバー）/ `ed` / `elena`。

**そのキャラでしか踏めない類型**: T2 → `jp` のみ。T3 → `manon` のみ。T10 → `guile` のみ。T19 → `mai` のみ。T8 のうち「`command` と `condition` の両方が空」→ `aki` のみ。

> **§E への反映**: §E は本節（C-2）が未確定の時点で書かれており、「例外類型の分散」軸を反映していない。C-2 が確定した現在、**§E 案 1（`terry`/`guile`/`lily`/`ingrid`/`kimberly`）は固有類型 6+2+3 = 被覆 T1,T7,T10,T11,T13,T14,T17,T18,T8 を踏む**一方、T2(`jp`)・T3(`manon`)・T19(`mai`) は踏まない。§E 案 2（`terry`/`guile`/`zangief`/`lily`/`juri`/`mai`）は T19 を追加で踏む。最終決定は開発者。

### C-3. 手入力 CSV（`tmp/terry.csv`）の実査

2026-07-09 に開発者が配置し、同日**再出力**された（**確定版ではない**）。本節は**再出力版**（80 データ行 × 19 列）に基づく。

> **本 CSV は設計担当にも共有すること**（開発者指示 2026-07-09）。列構成・区分・充填状況が M14-03b の前提に直接影響するため。

```
character_code, move_code, category, name_ja, startup, active, recovery, total,
on_hit, on_block, damage, is_aerial, is_projectile, notes, notes_tool,
original_move_code, command, condition_ja, condition_en
```

#### C-3-1. importer CSV（22 列）との構造差

| 差分 | 内容 |
|---|---|
| **追加列** | `total`（算出値）/ `is_projectile`（飛び道具）/ `notes_tool`（ツール付記の分離）/ `original_move_code`（`rush_variant` の派生元） |
| **削除列** | `drive_gauge_increase` / `drive_gauge_decrease_guard` / `drive_gauge_decrease_punish` / `super_art_gauge_increase` / `combo_scaling` / `properties`（M14-01 の 6 列削除に対応） |
| 行数 | 80（importer 58） |

#### C-3-2. category 分布の差（アプリ独自区分が実在する）

| category | 手入力 | importer（公式） |
|---|---|---|
| `normal` | **19** | 18 |
| `special` | 21 | 21 |
| `throw` | 2 | 2 |
| `critical_art` | 1 | 1 |
| `drive_impact` | 1 | 1 |
| `super_art` | **5** | 6 |
| `unique` | **1** | 8 |
| **`target_combo`** | **7** | **0** |
| **`system`** | **10** | 1 |
| **`rush_variant`** | **13** | 0 |

- 公式の `unique` 8 件のうち **7 件が `target_combo` へ再分類**（`power_drive` / `power_shoot` / `power_dunk` / `passing_sway` / `jumping_lariat` / `jumping_knee` / `fire_kick`）。`hammer_punch` のみ `unique` に残る。
- `system` 10 件 = `drive_parry` ＋ **移動 system move 9 種**（`forward` / `back` / `micro_forward` / `micro_back` / `dash_forward` / `dash_back` / `jump_neutral` / `jump_forward` / `jump_back`）。**開発者回答（2026-07-09）: 移動 9 種の混入は誤りであり削除を検討する**。
- `rush_variant` 13 件 = 通常技 12 ＋ `rush_hammer_punch`（`unique` 由来）。すべて `original_move_code` を持つ。**開発者回答: ラッシュ版を手入力側へ寄せることは合意済みで問題なし**。
- `normal` が 1 件多いのは、再出力で **`standing_heavy_punch2`（`name_ja` = `立ち強P_1段`・`damage` 400）** が追加されたため（`standing_heavy_punch` は `damage` 800）。`move_code` は `_2` ではなく **`2`（アンダースコアなし）**。
- importer にあって手入力に無いのは `quick_burn` / `round_wave` / `sa2_triple_geyser_dud` の 3 件。前 2 件は **強度サフィックス付き `quick_burn_light` / `round_wave_heavy` に改名**。`sa2_triple_geyser_dud`（不発）は **意図的に除外**（開発者回答。「他にも意図的に抜くべきデータはありそう」）。

#### C-3-3. 列の充填状況（80 行中の非空件数・再出力版）

| 列 | 非空 | 列 | 非空 |
|---|---|---|---|
| `character_code` / `move_code` / `category` / `name_ja` / `is_aerial` / `is_projectile` | 80 | `on_block` | 58 |
| `startup` | 71 | **`command`** | **55** |
| `damage` | 67 | `on_hit` | 31 |
| `active` | 65 | `original_move_code` | 13 |
| `recovery` / `total` | 59 | `condition_ja` / `condition_en` | 9 |
| **`notes` / `notes_tool`** | **0** | | |

**`notes` / `notes_tool` が空なのは仕様**。開発者回答（2026-07-09）: 備考相当のデータはインゲームに存在せず、**法的リスクを避ける手入力データでは公式と一致しないのが当然**。

#### C-3-4. `command` は公式と完全一致（索引源として成立する）

初回配置時は `command` が全行空だったが、**再出力版では 55 行に充填され、importer CSV と共通する 55 move すべてで文字列が完全一致**（差分 0）。M14-03b §4.8 の「手入力 CSV の command 相当列を索引源とする」前提は成立する。

`command` が空の 25 行の内訳:

| 区分 | 件数 | 備考 |
|---|---|---|
| `rush_variant` | 13 | 機械生成のため入力なし |
| `system`（移動 9 種） | 9 | `drive_parry` には `p_m k_m` が入る |
| `normal` | 1 | `standing_heavy_punch2` |
| `special` | 2 | **`round_wave_heavy` / `quick_burn_light`**（改名した 2 件。公式側では `round_wave` = `d dr r plus p_h`、`quick_burn` = `d dl l plus p_l` を持つ） |

`condition_ja` / `condition_en` は 9 行（ジャンプ通常技 6・`throw_forward` / `throw_back` の `（近距離で）`・`ca_rising_fang` の `（体力25%以下で）`）。

#### C-3-5. T15（`recovery` 非整数）は手入力側で解消済み

手入力 CSV の `recovery` は **全行が整数**（非整数 0 件）。`total = startup + active − 1 + recovery` は、3 列とも整数の 59 行**すべてで一致**（不一致 0 件）。

| 公式 `recovery` | 手入力 | 補正の性質 |
|---|---|---|
| `21+着地後12` / `28+着地後12` / `27+着地後15` / `34+着地後15`（`rising_tackle_*`） | `33` / `40` / `42` / `49` | **加算** |
| `着地後3`（ジャンプ通常技 6 行） | **空欄** | 再出力で空欄化（初回配置版は実測値が入っていた） |
| `全体 49` / `48` / `43`（`power_wave_*`） | **空欄** | 同上 |

**T15 は手入力工程で解決している**（F-12 の開発者回答と整合）。ただし再出力版では `着地後N` / `全体 N` 系が **数値化ではなく空欄化**されており、初回配置版より充填が後退している（`recovery` 70→59、`total` 67→59、`damage` 70→67、`on_hit` 34→31）。作業途中と見られる。

#### C-3-6. `is_aerial` は手入力 CSV が正

手入力 CSV の `is_aerial=true` は **ジャンプ通常技 6 行のみ**（`jumping_light_punch` 〜 `jumping_heavy_kick`）。開発者定義（ラッシュ版生成の除外判定・`normal`/`unique` のみ対象）と厳密に一致する。
importer CSV は `special` / `throw` / `super_art` にも `true` を付与するが（§F-4）、**手入力 CSV の値が最新かつ正しい**（開発者回答 2026-07-09）。seed には手入力 CSV の `is_aerial` を採る。

`is_projectile=true` は `power_wave_light` / `power_wave_medium` / `power_wave_od` の 3 行（importer に該当列なし）。

#### C-3-7. 公式との数値差（共通 55 move のうち 27 move）

**公式データ側に誤りがあり、手入力 CSV が正しい**ケースを含む。開発者回答（2026-07-09）: **テリーのジャンプ攻撃の情報入れ替わりは公式データ側の誤り**。

> **★★【2026-09-11 是正＝`M26-03`（`A3`）・開発者判断】本表の「例」欄から公式の生フレーム値・ダメージ値を落とし、対象の技と列だけを残した。**
> **⇒ 理由＝本ファイルは公開スナップショットに含まれる。★`docs/seed-data/` をディレクトリごと除外した理由**（`D-742`＝「公式の生フレーム値・元データ抜粋を含む」）**と同じ内容が、除外されていない側に在った。**
> **★件数・技・列・是正の向きは落としていない。⇒ 本表の主張**（公式側に誤りがあり手入力が正しい）**は値を引かずに成立する。★値そのものが要るときは `character_data/*.csv` が正本である。**

| 系統 | 件数 | 対象（**★値は落とした**） |
|---|---|---|
| **公式側の誤り（ジャンプ攻撃）** | 6 | `jumping_medium_punch` と `jumping_medium_kick` で **`active` と `damage` が公式側で入れ替わっている**（**手入力が正**）。加えて `startup` が公式より 1F 小さい行が 5 件（jMP / jMK / jHP / jHK / jLK） |
| `recovery` の非整数解消（加算） | 4 | `rising_tackle_*` |
| `damage` を**多段合計**へ置換 | 6 | `power_drive` / `power_shoot` / `power_dunk` / `passing_sway` / `fire_kick` / `sa2_twin_geyser` / `sa2_triple_geyser` |
| 公式が空欄の `active` を補完 | 2 | `crack_shoot_heavy` / `drive_parry`（**公式は空欄**） |
| 単独の数値差（実測による是正） | 9 | `burning_knuckle_heavy`（on_block）/ `crack_shoot_heavy`（damage）/ `crouching_medium_punch`（recovery）/ `standing_light_kick`（recovery）/ `power_charge_heavy`（startup）/ `power_dunk`（active）/ `passing_sway`（recovery）/ `quick_burn_od`（active・recovery）/ `rising_tackle_light`（on_block） |
| 再出力で空欄化 | 6 | `power_wave_*`（damage / on_hit / recovery）/ `sa2_twin_geyser` `sa2_triple_geyser`（active / recovery） |

#### C-3-8. 手入力 CSV に起因する事実と開発者トリアージ

| # | 事実 | トリアージ（2026-07-09） |
|---|---|---|
| **H-1** | 初回配置版は `command` / `condition_*` が全行空だった | **解消**。再出力版で `command` 55 行・`condition` 9 行が充填され、公式と完全一致 |
| **H-2** | **移動 system move 9 種が手入力 CSV に含まれる**。M14-03b §1.2 は「移動 system move は手入力 CSV に依存しない（SUPP-001 §3.3.2 の seed 管理 move）ため全キャラ分を本サブで投入」としており、投入元が二重になる | **誤りであり削除を検討**（開発者）。**本 CSV を設計担当にも共有すること** |
| **H-3** | `rush_variant` 13 行が手入力 CSV に含まれる。現行 ryu seed（`000004` 第 6 INSERT）も SQL で派生生成しており、生成責務が二重に見える | **問題なし**。ラッシュ版を手入力側へ寄せることは合意済み（開発者） |
| **H-4** | `notes` / `notes_tool` が全行空。公式側の `notes`（`ヒット時ダウン(D)` 952 件 / `属性原文` 221 件 / `公式名:` 退避 60 件）が引き継がれていない | **問題なし**。備考相当データはインゲームに存在せず、法的リスクを避ける手入力データでは一致しないのが当然（開発者） |
| **H-5** | `sa2_triple_geyser_dud`（不発）が手入力 CSV に無い（`super_art` 5 / 公式 6） | **意図的な除外**。「他にも意図的に抜くべきデータはありそう」（開発者）＝**除外対象の確定が M14-03b の前提** |
| **H-6** | `move_code` の改名（`quick_burn` → `quick_burn_light`、`round_wave` → `round_wave_heavy`）。強度サフィックスを人手で付与しており importer の機械採番とは別体系 | 事実として記録。**改名した 2 件は `command` が空**（公式側は値を持つ）＝移植漏れの可能性 |
| **H-7** | `jumping_medium_punch` と `jumping_medium_kick` の `active` / `damage` が公式と手入力で入れ替わっている | **公式データ側の誤り**であり **手入力 CSV が正しい**（開発者。再出力後も同じ値を維持）。同じくジャンプ通常技 5 件の `startup` も手入力側が正 |
| **H-8** | 再出力版で `standing_heavy_punch2`（`立ち強P_1段`・`damage` 400）が追加。`move_code` はアンダースコアなしの `2` サフィックス | 事実として記録。F-10 の「`_N` が段数を表す必要はない」と整合 |
| **H-9** | 再出力版で `power_wave_*` の `damage` / `on_hit` / `recovery`、`sa2_*_geyser` の `active` / `recovery` が空欄化（初回配置版では充填済み） | 作業途中と見られる。**確定版ではない**（開発者） |

---

## D. dup 測定軸の転記

`docs/progress/phase3/M16-RESEARCH-01-report.md` §C（L165〜L191）より、M14-03b の再測定が同軸で比較できるよう原文を転記する。

**測定対象（C-1・L169）**

> `combos` テーブルに `recipe_hash` 列は存在しない(migrations 全 18 本に無し)。実体は `internal/service/combo/duplicate_keys.go:45` の関数 `CalcRecipeHash(steps []model.ComboStep) string` で、**リクエスト時に都度計算**される

**測定キー その1: recipe_hash アルゴリズム（C-1・L171）**

> (1) steps を step_order 昇順ソート、(2) 各 step を `"<move_id または \"null\">:<canonicalModifiersJSON(modifiers)>"` に変換、(3) `"\n"` 連結、(4) SHA-256 hex。`canonicalModifiersJSON`(`duplicate_keys.go:81-101`)は modifiers が nil なら `"null"`、非 nil なら `Flags`(ソート済み)/`Type`/`Notes` を持つ **Modifiers 構造体全体を `json.Marshal`**(`omitempty`、Go 構造体のフィールド順 flags→type→notes)。→ **modifiers.Type・Flags(順序非依存)・Notes(自由記述含む)がすべてハッシュ対象**

**測定キー その2: DuplicateKey（C-2・L175）**

> DuplicateKey 側(SQL 一致条件)は character_id/starter_move_id/position/opponent_stance/hit_type/opponent_size の 6 項目のみで、ゲージ・起き攻めは含まない

対応する SQL 条件は `internal/repository/combo/repository.go:772-826`（`character_id=? AND is_draft=0 AND deleted_at IS NULL` ＋ NULL 対応等価）。

**母集団（L131 / L184 / L191）**

> published(FR301 dup 判定の母集団)は 78/79/80(ryu)・91(ingrid)の 4 件のみ。残り 13 件は draft か trash であり、現行の VAL-C02(dup 判定)には元々関与しない。

> published 30 件を DuplicateKey(character_id, starter_move_id, position, opponent_stance, hit_type, opponent_size)でグルーピングした結果、2 件以上のグループは 6 個

> 母集団は dev DB(ryu 中心・少量・開発者本人データ)であり、published 30 件のうち dash 移行の影響を受けるのは 4 件のみ(うち 1 件は移行不能)。**「衝突ゼロ」は現行の小規模・偏ったデータでの結果であり、M14-03b(全キャラ seed)後にデータ量・組み合わせが増えれば結果は変わり得る**

**実測結果（L18 / L185）**

> published 30 件を母集団に「modifier.type dash → system move dash」移行を仮定した SELECT ベースの照合を行った結果、**dup 衝突は 0 件**

> 移行前ハッシュのグループ内衝突: 0 件(サニティチェック)

**未解決ブロッカー（L208）**

> 現行 dev DB では dash 移行による dup 衝突は 0 件だが、**ingrid combo #91 の移行不能というブロッカーが実在する**

**再測定時の比較可能性に関する事実**: 上記の「published 30 件」「グループ 2 件以上が 6 個」「衝突 0 件」はいずれも **dev DB** に対する測定である。M14-03b は clean マイグレ由来 DB で構築する方針（指示書 §3.2）のため、**母集団が同一でない**。同軸比較には母集団の明示が要る。

---

## E. 第一波候補案（指示書 §0.3 の例外）

> **前提の明示**: 以下の 2 案は §C が保留だった時点で、§B（検証カバレッジ）と §A-9（入力コスト）の 2 軸のみに基づいて作成した。**§C 確定後の 3 軸目（例外類型の分散）による評価は §C-2 末尾の注記を参照**。案そのものは差し替えていない。
> **最終決定は開発者。**

`terry` を既定メンバーとする（指示書 §5-E・M14-03b §1.4）。

### 制約となる事実

1. 一回転（`circle`）を踏めるのは `lily` / `zangief` の 2 キャラのみ（§B）。どちらかを入れないと (f) の一回転区分が検証できない。
2. literal `_2` フォールバックが実在するのは `guile` のみ（§A-補足 3）。
3. (e) の `show_delta` 新規付与は `mai` / `lily` / `juri` / `kimberly` のいずれかが要る。int ①②③ の実データ E2E は `ingrid` が要る（§A-補足 4）。
4. `terry` は溜め 0 / 一回転 0 / 空中 2 / TC(chain) 7 / 投げ 2 / 衝突 0、総行数 58（30 キャラ中 3 番目に少ない）。
5. 総行数の分布は 51（`manon`）〜97（`dee_jay`）。

### 案 1: 5 キャラ・最小構成（合計 341 行）

`terry` / `guile` / `lily` / `ingrid` / `kimberly`

| キャラ | 行数(§A-9) | 満たす検証観点（§A の行 → §B の観点） |
|---|---|---|
| `terry` | 58 | 既定メンバー（変換系一次サンプル）。TC chain 7 件 → **(d) target_combo passthrough**。単方向+ボタン 1 件・空中 2 件 → **(f)** |
| `guile` | 72 | 溜め 18 件 → **(f) 溜め区分**。`rolling_sobat_2` → **`_2` フォールバック（唯一の実例）**。通常投げ 4 件 → **投げ採番**。同名衝突 2 件 |
| `lily` | 66 | `circle` 4 件 → **(f) 一回転区分（2 キャラ中の 1）**。`custom_states` 未定義 → **(e) show_delta 新規付与**。空中 6 件 → **(f)**。TC 和集合 4 件 → **(d)** |
| `ingrid` | 67 | `sun_crest` `type=level, min=0, max=4`, `show_delta=true`（000023 既定義）→ **(e) int ①②③ の実データ E2E**。空中 8 件・TC 和集合 6 件 |
| `kimberly` | 78 | `custom_states` 未定義 → **(e) show_delta 新規付与（2 キャラ目）**。TC chain 7 / 段目 5 / 和 7 → **(d)**。空中 4 件 |

- **未カバー**: 一回転は `lily` の 1 キャラのみ（`zangief` 不在）。通常投げ最多の `zangief`(6 件) を踏まない。
- **カバー**: (d) / (e) 新規・既存の両方 / (f) 単方向・溜め・一回転・空中の全 4 区分 / `_2` フォールバック / 投げ採番（`guile` 4 件）。

### 案 2: 6 キャラ・カバレッジ厚め（合計 421 行）

`terry` / `guile` / `zangief` / `lily` / `juri` / `mai`

| キャラ | 行数(§A-9) | 満たす検証観点（§A の行 → §B の観点） |
|---|---|---|
| `terry` | 58 | 既定メンバー。TC chain 7 件 → **(d)** |
| `guile` | 72 | 溜め 18 件 → **(f) 溜め**。`rolling_sobat_2` → **`_2` フォールバック**。投げ 4 件・衝突 2 件 |
| `zangief` | 64 | `circle` 8 件 → **(f) 一回転**。**通常投げ 6 件（30 キャラ中最多）→ 投げ採番の最深経路**。単方向+ボタン 7 件・空中 4 件 |
| `lily` | 66 | `circle` 4 件 → **(f) 一回転（2 キャラ目・冗長確認）**。`custom_states` 未定義 → **(e) show_delta** |
| `juri` | 79 | `custom_states` 未定義 → **(e) show_delta**。同名衝突 2 件（条件由来サフィックス解決型）。単方向+ボタン 8 件・投げ 3 件 |
| `mai` | 82 | `custom_states` 未定義 → **(e) show_delta**。空中(unique/special) **0 件**＝空中不在の対照。投げ 3 件。§F-4 の `is_aerial` 不整合 2 行を含む |

- **未カバー**: `ingrid`（(e) int ①②③ の実データ E2E）が入っていない。ただし `ingrid` は既に `custom_states` 定義済みのため、moves seed 無しでも一部確認が成立しうる（成否は M14-03b の Plan Mode で実査要）。
- **カバー**: (f) 全 4 区分 / 一回転を 2 キャラ / `show_delta` 新規を 3 キャラ / 投げ採番を最深（6 件）まで / 同名衝突を 2 類型（literal `_2` と条件由来サフィックス）。

### 参考: 入力コスト（総行数）の昇順

`manon` 51 / `aki` 56 / **`terry` 58** / `c_viper` 61 / `jp` 61 / `e_honda` 62 / `ed` 62 / `sagat` 62 / `zangief` 64 / `m_bison` 64 / `alex` 66 / **`lily` 66** / `ryu` 67 / **`ingrid` 67** / `cammy` 67 / `ken` 68 / `luke` 68 / `chun_li` 70 / `elena` 71 / **`guile` 72** / `rashid` 77 / **`kimberly` 78** / `juri` 79 / `dhalsim` 81 / `mai` 82 / `akuma` 83 / `blanka` 83 / `marisa` 83 / `jamie` 95 / `dee_jay` 97

---

## F. 想定外の発見・明らかな矛盾（事実指摘のみ）

### F-0. 開発者トリアージ（2026-07-09 回答・本節の読み方）

以下は §F の各項目に対する開発者回答であり、**「発見」の多くは既知・仕様どおり**であることが確定した。回答を受けて本節の記述を訂正した箇所には「**［訂正］**」を付す。

| # | 開発者回答 | 状態 |
|---|---|---|
| F-1 | 現行 SQL 上の ryu データは**仮**。公式データが全面的に正しい | 認識済み・問題なし |
| F-2 | `rush_variant` は**ラッシュ版を扱いやすくするアプリ内独自区分**。機械生成であり、normal / unique の入力が正しければ誤りは起きない | 認識済み・必要・問題なし |
| F-3 | `target_combo` も**アプリ内独自区分**。必要なもの | 認識済み・問題なし |
| F-4 | **`is_aerial` は「ラッシュ版を生成するか否か」の判定用**（ジャンプの通常技・特殊技は生成しない）。**空中技のフラグではない**。対象は normal / unique 区分のみで、`mai` の当該技は `super_art` のため対象外＝`false` で問題なし。**手入力 CSV の `is_aerial` が最新かつ正しい** | ［訂正］F-4 を差し替え |
| F-5 | `circle` は他コマンドと別物で文字通り一回転入力。**時計回り/反時計回りを判別しない暗黙の了解**がある。CSV は最終形である必要はなく、`r` 起点の時計回りに正規化しても、方向不問で解決してもよい。**`circle` だけが方向を気にしない例外**で、他の技は表示どおりの入力である必要がある | ［訂正］F-5 に補記 |
| F-6 | 技名とコマンドは CSV で別項目のため問題なし（grep 上の見え方の問題） | 問題なし |
| F-7 | 溜めとは厳密に違うが、これらも長押し操作でありコマンド解決用としては問題ない。**そもそもコマンド解決時に溜めを無視して通常の矢印として扱える可能性があり、`charge` を省く選択肢もある** | 設計余地あり |
| F-8 | `custom_states` が 3 キャラのみ | **課題として了解** |
| F-9 | `tmp/terry.csv` を配置し、同日**再出力**（**まだ確定ではない**）。一部フレームは実測で公式どおり再現できず不一致だが、公式とバリデーションしたうえで正しい内容が入っているはず。**本 CSV は設計担当にも共有すること** | 実物受領 → §C-3 で実査（再出力版） |
| F-10 | 問題なし。**同名で別技であることを表現できればよく、`_N` が段数を表す必要はない** | 問題なし |
| F-11 | 31 番目は**未実装**。実装予定が近く、本アプリのリリース前に追加される可能性がある。モダン対象外は問題なし | 認識済み |
| F-12 | 認識済み。**手入力の時点で人間が補正する**（§C-3 で補正済みを確認） | 認識済み |
| F-13 | **記録すること**（`docs/progress/progress-log.md` へ記録済み） | 記録 |
| F-14 | **課題とする**。マノンの技は**形が似ているアルファベットで代用したい**（`_` にしているのはよくない） | **課題** |
| F-15 | **一番若いデータを解決するか、`lv` 等の文字を含めるかの設計判断とする** | **設計判断** |

**開発者の総括（2026-07-09）**: 「公式データから作った CSV もそのままでは使えず一部 AI 補完が必要。手入力 CSV も一部 AI 補完が必要。**この補完をどういったスコープでさせるかの検討は必要**」。

**F-1. importer CSV の `move_code` は現行 ryu seed の正準採番と体系が異なる。**
`migrations/000004_seed_moves_ryu.up.sql` から抽出した `move_code` 50 件（＋第 6 INSERT が `rush_` プレフィクスで 6 件を派生生成＝計 56 件で指示書 §3.2 の「ryu 56 技」と一致）と、`dist/ryu.csv` の 67 件の積集合は **15 件のみ**。差異例: seed `crouch_light_punch` ⇄ CSV `crouching_light_punch`、seed `collar_bone_breaker` ⇄ CSV `collarbone_breaker`、seed `forward_throw`/`back_throw` ⇄ CSV `throw_forward`/`throw_back`。本レポート §A の `move_code` 表記は **importer CSV 由来**であり、seed の正準 code ではない。

**F-2. `rush_variant` category は公式データに行として存在しない。**
`000004` の第 6 INSERT は `moves` の既存 6 行（`stand_medium_punch` 等）から `rush_` プレフィクス付き `category='rush_variant'` 行を SQL で派生生成している（`original_move_id` を持つ）。`dist/*.csv` の category 実測値は `special`(915) / `normal`(578) / `unique`(301) / `super_art`(161) / `throw`(75) / `critical_art`(31) / `system`(30) / `drive_impact`(30) の 8 種のみで、`rush_variant` は 0 件。

**F-3. `category=target_combo` は公式データに 0 件。**
30 キャラ全体で該当行なし（F-2 の category 実測値）。指示書 §4.1-5 の「ターゲットコンボ相当（段数付き行）」は、公式データ上では **`chain` トークン（▶）** と **技名/`notes` の「N 段目」表記** の 2 系統として現れる。両者は一致しない（例: `terry` は chain 7 / 段目 0、`blanka` は chain 0 / 段目 1、`marisa` は chain 8 / 段目 7 で和集合 13）。`target_combo` は人手付与（DES-003 §3.3・CHANGE-065）である前提と整合する。

**F-4［訂正・非問題］. `is_aerial` は空中技フラグではない。**
当初「`mai` の 2 行が技名に『空中』を含むのに `is_aerial=false`」を不整合として記録したが、**開発者回答により誤読と判明**。`is_aerial` は **ラッシュ版（`rush_variant`）を生成するか否かの判定用**であり、対象は `normal` / `unique` 区分のみ。`mai` の当該 2 行（`sa2_air_chou_hissatsu_shinobi_bachi` ほか）は `super_art` のため対象外で、`false` が正しい。
**残る事実**（判断は含まない）: importer の `dist/*.csv` では `is_aerial=true` が `special`（例 `akuma/zanku_hadoken_light`）・`throw`（例 `mai/yume_zakura`）・`super_art`（例 `cammy/sa2_aerial_killer_bee_spin`）にも付与されており、**判定対象外の区分にも値が入っている**。一方、手入力 CSV（`tmp/terry.csv`）では `is_aerial=true` が **ジャンプ通常技 6 行のみ**で、開発者の定義と厳密に一致する（§C-3-6）。**同名の列が 2 つの CSV で異なる意味を持ち、手入力 CSV の値が最新かつ正しい**（開発者回答 2026-07-09）。seed には手入力 CSV の値を採る。

**F-16（追加・公式データの誤り）. テリーのジャンプ攻撃の数値が公式側で入れ替わっている。**
`dist/terry.csv` の `jumping_medium_punch`（`active=6, damage=500`）と `jumping_medium_kick`（`active=4, damage=700`）は、**2 列同時に入れ替わっている**。手入力 CSV は逆の値（jMP `active=4, damage=700` / jMK `active=6, damage=500`）を持ち、**手入力側が正しい**（開発者回答 2026-07-09）。加えてジャンプ通常技 5 件（jMP / jMK / jHP / jHK / jLK）の `startup` は公式より手入力側が 1F 小さく、こちらも手入力側が正。**公式フレームデータの誤りは §F-13 の英語名 2 件と合わせて計 3 系統**確認された。

**F-5［補記］. 一回転は `circle` トークンでしか確定できず、方向連続列からは判別できない。**
`manon` の `man_ge_dor_attack_changes_according_to_medal_level_*`（マネージュ・ドレ）4 行は `command = r dr d dl l plus p_*` で、方向トークンが 5 連続するが `circle` トークンを持たない。一方 `zangief` の `russian_suplex` 等は `circle plus p_l` と表現される。さらに、方向トークン 4 連続以上という条件では **SA の 2 回連続 QCF**（例 `ryu` `sa1_shinku_hadoken` = `d dr r d dr r plus p`）も 30 キャラ全てで大量にヒットするため、一回転の判定指標として使えない。§A の「2 一回転」列は `circle` トークン完全一致のみを採用している。
**開発者補記（2026-07-09）**: `circle` は他コマンドと別物で、**時計回り/反時計回りを判別しない暗黙の了解**がある。`circle` **だけ**が方向を気にしない例外で、他の技は表示どおりの入力である必要がある。CSV は最終形である必要がないため、`r` 起点の時計回りに正規化してもよい。
**残る事実**: `circle` を含むのは `zangief` 8 行と `lily` 4 行の計 12 行。うち `zangief/sa3_bolshoi_storm_buster` と `zangief/ca_bolshoi_storm_buster` は **`circle circle plus p`（2 回転）**。

**F-6. 溜め技の部分一致検出は誤検出する。**
`grep -c 'charge_'` は `ryu.csv` で 8 行ヒットするが、その実体は `denjin_charge_hadoken` / `denjin_charge_od_hadoken` / `denjin_charge_sa1_*` 等の **`move_code` 内の文字列**であり、`command` 列の `charge_d/l/r` トークンではない（`ryu` の溜め技は 0 件）。同様に `terry` も `power_charge` で 4 行が誤ヒットする。

**F-7. `charge` トークンは古典的な「方向溜め＋反対方向＋ボタン」以外にも現れる。**
`akuma` の `demon_swoop`（百鬼潜影）は `command = charge_d` 単独、`rashid` の `run`（ラン）は `command = r charge_r`。§A の「1 溜め」列（`akuma` 1 / `rashid` 1）はこれらを含む。

**F-8. `custom_states` の現行定義は 3 キャラのみ。**
`ryu` / `ingrid` / `c_viper`（`000015`）＋ `ingrid` の `show_delta`（`000023`）。handover §3-(e) が `show_delta` 付与対象とする **`mai` / `lily` / `juri` / `kimberly` は `custom_states` そのものが未定義**であり、`show_delta` の UPDATE だけでは成立しない（状態定義の新規 INSERT/UPDATE が先に要る）。

**F-9. テリーの手入力 CSV が本環境に不在。**
`moves-input-tool` のソースは存在するが出力物が無い（§C）。M14-03b §4.1 は「入力: 開発者手交の手入力 CSV（`moves-input-tool` 系出力。列構成は §3.3-3 で実物確認。旧 22 列前提を決め打ちしない）」としており、**列構成の実物確認は本調査では行えていない**。なお `combomgr-importer` の出力は 22 列（README「CSV(22 列)」）で、これは FR704 の 22 列 CSV と同列構成である（`M14-RESEARCH-01-report.md` §G）。両ツールの CSV が同一列構成かどうかは未確認。

**F-10. `move_code` 末尾の `_N` は code 衝突と段目派生の両方で使われる。**
段目派生の例: `dee_jay` に 30 行（`threebeat_combo_2`, `sa2_lowkey_sunrise_festival_2`〜`_7` 等）、`jamie` 13 行、`elena` 8 行、`luke` 6 行、`kimberly` 5 行。code 衝突由来の literal `_2` は `guile` の `rolling_sobat_2` の **1 行のみ**（`{char}.review.md` §3 と突合して確認）。

**F-12（軸 C 拡大調査で判明・重大）. `total` の算出式が 764 行で成立しない。**
DES-003 §3.3 は `total = startup + active − 1 + recovery` と定めるが、`recovery` 列には非整数の文字列がそのまま入る（`着地後3` 366 行 / `全体 45` 271 行 / `N+着地後N` 97 行 / `※N` 24 行 他、全 30 キャラで計 764 行）。一方 `startup` / `active` / `on_hit` / `on_block` / `damage` の非整数は **0 件**で、これらは空欄化のうえ `notes` へ `【ツール付記】…原文: …` として退避される（`持続原文` 94 件 / `発生原文` 12 件 等）。**`recovery` だけがこの正規化から外れている**。M14-03b §4.1 の「`total` 算出・`recovery` 設定」に直撃する。

**F-13（同上）. 公式英語名そのものに誤りが 2 件ある。**
`juri` の `[チェーンコンボ]ジャンプ強P（空震脚）` に英語名 `[Chain combo]Neutral Jumping Heavy Kick` が付いており（Punch であるべき）、同キャラの `[チェーンコンボ]垂直ジャンプ強K（横圧殺）` と英語名が完全一致する。これが `juri` の code 衝突の原因である。`luke` の `OD ノーチェイサー` は英語名が `OD Chaser`（`No` 欠落）で、無印 `no_chaser` と base 名が揃わない（`chaser_od`）。`move_code` は英語名からのみ生成される（`code.go:129`）ため、英語名の誤りは code の誤りに直結する。

**F-14（同上）. `manon` の `move_code` はアクセント文字の欠落で壊れている。**
`machineTokens`（`code.go:143-158`）が非 ASCII を語境界として扱うため、`Manège Doré` → `man_ge_dor`、`À Terre` → **`terre`**（先頭単語が丸ごと消失）、`SA2 Étoile` → **`sa2_toile`** となる。該当は `manon` の 21 行のみ（他に非 ASCII を含む英語名は `ryu` の全角括弧 6 行のみで、こちらは実害なし）。

**F-15（同上）. `command` から `move_code` を一意に解決できない組が 442 グループある。**
全 30 キャラで発生（最多 `mai` 31 / `blanka` 23 / `juri` 22、最少 `terry` / `manon` / `jp` 各 8）。例: `ryu` の `d dl l d dl l plus p` に 6 move（`sa2_shin_hashogeki_lv1/2/3` と `denjin_charge_` 付き 3 件）が対応する。handover §3-(f) の command 索引は **1:N を返す前提**でなければ成立しない。加えて `command` 空欄が 11 行、未知トークン `raw{-}` が 3 行、`command` 内に日本語条件が残留する行が 1 行（`guile/sonic_cross1_od`）ある。

**F-11（補足・ロスター）.** `dist/*.csv` は 30 本。指示書 §3 の「クラシック操作の全 30（/31）キャラ」のうち **31 番目に相当する CSV・HTML は存在しない**。`combomgr-importer/testdata/modern/` にモダン HTML が存在するが、モダンは対象外のため未調査。

---

## 不明・判断できない事項

- **軸 C のうち「手入力ツール側でどう扱ったか」**: `moves-input-tool` の出力が本環境に無いため未確認。§C の類型は公式データと `combomgr-importer` の変換結果に基づく。
- **軸 A-6**: 開発者指示により調査対象外（§A-補足 4）。`mai`/`lily`/`juri`/`kimberly` の状態の値域・増減方向は公式データから読み取れず、本レポートでは判断していない。
- **手入力 CSV の列構成**: 実物不在のため未確認（F-9）。
- **案 2 における `ingrid` 不在時の (e) int ①②③ 実データ E2E の成否**: `ingrid` の `custom_states` は定義済みだが moves seed が無い状態で E2E が成立するかは、M14-03b の実コード確認事項であり本調査では判断していない。

---

*以上、M14-RESEARCH-02 調査報告。read-only。第一波の最終決定は開発者。*
