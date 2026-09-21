# 指示書 M1-05: コンボ一覧・詳細画面(フロントエンド)

| 項目 | 内容 |
|------|------|
| 指示書ID | M1-05 |
| バージョン | 1.4.0 |
| 対象マイルストーン | M1(コア基盤) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M1-05-review-checklist.md`) |
| 並列性 | M1-03 完了後、M1-04/M1-06/M1-07 と並列実行可能 |
| 依存指示書 | M1-01、M1-02、M1-03、**M1-04**(notation サービス) |
| 想定所要時間 | 90〜120分 |
| 作成者 | 詳細設計・製造準備担当Claude |
| 作成日 | 2026-04-29 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-04-29 | 初版作成 |
| 1.1.0 | 2026-04-30 | パッケージマネージャを pnpm 9.13 に統一: shadcn/ui 導入コマンドを `npx shadcn-ui add` から `pnpm dlx shadcn-ui add` に変更 |
| 1.2.0 | 2026-04-30 | CHANGE-006 反映: §4.2 詳細画面ヘッダ表示の `counter_type` を `hit_type` にリネーム |
| 1.3.0 | 2026-04-30 | M1-03 実装中の製造担当質問対応で発覚した指示書ミスの修正: §4.2 詳細画面ヘッダから「コンボ名」表示を削除(DES-003 §3.4 に combos.name カラムが存在しないため)。識別は「キャラ + 状況 + レシピ」で行い、ニックネーム情報は memo フィールドで表示する設計に修正 |
| 1.4.0 | 2026-04-30 | M1-05 実装中の製造担当質問対応で発覚した M1-04/M1-05 指示書間の矛盾を解消。§2.3 「バックエンド側のコードは変更しない」と §4.2.2 「専用エンドポイント(あれば) または cache から取得」の矛盾を整理: §2.3 を「原則変更しない」、§2.4 を新設して「専用エンドポイント `GET /api/combos/:id/recipe?preset_id=X` の追加は例外的に許容」と明示。§4.2.2 を「M1-05 で専用エンドポイント追加実装する」と明確化、レスポンスフォーマット・エラー処理を詳述。§2.2 修正ファイル一覧にバックエンド追加3箇所(handler.go / RegisterRoutes / handler_test.go)を明示。§7 完了条件にバックエンド新規エンドポイント動作確認を追加。依存指示書に M1-04 を明示(notation サービスを利用するため) |

---

## 1. 背景と目的

### 背景

M1-03 でコンボ CRUD API が完成、M1-04 で recipe_cache が利用可能。これらを使ってコンボ一覧画面とコンボ詳細画面をフロントエンドで実装する。M0 のプロトタイプ(`web/prototypes/combo-list.html`、`combo-detail.html`)を視覚的指針として、React コンポーネント化する。

### 目的

- コンボ一覧画面(`web/src/pages/ComboListPage.tsx`)を実装
- コンボ詳細画面(`web/src/pages/ComboDetailPage.tsx`)を実装
- TanStack Query を使ったデータ取得
- DES-005 v2.6.0 の最新仕様に準拠(CHANGE-002 反映済みの列構成、ツリー構造)
- M0 プロトタイプの視覚的指針を踏まえつつ、CHANGE-002 で変わった列構成を採用する

### このマイルストーンで作らないもの

- コンボ登録・編集画面(M1-06)
- 仮想コントローラ(M2 以降)
- 高度なフィルタ(タグフィルタ、状況フィルタ)(M3)
- マイコンボ画面(M3)
- レスポンシブ最適化(M7)
- セットプレイ展開のサーバーデータ連携(M4 後)— **M1-05 ではセットプレイ展開行は空または「(まだ実装されていません)」表示**

---

## 2. 成果物

### 2.1 作成するファイル

```
web/src/
├── pages/
│   ├── ComboListPage.tsx                # コンボ一覧画面
│   └── ComboDetailPage.tsx              # コンボ詳細画面
├── features/
│   └── combo/
│       ├── api.ts                       # TanStack Query フック(useCombos, useCombo 等)
│       ├── types.ts                     # ドメイン型(ComboDetail、ComboListItem 等)
│       ├── components/
│       │   ├── ComboTable.tsx           # コンボ一覧テーブル(ツリー構造)
│       │   ├── ComboTableRow.tsx        # 1行(展開アイコン付き)
│       │   ├── SetupTreeRow.tsx         # 展開時のセットプレイ行(プレースホルダ)
│       │   ├── ComboFilterBar.tsx       # 仮登録切替、ソートのみ(M1段階の最小)
│       │   ├── ComboDetailHeader.tsx    # 詳細画面のヘッダ部
│       │   ├── ComboDetailRecipe.tsx    # レシピ表示(プリセット切替UI付き)
│       │   ├── ComboDetailMetadata.tsx  # ダメージ・ゲージ・状況等
│       │   └── PresetSwitcher.tsx       # プリセット切替プルダウン
│       └── utils.ts                     # フォーマット関数(ダメージ整形、状況コード→ラベル変換等)
├── features/
│   └── preset/
│       ├── api.ts                       # usePresets フック
│       └── types.ts                     # Preset 型
├── lib/
│   └── api-client.ts                    # M1-01 から既存、必要なら追記
└── router.tsx                           # M1-01 から修正(ComboList/Detail ルート追加)
```

### 2.2 修正するファイル

**フロントエンド:**

- `web/src/App.tsx`: 必要なら BrowserRouter ラップ確認
- `web/src/router.tsx`: `/`(コンボ一覧)、`/combos/:id`(詳細)を追加
- `web/src/locales/ja.json` および `en.json`: 必要なキーを追加

**バックエンド(§2.4 の例外条項で許容):**

- `internal/api/combo/handler.go`: 新規ハンドラ `GetRecipeByPreset` 等を追加
- `internal/api/combo/routes.go`(または `RegisterRoutes` の定義箇所): `GET /api/combos/:id/recipe` の登録1行追加
- `internal/api/combo/handler_test.go`: 新規ハンドラのテスト追加

### 2.3 変更しないもの(原則)

- バックエンド側のコード(M1-03、M1-04 で実装済み)
- M0 プロトタイプ(`web/prototypes/`)

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

DoD §7「プリセット切替で `official_ja_move` のエイリアス変換が反映される」を満たすため、以下のバックエンド変更は**例外的に許容**する:

- `internal/api/combo/handler.go` に新規ハンドラ追加(`GET /api/combos/:id/recipe?preset_id=X`)
- `combo.RegisterRoutes` への1行追加(上記エンドポイントの登録)
- 上記ハンドラに対応する `internal/api/combo/handler_test.go` のテストケース追加

実装は M1-04 で既に存在する `notation.Service.ResolveComboRecipe(ctx, comboID, presetID)` を呼ぶだけで完結する。combo パッケージ内に閉じるため、`main.go` への変更は不要、M1-06 並列実装とも衝突しない。

詳細は §4.2.2 を参照。

---

## 3. 前提条件

### 必読ドキュメント

- `CLAUDE.md`
- `docs/instructions/M1-overview.md`
- `docs/design/05-screen-design.md` v2.6.0 の以下節
  - **§4** グローバルUI(ヘッダ・ナビ等)
  - **§5.4** コンボ一覧(CHANGE-002 反映済みの列構成、ツリー構造、本指示書の中核)
  - **§5.6** コンボ詳細(本指示書の中核)
- `docs/design/supp-001-detailed-design.md`
  - **§2.4** セットプレイ名NULL時のフォールバック表示(combo-detail で必要)
  - **§3.2** 状況コード値マスタ(状況→ラベル変換に必要)
  - **§5.1** moves参照方式(API レスポンスで `move_id` と `move_code` 両方受け取る)
  - **§5.3** フロントエンド構成

### 任意参照

- M0プロトタイプ `web/prototypes/combo-list.html` および `web/prototypes/combo-detail.html`(視覚的指針として参照、ただし**列構成は CHANGE-002 反映後のDES-005 v2.6.0 を真とする**、プロトタイプとは異なる)

### 参照不要

- DES-003、DES-004、DES-006(API がデータ整形を済ませているため)

---

## 4. 詳細仕様

### 4.1 コンボ一覧画面

#### 4.1.1 URL・ルーティング

- ルート: `/`(または `/combos`)
- React Router で `<Route path="/" element={<ComboListPage />} />` を登録

#### 4.1.2 表示要素(DES-005 v2.6.0 §5.4 準拠、CHANGE-002 反映)

**列構成(CHANGE-002 反映後):**

DES-005 §5.4 の最新列構成に従う。**M0 プロトタイプの列構成は CHANGE-002 で変更されているため、プロトタイプを真とせず DES-005 v2.6.0 を真として実装する**。代表的な変更点:

- ステップ数列を**削除**
- 相手スタンス列を**削除**
- 始動状況グループ列を**先頭に追加**
- 備考(メモ)列を**追加**
- 登録状態列を**追加**

具体的な列順とラベルは DES-005 v2.6.0 §5.4 を厳密に参照すること。

**ツリー構造:**

各コンボ行に展開アイコン(▶/▼)を付け、展開時にセットプレイ行をインデント付きで表示。

- 展開状態の管理は `useState`(各行の展開状態を保持する Map)
- M1-05 段階では、セットプレイのデータが M4 まで実装されないため、展開時は **「(セットプレイは M4 で実装予定)」のプレースホルダ行**を表示する
- セットプレイ紐付けの**マークは表示する**(将来連携した時に矛盾しないよう、API のレスポンスから `setupCount` 等を受け取って表示)

**ソート:**

DES-005 §5.4 のソート対象に従う(CHANGE-002 反映後、ステップ数は削除)。デフォルトソートは「**始動状況**」。

**フィルタ:**

M1段階では最小限。仮登録切替トグルのみ実装。タグフィルタ、状況フィルタは M3 で追加する旨をコメントで明記。

#### 4.1.3 ダミーデータと現実データ

M1-03 で投入された実データ(API 経由)を取得する。M0 プロトタイプのようにハードコードはしない。

#### 4.1.4 アクション

- 各行の「詳細」リンク → `/combos/:id` に遷移
- 各行の「編集」リンク → `/combos/:id/edit`(M1-06 で実装、M1-05 段階ではリンクのみ作成)
- 各行の「削除」ボタン → 確認ダイアログ → DELETE API 呼出 → リスト再取得
- 「新規登録」ボタン → `/combos/new`(M1-06 で実装、M1-05 段階ではリンクのみ)

### 4.2 コンボ詳細画面

#### 4.2.1 URL・ルーティング

- ルート: `/combos/:id`
- DES-005 §5.6 に準拠

#### 4.2.2 表示要素

- ヘッダ: キャラ、状況(position/opponent_stance/hit_type/opponent_size)、ID(`#123` 等)。combos に `name` カラムは存在しないため(DES-003 §3.4)、コンボ識別は「キャラ + 状況 + レシピ」で行う。ニックネーム的な情報は `memo` フィールドで表示する
- メタデータエリア: ダメージ、ドライブゲージ消費、SAゲージ消費、タグ、メモ
- レシピ表示エリア: **プリセット切替UI** + レシピ本体
  - プリセット切替は `usePresets()` で取得した5プリセット
  - プリセット選択時のレシピテキスト取得は **M1-05 で追加実装する専用エンドポイント** `GET /api/combos/:id/recipe?preset_id=X` を呼び出す(§2.4 の例外で許容)
