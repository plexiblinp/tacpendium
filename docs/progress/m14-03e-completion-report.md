# M14-03e 完了報告（第三波 seed = m_bison / rashid / jamie / luke / marisa / jp）

| 項目 | 内容 |
|---|---|
| 指示書 | `docs/instructions/M14-03e-third-wave-code-quality.md` v1.2.0 |
| チェックリスト | `docs/instructions/reviews/M14-03e-review-checklist.md` v1.2.0 |
| 実施日 | 2026-08-01 |
| 作業ツリー | `wt-m14-03e`（git worktree・コミットは開発者が実施） |
| 対象 | m_bison / rashid / jamie / luke / marisa / jp（6 / 6、縮小なし） |
| 消費マイグレ連番 | **000053〜000059**（ユーザー指定により 000053 から開始） |
| スキーマ変更 | なし（CHANGE 起票なし） |
| 品質判定 | **過長 code は許容。Luke の公式英語名誤りは seed に実害なし** |

## 1. 着手前確認（指示書 §3.3 の 13 項目）

ユーザーから「過去に実績があり、ブロッカーがなければプランを通さず実行してよい」と明示されたため、Plan の表示だけを省略した。以下の 13 項目は実装前にすべて実査し、ブロッカーなしと判定した。

| # | 確認結果 |
|---|---|
| 1 | 既存 HEAD は 000048。並行作業との衝突回避についてユーザーから **000053 開始**の指定を受領。`golang-migrate` が 000048→000053 の欠番を許容することも clean DB で確認した。 |
| 2 | M14-03d の判定は【解あり】。input-tool 修正待ちなし。 |
| 3 | 6 CSV・計 571 行を実測。詳細は §2。 |
| 4 | キャラ内 `move_code` 重複 0、キャラ内 `name_ja` 重複 0。6 キャラ同時の seedgen validate は通過見込みどおり。 |
| 5 | CSV に移動 9 種はなく drop 0。各 CSV の `drive_parry` は通常どおり通過した。 |
| 6 | `is_aerial=false`・単方向＋ボタン・空中専用という要是正候補は 0 件。開発者確認済みの false 値は維持し、本体規則は追加していない。 |
| 7 | `t.TempDir` の新規 SQLite DB に 000001 から適用。dev DB は参照・変更せず、退避を要しない隔離構築とした。 |
| 8 | `dbtest.Setup` 波及を確認し、旧固定値 3 箇所を新しい seed 前提へ追従した。全テスト結果は §7。 |
| 9 | 6 CSV がすべて揃っており縮小不要。 |
| 10 | v48 では 6 キャラの `characters` 行は 0。000053 を作成。 |
| 11 | v48 では 6 キャラの移動 system move は 0。000054 を作成し、6×9=54 行と alias 54 行を固定テストした。 |
| 12 | `INSERT … FROM characters` のサイレント no-op を防ぐため、キャラ別・全体の moves/alias/commands 件数を固定した migration test を先に設けた。 |
| 13 | `PRAGMA table_info(moves)` と migration test で `chain_cancel_total` 列が無いことを確認。条件付き投入は見送り、対象 16 行を §6 に申し送った。 |

## 2. `move_code` 品質の実測

全 571 行で正準形 `^[a-z0-9_]+$` 違反 0、`move_code` 重複 0、`name_ja` 重複 0、CA/SA 接頭語欠落 0 だった。

| キャラ | CSV 行 | 正準形違反 | 40 字超 | 最長 code（字数） | 英語名由来の衝突候補 | code / alias 重複 | CA/SA 欠落 |
|---|---:|---:|---:|---|---:|---:|---:|
| m_bison | 79 | 0 | 0 | `mine_set_medium_psycho_crusher_attack`（37） | 0 | 0 / 0 | 0 |
| rashid | 99 | 0 | 0 | `whirlwind_shot_max_holding_medium`（33） | 0 | 0 / 0 | 0 |
| jamie | 127 | 0 | **7** | `drink_level_4_ransui_haze_3_drink_while_retreating`（50）／`[酔いレベル4]乱酔旋（3段目/後退飲酒）` | 0 | 0 / 0 | 0 |
| luke | 83 | 0 | 0 | `flash_knuckle_holding_medium`（28） | **0**（`no_chaser_od` あり、誤った `chaser_od` なし） | 0 / 0 | 0 |
| marisa（対照群） | 108 | 0 | 0 | `sa1_javelin_of_marisa_counterattack`（35）／`SA1 マリーザジャベリン（カウンター）` | 0 | 0 / 0 | 0 |
| jp（対照群） | 75 | 0 | 0 | `departure_window_double_warp_od`（31）／`ODヴィーハトカ（設置/ダブルワープ）` | 0 | 0 / 0 | 0 |

