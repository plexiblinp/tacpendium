# M1-05 引継ぎ書(WSL → devContainer 環境移行)

| 項目 | 内容 |
|------|------|
| 作成日 | 2026-05-05 |
| 作成者 | 製造担当 Claude(WSL ホスト側で実装) |
| 引継ぎ先 | devContainer 内の新規 Claude チャット |
| 引継ぎ先の作業範囲 | **Step 7(ビルド・テスト確認)以降、機械レビューを含む M1-05 完了までの全工程** |

---

## 0. 引継ぎが発生した経緯

開発者が誤って devContainer ではなく WSL ホストで本セッションを開始してしまったため、
製造担当 Claude の手元では Go / pnpm が利用できず `make test` を直接実行できなかった。
実装本体(Step 1〜6)は完了しているが、**ビルド・テスト・目視確認・機械レビュー以降は
devContainer 内の新規チャットで実施する**ことになった。

---

## 1. 作業対象

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M1-05-combo-list-detail-pages.md` v1.3.0 |
| レビューチェックリスト | `docs/instructions/reviews/M1-05-review-checklist.md` |
| ワークツリーパス(devContainer 内) | `combomgr-m1-05/` |
| 並列実行中の指示書 | M1-06(`combomgr-m1-06/` ワークツリー、製造中) |

---

## 2. 実装方針として開発者が承認した重要決定事項

### 2.1 プリセット切替時のレシピテキスト取得経路(★案A 採用)

指示書 §4.2.2 と M1-05 §2.3 の整合のため Plan Mode で開発者確認を実施。
最終的に **案A:バック側に最小エンドポイント `GET /api/combos/:id/recipe?preset_id=X`
を追加する**方針で承認された(M1-04 §4.5.3 で M1-05 へ繰越されていた任意エンドポイント)。

実装内容:
- `combo` パッケージ内のみで完結(`main.go` への追記は1行のみ)
- 既存の `notation.Service.ResolveComboRecipe()` を経由してプリセット解決後の文字列を返す
- フォールバック動作(該当プリセット → official_ja_move → moves.code)はサービス層任せ
- 不在コンボには 404 を返すため事前に `service.Get()` で存在確認を入れている

### 2.2 shadcn/ui 導入見送り(案B)

指示書 §4.5 で「任意導入可能」とされていたが、CLAUDE.md §6 依存追加ポリシー上の
事前承認手順を踏まえて見送り。素の HTML + Tailwind ユーティリティ + `lucide-react`
アイコンのみで実装した。

**並列実行中の M1-06 製造担当からも同件で問い合わせがあり、現状は B(未導入)で
回答済み。M1-06 も見送り方針で並列衝突回避の合意ができている。**
詳細記録: `C:\Users\altle\.claude\plans\m1-05-shadcn-ui-wise-aho.md`(Claude のローカル
プランファイル、内容は本書 §3.5 に転載済みのため未参照でも可)。

### 2.3 初期キャラクター固定値

`web/src/lib/constants.ts` に `INITIAL_CHARACTER_ID = 1` を定義し、コンボ一覧画面で
リュウ(`character_id=1`)に固定して取得する(SUPP-001 §3.1 のフェーズ1キャラスコープ)。

---

## 3. 実装済み内容(Step 1〜6 完了)

### 3.1 新規作成ファイル(13件、すべて `combomgr-m1-05/` 配下)

#### フロントエンド・型/API/ユーティリティ
- `web/src/features/combo/types.ts` — `ComboSummary`、`ComboDetail`、`ComboStep`、
  `ComboListResponse`、`ComboRecipeResponse` 等(Go 側 `internal/api/combo/dto.go` を写経)
- `web/src/features/combo/api.ts` — `useCombos` / `useCombo` / `useComboRecipe` /
  `useDeleteCombo`(DELETE は 204 No Content のため `fetchJSON` ではなく raw `fetch`)
- `web/src/features/combo/utils.ts` — `getSetupDisplayName`(SUPP-001 §2.4)、
  状況コード→ラベル変換マップ4種(SUPP-001 §3.2)、`formatStarterStatus`、
  `formatDamage` / `formatDriveGauge` / `formatSAGauge` / `formatMemo`、`labelFor`
- `web/src/features/combo/utils.test.ts` — Vitest テスト(getSetupDisplayName 6 ケース、
  labelFor、formatStarterStatus、整形系)
- `web/src/features/preset/types.ts` — `Preset` 型 + `BUILTIN_PRESET_CODES` 定数
- `web/src/features/preset/api.ts` — `usePresets()`(staleTime 5分)

#### フロントエンド・コンポーネント
- `web/src/features/combo/components/ComboFilterBar.tsx` — 仮登録切替 + ソート + 順序
- `web/src/features/combo/components/SetupTreeRow.tsx` — 「(セットプレイは M4 で実装予定)」
  プレースホルダ
- `web/src/features/combo/components/ComboTableRow.tsx` — CHANGE-002 反映の列構成 1 行
- `web/src/features/combo/components/ComboTable.tsx` — テーブル本体、`useState<Map>` で展開状態
- `web/src/features/combo/components/PresetSwitcher.tsx`
- `web/src/features/combo/components/ComboDetailRecipe.tsx` — `useComboRecipe` を叩く
- `web/src/features/combo/components/ComboDetailHeader.tsx` — combos.name 非表示
- `web/src/features/combo/components/ComboDetailMetadata.tsx` — 起き攻め6BOOLEAN含む

#### フロントエンド・ページ
- `web/src/pages/ComboListPage.tsx`
- `web/src/pages/ComboDetailPage.tsx`

### 3.2 修正ファイル(7件)

| パス | 変更内容 |
|------|----------|
| `web/src/lib/constants.ts` | `SETUP_FALLBACK_NAME_LENGTH` と `INITIAL_CHARACTER_ID` を追加 |
| `web/src/router.tsx` | `/`、`/combos`、`/combos/:id` ルート追加(`/health` は残置) |
| `web/src/locales/ja.json` / `en.json` | コンボ一覧・詳細画面のラベルキーを `comboList.*`、`comboDetail.*`、`common.*` に追加 |
| `internal/api/combo/dto.go` | `RecipeResponse { ComboID, PresetID, Text }` を追加 |
| `internal/api/combo/handler.go` | `notationSvc notation.Service` フィールド追加、`NewHandler(service, notationSvc)` にシグネチャ変更、`GetRecipe` ハンドラ追加 |
| `internal/api/combo/routes.go` | `g.GET("/combos/:id/recipe", h.GetRecipe)` を 1 行追加 |
| `cmd/combomgr/main.go` | `combohandler.NewHandler(comboService, notationSvc)` の 1 行のみ変更 |
| `internal/api/combo/handler_test.go` | `mockNotationService`(notation.Service 全 7 メソッドの no-op 実装)、`newTestServerWithNotation` ヘルパ、`TestHandler_GetRecipe_{200,400_MissingPresetID,404_ComboNotFound}` 3 ケース、`var _ notation.Service = (*mockNotationService)(nil)` の静的アサーションを追加。`database/sql` と `notation` の import を追加 |

### 3.3 触っていないもの(参考)
- バック側のサービス層・リポジトリ層・モデル層は完全に無変更
- M0 プロトタイプ(`web/prototypes/`)は無変更

### 3.4 設計上の暫定処理(コードコメント有り、要レビュー観点)

| 観点 | 暫定処理 | 理由 / 将来対応 |
|------|----------|-----------------|
| 一覧の「ルート」列 | `-` 固定表示 | 一覧 API は `recipe_cache` を JSON 出力しない(`json:"-"`)+ steps を含めない設計のため、列ヘッダだけ用意して値はハイフン。詳細画面のプリセット切替で正式値を確認可能。M3 以降で一覧 API 改修 or バルクレシピ取得 API を検討 |
| 一覧の「タグ」列 | `-` 固定表示 | M1-03 段階で tag API が未実装。M3 でタグ機能実装時に連携 |
| セットプレイ展開 | プレースホルダ行 | M4 でセットプレイデータ取得実装が来るまで「(セットプレイは M4 で実装予定)」表示 |
| 削除確認 | `window.confirm()` | 将来 shadcn/ui の AlertDialog などに差し替え可能(M2 以降) |
| 始動技表示 | `始動技#<id>` 形式 | 一覧 API には `starter_move_id` のみで `move_code` が含まれないため数値 ID 表示。M3 以降で moves API 連携 or サマリ DTO 拡張で対応 |
| エラー表示文言 | i18n キー経由の汎用文言 | バリデーションエラーレスポンス(`validations` フィールド)の項目別表示は M2 以降 |