- セットプレイ展開エリア: M4 まで未実装、「(セットプレイ機能は M4 で実装予定)」と表示
- アクション: 編集(`/combos/:id/edit` へ、M1-06)、コピー(M2)、削除、戻る

##### 専用エンドポイントの実装(M1-05 で追加)

`GET /api/combos/:id/recipe?preset_id=X` をバックエンドに追加実装する。これは §2.4 の例外条項に該当する。

**実装内容:**

- `internal/api/combo/handler.go` に新規ハンドラ追加
- `combo.RegisterRoutes` に1行追加(エンドポイント登録)
- M1-04 で実装済みの `notation.Service.ResolveComboRecipe(ctx, comboID, presetID)` を呼ぶだけ

**レスポンスフォーマット:**

```json
{
  "comboId": 123,
  "presetId": 1,
  "text": "立ち弱P > 立ち中P > 中波動拳"
}
```

**エラー処理:**

- コンボ不在 → 404
- プリセット不在 → 404
- サービスエラー → 500

**理由:** M1-04 では当初 `ComboResponse` レスポンスに `recipeCache` を展開して含める方針(M1-04 v1.2.1 §4.5.3)だったが、実装上は `ComboResponse.recipe_cache` が `json:"-"` のままのため、フロントから recipe_cache を直接取得する経路がない。本エンドポイント追加で経路を確保し、M1-04 で実装済みの notation サービスを実際に動作させる。フロント実装はテキスト1本を取るシンプルな形になり、ネットワーク負荷も最小。

