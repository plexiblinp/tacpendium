# 設計伝達レポート（例外レポート） — `M38-03`（説明書の画像貼り込み ＋ macOS の名前寄せ ＋ 検査の表載せ）

| 項目 | 内容 |
|---|---|
| **対象** | **親チャット（設計卓）** |
| **発信** | 製造担当 Claude Code（2026-09-19 初版 ／ 同日改訂①＝開発者の目視確認の結果を §1-3 へ追記 ／ **同日改訂②＝`images/.gitkeep` を `SCREENSHOT-RULES.md` へ改名し配布物から除外（§1-5・§4-5 解消）**） |
| **指示書** | `docs/instructions/M38-03-manual-images-and-macos-naming.md` **v1.1.0** ／ 上位 `M38-overview` v1.1.0 |
| **実装コミット** | ブランチ `feature/m38-03`（**push 未実施＝開発者の手番。`claude/` 名前空間ではないため製造は push しない**） ／ 着手基点 `654f4a85` ／ **7 コミット**（`dcaceda7` 射程 A ／ `3f81eb68` 射程 B ／ `b7db3573` 射程 C ／ `285688bb` 完了報告 ／ `c0f13f53` レビュー取り込み ／ `8f502763` レビュー報告書 ／ `631ef464` 索引行）＋ 本レポート |
| **関連** | 完了報告 `docs/progress/M38-03-completion-report.md` ／ レビュー `docs/progress/m38-03-review.md` |
| **チェックリスト** | `docs/instructions/reviews/M38-03-review-checklist.md` **v1.1.0**（着手前に実在を確認＝指示書 §0.3 の版ゲート 6 点すべて通過） |
| **レビュー集計** | **高 2 / 中 2 / 低 5 ＝ 全 9 件・採用 8（修正 5 ／ 報告のみ 2 ／ 報告追記 1）/ 不採用 1（低-5）・「高」の不採用 0 件・再レビュー往復 0 回（上限 2）** |
| **源泉** | 完了報告 ＋ レビュー報告書 ＋ **開発者との同一セッション内のやり取り**（コマンド引数の追加指示 2 件 ＋ 計画時の未決 5 点への裁定） |
| **CHANGE / マイグレ / 依存** | **CHANGE 1 本の見込み**（★自採番しない＝`D-293`。原稿は §1-1 と §6） ／ **マイグレ 0 本** ／ **新規依存 0 件** ／ **`docs/design/` 差分 0 行 ／ `followup-backlog.md` 差分 0 行** |

本書は **①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題**に絞る。指示書どおりの部分は割愛する。

**★§2 は 0 件である。** 指示書と異なる判断は 3 件あった（本文 2 文の書き換え ／ `dist-readme.txt` の 1 行 ／ 章 id の詰め直し）が、**いずれも実装前に開発者へ諮って裁定を得た**（§3-1）。実装が独断で下したものは無い。

**★最重要は §1-1（`DES-002` §11.2 の CHANGE 原稿）と §4-1（「全 22 章」の写しが 4 面ではなく 5 面あった）である。** §1-1 は設計書に旧アーカイブ名が残る唯一の箇所であり、§4-1 は `followup` の数え上げが実態より 1 つ少なかった件である。

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### §1-1 ★★★macOS のアーカイブ名を `tacpendium-darwin-arm64.tar.gz` へ寄せた（`DES-002` §11.2 の原稿）

**開発者裁定＝案 (a)**（2026-09-17・`D-893`）**を実装した。** 設計書本体は書き換えていない（`git diff 654f4a85 HEAD -- docs/design/` は空）。