Jamie の 40 字超 7 件は次のとおりで、CSV の値を短縮・再採番していない。

- `drink_level_4_freeflow_strikes_1hit_light`（41）
- `drink_level_4_freeflow_strikes_1hit_medium`（42）
- `drink_level_4_freeflow_strikes_1hit_heavy`（41）
- `drink_level_4_freeflow_strikes_2hits_light`（42）
- `drink_level_4_freeflow_strikes_2hits_medium`（43）
- `drink_level_4_freeflow_strikes_2hits_heavy`（42）
- `drink_level_4_ransui_haze_3_drink_while_retreating`（50）

### 2.1 類型あり 4 体と対照群の切り分け

- importer で過長が予測された m_bison / rashid は手入力 CSV では 40 字以内だった。jamie のみ 7 件が残ったが正準形・一意性は満たす。
- Luke は importer の公式英語名誤りを手入力 CSV に持ち込んでいない。`no_chaser_od` が一意に存在し、alias 欠落・base 衝突・dup は 0。第一波 Juri と同じく seed の実害はない。
- 類型なしの marisa / jp では過長・英語名衝突とも 0。問題が全キャラ共通という結果ではない。

## 3. 過長 code の実害判定

判定は **実害なし＝許容**。

- DB: `moves.code` は `TEXT NOT NULL` と `(character_id, code)` の一意制約だけで、長さ制約はない。50 字を clean migration DB へ欠損なく保存できた。
- API / CSV: Go・JSON の型は `string`、CSV の `move_code` も文字列として読み書きされ、長さ切り詰めや上限検証はない。migration/API から 50 字を同値で取得できた。
- 画面18: code セルは `whitespace-nowrap` だが Table 親が横 `overflow-auto`。Playwright で 50 字の Jamie 行が専用スクロール領域内に収まり、alias 表示と recovery の一時編集ができることを確認した。
- レシピ表示: 利用者向け表示は alias を使い、狭い summary は `truncate` と `title` で扱う。生 code がページ幅を押し広げる経路は確認されなかった。

量産波では seedgen の正準形・dup 検査は安価な恒常ガードとして継続する。一方、40 字超を理由に止めたり短縮したりする必要はない。公式名既知問題があるキャラだけ、手入力 CSV へ誤名が残っていないかを確認すればよい。

## 4. 投入内容と固定件数

| migration | 内容 |
|---|---|
| 000053 | 6 キャラの `characters` 行 |
| 000054 | 移動 system move 9 種＋`official_ja_move` alias |
| 000055 | CSV 571 moves＋alias（seedgen 生成） |
| 000056 | `is_derived` backfill（seedgen 生成） |
| 000057 | `move_commands` 319 行（seedgen 生成） |
| 000058 | `is_projectile` 31 行の backfill |
| 000059 | 移動 5 code の `total` 30 行を backfill（開発者提供の実測値） |

| キャラ | moves（CSV+移動9） | alias | derived | rush | commands | projectile |
|---|---:|---:|---:|---:|---:|---:|
| m_bison | 88 | 88 | 34 | 15 | 45 | 1 |
| rashid | 108 | 108 | 39 | 16 | 60 | 12 |
| jamie | 136 | 136 | 78 | 19 | 49 | 0 |
| luke | 92 | 92 | 33 | 16 | 50 | 6 |
| marisa | 117 | 117 | 42 | 19 | 66 | 0 |
| jp | 84 | 84 | 24 | 16 | 49 | 12 |
| **計** | **625** | **625** | **250** | **101** | **319** | **31** |

seedgen の索引非搭載 252 行は、派生 250 行と意図的に command が空の `jp/triglav_od`・`jp/departure_od` の 2 行に全数説明できる。rush 101 行はすべて `is_derived=true` かつ `original_move_id` 解決済み。移動 9 種は各キャラ 1 行、`drive_parry` も各キャラ 1 行である。

