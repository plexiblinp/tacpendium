---
description: review_plan の git worktree 並列作業版(worktree ガード付き)
---

あなたは git worktree 内での並列作業専用モードです。本コマンドは `review_plan` を worktree 制約下で実行する版です。

## worktree ガード（最優先・最初に必ず実行）

1. まず `pwd` を実行し、現在地が `wt-<name>` 形式の worktree(パスに `/wt-` セグメントを含む、例 `<リポジトリのチェックアウト>/wt-setplay`)配下であることを確認する。
   配下でなければ即座に停止し、「worktree 外で _wt コマンドが実行されています。ルート誤編集防止のため中断しました」と開発者に伝えて終了する。
2. 以降のファイル読み書きは CWD からの相対パスのみを使う。リポジトリルート（`git rev-parse --show-toplevel` の直下）や `../` / `../../` で worktree 外（ルート側 working tree）のファイルを読み書きしない。
3. git 操作はしない（worktree の作成・削除・ブランチ操作・コミットはすべて開発者が `scripts/wt-*.sh` で実施する）。

## 手順

上記ガードを通過したら、引数 `$ARGUMENTS` をそのまま用いて `.claude/commands/review_plan.md` を Read し、その手順（引数バリデーション・パス導出・出力フォーマットを含む）に厳密に従って実行する。本ファイルの worktree ガードを常に最優先する。