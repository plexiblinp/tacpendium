# 確立アーキテクチャパターン(architecture-patterns)

| 項目 | 内容 |
|------|------|
| 文書ID | ARCHITECTURE-PATTERNS |
| 用途 | マイルストーンを跨いで確立した実装アーキテクチャパターンの集約。新マイルストーンの指示書執筆時に踏襲すべき設計の基準点 |
| 対象読者 | **設計・指示書作成担当 Claude** が指示書執筆時に参照。製造担当 Claude Code は指示書経由で本パターンを受け取る |
| 更新頻度 | 新パターン確立時(マイルストーン完了ごとの handover 作成時に追記) |
| 関連資料 | 反省記録=`retrospective-log.md`、運用ルール=`design-instruction-playbook.md`、技術詳細=`docs/design/supp-001-detailed-design.md` |

---

## 0. 本書の位置づけと更新ルール

- 本書は **全期間通算** の確立済みパターン集。マイルストーン固有の handover からは本書へのポインタのみ
  を置く。
- 新規 UI コンポーネント・新規ハンドラを設計する指示書は、本書のパターンに整合させる。逸脱する場合は
  指示書本文に理由を明記する。
- 新パターンが確立したら設計担当 Claude が本書へ追記する。

---

## 1. フロントエンドのプレゼンテーション層/ロジック層分離

M3-04 v1.0.5 で確立。新規 UI コンポーネントは本パターンを踏襲する。

- **表示専用コンポーネント**: Props のみで動作し、副作用(API 呼び出し・キャッシュ無効化)を含まない。
  - 例: `MyComboStatusSelect`(currentStatus + onChange のみ)、`TagSelector`、`TagBadgeList`
- **ロジックフック**: API 呼び出し・キャッシュ管理・状態管理を担う。
  - 例: `useUpdateMyComboStatus`、`useTagsForSelector`、`useComboListFilters`、`useColumnVisibility`、
    `useCharacters`、`useMyComboStatusCounts`
- **統合は各ページが担当**: ページコンポーネントが表示コンポーネントとロジックフックを組み合わせる。
- `mode` 切替 props のような単一コンポーネント設計を強制しない(retrospective-log §4.2 パターン C 参照)。

**適用例(M4)**: セットプレイ管理 UI は `SetplayList`(表示)+ `useSetplayList`(ロジック)、
プリセット選択 UI は `PresetSelector`(表示)+ `usePresetList` / `useUpdatePreset`(ロジック)に分離。

### 1.1 TanStack Query queryKey 規約(M4-02 で確立、v1.0.2 で実態整合化、v1.0.3 で実態混在を明示)

M4-02 実装中に発見された潜在不具合への対処として、TanStack Query の queryKey 設計に関する規約を以下のとおり確立する。

**問題の背景**: `react-router` の `useParams<{ id: string }>()` は値を **string** で返す。一方、mutation の `onSuccess` で `queryClient.invalidateQueries({ queryKey: ['combo', comboId] })` を呼ぶ際、`comboId` を number で渡している場合、TanStack Query の queryKey 厳格比較で `["combo", "42"]`(string)と `["combo", 42]`(number)が **別キーとして扱われ**、キャッシュ無効化が機能しない不具合が発生する。M2 / M3 期間の `useCombo` で潜在していたが、M4-02 で setup 関連の mutation キャッシュ無効化を組む際に表面化した。

**規約の核心**: URL パラメータ(useParams 戻り値)を queryKey に組み込むフックを新設する際は、**フック内部で `parseInt(param, 10)` 等の number 正規化を行う**。queryKey の構造(flat tuple / object)はコードベースの実態に揃えるが、**規約の本質は ID の number 統一**であり、structure は規約の対象外。

**コードベースの structure 実態(v1.0.3 で明示)**: 当初 v1.0.2 では「コードベースは flat tuple 形式を採用」と書いたが、M4-04 実装完了後の製造担当連絡事項(2026-05-20)で **setup 系フックは object 形式**(`["setups", { characterId }]`)を採用していることが判明 = **コードベースには flat tuple と object 形式が混在している**。本書 v1.0.3 でこの実態を正確に反映する形に修正。

```typescript
// 既存実態の例(v1.0.3 で混在を明示):

// combo 系: flat tuple 形式
export function useCombo(id: number | string | undefined) {
  const normalizedId = typeof id === 'string' ? parseInt(id, 10) : id;
  return useQuery({
    queryKey: ['combo', normalizedId],  // flat tuple
    queryFn: () => comboApi.get(normalizedId!),
    enabled: !!normalizedId && !Number.isNaN(normalizedId),
  });
}

// setup 系: object 形式
export function useCharacterSetups(characterId: number) {
  return useQuery({
    queryKey: ['setups', { characterId }],  // object 形式
    queryFn: () => setupApi.listByCharacter(characterId),
  });
}
```

**queryKey 構造の選択(v1.0.3 で改訂)**:

- 本コードベースは **flat tuple 形式と object 形式が混在** している(combo 系 = flat tuple、setup 系 = object 形式)
- **規約の核心は number 正規化のみ**、flat tuple / object のどちらでも core 規約は守られる
- 新規フック追加時は **同一ドメインの既存フックの structure に揃える**(combo 系を拡張するなら flat tuple、setup 系を拡張するなら object 形式)
- 異なるドメインを跨いで invalidate する場合(例: useCreateCombo の onSuccess で `['setups']` を invalidate)は、ドメインごとの structure を意識して呼び出す
- 統一リファクタは M5+ で検討(retrospective-log v1.0.15 §5.5 持ち越し確認課題候補、必須ではない、必要時に判断)

**回避策(M4-04 製造担当が採用)**: 異なる structure を跨いで invalidate する場合、**プレフィックス全件 invalidate**(`['setups']` のみで第 2 要素を省略)を使うと、TanStack Query がプレフィックス一致で関連 query を網羅的に無効化するため、structure 違いを意識せず安全。多少の過剰無効化はあるが実害なし。

**v1.0.1 / v1.0.2 の規約コード例の誤り経緯(v1.0.3 で整理)**:

- **v1.0.1 の誤り**: 規約コード例を `['combo', { id: normalizedId }]`(object 形式)で書いたが、コードベースの実態は flat tuple だった。設計担当 Claude(M4 期間担当)が **実態の useCombo 実装を確認せずに書いた誤り**(retrospective-log v1.0.10 §5.1 M4-9)。
- **v1.0.2 の誤り**: 「コードベースは flat tuple 形式を採用」と書いたが、setup 系の実態を確認していなかった(combo 系のみ確認)。実態は **混在** で、v1.0.2 規約は部分的にしか正確でなかった。設計担当 Claude(M4 期間担当)が **規約執筆時にドメイン横断確認を行わなかった誤り**(retrospective-log v1.0.15 §5.1 M4-13)。
- **v1.0.3 の対応**: 「コードベースは flat tuple と object 形式が混在」と実態を明示、規約の核心を「number 正規化」のみに絞る、structure は同一ドメインの既存フックに揃える運用に整理。

**適用範囲**:

- URL パラメータ(useParams)を直接または間接的に queryKey に組み込むフック
- 既存フックでも、mutation 側との型不整合が発覚した場合は同様に正規化を入れる(M4-02 では `useCombo` を本規約に合わせて修正済み)

**確認方法**: 新規フック追加時、queryKey で使う ID 型と mutation の `invalidateQueries` で渡す ID 型が **両方とも number** で一致していることを確認する。queryKey の構造(flat tuple / object)は **同一ドメインの既存フックの実態に揃える**(grep で確認)。

**例外**: URL パラメータが本来文字列である場合(例: `useUser('username')` のような string ID)は、フック内部でも string を維持する。本規約は **数値 ID のみが対象**。

### 1.2 shadcn/ui 統一導入パターン(M7-01 で確立、v1.0.8 で新設)

M7-01(2026-05-27 完了承認)で本プロジェクトに shadcn/ui を統一導入した際に確立されたパターン。M7-02 以降の系統 A 後半(Form + Toast + Badge / Display + Table / List 系の shadcn/ui 化)+ 後続マイルストーンでの新規 shadcn/ui コンポーネント追加時に踏襲する。

#### 1.2.1 採用方針: 案 β = shadcn/ui 標準 API に呼び出し側を合わせる

M7-overview v1.0.1 §2.3 で案 β 確定(2026-05-26 開発者ご判断)。**例外コンポーネント = 既存 API 維持を採用しない**(案 β 全件適用、ハイブリッド状態回避)。既存自作ラッパーは shadcn/ui 標準 API(`open` / `onOpenChange` 等)に契約を変更し、呼び出し元 18 ファイル(M7-01 実績)を一括修正する。

#### 1.2.2 Props 命名是正の方針

- **`open: boolean` 統一**(既存 `isOpen` 混在を リネーム = M7-01 で PermanentDeleteConfirm 1 件)
- **`onOpenChange: (open: boolean) => void` への置換**(既存 `onClose` / `onCancel` の closure 系コールバックを shadcn/ui 慣例にラップ):
```tsx
  // 呼び出し元
  <XxxModal
    open={isOpen}
    onOpenChange={(open) => { if (!open) handleClose(); }}
    onConfirm={...}  // 意味付き callback は維持
  />
```
- **意味付き callback は維持**(`onConfirm` / `onSubmit` / `onSelect` / `onAdd` / `onLinked` 等)
- **`onOpenChange` の onClose / onCancel ラップ方針 = 案 (i)**(呼び出し元でラップ、shadcn/ui 標準 API 慣例準拠)を採用、案 (ii)(ラッパー内部で受け取り内部 callback 呼出)は採用しない

#### 1.2.3 モーダル portal の統一

- shadcn/ui Dialog / AlertDialog 内部の `@radix-ui/react-portal` で自動統一
- 既存の `createPortal` 直接使用(M7-01 では 4 件)+ fixed overlay div(M7-01 では 6 件)はすべて **削除**(M7-01 完了済み、M7-01 機械レビュー報告書 §7 で確認)
- M7-02 以降で追加する Dialog 系コンポーネントは **shadcn/ui Dialog / AlertDialog ベースから開始**、`createPortal` / fixed overlay div の独自実装は禁止

#### 1.2.4 `window.confirm` 除去

- ネイティブの `window.confirm` は **使用禁止**、shadcn/ui AlertDialog に置換
- M7-01 で SetupAccordionItem の 1 件を除去済み(M7-01 機械レビュー報告書 §7)
- M7-02 以降の新規実装でも `window.confirm` 採用禁止

#### 1.2.5 内部状態の標準動作代替

shadcn/ui コンポーネント移行時に削除可能な内部状態(M7-01 実績):
- `useState`(open)+ `useRef`(containerRef)+ `useEffect`(click-outside 検出)= shadcn/ui Popover / DropdownMenu / Sheet / Select 等の標準動作で自動代替(M7-01 で ColumnVisibilityMenu / TagSelector / SetupAccordionItem で削減実績)
- `useEffect`(Escape キーハンドラ)= shadcn/ui Dialog / AlertDialog の標準動作で自動代替(M7-01 で PermanentDeleteConfirm で削減実績)

ただし以下は維持:
- ドメイン固有の `useState`(KnockdownAdvantageChangeModal の `mode` / `checkedIds` / ModifiersEditor の `localFlags` / `localType` / `localNotes` 等、ビジネスロジックに紐づく状態)
- `useQuery` / `useMutation`(コンポーネント内残置の分離パターン逸脱 4 件は M7-02 で解消予定、M7-01 では維持で正)
- 文字数警告等の `useEffect`(ModifiersEditor の notes 文字数警告)

#### 1.2.6 例外条項(M7-01 で発生した実装上の例外、後続マイルストーンで判断材料)

- **cmdk(Command コンポーネント)不採用**: M7-01 で TagSelector 移行時、cmdk は jsdom で ResizeObserver / scrollIntoView が未実装のためテスト不能。Popover + ネイティブ input + カスタムリストで代替実装。M7-02 で TagSelector 分離パターン逸脱解消時に cmdk 再採用の可否を再判断(retrospective-log §6.6 持ち越し課題「伝達 1」)
- **Dialog scroll 制約候補**: 本書 §7 で「リストを含む Dialog の scroll 制約パターン候補」として独立節記録、M7-02 で正式パターン化判断
- **コンポーネント本体温存 + 呼び出し元削除**: M7-01 で LinkExistingSetupModal は本体温存 + ComboEditorPage(編集モード専用ページ)の呼び出しのみ削除(CHANGE-018 v1.0.1「登録画面のみ」注記方式と整合)。コンポーネント本体削除と呼び出し側削除は別判断、設計書本体の規定の解釈に従う

##### M7-02 完了承認時の追加例外事例(v1.0.9 で追記、2026-05-31)

