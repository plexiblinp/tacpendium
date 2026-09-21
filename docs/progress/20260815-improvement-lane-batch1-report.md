# 改善レーン 第 1 束 完了報告（`scripts/` ＋ `make e2e` の起動前提）

| 項目 | 内容 |
|------|------|
| 実施 | Claude Code（武装しないセッション） / 2026-08-15 |
| 指示 | `docs/handover/session-prompts/20260814-improvement-lane-batch1.md` |
| ブランチ | `claude/improvement-lane-batch1-rkky3y`（起点 `ebcd5dd`） |
| 追跡 | followup `md-emphasis-check-excludes-progress-dir` ／ `e2e-config-toml-bootstrap-on-clean-clone` ／ `cloud-e2e-setup-preconditions` |
| 触ったファイル | `scripts/check-md-emphasis.sh` ／ `Makefile` ／ `docs/process/remote-ops.md` ／ 本報告 ／ `docs/progress/progress-log.md` |
| 消費 | CHANGE 番号 0 ／ マイグレーション 0 ／ 設計書の変更 0 |

---

## 1. 作業 1: `check-md-emphasis.sh` の走査対象

### 1.1 変えたこと

| # | 内容 |
|---|------|
| 1 | 走査対象へ `docs/progress` を追加した |
| 2 | 除外を `/phase1/` `/phase2/` の名指しから `/phase[0-9]+/` の形へ一般化した。`/archive/` の除外は維持 |
| 3 | ヘッダの「対象範囲」節を現況へ書き換えた（旧版は「`docs/progress/` も除外」と逆のことを書いていた） |
| 4 | `BASELINE_BROKEN` を 372 から 438 へ取り直した |

### 1.2 ベースラインの内訳（両方向に動いた）

| 区分 | ファイル数 | 検出行 |
|---|---|---|
| 改修前の対象 | 392 | 373 |
| うち `phase[0-9]+/` の一般化で除外に入った分 | — | **−121**（`docs/handover/phase3` 20 ／ `docs/instructions/phase3` 101） |
| `docs/progress` の取り込みで増えた分 | — | **+186** |
| 改修後の対象 | 382 | **438** |

**ファイル数はいずれも起点 `ebcd5dd` 時点の測定値である。** HEAD では本報告自身が `docs/progress/` へ加わるため 383 ファイルになる（検出行は 438 のまま。本報告に閉じない強調が無いため）。

`373 − 121 + 186 = 438`。指示書 §1.2 の予告どおり、増える方向と減る方向の両方が出た。

改修後の検出行のディレクトリ別内訳: `change-notes` 52 ／ `design` 14 ／ `handover` 131 ／ `instructions` 45 ／ `process` 10 ／ `progress` 186。

`docs/progress/` の既存 186 行は直していない（指示書 §4-2）。

### 1.3 陽性対照 3 件（`SUPP-001` §5.5 規約 11′）

**対照 1 — `docs/progress/` 配下の既知の 1 件が拾えること**

| 項目 | 結果 |
|---|---|
| 検体 | `docs/progress/20260802-whiff-discriminator-search-report.md:186` |
| 改修後の `--list` に現れるか | 1 件（現れる） |
| 改修前の `--list` に現れるか | 0 件（現れない） |
| ファイル指定での単独実行 | `検出: 1 行` |

改修前後を対で示したので、拾えたのが本改修の効果であると言える。

**対照 2 — 除外が効いていること**

「除外した」だけでは、そもそも 0 件だった可能性と区別できないため、**先に実在を確かめた。**

| 項目 | 結果 |
|---|---|
| `docs/*/phase[0-9]*/` 配下の `.md` | 481 ファイル（11 ディレクトリ） |
| そこにファイル指定実行で検出される閉じない強調 | **175 行**（`change-notes/phase2` 3 ／ `handover/phase1` 7 ／ `handover/phase2` 2 ／ `handover/phase3` 20 ／ `instructions/phase1` 15 ／ `instructions/phase2` 6 ／ `instructions/phase3` 101 ／ `progress/phase2` 8 ／ `progress/phase3` 13） |
| そのうち `--list` に混入した数 | **0 行** |

