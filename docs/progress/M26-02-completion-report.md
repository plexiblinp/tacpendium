# M26-02 完了報告: 公開スナップショット生成の基盤 ＋ ライセンスの配置

> **★★★【2026-09-21 errata＝`D-924`】本書の 1 箇所が*反転*している。⇒ 本文は歴史記録として書き換えない**（`D-274` (3)）**。**
>
> **★★★失効したのは `L81` である**〔逐語＝「`LICENSES/MIT.txt` … **★著作権行の `<year> <copyright holders>` を埋めた**」〕**。**
>
> **★★★`M40-01`**（2026-09-20・受理＝`D-923`）**でこの判断が反転し、テンプレートへ戻した。⇒ 根拠＝REUSE FAQ `#license-templates` の逐語 ＋ 実在の REUSE 準拠リポジトリ 5 本の実測 ＋ 開発者確定**（2026-09-20）**。**
>
> **★★理由＝`LICENSES/<SPDX>.txt` は*ライセンス本文のテンプレート*であり、「誰の MIT か」を書く場所ではない。⇒ 誰の著作物かは `REUSE.toml` の `SPDX-FileCopyrightText` と `NOTICE` §6 が持つ。**


| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M26-02-public-snapshot-and-license-placement.md` **v1.0.2** |
| チェックリスト | `docs/instructions/reviews/M26-02-review-checklist.md` v1.0.0 |
| 実施日 | 2026-09-06 |
| 着手基点 | `231c07cc` |
| ブランチ | `feature/m26-02` |
| CHANGE 消費 | **0 本**（★起票は設計卓＝`D-293`。**要る箇所は §9 に一覧した**） |
| マイグレ消費 | **0 本** |

---

## 0. まず結論

| # | 完了条件（指示書 §5） | 結果 |
|---|---|---|
| 1 | 許可リストの初版が在り、Plan Mode で範囲の承認を得ている | **達成**（`scripts/public-snapshot-manifest.txt`。承認の記録は §1.1） |
| 2 | **★★陽性対照が在り、わざと 1 件残したケースで赤くなることが確かめられている** | **達成**（§4。**実走の出力を貼った**） |
| 3 | 三層の `LICENSE` とパス単位の宣言が置かれ、レビュー表 §1 / §2 と 1 対 1 で一致 | **達成**（§3。**ファイル単位で突合した**） |
| 4 | `scripts/check-migration-license.sh` が在り、self-test を持ち、緑 | **達成**（§5） |
| 5 | `SUPP-001` §2.7 へ書く欠番の表の素案が報告に在る | **達成**（§7） |
| 6 | `README.md` / `README.txt` の二重が解消されている | **達成**（§8。`M28-01` 案1） |
| 7 | `go test ./...` / `pnpm test` / `make e2e` が緑 | §10 に実測 |
| 8 | 常設検査が緑（`check-artifact-integrity` を 1 本目に回す） | §10。**★本サブ由来でない既存の赤が 2 件ある**（同節） |
| 9 | `docs/progress/progress-log.md` へ追記 | **Phase D で実施した**（索引行はレビュー結果を参照するため Phase C の後にしか書けない＝`D-510`）。**★本節の初版は、まだ書いていない時点で「達成」と断定していた。レビュー 高-3 で是正した** |

**★本サブは「公開の準備」であって「公開」ではない**（指示書 §0.1）。**公開リポジトリへは 1 バイトも落としていない。** 生成スクリプトはリモートに触れる git 操作（`push` / `remote` / `fetch` / `clone`）を 1 つも持たない。

---

## 1. 着手前に開発者から取った確定（★戻すのが難しい向きがあるため）

指示書 §0.3 の逐語＝「一度 AGPL 化してから CC BY SA に戻すのは難しい認識なので、しっかり人力でもレビューします」。**⇒ 割当は「決めて実装する」のではなく「表を出して承認を得てから実装する」形にした。**

### 1.1 Plan Mode で提示し、承認を得た 4 点（2026-09-06）

| # | 論点 | 確定 |
|---|---|---|
| 1 | **`docs/seed-data/` の公開可否** — 同ディレクトリの `README.md` が「本ディレクトリは OSS 公開版リポジトリには含めない方針」と**自己宣言しており**、指示書 §2.1-2 の「`docs` はアーカイブ含め全部公開する」（`D-637`）と正面から食い違っていた | **ディレクトリごと DENY。** 許可リスト方式の既定は非公開であり、開けるのは後からいつでもできる安全側。**`M26-03`（`A3`）で再判定する前提** |
| 2 | **`000081`〜`000103` の 23 本の層割当** — レビュー表 §1 / §2 が覆うのは `000001`〜`000080` の 80 本だけで、23 本は表に無い（指示書 §4-5 の停止条件） | **実査に基づく提案表を採用**（§3.2 に全数） |
| 3 | **三層の範囲**（指示書 §7 確認事項 1〜3） | **§7 暫定案どおり採用** |
| 4 | **ルートの `combomgr`（21MB・未 strip ELF・untracked かつ un-ignored）** | **`.gitignore` へ旧名のビルド成果物を追記する。★ファイル自体は消さない**（`D-196`） |

> **★1 の「公開しない」と 3 の「層 B を割り当てる」は矛盾しない。** **許可リストはファイルの選別、ライセンスは表示**であり互いに独立である（`M26-overview` §4 の逐語）。`REUSE.toml` は開発リポ側の宣言として `docs/seed-data/**` を層 B に置き、公開スナップショットからは DENY で落ちる。REUSE 仕様上、**存在しないパスに解決する宣言は無視される**ため、生成物側に宣言が残っても害は無い。

### 1.2 ★指示書・チェックリストの失効を 3 件見つけた（実測との食い違い）

| # | 記述 | 実測 |
|---|---|---|
| **1** | 指示書 §2.3-2 ／ チェックリスト §3-2＝**欠番は 3 つ**〔`000012` / `000081` / `000096`〕 | **★欠番は `000012` の 1 つだけである。** `000081`（`M27-01`）と `000096`（`M27-02b`）は**実在する**。`ls migrations/*.up.sql` は 102 本、`000001`〜`000103` のうち欠けるのは `000012` のみ。この 2 本は**並列ブランチが先に番号を取ったため一時的に穴に見えた**もので、統合後は埋まっている（`000092`〜`000095` も同じ経緯で `M14-03f` が埋めた）。出所は `D-708` の「穴は 3 つになる」という**予測**であり、その後の統合で実現しなかった |
| **2** | 指示書 §2.2-3 ／ チェックリスト §2-1＝**層 A 28 本** | **★現存する凍結層 A は 27 本である。** レビュー表 §1 の 28 行は**削除済みの `000012` を含む**（同表自身が「★★削除（欠番にする）」と書いている行） |
| **3** | 指示書 §2.2-6＝`character_data/` は〔`*.csv` 31 ＋ `chain-cancel-measurements.md` ＋ `command-correction-history.md`〕＋ `seed-progress.md` | **★35 ファイル在り、`dhalsim-joint-remeasurement-2026-09-04.md` が列挙から漏れている。** 「丸ごと層 B ／ `seed-progress.md` のみ層 A」という**規則のほうに従い**、当該 md は層 B とした（実装は `character_data/**` のグロブなので、列挙の漏れは自動的に埋まる） |

**⇒ どれも「数が合っているか」を見ないと気づけない型である。** 実装は実測側に合わせた。

---

## 2. 実査した事実（指示書 §6＝設計卓が確かめていなかったもの）

| # | 実査項目 | 実測結果 |
|---|---|---|
| **1** | **REUSE 仕様のパス単位宣言の構文**（`REUSE.toml` か `.reuse/dep5` か、両方か） | **★一次情報に到達できた。§6 に全文引用つきで書いた** |
| 2 | `.gitignore` の既存除外（許可リストと重なる範囲） | 追跡は **27 トップレベル / 2706 ファイル**（着手基点時点）。`dist/` `logs/` `tmp/` `work_html/` `.pnpm-store/` `config.toml` `*.db*` と**他プロジェクト 4 本**（`combomgr-importer` 159MB / `autopilot-combomgr` 121MB / `autopilot-workspace` / `automation-project`。**いずれも独立した `.git` を持つ別リポジトリ**）は ignore 済み。**⇒ 許可リストの母数は `git ls-files` で足りる。★作業ツリーを丸ごとコピーする方式なら約 281MB の他リポジトリを取り込んでいた** |
| 3 | `scripts/` の既存生成系（許可リストの生成をどこへ置くか） | `check-*.sh` は 10 本。`check-artifact-integrity.sh` が **`scripts/check-*.sh` を glob で自動発見**し、各本を `--self-test` で実行して stdout に `自己検査: 合格` が出ることを要求する（**登録簿は無い**）。**⇒ 新設した 2 本は自動的に射程へ入った**（§10 で確認） |
| 4 | **配布禁止 HTML と検証用 CSV の所在**（`A3`） | **追跡ファイルには 1 件も無い**（`M26-01` 報告 §8-5 を独立に再確認した）。`work_html/` は `.gitignore` 済みで、現在の中身は Codex サンドボックスのチェックリスト HTML 1 本のみ。HTML 由来の検証 CSV は ignore 済みの `tmp/preseed-20260820/` にのみ在る。**⇒ 除外規則は予防として置いた（0 件でも緑になる形）** |
| 5 | `docs/human-notes/future-notes/combmgr-features.txt` がまだ在るか | **まだ在る。⇒「存在しても出さない」形で書いた**（§4.3） |
| **6** | **（指示書に無いが確かめた）`//go:embed` と `iofs` の非再帰性** | `embed_migrations.go` は `//go:embed migrations/*.sql`、`internal/infra/migration/migrate.go:35` は `iofs.New(fs, "migrations")`。**⇒ `D-705` の「フォルダ分割は危険」の根拠は実物で裏が取れた。★ライブラリ仕様の一次確認は本サブの手番だった** |

---

## 3. ライセンス割当の最終形（指示書 §3-3）

### 3.1 置いたファイル

```
LICENSE                            AGPL 全文（GitHub のライセンス検出用。★REUSE ツールからは無視される）
LICENSES/AGPL-3.0-or-later.txt     SPDX 正本から取得（spdx/license-list-data の text/）
LICENSES/CC-BY-SA-4.0.txt          同上
LICENSES/MIT.txt                   同上（★著作権行の <year> <copyright holders> を埋めた）
REUSE.toml                         ★パス単位の宣言（D-702 (f)。ファイル 1 本ずつの SPDX ヘッダは書いていない）
NOTICE                             非公式表示・商標・撤退ポリシー・対応ソースの入手先・第三者ライブラリ
DATA-LICENSE.md                    層の説明・FAQ・★「データとしての正本は character_data/」（§2.2-7）
CONTRIBUTING.md                    DCO・inbound=outbound・素材由来の注意・外部 PR は現在受け付けない
SECURITY.md                        ★「LAN 内での利用を前提とし、インターネットへ直接公開しないこと」を明記
SUPPORT.md                         無保証・SLA なし・改変版は対象外
```

### 3.2 ★`migrations/` の割当 — レビュー表との突合（ファイル単位）

**合計 102 本＝層 A 30 本 / 層 B 72 本。**（`.up.sql` / `.down.sql` の対で 204 ファイル＝層 A 60 / 層 B 144。実測は `bash scripts/check-migration-license.sh --list`）

| 出所 | 層 A | 層 B | 突合 |
|---|---:|---:|---|
| レビュー表 §1（層 A）— 表は 28 行 | **27** | — | **★表の 28 行は削除済みの `000012` を含む**（§1.2-2）。残る 27 本を 1 対 1 で写した |
| レビュー表 §2（層 B）— 52 行 | — | **52** | 52 本を 1 対 1 で写した。**★層が割れる 3 本**〔`000039` / `000017` / `000029`〕**は 3 本とも層 B**（表の推奨どおり） |
| `000081`〜`000103`（表に無い 23 本・**開発者承認 2026-09-06**） | **3** | **20** | 下表 |
| **合計** | **30** | **72** | 102 本 = 現存する全マイグレ |

#### `000081`〜`000103` の判定（★1 本ずつ実物を開き、書き込む表を全数抽出した）

判定規則は `D-672`（レビュー表 §0）をそのまま用いた——**層 B ＝ SF6 の事実そのもの**〔ロスター・技・フレームデータ・コマンド・派生関係・キャラ固有ゲージ系・公式表記の技名〕／**層 A ＝ スキーマ DDL・アプリ構造の変更・アプリの初期データ**。

| 連番 | ファイル | 書き込む表（実測） | 層 |
|---|---|---|---|
| `000081` | `rename_opponent_size_medium_to_standard` | `combos` | **A**（コード値の命名はアプリ側の設計物） |
| `000082` | `seed_characters_fourth_wave` | `characters` | B |
| `000083` | `seed_movement_system_moves_fourth_wave` | `moves` / `preset_aliases` | B |
| `000084` | `seed_moves_fourth_wave` | `moves` / `preset_aliases` | B |
| `000085` | `backfill_moves_is_derived_fourth_wave` | `moves` | B |
| `000086` | `seed_move_commands_fourth_wave` | `move_commands` | B |
| `000087` | `backfill_moves_is_projectile_fourth_wave` | `moves` | B |
| `000088` | `backfill_moves_chain_cancel_total_fourth_wave` | `moves` | B |
| `000089` | `backfill_moves_frame_cost_fourth_wave` | `moves` | B |
| `000090` | `seed_aliases_numeric_fourth_wave` | `preset_aliases` | B |
| `000091` | `seed_aliases_srk_fourth_wave` | `preset_aliases` | B |
| `000092` | `backfill_movement_total_fourth_wave` | `moves` | B |
| `000093` | `seed_custom_states_fourth_wave` | `characters` | B |
| `000094` | `seed_custom_states_missing_seeded_chars` | `characters` | B |
| `000095` | `correct_kimberly_shuriken_bomb_max` | `characters` | B |
| `000096` | `add_combos_oki_verified` | `combos` | **A**（列追加 DDL ＋ 自表の backfill） |
| `000097` | `seed_moves_dhalsim_rapid` | `moves` / `preset_aliases` | B |
| `000098` | `seed_move_derivations_dhalsim_rapid` | `move_derivations` | B |
| `000099` | `backfill_moves_chain_cancel_total_fourth_wave_second_stage` | `moves` | B |
| `000100` | `rename_cammy_hooligan_combination_holding` | `moves` / `preset_aliases` | B |
| `000101` | `seed_move_derivations_fourth_wave` | `move_derivations` | B |
| `000102` | `seed_move_derivations_existing_chars` | `move_derivations` | B |
| `000103` | `flip_drive_damage_sign` | `combos` | **A**（値の意味の入れ替え＝アプリの設計物。利用者データの変換） |

**★層 A の 3 本はいずれも `combos`（利用者データ）しか触らず、ゲームマスタ表〔`characters` / `moves` / `move_commands` / `move_derivations` / `preset_aliases` / `custom_states`〕へは 1 行も書かない。層 B の 20 本はすべてゲームマスタ表を書く。⇒ 境界は表単位で綺麗に割れている。**

**★既存マイグレは 1 バイトも変えていない**（`D-535`）。§10 の `git diff --stat` に `migrations/` が 1 行も現れないことで確かめられる。

### 3.3 `character_data/` の割当

| 対象 | 層 |
|---|---|
| `character_data/**`（`*.csv` 31 ＋ `chain-cancel-measurements.md` ＋ `command-correction-history.md` ＋ **`dhalsim-joint-remeasurement-2026-09-04.md`**） | **B** |
| `character_data/seed-progress.md` の 1 件のみ | **A** |

**★`dhalsim-joint-remeasurement-2026-09-04.md` は指示書 §2.2-6 の列挙から漏れていた**（§1.2-3）。実装はディレクトリ単位のグロブなので、列挙の漏れは自動的に埋まる。

### 3.4 `REUSE.toml` 全文（指示書 §3-3）

```toml
# REUSE.toml — Tacpendium のライセンス宣言（パス単位）
#
# ★本ファイルはパス単位の宣言に集約している（ボード D-702 (f)）。
#   ファイル 1 本ずつに SPDX ヘッダは書かない。
#
# 三層（docs/human-notes/future-notes/combmgr-license-strategy-outline.md §0）:
#   層 A アプリ本体        AGPL-3.0-or-later
#   層 B ゲームデータ      CC-BY-SA-4.0
#   層 C 開発運用文書・道具 MIT
#
# ★★宣言の並び順が意味を持つ。REUSE 仕様 3.3 §REUSE.toml の逐語:
#   "If a Covered File is covered by multiple [[annotations]] tables in the same
#    REUSE.toml file, then exclusively the last matching table in the file is used
#    for that Covered File."
#   ⇒ 上から順に「既定 → 層 C → 層 B → 層 A への差し戻し」で書く。並べ替えないこと。
#
# ★グロブの規則（同仕様）: `*` は `/` を跨がない。`**` は跨ぐ。
#   ⇒ `migrations/*_data_*.sql` は migrations/ 直下だけに当たる。
#
# ★LICENSES/ と LICENSE と .gitignore 済みのファイルは Covered File ではない
#   （同仕様 §Covered and ignored Files）。`**` が当たっても無視される。
#
# 検査: bash scripts/check-migration-license.sh
#
# ★★`precedence = "override"` を全表に付けてある(2026-09-06 レビュー 中-1 の是正)。
#   既定は `closest` であり、仕様の逐語は「This is an instruction to associate the Licensing
#   Information **inside of the Covered Files** (or its adjacent `.license` file), if available.」
#   ⇒ 既定のままだと**ファイル内の SPDX ヘッダが本宣言に勝つ**。
#   本プロジェクトは D-702 (f) に従い「パス単位の宣言に集約し、ファイル 1 本ずつの SPDX ヘッダを
#   書かない」方針であるから、宣言を権威にする `override` が方針と一致する。
#   ★実測(2026-09-06): 追跡ファイル中でコロン形 `SPDX-License-Identifier:` を含むのは
#     `docs/progress/M26-01-report.md` の 1 件のみで、それも本文中の説明であってヘッダではない。
#     ⇒ 現時点で `override` が上書きしてしまう正当なヘッダは存在しない。
#   ★あわせて、これで `scripts/check-migration-license.sh` の自前解決器
#     (ファイルの中身を見ず、常に最後に一致した表を採る)が仕様と一致する。
#   （宣言にも命名規約にも当てはまらないマイグレを検出する。D-705 (3)）

version = 1

# ---------------------------------------------------------------------------
# (1) 既定 = 層 A（アプリ本体）
# ---------------------------------------------------------------------------
[[annotations]]
path = "**"
precedence = "override"
SPDX-FileCopyrightText = "2026 plexiblinp"
SPDX-License-Identifier = "AGPL-3.0-or-later"

# ---------------------------------------------------------------------------
# (2) 層 C = MIT（AI 運用ルール群 / スクリプト / 開発運用文書）
#     ★迷ったら MIT へ倒す（D-702 (d)）——開発文書を AGPL にして守る利益が無い一方、
#       外部 PR が 1 本入ると持ち出せなくなるため。
# ---------------------------------------------------------------------------
[[annotations]]
path = [
  "CLAUDE.md", "AGENTS.md",
  ".claude/**", ".codex/**", ".agents/**",
  "human-notes/**", "docs/human-notes/**",
  "scripts/**",
  "docs/handover/**", "docs/process/**",
  "docs/instructions/templates/**",
]
precedence = "override"
SPDX-FileCopyrightText = "2026 plexiblinp"
SPDX-License-Identifier = "MIT"

# ---------------------------------------------------------------------------
# (3) 層 B = CC BY-SA 4.0（SF6 の事実そのもの）
#     ★新規マイグレは命名規約で決まる（D-705 (2)）——層 B に `_data_` を付ける。
#       例 `NNNNNN_data_seed_moves_xxx.up.sql`
#       ⇒ 次の seed 波が何本足しても、この宣言は触らなくてよい。
# ---------------------------------------------------------------------------
# ★`docs/seed-data/**` の著作権表示は暫定である(2026-09-06 レビュー 中-6)。
#   同ディレクトリは公開スナップショットから DENY されており、その理由は
#   「公式の生フレーム値・元データ抜粋を含む」——つまり第三者素材を含みうると自分で判定した
#   範囲である。そこへ自分の著作権表示と CC BY-SA を宣言するのは整合しない。
#   ★公開物には出ないため実害は無いが、M26-03(A3＝データ来歴の切り分け)で再判定すること。
[[annotations]]
path = [
  "character_data/**",
  "docs/seed-data/**",
  "migrations/*_data_*.sql",
]
precedence = "override"
SPDX-FileCopyrightText = "2026 plexiblinp and the Tacpendium contributors"
SPDX-License-Identifier = "CC-BY-SA-4.0"

# ---------------------------------------------------------------------------
# (4) 層 B = 既存マイグレ 72 本（★凍結・一度だけ列挙）
#     出所: docs/progress/20260905-migration-license-assignment.md §1 / §2
#           （000001〜000080 の 80 本。層 A 28 本のうち 000012 は削除済みのため現存 27 本）
#         ＋ 000081〜000103 の 23 本は M26-02 の実査（開発者承認 2026-09-06）
#     ★適用済みマイグレは凍結されている（D-535）。⇒ この行は以後変わらない。
# ---------------------------------------------------------------------------
[[annotations]]
path = [
  "migrations/000003_*.sql", "migrations/000004_*.sql", "migrations/000006_*.sql", "migrations/000009_*.sql",
  "migrations/000010_*.sql", "migrations/000011_*.sql", "migrations/000014_*.sql", "migrations/000015_*.sql",
  "migrations/000017_*.sql", "migrations/000023_*.sql", "migrations/000024_*.sql", "migrations/000025_*.sql",
  "migrations/000026_*.sql", "migrations/000027_*.sql", "migrations/000029_*.sql", "migrations/000030_*.sql",
  "migrations/000034_*.sql", "migrations/000035_*.sql", "migrations/000039_*.sql", "migrations/000041_*.sql",
  "migrations/000043_*.sql", "migrations/000044_*.sql", "migrations/000045_*.sql", "migrations/000046_*.sql",
  "migrations/000047_*.sql", "migrations/000048_*.sql", "migrations/000050_*.sql", "migrations/000051_*.sql",
  "migrations/000052_*.sql", "migrations/000053_*.sql", "migrations/000054_*.sql", "migrations/000055_*.sql",
  "migrations/000056_*.sql", "migrations/000057_*.sql", "migrations/000058_*.sql", "migrations/000059_*.sql",
  "migrations/000060_*.sql", "migrations/000061_*.sql", "migrations/000062_*.sql", "migrations/000063_*.sql",
  "migrations/000064_*.sql", "migrations/000065_*.sql", "migrations/000066_*.sql", "migrations/000067_*.sql",
  "migrations/000068_*.sql", "migrations/000071_*.sql", "migrations/000072_*.sql", "migrations/000073_*.sql",
  "migrations/000076_*.sql", "migrations/000077_*.sql", "migrations/000079_*.sql", "migrations/000080_*.sql",
  "migrations/000082_*.sql", "migrations/000083_*.sql", "migrations/000084_*.sql", "migrations/000085_*.sql",
  "migrations/000086_*.sql", "migrations/000087_*.sql", "migrations/000088_*.sql", "migrations/000089_*.sql",
  "migrations/000090_*.sql", "migrations/000091_*.sql", "migrations/000092_*.sql", "migrations/000093_*.sql",
  "migrations/000094_*.sql", "migrations/000095_*.sql", "migrations/000097_*.sql", "migrations/000098_*.sql",
  "migrations/000099_*.sql", "migrations/000100_*.sql", "migrations/000101_*.sql", "migrations/000102_*.sql"
]
precedence = "override"
SPDX-FileCopyrightText = "2026 plexiblinp and the Tacpendium contributors"
SPDX-License-Identifier = "CC-BY-SA-4.0"

# ---------------------------------------------------------------------------
# (5) 層 A への差し戻し（★(3) の "character_data/**" から 1 件だけ抜く）
#     seed-progress.md は seed 投入の手順書であってゲームデータではない。
# ---------------------------------------------------------------------------
[[annotations]]
path = "character_data/seed-progress.md"
precedence = "override"
SPDX-FileCopyrightText = "2026 plexiblinp"
SPDX-License-Identifier = "AGPL-3.0-or-later"
```

> **★宣言の並び順が意味を持つ。** REUSE 仕様 3.3 の逐語＝「If a Covered File is covered by multiple `[[annotations]]` tables in the same `REUSE.toml` file, then exclusively **the last matching table in the file** is used for that Covered File.」
> **⇒ 「既定 → 層 C → 層 B → 層 A への差し戻し」の順で書いてある。並べ替えると割当が変わる。**
> レビュー表 §5 のイメージは既定を**最後**に置いていたが、この規則により**それでは既定が全部を上書きしてしまう**。**⇒ 実装では既定を先頭へ置いた。**

> **★`precedence = "override"` を全表に付けてある**（2026-09-06 レビュー 中-1 の是正。**初版は省略しており、既定の `closest` になっていた**）。
> 仕様の逐語＝`closest` は「This is an instruction to associate the Licensing Information **inside of the Covered Files** (or its adjacent `.license` file), if available.」——**⇒ 既定のままだと、ファイル内の SPDX ヘッダが本宣言に勝つ。**
> 本プロジェクトは `D-702` (f) に従い「パス単位の宣言に集約し、ファイル 1 本ずつの SPDX ヘッダを書かない」方針であるから、**宣言を権威にする `override` が方針と一致する。** あわせて、これで `check-migration-license.sh` の自前解決器（ファイルの中身を見ず、常に最後に一致した表を採る）が仕様と一致する。
> **★実測（2026-09-06）**: 追跡ファイル中でコロン形 `SPDX-License-Identifier:` を含むのは **`docs/progress/M26-01-report.md` の 1 件のみ**で、それも本文中の説明であってヘッダではない。**⇒ `override` が上書きしてしまう正当なヘッダは現時点で存在しない。★ただしこの 1 件は、公式 `reuse lint` が当該ファイルのタグとして拾いうる形である**（後続が「` の形式を使い…」であり不正な SPDX 式になる）。**§11-1 の「公式ツールとの一致は確かめていない」に対する、具体的な不一致候補として記録しておく。**

### 3.5 ★層 C の範囲について、指示書の記述を 1 か所解釈した

指示書 §7-1 の暫定案は層 C に `human-notes/` と書いているが、リポジトリには**同名のものが 2 つ在る**——ルート直下の `human-notes/`（1 ファイル。Codex 運用ルール）と `docs/human-notes/`（117 ファイル）。`D-702` の議論は「`docs` 直下 10 ディレクトリ」を数えていたので**後者**を指すと解されるが、**前者も AI 運用ルール群であり性質は同じ**である。

**⇒ 両方を層 C（MIT）とした**（`D-702` (d)＝迷ったら MIT へ倒す）。**★製造の解釈である。設計卓が別の読みを採るなら `REUSE.toml` の (2) から 1 行外せば済む。**

### 3.6 ★設計卓へ回す論点 — `docs/handover/**` → MIT が `D-672` と衝突する実例を含む

**2026-09-06 レビュー（中-2）の指摘を採用して足した。初版はこの衝突に触れていなかった。**

指示書 §7-1 の暫定案（開発者承認済み）は `docs/handover/` を**層 C（MIT）**としている。**⇒ 指示違反ではない。** ただし同ディレクトリには、`D-672` が「**層 B ＝ SF6 の事実そのもの**」と定義したものが実在する。

| 実例 | 中身 |
|---|---|
| `docs/handover/SF6セットプレイ-ドメイン知識集成.md` | `knockdown_advantage` の定義、窓方式の数式、チェーンキャンセルの実消費フレーム、キャラ別の技構成 |
| `docs/handover/M19-DESIGN-0*.md` 群 | フレームモデルの設計と、その前提となる SF6 の挙動 |

**⇒ これらは `character_data/` 由来ではない独立の SF6 事実集成であり、層 B の ShareAlike が及ばない。** `DATA-LICENSE.md` §4 は「データとしての正本は `character_data/`」と書いているが、**上記はその正本の外に在る事実である。**

**★本サブでは割当を変えていない。** 理由 2 つ——**(1) §7 暫定案は「`docs/handover/` を層 C」と明示して承認されている。ここから外すのは承認の範囲を超える**（指示書 §4-5＝表に無いものを製造が決めない）**／(2) 向きは MIT → CC BY-SA へ後から締め直せる側であり、単独著作者なので「戻せない」型ではない**（レビュー表 §0 の判定と同じ理屈）。

**⇒ 設計卓の判断を求める。**

---

## 4. 許可リストと陽性対照（指示書 §3-1 / §3-2）

### 4.1 ★許可リスト方式であることの担保（denylist にしていない）

| # | 仕掛け |
|---|---|
| 1 | 母数は `git -c core.quotePath=false ls-files -z`。**★`-z` は必須である**——非 ASCII を含む追跡パスが 4 本在り（`docs/handover/SF6セットプレイ-ドメイン知識集成.md` 等）、素の `git ls-files` は C 形式の引用符で包んで出す。**素朴なパス突合は、ここで静かに壊れる** |
| 2 | **ALLOW にも DENY にも当たらない追跡ファイルは「未判定」として赤**。⇒ 新しいトップレベル・新種のディレクトリは**既定で公開されず、かつ黙って通らない**。集合が閉じる |
| 3 | **DENY は ALLOW より強い**（許可ディレクトリの中から 1 件だけ抜くため） |
| 4 | **DENY はグロブが 0 件に当たっても赤にしない**。⇒「存在しても出さない」形で書ける（§4.3） |
| 5 | 生成の選別と検査は**同じ判定器 1 本**を呼ぶ（`check-public-snapshot.sh`）。⇒ 「生成では通るが検査では落ちる」形にならない |

### 4.2 許可リスト全文

```
# public-snapshot-manifest.txt — 公開スナップショットの許可リスト(正本)
#
# ★★これは許可リスト(allowlist)である。除外リスト(denylist)ではない。
#   理由(D-637 (1) / pre-push-guard.sh の逐語): 「列挙方式は必ず取りこぼす。許可リスト方式なら
#   集合が閉じる。過剰ブロックは可視で直せるが、取りこぼしは silent である」。
#   ⇒ ALLOW にも DENY にも当たらないファイルは「未判定」として**検査が赤になる**。
#     新しいトップレベル・新種のディレクトリは、既定で公開されず、かつ黙って通らない。
#
# 形式: <ALLOW|DENY><TAB><グロブ><TAB><理由>
#   ・`#` で始まる行と空行は無視する。
#   ・グロブの規則は REUSE 仕様 3.3 と同じ: `*` は `/` を跨がない / `**` は跨ぐ。
#   ・**DENY は ALLOW より強い**(許可ディレクトリの中から 1 件だけ抜くために使う)。
#   ・**DENY はグロブが 0 件に当たっても赤にしない**。
#     ⇒ 「存在しても出さない」形で書ける(D-656)。開発者が対象を消したら自然に不要になる。
#
# 母数: `git ls-files`(追跡ファイル)。⇒ .gitignore 済みのものは初めから母数に入らない。
#   ★これは「二重の防壁のうち外側」でしかない。内側は本ファイルの DENY である。
#
# 検査: bash scripts/check-public-snapshot.sh
# 生成: bash scripts/make-public-snapshot.sh --out <dir>

# ---------------------------------------------------------------------------
# DENY(★ALLOW より強い。先に読む)
# ---------------------------------------------------------------------------
DENY	.devcontainer/**	anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外
DENY	docs/seed-data/**	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
DENY	docs/human-notes/future-notes/combmgr-features.txt	陳腐化しており開発者が削除予定(D-656)。★存在しても出さない形で書いてある。消えたら本行は自然に不要になる
DENY	**/.env	機密(checklist A3 の「.env / secrets 系」)。★追跡していないので通常 0 件。予防として置く。★深さ無制限にしてある(理由は本節末)
DENY	**/.env.*	同上。★`.env.example` にも当たる。置くことになったらここを見直すこと(.gitignore は `!.env.example` で追跡を意図している)
DENY	**/secrets/**	同上
DENY	**/work_html/**	配布禁止 HTML の保管場所(M14-RESEARCH-01 §1)。★.gitignore 済みで追跡していないため通常 0 件。予防として置く
DENY	**/tmp/**	検証用 CSV・試作 HTML の置き場(A3)。★.gitignore 済みで追跡していないため通常 0 件。予防として置く
DENY	**/*.pem	鍵・証明書。★予防
DENY	**/*.pfx	鍵・証明書。★予防
DENY	**/*.key	秘密鍵。★予防
DENY	**/id_rsa	秘密鍵。★予防
DENY	**/id_rsa.*	秘密鍵。★予防

