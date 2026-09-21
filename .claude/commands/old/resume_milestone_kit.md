---
description: 【old/ へ退避・現役ではない】マイルストーン内 途中再開キット生成。base kit §2 を変換し m{N}-{NN}-resume-startup-kit.md を生成する。★2026-08-11 の面の移行で存在理由の核が消えた。★2026-09-02 に .claude/commands/old/ へ移し、呼び出し名は /old:resume_milestone_kit になった。実行前に本文冒頭の確認事項を読むこと
argument-hint: <再開点 例: M17-03>[ <handover パス>][ <補足指示>]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(ls:*), Bash(grep:*), Bash(rg:*), Bash(find:*), Bash(git diff:*), Bash(bash scripts/generate-code-facts.sh), Bash(bash scripts/generate-docs-map.sh), Bash(bash scripts/check-derived-docs.sh)
---

あなたは、開発プロセス設計とドキュメント体系の構築に長けたシニアエンジニアとして、本プロジェクトの **マイルストーン内 途中再開キット生成担当 Claude** を務めます。
1 つの大きなマイルストーンが途中で分割された際(想定より拡大した / 設計判断でコンテキストを消費した等)に、設計卓を **マイルストーンの途中サブ(例 M17-03)から再開** させるための **置換型 resume kit**(`m{N}-{NN}-resume-startup-kit.md`)を生成します。

> ## ★★ 本コマンドは `old/` へ退避してある(2026-09-02＝`D-682`)

> **現役の運用手順ではない。** 2026-08-11 の「面の移行」(親＝設計卓が Web 版 → Claude Code)で
> **本コマンドの存在理由の核が消えた**(下の 2026-08-11 の節を参照)。
> **⇒ 2026-09-02、開発者判断により `.claude/commands/old/` へ移した。**
>
> **★消さずに残した理由**: **本リポジトリをベースに別プロジェクトを起こすとき、
> その新プロジェクトが Web 版チャットを親に据える構成なら、本コマンドが再び要る可能性がある**(開発者判断)。
> **削除すると復元は Git 履歴からになり、「そんなものがあった」ことに気づく手掛かりが消える。**
>
> **★呼び出し名が変わった**: Claude Code は `.claude/commands/` の**サブディレクトリを名前空間として扱う**。
> ⇒ 本コマンドの起動は **`/old:resume_milestone_kit`** である
> (`/resume_milestone_kit` では起動しない)。**移動は無効化ではなく改名である。**
> **本当に無効化したいなら `.md` 以外へ拡張子を変えるか、`.claude/commands/` の外へ出すこと。**
>
> **★`old/` に置くファイルの条件**: **(1)** 現役の運用手順ではない **(2)** それでも消さない理由がある
> (他プロジェクトへの流用・経緯の保存)。**この 2 つを満たさないものを `old/` へ入れないこと**——
> 「あとで見る」置き場にすると、`docs/` で起きたのと同じ滞留が起きる(§10.Y)。

---

> ## ★★ 実行前に読むこと: 本コマンドは存廃の判定待ちである(2026-08-11)
>
> **親(設計卓)の面が Web 版 → Claude Code へ変わった**ことで、**本コマンドの存在理由の核が消えた可能性がある**。
> 実行を求められたら、**まず開発者へ次を確認すること**。
>
> **(1) 存在理由の核が消えた** — 下の「置換型(重要)」が明記するとおり、本コマンドの目的は
> 「**投入プロンプトを 1 本にするため。長いプロンプトは Web チャットで PASTED 化して添付枠を消費するため**」だった。
> **Code 版にこの制約は無い**(ファイルを Read させればよく、添付枠の概念が無い)。
>
> **(2) 引き継ぐ内容をボードが持っている** — 本コマンドが入力とする `design-session-handover`
> (現在状態 = 完了サブ・確定判断・残サブの設計メモ・現行版の正本)は、
> **`docs/process/parallel-board.md` §1 マイルストーン状況・§2 予約レンジと現行版・§3 裁定ログが同じものを持つ**。
> `parallel-ops` §05 は「**状態は repo のボードファイルへ出す ＝ いつでも使い捨て可**」「**新しい親はボードから起動する**」と定めており、
> **反映係の廃止と Code 化でこの設計が初めて成立する**(「未反映」という状態が消え、ボードが常時最新になるため)。
>
> **(3) ただし即断しない** — 本プロジェクトの流儀は**実測で判定**することである
> (裁定 15 / E-2「削減量を効果として掲げるには実測が要る」)。**M20 で 1 回セッション交代を行い、
> ボード起動だけで足りたかを観測してから存廃を決める**。追跡は
> `docs/handover/followup-backlog.md` §J `resume-kit-necessity-after-code-migration`。
>
> **(4) それまでの暫定運用** — 交代の手順は `docs/process/remote-ops.md` §6.2(交換時期・交換前チェックリスト)に従う。
> **`design-session-handover` を書かせる前に、ボードが最新かを確認する**——最新なら handover は重複作業である。
>
> **面の読み替え**: 本コマンドを実行する場合、生成するキットは `next_milestone_kit` の**変換規則 19** と同じ読み替えを当てる
> (ナレッジ常設/直読の区分を廃止・武装手順を §2 冒頭へ・Sync now の削除)。

