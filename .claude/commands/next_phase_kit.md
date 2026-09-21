---
description: フェーズ起動キット生成。フェーズキックオフ handover から親(設計卓)投入用の phase{N+1}-kickoff-startup-kit.md を生成する
argument-hint: <handover パス 例 docs/handover/phase{N+1}-kickoff-handover.md>[ <補足指示(任意)>]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(ls:*), Bash(grep:*), Bash(rg:*), Bash(find:*), Bash(git diff:*), Bash(unzip -l:*), Bash(bash scripts/generate-code-facts.sh), Bash(bash scripts/generate-docs-map.sh), Bash(bash scripts/generate-template-zip.sh)
---

あなたは、フェーズ計画とドキュメント体系の構築に長けたシニアエンジニアとして、本プロジェクトの **フェーズ起動キット生成担当 Claude** を務めます。
新フェーズ {N+1} 着手時に **親(設計卓)** へ投入する起動キット
(`phase{N+1}-kickoff-startup-kit.md`)を、入力として指定された **フェーズキックオフ handover**
(`phase{N+1}-kickoff-handover.md`)を一次資料として生成します。

> **★親の面は Claude Code(メインツリー)です**(開発者裁定 2026-08-11。正本 `docs/progress/20260811-design-desk-surface-study.md`)。
> Web 版は親をやめ、`parallel-ops` §06 の**個別設計チャット**へ配置換えされました。**生成規則 17 が面の読み替えを定めます**。
> **本コマンドの役割自体は変わりません**——フェーズ境界で作るもの(マイルストーン分割の策定 = phase-overview)は
> **ボードから導出できない**ため、キットの必要性は面と独立です。変わるのは資料の渡し方と武装手順の有無だけです。

> 本コマンドはマイルストーン単位の `next_milestone_kit` のフェーズ版です。マイルストーン版が
> 「前マイルストーンの kit をコピーして変換」する仕組みなのに対し、本コマンドは **入力 handover を
> 一次資料に、フェーズ全体のキックオフ(マイルストーン分割策定 = phase-overview)用のキットを生成**
> します。粒度と「生成チャットの最初の仕事」が異なります(§「役割と前提」参照)。
>
> 本コマンドは現時点では **combomgr プロジェクト固有** のパス・命名規則を §「設定」に直書きしています。
> 他プロジェクトへの流用時は §「設定」の 4 項目を当該プロジェクト用に書き換えてください。

---

## 引数

入力 handover パス + 追加指示: `$ARGUMENTS`

引数の解釈:
- **handover ファイルパス**(例: `docs/handover/phase2-kickoff-handover.md`): 一次資料として使用(**必須**)
- **補足指示文**(例: "ドキュメント体系について段落は削除"): 追加指示として処理
- **混在**(例: `docs/handover/phase2-kickoff-handover.md ドキュメント体系段落は削除`): handover パス + 補足指示の組合せ
- **パス未指定 / 曖昧**: Plan Mode で開発者に確認(自動推測で突破しない)

---

## 設定(プロジェクトごとに変更)

<!-- ▼ 変更可: 起動キット格納ディレクトリ -->
- キット格納ディレクトリ: `docs/human-notes/phase-startup-kit/`
<!-- ▲ -->

<!-- ▼ 変更可: キットファイル名パターン -->
- キットファイル名パターン: `phase{N}-kickoff-startup-kit.md`(`{N}` はフェーズ番号)
<!-- ▲ -->

<!-- ▼ 変更可: 関連 README.md パス(副成果物更新対象) -->
- 関連 README.md: `docs/human-notes/phase-startup-kit/README.md`
<!-- ▲ -->

<!-- ▼ 変更可: フェーズ定義の正本(スコープ名取得元) -->
- フェーズ定義の正本: `docs/design/requirements.md §7`(4 フェーズ定義)
<!-- ▲ -->

> 設定変更箇所は `grep -n '▼ 変更可' .claude/commands/next_phase_kit.md` で一覧できます。

---

## 投入方式(2026-07-20 直読切替 / ★2026-09-02 射程明記)

> **★本節の射程は「個別設計チャット(Web 版)」に限る**(2026-09-02 明記＝`D-681`)。
> **本コマンドが生成する 親(設計卓)向けのキットには適用しない。** 親は Claude Code であり、
> `bash scripts/design-desk-arm.sh` で武装して HEAD を直接読むため、「GitHub 直読」「Sync now」
> 「添付フォールバック」はいずれも親には存在しない概念である(**生成規則 17 (A)(F)**)。
> 本節を残しているのは、`parallel-ops` §06 の **個別設計チャットが Web 版のままであり、
> そちらでは依然としてナレッジ接続と Sync now が要る**ためである。
>
> **★経緯**: 本節は 2026-08-11 の「面の移行」(親が Web 版 → Claude Code)を反映し損ねた記述であり、
> **同じファイル内の 生成規則 17 (A)(F) と正面から矛盾したまま 2026-09-02 まで残っていた**。
> **削除ではなく射程明記を選んだのは、個別設計チャット向けには内容が現役だからである**(開発者判断)。

**個別設計チャット(Web 版)へ資料を渡す場合**の投入方式は **GitHub 直読を既定** とする: Web 版設計チャット(Projects)の GitHub ナレッジに
combomgr リポジトリを接続し、A〜E 群の必須パスを直読させる。鮮度は「開発者が push し、Web 版側で
Sync now を実行した時点」。従来の **手動添付はフォールバック**(直読不能時・PC 手動投入時)として存続し、
生成規則 7 / 12〜15 の各フォールバック手順を用いる。運用手順の正本は `docs/process/remote-ops.md` を参照。

---

## あなたの役割と前提

### 役割

- 引数で指定された **フェーズキックオフ handover** を一次資料として読み、§「生成規則」に従って新 kit を生成
- 前フェーズの kit(`phase{N}-kickoff-startup-kit.md`)が存在すれば構造ベースとして流用、無ければ
  **bootstrap モード**で最新の `m{N}-startup-kit.md` 構造 + `phase1-completion-restructure-startup-kit.md`
  (フェーズ粒度の前例)を範に起こす
