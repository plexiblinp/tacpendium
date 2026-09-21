# M36-02 完了報告 — リリースの門と来歴（attestation / SBOM / タグ署名 / CI からのリリース）

| 項目 | 内容 |
|------|------|
| 作業 ID | **M36-02** |
| 指示書 | `docs/instructions/M36-02-release-provenance-and-gate.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M36-02-review-checklist.md` v1.1.0 |
| 実施日 | 2026-09-19 |
| 枝 | `claude/nice-clarke-ezxzne` |
| 着手基点 | `0e50b76` |
| マイグレ消費 | **0 本**（指示書どおり） |
| CHANGE 消費 | **自採番しない**（`D-293`）。原稿は設計伝達レポート §1 / §6 へ |

---

## 0. ★最初に読むこと — 開発者へ返す 2 件

### 0.1 ★★★指示書 v1.1.0 の射程 8 は、着手時点で**既に解決済み**であった

指示書 §2.7b は `RELEASE_MANUAL_EXCLUDE` へ **`images/.gitkeep` を足せ**と指示する。**しかしその `.gitkeep` は既に存在しない。**

| 実測 | 値 |
|---|---|
| 改名のコミット | **`3bc5c71`**「docs(M38-03/manual): images/.gitkeep を SCREENSHOT-RULES.md へ改名し、撮影ルールだけを残す（開発者指示）」 |
| 現在の除外配列 | `scripts/release-targets.sh:56` に **`"images/SCREENSHOT-RULES.md"` が既に在る** |
| 当該ファイル自身の記述 | 「本ファイルは配布アーカイブに同梱しません(`scripts/release-targets.sh` の `RELEASE_MANUAL_EXCLUDE`)」 |

**⇒ 判断: 足さなかった。** 存在しないファイル名を配列へ足すと、**誰も消せない死んだ設定**が 1 行増える（`build-release-archives.sh` の除外は `rm -f` なので無害に空振りし、**空振りしていることが永久に分からない**）。

**⇒ 代わりに「不在であること」を配布 3 本で実測した**（§4.5）。**★この判断は開発者が覆せる。** 「それでも足せ」であれば 1 行で対応する。

### 0.2 ★★★attestation とタグ署名の**実出力**は、この手番では原理的に出せない

指示書の完了条件 §3 / §5 は「**検証が通った出力**」を求める。**しかし製造環境では作れない。**

| 必要なもの | 実測した環境の実態 |
|---|---|
| `gh` CLI | **未インストール**（`which gh` が空） |
| タグの作成 | **`git tag` は `.claude/settings.json` の deny**（実際に拒否された） |
| 実際の Actions 実行 | attestation は **Sigstore が実行中の Actions へ短命証明書を発行して初めて生まれる**。ローカルには存在しえない |
| **★★★リポジトリの可視性** | **attestation は private / internal リポジトリでは取れない**（GHEC を除く）。**⇒ 本リポジトリ `combomgr` は非公開の開発リポであり、そもそも実走できない**（**2026-09-20 追記**。§0.3） |

**⇒ 開発者裁定（2026-09-19）に従い、仕組みを全部実装したうえで、実走は開発者の手番へ渡す。** 手順は §7 に書いた。**実出力が揃うまでは停止規律の必須 5 フィールドで記録する**（§8）。

### 0.3 ★★★【2026-09-20 訂正】実走先は `combomgr` ではなく公開リポ `tacpendium` である

**★初版の §7 は「`combomgr` に rc タグを打って実走させる」と書いていた。⇒ 誤りである。** 訂正の経緯を残す（**黙って書き換えない**）。

| # | 事実 | 出典 |
|---|---|---|
| 1 | **attestation は public リポジトリでのみ、全プランで使える** | `actions/attest` README（2026-09-20 実査）「Artifact attestations are available in **public repositories for all current GitHub plans**.」 |
| 2 | **private / internal では GitHub Enterprise Cloud プランが要る** | 同上「To use artifact attestations in private or internal repositories, **you must be on a GitHub Enterprise Cloud plan**.」 |
| 3 | **`combomgr` は非公開の開発リポである** | 開発者（2026-09-20）＝「公開用 `tacpendium` と開発用 `combomgr` でリポジトリは分けることが確定」 |

**⇒ 実走先は `tacpendium`（公開側）であり、開設後にしかできない。⇒ §7 を書き直し、§8 原稿 1 の再開条件も更新した。**

**★★あわせてタグ契機の衝突が 1 件見つかった。** `make-public-snapshot.sh` の設計（`D-637`）は **公開リポ = f(開発リポの tag, 許可リスト)** であり、**`combomgr` にタグを打つことがスナップショット生成の正規の契機**である。一方 `release.yml` は `on: push: tags: ['v*']` で、**`public-snapshot-manifest.txt` の `ALLOW .github/**` により両方のリポジトリに存在する。⇒ ガードが無いと、スナップショットを作るたびに `combomgr` 側が赤くなる。**

**⇒ 開発者裁定（2026-09-20）に従い、`release.yml` の `release` job へ `if: github.event.repository.private == false` を入れた**（コミット `92ae417`）**。★`!= true` ではなく `== false` にしてある**——フィールドが取れなかったときに**走らない**側へ倒すため（fail-closed）。**★副次効果として「意図しない版が公開される」が構造的に起きなくなる。**

---

## 1. 着手前の版ゲート（指示書 §0.3）— **6 点すべて通した**

| # | 条件 | 実測 |
|---|---|---|
| 1 | チェックリストが存在する | ✅ `docs/instructions/reviews/M36-02-review-checklist.md`（7135 バイト） |
| 2 | `M36-01` の 3 本が在る | ✅ `release-targets.sh` / `build-release-archives.sh` / `check-release-archive.sh` |
| 3 | `docs/usermanual/` の `img` が全数実在 | ✅ **参照 29 件 / 欠落 0 件**（本編 28 ＋ クイックスタート 1。`images/*.png` も 29 枚） |
| 4 | `CLAUDE.md` §8 に `check-release-archive.sh` の行 | ✅ 1 件 |
| 5 | `make release-archives` が通る | ✅ `EXIT=0`「違反なし(検査したアーカイブ: 3 本)」 |
| **5b** | **`go test ./...` が EXIT=0** | ✅ **`EXIT=0` / `--- FAIL` 0 件** ⇒ `M33-03` 着地済み |
| 6 | 枝元 | ✅ `0e50b76` |

---

## 2. ★★★段 0 — 外部仕様の実査（**コードを書く前に完了。確認日 2026-09-19**）

**★`docs.github.com` は本環境の egress proxy で遮断されていた**（`EGRESS_BLOCKED`）。**⇒ 一次情報は `github.com` 上の公式リポジトリの README と `cli/cli` のソースから引いた。** 二次情報・記憶は使っていない。

### 2.1 ★★★最重要の発見 — 記憶で書いていたら確実に壊れていた

**`actions/attest-build-provenance` と `actions/attest-sbom` は、v4 以降どちらも `actions/attest` の薄い wrapper であり、README が「新規実装は `actions/attest` を使え」と明記している。**