175 行が実在するのに 1 行も数えられていない。除外は空振りではなく実際に効いている。

**対照 3 — `--list` の出力にアーカイブのパスが 1 件も現れないこと**

| 項目 | 結果 |
|---|---|
| `--list` 中の `/archive/` | 0 件 |
| `--list` 中の `/phase[0-9]+/` | 0 件 |
| 対照として、`docs/*/archive/` に実在する閉じない強調 | **14 行**（10 ファイル） |

**母集合の定義**: 上の 14 行は `docs/*/archive/`（深さ 2 のグロブ）が当たる `docs/handover/archive/` ／ `docs/human-notes/archive/` ／ `docs/process/archive/` の 3 か所を数えた値である。`docs` 配下の archive を再帰で全部数えると 17 ファイル・18 行になり、差分の 4 行は `docs/human-notes/future-notes/archive/` にある。**同ディレクトリは走査の起点 6 つに含まれないため結論は変わらない**が、母集合を書かないと追試した側が食い違いを疑う。

**自己検査**: `bash scripts/check-md-emphasis.sh --self-test` は 4 対照すべて OK で「自己検査: 合格」。

### 1.4 ★「ベースラインが基点で 1 行ずれていた」の原因が分かった

`M21-06` 設計伝達レポート §4-6 と `M20-07` 完了報告 §11 が報告していた「現在 373 行 / ベースライン 372 行」の +1 は、**測り間違いでも走査の破損でもなかった。並走レーンの持ち込みである。**

**確かめ方**: `734cd9b` の `docs/` ツリーを `git archive` で取り出し、改修前の絞り込み条件と同一の 376 ファイルへ同じ判定ロジックを掛けた。

| 事実 | 値 |
|---|---|
| `734cd9b` のツリーでの実測 | **372 行**。同コミットが書き込んだ定数と一致しており、**そのツリーでは正しかった** |
| HEAD での実測 | 373 行 |
| 差分の正体 | `docs/handover/design-reports/20260814-m20-05-design-exceptions.md:29` の 1 行だけ |
| その 1 行を持ち込んだコミット | `7ea1877`「docs(M20-05): 設計伝達レポートを作成」 |
| `7ea1877` と `734cd9b` の関係 | **互いに祖先ではない。** merge-base は `6d86e56`。時刻は 07:03 UTC と 14:13 UTC で同日 |

つまり `734cd9b`（M21-05 レーン）が自分のツリーで 372 を実測して定数を下げたとき、**並走していた M20-05 レーンが持つ 1 行は視界に無かった。** 両者が main で出会った時点で総数が 373 になり、定数だけが 372 のまま残った。

**⇒ 一般則**: `BASELINE_BROKEN` は作業ツリー全体の総数である。**部分的なツリー（レーン・worktree・ブランチ）で測った値を全体の事実として書き込むと、マージした瞬間にずれる。** 下げるのは並走が解けている手番に限ること。この注意をスクリプトのコメントへ入れた。

**あわせて分かったこと**: 当該行が壊れる形は、既知の型（閉じ `**` の直前が全角の約物）とは**別の型**だった。

``… 代わりに**`PUT /api/config`（既定プリセットの切替）が呼出元に加わる**。``

（上記は 1 行のインラインコードとして引用している。フェンス付きコードブロックへ置くと、本検査は行単位で描画するためコードブロックであることを認識できず、引用そのものを検出してしまう）

開き `**` の直後がコードスパンのバッククォートであり、直前が日本語文字である。CommonMark の left-flanking 条件（直後が約物なら直前が空白か約物であること）を満たさないため、**開き側が開き記号として認められず両方リテラルで残る。** ヘッダのコメントが挙げている例だけを覚えていると、この形は見落とす。

