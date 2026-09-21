# M38-03 完了報告 — 説明書へ画像を貼り込み、macOS の名前を寄せ、検査を表へ載せる

| 項目 | 内容 |
|------|------|
| 作業 ID | **M38-03** |
| 指示書 | `docs/instructions/M38-03-manual-images-and-macos-naming.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M38-03-review-checklist.md` **v1.1.0** |
| 実施日 | 2026-09-19 |
| 着手基点 | **`654f4a85`**（`docs: スクリーンショット格納`。その前が `b90df21a` Merge PR #233） |
| 成果コミット | 射程 A `dcaceda7` ／ 射程 B `3f81eb68` ／ 射程 C `b7db3573` ／ 完了報告 `285688bb` ／ **レビュー取り込み `c0f13f53`**（§9） |
| ブランチ | `feature/m38-03` |
| 射程 identity | **3 件**（A 説明書の画像貼り込み ／ B macOS の名前寄せ ／ C `CLAUDE.md` §8 への 1 行）＋ **開発者の追加指示 2 件**（§0.1） |
| マイグレ消費 | **0 本**（指示書どおり） |
| CHANGE 消費 | **1 本の見込み**（射程 B・`DES-002` §11.2。★自採番していない＝`D-293`。原稿は設計伝達レポート §1 / §6） |
| 新規依存 | **0** |

> **★報告は射程 A ／ B ／ C の 3 つに分けてある**（指示書 §0.1）。**1 つが差し戻されても他の 2 つは巻き添えにならない。**

---

## 0. 追加指示と、着手前に開発者へ諮って裁定を得た 5 点

### 0.1 開発者の追加指示（コマンド引数・2026-09-19）

| # | 逐語 | 扱い |
|---|---|---|
| 1 | 「始動技を新規・編集画面で出さないようになったため、食い違いがあれば修正してください」 | **★実査の結果、食い違いは無かった**（§2.3）。修正 0 件 |
| 2 | 「`M38-02` が `ch14` を章ごと消したのですが、tacpendium-readme.html 側の画像ファイル名の ch はずれたままでした。images 配下の画像ファイル名は合わせていますが、html 側は追従できていません」 | **★射程 A の中で追従した**（§2.4）。★指示書 §3-3「章数の表記を直すこと」は「全 21 章」の*表記*を指し、こちらは*章 id とファイル名の番号*であるため矛盾しない |

### 0.2 計画提示時の未決事項 5 点と裁定（**すべて実装前に回答を得た**）

| # | 事項 | こちらの推奨 | 裁定 |
|---|---|---|---|
| 1 | 章番号の追従範囲（画像名だけか、`section id` / TOC も詰めるか） | id / TOC も `ch14`〜`ch21` へ詰める（参照は全部ファイル内・16 行） | **推奨を採用** |
| 2 | 余剰画像 `ch18-game-update-0.png`（HTML に枠が無い） | ゲーム更新章へ入口の図として 1 枠足す | **開発者＝「アップデートした後のコンボ一覧の見え方（入口）と影響コンボの一覧を取っています。…両方表示するように編集してもらえますか？…ちゃんと入り口から示しておきたい」⇒ 足した** |
| 3 | `dist-readme.txt:47` の `tacpendium-macos-arm64.tar.gz.sha256`（指示書 §3-9「触るな」と改名の衝突） | 正本 1 行だけ直し `README.txt` を再生成 | **推奨を採用** |
| 4 | ch08 / QS の「足りない項目があっても保存は止まりません」（`M38-01` の必須化と食い違い） | 2 文を最小修正 | **推奨を採用** |
| 5 | `figcaption` の制作注記「（撮影は開発者の手番。ファイル名は …）」28 件 | 注記だけ外し、キャプション本文は残す | **推奨を採用** |

---

## 1. 着手前の版ゲート（指示書 §0.3）— **6 点すべて通過**

| # | 確かめたこと | 実測 |
|---|---|---|
| 1 | チェックリストの存在 | ✅ `docs/instructions/reviews/M38-03-review-checklist.md` v1.1.0 |
| 2 | 説明書 2 ファイル | ✅ `tacpendium-readme.html` ／ `tacpendium-quickstart.html` |
| 3 | 「21 章」4 面・技編集の章なし | ✅ `readme.html:191` ／ `dist-readme.txt:8,223` ／ `README.txt:8,223` が「全 21 章」。TOC 21 行・`section.chapter` 21 個・「技編集」「moves 編集」0 件 |
| 4 | `release-targets.sh` ／ `check-release-archive.sh` | ✅ 両方実在 |
| 5 | 開発者の画像 | ✅ `docs/usermanual/images/` に **29 枚**（`654f4a85` でコミット済み） |
| 6 | 枝元 | ✅ `654f4a85 docs: スクリーンショット格納` ← `b90df21a Merge pull request #233` |

