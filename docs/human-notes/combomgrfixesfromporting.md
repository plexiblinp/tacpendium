# Tacpendium へ還流すべき是正一覧(Recurfold 移植時の発見)

作成: 2026-08-24 ／ Recurfold 環境整備(walking skeleton 立ち上げ)の副産物。
本ファイルはコミット対象外の報告資料です。Tacpendium 側の対応はすべて開発者の判断・手番で行ってください(Claude は Tacpendium を変更していません)。

---

## A. 実修正を推奨するもの

### A-1. `Makefile` の `test-go` / `test-go-debug` に `-count=1` が無い【最優先】

- **場所**: `Makefile:62-63`(`test-go: go test ./...`)、`Makefile:75-76`(`test-go-debug`)
- **問題**: Go のテスト結果キャッシュが効き、**「実行していないのに緑」**になる。Tacpendium 自身の実測(`.github/workflows/pr-checks.yml` のコメント)で:
  - `go test -count=1 ./...` → 142.2 秒 / cached 0
  - `go test ./...` → 0.385 秒 / **53/53 全キャッシュ / exit 0**
  - 369 倍の差で **終了コードでは区別できない**
- **波及**: CI は `make` を介さず直接 `-count=1` を叩いて回避しているが、**ローカルの `make test-go` と、それを呼ぶ `stop-test.sh` フック(下記 A-2)は無防備のまま**。
- **修正案**(Recurfold で適用済みの形):

  ```make
  test-go:
  	go test -count=1 ./...

  test-go-debug:
  	go test -tags=debug -count=1 ./...
  ```

- **注意**: `pr-checks.yml` 内のコメント「★Makefile の test-go は -count=1 を欠く(Makefile:63)。だから make は呼ばない」は、修正後に事実と食い違うため同時に更新すること(Recurfold では「Makefile 側にもあるが、この 1 行が Makefile の変更で消えないよう CI は直接叩く」という文言に変えた)。
- **既知課題との対応**: `parallel-board.md` **D-498** / slug `stop-test-hook-lacks-count-1` に記録済みの件の根治にあたる。

### A-2. `.claude/hooks/stop-test.sh` がテストキャッシュで空振りしても緑を返す

- **場所**: `.claude/hooks/stop-test.sh`(`make test-go` を呼ぶ経路)
- **問題**: A-1 と同根。キャッシュ有効時は 0.4 秒で「失敗なし」を返し、差分ゲートとして機能しない(D-498 の指摘そのもの)。
- **修正案**: **A-1 の Makefile 修正だけで解消する**(フック側の変更は不要)。より堅くするなら、D-498 が示唆するとおり「実行パッケージ数(`(cached)` でない `ok` の件数)が 0 なら警告する」検査をフックに足す手もあるが、`-count=1` が入れば実質不要。
- **併せて**: フック冒頭コメントの「dbtest.Setup が全マイグレを適用するため〜」の説明はそのままで良いが、`-count=1` により Stop フックの所要が毎回 2 分超になる点は運用への影響として認識しておくこと(Recurfold はテストが軽いので顕在化していないが、Tacpendium は 142〜246 秒かかる。**「正しく遅い」と「速く空振る」のトレードオフの判断は開発者に委ねる**)。

### A-3. `cmd/tacpendium/main.go` に graceful shutdown が無い

- **場所**: `cmd/tacpendium/main.go:359-363`(`e.Start(bindAddr)` でブロックしたまま終了)
- **問題**: リポジトリ全体で `signal.Notify` / `http.Server.Shutdown` / `SIGTERM` が **0 ヒット**。Ctrl-C・ウィンドウクローズで即死し、`defer sqlDB.Close()`(main.go:121-125)には通常経路で到達しない。処理中リクエストの完了も待たない。
  - SQLite は WAL のためデータ破壊には直結しないが、終了時の WAL チェックポイント・接続クローズが走らず、`-wal` / `-shm` サイドカーが残る。「exe のウィンドウを閉じて終了」という配布形態(printStartupNotice の案内文)では毎回この経路を通る。