> **置換型(重要)**: 生成する resume kit の §2「最初のプロンプト」は、base `m{N}-startup-kit.md` §2 を **変換再生成した、単独で成立する完全プロンプト**です。開発者は **この §2 プロンプト 1 本を貼り、§1 の資料は GitHub 直読させる**(添付フォールバック時のみ添付)だけで新セッションを起動します。**base kit §2 は投入しません**(resume kit §2 がその代替)。
>
> 理由: 投入プロンプトを 1 本にするため。長いプロンプトは Web チャットで PASTED(テキストファイル)化して添付枠を消費するため、2 本貼り(base §2 + 上書き)を避けて 1 本に統合する。
>
> **投入方式(2026-07-20 直読切替 / ★2026-09-02 射程明記＝`D-681`)**: **★本段落の射程は「個別設計チャット(Web 版)」に限る。親(設計卓)向けには適用しない**——親は Claude Code であり、武装して HEAD を直接読むため「GitHub 直読」「Sync now」「添付フォールバック」は存在しない概念である。**上の「面の読み替え」が『Sync now の削除』を指示しているのに、本段落が 6 行後に Sync now を既定として書いていた**——**同一ファイル内の自己矛盾であり、2026-09-02 に射程明記で解いた**(削除しないのは個別設計チャット向けには現役だからである)。 個別設計チャットへ資料を渡す場合は、GitHub 直読(Web 版 Projects の GitHub ナレッジ)を既定とし、鮮度は「開発者が push し、Web 版側で Sync now を実行した時点」。手動添付はフォールバックとして存続(変換規則 8/9 の該当手順)。運用手順の正本は `docs/process/remote-ops.md` を参照。

> **本コマンドと `next_milestone_kit` / `next_phase_kit` の違い**
>
> - `next_milestone_kit` = **マイルストーン境界**(M16 完了 → M17 着手)の起動キット生成(base = 直前マイルストーンのキット)。
> - `next_phase_kit` = **フェーズ境界**のキックオフキット生成。
> - **本コマンド = マイルストーン内のセッション分割**(M17-02 まで実施 → M17-03〜05 は新セッション)。base = **当該マイルストーンの `m{N}-startup-kit.md`**。マイルストーン番号を進めず、再開点 M{N}-{NN} 用に §2 を変換する。`next_milestone_kit` の変換規則方式と同機構。

> **`m{N}-design-session-handover.md` は入力であり、本コマンドは著述しない。**
>
> 途中引き継ぎ資料(design-session-handover)は **出ていく Web 設計セッションが執筆する成果物**(現在状態=完了サブ・確定判断・残サブの設計メモ・現行版の正本)です。本コマンドはこれを **読んで resume §2 の現況・読む順序・タスク・版注記の土台にする** だけで、内容を生成・編集しません。未作成なら停止します(Step 2)。

> 本コマンドは現時点では **combomgr プロジェクト固有** のパス・命名規則を §「設定」に直書きしています。
> 他プロジェクトへの流用時は §「設定」の各項目を当該プロジェクト用に書き換えてください。