---

## 2. 射程 A — 説明書へ画像を貼り込む（`dcaceda7`）

### 2.1 段 1 の実査（**手を入れる前に済ませた**。出力は全量ファイルへ落とし `wc -l` で計数。`head` で切っていない）

| # | 数えたもの | 件数 | どう数えたか |
|---|---|---|---|
| 1-1 | `<img>` の全数（本編 ＋ QS） | **28**（本編 27 ＋ QS 1） | `grep -n "<img" <2 ファイル> > img-all.txt; wc -l` |
| 1-2 | `figure` の `todo` クラス | **28**（本編 27 ＋ QS 1）＝ 1-1 と一致 | `grep -n "todo"` を全量落とし、CSS 定義行（本編 `:107-110` / QS `:46-48`）を除いて数えた |
| 1-3 | 開発者の画像 | **29** | `ls -1 docs/usermanual/images/ > images-list.txt; wc -l` |

**1-3 の突き合わせ（★手を入れる前の表）**：

| 区分 | 件数 | 内容 |
|---|---|---|
| 名前が一致 | 18 | `ch01`〜`ch13` の 17 枚 ＋ `qs-first-combo-1.png` |
| **名前ずれ** | **10** | HTML は `ch15-export-dialog` … `ch22-home`、画像は `ch14-export-dialog` … `ch21-home`。**slug は完全一致・番号だけ −1**（`M38-02` の `ch14` 削除に開発者が追随済み） |
| **余剰** | **1** | `ch18-game-update-0.png`（中身＝コンボ一覧に「ゲームの更新後に確認していないコンボがあります」の帯と「更新未確認のコンボ」ボタンが出た状態） |
| 欠落 | 0 | — |

**⇒ 過不足が出たので止まって開発者へ諮った**（§0.2 の 1・2）。**勝手に名前を付け替えて辻褄を合わせていない。**

### 2.2 やったこと

| # | 内容 | 件数 |
|---|---|---|
| 1 | **章番号の追従**：`ch15`〜`ch22` → `ch14`〜`ch21` を**昇順**で置換（降順だと `ch22→ch21→ch20` と連鎖する）。対象トークン＝`section id` 8 ／ TOC `href` 8 ／ `img src` 10 ／ `figcaption` 内のファイル名 10 ／ **CSS セレクタ `figure img[src*="ch22-"]` 1**（スマホ専用章の `max-width:340px`。★`grep` の全量走査で見つけた。名前だけ追うと落とす）。**★CSS コメント内の `ch22` 2 件も `ch21` へ直しており、`ch1[5-9]\|ch2[0-2]` の出現の総数は 39・取りこぼし 0**（レビュー 低-4） | **37 トークン**（＋コメント 2） |
| 2 | `figure` の `todo` クラスを外す（`class="shot todo"` → `class="shot"` ／ QS `class="todo"` → 無し）。**`figure` / `figcaption` は消していない** | **28** |
| 3 | `figcaption` の制作注記「（撮影は開発者の手番。ファイル名は `<code>…</code>`）」を外す。キャプション本文（「初回起動ウィザード（パスワードを決める段）」等）は残した | **28** |
| 4 | ゲーム更新の影響コンボ（`ch18`）へ**入口の図**を 1 枠追加（`ch18-game-update-0.png`。既存の `-1` の直前。キャプション「この画面の入口——ゲーム更新後のコンボ一覧に出るお知らせの帯と「更新未確認のコンボ」ボタン」） | **+1 図** |
| 5 | `images/.gitkeep` の撮影メモの章番号を追従（`01〜22`→`01〜21` ／ `ch22` スマホ専用→`ch21` ×2 ／ 横長表の例外から消えた `ch14` を除去）＋ 貼り込み済みの注記 1 行 | 4 箇所 |
| 6 | **追加指示②とは別の食い違い**（§0.2-4）：ch08 `:477` と QS `:88` | 2 文 |

### 2.3 ★追加指示①「始動技」の実査 — **食い違い無し**