> "As of version 4, `actions/attest-build-provenance` is simply a wrapper on top of `actions/attest`. Existing applications may continue to use the `attest-build-provenance` action, but **new implementations should use `actions/attest` instead**."

**★★これは指示書 §4.2 が警告した形そのものである**——**旧アクションは「動かない」のではなく「非推奨のまま動く」。⇒ その場合テストは緑である。**

### 2.1b ★★★出典の格付けを 1 件誤っていた（レビュー 高-1 で是正・2026-09-19）

**★初版の本節は、タグ署名検証の出典に*第三者の個人リポジトリの PR* を引き、その説明文を「一次情報の逐語」として載せていた。⇒ 誤りである。**

**★★これはチェックリスト A-1（★★★「一次情報の URL が付いているか」）と §0-2 が守ろうとしたものそのものであり、しかも同じ記述が `release.yml` のヘッダにも入っていた。⇒ コードに「一次情報が言っている」と書いてあれば、後任は裏を取らない。**

**⇒ 是正**: 出典を **git 自身のドキュメント**（`git/git` の `Documentation/config/gpg.adoc`）へ差し替えた。**★あわせて「タグを持たない checkout は検証対象 0 件で緑になる」は*公式の記述ではない*ため、格付けを「本ワークフローの設計上の判断（自前の推論）」と明記した**（`release.yml` 側も同じ）。**主張と対処（5 段の明示的拒否）は変えていない。変えたのは格付けである。**

> **★なぜ起きたか**: `docs.github.com` と `git-scm.com` がともに本環境の egress proxy で遮断されており、検索結果に出た第三者の実装例を掴んだ。**⇒ 遮断は理由にならない。** 実際、`git/git` リポジトリの `Documentation/` は到達でき、そこに答えが在った。**★「一次情報へ到達できないとき、二次情報を一次情報として書く」のが最も危ない。到達できないなら格付けをそう書くべきだった。**

### 2.2 実査の 4 点（指示書 §2.1）

| # | 調べたこと | 結論 | 一次情報 URL | 確認日 |
|---|---|---|---|---|
| **1** | attestation の**現在の**入口 | **`actions/attest@v4`**。入力 `subject-path`（glob 可・subject 総数 1024 まで）/ `subject-digest` / `subject-name` / `subject-checksums` / `sbom-path` / `predicate-type` / `predicate` / `predicate-path` / `push-to-registry`(既定 false) / `create-storage-record`(既定 true・**push-to-registry が true のときのもの**) / `show-summary` / `github-token`。出力 `attestation-id` / `attestation-url` / `bundle-path` / `storage-record-ids` | https://github.com/actions/attest/blob/main/README.md | 2026-09-19 |
| **1b** | 旧手段の失効 | **wrapper 化。新規実装は `actions/attest`**（上の逐語） | https://github.com/actions/attest-build-provenance/blob/main/README.md ／ https://github.com/actions/attest-sbom/blob/main/README.md | 2026-09-19 |
| **1c** | **必要な permissions** | README は `id-token: write` / `attestations: write` / `artifact-metadata: write` の 3 つを挙げる。**★ただし `artifact-metadata` は「artifact storage record を作る」ためのもの**であり、storage record は `push-to-registry` を使うときのものである。**★アクション自身の CI は `contents: read` + `attestations: write` + `id-token: write` だけで動いている** | https://github.com/actions/attest/blob/main/.github/workflows/ci.yml | 2026-09-19 |
| **★★1d** | **attestation の*リポジトリ可視性*の要件**（**★2026-09-20 追加。初版はこれを見ていなかった**） | **public リポジトリ＝全プランで使える ／ private・internal＝GitHub Enterprise Cloud プランが要る ／ GitHub Enterprise Server は非対応。** ★Sigstore のインスタンスも分かれる（public＝public-good ／ private＝GitHub の private インスタンス） | https://github.com/actions/attest/blob/main/README.md | 2026-09-20 |
| **2** | SBOM の**現在の**生成手段 | **GitHub の組み込み機能では生成できない。** `actions/attest@v4` の `sbom-path` は**既にある SPDX / CycloneDX JSON を attest する**入力であって、生成はしない。⇒ **別ツールが要る** | 同 1 | 2026-09-19 |
| **2b** | その別ツール | **`anchore/sbom-action`**（syft ベース）。**ライセンス Apache-2.0**＝`CLAUDE.md` §6 の許可列。最新 **v0.24.2**、メジャータグは **`v0`**。出力形式は `spdx` / `spdx-json` / `cyclonedx` / `cyclonedx-json` | https://github.com/anchore/sbom-action ／ https://github.com/anchore/sbom-action/releases | 2026-09-19 |
| **3** | タグ署名の検証を CI で行う手段 | **`git verify-tag` ＋ `git config gpg.ssh.allowedSignersFile`**。**git 組み込みであり新規依存ゼロ。** 逐語（`gpg.ssh.allowedSignersFile`）＝「A file containing ssh public keys which you are willing to trust. The file consists of one or more lines of principals followed by an ssh public key.」**★★★段 1 の (4) の根拠＝同ドキュメントの「署名者の公開鍵が同ファイルに無い場合、git は信頼度を `undefined` とし、`git verify-commit` / `git verify-tag` は失敗する」。⇒ 鍵が未登録なら検証は通らない** | **git 自身のドキュメント**: https://raw.githubusercontent.com/git/git/master/Documentation/config/gpg.adoc | 2026-09-19 |
| **4** | 利用者側の検証コマンド | **`gh attestation verify <file-path> --repo <owner>/<repo>`**。`--owner` か `--repo` のどちらかが必須。強化用に `--signer-workflow` / `--signer-repo` / `--predicate-type` / `--cert-identity` / `--source-ref` / `--format json` / `--deny-self-hosted-runners` | https://github.com/cli/cli/blob/trunk/pkg/cmd/attestation/verify/verify.go | 2026-09-19 |

### 2.3 ★開発者へ諮った事項（指示書 §7）と裁定

| # | 事項 | 諮った時点 | 裁定 |
|---|---|---|---|
| 1 | **SBOM に新しい道具が要る場合の採否**（`CLAUDE.md` §6） | **Plan Mode・実装前** | **`anchore/sbom-action` を採る** |
| 2 | 検証の実出力の扱い | 同上 | **仕組みを全部実装し、開発者が rc タグで実走** |
| 3 | タグ署名の方式 | 同上 | **SSH 署名 ＋ `allowed_signers`** |

**★`go.mod` / `web/package.json` は 1 行も変わっていない**（CI のアクション参照が 1 本増えただけ）。**★`pnpm.overrides` / `replace` / `toolchain` にも触れていない**（`CLAUDE.md` §6 の版固定条項）。

---

## 3. 変更したファイル

```
  .github/allowed_signers                   |  37 +++
  .github/workflows/release.yml             | 401 +++++++++++++++++++++++++
  CLAUDE.md                                 |   3 +
  docs/progress/M36-02-completion-report.md | 482 ++++++++++++++++++++++++++++++
  scripts/check-artifact-integrity.sh       |   7 +-
  scripts/check-dist-readme.sh              | 125 +++++++-
  scripts/check-manual-images.sh            | 315 +++++++++++++++++++
  scripts/generate-release-notes.sh         | 287 ++++++++++++++++++
  8 files changed, 1652 insertions(+), 5 deletions(-)
```
（`git diff --stat 0e50b76 HEAD`。★レビュー取り込み `b43d446` を含む最終値）