| 面 | 着手前 | 着手後 | 根拠 |
|---|---|---|---|
| 正本 `scripts/release-targets.sh:31`（1 列目） | `tacpendium-macos-arm64.tar.gz` | **`tacpendium-darwin-arm64.tar.gz`** | 2〜4 列目（中の実行ファイル名 `tacpendium-darwin-arm64` ／ 形式 ／ ソース）は**不変** |
| 自己検査 `scripts/check-release-archive.sh` の対照名 | リテラル `mt="tacpendium-macos-arm64.tar.gz"` | **正本の配列から形式ごとに引く**（`_first_target_field <形式> <列>`） | ★リテラルのままだと改名した瞬間に陰性対照 B が赤になる。**着手基点の版で実証＝EXIT=1** |
| 配布 `README.txt`（正本 `docs/usermanual/dist-readme.txt:47`） | `shasum -a 256 -c tacpendium-macos-arm64.tar.gz.sha256` | `… tacpendium-darwin-arm64.tar.gz.sha256` | 改名で存在しないファイル名の案内になるため（§3-1-3） |
| `.github/workflows/nightly-crossbuild.yml:104-113` のコメント | 「名称も macos-arm64 (darwin ではない)」「(中身 = tacpendium.exe + README.txt)」「README.txt L68-94」 | アーカイブ 3 点を `darwin` で列挙し、**名前・中身の正本は `release-targets.sh`** と書き、行番号参照を見出し名へ | **実行内容（`for f in dist/…` の 3 点）は 1 文字も変えていない** |

**実証**: `make release-archives` EXIT=0 ⇒ `dist/release/tacpendium-darwin-arm64.tar.gz`（24,193,161 バイト・`.sha256` 付き・中に `manual/images/*.png` 29 枚）／ `check-release-archive.sh` EXIT=0（3 本・違反なし）／ `--self-test` EXIT=0（陰性 5 ／ 陽性 6）。

**⇒ `DES-002` §11.2 へ次を反映してほしい（原稿は §6）**：

1. `02-architecture.md:1503` の `tacpendium-macos-arm64.tar.gz   （非公式）` → `tacpendium-darwin-arm64.tar.gz   （非公式）`
2. **同節に「3 つのアーカイブ名は `Makefile` の出す GOOS 名（windows / darwin / linux）で揃える。正本は `scripts/release-targets.sh` の 1 行であり、名前を変えるときはそこだけを直す」を 1 行足してほしい**（`CHANGE-213` の「正本は 1 か所」の帰結。★自己検査も正本から引くようになったため、名前を写している場所は配布 `README.txt` の 1 行だけになった＝§4-4）
3. **★同節に旧値が 2 つ残っている**（本サブの射程外だが同じ原稿で直せる位置）：`:1491`「操作説明書・全 22 章」→ **全 21 章**（`M38-02`）／ `:1523`「27 枚の PNG」→ **本編 28 枚 ＋ QS 1 枚（＝29）**（本サブ着地時の実測）

### §1-2 説明書の章 id・図のファイル名を **`ch01`〜`ch21` の連番**へ詰めた

`M38-02` が `ch14`（技編集）を章ごと消した後、章 id は `ch13` の次が `ch15` のままだった（`M38-02` 完了報告 §10-2「章 `id` は詰め直していない」）。開発者は画像を `ch14-export-dialog-1.png` … `ch21-home-1.png` と**詰めた番号で命名して**おり、HTML 側だけが旧番号だった（開発者の追加指示＝「html 側は追従できていません」）。

| 実測 | 値 |
|---|---|
| 旧 `#ch15`〜`#ch22` の参照 | **本編内部の 16 行のみ**（TOC 8 ＋ `section id` 8）。**外部参照 0**（quickstart の章リンクは `#ch01` / `#ch05` / `#ch08` / `#ch10`・`dist-readme.txt` は章番号を持たない） |
| 詰めたトークン | 37（id 8 ／ href 8 ／ `img src` 10 ／ figcaption 10 ／ CSS セレクタ `figure img[src*="ch21-"]` 1）＋ CSS コメント 2 ＝ **39・取りこぼし 0**（レビューが独立に再計数） |
| `images/.gitkeep` の命名規約 | `01〜22` → **`01〜21`**。「ch22 はスマホ専用（`max-width:340px`）」→ **ch21**（★同ファイルはその後 `SCREENSHOT-RULES.md` へ改名＝§1-5） |

