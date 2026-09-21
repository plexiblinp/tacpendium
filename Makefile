.PHONY: run-server run-server-debug run-web build build-debug build-windows build-darwin build-linux build-all check-windows test test-go test-go-debug test-web e2e e2e-only tidy ensure-web-deps release-archives

# ensure-web-deps: 起動前提の 3 件目を吸収する(2026-08-19 改善レーン IMPROVE-01)。
#
#   web/node_modules —— **不在だと pnpm を呼ぶターゲットがすべて落ちる。**
#     e2e は `cd web && pnpm e2e` が @playwright/test を解決できずに
#     `ERR_MODULE_NOT_FOUND` で落ち、test-web は vitest が、build 系と run-web は
#     vite が同様に落ちる。⇒ 前提として付けた先は次の 8 つ:
#       run-web / build / build-debug / build-windows / build-darwin / build-linux
#       / test-web / e2e
#     (go しか使わない run-server / test-go / tidy には付けていない)
#     node_modules は .gitignore 対象でクローンに含まれないため、**クリーンな clone では必ず踏む**
#     (M22-03 / M22-05 / M22-06 / M22-08 の 4 サブ連続で踏んだ = D-433)。
#     ★踏むと「自分の変更が壊した」ように見え、切り分け時間の大半がそこへ消える——
#     上の config.toml と PW_EXECUTABLE_PATH の 2 件とまったく同じ型であり、3 件目として同じ流儀で潰す。
#
#   ★**既存の node_modules は触らない。** 不在のときだけ install する(冪等)。
#   ★**--frozen-lockfile を使う。** pnpm-lock.yaml に差分を出さないため
#     (改善レーンは依存を 1 バイトも動かさない = IMPROVE-01 §2.2-4)。
#
#   ★.claude/hooks/session-start.sh も同じ 3 件を揃えるが、**あちらはセッション起動時にしか走らない。**
#     ⇒ セッション中に node_modules を消した場合や、Claude Code を介さない素の端末から
#     make を打つ場合は本ターゲットだけが効く。両方あって初めて「人手の前準備なし」が成立する。
ensure-web-deps:
	@if [ ! -d web/node_modules ]; then \
		echo "web/node_modules がありません。pnpm install を実行します..."; \
		cd web && pnpm install --frozen-lockfile; \
	fi

run-server:
	go run ./cmd/tacpendium

run-web: ensure-web-deps
	cd web && pnpm dev

# build: M7-06 配布構成。フロント(web/dist)を embed した単一バイナリを生成する。
# -tags=embed_web により embed_web_release.go(//go:embed all:web/dist)が有効になる。
# dev/test はタグなし(embed_web_stub.go)で web/dist 不要。
build: ensure-web-deps
	cd web && pnpm build
	go build -tags=embed_web -o tacpendium ./cmd/tacpendium

# クロスビルド(DES-002 §11.1/§11.2)。Windows は公式対応、macOS/Linux は非公式
# (本タスクではビルド成立確認まで)。いずれも embed 済み単一バイナリを出力する。
# CGO 不要(modernc.org/sqlite = 純 Go)なのでクロスコンパイルが成立する。
# WINDOWS_GUI_LDFLAGS: 黒いコンソール窓を出さないためのリンク指定(M34-02 段 5)。
#
# ★★-H=windowsgui は「窓を出さない」ではなく「GUI サブシステムとしてリンクする」で
#   ある(M34-overview §4.1)。⇒ 標準出力・標準エラーの接続先が無くなる。
#   前提として段 1(ログと config.toml の基準を一意にする)と
#   段 4(失敗時の MessageBox)が要る。★どちらも本フラグより前に入れてある。
#
# ★★変数にしてあるのは正本を 1 か所に持つためである ——
#   cmd/tacpendium/windows_gui_link_test.go が本行を読み、その指定で実際にリンクした
#   exe の PE ヘッダのサブシステム値を見る。★同テストはフラグ無しでリンクすると
#   CUI(3)になることまで測る(陽性対照)。
#
# ★★同テストが赤くなるのは次の 3 つである(レビュー指摘 高-4 で範囲を是正した)。
#   (1) 本変数の行を消した / 値を空にした
#   (2) 値から -H=windowsgui を落とした
#   (3) ★下の build-windows レシピが $(WINDOWS_GUI_LDFLAGS) / -ldflags= を渡さなくなった
#   ⇒ (3) を見ていなかった間は、レシピから -ldflags= だけを落とすと配布 exe が CUI へ
#     戻るのにテストは緑だった。**門が成果物から 1 段離れていた。**
#
# ★本フラグを他のターゲットへ広げないこと。Linux / macOS のリンカは解釈しない。
WINDOWS_GUI_LDFLAGS := -H=windowsgui