### 3.5 shadcn/ui 状況(M1-06 への共有用、再掲)

`combomgr-m1-05/web/` の shadcn 関連生成物状況(2026-05-05 時点で確認済み):
- `web/components.json` 不在
- `web/src/components/` ディレクトリ自体不在(機能別は `features/combo/components/` に配置)
- `tailwind.config.js` は最小構成(`extend: {}`、`plugins: []`、CSS 変数モード未設定)
- `web/src/index.css` は素の `@tailwind base/components/utilities;` のみ
- `package.json` の依存:`clsx` のみ。`class-variance-authority` / `tailwind-merge` /
  `@radix-ui/*` / `tailwindcss-animate` すべて未追加
- `pnpm dlx shadcn-ui add ...` 実行履歴なし

---

## 4. 引継ぎ先での残作業(優先順)

### 4.1 Step 7:ビルド・自動テスト確認【最優先】

devContainer 内で以下を実行し、すべて通過することを確認:

```bash
# Go(バックエンド)
go test ./...

# フロントエンド単体テスト(Vitest)
cd web && pnpm install   # 既存 lockfile に変更はないが念のため
cd web && pnpm test -- --run

# 型チェック
cd web && pnpm lint   # tsc --noEmit
```

**重点的に見るテスト:**
- `internal/api/combo/handler_test.go` の `TestHandler_GetRecipe_*` 3 ケース
  (200 / 400 missing preset_id / 404 combo not found)
