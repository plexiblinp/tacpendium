# IMPROVE-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/IMPROVE-01-clean-clone-toolchain.md` v1.1.0 |
| 対象チェックリスト | `docs/instructions/reviews/IMPROVE-01-review-checklist.md` v1.1.0 |
| 対象完了報告 | `docs/progress/improve-01-completion-report.md` |
| 対象差分 | `git diff origin/main...HEAD` = 4 ファイル(`.claude/hooks/session-start.sh` 新規 / `.claude/settings.json` / `Makefile` / 完了報告) |
| レビュー実施日 | 2026-08-19 |
| レビュー環境 | クラウド実行環境(Claude Code on the web) |
| 判定 | **差し戻しなし**(§8 重大判定 9 項目はいずれも非該当)。ただし **高 1 件**の修正を改善レーン完了前に要する |

---

## 総評

最重要ゲート(チェックリスト §1)は完全に守られている。`scripts/` 配下の差分ゼロ、`check-md-emphasis.sh:81` の `BASELINE_BROKEN=436` 不変、`docs/design/` 差分ゼロ、`--self-test` の陽性対照無改変を、レビュー側で独立に再実測して確認した。「検査を緩めて通した」形跡は一切ない。
hook 実装も指示書 §4.2 / §4.5 の要求を正面から満たしている。`set -e` を使わず末尾で無条件 `exit 0`、各ステップに冪等ガードと `timeout` 上限、出力は全て stderr、武装セッション向けに `web/package.json` の存在ガード。復旧手順も行番号つきで書かれており(実測で行番号も正しい)、開発者の起動確認待ちも明記されている。
一方で、指示書 §2.1 が成果物として明記した `docs/progress/progress-log.md` への索引行追記が実施されていない。しかも完了報告はそれを「実施」と書いており、恒久記録に実態と食い違う記述が残っている。これが唯一の「高」である。
その他は hook の防御的な穴(`GOPATH` 空時に `/bin` へ書き込みうる、`CLAUDE_ENV_FILE` 不在時に PATH が通らないまま「installed」と表示する)と、Makefile ガードの適用範囲が `e2e` / `test-web` に限られている点。いずれも中以下。

---

## 設計準拠性レビュー結果

### チェックリスト §0 前提(実査 5 項目)

**評価: ◎**

完了報告 §1 に 5 項目すべてが実測値つきで並んでいる。とくに §1-5(直す前の基準値)は `check-artifact-integrity.sh` の「違反 1 件」、`import markdown_it` の `ModuleNotFoundError`、`make e2e` の `ERR_MODULE_NOT_FOUND` を実出力で押さえており、「直った」の判定根拠として十分。
`make` のエラー行(アスタリスク 3 個)を意図的に転記から外し、その理由を書いている点も適切。転記が検査対象を汚す経路を先回りして潰している。

### チェックリスト §1 最重要ゲート(検査を緩めていないか)

**評価: ◎**(レビュー側で独立に再実測)

| # | 観点 | レビュー実測 |
|---|------|-------------|
| 1 | `scripts/` に振る舞いを変える差分が無いか | `git diff --name-only origin/main...HEAD -- scripts` → **0 件** |
| 2 | `--self-test` の陽性対照が弱まっていないか | 同上(スクリプト無改変)。`check-artifact-integrity.sh` の「OK check-md-emphasis.sh の自己検査が通る」は、対照が通った結果である |
| 3 | ベースライン値が動いていないか | `check-md-emphasis.sh:81` = `BASELINE_BROKEN=436`。実行結果も「現在 436 行 / ベースライン 436 行」 |
| 4 | `docs/design/` に差分が無いか | `git diff --name-only origin/main...HEAD -- docs/design` → **0 件** |

レビュー側で `bash scripts/check-artifact-integrity.sh` を実行し、**結果は「違反なし」**。基準値の「違反 1 件」からの改善が、環境側の是正のみで達成されていることが確定している。

### チェックリスト §2 本当に直ったか

**評価: ○**(3 項目中 2 項目が完全達成、1 項目が部分達成)

| # | 観点 | 判定 |
|---|------|------|
| 1 | `node_modules` を消してから `make e2e` が完走 | ◎ 完了報告 §4-1 に `rm -rf` → `make e2e` → `153 passed` の実出力あり |
| 2 | `check-artifact-integrity.sh` が「違反なし」 | ◎ 完了報告 §4-2。レビュー側でも再現 |
| 3 | `/app_build_check` が `govulncheck` を SKIP しない | △ 未達。「未インストール」による SKIP は解消したが、`vuln.go.dev` が egress 403 で DB 取得段階の SKIP に落ちる |
| 4 | フェンス付きコードブロックで書かれているか | ◎ 全て `E-126` 準拠。表のセルに出力を押し込んでいる箇所はない |
| 5 | 「人手の前準備なしで」通ったか | ◎ 前置きの混入なし。`pnpm install` を先打ちしていないことを §4-1 が明示している |

