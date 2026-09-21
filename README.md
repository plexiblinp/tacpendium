# Tacpendium (SF6 Tactics Workbench)

ストリートファイター6(SF6)の戦術ワークベンチ。コンボ・セットプレイ・確定反撃を記録し、整理・比較・共有するための Web アプリケーション。

個人 OSS として開発中。バックエンドは Go(Echo + SQLite)、フロントエンドは React + TypeScript + Vite + Tailwind CSS。Go の `embed` で配布物は単一バイナリにまとまる予定。

> **本ファイルは開発者向けです**(ビルド・CI・リポジトリ構成)。
> **アプリの使い方・LAN 接続・トラブルシューティングは `README.txt`** を参照してください
> (リリース zip に同梱される配布版 README です)。
> **画面ごとの使い方は操作説明書 `docs/usermanual/tacpendium-readme.html`** にあります
> (画面ごとに 1 章、全 21 章)。

> **本アプリは「クラシック操作」を前提としている。** 技の入力表記とコンボのレシピは、
> すべてクラシック操作のコマンドで記録・表示される。**モダン操作の入力表記には対応していない**
> (`docs/human-notes/combmgr-prerelease-checklist.md` §3.2 = `B6`)。

## 必要環境

- Go 1.26.4 以上(devContainer / CI は 1.26.8)
- Node.js 20 以上(devContainer は 22)
- pnpm 9.13 以上(devContainer は corepack 経由で同梱)
- Linux / macOS / Windows(devContainer 推奨)

> パッケージマネージャは **pnpm** を使う(`web/package.json` の `packageManager` フィールドで `pnpm@9.13.0` を固定)。npm/yarn は使わないでください。

## クイックスタート(開発)

```bash
# 1) 依存取得
go mod tidy
cd web && pnpm install && cd ..

# 2) 設定ファイルを準備(任意。なければデフォルト値で起動)
cp config.toml.example config.toml

# 3) バックエンド起動(別ターミナル、ポート 47318)
make run-server

# 4) フロント開発サーバー起動(別ターミナル、ポート 5173)
make run-web

# 5) ブラウザで http://localhost:5173/health を開きヘルスチェック
```

## 主なコマンド

| コマンド | 内容 |
|---------|------|
| `make run-server` | バックエンドを `go run` で起動 |
| `make run-web` | フロント開発サーバーを Vite で起動 |
| `make build` | フロントビルド + Go バイナリビルド |
| `make test` | Go テスト + フロントテスト一括実行 |

## ビルド方法

### 本番ビルド（debug API なし）

```bash
go build -o tacpendium ./cmd/tacpendium
```

### 開発ビルド（debug API 有効）

```bash
go build -tags=debug -o tacpendium ./cmd/tacpendium
```

### 開発実行（debug API 有効）

```bash
go run -tags=debug ./cmd/tacpendium
# または
make run-server-debug
```

> **注意:** `debug` タグを付けてビルドした場合のみ `/api/debug/tables` および `/api/debug/dump/:table` が有効になる。本番ビルドではこれらのエンドポイントは存在しない(404)。

## 設定

`config.toml` をリポジトリルートに配置すると読み込まれる。存在しない場合はデフォルト値で動作する。サンプルは `config.toml.example` を参照。環境変数 `TACPENDIUM_LOG_LEVEL` でログレベルを上書きできる。

## CI

GitHub Actions を **目的の違う 2 本**で運用する(M24-09a / D-480)。1 本にまとめないのは、
PR ごとのフィードバックと 3 OS ビルドの健全性確認とで、求める速さも赤の意味も違うため。

| ワークフロー | ファイル | 起動 | 目的 | 必須 check |
|---|---|---|---|---|
| PR 高速検査 | `.github/workflows/pr-checks.yml` | PR ／ `main` への push ／ 手動 | `go vet` ・ `go build` ・ `go test -count=1` ・ Vitest を並列に回す | **する** |
| nightly | `.github/workflows/nightly-crossbuild.yml` | 毎日 18:00 UTC(翌 03:00 JST) ／ 手動 | job 2 本。**crossbuild** = Windows / macOS / Linux 向け `go build` が通ることを確認し成果物を artifact に残す ／ **e2e** = Playwright スイートを回す(**`main` の E2E が緑かを観測する唯一の経路**。M24-09d) | **しない** |

### 受入条件

- **time-to-green 10 分以内**(DORA の推奨上限)。
- **5 分は目標に置かない。** 事前計測で `go test` 単体が 2 コア相当 245.6 秒・4 コアで 142 秒であり、
  5 分は最初から未達と分かっている。達成できない数字を受入条件に置くと、以後の判断が
  「未達のまま」で固定される。短縮の余地は `internal/infra/migration` の内訳が分かってから議論する。

### 必須 check として扱う範囲

**PR 高速検査だけを必須にする。** nightly は必須にしない。
nightly が赤いとき、壊れているのは当該 PR ではない場合がある(クロスビルド、あるいは
別の PR が入れた E2E の回帰)。必須にすると無関係な PR が止まる。
**nightly の赤は通知として扱い、`followup-backlog` へ 1 行足す。**