- `web/src/features/combo/utils.test.ts` の `getSetupDisplayName` 6 ケース、
  ラベル変換 + 整形系

**もしビルド or テストが落ちたら**、本書 §6「想定される落とし穴」を先に確認。

### 4.2 開発サーバ起動 + 目視確認(M1-05 §7 DoD)

```bash
# Terminal 1
make run-server

# Terminal 2
make run-web
# → http://localhost:5173/
```

DoD §7 の以下項目を目視で確認:
- [ ] `/` でコンボ一覧が表示される(M1-02 のリュウテストデータがあれば一覧、なければ空状態文言)
- [ ] 一覧の行をクリックして詳細画面に遷移し、レシピが表示される
- [ ] プリセット切替で `official_ja_move` を選択するとエイリアス変換が反映される、
      他のプリセットを選ぶとフォールバック動作になる(M1-02 で `official_ja_move` のみ
      アライアス投入済み、他4プリセットは空でフォールバック)
- [ ] DES-005 v2.6.0 §5.4 の列構成(CHANGE-002 反映済み)に従っている
- [ ] ツリー展開アイコン(▶/▼)が機能し、展開時にプレースホルダ行が表示される
- [ ] 仮登録バッジ(`is_draft = true`)が該当コンボに表示される

**コンボデータ未投入の場合**、M1-06 並列実装が完了していなければデバッグ API
(M1-07 で実装、`-tags=debug` ビルド)経由で投入可能。

### 4.3 機械レビュー実施

レビューチェックリスト: `docs/instructions/reviews/M1-05-review-checklist.md`
レビュー結果は `docs/progress/m1-05-review.md` などに残す慣習(M1-04 を参考に)。

### 4.4 進捗ログ更新

実装で発見した暫定処理(本書 §3.4)を `docs/progress/progress-log.md` に記録。
特に:
- 一覧の「ルート」「タグ」「始動技 code」の暫定ハイフン表示の理由と、将来対応
  マイルストーン(M3 想定)
- 案A 採用で recipe エンドポイントを M1-05 で追加した経緯

---

## 5. 並列実行中の M1-06 との衝突可能性