#### 4.2.3 プリセット切替の動作

DES-004 §5、SUPP-001 §3.4 を踏襲:

- ユーザーがプリセットを選択 → 該当プリセットでレシピが再描画
- `official_ja_move` のみエイリアス投入済み(M1-02)、他4プリセットは空でフォールバック
- フォールバック動作の確認も M1-05 で目視確認できる

#### 4.2.4 セットプレイ名のフォールバック表示(SUPP-001 §2.4)

セットプレイデータは M4 まで来ないため、本来は M1-05 では実装不要だが、**フォールバック表示の関数(`getSetupDisplayName`)はユーティリティとして用意しておく**。M4 で利用される。

```typescript
// web/src/features/combo/utils.ts
import { SETUP_FALLBACK_NAME_LENGTH } from "@/lib/constants";

export function getSetupDisplayName(name: string | null, recipeText: string, isMobile: boolean): string {
  if (name) return name;
  const maxLen = isMobile ? SETUP_FALLBACK_NAME_LENGTH.mobile : SETUP_FALLBACK_NAME_LENGTH.pc;
  if (recipeText.length <= maxLen) return recipeText;
  return recipeText.slice(0, maxLen) + "…";
}
```

### 4.3 TanStack Query フック

`web/src/features/combo/api.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api-client";

export interface ComboListFilter {
  characterId: number;
  isDraft?: boolean;
  sort?: string;
  order?: "asc" | "desc";
  // M1-05段階の最小フィルタ
}

export function useCombos(filter: ComboListFilter) {
  return useQuery({
    queryKey: ["combos", filter],
    queryFn: () => fetchJSON<ComboListResponse>(`/api/combos?${buildQuery(filter)}`),
  });
}

export function useCombo(id: number | string) {
  return useQuery({
    queryKey: ["combo", id],
    queryFn: () => fetchJSON<ComboDetail>(`/api/combos/${id}`),
    enabled: !!id,
  });
}

export function useDeleteCombo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchJSON(`/api/combos/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["combos"] }),
  });
}
```

### 4.4 状況コード→ラベル変換

`web/src/features/combo/utils.ts` に変換関数を実装:

```typescript
// SUPP-001 §3.2 準拠
export const POSITION_LABELS = {
  mid_screen: "画面中央",
  corner_self: "自分画面端",
  corner_self_near: "自分画面端寄り",
  corner_opponent: "相手画面端",
  corner_opponent_near: "相手画面端寄り",
} as const;

