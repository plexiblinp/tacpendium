# 指示書 M7-RESEARCH-01: shadcn/ui 統一導入の前提調査(自作ラッパー UI コンポーネントの網羅)

| 項目 | 内容 |
|------|------|
| 指示書ID | M7-RESEARCH-01 |
| バージョン | 1.0.0 |
| 推奨モデル | Sonnet 4.6(read-only + 事実列挙のみ、創発的判断不要、M5-RESEARCH-01 / M6-RESEARCH-01 と同方針) |
| Plan Mode | 任意(read-only 厳守 + 事実列挙のみのため設計判断分岐なし。ただし「設計書本体記述と実コードの乖離」を発見した場合は §5 完了報告の「特記事項」欄に記載する運用) |
| 機械レビュー | 任意(調査専用のためレビュー不要、開発者の事実確認で完了承認) |
| 並列性 | 単独(M5-RESEARCH-01 / M6-RESEARCH-01 と同じ運用、調査担当ターミナル 1 本のみ起動) |
| 依存指示書 | M6 完了承認済み(2026-05-23)、M7-overview v1.0.0 開発者承認済み |
| 想定所要時間 | 30〜45 分(M5-RESEARCH-01 = 7 項目で 30 分前後、M6-RESEARCH-01 = 2 項目で 20 分前後、本指示書は調査対象軸が UI コンポーネント網羅で複数コンポーネント並列調査のため M6-RESEARCH-01 より長め) |
| 作成者・作成日 | 設計担当 Claude(M7 期間担当)、2026-05-26 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-26 | 初版作成。M7-overview v1.0.0 §4.1 で確定したスコープ(既存自作ラッパー UI コンポーネントの実装位置・Props 契約・使用箇所網羅の事実列挙)を反映。M5-RESEARCH-01(7 項目)/ M6-RESEARCH-01(2 項目)に続く本プロジェクト 3 例目の調査専用指示書。本プロジェクト初の RESEARCH 分割運用の前半(後半は M7-RESEARCH-02 レスポンシブばらつき調査) |

---

## 0. この指示書の特殊性(最初に読むこと)

### 0.1 本指示書は「製造担当として起動し、調査だけ実施して閉じる」運用です

本指示書は通常の製造指示書(`M{N}-{NN}-*.md`)とは異なり、**コード変更・ファイル新規作成・テスト実行を一切行いません**。M7-01 / M7-02(shadcn/ui 統一導入)の指示書を設計担当が確定するための前提情報を、コードベースから事実列挙形式で抽出することだけが目的です。

製造担当 Claude Code セッションを Sonnet 4.6 で起動し、本指示書に従って調査レポートを作成・出力したら、そのセッションは閉じます(製造作業は行いません)。

本指示書は **本プロジェクト 3 例目の調査専用指示書** です(初例 = M5-RESEARCH-01 比較 API 設計調査 2026-05-22 / 2 例目 = M6-RESEARCH-01 設定 API + LAN バインド調査 2026-05-23)。M7 では **RESEARCH 分割初運用** で、本 M7-RESEARCH-01 は前半(UI コンポーネント網羅調査)、後半は M7-RESEARCH-02(M1〜M4 レスポンシブばらつき調査)。

### 0.2 read-only 厳守

以下を **絶対に行わない** こと:

- ファイルの新規作成・編集・削除(調査レポート出力以外)
- `git` コマンド(`git status` 等の参照系も含めて、本指示書では使わない)
- `go build` / `go run` / `pnpm build` / `pnpm test` 等のビルド・テスト実行
- マイグレーション実行(`go run ./cmd/combomgr` でアプリを起動しない)
- npm / pnpm の install 系コマンド(`pnpm dlx shadcn-ui@latest init` 等も実行しない、本指示書は調査のみ)
- 設定ファイルの変更(`web/components.json` の編集・新規作成を含む)
- `rm`、`mv`、`cp` 等のファイル操作

使ってよいツールは **`view` / `bash`(grep / cat / ls / find / wc 等の参照系のみ)** に限定します。`view` で複数ファイルを横断的に読むことが本作業の中核です。

万一実装変更が走った場合は開発者がロールバックします。判断に迷ったら何もせずに **Plan Mode で開発者に確認** してください。

### 0.3 判断・提案を含めない