| 共有ファイル | M1-05 での変更 | M1-06 が触りそうな箇所 | マージ難易度 |
|--------------|----------------|------------------------|--------------|
| `web/src/router.tsx` | `/`、`/combos`、`/combos/:id` を追加 | `/combos/new`、`/combos/:id/edit` を追加 | 行追加のみ、容易 |
| `web/src/features/combo/types.ts` | 全型を新規作成 | `CreateInput`、`UpdateMetadataInput` 等の追加 | 末尾追記、容易 |
| `web/src/features/combo/api.ts` | `useCombos` / `useCombo` / `useComboRecipe` / `useDeleteCombo` 追加 | `useCreateCombo` / `useUpdateMetadata` / `usePutCombo` 追加想定 | 関数粒度で追記、容易 |
| `cmd/combomgr/main.go` | `combohandler.NewHandler(comboService, notationSvc)` の 1 行のみ変更 | バック非変更想定 | 衝突なし |
| `web/tailwind.config.js` / `index.css` / `components.json` | 無変更 | 同左(shadcn 見送り合意済み) | 衝突なし |

**マージ時に開発者が解決する想定**で、両指示書とも commit を小さく独立に保つ方針。
Claude Code は git 操作不可。

---

## 6. 想定される落とし穴

### 6.1 Go 側コンパイルエラー候補

- `internal/api/combo/handler.go` で `notation` パッケージを import 追加済み
  (パス: `github.com/plexiblinp/combomgr/internal/service/notation`)。go.mod の
  module 名が違う場合は import パスを調整
- `handler_test.go` に `database/sql` と `notation` の import 追加済み。
  `var _ notation.Service = (*mockNotationService)(nil)` の静的アサーションが
  `notation.Service` インタフェース変更に追従できているか確認
- `NewHandler` のシグネチャ変更により他テストが落ちる可能性は低い
  (現状 `combomgr-m1-05/` 内の唯一の呼出元は `cmd/combomgr/main.go` と
  `internal/api/combo/handler_test.go` のみ。両方とも更新済み)

### 6.2 フロント側型/lint エラー候補

- `tsconfig.json` で `noUnusedLocals` / `noUnusedParameters` が有効。コードレビューで
  未使用 import / 未使用引数があれば指摘・修正
- `useComboRecipe` の `enabled` ロジック:`comboId !== undefined && comboId !== ""
  && presetId !== undefined`(空文字 / undefined ガード両方)

### 6.3 ランタイム挙動

- レシピ取得 API (`GET /api/combos/:id/recipe?preset_id=X`)が初回アクセス時に
  `recipe_cache` 未生成だと、サービス層が同期計算 + INSERT する(`notation.Service.
  ResolveComboRecipe` の挙動)。少し遅延するがエラーではない
- 一覧画面で `character_id=1` 固定。テストデータ未投入だと空状態文言が表示される

---

## 7. 不明点が出た場合の参照優先順位

1. **本書(`docs/human-notes/m1-05-handover.md`)** — まずここ
2. CLAUDE.md(プロジェクトルートのもの)
3. `docs/instructions/M1-05-combo-list-detail-pages.md` v1.3.0 — 指示書本体
4. `docs/instructions/reviews/M1-05-review-checklist.md` — 機械レビュー観点
5. `docs/design/05-screen-design.md` v2.6.0 §4 / §5.4 / §5.6
6. `docs/design/supp-001-detailed-design.md` §2.4 / §3.2 / §5.1 / §5.3
7. `docs/change-notes/CHANGE-002-combo-list-columns.md` / `CHANGE-006-counter-to-hit-type.md`

不明点が解消できない場合は **開発者に質問**(CLAUDE.md §9)。本書執筆者(私)は
セッション分離のため引継ぎ後の質問には応答できない点に注意。

---

## 8. 完了条件(本引継ぎの完了 = M1-05 全体の完了)

- [ ] `go test ./...` 全通過
- [ ] `pnpm test -- --run`(web)全通過
- [ ] `pnpm lint`(web)エラーなし
- [ ] 開発サーバで M1-05 §7 DoD のチェック項目をすべて確認
- [ ] 機械レビュー(`M1-05-review-checklist.md`)を実施し、結果を `docs/progress/`
      に出力
- [ ] 進捗ログ(`docs/progress/progress-log.md`)に M1-05 完了を記録
- [ ] 開発者へ「M1-05 が完了しました」と報告

---

*以上*