**⇒ `DES-002` §11.2 の `images/`（章ごとのスクリーンショット ＋ `qs-` 接頭辞の図）の記述は変えなくてよい。★ただし「章番号は連番であり、章を消したら後続を詰める（`M38-03`・`D-893` 系の開発者裁定）」を `M32` 系の撮影運用の前提として設計卓側の記録に残してほしい**（`M38-02` の「詰めない」判断は本サブで失効した＝§4-8）。

### §1-3 説明書の図は **本編 28 ＋ QS 1 ＝ 29 枚・`todo` 0 件**で着地した

- 開発者の撮影 29 枚 ↔ `img src` 29 件が **1:1**（欠落 0・余剰 0）。**余剰だった 1 枚**（`ch18-game-update-0.png`＝ゲーム更新後のコンボ一覧に出るお知らせの帯）は開発者裁定で**入口の図として枠を足した**（§3-1-2）
- `figcaption` の制作注記「（撮影は開発者の手番。ファイル名は …）」28 件は外した（配布物の読者に内部メモが見えるため。開発者裁定）
- headless Chromium で描画し `document.images` の破損 0 を機械確認した（★同環境は日本語フォントを持たないため、キャプションと本文の見え方は機械では確認できていない）
- **★開発者がブラウザで目視確認済み**（2026-09-19・逐語＝「ざっと確認した感じだと内容に問題はありませんでした」）。確認を依頼した点＝各章の画像が章の中身と合っているか ／ `ch18` の入口の図の位置 ／ `todo` の点線枠の残り ／ `ch21` の幅 ／ 書き換えた 2 文の読み味

### §1-4 API 経路・DTO・エラー契約

**なし。** 本サブは API を 1 件も触っていない（`web/src` ／ `internal/` の差分 0 行）。**⇒ `DES-002` §4.2 への反映は不要。**

### §1-5 `images/.gitkeep` を **`images/SCREENSHOT-RULES.md`** へ改名し、撮影ルールだけを残した（開発者指示・2026-09-19）

- **開発者の逐語**＝「gitkeep はもう不要だから削除していいですか？」→「gitkeep のファイル名を変更してもらえますか？今後の機能変更などで再撮影が必要になった時に撮影ルール等は残しておきたい。ルール以外の部分は消して良い」
- **残したもの**＝命名規約（`ch<NN>-<slug>-<n>.png` ／ `qs-` ／ 章を消したら番号を詰める ／ 入口の図は `-0` 可）／ 何を撮るか（判断基準 1 つと例外）／ 撮影の設定（712px 固定・1100×800 DPR 2・横長表・スマホ章 390×740 DPR 3）／ 貼り込みのルール（`todo` の付け外し・`figcaption` に制作メモを書かない・全数実在の確認）。**消したもの**＝根拠の段落・`M32-01` / `M32-03` / `D-893` の経緯・「29 枚貼り込み済み」の履歴
- **配布物から除外**＝`scripts/release-targets.sh` の `RELEASE_MANUAL_EXCLUDE` へ `images/SCREENSHOT-RULES.md` を追加（`manual/` 相対の下位パスで `rm` される形）。**実証**＝`build-release-archives.sh` を回し直し、3 本とも `SCREENSHOT-RULES` 0 ／ `.gitkeep` 0 ／ PNG 29。`check-release-archive.sh` 単体・`--self-test` とも EXIT=0
- 参照の追随＝`tacpendium-readme.html:102` の CSS コメント「`images/.gitkeep` 参照」→ `SCREENSHOT-RULES.md`
- **⇒ `DES-002` §11.2 の `images/` の説明に「撮影ルール `images/SCREENSHOT-RULES.md` はリポジトリにだけ在り、配布物には入れない」を添えてほしい**（§6 に追記済み）

---

## §2 契約・設計に反する独自判断（★親の裁定が要る）

**なし。** 指示書 §3「やらないこと」と異なる判断は 3 件あった（§3-2「本文を書き換えない」／ §3-9「`dist-readme.txt` を触らない」／ `M38-02` の「章 id は詰めない」）が、**いずれも計画提示時に未決事項として挙げ、実装前に開発者の裁定を得た**（§3-1）。実装が独断で契約と異なる判断を下した項目は無い。

---

## §3 製造の判断

### §3-1 開発者へ確認して確定した点