**§1.4-3 は達成できていない**(完了報告 §0 も自ら「△ 半分」と書いている)。ただしこれは指示書 §8.1 の停止条件ではなく、リポジトリ側から解けない環境ポリシーであり、完了報告 §9-1 が claude.ai 側の具体的な設定手順(雲アイコン → 歯車 → Network access = Custom → `vuln.go.dev` 追加、既定リストのチェックは外さない)まで書いて開発者へ渡している。escalate の形として適切。
また、原因の切り分け(§4-4)が優れている。`go install pkg@version` が govulncheck 自身の `go.mod` からツールチェーンを決めるため、素の go が古い環境では go1.24 でビルドされ本体コード(go1.26)を型検査できず、それが `app-build-supplychain-check.sh:92` の分岐で「ネットワーク/FW」と表示される——という因果を実測で分解している。版を上げても直らない(v1.7.0 でも go1.25 でビルドされる)ことまで潰しており、`GOTOOLCHAIN` 固定という修正の妥当性が示されている。

### チェックリスト §3 両方の環境に効いているか

**評価: ◎**

指示書 §1.5 の表が実測で埋まっており(完了報告 §2)、**指示書の想定と実測がずれていた点まで明示している**(devContainer の `govulncheck` は「要実査」だったが実体は導入済み ⇒ クラウド側の欠落は指示書の想定より 1 件多かった)。
hook を選んだ理由も 4 つの根拠(Dockerfile がクラウドで使われない実測 / 既存 hook がクラウドで発火している実績 / hook がパーミッション層をバイパスする / 公式ドキュメントの記載)で示されている。「一方で足りる理由」の説明義務(指示書 §2.1 の注記)も満たしている。
`.devcontainer/` の差分がゼロであることもレビュー側で確認済み(§1.6-3 のベースイメージ変更に触れていない)。

### チェックリスト §4 冪等性・安全性

**評価: ○**(要求は満たすが、防御的な穴が 3 つある。詳細は後述の中-1 / 中-2 / 中-3)

| # | 観点 | 判定 |
|---|------|------|
| 1 | 既に入っているときに何もしないか | ○ 3 ステップとも先頭にガード。実測 0.08 秒。ただし `govulncheck` は PATH に載らないケースで毎回再インストールになりうる(中-2) |
| 2 | 失敗してもセッションを止めないか | ◎ `set -e` 不使用・末尾で無条件 `exit 0`・4 パターンの実測あり。レビュー側でも `bash -n` 通過を確認 |
| 3 | 出力が静かか | ◎ 全出力 stderr。何もしなければ 1 バイトも出さない |
| 4 | `sudo` を使っていないか | ◎ 差分全体に `sudo` の出現ゼロ |
| 5 | `curl \| bash` / `wget \| sh` を使っていないか | ◎ 出現ゼロ。`pip` / `go install` / `pnpm` の 3 つだけ |

### チェックリスト §4.5 hook の安全性

**評価: ◎**

| # | 観点 | 判定 |
|---|------|------|
| 1 | 復旧手順が書かれているか | ◎ 完了報告 §8-2 に手順 1〜3。`.claude/settings.json` の 28〜35 行目を消す形で、**レビュー側で実際に行番号を突き合わせて正しいことを確認した**。ブロック本文も併記してあり、行番号が drift しても同定できる |
| 2 | 「開発者の起動確認待ち」が明記されているか | ◎ ヘッダの「状態」欄と §8-1 の 2 箇所。確認事項も 2 点に絞ってある |
| 3 | 段階を分けた場合、その理由 | ◎ 分けなかった理由を 2 つ明記(hook の中身は直接実行で 4 パターン検証済み / devContainer 側の差分がゼロなので段階分けが成立しない) |

リスクの所在を「hook 本体は必ず exit 0 するので、残るリスクは `.claude/settings.json` の JSON 構文だけ」と特定し `jq` で検証している点も的確。レビュー側でも `jq -e . .claude/settings.json` と `jq -e . .codex/hooks.json` の通過を確認した。

### チェックリスト §5 スコープ

**評価: ◎**

レビュー側で全対象を再実測し、いずれも 0 件を確認した。

```
scripts: 0 件 / docs/design: 0 件 / internal: 0 件 / web/src: 0 件 / cmd: 0 件
migrations: 0 件 / go.mod: 0 件 / go.sum: 0 件
web/package.json: 0 件 / web/pnpm-lock.yaml: 0 件 / .devcontainer: 0 件
```

CI(`.github/`)の新設もない。`docs/handover/followup-backlog.md` にも差分がなく、D-382(製造は §J 以外を編集しない)も守られている。

### チェックリスト §6 既存が壊れていないか

**評価: ○**