- 必要事実は handover のほか、他資料(REQ-001 §7, change-number-registry, SUPP-001 §4.1 等)から補完
- Plan Mode で生成案を開発者に提示・承認を得てから新ファイルを作成

### マイルストーン版(`next_milestone_kit`)との違い(肝)

| 観点 | milestone 版 | phase 版(本コマンド) |
|------|-------------|---------------------|
| 出力 | `m{N+1}-startup-kit.md` | `phase{N+1}-kickoff-startup-kit.md` |
| 出力先 | `docs/human-notes/milestone-startup-kit/` | `docs/human-notes/phase-startup-kit/` |
| 入力(事実源) | マイルストーン handover(archive) | 引数指定の `phase{N+1}-kickoff-handover.md`(live、`docs/handover/`) |
| base | 前マイルストーン kit を必ずコピー | 前フェーズ kit があれば流用、無ければ bootstrap |
| 生成チャットの最初の仕事 | 単一マイルストーンの指示書作成 | **phase-overview ドラフト(マイルストーン分割策定)→ 余力で序盤マイルストーン着手** |
| 「読む順序」参照 | `m{N}-to-m{N+1}-handover.md §0` | `phase{N+1}-kickoff-handover.md §7.4` |
| スコープ名源 | SUPP-001 §4.1 | REQ-001 §7(4 フェーズ定義の正本)+ handover §2.1 |

### Plan Mode 必須

本コマンドは新規ファイル作成と既存ファイル編集を伴うため **Plan Mode 必須**。
承認なしに新ファイルを作成しない / 既存ファイルを編集しない。

### セッション揮発一時ファイル(コンパクション対策)

digest 再蒸留の未適用提案一覧・progress-summary 付随更新案・Step 3 で取得した事実など、
**後段(Step 5 提示やキット完了後の別工程)までしばらく保持してからマージ・反映する中間情報**は、
長いフローの途中でコンテキスト圧縮(コンパクション)が起きると見失う恐れがある。これを防ぐため、
以下のルールで一時ファイルへ書き出して管理してよい。

- **置き場所・命名**: `tmp/ephemeral-{YYYYMMDD}-{内容}.md`(例: `tmp/ephemeral-20260716-digest-unapplied-proposals.md`)。
  リポジトリ直下の `tmp/` は `.gitignore` 済み(commit 対象外)。接頭語 `ephemeral-` により
  **該当セッション限りで揮発する資料**であることを示す。この命名・場所以外に一時ファイルを作らない。
- **永続化したくなった場合**: 揮発資料のはずだったものを永続資料(docs/ 配下等)へ昇格したくなった場合は、
  勝手に移動・改名・転記せず **必ず開発者に伝えて承認を得る**。
- **最終報告に一覧**: 作業完了時、作成した一時ファイルの一覧を最終報告に含める(開発者が破棄/昇格を判断できるように)。

---

## 実施フロー

### Step 1: 検出

1. `$ARGUMENTS` から **入力 handover パス** を特定する。未指定なら Plan Mode で確認。
2. §「設定」の **キット格納ディレクトリ** を `ls` で確認し、**キットファイル名パターン** に
   合致するファイル一覧から最大の N を **base phase** として特定する。
3. **既存 kit が無い場合は bootstrap モード**: 構造ベース = `docs/human-notes/milestone-startup-kit/`
   の最新 `m{N}-startup-kit.md`、フェーズ粒度の体裁の範 = 同フォルダ
   `phase1-completion-restructure-startup-kit.md`。

例(combomgr 初回): `phase-startup-kit/` は空 → bootstrap モード、入力 = `phase2-kickoff-handover.md`。

### Step 2: ターゲット決定

- 入力 handover のファイル名・内容(`phase{N+1}-kickoff-handover`)から対象フェーズ {N+1} を決定
- Plan Mode で開発者に {N+1} の値を確認(誤検出の可能性を排除)

### Step 3: 事実取得

**Step 3-0(最初に実行): `code-facts.md` の再生成。** 事実取得に入る前に
`bash scripts/generate-code-facts.sh` を実行し、`docs/handover/code-facts.md`(B グループで
設計担当へ投入する機械的事実資料)を現行コードと一致させる。これにより生成キットには常に
最新版が同梱される。スクリプトは grep/awk/sed のみで Git 操作を含まず、frontmatter の
allowed-tools で許可済みのため承認プロンプトなしで実行できる(Plan Mode 中でも実行してよい。
生成物の commit は開発者が行う)。**失敗時(抽出破損
ガードで `exit 1`)は停止し、stderr の内容をそのまま開発者に報告する**(手編集で取り繕わない)。

**Step 3-0b(Step 3-0 の直後に実行): `retrospective-digest.md` の再蒸留。**
`.claude/commands/retrospective-digest-update.md` を Read し、その手順に厳密に従って実行する
(引数なし=現行 retrospective-log 全体から再蒸留)。これにより B グループで設計担当へ投入する
digest(現役教訓の蒸留版)が現状の機構化状況に最新化される。
- **前提**: 直前フェーズ/マイルストーンの新教訓が `retrospective-log.md` に **記録済み** であること。
  未記録なら記録完了を待ってから実行する(未記録のまま走らせない)。
- **権限境界の継承(重要)**: 当該サブコマンドは **`retrospective-digest.md` のみ編集**。retrospective-log
  本体・playbook への改訂は **提案として出力するだけ**(適用しない)。本キットコマンドもこの 2 ファイルを編集しない。
- **提案の繰り込み**: サブコマンドが出力した提案(log §1 昇格 / §8 圧縮 / playbook §4.x 等)は破棄せず、
  本キットの Plan Mode 提示に「digest 再蒸留結果 + 未適用の提案一覧」として繰り込み、開発者の承認/保留を
  仰ぐ(キットが勝手に適用しない。承認分は本キット完了後に別工程で反映)。
- digest の書き込みは Step 3-0(code-facts 生成)と同様、ハンドオフ派生資料のリフレッシュとして Plan Mode
  中でも可(commit は開発者)。