| # | 事項 | 開発者裁定（2026-09-19） | 実装 |
|---|---|---|---|
| 1 | 章番号の追従範囲（画像名だけか、`section id` / TOC も詰めるか） | **推奨どおり＝id / TOC も詰める** | §1-2 |
| 2 | 余剰画像 `ch18-game-update-0.png` の扱い | 逐語＝「これは私が自己判断で取ったものでした。アップデートした後のコンボ一覧の見え方（入口）と影響コンボの一覧を取っています。…両方表示するように編集してもらえますか？しょっちゅう見かける画面ではないはずなので、ちゃんと入り口から示しておきたい」 | ゲーム更新章（`ch18`）へ入口の図を 1 枠追加（既存の `-1` の直前。図は章末にまとめる既存の流儀に合わせた） |
| 3 | `dist-readme.txt:47` の `.sha256` 名（指示書 §3-9「触るな」と改名の衝突） | **推奨どおり＝正本 1 行だけ直し `README.txt` を再生成** | `check-dist-readme.sh --write` → 照合 EXIT=0 |
| 4 | ch08 `:477` ／ QS `:88`「足りない項目があっても保存は止まりません」が `M38-01` の必須化（ダメージ・有利フレーム）と食い違う | **推奨どおり＝2 文を最小修正** | 「ダメージと有利フレームの 2 つを除けば…この 2 つだけは必須…（仮登録として保存するときは、この 2 つも空のままでかまいません）」。★仮登録の例外は `comboFormSchemaDraft` ／ `VAL-C15` のスキップから引いた |
| 5 | `figcaption` の制作注記 28 件 | **推奨どおり＝注記だけ外し、キャプション本文は残す** | §1-3 |
| 6 | 追加指示①「始動技を新規・編集画面で出さないようになったため、食い違いがあれば修正」 | （追加指示） | **実査＝食い違い無し**（説明書の「始動技」9 行のうち編集画面に関わる 2 行は「始動技を選ぶ欄はありません」と同一性 7 項目の列挙で、画面に欄があるとは書いていない）。修正 0 件 |

### §3-2 推測・判断で進めた点

| # | 事項 | 判断 | 根拠 |
|---|---|---|---|
| 1 | `nightly-crossbuild.yml` の同じコメントブロックにあった旧逐語「(中身 = tacpendium.exe + README.txt)」も正本参照へ置き換えた | **射程 B の改名で同じ行を書き換える以上、失効文だけ残す理由が無い**と判断。`followup` の `nightly-crossbuild-comment-stale` ／ `readme-exe-name-ci-comment-unsynced` の実体に当たる（§4-2） | ★実行内容は不変。レビューは同ブロックの「README.txt L68-94」（失効した行番号）が残った点を高-2 で指摘し、取り込みで是正した |
| 2 | 自己検査の対照名を正本から引く形にした（`_first_target_field`） | 「1 か所で済む」（`CHANGE-213`）を自己検査にも通した。改名で赤になることは着手基点の版で実証 | `check-release-archive.sh` `--self-test` EXIT=0 |
| 3 | `README.md:11,218`（リポジトリの README）の「全 22 章」「スクリーンショットは未配置」を直した | レビュー高-1。`README.md` は説明書でも設計書でもなく、指示書 §3-3 の禁止理由（4 面が追随済み）はこの第 5 面に当たらない | §4-1 |
| 4 | レビュー低-5（`build-release-archives.sh:78-79` ／ `check-release-archive.sh:16-17` の「撮影は開発者の手番であり M36-01 の後である」に「（当時）」を添える）を**不採用** | 同注記は「`images/` の枚数を検査で数えない」設計（`D-886`）の根拠であり、撮影後も根拠として成立している。レビュー自身も「任意」 | — |

---

## §4 設計担当が未把握の残課題・申し送り

**★§J（停止時記録）の原稿: なし。** 停止規律の上限に達した項目は無い（往復 0 回）。

### §4-1 ★★`usermanual-chapter-count-22-scattered`（既存行の更新）

