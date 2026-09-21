# リソース枯渇リスク監査レポート

- **実施日**: 2026-08-04
- **対象**: リポジトリ全体(Go バックエンド 約 20,750 行 / TypeScript フロントエンド 約 23,550 行、テスト除く)
- **性格**: 調査のみ(コード変更なし)。「ゲーム(SF6)と同時起動される前提で、PC のフリーズ・スワップ・ディスク飽和を絶対に許容しない」という要件に対する充足確認
- **手法**: 全ソースの体系的読解 + 静的解析(go vet / golangci-lint 2.12.2: errcheck・rowserrcheck・bodyclose・sqlclosecheck・noctx・staticcheck)+ 接続プールの PRAGMA 実効値の実証テスト(スクラッチ領域で実施、リポジトリ非汚染)

> **追記(2026-08-10)**: 本レポートの golangci-lint 実行は既定の切り捨て上限(同一メッセージ 3 件)付きだったため、**errcheck の件数(本番 16 件/テスト含め 53 件)は過少**である。上限を無効化した再測定では本番コードの errcheck は 61 件(rows.Close 系 37・Fprintln 系 11・os.Remove 系 8 ほか)。**データ経路の握りつぶしが cache.go:104,130 の 2 件のみという結論、および各指摘・重大度判定は再測定後も不変**(増分はすべてクリーンアップ・ログ系の様式問題で L-1 と同類)。正しい測定手順とベースラインは `resource-exhaustion-audit-runbook.md` §3/§5 を参照。

---

## 1. 要約

| 重大度 | 件数 |
|--------|------|
| 重大 | 1 |
| 中 | 6 |
| 軽微・様式 | 9 |

**総評**: 「無制限に増えてディスクを飽和させるもの」「停止経路のない常駐処理」は**バックエンド・フロントエンドとも検出されなかった**。ログはローテーションで構造的上限(約 60MB)があり、バックエンドに定期処理・ファイル監視・一時ファイル書き込みは存在せず、goroutine はブラウザ自動起動の一回性 1 本のみ。フロントエンドにも setInterval・常駐アニメーションループ・リスナのクリーンアップ漏れは無い。**開発者 PC のディスク 100% 事象の原因が本アプリである可能性は、本監査の範囲では極めて低い**と判断する。

一方で、データ整合性と同時実行時の資源挙動に関わる構造的問題が 1 件(重大)、長期稼働・ゲーム同時起動で効いてくる問題が 6 件(中)ある。

### もっとも危険な 3 件

1. **【重大 R-1】SQLite 接続プール無制限 × PRAGMA が 1 接続にしか効かない**(実測: プール 4 接続中 3 本が `foreign_keys=OFF`・`busy_timeout=0`・`synchronous=FULL`)。FK 不発によるデータ不整合、書き込み競合時の即時 SQLITE_BUSY 失敗、fsync 増によるゲームとの IO 競合が同根で発生する。既知バックログ(fk-enforcement-per-connection)の確認に加え、busy_timeout / synchronous への波及は本監査の新規観測。
2. **【中 M-2】`setup.FindDuplicateInCombo` の rows 反復中の入れ子クエリ**。現状は接続増幅(1 リクエストで 2 接続)で実害軽微だが、R-1 の対策として `SetMaxOpenConns(1)` を選ぶと**この関数が自己デッドロック(アプリ永久ハング)に変わる**。R-1 と必ずセットで扱うべき地雷。
3. **【中 M-4】フロントエンド QueryClient が全くの無設定**(`staleTime: 0` + `refetchOnWindowFocus: true` が全クエリに適用)。ゲームとの alt-tab 運用ではフォーカス復帰のたびに表示中全クエリの再フェッチバーストが発生する。リークではないが「ゲームと資源を奪い合う挙動」の主要因。

---

## 2. 重大

### R-1: SQLite 接続プール無制限 + 接続単位 PRAGMA がプールに行き渡らない

