# CHANGE-173 設計変更通知書: `internal/desktop/` の新設と Windows 側のビルド検査（`M34-01`）

| 項目 | 内容 |
|------|------|
| 文書ID | CHANGE-173 |
| バージョン | **1.0.0**（2026-09-09） |
| 起票日 | 2026-09-09 |
| 起票者 | 設計担当 Claude（設計卓／フェーズ4 期） |
| 由来 | **`M34-01`**（実査と移植と OS 分離）**の設計伝達レポート §1-1 / §6** |
| 対象設計書 | **`SUPP-001`** §5.2（Go パッケージ構成）／ **`SUPP-001`** のビルド規約 |
| 状態 | **★★起票と同時に反映する**（`D-795`） |
| マイグレ消費 | **0 本** |
| 新規依存 | **0 件**（`go.mod` / `go.sum` の差分 0 行を実測） |

---

## 0. ★★本書が要る理由

**★★`internal/desktop/` は `internal/` の既存 5 層**（`api` / `service` / `repository` / `model` / `infra`）**のどれでもない新しい面である。⇒ 構成図に無い面が増えると、次の担当が「どこへ置くか」を毎回考え直す。**

**★先例＝`internal/recipehash/` を §5.2 へ足した `CHANGE-132`。**

**★★あわせて本リポジトリで初めての `GOOS` ファイル名制約が入った。⇒ 着手前は `*_windows.go` が 0 件であり、OS 分岐はすべて `runtime.GOOS` の実行時 switch だった。**

---

## 1. ★★`internal/desktop/`（**`SUPP-001` §5.2 へ追記**）

### 1.1 位置づけ

**★デスクトップ統合。⇒ Windows 専用実装 ＋ 他 OS スタブ。★HTTP も DB も触らない。**

### 1.2 ★★公開 API（**逐語**）

| 種別 | シンボル | 意味 |
|---|---|---|
| 型 | `TrayMenu{ Title, Tooltip string; Items []TrayItem }` | 通知領域アイコンと右クリックメニューの記述 |
| 型 | `TrayItem{ Label string; OnClick func(); Default bool }` | メニュー 1 項目。**`Default` は左ダブルクリックでも走る項目** |
| 変数 | `ErrUnsupported` | **非 Windows で `RunTray` が返す。★呼び手は「トレイ無しで動作を続ける」と扱う契約であり、致命エラーにしない** |
| 関数 | `RunTray(TrayMenu) error` | **メッセージループに入る**（ブロックする） |
| 関数 | `StopTray()` | 上記を終わらせ、アイコンを削除する |
| 関数 | `OpenURL(string) error` | 既定ブラウザで開く。**`ValidateURL` を内部で通す** |
| 関数 | `OpenFolder(string) error` | ファイルマネージャで開く。**開く前に `os.Stat` する**（**起動して待たないため、不正パスが無言で失敗するのを防ぐ**） |
| 関数 | `ValidateURL(string) error` | **http/https 以外とホスト無しを拒む。⇒ 設定由来の文字列が任意のプロトコル起動に化けるのを防ぐ** |
| 関数 | `Alert(title, text string)` | Windows は `MessageBoxW`、他 OS は stderr |
| 関数 | `Confirm(title, text string) bool` | Windows は `MessageBoxW`（YesNo）、**他 OS は常に false** |

### 1.3 ★★持たせなかったもの（**読む側が誤読しないために書く**）

**★バルーン通知 ／ アイコンのアニメーション ／ 二重起動判別 ／ スタートアップ登録 ／ Windows サービス化は、いずれも無い。**

**★二重起動の判別は `M34-02` の射程である。**

### 1.4 ★★ビルド制約の形

| ファイル | 制約 |
|---|---|
| `desktop.go` / `desktop_test.go` | **無し**（全 GOOS。**純粋関数のみを置き、Linux でテストできる形にした**） |
| `desktop_windows.go` / `tray_windows.go` | `//go:build windows` |
| `desktop_other.go` | `//go:build !windows` |
| `tray_sizes_windows_amd64.go` | **ファイル名制約**（windows かつ amd64）**。構造体サイズのコンパイル時ガード** |

---

