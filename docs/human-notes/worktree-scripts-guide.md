# git worktree スクリプト + 並列コマンド ガイド(開発者向け運用メモ)

| 項目 | 内容 |
|------|------|
| 文書ID | WORKTREE-SCRIPTS-GUIDE |
| バージョン | 1.1.0 |
| 作成日 | 2026-06-09(1.1.0: 2026-07-04 worktree 並列 E2E ポート導出の前提を追記) |
| 用途 | devContainer 環境で git worktree による並列作業を低認知負荷で開始/終了するための `scripts/wt-*.sh` と、並列専用カスタムコマンド(`*_wt`)の使い方メモ。指示書本体ではないため Claude Code への必読指定はしない |
| 関連 | 旧方式(リポジトリ外配置・手動 git)の運用メモは [`parallel-execution-guide.md`](parallel-execution-guide.md)。コマンド一覧は [`custom-commands.md`](custom-commands.md) |

---

## 0. なぜこの仕組みか(背景)

- 本プロジェクトは devContainer で開発しており、永続マウントは **`/workspaces/<チェックアウト名>` のみ**（★`workspaceFolder` を指定していないので、VS Code の既定でリポジトリのディレクトリ名がそのまま入る。現在は `tacpendium`）。worktree はこの配下（**リポジトリ直下の `wt-<name>`**）に置く必要がある(リポジトリ外に置くとコンテナ再生成で消える)。
- 配置は **リポジトリ直下 + `wt-` 接頭辞**(例 `wt-setplay/`)。以前は `.worktrees/<name>` に置いていたが、devContainer の各種ツールは `tacpendium/<folder>/.git` は辿れても `tacpendium/.worktrees/<folder>/.git`(隠しディレクトリ配下の 1 段深いネスト)を辿れないため、リポジトリ直下へ移した(2026-07-03)。`wt-` 接頭辞は worktree 専用の予約名前空間であり、既存フォルダ(`automation-project` 等の保護対象や `cmd`/`internal`/`web` 等のプロジェクト実体)と物理的に衝突しない。
- worktree をリポジトリ内にネストさせると、各種ツールが二重に拾う/設定が衝突するため、対策込みのスクリプトで定型化した。
- Claude Code は git 操作禁止(`.claude/settings.json` deny)。そのため **worktree の作成/削除は開発者がスクリプトで実施**し、Claude は worktree 内で「作業」だけを行う。

自動化している衝突対策:

| 衝突源 | 対策 |
|--------|------|
| `config.toml`(gitignore対象で新 worktree に無い) | スクリプトが自動生成 |
| バックエンドポート(既定 47319) | worktree ごとにユニークな値(47330〜)を自動割当 |
| 開発 DB(`[database].path` 空 = OS 共通 DB を共有し破壊) | worktree ローカル `./tacpendium-dev.db` を自動設定(`*.db` は gitignore 済み) |
| `web/node_modules`(gitignore対象) | スクリプトが `pnpm install` を実行 |
| Vite proxy の転送先 | `web/vite.config.ts` が `config.toml` の `[server].port` を読むため**自動追従**(手動設定不要) |
| Vite の listen ポート(5173 ハードコード) | 並列起動時のみ手動 `pnpm dev --port <N>`(スクリプトが推奨値を表示) |
| E2E の専用ポート(既定 47390 / 5273) | `web/playwright.config.ts` が `config.toml` の dev ポートから**自動導出**(手動設定不要)。詳細と前提は §3 参照 |

---

## 1. スクリプト一覧

すべて `scripts/` 配下。**git 操作を含むため開発者が実行する**(Claude Code には実行させない)。

| スクリプト | 役割 |
|-----------|------|
| `scripts/wt-new.sh <name> [base-branch]` | worktree を **リポジトリ直下 `wt-<name>`** に作成。ブランチ `wt/<name>` を `base`(既定 `main`)から作成(同名ブランチが既にあれば再利用)。config.toml をユニークポート + 専用 DB で生成し、`web` の依存をインストール。最後に「次にやること」を表示 |
| `scripts/wt-done.sh <name> [--force]` | `wt-<name>` の worktree を除去。**git に登録済みの worktree のみ対象**(非 worktree フォルダは削除しない安全ガード付き)。未コミット変更があれば中断(`--force` で強制)。ブランチは安全のため自動削除しない(削除コマンドを案内表示) |
| `scripts/wt-list.sh` | worktree 一覧と、各 worktree の割当バックエンドポートを表示 |

---

## 2. 使い方(開始 → 作業 → 終了)

### 2.1 開始

```bash
# リポジトリルートで(開発者が実行)
./scripts/wt-new.sh setplay
```

実行すると例えば次のように表示される:

```
✅ worktree を作成しました: wt-setplay  (branch: wt/setplay)
   backend port: 47330   vite port: 5174   DB: wt-setplay/tacpendium-dev.db

次の手順:
  cd wt-setplay && claude
  # バックエンド: make run-server                     (ポート 47330)
  # フロント:     cd web && pnpm dev --port 5174      (proxy は config.toml の 47330 を自動追従)
```

