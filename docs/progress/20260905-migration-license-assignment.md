# マイグレーション ライセンス割当 レビュー表（2026-09-05）

| 項目 | 内容 |
|------|------|
| 文書ID | MIGRATION-LICENSE-REVIEW-20260905 |
| 用途 | **開発者の人力レビュー用**。`migrations/` の 1 本ずつに、中身と割り当てるライセンスを並べる |
| 作成者 | 設計卓（Claude Code・フェーズ4 期） |
| 出所 | `M26-01` 調査報告 §2.2（**80 本の実査。`ls migrations/*.up.sql` と `diff` で突合・欠落 0**）／ ボード `D-672` / `D-703` / `D-705` |
| 状態 | **★★【2026-09-06 更新＝`D-746`】役目を終えた。** **★(1) `REUSE.toml` は `M26-02` が書いた**（正本はそちらへ移った）**／ (2) §6 手順 1**（開発者の人力レビュー）**は完了している**（2026-09-06 開発者確認）**。⇒ §6 の手順 1〜5 はすべて閉じた。** **★★ただし本表には射程の限界が 2 つある。⇒ 本表だけを見て割当を判断しないこと。** **★★(a) §1 の 28 行は削除済みの `000012` を含む。⇒ 現存する凍結層 A は 27 本である。** **★★(b) 本表が覆うのは `000001`〜`000080` だけである。⇒ `000081`〜`000103` の 23 本は `M26-02` が実査して開発者承認を得た**〔層 A ＝ `000081` / `000096` / `000103` ／ 層 B ＝ 残り 20 本〕**。** **⇒ 割当の正本は `REUSE.toml`。層の定義は `DES-001` §5**（`CHANGE-157`）**。本表は人力レビューの記録として残す。** 以下は前回更新時の記述： **★未確定。宣言ファイル（`REUSE.toml` 等）はまだ書いていない**——`M14-03f` の受領後に着手する（開発者指示 2026-09-05） |
| 関連 | `docs/human-notes/future-notes/combmgr-license-strategy-outline.md`（三層の骨子）／ `M26-overview` ／ `checklist` `A1` |

---

## 0. レビューの観点（★先に読む）

**★開発者の逐語＝「一度 AGPL 化してから CC BY SA に戻すのは難しい認識なので、しっかり人力でもレビューします」。**

**⇒ その認識は正しい。したがって本表は「層 A と判定した 28 本」を先に置く。**

| | 内容 |
|---|---|
| **見るべきは §1（層 A・28 本）である** | **誤って A にしたものが、戻しにくい側の誤りである。** ⇒ **「これは SF6 の事実では？」と思うものが 1 本でもあれば指摘してほしい** |
| §2（層 B・52 本）の誤りは相対的に軽い | 誤って B にしたものは「本来 AGPL でよかったものに ShareAlike が付いた」だけであり、**単独著作者であるため後から締め直せる** |
| **判定規則**（`D-672`・製造が定義し設計卓が採用） | **層 A** ＝ スキーマ DDL ／ アプリ構造の変更 ／ **アプリの初期データ**〔表記プリセット・タグ・既定ユーザー・ゲームマスタ〕／ 合成テストデータ<br>**層 B** ＝ **SF6 の事実そのもの**〔ロスター・技・フレームデータ・コマンド・派生関係・キャラ固有ゲージ系・公式表記の技名〕 |
| **★「名前に `seed` が付く＝層 B」ではない** | **この規則で分けていたら 80 本中 25 本を取り違えていた**〔`seed` 名 35 本のうち 4 本が層 A、`seed` 名を持たない 45 本のうち 21 本が層 B〕。**⇒ 判定は 1 本ずつ中身を開いて行われている** |
| ライセンス | 層 A ＝ **`AGPL-3.0-or-later`** ／ 層 B ＝ **`CC-BY-SA-4.0`** |

---

## 1. 層 A と判定した 28 本（★重点レビュー対象＝AGPL になる）

**★このうち 1 本でも「SF6 の事実だ」と思うものがあれば指摘してください。戻しにくいのはこちら側です。**

