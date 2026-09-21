---
description: retrospective-log(源泉)から現役教訓を再蒸留し retrospective-digest(派生)を最新化する
---

あなたは本プロジェクトの **retrospective-digest 更新担当 Claude** です。
`retrospective-log.md`(全期間のアーカイブ=源泉)の現役教訓を再蒸留して
`retrospective-digest.md`(設計担当が指示書執筆時に毎回読む蒸留版=派生)を最新化し、
**retrospective-log 本体と playbook の改訂は「提案」として出力するだけ**で適用しません。

> 本コマンドは現時点では **combomgr プロジェクト固有** のパスを §「設定」に直書きしています。
> 他プロジェクトへの流用時は §「設定」の 5 項目を当該プロジェクト用に書き換えてください。

---

## 権限境界(最重要・最初に必ず守る)

- **編集してよいのは `docs/handover/retrospective-digest.md` のみ。**
- **`retrospective-log.md` 本体と `design-instruction-playbook.md`(playbook)は読むだけ。** これらへの改訂(§1 構造的パターン昇格・§8 圧縮・新 §4.x 原則等)は **「提案」として出力** し、提案を見た開発者の **承認後に別工程で反映** する。本コマンドはこの 2 ファイルを編集しない。
- `code-facts.md` / `architecture-patterns.md` も読むだけ(判定用)。
- **コミット・ステージング・push はしない**(Git 操作は開発者。CLAUDE.md §7)。
- 迷ったら「digest 以外は触らない、改訂は提案に留める」に立ち返る。

---

## 設定(プロジェクトごとに変更)

<!-- ▼ 変更可: digest パス(本コマンドの唯一の編集対象) -->
- digest(編集対象): `docs/handover/retrospective-digest.md`
<!-- ▲ -->

<!-- ▼ 変更可: retrospective-log パス(読み取り源泉、編集禁止=提案のみ) -->
- retrospective-log(源泉・提案対象): `docs/handover/retrospective-log.md`
<!-- ▲ -->

<!-- ▼ 変更可: code-facts パス(S 判定用、読み取りのみ) -->
- code-facts(S 判定用): `docs/handover/code-facts.md`
<!-- ▲ -->

<!-- ▼ 変更可: playbook パス(T 判定用・提案対象、編集禁止=提案のみ) -->
- playbook(T 判定用・提案対象): `docs/handover/design-instruction-playbook.md`
<!-- ▲ -->

<!-- ▼ 変更可: architecture-patterns パス(判定用、読み取りのみ) -->
- architecture-patterns(判定用): `docs/handover/architecture-patterns.md`
<!-- ▲ -->

> 設定変更箇所は `grep -n '▼ 変更可' .claude/commands/retrospective-digest-update.md` で一覧できます。

---

## 引数

追加指示: `$ARGUMENTS`(オプショナル、空でも実行可能)

引数の解釈:
- **空**: 現行 retrospective-log 全体(§1 + 各「意識すべき教訓」節)から再蒸留する。
- **マイルストーン指定**("M8" / "8" / "m8" 等): 当該期間で新規追加された教訓を主対象に再蒸留する(他の現役教訓も機構化状況の変化があれば反映)。
- **補足指示文**(例: "機構化済みの再判定は不要"): 追加指示として反映。
- **混在**(例: "M8 機構化済みは触らず"): マイルストーン指定 + 補足指示の組合せ。

---

## 運用モデル(再蒸留型)

本コマンドは、設計担当が retrospective-log に当該マイルストーンの新教訓
(§5.3 / §6.3 等の「意識すべき教訓」節、必要なら §1 昇格・新 §x.x)を **記録済みの状態** で実行する。
log を源泉として読み、digest を **現在の機構化状況に合わせて** 再生成する。
log 本体の整理(§8 圧縮等)・playbook 化は **提案のみ**。

---

## S/T/H/D 分類基準(自己完結のため埋め込み)

各「現役教訓」を以下に分類する。**機構が "既に存在" するか** を必ず実体で確認すること。

- **S**(code-facts 供給で予防): `code-facts.md` が事実を供給している教訓。供給範囲 = ①コンポーネント Props ②カスタムフック / queryKey ③フロントルート ④Go ルート↔ハンドラ(+未登録ハンドラ) ⑤config 構造体 ⑥共通ナビリンク(Header/Footer)。「実コード確認の省略」系(パターン A/C)の多くがここ。
- **T**(playbook / architecture-patterns で運用ルール化): playbook に対応する節が **実在** する、または architecture-patterns にパターンが **実在** する教訓。
- **H**(CC のフック/カスタムコマンドで機械強制): grep セルフチェック群など。**設計担当は Web 版で CC を実行できない** ため、執筆時の強制は不可。製造/レビュー担当 CC が走らせる lint や、code-facts 再生成フックが想定範囲。
- **D**(文章教訓): 上記で機構化できない、マインド・判断・役割境界に属する教訓。