完了報告 §11 は `go test ./...` FAIL 0 / `make test-web` 1674 passed / `make e2e` 153 passed / 常設検査 6 本を掲げているが、**現 HEAD ではそのうち 1 本が赤になっている**(高-1)。他は再実測で緑を確認した。

```
$ bash scripts/check-artifact-integrity.sh
結果: 違反なし

$ bash scripts/check-md-emphasis.sh
現在 436 行 / ベースライン 436 行
OK  ベースラインどおり(増加なし)
結果: 違反なし

$ bash scripts/check-progress-log-index.sh
NG  作業 ID `improve-01` が docs/progress/progress-log.md に現れない
結果: 違反 1 件
```

チェックリスト §6-3(他のセッション種別で hook が悪さをしないか)については、完了報告 §5-1 が 8 種別の影響を表で整理し、武装相当・全ステップ失敗・pnpm 失敗の 3 パターンを実測している。とくに「調査セッションで `git status --porcelain` が空のままであること」を測っている点は、read-only 厳守を侵していない証明として適切。
また §5-2 で「これまで黙って失敗していた `post-edit-check.sh` / `stop-test.sh` が実際に動き出す」という体感変化を先回りして明示している。これは指示書が要求していない自発的な開示であり、質が高い。

### チェックリスト §7 引き継ぎ

**評価: △**

| # | 観点 | 判定 |
|---|------|------|
| 1 | スラッグが提案されているか | ◎ `clean-clone-missing-toolchain-deps`。3 行それぞれの畳み可否まで書き分け、`govulncheck-not-installed` だけは「畳まずに残すか改題」と正しく留保している |
| 2 | 製造が `followup-backlog` を編集していないか | ◎ 差分ゼロ |
| 3 | 脆弱性を本作業で直さずに報告しているか | ◎ §9-5 に `pnpm audit` の high 3 / moderate 4 を一覧化。本作業で新たに生じたものでないこと(依存ファイル差分ゼロ)も添えている |

**△ の理由は §7 の観点そのものではなく、引き継ぎ先の欠落**。`docs/progress/progress-log.md` への索引行が無いため(高-1)、本サブの成果が横断インデックスから辿れない。加えて §9-1 / §9-3 / §9-4 の 3 つの申し送りが完了報告の中にしか存在せず、継続更新ファイルへ着地していない(中-4)。

### チェックリスト §8 重大判定

**評価: ◎ 該当ゼロ**

| # | 重大 | 判定 |
|---|------|------|
| 8-1 | 検査スクリプトの振る舞いを変えて通した | 非該当(`scripts/` 差分ゼロ) |
| 8-2 | ベースライン値を動かした | 非該当(436 不変) |
| 8-3 | 「人手の前準備なし」を示していない | 非該当(前置きの混入なし) |
| 8-4 | hook が失敗時にセッションを止める | 非該当(`set -e` 不使用・無条件 `exit 0`・4 パターン実測) |
| 8-5 | `sudo` またはパイプ実行 | 非該当 |
| 8-6 | 本番コード・依存ファイルに差分 | 非該当 |
| 8-7 | `docs/design/` に差分 | 非該当 |
| 8-8 | 片方の環境しか直していないのに完了 | 非該当(1 経路で両環境に効く根拠あり) |
| 8-9 | hook を入れたのに復旧手順が無い | 非該当(§8-2 に行番号つきで記載) |

---

## 設計準拠性以外の指摘事項

### 高-1. `progress-log.md` への索引行追記が無く、完了報告は「実施」と書いている

**★これは「実装が変わったのに記述が旧のまま残っている」型である。**

指示書 §2.1 が成果物として `docs/progress/progress-log.md`(追記)を明記しており、CLAUDE.md §8 も「サブ完了時の追記は必須。指示書が明示的に求めていなくても追記する」と定めている。だが差分に同ファイルは含まれていない。

```
$ git diff --name-only origin/main...HEAD -- docs/progress
docs/progress/improve-01-completion-report.md

$ grep -c "IMPROVE" docs/progress/progress-log.md
0
```

**問題は追記漏れそのものより、恒久記録に食い違う記述が 2 箇所残っていることである。**

1. 完了報告 §■ 併せて更新が要るもの の「その他」欄: 「`docs/progress/progress-log.md` への索引行の追記(本報告と同じ手番で実施)」——**実施されていない**
2. 完了報告 §11: 「`check-progress-log-index` exit=0 結果: 違反なし」——**現 HEAD では赤**

2 は完了報告をコミットする前に測った値であり、測定時点では正しかった。だが読む側にはそれが分からない。CLAUDE.md §8 が「本検査は完了報告に対応する追記の欠落を検出する」ために設けたものである以上、**赤いまま「違反なし」と書かれた記録が残ると、後任は検査を回さずに本文を信じる**。

現 HEAD での実測:

```
$ bash scripts/check-progress-log-index.sh
## 2. 完了報告 → progress-log の追記カバレッジ

NG  作業 ID `improve-01` が docs/progress/progress-log.md に現れない(完了報告: docs/progress/improve-01-completion-report.md)
  索引行の形式は .claude/commands/implement_plan.md §「完了時」を参照

結果: 違反 1 件
```

**要修正**: `progress-log.md` へ索引行を追記し、完了報告 §11 の該当行を再測した値へ更新すること。§■ の「実施」は追記後に事実になるので、追記さえすれば文言はそのままでよい。

### 中-1. `pick_go_bindir` が `GOPATH` 空のとき `/bin` を返し、そこへバイナリを書きうる

`.claude/hooks/session-start.sh` の `pick_go_bindir`:

```bash
for d in "${GOBIN:-}" "$HOME/.local/bin" "$(go env GOPATH 2>/dev/null)/bin"; do
  [ -n "$d" ] || continue
  case ":${PATH}:" in *":$d:"*) printf '%s' "$d"; return 0 ;; esac
done
printf '%s' "$(go env GOPATH 2>/dev/null)/bin"
```

`go env GOPATH` が空文字を返すと 3 番目の候補が `/bin` になる。`/bin` は PATH に含まれているので `case` にマッチして即 `return` し、呼び出し側は `GOBIN=/bin go install …` を実行する。

レビュー側で再現を確認した。

```
$ HOME=/nonexistent-home PATH=/usr/bin:/bin GOBIN= ; pick_go_bindir
result=[/bin]
```

**クラウド実行環境は root で動いており、`/bin` への書き込みは成功してしまう。** CLAUDE.md §10 の目的「アプリ外のファイル・システムへの破壊的変更の防止」に触れる経路であり、しかも hook はパーミッション層をバイパスするため deny リストで止まらない。
発生確率は低い(`go env GOPATH` は通常 `$HOME/go` を返す。現環境は `/root/go`)が、防御は 1 行で済む。

**推奨**: `gopath="$(go env GOPATH 2>/dev/null)"` を先に取り、`[ -n "$gopath" ]` のときだけ候補に加える。末尾のフォールバックも同様にガードし、空なら空文字を返して呼び出し側の `[ -n "$bindir" ] || return 0` に拾わせる。

### 中-2. PATH に載らなかった場合、「installed」と出るのに `govulncheck` は使えないまま

`ensure_govulncheck` は、選んだ `bindir` が PATH 上に無い場合に (a) hook プロセスの PATH へ `export` し、(b) `CLAUDE_ENV_FILE` が設定されていればそこへ `export PATH=…` を追記する。

`CLAUDE_ENV_FILE` は実在の仕組みであることを確認した(`/root/.claude/skills/session-start-hook/SKILL.md:40`「`$CLAUDE_ENV_FILE` - Path to write environment variables」)。したがってクラウドでは意図どおり効く。

**問題は `CLAUDE_ENV_FILE` が無い環境**(devContainer の素の端末、`bash .claude/hooks/session-start.sh` の直接実行など)である。この場合:

- `printf … >>"$CLAUDE_ENV_FILE" || true` は `set -u` 下でも `${CLAUDE_ENV_FILE:-}` の空判定で回避されているためエラーにはならない。**代わりに何も起きない**
- hook は `installed govulncheck v1.1.4 -> /root/go/bin` と成功メッセージを出すが、**セッションからは `command -v govulncheck` が引けない**
- 次回起動時もガードが外れるので、**毎セッション `go install` を打ち直す**(指示書 §4.2-1 の冪等性が破れる)

現環境では `$HOME/.local/bin` が PATH 上にあるため顕在化していないが、環境依存で沈黙する形になっている。

**推奨**: `bindir` が PATH 外で、かつ `CLAUDE_ENV_FILE` も無い場合は、成功メッセージを「installed。ただし `<bindir>` が PATH に無いため、この環境では `PATH` へ追加が要る」という警告へ切り替える。

### 中-3. `markdown-it-py` だけバージョンが固定されていない

`govulncheck` は `GOVULNCHECK_VERSION="v1.1.4"` で固定(devContainer と揃えた理由も明記)、`pnpm install` は `--frozen-lockfile` で固定されている。**`markdown-it-py` だけが無指定で最新を取りに行く。**

```bash
run_capped 180 python3 -m pip install --user --quiet --disable-pip-version-check markdown-it-py
```

hook はパーミッション層をバイパスして実行され、かつ本プロジェクトの `/app_build_check`(サプライチェーン検査)の対象外である。開発ツールなので CLAUDE.md §6 の依存追加ポリシーには当たらない(指示書 §1.6-2 も「本作業が入れるのは開発ツール」と整理している)が、**同じ hook の中で 3 つのうち 2 つを固定し 1 つだけ固定しない**のは非対称であり、理由も書かれていない。
なお devContainer 側は apt の `python3-markdown-it` であり、そちらは版が固定されている。hook 経由だけが浮動する。