build-windows: ensure-web-deps
	cd web && pnpm build
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags=embed_web -ldflags="$(WINDOWS_GUI_LDFLAGS)" -o dist/tacpendium-windows-amd64.exe ./cmd/tacpendium

build-darwin: ensure-web-deps
	cd web && pnpm build
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -tags=embed_web -o dist/tacpendium-darwin-arm64 ./cmd/tacpendium

build-linux: ensure-web-deps
	cd web && pnpm build
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -tags=embed_web -o dist/tacpendium-linux-amd64 ./cmd/tacpendium

build-all: build-windows build-darwin build-linux

# release-archives: DES-002 §11.2 の配布物を 3 OS ぶん組む(M36-01・射程 1 + 2)。
#
# ★これが「無いものを作る」1 本目である —— 配布物(zip / tar.gz)を組む仕組みは
#   2026-09-12 の実査時点でリポジトリに 1 つも存在しなかった(D-851)。§11.2 が定める
#   構成は、それまで一度も実体になっていない。
#
# ★★構成の正本は scripts/release-targets.sh である(アーカイブ名 / 中の実行ファイル名 /
#   同梱物)。**Makefile 側へ名前を書かないこと** —— 組み立てと検査の 2 か所が同じ表を
#   見る形にしてあり、ここへ写すと 3 か所目になる(E-76)。
#
# ★★★build-all を前提に置いてあるのは、**1 コマンドで 3 OS ぶんが出ること**が完了条件
#   だからである(指示書 §6-1)。⇒ OS ごとに手順が割れると、割れた側が必ず古くなる。
#   スクリプト単体(bash scripts/build-release-archives.sh)は dist/ の既存バイナリから
#   組むので、ビルドし直したくないときはそちらを直接叩けばよい。
#
# ★nightly(.github/workflows/nightly-crossbuild.yml)は 1 バイトも触らない ——
#   CI の artifact は配布物ではない(CHANGE-129)。契機が違う(定時 / タグ)。
#   ⇒ CI からリリースを打つのは M36-02 の射程である。本ターゲットは
#     「コマンド 1 本で組める」ところまでを担い、CI から呼べる形にしてある。
release-archives: build-all
	bash scripts/build-release-archives.sh

# check-windows: Windows 専用コードが「コンパイルできること」だけを機械で確かめる(M34-01)。
#
# ★これが要る理由 —— 開発は Linux の devContainer で行い、PR CI も Linux でしか
#   go build / go vet / go test を回さない。⇒ `//go:build windows` の付いた
#   ファイルは、放っておくと **誰も 1 度もコンパイルしないまま main へ入る。**
#   タグの掛け違い・API の打ち間違いは Linux 側では何も言わない(そのファイルが
#   最初から存在しないのと同じに見える)。
#
# ★nightly-crossbuild.yml の make build-all でも同じ誤りは捕まるが、最大 1 日遅れる
#   うえ pnpm build を伴って重い。本ターゲットはフロントを要求しないので数秒で済む。
#
# ★amd64 に固定してある —— internal/desktop/tray_sizes_windows_amd64.go の
#   構造体サイズガード(976 / 80 / 48)は amd64 のレイアウトを前提にしており、
#   ファイル名制約で amd64 のときだけコンパイルされる。GOARCH を変えると
#   ガードが素通りし、本ターゲットの意味が半分になる。
#
# ★embed_web タグは付けない —— 付けると //go:embed all:web/dist が web/dist を
#   要求する(pr-checks.yml の go build と同じ理由)。埋め込み済み成果物の生成は
#   nightly-crossbuild.yml の担当。
check-windows:
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build ./...
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go vet ./...
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -tags=debug ./...

