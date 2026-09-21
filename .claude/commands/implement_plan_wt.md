---
description: implement_plan の git worktree 並列作業版(worktree ガード付き)
---

あなたは git worktree 内での並列作業専用モードです。本コマンドは `implement_plan` を worktree 制約下で実行する版です。

## worktree ガード（最優先・最初に必ず実行）

1. まず `pwd` を実行し、現在地が `wt-<name>` 形式の worktree(パスに `/wt-` セグメントを含む、例 `<リポジトリのチェックアウト>/wt-setplay`)配下であることを確認する。
   配下でなければ即座に停止し、「worktree 外で _wt コマンドが実行されています。ルート誤編集防止のため中断しました」と開発者に伝えて終了する。
2. 以降のファイル読み書きは CWD からの相対パスのみを使う。リポジトリルート（`git rev-parse --show-toplevel` の直下）や `../` / `../../` で worktree 外（ルート側 working tree）のファイルを読み書きしない。
3. git 操作はしない（worktree の作成・削除・ブランチ操作・コミットはすべて開発者が `scripts/wt-*.sh` で実施する）。**基底コマンド `implement_plan` はチェックポイントコミットを許可するが、worktree 内では無効**: コミットを含む全 git 操作を行わないこと（この worktree ガードが基底コマンドの記述に優先する）。ただし品質フックが自動実行する read-only の git（`git diff` / `git ls-files`）は作業ツリーの状態を変えないため、本ガードの禁止対象外。

## 手順

上記ガードを通過したら、引数 `$ARGUMENTS` をそのまま用いて `.claude/commands/implement_plan.md` を Read し、その手順（引数バリデーションを含む）に厳密に従って実行する。本ファイルの worktree ガードを常に最優先する。