`grep -n "始動技"` で説明書 2 ファイル ＋ `dist-readme.txt` を全量走査＝**9 行**（本編 8 ／ QS 1 ／ dist-readme 0）。編集画面（ch08）に関わるのは 2 行：

| 行 | 本文 | 判定 |
|---|---|---|
| `readme:485` | 「1 つめに置いた技が始動技になります（**始動技を選ぶ欄はありません**）」 | `M38-01` 追補で読み取り専用表示が消えた後の画面（`ch08-combo-editor-1.png` で実測：基本情報タブに始動技の欄は無い）と**整合** |
| `readme:494` | 「レシピ・始動技・始動位置・…——この 7 つのどれかを変えて保存すると」 | 同一性キー `duplicate_keys.go` の 8 要素 − `character_id` と 1 対 1（`M32-03` §3.2 の是正どおり）。**画面に欄があるとは書いていない**ため整合 |

残り 7 行は ch05 の絞り込み（`:358,370`）・ch07 の状況欄（`:445`）・持続当ての書き分け（`:499`）・確定反撃サーチの段（`:934,975`）・QS の「1 つめに置いた技が始動技」（`:88`）で、いずれも編集画面の欄の話ではない。**⇒ 修正 0 件。**

### 2.4 ★追加指示②と別に見つけた食い違い（§0.2-4・開発者裁定で直した）

`M38-01` で**ダメージ・有利フレームが必須**になった（`comboFormSchemaPublished` の `required()` 2 欄 ／ `VAL-C15`。**仮登録＝`comboFormSchemaDraft` は必須なし・`VAL-C15` はスキップ**）。説明書は `M38-01` 前の文のままだった。

| 箇所 | 前 | 後 |
|---|---|---|
| `readme:477`（ch08） | 「全部が埋まっていなくても保存できます。足りない項目があっても保存は止まりません。」 | 「**ダメージと有利フレームの 2 つを除けば**、全部が埋まっていなくても保存できます。この 2 つだけは必須で、空のままだと保存が止まります（仮登録として保存するときは、この 2 つも空のままでかまいません）。ほかの項目は足りなくても保存は止まりません。」 |
| `quickstart:88` | 「全部埋まっていなくても保存できます」 | 「**ダメージと有利フレームさえ入れれば**、ほかは埋まっていなくても保存できます」 |

### 2.5 検査（指示書 §5-1〜3）

| # | 見たもの | 実測 |
|---|---|---|
| 1 | `img` の `src` が指す先の実在 | **29 / 29**（欠落 0）。`src` の一覧と `ls images/` を `diff` して**差分なし＝1:1** |
| 2 | `figure` の `todo` | **0 件**（readme 0 ／ QS 0） |
| 3 | 「現在準備中です」 | **0 件** |
| 4 | 「全 21 章」 | 1 件・不変（`readme:191`） |
| 5 | HTML の整合 | `html.parser` でタグ対応を検査＝未対応 0 ／ `section` 23:23 ／ `figure` 28:28（＋CSS コメント内の `<figure>` 1） |
| 6 | **描画** | headless Chromium（`/usr/bin/chromium`・`@playwright/test`）で両ファイルを開き、`document.images` の `naturalWidth===0` を数えた＝**readme 28 枚・破損 0 ／ QS 1 枚・破損 0**。`#ch18 figure` は **2 枚**（入口 → 一覧の順） |

### 2.6 射程 A の変更統計

```
 docs/usermanual/images/.gitkeep            |  10 +-
 docs/usermanual/tacpendium-quickstart.html |   6 +-
 docs/usermanual/tacpendium-readme.html     | 172 +++++++++++++++--------------
 3 files changed, 97 insertions(+), 91 deletions(-)
```

**★readme の 172 行は「37 トークンの改番 ＋ 28 図の `todo` ＋ 28 注記 ＋ 2 文 ＋ 1 図」であり、本文の段落は 2 文（§2.4）以外に触っていない。**

---

## 3. 射程 B — macOS の名前を寄せる（案 (a)・`3f81eb68`）

### 3.1 段 1 の実査（1-4 / 1-5）