# ★★予防 DENY は必ず `**/` で書くこと(2026-09-06 レビュー 高-1 の是正)。
#   グロブ規則は `*` がパス区切りを跨がないため、`.env` と書くと**リポジトリ直下にしか当たらない**。
#   一方 `.gitignore` の同じ規則は深さ無制限である。⇒ 非対称のまま置くと、
#   `web/.env`(Vite の既定位置)や `docs/tmp/**` が `web/**` / `docs/**` の ALLOW を素通りする。
#   ★「内側の防壁」を名乗るなら、外側(.gitignore)と同じ深さで書かなければ意味がない。

# ---------------------------------------------------------------------------
# ALLOW — ライセンス・公開の告知(層 A)
# ---------------------------------------------------------------------------
ALLOW	LICENSE	AGPL 全文(GitHub のライセンス検出用)
ALLOW	LICENSES/**	REUSE 準拠のライセンス本文
ALLOW	REUSE.toml	パス単位のライセンス宣言
ALLOW	NOTICE	非公式表示・第三者ライセンス・撤退ポリシー
ALLOW	DATA-LICENSE.md	データ層の説明と FAQ
ALLOW	CONTRIBUTING.md	DCO・inbound=outbound・素材由来の注意
ALLOW	SECURITY.md	報告窓口・LAN 前提の警告
ALLOW	SUPPORT.md	無保証・SLA なしの明示

# ---------------------------------------------------------------------------
# ALLOW — アプリ本体(層 A)
# ---------------------------------------------------------------------------
ALLOW	cmd/**	Go エントリポイントと seedgen
ALLOW	internal/**	Go の実装
ALLOW	web/**	フロントエンド(node_modules / dist / test-results は .gitignore 済み)
ALLOW	migrations/**	マイグレーション SQL(層は REUSE.toml が決める)
ALLOW	embed_migrations.go	embed.FS ホルダ
ALLOW	embed_web_release.go	embed.FS ホルダ
ALLOW	embed_web_stub.go	embed.FS ホルダ
ALLOW	go.mod	依存の正本
ALLOW	go.sum	依存の正本
ALLOW	Makefile	ビルド・テストの入口
ALLOW	config.toml.example	設定の雛形(config.toml 本体は .gitignore 済み)
ALLOW	README.md	開発者向け README
ALLOW	README.txt	★配布版 README(リリース zip に同梱。LAN の FW/AV トラブルシューティングの本体)
ALLOW	.github/**	CI ワークフロー(公開リポジトリからビルドするため公開が要る＝骨子 §10.6)
ALLOW	.editorconfig	エディタ設定
ALLOW	.gitattributes	git 属性
ALLOW	.gitignore	除外規則(公開物の再現性のため)

# ---------------------------------------------------------------------------
# ALLOW — ゲームデータ(層 B)
# ---------------------------------------------------------------------------
ALLOW	character_data/**	★データの正本(手入力 CSV 31 本 ＋ 測定記録)。DATA-LICENSE.md §4

# ---------------------------------------------------------------------------
# ALLOW — 開発運用の文書・道具(層 C)
#   ★D-637 (3) で「CLAUDE.md / .claude/ / AGENTS.md / .codex/ も公開してよい」と確定した。
#     設計卓の除外推奨は撤回済みである。
# ---------------------------------------------------------------------------
ALLOW	CLAUDE.md	製造担当 AI 向けのプロジェクト指針
ALLOW	AGENTS.md	Codex 向けの入口
ALLOW	.claude/**	カスタムコマンド・フック・設定(settings.local.json は .gitignore 済み)
ALLOW	.codex/**	Codex 派生物(auth / history / sessions は .gitignore 済み)
ALLOW	.agents/**	Codex 側の skill 定義
ALLOW	human-notes/**	Codex 運用ルール(ルート直下)
ALLOW	scripts/**	検査・生成スクリプト

# ---------------------------------------------------------------------------
# ALLOW — ドキュメント
#   ★「docs はアーカイブ含め全部公開する」(開発者判断＝D-637 / M26-overview §M26-02)。
#     ⇒ ディレクトリ単位で許可し、抜くものだけを上の DENY に書く。
#     ★開発者の区別は「試行錯誤の過程は恥ずかしいが、現在の成果物への指摘は歓迎」であり、
#       隠す動機は過去の履歴に限られる。スナップショット公開なら履歴はそもそも出ない。
# ---------------------------------------------------------------------------
ALLOW	docs/**	設計書・指示書・進捗・引継ぎ・変更通知・監査・人手メモ(★DENY の 2 件を除く)
```

### 4.3 ★「存在しても出さない」形（`D-656`）

`docs/human-notes/future-notes/combmgr-features.txt` は**まだ存在する**（実測）。開発者が削除予定であるため、除外規則を、**存在することを前提にしない**形で書いた。

- DENY のグロブが **0 件に当たっても検査は緑**になる。⇒ 開発者がファイルを消したとき、検査は落ちない。本行は自然に不要になる。
- **これは自己検査の陰性対照 2 で守ってある**（§4.5）。**★「0 件でも緑」は、書いただけでは保証にならない。壊れたら赤くなる対照を置いて初めて保証になる。**

### 4.4 除外したもの — **★件数ではなくパスの全数**（指示書 §3-1）

**14 件。** `bash scripts/check-public-snapshot.sh --list-excluded` の実出力：

```
.devcontainer/Dockerfile	[public-snapshot-manifest.txt:25 .devcontainer/**]	anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外
.devcontainer/devcontainer-lock.json	[public-snapshot-manifest.txt:25 .devcontainer/**]	anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外
.devcontainer/devcontainer.json	[public-snapshot-manifest.txt:25 .devcontainer/**]	anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外
.devcontainer/init-firewall.sh	[public-snapshot-manifest.txt:25 .devcontainer/**]	anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外
.devcontainer/verify-env.sh	[public-snapshot-manifest.txt:25 .devcontainer/**]	anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外
docs/human-notes/future-notes/combmgr-features.txt	[public-snapshot-manifest.txt:27 docs/human-notes/future-notes/combmgr-features.txt]	陳腐化しており開発者が削除予定(D-656)。★存在しても出さない形で書いてある。消えたら本行は自然に不要になる
docs/seed-data/M19-OPS-01-chain-measurement-manual.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/README.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/check-criteria.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/input-notes.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/moves-input-background.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/official-data-edge-cases.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/setplay-move-notes.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
docs/seed-data/target-combo-and-derived-flag-rules.md	[public-snapshot-manifest.txt:26 docs/seed-data/**]	同ディレクトリの README が「OSS 公開版リポジトリには含めない方針」と自己宣言している(公式の生フレーム値・元データ抜粋を含む)。開発者確定 2026-09-06。★M26-03(A3) で再判定する
```

**内訳**: `.devcontainer/` 5 件 ／ `docs/seed-data/` 8 件 ／ `combmgr-features.txt` 1 件。

> **★【2026-09-06 追記】本節の 14 件は実装直後の値である。** 同日中に開発者が `combmgr-features.txt` を削除したため、**現在は 13 件**（`.devcontainer/` 5 ／ `docs/seed-data/` 8）。**DENY 行は残してある**（§9.1 の追記）。

**★予防として置いた DENY は現在 0 件に当たっている**——`.env` / `.env.*` / `secrets/**` / `work_html/**` / `tmp/**` / 鍵ファイル 4 種。**いずれも `.gitignore` 済みで追跡されていないためである。⇒ 「0 件だから効いていない」のではなく「外側の防壁（`.gitignore`）で既に止まっている」。内側の防壁として二重に置いた。**

### 4.5 ★★陽性対照の実走結果（指示書 §3-2 ／ チェックリスト §1-2 / §7）

**「入れた」だけでは足りないので、実際に走らせた出力を貼る。**

#### (a) 自己検査（`bash scripts/check-public-snapshot.sh --self-test`）

```
## 自己検査(陽性対照・陰性対照)

OK  陰性対照(素の状態・網羅) → 緑
OK  陰性対照(DENY グロブが 0 件に当たる) → 緑
OK  陽性対照(生成物に除外対象を 1 件だけ残す) → 赤
OK  陽性対照(ALLOW にも DENY にも当たらない新種) → 赤
OK  陽性対照(生成物に ALLOW 外のファイル) → 赤
OK  陽性対照(manifest の理由列が無い行) → 赤
OK  陽性対照(DENY が ALLOW より強い) → 公開集合から落ちる

自己検査: 合格(陽性は赤・陰性は緑)
```

#### (b) ★★破壊確認 1 — **生成物へ除外対象を 1 件だけ戻す**（チェックリスト §7-1）

**これが本サブで最も重要な破壊確認である**（`D-637` の核心＝`E-84`）。生成済みのスナップショットへ `.devcontainer/devcontainer.json` を 1 件だけ置き直した。

```
$ cp .devcontainer/devcontainer.json tmp/public-snapshot/.devcontainer/devcontainer.json
$ bash scripts/check-public-snapshot.sh --verify-output tmp/public-snapshot
NG  ★★生成物に除外対象が残っている: .devcontainer/devcontainer.json (DENY `.devcontainer/**` に当たる — anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外)
母数 2707 件 / 公開 2706 件 / 除外 1 件

結果: 違反 1 件
exit=1

$ rm -rf tmp/public-snapshot/.devcontainer
$ bash scripts/check-public-snapshot.sh --verify-output tmp/public-snapshot
母数 2706 件 / 公開 2706 件 / 除外 0 件
結果: 違反なし
exit=0
```

**⇒ 1 件混ざれば赤くなり、取り除けば緑に戻る。除外規則が空振りしていないことを、生成物の側から確かめた。**

#### (c) 破壊確認 3 — 許可リストに無い新しいファイル（チェックリスト §7-3）

**★`git rm --cached` と `git reset` は禁止操作である**（`CLAUDE.md` §10。index を戻せない）。**⇒ index を触らずに、生成物と同じ判定器を DIR モードで回して同じことを確かめた。**

```
$ cp -a tmp/public-snapshot tmp/snapshot-destructive
$ mkdir -p tmp/snapshot-destructive/brand-new-dir && echo x > tmp/snapshot-destructive/brand-new-dir/leak.md

# (a) 公開集合に出るか（出たら denylist 的に動いている）
$ bash scripts/check-public-snapshot.sh --list tmp/snapshot-destructive | grep -c 'brand-new-dir/leak.md'
0          ← 公開集合に 0 件（⇒ 生成時に落とされる）

# (b) 生成物の検査は赤になるか
$ bash scripts/check-public-snapshot.sh --verify-output tmp/snapshot-destructive
NG  ★生成物に許可されていないファイルが在る: brand-new-dir/leak.md (ALLOW のどれにも当たらない)
結果: 違反 1 件
exit=1
```

**⇒ 許可リストに無いものは生成物に出ず、万一出ていれば赤くなる。denylist 的に動いていない。**

### 4.6 生成の実走（`bash scripts/make-public-snapshot.sh --out tmp/public-snapshot`）

```
ref:  HEAD (98d410d6)
out:  tmp/public-snapshot

1. 展開: 2720 件
2. 許可リスト適用: 残 2706 件 / 落とした 14 件

# 公開スナップショット 許可リストの検査
対象範囲: 生成物 `tmp/public-snapshot` の中身
母数 2706 件 / 公開 2706 件 / 除外 0 件
結果: 違反なし

結果: 生成と検査を通過した。
```

**★生成物はコミットしていない**（出力先の既定 `tmp/` は `.gitignore` 済み）。**★リモートへは一切触れていない。**

### 4.7 網羅の検査（`bash scripts/check-public-snapshot.sh`）

```
# 公開スナップショット 許可リストの検査

対象 commit: `83a94176`
対象範囲: `git ls-files`(追跡ファイル) と `scripts/public-snapshot-manifest.txt` の突合

母数 2721 件 / 公開 2707 件 / 除外 14 件

?   未追跡かつ未 ignore のファイルが在る(★検査ではない・参考)。
    公開物には出ないが、`git add -A` 1 回で追跡に入る:
      docs/progress/m26-02-review.md

結果: 違反なし
```

**★`?` 行は検査ではない**（赤にしない）。未追跡かつ未 ignore のファイルは `git archive` に入らないので公開物には出ないが、`git add -A` 1 回で追跡に入る。**⇒ 気づけるようにだけしてある。日常的な一時ファイルで鳴るとゲートとして機能しなくなるため、故意に非ゲートにした。**

---

## 5. `scripts/check-migration-license.sh`（指示書 §2.2-5 / §3-4）

### 5.1 何を検出するか

**「宣言にも命名規約にも当てはまらないマイグレ」を検出する。** 4 段で見る。

| # | 見るもの | なぜ |
|---|---|---|
| 1 | **健全性** — `migrations/` 直下より深い場所に `.sql` が無いこと | `//go:embed migrations/*.sql` は直下しか埋め込まず、`iofs.New(fs, "migrations")` も非再帰である（§2-6 で実物確認）。**⇒ サブフォルダのマイグレはエラーを出さずに適用されない。起動は成功し、列だけが無い DB ができる**（`D-705`） |
| 2 | **完全性** — `migrations/*.sql` 全数が `REUSE.toml` でちょうど 1 つの層に解決すること | 宣言から漏れたファイルを出さない |
| 3 | **凍結表との一致** — 凍結済み 102 本の解決結果が、スクリプトが持つ凍結表と 1 対 1 であること | **★宣言の並べ替え・書き換えで割当が静かに変わるのを止める**（§3.4 のとおり順序が意味を持つ） |
| 4 | **★新規分の内容整合** — 凍結表に無いマイグレは (a) `_data_` を持ち層 B に解決する か (b) `_data_` を持たず層 A に解決し、かつ**ゲームデータ表へ書かない** | **これが本検査の本体である。** ゲームデータ表へ書くのに `_data_` を付け忘れた seed が、**AGPL 側へ静かに落ちる**のを止める |

**命名規約**（`D-705` (2)）: **層 B は連番の直後に `data_` を入れる。** 例 `NNNNNN_data_seed_moves_xxx.up.sql`（**★実際の連番は設計卓が払い出す**＝`D-293`）。**⇒ 宣言はグロブ 1 行（`migrations/*_data_*.sql`）で済み、次の seed 波が何本足しても `REUSE.toml` を触らない。**

### 5.2 self-test の実走結果（`--self-test`）

```
## 自己検査(陽性対照・陰性対照)

OK  陰性対照(素の状態) → 緑
OK  陽性対照(`_data_` 無し・INSERT INTO) → 赤
OK  陽性対照(`_data_` 無し・INSERT OR IGNORE INTO) → 赤
OK  陽性対照(`_data_` 無し・INSERT OR REPLACE INTO) → 赤
OK  陽性対照(`_data_` 無し・REPLACE INTO) → 赤
OK  陽性対照(`_data_` 無し・スキーマ修飾つき) → 赤
OK  陽性対照(`_data_` 無し・UPDATE) → 赤
OK  陽性対照(migrations/ の下位ディレクトリに .sql) → 赤
OK  陽性対照(凍結表と宣言のずれ) → 赤
OK  陽性対照(凍結表に在るがファイルが無い) → 赤
OK  陰性対照(命名規約どおりの新規層 B) → 緑

自己検査: 合格(陽性は赤・陰性は緑)
```

### 5.3 本番の実走結果

```
# migrations/ ライセンス宣言の検査

対象 commit: `83a94176`
対象範囲: migrations/*.sql と REUSE.toml
凍結表: 層 A 30 本 / 層 B 72 本


結果: 違反なし
```

### 5.4 ★破壊確認 2 — 命名規約にも宣言にも当てはまらないマイグレを 1 本置く（チェックリスト §7-2）

```
$ cat > migrations/000104_seed_moves_bogus.up.sql <<'X'
-- 破壊確認用。`_data_` を付け忘れたゲームデータ seed を模す。
INSERT INTO moves (character_id, move_code) VALUES (1, 'bogus_move');
X
$ bash scripts/check-migration-license.sh
NG  ★静かな漏れ: migrations/000104_seed_moves_bogus.up.sql はゲームデータ表(moves)へ書くのに `_data_` を持たず層 A(AGPL)へ落ちている。⇒ 層 B なら `000104_data_seed_moves_bogus.up.sql` へ改名すること
結果: 違反 1 件
exit=1

# 命名規約どおりに直すと緑になるか（★対照。赤くなるだけでは片手落ち）
$ mv → 000104_data_seed_moves_bogus.up.sql
$ bash scripts/check-migration-license.sh
結果: 違反なし
exit=0
$ bash scripts/check-migration-license.sh --list | grep 000104
  B      新規       CC-BY-SA-4.0         000104_data_seed_moves_bogus.up.sql
```

**⇒ 漏れが静かに起きなくなった。★破壊確認に使ったファイルは削除済み**（`git status` に残っていない）。

> **★`000104` を破壊確認に使ったが、連番は消費していない。** ファイルは削除した。**★次に払い出す番号は `000106`**（ボード §2.2。`M28-02a` が `000104` ＋ `000105` を別ブランチで消費済みであり、本作業ツリーからは見えない）。**自採番していない**（`D-293`）。

### 5.5 `check-artifact-integrity.sh` との関係

同スクリプトは `scripts/check-*.sh` を **glob で自動発見**し、各本を `--self-test` で実行して stdout に `自己検査: 合格` が出ることを要求する（**登録簿は無い**）。**⇒ 新設した 2 本は登録なしで射程に入り、実際に検出されている**（§10）。

---

## 6. REUSE 仕様の構文 — **★一次情報に到達できた**（指示書 §6-1 / §3-7）

**指示書とチェックリストは「確かめられなかったと書いてあるのが正しい」としているが、本サブでは一次情報に到達できた。⇒ 到達できた範囲は根拠を示して断定し、到達できなかった範囲は「確かめられなかった」と分けて書く**（`M26-01` 教訓 3 は「一次情報へ到達できないなら断定しない」であって、「到達できても断定するな」ではない）。

### 6.1 到達経路

| | |
|---|---|
| **不達** | `https://reuse.software/spec-3.3/` → `connect ECONNREFUSED 213.95.165.53:443`（devContainer のファイアウォールが同ドメインを許可していない） |
| **到達** | FSFE の正本リポジトリ `fsfe/reuse-website` の `site/content/en/spec-3.3.md` を `raw.githubusercontent.com` 経由で取得。**★旧 `fsfe/reuse-docs` は 2024-05-21 にアーカイブされ `reuse-website` へ移動している**（同リポジトリ `README.md` の逐語） |

### 6.2 確かめた内容（★仕様本文からの逐語引用つき）

| # | 事実 | 逐語 |
|---|---|---|
| 1 | **現行機構は `REUSE.toml`。`.reuse/dep5` は deprecated で、両者は排他** | 「REUSE.toml and DEP5 are mutually exclusive. You MUST NOT use both simultaneously.」／「The DEP5 file is deprecated, meaning that it is expected to disappear from a future iteration of this specification.」 |
| 2 | `version` キーは **REQUIRED**・整数・本仕様が記述するのは version 1 | 「The `version` key (REQUIRED) MUST have an integer value representing the schema version of the file. This specification describes version 1 of `REUSE.toml`.」 |
| 3 | `[[annotations]]` のキーは `path`（REQUIRED）/ `precedence`（OPTIONAL）/ `SPDX-FileCopyrightText`（OPTIONAL）/ `SPDX-License-Identifier`（OPTIONAL） | 同節の箇条書き |
| 4 | **グロブ規則** | 「`*` matches everything except forward slashes (i.e. path separators).」／「`**` and `**/` match everything including forward slashes」 |
| 5 | **`precedence` の値は 3 つ** | `closest`（既定・ファイル内のヘッダを優先し、無ければ最も近い `REUSE.toml`）／ `aggregate`（常に付加したうえで `closest` も適用）／ `override`（他を無視。ルートに最も近い表が権威） |
| 6 | **★同一ファイル内では「最後に一致した表」だけが使われる** | 「If a Covered File is covered by multiple `[[annotations]]` tables in the same `REUSE.toml` file, then exclusively the last matching table in the file is used for that Covered File.」 |
| 7 | **`LICENSES/` はルート直下・ファイル名は SPDX ID ＋拡張子・plain text** | 「Each License File MUST be placed in the `LICENSES/` directory in the root of the Project. The name of the License File MUST be the SPDX License Identifier of the license followed by an appropriate file extension (example: `LICENSES/GPL-3.0-or-later.txt`). The License File MUST be in plain text format.」 |
| 8 | **`LICENSE` / `COPYING` は Covered File ではなく、REUSE ツールから無視される** | 「You MAY include `COPYING` or `LICENSE` files in your project … These files are ignored by the REUSE Tool.」 |
| 9 | **`.gitignore` 済みのファイルは Covered File ではない** | 「Covered Files are … all files in a project, with the exception of: … The files ignored by the version control system (example: files listed in `.gitignore`).」 |
| 10 | **存在しないパスに解決する宣言は無視される** | 「A path that resolves to a non-existent or non-Covered File is ignored.」 |
| 11 | **パス単位宣言の想定用途がまさに本件である** | 「The intended use case of this method is large directories where including a comment header in each file (or in `.license` companion files) is impossible or undesirable.」 |

**⇒ 実装は 4 と 6 に強く依存している。** グロブの `*` が `/` を跨がないので `migrations/*_data_*.sql` は直下だけに当たり、「最後に一致した表が勝つ」ので宣言の並び順が割当を決める。**★どちらも読まずに書くと、静かに違う割当になる。**

### 6.3 ★確かめられなかったこと

| # | 確かめられなかったもの | なぜ |
|---|---|---|
| **1** | **`reuse lint` を実際に走らせた結果** | `reuse` は新規依存になるため入れていない（`CLAUDE.md` §6＝新規依存は提案してから）。**⇒ 本サブの解決は仕様本文に基づく自前実装であり、公式ツールの実装との一致は確かめていない。★床であって証明ではない** |
| 2 | JSON schema（`https://reuse.software/reuse-toml-v1.schema.json`）による検証 | 同ドメインへ到達できない（§6.1）。**⇒ TOML としての妥当性は `tomllib` で確かめたが、schema 適合は確かめていない** |
| 3 | GitHub のライセンス検出が `LICENSE` を AGPL と認識するか | 公開リポジトリを作っていないため確かめようがない（フェーズ5） |

---

## 7. `SUPP-001` §2.7 へ書く欠番の表 — **素案**（指示書 §2.3 / §3-5）

**★反映は設計卓の手番である**（`CLAUDE.md` §8。製造は `docs/design/` を編集しない）。以下は**そのまま貼れる形**にした素案である。CHANGE が要る（§9）。

---

<!-- ここから素案 -->

#### マイグレーションの欠番（2026-09-06 実測）

**連番に穴が在る。これは事故ではない。**

| 連番 | 状態 | 理由 |
|---|---|---|
| `000012` | **欠番** | `000012_seed_combos_durability`（耐久テスト用の合成コンボ 36 件）を 2026-09-05 に削除した。**由来が AI 生成または公式 HTML 由来である疑い**があり、公開物に残さない判断（`D-706`〜`D-709` / `D-716`）。削除前にクリーン DB で `SELECT count(*) FROM combos;` → **`0`** を実測しており、**新規 DB にとって完全な no-op** である |

**現在の欠番はこの 1 件だけである**（実測 2026-09-06。`migrations/*.up.sql` は 102 本、`000001`〜`000103` のうち欠けるのは `000012` のみ）。

> **★`000081`（`M27-01` が消費）と `000096`（`M27-02b` が消費）は欠番ではない。** 並列ブランチが先に番号を取ったため一時的に穴に見えた時期があるが、統合後は埋まっている（`000092`〜`000095` も同じ経緯で `M14-03f` が埋めた）。**⇒ 「並列作業中に見える穴」と「恒久の欠番」を混同しないこと。**

**欠番は無害である。**

| # | 根拠 |
|---|---|
| 1 | **`schema_migrations` は「現在の版数」1 行しか持たない**（適用済みの一覧を持たない）。⇒「適用済みなのにファイルが無い」という検出をしない |
| 2 | **`Up` は「存在するファイルを昇順に、現在版数より上だけ」適用する。⇒ 連番の穴は素通りする** |

**⇒ 連番が飛んでいるのを見て「事故だ」と読み、復元しにかからないこと。**

**★危険なのは別のことである。混同しないこと。**

| # | 危険 |
|---|---|
| **(a)** | **適用済み DB に後から若い連番が現れると、その 1 本は永久にスキップされ、エラーにもならない**（`D-119` / `D-120`）。⇒ 番号は必ず現在の最大値より上を取る。**払い出しは設計卓**（`D-293`）。★これが「番号の穴が危険」の正体であり、**既にあるものを消すことはこれに当たらない**（`D-706`） |
| **(b)** | **隣の版数を直書きしたテストは、欠番を作った瞬間に落ちる。** 実測＝`000012` を消したら `TestRun_MovesFrameColumnsDownRollback` が `down to v12: no migration found for version 12: read down for version 12 migrations: file does not exist` で落ちた（2026-09-05・`D-714`）。目標版数は「検証対象の 1 つ下」であり、**隣が消えれば失効する** |

**★恒久の規約: 欠番を作るときは、版数リテラルを名指しする全テストを洗ってから消すこと。**
実測 2026-09-06 時点で、`internal/infra/migration/` の **18 ファイル**が `Migrate(<数>)` の形で版数を直書きしている（`migrate_test.go` / `migrate_m1403b〜e_test.go` / `migrate_m1702_test.go` / `migrate_m1801_test.go` / `migrate_m1802_test.go` / `migrate_m1903_test.go` / `migrate_m1904_test.go` / `migrate_m1904b〜d_test.go` / `migrate_m2301_test.go` / `migrate_m2402_test.go` / `migrate_m2408_test.go` / `migrate_m2701_test.go` / `migrate_m2703_test.go`）。**★机上の `grep` より、捨てブランチで実際に消して `go test ./...` と `make e2e` を回すほうが確実である**（`D-708` の実査 4 が実際に仕事をした）。

#### マイグレーションのライセンスと命名規約（2026-09-06 追加）

- **層 B（SF6 の事実そのもの）のマイグレーションは、連番の直後に `data_` を入れる。** 例 `NNNNNN_data_seed_moves_xxx.up.sql`。**★実際の連番は設計卓が払い出す**（`D-293`）。**⇒ 宣言はグロブ 1 行で済み、次の seed 波が何本足しても宣言を触らない**（`D-705` (2)）。
- 割当の正本は **`REUSE.toml`**。既存 102 本（層 A 30 / 層 B 72）は**凍結・一度だけ列挙**してある。**適用済みマイグレは書き換えない**（`D-535`）ので、この列挙は以後変わらない。
- 検査は **`bash scripts/check-migration-license.sh`**（宣言にも命名規約にも当てはまらないマイグレを検出する。self-test つき）。
- **★フォルダ分割は採らない。** `//go:embed migrations/*.sql` は直下しか埋め込まず（`*` はパス区切りを跨がない）、`iofs.New(migrationsFS, "migrations")` も指定パス直下だけを読む（非再帰）。**⇒ サブフォルダへ置いたマイグレは、エラーを出さずに適用されない。起動は成功し、マイグレも「全部適用済み」として正常終了し、列だけが無い DB ができる。**（2026-09-06 に `embed_migrations.go` と `internal/infra/migration/migrate.go:35` で実物確認。`check-migration-license.sh` が検出する）

<!-- ここまで素案 -->

---

## 8. リポジトリの整理（指示書 §2.4 / `A7` / `A8`）

### 8.1 `README.md` / `README.txt` の二重 — **`M28-01` の案1（推奨）に従った**

`M28-01` 完了報告 §6 の実査結果＝**二重ではない。役割が違う**。

| | 行数 | 読者 | 配布 |
|---|---:|---|---|
| `README.md` | 199 → 226 | 開発者（Go/pnpm・クイックスタート・CI 運用） | GitHub 上のみ |
| `README.txt` | 123 → 136 | エンドユーザー（起動・ポート・**LAN の FW/AV トラブルシューティング**・DB の場所） | **リリース zip に同梱** |

**⇒ 両方残し、相互参照を張って役割を明示した**（案1）。あわせて `README.md` の「ライセンス: **未定(リリース前に決定予定)**」を三層の表へ差し替えた（**★これは失効した記述であり、放置すると次の担当が「ライセンスはまだ未定」を前提として複製する**）。

**★案2（`dist/README.txt` へ移す）は採らなかった。** `dist/` は `.gitignore` 済み（`.gitignore:92` `/dist/`）であり、**移すと `README.txt` が黙って untracked になる。** `M28-01` はこの点に触れていなかった。**⇒ 案2 を採るなら `.gitignore` の手当てが先に要る。**

### 8.2 フォルダ構成の整理とアーカイブ送り — `followup-backlog.md` の具体名に個別に応答する

**★仕分け済みの置き場（`docs/*/archive/` ／ `docs/handover/phase{N}/`）へ移したものは 0 件である。** その判断に至った過程を、**「見て何も無かった」のか「見ていない」のかが読み取れる形**で書く（2026-09-06 レビュー 中-4 の是正。初版は 2 行で「なし」とだけ書いており、どちらとも読めた）。

| # | `followup-backlog.md` が挙げている具体名 | 本サブの応答 |
|---|---|---|
| 1 | **`docs/human-notes/codex/` という不自然な階層**（`repo-folder-structure-cleanup`。同項は「`check-doc-inventory.sh` の射程外である」と明記） | **★見たうえで、動かさなかった。** 理由＝**ルート直下に `human-notes/codex/README.md` が別に在り、そちらが `/sync_codex_config` の正本である**（同 skill が名指ししている）。**⇒ 2 つの `codex/` の役割の切り分けが先に要り、それは配置の問題ではなく所有の問題である。** ★移動は `sync_codex_config` の参照を全数追う必要があり、**`M28-01` が同種の移動で「歴史記録から約 86 行が参照しており、どの機械検査も捕まえない」ことを実測している**（`progress-log` `M28-01` 横断課題 19）。**⇒ 設計卓・開発者の手番へ回す** |
| 2 | **`scripts/archive-resolved.sh` は既に在り「道具が無いのではなく回す手番が無い」** | **★回していない。** 同スクリプトは `--milestone` / `--registry-through` / `--board-history-through` を取り、**`followup-backlog.md` と `change-number-registry.md` を書き換える**。前者は `D-382` により製造が §J 以外を編集してはならないファイルであり、後者は設計卓の管轄である。**⇒ 本サブの射程で回せない。開発者・設計卓の手番** |
| 3 | **`docs/progress/` の滞留資料の仕分け**（`m24-close-report` §3-3 の開発者手番） | **★見たうえで、動かさなかった。** `docs/progress/` は 328 ファイル在り、`phase1/` `phase2/` `phase3/` の仕分け先も在る。**しかし「どれが滞留か」の判定基準が `m24-close-report` §3-3 で開発者の手番とされている。** ⇒ **本サブが基準を自分で作って動かすと、`D-196` の「消す（＝動かす）変更は開発者の手番」を実質的に破る。★候補の提示は §9.1 に出した** |

**⇒ 3 件とも「見たが、本サブの射程では動かせない」である。「見ていない」ものは無い。**

### 8.3 **ファイルは 1 件も消していない**（`D-196`）

**★「消す」変更は開発者の手番である。⇒ 候補と根拠を §9.1 に出すところまでが本サブの射程である。**

---

## 9. 開発者・設計卓の手番として残したもの（指示書 §3-6）

### 9.1 ★消す候補と根拠（**★消していない**。`D-196` 境界条件 3）

| # | 対象 | 根拠 | 大きさ |
|---|---|---|---|
| **1** | **ルート直下の `combomgr`（ELF・未 strip）** | `M28-01` のリネーム前のビルド成果物。**追跡もされず ignore もされていなかった**（`.gitignore` は `/tacpendium` 系しか除外していない）。**⇒ `git add -A` 1 回で 21MB のデバッグ情報付きバイナリがコミットされうる状態だった。** 本サブで `.gitignore` へ旧名 4 種を追記済み（開発者確定）。**★ファイル自体の削除は開発者の手番** | **21MB** |
| 2 | **空の `.worktrees/`** | 2026-07-03 以降**中身 0 件**。worktree の予約名前空間は `.gitignore:6` の `/wt-*/` であり、`.worktrees/` はどこからも使われていない。git は空ディレクトリを追跡しないため `git status` にも現れず、**誰も気づかないまま残る形**である | 0 件 |
| 3 | `docs/human-notes/future-notes/combmgr-features.txt` | **開発者が削除予定**（`D-656` の逐語＝「完全に陳腐化しているので、そのうち私が消します」）。**★除外規則は「存在しても出さない」形で書いてあるので、消えても検査は緑のままである**（§4.3） | 1 件 |
| 4 | ルート直下の `scratch-*.db{,-shm,-wal}` **60 ファイル** | `scripts/dev-throwaway-db.sh` が作る使い捨て DB。`M14-03f`〜`M27-03` の各サブの残骸が 20 セット溜まっている。`.gitignore` 済みで公開物には出ないが、ディスクを食う | **27MB** |
| 5 | `dist/combomgr-windows-amd64.exe` | **旧名のビルド成果物**（2026-08-24）。`dist/` は ignore 済み | 22MB |
| 6 | `logs/` の回転済みログ 3 本 | ignore 済み | 32MB |

**★1〜6 はいずれも「公開物に出るか」とは無関係である**（すべて未追跡または ignore 済み）。**⇒ 公開事故のリスクとして挙げているのではなく、`repo-folder-structure-cleanup` の候補として挙げている。**

> **★★【2026-09-06 追記】開発者が 1〜4 を同日中に削除した。** 1（ルートの `combomgr`）／ 2（空の `.worktrees/`）／ 3（`combmgr-features.txt`）／ 4（`scratch-*.db` 60 ファイル）。**★削除を実行したのは開発者であり**（`D-196`）**、製造は 3 の削除を履歴へ記録したのみである。** 5（`dist/` の旧名 exe）と 6（`logs/`）は残っているが、どちらも `.gitignore` 済みで公開物には出ない。
>
> **★★あわせて `D-656` の「存在しても出さない」形が実地で確かめられた。** `combmgr-features.txt` が実際に消え、**許可リストの DENY 行が 0 件に当たる状態になったが、検査は緑のままである**（実測＝除外 **14 件 → 13 件**、`結果: 違反なし`）。**⇒ 自己検査の陰性対照 2 が、fixture ではなく本物のリポジトリで成立した。★DENY 行はこのまま残す**——消すと、将来同名のファイルが復活したときに黙って公開される。

### 9.2 ★`docs/design/` へ反映が要る箇所（**編集していない**。CHANGE の起票は設計卓＝`D-293`）

| # | 箇所 | 現行の記述 | 何が食い違うか |
|---|---|---|---|
| **★★1** | **`DES-001` §5「プロジェクトライセンス方針」**（`docs/design/01-tech-stack.md:204`） | 逐語＝「本プロジェクト自体のライセンスは **MIT License** とする（確定。2026-06-28 開発者確定）」 | **三層（層 A＝AGPL / 層 B＝CC BY-SA / 層 C＝MIT）と正面から食い違う。** ★同節は理由として「依存ライブラリのライセンスと全て互換性がある」を挙げているが、`M26-01` §3 が **direct 依存 52 件中 0 件が AGPL 非互換**であることを実測しており、この理由は AGPL でも成立する |
| **★★2** | **`SUPP-001` §5.7 の禁止ライセンス表**（`docs/design/supp-001-detailed-design.md:1131`） | 逐語＝「**禁止ライセンス:** GPL-2.0 / GPL-3.0 / LGPL-2.1 / LGPL-3.0 / **AGPL-3.0** / **CC BY-SA** / …」 | **本サブが置いた 2 つのライセンスがどちらも禁止列に載っている。** ★`M26-01` §4.2〜§4.5 は「同節は **inbound**（取り込む依存）の規定であり、**outbound**（本プロジェクトが名乗るライセンス）を AGPL にすることは §5.7 に違反しないと解される」と判定している。**⇒ 要るのは撤回ではなく明確化である**（同 §4.5）。★`checklist` `A1` が「承認後 `DES-001` §5 と `SUPP-001` §5.7 に CHANGE 起票が必要」と既に述べている |
| **★3** | **`SUPP-001` §2.7「マイグレーションツール確定」** | 欠番の記述が無い ／ 新規マイグレの命名規約が無い | **§7 の素案をそのまま足せる形にしてある** |
| 4 | `DES-002` §11.3 の契約群 | — | **本サブは `scripts/` の追加のみで、API 契約に触れていない。⇒ `M26-overview` §5 の「触るなら 1 本」には当たらないと判断した。★ただし CHANGE が 1 本要るのは上記 1・2 の理由による** |

**⇒ CHANGE は 1 本（または 1・2 を分けて 2 本）要る。★本サブは自採番していない**（`D-293`）。

### 9.3 開発者の手番として残るもの（実施していない）

| # | 内容 | 出所 |
|---|---|---|
| 1 | **公開リポジトリ側の設定** — Issues / Discussions を閉じる、**private vulnerability reporting のみ開く**、ブランチ保護、公開リポの README に「本リポは生成物であり直接編集しない」と書く | `A7` ／ 骨子 §10.5 ／ `D-637` |
| 2 | **秘匿情報の走査**（gitleaks 等） | `A9` ／ `M26-04`（**★プライベートのうちに実施する**という性格を持つ） |
| 3 | **`docs/seed-data/` の公開可否の最終判断** | **本サブでは安全側（DENY）に倒した。`M26-03`（`A3`）で再判定する** |
| 4 | **`.devcontainer/` の公開判断** | `P-47`＝当面は除外。方針が変われば manifest の DENY を 1 行外すだけで済む |
| 5 | `README.txt:77` の Windows ファイアウォール規則名 | `M28-01` が報告済み（旧名 `"CombMgr"` で規則を作った利用者に、使われない規則が残る） |
| 6 | **third-party notices の機械生成** | `go-licenses` が 2026-09 時点で失敗している（`M26-01` §1.1）。`NOTICE` §5 に「まだ用意できていない」と明記した |
| **★7** | **★リリース zip の同梱物を増やすかの判断**（2026-09-06 レビュー 高-5） | **現在の zip の中身は `tacpendium.exe` ＋ `README.txt` の 2 点だけである**（`.github/workflows/nightly-crossbuild.yml:105` の逐語）。**⇒ `LICENSE` / `DATA-LICENSE.md` / `NOTICE` / `REUSE.toml` は利用者の手元に届かない。** 本サブでは `README.txt` の文面を「公開リポジトリの本バージョンのタグにあります」へ直し、**「本 zip に入っているのは実行ファイルと本 README.txt だけです」と明記した**。**★同梱物を増やすかどうかは、`DES-002` §11.2 の配布物定義とアーカイブ化手順（Releases 公開時の人の手番）に関わるため開発者・設計卓の判断である。★本サブは法務を断定しない**（指示書 §4-8）**が、コピーレフト系ライセンスの配布物にライセンス本文を添えるのが一般的な運用であることは記録しておく** |
| 8 | `README.md:13` の Go 版数が `go.mod` と食い違う（**★本サブ由来ではない**） | `README.md:13`「Go 1.22 以上(devContainer は 1.26.2)」に対し `go.mod:3` は `go 1.26.4`。**★着手基点から在る記述であり、本サブは当該行を触っていない。⇒ スコープ厳守のため直していない**（レビュー 低-6 も「本サブの欠陥として数えない」としている）。`README.md` を触った機会に挙げておく |

---

## 10. 検査・テストの実測

### 10.1 変更統計（`git diff --stat 231c07cc`）

```
 .gitignore                                |   6 +
 CONTRIBUTING.md                           |  94 +++
 DATA-LICENSE.md                           |  86 +++
 LICENSE                                   | 235 ++++++++
 LICENSES/AGPL-3.0-or-later.txt            | 235 ++++++++
 LICENSES/CC-BY-SA-4.0.txt                 | 170 ++++++
 LICENSES/MIT.txt                          |  18 +
 NOTICE                                    |  74 +++
 README.md                                 |  28 +-
 README.txt                                |  15 +
 REUSE.toml                                | 128 ++++
 SECURITY.md                               |  64 ++
 SUPPORT.md                                |  51 ++
 docs/progress/M26-02-completion-report.md | 936 ++++++++++++++++++++++++++++++
 docs/progress/m26-02-review.md            | 573 ++++++++++++++++++
 scripts/check-migration-license.sh        | 419 +++++++++++++
 scripts/check-public-snapshot.sh          | 358 ++++++++++++
 scripts/make-public-snapshot.sh           | 125 ++++
 scripts/public-snapshot-manifest.txt      | 103 ++++
 19 files changed, 3717 insertions(+), 1 deletion(-)