- **根拠**:
  - `internal/infra/db/db.go:40-51` — `PRAGMA journal_mode/foreign_keys/busy_timeout/synchronous` を `*sql.DB.Exec` で適用している。`journal_mode=WAL` のみ DB ファイルに永続化されるが、残り 3 つは**接続単位**の設定であり、この Exec を処理した 1 接続にしか効かない。
  - `cmd/tacpendium/main.go:109-117` — `dbinfra.Open` 後に `SetMaxOpenConns` / `SetMaxIdleConns` / `SetConnMaxLifetime` の呼び出しが**一切ない**(本番コード全体で 0 件。テストコードのみ `SetMaxOpenConns(1)` を使用し、コメントで「PRAGMA foreign_keys は接続単位」と問題を自認している: `internal/repository/punish/repository_test.go:101` 等)。
  - **実証**(本監査で `db.Open` と同一手順を再現し、プールから 4 接続を同時取得して観測):

    ```
    conn[0]: foreign_keys=1 busy_timeout=5000 synchronous=1(NORMAL) journal_mode=wal
    conn[1]: foreign_keys=0 busy_timeout=0    synchronous=2(FULL)   journal_mode=wal
    conn[2]: foreign_keys=0 busy_timeout=0    synchronous=2(FULL)   journal_mode=wal
    conn[3]: foreign_keys=0 busy_timeout=0    synchronous=2(FULL)   journal_mode=wal
    ```

  - `database/sql` の既定は MaxOpenConns 無制限・MaxIdleConns 2 のため、スパイク後に初期接続(conn[0])が破棄されると、**PRAGMA が効いた接続がプールに 1 本も残らない**状態になり得る。
- **影響**(3 系統):
  1. **データ不整合(=データを失う系)**: `ON DELETE CASCADE` 依存テーブル(`combo_steps` / `setup_steps` / `combo_punishes` 系等)で CASCADE が発火せず、孤児行が蓄積・参照整合性が壊れる。これは既知(`docs/handover/followup-backlog.md:246` fk-enforcement-per-connection、2026-07-31 起票・未着手。M19-03 の使い捨てプローブでは 16 接続中 7 本 OFF)。
  2. **書き込み競合時の即時失敗**: `busy_timeout=0` の接続では、WAL の書き込みロック競合時に**待たずに SQLITE_BUSY で即失敗**する。設計意図(5000ms 待つ)が大半の接続で無効。ブラウザタブ複数・LAN モードでのスマホ併用・フォーカス復帰の再フェッチバースト(M-4)と書き込みが重なると顕在化する。
  3. **ゲームとの IO 競合**(観点 C): `synchronous=FULL` の接続はコミット毎の fsync が増える。設計は NORMAL(WAL では耐久性十分・fsync 削減)を意図しているのに、大半の接続が FULL で動く。書き込みの多い操作(コンボ連続編集、CSV インポート)中の fsync 回数が意図の数倍になる。
- **再現条件**: 同時リクエストが 2 以上になった時点でプールが 2 接続目を張る(フロントは TanStack Query が並列フェッチするため通常運用で常時発生)。以後、どのクエリがどの PRAGMA 状態の接続に乗るかは不定。
- **修正の方向性**(適用は本監査の範囲外):
  - 接続単位 PRAGMA は **DSN 経由**でプール全接続に効かせる(modernc.org/sqlite は `file:path?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)` 形式をサポート。接続確立時に毎回適用される)。
  - `SetMaxOpenConns(1)` による対処は **M-2 の入れ子クエリ構造が残っている限り採用不可**(下記参照)。
  - **設計判断事項**: followup-backlog の記載どおり、FK 強制の一括是正は「FK=OFF 前提で通っていた既存の削除順序」を壊し得るため、独立調査+全テーブル回帰ゲートが必要。本監査はこの裁定(独立サブ推奨)を支持し、**busy_timeout / synchronous の是正は FK と切り離して先行可能**(削除順序に影響しない)である点を付記する。

---

## 3. 中

### M-1: HTTP サーバにタイムアウト・リクエストボディ上限がない