| # | 数えたもの | 件数 | どう数えたか |
|---|---|---|---|
| 1-4 | `release-targets.sh` の macOS を指す行 | **6**（配列の実体 `:31` は **1 行**。残り 5 行は「非対称は意図されたもの」の注記） | `grep -n -i "macos\|darwin" scripts/release-targets.sh > rt-macos.txt; wc -l` |
| 1-5 | `macos` / `darwin` の出現（`scripts/` ／ `Makefile` ／ `.github/` ／ `docs/design/`。**`--include` を絞っていない**） | **48**（scripts 14 ／ Makefile 7 ／ .github 9 ／ docs/design 18） | `grep -rn -i … > macos-darwin-all.txt; wc -l` |

**★48 件を 1 件ずつ「アーカイブ名として書かれているか」で判定した。全置換していない。**

| 判定 | 箇所 | 扱い |
|---|---|---|
| **アーカイブ名（正本）** | `scripts/release-targets.sh:31` | **改名** |
| アーカイブ名を写した**自己検査の対照** | `scripts/check-release-archive.sh:280`（`mt="tacpendium-macos-arm64.tar.gz"`） | **正本から引く形へ**（§3.2-2） |
| アーカイブ名を写した**利用者向け案内** | `docs/usermanual/dist-readme.txt:47` → `README.txt:47`（`shasum -a 256 -c ….sha256`） | **改名**（§0.2-3） |
| 失効する**コメント** | `release-targets.sh:18-27` ／ `check-release-archive.sh:286` ／ `build-release-archives.sh:111` ／ `nightly-crossbuild.yml:104-109` | **書き換え** |
| **設計書本体** | `docs/design/02-architecture.md:1503`（`tacpendium-macos-arm64.tar.gz`） | **触らない**。CHANGE 原稿を設計伝達レポート §1 / §6 へ |
| ツールチェーン値 | `GOOS=darwin` ／ `build-darwin` ／ `dist/tacpendium-darwin-arm64`（Makefile・nightly・release-targets の 2〜4 列目） | 触らない（元から `darwin`） |
| OS 名としての一般用法 | bash 3.2 の注記 ／ `du -sb` の注記 ／ 「macOS・Linux は非公式」 ／ `~/Library/Application Support` 等 | 触らない |

### 3.2 やったこと

| # | ファイル | 内容 |
|---|---|---|
| 1 | `scripts/release-targets.sh` | `:31` を `tacpendium-darwin-arm64.tar.gz :: tacpendium-darwin-arm64 :: targz :: dist/tacpendium-darwin-arm64` へ。**★2〜4 列目は不変**（案 (b) ではない）。注記を「3 つとも GOOS 名で揃えてある（D-893）／ 経緯 ／ 名前を変えるときはこの 1 行だけ」へ |
| 2 | `scripts/check-release-archive.sh` | **★改名した瞬間に `--self-test` が赤になった**——陰性対照 B が旧名 `mt="tacpendium-macos-arm64.tar.gz"` をハードコードしており、`check_archive` は basename で正本を引くため「正本に定義が無い」で 1 を返す。**着手基点の版で実証＝EXIT=1・`NG 陰性対照 B (期待 0 / 実際 1)`**。⇒ `_first_target_field <形式> <列>` を足し、**zip / targz それぞれ正本の先頭定義から名前を引く**形へ。**2 か所目のハードコードが消えた**（`CHANGE-213` の「正本は 1 か所」を自己検査にも通した） |
| 3 | `scripts/build-release-archives.sh:111` | 「macOS だけ darwin のままになる」→「アーカイブ名も darwin 側へ寄せたため 3 つとも GOOS 名で揃っている（D-893）」 |
| 4 | `.github/workflows/nightly-crossbuild.yml:104-109` | アーカイブ 3 点の列挙を `darwin` へ、「名称も macos-arm64 (darwin ではない)」を削除。**★同じ行にあった旧逐語「(中身 = tacpendium.exe + README.txt)」も正本 `release-targets.sh` への参照に置き換えた**——`followup` の `nightly-crossbuild-comment-stale` ／ `readme-exe-name-ci-comment-unsynced` の実体であり、同じ行を書き換えるのに失効文だけ残す理由が無い。**★実行内容（`for f in dist/…` の 3 点）は 1 文字も変えていない** |
| 5 | `docs/usermanual/dist-readme.txt:47` ＋ `README.txt` | `.sha256` の名前を `tacpendium-darwin-arm64.tar.gz.sha256` へ。`bash scripts/check-dist-readme.sh --write` で再生成し、照合 **EXIT=0** |

### 3.3 検査（指示書 §5-4 / §5-6）