**★`E-225` の観点で読んだ。** **新規 4 ファイル**（`allowed_signers` / `release.yml` / `check-manual-images.sh` / `generate-release-notes.sh`）は **すべて `+` のみで deletions が 0**。唯一 deletions を持つ `check-dist-readme.sh` の `-4` は、**限界の節（5 行）を 10 行へ書き替えた意図的な編集**であり、上書き事故ではない。

**★`check-artifact-integrity.sh` の `+7 -1` はレビュー 高-2 の是正**（走査対象へ `generate-release-notes.sh` を明示）。

コミット（着手基点 `0e50b76` から 7 本）:

| コミット | 内容 |
|---|---|
| `6b6df81` | 門 `check-manual-images.sh`（射程 1） |
| `57421c0` | `check-dist-readme.sh` へアーカイブ名照合（射程 7） |
| `d08e66b` | `generate-release-notes.sh`（射程 6） |
| `9fe72c5` | `release.yml` ＋ `allowed_signers`（射程 2〜5） |
| `479ab36` | `CLAUDE.md` §8 の表へ 3 行 |
| `5b82bc4` | 完了報告（Phase A/B 時点） |
| **`b43d446`** | **レビュー指摘の取り込み（高 2 / 中 4 / 低 3）** |

---

## 4. 射程ごとの実装と実測

### 4.1 射程 1 — 門（`scripts/check-manual-images.sh`）

**★★置き場の判断と理由**（指示書 §2.2-5 が実装判断と定める）:

`build-release-archives.sh:189` は**末尾で `check-release-archive.sh` を必ず呼ぶ**。門をそちらへ足すと **`make release-archives` そのものが塞がり、指示書 §3-2 に違反する**（開発中に組めなくなる）。**⇒ 独立した検査にし、リリースを打つ経路（`release.yml`）からだけ呼ぶ。**

見るもの:

- **参照 1 件ごとに実体を見る。★「PNG が 0 枚でないか」にしない**（`D-890` の逐語＝1 枚でも在れば通ってしまう）
- **走査は説明書ディレクトリ直下の `*.html` 全数**。名前を列挙しない（`D-886`）⇒ **クイックスタートも母集団に入る**（チェックリスト B-5）
- **参照 0 件を赤にする**（★空集合の罠。「リンク切れが無い」ではなく「抽出できなくなった」でありうる）
- **`<img` の個数と `src="` の抽出件数を突合**（★`<img src='...'>` のような単引用符で抽出が漏れるのを黙って見逃さない）
- 絶対パス参照・`..` で外へ出る参照・空ファイルも赤

**自己検査（陰性 3 / 陽性 6）**:

```
OK  self-test: 陰性対照 A = 参照と実体が揃っている (期待 0 / 実際 0)
OK  self-test: 陰性対照 B = 外部 URL 混在(★実在は見ないが赤にしない) (期待 0 / 実際 0)
OK  self-test: 陰性対照 C = 参照されない図が余分に 2 枚(★枚数で固定していない証拠) (期待 0 / 実際 0)
OK  self-test: 陽性対照 = 図を 1 枚どけた (期待 1 / 実際 1)
OK  self-test: 陽性対照 = 参照 0 件(★「PNG が在る」だけでは通さない) (期待 1 / 実際 1)
OK  self-test: 陽性対照 = src が単引用符(★img の個数と突合して検出) (期待 1 / 実際 1)
OK  self-test: 陽性対照 = 絶対パス参照 (期待 1 / 実際 1)
OK  self-test: 陽性対照 = 2 本目の説明書だけ壊れている(★本編だけ見ていない証拠) (期待 1 / 実際 1)
OK  self-test: 陽性対照 = 図が空ファイル (期待 1 / 実際 1)
自己検査: 合格(陽性は赤・陰性は緑。陰性 3 / 陽性 6)
EXIT=0
```

**★★★破壊確認（実ツリー・指示書 §2.2-4 / チェックリスト B-1）**:

```
=== [1] 退避前: 門は緑 ===
EXIT=0

=== [2] ch05-combo-list-1.png を 1 枚どける ===
moved

=== [3] 門を回す(★赤になるはず) ===
EXIT=1
NG  tacpendium-readme.html: 参照先が在りません: images/ch05-combo-list-1.png
    説明書 2 本 / 図の参照 29 件を見ました
違反 1 件

=== [4] 戻す ===
restored

=== [5] 復旧後: 門は緑 ===
EXIT=0
違反なし(説明書の図はすべて実在します: docs/usermanual)

=== [6] git 差分が無いこと(★戻し漏れの検出) ===
0
```

### 4.2 射程 7 — アーカイブ名を機械で結ぶ（`scripts/check-dist-readme.sh`）

**★★置き場の判断と理由**（指示書 §2.7a-2 が段 0 の実査で決めよと定める）:

`check-dist-readme.sh` は**自らの限界として**「本検査が見るのは『正本と生成物が一致しているか』だけである。**正本の内容が正しいかは見ない。** 起動方法の実行ファイル名が Makefile の出力と一致しているか、といった意味の検査は**人が読む以外に経路が無い**」と宣言していた。**⇒ 射程 7 はまさにその穴である。** かつ**正本 `dist-readme.txt` を所有しているのは同スクリプトである。**

対して `check-release-archive.sh` は「**README の文面が実態と合うかは見ない**」と自ら宣言しており、そちらへ足すと宣言と矛盾する。

**⇒ `check-dist-readme.sh` へ置き、限界の記述も同じ手番で更新した**（★失効した記述をコード上に残さない）。

**通常検査**:

```
✅ 一致: README.txt は docs/usermanual/dist-readme.txt から生成した内容と同一です

--- アーカイブ名の照合(構成の正本 scripts/release-targets.sh と突合) ---
  ✅ アーカイブ名: tacpendium-windows-amd64.zip
  ✅ アーカイブ名: tacpendium-darwin-arm64.tar.gz
  ✅ アーカイブ名: tacpendium-linux-amd64.tar.gz
EXIT=0
```

**★★★破壊確認（実ツリー・チェックリスト G-2）** — 正本のアーカイブ名を 1 つ書き換えると落ちる:

```
=== [2] 正本のアーカイブ名を 1 つ書き換える (linux-amd64 -> linux-x86_64) ===
35:  "tacpendium-linux-x86_64.tar.gz :: tacpendium-linux-amd64 :: targz :: dist/tacpendium-linux-amd64"

=== [3] 検査を回す(★赤になるはず。README.txt が追随していない) ===
EXIT=1
  ✅ アーカイブ名: tacpendium-windows-amd64.zip
  ✅ アーカイブ名: tacpendium-darwin-arm64.tar.gz
  ❌ アーカイブ名が README.txt に現れません: tacpendium-linux-x86_64.tar.gz

  ★構成の正本は scripts/release-targets.sh です。アーカイブ名を変えたのなら、
    正本 docs/usermanual/dist-readme.txt の案内も追随させ、bash scripts/check-dist-readme.sh --write で
    生成し直してください(★直すのは正本であって README.txt ではありません)。

=== [4] 戻す ===
復旧後 EXIT=0
git 差分(release-targets.sh): 0 件
```