### 全 job を毎 PR 回すことについて（`paths` フィルタを入れない判断）

このリポジトリは docs の変更比率が高く（直近 20 コミット中 16 本が `docs:`）、
docs だけの PR でも `go test` と Vitest が回る。分数の無駄ではある。
それでも `paths` / `paths-ignore` を入れていないのは、**フィルタで skip された job は
必須 check として「pending のまま」になり、PR がマージできなくなる**ため。
フィルタを掛けない薄い job で必須 check の受け皿を作る形が要るが、それは必須 check を
実際に登録してから決めるべきで、未登録のいま入れると壊れ方だけが増える。
**⇒ 必須 check を登録したあとに再検討する。** 各 job には `timeout-minutes` を置いてあるので、
ハングによる分数の垂れ流しは起きない。

### 赤いときの扱い

**1. まず「本当に実行されたか」を見る。**
`go test` job の所要が数秒なら、テストは実行されていない。`-count=1` が外れると Go の
結果キャッシュが効き、**exit 0 のまま「実行せず緑」**になる(実測: `-count=1` 付き 142.2 秒 ／
外すと 0.385 秒・53/53 が `(cached)`・**どちらも exit 0**)。終了コードでは区別できない。

**2. 再実行してよい条件は次の 3 つだけ。**

- テスト本体に入る前に落ちた場合(checkout / setup-go / setup-node / `pnpm install` の失敗)。
- 同一コミットで一度緑になった実績がある場合。
- ランナー自体が消えた場合。

**上記のいずれでもない赤は、再実行せず原因を追うこと。**

**3. ★「flaky だから再実行」を既定にしない。**
事前計測(`docs/progress/20260810-ci-baseline-measurement.md` §1.3)では全検査が 3 回とも
exit 0 で、**flaky を理由に CI 非搭載とした検査は 1 件も無い(非搭載一覧は空)**。
⇒ **現時点で「flaky だから」という説明は成り立たない。** 赤が出たら、それは新しい情報である。

**4. ★ただし「3 回緑」は「flaky でない」の証明ではない。**
同計測 §5-5 が自ら記録しているとおり、3 回の実行は flaky 検出としては弱い。
上の 3 と 4 は矛盾しない —— **「flaky を再実行の言い訳にしない」ことと、「flaky が無いと断定しない」
ことは両立する。** 実際に flaky が観測されたら、再実行で流さず記録して恒久対策へ回す。

**5. 赤いまま進めてよい場合。**
nightly の赤(必須ではない)と、変更と無関係だと**根拠を示して**説明できる赤に限る。
その場合も `followup-backlog` へ 1 行残し、赤を放置しない。

### nightly の成果物(macOS / Linux の実機起動確認)

macOS・Linux は非公式対応であり、**ビルドが通ることまでを CI が見て、実際に起動するかは人が見る**
(DES-002 §11.1)。実機確認の手順は次のとおり。

1. Actions → **Nightly** → 最新の成功した実行を開く(job は `cross-build (windows / macos / linux)`)。
2. ページ下部の Artifacts から **`tacpendium-crossbuild`** を落とす（zip。保存期間はワークフローの
   `retention-days` が正本）。
3. 中身は 3 点。
   - `tacpendium-windows-amd64.exe` (公式サポート)
   - `tacpendium-darwin-arm64` (非公式・Apple Silicon)
   - `tacpendium-linux-amd64` (非公式)
4. 対象 OS で起動し（macOS / Linux 版は先に `chmod +x` が要る。Windows の `.exe` は不要）、
   **ブラウザが自動で開き、コンボ一覧が表示される**ことを確認する。
   ここまで確認できれば、その OS 向けバイナリは「起動する」と言ってよい。
5. 結果は `followup-backlog` §F へ記録する(CI は起動可否を判定していない)。

なお 3 OS 分はいずれも **ubuntu ランナー 1 台からのクロスコンパイル**で生成している
(`modernc.org/sqlite` が純 Go で CGO 不要)。macOS / Windows ランナーを使わないのは、
private リポジトリでは実行時間が macOS 10 倍・Windows 2 倍で課金されるため。

### 受入確認の手順（初回は 2026-08-22 に完了）

> **★順序に注意。** `workflow_dispatch`（手動起動）は既定ブランチに在るファイルしか
> Actions UI に現れないため、**新しいワークフローを足したときは先に `main` へマージする**。

1. **緑を確認する。** PR を 1 本開く（`pull_request` トリガ。マージ後なら手動起動でもよい）。
   3 job すべてが緑になること、job summary の所要秒の最大が 10 分以内であることを確認する。
   **あわせて `go test` job の summary の「(cached) パッケージ」が 0 であることを見る**
   —— 0 でなければ `-count=1` が効いていない。