**推奨**: 版を固定するか、固定しない理由(例: `check-md-emphasis.sh` が API の細部に依存しないため)を hook 冒頭のコメントへ 1 行足す。

### 中-4. 申し送り 3 件が完了報告の中にしか無い

完了報告 §9-1(`vuln.go.dev` の egress 許可)/ §9-3(Codex 側の `.codex/hooks.json` 未同期)/ §9-4(`app-build-supplychain-check.sh` のメッセージが原因を切り分けられない)は、いずれも**別の担当が別の手番で処理する必要がある未解決事項**である。だが継続更新ファイルへは 1 行も着地していない。

- CLAUDE.md §10.Y は「新しいファイルを作る前に、継続更新ファイルへ行として足せないかを先に検討する」と定めており、逆に**継続更新ファイルへ足すべきものを新規ファイルの中だけに置くことも同じ問題**を生む
- D-382 により製造が直接書けるのは `followup-backlog.md` §J だけだが、**§J は書ける**。§9-1 と §9-3 は §J の必須 5 フィールド(ID / 発生元 / 未解消の理由 / 再開に必要な条件 / 記録日・状態)にそのまま収まる形をしている
- §9-4 はスクリプト改修の提案なので、設計伝達レポート §4 経由で設計卓へ渡すのが筋

とくに **§9-3(Codex 同期)は忘れられやすい**。`human-notes/codex/README.md:129` の同期トリガー表が「`.claude/settings.json` の hook 変更 → `.codex/hooks.json`」を明示的に求めており、**同期しないという判断そのものが記録として残る場所を必要とする**。完了報告はアーカイブされる資料であり、そこにしか無い未処理事項は消える。

**推奨**: §9-1 と §9-3 を `followup-backlog.md` §J へ 5 フィールドつきで記録する。§9-4 は設計伝達レポート §4 へ候補として上げる。

### 中-5. Makefile のガードが `e2e` / `test-web` にしか付いていない

`ensure-web-deps` を足した理由として、完了報告 §3-2 は「Claude Code を介さない素の端末から `make` を打つ場合」を挙げている。**その理由は `make build` にも等しく当てはまる。**

```
$ grep -n "^[a-z-]*:" Makefile
20:ensure-web-deps:
29:run-web:            ← cd web && pnpm dev
35:build:              ← cd web && pnpm build
42:build-windows:      ← 同上
46:build-darwin:
50:build-linux:
54:build-all:
61:test-web: ensure-web-deps
```

クリーンなクローン直後の利用者が最初に打つのは、おそらく `make test` でも `make e2e` でもなく `make build` である。README:21 が `cd web && pnpm install && cd ..` を手順として持っているので「手順どおりやれば踏まない」とは言えるが、それは `e2e` / `test-web` についても同じであり、**同じ理由で片方だけ守るのは一貫していない**。

**推奨**: `run-web` / `build` / `build-windows` / `build-darwin` / `build-linux` にも `ensure-web-deps` を前提として足す。1 行ずつで済み、`ensure-web-deps` 自体が冪等なので副作用はない。

### 低-1. 復旧手順が行番号に依存している

完了報告 §8-2 の「`.claude/settings.json` の 28〜35 行目を削除する」は、**レビュー時点では正しい**(実測で確認済み)。だが `_hooks_comment` 配列は今後も段落が足される場所であり、1 段落増えるたびに行番号がずれる。
本プロジェクト自身が M22-06 の横断課題 7 で「調査レポートを引くときは結論と座標を分けて扱うこと。座標は必ず古くなる」(`E-56` の型)を教訓として残している。
緩和はされている——ブロック本文を JSON でそのまま併記しているため、行番号がずれても対象は同定できる。**推奨**: 「`"hooks": {` の直後にある `"SessionStart"` ブロック(2026-08-19 時点では 28〜35 行目)」のように、**構造による指定を主・行番号を従**にすること。

### 低-2. `_hooks_comment` の「両環境に効く唯一の経路」が Makefile 経路と整合しない

`.claude/settings.json:22` は「両環境に効く唯一の経路として hook を選んだ」と書くが、実際には `Makefile` の `ensure-web-deps` も入れており、完了報告 §3 は「採った経路は 2 つ」と書いている。
文意としては「3 件すべてを両環境で揃える経路としては hook が唯一」であり誤りではないが、settings.json だけを読む人には 2 つの記述が食い違って見える。**推奨**: 「3 件すべてを両環境で揃えられる経路は hook だけである(`node_modules` のみ `Makefile` 側にも二重の守りを置いた)」程度に補う。

### 低-3. 各ステップの timeout 合計(900 秒)が hook 全体の timeout(600 秒)を超える

hook 内コメントは「フック全体の timeout(600 秒)を 1 ステップのハングで食い潰さないため」と説明しているが、180 + 300 + 420 = 900 秒であり、**ステップ 2 と 3 が両方上限に張り付くと全体 600 秒を先に使い切る**。
実測 31 秒(cold)なので実害はなく、意図(1 ステップのハングで残りが飛ばないようにする)は達成されている。**推奨**: コメントの説明を実態に合わせるか、合計が 600 に収まるよう配分し直す。