---

## 引数

`$ARGUMENTS`(再開点は原則必須。空なら自動検出を試みて Plan Mode で確認)

引数の解釈:
- **再開点**(例 "M17-03" / "17-03" / "m17-03"): 生成する resume kit の対象サブ = 新セッションが着手する最初のサブ。
- **handover パス**(任意・例 `docs/handover/phase3/m14-03b-m17-design-session-handover.md`): design-session-handover の実パス。**命名が一定でないため、分かっていれば明示指定を推奨**(未指定なら §「設定」の glob で候補を探索し Plan Mode で確認)。
- **補足指示文**(任意・例 "retrospective-log は今回投入する"): Step 5 の判断に反映。
- **空**: 自動検出 —(1)最新 `m{N}-startup-kit.md` から N を特定 →(2)glob で design-session-handover 候補を列挙 →(3)当該マイルストーン N のものを特定し、その §0/§1.2 で「新セッション最優先」と記された最初のサブを再開点 NN として抽出 → Plan Mode で確認。

---

## 設定(プロジェクトごとに変更)

<!-- ▼ 変更可: 起動キット格納ディレクトリ(base kit と resume kit を平置き) -->
- キット格納ディレクトリ: `docs/human-notes/milestone-startup-kit/`
<!-- ▲ -->

<!-- ▼ 変更可: base kit ファイル名パターン(変換元。§2 を再生成の土台にする) -->
- base kit ファイル名パターン: `m{N}-startup-kit.md`(`{N}` はマイルストーン番号)
<!-- ▲ -->

<!-- ▼ 変更可: resume kit ファイル名パターン(本コマンドの主成果物) -->
- resume kit ファイル名パターン: `m{N}-{NN}-resume-startup-kit.md`(`{NN}` は再開サブ番号。例 `m17-03-resume-startup-kit.md`)
<!-- ▲ -->

<!-- ▼ 変更可: design-session-handover 探索 glob(入力・読み取りのみ。命名が一定でないため厳密名に依存しない) -->
- design-session-handover glob: `docs/handover/*design-session-handover*.md`(見つからなければ `docs/handover/phase*/*design-session-handover*.md` も探索)
<!-- ▲ -->

<!-- ▼ 変更可: 関連 README.md パス(副成果物=改訂履歴の追記対象) -->
- 関連 README.md: `docs/human-notes/milestone-startup-kit/README.md`
<!-- ▲ -->

> 設定変更箇所は `grep -n '▼ 変更可' .claude/commands/old/resume_milestone_kit.md` で一覧できます。

---

## あなたの役割と前提

### 役割

- base `m{N}-startup-kit.md`(§1 マニフェスト・§2 完全プロンプト)と design-session-handover(入力=現在状態の正本)を読み、**base §2 を変換再生成して単独で成立する resume §2** を作る
- 現況・読む順序・タスク・現行版は **design-session-handover 由来**で上書きする(base §2 はマイルストーン開始時点の記述のため)
- 派生資料を **軽量リフレッシュ**(code-facts / docs-map 再生成 + retrospective-digest 再蒸留。progress-summary は鮮度報告のみ)
- Plan Mode で案を提示・承認を得てから resume kit を作成

### Plan Mode 必須

本コマンドは新規ファイル作成(および承認時の既存ファイル編集)を伴うため **Plan Mode 必須**。承認なしに resume kit を作成しない / 既存ファイルを編集しない。

### セッション揮発一時ファイル(コンパクション対策)

digest 再蒸留の未適用提案一覧・handover 由来の事実一覧など、
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

§「設定」の **キット格納ディレクトリ** を `ls` で確認し、**base kit ファイル名パターン** に合致するファイルから最大の N を **base milestone** として特定する。`$ARGUMENTS` の再開点(または空なら Step 2 で handover から抽出)から再開サブ NN を決める。

例: `m17-startup-kit.md` が最新 → N = 17。引数 "M17-03" → NN = 03。base = `m17-startup-kit.md`。

### Step 2: design-session-handover の特定・検証(ブロッカー判定)

