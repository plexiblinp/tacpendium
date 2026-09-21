# 指示書 M5-RESEARCH-01: コンボ比較画面着手前の前提調査(調査専用、read-only)

| 項目 | 内容 |
|------|------|
| 指示書ID | M5-RESEARCH-01 |
| バージョン | 1.0.0 |
| 推奨モデル | Sonnet 4.6 |
| Plan Mode | 任意(調査内容に迷ったら使う) |
| 機械レビュー | 不要(調査指示書、実装変更を伴わない) |
| 並列性 | 単独 |
| 依存指示書 | なし |
| 想定所要時間 | 30〜45 分 |
| 作成者・作成日 | 設計担当 Claude(M5 期間担当)、2026-05-23 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-23 | 初版作成 |

---

## 0. この指示書の特殊性(最初に読むこと)

### 0.1 本指示書は「製造担当として起動し、調査だけ実施して閉じる」運用です

本指示書は通常の製造指示書(`M{N}-{NN}-*.md`)とは異なり、**コード変更・ファイル新規作成・テスト実行を一切行いません**。M5 比較画面の指示書を設計担当が確定するための前提情報を、コードベースから事実列挙形式で抽出することだけが目的です。

製造担当 Claude Code セッションを Sonnet 4.6 で起動し、本指示書に従って調査レポートを作成・出力したら、そのセッションは閉じます(製造作業は行いません)。

### 0.2 read-only 厳守

以下を **絶対に行わない** こと:

- ファイルの新規作成・編集・削除(調査レポート出力以外)
- `git` コマンド(`git status` 等の参照系も含めて、本指示書では使わない)
- `go build` / `go run` / `pnpm build` / `pnpm test` 等のビルド・テスト実行
- マイグレーション実行(`go run ./cmd/combomgr` でアプリを起動しない)
- npm / pnpm の install 系コマンド
- 設定ファイルの変更
- `rm`、`mv`、`cp` 等のファイル操作

使ってよいツールは **`view` / `bash`(grep / cat / ls / find / wc 等の参照系のみ)** に限定します。`view` で複数ファイルを横断的に読むことが本作業の中核です。

万一実装変更が走った場合は開発者がロールバックします。判断に迷ったら何もせずに **Plan Mode で開発者に確認** してください。

### 0.3 判断・提案を含めない

調査結果は **事実の列挙のみ** とし、「こうするべき」「こちらが推奨」のような判断・提案を含めないでください。判断は設計担当 Claude が調査結果を受けて行います。

ただし、調査中に発見した **明らかな矛盾・想定外の事象** は §5 完了報告の「特記事項」欄に **事実として** 記載してください(例: 「`GET /api/combos/{id}` の実装が DES-002 §4.2 記述と乖離している」のような事実報告は OK、「これは設計書を改訂すべき」のような提案は NG)。

---

## 1. 背景と目的

### 1.1 背景

M5(コンボ比較系)では DES-005 §5.8 で規定されたコンボ比較画面を新規実装する。設計担当 Claude が M5-overview 作成にあたり以下の判断を確定したい:

- **判断 A**: DES-002 §4.2 に事前定義されている `POST /api/combos/compare` を新規実装するか、それとも既存 `GET /api/combos/{id}` を N 件並列呼出する形(案 1)で実現するか
- **判断 B**: コンボ一覧画面・マイコンボ画面に「選択モード」が現時点で実装されているか(M5 で新規実装が必要か)

これらの判断は **既存実装の実態確認** が前提となるため、本指示書で事実情報を収集する。

### 1.2 目的

本指示書完了時に、設計担当 Claude が M5-overview 作成のために必要な以下の情報が揃っている状態を達成する:

- (1) `GET /api/combos/{id}` レスポンス DTO の実態(setups 埋め込みの有無、defaultRecipe / starterMoveCode 等の M3-05 / M4-05 で確立されたフィールドの実装状態)
- (2) TanStack Query 既存フックの構成(useCombo / useCombos / useCharacterSetups 等の queryKey 形式 + フック名一覧)
- (3) `useQueries` の利用前例の有無
- (4) フロント側のルーティング定義(`/compare` パスが既に予約されているか)
- (5) コンボ一覧画面・マイコンボ画面に選択モード機能が実装されているかの確認
- (6) `web/src/constants/` の既存定数ファイル一覧と命名規則
- (7) shadcn/ui の導入状態(M7 まで未導入の方針が現状も継続しているかの最終確認)

### 1.3 このタスクで作らないもの

- 実装コード(コンポーネント、フック、API 等)
- 設計判断の提案(調査結果は事実列挙のみ、判断は設計担当が行う)
- 修正提案・リファクタ提案
- テストコード
- マイグレーション SQL

---

## 2. 成果物

### 2.1 作成するファイル

`/mnt/user-data/outputs/M5-RESEARCH-01-report.md`(調査レポート、想定 200〜500 行)

§5 完了報告フォーマットに従って記述する。

### 2.2 修正するファイル

なし(read-only 運用)

### 2.3 変更しないもの(原則)

すべてのソースコード・設定ファイル・ドキュメント。本指示書で `view` 以外のファイル操作は一切しない。

### 2.4 例外条項

該当なし(調査専用指示書のため例外条項を持たない)

---

## 3. 前提条件

### 3.1 必読ドキュメント

| ID / ファイル | 関連箇所 |
|--------------|---------|
| `docs/design/01-tech-stack.md`(DES-001) | §6 採用案 C(Go + React) |
| `docs/design/02-architecture.md`(DES-002) | §4.2 主要エンドポイント表、§4.3 エラーレスポンス共通型 |
| `docs/design/03-data-model.md`(DES-003) | §3.4 combos テーブル定義、§3.13 combo_setups |
| `docs/design/05-screen-design.md`(DES-005) | §5.4 コンボ一覧画面、§5.5 マイコンボ画面、§5.8 コンボ比較画面 |
| `docs/handover/architecture-patterns.md` v1.0.3 | §1.1 TanStack Query queryKey 規約(combo 系 flat tuple / setup 系 object 形式の混在) |
| `CLAUDE.md` | §2 技術スタック、§4 TypeScript 規約(camelCase / 列挙定数同期) |

### 3.2 任意参照

- `docs/handover/m4-to-m5-handover.md`(M5 着手前の状況把握、調査の文脈理解)

### 3.3 参照不要

- `docs/instructions/M1-*` 〜 `M4-*` 各指示書(調査内容を実コードから直接確認するため、過去指示書は参照不要)
- `docs/progress/progress-log.md`(調査内容は実コードで確認可能)
- `docs/handover/design-instruction-playbook.md`(設計担当向け、本指示書では参照不要)

### 3.4 着手前の確認

製造担当 Claude Code は本指示書 §4 の調査に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること(任意。簡単な確認なので Plan Mode をスキップしても可)**。

#### 3.4.1 リポジトリ構造の確認

`view /` または `ls -la` で以下のディレクトリが存在することを確認:

- [ ] `internal/api/combo/`(コンボハンドラ)
- [ ] `internal/service/combo/`(コンボサービス)
- [ ] `internal/model/`(モデル定義)
- [ ] `web/src/features/combo/`(フロント側コンボ機能)
- [ ] `web/src/features/combo/hooks/`(TanStack Query フック)
- [ ] `web/src/constants/`(定数定義)
- [ ] `web/src/pages/`(ページコンポーネント)

#### 3.4.2 read-only 運用の再確認

§0.2 を再読し、書き込み系操作を行わない方針を確認する。

---

## 4. 調査内容

各調査項目について、§5 完了報告で報告すべき情報を明示する。

### 4.1 `GET /api/combos/{id}` レスポンス DTO の実態

**目的**: 比較画面の表示項目 11 種(DES-005 §5.8)を既存 API レスポンスから取得可能か確認する。

**調査手順**:

1. `view internal/api/combo/handler.go`(または `internal/api/combo/` 配下の関連ハンドラファイル)で `GET /api/combos/{id}` ハンドラの実装を確認
2. レスポンス DTO 型を特定する(`ComboResponse` / `ComboDetailResponse` 等の型名)
3. `view internal/model/combo.go`(または該当する型定義ファイル)で DTO 型の全フィールドを確認
4. `view web/src/features/combo/types.ts`(または同等のファイル)でフロント側の対応型を確認

**報告すべき情報**:

- (a) `GET /api/combos/{id}` のレスポンス型名(Go 側 + フロント側)
- (b) レスポンス型の **全フィールド一覧**(フィールド名 + 型 + JSON タグ)
- (c) 以下のフィールドが含まれているか:
  - 始動状況系: `starterMoveId`、`starterMoveCode`、`position`、`opponentStance`、`hitType`、`opponentSize`
  - ダメージ系: `damage`、`driveAvailableAtStart`、`saAvailableAtStart`、`driveDamage`、`driveGaugeConsumedTotal`、`saGaugeConsumedTotal`
  - レシピ系: `steps`、`defaultRecipe`、`recipeCache`
  - 起き攻め系: `okiMeatyNeutralTechThrow`、`okiMeatyNeutralTechThrowDr`、`okiMeatyBackTechThrow`、`okiMeatyBackTechThrowDr`、`okiShimmyNeutralTech`、`okiShimmyBackTech`、`knockdownAdvantage`
  - 関連系: `tags`(または `tagIds`)、`setups`(セットプレイ埋め込み)、`memo`
- (d) セットプレイ(`setups`)が埋め込まれている場合、その配列要素の型(`SetupSummary` / `SetupResponse` 等)と含まれるフィールド

### 4.2 TanStack Query 既存フックの構成

**目的**: M5 で新規フック(`useCompareCombos` 等)を作成する際に既存パターンに整合させるための情報収集。

**調査手順**:

1. `ls web/src/features/combo/hooks/`(または `web/src/features/*/hooks/`)で全フックファイルを列挙
2. `find web/src -name '*.ts' -path '*/hooks/*' | head -30` 等で全フックファイルパスを取得
3. 各フックファイルを `view` で開き、`useQuery` / `useMutation` / `queryKey` の使用箇所を確認

**報告すべき情報**:

- (a) `web/src/features/` 配下の **全フックファイルパス一覧**(`combo` / `setup` / `tag` / `preset` / `character` ドメインを横断)
- (b) 各フックの **フック名 + queryKey 形式**(flat tuple か object 形式か、ID は number か string か)。最低限以下のフックを必須報告対象とする:
  - `useCombo`(コンボ単体取得)
  - `useCombos`(コンボ一覧取得)
  - `useCharacterSetups`(キャラ別 setup 一覧取得)
  - `useSetup`(setup 単体取得)
  - `useCharacters`(キャラ一覧取得)
  - `useTagsForSelector`(タグ取得)
- (c) **invalidate パターンの実態**: ミューテーションフック(`useCreateCombo` / `useUpdateMetadata` 等)が `onSuccess` で invalidate している queryKey の列挙(combo 系 / setup 系の structure 整合性を確認)

### 4.3 `useQueries` の利用前例

**目的**: 比較画面で複数コンボを並列取得する場合に `useQueries`(TanStack Query の複数並列クエリ)を使う前例があるか確認。

**調査手順**:

1. `grep -rn 'useQueries' web/src/` で利用箇所を列挙

**報告すべき情報**:

- (a) `useQueries` の **利用箇所一覧**(ファイルパス + 行番号 + 簡潔な用途)
- (b) 利用がない場合は「**利用なし**」と明記

### 4.4 フロント側のルーティング定義

**目的**: M5 で `/compare` または `/combos/compare` のような新規ルートを追加する際に、既存ルートとの衝突がないか確認。

**調査手順**:

1. `grep -rn 'createBrowserRouter\|Route path' web/src/ --include='*.tsx' --include='*.ts'` 等でルーティング定義ファイルを特定
2. 特定したファイル(`web/src/App.tsx` または `web/src/router.tsx` 等)を `view` で開き、全ルート定義を確認