### 低-4. 完了報告 §10 の `git diff --stat` が現 HEAD と 1 ファイルずれる

「3 files changed」と書かれているが、現 HEAD は完了報告自身を含めて 4 ファイル。報告作成時点のスナップショットとしては正しく、本文でも「本番コードを 1 バイトも触っていない」の根拠として使われているだけなので実害はない。高-1 の修正時に併せて再測すれば揃う。

---

## 推奨修正(優先度別)

### 高(改善レーン完了前に修正必須)

1. **`docs/progress/progress-log.md` へ IMPROVE-01 の索引行を追記する**(高-1)。指示書 §2.1 の成果物であり CLAUDE.md §8 の必須事項。あわせて**完了報告 §11 の `check-progress-log-index` の行を再測値へ更新する**——現 HEAD で赤なのに「違反なし」と書かれた記述が恒久記録に残っている状態は、後任が検査を回さずに本文を信じる経路を作る。

### 中(次の作業と並行可)

2. **`pick_go_bindir` の `GOPATH` 空ガード**(中-1)。`/bin` へバイナリを書きうる経路を 1 行で塞ぐ。root で動くクラウド環境では実際に書けてしまう。
3. **PATH に載らなかった場合のメッセージ是正**(中-2)。「installed」と出るのに使えず、かつ毎セッション再インストールになる沈黙した失敗を、警告として見えるようにする。
4. **`markdown-it-py` の版固定、または固定しない理由の明記**(中-3)。同じ hook 内で 3 つのうち 2 つを固定している以上、非対称の理由は書かれているべき。
5. **申し送り §9-1 / §9-3 を `followup-backlog.md` §J へ記録する**(中-4)。§9-4 は設計伝達レポート §4 へ。完了報告にしか無い未処理事項は、報告がアーカイブされた時点で消える。とくに Codex 同期は `human-notes/codex/README.md:129` が明示的に求めているため、「同期しない判断」自体を追跡可能にする必要がある。
6. **`ensure-web-deps` を `run-web` / `build` / `build-*` にも前提として足す**(中-5)。「素の端末から `make` を打つ場合」という導入理由が、より打たれやすいターゲットに適用されていない。

### 低(将来対応)

7. 復旧手順を構造指定主・行番号従に書き換える(低-1)。
8. `.claude/settings.json` の「唯一の経路」を Makefile 経路と整合させる(低-2)。
9. ステップ timeout の合計と全体 timeout の関係を、コメントか配分のどちらかで揃える(低-3)。
10. 完了報告 §10 の `git diff --stat` を最終差分で取り直す(低-4)。
11. `check-doc-inventory` の TYPES 表への改善レーン成果物の型登録(完了報告 §11 の注記どおり、2 件目の改善レーンが出た時点で開発者・設計卓が判断)。

---

## 良かった点

- **最重要ゲートを、言葉ではなく検証可能な形で示している。** 完了報告 §7 が歯止め 4 つそれぞれに `git diff --name-only … | wc -l` の実測とベースライン値の実出力を並べており、レビュー側は同じコマンドを打つだけで独立に再現できた。「緩めていません」という宣言だけの報告とは質が違う。
- **原因の切り分けが最後まで行われている。** govulncheck が「ネットワーク障害に見えて実体はツールチェーンのビルド版ずれだった」件(§4-4)は、版を上げても直らないこと(v1.7.0 でも失敗)、devContainer では元から健全だったこと、表示メッセージが両者を区別しないことまで分解している。**そのうえでスクリプトの改修に手を出していない**——歯止め §1.3-1 に当たると自ら判定し、申し送りに回した。ここで直してしまうのが最も起きやすい失敗であり、踏みとどまっている。
- **副作用を先回りして開示している。** §5-2 の「これまで黙って失敗していた `post-edit-check.sh` / `stop-test.sh` が実際に動き出す」は指示書が要求していない。編集ごとの待ちが増える体感変化を、良い変化だと分かったうえで明記している。
- **失効した記述を自分から直している。** `_hooks_comment` の「ネットワーク無し」が hook 導入で事実に合わなくなったことに気づき、書き換えたうえで変更の経緯も残した(§10-1)。レビュー側で全文検索したが、同じ主張の写しは他ファイルに残っていない。**本プロジェクトが最も重く見ている「実装が変わったのに記述が旧のまま」の型を、指摘される前に潰している。**
- **失敗パターンを実測している。** 冪等性を「そう書いた」ではなく、正常 / 武装相当 / 全ステップ失敗 / pnpm 失敗の 4 パターンで `EXIT=0` を測っている。とくに `git status --porcelain` が空のままであることを測り、調査・レビュー担当の read-only を侵さないことを示した点は、要求されていない検証であり価値が高い。
- **採らなかった選択肢とその理由が書かれている**(§3-3)。`postCreateCommand` / Dockerfile / クラウドの Setup script の 3 つについて、なぜ選ばなかったかが読める。次に同じ判断をする担当が探索をやり直さずに済む。