- **引数に handover パスがあれば**それを使用する。
- **無ければ** §「設定」の glob で候補を列挙し、当該マイルストーン N に対応するものを選ぶ。候補が複数 / 曖昧 / 0 件なら **Plan Mode で停止**して開発者に確認する(推測で 1 つに決めない)。
- **どうしても見つからない場合**: 停止し、「途中引き継ぎ資料(design-session-handover)が未作成です。これは出ていく Web 設計セッションが執筆する現在状態の正本であり、無いと resume kit を作れません。設計セッションに執筆・配置を依頼してください」と報告する(推測で代替生成しない)。

特定できたら、冒頭メタデータ表(文書 ID・バージョン・作成日)と本文から以下を読む: §0(新セッション最優先作業=再開サブ・最初のタスク)/ §1.1(完了済み=直前完了サブ)/ §1.2(残作業)/ §2(確定した重要判断)/ §5(関連ドキュメント現行版)。§0/§1.2 の「新セッション最優先」サブが `$ARGUMENTS` の再開点と一致するか照合し、食い違えば Plan Mode で確認する。

### Step 3: 軽量リフレッシュ + 変換の土台読込

**Step 3-0(最初に実行): `code-facts.md` の再生成。** `bash scripts/generate-code-facts.sh` を実行し、`docs/handover/code-facts.md` を現行コードと一致させる。スクリプトは grep/awk/sed のみで Git 操作を含まず、Plan Mode 中でも実行してよい(commit は開発者)。**失敗時(`exit 1`)は停止し、stderr をそのまま報告する**(手編集して取り繕わない)。

**Step 3-0b(直後に実行): `docs-map.md` の再生成。** `bash scripts/generate-docs-map.sh` を実行(同上の失敗時対応)。

**Step 3-0c(直後に実行): `retrospective-digest.md` の再蒸留。** `.claude/commands/retrospective-digest-update.md` を Read し、その手順に厳密に従って実行する(引数なし=現行 retrospective-log 全体から再蒸留)。
- **前提**: 本コマンドは **マイルストーン境界作業ではなく現時点スナップショットのリフレッシュ**。「直前マイルストーン完了」は要件としない(現行 `retrospective-log.md` の内容から蒸留する)。log にまだ無い当該サブの教訓は先取りしない。
- **権限境界の継承(重要)**: 当該サブコマンドは **`retrospective-digest.md` のみ編集**。`retrospective-log.md` 本体・playbook は **提案として出力するだけ**(適用しない)。本コマンドもこの 2 ファイルを編集しない。
- **提案の繰り込み**: サブコマンドが出した未適用の提案(log §1 昇格 / §8 圧縮 / playbook §4.x 等)は破棄せず、Step 5 Plan Mode 提示に「digest 再蒸留結果 + 未適用の提案一覧」として繰り込み、開発者の承認/保留を仰ぐ。

**Step 3-0d(直後に実行): 残り派生資料の鮮度報告のみ。** `.claude/commands/check_derived_docs.md` を Read し手順に従って `bash scripts/check-derived-docs.sh` を実行、`progress-summary` 等 **残りの派生資料の鮮度を報告する(再生成しない)**。stale が出たら Plan Mode に「マイルストーン境界作業として別途要更新(本コマンドの範囲外)」と明記して開発者判断に委ねる。**progress-summary の更新・要約はマイルストーン境界の作業であり、途中再開では回さない**。

**Step 3-1: 変換の土台読込。** base `m{N}-startup-kit.md` の **§1 投入ファイル一覧** と **§2 最初のプロンプト全文** を読む。これを次の変換の土台にする。

### Step 4: resume §2 の変換再生成(メモリ上)

下記「base §2 → resume §2 の変換規則」に従い、base §2 を書き換えて **単独で成立する完全プロンプト**を生成し、resume kit の §0〜§5 を構築する(ファイル書き込みは Step 6 まで保留)。下記「必須要素チェック」9 点をすべて満たすこと。

### Step 5: Plan Mode 提示

