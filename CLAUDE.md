# Tacpendium (SF6 Combo Manager) - Claude Code Instructions

> **本ファイルの位置づけ**
>
> このファイルは Claude Code に対するプロジェクト固有の指針を記述した自然言語ドキュメントです。Claude Code は本ファイルを読んだ上で、本ファイルの指針に従って作業します。
>
> 本書は **製造担当 Claude Code が最初に読む** プロジェクト指針です。レビュー担当 Claude Code もレビュー時の前提として参照します。設計・指示書作成担当 Claude(Web 版)は概要把握のため参照してよいですが、設計担当向けの運用ルール(指示書テンプレート・禁則表現・モデル配分等)は `docs/handover/design-instruction-playbook.md` 側にあります。
>
> 機械的に強制したいルール(危険コマンドの拒否、Git操作禁止など)は `.claude/settings.json` に記載されています。本ファイルは「お願いベース」のルール、参照ドキュメント、コーディング規約を扱います。
>
> **<!-- TEMPLATE NOTE -->** で始まるコメントは、本ファイルを別プロジェクトに流用する際に書き換えるべき箇所を示します。各節冒頭の TEMPLATE NOTE が、その節が他プロジェクトへ流用可能か(§4 Go/TypeScript 規約・§5 テスト方針・§6 依存ポリシー・§7 コミット規約・§9 協同方針・§10 危険コマンド等)、本プロジェクト固有で全面書き換えが必要か(§1 概要・§2 技術スタック具体値・§3 ディレクトリ・§8 設計書構成・§11 コマンド・§12 設計書一覧)を示します。

---

<!-- TEMPLATE NOTE: §1 はプロジェクト概要。流用時は本プロジェクト固有の記述を全面的に書き換える -->

## 1. プロジェクト概要

### 概要

ストリートファイター6(SF6)のコンボを管理・比較・共有するための Web アプリケーション。個人 OSS として開発する。SF6 プレイヤーが自分のコンボをデジタルで記録し、状況別・キャラ別に整理し、比較・共有できるツール。

### 開発フェーズ

- 現在のフェーズ: **フェーズ3(共有・協調・入力拡充 → 発信者中心へ舵切り)**。フェーズ1(MVP)は 2026-06-07、フェーズ2(先行リリース準備・M8〜M12)は 2026-06-27 頃に完了
- フェーズ番号は 2026-06-07 の整理工程(CHANGE-020)で 4 フェーズへ再設定済み。各フェーズ定義は REQ-001 §7 を参照
- フェーズ3 のマイルストーン構成(M13〜M23)の正本: `docs/instructions/phase3-overview.md`(v1.0.0 承認済み)
- **現在地(どのマイルストーンまで完了か)は本ファイルに書かない**。`docs/progress/progress-summary.md` を参照すること(本ファイルへのハードコードは陳腐化する。2026-07-02 改善レーンで「フェーズ1完了」のまま放置されていた前例あり)
- 過去マイルストーンの詳細: フェーズ1 は `docs/design/supp-001-detailed-design.md` §4.1、フェーズ2 は `docs/instructions/phase2/` 参照

---

<!-- TEMPLATE NOTE: §2 は技術スタック。プロジェクトに応じて全面差し替え -->

## 2. 技術スタック

### バックエンド

- Go 1.26.4 以上(devContainer / CI は 1.26.8)
- Echo(Web フレームワーク)
- modernc.org/sqlite(SQLite ドライバ、CGO 不要の純 Go 実装)
- log/slog(ロギング)
- gopkg.in/natefinch/lumberjack.v2(ログローテーション)
- github.com/golang-migrate/migrate/v4(マイグレーション、`iofs` + `embed.FS`)
- github.com/BurntSushi/toml(設定ファイル)

### フロントエンド

- React 18 + TypeScript
- Vite(ビルド)
- Tailwind CSS + shadcn/ui(スタイリング)
- TanStack Query(データ取得)
- react-i18next(i18n)
- zod(バリデーション)
- lucide-react(アイコン)

### データベース

- SQLite(WAL モード)

### 配布

- Go embed による単一バイナリ(フロントエンドビルド成果物を同梱)

---

<!-- TEMPLATE NOTE: §3 はディレクトリ構成。プロジェクトに応じて全面差し替え -->

## 3. ディレクトリ構成

詳細は `docs/design/supp-001-detailed-design.md` §5.2(Go 側)および §5.3(フロントエンド側)を参照。

### 概略