**★★申し送り**: **実行ファイル名（`RELEASE_TARGETS` の 2 列目。`dist-readme.txt` の 20〜22 行目と 148 行目）は同じ型の写しだが、まだ機械で結ばれていない。** 射程 7 の範囲外（指示書は「1 列目」と明示）なので**広げず**、限界の節へ明記し §8 の申し送りへ回した。

### 4.3 射程 6 — 検証手順をリリースページ側へ（`scripts/generate-release-notes.sh`）

**★正本を 1 つに保つ（`E-76` / チェックリスト D-4）。手で 2 か所に書いていない。**

| 部品 | 正本 | 取り方 |
|---|---|---|
| SHA-256 の手順 | `docs/usermanual/dist-readme.txt` | **見出し行から次の `■ ` の直前まで awk で*抽出*する。写さない** |
| アーカイブ名 | `scripts/release-targets.sh` | `RELEASE_TARGETS` から引く |
| attestation の手順 | **本スクリプト**（`README.txt` 側に無いため） | — |

**★`docs/usermanual/` は 1 バイトも編集していない**（指示書 §3-8 / チェックリスト E-2。`M38-03` の成果である）。**読み取りのみ。**

**★★抽出が空振りしたら黙って短い本文を出さず `exit 2` で止まる。** 検証手順の無いリリースページが出るのが最悪であるため。

**自己検査（陰性 4 / 陽性 2）**:

```
OK  self-test: 陰性対照 A = 正本から SHA-256 の節を抽出できた (18 行)
OK  self-test: 陰性対照 B = 次の節を巻き込んでいない
OK  self-test: 陰性対照 C = 抽出した節にアーカイブ名が全数在る
OK  self-test: 陽性対照 = 見出しを変えたら抽出失敗として返した (rc=1)
OK  self-test: 陽性対照 = 正本が無ければ実行エラー(rc=2)
OK  self-test: 陰性対照 D = 本文の生成が通った
自己検査: 合格(陽性は赤・陰性は緑。陰性 4 / 陽性 2)
EXIT=0
```

生成した本文は **4 節**（配布物の表 ／ 1. 壊れていないことの確認(SHA-256) ／ 2. 出どころの確認(attestation) ／ このリリースが証明すること・しないこと）。最後の節に **「❌ コード署名(Authenticode)は付いていません ⇒ SmartScreen の警告が出ます」** を明記した（指示書 §0.1＝**`B1` を諦めた事実を利用者に隠さない**）。

### 4.4 射程 2〜5 — リリースワークフロー（`.github/workflows/release.yml`）

**★nightly と別ファイルにした。** 契機が違う（nightly＝定時 / リリース＝タグ）。**`CHANGE-129` の境界を構造で守る。**

| 段 | 中身 |
|---|---|
| 1 | **★★★タグ署名の検証（何よりも先）。5 つの穴をすべて明示的に赤にする** |
| 2 | 門（`check-manual-images.sh` ＋ `check-dist-readme.sh`） |
| 3 | `make build-all` → `bash scripts/build-release-archives.sh`（**`M36-01` が CI 用と明記した入口**） |
| 4 | SBOM（`anchore/sbom-action@v0` で `spdx-json`）。**★出しただけにせず中身の件数を見る** |
| 5 | attestation（`actions/attest@v4`）を**来歴と SBOM の 2 本** |
| 6 | リリース本文（`generate-release-notes.sh`） |
| 7 | `gh release create`。**★CI から出す。手元からアップロードしない** |

**★★★段 1 が拒否する 5 つ**（指示書 §2.5-3 / §4.5 / チェックリスト C-6）:

1. タグのオブジェクトが checkout に無い（`fetch-tags` 漏れ＝**「検証対象 0 件で緑」の罠**）
2. **軽量タグ**（署名を持てない）
3. 台帳 `.github/allowed_signers` が無い
4. **★台帳にコメントと空行しか無い＝鍵が未登録**
5. `git verify-tag` そのものの失敗

**★★★多重防御**: 検証が通った段だけが `${RUNNER_TEMP}/tag-verified` を置き、**公開段はその印が無ければ `exit 1` する。⇒ 将来だれかが `if:` 条件を緩めても、署名なしでは公開されない。**

**★permissions から `artifact-metadata: write` は外した。** 理由は §2.2 の 1c（storage record は `push-to-registry` を使うときのものであり、**アクション自身の CI も 2 つだけで動いている**）。**⇒ 付ける必要が出たら理由ごと足せるよう、ワークフロー冒頭に URL 付きで書いた。**

**★鍵は作っていない・登録していない**（指示書 §0.4 / チェックリスト C-5）。`.github/allowed_signers` は**空の器**であり、**登録が 0 件なので現状では段 1 の (4) で明示的に落ちる。**

### 4.5 射程 8 — `.gitkeep` を配布物から外す（**★既に解決済みのため実測で示した**）

判断の根拠は §0.1。**配布 3 本での実測**（`SCREENSHOT-RULES.md` と `.gitkeep` の該当件数）:

```
--- dist/release/tacpendium-windows-amd64.zip ---   0
--- dist/release/tacpendium-darwin-arm64.tar.gz --- 0
--- dist/release/tacpendium-linux-amd64.tar.gz ---  0
=== 参考: manual/images のエントリ数(linux) === 30   (= PNG 29 枚 + ディレクトリ自身)
```

**★`check-release-archive.sh` の `has_dir`（陰性対照 E）が `.gitkeep` に依存しないことも確認済み**（チェックリスト G-5）——同対照は「真に空の `images/`」でも緑になることを機械で示しており、**除外を足しても検査は影響を受けない**。

---

## 5. テスト・検査（★出力は全量ファイルへ落とし、パイプ越しに合否を判定していない）

### 5.1 全数テスト

| 対象 | コマンド | EXIT | 実測 |
|---|---|---|---|
| Go | **`go test -count=1 ./...`** | **0** | **`--- FAIL` 0 件** ／ `^ok` **60 件** ／ **★`(cached)` 0 件** ／ `no test files` 9 件 |
| フロント | `pnpm test -- --run` | **0** | **Test Files 234 passed (234)** ／ **Tests 2974 passed (2974)** |
| E2E | `make e2e` | **0** | **364 passed (7.5m)** ／ **failed 0 ／ flaky 0** |

**★`make e2e` を使っており `playwright` を直接叩いていない**（`CLAUDE.md` §11 / `D-599`）。

> **★★`-count=1` を付けた理由（レビュー 低-5 で是正）。** 初版は `go test ./...` の値を貼っており、**レビュアーが独自に回したとき `ok` 60 件のうち 58 件が `(cached)` であった。⇒ 「実行していないのに緑」を区別できない値だった**（`DES-002` §11.3 契約 1＝所要が 3 桁違い、終了コードはどちらも 0）。**⇒ 上表は `-count=1` で取り直した実測であり、`(cached)` は 0 件である。**
>
> **★フロント単体テストと E2E は取り直していない。** レビュー取り込みコミット `b43d446` が触ったのは `scripts/` ／ `.github/` ／ `CLAUDE.md` だけであり、**プロダクトコード（`internal/` ／ `cmd/` ／ `web/src/`）は 1 行も変わっていない。⇒ 再実行しない理由をここに書く**（黙って古い値を貼らない）。