調査結果は **事実の列挙のみ** とし、「こうするべき」「こちらが推奨」「shadcn/ui に差し替えるべき」のような判断・提案を含めないでください。判断は設計担当 Claude が調査結果を受けて行います。

ただし、調査中に発見した **明らかな矛盾・想定外の事象** は §5 完了報告の「特記事項」欄に **事実として** 記載してください(例: 「設計書本体 DES-001 §2 に shadcn/ui 採用と記述されているが、`web/package.json` に shadcn/ui 関連依存が存在しない」のような事実報告は OK、「これは設計書を改訂すべき」のような提案は NG)。

### 0.4 本調査の主目的(設計担当からの背景共有)

開発者の認識として、以下が **未導入** と思われている。本調査は、その認識を実コードで確認することと、現状の自作ラッパー UI コンポーネントの実態を網羅することが主目的:

- **項目 A**: shadcn/ui ライブラリ(DES-001 §2 / DES-002 §5.3 で採用記述あり、playbook §17.2 / handover §6.7 で「M7 まで未導入」明示)
- **項目 B**: M1-06 / M2 / M3 / M4 / M5 / M6 期間で実装された **自作ラッパー UI コンポーネント**(Dialog / Modal / Popover / Form 等)の実装位置・Props 契約・使用箇所網羅

**想定される結果**(調査前):

- 項目 A: **未導入**(M6 まで標準 HTML + Tailwind の自作ラッパーで運用、shadcn/ui 関連依存は `web/package.json` 未登録の見込み)
- 項目 B: **多数の自作ラッパーが存在**(各マイルストーンで Dialog / Modal / Popover / Form / Toast / Button / Select / Tooltip 等を自作している実態あり)

**想定外の発見が価値**: 想定外に「shadcn/ui が部分導入されていた」「`web/components.json` が既に存在していた」「`web/src/components/ui/` ディレクトリが既に存在していた」「特定コンポーネントだけ shadcn/ui ベース」等が判明した場合、M7-01 / M7-02 のスコープ判断に大きく影響するため **特記事項として詳細に報告** すること。M5-RESEARCH-01 / M6-RESEARCH-01 で「想定外の事象は事実として詳細に報告」という運用が確立されている。

### 0.5 結果の扱い(設計担当からの背景共有、調査担当の作業には影響しない)

本調査結果は M7-01(系統 A 前半: Dialog + Popover 移行 + 残課題 3 ヘッダ反映)+ M7-02(系統 A 後半: Form + Toast + その他 + C-2/C-3/C-4 解消)の指示書スコープ決定に使用される。調査結果次第で M7-01 / M7-02 のスコープと判断分岐の数が変わる(例: 自作ラッパーが想定より少なければ M7-01 / M7-02 の指示書サイズ縮小、想定より多ければ追加分割の検討)。調査担当は事実列挙のみ行い、判断は設計担当に委ねる。

---

## 1. 背景と目的

### 1.1 背景

M7(仕上げ + フェーズ 1 完了マイルストーン)の主スコープに **shadcn/ui 統一導入** がある(SUPP-001 v1.17.0 §4.1 M7 行)。これは M1-06 / M2 / M3 / M4 / M5 / M6 期間で標準 HTML + Tailwind の自作ラッパーで運用してきた Dialog / Popover / Form / Toast 等を shadcn/ui ベースに統一する横断改修。

playbook §4.6.4 で「UI ライブラリの統一導入は単独マイルストーンとして扱う(部分導入はハイブリッド状態を悪化させる)」と既定されており、M7 がその正本実施回となる。M7-01 / M7-02 の指示書スコープを設計担当が確定するため、現状の自作ラッパー UI コンポーネントの全件特定 + Props 契約 + 使用箇所網羅が必要。

### 1.2 目的

本指示書完了時に以下を達成する:

- shadcn/ui 関連の現状実装状態が事実として明らかになる(項目 A: 未導入の確認、または部分導入の発見)
- 自作ラッパー UI コンポーネントが全件特定される(項目 B: Dialog / Modal / Popover / Dropdown / Select / Form / FormField / Toast / Button / Tooltip / Accordion / Checkbox / Radio 等)
- 各自作ラッパーの (a) ファイルパス / (b) Props 契約 / (c) 呼び出し元ファイル一覧 / (d) 内部実装の特徴が事実として記録される
- shadcn/ui 公式提供コンポーネントとの対応関係が事実として整理される