### 2.2 作業(worktree 内で Claude を起動)

```bash
cd wt-setplay && claude
```

worktree 内で起動した Claude では、相対パスがすべて worktree 側を指す。並列専用コマンドを使う:

```
/implement_plan_wt   M4-01-setplay-api.md
/review_plan_wt      M4-01-setplay-api.md
/incorporate_plan_wt M4-01-setplay-api.md
/research_plan_wt    M4-RESEARCH-01 [auto|plan] [自由入力]
```

`*_wt` は実行前に必ず `pwd` を確認し、`wt-<name>` 配下(パスに `/wt-` セグメントを含む)でなければ中断する(プロジェクトルート誤編集の防止)。中身は通常版コマンドを worktree 制約下で実行するだけなので、操作感は通常版と同じ。

アプリを動かす場合(別ターミナル、worktree 内):

```bash
make run-server                     # バックエンド(表示されたポート)
cd web && pnpm dev --port 5174      # フロント(表示された vite ポート)
```

### 2.3 終了

```bash
# Claude を抜けてからリポジトリルートで
git -C wt-setplay status    # 変更をコミット済みか確認(コミットは開発者)
./scripts/wt-done.sh setplay
# 案内に従い、マージ後にブランチ削除: git branch -d wt/setplay
```

### 2.4 状況確認

```bash
./scripts/wt-list.sh
```

---

## 3. 注意・既知の制約

- **初回の前提**: `scripts/wt-*.sh`・`.claude/commands/*_wt.md`・`.gitignore` の `/wt-*/` は、**先に `main`(= base ブランチ)へコミット**しておくこと。base に存在しないと、新 worktree でこれらが使えない。
- **Claude にスクリプトを実行させない**: git を含むため。worktree の作成/削除/マージ/ブランチ操作はすべて開発者が行う。
- **コミットは worktree 内で開発者が実施**: Claude は実装のみ。`git -C wt-<name> ...` または worktree に cd して通常どおり。
- **メモリ/プランの分離**: worktree パスで Claude を起動すると、プロジェクトキーが変わり `~/.claude/projects/-workspaces-<チェックアウト名>/` のメモリ・プランが読み込まれない。短命なタスク作業なら許容。共有したい場合はメモリディレクトリの symlink で対応可(任意)。
- **Vite の listen ポート**だけは手動指定が必要(proxy 転送先は自動追従)。
- **worktree 並列 E2E とポート導出の前提(2026-07-04 追記)**: 各 worktree で `make e2e` を同時実行しても衝突しないよう、E2E の 2 ポートは `web/playwright.config.ts` が **その worktree の dev バックエンドポート(`config.toml`)から決定的に導出**する(`BASE_DEV_PORT=47320` を基準にオフセット。ルート dev 47320 のときは従来の 47390/5273 に一致 = 後方互換)。dev DB が per-worktree 独立なのと対をなす対策。
  - **前提(トレードオフ)**: E2E 帯(47390+ / 5273+)は、dev ポートのスキャン範囲(各 dev port から netutil の +20)や dev vite 帯(5174+)と**被らない前提**で成り立つ。worktree の dev ポートは 47330 から 1 ずつ増えるため、E2E backend の基準 47390 に dev スキャン帯が接近するのは **worktree を十数個(目安 ~15+)同時作成した場合**。本運用は **2〜3 並列想定**なので実害は無いが、将来大量並列するなら `playwright.config.ts` の `BASE_*` オフセットを広げて帯を再分離すること。
  - **なぜコードで完全防御しないか**: 数個並列では非干渉で、導出方式は 1 ファイル・デフォルト不変・env プレフィックス不要と最小侵襲だから。より厳密にしたい場合の代替案は「E2E ポートを env 上書き可能(`TACPENDIUM_E2E_*`)にし `wt-new.sh` が割当」だが、2 ファイル変更 + 手動 env プレフィックスが要るため現状は採用しない。
- **撤回**: 並列をやめる場合は `.claude/commands/*_wt.md` と `scripts/wt-*.sh`、`.gitignore` の該当行を削除すれば原状復帰(既存コマンドは無改変)。

---

## 4. 旧ガイドとの関係

[`parallel-execution-guide.md`](parallel-execution-guide.md)(v1.0.0)は、worktree を**リポジトリ外**(`../combomgr-m1-04` 等)に置き、git・config.toml・node_modules を**手動**で扱う旧方式を記載している。本ガイドは devContainer の永続マウント制約に合わせ、**リポジトリ直下 `wt-<name>` + スクリプト自動化**へ更新したもの(当初は `.worktrees/` サブディレクトリだったが、devContainer のツールが隠しディレクトリ配下の `.git` を辿れない問題によりリポジトリ直下へ移した)。両者の整合(旧ガイドの改訂/統合)が必要なら別途対応する。

---

*以上*