- **根拠**: `cmd/tacpendium/main.go:282-285` — `e.Start` をデフォルトのまま使用。`ReadTimeout` / `ReadHeaderTimeout` / `WriteTimeout` / `IdleTimeout` の設定はリポジトリ全体で 0 件。Echo の `BodyLimit` ミドルウェアも 0 件(`grep -rn "BodyLimit"` ヒットなし)。CSV アップロードのみ独自に 10MiB 上限あり(`internal/api/comboio/handler.go:46,194,215`)が、**JSON を bind する他の全 POST/PUT**(コンボ作成・intake resolve 等)はボディサイズ無制限でメモリに読み込まれる。
- **影響**: local モード(127.0.0.1)では実害は限定的。**lan モード(0.0.0.0 bind)では** LAN 内の任意端末から、(a) 巨大ボディ送信によるメモリ消費(スワップ→ゲームへの直撃)、(b) スローロリス型の接続保持、が可能。悪意がなくても、不具合のあるクライアントの巨大リクエスト 1 本でメモリスパイクが起きる。
- **再現条件**: lan モードで起動し、LAN 内から数百 MB のボディを POST する。
- **修正の方向性**: `http.Server` のタイムアウト設定(Echo は `e.Server` 経由で設定可能)+ 全体 `BodyLimit`(例: 1MB。CSV ルートのみ 10MiB に緩和)。

### M-2: `FindDuplicateInCombo` が rows 反復中に入れ子クエリを発行(既知指摘の再評価)

- **根拠**: `internal/repository/setup/repository.go:658-690` — `rows.Next()` ループ内(:679)で `r.FindStepsBySetupID(ctx, candidateID)`(:684)を呼ぶ。外側カーソルが開いたままのため、内側クエリは**プールの別接続**で実行される。
- **観点 C での評価**(依頼事項):
  - 現状(プール無制限)では、セットプレイ作成/更新 1 回につき一時的に 2 接続を消費する「接続増幅」。候補件数は同一コンボ内 setup 数(通常数件)で有界のため、単体では軽微。
  - ただし内側クエリが乗る 2 本目の接続は R-1 により `busy_timeout=0` であるため、**書き込みと重なると VAL-S04 検証が SQLITE_BUSY で偶発失敗**し得る。
  - **最重要**: R-1 の対策として `SetMaxOpenConns(1)` を選ぶと、外側 rows が唯一の接続を握ったまま内側クエリが空き接続を永久に待ち、**アプリ全体が永久ハング**する(`database/sql` はデッドロック検出をしない)。「ハングした Web アプリ」はゲーム中のユーザーには再起動困難であり、要件(フリーズ許容不可)に直撃する。
- **修正の方向性**: 候補 ID を先に全件スライスへ読み切り rows を Close してから、ループで steps を取得する(2 パス化)。R-1 の対処方式決定の**前に**この構造を除去しておくのが安全順序。

### M-3: recipe_cache 再計算系の全件ロード + Unmarshal 握りつぶし(潜在)

- **根拠**:
  - `internal/service/notation/cache.go:94-149`(`RecomputePresetCache`)/ :151-208(`DeletePresetCache`)— `ListAllActiveCombos` + `ListAllActiveSetups` で**全件をメモリにロード**し、全行を 1 件ずつ非バッチで UPDATE する。件数上限を決めるものはユーザーの登録数のみ。
  - `internal/service/notation/cache.go:104,130` — 既存 recipe_cache の `json.Unmarshal` エラーを**無視**(errcheck でも検出)。破損 JSON の場合、空 map から再構築されるため**他プリセットのキャッシュエントリが警告なしに消える**。`DeletePresetCache`(:163,190)は同じ Unmarshal を判定して continue しており**非対称**(既知指摘と一致)。
  - 同型の横断探索の結果: 握りつぶしはこの 2 箇所のみ。`ResolveComboRecipe`(cache.go:34-36)は Warn ログを出して再計算しており、こちらは対称的に妥当。