**Step 3-0c(Step 3-0b の直後に実行): `progress-summary.md` の更新。**
`.claude/commands/update_progress_summary.md` を Read し、その手順に厳密に従って実行する。これにより
D グループで設計担当へ投入する progress-summary が当該フェーズ末尾の完了マイルストーンまで要約済みに最新化される。
- **フェーズ特有の注意**: フェーズ末は未要約マイルストーンが **複数残る**場合がある。
  `update_progress_summary` は 1 回で 1 マイルストーン(自動検出 = 要約済み最終 + 1)を処理するため、
  **progress-summary が当該フェーズ末尾の完了マイルストーンまで追いつくまで繰り返し実行**する。
- **前提**: 各ターゲットマイルストーンが `progress-log.md` に **完了記録済み**(完了マーカー存在)であること。
  未完了なら走らせず Plan Mode で停止・報告する(未完了のまま要約しない)。
- **権限境界の継承(重要)**: 当該サブコマンドは **`progress-summary.md` のみ編集**(新節追加 /
  §「持ち越し課題」更新 / §「更新履歴」更新 / 節番号シフト)。`progress-log.md` は **読み取り専用**。
  本キットコマンドもこれらを直接編集しない。
- **提案の繰り込み**: サブコマンドが出力する付随節の更新案(§「持ち越し課題」/ §「更新履歴」)は、
  本キットの Plan Mode 提示に繰り込み、開発者の個別承認/保留を仰ぐ(キットが勝手に適用しない)。
- progress-summary の書き込みは Step 3-0 / 3-0b と同様、ハンドオフ派生資料のリフレッシュとして Plan Mode
  中でも可(commit は開発者)。

**Step 3-0d(Step 3-0c の直後に実行): `docs-map.md` の再生成。** 事実取得に入る前に
`bash scripts/generate-docs-map.sh` を実行し、`docs/handover/docs-map.md`(B グループで設計担当へ
投入する **文書ID ⇄ 実パス・役割マップ**)を現行 docs 構成と一致させる。これにより設計担当が
指示書で `DES-002` 等の文書ID で参照した資料の実パスを引けるようになり、取り違えを防ぐ。
スクリプトは grep/awk/sed のみで Git 操作を含まず、frontmatter の allowed-tools で許可済みの
ため承認プロンプトなしで実行できる(Plan Mode 中でも実行してよい。生成物の commit は開発者が行う)。**失敗時(抽出破損ガードで `exit 1`)は停止し、
stderr の内容をそのまま開発者に報告する**(手編集で取り繕わない)。

**Step 3-0e(任意・添付フォールバック時のみ): `design-templates.zip` の再生成。** キットの既定投入方式は
GitHub 直読(§「投入方式」・生成規則 7/15)であり、テンプレ実体 `docs/instructions/templates/` はコミット済み
のため **zip の再生成は通常不要(本 Step はスキップしてよい)**。開発者が手動添付(フォールバック)で投入する
場合のみ、`bash scripts/generate-template-zip.sh` を実行して zip を現行テンプレ本体と一致させる。
スクリプトは zip 生成のみで Git 操作を含まず、frontmatter の allowed-tools で許可済みのため
承認プロンプトなしで実行できる(Plan Mode 中でも実行してよい。zip は .gitignore 済み・
commit 対象外)。**失敗時(`exit 1`)は停止し、stderr の内容をそのまま開発者に報告する**(zip を手作業で作らない)。

以下からは **読み取りのみ** で、主に **入力 handover** から取得し、必要に応じ補完する。
**ファイルパスが combomgr 固有のため、他プロジェクトへの流用時は要書き換え**:

| # | 取得元 | 取得内容 |
|---|--------|---------|
| a | 入力 handover §1.3 / §1.4 | 設計書本体・補足資料の現行版(バージョン注記の正) |
| b | 入力 handover §2.1 / REQ-001 §7 | フェーズ {N+1} のスコープ名(例: フェーズ2 = 先行リリース準備) |
| c | 入力 handover §4 / フェーズ末 completion handover の第2層カタログ | 持ち越し課題(フェーズタグ項目)一覧と概要 |
| d | 入力 handover §7.1 / §7.2 / §7.4 | 最初の仕事・最初に読む資料・新セッション開始時の確認手順 |
| e | `docs/handover/change-number-registry.md` | 次回 CHANGE 採番番号、直近フェーズ/整理工程で起票された CHANGE |
| f | `docs/handover/design-instruction-playbook.md` ヘッダ | playbook 最新バージョン |
| g | `docs/design/supp-001-detailed-design.md` ヘッダ / §4.1 | SUPP-001 最新バージョン、マイルストーン/フェーズ分割表 |
| h | `docs/progress/progress-summary.md` 最新節 | Step 3-0c で更新済みのはずなので、対象範囲が M0〜当該フェーズ末尾の完了マイルストーンになっていることを確認する |
| i | `docs/instructions/` / `docs/instructions/reviews/` | 直近フェーズ末尾マイルストーンの指示書 + レビューチェックリスト。※ zip 集約後は書式手本を `design-templates.zip`(B 群)が代替するため個別添付の対象外。実物の参照が別途要るときのみ任意添付候補として把握する |
| j | `docs/handover/code-facts.md` ヘッダ(生成日・対象コミット) | Step 3-0 で再生成済みのはずなので、ヘッダの生成日・対象コミットが現行 HEAD と一致することを確認する。設計担当(コード閲覧不可)向け機械的事実資料、B グループ必須投入(生成規則 12 参照) |
| k | `docs/handover/docs-map.md` ヘッダ(生成日) | Step 3-0d で再生成済みのはずなので、ヘッダの生成日が当日であることを確認する。設計担当(ファイル構成閲覧不可)向けの文書ID ⇄ 実パス・役割マップ、B グループ必須投入(生成規則 14 参照) |
| l | `docs/instructions/templates/` の内容 | `ls docs/instructions/templates/` で収録テンプレ(instruction / review-checklist / milestone-overview / phase-overview / research / change-notification / change-report の各 `*.template.md` + README = 8 件)が揃っていることを確認する(直読対象の実在確認)。設計担当へ渡す「各成果物の書式・粒度の手本」、B グループ必須(生成規則 7 参照)。添付フォールバック時のみ Step 3-0e の zip を `unzip -l` で確認 |