- **何が起きたか**: `M38-02` が「全 22 章」→「全 21 章」を **4 面**（本編・目次・`dist-readme.txt`・`README.txt`）で追随したが、**5 面目＝`README.md:11` と `:218`**（リポジトリの README）が残っていた。レビュー高-1 で発見し、本サブで是正済み（`c0f13f53`）。**あわせて `:218` の「★スクリーンショットは未配置」も本サブで失効したため配置済みへ**
- **根拠**: `git show 654f4a85:README.md | grep -n "全 22 章"` ＝ 2 件
- **更新後の状態**: 「写しは 5 か所。5 か所とも是正済み（`M38-02` ×4 ／ `M38-03` ×1）。★`DES-002` §11.2 `:1491` の「全 22 章」は設計書本体であり §6 の CHANGE で直す」

### §4-2 `nightly-crossbuild-comment-stale` ／ `readme-exe-name-ci-comment-unsynced`（既存行の更新＝解消）

- **何が起きたか**: 両スラッグの実体（`nightly-crossbuild.yml` のコメント「(中身 = tacpendium.exe + README.txt)」）を本サブが正本 `release-targets.sh` への参照に置き換えた（§3-2-1）。あわせて失効した行番号参照「README.txt L68-94」も見出し名へ（レビュー高-2）
- **根拠**: `.github/workflows/nightly-crossbuild.yml:104-113`（`git diff 654f4a85 HEAD -- .github/`）
- **更新後の状態**: 「解消（`M38-03`・`3f81eb68` ＋ `c0f13f53`）。コメントは正本を指す形になり、中身の列挙を持たない」

### §4-3 `des002-macos-arch-mismatch`（不変・触っていない）

`DES-002` §11.1（amd64 / arm64）と §11.2（arm64 のみ）の食い違いは指示書 §2.3 のとおり**触っていない**。§6 の CHANGE でアーカイブ名を直すときも、この未決は据え置きのまま（原稿は arm64 の 1 点だけを改名する）。

### §4-4 新規候補: `dist-readme-archive-name-unlinked`（レビュー中-2）

- **何が起きるか**: 配布 `README.txt`（正本 `dist-readme.txt:47`）の `.sha256` の案内は、`release-targets.sh` と**機械で結ばれていない 2 か所目**である。今回の改名で実際に手直しが要った（＝写しが在ることの証拠）。次にアーカイブ名を動かすと、`check-dist-readme.sh`（正本と生成物の一致だけを見る）も `check-release-archive.sh`（「README の文面が実態と合うかは見ない」と自ら限界を書く）も気づかない
- **根拠**: `docs/usermanual/dist-readme.txt:47` ／ `scripts/check-release-archive.sh:27-29`（限界の注記）
- **対照の案**: `check-dist-readme.sh` か `check-release-archive.sh --self-test` に「`README.txt` に `RELEASE_TARGETS` の 1 列目が全数現れる」を足す。どちらに置くかは設計卓の判断
- **割付の候補**: `M36-02`（リリース CI）か改善レーン。**本サブでは実装していない**

### §4-5 `release-manual-gitkeep-bundled`（レビュー低-3）— **★同日に解消した。登録不要**

- **何が起きていたか**: `manual/images/.gitkeep`（開発内部の撮影メモ）が利用者向けアーカイブへ入っていた
- **解消**: 開発者指示で `.gitkeep` を `SCREENSHOT-RULES.md` へ改名し、`RELEASE_MANUAL_EXCLUDE` へ足した（§1-5）。3 本のアーカイブで 0 件を実証。**⇒ `followup` へ新規登録しなくてよい**

### §4-6 旧アーカイブ名 `tacpendium-macos-arm64` が設計卓の資料に残る（CHANGE 採番時に拾う対象）

`docs/progress/` を除く実測（`grep -rl`）：`docs/design/02-architecture.md` 1（§6 で直す）／ `docs/process/parallel-board.md` 1 ／ `docs/handover/followup-backlog.md` 1 ／ `docs/instructions/M36-01-release-archive-and-checksums.md` 1 ／ `docs/instructions/reviews/M36-01-review-checklist.md` 1 ／ `design-reports/20260916-m36-01-*.md` 2 ／ `design-reports/20260906-m28-01-*.md` 1。**指示書・レポートは歴史記録として残してよいが、`followup` と ボードの行は「現在は `darwin`」を添えないと次の担当が旧名で書く。**