### 1.3 このタスクで作らないもの

- shadcn/ui 関連の依存追加(`pnpm dlx shadcn-ui@latest init` 等の実行)
- `web/components.json` の新規作成・編集
- 自作ラッパー UI コンポーネントの変更・削除・差し替え
- 判断・提案・推奨(§0.3 既定)
- 設計書本体・補足資料・playbook・handover・retrospective-log 等の変更

---

## 2. 成果物

### 2.1 作成するファイル

#### ドキュメント(新設、唯一の成果物)

- `docs/instructions/M7-RESEARCH-01-report.md`(新設) — 調査結果レポート、§5 完了報告フォーマットに従う

### 2.2 修正するファイル

なし(read-only 厳守、§0.2 既定)。

### 2.3 変更しないもの(原則)

- バックエンド全般(`internal/`、`cmd/`、`migrations/`)
- フロントエンド全般(`web/src/`、`web/package.json` 等)
- 設計書本体(`docs/design/`)
- 設定ファイル(`config.toml`、`.env` 等)
- 恒久資料(playbook / handover / retrospective-log / architecture-patterns / change-number-registry)
- `web/components.json`(現時点で存在するか否かに関わらず、新規作成も編集もしない)

### 2.4 例外条項

なし(本指示書は調査専用、変更を一切行わない)。

---

## 3. 前提条件

### 3.1 必読ドキュメント

| ID | ファイル | 該当節 | 用途 |
|----|---------|-------|------|
| 本指示書 | 本ファイル | §0 / §1 / §4 | 調査担当の運用ルール + 調査対象 |
| DES-001 | `docs/design/01-tech-stack.md` | §2.1 / §2.2(技術スタック候補)| shadcn/ui 採用記述の文脈確認 |
| DES-002 | `docs/design/02-architecture.md` | §5.3(スタイリング)| shadcn/ui + Tailwind CSS 採用記述 |
| CLAUDE.md | プロジェクトルート | §2 技術スタック(`Tailwind CSS + shadcn/ui` 記述)、§3 ディレクトリ構成(`web/src/components/`)| 製造担当向けプロジェクト指針 |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §4.1 マイルストーン分割表 M7 行 + §5.3 フロントエンドディレクトリ構成 | shadcn/ui 統一導入の M7 スコープ確認 + ディレクトリ構造 |

### 3.2 任意参照(必要時のみ)

| ID | ファイル | 該当節 | 用途 |
|----|---------|-------|------|
| playbook | `docs/handover/design-instruction-playbook.md` | §4.6 UI ライブラリの実態確認原則 + §17.2 技術スタックの特徴 | shadcn/ui 未導入の経緯と運用方針 |
| architecture-patterns | `docs/handover/architecture-patterns.md` | §1 フロントエンドのプレゼンテーション層/ロジック層分離 + §1.1 TanStack Query queryKey 規約 | 既存フロントエンドのパターン |
| handover | `docs/handover/m6-to-m7-handover.md` | §6.7 / §3.9(C-2/C-3/C-4 持ち越し)| M4 期間継承の UI 関連持ち越し課題 |
| M5-RESEARCH-01 / M6-RESEARCH-01 | `docs/instructions/M5-RESEARCH-01-*.md` / `M6-RESEARCH-01-*.md` | 全節 | 過去の調査専用指示書の運用パターン参照 |

### 3.3 参照不要

- バックエンド設計書(DES-003 / DES-004 / DES-006)
- バリデーション設計書 DES-006
- 他のマイルストーン指示書(M1-* / M2-* / M3-* / M4-* / M5-* / M6-* の本体指示書)— ただし「特定コンポーネントの実装時期」を特記事項に含める場合のみ任意参照
- progress-log.md / progress-summary.md
- retrospective-log.md

### 3.4 着手前の確認

#### 3.4.1 リポジトリのフロントエンドディレクトリ構造の確認

- [ ] `view web/src/` を実行し、ディレクトリ構造(`pages/` / `features/` / `components/` / `layouts/` / `lib/` / `hooks/` / `types/` 等)を把握
- [ ] `web/package.json` を view で開き、現状の依存ライブラリ一覧を確認(shadcn/ui 関連の有無は §4.1 で詳細調査)