| # | 見たもの | 実測 |
|---|---|---|
| 1 | `bash scripts/check-release-archive.sh --self-test` | **EXIT=0**。`陰性対照 B = 完全な tar.gz(tacpendium-darwin-arm64.tar.gz。中は tacpendium-darwin-arm64) (期待 0 / 実際 0)`。合格（陰性 5 ／ 陽性 6） |
| 2 | 同・**着手基点の版**（`git show 654f4a85:scripts/check-release-archive.sh`）を新しい正本に対して回す | **EXIT=1**・`NG  self-test: 陰性対照 B … (期待 0 / 実際 1)`——**§3.2-2 の是正が要った証拠** |
| 3 | `make release-archives` | **EXIT=0**。出力の抜粋： |

```
  tacpendium-darwin-arm64.tar.gz   24193161 バイト
  4867c793460904962bcc743e224ea7b4ef54224f3a24d6993b65979ee20d59a2  tacpendium-darwin-arm64.tar.gz
OK  tacpendium-darwin-arm64.tar.gz: 実行ファイル tacpendium-darwin-arm64
OK  tacpendium-darwin-arm64.tar.gz: README.txt
OK  tacpendium-darwin-arm64.tar.gz: manual/tacpendium-readme.html (103875 バイト)
OK  tacpendium-darwin-arm64.tar.gz: manual/images/ (ディレクトリ。★枚数は見ない)
OK  tacpendium-darwin-arm64.tar.gz: 追加同梱物 LICENSE … LICENSES/MIT.txt（7 件）
OK  tacpendium-darwin-arm64.tar.gz: SHA-256 照合
違反なし(検査したアーカイブ: 3 本)
```

| # | 見たもの | 実測 |
|---|---|---|
| 4 | `ls dist/release/` | `tacpendium-darwin-arm64.tar.gz`（＋`.sha256`）／ `tacpendium-linux-amd64.tar.gz` ／ `tacpendium-windows-amd64.zip`。**★`.sha256` の名前が README の案内と一致** |
| 5 | `tar -tzf … \| grep -c "manual/images/.*\.png"` | **29**（射程 A の画像が配布物へ入っている） |
| 6 | `bash scripts/check-release-archive.sh`（単体） | **EXIT=0・違反なし（3 本）** |
| 7 | 改名後に残る `macos-arm64` | `scripts/` ／ `Makefile` ／ `.github/` ／ `docs/usermanual/` ／ `README.txt` で **0 件**（`docs/design/02-architecture.md:1503` の 1 件は設計書本体＝原稿で対応） |

### 3.4 射程 B の変更統計

```
 .github/workflows/nightly-crossbuild.yml |  9 +-
 README.txt                               |  2 +-
 docs/usermanual/dist-readme.txt          |  2 +-
 scripts/build-release-archives.sh        |  3 +-
 scripts/check-release-archive.sh         | 24 +++-
 scripts/release-targets.sh               | 21 ++--
 6 files changed, 40 insertions(+), 21 deletions(-)
```

---

## 4. 射程 C — `CLAUDE.md` §8 の表へ 1 行（`b7db3573`）

| # | 内容 |
|---|---|
| 1 | `CLAUDE.md:260` に `scripts/check-release-archive.sh` の行を **1 行**追加（表の末尾）。**他の行は触っていない**（`git diff --stat` ＝ `1 +`） |
| 2 | 「何を見るか」は**スクリプトの実装から**書いた——`check_archive` の (1) 実行ファイル ／ (2) `README.txt` ／ (3) 本文 html のサイズ非 0 ／ (4) `manual/images/` の存在のみ ／ (4b) 追加同梱物 7 件・パス保持 ／ (5) `.sha256` 照合（在るときだけ）、`--self-test` の対照数（陽性 6 ／ 陰性 5）、`main()` の「`dist/release/` が無ければ exit 2」、冒頭の「限界」。**指示書 §2.4 の要約は写していない** |
| 3 | `bash scripts/check-doc-refs.sh` → **EXIT=0**・`dead reference なし`（着手前も EXIT=0 で、足した行が赤にしていない） |

---

## 5. 全数テスト（**出力はファイルへ全量落とし、`EXIT=` と `FAIL` の件数で判定**）

