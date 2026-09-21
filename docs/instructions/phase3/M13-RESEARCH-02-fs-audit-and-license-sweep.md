# 指示書 M13-RESEARCH-02: 破壊的 FS 操作の全数監査 + 依存ライセンス軽量スイープ

| 項目 | 内容 |
|------|------|
| 指示書ID | M13-RESEARCH-02 |
| 種別 | 調査指示書(read-only。実装・コード変更・依存追加・ファイル移動を一切行わない) |
| 対象 | 製造担当 Claude Code |
| モデル | Sonnet 4.6(read-only 調査。M13/M14-RESEARCH-01 と同方針。実使用は開発者判断) |
| レビュー | 不要(read-only。実装物が無いため機械レビュー対象なし) |
| 並列性 | **M13-01 と並行可**(read-only。M13-01 の実装と独立) |
| 作成者・作成日 | 設計担当 Claude(フェーズ3 キックオフ担当)/ 2026-06-28 |
| 前提 | phase3-overview v0.3.0 §M13。followup-backlog §F12-7(データ保護・破壊的 FS 操作監査)。CHANGE-049(設定パス検証=DES-002 反映済み) |
| 主参照 | code-facts §4/§5(config 構造体)、DES-002(§設定パス・CHANGE-049)、CLAUDE.md §10、DES-001 §5(ライセンス)、M14-RESEARCH-01-report §F(配布健全化・既調査) |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-28 | 初版。F12-7 の破壊的 FS 操作監査 + NFR403 依存ライセンス軽量スイープ。 |

---

## 1. 背景と目的

### 1.1 背景

フェーズ3 M13(データ共有・データ保護)の一環として、先行リリースのデータ保護を read-only で裏取りする。2 つの独立した監査を 1 本にまとめる(いずれも軽量・実装非依存):

1. **破壊的 FS 操作の全数監査**(followup-backlog §F12-7): 本アプリが**データ/設定ディレクトリ管轄外のファイルを削除・上書き・破壊しない**ことを実コードで確認。CHANGE-049 は設定経由(`config.toml`/`PUT /api/config`)の `database.path`/`logging.file` のパストラバーサル・管轄外絶対パスを封止済みだが、それ**以外の破壊的 FS 操作**(直接の `os.Remove`/`os.RemoveAll`/`os.Rename`/上書き書込等)が残っていないかを全数で見る。
2. **依存ライセンス軽量スイープ**(NFR403・MIT 確定 2026-06-28): `go.mod`/`web/package.json` の依存ライセンスを一覧化し、**全て MIT/BSD/Apache 等の寛容ライセンスで構成されている**ことを確認(コピーレフト・不明ライセンスの検出)。本体ライセンスは MIT 確定。

### 1.2 目的

下記 §4 の A・B を**実コードの view・grep で確認**し、§5 の様式で報告する。報告は配布判定(M14/リリース前)の入力、および M13-01(export/import の FS 書込が増える)の安全前提になる。

### 1.3 この調査でやらないこと(read-only 厳守)

- 実装・コード変更・依存追加(`go get`/`npm install`)・ファイル移動を**一切行わない**。
- ビルド・実行・テスト実行をしない(静的 view・grep のみ)。
- ライセンスの最終判定(配布可否の法的決定)はしない(列挙と寛容/非寛容の分類まで)。設計書本体(DES)を変更しない(CHANGE 非対象)。

---

## 2. 成果物

### 2.1 作成するファイル
- `docs/progress/phase3/M13-RESEARCH-02-report.md`(調査報告。§5 の様式)。

### 2.2 変更しないもの
- 全ソース・DES 本体・設定・テスト(read-only)。

---

## 3. 前提条件