#### 3.4.2 設計書本体 + CLAUDE.md の関連記述の確認

- [ ] DES-001 §2 / DES-002 §5.3 / CLAUDE.md §2 で shadcn/ui 採用記述を確認
- [ ] SUPP-001 v1.17.0 §4.1 M7 行で shadcn/ui 統一導入のスコープを確認
- [ ] playbook §4.6 / §17.2 で shadcn/ui M7 まで未導入の運用記述を確認(本調査の主目的 §0.4 の背景)

#### 3.4.3 §4 着手の前提条件

§3.4.1 〜 §3.4.2 の確認結果を §5 完了報告の「結論サマリ」または「特記事項」に含めること。確認できなかった項目が発生した場合、その旨を記録(read-only 厳守のため、ファイル存在しない場合も推測で書かず「存在しなかった」と事実記録)。

---

## 4. 調査内容

各項目について、**事実のみ列挙** し、判断・提案を含めないこと(§0.3 既定)。コマンド例は参考であり、より効率的な手段が存在する場合は調査担当の裁量で変更してよい。

### 4.1 shadcn/ui 関連の現状実装状態(項目 A)

#### (a) `web/package.json` の shadcn/ui 関連依存の有無

```bash
# web/package.json を view で開く + 以下の文字列を grep
grep -nE 'shadcn|@radix-ui|class-variance-authority|clsx|tailwind-merge' web/package.json
```

事実列挙:

- shadcn/ui 関連依存が存在するか否か(`@radix-ui/*` / `class-variance-authority` / `clsx` / `tailwind-merge` / `lucide-react` 等)
- 存在する場合: 依存名 + バージョン + dependencies / devDependencies の区別
- 存在しない場合: 「存在しない」と事実記録

#### (b) `web/components.json`(shadcn/ui CLI 初期化ファイル)の有無

```bash
ls -la web/components.json 2>/dev/null || echo "存在しない"
```

事実列挙:

- ファイルが存在するか否か
- 存在する場合: ファイル内容を view で開いて記録(`style` / `rsc` / `tsx` / `tailwind` / `aliases` 設定値)

#### (c) `web/src/components/ui/` ディレクトリ(shadcn/ui 慣例配置先)の有無

```bash
ls -la web/src/components/ui/ 2>/dev/null || echo "存在しない"
```

事実列挙:

- ディレクトリが存在するか否か
- 存在する場合: 配下のファイル一覧 + 各ファイルが shadcn/ui ベースか自作ラッパーかの判別(冒頭コメント / import 文を確認)

#### (d) `tailwind.config.js` または `tailwind.config.ts` の shadcn/ui 関連設定の有無

```bash
ls -la web/tailwind.config.* 2>/dev/null
cat web/tailwind.config.* 2>/dev/null | head -100
```

事実列挙:

- 設定ファイルが存在するか否か
- 存在する場合: shadcn/ui 関連設定(`darkMode` / `content` / `theme.extend.colors` の CSS 変数参照 `hsl(var(--background))` 等)の有無

#### (e) `web/src/lib/utils.ts` 等の shadcn/ui 慣例ユーティリティの有無

```bash
ls -la web/src/lib/utils.* 2>/dev/null
grep -rn "from 'class-variance-authority'\|from 'clsx'\|from 'tailwind-merge'" web/src/ 2>/dev/null
```

事実列挙:

- `cn()` 関数(shadcn/ui 慣例の className 結合ヘルパ)の有無
- 関連 import 文の有無

#### (f) 総合判定

- 項目 A の総合: 「未導入」「部分導入」「完全導入」のいずれかを **事実から判定**(判断・提案ではなく、(a)〜(e) の事実から導かれる客観的状態を記録)

### 4.2 自作ラッパー UI コンポーネントの全件特定(項目 B)

#### (a) `web/src/components/` 配下のコンポーネント全件列挙

```bash
find web/src/components/ -type f \( -name '*.tsx' -o -name '*.ts' \) | sort
find web/src -type d -name 'components' 2>/dev/null
```

事実列挙:

- `web/src/components/` 配下の全ファイル + ファイル名(`Button.tsx` / `Modal.tsx` / `Dialog.tsx` / `Popover.tsx` 等)
- `web/src/features/<domain>/components/` 配下のコンポーネント(各 feature 別の UI コンポーネント、`web/src/features/` を find した結果)
- `web/src/pages/` 配下のページコンポーネント(これは pages であり ラッパーではないが、network 全体像の確認のため)