test: test-go test-web

test-go:
	go test ./...

test-web: ensure-web-deps
	cd web && pnpm test -- --run

run-server-debug:
	go run -tags=debug ./cmd/tacpendium

build-debug: ensure-web-deps
	cd web && pnpm run build
	go build -tags=debug -o tacpendium ./cmd/tacpendium

test-go-debug:
	go test -tags=debug ./...

# e2e: 起動前提を 2 つ吸収する。
#   (1) は本節の下に書いてある(2026-08-15 改善レーン 第 1 束)。
#   (2) web/node_modules の不在は前提ターゲット ensure-web-deps が吸収する
#       (2026-08-19 改善レーン IMPROVE-01。詳細は同ターゲットの注記)。
#
# ★★config.toml については、本ターゲットは何もしなくなった(M24-09c 追補 / CHANGE-135)。
#   E2E は専用の設定ファイル web/e2e/.tmp/tacpendium-e2e.toml を読む
#   (web/playwright.config.ts が TACPENDIUM_CONFIG_PATH で渡す)。使い捨て DB と同じ .tmp 配下で、
#   起動のたびに config.toml.example から作り直される。
#
#   ⇒ 以前ここに在った「不在だと全 spec が落ちるので生成する」処理は不要になった。
#     isInitialized は専用 config の存在で満たされる。
#
#   ★★これで dev の config.toml との依存が両方向とも切れた:
#     - dev → E2E: 開発者が設定画面で既定キャラを変えると、その値が段 3b として E2E の画面に
#       効いていた。E2E は test ごとに新規ブラウザコンテキストを使うため段 1(URL)と
#       段 2(session)が空になり、段 3b が単独で決めるためである。
#       ⇒ 開発者ローカルで既定キャラが juri だったとき 35 件がまとめて落ちた(実測)。
#     - E2E → dev: E2E スイート自身が PUT /api/config を踏んで config.toml を再シリアライズし、
#       コメントを落としていた。⇒ 書き込み先が .tmp 側になったので dev は汚れない。
#
#   ★web/playwright.config.ts の readDevBackendPort() は、これまでどおり dev の config.toml を
#     読む。これは worktree のポートオフセットを決めるためであり(「どの worktree に居るか」は
#     dev の config.toml にしか無い情報である)、バックエンドのポートは TACPENDIUM_PORT で
#     明示的に渡すので両者がずれることはない。★読み先を専用 config へ移すと、
#     scripts/wt-new.sh が作る worktree ごとのポート分離が壊れる。
#
# ★★フロントの配信は vite preview である(M24-09c 追補 段 3 / D-569)。
#   web/playwright.config.ts の webServer[1] が `pnpm build && pnpm exec vite preview` を持つ。
#   ⇒ **ビルドを本 Makefile 側へ移さないこと。** ここに置くと `cd web && pnpm e2e` を直接叩いた
#     経路が古い web/dist を検査してしまい、しかも**緑で通るため気づけない**。
#     どの経路から E2E スタックを起こしても必ず再ビルドされる形を保つ。
#
# (1) PW_EXECUTABLE_PATH —— クラウド実行環境では `playwright install` が
#     cdn.playwright.dev の 403(host not permitted)で失敗するため、プリインストールの
#     Chromium を指す必要がある。環境変数が既にあればそれを尊重し(?=)、無いときだけ
#     既知の同梱パスが**実在する場合に限り**採用する($(wildcard))。
#     ⇒ 3 つの環境がいずれも従来どおりに動く:
#       - クラウド実行環境: 環境変数が無く同梱パスが実在する ⇒ 自動採用(本項の目的)
#       - devContainer: .devcontainer/devcontainer.json が PW_EXECUTABLE_PATH=/usr/bin/chromium を
#         **設定済み**のため、?= がそれを尊重する(自動採用の分岐へは入らない)
#       - 上記いずれでもない環境: 変数が空のまま `playwright install chromium` へ落ちる
#     **いずれも挙動不変。** playwright.config.ts は process.env を読むため export が要る。
PW_PREINSTALLED_CHROMIUM := /opt/pw-browsers/chromium