### 5.2 検査

| 検査 | EXIT | 備考 |
|---|---|---|
| `check-artifact-integrity.sh` | **0** | **★1 本目に回した。** 新設 2 本の `--self-test` が実際に走ったことも確認（`OK check-manual-images.sh の自己検査が通る`） |
| `check-manual-images.sh --self-test` | **0** | 陰性 3 / 陽性 6 |
| `check-dist-readme.sh --self-test` | **0** | 陰性 2 / 陽性 2 |
| `check-release-archive.sh --self-test` | **0** | **既存が壊れていないこと** |
| `generate-release-notes.sh --self-test` | **0** | 陰性 4 / 陽性 2 |
| `check-doc-refs.sh` | **0** | |
| `check-doc-inventory.sh` | **0** | 情報提供型 |
| `check-stop-discipline.sh` | **0** | |
| **`make release-archives`** | **0** | **★門で塞いでいないことの証明**（完了条件 §6-6 / チェックリスト B-3） |

### 5.3 CI の非破壊

| 見たこと | 実測 |
|---|---|
| `nightly-crossbuild.yml` の差分 | **0 行**（`git diff --stat` / `git status --short` とも 0） |
| `pr-checks.yml` の差分 | **0 行** |
| YAML のパース | **3 本とも OK**（`release.yml` → `jobs: ['release']` ／ nightly → `['crossbuild','e2e']` ／ pr-checks → `['go-vet-build','go-test','web-test']`） |

**⇒ `CHANGE-129` と衝突していない。nightly の artifact は 1 バイトも格上げしていない**（完了条件 §8 / チェックリスト D-2）。

### 5.4 タグ署名ロジックのローカル対照

**★実タグは作れない（`git tag` は deny）ため、判定ロジックを取り出して対照実行した。**

```
=== 対照1: 存在しないタグ → (1) で赤 ===        ERR(1): タグが checkout に在りません / EXIT=1
=== ★★対照3(本命): 実物の台帳=コメントのみ → (4) で赤 ===
実効的な署名者: 0 件
→ 鍵未登録なので明示的に落ちる（素通りしない）  EXIT=1
=== 対照4: 署名者を1件登録したと仮定 → 段(4)を通過 ===
実効的な署名者: 1 件 → 段(4) を通過
```

**⇒ 「鍵が未登録なら明示的に落ちる」がロジックとして成立していることは示せた。★ただし `git verify-tag` そのものの実挙動は、実タグでしか確かめられない**（§8 の停止時記録）。

### 5.5 Markdown の閉じない強調

`bash scripts/check-md-emphasis.sh` を、この手番で `docs/progress/` へ新規に作ったファイルへファイル引数モードで回した。**結果は §6 の表に記す。**

---

## 6. ★報告を書いた「後に」回し直した検査（完了条件 §13 / `D-890`）

**★★★`M36-01` が実際に落ちた穴である**——検査を回した時点と報告を書いた時点がずれると、「緑」が偽になる。**完了報告そのものが検査の入力だからである。**

**★★★回した時点＝完了報告・レビュー報告書・`progress-log.md` の索引行を*すべて書き終えた後*である。** 以下は実測値。

| 検査 | EXIT | 実測 |
|---|---|---|
| `check-progress-log-index.sh` | **0** | **検査した 121 件すべてが `progress-log` に現れる**（ALLOW 除外 17 件）。★索引行を書く前は `M36-02` の完了報告に対応する追記が無く**赤になる**状態だった |
| `check-completion-report-md-emphasis.sh` | **0** | 製造 CLI 4 本のマーカー ＋ 指示書テンプレート §7.4 が健在 |
| `check-doc-inventory.sh` | **0** | **新種のファイルは検出されていない**（新設 2 本はいずれも既存運用の型＝完了報告 / レビュー報告書） |
| `check-md-emphasis.sh docs/progress/M36-02-completion-report.md docs/progress/m36-02-review.md` | **0** | **検出 0 行**（★この手番で `docs/progress/` へ新規に作った 2 本をファイル引数モードで） |
| `check-artifact-integrity.sh` | **0** | **★1 本目にも回した。検査 19 件 / ALLOW 除外 1 件**（レビュー 高-2 の是正で 18 → 19） |
| `check-doc-refs.sh` | **0** | |
| `check-stop-discipline.sh` | **0** | |

> **★★★なぜこの節が要るか**（`D-890`・`M36-01` が実際に落ちた穴）。**完了報告そのものが検査の入力である。** `M36-01` は `check-progress-log-index.sh` を**報告を書く前**に回して得た `EXIT=0` を表へ書き、**その後に報告を作成したことで同検査が赤へ変わった**——製造は気づかず、赤い検査を緑と書いた表を残した。**⇒ 回した時点と報告を書いた時点がずれると、「緑」が偽になる。**
>
> **★本サブでも実際に同じことが起きかけた**——索引行を書く前の `check-progress-log-index.sh` は、`M36-02` の完了報告に対応する `progress-log` の追記が無いため**赤になる**状態だった。**⇒ 上の値は索引行を書いた後のものである。**

---

## 7. ★★★開発者の手番 — 鍵を用意する側の手順（指示書 §2.5-4 / チェックリスト C-7）

**★製造は鍵を作っていない・登録していない。以下は開発者が実施して初めて as-built になる。**

> **★★★【2026-09-20 訂正】本節の初版は「`combomgr` に rc タグを打って実走させる」と書いていた。⇒ 誤りである。** **attestation は private リポジトリでは取れない**（§0.3）**。⇒ 実走先は公開リポ `tacpendium` であり、開設後にしかできない。** **★訂正であることを残す**——黙って書き換えると、初版が**観測ではなく予測**であったことが記録から消える。

### 7.1 署名鍵を作って登録する（**★公開リポ開設を待たずに、いま実施してよい**）

**★`allowed_signers` は `public-snapshot-manifest.txt` の `ALLOW .github/**` により公開スナップショットで運ばれる。⇒ いま `combomgr` 側で登録しておけば、そのまま公開リポへ渡る。**

```bash
# 1) 署名専用の SSH 鍵を作る（認証用と分けることを勧める）
ssh-keygen -t ed25519 -C 'tacpendium release signing' -f ~/.ssh/tacpendium_sign

# 2) git に署名の設定を入れる
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/tacpendium_sign.pub

# 3) 公開鍵を台帳へ 1 行足してコミットする（★足すのは .pub の中身。秘密鍵ではない）
#    書式: <識別子> <鍵の種類> <公開鍵本体>
printf '%s %s\n' 'あなたのメールアドレス' "$(cat ~/.ssh/tacpendium_sign.pub)" \
  >> .github/allowed_signers
```