#### (b) 自作ラッパー候補の判別 + Props 契約抽出

(a) で列挙された各コンポーネントについて、以下を view ツールで確認し事実列挙:

| 列挙項目 | 取得方法 |
|---------|--------|
| ファイルパス | (a) の結果から |
| コンポーネント名 | `export function <Name>` / `export const <Name> = ` の抽出 |
| 種別判別 | Dialog / Modal / Popover / Dropdown / Select / Form / FormField / Toast / Button / Tooltip / Accordion / Checkbox / Radio / Card / Table / Tabs / その他、のいずれか(または「該当なし = 通常の表示コンポーネント」)|
| Props 型定義 | `interface <Name>Props { ... }` または `type <Name>Props = { ... }` の冒頭抽出 |
| 必須 Props | Props 型定義のうち `?:` でないフィールド |
| 任意 Props | Props 型定義のうち `?:` フィールド |
| コールバック Props | `(...) => void` / `(...) => Promise<void>` 等の関数型 Props |
| 内部状態管理 | `useState` / `useReducer` / `useEffect` / `useRef` 等の利用有無 |
| 副作用 | `useMutation` / `useQuery` / 外部 API 呼出の有無 |
| `createPortal` 使用 | `createPortal(` の有無(M2-04 で確立されたパターン、modal 系で多用) |
| ロジック / 表示の分離 | architecture-patterns §1 「表示専用コンポーネント vs ロジックフック」のどちらか |

事実列挙の出力形式(自作ラッパー候補別に表形式):

```
### コンポーネント: <ファイル名>

| 項目 | 内容 |
|------|------|
| ファイルパス | web/src/components/<Name>.tsx |
| 種別 | Dialog / Modal / Popover / ... |
| Props 型 | interface <Name>Props { ... } |
| 必須 Props | onClose: () => void / children: React.ReactNode / ... |
| 任意 Props | title?: string / ... |
| コールバック Props | onClose / onConfirm / onChange / ... |
| 内部状態 | useState (open/close 等) / useEffect (focus 制御等) / ... |
| 副作用 | なし / useMutation (xxx) / ... |
| createPortal | あり / なし |
| 分離パターン | 表示専用 / ロジック含む |
```

#### (c) 各自作ラッパーの呼び出し元ファイル一覧

(b) で列挙された各自作ラッパーについて、呼び出し元を `grep -rn` で網羅:

```bash
# 例: Modal コンポーネントの呼び出し元を全件列挙
grep -rn "import.*from.*['\"].*components/Modal['\"]" web/src/ 2>/dev/null
grep -rn "<Modal[ />]" web/src/ 2>/dev/null
```

事実列挙(コンポーネント別):

```
### コンポーネント: <Name> の呼び出し元

- web/src/pages/<page1>.tsx: <行番号> で使用、Props 渡し: `<Name onClose={...} title={...} />`
- web/src/features/<domain>/components/<comp>.tsx: <行番号> で使用、Props 渡し: ...
- ...
```

呼び出し元が 5 件以上ある場合は **件数のみ列挙 + 上位 5 件の例示**(全件を完全列挙する必要はない、サンプルとして上位 5 件 + 件数で十分)。

#### (d) shadcn/ui 公式提供コンポーネントとの対応関係(事実列挙のみ)