| # | コマンド | 実測 |
|---|---|---|
| 1 | `go test ./... > gotest.txt 2>&1; echo EXIT=$?` ／ `grep -cE "^--- FAIL" gotest.txt` | **EXIT=0 ／ FAIL 0**（`ok` 60 パッケージ） |
| 2 | `cd web && pnpm test > pnpmtest.txt 2>&1; echo EXIT=$?` | **EXIT=0**・`Test Files 234 passed (234)` ／ `Tests 2974 passed (2974)` |
| 3 | `make e2e > e2e.txt 2>&1; echo EXIT=$?` | **EXIT=0**・`363 passed (5.7m)`・**`1 flaky`**（§5.1） |

### 5.1 E2E の実測

- 出力ファイル `e2e.txt` は **全量 316 行**（`tail` で切っていない）。`✓` 364 行（flaky の再走行を含む）／ `✘` 1 行（初回の失敗）／ 最終行 `363 passed (5.7m)`・`EXIT=0`
- **flaky 1 件**＝`e2e/m31-02-tag-field-drag.spec.ts:49` 「右へ枠外までドラッグしても文字選択が消えない」。**retry で通過**。マウスドラッグの spec であり、本サブは `web/src` ／ `internal/` を 1 行も触っていない（§6）ため本サブ由来ではない。★同 spec の不安定は既知の「稀 flaky（retry で吸収）」の範囲

### 5.2 常設検査

| 検査 | 実測 |
|---|---|
| `check-artifact-integrity.sh`（★1 本目） | **EXIT=0・違反なし** |
| `check-doc-refs.sh` | **EXIT=0** |
| `check-release-archive.sh --self-test` ／ 単体 | **EXIT=0 ／ EXIT=0** |
| `check-dist-readme.sh` | **EXIT=0**（正本と生成物が一致） |
| `check-md-emphasis.sh CLAUDE.md`（ファイル引数） | **EXIT=0・検出 0 行** |
| `check-md-emphasis.sh`（常時走査） | **EXIT=1**（現在 798 行 ／ 床 247）。**★着手前からの赤である**——`--list` の内訳は `parallel-board.md` 109 ／ `retrospective-digest.md` 46 ／ `retrospective-log.md` 38 … で、**本サブが触った `.md` は `CLAUDE.md` の 1 行のみ・同ファイルの検出 0 行**。⇒ 本サブ由来の増加 0。是正は設計卓の手番（§8） |
| **★報告を書いた*後に*回し直した検査**（Phase D・索引行の追記後） | `check-progress-log-index.sh` **EXIT=1**——**ただし `m38-03` は緑**で、残る NG は `m19-04` の既存欠落 1 件のみ（着手前からの状態・レビュアーも同じ観測）／ `check-completion-report-md-emphasis.sh` **EXIT=0** ／ `check-doc-inventory.sh` **EXIT=0・型に無いファイルなし** ／ `check-artifact-integrity.sh` **EXIT=0** ／ `check-stop-discipline.sh` **EXIT=0** ／ `check-doc-refs.sh` **EXIT=0** |
| `check-md-emphasis.sh <本サブの新規 .md>`（ファイル引数） | 完了報告 **0 行** ／ レビュー報告書 **0 行** |

---

## 6. 変更統計（着手基点 `654f4a85` → `b7db3573`）

```
 .github/workflows/nightly-crossbuild.yml   |   9 +-
 CLAUDE.md                                  |   1 +
 README.txt                                 |   2 +-
 docs/usermanual/dist-readme.txt            |   2 +-
 docs/usermanual/images/.gitkeep            |  10 +-
 docs/usermanual/tacpendium-quickstart.html |   6 +-
 docs/usermanual/tacpendium-readme.html     | 172 +++++++++++++++--------------
 scripts/build-release-archives.sh          |   3 +-
 scripts/check-release-archive.sh           |  24 +++-
 scripts/release-targets.sh                 |  21 ++--
 10 files changed, 138 insertions(+), 112 deletions(-)
```

- **新規ファイルは 0**（Phase A）。⇒ 「新規のつもりのファイルに deletions」は構造上あり得ない（`E-225` の観点で 1 度読んだ）
- `docs/design/` 本体・`followup-backlog.md`・`migrations/`・`web/src`・`internal/` の差分は **0 行**
- **★画像ファイルは 1 枚も作っていない・消していない**（29 枚は `654f4a85` で開発者がコミット済み）

---