**★（任意）GitHub 上で "verified" バッジも出したいなら**、同じ公開鍵を Settings > SSH and GPG keys へ **Signing Key** として登録する。**CI の検証は `.github/allowed_signers` だけを見る**ので、こちらは表示のためだけ。

### 7.2 ★★★実走は公開リポ `tacpendium` の開設後（**フェーズ5 冒頭**）

**★`combomgr` では `release.yml` の job がそもそも走らない**（`if: github.event.repository.private == false`）**。⇒ 開発リポへタグを打っても、スナップショット生成の契機として働くだけで、リリースは起きない。**

手順:

```bash
# (a) 公開スナップショットを生成し、tacpendium へ落とす（D-637 の一方向生成）
bash scripts/make-public-snapshot.sh --ref <開発リポで打ったタグ>
#     ⇒ 展開 → 許可リスト適用 → 検査 → 公開リポへ 1 コミット

# (b) ★公開リポ tacpendium 側で、署名付きの注釈タグを打つ
#     ★軽量タグは署名を持てず、段 1 の (2) で落ちる
git tag -s v0.0.1-rc1 -m 'M36-02 の実走確認'
#     リモートへ送る（★製造は tag も送信もできないため、ここは開発者の手番）
```

タグが公開リポへ入ると `Release` ワークフローが起動し、**プレリリースとして**公開される（`-rc` を含むタグは `--prerelease` になる）。

### 7.3 ★★★検証が通ることを確かめて、出力を返す

```bash
gh release download v0.0.1-rc1 --repo <owner>/tacpendium
gh attestation verify tacpendium-windows-amd64.zip   --repo <owner>/tacpendium
gh attestation verify tacpendium-darwin-arm64.tar.gz --repo <owner>/tacpendium
gh attestation verify tacpendium-linux-amd64.tar.gz  --repo <owner>/tacpendium
sha256sum -c tacpendium-linux-amd64.tar.gz.sha256
```

**★この出力が返って初めて、完了条件 §3 / §5 が満たされる**（§8 の停止時記録）。

### 7.4 ★確かめてほしい否定側（素通りしないこと）

**鍵を登録する*前に* rc タグを打つと、段 1 の (4) で落ちる**ことを 1 度見ておくと、素通りしないことが実測で残る。**⇒ 順序は「(a) 鍵を登録せずにタグを打って赤を見る → (b) 鍵を登録して打ち直して緑を見る」が最も証拠になる。**

**★ただし §7.1 を先に済ませる場合は、この否定側の確認ができなくなる。⇒ どちらを優先するかは開発者の判断。** 否定側を見たいなら、**公開リポの最初のスナップショットだけ `allowed_signers` を空のまま落とす**という手もある。

### 7.5 ★フェーズ5 冒頭の公開手順へ組み込むこと

**★本節は「公開リポジトリ開設と同じ手番」で消化されるべきものである。⇒ `followup` の `private-vuln-reporting-not-enabled`（public リポでも既定 off の opt-in）と同じバケツに入れること。** **★忘れると「仕組みは在るが一度も通していないまま公開する」形になる**——`M36-02` が一貫して避けてきた「在るが効くか確かめていない」そのものである。

---

## 8. ★停止規律 — 未解消のまま停止した項目（`CLAUDE.md` §9 / `D-838`）

**★★★`docs/handover/followup-backlog.md` は 1 文字も編集していない。** 以下は**設計伝達レポート §4 へ「§J 行の原稿」として載せる**。設計卓が受理の手番で §J へ転記する。

### 原稿 1

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `m36-02-attestation-verify-output-pending` |
| **発生元** | `M36-02` ／ 完了報告 `docs/progress/M36-02-completion-report.md` §0.2・§7 |
| **未解消の理由** | **attestation は Sigstore が実行中の GitHub Actions へ短命証明書を発行して初めて生まれる。⇒ 製造環境には原理的に存在しえない。** あわせて `gh` CLI が未インストールであり、`git tag` は `.claude/settings.json` の deny である。**★★★さらに【2026-09-20 追加】attestation は private / internal リポジトリでは取れない**（GHEC を除く）**。⇒ 本リポジトリ `combomgr` は非公開の開発リポであり、実走先は公開リポ `tacpendium` である**（§0.3）**。⇒ 「検証が通った出力」（完了条件 §3）は、公開リポ開設後にしか作れない。** 仕組みは実装済みで、ローカルで確かめられる範囲（門の破壊確認・射程 7 の破壊確認・アーカイブ内の門・YAML パース・全数テスト）はすべて緑。 |
| **再開に必要な条件** | **★★★公開リポジトリ `tacpendium` が開設されていること**（**⇒ フェーズ5 冒頭。`private-vuln-reporting-not-enabled` と同じ手番**）**。** そのうえで開発者が §7 を実施すること — (1) SSH 署名鍵を作り `.github/allowed_signers` へ公開鍵を登録（**★公開リポ開設を待たずに実施してよい**。台帳はスナップショットで運ばれる） (2) **公開リポ側で**署名付き注釈タグ（rc）を打つ (3) `gh attestation verify` を 3 本に対して実行し、出力を返す。**⇒ 返った出力を完了報告 §7.3 へ貼れば閉じる。** |
| **記録日・状態** | 2026-09-19 ／ **★2026-09-20 更新**（再開条件へ「公開リポ開設後」を追加） ／ **未解消（開発者の手番待ち）** |

### 原稿 2

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `dist-readme-binary-name-unlinked` |
| **発生元** | `M36-02` ／ 完了報告 §4.2 の申し送り |
| **未解消の理由** | **`RELEASE_TARGETS` の 2 列目（実行ファイル名）も `dist-readme.txt` へ写されている**（20〜22 行目・148 行目）**が、機械で結ばれていない。** 射程 7 は指示書が「**1 列目**」と明示しているため、**広げずに限界の節へ明記した**（指示書 §3 の「勝手に射程を広げない」）。**⇒ 次に実行ファイル名を動かすと、`check-dist-readme.sh` も `check-release-archive.sh` も気づかない。** `dist-readme-archive-name-unlinked` と**同じ型の残りである**。 |
| **再開に必要な条件** | 設計卓が射程として起票すること。**実装は既存の `check_archive_names` へ 2 列目を足すだけで、破壊確認も同じ形で置ける（数行）。** ただし既存の陽性対照が 20 行目を使っているため、対照の衝突を避ける配慮が要る。 |
| **記録日・状態** | 2026-09-19 ／ **未解消（設計卓の起票待ち）** |

### 原稿 3

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `m36-02-scope8-already-closed-by-m38-03` |
| **発生元** | `M36-02` ／ 完了報告 §0.1 |
| **未解消の理由** | **指示書 v1.1.0 §2.7b（射程 8）は既に実態が解決済みであった。** `images/.gitkeep` は `3bc5c71`（`M38-03`・開発者指示）で `SCREENSHOT-RULES.md` へ改名され、`RELEASE_MANUAL_EXCLUDE` は既にそれを除外している。**⇒ 存在しないファイル名を配列へ足すと死んだ設定になるため足さず、配布 3 本での不在を実測で示した。★これは製造の判断であり、開発者が覆せる。** |
| **再開に必要な条件** | **開発者の一言。** 「それでも `images/.gitkeep` を足せ」であれば 1 行で対応する。**⇒ 併せて、指示書が参照する followup 行 `release-manual-gitkeep-bundled` の状態欄を「`M38-03` で先に閉じた」へ更新する必要がある**（設計卓の手番）。 |
| **記録日・状態** | 2026-09-19 ／ **開発者の確認待ち** |