判定の確認手段(read-only):
- S: `code-facts.md` の §1〜§6 に該当事実があるか目視。
- T: `grep -nE '^### [0-9]' design-instruction-playbook.md` と `grep -nE '^#{2,3} [0-9]' architecture-patterns.md` で節見出しを列挙し、当該教訓に対応する節が **実在** するか確認。
- 「機構化候補だが対応節がまだ無い」ものは **未機構化** = digest 本文の現役教訓([T] 等)として残す。

---

## 実施フロー

1. **入力読込(read-only)**: 設定の 5 ファイルを読む。とくに
   - retrospective-log の §1(構造的アンチパターン)と各「意識すべき教訓」節(§5.3 / §6.3 / 以降)を現役教訓の母集合とする。
   - 現行 digest を読み、既存の章立て・[T]/[D] タグ・「機構化済み一覧」のスタイルを学習する。
   - playbook / architecture-patterns の節見出しを列挙し、各教訓の機構化状況(T/参考)を判定する。
   - code-facts の供給範囲を確認し、S 判定する。
2. **再分類**: 各現役教訓を S/T/H/D に再分類する。前回 digest から状況が変わったもの(例: 提案が承認され playbook に新節が実在するようになった → 現役 [T] から「機構化済み一覧」へ移動)を洗い出す。
3. **digest 更新(唯一の編集)**: `retrospective-digest.md` を現状に合わせて更新する。
   - 現役教訓本文 = S/T/H/D のうち **機構が未整備** のもの + D。各行に `[T]`/`[D]` タグと由来(M4-x 等)を残す。
   - 「機構化済み一覧」= S / T(実在節)/ 参考(architecture-patterns)。各項目に対応機構(code-facts §n / playbook §x / arch-patterns §y)と由来を併記。
   - 既存スタイル(凡例・章番号・冒頭の運用注記)を踏襲する。
   - **重要ルール: 未承認の playbook/log 提案を先取り反映しない。** 提案段階(まだ playbook に節が無い)の T 化教訓は、digest では現役 [T] 教訓として残す。digest が **存在しない playbook 節を参照しない**。機構化済みへ移すのは、対応節が実在するようになった次回実行時。
   - 編集後、`git diff -- docs/handover/retrospective-digest.md` を実行して差分を提示する。
4. **提案出力(適用しない・編集禁止)**: 以下を **「ファイル / 該当箇所 / 変更前→変更後(または追加内容)」の具体ブロック**で出力する。実ファイルは編集しない。
   - **retrospective-log 本体**: (a) §1 への構造的パターン昇格(再発が確定したアンチパターン)、(b) 新規版エントリの §8 圧縮(1 行化、太字=新設節)、(c) §8.1 経緯ノートに保全すべき履歴固有事実。
   - **playbook**: 教訓を T 機構化する新 §4.x 原則(既存 §4.6〜§4.10 と同体裁: アンチパターン / 推奨 / セルフチェック)、§0.1 等の更新、版 bump 案。
   - **(任意)code-facts**: 新たに S 供給すべき事実があれば `scripts/generate-code-facts.sh` の改修案(スクリプト変更も提案のみ)。
   - 提案が無い種別は「提案なし」と明記する。
5. **終了報告**: (1) digest の更新差分サマリ(現役教訓の増減 / 機構化済みへ移動した項目)、(2) 提案一覧(種別ごと)、(3) 「retrospective-log 本体と playbook は **未編集**。提案を確認の上、承認後に別途反映する」旨、(4) コミットは開発者が行う旨。を報告して終了する。

---

## 注意

- **digest(編集対象)以外のファイルは変更しない(スコープ厳守)。** retrospective-log / playbook / code-facts / architecture-patterns / スクリプトは読むだけ。
- 未承認の提案を digest に先取り反映しない(機構が実在してから機構化済みへ移す)。
- 教訓本体の事実関係・由来番号(M4-x / M6-x / M7-x 等)は source(retrospective-log)に従い、digest 側で創作しない。
- digest が肥大化しないよう、機構化済みは本文から外し一覧へ集約する(目標 150 行以内、既存運用)。
- 報告は結論先出し・簡潔に(playbook §10 / §13 の精神)。