---

## 2. 作業 2: `make e2e` が起動前提を吸収する

### 2.1 変えたこと（`Makefile`）

| # | 内容 |
|---|------|
| 1 | `e2e` の前段で、`config.toml` が**不在のときだけ** `config.toml.example` から生成する |
| 2 | `PW_EXECUTABLE_PATH` が未設定で、かつ `/opt/pw-browsers/chromium` が実在するときだけ自動採用して export する。環境変数が既にあればそちらを尊重する |

### 2.2 ★既存の `config.toml` を上書きしない判断（指示書 §2.2-2 からの逸脱と、その理由）

指示書 §2.2-2 は開発者判断として上書きを**許可**していたが、**許可は要求ではない**ため、実際の失敗条件である「不在」だけを潰す形にした。開発者へ照会し、この方針で確定している。

理由: `scripts/wt-new.sh:65-69` が worktree ごとに `[server].port`（`scripts/wt-new.sh:56` で 47330 から探索）と `[database].path`（`./combomgr-dev.db`）を書き換えた `config.toml` を生成している。無条件に上書きすると、

- worktree のポート分離が壊れる（複数 worktree で dev サーバが取り合う）
- worktree ローカルの dev DB パスが OS 標準の場所へ戻る
- `web/playwright.config.ts` が同じ値から E2E ポートのオフセットを導出しているため、E2E ポートの分離も同時に壊れる

指示書の「ほぼ既定設定で使っており、問題が起きればバックアップから戻す」という前提は、ルートの `config.toml` については成り立つが、`wt-new.sh` が作る worktree の `config.toml` については成り立たない。

### 2.3 破壊確認と対照（`SUPP-001` §5.5 規約 10′）

| # | 条件 | 結果 |
|---|------|------|
| 1 | `config.toml` を消してから `make e2e` | **緑。103 passed / exit 0 / 1.7 分。** 出力は `Created config.toml from config.toml.example` と `Using preinstalled Chromium: /opt/pw-browsers/chromium` |
| — | 内訳の注記 | **本束の 2 回の実行はいずれも `103 passed`（flaky 0）だったが、クリーンルームレビューの実行では `102 passed` ＋ `1 flaky` で総数 103 だった。** flaky は `m18-03c-drainage.spec.ts` の 1 件で retry で通っている。**⇒ 「103」は総数であり、passed の件数は回ごとに揺れる。** 既知の flaky として記録する |
| 2 | **対照**: 前段だけを無効化した `Makefile` で、`config.toml` 不在のまま実行 | **赤。58 failed / 2 passed**（retry を含み 10 分で打ち切り）。`web/test-results/*/error-context.md` に `heading "初期設定"` と `heading "ようこそ"` が出ており、**全ページがウィザードへ飛ばされたことまで確認した** |
| 3 | 既存の `config.toml` がある状態 | **緑。103 passed / exit 0。** 出力は `Using existing config.toml (not overwritten)` |

対照 2 の `Makefile` はリポジトリ外（scratchpad）に生成し、`make -f` で回した。リポジトリの `Makefile` は改変していない。

**対照 3 の追加確認（worktree 分離が保たれること）**: `[server].port = 47330` と `[database].path = "./combomgr-e2e-ctrl3.db"` を書いた worktree 相当の `config.toml` を置いて実行したところ、**実行後も 2 値とも保たれていた。** 上書きしない方式が意図どおり働いている積極的な証拠である。

**★ただし E2E スイート自体は `config.toml` を書き換える。** 実行後、TOML が再シリアライズされてコメントが全部落ち、`[defaults] character_id = 1 / preset_id = 1` が追加されていた。これは `PUT /api/config` を踏む spec による**既存挙動**であり、本束の変更とは別である。重要なのは、**E2E が使う env override（`COMBOMGR_PORT` = 47400 ／ `COMBOMGR_DB_PATH` = `web/e2e/.tmp/...`）は焼き付いていない**ことで、`config-toml-write-back-env-asymmetry` の是正（2026-08-14）がそのまま効いていることを再確認できた。

