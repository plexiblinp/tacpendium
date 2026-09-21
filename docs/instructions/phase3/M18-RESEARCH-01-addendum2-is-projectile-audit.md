# 指示書 M18-RESEARCH-01-addendum2: 全 is_projectile 監査（seed 前是正のための取りこぼし洗い出し）

| 項目 | 内容 |
|------|------|
| 種別 | read-only データ品質監査（addendum #1 のスコープ拡張・事実列挙のみ） |
| 内部版 | v1.0.0 |
| 配置 | 指示書＝`docs/instructions/phase3/M18-RESEARCH-01-addendum2-is-projectile-audit.md`／レポート＝`docs/progress/phase3/M18-RESEARCH-01-addendum2-report.md` |
| 使用モデル | **Sonnet 4.6**（read-only・judgement-free） |
| 採番 | **マイグレ連番・CHANGE 番号を消費しない** |
| 由来 | 開発者確認（2026-07-19）＝kimberly `shuriken_bomb_*`・juri saihasho ファミリーは飛び道具で is_projectile=true が正（入力ミス）。**addendum #1 は recovery=0 に限定していたため、recovery≠0 の飛び道具の取りこぼしを網羅できていない**。seed 前是正のため全 is_projectile を監査する |

---

## 0. 特殊性（厳格運用）
- 製造担当を Sonnet 4.6 で起動 → §2 の列挙 → §3 レポート → クローズ。
- **read-only 厳守**（`character_data/*.csv` と dev DB を SELECT/parse のみ・書込ゼロ）。**判断・是正はしない**（是正は開発者がデータ側で行う）。事実列挙と**名称ヒューリスティックのフラグ**のみ。

## 1. 目的
`character_data/*.csv` の **is_projectile 全値**を対象に、**入力ミス候補を両方向で洗い出す**：
- **取りこぼし候補**: `is_projectile=false` なのに**名称が飛び道具を示唆**する技（＝false-negative。saihasho/shuriken_bomb の類）。
- **逆方向候補**: `is_projectile=true` なのに**名称が飛び道具らしくない**技（＝false-positive）。
recovery の値は問わない（addendum #1 の recovery=0 限定を外す）。

## 2. 調査項目
1. **全 is_projectile の集計**: `character_data/*.csv` 全 12 ファイルで is_projectile=true / false の件数（キャラ別・category 別）。
2. **取りこぼし候補（false かつ飛び道具っぽい）**: is_projectile=false の技のうち、`move_code`／`official_ja`（あれば）が飛び道具を示唆するものを列挙。**示唆語の例**（heuristic・網羅でなく手掛かり）: `hadoken`・`sonic`・`kachousen`・`shuriken`・`bomb`・`saihasho`・`fuha`・`shot`・`wave`・`ball`・`arrow`・`spark`・`fireball`・`projectile`・「弾/波/衝/把/拳（飛び道具系）」等。**該当技を全件列挙**（character/code/category/is_projectile/recovery/on_block）。
3. **逆方向候補（true かつ飛び道具らしくない）**: is_projectile=true の技のうち、名称が打撃/移動/設置に見えるものを列挙（過検出でよい・開発者が判断）。
4. **saihasho / shuriken_bomb ファミリーの全 variant 確認**: juri の saihasho 系（`fuha_saihasho` 含む・ノーマル/OD 等の全 variant）と kimberly の `shuriken_bomb_*` 全 variant を列挙し、**現状の is_projectile 値**を明示（開発者確定分＝全て true が正、の突合用）。

> **judgement-free**: 「これは飛び道具だ/違う」の断定はしない。**名称からの候補提示のみ**。最終是正判断は開発者。

## 3. 報告様式（`M18-RESEARCH-01-addendum2-report.md`）
- is_projectile=true/false の件数（キャラ別・category 別）。
- **取りこぼし候補（false×飛び道具っぽい）全件列挙**（character/code/category/recovery/on_block）。
- **逆方向候補（true×非飛び道具っぽい）全件列挙**。
- **saihasho / shuriken_bomb 全 variant の現状 is_projectile 値**。
- ヒューリスティックの限界を明記（名称に現れない飛び道具は取りこぼす旨）。

## 4. 完了条件
- 全 is_projectile を集計し、両方向の候補を実値で列挙。
- 開発者が **seed 前に is_projectile を一括是正**できる粒度でそろう。
- read-only 逸脱なし（作成は report のみ）。

## 7. 参照
addendum #1 report（recovery=0 の 18 件・既出）／M18-RESEARCH-01-report（is_projectile=true 102 件）／`character_data/*.csv`。開発者確定＝shuriken_bomb・saihasho ファミリーは true が正。

*以上、read-only 監査。連番・CHANGE 非消費。是正はデータ側で開発者が実施。*
