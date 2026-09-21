# 指示書 M18-RESEARCH-01-addendum: 非 projectile の recovery=0 技の列挙（データ品質チェック）

| 項目 | 内容 |
|------|------|
| 種別 | read-only データ品質チェック（M18-RESEARCH-01 の追補・1 問のみ） |
| 内部版 | v1.0.0 |
| 配置 | 指示書＝`docs/instructions/phase3/M18-RESEARCH-01-addendum-recovery-zero-nonprojectile.md`／レポート＝`docs/progress/phase3/M18-RESEARCH-01-addendum-report.md` |
| 使用モデル | **Sonnet 4.6**（read-only・judgement-free） |
| 採番 | **マイグレ連番・CHANGE 番号を消費しない** |
| 由来 | 開発者決定 #5（recovery=0 の条件付き承認）＝「is_projectile 以外で recovery=0 の技があるか確認し、あればデータ修正を検討」 |

---

## 0. 特殊性（厳格運用）
- 製造担当を Sonnet 4.6 で起動 → §2 の列挙 → §3 レポート → クローズ。
- **read-only 厳守**（`view`/`grep`/SELECT のみ。dev DB は SELECT のみ・書込ゼロ）。判断・提案を含めない（事実列挙のみ）。

## 1. 目的
G-b の JP 有利算出は「非 projectile の recovery=0 は有効値 0 として扱う」方針（プラン §2.4）。この方針の妥当性確認のため、**is_projectile=false かつ recovery=0 の技が存在するか、存在するなら全件を列挙**する。is_projectile は現行 DB 未投入のため `character_data/*.csv` の is_projectile 列と DB の recovery を突合する。

## 2. 調査項目
1. **DB 側**: `moves` で `recovery = 0` の技を全列挙（`character_id`・`code`・`category`・`recovery`・`on_block`）。母数（recovery=0 の総数）も報告。
2. **CSV 突合**: 各技を `character_data/{character}.csv` の該当行の `is_projectile` 列と突合し、**`is_projectile=false かつ recovery=0`** の技のみを抽出。
   - 参考骨子:
     ```sql
     SELECT m.character_id, m.code, m.category, m.recovery, m.on_block
     FROM moves m WHERE m.recovery = 0
     ORDER BY m.character_id, m.category, m.code;
     ```
   - 上記結果を CSV の is_projectile と突合（DB に is_projectile 列が無いため CSV 経由）。
3. **内訳**: 抽出結果を category 別・キャラ別に集計。**recovery=0 が「妥当（実測値）」か「疑わしい（データ誤りの可能性）」かは判断しない**（事実列挙のみ。判断は開発者）。

## 3. 報告様式（`M18-RESEARCH-01-addendum-report.md`）
- recovery=0 の総数（DB 全体）。
- **is_projectile=false かつ recovery=0 の技の全件列挙**（character/code/category/on_block）。
- category 別・キャラ別 件数。
- CSV に is_projectile 列が無い/欠損の技があれば「未確認」明記。

## 4. 完了条件
- 上記を実値で報告。read-only 逸脱なし（作成は report のみ）。
- 「非 projectile の recovery=0 が何件・どの技か」が開発者のデータ修正判断に使える粒度でそろう。

## 7. 参照
M18-RESEARCH-01-report（is_projectile=true 102 件・recovery=0 が 57 件は projectile 側の既報）／code-facts（`5d0cba1`）／`character_data/*.csv`。

*以上、read-only 追補。連番・CHANGE 非消費。*