| 連番 | ファイル | 何のマイグレか | ライセンス |
|---|---|---|---|
| `000001` | `000001_init_schema.up.sql` | スキーマ DDL のみ（全 13 テーブル + インデックス） | **AGPL-3.0-or-later** |
| `000002` | `000002_seed_games.up.sql` | games マスタ 1 行。SF6 のタイトル名のみでゲーム内事実を含まない | **AGPL-3.0-or-later** |
| `000005` | `000005_seed_presets.up.sql` | 表記プリセット定義（アプリの記法体系。SF6 由来ではない） | **AGPL-3.0-or-later** |
| `000007` | `000007_seed_initial_tags_user1.up.sql` | 既定ユーザー + 予約カテゴリのタグ 3 件 | **AGPL-3.0-or-later** |
| `000008` | `000008_drop_gauge_consumed_total.up.sql` | 列削除 DDL | **AGPL-3.0-or-later** |
| `000012` | `000012_seed_combos_durability.up.sql` | 耐久テスト用の合成コンボ。ヘッダに「SF6 的正確性は不問」と明記 | **★★削除（欠番にする）**——実測で `combos` 0 件（§4.5）。`M26-02` で実施 |
| `000013` | `000013_add_moves_frame_columns.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |
| `000016` | `000016_change_drive_damage_to_real.up.sql` | 型変更 DDL | **AGPL-3.0-or-later** |
| `000018` | `000018_cleanup_moves_unobservable_columns.up.sql` | moves スキーマ整理 DDL | **AGPL-3.0-or-later** |
| `000019` | `000019_change_drive_available_at_start_to_real.up.sql` | 型変更 DDL | **AGPL-3.0-or-later** |
| `000020` | `000020_add_gauge_consumed_columns.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |
| `000021` | `000021_normalize_combo_oki_options.up.sql` | アプリ表の正規化 DDL + 移送 | **AGPL-3.0-or-later** |
| `000022` | `000022_unify_dash_to_system_move.up.sql` | combo_steps / setup_steps（利用者データ構造）の表現統一 | **AGPL-3.0-or-later** |
| `000028` | `000028_sweep_modifier_dash.up.sql` | combo_steps / setup_steps の残行掃き取り | **AGPL-3.0-or-later** |
| `000031` | `000031_add_combo_media.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |
| `000032` | `000032_add_moves_is_derived.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |
| `000033` | `000033_create_move_commands.up.sql` | 表新設 DDL | **AGPL-3.0-or-later** |
| `000036` | `000036_create_combo_punishes.up.sql` | 表新設 DDL | **AGPL-3.0-or-later** |
| `000037` | `000037_create_combo_punish_prunings_and_curations.up.sql` | 表新設 DDL | **AGPL-3.0-or-later** |
| `000038` | `000038_add_combos_materialized_from.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |
| `000040` | `000040_create_combo_punish_starters.up.sql` | 表新設 DDL | **AGPL-3.0-or-later** |
| `000042` | `000042_create_combo_setup_results.up.sql` | 表新設 DDL | **AGPL-3.0-or-later** |
| `000049` | `000049_add_moves_frame_cost_columns.up.sql` | 列追加 + 表新設 DDL | **AGPL-3.0-or-later** |
| `000069` | `000069_m20_initial_presets_three.up.sql` | 組み込みプリセットの整理（記法体系＝アプリ側） | **AGPL-3.0-or-later** |
| `000070` | `000070_m20_preset_aliases_add_alias_text_en.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |
| `000074` | `000074_m20_preset_aliases_add_character_id.up.sql` | 列追加 + 構造的 backfill DDL | **AGPL-3.0-or-later** |
| `000075` | `000075_m20_preset_aliases_unique.up.sql` | 一意制約 DDL | **AGPL-3.0-or-later** |
| `000078` | `000078_add_combos_superseded_by.up.sql` | 列追加 DDL | **AGPL-3.0-or-later** |

> **★特に見てほしい 4 本**——`000002_seed_games`（**SF6 のタイトル名のみ**）／ `000005_seed_presets`（**記法体系＝アプリの設計物**）／ `000007_seed_initial_tags_user1`（**初回起動ウィザードで生成すべきもの、とヘッダが明記**）／ `000012_seed_combos_durability`（**ヘッダが「SF6 的正確性は不問」と明記**）。**この 4 本は `seed` 名を持つが層 A と判定されている。**

---

## 2. 層 B と判定した 52 本（CC BY-SA になる）