- **修正案**(Recurfold で実装・動作確認済みのパターン。`cmd/recurfold/main.go:182-208` 参照):

  ```go
  sigCtx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
  defer stop()

  serveErr := make(chan error, 1)
  go func() { serveErr <- e.Start(bindAddr) }()

  select {
  case err := <-serveErr:
      if err != nil && !errors.Is(err, http.ErrServerClosed) {
          return fmt.Errorf("server: %w", err)
      }
  case <-sigCtx.Done():
      shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
      defer cancel()
      if err := e.Shutdown(shutdownCtx); err != nil {
          return fmt.Errorf("shutdown: %w", err)
      }
  }
  ```

  これで `defer sqlDB.Close()` まで確実に到達する。SIGTERM 送出 → 「shutdown signal received; draining requests」→「server stopped」のログを Recurfold で実測確認済み。
- **注意**: Windows 配布(コンソールウィンドウを×で閉じる)では SIGTERM ではなく強制終了になる場合があり、本修正が効くのは Ctrl-C / OS のシャットダウン / タスク終了(WM_CLOSE→CTRL_CLOSE_EVENT)経路。効果範囲の確認は Windows 実機での検証を推奨。

### A-4. `CLAUDE.md` §3 のディレクトリ構成図が as-built と乖離(`web/src/layouts/`)

- **場所**: `CLAUDE.md` §3 の概略図(`│   ├── layouts/ ← Layout、Header、Footer`)
- **問題**: 実リポジトリに `web/src/layouts/` は存在せず、Header / Footer は `web/src/components/` 直下にある(移植調査で実測)。ルール面の構成図が実態とずれていると、新規ファイルの置き場判断を誤らせる。
- **修正案**: §3 の該当行を削除し、`components/` の説明へ「Header / Footer を含む」を添える。あるいは実際に `layouts/` を作って移すかは設計判断(前者が安い)。

---

## B. 既知・起票済みと確認できたもの(新規対応は不要、状態の再掲のみ)

| 件 | 状態 |
|---|---|
| `README.md` の「ライセンス: 未定」が as-built(MIT 確定 2026-06-28)とずれている / LICENSE ファイル未配置 | `followup-backlog.md` の **M14-h** および `readme-md-stale-license-and-goversion` で起票済み・未着手。**Recurfold 側の経験から一言**: LICENSE と SPDX は後付けするほど高くつく(Recurfold は初コミットから入れて追加コストほぼゼロだった)。AGPL 三層案(`combmgr-license-strategy-outline.md`)の裁定と同時に片付けるのが良い |
| `web/src/hooks/useSessionStorage.ts` が `browser-storage.ts` を経由しない規約非整合 | `web/CLAUDE.md` §1 脚注 #7 で自認済み・followup 扱い。Recurfold には持ち込まなかった |
| `web/e2e/tsconfig.json` が `tsc -b` / `pnpm lint` の型チェック対象外(project references 未設定) | 移植調査で確認した既知の穴。**Recurfold にも同じ構造のまま持ち込んだ**(両リポジトリ共通の改善候補。Recurfold 側は followup 起票済み扱いとして porting-manifest に記録) |

---

## C. 運用上の教訓(不具合ではないが、Tacpendium の流用ガイドに足す価値があるもの)

- **一括リネームは検査スクリプト自身を除外してから回すこと。** Recurfold 移植中、`sed -i 's/combomgr/recurfold/g' scripts/*.sh` が `check-domain-vocabulary.sh` の禁止語リスト内の「combomgr」まで書き換え、一時「自リポジトリ名が禁止語」になる自己事故が起きた(自己検査の陽性対照で検出・復元済み)。Tacpendium の CLAUDE.md ヘッダは TEMPLATE NOTE で他プロジェクト流用を想定しているので、流用手順に「機械置換の対象から `scripts/check-*.sh` を除外する」旨を一行足しておくと、次の流用者が同じ穴を踏まない。

---

*以上。A-1〜A-4 の適用可否はいずれも開発者の判断に委ねます(A-1/A-2 は既知課題 D-498 の根治、A-3/A-4 は新規指摘)。*