(b) で列挙された各自作ラッパーについて、shadcn/ui 公式ドキュメント(https://ui.shadcn.com/docs/components)で **同名または類似名のコンポーネントが提供されているか** を確認し事実列挙。

| 自作ラッパー名 | shadcn/ui 対応コンポーネント名 |
|------------|------------------------|
| `Modal` / `Dialog` | `dialog` / `alert-dialog` / `sheet` |
| `Popover` | `popover` |
| `Dropdown` | `dropdown-menu` |
| `Select` | `select` |
| `Form` / `FormField` | `form`(`react-hook-form` 統合)|
| `Toast` | `toast` または `sonner` |
| `Button` | `button` |
| `Tooltip` | `tooltip` |
| その他 | ... |

shadcn/ui 公式が **提供していないコンポーネント名** がある場合、「公式提供なし」と事実記録(評価・推奨は含めない、§0.3 既定)。

#### (e) 総合事実列挙

項目 B の総合:

- 発見された自作ラッパーの総数
- 種別別カウント(Dialog 系 X 件 / Popover 系 Y 件 / Form 系 Z 件 / ...)
- 呼び出し元ファイル総数の合計(重複排除)
- M7-01 / M7-02 分割時の対象目安(設計担当への参考、判断ではなく事実)

### 4.3 既存パターン参照(architecture-patterns §1 + handover §3.9 関連)

#### (a) `architecture-patterns.md §1` プレゼンテーション層/ロジック層分離パターンの実態確認

- [ ] (b) で列挙された各自作ラッパーが architecture-patterns §1 規定(表示専用 / ロジックフック)のどちらに該当するか集計
- [ ] 規定から逸脱しているコンポーネントが存在する場合は事実列挙(例: ロジックフックなのに `mode` 切替 Props で副作用を持つ等)

#### (b) C-2 / C-3 / C-4 持ち越し関連コンポーネントの特定(handover §3.9)

handover §3.9 で持ち越しとされている以下のコンポーネントの実態確認(M7-02 で C-2 / C-3 / C-4 解消対象):

- **C-2 関連**: 個別 VC(`VirtualController`)= M4-04 で確立された個別 VC レンダリング採用
  - `grep -rn "VirtualController\|SetupRecipeEditor" web/src/`
  - 該当ファイル + 個別 VC 採用箇所の事実列挙
- **C-3 関連**: `LinkExistingSetupModal` + `SetupSelectorModal`(M4-04 で「YAGNI で分離維持」と判断、M7 で統合可否再評価)
  - `grep -rn "LinkExistingSetupModal\|SetupSelectorModal" web/src/`
  - 両 Modal の Props 型 + 呼び出し元の事実列挙
- **C-4 関連**: `setup.defaultRecipe` の条件描画パターン
  - `grep -rn "defaultRecipe" web/src/`
  - 該当ファイル + 描画箇所の事実列挙

### 4.4 関連設計書記述と実装の乖離(任意)

調査中に発見した「設計書本体記述と実装の乖離」を事実列挙(発見した場合のみ、見つからなければ「なし」)。

例(M6-RESEARCH-01 §4.5 同様の体裁):

- DES-001 §2 / DES-002 §5.3 で shadcn/ui 採用記述あり → 実装は §4.1 (f) の判定に従う(乖離が存在する場合は事実記録)
- CLAUDE.md §2 で `Tailwind CSS + shadcn/ui` 記述 → 同上
- その他、調査中に発見した乖離が存在する場合は §特記事項に詳細記述

---

## 5. 完了報告フォーマット

調査担当 Claude Code は調査完了後、`docs/instructions/M7-RESEARCH-01-report.md` を以下の形式で作成する。

```markdown
# M7-RESEARCH-01 調査結果レポート

| 項目 | 内容 |
|------|------|
| 文書ID | M7-RESEARCH-01-REPORT |
| 作成日 | 2026-MM-DD |
| 作成者 | 製造担当 Claude Code(調査担当として運用、Sonnet 4.6) |
| 前提指示書 | M7-RESEARCH-01-shadcn-ui-implementation-check.md v1.0.0 |

---

## 結論サマリ(調査担当による事実集約、最初に読む)

(以下、調査担当が完成させる、3〜5 行で結論を事実集約)

- 項目 A(shadcn/ui 現状実装状態): 「未導入」「部分導入」「完全導入」のいずれか
- 項目 B(自作ラッパー UI コンポーネント): 総数 X 件発見、種別内訳(Dialog 系 X 件 / Popover 系 Y 件 / ...)
- C-2 / C-3 / C-4 持ち越し関連: 該当コンポーネント特定済み / 一部のみ / 該当なし
- 想定外の発見: あり / なし(あった場合は「特記事項」参照)

---

## 4.1 shadcn/ui 関連の現状実装状態(項目 A)

### (a) web/package.json の shadcn/ui 関連依存

(調査担当が記入: grep 結果 + 事実列挙)

### (b) web/components.json の有無

(調査担当が記入)

### (c) web/src/components/ui/ ディレクトリの有無

(調査担当が記入)

### (d) tailwind.config.* の shadcn/ui 関連設定

(調査担当が記入)

### (e) web/src/lib/utils.ts 等の shadcn/ui 慣例ユーティリティ

(調査担当が記入)

### (f) 総合判定

(調査担当が記入: 「未導入」「部分導入」「完全導入」のいずれか、事実から判定)

---

## 4.2 自作ラッパー UI コンポーネントの全件特定(項目 B)

### (a) コンポーネント全件列挙

(調査担当が記入: find 結果 + 全ファイル一覧)

### (b) 自作ラッパー候補の判別 + Props 契約抽出

(調査担当が記入: コンポーネント別に §4.2 (b) で示した表形式で列挙)

#### コンポーネント: <Name1>

(表形式で詳細)

#### コンポーネント: <Name2>

(同上)

...

### (c) 各自作ラッパーの呼び出し元ファイル一覧

(調査担当が記入: コンポーネント別に呼び出し元列挙、5 件以上は件数 + 上位 5 件で十分)

### (d) shadcn/ui 公式提供コンポーネントとの対応関係

(調査担当が記入: 対応表)

### (e) 総合事実列挙

- 発見された自作ラッパーの総数: X 件
- 種別別カウント: Dialog 系 X 件 / Popover 系 Y 件 / Form 系 Z 件 / Toast 系 W 件 / Button 系 V 件 / その他 U 件
- 呼び出し元ファイル総数(重複排除): X 件

---

## 4.3 既存パターン参照

### (a) architecture-patterns §1 プレゼンテーション層/ロジック層分離パターンの実態

(調査担当が記入)

### (b) C-2 / C-3 / C-4 持ち越し関連コンポーネントの特定

#### C-2 関連: VirtualController + SetupRecipeEditor

(調査担当が記入: ファイル + 個別 VC 採用箇所)

#### C-3 関連: LinkExistingSetupModal + SetupSelectorModal

(調査担当が記入: 両 Modal の Props 型 + 呼び出し元)

#### C-4 関連: setup.defaultRecipe の条件描画パターン

(調査担当が記入: 該当ファイル + 描画箇所)

---

## 4.4 関連設計書記述と実装の乖離

### (a) 発見した乖離

(調査担当が記入、発見が存在する場合は詳細、なければ「なし」)

### (b) なければ

(調査担当が記入)

---

## 特記事項

(調査担当が記入: 想定外の発見 / 明らかな矛盾 / 調査中に気づいた事実、ただし判断・提案は含めない)

例:

- (想定外発見の例 1)
- (想定外発見の例 2)
- ... または「特記事項なし」

---

## 調査担当からの完了宣言

調査内容(§4.1 / §4.2 / §4.3 / §4.4)について、本指示書 §0.2 read-only 厳守 + §0.3 判断・提案を含めない運用に従って事実列挙を完了した。本調査結果を設計担当が受け取り、M7-01 / M7-02 の指示書スコープ確定に活用する想定。

調査担当のセッションはこの完了報告の出力をもって閉じる(製造作業は行わない)。
```

---

## 6. 完了条件(DoD)

### 6.1 機能要件

- [ ] `docs/instructions/M7-RESEARCH-01-report.md` が §5 完了報告フォーマットに従って作成されている
- [ ] §4.1 項目 A 各 (a)〜(f) すべてに事実記載がある
- [ ] §4.2 項目 B 各 (a)〜(e) すべてに事実記載がある
- [ ] §4.3 (a) + (b) C-2 / C-3 / C-4 関連の事実記載がある
- [ ] §4.4 設計書本体記述と実装の乖離の事実記載がある(発見ゼロでも「なし」と記載)
- [ ] 特記事項節に「想定外の発見」または「特記事項なし」の記載がある

### 6.2 自己テスト結果

- [ ] 本指示書 §0.2 read-only 厳守を遵守した(コード変更・ファイル新規作成・ビルド実行を行っていない)
- [ ] 本指示書 §0.3 判断・提案を含めない運用を遵守した(調査結果に「こうするべき」「推奨する」等の表現が含まれていない)

### 6.3 品質チェック

- [ ] 調査結果の事実が grep / view の出力に基づく(推測・記憶での記述がない)
- [ ] コンポーネント名・ファイルパスに誤記がない
- [ ] 呼び出し元ファイルの行番号・Props 渡し記載が実際の grep 出力と一致する

### 6.4 ドキュメント

- [ ] 調査結果レポート(`docs/instructions/M7-RESEARCH-01-report.md`)の作成のみ
- [ ] それ以外のドキュメントは変更しない

### 6.5 完了報告

調査担当 Claude Code は調査完了後、開発者に以下を口頭または短いメッセージで報告:

> M7-RESEARCH-01 調査完了しました。`docs/instructions/M7-RESEARCH-01-report.md` を作成済みです。
>
> - 項目 A 総合判定: (未導入 / 部分導入 / 完全導入)
> - 項目 B 発見数: 自作ラッパー X 件、呼び出し元ファイル Y 件
> - 想定外の発見: (あり / なし)
>
> 詳細はレポートをご確認ください。本セッションはこれで閉じます。

---

## 7. 参照ドキュメント

| 種類 | ファイル | 役割 |
|------|---------|------|
| 本指示書 | 本ファイル(`M7-RESEARCH-01-shadcn-ui-implementation-check.md`)| 調査担当の運用ルール + 調査対象 |
| 設計書本体 | `docs/design/01-tech-stack.md`(DES-001 §2)| shadcn/ui 採用記述 |
| 設計書本体 | `docs/design/02-architecture.md`(DES-002 §5.3)| shadcn/ui + Tailwind 採用記述 |
| 設計補足 | `docs/design/supp-001-detailed-design.md` v1.17.0 §4.1 M7 行 + §5.3 | shadcn/ui 統一導入の M7 スコープ + フロントエンドディレクトリ構成 |
| プロジェクト指針 | `CLAUDE.md` §2 / §3 | shadcn/ui 記述 + ディレクトリ構成 |
| 設計担当恒久資料 | `docs/handover/design-instruction-playbook.md` v1.8.0 | §4.6 UI ライブラリの実態確認原則 + §17.2 技術スタックの特徴 |
| 設計担当恒久資料 | `docs/handover/architecture-patterns.md` v1.0.6 | §1 プレゼンテーション層/ロジック層分離 |
| マイルストーン引き継ぎ | `docs/handover/m6-to-m7-handover.md` v1.0.0 | §3.9(C-2/C-3/C-4 持ち越し)|
| 過去調査指示書 | `docs/instructions/M5-RESEARCH-01-*.md` / `M6-RESEARCH-01-*.md` | 調査専用指示書の運用パターン参照 |

---

## 8. 注意事項・判断に迷ったら

### 8.1 推測で進めてはいけない事項

- shadcn/ui 関連の依存有無の判定 → 必ず `web/package.json` を view で開いて事実確認
- 自作ラッパー UI コンポーネントの Props 契約 → 必ず該当ファイルを view で開いて型定義を抽出
- 呼び出し元ファイル → 必ず `grep -rn` で網羅検索

### 8.2 推測で進めてよい事項(その旨を明示)

- コンポーネントの種別判別(Dialog / Modal / Popover 等)で名称から推測する場合 → 推測である旨を明示し、実装内部の根拠(`role="dialog"` や `createPortal` 使用等)を併記

### 8.3 不明事項発見時の対応

- 設計書本体記述と実装の乖離を発見 → §4.4 + 特記事項に詳細記録(判断・提案ではなく事実として)
- 判別に迷うコンポーネント(自作ラッパーかどうか判別困難)→ 「判別困難」と事実記録 + 判断材料(冒頭コメント / import 文 / 内部実装)を併記
- 本指示書記述外の事象を発見 → 特記事項に詳細記録

### 8.4 Plan Mode で計画提示時に含めるべき項目(任意実施の場合)

Plan Mode を使う場合は以下を含めることが望ましい:

- §3.4 着手前確認の結果(リポジトリ構造の把握、設計書本体記述の確認)
- §4.1 / §4.2 / §4.3 / §4.4 各項目の調査順序
- 想定所要時間の見積もり

---

## 9. 完了後の次ステップ

- 本指示書完了後、調査担当 Claude Code セッションは閉じる
- 設計担当 Claude(本セッションまたは継承担当)が `M7-RESEARCH-01-report.md` を受け取り、M7-RESEARCH-02 指示書作成 + M7-01 / M7-02 指示書作成のスコープ確定に活用
- 開発者が完了承認後、M7-RESEARCH-02(レスポンシブばらつき調査)の指示書作成に進む

---

*以上、指示書 M7-RESEARCH-01 v1.0.0*