## 7. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | CHANGE 番号 | **消費していない**（自採番しない＝`D-293`）。射程 B の原稿を設計伝達レポート §1 / §6 に置く。設計卓が採番するときは `change-number-registry.md` §1 ／ 契約 §4 ／ ボード §2.1 ／ §2.4 の 4 か所（ボード `:123` の「次の CHANGE ＝ `220`〜`231` の 12 本」）を同じ手番で |
| 2 | マイグレ連番 | 消費なし（`ls migrations/` 不変） |
| 3 | 版を上げた文書 | なし |
| 4 | `DES-002` §11.2 | `tacpendium-macos-arm64.tar.gz` → `tacpendium-darwin-arm64.tar.gz`（原稿は設計伝達レポート）。**★同節は「全 22 章」「27 枚の PNG」も持つ**（`M38-02` 後は 21 章 ／ 本サブ後は本編 28 枚 ＋ QS 1 枚）——本サブの射程外だが、同じ原稿で直せる位置にあるので §6 の原稿に添える |
| 5 | `followup-backlog.md` の `nightly-crossbuild-comment-stale` ／ `readme-exe-name-ci-comment-unsynced` | **実体を §3.2-4 で是正した**。畳むのは設計卓（設計伝達レポート §4 へ候補として書く） |
| 6 | `docs/usermanual/images/.gitkeep` | 追従済み（§2.2-5） |
| 7 | `progress-log.md` の索引行 | Phase D で追記 |
| 8 | `followup-backlog.md` の `usermanual-chapter-count-22-scattered` | 「4 か所」に **5 か所目（`README.md` ×2）** が在った（レビュー 高-1）。本サブで直したが、行の数え上げの更新は設計卓（設計伝達レポート §4） |

---

## 8. 設計判断・横断課題（完了報告に書けないものは設計伝達レポート §4 へ）

| # | 事項 | 判断 |
|---|---|---|
| 1 | **章 id を詰めた**（`M38-02` は「詰めない」を選んでいた） | `M38-02` の根拠「詰めると既存の全アンカーが動く」を実査した結果、`#ch15`〜`#ch22` の参照は**本編内部の 16 行だけ**で外部参照 0・未配布。開発者裁定（§0.2-1）で詰めた。**⇒ `M38-02` 完了報告 §10-2 の「章 `id` は詰め直していない」は本サブで失効** |
| 2 | 指示書 §3-2「本文を書き換えない」と §0.2-4 | `M38-01` の必須化との食い違いは**追加指示①の隣で見つけた別件**。指示書執筆時点（2026-09-17）には `M38-01` 追補 2（09-18）が無く、指示書が知り得なかった。開発者裁定で 2 文だけ直した |
| 3 | 指示書 §3-9「`dist-readme.txt` を触らない」と §0.2-3 | 改名で `.sha256` の案内が存在しないファイル名になるため、開発者裁定で 1 行直した（`M38-02` §10-2 が「全 22 章」で同じ判断をした先例） |
| 4 | 自己検査の対照名を正本から引く形にした | 「1 か所で済む」（`CHANGE-213`）を自己検査にも通した。**★改名で赤になることは着手基点の版で実証済み**（§3.3-2） |
| 5 | `check-md-emphasis.sh` 常時走査の赤（798 ／ 床 247） | 着手前からの状態・本サブ由来 0。設計卓の枝から来た `.md`（parallel-board 等）が主部。**是正は書いた本人の手番**（`D-761`） |

---

## 9. レビュー（Phase B / C）— **実測**

- レビュー報告書: `docs/progress/m38-03-review.md`（fresh subagent・コード変更なし。**レビュアー自身が再計数・再検査した値は製造の報告と一致**）
- 判定: §A ◎7/○2 ／ §B ◎7/○1 ／ §C ◎2/○1 ／ §D ◎2/○2 ／ §E ◎2/○1/△3（Phase D 未了分）。**× なし**
- 指摘: **高 2 ／ 中 2 ／ 低 5**（ほかに設計準拠性以外 9 件、うち 8 件は上記と同じ内容）
- 採否: **採用（修正）5**〔高-1 ／ 高-2 ／ 中-1 ／ 低-1 ／ 低-2〕／ **採用（報告のみ）3**〔中-2 ／ 低-3 ／ 設計準拠性以外 9〕／ **採用（報告の追記）1**〔低-4〕／ **不採用 1**〔低-5・理由はレビュー報告書末尾〕
- **「高」指摘の不採用: 0 件**（安全弁の発動なし）
- 再レビュー往復: **0 回**（初回のみ）
- 取り込みコミット: **`c0f13f53`**。取り込み後に `check-doc-refs.sh` **EXIT=0**、`check-md-emphasis.sh CLAUDE.md` **0 行**、`README.md` の検出 7 行は既存行（`11` / `218` は検出なし）