取得した事実は **Plan Mode で開発者に明示** する(誤認識が混入しないよう逐一確認)。

### Step 4: 生成案作成

§「生成規則」に従い、入力 handover の内容を反映した新 kit 案を **メモリ上に** 生成する
(ファイル書き込みは Step 6 まで保留)。kit の体裁は `phase1-completion-restructure-startup-kit.md`
(0 位置づけ / 1 投入ファイル A〜E / 2 最初のプロンプト / 3 補足 / 4 前提事実メモ)を範とする。

### Step 5: Plan Mode 提示

> **Plan Mode タイムアウト対策（未回答事項の扱い）**
>
> Claude Code の仕様変更により、Plan Mode は一定時間で自動タイムアウトし、開発者の回答を得ないまま Plan Mode を抜けて「編集承認」扱いになることがある。これを防ぐ手段は無いため、以下で代替する。
>
> 1. **未回答・未決の事項は、本 Step 5 提示（プラン）の末尾に「■ 未決事項（要回答）」として箇条書きで必ず明示し、開発者の返答を待つ。** 各項目に (a) 何が未決か (b) こちらの推奨案・暫定案 (c) 回答が無いと何が困るか を書く。
> 2. **重要な未決事項を抱えたまま承認された場合（タイムアウトによる自動承認を含む）は、Step 6 以降（成果物生成・既存ファイル編集）に進まない。** 代わりに「重要な未決事項が残っているため作業を保留しました。以下について回答をお願いします」と連絡し、未決事項を再掲して停止する。
> 3. 推奨案どおり進めても実害の無い軽微な事項に限り、推奨案を採用した旨を明記した上で続行してよい。重要度の判断に迷う場合は「重要」側に倒し、停止して確認する。

以下を開発者に提示し、承認を得る:

1. **ターゲットフェーズ {N+1} の確認**(handover から検出)
2. **bootstrap モードか前フェーズ kit 流用か**(初回は bootstrap)
3. **Step 3 で取得した事実の一覧**(設計書現行版、次回 CHANGE 番号、持ち越し課題、最初の仕事、直近指示書名、各バージョン)
4. **「ドキュメント体系について」段落の処理方針**(削除 / 簡略化 / 維持)
5. **副成果物の処理**(承認は個別):
   - `README.md` の改訂履歴更新(初回は新フォルダの README 新設)
   - `docs/human-notes/custom-commands.md` への本コマンド追記
6. **digest 再蒸留結果と未適用の提案**(Step 3-0b 由来):
   - `retrospective-digest.md` の更新差分サマリ(現役教訓の増減 / 機構化済みへ移動した項目)
   - サブコマンドが出した **未適用の提案**(retrospective-log §1 昇格 / §8 圧縮 / playbook §4.x 等)を一覧提示し、開発者の承認/保留を仰ぐ。**承認されたものは本キット完了後に別工程で反映**(本コマンドは log/playbook を編集しない)
7. **progress-summary 更新結果と提案**(Step 3-0c 由来):
   - `progress-summary.md` に追加された新節(当該フェーズ末尾までの未要約マイルストーン分)の内容サマリ
   - サブコマンドが出した付随節の更新案(§「持ち越し課題」/ §「更新履歴」)を個別承認可で提示(不要なら skip)
8. **プロンプト本文の必須要素の反映確認**(脱落の再発防止チェック):
   - 生成規則 7: 設計テンプレ集(`docs/instructions/templates/` 直読)が **(A) B グループ(恒久資料)・(B) §2 プロンプト本文の一文 の 2 箇所** に入っているか(個別実物の添付運用・旧 zip 必須運用に戻っていないか)
   - 生成規則 15: §2 プロンプト末尾の **「投入資料の確認」ブロック(直読方式)**(直読マニフェスト照合・パス単位の不足報告・必須揃うまで成果物生成ゲート・添付フォールバック手順)が入っているか
   - 生成規則 16: CLAUDE.md が **必須(E グループ)・受領マニフェストに残っていないか**(任意へ降格済みか・必須件数から除外済みか)
   - **生成規則 18: 節限定の読み方が機構になっているか**(★2026-08-12 新設) — **(A)** 「起動時に必ず読む」側の各行に **読む単位(全文 / 節限定)** が書いてあるか **(B)** 節限定の行が **`grep -n '^## '` → `Read(offset/limit)` の 2 手**で書かれているか(**行番号の直書きは不可**) **(C)** **履歴節 5 本**(`parallel-board` §9 ／ `change-number-registry` §4 ／ `architecture-patterns` §12 ／ `playbook` 更新履歴 ／ `progress-summary` §20)が **「読まない」と明記**されているか **(D)** 節番号を base から**写さず実査したか** **(E)** キット本文が効果を**「量が減る」で説明していないか**(裁定 15)
   - **生成規則 17: 面の読み替えが済んでいるか**(★2026-08-12 追加。**規則本文は 2026-08-11 からあったが本チェックリストに 1 行も無く、検査されないまま生成できる状態だった**) — **(A)** A〜E 群の「ナレッジ常設 / 直読」区分が**「起動時に必ず読む / 必要時に引く」へ置き換わっているか** **(B)** §2 冒頭に **`bash scripts/design-desk-arm.sh`(武装)が最初の 1 手として**入っているか(規則 15 の受領確認ゲートを**武装の確認**へ置換済みか) **(G)** その**直後**に **`bash scripts/check-derived-docs.sh`** が入っているか——コマンドだけでなく **3 要素が揃っていること**を見る: **出力の読み方**(「源泉が新しい」= 丸ごと無効ではない。**変化量**が小さければ変わった領域だけ実物確認)／**成果物生成のゲートにしない**／**`code-facts` は武装中に再生成できない**(`generate-code-facts.sh` が exit 2。武装していないセッションか開発者へ回す) **(F)** 「Sync now」「GitHub 直読」「添付フォールバック」が**親向けの手順として残っていないか**(個別設計チャット向けの注記としてなら可)