- **重要な前提**: **現時点で `RecomputePresetCache` / `DeletePresetCache` を呼ぶ本番コードは存在しない**(プリセット API は読み取りのみ: `internal/api/preset/routes.go:7-8`。呼び出しはテストのみ)。つまり潜在バグであり、プリセット編集機能の実装時に顕在化する。
- **影響**: 顕在化時、(a) コンボ数千件でリクエストスレッドが全件ロード+全行書き換えを行い、WAL 書き込みバーストと CPU/IO スパイクが発生(ゲーム同時起動時に有害)、(b) recipe_cache の静かな部分消失(消えた分は次回表示時に遅延再計算されるため、データ喪失ではなく性能劣化として現れる)。
- **修正の方向性**: プリセット編集実装時に、バッチ UPDATE / トランザクション化 / Unmarshal 失敗時の Warn ログ(DeletePresetCache と同じ判定)を併せて設計する。設計判断事項として申し送る。

### M-4: フロントエンド QueryClient が無設定(フォーカス復帰毎の再フェッチバースト)

- **根拠**: `web/src/main.tsx:10` — `new QueryClient()` を引数なしで生成。`defaultOptions` なし。ライブラリ既定の `staleTime: 0` / `refetchOnWindowFocus: true` / `retry: 3` が全域に適用される。`staleTime` を個別指定しているのは 4 箇所のみ(`web/src/features/moves/api.ts:24,44`、`web/src/features/config/useConfig.ts:12`、`web/src/features/preset/api.ts:11`、`web/src/features/combo-io/usePreviewNames.ts:52`)。コンボ一覧・詳細・punish 系・setup 系・タグ・キャラ等の主要クエリはすべて staleTime 0。
- **影響**(観点 C の核心): 本アプリの想定運用は「ゲーム⇄ブラウザの頻繁な alt-tab」。**フォーカスが戻るたびに表示中の全クエリが再フェッチ**され、BE への数リクエスト+ JSON パース + 全件再レンダリングが走る。1 回あたりは軽量でも、「ゲームから戻った瞬間」という最も応答性が求められるタイミングに毎回バーストが重なる。また `retry: 3` 既定のため、BE 停止中にタブを開いたままだと失敗クエリが指数バックオフ付きで再試行され続ける(無限ではない)。
- **測定**: リクエスト 1 回のアクセスログは 1 行(下記 5. の定量参照)。フォーカス復帰 1 回 ≒ 5〜10 リクエストの規模(コンボ一覧ページの場合: combos + characters + tags + config 等)。
- **修正の方向性**: `defaultOptions.queries` に `staleTime`(例 30〜60 秒)と `refetchOnWindowFocus: false`(または `'always'` が必要な画面のみ個別有効化)を設定する。ローカル単一ユーザーの CRUD アプリでは mutation 後の invalidate が主な更新経路であり、フォーカス再フェッチへの依存は小さい。

### M-5: setups の論理削除残骸に破棄経路がない + VACUUM 方針なし

- **根拠**:
  - コンボは論理削除(`DELETE /combos/:id`)→ ゴミ箱 → 完全削除(`DELETE /combos/:id/permanent`、`internal/api/combo/routes.go:26-28`、物理 DELETE は `internal/repository/combo/repository.go:807`)の経路が揃っている。
  - 一方 **setups には物理削除が存在しない**(`internal/repository/setup/` に `DELETE FROM setups` は 0 件。`internal/api/setup/routes.go:14` の DeleteSetup は論理削除のみ)。deleted_at 付きの setup 行と steps・recipe_cache は**単調増加**し、上限を決めるものがない。
  - `VACUUM` / `PRAGMA auto_vacuum` はリポジトリ全体(マイグレーション含む)で 0 件。完全削除やゴミ箱空にしても DB ファイルは縮まない(空きページは内部再利用されるのみ)。
- **影響**: 1 行数百バイト規模のため年単位でも MB オーダーであり、ディスク飽和には至らない。「単調増加するが年単位で問題にならない」の典型として中に分類。
- **修正の方向性**: setups のゴミ箱 UI or 定期パージの要否は**設計判断事項**。VACUUM は「ユーザー操作起点(設定画面のメンテナンスボタン等)でのみ実行、起動時自動実行はしない」方針を推奨(起動時 VACUUM はゲーム同時起動時の IO バーストになるため要件と逆行)。