# ★★E2E の起動前提は「1 か所」に持つ(M24-09d / D-599)。
#   e2e と e2e-only は同じ環境変数・同じ Chromium 解決を通らなければならない。
#   ⇒ 環境変数の export はターゲット一覧 E2E_TARGETS に対して 1 度だけ書き、
#     Chromium の解決も変数 ENSURE_PW_CHROMIUM に 1 度だけ書いて両方から参照する。
#   ★2 か所に書くと必ずドリフトする(E-76)。**新しい E2E ターゲットを足すときは
#     E2E_TARGETS へ名前を足すこと。** レシピ側へ export を書き足さない。
E2E_TARGETS := e2e e2e-only
$(E2E_TARGETS): export PW_EXECUTABLE_PATH ?= $(wildcard $(PW_PREINSTALLED_CHROMIUM))

# ENSURE_PW_CHROMIUM は「変数定義の中の行継続」であり、展開時には 1 行になる
# (make は バックスラッシュ + 改行 + 先頭空白 を空白 1 個へ畳む)。
# ⇒ レシピ行 1 本として安全に使える。define を使うと複数行のまま展開され、
#   2 行目以降がレシピ行として扱われないため採らない。
ENSURE_PW_CHROMIUM = \
	if [ -n "$$PW_EXECUTABLE_PATH" ]; then \
		test -x "$$PW_EXECUTABLE_PATH" || { \
			echo "PW_EXECUTABLE_PATH is not executable: $$PW_EXECUTABLE_PATH" >&2; \
			exit 1; \
		}; \
		echo "Using preinstalled Chromium: $$PW_EXECUTABLE_PATH"; \
	else \
		cd web && pnpm exec playwright install chromium; \
	fi

e2e: ensure-web-deps
	@$(ENSURE_PW_CHROMIUM)
	cd web && pnpm e2e

# e2e-only: E2E の絞り込み実行(M24-09d / D-599)。
#
# ★★出所 —— `make e2e` を経由せず `cd web && pnpm exec playwright test <pattern>` を
#   直接叩くと PW_EXECUTABLE_PATH が渡らず、UI を使う spec が
#   `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-...` で全滅する。
#   **全数実行のときは Makefile が変数を設定するため起きず、絞り込みのときだけ落ちる。**
#   ⇒ M24-13 の製造が実際に踏み、1 回ぶんの実行を捨てた
#     (followup `playwright-narrow-run-env-trap`)。
#
# ★★注記を文書へ足すのではなくターゲットを足したのは、**機械で強制できるものを
#   文書へ書かない**という本プロジェクトの一貫した姿勢と同じ形だからである
#   (.claude/settings.json の deny・各 check スクリプト)。
#
# 使い方: make e2e-only P=<playwright へそのまま渡す引数>
#   例) make e2e-only P=combo-crud
#       make e2e-only P="m24-13 -g 保存"
#       make e2e-only P="--repeat-each=3 aa-interference-probe-a"
#
# ★P を省略すると全数実行になってしまい「絞ったつもりで絞れていない」状態を作るため、
#   空のときは使い方を出して落とす。
e2e-only: ensure-web-deps
	@if [ -z "$(P)" ]; then \
		echo 'usage: make e2e-only P=<playwright へ渡す引数>' >&2; \
		echo '  例: make e2e-only P=combo-crud' >&2; \
		echo '      make e2e-only P="m24-13 -g 保存"' >&2; \
		exit 1; \
	fi
	@$(ENSURE_PW_CHROMIUM)
	cd web && pnpm e2e $(P)

tidy:
	go mod tidy
