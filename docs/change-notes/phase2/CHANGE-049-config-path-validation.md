# CHANGE-049 通知書: 設定パス(database.path / logging.file)のデータディレクトリ配下への制約

| 項目 | 内容 |
|------|------|
| 通知書ID | **CHANGE-049**(当初 製造担当が 048 で起票したが、048 は CHANGE-048〔DES-004 §2.1 dash 系追記、2026-06-25〕で使用済みのため **049 へ振り直し**。製造担当は更新前の registry〔次=048〕を参照したことによる採番衝突) |
| サブマイルストーン | M12-06 派生(知人先行リリース前の安全監査で発見) |
| 起票日 | 2026-06-27 |
| 起票者 | **設計担当 Claude**(本通知書の正式起票は設計担当。製造担当 Claude Code が先行ドラフト + 先行実装〔`feature/m12-06`〕を実施したものを、設計担当が採番是正・正式起票・DES 反映) |
| 承認者 | 開発者(2026-06-27 検証ポリシー = 厳格〔データディレクトリ限定〕を採用、CHANGE 起票・反映を指示) |
| ステータス | **反映済み**(DES-002 v1.23.0 → v1.24.0) |
| 影響設計書 | DES-002(v1.23.0 → v1.24.0)。SUPP-001 §5.8 は補足資料のため bump のみ(v1.24.0 → v1.25.0) |
| 関連 | 安全監査結果は §1。製造実装は `feature/m12-06` で先行実施済み(§3) |

---

## 0. 要約

`database.path` と `logging.file`(`config.toml` / `PUT /api/config` で設定可能)に対し、**アプリ既定データディレクトリ(または実行時カレントディレクトリ)配下に閉じ込める検証**を追加した。これに伴い、DES-002(アーキテクチャ「DBファイル配置」L304 付近)の「DB ファイルの**配置先は設定で変更可能とする**」という記述を、「**アプリ管轄ディレクトリ配下に限り**変更可能」と狭める。設計書本体の記述変更を要するため CHANGE 通知書として起票する。

---

## 1. 監査で確認した事実(read-only 全数調査の結論)

- **DB 破壊操作 — 安全**: すべての `DELETE FROM` は `WHERE id = ?` / `user_id = ?` 等でスコープ済み。バルク削除/リセット/wipe エンドポイントなし。down マイグレーション(`DROP TABLE`)は存在するが起動時は `migrate.Up()` のみで未実行。SQL は値を常に `?` プレースホルダ化(インジェクションなし、debug API はホワイトリスト + 本番ビルド無効)。
- **ファイルシステム破壊操作 — 安全**: `exec.Command` / `rm` / ユーザーデータの `os.RemoveAll` はゼロ。削除は自分の `config.toml.tmp` と lumberjack 自身のバックアップ(`combomgr.log.*`、件数/日数制限内)のみで、他人のファイルに到達不能。
- **唯一の隙 — 設定パスの未検証**: `database.path` / `logging.file` がユーザー自由設定可能かつ未検証。次回起動時に `os.MkdirAll` でディレクトリ生成し、lumberjack が追記/ローテーション、golang-migrate がスキーマ書き込み/マイグレーションを行う。既存ファイルを指すとそのファイルを**破損**させうる(削除はしない)。
- **深刻度の分岐 — LAN モード**: LAN モードは `0.0.0.0` bind かつ API 認証なし(`Security.PasswordEnabled` 未配線)。同一 Wi-Fi の他端末が未認証で `PUT /api/config` を叩き、対象 PC の次回起動時に破損パスを発火させうる。

開発者方針(2026-06-27): 検証ポリシーは **厳格(データディレクトリ限定)** を採用。本検証は LAN の認証問題に依存せず破壊的パスを封止できる点が利点(allowlist 型で secure-by-default。`..` 拒否のみの最小案は絶対パス攻撃を防げず、存在チェック併用のハイブリッド案は TOCTOU 競合を招くため不採用)。

---

## 2. 設計書本体への影響(反映済み)

### DES-002(02-architecture.md v1.24.0)
- **対象記述**(L304 付近): 「…アプリデータディレクトリ…に配置する。**配置先は設定で変更可能とする**。」
- **反映後**: 「配置先は設定で変更可能とするが、**アプリ既定データディレクトリ、または実行時カレントディレクトリの配下に限る**(`..` によるディレクトリトラバーサル、および管轄外の絶対パスは拒否する)。これは設定経由(`config.toml` / `PUT /api/config`)で指定されたパスが、アプリ管轄外の既存ファイルを上書き・破損させることを防ぐための制約である(CHANGE-049)。同制約は `logging.file` にも適用する。」
- ステータス欄に CHANGE-049 反映を前置。