### 原稿 4

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `dist-readme-archive-name-check-one-way` |
| **発生元** | `M36-02` ／ レビュー `docs/progress/m36-02-review.md` 中-3 |
| **未解消の理由** | **射程 7 の照合は片方向である**——「`RELEASE_TARGETS` の名前が `README.txt` に現れるか」しか見ない。**⇒ 旧名が残ったまま新名も書かれている状態は緑になる。** 今回の破壊確認が通るのは、改名では旧名が消えるためである。**逆方向**（`README.txt` 側の `tacpendium-*.(zip\|tar.gz)` 形を拾い、`RELEASE_TARGETS` に無いものを警告する）を足せば閉じる。**⇒ 指示書の射程は「1 列目が全数現れる」であり、逆方向は射程外のため広げなかった**（指示書 §3）。 |
| **再開に必要な条件** | 設計卓が射程として起票すること。**実装は `check_archive_names` へ逆方向のループを足すだけ（数行）。** ★誤検出の恐れ（`README.txt` が正当に他の名前へ言及する場合）を検討してから入れること。 |
| **記録日・状態** | 2026-09-19 ／ **未解消（設計卓の起票待ち）** |

### 原稿 5

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `manual-image-gate-pr-timing-and-signer-namespaces` |
| **発生元** | `M36-02` ／ レビュー `docs/progress/m36-02-review.md` 低-6 |
| **未解消の理由** | **2 件の提案。いずれもレビュアーが「採否は設計卓の面」と明記している。** (a) **門を `pr-checks.yml` にも掛ける**——リリース時ではなく PR 時に図のリンク切れへ気づける。**★`make release-archives` を塞がないという §3-2 の制約には触れない**（門は独立スクリプトであるため）。ただし `pr-checks.yml` は現在 `scripts/check-*.sh` を 1 本も呼んでおらず、**CI の役割分担を変える判断になる**。(b) `.github/allowed_signers` の各行へ **`namespaces="git"`** を付ける——鍵の用途を git 署名へ限定できる。**★台帳にまだ 1 件も登録が無いため、書式の決定は鍵を作る手番（開発者）と同時が自然である。** |
| **再開に必要な条件** | (a) は設計卓が CI の役割分担として判断すること。(b) は**開発者が鍵を登録する手番**（完了報告 §7.1）で書式ごと決めること。 |
| **記録日・状態** | 2026-09-19 ／ **未解消（(a) 設計卓 ／ (b) 開発者）** |

---

## 9. ■ 併せて更新が要るもの（常設項目・教訓 `E-114` / `D-277` / `D-297`）

| # | 観点 | 実測・対応 |
|---|---|---|
| 1 | **消費した CHANGE 番号を registry へ登録したか** | **★該当なし。本サブは自採番しない**（`D-293`・指示書 §13）。**CHANGE 原稿は設計伝達レポート §1 と §6 へ書き、採番は設計卓が行う**（計測点 `M-183`）。**⇒ `change-number-registry.md` は 1 文字も編集していない。** |
| 2 | **その番号の写し先を全数直したか** | **★該当なし**（上に同じ。番号を払い出していない） |
| 3 | **消費したマイグレ連番** | **★0 本。`migrations/` を 1 バイトも触っていない**（完了条件・チェックリスト E-4） |
| 4 | **版を上げた文書の参照元** | **★該当なし。** 設計書本体（`docs/design/`）は 1 行も編集していない（`CLAUDE.md` §8 / チェックリスト E-3）。指示書・チェックリストの版も上げていない |
| 5 | **`CLAUDE.md` §8 の常設検査表** | **★更新した**（`479ab36`）。新設 `check-manual-images.sh` / `generate-release-notes.sh` に加え、**表に一度も載っていなかった `check-dist-readme.sh` も登録した** |
| 6 | **`followup-backlog.md`** | **★1 文字も編集していない**（`D-838`）。原稿は §8 と設計伝達レポート §4 へ |
| 7 | **`docs/usermanual/`** | **★1 バイトも編集していない**（`M38-03` の成果。指示書 §3-8） |
| 8 | **`scripts/release-targets.sh`** | **★構成を変えていない**（`CHANGE-213`・チェックリスト E-1）。`check-dist-readme.sh` が**読む**ようになっただけ |

---

## 10. レビュー結果と取り込み（Phase C）

| 欄 | 値 |
|---|---|
| レビュー報告書 | `docs/progress/m36-02-review.md` |
| 判定 | **条件付き合格** |
| 指摘件数 | **高 4 ／ 中 5 ／ 低 6**（計 15） |
| **★「高」指摘の不採用** | **0 件**（⇒ 開発者へのエスカレーションは発生していない） |
| 再レビュー往復の回数 | **0 回**（上限 2 回。初回レビューの指摘をすべて処理し、再レビューは要求していない） |
| 取り込みコミット | `b43d446` |