2. **赤になることを確認する。** 一時ファイル `internal/citest_temp_test.go` を新規に置いて push し、
   `go test` job だけが赤になることを確認する。`internal/` 直下は `.go` を持たないため
   **package 宣言が要る**。

   ```go
   package internal

   import "testing"

   func TestCIRedCheck(t *testing.T) { t.Fatal("intentional failure: CI red check") }
   ```

   この形なら `go build ./...` と `go vet ./...` は緑のまま `go test` だけが赤になる（実測確認済み）。
   **確認したらファイルごと削除し、痕跡を残さない**(既存のテストファイルは書き換えないこと)。
   これは「緑になった」と「検査が働いている」を分ける唯一の根拠である。
3. **nightly を手動起動する。** `workflow_dispatch` で 1 回走らせ、artifact に 3 点が残ることと、
   job summary の `file(1)` 出力が PE32+ / Mach-O arm64 / ELF x86-64 になっていることを確認する。
4. **必須 check を登録する。** `main` の branch protection で
   **`go vet + go build` ／ `go test` ／ `web test (Vitest)`** の 3 つを必須 check にする。
   **登録名は job の表示名（`name:` の値）である**（`go-vet-build` のような job ID ではない）。
   nightly は登録しない。
5. 1〜4 が済んだら、両ワークフロー冒頭の `★★ 未検証 ★★` ブロックと
   上の表の「（予定・branch protection 未設定）」を削除し、
   job summary の実測値を `docs/progress/progress-log.md` へ追記する。

## ドキュメント

- 設計書: `docs/design/`
- マイルストーン別指示書: `docs/instructions/`
- Claude Code 向け指針: `CLAUDE.md`
- データについて: `DATA-LICENSE.md` / 告知: `NOTICE`
- 脆弱性の報告: `SECURITY.md` / サポート方針: `SUPPORT.md` / 貢献: `CONTRIBUTING.md`

### 利用者向けの文書と `README` 系の役割分担

名前の似たファイルが 4 つあるため、どれが何の正本かをここに示す。

| ファイル | 読み手 | 内容 | 正本か |
|---|---|---|---|
| `README.md`(本ファイル) | 開発者・貢献者 | ビルド・CI・リポジトリ構成・ライセンス | **正本** |
| `README.txt` | 配布物の利用者 | 起動方法・LAN 接続・トラブルシューティング・データの保存場所 | **生成物**(下記の正本から作る) |
| `docs/usermanual/dist-readme.txt` | — | 上の `README.txt` の**正本** | **正本** |
| `docs/usermanual/tacpendium-readme.html` | 利用者 | **操作説明書**(画面ごとの使い方。全 21 章)。スクリーンショットは `images/` に配置済み(M38-03。撮影は開発者の手番) | **正本** |

`README.txt` は配布 zip の必須成果物であるためルートから動かせない(`DES-002` §11.2 /
`.github/workflows/nightly-crossbuild.yml` / `cmd/tacpendium/main.go` の LAN 起動バナー)。
一方でリポジトリ上の正本は操作説明書と同じ場所に置く。両者のずれは検査で捕まえる。

```bash
bash scripts/check-dist-readme.sh           # 照合(既定)。README.txt が正本と一致するか
bash scripts/check-dist-readme.sh --write   # 正本から README.txt を作り直す
```

## ライセンス

**三層構成**である。パス単位の割当の正本は `REUSE.toml`、本文は `LICENSES/` にある。

| 層 | 対象 | ライセンス |
|---|---|---|
| A. アプリ本体 | Go / React のコード、スキーマ、アプリの設計物 | `AGPL-3.0-or-later` |
| B. ゲームデータ | 技・フレームデータ・コマンド・派生関係(`character_data/` と該当マイグレーション) | `CC-BY-SA-4.0` |
| C. 開発運用の文書・道具 | AI 運用ルール群、`scripts/`、開発の引継ぎ資料 | `MIT` |

**三層は「何の内容か」で切る軸である。** これと直交する軸として、**「誰の著作物か(来歴)」**
を `REUSE.toml` の (6) に置いてある。第三者が著作権者であるファイルは、層の割当より先に
来歴で宣言する。同梱して再配布するもの(`web/src/components/ui/` の shadcn/ui 由来。
帰属は `NOTICE` §6)と、リポジトリに在るが配布しないもの
(`LicenseRef-Tacpendium-NotForDistribution`)の 2 種別がある。

**利用者が登録したデータ(コンボ・セットプレイ・タグ・メモ)は上記のいずれにも含まれない。
利用者本人のものであり、本ソフトウェアは一切の権利を主張しない**(`DATA-LICENSE.md` §0)。

> **本アプリは LAN 内での利用を前提としている。インターネットへ直接公開しないこと**
> (`SECURITY.md` §1)。

検査:

```bash
bash scripts/check-migration-license.sh       # migrations/ の割当に漏れが無いか
bash scripts/check-public-snapshot.sh         # 公開スナップショットの許可リストの網羅
bash scripts/check-third-party-attribution.sh # 来歴の軸の宣言と NOTICE の帰属が実態と合うか
```