**報告すべき情報**:

- (a) ルーティング定義ファイルのパス
- (b) **既存ルート全件のパス一覧**(例: `/`, `/combos`, `/combos/:id`, `/setups/:id`, ...)
- (c) `/compare` または `compare` を含むルートが既に予約されているか(yes / no、yes の場合はパス + 遷移先コンポーネント名)

### 4.5 コンボ一覧画面・マイコンボ画面の選択モード実装状態

**目的**: M5 でコンボ一覧画面・マイコンボ画面に「選択モード」を追加実装する必要があるかを確認。設計担当の現状認識(未実装)を実コードで検証する。

**調査手順**:

1. コンボ一覧画面のページコンポーネントを特定する(`web/src/pages/CombosPage.tsx` または `web/src/features/combo/pages/*.tsx` 等)
2. 該当ファイルを `view` で開き、以下を確認:
   - 「選択モード」「比較」「比較画面への遷移」に関する UI コード(`isSelectMode`、`selectedIds`、`Checkbox`、「比較」ボタン等)の有無
   - チェックボックス列、選択中件数バッジ等の存在有無
3. マイコンボ画面のページコンポーネントについても同様に確認

**報告すべき情報**:

- (a) コンボ一覧画面のページコンポーネントのファイルパス + コンポーネント名
- (b) コンボ一覧画面に **選択モード関連の実装が存在するか**(yes / no、存在する場合はそのコンポーネント・状態変数名)
- (c) マイコンボ画面のページコンポーネントのファイルパス + コンポーネント名
- (d) マイコンボ画面に **選択モード関連の実装が存在するか**(yes / no、存在する場合はそのコンポーネント・状態変数名)
- (e) 「比較」「compare」「select mode」等の文字列を `grep -rn 'compare\|isSelectMode\|selectedIds' web/src/` で検索した結果の **件数とファイル一覧**(0 件なら「該当なし」)

### 4.6 `web/src/constants/` の既存定数ファイル一覧と命名規則

**目的**: M5 で `MAX_COMPARE_COMBOS = 5` 等の新規定数を追加する際に既存命名規則に整合させるための情報収集。

**調査手順**:

1. `ls web/src/constants/` で全ファイルを列挙
2. 各ファイルを `view` で開き、定数定義の命名規則(SCREAMING_SNAKE_CASE / camelCase の混在状況)を確認

**報告すべき情報**:

- (a) `web/src/constants/` 配下の **全ファイルパス一覧**
- (b) 各ファイルで定義されている **代表的な定数名 2〜3 件**(命名規則を判定するため、ファイル全件は不要)
- (c) `MAX_*` または上限値系の定数の既存例があるか(yes / no、yes の場合は定数名 + 定義ファイル)

### 4.7 shadcn/ui の導入状態

**目的**: playbook §17.2 / handover §6.5 で「shadcn/ui は M7 まで未導入」が確立されているが、現時点で本当に未導入かを最終確認する(M4-8 由来「実装基盤の前提確認」教訓踏襲)。

**調査手順**:

1. `cat web/package.json | grep -E 'shadcn|radix'`(shadcn/ui は内部的に radix-ui に依存するため両方確認)
2. `ls web/src/components/ui/`(shadcn/ui の標準導入先)が存在する場合は中身を確認
3. `view web/src/components.json`(shadcn/ui の設定ファイル)が存在するか確認

**報告すべき情報**:

- (a) `web/package.json` の dependencies に `@radix-ui/*` または `shadcn-ui` 系のパッケージが含まれているか(yes / no、yes の場合はパッケージ名一覧)
- (b) `web/src/components/ui/` ディレクトリが存在するか(yes / no)
- (c) `web/src/components.json` が存在するか(yes / no)
- (d) 3 つすべてが no なら「**shadcn/ui 未導入**」を確認

---

## 5. 完了報告フォーマット