### Step 6: 書き込み(主成果物)

Step 5 で承認後、以下を **新規作成**:

- `<キット格納ディレクトリ>/phase{N+1}-kickoff-startup-kit.md`

既存の `phase{N}-kickoff-startup-kit.md`(および過去キット)は **編集しない**(コピー元・履歴保持)。

### Step 7: 副成果物(Step 5 で承認された場合のみ)

- `<関連 README.md>` を編集(初回は新規作成):
  - フォルダの用途、`milestone-startup-kit/` との違い、`/next_phase_kit` での流用手順、改訂履歴
- `docs/human-notes/custom-commands.md` を編集:
  - `/next_milestone_kit` エントリの直後に `/next_phase_kit` のエントリを追記

---

## 生成規則

入力 handover → target kit (`phase{N+1}-kickoff-startup-kit.md`)の生成規則。
マイルストーン版の変換規則を踏襲しつつフェーズ向けに調整する(下表 18 項目)。

| # | 項目 | 内容 |
|---|------|------|
| 1 | フェーズ番号・スコープ名 | `フェーズ{N+1}` とスコープ名(Step 3-b)を全体に反映 |
| 2 | handover ファイル名 | C グループに入力 handover(`phase{N+1}-kickoff-handover.md`、live)を必須投入。フェーズ末 completion handover(持ち越し逐条正本、archive)も必須投入 |
| 3 | 「読む順序」参照 | 入力 handover §7.4(新セッション開始時の確認手順)を参照 |
| 4 | 持ち越し課題 | Step 3-c のフェーズタグ項目に差し替え。**0 件なら「持ち越し課題なし」と明示** |
| 5 | CHANGE / 設計書改訂事実 | Step 3-a / e の現行版・次回採番番号に差し替え |
| 6 | progress-summary 対象範囲 | M0〜直近マイルストーン(Step 3-h) |
| 7 | 設計テンプレ集(テンプレ実体の直読・**2 箇所・必須・欠落時は復元**) | 設計担当が新フェーズの各成果物(まず phase-overview、続いて各マイルストーンの指示書・チェックリスト・CHANGE)を書く際の **書式・粒度の手本** として、テンプレ実体 `docs/instructions/templates/`(instruction / review-checklist / milestone-overview / phase-overview / research / change-notification / change-report の各 `*.template.md` + README = 各成果物の骨格 + 記入指針 + ミニ実例)を **GitHub 直読で参照させる**。**(A)** §投入ファイル「B グループ(恒久資料)」に「設計テンプレ集 `docs/instructions/templates/`(各成果物のテンプレを収録・GitHub 直読)」行、**(B)** §2 最初のプロンプト本文に「phase-overview / 各指示書 / レビューチェックリスト / CHANGE 通知書等は、`docs/instructions/templates/` 内の対応テンプレの章立て・記入指針に従って作成してください」相当の一文、の **2 箇所に必ず反映する**。**従来の「直近指示書 + レビューチェックリストを個別添付してテンプレ例にする」運用は行わない**(実物の参照が要る場合は直読パスを示す)。base が旧運用(zip 添付・個別実物添付)のままなら直読方式へ置換する。**反映だけで済ませず (A)(B) のいずれかが脱落していれば追加して復元する**(milestone 版で m7→m9 に (B) の一文が脱落した再発防止)。「テンプレは各成果物の型で最終的な正は Playbook §2 等の運用ルール」の注記を付す。加えて **§2 プロンプト本文に「テンプレで書式・粒度が不十分な場合は、書こうとしている成果物と性質の近い過去の実物(ファイル名・マイルストーンを特定し、どのテンプレのどの節が不足かを添えて)を直読で読む。直読で参照できない場合のみ開発者に投入を請求してよい」旨の一文を含める**(templates/README の該当節と対応)。**フォールバック(添付投入時)**: 手動添付で投入する場合のみ、Step 3-0e で再生成した `design-templates.zip` を 1 件として添付する(2026-07-20 直読切替・旧 zip 運用は後方互換) |
| 8 | バージョン注記 | playbook / SUPP-001 / その他補足資料を Step 3-a / f / g の最新値に差し替え |
| 9 | 「最初のプロンプト」の依頼事項 | **第一成果物 = phase-overview ドラフト(マイルストーン分割策定)**。handover §3 を起点に独自構成し、余力で序盤マイルストーン着手と書く |
| 10 | 「主な改訂点 / 前提事実メモ」節 | 本コマンドが実施した反映項目(フェーズ番号、持ち越し更新、CHANGE/設計書現行版反映、bootstrap 注記)を記載 |
| 11 | bootstrap 注記 | 初回(前フェーズ kit が無い)は `m{N}-startup-kit.md` 構造から起こした旨を明記 |
| 12 | code-facts.md の投入(必須) | B グループに `docs/handover/code-facts.md`(設計担当=コード閲覧不可向けの **機械的事実の参照元**: Props / queryKey / ルート / Go ハンドラ↔ルート / config / 共通ナビリンク)を必須投入として加える。併せて「**投入直前に `/regen_code_facts` で再生成し、開発者が commit+push した版を直読させる(添付フォールバック時は再生成版を貼る)**」「最終的な正は実コードで本資料には静的抽出の限界がある」旨の注記を付す |
| 13 | retrospective-digest.md の投入(必須) | B グループに `docs/handover/retrospective-digest.md`(設計担当が指示書執筆時に毎回読む **現役教訓の蒸留版**)を必須投入として加える。併せて「**投入直前に `/retrospective-digest-update` で再蒸留(Step 3-0b)し、開発者が commit+push した版を直読させる(添付フォールバック時は最新版を貼る)**」「機構化済みの教訓は本書から除外され code-facts / playbook が自動で強制する」旨の注記を付す。**`retrospective-log.md` は『全期間の全量記録=アーカイブ参照』に位置づけ直し**、設計担当の必読は digest とする |
| 14 | docs-map.md の投入(必須) | B グループに `docs/handover/docs-map.md`(設計担当=リポジトリのファイル構成を直接見られない向けの **文書ID ⇄ 実パス・役割マップ**: `DES-002` 等の文書ID → 実パス逆引き + docs 配下のディレクトリ別役割)を必須投入として加える。設計担当が指示書で文書ID 参照した資料の実パス確認に使い、実装担当の無駄な探索・「読まずに着手」による品質低下を防ぐ目的。併せて「**投入直前に `/regen_docs_map` で再生成(Step 3-0d)し、開発者が commit+push した版を直読させる(添付フォールバック時は再生成版を貼る)**」「最終的な正は実ファイルで本資料には静的抽出の限界がある」旨の注記を付す |
| 15 | 投入資料の確認ブロック(直読方式・必須) | §2 最初のプロンプトの **末尾に「投入資料の確認」ブロックを必ず置く**。既定は GitHub 直読方式で、手順を定義する: **(1)** A〜E 群の **必須パスを「直読マニフェスト」とみなし**、GitHub 連携(プロジェクトナレッジ等)で各パスが実際に読めるかを確認し、読めたものを列挙(読めた分は読み込み開始可)。**(2)** 読めないパスは即「欠落」と断定せず、**開発者側の Sync now 未実施・ナレッジ選択漏れ・push 漏れを疑い、パス単位で具体的に** 報告して同期・追加を求める(曖昧報告は禁止)。**(3)** **必須パスが全て読めるまで CHANGE 通知書・指示書・設計判断などの成果物生成を開始しない**(不足のまま想定で進めない=最警戒のアンチパターン。読み込み・内容理解・確認に留める。任意資料は未読でも着手可)。**(4)** 必須分が揃ったら「直読版の鮮度=最終 push+Sync 時点」の認識を含め一行で報告し、本フェーズの第一成果物(phase-overview ドラフト)着手前の確認事項提案へ進む。**必須パス件数・着手前確認の具体項目は生成するキットの実値に置換する**。設計テンプレ集は `docs/instructions/templates/` **1 件(ディレクトリ)** として数える。併せて投入ファイル節・本文の「アップロード」「添付」文言を直読前提へ改める。**フォールバック(添付投入時)**: 手動添付で投入する場合は従来の「添付ファイルの受領確認」手順(受領マニフェスト照合→添付の再走査→ファイル名単位の不足報告→必須揃うまで成果物生成ゲート。`m10-startup-kit.md` §2 末尾を範とする。テンプレ集は `design-templates.zip` 1 件として数える)を用いる。base が添付方式のままなら直読方式へ置換する(2026-07-20 切替) |
| **17** | **親の面が Claude Code になったことによる読み替え(必須・2026-08-11)** | **親(設計卓)は Claude Code(メインツリー)で動く**(開発者裁定 2026-08-11。正本 `docs/progress/20260811-design-desk-surface-study.md` §9)。`next_milestone_kit` の**変換規則 19 と同趣旨**であり、フェーズ版にも同じ読み替えを当てる。**(A) A〜E 群の「プロジェクトナレッジ常設 / 直読」区分を廃し、「起動時に必ず読む」「必要時に引く」の 2 列にする**——Code 版にナレッジも Sync now も無く、線引きの根拠だった「検索は取りこぼす」(`parallel-ops` §10)が消えるため。**新しい理由は「読ませすぎを防ぐ」**。**(B) §2 プロンプトの冒頭に武装手順を置く**＝`bash scripts/design-desk-arm.sh` を最初の 1 手として実行させ `--status` を報告させる。**規則 15 の受領確認ゲートを、資料の受領確認から武装の確認へ置き換える**。**(C) 規則 12(code-facts)は有効のまま維持**——「設計担当はコード閲覧不可」は武装により今も真である(見えるのは `docs/` `.claude/` `scripts/` だけ)。ただし「commit + push して直読させる / Sync now」の手順は削る。**(D) 規則 14(docs-map)の根拠を書き換える**＝「ファイル構成を直接見られない」ためではなく、**文書ID ⇄ 実パスの逆引きと docs 配下の役割マップ**として要る。**(E) 規則 16(CLAUDE.md 任意化)は維持**——Code では読めるが、**読ませないことが目的**なので任意のままにする。**(F) 添付フォールバックの記述は個別設計チャット向けとして残す**。**(G) ★§2 プロンプトの冒頭(武装の直後)に `bash scripts/check-derived-docs.sh` を置く**——**派生資料のメンテはこれまで起動キット生成の Step 3-0 に埋まっており、トリガがマイルストーン/フェーズ境界に固定されていた**。並列期は境界が来ず、`retrospective-digest` 等が長期間止まって**設計卓が「完全に陳腐化した」と誤解し資料を使わなくなった実害が出ている**。**セッション起動ごとに回せば境界から切り離せる。** 出力の読み方も §2 に書く(**変化量が小さければ変わった領域だけ実物確認し、他の節はそのまま使う**)。**★`code-facts` は武装中に再生成できない**(源泉が作業ツリーに無く `generate-code-facts.sh` が exit 2 で停止する)——武装していないセッションまたは開発者へ回す。**★本コマンドの役割自体は変わらない**——フェーズ境界で作る phase-overview(マイルストーン分割の策定)は**ボードから導出できない**ため、キットの必要性は面と独立である |
| **18** | **節限定の読み方を機構にする(必須・2026-08-12)** | `next_milestone_kit` の**変換規則 20 と同趣旨**であり、フェーズ版にも同じ機構を当てる。投入ファイル節は `change-number-registry.md §1(counter)` のように**節を限定して指示している**が、**`Read` は既定でファイル全体を読む**——**節限定が散文にとどまっており、機構になっていない**。**(A) 「起動時に必ず読む」側の各行に「読む単位」を明示する**(**全文** / **節限定**。既定は全文。節限定にするのは**現在値と履歴・経緯が同じ平面に並んでいる**資料)。**(B) 節限定の行は実行可能な 2 手で書く**——**`grep -n '^## ' <path>` で節の開始行を得る → `Read(<path>, offset=<当該節の行>, limit=<次節の行 − 当該節の行>)`**。**★行番号を直書きしない**(資料が伸びた瞬間に失効し、本規則が直そうとしている陳腐化そのものを持ち込む)。**(C) 履歴節を「読まない」と明記する**——**該当は 5 本**(`parallel-board` §9 ／ `change-number-registry` §4 ／ `architecture-patterns` §12 ／ `design-instruction-playbook` 更新履歴 ／ `progress-summary` §20)。必要になったら「必要時に引く」側から引く。**★効果を「量が減る」で説明しないこと**——A/B 実測で読ませる量と総トークンの相関は **+0.03%／+1.9% しかない**(開発者裁定 15・`docs/progress/20260811-context-load-ab-pilot.md`)。**書いてよい効果は (a) 起動時のコンテキスト占有(必読指定されたファイルは全体が読まれうる)と (b) 現在値と履歴が同じ平面に並ぶことによる正確性の問題(検索で引いた 1 行が「今もそう」か「当時そうだった」か区別できない。2026-08-12 に実際に 2 回踏んだ)の 2 つだけ**。**★生成時に節番号を実査する**(`grep -n '^## '`)——base の節指定を写すと、改訂で動いた節番号のまま誤った節を読ませる |
| 16 | CLAUDE.md の任意化(必須→任意へ降格・必須) | 生成するキットで **CLAUDE.md(E グループ)を必須投入から外し、任意(要望時投入)へ降格する**。「Web 版設計担当が CLAUDE.md を改訂する運用は終息・安定したため任意化(2026-07-16 開発者方針)。概要把握・改訂支援等で必要になったら開発者へ投入を請求する」旨の注記を付す。§2 プロンプト本文のマニフェスト列挙からも必須扱いを外し、**起動時未投入=請求時投入** とする(retrospective-log と同じパターン)。**投入資料の確認ブロック(規則 15)の必須件数から CLAUDE.md を除いて計算する**。§2 依頼事項に「CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援」相当の記述がある場合は維持してよいが、CLAUDE.md 本体は起動時未投入である前提に文言を整合させる |