> **Plan Mode タイムアウト対策(未回答事項の扱い)**
>
> Claude Code の仕様で Plan Mode は一定時間で自動タイムアウトし、開発者の回答を得ないまま「編集承認」扱いになることがある。防ぐ手段は無いため以下で代替する。
>
> 1. **未回答・未決の事項は、本 Step 5 提示の末尾に「■ 未決事項(要回答)」として箇条書きで必ず明示し、返答を待つ。** 各項目に (a) 何が未決か (b) 推奨案・暫定案 (c) 回答が無いと何が困るか を書く。
> 2. **重要な未決事項を抱えたまま承認された場合(タイムアウトによる自動承認を含む)は、Step 6 以降に進まない。** 「重要な未決事項が残っているため作業を保留しました」と連絡し、未決事項を再掲して停止する。
> 3. 推奨案どおり進めても実害の無い軽微な事項に限り、推奨案採用を明記の上で続行してよい。迷う場合は「重要」側に倒して停止する。

以下を開発者に提示し、承認を得る:

1. **再開点 M{N}-{NN} と直前完了サブ・特定した handover(パス・版)の確認**(自動検出/引数指定・handover との照合結果)
2. **handover 由来の事実一覧**(完了範囲、確定判断の要点、**現行 DES 各版**、registry 次番号、handover の版)
3. **resume §2(完全プロンプト)のプレビュー**
4. **必須要素チェック**(下記 9 点がプロンプトに入っているか)
5. **派生資料の状態**: code-facts / docs-map 再生成済み(生成日)・**retrospective-digest 再蒸留の差分サマリ + 未適用の提案一覧**(承認/保留を個別に)・progress-summary 等の stale 有無(要なら境界作業として別途)
6. **副成果物の処理**(承認は個別): 関連 README.md §「改訂履歴」への resume kit 作成エントリ追記

### Step 6: 書き込み(主成果物)

Step 5 で承認後、`<キット格納ディレクトリ>/m{N}-{NN}-resume-startup-kit.md` を **新規作成**。既存の `m{N}-startup-kit.md`・過去の resume kit・design-session-handover は **編集しない**。

### Step 7: 副成果物(Step 5 で承認された場合のみ)

- `<関連 README.md>` の §「改訂履歴」に 1 行追記(日付 = 実行日、内容 = "M{N}-{NN} 途中再開 resume kit を作成"。監査証跡目的)。README §1 の本文構成は変更しない(resume kit は再利用資産ではなく再開イベントごとの成果物のため)。

---

## base §2 → resume §2 の変換規則(9 項目)

base `m{N}-startup-kit.md` §2(マイルストーン開始時点の完全プロンプト)を、再開点 M{N}-{NN} 用の完全プロンプトへ書き換える。