```
（★上記は Phase C の是正取り込みまでを含む。＋ 未反映: `docs/progress/progress-log.md` への索引行追記＝Phase D）

**★新規ファイルはすべて `+` だけである**（教訓 `E-225`）。**着手基点に対する deletions は全部で 1 行しかなく、その 1 行は `README.md` の**

```
-未定(リリース前に決定予定)。
```

**である**（「ライセンス: 未定」を三層の表へ差し替えたもの）。`README.txt` / `.gitignore` は追記のみ（`+15` / `+6`、削除 0）。**⇒ 新規のつもりのファイルで既存を上書きしていない。**

> **★Phase C の是正で `NOTICE` / `CONTRIBUTING.md` / `REUSE.toml` / `scripts/*` を書き換えたが、これらは本サブで新設したファイルであるため、着手基点に対しては依然として純粋な追加である。** 是正の中身は `git diff 1b6c3fac` で読める。

**★`migrations/` が 1 行も現れない。** 既存マイグレは 1 バイトも変えていない（`D-535`）。
**★`docs/design/` も `.claude/` も現れない**（指示書 §4-3 / §4-9）。
**★`docs/handover/followup-backlog.md` も現れない**（`D-382`）。

### 10.2 常設検査

| 検査 | 結果 |
|---|---|
| **`check-artifact-integrity.sh`（★1 本目）** | **違反なし。** 検査 **14 件**（**新設 2 本が登録なしで自動発見され、`自己検査: 合格` を出すことが確認された**）／ ALLOW 除外 1 件 ／ 生成物 4 件 OK |
| `check-migration-license.sh`（**新設**） | **違反なし**（§5.3）。self-test 合格（§5.2） |
| `check-public-snapshot.sh`（**新設**） | **違反なし**（§4.7）。self-test 合格（§4.5a） |
| `check-doc-refs.sh` | 違反なし |
| `check-stop-discipline.sh` | 違反なし |
| `check-browser-storage-keys.sh` | 違反なし |
| `check-import-order.sh` | 違反なし |
| `check-enum-sync.sh` | ベースラインどおり（増加なし） |
| `check-instruction-format.sh` | 違反なし |
| `check-doc-inventory.sh` | 型に無いファイルなし |
| `check-progress-log-index.sh` | **★違反 1 件（本サブ由来ではない）** — Phase D の追記で本サブ分は解消した。下記 |
| `check-md-emphasis.sh` | **★違反 1 件（現在 1030 行 / ベースライン 436）。うち 58 行は本サブ由来である** — 下記 |

#### ★常設検査の赤 2 件 — 内訳（**ベースラインは 1 つも動かしていない**）

> **★2026-09-06 レビュー（高-3 / 高-4）の是正で本節を書き直した。** 初版は 2 件とも「本サブ由来ではない」と断定していたが、**どちらも一部は本サブ由来であった。** 機序は同じで、**報告を書いた時点（`98d410d6`）では真だったものが、報告自身をコミットした時点（`83a94176`）で偽になった**——`docs/progress/` は両検査の走査範囲に入るからである。**⇒ 「自分の成果物が検査対象に入る」ことを勘定に入れずに「由来ではない」と書いた。**

| # | 検査 | 内容 | 内訳 |
|---|---|---|---|
| 1 | `check-progress-log-index.sh` | 違反 **1 件**（Phase D の追記後の実測） | **(a) 本サブ由来だったもの** — `M26-02` の索引行が未追記だった。**★Phase D で追記して解消した**（索引行はレビュー結果を参照するため Phase C の後にしか書けない＝`D-510`）。**(b) 残る 1 件は本サブ由来ではない** — `作業 ID m19-04 が docs/progress/progress-log.md に現れない`。`M19-04` の追記漏れであり、本サブは同サブの成果物に触れていない |
| 2 | `check-md-emphasis.sh` | 現在 **1030 行** / `BASELINE_BROKEN=436` | **(a) 本サブ由来 58 行** — 完了報告 41 行 ＋ レビュー報告 17 行。**(b) 本サブ由来ではない 972 行** — 着手基点時点の実測値（`436 + 536` 増加＝`972`）と一致する（本サブは同検査の走査範囲〔`docs/{process,handover,instructions,design,change-notes,progress}` の `.md`。`/archive/` と `/phaseN/` を除く〕のファイルを 1 つも変更していないため、その部分の入力は着手基点と byte-identical である） |

**★本サブ由来 58 行のうち 56 行は、この検査の限界による偽陽性である**（実測で機械判定した）。

> **★あわせて初版の数字そのものが誤っていた**（レビュー 低-3）。初版は「現在 981 行」と書いたが、**`--list` の出力からヘッダ 9 行を差し引いていなかった**（`sed -n '5,$p' | wc -l` で数えた）。**正しい着手基点の値は 972 行**であり、同じ実行の要約行が出していた「ベースラインから **536** 行増加」（`436 + 536 = 972`）と突き合わせれば気づけた。**⇒ 同じ検査が 2 つの経路で数字を出すとき、突き合わせずに片方だけを写した。**

- 同検査の判定は「**CommonMark 実装で 1 行ずつ描画**し、コードスパンを除いた出力にリテラルの `**` が残る行」である。**1 行ずつ描画するため、フェンス（```）で囲まれたコードブロックを認識できない。**
- 本サブの報告は、指示書 §3-1 が「**許可リストの全文**」を、§3-3 が「**パス単位の宣言の全文**」を要求している。**その全文にはグロブの `**` が大量に含まれる**（`path = "**"` ／ `.claude/**` ／ `DENY .devcontainer/**` 等）。**⇒ 要求された逐語引用が、そのまま偽陽性として数えられる。**
- **★これらは直せない。** 直すには引用を改変することになり、**指示書が求めた「全文」でなくなる。**

**★本サブ由来の真の閉じない強調は 2 行だけであり、レビュー（高-4）を受けて修正した**（`**「A」を…**` の形。開き `**` の直後が鉤括弧だと左フランキングにならない）。

**★ベースラインを動かさなかった理由**: 本サブの成果でない増加を本サブの手番で床にすると、**実際に減らした変更の記録が失われる**。かつ、**レーンごとに測って下げてはならない**（同スクリプトの header が明記）。**⇒ 開発者・設計卓の手番へ回す。**

> **★設計卓・開発者へ回す論点（本サブの発見）**: **同検査は「コードブロック内のグロブ」を偽陽性として数える。** ベースライン `436` 自体にも同型の偽陽性が含まれている可能性が高い。**⇒ 「閉じない強調」を実際に減らそうとするとき、この偽陽性が床を押し上げて作業を妨げる。** フェンスを跨いで状態を持つ走査（行単位ではなくブロック単位）へ変えるかどうかは、同検査の所有者の判断である。**★本サブの射程外なので触っていない。**

### 10.3 テスト

| | 結果 |
|---|---|
| `go test ./...` | **緑**（37 パッケージすべて `ok`。`internal/infra/migration` 121.6s を含む） |
| `cd web && pnpm test` | **緑**（Test Files **211 passed** / Tests **2429 passed**） |
| `make e2e` | **緑**（**247 passed**・4.1m） |

**★本サブはコードを 1 行も変えていない**（変更は `scripts/` / ルートの配置ファイル / `README` / `.gitignore` のみ）。**⇒ テストが緑であることは「壊していないこと」の確認であり、本サブの成果の証拠ではない。成果の証拠は §4.5 と §5.4 の破壊確認である。**

---

## 11. ★確かめられなかったもの（指示書 §3-7）

**★到達できたものは根拠を示して断定し、到達できなかったものは「確かめられなかった」と書く。両者を混ぜない。**

| # | 確かめられなかったもの | なぜ / 何が言えないか |
|---|---|---|
| **★1** | **`reuse lint` を実際に走らせた結果** | `reuse` は新規依存になるため入れていない（`CLAUDE.md` §6＝新規依存は先に提案する）。**⇒ 本サブの割当解決は REUSE 仕様本文（§6.2）に基づく自前実装であり、公式ツールの実装と一致することは確かめていない。★床であって証明ではない** |
| 2 | `REUSE.toml` の JSON schema 適合 | schema の所在（`reuse.software`）へ devContainer から到達できない。**TOML としての妥当性は `tomllib` で確かめたが、schema 適合は確かめていない** |
| 3 | GitHub のライセンス検出が `LICENSE` を `AGPL-3.0-or-later` と認識するか | 公開リポジトリが存在しないため確かめようがない（フェーズ5） |
| **★4** | **法務の判断** | **本サブは法務を一切断定していない**（指示書 §4-8）。`SECURITY.md` / `DATA-LICENSE.md` / `NOTICE` に書いた AGPL §13 の説明・CC BY-SA の継承条項の説明は、**骨子 §1 / §9 の記述を写したものであり、法的助言ではない**。`DATA-LICENSE.md` §3 には「本書は法的な断定をしない」と明記した |
| **★5** | **`docs/seed-data/` 以外に転載懸念のある文書が無いこと** | **追跡 2717 ファイルの内容審査はしていない。** 見つかったのは「自分で公開不可と宣言している」1 ディレクトリだけであり、**宣言していないものは検出できない。⇒ `M26-03`（`A3`＝データ来歴の切り分け）の射程である** |
| 6 | 秘匿情報が混ざっていないこと | gitleaks 等を回していない（`A9` / `M26-04`）。**⇒ 許可リストは「どのファイルを出すか」しか見ておらず、中身は見ていない** |
| **★7** | **`NOTICE` §4 に書いた公開リポジトリ URL（`https://github.com/plexiblinp/tacpendium`）が実在すること** | **公開リポジトリはまだ開設されていない**（指示書 §0.1）。**到達確認はできていない。⇒ `NOTICE` 側を「★開設予定」と条件付きにし、「公開の手番で必ず突き合わせること」と明記した**（2026-09-06 レビュー 中-5 の是正。初版は断定していた） |
| 8 | 生成物が公開リポジトリで正しく動くこと | **公開していない**（指示書 §0.1 / §4-1）。生成物はローカルの `tmp/public-snapshot/`（`.gitignore` 済み）に作って検査し、その後削除した |
| 9 | `check-md-emphasis.sh` のベースライン超過が「いつから」か | **本サブ由来の 58 行と、それ以外の 972 行の切り分けは実測で示せた**（§10.2）が、**972 行がどのコミットで増えたかは追っていない**（浅いクローンの範囲を超える可能性がある） |

---

## 12. ■ 併せて更新が要るもの

| # | 項目 | 結果 |
|---|---|---|
| 1 | **消費した CHANGE 番号を registry へ登録したか** | **消費 0 本。⇒ 登録なし。** 起票は設計卓（`D-293`）。**★要る箇所は §9.2 に一覧した** |
| 2 | **「次の番号」の写し先を全数直したか**（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 の 4 か所） | **消費 0 本のため、写し先の更新は不要。★動かしていない** |
| 3 | **消費したマイグレ連番** | **消費 0 本。** 実測＝`migrations/` の最大は `000103`、`.up.sql` は 102 本。**★次に払い出す番号はボード §2.2 の `000106` が正しい**——`M28-02a` が `000104` ＋ `000105` を**別ブランチで**消費済みであり、本作業ツリーからは見えないため。**⇒ 本ツリーの実測（`000104`）を「次の番号」と読まないこと。★自採番していない** |
| 4 | **版を上げた文書の参照元を `grep` で全数直したか** | **版を上げた文書は無い。** `docs/design/` は未編集（§9.2 に反映が要る箇所を一覧した） |
| 5 | **`followup-backlog.md`** | **未編集**（`D-382`。§J 停止時記録も不要＝再レビュー往復 0 回）。**★`migration-version-literals-in-tests` の「恒久の規約は未着手」は §7 の素案で満たされる見込みだが、同表の更新は設計卓の手番である** |
| 6 | **`.claude/`** | **未編集**（開発者のルールファイル。指示書 §4-9） |
| 7 | **`check-*.sh` のベースライン** | **1 本も動かしていない**（§10.2） |

---

## 13. レビュー結果と取り込み（Phase C）

| 項目 | 実測 |
|---|---|
| レビュー報告書 | `docs/progress/m26-02-review.md`（fresh subagent。メイン会話文脈を継承しない独立レビュー） |
| 指摘の件数 | **重大 0 件 ／ 高 6 件 ／ 中 6 件 ／ 低 6 件**（計 18 件） |
| **★「高」指摘の不採用** | **0 件**（6 件すべて採用。⇒ エスカレーション不要） |
| 中の採否 | **6 件すべて採用**（うち 2 件は「割当を変えず報告へ記録する」形での採用＝中-2 / 中-6） |
| 低の採否 | **5 件採用 ／ 1 件不採用**（低-6。理由は下表） |
| 再レビュー往復 | **0 回**（重大 0 件のため差し戻しなし。⇒ 停止規律の上限には達していない） |
| `followup-backlog.md` §J 停止時記録 | **不要**（未解消の指摘が無いため） |

**★レビューは実バグを 2 件出した。どちらも「緑のまま間違う」型である。**

### 13.1 高（6 件・**全件採用**）

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| **高-1** | **DENY グロブが直下限定で `.gitignore` と深さが非対称。** `.env` と書くとリポジトリ直下にしか当たらず、`web/.env`（Vite の既定位置）や `docs/tmp/**` が `web/**` / `docs/**` の ALLOW を素通りする | **採用** | `manifest` の予防 DENY 5 本を `**/` 付きへ直し、`**/*.key` を追加。**レビューが挙げた 10 パスを同じ判定器で引き直し、10/10 が DENY になることを実測した。** あわせて「予防 DENY は必ず `**/` で書く」理由を manifest 本文へ書いた |
| **高-2** | **`check-migration-license.sh` の「静かな漏れ」検出が `INSERT OR IGNORE INTO` を見逃す。★既存 `migrations/000007` が実際に使う形である** | **採用** | 正規表現を `INSERT OR <句> INTO` / `REPLACE INTO` / `UPDATE OR <句>` / スキーマ修飾 / 引用符つき表名へ拡張。**self-test の陽性対照を 1 形 → 6 形へ増やした。** レビューが挙げた 4 形を実物のマイグレとして置き直し、4/4 が赤になることを実測した |
| **高-3** | **完了報告 §0 の完了条件 9「`progress-log.md` へ追記＝達成」が事実と食い違う**（報告内でも §10.2 が「Phase D で行う」と書いており自己矛盾） | **採用** | §0 の当該行を「**★Phase D で実施する**（索引行はレビュー結果を参照するため Phase C の後にしか書けない＝`D-510`）。**⇒ 本報告を書いた時点では未追記である**」へ是正。§10.2 の `check-progress-log-index` も「違反 2 件。うち 1 件は本サブ由来」へ是正 |
| **高-4** | **`check-md-emphasis` を「本サブ由来ではない」とした論証が失効している。** 完了報告自身が走査範囲に入り 41 行を寄与している | **採用** | §10.2 を書き直した。**機序＝報告を書いた時点では真だったものが、報告自身をコミットした時点で偽になった**（`docs/progress/` は走査範囲）。**⇒ 「自分の成果物が検査対象に入る」ことを勘定に入れていなかった。** 内訳を実測（本サブ 58 行 ／ それ以外 972 行）。**★58 行のうち 56 行は「フェンス内のグロブ」に対する偽陽性であることを機械判定で示し、真の閉じない強調 2 行は修正した** |
| **高-5** | **`README.txt` がリリース zip に同梱されないファイルを「同梱の」と書いている**（zip の中身は `.exe` ＋ `README.txt` だけ） | **採用** | `README.txt` の文面を「公開リポジトリの本バージョンのタグにあります」へ直し、**「本 zip に入っているのは実行ファイルと本 README.txt だけです」を明記**。**★同梱物を増やすかどうかは §9.3-7 の開発者手番として立てた**（`DES-002` §11.2 の配布物定義に関わるため） |
| **高-6** | **`CONTRIBUTING.md` が、公開スナップショットに存在しない `docs/seed-data/` を手順書の在り処として案内している** | **採用** | 参照を `character_data/` の測定記録へ差し替え、**「詳細な入力手順書は公開物に含まれていない」ことと、その理由・問い合わせ経路を明記**。**★DENY を外すかどうかは `M26-03`（`A3`）の再判定と連動するため触っていない** |

### 13.2 中（6 件・**全件採用**）

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 中-1 | `REUSE.toml` が `precedence` を明示しておらず、既定 `closest` では**ファイル内の SPDX ヘッダが宣言に勝つ**。自前実装はそれをモデル化していない | **採用（案 a）** | 全 5 表へ `precedence = "override"` を付けた。**`D-702` (f)「パス単位の宣言に集約する」方針と一致し、自前解決器とも一致する。★実測で「追跡ファイル中のコロン形 SPDX タグは 1 件のみ、それも本文中の説明」を確認**（§3.4 の注記）。同 1 件は §11-1 の具体的な不一致候補として記録した |
| 中-2 | `docs/handover/**` → MIT が、`D-672` の「層 B ＝ SF6 の事実そのもの」に当たる文書（`SF6セットプレイ-ドメイン知識集成.md` 等）を層 C に落としている | **採用（記録として）** | **§3.6 を新設して設計卓の論点に立てた。★割当は変えていない**——§7 暫定案は `docs/handover/` を層 C と明示して承認されており、**ここから外すのは承認の範囲を超える**（指示書 §4-5）。向きは MIT → CC BY-SA へ後から締め直せる側である |
| 中-3 | `--list` / `--list-excluded` が判定器の `exit 2` を握り潰し、生成側の失敗検知が発火しない | **採用** | `rc=${PIPESTATUS[0]}` で受け、**実行エラー(2)だけを伝播**させる形へ（違反あり(1)は一覧としては正常なので 0 に畳む）。**壊れた manifest を渡して `exit=2` になることを実測した** |
| 中-4 | `archive-backlog-not-processed` / `repo-folder-structure-cleanup` への応答が薄く、「見て何も無かった」のか「見ていない」のか読み取れない | **採用** | §8.2 を書き直し、`followup-backlog.md:1136-1137` の**具体名 3 件に個別に応答**した。**3 件とも「見たが、本サブの射程では動かせない」であり、「見ていない」ものは無い** |
| 中-5 | `NOTICE` が未確認の公開リポジトリ URL を「対応ソースの入手先」として断定している | **採用** | `NOTICE` §4 へ「★開設予定 ／ 到達確認はできていない ／ 公開の手番で必ず突き合わせること」を明記。§11 の「確かめられなかったもの」へも 1 行足した |
| 中-6 | `docs/seed-data/**` に自分の著作権表示と CC BY-SA を宣言しているが、同ディレクトリは「公式の生フレーム値・元データ抜粋を含む」ため整合しない | **採用（記録として）** | `REUSE.toml` の当該表へ「**著作権表示は暫定である。`M26-03`（`A3`）で再判定すること**」を注記。**★公開物には出ない（DENY）ため実害は無い。割当自体は §7 暫定案の承認範囲なので変えていない** |

### 13.3 低（6 件・**5 採用 / 1 不採用**）

| # | 指摘 | 採否 | 対応・理由 |
|---|---|---|---|
| 低-1 | `check-migration-license.sh` に到達不能な `if False else` 分岐 | **採用** | 削除（`CLAUDE.md` §4「不要なコメントアウトコードは削除する」） |
| 低-2 | シンボリックリンクが選別も検査も素通りする（`find -type f`） | **採用** | 検査・生成の両方を `\( -type f -o -type l \)` へ。**現在の追跡シンボリックリンクは 0 件（実測）であり、将来 1 本入ったときの穴を塞ぐもの** |
| 低-3 | 報告の実測値 2 件が現状と食い違う（検査 13 件 → 14 件 ／ md-emphasis 981 行 → 実測） | **採用** | 両方是正。**★あわせて「981」という数字自体が誤っていた**（`--list` のヘッダ 9 行を差し引いていなかった）ことが分かり、正しい着手基点の値 **972** へ是正した（§10.2 の注記） |
| 低-4 | 例示連番 `000104` が「次に使える番号」と読まれうる（4 か所） | **採用** | `REUSE.toml` / `CONTRIBUTING.md` / `check-migration-license.sh` / §5.1 / §7 素案の例示を `NNNNNN` 形へ。**★破壊確認の実走ログ（§5.4）は実際に打ったコマンドなので `000104` のまま残し、直後に「連番は消費していない／次は `000106`」を明記してある** |
| 低-5 | `.env.example` が `DENY .env.*` に当たる（現在 0 件） | **採用** | manifest の理由列へ「**`.env.example` にも当たる。置くことになったらここを見直すこと**」を追記 |
| **低-6** | `README.md:13` の Go 版数（`1.22 以上 / devContainer は 1.26.2`）が `go.mod:3`（`go 1.26.4`）と食い違う | **★不採用（報告のみ）** | **理由: 本サブの射程外である。** 当該行は着手基点から在り、本サブは触っていない（レビュー自身も「本サブの欠陥として数えない」としている）。**`README.md` を触った機会に便乗して直すと、本サブの差分に本サブと無関係な変更が混ざる。⇒ §9.3-8 に開発者の手番として記録した** |

### 13.4 レビューが「良かった点」として挙げたもの

- 割当がレビュー表と**ファイル単位で 1 対 1 一致**していること（レビュー側でも機械照合された）。層が割れる 3 本も表どおり層 B。
- **指示書・チェックリストの失効 3 件を黙って合わせず報告したこと**——レビュー側の独立実測でも 3 件とも製造側が正しかった。
- **表外 23 本と `docs/seed-data/` で止まって承認を取ったこと。**
- レビューは **REUSE 仕様の一次情報を独立に取得し、報告 §6.2 の 11 項目の逐語を全数照合して一言一句一致を確認**した。あわせて**既定を末尾へ動かす模擬で 204 ファイル全部が AGPL に倒れること**と、**凍結表照合がそれを赤にすること**を実証した。

---

*以上、M26-02 完了報告。*
