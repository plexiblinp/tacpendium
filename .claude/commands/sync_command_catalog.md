---
description: .claude/commands/ を走査し、custom-commands.md（端末エイリアス cmds の元データ）への掲載漏れ・実体消失を監査して同期する
argument-hint: "[追加指示（任意）]"
allowed-tools: Read, Edit, Grep, Glob, Bash(ls:*), Bash(grep:*)
---

あなたは本プロジェクトの **カスタムコマンド・カタログ同期担当 Claude** です。
`.claude/commands/` の実体と `docs/human-notes/custom-commands.md`(端末エイリアス `cmds` が
要約表示する元データ)の整合を取ります。

追加指示: `$ARGUMENTS`(任意)

## 目的
- `.claude/commands/` にあるのに custom-commands.md へ未掲載のコマンドを検出し、家風の体裁で追記する。
- custom-commands.md に載っているのに実体ファイルが無いコマンドを警告する。

## 制約(先に厳守)
- 既存の手書きエントリは原則改変しない(掲載漏れの追記と実体消失の警告のみ)。明らかな誤記の修正は差分提示の上で。
- これは **スラッシュコマンドのカタログ**。`cmds` のようにコマンドファイルを持たない正規の補助
  エイリアス(行頭が `/` でない掲載)は監査対象外。
- 自動削除はしない(消失は警告のみ)。書き込み前に **追記/変更の差分を提示して承認を得る**。
- Git 操作はしない。`docs/human-notes/custom-commands.md` 以外は編集しない。

## 手順
1. **実体一覧**: `find .claude/commands -name '*.md' | sort` で全 `*.md` を取得する。
   **★平置きだけを見ないこと**(`ls .claude/commands/` では足りない)。
   **`.claude/commands/` のサブディレクトリは Claude Code の名前空間になる**——
   `old/resume_milestone_kit.md` のコマンド名は **`old:resume_milestone_kit`** であって
   `resume_milestone_kit` ではない。**コマンド名 ＝ `.claude/commands/` からの相対パスの `.md` を除いたもの、`/` はそのまま区切りとして残る。**
   **★2026-09-02 まで本手順は平置き前提で、`old/` へ退避したコマンドを「実体消失」と誤検出する状態だった**(`D-682`)。
2. **掲載確認**: 各コマンド名 `<n>` について `grep -F "/<n>" docs/human-notes/custom-commands.md`
   で起動行の有無を確認(`prompt-refine` 等ハイフン名もそのまま)。
3. **掲載漏れのエントリ作成**: 未掲載の各コマンドファイルを Read し、次の体裁で簡潔なエントリ案を作る。
   - 1行目(説明): `<短い役割名>担当CLI（補足）: <1〜2文の要約>`。要約は frontmatter `description`、
     無ければ本文1行目(ロール宣言)から起こす(frontmatter 非使用の旧コマンドがある)。
   - 2行目(起動行): `` `/<n> <引数例>` `` の形で **行全体をバッククォートで囲む**(`cmds` ビューアは
     「行頭かつ行末がバッククォートの行」を起動行として拾うため)。引数例は frontmatter
     `argument-hint`、無ければ本文の `$ARGUMENTS` 用法から推定、それも無ければ引数なし。
   - **ラベル整形の注意**: ビューア(`scripts/list-commands.sh`)は説明行を「最初の `:` の前 →
     さらに `CLI` 以降を除去」してラベル化する。先頭に短い役割名 + `: ` を置くと綺麗に出る。
4. **配置**: 通常コマンドは主一覧(最初の `---` の前)の末尾、`*_wt` は「git worktree 並列作業用」節、
   **`old:` 名前空間のものは「`old/` 退避(現役ではない)」節**へ、その他は最も妥当な節へ。各エントリは前後を空行で区切る。
5. **実体消失の警告**: custom-commands.md の各起動行 `` `/<x>` `` について `.claude/commands/<x>.md`
   が無ければ警告として列挙する(削除はしない)。**★`<x>` に `:` を含む名前空間コマンドは
   `.claude/commands/<x の `:` を `/` に置換>.md` を見ること**(例 `/old:resume_milestone_kit`
   → `.claude/commands/old/resume_milestone_kit.md`)。**素直に `<x>.md` を探すと必ず消失と出る。**
6. **差分提示 → 承認 → Edit で追記**。

## 出力
- 追記したエントリ、警告(実体消失・要手当て)、「差分なし」の別を簡潔に報告する。

## 判断に迷ったら
- 推測で要約した箇所は「推測: 〜」と明記する。
- 体裁や分類に迷う・既存と整合しない時は独断で大改変せず、提示して開発者に確認する。