---

## 不明点

- **不明: クラウド実行環境のコンテナキャッシュが SessionStart hook の完了後にスナップショットされるかどうか、本レビューでは判定できない。** 完了報告 §9-2 は「Setup script の完了後にスナップショットされる。SessionStart hook の導入結果はスナップショットに入らない」と断定し、その前提で開発者へ Setup script の追加(手番 B)を求めている。一方 `/root/.claude/skills/session-start-hook/SKILL.md:66` は「The container state gets cached after the hook completes, prefer dependency install methods that take advantage of that」と書いており、**hook の結果もキャッシュされると読める**。もし後者が現行の挙動なら、§9-2 の「新規セッションのたびに 31 秒かかる」は成り立たず、開発者に不要な設定作業を求めることになる。完了報告に根拠(実測かドキュメントか)が書かれていないため、どちらが正しいか判断できない。**手番 B は任意扱いなので実害は限定的だが、断定の根拠を添えるか、断定を弱めることを推奨する。**
- **不明: Codex 0.147.0 に `SessionStart` 相当のイベントが存在するかどうか、本レビュー環境からは測れない。** 完了報告 §9-3 の判断(証拠が無いので同期しない・差分と必要な同期内容を報告する)は `human-notes/codex/README.md` §3 の定めに沿っており、手続きとしては妥当。ただし同期完了・不要の確定は `/sync_codex_config` の手番として残る(中-4 に含めた)。
- **不明: 新しいセッションが実際に起動するかどうかは、本レビュー(既存セッション内)では検証できない。** 指示書 §4.5-1 のとおり開発者の手番であり、完了報告もそう明記している。**本レビューは「hook が起動を妨げない設計になっていること」までしか判定していない**——具体的には `bash -n` 通過、`jq -e` による JSON 妥当性、`set -e` 不使用、末尾の無条件 `exit 0`、4 パターンの exit 0 実測の 5 点。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- とくに**新規セッションの起動確認は開発者の手番であり、本レビューでは代替できない**(指示書 §4.5)。
- クラウド実行環境固有の挙動(コンテナキャッシュの範囲、egress ポリシー)については、リポジトリ内から確認できる範囲を超える部分を「不明点」として分離した。

---

*以上、IMPROVE-01 レビュー報告書。配置 `docs/progress/improve-01-review.md`。* **検査は緩められていない——それはレビュー側で独立に再実測して確認した。残る「高」は 1 件、成果を横断インデックスへ着地させることである。**


---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C による自動トリアージ。**採否と理由を事後監査できるよう本節へ残す。**
**優先度「高」の不採用はゼロ**のため、開発者へのエスカレーションは発生していない。