### 投入ファイルのグループ構成(A〜E)

`phase1-completion-restructure-startup-kit.md` / `m{N}-startup-kit.md` の A〜E 構成を踏襲:

- **A 設計書本体**(必須): REQ-001(§7 = フェーズ定義の正本)/ DES-001〜006 / SUPP-001
- **B 設計担当恒久資料**(必須): design-instruction-playbook / **retrospective-digest.md**(現役教訓の蒸留版=設計担当の必読。**投入直前に `/retrospective-digest-update` で再蒸留**)/ retrospective-log(全期間の全量記録=アーカイブ参照、毎回通読しない)/ architecture-patterns / change-number-registry / **code-facts.md**(機械的事実の参照元。**投入直前に `/regen_code_facts` で再生成**して現行コードと一致させる)/ **docs-map.md**(文書ID ⇄ 実パス・役割マップ。**投入直前に `/regen_docs_map` で再生成**して現行 docs 構成と一致させる)/ **設計テンプレ集 `docs/instructions/templates/`**(各成果物の書式・粒度の手本。GitHub 直読=生成規則 7。添付フォールバック時のみ `bash scripts/generate-template-zip.sh` で `design-templates.zip` を再生成して添付)
- **C フェーズ固有**(必須): 入力 `phase{N+1}-kickoff-handover.md`(live)+ フェーズ末 completion handover(archive、持ち越し逐条正本)
- **D 進捗・配分**(必須): progress-summary(**投入直前に `/update_progress_summary` で当該フェーズ末尾の完了マイルストーンまで更新**)/ model-allocation
- **E プロジェクト指針**(任意): CLAUDE.md(Web 版設計担当が CLAUDE.md を改訂する運用は終息・安定したため任意化〔2026-07-16 開発者方針・生成規則 16〕。起動時未投入=概要把握・改訂支援等で必要になったら開発者へ投入を請求)
- **任意**: (書式手本は B 群の `design-templates.zip` が代替するため、実物の参照が要る場合のみ)直近指示書 + レビューチェックリスト、progress-log、archive の旧 handover 群、CHANGE 通知書過去分