生成対象 3 本に 1 対 1 の golden test を追加した。既定 `go run ./cmd/seedgen -check` も通過し、既存 000026 は byte-identical、変換規則と `internal/moveindex` は無改変である。

## 5. 非破壊性・down/re-up

- v48 の 13 キャラについて `(moves, official_ja_move alias)` を採取し、v59 で全件不変を確認した。
- down で v48 へ戻すと第三波 6 キャラ由来の characters/moves/aliases/commands は 0、FK check も正常。再 up で moves 625 行へ復帰した。
- M14-03d のテストを自身の終端 v48 に固定し、後続波を HEAD に含めない独立 fixture へ是正した。
- M14-03e のテストも自身の終端 v59 に固定した。000059 単体の down で 30 行が NULL へ戻り、再 up で同値へ復帰することを確認した。
- runtime command index の期待値を 11→17 キャラへ、punishfinder の seed canary を第三波の通常ジャンプ強攻撃 14 件・unique 空中技 9 件の増加へ追従した。
- スキーマ、既存マイグレ、seedgen 変換規則、他キャラの seed は変更していない。

## 6. 実測値と後続申し送り

### 6.1 移動 total

開発者から 2026-08-01 に実測値を受領し、000059 で対象 5 code × 6 キャラ＝30 行を backfill した。ジャンプ 3 code はキャラ内で同値、対象外の `forward` / `back` / `micro_forward` / `micro_back` は NULL を維持する。

| キャラ | `dash_forward` | `dash_back` | `jump_neutral` / `jump_forward` / `jump_back` |
|---|---:|---:|---:|
| m_bison | 19 | 23 | 43 |
| rashid | 18 | 25 | 43 |
| jamie | 19 | 23 | 43 |
| luke | 19 | 23 | 43 |
| marisa | 22 | 25 | 43 |
| jp | 22 | 23 | 43 |

### 6.2 `chain_cancel_total`

本 worktree に列が無いため UPDATE は作っていない。M19-04 DDL 着地後に、実測資料を一次源として次の 16 行を backfill する。

- m_bison: `standing_light_punch` / `crouching_light_punch` / `crouching_light_kick`
- rashid: `standing_light_punch` / `crouching_light_punch` / `crouching_light_kick`
- jamie: `standing_light_kick` / `crouching_light_punch` / `crouching_light_kick`
- luke: `crouching_light_punch` / `crouching_light_kick`
- marisa: `crouching_light_punch` / `crouching_light_kick`
- jp: `standing_light_punch` / `crouching_light_punch` / `crouching_light_kick`

### 6.3 配布 blocker

seed 済みは **17 / 30**、残り **13 キャラ**。`c_viper` / `dhalsim` を含む最終波が完了するまで配布 blocker は解除しない。`docs/handover/followup-backlog.md` §C-1 の網羅表を本結果へ更新した。

## 7. 検証結果

| 検証 | 結果 |
|---|---|
| seedgen 既定 `-check` / golden | PASS（000026 byte-identical、第三波 3 本も再生成一致） |
| M14-03d / M14-03e migration・件数・down/re-up | PASS |
| `make test` | PASS（Go 全 package＋Vitest **119 files / 910 tests**） |
| `make build` | PASS（既知の Vite chunk-size warning のみ） |
| 第三波 targeted Playwright | PASS（1 test） |
| 全 Playwright | **第三波を含む全 70 tests を実行**。第三波・旧 Jamie fixture は green。既知の並列 SQLite flake 2 件は単独直列で **2 / 2 PASS**し、今回の回帰でないと切り分けた。 |

Playwright 初回全体実行では、今回 spec は green。並列 SQLite E2E の既知 flake が 9 件出たが、すべて retry で green になった。旧 Jamie 前提の 1 件だけは retry でも再現し、原因が第三波の意図した再投入であることを確認して fixture を更新した。更新後の対象 3 tests は 3 / 3 PASS。全体再実行では既知の競合が別の 2 tests で retry 後も残ったが、その 2 件を `--workers=1` で単独実行して 2 / 2 PASS としたため、本波の回帰ではないと判定した（followup `e2e-flaky-isolation` と同じ症状）。