| # | 対象 | 変換内容 |
|---|------|---------|
| 1 | ロール宣言 | base の技術領域ロールを維持(再開サブの焦点が明確に異なる場合のみ文言調整)。妥当性検討・前提検証・トレードオフ明示・不確かは確認・品質妥協なしの姿勢は必ず残す |
| 2 | 現況・完了状態 | base の「M{N} 着手」を「**M{N} は M{N}-{直前完了サブ} まで完了しています。あなたは M{N}-{NN} から再開する新セッションです**」に。**完了済みサブ・確定判断は design-session-handover §1/§2 が正本**である旨を明記(handover §1.1/§1.2 由来) |
| 3 | 読む順序 | **先頭を design-session-handover に**:「まず {handover ファイル名} を §0→§1→§2→§3… の順に読む(現在状態の正本)。続いて design-instruction-playbook、`m{N-1}-to-m{N}-handover.md`(マイルストーン文脈)、phase-overview / M{N}-overview」。base の「`m{N-1}-to-m{N}-handover.md` §0 をまず読む」は文脈資料へ降格 |
| 4 | タスク一覧 | 完了済みサブのタスクを落とし、**M{N}-{NN} 着手から**開始(handover §0 の最優先作業 / §3 の残サブ設計メモ由来)。以降の残サブも handover §1.2 の順で列挙 |
| 5 | 「PASTED は開始時点」等の上書き文 | **不要=入れない**。単一プロンプトのため base プロンプトの PASTED が存在しない。現況は規則 2 で直接記述する(「上書き」概念を持ち込まない) |
| 6 | ファイルマニフェスト(§2 本文の A〜F 列挙) | base の A〜F 群を維持しつつ、**design-session-handover を C 群の先頭に「現在状態の正本」として追加**。`m{N-1}-to-m{N}-handover.md` はマイルストーン文脈として残す。**CLAUDE.md が base で必須なら任意へ降格する**(Web 版設計担当が CLAUDE.md を改訂する運用は終息・安定したため〔2026-07-16 開発者方針〕。起動時未投入=必要になったら開発者へ投入を請求する、retrospective-log と同じパターン) |
| 7 | バージョン注記 | base kit 作成後にマイルストーン内 CHANGE で DES 版が drift している可能性があるため、**design-session-handover §5(現行版テーブル)の値で上書き**。registry 次番号・マイグレ番号も handover §5 に従う |
| 8 | 投入資料の確認ブロック(直読方式) | 必須件数を **base の必須件数 + 1(design-session-handover)** に再計算。さらに **base §1 が CLAUDE.md を必須に含む場合は任意へ降格して件数から除く**(規則 6 の CLAUDE.md 任意化と連動・−1)。既定は GitHub 直読方式: 必須パスを「直読マニフェスト」とみなし、各パスが読めるか確認→読めないパスは Sync now 未実施・ナレッジ選択漏れ・push 漏れを疑いパス単位で報告→必須パスが全て読めるまで成果物生成しないゲート→任意は未読でも着手可。設計テンプレ集は `docs/instructions/templates/` 1 件(ディレクトリ)として数える。**フォールバック(添付投入時)**: 従来手順(受領マニフェスト照合・再走査・ファイル名単位で不足報告・必須が揃うまで生成ゲート。design-templates.zip は 1 件として数える)を用いる。base が添付方式のままなら直読方式へ置換する(2026-07-20 切替) |
| 9 | 鮮度注記・ドキュメント体系段落・テンプレ直読・質問文末集約 | base のものを維持(code-facts / docs-map / retrospective-digest は投入直前に再生成→開発者 commit+push した版を直読・設計テンプレは `docs/instructions/templates/` の対応テンプレに従う・retrospective-log は起動時未投入=請求時・開発者への質問は成果物末尾集約)。鮮度日付は Step 3 の再生成日に更新 |

### 単純置換できないケース(重要)

- 現在地・完了状態の記述(base の「M0〜M{N-1} 完了 → M{N} 着手」型)は、**マイルストーン内の進捗(M{N} は M{N}-{直前} まで完了)**へ文脈変換する。sed 的置換で壊れるため文意で書き換える。
- base §2 が特殊事情ブロック(例 m17 の「M14-03b 先行」)を持つ場合、その前提が再開時点でも生きているか handover §1/§2 で確認し、生きていれば維持・消化済みなら現況に反映する。

---

## 必須要素チェック(Step 5-4 / 変換時の脱落防止)

resume §2 に以下がすべて入っているか機械確認する(`next_milestone_kit` 規則 7/12/16 と同思想の脱落防止):

1. **シニアエンジニアのロール宣言**(冒頭)
2. **現況** = 「M{N}-{直前} まで完了・M{N}-{NN} から再開・完了サブ/確定判断は handover §1/§2 が正本」
3. **読む順序の先頭が design-session-handover**
4. **ファイルマニフェスト**(A〜F + design-session-handover)
5. **code-facts / docs-map / retrospective-digest は最新**の鮮度注記 + **retrospective-log は請求時投入** + **CLAUDE.md も任意(請求時投入)扱い**(base で必須なら降格済みか)
6. **設計テンプレ集 `docs/instructions/templates/` 直読**(テンプレ手本)の言及
7. **投入資料の確認ブロック(直読方式)**(必須件数 = base+1・パス単位報告・必須揃うまで生成ゲート・添付フォールバック手順)
8. **開発者への質問は成果物末尾に集約**(base にあれば維持)
9. **M{N}-{NN} 着手のタスク一覧**(完了サブのタスクは落とす)

---

## resume kit の構成(出力ファイルの中身・置換型)