export const OPPONENT_STANCE_LABELS = {
  standing: "立ち",
  crouching: "しゃがみ",
  airborne: "空中",
  any: "不問",  // CHANGE-003
} as const;

export const COUNTER_TYPE_LABELS = {
  normal: "通常",
  counter: "カウンター",
  punish_counter: "パニッシュカウンター",
} as const;

export const OPPONENT_SIZE_LABELS = {
  medium: "中",
  large1: "大1",
  large2: "大2",
} as const;
```

将来 i18n 対応する場合は `useTranslation()` を使う形に切り替え可能な構造にしておく(M1-05 では日本語直書きで OK、英語ロケールは M7 で整備)。

### 4.5 スタイリング(Tailwind)

DES-005 §4 のグローバルUI、§5.4・§5.6 の各画面仕様に従う。

- レイアウト: `max-w-7xl mx-auto`(PC想定、SUPP-001 §4.6 PC優先)
- ヘッダ: 固定高さ、影付き
- テーブル: `<table>` または `<div role="table">` で実装、Tailwind の `border`、`hover:bg-slate-50` 等を活用
- 仮登録バッジ: `bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs`

shadcn/ui を**任意で導入可能**(必要なら `pnpm dlx shadcn-ui add table button select` 等)。導入する場合は CLAUDE.md §6 の依存追加ポリシーに従う。

---

## 5. テスト要件

### 必須テスト(SUPP-001 §5.5)

- `web/src/features/combo/utils.test.ts`:
  - `getSetupDisplayName` のテスト(name あり、null かつ recipe 短い、null かつ recipe 長い)
  - 状況コード→ラベル変換関数のテスト

### 任意テスト

- ComboTable などコンポーネントテストは M1-05 段階では任意(主要ロジックを持つコンポーネントのみ、必要なら)
- ページ全体のテストは原則不要(SUPP-001 §5.5)

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M1-05-review-checklist.md`**