| 連番 | ファイル | 何のマイグレか | ライセンス |
|---|---|---|---|
| `000003` | `000003_seed_characters.up.sql` | ryu の characters 行（ロスター事実） | **CC-BY-SA-4.0** |
| `000004` | `000004_seed_moves_ryu.up.sql` | ryu の技マスタ | **CC-BY-SA-4.0** |
| `000006` | `000006_seed_aliases_official_ja_move.up.sql` | 公式日本語技名（立ち弱P 等）を move_code へ対応づけ | **CC-BY-SA-4.0** |
| `000009` | `000009_seed_characters_aki_jamie_guile.up.sql` | characters 行（ロスター事実） | **CC-BY-SA-4.0** |
| `000010` | `000010_seed_moves_aki_jamie_guile.up.sql` | 技マスタ | **CC-BY-SA-4.0** |
| `000011` | `000011_seed_aliases_official_ja_move_aki_jamie_guile.up.sql` | 公式日本語技名 | **CC-BY-SA-4.0** |
| `000014` | `000014_seed_characters_classic5.up.sql` | characters 行（ロスター事実） | **CC-BY-SA-4.0** |
| `000015` | `000015_seed_custom_states_classic3.up.sql` | キャラ固有ゲージ系（custom_states）の定義 | **CC-BY-SA-4.0** |
| `000017` | `000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` | seed 済みゲームデータの整理と move_code 統一（★FK=OFF のため CASCADE に頼れず、層 A 側の 4 表を明示 DELETE している。混在） **★層が割れる** | **CC-BY-SA-4.0** |
| `000023` | `000023_add_show_delta_ingrid_sun_crest.up.sql` | custom_states の表示挙動（キャラ固有） | **CC-BY-SA-4.0** |
| `000024` | `000024_seed_characters_first_wave.up.sql` | characters 行（ロスター事実） | **CC-BY-SA-4.0** |
| `000025` | `000025_seed_movement_system_moves_all.up.sql` | 移動 system move 9 種 + 別名 | **CC-BY-SA-4.0** |
| `000026` | `000026_seed_moves_first_wave.up.sql` | 技マスタ + 別名 + recovery | **CC-BY-SA-4.0** |
| `000027` | `000027_seed_custom_states_first_wave.up.sql` | キャラ固有ゲージ系の定義 | **CC-BY-SA-4.0** |
| `000029` | `000029_clear_ryu_legacy_seed.up.sql` | seed 済みゲームデータの前段クリア **★層が割れる** | **CC-BY-SA-4.0** |
| `000030` | `000030_seed_moves_ryu.up.sql` | 手入力 CSV 由来の技マスタ | **CC-BY-SA-4.0** |
| `000034` | `000034_backfill_moves_is_derived.up.sql` | 派生技フラグ（SF6 の事実） | **CC-BY-SA-4.0** |
| `000035` | `000035_seed_move_commands.up.sql` | command 索引（SF6 のコマンド） | **CC-BY-SA-4.0** |
| `000039` | `000039_add_moves_is_projectile.up.sql` | DDL 1 行 + 飛び道具判別 8 キャラ分（本文の大半が SF6 の事実。★混在） **★層が割れる** | **CC-BY-SA-4.0** |
| `000041` | `000041_backfill_movement_total.up.sql` | 移動技の全体フレーム | **CC-BY-SA-4.0** |
| `000043` | `000043_seed_characters_manon.up.sql` | characters 行（ロスター事実） | **CC-BY-SA-4.0** |
| `000044` | `000044_seed_movement_system_moves_manon.up.sql` | 移動 system move + 別名 | **CC-BY-SA-4.0** |
| `000045` | `000045_seed_moves_manon.up.sql` | 技マスタ | **CC-BY-SA-4.0** |
| `000046` | `000046_backfill_moves_is_derived_manon.up.sql` | 派生技フラグ | **CC-BY-SA-4.0** |
| `000047` | `000047_seed_move_commands_manon.up.sql` | command 索引 | **CC-BY-SA-4.0** |
| `000048` | `000048_backfill_movement_total_manon.up.sql` | 移動技の全体フレーム | **CC-BY-SA-4.0** |
| `000050` | `000050_backfill_moves_frame_cost.up.sql` | フレーム費用（機械決定分） | **CC-BY-SA-4.0** |
| `000051` | `000051_seed_moves_zangief_rapid.up.sql` | 技マスタ | **CC-BY-SA-4.0** |
| `000052` | `000052_backfill_moves_chain_cancel_total.up.sql` | 連打キャンセル実消費フレーム | **CC-BY-SA-4.0** |
| `000053` | `000053_seed_characters_third_wave.up.sql` | characters 行（ロスター事実） | **CC-BY-SA-4.0** |
| `000054` | `000054_seed_movement_system_moves_third_wave.up.sql` | 移動 system move + 別名 | **CC-BY-SA-4.0** |
| `000055` | `000055_seed_moves_third_wave.up.sql` | 技マスタ | **CC-BY-SA-4.0** |
| `000056` | `000056_backfill_moves_is_derived_third_wave.up.sql` | 派生技フラグ | **CC-BY-SA-4.0** |
| `000057` | `000057_seed_move_commands_third_wave.up.sql` | command 索引 | **CC-BY-SA-4.0** |
| `000058` | `000058_backfill_moves_is_projectile_third_wave.up.sql` | 飛び道具判別 | **CC-BY-SA-4.0** |
| `000059` | `000059_backfill_movement_total_third_wave.up.sql` | 移動技の全体フレーム | **CC-BY-SA-4.0** |
| `000060` | `000060_backfill_moves_chain_cancel_total_third_wave.up.sql` | 連打キャンセル実消費フレーム | **CC-BY-SA-4.0** |
| `000061` | `000061_seed_move_derivations_zangief_rapid.up.sql` | 技の親子関係 | **CC-BY-SA-4.0** |
| `000062` | `000062_backfill_moves_frame_cost_third_wave.up.sql` | フレーム費用 | **CC-BY-SA-4.0** |
| `000063` | `000063_correct_moves_data_m1904c.up.sql` | 技データの是正 10 行 | **CC-BY-SA-4.0** |
| `000064` | `000064_backfill_frame_cost_manual.up.sql` | 人手判断のフレーム値 | **CC-BY-SA-4.0** |
| `000065` | `000065_correct_frame_values_phase2.up.sql` | フレーム値の是正 | **CC-BY-SA-4.0** |
| `000066` | `000066_correct_jamie_freeflow_codes.up.sql` | move_code の是正 | **CC-BY-SA-4.0** |
| `000067` | `000067_backfill_frame_cost_manual_addendum.up.sql` | 人手判断のフレーム値（追補） | **CC-BY-SA-4.0** |
| `000068` | `000068_correct_fastest_unreachable_addendum.up.sql` | fastest_unreachable の是正 | **CC-BY-SA-4.0** |
| `000071` | `000071_m20_seed_move_commands_od4.up.sql` | command 索引（OD 技 4 件） | **CC-BY-SA-4.0** |
| `000072` | `000072_m20_seed_aliases_numeric.up.sql` | seedgen が character_data/*.csv から生成した別名（生成物） | **CC-BY-SA-4.0** |
| `000073` | `000073_m20_seed_aliases_srk.up.sql` | seedgen が character_data/*.csv から生成した別名（生成物） | **CC-BY-SA-4.0** |
| `000076` | `000076_m20_seed_aliases_p34_numeric.up.sql` | 別名投入（P-34 の 13 件） | **CC-BY-SA-4.0** |
| `000077` | `000077_m20_seed_aliases_p34_srk.up.sql` | 別名投入（P-34 の 13 件） | **CC-BY-SA-4.0** |
| `000079` | `000079_fix_character_display_names.up.sql` | キャラ表示名をインゲーム表示へ是正 | **CC-BY-SA-4.0** |
| `000080` | `000080_fix_ground_dash_label.up.sql` | 地上ダッシュの日本語表示語の是正 | **CC-BY-SA-4.0** |

---

## 3. ★層が 1 ファイル内で割れる 3 本（両方の表に「★」で出ている）

**SPDX ヘッダは 1 ファイルに 1 つしか書けないため、どちらかに寄せる必要がある。設計卓の推奨は 3 本とも `CC-BY-SA-4.0`。**

| 連番 | 割れ方 | 推奨 |
|---|---|---|
| `000039` | **全 53 行のうち `ALTER TABLE` の 1 行が層 A**、残り約 40 行が 8 キャラ分の「どの技が飛び道具か」（層 B） | **B**（本文の大半が SF6 の事実） |
| `000017` | 主目的は seed 済みゲームデータの整理と `move_code` 統一（層 B）だが、**層 A 側の 4 表**（`combos` / `combo_steps` / `combo_tags` / `combo_setups`）**を明示 DELETE する** | **B**（主目的が層 B の整理） |
| `000029` | 主目的は ryu の seed 済みゲームデータの前段クリア（層 B）だが、**層 A 側の 7 表を明示 DELETE する** | **B**（同上） |

> **★DELETE が書いてあるのは FK 連鎖の結果ではない。因果が逆である。** 両ファイルのヘッダが逐語で述べているとおり、**マイグレーション接続は `foreign_keys=OFF`**（`migrate.go` が pragma 無しで接続し、アプリ接続のみ `db.go` で FK=ON）**であり、連鎖してくれないから明示的に書いてある。**

---

## 4. `M26-01` の調査範囲外（★設計卓の暫定判定。実物未確認）

**★`M26-01` が実査したのは `000001`〜`000080` の 80 本である。以降は設計卓が CHANGE 通知書から推定しており、実物を開いていない**（設計卓は武装中で `migrations/` を読めない）。**⇒ ここは製造か開発者の実査が要る。**

| 連番 | 何のマイグレか | 出所 | 暫定の層 | 根拠 |
|---|---|---|---|---|
| `000081` | **`opponent_size` の `medium` → `standard` 改名**（DML） | `CHANGE-151`・`M27-01` | **A**（★要確認） | **コード値の命名はアプリ側の設計物であり、SF6 の事実ではない。★ただし更新対象は利用者のコンボ行である** |
| `000082`〜`000091` | **`M14-03f`（seed 第四波）が消費**。10 本 | 開発者の走行中報告（`D-689`） | **★未判定** | **★中身を見ていない。キャラ seed なら層 B の見込みだが、`custom_states` の定義投入など層 A のものが混ざりうる** |
| `000092`〜（継続中） | **`M14-03f` が継続消費中**（本数未確定・上限を切っていない） | `D-689` | **★未判定** | 同上 |
| `000096` | **`combos.oki_verified` の列追加 ＋ backfill** | `CHANGE-153`・`M27-02b` | **A** | **列追加 DDL ＋ 自表の backfill。SF6 の事実を含まない** |

> **★`000092`〜`000095` は空いている**（`M27-02b` が `000096` を取ったため）。**`M14-03f` がこの帯を使う。**

---

## 4.5 ★★`000012_seed_combos_durability` の扱い（開発者提起・2026-09-05）

**★開発者の懸念＝「これは AI による自動生成か、公式 HTML 由来のデータの可能性がある。可能であればこれだけ欠番にして残したくない」。**

> **★★【2026-09-05 実測＝`D-709`】開発者がクリーン DB で確認した——`SELECT count(*) FROM combos;` → `0`。****⇒ 全マイグレを適用し終えた DB に耐久テスト用の 36 件は残っていない。★削除は新規 DB にとって完全な no-op である。****★ただし「データが残らない」と「消してもテストが通る」は別である。⇒ 削除の直前に (6) の実査 4 を回すこと。**

### (1) 欠番にしてよいか — **golang-migrate 上は問題ない**

| # | 根拠 |
|---|---|
| 1 | **`schema_migrations` は「現在の版数」1 行しか持たない**（適用済みの一覧を持たない）。⇒ **「適用済みなのにファイルが無い」という検出をしない** |
| 2 | **`Up` は「存在するファイルを昇順に、現在版数より上だけ」適用する。⇒ 連番の穴は素通りする** |
| 3 | **★前に述べた「番号の穴が危険」とは別の話である。** 危険なのは**後から低い番号を足す**場合〔既に高い版数を適用した DB がそれを拾わない〕であり、**既にあるものを消すのはこれに当たらない** |

> **★ライブラリ仕様の一次確認は `M26-02` の手番**（設計卓は武装中で実物を読めない）。

### (2) ★履歴に残ることは問題にならない

**骨子 §10.3＝公開方式は「リリース毎スナップショット公開（継続ミラーではない）」である。**
**⇒ 公開リポジトリへは選別済みの状態が 1 コミットとして落ちる。私有リポジトリの履歴は公開されない。**
**⇒ 履歴改変（`filter-repo` 等）は要らない。作業ツリーから消せば足りる。**

### (3) ★★削除の前に確かめること（3 点・製造か開発者の実査）

| # | 確かめること | なぜ | 一番安い確かめ方 |
|---|---|---|---|
| **1** | **その 36 行は、全マイグレ適用後の DB に残っているか** | **`000017` と `000029` が `DELETE FROM combos` を実行している**（`code-facts` §10-2）。**★もし durability の 36 件もそこで消えているなら、`000012` の削除は新規 DB にとって完全な no-op になる。⇒ この 1 点で話が終わる** | 使い捨て DB を作って `SELECT count(*) FROM combos;` |
| **2** | **テストが `000012` の 36 件に依存していないか** | 固定の `combo_id` を前提にしたテストがあると落ちる | **★`M12-RESEARCH-02` の `B-2` が同じ検査をすでに要求している**〔「テストコードが 000012 の耐久 seed に依存していないか全数 grep」〕 |
| **3** | **後続マイグレが `000012` の行を前提にしていないか** | `000012` は自表を `UPDATE` している（`code-facts` §10-2）。後続が特定 `combo_id` を触っていると、新規 DB で挙動が変わる | `migrations/` を `grep` |

> **★★先例がある**——**`M12-RESEARCH-02` は `000012` を「`M12-05` の主除去対象」と書いている。⇒ 当時すでに除去が検討されていた。**
> **`M12-05` で実際に何が行われたか（除去されたのか、見送られたのか）を先に確認するのが最短である。**

### (4) 案の比較

| 案 | 内容 | 評価 |
|---|---|---|
| **案1（推奨）** | **`.up.sql` / `.down.sql` を削除して欠番にする** | **★由来の怪しい内容がツリーから消える。★欠番は無害**（上記 (1)）**。★あわせて `followup` の `CO-007`〔`000012` の `down` が orphan を残す〕も同時に消える** |
| 案2 | **中身を no-op に差し替えて番号を残す** | **★推奨しない。** 由来の怪しい内容は消えるが、**「消したはずなのにファイルは残る」形**になる。**★しかも番号据え置きの書き換えは、そのファイルをどの DB も適用していないときしか効かない**〔`M27-02b` 教訓 3〕。`000012` は全 DB が適用済みであり、**既存 DB の行は消えない** |
| 案3 | **自分で書き直して番号も内容も残す** | **耐久テストが実際に 36 件を必要としている場合はこれ**。ただし案2 と同じ理由で**既存 DB には効かない** |

### (5) 手順（実査 1 が「残っていない」だった場合）

| # | 手順 | 誰が |
|---|---|---|
| 1 | `migrations/000012_seed_combos_durability.{up,down}.sql` を削除する | **★開発者**（「消す」変更は開発者の手番＝`D-196`） |
| 2 | **欠番の理由を 2 か所へ 1 行残す**——`SUPP-001` §2.7（**連番の欠番は事故ではない**）＋ 本表 | 設計卓（CHANGE が要る） |
| 3 | 既存 dev DB は**そのままでよい**（行が既に無いため）。残っていた場合のみ、新しいマイグレで `DELETE` する | 開発者 / 製造 |
| 4 | `followup` の `CO-007` を「解消（対象ファイルごと削除）」にする | 設計卓 |

> **★★欠番の理由を書き残すことが要点である。** 書かないと、次の担当が「連番が飛んでいる＝事故」と読んで復元しにかかる。

---

### (6) ★調査コマンド（2026-09-05 開発者要求）

**★上から順に。実査 4 が決定打である。**

```bash
# ── 実査 1: 全マイグレ適用後に durability の 36 件が残っているか ────────
# 使い捨て DB を作る（このブランチの全マイグレが新規適用される）。
# 起動ログが出たら Ctrl-C で止めてよい（DB は残る）。実 dev DB には触れない。
bash scripts/dev-throwaway-db.sh --fresh

DB=$(ls -t scratch-*.db | head -1); echo "$DB"

# sqlite3 があるなら
sqlite3 "$DB" "SELECT count(*) FROM combos;"              # ★0 ならこの話は終わり
sqlite3 "$DB" "SELECT id, name FROM combos ORDER BY id;"
sqlite3 "$DB" "SELECT version, dirty FROM schema_migrations;"   # 102 / 0 の想定

# sqlite3 が無いなら: 使い捨て DB のまま dev サーバを起動してコンボ一覧を開く
#   bash scripts/dev-throwaway-db.sh   → ブラウザで /combos

# ── 実査 2: テスト・E2E が 36 件に依存していないか ──────────────────
sed -n "1,30p" migrations/000012_seed_combos_durability.up.sql   # 何を入れているか

grep -rni "durability\|耐久" \
  --include="*.go" --include="*.ts" --include="*.tsx" --include="*.sql" \
  internal/ cmd/ web/src/ web/e2e/ migrations/ | grep -v "^migrations/000012"

# ── 実査 3: 後続マイグレが 36 件を前提にしていないか ────────────────
grep -n "DELETE FROM combos\|UPDATE combos\|INSERT INTO combos" migrations/*.up.sql

# ★000017 / 000029 の WHERE を読む（ここで既に消えている可能性がある）
sed -n "1,80p" migrations/000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql
sed -n "1,80p" migrations/000029_clear_ryu_legacy_seed.up.sql

# ── 実査 4（★決定打）: 捨てブランチで実際に消してテストを回す ──────────
git switch -c tmp/drop-000012
git rm migrations/000012_seed_combos_durability.up.sql \
       migrations/000012_seed_combos_durability.down.sql

bash scripts/dev-throwaway-db.sh --fresh   # ★欠番でも起動するはず
go test ./...
make e2e
```

> **★★実査 4 が本命である。** **golden や契約テストが 36 件を数えていれば、ここで落ちる。落ちなければ「消してよい」の証拠になる**——`M14-03f` は版数固定テスト（`TestRun_M1403f_*Stage_*`）や `TestCSVAndDBAgreeOnFrameCostColumns` を持つため、**机上の grep より実行のほうが確実である。**

> **★捨てブランチで試すこと。** 消す判断が付いてから本ブランチで消す（**「消す」は開発者の手番**＝`D-196`）。

## 5. 割当の運用（`D-705` で承認済み＝「命名規約 ＋ 機械検査」）

**★フォルダ分割は採らない。危険であるため**——`//go:embed migrations/*.sql` は直下の `.sql` しか埋め込まず、`iofs.New(fsys, "migrations")` も指定パス直下だけを読む（非再帰）。**⇒ サブフォルダへ置いたマイグレは、エラーを出さずに適用されない**（`SUPP-001` §2.7。**★ライブラリ仕様の一次確認は `M26-02` の手番**）。

| 段 | 内容 |
|---|---|
| **(1) 既存分は一度だけ列挙する** | **適用済みマイグレは書き換えないため、既存分は凍結されている。⇒ 本表を宣言へ写せば、その行は以後変わらない。★ここに継続的な漏れは発生しない** |
| **(2) 新規分は命名規約で決まるようにする** | 層 B のマイグレに接頭辞を付ける（例 `000097_data_seed_moves_xxx.up.sql`）。**⇒ 宣言はグロブ 1 行で済み、次の seed 波が何本足しても宣言を触らない** |
| **(3) 機械検査を 1 本足す** | `scripts/check-migration-license.sh`＝**宣言にも規約にも当てはまらないマイグレを検出する。⇒ 漏れが「静かに」起きなくなる** |

```
# 宣言の形（イメージ。実際の構文は M26-02 で一次確認する）
migrations/*_data_*.sql   → CC-BY-SA-4.0     # 新規の層 B（命名規約）
migrations/000003_*.sql   → CC-BY-SA-4.0     # 既存の層 B 52 本（凍結・一度だけ列挙）
...
migrations/*.sql          → AGPL-3.0-or-later # 既定
```

> **★`M14-03f` の分（`000082`〜）は「既存扱い」＝一度だけ列挙とし、命名規約は次の波から適用する。** 走行中のサブにリネームを求めると事故る。

---

## 6. ★このあとの手順

| # | 手順 | 誰が |
|---|---|---|
| 1 | **本表 §1（層 A・28 本）を人力レビューする** | **開発者** |
| 2 | `M14-03f` を受領し、`000082`〜 の実際の本数と中身を確定する | 開発者 → 設計卓 |
| 3 | §4 の未判定分を判定する（**★製造か開発者の実査。設計卓は実物を読めない**） | 製造 / 開発者 |
| 4 | 命名規約を決めて `SUPP-001` §2.7 の命名規則へ追記する（CHANGE が要る） | 設計卓 |
| 5 | 宣言ファイルと `scripts/check-migration-license.sh` を作る | 製造（`M26-02`） |

> **★4 と 5 の前に 1〜3 が閉じている必要がある。** **⇒ いま着手しない**（開発者指示 2026-09-05）。

---

*以上。本表は未確定であり、宣言ファイルはまだ存在しない。*