### M-6: フロントが limit/offset を送らず、BE 既定 100 件が暗黙の安全弁になっている

- **根拠**: `web/src/features/combo/api.ts:25-51`(`buildQuery`)は limit / offset を送信しない。BE 側 `internal/repository/combo/repository.go:528-533` の「`limit <= 0` → 100、上限 1000」がメモリ・DOM 描画量(`web/src/features/combo/components/ComboTable.tsx:138` で全件 map 描画、仮想化ライブラリ未導入)の実質上限になっている。ゴミ箱一覧(`useTrashCombos.ts:6`)も同様。
- **影響**: メモリ保護は現状機能しているが、それは FE の設計ではなく BE 既定値への偶然の依存。101 件目以降にアクセスする UI が存在しないという機能上の頭打ちも併存する。将来「全件表示」対応で FE が `limit=1000` を送るようになった場合、1000 行の非仮想化 DOM 描画がフォーカス復帰再フェッチ(M-4)と重なる。
- **修正の方向性**: ページネーション(または仮想化)導入時に上限の所在を FE/BE どちらが持つか明示する。設計判断事項。

---

## 4. 軽微・様式

| # | 指摘 | 根拠 |
|---|------|------|
| L-1 | `rows.Close()` の戻り値無視 ×3(読み取りのみのクエリのため実害なし。規律として) | `internal/repository/punish/scan.go:14,62,91`(errcheck 検出) |
| L-2 | noctx: `Ping`(`PingContext` でない)、`net.Listen`(`ListenConfig` でない)。起動時 1 回のみで実害なし | `internal/infra/db/db.go:53`、`internal/infra/netutil/port.go:27` |
| L-3 | staticcheck: 空分岐(SA9003)、De Morgan 簡約可(QF1001) | `internal/service/validation/combo.go:220`、`internal/service/setplay/setplay.go:265` |
| L-4 | `writeAtomic` のクリーンアップ `os.Remove` 戻り値無視(失敗時 `.tmp` が 1 個残るだけで増殖しない) | `internal/service/config/service.go:267,271,275`(config.Save 側 `internal/config/config.go:157-170` も同型) |
| L-5 | `scratch-<branch>.db`(+ -wal/-shm)がブランチ毎にリポジトリ直下へ蓄積。gitignore 済みだが自動削除はなく、開発 PC のディスクに残り続ける(開発環境のみ。**今回のディスク 100% 事象に関連し得る唯一の心当たりだが、DB は通常 MB オーダーで単独では説明力不足**) | `scripts/dev-throwaway-db.sh:60-64`(後片付けは手動: :26 コメント) |
| L-6 | 取込ヘルパーの textarea が 1 キーストローク毎に localStorage へ同期書き込み(デバウンスなし。単一キー上書きのため容量は増えない) | `web/src/pages/IntakeHelperPage.tsx:86-89` → `web/src/features/intake/user-rules-storage.ts` |
| L-7 | `combo-list-expanded-ids-v1` が `browser-storage.ts` 非経由(CLAUDE.md §10.X で followup 裁定済みの既知非整合。新規実装で踏襲しないこと) | `web/src/hooks/useSessionStorage.ts:18` |
| L-8 | `useCheckDuplicate` の依存配列に関数呼び出し結果(`JSON.stringify`)。ループはしないが毎レンダリングで入力全体を文字列化 | `web/src/features/combo/hooks/useCheckDuplicate.ts:97,102-105` |
| L-9 | slog はハンドラ(lumberjack)の書き込みエラーを破棄する仕様のため、**ディスクフル時はログが静かに失われる**(アプリは落ちない = 挙動としては要件に合致。認識事項として記録) | `internal/infra/log/log.go:43-62`(slog 標準挙動) |

---

## 5. 確認済みで問題なかった領域(カバレッジ申告)

### A. ディスク膨張

