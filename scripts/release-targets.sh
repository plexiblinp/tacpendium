#!/usr/bin/env bash
# release-targets.sh — 配布アーカイブの構成の正本(定義のみ。単体では何もしない)
#
# 背景: 配布物の構成は `docs/design/02-architecture.md` §11.2 が定めるが、それを組む
#   仕組みはこれまで 1 つも存在しなかった(2026-09-12 開発者回答・D-851・followup
#   `release-packaging-does-not-exist`)。M36-01 がその最初の 1 本である。
#
# ★本ファイルが在る理由 —— 組み立て(build-release-archives.sh)と検査
#   (check-release-archive.sh)は、同じ「アーカイブ名 / 中の実行ファイル名 / 同梱物」を
#   知っていなければならない。**2 か所に書くと必ずドリフトする**(E-76)。
#   ⇒ 正本をここに 1 つだけ置き、両方が source する。
#
# 使い方: source scripts/release-targets.sh  (カレントはリポジトリルートを想定)

# ---------------------------------------------------------------------------
# 配布ターゲット: 「アーカイブ名 :: 中の実行ファイル名 :: 形式 :: dist/ 内のソース」
#
# ★★★macOS の名前は 3 つとも GOOS 名(darwin)で揃えてある(2026-09-17 開発者裁定 D-893・
#     M38-03。案 (a) = アーカイブ名を darwin 側へ寄せる)。
#     アーカイブ名 = tacpendium-darwin-arm64.tar.gz
#     中のバイナリ = tacpendium-darwin-arm64        ← Makefile:74 が出す名前のまま
#   ⇒ 命名規則は 1 つである —— Makefile が出す GOOS 名(windows / darwin / linux)を
#     アーカイブ名にもそのまま使う。
#
#   ★経緯: M36-01 の時点ではアーカイブ名だけが `macos`(DES-002 §11.2 のまま)で、
#     中のバイナリは `darwin` という非対称があった(D-887 で「揃えない」と裁定し可視化)。
#     揃える案は 2 つあり、(b)〔バイナリ名を macos へ〕は CHANGE-191 で固めた面と
#     windows_gui_link_test.go と nightly の 3 面に触るため、正本 1 行で済む (a) を採った。
#   ★★名前を変えるときはこの 1 行だけを直す。check-release-archive.sh の自己検査も
#     本配列から名前を引くため、2 か所目を書く必要は無い(E-76)。
# ---------------------------------------------------------------------------
RELEASE_TARGETS=(
  "tacpendium-windows-amd64.zip :: tacpendium-windows-amd64.exe :: zip :: dist/tacpendium-windows-amd64.exe"
  "tacpendium-darwin-arm64.tar.gz :: tacpendium-darwin-arm64 :: targz :: dist/tacpendium-darwin-arm64"
  "tacpendium-linux-amd64.tar.gz :: tacpendium-linux-amd64 :: targz :: dist/tacpendium-linux-amd64"
)

# 組み立ての出力先。★.gitignore の `/dist/` が既にカバーしている(成果物をコミットしない)。
RELEASE_OUT_DIR="dist/release"

# 同梱する README.txt。★これは生成物である(CHANGE-191)。正本は下の EXCLUDE 側に在る
#   docs/usermanual/dist-readme.txt であり、生成・照合は scripts/check-dist-readme.sh。
RELEASE_README="README.txt"

# 操作説明書。★**ディレクトリごと**同梱する。ファイルを 1 つずつ列挙しない(D-886)。
#   ⇒ M32-03 が同ディレクトリへクイックスタートを 1 本足すため、列挙すると着地で赤になる。
RELEASE_MANUAL_SRC="docs/usermanual"
RELEASE_MANUAL_DEST="manual"

# ★同梱しないもの: dist-readme.txt は README.txt の**正本**であり、説明書の中身ではない。
#   ⇒ 生成物のほうを README.txt として同梱するので、正本が manual/ へ入ると二重になる。
RELEASE_MANUAL_EXCLUDE=(
  "dist-readme.txt"
  # 撮影ルール(開発内部のメモ)。説明書の中身ではないので利用者向けアーカイブへ入れない。
  #   ★パスは manual/ からの相対。images/ ごと同梱する構成の中から、この 1 本だけを抜く。
  "images/SCREENSHOT-RULES.md"
)

# ---------------------------------------------------------------------------
# 検査が「在ること」を要求するもの。
#   ★★*あるべきものが在るか*で見る。*それしか無いか*では見ない(D-886)。
#   ⇒ ファイル数やファイル名の一覧で固定しないこと。説明書は今後も章が増減する。
# ---------------------------------------------------------------------------
RELEASE_REQUIRED_FILES=(
  "manual/tacpendium-readme.html"
)