### SUPP-001(補足資料・bump のみ v1.25.0)
- §5.8 設定ファイル例のコメント + 「`database.path` / `logging.file` のパス検証ポリシー」段落で本制約を追記(正典は DES-002)。前提文書欄を M12 完了時点の現行版へ追従。

### 影響しない設計書
- DES-001 / DES-003 / DES-004 / DES-005 / DES-006 / REQ-001: スキーマ・API 契約・画面・検証ルール体系・要件に変更なし(検証は既存 `validateConfig` への規則追加)。

---

## 3. 製造側の実装(本 CHANGE 先行実装、`feature/m12-06`)

| ファイル | 変更 |
|----------|------|
| `internal/config/config.go` | `ValidateDataPath(path string) string` を新設(空=許容、`..` 拒否、絶対パスはデータディレクトリ/CWD 配下のみ許容)。`validate()` から `database.path` / `logging.file` を検証 |
| `internal/infra/db/db.go` | `DataDir()` を公開(`ResolveDBPath("")` の親。検証の許可ルートとして再利用) |
| `internal/service/config/service.go` | `validateConfig()` から `appconfig.ValidateDataPath` を呼び出し(API 経路と config ロード経路で規則共有)。`restartRequired` を `database.path` / `logging.file` 変更時も true に是正(起動時のみ反映されるため) |
| `internal/config/config_test.go` | 既存 `TestLoad_ValidFile` の `/tmp/test.db`(管轄外絶対パス)を `data/test.db`(相対)へ更新。トラバーサル/管轄外絶対パス拒否、`ValidateDataPath` テーブルテストを追加 |
| `internal/service/config/service_test.go` | トラバーサルパス拒否・`database.path` 変更時の restartRequired をテスト追加 |

### 検証ポリシー(実装の確定仕様)
1. 空文字は許容(`database.path` 空 = OS 既定へフォールバック、`logging.file` 空は `log.Init` 側で別途エラー)。
2. `filepath.Clean` 後に `..` 要素を含むパスを拒否。
3. 絶対パスは `db.DataDir()`(OS 別 combomgr フォルダ)または実行時 CWD の配下のみ許可。それ以外を拒否。
4. `..` を含まない相対パスは CWD 配下に解決されるため許可(既定 `logs/combomgr.log` が該当)。

---

## 4. 反映記録(設計担当が実施済み)

- [x] DES-002 L304 付近を §2 のとおり改訂(v1.23.0 → v1.24.0)。
- [x] SUPP-001 §5.8 にパス検証ポリシーを追記(bump v1.24.0 → v1.25.0、前提文書欄も追従)。
- [x] `change-number-registry.md` §1 に 049 使用済みを記載、次回採番を 050 に進めた。§3 に DES-002 行追加、§4 に v1.37.0。
- [x] `change-report-049.md` を作成。

## 5. 別途記録(本 CHANGE 対象外・フェーズ3 / Security へ)

- **LAN モードの API 無認証**: 設定変更系を含む API が LAN モードで未認証のまま晒される。本 CHANGE のパス検証で「破壊的パスの植え込み」は封止されるが、設定の不正書き換え一般は別問題。認証(`Security.PasswordEnabled` の実配線)は **Security 機能領域として別途判断**(followup-backlog に記録。先行リリースで LAN を使うなら、致命性に応じて LAN 不使用の依頼も選択肢)。

---

## 開発者への確認事項

1. **採番衝突の事後共有**
   何を: 本件は製造担当が更新前 registry(次=048)を見て 048 で起票したが、048 は dash 系で使用済みのため **049 へ振り直した**。製造担当ブランチ内のコミットメッセージ/コメントに「CHANGE-048」と記載が残っていれば 049 へ読み替えが要る。
   なぜ: 採番は registry が正(欠番 008/009/014、本件後の次は 050)。
   暫定案: registry を 049 で確定済み。製造担当の `feature/m12-06` 内の参照番号の訂正は、git 操作担当=開発者の範囲で読み替え/修正。

---

> 反映済み。change-report-049 / change-number-registry(049 使用済み・次 050)を更新。push/マージは開発者。

*以上、CHANGE-049 通知書。配置 `docs/change-notes/CHANGE-049-config-path-validation.md`。設計担当 Claude が採番是正・正式起票・DES 反映を実施。*