| 領域 | 確認結果 | 上限を決めているもの |
|------|----------|---------------------|
| ログ | lumberjack ローテーション実装済み(`internal/infra/log/log.go:43-49`)。設定既定 MaxSize 10MB / MaxBackups 5 / MaxAge 30 日(`internal/config/config.go:42-45`、SUPP-001 §5.6 と一致) | **構造的上限 ≒ 60MB**(現行 10MB × (1+5))。`logging.file` はアプリ管轄外パスを指定できない(CHANGE-048 検証: `internal/config/config.go:251-274`) |
| ログ増加速度(定量) | アクセスログ 1 行 ≒ 300〜400B(JSON・AddSource 付き)。1 日 8 時間・毎分フォーカス復帰(≒10 req/分)想定で約 5,000 行/日 ≒ **1.5〜2MB/日 → 約 5〜7 日でローテート 1 周**。debug レベルでも出力先はローテーション対象ファイル+stdout であり無制限増加しない | 同上 |
| recipe_cache | コンボ/セットプレイ 1 行あたり preset 数ぶんの JSON map。プリセット削除時の破棄経路も実装済み(`DeletePresetCache`) | プリセット数 × レシピ文字列長(小) |
| 生成物 | サムネイル・エクスポート成果物のサーバ側保存は**なし**。CSV export は in-memory zip で完結(`internal/service/comboio/export.go:21` コメント通り実装確認)。画像 export はブラウザ内で完結(`render-and-capture.tsx`) | 生成物を書かない設計そのもの |
| SQLite WAL | `journal_mode=WAL` はファイルに永続化。`wal_autocheckpoint=1000`(**実測**。≒4MB 相当)が全接続で有効。長時間 read トランザクションを張る箇所なし → WAL 肥大の条件不成立 | autocheckpoint 1000 ページ |
| SQLite 本体 | 上限なしだが、増加源はユーザー入力データそのもの(+M-5 の論理削除残骸)。マイグレーションは起動時の未適用分のみ(`internal/infra/migration/migrate.go:94`、ErrNoChange 吸収) | ユーザーデータ量 |
| 一時ディレクトリ | `os.TempDir` / `os.CreateTemp` / `os.MkdirTemp` への書き込みは本番コード **0 件**。`config.toml.tmp` は rename 成功/失敗どちらでも残らない(失敗時 Remove) | — |

### B. メモリ・ハンドルリーク

- `sql.Rows`: **rowserrcheck・sqlclosecheck とも本番コード 0 件**(sqlclosecheck の 1 件はテストコード `migrate_test.go:164` の様式のみ)。全 75 箇所の Query 呼び出しで `defer rows.Close()` パターンを目視確認。`rows.Err()` も repository 全ファイルで対応済み。
- defer をループ内で積むパターン: 0 件。
- goroutine: バックエンド全体で `go func` は **1 箇所のみ**(`cmd/tacpendium/main.go:326`、ブラウザ自動起動の一回性 goroutine。自然終了)。停止経路のない常駐 goroutine は存在しない。
- `time.Ticker` / `time.Timer` / `time.Sleep`: 本番コード **0 件**。
- ファイル Close 漏れ: 0 件(static handler は `defer f.Close()`: `internal/api/static/handler.go:92`)。HTTP クライアント(外部通信)自体が 0 件のため bodyclose 対象なし。
- 無制限に伸びるメモリ上の構造: バックエンドはリクエストスコープのみ(グローバル可変 map/slice なし)。フロントエンドもモジュールスコープの可変コレクション 0 件、TanStack Query キャッシュは gcTime 既定 5 分で回収。
- 大きな一括読み込み: CSV import は 10MiB LimitReader + 1000 行上限 + zip 爆弾ガード(`internal/api/comboio/handler.go:193-199`)。コンボ一覧は LIMIT 100/1000。例外は M-3(潜在)のみ。

### C. ゲーム同時起動時の資源競合