```
tacpendium/                            ← リポジトリルート
├── cmd/tacpendium/                    ← Go エントリポイント
├── internal/
│   ├── api/                           ← ハンドラ層(ドメイン別)
│   ├── service/                       ← サービス層(ドメイン別)
│   ├── repository/                    ← リポジトリ層(SQL クエリ集約)
│   ├── model/                         ← ドメインモデル
│   ├── config/                        ← 設定ファイル読込
│   └── infra/                         ← DB 接続、マイグレ実行、netutil 等
├── migrations/                        ← マイグレーション SQL(embed.FS 同梱)
├── web/                               ← フロントエンド
│   ├── src/
│   │   ├── pages/                     ← 1 画面 = 1 ファイル
│   │   ├── features/<feature>/        ← 機能別の状態・ロジック
│   │   ├── components/                ← 汎用 UI(Header / Footer もここ。`layouts/` は無い)
│   │   ├── lib/                       ← API client、i18n、定数等
│   │   ├── constants/                 ← バックエンド列挙定数と同期する定数(§4)
│   │   └── types/                     ← API 型定義(手書き)
│   └── e2e/                           ← Playwright E2E spec(§5)
├── docs/
│   ├── design/                        ← 設計書一式
│   ├── handover/                      ← 引継ぎ資料
│   ├── instructions/                  ← マイルストーン別指示書
│   ├── progress/                      ← 進捗ログ
│   └── change-notes/                  ← 設計変更通知書
│   └── postmortem/                    ← 開発者の各工程の反省資料、Claudeは確認しなくて良い
├── go.mod / go.sum
├── Makefile                           ← M1 で作成
└── README.md
```

---

## 4. コーディング規約

<!-- TEMPLATE NOTE: §4 のうち Go と TypeScript の規約は他プロジェクトでも流用可能 -->

### Go