- **native `<select>` の Radix Select 非置換**(M7-02 確定、Q16 (P)): Radix UI の Select コンポーネントは `value=""` を uncontrolled と見なす仕様のため、「(未指定)」プレースホルダー(`<option value="">`)が動作しなくなる。ComboEditorBasicFields の 6 つの select + ComboListFilters の 7 つの select すべてが空文字列を有効な選択肢として使用しており、置換すると機能が壊れる。**判断**: native `<select>` を維持し、CSS クラスのみ `border-input bg-background` で shadcn/ui 統一見た目に整合。**Radix UI の現実的制約による真の例外条項**、案 β 案内の例外として正式記録。**今後の検討**: Radix Select で空値を扱う公式パターンが確立された時点で再検討可能(M7-03 以降の候補)

#### 1.2.7 関連教訓

- 案 β 採用の利点: shadcn/ui エコシステム準拠 = 新規コンポーネント追加時の学習コスト低減 + shadcn/ui ドキュメント直接参照可能
- 案 β 採用の代償: 既存呼び出し元の Props 渡し修正が必要(M7-01 では 18 ファイル)= マイルストーン規模が膨張する傾向、Plan Mode 必須化で対応
- retrospective-log §6.6 M7-1 / M7-2 / M7-3 候補 + 本書 §1.2 で M7-01 期間の shadcn/ui 関連知見が網羅される。M7-02 以降は本書 §1.2 を参照点として運用

#### 1.2.8 shadcn/ui CLI 由来の依存混入対応(v1.0.9 で新設、2026-05-31、M7-02 確立)

##### 確立経緯

M7-02 製造工程で `pnpm dlx shadcn@latest add sonner` 実行時に `next-themes` パッケージが自動追加された。sonner.tsx のテンプレートが Next.js 前提で `useTheme()` を使用しているため。

##### 対応方針

本プロジェクトは Vite + React + SPA 構成のため、Next.js 前提の依存は不要:

1. `web/src/components/ui/sonner.tsx` から `next-themes` の import を除去
2. `theme` を `"light"` 固定に変更(または `useState` ベースのライト/ダーク切替に置換、本プロジェクトはダークモード未実装のため固定で OK)
3. `pnpm remove next-themes` で依存削除

##### 運用注意点

今後の `pnpm dlx shadcn@latest add` 実行時に Next.js 前提の依存が混入する可能性あり。**Vite + React 環境ではテンプレート生成後の `package.json` 差分確認 + 不要依存の除去** が必要。M7-03 以降の新規 shadcn/ui コンポーネント追加時にチェックリスト化:

- [ ] `pnpm dlx shadcn@latest add <component>` 実行
- [ ] 生成された `.tsx` ファイルの依存 import を確認
- [ ] Next.js 系依存(`next-themes` / `next/image` / `next/link` 等)があれば除去
- [ ] `package.json` 差分確認 + 不要依存を `pnpm remove`

##### 関連教訓

retrospective-log v1.0.25 §6.10 M7-02 製造担当の Plan Mode 反問運用知見と整合 = 製造担当の自主修正 + 設計担当への確認依頼(note §4)の運用パターンの一例。本プロジェクトの shadcn/ui エコシステムへの統合は **Next.js エコシステム前提との切り分け** が継続的に必要。

---

## 2. バックエンドの 3 層パターン

M1-03 以来、M3-04 character API でも踏襲済み。

- `internal/api/<domain>/handler.go`: HTTP レイヤー。リクエスト/レスポンス JSON 変換、エラー応答。
- `internal/service/<domain>/service.go`: ビジネスロジック、トランザクション境界、recipe_cache 等の
  付随処理。
- `internal/repository/<domain>/repository.go`: DB アクセス、SQL クエリ。

**適用例(M4)**: セットプレイ系の新規ハンドラは 3 層で実装。プリセット系は M3-05 で 5 ハンドラ統一の
対象として整備済みの既存 preset ハンドラを拡張する形。

### 2.1 サービス層インターフェース定義パターン(M6-1 で確立、v1.0.4 で追記)

M3-04 character サービス / M4-01 setup サービス / M6-01 config サービスで同一パターン採用済み(3 例で確立)。新規サービス層実装時は本パターンを踏襲する。

**パターンの構成**:

- サービスパッケージ(`internal/service/<domain>/`)に **`type Service interface { ... }` をエクスポート定義**
- 具体実装は **非公開構造体(`type service struct { ... }`)で隠蔽**
- コンストラクタ `func NewService(...) Service` は **インターフェース型を返す**(`*service` のような具象型ポインタを返さない)
- ハンドラ層のコンストラクタは `func NewHandler(svc <domain>.Service) *Handler` で **インターフェース型を受け取る**

**コード例**(M6-01 config サービス、製造担当が既存パターンに揃えて実装した形):

```go
// internal/service/config/service.go
package config

import "sync"

// Service は設定 API のサービス層インターフェース。
// ハンドラ層は本インターフェースを通じて設定値の取得・更新を行う。
type Service interface {
    Get() (cfg *appconfig.Config, isInitialized bool, err error)
    Update(req UpdateRequest) (updated *appconfig.Config, validationErrs []ValidationIssue, restartRequired bool, err error)
}

// service は Service インターフェースの具体実装(非公開)。
type service struct {
    mu         sync.Mutex
    cfg        *appconfig.Config
    configPath string
}

// NewService はサービス層のコンストラクタ。インターフェース型を返す。
func NewService(cfg *appconfig.Config, configPath string) Service {
    return &service{cfg: cfg, configPath: configPath}
}

func (s *service) Get() (...) { ... }
func (s *service) Update(...) (...) { ... }
```

```go
// internal/api/config/handler.go
package config

import configsvc "<...>/internal/service/config"

type Handler struct {
    svc configsvc.Service // インターフェース型で受け取る
}

func NewHandler(svc configsvc.Service) *Handler {
    return &Handler{svc: svc}
}
```

**本パターンの利点**:

- **テスト時のモック差し込みが容易**: ハンドラテストで `configsvc.Service` インターフェースを満たすモック構造体を渡せる(`httptest` でハンドラを単体テストする際に DB や設定ファイルに依存しない)
- **依存性逆転の原則(DIP)に整合**: ハンドラ層が具体実装ではなく抽象(インターフェース)に依存する
- **実装の差し替えが容易**: 将来サービス実装を変更しても、インターフェースが安定していればハンドラ層の改修が不要

**指示書執筆時の注意**(M6-1 反省踏襲):

- サービス層関数シグネチャをサンプルコードで書く際、`func NewService(...) *Service`(具象型ポインタ)で書かないこと
- 既存サービス層(M3-04 character / M4-01 setup 等)の実装慣例を `view` で確認してから書く
- 本パターンとの逸脱が必要な場合は、指示書本文に逸脱理由を明記する

**パターン化の経緯**(v1.0.4 で記録):

- M3-04 character / M4-01 setup で同一パターンが採用されていた事実が M6-01 製造担当の伝達事項(2026-05-23)で発覚
- M6-01 指示書 v1.0.0 §4.3.1 で設計担当(M6 期間担当)が `*Service` 具象型ポインタを返す形でサンプルコードを書いた(既存慣例未確認のミス、retrospective-log v1.0.18 §6.1 M6-1)
- 製造担当が実装で正しいパターンに修正、伝達事項で設計担当に通知
- v1.0.4 で本書 §2.1 として明文化、以降の新規サービス層実装はすべて本パターンを踏襲する

---

## 3. エラーレスポンス共通型(CHANGE-010 / CHANGE-011)

- **必ず `model.APIError` / `model.APIErrorResponse` を使う**(独自エラー型を新設しない)。
- バリデーションエラーは `Details: map[string]any{"validations": result}` 形式(CHANGE-011 §1.1)。
- HTTP ステータスコード・エラーコード文字列は既存値を維持(CHANGE-010 §3.4)。
- 後方非互換変更が必要な場合は CHANGE 通知書を伴う独立スコープとして処理する。
- **エラーレスポンスの構築は (a) `echo.Context.JSON(..., model.APIErrorResponse{...})` を直接書くか、(b) model 層の正準コンストラクタ `model.NewAPIError(code, message)` / `model.NewAPIErrorWithDetails(code, message, details)` を呼ぶ、のいずれか**。**per-handler / per-package の独自ヘルパは禁止**(L-03 = `comboErrResp` / `charErrResp` / `errResp` / `errRespDetail` 等の散在ヘルパがこれに該当。M7-05 で全削除し model 層正準コンストラクタに集約済み)。「独自ヘルパを増やさない」の意図は **per-package 散在の防止**であり、model 層の単一正準コンストラクタはこれに反しない(むしろ推奨形)。
- **HTTP レスポンスの `error.code` 文字列は lower_snake_case で統一**(M7-05 L-02 で既存多数派 = setup / preset / config / move の慣習に統一)。これは DES-006 が規定する `VAL-*` バリデーションコード(`details.validations[].code`)とは**別物**で、`error.code` の casing は設計書本体に規定がないため本節で正本化する(DES-006 規定対象外 = CHANGE 不要)。

### 3.1 API エラーレスポンスのフロント統一ハンドリング(M7-04-1 で確立、v1.0.11 で新設)

バックエンドの共通エラーレスポンス(本節 / DES-002 §4.3 = `model.APIErrorResponse`、`details.validations.issues` 形式 / `details.<任意キー>` 形式)を、フロントで統一的に解釈・表示するパターン。