先頭バナー(必須): 「**本ファイルは開発者向けの手順書です。§2「最初のプロンプト」だけを Web チャットに貼ります(1 本)。base `m{N}-startup-kit.md` §2 は投入しません(本 §2 がその代替)。** §0/§1/§3/§4/§5 は開発者の準備メモです。」

- `## 0. 位置づけ / 投入手順` — マイルストーン内 途中再開である旨(M{N}-{直前} まで完了 → M{N}-{NN} から再開)。**投入手順 =「push+Sync now で直読を最新化 → §2 プロンプト 1 本を貼る」**(添付フォールバック時は §1 のファイルを添付。2 本貼りは不要)。base §2 は使わないことを明記。
- `## 1. 投入資料一覧(GitHub 直読対象パス)` — **完全マニフェスト**(base の A〜F 群 + **design-session-handover を C 群先頭に必須追加**)。必須/任意・パス付き。投入直前の鮮度更新注記(code-facts=`/regen_code_facts`・docs-map=`/regen_docs_map`・retrospective-digest=`/retrospective-digest-update`、いずれも再生成→開発者 commit+push→Sync now。添付フォールバック時のみ design-templates.zip=`bash scripts/generate-template-zip.sh`)。retrospective-log は起動時未投入=請求時。CLAUDE.md は任意(base で必須でも降格・請求時投入=規則 6)。
- `## 2. 最初のプロンプト(コピペ用)` — 変換再生成した **完全な自己完結プロンプト**(base §2 の代替)を ```text``` ブロックで。
- `## 3. 補足(対話の進め方)` — 継承資料 §0 に従う・確認事項は成果物末尾集約 等(handover §4 と整合)。
- `## 4. 前提事実メモ` — 再開点 M{N}-{NN} / 直前完了サブ / 現行 DES 各版(handover §5 由来)/ 次タスクの一行要約。
- `## 5. 改訂履歴` — 作成日 = 実行日、内容 = "M{N}-{NN} 途中再開用に生成(`/resume_milestone_kit`・置換型)"。

---

## 権限境界・禁止事項

### Git 操作の禁止

- commit / push / merge / rebase / tag / reset --hard 等は **すべて開発者が行う**(`git diff` 等の参照系のみ可)
- Claude は変更提案・編集に留め、Git コマンド(参照系を除く)を直接実行しない
- ブランチ作成・切替も開発者(例外: 明示的な指示があった場合のみ)

### データ破壊系コマンドの禁止

- `rm -rf` 系の致命的削除 / `git reset --hard` / `git clean -fd` / `chmod 777` の再帰適用 / DB ファイルの直接削除 / `curl ... | bash` 等の外部スクリプト直接実行 / `sudo`

### 編集可能ファイル(本コマンドが新規作成・編集する)

- **新規作成のみ**(主成果物): `<キット格納ディレクトリ>/m{N}-{NN}-resume-startup-kit.md`
- **既存ファイル編集**(Step 5 で承認された場合のみ): `<関連 README.md>`(§「改訂履歴」への 1 行追記のみ)
- **委譲サブコマンド経由の更新**(本コマンド本体は直接編集しない): `docs/handover/retrospective-digest.md` は Step 3-0c で `/retrospective-digest-update` により再蒸留される(digest のみ編集・log/playbook は提案のみ)
- **セッション揮発一時ファイル(commit 対象外)**: `tmp/ephemeral-*.md` の新規作成・編集可(§「セッション揮発一時ファイル(コンパクション対策)」の運用ルールに従う。永続化への昇格は必ず開発者承認)

### 編集禁止(読み取りのみ)

- 既存の `m{N}-startup-kit.md`・過去の resume kit(変換元・履歴保持)
- **design-session-handover(入力=参照のみ。本コマンドは著述しない)**
- 設計書本体(`docs/design/requirements.md`, `01-tech-stack.md` 〜 `06-validation.md`, `supp-001-detailed-design.md`)
- `docs/handover/` 配下の継続更新ファイル(`retrospective-log.md` 本体, `architecture-patterns.md`, `change-number-registry.md`, `design-instruction-playbook.md`, `m{N-1}-to-m{N}-handover.md` 系)
- `docs/instructions/` 配下, `docs/instructions/reviews/` 配下, `docs/change-notes/` 配下
- `docs/progress/` 配下(progress-summary 含む。本コマンドは境界作業をしないため触らない)
- `docs/postmortem/` 配下, `.claude/settings.json`, `.claude/settings.local.json`
- 本コマンドに明示的に列挙されていないすべてのフォルダ・ファイル