---

## $ARGUMENTS の解釈ルール

| パターン | 例 | 動作 |
|---------|------|------|
| **handover パスのみ** | `docs/handover/phase2-kickoff-handover.md` | 当該 handover を一次資料に生成 + Plan Mode 確認 |
| **補足指示混在** | `docs/handover/phase2-kickoff-handover.md ドキュメント体系段落は削除` | handover パス + 補足指示として分解処理 |
| **パス未指定 / 曖昧** | 解釈一意でない | Plan Mode で開発者に確認 |

**$ARGUMENTS でも以下は突破不可**:
- 既存 kit ファイル(`phase{N}-kickoff-startup-kit.md` 等)への編集
- 編集禁止ファイル(下記)への編集
- Git 操作・データ破壊系コマンド

---

## 権限境界・禁止事項

### Git 操作の禁止

- commit / push / merge / rebase / tag / reset --hard / push --force 等は **すべて開発者が行う**
- Claude は変更提案・編集に留め、Git コマンドを直接実行しない
- ブランチ作成・切替も開発者(例外: 開発者から明示的な指示があった場合のみ)

### データ破壊系コマンドの禁止

- `rm -rf` 系の致命的削除
- `git reset --hard` / `git clean -fd` 等の作業破壊
- `chmod 777` の再帰適用
- データベースファイル等の直接削除
- `curl ... | bash` / `wget ... | sh` 等の外部スクリプト直接実行
- `sudo` の使用

### 編集可能ファイル(本コマンドが新規作成・編集する)

- **新規作成のみ**(本コマンドの主成果物):
  - `<キット格納ディレクトリ>/phase{N+1}-kickoff-startup-kit.md`
- **既存ファイル編集 / 新規作成**(Step 5 で個別承認された場合のみ):
  - `<関連 README.md>`(初回は新規作成、以降は改訂履歴追記)
  - `docs/human-notes/custom-commands.md`(本コマンドのエントリ追記)