### 2.4 E2E ポートのオフセットが変わる（副作用。害は無い）

`web/playwright.config.ts` は `config.toml` の `[server].port` を読み、`BASE_DEV_PORT = 47320` からの差分だけ E2E ポートをずらす。

| 状況 | 読まれる dev port | オフセット | E2E backend / vite |
|---|---|---|---|
| `config.toml` 不在（改修前のクラウド実行時） | 47320（フォールバック） | 0 | 47390 / 5273 |
| example から生成（改修後） | 47318 | −2 | 47388 / 5271 |
| worktree 相当（対照 3） | 47330 | +10 | 47400 / 5283 |

`config.toml.example` の `port` が 47318 で、`BASE_DEV_PORT` の 47320 と一致していないためである。両ポートが揃ってずれるだけで、dev のポート帯とも衝突しない。3 条件とも実測で完走している。**`config.toml.example` の値を 47320 へ揃えるかどうかは配布物の既定値の話であり、本束では触っていない。**

### 2.5 `PW_EXECUTABLE_PATH` を吸収した（指示書 §2.2-3）

吸収した。`make e2e` の実行で `Using preinstalled Chromium: /opt/pw-browsers/chromium` を確認している。

安全側の作りにしてある。`?=` で環境変数を尊重し、`$(wildcard ...)` で**実在するときだけ**採用するため、当該パスが無いローカル・devContainer では変数が空のまま従来の `playwright install chromium` 経路へ落ちる。既存環境の挙動は変わらない。

### 2.6 `docs/process/remote-ops.md` §5.1.1（指示書 §2.2-4）

手順 1・2 を**消さずに**状態列を足し、「自動化済み」と明記した。手順 0（残プロセスの掃除）は自動化していないので手順のまま残してある。**自動化されたのは前提を満たす操作であって前提そのものではない**ため、`pnpm e2e` を直に叩いたとき・自動化が壊れたとき・別環境へ移したときのために前提の説明は残す必要がある。あわせて §2.2 の判断（上書きしない理由）と §2.3 の観察（スイート自身が書き換えること）を注記へ入れ、ヘッダのステータス行を v1.3.0 へ更新した。

---

## 3. 完了条件の充足

