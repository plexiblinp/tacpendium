# M14-03a 設計担当への伝達メモ(前提破綻の確認・recovery backfill の M14-03b 移設)

| 項目 | 内容 |
|------|------|
| 対象サブ | M14-03a(画面18 E2E 再有効化 ＋〔当初〕recovery backfill) |
| 起票者 | 製造担当 Claude / 2026-07-01 |
| 宛先 | 設計担当 Claude(M14 担当) |
| 指示書版 | v1.0.1(製造 Plan Mode の指摘を受け設計担当が是正済み) |
| 根拠 | 指示書 §3.4-1/-2・§9.3、実マイグレ 000017、`migrate_test.go` |

> 本メモは製造 Plan Mode で確認した前提破綻と、本サブの実施範囲・残扱いを申し送るもの。REQ/DES 本体は製造は編集しない(CLAUDE.md §8)。

---

## 1. 製造 Plan Mode で確認した前提破綻(v1.0.1 で是正済み)

指示書 v1.0.0 §3.2/§1.4 は recovery backfill 対象に **ryu/aki/jamie/guile** を挙げていたが、実コードと矛盾していた:

- **aki/jamie/guile は HEAD に存在しない**。`000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` が
  ajg の characters・moves・combos・preset_aliases を(FK=OFF 下で)依存順に明示 DELETE 済み。
  `migrate_test.go` の `TestRun_SeedRowCounts` も「ajg removed in 000017」を前提に `super_art = 3(ryu のみ)`・
  `moves >= 30(ryu seed のみ)` を検証している。
- **HEAD の moves = ryu の 56 技のみ**(すべて `recovery = NULL`。M14-01/000018 は列追加のみ)。
- ryu 分の recovery 手入力値も本サブ着手時点で未受領。

→ 設計担当が指示書 **v1.0.1** で是正: recovery backfill(当初 a 分の ryu/ajg)を **M14-03b へ移設**し、
   全 recovery 入力を b の seed 作業へ集約。本サブは **画面18 E2E 再有効化のみ**(完全に手入力非依存)、
   seed マイグレ **000019 は作らない**。本メモは実コード確認の監査証跡として保持する。

## 2. 本サブ(M14-03a)の実施範囲

- `web/e2e/moves-edit.spec.ts` を **import 非依存**へ書き換え、`test.describe.skip` を解除。
  編集対象は取込画面(削除済み)ではなく **既存 seed の ryu 技**(migrations 000004・56 技)。
  `GET /api/games/1/characters` → `GET /api/moves?character_id=<ryu>` で対象行を取得する
  (combo-csv-io.spec.ts と同じ API 起点)。
- 検証: recovery(硬直・M14-01 追加列)を NULL から設定・total も手入力 → 保存 → GET 反映、
  および対象技のラッシュ版生成 → GET/グリッド反映。
- 冪等性: 対象は id 昇順先頭の 1 技に決め打ち。共有 seed 行の recovery/total を永続変更し rush 版を 1 件生成するが、
  再実行時は同じ行を操作し rush は「既存」(UI が 409 を info 化・CHANGE-032)で握られる。GET 最終状態を toPass で検証。
- Go テスト・マイグレは不変(000019 を作らないため `dbtest.Setup` 波及なし)。

## 3. 設計担当への依頼(followup-backlog §C-1)

- **`M14-03a-e2e` は解消**(本サブで画面18 E2E を import 非依存で再有効化)。
- **`M14-03a-backfill`(recovery backfill)は本サブ未実施 → M14-03b へ移設済み**(v1.0.1)。
  ryu を含む全 recovery 手入力値は M14-03b の seed 作業で投入する前提。§C-1 の記述を v1.0.1 に整合させたい。
- backfill 移設に伴い、当初 §3.4-3(total 整合)・§3.4-4(000019 技法)・§5.1(Go テスト)は M14-03b で扱う。

---

*以上。本メモは進捗ログとともに監査証跡として保持する。*