| 指摘 | 優先度 | 採否 | 理由・対応 |
|---|---|---|---|
| 1. progress-log へ索引行を追記／完了報告 §11 を再測値へ | 高 | **採用** | `docs/progress/progress-log.md` へ `### IMPROVE-01:` 節を追記（横断課題 7 件つき）。`check-progress-log-index.sh` は「検査した 44 件すべてが progress-log に現れる／違反なし」へ。完了報告 §11 は再測値へ差し替え、**予定を実測として書いていた事実そのものも明記**した |
| 2. `pick_go_bindir` の GOPATH 空ガード | 中 | **採用** | `${gopath:+$gopath/bin}` で空のとき候補ごと落とし、全候補が空なら何も返さない（呼び出し側が `[ -n "$bindir" ]` で return）。`/bin` へ書きうる経路が消えたことを再現テストで確認 |
| 3. PATH に載らなかった場合のメッセージ是正 | 中 | **採用** | `CLAUDE_ENV_FILE` への追記が成功したときだけ黙る形へ変更。失敗時は「毎回入れ直しになる」ことを含めて警告する。沈黙した冪等性の破れを可視化した |
| 4. `markdown-it-py` の版固定、または理由の明記 | 中 | **採用（理由を明記する側）** | **版は固定しない。** 揃える相手である devContainer 側が apt の `python3-markdown-it` で**版を指定していない**ため、pip 側だけ固定すると逆に両環境がずれる。この非対称の理由をスクリプト冒頭のコメントへ明記した |
| 5. 申し送りを `followup-backlog.md` §J ／ 設計伝達レポートへ | 中 | **採用** | §9-1 と §9-3 を §J へ登録（`cloud-env-cannot-reach-vuln-go-dev` ／ `codex-hooks-sessionstart-sync-pending`。必須 5 フィールド充足・`check-stop-discipline.sh` 緑）。§9-2 と §9-4 は §J の「未解消のまま停止した項目」に当たらないため progress-log の横断課題へ索引を置いた。**設計伝達レポートは指示書 §9 の「完了後の次ステップ」であり本コマンドの範囲外**（`/design_handover_report` の手番） |
| 6. `ensure-web-deps` を `run-web` / `build` / `build-*` にも | 中 | **採用** | pnpm を呼ぶ 8 ターゲットすべてに前提として付けた（`run-web` / `build` / `build-debug` / `build-windows` / `build-darwin` / `build-linux` / `test-web` / `e2e`）。go しか使わない `run-server` / `test-go` / `tidy` には付けていない。ターゲット注記も実態へ更新 |
| 7. 復旧手順を構造指定主・行番号従へ | 低 | **採用** | 「`"hooks": {` の直後・`"PreToolUse": [` の直前のブロック」を主に、行番号を補助にした。**行番号は `_hooks_comment` に 1 行足しただけでずれる**ことと、`grep -n` での探し方も併記（`E-56` の型） |
| 8. `.claude/settings.json` の「唯一の経路」を Makefile 経路と整合 | 低 | **採用** | 「3 件すべてを両環境で揃えられる経路」と書き換え、node_modules については `ensure-web-deps` を併用する旨と、その必要性（hook はセッション起動時にしか走らない）を追記 |
| 9. ステップ timeout と全体 timeout の関係を揃える | 低 | **採用** | 上限を 120 / 240 / 240 = 600 秒に配分し直し、hook timeout を 660 秒へ。**最悪ケースでもハーネスの強制終了より先に自前の上限で打ち切って `exit 0` できる**関係にしたうえで、その関係をコメントへ明記 |
| 10. 完了報告 §10 の `git diff --stat` を最終差分で取り直す | 低 | **採用** | 取り込み後の値（7 ファイル・1210 insertions）へ差し替え。実装 3 ファイルと記録 4 ファイルの内訳も明記 |
| 11. `check-doc-inventory` の TYPES 表へ改善レーンの型を登録 | 低 | **不採用（他者の手番）** | **2 つの理由で製造は触れない。** (a) `scripts/` は本サブの変更禁止領域であり（指示書 §2.2-1）、**検査を通すために検査を触るのは歯止め §1.3-1 そのもの**。(b) `CLAUDE.md` §10.Y は「運用として定着した型だけを TYPES へ昇格」「EXCEPT へ足して黙らせるのは開発者の承認を得たときだけ」と定めており、改善レーンの成果物は**これが 1 件目**で「定着」とは言えない。**⇒ 2 件目の改善レーンが出た時点で設計卓・開発者が判断すること**を完了報告 §11 と progress-log 横断課題 4 に記録した。なお同検査は常に exit 0 の情報提供型で赤にはならない |
| 不明点 A. クラウドのキャッシュが hook 後に取られるか | — | **採用（断定を撤回）** | 完了報告 §9-2 の断定を取り下げ、**出典 2 つの食い違いを併記**したうえで「本セッションからは確定できない」と明記。判定方法（新規セッションを 2 本起動して 2 本目の hook が無音か）も添えた。**どちらであっても Setup script の提案自体は成立する**ことも明示 |
| 不明点 B. Codex に SessionStart 相当が在るか | — | **採用** | §J の `codex-hooks-sessionstart-sync-pending` に「再開に必要な条件」として確認手順を記録 |
| 不明点 C. 新規セッションの起動確認 | — | **採用（開発者の手番）** | 指示書 §4.5-2 のとおり完了報告 §8-1 に「開発者の起動確認待ち」を明記済み。本サブはここで止まる |

### 取り込み後の再検証

```
check-artifact-integrity         exit=0  結果: 違反なし
check-progress-log-index         exit=0  結果: 違反なし
check-stop-discipline            exit=0  結果: 違反なし
check-md-emphasis                exit=0  現在 436 行 / ベースライン 436 行(不変)
check-doc-inventory              exit=0  結果: 型に無いファイル 4 件(情報提供型)
check-instruction-format         exit=0  結果: 違反なし
check-doc-refs                   exit=0  結果: dead reference なし
check-browser-storage-keys       exit=0  結果: 違反なし
go test ./...                    FAIL 0(ok 53 パッケージ)
make test-web                    170 files / 1674 tests passed
make e2e                         153 passed(node_modules 削除後・前準備なし)
hook(warm)                       0.082 秒・無音・exit 0
```

**禁止領域の差分は取り込み後もゼロ**（`scripts` / `docs/design` / `internal` / `web/src` / `cmd` / `migrations` / `go.mod` / `go.sum` / `web/package.json` / `web/pnpm-lock.yaml` / `.devcontainer`）。

**★再レビューの往復は行っていない**（往復上限 2 回に対して 0 回）。**「高」1 件はいずれも記録の不整合であり、指摘どおりに直せば足りる性質のもので、判断を要する論点が残っていないため。**