# ★ディレクトリとして在れば足りるもの。**中身の枚数は見ない**(版ゲート 3b / D-886)。
#   ⇒ images/ の撮影は開発者の手番であり M36-01 の後である。画像 0 枚を不合格にしない。
RELEASE_REQUIRED_DIRS=(
  "manual/images"
)

# ---------------------------------------------------------------------------
# ★★★ライセンス関係ファイルの同梱 —— **全 7 件・パス保持**(2026-09-16 開発者判断)
#
#   着手時の既定は「入れない」であった(M36-01 指示書 §2.4 が判断を開発者へ上げる形に
#   していた)。**⇒ 判断が下りたので入れる。**
#
#   ★★★なぜ 7 件で 1 セットなのか —— **相互参照で噛み合っており、部分的に入れると
#     同梱した NOTICE の参照先が欠けるためである。**
#
#     NOTICE:4-6 の逐語:
#       「本ファイルは Tacpendium の配布物に付随する告知である。ライセンス本文は
#         `LICENSE`(アプリ本体＝AGPL-3.0-or-later)と `LICENSES/` 配下、パス単位の
#         割当は `REUSE.toml` を参照すること。データ層の説明は `DATA-LICENSE.md` にある。」
#       ⇒ NOTICE 自身が「配布物に付随する」と名乗り、4 つすべてを名指ししている。
#
#     DATA-LICENSE.md:22 —「パス単位の割当の正本は `REUSE.toml` である」。
#
#   ★★層 B(CC-BY-SA-4.0)のライセンス本文が要る実体がある —— embed_migrations.go の
#     `//go:embed migrations/*.sql` により、**ゲームデータのマイグレ 10 本
#     (`*_data_*.sql`。up 5 / down 5)が配布バイナリへ実際に埋め込まれる。**
#     ★★【2026-09-19・M33-03】20 本 → 10 本。⇒ M33-02 が旧 111 本を新系列 9 本へ潰した。
#       ★本スクリプトは migrations/ を読まないためテストは落ちない。⇒ 静かに古くなる型である。
#
#   ★★★パスは**保つ**。⇒ basename で平坦化しない。
#     理由は上の NOTICE の逐語が「**LICENSES/ 配下**」と書いていることである。
#     平坦化すると LICENSES/MIT.txt が MIT.txt として直下に落ち、参照先が消える。
#
#   ★LICENSE と LICENSES/AGPL-3.0-or-later.txt は **md5 一致で完全同一**である
#     (216109e2c1c3eaf57de2bfc18c11c9f8・34,020 B × 2)。**重複は承知のうえで入れる** ——
#     34KB は 12MB のアーカイブの 0.3% であり、**リポジトリと同じ形を保つ利益のほうが
#     大きい**(開発者判断)。REUSE の慣行でも LICENSES/ 配下に全本文が揃っている前提の
#     ツールがあり、欠けると REUSE.toml の宣言と実態がずれる。
#
#   ★★★減らすときの注意 —— **先に NOTICE の参照先が欠けないかを見ること。**
#     ⇒ 「重複しているから LICENSE を落とす」のような一見素直な削減が、
#       同梱した NOTICE を壊す。**法務の断定は開発者の手番である**
#       (roles-and-routing のハード列)。**⇒ 実装で減らさない。**
#
#   ★足す / 減らすのは本配列の 1 行である。**検査(check-release-archive.sh)も
#     同じ配列を見るため、変えた瞬間に検査が付いてくる。**
# ---------------------------------------------------------------------------
RELEASE_EXTRA_FILES=(
  # 層 A(アプリ本体・AGPL-3.0-or-later)
  "LICENSE"
  # 層 B(ゲームデータ・CC-BY-SA-4.0)の説明
  "DATA-LICENSE.md"
  # 告知(帰属・撤退ポリシー。★配布物に付随すると自ら名乗る)
  "NOTICE"
  # パス単位の割当の正本
  "REUSE.toml"
  # ライセンス本文(★LICENSES/ のディレクトリ名ごと保つ)
  "LICENSES/AGPL-3.0-or-later.txt"
  "LICENSES/CC-BY-SA-4.0.txt"
  "LICENSES/MIT.txt"
  # ★★2026-09-20(M40-01)追加。REUSE.toml (6-T2)が参照する独自識別子の本文である。
  #   ⇒ REUSE.toml は本配列で同梱されており、同梱しないと *配布物の中で宣言が宙に浮く*。
  #   ★対象ファイルそのもの(docs/seed-data/**)はアーカイブに入らない。入らないことを
  #     宣言するための本文であり、「配らない範囲がある」と読めることに意味がある。
  "LICENSES/LicenseRef-Tacpendium-NotForDistribution.txt"
)