- **委譲サブコマンド経由の更新**(本コマンド本体は直接編集しない):
  - `docs/handover/retrospective-digest.md` は Step 3-0b で `/retrospective-digest-update` を実行することで更新される。同サブコマンドの権限境界(digest のみ編集・retrospective-log/playbook は提案のみ)に従う。
  - `docs/progress/progress-summary.md` は Step 3-0c で `/update_progress_summary` を実行することで更新される。同サブコマンドの権限境界(progress-summary.md のみ編集・progress-log.md は読み取り専用)に従う。
- **スクリプト生成物(commit 対象外)**:
  - `docs/instructions/templates/design-templates.zip` は Step 3-0e で `bash scripts/generate-template-zip.sh` により再生成される(テンプレ本体からの決定論生成・.gitignore 済み)。テンプレ本体(`docs/instructions/templates/*.template.md` / `README.md`)は設計担当・整備担当が保守し、本コマンドは編集しない。
- **セッション揮発一時ファイル(commit 対象外)**:
  - `tmp/ephemeral-*.md` の新規作成・編集可(§「セッション揮発一時ファイル(コンパクション対策)」の運用ルールに従う。永続化への昇格は必ず開発者承認)。

### 編集禁止(読み取りのみ)

- 既存の `phase{N}-kickoff-startup-kit.md` および過去キット(コピー元・履歴保持)
- `docs/human-notes/milestone-startup-kit/` 配下(構造参照のみ)
- 設計書本体(`docs/design/requirements.md`, `docs/design/01-tech-stack.md` 〜 `docs/design/06-validation.md`)
- `docs/design/supp-001-detailed-design.md`(ヘッダ・§4.1 参照のみ)
- `docs/handover/` 配下の継続更新ファイル(`retrospective-log.md`, `architecture-patterns.md`, `change-number-registry.md`)
- `docs/handover/design-instruction-playbook.md`(ヘッダ参照のみ)
- 入力 handover(`phase{N+1}-kickoff-handover.md`)およびフェーズ末 completion handover(§参照のみ)
- `docs/handover/archive/` 配下、`docs/handover/cleanup-assistant-prompt.md`
- `docs/instructions/` 配下、`docs/instructions/reviews/` 配下、`docs/change-notes/` 配下(例外: `docs/instructions/templates/design-templates.zip` の再生成のみ Step 3-0e で許可。テンプレ本体 `*.template.md` / `README.md` は編集しない)
- `docs/progress/` 配下(progress-summary.md を除く、参照のみ。progress-summary.md は Step 3-0c で `/update_progress_summary` 経由でのみ更新)
- `docs/postmortem/` 配下、`.claude/settings.json`、`.claude/settings.local.json`
- 本コマンドに明示的に列挙されていないすべてのフォルダ・ファイル

### 判断保留時の停止

- 取得した事実が不明確、$ARGUMENTS の解釈が曖昧、生成規則の適用判断に迷う場合は **Plan Mode で停止** して開発者確認
- 推測で進めず、必ず開発者承認を得る
- 設計担当 Claude Web 版が受け取るキットの品質はプロジェクト進行に直結するため、**事実取得の正確性は特に慎重に**

---

## 進め方の最初の一歩

引数 `$ARGUMENTS` の有無に関わらず、以下から開始:

1. `$ARGUMENTS` から入力 handover パスと補足指示を切り分ける(Step 1)
2. §「設定」の **キット格納ディレクトリ** を `ls` で確認、既存 kit の有無で base / bootstrap を判定
3. Step 2(ターゲットフェーズ {N+1} 決定)、Step 3(派生資料リフレッシュ 3-0〜3-0e + 事実取得 a〜l)を実施
4. Step 4 で生成案をメモリ上に作成
5. **Plan Mode で Step 5 の確認事項を開発者に提示**
6. 承認後 Step 6(主成果物の新規作成)、必要に応じて Step 7(副成果物の編集)を実施

不明点があれば遠慮なく開発者に確認してください。**親(設計卓＝Claude Code)が受け取るキットの品質に直結する**ため、
事実取得の正確性は特に慎重に進めてください。

---

## 経緯メモ

### 2026-09-02: 「面の移行」の反映漏れを是正(射程明記)＝`D-681`

**何が起きていたか**: §「投入方式(2026-07-20 直読切替)」は、**親(設計卓)が Web 版だった時期の前提**
(GitHub ナレッジへ接続し Sync now で鮮度を取る)で書かれていた。**2026-08-11 に親は Claude Code へ移り**、
同じファイルの **生成規則 17** が「Sync now / GitHub 直読 / 添付フォールバックが**親向けの手順として**残っていないか」
を検査項目に掲げているにもかかわらず、**§「投入方式」自身はその検査の対象外だった**
(検査は**生成するキット**を見るものであり、**コマンド定義そのもの**は見ない)。

**なぜ発火しなかったか**: 面の移行のとき、**規則側だけを直して前提側を直さなかった**。
規則は「生成物がこうなっているか」を問う形をしており、**コマンド定義の地の文が同じ前提に乗っていることを
拾う仕掛けが無い**。`check-doc-refs.sh` は dead file reference しか見ないため、
**参照先が生きている限り、内容が失効していても緑になる**。

**どう直したか**: **削除ではなく射程明記**。個別設計チャット(Web 版)向けには内容が現役であるため、
節の頭に「**本節の射程は個別設計チャットに限る／親向けキットには適用しない**」を置き、
本文の主語を「個別設計チャットへ資料を渡す場合」へ限定した。
生成規則 17 の「**個別設計チャット向けの注記としてなら可**」に沿う形である。

**同じ前提に乗っていた記述をもう 1 件見つけた**: 末尾の
「設計担当 Claude Web 版が受け取るキットの品質に直結するため」——**受け手はもう Web 版ではない**。
**「親(設計卓＝Claude Code)が受け取る」へ直した**。開発者確認は取っていない(【2】の射程明記の判断に沿う機械的な追随)。
**違う扱いにすべきなら差し戻すこと。**

**一般形**: **前提が変わったとき、その前提を検査する規則を足すだけでは足りない。
規則と同じファイルの地の文が、古い前提のまま残る。**