`/mnt/user-data/outputs/M5-RESEARCH-01-report.md` を以下のテンプレートで作成する。**事実列挙のみ、判断・提案は含めない**。

```markdown
# M5-RESEARCH-01 調査レポート

| 項目 | 内容 |
|------|------|
| 調査者 | 製造担当 Claude Code(M5-RESEARCH-01 担当、Sonnet 4.6) |
| 調査日 | YYYY-MM-DD |
| 使用ツール | view / bash(grep / cat / ls 等の参照系のみ) |
| 書き込み系操作 | 一切なし(read-only 厳守) |

---

## 4.1 GET /api/combos/{id} レスポンス DTO の実態

### (a) レスポンス型名

- Go 側: `model.XxxResponse`(ファイル: `internal/model/...`)
- フロント側: `XxxDetail`(ファイル: `web/src/features/combo/types.ts`)

### (b) レスポンス型の全フィールド一覧

| フィールド名(Go) | 型(Go) | JSON タグ | フィールド名(TS) | 型(TS) |
|------------------|---------|----------|------------------|---------|
| (列挙) | | | | |

### (c) 比較画面 11 項目の存在確認

| 比較画面項目(DES-005 §5.8) | 対応フィールド | 含まれるか |
|--------------------------|--------------|----------|
| 始動状況 - starterMoveId | | yes / no |
| 始動状況 - starterMoveCode | | yes / no |
| (略、全 11 項目を網羅) | | |

### (d) setups フィールドの構造

(配列要素の型名 + 含まれるフィールド一覧)

---

## 4.2 TanStack Query 既存フックの構成

### (a) 全フックファイルパス一覧

(列挙)

### (b) フック名 + queryKey 形式

| フック名 | ファイル | queryKey | structure | ID 型 |
|---------|---------|---------|-----------|-------|
| useCombo | web/src/features/combo/hooks/useCombo.ts | `['combo', id]` | flat tuple | number |
| (略) | | | | |

### (c) invalidate パターンの実態

(`onSuccess` で invalidate している queryKey の列挙、特に combo 系 / setup 系の structure 整合性確認)

---

## 4.3 useQueries の利用前例

(利用箇所一覧、または「利用なし」)

---

## 4.4 フロント側のルーティング定義

### (a) ルーティング定義ファイルのパス

(パス)

### (b) 既存ルート全件のパス一覧

(列挙)

### (c) /compare 系ルートの予約状況

(yes / no、yes の場合はパス + 遷移先コンポーネント名)

---

## 4.5 コンボ一覧画面・マイコンボ画面の選択モード実装状態

### (a)(b) コンボ一覧画面

- ファイルパス: ...
- コンポーネント名: ...
- 選択モード実装: yes / no(yes の場合は詳細)

### (c)(d) マイコンボ画面

(同上)

### (e) grep 結果

(`compare` / `isSelectMode` / `selectedIds` の grep 件数とファイル一覧)

---

## 4.6 web/src/constants/ の既存定数ファイル一覧と命名規則

### (a) 全ファイルパス一覧

(列挙)

### (b) 各ファイルの代表的な定数名

| ファイル | 代表的な定数名 |
|---------|--------------|
| (略) | |

### (c) MAX_* 系定数の既存例

(yes / no、yes の場合は詳細)

---

## 4.7 shadcn/ui の導入状態

### (a) package.json の確認結果

(`@radix-ui/*` / `shadcn-ui` 系パッケージの有無)

### (b) web/src/components/ui/ ディレクトリ

(yes / no)

### (c) web/src/components.json

(yes / no)

### (d) 総合判定

(「shadcn/ui 未導入」または「導入済み・詳細は ...」)

---

## 特記事項

調査中に発見した **明らかな矛盾・想定外の事象** を事実として列挙(判断・提案は含めない)。なければ「特記事項なし」。

例:
- 「`GET /api/combos/{id}` レスポンスに DES-005 §5.8 表示項目の `tags` 配列が含まれていない(実装上 `tagIds` のみで、タグ名を取得するには別途 `useTagsForSelector` が必要)」のような事実報告は OK
- 「これは設計書を改訂すべき」のような提案は NG

---

## 調査担当からの完了宣言

本指示書 §0.2 read-only 厳守を遵守し、view / bash 参照系コマンドのみで調査を完了した。書き込み系操作(ファイル新規作成・編集・削除、git 操作、ビルド・テスト実行、マイグレーション)は一切行っていない。
```

---

## 6. 完了条件(DoD)

### 6.1 機能要件

- `/mnt/user-data/outputs/M5-RESEARCH-01-report.md` が §5 のテンプレートに従って作成されている
- §4.1〜§4.7 の全 7 項目について報告内容が記載されている
- 事実列挙のみで、判断・提案を含んでいない

### 6.2 自己テスト結果

(該当なし、調査指示書のため)

### 6.3 品質チェック

- 書き込み系操作を一切行っていないことを確認
- `git status` を実行していない(本指示書では参照系であっても git コマンドは使わない方針)
- 調査レポート以外のファイル変更が発生していないことを確認(変更が発生した場合は §6.5 完了報告で明示)

### 6.4 ドキュメント

- 調査レポートを `/mnt/user-data/outputs/` に出力

### 6.5 完了報告

開発者へ以下を伝える(`present_files` ツールを使って調査レポートを提示する):

- 調査レポートファイルパス
- 調査所要時間
- 想定外の事象が発生したか(発生した場合は概要)
- 「read-only 厳守を遵守した」旨の宣言

---

## 7. 参照ドキュメント

| ID | パス | 用途 |
|----|------|------|
| DES-002 | docs/design/02-architecture.md | §4.2 主要エンドポイント、§4.3 エラーレスポンス共通型 |
| DES-003 | docs/design/03-data-model.md | §3.4 combos テーブル定義 |
| DES-005 | docs/design/05-screen-design.md | §5.4 / §5.5 / §5.8 比較画面と一覧の選択モード |
| architecture-patterns.md | docs/handover/architecture-patterns.md | §1.1 TanStack Query queryKey 規約 |
| CLAUDE.md | CLAUDE.md | §2 技術スタック、§4 TypeScript 規約 |

---

## 8. 注意事項・判断に迷ったら

### 8.1 推測で進めてはいけない事項

- 調査対象ファイルが見つからない場合、勝手にファイルパスを推測しない。`find` / `grep` で実態を確認する
- §0.2 read-only に該当するか迷う操作(例: `go mod tidy`、`pnpm install`、`git diff` 等)は一切行わない

### 8.2 推測で進めてよい事項(その旨を明示)

- 調査レポート §特記事項に「推測:〜と仮定した」と明示すれば、調査時の解釈は推測で書いてよい(例: 「複数のファイルで同名フックが定義されているため、メインで使われているのは XX 配下と推測した」)

### 8.3 不明事項発見時の対応

- 調査対象が見つからない場合: 「該当なし」「未発見」を §5 完了報告に **事実として** 記載
- 想定外の事象が発生した場合: Plan Mode で開発者に確認するか、§特記事項に事実として記載
- 本指示書の指示と現状が矛盾する場合(例: 指示されたファイルパスが存在しない): Plan Mode で確認

### 8.4 Plan Mode で計画提示時に含めるべき項目

(本指示書は Plan Mode 任意のため省略。Plan Mode を使う場合は §4 の調査順序と発見可能性の高い検索キーワードを開発者に共有する)

---

## 9. 完了後の次ステップ

設計担当 Claude が調査レポートを受け取り、以下の判断に進む:

1. `POST /api/combos/compare` を新規実装するか(案 1 / 案 2 / 案 3 のいずれを採用するか)
2. CHANGE-015 通知書ドラフトを起票するか(案 1 / 案 3 採用なら起票必要)
3. M5-01 指示書本文の確定(関心数 / サブマイルストーン分割の最終判断)

本調査結果が確定するまで、M5-01 指示書は作成しない。

---

*以上*