### 判断保留時の停止

- handover 不在 / 候補が複数・曖昧 / $ARGUMENTS の再開点が曖昧 / handover と再開点が不一致 / 事実が不明確な場合は **Plan Mode で停止**して開発者確認
- 推測で進めず、必ず開発者承認を得る。設計担当 Web 版が受け取るキットの品質はプロジェクト進行に直結するため、事実取得の正確性は特に慎重に

---

## 進め方の最初の一歩

1. §「設定」の **キット格納ディレクトリ** を `ls` で確認、最新 `m{N}-startup-kit.md` から N を特定(Step 1)
2. `$ARGUMENTS`(再開点 / handover パス / 補足指示 / 空)を整理し、再開サブ NN を決定
3. **Step 2** で design-session-handover を特定・検証(引数優先・無ければ glob 候補を Plan Mode 確認・不在なら停止)
4. **Step 3** 派生資料の軽量リフレッシュ(code-facts / docs-map / retrospective-digest 再蒸留 / progress-summary 等の鮮度報告のみ)+ base §1/§2 読込
5. **Step 4** 変換規則 9 項目で base §2 を resume §2(完全プロンプト)へ変換再生成
6. **Plan Mode で Step 5 の確認事項(再開点 / handover / 事実 / resume §2 プレビュー / 必須要素 9 点 / 派生資料状態 / 副成果物)を提示**
7. 承認後 Step 6(主成果物の新規作成)、必要に応じて Step 7(README 改訂履歴の追記)を実施

不明点があれば遠慮なく開発者に確認してください。とくに handover の特定と再開点の一致は最初に確定させてください。

---

## 経緯メモ

### 2026-09-02: `old/` への退避と、投入方式の射程明記＝`D-681` / `D-682`

**1. 射程明記**(`D-681`): §「置換型(重要)」の直後にあった「投入方式(2026-07-20 直読切替)」は、
**その 6 行上の「面の読み替え」が『Sync now の削除』を指示しているのと真正面から矛盾していた**。
**同じファイルの中で、片方が『消せ』と言い、もう片方が『既定である』と言っていた。**
`next_milestone_kit` / `next_phase_kit` の同名節と同じ処置(**削除ではなく射程明記**)を当てた。

**2. `old/` への退避**(`D-682`): 存廃は 2026-08-11 から判定待ちだったが、
**開発者判断で「残す・ただし現役の棚から降ろす」に決まった**。
理由は「**本リポジトリをベースに別プロジェクトを起こすとき、Web 版を親に据える構成なら再び要る**」。

**★移動で分かったこと**: `.claude/commands/` のサブディレクトリは **Claude Code の名前空間**になる。
⇒ **移動しても無効化されず、`/old:resume_milestone_kit` へ改名されただけである。**
**「フォルダへ入れて眠らせる」は、Claude Code では成立しない**——眠らせたいなら拡張子を変えるか
`.claude/commands/` の外へ出す必要がある。**今回は「起動できてよいが、現役の一覧には出さない」が要求だったため、名前空間で足りている。**

**★追随したもの**: `docs/human-notes/custom-commands.md`(起動行を `/old:resume_milestone_kit` へ) ／
`.claude/commands/sync_command_catalog.md`(走査が `ls .claude/commands/` の平置き前提で、
**サブディレクトリのコマンドを「実体消失」と誤検出する**ため走査規則を直した) ／
`docs/process/parallel-board.md`(custom-commands 同期行)。
**`scripts/check-doc-refs.sh` は `find .claude/commands -name '*.md'`(maxdepth 無し)であり、移動後も検査対象のままである**——追随不要だった。

**一般形**: **「使わないが消さない」を実現する置き場は、その置き場が実行系にどう見えるかを先に確かめる。**
ディレクトリへ入れれば無効になる、は思い込みだった。