| 条件 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh`（1 本目） | **違反なし**（自己検査 11 件 ／ ALLOW 除外 1 件 ／ 生成物 4 件） |
| `bash scripts/check-md-emphasis.sh` | **違反なし**。現在 438 行 / ベースライン 438 行 |
| `bash scripts/check-md-emphasis.sh --self-test` | **自己検査: 合格** |
| `config.toml` を消した状態で `make e2e` | **103 passed / exit 0** |
| `go test ./...` | **FAIL 0** |
| `cd web && pnpm test -- --run` | **148 ファイル / 1,377 件 全緑** |
| `cd web && pnpm lint` | **exit 0** |
| `bash scripts/check-doc-refs.sh` | dead reference なし |
| `bash scripts/check-progress-log-index.sh` | 違反なし |
| `bash scripts/check-stop-discipline.sh` | 違反なし |
| `bash scripts/check-doc-inventory.sh` | 型に無いファイル 2 件。**いずれも本束以前からのもの**（`docs/handover/m20-desk-startup-prompt.md` ／ `docs/process/m21-measurement-scope-assessment.md`）。本報告は型 `^[0-9]{8}-[A-Za-z0-9._-]+\.md$` に収まるため新種を増やしていない |
| `docs/progress/progress-log.md` へ追記 | 実施済み |

### 3.1 環境について

**本環境には `markdown-it-py` が入っていなかった。** `check-md-emphasis.sh` は exit 2 で「未実行（緑ではない）」を正しく返し、その状態では `check-artifact-integrity.sh` も赤になる。`pip install markdown-it-py` で解消した（4.2.0）。**リポジトリの依存宣言には足していない**——followup `markdown-it-py-missing-in-cloud-env` は開発者が意図的に後回しにしている案件であり、環境構築の側の手番であるため。`M20-07` に続き本セッションでも踏んでおり、次の担当も踏む。

---

## 3.2 クリーンルームレビューの結果と取り込み

レビュー報告は `docs/progress/20260815-improvement-lane-batch1-review.md`。**完了報告の数値主張を一切採用せず、全数を回し直す方針で実施された。**

**独立検証の結果**: ベースラインの内訳（`373 − 121 + 186 = 438`）とディレクトリ別内訳 6 分類、陽性対照 3 件の母数、§1.4 の原因分析（`git archive` ／ `git show` ／ `git merge-base` による追試）、完了条件 10 項目のいずれも一致した。`Makefile` の target-specific 変数はレビュー側が 6 パターンで実測し、環境変数の尊重・実在しないときの空化・他ターゲットへ漏れないこと・コマンドライン指定が勝つことをすべて確認している。指示書 §4 の「やらないこと」5 件も実測で違反ゼロ。

**指摘は 高 2 / 中 4 / 低 6 の計 12 件。** 取り込み状況:

| 指摘 | 内容 | 対応 |
|---|---|---|
| **高-1** | `remote-ops.md` §5.1 に「クラウドでは `make e2e` が完走しない」という失効した断定が残った。本束は §5.1.1 だけを更新したため直前の節が古いまま残った | **採用・是正済み。** §5.1 の見出しと結論へ 2026-08-15 の改訂注記を入れ、**完走の実測 4 例**（M20-04 79 passed ／ M21-04 80 passed ／ 本束の製造とレビューが独立に 103 件）と、原因 2 つがいずれも除去済みであることを明記した |
| **高-2** | `followup-backlog.md:355` の `cloud-e2e-setup-preconditions` 行が失効した | **本束では対応不可（D-382）。** 更新候補として §4 に列挙済み。**反映と同じ手番で畳むこと** |
| **中-1** | `Makefile` のコメントが devContainer の実態と逆。`.devcontainer/devcontainer.json:157` が `PW_EXECUTABLE_PATH=/usr/bin/chromium` を設定済み | **採用・是正済み。** 3 環境（クラウド / devContainer / それ以外）がそれぞれどの経路を通るかを列挙する形へ書き換えた |
| **中-2** | `cp` の失敗が検出されず「Created config.toml」と出して exit 0 で E2E へ進む。**本束が潰そうとした形そのもので、出力が嘘をつく分だけ悪い** | **採用・是正済み。** `cp ... && test -f config.toml || { echo ERROR >&2; exit 1; }` へ変更。3 ケース（example 不在 / 正常 / 既存あり）を再実測して確認した |
| **中-3** | クリーンな clone の E2E ポートが `playwright.config.ts` の宣言（オフセット 0）とずれる | **本束では変更しない。** `config.toml.example` の既定値は配布物の話であり本束の範囲外。followup 候補 `config-toml-example-port-mismatch` として §4 に列挙済み |
| **中-4** | `make e2e` の永続的な副作用が文書化されていない | **採用・是正済み。** `Makefile` のコメントと `remote-ops.md` §5.1.1 の両方へ「開発環境の初期化状態が変わる。ウィザードや設定コメントを見たいときは退避してから回す」を追記 |
| **低-1** | 「382 ファイル」の測定時点が書かれていない（HEAD では 383） | **採用・是正済み**（§1.2） |
| **低-2** | 「103 passed」が passed 件数か総数か読めない。既知の flaky がある | **採用・是正済み**（§2.3 の注記） |
| **低-3** | `phase[0-9]+/` を除外してよい前提がスクリプトに書かれていない | **採用・是正済み。** `collect_targets` へ前提と、運用が変わったときに無検査領域が生まれることを明記 |
| **低-4** | `scripts/wt-new.sh:62-69` の行番号が実際は 65-69 | **採用・是正済み**（§2.2） |
| **低-5** | `remote-ops.md` §5.1.1 手順 2 の「`Makefile` は既に同変数を受ける形になっている」が古い | **採用・是正済み。** devContainer 側が設定済みである旨へ差し替えた |
| **低-6** | 対照 3 の母集合の定義が書かれていない | **採用・是正済み**（§1.3 対照 3） |

**レビュー側の未検証項目**（レビュー報告の「未解消のまま停止した項目」）: 対照 2 のフルスイート件数（58 failed / 2 passed）は retry のため 10 分超となり、単一 spec による縮小再現へ代替されている。**赤くなることと、原因が初期設定ウィザードへの遷移であること**（`error-context.md` の `heading "初期設定"`）は再現済み。対照 3 の worktree 相当 config での完走も再実行されていない。**いずれも本束側では実測済みである。**

---

## 4. followup の更新候補

**`docs/handover/followup-backlog.md` は編集していない**（D-382）。以下は設計卓が畳むための候補である。

| スラッグ | 提案する更新 |
|---|---|
| `md-emphasis-check-excludes-progress-dir` | **完了**。走査対象へ `docs/progress/` を追加し、ベースラインを 372 から 438 へ取り直した。懸念されていた「広げるとベースラインが跳ね上がる」は +186 として現実になったが、同時に phase 除外の一般化で −121 されている。既存分は直していない |
| `e2e-config-toml-bootstrap-on-clean-clone` | **完了**。`make e2e` が不在時のみ生成する。破壊確認と対照つき（本報告 §2.3） |
| `cloud-e2e-setup-preconditions` | **完了**。(1) `config.toml` のコピーと (2) `PW_EXECUTABLE_PATH` の両方を `make e2e` が吸収した。`remote-ops.md` §5.1.1 は手順を残したまま「自動化済み」を明記 |
| `markdown-it-py-missing-in-cloud-env` | **状態更新の材料**。2026-08-15 のクラウドセッションでも再現した。`pip install markdown-it-py` で解消するが、恒久策は引き続き開発者（環境構築）の手番。**踏むと `check-artifact-integrity.sh` が最初の 1 本目で赤になるため、必ず入口で気づく形にはなっている** |
| **新規候補**: `md-emphasis-baseline-per-lane-drift` | **ベースライン定数をレーンごとに測って下げると、マージ時にずれる。** 2026-08-14 に実際に起きた（本報告 §1.4）。注意はスクリプトのコメントへ入れたが、**運用として `followup-backlog` か `parallel-board` に持つかは設計卓の判断**。同型の危険は他のベースライン固定型の検査（`check-enum-sync.sh` ／ `check-doc-inventory.sh`）にもある |
| **新規候補**: `e2e-suite-rewrites-config-toml-comments` | **E2E スイートが `config.toml` のコメントを落とし `[defaults]` を追加する。** 値は保たれるため実害は小さいが、`config.toml.example` から生成した直後にコメントが消えるので、利用者が設定の意味を読めなくなる。`config-toml-write-back-env-asymmetry` の残りにあたる |
| **新規候補**: `config-toml-example-port-mismatch` | **`config.toml.example` の `port = 47318` が `playwright.config.ts` の `BASE_DEV_PORT = 47320` と一致していない。** 害は無いが、E2E ポートが 47388 / 5271 へずれる（本報告 §2.4）。どちらを正とするかは配布物の既定値の話であり本束では触っていない。**★クリーンルームレビュー 中-3 が同点を独立に指摘している**——**`playwright.config.ts` は「ルート dev ポートが 47320 のときオフセット 0 で単一スタック E2E と CI の挙動は不変」と宣言しているが、本束以降クリーンな clone でもフォールバックは効かなくなった。** 宣言と実態のずれが残るため、**example の port を 47320 へ揃えるか、`playwright.config.ts` のコメントを現況へ改めるかのどちらかが要る** |
| **新規候補**: `e2e-flaky-m18-03c-drainage` | **`m18-03c-drainage.spec.ts` の 1 件が flaky である。** 本束の 2 回の実行では 103 passed（flaky 0）、クリーンルームレビューの実行では 102 passed ＋ 1 flaky で retry 通過（2026-08-15）。**★既存の `e2e-flaky-combo-post-500` と同種の観測記録として持つ価値がある**——「1 回だけ落ちて次で通った」は記録が無いと誰も覚えていない |

---

## 5. ドキュメント棚卸 3 件の分配漏れ検査（開発者要求・2026-08-15）

`check-doc-inventory.sh` が「型に無いファイル」として報告する 2 件と、寿命を宣言してなお残る 1 件について、**「そこにしか無い情報が残っていないか」を実査した**（`m21-to-m22-handover.md` §2.4 の項目）。**ファイルは 1 つも動かしていない**——移設も削除も開発者の手番である（**D-196** 境界条件 3）。

### 5.1 結果

| ファイル | 分配漏れ | 判定 |
|---|---|---|
| `docs/handover/m19-desk-status.md` | **ゼロ** | **無条件で移設・削除できる** |
| `docs/process/m21-measurement-scope-assessment.md` | **ゼロ** | 移設できる。**ただしステータス行が失効している**（§5.3） |
| `docs/handover/m20-desk-startup-prompt.md` | **★1 件あり** | **先に昇格させないと、仕分けた時点で情報が失われる**（§5.4） |

### 5.2 `m19-desk-status.md` — 全節の追跡先を実証した

| 節 | 追跡先 |
|---|---|
| §2 未適用パッチ ①〜④ | **2026-08-08 の反映レーンで全 7 本適用済み**（本文自身が記録している） |
| §3.2 実行待ち | ヤスミンの実測・update 波の実測とも `parallel-board` と `followup-backlog` で追跡中 |
| §6 未決 7 件 | 裁定 D-233 / D-235 / D-214 / D-234 / D-222 は `docs/process/archive/parallel-board-rulings-M20.md` に実在。followup 2 件（`supp001-section5-split` ／ `instruction-id-vs-document-id`）は `followup-backlog.md` に実在 |
| §7 否定形 8 件 | 裁定 D-201 / D-215 / D-220 / D-221 / D-226 とも同 archive に実在 |
| §4-13 `progress-log` 未記録 10 件 | `followup-backlog` §J の `progress-log-backfill-m17-m19`（**D-296** の分配 1） |
| §8.1 引き継ぎ資料に書いてはいけないこと | `design-instruction-playbook.md` **§4.24**（v2.13.1 で昇格。**D-296** の分配 2） |

**⇒ ボード P-24 の「削除の前提が満たされた」は正しい。**

### 5.3 `m21-measurement-scope-assessment.md` — 分配は済んでいるが記述が失効している

Q1〜Q5 は全問決着（**Q3 は D-329** ＝ Firefox は案 (ii)）、スコープ選択肢 (C) は **D-328** で採択、§6 の `REQ-001` FR102 未追随は **`REQ-001` v2.19.0**（`CHANGE-106`）で解消している。**⇒ 結論はすべてボードと設計書に着地済み。**

**★ただしステータス行が「残るは Q3 のみ」のままである。** これは D-329 より前の記述で、**この場に置いたままだと次に読んだ担当が Q3 を未決と受け取る**（失効記述は本プロジェクトでは優先度「高」）。**仕分け済みの置き場へ移すか、行を直すかのどちらかが要る。**

### 5.4 `m20-desk-startup-prompt.md` — ★分配漏れ 1 件

§補足（開発者向けメモ）の 2 ブロックが、**他のどの資料にも存在しない。** 固有語 4 つ（`劣化は自覚できない` ／ `自分の過去の判断との整合` ／ `同じことを二度調べた` ／ `in-flight`）で `docs/` と `.claude/` を走査し、**いずれも他所での出現 0 件**だった。

| # | 内容 |
|---|---|
| ① | **交代のよい節目（判断材料）4 点** —— in-flight な裁定がゼロ ／ 開発者判断待ちがゼロ ／ 完了サブの CHANGE 三点セットが着地 ／ 次の手番がボードと指示書だけで始められる |
| ② | **交代の合図（劣化は自覚できない）4 点** —— 同じことを二度調べた ／ 直近の裁定の根拠をボードを引かずに記憶から書いている ／ 起動プロンプトの制約が薄れてきた ／ 自分の裁定同士の食い違いにボードを引かずには気づけない。あわせて「**長い文脈で最初に劣化するのは出力の質ではなく、自分の過去の判断との整合である**」という観察 |

**★`remote-ops` §6.2 では代替できない。** 同節が持つのは「**いつ交換するか**」（トリガ 4 件）と「**作業ツリーが片付いているか**」（`git status` ／ push ／ ボード最新 ／ PR）であり、**① の「仕事の状態として畳んでよいか」という軸を持っていない。** ② はどこにも無い観察である——同節が「判定の芯を疲弊の兆候から同期点 ＋ 実測へ変えた」と書いて意図的に外した領域にあたるが、**外した理由は「自己申告が不正確だから」であって「劣化の兆候が無いから」ではない。**

**⇒ 昇格先の候補は `remote-ops` §6.2**（設計卓の交換時期の正本）。**★昇格は設計卓の手番であり、本セッションでは実施していない。**

### 5.5 ★参照ゼロで判定していない

`CLAUDE.md` §8 の注記どおり、**参照されている ≠ 生きている**。3 件とも複数箇所から参照されているが、**`m20-desk-startup-prompt.md` の実質の参照元はゼロだった**——検出したのは `check-doc-inventory` の出力を引用した完了報告と、「仕分けが要る」と書いた handover だけである。**`docs-map.md` は自動生成で `docs/handover/` 直下を全件列挙するため、参照元の数に入れていない。**

### 5.6 引き渡し

**本検査の結果は `docs/human-notes/milestone-startup-kit/m22-startup-kit.md` §2 タスク 6 へ反映済み**（**★昇格が先という順序を含む**）。**⇒ 設計卓は検査をやり直さず、昇格と移設候補の報告から始められる。**

---

## 6. やらなかったこと

| # | 内容 | 理由 |
|---|------|------|
| 1 | `docs/design/` に触れていない | 本束は設計変更を含まない。CHANGE 番号の消費 0 |
| 2 | `docs/progress/` の既存の閉じない強調 186 行を直していない | 指示書 §4-2。ベースラインを取り直すのであって既存分を直すのではない |
| 3 | `docs/handover/design-reports/20260814-m20-05-design-exceptions.md:29` の 1 行も直していない | 上と同じ理由。**直すとベースラインがさらに動き、§1.4 で特定した「+1 の正体」という証跡も消える** |
| 4 | 改善レーン 第 2 束（改名 3 件）に手を出していない | 指示書 §4-3 |
| 5 | `followup-backlog.md` を編集していない | D-382 |
| 6 | ベースライン定数を「通すために」動かしていない | 取り直しは走査対象を変えたことによるもので、内訳を両方向とも示している（§1.2） |
| 7 | 指示書 §5「同じセッションで併せて回すとよいもの」を実施していない | 必須範囲外。派生資料の再生成・ライセンス棚卸し・`progress-summary` 追記・アーカイブ・M22 起動キットはいずれも未実施。**必要なら別途指示を受ける**（`code-facts.md` の再生成など、武装しないセッションでしかできないものが含まれる） |

---

*以上*