- [Effective Go](https://go.dev/doc/effective_go) 準拠
- エラーは必ず wrap する: `fmt.Errorf("...: %w", err)`
- サービス層のメソッドは第一引数に `context.Context` を取る
- 命名: パッケージ名は短く小文字、型名は PascalCase、関数は CamelCase
- 公開 API(大文字始まり)には godoc コメントを必ず付ける
- パニックは原則使わない(回復不能な初期化エラーのみ可)
- **JSON タグは camelCase で統一**: `json:"userId"` / `json:"comboId"` / `json:"recipeCache"` のようにキャメルケースで記述する。DB カラム名(snake_case、`db:"user_id"` 等)とは命名規則を分離する。例: `UserID int64 \`json:"userId" db:"user_id"\``。M1-02 / M1-03 でフロント側の TypeScript 型と整合させるため camelCase に統一されており、本規約はそれを明文化したもの
- **列挙的文字列定数はパッケージ定数として定義**: 例 `model.TagCategoryMyComboStatus = "mycombo_status"`。リテラル文字列を複数箇所に散在させない。フロントエンド側でも対応する定数を作成して同期する(下記 TypeScript セクション参照)

### TypeScript

- `strict` 有効、`any` は原則禁止
- 関数コンポーネント + Hooks のみ。class コンポーネント禁止
- 命名: コンポーネントは PascalCase、フックは `useXxx`、定数は SCREAMING_SNAKE_CASE
- import 順: React → サードパーティ → エイリアスパス(`@/`) → 相対パス。**検査**: `bash scripts/check-import-order.sh`(ベースライン固定型)。**★型検査は import 順を見ない**——`M24-08` が `queryKeys` の import を「最後の import 行の直後」へ一括挿入して 27 ファイルを規約外にしたとき、`tsc` もテストも E2E も何も言わなかった
- **API DTO 型は camelCase で統一**: バックエンド JSON タグと対応させ、`interface Tag { id: number; userId: number; recipeCache?: string; }` のようにキャメルケースで定義する。DB カラム名のスネークケースをフロントに持ち込まない
- **バックエンド列挙定数との同期**: バックエンド `internal/model/` で列挙的文字列定数(`HitTypeNormal = "normal"` 等)を定義したら、フロント側にも対応する定数を `web/src/constants/` 配下へ作成して参照する。リテラル文字列を画面側へ散在させない。新規列挙値の追加時は両側を同期する。**検査**: `bash scripts/check-enum-sync.sh`(既定は warning。指示書執筆時の運用ルールは playbook §4.8)
- **コンボ型の 3 分岐**(`ComboSummary` / `ComboDetail` / `Combo`)は別 interface だが、バックエンド `ComboResponse` は同一型。**フィールド追加時は該当する全 interface へ追加が必要**。詳細は `web/CLAUDE.md` §2
- **ブラウザストレージ API は機密情報・DB 永続化対象データに使用しない**。許容範囲は §10.X、許容キーの台帳は `web/CLAUDE.md` §1

### 共通

- マジックナンバー・マジックストリングは定数化
- TODO コメントは `// TODO(<対応予定>): <内容>` 形式で書く(放置厳禁)
- 不要なコメントアウトコードは削除する(Git 履歴で復元できる)

---

## 5. テスト規約

<!-- TEMPLATE NOTE: §5 のテスト方針は SUPP-001 §5.5 で確定済み。他プロジェクトでは方針を再決定 -->

詳細は `docs/design/supp-001-detailed-design.md` §5.5 参照。

| レイヤー | テスト方針 |
|----------|-----------|
| サービス層(Go) | **必須**。ビジネスロジック網羅 |
| リポジトリ層(Go) | 複雑なクエリのみ |
| ハンドラ層(Go) | 正常系 + 主要異常系のみ。`httptest` 使用 |
| フロント純粋関数 | **必須** |
| フロントコンポーネント | 主要ロジック持ちのみ。Vitest + React Testing Library |
| フロントページ | 原則テストしない(主要フローは E2E でカバー) |
| E2E(Playwright) | **導入済み**(`web/e2e/`・全数は `make e2e` ／ **絞り込みは `make e2e-only P=<パターン>`**。★絞り込みで `playwright` を直接叩かないこと＝§11)。使い捨て DB + 専用ポート(バックエンド 47390 / Vite 5273)の独立スタックで実行され、dev DB・dev サーバに影響しない。新規 spec は `/add_e2e_spec` 参照 |

- テストファイル命名: Go は `*_test.go`、TypeScript は `*.test.ts` / `*.test.tsx`
- カバレッジ目標は設定しない(重要ロジック網羅優先)

---

## 6. 依存ライブラリ追加ポリシー

<!-- TEMPLATE NOTE: §6 のライセンス条件は MIT プロジェクト前提。他プロジェクトでは調整 -->

詳細は `docs/design/supp-001-detailed-design.md` §5.7 参照。

### 許可ライセンス

MIT / Apache-2.0 / BSD-2-Clause / BSD-3-Clause / ISC / Unlicense / Public Domain / CC0

### 禁止ライセンス

GPL / LGPL / AGPL / CC BY-SA / 独自プロプライエタリ / デュアルライセンス(GPL or 商用)

> **★★本節は inbound（取り込む依存のライセンス）の規定である**(2026-09-06 開発者承認・`D-764`。`M26-02` 由来＝`D-746`)。
>
> **★本体を何のライセンスで配るか(outbound)は別の話であり、本節は縛らない。** 本体は三層で配る〔A＝`AGPL-3.0-or-later`(既定) / B＝`CC-BY-SA-4.0`(SF6 の事実) / C＝`MIT`(AI 運用のルールとスクリプト)。**正本は `REUSE.toml`**〕。
>
> **⇒ 本体が AGPL であることは、上の禁止列に反しない。★禁止列は 1 行も変えない**——**AGPL / CC BY-SA の依存を取り込むことは引き続き禁止である。**
>
> **★★ただし帰結が 1 つある**——**outbound を AGPL にすると、inbound の許容範囲は原理的には広がる**〔LGPL / MPL / GPL-3.0 が取り込めるようになる〕**。★本プロジェクトはポリシーを据え置く。⇒ 広がった事実だけを書き、許可列は増やさない。**

### 条件付き

MPL-2.0: **原則不使用、代替がない場合のみ開発者確認の上で採用**

### 追加ルール

- **新規依存追加は必ず開発者に提案してから進める**(メジャーライブラリ推奨済みのものを除く)
- **★★版を固定する仕組みの導入も本項に当たる**(2026-09-06 開発者裁定・`D-764`。`M28-03` 由来＝`D-750`)。**対象＝`web/package.json` の `pnpm.overrides` / `go.mod` の `replace` / `go.mod` の `toolchain` 行。** **★「新しい依存は増えていない」は理由にならない**——**版を固定した時点で、そのモジュールの更新を止める判断を本体が持つ。⇒ 誰かが解除しない限り、固定は永続する。** **⇒ 固定する前に提案する**(先例＝`nwsapi` の `>=2.2.26 <2.3.0`・`M28-03`。**事後に開発者が承認した**)。 **★★固定を「いつ・どういう経緯で解除するか」は `docs/process/dependency-pin-ops.md` が正本である。**
- **★`go.mod` の indirect → direct 昇格も本項に当たる**(2026-08-14 開発者裁定)。**「モジュールは既に依存グラフに居た」「`go.sum` は不変」は理由にならない**——**直接依存にした時点で、そのモジュールの API に本体が縛られ、以後の更新・撤去の判断が本体の責任になる。** **⇒ 昇格させる前に提案する**(先例＝`golang.org/x/text`・`M20-07`。**事後に開発者が承認した**)
- 重複機能ライブラリは導入しない(例: lodash の代替で ramda は不要)
- 最終更新が 2 年以上前のライブラリは原則不使用
- 依存追加時は `go.mod` / `package.json` への記載と同時に、選定理由を `docs/progress/progress-log.md` に記録

---

## 7. コミット規約

<!-- TEMPLATE NOTE: §7 は Conventional Commits 採用。他プロジェクトでも流用可。ただし「コミット系のみ許可」の運用は本プロジェクト固有の緩和方針(2026-06-11)。流用先では settings.json の allow/deny と整合させること -->

- **作業の節目でチェックポイントコミットを切る**: マイルストーン内の論理的な区切り(機能単位の実装完了、テスト追加、リファクタリング完了等)でこまめにコミットし、事故時に直近の健全な状態へ戻せる粒度を保つ。
- コミットメッセージ規約は **Conventional Commits 形式**: `feat:`、`fix:`、`refactor:`、`test:`、`chore:`、`docs:`、`style:`、`perf:`
- スコープはマイルストーン or ドメイン: `feat(M1/combo): add combo list API`
- 日本語メッセージ可(個人 OSS のため)
- メッセージ末尾の Co-Authored-By 等の付与有無は開発者方針に従う。

**許可される Git 操作はコミット系のみ**: Claude Code が直接実行できるのは `git status` / `git diff` / `git log` / `git add` / `git commit`(および参照系の `git show` / `git branch` / `git remote`)に限る。push / merge / rebase / reset / checkout / restore / clean / tag / rm 等の履歴改変・破壊的操作は **すべて開発者が行う**(`.claude/settings.json` の `deny` で機械的にも禁止)。コミットしても push は原則禁止のためリモートへは反映されない。
例外(2026-07-20): `claude/` 名前空間ブランチへの push のみ機械許可(クラウド実行の作業領域。正史 main への反映は引き続き人間のマージのみ)。詳細は `docs/process/remote-ops.md` §6。

---

## 8. 設計書との関係

<!-- TEMPLATE NOTE: §8 は本プロジェクトの設計書構成に依存。他プロジェクトでは差し替え -->

### 参照優先順位

1. 本ファイル(CLAUDE.md)に記載の指針
2. `docs/design/` 配下の設計書(REQ-001、DES-001〜006、SUPP-001)
3. `docs/instructions/` 配下のマイルストーン別指示書

### 設計書間の矛盾を発見した場合

実装を止めて開発者に確認すること。設計書間で矛盾があると思われる場合、Claude Code が独自判断で解釈を選んではいけない。

### 製造工程で設計書の変更が必要な場合

`docs/change-notes/CHANGE-XXX-<内容>.md` を作成して開発者に通知する。設計書本体は Claude Code が直接編集しない(設計担当 Claude が別チャットで対応)。

### 製造工程で発見された課題・TODO

`docs/progress/progress-log.md` に記録する。設計書を直接汚さない(完成版の「あるべき姿」を保つため)。

**同書は横断インデックスである**(2026-08-11 開発者裁定④)。1 サブにつき **日付・作業 ID・結果・報告書リンク ＋ 完了報告に書けない横断課題**だけを置き、E2E 手順・curl 出力・実装の細部は**完了報告が正本**。**サブ完了時の追記は必須**で、手順は製造 CLI 側にある(`implement_plan` §完了時 ／ `implement_plan_full` Phase D ／ `incorporate_plan`)。**指示書が明示的に求めていなくても追記する**——指示書テンプレート側にしか要求が無かった期間に M19-04b / 04c / 04d で実際に落ちたため CLI 側へ二重化してある。

**検査**: `bash scripts/check-progress-log-index.sh`(完了報告に対応する追記の欠落と、CLI 側の手順の消失を検出)

### 常設の機械検査(まとめ)

規約の多くは機械検査を持つ。**迷ったら回す。**

| 検査 | 何を見るか |
|------|-----------|
| `scripts/check-artifact-integrity.sh` | **★1 本目に回す。** 各検査の対照が実際に走った証拠と、派生資料の生成物健全性。**他の検査が緑でも、その緑が信用できるとは限らない** |
| `scripts/check-stop-discipline.sh` | §9 停止規律。§J の必須 5 フィールドと 4 ファイルのマーカー |
| `scripts/check-progress-log-index.sh` | §8 progress-log への追記の欠落 |
| `scripts/check-completion-report-md-emphasis.sh` | 完了報告の閉じない強調チェック手順(`D-775`)が消えていないか。**製造 CLI 4 本の `<!-- COMPLETION-REPORT-MD-EMPHASIS -->` ＋ 指示書テンプレート §7.4 の本文**。**★上 2 本と同じ「マーカーの存在を見る」型である**——**`docs/progress/` は常時走査の対象外であり、手順が消えれば誰も見なくなる。★テンプレートだけはマーカーを持たない**(実測。**一度も入っていない**)**ため本文パターンで見る** |
| `scripts/check-instruction-format.sh` | 指示書の版数一致と禁則表現(playbook §4.1) |
| `scripts/check-doc-refs.sh` | ルール面ファイルの dead file reference |
| `scripts/check-browser-storage-keys.sh` | §10.X ブラウザストレージ台帳と実装の一致 |
| `scripts/check-third-party-attribution.sh` | **来歴の軸**（`REUSE.toml` の (6)＝第三者が著作権者であるもの）**の宣言が実態と合っているか**。**★三層は「何の内容か」で切る軸であり「誰の著作物か」では切らない**（2026-09-20・`M40-01`）**。⇒ 第三者素材は放っておくと既定の層 A へ落ち、`© plexiblinp / AGPL` と宣言される。★グロブが 1 件も当たらなくなったら赤**（`D-777` の一般形＝ファイルを動かすと宣言が黙って外れ、外れた先が既定なので他の検査は緑のまま）**／ `NOTICE` の帰属の逐語と件数が実態とずれたら赤**（`web/src/components/ui/` にファイルが増えたのに帰属が古い、を捕まえる）**。★宣言されていない第三者素材が*新しく持ち込まれた*ことは検出できない**——**そこに oracle は無い。⇒ 人か外部スキャン**（SCANOSS）**の仕事である** |
| `scripts/check-enum-sync.sh` | §4 列挙定数の同期(warning・ベースライン固定型) |
| `scripts/check-import-order.sh` | §4 **import 順**(React → サードパーティ → `@/` → 相対)。**区分の後退**を数える・ベースライン固定型。**★`M24-08` が 27 ファイルを静かに規約外にした穴**(`import-order-unchecked`) |
| `scripts/check-md-emphasis.sh` | Markdown の**閉じない強調**(`**A（B）**は` の形。**`**` の個数が偶数のまま壊れるため、偶数チェックでは検出できない**)。CommonMark 実装で 1 行ずつ描画して判定・ベースライン固定型。**★`docs/progress/` は常時走査の対象外である**——**完了報告・レビュー報告は歴史記録として書き換えないため、床だけが上がって誰も直せない状態になっていた。⇒ 書いた本人が、その手番で自分の新規ファイルだけをファイル引数モード(`bash scripts/check-md-emphasis.sh <file>`)で見る**(2026-09-07・`D-775`。手順は製造 CLI 4 本と指示書テンプレート §7.4 の `<!-- COMPLETION-REPORT-MD-EMPHASIS -->` にある) |
| `scripts/check-derived-docs.sh` | 派生資料(code-facts / docs-map / retrospective-digest / custom-commands)の鮮度と**源泉の変化量**。**情報提供(常に exit 0)** |
| `scripts/check-doc-inventory.sh` | §10「既存運用の型に無いファイルの新設」。docs 直下 4 ディレクトリを走査。**情報提供(常に exit 0)・ベースライン固定型** |
| `scripts/check-release-archive.sh` | 配布アーカイブ(`dist/release/`)の**中身**。正本 `scripts/release-targets.sh` から引いた実行ファイル ／ `README.txt` ／ `manual/tacpendium-readme.html`(サイズ非 0) ／ `manual/images/`(ディレクトリの存在のみ・枚数は見ない) ／ 追加同梱物(`RELEASE_EXTRA_FILES` の全件・パス保持) ／ `.sha256` 照合(在るときだけ)。**「あるべきものが在るか」で見て「それしか無いか」では見ない**。`--self-test` で陽性 6 ・陰性 5 の対照。**★`make release-archives` の後に回す**(`dist/release/` が無ければ exit 2・個別の欠落は exit 1)。**exe が動くか・README の文面が実態と合うかは見ない** |
| `scripts/check-manual-images.sh` | **★リリースの門**(`M36-02`・射程 1)。配布する操作説明書の `img` の参照先が**全数実在するか**。**★「PNG が 0 枚でないか」では見ない**——**1 枚でも在れば通ってしまう**(`D-890` の逐語)。⇒ **参照 1 件ごとに実体を見る**。走査は説明書ディレクトリ直下の `*.html` 全数(名前を列挙しない＝`D-886`。**クイックスタートも母集団に入る**)。参照 0 件・`<img` と `src="` の件数不一致・絶対パス・空ファイルも赤。`--self-test` で陰性 3 ・陽性 6 の対照。**★`make release-archives` は塞がない**——門は `.github/workflows/release.yml` に在る(**開発中に組めなくなるのを避けるため**＝指示書 §3-2)。**図の中身が正しい画面かは見ない** |
| `scripts/check-dist-readme.sh` | 配布 `README.txt` が正本 `docs/usermanual/dist-readme.txt` から生成した内容と一致するか(既定は照合・`--write` で生成)。**★2026-09-19(`M36-02`・射程 7)に「`RELEASE_TARGETS` の 1 列目(アーカイブ名)が `README.txt` に全数現れる」を足した**——**それ以前は「正本の内容が正しいかは見ない」と自ら宣言しており、`M38-03` の改名が実際にその穴を踏んだ**(`dist-readme-archive-name-unlinked`)。`--self-test` で陰性 2 ・陽性 2 の対照。**★実行ファイル名(2 列目)はまだ機械で結ばれていない**(同じ型の写し。限界へ明記済み) |
| `scripts/generate-release-notes.sh` | **生成器**(`M36-02`・射程 6)。リリースページ本文を組む。**★SHA-256 の手順は正本 `docs/usermanual/dist-readme.txt` から*抽出*し、アーカイブ名は `scripts/release-targets.sh` から引く**——**手で 2 か所に書かない**(`E-76`)。**★抽出が空振りしたら黙って短い本文を出さず exit 2 で止まる**(検証手順の無いリリースページを出さないため)。`--self-test` で陰性 4 ・陽性 2 |

> **`check-derived-docs.sh` は本表に載っていなかった**(2026-08-11 是正)。**その結果、回すきっかけが「マイルストーン境界の起動キット生成」だけになっていた**——M18/M19/M14 残りを並列で進めた期間は境界が来ず、派生資料が長期間止まって**設計卓が「完全に陳腐化した」と誤解し、資料を使わなくなる実害が出た**。
>
> **★「源泉が新しい」は資料が丸ごと無効という意味ではない。** 同スクリプトは**変化量**(例 `10 / 875 件(1%)`)を出す。小さければ**変わった領域だけ実物で確認し、他の節はそのまま使う**。生成日だけを見て捨てると、`code-facts` を引かずに想定で書く状態へ逆戻りする(retrospective-log §1 パターン A/C = 最頻出ミス)。
>
> **★`code-facts.md` は設計卓の武装中には再生成できない**(実装ソースが作業ツリーに無いため。`generate-code-facts.sh` が **exit 2 で停止し、上書きしない**)。再生成が要るときは武装していないセッション(製造・改善)か開発者へ回す。`docs-map` は `docs/` のみを読むので武装中でも再生成できる。

> **`check-doc-inventory.sh` の読み方**(2026-08-13 新設)。**出力は違反の宣言ではなく「新種のファイルが増えた」通知である。** 型に合っていることは「置いてよい」の証明ではない——**新種を見つけるための床**にすぎない。
>
> **★例外表(EXCEPT)へ足して黙らせるのは、開発者の承認を得たときだけにすること。** 検査を通すために足すと、本検査は存在しないのと同じになる。**「運用として定着した型」だけを TYPES へ昇格させる**(1 回きりの資料を型にすると、以後は何も検出しなくなる)。
>
> **★orphan(参照ゼロ)検出は採らなかった**。滞留していたファイルはいずれも複数箇所から参照されており、**参照元が「これは消す予定」という行だった**。**参照されている ≠ 生きている。**

---

## 9. 協同方針

<!-- TEMPLATE NOTE: §9 は HANDOVER-001 の方針。他プロジェクトでも流用可 -->

### 登場人物と宛先

各担当の責務・入出力・裁量・宛先の正本は `docs/handover/roles-and-routing.md`。
誰に聞くか・何を自分で決めてよいかは同書のハード列で判断する。
呼称の揺れ(製造担当/実装担当 等)も同書の吸収表で解決する。

### 不明点が発生した場合の扱い

**原則は「止めて聞く」ではなく「進めて報告する」**(roles-and-routing 共通原則1。2026-08-10 開発者裁定)。

1. `roles-and-routing.md` の **ハード列**(ユーザー体験に影響 / 拡張性に関わる / 正解がなく好みが決め手 / 開発者のドメイン知識が要る / スキーマ・データの破壊的変更・公開・課金 / 設計担当宛)に該当するものだけを **開発者へ回す**
2. ハード列に該当しない実装詳細は **自己判断で進めてよい**。ただし検討した複数案と選定理由を報告に含める(共通原則3)
3. 推測で進める場合は **「推測:〜と仮定した」** とコード内コメントまたは出力メッセージで明示する
4. 設計書の「実装時協同で決定」と書かれた事項は **必ず開発者確認**(ハード列扱い)

> **本節より優先されるもの**: §8「設計書間の矛盾を発見した場合は実装を止めて開発者に確認」と §10 の禁止事項は、上記の「進めて報告する」原則に **優先する**。矛盾・禁止事項に触れる場合は止めること。

### Plan Mode の活用

本プロジェクトでは、以下のケースで Plan Mode を必須とする。

- 複雑ロジックを含む指示書(指示書ヘッダで「Plan Mode: 必須」と明示されたもの)
- 全体に影響するリファクタリング
- スキーマ・API 契約・データ移行を伴う変更

> 旧版は「M0(プロトタイプ段階)の全指示書」「M1(コア基盤)の全指示書」を挙げていたが、**両マイルストーンは 2026-06-07 のフェーズ1 完了で終了済み**であり、現行フェーズの判断条件として機能していなかった(2026-08-10 是正)。マイルストーン番号ではなく**変更の性質**で判定する。

Plan Mode で計画を提示後、開発者の承認を待ってから実装に入ること。

### 推奨モデル

指示書ヘッダの「推奨モデル」に従う。基本方針は SUPP-001 §6.1 を参照。

### 停止規律

<!-- STOP-DISCIPLINE -->

上限(**再レビュー往復上限 2 回** / タイムボックス / 開発者の終了指示)に達したら、未解消項目を**必須 5 フィールド**(ID／発生元／未解消の理由／再開に必要な条件／記録日・状態)付きで記録し、**直ちに停止する**。

**★★★記録先は担当で分かれる**(**2026-09-12 変更＝`D-838`**)。

| 担当 | 記録先 |
|---|---|
| **製造・レビュー・取り込み** | **設計伝達レポート §4 へ「§J 行の原稿」として書く**。**⇒ `followup-backlog.md` は 1 文字も編集しない** |
| **設計卓** | `docs/handover/followup-backlog.md` **§J 停止時記録**へ直接書く。**⇒ 製造の原稿を受理の手番で転記するのも設計卓である** |

**★★原稿を残せば停止規律を満たす。⇒ 記録はレポートに在り、製造ブランチにコミットされている。★場所が違うだけであり、durable であることは変わらない。**

> **★★★なぜ一本化したか**(`D-838`)——**旧運用は製造にも §J への直接追記を許していたが、`followup-backlog.md` は設計卓と製造が書く唯一の共有ファイルであり、マージのたびに衝突した。**
>
> **★`D-828` は「設計卓が未マージの変更を持つときだけ製造は書かない」という条件付きの回避を試みたが、成立しなかった**——**製造は取り込み系の git 操作も `mcp__*` もすべて `deny` であり、その条件を評価する手段が無い。⇒ 評価できない条件を持つ規則は規則ではない。**
>
> **★★しかも設計卓は受理のたびに §Cx 節を書くため、実際にはほぼ常に未マージの変更を持っている。⇒ 例外がほぼ常時発動し、`D-382` の §J カーブアウトは実質無効であった。**
**記録して停止することは失敗ではなく正規の完了形式である**。記録せずに完成度の追求を続けることが規律違反にあたる。「これが最後」の指示を受けたターンでは、新たな完成度向上を開始せず残項目の記録に切り替える。
検査: `bash scripts/check-stop-discipline.sh`。

---

## 10. 禁止事項

<!-- TEMPLATE NOTE: §10 のうち、Git/危険コマンドは settings.json で機械強制済み。本ファイルは補助的な文言化 -->

### 実装関連(機械強制不可、CLAUDE.md で警告)

- 設計書に記載のない機能を勝手に追加しない
- ライブラリの大量追加(§6 参照)
- セキュリティ関連の自己判断(パスワードハッシュアルゴリズム変更等)
- データ破壊の可能性があるマイグレーション(カラム削除等)を事前確認なしで実行
- ブラウザストレージ API(`localStorage` / `sessionStorage` / `IndexedDB`)を、機密情報・DB 永続化対象データの保管に使用すること(§4 TypeScript 規約および §10.X の運用ルールを参照)
- `console.log` / `fmt.Println` を本番コードに残す(テストコード・開発時デバッグは除く)
- 不要な `eslint-disable` / `nolint` の濫用
- **既存運用の型に無い恒久ファイルを、開発者の承認なしに `docs/` へ新設すること**(§10.Y。作業用に作ったつもりのファイルが永続化する)

### Git 操作(機械強制あり: `.claude/settings.json` で `allow` / `deny`)

- **許可**: `git status` / `git diff` / `git log` / `git add` / `git commit`(コミット系)、および参照系の `git show` / `git branch` / `git remote`。チェックポイントコミット運用(§7)のため commit のみ緩和済み(2026-06-11)。
- **禁止(deny で機械強制)**: merge、rebase、reset(`--hard` 含む全モード)、checkout、switch、restore、clean、tag、revert、cherry-pick、stash、rm、pull、fetch、clone、config 等。これらは **すべて開発者が行う**。
- push は `claude/` 名前空間ブランチのみ機械許可(2026-07-20 例外)、それ以外への push は都度確認で原則実行しない。MCP ツール(`mcp__*`)・`gh pr merge`・`gh api` は deny(Bash と別経路で main へ書けるのを防ぐ)。詳細は `docs/process/remote-ops.md` §6。
- Claude Code は上記コミット系以外の Git 操作については変更提案に留め、コマンドを直接実行しない。
- ブランチ作成・切替も開発者が行う(例外: 開発者から明示的に指示された場合のみ)。
- コミットは許可されるが、**push は禁止**のためリモートへは反映されない。リモート反映・履歴整理は開発者が行う。

### 危険なシェル操作(機械強制あり: `.claude/settings.json` で `deny`)

本 CLAUDE.md は devContainer での開発を前提とするが、ホスト OS でも流用される可能性があるため、devContainer 内でも以下を制限する。

- `rm -rf /` 系の致命的削除
- `chmod 777` の再帰適用
- `dd if=/dev/* of=/dev/*` でのデバイス書き込み
- `mkfs.*` のファイルシステム作成
- `curl ... | bash` / `wget ... | sh` の外部スクリプト直接実行
- `sudo` の使用
- `.env` / `secrets/` / `~/.ssh/` 配下のファイル読取・変更
- データベースファイル(`*.db`)の直接削除(マイグレーションの down 実行は可)

### 本ルールの目的

本 §10 の禁止事項は、以下を防ぐことを目的としている。Claude Code は迷った際にこの目的に立ち返って判断すること。

- **アプリ外のファイル・システムへの破壊的変更の防止**: ユーザーの PC 内の他ファイル削除、デバイス書き込み、システム改変等
- **機密情報の漏洩防止**: パスワード・認証情報・SSH 鍵等の取扱い
- **データの不可逆な破壊の防止**: ユーザーが登録したコンボ・タグ・プリセット等の意図しない消失
- **トレーサビリティの確保**: Git 履歴を介したコード変更管理の維持。コミット(履歴への追記)は Claude Code にも許可するが、履歴改変(reset/rebase 等)・リモート反映(push)は開発者に限定することで管理を維持する

ルール本文と上記目的に乖離が生じた場合は、ルール本文を優先しつつ開発者に報告すること。例えば「目的上は問題ないがルール本文に明記されていない操作」が必要になった場合、Plan Mode で開発者に確認する。

### §10.X ブラウザストレージの許容範囲

§4 TypeScript 規約および §10 実装関連の禁止事項で言及した「ブラウザストレージ API」の規則。

- **禁止用途**: ユーザー識別情報・認証情報・パスワードハッシュ等の機密情報 ／ 本来 DB に永続化すべきユーザー入力データ(コンボ本体・タグ・プリセットエイリアス・セットプレイ等)
- **許容用途**: 設計書本体で明記された UI 状態保持のみ。許容キーは **`web/CLAUDE.md` §1 の台帳**が正本(用途・設計書根拠・localStorage/sessionStorage の別・実装状態)
- **台帳に未記載の UI 状態**を保持する必要が生じたら、CHANGE 通知書(または CHANGE addendum)経由で台帳へ追記してから使う。実装を先行させた場合も必ず addendum で通知して台帳へ反映する(未記載のまま運用しない)
- 実装ガイドライン(専用ヘルパ `web/src/lib/browser-storage.ts` 経由・try-catch 必須・キーバージョニング・JSON シリアライズ)も `web/CLAUDE.md` §1

**検査**: `bash scripts/check-browser-storage-keys.sh`(台帳未記載キーの使用と、台帳の実装状態のズレを検出)

### §10.Y `docs/` へのファイル新設(2026-08-13 開発者要求)

**新しいファイルを作る前に、継続更新ファイルへ「行として」足せないかを先に検討する。**

| 足す先 | 何を置くか |
|---|---|
| `docs/handover/followup-backlog.md` §J | 未解決事項・停止時記録・「あとで判断する」。**★★★書けるのは設計卓だけである**(**2026-09-12 変更＝`D-838`**。**旧運用では製造も §J へ直接追記できたが、共有ファイルの衝突が繰り返されたため一本化した**)。**⇒ 製造は停止時記録も設計伝達レポート §4 へ原稿として書く**(`CLAUDE.md` §9)。**本表への登録は設計伝達レポート §4 へ候補を書き、設計卓が畳む**(理由＝同ファイルは設計卓と製造が書く唯一の共有ファイルであり、両方が既存行を編集するとマージが競合する) |
| `docs/progress/progress-log.md` | 製造工程で発見した課題・判断・実測(§8) |
| `docs/process/parallel-board.md` | 裁定・保留・レーン状況(設計卓) |

行として足せない場合のみ、新しいファイルを作る。そのとき:

- **既存運用の型に合っているなら、そのまま作ってよい**(型の一覧は `bash scripts/check-doc-inventory.sh --list-allow`)
- **型に無い恒久ファイルは、開発者の承認を得てから作る。** 承認なしに `docs/` 直下へ新種を置かない
- **その場の作業用に作ったファイルは、置き場と寿命を決めてから作る。** 決めずに作ったものは、**役目を終えても誰も消さないまま残る**——`m19-desk-status.md` は §0 で寿命を宣言し、ボード P-24 が「削除の前提は満たされた」と記録してなお残っていた(2026-08-13 実測)

**★「消す」変更は開発者の手番**(D-196 境界条件 3)。Claude ができるのは**候補と根拠を出すこと**と、**仕分け済みの置き場へ移すこと**(`docs/handover/phase{N}/` ／ `docs/*/archive/`)までである。

**検査**: `bash scripts/check-doc-inventory.sh`(型に無いファイルを検出。**常に exit 0 の情報提供型**。読み方は §8 の注記)

---

## 11. 実行環境・コマンド

<!-- TEMPLATE NOTE: §11 はプロジェクト固有。他プロジェクトでは差し替え -->

### 開発時に頻用するコマンド

```bash
# バックエンド開発サーバー
go run ./cmd/tacpendium

# フロントエンド開発サーバー
cd web && pnpm run dev

# ビルド(M1 で Makefile 作成後)
make build

# テスト
go test ./...
cd web && pnpm test

# E2E(全数)
make e2e

# E2E(絞り込み)。★`pnpm exec playwright test <pattern>` を直接叩かないこと ——
# `PW_EXECUTABLE_PATH` が渡らず、UI を使う spec が
# `Executable doesn't exist ...` で全滅する(M24-09d / D-599)。
make e2e-only P=combo-crud
make e2e-only P="m24-13 -g 保存"

# デバッグビルド(debug API を有効化)
go build -tags=debug -o tacpendium ./cmd/tacpendium
```

**パッケージマネージャ:** フロントエンドのパッケージ管理は **pnpm 9.13** を使用する(npm/yarn は使わない)。`web/package.json` に `"packageManager": "pnpm@9.13.x"` フィールドが設定されている。`web/pnpm-lock.yaml` がコミット対象、`package-lock.json`/`yarn.lock` は `.gitignore` で除外。`npx` の代わりに `pnpm dlx` を使うこと。

### マイグレーション

アプリ起動時に自動適用(`golang-migrate` を `internal/infra/migration/` 経由で実行)。

### 参照系コマンドの事前許可

`awk`、`sed`、`sort`、`uniq`、`cut`、`tr`、`xargs`、`jq`、`ps`、`tee`、`column`、`go version`、`go env` 等の参照系コマンドは `.claude/settings.json` の allow リストに登録済み。これらは承認なしで実行できる。承認プロンプトが続く場合は settings.json の allow リストの不足を疑い、`/fewer-permission-prompts` スキルを実行して洗い出すこと。

---

## 12. 参照ドキュメント

<!-- TEMPLATE NOTE: §12 は本プロジェクトの設計書一覧。他プロジェクトでは差し替え -->

| ID | ファイルパス | 内容 |
|----|-------------|------|
| REQ-001 | `docs/design/requirements.md` | 要件定義書 |
| DES-001 | `docs/design/01-tech-stack.md` | 技術スタック選定書 |
| DES-002 | `docs/design/02-architecture.md` | アーキテクチャ設計書 |
| DES-003 | `docs/design/03-data-model.md` | データモデル設計書 |
| DES-004 | `docs/design/04-notation-spec.md` | 内部表現仕様書 |
| DES-005 | `docs/design/05-screen-design.md` | 画面設計書 |
| DES-006 | `docs/design/06-validation.md` | バリデーション設計書 |
| **SUPP-001** | `docs/design/supp-001-detailed-design.md` | **設計補足資料(本ファイルが最も多く参照)** |
| HANDOVER-001 | `docs/handover/phase1/handover_1.md` | 引継ぎ資料(プロジェクト全体像、フェーズ1 アーカイブ) |
| 指示書 | `docs/instructions/M××-NN-*.md` | マイルストーン別指示書 |
| 進捗ログ | `docs/progress/progress-log.md` | 製造工程の進捗・課題 |

---

*以上*