---

## 7. 完了条件(Definition of Done)

- [ ] §2 のファイル一覧が全て作成されている(フロントエンド + §2.2 のバックエンド追加3箇所)
- [ ] バックエンドの新規エンドポイント `GET /api/combos/:id/recipe?preset_id=X` が実装され、`curl` で動作確認できる
- [ ] `make run-server` + `make run-web` で開発サーバーが起動し、`http://localhost:5173/` にアクセスしてコンボ一覧が表示される
- [ ] M1-02 で投入されたリュウのテストデータ(コンボ未登録なら空状態が表示される、コンボ登録テスト後は一覧に表示される)
- [ ] 一覧の行をクリックして詳細画面に遷移し、レシピが表示される
- [ ] プリセット切替で `official_ja_move` を選択するとエイリアス変換が反映される、他のプリセットを選ぶとフォールバック動作になる
- [ ] DES-005 v2.6.0 §5.4 の列構成(CHANGE-002 反映済み)に従っている
- [ ] ツリー展開アイコン(▶/▼)が機能し、展開時にプレースホルダ表示される
- [ ] 仮登録バッジが該当コンボに表示される
- [ ] `make test` が全通過する(バックエンドハンドラのテストも含む)
- [ ] 実装完了後、開発者に「M1-05 が完了しました」と報告

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針 |
| DES-005 | `docs/design/05-screen-design.md` v2.6.0 | §4、§5.4、§5.6(中核) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §2.4、§3.2、§5.1、§5.3 |
| DES-003 | `docs/design/03-data-model.md` | 任意参照: §3.4 |

---

## 9. 注意事項・判断に迷ったら

### 推測で進めてはいけない事項

- DES-005 v2.6.0 §5.4 の列構成(CHANGE-002 反映後を厳密に参照、M0 プロトタイプを真とせず)
- DES-005 §5.4 のツリー構造(展開アイコン、インデント)の挙動
- DES-005 §5.6 のコンボ詳細表示要素

### 推測で進めてよい事項(その旨を明示)

- セル内テキストの省略表示(ホバーで全文表示する `title` 属性付与など)
- ボタン・アイコンの細部スタイリング
- 状況コード→ラベル変換テキストの細部(SUPP-001 §3.2 のラベルから自然な日本語に調整可)
- ローディング・エラー表示の文言

### 不明事項発見時の対応

1. DES-005 v2.6.0 と M0 プロトタイプで列構成が異なる → DES-005 v2.6.0 を真とする(本指示書 §1 に明記)
2. API レスポンスの形が想定と違う → M1-03 のハンドラコードを確認、それでも不明なら開発者確認

### Plan Mode で計画提示時に含めるべき項目(任意だが推奨)

- ページコンポーネントの分割粒度
- TanStack Query のキー設計
- 状況コード→ラベル変換の配置(`utils.ts` 単体か、各機能別か)
- shadcn/ui 導入の判断と理由

---

## 10. 完了後の次ステップ

M1-05 完了後、開発者がブラウザで一覧・詳細画面を確認できる。M1-06(コンボ登録・編集画面)は並列実装中なので、完了次第コンボ作成→一覧表示の一連フローが動く。

---

*以上*