### 10.1 採否と理由（★全 15 件）

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|---|---|---|---|
| 高-1 | 高 | **「一次情報」でないものを一次情報として書いている**（タグ署名検証の出典が第三者の個人リポジトリの PR） | **★採用・是正済み** | **自分で実査して指摘が正しいことを確認した。** 出典を git 自身の `Documentation/config/gpg.adoc` へ差し替え、「空集合の罠」は公式の記述でないため格付けを「自前の推論」と明記。**`release.yml` 側も同時に直した**（コードに残ると後任が複製する）。経緯は §2.1b |
| 高-2 | 高 | **`generate-release-notes.sh` の自己検査が永久に回らない**（`check-artifact-integrity.sh` は `check-*.sh` しか走査しない） | **★採用・是正済み** | **実測で確認した**（同検査の 18 件に本ファイルが不在）。明示リストへ追加し、**18 件 → 19 件**になり `OK generate-release-notes.sh の自己検査が通る` が出ることを確認。**対照 6 件を書いて誰も回さない状態は、本サブが避けてきた「在るが効かない検査」そのものである** |
| 高-3 | 高 | attestation / タグ署名 / 公開の**実走が未了** | **採用（★開発者の手番）** | **製造の修正事項ではない**（`gh` 不在・`git tag` deny・Sigstore は実行中の Actions でしか証明書を出さない）。レビュアー自身も「規律違反とは扱わない」と明記。**⇒ §8 原稿 1 に必須 5 フィールドで記録済み。手順は §7** |
| 高-4 | 高 | `progress-log.md` の索引行と**設計伝達レポートが未了** | **★採用・実施** | Phase D で実施（本報告の後）。**`DES-002` §11.3 は「2 本立てとする」と明記しており、Release 新設で 3 本目になるため CHANGE 原稿が必須**——設計伝達レポート §1 / §6 へ書く |
| 中-1 | 中 | dry-run では署名検証 / attestation / 公開が走らないことが読み取れない | **★採用・是正済み** | `release.yml` の `workflow_dispatch` へ「dry-run が確かめないもの」を明記 |
| 中-2 | 中 | SBOM の母集団が配布物と違う／検証が `grep \| wc` のみ | **★採用・是正済み** | **母集団は変えず、選択の理由を書いた**——**配布物そのものは走査できない**（`embed_web` で npm 依存がバイナリへ埋まるため exe を見ても現れない）。代償＝「配布物より広い」側の誤差であり「入っているのに載らない」側ではない。**検証は `jq` へ**（packages 件数 ＋ 本体依存 `modernc.org/sqlite` の実名確認）。`grep \| wc` では JSON が壊れていても数えてしまう |
| 中-3 | 中 | 射程 7 の照合が**片方向**（旧名が残ったまま新名も在る状態は緑） | **不採用（★申し送り）** | **指摘は正しい。** ただし指示書の射程は「**1 列目が全数現れる**」であり、逆方向は射程外。**勝手に広げない**（指示書 §3）。⇒ **§8 原稿 4 として停止時記録へ回した**。レビュアー自身も「`M37` 着手と並行可」と位置づけている |
| 中-4 | 中 | **門は源泉だけを見てアーカイブの中を見ない**（2 検査を両方すり抜ける穴） | **★採用・是正済み** | **`D-890` の問い（「配布してよいか」）に直接答える指摘であり、最も価値が高い。** `release.yml` へ「組み上がったアーカイブを展開して同じ門を向ける」段を追加。**実測: 3 本とも緑。アーカイブ内から図を 1 枚どけると `EXIT=1`** |
| 中-5 | 中 | `extract_section` の終端 `/^■ /` ／ `src` 抽出の母集団 | **★採用・是正済み** | **どちらも「いまは緑だが将来静かに壊れる」型。** 終端は `^■` へ（**正本に `■方法 A` 形が 109 / 116 行に実在する**ことを自分で確認）。`src` 抽出は **img タグの中に限定**（`<script src=>` 等での誤検出を未然に） |
| 低-1 | 低 | `check-manual-images.sh:39` の `명시적` → `明示的` | **★対応済み** | **コミット前に修正済み**。実測で残存 0 件（レビュアーは修正前の版を読んだ可能性がある） |
| 低-2 | 低 | 完了報告 §3 の「新規 3 ファイル」→ 4 件 | **★採用・是正済み** | 単純な数え誤り。§3 を修正 |
| 低-3 | 低 | `victim_line` は行番号ではなく出現件数 | **★採用・是正済み** | `victim_hits` へ改名。**★改名で 1 箇所取り残し、`set -u` が `unbound variable` で即座に捕まえた**（自己検査 `EXIT=1`）。直して緑を確認 |
| 低-4 | 低 | `PRERELEASE` の裸展開を配列化 | **★採用・是正済み** | `EXTRA=()` ＋ `${EXTRA[@]+"${EXTRA[@]}"}` へ。単語分割・グロブ展開の事故を防ぐ |
| 低-4b | 低 | devContainer へ `shellcheck` を入れる価値 | **不採用（★射程外）** | **本サブの射程ではなく、開発環境の変更である**（`CLAUDE.md` §6 の依存追加にも触れる）。**⇒ 設計卓・開発者の判断事項。** 指摘の妥当性は認める（本サブは 714 行の新規シェルを足したが静的検査の経路が無い） |
| 低-5 | 低 | 全数テストの値が**キャッシュ込みか読み取れない** | **★採用・是正済み** | **レビュアーの実行では `ok` 60 件中 58 件が `(cached)` であった。** `-count=1` で取り直し、**`(cached)` 0 件**を確認。フロント／E2E は**取り込みコミットがプロダクトコードを 1 行も触っていない**ため再実行せず、その理由を §5.1 に明記 |
| 低-6 | 低 | 門を `pr-checks.yml` にも／`allowed_signers` に `namespaces="git"` | **不採用（★申し送り）** | **レビュアー自身が「採否は設計卓の面」と明記。** (a) は `pr-checks.yml` が現在 `check-*.sh` を 1 本も呼んでおらず CI の役割分担を変える判断。(b) は台帳に登録が 0 件のため**鍵を作る手番（開発者）と同時に決めるのが自然**。⇒ **§8 原稿 5 として停止時記録へ回した** |

### 10.1b ★★【2026-09-20 追補】開発者の裁定を受けた是正 3 件

**★レビューの指摘ではない。** 開発者から「**リポジトリ分割が確定している**」という前提を得て調べ直した結果、**製造の報告に事実誤りが 1 件見つかった**もの。

| # | 事項 | 対応 | 根拠 |
|---|---|---|---|
| 追-1 | **★実走先の誤り。** 初版 §7 は「`combomgr` に rc タグを打つ」と書いていたが、**attestation は private リポジトリでは取れない** | **★是正。** §7 を公開リポ `tacpendium` 前提へ書き直し、§0.3 に訂正の経緯を残した | `actions/attest` README（2026-09-20 実査） |
| 追-2 | **★タグ契機の衝突。** `combomgr` へのタグはスナップショット生成の正規の契機（`D-637`）だが、`ALLOW .github/**` により `release.yml` も両リポに存在し、生成のたび赤くなる | **★是正。** `release` job へ `if: github.event.repository.private == false`（コミット `92ae417`）。**fail-closed で書いた** | 開発者裁定（2026-09-20） |
| 追-3 | **射程 8（`images/.gitkeep`）を足すか** | **★足さない**（§0.1 の判断を開発者が追認） | 開発者裁定（2026-09-20） |

**★★追-2 の副次効果**——**「意図しない版が公開される」が構造的に起きなくなった。** 開発者の当初の懸念（逐語＝「誤って CI が動いてしまい、公開するつもりのなかったバージョンが公開されること」）は、**リポジトリ分割 ＋ 本ガードの二重で塞がれている。**

**★本追補ではコードを 1 行も触っていない**（`internal/` / `cmd/` / `web/src/` の差分 0）。**⇒ `go test` / `pnpm test` / `make e2e` は再実行していない。その理由をここに書く**（黙って古い値を残さない＝レビュー 低-5 と同じ型）。

### 10.2 ★レビュアーが独自に追認した事項

レビュアーは製造の主張を鵜呑みにせず、以下を自分で実査している。**⇒ いずれも製造の記述と一致した。**

- **射程 8 を「足さなかった」判断は妥当**（`.gitkeep` の不在・`3bc5c71` での改名・除外配列への反映・**配布 3 本を `tar -tzf` / `unzip -l` で実測し該当 0 件**）
- `nightly` / `pr-checks` / `release-targets.sh` の差分が **0 行**
- **`E-225` の deletions 点検**（新規 4 ファイルすべて deletions 0。`-4` は意図的な書き替え）
- 外部仕様 5 件の一次情報（**`actions/attest` 自身の CI が `artifact-metadata` を使っていないこと**を含む）
- **⇒ 高-1 の 1 点を除き、記述と実態は一致した。**

---

*以上、M36-02 完了報告。* **★§0 の 2 件（射程 8 の齟齬 ／ 実出力が出せない理由）と §7（開発者の手番）、§8（停止時記録 5 件）を最初に読むこと。**