## 2. ★★`cmd/genicon/`（**`SUPP-001` §5.2 へ追記**）

**★アイコン生成器。開発時のみ使う。⇒ 配布物の挙動には関わらない。**

### 2.1 ★★★`scripts/` ではなく `cmd/` に置いた理由（**ライセンス**）

**★移植元は `scripts/genicon/` に置いていた。⇒ しかし `REUSE.toml` の層 C は `scripts/**` を含む。**

**★★そのまま置くと移植物が `MIT` になり、層 A**（`AGPL-3.0-or-later`）**であるべきものが崩れる。**

**⇒ `cmd/**` は層 C のどの列にも当たらず、既定の `path = "**"` にのみ一致する。★したがって層 A に落ちる。**

**★★`REUSE.toml` は 1 行も変えていない**（`M34-overview` §3.2.3 の要求どおり。**実測＝差分 0 行**）**。**

**★★★恒久の規約＝移植物の置き場を決めるときは `REUSE.toml` の層を先に見ること。⇒ `scripts/` は層 C である。★`M34-02` が `scripts/build-windows.ps1` を移植するときに同じ判断が要る。**

---

## 3. ★★`cmd/seedgen/` も未記載だった（**同じ手番で拾う**）

**★§5.2 の `cmd/` には `tacpendium` しか載っていない。⇒ `seedgen` は実在するのに構成図に無い。**

**★本書で 3 つとも載せる。**

---

## 4. ★★`make check-windows`（**ビルド規約へ明文化**）

**★★理由が本体である＝PR の CI は Linux のみで回る。⇒ これが無いと、Windows 専用ファイルは PR で 1 度もコンパイルされない。**

**★門は 2 か所に置いた＝`Makefile` の `check-windows` ＋ `pr-checks.yml`。**

**★★陽性対照まで測ってある**（製造）**＝`tray_sizes_windows_amd64.go` のサイズガードをわざと崩し、`make check-windows` が赤・`go build ./...`（Linux）が緑のままであることを実測した。⇒ 「門を置いた」は「門が効く」の証拠にならない。**

**★★`make test` からは呼ばない**（レビュー低-5 は不採用）**。⇒ 同ターゲットは `test-go` と `test-web` の合成であり「テストを走らせる」入口である。★クロス GOOS のビルド検査を混ぜるとターゲットの意味が変わる。**

---

## 5. ★本書が変えないもの

| # | 何を |
|---|---|
| **★★1** | **HTTP の経路。⇒ `DES-002` への反映は不要である**（**新設・変更 0 件。待ち受けにも触れていない**） |
| **★★2** | **待ち受けアドレス。⇒ `determineBindHost` / `determineBindAddr` は無改変**（**`127.0.0.1` 固定はしていない＝判断 2**） |
| **★★3** | **`-H=windowsgui`。⇒ `Makefile` の `build-windows` は無改変であり、黒窓はまだ消えていない**（`M34-02` の射程） |
| **★4** | **`REUSE.toml` ／ `scripts/public-snapshot-manifest.txt` ／ `go.mod` ／ `go.sum` ／ `docs/design/` ／ `migrations/`。⇒ いずれも差分 0 行** |
| **★★5** | **トレイの結線。⇒ `cmd/` から `internal/desktop` の import は 0 件である。★Go のリンカは同パッケージを配布 exe に含めない** |

---

## 6. 反映先の一覧

| 設計書 | 節 | 内容 |
|---|---|---|
| **`SUPP-001`** | **§5.2** | **§1 の `internal/desktop/` ＋ §2 の `cmd/genicon/` ＋ §3 の `cmd/seedgen/`** |
| **`SUPP-001`** | **§5.2 の直後** | **§4 の `make check-windows`（理由つき）＋ §2.1 の置き場の規約** |

---

*以上、CHANGE-173 **v1.0.0**。* **★★本書の値打ちは 2 つある。** **★(1) `internal/desktop/` の公開 API を逐語で残すこと**——**設計卓は実装ソースを読めないため、参照だけでは反映できない。** **★★(2) 置き場の規約**——**`scripts/` は層 C である。⇒ 移植物をそこへ置くと、層 A であるべきものが `MIT` になる。★`M34-02` が同じ罠に当たる。**