- バックグラウンド定期処理・ポーリング・自動保存・ファイル監視: バックエンド **0 件**。フロントエンドも `setInterval` 0 件、`refetchInterval` 0 件、自己再帰 rAF ループ 0 件(rAF 唯一の使用は画像 export 時の 2 フレーム待ち 1 回きり: `render-and-capture.tsx:53-54`)。
- 起動時の全走査: なし(migration の未適用分チェックのみ。整合性チェック・全件読み込みなし)。
- フロント常時処理: アニメーションは CSS(tailwindcss-animate)。依存配列なしの無条件 setState effect 0 件。イベントリスナ 2 箇所とも removeEventListener 対応済み(`web/src/hooks/useIsMobile.ts:7-8`、`web/src/features/config/QRCodeModal.tsx:19-20`)。WebSocket / SSE / Worker 0 件。
- DB 接続とロック: 問題は R-1 / M-2 に集約(上述)。長時間トランザクションなし(全 Tx はリクエスト内で完結、`BeginTx` 全 15 箇所を確認)。
- debug API: `-tags=debug` ビルドのみ有効(`internal/api/debug/routes_noop.go`)、dump は 100 行上限。

### D. エラー握りつぶし(ディスクフル時に静かに壊れる経路)

- errcheck 全件レビュー済み(本番コード 16 件 / テスト含め 53 件)。**データを失う系は M-3 の 2 件のみ**。残りは stdout 案内の Fprintln(main.go:296-303)、クリーンアップの os.Remove(L-4)、rows.Close(L-1)でありデータ経路に無関係。
- config.toml 書き戻しは 2 実装とも tmp → Sync → Close → Rename のアトミック手順で、**各段階のエラーを検査**している(`internal/config/config.go:147-173`、`internal/service/config/service.go:253-285`)。ディスクフル時は明示エラーで旧ファイルが無傷で残る。
- SQLite 書き込み失敗(SQLITE_FULL)はエラーとして service → handler へ伝播し HTTP エラーになる(握りつぶし箇所なし)。
- ポート永続化失敗(`main.go:192-194`)は Warn ログのみだが、これは設計意図どおり(起動継続優先)。

### E. 静的解析の現状

- `go vet ./...`: **クリーン(0 件)**。
- CI: **存在しない**(`.github/` ディレクトリなし。他 CI 設定も 0 件)。品質ゲートは Makefile(test-go / test-web / e2e)と `.claude/hooks/post-edit-check.sh`(tsc --noEmit、非ブロック)のみ。
- eslint: **未導入**(設定ファイル・依存とも 0 件。`web/package.json` の `lint` = `tsc --noEmit`)。`react-hooks/exhaustive-deps` は機能していない。docs 側にも既知として記録あり(`docs/progress/phase3/m18-03a-review.md:202`)。
- golangci-lint 設定ファイル(`.golangci.yml`): なし。

---

## 6. コーディング方針へ追記すべき規律の提案

現行 CLAUDE.md §10 は「アプリ外データを消さない」「機密を漏らさない」「データを不可逆に壊さない」を目的に掲げるが、**リソース枯渇(メモリリーク・ディスク膨張・IO 競合)は目的にも禁止事項にも含まれていない**。同じ粒度で以下の追記を提案する(§10 の目的欄に「ユーザーの PC を不安定にしない(ゲーム同時起動時のフリーズ・スワップ・ディスク飽和の防止)」を第 5 の目的として加えた上で):