### §4-7 `check-md-emphasis.sh` の常時走査が赤（798 行 ／ 床 247）

着手前からの状態。`--list` の内訳は `parallel-board.md` 109 ／ `retrospective-digest.md` 46 ／ `retrospective-log.md` 38 ／ `followup-backlog.md` 30 ／ `design-instruction-playbook.md` 29 …で、**主部は設計卓の `.md`**。本サブが触った `.md`（`CLAUDE.md` 1 行 ／ `README.md` 2 行）の検出は 0。**書いた本人が直す**（`D-761`）ため設計卓の手番。

### §4-8 `M38-02` 完了報告 §10-2「章 `id` は詰め直していない」は本サブで失効した

歴史記録なので書き換えていない。**`M38-02` の根拠「詰めると既存の全アンカーが動く」は実査で内部参照 16 行のみ・外部 0 と分かり、開発者裁定で詰めた**（§1-2）。以後の章の増減は `ch01`〜`ch21` の連番を基準にする。

### §4-9 `check-progress-log-index.sh` の `m19-04` 既存 NG

本サブの索引行を足した後も同検査は EXIT=1 で、残る NG は `m19-04`（`docs/progress/M19-04-completion-report.md` に対応する追記が無い）の 1 件のみ。着手前からの状態であり本サブは触っていない。ALLOW へ入れるか追記するかは設計卓／開発者の判断。

### §4-10 レビュー低指摘の繰越

**なし**（低 5 件のうち 4 件は取り込み済み・1 件は不採用＝§3-2-4）。

---

## §5 参考（触れていない＝不変の証跡）

- `git diff 654f4a85 HEAD -- docs/design/ docs/handover/followup-backlog.md migrations/ web/src/ internal/ cmd/ Makefile go.mod web/package.json` ＝ **空**
- `Makefile:74` `GOOS=darwin GOARCH=arm64 … -o dist/tacpendium-darwin-arm64` 不変（案 (b) ではない）
- `scripts/release-targets.sh:31` の 2〜4 列目（`tacpendium-darwin-arm64 :: targz :: dist/tacpendium-darwin-arm64`）不変
- `cmd/tacpendium/windows_gui_link_test.go` 不変（案 (b) が触る面）
- `CLAUDE.md` §8 の表は **1 行追加のみ**（`git diff --numstat` ＝ `1 0`。取り込みで同じ行を 2 点修正）
- `docs/usermanual/tacpendium-readme.html` の本文段落は ch08 `:477` の 1 文以外不変（`todo` ／ 注記 ／ 章番号 ／ 図 1 枠 ／ CSS 注記のみ）
- `docs/usermanual/images/*.png` ＝ **差分 0**（29 枚は `654f4a85` で開発者がコミット）
- `go test ./...` EXIT=0・FAIL 0 ／ `pnpm test` 234 files・2974 tests ／ `make e2e` EXIT=0・363 passed・flaky 1（`m31-02` ドラッグ・retry 通過）
- `check-artifact-integrity.sh` ／ `check-doc-refs.sh` ／ `check-dist-readme.sh` ／ `check-release-archive.sh`（`--self-test`・単体）／ `check-stop-discipline.sh` ／ `check-doc-inventory.sh` ／ `check-completion-report-md-emphasis.sh` ＝ すべて EXIT=0

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**1 本**（射程 B）。**番号は起票時に registry で採番**（ボード `:123` の「いま使えるのは `220`〜`231`」）。マイグレ 0 本（連番の払い出しなし）。