### 3.1 必読ドキュメント

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`(自動生成)**。本節は docs-map 準拠の実パスを併記する(記憶で書かない・retrospective-digest §0)。

- **code-facts**(`docs/handover/code-facts.md`)§4(Go ルート↔ハンドラ)・§5(config 構造体 = `[database].path`/`[logging].file`)。
- **CHANGE-049 関連**(`docs/change-notes/CHANGE-049-*.md` + 反映先 DES-002 `docs/design/02-architecture.md` 設定パス検証 = 管轄外絶対パス・`..` トラバーサル拒否)。
- **CLAUDE.md**(`CLAUDE.md`)§10(禁止事項)。**DES-001**(`docs/design/01-tech-stack.md`)§5(プロジェクトライセンス = MIT)。
- **M14-RESEARCH-01-report**(`docs/progress/M14-RESEARCH-01-report.md`)§F(配布健全化の既調査 = 配布禁止 HTML/CSV は gitignore 済み・go:embed は web/dist + migrations のみ)。本サブは FS **操作**(削除/上書き)の監査で、F の配布**データ**監査とは別軸。

### 3.2 前提事実(設計担当が確認済み = 起点)
- config(`internal/config`)に `[database].path`(DB ファイル)・`[logging].file`(ログ)があり、CHANGE-049 で設定経由のパス植え込みを封止済み(管轄外絶対パス・`..` 拒否)。本サブはそれ**以外**の破壊的 FS 操作を見る。
- 本体ライセンス MIT 確定。依存は M13/M14 報告で stdlib・MIT 系中心と判明しているが、**全依存の網羅一覧は未取得**(本サブで取得)。

---

## 4. 調査項目

実コードを view し、grep で全数を取る。パス・関数・依存名は**実値**で報告(要約・推測で埋めない)。確認不能は「未確認」と明記。

### A. 破壊的 FS 操作の全数監査(F12-7)

- **A-1**: **破壊的 FS 操作を全数 grep**。対象 = `os.Remove` / `os.RemoveAll` / `os.Rename` / `os.Truncate` / `os.Create`(既存上書き) / `os.OpenFile`(`O_TRUNC`/`O_WRONLY`/`O_CREATE`) / `os.WriteFile` / `ioutil.WriteFile` / `os.Mkdir*` / バックアップ・一時ファイル処理。各ヒットの**ファイル:行・対象パスの算出元**(定数 / config 由来 / ユーザ入力由来 / 結合)を報告。
- **A-2**: 各破壊的操作の**書込/削除先パスが、アプリ既定データディレクトリ・実行時カレント配下に封じ込められているか**を実コードで確認。`..` トラバーサル・絶対パス直書き・**ユーザ入力(API ボディ/クエリ/CSV セル等)由来のパス**が混入しないか。
- **A-3**: CHANGE-049(設定パス検証)の**射程との重複/非重複**を整理。CHANGE-049 が守る範囲(`database.path`/`logging.file` 設定経由)の**外側**に、未検証の破壊的操作(例: ログローテーション・一時ファイル・将来の export/import の出力先)が無いか。**M13-01 で増える export/import の FS 書込(もしあれば)を見越した注意点**を所見として記す(本サブ時点では export/import 未実装のため将来観点)。
- **A-4**: DB ファイル自体の扱い(`migrate.go`・接続初期化)で、既存 DB を破壊しうる経路(誤 path での上書き・初期化時の DROP 等)が無いかを確認。

### B. 依存ライセンス軽量スイープ(NFR403)

- **B-1**: **`go.mod`(+ `go.sum` の直接/間接依存)の全依存とライセンスを一覧化**。各依存の LICENSE/SPDX を実値で report(MIT/BSD-2/BSD-3/Apache-2.0/MPL/GPL/LGPL/不明 を分類)。**寛容(MIT/BSD/Apache 等)以外**があれば明示。
- **B-2**: **`web/package.json`(dependencies + devDependencies)のライセンスを一覧化**。M13-01/02 で追加見込みの `html-to-image`(MIT)・`pdf-lib`(MIT)も現状の有無を確認。**寛容以外**を明示。
- **B-3**: **本体ライセンス表記の現状**を確認(README・LICENSE ファイル・DES-001 §5)。**DES-001 §5 が旧スタック〔Tauri/Rust/SQLx〕を記載している疑い**(M13-RESEARCH-01-report §F-1 指摘)を実ファイルで裏取りし、現行 Go/Echo スタックとの乖離を**事実として**報告(是正自体は M14 の CHANGE で別途。本サブは事実列挙のみ)。

---

## 5. 報告様式(`M13-RESEARCH-02-report.md`)

- **A**: 破壊的 FS 操作の一覧表(ファイル:行 / 操作 / 対象パス算出元 / 封じ込め判定 / CHANGE-049 射程内外)。封じ込め違反・ユーザ入力由来パスがあれば「要対処」として明示。無ければ「全て管轄内・0 件」と明記。
- **B**: 依存ライセンス一覧(Go / web 各々。依存名 / バージョン / ライセンス / 寛容判定)。寛容以外があれば「要確認」。本体ライセンス表記の現状と DES-001 §5 乖離の事実。
- 末尾に **「配布判定/ M13-01 への含意」**(FS 安全の結論・ライセンス上の懸念有無・DES-001 §5 是正の要否)を集約。

---

## 6. 完了条件(Definition of Done)

- §4 A・B を実コード・実依存ファイルの **view・grep で確認**して報告した。
- パス・関数・依存名・ライセンスを**実値**で報告した(要約/記憶で代替していない)。確認不能は「未確認」と明記。
- 破壊的 FS 操作の**封じ込め判定**と依存ライセンスの**寛容判定**が、配布判定に使える粒度でそろっている。
- read-only を逸脱していない(実装・依存追加・ファイル移動・ビルド/実行がゼロ)。

---

## 7. 参照ドキュメント

- code-facts(`docs/handover/code-facts.md`)§4/§5。DES-002(`docs/design/02-architecture.md`・CHANGE-049 設定パス検証)。DES-001(`docs/design/01-tech-stack.md`)§5(MIT)。CLAUDE.md(`CLAUDE.md`)§10。
- M14-RESEARCH-01-report(`docs/progress/M14-RESEARCH-01-report.md`)§F。followup-backlog(`docs/handover/followup-backlog.md`)§F12-7。phase3-overview(`docs/instructions/phase3-overview.md`)§M13。
- 文書ID ⇄ 実パスの正: docs-map(`docs/handover/docs-map.md`)。

---

## 開発者への確認事項

1. **サブの命名**: `M13-RESEARCH-02` で確定してよいか(phase3-overview §M13・model-allocation の ID 安定。CHANGE 非対象)。暫定案: 前例に倣い確定。
2. **本サブのスコープ**: FS 操作監査 + ライセンススイープの 2 軸を 1 本に束ねた。分離希望があれば分割する。暫定案: 1 本(いずれも軽量)。

---

*以上、M13-RESEARCH-02 調査指示書 v1.0.0。配置 `docs/instructions/phase3/M13-RESEARCH-02-fs-audit-and-license-sweep.md`。本調査の report が配布判定・M13-01 の安全前提の入力となる。*