1. **上限のない書き込みを作らない**: ディスクへ継続的に書き込むもの(ログ・キャッシュ・生成物・一時ファイル)を新設する場合、「何が上限を決めるか」(ローテーション・失効・破棄経路・件数上限のいずれか)を実装とコードコメントに必ず明記する。上限を決められない場合は実装前に開発者確認。
2. **常駐・定期処理の新設は開発者確認**: バックエンドの goroutine 常駐・定期実行(Ticker/ポーリング)、フロントエンドの setInterval・refetchInterval・自己再帰 requestAnimationFrame は、本アプリが「ゲームと同時起動される」前提に直接影響するため、追加前に必ず開発者に提案する。追加する場合は停止経路(context キャンセル / cleanup 関数)を必ず実装する。
3. **接続単位の SQLite 設定は `*sql.DB.Exec` で流さない**: `PRAGMA foreign_keys` / `busy_timeout` / `synchronous` 等の接続単位設定は接続プールの 1 接続にしか効かない。DSN パラメータ等、プール全接続に効く経路で設定する(architecture-patterns.md §11 の教訓の CLAUDE.md 昇格)。
4. **`sql.Rows` を開いたまま同一 DB へ別クエリを発行しない**: 反復中の入れ子クエリは接続増幅・プール上限設定時のデッドロックの原因になる。ID を読み切ってから 2 パス目で取得する。
5. **書き込み系のエラー戻り値を無視しない**: `json.Unmarshal` を含め、無視が妥当な場合は「なぜ無視してよいか」をコメントで明記する(errcheck を通る形にする)。特にディスク書き込み・DB 更新・キャッシュ再構築の経路では黙殺禁止。
6. **フロントの購読・タイマーは cleanup とセットで書く**: useEffect 内の addEventListener / setTimeout は cleanup 返却を必須とし、TanStack Query のフェッチ挙動(staleTime / refetchOnWindowFocus)はライブラリ既定に暗黙依存せず QueryClient の defaultOptions で明示する。

---

## 7. 静的解析の導入提案

現状はゼロベース(CI なし・eslint なし・golangci 設定なし)。以下を段階導入すると、本監査の指摘の再発を機械的に防げる。

### Go: golangci-lint(`.golangci.yml` 新設 + Makefile `lint` ターゲット)

| リンタ | 恒久的にカバーする本監査の指摘 |
|--------|-------------------------------|
| errcheck | M-3(Unmarshal 握りつぶし)、L-1、L-4、観点 D 全般 |
| rowserrcheck / sqlclosecheck | 観点 B の rows リーク(現状 0 件の維持) |
| bodyclose | 将来 HTTP クライアントを導入した際のレスポンスボディリーク |
| noctx | L-2(context 不通の呼び出し) |
| staticcheck | L-3 ほか一般バグ類 |
| govet(既定) | 現状クリーンの維持 |

- 注意: 本監査時点で apt/配布版 golangci-lint 2.5.0 は Go 1.26 の解析に非対応だった(`go install` で Go 1.26.4 toolchain ビルドすれば動作することを確認済み)。導入時はバージョン指定に留意。
- 既存コードの errcheck 違反はテスト含め 53 件(大半がテストの `tx.Rollback()` 等)。テストを除外パスにするか、`//nolint` の理由付き明示で始めるのが現実的。

### フロントエンド: eslint + `eslint-plugin-react-hooks`

| ルール | 恒久的にカバーする指摘 |
|--------|------------------------|
| react-hooks/exhaustive-deps | L-8、および将来の useEffect 依存漏れ由来の再実行ループ・リーク |
| react-hooks/rules-of-hooks | フック誤用全般 |

- 依存追加になるため CLAUDE.md §6 に従い開発者承認が前提。`lint` スクリプトを `tsc --noEmit && eslint .` に拡張し、`.claude/hooks/post-edit-check.sh` にも組み込むと編集時に自動検出される。

### 運用面

- CI 基盤が無い間は、Makefile に `lint` ターゲットを作り `make build` / リリース手順の前提に組み込む(実行環境がローカルのみでも「必ず通す関門」を定義できる)。
- 本監査で実施した「プール接続の PRAGMA 実効値検査」は、`internal/infra/db` のテストとして常設する価値がある(R-1 是正後のリグレッションゲート)。

---

## 付記: やらなかったこと・要確認事項

- コード変更・依存追加は一切行っていない(本レポートのみが成果物)。
- R-1 の是正方式(DSN 化 / 接続数制限 / CASCADE 依存の排除)の選定は、followup-backlog の裁定どおり**独立調査が必要な設計判断事項**であり、本監査では方向性の列挙に留めた。
- 開発者 PC のディスク 100% 事象の直接原因は本リポジトリの範囲では特定できない(本アプリ由来の無制限ディスク書き込みは検出されなかった、が結論)。Claude Code / Codex / ビルドキャッシュ(`~/go/pkg`、`web/node_modules`、Vite キャッシュ)等のアプリ外要因は本監査のスコープ外のため**要確認**。