- [ ] **`DES-002` §11.2 `:1503`**：`tacpendium-macos-arm64.tar.gz   （非公式）` → **`tacpendium-darwin-arm64.tar.gz   （非公式）`**
- [ ] **同節へ 1 行**：「アーカイブ名は 3 つとも `Makefile` の出す GOOS 名（`windows` / `darwin` / `linux`）で揃える（2026-09-17 開発者裁定・`D-893` 案 (a)・`M38-03`）。正本は `scripts/release-targets.sh` の 1 行であり、`check-release-archive.sh` の自己検査も同配列から名前を引く。名前を写しているのは配布 `README.txt` の SHA-256 の案内 1 行だけである」
- [ ] **同節の旧値**（本サブの射程外だが同じ手番で直せる）：`:1491`「全 22 章」→「全 21 章」／ `:1523`「27 枚の PNG」→「本編 28 枚 ＋ クイックスタート 1 枚」
- [ ] **§11.1 ↔ §11.2 の amd64 の食い違い（`des002-macos-arch-mismatch`）は据え置き**。本 CHANGE は arm64 の 1 点の改名だけを扱う
- [ ] **`followup-backlog.md`**：§4-1（更新）／ §4-2（解消）／ §4-4（新規候補）／ §4-6（旧名の残りに「現在は `darwin`」）。★§4-5 は解消済みのため登録不要
- [ ] **同 §11.2 の `images/` の説明へ 1 行**：「撮影ルール `images/SCREENSHOT-RULES.md` はリポジトリにだけ在り、配布物には入れない（`RELEASE_MANUAL_EXCLUDE`）」（§1-5）
- [ ] **ボード**：`D-893` の行に「実装済み＝`M38-03` `3f81eb68`」。旧名 `tacpendium-macos-arm64` の 1 件（§4-6）
- [ ] **`M38-02` の記録**：「章 id は詰めない」が失効（§4-8）。設計卓側の記録に「連番で詰める」を残す

---

## §7 教訓（retrospective 行き）

**親は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映（実施者は設計担当）。

1. **正本の値を改名するときは、自己検査・fixture のリテラルを先に `grep` する。** 正本 `release-targets.sh` を 1 行直した瞬間に `check-release-archive.sh --self-test` が赤になった（陰性対照 B が旧名をハードコード）。**「正本は 1 か所」と書いた検査自身が 2 か所目を持っていた。** ⇒ 自己検査の対照は正本から導出する形にし、改名で赤になる経路を消す。`CHANGE-213`（`E-76`）の帰結を検査側にも通す
2. **「N 面に追随済み」は grep で全数を取り直してから信じる。** `M38-02` は「全 22 章」を 4 面と数えたが、`README.md` に 5 面目があった（レビューが発見）。指示書 §3-3 が「触るな」と書いたのはその 4 面が済んでいるという前提であり、前提を数え直さずに従うと 5 面目が残る
3. **画面の挙動を変えるサブは `docs/usermanual/` を走査対象に入れる。** `M38-01` の必須化（ダメージ・有利フレーム）が説明書の「足りない項目があっても保存は止まりません」に届かず、次のサブ（本サブ）が別件の隣で見つけた。`M32-03` §2.4「本文が画面の構造を主張している箇所」と同型で、**説明書は as-built の写しであるため、実装を変えたら写しも走査する**
4. **同じコメントブロックを書き換えるときは、そのブロックに残る他の失効文も一緒に読む。** nightly のコメントを改名のために書き換え「失効文を是正した」と報告したが、同ブロック末尾の「README.txt L68-94」（失効した行番号）が残った（レビュー高-2）。**行番号で他文書を指す注記は必ず失効する**⇒ 見出し名で指す
5. **母集団は着地した現物から数える（`M-187` の型）は、本サブでは機能した。** 指示書 v1.1.0 が枚数を書かなかったため、現物 29 ↔ 28 の差（余剰 1・番号ずれ 10）を**手を入れる前の表**で出せ、勝手に辻褄を合わせずに開発者へ諮れた。⇒ 指示書に数を書かない運用は正しい
6. **静的 HTML の図の破損は headless Chromium で機械確認できる。** `document.images` の `naturalWidth===0` を数えるだけで、`src` の綴り違い・拡張子違いを描画で捕まえられる（`@playwright/test` の `chromium.launch({executablePath})`。devContainer は `/usr/bin/chromium`）。`ls` と `diff` の突き合わせに 1 段足すと「ファイルは在るが読めない」も拾える