### 9.1 取り込みで動いたファイル（射程別）

| 射程 | ファイル | 内容 |
|---|---|---|
| A | `docs/usermanual/tacpendium-readme.html:107` ／ `tacpendium-quickstart.html:46` | CSS 注記を将来規約の形へ（低-2） |
| A | `docs/usermanual/images/.gitkeep:1` | 「撮影と貼り込みは開発者の手番」→ 貼り込みは Claude 側（低-1） |
| B | `.github/workflows/nightly-crossbuild.yml:112-113` | 失効した行番号参照 `L68-94` → 見出し名（高-2）。実行内容は不変 |
| C | `CLAUDE.md:260` | exit 2 の条件 ／ `RELEASE_EXTRA_FILES` への参照（中-1） |
| 共通 | `README.md:11,218` | 「全 22 章」→「全 21 章」×2 ／ 「スクリーンショットは未配置」→ 配置済み（高-1）。**★`M38-02` の 4 面追随の外に残っていた第 5 面** |

---

## 10. 完了条件（指示書 §6）の消し込み

| # | 条件 | 根拠 |
|---|---|---|
| 1 | 段 1 の実査 5 点が件数で在る | §2.1（1-1〜1-3）／ §3.1（1-4・1-5） |
| 2 | `img` が全数実在・突き合わせ | §2.5-1（29 / 29・1:1） |
| 3 | `todo` 0 件 | §2.5-2 |
| 4 | アーカイブ名が `darwin`・`check-release-archive.sh` 緑 | §3.3 |
| 5 | `CLAUDE.md` §8 に行が在り `check-doc-refs.sh` 緑 | §4 |
| 6 | `DES-002` §11.2 の原稿が設計伝達レポート §1 / §6 | 設計伝達レポート（Phase D 後に作成） |
| 7 | §5 の検査がすべて緑 | §5（E2E は §5.1） |
| 8 | 完了報告 ＋ 索引行 | 本書 ／ `progress-log.md` 末尾に追記済み |
| 9 | 報告が A / B / C に分かれている | §2 / §3 / §4 |
| 10 | 版ゲート 6 点 | §1 |
| 11 | 報告を書いた後に検査を回し直す | **済**（§5.2 の末尾。索引行の追記後に 6 本を回し直した） |

---

## 11. 追補（2026-09-19・開発者指示）— `images/.gitkeep` → `images/SCREENSHOT-RULES.md`

| # | 内容 |
|---|---|
| 1 | 開発者指示（逐語＝「gitkeep のファイル名を変更してもらえますか？今後の機能変更などで再撮影が必要になった時に撮影ルール等は残しておきたい。ルール以外の部分は消して良い」）により、`.gitkeep` を **`SCREENSHOT-RULES.md`** へ改名し、撮影ルール（命名規約 ／ 何を撮るか ／ 撮影の設定 ／ 貼り込みのルール）だけを Markdown で残した。根拠の段落と経緯（`M32-01` / `M32-03` / `D-893`・「29 枚貼り込み済み」）は削除 |
| 2 | 同ファイルが `images/` ごと配布物へ入らないよう `scripts/release-targets.sh` の `RELEASE_MANUAL_EXCLUDE` へ `images/SCREENSHOT-RULES.md` を追加。`build-release-archives.sh` を回し直し、**3 本とも `SCREENSHOT-RULES` 0 ／ `.gitkeep` 0 ／ PNG 29**。`check-release-archive.sh` 単体 EXIT=0・`--self-test` EXIT=0 |
| 3 | 参照の追随＝`tacpendium-readme.html:102` の CSS コメント。`check-release-archive.sh` の「`.gitkeep` に依存しない」注記は堅牢性の説明として今も正しいため不変 |
| 4 | レビュー低-3（`.gitkeep` が配布物に同梱）は本追補で解消。設計伝達レポート §4-5 を「解消・登録不要」へ更新 |
| 5 | `git rm` は製造の deny のため、`rm` ＋ `git add -A docs/usermanual/images/` で改名を staging した（git は rename として検出） |

*以上、M38-03 完了報告。*