- **`web/src/features/combo/errors.ts` の `parseComboApiError(err)`**: API エラーを `{ validations, duplicateIssue(VAL-C02), fatalMessage }` に分類するヘルパ。
- **表示は共有 `ValidationDisplay` コンポーネントに統一**し、ボタン横並び行の **外(全幅)** に配置する(「ボタンのような形」に崩れる旧表示の回避)。
- **適用箇所**: コンボの登録・編集・本登録昇格(M7-04-1 バグ #5)+ **セットプレイの登録・編集(`web/src/features/setup/errors.ts` の `parseSetupApiError`、M7-05 バグ #6 で適用)**。
- **踏襲方針**: HTTP 400 + `details.validations` を返す他フローも本ヘルパ + `ValidationDisplay` を踏襲する。**M7-05 バグ #6(セットプレイ VAL-S02、HTTP 400)は本パターンを再利用する前提**でよい。過剰な共通化(全エラー経路の一括抽象化)は避け、必要箇所ごとに適用する。

### 3.2 validating サービスを呼ぶ mutating ハンドラの 400 分岐網羅(M7-04-1 バグ #5 で顕在化、v1.0.11 で新設)

バリデーションを伴うサービスは `(戻り値=nil, result=バリデーション結果, err=nil)` を返す設計(成功 / 業務エラー / システムエラーの 3 値分離)。この場合、**全ての mutating ハンドラ(Create / Update 系)は `result.HasError() → 400 + details.validations` 分岐を必ず持つ** 必要がある(本節の共通エラーパターンのハンドラ層での網羅適用、DES-002 §4.3)。

- 分岐が欠落すると、ハンドラが `err==nil` でエラー処理を素通りし、`toResponse(nil, …)` で **nil ポインタ参照 → panic → 500** に化ける(本来 400 を返すべきケースで 500)。
- **M7-04-1 バグ #5 の真因** = `UpdateMetadata`(PATCH、本登録昇格経路)に本分岐が欠落していた(Create / UpdateWithKeyChange にはあった)。3 ハンドラとも整合済み(2026-06-03)。
- **チェック観点**: validating サービスを呼ぶハンドラを追加 / レビューする際は `HasError()` 分岐の有無を必ず確認する。playbook §4.7「新規エラー型の全ハンドラ列挙」と同系統の網羅性観点。
- **確認済み(M7-05)**: セットプレイ登録ハンドラ(`internal/api/setup/handler.go` `CreateSetup`)は **既に 400 分岐を持ち整合していた**(`TestHandler_CreateSetup_400_ValidationFailed` でカバー済み)。**バグ #6 の真因はバックエンドではなくフロント**(`SetupEditorPage` の登録経路に `onError` がなく VAL-S02 を表示していなかった = バグ #5 とは逆の層)。→ **教訓**: 真因レイヤは事前に決めつけず両層を確認する。バグ #5(フロント想定 → 実はバックエンド)と バグ #6(バックエンド想定 → 実はフロント)で **逆方向の取り違えが両方起きた**(retrospective-log §6.6 M7-16 の「真因レイヤの決めつけ」は双方向に効く)。これで Create / UpdateWithKeyChange / UpdateMetadata / CreateSetup の 4 ハンドラが 400 分岐整合済み。

---

## 4. 列挙定数の同期(playbook §4.8 / CLAUDE.md §4)

新規列挙定数を導入する場合の手順:

1. バックエンド側: `internal/model/<domain>.go` に `model.<Category|Status|Type|Code>` 定数を定義。
2. フロント側: `web/src/constants/<domain>.ts` に対応する定数を定義(camelCase で JSON タグと整合)。
3. 指示書執筆時に grep コマンド 3 種(CLAUDE.md §4 TypeScript 規約)を実行して同期確認。
4. リテラル文字列の散在を防ぐため、ハードコードを禁止する旨を指示書に明記する。

詳細な運用原則は playbook §4.8「列挙定数の即時同期原則」を参照。

---

## 5. ブラウザストレージ運用(CLAUDE.md §10.X)

- M3-03 で `web/src/lib/browser-storage.ts` 共通ヘルパを新設(JSON シリアライズ + try/catch のラッパ)。
- 機密情報・DB 永続化対象データには使わない(UI 状態保持のみ)。
- 確立済みキー: `combo-list-columns-v1`(M3-03)、~~`virtual-controller-layout-v1`(M7 予定)~~ ※フェーズ 3 以降に変更(2026-05-26 開発者方針)。~~`combo-draft-<id|new>-v1`(M6 予定)~~ ※CHANGE-016 で廃止。
- 許容用途・キー命名規則の詳細は CLAUDE.md §10.X を参照。

---

## 6. 調査担当運用パターン(v1.0.7 で新設、本プロジェクト 4 例の蓄積)

設計担当 Claude が新規マイルストーン着手前に「事実列挙のみの調査」を独立指示書化し、製造担当 Claude Code を Sonnet 4.6(または Opus 4.6)で **read-only 厳守 + 事実列挙のみ** の運用で起動するパターン。playbook §1.1 役割分離の応用で、本プロジェクトで 4 例運用済み(M5 期間以降に確立)。

### 6.1 確立された運用パターン

- **指示書命名**: `M{N}-RESEARCH-{NN}-{調査軸}-check.md`(例: `M7-RESEARCH-01-shadcn-ui-implementation-check.md`)
- **指示書 §0 構造**: 「この指示書の特殊性」節を冒頭に置き、(0.1) 製造担当として起動 + 調査だけ実施して閉じる運用 / (0.2) read-only 厳守 / (0.3) 判断・提案を含めない / (0.4) 本調査の主目的 / (0.5) 結果の扱い、の 5 サブセクションを記述
- **§4 調査内容**: 「事実のみ列挙」「コマンド例は参考、より効率的な手段が存在する場合は調査担当の裁量で変更してよい」を明示。`grep` / `view` の典型コマンド例を提示
- **§5 完了報告フォーマット**: 調査結果レポート `docs/instructions/M{N}-RESEARCH-{NN}-report.md` のテンプレートを指示書内で先行提示、「結論サマリ(調査担当による事実集約、最初に読む)」を冒頭に置く
- **特記事項節**: 想定外の発見・明らかな矛盾を **判断・提案を含めずに事実として** 記録、設計担当の指示書スコープ判断に活用
- **完了宣言**: レポート末尾の「調査担当からの完了宣言」で「本指示書 §0.2 read-only 厳守 + §0.3 判断・提案を含めない運用に従って事実列挙を完了した」を明記、セッションを閉じる

### 6.2 過去 4 例の蓄積

| 順番 | 指示書 | 調査軸 | 実施日 | 実施モデル | 主要成果 | 設計担当による活用 |
|------|-------|--------|--------|-----------|---------|-----------------|
| 初例 | M5-RESEARCH-01 | 比較 API 設計(7 項目)| 2026-05-22 | Sonnet 4.6 | 既存 API パターン網羅 + 案 1 / 案 2 の判断材料 | M5-overview §4.2 で案 1(`POST /api/combos/compare` を実装せず既存 `GET /api/combos/{id}` を N 件並列呼出)採用、CHANGE-015 起票根拠 |
| 2 例目 | M6-RESEARCH-01 | 設定 API + LAN バインド実装有無(2 項目)| 2026-05-23 | Sonnet 4.6 | 設定 API は未実装、LAN バインドは M1 実装済みと判明 | M6-overview §2.1 / §4.2 で M6-01 のスコープを「設定 API 基盤のみ」に縮小(当初想定の「LAN バインド + 設定 API 基盤」から縮小)、M6-01 の推奨モデルを Sonnet 4.6 に確定 |
| 3 例目 | M7-RESEARCH-01 | shadcn/ui 統一導入の前提(自作ラッパー 26 件網羅)| 2026-05-26 | Opus 4.6(開発者ご判断、トークン余裕)| 自作ラッパー 26 件 + 呼び出し元 18 件特定 + Props 命名揺れ + モーダル実装パターン分裂 + architecture-patterns §1 分離パターン逸脱 4 件発見 | M7-overview v1.0.1 §0.3.1 で結果反映、M7-01 / M7-02 スコープを M7-RESEARCH-01 報告書 §4.2 (d) shadcn/ui 対応表に基づき確定 |
| 4 例目 | M7-RESEARCH-02 | M1〜M4 レスポンシブばらつき(項目数 5)| 2026-05-27 | Opus 4.6(開発者ご判断、トークン余裕)| ブレークポイント使用 7 箇所のみ + 11 画面 0 件 + DES-005 規定との乖離 9 件発見 | M7-overview v1.0.1 §0.3.2 / §2.9 で本格スマホ UI のフェーズ 3 送り(案 Y 採用)+ CHANGE-017(DES-005 §4.4 整合化)起票根拠 |

### 6.3 設計担当による活用パターン(指示書作成時の参照経路)

設計担当 Claude が後続マイルストーン指示書を作成する際に過去調査結果を参照する経路:

1. **対象マイルストーン直前の調査結果**: 例 = M7-01 指示書作成時、M7-RESEARCH-01 + M7-RESEARCH-02 報告書を §3.1 必読ドキュメントに含める
2. **横断的な調査結果(過去マイルストーン)**: 例 = M7-02 着手前の Plan Mode で M5-RESEARCH-01 報告書を参照(過去 API 設計パターンの確認)
3. **本書 §6.2 蓄積表からの呼び出し**: 設計担当が「調査担当運用が必要か」を判断する際、本書 §6.2 で過去 4 例の規模感・実施モデル・成果を参照、新規調査の起票要否判断に活用
4. **retrospective-log §6.7(CHANGE-016 ハイブリッド分担)+ §6.6 M7-4(CHANGE-017 調査担当契機)との連動**: 調査担当運用は CHANGE 起票判断材料の供給源としても機能、CHANGE-017 はその初事例

### 6.4 起票要否の判断基準

- **起票推奨**: マイルストーン着手前に「設計書本体記述と実装の整合性確認」「既存実装パターンの網羅特定」が必要、かつ設計担当が直接 view / grep で確認するとコンテキスト圧迫リスクが高い局面
- **起票非推奨**: 設計担当が指示書 §3.4 着手前確認に「製造担当が view で確認」の項目を 2〜3 件含めれば十分な規模、または対象が極めて狭い(単一ファイル等)
- **分割推奨**: 調査軸が複数異質(M7 = UI コンポーネント網羅 + レスポンシブばらつき)、調査担当のコンテキスト管理 + 出力レポートの構造単純化のため分割
- **分割非推奨**: M5-RESEARCH-01(7 項目)/ M6-RESEARCH-01(2 項目)のように調査軸が単一系統で完結する規模

### 6.5 関連教訓

- **本パターンは playbook §1.1 役割分離の応用**: 設計判断は設計担当、機械的調査作業は調査担当 Claude Code、設計担当のコンテキスト温存と判断品質向上の両立
- **「想定外の発見が価値」運用の意義**: M7-RESEARCH-01 / M7-RESEARCH-02 では当初設計担当が想定していなかった構造的問題(モーダル実装パターン分裂 / Header 共通化未実装 / DES-005 規定との乖離 9 件)が発見され、後続マイルストーン指示書のスコープ判断に大きく影響した
- **CHANGE 起票判断材料の供給源としての価値**: CHANGE-017 のように「着手前調査で発見された乖離 → 設計担当が CHANGE 起票判断」の新ワークフローを確立、retrospective-log §6.6 M7-4 / §6.7 CHANGE-016 ハイブリッド分担と並ぶ CHANGE 関連運用知見

---

## 7. リストを含む Dialog の scroll 制約パターン(v1.0.8 で候補新設、v1.0.9 で正式化、M7-02 適用結果反映)

M7-01 LinkExistingSetupModal で発生・修正済みの事象を踏まえた **パターン候補の前置き記録**。M7-02 で全 Dialog 一括適用検討 + 正式パターン化判断を行う(retrospective-log §6.6 持ち越し課題「伝達 2」と連動)。

### 7.1 確立経緯

M7-01 製造工程で LinkExistingSetupModal の動作確認中、候補セットプレイリストが長い場合に Dialog がビューポートからはみ出して下部リストが見えなくなる事象が発生。修正方法 = `DialogContent` に `max-h-[85vh] overflow-y-auto` 系の制約を加える(または内部リスト要素に `max-h` + `overflow-y-auto` を付与)。M7-01 機械レビューで受け入れ済み(M7-01 製造工程完了報告 伝達 2)。

### 7.2 根本原因

shadcn/ui の `DialogContent` はデフォルトで以下を持たない:
- `max-h` / `max-height` 制約
- `overflow-y-auto` / `overflow-y-scroll` スクロール対応

= **コンテンツが長い場合、Dialog 自体がブラウザビューポートを超えてはみ出す**。shadcn/ui のデフォルト動作として一般的だが、リストを内包する Dialog では UX 問題に直結する。

### 7.3 同種の潜在事象

M7-01 完了時点で同様のリスクを持つ Dialog 系コンポーネント(retrospective-log §6.6 持ち越し課題「伝達 2」由来の特定):

- **AddComboToCompareModal**(候補コンボリスト): データ量次第で発生可能性
- **SetupSelectorModal**(候補セットプレイリスト): 同上
- **KnockdownAdvantageChangeModal**(individual モードのチェックボックスリスト): 紐付くセットプレイ数次第で発生可能性
- その他、リストを内包する任意の Dialog で潜在

### 7.4 パターン候補の方針

#### 候補 (a): 全 Dialog に統一的に max-h + overflow-y-auto を適用

`DialogContent` のデフォルトスタイルに `max-h-[85vh] overflow-y-auto` を統一適用(`components/ui/dialog.tsx` の DialogContent コンポーネント編集)。リストを含まない Dialog にも適用される代償あり(ただし副作用は小さい想定)。

#### 候補 (b): リストを含む Dialog のみ個別に max-h + overflow-y-auto を適用

各 Dialog の呼び出し側で `className="max-h-[85vh] overflow-y-auto"` 等を渡す。判定が呼び出し元責任になるため漏れリスクあり。

#### 候補 (c): 内部リスト要素のみに max-h を適用

Dialog 全体ではなくリスト要素(`<ul>` / `<div role="listbox">` 等)に `max-h-[60vh] overflow-y-auto` を付与。Dialog header / footer がスクロールせず常時可視になる利点あり、ただしリスト以外のコンテンツが長い場合は対応漏れ。

### 7.5 確定判断(M7-02 完了承認時、v1.0.9 で正式化)

設計担当 Claude(M7 期間担当)の **暫定推奨どおり** 候補 (c) を基本 + 候補 (a) を fallback の二段構えで M7-02 適用完了(2026-05-31 完了承認):

- リストを含む Dialog 5 件(LinkExistingSetupModal / AddComboToCompareModal / SetupSelectorModal / KnockdownAdvantageChangeModal individual モード等)の内部リスト要素に `max-h-[60vh] overflow-y-auto` を付与(候補 c)
- `web/src/components/ui/dialog.tsx` の DialogContent デフォルトスタイルに `max-h-[85vh] overflow-y-auto` を追加(候補 a fallback、shadcn/ui CLI 生成コードへの独自カスタマイズ = 例外条項)

M7-02 機械レビュー + 開発者 E2E で動作確認完了、本プロジェクトの **正式パターン** として確立。今後の Dialog 系新規追加時は本パターン踏襲。

##### v1.0.10 追記(2026-06-01、§7.7 との相互参照)

M7-02 完了承認時に正式化した本パターン(候補 (c) 基本 + 候補 (a) fallback)からの逸脱事例が M7-03 製造工程で発生したため、本 v1.0.10 で **§7.7 禁止事項を新規追加**(M7-03 製造担当伝達 3 由来)。§7.7 = 本 §7.5 の補完(「こうする」+「こうしてはいけない」の両面で予防効果)。

### 7.6 関連教訓

- retrospective-log v1.0.25 §6.6 持ち越し課題「伝達 2」= **解消済み**(M7-02 完了承認 2026-05-31)
- §1.2.6 例外条項(Dialog scroll 制約)で言及(候補から正式に昇格)
- 本パターンは M7-02 完了承認時に正式化完了、M7-03 以降の Dialog 系新規追加時は本パターン踏襲

### 7.7 禁止事項(v1.0.10 で新設、2026-06-01、M7-03 製造担当伝達 3 由来)

§7 の Dialog scroll 制約パターン正式化(M7-02 §7.5 確定判断)を踏まえ、**実装してはならない逸脱パターン** を本節で明示する。本プロジェクト初の「こうしてはいけない」明示パターン = 「こうする」パターン(§7.4 候補 (a)/(b)/(c) + §7.5 確定判断)の補完。

#### 7.7.1 確立経緯

M7-03 製造工程で AddComboToCompareModal の初回実装時、製造担当が DialogContent に以下を誤付与:

```tsx
<DialogContent className="max-h-[70vh] flex flex-col">
  {/* ... */}
</DialogContent>
```

**逸脱の原因**: M7-01 完了時点で AddComboToCompareModal は shadcn/ui 化済みだったが、DialogContent に `flex flex-col` パターンが残存していた。M7-02 で §7.5 確定判断(候補 (c) + (a) 二段構え)が確立した後、本パターンを正規として置き換えるべきだったが、M7-01 状態のまま温存されていた。M7-03 製造担当が AddComboToCompareModal の修正時に M7-01 状態を踏襲する形で `max-h` を追加 = M7-02 確立パターンと乖離した実装になった。

機械レビューで指摘 → 修正完了 → M7-03 完了承認スコープ編入。

#### 7.7.2 禁止事項

##### (a) DialogContent への直接適用禁止

`DialogContent` 自体に以下を **付与してはならない**:

- `max-h-[XXvh]` / `max-height: XXvh`(直接の高さ制限)
- `flex flex-col`(flexbox レイアウト直接適用)
- `overflow-y-auto` / `overflow-y-scroll`(直接のスクロール制御)

これらを DialogContent に直接付与すると、§7.2 根本原因の「shadcn/ui の DialogContent デフォルト動作との競合」が発生し、リスト含む / 含まないに関わらず Dialog 全体の挙動が崩れる可能性がある。

代わりに **§7.4 候補 (c)** = 内部リスト要素(`<div>` / `<ul>` / `role="listbox"` 等)に `max-h-[60vh] overflow-y-auto` を付与すること(候補 (a) fallback は §7.5 で承認された `dialog.tsx` の DialogContent デフォルトスタイルへの統合のみ許容、それ以外は DialogContent への直接付与禁止)。

##### (b) 過去 M7-01 状態の踏襲禁止

M7-01 完了時点で AddComboToCompareModal は `DialogContent` に `flex flex-col` パターンが残存していたが、M7-02 で Dialog scroll 制約パターン(§7.5 確定判断)が確立した後は **本パターンが正規**。今後の Dialog 系コンポーネント追加 / 修正時は M7-01 状態ではなく M7-02 確立パターンを踏襲すること。

##### (c) 確認手順

新規 Dialog 系コンポーネント追加時 / 既存 Dialog 修正時の確認:

- [ ] DialogContent 自体に `max-h-[XXvh]` を付与していないか
- [ ] DialogContent 自体に `flex flex-col` を付与していないか
- [ ] DialogContent 自体に `overflow-y-auto` を付与していないか
- [ ] リスト含む Dialog の場合、**内部リスト要素** に `max-h-[60vh] overflow-y-auto` を付与しているか
- [ ] `dialog.tsx` の DialogContent デフォルトスタイル(`max-h-[85vh] overflow-y-auto`)が継続適用されているか(M7-02 §7.5 候補 (a) fallback)

#### 7.7.3 関連教訓

- §7.5 確定判断(M7-02 完了承認時)で確立した正規パターンを **過去状態の踏襲で崩さない** ことが本禁止事項の最重要意図
- マイルストーン間のパターン継承問題への対策として、**「こうしてはいけない」を明示** することで予防効果を生む(retrospective-log v1.0.26 §7.2 M7-3 候補「マイルストーン間の実装パターン分裂の見逃し」の間接的補強)
- 本プロジェクトの他の正式化済みパターン(§1 / §1.1 / §1.2 / §2 / §3 / §4 / §5 / §6 / §8)にも同種の「禁止事項明示」を横展開する候補 = フェーズ3 着手時に検討予定(retrospective-log v1.0.26 §6.4 playbook 改訂候補に関連)

#### 7.7.4 確認ツールとしての活用

本 §7.7.2 (c) 確認手順は **製造担当 + 機械レビュー担当の両方** で使用:

- **製造担当**: Dialog 系コンポーネント実装時に自己チェック
- **機械レビュー担当**: M7-04 以降の機械レビューチェックリストで Dialog scroll 制約パターン確認時の参照点

機械レビューチェックリスト(M7-04 以降)に「§7.7 確認手順の遵守」を追加する候補(設計担当の M7-04 期間担当への申し送り、handover_2 経由)。

---

## 8. react-hook-form + zodResolver + shadcn/ui Form 統合パターン(v1.0.9 で新設、M7-02 TagFormDialog で確立)

M7-02(2026-05-31 完了承認)で TagFormDialog の D-4 分離パターン逸脱解消 + Form 化を統合実施した際に確立されたパターン。M7-03 以降の新規フォーム実装 + 既存自作ラッパー Form 系の追加移行時に踏襲する。

### 8.1 採用方針

shadcn/ui Form コンポーネントは内部で react-hook-form + zodResolver(zod バリデーション)との統合を前提とした設計。本プロジェクトでは以下を採用:

- **`useForm`(react-hook-form)+ `zodResolver`(`@hookform/resolvers/zod`)+ shadcn/ui `<Form>` / `<FormField>` / `<FormItem>` / `<FormLabel>` / `<FormControl>` / `<FormMessage>` 構造**
- **バリデーションロジックは zod スキーマで定義**(コンポーネント内 useState で個別管理しない)
- **フォーム状態管理はロジックフックに分離**(architecture-patterns §1 プレ層/ロジック層分離 + §1.2 shadcn/ui 統一導入パターンと整合)

### 8.2 確立事例: TagFormDialog(M7-02 D-4 解消)

```ts
// web/src/features/tag/hooks/useTagFormDialog.ts(新設、M7-02 確立)
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const tagFormSchema = z.object({
  name: z.string().min(1, "タグ名を入力してください").max(50, "50文字以内で入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "正しいカラーコードを入力してください"),
});

type FormValues = z.infer<typeof tagFormSchema>;

export function useTagFormDialog(tag: Tag | null, onSubmit: (values: FormValues) => Promise<void>) {
  const form = useForm<FormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: tag ?? { name: "", category: "general", color: "#000000" },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return {
    form,
    handleSubmit,
  };
}
```

```tsx
// web/src/features/tag/components/TagFormDialog.tsx(presentation-only)
export function TagFormDialog({ form, handleSubmit, ... }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タグ名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />  {/* zod スキーマのバリデーションエラーがここに自動表示 */}
                </FormItem>
              )}
            />
            {/* 他フィールド同様 */}
            <Button type="submit">保存</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### 8.3 パターンの利点

1. **バリデーションロジックの一元管理**: zod スキーマ 1 箇所に集約、コンポーネント / ロジックフック / テストで再利用可能
2. **型安全**: `z.infer<typeof schema>` で型推論、`FormValues` 型がスキーマと一致を保証
3. **入力中バリデーション**: react-hook-form の mode 設定で blur / change / submit のタイミング制御
4. **`<FormMessage>` で自動エラー表示**: 各フィールドのバリデーションエラーが UI に自動反映、個別 useState 不要
5. **分離パターン整合**: ロジックフック(`useTagFormDialog.ts`)に状態 + バリデーション + 送信ロジックを集約、コンポーネントは presentation-only
6. **テスタビリティ**: ロジックフックの単体テスト + presentation コンポーネントの DOM テストで分離

### 8.4 適用範囲

##### 既適用(M7-02 確立)
- `tag/TagFormDialog.tsx` + `useTagFormDialog.ts`(D-4 解消、確立事例)

##### 適用候補(M7-03 以降)
- `combo/ComboEditorBasicFields.tsx`(M7-02 で shadcn/ui Form ベース移行済み、ロジックフック分離は今後検討)
- `setup/SetupBasicInfoForm.tsx`(同上)
- フェーズ3 以降の新規フォーム実装(認証 + LAN モード等)

##### 適用除外(慎重判断)
- 単純な状態管理のみのフォーム(複雑なバリデーションが不要な場合は react-hook-form 採用コストが利得を上回る判断あり、retrospective-log v1.0.25 §6.10 M7-9 由来の判断軸 = 型構造差異 + 重複範囲 + コスト評価)

### 8.5 関連教訓

- §1.2 shadcn/ui 統一導入パターンと整合(案 β = shadcn/ui 標準 API 準拠)
- §1 プレ層/ロジック層分離と整合(ロジックフックに状態 + バリデーション集約)
- retrospective-log v1.0.25 §6.6 持ち越し課題(伝達 1 cmdk 不採用)+ §6.10 Plan Mode 反問運用知見(M7-9 型構造差異評価)との連動 = 適用判断時の評価軸として参照
- 過剰な統合(`useForm` を全フォームに強制適用)は §1.3 ジェネリック化のしすぎアンチパターン回避(retrospective-log §1.3)、複雑なバリデーションを伴うフォームに限定して採用する判断軸

---

## 9. custom_states 拡張ポイントと recipe_cache 無効化(M7-04-2 で確認、フェーズ2/3 設計前提)

M7-04-2(複数キャラ追加 + スキーマ耐久)で確認された、フェーズ 1 時点のアーキテクチャの既知状態。**フェーズ2(custom_states)/ フェーズ3(recipe_cache・プリセット)で該当機能を作る際の前提**として記録する。

### 9.1 custom_states は phase-1 では「保存 + API 返却」のみ(消費・表示・参照は未実装)

- `characters.custom_states`(DES-003 §3.2、JSON 列)はバックエンドが JSON 文字列を保持して API 返却するのみ。**combos / combo_steps / modifiers から参照されず、フロント表示 UI もない**(型定義に `customStates?` はあるが未使用)。
- 帰結: 「custom_states を持つキャラ(AKI = 毒、ジェイミー = 酔いレベル)の耐久を確認した」の実効範囲は **「seed 投入 → API ラウンドトリップ → 当該キャラのコンボが破綻しない」までに限定**。毒・酔いレベルがレシピ・状況・バリデーションに作用する経路は存在しない。
- **フェーズ2(M11)での扱い(2026-06-20 開発者方針で確定)**: M11 は開始時状態の**付与・表示・参照のみ**を機能化する(boolean のトグル + int の開始時数値入力 = 案B。値は `combos.situation` の `custom_states` キーに保持)。**状態の消費セマンティクス**(コンボ中の減少・レベルで使用可能技が変わる・レシピ表記への反映・バリデーション連動)は **アプリでは構築しない(利用者がコンボ notes で管理)。将来の利用者要望次第で検討する可能性はあるが現時点では実装しない**。したがって DES-003 §3.2 が custom_states の**定義構造のみ**規定し消費セマンティクスを未規定にしている現状は、M11 では**そのまま据え置く**(消費を作らないため新規規定は不要)。M11 で CHANGE を起こす中心は DES-005 §5.6/§5.7(situation の機能化)で、DES-003/004/006 はデータ正典化・検証要否の判断結果に応じてのみ。**この方針以前(v1.0.12〜)の本節は「消費セマンティクスはフェーズ2 設計=CHANGE 見込み」と記していたが、消費非構築の確定によりフェーズ2 の作業は付与・表示・参照に限定される**。
- retrospective-log v1.0.28 §6.6 M7-04-2 ブロック B-2 と対。

### 9.2 recipe_cache の無効化はプリセット/エイリアス変更時に未実装(SUPP-001 §7 は既定済み)

> **★【2026-08-14・M20-05 で解消】本節の「未実装」は失効した。** **プリセットの作成・エイリアス更新・削除、および既定プリセットの切替から再計算が呼ばれるようになった**（`CHANGE-102`）。**エイリアスを編集すると既存コンボ・セットプレイの表示が同じ手番で追従する。**
>
> **★as-built で分かった性質を 2 つ残す**——**(1) `RecomputePresetCache` は書き込みトランザクションの外（コミット後）で呼ぶ**（内側で呼ぶとコミット前のエイリアスを読み、古い表記を silent に書く＝`SUPP-001` §7.1.1）／**(2) 既定プリセットの固定値は 3 か所あり、3 つとも撤去して注入 1 か所へ寄せた**（`SUPP-001` §7.4.1 は失効）。
>
> **★eager は据え置き。** **実測は 53 エンティティ・212 move step で 5.5〜6.5 ms**（**D-292** の閾値条件は生きている＝followup `recipe-cache-recompute-scale-unmeasured`）。

> **★【2026-08-13・M20-04 で状態が変わった】本節の「未実装なのはトリガを引く機能自体がフェーズ3 だから」という説明は失効した。** **プリセット管理 UI（トリガを引く面）は M20-04 で実装され、実在する。**
>
> **★あわせて実測で分かったこと**——**再計算のメソッドは既に実装済みで、本番の呼出元が 0 件である**（`RecomputePresetCache` ／ `DeletePresetCache`。いずれもテスト以外から呼ばれていない）。**⇒ `M20-05` は「層を作る」サブではなく「既にある 2 メソッドを配線する」サブである。** **`DeletePresetCache` は `*sql.Tx` を取るため、M20-04 が作った削除トランザクションへそのまま挿せる。**
>
> **★現在の as-built**（M20-04 の実測）——**作成直後は壊れない**（キャッシュミス時に遅延計算して書き戻す）／**エイリアス編集の直後は古い値が残り、stale な表記が出る**／**削除の直後は当該 `preset_id` のキーが JSON 内に孤児として残る**（実害なし・JSON が肥大する）。**⇒ これが `M20-05` の入口である。**


- `service/notation` の recipe 解決は **recipe_cache にキーがあれば再計算せず返す**。再計算は combo の作成/更新/復元(`RecomputeComboCache`)経由のみ実装済み。
- **プリセットのエイリアスを後から追加・編集してもキャッシュ済みコンボの recipe_cache は自動更新されず stale になる**。ただしこれは **設計のギャップではなく実装未完**: SUPP-001 §7 は「プリセット新規作成時 = 当該プリセット × 全コンボ分を再計算(バッチ)」「プリセット エイリアス編集時 = 当該プリセットの recipe_cache 全エントリ再計算」を既定済み。**未実装なのはトリガを引く機能(プリセット管理 UI / エイリアス編集)自体がフェーズ3(P-1 = B-2、DES-004 §6)だから**。
- **フェーズ3 の前提**: **残り 2 プリセット**（`numeric` / `srk`）のエイリアス整備（**2026-08-12 是正・M20-01 as-built**。**旧記載「残り 4 プリセット」は失効**——**初期プリセットを 3 種へ再整理したため**＝ボード **D-288** / **D-299** / **D-300**。**同じ事実を持つ `followup-backlog` §B は 2026-08-12 に先に直っており、本書だけが取り残されていた**＝教訓 `E-118`） / プリセット管理 UI 着手時に SUPP-001 §7 の再計算を実装する。製造担当案の **「遅延無効化(lazy)」を採用する場合は SUPP-001 §7 の「即時再計算(eager)」からの設計変更**にあたり、§7 改訂 + パフォーマンス考慮(§7 = 1000 件規模の同期バッチ)が必要。
- 今回の実害なし: M7-04-2 の seed コンボ(36 件)はフェーズ 1 前提(空プリセット = official_ja_move フォールバック = 全プリセット同一文字列)で recipe_cache 投入済みだが、当該 seed コンボは M7-05 で全クリア予定。
- retrospective-log v1.0.28 §6.6 M7-04-2 ブロック B-3 と対。

## 10. 配布・LAN 利用の既知制約(M7-06 で確認)

フェーズ 1 完了時の配布構成(単一バイナリ + LAN 共有)で確認された運用上の既知制約。**設計書本体(DES-002 §11/§14)は LAN 利用を規定するが、以下は環境依存の運用注意であり保証外**として本節に記録する(DES-002 本体には規定として加えない = CHANGE 回避)。

### 10.1 LAN 利用は inbound ファイアウォール許可が前提

- LAN 共有モード(`0.0.0.0:PORT` バインド)で他端末(スマホ等)から接続するには、ホスト OS の **inbound ファイアウォールで当該ポートの許可が必要**。
- **サードパーティ AV / セキュリティ製品(例: Norton)が Windows ファイアウォールを代替制御するケースがあり、その場合 Windows 標準のファイアウォール設定では解決しない**(当該製品側で許可が必要)。製品ごとに設定箇所・挙動が異なり、本アプリでは保証外。
- 利用者向けには README にトラブルシュートを記載済み(M7-06)。起動時案内(stdout、SUPP-001 §5.6)でも FW/AV 許可のヒントを表示する。
- M7-06 の開発者 E2E では Norton の許可設定後にスマホ LAN 接続が成立(U-1 検証済み)。

## 11. データアクセス・永続化の既知パターン(M19-03 期に確立)

### ★★接続単位の PRAGMA は DSN で入れる（**M19-03 期に問題を確認・M23-10 で対処済み**）

**`PRAGMA foreign_keys` は接続単位の設定である。** `*sql.DB.Exec` で `PRAGMA foreign_keys = ON` を流しても、**プール中の 1 接続にしか適用されない。** **⇒ 後から張られた接続は OFF のままになる。**

**★★2026-08-23 の実測**（現行実装のまま 16 接続を同時に張って読んだ値。**`M23-10` の Plan Mode 実査**）。

| PRAGMA | 効いていた接続 | 効いていないときの状態 |
|---|---:|---|
| `foreign_keys` | **1 / 16** | **`ON DELETE CASCADE` が発火しない** |
| **`busy_timeout`** | **1 / 16** | **`0`**＝**書き込み競合で即座に「ビジー」を返す** |
| **`synchronous`** | **1 / 16** | **`FULL`**＝**想定より遅い** |
| `journal_mode` | **16 / 16** | （**DB 単位で永続化される設定であり、接続単位ではない**） |

**★★射程は `foreign_keys` だけではない。** **`M19-03` 期の記述は FK だけを挙げていたが、実際は接続単位の PRAGMA すべてが同じ形で失効していた。** **★とくに `busy_timeout` と `synchronous` は、FK と違って「壊れている」と気づく契機が無い**——**症状が出にくく、出ても原因に結びつかない。**

**⇒ 書き方（`M23-10` で確立）。**

- **★★接続単位の設定は、接続文字列（DSN）で入れる。** **プール確立後に `Exec` で流さない。** 使用しているドライバは接続を生成する関数の中で DSN のパラメータを適用するため、**プール中の全接続へ効く。**
- **★パスは `file:` URI 形式にし、パーセントエンコードする。** **ドライバは DSN を最初の `?` でパスとクエリに割るため、`file:` 接頭辞が無いと `?` を含むパスが切り詰められる。**
- **★★それを守り続けるテストを同時に置く。** **プールへ複数の接続を同時に保持したうえで、1 本ずつ PRAGMA の値を読む。** **接続を 1 本ずつ取って返す形にしてはいけない**——**プールが同じ接続を使い回すため、壊れていても緑になる。**
- **★検査は 4 種すべてを見る。** **FK だけを守ると、同じ形で戻された残り 3 つを取り逃がす。**

**★★マイグレーション接続が FK=OFF であることは、欠けではなく意図である**（`M23-10` 実査で確認）。**マイグレーション実行側は接続を独自に開いており、上記の経路を通らない。** **表を作り直すマイグレーションを FK=ON で走らせないための構造でもある。** **⇒ 「揃っていない」と読んで揃えにいかないこと。揃えた瞬間に表の作り直しが壊れる**（**`D-494`**＝**理由のある非対称は理由ごと残す**の適用例）。

**★既存の明示削除・明示再ポイントは撤去していない**（`combos` / `setups` / `presets`）。**二重の保険として残してある。** **★ただし「FK が効かないから明示削除する」はもう理由ではない**——**理由は「保険」であり、その代償は「新しい子表が増えたときに書き忘れる」ことである。** 詳細は下の「明示削除と CASCADE 依存の非対称」。

### ★明示削除と CASCADE 依存の非対称は、揃えない（M23-10 期に確定）

**実行時に親を消す 4 経路のうち、`tags` だけが明示削除を持たず CASCADE に依存している**（`combos` / `setups` / `presets` は明示削除済み）。

**★★この非対称は揃えない**（**D-535**）。**揃えるなら向きは「`tags` に明示削除を足す」ではない。**

| 観点 | 明示削除あり | CASCADE 依存 |
|---|---|---|
| 挙動 | 正しい | **正しい**（根治後は確実に発火する） |
| 新しい子表が増えたとき | **★書き忘れると子行が残る** | **何もしなくても消える** |
| その忘れやすさを埋めるもの | **`combos` 側は「スキーマから子表を列挙して全部空になったか主張する」テストを持つ** | 不要 |

**⇒ `tags` に明示削除を足すと、同等の検出テストが無いまま忘れやすさだけが増える。**

**★★将来問うべきは逆向きである**——**`combos` 側の明示削除は `P-04` の遺産として残っている形であり、いずれ「撤去してよいか」を問う番が来る。** **★ただし今は問わない**——**回帰ゲートを置いたばかりで、それが守り続けている実績がまだ無い。**

### ★★FK=ON だけで回るテストは、CASCADE → 明示削除の変更を 1 行も守らない（M23-08 期に確立）

**CASCADE 依存を明示削除へ移す作業では、FK を一切適用しない生接続で回す枝を必須にする。**

**★根拠は実測である**（`M23-08` の破壊確認）——**明示削除を 1 表分わざと消したとき、`fk_on` の枝は PASS したまま `fk_off` の枝だけが赤になった。** **CASCADE が代わりに消すためである。** **⇒ FK=ON の枝しか無いテストは、明示削除が丸ごと消えても緑を返す。守っているのは「行が消えること」であって「明示削除が在ること」ではない。**

**★★`M23-10` が `P-04` を根治した後も本則は有効である。** 根治で変わったのは「FK が確実に発火するようになった」ことであり、**明示削除そのものは `combos` / `setups` / `presets` に残っている**（上の非対称の項を参照）。**むしろ根治後のほうが危ない**——**FK が常時 ON になったことで、明示削除を消しても FK=ON の枝はいっそう確実に緑を返す。**

**⇒ 具体形**: 明示削除を持つ表の子行削除を主張するテストは、**`fk_on` / `fk_off` の 2 枝で回す**。先例＝`service/combo/setup_results_carry_test.go`（`M23-08` より前から同じ形を持っていた）。

### 関連テーブルを足すときは、親の「削除」だけでなく「識別キー変更」「論理削除」も確認する

外部キー整合を設計するとき `ON DELETE CASCADE` は考えるが、**親の識別キーが変更される経路**は見落としやすい。本プロジェクトには「コンボの識別キーを変更編集すると関連行の親 ID を旧→新へ再ポイントする」既存機構があり、**新表もそこに乗せなければ、ユーザーが実機検証した記録が編集のたびに失われる**。

- **`ON UPDATE CASCADE` と明示再ポイントは択一ではなく両方必須**である——前者が無いと変更操作自体が FK 違反で失敗し、後者が無いと FK 強制が効いていない接続でデータが消える（上記と複合）。
- **再ポイントの実装形は FK 親の段数で変わる。** 親が `combos`（1 段）か `combo_setups`（複合キー・1 段深い）かで書き方が違う。**親が何であるかを先に確定させる。**
- **論理削除では CASCADE が効かない**（物理削除にしか効かない）。参照側は `deleted_at` を明示的に除外する必要がある。

### 接続表（中間テーブル）の両端でスコープが違うとき、「絞り込み」と「置換」は必ず同じ手番で入れる（M22-02 期に確立）

**接続表が繋ぐ 2 つの実体のうち片方が共有・片方が個人スコープのとき、接続表自身は利用者の列を持たないことがある。** 本プロジェクトの実例は **`combo_tags`**——**コンボ（共有・`FR013` により作成者の概念を持たない）とタグ（個人・`tags.user_id NOT NULL`）を繋ぐが、`combo_tags` は `(combo_id, tag_id)` だけを持つ。**

- **★読み出しだけを利用者で絞ると、「全消し ＋ 挿入」型の置換が他人の紐づけを消す。** 画面には自分のタグしか出ていないため、**利用者は自分が何を消したのか見えない。**
- **★逆に置換だけを絞って読み出しを絞らないと、他人のタグが自分の画面に出る。**
- **⇒ 「絞り込み」と「置換」は必ず同じ手番で入れる。** **片方だけだと「双方の画面に何も出ないまま他人のデータが消える」という最悪の形になる。**
- **★設計時に「この表の両端のスコープは同じか」を 1 行問うだけで防げる。** 両端が同じスコープなら本項は当たらない。

### 論理削除された親の子は、物理的に残る（M22 期の実測）

**`deleted_at` を持つのは `combos` と `setups` の 2 表だけであり、子は持たない**（`combo_steps` / `combo_tags` / `combo_setups` / `combo_oki_options` / `setup_steps` / `combo_setup_results`。**範囲＝`code-facts.md` §10・2026-08-19 生成**）。**子はいずれも親を `ON DELETE CASCADE` で参照するが、CASCADE は物理削除にしか効かない。**

- **⇒ 親を論理削除しても、子は行として残り、親を指したままである。**
- **★したがって「復元」は子を作り直す作業ではなく、親の `deleted_at` を戻せば子が繋がったまま復帰する形になりうる。** **ただし参照側が `deleted_at` を明示的に除外していることが前提であり、除外していなければ削除済みの親が子経由で見える。**
- **★あわせて上記「SQLite の外部キー強制は接続単位」の問題が重なると、物理削除でも CASCADE が発火しない可能性がある。**
- **★★2026-08-20 追記——セットプレイの例外は解消した。** **一時期、本項の一般化は `setups` には当てはまらなかった**〔論理削除の処理が中間表の行を明示的に物理削除しており、`deleted_at` を戻しても紐付けが戻らなかった〕。**`M23-02` がその明示削除をやめたため、`setups` も本項どおりになった**（**D-494**）。
- **★撤回には代償があった。** **紐付けを保つと、「中間表の行は必ず生きた親を指す」という不変条件が消える。** **その不変条件に寄りかかっていた件数の数え上げ・存在チェックが、同じ手番で是正の対象になった**（下の「不変条件を壊したら」を参照）。**⇒ 本項どおりに揃えること自体が無償ではない。揃える変更を計画するときは、その表を親へ結合せずに読んでいる箇所を先に数えること。**

### ★★論理削除された親を参照する機能を足すときは、機能ごとに「出すか出さないか」を決める（M23 期に確立）

**上の「論理削除された親の子は、物理的に残る」の続きであり、実務上はこちらのほうが頻繁に効く。**

**`deleted_at` を持つ表は `combos` と `setups` の 2 つだけである。** ところが**この 2 つを参照する機能は多数あり、しかも増え続ける。** **⇒ 「論理削除された行を出すか出さないか」は、表の設計で 1 回決まる話ではなく、参照する機能を足すたびに決める話である。**

**★これは「バグを潰す」作業ではない。** 除外が要る機能と、要らない機能と、**除外してはいけない機能**が実在する。**一律に述語を足すのは誤りであり、一律に足さないのも誤りである。**

#### 新しく `combos` / `setups` を参照する読み取りを書くときのチェック

1. **この読み取りの結果は、最終的に利用者の目に触れるか。** 触れるなら、**ゴミ箱にある行が混ざって見えてよいか**を決める。
2. **触れないとしても、判定に使われるか。** **★ここが最も見落とされる**——件数の数え上げ・存在チェック・重複チェックは画面に出ないが、**混ざると挙動が変わる。**
3. **ゴミ箱にある行を「意図的に」引く読み取りか。** そういう機能は実在する（復元・完全削除の前チェックなど）。**その場合は除外してはならず、意図を関数名かコメントで残す。** **書かないと、後任が「穴が残っている」と読んで塞ぎ、その瞬間にその機能が壊れる。**
4. **同じ関数の戻り値が、表示と判定の両方で使われていないか。** **★片方に合わせて述語を足すと、もう片方の意味が黙って変わる。** 分けるか、変わることを承知で揃えるかを決める。
   **★★2 つの役割が同じ答えを求めるとは限らない**（2026-08-20 追記・**D-495**）。**表示は「いま見えているものだけ」を求め、判定は「復元されうるものも含めて」を求めることがある。** **⇒ 求める答えが違うと分かったら、述語を足すのではなく関数を分ける。** **同じ関数のまま揃えると、緩めた側の判定が静かに破れる。**
   **★呼び元の数も先に数えること。** **共有ヘルパは呼び元が複数あり、片方だけ直すと同じヘルパの半分だけが不変条件を回復した状態になる**（`M23-02` 実例＝1 本のヘルパに呼び元 2 つ）。**⇒ 「N か所直す」という指示を受けたら、その N が関数の数か症状の数かを確かめる。**
5. **決めた結果を、除外しない側についても書き残す。** **★「述語が無い」は、意図なのか書き漏らしなのか、コードからは区別がつかない。**

#### 判断の軸——**意図の記述の有無ではなく、利用者に誤った状態が見えるか**

**意図の記述は手がかりであって根拠ではない**（M23 期の実測では、記述が無いのに同一ファイル内で対になる SQL とだけ非対称になっている箇所と、記述があって非対称が正しい箇所の両方が在った）。**⇒ 記述で判断せず、次の順で見る。**

| 段 | 問い | 該当したときの既定 |
|---|---|---|
| 1 | **除外すると、その機能自体が成り立たなくなるか** | **除外しない。** 意図を名前かコメントに残す |
| 2 | **除外しないと、利用者に誤った状態が見えるか** | **除外する。★ただし下記の但し書きを読むこと** |
| 3 | **除外しないと、判定の母集団が変わるか** | **除外する。** ただし**母集団が変わることを実測してテストを 1 本立てる** |
| 4 | **どちらでも実挙動が変わらないか** | **どちらでもよい。** 変えるなら「揃っているほうが読みやすい」を理由にしてよいが、**既存の意図の記述を覆すときは、その記述が挙げていた理由を数え直してから覆す**（`E-158`） |

#### ★★段 2 と段 4 は、その結果を誰がどう引くかまで辿ってから決める（M23-03 で実測）

**段 2 は「利用者に見える」という主張である。** **⇒ 露出の経路を示せないなら、段 2 と書かないこと。**

**M23 期の実例**——**ある読み取りが「採用済みの組」を集めており、そこに論理削除された行の分も混ざっていた。** 設計卓は「利用者にその印が見えてしまう」と判断して段 2 へ置いた。**実際には、印を付ける相手を並べる別の読み取りが、最初から論理削除を除外していた。** **⇒ 混ざっていても照合する相手がおらず、応答には出ない。段 4 だった。**

- **★場所と、担っている機能だけでは段を決められない。** **その読み取りの結果を誰がどう引くかを 1 段辿れば分かる**（本件は呼び元 1 か所・10 行以内で確認できた）。
- **★なぜ間違えたかのほうが重要である**——**露出先を名指しで持っていた箇所と、持っていなかった箇所を、同じ確からしさで書いた。** 後者の根拠は「同一ファイル内で片方だけ述語が無い」という**コードの形**だけだった。**形は手がかりであって、露出の証拠ではない。**
- **★段 4 でも塞いでよい。** 理由を「揃っているほうが読みやすい」「別の経路の絞り込みに守られているだけの状態をやめる」に置き替えればよい。**⇒ 段を下げても結論は変わらないことが多い。だからこそ、段を上げる誘惑に根拠が要る。**
- **★★動作が正しいままなので、この種の誤りは機械検査では 1 件も見つからない。** **人が読む以外に検出経路が無い。** **⇒ 判断の理由は、判断そのものと同じ重さで見直す対象である。**

#### ★「N か所」は調査時点の値であって、着手時点の値ではない（M23-02 / M23-03 で 2 例）

**上の「呼び元の数も先に数えること」の続きである。** **数えた時点と着手した時点の間に、同じ領域を触るサブが挟まると増減する。**

- **実例 1**（M23-02）——是正対象を「2 か所」と指定したが、うち 1 つは呼び元を 2 つ持つ共有ヘルパだった。**症状の数と関数の数が違っていた。**
- **実例 2**（M23-03）——調査が数えた呼び元は 5 か所だったが、着手時点では 7 か所だった。**増えた 1 件は、その間に完了した先行サブが新設したものである。**
- **⇒ 着手時に数え直す。** **とくに同じマイルストーンの先行サブが同じ領域に触っている場合は、必ず増減しうる。**

#### ★読み取りの条件を変えるときは、その関数を「観測手段」に使っているテストも数える

**M23-03 の実例**——ある読み取りに除外条件を足したところ、**「キャッシュが消えたか」を同じ関数で観測していた既存テストが赤くなった。** 実装側の呼び元は全数数えていたが、**テスト側の呼び元は数えていなかった。**

- **★主張が変わっていないなら、観測手段のほうを差し替える**（本件は列を直接読む形へ）。**テストの主張を弱めない。**
- **⇒ 読み取り関数の返り値の条件を変えるときは、本番の呼び元だけでなく「事実の観測に使っている箇所」も数える。**

#### ★意図的に分けた 2 つに対する「重複解消」は、統合の誘因になりうる

**M23-03 の実例**——表示用と検証用に分けた 2 つの関数で、行を読む部分が逐語で重複した。レビューは共通ヘルパへ寄せる案を出したが、**不採用にした。**

- **★共通ヘルパは「片方に寄せられるのでは」という次の統合の誘因を作る。** **統合されると、緩めてはいけない側が緩む。**
- **⇒ 「統合してはならない 2 つ」を作ったときは、重複の解消よりも「別物に見えること」を優先する場面がある。** **判断は、重複の量と、統合されたときの被害を並べて決める。**

---

#### ★不変条件を壊す変更をしたときは、それに依存していた読み取りを同じ手番で直す

**M23 期の実例**——**「中間表の行は必ず生きた親を指す」という不変条件を、論理削除時の物理削除をやめることで消した。** その結果、**中間表を親へ結合せずに件数を数えていた判定の意味が変わり、利用者が回避できない拒否が 1 つ生まれた。**

- **★これは「他所の穴を見つけた」のではなく「自分が壊した」である。** 前者は担当の境界を守るために報告へ留めてよいが、**後者を報告に留めると劣化を出荷することになる。**
- **★区別の仕方**——**その変更が無くても同じ挙動なら「他所の穴」。その変更によって初めて挙動が変わるなら「自分が壊した」。**
- **★到達可能性で線を引かない。** 「いまは画面から到達しないから害が小さい」は、**次に到達経路ができたときに誰も気づかない**形である。**依存の有無で線を引く。**

#### ★除外の穴は、機能単位で数えて表にする

**M23 期は `M23-RESEARCH-01` が読み取り経路を全数走査し、`M23-overview` §4.9 が 6 か所を「場所 ／ 何を担っているか ／ 意図の記述の有無」の 3 列で表にした。** **場所だけの一覧では裁定できない**——**同じ「述語が無い」でも、担っている機能が違えば答えが逆になる。**

---

### 打ち切りのある一覧は「切る順序」と「見せる順序」を一致させる

候補列挙エンジンが少手数優先で列挙して上限で打ち切り、**その後に**ランキングしていた。打ち切りがランキングより前にあるため、**実用価値の高い候補が「手数が多い」という理由だけで切り落とされていた**。

利用者からの申告は「候補を消していったら最後に到達できない」という UX の訴えだったが、**本質は「隠れている中身が悪い」ことだった**。ページングを足すだけでは解決しない。

- **利用者の訴えを UX の問題として受け取る前に、切られている中身を疑う。**

### api パッケージ間の DTO 型参照（**2026-08-09・D-273**）

**`internal/api/{A}` から `internal/api/{B}` の DTO 型を import してよい。** **初例＝`api/combo` → `api/setup`（`SetupResultConditionRequest`。M19-07）。**

**★条件 3 つ。**

| # | 条件 |
|---|---|
| **(a)** | **参照してよいのは DTO 型（リクエスト・レスポンスの構造体）だけ。** **handler・ミドルウェア・サービス取得を api パッケージ間で呼ばない** |
| **(b)** | **逆向きの依存を作らない。** 参照される側から参照する側への import が生じた時点で、この形は破綻している |
| **(c)** | **★3 例目が出たら共有 DTO パッケージへ切り出す。** 2 例までは import で許容する |

**採用理由**——**型を 1 つに保つ最も安い手段である。** type alias は名前を 2 つにして「別型では？」の疑いを生み、共有パッケージへの移動は既存参照の全書き換えを伴い、同名同構造の再定義は**同名で中身が違う型**を生む危険がある。**同層参照であり「依存方向は上から下への一方向」（`DES-002` §2）に反しない。**

**★(c) を先に決めておく理由**——**1 例では構造を決められないが、3 例あれば形が見える。** **決めておかないと、5 例 10 例と増えてから判断することになり、そのときには書き換え範囲が大きすぎて誰も着手しない。**

### 11.X ★★除外を正しく入れると、除外されたものの存在を伝える手段が新しく要る（2026-08-22 追記・**CHANGE-124** / **M23-04**）

**論理削除された行を参照側から除外するのは正しい。** **だが除外を入れた時点で、「そこに在ったはずのものが出ていない」ことを利用者が知る手段が消える。**

**★本プロジェクトで実際に起きた並び。**

| いつ | 何が入ったか | その結果 |
|---|---|---|
| **`M23-02`** | セットプレイに論理削除・復元・完全削除が揃った | **セットプレイが「削除済みだが行としては在る」状態を取りうるようになった。** それ以前は削除が中間表ごと物理削除しており、この状態は存在しなかった |
| **`M23-03`** | 参照側の `deleted_at` 除外の穴を塞いだ | **削除済みのセットプレイが、コンボ詳細からも候補一覧からも出なくなった** |
| **⇒** | — | **コンボを復元すると、紐付いていたセットプレイが全部ゴミ箱に居るせいで 0 件に見える。** **利用者から見れば「戻したのに戻っていない」である** |
| **`M23-04`** | 復元時に警告を返す器を作った | **「戻りきっていない」ことを伝える経路ができた** |

**★★`M23-03` は誤っていない。除外は正しい。** **足りていなかったのは、除外されたことを伝える経路のほうである。**

**⇒ 参照側に除外を足すときは、同じ手番で次を確かめること。**

| # | 確かめること |
|---|---|
| **1** | **その除外によって、利用者が「空」「0 件」「無い」と読む画面が生まれるか。** 生まれるなら、**それが「本当に無い」のか「除外された」のかを区別する手段が要る** |
| **2** | **区別する手段を、この手番で作るのか、別サブへ送るのか。** **★送るなら送り先を書く。** 書かずに終わると「除外は入った、伝える手段は誰も作っていない」で止まる |
| **3** | **★伝える手段は、必ずしも画面の作り込みではない。** 警告 1 件で足りることが多い（`DES-006` §13）。**作り込みが要ると判断して丸ごと先送りするのが、いちばん高くつく** |

**★逆向きの注意**——**「除外したものを全部見せる」に振らないこと。** **除外の目的は雑音を減らすことであり、除外したものを別の場所で全部列挙すると目的が消える。** **伝えるのは「除外が起きた」という事実であって、除外された中身の一覧ではない**（中身が要るかは画面側の判断＝`M23-06` / `M23-07`）。

### 11.Y ★★seed の down は「自分が入れた行」しか消せない。利用者データの扱いを本文へ明示する（2026-08-25 追記・**M24-09b** / **D-552**）

**マイグレーション接続は `foreign_keys=OFF` である**（意図。`D-494` ／ 本節の 1 段目）。**⇒ `ON DELETE CASCADE` は down では発火しない。子行を消したいなら明示 DELETE を書く。**

**★「正しい書き方」の実例がリポジトリ内にある**——**`migrations/000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` は子行を先に明示 DELETE しており、その理由を逐語で書いている**〔「マイグレーション接続は foreign_keys=OFF …… orphan を残さないため、子行を先に明示 DELETE する」〕。

**★★しかしそれだけでは足りない。もう 1 段ある。**

**seed マイグレーションは利用者データを知らない。** `characters` を消す down が「依存行は後続の down が先に除去済み」と書くとき、**それが指しているのは seed 由来の `moves` / `preset_aliases` / `custom_states` であって、利用者が作った `combos` ではない。**

**⇒ 実測**（`M24-09b`）——**`000024.down`（第一波）と `000053.down`（第三波）は `DELETE FROM characters …` の 1 文だけであり、利用者のコンボは残る。** head から `Migrate(11)` した結果は `after_user_combo=1` ／ `orphan_combos_of_characters=1` ／ `orphan_moves_of_characters=2`。**`guile` と `jamie` は現行ロスターとして再投入されているため、利用者がこの 2 キャラのコンボを持っているのは普通のことである。**

**⇒ 規約。`characters`（および利用者データが参照しうるマスタ）を削除する down を書くときは、次を本文へ明示すること。**

| # | 明示すること |
|---|---|
| **1** | **子行を明示 DELETE するか、しないか。** `ON DELETE CASCADE` の宣言に頼らない（FK=OFF で発火しない） |
| **2** | **★★利用者データを消すか、残すか。** **「消す」なら明示 DELETE を書く。「残す」なら残ることと、その結果 orphan になることを注記へ書く。** **★書かないと、次の読み手は「依存行は除去済み」という既存の注記を利用者データまで含むと読む** |
| **3** | **up が相関キー（`memo` 等）を使って行を特定しているなら、down も同じキーを使う。** **★`000012.down` は `character_id IN (...)` だけで判定しており、up が入れていない利用者の行まで消す**（実測 `user_combo_before=1` → `user_combo_after=0`） |

**★適用済みマイグレーションの本文は書き換えない**（`D-535`＝当時の前提が失われる）。**本規約は今後書くものに掛かる。** **既存分の実運用上の扱いは followup §AH `character-down-migrations-orphan-user-combos`。**

---

## 12. 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|---------|
| 1.0.0 | 2026-05-16 | ドキュメント整理に伴い新設。m3-to-m4-handover §6 の分離アーキテクチャパターンを移管 |
| 1.0.1 | 2026-05-17 | M4-02 実装完了後の連絡事項 3(useCombo queryKey の number 統一)を反映。§1 配下に §1.1 TanStack Query queryKey 規約を新設。URL パラメータの useParams 戻り値(string)を queryKey に組み込むフックではフック内部で number 正規化(parseInt)する規約を明文化。M4-02 実装中に潜在不具合(キャッシュ無効化失敗)が発覚し、製造担当が `useCombo` で正規化を入れて修正した経緯を含む。今後の新規フック追加時の検査基準として確立 |
| 1.0.2 | 2026-05-18 | M4-03 製造担当 Plan Mode 中の連絡事項(useSetupCandidates の queryKey 形式選択)で発覚した、v1.0.1 §1.1 規約コード例の実態不整合を修正。v1.0.1 では規約コード例を `['combo', { id: normalizedId }]`(object 形式)で書いていたが、コードベースの実態は **flat tuple 形式**(`['combo', normalizedId]`)だった。設計担当 Claude(M4 期間担当)が v1.0.1 改訂時に **実態の useCombo 実装を確認せず** に書いた誤り(retrospective-log v1.0.10 §5.1 M4-9 に独立記録)。v1.0.2 で以下を修正: (1) §1.1 規約コード例を flat tuple に修正。(2) 「規約の核心は ID の number 正規化、queryKey の structure(flat / object)は規約の対象外」と明示。(3) 「新規フック追加時は既存フックの structure に揃える(現状は flat tuple)」を追記。(4) 将来 queryKey に複数キーが必要になった場合の判断方針を追記(現時点では実装の一貫性を優先)。M4-03 製造担当への伝達は開発者の口頭伝達で完結(2026-05-18)、製造担当は v1.0.2 確定後の flat tuple で実装継続 |
| 1.0.3 | 2026-05-20 | M4-04 実装完了後の製造担当連絡事項(2026-05-20)で発覚した、v1.0.2 §1.1 規約の実態不整合を再修正。v1.0.2 では「コードベースは flat tuple 形式を採用」と書いたが、setup 系フック(`useCharacterSetups` 等)の実態は **object 形式**(`["setups", { characterId }]`)で乖離していた。設計担当 Claude(M4 期間担当)が v1.0.2 改訂時に combo 系の実態のみ確認し、setup 系の実態を確認しなかった誤り(retrospective-log v1.0.15 §5.1 M4-13 に独立記録、M4-9 と同根の「実コード確認の省略」+ 規約執筆時のドメイン横断確認漏れ)。v1.0.3 で以下を修正: (1) §1.1 規約の核心を「number 正規化のみ」に明確化、structure は同一ドメインの既存フックに揃える運用に変更。(2) 「コードベースには flat tuple と object 形式が混在している」事実を明示(combo 系 = flat tuple、setup 系 = object 形式)。(3) 異なる structure を跨いで invalidate する場合のプレフィックス全件 invalidate(製造担当が M4-04 で採用した回避策)を運用知見として記録。(4) v1.0.1 / v1.0.2 の規約コード例の誤りの経緯を整理。(5) 統一リファクタは M5+ で検討する旨を明示(retrospective-log v1.0.15 §5.5 持ち越し確認課題候補)。M4-04 製造担当への伝達は不要(M4-04 完了後の事後整合修正、setup 系の object 形式の実態は維持) |
| 1.0.4 | 2026-05-23 | M6-01 実装完了後の製造担当伝達事項 1(2026-05-23)で発覚した、サービス層インターフェース定義パターンの明文化漏れを修正。設計担当 Claude(M6 期間担当)が M6-01 指示書 v1.0.0 §4.3.1 サンプルコードで `NewService(...) *Service`(具象型ポインタ)を返す形で書いたが、本コードベースの既存サービス層(M3-04 character / M4-01 setup)の慣例は **`type Service interface` 定義 + 非公開 `service` 構造体 + コンストラクタはインターフェース型を返す** パターンだった。設計担当が既存実装の慣例を確認せず書いたミス(retrospective-log v1.0.18 §6.1 M6-1 に独立記録)。製造担当が M6-01 実装で正しいパターンに修正、伝達事項で設計担当に通知。v1.0.4 で以下を追記: (1) §2 配下に **§2.1 サービス層インターフェース定義パターン** を新設、3 例(M3-04 / M4-01 / M6-01)で確立済みのパターンとして明文化。(2) コード例(M6-01 config サービスの形)を含む。(3) パターンの利点(テスト時モック差し込み / DIP 整合 / 実装差し替え容易性)を整理。(4) 指示書執筆時の注意(サンプルコードで具象型ポインタを返さない、既存実装慣例を view で確認)を明記。(5) パターン化の経緯(M3-04 / M4-01 で同一パターン採用済みの事実が M6-01 製造担当伝達事項で発覚した経緯)を記録。今後の新規サービス層実装はすべて本パターンを踏襲する |
| 1.0.5 | 2026-05-24 | CHANGE-016 反映に伴う自由改訂(CHANGE 対象外、関連補足資料の派生改訂)。§5 ブラウザストレージ運用 確立済みキー一覧から `combo-draft-<id|new>-v1`(M6 予定)を論理削除注記化。設計書本体 REQ-001 v2.11.0 → v2.12.0 / DES-005 v2.8.0 → v2.9.0 と同期 |
| 1.0.6 | 2026-05-26 | ブラウザストレージ運用 確立済みキー一覧の virtual-controller-layout-v1 を同様にフェーズ 3 送り注記化 |
| 1.0.7 | 2026-05-27 | **§6 調査担当運用パターンを新設**(本プロジェクト 4 例の蓄積を運用パターン化)。M7-RESEARCH-02 完了承認後 = 2026-05-27 時点、設計担当 Claude(M7 期間担当)による前倒し記録。本書改訂の理由: 後続マイルストーン担当が過去 4 例の調査担当運用結果を呼び出すための統合的参照経路を設計担当の恒久資料に確立する必要(2026-05-27 開発者ご指示「調査資料を今後の担当に呼んでもらうための追加情報の記載」遵守)。§6 構造: §6.1 確立された運用パターン(指示書命名 + §0 構造 + §4 / §5 内容)+ §6.2 過去 4 例の蓄積表(M5-RESEARCH-01 / M6-RESEARCH-01 / M7-RESEARCH-01 / M7-RESEARCH-02 の調査軸 + 実施日 + モデル + 成果 + 活用先)+ §6.3 設計担当による活用パターン(指示書作成時の参照経路 4 件)+ §6.4 起票要否の判断基準 + §6.5 関連教訓(retrospective-log §6.7 CHANGE-016 ハイブリッド分担 + §6.6 M7-4 CHANGE-017 調査担当契機との連動)。旧 §6「更新履歴」を §7 にリネーム |
| 1.0.8 | 2026-05-27 | **M7-01 完了承認後の M7 期間担当による振り返り改訂**(M7-01 完了承認 = 2026-05-27 受領、handover に書く時点で失われる情報のみ前倒し記録の 2026-05-26 開発者ご指示遵守)。(1) §1 配下に **§1.2 shadcn/ui 統一導入パターン** を新設、M7-01 で確立された案 β = shadcn/ui 標準 API に呼び出し側を合わせる方針 + Props 命名是正(open / onOpenChange 統一)+ モーダル portal 統一 + window.confirm 除去 + 内部状態の標準動作代替 の 5 点を本プロジェクトの shadcn/ui 統一導入パターンとして明文化、M7-02 以降の系統 A 後半・後続マイルストーンで踏襲。(2) §7 を新節として **§7 リストを含む Dialog の scroll 制約パターン候補(M7-02 で正式パターン化判断)** を追加。M7-01 LinkExistingSetupModal で発生・修正済みの事象(候補リストが長い場合のビューポートはみ出し)+ 同様の潜在事象(AddComboToCompareModal / SetupSelectorModal / KnockdownAdvantageChangeModal individual モード)を **パターン候補として前置き記録**、M7-02 で全 Dialog 一括適用検討 + 正式パターン化判断。retrospective-log §6.6 持ち越し課題「伝達 2」と連動。(3) 旧 §7 更新履歴を §8 にリネーミング(§6 / §7 が独立節に拡張されたため) |
| 1.0.9 | 2026-05-31 | **M7-02 完了承認後の M7 期間担当による振り返り改訂**(M7-02 完了承認 2026-05-31 受領、Q22 案 A 修正本セッション編入完結後、retrospective-log v1.0.25 と統合改訂)。(1) §1.2 shadcn/ui 統一導入パターンに **§1.2.6 例外条項追加事例**(native `<select>` の Radix Select 非置換、空文字列制約の Radix UI 仕様)+ **§1.2.8 shadcn/ui CLI 由来の依存混入対応**(next-themes 自動追加 + 除去手順、Vite + React 環境での運用注意点)を追加。(2) §7 Dialog scroll 制約パターン正式化(タイトルから「候補」削除、§7.5 設計担当の暫定判断 → 確定判断にリネーム + 内容を M7-02 適用結果で更新、§7.6 関連教訓で retrospective-log v1.0.25 §6.6 持ち越し課題「伝達 2」が解消済み状態であることを反映)。(3) **新規 §8 react-hook-form + zodResolver + shadcn/ui Form 統合パターン** を追加(M7-02 TagFormDialog の D-4 解消で確立、コード例 + 利点 + 適用範囲 + 関連教訓を含む 5 サブ節構成)。(4) 旧 §8「更新履歴」を §9 にリネーミング。新パターン 3 件の正式記録 + 例外条項 2 件の追加 = M7-02 で本プロジェクトに導入された新技術スタック(react-hook-form / zod / sonner)の運用基準が完備された期間 |
| 1.0.10 | 2026-06-01 | **M7-03 完了承認後の振り返り改訂**(M7-03 完了承認 2026-06-01 受領、製造担当伝達 3 由来)。**§7 Dialog scroll 制約パターンに §7.7 禁止事項を新規追加**: (a) DialogContent への `max-h-[XXvh]` / `flex flex-col` / `overflow-y-auto` 直接適用禁止、(b) M7-01 状態の踏襲禁止(M7-02 で確立した §7.5 確定判断が正規)、(c) 確認手順の明示。M7-03 製造工程で AddComboToCompareModal の初回実装が DialogContent に `max-h-[70vh] flex flex-col` を誤付与した事例(レビュー指摘で修正済み)を踏まえ、本プロジェクト初の「こうしてはいけない」明示パターン = M7-04 / M7-05 + フェーズ 2 以降の同種逸脱を予防する運用ノウハウ。retrospective-log v1.0.26 §6.6 M7-14 + 製造担当伝達 3 由来。本パターンは「アンチパターン明示が予防効果を生む」運用ノウハウとして、フェーズ 2 着手時に他の正式化済みパターン(§1 / §1.1 / §1.2 / §2 / §3 / §4 / §5 / §6 / §7 / §8)への横展開検討候補 |
| 1.0.11 | 2026-06-03 | **M7-04-1 完了承認後の振り返り改訂**(CHANGE-019 クリーンアップ + バグ #5 修正、2026-06-03 受領)。**§3 エラーレスポンス共通型に 2 サブ節を新設**: (1) §3.1 API エラーレスポンスのフロント統一ハンドリング(`web/src/features/combo/errors.ts` の `parseComboApiError` + 共有 `ValidationDisplay` 全幅配置、M7-04-1 バグ #5 で確立、M7-05 バグ #6 が踏襲予定)、(2) §3.2 validating サービスを呼ぶ mutating ハンドラの 400 分岐網羅(サービスの `(nil, result, nil)` 3 値分離設計に対しハンドラが `HasError() → 400` 分岐を必ず持つ不変条件、欠落すると nil ポインタ参照 → 500 に化ける、M7-04-1 バグ #5 の真因 = `UpdateMetadata` ハンドラの分岐欠落、playbook §4.7 と同系統)。retrospective-log v1.0.27 §6.6 M7-16 と対で記録。バグ #6(VAL-S02)が §3.2 同型の潜在箇所として M7-05 確認予定 |
| 1.0.12 | 2026-06-03 | **M7-04-2 完了承認後の振り返り改訂**(M7-04-2 完了承認 2026-06-03、製造連絡事項 B 群由来)。**§9 を新設**(旧 §9 更新履歴 → §10 に繰り下げ): フェーズ 1 時点の既知のアーキテクチャ状態 = (1) §9.1 custom_states は保存 / API のみで消費・表示・参照が未実装(DES-003 §3.2 は定義構造のみ、消費セマンティクスはフェーズ 2 設計 = CHANGE 見込み)、(2) §9.2 recipe_cache の無効化はプリセット/エイリアス変更時が未実装だが SUPP-001 §7 に既定あり(トリガ機能がフェーズ 2 のため、エイリアス整備時に §7 実装、lazy 採用なら eager からの設計変更)。retrospective-log v1.0.28 §6.6 M7-04-2 ブロックと対で記録 |
| 1.0.13 | 2026-06-05 | **M7-05 製造連絡事項 A 群を反映**(自由改訂、CHANGE 不要)。**§3 を 3 点更新**: (1) A-1 = エラーレスポンス構築は直接記述 or model 層正準コンストラクタ(`model.NewAPIError` / `NewAPIErrorWithDetails`)に限り、per-handler/per-package 独自ヘルパは禁止(L-03 = 散在ヘルパを M7-05 で全削除・集約。「独自ヘルパを増やさない」の意図 = per-package 散在防止で、model 層単一正準コンストラクタは適合)。(2) A-3 = HTTP `error.code` は lower_snake_case で正本化(DES-006 の VAL-* とは別物、設計書本体に規定なしのため本節で正本化、CHANGE 不要)。(3) A-2 = §3.1 適用箇所にセットプレイ(`parseSetupApiError`)追記、§3.2 の未確認潜在箇所をセットプレイ登録ハンドラ確認済み(整合)に更新、バグ #6 の真因はフロント表示欠落(バグ #5 とは逆の層 = 真因レイヤの決めつけは双方向に効く) |
| 1.0.14 | 2026-06-05 | **フェーズ 1 完了処理に伴う §10 新設**(M7-06 製造連絡 C-2 由来、旧 §10 更新履歴 → §11 に繰り下げ)。**§10 = 配布・LAN 利用の既知制約**: §10.1 LAN 利用は inbound FW 許可が前提、サードパーティ AV(Norton 等)が Windows FW を代替制御し Windows 設定で解決しない場合あり(製品ごとに異なり保証外)。M7-06 E2E で Norton 許可後にスマホ LAN 接続成立(U-1)。DES-002 本体には規定として加えず本節に運用注意として記録(CHANGE 回避)。自由改訂 |
| 1.0.15 | 2026-06-07 | 整理工程(CHANGE-020)のフェーズ番号再設定に伴う前向き参照の追従(自由改訂、CHANGE 不要)。§9 = custom_states → フェーズ2 / recipe_cache・プリセット(B-2/B-3)→ フェーズ3、§8 横展開候補・新規フォーム実装 → フェーズ3。確立済みキー注記(virtual-controller = 新3 で番号一致)・§ 調査例表・フェーズ1 状態・本更新履歴は歴史記録として据え置き |
| **1.0.24** | **2026-08-25** | **★§11.Y へ「seed の down は自分が入れた行しか消せない。利用者データの扱いを本文へ明示する」を新設**（**D-552** / **M24-09b**）。**★★実測＝`000024.down` / `000053.down` は `DELETE FROM characters …` の 1 文だけであり、現行ロスターのキャラ（`guile` / `jamie`）の利用者コンボを orphan にする。** **★既存の注記「依存行は後続の down が先に除去済み」が指すのは seed 由来の行であって利用者データではない。読み手はそう読まない。** **★あわせて `000012.down` の型も記録**〔up が相関キー `memo` で入れた行を、down は `character_id` だけで消すため、利用者が後から作った行まで消える〕。**適用済みマイグレーションの本文は書き換えない**（`D-535`）。自由改訂・CHANGE 不要。 |
| **1.0.23** | **2026-08-25** | **★§11 へ「FK=ON だけで回るテストは、CASCADE → 明示削除の変更を 1 行も守らない」を新設**（自由改訂・CHANGE 不要。M23 期の教訓の構造的昇格＝`retrospective-log` §6.6.21 の **`E-226`** ／ **`D-538`**）。**★根拠は `M23-08` の破壊確認の実測**〔明示削除を 1 表分消したとき `fk_on` は PASS したまま `fk_off` だけが赤になった〕。**★★`M23-10` の `P-04` 根治後もむしろ危険が増している**——**FK が常時 ON になったため、明示削除を消しても FK=ON の枝はいっそう確実に緑を返す。** **⇒ 明示削除を持つ表の子行削除を主張するテストは `fk_on` / `fk_off` の 2 枝で回す。** |
| **1.0.22** | **2026-08-24** | **★§11 へ「明示削除と CASCADE 依存の非対称は、揃えない」を新設**（**D-535** / **M23-10**）。**★揃えるなら向きは「`tags` に明示削除を足す」ではない**——**明示削除は「新しい子表が増えたときに書き忘れる」代償を持ち、`combos` 側はそれを検出テストで埋めているが `tags` 側は持たない。⇒ 足すと忘れやすさだけが増える。** **★★将来問うべきは逆向きである**〔`combos` 側の明示削除は `P-04` の遺産であり、いずれ「撤去してよいか」を問う番が来る。**ただし今は問わない**——回帰ゲートが守り続けている実績がまだ無い〕。 |
| **1.0.21** | **2026-08-24** | **★★§11 の 1 段目を「未対処の既知パターン」から「対処済み・こう書くこと」へ性格を変えた**（**CHANGE-142** / **M23-10**）。**★★射程を `foreign_keys` だけから 3 種へ広げた**〔**実測で `busy_timeout` と `synchronous` も同じ 15/16 本で失効していた**。**`journal_mode` は DB 単位のため 16/16 で有効**〕。**★とくに後 2 者は FK と違って「壊れている」と気づく契機が無い。** **★書き方 4 点を明記**〔DSN で入れる ／ `file:` URI ＋ パーセントエンコード ／ **★守り続けるテストは「同時に掴む」形で書く**——1 本ずつ取って返すとプールが使い回して壊れていても緑になる ／ **検査は 4 種すべて**〕。 **★★「マイグレーション接続が FK=OFF なのは意図である」を 1 行明文化**〔**書かないと次の担当が「揃っていない欠け」と読んで揃えにいき、表の作り直しが壊れる**＝`D-494` の適用例〕。 |
| **1.0.20** | **2026-08-22** | **§11 へ「除外を正しく入れると、除外されたものの存在を伝える手段が新しく要る」を追加**（**CHANGE-124** / **M23-04**）。**★`M23-02`→`M23-03`→`M23-04` の実例をそのまま置いた。** **★★あわせて、2026-08-22 までの §11 への追記 3 件が本履歴に載っていなかったのを是正した**——**`D-492`**〔論理削除された親を参照する機能を足すときの 5 つのチェックと 4 段の判断表 ／ 不変条件を壊したときの後始末 ／ 穴は機能単位で数える〕**／ `D-494`**〔セットプレイの例外の解消 ＋ **揃えること自体が無償ではない**〕**／ `D-504`**〔段 2 と段 4 の当てはめ ／ **「N か所」は着手時に数え直す** ／ 読み取りの条件を変えるときは観測手段のテストも数える ／ **意図的に分けた 2 つへの「重複解消」は統合の誘因になりうる**〕。**★本文は当時から入っていたが履歴行が無く、`1.0.19`（2026-08-20）のまま止まっていた。** |
| **1.0.19** | **2026-08-20** | **§11 へ 2 項を追加**（自由改訂・CHANGE 不要。M22 期の教訓の構造的昇格＝`retrospective-log` §6.6.20 の **E-145** ／ ボード **D-466**）。**(a) 接続表の両端でスコープが違うとき、「絞り込み」と「置換」は必ず同じ手番で入れる**〔実例＝`combo_tags`。**片方だけだと「双方の画面に何も出ないまま他人のデータが消える」**〕／**(b) 論理削除された親の子は物理的に残る**〔**`deleted_at` を持つのは `combos` と `setups` の 2 表だけ**。`code-facts` §10・2026-08-19 の範囲。**M23（データバージョン管理）の直接の前提**〕。 |
| 1.0.18 | 2026-08-10 | **§11 へ「api パッケージ間の DTO 型参照」を追加**（自由改訂、CHANGE 不要。**D-273**＝`M19-07-COMPLETION-RULINGS` §8-1 AP-01。**初例＝`api/combo` → `api/setup`〔M19-07〕。条件 3 つ＝DTO 型のみ／逆向きの依存を作らない／3 例目で共有パッケージへ切り出す**）。反映係（Claude Code）による改訂 |
| 1.0.17 | 2026-07-31 | **教訓の昇格に伴う §11 新設**（自由改訂、CHANGE 不要。旧 §11 更新履歴 → §12 に繰り下げ）。**§11 = データアクセス・永続化の既知パターン**（M19-03／CHANGE-087 期に確立）＝(1) **`PRAGMA foreign_keys` は接続単位で、接続プール全体には効かない**〔`*sql.DB.Exec` では 1 接続にしか適用されず、`SetMaxOpenConns` 無しでは後から張られた接続が OFF のまま。**`ON DELETE CASCADE` 依存の既存テーブルすべてで CASCADE が発火しない可能性**。対処＝DSN 等プール全体に効く経路で入れる／新表は CASCADE に依存せず `ON UPDATE CASCADE` ＋明示削除・明示再ポイント／一括是正は既存の削除順序を壊し得るため独立調査と全テーブル回帰ゲートが要る〕 (2) **関連テーブル追加時は親の 3 経路（削除・識別キー変更・論理削除）を確認する**〔`ON UPDATE CASCADE` と明示再ポイントは**両方必須**・**再ポイントの実装形は FK 親の段数で変わる**・**論理削除では CASCADE が効かない**〕 (3) **打ち切りのある一覧は「切る順序」と「見せる順序」を一致させる**〔打ち切りがランキングより前にあると実用価値の高い候補が手数だけで切り落とされる。**利用者の UX の訴えを受け取る前に、切られている中身を疑う**〕。一次源＝M19-E09／E10／E11 |
| 1.0.16 | 2026-06-20 | **M11 着手に伴う §9.1 前向き文言の是正**(自由改訂、CHANGE 不要)。開発者方針(2026-06-20)= custom_states の**消費セマンティクス**(コンボ中の減少・レベルで技変化・レシピ反映・バリデーション連動)は**アプリでは構築せず利用者が notes 管理(将来要望次第での検討にとどめ現時点では実装しない)**。これを受け §9.1 末尾の「フェーズ2 の設計課題=消費を作る=DES-003/004/006 追記 CHANGE 見込み」を「フェーズ2(M11)は付与・表示・参照のみ、消費は非構築、CHANGE 中心は DES-005 §5.6/§5.7」へ改めた。**§9.1 のベースライン事実(custom_states は保存+API のみ・combos/steps/modifiers から参照されない・`customStates?` 未使用)は M11-RESEARCH-01 で実コード再検証予定のため本改訂では据え置き**(現状記述のまま)。M11 担当による改訂 |

---

*以上*
