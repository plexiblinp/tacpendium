# 進捗ログ

| 項目 | 内容 |
|------|------|
| 文書ID | PROGRESS-LOG |
| 用途 | **製造工程の横断インデックス**(2026-08-11 開発者裁定④)。1 サブにつき **日付・作業 ID・結果・報告書リンク ＋ 完了報告に書けない横断課題**(他サブ・他マイルストーンへ波及する事項)だけを置く。**詳細本文の正本は個別の完了報告**(`docs/progress/<id>-completion-report.md`)であり、E2E 手順・curl 出力・実装の細部を本書へ再掲しない。設計書は「あるべき姿」を保つため、設計外の意思決定・暫定処理はここに集約する(CLAUDE.md §8)<br>**★M3 期など古い節は全量記録型のまま残っている**——**遡及改訂はしない**(裁定④。履歴の可読性を落とすため)。本行は M19 期以降の実態(20〜60 行/サブの索引＋★所見)を追認したものである |
| 対象読者 | **製造担当 Claude Code が完了時に追記、開発者が参照**。**親チャット(設計卓)は本書を読まない**——親が読む progress 資料は `progress-summary.md` だけで、それも起動時の投入資材として読む(2026-08-11 開発者裁定①)。設計・指示書作成担当が詳細を要するときは本書の該当節から個別報告へ辿る |
| 更新ルール | 各サブマイルストーン完了時に製造担当が索引行を追記する。**手順は製造 CLI 側に組み込み済み**(`.claude/commands/implement_plan.md` §完了時 ／ `implement_plan_full.md` Phase D ／ `incorporate_plan.md`)。指示書テンプレートの記入指針(D-191)にも同じ要求があるが、**指示書側だけに置いていた期間に M19-04b / 04d で追記が落ちた**ため CLI 側へ二重化した<br>**`docs/handover/design-instruction-playbook.md` §11.2 / §11.4 は 2026-08-11 に同期済み**(followup `playbook-progress-log-scope-sync` 完了)。索引行の形式は playbook §11.2 が、`progress-summary` との読まれ方は §11.4 が持つ。既知制限事項の統合方針・クローズ記録の作法(§11.1 / §11.3)も引き続き playbook が正本 |

---

## M3-01: タグ機能とタグ管理 UI(2026-05-10 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm exec vitest run` 全通過(123 テスト) | ✅ |
| `pnpm exec tsc --noEmit` 型エラーなし | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| migration 000007 seed 確認(API で初期タグ3件) | ✅ |
| 進捗ログ更新 | ✅ |

### API 動作確認結果

```bash
# GET /api/tags → 使用中・練習中・頻度低下 の3件が返される
# GET /api/tags?include_usage=true → usageCount フィールド付きで返される
# POST /api/tags {"name":"テスト","color":"#FF0000"} → 201 Created
# POST (重複) → 409 {"error":{"code":"TAG_NAME_DUPLICATE",...}}
# POST (空名) → 400 {"error":{"code":"TAG_NAME_EMPTY",...}}
# PATCH /api/tags/4 → 200 更新後タグ返却
# DELETE /api/tags/4 → 204 No Content
```

### 実装上の決定事項

#### 1. JSON 命名規則: camelCase 統一

指示書 §4.2.2 は `user_id`(snake_case)だったが、既存コンボ API が `userId`(camelCase)を使っているため `userId` に統一。TypeScript 型も `userId: number`。

#### 2. Category/Color の Go 型: `*string` 維持

指示書は値型 `string` を記載していたが、SQLite NULL カラムを `database/sql` で正確にスキャンするため既存の `*string` を維持した。

#### 3. エラーレスポンス: ネスト形式

既存のフラット形式 `{error: string, message: string}` ではなく、タグ固有エラーコード(TAG_NAME_DUPLICATE 等)と `details` フィールドが必要なため指示書 §4.2.3 のネスト形式 `{error: {code, message, details}}` を採用。tag パッケージ内に独自 `tagErrorResponse` 構造体を定義。

#### 4. migration 000007 でデフォルトユーザーを seed

`INSERT OR IGNORE INTO users (id, name) VALUES (1, 'default')` を 000007 の up マイグレーションに追加。既存 000001〜000006 にユーザー seed がないため、テスト DB・本番 DB いずれも確実に user_id=1 が存在するようにした。

#### 5. down.sql の `name IN (...)` 条件について

設計書（指示書 §3.2）の down.sql は `WHERE user_id=1 AND category='mycombo_status'` のみを条件としているが、実装では `AND name IN ('使用中', '練習中', '頻度低下')` を追加している。これは「down 実行前に手動作成した同カテゴリのタグを誤って削除しないための安全側の実装」であり、設計書との意図的な乖離。

#### 6. TagFormDialog の color input に data-testid を付与

テスト(`TagFormDialog.test.tsx`)が `getByTestId("color-input")` でカラー入力フィールドを特定するため、`<input id="tag-color">` に `data-testid="color-input"` を追加した。

---

## M2-01: 仮想コントローラ(レバーレス)と modifiers 編集 UI(2026-05-07 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `pnpm exec vitest run` 全通過(42 テスト) | ✅ |
| `pnpm exec tsc --noEmit` 型エラーなし | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| §3.4.1 seed 確認コマンド実行済み | ✅ |
| 進捗ログ更新 | ✅ |

### §3.4.1 seed 確認コマンド出力

```bash
$ curl 'http://localhost:47318/api/moves?character_id=1' | jq '.items[] | select(.code=="drive_parry" or .code=="forward_throw" or .code=="back_throw") | {code, nameJa}'
{
  "code": "forward_throw",
  "nameJa": "前投げ"
}
{
  "code": "back_throw",
  "nameJa": "後ろ投げ"
}
{
  "code": "drive_parry",
  "nameJa": "ドライブパリィ"
}
```

`drive_parry`(id=43)・`forward_throw`(id=40)・`back_throw`(id=41) の3種がリュウの moves に seed 済みであることを確認。新規マイグレーション作成不要。

※ レスポンスの `jq` フィルタが指示書 §3.4.1 の `.[]` ではなく `.items[]` になっている。実際の API レスポンスは `{ "items": [...] }` 形式のため。

### E2E 動作確認手順書(開発者実施)

以下4シナリオを開発者がブラウザで手動実行して確認する。

```
## E2E シナリオ A: 仮想コントローラからのレシピ入力

1. /combos/new で新規コンボ画面を開く
2. キャラ「リュウ」を選択
3. 仮想コントローラの [LP] ボタンをクリック → ステップリストに「立ち弱P」が追加される
4. [MP] ボタンをクリック → 「立ち中P」が追加される
5. ラッシュボタン(parry_drive_rush)をクリック → 「ラッシュ(非技)」のようなステップが追加される
6. [HP] ボタンをクリック → 「立ち強P」が追加される
7. ステップリストに4つのステップが順に並んでいることを確認
8. 削除ボタンをクリック → 最後のステップが削除される
9. ステップリストが3つに戻ることを確認

## E2E シナリオ B: 既存技セレクタとの併存

1. 続けて、既存の技セレクタから「波動拳」を選択して「追加」
2. ステップリストに「波動拳」が追加される
3. 仮想コントローラと技セレクタの両方から追加されたステップが同じリストに並ぶことを確認

## E2E シナリオ C: modifiers 編集 UI

1. ステップリストの「立ち中P」の「編集」ボタンをクリック → modifiers 編集モーダルが開く
2. flags の「link」「just」にチェックを入れる
3. notes に「目押し1F」と入力
4. 「保存」をクリック → モーダルが閉じる
5. ステップリストの該当ステップに修飾情報が反映されていることを確認
6. コンボを保存
7. ブラウザリロード後、コンボ詳細画面 → 編集画面に戻り、当該ステップの編集ボタンをクリック
   → モーダルに「link」「just」チェック、notes に「目押し1F」が反映されていることを確認
   (= 保存ラウンドトリップが正しく動作する)

## E2E シナリオ D: notes の保存(M2-01 範囲、表示は M2-04)

1. シナリオ C の手順 6 でコンボ保存後、ターミナルで以下を実行:
   curl http://localhost:47318/api/combos/<保存したコンボのID> | jq '.steps[].modifiers.notes'
2. 「目押し1F」が JSON レスポンスに含まれていることを確認
3. ※ コンボ詳細画面でこの notes が表示されない件は M2-04 で対応する
```

### notes の保存動作について

ModifiersEditor で notes を入力・「保存」クリック → `handleModifiersSave` → `onChange(steps)` → `ComboEditor` の `handleSave` → `buildCreatePayload` / `useUpdateComboWithKeyChange` 経由で API に送信される。M1-06 の `buildCreatePayload` が `modifiers` を JSON そのまま含めるため、notes フィールドも自動的に保存される。画面表示(詳細画面のレシピ中に括弧付きで表示)は M2-04 で対応(M1 完了時点の既知制限事項として上記に記録済み)。

### 実装上の決定事項

#### 1. `step_commit` ボタンを HitBoxLayout に追加

`LogicalButton` 型に `step_commit` が定義されているが、当初 `HitBoxLayout.tsx` のシステムブロックに `step_commit` ボタンが存在しなかった。レビュー指摘を受け開発者確認の上、案A(「確定」ボタンとして配置、クリック時は何もしない)で追加した。

#### 2. `StepInput` 型を `useControllerInput.ts` からエクスポート

`useControllerInput.ts` / `VirtualController.tsx` / `RecipeBuilder.tsx` の3ファイルで `type StepInput = Pick<Step, "moveId" | "moveCode" | "modifiers">` が重複定義されていた。`useControllerInput.ts` でエクスポートし、他2ファイルはインポートに変更した。

#### 3. `@testing-library/user-event` を devDependency として追加

テストで `userEvent` を使用するため、`pnpm add -D @testing-library/user-event` で追加した。ライセンス: MIT。

---

## M1-05: コンボ一覧・詳細画面(2026-05-05 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm test -- --run` 全通過(20 テスト) | ✅ |
| `pnpm lint`(tsc --noEmit)エラーなし | ✅ |
| 開発サーバで DoD 項目を API レベルで確認 | ✅ |
| 進捗ログ更新 | ✅ |

### 暫定処理の記録

#### 1. 一覧の「ルート」列ハイフン表示

**内容:** コンボ一覧テーブルの「ルート(レシピ)」列は `-` 固定表示。

**理由:** 一覧 API(`GET /api/combos`) のレスポンスには `recipe_cache` が含まれない
(`json:"-"` 指定) + `steps` も含まれない設計のため、一覧画面からレシピ文字列を生成できない。
詳細画面のプリセット切替(`GET /api/combos/:id/recipe?preset_id=X`)で正式なエイリアス変換結果を確認可能。

**将来対応:** M3 以降で以下のいずれかを実装して解決する予定。
- 一覧 API に `default_recipe`(official_ja_move プリセットの文字列)を追加
- バルクレシピ取得 API(`GET /api/combos/recipes?preset_id=X&ids=...`)を新設

#### 2. 一覧の「タグ」列ハイフン表示

**内容:** タグ列は `-` 固定表示。

**理由:** M1-03 段階でタグ API が未実装。タグデータの取得手段がない。

**将来対応:** M3 でタグ機能実装時に一覧 API との連携を実装する。

#### 3. 一覧の「始動技」表示が `始動技#<id>` 形式

**内容:** 一覧の始動状況グループ列で始動技を `始動技#42` のように ID 表示している。

**理由:** 一覧 API サマリレスポンスには `starter_move_id`(整数)のみ含まれ、
`move_code` は含まれない。moves API が未整備のため ID からコード文字列を引けない。

**将来対応:** M3 以降で moves API 連携または一覧 DTO 拡張
(`starterMoveCode` フィールド追加)で対応する。

#### 4. recipe エンドポイントを M1-05 で追加(案A 採用)

**内容:** `GET /api/combos/:id/recipe?preset_id=X` エンドポイントをバックエンドに追加した。

**経緯:** 当初 M1-04 指示書 §4.5.3 で M1-05 へ繰越されていた「任意エンドポイント」。
M1-05 のプリセット切替 UI 実装に際して必要性が確定したため、製造担当が Plan Mode で
開発者に確認の上、案A(バックエンドに最小エンドポイントを追加)を採用した。
案B(フロント側で combos detail API のレスポンスから recipe_cache JSON をパースする)は
型安全性と責務分離の観点から不採用。

**実装スコープ:** `internal/api/combo` パッケージ内で完結。`notation.Service.ResolveComboRecipe()`
を経由してプリセット解決後の文字列を返す。フォールバック動作(エイリアスなし → official_ja_move
→ moves.code)はサービス層に委譲。

#### 5. shadcn/ui 未導入

**内容:** 指示書 §4.5 で「任意導入可能」とされていた shadcn/ui を未導入のまま実装した。

**理由:** CLAUDE.md §6 の依存追加事前承認手順に基づき開発者確認を実施したが、
M1-06 並列実装との衝突回避(両マイルストーンでの二重追加リスク)のため両者見送りで合意。
素の Tailwind CSS + lucide-react アイコンで実装。

**将来対応:** M2 以降で両マイルストーン完了後に改めて検討可能。

#### 6. 削除確認ダイアログに `window.confirm()` を使用

**内容:** コンボ削除時の確認を `window.confirm()` で実装した。

**理由:** M1-05 段階では shadcn/ui 未導入のため AlertDialog が利用不可。

**将来対応:** M2 以降で shadcn/ui 導入時に AlertDialog へ差し替え可能。

---

## 2026-05-05 (M1-06: コンボ登録・編集画面)

### ライブラリ追加: zod ^3.23.8

- **追加対象**: `web/package.json` (frontend)
- **理由**:
  - M1-06 はフォーム入力が中核。フロント側の最低限のフォーマットチェック(指示書 §4.6)に
    使用するため型安全な schema バリデータが必要。
  - 仮登録モード(`is_draft=true`)時のバリデーション緩和(SUPP-001 §2.1)を schema 分岐で
    表現できる点が手書き if 文より読みやすく保守しやすい。
  - CLAUDE.md §2 の「フロントエンド」技術スタックに記載済みのため新規ライブラリでは
    なく既定路線(再確認した上での導入)。
- **ライセンス**: MIT(許可ライセンス、CLAUDE.md §6)。
- **代替検討**:
  - Yup: 老舗だが TypeScript 推論が弱く、本プロジェクトの `strict` ポリシーと相性が悪い。
  - React Hook Form の組み込みバリデーション: 採用済み React Hook Form が無いため不要。
  - 自前の if 文: 入力項目数が多くメンテ負荷が高くなる見込み。
- **使用方針**: `web/src/features/combo/schema.ts` に `comboFormSchema` を定義し、
  保存ボタン押下時に `safeParse` で検証する。React Hook Form 等のフォームライブラリは
  M1-06 では導入せず、`useState` ベースで管理する。

### 方針確定: shadcn/ui の M1-06 導入見送り

- **背景**: 並列作業中の M1-05 と shadcn/ui を両ブランチで初期化すると
  `tailwind.config.js`, `index.css`, `components.json` のマージ衝突が確実。
- **判断**: M1-06 では shadcn/ui を導入せず、標準 HTML + Tailwind の薄いラッパーで対応。
  統一導入は M1 完了後の整理フェーズか M2 着手時に行う。
- **影響**: Button/Input/Select/Checkbox/Dialog 等は plain HTML + Tailwind ユーティリティで
  自作する。M2 以降で shadcn/ui に置き換え予定。

### バックエンド変更: GET /api/moves エンドポイント追加

- **追加対象**: `internal/api/move/`、`internal/repository/move/`
- **理由**: M1-06 の技セレクタが現キャラの全技を表示する必要があるが、本指示書 §2.3 の
  「変更しないもの」に該当しないバックエンド側で moves API が未提供だった。最小限の
  read-only 1 エンドポイント(`GET /api/moves?character_id=N`)として追加。
- **責務分離**: `internal/service/combo/deps_adapter.go` の `MoveAdapter` は
  validation 用の小さなアダプタなので、Move CRUD 用には別パッケージ
  `internal/repository/move/` を新設した。
- **JOIN 方針**: moves テーブルには表示名カラムが無いため(DES-004 §1.2)、
  `preset_aliases` の `official_ja_move` プリセットの `alias_text` を LEFT JOIN で
  取得し、`name_ja` フィールドとして返す。

---

## M1 完了時点の既知の制限事項

### modifiers.notes の表示処理が未実装 — ※M2-04 で解消済み (2026-05-09)

**概要:**

`modifiers.notes`(SUPP-001 §3.3.4 で定義した、ステップ単位の自由記述メモ)は、M1-06 のコンボ登録画面で入力可能で、DB(combo_steps.modifiers JSON カラム)にも正しく保存されるが、**コンボ詳細画面のレシピ表示で notes を画面に表示する処理が未実装**。

**確認方法:**

1. コンボ登録時にステップに notes(例: "目押し1F")を入力 → 保存
2. コンボ詳細画面でレシピ表示を確認 → notes が表示されない
3. ただし API レスポンスには notes が含まれている: `curl http://localhost:47318/api/combos/<id> | jq '.steps[].modifiers.notes'`

**原因:**

- M1-04 の notation サービス(resolver.go)で、notes を出力テキストに組み込む処理がない
- M1-05 のコンボ詳細レシピ表示コンポーネントで、step.modifiers.notes を読み取って表示する処理がない
- 設計担当の指示書記述で、notes 表示の責任所在(M1-04 か M1-05 か)を明示していなかったため、両指示書で実装が漏れた

**影響範囲:**

- データの保存・取得には影響なし(DB・API レスポンスは正常動作)
- ユーザー視点では「入力した notes がどこにも見えない」状態
- M1 の DoD(コア機能の動作)には影響なし、優先度は低

**対応方針:**

M2 以降の UI 改善時に統合的に対応する。SUPP-001 §3.3.4 の表示方針(レシピ表示の中で括弧付きまたは別行アイコン付き等)に従って、UI フォーマットを確定したうえで実装する。

**関連箇所:**

- 設計: SUPP-001 §3.3.4(modifiers.notes の用途・表示方針)
- バックエンド: `internal/service/notation/resolver.go`(notes を出力テキストに組み込む処理を追加)
- フロントエンド: `web/src/features/combo/components/ComboDetailRecipe.tsx`(step.modifiers.notes を表示する処理を追加)

**M2-04 での対応:**

- resolver.go の `applyFlags` に notes 出力処理を追加(SUPP-001 §3.3.4 括弧付きインライン形式: `(notes内容)`)
- ComboDetailRecipe.tsx は変更不要(GET /api/combos/:id/recipe 経由でテキスト取得しているため、resolver.go 修正で自動的に notes が表示される)
- 副次効果として、コンボ一覧画面のルート列でも notes が見える

---

## M2-02: 編集系 UX 改善(2026-05-07 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm exec vitest run` 全通過(73 テスト) | ✅ |
| `pnpm exec tsc --noEmit` 型エラーなし | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| curl で check-duplicate API 手動確認(重複なし/重複あり構造化/excludeComboId/400) | ✅(レスポンス下記) |
| サービス層 CheckDuplicate テスト追加(レビュー指摘対応) | ✅ |
| v1.1.0 指示書対応(構造化フィールド・ラベル合成・レビュー指摘全件) | ✅ |
| 進捗ログ更新 | ✅ |

### 実装した 4 機能

1. **コピー機能(FR012)**: 一覧・詳細画面にコピーボタン追加。`/combos/new?copyFrom={id}` で ComboEditorPage がコピーモードで動作。常に POST で新規作成。
2. **リアルタイム重複検知**: `POST /api/combos/check-duplicate` API 新設 + `useCheckDuplicate` フック(300ms デバウンス、AbortController 競合回避)+ `DuplicateRealtimeWarning` バナー。
3. **仮登録→本登録昇格(FR010)**: `PromoteToFinalButton` コンポーネント。PATCH に `isDraft: false` を送信。サービス層で `true→false` 変更時にフルバリデーション(VAL-C01〜C12)実行。
4. **PutConfirmDialog 抽出**: ComboEditor 内のインライン確認ダイアログを独立コンポーネントに抽出。

### 設計外の意思決定

- **PATCH API に IsDraft フィールド追加**: 指示書 §2.4 と §4.5.2 が矛盾(バックエンド変更禁止 vs PATCH で isDraft 送信)。§9.3 に従い Plan Mode で開発者に確認し、`UpdateMetadataInput` に `IsDraft *bool` を追加する最小限の変更で承認済み。
- **ComboEditor の mode prop**: `{ initial?: Combo }` → `{ mode: "new" | "edit" | "copy"; initial?: Combo }` に拡張。copy モード時は hasKeyChanges 判定をスキップし常に POST。

### 新規ファイル

| ファイル | 概要 |
|---------|------|
| `internal/api/combo/check_duplicate_handler.go` | 重複検知ハンドラ |
| `internal/api/combo/check_duplicate_handler_test.go` | ハンドラテスト(6 ケース) |
| `web/src/features/combo/hooks/useCheckDuplicate.ts` | 重複検知フック |
| `web/src/features/combo/hooks/useCheckDuplicate.test.ts` | フックテスト(6 ケース) |
| `web/src/features/combo/components/DuplicateRealtimeWarning.tsx` | リアルタイム警告バナー |
| `web/src/features/combo/components/DuplicateRealtimeWarning.test.tsx` | バナーテスト(3 ケース) |
| `web/src/features/combo/components/PromoteToFinalButton.tsx` | 本登録昇格ボタン |
| `web/src/features/combo/components/PromoteToFinalButton.test.tsx` | 昇格ボタンテスト(5 ケース) |
| `web/src/features/combo/components/PutConfirmDialog.tsx` | PUT 確認ダイアログ |
| `web/src/features/combo/components/PutConfirmDialog.test.tsx` | ダイアログテスト(4 ケース) |

### E2E 検証手順(開発者手動確認用)

#### シナリオ A: コピー機能
1. コンボ一覧から既存コンボの「コピー」ボタンをクリック
2. タイトルが「コンボ新規登録(コピー元: #ID)」となることを確認
3. コピー元のフィールド値がフォームに反映されていることを確認
4. 保存ボタンで新規コンボが POST で作成されることを確認

#### シナリオ B: リアルタイム重複検知
1. 新規コンボ登録画面で、既存コンボと同一の 6 キーフィールド + ステップを入力
2. 300ms 後に黄色い重複警告バナーが表示されることを確認
3. バナー内の既存コンボリンクが詳細ページに遷移することを確認
4. フィールドを変更すると警告が消えることを確認

#### シナリオ C: 本登録昇格
1. 仮登録コンボの詳細画面で「本登録に昇格」ボタンが表示されることを確認
2. ボタンクリック→確認ダイアログ→OK で本登録に変わることを確認
3. 本登録コンボでは「本登録に昇格」ボタンが表示されないことを確認

#### シナリオ D: PUT 確認ダイアログ
1. 既存コンボ編集画面でキーフィールド(ポジション等)を変更
2. 保存時に「再登録になります」確認ダイアログが表示されることを確認
3. キャンセルで戻れること、確認で PUT が実行されることを確認

### v1.1.0 指示書対応(2026-05-08 追加修正)

指示書が v1.0.0→v1.1.0 に更新され、`CheckDuplicateResponse` のレスポンス形式が `{ id }` のみから構造化フィールド 8 件に変更。あわせてレビュー指摘を全件対応。

**バックエンド変更:**
- `DuplicateCandidate` に `StepCount int` 追加
- `DuplicateInfo` を 8 フィールドに拡張
- `DuplicateInfoResponse` (dto) を 8 フィールドに拡張
- ハンドラの全フィールドマッピング追加
- `UpdateMetadata` is_draft 切替時テスト追加(`PromoteDraft_OK` / `PromoteDraft_DuplicateBlocks`)

**フロントエンド変更:**
- `DuplicateRealtimeWarning` にキャラ名・opponentStance/Size 表示追加（CHARACTER_NAMES 定数マップ、OPPONENT_STANCE/SIZE_LABELS 利用）
- `buildDuplicateLabel` をエクスポート純粋関数として切り出し、実ラベル検証テスト 4 件追加

### curl 実行結果(2026-05-08 v1.1.0 対応確認)

#### 正常系: 重複なし(200)

```bash
$ curl -s -X POST http://localhost:47318/api/combos/check-duplicate \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"starterMoveId":99999,"position":"mid_screen","opponentStance":"standing","hitType":"normal","opponentSize":"medium","steps":[{"stepOrder":1,"moveId":99999}]}' | jq .
{
  "duplicates": []
}
```

#### 正常系: 重複あり・構造化フィールド全件確認(200)

```bash
$ curl -s -X POST http://localhost:47318/api/combos/check-duplicate \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"starterMoveId":1,"position":"mid_screen","opponentStance":"standing","hitType":"normal","opponentSize":"medium","steps":[{"stepOrder":1,"moveId":1}]}' | jq .
{
  "duplicates": [
    {
      "id": 10,
      "characterId": 1,
      "starterMoveId": 1,
      "position": "mid_screen",
      "opponentStance": "standing",
      "hitType": "normal",
      "opponentSize": "medium",
      "stepCount": 1
    }
  ]
}
```

`label` フィールドなし・8 フィールド全て含むことを確認。

#### excludeComboId 指定: 自己除外(200)

```bash
$ curl -s -X POST http://localhost:47318/api/combos/check-duplicate \
  -H 'Content-Type: application/json' \
  -d '{"characterId":1,"starterMoveId":1,"position":"mid_screen","opponentStance":"standing","hitType":"normal","opponentSize":"medium","steps":[{"stepOrder":1,"moveId":1}],"excludeComboId":10}' | jq .
{
  "duplicates": []
}
```

#### 異常系: characterId 欠落(400)

```bash
$ curl -s -X POST http://localhost:47318/api/combos/check-duplicate \
  -H 'Content-Type: application/json' \
  -d '{"steps":[]}' | jq .
{
  "error": "invalid_request",
  "message": "characterId is required"
}
```

### 保守上の注意事項

- **CheckDuplicate と validation 層の関係**: `service.go` の `CheckDuplicate` メソッドは `validation.ValidateComboForCreate`(VAL-C02)を経由せず、`FindActivePublishedDuplicates` + `CalcRecipeHash` を直接呼び出す構造。現時点で問題はないが、将来 VAL-C02 の重複判定対象範囲を変更する場合(例: draft も対象に含める等)、`CheckDuplicate` メソッドも同時に更新が必要。

---

## M2-03: ゴミ箱画面 完了報告

**実施日**: 2026-05-09

### 実装内容サマリ

- `DELETE /api/combos/:id/permanent` 完全削除 API を新設
- `GET /api/combos` に `only_deleted=true` クエリパラメータを追加
- `/trash` ページを新設(TrashPage, TrashList, TrashListRow, TrashBulkActions, PermanentDeleteConfirm)
- `useTrashCombos`, `usePermanentDelete`, `useRestoreCombo` フックを新設
- 各ページのヘッダに「ゴミ箱」ナビゲーションリンクを追加

### §3.4 確認結果

| 確認事項 | 結果 |
|---------|------|
| §3.4.1 Restore に RecomputeComboCache 呼出があるか | YES - `service.go` L414 に実装済み → §4.6 スキップ |
| §3.4.3 RecomputeComboCache が存在するか | YES - `internal/service/notation/cache.go` に実装済み |
| §3.4.4 combo_steps に ON DELETE CASCADE | YES - `migrations/000001_init_schema.up.sql` L98 |

### E2E シナリオ(開発者がブラウザで実行)

```
## E2E シナリオ A: 論理削除 → ゴミ箱表示

1. 既存の本登録コンボ(リュウ)を1件、コンボ一覧画面で「削除」アイコンをクリックして論理削除
2. ヘッダの「ゴミ箱」リンクをクリック → /trash 画面に遷移
3. 削除したコンボがゴミ箱一覧に表示されている
4. 削除日時、残日数(あと89〜90日)が表示されている

## E2E シナリオ B: 単体復元

1. ゴミ箱画面で1件選び、「復元」ボタンをクリック
2. 当該コンボがゴミ箱から消える
3. コンボ一覧画面に戻り、復元したコンボが本登録コンボとして表示されている
4. コンボ一覧でレシピ列(ルート)が正しく表示されている(recipe_cache が再計算されている)

## E2E シナリオ C: 単体完全削除

1. ゴミ箱画面で1件選び、「完全削除」ボタンをクリック
2. 確認ダイアログ「このコンボを完全削除します。この操作は取り消せません。続行しますか?」が表示
3. 「完全削除する」をクリック
4. 当該コンボがゴミ箱から消える
5. ターミナルで以下を実行し、DB から物理削除されていることを確認:
   curl 'http://localhost:47318/api/combos/<削除した ID>'  → 404 が返る
6. コンボ一覧画面に戻り、当該コンボが表示されないことを確認(復元できない)

## E2E シナリオ D: 一括復元

1. ゴミ箱に複数コンボを溜める(2〜3件論理削除)
2. ゴミ箱画面でチェックボックスで全選択
3. 「選択を復元」ボタンをクリック
4. 全件が復元され、ゴミ箱が空になる
5. コンボ一覧で全件が表示される

## E2E シナリオ E: 一括完全削除

1. ゴミ箱に複数コンボを溜める(2〜3件論理削除)
2. ゴミ箱画面でチェックボックスで全選択
3. 「選択を完全削除」ボタンをクリック
4. 確認ダイアログで件数表示「選択した N 件のコンボを完全削除します。この操作は取り消せません。続行しますか?」
5. 確認後、全件が完全削除される
6. ターミナルで `curl 'http://localhost:47318/api/combos?character_id=1&only_deleted=true'` → `"items":[]` が返る

## E2E シナリオ F: 完全削除の安全策(誤操作防止)

1. ターミナルで以下を実行(通常コンボに対する完全削除):
   curl -X DELETE 'http://localhost:47318/api/combos/<通常コンボの ID>/permanent'
2. 409 Conflict が返り、メッセージ「permanent delete requires the combo to be soft-deleted first」が表示される
3. DB を確認し、当該コンボが残っていることを確認
```

### 自己テスト結果

- `go test ./...` 全通過
- `pnpm test -- --run` 全通過(87テスト)
- `pnpm tsc --noEmit` 型エラーなし
- `pnpm build` 成功

---

## M2-04: 統合・仕上げ 完了報告

**実施日**: 2026-05-09

### 実装内容サマリ

- resolver.go: `applyFlags` に modifiers.notes を括弧付きインライン表示で出力する処理を追加(SUPP-001 §3.3.4)
- RecipeBuilder.tsx: draftNotes 50文字超警告を ModifiersEditor と同パターンで追加
- PermanentDeleteConfirm.tsx: `createPortal` で `document.body` 直下にレンダリングし DOM 不正ネスト解消
- PutConfirmDialog.tsx: 同様に `createPortal` 化で一貫性確保
- TrashListRow.tsx: 始動状況セルに `stopPropagation` 追加で二重発火対策、復元・完全削除失敗時の `role="alert"` 行内エラー表示追加
- テスト: resolver_test.go に3ケース追加、RecipeBuilder.test.tsx 新規(4ケース)、TrashListRow.test.tsx 新規(3ケース)

### §3.4 確認結果

| 確認事項 | 結果 |
|---------|------|
| §3.4.1 resolver.go: flags 処理が `{ }` 付きで実装済み | YES — `applyFlags` L140-153, flagText マップに just/delay/link/low_jump |
| §3.4.1 resolver.go: notes 処理が未実装 | YES — Modifiers.Notes フィールドは存在するが参照なし → 本指示書で実装 |
| §3.4.2 ComboDetailRecipe.tsx: テキスト経由取得 | YES — `useComboRecipe` 経由で API テキスト取得、変更不要 |
| §3.4.3 RecipeBuilder.tsx: draftNotes 警告なし | YES — L208-215 に maxLength=200 のみ → 本指示書で警告追加 |
| §3.4.3 TrashListRow.tsx: 始動状況セルに stopPropagation なし | YES — L69 の `<td>` に未設定 → 本指示書で追加 |
| §3.4.3 TrashListRow.tsx: エラーハンドリングなし | YES — handleRestore/handlePermanentDelete に try-catch なし → 本指示書で追加 |
| §3.4.3 PermanentDeleteConfirm/PutConfirmDialog: createPortal 未使用 | YES — `fixed inset-0` で直接レンダリング → 本指示書で createPortal 化 |
| §3.4.4 progress-log.md: notes 未実装項目 | YES — L229-264 に記載 → 本指示書で解消済みに更新 |

### 設計判断

- TrashListRow 二重発火対策: **案A(stopPropagation)を選択**。チェックボックスセル・アクションセルで既に同パターン使用済みで統一性が高い。`<Link>` を残すことで右クリック→新規タブのアクセシビリティも維持。

### 持ち越し課題の消化状況

| 出処 | 課題 | M2-04 での扱い |
|------|------|--------------|
| M2-01 連絡事項1 | RecipeBuilder の draftNotes 50文字超警告 | **解消** — §4.2 で実装 |
| M2-01 連絡事項2 | console.warn テストの追加 | M3 以降に持ち越し(記録維持) |
| M2-02 連絡事項1 | useCharacters フック実装時の差し替え(TODO 残置) | M3 で対応(記録維持) |
| M2-02 連絡事項2 | 重複警告リンクの新規タブ開き | M7 で対応(記録維持) |
| M2-02 連絡事項3 | useCheckDuplicate の setIsLoading タイミング | M7 で対応(記録維持) |
| M2-03 連絡事項1 | PermanentDeleteConfirm の createPortal 化 | **解消** — §4.3 で実装 |
| M2-03 連絡事項2 | TrashListRow の二重発火対策 | **解消** — §4.4.1 で実装 |
| M2-03 連絡事項3 | 個別行の復元・完全削除失敗時のエラー表示 | **解消** — §4.4.2 で実装 |

### E2E シナリオ(開発者がブラウザで実行)

```
## E2E シナリオ A: notes 表示(SUPP-001 §3.3.4)

1. /combos/new で新規コンボ作成、ステップに notes("目押し1F")を入力して保存
2. コンボ詳細画面でレシピ表示を確認 → "立ち中P (目押し1F)" のように表示される
3. プリセット切替で他のプリセットでも notes が表示されることを確認
4. ターミナルで以下を実行:
   curl 'http://localhost:47318/api/combos/<id>/recipe?preset_id=1' | jq
   → "text" に notes 入りのテキストが含まれる
5. コンボ一覧画面に戻り、ルート列で notes 入りテキストが表示されることを確認

## E2E シナリオ B: draftNotes 50文字超警告

1. コンボ編集画面で技セレクタ経由でステップを追加
2. notes 入力欄に 50文字以下を入力 → 通常の枠色
3. 51文字以上を入力 → 赤い枠色(警告)
4. 保存して、保存ラウンドトリップが正常動作することを確認(警告は UI のみ、保存は許可される)

## E2E シナリオ C: モーダルの DOM 整合性

1. ゴミ箱画面で完全削除ボタンクリック → PermanentDeleteConfirm 表示
2. ブラウザの開発者ツールで DOM を確認 → モーダルが document.body 直下に配置されている
3. 同じくコンボ編集画面で PUT 編集を試行 → PutConfirmDialog が body 直下に配置されている
4. ESC キー・背景クリックでキャンセル動作することを確認(挙動は M2-02 / M2-03 と同じ)

## E2E シナリオ D: TrashListRow の二重発火対策

1. ゴミ箱画面で行の始動状況セルをクリック
2. ブラウザの戻るボタンでゴミ箱画面に戻る → 1回の戻る操作でゴミ箱画面に戻る(履歴が二重登録されていない)
3. 始動状況セル以外(タグ列など)をクリックでも同様に動作

## E2E シナリオ E: 個別行のエラー表示

1. バックエンドサーバーを停止する(または存在しない ID にアクセスする状況を意図的に作る)
2. ゴミ箱画面で復元ボタンクリック → 行内にエラーメッセージが表示される(role="alert")
3. 同じく完全削除ボタンクリック → 行内にエラーメッセージが表示される
4. バックエンドを復活させて再操作 → 成功し、エラー表示が消える

## E2E シナリオ F: M2 全体の統合 E2E(中核確認)

1. 新規コンボ作成(レバーレス UI でレシピ入力、modifiers 編集 UI で notes 入力、本登録)
2. コンボ一覧で当該コンボのルート列に notes 入りテキストが表示される
3. コンボ詳細を表示、notes が括弧付きで表示
4. コピー機能で当該コンボをコピー → 入力中にリアルタイム重複検知バナー表示
5. メモを変更してコピー保存(POST 経由)
6. 元コンボを編集モードで開き、レシピを変更 → PUT 確認ダイアログ → 続行
7. 旧コンボがゴミ箱に移動、新コンボが本登録
8. ゴミ箱画面で旧コンボを確認、復元ボタンクリック
9. 復元後、コンボ一覧でレシピ・notes が正常表示(recipe_cache 再計算済み)
10. ゴミ箱画面で残ったコンボを完全削除
11. すべての E2E が一貫してエラーなく動作する
```

### 自己テスト結果

- `go test ./...` 全通過(19テスト、notation パッケージ)
- `pnpm test -- --run` 全通過(109テスト)
- `pnpm tsc --noEmit` 型エラーなし
- `pnpm build` 成功

### レビュー結果取り込み (2026-05-09)

Sonnet 4.6 によるレビュー (`docs/progress/m2-04-review.md`) の指摘を取り込み。

**取り込んだ指摘 (4件):**

1. TrashListRow.tsx: エラーメッセージに `復元に失敗しました:` / `完全削除に失敗しました:` の文脈を付加(指示書 §4.4.2 の形式に準拠)
2. TrashListRow.test.tsx: 始動状況セルクリックの二重発火テスト追加(指示書 §5.1.2 必須要件)
3. TrashListRow.test.tsx: 完全削除成功時のエラー非表示テスト追加
4. resolver_test.go: notes 空文字列(`Modifiers{Notes: ""}`)で括弧が出力されないことの明示的テスト追加

**取り込まなかった指摘 (3件):**

5. `applyFlags` 関数名リネーム — 軽微、diff 最小化を意図した判断を維持(将来対応可)
6. PutConfirmDialog ESC キーハンドラ追加 — M2-02 からの継続問題で M2-04 範囲外
7. PutConfirmDialog `role="dialog"` 位置移動 — 同上、M2-02 からの構造的問題で M2-04 範囲外

### M2 全体の完了宣言

M2-01〜M2-04 の全指示書が完了し、M2(編集系の本格化)は完了となります。

---

## M3-02: コンボへのタグ付け UI (2026-05-10)

### 実装完了

- **バックエンド**: `combo_tags` 中間テーブルへの書き込み・読み取りを全 API に統合
  - `CreateRequest.TagIDs`, `UpdateMetadataRequest.TagIDs`, `ComboResponse.Tags` を追加
  - `ReplaceTagAssociations(ctx, tx, comboID, tagIDs)` を repository 層に追加(DELETE 全件 + INSERT 一括)
  - `List` / `FindByID` でタグを 2 クエリ方式(IN 句)で一括取得・マージ
  - `ErrInvalidTagID` 定義、FK 制約違反を 400 + `INVALID_TAG_ID` に変換
  - `UpdateMetadata` / `Create` / `UpdateWithKeyChange` で TagIDs を処理
- **フロントエンド 型・フック**:
  - `Combo.tags: Tag[]`, `ComboSummary.tags: Tag[]` を追加
  - `CreateComboRequest.tagIds?: number[]`, `UpdateMetadataRequest.tagIds?: number[]` を追加
  - `useTagsForSelector` 新規作成(excludeCategories フィルタ付き軽量取得)
- **フロントエンド コンポーネント**:
  - `TagBadgeList` 新規作成(輝度判定でテキスト色自動計算、maxVisible/excludeCategories 対応)
  - `TagSelector` 新規作成(標準 HTML + Tailwind、検索フィルタ、新規タグ作成オプション)
  - `ComboEditorBasicFields`: タグ placeholder を `<TagSelector>` に差し替え、`BasicFieldsValue.tagIds` 追加
  - `ComboEditor`: `initialBasic` で `tagIds` 初期化、`buildCreatePayload`/`buildPatchPayload` に `tagIds` 追加
  - `ComboTableRow`: タグ列「-」を `<TagBadgeList maxVisible={3} excludeCategories={["mycombo_status"]}>` に差し替え(M1-05 暫定処理2 解消)
  - `ComboDetailMetadata`: タグ表示行(`<TagBadgeList size="md">`)を追加

### M1-05 暫定処理2 解消

コンボ一覧のタグ列が「-」固定だった暫定処理を解消。`combo_tags` から実データを取得して表示するよう変更。

### テスト

- `go test ./...` 全通過
- `pnpm vitest run` 全通過(139 テスト)
- `pnpm build` 成功(TypeScript 型エラーなし)

### E2E シナリオ(手動確認用)

**シナリオ A: タグ付きコンボ作成**
1. 新規コンボ登録画面を開く
2. タグフィールドをクリック → ドロップダウン表示
3. 既存タグを選択 → バッジが表示される
4. 保存 → コンボ一覧でタグバッジが表示される

**シナリオ B: 新規タグ作成**
1. タグフィールドをクリック → 「新しいタグ名」を入力
2. 「を新規作成」オプションをクリック → タグが選択される
3. 保存 → タグ管理画面で新タグが存在することを確認

**シナリオ C: タグ全解除**
1. タグ付きコンボを編集
2. バッジ下の削除ボタンで全タグを除去
3. 保存 → 一覧でタグなし表示

**シナリオ D: 存在しない tagId → 400**
```bash
curl -X POST http://localhost:47318/api/combos \
  -H "Content-Type: application/json" \
  -d '{"characterId":1,"isDraft":false,"tagIds":[9999],"steps":[]}'
# → 400 INVALID_TAG_ID
```

**シナリオ E: コンボ詳細でタグ表示**
1. タグ付きコンボの詳細画面を開く
2. メタデータセクションにタグバッジが表示される(size="md")

---

## M3-03: フィルタ・ソート・表示列カスタマイズ + browser-storage ヘルパ(2026-05-11 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm test -- --run` 全通過(157 テスト、+10) | ✅ |
| `pnpm build` ビルド成功(tsc + vite) | ✅ |
| browser-storage.ts 新設 | ✅ |
| constants/combo-list.ts 新設 | ✅ |
| ComboFilterBar → ComboListFilters 置換 | ✅ |
| 進捗ログ更新 | ✅ |

### 新設ファイル

| ファイル | 用途 |
|---------|------|
| `web/src/lib/browser-storage.ts` | 共通 localStorage ヘルパ。M6/M7 で再利用する共有資産 |
| `web/src/lib/browser-storage.test.ts` | ユニットテスト(8件) |
| `web/src/constants/combo-list.ts` | ソート種別・状況コード値・表示列定義 |
| `web/src/features/combo/hooks/useColumnVisibility.ts` | 表示列カスタマイズフック(localStorage 永続化) |
| `web/src/features/combo/hooks/useComboListFilters.ts` | フィルタ・ソート状態管理フック(URL パラメータ連動) |
| `web/src/features/combo/components/ColumnVisibilityMenu.tsx` | 表示列カスタマイズ UI |
| `web/src/features/combo/components/ColumnVisibilityMenu.test.tsx` | コンポーネントテスト(3件) |
| `web/src/features/combo/components/ComboListFilters.tsx` | フィルタ・ソート統合 UI(ComboFilterBar 置換) |
| `web/src/features/combo/components/ComboListFilters.test.tsx` | コンポーネントテスト(7件) |

### 修正ファイル

- `internal/model/combo.go`: Position 定数追加(5値)
- `internal/repository/combo/repository.go`: ListFilter 拡張(TagIDs/Position/HitType/OpponentStance)、ソートホワイトリスト化
- `internal/api/combo/handler.go`: tag_ids/position/hit_type/opponent_stance クエリパラメータ解析追加
- `internal/api/combo/handler_test.go`: 新規テスト4件追加
- `internal/service/combo/service_test.go`: 新規テスト5件追加
- `web/src/features/combo/api.ts`: ComboListFilter に tagIds/position/hitType/opponentStance 追加
- `web/src/features/combo/components/ComboTable.tsx`: visibility props 対応
- `web/src/features/combo/components/ComboTableRow.tsx`: 条件描画(visibility)
- `web/src/pages/ComboListPage.tsx`: useComboListFilters/useColumnVisibility 統合
- `web/src/locales/ja.json` / `en.json`: フィルタ・ソート・表示列関連 i18n キー追加

### 指示書との乖離(開発者確認済み)

1. **Position 値**: 指示書の `any/center/corner` → 既存コードベースの5値(`mid_screen` 等)を採用
2. **OpponentStance 値**: 指示書の `jumping` → 既存の `airborne` を採用
3. **ソートカラム名**: API パラメータ名は実カラム名 `drive_gauge_consumed_total` / `sa_gauge_consumed_total` を使用

### 共通ヘルパ `browser-storage.ts` について

CLAUDE.md §10.X で許容された3用途のうちの1つ(表示列カスタマイズ)で利用開始。キー名 `combo-list-columns-v1`。後続マイルストーンでの再利用予定:
- M6: `combo-draft-<id>-v1`(下書き自動保存)
- M7: `virtual-controller-layout-v1`(仮想コントローラ選択保持)

---

## M3-04: マイコンボ画面 + useCharacters フック化(2026-05-12 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm exec vitest run` 全通過（190 テスト） | ✅ |
| `pnpm exec tsc --noEmit` 型エラーなし | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| `grep -rn 'CHARACTER_NAMES' web/src/` → 0件 | ✅ |
| `curl /api/games/1/characters` → items 配列返却 | ✅ |
| 進捗ログ更新 | ✅ |

### スコープ拡張: バックエンド Character API 新規実装

Character API (`GET /api/games/{id}/characters`) が未実装であることが判明。
Plan Mode で開発者に確認の上、DES-002 §4.2 で定義されたエンドポイントを本マイルストーン内で3層パターン（handler→service→repo）で新規実装した。
（開発者からスコープ拡張の指示を受領済み。設計書に定義済みの API のため CHANGE 通知書は不要と判断。）

### 実装内容

#### バックエンド（Character API + MyComboStatus 定数）

- `internal/repository/character/repository.go`: ListByGame メソッド（SQL 直結）
- `internal/service/character/service.go`: 薄い pass-through + gameID バリデーション
- `internal/service/character/service_test.go`: 正常/不正 gameID テスト
- `internal/api/character/handler.go`: List ハンドラ（`{"items": [...]}` ラッパー形式）
- `internal/api/character/routes.go`: `GET /games/:gameId/characters` ルート登録
- `internal/api/character/handler_test.go`: dbtest.Setup 使用の統合テスト
- `internal/api/character/doc.go`: パッケージドキュメント
- `cmd/combomgr/main.go`: DI 配線 + ルート登録追加
- `internal/model/tag.go`: MyComboStatus 定数（in_use/practicing/reduced）+ タグ名マップ追加

#### フロントエンド（useCharacters + マイコンボ画面）

- `web/src/constants/mycombo.ts`: MyComboStatus 列挙定数（バックエンド同期）
- `web/src/features/character/api/characterApi.ts`: Character API クライアント
- `web/src/features/character/hooks/useCharacters.ts`: useCharacters + useCharacterName フック
- `web/src/features/character/hooks/useCharacters.test.ts`: フックテスト（7件）
- `web/src/features/combo/components/DuplicateRealtimeWarning.tsx`: CHARACTER_NAMES → useCharacterName 差し替え
- `web/src/features/mycombo/hooks/useMyComboStatusCounts.ts`: ステータス別件数集計フック
- `web/src/features/mycombo/hooks/useMyComboStatusCounts.test.ts`: テスト（4件）
- `web/src/features/mycombo/components/CharacterInfoBar.tsx`: キャラ情報バー（件数ダッシュボード付き）
- `web/src/features/mycombo/components/CharacterInfoBar.test.tsx`: テスト（4件）
- `web/src/features/mycombo/components/MyComboStatusTabs.tsx`: 3タブ（使用中/練習中/頻度低下）+ カウントバッジ
- `web/src/features/mycombo/components/MyComboStatusTabs.test.tsx`: テスト（3件）
- `web/src/features/mycombo/components/CharacterSelector.tsx`: キャラ切替プルダウン基盤（1キャラ時は disabled）
- `web/src/features/mycombo/components/CharacterSelector.test.tsx`: テスト（3件）
- `web/src/features/mycombo/components/MyComboPage.tsx`: マイコンボメインページ
- `web/src/features/mycombo/components/MyComboPage.test.tsx`: テスト（4件）
- `web/src/pages/MyComboPageRoute.tsx`: ページルートラッパ
- `web/src/router.tsx`: `/mycombo` ルート追加
- `web/src/pages/ComboListPage.tsx`: マイコンボナビリンク追加
- `web/src/pages/TrashPage.tsx`: マイコンボナビリンク追加
- `web/src/pages/TagManagementPageRoute.tsx`: マイコンボナビリンク追加
- `web/src/locales/ja.json` / `en.json`: myCombo セクション i18n キー追加

### 設計判断

1. **ComboListFilters 非再利用**: ソート・フィルタが一体のため MyComboPage 用にシンプルなソート+列カスタマイズ UI を自作
2. **URL クエリ管理**: `useComboListFilters` は status パラメータを上書きするため、MyComboPage では独自の `useSearchParams` で管理
3. **タグ ID ルックアップ**: status → MYCOMBO_STATUS_TAG_NAMES → タグ名照合 → tag.id → useCombos({ tagIds }) のフロー
4. **buildDuplicateLabel 引数追加**: 非コンポーネント関数のため hook 呼び出し不可 → `characterName: string` 引数を追加して外出し

---

## M3-05: コンボ一覧仕上げ + エラーレスポンス共通化(2026-05-15 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm exec vitest run` 全通過（203 テスト） | ✅ |
| `pnpm exec tsc -b`（型エラーなし） | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| 進捗ログ更新 | ✅ |

### CHANGE-010 取り込み: エラーレスポンス共通化

#### 変更内容

`internal/model/api_error.go` に共通型 `APIError` / `APIErrorResponse` を新設し、5 ハンドラの独自エラー型をすべて置き換えた。

| ハンドラ | 削除した独自型 | 置き換え先 |
|---------|------------|----------|
| tag | `tagErrorDetail` / `tagErrorBody` / `tagErrorResponse` | `model.APIErrorResponse` |
| character | `charErrorBody` / `charErrorResponse` | `model.APIErrorResponse` |
| combo | `ErrorResponse`（dto.go） | `model.APIErrorResponse` |
| preset | `map[string]string` | `model.APIErrorResponse` |
| move | `map[string]string` | `model.APIErrorResponse` |

#### 後方非互換変更の周知（combo ハンドラ）

**combo ハンドラのみ**、エラーレスポンスの JSON 構造が変更された:

- **旧形式（フラット）**: `{"error": "not_found", "message": "..."}`
- **新形式（ネスト）**: `{"error": {"code": "not_found", "message": "..."}}`

tag / character / preset / move ハンドラは元から `{"error": {"code": "...", "message": "..."}}` ネスト形式だったため影響なし。

フロントエンド側は以下を対応済み:
- `ComboErrorResponse` 型をネスト形式に更新（`web/src/features/combo/types.ts`）
- `ApiError` クラスの `validations` getter と `requestJSON` のエラーパース修正（`web/src/features/combo/api.ts`）
- `useRestoreCombo` / `usePermanentDelete` のエラーパース修正、テストモックも新形式に更新

#### Validations の Details 格納

バリデーションエラー（Create / UpdateWithKeyChange）は以下の形式で返す:
```json
{
  "error": {
    "code": "validation_failed",
    "message": "バリデーションエラーがあります",
    "details": { "validations": { "issues": [...] } }
  }
}
```

### M1-05 暫定処理の解消

#### 1. defaultRecipe（暫定処理1・レシピ列が "-" 固定だった問題）

- サービス層 `List()` が `recipe_cache` JSON からプリセット ID=1 のレシピ文字列を抽出して `combo.DefaultRecipe` にセット
- `ComboResponse.DefaultRecipe string json:"defaultRecipe"` を追加
- `ComboTableRow.tsx` の `recipePreview = "-"` を `combo.defaultRecipe || "-"` に置き換え

#### 2. starterMoveCode（暫定処理3・始動技が ID 表示だった問題）

- リポジトリ層 `List()` が `findMoveCodesByIDs()` バッチクエリで始動技コードを取得し注入
- `ComboResponse.StarterMoveCode string json:"starterMoveCode"` を追加
- `formatStarterStatus()` が `starterMoveCode` を優先表示するよう更新

### M3-03 持ち越し課題の解消: 空状態メッセージ改善

- `useComboListFilters` に `hasActiveFilters` / `clearFilters` を追加
- `ComboTable` がフィルタ適用中の空状態で「フィルタ条件にマッチするコンボがありません」+「フィルタを解除」ボタンを表示
- `MyComboPage` の空状態に「この状態のコンボはありません」メッセージを追加

### M2-04 持ち越し課題（RecipeBuilder console.warn テスト）の扱い

M2-04 の実際の実装は `console.warn` ではなく視覚的 UI 警告（赤ボーダー + 文字数メッセージ）で実装されている。既存テスト4件（notes 入力欄の存在、50文字以下で警告クラスなし、51文字以上で border-red 付与、文字数メッセージ表示）がこの実装を網羅しているため、追加テストなしで完了とした。

**ただし P-01 として既知課題を残す**: 指示書 M3-05 §4.4 は `console.warn` の追加とテスト3ケースの追加を要求しており、実装との乖離がある。後続マイルストーンで `RecipeBuilder.tsx` に `console.warn` を追加し、`vi.spyOn(console, 'warn')` による3テストケースを追加する必要がある。

### 設計判断

1. **defaultRecipe の取得方式**: `recipe_cache` 活用方式（追加クエリ不要、サービス層で JSON パース）を採用。指示書の「案Y（steps バッチロード）」より低コスト。開発者確認済み。
2. **Validations の格納先**: `APIError.Details` に `map[string]any{"validations": result}` として格納。開発者確認済み。
3. **5 ハンドラ全て統一**: 指示書の3ハンドラ（tag/character/combo）に加え、preset / move も同一方針で統一。開発者確認済み。

### M3 全体サマリ（M3-01 〜 M3-05）

| マイルストーン | 内容 | 完了日 |
|--------------|------|-------|
| M3-01 | タグ機能 + タグ管理 UI | 2026-05-10 |
| M3-02 | コンボ-タグ紐付け | 2026-05-11 |
| M3-03 | コンボ一覧フィルタ拡張 + 列表示カスタマイズ | 2026-05-11 |
| M3-04 | マイコンボ画面 + useCharacters フック化 | 2026-05-12 |
| M3-05 | コンボ一覧仕上げ + エラーレスポンス共通化（CHANGE-010） | 2026-05-15 |

M3（マイコンボ系）のすべてのマイルストーンが完了。次は M4（セットプレイ系）に着手。

---

## M4-00: RecipeBuilder console.warn 実装 + テスト3ケース追加(2026-05-16 完了)

### 背景

m3-to-m4-handover §4.1 持ち越し課題 P-01 の清算。M3-05 指示書 §4.4 の前提（「M2-04 で RecipeBuilder に console.warn 実装済み」）が誤りだったため、M3-05 では取り込まずに持ち越した課題を本マイルストーンで解消。retrospective-log §1 パターン A（既存実装の確認漏れ）の事例として記録継続。

### §3.4 着手前確認結果

| 確認項目 | 期待 | 実態 | 判定 |
|---------|------|------|------|
| §3.4.1 RecipeBuilder.tsx の console.warn | 検出ゼロ | 検出ゼロ | ✅ |
| §3.4.2 ModifiersEditor.tsx の console.warn | 1〜2件検出 | 検出ゼロ（未実装） | ⚠️ 参考実装なしで指示書 §4.1.2 のパターンを直接使用 |
| §3.4.3 既存テストケース数 | 4件 | 4件存在 | ✅ |
| §3.4.4 console.warn スパイ方式 | vi.spyOn 方式 | console 系スパイなし（新規導入） | ✅ |
| §3.4.5 draftNotes の型 | string / useState | `useState<string>("")` + `NOTES_MAX_LENGTH = 50` | ✅ |

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `pnpm test` 全通過（209 テスト: 既存 202 + 新規 3 + RecipeBuilder 既存 4） | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| TypeScript 型エラーなし | ✅ |
| RecipeBuilder.tsx に useEffect + console.warn 追加 | ✅ |
| RecipeBuilder.test.tsx に3ケース追加（新規 describe ブロック） | ✅ |
| 既存4ケース回帰なし | ✅ |
| 進捗ログ更新 | ✅ |

### 実装内容

- `web/src/features/combo/components/RecipeBuilder.tsx`: `useEffect` import 追加、`draftNotes.length > 50` 時に `console.warn("draftNotes が 50 文字を超えています: N 文字")` を発火する `useEffect` を追加（依存配列 `[draftNotes]`）
- `web/src/features/combo/components/RecipeBuilder.test.tsx`: `describe("RecipeBuilder draftNotes 50文字超 console.warn 警告", ...)` ブロックに3ケースを追加（50文字以下未発火 / 51文字以上1回発火＋文言確認 / 超過→減少時の過剰発火なし）

### P-01 解消確認

handover §4.1 持ち越し課題 P-01「RecipeBuilder console.warn 未実装」を本マイルストーンで清算。残る持ち越し課題: L-01（M4-04）、L-02 / L-03（M5 以降または M7）。

### 動作確認手順（開発者向け E2E シナリオ A）

1. `cd web && pnpm dev` で開発サーバーを起動
2. ブラウザでコンボ登録画面（`/combos/new`）を開く
3. ブラウザの開発者ツール（F12）→ Console タブを開く
4. レシピステップの「ステップメモ(任意)」入力欄に 51 文字以上を入力
5. 期待: Console に「draftNotes が 50 文字を超えています: 51 文字」のような警告が表示される
6. 入力を 50 文字以下に減らす → 追加の警告が表示されないことを確認
7. 視覚的 UI 警告（赤ボーダー + 文字数メッセージ）が引き続き正しく表示されることを確認

---

## M4-00b: ModifiersEditor console.warn 実装 + テスト3ケース追加(2026-05-16 完了)

### 背景

M4-00 §3.4.2 着手前確認で発見された「隠れ P-01 相当」課題の清算。M2-04 設計担当が ModifiersEditor / RecipeBuilder 両側に console.warn を実装したつもりで、実際には視覚的 UI 警告のみだった M2-04 設計担当ミスの双子事例（retrospective-log §1 パターン A）。

### §3.4 着手前確認結果

| 確認項目 | 期待 | 実態 | 判定 |
|---------|------|------|------|
| §3.4.1 ModifiersEditor.tsx の console.warn | 検出ゼロ | 検出ゼロ | ✅ |
| §3.4.2 警告対象フィールド特定 | notes 系フィールド | `localNotes`（`useState<string>(step.modifiers?.notes ?? "")`）+ `NOTES_MAX_LENGTH = 50` 定数使用済み | ✅ 単一フィールドのみ・確認不要 |
| §3.4.3 既存テストケース数 | M2-04 実装分 | 7ケース（`describe("ModifiersEditor", ...)`）、156行 | ✅ |
| §3.4.4 console.warn スパイ方式 | M4-00 と同パターン | ModifiersEditor.test.tsx には spy なし（新規導入） | ✅ |

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `pnpm test` 全通過（212 テスト: 既存 209 + 新規 3） | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| TypeScript 型エラーなし | ✅ |
| ModifiersEditor.tsx に useEffect + console.warn 追加 | ✅ |
| ModifiersEditor.test.tsx に3ケース追加（新規 describe ブロック） | ✅ |
| 既存7ケース回帰なし | ✅ |
| RecipeBuilder 側（M4-00）の7ケース回帰なし | ✅ |
| 進捗ログ更新 | ✅ |

### 実装内容

- `web/src/features/combo/components/ModifiersEditor.tsx`: `useEffect` import 追加、`localNotes.length > NOTES_MAX_LENGTH` 時に `console.warn("localNotes が 50 文字を超えています: N 文字")` を発火する `useEffect` を追加（依存配列 `[localNotes]`、`NOTES_MAX_LENGTH` 定数を再利用）
- `web/src/features/combo/components/ModifiersEditor.test.tsx`: `describe("ModifiersEditor localNotes 50文字超 console.warn 警告", ...)` ブロックに3ケースを追加（50文字以下未発火 / 51文字以上1回発火＋文言確認 / 超過→減少時の過剰発火なし）

### 隠れ P-01 相当の清算確認

M4-00 §3.4.2 発見の「ModifiersEditor 側 console.warn 未実装」を本マイルストーンで清算。RecipeBuilder（M4-00）と ModifiersEditor（M4-00b）の両側で console.warn パターンが揃い、将来課題 §8.3「警告ヘルパフック統一」の前提条件が整った。

### 動作確認手順（開発者向け E2E シナリオ A）

1. `cd web && pnpm dev` で開発サーバーを起動
2. ブラウザでコンボ登録画面（`/combos/new`）を開く
3. ブラウザの開発者ツール（F12）→ Console タブを開く
4. レシピステップを1件追加し、ステップ行の編集ボタンで ModifiersEditor（修飾子編集ダイアログ）を開く
5. 「メモ」テキストエリアに 51 文字以上を入力
6. 期待: Console に「localNotes が 50 文字を超えています: 51 文字」のような警告が表示される
7. メモを 50 文字以下に減らす → 追加の警告が表示されないことを確認
8. 視覚的 UI 警告（赤ボーダー）が引き続き正しく表示されることを確認
9. RecipeBuilder 側（draftNotes）も独立して動作することを確認（片方の発火が他方に影響しない）

---

## M4-01: セットプレイ ドメイン バックエンド基盤(2026-05-16 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go build ./...` ビルド成功 | ✅ |
| `go vet ./...` エラーなし | ✅ |
| `go test ./...` 全通過（既存 + 新規回帰なし） | ✅ |
| E2E シナリオ A〜F 全通過 | ✅ |

### §3.4 着手前確認結果

| 確認項目 | 結果 |
|---------|------|
| §3.4.1 Setup 系テーブル DDL | ✅ `migrations/000001_init_schema.up.sql` で setups(L165-176)、setup_steps(L181-188)、combo_setups(L193-197) 確認。CASCADE は物理削除のみ発火 → 案 P1 採用 |
| §3.4.2 Notation サービス層 | ✅ Service interface + `service` struct、cache.go の Recompute/Delete 系関数を確認。セットプレイ拡張が必要 |
| §3.4.3 既存 combo ハンドラの DTO 構造 | ✅ `CreateRequest` の TagIDs 後に Setups フィールド予約位置を確認 |
| §3.4.4 共通エラー型 | ✅ `model.APIError` / `model.APIErrorResponse` / `ValidationResult` 確認 |
| §3.4.5 トランザクション扱い | ✅ `s.db.BeginTx` + `defer rollback` + repo に `*sql.Tx` パターン確認。`sqlRunner` interface 確認 |
| §3.4.6 SUPP-001 §7.1/§7.2/§7.5 | ✅ 案 X 採用、トランザクション境界、プリセット連動、削除時挙動を確認 |

### 実装内容

#### 新規作成ファイル
- `internal/repository/setup/repository.go` — setup CRUD リポジトリ（20+ メソッド）
- `internal/service/setup/validate.go` — VAL-S01〜S05 バリデーション
- `internal/service/setup/service.go` — setup サービス層（7 メソッド）
- `internal/service/setup/duplicate_keys.go` — `CalcSetupRecipeHash`（SHA-256）
- `internal/api/setup/handler.go` — 7 エンドポイントのハンドラ
- `internal/api/setup/dto.go` — リクエスト/レスポンス DTO + 変換ヘルパ
- `internal/api/setup/routes.go` — `RegisterRoutes`
- `internal/service/notation/setup_resolver.go` — `ResolveSetupRecipe` / `RecomputeSetupCache` / `DeleteSetupCache` / `ComputeSingleSetupCache`

#### テストファイル
- `internal/repository/setup/repository_test.go` — FindDuplicateInCombo（VAL-S04 SQL 正確性）、FindByID + steps
- `internal/service/setup/validate_test.go` — VAL-S01〜S05 全件カバー
- `internal/service/setup/service_test.go` — CRUD 正常系 + 全 VAL 異常系 + リンク + version conflict + 論理削除
- `internal/service/notation/setup_resolver_test.go` — cache hit/miss、RecomputeSetupCache、DeleteSetupCache、RecomputePresetCache 拡張、DeletePresetCache 拡張
- `internal/api/setup/handler_test.go` — 全エンドポイント正常系 + 異常系 + camelCase JSON 確認

#### 修正ファイル
- `internal/service/notation/service.go` — Service interface に 4 メソッド追加、constructor に setupRepo 引数追加
- `internal/service/notation/cache.go` — `RecomputePresetCache` / `DeletePresetCache` にセットプレイループ追加
- `internal/api/combo/dto.go` — `CreateRequest` に `Setups json.RawMessage` フィールド予約
- `internal/api/combo/handler.go` — `len(req.Setups) > 0` 時の `slog.Warn` 追加
- `cmd/combomgr/main.go` — setup DI 配線 + `notation.New` 引数追加

### 設計判断

| 項目 | 採用方針 |
|------|---------|
| combo_setups 論理削除時 | 案 P1: サービス層で明示的 DELETE（CASCADE は物理削除のみ発火） |
| recipe_cache 配置 | 案 R2: `setups.recipe_cache` カラム（JSON map） |
| combo CreateRequest.Setups | `json.RawMessage` で予約（循環 import 回避、M4-04 で本実装） |
| CreateSetup 時のコンボ存在確認 | E2E テスト中に発見、service 層に `ComboExists` チェック追加 |

### E2E シナリオ結果

- **A** (CRUD ライフサイクル): setup 作成 → recipe_cache 生成 → metadata 更新 → recipe 変更 → cache 更新 → 論理削除 → 404 確認 ✅
- **B** (VAL-S05): `comboId=0` → 400 `invalid_combo_id`、`comboId=99999` → 404 `not_found` ✅
- **C** (VAL-S04): 同一コンボに同一レシピ → 400 `validation_failed` (VAL-S04) ✅
- **D** (リンク操作): setup-links create → 複数紐付き確認 → delete → 元に戻る → 冪等 → 404 ✅
- **E** (notation 連動): recipe_cache 自動生成 → recipe 変更で cache 更新 ✅
- **F** (M3 回帰): combo 作成（setups なし → 正常、setups あり → slog.Warn + 正常処理） ✅

---

## M4-02: セットプレイ単体 UI + コンボ詳細展開 + 紐付け操作 UI(2026-05-17 完了)

### 実施内容

#### バックエンド M4-01 補修 2 件

**補修 A: `GET /api/setups` エンドポイント追加**
- `internal/repository/setup/repository.go`: `ListByCharacterID`、`ListSetupsByComboID` メソッド追加
- `internal/service/setup/service.go`: `ListSetups(ctx, characterID *int64)`、`ListSetupsByComboID(ctx, comboID int64)` 追加
- `internal/api/setup/handler.go`: `SetupListResponse` 型定義 + `ListSetups` ハンドラ追加
- `internal/api/setup/routes.go`: `GET /setups` ルート追加

**補修 B: `ComboDetail` に `setups` フィールド追加**
- `internal/api/combo/dto.go`: `SetupSummary` 構造体 + `ComboResponse.Setups []SetupSummary` フィールド追加
- `internal/api/combo/handler.go`: `Handler.setupSvc` フィールド追加、`Get` ハンドラでセットプレイ埋め込み
- `cmd/combomgr/main.go`: `comboHandler` の初期化順序を `setupService` の後に移動

#### フロントエンド setup フィーチャ新設

**新規作成ファイル(20 ファイル)**

- `web/src/features/setup/types.ts`: `Setup`, `SetupStep`, `SetupResponse`, `SetupSummary`, `SetupStepInput`, `CreateSetupInput`, `UpdateSetupInput`, `SetupListResponse`
- `web/src/features/setup/api/setupApi.ts` + `.test.ts`: fetchJSON ベース API クライアント 7 関数
- `web/src/features/setup/hooks/useSetup.ts` + `.test.ts`: 単一取得フック
- `web/src/features/setup/hooks/useCreateSetup.ts`: 新規作成 mutation
- `web/src/features/setup/hooks/useUpdateSetup.ts`: 更新 mutation(楽観的排他)
- `web/src/features/setup/hooks/useDeleteSetup.ts`: 論理削除 mutation
- `web/src/features/setup/hooks/useSetupLinks.ts` + `.test.ts`: 紐付け追加・解除 mutation
- `web/src/features/setup/hooks/useCharacterSetups.ts` + `.test.ts`: キャラ別 setup 候補フック
- `web/src/features/setup/components/SetupBasicInfoForm.tsx` + `.test.tsx`: 基本情報フォーム
- `web/src/features/setup/components/SetupRecipeEditor.tsx` + `.test.tsx`: レシピ入力(VirtualController + ModifiersEditor 再利用)
- `web/src/features/setup/components/SetupAccordionItem.tsx` + `.test.tsx`: コンボ詳細アコーディオン行
- `web/src/features/setup/components/LinkExistingSetupModal.tsx` + `.test.tsx`: 既存紐付けモーダル
- `web/src/pages/SetupEditorPage.tsx` + `.test.tsx`: セットプレイ登録・編集画面

**修正ファイル(4 ファイル)**

- `web/src/features/combo/types.ts`: `import type { SetupSummary }` 追加、`ComboDetail.setups?: SetupSummary[]` フィールド追加
- `web/src/pages/ComboDetailPage.tsx`: セットプレイ展開セクション(DES-005 §5.6 item 8)実装、紐付けモーダル追加
- `web/src/pages/ComboEditorPage.tsx`: 「既存セットプレイから紐付け」ボタン追加(編集モード時のみ表示)
- `web/src/router.tsx`: `/combos/:comboId/setups/new` と `/setups/:setupId` ルート追加

### 設計判断

| 項目 | 採用方針 |
|------|---------|
| useCharacterSetups API | 案 A1: M4-01 補修で `GET /api/setups?characterId=X` を追加 |
| ComboDetail.setups 取得 | 案 B1: M4-01 補修で ComboResponse に setups フィールド埋め込み |
| SetupSummary 型の配置 | `setup/types.ts` に定義し `combo/types.ts` が `import type` で参照(type-only で循環無害) |
| SetupEditorPage テストの OOM 対策 | `useEffect([setupQ.data])` の依存が毎レンダーで新オブジェクト参照になり無限ループ → モックで安定参照を返すよう修正(module スコープ const) |
| FR011 候補セクション | 本マイルストーンでは非表示(コードコメントで M4-03 で実装予定を明記) |

### テスト結果

- `go test ./...`: 全パッケージ通過
- `pnpm test -- --run`: 43 ファイル 249 テスト全通過
- `pnpm build`: 成功(438.67 kB JS / 22.02 kB CSS)

---

## M4-02 完了後対応: レビュー指摘取り込み + E2E 不具合修正(2026-05-17)

M4-02 本体完了後、機械レビュー 2 回と開発者 E2E テストを経て以下を実施。

### 第1回レビュー指摘の取り込み

`docs/progress/m4-02-review.md`(第1回)の指摘を反映。

- バックエンド:
  - `GET /api/setups` の `characterId` 必須バリデーション追加(未指定・非数値で 400 `invalid_query_parameter`)
  - `internal/api/combo/dto.go` の `Setups` フィールドから `omitempty` 除去(0 件時も `"setups":[]` を返す)
  - handler / service / repository / combo handler にテスト追加
- フロントエンド:
  - `SetupSummary` を `extends Omit<Setup, "createdAt" | "updatedAt">` に修正(Go の軽量型と整合)
  - `useCombo` の queryKey を number に正規化(`parseInt`)— string/number 不一致でキャッシュ無効化が空振りする問題を解消
  - `SetupBasicInfoForm` から未使用の `mode` prop を削除
  - mutation フックテスト 3 ファイル追加

### SetupAccordionItem UX 修正(指示書 v1.0.3 §4.7)

E2E 指摘を受け設計担当と協議。DES-005 §5.6 アクション(セットプレイ行クリック=編集画面遷移)に実装を整合。

- 行ヘッダークリック = `/setups/:setupId` へ遷移、展開アイコン(▶/▼)= 開閉トグル、`stopPropagation` で領域分離
- `編集` ボタンを廃止(行クリックが編集遷移の直接表現のため)、`onEdit` prop は遷移上書き用に存置
- 紐付け解除ボタンに `stopPropagation` 追加

### 第2回レビュー

`docs/progress/m4-02-review.md`(第2回、v1.0.3 基準)で **完了承認**。取り込み修正なし。`SetupRecipeEditor.tsx` の `as any` キャストは低優先度(M5 リファクタ候補)として見送り。

### E2E 不具合修正 2 件

開発者 E2E 再テストで判明した実装バグ 2 件を修正。

- **Issue D(紐付け解除後に画面が再描画されない)**: 共通ヘルパ `fetchJSON`(`web/src/lib/api-client.ts`)が末尾で必ず `res.json()` を呼ぶため、204 No Content を返す DELETE 系エンドポイントで `SyntaxError` を throw → ミューテーションが `onError` に落ち、キャッシュ無効化・`refetch` が発火しなかった。`fetchJSON` に「204 のとき `undefined` を返す」処理を追加して根本修正。`setupApi.remove`(`DELETE /api/setups/:id`、204)の同種潜在バグも同時解消。
- **技名表示(セットプレイのステップが技コードで表示される)**: `SetupRecipeEditor.tsx` が存在しないフィールド `move.name` を参照していた(正しくは `move.nameJa`)。`nameJa` 参照に修正。あわせて `movesById` の型を `Move` に正し、不要になった `movesById as any` キャストを除去。コンボ側 `StepRow` は元から `nameJa` を使用しており影響なし。

### 課題・TODO(M5 以降)

- `SetupRecipeEditor.tsx` の `step ... as any` キャスト 1 箇所 — `SetupStepInput` と `ModifiersEditor` 期待型(`InternalStep`)の乖離。型を正式対応させて解消(M5 リファクタ候補)。`movesById as any` は技名修正に伴い解消済み。
- `useDeleteCombo` / `usePermanentDelete` の raw fetch 個別実装は、`fetchJSON` の 204 対応により `fetchJSON<void>` へ統一可能(任意リファクタ)。
- API クライアント層テストの注意点: `setupApi.test.ts` は `fetchJSON` をフルモックしていたため Issue D(204 非対応)を検出できなかった。void/DELETE 系はヘルパの実挙動を含むテストが望ましい。

### 最終テスト結果(完了後対応を含む)

- `go test ./...`: 全パッケージ通過
- `pnpm exec vitest run`: 46 ファイル 256 テスト全通過
- `pnpm build`: 成功

---

## M4-03: FR011 転用候補 API + knockdown_advantage 確認モーダル

### 実装内容

1. **FR011 候補抽出 API 本実装**: `GET /api/combos/{id}/setup-candidates` — 同一キャラ + 同一 knockdown_advantage の他コンボに紐付く setup を候補として返す。リポジトリ層で JOIN クエリ、サービス層で `FindComboIDsBySetupIDs` 一括取得(N+1 回避)。`SetupCandidateSummary` 軽量型(createdAt/updatedAt/steps 除外)を導入。
2. **コンボ更新 API に `setupCarryOptions` パラメータ追加**: PATCH(`UpdateMetadata`)・PUT(`UpdateWithKeyChange`)両方で `carry_all` / `unlink_all` / `individual` の 3 モードをサポート。combo_setups 操作メソッド 3 件(`DeleteComboSetupsByComboID` / `Excluding` / `Count`)を combo リポジトリに追加。
3. **knockdown_advantage 変更確認モーダル**: `KnockdownAdvantageChangeModal` コンポーネント新設。`ComboEditor` で KA 変更検知 → モーダル → `proceedSave(options)` の流れ。(a)(b) 両保存方式で発火。
4. **候補表示 UI**: `useSetupCandidates` フック + `SetupCandidateList` コンポーネント新設。`ComboDetailPage` に候補セクション追加(0 件時は非表示)。

### 機械レビュー(第 1 回)

`docs/progress/m4-03-review.md` — 重大問題 5 件 + 軽微問題 3 件を検出。完了承認保留。

### レビュー指摘修正

| 問題 | 修正内容 |
|------|---------|
| B: `invalid_setup_carry_mode` が 500 返却 | `ErrInvalidSetupCarryMode` sentinel error を追加し、ハンドラで 400 返却に修正 |
| B: `missing_setup_carry_options` 未実装 | KA 変更 + setups ≥ 1 + carryOptions nil → `ErrMissingSetupCarryOptions` バリデーション追加(PATCH/PUT 両方) |
| C: `GetSetupCandidates` エラーコード不正 | `"invalid_param"` → `"invalid_combo_id"` に修正 |
| D: バックエンドテスト大幅不足 | setup service(6 件)、setup repo(5 件)、combo service(11 件)、combo repo(3 件)テスト追加 |
| A: フロントエンドテスト 5 件未作成 | `useSetupCandidates.test.ts`、`SetupCandidateList.test.tsx`、`KnockdownAdvantageChangeModal.test.tsx`、`ComboDetailPage.test.tsx`、`ComboEditorPage.test.tsx` 新設 |
| F: `comboReader.FindByID` エラー粗粒度 | `errors.Is(comborepo.ErrNotFound)` で分岐、他エラーは wrap して返却 |
| G: topMessage 未実装 | PATCH + KA 変更なし + linkedSetups ≥ 1 で「紐づくセットプレイ N 件を引き継ぎました」表示 |
| H: Props 型 `SetupSummary[]` vs `SetupResponse[]` | 見送り(機能的問題なし、Props 最小化観点から適切) |

### E2E シナリオ手順書

以下のシナリオを開発者がブラウザで実機確認すること。

**シナリオ A: 候補表示(正常系)**
1. KA=25 のコンボ A を作成、セットプレイを紐付け
2. 同キャラ・KA=25 のコンボ B を作成
3. コンボ B 詳細画面を開く → 候補セクションにコンボ A のセットプレイが表示
4. 「このコンボにも紐付ける」ボタンを押す → 紐付け成功、候補から消える

**シナリオ B: 候補表示(0 件)**
1. KA=NULL のコンボ詳細画面を開く → 候補セクション非表示

**シナリオ C: KA 変更 + carry_all (PATCH)**
1. KA=25 のコンボにセットプレイ 2 件を紐付け
2. 編集画面で KA を 30 に変更、保存 → モーダル表示
3. 「すべて引き継ぐ」選択 → 保存成功、セットプレイ 2 件が残っている

**シナリオ D: KA 変更 + unlink_all (PATCH)**
1. 同上の初期状態
2. KA を変更、「紐付けをすべて外す」選択 → セットプレイ 0 件

**シナリオ E: KA 変更 + individual (PATCH)**
1. 同上の初期状態
2. KA を変更、「個別に選択」→ 1 件のみチェック → セットプレイ 1 件のみ残る

**シナリオ F: KA 変更 + carry_all (PUT)**
1. キー変更(position 変更)+ KA 変更 + セットプレイ紐付きコンボ
2. 保存 → KA モーダル → 「すべて引き継ぐ」→ PUT 確認ダイアログ → 保存成功
3. 新コンボにセットプレイが転写されている

**シナリオ G: KA 未変更(PATCH)**
1. KA=25 のコンボにセットプレイ 2 件紐付き
2. KA 以外のメタデータを変更して保存 → モーダル非表示、即座に保存成功
3. topMessage に「紐づくセットプレイ 2 件を引き継ぎました」が表示

**シナリオ H: API 直接呼び出し(missing_setup_carry_options)**
1. `curl -X PATCH /api/combos/{id} -d '{"version":N,"knockdownAdvantage":30}'`（carryOptions なし、紐付き setup あり）
2. → 400 + `missing_setup_carry_options`

**シナリオ I: API 直接呼び出し(invalid_setup_carry_mode)**
1. `curl -X PATCH /api/combos/{id} -d '{"version":N,"knockdownAdvantage":30,"setupCarryOptions":{"mode":"bad"}}'`
2. → 400 + `invalid_setup_carry_mode`

### テスト結果

- `go test ./...`: 全パッケージ通過
- `pnpm exec vitest run`: 51 ファイル 280 テスト全通過
- `go build ./...` + `go vet ./...`: 成功
- `pnpm build`: 成功

---

## M4-04: コンボ + セットプレイ同時登録(2026-05-20 実装完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go build ./...` ビルド成功 | ✅ |
| `go vet ./...` 問題なし | ✅ |
| `go test ./...` 全通過 | ✅ |
| `pnpm exec tsc --noEmit` 型エラーなし | ✅ |
| `pnpm exec vitest run` 全通過(54 ファイル 297 テスト) | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| curl 動作確認(setups なし / あり / バリデーションエラー) | ✅ |

### 実装内容

#### バックエンド

1. **`internal/service/setup/service.go`** — `CreateSetupInTx` メソッド追加
   - 外部 tx を受け取り、ComboExists チェックをスキップ（同一 tx 内でコンボ作成直後のため）
   - バリデーション（VAL-S01〜S05）は通常通り実行
   - 既存 `CreateSetup` は変更なし

2. **`internal/service/combo/service.go`** — setupSvc 依存追加 + Create 拡張
   - `service` 構造体に `setupSvc` フィールド追加、`New()` 引数追加
   - `CreateInput` に `Setups []setupsvc.CreateSetupInput` フィールド追加
   - `Create()` 内でタグ処理後・コミット前に setup 一括作成
   - setup バリデーションエラー時: `setups[i].field` プレフィックス付き Issue にマージ → 明示的 `tx.Rollback()` → `(nil, result, nil)` 返却

3. **`internal/api/combo/dto.go`** — `Setups json.RawMessage` → `[]BundledSetupRequest` に変更
   - `BundledSetupRequest` / `BundledSetupStepRequest` DTO 新設
   - `toServiceCreateInput()` に Setups 変換ロジック追加

4. **`internal/api/combo/handler.go`** — Create ハンドラ修正
   - setups 警告ログ削除
   - 成功時に `ListSetupsByComboID` で setup サマリを取得してレスポンスに含める

5. **`cmd/combomgr/main.go`** — DI 順序変更（setupService → comboService）

#### フロントエンド

6. **`web/src/features/combo/types.ts`** — `CreateComboRequest` に `setups?: CreateSetupInput[]` 追加

7. **`web/src/features/combo/api.ts`** — `useCreateCombo` の onSuccess で setup 系 queryKey を追加 invalidate

8. **新規コンポーネント 3 件**:
   - `SetupSelectorModal.tsx` — 既存セットプレイ選択モーダル（API 呼び出しなし）
   - `SetupInputRow.tsx` — 新規セットプレイ入力行（名前・説明・SetupRecipeEditor）
   - `SetupRegistrationSection.tsx` — セクションコンテナ（追加/紐付けボタン + リスト管理）

9. **`ComboEditor.tsx`** — 統合
   - `setupsToCreate` / `linkedSetups` state 追加
   - `buildCreatePayload()` に `setups` フィールド追加
   - `runCreate()` で作成成功後に `linkedSetups` を `useCreateSetupLink` で順次紐付け
   - new / copy モードでのみ `SetupRegistrationSection` を表示

### 設計判断

| 項目 | 判断 | 根拠 |
|------|------|------|
| tx 対応 | `CreateSetupInTx` 新設、既存 `CreateSetup` 変更なし | 既存は自前 tx + ComboExists チェック、combo tx 内から呼べない |
| ComboExists スキップ | `CreateSetupInTx` ではスキップ | 同一 tx 内でコンボ作成直後、committed data を読む ComboExists では未コミットのコンボを検出不可 |
| VAL-S04 バッチ内重複 | v1 では未検出を許容 | FindDuplicateInCombo は committed data を読むため、同一 tx バッチ内の重複は検出不可 |
| LinkExistingSetupModal | 修正せず `SetupSelectorModal` 新設 | parentComboId 必須 + 内部で API 呼び出し |
| VirtualController | 各 SetupInputRow が SetupRecipeEditor を個別レンダリング | 共有 VC は RecipeBuilder の大幅変更が必要、M5+ で検討 |
| copy モード | 同時登録セクション表示、コピー元 setups は引き継がない | copy も POST でコンボ作成、セクションは空状態で表示 |

### curl 動作確認結果

```bash
# Test 1: setups なし（回帰確認）→ 成功、setups: [] で返却
# Test 2: setups 1件同時登録 → 成功、レスポンスに setup サマリ含む、parentComboIds に新コンボ ID
# Test 3: setup バリデーションエラー（steps 空）→ 400 + setups[0].steps / VAL-S02、コンボ未作成（ロールバック）
```

### テスト結果

- `go test ./...`: 全パッケージ通過
- `pnpm exec vitest run`: 54 ファイル 297 テスト全通過（新規 3 ファイル 17 テスト追加）
- `go build ./...` + `go vet ./...`: 成功
- `pnpm build`: 成功

---

## M4-04: レビュー指摘取り込み（2026-05-20）

### 対応概要

`docs/progress/m4-04-review.md` のレビュー指摘 8 件を評価し、5 件を取り込み、3 件を見送り。

### 取り込み済み

| # | 指摘 | 対応 |
|---|------|------|
| 1 | サービス層テスト欠落（重大） | `service_test.go` に 7 テスト追加（nil/empty/1件/複数/バリデーションエラー/2件目エラー/characterId 不一致） |
| 2 | ハンドラ層テスト欠落 | `handler_test.go` に 2 テスト追加（201 + setups / 400 バリデーションエラー） |
| 3 | SetupSelectorModal 新設の変更通知 | `docs/change-notes/change-report-014.md` 起票済み |
| 4 | useCreateCombo onSuccess の queryKey スコープ | 分析の結果変更不要と判断（`["setups"]` は prefix match で `["setups", { characterId }]` に正しくヒット。`["setups", characterId]` に狭めると構造不一致で invalidation が壊れる） |
| 5 | ComboEditor の M4-04 テスト | `ComboEditor.test.tsx` 新設、3 テスト（new/copy で表示、edit で非表示） |

### 取り込まなかった指摘と理由

| # | 指摘 | 理由 |
|---|------|------|
| 6 | BundledSetupRequest 型二重定義 | 低優先改善候補。combo/setup パッケージ間の DTO 分離は循環 import 回避に正当 |
| 7 | Props 最小化 | linkedSetups は SetupSummary 表示に必要、index は「セットプレイ N」ラベルに必要 |
| 8 | variables.setups → data.setups 判定 | Combo 型に setups フィールドがないため data.setups は型エラー。現状が正しい |

### テスト結果

- `go test ./...`: 全パッケージ通過
- `pnpm vitest run`: 55 ファイル 300 テスト全通過（+1 ファイル +3 テスト）
- `go build ./...` + `go vet ./...` + `pnpm tsc --noEmit`: 成功
- `pnpm build`: 成功

---

## M4-05: M4 統合 E2E + L-01 オプショナル型解消 + C-1 検証（2026-05-21 完了）

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `go build ./cmd/...` 成功 | ✅ |
| `go vet ./...` エラーなし | ✅ |
| `pnpm vitest run` 全通過（55 ファイル 301 テスト） | ✅ |
| `pnpm tsc --noEmit` 型エラーなし | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| CHANGE 通知書起票 | 不要（設計書本体への影響なし） |

### §3.3 着手前確認結果

#### §3.3.1 L-01 既存型定義の実態

- `ComboSummary.defaultRecipe?: string` / `starterMoveCode?: string`（オプショナル） — `types.ts` lines 64-65
- `Combo.defaultRecipe?: string` / `starterMoveCode?: string`（オプショナル） — `types.ts` lines 132-133
- バックエンド `ComboResponse` は `DefaultRecipe string` / `StarterMoveCode string`（非ポインタ = 必須、常に返却） — `dto.go` lines 153-154

#### §3.3.2 L-01 影響範囲

- 型定義修正: `web/src/features/combo/types.ts`（4箇所の `?` 削除）
- 使用箇所: `||`/`&&`/`if` パターンは必須型でも正常動作のためコード変更不要
- テストモック修正: 4ファイル（`utils.test.ts`、`TrashList.test.tsx`、`TrashListRow.test.tsx`、`PromoteToFinalButton.test.tsx`）

#### §3.3.3 C-1 implicitCarry 判定の実装確認

| 項目 | DES-005 §5.7 (b) 規定 | 実装での動作 | 整合性 |
|------|---------------------|------------|-------|
| メタデータのみ変更時の保存方式 | PATCH API で直接更新 | `hasKeyChanges()` = false → `runPatch()` | ○ |
| `combo_setups` 状態変化 | なし | バックエンド: `SetupCarryOptions == nil` → combo_setups 不変 | ○ |
| トースト通知 | 表示しない | **修正前**: `implicitCarry=true` → トースト表示（×）、**修正後**: `false` 固定 → トースト非表示（○） | ○（修正済み） |
| implicitCarry 判定 | (b) パスでは引き継ぎ不要 | **修正後**: PATCH パスは常に `false`、PUT パスのみ判定 | ○（修正済み） |

C-1 バグの経緯: M4-02 以前から `runPatch` に `implicitCarry` 判定が存在していたが、M4-03 以前はセットプレイ紐付きのコンボが少なく顕在化しなかった。M4-05 C-1 検証で DES-005 §5.7 (b) 規定との不整合として検出・修正（設計担当承認済み 2026-05-21）。

#### §3.3.4 設計書本体への影響なし確認

- L-01 型変更: フロント型定義のみ、設計書本体への影響なし
- C-1 修正: フロント UI ロジック修正のみ、設計書本体への影響なし
- CHANGE 通知書起票不要（playbook §16 規定の起票基準に該当しない）

#### §3.3.5 queryKey 規約の踏襲確認

- combo 系: flat tuple（`["combos", filter]`、`["combo", numId]`）
- setup 系: object（`["setups", { characterId }]`、`["setup", { id }]`）
- architecture-patterns.md v1.0.3 §1.1 と一致

### 変更ファイル一覧

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `web/src/features/combo/types.ts` | L-01: `defaultRecipe?` / `starterMoveCode?` → `defaultRecipe` / `starterMoveCode`（4箇所） |
| 2 | `web/src/features/combo/components/ComboEditor.tsx` | C-1: `runPatch` の `implicitCarry` 判定を削除、常に `false` を渡す |
| 3 | `web/src/features/combo/components/ComboEditor.test.tsx` | C-1: 回帰検出テスト追加 + L-01: 既存モックに必須フィールド追加 |
| 4 | `web/src/features/combo/utils.test.ts` | L-01: `ComboSummary` モックに `defaultRecipe`/`starterMoveCode` 追加 |
| 5 | `web/src/features/combo/components/TrashList.test.tsx` | L-01: 同上 |
| 6 | `web/src/features/combo/components/TrashListRow.test.tsx` | L-01: 同上 |
| 7 | `web/src/features/combo/components/PromoteToFinalButton.test.tsx` | L-01: `Combo` モックに `defaultRecipe`/`starterMoveCode` 追加 |

### M4 統合 E2E シナリオ手順書

以下のシナリオを開発者が実機で確認してください。

#### A. コンボ + セットプレイの新規同時登録（M4-04 機能）

1. キャラクター A を選択、コンボ新規登録画面を開く
2. コンボ本体（キャラ・始動技・状況・レシピ・ダメージ）を入力
3. 同時登録セクションが表示されることを確認
4. 「+ セットプレイを追加」で setup 入力行を 2 つ追加、各 setup 名・説明・レシピを入力
5. 「既存のセットプレイを紐付け」→ SetupSelectorModal で既存 setup B を選択
6. 保存 → コンボ + 新規 setup 2 件 + 既存 setup B 1 件の紐付けが完了
7. コンボ詳細画面に遷移、全 3 件の setup が表示されることを確認
- **期待**: 全 3 件の setup が紐付き済みで表示

#### B. FR011 転用支援（M4-03 機能）

1. コンボ X（KA = 35）に setup α が紐付き済み
2. コンボ Y（同キャラ、KA = 35）を新規作成
3. Y の詳細画面で「転用可能なセットプレイ」に setup α が候補表示
4. 「このコンボにも紐付ける」→ setup α が Y にも紐付く
5. 候補欄から setup α が消える（リロードしても消える）
6. Y の紐付き一覧に setup α が表示
- **期待**: 1 つの setup が複数コンボに紐付く

#### C. knockdown_advantage 変更時の確認モーダル（M4-03 機能）

1. コンボ X（KA = 35）に setup α / β / γ が紐付き済み
2. X を編集、KA を 35 → 40 に変更
3. 保存 → 確認モーダル表示（3 選択肢）
4. 「個別に選択」→ α は引き継ぎ、β / γ は紐付け解除
5. 保存実行 → α のみ X に紐付き
- **期待**: 個別選択が正確に動作

#### D. セットプレイ単体 UI + 編集（M4-02 機能）

1. setup 単体画面に新規作成エントリポイントがないことを確認（CHANGE-003）
2. コンボ詳細 or 同時登録セクションから setup を新規作成
3. setup 単体画面で編集 → 保存 → 反映
- **期待**: 新規作成は combo 側 UI のみ、編集は setup 単体画面

#### E. PATCH 保存方式（(b) 保存方式、C-1 検証）

1. コンボ X（KA = 35、setup 3 件紐付き済み、ダメージ = 3000）を編集
2. ダメージのみ 3000 → 3200 に変更（KA 不変）
3. 保存 → 確認モーダルは**表示されない**
4. PATCH API で更新される
5. **C-1 動的検証**:
   - `combo_setups` テーブルに変化なし（`curl /api/combos/{id}` で確認）
   - **トースト通知が表示されない**（DES-005 §5.7 (b) 準拠）
6. リロード後も状態維持
- **期待**: (b) 保存方式、combo_setups 不変、トースト通知なし

#### U-1. 「コンボとセットプレイをまとめて登録」（M4-04 + M4-02 横断）

1. キャラ A → コンボ新規登録 → コンボ本体入力
2. 同時登録セクションで setup α / β を入力 + 既存 setup γ を紐付け
3. 保存 → コンボ詳細で 3 件の setup 表示
4. setup α をクリック → 単体画面で編集可能 → 保存 → 反映
- **期待**: 同時登録から個別編集まで一連の流れが動作

#### U-2. 「FR011 で既存セットプレイを別コンボに転用」（M4-03 + M4-02 横断）

1. コンボ X（KA = 35）、setup α 紐付き済み
2. コンボ Y（同キャラ、KA = 35）を新規作成
3. Y の詳細 → 転用候補に setup α → 紐付け
4. setup α は X と Y の両方に紐付き
- **期待**: 1 setup 複数コンボ紐付きが正常動作

#### U-3. 「KA 変更時のセットプレイ引き継ぎフロー」（M4-03、C-1 検証含む）

1. コンボ X（KA = 35、setup α / β / γ 紐付き）を編集、KA → 40
2. 保存 → 確認モーダル → 「個別に選択」→ α のみ引き継ぎ
3. 保存実行 → α 紐付き、β / γ 解除
4. バックエンド API レスポンスで combo_setups の差分更新を確認
5. リロード後も状態維持
- **期待**: 確認モーダル個別選択が正確動作、DES-005 §5.7 (a) 規定通り

#### U-4. 「既存機能（M3-05 まで）の回帰確認」

1. キャラ選択 → コンボ新規登録 → 編集 → 詳細 → マイコンボ → 削除 の基本フロー
2. `defaultRecipe` / `starterMoveCode` を表示するコンポーネント（コンボ一覧のレシピプレビュー等）が正しく動作
3. L-01 解消による表示動作の改善（undefined フォールバック削除で表示がより堅牢に）
- **期待**: M3-05 機能の回帰なし

### M4 完了宣言

M4-00 / M4-00b / M4-01 / M4-02 / M4-03 / M4-04 / M4-05 すべてが完了。開発者の E2E 実機確認・承認をもって M4（セットプレイ系）を完了状態とする（M4-overview v1.1.3 §11）。M5 着手の前提条件が整った。

---

## M5-01: コンボ比較画面新規 + 選択モード追加（2026-05-23 完了）

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `pnpm test -- --run` 全通過（327 テスト、M4-05 時点 301 件 + 新規 26 件） | ✅ |
| `pnpm build` ビルド成功（TypeScript 型エラーなし） | ✅ |
| `go test ./...` 全通過（バックエンド変更なし、回帰なし） | ✅ |

### §3.4 着手前確認結果

#### 3.4.1 既存 UI コンポーネント 3 点セット確認

| コンポーネント | 構造 | 責務 |
|---|---|---|
| `ComboTable.tsx`（132 行） | `<table>` + `Map<number,boolean>` 展開状態。ComboTableRow + SetupTreeRow を描画 | 表示専用テーブル、API 呼出なし |
| `ComboListPage.tsx`（154 行） | 6 フック統合。ヘッダ + フィルタ + ComboTable を合成 | ページ統合層。選択モードなし（→ 本指示書で追加） |
| `MyComboPage.tsx`（266 行） | `useSearchParams` で status/sort/order。ステータスタブ + ComboTable | ページ統合層。タブ切替あり（→ 本指示書で選択モード追加 + タブ切替時クリア） |
| `LinkExistingSetupModal.tsx`（96 行） | `fixed inset-0 z-50 bg-black/40` オーバーレイ + リスト形式 | モーダルパターンの参考実装 → `AddComboToCompareModal` で踏襲 |

#### 3.4.2 useQueries 方針

- プロジェクト内未使用（grep 確認済み） → 本指示書で初導入
- 各クエリの queryKey: `["combo", id]`（number、flat tuple）= `useCombo`（api.ts L69）と一致、キャッシュ共有成立
- エラーハンドリング最終決定: 全成功→通常表示 / 全失敗→画面エラー / 部分失敗→成功分表示 + 失敗列に「取得失敗」

#### 3.4.3 選択モード共通フック化判断: **採用**

- コンボ一覧・マイコンボの選択モードロジック（selectedIds, toggle, clear, isAtMax）は完全に同一
- マイコンボのタブ切替時の `clear()` 呼出は、フックの `clear` を呼ぶだけで実現可能
- `useSelectMode(maxItems: number)` を新設。TrashPage の `selectedIds` とは別機能（用途・挙動が異なるため分離維持）
- **実装時の知見**: toggle の戻り値（成功/失敗）を React の `setSelectedIds` updater コールバック内の `rejected` フラグで返す方式は React バッチング下で同期的に参照できない問題があり、クロージャの `selectedIds` を直接参照する方式に変更した

#### 3.4.4 URL parse/serialize

- parse: `searchParams.get("ids")?.split(",").map(Number).filter(n => !Number.isNaN(n) && n > 0).slice(0, MAX_COMPARE_COMBOS)`
- 不正値は silently 除外、上限超過は先頭 5 件 + Toast 通知
- `useComboListFilters` の URL SearchParams 操作パターンを踏襲

#### 3.4.5 設計書本体への影響なし

- M5-overview v1.0.1 + CHANGE-015 で全設計判断確定済み。追加 CHANGE 不要
- CHANGE 通知書起票不要の根拠: バックエンド変更なし、既存 `GET /api/combos/{id}` の並列呼出のみ、DES-002 v1.8.0 の API 定義に変更なし

#### 3.4.6 queryKey 規約踏襲

- `useCompareCombos` 内部: `["combo", id]`（number、flat tuple）、architecture-patterns.md v1.0.3 §1.1 準拠

#### 3.4.7 シミー DR 有データ未保持 確認済み

- `ComboSummary` / `ComboDetail` に `okiShimmyNeutralTechDr` / `okiShimmyBackTechDr` は存在しない（types.ts 確認済み）
- DR 有時の起き攻めセルは `okiMeaty*ThrowDr` のみで判定（「投げ重ねのみ可」or「両方不可」の 2 パターン）
- M7 持ち越し課題 R-2 に該当

### 実装ファイル一覧

#### 新規作成（12 ファイル: 7 ソース + 5 テスト）

| # | ファイル | 概要 |
|---|---------|------|
| 1 | `web/src/constants/compare.ts` | `MAX_COMPARE_COMBOS = 5` |
| 2 | `web/src/features/combo/hooks/useCompareCombos.ts` | `useQueries` ベースの並列取得フック |
| 3 | `web/src/features/combo/hooks/useSelectMode.ts` | 選択モード状態管理の共通フック |
| 4 | `web/src/pages/ComparePage.tsx` | 比較画面ページ（URL パラメータ解析 + 統合） |
| 5 | `web/src/features/combo/components/CompareTable.tsx` | 比較表本体（12 行 × N 列） |
| 6 | `web/src/features/combo/components/CompareTargetList.tsx` | 比較対象一覧カード（削除ボタン付き） |
| 7 | `web/src/features/combo/components/AddComboToCompareModal.tsx` | コンボ追加モーダル |
| 8 | `web/src/features/combo/hooks/useCompareCombos.test.tsx` | 並列取得フックのテスト |
| 9 | `web/src/features/combo/hooks/useSelectMode.test.ts` | 選択モードフックのテスト |
| 10 | `web/src/features/combo/components/CompareTable.test.tsx` | 比較表テスト（12 行・oki パターン・エラー列・状況タグ） |
| 11 | `web/src/features/combo/components/AddComboToCompareModal.test.tsx` | モーダルテスト |
| 12 | `web/src/pages/ComparePage.test.tsx` | ページテスト（URL パース・空状態・ヘッダ） |

#### 修正（7 ファイル）

| # | ファイル | 概要 |
|---|---------|------|
| 1 | `web/src/router.tsx` | `/compare` ルート追加（`*` の前） |
| 2 | `web/src/features/combo/utils.ts` | `formatKnockdownAdvantage()` 追加 |
| 3 | `web/src/features/combo/components/ComboTable.tsx` | 選択 Props 追加（isSelectMode, selectedIds, onToggleSelect, isSelectionAtMax） |
| 4 | `web/src/features/combo/components/ComboTableRow.tsx` | チェックボックス列追加（選択モード時のみ） |
| 5 | `web/src/pages/ComboListPage.tsx` | 選択モードトグル + 件数バッジ + 「比較」ボタン |
| 6 | `web/src/features/mycombo/components/MyComboPage.tsx` | 選択モード + タブ切替時 clear |
| 7 | `web/src/locales/ja.json` + `web/src/locales/en.json` | i18n キー追加（`compare` + `selectMode` セクション） |

### 設計判断サマリ

| 判断項目 | 結論 | 理由 |
|---|---|---|
| 選択モード共通化（§4.2.4 / §3.4.3） | 共通フック `useSelectMode` 採用 | ロジック完全同一、タブ切替は caller 側で clear() 呼出 |
| スティッキーヘッダ | 不採用 | 12 行 × 5 列で縦方向は画面内に収まる。ラベル列のみ `sticky left` |
| AddComboModal の実装 | 簡素なリスト新規実装 | YAGNI。LinkExistingSetupModal パターン踏襲 |
| 比較表のレイアウト | 標準 HTML `<table>` | 既存 ComboTable パターンと整合、`overflow-x-auto` で横スクロール |
| マイコンボ タブ切替時 | selectedIds クリア | タブ変更で不可視コンボが選択中に残ることを防止 |
| useQueries エラーハンドリング（§4.1.3） | 部分失敗列に「取得失敗」表示 | 1 件の取得失敗で全体を潰さない、ユーザーが個別に除去可能 |

### 統合 E2E シナリオ手順書（開発者実機確認用）

#### シナリオ A: 基本動作（2 件比較）

1. コンボ一覧画面で「選択モード」ボタンをクリック → 選択モード ON
2. リュウのコンボを 2 件チェック → 「2/5件選択中」バッジ表示
3. 「比較」ボタン押下 → `/compare?ids=X,Y` に遷移
4. 比較表に 2 列で全 12 行が表示されている（始動状況〜備考）
5. URL をコピーして別タブで開く → 同じ比較状態が再現される
- **期待**: 2 列 × 12 行の比較表表示、URL 再現性

#### シナリオ B: 上限 5 件制御（v1.0.2 訂正）

1. コンボ一覧画面で「選択モード」ボタン ON
2. リュウのコンボを 4 件チェック → チェック可能（上限未到達）
3. 5 件目をチェック → 「比較」ボタンが有効化、「5/5件選択中」バッジ表示
4. **6 件目以降のコンボ行のチェックボックスが非活性（disabled）状態になっている** ことを確認
5. 「比較」ボタン押下 → `/compare?ids=...` に遷移、5 列表示
6. **URL 直接アクセスでの上限超過検証**: `/compare?ids=1,2,3,4,5,6,7` を直接入力 → 先頭 5 件採用 + Toast 通知
- **期待**: 5 件上限制御、非活性化表示、URL 上限超過 Toast

#### シナリオ C: URL 直アクセスと不正値除外（v1.0.2 改訂、全件失敗ケース明示化）

1. **不正値混在ケース**: `/compare?ids=<存在ID1>,<存在ID2>,99999,abc,-3,0` を直接入力
2. 期待: `abc` / `-3` / `0` は silently 除外。存在する ID は表示、存在しない ID（99999）は「取得失敗」表示 + 削除ボタンで個別除去可能
3. **全件失敗ケース**: `/compare?ids=99999,88888,77777`（すべて存在しない ID）を直接入力 → CompareTable が描画され、全列に「取得失敗」表示 + 削除ボタンで個別除去可能。全列を削除すると「比較対象が選択されていません」プレースホルダに遷移
4. 上限超過テスト: シナリオ B 手順 6 を参照
- **期待**: 不正値フィルタリング、部分失敗表示、全件失敗時も CompareTable 描画

#### シナリオ D: コンボ追加モーダル

1. 比較画面で「コンボを追加」ボタン押下
2. モーダル内コンボ一覧から 1 件選択
3. URL が `/compare?ids=...,新ID` に更新、比較表に新列追加
4. 既に比較中のコンボは「選択済み」バッジ付きで disabled 表示
- **期待**: 追加後の URL 更新・列追加、重複防止

#### シナリオ E: マイコンボ画面の選択モード

1. マイコンボ画面で「選択モード」ボタン ON
2. ステータスタブ「使用中」のコンボを 2 件選択
3. ステータスタブを「練習中」に切替 → `selectedIds` がクリアされる（「0/5件選択中」に戻る）
4. 「練習中」のコンボを選び直して「比較」ボタン押下 → 比較画面遷移
- **期待**: タブ切替時に選択がクリア、比較画面遷移

#### シナリオ F: PC ブラウザでの横スクロール確認

- Chrome / Firefox / Safari いずれかで:
  - 5 件比較時の横スクロール動作確認（`overflow-x-auto` でラベル列 sticky）
  - 表形式横並び表示の崩れなし確認
- スマホ向けレイアウト確認は **本 M5 では対象外**（M7 持ち越し）
- **期待**: 5 列表示で横スクロール可能、ラベル列が sticky で追従

#### シナリオ G: loading 中の表示（v1.0.2 新規追加）

1. ブラウザに `/compare?ids=<存在ID>,99999,88888` を直接入力
2. 画面初期表示: 各列の各セルがスケルトン（animate-pulse）表示。「-」フラッシュは発生しない
3. 上部の比較対象一覧カードもスケルトン表示（`#id 取得失敗` の赤表示でフラッシュしない）
4. クエリ完了後: 存在 ID 列は通常表示、存在しない ID 列は「取得失敗」表示 + 削除ボタン
- **期待**: loading 中はスケルトン表示、「-」はフィールド値 null 時のみ使用

#### U-1: 複数キャラ比較（将来検証用）

- 本 M5 期間中は **キャラ = リュウのみ実装**（プロジェクト現状の認識）
- 複数キャラ間比較シナリオは **M7 完了後の AKI 追加時（SUPP-001 §3.1）に検証**
- **期待**: M7 以降に実機検証

#### U-2: 既存機能（M4-05 まで）の回帰確認

- コンボ一覧画面の既存機能（フィルタ・ソート・表示列カスタマイズ・新規登録 etc）が選択モード ON / OFF にかかわらず動作する
- マイコンボ画面の既存機能（ステータスタブ切替 etc）が選択モード ON / OFF にかかわらず動作する
- ゴミ箱画面の `selectedIds`（一括復元・永久削除用、M2-03 実装）に影響なし
- セットプレイ画面（M4-02 / M4-04）に影響なし
- **期待**: M3-05 / M4-05 機能の回帰なし

### 残課題・気付き事項

- **R-2 持ち越し**: シミー DR 有データ（`okiShimmyNeutralTechDr` / `okiShimmyBackTechDr`）は現在のデータモデルに未保持。M7 で対応予定（M5-overview §6.6）
- **R-1 持ち越し**: M1〜M4 期間のレスポンシブ対応ばらつき調査（M7 着手前の調査推奨）
- 比較画面はキャラ = リュウのみで検証（M7 完了後の AKI 追加時にマルチキャラ比較を検証）

### M5-01 完了判定

レビュー完了承認 ≠ M5-01 完了承認。開発者の E2E 実機確認（シナリオ A〜G + U-2）が完了判定の必須ゲート。

---

## M6-01: 設定 API 基盤（2026-05-23 実装完了）

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| サービス層テスト 7 件（`internal/service/config/service_test.go`） | ✅ |
| ハンドラ層テスト 6 件（`internal/api/config/handler_test.go`） | ✅ |
| `go test ./...` 全通過（既存回帰なし） | ✅ |
| `go build ./...` ビルド成功 | ✅ |
| `go vet ./...` エラーなし | ✅ |
| `gofmt -l` 未整形ファイルなし | ✅ |

### 実装ファイル一覧

**新規作成**:
- `internal/service/config/service.go` — ビジネスロジック、状態保持、TOML 書き戻し
- `internal/api/config/dto.go` — リクエスト/レスポンス DTO（JSON camelCase タグ）
- `internal/api/config/handler.go` — HTTP ハンドラ（Get / Update）
- `internal/api/config/routes.go` — Echo ルーター登録
- `internal/service/config/service_test.go` — サービス層テスト 7 件
- `internal/api/config/handler_test.go` — ハンドラ層テスト 6 件

**変更**:
- `cmd/combomgr/main.go` — confighandler / configsvc import 追加 + DI 配線 + ルート登録
- `internal/api/config/doc.go` — M6-01 完了コメント更新

### §3.4 着手前確認サマリ（レビュー C-01 対応追記）

| 確認項目 | 確認結果 |
|---|---|
| §3.4.1 `internal/config/config.go` | JSON タグ未付与（TOML タグのみ）。`validate()` は非エクスポートで mode("local"/"lan") と Port(1-65535) を検証。`Load()` はファイル不在時に `errors.Is(err, fs.ErrNotExist)` で `Default()` を返す。→ `dto.go` に JSON camelCase タグを別途定義する方針を決定 |
| §3.4.2 `cmd/combomgr/main.go` | `configPath = "config.toml"` 定数（行53）。`cfg` は `config.Load(configPath)` 戻り値（行63）。confighandler は未 import。追加場所は `setuphandler.RegisterRoutes` の直後・debughandler の前（行164） |
| §3.4.3 既存 DTO 配置パターン | combo / preset / setup は `dto.go` 分離。character は handler.go 内同居（read-only 軽量例外）。→ M6-01 も `dto.go` 分離を採用 |
| §3.4.4 `model.APIError` / `APIErrorResponse` | `Code(string)` / `Message(string)` / `Details(map[string]any, omitempty)` + `Error(APIError)` のラッパー構造 |
| §3.4.5 テスト命名規則 | `TestFunctionName_Scenario` 形式（例: `TestLoad_FileMissing_ReturnsDefault`）。標準 `testing` ライブラリのみ使用 |
| §3.4.6 SUPP-001 §5.9 PATCH ポリシー | 部分更新を採用。`UpdateConfigRequest` の各サブ構造体をポインタ型で受け取り、nil フィールドは変更なし |

**M-01 設計判断（fileExists 非 ErrNotExist エラー時の挙動）**:
`fileExists` が `os.Stat` で権限エラー等の非 ErrNotExist エラーを受け取った場合は `false`（isInitialized: false）を返す保守的設計を採用。根拠: 「存在確認できない = 初期化済みとは扱えない」。将来的には `os.IsNotExist(err)` でエラー種別を区別し上位伝搬する改善を検討（レビュー I-01、M7+ スコープ）。

### §3.4.7 Plan Mode 必須項目の承認結果

設計担当推奨を全採用（開発者承認 2026-05-23）:

| # | 項目 | 採用内容 |
|---|---|---|
| 1 | isInitialized 判定 | サービス層（`os.Stat(configPath)`） |
| 2 | バリデーション失敗時 | 全件失敗 + 422 + `details.validations.issues` |
| 3 | config.toml 書き戻し | アトミック（`.tmp` → fsync → `os.Rename`） |
| 4 | メモリ状態保持 | サービス層に `sync.Mutex`（`type service struct` 非公開実装） |
| 5 | PUT スタイル | 部分更新（SUPP-001 §5.9、`*T` ポインタ型） |
| 6 | restartRequired | レスポンス DTO に含める（mode 変更時のみ true） |

### 設計判断: Service インターフェースの定義位置

`internal/service/config/service.go` に `Service` インターフェースを定義し、具体実装を非公開 `service` 構造体で行うパターンを採用（`setupsvc.Service` の慣例と一致）。ハンドラは `configsvc.Service` インターフェースを受け取るため、テスト時にモックを差し込み可能。

### E2E シナリオ実行結果（製造担当による curl 検証）

**シナリオ A**: `GET /api/config`（config.toml 不在）→ `isInitialized: false` + デフォルト値 ✅

**シナリオ B**: `PUT /api/config {"logging":{"level":"debug"}}` → 200 OK、logging.level が debug、他フィールド変更なし、config.toml 新規作成、`isInitialized: true` ✅

**シナリオ C**: `PUT /api/config {"server":{"mode":"invalid"}}` → 422 + `code: "validation_failed"` + `details.validations.issues[0].field: "server.mode"` ✅

**シナリオ D**: 不正 JSON → 400 + `code: "invalid_request"` ✅

**シナリオ E**: `PUT /api/config {"server":{"mode":"lan"}}` → 200 OK + `restartRequired: true`（バインドアドレスは再起動なしでは変わらない） ✅

**シナリオ G（回帰）**: `/api/characters`（1件）、`/api/combos`（56件）、`/api/setups`（正常応答）、`/api/health` — 全回帰なし ✅

### 例外条項適用箇所（§2.4）

- (a) `internal/api/config/doc.go` コメント更新 — 実施済み
- (b) DTO フィールド設計 — 指示書 §4.2 サンプルに準拠（逸脱なし）
- (c) エラーコード文字列新規追加 — `config_read_failed` / `config_write_failed` / `validation_failed` / `invalid_request` を小文字スネークケースで定義

### 既知制限事項

- mode 変更後のアプリ再起動なしではバインドアドレスは変わらない（SUPP-001 §4.2 既定の挙動温存、コメントに明記済み）
- ポート競合フォールバックは未実装（DES-002 §3.3、M6-RESEARCH-01 L-04 として次工程持ち越し）

---

## M6-02: 設定画面 + 初回起動ウィザード + ConfigResponse 拡張（2026-05-24 完了）

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過（21 件、M6-01 既存 13 件 + 追加 8 件） | ✅ |
| `pnpm test` 全通過（334 テスト、64 ファイル） | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| tsc 型エラーなし（`pnpm build` に含む） | ✅ |
| `go build ./...` ビルド成功 | ✅ |

### 実装ファイル一覧

**バックエンド（M6-01 拡張: network + defaults）**:

- `internal/config/config.go` — `DefaultsConfig` 構造体追加 + `Config.Defaults` フィールド + `Default()` デフォルト値 + `validate()` バリデーション（§2.4 例外条項 f）
- `internal/config/config_test.go` — 4 テスト追加: DefaultsFromFile / DefaultsFromDefault / DefaultsCharacterIDZero / DefaultsPresetIDZero（§2.4 例外条項 g）
- `internal/service/config/service.go` — `NetworkInfo` 型 + `LanIpResolver` DI + `resolveNetwork()` + Defaults 部分更新対応。`Service` インターフェース戻り値拡張: `Get() → (cfg, NetworkInfo, isInitialized, error)`, `Update() → (cfg, NetworkInfo, issues, restartRequired, error)`
- `internal/service/config/service_test.go` — 6 テスト追加（NetworkLocalMode / NetworkLanMode / NetworkLanModeFailure / Update_DefaultsPartial / Update_DefaultsValidationFailure / Get_DefaultsValues）+ 既存 7 件シグネチャ更新
- `internal/api/config/dto.go` — `NetworkDTO` + `DefaultsDTO` + `DefaultsUpdateDTO` 追加、`ConfigResponse` / `UpdateConfigRequest` 拡張
- `internal/api/config/handler.go` — `Get()` / `Update()` / `toConfigResponse()` 戻り値拡張対応
- `internal/api/config/handler_test.go` — 4 テスト追加（NetworkLocalMode / NetworkLanMode / Get_DefaultsValues / Update_DefaultsPartial）
- `cmd/combomgr/main.go` — `configsvc.NewService(cfg, configPath, netutil.SelectPrimaryLANIP)` 第3引数追加

**フロントエンド（新規）**:

- `web/src/lib/configApi.ts` — GET/PUT `/api/config` クライアント（`X-Requested-With: XMLHttpRequest`）
- `web/src/features/config/types.ts` — ConfigResponse / UpdateConfigRequest / NetworkInfo / DefaultsInfo 型
- `web/src/features/config/useConfig.ts` — `useQuery` フック（queryKey: `["config"]`, staleTime: 60s）
- `web/src/features/config/useUpdateConfig.ts` — `useMutation` フック（onSuccess: `setQueryData` でキャッシュ即時更新）
- `web/src/features/config/QRCodeModal.tsx` — QR コード表示モーダル（qrcode.react、Portal、ESC キー対応）
- `web/src/features/config/SettingsSectionBasic.tsx` — 基本セクション（言語 / デフォルトキャラ / プリセット）
- `web/src/features/config/SettingsSectionUser.tsx` — ユーザーセクション（disabled）
- `web/src/features/config/SettingsSectionNetwork.tsx` — ネットワークセクション（モード表示 / IP / QR ボタン）
- `web/src/features/config/SettingsSectionData.tsx` — データセクション（DB パス + disabled ボタン群）
- `web/src/features/config/SettingsSectionPresetLink.tsx` — プリセット管理リンク（disabled + ツールチップ）
- `web/src/features/config/SettingsSectionDetails.tsx` — 詳細セクション（ログパス / バージョン）
- `web/src/features/wizard/WizardProgress.tsx` — 進捗バー
- `web/src/features/wizard/Step01Welcome.tsx` 〜 `Step07Complete.tsx` — 7 ステップコンポーネント
- `web/src/pages/SettingsPage.tsx` — 設定画面（6 セクション + インラインヘッダ）
- `web/src/pages/WizardPage.tsx` — ウィザード（ステップ管理 + 完了時 PUT + navigate）

**フロントエンド（修正）**:

- `web/src/App.tsx` — `useConfig()` + `isInitialized: false` 時 `/wizard` リダイレクト
- `web/src/router.tsx` — `/wizard` + `/settings` ルート追加
- `web/src/locales/ja.json` / `en.json` — settings / wizard / qrModal 計 60+ キー追加
- `web/src/pages/ComboListPage.tsx` — ヘッダに「設定」リンク追加（v1.0.2）
- `web/src/pages/ComboDetailPage.tsx` — ヘッダに「設定」リンク追加（v1.0.2）
- `web/src/features/mycombo/components/MyComboPage.tsx` — ヘッダに「設定」リンク追加（v1.0.2）
- `web/src/pages/TrashPage.tsx` — ヘッダに「設定」リンク追加（v1.0.2）
- `web/src/pages/TagManagementPageRoute.tsx` — ヘッダに「設定」リンク追加（v1.0.2）
- `web/src/pages/ComparePage.tsx` — ヘッダに「設定」リンク追加（v1.0.2）

**テスト（新規）**:

- `web/src/features/config/useConfig.test.ts` — 1 テスト
- `web/src/features/config/useUpdateConfig.test.ts` — 1 テスト
- `web/src/features/config/QRCodeModal.test.tsx` — 3 テスト
- `web/src/features/wizard/WizardProgress.test.tsx` — 2 テスト

### Plan Mode 必須項目 8 件の承認結果

| # | 項目 | 承認内容 |
|---|------|---------|
| 1 | ConfigResponse.network 最終形 | `network: { primaryLanIp, lanUrl }` 構造、ローカル時空文字、LAN 失敗時空文字+ログ警告 |
| 2 | QR コードライブラリ | `qrcode.react`（MIT、React コンポーネント） |
| 3 | 初回判定リダイレクト位置 | `App.tsx` でグローバル判定 |
| 4 | 進捗バー方式 | `WizardProgress` 専用コンポーネント分離 |
| 5 | レスポンシブ実装 | Tailwind ブレークポイント |
| 6 | 言語選択方式 | react-i18next（既に初期化済み、キー追加のみ） |
| 7 | ウィザード完了遷移先 | コンボ一覧（`/`）固定 |
| 8 | [defaults] フィールド設計 | TOML `character_id`/`preset_id`、JSON `characterId`/`presetId`、Go `CharacterID`/`PresetID`、値型 int64 デフォルト 1 |

### E2E シナリオ A〜J 手順書

**A（初回起動正常系）**: config.toml 削除 → サーバー起動 → `/wizard` リダイレクト → Step 1-7 通過 → `/` 遷移 + config.toml 生成（`[defaults]` 含む）

**B（LAN モード）**: Step 5 で LAN 有効化 → Step 6 表示 → 完了 → `[server].mode = "lan"`

**C（設定画面表示・編集）**: `/settings` → 6 セクション表示 → 言語変更 → Toast → QR ボタン

**D（データセクション disabled）**: disabled ボタン + ツールチップ確認

**E（ユーザーセクション disabled）**: disabled ボタン + ツールチップ確認

**F（リダイレクト確認）**: config.toml 存在時 → `/wizard` リダイレクトなし

**G（回帰確認）**: 既存画面全動作確認

**H（defaults 永続化）**: Step 3/4 選択 → config.toml `[defaults]` 確認 → 設定画面で表示確認

**I（プリセット管理リンク disabled）**: 設定画面セクション 5 + ヘッダのプリセットリンク disabled 確認

**J（v1.0.2 追加: ヘッダ設定リンク + Step 3 スキップ）**: ヘッダ「設定」クリック → `/settings` 遷移 / Step 3 スキップ → Step 4 遷移 + config.toml `character_id = 1`

### 例外条項適用箇所（§2.4）

- (a) `ConfigResponse.network` フィールド追加（M6-01 拡張）
- (b) `qrcode.react` 依存追加（MIT、Plan Mode で承認）
- (c) react-i18next 初期化（既存利用、キー追加のみ）
- (f) `internal/config/config.go` に `DefaultsConfig` 構造体追加（既存 4 サブ構造体は変更なし）
- (g) `internal/config/config_test.go` に 4 テスト追加（既存 7 件は変更なし）

### バグ修正

- **ウィザード完了後の /wizard リダイレクトバグ**: `useUpdateConfig.ts` の `onSuccess` を `qc.invalidateQueries()` → `qc.setQueryData(CONFIG_KEY, data)` に変更。PUT レスポンス（`isInitialized: true`）でキャッシュを即時更新することで、`navigate("/")` 後の App.tsx 再レンダリング時に stale データ参照を防止

### 既知制限事項

- Step 6（パスワード設定 UI）は認証未実装のため省略（フェーズ 2 でパスワード認証実装時に復活、m6-to-m7-handover で記録予定）
- ウィザード中の LAN 接続情報（Step 6）は config 未保存のため「LAN IP を取得できませんでした」表示（設計担当に連絡済み、連絡事項 2）
- `/settings` はヘッダリンクからアクセス可能（v1.0.2 で対応済み）
- SettingsPage のみ disabled プリセットリンクあり。既存ページへの disabled プリセットリンク追加は v1.0.2 の別指示で対応予定

### 設計担当への連絡事項

1. **Step 6 パスワード設定 UI 省略**: 認証未実装のためスキップ。フェーズ 2 でのパスワード認証実装時に復活が必要
2. **ウィザード中 LAN 接続情報の表示見送り**: config 未保存状態では `resolveNetwork()` が空を返すため、ウィザード完了前の LAN 情報表示は不可
3. **ヘッダの「設定」リンク追加**: v1.0.2 で全主要ページに追加済み
4. **ウィザード Step 3 スキップボタン**: v1.0.2 で追加済み（スキップ時 characterId = 1）

---

## M6-03: スマホ専用ホーム画面 + スマホフッター（2026-05-24 完了）

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `pnpm test` 全通過（377 テスト、M6-02 の 334 件 + 新規 21 件 + 既存修正 22 件） | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| tsc 型エラーなし（`pnpm build` に含む） | ✅ |
| バックエンド変更なし（API / service / repository / model / migration） | ✅ |

### §3.4.2 着手前確認サマリ

| 確認項目 | 結果 |
|---------|------|
| `/combos` ルート → `ComboListPage` | ○ 存在確認 |
| `/mycombo` ルート → `MyComboPageRoute` | ○ 存在確認（`/mycombos` ではなく `/mycombo`） |
| `/combos/new` ルート → `ComboEditorPage` | ○ 存在確認 |
| `/compare` ルート → `ComparePage` | ○ 存在確認 |
| `/settings` ルート → `SettingsPage` | ○ 存在確認（M6-02 で追加済み） |
| `/presets` ルート | × 未実装（P-1 持ち越し） |
| `GET /api/combos?sort=updated_at&order=desc&limit=3` | ○ API 対応済み |
| 既存 Header 実装方式 | 各ページにインライン `<header>` 実装、共有 `Header.tsx` なし |
| `App.tsx` の `isInitialized` リダイレクト | ○ M6-02 で実装済み |
| `t("settings.presetLink.notImplemented")` 翻訳キー | ○ M6-02 で追加済み |

### §3.4.6 ホーム + フッター + リダイレクト ↔ 既存実装実態の対応表

| 系統 | 表示項目 / 機能 | 既存実装 | 有無 | M6-03 アクション |
|------|---------------|---------|------|-----------------|
| ホーム | アプリロゴ / 名称 | `t("app.title")` = "CombMgr" | ○ | 流用、HomePage 上部に表示 |
| ホーム | 現在のユーザー名 | 未実装（単一ユーザー運用） | × | 非表示（YAGNI、Phase 2） |
| ホーム | 主要機能ボタン 6 件 | 共有 Button なし | × | 新規実装、Tailwind `<Link>` で縦並び |
| ホーム | 「コンボ一覧」 | `/combos` → `ComboListPage` | ○ | `<Link to="/combos">` |
| ホーム | 「マイコンボ」 | `/mycombo` → `MyComboPageRoute` | ○ | `<Link to="/mycombo">` |
| ホーム | 「新規コンボ登録」 | `/combos/new` → `ComboEditorPage` | ○ | `<Link to="/combos/new">` |
| ホーム | 「コンボ比較」 | `/compare` → `ComparePage` | ○ | `<Link to="/compare">` |
| ホーム | 「プリセット管理」 | `/presets` 未実装（P-1） | × | disabled + tooltip |
| ホーム | 「設定」 | `/settings` → `SettingsPage` | ○ | `<Link to="/settings">` |
| ホーム | 最近更新コンボ 3 件 | API 対応済み、フロントフックなし | API○ Hook× | `useRecentCombos` 新設 |
| フッター | 「コンボ一覧」 | `/combos` ルート | ○ | `<Link to="/combos">` + `List` アイコン |
| フッター | 「マイコンボ」 | `/mycombo` ルート | ○ | `<Link to="/mycombo">` + `Bookmark` アイコン |
| フッター | 「新規登録」（中央大） | `/combos/new` ルート | ○ | `<Link to="/combos/new">` + `Plus` アイコン |
| フッター | 「設定」 | `/settings` ルート | ○ | `<Link to="/settings">` + `Settings` アイコン |
| リダイレクト | スマホ + initialized | 未実装 | × | `App.tsx`: スマホなら `/` に滞在（HomePage 表示） |
| リダイレクト | PC + initialized | 未実装 | × | `App.tsx`: PC なら `/combos` にリダイレクト |
| リダイレクト | !isInitialized | `App.tsx` で `/wizard` リダイレクト | ○ | 既存挙動温存、変更なし |

### 実装ファイル一覧

**フロントエンド（新規）**:

- `web/src/hooks/useIsMobile.ts` — スマホ判定フック（`useSyncExternalStore` + `window.matchMedia("(max-width: 639px)")` ）
- `web/src/hooks/useRecentCombos.ts` — 最近更新コンボ取得フック（`fetchJSON` 直接、queryKey: `["combos", "recent"]`）
- `web/src/components/Footer.tsx` — スマホフッター（4 ボタン固定ナビ、`sm:hidden`、中央「新規」ハイライト）
- `web/src/pages/HomePage.tsx` — スマホ専用ホーム画面（ロゴ + 6 ボタン + 最近コンボ 3 件）

**フロントエンド（修正）**:

- `web/src/App.tsx` — `useIsMobile` import + PC→`/combos` リダイレクト分岐追加 + `<Footer />` グローバル配置 + `pb-16 sm:pb-0` ラッパー
- `web/src/router.tsx` — `/` ルートを `ComboListPage` → `HomePage` に変更
- `web/src/locales/ja.json` — `home.*`（10 キー）+ `footer.*`（5 キー）追加
- `web/src/locales/en.json` — 同上（英語版）

**テスト（新規）**:

- `web/src/hooks/useIsMobile.test.ts` — 4 テスト
- `web/src/hooks/useRecentCombos.test.ts` — 3 テスト
- `web/src/components/Footer.test.tsx` — 6 テスト
- `web/src/pages/HomePage.test.tsx` — 9 テスト（ロゴ / 6 ボタン / disabled / リンク先 / ローディング / 成功 / 0 件 / エラー / 詳細リンク）

**テスト（修正）**:

- `web/src/App.test.tsx` — `useIsMobile` / `Footer` モック追加、7 テストケース（wizard リダイレクト / PC リダイレクト / モバイル滞在 / `/combos` 非リダイレクト / フッター表示 / フッター非表示 / wizard 優先）

### Plan Mode 必須項目 5 件の承認結果

| # | 項目 | 承認内容 |
|---|------|---------|
| 1 | スマホ判定方式 | ハイブリッド: JS `useSyncExternalStore` + `window.matchMedia("(max-width: 639px)")` でリダイレクト判定、Tailwind `sm:hidden` でフッター CSS 制御。外部依存追加なし |
| 2 | リダイレクト実装位置 | `App.tsx` グローバル判定（M6-02 既存パターン踏襲）。判定順序: ① isLoading → ② !isInitialized→/wizard → ③ /+PC→/combos → ④ 通常描画 |
| 3 | ホームのルート設計 | `/` 出し分け（案 b）: `router.tsx` の `/` を `HomePage` に変更、PC は `App.tsx` で `/combos` にリダイレクト |
| 4 | **フッター配置方式** | **案 B（App.tsx グローバル配置）を採用**。§3.4.2 着手前確認で既存 Header が per-page 実装（共有 `Header.tsx` なし）であることを確認。案 C（Header に揃える）の論理的帰結は案 A（per-page）だが、DES-005 §4.2 は「全スマホ画面で固定ナビ」を規定しており、per-page では実装漏れリスクがある。フッターは全画面同一の 4 ボタン固定ナビであり、ヘッダ（ページごとに構成が異なる）とは性質が異なるため、案 B が最適と判断し開発者が承認。`/wizard` ではフッター非表示 |
| 5 | 最近更新コンボ取得方式 | 案 α（既存 API そのまま）: `GET /api/combos?sort=updated_at&order=desc&limit=3`、`character_id` なし（全キャラ横断）、`useRecentCombos` フック新設 |

### E2E シナリオ A〜F 手順書（開発者実施）

**A（スマホホーム画面表示）**: devTools でスマホサイズ（390×844）→ `/` アクセス → ロゴ「CombMgr」+ サブタイトル「SF6 コンボマネージャー」表示 → 6 ボタン表示 → 「プリセット管理」disabled + 「今後実装予定」ツールチップ → 最近更新コンボセクション表示

**B（PC リダイレクト）**: devTools で PC サイズ（1280×800）→ `/` アクセス → 自動で `/combos` にリダイレクト → コンボ一覧画面表示

**C（スマホフッター表示）**: スマホサイズ → 任意の画面 → 画面下部に固定フッター表示（コンボ / マイコンボ / 新規（中央・青丸・大きめ）/ 設定）→ 各ボタンタップで正しい画面に遷移 → 現在のルートに対応するボタンがハイライト表示

**D（PC フッター非表示）**: PC サイズ → 任意の画面 → フッター非表示を確認（`sm:hidden` による CSS 制御）

**E（ウィザード優先）**: config.toml 削除（または `isInitialized: false`）→ スマホサイズで `/` アクセス → `/wizard` にリダイレクト → フッター非表示

**F（回帰確認）**: 既存画面（コンボ一覧 / コンボ詳細 / コンボ編集 / マイコンボ / 比較 / タグ管理 / 設定 / ウィザード）が正常に動作することを確認。スマホサイズでフッターが表示され、コンテンツが隠れていないこと（`pb-16` ラッパー）

### 例外条項適用箇所

- **(a)** `/` ルートの `ComboListPage` → `HomePage` への変更（`router.tsx`）
- **(b)** 依存追加なし（`react-responsive` 不要、`window.matchMedia` はブラウザ標準 API）
- **(c)** `App.tsx` に `<Footer />` 全画面共通配置 + `pb-16 sm:pb-0` ラッパー追加
- **(d)** `useIsMobile.ts` フック新設（JS `window.matchMedia` 使用）

### 既知制限事項

- `HomePage.tsx` の主要機能ボタン 6 件リスト・最近コンボリストは表示専用サブコンポーネントに未分離（指示書 §4.1.2）。ロジック分離（`useRecentCombos`）は実施済み。113 行と小規模のため M7 以降で分離を検討
- Footer の `isActive` は `/`（ホーム画面）を `/combos` のアクティブ状態として扱う。ホーム画面でフッターのコンボボタンがハイライトされる動作は UX 設計判断
- Footer は `sm:hidden`（640px 以上で非表示）を使用。指示書例示の `md:hidden` ではなく、DES-005 §4.4 のスマホ定義「〜640px（sm 未満）」に正確に合致する `sm:hidden` を選択

---

## M6-04: M6 統合 E2E + 残課題 4 軽微修正（2026-05-24 完了）

| 自己テスト | 結果 |
|-----------|------|
| `pnpm vitest run` 全通過（380 テスト、M6-03 の 377 件 + 新規 3 件） | ✅ |
| `go test ./...` 全通過（バックエンド変更なし、形式的確認） | ✅ |
| `pnpm run build` 成功 | ✅ |
| `pnpm tsc --noEmit` 成功 | ✅ |

### §3.4 着手前確認結果

| 確認項目 | 結果 |
|---------|------|
| §3.4.1 M6-01 / M6-02 / M6-03 完了確認 | ✅ progress-log.md で 3 件完了報告確認。App.tsx / SettingsSectionNetwork.tsx / Footer.tsx 存在確認 |
| §3.4.2 残課題 4 修正対象特定 | ✅ `SettingsSectionNetwork.tsx` L30 のポート表示が `{config.server.port}` のみ（`127.0.0.1:` プレフィックス欠落）。修正方針: 案 a（文字列リテラルでホスト固定）採用 |
| §3.4.3 テストベースライン | ✅ フロント 377 テスト / バックエンド全テスト pass |
| §3.4.4 CHANGE-016 反映確認 | ✅ docs/ + CLAUDE.md: 論理削除注記のみ残存（意図通り）。web/src/ `combo-draft` / `draftStorage` / `useDraftSave`: 0 件（意図通り） |

### §4.3 設計判断事項との整合確認

| 項目 | 整合 | 備考 |
|------|------|------|
| 統合 E2E パターン: M3-05 / M4-05 / M5-01 踏襲 | ✅ | `docs/progress/m6-integration-e2e-results.md` に手順書記載 |
| 残課題 4 修正方針: 案 a 文字列リテラル | ✅ | `127.0.0.1:${config.server.port}` で実装 |
| 下書き自動保存: CHANGE-016 廃止、スコープ外 | ✅ | 未実装、スコープ外 |
| 残課題 1 / 3: スコープ外 | ✅ | 未対応 |
| LAN モード回帰確認: U-1 含む | ✅ | E2E シナリオ U-1 に記載 |

### 修正ファイル

**残課題 4 軽微修正**:
- `web/src/features/config/SettingsSectionNetwork.tsx` — ネットワークセクションのローカルモード表示を `127.0.0.1:<port>` 形式に修正（L30、1 行変更）

**テスト追加**:
- `web/src/pages/SettingsPage.test.tsx` — 3 テスト追加:
  1. `mode === "local"` 時に `127.0.0.1:47318` 表示確認（新規）
  2. `mode === "lan"` 時に `192.168.1.100` IP 表示確認（新規、既存テストは QR ボタンのみ）
  3. `mode === "lan"` + `primaryLanIp` 空文字時に「LAN IP を取得できませんでした」エラー表示確認（新規）

**ドキュメント新設**:
- `docs/progress/m6-integration-e2e-results.md` — M6 統合 E2E シナリオ手順書（A〜G + U-1〜U-4、全 11 シナリオ）。開発者の実機検証結果記入用

### E2E シナリオ手順書（§5.2）

全 11 シナリオを `docs/progress/m6-integration-e2e-results.md` に記載:
- A: 初回起動ウィザード正常系（M6-02）
- B: 設定画面での設定変更 + 永続化（M6-01 + M6-02）— 残課題 4 修正後の `127.0.0.1:<port>` 表示確認を含む
- C: スマホホーム画面表示 + 主要機能ボタン遷移（M6-03）
- D: ヘッダ「設定」リンクからの遷移（M6-02 v1.0.2）
- E: アプリ起動時リダイレクト分岐（M6-02 + M6-03）
- F: CHANGE-016 反映後の挙動確認（下書き自動保存廃止）
- G: 既存機能の回帰確認（M1〜M5、9 画面）
- U-1: LAN モードでの動作確認（M6-RESEARCH-01 由来）
- U-2: config.toml 完全削除 → 再初期化
- U-3: データセクションの DB パス表示
- U-4: 言語切替の永続化

### 例外条項適用箇所

- **(a)** `SettingsSectionNetwork.tsx` L30 の表示文字列修正（1 行、M6-02 v1.0.2 §4.5.4 規定との整合確保）
- **(b)** `SettingsPage.test.tsx` にテスト 3 件追加（`mode === "local"` 表示確認 + LAN IP 表示確認 + LAN IP 空文字エラー表示確認）
- **(c)** `docs/progress/m6-integration-e2e-results.md` 新設（統合 E2E 実行結果記録ファイル）

### 変更しなかったもの（§2.3 / §7.3 確認）

- バックエンド全般: 変更なし ✅
- 既存ルート定義: 変更なし ✅
- M6-01 / M6-02 / M6-03 本体ロジック: 残課題 4 修正以外で変更なし ✅
- 設計書本体 / SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md: 変更なし ✅
- 新規 CHANGE 通知書: 起票なし ✅
- プリセット管理画面 `/presets`: 未実装 ✅
- 下書き自動保存: 未実装（CHANGE-016 廃止） ✅
- 残課題 1（Step 6 パスワード設定）/ 残課題 3（ヘッダ他ページ反映）: 未対応 ✅
- shadcn/ui: 未使用 ✅

### 機械レビュー取り込み結果（2026-05-24）

レビューファイル: `docs/progress/m6-04-review.md`
レビュー判定: **条件付き承認（軽微な問題あり、完了承認可）**。重大な問題なし。

| 指摘 | 判断 | 理由 |
|------|------|------|
| [軽微-1] LAN テストが `<IP>:<port>` 結合形式を未確認 | 取り込み不要 | コンポーネント（M6-02 既存実装）では IP とポートが別行表示。テストは実装を正しく反映。指示書 §4.1.4 文言との乖離は仕様記述の粒度の問題 |
| [軽微-2] "ポート番号" ラベルで `127.0.0.1:47318` を表示 | 取り込み不要 | 指示書 §4.1.3 概念コードは「製造担当が実装で確定」と明記。§2.4(a) 最小変更方針から既存ラベル維持は合理的。i18n キー追加はスコープ拡大。m6-to-m7-handover で改善候補として記録推奨 |
| [提案-1] テスト名の具体化 | 取り込み不要 | テスト名は十分明確。次回マイルストーン以降の改善余地として認識 |

コード修正: なし（全指摘が取り込み不要判断）

---

## M7-02 完了報告

### 基本情報

| 項目 | 内容 |
|------|------|
| 指示書 | M7-02 v1.0.0 |
| 実施日 | 2026-05-31 |
| 推奨モデル | Opus 4.6 |

### 実施内容

#### Phase 1: 基盤整備
- shadcn/ui 追加コンポーネント 9 件導入: form, input, label, badge, card, table, sonner, switch, tooltip
- button.tsx は M7-01 で既に導入済みのためスキップ（指示書 Table A との差異として報告済み）
- 依存追加: react-hook-form 7.76.1, @hookform/resolvers 5.4.0, sonner 2.0.7
- App.tsx に `<Toaster position="top-center" />` 配置
- `useSessionStorage.ts` フック新設

#### Phase 2: バックエンド List API 拡張
- `internal/repository/setup/repository.go` に `ListSetupsByComboIDs` バッチ取得メソッド追加（N+1 回避、候補 (b) 2クエリ方式）
- `internal/service/setup/service.go` に対応サービスメソッド追加
- `internal/api/combo/handler.go` の List ハンドラで setupSvc.ListSetupsByComboIDs 呼出 + resp.Setups セット
- テストモック更新（combo handler_test.go, setup handler_test.go）

#### Phase 3: Toast 移行（M4-03/M5-01 由来全件）
- ComboEditor.tsx: topMessage state 全廃 → sonner toast（成功/エラー/警告）
- ComparePage.tsx: topMessage state 全廃 → sonner toast
- ComboDetailPage.tsx: location.state.topMessage 参照廃止
- SettingsSectionBasic.tsx: message state 全廃 → sonner toast

#### Phase 4: ComboDetailMetadata Q10 修正
- 表示フィールド: driveGaugeConsumedTotal → driveAvailableAtStart, saGaugeConsumedTotal → saAvailableAtStart
- i18n キー値変更: "ドライブゲージ消費" → "ドライブゲージ開始残量", "SAゲージ消費" → "SAゲージ開始残量"
- バックエンドカラム/API フィールド/フロント型定義は温存（Q15 確定）

#### Phase 5: 分離パターン逸脱解消（D-1〜D-4）+ C-3
- D-4: `useTagFormDialog.ts` 新設 + TagFormDialog を react-hook-form + zodResolver + shadcn/ui Form 統合
- D-3: `useTagSelectorForm.ts` 新設 + TagSelector から useMutation 分離（Props 経由で onCreateTag/creating）
- D-1: `useLinkExistingSetupForm.ts` 新設 + LinkExistingSetupModal を callback 委譲化（→ C-3 自動解消）
- D-2: `useSetupAccordionActions.ts` 新設 + SetupAccordionItem を presentation-only 化
- ComboDetailPage / ComboEditor 呼出元修正

#### Phase 6-8: SetupTreeRow + ComboTable + C-4
- ComboSummary 型に `setups?: SetupSummary[]` 追加
- SetupTreeRow.tsx 本実装（Props: setups, colSpan, onSetupClick、`└ 名前 [レシピ]` 表示）
- ComboTable.tsx の展開状態を sessionStorage 化（`combo-list-expanded-ids-v1` キー）
- ComboTableRow.tsx に `canExpand` Props 追加（展開アイコン条件表示）
- C-4: defaultRecipe 条件描画パターン統一（SetupRegistrationSection, SetupCandidateList, SetupSelectorModal, LinkExistingSetupModal を「（レシピなし）」フォールバックに統一）、HomePage は除外

#### Phase 9: Dialog scroll + テスト修正
- dialog.tsx に `max-h-[85vh] overflow-y-auto` fallback 追加
- テスト修正: LinkExistingSetupModal.test.tsx, SetupAccordionItem.test.tsx, TagFormDialog.test.tsx, TagSelector.test.tsx, App.test.tsx

### Plan Mode 確定事項（10 項目）
1. shadcn/ui 追加: 9 件（button 既存スキップ）
2. Toast: (a) sonner 採用
3. Dialog scroll: (c)+(a) 二段構え
4. TagSelector cmdk: (θ) 不採用継続
5. List API: (b) 2クエリ方式
6. Toast 対象: 4 ファイル全件一括移行
7. フック命名: 指示書提案通り
8. C-2: (β) 現状維持
9. C-3: (γ) callback 委譲統一
10. C-4: (ε) パターン2統一（HomePage 除外）+ sessionStorage `combo-list-expanded-ids-v1`

### テスト結果
- フロントエンド: 73 ファイル、390 テスト 全 PASS
- バックエンド: 全 PASS
- ビルド: `pnpm build` 成功（chunk size warning のみ、既知）

### Phase 6-8 追加実施（2セッション目、2026-05-31）

自作ラッパー9件のshadcn/uiコンポーネント移行を完了:

#### Form/Field 系（3件）
- ComboEditorBasicFields.tsx: `<input>` → Input、`<textarea>` → Textarea、`<checkbox>` → Checkbox、`<label>` → Label。native `<select>` は Radix Select の空文字列非対応の問題を回避するため維持（CSS クラスを `border-input bg-background` に統一）
- SetupBasicInfoForm.tsx: `<input>` → Input、`<textarea>` → Textarea、`<label>` → Label
- ComboListFilters.tsx: `<label>` → Label。native `<select>` は同様に維持

#### Badge/Display 系（2件）
- TagBadgeList.tsx: inline `<span>` → shadcn Badge（動的背景色は `style` prop で維持）
- ValidationDisplay.tsx: `<ul>`/`<li>` → Card + CardContent + Badge + lucide-react アイコン（AlertCircle/AlertTriangle）

#### Table/List 系（4件 + Row コンポーネント）
- ComboTable.tsx: `<table>` → Table/TableHeader/TableBody/TableRow/TableHead
- ComboTableRow.tsx: `<tr>`/`<td>` → TableRow/TableCell、`<input type="checkbox">` → Checkbox
- CompareTable.tsx: `<table>` → Table系、renderCell の `<td>` → TableCell
- TrashList.tsx: `<table>` → Table系、全選択 checkbox → Checkbox（indeterminate 対応）
- TrashListRow.tsx: `<tr>`/`<td>` → TableRow/TableCell、checkbox → Checkbox
- TagListTable.tsx: `<table>` → Table系、`<button>` → Button（variant="link"）

#### 設計判断
- native `<select>` は shadcn/ui Select（Radix UI ベース）に置換しなかった。理由: Radix Select は `value=""` を uncontrolled と見なすため、「(未指定)」プレースホルダーの動作が壊れるリスク。M7-03 以降のレスポンシブ対応時に再検討する候補として記録

### テスト結果（最終）
- フロントエンド: 73 ファイル、390 テスト 全 PASS
- バックエンド: 全 PASS
- ビルド: `pnpm build` 成功

### 温存事項
- バックエンドキャッシュ計算 + VAL-C06/C07 復活 → M7-04
- drive_gauge_consumed_total / sa_gauge_consumed_total カラム + API フィールド + フロント型定義 → 温存（Q15）
- ModifiersEditor の console.warn 残存（P-01）→ 温存
- VirtualController ステップ変換ロジック分散（C-2）→ (β) 現状維持
- native `<select>` の shadcn Select 置換 → M7-03 以降検討

### E2E シナリオとの差分
- G-1（C-2）: 共通フック集約ではなく現状維持
- G-3（C-4 の HomePage 除外）: HomePage は starterMoveCode フォールバック維持

---

## M7-03 完了報告

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `pnpm exec vitest run` 全通過(426 テスト) | ✅ |
| `tsc --noEmit` 型エラーなし | ✅ |
| `pnpm build` ビルド成功 | ✅ |
| `go test ./...` 全通過 | ✅ |
| 進捗ログ更新 | ✅ |

### 実装内容

#### R-3 解消: AddComboToCompareModal キャラクターフィルタ追加

- `AddComboToCompareModal.tsx` に CharacterSelector 統合
  - `useState<number>(INITIAL_CHARACTER_ID)` でキャラ選択 state 追加
  - `useCombos` の `characterId` を state 連動に変更（固定 → 動的）
  - DialogHeader 直後に「キャラクター:」ラベル + CharacterSelector 配置
  - `INITIAL_CHARACTER_ID` 定数は温存（初期値として継続使用）
  - Props 契約(`open` / `currentIds` / `onAdd` / `onOpenChange`)変更なし
  - Dialog scroll 制約パターン修正: `DialogContent` から `max-h-[70vh] flex flex-col` を削除、内部リスト div を `max-h-[60vh] overflow-y-auto` に変更（M7-02 確立パターン architecture-patterns §7.5 準拠、レビュー指摘対応）

#### 既存固定幅 3 件の対応

| # | ファイル | 変更内容 | 採用候補 |
|---|---------|---------|---------|
| 1 | CompareTargetList.tsx:50 | `max-w-[200px]` → `sm:max-w-[200px]` | (B) |
| 2 | AddComboToCompareModal.tsx:89 | `max-w-[200px]` → `sm:max-w-[200px]` | (B) |
| 3 | ColumnVisibilityMenu.tsx:45 | 現状維持 | (D) ポップオーバー形式で横スクロール影響ゼロ |

#### R-2 解消済み確認（新規実装なし）

- ComboDetailMetadata.tsx: シミー(行109-122) + DR有(行84-106) 表示動作確認 ✓
- CompareTable.tsx: renderOkiCell 内でシミー + DR有 表示動作確認 ✓
- ComboEditor.tsx / ComboEditorBasicFields.tsx: OKI_FIELDS 経由 Checkbox 編集可能 ✓
- M4-04 で既に解消済み = 本 M7-03 で新規実装なし

#### テスト追加

- `AddComboToCompareModal.test.tsx` に 4 ケース追加（計 8 ケース）
  - CharacterSelector 統合: ラベル + mock-character-selector 表示確認
  - 初期状態で useCombos が INITIAL_CHARACTER_ID(1) で呼ばれることを確認
  - 初期キャラでコンボ候補が表示されることを確認
  - 他キャラ切替で useCombos が新 characterId で呼ばれることを確認
  - ※ CharacterSelector は Radix UI Select の jsdom pointer capture API 非対応のためモック化

### Plan Mode 確定事項

- Q1: モーダル上部に「キャラクター:」ラベル付きで CharacterSelector 配置（推奨通り）
- Q2: 既存の `combosQuery.isLoading` 分岐を活用（推奨通り）
- Q3: #1/#2 = (B) sm:max-w-[200px]、#3 = (D) 現状維持（推奨通り）
- Q4: R-2 = view 確認のみ、新規実装なし（推奨通り）
- Q5: テストケース 4 件追加（推奨通り）

### 温存事項
- バックエンドキャッシュ計算 + VAL-C06/C07 復活 → M7-04
- バグ #5（仮登録コンボ昇格時エラー）→ M7-04
- `window.confirm` 全件 AlertDialog 化 → M7-05
- バグ #6（レシピなしセットプレイ登録）→ M7-05
- 本格スマホ UI（カード形式等）→ フェーズ 3 以降
- `lg:` / `xl:` / `2xl:` ブレークポイント新規導入 → フェーズ 2 以降
- テーブル系 4 件の `overflow-x-auto` 廃止 → フェーズ 3 以降
- ColumnVisibilityMenu.tsx の `min-w-[160px]` → (D) 現状維持（ポップオーバー形式）

---

## M7-04-1: CHANGE-019 クリーンアップ + バグ #5 修正（2026-06-03 完了）

指示書 `M7-04-1-change019-cleanup-and-bug5.md`。削除箇所マップは M7-RESEARCH-04 レポート（47 箇所）を正本とした。

### 系統 A: CHANGE-019 クリーンアップ（ゲージ消費量キャッシュ列の全削除）

`combos.drive_gauge_consumed_total` / `sa_gauge_consumed_total`（集計未実装で全行 NULL、書き込み経路なし）をコードベースから全削除。

- **マイグレーション（新規）**: `000008_drop_gauge_consumed_total.up.sql` / `.down.sql`。SQLite 3.50 系（modernc.org/sqlite v1.50.0）対応の `ALTER TABLE combos DROP COLUMN`。down は REAL / INTEGER NULL 可で復元。過去マイグレ 000001〜000007 は不改変。
- **バックエンド削除**:
  - `model/combo.go`: `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` フィールド削除
  - `repository/combo/repository.go`: INSERT 列+バインド / SELECT 5 本の列指定 / scanCombo / sortFieldWhitelist 2 キー / ソートコメント削除
  - `api/combo/dto.go`: `ComboResponse` フィールド + `toComboResponse` マッピング削除
  - `service/validation/combo.go`: `validateC06DriveConsumption` / `validateC07SAConsumption` 関数 + 呼出 + 定数 `CodeC06DriveConsumption` / `CodeC07SAConsumption` 削除。**VAL-C08 以降はリネームせず C06/C07 を欠番化**
- **フロント削除**:
  - `types.ts`: `ComboSummary` / `Combo` のフィールド削除（`ComboDetail` は継承で追従）
  - `constants/combo-list.ts`: `SORT_FIELD_VALUES` / `SORT_FIELD_LABELS` の 2 要素削除（`Record<SortField,...>` 網羅性は保持）
  - `CompareTable.tsx`: ドライブ消費 / SA 消費の 2 行削除 + 未使用となった `formatDriveGauge` / `formatSAGauge` import 削除（関数本体は utils.ts に温存）
  - i18n `ja.json` / `en.json`: `comboList.sort.*_consumed_total` + `compare.row.driveGauge` / `saGauge`（消費行ラベル）削除
- **テスト修正**: `validation/combo_test.go` の TestC06/C07 系 4 件削除 + 未使用化した `ptrFloat` ヘルパ削除。`CompareTable.test.tsx` / `useCompareCombos.test.tsx` のフィクスチャ該当フィールド削除 + `CompareTable.test.tsx` の行ラベルアサーション（ドライブ消費 / SA 消費）削除。

### 系統 B: バグ #5 修正（仮登録コンボ本登録昇格時のエラー表示崩れ）

- **原因**: `PromoteToFinalButton` が独自の赤 box（`message` を join）でエラー表示し、`ComboDetailPage` のボタン横並び（flex）内に置かれるため「ボタン状」に崩れていた。バックエンドのバリデーション（VAL-C09 等）・レスポンス構造は正常 = 表示のみの問題。
- **修正方針（開発者確定）**: 共有 `ValidationDisplay` を再利用、全 validation エラーを統一表示、テスト追加。
- **実装**:
  - `features/combo/errors.ts`（新規・再利用ヘルパ）: `parseComboApiError(err)` で `{ validations, duplicateIssue(VAL-C02), fatalMessage }` に分類。M7-05 バグ #6 が踏襲できる汎用形。
  - `PromoteToFinalButton.tsx`: `errorMessage` 文字列 state を廃止。`onError` を `parseComboApiError` 経由に。重複は従来通り `DuplicateWarning` ダイアログ（内包）、致命エラーは `toast.error`、バリデーションエラーは新規 `onValidationError` コールバックで親に委譲。
  - `ComboDetailPage.tsx`: `promoteError` state + ボタン行とは別位置（全幅）に `ValidationDisplay` を配置。これで「ボタン状崩れ」を解消。
  - `ComboEditor.tsx`: `onValidationError={setValidationResult}` で既存 `ValidationDisplay` に合流。
  - `PromoteToFinalButton.test.tsx`: 400 バリデーションエラー時に `onValidationError` が内容を受け取ることを検証するテストを追加。

### 検証結果

- `go test ./...` パス（マイグレ 000008 適用含む repository テスト緑）。テスト件数 −4（TestC06/C07）。
- `pnpm exec vitest run`: 79 ファイル / 427 テスト パス（バグ #5 新規テスト +1）。
- `pnpm exec tsc --noEmit` / `pnpm build` / `go vet ./...` クリーン。
- grep 全数確認: `consumed_total` / `ConsumedTotal` / `GaugeConsumed` がコード領域 0 件（000001 履歴 + 000008 を除く）。
- 温存確認: `moves.*_gauge_increase` / `*_available_at_start` / `formatDriveGauge` / `formatSAGauge` / `comboDetail.metadata.driveGauge`（開始残量ラベル）残存。

### 開発者への確認事項

- **E2E シナリオ 6（バグ #5 の見た目）は開発者実機での目視確認を依頼**: 仮登録（レシピ空）→ 本登録昇格 → 400 が全幅の通常エラー表示（ValidationDisplay）で出て「ボタン状」に崩れないこと。
- **観察事項（スコープ外・未着手）**: i18n の `comboList.sort.driveGauge` / `saGauge`（ja.json 54-55、"ドライブゲージ消費" / "SAゲージ消費"）は camelCase の重複キーで、ソートラベル参照（`comboList.sort.${SortField}`、snake_case のみ）から到達しない**本変更以前からの未使用キー**。CHANGE-019 の 47 箇所（grep `consumed_total` 対象）に含まれず、スコープ厳守のため本指示書では未削除。整理要否は設計担当判断に委ねる。

### 温存事項（次マイルストーン以降）

- バグ #6（レシピなしセットプレイ登録、VAL-S02）→ M7-05。本 M7-04-1 で確立した `parseComboApiError` + `ValidationDisplay` パターンを踏襲予定。
- 残り 4 プリセット切替確認 / AKI + 残り 3 キャラ追加 / スキーマ耐久テスト → M7-04-2。

---

## M7-04-2: 残り 4 プリセット切替確認 + AKI / ジェイミー / ガイル 追加 + スキーマ耐久テスト（2026-06-03 完了）

指示書 `M7-04-2-presets-characters-schema-durability.md` v1.1.0。開発者提供 HTML(`work_html/{aki,jamie,guile}.html`、各約 64 技のフレームデータ表)から抽出して seed SQL 化。データ正確性は不問(§0.2、フェーズ3で総入れ替え)。Plan Mode 必須 5 項目は AskUserQuestion で確定(下記)。

### Plan Mode 確定事項（§3.4.10）

1. **HTML→スキーマ対応付け**: `frame_skill` セルの日本語技名を抽出。技種別から code(DES-004 §2.1 命名)/ category / properties を判定。数値カラムは全 NULL(リュウ seed 踏襲)。
2. **custom_states 耐久範囲**: 既存 `characters.custom_states`(JSON TEXT 列)に収まり**スキーマ変更不要**。消費/表示コードは無いため耐久 = seed投入 → API ラウンドトリップ → 当該キャラのコンボ非破綻の確認。新規表示 UI は作らない(フェーズ2+)。
3. **検証用リュウデータ全クリア**: → **M7-05 送り**(本タスクは既存リュウデータを回帰確認に活用)。
4. **代表コンボ投入方式**: → **seed SQL**。各キャラ 12 件 = 計 36 件。
5. **キャラ固有技名のプリセット扱い**: → **フェーズ2送り**。official_ja_move エイリアスのみ投入、空 4 プリセットはフォールバック動作。
- **フロント de-hardcode 範囲**: → **閲覧のみ**(ComboEditor のリュウ固定は変更せず、コンボは seed 投入)。
- **ジェイミー飲酒レベル**: → **composite**(DES-003 §3.2 正準例。level integer 0-4 + unlocked_moves string_list)。AKI 毒 = opponent/flag/boolean、ガイル = NULL。

### 系統 B: 追加 3 キャラの seed（新規マイグレーション 000009〜000012）

- `000009_seed_characters_aki_jamie_guile`: `characters` 3 件。AKI=毒 / ジェイミー=飲酒レベル(composite) / ガイル=NULL の custom_states。リュウ(000003)は不改変。
- `000010_seed_moves_aki_jamie_guile`: 共通の通常技 18 + システム技 6(throw/drive_impact/system)を 3 キャラ一括 + キャラ固有 unique/special/super_art。数値カラム NULL。**投入結果: AKI 44 技 / ジェイミー 45 技 / ガイル 41 技**(リュウ 56 技は不変)。
- `000011_seed_aliases_official_ja_move_aki_jamie_guile`: official_ja_move エイリアスを 1 本の CASE で全技マッピング(NULL 行は除外)。残り 4 プリセットは空のまま(000005 不改変)。down は move_id の所属キャラで絞りリュウのエイリアス(000006)を温存。
- `000012_seed_combos_durability`: 各キャラ 12 件 = 36 件のコンボ + combo_steps。memo を相関キーに WITH 句(CTE)で投入(SQLite は `FROM (VALUES...) AS v(cols)` の列別名を非対応のため CTE を使用)。starter_move_id を step_order=1 で更新。recipe_cache は official_ja_move エイリアスを `group_concat(... ORDER BY step_order)` + `json_quote` で計算し全プリセット ID に同一文字列で投入(空プリセットは official_ja_move へフォールバックするため全プリセット同表記。連結子 " > " = notation/resolver.go)。

### 系統 A: 残り 4 プリセット切替確認（フォールバック動作）

- 新規プリセットデータは作らず、空プリセット選択時の DES-004 §5.3 フォールバック(`official_ja_move` → `moves.code`)の動作確認のみ。
- 実機 API で確認: AKI コンボのレシピを srk(5)/numeric_ja(3) 空プリセットで取得 → official_ja_move(1) と同一文字列を返す(フォールバック成立)。

### フロント de-hardcode（閲覧のみ、既存 useCharacters/CharacterSelector を再利用）

- `ComboListFilters.tsx`: ハードコードの単一リュウ `<option>` を `useCharacters` の動的リストに置換(取得前/0件はリュウのフォールバック option)。
- `ComboDetailHeader.tsx`: 固定 "リュウ"/"R" バッジを `useCharacterName(combo.characterId)` + 動的イニシャルに置換。
- `MyComboPage.tsx`: `characterId` を `useState` 化し `CharacterSelector` の no-op `onChange` を実配線(キャラ切替時に選択モード解除)。
- ComboEditor(`RYU_CHARACTER_ID` 固定)は変更せず(他キャラの登録 UI はフェーズ2送り)。

### M7-15 持ち越し（B-2/B-4）

- `AddComboToCompareModal` は M7-03 時点で既にキャラ切替実装済み。キャラ追加により別キャラのコンボ追加動作が初めて検証可能になった(キャラ動的リストで成立)。

### 検証結果

- `go test ./...` パス。**回帰修正**: `service/combo/service_test.go` の `countCombos` ヘルパ + ロールバック確認 1 箇所を、耐久 seed(aki/jamie/guile)を除外する scope に変更(全テーブル件数 0 前提が seed 36 件で崩れていたため)。
- マイグレーション up / down→up(冪等性)検証: down 4 段で chars=1(リュウのみ)/ combos=0 に戻り、リュウの moves 56 + aliases 56 を温存。up 再適用で chars=4 / 耐久コンボ 36 に復帰。
- データ整合(テスト確認): 全 combo_steps が official_ja_move エイリアスを持ち recipe で欠落なし / custom_states は AKI・ジェイミーとも `json_valid` / starter_move_id 全件投入 / recipe_cache 全 36 件投入。
- `pnpm exec vitest run`: 79 ファイル / 427 テスト パス。**回帰修正**: `ComboListFilters.test.tsx` を `QueryClientProvider` でラップ(useCharacters 追加に伴う)。
- `pnpm exec tsc --noEmit` クリーン。
- 実機 API スモーク(`XDG_DATA_HOME` を一時ディレクトリに向け隔離 DB で起動): `GET /api/games/1/characters` が 4 キャラ + custom_states 正常 / `GET /api/combos?character_id=2`(AKI) が 12 件 + defaultRecipe 表示 / 空プリセットのフォールバック成立。
- **テスト件数増減**: 初回実装時点では Go ±0 / フロント ±0(後述のレビュー取り込みで Go +1 / フロント +1)。

### レビュー取り込み（m7-04-2-review.md、2026-06-03）

レビュー結果は **完了承認可**(重大問題なし)。推奨修正のうち優先度 高・中を取り込み:

- **(高)非リュウ作成パスの service テスト追加**: `service/combo/service_test.go` に `TestService_Create_NonRyu_CustomStatesCharacter_OK`。AKI(character_id=2)の技で `svc.Create()` → エラーなし + ID 付与 + recipe_cache が全プリセット分(presets 件数と一致)設定を検証。ComboEditor のキャラ選択 UI 非対応(閲覧のみ)の代わりに custom_states キャラの作成パス耐久を担保。
- **(中)migrate_test の custom_states JSON 妥当性**: `TestRun_SeedRowCounts` に `code IN ('aki','jamie') AND json_valid(custom_states)` = 2 のアサーション追加(従来は `IS NOT NULL` のみ)。
- **(中)CharacterSelector 複数キャラテスト**: `CharacterSelector.test.tsx` に 2 キャラ返却時 select が enabled になるテスト追加(MyComboPage のキャラ切替が依存する経路)。Radix Select のポータル特性上 onChange 実発火検証は既存方針どおり対象外とし enabled 確認に留めた。
- **(低・見送り)**`ComboDetailHeader` ロード中フォールバック文言の汎用化("リュウ"→`common.unknown` 等): レビューも将来対応評価。今回の変更は従来の無条件 "リュウ" 固定を動的化した上での短命ロードフォールバックで既存挙動より改善済みのため、i18n フォールバック整備はフェーズ2でまとめる。指摘1(`html_work`/`work_html` 表記差)は指示書側の記述ミスでコード変更不要(本ログに記録済み)。
- 取り込み後の再検証: `go test ./...` / `go vet ./...` / `pnpm exec tsc --noEmit` クリーン、`pnpm exec vitest run` **79 ファイル / 428 テスト**パス。**テスト件数: Go +1 / フロント +1**。

### 開発者への確認事項・依頼

- **実機目視依頼(NFR001)**: 各キャラ 12 件投入状態での検索・フィルタ・ソートの体感即時性(100ms)、プリセット切替の見た目。E2E シナリオ 1〜6 のうち画面目視部分。
- **`work_html/` は完了後に開発者が削除する一時フォルダ**(seed SQL 化済み、HTML 原本は不要)。
- **指示書の表記差異**: 指示書は HTML フォルダを `html_work/` と記載するが実体は `work_html/`。実体を使用した。
- **スキーマ変更は発生せず**(custom_states は既存 JSON 列に収まる)。CHANGE 通知書起票なし。

### 温存事項（次マイルストーン以降）

- 検証用リュウデータの全クリア(SUPP-001 §3.1 手順1) → M7-05。
- 残り 4 プリセットのエイリアス実データ整備 → フェーズ2。
- 他キャラのコンボ登録 UI(ComboEditor のキャラ選択化)/ custom_states 表示 UI / キャラ固有技名のプリセット本格再設計 → フェーズ2+。

---

## M7-05: 系統 F リファクタ/バグ修正/クリーンアップ + 系統 G 統合 E2E + フェーズ 1 完了判定（2026-06-05 完了）

指示書 M7-05 v1.1.0。フェーズ 1 完了マイルストーンの最終サブマイルストーン。品質維持のため §0.1 の推奨ターン区切り（4 分割、各ターン末に開発者コミット）で実施。

### ターン 1: バグ修正（バグ#6 / E-3）

着手前確認（§3.2）で、両バグとも指示書の想定（バグ#5 と同型のバックエンド分岐欠落）と**真因レイヤが異なる**ことを特定（§9.1 のとおり症状から決めつけず確認）。

- **バグ#6（VAL-S02 セットプレイ登録）= フロント修正**: バックエンド `setup/handler.go` の `CreateSetup` は既に `result.HasError() → 400 + details.validations` 分岐を持ち正しかった。真因は `SetupEditorPage` の登録経路に `onError` がなく VAL-S02 を表示していなかったこと。`features/setup/errors.ts`（`parseSetupApiError`、combo の `parseComboApiError` と同型）を新設、`setupApi` の create/update を構造化エラー（`ApiError` + `details.validations`）対応に、`SetupEditorPage` の create/edit 両経路に `onError` を追加し既存 `ValidationDisplay` で全幅表示（architecture-patterns §3.1 踏襲）。
- **E-3（マイコンボ件数キャラ追従）= バックエンド+フロント（スキーマ変更なし）**: `tag` の usage_count 集計（`repository.go listWithUsage`）に任意 `characterID` を追加。フィルタは LEFT JOIN の ON 句に置き `COUNT(c.id)`（紐付け 0 件のタグも count 0 で残す / nil 時は従来どおり全集計）。`service.ListTags` / `tag handler`（character_id クエリ、不正値 400）/ フロント `tagApi.list` / `useMyComboStatusCounts(characterId)` / `MyComboPage` を連携。
- 回帰テスト追加: setup `errors.test.ts`(4) / `setupApi.test.ts`(400 分岐) / `SetupEditorPage.test.tsx`(VAL-S02 全幅表示) / tag `repository_test.go`(キャラ別集計) / tag `handler_test.go`(character_id 貫通 + 400) / `useMyComboStatusCounts.test.ts`(クエリ付与)。

### ターン 2: クリーンアップ（window.confirm / i18n）

- **window.confirm 全 3 件 → AlertDialog**: `ComboListPage:62` / `ComboDetailPage:44` / `MyComboPage:156`（いずれもコンボ削除確認）を共通 `DeleteComboConfirm`（shadcn/ui AlertDialog、`common.delete`/`common.cancel` 使用）に置換。`grep -rn "window.confirm" web/src` 残存ゼロ（コメント 2 行のみ）。
- **i18n クリーンアップ**: `comboList.sort` の到達不能 camelCase キー 5 件（`starterStatus`/`updatedAt`/`starterMoveId`/`driveGauge`/`saGauge`、`SORT_FIELD_LABELS` に置換され未参照）を ja/en 削除。C-1: `common.unknown` を新設し `ComboDetailHeader` のキャラ名フォールバックを `comboDetail.characterRyu` → `common.unknown` に汎用化、orphan 化した `comboDetail.characterRyu` も削除。英語ロケール整備はフェーズ 3 送り（未着手が正）。`comboList.characterRyu`（E-2 リュウ固定ラベル）は据え置き。

### ターン 3: リファクタ（L-02 / L-03 / L-04、M-1〜M-4 はフェーズ 2/3 送り）

- **L-02（エラーコード lower_snake 統一）**: `INVALID_TAG_ID`/`INVALID_QUERY_PARAM`(combo)、`INVALID_GAME_ID`/`INTERNAL_ERROR`(character)、`TAG_NAME_EMPTY`/`TAG_NAME_DUPLICATE`/`TAG_IN_USE`(tag) を lower_snake へ。不正形式コード `"combo is not in trash"`（空白入り）→ `combo_not_in_trash`。**DES-006 改訂なし**（DES-006 が規定するのは `VAL-*` バリデーションコードであり HTTP `error.code` は規定対象外）→ CHANGE 不要。フロント依存は `useTagFormDialog`（`tag_name_duplicate`）の 1 件のみ、テストと共に同期。
- **L-03（ハンドラエラーヘルパ統一）**: `model.NewAPIError(code, message)` / `model.NewAPIErrorWithDetails(code, message, details)` を shared な model 層の正準コンストラクタとして新設し、各パッケージ独自の散在ヘルパ（`comboErrResp`/`comboErrCode`/`charErrResp`/`errResp`/`errRespDetail`）を全削除して combo/character/tag/setup を集約。**判断メモ**: architecture-patterns §3 は「直接 `model.APIErrorResponse{...}` を書き独自ヘルパを増やさない」を推奨。約 70 箇所の純インライン化は冗長・高リスクと判断し、model 型に属する単一コンストラクタへ集約した（per-handler ヘルパの不統一 = L-03 の本質を解消、churn 最小化）。
- **L-04（ポート競合フォールバック = 連番+1）**: `netutil.ListenAvailable(host, startPort, maxAttempts)`（連番探索でリスナ確保）+ `config.Save(path, cfg)`（アトミック TOML 書き戻し）を新設。`main.go` は bind/CORS 構築の前に実ポートを確定し、起動ログに常時記録 + **フォールバック発生時のみ** config.toml に記録、確保済みリスナを `e.Listener` に設定（echo v4.15.1 が非 nil 時に再 bind しないことをソース確認、二重 bind なし）。テスト: 空きポート採用 / 競合時フォールバック / 探索枯渇エラーの 3 ケース。

### ターン 4: 統合 E2E + スマホ LAN + リュウデータ全クリア + フェーズ 1 完了判定

- **統合 E2E 記録**: `docs/progress/m7-integration-e2e-results.md` を新設（M6-04 形式踏襲）。自動回帰（go test 全パス / pnpm 435 テスト / tsc クリーン / build OK / window.confirm・UPPER コード残存ゼロ）を製造担当が記入済み。系統 F（F-1〜F-5）/ 既存回帰（G-1〜G-9）/ M7 横断（shadcn/ui・3 段階レスポンシブ・複数キャラ・R-2/R-3 再確認）/ スマホ LAN（U-1）の手動シナリオは開発者記入。
- **スマホ LAN 検証手順**: U-1 として手順整備（開発者がホスト OS で LAN モード起動 → 実機アクセス）。
- **検証用リュウデータ全クリア**: `scripts/clear-validation-data.sql`（物理削除、§3.4-7 確定方式）を作成。**実行は開発者が統合 E2E 回帰確認の後**（指示書 §5.3）。全コンボ・セットプレイ + 依存行を削除しマスタ/タグ定義は保持。DB ファイル自体は削除せずスキーマ変更なし。
- **フェーズ 1 完了判定**: M7-overview §13 DoD で確認。「未実装 = 正」項目（ComboEditor キャラ選択 / custom_states 機能 / recipe_cache プリセット無効化 / プリセット管理 UI / 本格スマホ UI / i18n 英語）はバグ扱いせずフェーズ 2/3 送り確定として整理。

### スコープ・確定事項

- **構成**: 単一 M7-05 + Opus（開発者確定）。品質維持のため 4 ターン分割で実施。
- **M-1〜M-4**: §3.4-2 決定によりフェーズ 2/3 送り確定（recipeCache API 露出 / queryKey 形式統一 / useCheckDuplicate の TanStack 化 / SetupSummary 型集約 = 設計層・一部フェーズ 2 隣接の調査知見）。handover 素材に記録。
- **E-2（リュウ固定 UX）**: §3.4-8 決定によりフェーズ 3 送り（B-1 ComboEditor キャラ選択に起因）。
- **スキーマ変更なし** / CHANGE 起票なし。

### 検証

- `go test ./...` 全パス（23 パッケージ）、`go build ./...` OK、`go vet` クリーン。
- `pnpm run lint`（tsc）クリーン、`pnpm test --run` **80 ファイル / 435 テスト**パス（M7-04-2 比 +7）。

### 開発者への依頼事項

1. 各ターン末のコミット（製造担当は Git 操作不可）。
2. `m7-integration-e2e-results.md` の手動 UI / レスポンシブ / スマホ LAN 部分の実機検証・結果記入。
3. **統合 E2E 回帰確認の後** に `scripts/clear-validation-data.sql` を実行（破壊的操作、事前バックアップ推奨）。
4. `web/prototypes/` の削除（M7 完了承認後、開発者作業）。

### handover 作成（設計担当作業）

- `m7-to-phase2-handover.md` は設計担当が M7-05 完了承認時に作成。製造担当は素材整理まで。フェーズ 2/3 送り確定項目: M-1〜M-4 / E-2 / B-1（ComboEditor キャラ選択）/ B-2・B-3 / custom_states 消費・表示 / recipe_cache プリセット無効化 / プリセット管理 UI / 本格スマホ UI / i18n 英語ロケール / 残り 4 プリセットのエイリアス実データ整備。

### レビュー取り込み（m7-05-review.md、2026-06-05）

レビュー結果は **完了承認可**（重大問題なし、フェーズ 1 完了を妨げる事項なし）。レビュー側でも `go test ./...`（23pkg）/ `vitest run`（80 ファイル 435 テスト）/ `tsc --noEmit` 全パス、window.confirm・UPPER_SNAKE 残存ゼロを裏取り済み。指摘は軽微のみ。取り込み判断:

- **(中〜低・取り込み)`config.Save` の env override 巻き戻し**: `Load` が `applyEnvOverrides`（`COMBOMGR_LOG_LEVEL`→`Logging.Level`）適用後の `cfg` を返すため、ポートフォールバック時の `config.Save(configPath, cfg)` が env 上書き済みログレベルを config.toml に焼き付けるエッジケース。`config.PersistPort(path, port)` を新設し、**ディスク内容を起点に**（`Default()` + ファイル decode、env override 非適用）port のみ更新して `Save` する方式に変更。`main.go` のフォールバック保存を差し替え（実行時 `cfg.Server.Port` 代入は bind/CORS/configService 用に維持）。回帰テスト 2 件追加（env override 非永続化 / ファイル不在時のデフォルト生成）。`go test ./...` 全パス。
- **(中・設計担当確認に回す)L-03 実装方式**: `model.NewAPIError`/`NewAPIErrorWithDetails` への集約がチェックリスト文言「独自ヘルパを増やさない／直接呼出に統一」と表面上ずれる点。レビューも「実装として許容範囲」。約 70 箇所の純インライン化は churn 大・回帰リスクのため現状維持とし、architecture-patterns §3 の意図適合は設計担当確認に委ねる（progress-log の判断メモ + レビュー所見を根拠提示）。開発者確定（2026-06-05）。
- **(低・見送り)** 指摘2（`config.Save` の TOML コメント/整形喪失、AST 保存ライタ要・大改修）、指摘3（`requestSetupJSON` が `fetchJSON` を部分再実装、combo 側との共通基盤化）はフェーズ 2/3 のリファクタ機会に検討（レビューも「低/将来・今回スコープ許容」）。

### 追加対応: L-04 dev proxy 追従（開発者検証で顕在化、2026-06-05）

開発者の F-5（ポート競合フォールバック）検証で、**Go 側は 47319 へ正しくフォールバック・config.toml も更新されたが、`pnpm run dev` でフロントの API 呼び出しがエラー**になる事象を確認。

- **真因**: `web/vite.config.ts` の dev proxy target が `http://localhost:47318` にハードコードされており、L-04 フォールバックポート（47319）に追従しない。フロントは `api-client.ts` の `API_BASE=""` で開発時すべての `/api/*` を Vite proxy 経由でバックエンドへ転送する設計。かつ**フロントは Go に embed/配信されていない**（embed は `migrations/*.sql` のみ）ため、開発時は proxy に完全依存しており不整合が顕在化した。**Go 側 L-04 + `PersistPort` は正常**（config.toml = `port=47319` / `logging.level="info"` で env 焼き付きなし、を裏取り）。
- **影響範囲**: 開発時（`pnpm run dev`）のみ。`go test` / `pnpm test`(vitest) は fetch モックのため無関係。本番の同一オリジン配信（フロント embed = 未実装）が実現すれば本事象は発生しない。
- **対応（開発者承認: config.toml 自動追従）**: `vite.config.ts` の proxy target を `resolveApiTarget()` 化。優先順位 = `VITE_API_TARGET`（完全URL）> `VITE_API_PORT` > **リポジトリルート `config.toml` の `[server].port`**（L-04 が実ポートを書くため自動追従）> 既定 `47318`。`config.toml` 不在・読取失敗は既定にフォールバック（try/catch、新規依存なし・簡易 regex）。`api-client.ts` の古いコメントも実態に更新。
- **検証**: 現 `config.toml`(`port=47319`) で resolver が `http://localhost:47319` を返すことを確認。`tsc --noEmit` クリーン、`pnpm test --run` 80 ファイル 435 テストパス（vite.config を読む vitest も正常）。dev サーバ再起動で proxy が実ポートへ転送される。
- **設計担当への連携事項**: フロント embed（同一オリジン配信）が未実装のため、現状フェーズ 1 は「Vite dev server + Go API の 2 プロセス + proxy」構成で動作する。SUPP-001/DES の「Go embed 単一バイナリ配布」は未達。embed 実装時に本 dev proxy 追従は不要になる。`m7-integration-e2e-results.md` F-5 手順は embed 前提の記述（`http://localhost:<actual_port>/`）であり、現 dev 構成（`http://localhost:5173/` + proxy 追従）とは異なる点に留意（手順追記は開発者判断で見送り）。

---

## M7-06: フロント embed + 単一バイナリ成立 + 配布構成でのスマホ LAN 実機検証（2026-06-06 実装）

指示書 M7-06 v1.0.0。フェーズ 1 完了の最終サブマイルストーン。M7-05 F-5 で判明したフロント embed 未実装（単一バイナリ未成立）への対応。DES-002 §5.1/§11 + NFR303/304 の配布アーキテクチャの**実装（設計準拠）= CHANGE 不要・スキーマ変更なし**。

### Plan Mode 確定事項（開発者回答 2026-06-06）

1. **dev/embed 両立 = build タグ `embed_web` で分離**（既存 `-tags=debug` と同 idiom）。配布ビルドのみ embed 有効、dev/test は web/dist 不要。
2. **クロスビルド = ホスト OS 起動・配信確認 + Makefile クロスビルドターゲット**（Windows 公式 / macOS・Linux 非公式のビルド成立確認まで）。GitHub Actions CI はスコープ外（§10 軽微）。
3. **README.txt = 最小限を作成**（配布物構成の雛形）。

> 背景: `web/dist` は `.gitignore` で完全に無視され追跡ファイルゼロのため、素朴な `//go:embed web/dist` は clean checkout で `go build`/`test`/`run` を壊す。build タグで dev/test を stub FS に分離することで開発フローを破綻させずに embed を両立した。

### 実装内容

- **embed 宣言（build タグ分離）**: ルートに `embed_web_release.go`（`//go:build embed_web` + `//go:embed all:web/dist`、`WebFS()`/`WebEmbedded=true`）と `embed_web_stub.go`（`//go:build !embed_web`、`WebEmbedded=false`）を新設。`embed_migrations.go` と同じくルート配置（`//go:embed` は `..` 不可）。両ファイル冒頭に dev/embed の区別を明記。
- **SPA 静的配信ハンドラ**: `internal/api/static/handler.go` を新設。catch-all `/*`(GET/HEAD) で、(1) `/api`・`/api/*` は即 404（**SPA フォールバックに API を飲ませない最重要対策**。未登録 API パスでも index.html を返さない）、(2) 実体ファイルは `http.ServeContent` で配信（`/assets/` = `public, max-age=31536000, immutable`、フィンガープリント付き）、(3) `/assets/` の欠落は 404、(4) その他未知パスは `index.html` を `no-cache` で返す（React Router 直 URL/リロード/共有リンク対応）。テスト `handler_test.go` を `fstest.MapFS` で 9 ケース（GET: ルート/クライアントルート/API 非干渉/未登録 API 404/アセット immutable+MIME/欠落アセット 404、HEAD: アセット ヘッダのみ・ボディ空/クライアントルート フォールバック/未登録 API 404）。build タグ不要で常時実行。
- **main.go 配線**: API ルート登録の**後**に `if combomgr.WebEmbedded { staticapi.Register(e, webFS); launchBrowser(actualPort) }`。**ブラウザ自動起動**（NFR303/304）は `github.com/pkg/browser` で実ポートを開き、失敗時も `slog.Warn` + 案内 URL を必ずログ出力（利用者は L-04 で変わった実ポートを知らないため）。dev（embed なし）では登録せず Vite 配信を維持。
- **同一オリジン / CORS 両立**: `api-client.ts`（`API_BASE=""`）は embed 同一オリジン・dev proxy の両方で成立済みのため**変更なし**。CORS ミドルウェアは header 付与のみ・ワイルドカードなしで同一オリジンに無害のため**変更なし**。
- **Makefile**: `build` を `-tags=embed_web` 化（pnpm build 先行で dist 保証）。`build-windows`(amd64 公式)/`build-darwin`(arm64)/`build-linux`(amd64)/`build-all` を追加（`GOOS/GOARCH` + `CGO_ENABLED=0`、出力先 `dist/`=gitignore 済み）。`build-debug` は据え置き。
- **配布物 README.txt**（ルート新設）: 起動方法・ブラウザ自動起動/実ポート案内・LAN モード設定・データ保存先・注意事項。
- **ドキュメント整合**: `m7-integration-e2e-results.md` F-5 を配布構成（単一バイナリ起動 + 実ポート直アクセス + ブラウザ自動起動確認）に整合（M7-05 Q3 保留分の解消）。

### 依存追加

- **`github.com/pkg/browser`**: DES-002 §11.1 で指定済み（設計承認済み）。ライセンス BSD-2-Clause（許可リスト適合）。ブラウザ自動起動（NFR303/304）に使用。devContainer firewall でのモジュール取得は proxy 経由で成立（追加設定不要）。

### 検証

- `go test ./...` 全パス（static 含む）、タグなし `go build ./cmd/combomgr` が web/dist 不在でも成功（stub）、`go vet` クリーン。
- `pnpm build`（1950 modules）→ `go build -tags=embed_web` で 18MB 単一バイナリ生成。クロスビルド windows/amd64・darwin/arm64・linux/amd64 いずれもコンパイル成立。
- 単一バイナリ起動 + curl スモーク全合格: `GET /`→200/no-cache/html、`/combos/123`→200 index.html フォールバック、`/api/health`→200 JSON（index.html を返さない）、`/api/does-not-exist`→404、`/assets/<hash>.js`→200/immutable/`text/javascript`、`/assets/missing.js`→404、`/api/config`→200。ブラウザ自動起動ログ（INFO 案内 URL + 環境非対応時 WARN フォールバック）を確認。
- dev 構成（Vite + proxy）は変更なしで継続動作。

### 開発者への依頼事項

1. 変更のコミット（製造担当は Git 操作不可）。
2. **配布構成でのスマホ LAN 実機検証**（DES-002 §14）: ホスト OS で `make build` → `./combomgr`（LAN モード: config.toml `[server].mode="lan"`）を実行 → LAN 内スマホ実機から表示される LAN IP URL（`http://192.168.x.x:<actual_port>/`）にアクセスし主要機能（コンボ一覧/詳細/編集/タグ/設定）を確認。結果を `m7-integration-e2e-results.md`（F-5 / U-1）に記入。
3. ホスト OS での配布構成スモーク（PC ブラウザ全機能）の最終確認。

### フェーズ 1 完了判定 + handover（設計担当作業）

- M7-06 完了をもって設計担当がフェーズ 1 完了判定（M7-overview §13 DoD + embed/単一バイナリ成立 + 配布構成 LAN 検証）を実施し `m7-to-phase2-handover.md` を作成（製造担当スコープ外）。

### レビュー取り込み（m7-06-review.md、2026-06-06）

レビュー結果は **完了承認可**（重大問題なし、フェーズ 1 完了を妨げる事項なし）。SPA フォールバックの /api 二重保護・build タグ分離・起動 UX が設計準拠と評価。指摘は軽微/情報のみ。取り込み判断:

- **(情報-4・取り込み)README.txt データ保存先の正確化**: 「実行ファイル付近」表現が実装と不整合。`db.ResolveDBPath`（`Database.Path` 空時）は DB を **OS アプリデータディレクトリ**（Windows `%APPDATA%\combomgr\`、macOS `~/Library/Application Support/combomgr/`、Linux `~/.local/share/combomgr/`、DES-002 §6.1 準拠）に置く。一方 config.toml / logs は起動時カレントディレクトリ。README をこの実態（DB の OS 別パス + バックアップ対象 = combomgr.db）に修正。
- **(軽微-1・取り込み)HEAD テスト追加**: `e.HEAD("/*")` 登録の意図を明示するテストを 3 件追加（アセット=ヘッダのみ・ボディ空 / クライアントルート フォールバック 200 / 未登録 API 404）。static テストは 6→9 ケース。
- **(軽微-2・取り込み)progress-log テストケース数の整合**: 上記 HEAD 追加に伴い記述を実数（9 ケース）に修正。
- **(軽微-3・見送り)pkg/browser の更新日付**: `v0.0.0-20240102...` は 2 年超だが DES-002 §11.1 で明示指定・設計承認済みのため採用は正当（レビューも明記）。コード変更なし。**後続フェーズの依存ライブラリ棚卸し時に代替検討**のメモとして残す。
- **(情報-5・対応不要)build-debug が embed_web 非含**: 意図的（本節「据え置き」明記済み）。将来 debug を配布構成で使う場合のみターゲット追加。

`go test ./internal/api/static/`（9 ケース）/ `go test ./...` 全パスを再確認。

### 配布構成 E2E バグ修正: Windows での起動失敗（2026-06-06、開発者ホスト OS 検証で顕在化）

開発者がホスト OS（Windows）で `combomgr.exe` をビルド・実行したところ、起動時に
`fatal: migration: migration: new instance: failed to open database: parse "sqlite://C:\Users\...\combomgr.db": invalid port ":\Users\..." after host` で**起動不能**となった。配布構成（単一バイナリ起動）の DoD を直接妨げる不具合のため M7-06 内で修正（スキーマ変更なし・配信層/起動層の修正）。

- **真因 1（URL パース）**: `internal/infra/migration/migrate.go` が DSN を `"sqlite://" + dbPath` で構築していた。golang-migrate の sqlite ドライバは内部で `net/url.Parse` するため、Windows の絶対パス（`C:\Users\...`）が「ホスト `C` + 不正ポート `:\Users...`」と解釈されて失敗。Linux の絶対パス（`/home/...`）は `//` 直後がスラッシュで偶然成立していたため未顕在だった（プラットフォーム依存）。
- **真因 2（親ディレクトリ不在）**: マイグレーションは `main.go` の `db.Open`（`MkdirAll` で親作成）**より前**に走る。初回起動の Windows では `%APPDATA%\combomgr\` が未作成のため、真因 1 を直しても次に DB ファイル作成で失敗する潜在不具合があった。
- **対応**: `migration.Run` を (a) `os.MkdirAll(filepath.Dir(dbPath))` で親ディレクトリ作成、(b) `sql.Open("sqlite", dbPath)`（生パス）+ `sqlite.WithInstance(db, ...)` + `migrate.NewWithInstance(...)` に変更し **URL パースを完全に回避**（クロスプラットフォームでパス非依存）。マイグレーション時の DB 接続は旧ドライバ挙動と同じく PRAGMA 非適用（FK オフ）を維持し、マイグレーション意味論を変えない。`m.Close()` が source/driver(+内部 *sql.DB) を閉じるため二重 Close なし。
- **テスト**: `TestRun_CreatesMissingParentDir`（未作成のネストディレクトリでも成功）を追加。既存マイグレーションテスト群 + `go test ./...` 全パス。embed 単一バイナリをローカル（Linux）で再ビルド・起動し、`WithInstance` 経路で migration 完了 → `/api/health` 200 を確認。
- **開発者への依頼**: ホスト OS（Windows）で `combomgr.exe` を**再ビルド**（`make build` 相当 = `pnpm build` → `go build -tags=embed_web`、またはクロスビルド `make build-windows`）の上、起動・スマホ LAN 実機検証を再実施。

### 配布構成 E2E: スマホ LAN アクセス不可 = ファイアウォール/ウイルス対策ソフト起因（2026-06-06、開発者ホスト OS 検証で確定・解消）

Windows で `combomgr.exe` 起動・PC アクセスは成功するが、**スマホからの LAN アクセスが QR・直接 URL とも失敗し、接続試行時にサーバーログが出ない**事象。

- **診断**: `config.toml` は `mode="lan"`（= `0.0.0.0` bind）かつ `localhost:47318` は表示可。だが**PC 自身のブラウザでも `http://<LAN-IP>:47318/` が開けず**、Windows ファイアウォール許可ダイアログも未表示。ログ順は `Logger`→`CORS` で、届けばログは出るはず → **TCP がアプリに届く前に遮断**。`localhost`（ループバック）は FW 対象外で通り LAN IP 宛 inbound が遮断、という典型像から **inbound ブロック**と確定。
- **根本原因（解消済み）**: ファイアウォール/ウイルス対策ソフトによる inbound 遮断。**開発者環境では Norton が Windows 標準ファイアウォールを代替して制御しており、Windows 側設定では解決せず、Norton 側で許可して接続成立**。
- **恒久対応（コード/ドキュメント、製造担当）**:
  - `cmd/combomgr/main.go`: lan モード起動時に `logLANAccessGuide(port)` を追加。`netutil.ListPrivateIPv4` で**検出した全プライベート IP を URL 列挙**（有線/無線複数環境で利用者が正しい IP を選べる）+ 「接続不可時は Windows FW（プライベート）を許可、サードパーティ AV（例 Norton）が制御している場合はそちらで許可」のヒントを出力。
  - `README.txt`: 「スマホから接続できないとき(トラブルシューティング)」節を追加。①FW/AV 許可（GUI / `netsh` / **サードパーティ AV が Windows FW を無効化し代替制御するケースの明記。製品ごとに設定が異なり本アプリでは保証外**）②PC 自身で LAN IP を開けるか + `ipconfig` で IP 一致確認 ③同一ネットワーク/AP アイソレーション。
- **対応しない**: ホストの FW/AV 設定をアプリから自動変更しない（要管理者・CLAUDE.md §10）。案内とログ改善に留める。スキーマ変更なし。
- **検証**: ローカル（Linux/コンテナ）lan モード起動で新ログ（全 IP 列挙 + FW/AV ヒント）出力を確認。`go test ./...` 全パス。開発者ホスト OS で Norton 許可後にスマホ実機アクセス・全機能操作成功を確認（U-1 実機）。

### 追補 A-1 / A-2: embed/配布 UX 積み残し2件（2026-06-07、指示書 `M7-06-..._append.md`）

設計書定義済み要件の実装（CHANGE 不要・スキーマ変更なし）。

- **A-2（設定画面 LAN 共有モード切替トグル、DES-005 §16 / DES-002 §3.4）**: 後から LAN 化するのに config.toml 手編集が必要だった点を解消。
  - `web/src/features/config/SettingsSectionNetwork.tsx`: `@/components/ui/switch` のトグルを追加。`useUpdateConfig`（ウィザード `WizardPage.tsx` と同一経路で `server.mode` 永続化）+ `sonner` トースト。**LAN 有効化時のみ確認ダイアログ**（DES-002 §3.4「LAN 共有モードへの切替操作時にのみ」）、無効化（local 化）は露出減のため即時適用。成功時 `restartRequired` トースト（既存挙動踏襲）。
  - 新規 `LanModeConfirmDialog.tsx`（`PutConfirmDialog` 踏襲の AlertDialog）: ポート番号 + 「このポートが外部に公開されていないことを念のためご確認ください」+ LAN IP は再起動後確定の旨。i18n キー `settings.network.{shareMode,enableConfirmTitle,enableConfirmBody({{port}}),enableConfirmAction}` を ja/en に追加。restartRequired/validationError は既存キー再利用。
  - **バックエンド変更なし**（PUT /api/config は mode 受理・restartRequired 返却済み）。
  - 補足: local→lan の確認時点では LAN IP 未確定（`resolveNetwork` は lan 時のみ IP 返却）。ダイアログはポートを明示し IP は再起動後にネットワーク欄/起動案内で表示、とした。
  - テスト `SettingsSectionNetwork.test.tsx`（4 ケース）: ON で確認ダイアログ表示・即時 mutate なし / 確認で `{server:{mode:"lan"}}` / 取消で mutate なし / lan 時 OFF で確認なし `{server:{mode:"local"}}`。
- **A-1（起動時案内を stdout にも出す、NFR303/304・DES-002 §3.4「起動時にバインドアドレスを標準出力ログに明示」）**: アクセス URL・FW/AV ヒントが slog(info) でファイルのみだった点を解消。
  - `cmd/combomgr/main.go`: 新規 `printStartupNotice(w io.Writer, mode, port, lanIPs)` を **level 非依存で stdout 出力**（運用ログでも debug でもない CLI UX 出力、専用命名関数。CLAUDE.md §10 の `fmt.Println` 禁止は散発デバッグ出力残留防止の趣旨で意図的起動案内は対象外、と整理）。内容 = PC URL（localhost:実ポート、L-04 追従）/ lan 時は検出 IP の LAN URL 一覧 + FW・サードパーティ AV（Norton 等）許可ヒント。`WebEmbedded` 配布バイナリのみ（`launchBrowser` と同 gating、dev は対象外）。既存 slog ファイルログ（`logLANAccessGuide`/`launchBrowser`）は記録として維持（二重持ち）。
  - テスト `cmd/combomgr/main_test.go`（3 ケース）: local で PC URL のみ・LAN/FW 行なし / lan で渡した全 IP の URL + FW・Norton ヒント / lan で IP 未検出時のメッセージ。
- **ドキュメント**: `README.txt` の LAN 節を「方法 A: 設定画面トグル（推奨）/ 方法 B: config.toml 編集」に更新。
- **検証**: `go test ./...` / `go vet`（両タグ）/ `pnpm test`（全パス）/ `pnpm lint`(tsc)。embed ビルドで local/lan 起動の stdout 案内出力を確認（実ポート追従）。dev 構成は stdout 案内なしで継続動作。
- **設計反映（設計担当）**: SUPP-001 §5.6 に「起動時ユーザー向け案内は level 非依存で stdout（ログとは別カテゴリの CLI UX）」を後日追記予定（製造側は実装と本記録まで）。
- **完了後**: 配布構成で「設定トグルで LAN 化 → 再起動 → スマホ実機接続」の再確認は開発者最終確認に回す（コンテナ制約のため製造担当はユニット/ビルド確認まで）。

---

## フェーズ 2

### M8-01: moves フレームデータ列追加マイグレーション（8列）+ model / DTO / GET 反映（2026-06-12、指示書 `M8-01-moves-frame-columns-migration.md` v1.1.0）

CHANGE-022 v0.3.0 / CHANGE-025 で確定した moves 8列（`startup` / `active` / `total` / `on_hit` / `on_block` / `drive_gauge_decrease_guard` / `is_aerial` / `setup_only`）を DES-003 v1.17.0 §3.3 に従い加算的に追加。M8 はフェーズ2のゲートで後続 M9/M10 が本スキーマに依存する。`total` 算出・`properties` 正規化・CSV 取込・画面表示はスコープ外（M9 以降）。

- **実装サマリ**:
  - マイグレーション新規1組: `migrations/000013_add_moves_frame_columns.{up,down}.sql`。NULL 可6列は DEFAULT なしの単純 ADD COLUMN（既存行 NULL）、bool 2列は `INTEGER NOT NULL DEFAULT 0`（既存行 0/false 補完）。一時 DEFAULT・backfill なし（CHANGE-025、seed は M9 で再生成）。down は `DROP COLUMN`（逆順）。
  - Go モデル `internal/model/move.go`: 8フィールド追加。NULL 可6列は `*int`（既存パターン踏襲、`json:",omitempty"` camelCase）、bool 2列は `bool`（omitempty なし）。※`model.Move` は現状どこからもスキャン/構築されていないが指示書 §4.2 の明示要求で仕様整合のため追加。
  - リポジトリ `internal/repository/move/`: `listByCharacterSQL` の SELECT に8列追加、`MoveListItem` に8フィールド追加。NULL 可列は `sql.NullInt64`→`*int` 変換ヘルパ `nullInt64ToIntPtr` を新設、bool は NOT NULL のため直接 `&item.IsAerial` でスキャン（modernc が 0/1 INTEGER→bool を変換、問題なし）。
  - DTO `internal/api/move/dto.go`: `MoveResponse` に8フィールド追加 + `toMoveResponse` マッピング追加。レスポンスは追加のみ（既存フィールドの削除・改名・型変更なし）。
  - フロント型 `web/src/features/moves/types.ts`: `Move` interface に8フィールド追加（camelCase、NULL 可は `?: number | null`、bool は必須 `boolean`）。表示の追加なし（型の器のみ）。
  - 既存テスト追従: `isAerial`/`setupOnly` を必須 boolean としたため、Move を構築する既存テストフィクスチャ3件（`DuplicateRealtimeWarning.test.tsx` / `ModifiersEditor.test.tsx` / `VirtualController.test.tsx`）に `isAerial: false, setupOnly: false` を追加（型整合のための必須追従、挙動変更なし）。
- **§3.4 Plan Mode 着手前確認の結果**:
  - 次マイグレーション番号 = `000013`（最新 `000012`、想定どおり）。
  - 既存 moves スキーマに8列は未追加、DES-003 §3.3 と一致。
  - 既存 seed 行は nullable ADD COLUMN で NULL 存続、bool は DEFAULT 0。backfill 不要。
  - NULL 表現は既存方式（Go `*int`+omitempty、TS `?: number | null`）に揃えた。
  - `DROP COLUMN` は migration 000008（CHANGE-019）で実績あり = SQLite 3.35+ 確認、down.sql で使用可。
- **開発者への確認と実装判断**:
  - BOOLEAN 列の物理宣言を `INTEGER NOT NULL DEFAULT 0 -- BOOLEAN`（既存 `combos.is_draft` / `presets.is_builtin` と同慣習）とするか、指示書 §4.1 / DES-003 表記の `BOOLEAN ... DEFAULT false` とするかを質問 → **開発者回答: 既存慣習の `INTEGER ... DEFAULT 0`**。SQLite では両者機能的に等価だが、init_schema の方針（「BOOLEAN は INTEGER(0/1)」）と一貫させた。
  - down.sql 方式 = `DROP COLUMN`（テーブル再構築不要）。
  - DTO/モデルの NULL 表現 = 既存ポインタ方式（`*int` + omitempty）。
- **エンドポイントの差異（記録）**: 指示書は `GET /api/characters/{id}/moves` と記すが、実装は `GET /api/moves?character_id=N`（`internal/api/move/handler.go`）。論理的に同一の「キャラ別技一覧」であり、この実エンドポイントのレスポンスへ8フィールドを反映した。
- **自己テスト結果（§5.1 / §7.2）**:
  - `internal/infra/migration/migrate_test.go` に `TestRun_MovesFrameColumnsExist` を追加（up 適用後8列存在 + 既存 seed 行が NULL/0 補完）。
  - up/down 往復は一時テスト（golang-migrate `Steps(-1)`→`Steps(1)`）で down が8列を除去し既存列を保持・再 up で復元することを確認後、当該一時テストは削除。
  - `go test ./...` 全パス。`pnpm exec vitest run` = 81 ファイル / 439 テスト全パス。`pnpm tsc --noEmit` クリーン。
- **§5.2 実機確認（開発者責任範囲）**: シナリオA（コンボ一覧→詳細→編集の既存非破壊）はコンテナ制約のため開発者の最終確認に委ねる。製造担当はユニット/型/ビルド確認まで。
- **既知の制限**: 8列は値投入なし（既存 seed 行は新列 NULL / bool false）。実データ投入・`total` 算出・`properties` 正規化は M9 取込パイプラインで対応。

#### レビュー取り込み（`docs/progress/m8-01-review.md`、2026-06-12）

レビュー判定は **合格**（§9 重大指摘 0 件）。設計準拠性・API 整合性・スコープ規律はいずれも ◎ 評価。残る指摘は **テスト網羅の軽微 2 件（中）** のみで、回帰テストとして恒久化した。

- **（中・取り込み）down ロールバックの恒久テスト追加**: up/down 往復は実装時に一時テストで確認後に削除しており回帰テストが残っていなかった。`internal/infra/migration/migrate_test.go` に `TestRun_MovesFrameColumnsDownRollback` を新設。本番 `migration.Run` は Up のみのため、テスト内で golang-migrate インスタンスを直接構築（`iofs.New` + `sqlitemig.WithInstance` + `migrate.NewWithInstance`）し、`Up()`→8列存在→`Steps(-1)`→8列が `PRAGMA table_info` で消失 + 無関係列（`id`/`character_id`/`code`/`category`/`damage`/`properties`）残存→`Steps(1)` で復元、を検証。
- **（中・取り込み）GET レスポンスの新フィールドを JSON レベルでアサート**: `internal/api/move/handler_test.go: TestHandler_List_200` を拡張。レスポンスボディを `map[string]json.RawMessage` へ再デコードし、先頭アイテムに `isAerial`/`setupOnly`（常時出力の bool 2列）+ 既存キー `id`/`characterId`/`code`/`category` が存在することを確認。NULL 可6列は seed 行が全 NULL + omitempty のため JSON に現れないのが仕様どおりで、キー存在はアサートしない。
- **（低・非対応）チェックリスト v1.0.0 の陳腐化**（§1.1/§4.1 の `startup`/`total` = NOT NULL、§5 の暫定 DEFAULT 前提）: CHANGE-025 で撤回済み。**設計担当**がチェックリストを更新すべき事項で、本実装の判定には影響しない（実装側の変更なし）。
- **（低・非対応）指示書のエンドポイント表記**（`GET /api/characters/{id}/moves` → 実体 `GET /api/moves?character_id=N`）: レビュー §1.3 が既に**設計担当へ申し送り**済み。実装は実エンドポイントに正しく反映済みのため製造側の対応不要。
- **（低・非対応）Plan Mode 質問書ファイルの非永続化**: §7.5 が要求する開発者回答・実装判断は本ログ §開発者への確認 / §3.4 に統合済みで実害なし（レビューも明記）。対応不要。
- **検証**: `go test ./...` 全パス（新規2テスト含む）。フロント変更なしのため `pnpm` 系の再実行は不要。

---

## M8-02: Playwright E2E 基盤導入(2026-06-13)

### §3.4 Plan Mode 着手前確認の結果

| 確認項目 | 決定事項 |
|---------|---------|
| §3.4.1 spec 化対象 | `combo-crud.spec.ts` 1本(コンボ登録→詳細→編集→削除) |
| §3.4.2 testid 付与対象 | `combo-editor-draft-checkbox`(Radix Checkbox は labelable 非対応のため) |
| §3.4.3 webServer 起動方式 | dual webServer array + `reuseExistingServer: true`。`make e2e` 1コマンドで完結 |
| §3.4.4 DB 前提 | spec が自前でデータ作成・削除。seed 件数に非依存 |

### 導入内容

- **`@playwright/test` 1.60.0** を `web/` に追加。Chromium ダウンロード済み
- **`web/playwright.config.ts`**: `testDir: ./e2e`・`baseURL: http://localhost:5173`・dual `webServer`(backend 47318 + vite 5173・`reuseExistingServer: true`)・chromium プロジェクト
- **`web/e2e/combo-crud.spec.ts`**: 仮登録モードで seed 非依存の CRUD スモーク(登録→詳細確認→編集→削除)。1 テスト関数のシリアル実行
- **`web/e2e/tsconfig.json`**: playwright 型用の tsconfig(メイン tsconfig から除外済みの e2e ディレクトリ用)
- **`docs/design/testid-convention.md`**: test-id 命名規則・付与方針・付与済み一覧
- **`Makefile`**: `e2e` ターゲット追加(`cd web && pnpm e2e`)
- **`web/src/features/combo/components/ComboEditorBasicFields.tsx`**: `data-testid="combo-editor-draft-checkbox"` 付与(仮登録モード Radix Checkbox)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go test ./...` 全通過 | ✅ |
| `pnpm test -- --run` 全通過(81 ファイル / 439 テスト) | ✅ |
| 既存ユニットテスト非破壊 | ✅ |
| `make e2e` 実行確認 | ✅ (2026-06-13、1 passed / 3.9s) |

### §5.2 開発者ローカル実行確認

```
実行日: 2026-06-13
結果: PASS
備考: 1 passed (3.9s) — devContainer 再ビルド後にトラブルシューティング記録(下記問題3)の
      修正を適用して確認。
```

#### トラブルシューティング記録(2026-06-13)

開発者から `make e2e` が 30秒→60秒でタイムアウトする報告を受け原因調査・修正を実施した。

**問題1: webServer タイムアウト(30秒→60秒)**

- **根本原因**: L-04 ポートフォールバックにより、バックエンドが `config.toml` の
  `port = 47318` を起動時に 47319 に更新していた。一方 `playwright.config.ts` は
  `port: 47318` を固定値で持っていたため、バックエンドが 47319 でリッスンしているのに
  Playwright は 47318 を待ち続けてタイムアウト。
- **修正**: `resolveBackendPort()` を追加して起動時に `config.toml` から動的読取し
  (`vite.config.ts` の `resolveApiTarget()` と同パターン)、timeout を 30_000 → 60_000 に拡張。
  コミット `c2b13ca`。

**問題2: Chromium ブラウザ起動失敗**

- **根本原因**: devContainer の Dockerfile に Playwright の Chromium headless shell が
  必要とするシステムライブラリ(libnspr4 等 26 パッケージ)が含まれていなかった。
  webServer タイムアウトが解消されてブラウザ起動フェーズに到達したところで発覚。
  `chrome-headless-shell: error while loading shared libraries: libnspr4.so: cannot open shared object file`
- **修正**: `.devcontainer/Dockerfile` に Playwright ブラウザ依存パッケージを追加。
  コミット `9c1d353`。
- **対応が必要な開発者作業**: devContainer の**リビルド**が必要。
  VS Code コマンドパレットで「Dev Containers: Rebuild Container」を実行してから
  `make e2e` を再試行してください。

---

## M9-03: FR703 手動修正(moves 編集・ラッシュ版生成・編集グリッド)(2026-06-15、指示書 `M9-03-instruction.md` v1.0.2、CHANGE-032 反映)

### CHANGE-032 反映(設計書 DES-002 v1.17.0 / DES-005 v2.17.0、2026-06-15 取り込み)

Plan Mode 4 決定を設計書本体へ明文化した CHANGE-032 に追従し、以下を実装で確定した(初回実装 v1.0.1 時点から差分対応):

- **`GET /api/moves/:id` は全列 + 表示用 `name_ja`(official_ja_move エイリアス)を返す**。リポジトリ層に `MoveDetail`(`model.Move` 埋め込み + `NameJa`)を新設し、`getByIDSQL` に preset_aliases LEFT JOIN を追加。`model.Move` 自体には `name_ja` を持たせない(DES-004 §1.2 の設計を維持、§4.8 乖離ガードの前提も不変)。
- **`PATCH` / `rush-variant` は更新後/生成後のフル move(`MoveDetailResponse`、`nameJa` 含む)を返す**(in-place 同期)。
- **rush-variant 重複時は 409 + 既存 rush_variant の `existingId`** を返す(`RushConflictError`)。リポジトリは事前チェックで既存 id を取得し、生 UNIQUE 制約エラーを漏らさない。フロントは 409 をハードエラーにせず info トースト表示(既存行誘導)。
- **name_ja(エイリアス)編集はスコープ外**を踏襲(グリッドで表示のみ、`PATCH` に nameJa を含めない)。

### §3.4 Plan Mode 着手前確認の結果(開発者確定 2026-06-15)

1. **編集グリッドのフル項目取得(-1 関連)**: GET `/api/moves`(`MoveResponse`)が返さないフル項目(`combo_scaling` / `raw_data` 等)は、新規 **`GET /api/moves/:id`**(`MoveDetailResponse`)で取得。既存 `GET /api/moves` 契約は不変(§2.3 / §7.1 を遵守)。
2. **編集エンドポイントの形・楽観ロック(-2)**: `PATCH /api/moves/:id` はポインタ部分更新(nil=不変更、`PATCH /api/combos/:id` と同方式)。**楽観ロックは入れない**(moves に `version` 列がなく、ローカル単一ユーザー前提のマスタ編集のため)。マイグレーション追加なし(§2.3 のスキーマ不変方針を遵守)。
3. **ラッシュ版生成の対象判定・重複(-3)**: サーバ側で `category ∈ {normal, unique}` ∧ `is_aerial = false` を強制(違反は 400)。同一 `original_move_id` の `rush_variant` が既存なら **409 Conflict** で拒否(冪等性・データ重複防止)。
4. **notes 付記編集対象(-4)**: `raw_data.notes_tool`(`【ツール付記】`)のみ編集可。`notes`(原文)は表示のみ(CHANGE-030 のキー構造に従う)。
5. **検証強度(-5)**: 要確認状態(total NULL 等)のまま保存可(手動補正は段階的)。ただし `properties` の enum 値域・`combo_scaling`/`raw_data` の JSON 整形式違反は拒否(DES-006、§4.7)。total は手動入力値をそのまま保存(自動算術しない)。

### 先送り(将来マイルストーン)

- **§4.4 通常投げ補正の name_ja(preset_aliases)編集・並び補正は今回スコープ外**(開発者確定 2026-06-15、Plan Mode 質問3)。本マイルストーンの投げ補正は `is_aerial` トグル(`PATCH` 経由)のみ実装。エイリアス命名補正・並び補正は後続マイルストーンで対応する(実例: dhalsim `yoga_splash`)。`POST /api/moves/:id/rush-variant` 生成時のエイリアス派生は当初 repo 内でコピー生成していたが、指示書 v1.0.2 §4.4「preset_aliases 書込経路は本 MVP では作らない」に反するため、**レビュー取り込み #1 で削除**(下記)。rush_variant は `moves` 行のみ生成する。

### 実装メモ

- バックエンド: `internal/repository/move`(`GetByID` / `UpdateFields` 動的 SET / `InsertRushVariant` 自前 tx・重複 409)、新規 `internal/service/move`(検証 + rush 規則強制)、`internal/api/move`(`Get` / `Update` / `GenerateRushVariant` ハンドラ + `MoveDetailResponse` / `UpdateMoveRequest` DTO)、ルート 3 本追加、`main.go` で service 配線。
- **§4.8 乖離検出ガード**: `internal/repository/move/divergence_test.go` で reflection により `MoveListItem`(`NameJa` 除く)の全フィールドが `model.Move` に同名・同型で存在することを検証。GET 読取路の集約は行わず(M9-overview §3.9 の「フェーズ2 中は集約不要」に従う)、両 struct に相互参照コメントを追加。
- フロント: `MoveDetail` / `UpdateMoveRequest` 型、`useMoveDetail` / `useUpdateMove` / `useGenerateRushVariant`(invalidate 規約準拠)、`MoveEditGrid` + `MovesEditGridPage` + `/moves/edit` ルート、取込 commit 後の導線リンク。
- テスト: Go service 9 ケース / handler 6 ケース(新規分)/ divergence 1 ケース、Vitest `MoveEditGrid` 7 ケース、E2E `moves-edit.spec.ts`(編集→GET 反映→ラッシュ生成)。`go test ./...` 全パス、`pnpm test` 84 ファイル/458 テスト全パス、`make e2e` 3 spec(combo-crud / import-moves / moves-edit)全パス。

### レビュー取り込み(`docs/progress/m9-03-review.md`、2026-06-15)

総合判定: Plan Mode 5 決定におおむね忠実・合格。重大 1 件 + 中 1 件 + 低 3 件を**全件取り込み**(開発者決定 2026-06-15)。

- **[#1 重大] 取り込み**: ラッシュ版生成の `preset_aliases` 自動書込(`rush.go` の `sourceAliasSQL`/`rushAliasSuffix`/`UpsertOfficialJaAlias` 呼出)を**削除**。指示書 v1.0.2 §4.4「preset_aliases 書込経路は本 MVP では作らない」・チェックリスト §1.3 に反するスコープ違反だったため是正(name_ja は表示のみ=Plan Mode-Q3 と整合)。生成 rush_variant の `nameJa`=nil を回帰テストで担保。`UpsertOfficialJaAlias` は importer で継続使用のため残置。
- **[#2 中] 取り込み**: 未保存 `is_aerial` トグル中はラッシュ版ボタンを非活性化(`MoveEditGrid.tsx` の `isAerialDirty`)。サーバ永続値判定との 400 デシンクを防ぎ保存を促す(§4.3 の意図も満たす)。Vitest 回帰追加。
- **[#3 低] 取り込み**: `InsertRushVariant` の事前チェックを `(character_id, rush_code)` ベースへ統一。同 original の rush_variant 既存も別 move による rush コード占有も 409 + 既存 id に変換し、生 `UNIQUE(character_id, code)` 制約エラー(→500)を回避。handler テスト追加。
- **[#4 低] 取り込み**: properties 入力をフリーテキストから select 化(`MOVE_PROPERTY_VALUES` 6 値、`model.MoveProperty*` と同期)。許可値外の誤入力(保存時 400)を未然防止、現値が一覧外でも消失させない。
- **[#5 低] 取り込み**: `Header.tsx` の `NAV_LINKS` に「技編集」(`/moves/edit`)を追加し独立アクセス性を向上。
- **[ドキュメント懸念・低] 対応不要**: レビューが疑問視した `docs/design/02-architecture.md`/`05-screen-design.md` の差分は、開発者が CHANGE-032 反映として編集した内容を製造コミット `e557fe9` に同梱したもの。`03-data-model.md` は earlier `docs:` コミット由来。いずれも開発者(設計担当ロール)由来で、製造担当による DES 本体の創作・直接改変ではない(履歴改変はできず現状維持)。

## M9-02: FR704 アプリ側 CSV 取込(moves インポート)(2026-06-14、指示書 `M9-02-instruction.md` v1.0.3)

### §3.4 Plan Mode 着手前確認の結果(開発者確定 2026-06-14)

1. **model.Move 集約(-1/-2)**: GET 読取路(`listByCharacterSQL` / `MoveListItem` / `MoveResponse` DTO)は**一切変更せず**、取込 upsert を `model.Move` の初の構築箇所とした(全 20 列を書く)。GET 契約は不変。
2. **preset_aliases 投入経路(-3)**: 既存のランタイム upsert 経路は無かったため(seed 000006/000011 の CASE マッピングは migration 専用)、`move` リポジトリに `UpsertOfficialJaAlias`(キー `(preset_id, move_id)`)を新設。
3. **recovery parse(-4)**: `整数`→式適用、`全体 N`→total=N 直接、`着地後N`/`N+着地後M`/`※N`/未知/空→total=NULL + 要確認。
4. **ファイルサイズ上限(-6)**: 5,000 行/ファイル(`MaxImportRows`)。
5. **seed クリア方式(-7)**: 下記「重要決定」を参照。

### 重要決定: seed 破壊的クリアは M12-02 へ延期(2026-06-14)

- **発見**: `dbtest.Setup` が全マイグレを適用するため、`000014` で旧 seed(ryu 技群等)を DELETE すると、seed 済リュウ技に依存する既存テスト **13 ファイル/185 箇所**(combo/setup/tag/notation 等)が一斉に壊れる。M9-02 の DoD「既存 spec 通過」と矛盾する。
- **決定(開発者)**: M9-02 の `000014` は**加算のみ**(classic 5 体のうち未 seed の ken/ingrid/c_viper/dhalsim のキャラ名を追加)。旧 seed の破壊的クリア + 再投入(配布クリーン初期状態)は **M12-02 へ延期**(§4.9 が M12-02 整合を明記)。取込は既存 seed に upsert して機能する。
- **TODO(M12-02)**: 旧 seed(ryu/aki/jamie/guile の moves・preset_aliases・参照 combos/combo_steps/recipe_cache)の破壊的クリア + ツール CSV 取込による再投入。配布 DB クリーン初期状態の確定。

### 延期: 純粋入力ジャンプの seed 管理(2026-06-14)

- 実 CSV(classic 5 体)に `system` カテゴリの技は 1 件もなく、純粋入力ジャンプ(`jump_neutral`/`jump_forward`/`jump_back`)・基本ダッシュ・`drive_parry` 等は取込データに含まれない(公式 HTML 行なし)。§4.9 はこれらを seed 管理継続としているが、**後続マイルストーンへ延期**(開発者確定)。classic 5 体のキャラは取込技のみを持ち、純粋入力ジャンプは未投入。

### 設計書との差分(要確認・軽微)

- **`critical_art` enum 定数の欠落を補完**: `model.MoveCategoryCriticalArt = "critical_art"`(DES-003 §3.3 L285 enum・CHANGE-025 で定義済みだがコード未反映)をバックエンド `internal/model/move.go` に追加し、CLAUDE.md §4 の同期ルールに従いフロント `web/src/features/moves/types.ts`(`MoveCategory` union・`MOVE_CATEGORY_LABEL_JA`・`MOVE_CATEGORY_ORDER`)へ同期した。GET 契約(MoveResponse の公開フィールド)は不変。
- **取込キャラの表示名**: CSV にキャラ表示名が無いため、classic 5 体の正規名は `000014` seed で投入。`character` リポジトリの `UpsertByCode` は未 seed の `character_code` に対してのみ暫定表示名(code)で新規作成し、既存(seed 済)行の表示名は ON CONFLICT DO NOTHING で保持する。

### 実装内容

- バックエンド: `internal/repository/move`(UpsertMove・UpsertOfficialJaAlias 追加)、`internal/repository/character`(GameIDByCode・UpsertByCode 追加)、`internal/service/movesimport`(ParsePreview 共通ロジック + Commit 行単位 upsert)、`internal/api/movesimport`(preview/commit ハンドラ・ルート)、`cmd/combomgr/main.go` 配線、`migrations/000014_seed_characters_classic5`。
- フロント: `web/src/features/import`(types/api)、`web/src/pages/ImportMovesPage.tsx`、`router.tsx`・`Header.tsx`(技取込導線)。

### テスト結果(製造担当の自己テスト)

- **Go test**: `go test ./...` 全パス(26 パッケージ)。取込サービス単体(total 算出 7 ケース・properties 正規化 3・combo_scaling キー照合 6・critical_art 写像・notes パース 3・検出エラー 2・ヘッダ検証)+ commit 統合(happy path・冪等・部分成功・未選択スキップ・未 seed キャラ作成 = 依存順)。
- **Vitest**: `pnpm test -- --run` 全パス(83 ファイル/451 テスト)。import feature 純関数(要確認強調 (i)〜(vi)・rowKey)+ ImportMovesPage コンポーネント(ハイライト・既定全チェック・個別解除・行単位レポート)。
- **E2E**: `pnpm exec playwright test` 2 spec 通過。新 `import-moves.spec.ts`(CSV 選択→プレビュー→要確認ハイライト確認→一部解除→取込→行単位レポート→GET /api/moves 反映・name_ja 解決)+ 既存 `combo-crud.spec.ts` 継続通過。

### 既知の制約

- `着地後N` / `N+着地後M` / `※N` 等の要確認行は total NULL のまま(FR703 待ち、自動算術しない)。M9-03 でグリッド編集・ラッシュ版生成等に対応予定。

### レビュー取り込み(`docs/progress/m9-02-review.md`、2026-06-14)

総合判定: 設計準拠・重大指摘 0 件。明確な実装欠陥 1 件(NUL バイト)を完了前修正。

- **[指摘1] 取り込み(高)**: `web/src/features/import/types.ts` の `rowKey()` 区切り文字に NUL バイト(`\x00`)が混入し、git がバイナリ判定(差分レビュー不能、CLAUDE.md §10 トレーサビリティに反する)。**スペース区切りへ修正**(`ImportMovesPage.tsx` のレポート行 key と統一)。`character_code`/`move_code` は snake_case でスペースを含まないため衝突なし。`tsc` + import feature テスト(12)再パスで非回帰確認。
- **[指摘2] 非対応・設計担当確認ポイント(中)**: §4.8「`MoveListItem` を `model.Move` から導出/埋め込みへ」は**未実施**(従来どおり約 14 フィールドを独立保持)。ただし Plan Mode-1 で開発者が「**GET 読取路(SQL/`MoveListItem`/DTO)は一切変更しない**」と確定済みで、`model.Move` のデッドコード解消(取込での初構築)・GET 契約不変は達成。レビューも「違反ではない」と認定。**重複保持を確定とするか、後続で集約するかは設計判断に委ねる**(製造担当は確定事項に従い現状維持。集約を行う場合は GET 読取路の変更を伴うため別途指示が必要)。
- **[指摘3/4] 非対応(良好/妥当と評価)**: camelCase 統一・`critical_art`/`WarningCode` 定数の BE↔フロント同期(CLAUDE.md §4 準拠)・multipart 用の生 fetch 使用(コメント明示)はいずれも適切。
- **[§1.6 軽微] 持ち越し(低・将来対応)**: character upsert 失敗(親失敗→子スキップ)の異常系テスト追加。`UpsertByCode` が失敗しにくく実害が薄いため後続へ。
- **[M12-02 TODO] 記録済み**: 旧 seed 破壊的クリア + 再投入・配布クリーン初期状態(本ログ上記「重要決定」に記載済み)。

**問題3: devContainer リビルド後も `make e2e` がタイムアウト続発 → ESM `__dirname` バグ**

- **根本原因**: `web/package.json` が `"type": "module"` のため `playwright.config.ts` は
  ESM として実行される。ESM スコープでは `__dirname` が未定義のため、
  `resolveBackendPort()` 内の `path.resolve(__dirname, "../config.toml")` が
  `ReferenceError` を投げ、catch ブロックがそれを捕捉してデフォルト値 `47318` を返していた。
  結果: Playwright はポート 47318 を待ち続け、バックエンドは `config.toml` の 47320 で
  起動するため永久に検出されず 60 秒タイムアウト。
- **修正**:
  - `web/playwright.config.ts`: `import { fileURLToPath } from "node:url"` を追加し、
    `__dirname` を `path.dirname(fileURLToPath(import.meta.url))` に置き換え。
  - `Makefile`: `e2e` ターゲットに `cd web && pnpm exec playwright install chromium --quiet`
    を先行ステップとして追加。devContainer 再ビルド後の Chromium 未インストール問題を
    `make e2e` 実行時に自動解決する。

#### レビュー取り込み(`docs/progress/m8-02-review.md`、2026-06-13)

総合判定: 軽微指摘あり・合格。重大指摘 0 件。

- **[B] 取り込み(中)**: `docs/design/testid-convention.md` の付与済み一覧に既存 `color-input`(TagFormDialog.tsx)を追記。規約ドキュメントがプロジェクト全体の testid を一元管理する状態に整備。
- **[C] 取り込み(中)**: `testid-convention.md` に「spec 実行前の環境前提」セクションを追加。ウィザード完了済み DB が必要な旨を明記し、初回実行者が見逃さない形に整備。
- **[D] 取り込み(低)**: `playwright.config.ts` の `use:` に `headless: true` を明示。動作変更なし・意図の可読化のみ。
- **[A] 非対応(低・将来対応)**: `playwright.config.ts` を `web/tsconfig.json` include に追加する件。vitest/globals との型競合リスクと実害の薄さを考慮し将来対応とする。
- **[開発者タスク]**: `make e2e` 実行・PASS 結果を §5.2 に記入するのは開発者の責任範囲(Claude はブラウザ実行不可)。
- **検証**: `go test ./...` 全パス・`pnpm test -- --run` 81 ファイル/439 テスト全パス(コード変更なしのため影響なし)。

---

## M9-04: FR703 編集グリッド仕上げ(要確認再導出・ラッシュ非活性・表示順)(2026-06-17 完了)

### Plan Mode 確定(§3.4 / §9.4)

- **接地点**: `MoveResponse.warnings: WarningCode[]` をサーバ算出で後方互換加算(推奨案、開発者承認)。`combo_scaling` は一覧クエリ(`MoveListItem`)に内部追加して warnings 算出に使うが JSON へは非露出(MoveResponse 契約不変)。
- **判定共有**: 既存 `internal/service/movesimport` を共有元とし、保存済み move からの再導出関数 `DeriveStoredWarnings` を新設。既存ホワイトリスト(`knownProperties` / `comboScalingKeys`)・`validateComboScaling` を再利用し二重実装の乖離を防止。`move/service.go` の重複 `knownProperties` も `movesimport.IsKnownProperty` へ寄せ単一情報源化。
- **recovery_word は保存データから再導出不可**(recovery 原文は moves に非永続)→ `total_null` に吸収。再導出は **total_null / unknown_properties / unknown_combo_scaling_key / extra_throw の4種**。

### 実装メモ・発見

- **properties のパリティは「述語共有」止まり(end-to-end では不一致が正)**: 取込時 `normalizeProperties` は未知 properties を `raw_data` へ退避し列を NULL にするため、CSV→保存→再導出の end-to-end では `unknown_properties` が再現しない。再導出は「**保存済み値が値域外か**」を問う別観点(§4.1)。よってパリティテストは「両者が同一ホワイトリスト/正準キー集合を参照し同一入力で一致する」述語レベルで担保(`TestStoredWarnings_ShareWhitelistWithPreview`)。`combo_scaling` は原文を保存するため end-to-end でも一致する。
- **フロント定数集約**: `WarningCode` 型・ラベルを `web/src/constants/move-warning.ts` に集約(CLAUDE.md §4)。`features/import/types.ts` は後方互換エイリアス(`ImportWarningCode` / `IMPORT_WARNING_LABEL_JA`)で再エクスポートし既存参照を非破壊。
- **表示順並び替え**は列ヘッダクリックのクライアントソート(表示のみ)。DB の並び・主キー・API・スキーマ不変。`localStorage` 等の永続化は行わない(許容3用途外、CLAUDE.md §10.X)。

### テスト(全パス)

- **Go**: `movesimport` 再導出 各種別 + 述語パリティ(`warning_test.go`、4 関数 / サブテスト計 ~16)。`api/move` の `TestHandler_List_Warnings`(warnings 付与・既存フィールド不変・`comboScaling` 非露出)。`go test ./...` 全パス。
- **Vitest**: `MoveEditGrid.test.tsx` 12 ケース(warnings 全種強調・空時非強調・rush 既存で非活性・表示順が API を呼ばず変わる を追加)。`pnpm test -- --run` 84 ファイル / 463 テスト全パス。`tsc --noEmit` / `pnpm build` クリーン。
- **E2E**: `make e2e` 3 spec(import-moves / combo-crud / moves-edit)全パス。

### 申し送り

- **CHANGE-034(設計担当)**: 既に反映済み。指示書 v1.0.2 §4.1 の記載どおり DES-002 §4.2(v1.18.0 / `MoveResponse` に `warnings` 加算)・DES-005 §5.18(v2.19.0 / 要確認強調を warnings 全種へ・表示順並び替え追記)へ反映済みのため、製造担当からの追加起票は不要。
- **M9-04-overview.md の取り違えと是正**: Phase B コミットで、セッション開始前から作業ツリーにあった `docs/instructions/M9-04-overview.md` の未ステージ削除が pathspec なし `git commit` に巻き込まれた。当初「意図しない削除」と誤認し一旦 227c48f 時点の内容を復元したが、開発者確認の結果**本ファイルは v1.0.1 で正式に廃止済み**(独立 overview を M9-overview §12 へ統合)であり、製造工程でも本ファイルは一切参照不要(指示書 §3.1/§8 は M9-overview §12 を指す)と確定。よって復元を取り消し**再削除**した。履歴上は delete→restore→delete の往復が残るため、必要なら開発者が squash 等で整理(push 前)。

### レビュー取り込み(`docs/progress/m9-04-review.md`、2026-06-17)

総合判定: **完了承認可(重大ゼロ)**。高・中の指摘なし。低(将来対応)3件 + 制約「不明」1件。

- **[低#1] 取り込み(防御的堅牢化)**: `DeriveStoredWarnings` の extra_throw 採番が「単一キャラ・スライス順」を暗黙の前提にしていた(唯一の呼出元 `List` は満たすため実害なし)。`StoredMove` に `CharacterID` を追加し `throwCount` を `map[int64]int`(キャラ ID キー)化して**キャラ混在入力でも独立採番**されるよう根本修正。取込側 `parse.go`(CharacterCode キー)と方針一致。`handler.go` の `StoredMove` 構築で `CharacterID` を設定。複数キャラ混在の新テスト `TestDeriveStoredWarnings_ExtraThrowPerCharacter` を追加(既存 extra_throw テストは CharacterID=0 のまま通過)。`go test ./...` 全パス。
- **[低#2] 非対応(設計担当へ申し送り)**: properties の再導出 `unknown_properties` は end-to-end では取込時 `normalizeProperties` の raw_data 退避により不一致が正で、実質「PATCH 等で値域外値が保存された場合の防御検出」に限られる旨を **DES 側脚注**へ残す案。レビューも「設計担当判断・任意」と明記。DES 本体編集は製造担当スコープ外(CLAUDE.md §8)のため設計担当に委ねる。
- **[低#3] 非対応(開発者の git 操作)**: M9-04-overview.md の delete→restore→delete 往復の squash 整理は push 前に開発者対応(製造担当は rebase/squash 不可、CLAUDE.md §7)。
- **[制約「不明」] 開発者確認事項**: 範囲内コミット(`3304c54` 等)に含まれる DES-002/DES-005・CHANGE-034・instruction v1.0.2 は**設計担当の未コミット成果物**であり、製造担当の `git add -A` 取り違えで同梱されたもの(内容は無改変)。製造担当が DES 本体を直接編集した事実はない。コミット分割・主体確認は開発者に委ねる。

---

## M10-01: ComboEditor キャラクター選択化(A-1)(2026-06-19 完了)

### Plan Mode 確定(§3.4 / §9.4)

- **characterId の出所**: 従来 `RYU_CHARACTER_ID = 1` ハードコードだった ComboEditor のキャラを撤廃し、`basic.characterId`(フォーム state)を単一の出所に一本化。`useMovesByCharacter` / `RecipeBuilder` も `basic.characterId` 参照へ切替。
- **既定キャラ**: 閲覧系(MyComboPage 等)と統一して `INITIAL_CHARACTER_ID`(`@/lib/constants`)を新規/コピーの初期値に採用(`config.defaults.character_id` はフロント未露出のため)。
- **状態管理**: react-hook-form ではなくローカル `useState`(既存方針)を踏襲。
- **CharacterSelector 流用**: `features/mycombo/components/CharacterSelector` を移設せず現位置 import(`AddComboToCompareModal` の前例に倣い 8 ファイル波及を回避)。
- **CHANGE-036 切替挙動**: dirty 時はキャラ変更で確認ダイアログ→「破棄」で全フォームリセット / 「キャンセル」で元キャラへ revert。コピーは投入済みのため初回から dirty=true。

### 実装メモ・発見

- **dirty 判定は決定的比較を採用**: 追跡 boolean ではなく「新規初期状態との JSON 差分(characterId 除外)＋ steps/setups/linked の有無」で判定(`isFormDirty`)。新フィールド追加に自動追従しテスト容易。
- **キャラ情報バーは自作**: mycombo の `CharacterInfoBar` は `statusCounts` 必須(マイコンボ専用)のため流用せず、`ComboEditorCharacterField` に icon+name の簡易バーを用意(DES-005 §5.7 表示項目1)。編集モードは固定表示(「編集モードではキャラクターは変更できません」)。
- **配置**: DES-005 §5.7 の表示順(item1 情報バー → item2 プルダウン)に従い縦並び。

### 追加修正(E2E 指摘②・スコープ外先回り)

- **数値欄の不正キー抑止**: `type="number"` がタイプを許す `e`/`E`/`+`/`-`、および追加報告を受けて小数点 `.` のキー入力を抑止する `blockNonNumericKeys` を新設し、ダメージ/ドライブゲージ/SAゲージ/ドライブダメージ/有利フレームに適用(有利フレームのみ負値正当として `-` を許可)。全欄整数項目のため `.` も一律抑止。
- **既知の限界**: キータイプのみ抑止。ペースト(`1e3` / `1.5` 等)は素通り(保存時 `parseOptInt` で整数化されるため不正値保存はなし)。ペーストガードの要否は設計判断に委ねる(下記課題)。

### テスト・E2E(全パス)

- **Vitest**: `ComboEditor.test.tsx`(キャラ切替・送信 characterId・moves 再取得・破棄での全フォームリセット・キャンセル revert を網羅)、`ComboEditorCharacterField.test.tsx`(new/copy=プルダウン・edit=固定表示)、`ComboEditorBasicFields.test.tsx`(`blockNonNumericKeys` 純粋関数、`e/E/+/-/.` 抑止)。`pnpm exec vitest run` 86 ファイル / 477 テスト全パス。`tsc --noEmit` クリーン。
- **E2E(スコープ内)**: 開発者実機にて **M10-01 範囲は問題なし**を確認。A-1 のキャラ選択・切替(破棄/キャンセル)・保存導線、および数値欄キーガード・情報バー配置の非回帰を確認。

### 申し送り

- **CHANGE-036(設計担当)**: DES-005 は §5.7 に挙動反映済みだが、通知書 `change-036-combo-editor-character-switch.md` のステータスが「ドラフト・承認待ち」のまま陳腐化。「反映済み」へ更新と registry 整合確認を設計担当に委ねる。
- **課題【要設計判断・スコープ外】仮想コントローラの move_code 規約分裂**: CSV インポートしたキャラ(ヴァイパー/ダルシム/ケン/イングリッド)で仮想コントローラの通常技ボタンが解決されず無反応。原因は通常技 code の規約ズレで、**seed/コントローラ＝原形 / M9 インポータ CSV＝現在分詞(-ing)**。立ち(`stand_`↔`standing_`)で表面化するが、しゃがみ(`crouch_`↔`crouching_`)・飛び(`jump_`↔`jumping_`)も同根で **3 姿勢 18 種すべてが相違**。投げ(`forward_throw`↔`throw_forward` / `back_throw`↔`throw_back`)・`drive_parry`(CSV に存在せず)も同様。**正典は DES-004 §2.1 の原形系**(`tmp/moves-code-report.md` の DB 実査で確認)であり逸脱はインポータ側。推奨は **インポータ/CSV を DES-004 §2.1 準拠へ是正＆再インポート**(コントローラ・seed は無改変、低リスク)。製造の独断パッチはコントローラを `standing_*` へ寄せると seed キャラが逆に壊れるため不可。詳細・対比表は `tmp/m10-01-handover-report.md`(課題1)・`tmp/normal-moves-code-diff.md`。
- **M10-02(A-2)未着手**: ComboEditor 外のエントリポイント既定キャラ追従は M10-02 範囲として想定内残件。

---

## M10-02: リュウ固定依存 UX の画面横断解消(A-2)(2026-06-20 完了)

### Plan Mode 最終 view 確認(§3.4 / §9.4 の3項目)

- **伝播機構**: `?character=` route param 方式を採用(指示書 §4.3 推奨)。閲覧系のキャラ state は画面ローカル(MyComboPage=useState / ComboListPage=URL `character_id` filter)で共有 context は存在しないことを実 view で確認。新規登録へは route param で伝播するのが既存実装と整合。
- **ComboEditor 初期値受け口**: M10-01 で導入済みのローカル `useState(() => initialBasic(...))` 初期化(react-hook-form ではない)。`initialBasic(initial, initialCharacterId)` の第2引数として流し込み、新規(`!initial`)時のみ採用。編集/コピーは `initial.characterId` 優先。
- **ComparePage→モーダル経路**: ComparePage はページレベルのキャラ state を持たず、`useCompareCombos(ids)` 由来の `combos` 配列先頭の非 null コンボの `characterId` を `defaultCharacterId` として `AddComboToCompareModal` へ渡す(空なら `INITIAL_CHARACTER_ID`)。

### 実装メモ・推測内容

- **スコープ確定(survey 結果)**: A-2 の対象は (1)新規登録の既定キャラ文脈追従 (2)コンボ追加モーダルの既定キャラ の2点。`useSelectMode`/`ComboTable`/`ComboTableRow` は **キャラ非依存**でリュウ固定の解消対象なし＝スコープ外を実コードで確認(指示書 §1.3 と一致)。
- **後方互換**: 4経路すべて `?? INITIAL_CHARACTER_ID` に一本化。プロップ(`initialCharacterId`/`defaultCharacterId`)不在時は従来挙動。
- **パース堅牢化**: `?character=` は `Number.isFinite` + `> 0` + `mode === "new"` の三条件で採用し、`character=0`/非数値/`copyFrom` 競合を排除。

### 開発者判断による乖離報告(2件・要設計担当認識)

- **(a) MyComboPage に新規登録導線が存在しない**: `/combos/new`(非コピー)導線は HomePage / Footer / ComboListPage の3箇所のみ(Header になし)。指示書 §2.1 は「マイコンボの新規登録アクション」を修正対象に挙げ E2E-A もそれを前提とするが、実在しない。**開発者判断によりリンクは追加せず、一覧(ComboListPage)のみ文脈伝播**とした。→ E2E-A(マイコンボ→新規→ダルシム)は導線非存在で**非該当**。マイコンボへの新規登録導線追加の要否は設計担当へ申し送り。
- **(b) ComboListPage 情報バーのリュウ固定を今回スコープに追加**: 情報バーがアバター「R」+ `comboList.characterRyu` のリュウ固定で実フィルタ(`filters.characterId`)と不一致だった。DES-005 §5.4「現在選択中キャラクター情報バー(アイコン+名前を動的表示)」の既述 defect。**開発者判断により今回修正に追加**(`useCharacterName` で動的化)。既存 spec 準拠のため新規 CHANGE 不要。

### テスト(§5.1 5ケース・全パス)

- `ComboEditor.test.tsx`: initialCharacterId 指定で既定追従 / 不在で INITIAL / 編集モードで無視(initial.characterId 優先) の3件追加。
- `ComboEditorPage.character.test.tsx`(新規): `?character=5`→新規モードへ伝播 / 文脈なし→none / `character=0`・非数値→無視 の4件。
- `AddComboToCompareModal.test.tsx`: defaultCharacterId 指定で既定追従 / 不在で INITIAL の2件追加。
- `ComparePage.character.test.tsx`(新規): 先頭コンボのキャラが defaultCharacterId / 空リストで INITIAL の2件。
- `pnpm exec vitest run` **88 ファイル / 488 テスト全パス**。`pnpm build`(tsc -b + vite)・`tsc --noEmit` クリーン。

### レビュー・自動トリアージ(implement_plan_full Phase B/C)

- fresh subagent レビュー: `docs/progress/m10-02-review.md`。優先度「高」**なし**(完了承認可水準)。
- 自動トリアージ: **指摘1(中・useEffect 立ち上がりエッジ同期の厳密化)を採用**(`prevOpenRef` で open のまま defaultCharacterId 変化時の手動選択上書きを防止)。**指摘2/3(低)は持ち越し**(情報バーのロード中フォールバック中立化・頭文字 i18n=情報バー全体課題)。採否理由は同報告書「## 取り込み結果(自動トリアージ)」に記録。

### 申し送り

- **CHANGE-039**: DES-005 v2.21.0 §4.3/§5.7/§5.8 に既定キャラの文脈追従は設計担当が反映済み(製造は DES 本体未編集)。
- **実機 E2E が完了の必須ゲート(DoD §7)**: シナリオ B(フッター新規→INITIAL)/ C(比較でダルシム→追加モーダル既定ダルシム)/ D(既存 E2E 非回帰) の手動 E2E を開発者に依頼。A は上記乖離(a)により非該当。

## M11-01: custom_states 開始時状態の機能化(付与・表示・参照)(2026-06-20 完了)

指示書 `M11-01-instruction.md` v1.1.0 / CHANGE-040(反映済み前提)/ CHANGE-041(PATCH situation 加算)。スコープ: フロント + seed マイグレーション + 軽微バックエンド。

### 実装概要

- **バックエンド(CHANGE-041)**: `PATCH /api/combos/:id` に `situation` を加算(`UpdateMetadataRequest` / repo `UpdateMetadataInput` / メタデータ UPDATE SET の3点)。custom_states 単独編集(識別キー不変=PATCH 経路)の往復保持を永続化。CREATE/PUT と対称化。`*string` 素通しで検証・業務ロジックは追加なし。サービス層は型エイリアスで自動追従。
- **seed `000015`**: ryu=`'{}'`→`denjin_charge` / ingrid=NULL→`sun_crest`(min0/max4) / c_viper=NULL→`limit_decoupler`。加算的 UPDATE、破壊的クリアなし。down で投入前へ復元。aki/jamie/guile 不変。投入 JSON は m11-custom-states-definitions §3.1 逐語。
- **フロント**: `customStates.ts`(parse/build 独立モジュール)、ComboEditor の「キャラ固有状態」fieldset(データ駆動)、ComboDetailHeader / CompareTable の表示、i18n 新系統(`comboDetail.customStates.*` / `compare.row.customStates`)、initialBasic round-trip。

### Plan Mode §3.4 確認結果(着手前 view)

situation 組立4経路(buildCreatePayload:144/buildPatchPayload:173/runPut:305/initialBasic:523)/ PATCH の BE 受け口欠落を確認→ CHANGE-041 で加算 / useCharacters→find→parseCustomStateDefs 配線 / 既存ゲージ弾き `blockNonNumericKeys(false)` 踏襲 / fieldset を基本情報と起き攻めの間に設置 / seed 次番号 000015 個別 UPDATE / 詳細`<dl>`後・比較 rows への追加 / composite スキップ・状態なし非表示 / situation 他キー保全マージ。

### 実装裁量・推測内容

- **`CustomStateDef` 型は格納 raw JSON 構造(snake_case)で定義**: API DTO ではなく DB 格納 JSON のため `name_ja`/`value_definition` 等 snake_case。CLAUDE.md camelCase 規約(API DTO 対象)は非該当と解釈しコメント明記。
- **buildSituation 定義空ガード追加(推測判断)**: `useCharacters` 未ロード等で定義が空のとき、付与値の型判定ができないため既存 situation をそのまま保持し誤消去を防ぐ(round-trip 保全)。指示書明記外の防御だが round-trip 要件の安全側補強。
- **エディタ legend「キャラ固有状態」はハードコード JP**: 既存エディタ(基本情報/起き攻め等)がハードコード JP 統一のため踏襲。i18n 新系統キーは表示(詳細/比較)側で使用。

### テスト(§5.1 16→18 ケース・全パス)

- seed: migrate_test に値検証(denjin/sun_crest min0max4/limit)+ down/up ロールバック(§5.1 1-4)。
- PATCH 永続化: repository_test に situation 保存・未指定時保全(§5.1 16/17)。
- 付与/組立/表示/round-trip/後方互換: customStates.test(14)、ComboEditorBasicFields.test(描画 5/6/8/9)、ComboEditor.test(round-trip 14/15/18)、ComboDetailHeader/CompareTable.test(表示・後方互換)。
- **Go 全テスト / web 513 テスト / tsc / lint / 本番ビルド すべてグリーン**。§5.1(7)「int 入力弾き」は共通関数 `blockNonNumericKeys(false)` テストで実質カバー(custom_states 専用番号テストは未作成=軽微)。

### レビュー・自動トリアージ(implement_plan_full Phase B/C)

- fresh subagent レビュー: `docs/progress/m11-01-review.md`。優先度「高」**なし**(完了承認可水準)。
- 自動トリアージ: **中-1(ComboEditor.test の useCharacters 明示モック)を採用**(将来安定性)。**低-1(000015 seed の `scope` フィールド追加)は不採用=持ち越し**。確認C(buildSituation 新規時 existing=undefined)は無害で対応不要。採否理由は同報告書「## 取り込み結果(自動トリアージ)」に記録。

### 申し送り(設計担当・開発者)

- **低-1(seed `scope`)は設計判断として保留**: 指示書 §4.1/§2.1 は definitions §3.1 の確定 JSON を「逐語」投入と指示し、そこに `scope` は含まれない。一方 DES-003 §3.2 例示・既存 000009 seed は `scope:"persistent"` を持つ。この不整合の解消(正典化/据え置き)は definitions §6 が「CHANGE-040 で設計担当が判断」と明記する設計領域のため、製造では逐語投入を優先し `scope` を追加していない。設計担当の判断を仰ぐ。
- **CHANGE-041**: DES-002 v1.21.0 §4.2(PATCH に situation 追加)は設計担当が反映済み。製造は DES 本体未編集。
- **実機 E2E が完了の必須ゲート(DoD §7)**: §5.2 シナリオ A(リュウ電刃 往復 + custom_states のみ変更の PATCH 永続化)/ B(イングリッド数値・入力制約)/ C(C.ヴァイパー)/ D(ケン非表示)/ E(非回帰) の手動 E2E を開発者に依頼。

---

## M11-01 事後バグ修正: custom_states(電刃錬気)あり→なし が編集で永続化されない(2026-06-20)

### 症状・発見経路

- 実機 E2E(§5.2 シナリオ A「リュウ電刃 往復」)で発見。電刃錬気「あり」で登録 → 編集でチェックを外して保存しても「なし」にならない。登録は あり/なし 両方可、編集は なし→あり 可・**あり→なし 不可**。int 状態(イングリッド サンシンボルを min へ戻す等)も同症状。

### 根本原因(トライステート衝突)

- フロント意図(`customStates.ts:103` コメント + 指示書 §4.4): 全 off で `buildSituation()` が `undefined`(=「NULL 保存」のつもり)。
- バックエンド契約(CHANGE-041 / DES-002 §4.2): `situation == nil` は「不変更」。
- `buildPatchPayload` の `buildSituation(...) ?? null` がクリア時 `"situation": null` を送信 → Go は JSON null を **nil ポインタ**にアンマーシャル(omitempty はアンマーシャル無関係)→ UpdateMetadata が `nil=不変更` で SET 句から除外 → 旧値温存。POST/PUT は INSERT で列を無条件に書くため正常、**PATCH 経路のみ**の欠陥。

### 修正(空文字センチネル → NULL。開発者確定方針)

- BE `internal/repository/combo/repository.go` UpdateMetadata: `situation==""` → `add("situation", nil)`(NULL)、非空はその値、nil は従来どおり除外。`UpdateMetadataInput.Situation` doc 更新(`nil=不変更 / ""=NULL クリア / 非空=更新`)。
- FE `ComboEditor.tsx` buildPatchPayload: situation を `?? null` → `?? ""`。`buildCreatePayload`/`runPut`/`buildSituation` は不変(スコープ厳守)。
- testid `combo-editor-custom-state-{code}` を flag トグルに付与(Radix Checkbox は accessible name 無し)。`docs/design/testid-convention.md` 更新。

### テスト(全グリーン)

- BE `repository_test.go (18)`: `Situation: ptrStr("")` → FindByID で situation==nil(NULL クリア)。(16)(17) 維持。
- FE `ComboEditor.test.tsx (19)`: edit で全 off → 保存 → PATCH payload.situation === ""。
- E2E `web/e2e/combo-custom-states.spec.ts`: 電刃錬気 あり登録 → 詳細表示 → 編集 off → 詳細非表示 → 削除。
- Go 全テスト / web 514 単体 / tsc / lint / E2E 6 件 すべてグリーン。

### 設計担当への申し送り(CHANGE-042 ドラフト起票)

- `docs/change-notes/CHANGE-042-M11-01-patch-situation-clear-sentinel.md` を起票(ドラフト・反映待ち)。依頼内容:
  - (a) DES-002 §4.2 に「PATCH situation の空文字 `""`=NULL クリア」細則を正典化。
  - (b) `customStates.ts:103` コメント「undefined=NULL 保存」⇔ CHANGE-041「nil=不変更」の**文言矛盾**の解消(本 CHANGE で正典化)。
  - (c) 同型潜在課題(memo/damage 等 他 nullable メタデータも PATCH で空クリア不可)は**今回スコープ外**=設計判断として申し送り。
  - registry 次番号 042 を使用(registry 更新は設計担当)。

## M12-05: seed 整理 + B-7 move_code 旧形→新形統一(2026-06-25)

指示書 `M12-05-seed-cleanup-and-movecode-unification.md` / 研究報告 `M12-RESEARCH-02-report.md` / 確定判断 §10。

### 実施内容(案A=新規マイグレ 000017 追記)

- **マイグレ 000017**(`000017_cleanup_ajg_seed_and_unify_ryu_move_code.{up,down}.sql`):
  - ajg(aki/jamie/guile)除去。マイグレ接続 FK=OFF で CASCADE 非発火のため、子(combo_steps/combo_tags/combo_setups)を先に明示 DELETE → combos → preset_aliases(move_id 参照分)→ moves → characters の依存順。custom_states は characters 行ごと消える。耐久 seed(000012 由来 36 件)も内包除去。
  - ryu の moves.code 旧形 26 件(通常技18+投げ2+rush6)を CASE+`WHERE code IN(...)` で明示列挙 UPDATE。`jump_neutral`/`dash_*`/`micro_*` 等の正典 movement code を破壊しないため接頭辞一括置換は不使用。UNIQUE(character_id, code) 衝突なし、rush の original_move_id(数値参照)不変、preset_aliases(move_id 参照)不変。
  - down は前方専用最小化(既配布 DB なし=開発者確定。復元せず SQL コメントで明記)。
- **コントローラ(B-7(a))**: `useControllerInput.ts` の `BUTTON_TO_MOVE_CODE` 旧形7値→新形(standing_* 6 + throw_forward)。drive_impact/drive_parry 不変。`controllerTypes.ts` コメントも追従。
- **fixture ロックステップ**: migrate_test の耐久36件依存(L452/453)を ajg 除去後(combos=0)へ意図再設計、RushVariant を新形へ更新、000017 専用検証テスト(`TestRun_Migration000017_*`)追加(ajg=0 / 旧形=0 / movement code 温存 / orphan 不在)。旧形直書きの Go テスト + フロント5テストを新形へ追従。ajg 依存テスト(service/combo の NonRyu→ingrid 置換、repository/tag の id 直書き→code 引き)を再設計。

### 着手前確認(§3.4 HEAD 再確認)結果

- 次連番=000017、FK 定義(moves/combos の character_id は CASCADE なし)、旧形 code/A-2 対応表、movement code 実在、preset_aliases の move_id 格納、000012=ajg 36 combos のみ・drive_damage 未投入 — 全て研究報告(commit `5acf478`)と HEAD 一致。
- fixture 実測差分: 指示書/研究報告は「フロント7・計19」だが HEAD 実測は「フロント5」+「Go 12 + ajg id 依存の repository/tag 1 = Go 13」。受入は「grep で旧形ゼロ(最終 DB 状態)」で担保。

### テスト結果

- Go 全テスト緑(`go test ./...` / `-count=1` 28 パッケージ ok)。`dbtest.Setup` 依存テスト全緑(version=17 / dirty=false)。
- フロント 90 ファイル / 535 テスト緑(`pnpm vitest run`)。
- E2E spec `web/e2e/m12-05-seed-cleanup-and-controller-resolve.spec.ts` 追加(配布クリーン=ajg 不在 + ryu の B-7 回帰)。製造環境はブラウザ未導入のため未実行=開発者ゲート(B-7(e) 実機確認)。

### CHANGE 要否 / DES

- **CHANGE 不要**(確定どおり)。seed/移行はデータ=DES-003 §6/§7 規定外、B-7 は DES-004 §2.1 が既に新形=実装是正のみ。**製造担当は DES 本体を直接編集していない**。

### followup-backlog §B-7

- **クローズ**(残課題なし)。実機回帰の最終確認のみ開発者ゲート。backlog §B-7 にステータス追記済み。

### レビュー(fresh subagent)/ 自動トリアージ

- レビュー報告書 `docs/progress/m12-05-review.md`。重大・優先度「高」指摘ゼロ。
- 取り込み: 中(本 progress-log 記録 + backlog §B-7 クローズ追記)=採用・反映済み。低(`countCombos` の陳腐化コメント整理)=採用・コメント更新。`CharacterSelector.test.tsx` の mock `code:"aki"`(DB 非依存の固定 props)はスコープ外・無害のため不採用(現状維持)。

## M12-06: 統合 E2E(E-1 回帰穴埋め)+ 先行リリース配布判定(2026-06-26)

指示書 `M12-06-integration-e2e-and-release-decision.md`。フェーズ2(先行リリース準備)の最終サブ。
着手前確認(§3.4)で既存 E2E を棚卸しし、最大回帰リスク **E-1**(CHANGE-043 presence-detection 単一トライステート化後の「通常編集で触っていない nullable メタデータが消える」退行)の穴を最小で埋めた。

### スコープ確定(着手前確認の実態調査結果)

- 既存 E2E 7 本中、E-1 相当は `combo-crud.spec`(memo 編集で situation 温存)/ `combo-custom-states.spec`(situation クリア)の **situation 1 種のみ**。numeric/boolean 型(damage/drive_damage/ゲージ/knockdown/起き攻め6)の保持検証は皆無だった。
- **スコープ制約(§2.3)**: アプリ本体(FE/BE)・DES・seed・マイグレは変更不可 = **E2E spec のみ**。numeric/okizeme は test-id 未付与だが、付与は FE 変更=スコープ逸脱のため**新規 test-id を付与しない**方針を採用。

### 実施内容(E2E spec 2 本新規 + 棚卸し対応表)

- **E-1 回帰 spec**(`web/e2e/m12-06-presence-detection.spec.ts`): 複数型をまたぐ多項目で「保持」「クリア」を検証。
  - 方式(実装方式非依存・§10-2): **fixture 作成=API POST**(全 nullable 項目を確実に設定。FE への新規 test-id を回避)/ **1 項目編集=UI**(editor が GET で全項目をロードし `buildPatchPayload` が全キー再送するかを実検証。memo=placeholder・drive_damage=既存 testid・保存=role の安定セレクタのみ)/ **アサート=API GET**(= §4.1「再取得」、DOM 非依存)。
  - ケース1(保持): memo のみ編集 → 他の全 nullable 項目(damage/ゲージ/knockdown/起き攻め3/situation)が温存。**逆方向ガード**(未設定の起き攻め3項目が誤って true 化されない)も併せて確認し presence-detection の対称的健全性を担保。
  - ケース2(クリア): drive_damage(小数)のみクリア → 当該のみ NULL・他は保持。既存(situation クリア)と異なる**数値型のクリア**を補完。
- **仮登録→本登録昇格スモーク**(`web/e2e/m12-06-draft-promotion.spec.ts`): 既存 spec は draft 作成のみで draft→非draft の**昇格検証が皆無**だったため、最小 1 ケース追加(draft 作成 → 弱パンチ+投げの 2 ステップ付与[VAL-C09 充足] → 昇格 → API GET で `isDraft=false`)。
- **棚卸し対応表**(完了報告に記載): 主要フロー×既存 spec の対応を整理。E-1 多項目=本サブで穴埋め、昇格=本サブで追加、他は既存で充足を確認。過剰作成は回避(§10-5)。

### テスト結果

- 静的: `tsc --noEmit` 緑(プロジェクトの lint script は tsc。eslint は未設定)。
- E2E: **全 14 spec 緑**(新規 3 + 既存 11、非回帰確認、6.9s)。devContainer で実機実行(2026-06-26)。`cdn.playwright.dev` を init-firewall.sh allowlist に追加 + `NODE_OPTIONS=--dns-result-order=ipv4first` で chromium install(IPv6 経路無 + CDN が AAAA も返す罠の回避)。§7 #6 の自動化分が充足。

### スコープ / CHANGE 要否

- **CHANGE 不要**。E2E spec のみの追加で、アプリ本体・DES・seed・マイグレ・既存 spec の挙動・test-id 規約いずれも未変更。
- **§7 先行リリース配布判定チェックリストの実施は開発者ゲート**(製造担当は判定しない)。完了報告に申し送りのみ。手動必須範囲(#1 実機UX / #2 取込パイプライン実機 / #7 取込5体の B-7 / #3 ingrid・c_viper)と自動化済み範囲(#5 配布クリーン / #6 E-1・昇格 / #7 ryu 分)を切り分けて引き継ぎ。

### レビュー(fresh subagent)/ 自動トリアージ

- レビュー報告書 `docs/progress/m12-06-review.md`。重大・優先度「高」指摘ゼロ。
- 取り込み: 採用 2 / 不採用 3。**不採用の中(整数/BOOLEAN クリアの型網羅)**は UI クリアに新規 test-id が必要=スコープ逸脱、かつ `Optional[T]` は型非依存で追加価値小のため見送り(理由付きで自動不採用)。詳細は同報告書末尾の自動トリアージ表。
- 申し送り(将来改善・別サブ): メタデータ入力欄の test-id 化、クリア検証の整数/BOOLEAN 型網羅(いずれも FE 変更を伴う)。**ラッシュ技は E2E 未カバー**(VAL-C12 を踏むケース無し。ラッシュ仕様見直し時は別途回帰要)。

## フロント依存 CVE 一括解消(vite6 + vitest3 + pnpm overrides)(2026-06-27)

`/app_build_check`(`scripts/app-build-supplychain-check.sh`)が **WAIT** を返したことを起点に、`pnpm audit` 検出の **計10件**(critical=1 / high=3 / moderate=5 / low=1)を一括解消。全件 devDependencies(ビルド/テストツールチェーン)由来で、本番ランタイム(`dependencies`)・Go embed 配布バイナリには非同梱。開発者方針「今のうちに効果の高い修正をまとめ、しばらく大きな環境変更を不要にする」に従い、最小パッチではなくメジャー更新+推移依存ピン留めを採用。

### 変更内容(`web/package.json` + `web/pnpm-lock.yaml`)

- **直接 devDep 更新**: `vite ^5.4.11 → ^6.4.3`(解決 6.4.3)、`vitest ^2.1.5 → ^3.2.6`(解決 3.2.6)。`@vitejs/plugin-react`(4.7.0, peer `^4||^5||^6`)・`jsdom`(25.0.1)は据え置き(更新不要)。
- **新規 `pnpm.overrides`**(セレクタ限定 = 脆弱レンジのみ書換、無関係な将来解決をピンしない):
  - `ws@>=8.0.0 <8.21.0` → `>=8.21.0`(解決 8.21.0)。jsdom@25 経由(high CRLF/DoS + moderate uninit memory)。**実効的に必要**。
  - `form-data@>=4.0.0 <4.0.6` → `>=4.0.6`(解決 4.0.6)。jsdom@25 経由(high CRLF)。**実効的に必要**。
  - `esbuild@<0.25.0` → `>=0.25.0`(解決 0.25.12)。**vite6.4.3 が `esbuild ^0.25.0` を内包するため、esbuild CVE は vite 更新だけで解消済み**。この override は防御的セーフティで、更新後はマッチせず **no-op**(「必須」ではない)。
  - `@babel/core@<7.29.6` → **`^7.29.6`**(解決 7.29.7)。plugin-react 経由(low)。**当初案 `>=7.29.6` は最新メジャー 8.0.1 へ解決し plugin-react の `@babel/core ^7.0.0` 系 peer を外れたため、`^7.29.6` に修正**して 7.x 系内に固定(実装中の実測で判明・是正)。**実効的に必要**。
- **追加で react-router を patch 更新**(開発者承認のうえ・影響再評価済み): 検証中に新規 advisory **GHSA-2j2x-hqr9-3h42**(`react-router@6.30.3` moderate, patched 6.30.4)が表面化。本アプリはクライアント専用 `BrowserRouter`(`src/main.tsx`)+ 宣言的 `<Routes>` のみで、advisory が刺さる SSR/pre-render/data-router(`createBrowserRouter`/loader/`useLoaderData`)経路は不使用 = 実害限定的と評価。`react-router-dom ^6.28.0 → ^6.30.4`(レンジ内パッチ、解決 6.30.4)。

### 検証結果(devContainer, Node22.16 / pnpm9.13.0)

- `pnpm lint`(tsc --noEmit)緑。`/// <reference types="vitest" />` の型問題は不発(`vitest/config` への変更は不要だった)。
- `make test-web`(vitest3, `--run`): **90 ファイル / 535 テスト全緑**。要注視だった `vi.hoisted`(ImportMovesPage)/`vi.useFakeTimers({shouldAdvanceTime})`(useCheckDuplicate)/`vi.stubGlobal("fetch")`(api-client)は 2→3 で挙動変化なし。既定プール(`forks`)起因の不安定も発生せず。
- `make build`(`tsc -b && vite build` → Go embed): 緑(vite6.4.3, `web/dist` 生成, バイナリ生成)。チャンクサイズ警告は従前から既知で本件無関係。
- dev サーバ煙テスト: vite6.4.3 が :5173 で起動(200)、`/api` プロキシは `resolveApiTarget()` 経由で config.toml のポートへ到達(バックエンド未起動のため ECONNREFUSED まで確認 = プロキシ設定は健全)。
- `pnpm audit` / `pnpm audit --prod`: **既知脆弱性なし(0)**。`app-build-supplychain-check.sh` のフロント検査は **OK**、`go mod verify` OK。

### 残課題・申し送り

- **総合判定は CAUTION**(SAFE ではない)。要因はフロントではなく、**Go の `govulncheck` がスキップ**(未インストール + `vuln.go.dev` が init-firewall.sh の allowlist に無い)であるため。SAFE 到達には govulncheck 導入 + FW 許可が別途必要(本作業スコープ外)。
- DES-001(`docs/design/01-tech-stack.md`)は Vite/Vitest をバージョン無記載で列挙のため設計書編集なし(§8 遵守)。
- フォールバック(未使用): vite6/vitest3 が広範に不安定化した場合は overrides のみ運用に退避可だが、その場合 critical(vitest)/high(vite 本体)は解消不可。今回は不要だった。

## M13-01: コンボ CSV エクスポート/インポート(FR401/405)実装(2026-06-28)

先行成果物(`autopilot-combomgr/projects/combo-export-csv` 往復ロジック + `combo-csv-import` 検証層)を `internal/service/comboio/csvcore/` へ**ソースコピー+改修統合**(replace 解消・両 Go 一体化)。案A(DES-005 §5.13/§5.14・CHANGE-050 契約)準拠。

### Plan Mode 確定方式(§3.4 全 8 項目)

- **starter 再導出**: export は starter 列を持たず、import 時にレシピ先頭ステップの解決済 move_id を `starter_move_id` とする(VAL-C03 整合・combo.Service.Create は StarterMoveID 直接受領)。**レガシーな「保存 starter ≠ レシピ先頭」のコンボは再 import で先頭へ正規化される**(import 後は常に starter==先頭となり VAL-C03 WARNING は構造的に不発。PUT 時の自動補正と同型でデータ破壊ではない・指示書 §3.4-1)。
- **重複動作**: **skip + 新規追加のみ(既定 skip)**。上書きは繰延 → **CHANGE-051** 起票(DES-005 §5.14 との差分)。
- **タグ解決**: name(user スコープ)で既存解決、無ければ `tag.Service.CreateTag` で新規作成。空 name は VAL-T02 WARNING。
- **セットプレイ別ファイル**: `parent_combo_local_id` で親解決(同一バッチ local_id or 既存実 ID)。親が取込対象外/失敗なら当該 setup スキップ+レポート。
- **code→id**: VAL-I06(character 不在)= ERROR 除外、VAL-I07(move 不在)= WARNING で move_id NULL。char/move リポジトリ参照の遅延キャッシュ resolver(`CodeLookup` 実装)。
- **上限**: 1000 行 / 10MiB(統合元 DefaultMaxRows/DefaultMaxBytes、movesimport の 5000 と別)。
- **無害化担保層**: service で再 export 時 `'` 接頭辞(VAL-I10・対称剥がしで往復同一性維持)、frontend で React 既定エスケープ + URL 非リンク化(プレーン描画)。
- **取り込み単位/json タグ**: csvcore へ一体コピー、json タグは CSV 専用 snake_case、API 境界 dto は camelCase 別建て(CLAUDE.md §4)。
- **型整合(§4.9)**: DriveDamage `*int→*float64`(REAL・小数 -6〜6・VAL-C13)、起き攻め 6 列 `bool→*bool`(nil/false 区別)、`local_id` 列追加。
- **export 配送(開発者回答)**: in-memory ZIP(`archive/zip`+`bytes.Buffer`・ディスク一時ファイルなし)。import は zip 自動展開で往復対称。

### 成果物

- BE: `internal/service/comboio/csvcore/`(契約/DTO/export/import/validate/sanitize)、`internal/service/comboio/`(service/lookup/export/import/types)、`internal/api/comboio/`(handler/routes/dto)、`cmd/combomgr/main.go` 配線。
- エンドポイント: `GET /api/export/csv`(zip)・`POST /api/import/csv/preview`・`POST /api/import/csv`(multipart combo_file/setup_file・zip 自動展開・selected[]・dupAction)。
- FE: `web/src/features/combo-io/`、画面13 `ComboExportPage`・画面14 `ComboImportPage`、router/Header 導線。

### 自己テスト結果

- **Go: 26 ケース全通過**(2 回のレビュー取り込み後。当初 13 → +6 → +7)。csvcore 11(往復 DeepEqual〔local_id/drive_damage 小数/oki nil-false/setplay〕・式注入無害化・式トリガ 4 種・drive_damage 範囲・CodeLookup・行数上限・サイズ上限 VAL-I01・不正 UTF-8 VAL-I02・空 name タグ VAL-T02・列欠落・setup 往復)+ comboio service 8(実 DB: export→zip→再 import 重複 skip・新規+タグ作成+starter 再導出・setplay 親解決・setplay 親失敗スキップ・未知 move NULL 化・部分成功・冪等 skip・add 完全重複→failed)+ comboio handler 7(httptest: Export 正常/range 不正 400・Preview combo_file 欠落 400/**容量ガード 10MiB 超 400**/正常・Commit 正常〔dupAction 既定 skip〕/add)。
- **Vitest: 3 ケース**(rowNeedsConfirmation)。全体 538 通過。`pnpm lint`(tsc)・`vite build` 緑。
- **レビュー取り込み(第1回・指示書代替)**(fresh subagent → 自動トリアージ。詳細 `docs/progress/phase3/m13-01-review.md` 末尾): 採用 6 / 不採用 4(不採用は中1・低3、理由付き)。**「高」指摘の不採用ゼロ**。採用分 = zip 解凍爆弾ガード + body 上限、ParseSetupsCSV の UTF-8 検証、テスト 6 ケース追加。
- **レビュー取り込み(第2回・チェックリスト準拠)**: 専用チェックリスト `docs/instructions/phase3/reviews/M13-01-review-checklist.md`(設計担当作成・初回実行時は不在→後日配置)に厳密準拠して fresh subagent 再レビュー。詳細 `docs/progress/phase3/m13-01-review-checklist.md`。**§9 重大ゼロ・完了承認可**。自動トリアージ: 採用 3(handler httptest 6 ケース新設〔CLAUDE.md §5 準拠〕・starter 正規化の明示追記・export サイレント打ち切りの slog 警告)/ 不採用 2(理由付き)/ 質問は実機確認で解決。
- **既知の制約**: PDF/PNG/クリップボード = M13-02。英語ロケール除外。**上書き(重複動作)未実装**(CHANGE-051)。
- **E2E**: `web/e2e/combo-csv-io.spec.ts` を追加(インポート プレビュー→一部除外→実行→レポート→一覧反映 + エクスポート zip DL、self-contained・draft 取込で冪等)。**devContainer で実行・1 passed を確認済み**(2026-06-28)。**開発者環境で `make e2e` 全 spec 実行 = 14 passed + 1 flaky(`combo-crud.spec.ts` はコールドスタート由来のフレークでリトライ通過=非回帰。M13-01 無関係)を確認**(チェックリスト §4.3/§7 質問1 解決)。当初 Playwright ブラウザの DL が FFmpeg で失敗したが `NODE_OPTIONS=--dns-result-order=ipv4first pnpm exec playwright install chromium-headless-shell` 再試行で取得でき(初回失敗は transient)、webServer 自動起動(`go run` + `pnpm dev`・reuseExistingServer)でグリーン。`make e2e` の 1 段目 `playwright install chromium` が FFmpeg DL で稀に止まる場合はブラウザ取得済みなら `pnpm e2e` 直叩きで可。

## M13-02: コンボ PDF / PNG / クリップボード エクスポート(FR402/403/404)実装(2026-06-28)

人が見る形式(FR402 PDF / FR403 PNG / FR404 クリップボード)を画面13 エクスポートへ追加。**正道方針**(単独=詳細・複数=比較表・セットプレイ同梱・FR404 HTML クリップボード新規)。先行内製成果物 `autopilot-combomgr/projects/combo-export-image` の **PNG/PDF ラスタ化コアをソースコピー**し、比較表・setups 同梱・FR404・表示項目選択は本体側で新規付加。**生成はすべてフロント側**(DOM→画像/PDF、Clipboard API)で、新規 BE エンドポイント・サーバ FS 書込はゼロ(Go 変更なし)。

### Plan Mode 確定方式(指示書 §3.4 全 7 項目)

- **統合範囲**: `combo-export-image` から **ラスタ化コアのみ**(`capture.ts`=html-to-image / `pdf.ts`=pngToPdf / `types.ts`)を `web/src/features/combo-io/export-image/` へコピー。render 層(`demo/list`)は日本語固定・setups/比較表なしのため不使用、出力レイアウトは本体既存表示と整合させ React で新規。依存追加 `html-to-image@1.11.13` / `pdf-lib@1.17.1`(ともに `node_modules` 実体で **MIT 確認**)。
- **単独 vs 比較表の切替**: 出力対象コンボ数で決定(1=詳細§5.6 / 2 件以上=比較表§5.8)。`ComboExportDocument` の `data-export-mode` で表現。
- **setups 同梱**: コンボ直下に「名称: レシピ」(名称未設定はレシピのみ)を並べ、全形式に同梱(CSV の別ファイル方式とは別思想)。
- **FR404 形式**: `ClipboardItem({"text/html": <table>, "text/plain": TSV})` を `navigator.clipboard.write`。単独=2 列(項目|値)、複数=列:各コンボ/行:項目。フォールバック階段(write→writeText→throw)。
- **ラスタ/ベクター**: **ラスタ**採用(DOM→PNG→PDF・日本語はブラウザフォント解決)。ベクター PDF は後続。
- **表示項目選択**: `export-items.ts EXPORT_ITEMS` を**単一の真実源**とし、画像レイアウト・クリップボード双方が同じ `buildComboFields` を参照。既定全選択・キャラ名/始動状況は常時出力。
- **生成所在**: フロント生成のみ。対象は参照系 `GET /api/combos`(ID 解決)+ `GET /api/combos/{id}`(setups/steps 込み詳細)から取得。BE 追加なし。

### 成果物

- `web/src/features/combo-io/export-image/`(`capture.ts`/`pdf.ts`/`types.ts`〔ソースコピー〕・`render-and-capture.tsx`〔画面外 React 描画→capture→DL〕)
- `export-items.ts`(表示項目定義)・`export-model.ts`(値整形 = 既存 `features/combo/utils`・`customStates` 再利用)・`export-layout/ComboExportDocument.tsx`(単独/比較表レイアウト)・`clipboard.ts`(HTML 表/TSV/ClipboardItem)・`export-data.ts`(range→ids→詳細取得)
- `pages/ComboExportPage.tsx`(形式選択 csv/pdf/png/clipboard + 表示項目 UI。**CSV 経路は不変**)・`combo-io/api.ts`(`triggerDownload` を export 公開)
- `web/package.json`(html-to-image / pdf-lib 追加)

### 自己テスト結果

- **Vitest 28 ケース新規**(export-model 8 / clipboard 12 / ComboExportDocument 4 / render-and-capture 4)。形式別生成・単独/複数のレイアウト選択・setups 同梱・ClipboardItem(html+plain)+ フォールバック 4 経路・表示項目選択・日本語/エスケープ・後始末を網羅。**全 566 件通過**(既存非回帰)。`pnpm lint`(tsc)・`vite build` 緑。
- **レビュー取り込み**(チェックリスト `docs/instructions/phase3/reviews/M13-02-review-checklist.md` 準拠・fresh subagent → 自動トリアージ。詳細 `docs/progress/phase3/m13-02-review.md` 末尾): **§9 重大ゼロ・「高」指摘ゼロ**。採用 = 出典ヘッダ license 表記の正確化 + 画像警告閾値 30→20 + 本 DoD ドキュメント整備。不採用 3(低・理由付き = 同時取得上限/即時 revoke〔既存流用〕/行順)。
- **既知の制約**: ラスタ PDF(テキスト非選択。ベクターは後続)/ ページ分割なし(対象多数は canvas 上限 16384px・閾値 20 で事前警告)/ 日本語はブラウザフォント依存。
- **手動/E2E**: 画像生成の実描画・スプレッドシート貼付の表化目視・各ブラウザのクリップボード権限挙動は手順書/実機で別途確認(§5.2)。

### 設計担当への申し送り(実装で具体化した出力契約・DES 反映要否は設計判断)

- **比較表の既定項目が §5.8 の列挙を上回る(superset)**: 既定で `driveDamage`/`driveStart`(ドライブゲージ開始残量)/`saStart`(SAゲージ開始残量)/`situation`/`customStates` も比較表に出る(§5.6 詳細項目を含む)。表示項目選択で解除可・**詳細と比較を単一真実源で兼ねる**ための設計。§5.8「全項目常時表示」列挙との厳密な齟齬の許容可否、DES-005 §5.8/§5.13 の明確化要否を設計判断されたい。
- **比較表のセットプレイ列**: §5.8 は「名称一覧(名前未設定時はレシピ先頭)」だが、本実装は同梱方針(§5.13「コンボの下にセットプレイ」)と統一して「名称: フルレシピ」を出す(richer 方向)。
- **FR404 クリップボード HTML 形式**: `<table border="1">`、単独=2 列(項目|値)/複数=列:各コンボ・行:項目。改行は HTML `<br>`、TSV は ` / ` 畳み・タブは空白化(行崩れ防止)。HTML エスケープあり。
- **行順**: 出力は `EXPORT_ITEMS` 配列順(recipe→damage→…→oki 6 行→setups→tags→memo)。§5.8 の行順(damage→route、有利フレームは oki の後)と一部相違(レイアウト細部)。

---

## M14-01: スキーマ整理(moves 観測不能6列削除＋recovery 追加＋raw_data 退避キー除去)(2026-06-30 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go build ./...` | ✅ |
| `go test ./...` 全通過 | ✅ |
| `cd web && pnpm exec tsc --noEmit`(lint) | ✅ |
| `pnpm exec vitest run` 全通過(566 テスト) | ✅ |
| migration 000018 up/down 検証(`TestRun_Migration000018_SchemaCleanup`) | ✅ |
| レビュー(fresh subagent)→自動トリアージ取り込み(`docs/progress/m14-01-review.md`) | ✅ 重大ゼロ |
| 進捗ログ更新 | ✅ |

### Plan Mode 着手前確認(指示書 §3.4 の7項目・実コードで裏取り)

1. **削除6列の消費者 grep = 0 件**: DB列名・Go フィールド名・TS フィールド名の3表記で全数 grep。recipe_cache/比較/一覧/combo 経路に消費なし(残ヒットは M14-01 注記・温存する import 本体・削除検証テストのみ)。`damage` は削除対象外で温存。
2. **参照経路の全列挙**: Go 11 ファイル + FE 3 ファイル + マイグレを網羅(下記成果物)。
3. **recovery 仕様**: INTEGER・NULL 可・手入力。model/DTO(MoveResponse 一覧・MoveDetailResponse 詳細・UpdateMoveRequest)/repository(MoveListItem・UpdateMoveFields・全SQL・scan)/FE 型/MoveEditGrid に追加。一覧レスポンスにも露出(グリッドが一覧データで編集する導線のため)。既存 ryu 56 行は NULL 据置(backfill は M14-03)、total 非再計算。
4. **raw_data UPDATE 方式**: SQLite `json_remove` で退避5キー(command/condition_ja/condition_en/properties_extra/import_notes)のみ除去、notes/notes_tool 温存。除去後の空オブジェクト行は `json_each` カウント 0 判定で NULL 化。`json_remove`/`json_each` の modernc.org/sqlite 動作はマイグレテストで実証。
5. **マイグレ 000018 技法**: plain `ALTER TABLE moves DROP COLUMN`(SQLite 3.35+、前例 000008/000013)。削除6列は索引・FK 非参照のため再構築不要。ALTER と UPDATE のみで子行 DELETE を伴わず FK=OFF×明示DELETE 同居なし(digest §5)。down で6列を元型(TEXT/INTEGER)復元・recovery 削除(値・退避キーは復元不可=000008/000013 down と同方針)。
6. **警告再導出の縮小**: WarningCode から `unknown_properties`/`unknown_combo_scaling_key` を撤去、StoredMove/DeriveStoredWarnings から削除列参照を除去、`total_null`/`extra_throw`(+取込時 `recovery_word`)は温存。movesimport パッケージ・取込エンドポイント・画面17 は温存(削除は M14-02)。FE move-warning.ts(共有SSOT)も温存。
7. **total の扱い**: 既存行 stored 据置・再計算なし。

### 成果物(修正・作成ファイル)

- **マイグレ(新規)**: `migrations/000018_cleanup_moves_unobservable_columns.{up,down}.sql`
- **Go**: `internal/model/move.go`・`internal/model/doc.go`・`internal/api/move/{dto,handler}.go`・`internal/repository/move/{repository,queries,edit,upsert,rush}.go`・`internal/service/movesimport/{types,warning,parse}.go`・`internal/service/move/service.go`・`internal/api/movesimport/dto.go`
- **FE**: `web/src/features/moves/{types.ts,MoveEditGrid.tsx}`(move-warning.ts は温存)
- **テスト**: `internal/infra/migration/migrate_test.go`(000018 up/down + 退避キー除去 + recovery NULL 据置)・`internal/api/move/handler_test.go`・`internal/service/move/service_test.go`・`internal/service/movesimport/{warning,parse}_test.go`・`internal/service/combo/service_test.go`・`web/src/features/moves/MoveEditGrid.test.tsx`

### 自己テスト結果(ケース数)

- **Go**: 全パッケージ通過。新規/更新 = マイグレ 000018 専用テスト 1(up: 6列消失・recovery 追加・退避5キー除去・notes/notes_tool 温存・空→NULL化、down: 6列復元・recovery 削除)、handler PATCH recovery 更新・反映 1、warnings 縮小(unknown_* 不在)1、warning_test の unknown ケース撤去、service の properties 検証撤去→raw_data 検証へ振替 1。`dbtest.Setup` 経由で全既存テストが新スキーマで通過(M9-1 波及)。
- **FE**: Vitest 全 566 通過。MoveEditGrid 14 ケース(recovery 整数が `{recovery:13}` で PATCH に乗る・削除6列欄なし・notes_tool 非回帰・warnings から撤去2コード除去・aria-label 日本語化)。tsc clean。

### 既知の制約

- 既存 ryu 56 行の `recovery` は NULL 据置。配布 seed 投入・recovery backfill は **M14-03**。
- `total` 既存値は据置(再計算しない)。
- raw_data 退避5キーと削除6列の値は down で復元不可(schema のみ復元)。
- `service/movesimport` の `validateComboScaling`/`comboScalingKeys`(呼出元消失で未使用化)・`normalizeProperties`/`IsKnownProperty` は M14-02 まで温存(パッケージ整理は M14-02 越権回避)。

### M14-02 への followup(レビュー自動トリアージ由来・取りこぼし防止)

- **(F1)** `internal/service/movesimport/parse.go` の `validateComboScaling`/`comboScalingKeys` が未使用化。M14-02 の movesimport 整理で除去すること。
- **(F2)** FE `web/src/features/import/types.ts` の `comboScaling`(およびプレビュー欄)と backend `internal/api/movesimport/dto.go previewRowDTO`(M14-01 で2フィールド削除済)のテンポラリ契約ずれ。M14-02 の画面17 削除タスクに含めること。

### 設計担当への申し送り(実装で具体化した点・DES 反映は設計判断)

- **DES-003 §3.3(moves 列・raw_data キー構造)**: 観測不能6列削除・`recovery INTEGER`(NULL 可・手入力)追加・raw_data 退避5キー除去(notes/notes_tool 温存、空→NULL化)を反映する CHANGE(054〜)が必要。
- **DES-005 §5.18(技編集グリッド)**: properties の Select 編集欄・combo_scaling の詳細編集欄を削除し、recovery 整数入力欄(列「硬直」、既存 total/フレームと同方式)を追加。表示列の properties→recovery。
- **DES-002 §4.2(GET/PATCH /api/moves)**: PATCH フィールドから削除6列を除去し recovery を追加。GET warnings 再導出から `unknown_properties`/`unknown_combo_scaling_key` を縮小(`total_null`/`extra_throw` のみ)。
- **実装上の具体化**: (a) raw_data 空オブジェクト行は NULL 化(DES-003「空なら省略」準拠)、(b) recovery FE は整数入力(`parseNum`、`-`/`e`/`.` は `Number.isFinite` で弾く既存方式)、(c) `MoveResponse`(一覧)にも recovery を露出(グリッドが一覧データで編集初期値を取るため)。

---

## M14-02: 取込パイプライン段階削除(共有シンボル中立移設→movesimport 削除→画面17 除去・FR704 降格)(2026-06-30 完了)

### 完了ステータス

| チェック項目 | 結果 |
|-------------|------|
| `go build ./...` | ✅ |
| `go vet ./...` | ✅ |
| `go test ./...` 全通過 | ✅ |
| `cd web && pnpm tsc --noEmit` | ✅ |
| `pnpm build` | ✅ |
| `pnpm vitest run` 全通過(554 テスト) | ✅ |

### Plan Mode 着手前確認(指示書 §3.4 の 7 項目・実コード確認)

1. **共有シンボル再 grep**: `service/movesimport` を参照する温存側は `internal/api/move/dto.go`(`WarningCode`)・`internal/api/move/handler.go`(`StoredMove`/`DeriveStoredWarnings`)の **2 ファイルのみ**。`service/move/service.go:124` はコメント言及のみ。**`IsKnownProperty` の実消費者はゼロ**(M14-01 で properties PATCH 検証を撤去済み)→ 移設せず削除。repository `UpsertMove`/`UpsertOfficialJaAlias` は取込専用と確認(技編集は `ListByCharacter`/`GetByID`/`UpdateFields`/`InsertRushVariant` のみ使用)。
2. **移設先・対象**: 中立パッケージ `internal/service/movewarning` を新設(§9.2 許容の命名)。`WarningCode` 型+値 `total_null`/`extra_throw`・`StoredMove`・`DeriveStoredWarnings` を移設。`recovery_word` は取込 parse 専用のため移設せず movesimport と共に消滅。依存方向を技編集→movewarning の一方向へ。
3. **movesimport 削除範囲**: `internal/service/movesimport/`(types/warning/parse/service + 3 テスト、F1 dead code `validateComboScaling`/`comboScalingKeys` 含む)・`internal/api/movesimport/`(handler/routes/dto〔F2 previewRowDTO〕)。`cmd/combomgr/main.go` の import 2 行・wiring・ルート登録を除去。
4. **画面17・FE 取込削除範囲**: `web/src/features/import/`・`web/src/pages/ImportMovesPage.tsx`(+test)・`web/e2e/import-moves.spec.ts`。`router.tsx`/`Header.tsx` の導線除去。`move-warning.ts` は温存(死蔵ラベル整理のみ)、`features/moves/` は無編集。
5. **エンドポイント・テスト除去**: `RegisterRoutes` 除去で `POST /api/import/moves`・`/preview` 未登録。取込テスト除去後 `dbtest.Setup` 経由の残テスト全通過(参照切れ無し)。
6. **FR704 降格 CHANGE スコープ**: 製造は REQ/DES 直接編集せず。`docs/progress/m14-02-design-handoff.md` で設計担当へ申し送り(CHANGE-055 起票材料)。
7. **段階削除順**: G1 中立作成 → G2 参照差し替え → G3 movesimport+取込 repo メソッド削除 → F1 画面17/FE 削除+SSOT 整理。各段階で `go build`/`tsc` が通る順序をコミット単位で担保(994d4da=Go、b4cdd5c=FE)。

### Plan Mode 開発者確定事項(2026-06-30)

- **決定1**: `move-warning.ts` の死蔵3ラベル(`recovery_word`/`unknown_properties`/`unknown_combo_scaling_key`)を整理し `total_null`/`extra_throw` のみへ縮小。M14-01 が M14-02 へ繰延したフォローアップを消化。**指示書 §1.3「消失コードのラベルは M14-01 で整理済み」は実態と乖離**(実際は move-warning.ts に残存していた)。§2.5 例外条項により実コードを正とし、指示書は本サブ着手前に開発者が §1.3/§2.2/§2.4 を是正済み。
- **決定2**: 取込専用 repository メソッド `UpsertMove`/`UpsertOfficialJaAlias`(`upsert.go`・interface 宣言・`fakeRepo` モック2メソッド)を併せて削除。技編集の挙動は不変(未使用メソッドのみ除去)。

### 成果物

- **新規**: `internal/service/movewarning/movewarning.go`・`movewarning_test.go`。
- **修正**: `internal/api/move/{dto,handler}.go`(参照差し替え)・`cmd/combomgr/main.go`(wiring/ルート除去)・`internal/repository/move/repository.go`(interface 縮小)・`internal/service/move/service.go`(stale コメント整理)・`internal/service/move/service_test.go`(fakeRepo 縮小)・`internal/service/comboio/csvcore/rules.go`(stale コメント整理)・`web/src/router.tsx`・`web/src/components/Header.tsx`・`web/src/constants/move-warning.ts`(死蔵ラベル整理)。
- **削除**: `internal/service/movesimport/`・`internal/api/movesimport/`・`internal/repository/move/upsert.go`・`web/src/features/import/`・`web/src/pages/ImportMovesPage.tsx`(+test)・`web/e2e/import-moves.spec.ts`。

### 自己テスト結果(ケース数)

- **Go**: 全パッケージ通過。新規 = 中立 `movewarning` の `DeriveStoredWarnings` 単体テスト 5 ケース(total_null 付与/非付与・extra_throw 3件目以降・キャラ単位独立採番・非throw無視・空スライス形状)を `warning_test.go` から移植。技編集(`api/move` handler_test・`service/move` service_test)が中立参照で不変通過。`dbtest.Setup` 経由の全残テスト通過・取込テスト除去後の参照切れ無し。
- **FE**: Vitest 554 全通過・tsc clean・`pnpm build` 成功(画面17 削除で F2 契約ずれ解消)。画面18 warnings 表示は `move-warning.ts`(live 2 種)経由で不変。

### F1/F2/F3 の解消

- **F1**(movesimport parse.go dead code): movesimport パッケージ削除で解消。
- **F2**(FE `import/types.ts comboScaling` と backend previewRowDTO の契約ずれ): 画面17・features/import・movesimport 削除で両端消滅し解消。
- **F3**(取込が退避キーを raw_data に再生成し続ける一時状態): 取込パイプライン削除で恒久解消。**「M14-01〜M14-02 間は取込実行禁止」ガードレールは不要化**。

### 既知の制約・followup

- **moves-edit E2E の seed 依存(M14-03 へ繰延)**: `web/e2e/moves-edit.spec.ts`(温存対象=画面18 E2E)は編集対象 move を取込画面(`/import/moves`)経由で seed していたが、取込削除で seed 経路が消失。move 新規作成 API が存在しない(POST /api/moves なし)ため、**`test.describe.skip` + TODO(M14-03)で保留**(Plan Mode 回答 2026-06-30)。M14-03 の配布 seed 投入で ken 等に編集可能 move が生えた後、import 非依存の seed 前提へ書き換えて再有効化する。
- **E2E 非回帰**: 指示書 §5.3 の「画面18 move 編集 E2E 非回帰」は上記 skip により本サブでは未実施(Playwright は開発者ゲート)。tsc/vitest は非回帰。
- REQ-001 FR704 降格・DES-002/005 反映は設計担当が CHANGE-055 起票(`m14-02-design-handoff.md` 参照)。

---

## M14-03a: 画面18 E2E 再有効化(import 非依存・ryu 対象)(2026-07-01 完了)

### スコープ(指示書 v1.0.1 是正後)

- 本サブは **画面18 E2E(`moves-edit.spec.ts`)の import 非依存 再有効化のみ**。recovery backfill(当初 a に含めた ryu/ajg 分)は **M14-03b へ移設**(指示書 v1.0.1)。**seed マイグレ 000019 は作らない**。

### Plan Mode で確認した前提破綻(指示書 v1.0.0 → v1.0.1 是正の契機)

- 指示書 v1.0.0 §3.2/§1.4 は backfill 対象に **ryu/aki/jamie/guile** を挙げていたが、**aki/jamie/guile は `000017` で完全 DELETE 済み**(characters/moves/combos/preset_aliases を FK=OFF 下で依存順に明示削除)。HEAD の moves は **ryu の 56 技のみ**(すべて `recovery=NULL`)。`migrate_test.go TestRun_SeedRowCounts` も「ajg removed in 000017」を前提。
- ryu 分の recovery 手入力値も未受領。→ §9.3 と開発者判断で **E2E 先行・backfill 全体を M14-03b へ移設**。設計担当が指示書を **v1.0.1** へ是正。詳細は `docs/progress/m14-03a-design-handoff.md`。

### Plan Mode 着手前確認(指示書 §3.4 の 5 項目・実コード確認)

1. **E2E seed 方式**: move 新規作成 API は無い。既存 seed の **ryu(56 技)**を対象に `GET /api/games/1/characters` → `GET /api/moves?character_id=<ryu>` で編集対象行を取得(combo-csv-io.spec.ts と同じ API 起点)。取込画面(削除済み)には非依存。
2. **backfill 対象と値**: ajg 非存在＋値未受領のため **backfill は M14-03b へ移設**(本サブでは実施しない)。
3. **total 整合**: backfill を行わないため本サブでは対象外(既存 total は不変。M14-03b で扱う)。
4. **マイグレ 000019 技法**: 本サブでは **作らない**。既存マイグレ 000002〜000018 も非改変。
5. **テスト追従**: 000019 を作らないため `dbtest.Setup` 波及なし。Go テスト(`migrate_test.go` 等)は変更不要。

### 成果物

- **修正**: `web/e2e/moves-edit.spec.ts`(`test.describe.skip` 解除・TODO(M14-03) 除去・22 列 CSV/取込手順を撤去し ryu 既存 seed を対象とする import 非依存 spec へ全面書換え)。
- **新規(ドキュメント)**: `docs/progress/m14-03a-design-handoff.md`(前提破綻の申し送り・followup §C-1 更新依頼)。

### E2E の設計(import 非依存・冪等)

- 対象は `category ∈ {normal, unique}` かつ `is_aerial=false`(= `isRushEligible`)の ryu 技を **id 昇順先頭で決め打ち**。再実行しても同じ行を操作する。
- recovery(硬直・M14-01 追加列)を NULL から `8`・total を `25` に手入力 → 保存 → `GET /api/moves` に `recovery=8`/`total=25` 反映を `toPass` で検証(保存トーストに非依存)。
- ラッシュ版: ボタンが有効なら生成、既存(無効)なら生成せず、いずれも `rush_<code>`(category=rush_variant・originalMoveId あり)の存在を `toPass` で検証。UI は 409 を info 化(CHANGE-032)するため二重生成でも壊れない。
- 副作用: 共有 seed(ryu)の 1 技の recovery/total を永続変更し rush 版を 1 件生成するが、他 E2E/Go テストは当該特定値に非依存(Go は dbtest 一時 DB で独立)。

### テストケース数

- **E2E**: `moves-edit.spec.ts` = 1 シナリオ(recovery/total 編集→保存→GET 反映→ラッシュ版生成→グリッド反映)。skip 解除済み。
- Go/マイグレ: 変更なし(000019 未作成)。

### 残扱い・followup

- **recovery backfill は M14-03b で実施**(ryu を含む全 recovery 手入力値を b の seed 作業へ集約)。followup-backlog §C-1 の `M14-03a-e2e` は解消・`M14-03a-backfill` は M14-03b へ移設(設計担当が §C-1 を v1.0.1 に整合)。

---

## M15-02: info-mark ヘルプ機構(⑤⑩)＋「比較対象選択」ボタン改称(③)(2026-07-03 完了)

### 完了ステータス

指示書 v1.1.0 に基づき、純 FE・データ/API 契約不変で完了。③ は info-mark ではなくボタン改称(ラベル曖昧性の根治)、⑤ は info-mark 適用、⑩ は再利用可能機構の新設。Vitest・E2E とも緑。fresh subagent レビュー(`docs/progress/phase3/m15-02-review.md`)で重大指摘ゼロ。

### Plan Mode で確定した方式(§3.3 の 5 項目・実査結果)

1. **既存 UI 流用/i18n キー**: 既存 shadcn `Popover`(`web/src/components/ui/popover.tsx`・`@radix-ui/react-popover` 導入済・`TagSelector` 実績)を**流用**(自作再発明せず・playbook §4.6)。Tooltip も存在するが未使用で `TooltipProvider` 未マウントのため、クリック/タップで開きモバイル/LAN 対応(arch §10)しやすい **Popover を採用**。`help.*` i18n キーは main で未占有を確認し新設(digest §4 占有調査)。
2. **「選択モード」実在箇所・比較専用性(③)**: `ComboListPage.tsx`＋`MyComboPage.tsx` の 2 箇所(共通 hook `useSelectMode`)。実査で**比較対象選択の専用モード**(チェックボックス→`比較`ボタン→`/compare` 遷移。一括削除/タグ等の汎用マルチセレクトは兼ねない)と確認 →「比較対象選択」名は正確。両画面が同一 i18n キー参照のため i18n 値変更のみで同時改称。
3. **modifier 付与先(⑤)**: `ModifiersEditor.tsx` の `DialogTitle "ステップ編集"` 隣に info-mark を配置(modifier 概念そのものを説明する文脈位置)。
4. **適用範囲**: **③⑤ のみ**(③＝改称・⑤＝info-mark)。他項目(メタデータ・custom-state・起き攻め等)への info-mark 網羅は後続サブへ切り分け(playbook §4.11)。
5. **DES-005 CHANGE 要否**: **不要と判定**。info-mark は既存画面要素を変えない純付加 UX。③改称は DES-005 §5.6 が機能記述「選択モードトグル」で呼ぶ範囲のラベル文言変更で、画面仕様(表示要素・データ表示)は不変=自由改訂。DES 本体は製造で直接編集していない(要と判断されれば設計担当が起票)。

### 成果物

- **新規**: `web/src/components/InfoMark.tsx`(再利用可能な ⓘ ヘルプ機構。shadcn Popover 流用・lucide `Info`・`type="button"` でフォーム送信副作用なし・クリック/タップで開く)＋ `web/src/components/InfoMark.test.tsx`。
- **新規**: `web/e2e/m15-02-info-mark.spec.ts`(③改称スモーク・コンボ一覧+マイコンボの 2 画面パラメタライズ・seed 非依存 self-contained)。
- **修正**: `web/src/features/combo/components/ModifiersEditor.tsx`(`useTranslation` 追加・DialogTitle 隣に `InfoMark topic="modifier"`)＋ `ModifiersEditor.test.tsx`(info-mark 2 ケース追記)。
- **修正**: `web/src/locales/ja.json` / `en.json`(`help.modifier` 追加・`selectMode.enter` を「選択モード」→「比較対象選択」/「Select Mode」→「Select to Compare」へ改称。`locales.test.ts` の双方向 parity 維持のため en も同時追加)。

### test-id 命名規約(後続 M15 サブ参照・code-facts 再生成では捕捉されない)

- info-mark は **`info-mark-<topic>`** 系統(⑤＝`info-mark-modifier`。Popover 本文は `info-mark-<topic>-content`)。M15-01 の `combo-editor-*`(M15-overview §4.7.1)と**別系統で非衝突**。
- ③(改称)は info-mark を持たず、既存の選択モードボタンの test-id/導線を温存(ラベル文言のみ変更)。

### 適用箇所一覧

- ③(改称): `ComboListPage.tsx` / `MyComboPage.tsx` の 選択モード enter ボタン → ラベル「比較対象選択」(i18n `selectMode.enter`)。
- ⑤(info-mark)は 2 箇所(開発者フィードバックで追加):
  - `ModifiersEditor.tsx` DialogTitle 隣(topic=`modifier`・i18n `help.modifier`)= 編集ダイアログを開いた後の説明。
  - `RecipeBuilder.tsx`(コンボ編集)の「編集ボタンについて」見出し横(topic=`recipe-modifier`・i18n `help.recipeModifier`)= **追加ボタンの下・最初の編集ボタンの上**に配置し、編集を押す前に説明が読める。ステップ 1 件以上のときのみ表示(0 件時は編集ボタンが無いため非表示)。**当初レシピ legend 横に置いたが「分かりにくい」との指摘でこの位置へ移設**。
  - `SetupRecipeEditor.tsx`(セットプレイ編集)にも同じ「編集ボタンについて」見出し横(topic=`setup-recipe-modifier`・`help.recipeModifier` 再利用)= コンボ側と同一 UX(追加ボタンの下・最初の編集ボタンの上・ステップ1件以上で表示)。SetupRecipeEditor も `ModifiersEditor` を再利用するためダイアログ側 info-mark(topic=`modifier`)も同時に効く。
  - 各箇所は同画面(編集ダイアログ表示中)で共存し得るため **topic を分離**(test-id 重複回避): `modifier`(ダイアログ)/`recipe-modifier`(コンボレシピ)/`setup-recipe-modifier`(セットプレイレシピ)。

### テストケース数

- **Vitest**: InfoMark 単体 4 ケース(トリガ test-id 解決/未クリック時 content 非表示/クリックで説明表示/フォーム内クリックで submit 非発火)＋ ModifiersEditor 追記 2 ケース(info-mark-modifier 描画/クリックで説明表示・保存副作用なし)＋ RecipeBuilder 追記 3 ケース(ステップ1件以上で「編集ボタンについて」+info-mark 描画/0件で非表示/クリックで説明表示)＋ SetupRecipeEditor 追記 2 ケース(ステップ1件以上で描画/0件で非表示)。フロント全体 571 テスト緑(95 ファイル)。
- **E2E**: `m15-02-info-mark.spec.ts` = 2 ケース(コンボ一覧・マイコンボ各: ラベル「比較対象選択」表示・旧「選択モード」不在・押下で件数バッジ+選択解除出現・解除で復帰)。⑤ modifier の info-mark は E2E に含めず Vitest 担保(レシピ手順は move セレクタ test-id 不在で E2E では脆いため)。`make e2e` 既存スイート非回帰(16 passed。`moves-edit`/`combo-custom-states` に既存の timing flake がありリトライで緑・本変更と無関係)。

### 既知の制約・残扱い

- ⑤ modifier の info-mark 表示検証は **Vitest(`ModifiersEditor` 直接描画)で担保**。レシピ手順を E2E で組む方式は move セレクタに test-id が無く脆く前例も無いため**意図的に §5.2 のフル E2E から逸脱**(指示書 v1.1.0 §5.1 で決定済み)。
- 説明文は日本語のみ(英語ロケールは parity 維持のためキーのみ英訳を投入)。M16 依存概念(始動 vs 消費・技/非技 taxonomy)には踏み込まず(M15-07 の領分)。
- info-mark の他項目(メタデータ・custom-state・起き攻め等)への網羅は後続サブ or opportunistic。
- `make e2e` 実行時、`moves-edit.spec.ts` が pre-existing flaky(バックエンド rush-variant 生成の 30s タイムアウト)で 1 回失敗→リトライ成功。本サブの変更(info-mark・ラベル改称)とは無関係。

---

## M15-05: 表示整理・縦スクロール軽減(FB①)＋比較画面 生 ID バグ(FB②)(2026-07-04 完了)

### 完了ステータス

指示書 v1.0.1 に基づき、①②とも純表示層・非スキーマ・非破壊で完了。Vitest(FE 607 緑)・Go 全テスト・`make e2e`(18 緑)・本番ビルド緑。fresh subagent レビュー(`docs/progress/phase3/m15-05-review.md`)で**重大(高)/中の指摘ゼロ**・低のみ。

### ②比較画面 生 ID バグ ― 真因(症状≠真因)と修正層

- **症状**: 比較画面のみ始動技が「始動技#<id>」の生 ID 表示。一覧/詳細は正常。
- **真因層 = BE `repository.FindByID` の `StarterMoveCode` 補完漏れ**。共有ヘルパ `formatStarterStatus`(`web/src/features/combo/utils.ts:47`)は `starterMoveCode` が空だと生 ID にフォールバックする。比較は `useCompareCombos` → `GET /api/combos/{id}` → `service.Get` → `FindByID` 経由だが、`List`(`repository.go` の `findMoveCodesByIDs` バッチ補完)と異なり `FindByID` は `StarterMoveCode` を埋めていなかった。詳細画面はレシピ steps から技名を出し `formatStarterStatus` を使わないため露見せず、比較だけが詳細エンドポイントのデータを共有ヘルパに流して症状化していた。指示書 §3.3-2 の候補 **(b) 詳細クエリに名称が来ていない**が真因。
- **修正**: `FindByID` で `StarterMoveID != nil` のとき **List と同一の `findMoveCodesByIDs` を再利用**して補完(自作再発明なし)。**API 契約・スキーマ・DTO 不変**(既存 `starterMoveCode` を埋めるだけの加算的修正)。一覧/詳細の正しい表示は不変(正しい側を壊さない)。作成/更新後の `FindByID` 経由レスポンスにも技コードが乗り整合が向上。

### ①縦スクロール軽減 ― 方針(開発者選定)と実装

- **狭幅の理由実査**: 現行 `max-w-3xl` 単一縦積みは form 系ページ共通デフォルトで**当画面固有のレスポンシブ意図なし**(データ表示系は `max-w-7xl`)= 指示書 §3.3-4 の(b)。**DES-005 §5.7 は「PC:仮想コントローラと入力フォームを横並び可」/§5.6 は「PC 2カラム」を既定済み(未実装)**。
- **サンプル HTML 3案(planA ver1/2/3)＋ before を製造が作成**(`tmp/prototype-20260704/`・非コミット)し開発者が目視選定 →**ver2+ver3 複合**を採用。
- **実装**: `ComboEditorPage` を `max-w-3xl`→`max-w-6xl`。`ComboEditor` を PC(lg+)で**非対称2カラム**(`lg:grid-cols-[5fr_7fr]`・左=基本情報系/右=レシピ広め〔仮想コントローラが広いため〕+セットプレイ)、lg 未満は単一カラムへ落ち**従来のモバイル縦積みを維持**。**起き攻め/マイコンボ/タグ**を新規 `CollapsibleFieldset`(fieldset 見た目維持の軽量ラッパ・**初期展開**・`aria-expanded`/`aria-labelledby`/`aria-controls` 付与)で折りたたみ可に。**キャラ固有状態は折りたたまず**、複数時に横並び(auto-fit)。**全項目温存・機能不変**。
- **既存部品は内部不変で流用**: `RecipeBuilder`(全技一覧プルダウン含む・仮想コントローラに載らない技のため必須)/`VirtualController`/`TagSelector`/`SetupRegistrationSection`・`SetupInputRow`(ステップ毎編集)。
- **状況入力(position/stance/hit/size)は現行グリッドに混在のまま**(将来のプルダウン→ボタン化は別途・開発者確定)。

### test-id 命名(後続 M15 サブ参照)

- 折りたたみ節に **`combo-editor-<section>-section`**(`oki`/`mycombo`/`tag`)を新設。既存 `combo-editor-<field>`(M15-01)/`combo-editor-okiMeatyNeutralTechThrow` 等と `-section` サフィックスで非衝突。

### DES-005 CHANGE 要否(§3.3-5 判定)

- **①②とも不要**。① は §5.7/§5.6 の既定レスポンシブ(PC 横並び/2カラム)の実装で画面仕様・項目不変。② は §5.8「始動技(技名)」表示の**バグ修正**(生 ID は仕様外)。製造は DES 本体を直接編集していない。

### テストケース数

- **Go**: `TestRepository_FindByID_StarterMoveCode`(有効 ID→補完 / nil→nil の 2 ケース。`List` テストのミラー)。
- **Vitest**: `CompareTable` に②回帰 1 ケース(技名表示・生 ID 非表示・実装非依存)/`ComboEditorBasicFields` に①の 全項目温存 1・折りたたみ初期展開 1・トグル動作 1 の計 3 ケース。FE 全体 607 緑。
- **E2E**: `make e2e` 既存 18 スイート非回帰(combo-crud=編集フロー/custom-states/B-7 仮想コントローラ 含む緑)。実画面スクショ(PC 2カラム/スマホ単一)で目視確認。

### モデル・レビュー

- ② の真因は BE(FindByID)まで及んだが修正は既存ヘルパ再利用の小規模のため Opus 格上げ不要(セッション Opus 4.8 で実施)。fresh subagent レビュー重大指摘ゼロ。低指摘のうち a11y(aria 付与)・全項目温存テスト・本 progress-log 追記を採用、FindByID 追加クエリ(意図的・軽微)・legend の JP ハードコード(コンポーネント全体の既存課題)は不採用として記録。

### 既知の制約・残扱い

- キャラ固有状態の横並びは Ryu が 1 状態のため**実機での複数横並びは未検証**(実装先行)。複数状態キャラ登場時に目視確認。
- 情報過密の最終判断は静的コード外(実機操作)。開発者スクショ確認で非悪化を確認済み。
- `CollapsibleFieldset` の legend は JP ハードコード(`ComboEditorBasicFields` 全体が i18n 未適用の既存課題。将来 i18n 化時に本節も対象)。

### ラウンド2(2026-07-04・開発者追加要望・一部スコープ外を同時実施)

ラウンド1後の追加要望(登録/編集画面のさらなる縦圧縮・入力体験改善)。全 FE 表示層・非スキーマ・非破壊。Vitest 615 緑・`make e2e` 18 緑・本番ビルド緑・実画面スクショ(PC/スマホ)確認済み。

- **全セクション折りたたみ化**: 基本情報/キャラ固有状態/起き攻め/その他情報/レシピ/セットプレイを `CollapsibleFieldset` 化(**初期=全展開**=開発者確定)。
- **メモ/マイコンボ/タグを「その他情報」節に統合**(中身は内部不変)。
- **仮登録トグルをキャンセル導線の隣へ + Checkbox→shadcn Switch**(ラッシュ版と同一部品)。edit は基本情報末尾で Switch。testid `combo-editor-draft-checkbox` 据置(Radix Switch も click 応答、E2E 非回帰確認)。
- **キャラ固有 bool(電刃錬気)を Checkbox→Switch**(off で `undefined` 維持)。testid 据置。
- **キャラクター選択をコンパクト化**(単一行・小アバター+プルダウン、大名前の重複除去)。
- **⑩ レシピ「一目で分かる欄」**: 新規 `formatRecipeLine(steps, moves)`(`utils.ts`)で編集中 steps を**技名(公式日本語/nameJa)1行**に整形し、レシピ節・各セットプレイ行に**常時表示のサマリ**(`CollapsibleFieldset` の `summary` スロット新設)。**枠は再利用可能**に作成。
- **既存部品は機能内部不変**: `RecipeBuilder`(全技プルダウン/`VirtualController`/step 編集)・`TagSelector`・`SetupRecipeEditor`。折りたたみ/サマリのため外枠 fieldset→`CollapsibleFieldset` へ差し替えたのみ。
- **テスト**: `formatRecipeLine` 5 ケース、`RecipeBuilder` サマリ/折りたたみ 3 ケース、`ComboEditorBasicFields` の flag アサーションを `role="switch"` へ更新・節統合に追従。

#### ⚠ DES-005 §5.7 CHANGE 要(設計担当が起票)

本ラウンドは §5.7 の表示項目/レイアウト仕様の改訂を伴う。**製造は DES 本体を編集していない**。設計担当は以下を反映して起票のこと:
- 表示項目1・2(キャラクター情報バー+プルダウン)の**コンパクト単一行化**(大名前の重複除去)。
- 表示項目3(仮登録トグル)の**キャンセル導線隣への配置 + Switch 化**。
- 表示項目6(キャラ固有 flag)の **Switch 表記**(§5.7 は既に「type=flag→トグル」と規定=表記整合)。
- メモ/マイコンボ/タグ(表示項目11-13相当)の**「その他情報」グルーピング**。
- 各セクションの**折りたたみ(初期展開)**、レシピ節の**技名1行サマリ欄の新設**。

#### ⚠ 残課題(⑩ の正規 notation 解決・設計/BE 連携)

- ⑩ のサマリは**クライアント側の技名近似**。サーバの正規 notation(`GET /api/combos/:id/recipe`・プリセット解決)は**保存済み combo id 必須**で編集中は取得できず、かつ**プリセット未実装**で現状は公式日本語へフォールバックするため技名で近似した。将来、編集中(未保存)レシピに対する正規 notation 解決(プリセット適用)を提供する場合は BE/設計の対応が必要。`formatRecipeLine` の呼び出し箇所を差し替えれば移行可能な設計にしてある。

---

## M15-06: 初回オンボーディング(FB⑯)(2026-07-04 完了)

### 完了ステータス

指示書 v1.2.0 に基づき、**⑯初回オンボーディングのみ**(⑰上級者モードは M15-05 の `CollapsibleFieldset` 折りたたみで充足済みのため対象外)を完了。非スキーマ・非破壊(DB/API/`ConfigResponse` 不変)。Vitest 641 緑(全体)・`tsc -b --force` 差分ゼロ・`make e2e` 18 緑・fresh subagent レビュー(`docs/progress/phase3/m15-06-review.md`)で**重大(高)指摘ゼロ**(高2件はいずれも本報告書の欠落そのものが原因であり、本追記により解消)。

### Plan Mode 確定内容(指示書§3.3 #1〜#5)

1. **既存の空状態/ガイド/初回導線の実在**: 実査の結果、オンボーディング/空状態/ツアー系 UI は既存に一切なし(`WizardPage` はサーバー側 `isInitialized` フラグによる別物の初回セットアップウィザードで無関係)。`web/src/lib/browser-storage.ts` の `createLocalStorageHelper<T>` は既存(`combo-list-columns-v1` 前例あり)のため自作再発明せず流用。
2. **オンボーディングの形式と再表示**: **Home バナー(スマホ専用・`OnboardingBanner`)＋ コンボ一覧の空状態 CTA(PC/スマホ両対応)** の2本立てに確定(開発者確認・推奨案採用)。DES-005 §5.2 実査で **Home 画面はスマホ専用**(PC/タブレットは一覧へ直行)と判明したため、Home バナーのみでは PC ユーザーに届かず、一覧空状態 CTA を追加して補完。押し付けず(初期表示のみ)・スキップ可(閉じるボタン)・再表示可(設定画面)。「初回か」の判定は `onboarding-seen-v1`(localStorage・`browser-storage.ts` 経由)。簡易ツアー等の高度化は指示書§1.3のスコープ外方針どおり見送り。
3. **メニュー可読性の改善範囲**: 実査で `Header.tsx` の「現在ページ」表示と「プリセット管理」等の disabled(未実装)表示が**同一の `text-gray-400`** で視覚的に区別できない実バグを発見。開発者確認の結果、**この視覚区別修正のみ**(過度な改変をしない・最小スコープ)に確定。ナビ構成・遷移は不変。
4. **test-id・命名**: 既存規約(kebab-case・feature 接頭辞)を grep 実査した結果、Header/Footer には既存 test-id が無く、Vitest は `getByText`/`getByRole` ベースで統一されていたため、本サブでも新規 test-id は追加せず既存書式に合わせた。
5. **DES-005 CHANGE 要否**: 下記「DES-005 CHANGE 要否」節のとおり判定。

### 実装内容

- **`web/src/features/onboarding/`**(新規ディレクトリ): `onboarding-storage.ts`(`onboarding-seen-v1` キーで `createLocalStorageHelper<boolean>` を生成)・`OnboardingBanner.tsx`(Home 画面に表示・閉じるとフラグ永続化)・`OnboardingResetButton.tsx`(設定画面用・フラグ削除+toast)。
- **`HomePage.tsx`**: 主要機能ボタン群の直前に `OnboardingBanner` を追加。
- **`ComboTable.tsx`/`ComboListPage.tsx`**: コンボ0件・フィルタなしの既存空状態メッセージ(`comboList.empty`)に `newComboHref` prop 経由で新規登録 CTA リンクを追加。`ComboListPage` で文脈キャラ付き href(CHANGE-039)を一元化し、既存の情報バー内ボタンと空状態 CTA の両方へ供給(DRY化)。`hasActiveFilters`(フィルタ起因の0件)・`emptyMessage`(MyComboPage、CHANGE-039-errata により新規登録導線なし)の各分岐は非対象のまま維持。
- **`Header.tsx`**: デスクトップ nav・モバイル Sheet メニューの両方で、現在ページの `text-gray-400` を `text-blue-600` に変更(disabled 項目は `text-gray-400` のまま)。ルーティング・`pointer-events-none`・`aria-current` は不変。
- **`SettingsSectionDetails.tsx`**(設定画面「詳細」節): `OnboardingResetButton` を追加。押下で `onboarding-seen-v1` を削除し toast 表示。
- **i18n**: `onboarding.*`(bannerTitle/bannerBody/dismiss)・`comboList.emptyCta`・`settings.details.onboardingReset*` を ja/en 両方に追加。`locales.test.ts` パリティ確認済み。

### DES-005 CHANGE 要否(§3.3-5 判定)

- **CHANGE 要(設計担当が起票)**: 以下3件は DES-005 に記載のない新規表示項目のため、CHANGE-056〜058 の前例(軽微な追加表示要素も正典化)に照らして起票対象と判断する。製造は DES 本体を直接編集していない。
  - §5.2 ホーム: 初回オンボーディングバナー(表示項目リストへの追加)。
  - §5.4 コンボ一覧: 空状態時の新規登録 CTA。
  - §5.16 設定「6. 詳細」: 初回ガイド再表示ボタン。
- **CHANGE 不要**: Header.tsx の現在地/disabled 色修正。DES-005 §1 方針「具体的なビジュアルデザイン・色は含まない」に該当し、ナビ仕様・遷移自体は不変のため。

### その他の申し送り事項(製造は編集せず、設計担当/開発者への引き継ぎとして記録)

- **CLAUDE.md §10.X「許容される用途」表**: 現行は表示列カスタマイズ(`combo-list-columns-v1`)・仮想コントローラ選択保持の2件のみを列挙。新設した `onboarding-seen-v1`(初回オンボーディング表示状態・DB非対象・機微情報なし)はこの表に未収載のため、上記 DES-005 CHANGE 起票と合わせて表への行追加を検討されたい。
- **`followup-backlog.md` §A ⑯ の状態更新**: 本milestoneの完了に伴い「着手可」から更新が必要。
- **`model-allocation.md` への M15-06 実績記入**: 既存運用(各サブ完了時に実績記入)に倣った追記が必要。
- 上記3点は本製造セッションの権限外(設計・引き継ぎ系ドキュメントは開発者/設計担当チャットの管掌)のため、ここに記録するに留め、直接編集はしていない。

### テストケース数

- **Vitest**: `OnboardingBanner.test.tsx` 4 ケース(新規)・`HomePage.test.tsx` +1 ケース・`ComboTable.test.tsx` +3 ケース(newComboHref 有無・フィルタ分岐非干渉)・`Header.test.tsx` +2 ケース(現在地/disabled 区別、デスクトップ+モバイル Sheet)・`SettingsSectionDetails.test.tsx` 2 ケース(新規)。FE 全体 641 緑(既存分含む)。
- **E2E**: `make e2e` 既存 18 スイート非回帰(新バナー・新 CTA と干渉する spec が無いことを事前に grep 確認済み)。

### モデル・レビュー

- 実装は Sonnet 5(model-allocation 推奨は Sonnet 4.6)。fresh subagent レビュー(`docs/progress/phase3/m15-06-review.md`)にて重大(高)指摘2件はいずれも「本完了報告の欠落」自体を指すものであり、本追記により解消。中3件(CLAUDE.md §10.X 表・followup-backlog 状態・model-allocation 実績)は上記「その他の申し送り事項」として記録し設計担当/開発者へ引き継ぎ(製造の編集範囲外のため不採用)。低2件(設定画面での配置のやや不自然さ・英訳が意訳)は実害なしのため不採用、理由を本節に記録。

### 既知の制約・残扱い

- CLAUDE.md §10.X 表・`followup-backlog.md`・`model-allocation.md` の更新は上記のとおり本製造セッションでは未実施(権限外のため)。

### 追補(2026-07-04・開発者指摘に基づく再設計・完了後即日対応)

完了報告・レビュー後、開発者が実機確認しようとした際に**設定画面の「初回ガイドを再表示」を押しても何も見えない**ことを発見。原因を分析した結果、設計上の欠陥と判明したため即日修正した。

- **原因**: `OnboardingResetButton` は `onboarding-seen-v1` フラグを削除するのみで、フラグを参照する `OnboardingBanner` は Home 画面(`/`)にしか置かれていない。Home 画面は DES-005 §5.2 により**スマホ専用**(`App.tsx` が `!isMobile` の場合 `/` → `/combos` へ強制リダイレクト)であり、Header ロゴ等アプリ内のどこにも `/` への導線がない。**PC 幅を保って使う利用者は Home 画面へ到達する手段が無く**、フラグをリセットしても表示箇所へ辿り着けないため、ボタンは実質的に無効だった。一覧空状態 CTA(§3 参照)は「新規登録の位置」というFB⑯の一側面はカバーするが、`onboarding-seen-v1` と連動しておらず、コンボ0件の間しか出ないため、この欠陥を代替できていなかった。
- **再設計**: 「再表示」を「フラグを消して別画面の表示に賭ける」方式から、**押した場でオンボーディング内容をダイアログ表示する**方式へ変更(開発者提案)。`OnboardingResetButton.tsx` を削除し、`OnboardingGuideDialog.tsx`(新規)へ置換。`@/components/ui/dialog`(Radix Dialog、本アプリでの Dialog 系初採用。`Sheet`/`AlertDialog` は既存採用済み)を用い、`onboarding.bannerTitle`/`onboarding.bannerBody`(`OnboardingBanner` と同一 i18n キーを共有・文言重複なし)をダイアログ内に表示。`onboardingStorage` には一切触れず、Home 画面の初回自動表示ロジック(フラグ管理)とは完全に分離。ボタンラベルは自己説明的に `settings.details.onboardingShow`(「初回ガイドを見る」)へ改称(旧 `onboardingReset`/`onboardingResetDone` キーは削除)。
- **効果**: PC/タブレット/スマホいずれの画面幅でも `/settings` からその場で確認可能になり、ページ遷移・ビューポート依存が解消された。手動確認(Playwright、PC幅1280pxで`/settings`→ボタン押下→ダイアログ即時表示→Escで閉じる)で正常動作を確認。
- **テスト**: `SettingsSectionDetails.test.tsx` を全面書き換え(ボタン表示・クリックでダイアログ+タイトル文言表示の2ケース。`sonner`/`onboardingStorage` のモックは不要になり削除)。FE 全体 641 緑(既存分含む、ケース総数は差し引きゼロ)。
- 上記により「既知の制約・残扱い」に記載していた `OnboardingResetButton` 設置場所の軽微指摘(レビュー低指摘)はコンポーネント自体の置換により解消済み。

## M16-04: taxonomy 明文化＋dash 二重表現一本化(④''・G-i)(2026-07-06 完了)

指示書 `docs/instructions/phase3/M16-04-step-taxonomy-and-dash-unification.md` v1.0.0。承認ゲート G-i(破壊的移行)は開発者の個別承認を得てからマイグレ実装に着手(2026-07-06)。**移動 system move の全キャラ seed は M14-03b へ委譲**、本サブは taxonomy 原則明文化＋既存 ryu dash の移行＋再混入経路遮断に限定。

### Plan Mode 着手前確認(§3.4 の 8 項目・実コードで裏取り)

1. **modifier.type dash 全消費経路**: Go 定数 `internal/model/combo.go`(コンパイル結合先 = `internal/service/notation/resolver.go` の `nonMoveTypeText`)、FE 単一ソース `web/src/features/combo/labels.ts` `MODIFIER_NON_MOVE_TYPES`(+ dead な `DASH_MOVE_CODES`)、消費 UI(`ModifiersEditor`・`RecipeBuilder`/`SetupRecipeEditor` の 2 optgroup)を全列挙。Go に modifier.type 許容値検証は存在せず、DES-006 変更不要。
2. **recipe_hash**: `combo.CalcRecipeHash`(`internal/service/combo/duplicate_keys.go`)。SHA-256・type/flags/notes 対象・DB 列でない都度計算。steps 書換で自動追従。
3. **migratable/skip**: 所属 character に system move dash が存在すれば transform、無ければ skip。clean/user DB は ryu のみ=全件 migratable。
4. **published dup 衝突**: 現行 dev DB で 0 件(RESEARCH §C)。**開発者確定でマイグレに Go 依存の検出を積まない**(配布/新 DB は M14-03b の Go remap、既存 user DB は従来 CRUD 時強制)。
5. **cache**: 移行前後で recipe_cache の各プリセット表示文字列がバイト一致(移行前 `nonMoveTypeText`「前ダッシュ/後ろダッシュ」= 移行後 `resolveMoveStep` の official_ja_move alias フォールバック)ため **regen 不要**。
6. **alias 実査**: ryu の dash system move は `official_ja_move` に alias 実在(`migrations/000006`)。→ 000022 の alias INSERT 不発。他キャラ alias は M14-03b。
7. **000022 技法・down**: pure SQL。UPDATE-in-place のみ(digest §5 非該当)。down は逆写像(lossy/非対称)。
8. **taxonomy DES 反映**: 製造は DES 直接編集せず、CHANGE-064 見込みを伝達メモへ(`docs/handover/phase3/M16-04-to-design-memo.md`)。

§9.3 差し戻しトリガー(移行先不在が想定外に多い/dup 衝突発生/alias 実査で想定外)は**いずれも不発**。

### 実装(3 コミット)

- **Phase1(非破壊・再混入経路遮断)**: `model/combo.go` の `ModifierType` から dash 2 値削除(parry/cancel 残置)、`resolver.go` の `nonMoveTypeText` から dash 2 行削除、`labels.ts` の `MODIFIER_NON_MOVE_TYPES` から dash 削除＋dead な `DASH_MOVE_CODES` 撤去、`RecipeBuilder`/`SetupRecipeEditor` の handleAdd dash ブリッジ分岐削除(dash は「システム」optgroup の system move として選択=canonical)。`ModifiersEditor` は配列駆動で自動的に dash 消滅。
- **Phase2(破壊的・マイグレ 000022)**: migratable な modifier.type dash → 同キャラ system move dash 参照へ移行(move_id 設定・type 除去・step_order 保存・type 除去後に空になる modifiers は NULL 化=native 入力と recipe_hash 一致・flags/notes 温存)。移行先不在は `WHERE EXISTS` で skip。combo_steps/setup_steps 両方。down は逆写像(native system move dash と移行由来を区別する marker が無く lossy)。

### 移行結果(専用 fixtures による検証・dev DB 非依存)

- transform: migratable(ryu 相当)= move_id 設定・NULL 化/flags-notes 温存を確認。
- skip: 移行先不在(character_id=999 fixture・dev の ingrid #91 相当)= modifier.type dash のまま据え置きを確認。
- parry_drive_rush = 不変を確認。
- dup 衝突件数: 0(現行 dev DB・RESEARCH §C。M14-03b 後に再測定が前提)。
- recipe_hash 整合: 移行後 step が native system move dash step と同一 hash(modifiers を {} でなく NULL 化したことの確証)。
- down 逆写像: migratable 分は modifier.type dash へ復元(flags/notes 温存)・skip 分据え置きを確認。

### alias 実査結果(M14-03b seed 契約への申し送り)

- ryu の `dash_forward`/`dash_back`(system move)は `official_ja_move` プリセットに alias「前ダッシュ/後ろダッシュ」が実在(`migrations/000006`)。resolver のフォールバック(preset→base→official_ja_move→raw code)により**全 5 プリセットで生 code 表示にならず**、移行後の表示崩れなし。
- **他キャラ(ken/ingrid/c_viper/dhalsim)は system move dash 自体が未 seed**(取込由来 move には無い)。M14-03b で移動 move を seed する際、`preset_aliases` は `(preset_id, move_id)` キーのため新 move_id に既存 alias を流用できず、move seed と alias seed を対にしないと生 code 表示にフォールバックする。**M14-03b の seed 契約に含めること**。

### テスト

- **Go**: `TestRun_Migration000022_UnifyDashToSystemMove` 追加(専用 fixtures)。migratable transform / flags-notes 温存 / parry 不変 / 移行先不在 skip / setup 移行 / recipe_hash 整合 / down 逆写像。`go build`/`go vet`・`go test ./...` 全 33 パッケージ通過(`dbtest.Setup` に 000022 を含む全既存テスト通過)。
- **FE**: `labels.ts`/`ModifiersEditor`/`RecipeBuilder`/`SetupRecipeEditor`/`utils` のテストを新 taxonomy へ更新(dash は system move optgroup 経由・非技 optgroup 非表示を検証)。`tsc --noEmit`・Vitest 664 件通過。

### 既知の制約

- **down は lossy/非対称**: native system move dash(000012 の耐久性 seed combo 116 等)と移行由来を区別する marker が無いため、down は全 system move dash step を modifier.type dash へ戻す(native も modifier.type dash 化される)。移行先不在で skip した行は down でも据え置き。
- **dup 衝突検出はマイグレに非搭載**(開発者確定)。M14-03b 全キャラ seed 後にデータ量が増えた時点で再測定が前提。
- **dev DB の ingrid #91**(移行不能・取込由来 disposable)は本マイグレでは汎用 skip により無損失据え置き。削除は開発者の dev クリーンアップ作業(出荷マイグレに dev 固有 id を直書きしない)。

### DES 反映(CHANGE-064 見込み・設計担当起票)

製造は DES 本体を直接編集していない。taxonomy 原則の確定文言・dash 撤去の DES 反映(DES-004 §2.1/§2.3・DES-003 §3.5・SUPP-001 §3.3.3)は `docs/handover/phase3/M16-04-to-design-memo.md` で設計担当へ申し送り。

## M16-07: int custom_states(ストック系)の始動最低/終了2値化＋増減表示(FB⑬ 深掘り)(2026-07-08 完了)

指示書 `docs/instructions/phase3/M16-07-custom-states-stock.md` v1.0.0。承認ゲート = データモデル判断(着手前承認・G-i 隣接型)を Plan Mode 提示 → 開発者承認の上で着手。**M16 末尾を M16-06→M16-07 へ延長**(開発者承認 2026-07-08)。situation は opaque JSON(BE 素通し)= **スキーマ/DTO/BE 変更なし・FE 整形のみ**。

### 目的

int 型 custom_states(キャラ固有ストック・例 Ingrid `sun_crest`〔0〜4〕)を、①始動時に必要な最低ストック数 / ②終了時ストック数 の **2 値**で保持・表示し、**③ストック増減 = ②−①(符号付き・FE 自動計算)** を `show_delta` def フラグが立つ state のみ派生表示する。各項目に明示ラベル(名称 + 固定句・総称「ストック」)。**ラベル初版は仮**(開発者が出力を見て修正指示予定)。

### Plan Mode 着手前確認(§3.4 の 9 項目・実コードで裏取り)

1. **situation.custom_states の read/write 全経路**: 単一 SSOT `web/src/features/combo/customStates.ts` に集約。write=`buildSituation`・read=`parseSituationCustomStates`・display=`resolveCustomStatesForDisplay`。書込呼出は `ComboEditor.tsx`(create/patch payload)、読込は編集初期化。BE は `Combo.Situation *string` の素通し(スキーマ/DTO 不変)を確認。
2. **show_delta def 追加技法**: 既存 seed 000015 非編集 → **新規マイグレ 000023 の JSON patch**(`json_set('$.states[0].show_delta', json('true'))`。modernc.org/sqlite の JSON1 で boolean true を確認・down は `json_remove`)。実 seed に存在する int state は **Ingrid `sun_crest` のみ**。
3. **ラベル SSOT・i18n 境界**: Approach A(単一 TS-SSOT + locale 引数・開発者確定 2026-07-08)。`STOCK_PHRASE{startMin,end,delta}×{ja,en}` + `customStateIntLabel(def,kind,locale)`。詳細/比較(i18n サーフェス)は locale 連動で en(name_en + en 固定句)、export/入力欄は ja(M16-06 境界)。**flag 型 custom_states の周辺表示は ja のままスコープ外**(開発者確定)。
4. **③増減 calc**: ②end − ①start_min(符号付き)。`show_delta=true` の state のみ・派生表示(入力欄でない)。
5. **editor 1→2**: 既存 int 入力方式(min/max clamp・`Math.trunc`・`blockNonNumericKeys`)を踏襲し ①② の 2 欄へ。`show_delta` 時 ③ を calc 表示。
6. **display surfaces**: 詳細(`ComboDetailHeader`)・比較(`CompareTable`)・エクスポート(`export-model`/`export-items`)いずれも `resolveCustomStatesForDisplay` 経由=現状 1 項目 → ①②(③)の明示ラベル表示へ。
7. **移行(graceful)**: 旧スカラ `{"code":n}` を **②(end) へ写像**(`{start_min:min, end:n}`)。parse は number をそのまま受理し normalize で写像。int 実データは Ingrid のみ(dev-disposable)。
8. **dup/recipe/BE 非波及**: 実コードで裏取り — `DuplicateKey`(6 フィールド・`internal/service/validation/combo.go` / `internal/repository/combo/repository.go`)・`CalcRecipeHash`(steps のみ・`internal/service/combo/duplicate_keys.go`)・`RecomputeComboCache`(steps+presets・`internal/service/notation/cache.go`)いずれも `situation` を読まない。
9. **5 キャラ def の全数実査**: 実 seed に存在する int(level/stock)custom_state def は **Ingrid `sun_crest`(level・min0/max4)のみ**。複数 int state を持つキャラなし。**Mai/Lily/Juri/Kimberly はキャラ行自体が未 seed**(本リポジトリに存在しない)= def フラグ付与対象なし。

### スコープ切り分け(重要・指示書 §3.4-2/§1.3 準拠)

- **モデル + Ingrid(唯一の testable)を実装**。他 4 キャラは未 seed のため **def フラグ設定も E2E も M14-03b(全キャラ seed)契約へ委譲**(指示書は「def フラグ設定のみ」を想定していたが、実査の結果キャラ行が無いため付与先が存在しない=丸ごと M14-03b へ委譲が正)。
- **消費セマンティクスの一般構築はしない**(architecture-patterns §9.1 B-1 据え置き=表示用 2 値 + 派生増減のみ)。flag 型 custom_states・drive/SA ゲージ(M16-02)は不変。

### 実装(1 コミット 98961e6)

- **マイグレ 000023**: Ingrid `sun_crest` def に `show_delta:true`(JSON patch・既存 seed 非編集・up/down 整合)。
- **`customStates.ts`(中核 SSOT)**: `CustomStateDef.show_delta?` 追加。`IntStateValue{start_min?,end?}`・`CustomStatesValues` を union 拡張(旧スカラ number も後方互換で保持)。`parseSituationCustomStates`(構造化 + 旧スカラ graceful)・`buildSituation`(構造化書込・両者 min は省略)・`normalizeIntValue`(構造化/旧スカラ→②写像/欠損の正規化 + clamp)・`intStateDelta`・ラベル SSOT(`STOCK_PHRASE` + `customStateIntLabel` + `toCustomStateLocale` + `formatIntStateValue`)・`resolveCustomStatesForDisplay(situation,defs,locale)` を ①②(③)展開へ改修(`ResolvedCustomState` は `{code,label,type,value,kind}`)。
- **editor**: `ComboEditorBasicFields.tsx` の int ブロックを ①② の 2 欄化(test-id `combo-editor-custom-state-<code>-start|-end`)+ `show_delta` 時 ③ calc 表示(`-delta`)。`setIntField`/`readIntPair` で片側更新・両欄空なら state 削除。
- **display**: 詳細/比較は `resolveCustomStatesForDisplay(..., toCustomStateLocale(i18n.language))` で locale 連動(int ラベルのみ en 化)。export は locale 既定 ja 固定。map key を `code-kind` に(1 state → 複数行のため)。

### 自己テスト(FE 680 / Go migration test 全 green・§5 対応)

- **FE(Vitest / tsc)**: `customStates.test.ts` = 構造化往復・旧スカラ graceful(→②写像)・buildSituation の default 省略/片側付与・`normalizeIntValue` 各分岐・resolver の ①②③展開/`show_delta` 分岐/locale(ja/en)/delta 符号(正+2・負-2)。`ComboEditorBasicFields.test.tsx` = ①② 2 欄描画・min/max・show_delta 有無での ③ 表示/非表示・① 入力が構造化 {start_min,end} で onChange・旧スカラ→②欄表示。`ComboDetailHeader.test.tsx` = ①②③明示ラベル + delta 符号・旧スカラ移行表示。`ComboEditor.test.tsx`/`CompareTable.test.tsx`/`export-model.test.ts` 既存の round-trip・NULL 後方互換は非回帰(680 件全通過)。
- **dup 非回帰**: situation 変更が `DuplicateKey`/`recipe_hash` へ波及しないことを実コードで確認(上記 §3.4-8)。Go `go build ./...`・`go test ./internal/repository/character/... ./internal/infra/...`(全マイグレ適用=000023 含む)通過。
- **マイグレ検証**: modernc.org/sqlite ドライバで `json_set`/`json_remove`/`json_extract` の up/down を実行し、`show_delta` が JSON boolean true として乗る/戻ることを確認。

### E2E 後回し(M14-03b 連動・レビュー中-1 のトリアージ確定)

- **Mai/Lily/Juri/Kimberly は未 seed のため実データ E2E・def フラグ設定とも M14-03b(全キャラ seed 投入)へ委譲**。
- **Ingrid int の E2E(§5.2)も M14-03b へ委譲**(レビュー報告書 §取り込み結果 中-1)。理由: 既存 e2e(`web/e2e/combo-custom-states.spec.ts`)はウィザード既定キャラ ryu の flag を対象にしており、Ingrid int を実データ E2E するにはエディタのキャラ選択フロー駆動(e2e スタックで未確立)＋Ingrid の move seed 前提が要る。Ingrid＋4 キャラを M14-03b でまとめて E2E するのが整合的。機能自体は単体/コンポーネントテスト(customStates/editor/detail/compare/export の int ①②③・show_delta・移行・locale・符号)で厚く担保済み(FE 682 件)。
- M14-03b の seed 契約に「int custom_state def を持つキャラは `show_delta` を付与(方向可変=true・一方向=false)」＋「Ingrid 含む全 int custom_state キャラの ①②(③)E2E」を含めること(伝達メモへ申し送り)。

### DES 反映(CHANGE-067 見込み・設計担当起票)

製造は DES 本体を直接編集していない。`docs/handover/M16-07-to-design-memo.md` で設計担当へ CHANGE-067 三点セット(DES-003 §3.2 def `show_delta`・custom_states int の 2 値表現/DES-005 §5.6/§5.7/§5.8/§5.13 の 2 値・ラベル・増減/DES-006 の 2 int 検証・要否/seed の Ingrid def フラグ)を申し送り。**仮ラベルの確定句は開発者が出力を見て後日指示**。

---

## M14-RESEARCH-02: 公式データ／手入力 CSV のエッジケース調査で確定した課題(2026-07-09 記録)

> 出典: `docs/progress/M14-RESEARCH-02-report.md` §C / §F、`tmp/20260709-official-data-edge-cases.md`。
> read-only 調査で列挙し、開発者トリアージ(2026-07-09)を経て「記録」「課題」「設計判断」に分類された項目のみをここに残す。
> 認識済み・仕様どおりと判断された項目(rush_variant / target_combo / is_aerial の意味 / circle の方向不問 / `_N` の意味 / ryu seed が仮 等)は本ログに残さない。

### 記録(F-13): 公式データの英語名そのものに誤りが 2 件ある

`move_code` は英語名からのみ機械生成される(`combomgr-importer/internal/code/code.go:129` `MoveCode(m.NameEN)`)。したがって公式英語名の誤りは code の誤りへ直結する。

1. **juri**: `[チェーンコンボ]ジャンプ強P（空震脚）` の英語名が `[Chain combo]Neutral Jumping Heavy Kick`(Punch であるべき)。同キャラの `[チェーンコンボ]垂直ジャンプ強K（横圧殺）` と英語名が完全一致し、**code 衝突の原因**になっている(解決後: `chain_combo_neutral_jumping_heavy_kick_jump` / `_neutral_jump`)。
2. **luke**: `OD ノーチェイサー` の英語名が `OD Chaser`(`No` が欠落)。無印は `No Chaser` → `no_chaser` だが、OD 版は `chaser_od` となり base 名が揃わない。

いずれも公式サイト側の表記であり、本リポジトリでは是正できない。seed 投入前に人手補正が要る。

### 課題(F-14): マノンの `move_code` が非 ASCII 欠落で壊れている

`machineTokens`(`code.go:143-158`)が非 ASCII を語境界として扱うため、アクセント付き文字が消える。該当は manon の 21 行のみ(ほかに非 ASCII を含む英語名は ryu の全角括弧 6 行だけで実害なし)。

| 英語名 | 現行 code | 問題 |
|---|---|---|
| `À Terre` | `terre` | 先頭単語が丸ごと消失 |
| `SA2 Étoile` | `sa2_toile` | 先頭 1 文字が落ちて別語に |
| `Manège Doré` | `man_ge_dor` | 2 箇所で分断 |
| `Révérence` | `r_v_rence` | 同上 |
| `L Dégagé` | `d_gag_light` | 同上 |

**開発者方針(2026-07-09)**: `_` に落とすのはよくない。**形が似ているアルファベットで代用する**(例: `é`/`è` → `e`、`À` → `a`、`É` → `e`)。実装先(importer 側の採番か、seed 生成側の remap か)は未定。

### 設計判断(F-15): `command` から `move_code` を一意に解決できない

同一キャラ内で `command` が完全一致する move 群が **442 グループ**。全 30 キャラで発生する(最多 mai 31 / blanka 23 / juri 22、最少 terry・manon・jp 各 8)。

代表例: ryu の `d dl l d dl l plus p` に 6 move(`sa2_shin_hashogeki_lv1/2/3` と `[電刃錬気]` 付き 3 件)が対応する。ほかに「ホールド版とジャスト版が同一 command」(luke)、「ホールドとホールドMAXが同一」(rashid)、「ディレイ派生 3 種が同一」(jamie)、「通常版と連打版が同一」(zangief)、「SA2 の 3 種が同一」(terry) 等。

**開発者方針(2026-07-09)**: 「**一番若いデータを解決する**」か「**`lv` 等の文字を含める**」かの設計判断とする。handover §3-(f) の command 索引は、この判断の結果を前提に設計する必要がある。

関連する周辺事実:
- `command` が空の行が 11 行(cammy 3 / aki 2 / kimberly 2 / marisa 2 / akuma 1 / sagat 1)。うち **aki の 2 行は `condition` も空**で入力情報が皆無。
- 未知トークン `raw{-}` が 3 行(blanka 2 / m_bison 1)。
- `command` 内に日本語条件が残留する行が 1 行(`guile/sonic_cross1_od` の `cond{（ODソニックブレイド中に）}`)。
- 開発者補記: コマンド解決時に溜め(`charge_*`)を無視して通常の矢印として扱える可能性があり、`command` から `charge` を省く選択肢もある(F-7)。

### 課題(F-8): `custom_states` の定義が 3 キャラしか無い

現行マイグレ(000001〜000023)で `custom_states` が定義されているのは **ryu(flag) / ingrid(level int 0-4・`show_delta=true`) / c_viper(flag)** のみ(`000015` + `000023`)。handover §3-(e) が `show_delta` 付与対象とする **mai / lily / juri / kimberly は状態定義そのものが未定義**であり、`show_delta` の UPDATE だけでは成立しない(状態定義の新規投入が先に要る)。

### 未決(開発者総括 2026-07-09): AI 補完のスコープ

> 「公式データから作った CSV もそのままでは使えず一部 AI 補完が必要。手入力 CSV も一部 AI 補完が必要。この補完をどういったスコープでさせるかの検討は必要」

現時点で判明している「そのままでは使えない」箇所:

- **公式由来 CSV**: `recovery` の非整数表記(全 30 キャラ・764 行。`着地後N` 366 / `全体 N` 271 / `N+着地後N` 97 / `※N` 24)、`combo_scaling` が JSON、非整数値の `notes` 退避(`持続原文` 94 / `発生原文` 12 等)、非 ASCII 欠落(manon)、英語名の誤り(juri / luke)。
- **手入力 CSV**(`tmp/terry.csv` 再出力版 80 行を実査): `notes` / `notes_tool` が全行空(**仕様**。備考相当はインゲームに無く、法的リスク回避のため公式と一致しない)、`on_hit` の充填が 31/80、`recovery`/`total` が 59/80(`着地後N`・`全体 N` 系が空欄化。作業途中)、`move_code` の一部が公式由来から改名(`quick_burn_light` / `round_wave_heavy`。この 2 件は `command` も空=移植漏れの可能性)。`command` は 55 行充填され公式と完全一致。
- **確定した公式データの誤り(手入力側が正)**: terry の `jumping_medium_punch` と `jumping_medium_kick` で `active` と `damage` が**公式側で相互に入れ替わっている**(★値は 2026-09-11 に落とした＝`M26-03`(`A3`)・開発者判断。本ファイルは公開される。値の正本は `character_data/terry.csv`)。加えてジャンプ通常技 5 件(jMP/jMK/jHP/jHK/jLK)の `startup` が公式より 1F 大きい。**手入力 CSV の値が正**(開発者確認 2026-07-09)。`is_aerial` も手入力 CSV が最新かつ正しい。
- **除外対象の確定が必要**: `sa2_triple_geyser_dud`(不発)は**意図的に除外**。開発者いわく「他にも意図的に抜くべきデータはありそう」。**seed 投入前に除外リストの確定が要る**。
- **手入力 CSV から削除検討**: 移動 system move 9 種(`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`)が手入力 CSV に混入している。**誤りであり削除を検討**(開発者)。M14-03b §1.2 は seed 側で全キャラ投入する契約。なお `rush_variant` 13 行の混入は**問題なし**(ラッシュ版を手入力側へ寄せることは合意済み)。
- **`tmp/terry.csv` は設計担当にも共有すること**(開発者指示 2026-07-09)。


## M14-03c: ryu 正規再 seed(moves 差し替え+combos クリア)(2026-07-16 完了)

> 詳細は `docs/progress/m14-03c-completion-report.md`。指示書 v1.0.2 / チェックリスト v1.0.1。

### 要点

- **マイグレ 000029(手書き)+000030(seedgen 生成)**: ryu の combos+従属行・setups+setup_steps(開発者承認の明示的スコープ拡張)・旧 moves(移動 9 種以外)+alias(全 preset 横断)を FK 逆順で明示 DELETE → 手入力 CSV 由来の 84 技+alias 84 件を seed。ryu は 93 技(84+移動 9)へ。
- **削除は NOT IN(移動 9 種)掃討方式**: ユーザー生成 rush_variant(`POST /moves/:id/rush-variant`)が明示 code 列挙を生き残ると 000030 が UNIQUE 衝突(dirty・起動不能)するため。回帰防止テストあり。
- **drive_parry は削除→CSV 再投入**(000004 由来のため。第一波の 000026 と同一扱い・開発者確認 2026-07-16)。
- **seedgen は §4.3.1 の I/O 境界拡張で再利用**: `-chars`/`-out`/`-note` フラグ+`GenerateWithHeader`/`CustomHeader`。変換規則・moveindex は無改変(diff 立証)。000026 の byte-identical を golden+`-check` で担保(第二波 20 キャラで再利用可能・ryu 非ハードコード)。
- **000029.down は忠実復元**(旧 49 moves+alias 49 件を v28 集合一致で機械検証)。復元不能 4 項目(実コンボ/セットプレイ/ユーザー rush/custom alias・編集値)を up/down に明記。
- **テスト**: 既存 Go テスト修正 0 件で全通過。新規 migrate_m1403c_test 5 本(up 契約 93/93/0・他キャラ非波及スナップショット・移動 9 種同一 id・ユーザー行掃討・down 忠実性/往復)。E2E 18 passed(1 flaky retry 成功)。
- **dev DB**: `.pre-m14-03c-bak` へ退避済み。**適用は次回バックエンド再起動時**(稼働中プロセスは非停止)。コピー実測で version=30 clean・非波及・FK 違反 0 を確認。

### 課題・申し送り

- M14-03b Q4(ryu recovery 将来 total 契約)は本サブで解消(CSV 値で新規 INSERT)。
- 配布 blocker 残: 未投入 20 キャラ(第二波)。
- `character_data/seed-progress.md` の seed_imported 欄は実態と乖離したまま(スコープ外・別途整備)。

## M17-01: G-j メディア 3 フィールド(link・video_path・image_path)(2026-07-16 完了)

> 詳細は `docs/progress/phase3/m17-01-completion-report.md`。指示書 v1.0.2 / チェックリスト v1.0.0。`/implement_plan_full`(実装→fresh subagent レビュー→自動トリアージ)で実施。

### 要点

- **マイグレ 000031**: combos に `link`/`video_path`/`image_path`(TEXT・NULL 可)を `ADD COLUMN` で追加(down=`DROP COLUMN`・範=000020)。着手時実査で M14-03c が 000029+000030 の 2 連番消費と判明し、指示書 v1.0.1 の「000030」を開発者確認のうえ 000031 へ是正(指示書 v1.0.2)。
- **非破壊・非 dup・非 recipe・文字列参照まで**: `DuplicateKey`/`CalcRecipeHash`/`RecomputeComboCache` は変更 0 件(実査で非参照を確認)。PATCH 経路は cache 再計算を呼ばない構造のまま。メディアだけ異なるコンボが重複判定されること・recipe_cache 不変をテストで担保。
- **PATCH トライステート**: `comborepo.Optional[string]` ×3 を memo/situation と同型追加(キー不在=不変更/null=クリア/値=更新)。
- **CSV**: 任意列末尾 3 列(`optionalImportColumns` 登録=旧 CSV 後方互換)。memo と同じ VAL-I10 sanitize/desanitize を対称適用(開発者確認)=verbatim 往復不変。緩検証(import 検証エラーなし)。
- **表示**: 詳細に「メディア」セクション(値がある項目のみ表示)。link は新設 `web/src/lib/safe-url.ts` の `isSafeHttpUrl`(http/https 前方一致のみ)判定時のみ `<a rel="noopener noreferrer" target="_blank">`=危険スキーム(`javascript:` 等)非リンク化。path 2 種は常にテキスト。編集 3 入力欄(空=クリア)・比較表 3 行(テキストのみ)・PDF/PNG は文字列のみ。VAL-I08 に流用可能な既存実装は無く新設した。
- **i18n**: 詳細/比較=ja/en 両ロケール。編集・エクスポートラベルは既存流儀どおり固定日本語(開発者確認)。
- **テスト**: Go 新規 9 本(マイグレ up/down・repo/handler トライステート・dup 非関与・recipe 不変・CSV 3 点+統合往復)全通過(既存修正 0 件)。Vitest 696 全通過(新規 15 本)。`make e2e` 19 passed・exit 0(新規 spec 2 本。flaky 2 は retry 吸収=baseline どおり)。

### 課題・申し送り

- **dev バックエンド再起動が必要**(000031 適用+新 DTO 有効化。dev_backend_restart_pitfall)。
- 指示書 v1.0.2 への是正(開発者編集)は未コミットのまま残置(扱いは開発者判断)。
- CHANGE-068 三点セット(改訂 DES-003/002/005/006+change-report-068+registry)は設計担当が確定(完了報告 §5 に反映要点を記載)。

## M17-02: G-k command 索引源の確立+段階2 解決エンジン(BE)(2026-07-16 完了)

> 詳細は `docs/progress/phase3/m17-02-completion-report.md`。指示書 v1.1.0 / チェックリスト v1.1.0 / CHANGE-069(v2)。`/implement_plan_full`(実装→fresh subagent レビュー→自動トリアージ)で実施。

### 要点

- **マイグレ 000032〜000035**: `moves.is_derived`(bool・DEFAULT false)+索引テーブル `move_commands`(move_id/character_id/token_key・非派生のみ・UNIQUE なし)+seedgen 生成の backfill(10 キャラ 304 code)+索引 seed(530 件)。生成 2 本は golden テストで byte-identical 固定(M14-03c 定石)。既存マイグレ非改変・down 往復テスト済み。
- **CSV 是正**: rush_variant 156 行の `is_derived` を true へ機械是正(§1.5-5 の遡及適用・開発者差分承認済み)。実測=rush 行は全て command 空(偶然の非搭載)だったため「意思として落とす」を確立。
- **numpad 正規化層**: M14-03b の後付け位置(`moveindex.normalizeToken`)へ §9.9 語彙→numpad 断片写像を差し込み(`d dr r plus p_l`→`236LP` 等)。語彙外トークンの機械検出を追加。索引キー・クエリの両方が同一関数=「二度作らない」。
- **段階2 解決=案C(BE が畳んだ解決表を配る)**: `GET /api/characters/:characterId/command-index`(数値 ID)がキャラ 1 体分の `token_key→move_code`(1 対 1 畳み済み)を返す。規則(is_aerial 除外→category ガード→形状フィルタ→特殊技優先→id 最小)は Go に一元化・FE は引くだけ。未 seed キャラは 200+空=壊れない。段階1(FE 構造引き)は不変=一様フォールバックの分岐は M17-03。
- **実測(§3.3-7/10/11/12)**: 1:N 63 グループはすべて空中技衝突(is_aerial 除外後 0=解決表は完全 1:1)。is_aerial 手動 true 化漏れ 0。condition_ja 非空 1 件(CA・スコープ外)=追加規則なし。索引カバレッジ 530/306(CHANGE-069 記載 631/278 と乖離=CSV 是正履歴由来と推定)。
- **共通化 IF(M17-04 の土台)**: `movecommand.LoadIndex` が move_commands から moveindex を本体ランタイム再構築(`AddIndexed`)。正準トークン列でも numpad 形でも同一キーで引ける。
- **rush 一貫性**: `POST /moves/:id/rush-variant` 生成行に `is_derived=1`(§4.7)。
- **テスト**: Go 全緑(新規 26 本+既存修正 0)・Vitest 696 全通過・make e2e 22 passed(新規 API 疎通 spec 1 本)。空中特殊技衝突 3 件(lily/kimberly/zangief)の除外を能動テストで固定。

### 課題・申し送り

- **dev バックエンド再起動が必要**(000032〜000035 適用+新 API 有効化)。
- **DES-003 の節番号矛盾**: CHANGE-069 は「move_commands を §3.13 新設(現行 §3.12 まで)」とするが実物は §3.13 combo_setups が既存 → 新設は **§3.14** が正(設計担当で是正)。
- **manon.csv は対象外**(開発者指示)。第二波 seed で is_derived の INSERT 直接組込(変換規則改訂+golden 更新)と同時に取り込むのが経済的。
- CHANGE-069 三点セット(改訂 DES-004/003/002/006+change-report-069+registry)は設計担当が確定(完了報告 §5 に反映要点を記載)。

## M17-04: ④ 既存フォーマット取込ヘルパー(照合 IF の消費者拡張)(2026-07-17 完了)

> 詳細は `docs/progress/phase3/m17-04-completion-report.md`・レビュー `docs/progress/phase3/m17-04-review.md`・設計伝達 `tmp/20260717-M17-04-design-handover.md`。指示書 v1.0.2。`/implement_plan_full`(実装→fresh subagent レビュー→自動トリアージ)で実施。

### 要点

- **②のみ実装**(①=アプリ外プロンプトは本体外)。`internal/service/intake` が候補トークン列→`move_code` を厳密照合(`moveindex.LoadIndex`+`Lookup`/`LookupAll` の消費者拡張・**フォールバックなし**・段階2 inputresolve を流用しない)。別名照合 `preset.FindMoveCodesByAlias`(全プリセット横断・`alias_text` 完全一致・**1件のときだけ確定**)。
- **新規 API**: `POST /api/intake/resolve`(未解決は未解決のまま返す・未投入/不明キャラでも 200)・`POST /api/intake/csv`(`csvcore.ExportCSV` 再利用・空 code/空ステップ/空コンボは 400)。
- **新画面** `/import/combo/helper`。生成 combos.csv を router state で既存 import へ渡し自動プレビュー(検証・重複を迂回しない)。プロンプト本文の正はコード `web/src/features/intake/prompt.ts`(TSV 出力)。
- **非改変**: moveindex/move_commands/inputresolve/csvcore/migrations/recipe_hash/RecomputeComboCache/スキーマ すべて差分ゼロ。moves 書込ゼロ(read only)。
- **テスト**: Go 全緑(service/handler/preset repo)・Vitest 730 全緑・make e2e 全緑(intake 2 本。既知 flaky は retry 吸収)。

### 課題・申し送り

- **【最重要・今後のテコ入れ課題(スコープ外)】① プロンプトの表現力が SF6 実コンボに不足**(2026-07-17 開発者の実データ検証で判明)。実ユーザーのメモを Gemini 無料版/ChatGPT で正規化させたところ**大半が未解決(`?`)**。原因は 2 層:
  - (a) **技一覧(moves 一覧)未注入だと技名候補が全滅**。生プロンプトの直コピペでは②のエイリアス照合が全く効かない。→ **アプリの「プロンプトをコピー」経由(moves 同梱)が必須運用**であることが実証(生プロンプト運用は不可)。まず**アプリ経由で再検証**が必要(今回の実データ検証は raw prompt で moves 未注入のため過小評価)。
  - (b) **SF6 の頻出システム概念がトークン語彙(24種)で原理的に表現不能**: ドライブラッシュ/キャンセルラッシュ/ラッシュ(DR/CR./R.)・オーバードライブ(OD)・スーパーアーツ(SA1/2/3)・ドライブインパクト(DI)・パニッシュカウンター(PC)・繰り返し(×2〜3)・選択(/)・条件([ストック2])・ダメージ/フレーム注記。これらは numpad 方向+ボタン語彙の外→トークン照合パスでは引けない。**語彙 24 種は索引正規化(DES-004 §2.4.3)と一体で安易に増やせない**ことがボトルネックの根。
  - **示唆する方向(要設計判断)**: ①「必殺技/SA/DI 等は技名候補→エイリアス照合を本線に据える(moves の別名を SA 番号・キャラ通称〔ライズ/フレア等〕まで充実させる)」、②「中間表現プロンプトの二段化(略語・システム概念を自然言語へ展開してから技名+トークンへ)」〔開発者提案〕、③「DR/OD/SA/DI/PC を語彙拡張でなくステップ属性(modifiers.type 相当)/別列で扱う設計」、④「M20 カスタムプリセット(個人辞書)の前倒し効果」、⑤「回数/選択/条件/注記は取込対象外として memo 退避 or 人手補完」。**本サブでは実装変更せず今後の課題として据え置き**(設計担当・M17 後続 or M20 で再検討)。
  - **【追記・重要】アプリ経由(moves 注入)で再検証したら大幅改善**(2026-07-17): 初回は raw prompt で技一覧未注入=過小評価だった。**「プロンプトをコピー」経由(moves 同梱)で技名候補が大幅に埋まり**(しゃがみ弱P/中サンライズ/SA3 コズミックレイ/ソーラーフレア/しゃがみ強P(ラッシュ) 等)、**アーキ本線(技名→エイリアス照合)が機能する見込み**が立った。必殺技/SA/ラッシュ版はトークン `?` でも技名候補が実技名→②の alias で引ける余地。**次工程=この①出力をアプリに貼り「照合」して②の実解決率を実測**(現時点は①出力の質改善まで)。残ギャップ精緻化: (1)多候補ハッジ("A or B or C"=Lv/方向/強度不明)は alias 単一完全一致で引けず人レビュー→プロンプトで単一化 or resolve で "or" 分割候補提示、(2)ラッシュ版は is_derived=true で索引外だが別名 seed 済みなら alias で引ける(**rush_variant の日本語別名有無を要確認**)、(3)適当/2KKK/6KKK/追加派生/DI ガード/PC/回数/条件/注記は人手 or 対象外。本命は「語彙拡張」でなく「エイリアス辞書充実＋多候補の扱い＋システム修飾の別レイヤ化＋M20 個人辞書」。詳細は `tmp/20260717-M17-04-design-handover.md` §4.5 追記。
- **【追記・不具合是正】入力形式を TSV → Markdown パイプ表へ変更**(2026-07-17): 開発者が実 AI 出力を貼って照合したところ**全 0 ステップ**(「取込対象のコンボがありません」)。原因=**AI チャットのコピーでタブが空白へ潰れ**、フィールド内空白(例 `d plus p_l`)と区別できず ParseInput(タブ前提)が 1 行も認識せず。空白区切りは境界復元不能のため、**LLM が安定生成し区切りが曖昧にならない Markdown パイプ表**へ是正(ParseInput はタブ/パイプ両対応・タブ互換維持)。プロンプト(コード/ひな形 v1.2.0)も表出力へ。技名候補は最有力 1 件に絞る指示を追加(多候補 "A or B" は alias 単一完全一致で引けないため)。Go parse テスト追加・E2E をパイプ表化・全 green。**運用は再度プロンプトを再コピー→AI 再実行→貼付が必要**(旧 TSV 出力は復元不能)。
- **DES 反映要点**は完了報告 §5・設計伝達 `tmp/20260717-M17-04-design-handover.md` §5 に記載(製造は DES 直接編集せず)。新規 API 2 本・新画面・別名照合消費者・M20 の `alias_text` 一意性論点。**①出力形式はパイプ表**(上記是正)。
- **【②実解決率の実測 2026-07-17】GPT 経由で 54/67 解決(約 81%)＝技名→エイリアス照合の本線が実データで機能**。通常技はトークン、必殺技/SA(中サンライズ/SA3 コズミックレイ/サンブライト等)は技名候補→alias で解決。**モデル差が決定的**: GPT は安定、**Gemini 無料版は出力が区切り無しの連結文字列になりパース不能(フォーマット不遵守)＝高性能モデルが前提**。未解決 13 件は単一 move に落ちない行(ターゲット連携 `中P~中K`・適当・2KKK/6KKK・4中K~強P・R.系・~追加・"..."続き省略)＝設計どおり人レビュー行きで正常。
- **【運用上の壁→是正済み】未解決を含むコンボが取り込めない問題を解消**: 実コンボには `適当`/`...`/`2KKK` 等**技に割当不能な補足行**が必ず混じるが、「取込プレビューへ進む」は未解決 0 が条件で先へ進めなかった。**開発者判断「行ごとにドロップ/採用」(2026-07-17)を受け、各ステップに「除外」チェックを追加**。除外行は CSV から落とし未解決に数えない(解決 or 除外で進める)。除外ステップを含むコンボは「レシピから外れる(手数が減る)」警告を表示し人に判断させる。`review.ts` に `StepExclusions`/`isStepExcluded`/`comboHasExcludedStep` 追加・`buildCsvPayload`/`countUnresolved` を除外対応(後方互換のオプション引数)。Vitest/E2E に除外フロー追加・全 green。
- **既知未解決 2 件(guile/lily OD)は別名照合で解決され得る**(指示書の「必ず未解決」前提が実装で好転)=伝達レポート §3-1。
- 指示書 v1.0.2 への是正(開発者/設計担当編集)が製造コミットに混入(`git add -A` 由来・扱いは開発者判断)。

## M17-05b: ③ export 動線・形式(A-1 選択エクスポート＋A-2 複数形式＋エクスポートダイアログ＝画面廃止 第1段)(2026-07-18 完了)

> 詳細は `docs/progress/phase3/m17-05b-completion-report.md`・レビュー `docs/progress/phase3/m17-05b-review.md`。指示書 v1.0.0。`/implement_plan_full`(実装→fresh subagent レビュー→自動トリアージ)で実施。

### 要点

- 一覧・マイコンボに常時表示の「エクスポート」ボタンを追加(既存の比較対象選択 UI=`useSelectMode` を流用・選択ゼロは現フィルタ結果の全件=WYSIWYG)。新規 `ExportDialog` で形式(CSV/PDF/PNG/クリップボード)をチェックボックス化し複数同時選択・順次生成(クリップボードのみ相互排他)。**BE 変更なし**(既存の `range=selected&ids=...` 経路をそのまま利用)。エクスポート画面(`ComboExportPage.tsx`/§5.13)は完全に温存(無変更)。
- レビューで、比較対象選択(M15-02)とエクスポート選択の上限分離に伴う副作用(比較上限=5件超過時の即時フィードバックが不正確化)が指摘され、是正済み(高優先度・採用)。
- **テスト**: Vitest 749件全通過(新規15件)。`make e2e` 30件全通過(新規3件、うち1本はレビュー指摘の回帰防止ケース)。
- **持ち越し**: `ExportFormat` 型の重複定義(`run-export.ts`/`ComboExportPage.tsx`)は第2段(画面除去)まで据え置き。`ids` クエリパラメータの長大化は低優先度で据え置き。

## Codex Dev Container sandbox 互換対応(2026-07-20・再ビルド待ち)

### 要点

- **原因**: Codex CLI 0.144.6 の Linux sandbox が Dev Container 内で user namespace を作れず、`pwd` を含む全コマンドが `bwrap: No permissions to create a new namespace` で失敗し、sandbox 外再実行の承認要求へフォールバックしていた。
- **Dev Container 専用依存 `bubblewrap` を追加**: OpenAI Codex 公式 secure devcontainer を根拠に、Debian パッケージを導入して `/usr/bin/bwrap` を `root:root:4755` に固定した。アプリケーションバイナリへのリンク・Go embed・配布物への同梱はなく、開発環境内で Codex の内側 sandbox を構築するためだけに使用する。
- **外側 Docker の設定**: 公式例と同じ `SYS_ADMIN` / `SYS_CHROOT` / `SETUID` / `SETGID` / `SYS_PTRACE` capability と `seccomp=unconfined` / `apparmor=unconfined` を追加。既存の `NET_ADMIN` / `NET_RAW` と allowlist 型ファイアウォールは維持し、外側の緩和後も Codex の bubblewrap + seccomp とファイアウォールで境界を強制する。
- **Codex ポリシーは維持**: `.codex/config.toml` の `approval_policy=on-request`、`sandbox_mode=workspace-write`、`network_access=false` は変更していない。`danger-full-access` や approval 無効化には切り替えていない。
- **検証を追加**: `.devcontainer/verify-env.sh` に bubblewrap の存在、setuid モード、`codex sandbox -P :workspace --include-managed-config` の自己テストを追加した。
- **開発者向け成果物**: `docs/handover/codex-sandbox-rebuild-checklist.html` に再ビルド後チェックリスト、期待する権限境界、Codex へ貼る検証プロンプトを作成した。

### 未実施・次の操作

- 本記録時点では Dev Container を再ビルドしていないため、現在のコンテナ上の `bwrap` エラーは解消していない。
- 開発者が通常の **Dev Containers: Rebuild Container** を実行し、named volume を削除せず認証状態を維持する。
- 再ビルド後は上記 HTML に従い、通常操作が無承認で成功すること、`.git` / `.codex` / `.agents`・workspace 外・shell network の制限が維持されること、hooks が追加承認を要求しないことを確認する。

## M18-01: 確定反撃スキーマ基盤(combo_punishes/距離除外2表/materialize出自/is_projectile/hit_type拡張)(2026-07-22 完了)

### 要点

- 新表 3(`combo_punishes`/`combo_punish_prunings`/`combo_punish_curations`)・新列 2(`combos.materialized_from_combo_id`/`moves.is_projectile`)を非破壊で追加。消費連番 **000036–000039**(次 000040)。
- **設計是正**: 指示書 v0.1.3 の「seedgen を is_projectile SQL 出力へ変更」は Plan Mode 実査で成立不能(golden byte-identical 失敗/既存マイグレ改変抵触/000026・000030 が 000039 前に実行され `no such column`)と判明しエスカレーション。指示書担当が v0.2.0 で **backfill 専用(is_derived 同型)** に確定・seedgen 出力要件を撤回。詳細は `docs/progress/phase3/M18-01-report.md`。
- is_projectile 是正 7 件(kimberly 6・juri 1)後、seeded-10 の true = **104**。backfill 更新件数 104 をテストで assert。golden は CSV 是正後も green(is_projectile は SQL 非投入)。
- hit_type 新値 `just_parry_punish_counter`(FE ラベル「パニッシュカウンター(ジャストパリィ反撃)」・2026-07-22 開発者指示で DES-005 指定「ジャストパリィパニッシュカウンター」から変更・内部値不変)を model 定数・CSV whitelist・FE(constants/labels)に追加。マイグレ不要・dup キーで別コンボ扱いは自動。ラベル表記は DES-005/CHANGE-082/指示書§4.5/チェックリスト§1.2 の中央追随を要す。

### 課題・申し送り

- **manon/luke の is_projectile**: backfill 専用確定により自動反映されない(true 5 件=luke 5・manon 0)。**M14-03d/e の seed 投入時に is_projectile backfill を併走**させる必要あり(中央へ申し送り・指示書 §11-5)。
- **全 CSV 件数の乖離**: 是正後 全 CSV 実測 = 122(指示書想定 109 と +13)。内訳の差は m_bison(1)/rashid(12)=RESEARCH B-2 後に追加された未 seed キャラ。backfill(104)には無影響。
- **CHANGE-081 §2-b/§5 の seedgen 記述是正**: 「保全→SQL 投入」「manon/luke 自動反映」は撤回済み。change-report-081 で backfill 専用へ是正されたい。
- **E2E 未実行**: 本リモート環境の Playwright ブラウザ版数不一致(pin=headless_shell 1223 / 同梱 1194)により確定実行できず。回避で起動後も M18-01 と無関係な動線(取込 UI/CRUD フォーム)が系統的タイムアウト。非回帰は Go 統合テスト + FE コンポーネントテスト + 本番ビルドで担保。pin 一致環境での `make e2e` 再実行を推奨。

## M18-03a: 確定反撃マイリスト(使う画面・画面21)＋隠したもの管理(2026-07-26 完了)

### 要点

- 準拠範囲 = **指示書 v1.0.1 ＋ 2026-07-26 チャット確定分**(第3セクション「区分を判定できない反撃」)。消費 CHANGE = **CHANGE-088**(中央払い出し・自採番なし)、**マイグレ 0 本**(末尾 000041 のまま)。
- `combo_punish_curations` の**初めての消費者**。repository → service → handler → routes → FE を新設。着手前 grep(出力を切らず)で全 10 ヒットがマイグレ 000037 とそのテストのみであることを確認し、「拡張」でなく「新設」であることを実査で確定(L-1)。
- 新サービス `internal/service/punishlist/` を別建て(走査ではなく取得)。**探す=走査 / 使う=取得の非対称を実装でも保つ**ため `punishfinder` に相乗りさせない。
- `RemovePunish` を**リポジトリ層でトランザクション化**し同一キーの curation を連動削除。呼び出し経路に依らず孤児を作らない(既存 `DELETE /api/combo-punishes` のシグネチャは不変)。
- 新 endpoint 3 本: `GET /api/punish-list`(隠したもの一覧を畳む)・`POST`/`DELETE /api/combo-punish-curations`。`GET /api/punish-finder` は `manualReviewNodes[].registeredCombos` を追加(後方互換)。

### 指示書の穴を検出 → 開発者裁定

- 探す画面の「確定反撃に採用」は `hit_type` を見ないため、`normal` / `counter` / **NULL** のコンボが `combo_punishes` に入り得る。§4.3-3 の「hit_type でタブ絞り」を literal に実装すると**どちらのタブにも出ず黙って消える**。
- 開発者裁定(2026-07-26)= 両タブ共通・画面下部に「**区分を判定できない反撃(N 件)**」セクション。条件 3 つ(展開して中身が見える／理由と次のアクションを書く／3 つ目のタブにしない)。**M18-03b の materialize が処理すべき入力キュー**という位置づけ。
- 着手前実測(dev DB・`schema_migrations`=41)で当該バケツは **0 件**(`combo_punishes` が 0 行)。テストは合成データで記述。**NULL ケース**をサービス単体・E2E の両方で固定。

### 課題・申し送り

- **【中央/M18-03b 判断】コンボ編集(PUT)で採用が黙って消える**: 識別キー変更を伴う編集は旧コンボを論理削除するが `combo_punishes` を引き継がない。ゴミ箱経由より頻度が高い経路で silent-drop が起きる。`followup-backlog.md` §I-(b) `combo-punish-carryover-on-edit` に起票。**M18-03a ではスコープ外**(指示書 §2.2 が combo サービスを凍結)。
- **【開発基盤】E2E の SQLite 書き込み競合**: 並列 worker からの書き込みで 500 が出る。**M18-03a 以前から存在**(本サブの spec を除外したベースラインで 1 failed + 2 flaky)。`retries: 1` で吸収されフルスイートは 45/45 pass。`followup-backlog.md` §I-(a) `e2e-sqlite-write-contention` に起票。
- **【要追認】共有 Header をスコープ外で 1 クラス修正**: ナビ 13 本目で 1280px 幅に収まらなくなり、はみ出した nav が本文を覆って**全画面のクリックが通らなくなった**(既存 E2E 15 本が失敗)。`min-w-0 overflow-x-auto whitespace-nowrap` で nav 内横スクロールへ degrade。**グローバルナビの項目数上限**という設計制約が顕在化しており、情報設計の見直しを設計担当へ申し送り済み(設計伝達レポート §1-2)。
- **【中央】query 名の不統一**: `punish-finder` は `self_character_id` 系、`punish-list` は `self` 系(指示書 §4.6 の明示指定に従った)。DES-002 §4.2 反映時に裁定を要す。
- 設計伝達レポート: `docs/handover/phase3/design-reports/20260726-m18-03a-design-handover.md`。レビュー: `docs/progress/phase3/m18-03a-review.md`(重大問題ゼロ・「高」0 件)。

## M18-03b: materialize(パニッシュカウンター版の生成)＋採用の引き継ぎ(2026-07-27 完了・受理)

完了報告 `docs/progress/phase3/M18-03b-completion-report.md`／レビュー `docs/progress/phase3/m18-03b-review.md`(重大問題 0)。消費 CHANGE=**089**・マイグレ **0 本**(末尾 000041)。実装ソースは `M18-03b-materialize.md` v1.0.1(引数の `-design-outline.md` は骨子のため開発者確認で切替)。

### ダメージ丸め(裁定1)= 実測で確定

- 着手前実査 `moves.damage % 5 <> 0` = **10 件**(seed CSV 基準)。開発者裁定(2026-07-27)で整数除算採用のうえ後日実測、**同日中に実測完了**。
- 10 技の seed category は **throw ×3 / special(OD投げ) ×1 / target_combo ×6**(全て非 normal・非空中)。開発者実測でも target_combo 6 技は「計測不可(target combo であり materialize 始動として成立しない)」。**いずれも materialize の始動技になり得ず、× 0.2 が非整数になる適用面が存在しない**ため整数除算で確定。DES に丸め規則は書かない(完了報告 §5-6)。

### 計測中に発見した所見(製造工程の記録・CLAUDE.md §8)

- **SF6 実機バグ「後ろ投げ +1」**: 一部キャラで**後ろ投げのみダメージが +1**(パニッシュカウンター・通常投げの双方)。例: kimberly `throw_back` の PC 実測 **1839** vs `throw_forward` **1838**。**seed は前投げ基準**で両者同値(1082)＝**バグはデータに反映しない**(開発者方針「前投げを基準」)。ゲーム側バグであり本アプリの欠陥ではない。将来 move データを実機準拠で精緻化する際の申し送り。
- **target_combo のダメージは累積値**: kimberly `bushin_prism_strikes`(1178)等は 1 技ではなくターゲットコンボの合計ダメージ。**seed の category は既に `target_combo` で正しく、是正不要**。これらは materialize の始動技にならないため materialize への影響なし。
- 上記いずれも **M18-03b のコード/seed に変更は不要**(記録のみ)。

### 実装の要点

- combo 中核の凍結解除を最小侵襲で実施。`DuplicateKey`/`CalcRecipeHash`/`RecomputeComboCache` 不変・`CreateRequest` に出自を足さない・CSV 非出力・新マイグレ0。
- **§4.6**: 識別キー変更編集で `combo_punishes`/`combo_punish_curations` を新コンボへ FK 再ポイント(`MovePunishReferences`・`UpdateSetupReferences` と同型)。followup §I-(b) を解消。
- **【裁定 2026-07-27】入力キュー解除**: §5.3-A/§1.1 の「変換後に第3セクションから消える」を満たすため、materialize が基底コンボの採用(と同キー curation)を同一 Tx で解除(`RemovePunishLink`・冪等)。基底コンボ自体は独立フォークとして残る。
- E2E `web/e2e/m18-03b-materialize.spec.ts`(A〜D)単独 4/4 green(同梱 Chromium・`PW_EXECUTABLE_PATH`)。

### 残・申し送り

- **✅ E-17 実出力目視**(DoD §7.4)**完了(2026-07-27・開発者実施)** → 目視 OK・DoD 全充足＝**受理**。
- **【git】** push 済みコミットが GitHub 上 Unverified(署名なし)。`git config`/`rebase` は CLAUDE.md §10 で製造側 deny のため開発者が是正。
- DES 反映要点は完了報告 §5(DES-002/003/005/006＋裁定 2 件)。採番・改訂は中央。

---

## M19-03: セットプレイ成立条件の記録（2026-07-28）

新表 `combo_setup_results` を追加し、「コンボ × セットプレイの組」に対する三値（未検証／成立／不成立）を記録できるようにした。完了報告 `docs/progress/M19-03-completion-report.md`。消費 CHANGE=**087**・マイグレ **1 本（000042・中央払い出し。着手時に請求し、disk 実査で末尾 000041・欠番 0 を突合）**。

### ★実装中に発見した既存の作り（followup 候補・完了報告 §9-1）

- **`infra/db.Open` の `PRAGMA foreign_keys = ON` が接続プール全体に効いていない。** `conn.Exec` した 1 接続にしか適用されず、`database/sql` のプールは上限無しのため後から張られた接続は FK=OFF になる。**実測プローブで 16 接続中 7 本が OFF**。
- 影響: FK=OFF の接続がキー変更編集を処理すると `ON UPDATE CASCADE` が発火せず、子行が旧 `combo_id` 側に取り残される＝**ユーザーが実機で検証した記録が編集だけで画面から消える**。`ON DELETE CASCADE` も同様に発火しない。
- M19-03 では自表について **CASCADE ＋ 明示再ポイント（`MoveSetupResultReferences`）／明示削除の併用**で回避した（`combo_punishes` の `MovePunishReferences` と同じ流儀）。**決定的な回帰テスト**（PRAGMA 非適用の生接続を使う `TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff`）を置き、明示再ポイントを外すと 0 行＝データ消失を検知して落ちることをミューテーションで確認済み。
- **根治は本サブの範囲外**（DSN への `_pragma=foreign_keys(1)` 付与等は全テーブルの FK 強制挙動が変わる全体影響）。`combo_punishes` 等 M18-01 系の CASCADE にも同じ不確実性が残るため、**followup 起票をお願いしたい**。

### 実装の要点

- **§4.2 の方式**: 本表の FK 親は `combos` ではなく `combo_setups` で、その親キーは `UpdateSetupReferences` が UPDATE する。したがって `ON UPDATE CASCADE` は必須（無いと FK 違反でキー変更編集自体が 500）。ただし上記の理由で単独では不十分なため明示再ポイントを併用。**呼び出し順は `UpdateSetupReferences` の「後」**（先だと FK=ON 下で移動先が未作成で FK 違反）。
- **§4.1.3**: `result` は `NOT NULL`。「未検証」は行の有無で表し、未検証へ戻す操作は物理削除。FE の `SETUP_RESULT_UNVERIFIED` は画面表現専用で保存経路に無い。
- **§4.3.1**: (a) コンボ詳細への同梱を採用。1 コンボにつき `ListResultsByComboID` を 1 回だけ呼び `setup_id` で振り分ける（N+1 を API テストで検証）。一覧では取得せず `omitempty` でキーも出さない。
- **語彙**: 受け身種別は `OKI_TECH_TYPE_LABELS`（既存 SSOT・日本語固定）を再利用。端の 2 語のみ i18n に新規追加（ja/en）。**EN でも受け身ラベルは日本語表示**になるのは既存挙動と同一で、SSOT の i18n 化は範囲外＝followup 候補（完了報告 §8-5）。
- テスト: Go 新規 **56 件**（サブテスト込み）／Vitest 新規 **33 件**（全体 883 PASS）／E2E `m19-03-setup-results.spec.ts` **8/8 PASS**（★C = 識別キー変更編集を含む）。

### 残・申し送り

- **`m18-03a-punish-mylist.spec.ts` の C ケースが既存で失敗している**。M18-03b で書き換えた告知文言「変換機能は M18-03b で対応予定です。」を E2E が依然期待（`web/src` に 0 ヒット・DES-005 §5.21 に書き換え済の記録あり）。**M19-03 は punish 系ファイルを 1 本も変更していない**。追随修正の起票をお願いしたい。
- 全 E2E: 60 passed / 1 flaky（`m19-02 E`・再試行で PASS・単独では PASS）/ 1 failed（上記の既存未追随）。
- DES 反映は中央が CHANGE-087 の三点セットで実施。**製造担当は DES 本体を直接編集していない**。

### M19-03 実機確認フィードバックの反映（2026-07-28・開発者テスト後）

開発者の実機確認で UI に 4 件の指摘。1・3・4 を実装し、2 は申し送りとした。

- **1. 成立条件エディタを「巡回トグル」→「選択＋直接指定」へ作り替え**。指摘は (a) 目的の状態にするのに最大 2 クリック要る (b) メモ欄を開くために押すと状態が変わる (c) 未検証に戻すとメモが消える、の 3 点。
  - **セルのクリックは選択のみ**（状態は変わらない）。状態は「未検証／成立／不成立」の**3 択を直接押して 1 クリックで確定**。既定で左上セルを選択済みにし、編集を開いた直後から操作できる。
  - **メモはセル単位のローカル下書き**として保持し、**未検証へ戻しても画面から消えない**。未検証の間は保存を無効化し「未検証のセルのメモは保存されません」と明示。成立／不成立に戻すとその下書きが保存される。
  - **DB は無変更**。「未検証＝行が無い」（CHANGE-087 §2-d）を守るため未検証セルの行は作らない＝**メモの永続化はできない**。完了報告 §8 の既知の制約に追加。
  - 実装時、削除前に表示中のメモを下書きへ退避する処理が抜けており、保存済みメモしか持たないセルで入力欄が空になる不具合を**自分のテストが検出**して修正した。
  - `constants/setup-result.ts` の `nextSetupResultState`（巡回）は廃止。i18n も巡回前提のキー 4 本を削除し新キー 5 本を ja/en 同時追加。
- **2. セットプレイ編集画面での編集は実装せず申し送り**。**コストではなく設計正典との衝突**が理由（指示書 §4.4.1・CHANGE-087 §2-h が「置かない」旨と理由を正典に残すよう指定、レビューチェックリスト §8 の重大問題判定基準）。実現案（`parentComboIds` で 1 件なら自動選択・複数ならセレクタ）を添えて完了報告 §9-3 へ。**採否には CHANGE-087 の改訂が前提**。
- **3. セットプレイ名をリンク色へ**（`text-gray-800` → `text-blue-700 hover:underline`）。成立条件で情報量が増えたことで「行クリックで編集画面へ遷移」が分かりにくくなった＝**本サブが招いた可読性の劣化**のため対応。構造・遷移の挙動は不変。
- **4. `m18-03a` E2E を即修正**（前回「M18 担当へ口頭で」から開発者指示で方針変更）。assert が M18-03b で消えた文言「変換機能は M18-03b で対応予定です。」を期待していたので、現行の変換導線の案内へ追随させた。

**結果: 全 E2E 62 passed / failed 0 / flaky 0**（初の全面グリーン。従来は m18-03a の 1 件が恒常的に赤かった）。Vitest 891 tests / 118 files PASS、`tsc` PASS、Go 側は無変更で全 PASS。

## M18-03c: 確定反撃 drainage（2026-07-28 完了）

完了報告 `docs/progress/phase3/M18-03c-completion-report.md`。消費 CHANGE=**090**、マイグレ **0 本**。disk 上の最新 000042 は先行 M19-03 の既存物で、M18-03c は schema を変更していない。

- 案 C を実装し、ジャンプ強攻撃候補を 21→23 行へ拡張（juri／ken の neutral 各 1）。unique 7 行を除外し、フレーム式・レーン境界・相手技除外は不変。
- materialize 済み基底を相手技非依存で判定し、「変換済み (N 件)」へ理由付きで畳む。draft は含み deleted は除外。
- 手動確認レーンの新規登録をコンボ保存後の `combo_punishes` 登録まで接続。ガード／ジャストパリィの `hit_type` を既存 SSOT からプリフィルし、部分失敗は保存済みコンボを残して明示する。
- 第3セクション限定で curation の「使わない」導線を復活。PC 系タブには置かない。
- 実 DB の SA／CA 始動候補は `super_art=54`／`critical_art=10`（合計 64 行）。materialize は両 category の加算をスキップし、理由コードを返す。多段始動の概算注意は生成成功時に無条件表示。
- `make test` は Go 全 package＋Web 118 files／898 tests green、`make build` 成功。新規 E2E 3/3、既存 03b 4/4、全 E2E は直列 **65/65 passed**。並列時の SQLite 競合は失敗 spec の単独再実行と全件直列で非再現を確認した。
- 独立レビューは重大 0／高 0／中 1／低 0。中指摘（既存 21 件維持・相手技 A→B fold のテスト粒度）を受理し、seed 全体回帰テストと実 repository／service 結合テストを追加して解消。最終未解決 0。
- `model.Combo`／INSERT／dup／recipe hash／cache、Header、M19、setplay、seedgen、migration、DES 本体は不変。見送り確定の repository 重複整理／`getMoveDamage` 層分離も未着手。

### Claude 独立レビュー取り込み（2026-07-29）

- セカンドレビュー（重大 0／高 0／中 3／低 5）を開発者判断後に取り込んだ。自動採用と `hit_type` プリフィルを手動確認レーンだけに限定し、成立ツリー側はコンボ保存のみに戻した。
- 手動登録中は検索時キャラクターを固定し、要求値／保存結果の不一致時にも `combo_punishes` を作らない防御と警告を追加した。
- materialize 成功通知を結果別に再構成した。通常時は「通常版合計＋始動技ダメージ20%」を前提から説明し、スキップ時は理由と元の値を使うこと、全経路で多段技は実測値へ調整することを案内する。未知の理由コードも表示する。
- curation 成功後の note state をクリア。seed 回帰の 21／23／7 は基準日・一次源付きの名前付き canary 定数へ変更した。
- `hit_type` の名前付き定数化と non-null assertion 解消は、M18 の設計凍結範囲を越える同一課題 `hit-type-named-constants` として後続へ延期。製造側から中央 backlog／DES 本体は変更していない。取り込み後のコード上の未解決は 0。
- 取り込み後の検証は対象 Vitest **5 files / 66 tests**、`make test`（Go 全 package＋Web **119 files / 905 tests**）、`make build`、M18-03c E2E **3/3** がすべて green。

### 開発者実機フィードバック追補（2026-07-29）

- materialize 新規生成の説明は既定時間では読み切れないため、当該 toast だけを自動消去せず、×で閉じるまで表示する。「開く」は維持し、共通 `Toaster` と短い通知の既定値は変更しない。
- 手動確認レーンは検索タブから `hit_type` が一意に決まるため、キャラクターに加えて `hit_type` も非活性化した。
- 成立ツリーも検索キャラクターとガード種別別 `hit_type` をプリフィル・固定する。一方、`opponentMoveId` は手動確認レーンだけが渡すため、成立ツリーの自動採用は引き続き行わない。
- 対象 Vitest **6 files / 102 tests**、TypeScript check、`make test`（Go 全 package＋Web **119 files / 908 tests**）、`make build`、M18-03c E2E **4/4** が green。
- 最終フィードバックで、materialize 長文通知の×を左上から右上へ変更。専用 toast クラスの CSS 変数だけを上書きし、共通 `Toaster` と他通知には波及させていない。

### 一次受け Q4：連続 materialize 通知の上限化（2026-07-30）

- Q1〜Q3 は完了として一次受け済み。Q4 で、`duration: Infinity` の新規生成通知が materialize の実行回数だけ積み上がる未保護箇所を確認し、本サブの §4.8 通知実装の不備として修正した。
- 通常加算／counter 変換は固定 ID `materialize-result`、加算スキップ（SA／CA・値欠損・未知理由）は `materialize-result-attention` とした。同種は最新 1 件へ置換するため永続通知は最大 2 件。回復しにくいスキップ理由は通常結果では置換しない。
- 回帰 E2E を 2 件追加。同種 2 回で説明文と「開く」が最新生成物へ更新されること、390×844 で SA／CA→通常→値欠損を連続生成しても通常／要注意の 2 件に収まり、3 回目の materialize が通知に妨げられないことを確認した。
- 通知契約（自動消去しない／右上×／「開く」／FR301 既存一致時は新規生成の長文通知を出さない）は維持。共通 `Toaster`、短い通知、BE、DB、マイグレは変更していない。
- 最終確認は対象 Vitest **3 files / 36 tests**、`make test`（Go 全 package＋Web **119 files / 910 tests**）、`make build`、M18-03c E2E **6/6**、既存 M18-03a/03b E2E 直列 **7/7** が green。実装コミットは `4620448`。

## M19-04（フレーム費用モデルの列追加）2026-08-01

- 消費したマイグレ連番は **000049〜000052 の 4 本**（着手時の末尾は 000048）。**並行レーンの M14-03e は 000053 から払い出すこと。** Phase 2（人手 backfill）は開発者の CSV 記入待ちで未実施のため連番を予約していない。
- `character_data/*.csv` を 20 → **23 列**へ（17 ファイル・1479 データ行・値は空欄）。既存 20 列は全 1496 行で完全一致を機械検証。**`marisa.csv:80` にクォート付きフィールド（`notes_tool` に埋め込みカンマ）があるため、列追加は RFC4180 パーサで行う必要がある**（カンマ数ベースの一括置換・検証は誤検知する）。
- **golden は「4 stem」ではなく実体は 7 stem**（`generate_m1403d_test.go` に manon の 000045/46/47 が追加済み）。指示書・レビューチェックリストの記述が 1 波古い。
- **実測資料 `character_data/chain-cancel-measurements.md` は v2.3.0（55 件 / 18 キャラ）** で、指示書が前提とする v2.1.0（53 件 / 17 キャラ）より新しい。投入 37 行は不変（55 − 未 seed 18）だが、**指示書 §4.4.5 の「投入しない範囲」にマリーザが漏れている**。
- 指示書 §4.6 の括弧書きは連打版の `startup_basis` を `through` と示唆するが、**設計正本 DESIGN-07 §9-1 は `basis=standalone` ＋親参照**と明記しており矛盾する。指示書自身が「DESIGN-07 に従え」としているため `standalone` を採用した。
- **課題**: `move_derivations` は表を作成のみでデータ未投入。DESIGN-07 §9-1 が要求する「親参照」は**親の基数が未確定**（連打版は別ボタンからのチェーンでも出るため親が 3 通りありうる）で、設計自身がリンクを「ザンギエフ着手時の個別承認」に送っている。**M19-05 では親参照が無いと連打版 3 行が単独 filler / target に混入する**。設計伝達レポート §4-1 に起票。
- **課題**: `move_derivations` の明示削除責務が 000049 の DDL コメントにしか無い。seed 再生成波（DELETE → INSERT で id 再発番）で残存行が別の技を指す「静かに壊れる」型。中央 backlog への登録をスラッグ案 `move-derivations-explicit-delete-on-reseed` で依頼済み（設計伝達レポート §4-1b）。**製造は中央帰属資料を直接編集しないため未登録。**
- **課題**: `internal/service/punishfinder/service_test.go:429` に `strings.HasPrefix(move.Code, "jumping_heavy_")` があり、本サブが是正した「前方一致では `neutral_jumping_heavy_kick` を取り落とす」と同型。プロダクション側（`constants.go:26` の部分一致）は正しく、実害はテスト内の参照実装に留まる。**契約 F-1 が `punishfinder` を凍結しているため未修正。**
- **ボード D-104 の未決に回答**: `golang-migrate/migrate/v4 v4.19.1` の `source/migration.go:93` `Next()` は**ソート済み index の次要素**を返す実装で `version+1` を要求しない＝**連番の穴は無害**。真の危険は逆で、**大きい番号が適用済みの後から小さい番号を差し込むとその 1 本が永久にスキップされる**。並行レーンの不変条件は「穴を作らない」ではなく「払い出した番号より小さい番号を後から作らない」。
- 検証は `go test ./...` / `go vet ./...` exit 0、golden 7 stem green、`seedgen -check` OK、`make e2e` は 62 passed / 6 flaky / 1 failed（失敗した `m14-03b-custom-states-realdata` は単独実行 green＝既知 flakiness `e2e-flaky-isolation`）。

## M19 Phase 2（フレーム費用 3 列の人手値投入とデータ是正）2026-08-07

- 消費したマイグレ連番は **000064（①）／ 000065（②）の 2 本**（着手時に `ls migrations/` を実査し、末尾が 000063 であることを確認して払い出した）。**★M19-04b / 04c / 04d は本ファイルへの追記が漏れている**（指示書 §5 の指摘どおり）。本節はその再発を避けるために書いた。
- **マイグレを 2 本に分けた理由**（D-223）: ①は値を変えない（新列 2 本と `move_derivations` のみ）、②は契約 F-2 を条件付き解除して既存フレーム列を是正する。**①②それぞれの直後で canary を測り、どちらが候補集合を動かしたかを行単位で切り分けるため。**
- **canary は①で 1 行も動かず（v63 と v64 の全数射影が byte 一致）、②で 3532 節点が動いた。説明できない差分は 0 件。** 内訳は `docs/handover/design-reports/20260807-m19-phase2-design-exceptions.md` §2-3。

### 投入内訳

- `startup_basis` **293 行**（standalone 225 / through 68）。母数 308（11 キャラ 159 ＋ 第三波 149）。**記入値は `unknown` 5 / `保留` 1 / `空欄` 1 を別々に数えている**（D-138 / D-207。`非攻撃技` は `startup_basis` 側には出現しない）。
- `fastest_unreachable` **35 行**（B 型一覧 8 ＋ §1.4 の名指し 13 系統から 27）。B 型一覧の `非攻撃技` 8 行は投入しない。
- `move_derivations` **63 対（子 37 行）**を追加し 9 → 72 行。
- D-187 の **153 行**（`startup IS NULL` の移動 system move）を `unknown` へ戻した。
- v63 → v64: standalone 1054 → 1126 / through 273 → 341 / unknown 326 → **186** / fastest_unreachable=1 109 → 144。

### ★指示書の想定と食い違った点（実装判断・すべて設計伝達レポートへ）

- **指示書 §1.6 (a) の「ノーマル版 4 行」は 3 行が正**。HEAD の `kasai_thrust_kick` は `name_ja` が「火砕蹴(OD風鎌蹴り派生)」＝②の是正対象そのもので、ノーマル版の行は存在しない。
- **②は 21 行を対象に突合して実際に動いたのは 20 行**。`drink_level_4_ransui_haze_2_retreat` は一次源と現行が完全一致だった。
- **rashid `wall_jump` は指示書の値（startup 34 / active 42）では内部整合が成立しない**（34+42−1+0 = 75 ≠ 現行 total 81）。開発者裁定で **35/42/0/76** に確定。
- **m_bison `devil_reverse_od` / `head_press_od` の `startup_basis` は投入しない**。記入欄の「standalone に変更したい…相談したい」に対する相談結果が D-226（`unknown`）である。親参照だけ付けた（D-227 の新述語が `unknown` も拾う）。
- **`startup` が NULL の 4 行**（m_bison `psycho_mine_auto_detonation` / marisa `scutum_counterattack` / `_od` / rashid `run`）は記入値 `standalone` だが投入しない。C で戻すのと同じ結果になる（D-187）。
- **指示書 §4-13 の「golden 7 stem」は古い**。実測 **10 stem**（M14-03e で 000055〜000057 が増えた）。
- **CHANGE は新規起票しなかった**。D-227 に対応する **CHANGE-093 が registry v1.100.0 で 2026-08-07 に払い出し済み**であり二重起票になる。**ただし `docs/change-notes/CHANGE-092/093-*.md` の実体が未作成**。
- **`docs/process/m18-m19-contract.md` §2 F-1 が D-199 の新文言に未追随**（旧文言のまま）。同 §4 の CHANGE 次番号「092」も失効（registry は 094）。

### 課題・申し送り

- **★B 型の網羅は保証できない**（D-225）。`is_aerial` の実セマンティクスが「ラッシュ版を作るか否か」（D-222）のため、空中から出す必殺技が `is_aerial=0` で入っており機械判別に乗らない。**開発者の名指しリストが一次源**。
- **記入欄に埋め込まれたスコープ外の指示 7 件を投入せず報告に回した**（設計伝達レポート §3-1）。特に **jamie `freeflow_strikes` 系 16 行の親参照**は、非飲酒版と飲酒版で「単発」を表す `move_code` の付き方が反転しており親が一意に定まらない。**誤ってもエラーにならない**ため推測しなかった。
- **案 C の canary（39）はマイグレ側から測れない**。`buildStarters` が非公開で、`internal/service/` に diff 0 が要求されるため測定コードを置けない。全数射影の突合で代替した。M19-05 で F-1 を解除するときに版固定の測定手段を用意すると以後が楽になる。
- **kimberly `elbow_drop` の `startup_basis` は `standalone` のまま**（`is_derived=0` の機械付与）。開発者の「`through` として登録されていない疑い」は事実だが 308 行の母数外。
- **★`M19-DESIGN-07` §4-3 / §9-5 が失効している**（レビュー指摘 H-2・CLAUDE.md §8「設計書間の矛盾」）。同資料は「11 キャラ分の `fastest_unreachable = true` は **1 行のみ**と確定した」「件数固定テストは **1 行ちょうど**で書く」とするが、一次源は **D-207 の振り替え後に `true` 4 行**（kimberly `elbow_drop` / lily `great_spin` / zangief `flying_body_press` / `flying_headbutt`）。指示書 §1.2 B は「11 キャラ 4 行」と正しい値へ更新済みだが `M19-DESIGN-07` 側が追随していない。**M19-05 は同資料を正本として読むため、放置すると「1 行ちょうど」の期待値が書かれて落ちる。**
- **`docs/handover/docs-map.md` の文書ID表に M19-PHASE2 指示書・チェックリストが載らない**。`scripts/generate-docs-map.sh:37` は `^| 文書ID |` を拾うが、両文書のメタ表は `| **文書ID** | **M19-PHASE2** |` と**太字**のため一致しない（設計伝達レポートは非太字なので拾えている）。D-203 と同型の是正（メタ表側を非太字にする）が要る。
- Phase 2 の後に残る `unknown` は **186 行**（c_viper / dhalsim 18 ＋ 移動 system move 153 ＋ 人手で投入しなかった 15）。M19-05 の入力。
- 検証は `go test ./...` 全パッケージ green、`go run ./cmd/seedgen -check` OK（golden 10 stem）、`go vet` / `gofmt -l internal/ cmd/` 出力なし、`internal/service/` と `internal/seedgen/` の diff は 0。

### M19 Phase 2 追補（`000066` / `000067`）2026-08-07

- **jamie 流酔拳の `move_code` が飲酒版と非飲酒版で反転していた**（開発者申告の入力ミス）。`name_ja` は両系統とも正しく、誤っていたのは `move_code` だけ。開発者裁定「`_1hit_` 版を既定にする」により非飲酒版 4 対 8 行を入れ替え（三点更新）。
- **★UNIQUE (character_id, code) があるため A↔B の直接 swap は書けない。** 一時 code へ退避する 3 段階にした（`000063` の改名は片方向で `NOT EXISTS` ガードが使えたが、双方向 swap では同じ手が使えない）。**ガードは `name_ja`（alias の `(単発)`）で行う**——新規 DB は golden 由来で既に新 code を持つため 0 行に当たる。**フレーム値はガードに使わない**（値は再計測で動きうるが `name_ja` は技の同一性を指す）。
- **★改名すると、既存の backfill マイグレが「入れ替わった相手の行」に値を入れる。** `000064` は旧 code で `startup_basis` を投入しており、golden が新 code になった結果、新規 DB では 単発に `through` / フルに `standalone` が入る。**エラーにならない**ので `000066` の末尾で新 code に対して書き直した。**既存マイグレは非改変**なのでこの形になる。
- 追補②（`000067`）で m_bison 4 行の `fastest_unreachable = 1` ／ kimberly `elbow_drop` の `startup_basis` を `through` へ ／ jamie 流酔拳の親参照 16 対を投入。いずれも設計伝達レポート §3-2 で「投入せず報告」としていた項目。
- **★canary の基準ファイルが三点更新で陳腐化した。** 改名前に採った射影を基準に v67 と比較したところ、有利フレーム変化 244 節点・始動技入替 1451 節点という大きな差分に見えた。**これは「13F の単発」と「53F のフル」が code を交換したことによる見かけ上の差**で、旧 code を新 code へ機械変換して突合すると **29655 行が完全一致**した（物理的な候補集合は不変）。**基準は必ず現ツリーで取り直すこと。**
- `docs/seed-data/check-criteria.md` §3 に観点を追加——「`move_code` の接尾辞と `name_ja` の対応が系統内で一貫しているか」。**今回の反転は既存のどのチェックにも掛からない**（重複でも欠損でも異常長でもなく、`total` の内部整合も通り、公式との件数比較も一致する）。行単体では検出できず、系統ごとの対応表を作って初めて見える。
- 検証は `go test ./...` 全パッケージ green ／ `seedgen -check` OK ／ `go vet`・`gofmt` 出力なし ／ `internal/service/`・`internal/seedgen/` の diff 0。新規 DB 経路と既存 DB 経路（dev DB のコピー）の双方で同一の最終状態を実測。

### M19 Phase 2 追補③（`000068`）2026-08-07

- **`fastest_unreachable` の 5 行を既定値へ戻した**（m_bison `devil_reverse` / `devil_reverse_od` / `head_press` / `head_press_od` ＝ `000067` A の全部、kimberly `elbow_drop` ＝ `000064` B）。開発者裁定「最速入力で当たるので `false`」。148 → 143。
- **★列の意味の取り違えが実際に起きた。** `fastest_unreachable = true` は「単独で最速入力しても地上の相手に**当てられない**」であり「当たるか」ではない。**一次源（記入欄・B 型一覧）の記入値が 5 行とも逆だった。値域は 0/1 でどちらも妥当なため、製造・レビューのどちらもコードからは検出できない。** `DES-003` §3.3 と記入用一覧のテンプレートへの注意書きを設計卓へ依頼。
- **`startup_basis` は戻さない**——`elbow_drop` の `through` は維持。「ジャンプからの通し値か」と「単独最速で地上に当たるか」は**独立した軸**である。
- **同型の 7 行は据え置き**（開発者裁定「`elbow_drop` のみが例外。他は通常のジャンプ攻撃と同じ性質」）。`migrate_m19p2b_test.go` の `m19p2bAerialUntouched` で `standalone` / `1` を対固定した。
- **E2E の 4 flaky は `SQLITE_BUSY`**。`insert combo: database is locked (5)` が実エラーで、**同じ signature は 2026-08-03（本サブ着手前）にも出ている**。本サブ由来ではない。
- **★ログの `path` を見ないと、どの DB にマイグレが当たったか分からない。** 2026-08-08 の 2 回の起動はいずれも E2E スタック（`web/e2e/.tmp/combomgr-e2e.db`）で、dev DB ではなかった。**「migration completed version: 67」だけを見て dev DB が追随したと読むと誤る。**

### 課題（M19 Phase 2 の実機確認中に発見）: E2E 実行が `config.toml` に E2E 設定を焼き付ける

**2026-08-08 に実際に発生し、dev DB へのマイグレ適用確認を 3 回空振りさせた。**

- **症状**: `make e2e` の後に `go run ./cmd/combomgr` を起動すると、dev DB ではなく **E2E 用の使い捨て DB**（`web/e2e/.tmp/combomgr-e2e.db` / port 47390）に接続される。ログの `migration completed version: NN` だけを見ると dev DB が追随したように読めるが、**`db path resolved` の `path` を見ないと気付けない**。
- **機序**: `web/playwright.config.ts:89-90` が E2E バックエンドへ `COMBOMGR_DB_PATH` / `COMBOMGR_PORT` を渡す → 実行時 cfg がその値になる → E2E spec（`m18-02` / `m18-03b` / `m18-03c` の `initialize()`）が **`PUT /api/config`** を呼ぶ → **ハンドラは実行時 cfg を起点に `config.toml` を丸ごと書き戻す**ため、env 由来の `database.path` と `server.port` が**ファイルに焼き付く**。
- **既知制約として `internal/config/config.go:22-33` に明記されている**（`EnvDBPath` / `EnvPort` のコメント）。**設計は認識していたが、E2E spec が `PUT /api/config` を呼ぶ経路と組み合わさると自動で踏む**ことまでは書かれていない。
- **`config.toml` は `.gitignore:72` で管理外**のため git から復元できない。今回は過去のアプリログ（`server starting` の `addr`）から dev のポートが **47590** であることを特定し、`database.path` は `""`（`internal/infra/db/db.go:70-73` により OS 既定の `~/.local/share/combomgr/combomgr.db` へ解決）へ手で戻した。
- **★対処案（設計卓・infra レーンへ）**: (a) `PUT /api/config` の書き戻しから env 上書き中の項目を除外する（`main.go:186-188` の L-04 フォールバック永続化が既に同じ考え方でスキップしている。**同じ保護を `PUT /api/config` にも掛ける**のが素直）／(b) E2E spec が `PUT /api/config` を呼ばずに済むよう fixture を用意する／(c) 最低限、`make e2e` の後に `config.toml` を復元する。**(a) が本筋**——既存の L-04 の保護と非対称なのが原因である。
- **【2026-08-14 決着】対処案 (a) を採用して根治した。** `PUT /api/config` は実行時 cfg とレスポンスを変えず、永続化用コピーだけをディスク上の値へ戻す。対象は env override を持つ **`server.port` / `database.path` / `logging.level` の 3 項目**。ファイル不在時は既定値を土台にするため、初回セットアップの他項目は従来どおり書き戻る。env 上書きが無い場合の 3 項目の書き戻しも回帰テストで固定した。**`go test ./...` 全緑、`make e2e` 73/73 passed。実行前後の `config.toml` は 314 bytes・SHA-256 `68fcebe1ea010734438f5d1394e5a68b6d396a18b7c0c7e8dd63957951df9cd6` で一致し、`cmp` も exit 0。** 設計変更・マイグレーションは不要だった。followup `config-toml-write-back-env-asymmetry` は完了へ更新。
- **★運用上の教訓**: 「マイグレが当たったか」をログで確認するときは、`migration completed` の `version` だけでなく **`db path resolved` の `path` を必ず見る**。

### M19-06 成立条件による絞り込み 2026-08-09

- **コンボ一覧に「成立条件（`combo_setup_results`）」の絞り込みを足した。** `ListFilter` に `SetupResult` / `SetupTechType` / `SetupInCorner` の 3 項目（既存 13 は不変）、`GET /api/combos` に `setup_result` / `setup_tech_type` / `setup_in_corner`、FE に native select 3 つ。**マイグレ非消費・スキーマ変更なし・列カスタマイズ非改変。**
- **★3 状態の述語は「混ぜない」ことが全て。** `ok` は EXISTS（**一部が `ng` でも 1 つ `ok` があれば該当**）／`ng` は「`ng` がある」かつ「`ok` が 1 つも無い」（**`ok` の単純な否定ではない**）／`unverified` は「セットプレイを 1 つ以上持つ」かつ「当該セルの行が 1 つも無い」。**セットプレイ 0 件のコンボは 3 値のどれにも該当しない**——「該当なし（圏外）」と「未検証」を混ぜると後から復元できない（`chain_cancel_total` の NULL 2 種＝D-137／D-143 と同じ形）。
- **★指示書が規定していなかった軸が 1 つあった＝論理削除された `setups`。** `setups` の SoftDelete は `combo_setups` の行を消さないため成立条件の行も残るが、画面（`ListSetupsByComboIDs`）は `s.deleted_at IS NULL` で絞って見せている。除外しないと**画面上「セットプレイが無い」コンボが `unverified` に出る**。Plan Mode で開発者へ上げ、**3 述語すべてから除外する裁定**を得た。**「コンボの論理削除」（`IncludeDeleted` / `OnlyDeleted`）とは別の軸である**ことに注意。
- **§5 の否定形走査は 3 系統（本番コード／テスト資産／設計文書）とも混入なし。** `SetupResultGrid.tsx:33` は行が無ければ `unverified` を返しており、`web/e2e/m19-03-setup-results.spec.ts:378-381` は `result:"unverified"` の PUT が 400 になることを固定している（保存値でないことの担保）。**本サブが誤りを引き継ぐ恐れは無い。**
- **★§2.5 の対象画面は 4 項目とも実査し、2〜3 は「触らない」と判定した。** マイコンボは `useComboListFilters` を共有しておらず（独自の `useSearchParams` 実装）、エクスポートは `ExportQuery` の 6 フィールドを明示列挙して詰め替えるため新項目が流れない。**「検索」に相当する独立の面は存在しない**（ルータ全 19 ルートを実査。`/punish/search` は別系統）＝**一覧のフィルタが検索である**。
- **★この環境（クラウド実行・fresh clone）に dev DB が無く、`combo_setup_results` の実行数・分布を実測できなかった**（`*.db` は `.gitignore` 管理外）。代替として **3 値それぞれの該当／非該当をリポジトリ層テストで対固定**した（件数だけでは条件を広く当てすぎても検出できない＝`SUPP-001` §5.5.2 (3)）。**実データ確認は開発者側の dev DB で要実施。**
- **★E2E の 1 回目が 34 failed になったが、原因は本サブと無関係の「コンテナ初回起動で `config.toml` が未初期化」だった。** 失敗した spec のページスナップショットが軒並み **「初期設定 / ようこそ」**（初回セットアップウィザード）で止まっており、`initialize()`（`PUT /api/config`）を持つ m18／m19 系の spec だけが通っていた。**`config.toml` は `.gitignore` 管理外のため fresh clone には存在しない。** m18／m19 系の spec が初期化を書き込んだ後に再実行すると、同じ spec 群が全て green になることを実測して切り分けた。**初回の E2E は初期化の有無で結果が変わる**——落ちた spec 名だけを見て回帰と読むと誤る。
- 検証は `go test ./...` 全パッケージ green ／ `pnpm test` 119 files・924 tests green ／ `go vet`・`gofmt -l internal/ cmd/` 出力なし ／ `tsc --noEmit` clean ／ `migrations/`・`moves`・`character_data/`・`internal/service/punishfinder/`・`internal/service/setplay/` はいずれも diff 0。
- **機械レビュー（fresh subagent）は重大ゼロ・高ゼロ。** 中 3 件・低 3 件のうち **4 件を取り込み、低 2 件を理由付きで不採用**とした（採否は `docs/progress/m19-06-review.md` 末尾「取り込み結果（自動トリアージ）」に事後監査可能な形で記録）。取り込んだ主なもの——**(a) 成立状態を「全て」へ戻すとき軸 2 つも落とす**（軸だけが残ると `disabled` のせいで個別に消せず、`hasActiveFilters` は true のまま、次に成立条件を選んだ瞬間に意識していない軸が復活する。**絞り込み結果は正しく UI の一貫性の問題**だが、裁定「効かない指定を作れないようにする」の趣旨とねじれていた）／**(b) テストの `labelsOf` を fixture 由来のコンボだけに閉じる**（`allLabels` の完全一致が「HEAD の `combos` が空」に依存しており、`000012` が「フェーズ3で総入れ替え」と述べている以上、将来の seed で巻き添えに落ちうる＝`SUPP-001` §5.5.2 (1)(2)）。
- **★軸「不問」時の意味は CHANGE-094 へ 1 行残すよう上げた。** 軸が nil のとき述語はセル横断で評価するため、**4 セル中 1 セルだけ `ok` を記録したコンボは `ok` に該当し `unverified` には該当しない**。指示書 §2.1 (b) の逐語実装だが「一部だけ記録済みを未検証として拾いたい」という読み方も自然に起きうるので、**後から「どちらだったのか」を復元できるように書き残す**（本サブが警戒している NULL 2 種＝D-137／D-143 と同じ形の予防）。
- **【2026-08-09 追記】開発者が dev DB（`/home/node/.local/share/combomgr/combomgr.db`）で実測し、§3-6・§3-7 の一部が埋まった。** **セットプレイを持たないコンボ 31 件／持つコンボ 4 件（全 35 件）**、**成立条件の行は 0 件**（3 値の内訳 `ok=0` / `ng=0` / `unverified=4`）。**★G-2 は実データで確認できた**——`unverified` に**圏外の 31 件が 1 件も混ざっていない**。混ぜていれば 35 件すべてが出ていたはずで、**除外されたこと自体が述語の実証**である。値域外 400 も実データ経路で確認。
- **★ただし `ok` / `ng` の述語と軸は実データを 1 度も通っていない**（対象行が 0 件のため）。**「3 値の合計＝セットプレイを持つコンボ数」の一致も、全件が `unverified` に落ちた状態では検算として弱い。** **0 件のデータに対する検算は「壊れていない」ことしか言わず、「効いている」ことを言わない**——分割の一致だけを見て確認済みと読むと、最も込み入った `ng`（`EXISTS` + `NOT EXISTS`）が未評価のまま通過する。**成立条件を 2 件だけ手入力すれば `ok` / `ng` / 軸の 3 つが一度に評価対象になる**ので、実データ確認は「データが無いなら作ってから引く」まで含めて手順にすべきだった。
- **★【要裁定・2026-08-09】軸の「不問（全て）」が単調でないことが実機確認で表面化した。** 開発者が dev DB で「不成立 × 画面端=全て → 0 件／画面中央 → 1 件」を観測し、続けて「未検証 × 受け身=全て → 1 件／後ろ受け身 → 3 件」も報告。**製造側で fixture を組んで両方とも再現した**（検証用テストは実行後に削除）。
- **原因は `EXISTS` と `NOT EXISTS` で単調性が逆を向くこと。** 軸を「全て」にすると相関サブクエリが見る行が増える。`ok`（`EXISTS` のみ）は単調増加で直感どおりだが、**`ng`（`EXISTS` ∧ `NOT EXISTS`）は単調でなく、`unverified`（実質 `NOT EXISTS`）は単調減少する。** **現行の「全て」は「各セルの答えの OR」ではなく「セルを問わず 1 回だけ問う」である。** 問いが肯定形のときだけ両者が一致するため、`ok` では違和感が出ない。
- **★これは指示書 §2.1 (b) の逐語実装であり実装の誤りではない。** 一方で**指示書は「3 値の述語（当該セル基準）」と「軸の不問」を別々に定義しており、両者を組み合わせた意味を定義していない。** 機械レビューの中2 として「1 行書き残してほしい」で上げていた論点が、**書き残すだけでは済まない裁定事項**として実データで表面化した形。
- **★製造は現行のまま止め、独自に変更していない**（CLAUDE.md §9 / 指示書 §7.3）。選択肢 A（現行維持）／B（各セルで問うて OR）／C（A＋ラベル明示）と、**B のコスト見積り**を設計伝達レポート §4-2c に記載した。**B の性能コストは実質ゼロ**（`ok` は現行と完全同一、`ng` はむしろサブクエリが 2→1 に減る、索引の効き方も不変）だが、**3 値の排他性が失われる**ことと **`unverified` が「対象セル数」＝`OKI_TECH_TYPES` の要素数に結合する**という 2 つの非性能コストがある。
- **★教訓: 「述語 P」と「評価範囲 R」を別々の節で定義した仕様は、P に否定が入った瞬間に組み合わせの意味が自明でなくなる。** 単調性（R を広げたとき該当が増えるか）は**肯定形の述語でしか保証されない**。**仕様に「不問／すべて」の類の値を置くときは、否定を含む述語との組み合わせを 1 例でも表に書いて確かめる**と、実装前に気づける。今回は `ok` だけを頭に置いて「不問＝絞らない」と読んでいた。
- **【裁定・2026-08-09】開発者が B（各セルで問うて OR）を選択。実装・テストとも完了。** **判定の単位を「セル」（`tech_type` × `in_corner` の組）へ変え、3 値とも「対象セルのいずれかで成り立つか」を問う形にした。** 実装は `setupResultWhere` の 1 関数のみ（**API・FE・型・保持機構は変更なし**）。`ng` は `GROUP BY csr.tech_type, csr.in_corner` ＋ `HAVING SUM(ng)>0 AND SUM(ok)=0`、`unverified` は「記録済みセル数 < 対象セル数」。対象セル数は `model.OkiTechTypes`（新設した値域の正典スライス）の要素数から導出する。
- **観測されていた例①は解消**——同じデータで「不成立 × 画面端=全て」が **0 件 → 1 件**（条件2・条件3 は従来どおり）。**`ok` は 1 件も結果が変わらない**（`EXISTS` はセルの OR に対して分配的）。
- **★既存のリポジトリ層テスト 11 本を 1 行も変えずに green だった。** これは偶然ではなく、**「軸を両方指定したときの結果は変更前と完全に一致する」**（対象セルが 1 つに定まる）ことの機械的な担保になっている。**変わったのは `ng` と `unverified` の「軸に不問を含む場合」だけ**である。新規 3 本を追加——うち **`AxisIsMonotone` は 3 値 × 軸 8 通りで「個別指定の結果 ⊆ 全ての結果」を固定**しており、**今回の裁定の眼目そのものをテストにしている**。
- **★代償として 3 値は排他でなくなった。** 画面端では成立し画面中央では不成立のコンボは `ok` にも `ng` にも出る。**開発者が実データ確認に使っていた「3 値の合計＝セットプレイを持つコンボ数」の検算はもう成立しない**——**代わりに単調性（個別指定 ⊆ 全て）が検算になる**。**★`unverified` の意味も変わった**（旧「1 セルも記録が無い」→ 新「未記録のセルが 1 つ以上残っている＝埋め残しがある」）。いずれも `DES-005` §5.4 への明記が要る（CHANGE-094）。
- **★教訓: 「不問／すべて」は述語の外側の話に見えて、実は述語の一部である。** 当初は「不問＝その軸で絞らない」と読んで実装したが、**否定を含む述語では「絞らない」が「評価範囲を広げる」を意味し、結果は狭くなる**。**評価範囲を変える選択肢を UI に置くときは、述語ごとに単調性を 1 度確かめる**——肯定形だけを頭に置いて設計すると、否定形の側で必ず裏切られる。
- **【2026-08-09 是正】完了報告 §4 と設計伝達レポート §4-1 の「`ok` / `ng` / 軸は実データを 1 度も通っていない」が失効したまま残っていた**（開発者の指摘で発覚）。**同じ文書の §4-2c に「4 セルすべて記録済みのコンボで `ng` × 画面端を実測」した記録があり、正面から矛盾していた。** 実際には (1) 成立条件 3 行を投入しての 3 値・軸・EXISTS 意味論の確認（一時データは投入後に削除して原状復帰）(2) 4 セル記録済みコンボでの `ng` 3 通り (3) **B 採用後の条件1〜3 の引き直しで「意図通り」の確認** (4) 画面の実機確認、まで完了している。**§4-3 として実測の経過を表で追記し、§6 既知の限界 1 も解消に更新した。**
- **★教訓: 「未確認」と書いた節は、確認が済んだ時点で更新しないと、同じ文書の中で自分と矛盾する。** 本件は**確認の依頼を書いた節と、確認結果が入ってきた節が別だった**ために起きた。**依頼を書くときに「結果はどこへ書くか」を同じ節に決めておく**と、更新先が一意になって取り残されない。**未確認の記述は、放置すると「まだ危ない」という誤ったシグナルを設計卓へ送り続ける**——今回は開発者が読んで気づいたが、気づかれなければマージ判断を誤らせていた。
### M19-05 消費側（段階 A・B。マイグレ非消費）2026-08-09

- **契約 F-3 を解除して新列の消費を開始した。** M19-04 と Phase 2 で投入した `startup_basis` / `chain_cancel_total` / `fastest_unreachable` / `move_derivations` が、初めてエンジンから読まれる。**API には露出させていない**（`GET /api/moves` 非露出は維持）。
- **★Plan Mode の実測が設計卓の想定を 5 件覆した。** いずれも「11 キャラ時点の値が第三波 seed 後も生きた記述として残っていた」型である。裁定は `M19-05-PLAN-MODE-RULINGS` v1.1.0（D-260〜D-266）。
  - **段階 C の除外述語に一致するのは 16 行**（想定 3 行）。うち ken 3 行・m_bison 2 行は**現に成立レーンに載っており**、除外すると「親から出せば実機で成立する技」を落とす偽陰性になる。**同じ述語を setplay と punishfinder で共用する前提そのものが誤り**——問いが「自分が単独入力できるか」と「相手が出しうるか」で別である（D-260）。⇒ 段階 C は M19-05 から外れた。
  - **§2.5 の前提（D-131(b)）が実装と食い違っていた。** `HasPrefix` は「従来 prefix 方式」を意図的に再現した**対照群**であり、是正すると canary 37 と増分検証がまとめて無効化される（D-261）。⇒ 是正しない。
  - **`target_combo` は 67 → 80 行**（維持側 63 → **76**）。**案 α の副作用は ~187 → 508 行**。いずれも設計文書の数字を写さず実測で固定した。
- **★素案の target ゲートが `M19-DESIGN-07` §9-4 を落としており、実測で検出した。** 「`is_derived` → basis」を素直に書くと**+172 行**が解禁され、`denjin_charge_*` / `mai/flame_*` / `mine_set_*` / `drink_level_*` / `windclad_*` 等の**状態前提技が一斉に target へ入る**。§9-4 は「状態変種 standalone の target 除外は**暫定 `is_derived` ゲート継続**」と明記しており、解禁してよいのは `startup_basis='through'` の行だけである。**是正後は解禁 57 / 除外 23 に収まった。**
  - **機構上の原因**: `§5-3`（除外条件を `basis=unknown` のみへ狭められる）は **filler 側**の記述で、target 側の継続条件は **§9-4** にある。**節をまたいで読み合わせないと誤る配置**になっている。設計卓へ注記を依頼した。
- **合成 filler 単位は「キャラ名でなく性質」で書けた。** 2 番目以降の候補を「単独入力不可のチェーングループ員があればその集合、無ければグループ全員」とすると、**ザンギエフ連打版の特例が要らなくなる**（`M19-DESIGN-07` §9-1 の実測性質 ①②の一般化）。実データで両分岐が発生する（zangief のみ前者・他 16 キャラは後者）ため、両方をテストで対に固定した。
- **★残件（開発者裁定＝除去せず報告）**: 合成単位は**追加**したが、チェーングループ員を単発として複数含む解を**除去していない**。同じ表記が KA によって S=42（実機 22F）と S=46（全 total 26F）の 2 通りで出る。後者は §1-2-6 が「実現不能レシピであり除去対象」と名指すが、**何をもって「隣接」とするかの判定法が DESIGN-07/08 に無い**。M19-01/02 からの既存挙動でありデグレではない。設計卓の裁定待ち。
- **★GC-2 の green は実データでの動作を保証していない。** golden は fixture 側で `thunder_kick` に親参照を与えているが、実データには無い（`quick_dash` を親に取れるかが D-233 の未裁定事項）。**この 3 点対を `golden_test.go` の冒頭コメントにも書いた**——テストだけ読む後任が「green だから実装できている」と読まないため。
- **測定手段を常設化した**（D-237）。`internal/infra/migration/canary_setplay_projection_test.go`（`CANARY_SETPLAY_OUT` / `CANARY_SETPLAY_VERSION`・SHA256 付き）。**規則を SQL で書き写さず `setplay.ProjectCandidates`（本番と同じ関数）を呼ぶ**ため、述語を直したときに測定側が静かに古くなることがない。
- 検証は `go test ./...` 全パッケージ green（46 パッケージ）／ golden **5/5** ／ canary `37/39/16` 不変 ／ `go vet`・`gofmt` 出力なし ／ `internal/service/punishfinder/`・`internal/seedgen/`・`migrations/`・`character_data/` の **diff 0**。
- **フロントは `web/node_modules` が本実行環境に無く `lint` / `tsc --noEmit` を実行できていない。** 変更は locale JSON の 3 キーのみ（JSON 妥当性は検証済み）。

#### M19-05 レビュー取り込み（2026-08-09）

- **重大判定（R-1〜R-7）はゼロ**。指摘 14 件は**全件採用**（不採用ゼロ＝「高」の握り潰しは発生していない）。
- **★「候補集合は測ったが提案結果を測っていない」という測定の穴を突かれた**（指示書 §4.1 の段階 B の測定点）。実測ハーネスを常設化して測ったところ、**`DES-002` §4.2 の性能実測「juri KA40 gap 全種別＝4884 件 / 25.6ms」は現行と合わない**（現行の最大は **juri meaty 全種別＝1215 件 / 6.1ms**）。
  - **★ただし 4884 との差を M19-05 の効果と読んではならない。** `M19-02` 完了報告 v1.1.0 の注記が「gap 列は**初期 gap 実装（第 1 active 基準）時点の測定値**」と述べており、**gap 定義の確定（完全空振り）後に再測定されていなかった**。本測定はその再測定を兼ねる。
  - **★meaty は gap の定義変更の影響を受けないため、こちらは M19-05 の増分として読める**——meaty 既定 323 → 550（+70%）／meaty 全種別 677 → 1215（+80%）。
  - **副産物**: `M19-overview` §3 の「残件導線の再検討（`maxLimit(3000) < totalFound(4884)`）」は、**現行の最大 1215 が `maxLimit` を下回るため前提が消えた**。再検討は不要と判定した。
- **★合成単位の生成量に上限が無かった。** `budgetCap = KA + 2` は KA に比例して緩み、**KA は VAL-C10 が WARNING のみで −600〜+600 が警告なしに保存できる**。KA=600 では 3 員グループでも Σ3^k ≒ 9,840 単位を**エンジンの枝刈りが効く前に確定的に構築**する。`maxChainUnits = 2000` を追加し、あわせて**深さ優先を幅優先へ変更**して上限到達時に短い連鎖が残るようにした。
- **★`role=parent` を実際に出力するようになったのに、コメント 3 か所が「本サブでは未出力」のまま残っていた。** D-250 と同型（実装者はコードを読み、注記は読まない）。**通常のテストでは絶対に検出できない**。指示書 §5 の否定形確認の走査キーワードに「**本サブが値域を増やした識別子**」（今回なら `parent`）を含める運用を次サブへ申し送る。
- **★テストが HEAD 依存になっていた**（指示書 §4.2-12 の確認そのものを report に書いていなかった）。`dbtest.Setup`（HEAD 適用）から **v68 への版固定**へ変更。**残り 14 キャラの seed 波が入ると `TestM1905_*` が落ち、しかも「M19-05 が契約を破った」と読める名前で落ちる**——正しい対応（期待値の更新）と名前が示唆する対応（実装を疑う）が食い違う。
- 枝刈りの是正 1 件（末端判定と非末端判定を分離）・gap × 合成単位のテスト追加・`recipe_hash` の既存 setup 非マッチの明記など、低優先 6 件も取り込んだ。

### M19-07 コンボ新規登録時のセットプレイ成立条件の入力 2026-08-09

- **`BundledSetupRequest`(コンボ同梱)に `verifiedConditions` を足し、`CreateSetupRequest`(単独作成)との非対称を解消した。** コンボ新規登録・コピー時に同梱で作るセットプレイの「確認できた条件」を入力でき、**コンボと同一トランザクション**で `combo_setup_results` へ記録される。**変更は 10 ファイル・+968/−6 行**(うち 5 ファイルがテスト、1 ファイルは E2E のコメントのみ)。
- **★指示書が求めたサービス層の作業は、実は既に入っていた。** 指示書 §2.1 は「サービス層でコンボ作成の Tx 内に `combo_setup_results` を書く」と書いていたが、**`CreateSetupInTx` は M19-03 の時点で既に `InsertComboSetup` の直後・同一 Tx 内で `insertVerifiedConditions` を呼んでいた**(`service.go:243-250`)。**欠けていたのは API 層の写像 1 か所だけ**(`toServiceCreateInput` が `VerifiedConditions` を埋めていなかった)。結果 `internal/service/` ／ `internal/repository/` に **diff 0** で、R-4(新しい書き込み経路)は構造的に発生しなかった。
  - **★着手前の実査で欠落箇所を特定していなければ、既にあるものを二重に書いていた。** 同一 Tx 内で `insertVerifiedConditions` が 2 回呼ばれても `ON CONFLICT DO UPDATE` のため**エラーにならず気づけない**形になる。「指示書が書いている作業＝まだ無い作業」と読まないこと。
- **★§3-2 の突合は「差は `verifiedConditions` だけ」で確定した**(前提は崩れていない)。ただし副産物として **`BundledSetupStepRequest` と `SetupStepRequest` が「構造同一・別名」の 2 型**であることが分かった。**R-8 が禁じるのは「同名で中身が違う型」**なので別事象と判定し、統合していない(§8.3)。
- **パッケージ境界は「import して型をそのまま使う」で跨いだ**。type alias も共有パッケージも作らず、`setupapi.SetupResultConditionRequest` を直接使う(宣言ゼロ＝「型は 1 つ」が自明)。**`internal/api/setup` は `internal/api/combo` をテスト含め一切 import しておらず循環しない**ことを実査済み。**★これが本プロジェクト初の api → api 参照である**(既存 0 件)。
- **`SetupResultGrid` / `SetupResultEditor` はどちらも再利用できなかった。** Grid は表示専用かつ**全セル未検証だと `null` を返して何も描かない**(本サブの既定と正面衝突)、Editor は `comboId`/`setupId` 必須で**1 クリックごとに即時保存**する(**そのまま載せることが R-9＝M19-01 の再発そのもの**)。新規 `VerifiedConditionsField`(API を呼ばない controlled component)を作り、**セルの組・語彙・i18n キーはすべて既存の正典を参照**した。
- **★§2.5-1 の `SetupSelectorModal` は v3 原則に反していない。触らなかった。** 全 87 行を実査した結果、**ネットワーク呼び出しは読み取り 1 本のみ**で、選択時は親の `linkedSetups` へステージングするだけ。実際の `POST …/setup-links` は**コンボ作成成功後**に発番された id で走る＝**保存時点では親が確定している**。保存 UI ではなく選択 UI である。触らない理由は 2 つあり(スコープ外／link の POST はコンボ作成 Tx の外で走るため同一 Tx 要件を満たせない)、どちらか一方でも十分。
- **★§5 の否定形走査で、テスト資産に v1 形の残骸が 1 件見つかった。** `web/e2e/m19-03-setup-results.spec.ts:349` の `// セットプレイ編集画面には成立条件 UI を置かない(comboId を持たないため)`。**アサーションも括弧内の理由も現行(v3)どおり正しい**のに、**文頭の言い回しだけが撤回済み v1(画面名による禁止)の形**だった。コメントに v3 の根拠を明記して是正(アサーション・テスト名は不変)。
  - **★指示書の走査キーワードと文字列が一致しない**(指定は `セットプレイ編集画面に置かない`、実際は `セットプレイ編集画面には成立条件 UI を置かない`)。**完全一致では取り落とす。** 走査は近縁変形(助詞の挿入・目的語の追加)まで広げる必要がある。**原則を撤回したとき危ないのは原則そのものではなく、正しい判断に貼り付いた古い言い回し**である——中身が正しいぶん見逃されやすい。
- **★CHANGE 番号レジストリと契約 §4 が同時に失効していた。** `change-number-registry.md:126` は「次回起票は **095** から」と書いているが、**`CHANGE-095-notification.md`(M19-06 分)が既にディスク上に存在する**。レジストリ §1 表に 095 の行が無く、契約 `m18-m19-contract.md:102` も **094** のまま。**⇒ 本サブの番号は `096`。** 同 126 行が「★この行は連番を消費するサブが完了するたびに古くなる」「**サブの完了報告と対で更新する運用が要る**」と**自ら予告していたとおりに失効した**。警告文を書くことは運用にならないため、設計伝達レポート §8 に「併せて更新が要るもの」を常設項目として置いた。
- **★既知の非対称を 1 つ作った(意図的)。** 値域外 `techType` の応答が **同梱＝400 / 単独＝500** になる。原因は `internal/api/setup/handler.go:46-53` の `CreateSetup` が `ErrInvalidResultValue` を写像していない **M19-03 からの取りこぼし**。直すと §4-8 / R-2(`CreateSetupRequest` を使う既存経路の不変)に抵触するため**本サブでは直さず、裁定を設計卓へ上げた**。
- **`copy` は「成立条件だけ」ではなく「同梱セットプレイごと」引き継がない**(`ComboEditor.tsx:145-146` が モードに依らず空配列で開始し、`initial.setups` は copy 経路から読まれない)。**M19-07 以前からの挙動**で `DES-005` §5.7:374 どおり。本サブは変えずテストで固定した(N-7 も維持)。
- 検証は `go test ./...` 全パッケージ green(46 パッケージ)／`pnpm test` **120 files・940 tests green**(変更前 119・924)／`go vet`・`gofmt -l internal/ cmd/` 出力なし／`pnpm lint`(tsc --noEmit) clean ／**E2E 70 passed・0 failed**。`migrations/` ／ `internal/service/punishfinder/` ／ `internal/service/setplay/` ／ `internal/api/setup/` ／ `internal/repository/` ／ `character_data/` ／ `internal/seedgen/` はすべて **diff 0**。
- **★E2E の 1 回目が 36 passed / 34 failed になったが、M19-06 が記録したのと同一の環境要因**(fresh clone に `config.toml` が無く初回セットアップウィザードで止まる。`initialize()` を持つ `m18-*`/`m19-*` 系だけが通る)。**落ちた 34 件の顔ぶれも M19-06 完了報告 §9 の記載と一致**。1 回目の実行中に初期化が書き込まれたため、そのまま再実行して **70/70 green**。**落ちた spec 名だけを見て回帰と読むと誤る**(M19-06 からの申し送りが 2 サブ連続で当たった)。
- **`code-facts.md` を再生成した際、M19-05 / M19-06 の未反映分も一緒に取り込まれた**(`ListFilter` の 3 列・`MoveCandidate` の 3 列・`MoveDerivation` の新規行)。生成物であり本サブが手で書いた差分ではない。

#### M19-07 レビュー取り込み（2026-08-09）

- **重大判定(R-1〜R-9)はゼロ・優先度「高」もゼロ**。指摘 12 件のうち **採用 9・不採用 3**(不採用はいずれも「低」＝`cornerLabelKey` の置き場／マークアップ重複／BE-FE 値域の機械的固定。いずれも followup 送りで理由を記載)。**「高」の握り潰しは発生していない。**
- **★レビューが新規の穴を 1 つ突いた——`CreateRequest` は POST と PUT(キー変更編集)で共用されており、PUT に載せた `verifiedConditions` は黙って無視される。** `handler.go:371` が `toServiceCreateInput(req.CreateRequest)` を呼ぶ一方、サービス層で `input.Setups` を読むのは `Create`(`service.go:252-253`)だけで `UpdateWithKeyChange` は一切読まない。**`setups` 自体が以前から同じ扱いで本サブの不具合ではない**が、本サブは「`edit` には入力 UI を出さない」を明示仕様として選んだため、**`DES-002` に「PUT では無視される」を併記しないと API 単体利用者が「PUT でも書ける」と読む**。実装は変えず(対称化の範囲を超える)、設計伝達レポート §4-8 と CHANGE たたき台へ反映依頼を追加した。
- **★「制約がコードのどこにも書かれていない」型の指摘を受けた。** api → api 参照(本プロジェクト初)について、`dto.go` のコメントは「現時点で循環しない」しか述べておらず、**逆向きの依存を作れないという制約が残っていなかった**。`architecture-patterns.md` は §0 が「新パターンは**設計担当が**追記する」と定めているため製造は編集せず、**コード側に制約を明記**(逆向き禁止／必要になったら共有パッケージへ切り出す)＋設計卓へ追記依頼、の分割対応とした。
- **★指示書 §3 の 8 項目のうち §3-8(BE / FE の値域一致)だけが報告に明示されておらず、テストコメントに埋もれていた**と指摘された。結論自体は正しかった(両側とも `neutral_tech`/`back_tech` の 2 値)が、完了報告 §2.2 として独立の節を新設した。**「実査した」と「実査結果を報告した」は別**である。
- 低の即修正 3 件——テストコメントと実体の不一致(「システムエラー」と書いて実体はバリデーションエラー経路)／完了報告のファイル数の自己矛盾(4 と 5)／copy テストへの「仕様変更時はこのテストでは G-3 を守れない」注記。
- **取り込みによる実装ロジックの変更はゼロ**(コード変更はコメント 3 か所のみ)。再検証は `go vet`・`gofmt` 出力なし／`go test`(2 パッケージ) ok／`tsc --noEmit` clean／`ComboEditor.test.tsx` 32 passed。**E2E は実装ロジック不変のため再実行しないと判断した。**

#### M19-07 未決事項の確定（2026-08-09・開発者回答）

- **★Plan Mode が回答前にタイムアウトし、未決事項 3 件は推奨案(現状維持)のまま実装が完了していた。** 事後に再提示して確認したところ、**3 件とも現状維持で確定**(実装変更ゼロ)。①FE 共通化は新規箇所のみ ②CHANGE-096 は製造では起票せず設計卓へ ③作成レスポンスに `results` は載せない。
- **★再提示にあたって変更コストを実査したところ、当初の説明に誤りが 1 件あった。** 「`SetplaySuggestionSection` を差し替えても既存 7 テストは無改変で通る」と述べていたが、**既存テストは fieldset に `setplay-confirmed-conditions` を期待している**のに対し本 component は fieldset の testid を `testIdPrefix` そのままにするため、**2 テストが落ちる**。さらに**採用ダイアログは slate 系・コンボエディタは gray 系で配色が違う**ため、素直な差し替えでは採用ダイアログの色味が変わる。**「変更コストは小」と答える前に実測すべきだった。**
- **★共通化の利得も過大評価していた。** 重複しているのは**マークアップと配色だけ**で、**セルの組(`SETUP_RESULT_CELLS`)・受け身の語彙・端の i18n キー・legend/hint の i18n キーは既に両方が同じ正典を参照している**。値域が増えても放っておいて両方へ伝播するため、片肺更新の危険があるのは見た目と a11y 属性のみ。**「重複している」と「同期が壊れうる」は別**である。
- **★開発者依頼で「`POST /api/combos` のレスポンスの `setups[]` はデッドコードか」を調査した。** 結論＝**厳密にはデッドコードではないが、本番コードの消費者はゼロ**。FE 本番コードは読まない(`useCreateCombo` は `setQueryData` せず、`handleSaveSuccess` は `id`/`characterId`/`validations` のみ読む)／E2E が `combo.setups` を読む 6 か所は**すべて GET のレスポンス**／**Go ハンドラテスト `TestHandler_Create_201_WithSetups` だけが assert している**／`DES-002` §4.2 は `POST /api/combos` のレスポンス形状を規定していない。**実体は「コンボ作成のたびに走る余分な `ListSetupsByComboID` クエリ 1 本 ＋ 誰も読まないペイロード」。**
  - **削除検討時の注意**: `ComboResponse.Setups` フィールド自体は GET 詳細が使うので消せず、消せるのは **`Handler.Create` の埋め込みブロック(`handler.go:66-90`)だけ**。テスト 1 本の改修が要り、**レスポンスからフィールドが消える＝後方互換を破る変更なので CHANGE が要る**。
  - **★未決事項③と同根である**——「作成レスポンスの `setups[]` はそもそも使われていない」から「`results` を足しても誰も読まない」が導かれている。**2 件は同時に裁定するのが自然。**
  - **`followup-backlog.md` §H への登録は設計卓へ依頼した**(設計伝達レポート §4-10・§8)。**製造は同書を直接編集していない**——§H・§I が「中央登録」と明記し、`git log` 上も設計卓セッションのみが編集しているため。
- 本追記による**コード変更はゼロ**(ドキュメント 3 ファイルのみ)。

#### M19-07 追補: 成立条件入力の 2×2 グリッド化とセットプレイ登録画面への追加（2026-08-10・開発者要望）

- **★要望 1 はこちらの実装不足だった。** 指示書 §2.3 は「`DES-005` §5.6 項目10 と**同じ 2×2 グリッド**(受け身種別 × 画面端)を再利用する」と求めていたのに、**`SetplaySuggestionSection`(採用ダイアログ)のインライン実装をそのまま流用したため、チェックボックス 4 個の横並びになっており「2×2」という構造が画面に現れていなかった**。開発者が実機で「分かりにくい」と指摘。**指摘のほうが指示書に忠実である。**
  - **★「既存の同型実装を流用する」は、その実装が正典に忠実である保証にならない。** 採用ダイアログ側も同じ形をしており、**2 か所が同じ誤りを共有していたため相互チェックが効かなかった**。流用元が正典どおりかを確認せずに写した。
- `VerifiedConditionsField` を `SetupResultEditor` と**同じテーブル構造・同じ Tailwind クラス**で描き直した。セルは **`<input type="checkbox" className="sr-only">` を `<label>` で包み、label へ編集画面のセルと同じクラスを当てる**——見た目を揃えつつ**複数選択のセマンティクスと既存 `data-testid` を保つ**ため、`SetupInputRow` の既存 4 テストが無改変で通った。
- **`SetupResultLegend` に optional な `states` を追加**し、本フィールドは `[ok, unverified]` の 2 値だけ出す。**選べない「不成立」を凡例に出すと「不成立も付けられる」と誤読される。** 既定値を現行と同一にしたため**コンボ詳細側の DOM は不変**で、`SetupResultGrid`/`SetupResultEditor` の既存テストも無改変。
- **★E2E が a11y 欠陥を 1 件検出した。** Playwright が「アイコンがポインタを遮る」で落ちたのが発端だが、**根本は `sr-only` の checkbox がフォーカスされても視覚的な手がかりを出さないこと**だった。label に `focus-within:ring-2` を足して是正。**テストが落ちた原因を回避せず、落ちた理由が指している実際の欠陥を直した**——`force: true` で通していたら a11y 欠陥がそのまま残っていた。
- **要望 2(セットプレイ登録画面への追加)は BE 変更ゼロで済んだ。** `POST /api/combos/{comboId}/setups` は M19-03 で既に `verifiedConditions` を受け付け同一 Tx 内で書いており、TS の `CreateSetupInput` にもフィールドがある。**FE の配線のみ**(`internal/` に diff 0)。
  - **v3 原則の判定＝`親確定 ○`**(URL に `comboId` がある)。
  - **★`/combos/:comboId/setups/new` と `/setups/:setupId` は同一コンポーネント(`SetupEditorPage`)である。** 編集画面は `DES-005` §5.6 が「実装しない(開発者判断 2026-07-28)」と明記しているため、**`mode === "create"` の分岐が唯一のガード**になる。E2E `m19-07-setup-conditions.spec.ts` の `B:` でこれを固定した。
- **★`DES-005` に 2 か所の未記載が見つかった**——(1) **§5.9 の表示項目は 5 項目で成立条件が無い**(登録画面の仕様なのに今回追加した項目が載らない) (2) **§5.6 の v3 判定表に `/combos/:comboId/setups/new` の行が無い**(編集ルート `/setups/:id` しか挙げていないが、**同一コンポーネントなのに登録側だけ未記載**)。CHANGE-096 の範囲へ追加するよう設計卓へ依頼した。
- **★採用ダイアログだけが旧デザインで残り、新しい不統一が生まれた。** 2026-08-09 に「差し替えない」とご判断いただいた根拠は「**見た目は同じだから実害がない**」だったが、**今回のグリッド化でその前提が失われた**。明示的な判断を無回答で覆さない方針で現状維持とし、設計伝達レポート §4-3 に「開発者判断待ち」として記録した。**判断の根拠が失効したときは、判断そのものを再提示する必要がある。**
- 検証は `pnpm test` **120 files・948 tests green**／`tsc --noEmit` clean／**E2E 73 passed・0 failed**(新規 spec 3 件を含む。70 → 73)／`go build`・`go vet`・`gofmt` OK／**`internal/`・`migrations/` に diff 0**。

#### M19-07 追補その2: 採用パネルの成立条件も 2×2 グリッドへ統一（2026-08-10・開発者判断）

- 追補その1 で残った唯一の旧デザイン面、**コンボ詳細 →「セットプレイ自動提案」→「採用」で展開されるインラインパネル**(`SetplaySuggestionSection`)を `VerifiedConditionsField` へ差し替えた。**本番コードで「確認できた条件」を持つ 4 面すべてが同一の 2×2 グリッド**になった。
- **★UI の指し方を誤って開発者判断を誤らせかけた。** 製造が「採用ダイアログ」と呼んだため、開発者は**「既存から紐付け」ボタン**(`ComboDetailPage.tsx:144` → `LinkExistingSetupModal`)のことと解釈し、いったん「問題ない」と判断した。**`LinkExistingSetupModal` は全 72 行・`SETUP_RESULT_CELLS` の出現 0 件で、そもそも成立条件を持たない**別物である。実際の対象はモーダルですらなくインラインパネルだった。**UI を指すときは呼称ではなく到達経路(どのセクションのどのボタンを押すと出るか)で書く。** 開発者の「問題ない」を額面どおり受けて終えていたら、誤った前提のまま不統一が残っていた。
- **既存 26 テストを無改変で通すため `fieldsetTestId`(optional・既定＝`testIdPrefix`)を足した。** 採用パネルは **fieldset が `setplay-confirmed-conditions`・セルが `setplay-confirmed-{key}`** と**接頭辞と fieldset 名が別**の契約を持つため、`testIdPrefix` 一本では表せなかった。
- 状態を `Set<string>` → `SetupResultCondition[]` へ変え、`toggleConfirmed` を削除、payload は素通しにした。**`VerifiedConditionsField` の `toggle` が `SETUP_RESULT_CELLS` 順で組み直すため、payload はセルの順序まで従来と同一**である(等価性の根拠)。
- **★配色は当初の説明と逆に倒した。** 「slate → gray に変わる」と説明していたが、実装を見ると**中身(テーブル)が既に slate で外枠だけ gray** という混在だった。**外枠を slate へ寄せる**ほうが (1) 採用パネルの配色が一切変わらない (2) コンポーネント自身の混在も解消する、で変更が小さい。**説明した方針でも、実装時に根拠が変わったなら倒し直す。**
- **★E2E の破損を実装前の grep で先に潰した。** `m19-03-setup-results.spec.ts:184` が `setplay-confirmed-*` を直接 `.check()` しており、**`sr-only` 化でクリック不能になる**ところだった。追補その1 で同じ失敗(「アイコンがポインタを遮る」)を踏んでいたため、計画段階で「既存 E2E に `.check()` があれば同じ失敗が出る」と予見して確認できた。label クリックへ変更し `toBeChecked()` の確認を追加。
- 検証は `pnpm test` **120 files・949 tests green**(`SetplaySuggestionSection` の既存 26 件は無改変)／`tsc --noEmit` clean／**E2E 73 passed・0 failed**／**`internal/`・`migrations/` に diff 0**。
- **`DES-005` §5.6 項目12 への反映依頼**を設計伝達レポート §8 に追加(採用パネルが項目10 と同じ 2×2 になった旨)。

### 反映レーン: `scripts/generate-docs-map.sh` の生成ガードが SIGPIPE で誤判定していた（2026-08-10・反映係）

- **★症状**——`bash scripts/generate-docs-map.sh` が「❌ 抽出破損の疑い: §1 文書ID逆引き(DES-002) が見つかりません」で中止する。**当初は低頻度**（1 回目が落ちて 2 回目が通る）だったが、**2026-08-10 に失敗率が 96% まで上がった**（下記の実測）。
- **★原因**——本スクリプトは `set -euo pipefail` で走る。ガードの `need()` が `printf '%s\n' "$sec1" | grep -qE "$3"` の形をしており、**`grep -q` は最初の一致で即座に終了する**。すると上流の `printf` が **SIGPIPE で落ちる**（終了コード 141）。**`pipefail` がそれを拾ってパイプライン全体を非ゼロにする**——**一致しているのに「不一致」と判定される。**
- **★間欠だった理由**——`printf` が書き終わるより先に `grep -q` が終わるかどうかは、**セクションの大きさとパイプバッファ（既定 64KiB）の関係で決まる**。**再現率は §1 が育つほど上がる。** **実測**——親コミット `3dacf8e` 時点の §1 は **68,712 バイト**で、旧形でも **10 回中 10 回通った**。本日 `M19-CLOSE-REPORT`／`M19-OVERVIEW` の 2 行を収録して **95,184 バイト**になった時点で **50 回中 48 回失敗**する。**★「恒常再現」ではない**——**失敗はあくまで確率的で、`printf` と `grep` の実行タイミングに依存する**（**当初 5 回連続で失敗したため恒常と記述したが、50 回の標本で 48/50 と判明した。クリーンルームレビュー第 2 ラウンドの実測**）。**数値は `docs/handover/docs-map.md` の §1 ブロックの実測。再測できる形で残す。**
- **★是正**——`need()` の `grep -qE` から **`-q` を外し `>/dev/null` へ**（入力を最後まで読み切るため SIGPIPE が起きない）。**判定ロジックそのものは変えていない。** 意図と再発防止をコメントで残した。
- **★検証**——**3 回連続実行で `docs/handover/docs-map.md` が byte 一致**（`md5sum` 同値）。`M19-CLOSE-REPORT` と `M19-OVERVIEW` の 2 行が §1 に載ることを確認。
- **★教訓**——**`set -o pipefail` と `grep -q`（および `head` / `sort -u` 等の早期終了コマンド）は同居させない。** 「入力が小さいうちは通り、育つと落ちる」ため、**導入時のテストをすり抜ける**。

### M20-RESEARCH-01 web 調査（A／B／C／E、2026-08-12）

- **結果**: 指示書 §0.5 の環境割当により **Claude Code on the web で軸 A／B／C／E の 18 項目**を実測（**軸 D／F の 9 項目はローカル担当＝下記の別エントリが正**。本セッションは相手側レポートを読んでいない）。マイグレをクリーン適用した使い捨て DB（`schema_migrations` 68／`combos` 0 行・`setups` 0 行）と `character_data/*.csv` 全 17 ファイル 1,479 行を SELECT／grep。`(character_id, alias_text)` の衝突 **0 グループ／走査 1,653 行**、`move_commands` 未対応 `moves` **759／1,653**（実質の未割当は OD 技 4 件）、`rush_variant` 272 件は **268 件が「元技エイリアス + `(ラッシュ)`」の 1 形のみ**、通常投げは 17 キャラ全て正規化済みで `背負い投げ` 0 件（**followup §G-14b 解消**）。read-only 逸脱なし（`git status` 空・使い捨て DB とビルド成果物はリポジトリ外）。
- **横断課題**:
    1. **★指示書 §6 DoD の「`progress-log.md` へ索引行を追記」と §2.1／§2.2 の「変更してよいのは成果物 1 本のみ・`docs/` 配下の他ファイルは変更しない」が直接衝突する。** 本追記は**開発者判断（2026-08-12）により実施**。**本体（設計卓）へ連絡済み**——read-only 調査指示書のテンプレートが `CLAUDE.md` §8 の常設要求と両立しない形になっており、実行者が read-only 逸脱の判定を独断で行わされる。
    2. **★指示書 §6 の「A-1 〜 F-4 の計 22 項目」が実数と合わない。** 実数は **27 項目**（A5+B5+C5+D5+E3+F4）。§0.5 でセッションを 2 分割した際に DoD の項目数が旧のまま残っている。
    3. **★指示書 §5 の見出しが `M20-RESEARCH-01-report.md` のまま**で、§2.1 の 2 本立て（`-report-web.md` ／ `-report-local.md`）に追従していない。
    4. **★前提事実 12 が失効している。** `BUILTIN_PRESET_CODES` は `numpad_ja` ／ `numpad_en` ではなく DB seed と**完全一致**（`official_ja_move` ／ `official_ja_command` ／ `numeric_ja` ／ `numeric_en` ／ `srk`）。`numpad_` はコード側 0 件。「未参照のため実害なし」も不正確で `ComboDetailRecipe.tsx:30` が実参照。**D-299 ／ D-300 に「コード値不一致の是正」が含まれるなら不要。**
    5. **★A-4 の「0 件」の 1 つは段 1 に隠れている。** `guile.csv` の 3 行が `command` 列に `cond{` を実際に含むが `is_derived=true` のため skip 段 1 で落ち、段 4 に到達しない（`raw{` は 17 ファイル全文で真に 0 件）。さらに **`SkipUnknownToken` が段 3〔`raw{`〕と段 5〔語彙外〕で共用**のため、`seedgen -index-report` の理由別内訳では 2 段を切り分けられない。
    6. **★既定プリセット id が 2 か所に独立してハードコードされている。** `config.Default().Defaults.PresetID = 1`（int64）と `model.DefaultPresetID = "1"`（string・`recipe_cache` のキー）が**非連動**で、`PUT /api/config` で既定を変えても cache から引くキーは `"1"` のまま。あわせて **`config` の検証は `preset_id >= 1` の範囲検査のみで `presets` への実在確認をしていない**（`internal/config/config.go:225` ／ `internal/service/config/service.go:227` の 2 経路とも）。
    7. **★`numeric_ja` ／ `numeric_en` にエイリアスを投入すると既存テストが落ちる。** 「0 件であること」を固定したテストが `internal/infra/migration/migrate_test.go:928` と `internal/repository/preset/repository_test.go:157,163` にある。
    8. **★不可視文字は 0 件だが、括弧の全角／半角が混在している。** `alias_text` 1,653 行のうち全角括弧 33 行、**同一文字列に両方を含むものが 12 行**。完全一致で引く逆引き契約（`DES-004` §5）に対して不可視文字と同型の影響を持つ。
    9. **★本セッションのクローンは shallow（56 コミット）** で `git log -S` の追跡が取得済み範囲に限られる。前提事実 12 の是正時期は**未確認**。full clone を持つ環境での確認が要る。
- **報告書**: [`M20-RESEARCH-01-report-web.md`](M20-RESEARCH-01-report-web.md)（指示書 `docs/instructions/M20-RESEARCH-01-preset-data-reality.md` v1.1.0）
### M20-RESEARCH-01 ローカル調査（D／F、2026-08-12）

- **結果**: 開発 DB の WAL-aware copy を SELECT し、有効 combo 39 行・setup 14 行、保存済み cache 53 JSON / 265 表示値を実測。raw `moves.code` 固定化と現行 resolver との差はいずれも 0/265 件。
- **横断課題**: `RecomputePresetCache` / `DeletePresetCache` の本番呼出元は 0 件。`SUPP-001` §7.1 の delete → insert 記述に対して実装は inline JSON の逐次 UPDATE。combo mutation 3 経路は `defaultRecipe` field を空文字で返す組立経路。
- **報告書**: [`M20-RESEARCH-01-report-local.md`](M20-RESEARCH-01-report-local.md)

### M20-01: 初期プリセットの 3 種化（2026-08-12）

- **結果**: `go test ./...` 全緑（57 パッケージ・FAIL 0）／ `pnpm test` 949 テスト pass ／ `tsc --noEmit` exit 0。**消費マイグレ連番 `000069`**（`m20_initial_presets_three`）。**組み込みプリセットを 5 種 → 3 種へ**（`official_ja_move` / `numeric` / `srk`）。**`id` は詰めず `1` / `3` / `5` で `2`・`4` は欠番。** 契約テスト 10 件（up 7・down 3）を `migrate_m2001_test.go` に新設し、**ミューテーション 2 件で検査力を裏取り**（down から `id` を落とす → DN-2 が FAIL ／ up に id 詰めを足す → U-3 が FAIL）。レビュー重大判定 **0 件**、高 5・中 3・低 2 は**全件採用**（「高」の不採用なし＝エスカレーションなし）。
- **報告**: 完了報告 [`M20-01-completion-report.md`](M20-01-completion-report.md) ／ レビュー [`m20-01-review.md`](m20-01-review.md)
- **★横断課題**:
    1. **★リポジトリ上の指示書 `M20-01-initial-presets-three.md` とレビューチェックリストが v1.0.0 のままで、設計卓の追加裁定 4 件（A-1〜A-4）が未反映である。** Plan Mode の着手前実査が設計卓の誤り 3 件（**M-42** ＝ §2.1 のテスト配置が `SUPP-001` §5.5.2 (2) 違反 ／ **M-43** ＝ §4.6 #2・#3 の「削除」は同一関数の 2 行を独立 2 件と誤読したもの ／ **M-44** ＝ §4.6 の母数が旧 code の文字列 grep だったため「個数」で主張する 7 か所が漏れていた）を拾い、設計卓が全件を自らの誤りと認めて裁定を出したが、**ファイルには入っていない**。**指示書だけを読む後続担当は、`srk` への付け替え・`migrate_m2001_test.go` の新設・追随 7 件・`preset.go` godoc の是正を「指示書違反」と誤読する。** ⇒ **設計卓へ v1.1.0 化を依頼したい。**
    2. **★本サブで失効する設計書記述が、現在の是正スコープ（`CHANGE-098` ＝ `DES-004` §3.1・§3.4・§4.2 ／ `SUPP-001` §7.3）の外側に 5 か所ある。** `DES-006:134`（**VAL-P05**「組み込み 5 件＋カスタム、上限 10 件」）／ `DES-006:138` の根拠段落 ／ `DES-004:405`（**§8**）／ `DES-003:889`（§6）／ `SUPP-001:1291`（**§7.5.5**）。**製造は編集していない。誰の手番にも載っていないため、設計卓の判断が要る**（詳細は完了報告 §4.4）。**特に (a)(b) の VAL-P05 は M20-04 のプリセット作成機能が直接参照する検証仕様である。**
    3. **★`docs/handover/architecture-patterns.md:616` の「残り 4 プリセット」が失効している**（本サブ後の実体は**残り 2**）。**歴史記録ではなく「フェーズ3 の前提」としての前向き参照**であり §4.9 (b) の免除に当たらない。**対になる `followup-backlog.md:93` は設計卓が「残り 2」へ更新済みで、片側だけ直っている状態。** 同書は所管が設計担当と明記されているため製造は編集せず記録にとどめた。
    4. **`make e2e` は開発者のローカル環境で成功した**（2026-08-12・開発者報告）。**⇒ 本サブによる E2E 回帰は無い。解消済み。** なお**クラウド実行環境（Claude Code on the web）では `make e2e` が完走しない**——`playwright install` がネットワークポリシーで 403 拒否され、プリインストール Chromium（ビルド 1194）がプロジェクト要求（1223）と不一致であるため。**この制約は本サブ固有ではなく環境固有であり、以後のサブでも同じ壁に当たる。** 回避策として `web/playwright.config.ts` の `PW_EXECUTABLE_PATH` でプリインストール版を指せば起動はするが、フルスイートでは資源競合により大量に落ちる（小バッチでは通る）。**クラウド実行時の E2E は「小バッチでの切り分け＋開発者機での完走」を前提とする運用が要る。**
    5. **★`recipe_cache` の既存行に、消えた id `2` / `4` のキーが残る。** 本サブは再計算しない（**D-313** ＝ M20-05 が持つ）。読み出しキーは `model.DefaultPresetID = "1"` 固定のため表示影響は無いが、**M20-05 が `recipe_cache` を扱うときの前提**として記録する。
    6. **★`PRAGMA foreign_keys = 0` を実測で確認した**（ボード **P-04** は生きている）。`preset_aliases.preset_id` は `ON DELETE CASCADE` を持つため、**M20-04 でカスタムプリセット削除を作るときに、この PRAGMA が効いていないと孤児行が残る。**
    7. **消費した連番の反映**: `000069` を消費したため、**ボード §2.2 と `change-number-registry.md:132` の「次マイグレ連番は 000069」が更新対象**（次に払い出す番号は `000070`、disk 末尾は `000069`）。**CHANGE-098 は設計卓が起票・registry 登録済みで、製造の追加登録は不要だった**（実査済み）。

### M21-RESEARCH-01 Gamepad 入力の実測 PoC（2026-08-12）

- **結果**: 3 段構成（段 1 製造がハーネス作成／段 2 開発者が実機計測／段 3 製造が解析）で完遂。**経路 (a) 使い捨てハーネス・経路 (b) 本体アプリ（Windows ネイティブ exe）とも Gamepad は取得できた ⇒ M21 は成立する**。**経路 (c)（非 localhost）は未測定**——**試行したが LAN 経由でページに到達できず、Gamepad API を一度も実行していない**〔**「取得できなかった」ではない**＝`E-84`〕。**D-309** によりブロッカーではない。**2 機種**（RushBox Mini＝レバーレス／GameSir G7 SE＝パッド・いずれも USB・Chrome 151/Windows 10）で **同時押し各 90 回・単押し各 50 回・長押し各 3 回**を実測。**同時押しのズレは中央値 8.30 ms（2 機種一致）／p95 20.90 ms（レバーレス）〜33.30 ms（パッド）／最大 20.90〜45.80 ms**。**チャタリングは 2 機種とも観測されず**（立ち上がり 50/50 回、多重立ち上がり 0 件／検査 50 グループ、1〜32 ms 帯に 3 指標とも 0 件）＝**`E-41` 型「対策が不要」の候補**（**ただし 2 機種のみで一般化しない**）。**閾値・判定方式は提案していない**（§0.1／§0.3）。本体リポの diff は本報告 1 本と本追記のみ（ハーネス・生ログは `tmp/m21-poc/` ＝ `.gitignore` の `/tmp/` で追跡外・commit していない）。
- **横断課題**:
    1. **★配布バイナリが既存 DB のある環境で起動できない**（**M21 範囲外・`DES-002` §11.2 に直結**）。Windows で `%APPDATA%\combomgr\combomgr.db` が残っていると **000026 が `UNIQUE constraint failed: moves.character_id, moves.code` で落ち、以後 `Dirty database version 26`** で起動不能。**マイグレーション自体は正常**（まっさらな DB では `schema_migrations = (68, 0)`・moves 1,653 行・characters 19 行を実測確認）。**【2026-08-12 開発者判断】当該 DB は「もう使っていないので削除してよい」**〔⇒ 本インスタンスに保全すべきデータは無かった。**削除は開発者が行う**＝`CLAUDE.md` §10 により Claude Code は `*.db` を直接削除しない〕。**ただし観測された挙動そのものは残る。**PoC は `COMBOMGR_DB_PATH` で別 DB へ退避して完結。
    2. **★`DES-002` の参照節が 2 文書でずれている。** 指示書 §3.1／主参照と `docs/process/m21-contract.md` **F-6** は「§11・§14（LAN 利用・バインド）」とするが、**実査では §11 =「対応OSとパッケージング・配布」、§14 =「未決定事項」**。**実体は §3.2（バインドアドレスの制御）・§3.3（ポート番号 47318）・§3.4（公開状態の明示）**。
    3. **★指示書 §6 DoD の「A-1 〜 D-4 の計 16 項目」が実数と不一致。** **A-5 を v1.1.0 で削除したため実数は 15 項目**（A4+B3+C4+D4）。**M20-RESEARCH-01 の横断課題 2 と同型**（DoD の項目数が改訂に追随していない）。
    4. **★指示書「開発者への確認事項」2 件が解決済みのまま残置。** 確認事項 1 は**削除済みの A-5**、確認事項 2 は**是正済みの「100 回」**を参照している。
    5. **★`E-84` の実例**——**A-2（user gesture の要否）は「列挙より前に押されたか」では原理的に判定できない**（列挙されるまでボタン状態を観測できないため）。実ブラウザでは**検出と初回入力が同一フレームに乗る**ため、当初の判定式は **3 経路すべてで答えが逆に出ていた**。**段 1 の自己検査（`harness.html` の実コードを Node で走らせる方式）で実機計測の前に検出・是正**。
    6. **★指示書 §6 DoD の「progress-log へ索引行を追記」と §0.2'／§2.2 の「`docs/` 配下の他ファイルを変更しない」が直接衝突する（再演）。** **M20-RESEARCH-01（2026-08-12 開発者判断）の先例に従い追記した。** **read-only 系 RESEARCH 指示書のテンプレートが `CLAUDE.md` §8 の常設要求と両立していない**——2 本連続で実行者に read-only 逸脱の判定を独断させている。
    7. **計測範囲の限界**（本実装の前提にする場合は追加計測が要る）＝**ブラウザは Chrome 151 のみ**／**接続は USB のみ**／**機種は 2 種のみ**（`DES-005` §6.2〜§6.5 はアケコン・キーボードを含む 4 レイアウトを将来仕様として温存）。**計測環境は約 238 Hz** のため、**フレーム単位の値を 60 Hz 環境へそのまま持ち込めない**。
    8. **新論点＝アナログ値の機種差。** **パッドのトリガー（button 7）は 12 段階の中間値を返すが、レバーレスは 0/1 のみ**。`pressed` だけを見るか `value` も見るかで機種による挙動差が出る面がある（**本 PoC では決めない**）。
- **報告書**: [`M21-RESEARCH-01-report.md`](M21-RESEARCH-01-report.md)（指示書 `docs/instructions/M21-RESEARCH-01-gamepad-poc.md` v1.2.0）

### M21-01: 取得基盤・機種プロファイル・キャリブレーション・接続状態表示（2026-08-13）

- **結果**: `pnpm test` **1023 / 125 files 全緑**（着手前 949/120 ＝ +74）／ `tsc --noEmit` exit 0 ／ `go test ./...` 46 パッケージ ok・FAIL 0 ／ `check-browser-storage-keys.sh` 緑（台帳 8・本番 7）／ `check-enum-sync.sh` ベースラインどおり。**消費マイグレ連番なし**（スキーマ変更なし）。**消費 CHANGE 番号なし**（`CHANGE-106` は設計卓が起票済み。本サブは **addendum** を追加）。**新規ブラウザストレージキー `gamepad-profiles-v1`（台帳 #8）**。`web/src/features/gamepad/` を新設し、**正規化を純粋関数**（`navigator`/`window` 非依存・index 直書き 0・`mapping` 不参照）として実装。**否定形確認は 4 項目とも真の該当 0 件**。レビュー**重大判定 0 件**、高 4・中 6 は**全件採用**（**「高」の不採用なし＝エスカレーションなし**）、低 7 のうち 4 採用・3 は理由つき不採用。
- **報告**: 完了報告 [`M21-01-completion-report.md`](M21-01-completion-report.md) ／ レビュー [`m21-01-review.md`](m21-01-review.md) ／ addendum `docs/change-notes/CHANGE-106-addendum-gamepad-localstorage-key.md`
- **★横断課題**:
    1. **★`DES-005` §6.2 の「14 論理ボタン」は表の行数であって個数ではない。** `direction_1〜9` を 1 行に畳み `direction_neutral` と `5` が重複するため**実個数は 21**、実装は **25**（差分 +4 ＝ `throw_forward` / `throw_back` / `dash_forward` / `dash_back`）。**`CHANGE-106` の反映時に「14」という数え方そのものを改める必要がある。** 実装側の失効コメント（`controllerTypes.ts` の「(14種)」）は本サブで是正済み。**設計書本体は未編集**（設計卓の手番）。
    2. **★`LogicalButton` の方向枝・攻撃枝は本サブが最初の消費者になった。** 従来は参照 0 の死んだ定義で、`useControllerInput.handleSystemButton` はシステム技枝しか扱わない。**M21-03 は物理側の `direction_*` ＋ 攻撃ボタンを既存の `NumpadDirection` ＋ `Strength`/`AttackButton`（`buildTokenKey` が消費する形）へ橋渡しする必要がある。本サブでは橋渡しを実装していない。**
    3. **★台帳 #2 `virtual-controller-layout-v1` は未実装のまま残置。** 本サブは流用していない（用途が「種類選択の値 1 個」で別物、かつ脚注どおり**実装コードへ書くと lint が赤になる**）。**M21-04 / M21-05 がレイアウト種別の選択保持を実装する際に取消線を外して使うのが本来の筋。**
    4. **★`CHANGE-106` §2.2-f の「レイアウト名は残す」が実装に現れていない。** キャリブレーション方式では機体を問わないためレイアウト名を分岐にも提示にも使っていない。**設計卓が §6.3 を改訂する際の判断材料。**
    5. **`step_commit` / `step_delete` はキャリブレーション対象から外して M21-04 へ譲った**（指示書 §1.3 ＝ 余りボタンへの機能割当は M21-04）。**M21-04 は「案内に従って押させる」形に縛られない。**
    6. **★`scripts/check-artifact-integrity.sh` がクラウド実行環境で常に赤になる**（違反 1 件）。`check-md-emphasis.sh --self-test` が `markdown-it-py` 未導入のため「未実行」で非ゼロ終了する（**スクリプトの設計どおりの正しい挙動**であり、リポジトリの欠陥ではない）。**着手前から赤であり本サブ起因ではない。** 開発者機では緑になる可能性が高いが未確認。**M20-01 の横断課題 4（クラウドで `make e2e` が完走しない）と同型の環境固有制約。**
    7. **`check-browser-storage-keys.sh` が stderr へ 3 行のエラーを吐く**（同スクリプト 113-114 行の `DIRECT_ALLOW` 配列要素がダブルクォート内にバックティックを含み bash がコマンド置換を試みる）。**着手前から出ており判定には影響しない**（EXIT=0）。後続サブが自分の変更で壊したと誤認しないよう記録する。
    8'. **【2026-08-13 追補】実機確認は全項目成功し、`make e2e` も開発者機で成功した。** そのうえで出た指摘 4 件へ対応（完了報告 §12）——**(a) 標準配置の既定プロファイルを追加**（`mapping === "standard"` の機体は登録なしで即使える。**★標準は要件ではなく速い経路であり、`normalize` は引き続き `mapping` を読まない**）／**(b) 1 ボタンで出せない 5 件**（前後投げ・前後ステップ・ラッシュ）**をキャリブレーション対象から削除**（マクロは DI / DP / 投げ の 3 件）／(c) 取り直し完了時の文言を `mode` で出し分け／(d) 方向ラベルを「左」「右」へ。**★`CHANGE-106` の as-built が変わった**——`DES-005` §6.3 は「決め打ちの撤回 → キャリブレーション」ではなく「**標準配置の既定 ＋ キャリブレーションによる上書き**」である。**既定の配置は SF6 クラシック既定に基づく推測であり実測ではない**（再確認は開発者手番）。`pnpm test` **1045 / 127 全緑**。**保存キー・保存形式は不変のため台帳と addendum は更新不要。**
    8''. **【2026-08-13 追補 2】★標準配置の既定は実機で正しく動いた**（開発者確認。**推測で置いた index 表が実機と一致していた**＝本サブ最大の未確認事項が解消）。そのうえで指摘 3 件へ対応（完了報告 §13）——**(a) 取り直したあと未設定が残っていれば案内を続ける**（`resumeAfterRetake`。「間違えたから 1 つ戻す → 次の技から再開」。**全部埋まっていれば従来どおり 1 件で完了**）／**(b) 「初期化」導線を追加**（DevTools 不要。他機体は消さない。**未使用だった `clearProfileStore` を削除**）／**(c) devContainer の `pip` 未導入を `followup-backlog.md` §E へ後日課題として登録**（影響は文書 lint のみ・着手前から赤・`exit 2` で「未実行」を申告し緑を返さないため放置可）。**★既存テスト 2 件は旧挙動を固定していたため更新した**（期待値を緩めたのではなく正しい対象を数え直した）。`pnpm test` **1052 / 127 全緑**。
    9. **★実機依存の確認が開発者手番として残っている**（完了報告 §8。**追補 2 ぶんの再確認**）。**アケコン・Bluetooth・Firefox・経路 (c)・60 Hz 環境はいずれも未検証であり、「対応した」とは書いていない。** とくに **Firefox を担保しているのは §5.1 (b) の単体テストだけで、それは「index を仮定していないこと」の検査であって実機動作確認ではない。**
### M20-02: エイリアス生成規則と実データ投入（`numeric` / `srk`）（2026-08-13）

- **結果**: `go test ./...` 全緑（FAIL 0）／ `pnpm test` 949 テスト pass ／ `tsc --noEmit` exit 0。**消費マイグレ連番 `000070`〜`000073` の 4 本**（`alias_text_en` 列追加 ／ OD 技 4 件の索引追随 ／ `numeric` ／ `srk`）。**`numeric` 1,245 行・`srk` 1,260 行を投入**（移動系 171 ＋ 層 B 301/306 ＋ 層 A 513/518 ＋ rush 260/265）。**`alias_text_en` は 76 行**（`micro_forward` / `micro_back` × 19 キャラ × 2 プリセット）。**作ったのは「17 キャラ分を入れるマイグレ」ではなく「規則」**（`internal/seedgen/generate_m2002.go` ＋ `cmd/seedgen -mode aliases`。D-181）。新設テスト 19 本、**破壊テスト 5 件で検査力を裏取り**。
- **報告**: 完了報告 [`M20-02-completion-report.md`](M20-02-completion-report.md) ／ レビュー [`m20-02-review.md`](m20-02-review.md)
- **★横断課題**:
    1. **★ブランチ上の指示書は v1.0.0 のままである。** 設計卓の差分（指示書 v1.2.0 ／ チェックリスト v1.1.0 相当の裁定 D-1〜D-6）を**会話経由で受領して実装した**。**repo 側の v1.2.0 を読めば整合するが、ブランチ側の v1.0.0 を読むと本サブの実装を「指示書違反」と誤判定する。** M20-01 の横断課題 1 と同型の再演である。
    2. **★指示書 §4.3（層 A 先行）と §4.4（サンプル表・構造引き表）が内部矛盾していた。** 実データでは立ち技と J 攻撃の `command` が同一（ともに `p_l`）であり、`command` は地上/空中を表現していない。層 A 先行では DoD §7.1 を満たせず衝突が 102 キー増える。**設計卓が原理化して決着**——「`command` が表記を決める行は層 A、`move_code` の構造が決める行は層 B」（D-1）。
    3. **★`DES-004` §3.4 サンプル表の 7 行のうち 3 行は原理的に生成できない。** `sa1` は実在する `move_code` ではなく（ryu の実体は `sa1_shinku_hadoken`）、numeric 期待値 `236236HP` に対し CSV の `command` は強度指定のない `p` で `236236P` にしかならない。`parry_drive_rush` / `cancel_drive_rush` は `modifiers.type` の非技ステップで `preset_aliases` に入らない。**固定点は 4 行 × 2 プリセット = 8 件**（D-4）。**同節自身が「実装時の確定表記ではない」と明記している。**
    4. **★同一キャラ内の表記衝突を全件検出し、投入していない**（§9.3-5 の停止条件が発動）。**`numeric` 35 キー / 84 行 ／ `srk` 30 キー / 74 行。** SA 注記（D-5）が SA3 vs CA の 17 組を全数解消した後の値である。**★差の 5 キーはすべて「空中版 vs しゃがみ版」**（`zangief/flying_body_press` vs `crouching_heavy_punch` 等）——**`srk` は `cr.` 接頭辞で偶然解けるが `numeric` は表記が「空中で押した」ことを表現できない。** `is_aerial` に `j.` を冠せば解ける見込みだが**層 A の規則変更であり製造の裁量を超える**ため報告にとどめた。**設計卓の判断が要る。**
    5. **★三点更新で適用済みマイグレ `000035` / `000057` を再生成した。** OD 技 4 件の `command` を CSV へ補記した結果 golden が落ちたため。**指示書 §2.2「適用済みマイグレは改変しない」と緊張関係にあるが、`SUPP-001` §5.5.4 (6) が名前を付けたパターンであり、golden をレッドのまま放置する・期待値を緩める・CSV を補記しない、のいずれも採れなかった。** 再生成の diff はちょうど 4 行分。
    6. **★M20-07 に正規化が 1 件増える**（D-6・記録のみ）。SA 注記 ` (SA1)` を含む `alias_text` は `FindMoveCodesByAlias` の完全一致に当たらない。**あわせて `rush_variant` の `DR > 2LP` は 1 ステップの表示文字列の中に連結子と同じ `>` を含む**（§4.7）。どちらも本サブでは直していない。
    7. **★M20-03 の前提**——`(character_id, alias_text)` の**単純 UNIQUE は 714 件に当たるため張れない**（`numeric` と `srk` が同値になる特殊技があるため）。**ただし逆引きが実際に壊れる条件（同一キャラ・同一 `alias_text` で `move.code` が 2 つ以上）は 0 件**である（`findMoveCodesByAliasSQL` が `SELECT DISTINCT m.code` のため）。**一意にすべき単位は `alias_text` と `alias_text_en` の合併集合**（D-317）。
    8. **★データ不備 2 件を発見したが直していない。** (a) **`original_move_code` の入力ミス 4 件**——`glowing_touch_1` 等が実体 `glowing_touch_1hits` と食い違い、`original_move_id` が NULL になっている（ingrid 2・lily 1・mai 1）。`zangief/rush_power_stomps_1hits` だけは正しい。(b) **`lily/windclad_od_condor_spire` の `command` が空欄**——同系統の強度版 3 行は入力を持つ。**本サブで補記した OD 技 4 件（D-318）と完全に同型の入力漏れの疑いが濃い。**
    9. **★`character_data/seed-progress.md` の `seed_imported` が失効している**——`jamie` / `luke` / `m_bison` / `rashid` / `jp` / `marisa` の 6 キャラが「未」だが第三波（`000053` / `000055` / `000057`）で投入済み。**同列は「seed 投入工程/開発者が手動更新」と明記されているため製造は書き換えず注記にとどめた。更新をお願いしたい。**
    10. **★静的分析（awk）で CSV を読んではならない。** `character_data/marisa.csv` に引用符付きフィールドが 1 つあり、`awk -F,` はその行以降で列位置がずれる。**しかもずれた結果がもっともらしい値になるため気づけない**（本サブでは「穴 5 件」「`(hold)` 38 件」等を誤検出した）。**`seedgen.ReadFile`（正式パーサ）を通すこと。**
    11. **`make e2e` はクラウド実行環境で完走できない**（M20-01 横断課題 4 の再演）。`playwright install` がネットワークポリシーで拒否され、プリインストール Chromium は build 1194 でプロジェクト要求 1223 と不一致。`PW_EXECUTABLE_PATH` で起動はするが `combo-crud` / `m12-06` とも失敗する（**失敗の形はエディタ画面の locator 待ちタイムアウトと `/wizard` へのリダイレクトであり、エイリアス表記を検証する assertion は 1 つも含まれない**）。**代わりに実アプリ（`go run ./cmd/combomgr` ＋ 使い捨て DB）で全項目を実測確認した。開発者機での完走をお願いしたい。** なお**表示文字列を固定している spec は実査で 0 件**であり、更新した spec 件数は 0。
    12. **`check-artifact-integrity.sh` が違反 1 件を報告する**——`check-md-emphasis.sh --self-test` が `markdown-it-py` 未導入で不合格。**環境要因であり本サブの変更に起因しない。** `CLAUDE.md` §6 により新規依存の追加は開発者へ提案してからとなるため導入していない（ボード v2.66.0 の「常設検査への昇格は保留」と同じ理由）。
    13. **【2026-08-13 追補・開発者裁定 4 件を反映】** 完了報告 §18 が正本。**(1) `make e2e` は開発者ローカルで全通過** ⇒ 上記 11 は**解消**。**(2) `lily/windclad_od_condor_spire` の `command` を `d dr r plus k k` で補記**——**28 件のうち 1 件は「値を決める対象」ではなく入力漏れだったため、★P-34 の対象は 27 件になった**（`notes_tool` 列の「追加入力（弱中or弱強か中強）」＝任意の 2 キックが値を裏付けた）。**★本行は `is_derived=true` のため生成物が 1 つも変わらず、CSV 1 行で閉じた**（`raw_data` は `command` を含まず、索引は派生を載せず、層 A は非派生のみ）。**(3) `original_move_code` の入力ミス 4 件は別サブへ**——`followup-backlog` §K `rush-original-move-code-typo` へ登録。**★実害を特定した**＝`internal/service/setplay/service.go:144` が `OriginalMoveID == nil` で `TargetType` を空にするため**4 技がセットプレイ自動提案から静かに脱落している**。**(4) 「空中版 vs しゃがみ版」は現状維持。★ただし開発者見解で方向が変わった**——本報告の当初案「`is_aerial=true` の行に `j.` を冠す」は**衝突技への例外付与**に読めるが、開発者案は**「通常の技全体に `j` をつける」＝空中技全体への一貫した規則**である。`followup-backlog` §K `numeric-aerial-vs-crouching-collision` へ登録。**(5) `seed_imported` を 6 キャラ「済」へ是正**——「既配布の保護」が発動しない状態だった（**本サブで OD 技を補記して golden が落ちたのが、まさにその保護が働かなかった結果である**）。あわせて手順書の失効 2 件（「移動系は再適用不要」は H-2 の是正で**誤りになっていた** ／ `-movement-chars` の追記）も直した。
    14. **★★常設検査 `check-md-emphasis.sh` が、新設以来どの環境でも一度も実行できていなかった。** `markdown-it-py` が **devContainer にもクラウド実行環境にもローカルにも入っておらず**（開発者確認）、導入手順が `.devcontainer/` にも `postCreateCommand` にも無かった。同検査は D-319（2026-08-12）で新設され `CLAUDE.md` §8 の検査表にも載っている。スクリプトは未導入時に `exit 2` で「未実行」を返す正しい設計（`E-84`）だったため、**`check-artifact-integrity.sh`（★1 本目に回す検査）が恒常的に赤だった。** ⇒ **開発者承認を得て `.devcontainer/Dockerfile` へ `python3-markdown-it` を追加**（pip ではなく apt。PEP 668 と既存依存の揃えのため）。**初めて実行した結果、自己検査は合格**（スクリプト自体は正しい）**だが実データはベースラインから +1 行**。**★本サブは検査対象ディレクトリを 1 バイトも触っていない**（本サブの文書はすべて対象外の `docs/progress/` 配下）ため**+1 は検査が動かない間に main へ入った既存の回帰**である。**★+1 の所在は当初「特定できない」と報告したが、追補②で特定して是正した**——`git archive 4cab307 docs/ | tar -x` でベースライン時点のツリーを出し、**スクリプトではなく判定ロジックだけを直接回す**と**ちょうど 375 を再現**でき、差分は **`docs/handover/design-reports/20260812-m20-01-design-exceptions.md:161`**（M20-01 の設計伝達レポート・同一行に `**` が 3 個）だった。除去して **375（＝ベースライン）へ復帰**。**★「件数しか保存していないから無理」という当初の結論は誤りで、実際にはスクリプトごと回そうとして `git rev-parse --show-toplevel` の `cd` で詰まっていただけだった。⇒ 一覧の保存は不要。この手順を検査のコメントへ書くよう設計卓へ申し送る。**
    15. **【2026-08-13 追補②】★ベースライン定数を書き換えない**（**D-335**・会話経由で受領。**作業開始後に届いたため事後確認**）。`check-md-emphasis.sh` の `BASELINE_BROKEN` ／ `check-instruction-format.sh` の `BASELINE_FORBIDDEN` ／ `check-enum-sync.sh` の `BASELINE_SCATTER` は**製造が触らない**——**M21-01 と並走しており、同じ 1 行を両ブランチが書き換えると、後からマージした側の古い値が勝ってラチェットが黙って緩む**ため。定数の更新は**設計卓が両レーンのマージ後に一括**で行う。**⇒ 実査の結果、本サブは `scripts/` を 1 バイトも触っていなかった**（`git diff -- scripts/` が空）。**実測値**＝`check-md-emphasis.sh` **375 / 375**（違反そのものを直して復帰・上記 14）／`check-instruction-format.sh` **74 / 74**／`check-enum-sync.sh` **24 / 24**。**⇒ 設計卓の一括更新で本レーンからの持ち込みは無い。**
### 改善レーン: ドキュメント汚染の予防機構と M18/M19 期 作業ファイルの棚卸（2026-08-13・継続改善レーン）

- **結果**: 開発者要求「既存運用から外れるファイルの新作成は制御。少なくとも私の承認は通して欲しい」に対し、**検出（`scripts/check-doc-inventory.sh` 新設）＋ ルール（3 面）＋ 起動条件（CLAUDE.md §8 表・`/next_milestone_kit` Step 5-8）**を配線した。あわせて `docs/handover/` 直下に残っていた M18/M19 期の作業ファイル **6 本・108 KB** を `docs/handover/phase3/` へ移設した（**削除ではない**。移設先には `m13`〜`m18` の同種が既に揃っている）。常設検査は **8 本すべて緑**（`check-artifact-integrity.sh` を 1 本目に実行。新設スクリプトは同検査の対象に自動で入り、検査 10 件になった）。
- **横断課題**:
    1. **★orphan（参照ゼロ）検出は試作して棄却した。** 滞留していた 6 本は **1〜9 か所から参照**されていたが、**参照元が「これは消す予定」という行**だった。逆に `m14-*-review.md` のような正当な記録が参照ゼロで誤検出された。**参照されている ≠ 生きている。** 判定材料は **(a) 本文が自ら宣言した寿命 (b) 実質の参照元**で、**`docs-map.md` は数に入れない**（自動生成で `docs/handover/` 直下を全件列挙するため、死んだファイルも必ず 1 件参照されて見える）。
    2. **★検査は初回実行で実害を 1 件検出した**——`M19-RESEARCH-03-is-derived-semantics.md` が `docs/instructions/` と `docs/progress/` に**同一内容（9,301 B・`diff` 差分なし）で重複**していた。削除は開発者手番（**D-196** 境界条件 3）のため例外表へ理由付きで載せ、followup `doc-inventory-gate-residuals` へ登録した。
    3. **★実装上の罠**: `git ls-files` は非 ASCII 名を `"docs/handover/M19-\345\274\225..."` とエスケープして返す。試作時に**日本語名 4 本が全部「型なし」へ誤判定**された。本スクリプトは `find` で作業ツリーを直接見る（新規作成された直後の未 add ファイルこそ検出対象、という理由も兼ねる）。
    4. **★問題は規則の不足ではなく実行者の不在だった。** `m19-desk-status.md` は §0 で寿命を宣言し、ボード **P-24** が 2026-08-12 に「削除の前提は満たされた」と記録してなお存在していた。**宣言も検査も追跡もあったが、「消す」が開発者手番のまま忘れられた。** ⇒ 検査を **exit 0 の情報提供型**にしたのはこのため（赤にすると「緑にするために消す」圧力が D-196 を破る方向に働く）。
    5. **本検査は事後検出でありゲートではない。** 真のゲートは PreToolUse フックだが、`.claude/hooks/` への書き込みはハーネスの分類器に拒否される実績があり（`20260811-improvement-lane-handover.md` §264）、フック追加は開発者の明示的許可が前提のため着手していない。
    6. **共有直列リソースに触れている**——`docs/process/parallel-board.md`（§4 P-25 への追記・§2.4 の playbook 版行）と `docs/handover/followup-backlog.md`。**M20／M21 設計卓が稼働中**であり、コンフリクトは開発者が解消する前提（2026-08-13 開発者指示）。
- **残**: followup `doc-inventory-gate-residuals` §J（重複ファイルの削除／`m19-desk-status` の廃止＝M20 手番／`cleanup-assistant-prompt.md` の置き場／移設 6 本のファイル名の揺れ）

### M21-02: 同時押し判定（`FR107`）とチャタリングの決着（`FR108`）（2026-08-13）

- **結果**: `pnpm test` **1094/130 全緑**（着手前 1052/127）／`go test ./...` **46 ok・FAIL 0**／`make e2e` **73 passed**／**消費マイグレ番号なし・消費 CHANGE 番号なし**（`CHANGE-107` は設計卓が起票・registry 登録済）。**判定法は (α) 単一の広い窓**（(β) 実行時の自己校正は PoC B-3 の実測により前提が成立せず）／**判定窓 `SIMULTANEOUS_PRESS_WINDOW_MS = 90 ms`**（`D-324` の実測最大 押し始め 45.80・離し始め 83.30 の大きいほうを下回らせない）／**チャタリング対策は実装しない**（2 機種・USB・Chrome で観測されず＝`E-41` 型）／**SOCD は左右相殺・上下は上優先**。レビュー指摘 **13 件すべて採用**（重大 0 件・往復 1 回）。
- **報告**: 完了報告 `docs/progress/M21-02-completion-report.md` ／ レビュー `docs/progress/m21-02-review.md`
- **★横断課題**:
    1. **★指示書 `M21-03` は未発行である**（ボード **D-342**）。`/implement_plan_full M21-03` は指示書不在で着手できず、開発者の選択で **M21-02**（発行済・投入可）へ切り替えた。**M21-03 は overview §3 の依存列で「M21-02 後」であり、本サブの完了で前提は揃った。**
    2. **★`CHANGE-107` の三点セットは完了報告 §2 の 6 点で書ける**（判定法と理由／窓の実値と単位／窓の起点／押し始めか離し始めか／チャタリングの決着と根拠／SOCD の規則）。**`DES-005` §6.4 の「例：16ms」は実測と合わない**ため是正が要る（押し始めの p95 が既に 20.90 / 33.30 ms）。
    3. **★M21-01 の資産を 3 ファイル触った**（§2.3 で事前記録）——`useGamepadPolling.ts`（`onSample` の追加のみ。**単調増加の時刻は rAF のコールバック引数にしか存在せず、かつ 2 本目のループを作らないためループの内側から渡すほか無い**）／`logicalButtons.ts`（SOCD コメントのみ。**M21-01 の「推測」記述が本サブの決定採用で残骸になるため**）／`GamepadStatusControl.tsx`（配線）。**正規化とプロファイル解決は不変**で、既存 7 スイート非回帰。
    4. **★指示書が定義していなかった論点で実装を変えた**——**「その時点の方向」の「その時点」**。初版は窓の起点で 1 度だけ引いていたが、**押し始めのズレ（実測 中央値 8.30 ms / 最大 45.80 ms）は方向にも等しく効く**ためレバーレスの `6 + 強P` が `5 強P` として確定しうる。**「窓の内側で観測された最後の非ニュートラル方向」へ変更**（方向は集合に加えていないため §4.1-2 に抵触しない）。**M21-03 / M21-06 はこの前提で設計すること。**
    5. **★E2E は「書かなかった」ではなく「書けなかった」**（`E-84`）。Gamepad API は実機接続がないと列挙されず、かつ全経路に user gesture が要る（**D-324** 軸 A-2）ため、**Playwright から物理入力を模擬する経路が無い**。既存 E2E の非回帰のみ確認した。
    6. **`scripts/check-browser-storage-keys.sh` が着手前から stderr にシェル構文エラーを出している**（`line 115: syntax error near unexpected token '('`）。**判定は完走して有効**だが常時ノイズが出る。**D-335 により並走中は `scripts/*.sh` を触らないため本サブでは直していない。** 両レーンのマージ後に見ること。
    7. **`scripts/check-md-emphasis.sh` は `markdown-it-py` 未導入でクラウド実行環境から実行できない**（M20-02 横断課題 14 と同型・レビュー担当も同じ状態を観測）。**環境要因であり本サブの変更に起因しない**が、`check-artifact-integrity.sh` を 1 本目に回す運用に影響する。
    8. **開発者手番（§7.6）は実施済み**（2026-08-13・開発者。**「動作に関してはほぼ問題ありません」**）。2 機種での同時押し／意図的にずらした 2 ステップ化／**上記 4 で変更した「方向つきの同時押し」（`6 + 強P` → `6 強P`）**のいずれも想定どおりだった。
    9. **★【M21-03 への入力】素早く入力したとき、意図せず同時押しになる瞬間がある**（2026-08-13・開発者の実機確認）。**指示書 §4.3 が予測していた「窓が広すぎる副作用」そのものであり、画面に出ているため silent ではない**（`CHANGE-107` §2-c の実機での裏付け）。**★窓は現状維持**（`90 ms` を狭めない）——**狭める側の誤りは「入力が黙って落ちる」方向で、本サブで唯一 silent な失敗である。** 開発者判断は「コンボの入力アプリという意味で、ゲームより緩い感度にするのは悪くない」。**⇒ 本体側への申し送り＝利用者への注意喚起を UI のどこかに置きたい**（「素早く入れると 1 ステップにまとまることがある」「ゆっくり正確に」＋**不具合ではなく意図的な設定である**旨）。**置き場は `M21-03` が適任**（`FR106` 読取表示と `DES-005` §6.6-2・§6.6-5 を持つ。**本サブの最小可視化は撤去前提のため告知の置き場にできない**）。**`CHANGE-107` §2-c には「画面に出る ≠ 利用者が気づく」の 1 文を足す余地がある。** 詳細は完了報告 §8.1-5。
### M20-03: `preset_aliases` の一意制約（`character_id` の非正規化 ＋ UNIQUE 2 本）（2026-08-13）

- **結果**: `go test ./...` 全緑 ／ `pnpm test` 127 ファイル・1,052 テスト pass ／ `go run ./cmd/seedgen -check` 緑。**消費マイグレ連番 `000074` / `000075` の 2 本**（列追加 ＋ backfill ／ UNIQUE 索引 2 本）。**⇒ 次に払い出す番号は `000076`。** **`UNIQUE(preset_id, character_id, alias_text)` と `UNIQUE(preset_id, character_id, alias_text_en) WHERE alias_text_en IS NOT NULL` を `CREATE UNIQUE INDEX` で張った**（`ALTER TABLE ADD CONSTRAINT` が無いため。テーブル定義側の `UNIQUE(preset_id, move_id)` は無改変で残る）。**`character_id` は nullable・FK なし**（`NOT NULL` はテーブル再構築を要するため。§4.1-3 / §4.1-4 の判断）。**backfill 4,158 行・NULL 0 件・`moves.character_id` と全行一致。** **着手前実査で制約違反は 3 種とも 0 件**（`(character_id, alias_text)` の重複 714 件は無害であり、指示書 §1.1 #2 と一致）。**破壊テスト (i)(j)(k) で制約が実際に噛むことを確認**（狙った索引の構成列がエラー文に出る）。
- **報告**: 完了報告 [`M20-03-completion-report.md`](M20-03-completion-report.md) ／ レビュー [`m20-03-review.md`](m20-03-review.md)
- **★横断課題**:
    1. **★`character_id` は nullable であるため、M20-04 以降が `preset_aliases` へ INSERT する経路を作るときは必ず値を入れること。** 入れなくても INSERT は通り、**`UNIQUE(preset_id, character_id, alias_text)` に当たらない行が静かにできる。落ちないため気づけない。** 本サブの時点で `preset_aliases` へ書く**本番経路は 1 つも存在しない**（`internal/repository/preset` は読み取り 6 メソッドのみ）ため、M20-04（カスタムプリセットのコピー時のエイリアス実体化）が**最初の該当箇所**になる。⇒ 「投入は生成器を通す」規約（`DES-004` §5・設計卓の手番）が実際に試されるのはそこから。
    2. **★指示書 §4.5 が名指しした生成器は 1 本だが、実在するのは 2 本だった。** `internal/seedgen/generate_m2002.go`（表記プリセット）に加え **`internal/seedgen/generate.go` の `writeAliasInsert`（`official_ja_move`）**があり、`character_data/seed-progress.md` の手順は新キャラ波で**両方を回す**。片方だけ直すと次の波で NULL 行が入る。**両方に `character_id` を出させた。**
    3. **★適用済みマイグレ 6 本は `character_id` を含まない旧形式である**（`000026` / `000030` / `000045` / `000055` / `000072` / `000073`）。**閉じた集合であり今後増えない。** 生成器側は `internal/seedgen/format.go` の `FormatPreM2003`、CLI 側は `cmd/seedgen/main.go` の `preM2003Stems` が**出力先 stem から自動判別**する。⇒ **既存の再生成コマンドと `-check` はそのまま使え、新しい波は指定なしで新形式になる。** フラグ方式を採らなかったのは、付け忘れた実行が適用済みファイルを壊すため。
    4. **★レビューで「`go run ./cmd/seedgen -check`（変換規則の無改変ゲート）が恒常的に赤」を検出し、取り込んだ。** 生成器だけ直して CLI 側を放置したのが原因で、**しかも `-check` のエラーメッセージが「再生成しろ」＝適用済みマイグレの上書き（§2.2 違反）へ誘導していた。** 同型の誤誘導が `generate_test.go` / `generate_m1702_test.go` の golden 失敗メッセージにもあり、3 箇所とも是正した。**⇒ 生成器の出力形式を変えるときは、CLI・golden・doc コメント・失敗メッセージが 1 組であることを忘れないこと。**
    5. **`check-artifact-integrity.sh` が違反 1 件を報告する**——`check-md-emphasis.sh --self-test` が `markdown-it-py` 未導入で不合格（M20-02 横断課題 12・14 の再演）。**本サブは `scripts/` を 1 バイトも触っていない**（`git diff -- scripts/` が空）ため環境要因である。M20-02 で `.devcontainer/Dockerfile` へ `python3-markdown-it` を追加済みだが、**クラウド実行環境のコンテナには入っていない。** `CLAUDE.md` §6 により製造が依存を足さない。
    6. **索引名の接頭辞 `ux_` はリポジトリ初出である**（既存の非 UNIQUE 索引はすべて `idx_`。`migrations/` に既存の `CREATE UNIQUE INDEX` は 1 本も無かった）。**どこにも規約として書かれていないため次の担当が揺れる。** `CHANGE-100` の三点セットか `SUPP-001` §5.5 に 1 行残すことを提案する（**設計卓の手番**のため製造は書いていない）。

### 改善レーン: `config.toml` 書き戻し env 非対称の根治（2026-08-14）

- **結果**: `config-toml-write-back-env-asymmetry` を完了。`internal/service/config/` の範囲で `PUT /api/config` の永続化から有効な env override 項目を除外し、env 無しの従来書き戻しと初回ファイル不在を回帰テストで固定した。設計書・マイグレーション・`parallel-board.md` は変更なし。
- **検証**: `go test ./...` 全緑 ／ `make e2e` **73 passed** ／ E2E 前後の `config.toml` は SHA-256・314 bytes・`cmp` の三点で同一。
- **追跡**: 2026-08-08 の「E2E 実行が `config.toml` に E2E 設定を焼き付ける」節へ決着を追記し、[`followup-backlog.md`](../handover/followup-backlog.md) の同スラッグを `完了` として着地。
### M20-04: プリセット管理 UI ＋ カスタムプリセット作成（2026-08-13）

- **結果**: `go test ./...` **47 パッケージ ok・FAIL 0** ／ `pnpm test` **134 ファイル・1,115 件 全緑** ／ `pnpm lint` exit 0 ／ E2E 新規 7 本を小バッチで **7/7 green**。**消費マイグレ番号なし**（disk 末尾は `000075` のまま。**⇒ 次に払い出す番号は `000076` で不変**）／**消費 CHANGE 番号なし**（`CHANGE-101` は設計卓が起票・承認済み）。**`internal/service/preset/` を新設し、`preset_aliases` へ書く本番コードが初めて存在するようになった**（`DES-004` §5.7 の投入経路の規約が初適用）。**保護（組み込みは削除もエイリアス編集も 403＝D-290）・上限（全体 8 件＝VAL-P05）・コピー時の `character_id` 実体化・CASCADE に頼らない削除**の 4 点をすべてサービス層に置き、テストで固定した。**API は書き込み 3 本 ＋ `GET /api/presets/:id/aliases` の計 4 本**。レビュー指摘は**高 3・中 5・低 5 のすべてを採用**（**「高」の不採用 0 件＝安全弁の発動なし**・往復 1 回）。
- **報告**: 完了報告 [`M20-04-completion-report.md`](M20-04-completion-report.md) ／ レビュー [`m20-04-review.md`](m20-04-review.md)
- **★横断課題**:
    1. **★`M20-05` は「層を作る」サブではなく「既にある 2 メソッドを配線する」サブである。** `notation.RecomputePresetCache`（`cache.go:94`）と `notation.DeletePresetCache`（同 `:151`）は**既に実装済みで、本番の呼出元が 0 件**だった（テスト以外から呼ばれていない）。本サブがトリガを引く面（プリセット編集 UI）を作ったため、**`architecture-patterns` §9.2 の「未実装なのはトリガを引く機能自体がフェーズ3 だから」という状態はここで解けた**。`DeletePresetCache` は `*sql.Tx` を取る形なので、本サブの削除トランザクションへそのまま挿せる。**`M20-overview` §3 の M20-05 の行の是正（ボード M-53）は正しかった。**
    2. **★`recipe_cache` の as-built**（`M20-05` の入口）——**作成直後はエントリ無しだが表示は壊れない**（`ResolveComboRecipe` がキャッシュミス時に遅延計算して書き戻す＝§3.3-5 の停止条件 1 は不発動。E2E で固定した）。**編集後は当該 `preset_id` のエントリが stale のまま残り、表示は更新されない。** 削除後は JSON 内に孤児キーが残る。**コンボ一覧は `DefaultPresetID = "1"` 固定で読むため影響を受けない。**
    3. **★`P-04` の記述は片側だけだった。** `SUPP-001` §7.3 と指示書は「`PRAGMA foreign_keys` はプール全体に効かない」とするが、**実測では `PRAGMA foreign_keys = 1` を返す接続を引く場合があり、その接続では `ON DELETE CASCADE` も `presets.user_id → users(id)` の FK も実際に発火する**。⇒ **「削除後に孤児 0 件」の観測だけでは CASCADE 非依存を主張できない**（FK=ON 接続を引けば CASCADE 依存の実装でも緑になる）。**削除の呼び出し順を spy で固定する 2 本目のテストを足した。** 指示書 §5 (g) が求めた検査は、そのままでは主張が成立しない種類のものだった。**次に同型の検査を書く担当は、観測ではなく実装の形を固定すること。**
    4. **★`DES-004` §5.7-2「直接 INSERT する経路を増やさない」から逸脱した。** 編集経路（`updateAliasTextSQL`）は利用者が任意の文字列を入れられるため、**D-317 の交差条件（ある技の `alias_text` が同一キャラの別の技の `alias_text_en` と一致する）が DB でもサービス層でも検出されない状態になっていた**（レビュー指摘 D）。⇒ **サービス層に交差検査を足して塞いだ**（`FindCrossingAliasEn`）。**seed 経路は `migrate_m2003_test.go` (g) が守っていたが、利用者編集の経路には誰も検査を置いていなかった。** 設計卓は §5.7 の規約が「生成器を通す経路」だけを想定していたことを認識されたい。
    5. **★`DES-005` §5.10 の「作成日」を表示していない。** `presets` に `created_at` が存在せず（`DES-003` §3.8 にも定義なし）、列追加にはマイグレが要るが**自採番しない**（**D-293**）ため。**`CHANGE-101` の三点セットで「作成日を落とす」か「列追加を伴う将来対応」かを決めてほしい。**
    6. **★`GET /api/presets/:id/aliases` を新設した**（指示書 §4.2 の 3 本にも `CHANGE-101` §2.2 にも無い）。**編集画面（`DES-005` §5.11）を実装する手段が他に無かった**（`GET /api/presets/:id` はメタ情報しか返さない）。**`DES-002` §4 への反映が要る。** 契約は完了報告 §7.2。
    7. **`SUPP-001` §7.3 が名指しした 3 点のうち、`config.preset_id` の実在確認は半分しか実装していない**——削除側の拒否（409）は入れたが、**config 側が実在しない `preset_id` を指せる状態は残っている**（`config` サービスに DB 依存を持たせる変更になり §2.3・§9.4 停止条件 3 に当たるため独断で進めなかった）。`followup-backlog` §J **`preset-config-preset-id-existence`** へ登録。**`M20-05` が §7.1・§7.2 の as-built 是正を持つため同サブで扱うのが自然。**
    8. **`docs/handover/code-facts.md` が失効している**——§305 / §339-340 / §406 が `/presets` を「router.tsx に未定義」「Header は disabled」「API は読み取り 2 本」と記述したままである。**次の設計卓が引く一次情報**であるため再生成が要る（`/regen_code_facts`。**製造が武装中に再生成すると差分が読めないため本サブでは実施していない**）。
    9. **クラウド実行環境に `markdown-it-py` が入っていない**（M20-02 横断課題 14・M20-03 横断課題 5・M21-02 横断課題 7 の再演）。**`check-artifact-integrity.sh` が 1 本目で赤になる。** 本サブでは `pip install markdown-it-py` で解消して全検査を緑にしたが、**コンテナが作り直されると消える**。`.devcontainer/Dockerfile` には M20-02 で追加済みなので、**クラウド側のイメージへ反映する手番が残っている。**
    10. **`scripts/check-md-emphasis.sh` の `BASELINE_BROKEN` が 375 に対し実測 373**（2 行減少）。**`scripts/` は D-335 により製造が触らないため据え置いた。** 両レーンのマージ後に設計卓が一括更新する対象。
    18. **★開発者の実機 1 周が完了した**（2026-08-13）。開発者の言葉は「**想定通り動いていました**」で、**1 周ができたという意味である**（本人確認済み）。**あわせて開発者機の `make e2e` も成功**（上記 16 で是正した spec の修正が開発者機でも有効であることの確認になった）。**⇒ 指示書 §7.2 の完了条件に未達項目は無い。** **★ただし実機で目視されたのは完了報告 §9.1 の手順 2〜7 であり、`上限到達時の見え方`（8 件でコピーが disabled ＋ 告知）と `一意制約違反の見え方`（表記衝突の 409）は手順に含まれていない**——この 2 つは **E2E でのみ固定されており人の目では見ていない**。`CHANGE-101` §2.1-b・§2.1-d を `DES-005` へ書き起こす担当は、この切り分けを前提にすること（設計伝達レポート §3-1）。**★`recipe_cache` の stale を「利用者向けに許容してよいか」という評価は得ていない**（1 周ができたという報告のみ）。M20-05 着手前に必要なら別途確認する。**⇒ 残るのは設計卓・開発者の判断待ちの 5 件のみで、製造側の実装作業は無い。**
    15. **★★「クラウド実行環境では `make e2e` が完走しない」と報告したのは誤りだった**（2026-08-13 訂正）。**真因は前段の smoke test で起動したバックエンドが E2E ポート 47390 を掴んだまま残っていたこと**で、E2E スタックが自分のサーバを起動できず全滅していた（直後の単体実行が `http://localhost:47390 is already used` を明示的に返していた）。**残プロセスを落とすと同じ環境で 1.8 分・exit 0・79 passed / 1 flaky で完走する。** **★`remote-ops.md` §5.1 が名指しで警告している「サブの失敗を環境要因として流さない」の型そのものを踏んだ**——既知事象 `cloud-e2e-browser-mismatch` の分布に似ていたため当てはめてしまった。**⇒ 切り分け手順 1（失敗が広範囲なら環境要因を疑う）は必要条件でしかない。「E2E スタック自身が起動できているか」を先に見ること**（`Error: http://localhost:<port> is already used` は Playwright が明示的に出す）。**開発ツールを手で起動したセッションでは、E2E の前にポートを空けたか確認する。**
    16. **★開発者機でだけ落ちる spec を書いていた**（2026-08-13・開発者報告 → 修正済み）。`m20-04-preset-management.spec.ts` が `GET /api/presets/{id}/aliases?character_id=1`（ryu 直書き）で引いたエイリアスの入力欄を編集画面に探していたが、**`PresetEditPage` の初期キャラは `config` の `[defaults] character_id`** である。**`config.toml` は `.gitignore` 管理外で開発者ごとに値が違う**ため、既定キャラが ryu でない環境では画面が別キャラを描画し、`alias-input-<ryu の moveId>` が永遠に現れない。**`character_id = 5` に変えて同一の失敗を再現し、修正後は再現構成・元構成の双方で 7/7 green を確認した。** **製品側は正しい**（編集画面が config の既定キャラで開くのは設計どおり）ため変更していない。**⇒ 教訓: 画面の初期状態が `config.toml` に依存する面を E2E で触るときは、初期状態を仮定せず利用者と同じ操作で明示的に選ぶ**（`moves-edit.spec.ts:69-70` が既に同型）。**`config.toml` が per-machine である以上、「自分の環境で通った」は「通る」の証明にならない。**
    17. **★E2E が開発者の `[defaults] preset_id` を書き換えたままにしていた**（上記 16 とあわせて修正）。本 spec の `beforeEach` は削除を通すため既定プリセットを 1 へ戻すが、**元の値へ復元していなかった**——**`make e2e` のたびに開発者の既定プリセットが 1 にリセットされる**。**既存 `m18-*` spec は `cfg.defaults?.characterId ?? 1` / `presetId ?? 1` の形で保存しており、本 spec だけが規約から外れていた。** `beforeAll` で退避し `afterAll` で復元する形に是正し、`preset_id = 3` / `character_id = 5` を設定して全 7 本を回し**実行後も両方が保持される**ことを確認した。**⇒ E2E が `PUT /api/config` を呼ぶときは、書き換えた設定を必ず戻す。**
    12. **★指示書 §7.2 の DoD 文言では画面を触れない**——「`go run ./cmd/combomgr` で起動し、実機で 1 周する」と書かれているが、**タグ無しの `go run` は API しか起動しない**（`embed_web_stub.go` が `WebEmbedded = false` を返し、静的配信ハンドラもブラウザ自動起動も登録されない）。**画面を伴うサブでは `make run-server` ＋ `make run-web` の 2 プロセスか、`make build` した配布バイナリが要る。** ⇒ 実行できる手順を完了報告 §9.1 に書いた。**次に画面を伴うサブの指示書を書くとき、DoD 文言を是正されたい**（テンプレート側の問題であり本サブ固有ではない）。**あわせて `db path resolved` のログは標準出力ではなく `logs/combomgr.log`（JSON）に出る**——コンソールには起動バナーしか出ないため、DB の取り違えを目視で確認するにはログファイルを見る必要がある（2026-08-13 実測）。
    13. **★`config.toml` 焼き付きの再演**——`make e2e` の後は `config.toml` の `[database].path` が `web/e2e/.tmp/combomgr-e2e.db`、`[server].port` が `47390` になる（**本クラウド環境で実測**）。**既知事象であり機序も対処案も 4085 行目に記録済み**だが、**2026-08-08 に dev DB へのマイグレ確認を 3 回空振りさせた前科がそのまま残っている。** 本サブの spec も `PUT /api/config` を呼ぶため**既存 8 本に続く 9 本目**になった（新しい種類の問題ではないが、踏む機会を 1 つ増やした）。**★根治は対処案 (a)**——`PUT /api/config` の書き戻しから env 上書き中の項目を除外する。**`main.go` の L-04 フォールバック永続化は既に同じ保護を持っており（`COMBOMGR_PORT` 上書き中はポートを永続化しない）、`PUT /api/config` だけが非対称なのが原因である。** config ドメインへの変更のため本サブでは触っていない（§2.3・§9.4 停止条件 3）。**⇒ 実機確認の手順 0 として「`config.toml` を戻してから始める」を完了報告 §9.1 に置いた。**
    14. **★配布バイナリ経路は E2E が一度も通っていなかった**——E2E は Vite dev server 上で回るため、**`internal/api/static` の SPA フォールバックを通らない。** 本サブは新規ルートを 2 本足したので、`make build` した埋め込みバイナリで実測した（`/presets` と `/presets/1/edit` が直 URL で `200 text/html`／`/api/presets` が `200 application/json`／`/api/no-such-route` が `404`＝**API を SPA に飲ませていない**／書き込み・保護も成立）。**⇒ ルートを足すサブは、E2E が緑でも配布形態での直 URL 経路が未検証であることに注意。**
    11. **`Header.tsx` の `disabled` 分岐を削除した。** 「プリセット管理」が `NAV_LINKS` で最後の `disabled` リンクであり、有効化した結果 `span + cursor-not-allowed + tooltip` の分岐（PC nav / モバイル Sheet の 2 箇所）が**到達不能**になったため。**`NAV_LINKS` はモジュールスコープの const で注入できず、到達不能な分岐はテストで動かす手段が無い。** 再び未実装リンクが要るときは Git 履歴から戻せる。**指示書 §2.1 の表に無い変更であるため（D-348 により禁止列ではないと判断）、開発者の確認対象として上げる。**
### M21-03: レシピ入力への接続 ＋ 読取表示（`FR105` / `FR106`）（2026-08-13）

- **結果**: `pnpm test` **1135/131 全緑**（着手前 1094/130。**うち +5 はレビュー取り込みぶん**）／`go test ./...` 全 ok・FAIL 0／`make e2e` **exit 0**（実装完了時 73 passed ／ レビュー取り込み後 72 passed ＋ 1 flaky。**flaky は `POST /api/combos` が 500 を返した前準備の一過性で、本サブは `internal/` の diff 0 のため無関係**。retry で通過）／**消費マイグレ番号なし・消費 CHANGE 番号なし**（`CHANGE-111` は設計卓が起票・registry 登録済）。**物理入力の合流点は `web/src/features/gamepad/recipeInputResolution.ts` の 1 か所**（解決規則は 0 件。既存の `resolveDirectionalInput` / `resolveDirectionalRushInput` / `resolveSystemButtonStep` を呼ぶだけ）／**接続層は `VirtualController` の内側に置き 2 面が共有**（**セットプレイ入力面の変更は 0 行**）／**告知 3 点は `GAMEPAD_INPUT_NOTICE_POINTS` の 1 定数が正本**／**点灯の状態源は論理ボタン層**／**M21-02 の最小可視化 `GamepadStepPreview` は撤去**。**投げの向きは §9.2-7 の余地を使い、後方入力で `throw_back` を採った。**
- **報告**: 完了報告 [`M21-03-completion-report.md`](M21-03-completion-report.md) ／ レビュー [`m21-03-review.md`](m21-03-review.md)（**差し戻し事由 0 件・往復 1 回。指摘 13 件中 12 件採用・1 件不採用〔低-3〕。「高」の不採用は 0 件のためエスカレーションなし**）
- **★横断課題**:
    1. **★指示書 v1.2.0 ／ チェックリスト v1.2.0 が本ブランチに無い。** 設計卓は `ed18f36` でコミットしたが **push が拒否**されており、**本ブランチの `docs/instructions/M21-03-*.md` は v1.1.0 のまま**である。製造は v1.2.0 を開発者からの添付で受領して実装した（添付はコミットしていない）。**⇒ 本ブランチの指示書を読むと撤回済みの旧 §4.2-2「2 ボタン同時は OD 技（`_od`）」が見える**（**D-352** で差し替え済み）。**旧版のまま判定すると正しい実装が「未実装」と判定される**（**D-323** の同型）。**設計卓の v1.2.0 が main へ入るまでこの食い違いは残る。**
    2. **★製造が実装中に指示書内の両立不能を検出し、開発者経由で設計担当の裁定を得た**（**D-352**）。**旧 §4.2-2「2 ボタン同時は OD 技（`_od`）」は §4.1-2（解決規則を新設しない）および契約 F-3 と両立しない**——**OD の `move_code` は `<family>_od` であり、family を決める写像は「入力から技を選ぶ」新設規則になる**（既存の解決経路は方向＋ボタンの `token_key` しか引かず OD のキーを持たない）。**裁定＝同強度の P＋K は既存のシステム技へ、OD は物理から出さない**（`M21-06` の領分）。**★止めて上げたことで、動くが契約を壊す実装を回避できた。**
    3. **★指示書が予見していなかった問題を 1 件検出し、独自に設計した**——**コンボ編集画面では入力面が同時に複数マウントされる**（レシピ節 1 個 ＋ 紐づくセットプレイ行 N 個。`CollapsibleFieldset` は既定展開）。**面ごとに接続を置くと (a) rAF ループが面の数だけ増え (b) 1 回の物理入力が全部の面へステップを足す。** ⇒ **単一 provider（`App.tsx` に 1 個）＋ 受け手の調停**を入れた。**受け手は「最後に触った面」・選択中は常時表示**（2026-08-13 開発者判断）。**★`M21-04`（コントローラ完結入力）・`M21-05`（キーボード）はこの調停の上に乗ること**——確定・削除をパッドへ割り当てるとき、どの面へ効くかは受け手が決める。
    4. **★`web/src/App.tsx` を触った**（§2.1 の一覧に無いが §2.2 の禁止列にも当たらない＝**D-348**）。**供給元を 1 個だけ持てる場所が他に無い**ため。**入力面が 0 の間はポーリングを回さない**ので M21-01 §4.1-2 は保たれている。
    5. **★`ls migrations/` の disk 末尾は `000075`。次に払い出す番号は `000076`。** M21-02 完了報告の「末尾 `000073` / 次は `000074`」は同報告時点の値であり、以降 M20 レーンが 74・75 を消費した（M20-03 と一致）。**ボード §2.2 は実査で確認すること。**
    6. **★【要対応・環境】クラウド実行環境で `make e2e` を回すには 2 手が要る。** (a) **`cp config.toml.example config.toml`**——`isInitialized` は `config.toml` の存在有無で決まり、不在だと `App.tsx` が全ページを `/wizard` へリダイレクトするため **73 件すべてが落ちる**（`config.toml` は `.gitignore` 済みでクローンに含まれない）。(b) **`PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium`**——`playwright install` は `cdn.playwright.dev` が 403（host not permitted）で失敗する（既存 followup `cloud-e2e-browser-mismatch`）。**★この 2 手を踏まないと「全件落ちる」から始まり、自分の変更が壊したように見える。** 恒久対策（Makefile / セットアップスクリプト / `remote-ops.md`）は **`scripts/` と `Makefile` を D-335 で触らない約束のため本サブでは実施していない。**
    7. **`scripts/check-md-emphasis.sh` の自己検査が `markdown-it-py` 未導入で不合格**（`check-artifact-integrity.sh` の違反 1 件）。**M21-02 横断課題 7 ／ M20-03 横断課題 5 の再演**であり、本サブは `scripts/` の diff 0 のため環境要因。
    8. **★E2E は「書かなかった」ではなく「書けなかった」**（`E-84`）。実機コントローラと user gesture を要するため Playwright から模擬できない（M21-02 で確認済み）。**告知の存在・点灯・2 面の一致はコンポーネントテストで固定した**（`useGamepadPolling` と `useGamepadProfiles` だけを差し替え、判定は実物を動かす）。
    9. **★開発者手番（実機確認）が残っている。** 受け手の切り替えの直感性 ／ 点灯の視認性 ／ 告知の置き場が邪魔でないか ／ 読取表示の情報量——**この 4 点は実機でしか判断できない**（完了報告 §8.1-5）。
### M21-04: コントローラ完結入力（前置きボタン方式・`DES-005` §6.5）（2026-08-14）

- **結果**: `pnpm test` **1197/137 全緑**（着手前 1157/135。**新設 2 ファイル・+40 件**。**うち +1 はレビュー取り込み／v1.2.0 の撤去で −5 / +1**）／`pnpm lint` exit 0／`go test ./...` 全 ok・FAIL 0（47 パッケージ）／`make e2e` **80 passed / 0 failed**／**消費マイグレ番号なし**（disk 末尾 `000075` を実査・ボード記載と一致）／**`internal/` ／ `migrations/` ／ `scripts/` ／ `docs/design/` の diff すべて 0**／**新規ブラウザストレージキーなし**（台帳 8 件 / 本番 7 件で着手前から不変）。**割当＝前置き `shortcut_prefix`（登録制）＋ 後続は既登録の攻撃ボタン（中P=修飾 / 強P=保存 / 強K=削除。★削除だけキック段の対角へ離した。★弱P は D-364 の撤去で意図的に空けたまま）**／**前置き中は判定へサンプルを渡さない形で後続ボタンを吸収**／**★「ステップの追加確定」は v1.2.0 で撤去（D-364）。`closePendingStep` は残し docblock を事実へ是正**／**登録対象 13 → 14（増分は前置き 1 件・必須ではない）**／**★`stepDetection.ts` は 1 行も変えていない**（M21-02 の判定不変）。
- **報告**: 完了報告 [`M21-04-completion-report.md`](M21-04-completion-report.md) ／ レビュー [`m21-04-review.md`](m21-04-review.md)（**差し戻し事由 0 件・往復 1 回。指摘 15 件中 13 件採用・2 件不採用〔低-2 / 低-3〕。「高」の不採用は 0 件のためエスカレーションなし**）
- **★横断課題**:
    1. **★「確定」操作は実運用ではほぼ空振りになる**（設計卓の判断事項）。判定窓が 90 ms である以上、入力してから前置き ＋ 弱P を押し終えるまでに窓は閉じている。**`DES-005` §6.5 が書かれた時点には自動確定が無かった**ためリストに載っている操作であり、**現在の as-built では既に自動で確定している**。要件（同じ結果を 2 経路で起こさない）は満たしているが、**操作としての実用性は低い**。**⇒ 実機確認の結果を見て `M21-05` 以降で「割り当てを外す」判断もありうる。**
    2. **★`DES-005` の件数記述が 2 か所動く**（`CHANGE-108` の反映材料）。**§6.2 の論理ボタン実個数 21 → 22**（M21-01 as-built の union メンバー数 25 → 26。**同節の「数え方の注記」も同じ手番で直すこと**）／**§6.3.2 の登録対象 13 → 14**。**★製造は設計書を編集していない**（`CLAUDE.md` §8）。
    3. **★`step_commit` / `step_delete` には物理バインディングを与えなかった。** M21-01 が「余りボタンへの機能割当は M21-04 の所管」として予約していた 2 件だが、**`D-358` で方式が「1 ボタン ＝ 1 操作」から前置き方式へ変わった**ため、割り当てる対象そのものが無くなった。**⇒ M21-01 の申し送りは消化済みだが「割り当てた」ではなく「不要になった」が正しい。**
    4. **★標準配置の既定プロファイルに前置きを入れなかった**（§9.2-6 の委任事項）。W3C 標準の index 9 は仕様上 Start だが、`defaultProfile.ts` は「推測で当てると誤った割当が黙って入る」としてマクロを既定に含めない方針であり、それに倣った。**未登録の機体で不意に前置き状態へ入るほうが害が大きい**と判断。**⇒ 異論があれば設計卓の判断で既定へ入れられる**（1 行）。
    5. **★破壊確認で「緑だが効いていないテスト」を 1 件検出した**（`SUPP-001` §5.5 (10) の実例）。(f2)「前置き中の後続ボタンをステップにしない」の初版 3 件は、**ガードを外しても緑のままだった**——抜けるときの同期（`seedNow`）が pending 窓を捨てるため二重に守られており、**当該ガード自体を主張できていなかった**。**⇒ 割当の無いボタンを前置き中に押すケースを追加して初めて赤くなった。** **「非破壊条件のテストは実際に破って確認する」が無ければ、守っているつもりのガードが無防備なまま残っていた。**
    6. **★テスト作成中に実欠陥を 1 件発見・是正した。** 「前置きから抜けたら**次の 1 サンプル**を種付け扱いにする」形だと、**タイムアウトで抜けた直後に押した最初のボタンが食われて入力が 1 つ落ちる**。⇒ 「抜けた**その場**で最後に観測済みのサンプルと同期する」形へ変更（`seedNow`）。**手で触ると「たまに 1 入力落ちる」形であり、再現条件に気づくのは難しい。**
    7. **★(b)「受け手が 1 面も無い」はテストとして書けなかった**（`E-84`）。入力面が 0 になると provider の `enabled` が false になりポーリングが止まるため、**公開 API から到達できない**。ガード自体は `dispatchAction` の `ownerId === null` で実装済みで、(a)「受け手でない面には効かない」が隣接を固定している。**E2E も実機コントローラと user gesture を要するため「書けなかった」**（M21-02 / M21-03 と同じ制約）。
    8. **`scripts/check-md-emphasis.sh` の自己検査が `markdown-it-py` 未導入で不合格**（`check-artifact-integrity.sh` の違反 1 件）。**M21-03 横断課題 7 / M21-02 / M20-03 の再演**であり、本サブは `scripts/` の diff 0 のため環境要因。**2 件以上になったら別の原因。**
    9. **★開発者の実機確認は 2026-08-14 に完了した（問題の報告なし）。** ⇒ **指示書 §9.4 の停止条件はどれも発火せず。** とくに **§3.3-6「前置きに使うボタンがブラウザから観測できるか」が解消した**——**観測できなければ前置きの登録が完了せずショートカットが 1 つも動かない**ため、問題が無かったこと自体が観測できた証拠である。**項目 7′（押しっぱなしの感触）・項目 8（削除を強K に置いた判断）にも変更要望なし** ⇒ **委任事項の as-built をそのまま `CHANGE-108` へ反映してよい。** ★**機種ごとの詳細（どの物理ボタンを充てたか）は受領していない**が、`DES-005` §6.3 が「対応機種一覧を作らない」と定めているため設計書へ書く必要は無い（完了報告 §7）。
    13. **★【v1.2.0・D-364】「ステップの追加確定」を撤去した。** **私が「実運用ではほぼ空振り」として設計卓へ判断を仰いだ項目に、実機確認が答えを出した**——**10 回とも空振り・押しっぱなしでも変わらず・開発者所見「何をやる機能かもわかりにくい」**。**★撤去の理由は並び替え（followup 送り）とは違う**——**機能が要らないのではなく、判定窓が閉じた時点の自動確定に既に置き換わっている**。⇒ **`DES-005` §6.5 へは「落とした」ではなく「自動確定に置き換わった」と書くこと。** **★教訓＝「同じ結果を 2 経路で起こさない」という要件は満たしていたが、満たされていなかったのは「その操作に意味があるか」であり、設計卓も製造もそれを問うていなかった**（**M-59**）。**机上で満たせる要件と、実機でしか判定できない要件がある。**
    14. **★指示書 v1.2.0 / チェックリスト v1.2.0 が本ブランチに入っていない**（**M21-03 横断課題 1 の再演。本サブで 2 度目**）。開発者から手渡しで受領して実装したが、**開発者の指示によりコミットしていない**（`docs/instructions/` の diff 0）。⇒ **本ブランチの指示書は v1.1.0 のまま**であり、**旧版で判定すると撤去済みの「確定」が「未実装」と判定される**（`D-323` の同型）。**設計卓の v1.2.0 が main へ入るまで食い違いが残る。**
    11. **★レビューが「緑だが効いていない走査」を検出した**（`SUPP-001` §5.5 (11) の実例）。**§4.6 否定形確認④ の初回走査は母数を識別子だけに取ったため、撤回済みの前提を『文章で』述べている記述 4 件を見逃していた**（`types.ts` ／ `useGamepadPolling.ts` ／ `stepDetection.ts` ／ `profile.test.ts`）。**⇒ 2 軸（識別子 ／ 前提を述べている散文）で再実施し、走査コマンドを完了報告 §6.1 に残した。** **★教訓: 否定形確認は識別子だけを走査すると「撤回された前提を述べた散文」が母数から丸ごと落ちる。** あわせて **走査⑤（個数を主張している箇所）を新設**——`controllerTypes.ts` の「union の実体は 25」が失効しており、**`CHANGE-108` の §6.2 反映材料そのものが古いまま残っていた**。
    12. **★ブラウザストレージ台帳の扱いは設計卓の判断事項**（レビュー 低-7）。**新規キーは無く機械検査も緑**だが、**「登録対象が 13 → 14 になった」事実は台帳の用途欄に現れない**（`web/CLAUDE.md` §1 は保存する情報の内容を書く運用であるため）。**製造の判断は「同一キー内の非破壊的追加であり追記対象外」**だが、**addendum を出すかは設計卓で決めていただきたい。**
    10. **`M21-05`（キーボード・直列）への入力材料**——**割当の登録の形**＝既存キャリブレーション導線の任意区間へ 1 件足す。**受け手の調停への乗り方**＝`setActionHandler` を `setStepHandler` と同じ形で使う。**★別の登録の仕組み・別の調停を作らせないこと。** `shortcut.ts` の `SHORTCUT_ASSIGNMENTS` は入力方式に依存しないため、キーボードからも同じ表を引ける見込み。

### M21-05 追補: 実機確認で見つかったスクロール抑止の不具合 ＋ Space の登録解禁（2026-08-14）

- **結果**: `pnpm lint` exit 0 ／ `pnpm test` **1320/146 全緑**（追補前 1306）／`go test ./...` FAIL 0 ／`make e2e` **91 passed / 0 failed**（追補で 3 件増）／**消費マイグレ 0 本**。**契約（`internal/` `migrations/` `scripts/` `docs/design/` `docs/change-notes/`）は引き続き diff 0。** **★`CHANGE` 通知書は不要**——`CHANGE-110` §1.3 が「除外するキーの具体的な集合」を CHANGE 対象外と定め、指示書 §9.2-2 が製造へ委ねているため
- **報告**: 完了報告 [`M21-05-completion-report.md`](M21-05-completion-report.md) §8.1（実機確認で見つかった不具合）・§3.1（Space の解禁）
- **★横断課題**:
    1. **★`preventDefault()` の位置が early-return より後ろにあり、押し始めの 1 回しか既定動作を抑止していなかった。** ⇒ **矢印キーを方向に割り当てると、押しっぱなしのリピートが素通りしてブラウザがスクロールした。** 方向入力は押しっぱなしが普通の使い方であるため実質ほぼ毎回起きる。**是正は「自分のキーか判定 → 即 preventDefault → その後にリピート／重複判定」への並べ替え。** キー名を列挙しないため、矢印・Space・PageUp/Down・Home/End がまとめて塞がる
    2. **★★テストが緑のまま通した理由が 4 つ重なっていた（教訓）。** **(a) `defaultPrevented` を一度も見ていなかった**——「押下集合が正しく増減するか」しか見ておらず、「既定動作を止めているか」は誰も見ていなかった。**(b) テスト用イベントに `cancelable: true` が無いと `preventDefault()` を呼んでも `defaultPrevented` は false のまま**——付け忘れるとテストが常に緑になる。**(c) ★E2E の「押しっぱなし」が押しっぱなしになっていなかった**——`page.keyboard.down()` を 1 回呼んで待っても **Playwright は自動でリピートを送らない**ため keydown は 1 回しか飛ばず、**初版の E2E は不具合を復元しても緑のままだった**（`down()` を繰り返し呼ぶと 2 回目以降に `repeat: true` が立つ）。**(d) 起点が `scrollY === 0` では ↑ の検証が空振りする**（先頭では上へ動けない）。**⇒ 「破壊確認で赤くなること」を E2E でも必ず確かめること。単体だけで確かめると (c) を見逃す**
    3. **★対照実験を置いた。** 「割り当てていなければ矢印キーは従来どおりスクロールする」を**同じキー・同じ画面**で確かめる E2E を追加。**これが無いと「実は全キーの既定動作を殺しているだけ」でも抑止テストは緑になる**——抑止が**利用者の割当に紐づいている**ことまで主張する必要がある
    4. **★登録ダイアログにも同型の不具合があった（開発者の報告には無く、調査中に自力で発見）。** リピートガードが無く、押しっぱなしで**身に覚えのない二重割当の確認が出る**。**★当初の見立て「次々と別の対象へ割り当たる」は実測で外れた**——2 件目で衝突検出が次の記録を止めるため暴走はそこで止まり、**利用者が見るのは「勝手に出る確認ダイアログ」だった**。**この差はテストの強さに直結した**——「暴走しないこと」だけを主張したテストはガードを外しても緑で、**「衝突が出ないこと」まで主張して初めて固定できた**
    5. **`Space` の登録を解禁した**（開発者要求）。**代償＝Space を登録した利用者は、入力面が出ている間 Space でフォーカス中のボタンを実行できなくなる**（テキスト欄では従来どおり空白が入る／**未登録なら既存挙動は不変**）
    6. **★開発者の実機確認が完了した**（2026-08-14・是正後）。**方向キーの押しっぱなしでページが動かない ／ Space を登録して同様に動かず入力できる ／ メモ欄では従来どおり空白と矢印が使える ／ 登録ダイアログの押しっぱなしで確認が出ない**——**すべて通った**。既報の 4 項目（未登録の状態表示・除外キーの理由つき拒否・キーボードのみでの入力と保存・メモ欄での非発火）とあわせ、**指示書 §7.5-8 はこれで閉じた**
    7. **★開発者裁定 2 件**（2026-08-14）。**(a) Space の代償を許容する**——「入力面が出ている間 Space でボタンを実行できなくなる」ことを製造から明示的に提示し、「良い」との判断を得た。**⇒ 見落とされた副作用ではない。** **(b) `Enter` は解禁しない**——「Space と同じ理屈で解禁できる」と提示したうえで「解禁は不要」との判断。**★これは「判断した結果の現状維持」であって、やり残しではない。** **次の担当は `ACTIVATION_KEYS` から `Enter` を外さないこと**（外すのは裁定を覆す変更である）
    8. **★製造側の説明の誤りを 1 件記録する。** 上記 4（登録ダイアログのリピート）について、開発者へは当初「押しっぱなしで次々と別の対象へ割り当たる」と説明したが**実測で外れていた**。**開発者から「イメージがついていない」と指摘を受けて実物を確認し、訂正した**（実際は「勝手に出る確認ダイアログ」だけ）。**★症状の説明は推論ではなく実測で書くこと**——**本サブで 2 度目の同型**である（否定形確認の走査 false negative も「回したつもり」の推論だった）

### M20-05: `recipe_cache` 再計算の配線（eager）＋ 既定プリセットへの追随（2026-08-14）

- **結果**: `go test ./...` **全緑（47 パッケージ・FAIL 0）**／`pnpm test` **1156/135 全緑**／`make e2e` **84 passed / 0 failed（フルスイート完走）**／**消費マイグレ 0 本**（disk 末尾 `000075` のまま。ボード §2.2 の「次 `000076`」と一致）。**再計算の実測＝53 エンティティ（有効 combos 39 ＋ 有効 setups 14）・212 move step で 5.5〜6.5 ms**（`D-303` の前提から桁で外れず、停止条件 1 は発動せず）。**`P-34` は実測 27 件（見込みどおり）**。**レビューは差し戻し事由 0 件・往復 0 回**（指摘 11 件のうち**「高」2 件を含む 10 件を採用**、低 1 件は記録のみで不採用。**「高」の不採用は 0 件**）
- **報告**: 完了報告 [`M20-05-completion-report.md`](M20-05-completion-report.md) ／ レビュー [`m20-05-review.md`](m20-05-review.md)（**取り込み結果は同報告書末尾の「取り込み結果（自動トリアージ）」節**）
- **★横断課題**:
    1. **★`SUPP-001` §7.2 の呼出元表に `config` 起点の行が無い。** as-built のプリセット側呼出元は 3 経路だが内訳が違う——**「作成」と「コピー」は同一経路**（`POST /api/presets` = `Create()` が組み込みをコピーする形で、独立した duplicate エンドポイントは無い）であり、代わりに**「既定プリセットの切替」（`PUT /api/config`）が呼出元に加わる**（§4.2-3）。**⇒ 指示書 §4.1-4 が数える「4 経路」は as-built では 3 経路である。** 是正は設計卓の手番
    2. **★`RecomputePresetCache` は 4 兄弟のうち唯一 `*sql.Tx` を取らず、さらに内部の読み（エイリアス解決）が渡された tx を見ない。** ⇒ 書き込み tx の内側で呼ぶと**コミット前のエイリアスが見えて古い表記を書き込む**。エラーにならず全テストが緑のまま通る。**加えて `sql.DB` のプールが無制限・`busy_timeout` 5 秒のため、内側で呼ぶと `SQLITE_BUSY` にもなる**（陽性対照で実測）。**`SUPP-001` §7.1 にこの性質が書かれておらず、誰かが必ず踏む**。設計卓が §7.1 の是正へ含める
    3. **★既定プリセットの固定値は 3 か所だった**（`D-313` の記録「2 か所」より 1 多い）——`model/recipe.go` ／ `service/combo` ／ `service/setup`。**3 つとも撤去して注入 1 か所へ寄せた**（`D-360` ＝案 B）。**`internal/config/config.go` の `PresetID: 1` は設定そのものの既定値であり残骸ではない**
    4. **★E2E spec がグローバル資源（プリセット総数）を奪い合う。** `playwright.config.ts` は `fullyParallel: false` だが**ファイル単位では並列に走る**一方、E2E スタックは**バックエンド 1 本・DB 1 個の共有資源**である。プリセットを作る spec を別ファイルへ置くと `m20-04` の「上限 8 件」テストが落ちる（**実測**。当該 spec 単独では 4/4 緑）。**本サブは同一ファイルへ寄せて回避した**が、**今後グローバル資源を触る spec を足すたびに同じ罠がある**。恒久策は全 E2E の実行方針に関わるため設計卓・改善レーンの判断が要る＝followup `e2e-shared-global-resource-parallel`
    5. **★`P-34` の 27 行すべてが `original_move_code`（派生元）も空だった。** これが除外した 272 件（`rush_variant`）との判別条件である——**除外側は派生元を持つため段階1 解決で到達できるが、27 件はコマンドも派生元も持たず現状どの経路からも解決できない**。値決めに直接効く一次情報。**うち 4 件（guile `sonic_break`・manon `grand_fouette_{light,medium,heavy}`）は同族に command を持つ兄弟が実在するため入力漏れ側**（`D-312` と同型。値決めではなく CSV を埋めるのが筋）。**`rashid` の `buffed_*` 5 件は移動系 9 code と同一入力になる衝突懸念に該当**（`D-337` の指摘どおり）
    6. **followup `preset-config-preset-id-existence` は本サブで解消した**（更新時 422 ＋ 起動時フォールバック）。**config サービスへは関数注入で渡し、DB・preset・notation への直接依存を増やしていない**（`M20-04` が止めた形を、依存の向きを増やさずに引き取った）
    7. **★`SUPP-001` §7.5.4 から作成・エイリアス更新の 2 経路だけが外れる。逸脱ではなく明示的な例外である**（`D-360`）。**削除経路は §7.5.4 の流儀どおり同一 tx 内**。同節への注記は設計卓の手番
    8. **★挙動差 1 件**——`UpdateRecipeCacheTx` は `updated_at` を bump しないため、**エイリアス編集で全コンボの `updated_at` が動かなくなった**（従来の非 tx 版は bump していた）。望ましい方向だが挙動が変わった事実として記録する
    9. **`scripts/check-md-emphasis.sh` の `BASELINE_BROKEN` が 373 に対し実測 372**（1 行減少）。**`scripts/` は `D-335` により製造が触らないため据え置いた**（`M21-03` 横断課題 7・`M20-03` 横断課題 5 等の再演）
    10. **クラウド実行環境に `markdown-it-py` が入っていない**（`M21-03` 横断課題 7 の再演）。**`check-artifact-integrity.sh` が初回赤になる**が、**同スクリプトは依存欠落時に緑を返さない設計になっており正しく振る舞っている**。`pip install markdown-it-py` の後は全緑
    11. **★`make run-web` は起動していない。** 本サブはフロントを実質変えておらず（コメント 1 か所とテストのみ）、画面経由の 1 周は `make e2e`（84 件・ブラウザ実行）が同じ面をカバーしているため。**画面を目視した 1 周ではない**ことを明記する
    12. **★否定形確認の走査が 1 件を取りこぼしていた**（レビュー指摘 高-1 で是正）。**原因は「`未実装` を含む行」を ASCII の `recipe|preset|cache` で絞ったこと**——**本リポジトリのコメントは日本語であり「プリセット」は `preset` に一致しない**。⇒ `web/src/features/combo/utils.ts:68` を落とし、件数を実態より少なく報告していた。**★教訓: 否定形確認のキーワードは、コメントが書かれている言語で書くこと。** 是正後の真の件数は 3 件（うち 3 件とも入力面・スコープ外のため是正せず記録）
    13. **★`web/src/features/combo/utils.ts:68` の失効記述は本サブでは直せない。** `formatRecipeLine` の呼出元は `RecipeBuilder.tsx`（レシピ入力面）と `SetupInputRow.tsx`（セットプレイ入力面）だけで、**§2.2-1 の diff 0 要求の範囲にある**。**★`M21-04` 完了後の手番として設計卓へ**。実害＝既定プリセットを切り替えた利用者に**編集中プレビュー（公式日本語固定）と保存後表示が食い違う**（本サブが作った差ではなく、追随を入れたことで顕在化した既存の近似の限界）
    14. **★E2E のグローバル資源競合は「作る側」だけでなく「消す側」も同じ罠だった**（レビュー指摘 中-2）。`deleteCustomPresets` の全削除を `beforeEach` で撃つと、上限テストがカスタムを保持している最中に数え損ねさせる。**本サブは該当 spec から全削除を除去して閉じた**が、**規約として残っているわけではない**＝followup `e2e-shared-global-resource-parallel`
    15. **★注入漏れを検出する検査が無い**（レビュー指摘 中-3）。本サブで「nil を渡すと機能が黙って無効になる」注入点が **8 か所**に増えた。**将来サービスを 1 本足して `defaultPresetID` を渡し忘れると、レシピ行が空になるだけで誰も落ちない**＝followup `di-injection-missing-detection`
    16. **★`RecomputeComboCache` は tx を取りながら preset / alias の読みが tx を見ない**（レビュー指摘 中-4）。**§4.4-4 が禁じた形そのものだが本サブが作った形ではない**（M1-04 以来）。**今日は害が無い**（コンボ書き込み tx は `presets` / `preset_aliases` を書かない）。**`SUPP-001` §7.1 の是正と同じ束で設計卓へ**＝followup `notation-recompute-combo-cache-tx-read-asymmetry`
    17. **★`followup-backlog.md` の `recipe-cache-stale-preset-keys` が撤去済みの `model.DefaultPresetID = "1"` を根拠にしたまま残っていた**（レビュー指摘 高-2）。**根拠を現在の機構へ書き換え、担当を `M20-05` → `未割付` へ修正した。** **★生きた台帳の 1 行だけが旧世界のまま残る形**であり、テストでも lint でも検出できない
    18. **★開発者の実機確認が完了した**（2026-08-14・実装後）。**(a) 起動時 `WARN` は出ず**（＝`config.toml` が実在プリセットを指している正常状態。同 `WARN` は不在のときだけ出る）**(b) 設定保存は成功**（新規プリセット作成で確認。`PUT /api/config` 自体は製造が実機で 200／422 の両方を実測済み）**(c) 既定プリセット切替の体感影響なし**（現在のコンボ数では）。**⇒ 指示書 §7.2 のうち製造が未実施だった「画面での目視 1 周」は開発者側で確認され、未達項目は残っていない**
    19. **★再計算のスケールは未測定である**（開発者の依頼で後日課題化＝followup `recipe-cache-recompute-scale-unmeasured`）。**再計算は eager・同期で `PUT /api/config` と `PUT /api/presets` の応答をブロックする。** 実測 **53 エンティティ・212 move step で 5.5〜6.5 ms**、開発者機でも体感影響なし。**ただし大量登録後は未知**で、計算量は**エンティティ数 × 1 プリセットの線形**。加えて `configsvc.Update` は `s.mu` 保持中に回す。**★`D-292` が置いた「実件数の実測で閾値を超えたら lazy を再検討する」条件は生きている**——**桁が変わったら再測定し、lazy 化・非同期化（`SUPP-001` §7 の改訂）を設計卓が判断する。製造の独断では変えられない**（§9.4 停止条件 1）
    20. **指示書・チェックリスト v1.2.0 を開発者から受け取りディスクへ反映したが、指示によりコミットしていない。** **Phase B のレビューはチェックリストをディスクから読むため、v1.1.0 のままだと `punishfinder` の diff を理由に裁定どおりの実装が差し戻される**（チェックリスト v1.2.0 自身が `D-323` と同型として警告している事象）

### M21-05: キーボード入力（既定を持たない全キー登録制）（2026-08-14）

- **結果**: `pnpm lint` **exit 0**／`pnpm test` **1297/146 全緑**（着手前 1197/137）／`go test ./...` **FAIL 0**（`internal/` 無改造）／`make e2e` **88 passed / 0 failed（フルスイート完走・新規 spec 4 件を含む）**／**消費マイグレ 0 本**（disk 末尾 `000075` のまま）。**`bash scripts/check-browser-storage-keys.sh` 緑**（台帳 #9 `keyboard-bindings-v1` を新設）。**主要な確定事項＝判定・受け手の調停・操作の配送は 1 組のまま、供給元だけを 2 つにした**（`mergeNormalized` で 1 本の押下集合へ合流）。**`stepDetection.ts`（判定の本体）は 1 行も変えていない。** **登録対象は 16 件**（必須 10 ＋ 任意 6。Gamepad の 14 件との差 +2 は「前置き 1 件を持たない代わりに操作 3 件を直接持つ」ため）。**停止時記録 0 件**
- **報告**: 完了報告 [`M21-05-completion-report.md`](M21-05-completion-report.md) ／ レビュー [`m21-05-review.md`](m21-05-review.md)（**取り込み結果は同報告書末尾の「取り込み結果（自動トリアージ）」節**）
- **★横断課題**:
    1. **★`scripts/check-browser-storage-keys.sh` に既存の不具合がある。** 実行のたびに `syntax error near unexpected token '('` 等が **stderr へ 3 行**出る。原因は同スクリプト 113〜114 行の `DIRECT_ALLOW` 配列で、**二重引用符の中にバックティックが入っており bash がコマンド置換として実行してしまう**ため。**判定結果・exit code は正しい（「違反なし」/ 0）ため実害は無いが、ノイズが常に出る。** **★`scripts/` は `D-335` により製造が触らないため据え置いた**（`M20-05` 横断課題 9・`M21-03` 横断課題 7 と同型の「触れない検査スクリプトの不具合」）
    2. **★`GamepadInputProvider` の名前が実態と合わなくなった。** 供給元が 2 つになったのに "Gamepad" を名乗っている。**改名は `useGamepadInputContext` / `useGamepadRecipeInput` / `GamepadInputContextValue` まで波及し、`M21-03` / `M21-04` の as-built を広く触る機械的 diff になる**ため製造判断では見送り、docblock を事実へ是正するに留めた。**`M21-06` が同じ層に乗るため、改名するならその着手前が最も安い**＝設計卓の手番
    3. **★`DES-005` §6.4.3 項目 4 の「供給元はアプリ全体で 1 個」は as-built と矛盾したままである。** コード側の docblock は是正したが設計書本体は製造の対象外。**`CHANGE-110` §2-f の反映で解消される見込み**
    4. **★`web/CLAUDE.md` #2 `virtual-controller-layout-v1` は「未実装」のまま残った。** `CHANGE-106` §2.2-g の「レイアウト種別の保持は `M21-04` / `M21-05` が実装する際に使う」という見込みは**失効した**——**どちらも種別選択を実装していない**。`M21-05` はレイアウトを選ばせる形を採らず全キー登録制を採ったためである（**D-370**）。台帳の脚注へ明記済み。**`CHANGE-110` 反映時に設計卓で確認されたい**
    5. **★破壊確認で「緑のままのガード」が 2 つ見つかった**（`SUPP-001` §5.5 (10) の想定どおりの形）。**(f) キーリピートは供給層のガードを両方外しても統合テストが緑**——**判定層が押下集合の差分で立ち上がりを採るため、同じ集合を何度 push しても新しいステップは生まれない**。**(e) 操作キーの分離も 1 段目を外しただけでは緑**（保存の時点で Record が分かれているため）。**⇒ 供給層の契約を固定する `useKeyboardInput.test.ts` を追加して閉じた。** **★教訓: 「別の機構が代わりに守っている」場合、統合テストだけでは当該ガードが『外しても誰も気づかない』状態になる。ガードと同じ層に契約テストを置くこと**
    6. **★`event.repeat` ガードは押下集合の重複ガードと完全に冗長である**（同じキーには後者が必ず先に効く）。要件（`§4.5-3`）を直接表現しているのは前者であり、リピート連打時の早期脱出にもなるため残したが、**簡素化の余地がある**＝改善レーン
    7. **★E2E の `ol > li` は M21-05 でステップ一覧と読取表示の両方に当たるようになった。** 読取表示（`GamepadRecipeReadout`）も `ol > li` を描画するが、**M21-04 まではパッド接続時にしか出なかったため既存 spec では露見しなかった**。**⇒ `RecipeBuilder` の `<ol>` へ `data-testid="recipe-step-list"` を追加した**（既存 test-id は変更していない＝`DES-005` §6.8）。**既存 spec（`m15-03` 等）は素の `ol > li` のままだが、キーボード未登録では読取表示が出ないため緑のまま。今後キーボードを登録する spec を足すと同じ罠がある**
    8. **★否定形確認の走査コマンドがロケール依存で false negative を返した**（レビュー指摘 高-1 で検出）。**`LC_CTYPE=POSIX` の環境では `grep -E` の否定文字クラス `[^。]` が**バイト単位**で解釈され、`を`（`E3 82 92`）が `。`（`E3 80 82`）の構成バイトと衝突して一致しない。** ⇒ 走査 [3]（「供給元は 1 個」）が 0 件を返し、**`web/src/App.tsx:35` の失効記述を見逃していた**（provider をマウントしている当の場所であり、次に入力層へ来る `M21-06` が最初に読む行）。**`LC_ALL=C.UTF-8` を付けて再走査し是正済み。** **★教訓＝日本語の散文を否定文字クラスで走査するときは必ずロケールを固定する。軸 (b) は本プロジェクトで常用されるため、本件限りの回避ではなく運用の型として指示書テンプレートへ持ち込む価値がある。** **★「緑だが効いていない走査」の実例がまた出た**（`M21-04` 横断課題 11・`M20-05` 横断課題 12 に続き 3 度目。**毎回スコープの取り方が違う**——今回は正規表現でもキーワードでもなく**実行環境のロケール**だった）
    9. **★レビューが指摘 14 件（高 4 / 中 4 / 低 6）を出し、12 件を採用した。** **差し戻し事由 0 件・往復 0 回・「高」の不採用 0 件。** **★とくに `mergeNormalized` の方向 `source` の食い違い（中-1）は、破壊確認まで行って「`value` 側は実は差が出ない（`readBinding` の性質上、押されていない cardinal の値は必ず押されている値以下）」ことを確かめたうえで、**差が出る唯一の条件（上下同時押し・斜めではない・axis と button の混在）**を突くテストを足して閉じた。** 不採用 2 件は 低-4（修正の副作用のほうが大きい）・低-6（設計卓の手番）
    10. **★実行環境の制約を 2 件記録する。** **(a) `cdn.playwright.dev` がネットワークポリシーで遮断されており、`@playwright/test` 1.60.0 が要求する chromium v1223 を取得できない。** プリインストール済みの **chromium-1194** を `PW_EXECUTABLE_PATH` で指して完走させた（`Makefile` の e2e ターゲットが同変数に対応済み）。**(b) `make e2e` を `go test ./...` と並走させると大量に落ちる**——**4 コア環境で 13.7 分かかり 36 件が時間切れになった。単独実行では 2.3 分・0 件**。**⇒ E2E は単独で回すこと**（同じ結果を「実装の不具合」と読み違えかけた）
### M20-06: 命名規則の正典化 ＋ `P-34` 13 件のエイリアス投入（2026-08-14）

- **結果**: `go test ./...` **FAIL 0**／`pnpm test` **1197/137 全緑**／`pnpm lint` **exit 0**／`make e2e` **83 passed / 0 failed（フルスイート完走）**／**消費マイグレ 2 本**（`000076` / `000077`。着手時の disk 末尾実査 `000075` ⇒ 次は `000078`）。**投入は 13 `move_code` × 2 プリセット ＝ 26 行**（`D-373` ＝案 A）。**`alias_text_en` 非 NULL は 76 → 102 行**。**`official_ja_move` は無改変**。**`(ラッシュ)` は 272/272 件が接尾辞を持ち揺れ 0 件**（`D-305` は不変）。**レビューは差し戻し事由 0 件・往復 0 回**（指摘 7 件のうち**「高」1 件を含む 5 件を採用**、低 2 件は記録のみで不採用。**「高」の不採用は 0 件**）
- **報告**: 完了報告 [`M20-06-completion-report.md`](M20-06-completion-report.md) ／ レビュー [`m20-06-review.md`](m20-06-review.md)（**取り込み結果は同報告書末尾の「取り込み結果（自動トリアージ）」節**）
- **★横断課題**:
    1. **★クラウド実行環境では `make e2e` の前にアプリを 1 度起動して `config.toml` を作る必要がある。** 同ファイルは `.gitignore` 対象でクリーンな clone に存在せず、**初回 E2E は「初期設定ウィザードが出て先へ進めない」形で 34 件失敗する**（アプリが実行途中で生成するため、生成後に走った後半のファイルだけ通る）。**★本サブの変更とは無関係の環境要因であり、次の担当も必ず踏む**。恒久策は E2E ハーネス側（`playwright.config.ts` の webServer 起動前に config を用意する等）だが、全 E2E の実行方針に関わるため改善レーンの判断が要る
    2. **★`playwright install` はネットワークポリシーで 403 になる**（`cdn.playwright.dev` が許可されていない）。**プリインストール済み Chromium を `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` で渡す**。`Makefile` の `e2e` は既に同変数へ対応済みであり、**クラウド実行時は必ず付ける**
    3. **★背景コマンドの終了コードは信用できない。** `cd web && pnpm test` を背景実行したところ、実体は `vitest: not found`（`web/node_modules` 未インストール）で失敗しているのに **wrapper が「exit code 0」を報告した**。**一度「フロントは緑」と誤って報告している**。⇒ **終了コードではなくコマンド自身の出力（テスト件数）で判定すること**。`pnpm install --frozen-lockfile` 後に走らせ直して 1197/137 全緑
    4. **★`DES-004` §5 ／ `DES-003` §3.9 の `alias_text_en` 充足範囲の記述が失効した**（「値が入っているのは移動系 2 code のみ・76 行」）。**as-built は 102 行・対象は移動系 2 code ＋ 層 C-3 の 13 code**。`CHANGE-103` の (d) が「増える場合のみ改訂する」としており、増えた。**反映は設計卓の手番**
    5. **★適用済みマイグレ `000074` / `000075` のヘッダにも同じ失効記述がある**（76 行 ／ 移動系 2 code ／「`P-34` の 27 件が将来投入されると」）。**適用済みマイグレは改変しない**（M20-03 §2.2）ため据え置いた。**⇒ マイグレのヘッダに実測値を書くと必ず失効するが、直せない**。次に件数を書く担当への申し送り
    6. **★生成 SQL ヘッダの失効記述を是正した**（`D-361`）。「移動系 9 code は `characters` を CROSS JOIN する」は **M20-02 レビュー H-2 がキャラの明示列挙へ是正した時点で失効**しており、**`000072` 本体と矛盾したまま以後のすべての波へ複製される状態**だった。**旧文面は `FormatPreM2003` でのみ再現する**（適用済み 2 本との byte 一致は golden が主張しており、崩すと「赤いのが普通」になる）
    7. **★`is_derived=true` の行は `command` を補記しても `move_commands` に載らない**（`moveindex` が `SkipDerived` で最優先 skip する）。**⇒ `P-34` の (b) 13 件の CSV 補記は、表示にも逆引きにも効かない**。効果は「入力情報が CSV に記録される」ことに留まる。**起票先を決める際の材料**（`§4.6` 調査の副産物）
    8. **★`alias_text_en` は入れても今日は表示されない**（`§4.9`）。**表示ロケール分岐も、逆引きが同列を引く経路も実装 0 件**であり、**26 行を入れても画面は 1 文字も変わらない**。**本サブが作った状態ではなく `M20-02` から続く状態**（既存 76 行も同じ）。**⇒ 「投入した」と「表示に効いている」を書き分けた**。実装は `M20-07` 以降
    9. **★`rush_variant` の `original_move_code` に dangling 参照が 4 件ある**（`_1hits` とすべきところが `_1`。ingrid 2 / lily 1 / mai 1）。**`D-305` の「268/272」の正体はこれであり、命名の揺れではない**——揺れは 272/272 で 0 件である。**加えて lily `rush_desert_storm_1hits` の `name_ja` が規則から外れている**（`デザートストーム(ラッシュ)`。規則どおりなら `デザートストーム(単発)(ラッシュ)`）。**いずれも `D-305` により補正しておらず、設計卓の判断待ち**
    10. **★破壊確認が「空振りするテスト」を検出した。** `Test_P34_CustomPresetWinsOnDisplay` は当初、ステップに `move_code` を持たせておらず、**`move_code` を鍵にした固定表を置かれても赤くならなかった**。実データのステップは `move_code` を持つため、テストを実態へ揃えて再確認した。**⇒ 破壊確認が無ければ緑のまま通していた**
    11. **★「別の機構が代わりに守っている」を先に疑った例**（`SUPP-001` §5.5 (10)）。層 C-3 の衝突テストを「同一キャラで同じ `name_ja` を持つ 2 件」で書いたら、**`csv.go` の `validate` が先に fail させて生成器まで到達しなかった**。⇒ 層 C-3 固有の危険は「`name_ja` が同キャラの別技の**表記**と一致する」形（`name_ja` の重複ではないので validate を素通りする）と特定し、そちらを固定した
    12. **★否定形確認の走査は行単位 grep では取りこぼす**（レビュー指摘 高-1 で発覚）。`write_repository_test.go` は `alias_text_en` が 130 行目、`micro` / `2 code` が 131 行目にあり、**2 段 grep のどちらの条件も同時に満たさなかった**。さらに失効値「38 行」は**語ではなく数値**でどのパターンにも入っていなかった。**⇒ 走査は (1) 行を跨ぐ文脈（`-A1 -B1`）またはファイル単位（`grep -rl`）で回し、(2) 数値で書かれた実測値を数値のパターンでも探すこと。** `M20-05` 横断課題 12「キーワードはコメントが書かれている言語で書くこと」と対をなす教訓であり、**同じ節の走査が 2 サブ続けて取りこぼしている**
    13. **★コメントに実測件数を書くと必ず失効する。** 是正では**エラー文言から件数そのものを削った**——当該アサーションは `enCount == 0` しか主張しておらず、件数を書く必要が無かった。**件数の正本はサブ別の契約テストに 1 か所だけ置く**（`migrate_m2006_test.go`）。**適用済みマイグレ `000070` / `000074` / `000075` のヘッダにも同種の件数記述があるが、改変できないため失効したまま残る**（横断課題 5 と同根）
    14. **指示書・チェックリスト v1.2.0 は開発者から手渡しで受領し、指示によりコミットしていない**（`docs/instructions/` の diff は 0）。**Phase B のレビュアーには手渡し版のパスを明示して渡した**——ディスク上の版は v1.0.0 のままであり、そのまま読ませると `D-373` の裁定どおりの実装（26 行）が「13 件でない」と差し戻される（`M20-05` 横断課題 20 と同型）

### M21-06: コマンド技入力モード（必殺技の方向連続入力）（2026-08-14）

- **結果**: `pnpm test` 148 files / 1364 tests 全緑 ／ `pnpm lint` exit 0 ／ `go test ./...` FAIL 0 ／ `make e2e` 96 passed（flaky 2 は既存 spec で retry 成功） ／ **消費マイグレ 0 本**（disk 末尾 `000077`）。**★`DES-005` §6.6 は 0 件になり、M21 レーンは全 6 サブ完了。** 操作の種別は 3 → 4 値（`command_mode`）、キーボードの登録対象は 16 → 17 件、**Gamepad は 14 件のまま**。**★停止条件 3 が発火し `D-379` で裁定・解除**（`internal/service/inputresolve/` は契約のどの条項でも凍結されていない＝**M-65**）。コミットは 5 本で、**改名（`8011a1e`）とバックエンド（`b473abd`）を単独で分離**した
- **報告**: 完了報告 `docs/progress/M21-06-completion-report.md` ／ レビュー `docs/progress/m21-06-review.md`
- **★横断課題**:
  1. **★破壊確認が「別の機構が代わりに守っている」を検出した**（`D-375` の要求どおり）。§5 (a)「モード中に方向を入れてもステップが増えない」は**壊しても赤くならなかった**——`stepDetection.ts` の `pressedButtons`（:248）が方向を押下集合から除き、窓が開くのは**ボタンの立ち上がりだけ**（:402）であるため、**ゲートを壊しても方向だけでは永久に緑**である。**露出しているのは確定の契機になる攻撃ボタンのほう**であり、そこへ契約テストを置き直した（「窓を閉じ切ってもステップが 1 つだけ」）。**⇒ 「方向を振って件数を見る」形のテストは、この層では常に無意味である。次に入力系を触る担当への申し送り**
  2. **★否定形確認の陽性対照が最初に外れ、走査の壊れを検出した。** `契約 F-3` で引いたが 0 件——契約は表セル内で `**F-3**` と書いており「契約 F-3」という並びが存在しなかった。**⇒ 陽性対照が無ければ「0 件＝残骸なし」と読んで終わっていた。** `M20-06` 横断課題 12（行を跨ぐ取りこぼし）に続き、**同じ節の走査が 3 サブ連続で別々の理由により壊れている**。**⇒ 走査は「対象の実文面を 1 度 grep して確かめてからパターンを書く」こと**
  2′. **★それでも取りこぼした。走査は「同じファイルの別行」に弱い**（レビュー指摘 高-1 で発覚）。`stepDetection.ts` は :87 を是正しながら **:110 / :351 を残した**——パターンが当たった行だけを直し、**同じファイルの残りを読まなかった**ためである。他に件数の写しが 3 か所、区画数が 1 か所残っていた（計 6 件）。**⇒ 走査は 2 段で回すこと**——**(1) パターンで当該ファイルを `grep -l` で出す (2) 出たファイルは全文を目で見る**。**行を直して終わりにしない。** 本サブは是正の方針も「件数を書き直す」から**「件数を書かない／列挙から導出する」**へ統一した（書き直しても次に増えたとき同じことが起きる）
  3. **★未来形の記述は、指した先のサブが終わった時点で必ず失効する。** `stepDetection.ts` / `types.ts` / `recipeInputResolution.ts` の 3 か所が「`M21-06` が乗る見込み」「`M21-06` の領分である」と書いていたが、**答えは 3 件とも「乗らなかった／出せないまま」**だった（モードは `StepCandidate` ではなく `MotionCandidate` を持つ ／ OD はボタン部が複数で一致しない ／ ステップ・ラッシュは `move_commands` に 1 行も無い）。**⇒ 「次のサブが持つ」と書くときは、そのサブの完了時に**答え**を書き戻す手番まで含めて設計すること**
  4. **★「操作が 1 つ増えたから両側の登録件数も +1」ではない。** キーボードは 16 → 17 になったが **Gamepad は 14 件のまま**である——増えたのは**前置きのあとに押す後続ボタン**であって、**登録する前置きボタンは 1 件のまま**だからである。`web/CLAUDE.md` §1 の「件数を釣られて直さないこと」が実際に効いた場面であり、**脚注へ実例として書き足した**
  5. **★件数をコメントへ書き写すと、増えたときに黙って古くなる。** `judgmentParity.test.ts` は「操作 3 件も登録しておく」と書いて**実際に 3 件しか登録していなかった**——4 値目が押下集合へ混ざらないことを検証できていない状態になる。**列挙から回す形へ改めた**（`M20-06` 横断課題 13 と同根で、あちらは「件数を削る」、こちらは「列挙から導出する」で解いた）
  6. **★followup `e2e-config-toml-bootstrap-on-clean-clone` が予告どおり再現した。** クリーンな clone では `config.toml` が無く初期設定ウィザードが出るため、**新規 spec も既存 spec も全滅する**。`cp config.toml.example config.toml` だけで解消する。**★あわせて本実行環境では Playwright のブラウザ版が食い違い**（要求 `-1223` / 実在 `-1194`）、`PW_EXECUTABLE_PATH` を渡す必要があった。**どちらも本サブ固有ではない**
  6′. **★「取得に失敗しても壊れない」は入る側だけでは足りない**（レビュー指摘 高-2）。`§4.6-6` を「索引が無ければモードに入れない」と読んで可否ガードを入切の**両方**へ掛けたところ、**入ったあとに索引が失われると抜けられない状態**ができていた（キャラ切替中の再取得／取得失敗／未 seed キャラへの切替の 3 経路）。**方向はステップにならず・解決もせず・抜けられず・溜まった列は画面から消える。** ⇒ **状態を持つ機能の可否ガードは「入る側」だけに掛け、「抜ける側」は常に通すこと。** 併せて索引が失われたらモードを自動で畳む形にした（畳む経路を通すため溜めた列は捨てられる前に読取表示へ出る＝`E-84`）
  8. **★実データの数え方は、実装と同じ規則で数えること**（2026-08-14・開発者の確認で発覚）。`§3.3-7`／`§4.2-4` の「同長候補が複数ある組」を**自作の走査で数えた**ところ、`[4]646K` のようなブラケット付きを除外していた——**実装は角括弧を外して方向列にするため実際には参加している。** さらに「強度を問わない token（`214K`）と強度指定 token（`214LK`）が同じ方向列で共存する」型を丸ごと落としており、**リュウ・ケンの竜巻旋風脚など 21 通りの主力技が入らない状態を報告し損ねた**（開発者が「ガイルのサマーソルトは？」と聞いてこなければ気づかなかった）。**⇒ 実測は「実装の関数と同じ規則を再現して」行うこと。** 走査の陽性対照（横断課題 2）と同じ性質の話であり、**「自分で書いた別の規則で数えた数字」は検証になっていない**
  9. **★指示書に無い規則を 1 つ足した**（開発者判断・2026-08-14）。**「ボタン具体度の同点判定」**——方向列が同長なら押されたボタンに強度まで一致する候補を優先する（`214LK` が `214K` に勝つ）。**設計卓が `§4.2-3` の最長一致を加えたのと同じ性質の決定論的タイブレークであり、曖昧一致・入力ミス補正ではない。** **★`CHANGE-109` の反映時に `DES-005` へ書き足す必要がある**（完了報告 §14-11）。**書かないと次の担当が「指示書どおりに実装すると竜巻が入らない」を再発見する**
  7. **★指示書・チェックリスト v1.1.0 は開発者から手渡しで受領し、指示によりコミットしていない**（`docs/instructions/` の diff は 0）。**⇒ ディスク上の v1.0.0 には `M-65` の残骸（「`internal/` 全体の diff 0」）が 4 か所残っており、そのまま読ませると `D-379` の裁定どおりの実装が「契約違反」として差し戻される。** Phase B のレビュアーには手渡し版のパスを明示して渡した（`M20-06` 横断課題 14 と同型で、**2 サブ連続で発生している**）
### M20-07: 取込の逆引き活用 ＋ 多候補ハッジの分割 ＋ 逆引き前段の正規化（2026-08-14）

- **結果**: `go test ./...` FAIL 0 ／ `pnpm test` 1,326 件全緑 ／ `pnpm lint` exit 0 ／ `make e2e` 96 件全緑（新規 5 本）。**消費マイグレ 0 本**（disk 末尾 `000077`・次は `000078`）。**正規化の範囲は NFKC ＋ 前後空白 ＋ 大文字小文字の畳み込みに確定**（全 4,184 行の実測で同一視 0 組）。**SA / CA 注記は 2 段構えで対応**（開発者裁定。第 1 段が 0 件のときだけ落とし、第 2 段でも「1 件のときだけ確定」を崩さない）。**逆引きは `alias_text` と `alias_text_en` の両引きになった**（`D-317` の未実装分を解消）。**多候補ハッジは `" or "` のみで分割**。**API の形は変えていない**（`DES-002` §4.2 の契約は不変）
- **報告**: 完了報告 `docs/progress/M20-07-completion-report.md` ／ レビュー `docs/progress/m20-07-review.md`
- **★横断課題**:
    1. **★設計書の失効記述が 5 件ある**（完了報告 §10-1）。`DES-004` §5 冒頭注記・§5.6 の 2 件・`DES-003` §3.9・`DES-002` §4.2。**うち 2 件は `preset.FindMoveCodesByAlias` を名指ししており、本サブが同メソッドを撤去したため識別子ごと失効した**。**設計書は編集していない**（重大 14）。**反映は `CHANGE-104` で設計卓の手番**
    2. **★「緑だが効いていない走査」が 4 度目に出た。今回のスコープは設計書の記法である**——`alias_text 完全一致` というパターンが、設計書側の `` `alias_text` 完全一致 ``（バッククォート）に当たらず **0 件を返した**。`D-375` が数えた 3 度（正規表現 ／ キーワードを書いた言語 ／ 実行環境のロケール）に続く**新しい取りこぼし方**であり、**毎回スコープが違うという観察がここでも成立した**。**陽性対照を別に立てていなければ「該当なし」と報告していた**。⇒ **`D-375` の「原因を潰すのではなく陽性対照で当たることを毎回確かめる」という判断を追認する実例**
    3. **★キャラ横断でしか見えない衝突がある。** `微歩き(後)`（`micro_back`・official）の末尾注記を落とすと `微歩き`（`micro_forward`・numeric / srk）と一致する——**19 組。`(preset_id, character_id)` 単位で数えると 0 組に見える**。**逆引きは全プリセット横断であるため本番で成立する**。⇒ **正規化・エイリアスの衝突検査は必ずキャラ単位で行うこと。プリセット単位の分析は本物の衝突を見落とす**
    4. **★技データ（CSV）を持たないキャラでも逆引き辞書は空ではない。** `c_viper` / `dhalsim` は移動系 9 code × 3 プリセット = **27 行**を持つ（生成規則が `characters` を列挙して投入するため）。**「moves 未投入だから別名も無い」という前提のテストは実データで落ちる**（本サブで実際に踏んだ）
    5. **★`DES-004` §5.6 の 2 件目（`DR > 2LP`）は BE の手番ではない**（完了報告 §10-2）。合成形は実測 533 行あるが、**取込 BE は `>` で切っておらず、ステップ分割は ① プロンプトが出力した表の行で決まる**。⇒ 危険は ① 側（`G-14a` ＝ `M17-05d`）にある。**BE で `>` を切ると逆に 533 行の正規の別名を壊す**。**あわせて流儀が 2 つあることが判明した**——525 行は `DR > ` の空白つき、**8 行は空白なしの `MP>MP` 形**（zangief）。**`DES-004` §5.6 は前者しか挙げていない**
    6. **★マイグレのヘッダに書いた実測値がまた失効していた**（横断課題 5 / 13 と同根）。`000074` / `000075` が引く「4,158 行 / 76 行」は v73 時点の値で、`000076` / `000077` により **4,184 / 102** へ動いている。**適用済みマイグレは改変できないため直せない**。⇒ **マイグレのコメントを現況として読まないこと**
    7. **★クリーンな clone で `make e2e` を回すと初回だけ落ちる問題を再演した**（followup `e2e-config-toml-bootstrap-on-clean-clone`）。`config.toml` が無いと `isInitialized=false` になり初期設定ウィザードへ飛ばされる。**`cp config.toml.example config.toml` で回避した**。**M20-06 に続き 2 サブ連続で踏んでいる**——恒久策は改善レーンの判断待ち
    8. **★クラウド実行環境には `markdown-it-py` が入っていない。** ⇒ `check-md-emphasis.sh` が実行できず、**`check-artifact-integrity.sh` が「自己検査が合格を出力しない」として赤になる**。`pip install markdown-it-py` で解消する。**★スクリプト側は正しく振る舞っている**——依存欠落時に「未実行として非ゼロ終了・緑を返さない」陽性対照を自ら持っており、**「依存が無いのでスキップして緑」にはならない**。**`config.toml` と同じ形の環境要因であり、次の担当も必ず踏む**
    9. **★★レビューが「緩めた側の失敗」を 1 件実際に捕まえた。** 第 2 段(SA / CA 注記の除去)を**入力側にも掛けていた**ため、利用者が `236236P (SA3)`(ryu には実在しない組み合わせ)と書くと**入力の注記を捨てて SA1 へ確定していた**。**★第 1 段の衝突検査は 0 組のままで、動作は「解決できた」ように見え、既存のどのテストも赤くならなかった**——本サブが最も警戒していた形が、**第 2 段の入力側という想定外の経路**から現実になった。**⇒ 注記を落とすのは辞書側だけに直した**(第 2 段の目的は「利用者が注記を**省いた**入力を拾う」ことであり、「利用者が**書いた**注記を無視する」ことではない)。**★教訓＝「両側へ同じ関数を掛ける」という不変条件は第 1 段については検査があったが、第 2 段の非対称性そのものには検査が無かった。** 段を足すときは、その段の適用側も明示して固定すること
    10. **★`golang.org/x/text` を indirect → direct へ昇格した**(`unicode/norm` の NFKC。**新規モジュールの追加ではなく `go.sum` は不変**)。**選定理由＝NFKC は標準ライブラリに無く代替が存在しない**／ライセンスは **BSD-3-Clause**(許可リスト内)／最終更新も新しい。**`CLAUDE.md` §6 の「新規依存追加は事前提案」に当たるかは開発者判断**(モジュール自体は既に依存グラフに居た)
    11. **★手順書の「貼り付ける内容」を Markdown 表のセルへ置いてはならない。** セル内でパイプを書くには `\|` とエスケープが要るが、**レンダリングを経ずに生テキストからコピーするとエスケープごと入る**。すると `ParseInput` が先頭セルを `\` と読み、`strconv.Atoi` に失敗した行を**黙ってスキップする**(ヘッダ行・散文を無視する仕様のため)。**⇒ エラーも警告も出ず、照合結果が 0 件になるだけ**——**`E-84` の形そのものが手順書側に空いていた**。**★本サブの完了報告 §12 が実際にこの形で、開発者の指摘で判明した**。**⇒ 貼り付け内容はフェンス付きコードブロックへ置き、期待値は別の表にする**。**取込ヘルパーの手順を書く担当は必ず踏む**
    12. **★開発者の実機確認が完了した**（2026-08-14）。**完了報告 §12 の全 5 手順が期待どおり**——**A（ingrid の全角括弧を半角入力で解決）／ B（SA 注記省略の解決・CA と SA3 のダブりが候補 2 件・ハッジ分割・候補なしの文言差・英語表記の両引き）／ 手順 4（`236236P (SA3)` が未解決＝レビュー指摘 高-1 の回帰）／ 手順 5（表示が変わっていないこと）**。**⇒ 指示書 §7.5-8 はこれで閉じた**
    13. **★`check-md-emphasis.sh` の走査対象に `docs/progress/` は含まれない**（対象は `docs/{change-notes,design,handover,instructions,process}`）。⇒ **完了報告と本ファイル自身の閉じない強調は、この検査では捕まらない**。なお本サブ完了時点の実測は **373 行 / ベースライン 372 行（+1）**だが、**走査対象 5 ディレクトリはいずれも本サブで 0 行の diff であり、+1 は本サブ由来ではない**（`D-335` により並走中はベースライン定数を触らず実測値の報告に留めた）

### 改善レーン 第 1 束: `check-md-emphasis.sh` の走査対象 ＋ `make e2e` の起動前提（2026-08-15）

- **結果**: followup 3 件を完了。**(1)** `check-md-emphasis.sh` の走査対象へ `docs/progress` を追加し、除外を `/phase1/` `/phase2/` の名指しから `/phase[0-9]+/` の形へ一般化した（`docs/*/phase3/` が漏れていた）。ベースラインは 372 → **438**（旧 373 − phase3 除外 121 ＋ progress 追加 186）。**(2)** `make e2e` が `config.toml` を**不在時のみ**生成し、`/opt/pw-browsers/chromium` が実在するときだけ `PW_EXECUTABLE_PATH` を自動採用するようにした。**上書きしないのは `wt-new.sh` が worktree ごとの port / DB path を同ファイルへ書いているためである**（指示書は上書きを許可していたが、許可は要求ではない。開発者確認済み）。設計書・マイグレーション・CHANGE 番号の消費はいずれも 0
- **検証**: `check-artifact-integrity.sh` 違反なし ／ `check-md-emphasis.sh` 緑（新ベースライン）＋ 自己検査 合格 ／ `go test ./...` FAIL 0 ／ `pnpm test` 148 ファイル・1,377 件 全緑 ／ `pnpm lint` exit 0 ／ `make e2e` は **config 不在で 103 passed**・**前段を無効化すると 58 failed**（`error-context.md` に「初期設定 / ようこそ」）・**既存 config ありでも 103 passed で port と database.path が保たれる**
- **報告**: [`docs/progress/20260815-improvement-lane-batch1-report.md`](20260815-improvement-lane-batch1-report.md)。指示は `docs/handover/session-prompts/20260814-improvement-lane-batch1.md`
- **★クリーンルームレビュー**（2026-08-15・[`20260815-improvement-lane-batch1-review.md`](20260815-improvement-lane-batch1-review.md)）: **完了報告の数値主張を一切採用せず全数を回し直す方針**で実施し、ベースラインの内訳・陽性対照 3 件の母数・§1.4 の原因分析・完了条件 10 項目のいずれも一致した。**指摘 高 2 / 中 4 / 低 6 のうち 10 件を採用して是正**し、残り 2 件は本束で対応しない（**高-2 は `followup-backlog.md` の失効行で D-382 により設計卓の手番** ／ **中-3 は `config.toml.example` の既定値の話で配布物の範囲**）。**★最も重い指摘は「`remote-ops.md` §5.1 に『クラウドでは `make e2e` が完走しない』という失効した断定が残った」**——**本束が直下の §5.1.1 だけを更新したため、直前の節が古い結論のまま残っていた。** **⇒ 節を更新したら、その節を含む親の結論も読み直すこと。** **★次に重い指摘は `cp` の失敗が検出されず「Created config.toml」と出して exit 0 で進む形**で、**本束が潰そうとした「全 spec が落ちて自分の変更を疑う」形そのものであり、しかも出力が嘘をつく分だけ悪い**（`cp ... && test -f ... || exit 1` へ是正）
- **★ドキュメント棚卸 3 件の分配漏れ検査**（開発者要求・完了報告 §5）: `check-doc-inventory.sh` が型に無いと報告する 2 件と、寿命を宣言してなお残る `m19-desk-status.md` について「そこにしか無い情報が残っていないか」を実査した。**`m19-desk-status.md` は分配漏れゼロ**（全節の追跡先を実証。ボード **P-24** の「削除の前提が満たされた」は正しい）。**`m21-measurement-scope-assessment.md` も分配漏れゼロだが、ステータス行が失効している**（「残るは Q3 のみ」のままだが Q3 は **D-329** で決着済み）。**★`m20-desk-startup-prompt.md` に分配漏れが 1 件あった**——§補足の「交代のよい節目」4 点と「交代の合図（劣化は自覚できない）」4 点が他のどの資料にも無い。**`remote-ops` §6.2 は「いつ交換するか」と「作業ツリーが片付いているか」を持つが、「仕事の状態として畳んでよいか」の軸を持っていない。** **⇒ 昇格が先で、仕分けはそのあとである。** **★あわせて `CLAUDE.md` §8 の「参照されている ≠ 生きている」の実例が出た**——同ファイルは複数箇所から参照されているが、**実質の参照元はゼロ**であり、検出したのは `check-doc-inventory` の出力を引用した完了報告と「仕分けが要る」と書いた handover だけだった。**ファイルは 1 つも動かしていない**（移設も削除も開発者の手番＝**D-196** 境界条件 3）
- **★横断課題**:
    1. **★「ベースラインが基点で 1 行ずれている」の原因が判明した**（`M20-07` §11 ／ `M21-06` §10.2 が報告していた +1）。**測り間違いではなく並走レーンの持ち込みである**——`734cd9b`（M21-05 レーン）のツリーを取り出して測ると **ちょうど 372 行**で、同コミットが書いた定数と一致する。差分の正体は `docs/handover/design-reports/20260814-m20-05-design-exceptions.md:29` の 1 行だけで、これを持ち込んだ `7ea1877` と `734cd9b` は**互いに祖先ではない**（merge-base は `6d86e56`）。**⇒ 一般則＝ベースライン定数は作業ツリー全体の総数であり、部分的なツリーで測った値を書き込むとマージした瞬間にずれる。下げるのは並走が解けている手番に限ること**。同型の危険は `check-enum-sync.sh` ／ `check-doc-inventory.sh` にもある
    2. **★閉じない強調には既知の型とは別の形がある。** 上記の 1 行は「開き `**` の直後がコードスパンのバッククォートで、直前が日本語文字」という形だった。CommonMark の left-flanking 条件を満たさず**開き側が認められない**ため両方リテラルで残る。**スクリプトのヘッダが挙げている例（閉じ `**` の直前が全角の約物）だけを覚えていると見落とす**
    3. **★本検査は行単位で描画するため、フェンス付きコードブロックを認識しない。** 壊れた形を報告書へ引用すると、引用そのものが検出される（本束の完了報告で実際に踏んだ）。**⇒ 引用は 1 行のインラインコードとして置くこと**
    4. **★E2E スイート自身が `config.toml` を書き換える。** 実行後は TOML が再シリアライズされてコメントが全部落ち、`[defaults]` が追加される（`PUT /api/config` を踏む spec による既存挙動）。**値は保たれており、`COMBOMGR_PORT` / `COMBOMGR_DB_PATH` の env override は焼き付いていない**——`config-toml-write-back-env-asymmetry` の是正が効いていることを対照 3 で再確認した
    5. **★`config.toml.example` の `port = 47318` が `playwright.config.ts` の `BASE_DEV_PORT = 47320` と一致していない。** example から生成すると E2E ポートがオフセット −2 で 47388 / 5271 になる。**両ポートが揃ってずれるだけで害は無く 3 条件とも完走している**が、どちらを正とするかは配布物の既定値の話であり本束では触っていない
    6. **★クラウド実行環境に `markdown-it-py` が入っていない状態が続いている**（`M20-07` 横断課題 8 に続き再現）。`pip install markdown-it-py` で解消するが恒久策は開発者（環境構築）の手番。**踏むと `check-artifact-integrity.sh` が 1 本目で赤になるため、入口で必ず気づく形にはなっている**

### M21-07: モーダル表示中の物理入力の遮断（2026-08-15）

- **結果**: `pnpm test` 151 ファイル・1,407 件 全緑（着手前 148 / 1,377 ＝ +3 / +30）／ `pnpm lint` exit 0 ／ `go test ./...` FAIL 0（49 パッケージ）／ `make e2e` **107 passed・flaky 0**（着手前 101 passed ＋ 2 flaky ＝ +4）。**消費マイグレ 0 本・消費 CHANGE 番号 0 本**（`105` は起票済み）。`internal/` ／ `migrations/` ／ `character_data/` ／ `scripts/` ／ `docs/design/` は **diff 0 を実測**。**軸は合流層に 1 本**（`isAnyModalOpen()`）で、**合流層の 2 つの入口**（押下集合の `handleSources` ／ 操作の `dispatchAction`）が同じものを読む。**判定は DOM のセレクタ・属性値を見ず、共有プリミティブ 3 つ〔`DialogContent` / `AlertDialogContent` / `SheetContent`〕が申告する登録ストア**（**D-380**）。**名指しの抑止〔キー登録ダイアログ〕は畳まない**／**コマンド技入力モードからは強制的に出さない**（いずれも理由は完了報告 §4・§5）
- **報告**: 完了報告 [`docs/progress/M21-07-completion-report.md`](M21-07-completion-report.md) ／ レビュー [`docs/progress/m21-07-review.md`](m21-07-review.md)
- **★横断課題**:
    1. **★`markdown-it-py` の欠落が 3 度目の再現**（`M20-07` 横断課題 8 ／ 改善レーン 第 1 束 横断課題 6）。`check-artifact-integrity.sh` が 1 本目で赤になる。**本サブ由来ではない**（`scripts/` の diff は 0）。**本セッションでは `pip install markdown-it-py` で解消して緑を確認したが、コンテナは使い捨てであり次のセッションでは再現する。** 恒久策は開発者（環境構築）の手番
    2. **★「守っていたもの」が新しいスコープで出た。** 破壊確認で「観測まで止める」形を当てても**初版のテストは全部緑のまま通った**——**判定層が立ち上がりで窓を開くため、押下を見落とせば解放も何も起こさない**。⇒ **「押されたまま」の害は、ステップが増える方向ではなく増えなくなる方向に出る**（開く前から押していたボタンを開いている間に離すと、閉じたあとの押し直しが黙って消える）。**⇒ 抑止を見るテストは、害が出る向きを先に特定してから書くこと。** 特定したうえで同じ層へ契約テストを 3 件足し、当て直して赤を確認した
    3. **★Portal を内包するラッパは、閉じていてもマウントされたままである。** 目印を `DialogContent` の関数本体へ置いた初版は、**画面に置いてあるだけのダイアログを常に「開いている」と数え、物理入力が恒久的に効かなくなる**形だった。**検出したのは「閉じれば戻る」1 件だけで、「開いていれば数えられる」3 件は全部緑のまま通った。** ⇒ 目印は**開閉で入れ替わる側**（Content の内側）へ置く。**Radix に限らず同型の目印を置く担当は必ず踏む**
    4. **★`GamepadCalibrationDialog` に `setCapturing` 相当が無かった**。⇒ **`D-383` の非対称〔Gamepad には DOM フォーカス由来の守りが構造的に掛からない〕は、報告された編集ダイアログ以外にも出ていた**。本サブの一般の軸で塞がったため追加対応は不要
    5. **★E2E の破壊確認は「対照が緑のまま」まで見ないと意味がない。** 欠陥を復元して A・C・操作の 3 件が赤／B（対照）が緑という**非対称**を確認した。**全部赤なら「入力そのものが飛んでいない」空振り**であり、抑止が効いている証拠にならない
    6. **改善レーン 第 1 束の成果を確認した**。クリーンな状態から `make e2e` が完走し、**3 サブ連続で踏んだ `config.toml` の罠の 4 回目は踏んでいない**（**D-384** の投入条件は充足）
    7. **★★「網羅したこと」の実査は、母集合の作り方で嘘になる**（レビュー指摘 高-1 で判明）。**「アプリ内のモーダルは例外なく共有プリミティブを通る」と断定していたが、根拠にした 22 という数は「共有プリミティブを import するファイル」の数であって「モーダル」の数ではなかった**——**問いに答えていない数を根拠にしていた**。**実際には自作のオーバーレイが 2 件あり、うち 1 件は入力面と同じツリーに居て `D-383` の欠陥がそのまま残っていた**（`ComboEditor` の「保存完了 — 警告があります」）。⇒ **網羅性を主張するときは母集合が問いと一致しているかを先に確かめる。実装の側（import・型）からしか探していないなら、見た目の側（`aria-modal` ／ `createPortal` ／ `fixed inset-0`）からも当たること。** **★走査そのものは正しく動いていた点が `D-375` の型と違う——壊れていたのは母集合の定義である**
    8. **★★「参加が要る仕組み」は、参加漏れを検出する番人と対で置くこと。** 本サブの登録ストアは**抑止しすぎない側は構造的に 0** だが、**取りこぼさない側は「申告に参加していること」が前提**である。**保証の強さが違う 2 つを同じ強さで書いたことが誤りの本体だった。** ⇒ 参加漏れを機械で検出する検査を置き、破壊確認した（目印を外すと当該ファイル名を挙げて赤になる）
    9. **★モーダル表示中も登録キーの既定動作の抑止（`DES-005` §6.5.1 (3)）が掛かり続ける**（レビュー指摘 中-2・**起票候補**）。`ModifiersEditor` の `RadioGroup`（矢印）・`Checkbox`（Space）が割当次第でダイアログ内で操作不能になる。**本サブの回帰ではなく、むしろ「同時にステップも入る」状態が解消された分だけ改善している。** **★本サブでは直していない**——直すには供給元（`useKeyboardInput`）へモーダルの条件を持ち込むことになり、**チェックリスト §9-1 の最重要ゲートに違反する**。⇒ 設計伝達レポート §4 へ回す（`D-382`）
    10. **レビュー指摘の採否**: 高 2 系統・中 3 件・低 5 件のうち **9 件を採用して是正**、**中-2 は記録して起票候補へ**（上記 9）、**低-2〔立ち上がり同期 3 か所のヘルパ化〕のみ持ち越し**（3 か所は同期対象が違い、共通化は既存の状態機械への変更になるため回帰の危険が釣り合わない）。**★「高」指摘の不採用は 0 件であり、Phase C の安全弁は発動していない。** **再レビューの往復は 0 回で、§J 停止時記録は発生していない**
    11. **★★開発者の実機確認（2026-08-15）で「点灯」だけが残っていた**。抑止そのものはキーボード・コントローラとも期待どおりだったが、**裏の仮想コントローラが入力に連動して光っていた**——**キーボードはメモ欄にフォーカスがあれば光らず、Gamepad はフォーカスに関わらず光る**。**⇒ `D-383` の非対称が、規模を縮めて点灯という 1 点に残っていた。** 是正は合流層の出口で `held: modalOpen ? EMPTY_HELD : held` の 1 行（**観測は止めていない。伏せているのは出口の見せ方だけであり、閉じた瞬間にそのとき押されているものが点灯する**）。**★「点灯の更新自体を止める」誤った直し方を破壊確認 B6 として実際に当て、契約テストが弾くことを確かめた。** **⇒ 一般則＝「経路 A にしか無いガード」を一般の軸で置き換えたら、その軸が覆っていない出力（表示・音・触覚など）にも同じ非対称が残っていないかを確かめること**
    12. **★E2E の操作を手順書の日本語へ翻訳するときは、「人間には同じ手が無い」API を素通りさせないこと。** 完了報告 §12 の手順 A が `.focus()` を「キャンセルボタンをクリックしてフォーカスを当てる」と書いており、**実機ではクリックするとダイアログが閉じて手順が成立しなかった**（開発者はダイアログの余白クリックで代替）。**⇒ 手順書に落とす前に、その操作を人間の手で再現できるかを 1 度考えること**
    13. **★`m18-03b-materialize.spec.ts` の一意化が効いていない**（起票候補）。`Date.now()` を **`memo` にしか**入れていないが、`VAL-C02` の重複キーは**キャラ・レシピ・状況**であり memo を含まない。⇒ 共有 DB 上で衝突しうる（`D-362` の類型。実機確認後の `make e2e` 1 回目で実際に落ち、再実行で 107 passed・flaky 0）。**本サブとは無関係**（同 spec は UI を介さず API で直接コンボを作るため、点灯の表示変更が到達する経路が無い）
### M22-RESEARCH-01 協調基盤の実態調査（7 軸）（2026-08-15）

- **結果**: `M22` の 7 軸（A 楽観排他 ／ B `version` 非保持経路 ／ C `users` ／ D `[security]` ／ E CORS・CSRF ／ F 設定画面・LAN IP ／ G ハッシュ候補とライセンス）を **read-only・judgement-free** で実測。読んだ commit は **`8af2ca6`**（`git status --porcelain` 空 ＝ `M21-07` の作業中ファイルは本ツリーに無い）。**軸 A**: `version` を受け取る更新経路は **3 件**（`PATCH /api/combos/:id` ／ `PUT /api/combos/:id` ／ `PATCH /api/setups/:id`）で **3 件とも `WHERE ... AND version = ?` で DB の現在値と突き合わせている**（受け取るだけ 0 件・不一致を無視 0 件）。**`code-facts` §7-2 の 3 件は全数**。`version` を `+1` する SQL は **2 本のみ**。**軸 B**: 非 GET ルート **36 件**中 `version` 保持は 3 件 ＝ **非保持 33 件**（DB へ書くものに限れば 28 件）。**`version` 列を持つ表は `combos` と `setups` の 2 表だけ**で、`combo_setups` / `combo_setup_results` / `tags` / `presets` は持たない。「コンボの一部を変えるが `combos` 行を触らない」経路は **13 件**。**軸 C**: `users` は seed `000007` が `id=1, name='default'` を 1 行入れるだけで、**`users` へ SELECT/INSERT/UPDATE/DELETE を発行するコードは 0 件**（`internal/{api,service,repository}/user/` は `doc.go` のみ）。利用者 ID は **`defaultUserID int64 = 1` が 3 か所・参照 10 か所**。**ログイン・セッション相当は 0 件**。**軸 D**: `SecurityConfig` は `PasswordEnabled bool` の 1 フィールドのみで、**値で分岐する実装は 0 件**（全参照が定義・転記・表示）。**軸 E**: ミドルウェアは **`RequestID` → `Logger` → `CORS` の 3 本のみ**（すべて `e.Use`・グループ/ルート単位 0 件）。**CSRF 相当はコード側 0 件**（`SameSite` / `Set-Cookie` / `document.cookie` も 0 件）。`server.mode` はミドルウェア構成を変えず `allowedOrigins` の中身と bind ホストだけを変える。設定変更系 API に固有の保護は無い。**軸 F**: 設定画面は 6 セクション構成、LAN IP は `internal/infra/netutil` に実在。**軸 G**: `golang.org/x/crypto v0.46.0` は **indirect** で依存グラフに実在（要求元 3 モジュール ＋ `go.mod` の indirect 行）、**`bcrypt` / `scrypt` / `argon2` の 3 パッケージすべてが `GOMODCACHE` 実体に存在**。ライセンスは `LICENSE` の実体から逐語引用（**SPDX 識別子は当該ファイルに文字列として無いため、記憶による付与はしていない**）。`/app_build_check` は **WAIT**（`pnpm audit` high=3 / moderate=4、`govulncheck` は未インストールで SKIP）。本体リポの diff は本追記と報告書 1 本のみ（`go.mod` / `go.sum` は `go mod download` の前後で sha256 不変を確認済み）
- **横断課題**:
    1. **★C-1 / C-2 / C-3（`users` ／ `tags.user_id` ／ `presets.user_id` の実データ）は取れていない**。**「行が 0 件」ではなく「測っていない」**（`E-84`）。クラウド実行環境はクリーンクローンのみで DB ファイルが無く（`find / -name "*.db"` は OS 同梱の 1 件のみ・`~/.local/share/combomgr/` も `config.toml` も不在）、**DB を作るにはマイグレ適用＝書き込みになり指示書 §0.2 に触れる**。`sqlite3` CLI も未インストール。**⇒ 開発 DB を持つ環境での追補が要る**（`M20-RESEARCH-01` がローカル担当を分けた前例と同型）
    2. **★`DES-002` §4.4 の CSRF 対策 2 本が、どちらも実装に存在しない**。第一対策の「SameSite=Strict Cookie」は **Cookie を発行・検証するコードが 0 件**で前提が成立していない。補助対策の「`X-Requested-With` を要求し検証する」は **サーバ側の検証が 0 件**で、フロントは `PUT /api/config` の 1 経路だけ付けている（`cors.go:27` の出現は許可ヘッダの列挙であって検証ではない）
    3. **★`DES-002` §8（ユーザー選択画面・簡易パスワード・サーバサイドセッション・12 時間タイムアウト・LAN 切替時のパスワード誘導）は実装 0 件**。設定画面の該当ボタン 2 個は `disabled` ＋ `notImplemented`、`LanModeConfirmDialog` は `passwordEnabled` を参照していない
    4. **★`DES-002` §4.2 に版不一致時のステータス・エラーコードの規定が無い**。§4.2（127〜198 行）を `楽観|version|409` で走査した結果、楽観排他に触れるのは `PATCH /api/moves/:id` の「楽観ロックは設けない」と `PATCH /api/combos/{id}` の用例言及の 2 行のみ。**⇒ 指示書 A-3 の「§4.2 の記述と一致するか」は照合対象が無く判定できない**（規定は §6.4 の方針一文だけ）
    5. **★同一の楽観排他衝突に対しエラーコードが割れている**——`combos` 系 `conflict` ／ `setups` 系 `version_conflict`。**ハンドラ層テストの固定強度も非対称**で、setups はコード文字列まで固定するが combos はステータス 409 のみを固定する
    6. **★`config.toml.example` と `SUPP-001` §5.8 の例が 6 グループで食い違う**。とくに **`[defaults]` セクションが example にだけ丸ごと無い**（実装にも `PUT /api/config` にも在る）。`[security]` のコメントも「フェーズ2以降」対「フェーズ3以降」で割れ、CHANGE-049 のパス制約コメントが example に無い。**2026-08-15 改善レーン第 1 束 横断課題 5（`port` の不一致）と同じ面**
    7. **★QR は「依存が入っているか」ではなく実装済み・配線済みだった**。指示書 §0.4 は軸 F を `FR407`（QR）の前提と位置づけ F-4 を「依存が入っているか」としているが、`qrcode.react@4.2.0` を使う `QRCodeModal.tsx` が実在し `SettingsSectionNetwork.tsx` に配線され、BE も `network.lanUrl` を供給済みでテストも 3 ケースある。**⇒ `M22-06` の起点は未実装ではない**
    8. **★`migrations/000007` の「M6 着手時にウィザード経由生成へ切り替える」が果たされないまま残っている**。`internal/{api,service,repository}/user/` は 3 レイヤとも `doc.go` だけの空パッケージで、`model.User` も定義のみ・参照 0 件
    9. **★`PATCH /api/combos/:id` は `SET` 対象が空でも `version` を +1 する**（`repository.go:886-887`）一方、**`recipe_cache` の更新は `updated_at` を進めるが `version` を進めない**（同 `:205` のコメント ＋ `:1335` / `:1345` / `:1355`）。**`updated_at` と `version` が同期しない書き込みが実装上存在する**（粒度論点＝`M22-overview` §4.2 の材料）
    10. **★`ComboEditor.buildPatchPayload` が `initial` 不在時に `version: 0` を送る**（`ComboEditor.tsx:237` の `initial?.version ?? 0`）。`combos.version` は `NOT NULL DEFAULT 1` で **`0` の行が生成される経路は無い**（新規行の初期値はすべて 1）
    11. **★関数名だけの走査では A-5 を取りこぼす**。`internal/api/combo/handler_test.go` の 409 テスト 2 件は関数名に `Conflict` / `Version` を含まないため `^func Test` + 名前パターンでは出てこない。**本文（`StatusConflict` / `ErrConflict`）走査を併用して確定した**
    12. **★指示書 §0.2 が書き込み例外 2 件（報告書 ＋ `progress-log` 索引行）を明示していたため、`M20-RESEARCH-01`（M-40）／`M21-RESEARCH-01`（M-49）で 2 本連続して起きた「DoD と禁止表の正面衝突」は再演しなかった**。**テンプレート側の是正が効いている**
    13. **★`golang.org/x/crypto` は `GOMODCACHE` に未展開だった**（`cache/download/.../@v/` に `.info` と `.mod` のみで `.zip` 無し）。指示書 G-4 の「`GOMODCACHE` 配下を `ls` する」は**そのままでは空振りする**。`go.sum` に `h1:` と `/go.mod` の両ハッシュが既に在るため `GOFLAGS=-mod=readonly go mod download golang.org/x/crypto` で取得し（**新規依存の追加ではない**）、**前後で `go.mod` / `go.sum` の sha256 不変・`git status` 空**を確認して進めた
    14. **`/app_build_check` の Go 側 CVE 検査は実行されていない**（`govulncheck` 未インストールで SKIP）。**「Go 側に脆弱性が無い」ではない**（`E-84`）。検出された 7 件はすべてフロント依存
    15. **★`markdown-it-py` 欠落が本セッションでも再現した**（2026-08-15 改善レーン 横断課題 6 と同じ）。`check-artifact-integrity.sh` が 1 本目で `check-md-emphasis.sh --self-test` を NG にする形は設計どおり効いていた。`pip install markdown-it-py`（4.2.0）で解消し本検査を回したところ、**本報告書が閉じない強調を 3 行作っていた**ので是正した（**2 行は「閉じ `**` の直前が全角の約物」の既知型**、**1 行は「インラインコード内でバッククォートをバックスラッシュ escape した」形**——**コードスパン内で escape は効かず境界が壊れる。⇒ 構造体タグの引用はインラインコードではなくフェンス付きコードブロックで置くこと**）。是正後 **436 行 / ベースライン 436 行で緑**
- **報告書**: [`M22-RESEARCH-01-report.md`](M22-RESEARCH-01-report.md)（指示書 `docs/instructions/M22-RESEARCH-01-collaboration-baseline.md` v1.0.0）。**followup の更新候補 10 件は同報告書 §11 に置いた**（`D-382` により製造は `followup-backlog.md` を編集しない）

### M22-01: 簡易パスワードとセッションの骨格（2026-08-15）

- **結果**: `go test ./...` **51 ok / 0 FAIL**（`-race` も `internal/service/auth` で緑）／ `pnpm test` **151 files・1412 tests passed** ／ `make e2e` **114 passed**（基線 107 + 新規 7）。**消費マイグレーション なし**（DB スキーマ不変）。**消費 CHANGE 番号 なし**（既存の `CHANGE-112` に紐づく。新規起票なし ⇒ registry §1 と「次の番号」4 か所は変更不要）。**主要な確定事項**——(1) **ハッシュは標準ライブラリ `crypto/pbkdf2`**（`go doc` の実査で Go 1.26.4 の std に在ることを確認）。**⇒ `golang.org/x/crypto` の `indirect → direct` 昇格は行わず、`go.mod` / `go.sum` の diff は 0**（§1.2-4 の承認枠は未使用）。(2) **セッションは Cookie `combomgr_session`**（`HttpOnly` / `SameSite=Strict` / `Path=/` / `Secure` なし＝平文 HTTP のため）。**`web/src/` は 1 行も触っていない**（既存の `credentials: "same-origin"` がそのまま効く）。(3) **未認証は `401` + `{"error":{"code":"unauthorized",...}}`。リダイレクトしない**。(4) **認証ミドルウェアは `e.Use` の 4 本目・CORS の直後**（CORS が `OPTIONS` を早期に返すためプリフライトが 401 にならない。`Group.Use` は `/api` と `/api/*` へ `NotFoundHandler` を副作用で登録して経路表を変えるため採らなかった＝OFF でも挙動が変わってしまう）。(5) **`password_enabled = true` かつ `password_hash` 空は、API 経路で 422 拒否 ／ ファイル経路（手書き）は WARN を出して OFF 扱い**（開発者判断・起動は止めない）。(6) **破壊確認 A / B はいずれも赤くなった**（代替の守り手の特定は不要）
- **報告**: 完了報告 `docs/progress/m22-01-completion-report.md` ／ レビュー `docs/progress/m22-01-review.md`
- **★横断課題**:
    1. **`preset-config-unsynchronized-read` は未解消のまま**（状態は変えていない）。ただし**本サブが新設した `[security]` の読み経路は最初から `configsvc.Security()` 経由で `s.mu` の保護下**にあり、**同じ面へ無同期のリードを 1 つも増やしていない**。残るのは `main.go` の `defaultPresetID` クロージャ 1 件で、**範囲は狭まった**
    2. **★`migrations/000007` のヘッダ「M6 着手時にウィザード経由生成へ切り替える」は否定形確認の走査で当たったが、適用済みマイグレーションのため直せない**（`M22-RESEARCH-01` 横断課題 8 と同じ対象）。**是正後は本行を陽性対照として使った**——指示書が指定した陽性対照（`internal/api/user/doc.go` の「M6 で実装」）は是正で消えるため、**走査の健全性を保つ対照を差し替える必要がある**
    3. **★`users.password_hash` 列は未使用のまま残る**。簡易パスワードは全ユーザー共通の 1 本であり `config.toml` に置いたため、`M22-02`（ユーザー選択＝認証ではない）の後も使われない見込み。**「将来の利用者ごと認証のために予約されている」と読めてしまう**ため、`DES-003` への明記が要るかは設計卓の判断（完了報告 §8 に 3 案）
    4. **★クリーンな clone では `make e2e` が `Cannot find package '@playwright/test'` で落ちる**。`make e2e` は `config.toml` 不在は吸収するが **`web/node_modules` 不在は吸収しない**。`cd web && pnpm install --frozen-lockfile` が要る。**次の担当も同じ切り分けを踏む**
    5. **★E2E で「保護中の画面」を見るときの落とし穴**——`page.route("**/api/**")` は **Vite が dev で配るソースモジュールのパス**（例 `/src/features/tag/api/tagApi.ts`）にも当たり、**JS モジュールが 401 JSON へ化けてアプリが起動しなくなる**。**その状態を「保護すると白画面になる」と報告する寸前だった**。オリジン直下の `/api/` に限定した正規表現へ改めたところ、**実際は外枠が完全に描画され、データ領域が `エラーが発生しました: HTTP 401: {...}` になる**のが真の状態だった（`M22-02` が引き取る）。**対照実験を置いていなければ気づけていない**
    6. **★認証状態は共有バックエンドのグローバル資源であり、1 ファイルへ寄せても守れない**。`fullyParallel: false` が直列化するのは**ファイル内だけ**で、ファイル単位では並列に走るため、**`password_enabled = true` にすると同時実行中の他 spec が軒並み 401 で落ちる**。⇒ 本サブは**サーバの認証状態を一切書き換えない**形（`page.route` によるコンテキスト単位の差し替え）を採った。`config.toml` の復元も不要になった。**followup `e2e-shared-global-resource-parallel` に対する 1 つの回避策の実例である**
    7. **★`internal/service/combo/deps_adapter.go:13` の「後続の指示書（M3 タグ、M6 ユーザー）で character リポジトリパッケージが整備される予定」が失効している**（`internal/repository/character/` は実在）。**本サブの走査対象（認証・タイムアウト）ではない別件のため是正していない**。followup 候補として完了報告 §16 に置いた
    8. **★レビューが挙動の穴を 1 件見つけた(往復 1 回目で解消)**——**`Service.Login` が `Enabled()` を見ておらず、`password_enabled = false` かつパスワード設定済みで `POST /api/auth/login` が 204 + Set-Cookie を返していた**。**この状態は例外ではない**——`SetPassword` は `PasswordEnabled` を触らず、ゲートを外しても `password_hash` は消えないため、**ゲートを外した後の通常状態**である。**指示書 §4.9-4 が「Cookie を発行する方式を採った場合、OFF でも Cookie が付いていないか」と名指しで警戒した形がそのまま残っていた**。**★初版のテストは「未設定かつ OFF」しか通しておらず緑のままだった**——OFF 側の網は「保護対象が通ること」に寄っていて、**認証 API 自身の OFF 挙動が抜けていた**。是正後、破壊確認 C を新設して当該判定を外すと赤くなることを確認した。**「高」指摘 4 件はすべて採用し、不採用は 0 件**(⇒ Phase C 安全弁の発動なし)
    9. **`markdown-it-py` 欠落がまたも再現した**（`M22-RESEARCH-01` 横断課題 15 と同じ）。`check-artifact-integrity.sh` が 1 本目で NG を出す形は設計どおり効いていた。**クリーンな実行環境では毎回 `pip install markdown-it-py` が要る**——**3 セッション連続で踏んでいる**

### M22-02: ログイン画面・ユーザー選択・ウィザードのパスワード UI（2026-08-15）

- **結果**: `go test ./...` **52 ok / 0 FAIL** ／ `pnpm test` **157 files・1460 tests passed** ／ `pnpm lint`（`tsc --noEmit`）エラーなし ／ `make e2e` **128 passed**（基線 114 + 新規 14）。**消費マイグレーション なし**（`combo_tags` へ列を足さず、既定タグの生成は Go 側で行うため。`ls migrations/` の最大は `000077` のまま ⇒ ボード §2.2 の「次に払い出す番号」は不変）。**消費 CHANGE 番号 なし**（既発行の `CHANGE-113` を消費しただけ ⇒ registry §1 と「次の番号」4 か所は変更不要）。**主要な確定事項**——(1) **`defaultUserID` の 3 定義・10 参照を撤去**し、タグ／プリセット／取込ヘルパーの 3 経路をセッション由来の値へ差し替えた（⇒ `FR501` が初めて効き始めた）。(2) **`X-User-Id` を運ぶ経路と 401 を捕まえる経路を、フロントの `window.fetch` ラッパ 1 か所へ集約**（API 呼び出しが `fetchJSON` へ一本化されておらず、独自 `request`・素の `fetch` 8 か所が併存するため、ここが「1 か所」を成立させられる唯一の層だった）。(3) **ログイン画面・ユーザー選択画面は URL を持たない条件表示**（`CHANGE-113` §7-1 の案 (α)〔選んだ利用者は保持しない〕と §4.8-5〔済んだ画面へ戻さない〕を同時に満たす唯一の形）。(4) **`D-405` の案 B を (1) と (3) を同じ手番で実装**。(2) ステータス判定と (4) エクスポートは**いずれも従属で済み、個別の作業は不要**だった。(5) **破壊確認 A / B / C はいずれも赤くなった**（代替の守り手の特定は不要）
- **報告**: 完了報告 `docs/progress/m22-02-completion-report.md` ／ レビュー `docs/progress/m22-02-review.md`
- **★横断課題**:
    1. **★指示書 §4.5-2「受け側は変えない」はコンボには成立しなかった**。同項は「サービス層・リポジトリ層は既に `userID` を引数で受け取っている」としているが、これが真なのは**タグとプリセットだけ**である。`internal/repository/combo/` の `ReplaceTagAssociations` と `findTagsByComboIDs` は `userID` を受け取っておらず、**`D-405` の案 B は受け口の追加を必須とした**。⇒ **チェックリスト §3 の「サービス層・リポジトリ層の `userID` の受け口を変えていない」は、そのままだと案 B を正しく実装した結果を違反と読む**。次に同型の指示を書くときは §4.5-2 の射程を明示すること
    2. **★`combo_tags` は利用者の列を持たない接続表であり、コンボ共有 × タグ個人スコープの組み合わせで固有の穴が生まれる**。読み出しを絞ると編集画面の初期値が自分の分だけになり、**全消し ＋ 挿入が他人の紐づけを消す**。⇒ **絞り込みと置換の形は必ず同じ手番で入れる**。片方だけだと**双方の画面に何も出ないまま他人のデータが消える**（破壊確認 C がこの一点を守っている）
    3. **★「既存のプリセットはすべて `user_id = 1` に紐づいている」という前提は実測では成り立たなかった**（指示書 §4.5-3）。実測では `presets` の 3 行はすべて `user_id IS NULL`＝**組み込み**である。⇒ 2 人目が編集できないのは「他人のものだから」ではなく**「組み込みだから」**（`VAL-P01` と `VAL-P07` の別）。**他人のカスタムプリセットは 2 人目が作って初めて発生する**
    4. **★既存の `internal/api/tag/handler_test.go` はサービスをモックしており、`userID` が SQL の絞り込みへ届くかを見ていない**。供給元を定数へ戻しても緑のままだったため、**実 DB と実サービスを通す `internal/api/tag/scope_test.go` を新設して破壊確認 B の的にした**。⇒ **モックしたハンドラテストは「値が届いているか」の網にならない**
    5. **★取り込みが既存コンボを更新する経路は存在しない**（`DupAction` は `skip` / `setups_only` のみで、どちらも既存コンボ本体をスキップする）。⇒ 指示書 §5.1-22 後段・§3.3-13 が想定した手当ては**新規作成経路だけで足りた**
    6. **★`GET /api/auth/status` と `GET /api/users` の 2 本が起動時に増えた**。`password_enabled = false` かつ 1 人の環境でも飛ぶ。**§4.2-2「余計な問い合わせを増やさない」との関係で最小である**——前者は §4.1 が実効値で出し分けよと定めており、後者は `FR502`（1 人なら選択画面を出さない）の判定に件数が要るため。**いずれも保護対象外またはログイン後の 1 回だけで、画面表示は既存の `common.loading` と同じ**
    7. **★`migrations/000007` のヘッダは今回も否定形確認で当たったが、適用済みのため直せない**（`M22-01` 横断課題 2 と同じ対象）。ただし**本サブで実体が追いついた**（既定タグを利用者作成時に生成するようになった）。⇒ **ファイルの記述だけが恒久的に取り残される**。`M22-01` が提起した「陽性対照の差し替え」は、本サブでは `git show HEAD~4` の旧コメントを対照に使うことで解決した
    8. **指示書 v1.5.0 とチェックリスト v1.5.0 に不整合 6 件**（実装前に報告済み）——実査項目数が 10 と 13 で混在 ／ チェックリスト §9-24 の参照節が §4.5-15（正しくは §4.5-17） ／ 破壊確認 B の対象が §5.1-11・12 のみ（指示書は 11・12・17） ／ 上記 1 の衝突 ／ §2.1 成果物表に案 B の対象パッケージが未記載 ／ §5.1-22 の「取り込みが既存コンボを更新する経路」が不在。詳細は完了報告 §18
    9. **★レビューが「実装ミスによる既存機能の回帰」を 1 件見つけた**（往復 1 回目で解消）——**`internal/api/combo` が書き込み経路へ `userID` を一度も渡していなかった**。`toServiceCreateInput` / `toServiceUpdateMetadataInput` / `Materialize` のいずれも `UserID` を設定せず実行時は常に 0。⇒ 絞り込んだ `DELETE` が 0 行になり、続く `INSERT INTO combo_tags` が主キー衝突して **500**。**タグの付いたコンボを編集保存すると必ず落ちる**（パスワード無効・利用者 1 人でも＝最重要ゲート 2 違反）。**★緑だった理由が重要である**——サービス層のテストは入力を直接組み立てるため API 層の欠落を踏まず、API 層のテストは**サービスをモックしている**ため `UserID` を検証していなかった。**⇒ 破壊確認 C は SQL の形は守っていたが、HTTP の配線を見ていなかった**。実 DB と実サービスを HTTP から通す `internal/api/combo/scope_test.go` を新設して回帰を固定した
    10. **★「モックしたハンドラテスト＋実物のサービステスト」の組み合わせには、両者の境界に穴が残る**（上記 9 の一般化）。本サブでは `tag`（実物）・`preset`（id 固定）・`comboio`（モックが `userID` を捨てる）・`combo`（モック）で**4 経路のうち実際に配線を見ていたのは 1 つだけ**だった。**⇒ 値の供給元を差し替えるサブでは、経路ごとに「HTTP から実 DB まで」を 1 本ずつ通すこと**。レビュー後に 4 経路すべてへ置き直した
    11. **★`POST /api/auth/password` は検証子しか書かない**。有効化フラグ（`password_enabled`）は `PUT /api/config` の担当であり、**パスワードを決めただけでは入場ゲートは効かない**。初版はこれを配線しておらず、**パスワードを決めても何も起きない状態**だった（レビュー H-2）。⇒ 画面が 2 本を続けて呼ぶ形にした。**★順序が要る**——検証子が未設定のまま有効化すると `VAL-N03` が 422 で拒否する
    12. **★E2E のフレーキーを 5 回の実測で確認した**——3 回は 128 passed、2 回は**別々の spec** が 1 件ずつ落ちた（`m18-03a` / `m20-05`）。いずれも `PUT /api/config` 等で**共有資源を書き換える spec** であり、followup `e2e-shared-global-resource-parallel` の型そのものである。**本サブの E2E は共有状態を一切書き換えていない**（`D-399 (1)` の形）が、**恒久策の選択が未着手であることが再確認された**
    13. **★指示書 v1.2.0〜v1.5.0 とチェックリスト、ボードの `D-402`〜`D-405` が repo に存在しない**（HEAD は v1.1.0 / D-401 まで）。製造はこれらを**セッション内で直接受け取って**作業した。**⇒ 本完了報告が引く節番号は、同期されるまで repo の指示書と対応しない**。次サブの前に設計卓が同期すること（レビュー M-6）

### M22-02 手動確認ラウンド: 開発者の実機確認と反映（2026-08-16）

- **結果**: 開発者が §7.1 の 5 項目を実施し、**指摘 6 件**（質問 2 件・要修正 4 件）。**要修正 4 件を同日反映**（`7649450`）。`pnpm test` **158 files・1471 tests passed**（基線 157 / 1462）／ `make e2e` **129 passed**（基線 128）／ `tsc --noEmit` 緑 ／ `go test ./...` **変更なし**。**★`internal/` ／ `cmd/` ／ `migrations/` ／ `docs/design/` ／ `go.mod` ／ `go.sum` の diff は 0 行**（サーバ・API 契約・DB を一切変えていない）。**消費マイグレーション なし ／ 消費 CHANGE 番号 なし**
- **報告**: 完了報告 `docs/progress/m22-02-completion-report.md` §22 ／ 設計伝達レポート `docs/handover/design-reports/20260816-m22-02-manual-check-design-exceptions.md`
- **★横断課題**:
    1. **★「パスワードが分からないとき」の案内に絶対パスを出す案は、設計・製造の双方が筋を外していた**。`CHANGE-113` §3.8 は「`<config.toml の実際のパス>` ＋ コピー」を描き、製造は「設定画面なら認証済みだから出せる」と提案したが、**開発者の裁定は「そもそも出さない——パスワードが分からない人は設定画面に入れない」**。⇒ **画面ごとに「その画面へ来られる人は誰か」を先に置くと、機能の要否がその場で決まる**。副次的に、未認証で読める `GET /api/auth/status` へ `C:\Users\<名前>\...` を載せる案も消えた
    2. **★「打ち直せば済む」は照合される入力欄には成立しない**（指摘 ④）。実装は現在パスワード欄に表示切替を持たせず、コメントで「揃えようとしないこと」とまで書いていたが、**打ち間違えたとき返るのは「いまのパスワードが違います」だけで、何を打ったか確かめる手段が無い**。⇒ **新規入力欄（打ち直せばよい）と照合される入力欄（合っているかを確かめたい）は要求が違う**
    3. **★「1 人運用の画面をいままでと変えない」は API だけの話ではなかった**（指摘 ⑤）。ヘッダの利用者表示は **2 人以上のときだけ出す**形にした。`FR502`（1 人なら選択画面を出さない）と同じ考え方であり、**既存 E2E が 1 人構成のため非回帰が自動的に成立する**という実利もあった。⇒ **最重要ゲート 2 の思想は、UI にも同じ形で当てはまる**
    4. **★製造が「設計書に無い UI 要素」を足した唯一の例**（⑤ のヘッダ表示）。開発者の直接指示によるものだが、`DES-005` §2 に記述が無く、**表示条件を書き残さないと次の担当が「常に出す」に直して 1 人運用の画面を変えてしまう**。⇒ 設計伝達レポート §1-4 で条件ごと明記した
    5. **★`Header.tsx` の `NAV_LINKS` は生の日本語リテラルのまま**（13 本）。本ラウンドで足した文字列は i18n を通したが、既存分は範囲外として触っていない。⇒ 未着手
    6. **★★パスワード忘れの復旧手順が成立していなかった**（開発者の追加の問いで判明。完了報告 §22-6）。`password_enabled = false` に戻しても **`password_hash` が残るため `PasswordSet()` は true のまま**で、設定画面は「変える」を出し、`SetPassword` が**忘れた当のパスワードを要求する**（`internal/service/auth/service.go:155` は `password_enabled` を見ない）。⇒ **`password_hash` の行も消して初めて成立する**。**★誤っていた記述は 3 か所——`CHANGE-113` §3.8 ／ `config.toml.example` のコメント ／ 本ラウンドで製造が書いた案内文。設計・実装・製造が独立に同じ思い込みを写していた**。裁定は「案内文だけ直す」（振る舞い側の直しは、無効中に `POST /api/auth/password` が無認証で通るため LAN の誰でも上書きできる状態を作る）。⇒ **「アプリからは復旧できないが、ファイルを編集できれば復旧できる」型の設計は、復旧手順を実際に 1 度通してみないと成立を確認できない**。文言のテストで固定した
    7. **★パスワード入力のバリデーションが実質ゼロである**（開発者が実機で「日本語入力が通る」ことを発見・2026-08-16）。実測すると検査は **`SetPassword` の `next == ""` だけ**で、長さ・文字種・正規化・前後の空白・本文サイズがすべて素通りする（`internal/service/auth/service.go:151` ／ `trim()` は auth 配下に 0 件 ／ `BodyLimit` 未導入）。**★最も重いのは正規化のゆれ（NFC / NFD）**——検証子は受け取ったバイト列に対して計算するため（`password.go:52`）、**決めた端末と入れる端末で正規化が違うと、正しく打っているのに永久に入れない。しかも症状は「パスワードが違います」だけで原因が分からない**。**「ほかの機器から開く」ことが目的のアプリでは、これは例外経路ではなく主経路である**。⇒ **製造単独では直せない**（`DES-006` §7 の VAL 採番と `DES-002` §8 の方針決定＝日本語を許すか・正規化するか・ASCII に絞るかが先。文字種の方針は `CLAUDE.md` §10「セキュリティ関連の自己判断」に当たる）。設計伝達レポート §4-15 / §4.1 に案 4 つと実測を添えて起票を依頼した

### M22-03: 楽観排他の実効化（版の突き合わせを固定し、契約を 1 つに揃える）（2026-08-16）

- **結果**: `go test ./...` **52 パッケージすべて ok（FAIL 0）** ／ `pnpm test` **158 files・1474 tests passed** ／ `make e2e` **133 passed（failed 0）**。**消費マイグレーション 0 本**（`D-394` のとおり。`migrations/` の diff 0 行）／ **消費 CHANGE 番号 なし**（既存 `CHANGE-114` に紐づく。「次に採番する番号」＝`115` は不変）。**確定事項**——エラーコードを **`version_conflict`** に統一（`combos` 系の総称 `conflict` を `setups` 側へ揃えた＝片方だけ動かす）／ `model.ErrorCodeVersionConflict` を新設 ／ `ComboEditor` の `version: 0` フォールバックを**型で不在を表せなくする形**で除去（既定値の差し替えではない）／ **38 経路（DB へ書くもの 31 件）を §1.3 の線引きで判定し、「対象なのに版を上げていない」経路は 0 件**。**★本番コードの差分は 4 ファイル・実質 40 行未満で、残りはすべてテストである**（「固定する」サブであることの帰結）
- **報告**: 完了報告 `docs/progress/m22-03-completion-report.md` ／ レビュー `docs/progress/m22-03-review.md`
- **★横断課題**:
    1. **★破壊確認 B が 1 回目に空振りした。そしてそれが本サブ最大の発見である**——ハンドラ層 3 本の期待値に `model.ErrorCodeVersionConflict` を使っていたため、**定数の値を変えるとテストの期待値も一緒に動き、通信の契約が変わったことを検出できなかった**。**⇒ 応答本文のコードは定数参照ではなくリテラルで固定すること**。本番コードが定数を使うことと、テストがリテラルで固定することは**両立させるべき別の要求**である（前者は散在の防止、後者は契約の固定）。破壊確認を回さなければ「テストは緑・契約だけ変わる」状態で完了していた
    2. **★破壊確認 A でハンドラ層テストが赤にならなかった。代わりに守っていたのは repository / service の実 DB テストと E2E である**（`SUPP-001` §5.5 (10′)）。ハンドラ層は `mockService` を使うため実 SQL を通らず、**版の突き合わせはそもそもハンドラ層の関心ではない**——層の切り分けとして正しい状態であり「テストが弱い」ではない。**⇒ ただし E2E を置いていなければ「ハンドラ層が緑だから守られている」と読み違える余地が残った**。E2E 3 本が赤くなったことで、外せば利用者の操作が実際に通ることが示された。**M22-02 横断課題 9/10 の「モックしたハンドラテストは配線の網にならない」と同じ面である**
    3. **★指示書の実測値が 2 か所で古かった**（`E-56` の型）。**(a) 非 GET ルート「33 経路（DB へ書くもの 28 件）」→ HEAD では 38 / 30**（`M22-01` / `M22-02` が `users` 2 本・`auth` 3 本を足したため）。開発者裁定で HEAD の実測 38 件を判定対象とした。**(b) `recipe_cache` の「3 本」→ 実測 6 本**（`combos` 側 3 本 ＋ **`setups` 側 3 本**）。**⇒ `DES-003` への明記は両表について書く必要がある**。**★先行サブが as-built でルートを増やすと、後続サブの指示書に書かれた「全数」は着手時点で失効している**
    4. **★`DELETE /api/tags/:id` は `combo_tags` を `ON DELETE CASCADE` で消すため、「コンボに付いているタグ」が `combos.version` を上げずに変わる**。判定は §1.3 の線引きで「対象外」に収まる（ルート自身は `tags` にしか書かない）ため §9.3-4 の停止条件には当たらないが、**塞ぐ／塞がないは「上げる経路を増やす」判断であり設計卓の手番**。塞ぐとタグ削除のたびにそのタグが付いた全コンボの版が上がる。`FR013` によりタグ削除は作成者のみが行えるため実害の窓は狭い
    5. **★`CHANGE-114` 通知書のステータス行が実態と食い違っていた**——「起票（未承認・未反映）／承認者＝開発者（承認待ち）」のまま。**開発者は本セッションで「承認済み。設計卓の更新漏れ」と回答**し、作業はブロックしないとの裁定。**先行 2 サブ（`CHANGE-112` / `CHANGE-113`）は着手時点で通知書が更新されていたため本件だけが例外**。⇒ 通知書とボード §1.6 の M22-03 行の CHANGE 欄を設計卓が更新すること。**★指示書メタ表が「承認済みであること」を着手前ゲートにしている以上、通知書の更新漏れは着手判断を止めうる**
    6. **★エラーコードの集中定義が「版不一致 1 種類だけ定数、残り 10 コードは生リテラル」という中途の状態にある**。本サブが触る 3 箇所に限って定数化した（無関係な差分を増やさないため）。**⇒ 次に同じ不整合が起きうる面はまだ残っている**。409 を返すコードだけで実測 **10 種**（`alias_conflict` / `preset_name_duplicate` / `preset_limit_exceeded` / `preset_in_use_by_config` / `tag_name_duplicate` / `tag_in_use` / `duplicate_setup` / `combo_not_in_trash` / `rush_variant_exists` / `user_name_duplicate`）
    7. **★`scripts/check-md-emphasis.sh` の自己検査が「未実行」で NG になっていた**——`markdown-it-py` が未導入の環境だったため。**★スクリプトは緑を返さず非ゼロ終了する設計であり、正しく動いていた**（`check-artifact-integrity.sh` が拾った）。`pip install markdown-it-py` で解消。**⇒ `e2e-requires-pnpm-install-on-clean-clone` と同型の「クリーンな環境で検査が回らない」型がもう 1 件ある**
    8. **★レビューが「結論は当たっているが導出が実装を見ていない」型を 2 件見つけた**（高2・低9。往復 1 回で解消）——**`PUT /api/config` を「DB を書かない」と根拠づけていたが、`defaults.preset_id` の変更で `RecomputePresetCache` が走り `recipe_cache` へ書く**（`CHANGE-102` / `M20-05` の as-built）。判定「対象外」は `recipe_cache` が線引きの対象外であるため変わらないが、根拠は「書かない」ではなく「書くのは `recipe_cache` 列だけ」である。**⇒ 指示書 §4.2-4 が根拠を経路ごとに 1 行求めているのは、まさにこの型を防ぐためである**。**★判定表は「結論」ではなく「導出」を検査される**
    9. **★`PUT /api/combos/:id` に負けた側は 409 ではなく 404 を受け取る**（レビュー高3）。`PUT` は旧行を論理削除して新 id で採番し直すため、旧 id を握っていた文脈の `PATCH` は「`deleted_at IS NULL` の行が 0 件」となり `ErrNotFound` になる。**⇒ 「版不一致は 409 ＋ `version_conflict`」という契約の実装上の例外であり、`M22-04` が作る「他の人が編集した」体験の前提に直結する**（キー変更編集に負けた側には 409 の導線が出ない）。**実装は変更していない**——旧行はもう存在しないため 404 が正しい
    10. **★E2E の flaky が 2 回・別々の spec で出た**（1 回目＝`m18-03b-materialize` の `POST /api/combo-punishes` が 500 ／ 取り込み後の最終実行＝`m17-05c-pdf-pagination` の UI 表示）。**いずれもリトライで緑・failed は 0 件**。**★flaky になる spec が実行のたびに変わることが本サブでも再現した**——`M22-02` 横断課題 12 の実測（5 回中 2 回・別々の spec）と一致し、followup `e2e-shared-global-resource-parallel` の型そのものである。**本サブが触った 4 ファイルはどちらの経路も通らない**ため無関係と判断した。**⇒ 恒久策は依然として未着手であり、3 サブ連続で観測されている**

### M22-04: 競合したときの利用者体験（409 の見せ方・編集を失わせない導線）（2026-08-16）

- **結果**: `go test ./...` **52 パッケージ ok（FAIL 0。ほかに no test files 8 件）** ／ `pnpm test` **162 files・1538 tests passed** ／ `make e2e` **135 passed（failed 0 / flaky 1）**。**消費マイグレーション 0 本**（`migrations/` の diff 0 行。次に払い出す番号は `000078` で不変）／ **消費 CHANGE 番号 なし**（既存 `CHANGE-115` に紐づく）。**★`internal/` の diff は 0 行**（本サブは画面のサブである）。**確定事項**——**§4.4 は案 (A)**〔応答本文は `code` と `message` だけで `details` が無い〕⇒ **上書きの道は出さない** ／ 判定を `web/src/features/combo/saveError.ts` の `classifySaveError` 1 本へ集約し、**ステータスではなくエラーコードで分岐** ／ 競合モーダル `web/src/components/ConflictDialog.tsx` を新設（`AlertDialogContent` 経由のため `M21-07` の物理入力抑止に自動参加）／ **404（キー変更編集の負け側）を 409 と同じモーダルへ寄せた**〔導線は「閉じる」のみ・文言は作り直し／削除を**区別しない**〕 ／ **`duplicate_setup` を版不一致から分離**（`D-416`）
- **報告**: 完了報告 `docs/progress/m22-04-completion-report.md` ／ レビュー `docs/progress/m22-04-review.md`
- **★横断課題**:
    1. **★着手前実査で指示書の前提が 2 件外れ、設計卓の裁定で指示書が v1.4.0 へ改訂された（`D-416`）**。**(a) `version` を送る画面は 3 つではなく 4 つ**——指示書 §3.3-4 が「3 経路以外に版を送る画面が無いこと」と書き、**ルートの本数と画面の数を同一視していた**。実体は `ComboEditor`（PATCH / PUT）・`SetupEditorPage`・**`PromoteToFinalButton.tsx:49`**・**`useUpdateMyComboStatus.ts:23`** の 4 つ。**(b) `duplicate_setup` が版不一致の文言で表示されていた**（下記 2）。**⇒ 「N 経路」と書かれた数字は、経路と画面のどちらを数えたものかを実査で確かめること**
    2. **★最重要ゲート 2 が名指しした取り違えが、既存挙動として現に在った**——`web/src/features/setup/errors.ts:26` が `err.status === 409` だけで判定しており、**同一レシピ重複（`duplicate_setup`）が「他のタブで更新されています。ページを再読み込みしてやり直してください。」と版不一致の文言で出ていた**。`M22-03` が「409 の見せ方は `M22-04` の担当」として意図的にコード分岐を足さなかった帰結であり、**引き継ぎとしては正しいが、その間ずっと利用者には誤った文言が出ていた**。⇒ 本サブで分離。**巻き込まれていた他の 409 コードは実測 0 件**（セットプレイ系ルートが返す 409 は `version_conflict` と `duplicate_setup` の 2 種類だけ＝`internal/api/setup/handler.go:56/194/201`）
    3. **★`errors.test.ts` の主張を反転させた**（`Header.test.tsx` / `D-308` と同じ扱い）。旧主張「409 の分類はエラーコード文字列に依存しない」は `M22-03` の線引きを守るものだったが、**`M22-04` でその線引き自体が動いた**。**期待値を緩めるのではなく主張を作り替えた**。**⇒ 「前サブが意図して置いた主張」は、後サブで無効化されうる。テストのコメントに置いた理由が、反転の可否を判断する材料になった**
    4. **★破壊確認 A が 1 回目に空振りし、その原因はテストの主張が鈍かったことだった**——「レシピ(ステップ)も消えない」を `件数 === 1` で主張していたが、**初期値へ戻す実装では件数が変わらないため、リセットを検出できない**。**何かが代わりに守っていたのではなく、主張そのものが無力だった**（`SUPP-001` §5.5 (10′) の「別の機構が守っていた」型ではない）。⇒ 検出はキー項目でない `memo` / `damage` の 2 本が受け持つ形へ作り替え、件数の主張は「空にならない」という**別の失敗モードの網**として残した。**★「リセット」と「クリア」は別の失敗モードであり、1 つの主張で両方は見られない**
    5. **★フォームのテストで入力を作るとき、キー項目を触ると経路が変わる**——コンボ編集でステップを足すと `hasKeyChanges` が真になり、**PATCH ではなく PUT 経路（再登録の確認ダイアログ）へ分岐する**。破壊確認 A の 1 回目はこれに気づかず 15 本を巻き込んで落とした。**⇒ PATCH 経路を検証するテストの入力は、キー項目（キャラ・始動技・状況・ステップ）を避けること**
    6. **★マイコンボ状態変更の「無言の失敗」は、裁定の基準では塞ぐ対象にならなかった**（§4.2-6 不発動）。`page.route` で 409 を注入して実際に失敗させたところ、**プルダウンの表示は元の値のまま**だった——`MyComboStatusSelect` が完全な制御コンポーネントで、`useUpdateMyComboStatus` が楽観更新を持たないため。**⇒ 「無言である」ことと「嘘をつく」ことは別である**。表示は「変わっていない」という真実を示しており、DB と一致している。followup `mycombo-status-update-fails-silently` へ回した
    7. **★`M22-08` との交差点は 4 点。並列は可だが `make e2e` の固定ポートが最初に踏む**——**(1) i18n が 1 ロケール 1 ファイル**（`web/src/locales/ja.json` / `en.json`。名前空間は交わらないが末尾追記だと衝突する ⇒ 本サブは `comboDetail` と `comboEditor` の間へ ja/en 同位置で入れた） ／ **(2) `progress-log.md` の末尾**（構造的に避けられない。マージ順を人間が握ること） ／ **(3) `make e2e` のポート 47390 / 5273 は worktree を分けても分かれない**（同一マシンで 2 本同時に回せない） ／ **(4) `components/ui/` は双方とも編集しない**。**★`ja.json` / `en.json` は元から名前順に並んでおらず、指示書 §4.6 の「名前順の位置へ入れる」は厳密には実行不能だった**（目的〔末尾衝突の回避〕は満たしている）
    8. **★`M22-overview.md:108` の CHANGE 欄が実態と食い違っている**（設計卓の手番）。`115`（★起票済・未反映）のままだが、**`CHANGE-115` は 2026-08-16 に承認済み**（`D-415`。通知書側は更新済み）。**★`M22-03` 横断課題 5 が `CHANGE-114` で報告したのとまったく同型である**——通知書だけが更新され、overview / ボード / registry が取り残される。**⇒ 2 サブ連続で同じ形で起きており、「承認したら写し先を全数直す」が運用として定着していない**
    9. **★`docs/process/m22-contract.md` v1.7.0 §3.3 に `M22-08` の行が無い**（設計卓の手番）。同節は「`M22-01` 〜 `M22-05` は直列必須」と書いたままで、`M22-08` は `D-408` / `D-409` で後から新設されたため表に載っていない。**⇒ `D-413` の並列許可は両サブの指示書メタ表にしか存在しない**。契約が「ズレ検出の基準」である以上、基準側が古いとズレを検出できない
    10. **★E2E の flaky が 4 サブ連続で観測された**（本サブ＝`m19-03-setup-results` の `POST /api/combos` が 500）。リトライで緑・failed は 0 件。**`M22-03` の `m18-03b-materialize`（`POST /api/combo-punishes` が 500）と同型**であり、followup `e2e-shared-global-resource-parallel` の型そのもの。**本サブの E2E は共有状態を書き換えていない**（`D-399 (1)`）ため打てる手が無い。**⇒ `M22-01` / `M22-02` / `M22-03` / `M22-04` の 4 サブ連続。恒久策は依然として未着手**

### M22-04（追補）: 404 の行き止まりを塞ぐ（§4.7・`D-417`）（2026-08-16）

- **結果**: `go test ./...` **52 パッケージ ok（FAIL 0。★`internal/` は無変更）** ／ `pnpm test` **163 files・1571 tests passed（追補前 1561・+10 本）** ／ `make e2e` **137 passed（failed 0 / flaky 0。追補前 136・+1＝シナリオ B''）**。**消費マイグレーション 0 本 ／ 消費 CHANGE 番号 なし**。**確定事項**——404 の競合モーダルへ **「この内容で新しく登録する」**〔2 段階・既存の `runCreate()` ＝ `POST /api/combos` を再利用〕と **「コンボ一覧へ」**〔2 段階〕を追加 ／ **2 段目の確認ダイアログは 3 操作で 1 つを共用**（`E-76`。既存 `conflict-dialog-reload-confirm` 系の test-id は改名せず） ／ **重複（`VAL-C02`）は既存の `DuplicateWarning` へ落とし、新しい見せ方を作らない** ／ **★破壊確認 C（404 の導線を落とす＝v1.4.0 の状態へ戻す）で赤 9 本**、撤去後 本番コード diff 0
- **報告**: 完了報告 `docs/progress/m22-04-completion-report.md` §15 ／ レビュー `docs/progress/m22-04-review.md`
- **★横断課題**:
    1. **★「導線が出ていること」を固定しても「そこから先へ進めること」は固定されない**——これが本サブ最大の教訓である。本体は「モーダルが出る」「ボタンが 2 つある」「404 では読み込み直す導線を出さない」まで主張し、**すべて正しく、すべて緑で、レビューも通した**。それでも利用者は行き止まりに入った。**⇒ 導線のテストは存在ではなく到達可能性を主張する**。追補では §5.1-15 を「POST が叩かれる」で止めず、**E2E で `GET /api/combos/<新 id>` の `memo` を突き合わせ、サーバに実際に行ができたところまで**見る形にした
    2. **★とくに危ないのは「出せない導線がある」と正しく判断したときである**。本体の「見る先が無い」「読み込み直す先が無い」はどちらも正しかった。**正しい消去法の結果として選択肢が 0 になったことに気づく仕組みが無かった**。⇒ チェックリスト v1.3.0 §1 が「到達可能性」を最重要ゲートの筆頭へ置いた形が正しい
    3. **★実査 §4.7.1 は「既に在るか」を見る形だった**——`buildCreatePayload()` と `runCreate()` が既に在り、`POST /api/combos` を叩く経路も成功後の遷移も揃っていた。**⇒ 追補の実装は「新しく作る」ではなく「既存の経路を別の入口から呼ぶ」だけで済んだ**。**★行き止まりを塞ぐコストは、行き止まりを作ったときの見積もりより小さいことがある**（本体で「旧行が無いから導線を出せない」と判断したとき、`POST` という別の出口を検討していなかった）
    4. **★完了報告の `go test` の件数が誤っていた**（本追補で是正）。「60 パッケージ ok」と書いていたが、実測は **`ok` が 52 行・`no test files` が 8 件で合計 60 パッケージ**である。**⇒ `E-125`〔コマンド自身の出力を転記する〕を守ったつもりで、要約する過程で数字の意味を取り違えた**。**★「転記」と「要約」は別である**。要約するなら、何を数えた値かを同じ文に書くこと
    5. **★2 段目の確認が 3 操作へ増えたとき、ダイアログを共用した**（読み込み直す／新しく登録する／一覧へ）。**別々に書くと必ずドリフトする**（`E-76`）。**★ただし test-id は操作ごとに分けた**——共用したのは実装であって契約ではない。**既存の `conflict-dialog-reload-confirm` 系を改名すると E2E とコンポーネントテストの回帰になる**（`DES-005` §6.8「既存の test-id を変更・削除しない」）
### M22-08: 入場まわりの仕上げ（パスワードの検証・ログアウトの導線・利用者の改名）（2026-08-16）

- **結果**: `go test ./...` **52 パッケージすべて ok（FAIL 0）** ／ `pnpm test` **162 files・1564 tests passed** ／ `make e2e` **145 passed（failed 0・flaky 0）**（**★追補後の値**）。**消費マイグレーション 0 本**（`migrations/` の diff 0 ファイル）／ **消費 CHANGE 番号 なし**（既存 `CHANGE-119` に紐づく。「次に採番する番号」は 4 か所とも不変）。**確定事項**——`VAL-N05`＝文字種〔印字可能な ASCII のみ・半角スペースを含む〕は **400 `password_charset_invalid`** ／ `VAL-N06`＝長さ〔前後の空白を除いて 4〜128〕は **400 `password_length_invalid`** ／ `VAL-N07`＝本文サイズは **`/api/auth/*` の 4 経路に限り 8KiB・413 `request_body_too_large`**。**★検査は「決めるとき」だけに掛け、照合には掛けていない**（破壊確認 A で赤を確認 → 復旧後 diff 0）。ログアウトは設定画面へ〔`passwordRequired` が true のときだけ出す〕、改名は `UserManagement` へ〔ヘッダの利用者表示が追随する〕。**★新規依存 0 件・`go.mod` / `go.sum` の diff 0。**
- **報告**: 完了報告 `docs/progress/m22-08-completion-report.md` ／ レビュー `docs/progress/m22-08-review.md`
- **★横断課題**:
    1. **★★指示書が示唆した実装手段が、別の完了条件と衝突した**。§4.6-3 は本文サイズの上限に「Echo はミドルウェアを持つ」と示唆していたが、**`echo/v4/middleware` は `golang.org/x/time/rate` を取り込むため、採ると `go.mod` / `go.sum` に新規モジュールが載る**——同じ指示書の §2.3・§7.3・§9.3-3 が禁じている。**⇒ 標準ライブラリの `net/http.MaxBytesReader` へ寄せて解決した**（依存 0・応答封筒も本プロジェクト形式に揃う）。**★「標準の仕組みを使え」と「依存を増やすな」は、フレームワークのサブパッケージでは両立しないことがある**——`echo/v4` 本体が依存グラフに居ても、**サブパッケージを import した瞬間に新しいモジュールが増える**。**⇒ 指示書が特定の仕組みを名指しするときは、その import が依存グラフへ何を足すかまで確かめてから書くこと。**
    2. **★`DES-005` に、`CHANGE-119` の反映射程から外れる食い違いが 1 件ある**（完了報告 §9-3 の差分 5）。**§4.1 ヘッダの表**が「ユーザー表示 ／ 現在のユーザー名表示、**ログアウト（複数ユーザー時のみ）**」と書いており、as-built〔**設定画面** ／ **`passwordRequired` が true のときだけ**〕と **置き場・表示条件・利用者表示との関係の 3 点で食い違う**。**`CHANGE-119` §2-g は §5.16 への追記しか書いていないため、反映しても §4.1 は取り残される。** ⇒ **放置すると次の担当が「ログアウトはヘッダに在るはずだ」と読んで二重に作る。** 設計卓は反映時に §4.1 も併せて直すこと。**★否定形確認の走査キーワードでは「失効」として当たらない形であり、目視でしか見つからなかった**——**「無い」と書いてある記述だけでなく、「別の場所に在る」と書いてある記述も失効しうる。**
    3. **★破壊確認 A で既存テストも赤くなったが、それは網ではなかった**。`TestService_Login_IssuesDistinctSessions` と `TestService_ConcurrentAccess` が赤くなったのは、**fixture の `"pw"` がたまたま下限 4 文字を下回っていた**ためである。パスワードを 4 文字以上に直せば緑のまま通る。**⇒ 締め出しを実際に検出しているのは本サブが新設した 2 本だけである。** **★「破壊確認で N 本赤くなった」を網の厚みと読み違えないこと**——**赤くなった理由を 1 本ずつ確かめると、偶然の当たりが混じる。**
    4. **★画面側の検査を足すと、既存テストの fixture が「値として無効」になる**（完了報告 §15-1）。`PasswordForms.test.tsx` の 2 本が `newPassword: "new"`（3 文字）を使っており、**検査が正しく効いた結果として赤くなった**。**⇒ 検査を緩めず fixture を直すのが正しい**が、**「自分の変更でテストが赤くなった」ときに、実装の欠陥か fixture の失効かを毎回切り分ける必要がある。** 本件は後者だった。**★`currentPassword: "old"`（3 文字）はそのまま残した**——現在欄に検査が掛からないことを既存テストが兼ねて固定する形になり、網が 1 本増えた。
    5. **★並列相手（`M22-04`）は着手時点で走っていなかった**（ボード §1.6 が「投入待機中」・ブランチ 0 件・`docs/progress/m22-04*` 0 件）。**交差点の規律は前提として守った**が、**実際の突合はできていない**。**★`make e2e` の固定ポートは既定では衝突する**——`playwright.config.ts` は `config.toml` の `[server].port` からオフセットを導出するものの、`make e2e` は `config.toml` 不在時に `config.toml.example`（`port = 47318` 固定）をコピーするため、**どの worktree も同じ 47388 / 5271 に落ちる**。**⇒ 回避策は「その worktree の `config.toml` の `port` をずらす」の 1 行である。** 同一マシンで 2 本流すときはこれが要る。
    7. **★クリーンな環境で検査が回らない型を、本サブでも 2 件とも踏んだ**（`web/node_modules` 不在 ／ `markdown-it-py` 未導入）。**`M22-03` に続いて 2 サブ連続である**（followup `e2e-requires-pnpm-install-on-clean-clone`）。**⇒ 恒久策は依然として未着手であり、着手のたびに同じ 2 コマンドを打っている。**

    7. **★★開発者の実機確認のあとに要望が 2 件入り、うち 1 件が承認済み CHANGE の「恒久の規則」を部分的に覆した**（追補・2026-08-16。完了報告 §9-4）。**非 ASCII をログイン欄でも入力段階で落とす**という要望であり、`CHANGE-119` §2-b の「照合には掛けない・**移行の都合ではなく恒久の規則**」と正面から衝突する。**★開発者の裁定根拠は「リリース前だから既存パスワードは重要でない」であり、これは §2-b が挙げる 2 つの理由のうち①だけを解除する**——②「将来、検査の内容を変えたときも同じ問題が起きる」は残る。**⇒ ②は実装側の歯止めで潰した**〔落とすのは非 ASCII だけ・長さには連動させない ／ サーバ側は 1 行も変えない（`internal/` の diff 0）／ 入力補助と照合の検査を doc コメントで線引き〕。**★「開発者が裁定で覆した」で終わらせず、覆された規則が挙げていた理由を 1 つずつ数え直すと、残っている理由が見つかる。**
    8. **★`type="password"` に頼る設計は、表示/マスクの切替えと両立しない**（追補の診断）。日本語が入っていたのは「決めるとき」の欄だけで、**理由は表示既定（`D-396`）により `type="text"` になっていたから**である。**★IME をページ側から無効化する標準の手段は存在しない**——`ime-mode` は非標準で Firefox も 2021 年に削除済み、Chrome / Safari は元から未対応。**⇒「パスワード欄だから IME は無効になるはず」という前提はブラウザ任せであり、表示切替を持つ画面では成立しない。** 確実に効くのは値そのものを濾す方法だけである。
    9. **★IME の変換中に濾すと未確定文字列が壊れる。** `onCompositionStart` / `onCompositionEnd` で変換中かを **ref** に持ち（state だと同じイベントターン内で読めない）、**変換中は素通し・確定時に落とす**形にした。**★`InputEvent.isComposing` は採らなかった**——ブラウザ差が大きく、**jsdom では `fireEvent` の init に載せても `nativeEvent` へ伝わらない**（実測。プローブで確認）ため、テストで固定できない。**⇒ 「テストで固定できない実装」は、その時点で選択肢から外れる。**
    10. **★入力段階で落とすと、それまで書いた検査・文言・テストが「到達しない防御」に変わる**（追補）。`validateNewPassword` の `charset` 分岐と `errorCharset` の文言は、画面からは到達しなくなった。**残す判断をしたうえで、doc コメントへ「到達しない防御である。デッドコードとして消さないこと」と明記した**——サーバ側（`VAL-N05`）も同じ理由で弾くため、後ろ盾として要る。**★同型の扱いを本サブ内で 2 度行っている**（`user.rename.empty` の空名分岐が先例）。

### M22-05: CORS / CSRF の境界（LAN の他端末を塞がずに、設定変更系を守る）（2026-08-16）

- **結果**: `go vet ./...` **緑** ／ `go test ./...` **52 パッケージ ok（FAIL 0）** ／ `pnpm test` **167 files・1664 tests passed（着手前と同数）** ／ `pnpm lint`（`tsc --noEmit`）**緑** ／ `make e2e` **149 passed（flaky 0・着手前ベースラインと同数）** ／ **★開発者の実機確認（§7.1・`D-398`）実施済み・合格**（2026-08-17。スマートフォンからコンボ保存 ＋ セットプレイ登録）。**消費マイグレーション 0 本 ／ 消費 CHANGE 番号 なし**（既存 `CHANGE-116` に紐づく。「次に採番する番号」は 4 か所とも不変）。**確定事項**——**方式は案 A**（`D-423`）で、**`internal/` の CSRF 差分は 0・許可 Origin も 1 文字も変えていない**。実際に行ったのは (1) 撤回された補助対策 `X-Requested-With` の**フロント 6 経路からの撤去**、(2) 境界の契約テスト新設（`boundary_test.go` **10 本** ＋ `buildAllowedOrigins` **4 本**＝従来 0 本）、(3) `DES-002` §4.4 と as-built の差の全数確定（**既存記述への差 3 件 ＋ 書き足しが要る as-built 10 件**）。**★破壊確認 A で §5.1-3 が赤・§5.1-1／§5.1-2 は緑のまま**（＝締めすぎていない証拠）。復旧後 `cors.go` の diff は コメントのみ。
- **報告**: 完了報告 `docs/progress/m22-05-completion-report.md` ／ レビュー `docs/progress/m22-05-review.md`
- **★横断課題**:
    1. **★開発者の実機確認（§7.1・`D-398`）は 2026-08-17 に実施され合格した**（完了報告 §12）。「スマートフォンから開いてコンボを 1 つ保存できる」の 1 項目に加え、**セットプレイの登録も通った**（要求範囲外の追加確認）。**★これは主張を 1 段強めている**——セットプレイは `internal/api/setup/routes.go` の非 GET 経路を通るため、**登録ファイルの異なる 2 系統が LAN 端末から通った**ことになり、「その 1 経路がたまたま通った」possibility が消える。**⇒ チェックリスト §9-3 の重大は解消。** 加えて**クラウド実行環境では lan モードの起動自体ができない**——非ループバックが `192.0.2.2`（RFC 5737 の TEST-NET-1）1 本のみで、`netutil.IsPrivateIPv4` が正しく弾くため `SelectPrimaryLANIP` が `ErrNoLANIP` を返し起動が中止される。**★これは M22-06（QR コード）にも同じ形で効く**——代表 LAN IP を要する機能はクラウド側で実測できない。設計卓は M22-06 の指示書へ、この環境制約を前提として書くこと。**★本サブで実物の代表 LAN IP に対して `buildAllowedOrigins` が働くことを確かめたのは、この手動確認だけである**（Go テスト側は許可リストを注入しており、`lan` モードの分岐は skip されている）。
    2. **★指示書が引いていた実測値が 2 つとも陳腐化していた**（followup `instruction-total-counts-stale-at-start` の 4 例目）。§1.2 の「フロントは `PUT /api/config` の 1 経路にだけ `X-Requested-With` を付与」は**実測 6 経路**（`M22-01` が `authApi.ts` へ、`M22-02` が `userApi.ts` へ「configApi と同じ」というコメント付きで複製していた）。非 GET ルート数も **41**（`/api/auth/*` を除くと 38）。**★数字そのものより、増え方が示唆的である**——**半分だけ実装された設計（付ける側だけ在り、検証する側が無い）は、copy-paste で静かに増える。** 検証が無いため増えても何も起きず、`followup csrf-design-vs-implementation-gap` として 2 年近く残っていた。
    3. **★「締めない」が正解でありうる設計判断を、実測で裏づける形が要る**。本サブは境界を 1 か所も締めなかったが、その根拠は「**本アプリにクロスオリジン経路が存在しない**」という実測である——本番（embed 配信）・dev（Vite proxy・`API_BASE=""`）・E2E・スマートフォンのすべてが同一オリジンであり、ブラウザは同一オリジン要求に CORS を適用せずプリフライトも飛ばない。**★とくに重要なのは、いま dev と E2E が動いているのが「許可外 Origin でも `next(c)` へ通す」現行実装のおかげだという点である**——Vite proxy は `changeOrigin: false` で `Origin: http://localhost:5173` を転送するが、`buildAllowedOrigins` は `:5173` を一切生成しない。**⇒ 「CORS を厳格化する」という一見無害な変更が、開発環境と E2E を同時に壊す。** 次に §4.4 を触る担当への警告として残す。
    4. **★E2E の flaky が 5 サブ連続で観測された**（本サブ＝`m18-03a-punish-mylist.spec.ts:268`。**レビュー取り込み前の 1 回のみ**）。`M22-01` / `M22-02` / `M22-03` / `M22-04` に続く。**★ただし本サブでは再現しなかった**——個別実行で緑（3/3）、着手前ベースラインで緑（149 passed）、**取り込み後の一括実行でも緑（149 passed・flaky 0）**。⇒ 本サブの変更とは無関係であり、**一括実行時にだけ再現性なく出る**。**followup `e2e-shared-global-resource-parallel` の恒久策は依然として未着手であり、5 サブ連続で同じ報告を書いている。**
    5. **★個別実行で切り分けるときは `PW_EXECUTABLE_PATH` を明示すること**（本サブで 1 度誤った赤を踏んだ）。`make e2e` は `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を設定してから `pnpm e2e` を呼ぶ（Makefile:84,95-104）が、`pnpm exec playwright test` を直接叩くとその env が渡らず、**既定の headless shell（未導入）を探して `browserType.launch: Executable doesn't exist` で落ちる**。**⇒ テストの失敗に見えるが環境の問題である。** flaky の切り分け手順としてここに残す。
    6. **★クリーンな環境で検査が回らない型を、本サブでも 2 件とも踏んだ**（`web/node_modules` 不在 ／ `markdown-it-py` 未導入）。**`M22-03` / `M22-08` に続いて 3 サブ連続**。`markdown-it-py` に至っては `M22-01` §4-5 から数えて **5 回目の再発**である。**⇒ 恒久策は依然として未着手。**
    7. **★`DES-002` §4.4 の反映で、§4.4 に「記述が無い」as-built が 10 件ある**（完了報告 §8-2）。設計卓が `CHANGE-116` を反映するとき、既存記述の書き換え 3 件だけでは足りない。**とくに #5・#6〔許可外 Origin をサーバ側でブロックしない。それは意図した設計であり、`curl` 経路と dev/E2E を守っている〕を書かないと、次の担当が「ブロックしていないのは実装漏れだ」と読んで締めに行く**——本サブが実測で「締めると壊れる」と確かめた当のものである。
    8. **★ミドルウェア列の順序を、実組立で検査できる形になっていない**（レビュー指摘・中-3。完了報告 §13.5）。本サブの契約テストは本番と同じ順序〔RequestID → Logger → CORS → Auth〕を**テスト内で再構成**しており、`cmd/combomgr/main.go:285-296` の実組立そのものは見ていない。**⇒ 誰かが Auth を CORS より前へ動かしても全テストが緑のまま通る**——そしてその壊れ方は「プリフライトが 401 になる」形で現れるため、**同一オリジンの主経路では 1 度も観測されない**（プリフライトが飛ばないため）。**★本サブで直さなかった理由**——実組立を検査するにはルータ組立を関数として切り出す必要があり、指示書 §2.2-1（認証ミドルウェアと保護対象の経路の列は `M22-01` の as-built）に抵触しうる。**⇒ 次にルータ組立を触るサブで検討すること。**

### M22-07: 取込の別名辞書の充実（`G-14b` の残り半分）（2026-08-18）

- **結果**: `go test ./...` **52 パッケージ ok（FAIL 0）** ／ `pnpm test` **167 files・1664 tests passed** ／ `make e2e` **149 passed** ／ 常設検査 5 本すべて緑（`check-artifact-integrity.sh` は `markdown-it-py` 導入後に違反なし）。**消費マイグレーション 0 本**（`000078` は**未消費**。ボード §2.2・registry §1 とも更新不要） ／ **消費 CHANGE 番号 なし**。**★確定事項——「増やす」ことができなかった。** 理由は 2 段ある。**(1) 制約が塞ぐぶん**＝`preset_aliases` は `UNIQUE (preset_id, move_id)`（`DES-003` §3.9 制約①「1 技 1 表記」）を持ち、SA / CA の **96 技は全数が `official_ja_move` に別名を持つ**ため、`SA1` を 2 本目の別名行として足せない。**(2) 規約が禁じるぶん**＝`numeric` / `srk` に空きがある **30 技は 14 の (キャラ, SA 番号) 組に属し、組サイズ 1 の空き枠は 0** である。**★制約②は塞いでいない**（`(preset_id, character_id, alias_text)` であり 1 組 1 行なら通る。空きが 1 技だけの組が 6 ある）が、**1 技だけへ素の SA 番号を与えると `DES-004` §5.5 が「両方落とす」と定めた組を 1 件に確定させる**ため入れてはならない。**空いた理由も単一原因ではない**（生成器の `unfilledReason` 別で `derived` 17 / `collision` 13）。**⇒ 入れてよい行は 0 行。** **開発者裁定（2026-08-18・Plan Mode 提示時）により、本サブは測定・分類・報告までで閉じ、投入方式は設計卓へ返す。** 成果は **(1) 基準値の実測**〔母集合 X＝(キャラ, SA 番号) **68 組が全数未解決** ／ 母集合 Y＝既存 **4286 表記が全数 1 件で解決**〕、**(2) (a)/(b) の全数分類**〔(a) 導ける＝68 組・うち投入可 **53** / 衝突 **15** ／ (b) 導けない＝**747 技・値は 0 技**〕、**(3) 契約テスト 2 本の新設**。**3 数値は (a) 0 / (b) 0 / (c) 0**（投入 0 行のため）。
- **報告**: 完了報告 `docs/progress/m22-07-completion-report.md` ／ レビュー `docs/progress/m22-07-review.md`
- **★横断課題**:
    1. **★「投入可能な行は 0 行」の根拠を、レビュー（高-1）で是正した。** 当初は「空き枠 30 も制約②で再衝突する」と書いたが**誤り**である——**制約②は 1 組 1 行なら通る**（空きが 1 技だけの組が 6 ある）。**塞いでいるのは制約ではなく `DES-004` §5.5 の規約である。** **★結論（入れてよい行は 0 行）は変わらない**が、**設計卓が投入方式 A / B / C を裁定する前提が変わる**——「制約が塞いでいる」と「規約が禁じている」では採るべき案が違いうる（例＝C 案「制約①の撤回」は、②も塞いでいるという前提では過大に見える）。**★誤りの発生経路は「件数をコメントにだけ書き、assert していなかった」ことである**（`E-136`）。**⇒ 是正として `TestM2207_EmptySlotsAreNotUsableForSANumbers` / `TestM2207_EmptySlotReasonsAreNotSingleCause` を新設し、空き枠の性質（30 / 14 組 / 空き 1 技の組 6 / **組サイズ 1 の空き枠 0**）と理由の内訳（`derived` 17 / `collision` 13）を assert の正本にした。**
    2. **★`CHANGE-118` の前提が成立しなかった。** 同通知書メタ表は「**★スキーマ変更 0 件（新テーブル・新列・制約追加なし。★既存の `preset_aliases` へ行を増やすだけである）**」と明記しているが、**制約①により行を増やせない。** **⇒ 設計卓は同通知書自身の改訂が要る**（メタ表・§3 リスク表・`DES-004` §5.7 への「1 技 1 表記であり同義語を持てない」の明記）。**★これを書かないと、次に辞書を増やす担当が本サブと同じ実査をやり直す。**
    3. **★制約①は M17-04 の時点で調べてあったが、必要な場面で引かれなかった。** `followup-backlog.md` の `G-14b` 行は「**【M20 の要件】`preset_aliases` に `alias_text` の一意制約は無い**（UNIQUE は `(preset_id, move_id)` のみ＝M17-04 が実スキーマで確認）」と**自ら記録している**。**⇒ 「調べていなかった」型ではなく「調べた結果が、それを使うべきサブの起票時に突合されなかった」型である。** followup の当該行に書かれた実測は、起票時のチェック対象になっていない。
    4. **★投入方式は 3 案とも設計判断であり、製造の手番ではない**（完了報告 §7）。**A＝逆引き専用の 4 枚目の組み込みプリセット**（`DES-004` §3.1 の改訂・管理 UI にほぼ空のプリセットが 1 枚出る）／**B＝逆引き専用の別テーブル**（スキーマ変更＝開発者承認事項）／**C＝制約①の撤回**（★`findAliasSQL` は `ORDER BY` も `LIMIT` も持たないため、代表行を選ぶ規約が同時に要る＝`DES-004` §5 に触れるため契約 F-2 の対象）。**★どの案でも 15 組は入らない**（`DES-004` §5.5 が衝突組を両方落とすため）。
    5. **★(b) は「値を決める」だけでは足りない。** 疎通確認で観測——guile の公式別名は `弱ソニックブーム` であり、利用者が書く `ソニックブーム` は**強度を含まないため弱／中／強／OD の 4 技に当たり、通称を与えても一意には定まらない。** **⇒ (b) の設計論点は「どの粒度の技へ結びつけるか」を含む。** followup `character-nickname-aliases-need-per-wave-human-input`（`M23` 候補）へ引き継ぐ。
    6. **★次のキャラ波での落ち方は変わっていない**（`DES-004` §5.4 の注記どおり）。**新キャラだけエイリアスが空になり、フォールバックで `official_ja_move` の日本語技名が出る。画面は壊れず、テストも緑。人が見る以外に発見経路が無い。** **★本サブが増やすはずだったぶんも同じ落ち方をする。** `character_data/seed-progress.md` へは**追記していない**——本サブが新しい生成規則を 1 つも作っていないため（裁定後に投入するなら、そのときに 1 行足すこと）。
    6. **★クリーンな環境で検査が回らない型を、本サブでも 2 件とも踏んだ**（`web/node_modules` 不在 ／ `markdown-it-py` 未導入）。**`M22-03` / `M22-08` / `M22-05` に続いて 4 サブ連続**、`markdown-it-py` は **6 回目の再発**である（`D-435` が恒久策を改善レーンへ割り当て済み・未着手）。**★ただし `check-md-emphasis.sh` は依存欠落時に緑を返さず「未実行」として非ゼロ終了しており、機構としては正しく動いていた。**

### M22-07b: SA 番号の逆引きを規則で解く（案 E・`M22-07` の続き）（2026-08-18）

- **結果**: `go test ./...` **53 パッケージ ok（FAIL 0）** ／ `pnpm test` **167 files・1664 tests passed** ／ `make e2e` **149 passed**（2 回目・1 回目は既知の flaky 1 件） ／ 常設検査 5 本すべて緑。**消費マイグレーション 0 本**（`000078` は**未消費**） ／ **スキーマ変更 0 件** ／ **消費 CHANGE 番号 なし**。**★確定事項——SA 番号が辞書に 1 行も足さずに解決するようになった。** `preset_aliases` の制約①（1 技 1 表記）で `M22-07` が投入 0 行に終わった問題を、**辞書ではなく規則**で解いた（開発者裁定＝案 E・**D-442**）。**母集合 X 76 通り → 確定 53 / 候補どまり 15 / 該当なし 8**（`M22-07` 時点は 確定 0）。**3 数値は (a) 0 / (b) 0 / (c) 53。** 実装は **(1) `internal/sanumber` を新設して SA / CA 番号の導出規則を 1 か所へ集約**（消費者＝`seedgen` の層 A 注記 と `aliasindex` の第 3 段。`seedgen` の非公開 `saPattern` を移設）、**(2) `aliasindex.Lookup` を早期 return の 3 段構えにし、前 2 段が 1 件でも返したら第 3 段を引かない形にした**。**★多義 15 組は捨てず候補として返る**（`DES-004` §5.0.2 規約 1）。**★技通称は `D-443` で「いったん非対応・将来課題」。案 B の器も作っていない。**
- **報告**: 完了報告 `docs/progress/m22-07b-completion-report.md` ／ レビュー `docs/progress/m22-07b-review.md`
- **★横断課題**:
    1. **★破壊確認 A で `M22-07` の基準値テストが赤くならなかった**（指示書 §5.3 の但し書きに該当・要報告）。**段順を入れ替えても実データ上の答えが 1 つも変わらないため**——**素の `SA1` を `alias_text` に持つ行が実データに 1 行も無い。** ⇒ **実データだけを見る検査ではこの不変条件を主張できない。** **本サブで `TestThirdStage_DoesNotOverrideEarlierStages`（合成 fixture で段の順序そのものを主張）を足して塞いだ。** **★この 1 本が、チェックリスト §9-2「第 3 段が前 2 段より先に引かれうる形」の唯一の検出器である。消すと段順の入れ替えはどのテストでも赤くならない。**
    2. **★golden テストは接頭辞つき SA の分岐を守っていない**（破壊確認 C で実測）。**接頭辞つきの move は `is_derived=true` であり層 A へ届く前に除外されるため、注記を落としても生成 SQL が変わらない。** ⇒ **「golden が緑だから安全」と読まないこと。** 当該分岐を守っているのは `TestAliases_SAAnnotation` である。**この事実は `internal/sanumber/sanumber.go` の注記にも書いた。**
    3. **★設計卓の成果物が製造の作業ツリーから見えない形が続いている**（完了報告 §0）。**`CHANGE-120` 通知書・改訂 `DES-004`（§5.7.1〜§5.7.5）・指示書・チェックリストのいずれも本ブランチに存在しなかった**（基点 `2f472be`・設計卓は別ブランチ）。**指示書 §3.1 が必読と定めた節が読めない状態だった。** **★本サブは指示書本文が自己完結していたため止まらなかったが、自己完結していなければ止まる。** **★`M22-06` の成果物が見えなかったのと同じ形である**（`M22-07` 設計伝達レポート §4-3 の誤りの原因でもある）。**⇒ 指示書・チェックリストは製造が配置した。設計卓が自ブランチで同じパスへコミットしている場合はマージ時に衝突する。**
    4. **★`M22-07` の設計伝達レポート §4-3 は誤りである**（`M22-06` は実施済み。根拠＝`change-report-117.md` が対象サブ `M22-06`・ブランチ `claude/m22-06-implementation-plan-j5l13h` を明記し、同レポートの §7-5 / §3-2 を節番号で引用している ／ `followup-backlog` §R「`M22-06` 由来の新規論点」）。**あわせてクリーンな環境の連続回数がずれている**（`M22-07` の記載「4 サブ連続 / `markdown-it-py` 6 回目」に対し、backlog の現行記録は `M22-06` 時点で 4 サブ連続 / 6 回目 ⇒ **`M22-07` を足すと 5 サブ連続 / 7 回目**）。**★2026-08-18 に開発者が「今は何もしない」と決定済み。** 是正は投入方式の裁定後にまとめて行う想定だったが、**その裁定は本サブ（案 E）で下りたため、次の手番で処理できる。**
    5. **★`M22-07` の契約テストのうち母集合 X の 2 本を後状態へ更新した**（完了報告 §6）。**落としていない・置き換えていない**——母集合は同じままで、内訳を「確定 / 候補どまり / 該当なし」の 3 つに割って固定したため**主張はむしろ強くなっている**。**(a)(b) の番人である母集合 Y の 2 本は無改造で緑のまま。**
### M22-06: 接続用 QR コードの検証と穴埋め（`FR407`）（2026-08-18）

- **結果**: `go test ./...` **全パッケージ ok（FAIL 0・Go 側は 1 行も変更していない）** ／ `pnpm exec vitest run` **170 files・1674 tests passed**（着手前 167 / 1664 → **+3 files・+10 cases**） ／ `pnpm lint`（`tsc --noEmit`）**緑** ／ `make e2e` **153 passed**（着手前ベースライン **149 passed** → **+4**・flaky 0） ／ 機械検査は `check-artifact-integrity` / `check-browser-storage-keys` / `check-stop-discipline` / `check-md-emphasis` とも**違反なし**。**消費マイグレーション 0 本 ／ 消費 CHANGE 番号なし**（`CHANGE-117` は設計卓が 2026-08-17 に起票済み・「次に採番する番号」は 4 か所とも不変）。**確定事項**——**★穴は 1 件も無く、本番コードの差分は 0 バイトである**（`git diff f223723..HEAD` は新規テスト 4 ファイル・412 行のみ）。**§4.3 の穴の候補 4 件はすべて在否が確定した**〔1 = ボタンは `disabled` ではなく**非描画**・2 = 接続可能IP/ポート表示は**在った**・3 / 4 = 撤回済み〕。**★破壊確認 A / B とも赤を確認し、そのとき既存 20 ケース（`QRCodeModal.test.tsx` 3 ／ `SettingsSectionNetwork.test.tsx` 7 ／ `SettingsPage.test.tsx` 10）はいずれも緑のままだった。**
- **報告**: 完了報告 `docs/progress/m22-06-completion-report.md` ／ レビュー `docs/progress/m22-06-review.md`
- **★横断課題**:
    1. **★`QRCodeModal` の消費側は 2 つある。設定画面だけではない。** 否定形確認の走査（§4.9）で `web/src/features/wizard/Step06LanInfo.tsx:44` が同じモーダルへ接続 URL を渡していることが判明した。**指示書も `M22-RESEARCH-01` も、この消費側を挙げていない**——調査は「QR は実装済み」を確かめた時点で止まっており、**「どこから使われているか」は測っていなかった**。**⇒ `FR407`（接続 URL のみ・サーバ由来）は消費側ごとに守られる必要がある。片方だけ固定すると、もう片方を `window.location` から組み立てる実装へ変えても全テストが緑のまま通る。** 本サブで両方に契約テストを置いたが、**3 つ目が足されたときに気づく仕組みは無い。** 次に共有モーダルへ値を渡す実装を足す担当は、消費側の数を数え直すこと。
    2. **★`DES-005` §5.16 の「LAN共有モードON時のみ有効」は、as-built では「無効」ではなく「非描画」である。** `disabled` 属性は 1 つも無く、`{isLan && (…{lanUrl && (…<button>…)})}` の二重の条件レンダリングで DOM から消える。**⇒ 指示書 §4.3-1 が最有力の穴として挙げた「押せてモーダルが出ない無反応なボタン」は構造的に発生しない。** **★ここで `disabled` を足すと二重の守りになる**（`CHANGE-117` §5 リスク 2 が名指しで警告していた形）。設計卓は §5.16 へ「非描画である」と書くこと——**「有効/無効」と書いたままだと、次の担当が「押せてしまうのは欠陥だ」と読んで `disabled` を足す。**
    3. **★設計と as-built の差が 3 件ある**（完了報告 §10-2）。(i) **接続 URL の末尾スラッシュ**——`REQ-001` `FR407`（`requirements.md:176`）と `SUPP-001` §2.6.2 は `http://<IP>:<Port>/` と書くが、`service.go:381` の実体はスラッシュ無し（機能差は無いが §6.5-4 に該当）。(ii) **「接続可能IP/ポート表示」は代表 IP 1 件のみ**で候補一覧ではない——一方 `SUPP-001` §5.6 の起動時案内は「LAN URL **一覧**」であり、`main.go:349-353` が `ListPrivateIPv4()` で実際に一覧を出している。**画面と stdout で粒度が違う。** `ListPrivateIPv4()` は `internal/api` から一度も呼ばれておらず、画面へ一覧を出すにはサーバ側の新設が要る。(iii) **CORS と config は同じ関数を別経路で呼び、値もキャッシュも共有していない**——CORS は起動時 1 回で以後凍結・失敗すると **fatal**、`resolveNetwork` は毎リクエスト・失敗すると **warn ＋ 空**。**⇒ 稼働中に NIC が変わると `network.primaryLanIp` が凍結済みの CORS Origin から乖離しうる。** `CHANGE-117` §2-d へ「同じ関数で決まる」とだけ書くと、この非対称が落ちる。
    4. **★`CHANGE-117` §2-b と §2-c は別物である。** 同 §4-1 は「同じものである可能性がある／同じなら 1 項にまとめる」としていたが、**実査の結論は別物**——§2-b はネットワーク節の 3 行（常時見える）、§2-c は QR モーダル内の 1 行（ボタンを押さないと出ない）であり、位置も出現条件も違う。**⇒ §5.16 へは 2 項として書くのが as-built に忠実である。** なお**どちらもコピーボタンを持たない**（`web/src/features/config/` 配下に `clipboard` / `copy` / `readOnly` の出現 0 件）。
    5. **★開発者の実機確認は未了である**（完了報告 §9 に手順を記載）。**クラウド実行環境では `lan` モードでバックエンドが起動しない**ことを実測で確認した——`fatal: build allowed origins: LAN モードで起動できる IP が見つかりません…netutil: no LAN IPv4 available`。非ループバックが `192.0.2.2`（RFC 5737 TEST-NET-1）1 本のみで `IsPrivateIPv4` が正しく弾くためであり、**実装の欠陥ではない**（followup `cloud-env-cannot-start-lan-mode`。`M22-05` の予告どおり同じ形で効いた）。**⇒ QR に埋まる値を機械で実測することはできない。** チェックリスト §12.1 が「実機確認が未了なら重大ではなく未完了として扱う」と明記している。
    6. **★クリーンな環境で検査が回らない型を、本サブでも 2 件とも踏んだ**（`web/node_modules` 不在 ／ `markdown-it-py` 未導入）。**`M22-03` / `M22-08` / `M22-05` に続いて 4 サブ連続**であり、`markdown-it-py` は `M22-01` から数えて **6 回目の再発**である。**★今回わかった追加の事実**——この未導入は E2E だけの問題ではなく、**`check-artifact-integrity.sh` を赤にする**（`check-md-emphasis.sh --self-test` が依存欠落で「未実行」を返すため）。**⇒ followup `e2e-requires-pnpm-install-on-clean-clone` は E2E の前提としてのみ記録されているが、射程はもっと広い。** なお**スクリプト側は依存が無いとき緑を返さない設計になっており、正しく振る舞っている**——赤の原因は環境であってスクリプトではない。
    7. **★`M22-RESEARCH-01` の行番号は失効していた**（`E-56` の型）。同レポートは HEAD `8af2ca6` のスナップショットで、その後 `2789d11`（M21-07）と `b786540`（M22-02）が対象 2 ファイルを触っている——`QRCodeModal.tsx` は 58 → **68 行**、QR ボタンは `:96-101` → **`:99-105`**。**★停止条件（指示書 §9.3-4）には当たらない**——**成り立たなくなったのは行番号だけで、実測の中身（何が在るか）は不変だったため。** **⇒ 調査レポートを引くときは「結論」と「座標」を分けて扱うこと。座標は必ず古くなる。**
    8. **★指示書 §3.3-6 に 1 件の誤りがあった**。`UserManagement.tsx` は `web/src/features/config/` ではなく **`web/src/features/user/`** に在る（`SettingsSectionUser.tsx` から import されている）。交差の判定結論（`M22-08` とファイル交差なし）は変わらない。
    9. **★`resolveNetwork()` の `Update()` 経路が未テストである**。既存 3 テスト（`service_test.go:333` / `:353` / `:374`）はいずれも `Get()` のみを見ており、`Update()` が返す network ペイロード（`service.go:284`）を主張するテストは無い。**★§5.1-7 の範囲外のため本サブでは足していない**（同項は「既存テストが在るなら足さない」）。followup 候補として設計伝達レポート §4 へ回す。
    10. **★新規 `data-testid` を 1 つも足さなかったのは、規約と凍結の両方が効いた結果である。** `testid-convention.md` は「`getByRole` で一意に取れるなら付けない」を方針としており、QR ボタンはアクセシブル名で引ける。**加えて、付けると台帳 2 か所（`DES-005` §6.8 ／ `testid-convention.md`）への追記が要り、`docs/design/` に差分が出る**——これはチェックリスト §9-7 の重大判定に当たる。**⇒ 「test-id を足すべきか」は、規約だけでなく台帳の置き場が凍結対象かどうかでも決まる。** 次に `docs/design/` 凍結下で E2E を足す担当への注意として残す。
    11. **★「既存テストは何も守っていなかった」は、`§5.1-5` には当てはまらない**（レビュー指摘・高-1 の取り込み。完了報告 §1-4b）。**製造の重複調査が `QRCodeModal.test.tsx` の 1 ファイルに閉じていた**ため、`SettingsPage.test.tsx:60` / `:67` に **QR ボタン専用のケースが 2 件ある**ことを見落としていた（`:48` の「6 セクションの合成」とは別物）。**⇒ LAN OFF 時のボタンの状態は着手前から画面層で守られていた。** **★「既存は無力だった」が成り立つのは破壊確認 A / B が対象とする §5.1 の 1〜4 だけである**——そこは実測で既存 20 ケースが緑のままだった。**★教訓は「重複調査の対象範囲を、指示書が名指ししたファイルで閉じないこと」である**——指示書 §3.3-4 は `QRCodeModal.test.tsx` の 3 ケースだけを名指ししており、**その通りに調べると調べた範囲の外は見えない。** 消費側・呼出元の層まで数え直すこと（本サブでは同じ型の見落としを §4.9 の走査が別途 1 件拾っている＝横断課題 1）。
    12. **★指示書側に版ずれが 1 件ある**（レビューが発見）。**指示書 §7.5-1 / §9.4 とチェックリスト §0.1 / §12 が「§3.3 の実査 6 項目」と書くが、§3.3 の実体は 8 項目である**（v2.1.0 で 7 へ、v2.2.0 で 8 へ増補した際に参照側が追随していない）。**製造は 8 項目すべて実査・報告しているため実害は無かった**が、**レビュー側が「6 項目」で足切りすると 2 項目が検査されないまま通る**。**⇒ 節の項目数を本文へ書き写している箇所は、増補のたびに `grep` で全数拾うこと**（`E-118` と同型）。設計卓へ回す。
    13. **★実機確認は解消した**（2026-08-18・開発者申告。完了報告 §9）。**上記 5 は「未了」と書いたが、その後の申告により覆った**——**開発者は本サブの直前の工程で (1) QR コードによるスマートフォンからのアクセス と (2) 設定画面に表示された URL からのアクセス を両方実施済みであり、いずれも成功している。** **⇒ チェックリスト §1 / §9-4 の最重要ゲートは満たされた。** **★先行工程での確認が本サブの完了時点でも有効と判断した根拠は「QR 経路のバイト同一性」である**——(a) 本サブの本番コード差分は 0 バイト、(b) QR 経路の本番コード 7 ファイルを **2026-08-16 以降に触ったコミットは 0 件**（最終変更 2026-08-15）、(c) **`resolveNetwork()` / `SelectPrimaryLANIP()`（URL 生成ロジック本体）はこの窓で一度も変わっていない**、(d) `qrModal.*` / `settings.network.*` の i18n も不変。**⇒ 検証されたバイナリと完了時点のバイナリは QR 経路について同一であり、同じ手動確認を再度当てても新しい情報は得られない。** **★この判断が成り立たなくなる条件を明記しておく**——上記 7 ファイルのいずれかが変わったら再確認が要る。**とくに `resolveNetwork()` と `SelectPrimaryLANIP()` は、壊しても `localhost` では正常に見えるため、機械の緑では代替できない**（§4.2-3 の型）。**★教訓は「実機確認の有効期間は日付ではなく、確認した経路のバイトが変わっていない範囲で決まる」ことである**——本サブは本番コード差分 0 だったため窓が閉じなかったが、1 バイトでも触っていれば同じ理屈は使えなかった。

### IMPROVE-01: クリーンなクローンで検査とテストが回る状態を作る（2026-08-19）

- **結果**: 改善レーン。**`check-artifact-integrity.sh` が「違反 1 件」から「違反なし」へ**。`node_modules` を消した状態から `make e2e` が完走（153 passed）。`go test ./...` FAIL 0 ／ `pnpm test` 1674 passed ／ `check-md-emphasis` はベースライン 436 不変。**消費した CHANGE 番号・マイグレ連番はなし。** 差分は `.claude/hooks/session-start.sh`（新規）・`.claude/settings.json`・`Makefile`・報告 2 本のみで、**本番コードと依存ファイルは 1 バイトも触っていない**。
- **報告**: 完了報告 `docs/progress/improve-01-completion-report.md` ／ レビュー `docs/progress/improve-01-review.md`
- **★横断課題**:
    1. **★`govulncheck` の失敗は 2 原因の重ね合わせだった。片方はネットワークではない。** `go install golang.org/x/vuln/cmd/govulncheck@vX` は **govulncheck 自身の `go.mod`** からツールチェーンを決めるため、**素の `go` が本体コードより古い環境では、型検査できないバイナリができる**（クラウド実行環境の素の go は **go1.24.7**。go1.26.4 は `go.mod` 由来の toolchain 自動取得でのみ現れる）。**⇒ `GOTOOLCHAIN` をプロジェクトの版へ固定しないと直らない。版を上げても直らない**（v1.7.0 でも go1.25 が降ってきて同じ結果）。**★この失敗を `scripts/app-build-supplychain-check.sh:92` は「ネットワーク/FW で vuln.go.dev に到達できない可能性」と表示する**——ロード段階の失敗と DB 取得の失敗が同じメッセージに畳まれており、**ネットワークを疑って時間を溶かす**（実際に溶かした）。**スクリプトの改修は本サブの歯止め §1.3-1 に当たるため行っていない。** 設計卓・開発者の裁定事項（完了報告 §9-4 に改修案）。**次に Go のツールを `go install` で入れる担当は、ツールチェーンの版を必ず確認すること。**
    2. **★クラウド実行環境では `vuln.go.dev` が組織の egress ポリシーで 403 である**（実測 `CONNECT tunnel failed, response 403`。pypi / proxy.golang.org / npm registry はいずれも 200）。**⇒ `govulncheck` を入れても CVE 検査は回らない。** これは claude.ai の cloud environment 設定（Network access を Custom にして `vuln.go.dev` を allowlist へ追加）で解ける**開発者の手番**であり、リポジトリ側からは設定できない。**⇒ followup `govulncheck-not-installed` は「未インストール」としては解消したが、CVE 検査が未実行である状態は続く。** 手順は完了報告 §9-1。§J へ登録済み。
    3. **★`node_modules` が揃うと、これまで黙って失敗していた既存 hook 2 本が実際に動き出す。** `post-edit-check.sh` の `tsc --noEmit`（`.ts`/`.tsx` 編集ごと）と `stop-test.sh` の `make test-web`（実測 91.7 秒）。**壊れていた品質ゲートが機能を取り戻す変化であり意図した方向だが、編集ごと・応答ごとの待ちが増える**という体感の変化がある。次に「急に遅くなった」と感じた担当は本項を見ること。
    4. **★`check-doc-inventory.sh` の TYPES 表が改善レーンの命名を拾えていない。** `IMPROVE-01-…` 形式の指示書と `improve-01-completion-report.md` が「型に無いファイル」として挙がる（同検査は常に exit 0 の情報提供型なので赤にはならない）。**本サブでは TYPES 表にも EXCEPT 表にも足していない**——`scripts/` は変更禁止領域であり、かつ `CLAUDE.md` §10.Y が「定着した型だけを昇格させる」と定めているため（改善レーンの成果物はこれが 1 件目）。**⇒ 2 件目の改善レーンが出た時点で昇格を判断すること。**
    5. **★`.codex/hooks.json` への SessionStart 同期は行っていない。** `human-notes/codex/README.md:129` は「`.claude/settings.json` の hook 変更 → `.codex/hooks.json`」を求めるが、(a) Codex に `SessionStart` 相当が在る証拠が無い（同 README の 2026-08-12 実測が列挙するのは PreToolUse / PostToolUse / Stop / SessionEnd のみ）、(b) 同 README が同期の完了条件に課す「発火の実測」がクラウドからは行えない、の 2 点による。**差分と必要な同期内容は完了報告 §9-3 に置いた。** `/sync_codex_config` の手番。§J へ登録済み。
    6. **★hook の導入結果がクラウドの環境キャッシュに載るかは未確定である。** cloud environments のドキュメントは「Setup script の完了後にスナップショット／hook は resume 含む毎セッション実行」と読め、`session-start-hook` スキル `SKILL.md:66` は「container state gets cached after the hook completes」と書いており、**両者が食い違う。** **⇒ 新規セッションを 2 本起動して 2 本目の hook が無音かを見れば決まる**（開発者の起動確認のついでに観察できる）。載らない側だった場合、Setup script 欄へ同じ 3 件を置くと毎セッションの待ちが消える（貼り付け用の本文は完了報告 §9-2）。
    7. **★本サブは「開発者の起動確認待ち」で止まっている**（指示書 §4.5-2）。**製造セッションは自分を再起動できないため、hook が壊れていないことの最終確認は開発者の手番である。** 復旧手順は完了報告 §8-2（構造指定。行番号は補助）。
    8. **★2026-08-19 追記＝起動確認は完了した（判定 OK）。** 別環境の新規セッションで hook が起動時に発火し、3 件すべてを導入したことを実測（コンテナ起動 +14 / +37 / +41 秒のファイル mtime で確認）。冪等の再実行は 0.064 秒・無音・exit 0。**⇒ 上記 7 の「起動確認待ち」は解消。** 詳細は完了報告 §13。
    9. **★`vuln.go.dev` は塞がったままである。** 一度「到達可否は environment ごとに違う」と書いたが**撤回した**。起動確認セッションの `govulncheck -version` が `No vulnerabilities found.` を返したのを到達できた証拠と誤読したのが原因で、**同コマンドはパッケージ引数が無く走査対象がゼロのため DB を引かない**——403 の環境でも同じ出力になることを再現で確認した。**⇒ 到達可否を測るなら `govulncheck ./...` を打つこと。** **★これは `check-artifact-integrity.sh` §4.1 の「成功表示は証拠ではない」と同じ型である**——**緑を返した経路が、確かめたい対象を通っていなかった。** **★誤りは実行側ではなく検証手順の側にあった**（製造が出した起動確認プロンプトが `govulncheck -version` を指定していた）。**加えて製造は自セッションで同じ出力を得ていながら `head -3` で末尾を切り落としており、矛盾に気づく機会を自分で潰していた**——**出力を切るときは、切った先に判定材料が無いことを確かめること。** 開発者は claude.ai/code の設定を一切変更していない（同日申告）ため、環境差で説明する余地もそもそも無かった。
    10. **★hook の出力は Claude からは観測できない。** 全出力を stderr に出しているため（意図した設計＝文脈を汚さない）、SessionStart で文脈へ注入される stdout には 1 行も出ない。**⇒ 「静かであること」は構造的に保証される代わりに、発火の有無を Claude に言葉で確認させることはできない。** 起動確認では**ファイルの mtime とコンテナ起動時刻の突合**で実測した。**次に同種の hook を検証する担当はこの手法を使うこと**（完了報告 §13-1）。

### M24-RESEARCH-01 `Memo_Someday` 未完行 と 繰越項目の二系統 ledger（2026-08-20）

- **結果**: 指示書 `docs/instructions/M24-RESEARCH-01-someday-and-carryover-ledger.md` v1.0.0 の軸 A〜F を **read-only・judgement-free** で実測。読んだ commit は HEAD **`e3db6a5`**、`Memo_Someday.txt` の baseline は **`5b775a1`**（`git status --porcelain` 空）。**軸 A**: マーカー付き項目 **211**（`[未]`104 / `[済]`51 / `[一部]`35 / `[調査]`10 / `[予定 M24]`9 / `[予定 M23]`1 / `[不明]`1）・未完集合 **150**・マーカー無し `・` 行 **10**（4〜13 行目）で、**設計卓の §3.2 実測値と 6 項目すべて一致**（不一致 0）。**軸 B**: 未完集合 150 ＋ `[調査]` 10 の計 **160 行に `SM-001`〜`SM-160`** を出現順で採番。**軸 C/D**: disposition は `実装` 60 ／ `返却` 52 ／ `要判断` 36 ／ `調査` 8 ／ `却下` 4（**未付与 0**）、系統 2 は **`CO-001`〜`CO-026`（26 項目）**。重複は **17 クラスタ・24 行**を代表 ID へ束ねた（束ねた側も残置）。**軸 E**: `既に解消` **0 件**（未完集合は定義上 `[済]` を除いた集合であり、2026-08-19 の再仕分けが baseline で済んでいる）／`再現不能` 0 件・**特定不能 1 件**（`SM-129`）／`要追加仕様` 6 件。**軸 F**: `実装` 60 件が触る route は **17 / 22**（`/trash` は 0）、locale 8 件、DB スキーマ変更 **0 件**、**マイグレを要する M24 項目は 0 件**（次の空きは `000078`＝`M23-overview` の記載と一致）。**`queryKey` は本番コードに 84 箇所 / 39 ファイル**。差分は本報告と本索引行の 2 ファイルのみ（**指示書 §0.2 の許可された書き込み例外 2 つ**）。
- **横断課題**:
    1. **★ドラフトの `Lnn` は「失効」ではなく決定論的に読み替えられた。** 指示書 §1.1 (c) は「locator は既にずれている」を前提に 1 件ずつの目視照合を求めていたが、**ドラフト作成時点のファイルが git に残っている**（`da5be16`・2026-08-13）。同 blob のマーカー内訳はドラフト §1.3 と完全一致（88/32/7/3/1＝131・`[調査]`8・`[済]`51）し、**`Lnn` → 当時 blob の行 → 逐語本文 → 現行行 の経路で 131/131 が解決、重複 0・`[調査]` の紛れ込み 0** だった。**⇒ 「行番号は失効した」と判断する前に、その行番号が指していた版が git に在るかを見ること**（`E-56` の型への対処法）。
    2. **★`followup-backlog` §E の 1 行に旧番号 `M23` が残存している**（`docs/handover/followup-backlog.md:169` の E2E timing flake 行＝「→ **M23（旧M20 表記を同期）** or fe-e2e 安定化サブ」）。**同じ §E の見出し行（166）は M24 へ改番済みである。** **D-386 (5)** で旧 M23 は M24 へ繰り下がり M23 はデータバージョン管理になったため、**字句どおり読むと「データバージョン管理のマイルストーンで E2E flake を直す」ことになる。** **★あわせて記録する**——`phase3-overview` v1.2.0 は「一括置換はしていない（機械置換すると新 M23 まで巻き込む）」と明記しており、**本件はその方針の副作用である**。**★この行は `grep 'M24'` では拾えない**ため、指示書 §4 D-1 の抽出条件を字句どおり適用すると落ちる（本調査は `CO-025` として収容）。
    3. **★`M23-overview` §5.3 (b) の「ゴミ箱の一覧が**新設**する `queryKey`」は as-built と食い違う。** `["combos","trash",characterId]` は `useTrashCombos.ts:7` に**既に存在**し、`useRestoreCombo.ts:17` / `usePermanentDelete.ts:17` が `["combos"]` を invalidate している。**⇒ 交差の性質は「新設キーとの衝突」ではなく「既存 4 箇所の同時改変」である。** **★同一文書群の中で as-built の認識が割れている**——`phase3-overview` §M23（254 行）は「`/trash` 画面・`restore`/`permanent` API・`deleted_at` 2 表はいずれも実在する」と正しく書いている。
    4. **★M23 と M24 の交差は「ゴミ箱の一覧」ではなく「削除の入口」で起きる。** `/trash` の実装は `pages/TrashPage.tsx` ＋ `Trash*` 3 部品 ＋ hooks 3 本 ＋ `Header.tsx` / `router.tsx` に閉じており **`ComboListPage.tsx` / `ComboDetailPage.tsx` を参照していない**。一方 `useDeleteCombo` ＋ `DeleteComboConfirm` は **`ComboDetailPage.tsx` と `MyComboPage.tsx`** にあり、**`SM-019`（`ComboDetailPage.tsx:144`「既存から紐付け」＝`CO-002`/`E-1`）・`SM-041`（`MyComboPage.tsx` の `INITIAL_CHARACTER_ID`＝`CO-001`/`E-2`）と同一ファイルである。** **⇒ 交差面は画面名でなくファイルで測ること。**
    5. **★`code-facts` §2-2 は `queryKey` の 20 箇所を取りこぼす。** 掲載 64 行に対し**本番コードの実測は 84 箇所**で、差は **(a) 変数参照 15 箇所**（`queryKey: PRESETS_KEY` 等）と **(b) `PUNISH_FINDER_KEY` / `PUNISH_LIST_KEY` の const 定義**（実体は**配列ではなく文字列定数**のため抽出パターン `_KEY = [` に合致しない）。**(a) は同資料「本資料の限界」節が予告している範囲内だが、(b) は const 表にも載っていないため案内どおり辿っても実体に届かない。** **⇒ `CO-009`（`queryKey` 統一）の規模を `code-facts` だけで見積もると 24% 過小になる。**
    6. **★「マイルストーンがクローズした」ことと「そこへ割り付けた行が処理された」ことは一致しない。** `SM-098`（確定反撃での D リバの扱い）は M18 が 2026-07-31 にクローズした後も未処理で、**M18 の指示書・完了報告のいずれにも「リバーサル」の記載がゼロ**である。同型は `SM-080`（followup `G-2` が「実機確認できるタイミング」のまま M21 完了後も未着手）にもある。**⇒ 本調査は両者を `要判断`（割付先が消えている）として ledger に載せた**（該当 4 件）。
    7. **★文面が同型でも実態は違う。** ドラフト §5.3 は `SM-092`（ポジションはデフォルトで不問）と `SM-093`（状態はデフォルトで不問）を同じ枠へ入れているが、**`position` の列挙値には「不問」が存在せず値の新設が要る**のに対し、**相手スタンスには `any` が既にあり初期値が空文字なだけ**である（2026-08-11 実査）。**⇒ 一方は列挙値の追加、他方は初期値の変更。** 本調査は `SM-092` を `要判断`、`SM-093` を `実装` とした（**ドラフト §5 全 58 行のうち仕分けが分かれたのはこの 1 件だけ**）。
    8. **★指示書 §4 E-4 の「36 行前後」は実数と 2 件ずれる**（ドラフト §5.3 の実数は **38 行**。同 §6.1 の集計欄も 38）。**本報告は 38 行すべてを確認した。** `M20-RESEARCH-01` 横断課題 2・`M21-RESEARCH-01` 横断課題 3 と同型（**指示書が書き写した件数が本体に追随していない**）。
    9. **★系統 2 の 26 項目のうち 16 項目は memo 側に対応行が無い**（`CO-003`・`CO-006`〜`CO-009`・`CO-011`・`CO-013`・`CO-015`〜`CO-019`・`CO-021`・`CO-022`・`CO-025`・`CO-026`）。**⇒ memo だけを母集団にするとこれらは検査の外に落ちる。** ドラフトが「二系統の ledger」を求めた理由がここで実測として裏付いた。
    10. **★`ja.json` / `en.json` は leaf キー 487・トップレベル 23 で一致している。** **⇒ `D-2`（`CO-026`）が扱うのはキーの欠落ではなく訳文の実データ整備である。** なお `CO-026` は **`followup-backlog` に独立行を持たない**（`G-4` のメモが「英語ロケール整備」と参照するのみ）＝`phase3-overview` §M24 のみが出所。
    11. **★指示書 §0.2 が書き込み例外 2 件を明示していたため、`M20-RESEARCH-01`（M-40）／`M21-RESEARCH-01`（M-49）で起きた「DoD と禁止表の正面衝突」は再演しなかった**（`M22-RESEARCH-01` 横断課題 12 に続き 2 本連続）。**テンプレート側の是正が効き続けている。**
    12. **★`check-md-emphasis.sh` が本報告の執筆時に 1 件を検出し、その場で是正した**（`**M14-03b 後（全キャラ seed 後）**に構築` → `**M14-03b 後**（全キャラ seed 後）に構築`）。ベースライン 436 行へ復帰済み。**★クラウド実行環境では同スクリプトが動く**（`IMPROVE-01` の SessionStart hook で `markdown-it-py` が入るため）＝followup §E の「devContainer で常に赤」の状態とは異なる。
- **報告書**: [`M24-RESEARCH-01-report.md`](M24-RESEARCH-01-report.md)（指示書 `docs/instructions/M24-RESEARCH-01-someday-and-carryover-ledger.md` v1.0.0）
### M23-RESEARCH-01: ゴミ箱・復元の実態調査（8 軸）（2026-08-20）

- **結果**: 調査サブ（read-only・judgement-free）。**実装・マイグレ・seed・設計書の差分は 0**（差分は本調査レポートと本追記の 2 ファイルのみ）。**消費 CHANGE 番号なし ／ 消費マイグレ連番なし。** 8 軸すべてを実コード・実 SQL・実テストで実査した。**確定事項**——**A: 「残日数」表示は実在する（`TrashListRow.tsx:12-22, 97-107`）が、自動完全削除を実行する機構は 0 件** ／ **B: ゴミ箱専用 API は無く `GET /api/combos?only_deleted=true` の絞り込み 1 本。queryKey は `["combos","trash",characterId]`** ／ **C: セットプレイの復元・完全削除はルート・ハンドラ・サービス・リポジトリの 4 層すべてに 0 件（`setups.deleted_at` を NULL に戻す SQL も 0 件）** ／ **D: `PATCH` / `PUT` / `PATCH setups` の 3 経路すべてが `WHERE ... AND deleted_at IS NULL` を持つ ⇒ 復元のすり抜けは構造的に起きない。復元は `version` に触れず、子には何もしていない** ／ **E: combos を読む SQL 15 本中 述語を持つ 11 / 持たない 3 / 部分 1、setups を読む SQL 14 本中 持つ 13 / 持たない 1。`hiddenCurations` の除外は `DES-005` と一致** ／ **F: `HardDelete` の明示削除は 2 表のみで残り 5 表は CASCADE 依存。`SetMaxOpenConns` は本番コードに 0 件 ⇒ `P-04` の影響下。CASCADE 依存 5 表の消滅を主張するテストは 0 件** ／ **★G: `PUT` の旧行と新行を結びつける情報は候補 (a)〜(d) すべて「無い」。`materialized_from_combo_id` は `buildComboFromInput` が設定しないため PUT 経路で常に NULL。旧行は現在ゴミ箱に出ている** ／ **H: 重複判定は `deleted_at IS NULL` を持ち削除済み行は判定の外。`recipe_hash` は列ではなく `CalcRecipeHash`（SHA-256）の計算値。復元は判定を通らない**。**★軸 G-4 / H-5（dev DB への `SELECT`）は未実査**（クラウドの使い捨てコンテナに dev DB が構造的に不在。`find /` 0 件・`.gitignore:24-27` が `*.db` を除外）。開発者が手元で回せる SQL をレポート §G-4 / §H-5 に完成形で置いた。
- **報告**: 調査レポート `docs/progress/M23-RESEARCH-01-report.md`（レビュー報告は無し＝指示書が「レビュー不要・実装差分 0」と定めているため）
- **★横断課題**:
    1. **★`materialize` の出自が `PUT` で失われる**（レポート §想定外の発見 ①）。**`internal/service/combo/service.go:1102-1123` `buildComboFromInput` の struct literal 20 フィールドに `MaterializedFromComboID` が無く、`PUT` はこの関数の戻り値を `InsertCombo` へ渡す**（`:558` → `:628` → `repository.go:310`）。**⇒ materialize 生成物を識別キー変更編集すると新行の `materialized_from_combo_id` は NULL になり、`PunishList.tsx:143` の生成元バッジが消え、`listMaterializedBaseComboIDsSQL` が基底コンボを「materialize 済み」と見なさなくなる。** **★同ファイル `:691-699` は `combo_punishes` / `combo_punish_curations` について同型の再ポイントを実装済みであり（コメント「これを行わないと識別キー変更編集で採用が silent に消える」）、`materialized_from_combo_id` だけが同じ手当てを受けていない。** `M18-03b` の領域。followup 候補 ① として設計伝達の対象。
    2. **★`architecture-patterns` §11 の一般化がセットプレイに当てはまらない**（同 ④）。同節は「論理削除された親の子は物理的に残る」「復元は親の `deleted_at` を戻せば子が繋がったまま復帰する形になりうる」と書くが、**`internal/service/setup/service.go:467-470` の `DeleteSetup` は `combo_setups` を明示的に物理削除しており（コメント「案 P1: `combo_setups` を明示的に削除（論理削除時は CASCADE 不発火）」）、`:472-475` で `recipe_cache` も消している。** **⇒ セットプレイは仮に復元 API を足しても紐付けと `recipe_cache` が戻らない。** **★コンボ側の `service.Delete`（`service.go:746-769`）は `combo_setups` を消さないため、両者は非対称である。** `M23-02` が同節を前提にすると外す。**同書は `docs/handover/` 配下のため製造は編集していない（設計卓の手番）。**
    3. **★dev DB がクラウド実行環境に構造的に存在しない**（同 followup 候補 ④）。`find / -name '*.db' -path '*combomgr*'` が 0 件、`~/.local/share/` に `combomgr/` 無し、`.gitignore:24-27` が `*.db` 系 4 パターンを除外。**⇒ 「dev DB への `SELECT`」を DoD へ入れた指示書は、クラウド実行では必ず未実査になる。** **★これは実装の欠陥ではなく指示書設計時の前提である**——`IMPROVE-01` が扱った「クリーンなクローンで検査が回らない」と同じ型で、対象が `node_modules` ではなく dev DB。**空 DB を作って回す案は採らなかった**（母集団ゼロで全件 0 になり問いに答えられず、DB ファイル生成は read-only を厳密には逸脱するため。2026-08-20 開発者判断）。
    4. **★ゴミ箱の行をクリックすると 404 に落ちる**（同 ③）。`TrashListRow.tsx:73`（行の `onClick`）と `:83`（2 列目の `<Link>`）がともに `/combos/${combo.id}` を指すが、遷移先の `GET /api/combos/:id` は `repository.go:363-364` の `WHERE id = ? AND deleted_at IS NULL` で締め出し、`handler.go:114-116` が 404 を返す。**`DES-005` §5.15 の「行クリック → 詳細表示（読み取り専用のコンボ詳細）」が機能していない。** **★読み取り専用の詳細を出す道具（`FindByIDAllowDeleted`・`repository.go:408-431`）は既に在り、`service.PermanentDelete:805` の 1 か所でしか使われていない。** `M23-01` の要決定事項（レポート §要決定事項 5）。**★実機 HTTP での 404 確認は未実施**（dev サーバ未起動。SQL の述語と 404 分岐は逐語で確認済み）。
    5. **★ゴミ箱に関する E2E は 0 本である**（全 40 spec 走査）。`grep -rln "trash\|restore\|permanent" web/e2e/` のヒット 2 本（`m22-03-optimistic-locking.spec.ts:81` / `m22-04-conflict-ux.spec.ts:45`）は**後片付けで `DELETE /api/combos/:id/permanent` を叩いているだけ**で、`/trash` 画面を開いていない。**`web/src/pages/TrashPage.test.tsx` も存在しない**（ページ層のテストは無く、配下コンポーネント／フックの 24 ケースのみ）。**⇒ ゴミ箱画面を通しで守るテストは 1 本も無い。** `M23-06` の入力。
    6. **★`only_deleted=true` は `is_draft` で絞っていない**ため、仮登録（`is_draft = 1`）の削除済みコンボもゴミ箱に並ぶ。**一方 `FindActiveByDuplicateKey` は `is_draft = 0` を持つ**（`repository.go:1033`）ため、重複判定の側では仮登録も判定の外に居る。**両者の非対称は意図の記述が無い**（判断はしていない）。
    7. **★`useRestoreCombo` / `usePermanentDelete` は共通の `fetchJSON` を使わず素の `fetch` を直接呼んでいる**（`useRestoreCombo.ts:7` / `usePermanentDelete.ts:7`）。エラー整形も両者で同一の 4 行を独自実装。**一方 `useTrashCombos.ts:9` は `fetchJSON` を使う。** **★あわせて queryKey が `["combos", filter]` / `["combos","trash",id]` / `["combos","recent"]` の 3 形に分かれ、第 2 要素の型がオブジェクトと文字列で揃っていない。** `M24-RESEARCH-01` 軸 F（queryKey 統一）の入力。
    8. **★`PermanentDelete` の前チェックがトランザクション外である**（`service.go:805-811` の `FindByIDAllowDeleted` と `DeletedAt == nil` 判定が `BeginTx`（`:813`）より前）。判定してから Tx を開くまでの間に他の利用者が復元しうる形。**在否の記述にとどめ、問題かどうかは判断していない。**
### M23-01: ゴミ箱の実態を仕様へ揃える（`PUT` が積む旧行を既定で隠す ＋ 残日数表示の撤回）（2026-08-20）

- **結果**: **マイグレ `000078` を 1 本消費**（`combos.superseded_by_combo_id INTEGER REFERENCES combos(id) ON DELETE SET NULL`。**disk 末尾 `000077` を実査してから払い出し・自採番なし**＝**D-293**）。**消費 CHANGE 番号なし**（既存 `CHANGE-121` に紐づく）。**`PUT /api/combos/:id` が新行 id 確定後・同一トランザクションで旧行へ後継 id を書き、ゴミ箱の絞り込み（`OnlyDeleted`）へ `AND superseded_by_combo_id IS NULL` を足した**（`version` / `updated_at` は不変）。**存在しない 90 日の残日数を画面から撤去**（8 列 → 7 列。定数・計算・列・ヘッダ・本文告知。**i18n キーは両ロケールとも対象 0 件**＝ゴミ箱画面は i18n を通っていない）。**テスト green**——`go test ./...` **53 packages ok / FAIL 0**（新規 14 本）／ `pnpm test` **170 files・1676 tests passed**（新規 4 本）／ `make e2e` **最終走 155 passed・flaky 0**（全走 3 回。新規 spec 2 本は毎回 green）。**マイグレは up → down → 再 up を実際に流して検算済み。** **設計書本体（`DES-002` / `DES-003` / `DES-005`）は 1 文字も編集していない**（反映は設計卓が `CHANGE-121` で行う）。**レビューの「高」2 件はいずれも採用・修正済み（不採用ゼロ）。**
- **報告**: 完了報告 [`m23-01-completion-report.md`](m23-01-completion-report.md) ／ レビュー [`m23-01-review.md`](m23-01-review.md) ／ 設計伝達 `docs/handover/design-reports/20260820-m23-01-design-exceptions.md`（指示書 `docs/instructions/M23-01-trash-as-built-and-superseded-rows.md` v1.0.0）
- **★横断課題**:
    1. **★★`parallel-board.md` §2.2 のマイグレ連番が失効している。** **§2.1 は「次に払い出すマイグレ連番 ＝ `000079`」へ更新済み**（`D-479`）**なのに、§2.2 の「次に払い出す番号」は `000078`・「disk 末尾」は `000077` のまま**（いずれも 2026-08-14・M20-06 時点の値）。**⇒ 同じ数字の写し先が 2 か所あり、片方だけが直っている**（**`E-114`** の同型）。**本サブが `000078` を消費したため、放置すると次のサブが `000078` を再払い出しして衝突する**（**D-120** が禁じる状態）。**実査値は disk 末尾 `000078` ／ 次は `000079`。** **★`parallel-board` は共有直列リソースであり製造ブランチでは触れないため、設計卓が §2.2 を戻すこと。**
    2. **★`CHANGE-121` の反映範囲に `DES-003` §5 の残骸が入っていない。** 指示書 §4.9 の否定形走査（系統③＝設計文書）で、**`docs/design/03-data-model.md:946`（§5 論理削除と復元）に「物理削除は … **ゴミ箱に90日以上保持されたレコード（設定で変更可能）**」が現存している**ことを検出した。**`CHANGE-121` の起票文が挙げているのは `DES-003` §3.4（列追加）だけであり、§5 は射程外である。** **⇒ `DES-005` §5.15 だけを撤回すると、こちらが生き残って次の担当の前提になる**（**D-458** は保持を無期限で確定させている。しかも「（設定で変更可能）」という存在しない設定項目まで書いてある）。**製造は設計書本体を編集していない。**
    3. **★「次の番号」の写し先は実査で 3 か所だった**（4 か所ではない）。**M23 には `docs/process/m23-contract.md` が存在しない**（`docs/process/` にあるのは m18-m19 / m20 / m21 / m22 の 4 本）。**⇒ M23 レーンの写し先は registry §1 ／ ボード §2.1 ／ ボード §2.4 の 3 か所で、3 か所とも「次に採番する CHANGE ＝ `122`」で一致している（ズレなし）。** **★「総数は都度実査する」という指定が実際に効いた場面である**——4 と決め打つと「1 か所見つからない」で止まる。M23 の契約ファイルを作るか否かは設計卓の判断。
    4. **★`superseded_by_combo_id` の見え方が接続依存で割れる**（`P-04` の症例）。指示書 §3.3-7 の実測として、**後継を完全削除したとき FK=ON の接続では `ON DELETE SET NULL` が発火して旧行がゴミ箱へ再び現れ、FK=OFF の接続では連鎖せず隠れたまま**になることを 2 系のテストで固定した（`internal/infra/migration/migrate_m2301_test.go`）。**設計卓の暫定「現れてよい」は FK=ON 側と一致したため実装は変えていない。** **★どちらの系でもデータは壊れない**（旧行は物理削除されず `FR601` の対象として残る）。恒久の解決は `P-04` の根治側。
    5. **★`make e2e` の並列走行で `POST /api/combos` が 500 を返す事象を観測した**（全走 3 回で **1 件 → 2 件 → 0 件**。最終走は `155 passed` の完全 green）。落ちたのは `m19-03-setup-results` F ／ `m18-03a-punish-mylist` C ／ `m18-03b-materialize` C で、**3 件とも fixture 作成の段であり spec 本体のアサーションには到達していない**（`m18-03b` C は `PUT` のテストだが、落ちたのは前段の `POST` である）。**本サブ起因ではないと判断した根拠 4 点**——3 件とも単独走では green ／ 失敗経路が本サブの触った箇所を 1 つも通らない ／ `POST` 経路への変更は INSERT の列 1 つだけで新しい文・ロック・トランザクションを足していない ／ 落ちる spec が毎回違い 3 回目は 0 件。**★ただし本サブが E2E の書き込み量を増やしたことは事実であり**（新規 spec 2 本＋その後片付け）、**競合を悪化させた可能性は否定しない。** **★「flake」と断定はしない**（`E-84` の型を避ける）。followup 候補として設計伝達レポート §4-6 へ。
    6. **★`docs/handover/code-facts.md` §10 の `combos` 列一覧が新列を含まない**（2026-08-19 生成）。本サブでは再生成していない（派生資料の再生成は独立した手番）。`check-derived-docs.sh` が変化量を出すので、**丸ごと捨てずに当該節だけ実物で確認する**運用でよい。
### M23-02: セットプレイの復元と完全削除（＋ 案 P1 の撤回と、その後始末）（2026-08-20）

- **結果**: **マイグレ消費 0 本**（`ls migrations/` 実査末尾は `000078` のまま。スキーマ変更なし）。**消費 CHANGE 番号なし**（既存 `CHANGE-122` に紐づく）。**as-built は 4 経路**——`POST /api/setups/:id/restore`（200 ＋ SetupResponse・`version` 据え置き・`recipe_cache` を同一 Tx で再計算）／ `DELETE /api/setups/:id/permanent`（204。**明示削除で `combo_setup_results` → `combo_setups` → `setup_steps` → `setups` の 4 表**。生きたコンボから参照中は **409 `setup_in_use` ＋ `details.combos`=[{id, memo}]** で拒否）／ **挙動が変わる `DELETE /api/setups/:id`**（案 P1 の撤回。`combo_setups` / `combo_setup_results` を消さなくなった）／ **`GET /api/setups?characterId=N&onlyDeleted=true`**（§3.3-7 の授権で新設）。**★引数の綴りは本経路の既存の流儀（camelCase）に揃えた**——コンボ側の `character_id` / `only_deleted` を持ち込むと同一経路内で綴りが割れる（**D-491**）。**★§4.1-6（D-491）＝撤回で壊れる不変条件に依存していた 2 ヘルパを同じサブで是正した**（`comborepo.CountComboSetupsByComboID` ／ `setuprepo.comboSetupExists`）。**テスト green**——`go test ./...` **53 packages ok / FAIL 0**（新規 24 本）／ `pnpm test` **171 files・1682 tests passed**（新規 6 本）／ `make e2e` **158 passed**（新規 spec 3 本）。**必須テスト 2 本は「是正を戻すと実際に赤くなる」ことまで確認済み。** **設計書本体（`DES-002` / `DES-005` / `DES-006`）は 1 文字も編集していない。**
- **報告**: 完了報告 [`m23-02-completion-report.md`](m23-02-completion-report.md) ／ レビュー [`m23-02-review.md`](m23-02-review.md) ／ 設計伝達 `docs/handover/design-reports/20260820-m23-02-design-exceptions.md`（指示書 `docs/instructions/M23-02-setup-restore-and-permanent-delete.md` **v1.3.0**）
- **★横断課題**:
    1. **★★指示書 v1.3.0 / チェックリスト v1.3.0 がリポジトリに入っていない状態で作業した。** 反映 commit `f9d3f7b` は本作業ツリーから到達できず（`git cat-file -t` → `Not a valid object name`）、`docs/instructions/M23-02-*.md` と `docs/instructions/reviews/M23-02-*.md` は **v1.2.0 のまま**である。`git fetch` / `git merge` は `CLAUDE.md` §10 で deny 機械強制のため製造は実行できない。**開発者判断（2026-08-20）で、添付された v1.3.0 の全文を正本として進めた**（コード変更を伴わないため）。**レビュー担当サブエージェントにも v1.3.0 の実体を正本として読ませてある。** **⇒ 取り込みは開発者・設計卓の手番として残っている。未取り込みのまま次の担当が `docs/instructions/` を開くと、§4.1-6（是正 2 か所）・§4.2-8（一覧の経路）・§4.5-5（独立テーブル）・§9.1-2 の限定が存在しない v1.2.0 を読む。**
    2. **★★`§4.1-6` の「2 か所限定」は、実装上「ヘルパ 2 本 / 症状 3 つ」になった。** 裁定（**D-491**）は (a) 引き継ぎオプションの数え上げ ／ (b) 検証結果の書き込みガード の 2 つを挙げたが、**(b) の実体である共有ヘルパ `setuprepo.comboSetupExists` には呼び元が 2 つある**——`requireComboSetupLinkTx`（裁定が挙げた症状）と **`CreateSetupLink` の冪等判定**である。**後者は、結合が無いままだとゴミ箱のセットプレイでも `exists=true` になり、後続の `SetupExistsActive` による `ErrNotFound` へ到達せず黙って成功を返す**（撤回前は行ごと消えていたため `exists=false` に落ちていた）。**⇒ 同一ヘルパ・同一不変条件であり §9.1-2 の区別（本サブの変更によって初めて挙動が変わる）に合致するためスコープ拡大ではないと判断し、ヘルパ側を直して 3 症状とも閉じた。** **★片方だけ直すと同じヘルパの 2 呼び元のうち一方だけが不変条件を回復した状態になる。** `CHANGE-122` へ写す際の数え方の確認を設計伝達レポート §2-1 で求めている。
    3. **★完全削除の前チェックをトランザクション内に置き、コンボ側と揃えなかった**（指示書 §4.3-1 の「揃えられない事情」枠）。**`M23-RESEARCH-01` §D-6 がコンボ側の前チェックを「Tx 外であり TOCTOU の窓を作る形」と実測して記録している**ため、新しい経路にその窓を最初から作らない側を採った。**⇒ 両者が非対称になった。** **コンボ側は触っていない**（§2.2-2）。既存の窓の是正は followup 候補（`setup-permanent-delete-precheck-tx`）として設計伝達レポート §4-3 / §4-6 へ。**`M23-06`（コンボ側の完全削除が CASCADE に依存している 5 表の是正）と同じ手番で揃えるのが自然に見える。**
    4. **★`change-number-registry.md` §1 の `122` 行と改訂履歴 `1.170.0` が「(1) 機能の新設 2 本」のままである**（本作業ツリーの版で実査）。**§4.2-8 で削除済み一覧の経路が加わったため 3 本である。** 設計卓から「`CHANGE-122` を 3 本へ、経路表の追記も 4 本立てへ直した（§2.1-a2）」と連絡を受けているが、**`registry` 側は本作業ツリーの版では未修正。** **⇒ `E-114`（同じ数字の写し先が複数あり片方だけ直る）の同型であり、取り込み時に併せて確認が要る。** **`registry` は設計卓の手番。**
    5. **★`followup-backlog.md` の `architecture-patterns-s11-setup-exception` は解消した。** 同項は「`architecture-patterns` §11 の一般化がセットプレイに当てはまらない」と記録していたが、**本サブが案 P1 を撤回して `combo_setups` の物理削除をやめたため当てはまるようになった。** **⇒ 本項は「§11 に例外を書き足す」ではなく「例外が消えたことを §11 へ反映する」へ変わる**（`CHANGE-122` §2.3 の見立てどおり）。**同書も `followup-backlog` も設計卓の手番であり、製造は編集していない**（**D-382**）。
    6. **★`docs/handover/code-facts.md` の再生成が要る。** `internal/repository/setup/restore.go` ／ `internal/service/setup/restore.go` ／ `internal/api/setup/restore_handler.go` の 3 本が新規で、ルートも 2 本増えている。**本サブでは再生成していない**（派生資料の再生成は独立した手番であり、**設計卓の武装中には実行できない**＝実装ソースが作業ツリーに無いため）。**製造・改善セッションか開発者の手番。**
    7. **★§3.3-1 の走査で見つかった穴のうち 3 件は塞がず報告のみとした**（§9.1-2）。**`FindComboIDsBySetupID` / `FindComboIDsBySetupIDs`**（`parentComboIds` に削除済みコンボ id が混ざる。`M23-overview` §4.9 の穴 6 と同一・**`M23-03` の担当**）と、**`FindCandidateSetups` の除外副問い合わせ**（**除外方向のため安全側**）。**いずれも「本サブの変更が無くても同じ挙動」であり、§9.1-2 の区別で「他所の穴」に落ちる。** **★「壊した分は直す」を「見つけた分は直す」へ広げていない**——広げると `M23-03` が空になり担当が二重になる（**D-491** の指定）。
    8. **★`make e2e` は 158 passed で flaky 0 だった**（1 走）。`M23-01` が観測した「並列走行で `POST /api/combos` が 500 を返す事象」（同サブ横断課題 5）は**本サブの走行では再現しなかった**。**★ただし 1 走のみであり、再現しなかったことを「解消した」とは読まないこと**（`E-84` の型を避ける）。本サブも E2E の書き込み量を増やしている（新規 spec 3 本＋その後片付け）。
### M24-09a: CI の新設（PR＝高速検査 ／ nightly＝3 OS クロスビルド）と依存の棚卸し（2026-08-20）

- **結果**: **本番コード・テスト資産の diff 0 バイト。消費マイグレ連番 0 本（disk 末尾 `000077` のまま）／ 新規依存 0 件 ／ スキーマ変更なし ／ 画面の変更なし。** 消費 CHANGE ＝ **`CHANGE-129`**（設計卓が 2026-08-20 に起票済み・registry §1 登録済み ⇒ **製造側の追加登録は無い**）。**`.github/workflows/pr-checks.yml`（PR 高速検査・3 job 並列）と `.github/workflows/nightly-crossbuild.yml`（nightly 3 OS クロスビルド）を新設**（`.github/` はそれまで不在で、本サブがこのリポジトリで最初の CI 定義）＋ **README に「CI」節**（純粋な挿入・既存記述の書き換え 0）。自己テスト＝`go test -count=1 ./...` **53 ok / 9 no test files / FAIL 0**（142.2 秒）／ `pnpm test -- --run` **170 files / 1674 tests passed**（64.9 秒）／ **`make e2e` は実行していない**（本サブは E2E に触れないため。「緑」ではない）。レビュー往復 **1 回**（上限 2 回・未到達）・**高 4 / 中 9 / 低 6**・**高の不採用 0 件**・**§J 停止時記録の新規 0 件**。
- **報告**: 完了報告 [`m24-09a-completion-report.md`](m24-09a-completion-report.md) ／ レビュー [`m24-09a-review.md`](m24-09a-review.md)（**末尾に自動トリアージの採否記録あり**） ／ 設計伝達レポート `docs/handover/design-reports/20260820-m24-09a-design-exceptions.md`
- **★横断課題**:
    1. **★両ワークフローは 1 度も実行されていない。DoD §5-1 / §5-2 / §5-4 は未達のまま残る。** 製造セッションから GitHub Actions を起動できず、実行結果も取得できなかった（**Actions API がエージェントプロキシで HTTP 403** ／ GitHub MCP は `.claude/settings.json` の `mcp__*` 一括 deny ／ `gh` CLI 未インストール）。**指示書 §2.3 / §9.1-3 は「実行できない場合はワークフローを書かずに停止」と定めるが、§11-1 の暫定案に従い Plan Mode で開発者へ提示し「案 B（製造が書き、実行と緑の確認は開発者の手番）」が選ばれた**（2026-08-20）。誤読対策は 3 重（両ファイル冒頭の削除条件つき `★★ 未検証 ★★` ブロック ／ README の注意書きと「初回の受入確認」5 手順 ／ 完了報告 §8 の DoD で ✗ 明示）。**⇒ 開発者が初回の緑・意図的失敗での赤・nightly の artifact を確認するまで「CI は在る」と読まないこと。** 条文側の扱い（「repo で使えない場合」へ狭めるか、「製造が観測できない場合は人の手番へ渡す」分岐を足すか）は `CHANGE-129` の as-built 確定時の論点として設計伝達レポート §2-1 へ出した。
    2. **★`.claude/hooks/stop-test.sh:26` が `-count=1` を欠いた検査を毎セッション自動で走らせている。** 同行は `make test-go` を呼び、`Makefile:63` の `test-go` は `go test ./...` である。**⇒ 結果キャッシュが効いている状態では、何も実行せずに「失敗なし」と報告しうる。** 実測（4 コア）＝`go test -count=1 ./...` **142.2 秒 / `(cached)` 0**、`go test ./...`（キャッシュ投入後）**0.385 秒 / 53/53 が `(cached)` / exit 0**。**369 倍の差で終了コードは両方 0＝終了コードでは区別できない。** **本サブが CI 側で塞いだ穴が、フック側には残っている**（`E-84` と同型で、しかもフック側のほうが日常的に踏む）。`-count=1` を欠く箇所は他に 3 つ（`Makefile:76` ／ `CLAUDE.md:410` ／ `scripts/audit-resource-scan.sh:277`）。**`.claude/hooks/` も `Makefile` も指示書 §2.1 の対象外のため本サブでは直していない。`M24-09b` の候補**（レビュー 中-7 の「`-count=1` を守る機械検査の新設」と束ねられる）。
    3. **★`parallel-board` のマイグレ連番が §2.1 と §2.4 で食い違っている**（**本サブ由来ではない**）。§2.1（L40）は「次に払い出す ＝ `000079`」（`M23-01` へ `000078` を払い出し済み＝`D-479`）だが、**§2.4 の表（L297）は「次に払い出す番号 ＝ `000078`」のまま**。disk 末尾は `000077`（`ls migrations/` で実査）。**放置すると次の消費者が `000078` を再払い出しして衝突する**（`D-120` と同型）。**★同じ型の失効は過去に 2 度起きており、これが 3 度目である**（`D-144` の是正が 2 日で再失効 ／ `M20-02` のぶんは製造のレポートが検出）。`parallel-board` は共有直列リソースのため製造は触らず、設計伝達レポート §4-3 経由で戻す。
    4. **★followup `M14-i`（MPL 依存 `hashicorp/golang-lru/v2` の非リンク確認）を実測で解消できる。** `go.sum` に v2.0.7 が居るが `go.mod` の require には無く、**`go list -deps ./cmd/combomgr` に 0 件**（`-tags=embed_web` でも 0 件）。`go mod why -m` の経路は `modernc.org/sqlite` → `modernc.org/libc` → **`modernc.org/libc.test`** → `modernc.org/ccgo/v4/lib` → 当該モジュールで、**`.test` を経由する＝`libc` 自身のテストバイナリ専用**。**⇒ MPL-2.0 のコードは配布物に含まれない。配布判定前のゲートが 1 つ外れる**（対になる `M14-h`＝LICENSE 追加・README「ライセンス: 未定」の更新は未着手のまま）。**followup の状態更新は設計卓の手番**（`D-382`）。
    5. **ベースライン計測（`20260810-ci-baseline-measurement.md`）§5 の未決 5 件の消化状況。** **未決 1（可視性と Actions の可用性・課金）＝可視性のみ解消**（**private**・個人 User アカウント・既定ブランチ `main`。可用性と課金枠は 403 で読めず未解消）／ **未決 2（ランナーの実コア数）＝未解決**（初回実行の job summary で判明する。出力するようにしてある）／ **★未決 3（`pnpm install` の所要）＝ローカルで実測した**（**cold 5.51 秒 / warm 1.48 秒**。scratchpad へ `package.json` と `pnpm-lock.yaml` だけを複製し専用 store を切って計測。**既存 `node_modules` とロックファイルには触れていない**。ただし `--ignore-scripts` 付き・プロキシ経由であり **CI の実測で置き換えること**）／ **未決 4（`internal/infra/migration` の 91.3 秒の内訳）＝未調査**（**本環境 4 コアでは 53.1 秒で、パッケージ所要 1 位は `internal/service/combo` の 81.2 秒へ替わっている**）／ **未決 5（「3 回緑」は flaky でない証明ではない）＝README「赤いときの扱い」4 に明記**（3「flaky だから再実行を既定にしない」と両立することも説明した）。
    6. **★テストパッケージ数がベースライン計測時の 46 から 62 へ増えている**（テスト有 53 ＋ `no test files` 9）。ベースライン §3 の推定はすべて 46 パッケージ時点の値である。**環境差の実測**＝24 コア温 130.2 秒 → 4 コア温 **142.2 秒**（+9%・2 コア相当の 245.6 秒より速い）／ 冷 GOCACHE の追加コストは 13 秒 → **52.2 秒**へ拡大 ／ Vitest は 24 コア 13.2 秒 → 4 コア **64.9 秒**（**Go テストよりコア数の影響が大きい**）。
    7. **依存棚卸しの結果**（増減 0 件・`indirect` → `direct` 昇格 0 件）。**禁止ライセンス 0 件。** Go は `go list -deps ./cmd/combomgr` で**配布バイナリに実際にリンクされる 21 モジュール**まで降ろして判定（MIT 9 / BSD-2-Clause 2 / BSD-3-Clause 10）。npm は宣言依存 **45 件**（MIT 40 / Apache-2.0 3 / ISC 2）＋ 推移依存 **207 件**も走査。**★`CLAUDE.md` §6 の許可リストに明示の無い区分が推移依存に 4 件**（`pako`＝MIT AND Zlib〔`pdf-lib` 経由でバンドルに入る〕／ `tslib`×2＝0BSD ／ `caniuse-lite`＝CC-BY-4.0〔ビルド時のみ〕）——**禁止にも条件付きにも当たらないが、リストに書かれていない**。**★§6「最終更新が 2 年以上前」該当 5 件**（`lumberjack.v2` 3 年 6 か月 ／ `pdf-lib` 4 年 9 か月 ／ `tailwindcss-animate` 3 年 0 か月 ／ `pkg/browser` 2 年 7 か月 ／ `clsx` 2 年 4 か月。**上流 latest の公開日で判定**したため `react` 18.3.1〔上流 latest は 19.2.8〕は意図的なピン留めとして非該当）。**いずれも判断は開発者の手番**。
    8. **★否定形確認で「記載済みとされているもの」を探す際、走査対象を絞ると偽の否定が出る。** `followup-backlog` §F の「LAN の FW・AV 既知制約（README/log 記載済）」を確認する際、**`README.md` だけを走査して「実在しない」と結論しかけた**（Plan Mode でそう提示した）。**実体は `README.txt`（配布物 README）L61 / L68-94 にあり、ログ出力（`cmd/combomgr/main.go:421-424` 日本語 ／ `:466-469` 英語）と `main_test.go:22/44/61` の検証も実在した。** **⇒ §F の記述は真であり、指示書 §4.5 の分岐「実在する場合はそのままにし、書き直さない」に従って README.md への追記は取り止めた**（誤ったまま進めていれば二重管理を作っていた）。**`find . -iname "README*"` を先に打っていれば防げた。**
    9. **★nightly の artifact は `DES-002` §11.2 の配布物そのものではない。** artifact に入るのは素のバイナリ 3 点で、§11.2 が定めるのは `combomgr-windows-amd64.zip`（中身＝`combomgr.exe` ＋ **`README.txt`**）／ `combomgr-macos-arm64.tar.gz` ／ `combomgr-linux-amd64.tar.gz` の**アーカイブ 3 点**（名称も `macos-arm64` で `darwin-arm64` ではない）。**⇒ artifact をそのまま Releases へ上げると `README.txt` を欠いた配布物が出る**——**その `README.txt` こそ横断課題 8 で実在を確認した FW/AV トラブルシューティングの本体である。** アーカイブ化と同梱は公開時の人の手番（指示書 §1.3-3）。**あわせて `DES-002` §11.1（macOS は amd64 / arm64 の両方が非公式対応）と §11.2（配布物は macos-arm64 の 1 点のみ）が食い違っており、Intel Mac 向けの成果物は nightly でも出ない**（Makefile も §11.2 に揃っている。**本サブは Makefile の構成をそのまま使ったため温存**）。
    10. **★`M23-01` との交差は 0**（`D-477` / `D-481` の並列可判定は as-built でも成立）。base commit `3aaf3e5` 時点で `M23-01` の as-built は無く、本サブの diff 3 ファイル（`.github/workflows/` 2 本 ＋ `README.md`）はいずれも `M23-01` の touched area（`migrations/000078` ／ Go サービス層・リポジトリ層テスト ／ `web/e2e/` spec ／ `ComboDetailPage.tsx` ／ ゴミ箱 UI ／ `Header.tsx` ／ `router.tsx`）に含まれない。**`web/e2e/` と Go テストの read-only も遵守**（diff 0 バイト）。
    11. **★`M24-overview` §5.2 の `E-14` 交差表が未同期。** 同表は `M24-09a` の touched area に `internal/api/config/`・`internal/service/config/`（`CO-012`）を挙げているが、**指示書 §1.3-5 は `CO-012` を `M24-09b` へ明示的に移している**（`D-481` による分解）。**製造は指示書に従い config 系 BE に一切触っていない。** 同期の可否は設計卓の判断（設計伝達レポート §2-2）。あわせて **`CO-025` の割付が「M23（旧M20 表記を同期）」のままで `D-386 (5)` の改番が未適用**（`M24-RESEARCH-01` §6① が既に指摘済み。**`grep 'M24'` では拾えない行**）。
### M24-09a: CI 初回受入確認の実測値（2026-08-22）

- **結果**: **PR checks が 2 経路とも緑で完走した**——`pull_request`（ブランチ）**5m53s** ／ `push: main`（マージ）**6m46s**。いずれも受入条件の **10 分以内**を満たす。**job 別の実測**＝`go test` **5m48s** ／ `web test (Vitest)` **4m1s** ／ `go vet + go build` **1m16s**。**★課金は job 単位・1 分未満切り上げの合算で 13 分/run**（ウォールクロックの 5m48s とは別物）。**`go test` の `(cached)` パッケージ ＝ 0**（`-count=1` が効いていることの確認）。**ランナー実コア数 ＝ 2**。**`pnpm install` の CI 実測 ＝ 6 秒**。意図的失敗テストで `go test` job が赤になることを確認（run: `32559162042`）。nightly を手動起動し `combomgr-crossbuild` に 3 点が残ることを確認（run: `32557933392`）。branch protection へ必須 check 3 件（`go vet + go build` ／ `go test` ／ `web test (Vitest)`）を登録。両ワークフローの未検証マーカーを削除。
- **報告**: 完了報告 [`m24-09a-completion-report.md`](m24-09a-completion-report.md) §8.2 の §5-1 / §5-2 / §5-4 を未達 → 達成へ更新 ／ 設計伝達レポート `docs/handover/design-reports/20260820-m24-09a-design-exceptions.md` §1-3 を訂正
- **★横断課題**:
    1. **★設計伝達レポート §1-3 の断定は誤りだった。** 同節は「リポジトリ最初のワークフローは既定ブランチに載るまで `pull_request` で拾われない」と書いたが、**実測で否定された**——`pull_request` の run（`32554255983`）は **`main` にワークフローが無い状態で起動し、緑で完走した**。**PR #87 の作成直後だけ `no runs found` だった原因は特定できていない**（`Settings → Actions → General` を開いた際に設定が保存され初期化された可能性 ／ 初回登録の時間差、のいずれか）。**⇒ 分からないことを分かったように書いたのが誤りであり、次に同型の事象が起きたら「原因未特定」のまま記録すること。**
    2. **★GitHub Actions の Node 20 deprecation 警告が全 job で出た。** `actions/checkout@v4` ／ `actions/setup-go@v5` ／ `actions/setup-node@v4` ／ `actions/cache@v4` ／ `pnpm/action-setup@v4` が `using: node20` を宣言しており、ランナーが強制的に Node 24 で実行している。**緑だが、Node 20 は 2026-09-16 にランナーから完全撤去される。** 本追記と同じ手番で最新メジャーへ更新した（`pnpm/action-setup` は Node 24 対応版の有無を実査して判断）。**★製造時のピンは訓練時点の知識に基づいており、この移行を織り込めていなかった。**
    3. **★無料枠の実消費ペースが確定した。** **13 分/run**（3 job の切り上げ合算）× 直近ペース **5.5 PR/日** × 1 PR あたり 2〜3 run ＋ nightly 約 5 分/日 ＝ **148〜220 分/日**。**private の無料枠 2,000 分は 9〜14 日で尽きる。** 尽きると workflow が止まり、**必須 check を登録済みのため PR がマージできなくなる。** 削減策は効果順に——`paths-ignore` の導入（直近 commit の 57% が `docs:`。**ただし skip した job は必須 check として pending のまま残るため受け皿 job が要る**）／ `push: main` トリガの削除（PR で同じツリーを検査済み）／ nightly を毎日から週 1 へ ／ `retention-days` を 14 から 5 へ（artifact は zip 後 32 MB/回で、14 日保持だと 448 MB ＝ 500 MB 枠の 90%）。**判断は開発者。**
### M23-03: 参照側の `deleted_at` 除外の穴を 1 件ずつ塞ぐ（＋ 削除・復元の契約を as-built で固定）（2026-08-22）

- **結果**: **`go test ./... -count=1` 全 62 パッケージ green（FAIL 0・`(cached)` 0）／ `pnpm test` 171 files・1682 tests green ／ `make e2e` 160 passed。消費マイグレ 0 本（disk 末尾 `000078` のまま）／ 消費 CHANGE ＝ `CHANGE-123`（設計卓が起票済み・登録済み）。** 6 か所を裁定どおり処理——**`#1` は塞がず理由コメントを 2 か所へ固定 ／ `#2` `#3` `#4` `#5` に述語追加 ／ `#6` を表示用 `FindLiveComboIDsBySetupID(s)` と検証用 `FindComboIDsBySetupIDAllowDeleted` へ分割し呼び出し側 7 か所を全数割り当て**。**Go テスト 12 本新設・E2E spec 1 本新設。是正を戻すと赤くなることを 6 件すべてで実測**（`#1` を塞ぐと `TestService_PermanentDelete_OK` が赤＝指示書 §4.1-2 の主張が確定）。**フロント差分 0。**
- **報告**: 完了報告 [`m23-03-completion-report.md`](m23-03-completion-report.md) ／ レビュー [`m23-03-review.md`](m23-03-review.md) ／ 設計伝達レポート `docs/handover/design-reports/20260822-m23-03-design-exceptions.md`
- **★横断課題**:
    1. **★`#3` を塞ぐ理由が指示書 §4.3-2 の記述と食い違っていた（`CHANGE-123` へ写すときに要訂正）。** 同項は「塞がないとゴミ箱のコンボが『採用済み』を主張し続ける＝利用者に誤った状態が見える」と書くが、**実査ではその状態は応答に出ていなかった**——`listAdoptedComboPunishesSQL` の本番の呼び元は `service/punishfinder/service.go:306` の 1 か所だけで、そこで作る `adoptedSet` を引くのは同じ関数が `combos.List`（既定で `deleted_at IS NULL`）で並べた生存コンボのみである。**⇒ `#4` とまったく同じ構図であり、`architecture-patterns` §11 の判断の軸では「段 2（誤った状態が見える）」ではなく「段 4（どちらでも実挙動が変わらない）」に属していた。** **裁定（塞ぐ＝D-495）は変えずに実装したが、理由は「別経路の絞り込みに守られているだけの状態の解消」へ差し替えた**（コメントにもそう書いた）。停止条件は §3.3-4（`#4`）にしか置かれていないため報告のうえ進めた。**設計卓が `DES-002` へ写す際、指示書の文面をそのまま使うと as-built と食い違う。**
    2. **★「N か所直す」の N は調査時点の値であって着手時点の値ではない（2 例目）。** `M23-RESEARCH-01` 軸 E-5 は `#6` の使用箇所を 5 か所と数えていたが、**着手時点では 7 か所**だった——`M23-02` が `ListDeletedSetups`（`service/setup/restore.go:157`）を新設して増えていた。`architecture-patterns` §11 の既存注記（`M23-02` の「1 本のヘルパに呼び元 2 つ」）と同型であり、**同節へ「呼び元の数は着手時に数え直す」の追記候補として設計伝達レポート §4-6 へ出した**（`docs/handover/` は設計卓の手番）。
    3. **★コンボ側とセットプレイ側の削除・復元が 3 点で非対称であることが逐語で確定した**（`M23-06` の入力）。**(a) 論理削除の `WHERE`**＝コンボは `WHERE id = ?`（述語なし・2 度目の DELETE も 204 で冪等・`deleted_at` を上書き）／ セットプレイは `AND deleted_at IS NULL`（2 度目は 404・上書きしない）。**(b) 完全削除の前チェックの位置**＝コンボは Tx 外 ／ セットプレイは Tx 内（`M23-02` §9 が意図的に揃えなかった箇所）。**(c) 復元は両者一致**（`AND deleted_at IS NOT NULL` → 0 行なら 404・`version` 据え置き）。**本サブでは揃えず報告に留めた**（§4.6-5）。
    4. **★`notation.ResolveSetupRecipe` に本番の呼び出し元が 0 件である。** `#5`（`setups` 側 `GetRecipeCache`）は `#2` と対で塞いだが、**参照は `setup_resolver_test.go` と `api/combo/handler_test.go` の mock のみ**で、セットプレイのレシピ文字列を返す経路は画面にも API にも無い。**撤去するか実装するかは設計判断**（followup 新規候補として設計伝達レポート §4-5 へ出した）。
    5. **★レビュー「高」指摘 1 件——失効した帰結が `M23-overview` §4.9 に残っている**（**採用済み。訂正は設計卓の手番**）。横断課題 1 と同根で、**`DES-002` を直しても `docs/instructions/M23-overview.md` §4.9 の表（`#3` 行）の「⇒ ゴミ箱のコンボが採用済みを主張し続ける」は残る。同表は `M23-04`〜`M23-06` が読む正本であり、動作は正しいためテスト・lint・型検査のいずれも緑になる**（`M19-DESIGN-08` §3.1 の `D-250` と同型）。**製造は overview・指示書を編集しないため、設計伝達レポート §4-7 へ訂正先として名指しした。** **⇒ 不採用にした「高」は 0 件。**
    6. **★`GetRecipeCache` を「キャッシュが NULL 化されたか」の観測手段に使っていた既存テストが 1 本あった。** `internal/service/notation/cache_test.go` の `TestDeleteComboCache_NullifiesCache`。`#2` を塞いだ時点で `(nil, nil)` ではなく `ErrNotFound` が返るようになり赤くなったため、**主張は変えず観測を列の直読みへ変更した**（`SELECT recipe_cache FROM combos WHERE id = ?`）。**⇒ 述語を足す変更は「その関数を観測器として使っているテスト」を壊しうる。実装側の呼び元だけでなくテスト側の呼び元も数えること。**
### M23-04: 復元時のバリデーション（落とさずに戻して警告する）（2026-08-22）

- **結果**: **`go test ./...` 53 パッケージ green（FAIL 0・テスト関数 1246 本 PASS）／ `pnpm test` 172 files・1686 tests green ／ `make e2e` 162 passed（flaky 1 ＝ `m19-03` B2・単体 8/8 緑で非回帰を確認）。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-124` は設計卓が起票）。** 復元 2 経路の成功応答へ `warnings` を新設（**変更系の応答に `warnings` を載せる実装は既存に無く、本サブが最初の実装者になった**＝§3.3-1 の実査）。**`VAL-C08` / `VAL-S03` を復元経路でも走らせ**（`VAL-S03` はインライン重複 2 か所を 1 本へ切り出し）、**`VAL-R01` / `VAL-R02` を新設**（発火条件の非対称は意図・D-494）。**作らないと決めた検証 4 件を理由付きで記録。**
- **報告**: 完了報告 [`m23-04-completion-report.md`](m23-04-completion-report.md) ／ レビュー [`m23-04-review.md`](m23-04-review.md)
- **★横断課題**:
    1. **★`VAL-D01` は実装が存在しない。** 指示書 §1.3 の表は「`character_id` が存在するキャラクターか＝`VAL-D01`・ERROR」を**既存コード**として挙げているが、`grep -rn "VAL-D01" --include=*.go internal/` のヒットは doc コメント 1 行のみで、**その役割は `VAL-C01`（コンボ）と `VAL-S01`（セットプレイ）が担っている。** 本サブでは新設していない（`characters` にアプリ操作での削除経路が無く、§4.5-2 と同じ「起こりえないことに検証を書かない」＝`E-117` に当たるため）。**★2026-08-22 決着＝設計卓の対応は不要。** `DES-006` §2.2 の `VAL-D01`〜`D03` は**仮登録（`is_draft = true`）向けの緩和ルールの記述**であり、独立実装を持つ前提ではない。**同節は `VAL-D03` について既に「独立した実装関数・定数を持たない／`VAL-Cxx` の nil スキップに畳み込まれた挙動」と明記している**（`CHANGE-060` ／ `M16-01`）。**`VAL-D01` も同型で、実体は `VAL-C01`。** ⇒ 設計伝達レポート §4-4 で閉じた。**★教訓**: 「実装が無い」を報告する前に、**同じ表の隣の行に先例注記が無いかを見る**（先に読んでいれば往復を作らずに済んだ）。
    2. **★`ValidationIssue` に `Details` を足した。共有型であり、影響先は復元 2 経路に限らない。** `omitempty` かつ復元経路以外では nil のままなので**既存の `400 validation_failed` ＋ `details.validations` の応答形は変わらない**が、**型としては全 VAL 経路が持てるようになった。** `M23-05` はこの器へ載る（衝突相手の id を `details` で返せる）。
    3. **★一括復元の警告は「件数を畳んだ 1 枚」までしか出していない**（指示書 §11-1 の暫定案）。**どの件に警告が付いたかを一覧で出す導線は作っていない**（`M23-06` / `M23-07` の担当）。応答の `details` には id が入っているため材料は揃っている。
    4. **★フロントの i18n テストで「キーをそのまま返す `t` モック」を使うと、本サブの主張は 2 つとも判定できない。** 「サーバの日本語文をそのまま出していないこと」も「件数が畳まれたこと」も、キー文字列を見ているだけでは通ってしまう（実際に一度それで空振りした）。**⇒ `restoreWarnings.test.tsx` は実 `ja.json` を引いて `{{var}}` を差し込む最小の `t` を使っている。** 副産物として翻訳キーの実在も守られる。既存の `TrashSetupListRow.test.tsx` 等はキー返しモックであり、**文面に関する主張を足すときは同じ落とし穴がある。**
    5. **★レビュー実測（`m23-04-review.md` ＋ 同書「取り込み結果（自動トリアージ）」節）＝重大 0 件・高 1 件・中 3 件・低 8 件。採否は 高 1/1 採用・中 3/3 採用・低 5/8 採用（不採用 3 件は理由を同節に記載）。★「高」指摘の不採用は 0 件（＝開発者エスカレーションの発火なし）。**
    6. **★本エントリは当初、レビュー実施前に「不採用 0 件」と断定していた**（レビュー高-1 指摘・訂正済み）。**結果的に真になったが、レビュー前に書いた断定であったこと自体が誤りである。** 原因は製造 CLI（`implement_plan_full`）が完了報告と索引行を Phase B（レビュー）より前に commit する流れにあり、**同じ形は他サブでも起こりうる。恒久是正の要否は設計卓の手番**（設計伝達レポートへ申し送り候補）。
### M23-05: 削除済み行と再登録の衝突（`VAL-C02` を変えずに、その外側へ落とさない検証を 4 件足す）（2026-08-22）

- **結果**: **`go test ./... -count=1` 53 パッケージ green（FAIL 0・テスト関数 1271 本 PASS）／ `pnpm test` 174 files・1707 tests green ／ `make e2e` 165 件中 163 passed（flaky 2 は M20 系 spec 同士の競合。根本原因まで切り分け済み＝横断課題 3）。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-125` は設計卓が起票）。** **`VAL-C14` / `VAL-S07`（登録側）と `VAL-R03` / `VAL-R04`（復元側）の 2×2 を新設**し、**`VAL-C02` / `VAL-S04` は 1 バイトも変えていない**（`internal/service/validation/combo.go` は diff が空 ／ リポジトリ 2 ファイルは削除行 0 の純粋追加）。**母集団は `VAL-C14` が `superseded_by_combo_id IS NULL`（PUT の旧行を除く）、`VAL-R03` / `VAL-R04` が `id <> ?`（復元対象自身を除く）。破壊確認 2 件とも実測で赤くなることを確認。**
- **報告**: 完了報告 [`m23-05-completion-report.md`](m23-05-completion-report.md) ／ レビュー [`m23-05-review.md`](m23-05-review.md)
- **★横断課題**:
    1. **★`scripts/check-progress-log-index.sh` は偽陽性で緑を返す（検査そのものの欠陥）。** 本サブは索引行を 1 行も書いていない状態でも**同検査が「違反なし」を返した**（レビュー高-2 で指摘され、取り込み工程で実測して確認した）。原因は、**`M23-04` のエントリ本文に「`M23-05` はこの器へ載る」という文字列が含まれており、作業 ID の出現だけを見る照合が通ってしまう**こと。**⇒ 「検査が緑でも欠落は実在する」の実例である**（`check-artifact-integrity.sh` の注記「他の検査が緑でも、その緑が信用できるとは限らない」がまさに当たった）。**恒久是正は `scripts/` の変更であり設計卓／開発者の手番**——照合を見出し行（`### <作業ID>:`）に限定する等。**★次サブ以降も、索引行の追記は検査ではなく手順で担保すること。**
    2. **★指示書 §4.2 と §4.4 が食い違っていた（`VAL-R03` の旧行除外）。`CHANGE-125` 確定前に設計卓の裁定が要る。** §4.2 の散文は「`VAL-C14` と `VAL-R03` の母集団から旧行を除く」と書くが、§4.4 の表の `VAL-R03` 行にその述語が無い。**実装は §4.4 を採った**——§4.2 が挙げる 2 つの根拠（「旧行はゴミ箱の一覧に出ず利用者が復元できない」「`PUT` のたびに警告が出る」）は**どちらも削除済み側の母集団にしか当てはまらず**、生存行を見る `VAL-R03` に述語を足すと「隠された旧行を API 直叩きで復元した」場合に**画面に見えている重複を黙って見逃す偽陰性**になるため。**★ただしチェックリスト §9 は「`VAL-C14` / `VAL-R03` の母集団に旧行が入っている」を重大の判定基準に挙げており、放置すると `DES-006` に「`VAL-R03` は旧行を除く」が書かれない状態で確定する。** 理由はコード注釈（`FindActiveByDuplicateKeyExcludingTx`）と完了報告 §4.2 に残した。**★着手時点で気づいて報告すべきだった**（レビュー高-3）。
    3. **★`make e2e` の flaky は「フレーク」ではなく再現条件の判っている競合である（M20 系 spec の担当範囲）。** `m20-04-preset-management` と `m20-05-recipe-cache-wiring` は**どちらも既定プリセット（`config` のグローバル状態）を書き換える**が、`playwright.config.ts` は `workers` を設定しておらず `fullyParallel: false` は**ファイル内の直列化しか保証しない**ため、両者が別ワーカーで同時に走る。**実測＝`--workers=1` なら 22 passed、既定の並列なら 3 failed で再現**（落ちるのはすべて `D-313` 系）。**⇒ 「再実行したら緑になった」で閉じないこと。** 恒久対応（同一ワーカーへの固定等）は M20 系 spec の担当。
    4. **★`M23-04` §1.6-2（「既存の登録・更新経路へ `warnings` を遡って足さない」）を本サブが解禁した。その結果、失効したコメントが 5 ファイルに残った。** 「`warnings` / `details` を設定するのは復元経路だけである」という命題が `internal/api/combo/dto.go` ／ `internal/api/setup/dto.go` ／ `internal/service/validation/result.go` ／ `web/src/features/combo/types.ts` ／ `web/src/features/setup/types.ts` の 5 か所で断言されたままだった（レビュー高-1・取り込みで全件是正）。**動作は正しくテスト・lint・型検査のいずれも緑になるため、人が読む以外に見つける経路が無い。** **★とくに `internal/api/combo/dto.go` は `CHANGE-125` の逐語源になりうる。** **⇒ 「器を広げる」変更は、その器を説明している全箇所を `grep` で数えてから着手すること。**
    5. **★`POST /api/setups` というルートは存在しない**（実ルートは `POST /api/combos/:comboId/setups`）。指示書 §4.1 / §2.1 の表記は略称であり、`CHANGE-125` の逐語には実ルート名で書くこと。**あわせて `VAL-S04` の応答は `409 duplicate_setup` であって `400 validation_failed` ではない。**
    6. **★`VAL-S07` / `VAL-R04` は `M23-02` 適用前に論理削除されたセットプレイを 1 件も検出できない**（当時の論理削除が `combo_setups` を DELETE していたため、JOIN で拾えない）。**⇒ dev DB で件数を数えたときに「0 件だった」の解釈を誤らせる**——検出できていないのか本当に無いのかが区別できない。`CHANGE-125` へ注記が要る。
    7. **★セットプレイ側の実データ件数は未計測のままである**（指示書 §3.3-7）。本セッションに dev DB が存在せず（`find . -name '*.db'` → 0 件）、`M23-RESEARCH-01` 追補 H-5 も `combos` / `combo_steps` しか数えていない。**推測で埋めず「数えられない」と記録した。件数は優先度を決めるだけであり、4 件とも実装済み。**
    8. **★登録応答では `validations` と `warnings` の両方に警告が載りうる**（`VAL-C03` / `VAL-C08` / `VAL-C10` / `VAL-C11` は `validations`、`VAL-C14` は `warnings`）。**同じ severity の警告が 2 経路に分かれた状態が新しく生まれている。** 実害は無いが、`DES-002` §4.2 / §4.3 へ登録経路を書き足すときに明記しないと後任が迷う（レビュー中-5）。
    10. **★★登録側の警告の文面が「実装がしないこと」を約束していた（開発者の実機確認・レビュー後に判明）。原因は文言選びではなく、指示書の目的と手段の食い違いである。** 当初の文面「作り直す代わりに復元できます」は**選べるという誤解を生む**が、警告が出る時点で**登録は完了して詳細画面へ遷移しており、選べる瞬間はどこにも無い**。**★根本原因＝指示書 §1.3 は「作り直す前に告げる ⇒ 重複そのものが減る」を目的に掲げるが、§2.1 / §4.6 が指定した手段は「保存成功後の応答に載せるトースト」である。保存後に告げるものは、定義上「作り直す前」に告げられない。** 製造は文面を**実装がしていること**ではなく**§1.3 の目的**から書いてしまった。**⇒ 文面のみ実装に合わせて是正し（ja/en ＋ Go の診断文 ＋ 回帰ガードのテスト）、保存前ダイアログは設計卓へ返した**（§1.4-2「重複を解消する導線」＝`M23-06`/`M23-07` ／ §4.6「モーダルにしない」／ チェックリスト §9 が §1.4 への踏み込みを重大としているため）。**★自動テストでは検出できない型である**——文面は翻訳キー経由で正しく描画され、テストも lint も型検査も緑になる。**実機で人が読む以外に見つける経路が無い。**
    11. **★上記の設計判断が要る点 3 つ**（`M23-06`/`M23-07` の入力）: (a) **「両方入れる」はセットプレイでは矛盾する**——同一親・同一レシピの生きたセットプレイ 2 件は `VAL-S04` が ERROR（409）で拒否している状態であり、許すと**通常の登録では作れない状態をこの導線からだけ作れる**。(b) 保存前チェックの土台は `POST /api/combos/check-duplicate` に在るが**生きた行しか見ず、セットプレイ側には同等の API が無い**。(c) **`DES-006` §11.2 は「ERROR はモーダル」であり、WARNING でモーダルを出すのは §11.1 からの逸脱**になる。
    9. **★チェックリスト §9（「§7.5 の 6 件のいずれかが完了報告に無い」＝重大）と `M23-04` 教訓 3（「レビュー結果を参照する記述はレビュー後に埋める」）が正面から衝突する。** 本サブは「意図と再開条件を書いたプレースホルダを置く」形で両立させたが、**恒久の解は指示書テンプレート側にある**（レビュー中-4 も同じ指摘）。設計卓の手番。
### M23-06: ゴミ箱の列と見せ方（同じ根から出た 2 つの症状に、逆の答えを出す）（2026-08-23）

- **結果**: **`go test ./...` 53 パッケージ green（FAIL 0）／ `pnpm test` 175 files・1752 tests green ／ `make e2e` 168 passed（FAIL 0）。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-127` は設計卓が起票）。** **コンボ表は 7 列 → 6 列（「ルート」列を撤去）、セットプレイ表は 3 列 → 4 列（選択列を追加）。** 削除済みセットプレイのレシピ文字列を `setup_steps` からサーバ側で解決し、既存 `defaultRecipe` を埋める形にした（**応答のフィールドは増やしていない**＝開発者裁定 A）。一括選択はコンボ用・セットプレイ用の 2 本の配列（案 b）。**破壊確認 5 件すべて実測で期待どおり（3 件は赤、1 件は緑のまま、取り込みで足した 2 件は赤）。**
- **報告**: 完了報告 [`m23-06-completion-report.md`](m23-06-completion-report.md) ／ レビュー [`m23-06-review.md`](m23-06-review.md)（**重大 1 件・高 4 件・中 4 件・低 6 件。採否は 高 4/4 採用・中 3/4 採用・低 4/6 採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし**）
- **★横断課題**:
    1. **★★指示書 §4.3-2 の前提が実装と食い違っていた。`ResolveSetupRecipe` は論理削除済みの行に使えない。** 内部で引く `setupRepo.GetRecipeCache` の SQL が `WHERE id = ? AND deleted_at IS NULL` であり（**`M23-03` §4.2 が「combos 側と 2 つで 1 組」として意図的に塞いだ**）、削除済み行では `ErrNotFound` になる。**⇒ `D-513`（「`resolve-setup-recipe` を撤去するか」）の決着は「撤去しない／塞ぎに触らず、計算本体を本番の経路から使う」という第三の形になった**（開発者裁定 B）。**★`ResolveSetupRecipe` 自体は依然として本番の直接呼び出し元を持たない。撤去の可否を将来また問うなら、この事実が出発点である。**
    2. **★開発者裁定 A / B（2026-08-23）は、指示書の明示的な指定を覆している。** A＝「応答にフィールドが増える」（§4.3-3）を覆し、既存 `defaultRecipe` を埋める形にした ／ B＝「`resolve-setup-recipe` の本番呼び出し元をここで作る」（§4.3-2）を覆し、読み取り専用の経路を新設した。**⇒ `CHANGE-127` の反映後に一次記録を辿れるよう、ボード登録は設計卓の手番**（設計伝達レポート §4 の候補。完了報告 §9 に置いてある）。
    3. **★`scripts/check-progress-log-index.sh` が索引行の欠落を検出できない状態が、`M23-05` に続いて 2 サブ連続で当たった。** 同スクリプトは作業 ID の文字列が本ファイル中に現れるかを見るが、**その ID は他サブの本文から「入力になる」等の文脈で既に言及されている**（`M23-06` は `M23-03`〜`M23-05` の行から 7 回）。**⇒ 自分の節が無くても緑を返す。** `M23-05` 横断課題 1 と同型であり、**同じ穴が繰り返し当たっている事実**として §J（`progress-log-index-check-false-green-recurrence`）へ登録した。**恒久是正は `scripts/` の変更であり設計卓／開発者の手番。それまでは製造 CLI Phase D の手順で担保する。**
    4. **★★テストの親が実アプリの親と違うと、実装した機能が 1 フレームも表示されないまま緑になる。** 本サブが §4.6-3 で足した「一括復元の警告の内訳」は、`onComplete()` が親（`TrashPage`）の選択状態を空にした瞬間に `TrashBulkActions` が `totalCount === 0` で `return null` するため、**実アプリでは表示されなかった**（レビュー高-1）。テストが緑だったのは `onComplete` を `vi.fn()`（no-op）にしており、**親の再描画が起きなかった**ためである。**⇒ 結果表示を主張するテストは、親と同じ「選択を空にする」動きを持つ形（`renderWithRealParent`）で書くこと。** **★同じ理由で「N 件失敗」の `role=alert` は `M23-02` 期からずっと不可視だった**——本サブの修正で同時に直った。**⇒ 「新しい要求を既存の描画経路の上に載せるとき、その経路が実際に見えているかを先に確かめる」。**
    5. **★`resolveMoveStep` の `FindPresetByID` がステップごとに走る（`N × S`）。射程外として見送り §J（`recipe-resolver-preset-lookup-per-step`）へ登録した。** **★ただし、一覧経路で resolver を通したのは本サブが最初である**——従来の一覧は `recipe_cache` から読むだけだった。**⇒ 今後 resolver を一覧経路で使うサブが増えると効いてくる。**
    6. **★警告文面の連結作法が復元側と登録側で割れた。** 本サブが復元側（`restoreWarnings.ts`）の区切り・終端を i18n キーへ移したが、登録側（`saveWarnings.ts`・`M23-05` の射程）は `" / "` の直書きのままで終端句点も付かない。**本サブでは直していない**——登録側の文面は `M23-05` が実機確認を経て確定させたばかりであり（「復元できます」の撤回）、末尾を変えるとその確定を無断で動かすことになるため。**⇒ 揃えるなら `M23-05` の系統で判断すること。**
    7. **★名前が空のセットプレイは、現在の API では作れない（`VAL-S06` が登録・更新の両方で空名を弾く）。** **⇒ ゴミ箱に並ぶ名無しの行は `VAL-S06` 導入前の既存データだけである。** 本サブ §4.3 はその既存データに効くが、**E2E から名無しの行を作れない**ため、E2E は「削除済み一覧の応答にレシピ文字列が載ること」までを見て、画面のフォールバックはコンポーネントテストで確かめている。§J（`m23-06-unnamed-setup-unreachable-by-api`）へ登録済み。**設計卓が (a) 仕様として書く / (b) E2E 用の経路を用意する を選ぶこと。**
### M23-08: 削除・完全削除のサーバ側の是正（5 つの DELETE 文より、子表の一覧のずれを検出し続けるテスト）（2026-08-23）

- **結果**: **`go test ./... -count=1` 53 パッケージ green（FAIL 0・テスト関数 1291 本 PASS）／ `pnpm test` 175 files・1752 tests green ／ `make e2e` 168 passed（FAIL 0）。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-126` は設計卓が起票）。** **`HardDelete` へ CASCADE 依存 5 表の明示削除 ＋ self-FK 2 本の NULL 化／`PermanentDelete` の前チェックを Tx 内へ／`SoftDelete` へ `deleted_at IS NULL`（2 度目も成功する契約は保つ）／引き継ぎオプションの解除対象を生きたセットプレイに限定。** **★`web/` の差分 0 バイト**（`git diff --stat cdfcf0c -- web/` が空）。**破壊確認 3 件（明示削除を 1 表分消す ／ self-FK の NULL 化を消す ／ 列挙を空にする）とも実測で赤を確認。**
- **報告**: 完了報告 [`m23-08-completion-report.md`](m23-08-completion-report.md) ／ レビュー [`m23-08-review.md`](m23-08-review.md)（**重大 0 件・高 2 件・中 3 件・低 6 件。採否は 高 2/2 採用・中 3/3 採用・低 6/6 採用＝全件採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし**）
- **★横断課題**:
    1. **★★`P-04` の影響は「発火しないことがありうる」ではなく「接続によって実際に両方起きる」だった（実測）。** 実装前の probe で、FK=ON の接続では CASCADE が発火して 5 表とも 0 件になり、FK=OFF の接続では `combo_steps` 2 行ほか 5 表すべてが残った。self-FK は **FK=ON なら完全削除そのものが `FOREIGN KEY constraint failed (787)` で落ち**、FK=OFF なら dangling が残る。**⇒ `P-04` の根治を起こすかどうかの材料は、推論ではなく実測として揃った**（`M23` のスコープ外のまま。設計卓の手番）。
    2. **★★FK=ON だけで回すテストは、明示削除を 1 行も守らない。** 破壊確認 1 で `combo_tags` の明示削除を消したとき、**`fk_on` は PASS したまま `fk_off` だけが赤**になった（CASCADE が代わりに消すため）。**⇒ CASCADE 依存を明示削除へ移す作業では、FK を適用しない生接続で回す枝が必須である。** `setups` など他表で同型の作業をするときも同じ。
    3. **★指示書 §4.5 の見立て（読み側の問題）は実測で覆った。** 落ちる機序は「読みが除外している」ではなく「**読みが除外しているものを、書き（`DELETE ... NOT IN`）が除外せずに消している**」。文言どおり読み側を緩めていたら、ゴミ箱のセットプレイがコンボ詳細画面に出て `M23-02` / `M23-03` の意図した除外を壊していた。**開発者裁定（2026-08-23・Plan Mode）で書き側の限定へ切り替えた。ボード登録は設計卓の手番。**
    4. **★`unlink_all` の値域が変わった（`DES-002` §4.2 の契約更新項目）。** 「全部外す」から「利用者に見えている（＝生きた）紐付けを全部外す」へ。**⇒ 現状、削除済みセットプレイとの紐付けを解除する手段はどの画面にも API にも無い。** 導線を将来作るかは画面の判断であり設計卓へ渡す。**あわせて `DES-002` §4.2 の非対称 2 件（削除日時の上書き・前チェックの位置）が両方とも解消した。**
    5. **★`P-04` の「今日の実害」を特定した。** タグ削除ガードの `CountUsage`（`tag/repository.go:212-219`）は結合も述語も持たないため、orphan の `combo_tags` 行がタグを「使用中」に見せ続ける。**★詰み方は「画面は 0 件と表示 → 削除を押すと 409 → `force` は表示値から決まるので送られない → 何度押しても同じ」であり、UI からは抜けられない**（`TagManagementPage.tsx:60-62`）。**API を直接叩けば `?force=true` で消せるので絶対に不可能ではない。****タグ一覧の `usage_count` は `COUNT(c.id)` なので影響しない**——同じ表を読む 2 つの経路で結論が割れる。**射程外として §J（`tag-count-usage-inflated-by-orphan-combo-tags`）へ登録。★orphan の供給源は 2 つあり、本サブが塞いだのは `combos` 経由だけである**（`tags` 削除経由は `tag/repository.go:194-196` に同型の CASCADE 依存が残る）。
    6. **★★実 DB に orphan が 19 件実在した（開発者が 2026-08-23 に読み取り専用で計測）。`P-04` の物証である。** 内訳＝`combo_oki_options` **12** ／ `combo_steps` **6** ／ `combo_tags` **1** ／ 他 4 表は 0 ／ **self-FK の dangling は 2 本とも 0**。**⇒ 静的走査と probe が示せたのは「接続によって発火したりしなかったりする」という可能性までだったが、残骸が実在するということは本番で実際に発火していなかった時期があるということである。** **★根治サブを起こすかどうかの材料が、仮定ではなく実測として揃った**（M23 のスコープ外である点は変わらない）。**★`combo_tags` の 1 件には今日の実害がある**——横断課題 5 の `CountUsage` により、**タグ 1 件が「使用中」に見えて消せない状態が今この瞬間に存在する。** **★掃除はしていない**（データを消す変更＝開発者の判断）。§J（`combos-orphan-child-rows-count-unmeasured`）を「計測済み・掃除の要否が未決」へ更新した。**★あわせて開発者が実機で任意確認を 1 件実施**——materialize 生成物を持つ基底コンボの完全削除で生成物を巻き込まないことを実データで確認済み。
    7. **★★「新規ファイルを作る」ときも、作る前に同名の存在を確かめること。** `setup_carry_trashed_test.go` を新規のつもりで `Write` したが既存ファイル（`M23-02`・`D-491` の回帰テスト）で、テスト 3 本を一度消していた。**`go test` は緑のまま通る——消えたテストは走らないだけだからである。** 気づけたのは `git diff --stat` の deletions を読んだからであり、**テスト結果・lint・型検査のいずれからも検出できない型**。完全復元のうえ新規分を別ファイルへ分離した（完了報告 §7.5）。
    8. **★`unlink_all` の解除範囲を狭めるだけでは足りず、`PUT` へ再ポイントを同時に入れる必要があった。** 入れないと `MoveSetupResultReferences` が存在しない `(新 combo_id, setup_id)` の組へ結果行を移そうとし、**FK=ON の接続でキー変更編集そのものが `FOREIGN KEY constraint failed (787)` で落ちる**（実測）。**⇒ 中間表の解除範囲を変える変更は、その表を親キーごと動かす経路と一緒に見ること。**

### M23-07: ゴミ箱の未達の導線（入口と出口をつなぐ）（2026-08-23）

- **結果**: **`go test ./...` 1287 件 green（FAIL 0・53 パッケージ）／ `pnpm test` 178 files・1773 tests green（着手前 1752 → +21）／ `make e2e` 170 passed ／ `tsc --noEmit` 緑。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-128` は設計卓が起票済み＝D-523）。** **★画面操作だけでセットプレイをゴミ箱へ入れて戻せるようになった（`M23-02` 以来 1 度も通せなかった経路）。** 読み取り専用のコンボ詳細を `GET /api/combos/{id}/deleted` ＋ 画面 `/trash/combos/:id` で新設（**`GET /api/combos/{id}` にフラグを足していない**）。完全削除の拒否から紐付けを解除できるようにし、ゴミ箱画面の日本語直書き 22 件を i18n 化、一括操作バーを画面下部の sticky へ移した。**破壊確認 3 件すべて実測で期待どおり赤。**
- **報告**: 完了報告 [`m23-07-completion-report.md`](m23-07-completion-report.md) ／ レビュー [`m23-07-review.md`](m23-07-review.md)（**重大 0 件・高 1 件・中 4 件・低 7 件。採否は 高 1/1・中 4/4・低 5/7 採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**）
- **★横断課題**:
    0. **★★「N 件」と書いたコメントを機械的に +1 すると、元から在ったずれが温存される**（レビュー高-1）。`internal/api/combo/routes.go` の「登録される N ルート」を **`10 → 11`** と増やしたが、**実数は 12 だった**。**★テスト・lint・型検査のいずれでも検出できない**——動作は正しく、数だけが嘘になる。**⇒ 「N か所」を書き換えるときは、増やす前に数え直すこと**（`architecture-patterns` §11 と同じ要求が、指示書 §3.3-8 / §3.3-10 で 2 回も出ていたのに、自分が書いた行では守れていなかった）。
    1. **★★`D-485`（「参照元コンボを列挙する専用の表示は作らない」＝`M23-02`）を本サブが上書きした。設計卓の裁定が要る。** 指示書 §4.3-1 とチェックリスト §1 / §9 が列挙を**必須**として要求しているため指示書を正とした。**設計上の理由は「拒否されたあとに紐付けを解除する導線が画面に無く、拒否された利用者が詰む」ことであり、`D-485` が想定していなかった状況である。** **⇒ 既存の否定テスト（`TrashSetupListRow.test.tsx`「拒否のとき、参照元コンボを列挙しない」）を列挙を主張するテストへ書き換え、`D-485` を根拠にしていたコメント 6 か所（`api-error.ts` ／ `model/api_error.go` ／ `model/setup.go` ×2 ／ `restore_handler.go` ／ `restore.go`）を as-built へ是正した。** **★`CHANGE-128` で `D-485` の扱い（撤回か条件付き維持か）を裁定すること。**
    2. **★★画面 URL を変えると E2E の行ロケータが広範囲に壊れる。実測 12 か所・6 spec。** ゴミ箱の遷移先を `/trash/combos/:id` へ変えたことで、`tr:has(a[href="/combos/${id}"])` の形のロケータが `M23-01` / `02` / `03` / `04` / `05` / `06` に跨って壊れた。**★指示書 §3.3-8 が数えさせたのは「画面側の遷移リンク 2 件」であり、その 2 件を直すと E2E が 12 か所壊れるという波及は数えられていない。** **⇒ 「URL を変える」変更では、画面側の参照だけでなく `href` に依存するテストの全数を先に `grep` すること。**
    3. **★設計卓の見立てと実測が 2 項目でずれた。どちらも実測を採った。** (a) **§3.3-10 実装コード内の `M23-07` 言及＝見立て 7 件・実測 11 件**（見立てが挙げていなかった 4 件は `repository.go` の 2 か所目 ／ `restore_validation_test.go` ／ `saveWarnings.unit.test.ts` ／ `m23-06-trash-columns.spec.ts` の 2 件）。(b) **§3.3-9 日本語直書き＝見立て「バー ＋ TrashPage」・実測 22 リテラル / 5 ファイル**（**`PermanentDeleteConfirm.tsx` は `t()` の使用が 0 件で丸ごと未 i18n だった**）。
    4. **★★sticky / fixed な要素を「null を返しうるコンポーネント」の外側でラップすると、空の枠だけが画面に貼り付く。** 一括操作バーを画面下部へ移す際、当初ページ側で `<div className="sticky ...">` を被せたが、`TrashBulkActions` は選択も結果も無いとき `null` を返すため**枠線だけが残った**。**⇒ sticky の指定はコンポーネント自身に持たせた。** `M23-06` 横断課題 4（「テストの親が実アプリの親と違うと 1 フレームも表示されないまま緑になる」）と同じ面での落とし穴であり、**どちらも「描画されない条件」を先に確かめていれば避けられる。**
    5. **★一括操作バーが失敗の理由を握り潰したままである（直していない・報告のみ）。** `TrashBulkActions` の `FailedItem.error` は捕捉されるが**画面に描画されない**（表示は `label` のみ）。**⇒ 一括での `409 setup_in_use` は「N 件失敗: 名前」としか出ず、理由も逃げ道も無い。** §4.3 は行単位の拒否表示を対象としており射程外と判断した。**後続サブの候補。**
    6. **★`make e2e` は毎回 1 件が flaky（リトライで成功）になる。毎回別のテストが当たる。** 2 回実行し、1 回目は `m19-03`（紐付け解除が 500）、2 回目は `m17-05b`（URL 遷移待ち）。**本サブの変更とは無関係であり、E2E スタック全体の実行タイミングに起因すると見ている。** **★1 回目は本サブが画面から呼ぶようになった経路だったため個別に追ったが、2 回目は同経路が緑だった。**
    7. **★「読み取り専用モード」を既存画面へ後付けする案は、書き込み導線の散在数で判断できる。** `ComboDetailPage`（210 行）は書き込み導線が **7 か所の JSX** に散在し、mutation フックを **3 本**無条件に生成していた。**⇒ `readOnly` prop を足すと生きたコンボの画面の全編集経路が条件分岐の下に入る。** 純表示の子部品（`ComboDetailHeader` / `ComboDetailMetadata`）だけを再利用して**別ページにした**。**★同型の判断が要るときは「純表示の子がどれだけ切り出せているか」を先に数えること。**

### M23-09: 登録前の重複ダイアログ（告げる場所を保存の後から保存の前へ移す）（2026-08-23）

- **結果**: **`go test ./... -count=1` 53 パッケージ green（FAIL 0・テスト関数 1557 本 PASS）／ `pnpm test` 182 files・1829 tests green（着手前 178 / 1773）／ `make e2e` 175 passed・flaky 0・FAIL 0（着手前 171 ⇒ +4 本。★セットプレイ側 E2E を足した後の最終実測。途中の回に出た flaky 2 件は `m18-03b` / `m18-03c` で本サブと無関係＝`M23-06` 横断課題 6 の既知事象）／ `gofmt` / `go vet` / `tsc --noEmit` 緑。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-141` は設計卓が起票済み＝D-520）／ 新規依存 0 件。** **★`M23-05` が構造上達成できなかった目的（作り直す前に告げる）を初めて成立させた。** コンボの保存前チェックへ `deletedDuplicates` を足し（**母集団は `findDeletedDuplicateRefsByKey` を `VAL-C14` と共有する 1 本**）、セットプレイ側へ同型の経路 `POST /api/combos/{comboId}/setups/check-duplicate` を新設。保存ボタン押下で「ゴミ箱から復元する／新しく作る／戻って編集を続ける」を選ばせる。**判定は `M23-05` のものを呼ぶだけで書き直していない。** **破壊確認 2 件は実測で期待どおり赤（1 件は指示書の期待とのずれを完了報告 §7 に明記）。**
- **報告**: 完了報告 [`m23-09-completion-report.md`](m23-09-completion-report.md) ／ レビュー [`m23-09-review.md`](m23-09-review.md)（**重大 0 件・高 4 件・中 5 件・低 3 件。採否は 高 4/4 採用・中 5/5 採用・低 2/3 採用（残 1 は確認結果で対応不要）。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**） ／ 設計伝達レポート [`20260824-m23-09-design-exceptions.md`](../handover/design-reports/20260824-m23-09-design-exceptions.md)（**契約違反の独自判断 1 件＝破壊確認 1 の期待とのずれ。設計卓へ裁定を求めている**）
- **★開発者による実機の手動確認 3 件はすべて OK**（2026-08-24。可読性 ／ 読み上げ順 ／ 文面の納得感）。**★いずれもコードでは判定できない点であり、`DES-005` へ文面を写す根拠になる**（完了報告 §15）。
- **★横断課題**:
    1. **★★E2E の判定キーは spec ごとに分けること。`afterEach` の後片付けでは足りない。** playwright は `fullyParallel: false` でも**ファイル単位では並行**に走り、DB を 1 本共有する。並行実行中は「まだ消していない時間」が必ず在るため、後片付けでは原理的に埋められない。**⇒ `m23-09` は「中パンチ + 強パンチ」の 2 手にした**（`m23-05` は「弱パンチ 1 手」）。**★ゴミ箱を作る spec が増えるほど当たりやすくなるため、後続サブは先に他 spec の判定キーを確認すること。**
    2. **★★「行が作られていないこと」を一覧の件数で判定しない。** `/api/combos` の一覧はページングされるため、1 件増えても総数が変わらないことがある。**⇒ 登録要求（`POST /api/combos`）の発生回数を見る形にした。** 同型の主張をする後続 spec も件数を避けること。
    3. **★★「押下と同時に state を更新して、同じハンドラでその state を読む関数を呼ぶ」形は必ず壊れる。** 保存後トーストの抑制フラグを `useState` で持つと、`setState(true)` の直後に呼ぶ `runCreate` が捉えるのは更新前の値になり抑制が効かない。**⇒ 引数で渡す形にした**（呼び出し位置と抑制の有無が 1 行で対応する）。**★型検査も lint も緑のまま通る型の欠陥である。**
    4. **★★リアルタイム検知の門（`isFormReadyForDuplicateCheck`）を保存時の条件に流用しないこと。** 同関数は状況 4 項がすべて埋まっていることを要求するが、**あれは未完成のフォームで API を打たないための門であり、判定の条件ではない。** 流用すると、**状況を空のまま保存したコンボでダイアログが出ないのに `VAL-C14` だけが保存後に出る**（NULL 同士は一致するため）——保存前と保存後で見えるものがずれる。**★実装当初これを流用しており、E2E を書く段で気づいた。単体テストでは検出できていなかった。**
    5. **★★フロントテストはサーバの SQL 変更を原理的に検出できない。** 破壊確認 1（保存前チェックの母集団から `deleted_at IS NOT NULL` を外す）で、指示書 §5.3-1 は「§5.1-3 と §5.2-2 が赤くなる」を期待していたが、**§5.2-2 は応答を stub するため赤くならない。この継ぎ目を持つのは E2E だけである。** **⇒ 「母集団のずれ」を守らせたい指示書は、フロント側に受け皿を求めないこと。**
    6. **★保存経路へ非同期の一段を挟むと、押下直後に同期でアサートしている既存テストが落ちる。** `ComboEditor.test.tsx` の 5 本が該当した（`waitFor` で待つ形へ改めた。**主張は 1 つも変えていない**）。**★当該ファイル単体でも出る**——新規テストだけを回して緑を確認した段階では見えない。**⇒ 既存ファイルも必ず回すこと。**
    7. **★登録側の衝突が出る場所が変わったため `m23-05` の E2E を更新した（欠陥ではない）。** トースト → 保存前ダイアログ。**「新しく作る」を選んだ後は保存後トーストを出さないのが意図であり**（`M23-09` §4.5・チェックリスト N-5）、**これを「警告が消えた」と読んで直さないこと。** `M23-05` の文面の回帰ガード（`saveWarnings.unit.test.ts`）の `expect` には触れていない（コメントのみ失効を是正）。
    8. **★`POST /api/combos/check-duplicate` は `DES-002` §4.2 に載っていない**（走査ヒット **0 件**・設計卓の実査値を再現）。`M23-01` と同じ「実装が在るのに経路表に無い」形である。応答の逐語形は完了報告 §5 に置いた。**`CHANGE-141` の反映がこれ待ちである。** あわせて **`DES-005` §5.15 の「既知の限界」ブロック（保存後にしか気づけない）は本サブで解消したため改訂対象である。**
    9. **★`followup-backlog.md` の `save-time-duplicate-choice-missing` は本サブで解消した。** 状態は「★起票済・投入待ち」のままである。**★製造が直接書けるのは §J だけなので（D-382）編集していない。⇒ 設計卓が畳むこと。**
    10. **★保存前チェックの拡張がリアルタイム重複検知（300ms debounce・入力のたび）と CSV 取込（1 行ごと）にも波及した。** 指示書 §4.1-1 / §4.1-4 が求めた形であり実装は変えていないが、**両経路とも削除済み側を読み捨てるため追加コストは無駄である。** 将来「要求ボディで要否を切る／専用経路に分ける」を判断するときの入力として記録する。
    11. **★★サーバと単体が緑でも、画面 → API → DB を貫く経路が 1 度も通っていないことがある。** 本サブはセットプレイ側がサーバ 13 本・単体 18 本とも緑でありながら、**E2E は 0 本だった**（`grep -rn "setups/check-duplicate" web/e2e/` が 0 件）。指示書 §5.4 の E2E 2 本はどちらもコンボ側の文言であり契約違反ではないが、**単体テストは stub の上で緑になるため「経路が繋がっていないこと」を構造的に検出できない。** **⇒ 面が 2 つあるサブは、面ごとに E2E の有無を数えること。** レビュー完了後に気づいて 1 本足した（完了報告 §14）。
    12. **★spec 単体を回すときは `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を付けること。** `make e2e` だけが同変数を設定するため、`pnpm exec playwright test <file>` を素で叩くと**全件がブラウザ起動失敗で赤くなる**。**★破壊確認でこれを踏むと「赤くなった」を破壊の証拠と誤読する**（実際に 1 度誤読した）。**赤くなった理由を読むこと。**
    13. **★生きた重複と削除済み重複が同居するとき、ダイアログの「新しく作る」は `VAL-C02` で必ず落ちる。** §4.1-4（生きた重複には手を広げない）の範囲内で本サブでは直していない。応答の `duplicates` は取得済みで読み捨てているため、**将来「新しく作るを出さない／注記を添える」を判断する材料は手元に在る。** 次サブの検討材料。

### M23-10: `P-04` の根治（FK をプール全体で有効にする ＋ 回帰ゲート）（2026-08-24）

- **結果**: **`go test ./... -count=1` 53 パッケージ green（FAIL 0・サブテスト込み PASS 1582 本／着手前 1557 ＝ +25 はすべて本サブの新規テスト）／ `pnpm test` 182 files・1829 tests green（★着手前と同一＝`web/src` 0 バイトの裏づけ）／ `make e2e` 175 passed・flaky 0・FAIL 0（★着手前と同一）／ `tsc --noEmit` `gofmt` `go vet` 緑。消費マイグレ 0 本 ／ 消費 CHANGE 0 件（`CHANGE-142` は設計卓が反映）／ 新規依存 0 件。** `db.Open` の PRAGMA をプール確立後の `Exec` から接続文字列（`file:` URI ＋ `_pragma`）へ移し、**プール中の全接続で 4 種の PRAGMA が有効であることを「16 接続を同時に掴んで」主張する回帰ゲートを置いた。** 破壊確認 3 件はすべて期待どおり（**★とくに 2 番＝「1 本ずつ取って返す形なら壊れた実装でも緑」を実証**）。
- **報告**: 完了報告 [`m23-10-completion-report.md`](m23-10-completion-report.md) ／ レビュー [`m23-10-review.md`](m23-10-review.md)（**重大 0 件・高 2 件・中 3 件・低 3 件。採否は 高 2/2 採用・中 3/3 採用・低 2/3 採用（残 1 は射程外でレビュー自身が「記録のみ」と明記）。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**）
- **★`followup-backlog.md` §J へ 1 件登録**: `db-open-file-uri-unverified-on-windows`（**`file:` URI 形式が Windows 実機で未検証。Windows 利用者の DB オープン経路そのものであり、外すと起動不能になる**。必須 5 フィールド付き。**★§J 以外の節は編集していない＝D-382**）
- **★開発者による実機の手動確認 3 件はすべて OK**（2026-08-24。**Windows 実機での起動** ／ **実 dev DB でアプリを一巡** ／ **タグ削除**）。**★いずれもコードでは判定できない点である**——**CI に Windows ランナーが無く、テストも E2E も使い捨て DB で走る。** **⇒ `followup-backlog` §J の `db-open-file-uri-unverified-on-windows` は「完了」。手順と結果欄は完了報告 §14。** **★機械検査に置き換わる見込みは無いため、接続の開き方や削除経路を変える改修が来たら同じ 3 件をもう一度回すこと。**
- **★横断課題**:
    1. **★★`P-04` は FK だけの問題ではなかった。** 同時 16 接続の実測で、`foreign_keys` と同じ 15 本で **`busy_timeout`（0＝既定。WAL 下の書き込み競合で `SQLITE_BUSY` を即返す）と `synchronous`（2＝FULL）も効いていなかった**。`journal_mode` だけは DB 単位で永続化されるため全接続 `wal` だった。**⇒ 回帰ゲートは 4 種すべてを検査する形にした。FK だけを守ると、同じ形で戻された残り 3 つを取り逃がす。** ボード `P-04` 本文が FK だけを挙げているなら範囲を広げて記録するのが正確である。
    2. **★★「プール全体で PRAGMA が効く」ことを主張するテストは、接続を 1 本ずつ取って返す形で書くと壊れた実装でも必ず緑になる。** プールが返却済みの接続を再利用するため、16 回読んでも同じ 1 本（＝唯一 PRAGMA が届いていた接続）を見ている。実測で **FK=OFF 本数 0 / 16** と報告された。**⇒ 同種の「プールの性質」を守るテストを今後書くときは、必ず全接続を先に掴み切ってから読むこと。**
    3. **★`?` を含む DB パスは、本サブ以前から壊れていた。** ドライバ（`modernc.org/sqlite`）は DSN を最初の `?` でパスとクエリに割り、`file:` 接頭辞が無いとパス側を切り詰める。**`config.ValidateDataPath` は `?` `#` `%` を 1 文字も禁止していない**ため、設定次第で別名の DB ファイルが黙って作られる状態だった。本サブは接続側（`file:` URI ＋ パーセントエンコード）で直したが、**設定検証をどうするかは別の論点として残る。**
    4. **★`modernc.org/sqlite` の `RegisterConnectionHook` は使えない。** パッケージ全体のシングルトン `Driver` に登録されるため、`migration.Run` の `sql.Open` にも掛かる。**マイグレーションを FK=OFF のまま走らせる前提（表を作り直すマイグレがある）を壊すので、接続ごとの初期化を足したくなっても採らないこと。**
    5. **★★`combo_tags` の orphan 1 件が生む実害は解消していない。** 本サブは供給（`tags` 削除経由）を止めたが、既に溜まった分は消さない。**「タグが `使用 0 件` と表示されているのに画面からは削除できない」状態は残る**（`CountUsage` が orphan を数え、画面の表示値は別経路で 0 を出すため `force` が永久に立たない）。**★解消には既存 orphan 19 件の掃除が要り、それは開発者の手番である**（掃除 SQL は `m23-08-completion-report.md` §4.1）。followup `tag-count-usage-inflated-by-orphan-combo-tags` は畳んでいない。
    6. **★適用済みマイグレーション（`migrations/000078` ＋ `migrations/000049`＝★レビュー高-2 で 1 件 → 2 件へ訂正）の失効コメントを直さない判断をした（契約違反の独自判断 1 件）。** 指示書 §4.3 は失効記述の是正を求めているが、適用済みマイグレーションは歴史的記録であり本文を後から書き換えない運用の線を優先した。**同じ論点は実装側（`combo/repository.go` `HardDelete`）で是正済みのため、現役のコードを読む経路では失効記述に当たらない。** 覆る場合の手戻りは 1 行。**設計卓の裁定を求める。**
    7. **★実 DB を持たない実行環境では、「実 DB の状態に依存する実査」は代替で再現するしかない。** 本サブ §3.3-1（実 DB の orphan を FK=ON で触ると何が起きるか）は、クラウド実行環境に実 DB が無いため（`find / -name "*.db" -path "*combomgr*"` が 0 件）、**素の接続で同じ形の orphan を仕込んでから FK=ON で触るテストとして再現した。** 言えるのは「この形の orphan は落ちない」までであり、実 DB の 19 件そのものを触った証拠ではない。**★同型の実査を課す指示書は、実行環境に実 DB が在るかを先に確かめること。**
    8. **★Windows の `file:` URI 形式は実機確認が残っている。** テストは DSN 文字列の形（`C:%5CUsers%5C...`）を固定するに留まる。SQLite の URI 解釈上は動作すると判断し、**レビューも独立に SQLite の URI 解析を追って「失敗する見込みは低い」と一致したが、「低い」は「確かめた」ではない。** **⇒ `followup-backlog` §J `db-open-file-uri-unverified-on-windows` として登録した。開発者の手番。**
    9. **★★「同型の記述を 1 件ずつ判定する」工程は、片方だけ直った状態がいちばん紛れやすい。** 本サブは走査 B（`P-04` の番号を引かない同型記述 70 件）を当てていながら、**`SetMaxOpenConns(1)` の根拠コメント 5 か所を判定の段で落とした**（レビュー高-1）。**同型 4 件（`service/preset` / `repository/preset`）は是正済みで、残り 5 件が旧のまま**という状態になっていた。**★とくに `hard_delete_children_test.go` は冒頭を是正済みのファイルであり、下部だけが旧のまま残っていた** —— 冒頭を読んで納得した後任が下部を複製する形（`D-250` と同型）。**⇒ 走査が当たっていることと、全数を判定しきったことは別である。判定漏れは「同じファイルの中」で起きる。**
    10. **★★2026-08-24 後日談＝開発者が実 DB の orphan 19 件を掃除した（開発者報告）。** **⇒ `tag-count-usage-inflated-by-orphan-combo-tags` と `combos-orphan-child-rows-count-unmeasured` の 2 件を §J で `完了` にした**（**★状態欄のみ更新・本文は不変**）。**★ただし「FK を根治したら残骸も消えた」ではない**——**供給を止めたのが本サブ、溜まった分を消したのが開発者の別手番であり、2 つは別の作業である。** 混ぜて読むと、次に同じ状況が起きたとき「根治すれば残骸も消える」という誤った期待を持つ。**★製造は実 DB を持たず、掃除の結果は未検証である**（完了報告 §6 後日談）。
    11. **★件数の申告は、走査の結果ではなく判定の結果から数えること。** 本サブは完了報告 §7 で「失効しているのはこの 1 件だけである」と書いたが、**`migrations/000049:37` を落として 2 件だった**（レビュー高-2）。`000078` と `000049` は**同じ主張を別の言い回しでしている**ため、片方の文字列で走査しても他方は出ない。**⇒ 「N 件だけである」と書くときは、走査コマンドを 2 通り以上当ててから数えること。** 誤った件数のまま渡すと、設計卓が `CHANGE` で拾い損ねる。

### M24-09b: テスト資産と残リファクタ（2026-08-25）

- **結果**: **`go test ./... -count=1` 55 パッケージ ok / FAIL 0（PASS 1610 本・着手前 53 パッケージ／`pnpm test` 182 files・1829 tests は着手前と同一／`make e2e` 175 passed も着手前と同一）。消費マイグレ 0 本・スキーマ変更 0・消費 CHANGE 0 件・新規依存 0 件。** `CalcRecipeHash` 相当の 3 実装を `internal/recipehash` の 1 本へ統合（**統合前の 3 本の出力を 9 入力クラスで実測して全一致を確認し、その値を golden として固定**。公開入口を残したため本番の呼び元 19 か所は 1 行も変更なし）。config の TOML 全再エンコード＋アトミック書込の重複を `internal/config.Save` へ統合。`CO-025` / `CO-007` は**調査のみ**（実装しないのが正しい結末）。
- **報告**: 完了報告 [`M24-09b-completion-report.md`](M24-09b-completion-report.md) ／ レビュー [`m24-09b-review.md`](m24-09b-review.md)（**重大 0 件・高 3 件・中 4 件・低 5 件。採否は 高 3/3 採用・中 4/4 採用・低 3/5 採用（不採用 2 件はレビュー自身が「記録のみ・対応不要」と明記したもの）。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**）
- **★横断課題**:
    1. **★★`CO-025` は「3 spec の問題」ではなかった。** `make e2e` 3 回 ＋ `--workers=1` 1 回の実測で、**`CO-025` の 3 spec（`moves-edit` / `combo-custom-states` / `m12-06-draft-promotion`）は 1 度も落ちていない。** 落ちたのは `m23-09-pre-save-duplicate-dialog.spec.ts` の 2 本で、**`--workers=1` では緑**（教訓 `E-216` の基準＝結果が変わるなら timing ではなく競合）。**E2E は 1 スイートにつき使い捨て DB を 1 個だけ作り全 worker で共有する**ため、spec ファイル間でデータが干渉しうる。**⇒ 個別 spec ではなくスイート全体の構造の問題であり、`m23-close-report` §7-1 の見立てを支持する。** **★followup の同型 7 件（`CO-021` / `CO-022` / `CO-025` ／ `e2e-flaky-isolation` / `e2e-sqlite-write-contention` / `e2e-flaky-combo-post-500` / `e2e-flaky-m18-03c-drainage`）を束ねる先が要るが、「fe-e2e 安定化サブ」は `M24-overview` v1.1.0 の 11 本に存在しない。サブの新設は開発者の承認事項。**
    2. **★★マイグレーション接続は FK=OFF であり、これは意図である**（`architecture-patterns` §11・`D-494`）。**⇒ `migrations/000012` の down は `ON DELETE CASCADE` を発火させず orphan を残す**（実測＝`combo_steps` 96 行・`combo_tags` 1 行）。**down.sql 自身のコメント「`combo_steps` は ON DELETE CASCADE で連動削除」は成立していない。** **★あわせて指示書が求めていない発見**——**down の条件は `character_id` だけなので、up が入れた 36 行以外（利用者が後から作った aki / jamie / guile のコンボ）も消す**（実測で確認）。**本文は 1 バイトも編集していない**（`D-535`）。rollback 方針は設計卓の手番。
    3. **★指示書 §2.1-4 の記述と実体が食い違った。** `CO-012` の面として `internal/api/config/` が挙がっていたが、**同ディレクトリに TOML 書込は 1 行も無い**（`handler.go` 117 行は DTO 変換と HTTP 応答のみ）。実体は `internal/config/` と `internal/service/config/` の間だった。**⇒ 層をまたぐ話ではなかった。**
    4. **★★`scripts/check-progress-log-index.sh` は部分文字列一致で偽の緑を返す。** 照合が `grep -qiF -- "$id" "$logfile"` であり、**他エントリからの前方参照でヒットするだけで緑になる。本サブで実際に踏んだ**（索引行が未追記の状態で `exit 0`。レビューが検出）。**⇒ スクリプト本体の改修は改善レーンの手番であり本サブでは触っていない。設計伝達レポート §4 へ回した。**
    5. **★`internal/config.replaceAtomically` の `f.Sync()` を守るテストが無い。** 現テストが守るのは「一時ファイル経由であること」まで（破壊確認 2 で実証済み）。**`f.Sync()` の 1 行を削っても緑のまま**であり、「書込*中*に落ちても壊れない」の側は**コードの構造としてのみ担保されている**。テストで守るには `os.File` を挟むインタフェースが要り、それは「使われるか分からない抽象」になるため採らなかった。
    6. **★`CO-006` は 149 か所中 16 か所しか寄せていない**（低優先・指示書 §4.3 が後回しを許容）。**寄せ先の道具（`dbtest.Insert`。既定値を 1 つも埋めない設計）は用意したので、後続は 1 か所ずつ足せる。** 残り 133 か所を寄せなかった理由は列集合が 1 か所ずつ違い、既定値を試すために意図的に列を省いているものがあるため。
    7. **★否定形確認の母集合は「指定どおり」に当ててから絞ること**（レビュー高-3）。初版は手で選んだ集合へ当てており、**しかもその中の指示書 1 本は既に残骸と判っていたものだった＝答えを知ってから母集合を選ぶ形**になっていた。**指定母集合へ当て直し、除外基準を先に宣言してから除外したところ結論は変わらなかったが、「変わらない」を実測で言えることが成果物である。** **★キーワードを 2 通り当てても母集合が狭ければ件数は動かない**（`E-236` の射程の補足）。
### M24-01: 一覧・ナビゲーション・既定キャラの配線（2026-08-25）

- **結果**: **`go test ./...` 53 パッケージ ok（★分岐 A のため `internal/` `migrations/` の差分 0 バイト）／ `pnpm exec vitest run` 184 files・1871 tests 全 pass（着手前 182/1829）／ `make e2e` 178 passed・0 failed・0 flaky（着手前 175 passed・0 flaky）／ `tsc --noEmit` エラー 0。消費マイグレ 0 本 ／ 消費 CHANGE 番号 0 件（`CHANGE-130` 起票済みの射程内）／ 新規依存 0 件。** **★扱った 8 件のうち実装 5・実装せず 3**——`SM-002`（M12-01 C-07 で既に解消）・`SM-004`（M12-01 C-17 で既に解消）・`SM-044`（`DES-005` §5.4 の戻り時保持で既に充足）は**実装せず、成立をテストで固定した**。`SM-083` はスコープ外（`D-541`）で 1 バイトも実装していない。**既定キャラの解決順を純粋関数 1 本へ畳み、`INITIAL_CHARACTER_ID` の実使用点を 9 か所 → 0 か所**（解決関数内の段 4 を除く）。**段 3a（`users.main_character_id`）は `D-545` により未実装で、段の列挙 1 か所へ 1 行足せば差し込める形。**
- **★開発者による手動確認は実施済み**（2026-08-25。結果＝想定どおり）。**★ただしこの確認が解決順の穴を 1 件掘り出した**（既定キャラを書き換えても段 2 が勝つ）——**追補②で是正し再確認済み**。手順と結果欄は完了報告 §14。**★ダルシムは `moves` 未登録のため、確認にはイングリッドを用いた**（開発者報告）
- **報告**: 完了報告 [`M24-01-completion-report.md`](M24-01-completion-report.md) ／ レビュー [`m24-01-review.md`](m24-01-review.md)（**重大 0 件・高 3 件・中 6 件・低 7 件。採否は 高 3/3 採用・中 6/6 採用・低 6/7 採用（残 1 は `M24-07` へ行き先確定）。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 0 回で完了**）／ 画面変更のモック [`M24-01-mock/m24-01-screens.html`](M24-01-mock/m24-01-screens.html)
- **★横断課題**:
    1. **★★`SM-119` は指示書の指定した画面が違っていた。** 指示書 §4.1-4 は「新規登録画面側に明示的な入力を置く」と指定していたが、**元の要求は一覧画面についてのものだった**（2026-08-25 開発者ご指摘。逐語＝「一覧画面のフィルタのプルダウンが新規登録対象キャラ選択も兼ねているのが不自然」）。**⇒ 開発者提案により、キャラ選択をフィルタ欄から一覧ヘッダ帯（「新規登録」の隣）へ移し、「対象キャラ」というラベルと「一覧の絞り込みと、新規登録の対象を兼ねます」の補足を添える形へ差し替えた。あわせてキャラ名の大見出しを撤去した（プルダウンが同じ名前を出しており重複していたため）。** **★`CHANGE-130:78` はこの差し替えで失効している。設計卓の手番。**
    2. **★ledger の「参照点 4 面」は実測と違った（実測 6 ファイル / 9 か所）。** `ComboListPage.tsx` と `ComparePage.tsx` が漏れていた。**ledger の数は 2026-08-20 時点の値であり identity ではない**という指示書の注意書きが、そのまま効いた。**同型の指示書は「N か所は着手時に数え直す」を必ず残すこと。**
    3. **★★E2E の blast radius は「実装の参照数」では測れない。** §3.3-9 で数えた「E2E 1 ファイル」は**実装を参照する数**であり、`SM-084`（保存後の遷移先）が動かした**挙動の依存**は **22 か所 / 10 spec** だった（保存後 URL 12・削除後 URL 10）。**⇒ 遷移先・URL・画面遷移を変えるサブでは、実装の参照数とは別に「その挙動を主張している spec」を数える項目を立てること。**
    4. **★同じ 3 行を 10 ファイルへ複製しない。** 作成された combo id を `POST /api/combos` の応答から取る補助を `web/e2e/support/new-combo.ts` へ 1 本置いた（**playwright はファイル単位で並行に走り DB を 1 本共有する＝`E-232`**）。複製すると、並行実行を避ける理由がコメントごと 10 か所へ散り、次に 1 か所だけ直されても気づけない。**`web/e2e/` に spec 以外のファイルを置いたのは本サブが最初である。**
    5. **★指示書の破壊確認が「実行不能」になることがある。** §5.3-2「マイコンボ側で一覧側の項目集合に差し替える」は、**両画面が既に 1 本の部品と 1 本の定数へ統合されていたため真の no-op** だった。**趣旨（集合がずれたら赤くなる）を保つ等価な破壊へ差し替えた。** 設計卓が破壊確認を書くときは、**壊す対象が「まだ 2 つある」ことを実査項目に含めること。**
    6. **★「N 件だけである」は判定の結果から数えること**（`E-220` / `E-236` の再演）。完了報告 §4.9 で「是正 5 件」と断定したが、**実数は 8 件**（本番コードのコメント 3 行を仕分け表から落としていた。レビュー高-3）。**是正そのものは全件行われており、壊れていたのは記録のほうである。** M23-10 の横断課題 11 とまったく同じ形で再発した。
    7. **★遅延初期化子で「後から届く値」を読むと、検査が永久に効かない画面ができる。** 段 3b の実在検査はキャラ一覧（`useCharacters`）に依存するが、**`App.tsx` がゲートしているのは `useConfig` だけ**である。一覧・マイコンボは毎描画で解決し直すため自己修復するが、`ComboEditor` は `useState` の遅延初期化子で 1 回だけ読むため修復しない（レビュー中-2）。**採り直しの `useEffect` を置いて是正した。★`isFormDirty` は `characterId` を除いて判定するため、dirty だけでは「利用者が触れたか」を守れない**——別に ref を持たせる必要があった。
    8. **★一覧応答のセットプレイ取得が失敗すると、新しい「セットプレイ数」列が全行 `0` になる**（`internal/api/combo/handler.go:311-314` が warn ログだけで握る）。**「本当に 0 件」と区別できない。** フロント単独では直せず、区別には `DES-002` §4.2 の契約変更が要る。**本サブでは触っていない。設計卓へ回す材料。**
    9. **★`make e2e` で 1 度だけ flaky を観測した**（`m14-03e-third-wave-seed.spec.ts`）。**フレークで閉じず、隔離実行（1 passed）と直列実行（`--workers=1` で 178 passed・flaky 0）の 2 手を回した**（`E-216`）。**本サブの差分と接点が無く、以後 3 回の実行でも再現していない。** M23 期から続く「毎回 1 件・毎回別のテスト」の型（`m23-close-report` §7-1）。**手当てはしていない。**
    10. **★`followup-backlog.md` `F12-1 / E-2`（デフォルト表示キャラ配線漏れ）は本サブで解消した。** **★製造が直接書けるのは §J だけ**（`D-382`）のため状態は更新していない。**設計伝達レポート §4 へ候補として回した。** あわせて **`web/CLAUDE.md` §1 台帳 #6 の用途欄**（`combo-list-filters-v1` の読み手が 3 面増えた）も同じ扱い。
    11. **★★解決順を作るときは、「その段の値を書き換える経路」が上位の段を無効化するかまで決めること。順序だけでは穴が残る**（**2026-08-25 追補②。開発者の実機確認で発見**）。段 2（セッション）＞ 段 3b（config の既定）という順序は指定どおりだったが、**既定キャラを書く 2 経路（ウィザード・設定画面）が段 2 を触っていなかった**ため、**「設定やウィザードで既定を変えても一覧が変わらない」**状態だった。**★`config.toml` を消したときだけの話ではなく、設定画面から変えたときも起きる＝実運用で普通に通る導線である。** **⇒ 「利用者が既定を明示的に宣言したイベントで、それ以前のセッションの記憶を捨てる」を 1 条足した**（キャラのみ。他の軸は残す。順序は変えない——段 3b を先にすると `SM-044` が壊れる）。**★呼び出し口は `useUpdateConfig` の `onSuccess` 1 か所に集約した**——画面側に置くと**次に既定キャラを書く画面が現れたとき呼び忘れても何も言わない**ためである。
    12. **★`docs/progress/M24-01-mock/` の寿命を宣言した**（`CLAUDE.md` §10.Y）。**「`CHANGE-130` が `DES-005` へ反映され、設計卓が形を確認し終えた時点まで」。★「消す」は開発者の手番**（`D-196`）のため、**`M24-CLOSE` の観点として挙げる。**

### M24-09c: E2E スイートの安定化（2026-08-26）

- **結果**（**★2026-08-26 時点。下の「追補（2026-08-27）」が 4 点を更新している**）: **`workers: 1` の 1 行で spec ファイル間の干渉を止めた。** `make e2e` 5 回連続で **180 passed / 0 failed / 0 flaky**。~~消費 CHANGE 0 本~~ ／ 消費マイグレ 0 本 ／ 新規依存 0 本。~~既存 spec の書き換えは 0 本~~。~~実行時間は既定（2 worker）の約 1.54 倍（248s → 386s）~~。
- **報告**: 完了報告 [`M24-09c-completion-report.md`](M24-09c-completion-report.md) ／ レビュー [`m24-09c-review.md`](m24-09c-review.md)（**重大 0 件・高 2 件・中 5 件・低 4 件。採否は 高 2/2 採用・中 5/5 採用・低 3/4 採用 ＋ 1 件を一部採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 0 回で完了**）
- **★横断課題**:
    1. **★★本番コードのバグを 1 件見つけた。直していない**（完了報告 §9）。**VAL-C02 の重複判定と INSERT が不可分でなく、同一識別キーの本登録コンボが 2 件同時に存在した。** `internal/service/combo/service.go:253-279` で検証は `BeginTx` の**前**に走り、6 項識別キーへの UNIQUE 制約も無い（レビューが独立に裏を取った）。**決定論的な再現手順つき**（`workers` を外して probe を `--workers=2` で回すと 10 回に 1 回）。**単独利用では踏まないが、`M22` の LAN・多人数モードでは 2 クライアントから到達しうる。** `POST /api/combos` は `DES-002` §4.2 の経路表の API であり §2.3 条件 2 が不成立 ⇒ **CHANGE の要否は設計卓の手番。**
    2. **★★同じ症状の未着手記録は 8 件ではなく 9 件ある。** `e2e-shared-global-resource-parallel`（`followup-backlog.md:348`・**未着手**・**5 サブ連続で観測**・**docs 配下 26 ファイルから参照＝9 件中で最多**）が §AH の束ねに入っていない。**開発者の裁定により本サブの射程に含めた。★同行は恒久策候補として `workers: 1` を自ら名指ししていた。** **⇒ 畳むときは 9 件すべてと束ね行を同時に。**
    3. **★指示書 §1.1 の分類が実測と食い違っていた。** 同表は `M24-09b` を `flaky` としているが、`M24-09b-completion-report.md:101` の逐語は「**両方とも retry #1 でも赤**」＝ §4.1.1 の定義では **`fail`** である。**⇒ 「開発者は `fail`、製造は `flaky` を見ていた」という `D-557` の見立ては成り立たない。クラウド実行環境でも `fail` は出ている。**
    4. **★束ね行 §AH `:800` に内部矛盾がある。** 割付列は `★開発者の承認待ち`（`P-41`）のままだが、内容列冒頭は `【2026-08-25 決着・D-554】…承認した`。`parallel-board.md:712` では `P-41` は解消済み。**また 9 件中 `e2e-flaky-one-per-run-persists` だけが followup に独立行を持たない。**
    5. **★★`CLAUDE.md:158` が実態と食い違っている**（完了報告 §13 条件 6）。「使い捨て DB + 専用ポート…で実行され、**dev DB・dev サーバに影響しない**」とあるが、**E2E スイート自身が `PUT /api/config` を踏み、リポジトリ直下の `config.toml`（dev と同じ実ファイル）を再シリアライズしてコメントを落とす**（`Makefile:97-101` が自認）。**★本サブの変更が原因ではなく既存の齟齬。★`CLAUDE.md` は開発者のファイルなので編集していない。** **★2026-08-27 追補で状況が変わった**——**汚染そのものは段 1 で両方向とも消えたが、`CLAUDE.md:158` は依然として古い**（さらに配信方式が `vite preview` になったため書き換える内容も変わった）。**逐語の提案は完了報告 §22 にある。**
    6. **★★自分の計測器が壊れていた。実測 1・2 のポート証跡は無効である**（完了報告 §2.7）。ポート確認を `ss` 前提で書いたが**本環境に `ss` は無く、grep が常に空振りして「OK: 空き」と誤答していた**。**「走査の前に対象が実在することを確かめる」を怠った形である**（`add_e2e_spec.md` の同趣旨の注記＝**描画されていなければ走査は常に真を返す**）。**⇒ 是正版は listener を立てて検知できることを対照実験で確認した**（`D-375`）。**★次の担当へ: 環境に `ss` / `lsof` があるとは限らない。ポート確認は「使用中を検知できること」を先に確かめてから使うこと。**
    7. **★製造側の見立て 3 件が実測で否定された**（完了報告 §10.1）。`"e2e-c-setup"` の衝突（**VAL-S04 はコンボ単位**＝`internal/service/setup/validate.go:133`）／ `memo:"m20-05"` の衝突（**ラベルであり検索キーではない**）／ `m20-04`↔`m20-05` の `defaults.presetId` 衝突（**2 本だけを `--workers=2` で 5 回走らせたが 5 回とも緑**）。**⇒ 裏取りせずに書いていれば虚偽の主張を 3 件出していた。** **★しかもうち 1 件は取り込み前まで `playwright.config.ts` のコメントに残っていた**（レビュー高-1 が検出）。**撤回は本文だけでなく、コードコメント側も同じ手番で直すこと。**
    8. **★★flake の対策は「緑の回数」では判定できない。** 対策前も既定 worker で **3/3 緑**であり、5 回連続緑は**必要条件にすぎない**。**⇒ 根拠は機序と破壊確認に置いた。** 決定論 spec（`web/e2e/aa-interference-probe-{a,b}.spec.ts`）が **並列 10/10 赤・直列 10/10 緑**で、確率を決定論へ翻訳している。
    9. **★回帰の検出器には `retries: 0` を宣言すること**（レビュー高-2）。スイート既定 `retries: 1` のままだと、**`workers` を戻す変更が入っても「1 回目は赤・retry で緑」＝ flaky 扱いで終了コード 0** になり、**検出器が黙って効かなくなる。** `test.describe.configure({ retries: 0 })` で構造的に保証し、既定経路で 3 回実測して確かめた（3 回とも `1 failed`）。
    10. **★`retries: 1` は無注釈で置かれており、それを事後正当化する記述が 25 ファイルに生えていた**（完了報告 §7.1）。**うち 2 件は受入条件・レビュー合格基準という「制度化された場所」に入っている**（`M17-03-stage2-ui.md:182` ／ `M17-03-review-checklist.md:81`）。**⇒ 次の担当が「落ちても retry で通るから正常」と読む経路がそこに残る。★完了済み MS の指示書は当時の記録として書き換えていない**（`D-535`）。**本サブでは `workers: 1` の側に理由を書いた。**

#### ★追補（2026-08-27・指示書 v1.3.0 / v1.4.0 ・ `CHANGE-135` ・ 裁定 `D-569`）

- **結果**: **段 1（`COMBOMGR_CONFIG_PATH` の新設）／ 段 2（14 spec の既定キャラ依存の除去）／ 段 3（配信を `vite preview` へ）** を同じブランチで実施。`make e2e` **3 回とも 180 passed（一発緑 3/3）**。**消費 CHANGE ＝ `CHANGE-135`（設計卓が起票。★製造は参照のみで本ブランチにコミットしていない）** ／ 消費マイグレ 0 本 ／ 新規依存 0 本。
- **★開発者の実機確認（2026-08-27）**: **画面から既定キャラを「ガイル」・既定プリセットを「2」にしたまま `make e2e` ⇒ 180 passed / flaky 0 / failed 0 / 3 分以内。「許容可能」と判定された。** **★製造の環境では構造的に取れなかった証拠である**（クリーンな clone には `config.toml` が無く `config.toml.example` に `[defaults]` も無いため、事実 A を踏めない）。**★1 回目は赤だったが原因は pull 漏れであり、実装ではなかった。⇒ 実機確認の依頼文の 1 行目に `git log --oneline -3` を置くこと。**
- **報告**: 完了報告 [`M24-09c-completion-report.md`](M24-09c-completion-report.md) **§16〜§27** ／ レビュー [`m24-09c-review.md`](m24-09c-review.md)（追補分＝**重大 0 / 高 3 / 中 3 / 低 3。9 件すべて採用。「高」の不採用 0 件＝エスカレーション発火なし。往復 0 回**）
- **★2026-08-26 の記録のうち、追補が偽にした 4 点**:
    1. **「消費 CHANGE 0 本」→ `CHANGE-135` が起票された。** **製造の CHANGE 要否判定が誤っていた**——走査したのが env 変数名で、正しい対象は **`SUPP-001` §5.8 の「配置場所: アプリ実行ディレクトリ直下」**だった。**「既存 3 つの env が文書化されていないのだから 4 つ目も要らない」という理由付けは、過去の欠落を根拠にしている**（設計卓 `CHANGE-135` §3-2）。
    2. **「既存 spec の書き換えは 0 本」→ 段 2 で 14 本を書き換えた。** 判定基準 1 は `workers: 1` を選ぶ段では満たしていたが、**事実 A の根治には spec 側の暗黙依存を消す必要があった。**
    3. **「248s → 386s（約 1.54 倍）」→ 母数として使えない。** **2 worker → 1 worker の比であり、開発者は 12 worker で回す。** さらに**同じ環境が別時点で 307〜309 秒と 402 秒を出しており**、**別時点の値どうしを引き算してはいけない**（完了報告 §18.2）。**⇒ 根拠に使えるのは同一セッションの背中合わせだけ: `pnpm dev` 402 秒 → `vite preview` 223〜253 秒。**
    4. **横断課題 5（`CLAUDE.md:158`）→ 汚染は段 1 で両方向とも消えた。** ただし **`CLAUDE.md:158` 自体は古いまま**であり、**配信方式が変わったので書き換える内容も変わった**（完了報告 §22。**開発者の手番**）。
- **★横断課題（追補分）**:
    1. **★★「製造の環境では踏めない」が構造的に 2 度起きた。** ① **事実 A** ＝ クリーンな clone には `config.toml` が無いので、dev 設定による汚染を踏めない。② **`launchBrowser`** ＝ クラウドでは `xdg-open` が失敗し warn ログだけになる。**⇒ どちらも「3 回緑だった」ことが「問題が無い」ことの証拠になっていなかった。★緑は環境の証明にしかならない。**
    2. **★★破壊確認は「壊す対象が実在するか」だけでなく「壊すと観測が動くか」まで示すこと。** UI 文字列の**末尾に 1 文字足した**破壊確認が **180 passed** で返った。原因は **`getByRole` の `name` が既定で部分一致**であること。**⇒ 置換でやり直して初めて対照になった**（`M-78` ／ playbook §4.32 の一般形を UI 文字列へも広げる）。
    3. **★比較の基準は「比べたい変化の直前」に取ること。** 破壊確認 1 の副作用判定を、**自分の `sed` より前のバックアップと比べてしまい**、実行後の差分を誰が書いたか分けられなくなった（**本サブ 2 度目**）。**⇒ 完了報告 §25.1 で測り直した**（`md5sum` を `sed` の後・実行の直前に取り、実行後 `md5sum -c` が OK）。
    4. **★★撤回した数字がコード注記に残った**（追補レビュー H-5。**本サブ 2 度目**）。**完了報告で「再現しなかった」と申告した数字が、同じコミットで入れた `web/vite.config.ts` / `web/playwright.config.ts` の注記に「実測・同一環境」の断定形で残っていた。** **⇒ 撤回は本文・コード注記・索引を同じ手番で直して初めて成立する。**
    5. **★`vite preview` は本番の静的配信経路（Go の embed）を通らない。** その経路は E2E で一切検査されないままである（`embed_web` を撤回した代償）。followup `e2e-does-not-exercise-production-static-serving`（裁定 §7 で起票済み）。**本サブでは直していない。**
    6. **★E2E のビルド（`pnpm build`）は `web/playwright.config.ts` にしか無い。** **`Makefile` へ移すと `cd web && pnpm e2e` を直接叩いた経路が古い `dist` を検査し、しかも緑で通る。** **破壊確認 3-(b) で再現済み**（完了報告 §19.3）。**移設を禁じる注記を両側へ置いたが、機械検査は無い。**
    7. **★`SUPP-001` §4.5 の齟齬は 2 件**（`reuseExistingServer: true` vs 実装は両方 `false` ／ `resolveBackendPort()` の名と役割が実装と違う）。**設計卓の手番**（§6-2 受理済み）。**`CHANGE-135` の射程は §4.5 へ広がる**（完了報告 §27）。
    8. **★`VAL-C02` の競合は本サブでは直していない**（別サブへ出た）。**CI にも 1 ファイルも触っていない。** **`cmd/` の差分は `configPath` の 1 か所のままで、`launchBrowser` は着手基点と逐語一致。**
### M24-02: フィルタ・タグ・キャラ選択（2026-08-26）

- **結果**: **`go test ./... -count=1` 55 パッケージ ok / FAIL 0 ／ `pnpm exec vitest run` 187 files・1952 tests 全 pass（着手前 184 / 1881）／ `tsc --noEmit` エラー 0 ／ `make e2e` 182 passed・0 failed・0 flaky（exit 0）。消費マイグレ **1 本**（`000079`）／ 消費 CHANGE 番号 0 件（`CHANGE-133` 起票済みの射程内）／ 新規依存 0 件 ／ スキーマ変更 0 列。** タグフィルタをドロップダウン＋検索＋件数バッジへ、フィルタ欄を折りたたみ可へ（新キー `combo-list-filters-collapsed-v1`）、キャラ選択を検索欄付きコンボボックスへ（**13 コントロール / 11 ファイル**）、タグ管理へ検索と 0 件 2 状態の区別。`CHANGE-130` の残ゲート（台帳 #6 の用途欄）を畳んだ。`000079` で `mai` の表示名を `不知火舞` → `舞`（**全 19 体の突合として実施**）。
- **報告**: 完了報告 [`M24-02-completion-report.md`](M24-02-completion-report.md) ／ レビュー [`m24-02-review.md`](m24-02-review.md)（**重大 0 件・高 6 件・中 7 件・低 4 件。採否は 高 6/6 採用・中 7/7 採用・低 4/4 採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**）／ 画面変更のモック [`M24-02-mock/m24-02-screens.html`](M24-02-mock/m24-02-screens.html)
- **★横断課題**:
    1. **★★指示書 §4.3.1 の分岐表に反して並び順を実装した。根拠は開発者裁定である**（2026-08-26・逐語＝「例外1件を許容して実装」「漢字キャラは一番下に並べていいです」）。**`name_ja` に漢字を含むキャラは実測 1 件（`mai`）であり、字句どおりなら未実装が正しい結末だった。** 受容挙動（漢字は末尾・ラテン文字は先頭）は `web/src/lib/character-sort.ts` の冒頭ブロックとテスト 2 件で固定してある。**★後任が「バグ」と読んで読み仮名マップをフロントへ持たせないため。**
    2. **★★英語ロケールの「a〜z の昇順」は実装していない**（`M24-07` へ接する）。**`CharacterSelector` は言語に関わらず `name_ja` を表示しており、`name_en` を表示する画面は 1 つも無い。** 初回実装は §4.3.1 の字句どおり `name_en` でソートしたため、**英語 UI で「日本語名のリストが見えない英語名の順に並ぶ」＝無順序に見える状態になっていた**（レビュー 高-5 が検出）。**⇒ 開発者裁定で「表示している値で並べる」へ着地し、キーを `name_ja` 固定にした。** **★同要件を撤回するか、ラベルもロケールに従わせるかは設計卓の手番。**
    3. **★★キャラ表示名の不一致は「見つかった 1 件」ではなく「全数を突合して 1 件」だった。** `M19-04` の完了報告に同じ不一致が既に記録されていたが `character_code` で回避され、followup にも ledger にも上がらなかった。**⇒ `docs/seed-data/check-criteria.md` §7 に「キャラの表示名はインゲーム表示に合わせる」＋突合結果を残した。書かないと次の seed 投入でまた入る。** **★2 件（`ingrid` / `c_viper`）は SF6 の playable キャラではなくインゲーム表示が存在しないため「不明」として保留。`m_bison` の `name_en` も要確認。推測で直していない。**
    4. **★★「キャラを選ばせる UI」の実測は予見 5 面に対し 13 コントロール / 11 ファイルだった。** パニッシュ 2 画面（各 2 個）・技マスタ編集・プリセット編集・ウィザード・設定・取込ヘルパーが予見に無かった。**★初出で「14 / 13」と書き誤り、同じ誤りをソースコメントにも固定していた**（レビュー 高-4 が検出＝**`E-220` / `E-236` の再演**）。**「N 件だけである」は判定の結果から数えること。**
    5. **★★`§4.3.2` の blast radius は既存 E2E に及んだ。** `selectOption()` でキャラを選んでいた **4 spec / 10 ケース**が落ちた（1 回目の `make e2e` は 10 failed / 172 passed）。**追随のしかたも `web/e2e/support/characters.ts` へ寄せた**（`pickCharacter` / `pickCharacterByCode`）。**★`toHaveValue` は「Not an input element」で落ちる**——native `<select>` を button 系の部品へ替える変更は、value ベースの assert を全部壊す。
    6. **★破壊確認は「壊す対象が実在するか」だけでは足りない。** 破壊 3（`combo-list-filters-v1` から `character_id` 以外も読む）は、**1 度目の壊し方〔読むだけ〕では 33 件すべて緑のままだった**——読むだけでは送信するリクエストが変わらないため。**実際に絞り込みへ持ち込む形にして初めて赤くなった。** **⇒ 計測点 `M-78` に「その壊し方で本当に観測が変わるか」を足すこと。**
    7. **★自分の採取ミスを 2 件記録する。** (a) 着手前の `go test` は採取コマンドに `| tail -60` を付けたため出力が切れており、**「54 パッケージ」は実測値ではない**。(b) **着手前の `make e2e` は採取していない**（モック提示を先に済ませたため、最初のフル実行は既に変更が入った状態だった）。**⇒ 基準値は「変更を入れる前」に、切らずに採ること。**
    8. **★`Radix DropdownMenu` の中にテキスト入力は置けない。** Content の typeahead が打鍵を奪い、抑止すると矢印キー移動も死ぬ。**⇒ 検索欄付きドロップダウンは `Popover` ＋ `Input` ＋ `<ul>` が本リポジトリの型である**（付与側 `TagSelector` の先例）。**★`Popover` へ移すと矢印キー移動が消えるため、自分で実装する必要がある**（レビュー 中-4 で追加）。
    9. **★テストの `defaultFilters.sort` が `"default"` になっており「既定状態」を表していなかった。** `"default"` は**始動状況順という別の並び順の値**であり、既定は `DEFAULT_SORT_FIELD = "updated_at"` である。**⇒ `"updated_at"` へ是正した。** 名前が紛らわしく、同種の取り違えは再発しうる。
    10. **★★開発者確認で「見た目」の要望が 2 件出て、追補が 2 本になった**（`1c35272` / `d84afb4`）。**(1) 要約ピルを見出し行の隣へ**〔逐語「少しでも縦の枠を確保するのが目的」。実測で常用域 −24px〕**／ (2) ピルを `{軸名}: {値}` へ**〔**軸名の前置は「画面中央」の衝突も解消する**——`POSITION_LABELS.mid_screen` と `setupResult.corner.midScreen` は同一文字列〕**／ (3) 追補1 の副作用で「隠す」が右端から見出しの直後へ移動したため、右端へ戻した**。 **★★教訓——レイアウトを動かす変更は「動かした要素」だけでなく「同じ行にある他の要素がどこへ行くか」も併せて提示すること。** **★共有部品（`CollapsibleFieldset`）は任意 prop を足して既定を従来値にしたため、登録画面 6 節は追補 2 本とも無変更で済んだ。** **★挙動の差分 1 件＝見出し文字のクリックでは開閉しなくなった**〔押下領域はトグルのみ。**開発者確認で現状維持と判定済み＝未決ではない**〕。

### M24-11: `VAL-C02` の check-then-act 競合を閉じる（2026-08-27）

- **結果**: **`go test ./... -count=1` 55 パッケージ ok / FAIL 0（着手前と同数）／ `pnpm test` 187 files・1952 tests 全 pass（着手前と同一＝フロント非改変の対照）／ `tsc --noEmit` エラー 0 ／ `make e2e` 184 passed・0 failed・0 flaky（exit 0）。消費マイグレ 0 本（`migrations/` の差分 0 バイト）／ 消費 CHANGE 番号 0 件（`CHANGE-136` は設計卓が起票済み）／ 新規依存 0 件。** 採った手＝**DSN へ `_txlock=immediate`（書き込み tx 24 か所すべてが `BEGIN IMMEDIATE` で開く）＋ 判定を `POST` / `PUT` / `materialize` の 3 経路でトランザクションの内側へ移し `*sql.Tx` で読む ＋ `SQLITE_BUSY` を 503 `database_busy` へ翻訳**。判定ロジックは 1 文字も変えていない。
- **報告**: 完了報告 [`M24-11-completion-report.md`](M24-11-completion-report.md) ／ レビュー [`m24-11-review.md`](m24-11-review.md)（**重大 0 / 高 2 / 中 8 / 低 3。13 件すべて採用・不採用 0 件＝「高」不採用による開発者エスカレーションの発火なし。往復 1 回**） ／ 設計伝達レポート [`20260828-m24-11-design-exceptions.md`](../handover/design-reports/20260828-m24-11-design-exceptions.md)（**★§2 に受理／却下の裁定を要する項目が 2 件**）
- **★開発者が実施した確認**（2026-08-28）: **① 既存データの重複＝母数 61 件・重複 0 組**（DoD §7.1-7 を閉じた。掃除の手番は発生しない） ／ **② 実機での `PATCH /api/combos/:id` 3 操作がすべて成功**〔仮登録→本登録の昇格 ／ メタデータのみ編集 ／ タグのみ変更〕**——高-1 の修正で `BeginTx` を関数先頭へ動かした日常経路であり、本サブで最もリスクが高い** ／ **③ `main` は進んでいない**（着手基点 `36b41f4` のまま）
- **★横断課題**:
    0. **★★★適用面は 3 経路ではなく 4 経路だった**（**レビュー指摘 高-1・初回提出時に落としていた**）。**`UpdateMetadata` の仮登録→本登録昇格（`PATCH /api/combos/:id`）が、判定を `BeginTx` の 33 行前・非 tx ハンドルで行っていた。** 昇格は INSERT ではないが **`is_draft` を 0 にする＝重複判定の母集団へ行を持ち込む操作**であり、`POST` / `PUT` / `materialize` と同型の check-then-act である。**★破壊確認 4 で実在を確認**（着手基点の形＝行 2 件・`VAL-C02` なし → 修正後＝1 件・停止）。**⇒ 塞いだ。as-built は 4 経路である。** **★★`CHANGE-136` §2.3 と指示書 §4.2 は「3 経路」と書いている。設計卓は実装ソースを読めないため（指示書 §1.1.4）、`DES-006` §2.3 へ「3 経路で閉じた」として反映しないこと。** **★欠落を招いた一因は `validation/combo.go` の godoc が `POST` と `PUT` の 2 経路しか挙げていなかったことであり、これも是正した。** **★一般化＝「`BeginTx` する関数」と「`tx` を受け取る関数」を母数に取ると、`BeginTx` の*前*で走る判定は視野に入らない。**
    1. **★★指示書 §4.1.2 / §3.3-5 の前提が実査で崩れた。** 設計卓は「DSN の `_txlock=immediate` は全トランザクションに効くため『読み取り専用は含めない』と衝突する」として書き込み用ヘルパを推していたが、**`modernc.org/sqlite v1.50.0` の `tx.go:22-25` が `opts.ReadOnly` を見て `beginMode` を外す**ため衝突しない。**加えて本リポジトリに読み取り専用 tx は 0 件である**（`TxOptions` / `ReadOnly` の出現が 0）。**⇒ 前提の 2 本足が両方折れた。開発者が DSN 方式を選択（2026-08-27）。** **★同型の危険**——設計卓は実装ソースを読めないため、ドライバの挙動に関する断定は毎回実査で裏を取る必要がある（`M-77`）。
    2. **★★一次源の再現手順は「決定論的」ではなかった。** `M24-09c` 設計伝達レポート §4-1 の逐語は「繰り返す。**10 回中 1 回**の頻度で」＝確率的である。指示書 §5.1 は同手順を「決定論的な再現手順」と呼んでいたが、**その語に当たるのは `M24-09c` が作った probe spec 2 本の「並列なら必ず赤」であって、`VAL-C02` の競合そのものの出方ではない。** **⇒ 真に決定論的な Go テストへ翻訳した（3/3 赤 → 3/3 緑）。あわせて一次源そのものを同一セッションで背中合わせに回し、着手基点 7/10 再現 → 修正後 0/10 を実測した。**
    3. **★★`§4.3` の最大リスクは顕在化しなかった。母数 39 中、非 tx ハンドルでクエリを撃つのは 6 本で、その 6 本ともすべて「読み」だった**（`SUPP-001` §7.1.1-3 が名指しした「非 tx の UPDATE」は 0 件）。**WAL では読みは writer と競合しない。** **⇒ `SUPP-001` §7.1.1-3 の記述を「UPDATE」に限定しておく価値がある（設計卓の手番＝`D-564`）。** **★★あわせて、本サブの変更自体が 3 件を新たに tx の内側へ入れた**〔`PUT` の M4-03 検査 ／ `materialize` のダメージ計算（`moves` 読み）／ VAL-C01 / VAL-C08 の master 読み〕。**⇒ 完了時点の全数は 6 + 3 = 9 本。すべて「読み」であり非 tx の UPDATE 文は依然 0 件である**（完了報告 §3.2.1）。**★ただし「書きに行く形」は 1 件あった**（`Materialize` → `drainBasePunish` の入れ子 tx）——**`SUPP-001` §7.1.1-3 が言う害に該当するのはそれである。「書きは 0 件」と読まないこと**（レビュー指摘 高-2）。**★あわせて母数は 39 ではなく 40 である**（旧記載は数え方が復元できずレビューで再現不能と指摘された＝中-7。完了報告 §3.0 にコマンドを併記した）。 **★ただし 1 件だけ実際に踏む形が在り、直した**——`materialize` の「既存 id を返す」経路が `drainBasePunish`（自前で書き込み tx を開く）を呼ぶため、**呼ぶ前に自分の tx を閉じる形にした。**
    4. **★★破壊確認 3 が当初は空振りしていた。** 「検証に `*sql.DB` を渡す」で赤くなるはずのテストが、**アダプタを自分で組み立てて `WithTx` を呼ぶ形だったため、配線（`txScopedDeps`）を壊しても緑のままだった。** **⇒ 配線そのものを通る内部テストを足して是正した。** **★あわせて報告すべき非対称**——**破壊確認 3 では再現テストは緑のままである。** `BEGIN IMMEDIATE` の直列化により 2 本目が判定する時点で 1 本目は既に commit しているためで、**`*sql.Tx` の束ねは `VAL-C02` の正しさにとって今日は必須ではない。** 束ねが守っているのは `D-360` の規約と、将来「判定より前に同じ tx が書く」形が生まれたときの防御である。
    5. **★★`BEGIN IMMEDIATE` でなければならない理由が、破壊確認で独立に裏づけられた。** `_txlock` だけを外すと、再現テストは「行が 2 件」ではなく **`SQLITE_BUSY`** で落ちた。機序＝**検証を tx の内側へ入れた状態で DEFERRED にすると、読んでから書きへ昇格しようとするが、WAL では昇格は待てず SQLite が即座に `SQLITE_BUSY` を返す（`busy_timeout` は効かない）。** **⇒ 「内側検証だけ」でも「IMMEDIATE だけ」でも足りず、両方が要る。**
    6. **★他の check-then-act の一覧（§4.4）。守られる 1 件／手当てが要る 3 種。** 守られる＝**`VAL-P05`**（`preset/service.go:166` の `CountPresets(ctx, tx)` が INSERT と同じ tx の内側）。手当てが要る＝**`VAL-S04`**（3 経路すべて tx の外。うち `CreateSetupInTx` は開いた tx の内側から非 tx で読む二重の形）／**タグ重複**（tx を持たないが DB の `UNIQUE (user_id, name)` が重複行は防ぐ。生じるのは**制約違反が `ErrTagNameDuplicate` へ翻訳されず 500 になる**こと）／**その他 4 件の tx 外検査**。**★本サブでは直していない（指示書 §4.4 が「一覧を作るところまで」と定めている）。** **★`VAL-P05` の成立をテストで固定したかったが、`internal/service/preset/` は契約 F-1 の凍結パッケージでありテストであっても差分になるため、根拠となる「機構」の側を `internal/infra/db/check_then_act_test.go` で固定した。**
    7. **★既存データの重複（§4.5）＝母数 61 件・重複 0 組**（**2026-08-28 に開発者がローカル DB で実測。DoD §7.1-7 は閉じた**）。**⇒ 掃除の手番は発生しない。** 着手時点では本実行環境（クラウドのクリーンな clone）に dev DB が無く製造の手では数えられなかったため、**数える手（`COMBOMGR_AUDIT_DB` を指したときだけ走る監査テスト）を用意して開発者へ回した。消していない。** **★「重複は存在しない」と読まないこと**——本結果は開発者のローカル DB の実行時点の状態であり、本サブが閉じたのは「これ以上増えない」ことである。 **★監査そのものの有効性も固定した**——これが無いと「重複 0 件」が「本当に 0 件」なのか「監査が何も見ていない」のか区別が付かない（`M-78`）。
    8. **★followup `e2e-flaky-combo-post-500` は本サブの競合では説明が付かない**（競合の帰結は 201 が 2 本であって 500 ではない）。**★隣接機序の候補が 1 つある**——当時 `busy_timeout` は 16 接続中 15 本で失効しており（実効 0＝即座にビジー）、かつ `SQLITE_BUSY` の扱いが `internal/` に 0 件で 500 `internal_error` に落ちていた。**⇒ 症状と一致するが、サーバ側ログが未採取のため断定しない（`E-84`）。★本サブにより次回は 503 として区別が付く。** `M24-CLOSE` へ回す。
    9. **★保存ボタンの二度押し（§3.3-11）は既に守られていた。** `ComboEditor.tsx:884` の `disabled={isMutating}` に加え、`:203` に `saveInFlightRef` の再入ガードがある（`M23-09` §4.6-3 が「ダイアログを挟むと `disabled` だけでは窓が閉じない」として入れたもの）。**⇒ `M24-04` へ渡す課題は無い。**
    10. **★`FindActiveByDuplicateKey` を共通述語へ寄せなかった。** 当初プランでは `duplicateKeySelectSQL` / `duplicateKeyPredicates` へ寄せる予定だったが、**同ファイル（`repository.go:1325-1328`）が「⇒ 本定数を `FindActiveByDuplicateKey` へ後から適用しないこと」と名指しで戒めていた**ため取り下げ、ハンドル 1 行（`r.db` → `r.runner(tx)`）だけを変えた。**⇒ `addNullable` の重複（同 `:1352-1353` が自認）は残る。followup 候補へ。**
    11. **★`make e2e` はクラウド実行環境で完走した**（184 passed / exit 0 / 3.2m）。既知の followup `cloud-e2e-browser-mismatch` は `Makefile:122` の `PW_EXECUTABLE_PATH` 既定で回避されており、**開発者の手番へ回す必要は無かった。**
### M24-03: 比較・詳細・レシピ可読性（2026-08-26）

- **結果**: **`go test ./... -count=1` 全パッケージ ok（着手前と同じ＝Go は 1 バイトも触っていない）／ `pnpm test -- --run` 191 files・1995 tests 全 pass（着手前 187 / 1952）／ `tsc --noEmit` エラー 0 ／ `make e2e` 187 passed・0 failed（exit 0）。消費マイグレ **0 本**（次は `000080` のまま）／ 消費 CHANGE 番号 0 件（`CHANGE-134` は設計卓が起票済み・その射程内）／ 新規依存 0 件 ／ `internal/` `cmd/` `migrations/` の差分 **0 バイト**（分岐 A で着地）。** レシピの見せ方を **4 面（一覧・詳細・比較・比較の追加モーダル）へ 1 つの規則で通し**、`DES-005` §5.4 の 6 択を 6 番目（既定は末尾省略・トグルで全文表示）へ畳んだ。新キー `recipe-full-view-v1` を台帳 #11 へ登録。比較へキャラ名（`name_ja`）と詳細への導線、メモ 1 行目を一覧と詳細へ、`okiOptionLabel` へノーゲージを 1 か所で付与。**9 項目のうち 8 件を実装し、`SM-096` は実測により「既に成立」として E2E で固定した。**
- **報告**: 完了報告 [`M24-03-completion-report.md`](M24-03-completion-report.md) ／ レビュー [`m24-03-review.md`](m24-03-review.md)（**重大 0 件・高 3 件・中 6 件・低 7 件。採否は 高 3/3 採用・中 6/6 採用・低 7/7 採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**） ／ 画面変更のモック [`M24-03-mock/m24-03-screens.html`](M24-03-mock/m24-03-screens.html) ／ **開発者の手動確認 実施済み（2026-08-26。完了報告 §12）**——**比較・追加モーダルは「問題なし」。修正依頼 2 件〔備考列・セットプレイ数を既定 OFF〕は本サブで実施、違和感 1 件〔比較→詳細→戻る→一覧〕は申し送り。編集画面のノーゲージは「案 A＝正典へ寄せたまま」で決着。★取り込み後の再確認も実施済み〔逐語＝「既定で消えていました。一覧とマイコンボの両方を見ました。」〕＝`D-429` 条件 1（同一ビルド）を満たすのはこちら**
- **★横断課題**:
    1. **★★`SM-096`「一定以上の長さで画面が崩れる」は、現行コードでは再現しなかった。** memo の見立て（「レシピ縦表示で解決余地」）は**機序ではなかった**。実測——レシピを **5 文字から 263 文字まで伸ばしても表の幅は 1155px のまま変わらない**（`truncate` の `white-space:nowrap` が効いて列幅が動かない）。**ページ本体は 1280 / 768 / 390 のいずれの幅でも横へ溢れない**（`overflow-x-auto` が表内スクロールとして吸収する）。**⇒ 崩れの原因はレシピ長ではなく「列数 × 各列の最小幅」である。** 実装せず、成立を E2E ケース (6) で固定した。**★静的な読みでは `SetupTreeRow`（truncate も max-width も無い唯一の面）が最有力候補に見えたが、実測では flex の子が折返して溢れなかった。読みだけで手を選んでいたら、ここを直して「直った」と報告するところだった。**
    2. **★★`SM-097`（ノーゲージのラベル）は `DES-005` §5.6 項目6 の「ラベル生成規則」と §5.13 の出力に及ぶ。** 同項は生成規則を逐語で書いており（`"投げ重ね(その場受け身)"`）、as-built は `"投げ重ね(その場受け身・ノーゲージ)"` へ変わった。**★呼び元 3 件のうち 1 件は出力（エクスポート）面である**（`export-model.ts:185`）。**⇒ `CHANGE-134` の射程へ §5.6 / §5.13 を加えるかは設計卓の手番。** 設計伝達レポート §2 へ回した。
    3. **★★「4 面が 1 つの値を共有する」は `useState` では成立しない面がある。** `/compare` では**比較表とコンボ追加ダイアログが同時にマウントされる**ため、面ごとに state を持つとダイアログ側の操作が比較表へ伝わらない（再マウントまで古い値を見る）。**⇒ `useSyncExternalStore` + モジュールレベルの購読者集合にした。** **★`M24-02` の `useFilterPanelCollapsed`（#10）は素の `useState` だが、あちらは読み手が 1 つしか無い。形を釣られて揃えないこと**（`web/CLAUDE.md` §1 の脚注にも書いた。#8 / #9 の「件数を釣られて直さない」と同じ型）。
    4. **★★`SM-089`（メモ 1 行目）は既存 E2E 6 ファイルを壊した。** メモが 1 画面に 2 か所出るようになり、`getByText(memo)` が strict mode violation になる。**★これは実装の欠陥ではなく要求どおりの表示である。** 全数 grep（`grep -rn "getByText(memo" e2e/ | grep -v exact`）で洗い出して `{ exact: true }` へ揃えた（現在 0 件）。**★`M24-02` の教訓「表示の DOM 種別を変えると assert が壊れる」が、DOM 種別ではなく「同じ文字列が増える」形で再演した。**
    5. **★★破壊確認の予測が 1 件外れた（隠さず記す）。** 指示書 §5.3 の破壊確認 1 は「E2E (1) と **(2)** が赤くなる」と予測していたが、**(2) は緑のままだった**——(2) が見ているのは「詳細の既定が全文であること」であり、トグルを既定へ固定しても詳細は全文のままだからである。**代わりに (5) と (6) が赤くなり、趣旨は 8 経路で成立した。** **⇒ 破壊確認の期待経路は「壊す対象」からではなく「その観測が何を見ているか」から立てること。**
    6. **★★セットプレイのレシピ表示は本サブの共通部品を通っていない**（実査 6・指示書 §1.3-6 でスコープ外）。5 か所で個別描画のままであり（`SetupAccordionItem` / `SetupCandidateList` / `LinkExistingSetupModal` / `SetupTreeRow` / `SetupSelectorModal`）、**空表示の文言リテラル `"（レシピなし）"` も 6 件そこに残っている**（実装側は 9 → 7、うち 1 件は新設の定数定義）。**寄せるなら別サブ。** 設計伝達レポート §4 へ回した。
    7. **★`SM-089` により、詳細と一覧でメモが 1 画面に 2 か所出る**（レシピの上の 1 行目 ＋ 既存の「備考」欄／列）。**要求どおりだが、二重表示そのものが気になる可能性がある。** 既存の備考欄を畳むかは開発者の判断。
    8. **★★開発者の手動確認で「メモの二重表示」が修正依頼になった**（2026-08-26）。**`SM-089` を一覧にも出した結果、既存の「備考」列と同じ文字列が 1 画面に 2 か所並んだ**〔逐語＝「失念していたが備考欄に同じくメモが出ている。こちらの列は消してもらえますか？」〕。**⇒ 備考列を既定 OFF にした**（型・`COLUMN_DEFINITIONS`・保存キーは不変で、表示列カスタマイズから戻せる）。**★あわせてセットプレイ数も既定 OFF にした**〔開発者依頼〕——**★これは `M24-01` が `SM-012` に応えて追加し `D-553` で受理済みの列である。受理済みサブの成果物の見え方を後続サブが変えた事例として、設計伝達レポート §4-10 で設計卓へ回した。** **★★教訓＝「情報を足す」要望を実装するときは、同じ情報を既に出している面が無いかを先に数えること。** 本サブは 4 面のレシピ表示は数えたが、**メモを既に出している列は数えていなかった。**
    9. **★★`Memo_Someday.txt` の注記が誤っていた事例**（2026-08-26 に判明）。`SM-097` の 2026-08-11 注記は**「実際にラベルを組む `okiOptionLabel`」と断定していた**が、**編集画面は `okiOptionLabel` を経由せずインラインで組んでいた。** **⇒ memo → ledger → 指示書 §3.3-12 → 初回実査の全員が同じ盲点を共有し、レビュー 高-2 だけが拾った。** **★教訓＝「ラベルを組み立てている箇所の全数」を問うときは、関数名ではなく組み立ての材料（ラベル定数そのもの）を引くこと。** なお ledger の要約列は `／【2026-` で切れていた（`SM-018` = `M-82` と同型）が、**今回は要旨が無傷で実害は無かった。**
    10. **★「戻る」の遷移の違和感は既存実装である**（2026-08-26 開発者指摘）。`ComboDetailPage.tsx:97` の「戻る」は `<Link to="/combos">` のハードコードで、**本サブでは触っていない。** **`SM-003` の「詳細を開く」導線が初めてそれを露出させた。** **⇒ 申し送り**（設計伝達レポート §4-8）。**★`followup-backlog` §J へは書いていない**——**§J は「上限に達して止めた項目」の受け皿**であり、本件は**開発者判断による意図的な先送り**だからである。
    11. **★実測値を残す（後続の基準値）。** 一覧のレシピ列は幅 **320px 固定**で、**4 ステップ・31 文字から切れ始め**、32 ステップ・263 文字では **11%** しか見えない。比較の追加モーダルは **200px**（一覧の **62.5%**）。一覧の 1 行は **93px**（幅 1280）／ **213px**（幅 768 以下）で、**1 画面に収まるのは 2 行**（表の上端が y=385 にあるため）。**★既定を「末尾省略のまま」にした開発者裁定（案 A）は、この 2 行という数を材料にしている。**

### M24-04: エディタ操作・dirty state・入力事故の防止（2026-08-28）

- **結果**: **`go test ./... -count=1` 55 パッケージ ok / FAIL 0（着手前と同一＝Go は 1 バイトも触っていない）／ `pnpm test -- --run` 195 files・2067 tests 全 pass（着手前 191 / 1998）／ `tsc --noEmit` エラー 0 ／ `make e2e` 203 passed・0 failed・0 flaky（exit 0）。★数値は開発者の手動確認まで済ませた後である〔レビュー取り込み前 vitest 2056 / e2e 198、手動確認前 e2e 200〕。消費マイグレ **0 本**（次は `000080` のまま）／ 消費 CHANGE 番号 0 件（`CHANGE-137` は設計卓が起票済み・その射程内）／ 新規依存 0 件 ／ ブラウザストレージ新キー **0 件** ／ `internal/` `cmd/` `migrations/` の差分 **0 バイト**（分岐 A で着地）。** 9 項目のうち **8 件を実装**し、`SM-067` は開発者裁定「変えない」で決着。離脱ガード（`web/src/features/navigation-guard/`）を新設し、入力面を幅で切り替える形（lg 未満＝タブ 2 枚 ／ lg 以上＝2 カラム＋「メタデータを隠す」でレシピ全幅）へ。
- **報告**: 完了報告 [`M24-04-completion-report.md`](M24-04-completion-report.md) ／ レビュー [`m24-04-review.md`](m24-04-review.md)（**重大 3 件・高 2 件・中 3 件・低 5 件。採否は 重大 3/3 採用・高 2/2 採用・中 3/3 採用・低 3/5 採用〔2 件は申し送り〕。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**） ／ 画面変更のモック [`M24-04-mock/m24-04-screens.html`](M24-04-mock/m24-04-screens.html)（**Plan Mode の承認直後・実装前に提示済み**）
- **★横断課題**:
    1. **★★`REQ-001` §7 の「編集中の画面遷移時データ保持」は未達のままである。** `CO-003` の followup 行は 2 要求を 1 行にまとめており、本サブが実装したのは dirty 確認（「止める」）だけ。**入力内容はブラウザストレージにも React 外にも一切保存していない**（確認ダイアログの本文にも「戻ってきても復元されません」と明記した）。**followup `F12-3 / E-3` を 2 行へ割るのは設計卓の手番。**
    2. **★★`SM-093`（状態の既定を不問に）は表示だけの変更ではなかった。** 実査で **空文字と `any` は同じ扱いではない**と判明——保存時に `nullIfEmpty` を通り `""` は NULL、`"any"` は文字列になり、**重複判定キー（`VAL-C02`）と一覧フィルタの等値比較で別の値になる。** ⇒ 今後の新規登録の保存値が変わる（既存データには触れていない）。**`CHANGE-137` の射程へ `DES-006` を加えるかは設計卓の判断。**
    3. **★★コンボ登録/編集画面にはヘッダが無い**（`ComboEditorPage` / `SetupEditorPage` とも `Header` を呼ばない。ヘッダを描くページは 17 本）。**⇒ チェックリスト 4-1 が言う「ヘッダのリンク」はこの画面では起こらない。** PC 幅では画面内リンクが 1 つも無く、離脱導線は「キャンセル」ボタンとブラウザバックだけである。実装は **document の click キャプチャで画面内リンクを一括で捕まえる**形にしたため、将来ヘッダを足しても素通りしない。**`SM-060` が名指しした「ヘッダでの画面遷移」は保存後の遷移先（一覧・詳細）で起きている。**
    4. **★★破壊確認 2 の予測が外れた（隠さず記す）。** 指示書 §5.3 は「E2E (2) が赤くなる」としていたが、素朴に書いた「保存直後の遷移で確認が出ないこと」は**dirty を落とすのをやめても緑のまま**だった——**通常の保存はプログラム側から `navigate()` で遷移し、その遷移は離脱ガードを通らない**ため、dirty の有無に関わらず確認は出ない（＝何も観測していない）。**⇒ 「保存は成功したが警告があるので画面に留まる」分岐（1 ステップ目を技以外にすると `VAL-C03` が出る）を使う形へ作り直して初めて赤くなった。** `D-572` の実例。
    5. **★`useBlocker` は使えない。** 本アプリは `<BrowserRouter>` ＋ `<Routes>` で data router ではなく、react-router 6.30 の `useBlocker` は data router 専用である。`createBrowserRouter` へ移すと `AuthGate` / `CurrentUserProvider` / `App` の合成と `MemoryRouter` で描く既存コンポーネントテスト群に波及するため、**ルータ移行はしていない**。**⇒ 離脱ガードを入れたい他の画面も、同じ自前の仕組み（`useUnsavedChangesGuard`）を通すこと。第 2 の方式を作らない。**
    6. **★`SM-148` を「幅で切替」にしたのは E2E の被害範囲が決め手だった**（開発者裁定）。**PC 幅でタブに割って片側を隠すと、`/combos/new` を開く既存 spec 23 本の大半が赤くなる。** 幅で分ける形にしたため既存 spec は無傷（198 passed のうち本サブ分は 9 件）。**★後任がこれを「中途半端」と読んで全幅タブへ寄せると、その 23 本を一度に壊す。**
    7. **★`SM-112` の旧称リテラルは ledger の見込み「2 か所」ではなく 5 箇所だった**（`SetupRecipeEditor` の `renderStepLabel` にフォールバックが隠れていた）。定数 1 本へ集約済み。**★共有定数 `MOVE_CATEGORY_LABEL_JA.system`（「システム」）は変えていない**——消費者が 8 か所あり、被りの解消には不要だから。
    8. **★E2E の flaky を retry で流さず根治した。** ガードは「dirty になった次の描画」で張られる（番人の履歴エントリを積むのは `useEffect`）ため、待たずに `page.goBack()` を押すと本当に戻る。**張られたことの目印を出して待つ形にした。**
    9. **★自分の採取ミスを 1 件記録する。** **着手前の `make e2e` を採っていない**（モック提示を先に済ませたため、最初のフル実行は既に spec を足した状態だった）。`M24-02` §7-2 と同じ落とし穴である。代わりに `playwright test --list` の件数で対照を作った（本サブ以外 189 件 / 総数 198 件）。
    10. **★★レビューが重大 3 件を検出した。いずれも既存 E2E が踏んでいない経路であり、`198 passed` と両立していた。** (1) `SetupEditorPage` が保存成功で dirty を落としていない（`ComboEditor` だけ対応＝2 面のうち 1 面）。(2) 下部「キャンセル」が離脱ガードを通っていない（上部だけ対応＝非対称）。(3) **番人の履歴エントリの後始末が無く、`navigate(-1)` 系の離脱が空振りする。** **⇒ (3) は API を作り直して是正した**——`requestLeave(任意の関数)` を廃し **`leaveTo(to)` / `leaveBack()` の 2 択**にした。**★任意の関数を預かる形は、番人 1 枚ぶんの補正がしようがないという意味で構造的に誤りだった。** **★教訓＝「同じ要求を 2 面へ掛ける」ときは、片面だけのテストで緑になる。網は面ごとに掛けること。**
    11. **★★タブへのエラー振り分けは完全一致では足りない。** バックエンドは `steps[0].moveId`（`fmt.Sprintf("steps[%d].moveId", …)`）、FE zod は `steps.0.moveId` を返す。完全一致集合だと**「基本情報」タブへ誤計上**し、利用者を直す欄の無いタブへ誘導する。前方一致へ是正。**★何ステップ目かは表示しない**——**BE の `stepOrder` は 1 始まり、FE zod の添字は 0 始まりで基点が違う。** 片方に合わせると他方が 1 つずれた番号を出す。
    12. **★件数は必ずその場で数え直すこと（規則が実際に誤りを 2 件捕まえた）。** 完了報告の初出「ヘッダを描くページ 17 本」は正しくは **15 本**（テストファイル 2 本を数えていた）、「`MOVE_CATEGORY_LABEL_JA` の消費者 8 か所」は正しくは **7 ファイル**。**★どちらもコマンドを併記していなかった箇所である。**
    13. **★整形した文字列を「出力」として載せてはいけない。** ポート確認をコマンド `|| echo "PORTS FREE"` と書きながら、出力を `PORTS FREE: 47390 / 5273 とも空き` と載せていた（そのコマンドからは出得ない行）。レビュー 中-1 で指摘され是正。
    14. **★★`SM-148` / `SM-118` は新サブに飲まれる可能性がある**（2026-08-27 設計卓連絡＝`D-578`）。エディタの全面テコ入れ（タブ分割 ＋ 1 カラム縦積み ＋ ボタン化 ＋ キーボード操作）を別サブで行う方針が検討中。**`SM-112` は飲まれない**（レシピ側で構造が変わらないため）。**★「飲まれたときに外すもの」の対応表を設計伝達レポート §4-3 に置いた**——**9 項目のうち 6 項目（`CO-003` / `SM-007` / `SM-101` / `SM-093` / `SM-112` / `SM-060`）は新画面と独立で残る。** **★あわせて「新規画面分を最後のコミットに寄せる」指示は本セッションでは受領しておらず、現在の履歴はその形になっていない**（`SM-148` / `SM-118` は 8 コミット中 3 番目の `1f82768`）。**履歴の組み替えは開発者の手番である。**
    15. **★選択肢の個数を実測した**（`D-578` の依頼。新サブの「何個までボタンにするか」の材料）。**母数 20 個の入力コントロールのうち選択式は 7 個（35%）。10 を超えるのは 4 つ**——技 **9〜136**（中央 90）／キャラクター **19**／起き攻めの全数 **12**／区分フィルタ **11**。**★技とキャラは今後さらに増えるため、線の内外が将来動く。** **★起き攻め 12 と補足フラグ 10 はすでにチェックボックス＝実質ボタンである。** 全表は完了報告 §15 と設計伝達レポート §4-1（設計卓は完了報告を読めないため両方に置いた）。
    16. **★★開発者の手動確認（2026-08-28）で 2 件の欠陥が出た。15 観点のうち 13 は想定どおり。** **どちらも「番人の履歴エントリ」の扱いが原因で、既存のどのテストも踏んでいなかった。** (1) **セットプレイ編集で保存したのに離れられない**——`markSaved()` は state 更新（非同期）なのに `navigate(-1)` は同期実行されるため、番人が残ったまま編集画面自身のエントリへ戻っていた。**★★レビュー 重大-1 で「dirty を落とす」側は直したが、それだけでは消えなかった——原因が 2 つあり、片方だけ直っていた。** (2) **リロードを挟むと「保存せずに離れる」で一発で戻れない**——`pushState` の state はリロードを跨いで残るため、番人の上で復帰して 2 枚目を積んでいた。**⇒ 確認なしで番人の補正だけを行う入口を新設し、保存後の遷移をすべてそこへ通した。あわせて番人の引き継ぎと起動時の片づけを入れた。** E2E 3 ケースと破壊確認 2 件（7・8）で「壊すと報告どおりの症状で赤くなる」ことまで固定した。
    17. **★★「履歴を操作する機構」は、機械検査だけでは穴が残った。** 本サブは E2E 200 passed・破壊確認 6 件・独立レビュー 1 回を通したうえで、**手動確認で 2 件出た**。**★どちらも `window.history` の実挙動（リロードを跨ぐ state の残存・同期/非同期の実行順）に依存し、jsdom と E2E の両方をすり抜けた。** レビュー報告書も「重大-1 / 重大-3 は実機確認を推奨する」と明記していた。**⇒ 履歴・タイマー・ブラウザ標準ダイアログに触る変更は、緑を根拠にせず手動確認を前提に見積もること。**
    18. **★保存後の遷移は離脱ガードの補正を通すこと。** 素の `navigate()` を書くと同じ穴が再発する。**★あわせて先行サブの assert 形式を更新した**——`navigate(dest, { replace: true })` の形になったため、`toHaveBeenCalledWith(dest)` を「遷移先だけを見る」形へ置き換えた（`M24-01` の遷移先テスト 3 本を含む・**遷移先そのものは 1 つも変えていない**）。**★引数の形は契約ではない。** 形で固定すると、履歴の補正を直すたびに遷移先の契約テストが巻き添えで落ちる。
    19. **★「相手の状態」というラベルが分かりにくい**（2026-08-28 開発者指摘・**本サブ起因ではない**）。逐語＝「状態という言葉が持つ意味が広すぎて、パット見で何を入れたらいいか分からない」。**`SM-093` では既定値だけを変えてラベルは触っていない。** 設計伝達レポート §4-1c へ回した（`opponent-stance-vocabulary-split` と同じ欄）。
    20. **★harness 由来の赤を証拠にしかけた。** 破壊確認で `pnpm exec playwright test` を直に叩くと `PW_EXECUTABLE_PATH` が渡らず、ブラウザ起動失敗で赤になる。**テストが観測した赤ではない。** `make e2e` 以外で単体 spec を回すときは同変数を明示すること。

### M24-12: エディタの作り替え（1 カラム縦積み ＋ タブ ＋ キーボード中心の入力）（2026-08-28）

- **結果**: **`make e2e` 208 passed / 0 failed / 0 flaky**（着手前 203 → +5）／ `pnpm test` **198 files / 2155 tests passed**（着手前 2067）／ `go test` **55 パッケージ ok・FAIL 0**（Go は 1 バイトも触っていない）／ **`internal/` `cmd/` `migrations/` の差分 0 バイト・マイグレ消費 0 本・新規依存 0・ブラウザストレージの新キー 0**。**★★指示書の版が 3 回上がった**——`v1.0.0` で着手 → 開発者の実機確認で 5 件（**`D-582`**）→ さらに 1 件（**`D-583`**）。**`CHANGE-138` も v1.2.0 で射程が広がったが、番号は消費していない**（設計卓が起票時に広げた）。**4 段が独立コミット**〔第 1 段 `c7dd285` ／ 第 2 段 `36a83c2` ／ 第 3 段 `97234f4` ／ **第 4 段は 2 コミットに分かれる**＝`f75e22b`（指示書 v1.2.0 の 4 件）＋ `b64159d`（スピナー撤廃を 9 欄へ拡大）〕。**そのほか**＝破壊確認の穴塞ぎ `5685f0d` ／ 1 回目のレビュー取り込み `312a96a` ／ 実機確認の 2 件 `5de3d49` ／ 旧データ NULL 経路のテスト `54b58a6` ／ 報告の v1.2.0 追随 `abc4beb`。**★レビューは 2 回**（`m24-12-review.md` 重大 0 / 高 4 / 中 7 / 低 6 ／ `m24-12-review-2.md` 重大 0 / 高 1 / 中 7 / 低 6。**★往復上限 2 回に到達した**）。
- **報告**: 完了報告 `docs/progress/M24-12-completion-report.md` ／ レビュー `docs/progress/m24-12-review.md`（**重大 0 / 高 4 / 中 7 / 低 6**） ／ 再レビュー `docs/progress/m24-12-review-2.md`（**重大 0 / 高 1 / 中 7 / 低 6**） ／ 設計伝達レポート `docs/handover/design-reports/20260829-m24-12-design-exceptions.md` ／ モック `docs/progress/M24-12-mock/m24-12-editor.html`
- **★横断課題**:
    1. **★★破壊確認 5 件のうち 2 件が空振りし、「守られていない経路」が 2 つ見つかった。** (1) **「タブ切替でアンマウントしない」を守るテストが 1 本も無かった**——フォーム state が `ComboEditor` へリフトアップされているため、子をアンマウントしても親から再描画されて値が消えず、「入力が消えない」系のテストは条件付きレンダリングでも緑のままだった（E2E 17/17 緑）。(2) **「保存後の遷移が補正を通る」を守る観測が無かった**（チェックリスト 1-2 ＝**重大**項目）——素の `navigate(dest)` でも遷移先には着くため、「確認が出ない」「URL が編集画面でない」では区別できない。**★★違いは履歴の枚数にしか出ない。** **⇒ どちらも観測を追加して赤くなることを確認した。** **★教訓＝「重大」と定めた条件ほど、それを実際に赤くするテストが在るかを破壊確認で確かめること。緑は「守られている」ことを意味しない。**
    2. **★★playbook §4.32 (b)「その壊し方で本当に観測が変わるか」が 2 つの理由で破れた。** (a) **jsdom は Tailwind CSS を読まない**ため、`class="hidden"` を付ける壊し方は単体テストで観測が変わらない（`lg:` が無害なのと同じ理由）。(b) **state がリフトアップされていると、子のアンマウントは値の消失として観測されない。** **⇒ 壊し方は「クラスを足す」ではなく「構造を変える」側で選ぶこと。**
    3. **★★ユニットテストに履歴由来の flake が 1 件あった（アプリの欠陥ではない）。** `ComboEditor.test.tsx` を通しで回すと 6 回に 1 回ほど「保存が成功すると dirty が落ちる」が落ちた（単体実行では 6/6 緑）。**機序＝`NavigationGuardProvider` の unmount 後始末が呼ぶ `history.go(-1)` は jsdom では非同期**で、RTL の cleanup で unmount された後に popstate が発火し、**次のテスト**へ流れ込んで新しいガードが「戻るが押された」と解釈していた。`afterEach` でマクロタスクを 1 つ空けて流し切り、8/8 緑にした。**★`CHANGE-137` 反映レポート §3-1 の一般形（履歴に触る変更は緑を根拠にしない）がテスト側にも当たった。**
    4. **★E2E が実装の欠陥を 1 件捕まえた。** 「キーボードだけで基本情報タブを最後まで進める」が 5 番目の欄で止まり、原因は**始動技が読み取り専用の表示でフォーカスを受けられない**ことだった（C-12 でプルダウンを撤去済み）。**⇒ フォーカスを受けられない停止点は数に入れない形にした**（読み取り専用の欄が将来増えても自動的に飛ばされる）。
    5. **★★E2E 書き換えの母数は合計だけ一致し、内訳はずれていた。** 見込み 30 / 実測 30 だが、per-file は `m21-05` が 7 の予測に対し実測 6。**しかも見込みの内訳は算術が合っておらず（9 ファイルの小計を 28 と書いたが和は 29）、2 つの誤りが打ち消し合って合計だけ正しく見えていた。** **⇒ playbook §4.40 がそのまま当たった。合計の一致を内訳の正しさの証拠にしないこと。**
    6. **★`m21-05` の 1 本が「隠れた要素」を見ていた。** `toHaveAttribute` は可視性を要求しないため、レシピパネルが `hidden` でも通っていた。**⇒ 観測対象が見えている要素になるよう直した。★`toHaveCount` / `toHaveAttribute` は隠れた要素にも通ることを、書くときに意識すること。**
    7. **★★状況コード値のラベルマップが 2 本ある**（`constants/combo-list.ts` ＝ 一覧・詳細・比較・出力・フィルタ・重複警告・utils の 7 面 ／ `features/combo/labels.ts` ＝ **エディタだけ**）。**17 値中 3 値が割れていた**〔`any`＝不問/どちらでも可 ／ `normal`＝通常/通常ヒット ／ `counter`＝カウンター/カウンターヒット〕。**本サブは開発者指示により `any` だけを正典へ寄せた。`normal` / `counter` は一覧の列幅の都合で意図的な可能性があり、どちらへ寄せるかの判断が要るため触っていない。⇒ 2 本の統合は横断リファクタとして申し送り。**
    8. **★離脱ガードの補正を通っていない素の `navigate()` が 3 か所残っている**（`handleTrashRestore` ／ `handleConflictGoToList` ／ `PromoteToFinalButton` の `onPromoted`）。**★POST 成功後の部分失敗 3 経路は本サブで直した**（開発者確認済み）が、残る 3 件は意味が違う——前 2 つは利用者が入力を捨てると承知して選ぶ経路であり、**むしろ確認を出すべきかという設計判断が要る**。3 つ目は保存に近く直す候補として筋が通るが別コンポーネントである。**⇒ 設計伝達レポート §4 へ。**
    9. **★`CHANGE-137` の 3 ブロックは `DES-005` §5.7 ではなく §5.6 の末尾（498〜525 行目）に置かれている**（`### 5.7` は 527 行目）。反映レポートは「§5.7 へ新設した」と書いているが、物理的には §5.6 コンボ詳細の中に在る。**製造は設計書本体を編集しないため報告に留める。**
    10. **★基本情報タブでマウスが要るのはタグ欄だけになった。** タグは上限が無く数字キーを割り当てられず、`TagSelector` に候補の矢印キー移動が実装されていない。**本サブの範囲外として申し送り。**
    11. **★モック HTML の提示タイミングが `M24-overview` §1.5 と食い違った。** 同節は「Plan Mode の提示に含める」と定めるが、**`implement_plan_full` の Plan Mode はプランファイル以外の書き込みを禁じており、Plan Mode 内でファイルを作れない。** ⇒ 開発者確認のうえ**承認直後・コード変更前**に提示する形を採った。**★同じ制約は `_wt` 版にも当たる。運用の型として整理が要る。**
    12. **★第 0 段で「新規のつもりの編集」ではなく「既存ファイルの一括置換」で事故りかけた。** モックの並べ替えで節名（`その他情報`）を接頭辞にしたスクリプト置換を行い、**変更前セクションの側に先に当たって右カラムを消した**（`div` 101 → 63）。**対応数の検査で気づき、コミット済みだったため `git show HEAD:<path>` で復元できた。** **⇒ 同じ形が繰り返し現れるファイル（`CollapsibleFieldset` は 6 回）では、節名ではなく一意な文字列を指して編集すること。教訓 `E-225` の隣接形である。**
    13. **★索引行を「まだ無いファイル」を指した状態でコミットした**（レビュー 低-15）。Phase D で本索引行を書いた時点では、Phase B のレビュー報告書はまだ生成されていなかった。**指示書 §7.5「工程順として『まだ無い』ものを過去形で書かないこと」に触れる。** **⇒ 索引行は Phase B/C の成果物が出揃ってから書くこと。★リンク切れは検査では捕まらない**——`check-progress-log-index.sh` が見るのは「完了報告に対応する追記の欠落」であって、リンク先の実在ではないためである。
    14. **★★設計書の失効箇所は、レビューではなく「設計書を直接開いて `grep` する」ことでしか全数にならない。** `DES-005` §5.7 の失効箇所は完了報告で 0 件、レビュー（中-9）で 6 件挙がったが、**設計伝達レポートの執筆時に §5.7 を直接開いて 7 件目が見つかった**——`CHANGE-068`／`M17-01` の「メディア 3 入力欄はメモの直後に置く」（`05-screen-design.md:635`）が、**メモを節末尾へ移した開発者指示で失効していた。** **⇒ 「設計書との差異」を書く節は、記憶からの転記ではなく実物の走査で埋めること。**
    15. **★★物理キーボード入力（`M21-05`）と画面側のショートカットは、既定では衝突する。** `useKeyboardInput` は `window` の **capture 段**で `preventDefault()` するため、後から足した画面側のキーハンドラは**二重発火**するか**黙って負ける**かのどちらかになる。**⇒ 画面側にキーハンドラを足すときは `event.defaultPrevented` を必ず見ること。** 本サブは二重発火を塞いだが、**「割り当て済みのキーが勝つ」は `useKeyboardInput` の作り替えを伴うため申し送りとした**（指示書 §9.1）。 **★★2026-08-29 開発者裁定＝エディタ側は変えず、キーボードの技設定時に警告を出す**〔対象＝`Digit1`〜`Digit0` ／ `ArrowDown` `ArrowUp` ／ `Numpad1`〜`Numpad0`。**★割当は `code`、エディタのショートカットは `key` を見るため、Numpad も対象になる**〕。**★頻度は実測で二分された**——**未登録 0% ／ 英字割当ほぼ 0% ／ 数字割当なら選択肢を選ぶたび毎回**。**★危険な停止点は本サブでむしろ減っている**（起き攻めの 12 チェックボックスが roving tabindex で 3 停止へ畳まれ、23 → 15）。
    16. **★★「A をやめたら B が壊れる」という期待は、B が本当に A を見ているかを確かめてから書くこと。** 破壊確認 7（タグ欄で順送り時に候補を開くのをやめる）が空振りした。指示書は「E2E (5) とコンポーネントテストが赤くなる」と期待していたが、**E2E (5) は「タグ欄で止まらない」しか見ておらず、開くのをやめても成立する**——**むしろ開かないほうが通りやすい。** **⇒ B は A の必要条件ですらなかった。** コンポーネント側も「印が付いているか」しか見ておらず、**印を読む側を見ていなかった。** ⇒ E2E (5) へ観測を足して赤にした。**★本サブの空振りは通算 3 件**（タブ切替のアンマウント ／ 保存後の遷移の補正 ／ タグ欄で候補を開く）。**いずれも「守っているつもりの経路に、それを守るテストが 1 本も無かった」形である。**
    17. **★★破壊確認の壊し方が `vite build` を落とすと、赤の意味が確かめられない。** `false && ...` の形は TypeScript が通らず、**E2E の webServer が起動しない**（`Process from config.webServer was not able to start`）。⇒ **属性名を存在しないものへ変える**等、**ビルドが通る壊し方**を選ぶこと。
    18. **★★`<input type="number">` の `step` は「消す」と既定 1 になる。** ゲージ欄で `step={0.5}` を素直に削ると、**最もよく使う `0.5` が `stepMismatch`（ブラウザ的に不正な値）になる。** **⇒ 「刻みの制約は無い」は `step="any"` で明示する。** **★本アプリでは現時点で実害がゼロである**（`<form>` も `:invalid` のスタイルも無い）**が、将来フォームで囲んだ瞬間に黙って弾かれ始める。** しかも原因は「フォームを足した変更」に見えて追いにくい。
    19. **★★Radix の Popover を順送りから開くと、フォーカスが Portal 側へ飛んで順送りが行き止まりになる。** `PopoverContent` は `<body>` 直下に描かれるため、「このパネルの中に居るときだけ効く」ガードに掛かる。**⇒ 開いた直後に `requestAnimationFrame` でトリガへフォーカスを戻す**（Radix は effect の中で移すため、同じターンでは上書きされる）。**★E2E が実際に捕まえた**——素直に実装すると「タグ欄を開いた結果タグ欄から出られない」状態になっていた。
    20. **★「N 個ある」と書かれた列挙は、指示書でも数え直すこと**（playbook §4.40）。v1.2.0 で 2 件ずれていた——**§5.1「E2E 6 ケース」は列挙 7 件** ／ **§7.1-1「実査 12 件」は表 18 行**。**`CHANGE-136` の「3 経路」（実は 4 経路）と同じ型である。**
    21. **★実装の射程は、指示書の名指しより実物のほうが広いことがある。** §4.9 は「ゲージ 4 欄」と名指ししていたが、基本情報タブの `type="number"` は **9 欄**あった。**開発者の理由（スピナーは便利でない）は 9 欄すべてに同じだけ当てはまる。** **⇒ 名指しに従って 4 欄だけ直すと画面がまだらになる。実測して報告し、裁定を得て広げた。★あわせて 4 欄の外の `ドライブダメージ` にも `step={0.5}` が残っていた**（`VAL-C13` は刻みを見ていないので **UI だけが主張している状態**だった）。
    22. **★★「数え直す」だけでは足りない。数える源泉を間違えると同じ誤りが出る。** 実査 §3.3-17（`type=flag` の状態名の全数）で「全 11 状態中 5 件」と報告したが、**実在は 9 状態中 4 件**だった（2 回目のレビュー 中-2）。**機序＝マイグレーション SQL を静的に走査したため、後続の `000017_cleanup_ajg_seed_and_unify_ryu_move_code` が `aki` を削除していることを見落とした。** **⇒ seed データの母数は、マイグレーションを使い捨て DB へ適用してから数えること**〔`COMBOMGR_DB_PATH=.tmp-probe.db go run ./cmd/combomgr` → `sqlite3 -readonly` で照会〕。**★`grep` で数えられるのは「書かれた回数」であって「実在する数」ではない。**
    23. **★★教訓を書いただけでは守れない。** 完了報告 §14.1 に「設計書の失効箇所は、記憶からの転記ではなく実物を開いて `grep` すること」と書いた同じ報告書で、**v1.1.0 / v1.2.0 の失効箇所 5 行を取りこぼした**（2 回目のレビュー 高-1）。**`grep -n "0.5 刻み\|0.5刻み" docs/design/05-screen-design.md` を 1 回打てば出た。** **⇒ 失効箇所を挙げる節には、使った `grep` の出力そのものを添えること。** 添えれば「打っていない」が一目で分かる。
    24. **★破壊確認で塞いだ穴が「片側だけ」になっていないか確かめること。** 破壊確認 7 の空振りを受けて E2E (5) へ観測を足したが、**指示書 §5.1 はコンポーネント層にも同じ要求をしており、そちらは空のままだった**（2 回目のレビュー 中-6）。**⇒ 「どの層で書けているか」は指示書の表に書いてある。空振りを直すときは、その表の全列を見ること。**

### M24-13: 仮登録もレシピのステップ 1 本以上を要する（2026-08-29）

- **結果**: `go test ./... -count=1` **55 パッケージ ok / FAIL 0**（着手前と同じ）／ `pnpm exec vitest run` **198 files / 2166 tests passed**（着手前 2156）／ `make e2e` **215 passed / 0 failed**（着手前 208）。**マイグレ消費 0 本・新規依存 0・ブラウザストレージの新キー 0。** **★★本サブは 2 本立てである**——**`VAL-C09`＝適用範囲を広げる**（既存 1 本のガードを外すだけ。新しい VAL を作らず `VAL-D02` も 1 文字も変えていない） ／ **`VAL-S04`＝判定の位置を移す**（`D-588` で着手後に射程が広がった。`M24-11` の `ComboDuplicateAdapter` を踏襲）。**★既存データのステップ 0 本の仮登録は 0 件だった**（開発者のローカル DB で照会。コンボ総数 86）。**★破壊確認は 5 件 ＋ 自発的な 5b の計 6 件。**
- **報告**: 完了報告 `docs/progress/M24-13-completion-report.md` ／ レビュー `docs/progress/m24-13-review.md`（**重大 0 / 高 3 / 中 4 / 低 5。全 12 件を採用・不採用 0**） ／ モック `docs/progress/M24-13-mock/m24-13-save-blocked.html`
- **★横断課題**:
    1. **★★`SUPP-001` §2.1 の 2 行（`:93` / `:94`）と `REQ-001` FR305 が失効した。★指示書も `CHANGE-139` も影響先に挙げていなかった。** 挙がっていたのは `DES-006` §2.2 ／ `REQ-001` FR009 ／ `DES-005` §5.7 ／ `DES-002` §4.2 の 4 つだけである。**⇒ 「影響設計書」の欄は起票時の見込みであって全数ではない。as-built で設計書を直接 `grep` して数え直すこと**（`M24-12` 教訓 14 / 23 の再来。**★しかも本サブは 1 度取りこぼした**——走査語を「全て適用しない」「仮登録＋レシピ／空」に限ったため FR305 に当たらず、レビュー 中-1 で拾われた。**⇒ 走査語そのものを複数の言い換えで用意すること**）。
    2. **★★画面から到達できる検証エラーが 1 件も無くなった。** メモ（`maxLength=2000`）・ステップメモ（`maxLength=200`）・数値欄（`clampNumericString`）はすべて UI 側で上限が掛かっており、**残る唯一の経路だった「レシピ 0 件」を本サブが塞いだ**ためである。**⇒ `M24-04`（SM-148）／`M24-12` の「エラーの在り処をタブ見出しで示す」は、実装としては生きているが利用者が見る機会がほぼ無い。** `VAL-C02` は `field` が空で振り分け対象外（モーダルで出る）。**★E2E は `page.route` でサーバ応答を差し替える形へ替えた**（先例＝`m22-01` / `m22-02`。命題も主張も不変）。**機能そのものの位置づけは設計卓の判断が要る。**
    3. **★★「A をやめたら B が壊れる」は、B が本当に A を見ているかを確かめてから書くこと**（`M24-12` 教訓 16 の再来）。E2E の対照「警告なしで通る」が `body.warnings` を見ていたが、**同欄は `VAL-C14` 専用**であり検証 WARNING は `body.validations.issues` に入る。**⇒ 何本警告が出ても常に真になる assert だった**（レビュー 高-3）。**★直したあと、故意に `VAL-C03` を発火させて赤くなることを実測してから戻した。**
    4. **★★`BEGIN IMMEDIATE` があると「直っていなくても緑」になる**（`M24-11` の教訓がそのまま当たった）。破壊確認 5b（**束ねだけを外す**）を自発的に足したところ、**競合テストは緑のまま**で `..._SeesUncommittedSiblings` の 1 本だけが赤くなった。**⇒ `D-360`（tx を取るならその tx を読みにも使う）を守っていることを見ているのは、同一 tx 内のテスト 1 本だけである。★この 1 本を消すと、束ねが外れても誰も気づかない。**
    5. **★★`VAL-S04` は競合とは別に決定論的な穴を持っていた。** `CreateSetupInTx`（`POST /api/combos` の同梱セットプレイ）は tx を持ちながら判定が `*sql.DB` 直読みで、**同一リクエストの 2 本目が 1 本目を見られていなかった**。**⇒ 名前だけ違う同一レシピが 2 本通っていた**（`VAL-S04` は名前を見ない）。**★既存テスト 2 件がその穴に乗っていた**（`TestService_Create_WithMultipleSetups_OK` ／ `TestService_Create_BundledVerifiedConditions_PerSetup`）。**緩めずに fixture のレシピを分ける形で直した。** **★CSV 取込へは波及しない**（`CreateSetup` を 1 本ずつ呼んで個別にコミットするため、2 本目は以前から見えていた）。
    6. **★母数は「見る単位」で割れることがある。** `VAL-S04` の適用面は **判定関数の呼出元 3 ／ 入口（API ＋ CSV 取込）4** であり、followup の「3 経路」は前者としては正しい。**⇒ `M-89`（3 と書いて実は 4）の型を、数を訂正するのではなく単位を明示することで避けた。**
    7. **★★`pnpm exec tsc --noEmit -p tsconfig.json` はテストファイルを型検査しない。** 本サブで実際に取りこぼし、`tsc` が緑のまま `pnpm build` が落ちた。**`make e2e` は `pnpm build` を通るため webServer が起動せず、「赤の意味が確かめられない」状態になった**（`M24-12` 教訓 17 の隣接形）。**⇒ フロントの型検査は `pnpm build` で見ること。**
    8. **★★回していない検査の結果を完了報告へ書いた**（レビュー 高-1）。`check-progress-log-index.sh` を「違反なし」と書いたが 1 度も回しておらず、実測は `NG 1 件` だった。**★報告書 §10 の緑は、後任にとって「回した証拠」として機能する。⇒ 検査表は 1 行ずつ実際の出力から埋めること。** **★是正の記録は消さずに §10 へ残した。**
    9. **★E2E の spec ヘッダのコメントは、本文を直しても取り残される。** 「仮登録モードで保存するためステップ入力は不要」が 4 か所残り、**直後の行が `addMinimalRecipeStep` を呼んでいる**状態になっていた（レビュー 高-2）。**⇒ 本文を直したら、同じファイルのヘッダを `grep` で当たること。**
    10. **★★「失効記述の走査」は設計書だけでは足りない。実装側の *利用者に見える文字列* が残った**（2 回目のレビュー 高-A）。仮登録トグルのラベル「仮登録として保存(**★レシピ未入力**や重複コンボの登録等を許容)」が残り、**同じ画面の下で保存ボタンが `disabled` になって「レシピを 1 つ以上入力してください」と出る**——**画面が上下で正反対のことを言っていた。** **★しかもテスト 2 本が旧文字列を固定しており、後から直すと赤くなる形だった。** **★モック HTML はトグルのラベルを描いていないため、開発者の目視確認でも見えなかった。** **⇒ 失効記述の節は「設計書」「コメント」「利用者に見える文字列」の 3 面を別々に走査すること。**
    11. **★★「数値は書く前に採る」。本サブで同型を 3 度やった。** (1) 回していない検査を「違反なし」と完了報告へ書いた（1 回目 高-1） ／ (2) 取り込み後に `git diff --stat` を採り直さず、**deletions が減っているのに気づかなかった**（2 回目 低-B。古いのではなく両方向にずれていた） ／ (3) 再実行の表に実行前の見込み値を書きかけた（実測は ±0 で、書きかけの値は誤りだった）。**★報告書の数値は後任にとって「回した証拠」として機能する。**
    12. **★「唯一の観測である」と書くときは、消費側が本当にそれを見ているかを確かめること**（2 回目 中-A）。BE の `field` 書式を固定するテストを足したが、押さえたのは `VAL-C08`（**WARNING**）であり、**フロントの `countErrorsByTab` は `severity !== "error"` を捨てる**。⇒ 前方一致 `steps[` を本番で実際に通る唯一の生産者は `VAL-C12`（ERROR）だった。**★同じ書式文字列でも呼び出し箇所が別なら、片方だけ変えられる。**

### M24-09d: テスト実行基盤の高速化（2026-08-30）

- **結果**: `go test ./... -count=1` の **wall 137.2 秒 → 43.2 秒（−69%）**。**ok 55 パッケージ / FAIL 0 / skip 5 は不変で、消えたテストは 0 本**（集合差分で確認。増分は本サブが足した 4 本ちょうど）。`make e2e` **全数緑（215 件）** ／ Vitest **198 files / 2,166 tests** ／ `pnpm build` 緑。**マイグレ消費 0 本・新規依存 0・ブラウザストレージ新キー 0・`CHANGE-145` の番号は消費していない。** 方式＝**テストバイナリごとに 1 回だけマイグレーションを流し、テンプレートをメモリ上のバイト列で保持して各テストへ書き出す**（`Setup` / `SetupWithPath` の署名は不変＝呼び出し元 213 か所を 1 行も触っていない）。**除外は `internal/infra/migration` の 1 本のみで、効いていることは速度ではなく `dbtest.MigrationRunCount()` で観測する。**
- **報告**: 完了報告 `docs/progress/M24-09d-completion-report.md` ／ レビュー `docs/progress/m24-09d-review.md`（**重大 0 / 高 2 / 中 2 / 低 7。高 2・中 2・低 5 を採用、低 2 件を設計卓へ回した。不採用の「高」は 0 件**）
- **★横断課題**:
    1. **★★`DES-002` §11.3 の契約 (4)「★E2E は CI に載せない。★否定形で書いておかないと、次の担当が再実行で緑にして載せる」が as-built で失効した。** 本サブは nightly へ E2E job を載せている。**★`CHANGE-145` の影響設計書欄は `SUPP-001` §5.5 / §4.5 のみで `DES-002` を含まず、起票時に誰も参照していなかった**——**契約自身が予告していた事態が、契約を読まないまま起きた形である。** 失効箇所は実査で 3 か所（`02-architecture.md:1168` の契約 (4) ／ `:1153` の表の「nightly クロスビルド」行 ／ `:1189` の「CI は本フェーズでは構築せずローカル実行」）。**⇒ 設計卓の手番**（`M24-13` 横断課題 1 と同型＝「影響設計書」の欄は起票時の見込みであって全数ではない）。
    2. **★★`M24-13` 横断課題 7 の「`pnpm exec tsc --noEmit -p tsconfig.json` はテストファイルを型検査しない」が再現しなかった。** 4 通りの実験（`src/` 配下のテスト ／ `web/e2e/` の spec ／ `tsc -b` ／ `tsbuildinfo` の有無）で**両経路の守備範囲は同一**であり、外れているのは **`web/e2e/`（spec 58 本）と `playwright.config.ts`** である（`tsconfig.json` の `include` が `["src","vite.config.ts"]`＝`SUPP-001` §4.5 の「積み残し」そのもの）。**⇒ `web/CLAUDE.md` §3 には実測のほうを書いた。** followup `§AR` の `tsc-noemit-excludes-test-files` の記述は旧のまま残っており、**設計卓の手番**。
    3. **★これ以上の `go test` の短縮は `internal/infra/migration` に手を入れない限り得られない。** 導入後の wall 43.2 秒のうち **37.6 秒が同パッケージ**であり、その 99 テスト中 **97 本が自前で `migration.Run` を呼ぶ**（`dbtest.Setup` を使うのは 2 本だけ）。**⇒ 本サブのスコープ外（§1.6-3）。やるなら別サブの規模になる。**
    4. **★★nightly の `e2e` job は、マージ前に CI 実機で観測済みである**（2026-08-30・開発者が本ブランチで手動起動。**緑 / 215 passed / failed 0 / flaky 0 / ランナー 2 コアで 335 秒**）。**★件数がローカルと一致した（215）ことが、job の緑よりも強い根拠である**——「緑だが 1 件も走っていない」（`E-125`）が排除されたため。**⇒ `CHANGE-145` §2.2 の条件「§4.3 が成立した場合のみ `SUPP-001` §4.5 を反映」は満たされた。設計卓の反映対象である。** **★残るのは 2 つ**——(a) 先回りした手当て 2 件〔`Warm Go build cache` ／ `playwright install --with-deps`〕**が必要だったかは切り分けていない**（外すなら実測すること） ／ (b) **破壊確認 4 を「本物」で採るかは未了**（製造セッションからは `mcp__*` と `gh` が deny のため起動できず、ローカルで job の打つシェル構文を回す代替に留めた。未検証のまま残るのは GitHub 自身の step 失敗の契約だけである）。**★あわせて devContainer での `make e2e-only` も実測済み**（`Using preinstalled Chromium: /usr/bin/chromium`）。**⇒ クラウド／devContainer／CI の 3 環境すべてで `PW_EXECUTABLE_PATH` の解決経路が通った。**
    5. **★除外（`internal/infra/migration`）は、現時点では既存テストの結果を 1 本も変えていない。** 破壊確認 2 で除外を外しても、赤くなったのは本サブが足した観測 1 本だけで既存 99 テストは全緑、所要も 0.9 秒しか変わらない。**残す判断とその根拠 3 件は完了報告 §9 にある。⇒ `CHANGE-145` を as-built へ合わせるとき、この事実を落とさないこと。**
    6. **★ワークフロー名を `Nightly cross-build` → `Nightly` へ変えた**（job が 2 本になったため）。`README.md` 3 か所を追随済み。**必須 check ではないため PR への影響は無い。**
### M24-05: セットプレイ導線・紐付け UI 統合（2026-08-30）

- **結果**: `go test ./... -count=1` **全パッケージ ok**（着手前と同じ。`internal/` / `cmd/` / `migrations/` の差分 **0**）／ `cd web && pnpm test` **199 files / 2192 tests passed**（着手前 198 / 2166）／ `make e2e` **222 passed**（着手前 215）。**マイグレ消費 0 本〔次は `000080`〕・新規依存 0・ブラウザストレージ新キー 0・スキーマ変更なし。** **★★核心＝`CO-002` は「役割が被っている」ことを API・SQL・react-query の `queryKey` まで下りて実測してから消した**（両者は同一エンドポイント・同一 SQL・同一キャッシュだった＝指示書 §3.3-2 のゲート）。**★候補 0 件でもセクションを出す**（`D-588`）。**★`SM-088` は既に成立しており実装していない**——規則の実測値は **ja `"{{move}} 持続{{n}}F目重ね"`** で、**設計卓の暫定案 `{attack_type}・{最後の技}` とは一致しない**。**★`SM-146` は射程外であり 1 行も触れていない。** **★破壊確認 3 件。**
- **報告**: 完了報告 `docs/progress/M24-05-completion-report.md` ／ レビュー `docs/progress/m24-05-review.md`（**重大 0 / 高 4 / 中 8 / 低 5。採用 15 件・不採用 2 件〔いずれも設計卓の手番であり製造が触れないもの〕**） ／ モック `docs/progress/M24-05-mock/m24-05-link-ui.html` ／ 設計伝達レポート `docs/handover/design-reports/20260830-m24-05-design-exceptions.md`
- **★横断課題**:
    1. **★★開発者から新規の要求が出た**——**「編集については、KA入力して既存セットプレイを検索して紐づけるような形にしたい」**（逐語）。**⇒ コンボ登録・編集エディタ側の `SetupSelectorModal` は本サブでは消していない**（代替の形がまだ無く、消すと登録中に既存セットプレイを紐付ける手段がゼロになるため。**母集団も詳細画面側とは別で、「当該コンボ未紐付け」条件が効かない**）。**★新機能として起票が要る。`DES-002` §4.2 の経路が要る見込み。**
    2. **★★チェックリスト v1.0.0 が指示書 v1.1.0 と食い違ったまま残っている。** 実査件数（12 → 正 9）／ E2E ケース数（4 → 正 3）／ 破壊確認件数（5 → 正 3）／ 参照先 `§3.3-4` `-5` `-10` と `§7.1-8` が v1.1.0 に存在しない。**★`check-instruction-format.sh` は指示書内の版数一致しか見ておらず、この版ずれを緑のまま通す。** **⇒ 改版は設計卓の手番。検査への追加も検討されたい。**
    3. **★★`SM-052` の実体は指示書の見立てと違った。** 指示書 §4.2 と `CHANGE-140` §2.2 は「`RecipeText` へ通せば解ける」としていたが、実体は **modifiers 要約表示の 2 重実装**（flags を内部コードのまま出す・notes を本文ごと行内展開する・型だけのステップで主ラベルと同じ情報を内部コードで二重に出す等 5 点）。**⇒ 共通部品 `ModifiersSummary` へ寄せて解決した。★症状の記述と機序は別に確かめること。**
    4. **★★`internal/service/setup` に記述と実装の食い違いがある**（本サブでは触っていない）。`validate.go` のコメントは「レシピ未変更でも実行する」だが、呼び手は `if input.Steps != nil` の内側でしか `ValidateSetupUpdate` を呼ばない。**⇒ `steps` 抜きで `name: ""` を `PATCH` すると `VAL-S06` が走らない**（画面からは踏めない）。**レビューも独立に追試して事実を確認済み。★割付先の判断が要る。**
    5. **★記録の訂正 2 件**——**離脱ガード 3 フックの出所は `M24-12` ではなく `M24-04`(CO-003)**（指示書 §3.3-11 と followup `setup-editor-not-on-shared-editor-parts` の記述が誤り。`M24-12` は `SetupEditorPage.tsx` を 1 度も変更していない）／ **followup `setup-recipe-display-not-through-shared-component` の「5 か所」は実測 12 か所**（`SetupRegistrationSection` が漏れていた。**信じていれば 1 か所取り残していた**）。
    6. **★★射程を削ると、その項目に紐づく観測も一緒に消える。** チェックリスト §8 が最大の危険 2 件のうち 1 件に挙げた「入力済みの名前を上書きしない」は、指示書 v1.1.0 が破壊確認 5 を落とした結果、**どの層にも観測が無くなっていた**（レビュー 中-4 で発覚し、本サブで 1 ケース足した）。**⇒ 射程を動かしたら、その射程が守っていた観測を数え直すこと。**
    7. **★コピー直後にレシピを変えずに保存すると `VAL-S04` で止まる**（コピー先の親に同一レシピが既に紐付いているため）。**仕様どおりの挙動であり、memo の「途中までレシピが同じ場合がある」とも整合するが、`DES-005` §5.9 へ 1 行残さないと後任が「コピーが壊れている」と起票する。** E2E に対照ケースとして固定した。
    8. **★★開発者の実機確認（2026-08-30）で 2 件出た。** **(1)** **`DES-005` §5.4 の「通常は末尾省略、トグルで全文表示モードへ切替」というモデルが、コンボ詳細では成立していない**——同面だけ `compactClassName` が `whitespace-pre-wrap break-words` で幅の制約を持たないため、**OFF でも全文が読める**。⇒ トグルが実際に切り替えているのは「ステップごとの改行＋連番」であり、ラベル「レシピ全文表示」が機能を表していない。**★`M24-03` / `CHANGE-134` 由来であり `M24-05` は挙動を変えていない**（`RecipeText.tsx` の差分はコメントのみ）。**★語彙は `DES-005` §5.4 に記録されているため、直すなら語彙ごと決め直す必要がある**（設計伝達レポート §4-10 へ申し送り）。 **(2)** **★★製造の説明が不正確で、開発者の検証を妨げた**——`SM-052` の変更点を「中身が空でも灰バッジが残っていた」と書いたが、**完全に空の修飾は画面操作では作れない**（`ModifiersEditor` が中身ゼロなら `undefined` を返す）。実際に見えていたのは**型だけのステップで主ラベルの日本語と同じ情報が内部コードで二重に出ていた**状態だった。開発者の回答は「空のときの変更前後は何のことか分からず検証できず」。**⇒ 変更点を説明するときは「その状態を画面操作で作れるか」を確かめてから書くこと。★誤記は 7 か所へ複製されており、全数を訂正した。**

### M24-06: 取込・出力の UX（2026-08-30）

- **結果**: `go test ./... -count=1` **全パッケージ ok**（`internal/` / `cmd/` / `migrations/` の差分 **0**）／ `cd web && pnpm test` **全数緑（202 files / 2246 tests）**／ `cd web && pnpm build` 緑 ／ `make e2e` **全数緑（226 件）**。**マイグレ消費 0 本〔次は `000080`〕・新規依存 0・ブラウザストレージ新キー 0・スキーマ変更なし。** **★★核心＝`/export/combo` を廃止した**——実態確認で「しかできないこと」が **4 件／母数 12** 見つかったため**停止して開発者の判断を仰ぎ**（指示書 §11 確認事項 2）、**逐語「廃止する (memo の方向)」**を得た。判断材料は「アプリ内バックアップは未実装だが DB ファイルのコピーが成立している」「CSV は **1000 件で静かに打ち切られる**ためバックアップとして成立していない」。**★`SM-071` は FE で除外し BE は弾かない**〔API 直叩きでは入る。不変条件ではない〕。**★`SM-075` の自動命名は外側だけ。ZIP 内のエントリ名は `combos.csv` / `setups.csv` のまま固定。** **★`CO-023` は着手時点で既に入っており実装していない**〔成立をテストで固定〕。**★`SM-110` は 1 語も変えていない**〔候補 20 語を `M24-07` へ渡す〕。**★破壊確認 5 件 ＋ 追加 1 件。**
- **報告**: 完了報告 `docs/progress/M24-06-completion-report.md` ／ レビュー `docs/progress/m24-06-review.md` ／ モック `docs/progress/M24-06-mock/m24-06-import-export-ux.html` ／ 設計伝達レポート `docs/handover/design-reports/20260830-m24-06-design-exceptions.md`
- **★横断課題**:
    1. **★★`DES-006` の節番号が 3 文書で誤っている。** 指示書 v1.2.0・チェックリスト v1.2.0・`CHANGE-144` v1.2.0 が一貫して「`DES-006` §5（取込 VAL）」と書くが、**§5 はタグ編集**であり取込 VAL（`VAL-I01`〜`I10`）は **§6** である。**⇒ §6 を正として作業した。3 文書とも設計卓の手番。**
    2. **★★ZIP エントリ名の定数が 2 パッケージに独立して定義されている。** `internal/service/comboio/types.go:11-13`（export 側）と `internal/api/comboio/handler.go:42-43`（import 側）。**片方だけ変えれば Go テストも E2E も赤くなるが、両方を同時に変えると緑のまま `DES-002` §7.6 の往復対称が壊れる。** 一本化は `internal/` に触るため本サブでは行っていない。**⇒ 割付の判断が要る。**
    3. **★★E2E だけでは「ファイル名が衝突しないこと」を決定的に検出できない**（破壊確認 4b で判明）。2 回の出力が同じ秒に落ちたときだけ衝突するため、retry が秒をまたぐと緑になる。**決定的に守っているのはクロックを注入した純粋関数テストである。⇒ 「時刻に依存する性質」は E2E ではなく純粋関数側へ観測を置くこと。**
    4. **★★計測器を取り違えかけた（`D-570` の再来）。** `make e2e` 前のポート確認に使う `ss` も `netstat` も**本環境に存在せず**、`(ss || netstat) | grep ... || echo "空き"` が**常に「空き」と答える**。**⇒ 対照実験（既知の listener を立てて USED と答えるか）を通してから使うこと。** 本サブは python の `connect_ex` で代替した。**★指示書の §7.2 が例示しているコマンドがこの形であるため、他サブでも同じ空振りが起きうる。**
    5. **★破壊確認は「単純な早期 return」では作れない場合がある。** `noUnusedParameters` / `TS18047` でビルドが落ち、**「テストが赤い」ではなく「起動しない」**になる（`make e2e` は `pnpm build` を通るため webServer が上がらない）。**⇒ 引数を使ったまま結果を捨てる／条件を never true にする形で壊すこと**（`M24-05` の記録が役に立った）。
    6. **★CSV エクスポートの 1000 件の静かな打ち切り**（`export.go:28-32`。利用者へ通知しない）と、**アプリ内バックアップ／リストアが未実装のまま `disabled` で画面に出ていること**（`SettingsSectionData.tsx:22-45`）。**どちらも `/export/combo` の廃止判断の前提になった事実**であり、`FR401` の「バックアップ用途」との齟齬として記録する。本サブの射程外。
    7. **★`CO-023`（`G-15`）は閉じきっていない。** (a) の router 層リファクタと (b) の「候補:」先頭提示は本サブの射程外。**⇒ followup を閉じるかは設計卓の判断。**
    8. **★★`FR401` の見直しを開発者が指示した**（2026-08-30・実機確認 3 件の通過後）。**★案の正本は設計伝達レポート §4.1**（before / after の逐語つき）。**★構造＝`REQ-001` で「バックアップ」に触れるのは `FR401` の括弧書き 1 か所だけであり、バックアップの機能要件は存在しない。** 実機構（`VACUUM INTO` スナップショット 10 世代・手動バックアップ／リストア・`VAL-B01`〜`B03`）は **`NFR201` 由来で `DES-002` §6.3 ／ `DES-006` §8 に設計だけが先行**している。**⇒ `FR401` の語が別の責務を肩代わりしている。★設計書の編集は設計卓の手番であり、製造は 1 文字も触れていない。**

### M24-07: 用語・i18n・内部値露出の最終 sweep（2026-08-30）

- **結果**: `go test ./... -count=1` **全 55 パッケージ ok** ／ `cd web && pnpm test` **205 files / 2278 tests 全数緑**（着手前 202 / 2244 ＝ **増加のみ・1 本も減らしていない** ） ／ `pnpm build` 緑 ／ `make e2e` **226 passed（着手前基準値 226 と同一セッション内の背中合わせで一致）**。**マイグレ消費 0 本〔次は `000080`〕・新規依存 0・ブラウザストレージ新キー 0・`CHANGE-147` の番号は製造が消費していない。** **★★核心＝「CSV 列名の契約を守る観測が PR チェック側に存在しなかった」**——既存の Go 往復テストは `ExportCSV` と `ParseAndValidate` が同じ定数を読むため**列名を変えても緑のまま通り**、検出できるのは nightly の E2E だけだった（破壊確認 3 で実証）。⇒ PR で必ず走る側へ列名契約テストを新設。 **★★指示書 §4.2 と §2.3 が正面から衝突していた**——共有ラベル定数を i18n 化すると全面直書きの 3 画面が「1 画面で 2 系統混在」になる。⇒ 停止して開発者へ確認し**案 A** （`ja.json` から導出）の裁定を得た。 **★i18n 化: タグ管理 7 部品 / セットプレイ編集 3 面 / 仮想コントローラ 70 本。ハードコード日本語は 143 ファイル 1,862 行 → 122 ファイル 1,409 行。** **★`SM-016` の単位語は開発者判断で見送り**（影響箇所が多く手動確認の手間が大きい）。調査結果のみ完了報告 §6 へ記録。
- **報告**: 完了報告 `docs/progress/M24-07-completion-report.md` ／ モック `docs/progress/M24-07-mock/m24-07-step-vocabulary.html` ／ レビュー `docs/progress/m24-07-review.md`（**高 4 件・中 6 件・低 4 件・質問 4 件。採否は 高 4/4 採用・中 6/6 採用・低 4/4 採用＝全 14 件採用。★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**。取り込み結果は同ファイル末尾の「## 取り込み結果（自動トリアージ）」）
- **★★レビュー取り込みで判明したこと（横断で効く）**:
    - **「失効記述を是正する」作業にも母数の数え直しが要る。** 本サブは commit `2c0e4eb` で「失効記述『4 面』を『5 面』へ是正」とし、**コミットメッセージ自身が「この型の失効はテスト・lint・型検査のいずれでも検出できないため『高』として扱う」と書きながら、数え直さずに 3 か所だけ直した**。実測は **28 行**が失効したままで、**是正したファイル自身の中に 4 行**と**トグル部品の冒頭の名指し列挙**が残っていた。⇒ **是正後は「N を書かず列挙で持つ」形に寄せた**（数だけを書くと面が増えたときに同じ失効が起きる）。
    - **★★「テストが緑」が根拠にならない第 3 の場面が実在した。** `labelFor` の第 1 引数の意味が「値→ラベル」から「値→i18n キー」へ変わったのに呼び出し側 5 か所が旧のまま残り、**`jaLabel` の「引けなければキーをそのまま返す」フォールバックに偶然救われて緑**だった。型も両方 `Record<string,string>` で効かず、既存テストが**誤用のほうを正しい使い方として固定**していた。⇒ テンプレートリテラル型（i18n キーは必ずドットを含む）で分け、**コンパイルで止まる**ようにした。
    - **★辞書だけを走査するテストでは「コードが合成した文字列」を守れない。** en.json に日本語が無くても、`okiTechAndGaugeLabel` が区切り `・`（U+30FB）を直書きしていたため英語 UI に和文の中黒が出ていた。⇒ **合成後の文字列を走査する観測**を新設（`composed-en.test.ts`）。同型の穴として、統一した語の再発ガードも**辞書だけでは効かない**ことが実測で判明した（`取込` は ja.json に **0 件**で、取込まわりの画面は全面直書き）⇒ `retired-words.test.ts` は `web/src` の実装ファイルも走査する。
    - **★UI の要素を分割すると、それに依存していた E2E が静かに壊れうる。** 帰属ラベルをバッジへ揃えて技名が単独 `span` になった結果、1 手コンボでレシピ文字列と**完全一致で衝突**し `m18-03a-punish-mylist.spec.ts` が strict mode 違反で赤くなった。同 spec は「連結文字列だから完全一致では当たらない」という**偶然の前提**に依存していた。⇒ セレクタを緩めるのではなく、実装側に `data-testid` を足して名乗らせた。
- **★★開発者の実機確認（2026-08-30・レビュー取り込み後）**: **A-1〜A-4 は通過**（英語 UI の技ボタン二重ラベル解消・起き攻めラベルのスラッシュ区切り・キャラ名と並べ替えの同時切替・タグ管理／ 日本語 UI の語彙 3 件 ／ 製造の裁量 2 件の承認）。**⇒ 英語 UI は実装もレビューも実物を見ておらず、本サブの目的の半分が未検証のまま手交されるところだった**（レビュー §制約事項の逐語＝「静的読解による判定であり、実機での確認はしていない」）。**★見つかった 2 面**＝`/setups/:id`（`SetupBasicInfoForm` 8 行 ＋ `SetupRecipeEditor` 10 行が日本語）／ `/punish/search`（`CharacterSelector` のプルダウン内だけ英語）。**★どちらも本サブが作った回帰ではない**——着手前の実測で `SetupEditorPage` も `CharacterSelector` も既に `useTranslation` を持っており、**混在は元から在って、本サブが深めた**。**⇒ 開発者判断＝直さない**（逐語＝「まずはリリースなのでいったんはこれぐらいでいいかと思っています」）。理由＝回帰でない／en 全体が未完成（122 ファイル 1,409 行・`useTranslation` 0 の面が 20 面中 7 面）で 2 面直しても en はリリースできない／部分是正は再確認の往復を招く。**代案 2 件**（`/setups/:id` を閉じる 18 語 ／ `CharacterSelector` に `locale` を渡して 5 面のキャラ名を日本語へ戻す 25 行）**は `CO-026` の候補として設計卓へ送った**。詳細は完了報告 §5.4。
- **★★教訓（横断で効く・レビューも本サブも見落とした型）**: **共有部品を i18n 化すると、消費側の面の数だけ混在が生まれる。** `CharacterSelector` は **`useTranslation` 0 の全面直書き画面 5 つ**（`PunishSearchPage` / `PunishListPage` / `PresetEditPage` / `MovesEditGridPage` / `IntakeHelperPage`）に埋まっており、工程 10 で**キャラ名＝画面で最も目に入る要素**がロケール従属になったため、混在が一気に見えるようになった。**★これは工程 3 で 1 度検出した型そのものである**——`TagSelector` を `t()` で i18n 化した際、唯一の消費者が全面直書きだと気付いて `jaLabel` へ差し替えた（案 A）。**同じ問いを `CharacterSelector`（消費側 12 面）へ向けていれば実機確認の前に見つかっていた。** **★レビュー 中-5 も見落としている**——完了報告の残存一覧を**行数順**で読んだため、10 行しかない `PunishSearchPage` が埋もれた。**⇒ 共有部品を i18n 化したら、消費側の面を全数挙げて「その面は i18n 側か直書き側か」を 1 件ずつ判定する。部品の側だけを見ても混在は見えない。**
- **★横断課題**:
    1. **★★`DES-002` §7.6 の往復契約に観測の穴があった。** 往復テストは列名の契約を守らない（両側が同じ定数を読むため対称に変わる）。本サブで PR チェック側へ観測を足したが、**§7.6 本文にその旨を 1 行残すかは設計卓の判断**。
    2. **★★共有ラベル定数の i18n 化は「1 画面で 2 系統混在」を誘発する。** 消費側に `useTranslation` 0 の画面が 3 つある（`ComboEditorBasicFields` 236 行 / `PunishList` 60 行 / `export-model.ts` 34 行）。案 A で回避したが、**これらの面ごとの i18n 化が済むまで同じ衝突が再発する**。
    3. **`CO-026`（英語ロケール整備）は閉じていない。** 残存 122 ファイル / 1,409 行。上位は `IntakeHelperPage`(115) / `ComboEditor`(91) / `ComboEditorBasicFields`(86) / `intake/prompt.ts`(71) / `ComboImportPage`(63)。
    4. **地上ダッシュの表示語が 2 系統**（ボタン「前方ステップ」＝正 ／ `alias_text`「前ダッシュ」＝誤）。**`M24-08` へ送った**（**D-615**）。
    5. **★`SM-008` は既に実現済みだった**（`link` → 「目押し」）。ledger の「未対応」は失効。残るのは内部値 `link` が URL と目押しの両方で使われている点のみ。
    6. **★`RecipeText` の `compactClassName` は prop 契約（幅制御クラス）と実際に渡している値（折返し制御クラス）が矛盾している**（詳細面のみ）。`truncate` と同時適用される。**本サブでは直していない**（`CHANGE-147` 案 B を採らないため）。
    7. **★指示書・ledger の失効した母数 2 件**——locale は「23 / 487」ではなく実測 **26 / 607**（着手前）。followup は「§AS 2 件」ではなく **§AS 4 ＋ §AT 1**。
    8. **★`features/combo/labels.ts` とフィルタ定数で `normal` / `counter` が割れたまま**（「通常」vs「通常ヒット」等）。エディタを触らずには畳めない。
    9. **★★画面名の改名が `DES-005` へ届いていない**（レビュー 高-3）。画面14「インポート(CSV)」→**「取込(CSV)」**、画面19「取込ヘルパー」→**「引っ越し取込」**。`DES-005` の画面一覧 row 19 ／ §5.19 見出し ／ §5.14 の連携口記述が旧名のまま。**⇒ 設計卓の手番**（コード内コメント 14 か所は本サブで改名済み）。**★`playbook` §4.44「影響設計書の欄は起票時の見込みであって全数ではない」の実例である。**
    10. **★指示書 §4.8「並び順を勝手に変えないこと」が正本を圧縮しすぎている**（レビュー 中-3）。正本の followup は「ラベルの i18n が実現したときに並べ替えのキーも `name_en` へ揃えること。★片方だけ変えないこと」であり、as-built はそちらと整合する。**指示書の 1 行だけを読むと「禁じられた並び替えを勝手にやった」と読める**（実際にレビューで一度そう判定されかけた）。
    11. **★E2E の基準値と確定実行は「実行したコマンド行」ごと報告へ貼る**（レビュー 質問-1 / 質問-2）。本サブは結果の要約だけを書いたため、**レビュー側から「パイプで切り詰めていないか」を判定できなかった**（`D-599` / `D-600` を守った証拠にならない）。次サブ以降の作法とする。

---

### M24-08: `queryKey` の統一 ＋ M24 の繰越 4 件（2026-08-30）

- **結果**: `go test ./... -count=1` **exit 0** ／ `gofmt -l .` **0 件** ／ `cd web && pnpm test` **210 files / 2328 tests 全数緑**（着手前 207 / 2291 ＝ **増加のみ・1 本も減らしていない**） ／ `pnpm build` 緑 ／ `make e2e` **226 passed（第 1 部完了時点 4.1m ／ 全体完了時点 3.7m。どちらも絞っていない）**。**マイグレ `000080` を 1 本消費〔次は `000081`〕・新規依存 0・ブラウザストレージ新キー 0・`CHANGE-148` の番号は製造が消費していない。** **★★核心 1 ＝「`alias_text` を直しても直せる経路が存在しなかった」**——起動時の自動再構築は無く、`DES-005` §5.16 の「レシピキャッシュ再構築」ボタンは `disabled` の未実装で対応 API も無く、`official_ja_move` は組み込みのため `PUT` が 403 でエイリアス更新経由の再計算にも乗らない。**⇒ §9.1-3 の分岐が成立し、手を止めて開発者へ報告。再構築ボタンを実装する裁定を得た**〔設定＝全プリセット ／ プリセット編集＝その 1 枚。**`internal/service/notation/` と `internal/service/preset/` は 1 行も触っていない**＝契約 F-1〕。 **★★核心 2 ＝「invalidate が当たることを守る観測が 3.4% しか無かった」**——本番 58 件の `invalidateQueries` のうち **39 件が前方一致に依存**し、`exact`/`predicate` は 0 件。当たりを観測していたのは 2/58 で、**前方一致依存 39 件を守る E2E は 0 件**だった。**破壊確認 2' で実証**＝query 側だけをずらすと**既存 2294 テストも型検査も緑のまま**で、本サブが足した観測だけが検出する。 **★契約 F-2 は「モデルの契約であって表記法の凍結ではない」で確定**（実査 21 箇所中リテラル説を支持する記述 0 件。§4.1.1 の裁定＝`D-619` と食い違わず、止めていない）。 **★あわせて `DES-002` §11.3 契約 2 の既存の違反 1 件を是正**（`web-test` の `tee` に `pipefail` が無く、**Vitest の失敗が PR を止めていなかった**。実測＝pipefail なし exit 0 ／ あり exit 1）。
- **報告**: 完了報告 `docs/progress/M24-08-completion-report.md` ／ レビュー `docs/progress/m24-08-review.md`（**高 5 件・中 6 件・低 6 件。採否は 高 5/5 採用・中 6/6 採用・低 4/6 採用**〔不採用 2 件はいずれも理由付き＝テストの流儀 ／ `CO-026` の手番〕。**★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。往復 1 回で完了**。取り込み結果は同ファイル末尾の「## 取り込み結果（自動トリアージ）」）
- **★横断課題**:
    1. **★★`D-415`「差分の自動提示は作らない」（2026-08-16）の射程が未確定。** 同裁定は編集競合（`FR501`）の文脈だが、文面は「コンボの差分提示」一般を否定する形で書かれている（`DES-005` §5.7 の近接）。本サブは `SM-068`（重複＝`VAL-C02`）を別物として扱い差分表示を実装した〔根拠＝`D-415` の理由は「ステップの配列の対応付けに専用の比較 UI が要る」であり、**本サブはステップを比較していない**。判定キーとレシピは一致が確定しているため比較対象は非キーのスカラー 7 項目だけである〕。**⇒ この読み方でよいか設計卓の判定が要る。**
    2. **★★指示書・先行資料の失効した母数 5 件。** (a) `queryKey` は「84 箇所 / 39 ファイル」ではなく **92 / 43**〔キーを持つ本番サイトは 96 / 44〕 ／ (b) **`code-facts.md` §2-2 は現物では 72 行**であり、指示書と followup が引く「64」は現在のファイルと一致しない ／ (c) followup の「取りこぼし 20 箇所」の内訳（15＋2）は **17 で合わない** ／ (d) `alias_text` の対象は **38 行**（19 キャラ × 2 code。投入元 5 マイグレ） ／ (e) `labels.ts:5-13` の「マップ 2 本」は **実測 3 系統**（`PunishList.tsx:339` の JSX 直書きが数えられていなかった）。**⇒ ledger と `code-facts` 側の是正は設計卓の手番。**
    3. **★followup `combo-labels-normal-counter-split` の前提が失効していた。** 「`ComboEditorBasicFields` 236 行の直書きを触らずには畳めない」とあるが、**同ファイルは実測 910 行で直書きは無く** `labels.ts` の `HIT_TYPE_OPTIONS` を import している。**⇒ 開発者裁定で「通常／カウンター」へ寄せ、3 系統とも畳んで解消した。**
    4. **★★「既存の再構築機構に任せる」という前提を持つ指示は、その機構の実在を実査で確かめること。** 指示書 §4.3 と `CHANGE-148` §4 はどちらも `DES-005` §5.16 のボタンへ委ねていたが、**そのボタンは `disabled` の未実装だった**。**★設計書に書かれていることと、実装されていることは別である**——`DES-005` §5.16 に記述が在ったために、設計卓も指示書も「在る」と読んだ。
    5. **★`queryKey` の平坦化を完了させるには挙動の変更が要る箇所が 3 件残っている**（`tags` の `partialDeepEqual` 依存 ／ `setupCandidates` の同一ルート共有 ／ `combo.recipe` の前方一致依存＝契約 F-2 の FE 側の実体）。**本サブは値を動かさずファクトリへ写し、理由を逐語で残した。** 平坦化したいなら挙動変更として別途起票が要る。
    6. **★マイグレの連番**: `000080` を消費した。**次に払い出す番号は `000081`**。ボード §2.2 の更新は設計卓の手番。
    7. **★★レビューが見つけた「空振りしていた観測」1 件**（中-2）——`recipe_cache` をマイグレが書かないことを見るガードが、**新規 DB にコンボが 1 件も無いため何を壊しても緑で通る**形だった。**⇒ 「テストが在る」と「テストが効いている」は別である。** 取り込みで実効化し、破壊確認まで行った。**★同型は `M24-07` の `toContain("ステップ")` でも起きている**（部分文字列で緑のまま通る）。
    8. **★★import 順の規約に機械検査が無い。** 本サブは自動挿入の副作用で **27 ファイルを規約外にしたまま気づかず**、レビューで指摘されて戻した（同一分類器で 21 → 48 → 21）。**規約が存在するのに検査が無い領域では、一括変換が静かに規約を壊す。** `eslint-plugin-import` の `import/order` をベースライン付きで入れるかは設計卓・開発者の判断。
    9. **★削除した識別子を名指しする資料が 2 か所ある**（高-4）——`DES-005` §5.16 の `USERS_KEY` 参照（**設計卓の手番**）と `code-facts.md` §2-2 の const 定義 6 件（**`/regen_code_facts` で再生成できる**）。
    10. **★`DES-005` §5.16 の「進捗表示付き、中断耐性あり」は未達のまま**（高-2）。再構築ボタンは実装したが、進捗表示も中断耐性も持たない。**設計卓が as-built で節を直すか followup を立てる手番。**
    11. **★★実機確認（2026-08-30・開発者）で確認 1 が通った**——**既存 DB の古い表記が再構築で直ることを実機で確認した**。**本サブで唯一「自動テストが原理的に届かない」主張であり、E2E も Go テストも構造上そこへ到達できない**〔E2E は使い捨て DB で stale cache が発生しえず、Go テストは「stale のまま残ること」までしか見ない〕。**⇒ 実機確認を挟まなければ、本サブの目的が未検証のまま手交されていた**（`M24-07` が記録した型と同じ）。
    12. **★★実機確認で `trash-bulk-permanent-delete-reason-hidden` を踏み、開発者判断を更新して前倒し是正した**〔割付は `M23-CLOSE`、状態は「未着手（2026-08-23『申し送りで構わない』）」だった〕。**★本サブ由来ではない**——`TrashSetupList` / `TrashBulkActions` を 1 行も触っておらず、復元は動き、症状も followup の逐語と一致した。**★それでも直したのは、開発者が実機で「セットプレイの削除が一切できない」と読んだためである**。**⇒ 「申し送りで構わない」という判断は、その項目を実際に踏むまでの暫定である**——**踏んだ人が居た時点で判断は更新されうる。followup の状態欄はそれを書ける形になっている。**
    13. **★解消したのは 3 つの欠落のうち 2 つである**〔理由 ／ 参照元コンボの列挙〕。**残る「紐付け解除の導線」は行部品との重複を避けるため共通化のリファクタを伴い、別サブの量として `M23-CLOSE` に残した。****★「一部解消」を状態として書けることが効いた**——全か無かで書くと、次の担当は「未着手」と読んで 3 つとも作り直す。
    14. **★★手交後に見つかった 1 件＝`web test (Vitest)` の summary が件数を 1 度も記録できていなかった**（`M24-09a` の新設以来。**本サブが作った回帰ではない**）。**根因＝`CI=true` では Vitest が色を付けるため〔picocolors は TTY ではなく `CI` を見る〕、`tee` したログの行頭がエスケープになり、行頭アンカーの `grep` が 1 件も当たらない。** **★job は緑・他の行は埋まる・テストも実際に走るため、空欄 1 つでは異常に見えなかった。** **⇒ 見つかったのは、開発者が手動起動の summary を人の目で読んだときである。** 是正は 2 段〔ANSI を落としてから抽出 ／ 空のときは `**行が無い(読めなかった)**` を出す〕で、**合否を決める `pnpm test` step には触っていない**。**★後者は `nightly-crossbuild.yml` の E2E summary が最初から持っていた形である——先例が同じリポジトリに在ったのに揃っていなかった。** **★★「テストが在る」と「効いている」は別（項 7）の、観測そのものへ向けた形である＝観測の観測が無かった。** コミット `0ebb4b4`。設計伝達レポート §1-7 で設計卓へ伝達済み。

### improve-02: 改善レーン 第 2 束（フェーズ3 → フェーズ4 の境界）（2026-09-01）

- **結果**: 6 作業すべて実施。**新設検査 1 本**（`check-import-order.sh`・ベースライン 101）／**是正 2 本**（`check-progress-log-index.sh` の偽陰性 ／ `generate-code-facts.sh` の抽出）／**派生資料 4 本すべて ✅ 最新へ**（`code-facts` 16% ／ `docs-map` 10% ／ `custom-commands` 12% → 0）／`progress-summary` の 2 MS 遅れを解消（§25 M23・§26 M24）。**CHANGE 消費 0・マイグレ消費 0・新規依存 0。** 常設検査 11 本すべて緑、破壊確認 3 件。
- **報告**: 完了報告 `docs/progress/improve-02-completion-report.md` ／ レビュー `docs/progress/improve-02-review.md`（**クリーンルーム・fresh subagent**。**方針は第 1 束に合わせ「完了報告の数字を一切採用せず全数を回し直す」**）
- **★横断課題**:
    1. **★★`D-510` は誤帰属だった。** 「`implement_plan_full` の Phase 順が誤っており Phase D を Phase C の後へ移すのが最小の是正」と認定されていたが、**`git show` で遡ると Phase 順は到達可能な最古のリビジョン（2026-08-22＝浅いクローンの境界）以降 A → B → C → D-0 → D であり、`D-510` 起票時点で既にこの順序だった。⇒ 移すべき対象が存在しなかった**（**★「初版から」とは言えない**——**到達できる範囲の全リビジョンが同一 blob であり、それ以前は観測できない。クリーンルームレビュー A-2 の指摘で訂正**）。**⇒ 是正が「開発者の手番」に置かれたまま実施されなかったのは、実施すべきものが無かったからである。** **★board / retrospective 側の `D-510` の記述は、現状のままだと次の担当を誤らせる。**
    2. **★★真の穴は「完了報告を*いつ*書くか」を CLI 群が一度も述べていなかったことである。** とくに**分割フロー（`implement_plan` → `review_plan` → `incorporate_plan`）のほうが穴が大きかった**——`implement_plan` は完了報告をレビュー実施前に書き、**`incorporate_plan` は `progress-log` の追補しか定めておらず、完了報告のレビュー参照欄を埋める手番がどこにも無かった**。**⇒ 製造 CLI 4 本へ工程を足して塞いだ。**
    3. **★★`scripts/check-progress-log-index.sh` の偽陰性を是正した結果、7 件の実在する欠落が初めて見えた**〔`m14-03b` / `m14-03d` / `m14-03e` / `m17-03` / `m18-02` / `m19-04b` / `m19-phase2`〕。**★とくに `m19-04b` は `CLAUDE.md` §8 と `implement_plan.md` が「実際に追記が落ちた」と名指ししている件であり、ALLOW 表に無かったこと自体が偽陰性の証拠だった。** 7 件とも ALLOW 表へ移した（**完了済み MS の記録は当時のまま残すため索引行を捏造しない**＝`D-535`）。
    4. **★★`code-facts.md` は「古い」のではなく「再生成できない」状態だった。** `M24-08` の `queryKey` 集約で `generate-code-facts.sh` の §2-2 抽出が 0 件になり、破損ガードが `exit 1` で止めていた。**⇒ followup §AY-3 の見立て「`/regen_code_facts` を回すこと」では直らない。** **★「再生成手段が在る」と「再生成できる」は別である。**
    5. **★★破損ガードは「1 件でも在れば緑」であり、部分的な取りこぼしを検出できない。** 上記の是正版が多行定義 4 件（`recipe` / `aliases` / `byKnockdown` / `byMatchup`）を静かに落としたまま緑だった（28 / 33 件）。**全数突合をしなければ気づけなかった。** 同型のガードは `generate-code-facts.sh` に 13 件ある。
    6. **★`M24-08` の import 順の失敗形は「最後の import が相対パスのファイル」でのみ顕在化する**（545 中 271 件）。**同じ自動挿入でもファイルによって壊れたり壊れなかったりする。** ⇒ 破壊確認の 1 本目に `App.tsx`（最後が `@/`）を選んで空振りし、危うく「検査が効いていない」と誤読するところだった（playbook §4.37 と同型）。
    7. **★`CLAUDE.md` §4 / §10 のコード規約を全数実測した。** ESLint の射程に入る規約のうち **import 順以外の実違反は合計 1 件**〔`any`=1 / `console.log` 本番=0 / class コンポーネント=0 / `eslint-disable`=1 / `fmt.Println` 本番=0 / `nolint`=0〕。**⇒ 案 (C) 自作を採り、(B) ESLint は提案として完了報告 §6-3 に残した。** **★`export-filename.ts:98` の `eslint-disable-next-line` は ESLint 不在のため現在まったく効いていない死んだディレクティブである。**
    8. **★playbook §4 の実数は 61 節・13 系統**（一度 64 と誤り、`grep` がレビューチェックリストのテンプレート骨格 3 行を拾っていたことを突き止めて訂正した＝**§4.40 の自己適用**）。**設計卓の処方 (i) の前提 1 件は成り立たない**——**§4.55 は自ら「`check-doc-refs.sh` はこれを検出しない」と明記している**。**★★あわせて 2026-09-01 に自分の集計の誤りを 1 件訂正した**——**「機械検査を名指ししているのは 5 節」は `scripts/check-*.sh` だけを grep した結果であり、`web/src/locales/` ＋ `web/src/lib/` の Vitest 規約テスト 7 本を数え落としていた**〔`locales` / `retired-words` / `no-japanese-in-en` / `forbidden-words` / `composed-en` / `query-keys.convention` / `query-keys.invalidation`〕。**正しくは 6 節で、§4.13 は `locales.test.ts` が既に機械強制している。** **★★playbook 3,106 行から Vitest 規約テストへの言及は 1 件しか無く、既に機械が守っている原理が「本文から消せる候補」として見えていない**〔最も明確な例＝**§4.18 は `retired-words.test.ts` が同じ原理を陰性対照つきで守っているのに 1 度も名指ししていない**〕。
    8b. **★★playbook のサイズは健全ではない**（2026-09-01 実測・開発者の問い）。**2026-08-22 → 2026-09-01 の 10 日間で §4 が 25 → 61 節（2.4 倍）・playbook が 2,209 → 3,106 行（+41%）。** **★`§4.1`〜`§4.59` に欠番が 1 つも無く、過去に一節も退役していない。playbook 自身に退役の条件の規定も無い。** **★増加の駆動源は設計卓の計測点である**〔M24 は 17 件＝M23 の約 3 倍。同期間に §4 が倍増〕**⇒ 誤り 1 件 → §4 に 1 節の運用であり、誤りが減らない限り単調増加する構造。** 参考＝`scripts/check-*.sh` 11 本の合計 3,161 行に対し **playbook 単体が 3,106 行**。
    8c. **★★機械検査への移植は「難しい」のではなく「その形では移植できない」**（2026-09-01・開発者の問い）。**決定的な理由＝守りたいのが「成果物の性質」ではなく「著者の行為」だから**——§4 の規約文の動詞は **確かめる ／ 数え直す ／ 実査項目にする ／ 原文へ当たる ／ 節を開いて確認する** が大半であり、**完成した指示書を読んでも著者がその節を開いたかは分からない。実査した指示書と推測で書いた指示書は文面が同一になりうる。** **★ただし変換の型は既に本リポに 5 か所ある**〔「行為」→「成果物への痕跡の強制」→「痕跡の検査」。§J の必須 5 フィールド ／ 完了報告の常設節 ／ `--self-test` の対照 ／ 生成日＋変化量 ／ ja-en parity〕。**★★そしてこれをやっても playbook は縮まない**——**§4.8 は `check-enum-sync.sh` を持つのに本文が残っており、それが正しい**（検査は「守られたか」を見るが本文は「なぜ・どう埋めるか」を持つ）。**⇒ Lint 化の見返りは「削減」ではなく「観測」である。** **★削減の主力は ① 退役の手番（未実施・効果最大） ② 蒸留（読む量 1/8） ③ 統合（-7 節）であり、④ Lint 化の節数削減はほぼ 0。** 61 節の機械化可否＝**L 11 / S 16 / N 34**、新規に作れる検査は 6 本〔うち **§4.27 と §4.55 は本文が自ら「検査が無い」と宣言している**〕。
    9. **★`check-doc-inventory.sh` の例外表 28 件のうち 2 件は、参照元が例外表エントリそのもの 1 件しか無い**〔`cleanup-report-20260627.md` / `transport-audit-20260725.md`〕。**⇒ 検査の例外表が、他に誰も参照していないファイルを台帳に留めている。** **`m19-desk-status.md` は実証済みから 2 週間以上、5 つの資料が「消せる」と言い続けている**（**★消すのは開発者の手番**＝`D-196`）。
    10. **★ベースライン固定型 5 本はすべてベースラインちょうどで、下げられるものは 1 つも無い**〔md-emphasis 436 / instruction-format 78・14 / enum-sync 24 / import-order 101〕。
    11. **★`followup-backlog` 本表への更新候補 16 件を完了報告 §7-2 に列挙した**（**★本表は 1 文字も編集していない**＝`D-382`）。うち**新規登録候補 6 件**〔`main-lacks-graceful-shutdown` / `bulk-rename-must-exclude-check-scripts` / `no-single-verify-command` / `no-periodic-lesson-lint-review` / `code-facts-generator-drifts-with-refactor` / `check-guard-cannot-see-partial-extraction`〕。
    12. **★外部 AI の提案（資料 3）は「◯◯が無いから作るべき」6 件のうち、実際に無かったのは 2 件だけだった**〔単一 verify コマンド ／ 教訓・Lint の定期整理〕。**残り 4 件は名前が違うだけで既に在る**〔custom lint = `check-*.sh` 12 本 ／ 3 段階の強度 = 赤・warning・情報提供型 ／ hook = `.claude/hooks/` 6 本 ／ Failure Registry = retrospective-log ＋ followup-backlog ＋ parallel-board〕。**★実在確認をせずに採っていたら、既に在るものを 4 つ作り直していた。**
    13. **★★本セッション自身が playbook §4.34 / §4.58 を踏んだ。設計卓へ渡す前の最終確認で捕まえた。** 索引行へ「**レビュー なし（改善レーンは投入プロンプト方式でありレビュー工程を持たない＝先例 `20260815-improvement-lane-batch1-report.md`）**」と書いたが、**原文を開くと第 1 束にはクリーンルームレビューが実在した**〔`20260815-improvement-lane-batch1-review.md`・33KB。**その方針は逐語で「完了報告の数字は一切採用せず、全数を自分で回し直した」**〕。**⇒ 先例は「レビューを持たない」ではなく「持つ」だった。** **★あわせて投入プロンプト §3 自身が成果物型に `improve-NN-review(-N).md` を挙げ、停止規律で「再レビュー往復 2 回」を前提にしていた**——**要求の正本にも書いてあった。** **★これは本セッションが 3 件目に出した同型の誤りである**〔playbook §4 を 64 と誤った ／ 機械検査を名指しする節を 5 と誤った ／ 本件〕。**いずれも「数える・確かめる対象を実物で開かなかった」ことが原因であり、⇒ 自己申告だけで閉じないこと（本束がクリーンルームレビューを受けた理由）。**
    14. **★★クリーンルームレビューが、自認済みの誤りの型がまだ 2 件残っていたことを示した**（指摘 14 件＝高 4 / 中 6 / 低 4。**全件採用・不採用 0・往復 0 回**）。**(a) `generate-code-facts.sh` はなお 4 件落としていた**〔`commandIndex` / `motionCommands` / **`config`** / **`users`**＝`queryKeys` 直下のトップレベル定義。33 → **37**〕——**★自力で気づけなかったのは、全数突合の分母をネスト定義から作っており、抽出器と同じ前提だったからである。⇒ 突合の分母は検証対象と独立に取らないと意味がない。** **★`config` / `users` は投入プロンプトが名指しした `CONFIG_KEY` / `USERS_KEY` の後継であり、落とすと派生資料の情報が純減していた。** **(b) 「Phase 順は初版から変わっていない」は成立しない**〔`321f06f` は `.git/shallow` の**境界コミット**。挙げた 4 リビジョンは **blob が全て同一**〕——**`implement_plan_full.md` へ埋め込んだ恒久記述を含め全 3 箇所を弱化した。** **(c) 作業 1 の是正が `D-510` の事故現場を外していた**〔`implement_plan.md` の**索引行テンプレート**が完了時に存在しないレビュー報告書へリンクさせるままで、`incorporate_plan.md` は「追記のみ」なので訂正もされない〕——**テンプレをプレースホルダ化し、`incorporate_plan` へ例外を明記して塞いだ。** **⇒ 数値主張の多い成果物は独立に回し直す工程を通すこと。**

### M25-RESEARCH-01: フェーズ4スコープ3層ledger調査（2026-09-01）

- 結果: M24正本の返却先はPhase4 28件／M14 14件。7源泉＋補は名寄せ前304件、否定形5件を含むledger 309行、名寄せ後272 identity。dispositionはPhase4 96／Phase5 24／Phase6以降11／要判断143／判断済み35、未付与0。
- 報告: `docs/progress/M25-RESEARCH-01-report.md`。baselineは開発者提示 `841e8ecda9fe44f0c9ac51a4d98befbbfb1d501c`。レビュー不要（read-only調査）。
- 実査: A6は任意認証として実装済み。password有効時は本番71経路中66保護・5公開、既定false時は設計どおり素通し。seedは19/31、残12、CSV 30/31。M18のリバーサル記載0。
- 測定: dbtest.Setup 1回を含むテスト1.07秒、全Goテスト84.410秒、単純比1.27%。全テストはsandboxのnetwork namespace制約で5件失敗し、再実行なし。
- 検査: `check-md-emphasis.sh` は現在926／baseline436（+490）で先行赤。本報告でcode spanを除いたliteral `**` は0行。
- 変更範囲: 本報告の新規作成と本索引行の追記のみ。Git操作・commit・実装・migration・seed・design・followup変更なし。

### M14-RESEARCH-03: seed 波 1 回あたりの工程の全数（第四波の着手前調査）（2026-09-01）

- **結果**: read-only 調査のみ。**実装差分 0**（`migrations/` / `internal/` / `web/` / `character_data/` は 1 バイトも未変更）。母数の実測はスクラッチ領域の使い捨て DB（`migrations/*.up.sql` 全 80 本を適用）で取得。
- **報告**: `docs/progress/M14-RESEARCH-03-report.md`。レビュー不要（指示書ヘッダ＝実装差分 0 のため）。CHANGE 消費 0 ／ マイグレ消費 0（**次の払い出しは `000081` のまま**）。
- **★横断課題**:
    1. **★★`characters` テーブルは 19 行であり 31 行ではない。** 指示書 §2.1 errata の「`characters` は 31 行」は `M25-RESEARCH-01` の誤要約である（同報告 §4.3 本文は「31 行」とは書いていない）。**「全 31」の実体は `character_data/*.csv` のファイル数 31 ＝ `seed-progress.md` の表 31 行。**
    2. **★★`c_viper` / `dhalsim` の仮登録は現在も在る**（移動 system move 9 種のみ・攻撃技 0・`total` 全 NULL）。**`M25-RESEARCH-01` §4.3 が両者を「seed 済み 19」に数えたのは判定基準が `COUNT(moves)>0` だったためであり、移動 9 種だけで条件を満たしていた。⇒ 「旧記録の 17 は数え違え」という同報告の結論は、実測では逆である**——本 seed 済みは 17 が正しく、残りは **14**（未 seed 12 ＋ 仮登録 2）。
    3. **★★§2.1-6「差の 2 キャラ」＝ `blanka` と `yasmine`。** 両者とも CSV は在り `precheck=済` で、`characters` 行が無いだけ。開発者しか知らない事情での説明を要しない。
    4. **★★本調査の核心＝設計卓が数えた「5 種類」は、実測で最低 13 段だった**（第三波の as-built **9 段** ＋ M20 期に積まれた **4 段**〔`numeric` / `srk` / P-34 `numeric` / P-34 `srk`〕）。条件付きでさらに 3 種（`custom_states` / `fastest_unreachable` 人手判断分 / `move_derivations`）。
    5. **★★第三波が消費したマイグレは 9 本**（`000053`〜`000060` ＋ `000062`）。**設計卓の把握「`000053`〜`000059`＝7 本」は 2 本少ない**——`000060`（`chain_cancel_total`）と `000062`（frame_cost）も**ファイル名に `third_wave` を持ち第三波 6 キャラだけを対象にしている**。第二波（`000043`〜`000048`＝6 本）は合っていた。
    6. **★★`M18`〜`M24` に `moves` / `characters` / `custom_states` / `move_derivations` へ追加された列は 0、新表も 0。** 追加は `preset_aliases` の 2 列（`alias_text_en`＝`000070` / `character_id`＝`000074`）と `combos.superseded_by_combo_id`（`000078`・利用者データ）のみ。**⇒ 列の追加より「1 回きりの backfill が第四波の行を拾わない」経路のほうが数が多い**（該当 16 種を母数付きで列挙）。
    7. **★★`000062` のヘッダが本調査の主題そのものを 2026-08-02 時点で一般化して書き残していた**——逐語「**『1 回きりの backfill マイグレ』は、その後に INSERT される行を拾えない。取り残しはエラーにならず、unknown / false のまま静かに残る。→ 今後の seed 波は、既存の backfill マイグレの内容を自波の行にも適用すること。**」**★この一般化は followup にも `M14-overview` にも転記されていない**（両ファイルへの grep ヒット 0 件）。**⇒ 教訓がマイグレ本文にしか無く、次の波の設計者が読む場所に届いていない。**
    8. **★`M14-overview.md` §3 の「前提マイグレ 2 本を含む 5〜6 段」は、それが書かれた 2026-08-01 時点の第三波実績（9 段）に対しても既に不足していた**（`is_derived` backfill / `move_commands` / `chain_cancel_total` / frame_cost の 4 段が表に無い）。同注記は第二波（1 キャラ・6 段）を基準にしている。
    9. **★手順の一部は 1 か所にまとまっていた**——`character_data/seed-progress.md` §「seed 波ごとに再適用する規則」に seedgen 5 コマンドが bash で書かれている。**ただし同節は `characters` 行・移動 9 種・`is_projectile`・移動 `total`・`chain_cancel_total`・frame_cost・`custom_states` を含まず、さらに P-34 の 2 本（`000076` / `000077`）を挙げていない。⇒ 手順どおりに実行すると P-34 が落ちる。**
    10. **★followup `combo-csv-io-ken` は失効している。** 現行 `web/e2e/combo-csv-io.spec.ts` は **`ryu`** を使い、`ken` はコメント 1 か所にしか出現しない（`grep -c "ken"` ＝ 1）。指示された行番号 L64-67 も現行では CSV 行の組み立て部分。**followup が提示した対処 (a)「対象を ryu へ変更」は既に実施済み。**
    11. **★`chain-cancel-measurements.md` の「確定値 55 件・18 キャラ」に対し DB は 53 件・17 キャラ。差の 2 件・1 キャラは `elena`**（未 seed 12 に含まれる）。**⇒ 第四波に `chain_cancel_total` 2 行が確定した工程として存在する。**
    12. **★followup `M14-03b-custom-states-stock` (a) は解消。ただし母数は 4 ではなく 5**——int（level / stock）の `custom_state` def を持つのは `ingrid` `juri` `kimberly` `lily` `mai` の **5 キャラ**で、**5 キャラとも `show_delta:true` 付与済み・全員 seed 済み**。followup の列挙は `ingrid` が漏れていた（`000023` で先に付与されたため）。
    13. **★未 seed 12 キャラの `custom_states` はリポジトリから判定できない**（CSV に列なし・`migrations/` になし・`docs/seed-data/` になし。3 経路とも 0 件）。**確定しているのは `yasmine` の 1 件のみ**（`seed-progress.md` L138＝開発者判断 2026-08-25「バヤニモードは `custom_states` の定義対象」。**種別・値域・増減の定義は未作成**）。
    14. **★`move_derivations` は seed 波が一度も投入していない**（投入元は `000064` / `000067` の人手判断 backfill と `000061` の zangief 連打版の 3 本のみ）。第三波キャラの 46 行は `000064` / `000067` 由来であり、**第三波の down（`000055.down`）は `move_derivations` に触れない**（head からの順次ロールバックでは先行する down が削除する）。followup `move-derivations-explicit-delete-on-reseed` は未着手のまま。
    15. **★確かめられなかったこと 10 件を報告 §5 に明記した。** とくに **`c_viper` / `dhalsim` の UNIQUE 衝突による起動不能経路が現在も成立するか**は、判定に seedgen の生成物作成とマイグレ適用が要り、指示書 §4「やらないこと」に触れるため実行していない。**⇒ ボード §1.3 の「必ず最終波」の制約が失効しているかは未判定。**
    16. **★`followup-backlog` 本表への登録候補 9 件を報告 §7 に列挙した**（**★本表は 1 文字も編集していない**＝`D-382`）。

### M26-01: 依存ライセンスの棚卸しと三層のパス割当（A2 → A1）（2026-09-02）

- 結果: read-only 調査のみ。実装差分 0（migrations / internal / web / cmd / character_data / docs/design は 1 バイトも未変更）。direct 依存 52 件（Go 7 / npm 31+14）で AGPL-3.0-or-later 非互換は 0 件。三層のパス割当はトップレベル 27 件（層 A 18 / 未割当 7 / 層が割れる 2）、migrations の .up.sql 80 本（層 A 28 / 層 B 52）、character_data 34 件（層 B 33 / 層 A 1）。層 C はソースとして 0 件、層 D はファイル 0 件。
- 報告: 完了報告 `docs/progress/M26-01-completion-report.md`（要点・止めた事項・申し送り）／ 調査報告 `docs/progress/M26-01-report.md`（指示書 §「出力」指定。全数表と根拠の正本・907 行）／ レビュー `docs/progress/m26-01-review.md`。baseline は `e1cd553cbb0940e1bc20f31c69ae9e7283a2a130`。指示書ヘッダは「レビュー不要（実装差分 0）」だが、成果物が不可逆な法務の前提を作るため開発者判断で事実性に絞って実施。指摘 14 件（高 3 / 中 5 / 低 6）は全件採用、高の不採用 0 件、再レビュー往復 0 回。CHANGE 消費 0（151 は成果物承認後に設計卓が起票）／ マイグレ消費 0（次の払い出しは 000081 のまま）。
- 実査: go-licenses は失敗したため指示書 §2.1 のフォールバック（go mod download + モジュールキャッシュの LICENSE 読取）を使用。失敗要因の 1 つは「本体に LICENSE が無い」であり本サブが解こうとしている課題そのもの（循環）。もう 1 つは go-licenses v1.6.0 が Go 1.26 の標準ライブラリに追随していないこと。
- 検査: check-artifact-integrity / md-emphasis / doc-refs / doc-inventory / progress-log-index / stop-discipline すべて緑。md-emphasis は一度 baseline +4 で赤になり 4 行を是正して緑へ戻した。
- 変更範囲: 本報告とレビュー報告書の新規作成、および本索引行の追記のみ。実装・migration・seed・design・followup-backlog の変更なし。

- ★横断課題:
    1. 三層のパス割当表は開発者の承認待ちである（指示書 §3.3 手順 2）。承認後に設計卓が CHANGE-151 を起票し、DES-001 §5 の改訂（現行 MIT = CHANGE-053 が正典）と SUPP-001 §5.7 の射程明確化を行う。★M26-02 以降および LICENSE 配置サブは、この承認を前提とする。
    2. ★SUPP-001 §5.7 は「inbound」という語も相当する限定句も一度も書いていない。inbound であることは節題と追加ルール 5 項の文脈からしか導けない。⇒ CHANGE-151 に要るのは「撤回」ではなく「inbound と outbound を分けて書く明確化」である（M26-overview §3 の裁定と一致）。★骨子 §8 は「禁止を撤廃し書き換え」と述べており食い違うため、CHANGE-151 反映時に骨子側も追随させること。
    3. ★checklist A1 が要求する「AGPL §13 の解釈整理」の節が骨子に存在しない（grep で 0 件）。M22 で LAN 共有が入ったため直接効く条項であり、A1 承認の前提が 1 つ欠けている。製造は human-notes/ を編集しないため、設計卓または開発者の手番。
    4. ★三層の基準に docs/ と AI 運用ルール群（CLAUDE.md / .claude/ / AGENTS.md / .codex/ / .agents/ / human-notes/）の受け皿が無く、トップレベル 27 件中 7 件が未割当のまま残る。docs/ は指示書 §7 が開発者判断と定めており 3 案を提示済み。AI 運用ルール群は層 C（ゲーム非依存で単体で持ち出せる）に当てはまりうる。
    5. ★migrations の 3 本（000039 / 000017 / 000029）が 1 ファイル内で層 A と層 B に割れる。SPDX ヘッダは 1 ファイルに 1 つしか書けないため、ヘッダ配置サブ（指示書 §3.3 手順 5）で判断が要る。あわせて *.down.sql 80 本の層は本サブの範囲外であり未割当のままである。
    6. ★migrations/000072 のヘッダが「層 A / 層 B / 層 C」という語を seedgen の内部概念として別の意味で既に使っている。SPDX ヘッダを入れると同一ファイル内に「層 B」が 2 つの意味で並ぶため、配置サブで読み違えを生む可能性がある。
    7. ★Go の CVE 検査は実行できていない。govulncheck ./... が vuln.go.dev へ 403（既存 followup `cloud-env-cannot-reach-vuln-go-dev` のとおりで、台帳の更新は不要）。★「脆弱性が無い」ではなく「検査していない」。開発者のローカル実行が要る。なお govulncheck -version が返す「No vulnerabilities found.」は走査対象ゼロで DB を引かないための既知の偽陽性であり、到達性の証拠に使わないこと（本サブで再現済み）。
    8. ★react-router-dom の GHSA-jjmj-jmhj-qwj2 は Patched versions が <0.0.0、すなわち v6 系に修正版が無い。修正には v7 系への移行が要ると解される。本サブでは依存を更新していない（指示書 §4-1）。pnpm audit は計 11 件（high 6 / moderate 4 / low 1）を報告した。
    9. followup-backlog 本表への登録候補 4 件を報告 §7 に置いた（`react-router-dom-v6-unpatched-advisory` / `agpl-section13-not-in-strategy-outline` / `three-layer-no-slot-for-docs-and-ai-rules` / `spdx-header-cannot-split-within-file`、および `down-sql-layer-unassigned` / `cc-by-4-agpl-compat-unverified`）。★本表は編集していない（D-382）。設計卓が畳むこと。
    10. ★「名前に seed が付く = 層 B」で分けていたら 25 本を取り違えていた（seed 名 35 本中 4 本が層 A、seed 名を持たない 45 本中 21 本が層 B）。設計卓が挙げた 3 数字（27 / 80 / 35）自体は 3 つとも合っていた。

### M14-03f: 第四波 seed（残り 14 キャラ）（2026-09-02）

- **結果**: 14 キャラ（未 seed 12 ＋ 仮登録 `c_viper` / `dhalsim`）を 1 波で投入し、`characters` が 19 → 31 で**全ロースター充足**。**消費マイグレ 20 本＝`000082`〜`000095` ＋ `000097`〜`000102`**（★`000096` は並列タスクが消費。次に払い出すのは `000103`）（第一段 10 本 ＋ **第二段 4 本**。★`000081` は並列タスクが使うため未使用。⇒ **次に払い出すのは `000096`**）。CHANGE 消費 0。`go test ./...` 55 ok / 0 FAIL（着手前と同数）、`make e2e` 226 passed / 0 failed（同）。**★§0.2 判定＝`c_viper` / `dhalsim` の UNIQUE 衝突経路は失効しており「必ず最終波」の制約は成立しない**（全 80 マイグレ適用済みクリーン DB へ実適用して確認）。仮登録 2 体は削除せず再利用した。
- **報告**: 完了報告 `docs/progress/M14-03f-completion-report.md` ／ レビュー `docs/progress/m14-03f-review.md` ／ 開発者への記入依頼 `docs/progress/20260902-M14-03f-manual-input-list.md`（第二段の 4 群）。**レビュー指摘 16 件（高 5 / 中 5 / 低 6）＝採用 15 / 不採用 1。★「高」の不採用は 0 件。再レビュー往復 0 回。** 不採用の 1 件（中-2＝seedgen ヘッダの「投入元は 000025」）は **既存 followup `seedgen-header-provenance` が「波の実装サブでは触れない」と裁定済み**のため。★同 followup の緩和策（波の文書へ「ヘッダの投入元表記を信じないこと」を注記）が `M14-03f` 指示書に欠けていたので完了報告 §16 に書いた

- **★横断課題**:
    1. **★★`000062` ヘッダの一般化「1 回きりの backfill は後から INSERT される行を拾わない」は *是正マイグレ* にも当たる。** 本サブで実際に踏んだ——`000083` を `000054` から写した結果、`000080`（`M24-08` / `D-615`）が是正した旧表記「前ダッシュ / 後ろダッシュ」を 12 キャラへ入れ直していた。**★alias 行は在るのでフォールバックも起きず、テストも lint も緑のままだった。** 是正マイグレの全数実査（キャラを絞っていないものは `000080` の 1 本のみ）と、31/31 で揃うことを固定する検査を置いた。**⇒ 次の seed 波は backfill だけでなく `*correct*` / `*fix*` も 1 本ずつ判定すること**（手順は `character_data/seed-progress.md` へ追記済み）。
    2. **★★機械規則（`000050` / `000062`）は `startup_basis` を *誤る* ことがある。** 第四波 CSV との全数突合で、規則が `standalone` と判定する行のうち **28 行**は `through` が正しかった（**ジャンプから通した値 23 行** ／ **地上必殺技からの派生の通し値 4 行**＝`ed/psycho_shoot` ／ **根拠を確かめられなかった 1 行**＝`chun_li/wall_jump`）。**★`is_aerial` では説明できない**——26 行は `is_aerial=false` である。**★誤ってもエラーにならず、`M19-05` の費用規則が静かに誤った分類で回る。** ⇒ **CSV の新列 3 本が埋まっている波では、機械規則を使ってはならない**（「規則の上位集合だから安全」ではない）。
    3. **★`-noinput-only`（`P-34` / 層 C-3）の 2 本が要るのは `M20-06` より前に生成した波だけである。** 生成器は通常実行でも層 C-3 を出力し、`-noinput-only` は**出力を絞るだけ**である。⇒ 第四波では段 12/13 が不要だった。**★ただし固定表 `noInputDerivedTargets` に自分の波のキャラは自動では載らない**——第四波は該当 11 件のうち 5 件を開発者判断で足した（`cammy` レイザーエッジスライサー 3・`akuma` 百鬼豪斬 2）。
    4. **★二段構えの第二段のうち 2 群を同日に投入した**（`000092`〜`000095`）。**移動 5 code の `total` 70 行＝全 31 キャラで充足** ／ **`custom_states` 9 状態＝14 キャラすべての要否が確定**（要 4・不要 9・既存 1）。**★残る 2 群は `chain_cancel_total`（13 キャラ未実測。ロースター判定自体が実測項目）と `move_derivations`（候補表 277 件の回答待ち）。** 請求用紙は `20260902-M14-03f-manual-input-list.md`。
    4b. **★★`DES-003` §3.2 の「設置技が置かれた状態から始まるコンボ（JP・ベガ・ブランカ 等）→ subject: self」と、2026-09-02 の開発者裁定（ベガ「サイコマイン付与」＝`opponent`）が食い違う。** ⇒ 裁定に従い `opponent` で投入し、**設計書側の是正を設計卓の手番として完了報告 §14 へ記録した**（製造は `docs/design/` を編集しない＝`CLAUDE.md` §8）。**★CHANGE 起票の候補。**
    4c. **★第四波のスコープ外を 2 件直した（設計卓未連絡）**——`000094`（`jamie` / `m_bison` の `custom_states` 投入漏れ）と `000095`（`kimberly` の値域 2→3・アップデート追随）。**開発者の明示依頼で実施し、設計卓へは開発者が後日連絡する。**
    4d. **★`show_delta` の規則を私が記入依頼で誤って説明していた**（「int 型なら自動で true」）。正本は `customStates.ts` の「**方向可変なら true・単調増加/減少は省略**」であり、**同じ int 系でも `blanka_chan_bomb`（消費型）は `true`、`jamie/drink_level`（減少しない）は省略**と割れた。⇒ 記入依頼と `seed-progress.md` の両方を是正した。
    4e. **★★第三段（2026-09-04）で群2 を投入し、二段構えの残りは群4 だけになった**（`000097`〜`000099`）。成果表 `chain-cancel-measurements.md` が **55 件/18 キャラ → 93 件/31 キャラ**へ更新され、第四波 13 キャラの **38 行**を投入。**★ロースターはやはり非対称だった**——`e_honda` / `ed` は 2 技のみ、`blanka` は Stand LP でなく Stand LK、`dhalsim` は特殊技 `agile_kick`（`category='unique'`）を含む。**圏外 4 件は「まだ測っていない」ではなく「測って圏外と確定した」**ので NULL のままが正であり、テストで対の主張として固定した。
    4f. **★★「連打版」の第 2 例（ダルシム）が出た。ザンギエフとは出現条件が違う。** ザンギエフは 2 打目以降なら常に連打版だが、**ダルシムは直前技が Stand LP または 1LK のときだけ**（直前が屈弱P なら素が出る＝ボタンでなく **技の同一性**で決まる）。⇒ `move_derivations` の親集合を **2 技だけ**にした（`000061` のザンギエフは 3×3 の直積で 9 行）。**同じ親集合駆動の 1 規則で両者を表現でき、新列もキャラ分岐も要らない。**手順は `character_data/seed-progress.md` の「#5 の派生」へ一般化して置いた。**★`000051` を手本に写すと `preset_aliases.character_id` が落ちる**（`000074` で後から追加された列）。
    4g. **★★設計卓から受領した `M19-DESIGN-07` が本リポジトリと別系統だった**（自称 v1.0.9・基底 v1.0.6 ／ リポジトリは v1.8.1）。そのまま上書きすると **是正 8 件が巻き戻る**——とくに **ボード `M-13` が一度潰した撤回済み定義 `G = 1 − N` が復活する**（`D-24` / `D-38`）。**★受領文書は上書きする前に既存値と全数照合すること**——本件は照合で検出し、上書きを止めて開発者へ報告した（成果表側は既存 55 行が 55/55 一致で健全だった）。⇒ 開発者裁定により**新規差分 4 箇所だけを v1.8.1 へ移植して v1.9.0** とした。**設計卓は以後 v1.9.0 を基底にすること。**
    4h. **★`chain-cancel-worklog.md` は成果表が参照しているだけで、リポジトリに一度も存在したことがない**（設計卓の手元資料。v2.6.1 で参照が 5 か所へ増えた）。開発者に確認して**配置対象外**と確定（2026-09-04）。**リンク切れの参照が残ることを承知のうえで現状維持**している。
    4i. **★★第四段（2026-09-04）で群4 を投入し、二段構えは完了した**（`000100`〜`000101`）。**裁定 277 件のうち投入は 169 件（61%）で、108 件（39%）は「行を作らない」だった。** **★機械提案をそのまま入れてはいけないことが数字で確認できた**——候補には**ターゲットコンボ・強化版の別技・ホールド版の独立技**が紛れており、`notes_tool` と `move_code` 接頭辞では弁別できていなかった。手順は `character_data/seed-progress.md` の「#9 `move_derivations`」へ一般化して置いた。
    4j. **★★`jump_*`（移動 system move）を親にする行が初めて入った**（21 子 / 52 行＝豪鬼・ブランカ・C.ヴァイパー・ダルシム）。**開発者は既存キャラ分を機械提案でなく全件目視で決めたいと明言した**（2026-09-04）。⇒ 一覧を記入依頼の**群5**として提出したところ、**論点が 2 つに割れていたことが開発者の問い返しで判明した**——**①ジャンプ攻撃そのもの**（`jumping_*P/K`・全 31 キャラで 186）と **②ジャンプ前提の必殺技・特殊技**（既存 17 キャラで 36）。**★①は「付けない」で裁定（2026-09-04）。②の 36 件が回答待ち。** 「付いていたら消してほしい」との指示で実査したが**削除対象は 0 行**だった。**★線引き 1 件**＝`c_viper/high_jumping_*` の親 `high_jump` は `category=unique`・command を持つ**入力技**であり移動 system move とは別物なので残す。
    4k. **★★製造が自己参照 3 件を外した**（`elena/lynx_whirl_{light,medium,heavy}`）。親リスト「リンクスワール系（スピンサイズ派生版含む）」9 code に**各子が自分自身を含んでいた**。開発者裁定「`lynx_whirl_od` は自己参照なので行を作らない」と同じ原理で 1 組だけ外し、残る 8 親は投入した。**★自己参照を入れると導出「`standalone` ∧ 親あり → 単独入力不可」が自分自身で成立し、単独で出せる技がセットプレイ候補から静かに落ちる。**
    4l. **★★候補集合の増減を実データで測った**（**`D-274`**＝「設計文書の読解だけを根拠にしない」）。**単独入力不可 17 → 86（+69）**＝投入した子 169 件の 41% が候補から外れた。**★この増減は既存テストを 1 本も動かさなかった**（`setplay` / `punishfinder` の件数固定テストは fixture ベースで実データを引かない）。**⇒ 実データの増減はテストが自動では守らない。専用の測定テストを新設した。**
    4m. **★★`csv-edit-vs-golden-divergence`（三点更新）の 2 例目を踏んだ**——キャミィ `hooligan_combination_holding` → `_holding_heavy` の改名。**★判別述語は `D-336` が決着させている**＝「『適用済みマイグレは改変しない』と三点更新は上下ではなく**適用対象が違う。判別の述語＝そのマイグレは生成物か手書きか**」。⇒ seedgen 出力の `000084` / `000085` は**再生成**し、手書きの `000087` / `000089` / `000099` は無改変（旧 code は 0 件）。**★`seedgen -check` を先に回すと、直す前にどの生成マイグレが動くか分かる**（実測＝動いたのは 2 本だけ、`000086` / `000090` / `000091` は byte 一致）。手順は seed-progress の「#10」へ一般化した。
    4n. **★既存 `move_derivations` を 74 行と見積もったが実測 90 行だった。** `000064` は `pa.code IN (...)`、**`000067` は `pa.code = ...` の単数形**で書かれており、同じ正規表現では拾えなかった。**⇒ 件数ガードは実測で置く。SQL のパースで見積もった値を期待値にしない**（m19-04c §12.4 と同じ形）。テストが 1 発で捕まえた。
    4o. **★★「候補表に無い＝判断済み」ではない。** `move_derivations` の候補表は**非 rush の派生技**（`is_derived=true`）を母数にするため、**通常ジャンプ攻撃（`is_derived=false`）は最初から視界に入らない**。⇒ 第四波で②に `jump_*` 親を付けたとき、①は**判断されないまま通過**していた（結果は「付けない」で正しかったが、それは偶然である）。**★裁定は記録だけでは守れない**——①は候補表に載らないので、次の波が抽出条件を変えると静かに破れる。⇒ `TestRun_M1403f_JumpNormalsHaveNoParent` で機械的に固定した。一般則は `character_data/seed-progress.md` の「#9 の付則」へ置いた。
    4p. **★①の裁定の根拠が設計資料のどこにも無い**（**設計卓の手番**）。`M19-DESIGN-07` にも `DES-003` §3.3 にも「ジャンプ攻撃を `move_derivations` の子にしない」根拠は書かれていない。**「①は付けず②は付ける」という線引きが、資料に無いまま実装だけ在る状態**になっている。完了報告 §14-21 に名指しで記録した。
    4q. **★★第五段（2026-09-04）で既存キャラのジャンプ派生を投入し、二段構えは完全に終わった**（`000102`・11 キャラ / 子 43 / **56 行**）。**★「機械で候補を挙げる」だけでは取り落とすことが実証された**——製造の棚卸し 36 件のうち**採用は 15 件で、21 件は「対象外」**。かわりに**棚卸しに載っていなかった技が 28 件（6 キャラ分）**追加された（`lily/condor_dive` 系 4 ／ `juri/shiku_sen` 2 ／ `zangief/borscht_dynamite` 2 ／ `rashid/arabian_skyhigh_*` 4 ／ `jamie/luminous_dive_kick_*` 4 ／ **`ingrid/solar_burst_*` 14**）。**★製造の抽出条件（`is_aerial` ／ code に `aerial|jump|air` ／ 名前や `notes_tool` に「ジャンプ・空中・エリアル」）は、コンドルダイブ・疾空閃・ボルシチダイナマイト・無影蹴・ソーラーフレアのどれにも当たらない。****技名からジャンプ前提と分かるのはドメイン知識であって文字列ではない。**
    4r. **★★CSV の 3 列が陳腐化していた**（開発者要求で発覚）。逐語＝「アップデート対応は CSV を外部ツールで取込 → 修正 → **差分のみマイグレで取込**となるため、CSV 側だけが陳腐化していると問題」。実測＝`startup_basis` **1186 セル**・`fastest_unreachable` **1445 セル**・`chain_cancel_total` **89 セル**が空。⇒ **2720 セルを DB から書き戻した**（上書きした既存値は 0 件）。**★原因はテストが無かったことである**——この 3 列は `seedgen` が「読むだけで SQL 非投入」（`csv.go`）なので **golden が守らない領域**だった。⇒ `TestCSVAndDBAgreeOnFrameCostColumns` を新設。**値を揃えるだけでは再発する。**
    4s. **★`chain_cancel_total` を CSV に書く裁定へ変わった**（`D-94` / `D-99` を覆す・**設計卓の手番**）。整理＝**値の正本は `chain-cancel-measurements.md` のまま、CSV は運搬役**。**2 か所問題は機械検査で解いた**。**★適用済みの `000052` のヘッダは改変していない**（`D-535`）ため、**ヘッダと現行運用が食い違ったまま残る**。完了報告 §14-23。
    4t. **★DB を唯一の出所にした（SQL のパースで再導出しない）。** 4n で踏んだ穴（`000067` の単数形を取り落として 90 行を 74 行と見誤った）を手順として固定した——**クリーン DB へ全マイグレを適用して dump する**。あわせて**CSV の往復忠実性を先に確認する**（`marisa.csv` に**改行を含む引用フィールド**が 1 件あり、行単位の編集では壊れる）。手順は `character_data/seed-progress.md` の「#11」へ置いた。
    4u. **★★開発者の手動検証で合格（2026-09-05）。** C.ヴァイパー（KA=54・target を「しゃがみ弱K」に固定）で提案 146 件・イングリッド（KA=68）で 2454 件。**除外されるべき技はいずれも出ず**（ハイジャンプ通常攻撃 7・チェイスナックル・トレースコンビネーション・ダブルバーン ／ **ソーラーフレア 14 行は 1 行も出なかった**＝`000102` の検証そのもの）、出るべき技は出た。**★製造が出した「表示 3 件」という予測は誤りだった**——プローブが **1 filler の組み合わせしか数えておらず、`buildFillerUnits` の連鎖を勘定に入れていなかった**。実際は 146 件。**⇒ 手動検証の期待値を出すときは、本番の組み立て関数まで通すこと。射影（`ProjectCandidates`）だけでは件数を語れない。**
    4v. **★★`isSoloUnavailable` は「提案から消す」述語ではない**（手動検証の過程でコードを読み直して判明・記述を 3 か所是正）。**`buildFillerUnits`（`service.go:530`）は連鎖の 2 番目以降にはむしろ単独入力不可の技を *優先して* 使う**（逐語＝「2 番目以降の候補。単独入力不可の員があればそれを使う」）。⇒ 正しくは **filler の先頭（head）と target からは落ち、`chain_cancel_total` を持つなら連鎖の 2 発目では優先される**。実測で該当は **4 行だけ**（`zangief` 連打版 3 ＋ `dhalsim/crouching_light_punch_rapid`）で、**連打版が「2 発目にしか出ない技」であることと噛み合っている**。**★製造は「filler / target から落ちる」とだけ書いていた**——完了報告 §19-7 ／ 設計伝達レポート §1-3 ／ `seed-progress.md` #9 付則 を是正した。
    4w. **★開発者の手動確認 4 件がすべて合格（2026-09-05）。** ①実アプリのセットプレイ提案（4u）／②**12 キャラの表示名のインゲーム突合＝12/12**／③**外部ツールでの CSV 往復＝3 列が保持されることを確認**（⇒ 4r/4s の書き戻しは目的を果たす）／④ダルシム連打版（`damage`/`on_hit`/`on_block` が NULL）の画面表示に崩れなし。**★②で `characters.name_ja` の正本がリポジトリに無い構造は変わらない**——本波は解消したが**次の波でも目視が要る**。**⇒ 波の指示書の完了条件へ「表示名の開発者突合」を入れることを設計卓へ依頼した**（完了報告 §14-25）。
    5. **★`move_derivations` は `notes_tool` から 48% しか手がかりが無い**（非 rush の派生技 277 件中、親らしき記述があるのは 132 件・手がかりゼロが 113 件・自己参照 4 件）。しかも親は日本語の技名で書かれており `move_code` への写像は機械では確定できない。**⇒ 候補表を出して開発者の◯×を待つ**（既存 88 行も同じく開発者の「〜からのみ派生」断定から作られている＝`000064` の D ブロック）。
    6. **★全キャラ seed 済みになり「技データ未投入キャラ」の E2E が組めなくなった。** Go 側は fixture で作り直して守ったが、E2E スタックは `-tags=debug` を使わないため spec からキャラを差し込めない。⇒ 画面側の被覆を 1 つ失った（`m17-03` / `m17-04`）。
    7. **★`characters.name_ja` / `name_en` の正本がリポジトリに無い**（`000079` が「migrations だけが書く」と明記）。12 キャラの表示名はリポジトリ内の記述を根拠に置いた値であり、**インゲーム表示との突合を開発者へ請求済み**。ズレていれば `000079` と同型の 1 セル UPDATE で直せる。
    8. **★`000081` を後から作る場合の順序に注意**。本波を先に適用した DB に後から `000081` が現れると、その 1 本は永久にスキップされ、しかもエラーにならない（`D-119` / `D-120`）。⇒ 開発者の dev DB へ本波を適用する前に `000081` を取り込むこと。
    9. **★連番の写し先が失効する**——`change-number-registry.md` §1 ／ ボード §1 冒頭【採番の現在地】／ ボード §2.2 の 3 か所が `000081` のままになる（`E-114` / `E-191`）。**★製造は同書を編集しない**（`D-382`）。設計卓の手番。
    10. **★レビューが見つけた「実装は正しいが記述が実物と食い違う」型が 5 件あった**（全件是正済み）。**内訳が示唆的である**——(a) `move_derivations` の down 判断を「書いた」と報告しながら実際にはどのヘッダにも無かった ／ (b) 段 9 の「28 行」の理由が 23 行にしか当たらず、しかも**4 か所へ複製済み**だった（`ed/psycho_shoot` 4 行は別の型、`chun_li/wall_jump` 1 行は根拠不明。あわせて「空中必殺技」も誤りで 26/28 は `is_aerial=false`） ／ (c) seedgen の生きたコメント 5 か所が「CSV を持たない `c_viper` / `dhalsim`」を分離の理由として書いていた（本サブで両者の CSV を使った時点で失効） ／ (d) `character-sort.ts` の受容裁定の母数が 19 体時点のまま（3 件 → 6 件へ倍増） ／ (e) 失効 5 か所が §14 に載っていなかった。**★いずれも動作は正しくテストも緑であり、人が読む以外に見つける経路が無かった。**
    11. **★seedgen が生成する down には、波ごとの判断を書けない**（golden が byte 一致を守るため手編集できない）。**⇒ `move_derivations` の明示削除責務のような「その波固有の判断」は、手書きの down に置くしかない。** 本波は `000082.down` に置き、その理由ごと記録した。**★次の波も同じ制約を受ける。**
    12. followup-backlog 本表への登録候補 10 件を完了報告 §15 に置いた（解消 3 件＝`viper-dhalsim-unique-collision-undetermined` / `elena-chain-cancel-two-rows-unseeded` / `seed-progress-procedure-misses-p34-aliases`、継続 2 件、新規 5 件）。**★本表は編集していない**（`D-382`）。
### M27-01: ヒット種別の追加と区分名の整理（2026-09-02）

- **結果**: `go test ./...` / `pnpm test`（2343 件）/ `make e2e`（226 件）すべて緑。**マイグレ `000081` を 1 本消費（⇒ 次の払い出しは `000082`）**。CHANGE 消費 0（次番 `151` の見込み。★成果物の承認後に設計卓が起票）。ヒット種別 4 値 → **8 値**（`drive_impact_wall_splat_hit` / `drive_impact_wall_splat_block` / `drive_impact_punish_counter` / `stun`。既存 4 値は不変・既存データも不変）。相手の大きさ 3 値 → **4 値**（`medium` → `standard` 改名 ／ `large` 新設 ／ `large1`・`large2` はラベルのみ変更）。実装差分は 39 ファイル / +1,071 / −75。
- **報告**: 完了報告 `docs/progress/M27-01-completion-report.md` ／ 段 1 成果物 `docs/progress/M27-01-report.md` ／ 画面モック `docs/progress/M27-01-mock/m27-01-hit-type-and-size.html` ／ レビュー `docs/progress/m27-01-review.md`。着手基点は `78f4981`。レビュー指摘 13 件（高 6 / 中 4 / 低 3）は**全件採用・「高」の不採用 0 件**・再レビュー往復 0 回。
- **★横断課題**:
    1. **★★マイグレの払い出し番号が動いた。** `M14-RESEARCH-03` と `M26-01` の索引行が書いた「**次の払い出しは `000081` のまま**」は本サブで失効した。**⇒ 次は `000082`。** 指示書 §4-6 が「`M14-03f` と `M28-01` も同じ帯を使う見込みであり衝突しうる」と明記していた帯である。**★ボード §2.2 の「次に払い出す番号」の更新は設計卓の手番。**
    2. **★★指示書 §4-2「『大1』『大2』の整理」の禁止に触れた。開発者の指示による射程拡大である。** 禁止の理由は §2.2-4 の逐語「**判断が済んでおらず、一緒に直そうとすると止まる**」であり、**開発者が判断を供給したことで禁止の前提が消滅した。** ⇒ followup `opponent-size-large-variants-defer` は `要判断` → 確定へ移る。**★本表は編集していない**（`D-382`）。設計卓が畳むこと。
    3. **★`followup-backlog.md` の 3 行が失効した**——`opponent-size-medium-to-standard`（解消）／ `opponent-size-large-variants-defer`（前提が消滅）／ `csv-import-opponent-size-whitelist-stale`（本文の「許容値が `small`/`medium`/`large` のまま」が失効。現在は `small`/`standard`/`large`）。**登録候補 3 件も完了報告 §8.2 に出した。**
    4. **★★完了時に設計卓へ連絡すること（開発者の明示指示 2 件）**——(a) **持続当ての別コンボ扱い**（`SM-116`。逐語＝「対象外。完了時に設計卓には連絡。phase4中には対応したいが、これは複雑な見込み。」）／ (b) **確定反撃ロジックの変更**（逐語＝「名前だけパニッシュカウンター。確定反撃のロジックは変更が必要で始動技がインパクトの時だけ使う」＋「別サブへ回す」）。**★(b) の現状＝生成の対象外にすることだけ入れた。タブ分けは触っていないため `drive_impact_punish_counter` は引き続き「区分を判定できない反撃」に出る。**
    5. **★★「対象外リスト」方式の落とし穴を実演した。** 計画段階で「新値は述語に入らないので変換導線には自動的に出ない（安全側）」と書いたが、**実体は逆であった**——`PUNISH_COUNTER_HIT_TYPES` も `service.go` の `switch` も「対象外を列挙する」形であり、**未知値は既定で対象になる**。⇒ 名前上すでにパニッシュカウンターであるものに PC 版生成の導線が開き、始動技ダメージ ×0.2 が上乗せされる状態だった。**★一般形＝「値を足せば安全側に倒れる」と仮定しないこと。列挙が許可リストか対象外リストかを、足す前に必ず読むこと。**
    6. **★`scripts/check-enum-sync.sh` は `opponent_size` を 1 件も見ていない。** 抽出パターンが接尾辞 `Category|Status|Type|Code` にしか一致せず `model.OpponentSize*` を拾わない。**⇒ 指示書 §5 完了条件 3「`check-enum-sync.sh` が緑」は相手サイズについては担保にならない。** 相手サイズは本サブで `label-keys.test.ts` の `KEY_MAPS` へ登録して塞いだ（それまで状況 4 軸のうち相手サイズだけ「値域↔キー 1 対 1」検査から外れていた）。ベースラインは 24 → 28（理由はスクリプト内と完了報告 §6）。
    7. **★「大1＝ザンギエフ／大2＝マリーザ」はリポジトリ内に記録が 0 件だった**（全文検索でヒット 0）。**本サブが初めて明文化した。** ラベルが「大1 / 大2」という無意味な連番だったことが、そもそも `opponent-size-large-variants-defer` が `要判断` になった一因と読める。
    8. **★改名前に書き出した CSV を取り込むと `medium` が復活する**（`000081` は 1 回きりの backfill なので拾わない＝`migrations/000062` ヘッダが一般化した型と同じ）。一覧・詳細では `labelFor` のフォールバックで**生の `medium` が画面に出る**。**★取込側で寄せないと決めた**（開発者裁定 (a) の射程を超えるため）。登録候補 `opponent-size-legacy-medium-on-import` を完了報告 §8.2 に出した。
    9. **★`docs/design/` の失効を 11 か所報告した**（完了報告 §7。**編集していない**＝指示書 §4-5）。とくに **`DES-005:1502` の述語は実装と食い違っている**——設計書は「対象＝`normal` / `counter` / NULL」と列挙するが、実装は否定形（`!punishHitTypes[...]`）であり**新 4 値もこのセクションに入る**。また **`OPEN-001`（状況コード値マスタ）は本サブが実質的に閉じた。**
    11. **★★開発者の手動確認は実施済み**（完了報告 §8.4。2026-09-02）。逐語＝「A,B,Cの確認は成功。見た目も問題なし。」**⇒ 製造が唯一「確かめられなかった」と記録していた実 DB の分布は解消した**——`(NULL)` 76 / `medium` **15** / `large1` 5 / `large2` 1（合計 97）。**★想定外の値は 0 件であり、マイグレの前提が実測で裏付けられた。** **★ただし 1 件だけ「対象なしで未実施」がある**——**古い CSV の取込**（改名前に書き出した CSV が環境に残っていなかった）。**⇒ 「確認して問題なかった」ではない。** 経路は構造的に残っており、`opponent-size-legacy-medium-on-import` の**実害の程度は測れていない**。
    10. **★`check-doc-inventory.sh` が鳴った 1 件は、例外を足さず「型に合わせる」で解消した。** 段 1 成果物を `M27-01-hit-type-proposal.md` → **`M27-01-report.md`** へ改名し、TYPES の `^M[0-9]+-[0-9]+-report\.md$`（サブ単位のレポート）に収めた。**★`EXCEPT` へは足していない**——`CLAUDE.md` §8 の逐語「検査を通すために足すと、本検査は存在しないのと同じになる」。`phase4-overview` §8.5.2 が逐語でこの名前を名指ししており、`M26-01` も同じ 2 本立てである。**★あわせて分かったこと＝過去モック 9 本は例外表に 1 件も入っていない**（同検査は `maxdepth 1` の `*.md` しか見ず、モックはサブディレクトリ配下の `.html` なので構造的に対象外）。

### M27-02a: 届かないものを届かせる（保存の理由・候補選択の操作）（2026-09-02）

- **結果**: `go test ./...`（55 パッケージ）/ `pnpm test`（2356 件）/ `pnpm lint` すべて緑。**マイグレ消費 0**（作業ツリーの `ls migrations/` の最大は `000081`。**★★ここから「次の払い出し」を導かないこと**——**`M14-03f` が別レーンで走っており、同サブが消費した番号は本ツリーに現れない**。**⇒ 次の払い出しはボード `parallel-board.md` §2.2 を見ること**〔2026-09-02 時点の正本は `D-689` で **`000092`**。`M14-03f` が `000082`〜`000091` の 10 本を消費済み〕）。CHANGE 消費 0（★製造は自採番しない。たたき台は完了報告 §5）。**6 件のうち 3 件を直し、2 件は開発者裁定で対応不要、1 件は前提が失効していた。** 実装差分は 16 ファイル / +697 / −76。
- **報告**: 完了報告 `docs/progress/M27-02a-completion-report.md` ／ レビュー `docs/progress/m27-02a-review.md`。着手基点は `0853c74`。
- **★横断課題**:
    1. **★★`combo-put-error-message-empty` は追跡行より 1 件多かった。** `PUT /api/combos/:id` だけでなく **`PATCH /api/combos/:id` も同じ欠落**であった（`D-690` で射程内と確定）。**⇒ 一般形＝「追跡行に書かれた件数」は調査の出発点であって射程の定義ではない。** 起票時の件数をそのまま射程と読むと、1 か所だけ直して次に同じ報告が来る。
    2. **★★`GET /api/moves` の 500 の判別は (a) 非対称の是正であった。** 500 `internal_error` の応答サイトは **53 件あり、うち 52 件が非空の `message` を持つ**。⇒ 局所的な正解が存在するので方針決定ではなく射程内（`D-690` §2.1.3.2）。**★影響は束 A の 3 件より大きい可能性がある**——同経路は編集画面の技選択が引くもの（`web/src/features/moves/api.ts:28`）で、**応答そのものが「何が起きたか」を 1 文字も載せていない**状態だった。**★ただし画面の見せ方は本修正だけでは変わらない**（レビュー 中-1 で訂正。**索引行の初版は経路を取り違えていた**）——`moves` は `web/src/lib/api-client.ts` の `fetchJSON` を通り、同関数は `error.message` を読まず生ボディを `Error` に詰めるため、修正の前後とも画面には `HTTP 500: {…}` が出る。**⇒ 直ったのは応答の契約であって見せ方ではない。** 残課題候補は完了報告 §6-6。
    3. **★★`editor-validation-errors-unreachable-from-ui` の前提が失効している。** 追跡行の「画面から到達できる検証エラーが 1 件も無くなった」は**現在は成り立たない**——`setups[*]`（`VAL-S02` / `VAL-S04`）は **FE の zod が検証しないため BE だけが持ち、UI から到達できる**（実サーバへの `curl` で実測）。⇒ 設計卓の裁定 (a)「そのまま残す」は結果的に正しいが、根拠は「備えとして残す」ではなく「**現に使われている**」である。**★`DES-006` に同趣旨の記述があれば失効させること**（完了報告 §5）。
    4. **★`SD-015` / `SD-016` は開発者裁定で対応不要**（2026-09-02）。**★ただし `SD-015` の調査で別の非対称が出た**——**エディタでキャラ欄だけが順送りの停止点になっていない**（他の 20 停止点は `Enter` で進む）。原因はキャラ欄が `ComboEditorBasicFields`（`rootRef` が付く領域）の外・タブより上に描かれていること。直すなら `useFieldSequence` の根を上げる必要があり順送り契約（`DES-005` §5.7）に触れる。**登録候補として完了報告 §6-1 に出した**（`D-382`。本表は編集していない）。
    5. **★`SD-016` は再現しなかったが、閉じる条件は Radix `DismissableLayer` の `pointerdown` 判定に全面依存している**（両部品とも自前の外側クリック判定も `blur` ハンドラも 0 件）。**⇒ 実装を差し替えると黙って再発しうるため E2E で固定した。** 「解消済み」と書いて閉じるだけにしなかった理由がこれである。
    6. **★★本サブの変更ではない既存の失敗を 2 件確定させた。** (a) **`m24-12-editor-rebuild.spec.ts` (3)** が落ちる ／ (b) **`scripts/check-import-order.sh` がベースライン +1（102 / 101）**。**どちらも着手基点 `0853c74` の状態へ全ファイルを戻して同じ結果になることを実測した。** **★★(a) は 2026-09-03 の再調査で判定が変わった——「常に落ちる既存の失敗」ではなく「実行モードで結果が変わる順序依存のテスト」である。`make e2e`（全数）は現 HEAD で 229 件すべて緑であり、落ちるのはこの spec だけを単独で走らせたときに限る（先行 spec を 1 本足すだけで通る）。★コードの退行ではない——`44cabf5`（`M27-01` の tip）と `0853c74` は `web`/`internal`/`migrations`/`cmd` の差分が 0。詳細は完了報告 §6-2b。★retry の「`POST /api/combos` の応答に id が無い」は別の欠陥ではなく、assert で落ちて後片付けに到達せずコンボが残るため `VAL-C02` になるだけである——拾う人は 1 回目の失敗だけを見ること。** ★`check-import-order.sh` は「増える方向の更新はしない」と自ら定めているのでベースラインは触っていない。**⇒ 「flake だろう」で済ませず帰属を確かめる手順（変更ファイルを `git show <基点>:<path>` で戻して回す）を残しておく。**
    7. **★`SearchableSelect` の波及数は「直接 import 2 ファイル」ではない。** `CharacterSelector` 経由の間接を含めると **15 コントロール / 13 ファイル**（＋ mock 追随が要るテスト 4 ファイル）。**★共通部品を触る判断はこの数を出してから行うこと。** 本サブは数を出したうえで「約 30 行のキーボード処理だけを共有し、`TagSelector` の統合はしない」という中間解を採った。

### M27-02b: 入力仕様の 3 状態（必須・任意・未検証）（2026-09-03）

- **結果**: `go test ./...`（55 パッケージ）/ `pnpm test`（**2373 件**）/ `make e2e`（**239 件・新規 10 件を含む**）/ `tsc` すべて緑。**レビュー指摘 17 件（高 5 / 中 7 / 低 5）を取り込み、高は全件採用・不採用は中 1 / 低 2 のみ**（★「高」の不採用 0 件）。**マイグレ消費 1 本＝`000096`**（**★開発者が `000096` 以降を払い出した**。**`combos.oki_verified` の追加**（★当初は `combo_oki_options.available` だったが方式変更で中身を差し替えた。下記 横断課題 0）。**★★マージ順は `M14-03f` が先である**——同サブが `000082`〜を連番消費中であり、本サブが先に `main` へ入ると連番に穴が開く。`golang-migrate` は適用済み最大版数より低いファイルを後から適用しないため、**配布先の DB にだけ欠落が残りエラーにならない**）。CHANGE 消費 0（★製造は自採番しない。たたき台は完了報告 §5）。**5 件のうち 4 件を実施し、1 件（`SD-020`）は仮想コントローラ由来と判明したため直さず止めた。** 実装差分は 59 ファイル / +2660 / −130。
- **報告**: 完了報告 `docs/progress/M27-02b-completion-report.md` ／ レビュー `docs/progress/m27-02b-review.md`。着手基点は `560e5b4`。
- **★横断課題**:
    0. **★★`P4M-011` は実機確認で方式を作り直した（セル単位 → コンボ単位）。** 指示書 §2.3「2 状態を 3 状態にする」を**セルの状態**と読んで `combo_oki_options.available` を足したが、開発者が言っていたのは **「起き攻めという節を一度でも調べたか」** であった（2026-09-03 逐語＝「やりたいことがそもそもずれていました」）。**⇒ `combos.oki_verified` の 1 フラグへ改め、セル側は M16-03 のまま全面差し戻した。**
        - **★★レビュー（fresh subagent・17 件指摘）もテストも E2E も検出できなかった。** すべてが「セル単位で作る」という前提の内側で整合していたためである。**「正しく作れているか」は検査できるが、「正しいものを作っているか」は検査できない。**
        - **★代償の差が大きい**——セルに掛けると 12 セル × 2 群の入力になり読む面 6 か所へ波及したが、節に掛けるとトグル 1 個・詳細 1 か所で済んだ。
        - **⇒ 一般形: 「N 状態にする」を受けたら、状態の数より先に *何に掛かるか* を確かめること。**
        - **★★マイグレを「番号据え置きで書き換える」のが安全なのは、そのファイルをどの DB も適用していないときだけである。** `000096` は main へ入っていなかったので `000097` で打ち消さずに済んだが、**私は直前に「実機で当ててみてください」と案内しており、開発者の DB は旧 `000096` を適用済みだった**。`golang-migrate` は**版数しか見ない**ため何も適用されず、**`no such column: oki_verified` が「重複判定の失敗」という無関係な顔で出た**（2026-09-05・開発者が使い捨て DB を作り直して復旧）。**⇒ 実機確認を依頼したマイグレを作り直すときは、依頼先の DB の巻き戻し手順を同時に出すこと**（手順は完了報告 §7.1）。
    1. **★★`SD-020` は `M30` の射程である（直さずに止めた＝指示書 §0.3 のゲート）。** OD(弱中)/(中強)/(弱強) を描いているのは **仮想コントローラの部品** `VirtualController/SpecialMovePanel.tsx` である。**★ただし面は 1 つではない**——`labels.ts` の `MODIFIER_FLAGS` にも同じ 3 つがあり、こちらは素の `ModifiersEditor` に出る。**⇒ `M30` へ移すとき片方だけ直すと、もう片方が残る。** また **「在るキャラだけ出す」は現状のデータでは判定できない**（3 変種は `inputResolution.ts` のハードコード定数から出ており、キャラ別の在/無を示すデータがどこにも無い）。**⇒ 採るならデータ作業が先に要る。**
    2. **★★`Materialize` は `VAL-C15` を通らない。** 同関数は `ValidateComboForCreate` を呼ばず内部で重複判定だけを行うため、**確定反撃から生成された本登録コンボは必須 4 欄が空のまま在りうる**。本サブの射程（編集画面）外のため触っていないが、**必須化の抜け穴として残る**。
    3. **★★必須化の影響の実数は、DB が無くてもテストが数えてくれる。** 件数を測る DB が本環境に無い（`*.db` は `.gitignore`、コンボは seed にも無い）ため §2.1.2 の「引っかかる件数」は出せなかったが、**着手直後に既存テストが 58 件落ちたこと自体が「本登録コンボを 4 欄なしで作っている箇所」の実測**であった。**⇒ 「データが無いから測れない」で止めず、コード側の母集団を数える手がある。**
    4. **★★データの意味を変えたら、その意味を読んでいる側を全数洗うこと。** 起き攻めを「行の存在＝利用可能」から 3 状態へ変えたとき、**その前提で読んでいた箇所が 6 か所あった**（`VAL-C11` ／ API DTO ／ CSV 取込・出力 ／ 詳細 ／ 比較 ／ 出力モデル）。**★型検査は「書く側」を全部見つけたが、「読む側」は見つけない**——`presence.has(...)` のような真偽の解釈は型に現れない。**放置していた 3 か所は嘘の表示になっていた**（検証して「成立しない」と記録したものが ✓ で出る等）。
    5. **★★同じ問題を先に解いた場所を探してから設計すること。** 起き攻めの 3 状態は `combo_setup_results`（`000042`）が先に解いており、**「未検証＝行なし／検証済み＝行あり＋値」**という形と、**巡回トグルが 2026-07-28 の実機確認で却下された記録**（`constants/setup-result.ts` に逐語）まで残っていた。**⇒ 探さなければ、却下済みの形をもう一度作っていた。**
    6. **★ゼロ値が意味を持つ欄は、省略と `false` を区別できる型にすること。** API DTO の `available` を値型 `bool` にすると、**本欄を持たない古い要求本文が「検証済み・成立しない」として保存される**（ゼロ値 false）。`*bool` にして省略を `true`（従来の「含まれる＝成立」）へ寄せた。
    7. **★失効**（方式変更で取り下げ。横断課題 0）。~~起き攻めの入力群が 3 → 6 になった（開発者確認事項）。~~ 2026-08-28 の「攻撃種別ごとに 1 群＝3 群」の形を変えている。**巡回トグルを避けて「成立する／検証したが成立しない」の 2 群を置いたため**であり、**各群 4 個・2 列・数字キー・順送りの停止点 3 つは保っている**。完了報告 §6-1 で確認を求めた。
    9. **★★必須化をどこへ置くかは「主経路がどれか」を実装で確かめてから決めること。** 初版は `POST` / `PUT` にだけ検証を入れ、完了報告にも「編集画面の保存＝`PUT`」と書いたが、**実装は識別キー 7 項目が変わらない限り `PATCH`** である（`utils.hasKeyChanges`）。**⇒ 既存コンボの編集という主経路がサーバ検証を素通りし、必須化を守るのはフロントの zod だけだった**（レビュー 高-1 で是正）。しかも `UpdateMetadataInput` は present+null で NULL クリアが通るため、**API を直接叩けば必須にしたばかりの欄を空にできた**。**★HTTP メソッドの名前から役割を推測すると外す。**
    10. **★★`E-225` を実際に踏んだ。「`ls` を実行したか」ではなく「出力を読んだか」である。** `web/src/features/combo/schema.test.ts` を新規のつもりで上書きし、`M24-13` の既存テスト 12 件（88 行）を消した。**`ls` は実行しており出力にパスも出ていた**が、読まずに次へ進んだ。**★★上書き後も新規 8 件が緑で通る——テストは何も言わない。** 気づけたのは `git status` が `A` ではなく **`M`** を返したからである。**⇒ 新規ファイルを作ったら `git status` の A/M を確かめること。**
    8. **★`check-import-order.sh` のベースライン +1 は着手基点から在る既存の失敗である**（`M27-02a` の完了報告も同じ +1 を記録している）。本サブの新規 2 ファイルはいずれも違反リストに載っていない。
    11. **★★「表示する」を実装したつもりで、利用者が実際に踏む経路だけ不可視だった**（2026-09-05・開発者の実機確認で発覚）。詳細画面は `okiVerified` を**起き攻めの行が 1 つも無いときだけ**読んでおり、**チェックを付けて登録した場合＝最も普通の経路**では印が出なかった。**★「行があれば検証済みは自明」という推論で省いたのが誤り**——解除ガードを通せば「行あり ＋ 未検証」は作れる（CSV 取込も同じ）。**⇒ 表せる状態は、自明に見える組合せでも画面に出すこと。** 是正して見出しの隣へ常時出す形にした（完了報告 §3.2.2）。

### cleanup-20260905: 消し残しの掃除（`000012` の削除 ＋ 画面モック・session-prompts・`m19-desk-status`）（2026-09-05）

- **結果**: `tmp/drop-000012` で実施（開発者）。**削除＝`migrations/000012_seed_combos_durability.{up,down}.sql` ／ 画面モック 10 件**〔`M24-01` / `02` / `03` / `04` / `05` / `06` / `07` / `12` / `13` / `M27-01`〕**／ `session-prompts` の実施済み 8 本 ／ `docs/handover/m19-desk-status.md`**。**あわせて `session-prompts/README.md` §6 の一覧行を是正。** `go test ./...` / `make e2e` 緑。
- **報告**: 裁定＝ボード `D-706`〜`D-709` / `D-712` / `D-714`〜`D-716`。判定材料＝`docs/progress/20260905-migration-license-assignment.md` §4.5。
- **★横断課題**:
    1. **★★`000012` の削除でテストが 1 本落ちた**——`TestRun_MovesFrameColumnsDownRollback` が `down to v12: no migration found for version 12`。**★欠番そのものは無害である**〔`schema_migrations` は現在版数 1 行しか持たず、`Up` は穴を素通りする〕**。壊れたのは「隣の版数を直書きしたテスト」だけである。⇒ 2 つを混同しないこと**（`followup` `migration-version-literals-in-tests`）。
    2. **★★「データが残らない」と「消してもテストが通る」は別である。** クリーン DB で `SELECT count(*) FROM combos;` → `0` を確認しても、テストが落ちるかは分からなかった。**⇒ 捨てブランチで実際に消して `go test` ＋ `make e2e` を回す手順が唯一の検出器だった。★机上の `grep` では出なかった。**
    3. **★マイグレの穴は 3 つになった**〔`000012`（削除）／ `000081`（`M27-01`）／ `000096`（`M27-02b`）〕**。次に払い出すのは `000103`。★欠番の理由を `SUPP-001` §2.7 へ表で書くのは `M26-02` の射程である。1 行では足りない。**
    4. **★完了報告からモックへの参照は dead のまま残る。** `check-doc-refs.sh` の走査範囲は `docs/progress/` を含まないため**機械検査は拾わない**。**⇒ 完了報告は歴史記録として残し、削除の事実は本行が持つ**（`D-716`）。
    5. **★`P-24`（`m19-desk-status` の削除）は「削除の前提は満たされた」と書いてから 24 日かかった。** `CLAUDE.md` §10.Y が本書を「役目を終えても誰も消さないまま残る」実例として名指ししていた当のものである。

---

### M27-03: 一覧・詳細（欄の除去・フィルタ・符号の見せ方・戻り先）（2026-09-05）

- **結果**: `go build` / `go test ./...` / `pnpm test`（**2420 件**）/ `tsc` / `make e2e`（**245 件・新規 6 件を含む**）すべて緑。常設検査は `check-artifact-integrity.sh` を 1 本目に回して全件緑。**マイグレ消費 0**（次に払い出す番号は `000103` のまま）。**CHANGE 消費 1 本＝`DES-005`**、**★ただし `DES-002` §4.2 にも反映が要る**（レビュー 高-2 で「変更なし」を撤回。クエリ 1 本の追加＝`CHANGE-095` と同じ性質。**応答形は 1 バイトも変えていない**）。**射程 6 項目のうち 5 件を実装し、1 件（`combo-list-setup-count-hides-fetch-failure`）は影響評価を出して開発者判断で未実施。** 実装差分は 28 ファイル / +2118 / −93。**開発者判断 4 件を得てから実装**（短縮表記の語＝案A ／ 実装手段＝`SearchableSelect` ／ 符号の見せ方＝案3 ／ §2.5 はやらない）。**レビュー指摘 17 件（高 3 / 中 6 / 低 8）を取り込み、★「高」の不採用は 0 件**（不採用は低 1 件のみ＝候補一覧の幅。目視が要りコード上で判定できないため）。**再レビュー往復 0 回。**
- **報告**: 完了報告 `docs/progress/M27-03-completion-report.md` ／ レビュー `docs/progress/m27-03-review.md`。着手基点は `9d28683`。
- **★横断課題**:
    1. **★★`combo-list-setup-count-hides-fetch-failure` は実装せずに止めた（開発者判断・2026-09-05）。** 一覧応答の `setups` は失敗時も `[]` になり **200** で返るため、**その値からは永久に区別できない**。契約を変えずに区別する経路は 1 つだけ在る（一覧が `GET /api/setups?characterId=` から取り直す）が、**一覧を開くたびに 1 リクエスト増え、件数と展開行の出どころが変わる**。
        - **★実害は「全行 0 件」だけではない**——**同じ `combo.setups` が展開の ▶ も駆動しており、矢印が全行から消える**。件数列は既定 OFF だが、**▶ の消失は列設定に関係なく全員に及ぶ**。
        - **★★同型の握り潰しが他に 2 か所ある**（コンボ詳細 ／ 作成）。**⇒ 本件だけ直してもパターンとしては残る。`DES-002` §4.2 を次に触る機会に 3 か所まとめて決めるのが筋である**（`CHANGE-127` が「規則は一覧経路一般に当てはまる」と書いた場所そのもの）。**本サブで 1 か所だけ別の作法を入れると、その 1 か所が後の統一の障害になる。**
    2. **★★「N が長い」と言われたら、N が長くなった原因を先に測ること。** 指示書 §6-2 は「8 値化で横幅がどれだけ増えたか」を実査項目に挙げていたが、**答えは 0 だった**——最長ラベル（20 文字）は `M18-01`（4 値時点）から在り、**`M27-01` が増やしたのは選択肢の数であって幅ではない**。**⇒ 直前のサブを原因と見なす前に、その値がいつから在るかを確かめる。**
    3. **★★native `<select>` では「閉じたら短縮・開いたらフル」を作れない**（HTML の仕様上、閉じた表示＝選択中 `<option>` のテキストそのもの）。**⇒ 開発者の逐語が「プルダウンメニュー内では」と言っていても、その形は素の `<select>` の外にある。** 一覧のフィルタ 7 本のうちヒット種別だけが `SearchableSelect` になった。**意図的な非対称であり、他の軸も長くなったら同じ形へ寄せる判断が要る。**
    4. **★★「消えたこと」を行ぜんぶで見ると空振りする。** 一覧から始動技の表示を消したが、**レシピ列に技名が出ている**ため行の文字列は常に一致した（E2E が赤で教えた）。**★それは本件の前提そのものである**——開発者の逐語＝「レシピが綺麗に表示されているので、始動技を始動状況欄に出す必要はなくなった」。**⇒ 欄へ `data-testid` を置いて欄で見る形へ直した。** **同型を単体テストでも踏んだ**（着地先を `getByText("コンボ一覧")` で見たが、**ヘッダのナビにも同じ文言が在り常に一致した**）。**⇒ 一般形＝「画面に出ている文言」で有無や着地先を判定しない。**
    5. **★`drive_damage` が負の行の実測件数は確かめられなかった。** 本環境に DB ファイルが 1 つも無い（`find / -xdev -name '*.db'` が 0 件・`config.toml` 未作成＝アプリ未起動）。seed にも `INSERT INTO combos` は 0 件。**⇒ 開発者の実機で `SELECT COUNT(*) FROM combos WHERE drive_damage < 0;` の 1 クエリ。★件数が 0 でも本サブの判断は変わらない**（見せ方の変更であり負値の有無に依存しない）。
    6. **★`drive_damage` の意味は設計書側には既に書いてあった**（`DES-003:418`「回復で負値」／ `DES-005:622`「負値=回復」）。**⇒ 設計書が欠けていたのではなく、その情報が画面に 1 文字も出ていなかっただけである。** 指示書 §2.4-3 の「`DES-003` にも書く」は**追記不要**と判断した（設計卓の確認を仰ぐ）。
    7. **★`DES-005` §5.4:310 の「始動状況＝始動技 + カウンター種別 + ポジション」が失効した。★列名は「始動状況」のまま変えていないため、定義文だけが実装とずれた状態にある。** CHANGE で直す先は完了報告 §5。
    8. **★★「レビュー前に書けない欄」を差し戻したら、差し戻した先も直すこと。** `D-510` を避けて progress-log の索引行を意図的に差し戻したが、**完了報告の「追記した」「検査は緑」の 3 か所を追随させなかった**（レビュー 高-1 が検出）。**⇒ 片方だけ直すと、報告が「やった」と言い検査が赤を返す状態になる。** `D-510` の教訓は「書く時点を選ぶ」だけでなく「**選んだ時点に全部を揃える**」まで含む。

### M27-03 追補: 開発者の実機確認で出た 3 件（2026-09-05）

- **結果**: `go test ./...` / `pnpm test`（**2421 件**）/ `tsc` / `make e2e`（**247 件・E2E は 6 → 8 ケース**）すべて緑。常設検査も緑。**★★マイグレ 1 本消費＝`000103`**（ドライブダメージの符号反転。**着手時は「消費なし」だった**）。**⇒ 次に払い出す番号は `000104`。** CHANGE の反映先が `DES-005` に加えて **`DES-002` §4.2 ／ `DES-003`** へ増えた。**3 件目（3 列化）は独立した最後のコミット**にしてある（違和感が出たらそれだけ戻せる）。
- **報告**: 完了報告 `docs/progress/M27-03-completion-report.md` §11 ／ レビュー `docs/progress/m27-03-review.md`。
- **★横断課題**:
    1. **★★「表示だけ」の依頼が、データ移行を伴う変更だった。** 「マイナスの方を削り、プラスの方を回復に」は画面の語の話に見えるが、**既存の行は設計書の規則（正 = 削り）で入力されている**。⇒ 語だけ入れ替えると**既存値の実世界の意味が黙って反転する**。**★「値の意味を変える依頼」と「表示を変える依頼」を、依頼の文面だけで見分けないこと。その値が既に入っているかを先に問う。**
    2. **★★履歴を触る直しは、既存の契約テストを先に読むこと。** 「保存後に編集画面を履歴へ残さない」を `history.go` で実装したところ、**`M24-12 (3)` が契約として押さえている「戻る 1 回で編集画面、2 回目でその前へ抜ける」を壊して赤になった**。番人が react-router の `idx` を**複製して**積むため、`go` を挟むとルータの位置の勘定が狂う（差分が 0 になり更新されない）。**⇒ 履歴の形を 1 枚も変えず、`location.state` の目印で解いた。**
    3. **★★「真っ白」は再現しなかった。** 行き先の誤り（戻る先が `/combos/:id/edit`）は E2E で再現したが、**真っ白そのものは headless Chromium では起きず、エディタは正常に描画された**。⇒ **直したのは行き先である。機序は未特定のまま残る。** 開発者の環境で再発したら、手順と画面の状態を添えて再度報告してもらう。
    4. **★`M24-12 (3)` は単独実行すると `HEAD` でも落ちる**（全数では通る）。**作業ツリーを `HEAD` へ戻して確認した。⇒ 本サブとは無関係の順序依存**であり、既存の脆さとして残る。
    5. **★★保存済みの UI 設定とキーの入れ替えは噛み合わない。** `ColumnVisibility` のキーを差し替えたとき、`useColumnVisibility` の `{ ...DEFAULT, ...loaded }` マージで**古いキーが余分なプロパティとして残り、`Object.values(...)` で数えていた `colSpan` を 1 列ぶん水増しする**状態になっていた。⇒ **型に在る列（`COLUMN_DEFINITIONS`）から数える形**へ改めて構造的に断った。**★キーのバージョンは上げていない**（上げると利用者の列設定が失われる）。
    6. **★列にしたら「不問」も出す。** 相手の状態は着手前まで「不問・未設定は非表示」だったが、**独立列になると空欄が「値が無い」のか「未取得」なのか区別できない**（セットプレイ数の「0 件も 0 と出す」と同じ作法）。**⇒ `DES-005` §5.4 の当該規定が失効する。**
### M28-01: 正式名リネーム（`combomgr` → `Tacpendium`）（2026-09-05）

- **結果**: `go test ./...` / `pnpm test`（2373 件）/ `make e2e`（**239 passed**）緑。**マイグレ消費 0 本 ／ CHANGE 消費 0 本**。module path を `github.com/plexiblinp/tacpendium` へ、`cmd/combomgr/` → `cmd/tacpendium/`、env 4 本を `TACPENDIUM_*`、Cookie を `tacpendium_session` へ。**既定データディレクトリの自動移行**（`internal/infra/datadir`）と**移行の告知**（`GET /api/notices/data-migration`）を新設。母数は **2852 → 1927（−925）**、**歴史記録 1150 件は 0 差分**。
- **報告**: 完了報告 `docs/progress/M28-01-completion-report.md` ／ レビュー `docs/progress/m28-01-review.md`
- **レビュー**: 重大 0 件 ／ 高 6 件（**全件採用・不採用 0 件**）／ 中 9 件（8 採用・1 一部採用）／ 低 7 件（2 採用・5 不採用）。**再レビュー往復 0 回**（§J への停止時記録は不要）
- **★横断課題**:
    1. **★★`docs/design/` に 35 箇所（他プロジェクト参照 2 件を除く）が旧名のまま残る。CHANGE 1 本が要る（設計卓の手番。★製造は自採番していない＝`D-293`）。** とくに **`02-architecture.md:71`「本書内の `combomgr.exe` / `combomgr` は仮称である。プロジェクト名は完成時に確定させる」という注記そのものが失効した**。ここを直さないと後任が「名前はまだ仮」を前提として複製する。ほかに**リリースアーカイブ構成（`:1197`〜`1202`）／ Cookie 名（`:703`）／ 環境変数 4 本（`supp-001` `:1094` `:1160`〜`1162`）**が実装と食い違っている。**★`02-architecture.md:882` `:918` の `combomgr-importer` は別リポジトリの名前であり置換してはならない。**
    2. **★★指示書 §2.3-4「`config.toml` も移す」は、移す対象が存在しなかった。** `config.toml` はアプリ実行ディレクトリ直下であり（`defaultConfigPath = "config.toml"`）データディレクトリの中に無い。**⇒ 実際にやることは「中の絶対パスの書き換え」だけだった**（`config.RewriteRelocatedPaths` で実装）。**指示書の記述と実装の食い違いであり、設計卓の確認を求める。**
    3. **★★指示書 §2.3-2「何も動かさずに止まり、利用者へ理由を出す」を「止めるのは移行であってアプリではない」と読んだ。** 検証に失敗しても**旧データディレクトリで起動し、赤いバナーで理由を出す**。旧は構成上無傷であり「起動できない」より安全であること、および**「利用者へ理由を出す」には画面が要ること**が根拠。**★起動を止めるのは「別プロセスが移行中」の 1 件だけ**（2 系統から旧を書くと片方の書き込みが見えなくなるため）。**製造の解釈であり、設計卓が別の読みを採るなら実装を変える。**
    4. **★★母数の初回提出で綴りを 1 つ数え落とした**——`combmgr`（`o` が無い綴り。329 件）。区分表は正規表現 `comb[o]?[-_ ]?mgr` で数え、綴り内訳は綴りを列挙していたため、**両者が別の集合を数えていた**。**指示書 §2.1-3「1 つの綴りだけを数えない」に正面から失敗した。**設計卓の母数レビューで発覚。**⇒ 以後は「全綴りを 1 本のパターンで拾い、パスで排他的に振り分け、未分類を表に出す」形で数える**（残差 0 が網羅性の証拠になる）。
    5. **★★`go build` も `go test` も `pnpm test` も `tsc` も緑のまま、E2E だけが取りこぼしを捕まえた。** `web/playwright.config.ts:136` の `go run ./cmd/combomgr` を直しておらず、1 回目の `make e2e` が webServer 起動失敗で全滅した。**TypeScript の文字列リテラルの中に在るパスは型検査の対象ではない。⇒ ディレクトリを動かす変更では、E2E を通すまで緑を信用しない。**
    6. **★`check-import-order.sh` は着手基点から NG（102 / 101）／ `check-md-emphasis.sh` は 431 / 436 へドリフト済み。どちらも本サブ由来ではない**（違反 102 ファイルは全件未変更。変更した `.md` 8 本は着手前と同数であることを個別に実測）。**⇒ ベースラインは動かさなかった。**本サブの成果でない改善を本サブの手番で床にすると、実際に減らした変更の記録が失われるため。**開発者・設計卓の手番へ回す。**
    7. **★開発者の手番が 8 件残っている**（完了報告 §8）。**とくに devContainer のリビルドが要る**——volume の `target` が `.../share/tacpendium` へ動いた（**`source` は変えていないので、リビルドすれば既存 dev データはそのまま新パスに現れる**）。**★リビルド前にアプリを起動すると、移行先が volume の外になり永続化されない。** ほかに `.agents/skills/combomgr-manufacturing-workflow/` の改名（`sync_codex_config` の管轄。`AGENTS.md:11` と `human-notes/codex/README.md` の 4 か所を原子的に動かす必要がある）／ `.claude/` 配下 45 箇所（**うち `implement_plan_wt` 等 5 本の `/workspaces/combomgr` は worktree ガードが `pwd` と突き合わせる実パス**）／ `docs/human-notes/` 388 箇所。
    9. **★★レビューが実バグを 2 件出した。どちらも「テストが無い領域」から出ている。** (a) `prepareDataDir` が **config の書き換えが空振りしても旧を退避していた**——移行の判定 `UsesLegacyDefault` は `EvalSymlinks` で正規化するが書き換え側の `withinRoot` は純粋な字句一致であり、両者が食い違う綴りだと「移行はする／config は書き換わらない／旧は退避される」が成立し、**次の起動で SQLite が消えた旧パスへ空の DB を作る**。`RetireOld` の注記自身が警告していた経路である。⇒ `datadir.ReadyToRetire` で「開く先が実在するか」を見る形に是正（綴りの網羅は狙わない）。(b) `setQueryData(key, undefined)` は TanStack Query では **no-op** であり、**バナーを閉じても消えなかった**。⇒ `onMutate` で `acknowledged` を立てる形に是正。**★`datadir` の 683 行のテストは `prepareDataDir` を 1 度も通っておらず、フロントは全層で未実行だった。行数ではなく「どの関数を通るか」でテストの空白を見ること。**
    10. **★「1 バイトも動かさない」と書いたが、literal には成立していなかった**（レビュー 高-5）。検証より前に 2 つの書き込みが起きる——ロックファイルの作成と、`wal_checkpoint(TRUNCATE)` の**移行元 DB への書き戻し**。破壊ではないが記述が実装より強かった。**⇒ 不変条件を「検証が通るまで中身は失われない」へ改め、テストも書き分けた**（WAL が無い経路は sha256、残っている経路は行数＝新設した (d3)）。**★(d1)/(d2) は WAL が残る経路を 1 度も通っていなかった。**
    11. **★設計卓へ 4 件回した**（レビュー報告末尾）——(1) `docs/audits/<日付>-*.md` を歴史記録として扱うかの線引き（本サブは根拠パスの追随のため 3 行書き換えた）(2) `query-keys.convention.test.ts` が「定数へ逃がした形」を検出できない穴 (3) `internal/api/comboio/handler.go:62` と `web/src/components/Header.tsx:68` の直書き (4) `CLAUDE.md` §3 のリポジトリルート表記。
    12. **★★【2026-09-05 承認】設計卓へ回した解釈 2 件が両方とも承認され、②に条件が 3 つ付いた。** ①（`config.toml` は移す対象が無い）＝**設計上そこには置かれない**ことを 3 つの出所で示した〔`SUPP-001` §5.8「配置場所: アプリ実行ディレクトリ直下」／ `README.txt:20` ／ **`README.txt:117-118` が DB の置き場と `config.toml` の置き場を対比している**〕。②（止めるのは移行であってアプリではない）＝承認。条件 **(a)** 失敗時に掴むのは旧 **(b)** 失敗時は毎回出す **(c)** 失敗後の残骸を経路 b が正本にしない。**⇒ 追補で対応した**（完了報告 §7-1 / §7-2）。
    13. **★★条件 (c) は前提が成立しなかった。** 「検証に失敗して止まった後、新ディレクトリは残る」を前提にしていたが、**通常の検証失敗では新ディレクトリは作られない**——`populateStaging` の失敗は `committed = false` のまま `defer` が作業ディレクトリを消し、**`newDir` を作る唯一の場所である `commitStaging` に到達しない**。残骸が出るのは `commitStaging` の途中失敗だけで、そこでも **DB を最後に置く**ので `Decide` は正本にしない。**⇒ マーカー機構は作らず、失敗の出口で残骸を実測して `Result` に載せた**（`observeRemnant`）。**「残っていない」を主張ではなく観測にする**ためであり、将来 `commitStaging` を先に呼ぶ形へ変えたら報告とテストから見える。
    14. **★★条件の外で穴を 1 つ見つけて塞いだ**——**`config.toml` の `database.path` に新既定のパスを明示すると、移行も告知も起きなかった。** `prepareDataDir` が `Decide` に到達する前に `ReasonExplicitDBPath` で抜け、`NoticeFor` はその理由を告知の対象にしていないため、**`db.Open` がそこへ空の DB を作り、旧のデータが黙って取り残される。★`README.txt` は既定パスを OS 別に印字しており、書き写す利用者は現実にいて、移行が要るのはまさにその人である。** ⇒ 飛ばすのは「明示先が旧既定でも新既定でもない」ときだけにした。**★リネーム固有ではなく「移行を飛ばす判定が、データの所在を見る前に走る」形の問題である。ただし `tacpendium` v1 → v2 では再発しない**（スキーマ変更は `golang-migrate` の担当でディレクトリを動かさない。`datadir` は 1 回きり専用で旧名を直書きしている）。
    15. **★経路 b（新旧の両方が在る）を中身で分けた。** 経路 b は 3 通りを 1 つにまとめており、`Decide` は `os.Stat` のサイズしか見ないので区別できない〔退避の失敗 ／ 確定と退避の間で落ちた ／ **★移行前に新の場所へ空 DB が作られた**〕。⇒ 経路 b のときだけ両方の行数を数え（`CheckStranded`）、**「新が空で旧にデータが在る」だけを毎起動・赤**にした。良性形は 1 度だけ（**旧を消すのは開発者の手番であり、先送りしている作業を毎起動で催促しない**）。**★`schema_migrations` は行数に入れない**——入れると版が 1 行書かれた時点で「空ではない」ことになり判定が永久に効かなくなる。**★この形が効く現実的な場面は devContainer をリビルドせずに起動した場合である。**
    16. **★★射程は「利用者は開発者だけ」の前提で決めた**（開発者判断・2026-09-05）。**⇒ 条件 (c) のマーカー機構は作らなかった**（前提が成立せず「起こらないことへの備え」になるため）。入れたのは §4 の入口・(b) のルール・(a) のテスト・取り残し検知の 4 つで、いずれも**壊すと赤くなることを実測**した。
    17. **★★【2026-09-05 追補 2】開発者の明示指示で、残していた手番 3 件を製造が実施した**（完了報告 §8.1）。**指示書 §4-4「`.claude/` の編集」の禁止を明示指示で上書きした。** (1) skill 識別子 `combomgr-` → `tacpendium-manufacturing-workflow`（**★報告は「4 か所」と書いたが実測 11 か所**。`agents/openai.yaml` ／ `sync_codex_config.md:31` ／ README が 5 行だったことを漏らしていた）(2) `.claude/commands/*_wt.md` 5 本 (3) `docs/human-notes/` 本文 177 箇所。
    18. **★★worktree ガードについての記述が誤っていた。** 完了報告と本ログに「**`pwd` と突き合わせる実パス**」と書いたが、**実際の判定は「パスに `/wt-` セグメントを含む」**であり、`/workspaces/combomgr` は**「例」と明記された例示**にすぎない。ガードを実装したスクリプトもフックも存在せず（`.claude/hooks/*.sh` と `settings.json` に `/workspaces` は 0 件）、`scripts/wt-*.sh` は 3 本とも `git rev-parse --show-toplevel` で親を解決する**完全にパス非依存**。**⇒ どちらの向きでも機能は壊れない。** 単純な改名はせず、`cmds` エイリアスと同じ**チェックアウト名に依存しない形**へ直した。
    19. **★★`docs/human-notes/` はファイル名 52 件を据え置いた。作業を省いたのではない。** 被参照を全数調べたところ**歴史記録から約 86 行が参照しており**（`docs/progress/M25-RESEARCH-01-report.md` の 1 ファイルだけで **42 行**）、**歴史記録は編集できないので参照切れを直せない**。**★さらに悪いのは、どの機械検査も捕まえないことである**——`check-doc-refs.sh` の走査範囲は `CLAUDE.md` / `.claude/rules/` / `.claude/commands/` だけで、抽出はリポジトリ相対のフルパスのみ。参照はほぼ裸のファイル名なので **1 件も検出されない**。`check-doc-inventory.sh` は `docs/human-notes/` を走査しない。**⇒ 約 86 行が黙って壊れ、誰も気づかない。** **★`archive/` を除いて 44 件だけ改名しても解決しない**（`future-notes/archive/` の 2 ファイルが非 archive のファイル名を引用しているため）。
    20. **★★完了報告 §2 の数字に、さらに 2 件の誤りがあった**（追補 2 で実測・訂正）。`docs/human-notes/`（archive 除く）を 57/350、`docs/process/`（ボード・archive 除く）を 10/25 と書いていたが、実測は **66/388** と **5/21**。**中-6 の是正で「全行を再実測した」と書いたのに、実際には歴史記録の内訳だけを数え直し、その下の行は元の値を引き写していた。⇒ 同じ種類の誤りを、是正の手番で作り込んでいた。**
    21. **★本サブの変更が原因で古くなっていた記述を 1 件直した**——`scripts/wt-new.sh` を `tacpendium-dev.db` に変えたのに `docs/human-notes/worktree-scripts-guide.md:26,59` が `combomgr-dev.db` のままだった。**レビューも見落としていた。**
    22. **★`docs-map.md` の再生成差分（+29/−22）は本追補由来ではない**——`human-notes` を含む行は差分に 1 行も現れず、中身は `b7d150d` 以降に溜まった着手前からのドリフト。**`git restore` は禁止操作のため戻せなかったので、別コミットに分けて混入が履歴から見えるようにした。**
    23. **★Codex 側の実機確認はできていない**（本セッションに Codex が無い）。「改名後に Codex が skill を読めるか」は開発者の手番として残る。`sync_codex_config` も走らせていない。
    24. **★★【2026-09-06】実データでの移行を実走行し、§7-3 の「実機未検証」を消化した。同時に、完了報告と `devcontainer.json` に書いた devContainer の説明が誤解を招くものだったと判明した。** 初版は「`source` は変えていないので、リビルドすれば既存 dev データはそのまま新パスに現れる」と書いたが、**ファイルは現れてもアプリは開かない**——**DB のファイル名も `combomgr.db` → `tacpendium.db` へ変わっている**ため、新パスに `tacpendium.db` が無く**空の DB が作られる**。しかも `Decide` の入口は旧**ディレクトリ**の有無であり、リビルド後の旧パスはマウント点でなくなって存在しないので `ReasonNoLegacyDir` で skip、`CheckStranded` は経路 b でしか数えず、`NoticeFor` も対象外。**⇒ 3 段とも空振りし、無言で空のアプリが立ち上がる。本サブが繰り返し潰してきた「緑のまま壊れる」型そのものを、自分の説明文で作っていた。** 実際の復旧は同一ディレクトリ内での改名 1 回で済んだ。**★検証の実測**（完了報告 §7-4）: `copied_files=12`（DB 1 ＋ `-bak` 8 ＋ `backups/` 3。`-wal`/`-shm` は skip 集合）／ 退避側は **mtime も全件保存**され `combomgr.db-wal`/`-shm` だけが消えている（checkpoint → close の証拠）／ 実 HTTP の往復（`GET` 200 → `POST /ack` 204 → `GET` **204** → ファイルの `acknowledged` が true）が通った。**★DB が 1,126,400 → 1,679,360 と増えるのは正常**——`Verify` は複製直後に通っており、増えたのはその後 `migration.Run` が `from_version=80` → `102` の 22 本（大半が行を挿入するシード）を適用したためである。**★新たに分かった 3 件**（害は無い・設計卓へ回す候補）: (a) `copy.go:51-52` が `os.MkdirAll(target, 0o755)` 固定で**ディレクトリのパーミッションを保存しない**（`backups/` が 700 → 755 に緩む。ファイル側は保存される）(b) staging を `os.MkdirTemp` で作るため**移行してきた環境だけ新データディレクトリが 700**（新規インストールは 755）(c) `Notice.AcknowledgedAt` の `omitempty` は `time.Time` に効かず常に `0001-01-01T00:00:00Z` が書かれる。
    8. **★リポジトリ名は変えていない。** 開発者の方針（2026-09-05）＝**開発リポジトリ `plexiblinp/combomgr` はプライベートで存続し、公開用 `plexiblinp/tacpendium` を新設して一方向同期**。module path はローカル解決なのでビルドに影響しない。**★ミラー運用で 1 か所実際に壊れる箇所があったため直した**——`.devcontainer/Dockerfile` の `cmds` エイリアスが `/workspaces/combomgr` を直書きしており、**チェックアウト名の違うミラー先で必ず外れる**。実行時に `/workspaces/*/scripts/list-commands.sh` を選ぶ形へ。**`.claude/commands/*_wt.md` の同種 5 本は製造の射程外なので残っている**（上記 7）。

### M28-02a: `FR702` 追従のスキーマとバックエンド ＋ 始動位置・運び量（2026-09-06）

- **結果**: `go test ./...` / `pnpm test`（**2440 件**）/ `tsc` / `make e2e`（**247 件・新規 0 件＝画面が無いため**）すべて緑。常設検査は `check-artifact-integrity.sh` を 1 本目に回して全件緑。**マイグレ消費 2 本＝`000104`（`FR702` のマーカー列・基準列・現在のデータバージョン）/ `000105`（始動位置マス数・運び量）**。**⇒ 次に払い出す番号は `000106`**。**CHANGE 消費 0 本**（起票は設計卓。請求内容は完了報告 §6 に 9 件）。**開発者判断 4 件を得てから実装**（マイグレ 2 本 ／ 初期版数 `2026.08.03.01` ／ 運び量の値域 0〜160 ／ 一覧フィルタの語を揃える）。**レビュー指摘 13 件（重大 0 / 高 4 / 中 3 / 低 6）を取り込み、★「高」の不採用は 0 件**（不採用は 低 3 件のみ）。**中 2 件は `M28-02b`・設計卓へ繰り越し。再レビュー往復 0 回。**
- **報告**: 完了報告 `docs/progress/M28-02a-completion-report.md` ／ レビュー `docs/progress/m28-02a-review.md`。着手基点は `56b06cb`。
- **★横断課題**:
    1. **★★`seedgen` の生成物に「CSV から来る新しい列」を足すときは、golden との衝突を先に測ること。** 本サブは初版で **`moves` の seed 波の出力へマーカーの `UPDATE` を混ぜた**。値が空の間は生成物が byte-identical なので **17 本の golden は緑のまま**通ったが、**CSV へ値を 1 つ書いた瞬間に `000026` が落ちる**。しかも失敗メッセージは「**適用済みマイグレを再生成してはならない**」であり**直し方が無い**。⇒ **`-mode game-version` の独立した成果物へ移した**（`derived-backfill` / `move-commands` と同じ流儀）。
        - **★★この壁に本プロジェクトは既に一度当たっている**——`zangief` / `dhalsim` の連打版を `character_data` に載せていないのは「載せると生成物が変わって golden が壊れる」ためである（`csv_db_sync_test.go` 冒頭・`D-94` / `D-99`）。**先例は在ったのに、初版の設計はそれと正面衝突していた。**
        - **★★一般形＝「機能を無効にした状態で緑」は「機能が動く」の証明にならない。** 初版の完了報告は「golden 17 本は緑のまま」と書けてしまったが、それは**値が 1 つも無い状態しか試していなかった**からである。**⇒ 新しい列・新しい経路のテストは、値が在る状態で書くこと。**
    2. **★★`games.current_data_version` とマーカーは同じ手番で上げないと、静かに壊れる。** マーカーだけ立てて現在版を据え置くと、**以後に登録されるコンボの基準がマーカーより古くなり、登録した瞬間に「影響可能性あり」で出る**。⇒ `-mode game-version` の生成物に版の引き上げ（`current_data_version < ?` 条件付き＝引き下げない）を含めた。**★テストが固定値の版数を書くと、この引き上げで前提が崩れる**（実測: マイグレを 1 本足しただけで `TestAcknowledgeGameVersion` が落ちた）。**⇒ 版数に依存するテストは「現在版より確実に新しい値」を使うこと。**
    3. **★本スキーマ初の `CHECK` 制約を入れた。** `DES-003` §3.4 ／ `internal/model/combo.go:6` の「CHECK は DB 側に付けずアプリ層で制約する」方針に対する**意図的な例外**であり、指示書 §2.2-3-b が名指しで要求している。**★例外にした理由＝アプリ層だけでは生 SQL の `UPDATE` を塞げない**——マーカーを立てるのは配信者であり、その経路は DML マイグレ ＝ 生 SQL である。**⇒ 方針の例外として `DES-003` へ反映が要る**（完了報告 §6-2）。**★`ALTER TABLE ... DROP COLUMN` は CHECK 付き列に対しても通る**（`modernc.org/sqlite v1.50.0` で実測。テーブル再構築は不要だった）。
    4. **★★`VAL-Cxx` を自採番せず記述的コード `VAL-RANGE` を使った**（マス数の値域検証。validation 層と csvcore の両方）。先例＝`VAL-ENUM`（`DES-006` に番号を持たない CSV 層のコード）。**⇒ 番号付きの検証コードが要るかは設計卓の手番**（完了報告 §6-3）。
    5. **★「守るべきものはあるが観測が無い」の 5 例目を潰した。** `csvcore.DefaultPositions` は着手前 **4 値**で `corner_self_near` を欠いており（本体は 5 値）、その値のコンボを CSV で往復させると `VAL-ENUM` 警告が出る状態だった。**`hit_type` と `opponent_size` には同期テストが在り、`position` だけ無かった。** ⇒ `TestDefaultPositionsMatchesModel` を新設して 7 値へ揃えた。
    6. **★`web/src/features/combo/labels.ts` の `POSITION_LABEL_JA` だけが `ja.json` 由来でない直書き**であり、`label-keys.test.ts` の網の外に在った（`HIT_TYPE_LABEL_JA` / `OPPONENT_SIZE_LABEL_JA` は守られていた）。⇒ 同テストへ登録し、`POSITION_OPTIONS` も `POSITION_VALUES` から導出する形にした（着手前は並び順が一覧フィルタとエディタで別々に定義されていた）。
    7. **★★繰り越し 2 件（設計卓・`M28-02b` の手番）。** (a) **基準を PATCH でも進めるべきか**——現状「登録・更新時に最新を書く」は `PUT`（キー変更＝新規 INSERT）でしか成立しておらず、「メモを直しても影響可能性は残る／区分を直すと黙って消える」という非対称になっている。**`FR307`（自動断定しない）から見ると PATCH 側が正しく、`PUT` 側が `M28-overview` §3.2.6 が案 (e) を落とした理由に近い。** (b) **`comboio` の事前重複チェックがマス数を知らない**——`CheckDuplicateInput` にマス数の欄が無く、手編集 CSV で `position` とマス数を食い違わせると事前チェックと保存後で区分が別になる。**`M28-02b` が 3 方式入力を出すとリアルタイム重複警告でも同じずれが起きる。**
    8. **★「画面中央」の意味が狭くなることを受容した。** 区分が 5 → 7 になり旧「画面中央」の一部は新区分（`mid_self` / `mid_opponent`）に当たるが、**どれがそうかを判別する記録が無く直せない**。既存行は一律 `80`（代表値）になり、利用者が後から実測値へ直せる。
    9. **★並び順の変更は「間に 2 つ挿入するだけ」ではなかった**——**末尾 2 値の順序も入れ替わっている**（旧 `corner_opponent, corner_opponent_near` → 新 `corner_opponent_near, corner_opponent`）。指示書 §2.4.6-1 の「間に 2 つ挿入されるだけ」は**値域の話であって表示順の話ではない**。⇒ 2 つを混同しないこと。
    10. **★比較画面には直すべき「ポジション」という文字列が存在しなかった**——`CompareTable` は position を軸名なしのタグで出しており、行見出しは「状況」である。指示書 §2.4.7-1-b は「詳細・比較・エディタ」を対象としているが、**比較には対象が無い**。⇒ 画面の作りを変えない方針のためラベルを新設していない。
### M28-03: ツールチェーンと依存の版上げ（2026-09-06）

- **結果**: `go test ./...` / `pnpm test`（**211 ファイル・2429 件**）/ `make build-all`（**windows-amd64 / darwin-arm64 / linux-amd64 の 3 つとも**）/ `make e2e`（**247 passed**）緑。**マイグレ消費 0 本 ／ CHANGE 消費 0 本**。Go ツールチェーンを `go1.26.4` → **`go1.26.8`**（**★`go.mod` の `go` ディレクティブは動かさず `toolchain` 行を追加**——workflows 4 か所がすべて `go-version-file: go.mod` であり、go.mod を触らないと CI が動かないため）。Go 依存 11 本（direct 3 / indirect 8）とフロント依存 26 本を patch/minor で更新。**新規依存 0 ／ `indirect → direct` 昇格 0 ／ メジャー版上げ 0。** コミットは指示書 §2.7 の 5 段に分割。
- **報告**: 完了報告 `docs/progress/M28-03-completion-report.md` ／ レビュー `docs/progress/m28-03-review.md` ／ 設計伝達 `docs/handover/design-reports/20260906-m28-03-design-exceptions.md` ／ PR [plexiblinp/combomgr#157](https://github.com/plexiblinp/combomgr/pull/157)
- **レビュー**: 重大 0 件 ／ 高 3 件（**全件採用・不採用 0 件**）／ 中 6 件（全件採用）／ 低 3 件（2 採用・1 不採用＝`L-1` はコミット粒度の指摘で、レビュー自身が「違反ではない」とし、かつ push 済み履歴の分割は禁止操作のため）。**再レビュー往復 0 回**（§J への停止時記録は不要）
- **★横断課題**:
    1. **★★`web/package.json` の `pnpm.overrides` に `"nwsapi@>=2.2.26 <2.3.0": "2.2.25"` を入れた。撤去条件はここにしか無い**（JSON にコメントを書けないため）。**上流が `nwsapi 2.2.26` の性能回帰を直したら外すこと。** 経緯＝`pnpm update` をそのまま入れると Vitest が 59 件落ちた（すべて `Test timed out in 5000ms`）。二分探索で**直接依存 26 本はすべて無罪、犯人は jsdom のセレクタエンジン `nwsapi` で 2.2.26 が回帰の入り口**と判明（2.2.25 で 2.87s / 2.2.26 で 43s / 全適用時 721s）。**★「正しさの修正に伴う低速化」ではなく純粋な性能回帰である**——2.2.26 のまま `--testTimeout=180000` で回すと **19 件すべて passed（719.98s）**で assertion は 1 件も落ちない（上流 changelog は egress ブロックで引けず、実測で弁別した）。**★形は自己解除する条件付きにしてある**（jsdom が `^2.3` を要求する版へ上がれば黙って無害化する）。**★`nwsapi` の消費者は `jsdom`（devDep）1 本だけで本番バンドルには入らない。** **★開発者の追認を得るまで暫定**（`CLAUDE.md` §6 の文言には当たらないが、§6 の根拠＝「以後の更新・撤去の判断が本体の責任になる」は exact pin にも当てはまる）。
    2. **★★上げた Go 依存 11 本は「壊れなかった」ことしか検証できていない。** レビューの破壊確認で、**`go.mod` / `go.sum` を着手基点へ丸ごと戻しても `go build` も `go test` も緑のまま**であることが実測された。とくに **Echo v4.15.4 のセキュリティ修正（"Static encoded-separator route bypass" / GHSA-vfp3-v2gw-7wfq）に対応する回帰テストは 0 件**である。本アプリは embed した `web/dist` を Echo の静的配信で返すため、**この修正は直接効く面に当たる**。⇒ 「`make build-all` が緑」は「上げた効果がある」の証拠ではない。
    3. **★★版数の同期を守る機械検査は存在しない。** レビューが `CLAUDE.md:39` の版数だけを改変する破壊確認を行い、**常設検査 10 本のうち版数について何か言った検査は 0 本**だった。実際、着手時は Go の版数が **4 種類**に割れていた〔`go.mod` 1.26.4 ／ devContainer の**実効値** 1.26.2 ／ `README.md`・`DES-001` 1.22 ／ `remote-ops` 1.26.x〕。**★とくに `devcontainer.json:11` が `Dockerfile:12` を上書きしていたため、devContainer の Go は go.mod の要求を満たしていなかった**（`GOTOOLCHAIN=auto` の自動取得で隠れていた）。**★`.devcontainer/verify-env.sh:63-72` は版数の期待値を持たず `go version` を表示するだけなので、この種の食い違いを検出しない。**
    4. **★`docs/design/01-tech-stack.md:120`（`DES-001`）の「Go 1.22+」が実装と食い違う。CHANGE 1 本が要る（設計卓の手番。★製造は自採番していない＝`D-293`）。** **★これは意図的な下限表記ではなく更新漏れである**——`go.mod` が 1.26.4 を要求している以上 Go 1.22 ではビルドできない（指示書 §6-4 への回答）。あわせて `.claude/commands/research_plan.md:16` の `Go 1.26.2+` と、**`.claude/hooks/session-start.sh:119` のコメント内実測値（`go1.26.4`）が本サブで失効した**件は**開発者の手番**（`.claude/` は製造の編集対象外＝指示書 §4-7）。**★将来 `pnpm.overrides` へ足すときは、固定だけを単独 revert できる粒度でコミットすること**（レビュー `L-1`。本サブでは同じ段に含めた）。
    5. **★★【2026-09-06 解消】`govulncheck` は開発者の devContainer で実行され、Go 側 CVE 検査は達成された。** 実測（完了報告 §4.2 追補に原文）＝ **`OK: 既知脆弱性なし`**。**自コードが呼んでいる脆弱性 0 件 ／ import しているパッケージ 0 件 ／ `require` にのみ在るもの 1 件（呼んでいない）。** 前提も実測済み（`go version` → `go1.26.8` ／ `go env GOVERSION` → `go1.26.8`）。**★総合判定が `CAUTION` のままである理由は `govulncheck` の SKIP から `pnpm audit` の `moderate=2`（react-router＝下記 6）だけへ移った。** **★★【2026-09-06 追補】残件も解消した。`require` にのみ在る 1 件は `GO-2026-5932`（`golang.org/x/crypto/openpgp` は非推奨・unsafe by design）である。⇒ 本サブに残る検証上の未達は 0 件。** **★★これは「まだ直っていない脆弱性」ではなく「消えない指摘」であり、追いかけないこと。** 実査 4 点＝ **(1) `Fixed in: N/A`**（非推奨パッケージであり修正版という概念が無い。**どの版へ上げても消えない**） **(2) 本アプリは `openpgp` を使っていない**（`grep -rn 'openpgp' --include=*.go .` が 0 件） **(3) `x/crypto` は `echo/v4` → `golang.org/x/crypto/acme` 経由の indirect**（`go mod why -m`。**Echo を使う限り依存グラフから外せない**） **(4) 着手基点にも `golang.org/x/crypto v0.46.0 // indirect` が在った**（`git show 56b06cb:go.mod`。**本サブが持ち込んだものではない**）。**★次に `govulncheck` を回す担当は必ずこの 1 件を見る。記録が無いと「上げ残しがある」と誤読して追いかけ、上げても消えないので時間を溶かす**——`check-artifact-integrity.sh` §4.1 の「成功表示は証拠ではない」の裏返しで、**赤に見える表示が欠陥とは限らない。**以下は当時の記述（経緯として残す）: **⇒ 「Go の版と依存を上げるサブ」でありながら「既知 CVE が残っていないか」の確認だけができていない。** 到達できないのは**本クラウド実行環境だけ**（組織の egress ポリシーで 403。リポジトリ側からは動かせない）。**★★【2026-09-06 訂正】本項の初版は「devContainer も `init-firewall.sh:31-47` の許可リストに未登録で到達できない／足すかは開発者判断」と書いたが、これは事実誤認だった。`vuln.go.dev` は `init-firewall.sh:34` に、`go.dev` は `:35` に在り、入ったのは 2026-08-26（`62b0240`）で本サブより前である。⇒ 許可リストの追加も、それを足すかの判断も要らない。** **★★誤りの出所はレビュー指摘 `M-6` の根拠（`m28-03-review.md:211`）を製造が実測せずに写したことである**——同じレビューの `M-1` は独立に再実測したのに `M-6` だけ検証を省いた。**⇒ レビューの指摘は「直す対象」であって「検証済みの事実」ではない。取り込む前に根拠そのものを実測すること。** **★同じ誤りが本ファイル `:3179`（過去サブの節）にも在るが、過去節は編集しない**（`CLAUDE.md` §8）。**★あわせて `govulncheck -version` の `No vulnerabilities found.` を到達性の証拠に使わないこと**（走査対象ゼロで DB を引かないため 403 でも同じ出力。`:4740` で再現済み）。
    6. **★`react-router-dom` 6 → 7 のメジャー版上げが要る（別サブ）。** `pnpm audit` の moderate 2 件（GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg）はどちらも**修正版が 7.18.0 以上**で 6.x には来ない。**★版上げ前の 6.30.4 も同じ脆弱範囲内であり、本サブが持ち込んだものではない**（なお本アプリは SSR を使っていないため 2 件目の SSR Hydration 経路は成立しない）。指示書 §7-2 のとおり別サブへ。
    7. **★`docs/handover/followup-backlog.md:113` の `M14-h` は半分だけ解消した。** 本サブが片付けたのは「`README.md` の Go 要求版数の是正」（2026-08-20 追記分）だけで、**同じ行が持つ「LICENSE ファイル追加（MIT 確定）＋ README『未定』の更新」と「ライセンス許可リストの区分 3 つ」は未着手**である。**★行ごと畳むと OSS 公開前ゲートである LICENSE 追加が黙って消える。** 製造は §J 以外を編集できない（`D-382`）ため設計卓の手番。
    8. **★devContainer のリビルドが要る**（開発者の手番＝指示書 §4-11）。Go が実効 1.26.2 → 1.26.8 へ動く。**★リビルド前に `/devcontainer_rebuild_check` を回すこと。** `.devcontainer/devcontainer-lock.json` は差分ゼロ（中身は github-cli feature 1 件のみ）。**★`init-firewall.sh` は変更していない**——Go の tarball は `dl.google.com` から取るがイメージビルド時でありファイアウォールが立つ前なので許可は不要。
    9. **★`toolchain` 行はネットワーク前提を 1 つ増やした。** 既定（`GOTOOLCHAIN=auto`）では Go 1.26.4〜1.26.7 を持つ利用者が初回ビルドで `proxy.golang.org` から go1.26.8 を取得する。**★`GOTOOLCHAIN=local` では `toolchain` 行は無視され、強制されるのは `go` ディレクティブ（1.26.4）のまま**なので `CLAUDE.md` / `README.md` の「Go 1.26.4 以上」は文言として正しい。devContainer は `init-firewall.sh:31` に `proxy.golang.org` が在るため通る。**★オフライン環境の利用者にとっては挙動が変わっている。**
    10. **★フロント lock は推移依存が 100 本動いた**（新規側にのみ在るエントリ 126 のうち直接依存 26 / 推移依存 100）。**★パッケージ名として完全に新規なのは 2 本**——`@napi-rs/lzma-linux-x64-gnu@1.5.1`（**ネイティブバイナリ**。`rollup@4.63.1` の `optionalDependencies` 経由で、`dist` を作るビルド環境へ入る）と `@radix-ui/react-use-is-hydrated`。消えたのは `@radix-ui/react-use-escape-keydown` と `pify`。**★`vite@6.4.3` と `esbuild@0.25.12` 自体は不動**（rollup だけが動いた）。
    11. **★★【2026-09-06 追補】Echo の版上げは、本アプリに対しては挙動を変えない**（完了報告 §4.4）。**`GHSA-vfp3-v2gw-7wfq` / `CVE-2026-55677` が影響するのは `StaticDirectoryHandler`（`e.Static` / `e.StaticFS`）と Static ミドルウェアだが、本アプリはそのいずれも使っていない**（使用 0 件。自前の `internal/api/static` を `e.GET("/*")` で登録している）。**加えて認証は `e.Use` のグローバル登録であり、本脆弱性の前提である「兄弟ルートのルート単位の保護を迂回する」非対称が存在しない。** **★実バイナリで v4.15.1 と v4.15.4 の対照実験を行い、エンコードされたセパレータを含む 10 本すべてで挙動が同一（漏洩なし）であることを実測した。** ⇒ 完了報告 §2.2 の初版「本アプリは静的配信を持つため直接効く面である」は踏み込みすぎであり、訂正した。**★動機はレビューの破壊確認**——「Go 依存 11 本を着手基点へ戻しても `go build` も `go test` も緑」＝上げた効果を裏づけるテストが 0 件だったため、**「壊れなかった」ではなく「効果が在るか」を別途測った。★依存の版上げでは、この 2 つは別の問いである。**
    13. **★★【2026-09-06】CI のトリガが非対称である。`make build-all` と `make e2e` は PR では走らない。** 実測＝`pr-checks.yml` は `pull_request` / `push:[main]` / `workflow_dispatch` で **`go vet` / `go build` / `go test` / Vitest だけ**、`nightly-crossbuild.yml` は **`schedule`（cron `0 18 * * *`）＋ `workflow_dispatch` のみで `pull_request` を持たない**。**⇒ 本サブのクロスビルド（3 OS）と E2E（247 passed）の緑は、すべてローカル実測である。GitHub ランナー上で `go1.26.8` が初めて走るのは (a) 手動 `workflow_dispatch`（ブランチ指定可。マージ前に確認したいならこちら）か (b) main へマージ後の次の Nightly。** **★`schedule` は「リポジトリが 60 日間非アクティブだと GitHub が自動で無効化する」**（`nightly-crossbuild.yml:24` の注記）ので、(b) に頼るなら Actions タブで有効かを見ること。**★製造が一度「PR を出せば Nightly が走る」と開発者へ案内したが誤りであり、実測して訂正した。** **★★【2026-09-06 追補】開発者が手動 `workflow_dispatch` で Nightly を起動し、`E2E (Playwright)` job が緑だった**——**247 passed / failed 0 / flaky 0 / 322 秒 / workers 1 / ランナー実コア 2**。**⇒ `go-version-file: go.mod` により GitHub ランナー上で `go1.26.8` が使われた初めての実行であり、ローカル実測（247 passed / 312 秒）と件数が完全一致した。ツールチェーン上げはランナー環境でも回帰を起こしていない。** **★ただし同じワークフローの `crossbuild` job（`make build-all`）の結果は受け取っていない。⇒ 3 OS クロスビルドのランナー上での結果は依然として未確認であり、「Nightly が緑」と丸めて書かないこと。**
    12. **★★【2026-09-06 訂正】上記 5 の初版は事実誤認だった**（`vuln.go.dev` は `init-firewall.sh:34` に 2026-08-26 から在る）。**原因は、レビュー指摘 `M-6` の根拠を実測せずに本文へ写したこと。** 同じレビューの `M-1`（推移依存の件数）は独立に再実測したのに `M-6` だけ検証を省いている。**⇒ レビューの指摘は「直す対象」であって「検証済みの事実」ではない。取り込む前に根拠そのものを実測すること。** **★この型はどの機械検査も捕まえない**（`check-doc-refs.sh` は参照の生死しか見ず、`check-progress-log-index.sh` は追記の有無しか見ない）。**⇒ 人が読む以外に見つける経路が無い**——実際、開発者が「やるべきことが分からない」と問い合わせて手番を洗い直すまで残っていた。
### M26-02: 公開スナップショット生成の基盤 ＋ ライセンスの配置（2026-09-06）

- **結果**: `go test ./...` / `pnpm test`（2429 件）/ `make e2e`（**247 passed**）緑。**マイグレ消費 0 本 ／ CHANGE 消費 0 本**。三層の `LICENSE` と `REUSE.toml`（パス単位宣言・全表 `precedence = "override"`）を配置し、`migrations/` 102 本を**層 A 30 / 層 B 72** で凍結列挙。許可リスト `scripts/public-snapshot-manifest.txt`（ALLOW 34 / DENY 12・全行に理由列）と検査 2 本（`check-public-snapshot.sh` / `check-migration-license.sh`。どちらも self-test つきで `check-artifact-integrity.sh` に自動発見される）、生成 `make-public-snapshot.sh`（**ローカル生成のみ。リモートに触れる git 操作を 1 つも持たない**）を新設。生成実測＝**追跡 2707 件のうち 14 件を除外**。
- **報告**: 完了報告 `docs/progress/M26-02-completion-report.md` ／ レビュー `docs/progress/m26-02-review.md`
- **レビュー**: 重大 0 件 ／ 高 6 件（**全件採用・不採用 0 件**）／ 中 6 件（全件採用。うち 2 件は「割当を変えず報告へ記録する」形）／ 低 6 件（5 採用・1 不採用＝射程外の `README.md` Go 版数）。**再レビュー往復 0 回**（§J への停止時記録は不要）
- **★横断課題**:
    1. **★★`docs/design/` に反映が要る箇所が 3 件ある。CHANGE 1〜2 本が要る（設計卓の手番。★製造は自採番していない＝`D-293`）。** **`DES-001` §5 は「本プロジェクト自体のライセンスは MIT License とする（確定）」と書いており、三層と正面から食い違う**／**`SUPP-001` §5.7 の禁止ライセンス表に `AGPL-3.0` と `CC BY-SA` が載っており、本サブが置いた 2 つがどちらも禁止列に在る**（★`M26-01` §4.2〜§4.5 は「同節は inbound の規定であり outbound を AGPL にすることは違反しないと解される。要るのは撤回ではなく明確化」と判定済み）／**`SUPP-001` §2.7 に欠番の表と新規マイグレの命名規約が無い**（素案は完了報告 §7 にそのまま貼れる形で置いた）。
    2. **★★指示書・チェックリストの記述が 3 件失効していた。実測に合わせて実装した。** **(a) 欠番は 3 つではなく `000012` の 1 つだけである**——`000081`（`M27-01`）と `000096`（`M27-02b`）は実在する。出所は `D-708` の「穴は 3 つになる」という**予測**であり、統合で実現しなかった。**⇒ 「並列作業中に見える穴」と「恒久の欠番」を混同しないこと。** **(b) 凍結層 A は 28 本ではなく 27 本**——レビュー表 §1 の 28 行は削除済みの `000012` を含む。**(c) `character_data/` の md 列挙から `dhalsim-joint-remeasurement-2026-09-04.md` が漏れていた**（「丸ごと層 B」の規則側に従い層 B とした）。
    3. **★★`docs/seed-data/` の公開可否で指示書内に食い違いが在り、開発者裁定を取った。** 同ディレクトリの `README.md` が「**本ディレクトリは OSS 公開版リポジトリには含めない方針**」と自己宣言しており（公式の生フレーム値・元データ抜粋を含む）、指示書 §2.1-2 の「`docs` はアーカイブ含め全部公開する」（`D-637`）と正面から食い違っていた。**⇒ 開発者確定＝ディレクトリごと DENY。`M26-03`（`A3`）で再判定する前提。★許可リスト方式の既定は非公開であり、開けるのは後からいつでもできる安全側である。**
    4. **★★レビュー表に無い 23 本（`000081`〜`000103`）の層割当を、実査して開発者承認を取った。** 1 本ずつ実物を開き、書き込む表を全数抽出した結果、**層 A の 3 本**（`000081` / `000096` / `000103`）**はいずれも `combos` しか触らず、層 B の 20 本はすべてゲームマスタ表を書く。⇒ 境界は表単位で綺麗に割れている。**
    5. **★★レビューが実バグを 2 件出した。どちらも「緑のまま間違う」型である。** **(a) 予防 DENY のグロブが直下限定だった**——`.env` と書くとリポジトリ直下にしか当たらず、**`web/.env`（Vite の既定位置）や `docs/tmp/**` が `web/**` / `docs/**` の ALLOW を素通りしていた。`.gitignore` の同名規則は深さ無制限であり非対称。** ⇒ `**/` 付きへ是正し、10 パスで実測。**★同じ manifest 内で `**/*.pem` は正しく書けており、書き方が割れていた。** **(b) 「静かな漏れ」検出が `INSERT OR IGNORE INTO` を見逃していた**——**仮定の形ではなく `migrations/000007` が実際に使う形である。** self-test が `INSERT INTO` の 1 形しか試していなかったため緑のまま通っていた。**⇒ 陽性対照は「1 形だけ試して緑」を対照と呼ばない。6 形へ増やした。**
    6. **★★自分の成果物が検査対象に入ることを勘定に入れずに「本サブ由来ではない」と書いた**（レビュー 高-3 / 高-4）。**報告を書いた時点では真だったものが、報告自身をコミットした時点で偽になった**——`docs/progress/` は `check-progress-log-index.sh` と `check-md-emphasis.sh` の両方の走査範囲である。**⇒ 「着手基点と byte-identical」を主張するときは、これから書く成果物が走査範囲に入るかを先に見ること。**
    7. **★`check-md-emphasis.sh` は「フェンス内のグロブ」を偽陽性として数える**（本サブの発見）。同検査は「CommonMark 実装で **1 行ずつ**描画」するため**フェンス（```）を認識できず**、`path = "**"` のような行を閉じない強調として数える。本サブの完了報告の 41 行のうち **39 行がこの偽陽性**であり（機械判定で確認）、いずれも指示書 §3-1 / §3-3 が要求した逐語引用そのものなので直せない。**★ベースライン `436` 自体にも同型の偽陽性が含まれている可能性が高い。⇒ 「閉じない強調」を実際に減らそうとするとき、この偽陽性が床を押し上げる。** 走査を行単位からブロック単位へ変えるかは同検査の所有者の判断であり、本サブは触っていない。
    8. **★`check-md-emphasis.sh` は同じ実行で 2 つの数字を出し、突き合わせないと取り違える。** 要約行の「ベースラインから N 行増加」と `--list` の出力行数は、**`--list` にヘッダ 9 行が付く分だけずれる。** 本サブは初版で `--list | wc -l` をそのまま写して 972 を 981 と書いた（レビュー 低-3 で発覚）。**⇒ 同じ検査が 2 経路で数字を出すときは突き合わせること。**
    9. **★リリース zip の同梱物を増やすかの判断が開発者の手番として残る。** 現在の zip の中身は `tacpendium.exe` ＋ `README.txt` の 2 点だけであり（`nightly-crossbuild.yml:105` の逐語）、**`LICENSE` / `DATA-LICENSE.md` / `NOTICE` / `REUSE.toml` は利用者の手元に届かない。** 本サブは `README.txt` の文面を実態に合わせた（「公開リポジトリのタグにあります」＋「本 zip の中身は 2 点だけ」）。**★同梱物を増やすかは `DES-002` §11.2 の配布物定義とアーカイブ化手順に関わるため、開発者・設計卓の判断である。★本サブは法務を断定していない。**
    10. **★`docs/handover/**` → MIT が `D-672` と衝突する実例を含む**（レビュー 中-2）。`docs/handover/SF6セットプレイ-ドメイン知識集成.md` や `M19-DESIGN-0*` 群は「SF6 の事実そのもの」であり、**層 B の ShareAlike が及ばない。** **★指示書 §7-1 の暫定案が `docs/handover/` を層 C と明示して承認されているため割当は変えていない**（承認の範囲を超えるため）。**向きは MIT → CC BY-SA へ後から締め直せる側である。⇒ 設計卓の判断を求める。**
    11. **★消す候補を 6 件出した（消していない＝`D-196`）。** とくに**ルート直下の `combomgr`（21MB・未 strip の ELF）が untracked かつ un-ignored** で置かれていた——`.gitignore` は `M28-01` 後の `/tacpendium` 系しか除外しておらず旧名を拾っていなかった。**⇒ `git add -A` 1 回で 21MB のデバッグ情報付きバイナリがコミットされうる状態だった。** 開発者確定により `.gitignore` へ旧名 4 種を追記した（**ファイル自体の削除は開発者の手番**）。ほかに空の `.worktrees/` ／ `scratch-*.db` 60 ファイル（27MB）／ `dist/` の旧名 exe ／ `logs/`。
    12. **★`reuse lint` は走らせていない**（新規依存になるため＝`CLAUDE.md` §6）。**⇒ 割当の解決は REUSE 仕様本文（一次情報。FSFE の `fsfe/reuse-website` の `spec-3.3.md` へ到達できた）に基づく自前実装であり、公式ツールとの一致は確かめていない。★床であって証明ではない。** 具体的な不一致候補が 1 件ある——`docs/progress/M26-01-report.md:800` の地の文のコロン形 SPDX タグを、公式ツールは当該ファイルのタグとして拾いうる。
    13. **★★【2026-09-06 追記】開発者が消す候補 4 群を同日中に削除し、`D-656` の「存在しても出さない」形が実地で確かめられた。** ルートの `combomgr`（21MB）／ 空の `.worktrees/` ／ `combmgr-features.txt` ／ `scratch-*.db` 60 ファイル。**★`combmgr-features.txt` が消えたことで許可リストの DENY 行が 0 件に当たる状態になったが、検査は緑のままである**（実測＝除外 14 件 → 13 件）。**⇒ 「開発者が削除したら本項は自然に不要になる」という設計が、fixture ではなく本物のリポジトリで成立した。★DENY 行はこのまま残す**（消すと将来同名のファイルが復活したときに黙って公開される）。**あわせて開発者裁定が 2 件**——**`docs/handover/**` は MIT のままでよい**〔逐語＝「`SF6セットプレイ-ドメイン知識集成.md` は本アプリ上でどう扱うかの情報なので MIT でいい」。**★判定軸＝「SF6 の事実」ではなく「その事実を本アプリでどう扱うか」なら層 C**〕**／ リリース zip の同梱物は後日課題として設計卓へ伝達でよい。** **★★あわせて `20260905-migration-license-assignment.md` §6 手順 1（層 A・現存 27 本の人力レビュー）が完了していることを開発者が確認した**〔逐語＝「A-1の確認は済んでいます」〕。**⇒ 割当の「戻しにくい向き」に対する担保は取れている。★同書 §9 の「状態」行が 2 点とも失効している**〔`REUSE.toml` は本サブで書いた ／ 手順 1 は完了した〕**——設計卓の手番として伝達レポート §3-3 へ回した。**

### M29-01: 語彙・ラベルの統一（`α②`）（2026-09-06）

- **結果**: `go build` / `go test ./...` / `pnpm exec tsc --noEmit` / `pnpm test`（**212 ファイル・2454 件**）/ `make e2e`（**247 passed・全数**）緑。**マイグレ消費 0 本 ／ CHANGE 消費 0 本 ／ 新規依存 0**。**★本サブの最初の成果物は実装ではなく「語の割れの全数」であり、実測 24 か所**〔i18n キー 15 ＋ 直書き 9〕**。★`phase4-overview` §7.1 の「29」にはならない**（§横断課題 1）。寄せ先は**開発者が選んだ**（`D-742`）＝ **1-B / 2-A / 3-A / 4-A**。参照 0 になった `trash.detail.recipeUnavailable` を **ja / en の両方から**削除。コミットは指示書 §2.5 のとおり **1 群 1 本**（実査 → 群1 → 群2 → 群3 → 群4 → 参照0キー削除）。
- **報告**: 完了報告 `docs/progress/M29-01-completion-report.md` ／ レビュー `docs/progress/m29-01-review.md` ／ 設計伝達 `docs/handover/design-reports/20260906-m29-01-design-exceptions.md` ／ PR [plexiblinp/combomgr#160](https://github.com/plexiblinp/combomgr/pull/160)
- **レビュー**: チェックリスト §7 の重大 **0 件** ／ 高 5 件（**全件採用・不採用 0 件**）／ 中 6 件（全件採用）／ 低 4 件（3 採用・1 記録のみ＝`低-4` は en の大小文字でチェックリスト §8-2 が軽微と定める）。**再レビュー往復 1 回**（上限 2 回に未達。未解消 0 件のため §J への停止時記録は不要）
- **★横断課題**:
    1. **★★`phase4-overview` §7.1 の「用語・ラベル・入出力＝29」は実査と合わない。** 実測は語彙だけで **24 か所**である。**★合わせにいっていない**（チェックリスト §0.2）。理由は 2 つ——**(a) 29 は `M29` マイルストーン全体の raw ledger 件数であり、入出力〔CSV・エクスポート・バックアップ〕＝`M29-02` の射程を含む。(b) ledger（`M25-RESEARCH-01` §3）の `触る面` 列からこの 29 を再現する組み合わせが読み取れない**（計測点 `M-127`）**。⇒ 突き合わせる対象そのものが存在しない。★追随注記は設計卓の手番。**
    2. **★★レビューが実バグを 1 件出した。「緑のまま間違う」型である。** 群 1 の i18n 化で `RecipeBuilder` の空ステップ表示だけを `t()` にした結果、**同じ部品の中で直書き和文（`legend="レシピ"`）／ `jaLabel` 経由（`RECIPE_EMPTY_LABEL`）／ `t()` の 3 系統が同居し、英語表示でレシピ欄が和英混在になる**状態を作っていた。**★これは `M24-07` が避けると決めた形そのもので、しかも同じコミットが書いたコメント（「エディタ 2 面は i18n を通さない設計を維持」）と食い違っていた。★動作は正しいためテストも型検査も緑のまま通る。⇒ 人が読む以外に見つける経路が無い。** 取り込みでエディタ 2 面を `jaLabel` 由来の定数へ戻した。
    3. **★`e2e/m24-12-editor-rebuild.spec.ts:31` が単独実行で常に赤**（「戻るを 2 回押しても起点へ戻れない」）。**★「flake」で済ませず、変更 27 ファイルを着手基点 `25c9285` の内容へ全数差し戻して同一の赤を実測し、着手前から在ることを確かめた**（確認後に復旧済み）。**★`make e2e` の全数実行では 247 件すべて緑**であり、実行順に依存する既存の不安定さである。**⇒ 本サブの失敗ではない。**
    4. **★`check-enum-sync.sh` は `model.OpponentStance*` も見ていない。** スクリプト `:68-73` のコメントは `opponent_size` だけを名指ししているが、**`OpponentStance*` も接尾辞 `Category|Status|Type|Code` に当たらないため同じ穴に在る。⇒ 既存 followup `check-enum-sync-misses-size-suffix` の射程を 1 軸広げる必要がある。**
    5. **★参照 0 のキーを検出する網は存在しない。** `locales.test.ts` が担保するのは「ja/en の**片側だけ**消えた／増えた」であって、**両側に残った参照 0 のキーは赤くならない**（レビュー 中-6）。**⇒ 次に参照 0 が生まれても検出されない。**「網が在る」と読まないこと。
    6. **★`check-md-emphasis.sh` は着手前から NG**（現在 494 行 / ベースライン 436 行）。**★本サブのファイルの寄与は 0 行**であり、差は `retrospective-digest.md`(41) / `M26-02-completion-report.md`(40) / `M21-RESEARCH-01-report.md`(40) 等の既存ファイル由来である（`M26-01` の横断課題 7 が述べる偽陽性の床と同じ話）。
    7. **★`VAL-C09` の重大度の非対称は `M29-02` へ送った。** CSV 取込は WARNING（`csvcore/validate.go:172`「recipe is empty (0 steps)」）・本体保存は ERROR（`validation/combo.go:366`「レシピが空です」）。**★文言も和英で割れているが、重大度の非対称ごと `M29-02` の射程である。**
    8. **★群 1-d の空ステップ文面は製造が書いた新しい文面であり、実画面での確認が残っている。** 承認済み計画は「`SetupRecipeEditor` を `RecipeBuilder` 側の文面へ揃える」だったが、実装時に **2 面でボタン名が違う**こと（`RecipeBuilder` は「追加」・`SetupRecipeEditor` は「ステップ追加」）が判明し、ボタン名を引用すると片方の画面で嘘になるため鉤括弧を落とした。**開発者の逐語＝「いったんこのままでいい。製造終了時に実画面を見て決める。」**
    10. **★★レシピタブは着手前から和英混在である（開発者の実画面確認で判明・2026-09-06）。** `RecipeBuilder` / `SetupRecipeEditor` が内包する **`VirtualController` は `M24-07`（`899c4e1`）が 70 本を i18n 化済み**であり、英語表示で `Quick input (buttons)` / `Common moves` 等が出る。一方で 2 部品が自分で描く文字列は日本語直書きである。**★本サブが書いたコメント「エディタ 2 面は i18n を通さない設計（`M24-07` の意図）」は事実に反していたため撤回・是正した。★レビュー 高-2 もこの誤った前提に立っており、製造が検証せずに取り込んだ**——結論（実装側を直す）は正しかったが、理由の説明が誤っていた。**⇒ 「エディタは i18n を通さない面」と読まないこと。通していないのは 2 部品が自分で描く文字列だけである。** 根本解決は直書きの i18n 化だが、語彙の統一ではないため本サブの射程外。
    9. **★`docs/design/` へ反映が要る箇所が 9 件ある**（完了報告 §7。**製造は直さない**）。とくに **`05-screen-design.md:558` の重複警告の例示が `消費 SA ／ 消費ドライブ` のまま失効している**——**`retired-words.test.ts` は `docs/` を走査しないため永久に検出されない。**
### M28-04: `move_code` / `command` / `startup_basis` の是正（2026-09-06）

- **結果**: **★★射程 9 行**〔guile 3 件 ＋ 同乗 6 行〕**はすべて `M19-04c`（マイグレ `000063`・2026-08-03）で既に是正済みだった。⇒ コード・CSV・マイグレの変更ゼロ／マイグレ 0 本／CHANGE 0 本。`000106` は未消費のまま返す**（ボード §2.2 の「次に払い出す番号」は動かない）。`go test ./...` ／ `pnpm test`（2440）／ `make e2e`（247）とも緑
- **報告**: 完了報告 `docs/progress/M28-04-completion-report.md` ／ レビュー `docs/progress/m28-04-review.md`
- **★横断課題**:
  1. **★★是正を実行したサブが、一次源となった board / backlog 行を閉じる手順が無い。** `P-17` 行には「`D-162` の `M19-04c` として `P-19` と一緒に是正する（承認待ち）」と書かれ、**ボードは 2026-08-07 に `D-201` で「`M19-04c`（`000063`）で `P-19` の 6 行は解消済み」と裁定し、未決と読まれる 3 か所**〔`D-158` ／ 保留 `P-19` ／ 引き継ぎ資料 §4〕**まで名指ししていた。⇒ それでも `D-723` の仕分けで追跡されず、1 か月後に `M28-04` として再起票された。★裁定を書くことと、裁定が指す行を直すことは別の手番である——「◯◯に古い記述が残っている」と書いた裁定には、それを直す割付が要る**（設計卓へ請求）
  2. **★★指示書 §2.6-1 / `D-742` / `D-753` / チェックリスト §0.4-7 の「6 行のどの列がいくつ誤っているかはどこにも記録されていない」は失効している。** **`D-158`**（`docs/process/archive/parallel-board-rulings-M20.md:160`）**に 6 行の正しい値が全数逐語で記録されている**（設計卓へ請求）
  3. **★`D-158` が「未確認」と残した「6 行が確定反撃サーチの候補に入るか」に答えが出た。** **始動技側は 6 行とも入る／相手技側は 4 行が成立レーンで、mai の 2 行は `is_projectile=1` のため手動確認レーン**（`punishfinder/service.go:247-251`）**。⇒ `punishfinder` に `is_derived` / `category` のフィルタは無く、除外しているのは `is_projectile` である**
  4. **★`check-md-emphasis.sh` のベースラインが 58 行ぶん古い**（着手基点 `25c9285` 時点。所在は `retrospective-digest.md` 41 ／ `M26-02-completion-report.md` 40 ／ `M21-RESEARCH-01-report.md` 40 等で、本サブが触らない範囲）**。⇒ ベースライン更新は `scripts/` を触るため改善レーンの手番**（`D-335`）
  5. **★★terry `quick_burn_light` は誤りで確定した**（2026-09-06 開発者のインゲーム確認。逐語＝「`quick_burn_light` には強度は存在しません。…`quick_burn` に直す必要がある」）**。★本サブでは直していない**（射程外。連番は設計卓が払い出す＝`D-293`）**。⇒ 新サブの起票と `000106` の払い出しを請求する。詳細と実査済みの前提は完了報告 §11。★★前例**（`sonic_break_light`）**より影響範囲が広い——`is_derived=0` かつ `command` 非空のため `move_commands` 索引に載っており、動く golden が 1 本ではなく 4 本になる**〔`000026` / `000035` / `000072` / `000073`〕**。★`M28` は破壊的変更の窓であり、`move_code` のリネームは配布 DB の識別子が変わる。⇒ 窓のうちに起票すること**（`D-725`）
  5-b. **★ingrid `sun_flare_light` は誤りではないと確定した**（同日・開発者確認）**。⇒ 閉じてよい**
  5-c. **★★開発者の手元 DB で 21 行の実値が確認され、既存 DB の追随経路が確かめられた**（2026-09-06。guile の sonic 系 15 行〔`sonic_cross_2_meter_od` の `startup_basis=through` を含む〕＋ §2.6 の 6 行が本報告の期待値と全数一致。旧 code 2 つは不在）**。⇒ 完了報告 §8-5 の留保**「既存 DB は確かめていない」**は解消した。`000063` の `NOT EXISTS` ガードが空振りしていた可能性は消えた**
  6. **★★「常設検査は緑だった」と書くときは、いつ測ったかを併せて書くこと。** 成果物そのものが検査の母数に入る種類の検査（`check-md-emphasis` / `check-progress-log-index` / `check-doc-inventory`）では、**書く前に測った値は完了時の値ではない**——本サブは初版でこれを踏み、レビュー 高-4 で是正した
### M28-02b: ゲーム更新の影響コンボを見せる画面（**設計まで**）（2026-09-06）

- **結果**: **実装 0 行**（`web/` / `internal/` / `migrations/` / `docs/design/` に差分なし）。**★これは正常である**——`D-668` により本サブの必達は「設計まで」であり、成果物はモック HTML ／ 画面設計の記述 ／ CHANGE 請求の 3 つ（指示書 §0.1）。**実装へ進まなかった直接の理由は §2.9-1（モックの開発者承認）が未充足であること 1 点**。**マイグレ消費 0 本**（次に払い出す番号は `000106` のまま）／ **CHANGE 消費 0 本**（起票は設計卓。請求内容は完了報告 §6 に 4 群）。**埋めた「幅」3 つ＝告知の延期はサーバ側ファイル ／ 「確認した」は 1 件ずつのみ・一括なし・取り消しなし ／ 見せ方は 3 案をモックで提示**。**レビュー指摘 12 件（重大 0 / 高 4 / 中 4 / 低 4）を全件採用、★「高」の不採用は 0 件**（中・低の不採用も 0 件）。**再レビュー往復 1 回**。常設検査は `check-artifact-integrity.sh` を 1 本目に回して緑、`check-md-emphasis.sh` は着手前から赤（494 / ベースライン 436）だが**本サブの寄与は 0 行**。
- **報告**: 完了報告 `docs/progress/M28-02b-completion-report.md` ／ レビュー `docs/progress/m28-02b-review.md`。着手基点は `25c9285`。モックは `docs/progress/M28-02b-mock/index.html`。
- **★横断課題**:
    1. **★★既存の移行告知（`M28-01` / `CHANGE-156`）は PC で一度も出ていない。** `web/src/App.tsx:33-34` が `/` を `!isMobile`（`useIsMobile` の閾値＝`(max-width: 639px)`）で `/combos` へリダイレクトするため、**640px 以上では `HomePage` が一度も描画されない。** そして `DataMigrationBanner` の唯一のマウント先は `HomePage.tsx:31` である。**⇒ 本サブ由来ではない既存の欠陥であり、`M28-01` の射程であるため直していない**（触ると `CHANGE-156` の as-built がずれる）。**★本サブへの含み＝「移行告知と同型」を素直に採ると、指示書 §2.2-2 が「これが主動線である」と書いた経路が PC で丸ごと消える。⇒ 告知は `HomePage` ＋ `ComboListPage` の 2 か所に出す形にした。**
    2. **★★`FR702` の目的（どの技が変わったか）は、現行 API では原理的に達成できない。** 指示書 §2.3-4 は「1 行にどの技が変わったかを出すこと。★★これが本機能の目的である」と書くが、実査すると **(a) `internal/api/move/dto.go` の応答 DTO にマーカー（`lastChangedGameVersion`）が載っていない**〔`internal/model/move.go:79` には在るが詰め替えで落ちる〕**／ (b) `games.current_data_version` を返す HTTP 経路が 1 本も無い**〔比較の片側が FE に存在しない〕**／ (c) `ComboSummary` に `steps` が無い**〔持つのは `ComboDetail` だけ〕**／ (d) 行ごとに `GET /api/combos/:id` を引いても `ComboStep` に答が入っていない**。**⇒ `ComboResponse` へ `affectedMoves` を足す請求を設計卓へ出した**（完了報告 §6.1）。**★指示書 §0.5-5 の「(b) 専用画面はこの 1 本で作れる」という前提は、絞り込みについては正しいが、目的の達成については成立しない。**
    3. **★★`M28-02a` 完了報告と `M28-02b` 指示書で射程が食い違っている。** 前者 §8 は「3 つの入力方式の UI は作っていない（`M28-02b` の射程）」と書くが、**`M28-02b` 指示書 v1.2.0 の §2「やること」に始動位置・運び量の 3 方式入力 UI は 1 行も無い**。⇒ 本サブでは作っていない（指示書が正＝`CLAUDE.md` §8 の参照優先順位）。**★帰結＝`followup` `duplicate-precheck-ignores-position-mass` と `position-bands-duplicated-go-and-ts` は、いずれも割付条件が「3 方式入力を実装するなら／FE 側で導出を使い始めるなら」であり、本サブでは条件が成立せず未着手のまま残る。⇒ 割付先の見直しが要る。**
    4. **★`DES-005` §5.20 / §5.21 の「不採用」の記述が as-built とずれている。** 設計書は「探す側＝一時非表示 ／ マイリスト側＝`adopted`/`unreachable` トグル」と読める形だが、**実装では両方とも探す側 `/punish/search` の `PunishTree.tsx` に同居している**〔一時非表示＝`:141-149` ／ トグル＝`:151-174`〕。マイリスト側（`/punish/list`）が持つのは curation / pruning の永続 hide とその解除である。**⇒ 指示書 §2.5-2 の結論（本サブの「確認した」はどちらとも違う）は変わらないが、設計書の記述は失効している。**
    5. **★★語を「要確認」にしなかった。既に別の意味で使われていたためである。** `ja.json` には 0 件だが、**実物はハードコードで存在していた**——`web/src/pages/ComboImportPage.tsx:329,426` の列見出し「要確認 / エラー」と、`internal/service/movewarning` ／ `web/src/constants/move-warning.ts` の「moves の要確認コード」。**あちらは「行のデータそのものが怪しい」、こちらは「データは正しいがゲームが変わった」で意味が違う。** ⇒ 「更新未確認」を採り、対案「更新の確認待ち」と併せてモックで開発者へ返した。**★一般形＝語の衝突検査は `ja.json` の grep だけでは足りない。本番コードのハードコードまで見ること。**
    6. **★★レビューが実バグを 1 件出した（高-2）。「宣言順で `/combos/:id` に食われる」は事実として誤りだった。** `react-router-dom` v6 の `<Routes>` は**宣言順ではなく specificity で照合する**——`@remix-run/router@1.23.3` の `rankRouteBranches` を実測すると `staticSegmentValue = 10` / `dynamicSegmentValue = 3` であり、静的セグメントが先に選ばれる（同じ仕組みで `/combos/new` が `/combos/:id` と共存している）。**★結論（`/game-update/combos`）は変わらないが、根拠の文は `DES-005` へそのまま写る位置に在った。⇒ 誤った前提が伝播すると、後任が `router.tsx` の行順を意味なく入れ替える。**
    7. **★2 つの必達成果物（モックと完了報告）が食い違う型の欠陥が 2 件出た**（レビュー 高-3 / 高-4）。**どちらも「どちらが `DES-005` の素なのか」が決まらないまま設計卓へ渡り、片方だけが静かに写される形である。⇒ 一般形＝成果物が 2 つ在るサブでは、両者が同じことを言っているかを最後に突き合わせること。** とくに高-4（取得失敗の出し先）は、**報告側の形を採るとスマホで失敗が黙る**——指示書 §2.2-6 と危険 2 が名指しした罠の再発であり、**自分で見つけた事実（スマホの入口はホーム画面しか無い）を自分の設計へ適用できていなかった。**
    8. **★変更統計を手書きしたために、やっていないことが「やった」として記録に残りかけた**（レビュー 高-1）。完了報告 §0 の統計に、まだ追記していない `progress-log.md` の行を載せていた。**⇒ `git diff --stat` は実際に走らせて出力を写すこと**（`implement_plan_full` Phase A 補足 (b) が求めているのはこの読み方である）。

### M28-02b（追補）: 開発者フィードバックの反映 ＋ 設計伝達レポート（2026-09-06）

- **結果**: `M28-02b` 本体（`13b8c0c`）を push した後に**開発者がモックを見て 4 件のフィードバック**を出したため、モック・完了報告を**第 2 版**へ更新し、**設計伝達レポートを新規作成**した。**実装は引き続き 0 行**（`web/` / `internal/` / `migrations/` / `docs/design/` の差分 0）。**マイグレ 0 本・CHANGE 自採番 0 件は不変。★返却事項 6（`combo-baseline-not-advanced-on-patch`）が開発者確定により決着し、設計卓への請求から外れた。** 常設検査は全数緑（`check-md-emphasis.sh` のみ着手前から赤・本サブ寄与 0 行）。
- **報告**: 完了報告 `docs/progress/M28-02b-completion-report.md` §14 ／ レビュー `docs/progress/m28-02b-review.md` 末尾「開発者フィードバックによる後続変更」／ **★設計伝達レポート `docs/handover/design-reports/20260906-m28-02b-design-exceptions.md`（新規）**。モックは `docs/progress/M28-02b-mock/index.html`（第 2 版）。
- **★横断課題**:
    1. **★★設計卓は `docs/progress/` を読まない**（2026-08-11 開発者裁定①）**——にもかかわらず、本サブは CHANGE 請求を完了報告 §6 にしか置いていなかった。⇒ 最重要の請求（`ComboResponse` へ `affectedMoves` を足す）が設計卓へ届かないままになるところだった。** `roles-and-routing.md:105` は製造の出力として `design-report` を挙げており、`docs/handover/design-reports/` には先例が 6 本ある。**⇒ 一般形＝「請求を書いた」と「請求が届く場所に置いた」は別である。★`implement_plan_full` の Phase 構成には設計伝達レポートの生成が入っていない**（別コマンド `/design_handover_report` が担う）**ため、一気通貫で回すと落ちる構造になっている。**
    2. **★★レビューは「両方の成果物に等しく欠けているもの」を検出できない。** 本サブのレビューは 12 件を出し、そのうち 2 件（高-3 / 高-4）は「モックと完了報告の食い違い」だった。**しかし開発者が指摘した「影響がある場合に直しに行く導線が無い」は、モックにも報告にも等しく無かったため、どちらを見ても矛盾として現れず 1 件も挙がらなかった。** **⇒ 一般形＝食い違い検査は「片方にある」ものしか捕まえない。「両方に無い」ものは、逐語の要求へ戻らないと拾えない**〔本件では `D-729`＝「どのコンボに影響があるかをユーザーに見せ**修正しやすいように**する事が今回の目的」の**後半**〕。
    3. **★「どう見せるか」を問われたら、その前に「見せる必要があるか」を 1 度だけ問うこと。** 指示書 §2.7 が「『影響可能性あり』の見せ方を決めよ」と書いていたため、製造は 3 案（バッジ／行の塗り／状態列）を組み立てて開発者へ返した。**開発者の返答は「専用画面なのだから、そもそもバッジも状態列もいらないのでは」であり、そのとおりだった**（全行が該当する画面で行ごとに「該当している」と書くのは冗長）。**⇒ 3 案とも撤回した。★設問の形が選択肢を狭めることがある。**
    4. **★★編集して保存すると基準が進むかは、経路によって違う**（実査）。`ComboEditor.tsx:449-471` の `hasKeyChanges()` が分岐し、**重複判定キー 7 項目（レシピ・始動技・状況など）を直すと `PUT` ⇒ 旧行を論理削除して新しい行を INSERT するため `insertComboSQL` の `COALESCE` が効き基準が最新になる／メモ・ダメージだけ直すと `PATCH` ⇒ `UpdateMetadata` の SET 句に `baseline_version` が無く据え置き**。**⇒ 「直す＝レシピを直す」なので開発者の望む流れ（専用画面 ⇒ 編集 ⇒ 保存 ⇒ 消える）はそのまま成立し、メモを 1 文字直しただけで警告が消えないのは `FR307` と整合する。★開発者確定＝この非対称のままでよい。⇒ `followup` `combo-baseline-not-advanced-on-patch` は決着したので設計卓が畳んでよい**（**★製造は §J 以外を編集できない**＝`D-382`）。
    5. **★行アクション（詳細 / 編集 / コピー / 削除）は `ComboTableRow.tsx:186-212` が無条件で出しており、出す・出さないを切り替える props が無い。⇒ 表部品を再利用する画面には自動的に付いてくる。** 本サブが必要とした［編集］導線は、**作る必要が無かった**（足すのは［問題なし］1 つだけ）。**★これはレビュー高-3 で決めた「`ComboTable` を再利用する」を後から強く支持する事実である**——再利用しない設計を採っていたら、この導線を自分で作り直すことになっていた。

### M28-05: terry `quick_burn_light` の `move_code` 是正（2026-09-07）

- **結果**: **`go test ./...` / `pnpm test`（212 files・2454 tests）/ `make e2e`（247 passed）すべて緑。消費マイグレ番号＝`000106`**（`000106_data_correct_terry_quick_burn_code`・DML のみ・`character_id`＋`code` で絞り `NOT EXISTS` ガード付き）。**CHANGE 消費 0 本**（`docs/design/` の名指しは実査で 0 件）。**★確定事項＝動く golden は 4 本**〔`000026` / `000035` / `000072` / `000073`〕**で全数であり、4 本とも再生成した**（`grep -rln "quick_burn" migrations/` で 5 本目が無いことをレビューが独立確認）。**破壊確認は指示書必須の 3 件＋自発の 1 件＝計 4 件を実走。**
- **報告**: 完了報告 `docs/progress/M28-05-completion-report.md` ／ レビュー `docs/progress/m28-05-review.md`（重大 0 件 ／ 高 2・中 3・低 4 ＝**全件採用**）／ 設計伝達 `docs/handover/design-reports/20260907-m28-05-design-exceptions.md` ／ PR [plexiblinp/combomgr#165](https://github.com/plexiblinp/combomgr/pull/165)
- **★横断課題**:
    1. **★★`seedgen` の引数なし `-check` が守るのは `000026` だけである、を初めて実測で裏付けた**（`CHANGE-163` §1 / `SUPP-001` §5.5.4 (10) の最初の適用先）。**`000035` の索引 1 行だけを改名前へ戻したところ、`go test ./internal/seedgen/` は exit 1 になったが `go run ./cmd/seedgen -check` は `OK: 生成物は既存ファイルと一致` / exit 0 を返した。⇒ 「`-check` が緑だから golden は守られている」と読むと、守られていない区分を守っていることにできる。★恒久のガードは `go test ./...` の `TestGolden_*MatchesRegeneration` 群である。**
    2. **★★設計卓への請求 3 件**（**★製造は `parallel-board.md` / `followup-backlog.md` §J 以外を書けない**＝`D-382`）。**(a) 次に払い出すマイグレ連番は `000107` である**（本サブが `000106` を消費した）。**(b) ★★`parallel-board.md` §2.2 の「次に払い出すマイグレ連番」が `000092` のままで 14 本ぶん古い**——**`migrations/` の実測末尾は本サブ適用後で `000106`。⇒ 放置すると次のサブへ既存ファイルと衝突する連番が配られうる。★ボード自身が「この行は連番を消費するサブが完了するたびに古くなる」と書いているが、実際に古くなっている。** **(c) `followup-backlog.md` §BS の `terry-quick-burn-light-move-code-error` は本サブで解消したので閉じてよい。**
    3. **★母数を「歴史記録も含めた `docs/` の総件数」で取ると、その母数を出した報告書自身と、それを受けて起票された指示書・チェックリストが母数を押し上げる。** 本サブは `docs/` が 16 → 45 になり、指示書 §2.1 の「一致しなければ止めて報告」に該当したため Plan Mode で報告して開発者裁定（続行）を得た。**差分 29 件は全数実査で、すべて `M28-04` の母数実査より後に書かれた文書だった。⇒ 母数は「判断に効く区分」（実装・データ・`docs/design/`）で取り、`docs/` は件数ではなく「歴史記録である」という性質で扱うほうが安定する。**
    4. **★設計卓への伝達候補 2 件（軽微）。** **(a) 指示書 §2.1 の括弧書き「`character_data/` 2 件（`terry.csv` の `quick_burn_light` と `quick_burn_od` の対）」は実物と違う**——`quick_burn_light` の grep が当たる 2 件は `terry.csv` L32 と `command-correction-history.md` L15 であり、`quick_burn_od` は `quick_burn_light` を含まない。**件数は合っているが内訳が違う。** **(b) `DES-004` §2.1 の必殺技パターンは `<技名>_<強度>` だけを挙げており、`sonic_break` / `quick_burn` のような「強度の区別が無い必殺技＝`<技名>` 単体」の形が表に無い**（特殊技の行から類推はできる）。**⇒ 本型の誤りは今回で 2 例目であり、表に 1 行あれば入力時に防げる。**
### M29-02: 入出力（CSV ／ バックアップ・復元 ／ 下書きの往復）（2026-09-07）

- **結果**: `go test ./...` ／ `pnpm test`（2480 件）／ **`make e2e` 全数（247 passed・リポジトリルート実行）** とも緑。常設検査は `check-artifact-integrity.sh` を 1 本目に回して全数緑（`check-md-emphasis.sh` のみ着手前から赤・**本サブ寄与 0 行**）。**マイグレ 0 本・CHANGE 自採番 0 件・スキーマ変更 0・新規依存 0。** **★★上限の値は 1 つも変えていない**（指示書 §2.1-5）。**鳴らし方は開発者選択の (c)「件数を示して選ばせる」／ `VAL-C09` は開発者選択で ERROR へ揃えた。**
- **報告**: 完了報告 `docs/progress/M29-02-completion-report.md` ／ レビュー `docs/progress/m29-02-review.md`
- **レビュー**: 15 件（高 3 / 中 6 / 低 6）。**★「高」指摘の不採用は 0 件**（3 件とも採用）。再レビューの往復 0 回・§J 記録なし。
- **★実機確認（2026-09-07・開発者実測。製造は実 DB を持たないため測れない箇所）**: `GET /api/combos?limit=2` が **`count: 2` / `total: 86`** ／ 書出の観測ヘッダ **4 本とも出た**（`X-Export-Total: 86` / `Included: 86` / `Truncated: false` / `Reimport-Blocked: false`）／ **実データの往復は問題なし**。**★★コンボ総数は 86 件で 100 件を超えていなかった**——照会時の回答は「超えている可能性がある」だったが実測は 86。**⇒ 一覧の暗黙 100 件は現時点では発火していない。★観測自体は件数に依らず効いている。**
- **★追加（2026-09-07・開発者要望）**: **確認ダイアログの E2E を新設**（`m29-02-export-truncation.spec.ts`・3 件）。**★★101 件を投入せず `page.route` でブラウザコンテキスト単位に倒した**（`D-466` / `E-142`）——**投入すると共有 DB を 100 件で埋め、一覧を見る他ファイルを道連れにするため**。`make e2e` は 247 → **250 件で全数緑**。破壊確認も実走（`total` → `count` で切り捨て側 2 件が赤・対照 1 件は緑）。
- **★開発者確定（2026-09-07・完了報告後）**: **`setup_file` が 10MiB を超えたら取込を止める**（逐語＝「10MiB を超えたら取込停止でいいです」）。**⇒ 製造の暫定判断 (a) と一致したため実装の変更は無い。★レビュー中-3 が指摘した「選定者が不明」は解消した。**
- **★横断課題**:
    1. **★★「判定関数の単体テスト」と「呼び出し側のモックテスト」が両方在っても、その 2 つを繋ぐ配線は無観測でありうる。** 本サブの破壊確認（チェックリスト §6-1 を 5 経路それぞれで実走）で **2 件**見つかった——(a) 書出↔取込の上限の非対称の判定は、構造体の単体テストと「ヘッダに手で値を入れた」テストの両方が在ったのに、**判定を殺しても 1 本も赤くならなかった**（実際に計算しているかは 1 度も観測されていなかった）。(b) FE 生成書出の配線は、`ExportDialog` のテストが `runExport` をモックしているため呼び忘れても緑のまま通った。**⇒ 一般形＝経路ごとに「殺して赤を見る」以外に、この型を検出する手段は無い。★インラインの比較は境界を主張するテストが書けないため、抽出してはじめて観測が付く。**
    2. **★★`DES-002` §7.6 の後方互換の約束と `VAL-C15` が緊張関係にある**（開発者判断が要る）。同節は「旧 CSV（消費列なし）を後方互換で受理する」と定めるが、**`M27-02b` 以降、消費ゲージが空の本登録行は確定で必ず落ちる**（本サブが実測で確認）。**⇒ 列の不在は受理するが、値の不在は本登録では受理しない。★本サブが作った状態ではなく `M27-02b` 以降そうだった。⇒ 明記が無いままだと「旧 CSV は取り込める」と読んだ担当が、実際には取り込めない行を作りうる。** 反映先は完了報告 §11-7。
    3. **★★`docs/design/06-validation.md` §6 の注記が失効した**（`VAL-C09` を ERROR へ揃えたため）。**★「撤回済み・失効した記述」型であり、レビュー基準では「高」に当たる。** あわせて同節の「file レベルエラーは現状 英語のまま〔将来 BE 小改修で日本語化＝保留〕」も本サブで解消したため失効する。反映先は完了報告 §11-1 / §11-8。
    4. **★未起票だった欠陥が 5 件見つかり、いずれも本サブで解消した**——(a) FE 生成書出（PDF/PNG/クリップボード）の暗黙 100 件 ／ (b) 編集モードの仮登録トグルが PATCH で送られない ／ (c) 書出↔取込の上限の非対称 ／ (d) `setup_file` の上限超過の握り潰し ／ (e) `combo_file` の上限超過の誤ラベル。**⇒ 「解消済みとして」の起票が要る**（`followup-backlog.md` は §J 以外を製造が編集できない＝`D-382`）。
    5. **★★指示書 §0.1 の前提が実測と食い違っていた。** 指示書は「4 群のうち 2 群が黙る」としていたが、**実測では取込・プレビューは鳴っており、黙っていたのは書出だけだった**（取込側は鳴っていたが**英語のまま出て読めなかった**）。**⇒ 「黙っている」と「鳴っているが読めない」は別の欠陥であり、直し方も違う。★逐語から想定した群の数は、実装を読むまで確定しない。**
    6. **★`docs/design/testid-convention.md` の「付与済み一覧」へ 1 本の追加が要る**——`export-truncation-confirm`。同書は「新規付与時は必ずこの一覧を更新すること」と定めている。
    8. **★★「全数を数えたつもり」がレビューで 2 件とも崩れた**——(a) 重大度の非対称を 4 件で「全数」と書いたが `VAL-C09` の完全な双子である `VAL-S02` が漏れていた（**★「気づいた非対称を 1 件ずつ潰す」数え方では、気づかなかったものは最後まで現れない。⇒ 正しくは「確定側の検証器が持つ VAL を列挙して突き合わせる」**）／ (b) 「5 経路すべてに観測を付けた」と書いた直後に、その中心機能の配線が無観測だった（**★製造自身が一般形として書いた型に、製造自身が掛かっていた**）。**⇒ 一般形＝「全数を数えた」という主張は、数え方を書いて初めて検証可能になる。数え方を書かなければ、レビューも漏れを判定できない。**
    9. **★★i18n の一括編集で、隣接キーの文字列を取り違えて上書きした**（レビュー 高-1 で検出）。`"maxReached"` をファイル先頭から検索するスクリプトが `compare.maxReached` に一致し、その文面を `export.maxReached` へ書き込んでいた。**★和英で意味が割れただけで動作は正しいため、テストも lint も型検査も緑のまま通った。⇒ 同名キーが複数の名前空間に在る JSON を機械編集するときは、名前空間ごとアンカーすること**（`M29-01` が潰した型の割れを、語彙統一の次のサブが新たに作りかけた）。
    7. **★バックアップ／復元は「特定できた」で閉じた**（推測で直していない）。**問題は「未実装のまま `disabled` のボタンとして画面に出ている」ことであり、既に `backup-restore-buttons-disabled` に起票済み・状態は未決で開発者の手番**である。実装は `NFR201` の新機能であり本サブの射程外。**★`M28-01` の `internal/infra/datadir`（データディレクトリの移行）とは別物**であることも実査で確認した。
### M28-02c: `FR702` のバックエンド追補 ＋ 影響コンボ画面（2026-09-07）

- **結果**: **段 1（BE）と段 2（画面）を順に実装。テスト green**（`go test ./...` ／ `go test -tags=debug ./...` ／ `make test-web` 2477 ／ **`make e2e` 249 passed**）。**マイグレ消費 0 本**（次に払い出す番号は `000106` のまま）／ **CHANGE 消費 0 本**（契約は `CHANGE-162` が先に書いてあり、実装は契約どおり ⇒ 請求なし）／ **新規依存 0** ／ **ブラウザストレージ台帳は 1 行も動いていない**（延期はサーバ側ファイル）。**主要な確定事項＝判定式の行レベル述語を `affectedMoveCondSQL` へ括り出し、EXISTS・SELECT 派生列・列挙・`buildListWhere` 共有の `COUNT` の 4 経路をすべてそこから組んだ。★「式が 2 本ある状態を作れないこと」を `go/ast` 走査テストで構造として主張している**（取り込みで走査範囲を `internal/` 全体へ拡張）。**レビュー指摘 13 件（重大 0 / 高 4 / 中 4 / 低 5）のうち 12 件を採用、★「高」の不採用は 0 件。不採用は低-5 の 1 件のみ**（理由は横断課題 3）。**再レビュー往復 0 回。** 破壊確認 3 件は「壊して赤を見て、戻して緑を見た」で実走。
- **報告**: 完了報告 `docs/progress/M28-02c-completion-report.md` ／ レビュー `docs/progress/m28-02c-review.md`。着手基点は `233f48e`。
- **★横断課題**:
    1. **★★`docs/design/` に「★未実装」の注記が 4 か所残っており、本サブの実装で失効した**〔`DES-002` §4.2 の経路 3 行 ／ `DES-005` §5.19b 冒頭と見出し ／ `DES-005` §5.6 の注記 ／ `CHANGE-162` §0〕**。⇒ 契約そのもののずれは 0 件であり、失効したのは「まだ実装されていない」という記述だけである。★製造は `docs/design/` を編集しない**（`CLAUDE.md` §8）**ので設計卓の手番として残す。★放置すると次の担当が「まだ実装されていない」を前提として読む**（レビュー較正で「高」に当たる型）**。詳細は完了報告 §11。**
    2. **★★E2E から `FR702` の状態を作る経路が本番には無い。⇒ debug ビルドの書き込み口を足し、E2E バックエンドを `go run -tags=debug` にした**（2026-09-07 開発者確定）**。判定は `moves.last_changed_game_version` が非 NULL であることを要求するが、マーカーを立てる経路は DML マイグレしか無く、`PATCH /api/moves/{id}` も対象外・既存 debug API は read-only であった。★★しかも `D-725` により初回は必ず 0 件であり、「画面を開いても何も出ない」ので動かして確認したことが証拠にならない。★代償＝E2E が本番ビルドではなく debug ビルドを検査する**（差分は debug ルート 6 本の登録だけ）**。★一般形＝「テストで作れない状態」は仕様の穴ではなく観測の穴であり、観測の口を先に作らないと破壊確認そのものが成立しない。**
    3. **★`LEFT JOIN preset_aliases` で同一 move × 同一 preset に alias が複数あると列挙が重複する**（レビュー低-5）**。★本サブ由来ではない**——既存の `findMoveLabelsByIDs`（`internal/repository/combo/repository.go`）が同じ JOIN 形である。**⇒ 直すなら両方を同じ手番で直すのが筋であり**（片方だけ直すと同じ名前解決が 2 つの流儀を持つ＝`E-76` の型）**、本サブでは不採用とした。★現状の `official_ja_move` は move ごとに 1 件を想定した運用のため実害は出ていない。**
    4. **★★`check-md-emphasis.sh` はコードフェンス（```）を認識しない。⇒ フェンス内の `/**` は構造上かならず偽陽性で当たる。** 本サブのレビュー報告書がコードを引用した 1 行で +1 した（495 → 496）。**★インラインのコードスパンは正しく除外されるが、フェンスは「1 行ずつ描画」する実装の性質上そもそも見えない。★検査を通すために報告書の本文は書き換えていない**（引用としては正しい記述である）**。⇒ 検査側の限界であり、ベースライン更新と併せて改善レーンの手番**（`D-335`）**。★なお着手前から 495 行で赤であり、その 59 行は本サブ由来ではない**（実装コミットの時点で `.md` を 1 行も触っていない）**。**
    5. **★★エラー契約は「書いた」だけでは実配線で到達可能とは限らない**（レビュー高-2）**。本サブは 503 `database_busy` をセンチネルで定義し、テストもセンチネルを直接注入して緑にしていたが、実配線ではリポジトリのエラーを翻訳する層が無く到達不能だった。⇒ `dbinfra.IsBusy` でも判定する形へ直し、実 DB で起こした本物の busy エラーから 503 になることを主張するテストへ置き換えた。★一般形＝センチネルを注入するテストは「契約が在る」ことしか示さない。「契約に届く」ことは、本物のエラーから作らないと示せない。**
    6. **★「押しても何も起きないボタン」は、警戒していない側の列に出る**（レビュー高-1）**。本サブは「取得失敗を 0 件にしない」「ボタンだけ黙って消さない」を繰り返し守ったが、専用画面で `ComboTable` を再利用した結果、`onDelete` に no-op を渡した［削除］が押しても何も起きない形で残っていた。⇒ `onDelete` を optional にし、渡されない面では描かない形へ直した。★一般形＝共有部品を再利用するときは、必須 prop に no-op を渡した箇所を疑うこと。**

### 20260907-improvement-lane-c1-c3: 改善レーン C1〜C3（`scripts/` と `.claude/` の 3 件）（2026-09-07）

- **結果**: **C3（`check-md-emphasis.sh` の案 A・`D-761`）の三部と C2（`D-764`）・C1（`D-766`）をすべて実施。常設検査 7 本は出力で判定して緑。** **ベースラインは 436 → 247**（旧範囲 6 ディレクトリ・778 ファイルの実測 496 − `docs/progress` の 249 ＝ 新範囲 5 ディレクトリ・563 ファイルの 247）。**マイグレ消費 0 本 ／ CHANGE 消費 0 本 ／ 新規依存 0 ／ ブラウザストレージ台帳は 1 行も動いていない。** **完了条件への追記は 5 本入り、足せなかったものは無い**（`implement_plan` ／ `implement_plan_full` ／ `incorporate_plan` ／ `review_plan` ／ 指示書テンプレート §7.4）。**破壊確認 2 件は実測で成立**（常時走査は `docs/progress` のプローブに反応せず 247/247 で緑・`--list` にも現れない ／ 同じファイルをファイル引数モードへ渡すと検出 1 行・exit=1。陰性対照は exit=0）。
- **報告**: 完了報告 `docs/progress/20260907-improvement-lane-c1-c3-completion-report.md` ／ **設計伝達レポート** `docs/handover/design-reports/20260907-improvement-lane-c1-c3-design-exceptions.md` ／ レビュー **（本レーンはレビュー工程を持たない。⇒ 設計卓が設計伝達レポートを畳む形＝`D-382`）**。着手基点は `2468099`。
- **★横断課題**:
    1. **★★床の値がレンダラの版に依存する。⇒ 開発者の devContainer での実測が 1 度要る。** 開発者が 2026-09-06 に測った **1,052 行**（747 ファイル）は本環境で再現せず、本環境の旧範囲は **496 行**（778 ファイル）であった。**いっぽうリポジトリ側の記録値とは完全に一致する**〔`M28-04` の 494 → `M28-02c` の 495 → 496 ／ `retrospective-digest` 41 ／ `M21-RESEARCH-01-report` 40 ／ `M26-02-completion-report` 40〕**。⇒ 外れ値は 1,052 のほうである。** **★同じ理由で保留 `P-52`**（`main` 側の `parallel-board.md` に閉じない強調が 105 行）**も再現しない**——本環境の同ファイルは **0 行**で、設計卓ツリーの実測と一致する。**⇒ `P-52` は「マージ解決の破損」ではなく測定環境の問題である可能性が高い。★疑われるのは markdown-it-py の版差**（本環境 4.2.0 / Python 3.11.15。devContainer は Debian の `python3-markdown-it`）**。★版を固定するかどうかは `CLAUDE.md` §6 の事前提案が要るため、本手番では判断していない。**
    2. **★フェンス内偽陽性の内訳を数えた**（`followup` の `md-emphasis-check-fenced-block-false-positive` が求めていた件）**。新しい床 247 行に偽陽性は 0 件、外した `docs/progress/` の 249 行に 68 件（27%）。⇒ 案 A は偽陽性の主部を常時走査の外へ出す副次効果を持ち、床を押し上げる作用が消えた。★ただし消えてはいない**——書き込み時モードは `docs/progress/` を 1 ファイルずつ見るため、**コードを逐語引用したレビュー報告書は今後も落ちる**。**⇒ CLI へ足した節に「逐語引用が理由で直せない行は、直さずに完了報告へ 1 行残す」逃げ道を明記してある。**
    3. **★新マーカー `<!-- COMPLETION-REPORT-MD-EMPHASIS -->` に機械検査が無い。⇒ 5 本から黙って消えても誰も気づかない。** `<!-- PROGRESS-LOG-INDEX -->` と `<!-- STOP-DISCIPLINE -->` はいずれもマーカーの存在を見る検査を持つ。**★検査の新設は本手番の射程外とした**（投入プロンプトの射程は 3 件）**。⇒ 足すか否かは設計卓の判断。**
    4. **★指示と実物のズレが 2 件あった。** (a) **ファイル引数モードは着手時点で既に実装済みだった**〔投入プロンプトは「足してください」と述べていた〕**。⇒ 二重実装せず、挙動を実測で確かめて書き込み時モードとして明記した。** (b) **`app_build_check.md` の `allowed-tools` が Bash 4 種のみで `Read` を含んでいなかった。⇒ 「台帳も見る」の 1 行を足すだけでは実行時に読めず空文になるため、`Read` を追加した**（事後承認を請う）**。★あわせて同ファイルの「直接実行しても同じ出力が得られます」という補足にも、直接実行では台帳確認が回らない旨を足した**——**足さないと新しい 1 行が黙って迂回される。**
    5. **★`review_plan.md` は投入プロンプトの名指し 4 本の外だが、開発者判断で 5 本目として追加した。** レビュー報告書は `docs/progress/` へ新規ファイルを作る残りの経路であり、**実測の先例もそこである**（`M28-02c` のレビュー報告書がコードを引用した 1 行で床が 495 → 496）。**⇒ 不要なら 1 節を削るだけで戻せる。**
    6. **★`docs/process/dependency-pin-ops.md` §2 の台帳は「未実査」のまま残っている**（`nwsapi` の `pnpm.overrides` ／ `go.mod` の `toolchain` の 2 行）**。★本手番の射程は 3 件であり、台帳を埋めることは含まれていない。⇒ 次に `/app_build_check` を回す手番、または境界セッションで埋める。★本手番で C1 が入ったため、その契機は自動的に回るようになった。**
    7. **★`followup-backlog.md` の 2 行**（`check-md-emphasis-baseline-stale` ／ `md-emphasis-check-fenced-block-false-positive`）**は本手番で状態が動いたが、製造が直接書けるのは §J だけである**（`D-382`）**。⇒ 本報告を出所として設計卓が畳むこと。**
    8. **★★新運用は入れた当日に自分自身の欠陥を 1 件捕まえた。** 本完了報告をファイル引数モードへ通した 1 回目で 1 行が落ちた〔閉じ `**` の直前が全角の鉤括弧〕**。⇒ 案 A の (2) を落とせない理由の実測でもある**——**その行は常時走査の対象外のファイルにあり、(2) が無ければ誰も見ないまま残っていた。**
    9. **★★偽陽性の 2 つめの型が出た＝強調が行をまたぐ形。** `**` で始めて**次の行**で閉じる強調は、**Markdown としては正しく太字になる**が、本検査は「1 行ずつ描画」するため**両方の行で未閉じに見える**。**⇒ 既知の `md-emphasis-check-fenced-block-false-positive`**（フェンス内のグロブ）**とは別の型である。★新しい床 247 行にも入りうるが、本手番ではフェンス内の内訳だけを数えており、この型は数えていない。★どちらの型も、走査を行単位からブロック単位へ変えれば同時に消える。⇒ 作り替えの設計は 1 本で足りる。★本手番では検査を変えず、報告の側を 1 行に収める形で回避した**（射程は 3 件であるため）**。**
    10. **★★ドッグフーディングは、足した文言そのものの欠陥も 1 件出した。** `incorporate_plan` へ足した初版の文言が「新規 ＋ **書き足したファイル**」であり、**継続更新ファイル**（`progress-log.md`）**まで渡させる形になっていた。★同ファイルを渡すと 11 行が落ちるが、行番号で切り分けると 11 件すべてが既存行**（本手番の追記は 5599 行目以降、検出は 3152〜4483 行目）**であり、歴史記録として直さない行である**（`D-274` (3)）**。⇒ 入れた直後から「回すと必ず赤いので、誰も回さなくなる」経路を作りかけていた。★4 本すべての節と指示書テンプレートへ但し書きを足して直した**〔(a) 継続更新ファイルは渡さない ／ (b) 検出が出たら行番号で「自分が書いた行か」を判定し、自分の行だけを直す〕**。★一般形＝「書いた本人が見る」型の検査は、渡す対象を「本人が作ったもの」に限らないと、既存の汚れごと本人へ請求してしまい、初回から死ぬ。**

### M30-01: 仮想コントローラの技の出し分け（何を出すか）（2026-09-08）

- **結果**: **`go test ./...` 緑 ／ `pnpm test` 緑（219 files / 2568 passed）／ `make e2e-only P=m30-01` 5 passed。マイグレ消費 0 本 ／ CHANGE 消費 0 本 ／ 新規依存 0 ／ ブラウザストレージ台帳は 1 行も動いていない。** **★最初の成果物は実装ではなく実測である**——**seed 全 31 キャラ 2743 行のうち、着手時点で仮想コントローラのどの面からも入力できない技は 456 行あり、理由は 5 区分に全数が収まった**〔A 強度接尾辞なし必殺技 291（`CHANGE-166` の意図された設計）／ B ターゲットコンボ 126（タブが無い）／ C `rush_variant` の孤児 5（データ）／ D 段階1/2 で解決しない `normal` 17 ／ E 共通技行の 6 code 以外の投げ 17〕**。「理由が読めない」区分は 0 件。** 出し分けの規則を `web/src/features/combo/moveSurfacing.ts` の 1 本へ集約し、タブを 4 → 7 枚にして（ターゲットコンボ ／ 未掲載 ／ キャラ固有状態）未掲載は 456 → 330 行になった。全技一覧側（`SM-100`）は同じ述語の裏返しを使う。
- **報告**: 完了報告 `docs/progress/M30-01-completion-report.md` ／ レビュー `docs/progress/m30-01-review.md`
- **★横断課題**:
    1. **★★`make e2e`（全数）が 1 件赤い。`web/e2e/m24-12-editor-rebuild.spec.ts:31`「(3) 保存直後の遷移では確認が出ず、かつ編集画面へ戻らない」であり、本サブ由来ではない。** 初回の失敗は「戻るを 2 回押しても起点（ホーム）へ戻れない＝履歴に編集画面の複製が残っている（保存後の遷移が離脱ガードの補正を通っていない）」で、**再試行時に出る「重複コンボの警告」は二次被害である**（初回でコンボが作られた後に落ちるため再試行の保存が `VAL-C02` に当たる）。**★着手基点 `50235ce` の内容へ `web/src` の変更 14 ファイルを戻し新規 6 ファイルを削除した状態で同じ 1 本を回し、同一エラーで再現することを実測した。⇒ 行き先の判断が要る**（本サブの射程外のため直していない）。**★2026-09-08 追記: 開発者が修正案の採用を判断したため本サブで直した**（`612d648`）——**根本は `web/src/App.tsx:32-34` が PC 幅（`isMobile` は `max-width: 639px`）で `/` を `/combos` へ `replace` すること**であり、起点にホームを置いた spec の `toHaveURL(/\/$/)` が競合していた。**⇒ 起点をリダイレクトの無い `/settings` へ移し、着いたことを確かめてから編集画面へ進む形にした。実測 `make e2e-only P=m24-12` 5/5 緑・破壊確認（起点を `/` へ戻すと (3) だけ赤）済み。★`M27-01`（本ログ 5354 行）・`M28` 系（同 5514 行）が「実行順に依存する既存の不安定さ」として 2 度見送っていた同一の spec であり、原因は順序依存ではなくリダイレクトとの競合だった。**
    2. **★★設計卓への請求が 1 件ある＝必殺技ファミリー UI の拡張**（`DES-004` §2.1 ／ `DES-005` §5.7）**。強度接尾辞を持たない必殺技 291 件のうち 95 件は `<code>_od` が同じキャラに別行で在り、画面上はファミリー名のボタンが出て OD だけが押せる状態になっている（24 キャラ）。⇒ これが `P4M-017` の逐語「必殺技が一部しか出ていない」の実体である。★設計書が名指ししていた 2 件**（`guile/sonic_break` ／ `terry/quick_burn`）**はこのうちの 2 件にすぎない。★開発者判断（2026-09-08）＝「ファミリー UI を拡張する。ただし方法は改めて検討し、設計卓へ請求する」。⇒ 本サブでは規則を 1 行も変えていない。**
    3. **★`CHANGE-166` の帰結文 1 行が失効した。** 同 CHANGE は「強度接尾辞を持たない `move_code` は…⇒『全技一覧から選ぶ』プルダウンからの入力になる」と書いているが、**未掲載タブができたため入力経路はプルダウンだけではなくなった。★ファミリー UI に載らないという規則そのものは不変である。**
    4. **★`docs/design/testid-convention.md` へ新規 `data-testid` 7 種の登録が要る**（`recipe-tab-target-combo` ／ `recipe-tab-hidden` ／ `recipe-tab-character-state` ／ `recipe-target-combo-{code}` ／ `recipe-hidden-{code}` ／ `recipe-character-state-{code}` ／ `recipe-omit-surfaced-toggle`）**。`/add_e2e_spec` は同ファイルの更新を求めるが、`CLAUDE.md` §8 と指示書 §4-9 が製造による `docs/design/` の編集を禁じているため回した**（§8 が優先＝`CLAUDE.md` §9 の注記）**。★レビューの実査によると、同一覧には既存の `recipe-tab-*` / `recipe-direct-*` / `recipe-dir-*` も載っていない。⇒ 併せて棚卸しする価値がある。**
    5. **★★データ是正の候補が 1 件（2026-09-08 開発者裁定で向きが確定）。`ryu` の `axe_kick_2`（unique）と `rush_axe_kick`（rush_variant）が対応せず、`resolveRushByCode` が引けないため `rush_axe_kick` はどの面からも入力できない。★誤っているのは `axe_kick_2` の側である**（開発者の逐語＝「`axe_kick_2` 側の方が誤り。`axe_kick`、`rush_axe_kick` が正しい」）**。⇒ 是正の向きは `axe_kick_2` → `axe_kick` へのリネームであり、`rush_axe_kick` は触らない。★DB 修正は設計卓への申し送りとする**（開発者指示）**。★`move_code` は `preset_aliases` の解決キーであるため、リネームには別名・既存レシピの追随が要る**（`DES-004` §2.1 の警告）**。**
    6. **★「高」指摘の不採用は 0 件である**（レビュー「高」4 件はすべて採用した）。**★不採用は「中」1 件・「低」2 件のみで、いずれも理由をレビュー報告書末尾の取り込み結果へ記録した。**
    7. **★`M30-02` との境界。新タブ 3 枚の `data-testid` は既存規約に従って新規採番しただけであり、既存の割当は 1 つも動かしていない。⇒ `M30-02` が並び順・数字キーを決めるとき、この 3 枚も対象に入る。**
    8. **★★【取り込み後の追補】区分 A 291 件は 2 つの別問題に割れる**——**A1 186 件**（`move_code` のどこにも強度語が無い。`tenshin` / `sonic_break` 等。`CHANGE-166` が明文化した設計そのもの）**と A2 105 件**（**強度語は在るが `code` の途中に在るため `parseSpecialCode` が末尾しか見ずに落とす**。`lightning_beast_light_rolling_attack` / `flame_od_kachousen` 等）**。★A2 はすべて「キャラ固有状態の強化版必殺技」であり、開発者の逐語**（`P4M-008` (a)「強化版必殺技等」）**が指していた対象そのものである。⇒ §6-1 の請求は 2 本に割れる**——**A1 は規則どおりだが、A2 は弱中強 OD が揃っており「状態接頭辞を剥がしてからファミリーを導く」形なら 1 ファミリーとして載る。★別の判断になる。**
    9. **★★キャラ固有状態タブ**（`P4M-008` (b)）**の軸が A2 の接頭辞と一致していない。** 現行は `custom_states[].code` の部分一致だが、**`mai` は状態 code が `flame_stock` で技の接頭辞が `flame_` のため 1 件も当たらない**（同型＝`m_bison` の `psycho_mine_is_set` ↔ `mine_set_`）**。逆に `cammy` は `custom_states` を 1 つも持たないのに状態版を 12 件持つ。⇒ 軸を A**（現行）**/ B**（接頭辞）**/ C**（和）**のどれにするかは開発者判断であり、完了報告 §8.1 (2) に置いた。★どれも新しい列を要さず、述語 1 本の差し替えで済む。**
    10. **★★★【2026-09-08 訂正】実測の母集団を取り違えていた。** 私は `character_data/*.csv`（2743 行）を数えたが、**正しい母集団は `moves` テーブル（3026 行）である。⇒ 未分類は 330 行ではなく 551 行だった。** 差の 283 行はマイグレーションが直接投入する行で、大半は**移動系 system 技 217 行**〔`forward` / `back` / `micro_*` / `jump_*` の 7 code × 31 キャラ。`000025_seed_movement_system_moves_all` 等〕**。★この 217 行はどの面にも出ておらず、開発者の実機確認まで誰も検出していない。★あわせて「`dash_forward` / `dash_back` は seed に無く押しても何も起きない」という報告も誤りである**（実 DB に 31 キャラぶん在り、実機で押せる）。**★★誤った母集団を回帰テストで固定してしまっていた。⇒ テストが在ることは確からしさの証明にならない。** 是正として roster test の冒頭へ母集団の限界を明記し、**「共通技 13 code のうち CSV に在るのは 4 code だけ」** を新たな主張として固定した。**実 DB での件数は E2E が実サーバ越しに主張する。**
    11. **★★開発者判断 4 件を反映した**（2026-09-08）。**(a) 共通技タブを新設**〔13 code ＋ 生ラッシュ。タブ外の常設行から移設し、常設行は削除ボタンだけ残した〕**／ (b) 「未掲載」→「未分類」へ改称**〔現に掲載されているため〕**／ (c) 案 C＝キャラ固有状態タブを掲載済みに数える**〔未分類との重なり 45 件が消えた〕**／ (d) 案 A′＝状態 code の語幹でも照合**〔舞 0 → 26 件〕**。⇒ 実 DB の未分類は 551 → 251 行。**
    12. **★★【2026-09-08 実機確認で判明】必殺技タブに「状態版の必殺技」が 1 ファミリーだけ混ざる**（開発者の逐語＝「Jamie の必殺技に、酔いレベル4の流酔拳だけ固有状態技なのに出ていました」）**。★根っこは A2 と同じ「命名の揺れ」である**——**強度語が `code` の末尾に在れば必殺技タブに載り、途中に在れば載らない。⇒ 同じ「状態版必殺技」なのに、書き方の違いだけで扱いが割れている。** 実例＝`jamie` の **`drink_level_4_freeflow_strikes_{light,medium,heavy,od}` 系 12 行**〔接頭辞 ＋ 技名 ＋ **末尾**強度 → **必殺技タブに載る**〕 と `blanka` の `lightning_beast_{light,…}_rolling_attack`〔接頭辞 ＋ **途中**強度 ＋ 技名 → 載らない〕**。★本サブでは規則を変えていない**（指示書 §0.4-2）**。⇒ A2 の請求と同じ束で設計卓へ出す。**
    13. **★★`aki` の固有状態タブが空なのは正しい。** `custom_states` の定義が **`subject: "opponent"`**（毒状態＝**相手に付与する状態**）であり、**`aki` 自身の技コードに `poison` を含む行は 1 件も無い**（実測 0 件）。**★定義を持つ 14 キャラのうち `subject: opponent` はこの 1 件だけである**（`DES-003` §3.2 が名指しで例示している）。**⇒ 案 D へ移っても救う対象が無い。**
    14. **★`m_bison` は空ではなく 1 件出る**（`psycho_mine_auto_detonation`。語幹 `psycho_mine` に当たる）**。★製造が「空」と説明したのは誤りである**（実測値は 1 件と出していたのに、説明で 0 と書いた）。**⇒ 案 D の対象として残るのは「`mine_set_*` の 9 行が拾えていない」ことであり、「タブが空」ではない。**
    15. **★共通技タブの位置は一番右である**（2026-09-08 開発者の実機確認を経た指示）**。⇒ 製造は当初「通常技の次」に置いたが、開発者判断で末尾へ移した。**
    16. **★案 D への申し送り**。案 A′ でも救えないキャラが 2 体残る——**`aki`**〔状態 `poisoned` に対応する技名が無い〕**と `m_bison`**〔状態 `psycho_mine_is_set` に対し技は `mine_set_*` で語順が違う〕**。⇒ この形が増えるなら、`custom_states` の各 state に「技コードの接頭辞」を持たせる案 D へ移る**（`DES-003` §3.2 の構造変更のため設計卓の判断が要る）。
    17. **★`DES-005` §5.7 の入力の骨格に触れた**。共通技を常設行からタブへ移設したのは開発者の明示指示（2026-09-08）だが、**指示書 §4「やらないこと」-1 が挙げた面である。⇒ 設計卓へ as-built として伝達が要る。★あわせて物理入力の点灯**（`M21-03` §4.4）**は `DirectSpecPanel` へ `held` を通して保った**——渡さなければ静かに消える面であった。
    18. **★`moveSurfacing.roster.test.ts` は seed CSV の実値を 5 か所に固定している**（2743 / 330 / 内訳 291・5・17・17 / 126 / 95 / 31 キャラの表）**。意図は「この前提が崩れたら件数がずれる。それが検出したい変化そのものである」だが、⇒ DLC キャラ追加や seed 是正のたびに数え直す運用が要る。**
### M31-01: セットプレイ ＋ 確定反撃 ＋ 起き攻めの連動（2026-09-08）

- **結果**: `go test ./...` **58 パッケージ ok / FAIL 0** ／ `pnpm test` **218 ファイル・2529 テスト pass** ／ 型検査 0 件 ／ **消費マイグレ 0 本・消費 CHANGE 0 本**（★どちらも自採番していない＝`D-293`）。**★★中心の 2 件が確定した**——(1) **`materialize` が `VAL-C15` を通らない穴を塞いだ**〔陽性対照と対。着手前は「必須 4 欄が空の**本登録**コンボが生成できる」ことを probe で実測〕／ (2) **`SD-006` の連動を入れても `VAL-C11` は実質死んでいない**〔**連動が片方向であるため、ドライブラッシュ版を先に押す経路が 1 クリックで残る**。他に既存行の編集・CSV 取込〔独立実装〕・API 直叩きの計 4 経路〕。**★「違和感」の正体は候補 1（`VAL-C11` そのもの）と判定した。★重大度・文言は 1 文字も変えていない。**
- **報告**: 完了報告 `docs/progress/M31-01-completion-report.md` ／ レビュー `docs/progress/m31-01-review.md`（**指摘 17 件＝高 5 / 中 6 / 低 6。★★「高」の不採用は 0 件。採用 13 / 不採用 3〔低のみ・理由は報告書末尾〕/ 持ち越し 1〔E2E〕。再レビュー往復 0 回**）
- **★横断課題**:
    1. **★★`DES-006` §2.1 `VAL-C15` の記述が失効した**——同行の「`Materialize`（確定反撃からの生成）は本 VAL を通らない〔抜け穴〕」は、本サブが塞いだことで真でなくなった。**⇒ CHANGE を請求する。★撤回済みの記述が設計書に残る型であり、優先度は「高」相当である。**
    2. **★`DES-005` §5.21 への追記が要る**——第 3 セクションの**内側**を ①反撃に転用可能 / ②再利用可能 へ割った（**骨格＝両タブ共通・画面下部・折りたたみ・3 つ目のタブにしない は不変**）。**⇒ CHANGE を請求する。**
    3. **★`web/CLAUDE.md` §1 #6 の記述が失効する**——`combo-list-filters-v1` の読み手が **3 面 → 5 面**（確定反撃サーチ／マイリストが加わった）。**新キーは足していない。台帳本体はまだ書き換えていない**（`CLAUDE.md` §10.X が CHANGE 経由の追記を求めるため）。**⇒ CHANGE / addendum を請求する。**
    4. **★★`P4M-023` は DB に及ぶ。⇒ マイグレ 1 本の請求が要る。** `characters.custom_states` は **`M14` レーンが触る面**であり（直近＝`000093` / `000094`）、**払い出し時に `ls migrations/` の実査値との突合が要る**（`E-114`）。**★実測で穴を特定した**——`DES-003` §3.2 が名指しする「JP・ベガ・ブランカ」のうち **JP だけ `custom_states` が空**である（ベガ＝`psycho_mine_is_set` / ブランカ＝`blanka_chan_bomb`）。**JP は seed 済み**（`moves` 84 件）であり、`M14` の未 seed 待ちではない。
    5. **★★`setup_only` は列もデータも「活用」の前段で止まっている**（`P4M-005` の実測）——**`setup_only = 1` の技は 0 件**であった。**⇒ 出し分けを実装しても何も変わらない。データ投入（`M14` レーン）が先である。★`followup` の `camy-od-hooligan-derivations-unregistered` は「再開条件＝`setup_only` が機能すること」で保留されており**（`D-724`）**、本件はその前提にあたる。**
    6. **★`phase4-overview` §3 / §7.1 に会計の食い違いが 1 件ある**（`M31-overview` §2.2 の「2 件のずれ」の追跡結果）——**同じ段落が「`P4M-012` / `P4M-013` を引く」と書きながら、合計を「12 前後」のままにしている。** 反映すれば 10 だが、**その 10 は両者を除いた 10 であり、`M31-overview` の 10（両者を含む）とは内訳が違う。★差 2 件のうち 1 件は特定した**（`followup` の `punish-list-di-punish-counter-tab-placement`）**、もう 1 件は特定できなかった**（`M-128` の運用）。
    7. **★仕様未定の 2 件は案の提出で止めた**（指示書 §3・完了条件 8）——`SM-098`（確定反撃での D リバ。**★`M18` 系の指示書・完了報告に「リバーサル」の記載が 0 件であることを実査で確認した**）／ `P4M-005`（`setup_only` の活用）。**⇒ 設計卓の回答を得てから実装する。**
    8. **★★E2E は回せた。⇒ 「本コンテナで実行できない」は試さずに書いた誤りであった**（2026-09-08 に是正）。`Makefile:111-121` はクラウド実行で `playwright install` が 403 になる問題を回避するため `/opt/pw-browsers/chromium` を自動解決する作りであり、その実体は在る。**★★回したところ 2 件が落ちた**〔`m15-01-metadata-testid`＝12 個を順に押して毎回 `toBeChecked()` を見ており、**2 個目は連動で既に付いているため押すと外れる** ／ `m27-02b-required-and-oki-states`＝**1 回の操作で対の 2 件が保存されるようになった**〕**。★Go 全件と フロント 2534 件が緑のまま、E2E だけが捉えた型である。⇒ 「回せない」と書いて渡していたら、開発者の手元で初めて落ちていた。** 是正後 **`make e2e` 全数 253 件 pass（5.2 分）**。**★★一般形＝副作用の波及先は、警告の母集団だけではない**——指示書 §4.2 は `VAL-C11` が死ぬことを警戒していたが、実際に壊れたのは**既存 spec の前提 2 か所**であった。
    9. **★★レビューが拾った最大のものは「報告の側の誤り」3 件であった**——(a) `check-import-order.sh` を回した時点が**新規テストを作る前**であり、実際は NG（101 → 102）になっていた〔是正して 101 へ戻した〕／ (b) 「双方向化すると赤になる歯止め」の**所在が誤り**であった〔実際の歯止めは FE の `★SD-006 (b)`。Go 側は BE の母集団を守るものであり、FE を双方向にしても赤くならない〕／ (c) 「curation は両方のサブセクションに残した」が**事実と違った**〔① にだけ出る。★ただし挙動は着手前と同一〕。**⇒ いずれも実装は正しく、報告だけが実物とずれていた。★実装の検査は自動で回るが、報告の検査は人が読む以外に経路が無い。★一般形＝「検査を回した時点」を報告に書かないと、後から足したものが素通りする。**
    10. **★★CHANGE 請求が 3 件 → 9 件へ増えた**（レビュー 高-2）——**`DES-002` §4.2 の 4 か所**〔`VAL-C15` 経路表の「`Materialize` ＝★走らない」／ materialize の異常応答列挙／(1-a) の「5 経路」／`DELETE /api/setups/{id}` の副作用「2 つだけ」〕**と `DES-005` の 2 か所**〔§4.3.1 の面の列挙／§5.7・§5.15 の「論理削除しても紐付けは保たれる」〕**が漏れていた。★`DES-006` §2.1 は「経路ごとの効き方は `DES-002` §4.2」と指し示しており、`DES-006` だけ直すと参照先が古いまま残る。⇒ API 契約に触れたら、契約側の設計書も数えること。**
    11. **★既存テスト 1 件の前提が失効した**——`TestMaterialize_DamageEdges/base_damage_null` のコメントは「`Materialize` は `ValidateComboForCreate` を通らない」ことをダメージ NULL の本登録が実在する根拠に挙げていた。**⇒ `MaterializeDamageBaseNull` の適用面は仮登録の基底だけに狭まった。主題を変えずに到達可能な経路へ移した。**
### M31-02: 共通画面部品 — キャラ選択の入力挙動（2026-09-08）

- **結果**: `pnpm test` 2510 件緑 ／ `make e2e` 全数 263 件緑（取り込み前後の 2 回とも） ／ CHANGE 0 本・マイグレ 0 本。**射程 2 件のうち `P4M-012` はコード変更なし（開発者裁定で恒久クローズ）、`P4M-013` は再現・修正・E2E 固定まで完了。**
- **報告**: 完了報告 `docs/progress/M31-02-completion-report.md` ／ レビュー `docs/progress/m31-02-review.md`。着手基点は `50235ce`。
- **★横断課題**:
    1. **★★指示書の射程 2 件は、着手時点で既に開発者裁定「対応不要」になっていた。** `SD-015` が `P4M-012`、`SD-016` が `P4M-013` と同一 identity であり、`M27-02a`（2026-09-02）が両方を調査して裁定を得ている。**`M27-overview.md:105` は「`M31` は `P4M-012` / `P4M-013` を持たない。⇒ `M31` の起票時に引き算すること」と書いていた**（`D-686`）**が、`M31-overview` v1.4.0 §2.1 は 2 件を identity 7 / 8 として数えたまま `M31-02` を起票している。★`M31-overview` ／ 指示書 ／ レビューチェックリストのいずれも `M27-02a` を 1 度も参照していない**（`grep` 0 件）**。⇒ `CLAUDE.md` §8 に従い着手前に停止し、開発者から新しい裁定を得た。**
    2. **★★2026-09-08 の開発者裁定が盤面に無い。⇒ 設計卓の手番。** **★同日、開発者はさらに 2 件を決着させた**〔(a) `P4M-012` を直さないまま `M31-02` を完了として**受理する** ／ (b) 盤面の訂正は**設計卓へ回す**〕**。⇒ 本項は裁定待ちではなく実行待ちである。** `P4M-012` は**恒久にクローズ**、`P4M-013` は**「もう一度調べてもらって治せるなら治したい（優先度は高くない）」**。**★リポジトリ上、この裁定は完了報告 §0 にしか存在せず、`parallel-board.md` は `D-686` が生きたままである。⇒ 正本と as-built が食い違っている。番号の採番は設計卓の手番である**（`D-293`）**。**
    3. **★★「再現しなかった」は、何を測ったかとセットでなければ意味を持たない。** `M27-02a` は `SD-016` を 6 ジェスチャで測って「再現せず」とし、機構（Radix `DismissableLayer` の `pointerdown` ＋ 内側起点ガード）まで特定して E2E で固定しており、**手続きに落ち度は無い**。**★落ちたのは、逐語の「選択が消える」を popover が閉じることだと読み、文字選択そのもの（`selectionStart` / `selectionEnd`）を 1 度も読まなかった点である。⇒ 逐語に出てくる語が実装のどの量に当たるかを、先に決めて書き残すこと。★本サブは同じ操作で再現させたが、`m27-02a` の spec は本日も 3 件緑であり、あちらの結論も同時に成立している。**
    4. **★`P4M-013` の原因は特定できていない。** 「popover の枠外へ出ると選択が anchor へ collapse する」「同じ矩形へ重ねた素の `<input>` では起きない」までは実測したが、**なぜ左と上でだけ再現するのかは掴めていない**。⇒ 原因ではなく回避（マウス主ボタンのときだけ `setPointerCapture`）を入れてあり、その旨をコード内コメントに明示した。**★4 方向を E2E で固定してあるので、Radix / Chromium の版が上がって条件が変われば赤で分かる。**
    5. **★★`web/e2e/` はどの経路でも型検査されない**（`web/CLAUDE.md` §3）**。本サブはそれを実際に踏んだ**——`deleteTags` は `CreatedTag[]` を取るのに id の配列を渡すと URL が `/api/tags/undefined` になり、`.catch()` に飲まれて**後片付けが黙って空振りする**。**★同型が `web/e2e/m27-02a-reachability.spec.ts:71` にも在り、`M27E2E-*` のタグが共有 DB へ溜まり続けている。⇒ 先行サブの spec には触れていない**（射程外）**。★`cd web && pnpm exec tsc --noEmit -p e2e/tsconfig.json` を手で回すと出る。E2E spec を書いたら 1 本回すと安い。**
    6. **★★【2026-09-08 解消】`TagSelector` に同型の欠陥が実在した。⇒ 開発者が実機で確認し、その指示で射程を広げて直した**（完了報告 §8）**。★修正後も開発者が実機で解消を確認した**〔逐語＝「ドラッグしたら治っていました」〕**。⇒ 2 部品とも実機の裏が取れている。**★実測は左と上が赤**〔`[0, 9]` → `[9, 9]`〕**であり、キャラ選択とまったく同じ形だった。** **★直し方＝回避の実体を `web/src/lib/text-drag-capture.ts` へ出し 2 部品が使う。部品そのものは統合していない**（`M27-02a` の開発者裁定。波及が 17 コントロール 対 1 面で違う）**。⇒ `useListboxKeyNav` と同じ形である。** 以下は解消前の記述： **★同型の欠陥が残っている可能性がある。射程外のため手を出していない。⇒ 測るなら独立の手番で。**
    7. **★★申し送りの見立ては当たっていたが、拾ったのは検査ではなく開発者の実機確認である。** 本体サブは `TagSelector` を「未実測・射程外」として設計伝達レポート §4-2 #2 へ出しており、**`followup` へ登録される前に開発者が実機で当てた。⇒ 登録しないまま解消できた。** **★一般形＝「未実測の疑い」を申し送るときは、確かめ方を 1 行添えると拾われるのが早い**（本件は「`m31-02` の 4 方向テストの対象を差し替えるだけ」と書いてあった）**。**

### 20260908-improvement-lane-d1-d2: 改善レーン D1 / D2（マーカー存在検査の新設 ＋ 旧ポート雛形の是正）（2026-09-08）

- **結果**: `scripts/check-completion-report-md-emphasis.sh` を新設（`--self-test` 7 対照・陽性対照は 2 系統とも実測）。`check-artifact-integrity.sh` の自己検査は 14 件 → 15 件。`CLAUDE.md` §8 へ 1 行。D2 は雛形 1 か所 ＋ spec 7 本を現行スタックへ是正し、`make e2e-only` で 11 テスト緑。CHANGE 0 本・マイグレ 0 本・新規依存 0。
- **報告**: 完了報告 `docs/progress/20260908-improvement-lane-d1-d2-completion-report.md` ／ レビュー **（未実施。本手番はレビュー工程を持たない）**
- **★横断課題**:
    1. **★★D1 の前提が事実と違った。⇒ マーカーは 4 本であり 5 本ではない。** `git log -S 'COMPLETION-REPORT-MD-EMPHASIS' -- <指示書テンプレート>` が **0 件**を返す。**⇒ テンプレート §7.4 へは「消えた」のではなく「一度も入っていない」。** **★先行資料 3 つが揃って誤っていた**〔`followup-backlog.md` の当該行「対象は 5 本である」 ／ `20260907-improvement-lane-c1-c3-completion-report.md` の表 5 行目「○」＋「節にはマーカーを置き」 ／ 同 設計伝達レポート §1-3 の見出し「5 本 ＋ テンプレートへ置いた」〕**。★実際に入っているのは手順の本文と記入指針コメントだけである。** **★一般形＝「置いた」という報告は、置かれたことの証拠にならない**（`check-artifact-integrity.sh` 冒頭の「引き継ぎ書は『すべて `--self-test` を持つ』と書いていたが、走らせたら 1 本は持っていなかった」と同じ形の再発）**。⇒ 1 回 grep すれば分かる誤りが 3 資料へ複製されていた。訂正は設計卓の手番**（本表は `D-382` により製造が書けない）**。**
    2. **★テンプレートだけ判定機序が違う。** マーカーの増減が本手番の「やらないこと」だったため、**テンプレートは本文パターン `scripts/check-md-emphasis.sh <path>` で見ている。⇒ §7.4 を書き換えるときは `TEMPLATE_RULE_PATTERN` の追随が要る。** **★恒久的にはテンプレートへマーカーを足すのが正しい**（文言依存が消える）**。⇒ 足すか否かの判断を請う。**
    3. **★★D2 の同型は 2 か所ではなく 8 か所あった**（雛形 1 ＋ spec 7）**。⇒ うち 2 か所は指示の走査式では出ない。** `grep "47318\|5173"` に掛からず **「製造環境はブラウザ未導入のため未実行」だけを持つ形**が `m12-03-oki-starter-validation` と `m15-03-recipe-input` に在った。**⇒ `grep -rn "ブラウザ未導入"` を併せて回す必要がある。★一般形＝陳腐化した雛形の複製を数えるとき、雛形の全行が同じ語を持つとは限らない。**
    4. **★`check-artifact-integrity.sh` は編集不要だった。** `find scripts -maxdepth 1 -name 'check-*.sh'` の **glob で自動発見**する。**⇒ `check-*.sh` の名で置けば既存 2 本と同じ扱いになる。★想定ではなく件数の増加（14 → 15）で確かめた。**
    5. **★`.claude/commands/add_e2e_spec.md` §3-3 が、畳んだはずの運用を今も指示している。** 同節は `testid-convention.md` の**「付与済み一覧」を Edit で更新**せよと言うが、**`CHANGE-171` がその一覧運用を畳んだ**（`D-782`）**。現行の同書は「新規付与時に本表を更新する義務は無い」と明記している。⇒ CLI が設計書に反する手順を複製している。★D2 と同型だが旧ポートの件ではないため射程外とした。起票側の判断を請う。**
    6. **★`docs/design/testid-convention.md:62` に旧ポートの原文が残る。** `CHANGE-171` は `:55` へ打消しバナーを置いたが、**`:62` の原文（47318 / 5173 ／ `reuseExistingServer: true`）はそのまま**である。**⇒ `:62` だけを読むと旧前提を信じる。`docs/design/` は編集禁止のため製造は触っていない。設計卓の手番。**
    7. **★`make e2e-only P=<正規表現>` に `|` を渡せない。** `Makefile:179` が `pnpm e2e $(P)` と**クォートせずに展開**するため、シェルのパイプとして解釈され **`Error 127` ＋ `EPIPE`** で落ちる。**★エラーが Node のスタックトレースで出るため「テストが落ちた」と誤読しうる。⇒ 回避は空白区切り**（`P="a b c"`）**。**

### M30-02: 仮想コントローラの技の選び方と見た目（強度・変種 ＋ ボタン名・配置）（2026-09-09）

- **結果**: 射程 5 件すべてに着地。`go test ./...` 緑 ／ `pnpm test` 222 files / 2657 passed ／ `make e2e` **285 passed（0 failed）**。CHANGE 0 本・マイグレ 0 本（自採番していない）。**★実測の母集団は `moves` テーブル 3026 行**（CSV ではない）。未分類が CSV 基準 330 → 144、実 DB で jamie 11 → 2 ／ mai 3 → 1 ／ blanka 12 → 2。**「`_od` だけ押せる」形が 95 → 0**。開発者判断は `P4M-016` 案 A（「強度なし通常版」） ／ `P4M-018` 案 B（変種軸へ畳む） ／ `SD-020` 射程拡大（活性条件も直す） ／ `SM-080` 現行維持 ／ `SM-149` 案 X′（横並び ＋ 空きにラッシュ）。
- **報告**: 完了報告 `docs/progress/M30-02-completion-report.md` ／ レビュー `docs/progress/m30-02-review.md`。着手基点は `4c0dcb2`。**★開発者の手動確認は完了報告 §7**（項目） **／ §8**（2026-09-09 の実機確認とその反映 6 件）。
- **★マイグレ消費**: **`000107` を 1 本消費した**（着手時点の宣言は 0 本）。**★開発者のインゲーム確認を一次源とする指示で切った。⇒ 自採番ではない**（`D-293`）。
- **★横断課題**:
    1. **★★`terry` の `move_code` `round_wave_heavy` はデータ側の誤りである。⇒ 是正はマイグレ 1 本を要し、本サブでは行っていない**（自採番禁止＝`D-293`、本サブはマイグレ 0 本）。**★`name_ja` が「ラウンドウェイブ」で強度語を持たず、`power_wave` が弱・中・OD しか持たない**〔236HP が別技のラウンドウェイブであるため〕**。⇒ 強度の概念が無い技に `_heavy` が付いている。★先例 2 件と完全に同型である**〔`sonic_break_light → sonic_break`（`000063`） ／ `quick_burn_light → quick_burn`（`000106`）〕**。★是正すれば本サブの「強度なし通常版」へ自動で合流する。★E2E に「まだ『強』のままである」陽性対照を置いてあるので、是正時にそこが赤で知らせる。**
    2. **★★`M30-03` との境界は機械で固定した。⇒ 本サブは A1（強度語がどこにも無い形・186 件）だけを広げ、A2（強度語が `code` の途中に在る形・105 件）に 1 行も触っていない。** `moveSurfacing.roster.test.ts` が「未分類に残る `special` はすべて A2 である」を主張する。**★`M30-03` §2.1 の段 1 で測り直すとき、開始点は「未分類 144（CSV 基準） ／ `_od` だけ押せる形 0 件」である**（着手時点の 330 ／ 95 ではない）。**★`parseSpecialCode` は 3 段になっており、`M30-03` が広げるのは (ii) の枝だけでよい。**
    3. **★★新設した活性条件が、実在する入力を弾いていた**（レビュー 高-2 が検出）**。`isOdVariantApplicable` が `_od` 末尾だけを見ていたため、`od` が `code` の途中に在る OD 必殺技 37 行**〔`mai/flame_od_kachousen` ／ `ryu/denjin_charge_od_hadoken` 等〕**で、着手時点にできた入力ができなくなっていた。⇒ 機能後退である。★一般形＝「禁止を足す」変更は、禁止した集合の全数を実データで数えてからでないと安全でない。★自分のテストは代表 1 件（`hadoken_od`）しか見ておらず、この形が 1 件も入っていなかった。**
    4. **★★画面の `disabled` は入口の 1 つでしかない**（レビュー 高-3 が検出）**。「既存データを外せるようにする」ための緩和が、選び直しの経路では抑止をすり抜けた。⇒ 「OD 技で選ぶ → 通常技へ変える → 追加」で、塞いだはずの状態が復活した。★確定させる関数（`handleAdd`）の側にも同じ条件を置くまで、抑止は成立しない。★テストが「選ぶ → 判定を見る」で止まっていると、この順序は通らない。**
    5. **★`.claude/commands/add_e2e_spec.md` §3-3 が、畳まれた運用を今も指示している。** 同節は `testid-convention.md` の「付与済み一覧」を Edit で更新せよと言うが、**`CHANGE-171`（`D-782`）がその一覧運用を畳んでおり、同書は「新規付与時に本表を更新する義務は無い」と明記している。⇒ 本サブは指示どおりには更新していない**（製造は `docs/design/` を編集しないため実害は出ていない）**。★2026-09-08 の改善レーン D1/D2 が同じ食い違いを既に申し送っている**（本ログ `20260908-improvement-lane-d1-d2` の横断課題 5）**。⇒ 2 サブ連続で踏んだ。CLI 側の是正は起票側の手番。**
    6. **★★新設した禁止は、禁止する集合の全数を実データで数えてからでないと安全でない**（2026-09-09 追加）。**`isOdVariantApplicable` は `_od` 末尾だけを見ており、`od` が `code` の途中に在る OD 必殺技 37 行を弾いていた**（レビュー 高-2 が検出）**。⇒ 着手時点にできた入力ができなくなる＝機能後退である。★自分のテストは代表 1 件しか見ておらず、この形が 1 件も入っていなかった。**
    7. **★★「片側だけ解消した」を「解消した」と書かない**（2026-09-09 追加・開発者の実機確認で顕在化）。**`P4M-016` は「`_od` だけ押せる 95 件」を 0 にしたが、同時に「素は押せるが OD が押せない」7 組を作った。⇒ 完了報告は前者しか書いていなかった。★逆向きの形が生まれていないかを、同じ手番で測ること。★7 組はテストで固定した**（`M30-03` が入れば 0 件になる）**。**
    8. **★★共通部品の既定が、呼び出し側の新しい使い方と衝突していた**（2026-09-09 追加）。**`ui/tabs.tsx` の `TabsList` は `h-10`（高さ固定）を持ち、`M30-01` がタブを 4 → 8 枚にして `flex-wrap` を足したとき高さを開放していなかった。⇒ 狭幅で折り返した 2 行目以降が箱の外へ出ていた。★共通部品は触らず呼び出し側で上書きした**（`h-10` は 1 行に収まる他画面が依存する既定であり、変えると波及先が読み切れない）**。★jsdom はレイアウトを持たないため、テストの判定はクラスで行うほかない。⇒ 見た目そのものはスクリーンショットで確かめた。**
    9. **★★`m31-02-tag-field-drag.spec.ts:49` は全数実行のときだけ揺れる**（2026-09-09 実測）。**単独 5 回は 30/30 緑 ／ 全数 2 回はどちらも flaky**（1 件 → 2 件）。**★本サブ由来ではない**〔差分が当該領域に触れていない ／ 本追補より前の全数実行で既に flaky〕**が、「無関係」とも言い切れない** —— 同 spec は `/combos/new` を使い、**レシピ面は `hidden` で常時マウントされている**（`ComboEditor.tsx`）**。⇒ 本サブの変更も同じページに乗る**（`display:none` なので座標はずれないが、描画の重さには効きうる）。**★次に見るなら 4 方向のうち「右」「下」だけが揺れる点。`M31-02` は「原因ではなく回避を入れた」と自ら書いており、揺れはその境界に在る可能性がある。★「flake」で片付けない。**
    10. **★`check-import-order.sh` のベースラインは下げていない。** 本サブで 101 → 100 になり、スクリプトは「下げること」と出力するが、**同スクリプトの冒頭注記が「レーンごとに測って下げてはならない」と明記している**（並走レーンが足したぶんが見えず、マージした瞬間にずれる）**。⇒ `main` へマージ後、改善レーンか開発者の手番。**
### M31-03: 一覧の列の並び ＋ 詳細への行内リンクの位置（2026-09-09）

- **結果**: `pnpm test` 2,629 件 green ／ `make e2e` 全数 282 件 green ／ `tsc` exit 0。**行内リンクをヒット種別 → ルート列へ移し、列の並びを案C**〔ルート / ダメージ / ヒット種別 / 始動位置 / 相手の状態 / タグ / 登録状態 / 備考 / セットプレイ数〕**へ確定**（開発者確定 2026-09-09。**★モックを提示して選んでもらった**）。**CHANGE 消費 0 本**（請求のみ・設計卓が起票＝`D-293`）／ **マイグレ消費 0 本** ／ **新規依存 0**。コミットは 2 件に分離〔`cad14c9` 是正 ／ `da2dd45` 並び〕。
- **報告**: 完了報告 `docs/progress/M31-03-completion-report.md` ／ レビュー `docs/progress/m31-03-review.md`
- **★横断課題**:
    1. **★★指示書 §0.2 の前提が実装事実と違った。⇒ `combo-list-columns-v1` は並びの情報を持たない**（`ColumnVisibility` ＝ boolean 9 個だけ。利用者が並べ替える手段も無い）**。⇒ 「保存済みの列設定に当たる」という本サブ唯一の重い点は、実際には存在しなかった。** **★設計卓の推し (c)〔キーをバージョンアップ〕は有害である**——**並びと無関係な ON/OFF 設定だけを捨てることになる。⇒ キーは触っていない。** **★一般形＝「保存されている」と「保存されているものが何か」は別である。⇒ 型を読むまで前提を確定しないこと。**
    2. **★★列の並びの正本は 3 か所に分かれている**〔`COLUMN_DEFINITIONS`（表示列メニューの並びと `colSpan` の計数だけ）／ `ComboTable` の見出し JSX ／ `ComboTableRow` のセル JSX〕**。⇒ 1 つだけ直すと見出しとセルがずれるが、`tsc` もテストも検出しない。** **★`ComboTable.test.tsx` へ「3 か所が一致する」検査と「検査の母集団が全列であること」の番人を足した。⇒ 以後この型は塞がっている。**
    3. **★★`DES-005` §5.4 との食い違いが 6 件ある**〔アクション欄「ルートのホバー/タップ → 全文表示」／ レスポンシブ欄「ルートはタップで全文モーダル」／ 表示項目の列挙順 ／ 表示項目の「既定」／ セットプレイ展開時の ASCII 図 ／ **コンボ一覧の「ステータス」列が §5.4 に無い**〕**。⇒ CHANGE を請求する。★#6 は本サブが作った差ではないが、§5.4 へ請求する唯一の手番であるため一緒に出す**（レビュー 高-2）**。**
    4. **★★ルート列をリンクにしたことでレシピのドラッグ選択が制限された（退行）。⇒ 開発者が実機で確認し (a) 許容する を裁定した**（2026-09-09）**。実装の変更は行っていない。** **★★製造の事前実測は 2 点 誤っていた**——**(1) 単体 HTML では「離しても遷移しない」だったが、実アプリでは文字の上で離すと遷移する ／ (2) ★文字の外を左クリックして文字の上へドラッグすると選択できる**〔＝選択手段はゼロではない〕**。⇒ 単体の再現は実物の代わりにならない。** **★「縦表示でリンク判定が複数列分に広がって見える」も正しい観測だが、原因は `fullView` で `max-w-xs` が外れることであり `M24-03` 以来の挙動である**（他の列には及ばない＝実測）**。★§J は「完了（許容）」へ更新済み。**
    5. **★ゴミ箱一覧（`TrashList`）は今も「始動状況」列にリンクを持つ。** **★「始動状況」という列は `M27-03` 以降 コンボ一覧には存在しない。⇒ 開発者の元の違和感と同じ形の面がもう 1 つ残っている**（レビュー 低-3）**。★別部品であり本サブの射程外。設計伝達レポート §4 の候補へ回した。**
    6. **★`check-import-order.sh` が「BASELINE を 100 へ下げること」と出るが、下げていない**（`D-388` ／ ボード `D-787` (1)。**`M30-01` が同じ 100 / 101 で踏みとどまった先例**）**。⇒ 3 本並列中はレーンごとに床を下げない。**
    7. **★「高」指摘の不採用は 0 件である**（実測。トリアージは `docs/progress/m31-03-review.md` 末尾）。
### M35-01: タグまわりの是正 3 件（公開前）（2026-09-09）

- **結果**: `go test ./...` 全緑 ／ `pnpm test` 223 ファイル 2623 件緑 ／ `make e2e-only P="m24-02 m31-02-tag-field-drag m27-02a"` 13 件緑。CHANGE 0 本・マイグレ 0 本・新規依存 0。**段 1（Delete のスコープ試験 3 本）／ 段 2（エラー詳細 DTO の camelCase 化＋`existing_tag_id` 削除）／ 段 3（未設定へ戻せない仕様の明文化＝実装無改変）をすべて完了。** レビュー「高」4 件はすべて採用（不採用 0 件）。
- **報告**: 完了報告 `docs/progress/M35-01-completion-report.md` ／ レビュー `docs/progress/m35-01-review.md`。着手基点は `4c0dcb2`。
- **★横断課題**:
    1. **★★破壊確認で「緑のまま」が出たとき、それが冗長ガードなのか未固定のガードなのかは、もう一段掘らないと分からない。** 本サブは Delete のガードが二重であることを実測し、行列の B-2 を「両方緑＝冗長ガードの実証」と読んで止めた。**⇒ レビューがその空白を突き、`repo.Get` を外すと他人の「使用中」タグへの `DELETE` が `409` ＋ `usageCount` を返して存在と使用件数が漏れることを実測で示した**（高-1）。**★穴の実体は `repository/tag/repository.go:222` の `CountUsage` が tag リポジトリで唯一 `userID` を取らないことであり、前段の `repo.Get` だけがそれを止めている。** 試験を 3 本目まで足して B-2 を赤にした。**★一般形＝「両方緑」は冗長の証明であると同時に、試験が届いていない領域の宣言でもある。**
    2. **★指示書の破壊確認の指定が、実装の形と合わないことがある。** 指示書 §2.1-2 は「`repo.Delete` から `AND user_id = ?` を外すと赤くなる」を求めたが、`service.DeleteTag` が `repo.Get` を先に通すため**外しても API 層の試験は緑のまま**である。**★同じ tag 経路でも `UpdateTag` は `Get` を通さないため、既存の Update 試験は 1 本で足りている。⇒ 「Update と Delete は同じ形」と読んだのが前提の外れた原因である。**
    3. **★`existing_tag_id` の「`grep --include='*.go'` が 0 件」という根拠が事実と違った**（指示書 §2.2-4 ／ followup §CC）**。実測は `internal/model/api_error_test.go:57,74,75` の 3 件である**（汎用 `APIError` テストのサンプルキー。タグ機能とは無関係）**。⇒ 削除の判断は変わらないが、根拠として引き継がれると外れる。訂正は設計卓の手番。**
    4. **★★`TagApiError.usageCount` の getter を読む本番コードが 1 か所も無い。** `TagManagementPage` は一覧の `Tag.usageCount` から `force` を決めるため 409 経路へ入らず、`useTagManagement` に `onError` も無い。**⇒ 指示書 §5-2 の「`usageCount` が画面まで届くこと」は、画面を変えずには文字どおり達成できない**（§3-1 が画面変更を禁じている）**。代替として BE の生 JSON と FE の逐語同一 fixture で両端を留めた。★これは本サブが作った状態ではなく、着手前から在る状態である。**
    5. **★`tag-val-t01-check-then-act-race` は未着手のままである**（開発者判断・2026-09-09）**。⇒ 「同じファイルを触るので安い」という前提が成立しなかった**——`internal/service/tag/service.go:34-36` の `service` 構造体は `*sql.DB` を持たず、M24-11 / M24-13 と同じ形を当てるには `tagsvc.New` のシグネチャ変更 ＋ リポジトリ Tx 面の新設 ＋ 呼び出し 3 か所の追随が要る。**★安い代替**（`UNIQUE (user_id, name)` 違反を `ErrTagNameDuplicate` へ翻訳して 409 契約違反だけ消す・約 10 行）**も提示したが不採用。フェーズ5 へ返す。**
    6. **★`m31-02-tag-field-drag.spec.ts` の 2 件が flaky である**（レビューの独立実行で観測。1 回目に `selectionLength` が 0 になりリトライで通る）**。★M35-01 とは無関係であり、本サブは同 spec の対象コードを触っていない。⇒ ドラッグ選択 spec の不安定さとして記録する。**
    7. **★`scripts/check-import-order.sh` のベースラインが実測とずれている**（レビュー時点で ベースライン 101 / 実測 100。**本サブ起因ではない**）**。⇒ 本サブが `TagManagementPage.tsx` を是正したのでさらに 1 件減る。スクリプトの `BASELINE` 更新は射程外のため次に触る手番へ。**

### M35-01 追補: タグ管理画面の E2E 追加（2026-09-09）

- **結果**: `web/e2e/m35-01-tag-management-crud.spec.ts` を新設（4 本）。`make e2e-only P="tag m24-02 m27-02a"` で **20 件緑**・既存 spec への干渉なし。**開発者の実機確認（手順 1〜4）が OK であったことを受け、同じ経路を自動化した。** 新規 `data-testid` は 0 件（既存の role / label / `color-input` で到達）。CHANGE 0 本・マイグレ 0 本。
- **報告**: 本サブの完了報告 `docs/progress/M35-01-completion-report.md` ／ 設計伝達レポート `docs/handover/design-reports/20260909-m35-01-design-exceptions.md` §5
- **★横断課題**:
    1. **★★破壊確認が「偽陽性の緑」を 1 件炙り出した。** 初版のテスト 4 は削除後に `getByRole("row")` の `toHaveCount(0)` だけを見ていた。**⇒ Radix のダイアログが開いている間は背後が `aria-hidden` になり、行がアクセシビリティツリーから消える。⇒ 削除に失敗してダイアログが開いたままでも「行が 0 件」になり緑で通る。** `force` を無効化する破壊確認（`force: usageCount > 999`）で初めて露見した。**★是正＝実際に飛んだ `DELETE` の応答を見る**（URL に `force=true` が付くこと・204 であること）**＋ ダイアログが閉じたことを先に主張する。★一般形＝モーダルを伴う画面で「消えたこと」を `toHaveCount(0)` で見るのは、モーダルが開いたままでも真になる。**
    2. **★同型の穴が「値が変わらないことを見るテスト」にもあった。** 段 3 の spec は「空にして保存しても元の値が残る」を見るが、**保存要求が飛んでいなくても値は変わらない。⇒ `page.waitForResponse` で `PATCH` が 200 で返ったことを先に主張しないと、何も起きなかったことを見て緑になる**（`E-217` の変種）。
    3. **★トーストの重複が strict mode violation を起こしうる。** 1 テスト内で保存を 2 回行うと `タグを更新しました` が 2 つ並び `getByText` が 2 要素に解決する。**⇒ トーストで待たず、行の内容（auto-retry する）で待つ形にした。**
    4. **★`mycombo_status` の seed タグは、タグ管理画面で編集・削除できない**（`TagListTable.tsx:103` が同カテゴリを分岐で除外）**。⇒ 削除経路の spec には利用者作成タグを使う必要がある。**
    5. **★★`409 tag_in_use` は現状維持で決着した**（開発者・2026-09-09）**。逐語＝「画面で 409 が起きないなら、API の仕様はあまり気にしません」。⇒ followup `tag-delete-conflict-silently-swallowed` は優先度 低へ。** 詳細は設計伝達レポート §4-2。
    6. **★`docs/design/testid-convention.md` は更新していない。** `CHANGE-171` が一元管理を畳んでおり、同書 `:66` が「新規付与時に本表を更新する義務は無い」と明記している。**⇒ `.claude/commands/add_e2e_spec.md` §3-3 が指示する「付与済み一覧の更新」は失効した手順である**（改善レーン D1/D2 の申し送り 5 と同一件。**本手番で 2 度目の遭遇**）。
### M34-01: 実査と移植と OS 分離（Windows 用の足場）（2026-09-09）

- **結果**: `internal/desktop/`（`internal/` の既存 5 層のどれでもない新しい面）と `cmd/genicon/` を新設し、`go build` / `go vet` / `go test` が Linux で緑。`make check-windows` を新設して `pr-checks.yml` へも 1 ステップ足した。**新規依存 0 件**（`go.mod` / `go.sum` の差分 0 行）。CHANGE 0 本・マイグレ 0 本。`REUSE.toml` と `scripts/public-snapshot-manifest.txt` はいずれも差分 0 行で緑のまま。
- **報告**: 完了報告 `docs/progress/M34-01-completion-report.md` ／ レビュー `docs/progress/m34-01-review.md`
- **レビュー**: 指摘 14 件（高 4 / 中 5 / 低 5）。**「高」の不採用は 0 件**。不採用は 低-5 の 1 件のみ（`make test` から `check-windows` を呼ぶ案。**同ターゲットは「テストを走らせる」入口であり、クロス GOOS のビルド検査を混ぜると意味が変わる**ため。門は `pr-checks.yml` に置いた）。再レビュー往復 0 回。**★高 4 件はすべて「移植元の記述が本体では失効している」型であった**——`--addr` 参照 ／ workspace JSON と CSV の置き場 ／ 撤回済みの「データフォルダ」 ／ アイコンの「UI と同じアクセント色」。**動作は正しくテストも lint も型検査も緑のまま通るため、人が読む以外に検出経路が無い。★移植は この型が最も出やすい面である。**
- **★移植の出所**（`M34-overview` §3.2.5 の 3 点。**ここに残らないと公開物の出所が追えなくなる**＝指示書 §4-5）:
    1. **出所** ＝ 開発者本人の非公開リポジトリ `autopilot-combomgr` の `projects/moves-input-tool`（`internal/desktop/` の 7 ファイルと `scripts/genicon/main.go`）。**ライセンス表示は無い**——`LICENSE` / `COPYING` / `NOTICE` 0 件、`SPDX` ヘッダ 0 件、`Copyright` / `©` 0 件、`REUSE.toml` 無し、`vendor` 系 0 件、CDN・webfont・`data:base64` 0 件。**探した場所の全数は完了報告 §1 の実査 4 の表**にある。**★★母数は `git ls-files`（追跡ファイル）である。⇒ 再現には `git ls-files` / `git grep` を使うこと**——**`find` / `grep -r` だと `projects/combo-export-image/node_modules/` 配下が多数ヒットし、結論が食い違って見える**（2026-09-09 開発者の実査で判明）。**★同ディレクトリは `.gitignore` で管理外であり、かつ移植元とは別プロジェクトの依存であって、いずれの理由でも母数外である。★移植元 `projects/moves-input-tool/` に限れば未追跡物を含めても 0 件である**（Go のみで `node_modules` を持たない）。
    2. **取り込める根拠** ＝ **著作権者が開発者本人であること。** 開発者が本リポジトリの層 A（`AGPL-3.0-or-later`）として配ることを承認した（2026-09-09）。**★「ライセンス表示が無いから自由」ではない**——第三者のコードにライセンス表示が無ければ全権利留保であって取り込めない。本件が通るのは著作権者が同一だからである。
    3. **第三者由来の断片が無いことの実査** ＝ 上記の全数走査に加え、唯一の外部影響として **Win32 の定数値と構造体レイアウトが `winuser.h` / `shellapi.h` の転記**であることを記録する。著作物性のないインターフェースの事実であり `golang.org/x/sys` を含む全ての Go コードが同じ値を持つ。アイコン `icon.ico` は `cmd/genicon` の生成物で自作であり、**生成器も一緒に移植したのでソースから再現・検証できる**。
- **★横断課題**:
    1. **★★`gofmt` が着手前から赤だった。⇒ 開発者判断により本ブランチで是正した**（2026-09-09・独立コミット `d51ecd3`）。`internal/infra/migration/migrate_m1403f_test.go` と `migrate_m2703_test.go` が Go 1.19 以降の doc コメント整形規則に沿っていなかった（最終更新は `a36df63`＝`M27-03`）。**★着手基点の時点で PR CI が赤だった**——`pr-checks.yml` の `gofmt` ステップは**出力が非空なら明示的に落とす**実装である。**★放置できなかった理由＝赤が既定になると、本物の `gofmt` 違反が混ざっても気づけなくなる**（`M24-08` が 27 ファイルを静かに規約外にしたのと同じ型）。**★`M34-01` の射程外であるため別コミットに分けてある。** 変更は `gofmt -w` の機械的整形のみで**コード行の差分は 0 件**、`M27-03` の設計判断には触れていない。
    2. **★★PR CI は Windows 専用ファイルを 1 度もコンパイルしていなかった。** `pr-checks.yml` の 3 job はすべて `ubuntu-latest`・タグ無しであり、`//go:build windows` の付いたファイルは**存在しないのと同じに見える**。拾えるのは `nightly-crossbuild.yml` の `make build-all` だけで**最大 1 日遅れる**。**⇒ `make check-windows` を新設して同 job へ足した。★陽性対照を実測した**——`tray_sizes_windows_amd64.go` の構造体サイズガードをわざと崩すと `make check-windows` は赤、`go build ./...`（Linux）は**緑のまま通った**。**⇒ 本ゲートが唯一の検出経路である。**
    3. **★★クラウド実行環境に `markdown-it-py` が無い。** 素の状態では **1 本目に回す `check-artifact-integrity.sh` が赤**になり（`check-md-emphasis.sh --self-test` が「未実行」になるため）、`D-775` の閉じない強調チェックも回せない。`pip install markdown-it-py` で解消した。**既存の `followup` の `clean-clone-missing-toolchain-deps` と同型。**
    4. **★★ログと設定ファイルはカレントディレクトリ基準である。`os.Executable()` はリポジトリ内で 0 件。** 常駐化すると起動経路が増えて出先が動く。**帰結は「ログフォルダを開く」が壊れることだけではない**——`config.toml` も見つからなくなり、`internal/config/config.go:147` は**不在をエラーにせず既定値で続行する**ため、**利用者の設定が黙って無視される。★黒窓が無ければ気づく手掛かりも無い。** 是正は開発者判断により `M34-02`。案 3 つと影響範囲は完了報告 §4.4。
    5. **★設計卓の実測値が陳腐化していた。** 指示書 §2.4 と `M34-overview` §5.1.7 の `combomgr/combomgr.db` / `logs/combomgr.log` は改名前の名前であり、実物は `tacpendium` である（`M28-01`）。**DB とログが別の場所であるという結論そのものは変わらない。**
    6. **★`M34-overview` §5.1.6 の候補 2 件へ実査から回答できる。** 項目 5「DB のフォルダを開く」は**現状では意味がある**（重ならない）。項目 6「exe のフォルダを開く」は**現状ではログフォルダの親ではない**——ログの基準はカレントディレクトリであり exe の位置と無関係である。**⇒ §5.1.6 が「親ではないと分かったら、そのとき足すこと」と書いた条件に当たる。**
    7. **★★`SUPP-001` §5.2 の Go パッケージ構成に `internal/desktop/` が無い。** `cmd/` も `tacpendium` しか載っていない。**設計書の編集は製造の手番ではないので請求だけを残す。⇒ 設計伝達レポート §4 へ CHANGE 候補として書くこと。** 先例は `internal/recipehash/` を §5.2 へ足した `CHANGE-132`。
    8. **★★既定ブラウザを開く経路が 2 本になった。`M34-02` で 1 本に決めること。** 本体は既に `github.com/pkg/browser`（direct 依存）を持ち `launchBrowser` が使っている。新設の `desktop.OpenURL` は `rundll32` を自前で叩く別実装である。**★移植元の「`cmd /c start` だと黒窓が出る」という理由は本体では自前実装を正当化しない**——`pkg/browser` の Windows 実装は `ShellExecute` であって黒窓を出さない。**移植元が外部依存 0 本のリポジトリだったという前提が効いている。⇒ 両方残すと `CLAUDE.md` §6 の重複機能を持たない方針から外れる。**
    9. **★`M34-02` へ 3 件送る。** (a) 引数解釈の追加は**仕様変更にあたる**（現状は `flag.Parse()` が無く余分な引数が黙って無視される）。(b) `scripts/build-windows.ps1` の置き場に論点がある——**`scripts/**` は `REUSE.toml` の層 C（`MIT`）**であり、移植物をそのまま置くと層が変わる（本サブが生成器を `scripts/` ではなく `cmd/genicon/` へ置いたのと同じ理由）。(c) `launchBrowser` と `printStartupNotice` は `WebEmbedded` でガードされており、後者の末尾は「終了するにはこのウィンドウを閉じてください。」で**常駐化すると失効する**。
### M34-02: 常駐ランチャと黒窓の除去（2026-09-10）

- **結果**: Windows 配布 exe を `-H=windowsgui` でリンクし黒窓を消した。**★消す前に 4 段を先に着地させてある**〔段 1 ログと `config.toml` の基準を実行ファイルの位置へ一意化 ／ 段 2 未知の引数をエラーに ／ 段 3 トレイ結線とメニュー 5 項目 ／ 段 4 失敗時の `MessageBox` 経路〕**。コミットは 1 段 1 本で 6 本**（段 5 は 5 本目）。`go test ./...` は FAIL 0 件、web 2674 件緑、`make check-windows` 緑、`make e2e-only P=character-default` 2 passed。**新規依存 0 件**（`go.mod` / `go.sum` 差分 0 行）。CHANGE 0 本・マイグレ 0 本。`REUSE.toml` と `scripts/public-snapshot-manifest.txt` はいずれも差分 0 行。
- **報告**: 完了報告 `docs/progress/M34-02-completion-report.md` ／ レビュー `docs/progress/m34-02-review.md`
- **レビュー**: 指摘 19 件（高 5 / 中 7 / 低 7）。**「高」の不採用は 0 件**（19 件すべて採用）。再レビュー往復 0 回。**★高 5 件のうち 3 件は「失効した記述がコード上に残っている」型**〔`OpenURL` の godoc 1 行目 ／ `args.go` の存在しない識別子 ／ `Makefile` の門の範囲の記述〕**。★最も重いのは「門が成果物から 1 段離れていた」件**——PE サブシステム検査は `Makefile` の変数の値だけを見ており、**`build-windows` レシピから `-ldflags=` を落とすと黒窓が復活するのにテストは緑だった**。⇒ レシピ行の検査を足し、陽性対照（レシピから落とすと赤・戻すと緑）まで実測した。
- **★横断課題**:
    1. **★★★ブラウザで開く URL の origin は開発者判断が要る（未決）。** 判断 2（`D-790`）の文面は「ブラウザで開く URL だけを `127.0.0.1` にする」だが、**`localStorage` / `sessionStorage` は origin 単位**であり、着手前の `launchBrowser` と `printStartupNotice` はどちらも `localhost` を案内していた。⇒ `127.0.0.1` へ変えると `web/CLAUDE.md` §1 台帳の実装済み 9 キーが既存利用者から見えなくなる。**★とくに `keyboard-bindings-v1`（17 件）は既定を持たず全件を利用者が登録する**（`D-370`）**。⇒ キーボード入力が丸ごと未割当へ戻る。** **本サブは「着手前と同じ origin（`localhost`）」＝失うものが無い側を暫定で採り、3 導線（自動起動・トレイ・起動案内）を同じ origin へ揃えた**（`TestAppURLsShareOneOrigin` が固定）**。★待ち受けは無改変であり判断 2 の実体は守っている。⇒ `127.0.0.1` へ揃えるなら定数 1 つの変更だが、既存利用者への告知が要る。** 記録は `followup-backlog.md` §J の `tray-browser-url-origin-choice`。
    2. **★★`appDataRoots()` の許可ルートが 1 つ増えた（`AppBaseDir()`）。⇒ これは「明文化」ではなく `CHANGE-049` のパス検証（**LAN モードの未認証 `PUT /api/config` 経由の破壊的パス植え込みも封止対象**）**の許可範囲の拡張である。** 実害の増分は「ショートカットの作業フォルダが exe と別の場所」のときだけだが（ダブルクリック起動では着手前から許可されていた）、**セキュリティ検証の範囲変更として設計卓が起票すること**（`CLAUDE.md` §10「セキュリティ関連の自己判断」）。
    3. **★★画面側の終了ボタンを持たないまま `M34` を閉じてよいかは設計卓の確認事項。** 停止用の HTTP ルートは実装に存在せず、新設は認証・LAN 共有と絡む。`M34-overview` §1-6 は「画面内の終了ボタン、**または** アイコンの右クリックメニューから」と *または* で書いているため要求としては満たせているが、**`M34` は 2 段構成で本サブで閉じる。**
    4. **★★束 C-1（`MessageBox` が実際に出ること）と 束 D-1（配布 exe で黒窓が出ないこと）は Windows 実機でしか最終判定できない。** 本サブが測ったのは「失敗が `desktop.Alert` へ到達すること」と「PE の Subsystem が GUI であること」まで。**⇒ `M34` を閉じる判断は実機確認の結果を待つこと**（指示書 §5 の 4 と 5 が最も重い）。
    5. **★`followup-backlog.md` §CI の 5 件はすべて本サブで畳んだが、状態列は「未着手」のままである。** 製造は同ファイルの §J しか書けない（`D-382`）。**⇒ 状態更新を設計伝達レポート §4 で請求する。**
    6. **★`scripts/check-import-order.sh` がベースラインより 2 ファイル少ないと報告する**（`現在 99 / ベースライン 101`）**。本サブ由来ではない**（本サブが触った本番ファイルは違反リストに載っていない）。スクリプト自身が「BASELINE を 99 へ下げること」と促している。
    7. **★派生資料 3 件が陳腐化疑い**（`code-facts` 21% / `docs-map` 13% / `custom-commands` 38%）**。本サブは `internal/desktop` の呼び手を初めて作ったため `code-facts` の該当節は実物と食い違う。**
### M34-02 追補: 実機確認の回答による 1 件追加と origin の裁定（2026-09-12）

- **結果**: **★開発者の実機確認（6 項目すべて OK）で追加要求が 1 件出た**〔逐語＝「ここに `config.toml` の場所を開くメニューも追加してもらえますか？ **パスワードリセット等の時に直接いじるので、ないと困る**ことがわかりました」〕**。⇒ トレイメニューへ「設定ファイルのフォルダを開く」を足して 6 項目にした**（`filepath.Dir(config.ResolveAppPath(configPath))`＝**いま読んでいる `config.toml` の側**。`TACPENDIUM_CONFIG_PATH` で差し替えている場合もずれない）。`go test ./...` FAIL 0 件・`make check-windows` 緑。
- **報告**: 完了報告 `docs/progress/M34-02-completion-report.md` §4.6 ／ 設計伝達レポート `docs/handover/design-reports/20260910-m34-02-design-exceptions.md` §1-4
- **★横断課題**:
    1. **★★候補 6「exe のフォルダを開く」と同じ場所を開くことになった。⇒ ただし `M34-overview` §5.1.6-6 の判断**（ログフォルダの親だから足さない）**を覆したのではなく、用途が別**（簡易パスワードの復旧は `config.toml` の手編集しか手段が無い）**という理由で 1 項目にした。★「exe のフォルダを開く」という項目は作らない**——同じ場所を指す項目が 2 つ出るため。**重複はテストで検査している**（`TestBuildTrayMenu_ConfirmedItems`）。
    2. **★★★origin の未決が決着した＝開発者裁定「`localhost` 維持」**（2026-09-12）**。⇒ 実装の変更は無い**（暫定で採っていた側がそのまま確定した）**。★残るのは設計卓の手番である**——**`M34-overview` §5 判断 2 の文面**（「ブラウザで開く URL だけを `127.0.0.1` にする」）**が as-built と食い違うため補正が要る。** §J の `tray-browser-url-origin-choice` は**完了**へ更新した。
    3. **★実機確認で 1 件、手順の側の誤りが判明した。** 完了報告 §14-4 と本レポートが示したポート占有の PowerShell 断片は、**既に使用中のポートが範囲内に在ると `MethodInvocationException` を出す**（`WSAEADDRINUSE`）**。⇒ 例外が出ても「そのポートは誰かが占有している」ことに変わりはなく、確認としては成立する。★ただし占有主が Tacpendium 自身だと二重起動の判別が先に働いて `exit 0` になり、`MessageBox` が出ない。⇒ 手順には「先にアプリを終了する」と「不成立を数える形」が要る**（本追補で開発者へ提示した改訂版に反映済み）。
### M34-02 追補 2: 起動失敗時の導線（設定ファイルのパス表示 ＋ 自動で開く）（2026-09-12）

- **結果**: **★実機で `MessageBox` を確認した開発者から要求が出た**〔逐語＝「設定ファイル契機が多いのであれば、MessageBox に設定ファイルのパスを出したり、設定ファイルのフォルダを勝手に開いたりは欲しい気がしました」〕**。⇒ 実装から起動失敗の契機を全数洗い出したところ、15 種のうち 8 種が `config.toml` を直せば直るものだった**（完了報告 §15.2 に表で残した）**。⇒ 開発者の選択は「パス表示 ＋ 自動で開く」。** 本文へ設定ファイルの絶対パスを常に添え、**設定ファイル由来のときだけ**その置き場を開く形にした。`go test ./...` FAIL 0 件・`make check-windows` 緑。
- **報告**: 完了報告 `docs/progress/M34-02-completion-report.md` §15 ／ 設計伝達レポート `docs/handover/design-reports/20260910-m34-02-design-exceptions.md` §1-9
- **★横断課題**:
    1. **★★分類を持たせた**（`configProblem` の目印）**。目印を付けるのは 3 か所だけである**〔`config.Load` ／ `log.Init` ／ `buildAllowedOrigins`〕**。⇒ 起動経路へ新しい失敗を足すときは、「設定ファイルを直せば直るか」を判断して目印を付けるか決めること。★付け忘れても動作は正しいままで、フォルダが開かなくなるだけなので、テストも lint も何も言わない。**
    2. **★`validate()` は `logging.level` を見ていない**（完了報告 §15.2 の 7）**。⇒ タイポは `config.Load` を通り抜けて `log.Init` で初めて落ちる。動作としては問題ないが、検証の置き場が 2 か所に割れている。** 直すなら `internal/config` 側へ寄せるのが素直である（本サブの射程外）。
    3. **★実機確認は 6 項目すべて OK になった**（`MessageBox` は `mode` を不正値にする方法で確認。表示内容は完了報告 §14.2）**。⇒ `M34` を閉じる条件のうち、製造側で残っているものは無い。**

### M31-05: 各キャラの設置系 `custom_states` を足す（`P4M-023`）（2026-09-10）

- **結果**: 9 キャラ **14 state**（11 ファミリー。★舞・イングリッド・ダルシムのサンバーストの 3 つを 2 state へ割った）を投入。**消費マイグレ ＝ `000110` の 1 本**（層 B・`_data_`）。**CHANGE 消費 0 本**（請求のみ）。段 1 の判断は **案 (vi)**〔`type: level` のまま `value_definition.options` にラベル付き選択肢を持たせる〕で確定し、実測が支持したため止めずに段 2 へ進んだ（`D-807` の運用）。`go test` 緑 ／ `pnpm test` 224 files・2697 tests 緑 ／ `make e2e` exit 0。
- **報告**: 完了報告 `docs/progress/M31-05-completion-report.md` ／ レビュー `docs/progress/M31-05-review.md`
- **レビュー**: 指摘 15 件（高 3 / 中 6 / 低 6）。**「高」の不採用は 0 件**。**不採用 0 件**（15 件すべて採用）。再レビュー往復 0 回。**★ハード列 2 件を開発者判断へ回した**〔舞の 11 択の畳み方 ／ キンバリーのラベル〕**。どちらも 2026-09-10 に回答を得て実装済み。**
- **★★2026-09-10 追補（開発者の実機確認）**: **`custom_states` の int state に `value_definition.single_value` を新設し、本サブが足す state を 1 欄 / 1 行にした。⇒ ①`start_min` / ②`end` は `M16-07` がストック系のために足した拡張であり、原点**（`CHANGE-040`）**は「開始時状態の付与のみを扱う」である。設置系をそこへ乗せたのは製造の取り違えだった**（開発者の逐語＝「恐らくストック数等に釣られたものと思われるが、それらとは扱いが別」）。**★既存のストック系 6 件は `single_value` を持たないため 1 文字も変わらない。★マイグレは未着地のため `000110` を書き換えた（番号は増やしていない）。** あわせて ジュリを 3 択（なし / 風破版 / OD）へ、イングリッドとダルシムのサンバーストを「レベル・段階」と「強度」の 2 state へ、舞の「乱れ」を「乱れ花蝶扇」へ。
- **★開発者の実機確認**: **2 巡とも通過**（2026-09-10）。**1 巡目でドメイン確認 7 件と画面確認 6 件を実施 → 上記 5 点の是正指示 → 2 巡目で全項目 問題なし。⇒ 確認待ちの項目は 1 件も無い。**
- **★横断課題**:
    1. **★★マージ順に制約がある。`M35-02`（`000108`）と `M31-04`（`000109`）を本サブより先に着地させること。** 本サブが先に入ると、既に v110 まで上がった DB では `golang-migrate` が後続の 2 本を**適用しない**（version は単調であり、現在版より小さい番号は走らない）。**★ボード §2.2 は 2026-09-09 に `000108` / `000109` を払い出し済みで、どちらも本サブの着手時点で disk に無かった。**
    2. **★★`DES-003` §3.2 への CHANGE 請求が 3 点ある**（**起票は設計卓**＝`D-293`）。**(1)** `value_definition.options`（ラベル付き選択肢）の追加 ／ **(2) 同節の「設置技が置かれた状態から始まるコンボ → `subject: self`, `type: flag`」が as-built で失効した**——投入 12 件のうち `flag` は 2 件だけで、7 件が options 付き `level`、1 件が `stock` である ／ **(3)** `value_definition.phrase_kind`（設置数用の固定句）。**★(2) は動作が正しいままテストも lint も緑になるため、人が読む以外に見つける経路が無い。★同節は `CHANGE-154` と `CHANGE-169` で既に 2 度同型の是正を受けている。**
    3. **★指示書 §2.1 の分岐表から 2 件逸脱した。⇒ 設計卓に裁定番号を払わせること。** **kimberly** は「実査 5 が『居る』なら案 (ii)」の指示に対し **`type: stock`（設置数）** を採った〔開発者の逐語が「設置数」＝個数であり、フラグでは同じ強度を 2 つ置いた場合の個数が落ちるため〕。**ingrid** は選択肢を **9 択**（Lv1〜3 × 弱中強）とした。**★どちらも 2026-09-10 の開発者確認によるが、ボードにも `followup` にも記録が無い。**
    4. **★★「10を超えるものはボタン化の対象外」（`D-578(4)`）の線は、`custom_states` の options 経由では機械検査を通らない。** 描画側の分岐が `shouldButtonizeOptions` を呼ばない設計であるため、**選択肢を 11 個持つ state を seed しても型検査・単体・E2E がすべて緑のまま通る**（本サブが実際に 1 件作り、レビューが見つけた）。**⇒ `optionButtons.test.ts` の「実際の欄の個数」表へ今回の 7 欄を追記して床を上げたが、次に seed で選択肢を増やす人は同じ穴を踏みうる。★ingrid の 10 個が現状の最大であり余白は 0 である。**
    5. **★★語幹がタブに当たらない state が 3 件になった**（`flame_kachousen` ／ `yoga_sunburst_strength` ／ `order_of_the_sun_strength`）。**いずれも兄弟 state がタブを担保するため実害は 0 件だが**（テストで固定）**、`M30-01` 完了報告 §6 の「案 D＝state 定義に技コードの接頭辞を持たせる」の必要性がそのぶん増えた。**
    6. **★キャラ固有状態タブの語幹照合には、後置語表に無い形が静かに落ちる穴がある。** `_is_set` は語幹化されるが **`_set` 単独では語幹化されない**（実測 0 件）。**⇒ `<family>_set` という自然な命名を選ぶと「足したのにタブに出ない」が起きる。★検査は緑のままである。** 本サブは `moveSurfacing.test.ts` へ陰性対照として固定した。
    7. **★`check-import-order.sh` がベースラインより 2 ファイル少ない**（`BASELINE=101` に対し実測 99）。**★本サブ由来ではない**——着手基点 `3ee9162` の時点で既に生じていた差である。**⇒ BASELINE を下げるのは別の手番。**
### M30-03: 必殺技ファミリーの導き方を「`code` のどこかにある強度語」へ広げる（2026-09-10）

- **結果**: `parseSpecialCode` を案 (i) で広げ、**A2 の 105 件が必殺技タブへ載った**。**既存の判定は 1 件も動いていない**（実測 0 件・規則として試験で固定）。**ファミリー衝突 0 件** ／ **誤検出 0 件**。**★同関数は全域になり**（`null` を返さなくなり）**、未分類タブに `category='special'` は 1 件も残らない。** 未分類は実 DB で **87 → 41 行**（CSV 由来の基準では 144 → 39 行）。**副次で `followup` §CL の「素は押せるが OD が押せない」7 組が 0 件になった。** CHANGE 0 本 ／ マイグレ 0 本 ／ 新規依存 0 件。`pnpm test` 2676 緑 ／ `go test ./...` 緑 ／ `make e2e` 全数 **295 passed・0 flaky**。
- **報告**: 完了報告 `docs/progress/M30-03-completion-report.md` ／ レビュー `docs/progress/m30-03-review.md` ／ 設計伝達レポート `docs/handover/design-reports/20260910-m30-03-design-exceptions.md`
- **★実機確認**（2026-09-10・開発者・5 項目）: **A 逐語で報告された技が押せるか ／ D 未分類タブの件数 ／ E 保存と復元＝いずれも問題なし。** **★B＝規則 2 の優先順位（`od` 先）の見え方も「問題なし」＝確定。⇒ 製造判断だった同件は開発者の確認を得たため、設計卓の裁定は不要になった**（完了報告 §4.5）**。** **★★C＝ファミリー行の表示名に強度語が残る形は「気になる。直したい」。⇒ 横断課題 2 を参照。**
- **レビュー**: 指摘 10 件（高 3 / 中 4 / 低 3）。**「高」の不採用は 0 件**（**★不採用そのものが 0 件＝全 10 件を採用**）。再レビュー往復 0 回。**★★最大の指摘は 高-2＝「指示書ヘッダが完了条件として名指しした『素は押せるが OD が押せない 7 組 → 0 件』のテストが恒真になっていた」である**——`isOnSpecialTab` を `category==='special'` の 1 条件へ簡約した結果、兄弟の `category` は必ず `special` になり、**`parseSpecialCode` を着手時点へ巻き戻しても緑のままだった**（実測＝兄弟判定に到達する組 102 / うち `category!=='special'` の兄弟 0。レビューと製造が独立に再現）。**⇒ 主張を述語からファミリーの座標へ移し、7 組を名指しで全数残した**（素と OD が同じファミリー・同じ変種の別々の強度として在ること）。**★破壊確認 C を追加して赤になることを確認した。★製造側は破壊確認を 2 本実施していたが、そのどちらもこのテストを対象にしていなかった。**
- **★横断課題**:
    1. **★★`M30-01` の副次指標も誤っていた（`M-145` の隣）。** 同サブが申告した「未分類 251 → 146」は**測った値ではなく 251 − 105 の引き算**であり、**案 C で既に固有状態タブへ外れている 59 件を二重に引いていた**（A2 105 件のうち未分類タブに居たのは 46 件だけである）。**⇒ 「実測」と題した表の中に、測った値と計算した値が混ざっていた。★どちらであるかは表からは読めない。** 指示書 §2.1 に従い実装前に停止・報告し、開発者の裁定（2026-09-10「進めて良い」）を得て続行した。**★決定的な 4 指標**（新たに載る 105 ／ 衝突 0 ／ 誤検出 0 ／ 既存の判定が変わる 0）**はすべて再現しており、設計判断の前提は崩れていない。** なお A1 は 186 ではなく **187** である（`M30-02` のマイグレ `000107` が `terry/round_wave_heavy` を是正したぶん）。
    2. **★★ファミリー行の表示名に強度語が残る（実測あり・★開発者が「直したい」と表明＝別サブ）。** ファミリー行 327 → 348 行のうち、**表示名に強度語が残るものが 31 → 49 行**（着手時点から在る形を本サブが 18 行増やした）。例＝`lightning_beast_rolling_attack` が「【ライトニングビースト】弱ローリングアタック」のまま並ぶ（弱中強 ＋ OD が押せるファミリーなのに名前が「弱」を含む）。原因は `stripStrengthLabel` が**接頭形と末尾形しか落とさない**こと（`M30-02` も同じ限界を指摘済み）。**★★機械的に落とすと壊れる**——`【ライトニングビースト】弱…` の「弱」は技自身の強度だが、`キャノンストライク（弱フーリガンコンビネーション派生）` の「弱」は**派生元の強度**であり落とすと意味が壊れる。**⇒ 判別規則の設計が要る。設計伝達レポート §4-3 へ請求。** **★★★2026-09-10 の実機確認で開発者が「気になる。直したい」と表明し、あわせて逐語で「汎用的なアルゴリズムではなく、例外辞書的なもので強引に対応することも考えて良い」と述べた。⇒ 本件は「直す方向で確定・方式と割付は未定」である。★『規則が書けない』を『直せない』と読まないこと**（完了報告 §4.5）**。**
    3. **★`check-import-order.sh` の実行時メッセージと冒頭コメントが食い違う。** 実行時は「BASELINE を下げること」と出るが、冒頭コメントは「**レーンごとに測って下げてはならない**」と明示している（並走レーンぶんが見えずマージ時にずれる。`check-md-emphasis.sh` が 2026-08-14 に踏んだ型）。**本サブは一度下げて、コメントを読んで戻した**（`8d9d854`）。**⇒ 実行時メッセージ側に「レーンでは下げない」の一言が要る。**
    4. **★★「規則を簡約したら、それを使っていたテストが恒真になっていないか」を見る観点が要る**（レビュー 高-2 の一般化）。**⇒ 型検査もカバレッジもテストも緑のままであり、人が読む以外に検出経路が無い。★本件は「指示書が完了条件として名指しした主張」ですら空振りしうることの実例である。⇒ 破壊確認の対象は、完了条件として名指しされた主張から先に選ぶこと。**
    5. **★★案 C**（キャラ固有状態タブを「掲載済み」に数える・2026-09-08 開発者判断）**が現行データに対して効く行を持たなくなった。** 本サブの後、実 seed に「未分類に残り、かつ状態 code を含む」行は **0 件**である。**⇒ `moveSurfacing.test.ts` の当該テストは合成 code でしか動かせなくなった**（そのように差し替え、理由を明記した）。**★規則を残すか畳むかは設計判断であり製造の手番ではない。⇒ 設計伝達レポート §4-4 で裁定を請うている。**
    6. **★指示書 §2.3-3 の見込みが実測と食い違った。** 「`m30-01-controller-surfacing.spec.ts` が固定する実 DB の件数が動く」とされていたが、**同 spec の 4 キャラ**（jamie / mai / blanka / manon）**は 1 件も動かない**（残る 5 件は投げ・normal・rush_variant であり A2 ではない）。**⇒ 実際に動く cammy 13 → 1 と m_bison 9 → 0 を足して、spec が本サブの変化を捕まえられるようにした。**
### M31-04: 確定反撃でドライブリバーサルを扱う（`SM-098`）（2026-09-10）

- **結果**: マイグレ **`000109`**（層 B＝`000109_data_seed_drive_reversal_system_move`）を消費し、`drive_reversal` を `category='system'` で**全キャラ 31 行**投入（`damage=500` / `on_block=-6` / `recovery=27` ＋ `official_ja_move` alias 31 件）。**確定反撃のブロックタブに有利フレーム `+6` で出る／ジャストパリィタブからは明示除外**（段 3 案 b）。**入力面（仮想コントローラのタブと全技一覧）へは出さない**（段 4）。`go test ./...` 59 パッケージ緑 ／ `pnpm test` 225 files・2677 tests 緑 ／ E2E `m18-02` 2 ・`m18-03` 13 ・`m30-01` 9 緑 ／ `check-migration-license.sh` は `000109` を層 B と判定。CHANGE 消費 **0 本**（自採番せず、請求は設計伝達レポート §4 へ）。
- **★★開発者の実機確認**（2026-09-10。**コード上では判定できない範囲**）: **ブロックタブの `+6` が実際のゲームの体感と合っていること ／ 届かない始動技が混じるのは仕様どおりで問題ないこと ／ JP タブから消えていて「気持ち悪さもなかった」こと ／ 入力面に出ず技名も生 code でないこと**、の 4 件を確認済み。**★`+6` は受け取った値そのものではなく `-(on_block)` を有利フレームとする実装側の解釈だったため、ここが確かめられた意味は大きい。⇒ レビュー 低-3（JP タブで黙って消える件）は実機で懸念が成立せず取り下げた。**
- **報告**: 完了報告 `docs/progress/M31-04-completion-report.md` ／ レビュー `docs/progress/m31-04-review.md` ／ **設計伝達レポート `docs/handover/design-reports/20260910-m31-04-design-exceptions.md`**
- **レビュー**: 指摘 **9 件**（高 3 / 中 3 / 低 3）。**「高」の不採用は 0 件**。再レビュー往復 0 回。**★高 2 件は「実装が変わったのに記述が旧のまま」型**——`useControllerInputOmission` の `visibleMoves` godoc（OFF でも全件ではなくなった）と `isInputExcluded` の godoc（実装が保証しない「タブに効く」を断定）。**動作は正しくテスト・lint・型検査は緑のまま通る。**
- **★横断課題**:
    1. **★★`000025` を写すと `preset_aliases.character_id` が落ちる。** 同マイグレは `000074`（`character_id` を非正規化で追加）より前であり、その列を持たない。**NULL でも `INSERT` は通り alias は表示にも出るため、動作では気づけない。**`000075` の UNIQUE 索引 2 本の構成列でもあり、NULL だと一意性が効かない。**⇒ 気づけた唯一の経路は `internal/repository/preset` の「`character_id` が NULL の行が 0 件」テストであった。★次に `000025` を写す人へ:  alias を足すなら `character_id` を必ず入れること**（本サブの契約テストにも同じ主張を足してある）。
    2. **★★キャラ追加波では `000109` の追随マイグレが要る。** 移動 system move が `000025` → `000044`（マノン）→ `000054`（第三波）と追随してきたのと同じ性質である。**★これを検出する常設テストは無い**——契約テストは `v107 → v109` に閉じており（規約どおり）、`migrate_head_test.go` は FK の宙吊りしか見ない。**⇒ 思い出さない限り、そのキャラだけ確定反撃に D リバが出ない。動作は落ちず、テストも緑である。**
    3. **★★「入力面」は 2 面と決めた。3 面目（引っ越し取込）は対象外である**（2026-09-10 開発者判断。逐語＝「ユーザーがあり得ないコンボを入れたりとかは考えなくていい」）。**`internal/service/intake` の別名照合は `category` で絞らないため「ドライブリバーサル」は 1 件に解けて `Resolved=true` になり、`IntakeHelperPage` の技セレクタにも並ぶ。★これは塞ぎ忘れではない。⇒ 次に触る人が「穴だ」と読んで勝手に塞がないこと**（同じ旨を `moveSurfacing.ts` と `internal/model/move.go` の 2 か所へ記述として残してある）。
    4. **★入力面から明示除外する仕組みが本サブで 1 件目になった**（`INPUT_EXCLUDED_MOVE_CODES`）。**`P4M-005`**（`setup_only` の活用）**が同じ「入力から外す」面を持つ。⇒ 2 通りの仕組みが並ぶ前に、どちらへ寄せるかを決める必要がある**（`M31-RESEARCH-01` の続き）。
    5. **★マイグレ番号は `000109` を消費した。⇒ ボード §2.2 の「次に払い出す番号」の更新が要る。★ただし `000108` は本ツリーに存在せず並列サブが消費予定であり、実査値はマージ後でないと確定しない**（**製造はボードを直接編集しない**＝`D-382`。請求は設計伝達レポート §4）。
    6. **★`REQ-001` への CHANGE は要らない。** 確定反撃は `NFR406`（`requirements.md:370`）＝「相手の技をガード／ジャストパリィした後の隙に当てる技…の記録」であり、**D リバは「相手の技」なので要件文を変えずに収まる。⇒ 請求先は `DES-002` §4 の追随だけである**（`M31-overview` §5-6 の実査項目への回答）。
    7. **★`scripts/check-import-order.sh` の `BASELINE` が 101、実測 99。本サブ由来ではない**（着手前から在るずれ。変更 3 ファイルは違反一覧に 0 件）。**共有スクリプトであり並列サブとの衝突面を増やさないため触っていない。⇒ 下げるのは別の手番。**
### M35-02: `ryu` の `axe_kick_2` → `axe_kick`（三点更新）（2026-09-10）

- **結果**: 三点（CSV 正本 ／ golden 4 本の再生成 ／ 追随マイグレ）を揃え、`rush_axe_kick` が入力面から選べない状態を解消した。**消費マイグレ ＝ `000108` の 1 本**（`D-800` 払い出し・**層 B**＝`check-migration-license.sh` が `CC-BY-SA-4.0` と判定）。**CHANGE 0 本**。`go test ./...` FAIL 0 ／ `pnpm test` 2674 全緑 ／ `tsc --noEmit` exit 0 ／ E2E 4 spec（19 tests）緑 ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。**動かした golden は `000030` / `000035` / `000072` / `000073`**（**★`000026` ではない**——ryu は `FirstWaveOrder` に含まれないため。**terry の先例と本数は同じだが内訳が違う**）。
- **報告**: 完了報告 `docs/progress/M35-02-completion-report.md` ／ レビュー `docs/progress/m35-02-review.md`
- **レビュー**: 指摘 11 件（高 2 / 中 5 / 低 4）。**「高」の不採用は 0 件**。不採用は 低-11 の 1 件のみ（**実 DB の適用証跡としてログの `108/u` を引く案。★前提が誤っていた**——同ログの 4 件はすべて本サブの E2E 実行が書いたもので、DB パスは `web/e2e/.tmp/tacpendium-e2e.db`＝使い捨ての E2E DB である。`v1` から通しで適用する新規 DB のため `000108` の `UPDATE` は 0 行に当たり、**追随が効いた証跡にはならない**）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★本項は 2026-09-10 に訂正した。** 初版は「`ingrid` 2 / `lily` 1 / `mai` 1 の 4 件が `ryu` と同型で、いまも入力面から到達できない」と書いたが**誤りである**。**⇒ 訂正の全文は設計伝達レポート `docs/handover/design-reports/20260910-m35-02-design-exceptions.md` §0。** 正しくは次のとおり。**(a) 同 4 件は `original_move_code` の dangling 参照であり、`move_code` は正しく対応している。⇒ `isOnUniqueTab` は `move_code` だけを見るため、入力面には出ている**（実害はセットプレイ提案からの脱落＝`internal/service/setplay/service.go:144` と、`numeric`・`srk` の別名欠落）**。(b) 既に followup `rush-original-move-code-typo` として登録済み・割付済みである**（**別サブ**・開発者裁定 2026-08-13 ／ `D-336` (b) 経路）**。⇒ 本サブが新規に見つけたものではない。(c) `moveSurfacing.roster.test.ts` の `rush_variant: 5 → 4` を裏づけとして引いたのも誤りである**——**同テストが数えているのは別の母集団であり、残る 4 件の正体は `alex` 2 / `jamie` 1 / `zangief` 1**（いずれも基底が `normal` で `original_move_code` も正しく、`HitBoxLayout` から到達できないために落ちている）**。★件数が同じ 4 だったのは偶然である。(d) 誤った原因は走査式の意味を結果から逆算したことである**（教訓＝設計伝達レポート §7-6）**。★`M35-02` の実装そのものには 1 行も影響しない。**
    2. **★★旧 `move_code` を含む既存エクスポート CSV の再取込は静かに欠落する。** コンボ CSV の `recipe` 列は**セル内 JSON `[{move_code, modifiers}]`** であり（`internal/service/comboio/csvcore/contract.go:56`）、未知 `move_code` は `VAL-I07` の **WARNING**（ERROR ではない）で `move_id` を `nil` のまま取り込む（`csvcore/validate.go:197` ／ `import.go:443`）。**⇒ 利用者が警告を読み飛ばせばステップが技を失ったまま入る。★本サブ固有ではなく「三点更新」という型に属する**——`000063` / `000106` / `000107` にも同じ帰結が当たる。**★段 1 の走査軸に「DB 外の成果物が `move_code` を文字列で持つか」が無かったことは本サブの取りこぼしである。⇒ 次に同型の改名を行う担当はこの軸を最初から持つこと。**
    3. **★★`v108` から `v29` まで降ろすと孤児行が残る。** `000030_seed_moves_ryu.down.sql` は削除対象を code 列挙で指定しており、その列挙は golden 再生成後 `axe_kick` になっている。一方 `v108` → `v107` の down で当該行の code は `axe_kick_2` へ戻っている。**⇒ 別名 3 件と move 1 行が DELETE に当たらず取り残され、`000029.down` が旧体系の `axe_kick` を再投入しても `UNIQUE` 衝突が起きないため成功してしまう。** その後 `v108` まで上げ直しても `000108.up` の `NOT EXISTS` ガードが何もしないので孤児は残り続ける。**★本サブが作った欠陥ではなく `000063` / `000106` / `000107` と共有する既存クラスであり、`m.Down()` / `Migrate(0)` を呼ぶテストは 1 本も無い**（実測）**。`M33` の統合で消える性質でもあるため記録のみとした**（機序は `000108` の down SQL コメントに 3 段で残してある）。
    4. **★★`seedgen -check` は ryu の golden を何も守らない。** `character_data/ryu.csv` を旧 code へ戻しても `go run ./cmd/seedgen -check` は **`OK` / exit 0 を返す**（実測）。捕まえるのは `go test ./internal/seedgen/` だけである。**★`M28-05` の実測より強い形である**——terry は `FirstWaveOrder` に居るため `-check` が赤くなったが、**ryu は `000026` に居ないため基底 CSV を壊しても緑のままになる。⇒ 「`-check` が緑だから golden は守られている」と読むと、ryu では守られていない区分を守っていることにできる**（`CHANGE-163` §1 ／ `SUPP-001` §5.5.4 (10)）。
    5. **★版固定テストの追随が要る場合がある。** `internal/infra/migration/migrate_m1403c_test.go`（終端 `v30`）が `axe_kick_2` を「seed される code」、`axe_kick` を「残っていてはならない code」として列挙しており、golden 変更で**両方の主張が反転した**。**★terry の先例（`000026`）には版固定テストが無かったため、この追随は本サブが初めて行う。⇒ 次に golden を動かす担当は、その版に固定された契約テストの有無を先に確認すること。**
    6. **★`inputResolution.ts:78` のコメントが着手前から失効していた**（`ryu` を「unique ラッシュ版を持たない例」として挙げていたが、`ryu` は `rush_collarbone_breaker` 等を 5 件持ち `hasUniqueRushVariant` は着手時点から `true`）。**レビュー 高-1 として採用し是正した。★本サブが失効させたのではない**ことを明記してある。
    7. **★`check-derived-docs.sh` が製造 CLI（`implement_plan_full` 等）の検査表に載っていない。** `check-artifact-integrity.sh` が見るのは**生成物の健全性**であって**鮮度**ではないため、代替にならない。実測は `code-facts` 21% ／ `docs-map` 13% ／ `custom-commands` 38% の陳腐化疑い（**いずれも本サブ起因ではない**）。**`CLAUDE.md` §8 が警告する「回すきっかけが無くなる」型そのものであり、CLI 側の運用課題。**
    8. **★`check-import-order.sh` がベースラインより 2 ファイル少ない**（`BASELINE` を 101 → 99 へ下げる提案）。**本サブは import 行を 1 行も足しておらず無関係。改善レーンの手番。**

### M30-04: 必殺技ファミリー行の派生変種を末尾へ回す（2026-09-10）

- **結果**: `is_derived` をリスト DTO まで届け（`model.Move` ＋ `MoveListItem` ＋ SELECT 列 ＋ divergence guard ＋ `MoveResponse.isDerived` ＋ TS `Move.isDerived`）、必殺技ファミリー行を「非 derived の群 → derived の群」の 2 群連結にした（`sort` 不使用・群内は初出順のまま）。**消費マイグレ 0 本 ／ CHANGE 0 本**。**実測＝ファミリー 372（前後で不変）／ 末尾へ回った 178 ／ 陽性対照 47**（着手時点で末尾ブロックの外に居た derived。jamie は 2 行目が derived だった）。判定は**ファミリー内の全 move が `is_derived=true`** のときだけで、混在 5 件は動かさない。`go test ./...` FAIL 0 ／ `pnpm test` 2699 全緑 ／ `tsc --noEmit` exit 0 ／ `make e2e-only P=m30-0` 21 passed ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M30-04-completion-report.md` ／ レビュー `docs/progress/m30-04-review.md`（1 巡目）・`docs/progress/m30-04-review-2.md`（2 巡目）
- **レビュー**: **2 巡**。**★チェックリストは事後発行であった**（`D-816`。`D-736` は着手承認の手番で起こす運用だが本サブでは起票されず、**1 巡目は指示書 §4 / §6 を代用の観点束として実施**した。発行後に同書を主入力とする 2 巡目を回した）。1 巡目＝10 件（高 2 / 中 5 / 低 3）、2 巡目＝8 件（高 1 / 中 4 / 低 3・**1 巡目既出の再掲 0 件**）。**★どちらも全件採用・不採用 0 件・「高」の不採用は 0 件。** **再レビュー往復 1 回（上限 2 に対して 1）。**
- **★横断課題**:
    1. **★★★【2026-09-12 是正済み】`make e2e` 全数が 296 passed / 3 failed だった。3 件はいずれも着手前から赤であり、原因は `M31-04` のマージ**（`c4880c2`）。**★当初は射程外として回付する予定だったが、開発者の指示（マージ前提）により本サブで直した。⇒ 是正後の全数は 299 passed / 0 failed（実測）**——`m14-03d` 81→82 ／ `m14-03e` の 6 キャラを +1 ／ `m27-02a` は「API 一覧の最後の技」を「プルダウンが実際に選べる最後の技」へ（共有ヘルパ `selectableMoveIds` を新設）。**★数字だけ +1 せず内訳と申し送りを注記に残した。** 以下は原因の記録である。**(a)** マイグレ `000109` が `FROM characters c` で全キャラへ `drive_reversal` を 1 行ずつ投入し、**各キャラの move 数が +1** になったため行数を固定していた `m14-03d-manon-seed.spec.ts`（81 → 82）と `m14-03e-third-wave-seed.spec.ts` が落ちる。**(b)** その `drive_reversal` は `moves.id` が最大であり、`m27-02a-reachability.spec.ts` の `moves[moves.length - 1]` がこれを選ぶが、**同 code は `INPUT_EXCLUDED_MOVE_CODES` で全技一覧プルダウンから除外されている**ため `selectOption` が落ちる。**★`M31-04` は E2E spec を 1 本も触っておらず**（`git show --stat 97cb22f 2692637`）**、完了報告の検査も `make e2e-only` の的撃ちだけで全数を回していない。⇒ 落ちたことに気づく経路が無かった。★本サブの diff に `migrations/` / `character_data/` / `internal/seedgen/` は 0 ファイルであり、SELECT 列の追加は行数を変えない。是正は射程外のため設計卓へ回付。**
    2. **★★`is_derived` の露出で `docs/handover/M19-DESIGN-01-central-requirements.md:47`（R7）の「現状 `is_derived` は model 非搭載＝API 非露出」が失効した**（レビュー 高-1）。**製造は同書を編集できない**ため設計伝達レポート §4 で回付する。**★着手時点の失効走査がコード側（`internal/` ＋ `web/src/`）で止まっており `docs/` を見ていなかった。⇒ 次に API 契約を広げる担当は、失効走査の対象に `docs/handover/` と `docs/design/` を最初から入れること**（`docs/change-notes/` は発行済み通知書＝歴史記録なので対象外）。
    3. **★★実データでは塞げない床が 1 件あった。** `is_derived` の畳み込みは 2 段（raw ファミリー内の AND → 変種を基底へ畳むときの AND）だが、**seed 実データには「同一 raw ファミリーの中で `is_derived` が割れる」組が 1 件も無い**（混在 5 件はいずれも plain と holding 変種のあいだで割れている）。**⇒ 段 1 の AND を OR に取り違えても実データ由来のテストは全部緑のままである**（取り込み中の変異注入で実測）。合成データのテスト 1 本で塞いだ。**★「実データ全数の床を張った」は「その関数の全分岐に床を張った」を意味しない。** **★★【2026-09-12 追記】この教訓は本サブで自己適用済みである**——床は `web/src/features/combo/inputResolution.test.ts:477`（合成データ 2 行）。**再測＝段 1 を OR へ変異注入すると `1 failed / 110 passed` で本 1 本だけが赤になる。** **★ただし設計伝達レポート §7-2 が「機構化案」の書き方で止まっており、設計卓からは適用済みに見えなかった**（開発者の指摘）。**⇒ 教訓を書くときは「提案」と「本サブで適用した」を同じ節で書き分けること。設計卓は `docs/progress/` を読まないため、レポートに無いものは存在しないのと同じである。** **★あわせて `D-811`（数週間後のキャラ追加＋バランス調整）への申し送りを同レポート §4-12 へ足した**——新キャラに同型の割れが在れば roster の分類オラクルが名指しで赤にする／キャラが 1 人増えるだけで実測固定の表は設計どおり全部赤くなる（「壊した」ではない）。
    4. **★`docs/handover/code-facts.md` の `MoveResponse`（:522）/ `MoveListItem`（:669）が `isDerived` を欠く**（レビュー 中-3）。**着手前から陳腐化しており**（生成 2026-09-05・源泉の変化量 282 件＝23%）、`/regen_code_facts` は射程外 282 件を巻き込むため**マイルストーン境界で再生成すると決めた**。★「決めずに放置しない」ことが指摘の本体である。
    5. **★`check-import-order.sh` の実行時メッセージ（「BASELINE を 99 へ下げること」）と冒頭コメント（「レーンごとに測って下げてはならない」）の食い違いが、`M30-03` から 2 サブ連続で再現した。** 据え置きが正しい。**改善レーンの候補**（レビュー 低-2。★回付先は `followup` §J ではない——§J は停止時記録の面であり、上限に達していない本サブの改善候補を置く場所ではない）。
    6. **★★2 巡目で 1 件が未解消のまま停止し、`followup-backlog.md` §J へ記録した**（スラッグ **`move-divergence-guard-is-one-directional`**）。**`internal/repository/move/divergence_test.go` の乖離検出ガードは `MoveListItem` → `model.Move` の片方向であり、`model.Move`（および `getByIDSQL`）へ足して `MoveListItem` を忘れる向きはコンパイルも guard も通る。★実例が現に 1 件残っている**（`model.Move.LastChangedGameVersion` が `MoveDetail` で常に nil）。**★片方向であること自体は設計として正しい**（`MoveListItem` は意図的投影）**。問題は指示書・チェックリスト・各報告が一様に「両構造体の同期を強制する」と書いていることであり、記述の是正（片方向である旨の明記）は本サブで済ませた。⇒ 双方向化するかは設計卓の判断**（設計伝達レポート §4-6）。**★再レビュー往復の上限に達したため 3 巡目に回さず記録して停止した＝正規の完了形式である**（`CLAUDE.md` §9）。**★★【2026-09-12】開発者が (b)「片方向のまま、記述だけを実態へ合わせる」を裁定した。⇒ guard のコードは変えない（是正は本サブで実施済み）。(a)（非搭載列の台帳を持ち双方向化する）は別サブ扱いである。** **★★ただし §J の状態欄は `未着手` のまま据え置いた**——メタ表（`D-382`）が製造へ許しているのは §J への**追記**であり、**既存行の編集は設計卓と共有する本表での git 競合を招く**（開発者判断）。**⇒ `完了` への更新は設計伝達レポート §4-6 の転記依頼として設計卓へ回した。** **★先例（`M31-03` の `7cba0a7`）では製造が状態欄を更新していたが、本サブではその運用を採らない。**
    7. **★2 巡目が拾った型は「実装ではなく記録」に集中した**——完了報告 §1.3 の `yasmine` 行落ち（合計 174 ≠ 見出し 178）／ §5 の stat が古く「新規ファイルは 1 本だけ」が取り込み後に偽になっていた／ 設計伝達レポートのヘッダが「チェックリスト未発行」のまま。**★いずれも実装は正しく、テストも緑である。⇒ 記録だけが実物からずれる形は、機械検査では捕まらない。** **★とくに「報告書に貼った `git diff --stat` は、その報告書自身を書くたびに古くなる」は一般化できる**——`docs/` を含む総計を貼らず、**コード側の stat と新規ファイルの機械的全数に分けて貼る**のが安全である（本サブの §5 をその形へ直した）。
    8. **★★【2026-09-12 裁定済み】178 / 372（48%）が末尾へ回る帰結はハード列であり、開発者が実機確認のうえ「このまま」と裁定した。⇒ 実装変更なし。** **★★★ただし残った課題がある**——開発者の観測「**jamie の場合、魔身の派生版は流酔拳・流酔脚よりもさらに下に来て欲しかった**」「**`is_derived=true` のものでも優先度があり、それは機械判定が難しい**」。**`is_derived` は 1 ビットなので derived 群の中の優劣を表現できず、群内順は `moves.id` 昇順のままである**（指示書 §2.2-3 の規則どおり＝欠陥ではない）。**⇒ 開発者の要望「別のマイルストーンを立てて `move_id` を一部並び替えたい」を設計伝達レポート §4-11 として起票請求した**（スラッグ案 `special-family-tail-order-needs-move-id-resequencing`。**★`moves(id)` を参照する列は実測 14 本 / 12 テーブルあり、振り直しは同一マイグレでの全数追随が要る**——この実測をレポートに載せたので設計卓は再実査しなくてよい）。**★あわせて「群の境目に区切りを入れるか」は「入れない」で確定した**（実機確認④＝問題なし）。**⇒ `DES-005` 第6節の as-built に「区切りは設けない」を含める。** 以下は裁定前の記録である。 `is_derived=true` は「単独入力が不可能」を意味せず（`DES-003` §3.3 errata③）、末尾へ回る中に jamie の流酔拳・流酔脚、blanka の `lightning_beast_*` のような**単独入力できる主力必殺技**が含まれる。**開発者の回答（案 A ＝指示書どおり）の逐語は完了報告 §3 に引用してある**（レビュー 中-4＝ボードに残っていなかった）。**⇒ 絞り込みすぎかの是非は設計卓の裁定事項として設計伝達レポート §4 へ回付。**
### M26-03: 法務ポスチャの再点検とデータ来歴の切り分け（`A4` ＋ `A3`）（2026-09-11）

- **結果**: **検査 8 本すべて緑**（`go test` ／ `check-artifact-integrity` ／ `check-migration-license --list` ／ `check-doc-refs` ／ `check-doc-inventory` ／ `check-public-snapshot` ／ `check-md-emphasis` ×2 ／ `check-progress-log-index`）。**CHANGE 0 本・マイグレ 0 本**（**三層のパス割当は変わらなかったため請求に至らず**）。**差分は 3 ファイル**〔`README.txt` ／ `NOTICE` ／ 本報告〕**で、`character_data/` ／ 法務決定文書 2 本 ／ `CONTRIBUTING.md` ／ `REUSE.toml` ／ `SECURITY.md` はいずれも 0 バイト差分**。窓口導線 2 本を差し替えた（**アドレスは伏せ字**＝`D-805` / `D-814`）。来歴判定は許可リストの実出力 **2954 件**を母集団に 3 階層で起こし、**CSV は 24 列全数を列単位で判定**した。**レビュー指摘 13 件は 13 件すべて採用・不採用 0 件**（往復 0 回）。
- **報告**: 完了報告 `docs/progress/M26-03-completion-report.md` ／ レビュー `docs/progress/m26-03-review.md`
- **★横断課題**:
  0. **★★`A4` の外部照会を開発者が実施した**（2026-09-11）**。⇒ `U-4` は部分的に閉じた**——**robots**（`cid.capcom.com`）**と SF6 の EULA は制限的な条項が現存することを確認。★残る不明 3 件＝利用規約の本文**（403 で未取得）**／ 4 件すべての「直近 1 年の変化」**（過去版との差分が取れない）**／ Buckler 側の robots。★★あわせて決定文書に無い事実が 2 件出た**——**(a) `battlelog-source` が根拠に挙げた `cid.capcom.com` と、Buckler の実ホスト `www.streetfighter.com` が一致していない可能性 ／ (b) robots に `Content-Usage: ai=n` ／ `DisallowAITraining: /` の明示。★どちらも実務判断を変えないが、決定文書の前提として記録が要る**（完了報告 §1.4.1〜1.4.3 ／ 申し送り 8-1b・8-1c）**。⇒ 開発者の手番。**
  1. **★`D-742` の除外は「場所」で切っており「内容」では切れていない。** `docs/seed-data/` を外した理由（公式の生フレーム/ダメージ値を含む）と**同じ内容が、公開される 2 ファイルに在る**〔`docs/progress/M14-RESEARCH-02-report.md` §C-3-7 ／ `progress-log.md:3742`〕。**選択肢 3 つを完了報告 §4.2 (e) に並べた。★「消す」変更は開発者の手番のため実施していない**（`D-196`）。**⇒ 公開ゲート `A` の判断事項。**
  2. **★三層は「SF6 の事実か否か」の軸しか持たず、「第三者素材か否か」の軸が無い。** 見つかった逆向き 3 件〔`docs/seed-data/` の層 B 宣言 ／ `web/src/components/ui/` の shadcn/ui 由来 21 件 ／ 上記 2 ファイル〕は**すべて後者の軸であり、三層のどこへ置いても解けない**。**⇒ 設計卓へ**（完了報告 §8-8）。
  3. **★`REUSE.toml:73-77` が本サブを名指ししていた「`docs/seed-data/**` の宣言は暫定」への回答を返した。** 指摘は正しく、**3 件（＋境界 1 件）に第三者素材が現存する。推奨は案 B**（`LicenseRef-` 形式で「配らない範囲」を宣言に書く）**。★`REUSE.toml` は触っていない**（指示書 §3-2）。**⇒ 設計卓の CHANGE 起票要否の判断待ち**（完了報告 §8-7）。
  4. **★★指示書 §2.3-3 / §4.3 とチェックリスト `A-2` の例「フレーム値は事実、`command` は開発者の補完」が、リポジトリ内の一次記録と向きが逆である。** 一次記録は「**公式データを `character_data` へ転記しない・実機を見て手入力する**」（`moves-input-background.md:51`）／「**`command` は公式と完全一致（差分 0）**」（`M14-RESEARCH-02-report.md` §C-3-4）である。**⇒ 「情報」と「表記」に分ければ両立する**（完了報告 §3.4）。**★指示書とチェックリストの両方を直す手番が要る＝設計卓**（完了報告 §8-5）。
  5. **★`followup-backlog.md:1399`**（`rights-holder-contact-channel-missing`）**が `D-814` を反映しておらず**「導線 3 本」「`M26-03` v1.0.0」のまま。**★製造は §J 以外を編集できない**（`D-382`）。**⇒ 設計卓が畳む**（完了報告 §8-11）。
  6. **★「CSV は 23 列」という失効した記述が 2 か所に残っている**（実体は 24 列＝`CHANGE-159`）。**`.claude/commands/precheck_seed_data.md:40` と ★`internal/seedgen/model.go:21`**。**後者は本番コードのコメントで、`go test` / `go vet` / `tsc` が一切検出しない**（`D-250` と同型）。**正本側**（`SUPP-001` §3.2 ／ `DES-003`）**は正しい。⇒ 改善レーンの手番**（完了報告 §8-12）。
  7. **★次の SF6 アップデートで来歴判定を繰り返すための手順を完了報告 §7 に残した**（引き金 4 種 ／ 実行できるコマンド列 ／ **判断の分かれ目 9 件**）。**★★置き場は決着した**（2026-09-11。**★3 つの裁定が別のことを決めている**＝`D-819` が置き場 ／ `D-820` が節番号 §5.5.9 と節の長さ ／ `D-821` が挿入位置と `SUPP-001` の番号重複の処理）**＝正本は `SUPP-001` の新節 §5.5.9 であり、挿入位置は §5.5.8 の直後である。⇒ 製造は原稿を完了報告 §7.A へ置いた**（`DRAFT-5.5.9-BEGIN` / `-END` で挟んである）**。★反映と `CHANGE` の採番は設計卓の受理時の手番である**（`D-293`＝製造は自採番しない）**。★製造が出した案 A / B / C はいずれも採られていない。** 関連 followup＝`sf6-major-update-after-release`（**★引き先は §5.5.9 である。⇒ 当初 §5.5.7 とされたが、同番号は既に「データ系サブで繰り返し起きること」が使っており、製造が差し戻した**＝完了報告 §8.14）。
### M35-03: ラッシュ版 4 件の `original_move_code` の誤りを直す（三点更新 ＋ 2）（2026-09-11）

- **結果**: 三点（CSV 正本 ／ golden 3 本の再生成 ／ 追随マイグレ）に `preset_aliases` への `INSERT` 8 行と `moves.original_move_id` の backfill 4 行を加えて是正した。**消費マイグレ ＝ `000111` の 1 本**（`D-812` 払い出し・**層 B**）。**CHANGE 0 本**。`go test ./...` FAIL 0 ／ `pnpm test` 2686 全緑 ／ `tsc --noEmit` exit 0 ／ E2E `combo-crud` 2 passed ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。**動かした golden は `000026` / `000072` / `000073`**（3 キャラとも `FirstWaveOrder`）。
- **報告**: 完了報告 `docs/progress/M35-03-completion-report.md` ／ レビュー `docs/progress/m35-03-review.md`
- **レビュー**: 指摘 10 件（高 2 / 中 4 / 低 4）。**「高」の不採用は 0 件**（高-1 は不採用ではなく**開発者への裁定要求として保留**）。不採用は 低-10 の 1 件のみ（`check-import-order.sh` のベースライン。本サブ由来ではない共有スクリプトであり、§J へ立てて改善レーンの手番を請求した）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★実害は 2 件ではなく 3 件だった。** 指示書 §0.4 ／ followup 行 ／ `M35-02` の実測はいずれも「実害は 2 つ」と書いており、製造はその記述を写していた。**⇒ 3 件目はレビューが独立に辿って見つけた＝`VAL-C12` 経由で保存が 400 になっていた経路**（`validation/combo.go:483-499` → `combo/deps_adapter.go:60-74` → `combo/service.go:368`）。**★4 技は入力面に出ていたので、編集画面から選べるのに保存できなかった。⇒ 3 件のうち唯一、利用者にエラーとして見えていた経路である。** **★同分岐（`origID == nil`）は着手時点でテストが 1 本も通っていなかった**（既存の `TestC12_*` 2 本はいずれも `ExistsForCharacter` 側の分岐を見ている）。**★教訓は「先行資料が数えた実害の件数を、自分で数え直さなかった」ことである。**
    2. **★★★規約 (16) の `grep` 手順は golden の連番では取りこぼす。** `SUPP-001` §5.5.4 (16) は「golden を再生成する前に、その版を終端にしている契約テストを `grep` で探すこと」とだけ書いている。**⇒ `internal/infra/migration/rules_m1905_test.go` は `000026` という文字列を 1 度も持たないが、終端 `v68` であり `original_move_id` の解決で `rush_variant` を絞るため必ず動いた**（903 / 937 → 907 / 941）。同型でもう 1 本 `internal/aliasindex/m2207b_third_stage_test.go` も連番では出てこなかった。**★弁別に効いたのは「変わる列名を `*_test.go` へ `grep`」＋「終端がその golden の版以上か」の突き合わせである。⇒ `CHANGE-178` が初めて実効した手番の所見であり、規約の本文へ畳むかは設計卓の手番**（§J `regulation-16-grep-by-sequence-misses-column-pinned-tests`）。
    3. **★★完了条件 11 は字義どおりには満たせない。** 指示書は「`internal/seedgen/` の差分が 0」を求めるが、規約 (16) に従って同ディレクトリの `generate_m2002_golden_test.go` を追随させたため成立しない。**⇒ 同条件が「生成器の実装」を指すのか「パッケージ全体」を指すのかの確定が要る。★あわせて `internal/seedgen/generate_m2002.go:634-638` の失効コメント**（4 件の dangling を現在形で説明している）**が直せないまま残っている**（§J `m35-03-stale-records-after-dangling-fix`）。 **★★【2026-09-11 追記＝開発者裁定】本項は解決した。****⇒ 裁定は「修正してください」であり、失効コメントを是正した**（過去形へ。**ガードは残し、再発を検出する床 2 本を名指しした**）**。★同時に完了条件 11 の読みも確定した＝「生成器の*振る舞い*」を指す。⇒ パッケージ全体の byte 差分を意味しない。** **★生成物は 1 バイトも動いていない**（`seedgen -check` exit 0 ／ `git diff --stat -- migrations/` が空）**。★§J の同スラッグに残るのは `DES-004` §3.2.1 の注記と followup 2 行の計 3 件であり、いずれも設計卓の手番である。**
    4. **★★破壊確認が空振りを 1 件検出した。** `preset_aliases` の `character_id` を主張するテストは書かれていて緑だったが、**守っていたのは `000074` の backfill であって本サブのマイグレではなかった**——新規 DB では `000111` の `INSERT` が走らないためである。**⇒ `SUPP-001` §5.5.4 (10′) の一例。守っていたものを特定したうえで、`down` → `re-up` の経路へ主張を置き直した。★「三点更新」という型では、新規 DB で全文が 0 行に当たるため状態テストだけでは何も守れない場面が繰り返し出る。**
    5. **★`followup-backlog.md` に同じ 4 件を指す行が 2 本ある**（`:328` `rush-original-move-code-typo` ／ `:344` `rush-variant-dangling-original-move-code`）。**⇒ 同時に畳むこと。片方だけ畳むと、残った方を読んだ後任が同じ調査をやり直す**（設計卓の手番＝`D-382`）。
    6. **★`check-import-order.sh` のベースラインが 101、実測 99。3 サブ連続の申し送りで誰も引き取っていない**（`M35-02` ／ `M31-04` ／ 本サブ）。**どのサブの由来でもないため、誰の手番でもないまま床だけが高い。⇒ §J `import-order-baseline-101-vs-99` として改善レーンの手番を請求した。**
    7. **★設計伝達レポート（完了条件 §6-15）は未達である。** 開発者の判断（2026-09-10）で本手番では `/design_handover_report` を回していない。**⇒ 別の手番で回す。**

### M31-06: `setup_only` の技をコンボの入力面から外す経路を作る（2026-09-12）

- **結果**: `isInputExcluded()` へ 2 つ目の理由として `setup_only` を足し、判定へ「面」（`RecipeInputContext`）を渡す形にした（**機構は 1 本のまま＝`D-810`**）。**消費マイグレ 0 本 ／ CHANGE 0 本**（起票は設計卓）。`go test ./...` FAIL 0 ／ `pnpm test` **2755 全緑**（＋22 本）／ `tsc --noEmit` exit 0 ／ **`make e2e` 全数 299 passed / flaky 0 / failed 0**（★追補後の最終走行。Phase C 時点は 298 passed / 1 flaky で、flaky は既知の `m31-02-tag-field-drag`）／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。**★実データの `setup_only = 1` は 0 件のままであり、画面の見え方は 1 か所も変わっていない**（それが本サブの狙いである）。
- **報告**: 完了報告 `docs/progress/M31-06-completion-report.md` ／ レビュー `docs/progress/m31-06-review.md`
- **レビュー**: 指摘 11 件（高 4 / 中 3 / 低 4）。**「高」の不採用は 0 件**（4 件すべて採用・修正済み）。不採用は 低-11 の 1 件のみ（`check-import-order.sh` のベースライン。本サブ由来ではない共有スクリプトであり、§J に既存行が在る）。再レビュー往復 **0 回**。**停止時記録なし**（未解消 0 件）。
- **★横断課題**:
    1. **★★★指示書 §2.2-1 の前提が実物で崩れた。** 同項は「`isInputExcluded()` の判定に `setup_only` を足す。⇒ これだけで仮想コントローラ 8 タブと全技一覧プルダウンの両方に効くはずである」と書いていた。**⇒ 効かない。** 着手時点で同関数を通っていたのは **2 か所だけ**（`surfaceBuckets` の `unclassified` 分岐 ／ `useControllerInputOmission` の `selectableMoves`）であり、**タブ側の 5 バケットと、バケットを持たない通常技タブ**（押下時に `resolveDirectionalInput` が解決）**・必殺技タブ**（`deriveSpecialFamilies` がファミリーへ畳む）**は本関数を見ていなかった**。**★`M31-04` で表面化しなかったのは `drive_reversal` が `category='system'` でどのタブにも載らない code だったからにすぎない。⇒ `setup_only` は任意の category に立ちうる。** **★解き方は「各バケットの push 直前へ足す」**（旧注記の推奨）**ではなく、`surfaceBuckets` の先頭で母集団を 1 回絞る「引き上げ」を採った** —— 押し下げでは判定が 7 か所へ散り、しかもバケットを持たない 2 タブには依然として効かないためである。
    2. **★★★「データが 0 件のうちに経路だけ作る」型のサブは、陽性対照を作らないと何も測れない。** `setup_only = 1` が 0 件なので、**経路が 1 行も効いていなくても `go test` も `pnpm test` も `make e2e` も全部緑になる**。**⇒ 破壊確認を 5 通り実施した**（判定の理由2 を殺す ／ `surfaceBuckets` を旧構造へ戻す ／ `omittedCount` の走査を戻す ／ フックの母集団を戻す ／ セットプレイの面を `"combo"` へ倒す）。**★とくに 2 番目が指示書の前提の誤りをテスト側から独立に裏取りしている。**
    3. **★★★型の床は「渡し忘れ」しか止めない。「倒す」は止めない。** `context` を必須引数にしても、`SetupRecipeEditor` の `"setup"` を `"combo"` へ**書き換えた**場合は型検査を通り、着手時点では `pnpm test` も `make e2e` も緑のままだった（実データが 0 件で、同画面のテストに fixture が無かったため）。**⇒ レビュー指摘（高-2 派生）で画面配線の床を 1 本足した。★「型で守った」と書くときは、守れるのが渡し忘れだけであることを併記すること。**
    4. **★★同じ述語を共有するとき、揃えるのは走査対象だけでは足りない。判定材料（母集団）まで揃える必要がある。** `isControllerSurfaced` を `surfaceBuckets` は絞った母集団で、`useControllerInputOmission` は生の `moves` で呼んでいた。**⇒ 段階2 の解決表が `setup_only` の技を指すと、コンボ側は段階1 へフォールバックして別の通常技を「押せる」状態にする一方、フック側は `entries` が当たるため同じ技を「押せない」と判定する。⇒ `CHANGE-176` §2.5 の等式「未分類タブ ＝ トグル ON で残る集合」が静かに崩れ、`omittedCount` もずれる。** **★フェーズ5 でフラグが立った瞬間に出る形であり、いまは全部緑である**（レビュー 高-2 が独立に検出）。
    5. **★★フェーズ5 の付与口を設計する側が知っていなければならない副作用が 2 件ある。⇒ 完了報告 §6.3 で設計卓へ請求した。** (a) **除外はボタンを無効化せず、同じボタンの解決先を別の技へ差し替える**（段階1 へのフォールバック）。(b) **除外の単位は「行」であって「ファミリー」ではない** —— 親の行だけに `setup_only` が立つと変種が独立ファミリーとして立ち、**`M30-02` が解消した「素は押せるが OD が押せない」7 組と同型の非対称が作られうる**。**★「どの粒度でフラグを立てるか」の設計制約である。**
    6. **★`surfaceBuckets` の第 4 引数だけ既定値 `"combo"` を残した。⇒ 暫定である。** 共有テスト `moveSurfacing.roster.test.ts` が同関数を 6 か所で呼んでおり、必須にすると `M30-05` と同じファイルを奪い合うためである（指示書 §0.7）。**★`M30-05` のマージ後に外す手番を完了報告 §6.3-1 で請求した。★放置すると「既定へ落ちた面で `setup_only` が静かに消える」入口が残る。**
    7. **★`check-import-order.sh` のベースラインが 101、実測 99。本サブで 4 サブ連続の申し送りになった**（`M35-02` ／ `M31-04` ／ `M35-03` ／ 本サブ）。**どのサブの由来でもないため、誰の手番でもないまま床だけが高い。⇒ §J に既存行 `import-order-baseline-101-vs-99` が在る。** **★`D-388` によりレーンで下げていない。**
    8. **★設計伝達レポート（完了条件 11）は達成した**（`docs/handover/design-reports/20260912-m31-06-design-exceptions.md`）**。★`internal/model/move.go` の Go 差分がチェックリスト A-3 からの意図的逸脱であること（開発者裁定 2026-09-12）を同レポート §2-2 へ載せた** —— それまで同事実は完了報告 §11 にしか無く、**設計卓が読む面へ出ていなかった**（レビュー 中-3）。
    9. **★★★【追補・2026-09-12】「述語のテスト」と「配線のテスト」は別物である。⇒ データが 0 件だと後者だけが静かに抜ける。** 開発者の「手動確認は飛ばしてよいか」という問いを受けて切り分けたところ、**`surfaceBuckets` の出力は測ってあったが、`VirtualController` が `buckets.inputMoves` を各パネルへ配っているかを測っていなかった**。**⇒ `setup_only` が 0 件のあいだは `inputMoves === moves` なので、`<HitBoxLayout>` / `<SpecialMovePanel>` を生の `moves` へ戻しても、`SetupRecipeEditor` の `context="setup"` を `"combo"` へ倒しても、全テストが緑のまま通る状態だった。** **★これは完了条件 2 / 3 がタブの面を名指ししているのに、`surfaceBuckets` の出力までしか測っていなかったということである。⇒ 破壊確認 3 通りを足して塞いだ**（完了報告 §4.5）**。★横断課題 (3) と同じ族だが、あちらは「値の取り違え」、こちらは「どの配列を渡すか」である。**
### M30-05: ファミリー行の表示名に残る強度語を落とす（2026-09-12）

- **結果**: 方式は**案 (b) 位置規則のみ**（先頭装飾 `【…】` / `[…]` の直後の強度語だけを落とす）。**例外辞書は不要＝辞書に載る行数 0 ／ CHANGE 0 本 ／ マイグレ 0 本 ／ 自採番なし**。段 1 の全数実査（seed CSV 31 キャラ・ファミリー行 372）＝素朴一致 61 行の内訳 **(A) 落とす 23 ／ (B) 丸括弧内の派生元強度 22 ／ (C) 固有名の一部 1 ／ (D) 強度語でない 15**、**判別できない行 0 件**。**(A) 23 → 0・(B) 22 は不変**を陽性対照つきで実測。**ファミリー識別子 372 件の digest は前後で同一**（`b54d118…`）、総数 372 と `is_derived` 群 194:178 も不変。`go test ./...` 緑 ／ `pnpm test` 2746 全緑 ／ `tsc --noEmit` 緑 ／ **`make e2e` 全数 301 passed / 0 failed / 1 flaky**（`m31-02` のドラッグ選択・本サブと無関係）／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M30-05-completion-report.md` ／ レビュー `docs/progress/m30-05-review.md`
- **レビュー**: 指摘 12 件（高 1 / 中 5 / 低 6）。**「高」の不採用は 0 件**。不採用は 低-6 の 1 件のみ（末尾形正規表現の二次挙動。**着手時点のリテラルと同一の意味であり本サブ由来ではない**）。低-5 は一部採用。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★`moveSurfacing.roster.test.ts` 冒頭の「実 DB 3026 行 / 差 283 行」は失効している**（実測 **3057 / 314**。差の 31 は `000109` の drive_reversal × 31 キャラ）。**★本サブはその数字を新規 2 ファイルへ写してしまい、レビュー 高-1 で検出された**（`D-250` と同型）。**⇒ 写した側は時点つきの実測値へ直したが、源泉は `M31-06` の持ち物のため触っていない。同サブか設計卓の手番で直す候補。**
    2. **★★(B) 群のうち 4 行は、強度語とは別の型の問題を抱えている**（`cammy/silent_step` ／ `cannon_strike_hooligan_combination` ／ `reverse_edge_hooligan_combination` ／ `fatal_leg_twister`）。**弱/中/強が選べるのに行の名前が「弱…派生」で固定されており、中や強を選んでも名前が変わらない。⇒ 代表名が 1 メンバーの名前そのものである、という別 identity の話であり、落とす方向では解けない**（落とすと §0.3 の禁止に触れる）。**開発者裁定（2026-09-12）＝本サブでは触らない。起票の可否は設計卓の手番。**
    3. **★射程 identity `special-family-label-keeps-strength-word` は本サブで解決した。** `followup-backlog.md` の当該行は「起票済み・未投入」のままであり、**製造が直接書けるのは §J だけ**（`D-382`）。**⇒ 設計伝達レポートで行の畳み込みを請求する。**
    4. **★共有テストを避けた代償を 1 つ作った。** `M31-06` との並列（指示書 §0.6）のため `moveSurfacing.roster.test.ts` を触らず、CSV ローダを `seedRoster.fixture.ts` へ新設した。**⇒ 同型のローダが 2 か所に在る。`M31-06` 着地後の手番で統合する候補**（そのとき `.fixture.ts` の置き場＝`web/src/` 配下で初の命名であることも併せて決めたい）。
    5. **★`check-import-order.sh` のベースラインは 101、実測 99 のまま**（`M35-02` ／ `M31-04` ／ `M35-03` に続き 4 サブ連続）。**本サブでも下げていない**（`D-388`）。**⇒ 既に §J `import-order-baseline-101-vs-99` が立っている。**
    6. **★★【2026-09-12 追補・開発者の実機確認が返った】A / B / C / E は問題なし**（**⇒ 装飾 `【…】` `[…]` を残す判断で確定。`DES-004` への反映は保留解除**）**。★D**（cammy 4 行の陳腐化）**は「対応したい」＝起票する。⇒ 設計伝達レポート §4-2 を判断待ちから起票請求へ格上げした。**
    7. **★★追補で新規登録の請求を 2 件足した**（同レポート §4-8 / §4-9）。**(1) `od` トークンが識別子に残るファミリー 15 件の台帳**——**開発者の問い「OD 技で弱中強を持ち別技になっているものが他にないか」への答えは「他に 1 件（elena `lynx_whirl_od_spinning_scythe`）。ただし既に望む形であり追加修正は不要」である。⇒ 今後同型が現れたときのために記録を残す**（開発者要求）。**(2) 【ジャスト】の命名の揺れ**——**ルーク `flash_knuckle_perfect_light`（接尾形・変種へ畳まれる）とガイル `perfect_timing_light_sonic_boom`（接頭形・別ファミリーになる）で同じ UI 概念の見え方が割れている。★原因は実装ではなく seed の命名であり、【ホールド】側は全数が接尾形で揺れていない**（実測）。
### M26-05: 初回起動ウィザードの LAN 公開に警告と同意を入れる（`A6` の穴）（2026-09-12）

- **結果**: `DES-002` §8 の「警告」と「明示的な同意」が設定画面にしか無く、新規ユーザーが通るウィザードが無防備だった非対称を消した。方式は `D-826` の (ii)＝Step 5 に警告を足し、Step 7 の「あとにする」に同意ビューを挟む（`disabled={!consented}`）。**消費マイグレ 0 本 ／ CHANGE 0 本**（`CHANGE-185` は設計卓が先行反映済み）。**差分は 8 ファイル・523 insertions / 4 deletions で、`web/` の外は 0 バイト**——`LanModeConfirmDialog.tsx` ／ `PasswordSetForm.tsx` ／ `WizardPage.tsx` ／ `internal/` ／ `cmd/` ／ `migrations/` はいずれも無変更（`totalSteps = lanEnabled ? 8 : 6` も不変）。`pnpm test` 227 ファイル / 2746 全緑 ／ `tsc --noEmit` exit 0 ／ `pnpm lint` exit 0 ／ **`make e2e` 全数 exit 0（301 テスト＝300 passed / 1 flaky / 0 failed。取り込みの前後で 2 回回して同値）** ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。**破壊確認 2 通り**——`disabled={!consented}` を外すと単体 3 本と E2E 本体が赤、同意ビュー入場時の明示リセットを外すと単体 1 本だけが赤。
- **報告**: 完了報告 `docs/progress/M26-05-completion-report.md` ／ レビュー `docs/progress/m26-05-review.md`
- **レビュー**: 指摘 10 件（高 2 / 中 4 / 低 4）。**採用 9 件・不採用 1 件。「高」の不採用は 0 件。** **再レビュー往復 0 回**（上限 2 に対して 0）。不採用は 低-3 のみ＝「LAN 有効時に `lanHint` と警告本文が 2 段重ねになる」で、指示書 §3-8 / §4.4 が名指しで禁じている文言整理に当たるため射程外とした（レビュー自身も「違反ではない」と書いている）。
- **★実機確認**: **開発者が 2026-09-12 に実機で 3 点を確認し、いずれも問題なしと判定した**〔(a) Step 5 の警告枠の見え方 ／ (b) 同意ビューが段を丸ごと置き換える形 ／ (c) 同意ビューで段の「戻る」を出さず 2 クリック要る形〕**。あわせてゲート自体**（チェックせずに押しても進まない）**も実機で試した。★★製造は当初これを観測せずに「問題は無い」と完了報告へ書いており、訂正したうえで開発者へ回した**（`D-510` と同型）**。★読み上げ環境そのものは未検証である**——`role="alert"` の付与をコードとテストで確認したにとどまる。
- **★横断課題**:
    1. **★★★`DES-005` §5.1 と `DES-002` §8 の「先行反映」は、本サブの完了をもって as-built になった。** 両節は「`M26-05` の完了までは『あるべき姿』である」と自ら注記している。**⇒ その注記を外すのは設計卓の手番である**（製造は設計書を直接編集しない＝`CLAUDE.md` §8）。設計伝達レポートで回付する。
    2. **★★「同意ゲートは画面の中で閉じている」**（レビュー 設計準拠性以外 6）。**`PUT /api/config` へ直接 `{"server":{"mode":"lan"}}` を投げれば、同意なしで LAN 化できる。** ⇒ 本サブの射程外である（チェックリスト §6-2＝開発者が「実装を直す」と裁定したのは本件だけ）が、**公開ゲート `A` の判断材料として記録が要る。** `DES-002` §8.1 の 16 と「認証の根が無い状態では誰も止められない」という既存の帰結と同じ層の話であり、欠陥というより割り切りの範囲だが、**「抜けられない」を UI 層だけで担保している事実は残しておく。**
    3. **★★`workers: 1` の固定を知らないまま「ファイル単位では並列に走る」と書いた E2E コメントが、少なくとも 2 本の既存 spec に現存する**（`m22-01-auth-gate.spec.ts` ／ `m22-06-connection-qr.spec.ts`）。**本サブはこの文面を手本として写し、レビューに「失効している」と指摘されて直した**（高-2）。**★対処そのもの（共有資源を書き換えずコンテキスト単位で再現する）はどちらも正しい。失効しているのは理由だけである。** ⇒ 既存 2 本の是正は本サブの射程外（他サブのファイル）。**★手本を写すときは、手本の理由づけが今も成り立つかを確かめること。**
    4. **★チェックリスト `E-3` の「既存 296 本」は失効した数字である。** 着手時点で既に **299 本**あった（`M30-04` が 2026-09-12 に 3 本を是正して 296 → 299 にしている）。本サブの 2 本を足して **301 本 ＋ 本サブ追加分**。⇒ 件数を固定した観点は、書いた時点の値をそのまま次のチェックリストへ写すとずれる。
    5. **★★`make e2e` 全数で `m31-02-tag-field-drag.spec.ts` の「右へ枠外までドラッグしても文字選択が消えない」が flaky になった**（初回赤・retry で緑）。**★2 回回して 2 回とも同じ 1 本である**——取り込みの前と後で全数を回し、どちらも `300 passed / 1 flaky`、flaky の中身も同一であった。**本サブの diff と面が交わらない**（ウィザード 2 本・そのテスト 3 本・locale 2 本・E2E 1 本のみ）。**★それでも「着手前から不安定」とは書かない**——**着手基点で測っていないためである。** 分かっているのは「本サブの 2 つの状態で再現した」ことだけであり、いつからかは言えない。⇒ 再現性は高いので、**改善レーンか次に全数を回す担当が着手基点で 1 度測れば常態かどうかが決まる。**
    6. **★i18n のブロック名とコンポーネント名が 1 つずれている**（`wizard.step7.*` ＝ 完了画面 ／ `Step07Password.tsx` ＝ パスワード段）。本サブは新ブロック `wizard.password.*` を立てて回避し、`Step07Password.tsx` の godoc へ 3 行残したが、**ずれそのものは残っている。** ⇒ 整理は射程外（指示書 §3-8）。
    7. **★「床が 2 枚あるとき、どちらが効いているかはテストでは弁別できない」**（`M30-04` 横断課題 3 と同型）。本サブの「段をまたいだ同意のリセット」は unmount と明示リセットの 2 機構が独立に満たしており、**片方を消しても `WizardPage.test.tsx` は緑のままである**（変異注入で実測）。⇒ 実測をテスト内のコメントへ逐語で残し、後任が「このテストが緑だからリセットは効いている」と誤読しない形にした。
    8. **★★【2026-09-12 解消済み】`check-progress-log-index.sh` が `m26-04` の欠落で赤になっていた。本サブの追記ではない。** 着手基点 `aa0be70` の時点で `progress-log.md` に `M26-04` の文字列は **0 件**であり（実測）、完了報告 `docs/progress/M26-04-completion-report.md` は `542d6d3` で先に入っていた。**★原因は「取り消し」ではなく「退避」であった**——`da19a56`（`0 insertions / 20 deletions`）が、main へのマージで同ファイルが必ず衝突し、開発者が手元でマージコミットを作ると製造ブランチが分岐して製造が以後 push できなくなることを避けるために 20 行を外していた。**⇒ 前担当からの引継ぎ依頼を受け、`47c68ff` の 20 行を本ファイルの末尾へ差し戻した**（退避時の行位置へは戻さない。同ファイルは追記のみの運用であり、マージで後ろに他サブの節が増えているため）。**検査は違反なしになった。★ALLOW 表へは 1 行も足していない**——免除ではないため。**★当初は「製造は他サブの索引行を代筆しない」と書いたが、本件は代筆ではなく退避分の復元である**（逐語が `47c68ff` に残っており、`diff` で完全一致を確認した）。⇒ 推測で埋める余地が無いため、製造の手番として差し支えない。

### M26-04: セキュリティ実査と公開前スキャン（`A6` / `A9` / `A7`）（2026-09-11）

- **結果**: `A6` の実査 3 件を実物の行で判定した——**(a) 警告は在る**（`LanModeConfirmDialog.tsx:60-71`。**ただし「強く推奨します」は実装に 0 件**で、実装は「（おすすめ）」）**／ (b) 同意ダイアログは在る**（同 `:97-127`。チェックボックス必須＝`:118-121`）**／ (c) `SUPP-001:1495` は前半が失効・後半は現存**（`Security.PasswordEnabled` は M22-01 で配線済み＝`auth/service.go:74` ／ `middleware/auth.go:62-64`。**LAN で無認証経路が既定で残るのは `DES-002:1225` が選んだ設計**）。**走査**＝`gitleaks` ツリー 11 件 ／ 履歴 23 件を検出、**全件同一の偽陽性**（dee_jay の技コードが `generic-api-key` に当たる）。**1 件も削除していない**。`gosec` 59 件をトリアージ（**サーバ本体の HIGH は 0 件**）。**`golangci-lint` は go バージョン不整合で実行不可**（`D-659` に従い回避策を作らず停止）。**SCANOSS は開発者裁定により製造では未実施**。**書き込みは `SECURITY.md` §5 新設と `CONTRIBUTING.md` の導線差し替えの 2 本のみ。GitHub 設定は 1 つも変えていない。`README.txt` / `NOTICE` は 1 バイトも触っていない**。**CHANGE 0 本消費 ／ 1 本請求**。**マイグレ 0 本**。`go test` 59 ok / FAIL 0 ／ `pnpm test` 2719 全緑 ／ `tsc --noEmit` exit 0 ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M26-04-completion-report.md` ／ レビュー `docs/progress/m26-04-review.md`
- **レビュー**: 指摘 12 件（高 3 / 中 5 / 低 4）。**「高」の不採用は 0 件**（**12 件すべて採用**）。主要指摘＝**高-2「`SECURITY.md` §5 を新設したことで `CONTRIBUTING.md` §0 の『受け付けているのは脆弱性の報告だけ』が失効した」**（**本サブ自身の書き込みが作った失効であり、編集した当のファイルの 2 行上だった**）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★`A6` に不足が 1 件ある——初回起動ウィザードには警告と同意ダイアログが無い。** 設定画面経由（`SettingsSectionNetwork`）だけが両方を持ち、`LanModeConfirmDialog` の参照元は実測で 1 本だけである。**★ただし「完全に無防備」ではない**——`WizardPage.tsx:116-117` が `Step07Password` を挿すため、**3 要素のうち「パスワード設定への誘導」は在り、欠けるのは「警告」と「同意ダイアログ」の 2 つ**である。**⇒ 直していない**（指示書 §0.1＝実査して記録するサブである）。**★直すかは開発者の手番であり、2 択のどちらにも倒れないまま残さないこと**——**(A) 実装を直す＝別サブ ／ (B) 直さない＝`DES-002` §8 へ as-built 注記の CHANGE を請求する。** `DES-002:101` / `:1160` / `:1161` はいずれも経路を限定していないため、放置すると設計書が as-built と食い違ったまま残る。
    2. **★★`SUPP-001:1495` と `followup-backlog` の `F12-8` が同じ失効を共有している。** どちらも「`Security.PasswordEnabled` 実配線は未了」を前提に書かれているが、**M22-01 で配線済みである。⇒ 同じ手番で直すこと。** CHANGE の起票は設計卓（`D-293`。本サブは自採番していない）。
    3. **★★本サブの書き込みが `SUPPORT.md` §2 の受付表を失効させた。** 同 `:15-19` は「脆弱性の報告 ／ バグ報告・要望 ／ 外部からの PR」の 3 行しか持たず、**新設した `SECURITY.md` §5 の窓口が載っていない。⇒ 先に `SUPPORT.md` を読んだ権利者は窓口が無いと判断する。** **★同ファイルは指示書がどちらのサブにも割り当てていない**（`M26-04` は `SECURITY.md` / `CONTRIBUTING.md`、`M26-03` は `README.txt` / `NOTICE` §3）**ため直していない。⇒ 手番を決めること。**
    4. **★★`rights-holder-contact-channel-missing` の残りを「2 本」と数えないこと。** 同行の実測内訳は **`README.txt:136` は適合 ／ `NOTICE:33` は不適合 ／ `CONTRIBUTING.md:62` は不適合**であり、**本サブが `CONTRIBUTING.md` を片づけたため残るのは `NOTICE:33` の 1 本**である。**★指示書 §2.3-3b が「`README.txt` と `NOTICE` §3 の 2 本は `M26-03` が持つ」と書いており、そのまま渡すと既に適合している `README.txt:136` を不要に書き換える誘導になる。**
    5. **★★★全履歴のシークレット走査は本環境では完了できない。** クラウド実行環境は**浅いクローン**であり（`.git/shallow` 実在）、**到達可能な最古のコミットは 2026-09-02・435 revs**（`gitleaks` が走査したのは 367 コミット）。**⇒ `secret-scan-before-release` の (b) 全履歴は未完了であり、開発者のローカル（full clone）の手番である。★「走査して 0 件」と「到達できない」を同じ顔で出さないこと**（`E-84`）。**★同じ制約はクラウド実行の全サブに当たる。**
    6. **★★`check-doc-refs.sh` は `SECURITY.md` / `CONTRIBUTING.md` / `docs/` 本文を 1 バイトも見ていない。** 走査対象は**ルール面の 37 ファイルだけ**（`CLAUDE.md` ／ `web/CLAUDE.md` ／ `.claude/rules/*.md` ／ `.claude/commands/*.md`）であり、加えて検出正規表現が `docs|internal|web|scripts|migrations|cmd` の接頭辞を要求する（`scripts/check-doc-refs.sh:45`）。**⇒ 指示書 §5-3 が期待した「足すなら参照が増える」は三重にずれている。★同検査の緑を「参照が健全である証拠」と読まないこと。**
    7. **★`golangci-lint` はクラウド実行環境では回せない。** `/usr/local/bin/golangci-lint` は **v2.5.0（go1.25.1 ビルド）** であり、`go1.26.8` を対象とする本リポジトリのソースを解析できない（逐語＝`the Go language version (go1.25) used to build golangci-lint is lower than the targeted Go version (1.26.8)`）。**⇒ `govulncheck` の `vuln.go.dev` 403 と同じ型であり、`D-659` に従い回避策を作らず停止した。★devContainer の `v2.11.4` なら回る可能性があるが未検証。**
    8. **★`/ask_external_ai` は外部へ投げるコマンドではない。** 貼り付け用プロンプトを 1 本生成するだけであり、**実際に貼るのは開発者の手番である。★指示書が「`/ask_external_ai` で確認する」と書く箇所は、すべて「開発者の回答待ちが 1 回挟まる」ことを前提に読むこと。**
    9. **★★★【2026-09-11 追記】外部確認の回答が返り、`betterleaks` を採るのが妥当と判明した。** 同書は実在し（`github.com/betterleaks/betterleaks`）、**MIT ／ v1.8.1（2026-08-18）／ Gitleaks 原作者による後継**である。**★`gitleaks` 自身が「feature complete。今後は security patches のみ」と宣言している。⇒ 継続運用に新規採用するなら `betterleaks`。** 一次情報（`proxy.golang.org` / `pkg.go.dev`）で独立に裏を取った。**⇒ `secret-scan-before-release` 行の「着手時に実在・保守状況・ライセンスを確認する」は、これで閉じた**（設計卓が畳むこと）。
    10. **★★★2 つの道具の検出は 1 件も重ならなかった**（完了報告 §3.3 (c) の実測）。**`gitleaks` はツリー 11 / 履歴 23 を全件 `generic-api-key` で出し、`betterleaks` はツリー 53 / 履歴 477 を全件 `generic-password` で出した。⇒ 互いに相手の検出を 1 件も出していない。★「公開直前の一度だけは両方を回す」が実測で裏づけられた。** なお **`betterleaks` の 53 件も全件偽陽性**であり（一意な一致文字列は 11 種類＝認証テストの固定値 ／ キー名が `Password` で終わる i18n 文言 ／ `PathPassword = "/api/auth/password"`）、**本リポジトリでは素の `betterleaks` のほうが騒がしい。⇒ CI へ据えるなら抑制設定を先に書くこと。書かずに入れると 53 件の赤を毎回見ることになり、やがて誰も見なくなる。**
    11. **★★`gitleaks/gitleaks-action` は MIT ではなく独自 `GITLEAKS-ACTION EULA` である。⇒ `CLAUDE.md` §6 の許可列に無く採用できない。** **★CLI 本体は MIT であり、Action ラッパーを使わず版指定で直接インストールすれば回避できる。** `betterleaks` 側も公式 Action は無く、確認できたのは第三者製である。**⇒ どちらも CLI を直接回すこと。**
    12. **★★★【2026-09-12】SCANOSS は本環境では実行不可である。** 開発者裁定で「いま回す」へ変更し実行を試みたが、**既定の送信先 `https://api.osskb.org`**（`scanoss/scanossgrpc.py:71` の `DEFAULT_URL`。**`api.scanoss.com` は API キー使用時の premium 宛先であり既定ではない**）**がエージェントプロキシに 403 で拒否された**（`connect_rejected`＝policy denial。`curl` で 2 度再現）。**★`M26-01` の `govulncheck` が `vuln.go.dev` へ 403 だったのと同じ型であり、`D-659` に従い回避策を作らず停止した。⇒ 開発者のローカルの手番。** **★★`WFP` のローカル生成までは成功しており、何が送られるかは実物で確認できた**——**(1) ファイルの MD5 (2) バイト数 (3) 相対パス（平文） (4) スニペットのローリングハッシュ。★ソース本文は入らないが、「ハッシュだけ」も不正確である**（パス名は平文）。手順は完了報告 §4.2。
    13. **★`CI` 来歴署名は「当面やらない」で確定した**（開発者裁定・2026-09-12）。**理由＝配布形態が「zip を落として exe を起動する」であり利用者が来歴を検証する導線が無い。⇒ 同じ手番を割くなら `B1` コード署名が先である**（未署名だと Windows SmartScreen の警告が出るという実害を消す）。**入れるとすれば `B1` の後、リリース用ワークフローに付ける。**

### M32-01: 操作説明書の器と `README` の整理（`B4` の構造 ＋ `B6`）（2026-09-12）

- **結果**: 器を `docs/usermanual/tacpendium-readme.html` へ立てた（旧 `combmgr-friend-readme.html` を改名し本文を差し替え＝`D-766`。**22 章のスケルトン ／ 目次 ／ アンカー ／ `B6` ／ CSS カウンタ番号。本文は 1 行も書いていない**）。`README.txt` の**正本を `docs/usermanual/dist-readme.txt` へ置き、ルートの `README.txt` は生成物**にした（方式 (b)＝`D-755`。**★`README.txt` は動かしていない**）。生成・照合は **`scripts/check-dist-readme.sh` の 1 本・引数なしで照合**（`D-766` の「どちらのリポジトリでも動く 1 コマンド」）。**破壊確認は 3 方向で実測**（正本を直して生成し忘れた形 ／ 生成物を手で直した形 ／ `--write` で追随する形）。`CHANGE` 消費 **0 本** ／ マイグレ消費 **0 本**。`go test` 60 ok / FAIL 0 ／ `pnpm test` 228 ファイル・2795 件すべて緑 ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M32-01-completion-report.md` ／ レビュー `docs/progress/m32-01-review.md`
- **レビュー**: 指摘 13 件（高 2 / 中 5 / 低 6）。**「高」の不採用は 0 件**（**13 件すべて採用**）。主要指摘＝**高-1「完了報告が `check-progress-log-index.sh` を緑と書いているが実際は赤で、未了の完了条件が緑として記録されていた」**（本行の追記がその是正である）／ **中-1「`--self-test` の陽性対照が `compare` の 1（差分）と 2（実行エラー）を区別せず、照合が壊れていても『自己検査: 合格』を出せた」**（**レビューが false green を実証した**）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★指示書 §5-4 の「旧名を名指しする箇所が 0 件であること」は達成不能である。** 着手時 27 件のうち **25 件は歴史記録**（`parallel-board` ／ 完了報告 ／ レビュー ／ 設計伝達レポート ／ CHANGE 通知 ／ `followup-backlog` ／ 指示書本体）であり、本プロジェクトの運用では書き換えない（`D-274` (3)）。**⇒ 「生きている参照が 0 件」で判定した**（実際に直したのは `.claude/commands/cleanup_docs.md:251` と `docs/human-notes/future-notes/INDEX.md:53` の 2 件）。**★改名を伴うサブの否定形確認は、以後この読み替えを前提に書くこと。**
    2. **★★`README.txt` / `README.md` が案内する操作説明書は、いま中身が無い。** 本サブは器だけであり、22 章すべてが `.todo`・画像 22 枚が未配置である。**⇒ 両 README へ「現在準備中です」の暫定表記を入れた。★`M32-02` はこれを外すこと**——**外し忘れると「準備中のまま完成した」という逆向きの失効が残る。**
    3. **★★操作説明書への到達経路が存在しない。** `README` は `docs/usermanual/tacpendium-readme.html` を名指ししているが、**(a) URL が書けない**（`P-46`＝公開リポジトリの運用形態が未決）**／ (b) zip に同梱されない**（`DES-002` §11.2 の構成は exe と `README.txt` のみ）**／ (c) GitHub 上の `.html` はソース表示になり読める形にならない**。**⇒ `B4` の価値がここで止まる。決着は設計卓・開発者の手番。**
    4. **★★【2026-09-12 裁定・反映済み】実行ファイル名を `tacpendium-windows-amd64.exe` へ統一した。** 着手時の `README.txt` は、起動方法で `tacpendium-windows-amd64.exe`、ファイアウォール手順で `tacpendium.exe` と**同じファイルの中で 2 つの名前を案内していた**（後者を作るビルドターゲットは存在しない）。**★CI も同名を出す**（`nightly-crossbuild.yml` は `make build-all` を呼び `dist/tacpendium-windows-amd64.exe` を検査する。実査）。**⇒ `README.txt` は反映済み。★★`DES-002` の 3 か所**（`:25` 構成図 ／ `:76` シーケンス図 ／ `:1380` §11.2）**が残っており、設計卓の手番である**（設計伝達レポート §6-1 で請求）。**★波及 2 件＝`.github/workflows/nightly-crossbuild.yml:105` のコメントと `followup` `release-zip-missing-license-files` の根拠文面。★`:25` / `:76` は「単一バイナリである」ことを示す図であり、配布物名とは意味が違いうる。機械的に置換しないこと。**
    5. **★★【2026-09-12 裁定・反映済み】`DES-002` §11.1 が求める「Windows 公式サポート ／ macOS・Linux 非公式」の明示を `README.txt` へ足した**（開発者の逐語＝「射程外ですが今のうちに追記してください」）。**★設計書側の変更は要らない**——設計書は既に「明記せよ」と書いており、足りなかったのは実装側である。**⇒ CHANGE 不要。**
    6. **★★`check-artifact-integrity.sh` を 1 本目に回す運用が、本サブで実際に効いた。** 新設した `--self-test` の成功行の文言が `SELFTEST_MARKER='自己検査: 合格'` に当たらず、**「宣言だけで実装が無い」と赤で検出された。⇒ 自己検査を書いたという宣言が、検査機構に繋がっていなかった。★`scripts/check-*.sh` を新設するときは、マーカー文言を先に確かめること。**
    7. **★`check-doc-refs.sh` は `docs/` を 1 バイトも走査しない**（走査元は `CLAUDE.md` / `web/CLAUDE.md` / `.claude/rules/*.md` / `.claude/commands/*.md`）**。⇒ 指示書 §5-6 が期待した「新設ファイルの参照が dead になっていないこと」は、`docs/usermanual/` 配下が書いている参照については担保しない**（`M26-04` 横断課題 6 と同型）。**★同検査の緑を「参照が健全である証拠」と読まないこと。**
    8. **★`B6`（クラシック前提の明示）は 3 か所にある**（`README.md` ／ `README.txt` ／ 器）**。正本を名指しする仕掛けは無い。⇒ モダン操作に対応した時点で 3 か所を同時に直す必要がある**（`E-76`）。`followup` 登録候補。
    9. **★完了条件 §6-3（改名先の案 2〜3 本）は `D-766` で失効していた**（§7-1 が「案出しは不要」と明記）**。⇒ 完了条件の表だけが取り消し前の文面で残っていた。★指示書を改訂するときは §6 の表も併せて見ること。**
    10. **★`docs/handover/roles-and-routing.md` の「停止時の記録先＝`followup-backlog.md` §J へ直接」は `D-838`（2026-09-12）で失効している**（製造・レビュー・取り込みは設計伝達レポート §4 へ原稿として書く）。**本サブ由来ではないが、現役資料に失効した記述が残っている。** レビューが独立に検出した。
### M30-06: ファミリー行の代表名が 1 メンバーの名前になっている（2026-09-12）

- **結果**: 方式は **(a′) 判定を位置ではなくデータに置く**＝ファミリーに属するメンバーの表示名の差が**強度語だけ**のときに限りその強度語を落とす。**丸括弧という位置は見ない。⇒ `DES-004` §2.1 の規約と衝突しない。★指示書が先に試せと言う素朴な案 (a)**（丸括弧の中を位置で落とす）**は実測で成立しない**——同一表示になるファミリーの組が **1 組 → 6 組**（新たに 5 組 13 ファミリーが区別不能）。段 1 の全数実査（seed CSV 31 キャラ・raw ファミリー 397）＝**メンバー間で名前が割れる 10 件**のうち**畳んだのは 4 件**（cammy）、**判別できない行 0 件**。**ファミリー識別子 372 件の digest は前後で同一**（`b54d118…`）、総数 **372** と `is_derived` 群 **194:178** も不変。丸括弧内に強度語を持つ行 **22 → 18**（減ったのは対象 4 行ちょうど）。**`stripStrengthLabel` の差分 0 行 ／ `character_data` `migrations` `internal` `cmd` の差分 0 バイト ／ CHANGE 0 本・マイグレ 0 本・自採番なし**。`pnpm test` 2808 全緑 ／ `tsc --noEmit` 緑 ／ **`make e2e` 全数 307 passed**（`m30-05` の 3 本を無変更で含む）／ `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M30-06-completion-report.md` ／ レビュー `docs/progress/m30-06-review.md`
- **レビュー**: 指摘 12 件（高 5 / 中 3 / 低 4）。**「高」の不採用は 0 件**。不採用は 低-11 の 1 件のみ（下記 3）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★`DES-005` §6.1 に失効が 2 か所できる。CHANGE 請求の中身である**（完了報告 §6.2）。**(A) 末尾の「残っている課題 (1) 代表名が 1 メンバーの名前そのものになる行が 4 件ある〔cammy〕⇒ `M30-06` の射程」は解消済みであり撤回が要る**（残る課題は `P-56` の 1 つになる）**。(B) 位置別の表の「丸括弧の中 ／ 派生元の強度 ／ 22 行」はファミリー行としては 18 行**。**★ただし `stripStrengthLabel` の出力としては 22 行のままであり、どちらを指すかを書き分けること。⇒ 新規則だけを追記すると (A)(B) が残る。** 採番は設計卓（`D-293`。レジストリは `190` を本サブ用に見込む＝`D-840`）。
    2. **★★lily に着手前からの同一表示が 1 組ある**（`windclad_condor_dive_follow_up` と `condor_dive_follow_up` がどちらも「コンドルダイブ(派生)」）。**★本サブが作った差ではない。機序は seed の `name_ja` に `[風纏い]` が入っていないこと**（同キャラの `windclad_condor_dive` には入っている。**派生行だけ抜けている**）**＋ 接頭形の `OD` が落ちること。⇒ 直すなら seed 側であり `name_ja` を触るため番号の請求が要る。★本サブでは「増えていないこと」だけを床で固定した。**
    3. **★★`docs/handover/roles-and-routing.md:116` が `CLAUDE.md` §9（`D-838`）と食い違う**——同行は「レビュー担当は `followup-backlog.md` §J へ記録して停止」と書いているが、**2026-09-12 の `D-838` で製造・レビュー・取り込みは設計伝達レポート §4 へ原稿として書く運用へ一本化された**。**★本サブが作った差ではないため直していない**（射程外）**が、レビュー担当が最初に読む資料である。⇒ 設計卓の手番。**
    4. **★「代表名を畳んだ強度語が、そのメンバー自身の強度と対応していること」は実装が確かめていない**（差が強度語であることしか見ない）。**現 seed では 4 ファミリー 12 行すべて対応しており、roster テストで床にした**（レビュー 中-1 の案 b）**。⇒ 対応がずれた seed が入ると、行名から情報が消えたうえにボタンの意味も食い違う形になりうる。★実装側で強度一致を要求する案 (a) は採らなかった**——将来「派生元の強度と行の強度軸が別物なのに落としたい」形が出たとき窮屈になるため。
    5. **★★【2026-09-12 追補・開発者の実機確認が返った】完了報告 §8 の 5 項目について「問題なかった」と判定**（**★判定の粒度は一括であり、項目ごとの内訳は得ていない**）**。⇒ とくに項目 ⑤**（`(フーリガン派生)` という残し方が読みやすいか）**は設計判断であり、これが OK になったことで `DES-005` §6.1 への反映に保留事項は無くなった。★設計伝達レポート §4-6 を「未了」から「返った」へ更新済み**（初版 `0647d78` だけを読むと未了のまま判定することになる）**。**

### M32-02: 操作説明書の本文（`B4` の中身）＋ UI の粗の記録（2026-09-12）

- **結果**: 器の 22 章 **88 か所**のプレースホルダをすべて本文にした（段 1〜5 の 5 コミット ＋ 仕上げ 1 本）。**第 2 の成果物＝UI の粗を 28 件記録**（長くなった 11 ／ 順序の逆行 6 ／ 語の揺れ 4 ／ 3 つに絞れなかった 4 ／ 本文が弁解を負った 3）。**暫定表記「現在準備中です」は 4 か所とも外した**（`README.txt` は直接編集せず `--write` で再生成）。**`.src` / `.toc-src`（`DES-005 §5.x` の可視表示 44 か所）を CSS 1 行で隠し、器が残していた「決めずに公開しないこと」を閉じた**（開発者裁定）。**ch16 の章名を「インポート」→「取込」へ**（開発者裁定。退けた語だった）。スクリーンショットは **27 枚ぶんの枠**を空けた（撮影は開発者の手番）。**CHANGE 消費 0 本 ／ マイグレ消費 0 本 ／ 実装差分 0 行**。`go test` 60 ok / FAIL 0 ／ `pnpm test` 229 ファイル・2810 件すべて緑 ／ 常設検査は `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M32-02-completion-report.md` ／ レビュー `docs/progress/m32-02-review.md`
- **レビュー**: 指摘 11 件（高 4 / 中 3 / 低 4）。**「高」の不採用は 0 件**（4 件すべて採用）。不採用は 低-1 / 低-2 の 2 件のみ。主要指摘＝**高-1「『書き出しには件数の上限がありません』が実装と食い違う」**（実装は `exportRowLimit = csvcore.DefaultMaxRows = 1000` でコンボ 1000 件で打ち切る）／ **中-1「粗の網が 4 型に閉じ、本文が弁解している箇所が 1 件も拾われていない」**（5 つ目の型を新設し 25 → 28 件）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★`DES-005` §5.14 の節名が「インポート」のままである。⇒ `M24-07` で退けた語であり `retired-words.test.ts` の禁則語である。★同書 §2 の画面一覧は `CHANGE-147` で「取込(CSV)」へ改名済みであり、片側だけが古い。** **★★機械で捕まらない理由を突き止めた——`retired-words.test.ts` の走査対象は `web/src` だけであり、`docs/` を 1 バイトも見ない**（同ファイル自身が注記している。`M29-01` 完了報告 §7 も同じことを書いている）**。⇒ 設計書・説明書側の語の統一は、構造的に人が読む以外の経路が無い。★CHANGE 請求は完了報告 §6-1。**
    2. **★★★`DES-005` §5.13a の `CHANGE-165` 注記「書出に行数・バイト上限が無いのに、取込は 1000 行 / 10MiB で弾く」が実装と食い違う。⇒ 書き出しは*コンボ 1000 件*で打ち切られる**（`internal/service/comboio/export.go:18` / `:136` ／ `csvcore/rules.go:10`。打ち切り時は `export.truncation.body` の確認が出る）**。★上限が無いのは「セットプレイの行数」と「バイト数」である。★★同じ逐語が `export.go:80` のコード注釈にも在り、2 か所が同じ失効を共有している。⇒ 設計書を写した本文が実装とずれる形で実際に発現した**（レビュー 高-1）**。CHANGE 請求は完了報告 §6-1b。★レビューは「省略表現なのか見落としなのか判断できない」としており、製造も判断していない。**
    3. **★★操作説明書への到達経路（`P-57`）は未決のままだが、本文が 22 章そろったことで優先度が上がった。** `README` が案内する先に実体が在る状態になったのに、**(a) URL が書けない ／ (b) zip に同梱されない ／ (c) GitHub 上の `.html` はソース表示になる** は変わっていない。**⇒ `B4` の価値はここで止まる。★あわせて器が Google Fonts を `@import` で読むため、zip 同梱を採るなら「同梱物が外部へ接続する」ことの可否も同じ手番で決まる**（レビュー 低-3）。
    4. **★目次末尾の 1 文が、利用者に内部の設計書パスを見せている**（逐語＝「全 22 章。`docs/design/05-screen-design.md` §5 の画面 24 節のうち…」）**。⇒ `.src` / `.toc-src` を隠した結果、ここが読み手から見える唯一の内部参照として残った。★目次は `M32-01` の成果物であり開発者の裁定は `.src` / `.toc-src` についてのものだったため触っていない**（`E-4`。レビューもこの判断を妥当としている）**。⇒ 公開前に扱いを決めること。**
        - **★★★【2026-09-15 決着＝開発者裁定】外した。** 開発者の逐語＝**「説明書に設計書の参照は付けたくありません」（2026-09-15）**。⇒ 目次末尾の 1 文を **「全 22 章。アプリの画面ごとに 1 章です。」** へ置き換えた。**★描画で実測し、読み手に見えるテキストから `docs/design` / `DES-005` / `§5.13` / `§5.17` の痕跡が 0 件であることを確認した。** **★`.src` / `.toc-src` の 44 件は `display:none` のまま据え置き**〔2026-09-12 の裁定＝「隠す。要素は残す」。**`§5.13` / `§5.17` は同 44 件に含まれないため本裁定の射程外**〕**。**
    5. **★`DES-005` §2 の画面一覧に §5.19b と §5.13a の行が無い**（表は 22 行）**。§3 の画面遷移図にも §5.19b / §5.20 / §5.21 / §5.22 / §5.13a / §5.19 が無い**（`:111` に「主要な遷移のみ記載」の注記はある）**。⇒ 本サブの対応表は §5 の節見出しを正とした。★次に画面数を数えるサブは、§2 の表を母数にしないこと。**
    6. **★★「粗の型」は指示書が挙げた分で閉じない。** 指示書 §2.4 の 3 型（長くなった／順序が逆行する／語が揺れた）＋ §4.5 由来の 1 型で初版を書いたが、**レビューが 5 つ目——「本文が『これは壊れていません』と書かされている箇所」——を指摘し、3 件が出た。⇒ `B4` の逐語「説明が要る箇所＝設計が負けている箇所」に最も近いのは、実はこの型である。★次に同種のサブを起こすときは、型を増やす余地を指示書側に書いておくこと。**
    7. **★スクリーンショット 27 枚は未配置である**（22 章 × 1 枚 ＋ 複雑な 5 章に 2 枚目）**。撮影と貼り込みは開発者の手番。★撮り終えたら `figure` の `todo` クラスを外すこと**（未記入であることを示す枠線・背景色が付いている）**。★レビューも「画像が入った状態の版面は確認できていない」と制約事項に挙げている。**
### M30-07: 【ジャスト】版の `move_code` を接尾形へ揃える（ガイル 3 ファミリー）（2026-09-12）

- **結果**: guile の `perfect_timing_<強度>_<技>` **10 件**をルークと同じ接尾形 `<技>_perfect_<強度>` へ改名し、**CSV 正本 → golden 再生成（`000026` / `000034`）→ 追随マイグレ `000112`** の三点を揃えた（**マイグレ消費 1 本＝`000112`・設計卓払い出し `D-836`。CHANGE 0 本**）。**ファミリー総数 372 → 369 ／ `is_derived` 群 194:178 → 194:175 ／ 識別子 digest `b54d118…` → `525b584c…` ／ 表示名 digest `a7ee6db5…` → `6835bedf…`。★床は 1 か所も緩めていない**（(A) 群 23 → 20 は `EXPECTED_FOLDED_PERFECT` 新設で 20+3=23 を保ち、E2E も 1 本 → 2 本＋新 test 1 本へ差し替え）。段 1 実測＝【ジャスト】13 件（接頭 10 / 接尾 3）・**【ホールド】系の接頭形 0 件**・`original_move_code` 参照 0 行。`go test ./...` 全緑 ／ `pnpm test` 2811 全緑 ／ **`make e2e` 全数 308 passed** ／ `check-artifact-integrity.sh` を 1 本目に回して違反なし ／ `check-migration-license.sh` 破壊確認つきで違反なし。
- **報告**: 完了報告 `docs/progress/M30-07-completion-report.md` ／ レビュー `docs/progress/m30-07-review.md`
- **レビュー**: 指摘 7 件（高 2 / 中 5 / 低 0）。**★「高」の不採用は 0 件。不採用そのものが 0 件である。** 再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★`move_code` の改名は「後続の手書きマイグレ」を壊しうる。本サブがその初の実例である。** 旧 code が `000039`（is_projectile）／ `000063`（改名の `NOT EXISTS` ガード）／ `000064`（startup_basis ＋ move_derivations）から参照されており、**golden を再生成しただけでは新規 DB で静かに壊れる**（`is_projectile` 7 行 ／ `startup_basis` 10 行 ／ `move_derivations` 3 対が落ち、さらに `000063` B-2 のガードが反転して `sonic_cross_2_meter_od` が誤改名される）。**⇒ 案 1（適用済みマイグレの `code` 列挙の書き換え・開発者裁定 2026-09-12）で解いた。先例は `000063` ヘッダ自身が持つ（`M19-04c`）。★機械検査は無い。** 申し送り `move-code-rename-breaks-later-handwritten-migrations`。
    2. **★★★`SUPP-001` §5.5.4 規約 (9)「前コホート救済 UPDATE」の適用を落としかけた**（レビュー 高-1 で発見）。**`code` 列挙を書き換えると「旧 golden で seed され途中の版で止まった DB」に欠陥が残る。⇒ `000112.up` へ救済 4 文を追加した。★規約 (9) の後段どおり、案比較が片手落ちになっていた**（案 2 の欠点だけを書き、案 1 側のコホート欠陥に触れていなかった）。**★指示書・チェックリストのいずれにも「コホート」の語が無く、`SUPP-001` §5.5.4 を (8)/(10)/(16) しか引かなかったため到達しなかった。** 申し送り `rule9-cohort-rescue-not-surfaced-in-instructions`。
    3. **★★「救済は要らない」を推論で決めると外す。** `move_derivations` の 3 対について「取り落としの経路が無い」とヘッダへ書いたが、**新設した `TestRun_M3007_OldGoldenCohortReachesHead`（旧 golden コホートを v62 で再現して HEAD まで上げる）が実測で反証した。⇒ コホートを再現するテストを書くまで見えなかった。**
    4. **★`DES-004` §2.1 の保留 `P-56` は解消した**（【ジャスト】の命名が接頭形と接尾形に割れている件）。**同節には「裁定待ち」と guile の接頭形の表が現在形で残っており失効する。⇒ as-built 化は設計卓の手番**（`D-293`）。申し送り `des004-s21-perfect-variant-naming-as-built`。
    5. **★`check-import-order.sh` が実測 99 / ベースライン 101 で「2 ファイル少ない」と出る。★本サブ起因ではない**（`web/src` の import 行は 1 行も触っていないことを diff で確認）。**`D-388` によりレーン内では下げていない。⇒ 改善レーンの手番。** 申し送り `import-order-baseline-drift-101-to-99`。
    6. **★★【2026-09-12 追補・開発者の実機確認が返った】完了報告 §11 の 8 手順について、人が見たのは 2 件**〔ソニックブームで【ジャスト】が選べること（逐語＝「動作確認はOKでした」） ／ **ソニッククロスの【ジャスト】で OD を入れられること**（逐語＝「ソニッククロスの【ジャスト】で ODを入れる事はできました」）〕**。残る 6 手順は新設 E2E が実サーバ越しに固定しており、8 手順は全数が押さえられた。⇒ 穴は 0 件である。★設計伝達レポートの初版（`574dda7`）は §4-5 で「手順 8 だけが誰にも確認されていない」と申告していたため、同節とヘッダ表を追補で更新した**（初版だけを読むと失効した前提で受理判定することになる）**。★本追補はドキュメントのみであり、コード・テスト・マイグレの差分は 0 である。**

### M33-01: 凍結と実測（統合の前に、消してよいものを数え切る）（2026-09-13）

- **結果**: **凍結点 `5576126`**。`migrations/` は **up 111 / down 111・欠番は `000012` の 1 件のみ・最大 `000112`**（`SUPP-001` §2.7 の「102 本 / 〜`000103`」は失効。**★欠番 1 件という点だけは一致**）。**対応表 111 行を 1 行 1 本で作成**（調査資料は 104 行＝〜`000105`）。**層 A 32 / B 79**（`check-migration-license.sh --list`）。基準 DB を 1 度作って `version=112 / dirty=0`・アプリスキーマ 42 オブジェクト・`foreign_key_check` 0・`integrity_check ok` を実測。**正規化スキーマ sha256 `9b87a96e…` / `sqlite_sequence` sha256 `694011b0…`**（`M33-02` の突合用）。**マイグレ消費 0 本・CHANGE 0 本・`migrations/` の差分 0 バイト**。`go test ./...` **ok 60 / no test files 9 / FAIL 0**（exit 0）／ `check-artifact-integrity.sh` を 1 本目に回して違反なし。
- **報告**: 完了報告 `docs/progress/M33-01-completion-report.md` ／ レビュー `docs/progress/m33-01-review.md`
- **レビュー**: 指摘 **12 件（高 4 / 中 5 / 低 3）**。**★「高」の不採用は 0 件。不採用そのものが 0 件である**（12 件すべて採用）。再レビュー往復 0 回。
- **★横断課題**:
    1. **★★★`M33` の 7 群のうち `S02` と `S06` は層をまたぐ**（完了報告 §2.8）。**`games`（S02）と `presets`（S06）は `GAME_TABLES` に無く層 A である**——**設計卓自身が `S07` を層 A とした論法**（`users`/`tags` は `GAME_TABLES` に無い）**を一貫適用すると同じ結論になる。★★機械検査はこの向きを検出しない**——`check-migration-license.sh` 規則 (4)(a) は `_data_` を持つファイルが層 B へ解決することしか見ず、**どの表へ書くかを見ない。⇒ `NNNNNN_data_seed_games_characters.up.sql` は緑のまま `games` を `CC-BY-SA-4.0` へ移す。★`M33-02` 着手前に設計卓の裁定が要る。** 申し送り `m33-groups-s02-s06-straddle-license-layers`。
    2. **★★★`000018` と `000074` は「凍結表の据置きだけで緑になっている 2 本」である**（完了報告 §2.8・レビュー 高-4）。**全 111 本のうち `GAME_TABLES` へ書きながら層 A に解決するのはこの 2 本だけ**（`000018` → `moves` / `000074` → `preset_aliases`）**。規則 (4) は凍結表に無いファイルにしか当たらないため赤にならない。⇒ `M33` が 111 本を潰した瞬間に据置きが消え、判定対象になる。★ 1 の裁定に含めること。**
    3. **★★`000009` は調査資料が挙げていない 8 本目の廃止候補である**（完了報告 §2.6）。**生存行 0**（`000017` が AJG 3 キャラを全撤去し、`000024`/`000053`/`000082` が再投入）**。★ただし純粋な no-op ではない**——`characters` は **行 31 / `seq` 34** であり、**差 3 が `000009` の消費した id である。⇒ 単に無かったことにすると `sequence_equal` が落ちる。** 申し送り `m33-000009-eighth-retirement-candidate`。
    4. **★`SUPP-001` §2.7 の本数が失効している**（102 本 / 〜`000103` → 実測 111 本 / 〜`000112`）。**★製造は設計書を直接編集しない**（`CLAUDE.md` §8）**。⇒ as-built 化は設計卓の手番。★欠番が `000012` の 1 件だけである点は今日も成立しており、そこは変えなくてよい。** 申し送り `supp001-s27-migration-count-as-built`。
    5. **★★調査資料の数はいずれも基準日つきで読むこと。** `Migrate`/`Steps` の **28 ファイル**は、式が `internal/infra/migration/*.go` に**ディレクトリ限定**であり（`research.py:151`）**今日は 35**（同一式）／ **38**（`.Up(` `.Version(` 込み）／ **40**（repo 全体・うち 2 本は `datadir` の同名で別サブシステム）。**増えた 7 本は新マイグレ 7 本と 1 対 1・消失 0。** golden も設計卓の把握は 4 本だが**実測は 17 stem ＝ 34 SQL ファイル**。
    6. **★★スキーマの同一性を「生テキストのハッシュ」で固定してはいけない**（レビュー 高-1）。基準 DB の `sqlite_master` は **`CREATE TABLE "combos"`**（RENAME の引用符）・**`ALTER ADD COLUMN` の追記が連なった `moves`**・**旧 `--` コメントを含む 13 表**という accreted なテキストであり、**手書きの `S01` では原理的に一致しない。★調査資料の `schema_exact_equal` も抽出 DDL を再実行して得た一致であり、手書きの一致は未検証である。⇒ 正本は `pragma` 経由の正規化ハッシュとし、レシピ（スクリプト本体）と対で引き継ぐこと**（値だけ渡すと書式違いで食い違う。実際にレビュー担当の独立算出値と本報告の値は異なった）。
    7. **★`combos` / `combo_oki_options` は 0 行でも `sqlite_sequence` に `seq=0` の行を持つ**（完了報告 §4.4）。**⇒ 「空の表は飛ばす」と書くと `M33-02` の `sequence_equal` で静かにずれる。**
    8. **★`presets` / `users` / `tags` は hybrid である**（seed 行 ＋ 利用者が足す行）。**⇒ `M33-03` の移行手順は「seed 由来と利用者由来を分ける述語」を決める必要がある。`presets` は `is_builtin` / `user_id` で分かれるが、`tags` / `users` の分け方は本サブでは確定していない。**
    9. **★`scratch-m33-01.db`（基準 DB）が作業ツリーに残っている。** `.gitignore` 済みでコミットには影響しないが、**`CLAUDE.md` §10 が `*.db` の直接削除を禁じているため製造は消していない。⇒ 開発者の手番**（`rm -f scratch-m33-01.db scratch-m33-01.db-wal scratch-m33-01.db-shm`）。
### M37-RESEARCH-01: リリース前要望の実査（2026-09-13）

- 結果: A/B05/B06/B11を実査。マス数UI参照0、modifierはflags 10/type 2、TCの同形属性109行（地上候補条件105行）、読取欄は5区画。ゲーム上の各段の正値・要否は判定していない。
- 報告: [M37-RESEARCH-01-report.md](M37-RESEARCH-01-report.md)。コード・CSV・DB・既存テストの変更なし。

### M37-01: 始動位置・運び量の 3 方式入力 UI（2026-09-13）

- **結果**: 3 方式（区分 / マス数 / パーセント）の連動 UI と運び量の 2 方式入力を配線。**消費マイグレ 0 本**（DB 列は `000105` で着地済み）。`go test ./...` / `tsc --noEmit` / `vitest 2855` / `make e2e` 全数 緑。**★★開発者裁定で PATCH の API 契約を拡張した**（`UpdateMetadataRequest` へマス数 2 列）。
- **報告**: 完了報告 [M37-01-completion-report.md](M37-01-completion-report.md) ／ レビュー [m37-01-review.md](m37-01-review.md)
- **★横断課題**:
    1. **★★★指示書 §0.1 の前提「無いのは UI 配線だけ」は不完全であった。** **PATCH の `UpdateMetadataRequest` にマス数 2 列が無く、編集モードでマス数・運び量だけを直すと値が黙って落ちた**（POST と PUT にはあった）。**⇒ 2026-09-13 開発者裁定で契約を拡張**。指示書 §3-4 と完了条件 §6-5、チェックリスト B-1 / D-3、指示書 §5-8 の計 5 項目が**この 1 つの判断から派生して満たせない**（完了報告 §7）。**★`normalizePositionAndMass` の差分は 0 行**（§3-1 / §6-4 は維持）。**⇒ CHANGE は設計卓が起票する**（`D-293`）。
    2. **★★`ValidateMetadataRanges` が `validatePositionMassRange` を呼んでいなかった。** ⇒ PATCH でマス数を運べるようにした瞬間、値域外が DB の `CHECK` 違反になり **500** で返る穴になる。**同関数の godoc が自らそう警告していた。** ⇒ 本サブで足した。**★VAL コードは既存の `VAL-RANGE` のままであり、`DES-006` の `VAL-C16` との食い違いには手を付けていない**（指示書 §4.3）**が、食い違いの影響範囲は PATCH へ広がった。**
    3. **★★PATCH と PUT で「マス数を空にする」の永続結果が食い違う**（完了報告 §8.4）。**PUT は `normalizePositionAndMass` が代表値で埋め直し、PATCH は `null` のまま残る。⇒ 本サブで新たに生じた非対称である。★直すには `normalizePositionAndMass` に触れるため、指示書 §7-1 の「止まって請求する」条件。⇒ 設計伝達レポート §4 へ。**
    4. **★区分表の Go / TS 二重化の重みが上がった**（`position-bands-duplicated-go-and-ts`）。**本サブの PATCH / PUT 振り分けが「フロントの `positionFromMass` とサーバの `PositionBands` の一致」に依存するようになった。⇒ ずれると振り分けが誤り、DB の `position` とマス数が食い違う。** 現状は `position.test.ts` が両者の形を固定して成立している。
    5. **★`duplicate-precheck-ignores-position-mass` の状態が変わった。** 着手前はマス数を画面から入れられなかったため理論上の穴であったが、**本サブで入れられるようになった。**（**★実際には区分が入力時に追随するため現状の重複検知は正しく動く。踏めるのは「マス数そのもので重複を判定してほしい」要求が出たときである。**）
    6. **★★`m31-02-tag-field-drag.spec.ts` の flaky に新実測**（完了報告 §8.1）。**単独実行 4 回のうち 1 回 flaky。★既登録項目は「単独 5 回はすべて緑・全数実行だけ揺れる」と記録しており食い違う**（ただしテスト数が 6 → 16 に増えており同条件の比較ではない）。**★同項目自身が「`/combos/new` の描画の重さに効きうる」と書いており、本サブは同ページに数値入力を 4 つ足している。⇒ 「無関係」とは言い切れない。** 本サブでは直さない（`M31-02` の面）。⇒ 設計伝達レポート §4 で既登録項目の更新を請求。
    7. **★★製造が `check-import-order.sh` の読み方を誤った**（レビュー 高-2 で是正）。**着手基点 99 → 101 と 2 件増やしていたのに「増えていない」と報告した。★検査が緑だったのは `BASELINE=101` に余裕があったからにすぎない。⇒ 是正後は 99 で着手基点と一致。★一般形＝ベースライン固定型の検査は「緑か」ではなく「着手基点から増えたか」で読むこと。** 本検査が作られた動機（`M24-08`）と同型の穴を製造自身が踏んだ例である。
    8. **★★★実機確認後に 2 つ目の開発者裁定が出て、入力の作りを変えた**（2026-09-13・完了報告 §0.2）。**⇒ 3 方式を並べて連動させる形から、入力方式を選んで 1 項目だけ入力させる形へ。★これは `D-730`「3 つで連動する」／ 指示書 §2.2-1 ／ チェックリスト C-1 からの設計変更であり、`D-730` の改訂と CHANGE 起票が要る。** **★連動そのものは失われていない** —— 値はマス数 1 本のままで、方式を切り替えると別の単位で見える（3 方向とも実測し直した）。**★あわせて値域外をクランプする形へ差し戻した**（要望 1a）**。⇒ 指示書 §5-4 の「161 を拒否」は「画面から入らない」へ意味が変わった。★zod と `VAL-RANGE` は残しており、CSV / API 経由の拒否は Go テストが押さえている。**
    9. **★★入力方式の選択と値の入力欄を同じ `Field` に置くと、順送りが値の入力欄を飛ばす**（`useFieldSequence` の `focusableIn` が最初の focusable しか拾わないため）。**⇒ 入れ子の `data-seq-stop` を置いて往路・復路ともテストで固定した。★型検査もテストも E2E も緑のまま落ちる型である。**
    10. **★★実機確認で「入力方式のボタンと値のボタンの境界が読めない」との指摘。⇒ HTML モックで 4 案を比較し、開発者が案 B（ピル）を選択した**（2026-09-13・完了報告 §0.3）。**`OptionButtonGroup` へ `variant="pill"` を追加**（方式＝丸ピル・slate ／ 値＝従来の角丸長方形・blue）。**★挙動は 1 つも変えていない** —— 数字キー・roving tabindex・`radiogroup` は共通で、分岐は className の 2 か所だけ。**★並びは 通常入力 → パーセンテージ → マス目**（運び量は パーセンテージ → マス目）。**★番号は並び順から導出しており、ラベル文字列へ焼き込んでいない**（`shortcutKeyForIndex`）**。⇒ 並びを変えても番号がずれない。★「方式と値が見た目で違うこと」自体をテストで固定した**（同じ見た目へ戻すと赤くなる）。
    11. **★説明書は本サブでは書き換えていない。** `docs/usermanual/` の本文は全 22 章ともプレースホルダであり `M32-02` が未着地（実測 `grep` 0 件）。**⇒ 指示書 §2.4 が認める「足した UI を完了報告に列挙して `M32-02` へ渡す」を採った**（完了報告 §6.1 に 5 項目の表）。

### M37-02: 仮想コントローラ UI の 10 件（`B04` `B05` `B07`〜`B14`）（2026-09-13）

- **結果**: 縦の消費を減らす 10 件。**消費マイグレ 0 本 ／ CHANGE 自採番なし**（原稿は設計伝達レポート §4）。`go test ./...` / `tsc -b` / `vitest 2897` / `make e2e` 全数 緑。**★段 1 と段 6 の縦を Playwright で前後 2 点そろえた**——blanka（family 21・実測）幅 390 でコントローラ全体 **1330 → 631px（−53%）**、幅 1280 で **848 → 434px（−49%）**。**★`B14` の達成判定は開発者の実機確認**（`D-855`。請求済み・製造は判定していない）。
- **報告**: 完了報告 [M37-02-completion-report.md](M37-02-completion-report.md) ／ レビュー [m37-02-review.md](m37-02-review.md)
- **★横断課題**:
    1. **★★★`[data-testid^="..."]` の接頭辞走査がリポジトリに 5 か所ある**（実測）。**同じ接頭辞を持つ非ボタン要素を足すと、床は静かに 1 件多く数える。** 本サブはスクロール容器へ `${prefix}-scroll` を付けて実際に踏み（`VirtualController.test.tsx:499` が落ちた）、`recipe-scroll-*` の別名前空間へ逃がした。**★`recipe-special-family-scroll` は `m30-04` の E2E と本サブ自身の計測 spec の family 数（21 → 22）まで狂わせるところだった。⇒ `DES-005` §6.8 の testid 規約へ「走査に使われる接頭辞の下へ非ボタン要素を置かない」を足す価値がある**（設計卓へ請求）。
    2. **★★modifier の表示語が 3 か所に二重化しており、機械検査が 1 つも無い。** Go `resolver.go` の `flagText` ／ フロント `features/combo/labels.ts` ／ 正典 `DES-004` §2.3。**`check-enum-sync.sh` は flags を見ていない**——フロント側の定義が `web/src/constants/` ではなく `features/combo/labels.ts` に在るためである。**★本サブは 10 値を揃えたが、次に flag が増えたとき片側だけ直る形は残っている。**
    3. **★Go と UI で表示語が割れている 2 件目が残っている（直していない）。** `nonMoveTypeText` は `parry_drive_rush` → **「生ラッシュ」**、`labels.ts` は **「パリィドライブラッシュ」**。`DES-004` §2.3 は両方を書いており、`M37-RESEARCH-01` §3.2 は「生ラッシュ」を as-built として記録している。**⇒ 指示書は `low_jump` しか名指ししていないため射程外として残した。**
    4. **★★`B04` の受入条件の読みが overview と指示書で割れている（開発者へ請求済み）。** overview §1.2 は「生の `{}` **等で囲んだ表現**をそのまま出さない」、指示書 §2.5-1 とテスト 5-3 は「**内部識別子**を出さない」。**⇒ 製造は指示書に従い波括弧を残した**（`{ジャスト}`）。**★`B04` は一覧・詳細にも及ぶため、判定「完了」は開発者の確認待ちの暫定である。**
    5. **★★`recipe_cache` は既存の再生成経路に委ねた（データを黙って書き換えていない）。** マイグレで直すのは既存の床 `TestRun_M2408_RecipeCacheUntouched` が禁じており、lazy 解決は欠けたキーを埋めるだけで既存値を上書きしない（`cache.go:38-42`）。**⇒ 開発者が設定画面の「キャッシュ再構築」を 1 回押すまで、保存済みの 3 行は古い `{od_lm}` を持ち続ける**（申し送り済み）。
    6. **★★製造が書いた床が 1 本、空振りしていた**（レビュー 高-3 で是正）。`not.toContain("ありません」")` は実装の空表示 `ありません` が `」` を含まないため**どんな入力でも通る** assertion であった。**★`B04` の Go 側では「全数だけでは検査が何も見ていない場合と区別できない」と明文化して破壊確認まで実施していたのに、同じ作法を `B11` 側へ適用していなかった。⇒ 書き直したうえで破壊確認も実施した。★一般形＝「床を足した」ことと「床が効いている」ことは別である。**
    7. **★★`docs/usermanual/` §5.7 は本文が未記述である**（`M32-02` 待ち・実測でプレースホルダ 4 見出し）。**⇒ 本サブは「追随対象 0 件」で閉じたが、`M32-02` が書く時点では本サブの as-built を反映する必要がある。**
    8. **★★`D-863` が本サブへ割り付けた `m31-02-tag-field-drag` の再測を実施した**（完了報告 §12.1）。**単独 10 回中 3 回 flaky（30%）／ 全数 2 回中 1 回。** **★本サブの sticky を外した対照は 4 回中 0 回だったが、これは原因の特定にならない**——30% の下でも 4 回連続で出ない確率は約 24% であり無効果と整合する。**★根拠にしたのは機構のほうである**——レシピ面は `display:none` であり sticky 要素はレイアウト箱を持たない（座標にもポインタイベントにも影響しない）。**⇒ 本サブの差分が原因とは言えない。面は `M31-02` のまま。★既存行の更新原稿は設計伝達レポート §4-5**（`followup-backlog.md` は製造が編集しない＝`D-838`）。**★一般形＝「1 回の緑は flaky の反証にならない」は対照実験の側にも当てはまる。**
    9. **★★開発者の実機確認が完了した**（2026-09-13・完了報告 §7）。**`B14` は達成**（逐語＝「達成（スクロールせず入力できた）」）**⇒ 判定を「完了」へ確定した。★製造は判定していない**（`D-855`）。**★見た目も承認。★タップ領域**（技ボタン 52px → 40px ＝ iOS 推奨 44px 未満）**について実機で問題の報告は無い。** **★★スマホ幅の実機確認は開発者判断で省略**（逐語＝「おまけ機能に近いため。リリース後に課題として再浮上する可能性はあるので注視します」）**。⇒ `E2E` の 390×844 は実機ではない。申し送りへ起票**（設計伝達レポート §4-7 の `virtual-controller-narrow-width-unverified-on-device`。**割付＝リリース後。★先回りして直さない ——省略は判断であって漏れではない**）。
    10. **★★★`B04` の要望が具体化し、判定を「完了」→「一部完了」へ改めた**（完了報告 §7.2）。**開発者の逐語＝「新規登録、編集の段階で modifier をつけた時の見た目と一致させたい」。⇒ 争点は「波括弧を残すか外すか」ではなかった。** **★語彙は既に完全一致している**（本サブで 10 値を揃えたため食い違い 0）**。⇒ 残る差は「波括弧」と「バッジの色」だけである。** **★★★一覧ではバッジにできない ——`internal/api/combo/dto.go:295` が `Steps` を「一覧 API では nil(N+1 防止、§4.11)」と明記しており、修飾の構造がクライアントへ届かない。詳細だけバッジ化すると一覧と詳細が割れ、`B04` が消そうとしている不統一を別の形で作る。⇒ 完全な一致には `§4.11` の再検討が要り、本サブの射程外である。** **★波括弧だけの撤去は推奨しない ——バッジは*色*で修飾だと伝えるが平文には色が無く、波括弧がその唯一の代替である**（★往復は壊れない。表示文字列は解析されず、CSV の `recipe` 列は別物のセル内 JSON である＝`csvcore/contract.go:56`）**。⇒ 別サブへ送ることの承認を親へ請求**（設計伝達レポート §2-1 / §4-6。**★§4-4 の `parry-drive-rush-label-differs-go-and-ui` は同じ面であり §4-6 へ畳む**）。
    11. **★手動確認は「1 件登録」では足りないことを明記した**（完了報告 §7.4）。**自動テストが構造的に届かない 4 点＝(A) 実機のパッド/キーボードで「告知を閉じる → 再読込で出ない」**〔**★`B10` の本体。E2E は既読を `localStorage` へ直接書いて作っており、この経路を一度も通っていない**〕**／ (B) 必殺技一覧の局所スクロールと `overscroll-contain`**〔高さは測ったが**スクロールの連鎖は測っていない**〕**／ (C) sticky なレシピ行の見え方**（レビュー低-8）**／ (D) 修飾を付けたコンボの登録**〔**★`B04` はここでしか実地確認できない。修飾なしの登録では変更点に触れていない**〕**。★一般形＝「1 件通した」は「経路を通した」ではない。**
    12. **★★手動確認は開発者が完了を宣言した**（2026-09-13・逐語＝「私の確認は終わった認識です」）。**★確認済みと明示されたのは (A) 告知を閉じたら次から出ないこと**〔**`B10` の本体であり、E2E が既読を `localStorage` へ直接書いて作っていたため実機でしか通せなかった経路**〕**と キャッシュ再構築の実施**〔保存済み 3 行が新表示語へ更新〕**である。⇒ (B) 局所スクロール / (C) sticky の角 は明示の言及が無く、開発者の判断で閉じた。★完了報告 §7.4 に「『開発者の判断で閉じた』と『確認して問題が無かった』は別である」と書き分けてある**——後任が読み違えないため。
    13. **★★★`B05` の判定を「完了」→「一部完了」へ改めた**（完了報告 §1 / §7.5）。**開発者の逐語＝「modifier の項目確定はまだ完遂できていないので、次のマイルストーンで実施します。（この modifier が本当に必要か、文言がおかしくないか？の最終チェック）」。** **⇒ `B05` の 3 つの要求のうち確定したのは「不足＝0 値」だけであり、「必要なものを見定める」と「文言の適否」は未完である。** **★これは製造が判断できない類の事項である**——「本当に必要か」は SF6 のドメイン知識を要し `roles-and-routing` のハード列に当たる。**⇒ 推測で削らなかったのは正しい**（`D-857`）**。★次サブでも「使われていないから消す」を根拠にしないこと**（実 DB 件数 0 は 4 値あるが、利用者がまだいないためである）。**⇒ 申し送りへ起票**（設計伝達レポート §4-8 の `modifier-set-and-wording-final-review`。**★§4-6**〔表示形式〕**と同じ面であり 1 サブに束ねうるが、問いは別である**）。
### M37-03: 一覧・マイコンボ・ゴミ箱の 3 件（`B01` / `B03` / `B15`）（2026-09-13）

- **結果**: **★着地したのは `B01` のみ**＝ゴミ箱のコンボ側を `deleted_at DESC, id DESC` へ（着手前は削除日時と無関係な始動状況順だった）。**`B15`＝実装・レビュー・取り込みまで済ませた後に開発者判断で差し戻した**（`opponent_stance` の `airborne`＝「空中」と区分が重複していたため）。`B03`＝**開発者判断で本 MS から除外**。**消費マイグレ 0 本**（払い出し済みの `000113` は未消費のまま返す）。`go test ./...` / `pnpm test 2866` / `tsc --noEmit` / `make e2e` 緑。
- **報告**: 完了報告 [M37-03-completion-report.md](M37-03-completion-report.md) ／ レビュー [m37-03-review.md](m37-03-review.md)
- **★横断課題**:
    1. **★★★【差戻】`B15` は実装完了・push 済みの状態から差し戻した**（2026-09-13 開発者判断）。**逐語＝「相手の状態で『空中』はこちらがあれば充分で、ヒット区分はいらなかった」。** **⇒ `opponent_stance` の `airborne`＝「空中」と区分が重複していた（同値は元から在り、製造は 1 行も触れていない）。** **★★段 1 の実査は `hit_type` の 5 面に閉じており、「他の軸が同じ概念を持っていないか」を見る観点が指示書にも実装にも無かった**（完了報告 §8.6）**。⇒ 一般形＝列挙値を足すときは、同じエンティティの他の列挙を先に横に並べて読むこと。状況 4 軸（`position` / `opponent_stance` / `hit_type` / `opponent_size`）を並べれば「空中」の重複は目で見える。** **★★★「同期の全数」は*足す先*を数えるものであって*足してよいか*を判定しない**——`CLAUDE.md` §4 の列挙同期も `check-enum-sync.sh` もチェックリスト A-3 も、すべて「行き渡ったか」しか見ていない。⇒ 重複の検出は誰の担当でもなかった。
    1b. **★★差戻の途中で、基点から在ったテスト 2 件（73 行）を巻き込んで消した。** `csvcore_test.go` の `opponentSizeEnumIssues` / `TestOpponentSizeRoundTrip`。**★気づけた経路は `git diff --stat` の「挿入 0・削除 73」だけである**——`go test ./...` は緑のまま通った（消えたテストは走らないだけ）。**⇒ 教訓 `E-225` と同型であり、同じ検出手段で捕まった。** `git show <基点>:<path>` で復元済み。
    1c. **★ヒット種別の欄が数字キーの上限に張り付いた件は差戻で解消した**（余白は 1 へ戻った）。**★ただし構造は残る**——`optionButtons.test.ts` の個数は**リテラル**で `HIT_TYPE_VALUES` に追随せず、値を足しても緑のまま失効する（`M37-03` で実際に踏んだ）。⇒ 注記をコードに残した。以下は差戻前の記録:
    1d. **ヒット種別の欄が数字キーの上限に張り付いた（余白 0）。** `MAX_BUTTONIZED_OPTIONS` は 10（`1`〜`9` と `0`）であり、**「未指定」＋ 9 値でちょうど 10 個**になった。`air_hit` の割当は最後の 1 枠 `0` である。**⇒ 次に 1 値でも足すと `D-578(4)`「10を超えるものはボタン化の対象外」の線を越え、ボタン群をやめるか欄を割る判断が要る**（先例＝`M31-05`）。**★機械では検出されない** —— `optionButtons.test.ts` の個数はリテラルで `HIT_TYPE_VALUES` に追随しない（本サブで `8 + 1` → `9 + 1` へ是正し注記も入れたが、次の担当が同ファイルを直さなければ事実が記録から消える）。
    2. **★★`CHANGE-151` の改訂網から 2 箇所が漏れていた。** `DES-003` §3.2 は **3 値**、`DES-005` §5.7 は **4 値**のまま失効している（正本は `SUPP-001` §3.2 と `DES-006` §2.7 の 8 値）。**⇒ 値域を持つ箇所が 4 書に散っており、改訂のたびに全数を拾えていない。正本を 1 書へ寄せるかは設計卓の判断。** CHANGE 請求は完了報告 §6.3。
    3. **★★`DES-005` §5.15 はゴミ箱の並び順を一言も規定していない。** 削除日時を「表示する」とだけ定めている。**⇒ 本サブの `B01` は既存記述の訂正ではなく設計書への*追記*が要る。** あわせて**着手前はコンボ側とセットプレイ側で並びが食い違っていた**（セットプレイだけが削除日時降順。コンボ側は始動状況順）。
    4. **★`check-enum-sync.sh` の `in_constants` はテストファイルも対象に含む。** `web/src/constants/**/*.test.ts` に値が文字列で在れば、本番の定数から消えていても `INFO` が出ない（破壊確認の 1 回目が実際に空振りした）。**⇒ 同検査の「片側欠落の検出」を当てにしないこと。同期を実際に守っているのは `enum_sync_test.go` と `label-keys.test.ts` である。★同検査は既定で常に `exit 0`、`--strict` も散在件数の超過でしか落ちない ⇒ 終了コードでは判定できない。**
    5. **★`B03`（マイコンボのタグ固定表示）は開発者判断で取りやめ**（2026-09-13・逐語は完了報告 §0.1）。**⇒ 実装・台帳・ストレージのいずれにも手を付けていない。`M37-overview` §1.2 と followup `release-pre-request-batch-b01-b15` の追跡状態は設計卓が更新する必要がある。**
    6. **★`m19-03-setup-results.spec.ts` が全数実行で flaky**（リトライで緑・最終 320 passed）。**本サブは `setups` / 成立条件の面に 1 行も触れていない。⇒ 既知か新規かの切り分けは設計卓へ。** followup の既登録項目は**別 spec**（`m31-02-tag-field-drag-flaky-in-full-run`）である。
    7. **★指示書 §2.1-1 の実査項目「実 DB の distinct 値」は測れていない。** クラウド実行の作業領域にはクリーンクローンしか無く、dev DB が存在しない（`find . -name '*.db'` が 0 件）。**⇒ 代わりに値域を定義している 5 面をコードで全数実査した。足す位置は定義側で決まり既存行の分布に依存しないため、判断に必要な情報は揃っている。** 開発者が手元で確かめる形は完了報告 §7.1。

### M37-04: 確定反撃候補の初段発生（`B06`）／ `B02` の射程判定（2026-09-13）

- **結果**: **`B06` 着地**＝ターゲットコンボの 2 段目以降を 1 行で表す行の候補判定を `moves.first_hit_startup`（新列・全行 NULL）へ切り替え、**NULL の間は候補から外す**（`D-857`）。除外述語は **4 条件**（`target_combo` ∧ `is_derived` ∧ `basis='standalone'` ∧ 同列 NULL＝**開発者裁定**）。**消費マイグレ 2 本**＝`000114`（層 A・列追加）／ `000115`（層 B・chun_li 鷹嘴連拳の `is_aerial` 是正。**`D-870` で追加払い出し**）。**`000113` は欠番のまま**（`D-866`）。CSV 契約を **24 → 25 列**へ。`go test ./...` 全 60 パッケージ ok ／ `pnpm test 2898` ／ `make e2e 345` ／ `check-artifact-integrity.sh` 違反なし。**レビュー 15 件中 13 件採用・「高」の不採用 0 件・再レビュー往復 0 回。**
- **報告**: 完了報告 [M37-04-completion-report.md](M37-04-completion-report.md) ／ レビュー [m37-04-review.md](m37-04-review.md)
- **★横断課題**:
    1. **★★★`B02`（バーンアウト中の確定反撃）は設計卓へ請求した。** バーンアウトは実装に**存在しない**——コード全域の唯一の出現は `csvcore_test.go:33` の架空 JSON フィクスチャであり、`characters.custom_states` の seed 済み 35 種にも該当が無い（かつ同列は「**キャラ固有**状態」の器であり、バーンアウトは全キャラ共通のシステム状態）。`combos.opponent_stance` は体勢 4 値、`punishfinder.ScanParams` は 3 項目で状態の軸を持たない。**⇒ 実施には「UI タブ → URL query → API → `ScanParams` → 走査述語 → 有利フレーム算出式」の 6 層すべてに新軸が要り、しかもバーンアウト時の硬直差という一次データが 1 列も無い。** **★既存の「バーンアウトを独立列にしない」決定（`phase3-overview` / `M16-02` / `M16-overview`）はすべてドライブゲージ消費モデルの文脈であり、確定反撃の文脈で判断した既存決定は 1 件も存在しない。**
    2. **★★`first_hit_startup` を DB へ入れる経路が本サブには無い。** 本列は CSV に持つが seedgen は SQL へ出力しない（保全のみ）。**⇒ 開発者が 109 行を埋めても DB には 1 行も入らず、`csv_db_sync_test` が「CSV に値があるのに DB が NULL」で赤になる。** 先例＝`startup_basis` 等 3 列の `000050` / `000064` / `000067`。**⇒ backfill マイグレと、その番号の請求が別途要る**（`D-293`）。
    3. **★★`is_derived` の付け方がキャラ間で不統一である。** 集合 A（`target_combo` かつ非 derived の 9 行）を実査したところ、**9 行すべてが `command` に `chain` を含み**、記録されている `startup` が 2 段目以降の値である行が混ざる（e_honda `toko_shizume` の 22 は 2 段目 `power_stomp` の 22 と完全一致）。**★値の誤りは 1 件も無い**——開発者の逐語＝「2 段目の発生が 1 段目より早くなることは、standalone 扱いの `target_combo` ではありえる」。**⇒ 問題は、aki `hun_dun` と ryu `fuwa_triple_strike_2hits` が同じ形なのに `is_derived` が `false` / `true` に割れていることである。新ゲートは `is_derived` を鍵にするため、この不統一がそのまま「掛かる / 掛からない」の差になる。**
    4. **★応答 `startup` の意味が変わった。** `starterNode` は判定に使った値（対象行では `first_hit_startup`）を応答へ載せる。**フロントは `PunishTree.tsx` で `発生 {startup}F` と無条件ラベルで描くため、109 行が埋まった時点で確定反撃サーチと技一覧の「発生」が食い違って見える。⇒ `DES-005` §5.20 への差分。**
    5. **★`DES-003` §3.3 の `fastest_unreachable` の件数断定（「候補は 16 行」）が動く。** 鷹嘴連拳が `is_aerial=1` になったことで B 型の抽出条件（`is_aerial=1` かつ `code` に `jumping_` を含まない）に新たに該当し **17 行目**になる。本サブは同列の値を変えていないため既存テストは緑だが、**件数の断定は失効する**（`D-236` が「件数を断定している欄は後続の裁定で動きうる」と警告していたとおり）。
    6. **★`is_aerial` が 1 列で 2 つの意味を読まれている。** `M19-DESIGN-07` §7 と `D-222` は実セマンティクスを「ラッシュ版自動生成の除外」と是正済みだが、`punishfinder/constants.go` は同じ列を「空中攻撃」として読む。**⇒ 本サブが直したのは後者の意味であり、前者には影響しない**（ラッシュ可否は `category ∈ {normal, unique}` を要求し `target_combo` は元から対象外＝`internal/service/move/service.go:89`）。**★意味の一本化そのものは射程外**（followup `M19-flag-semantics-drift` と同根）。
    7. **★版固定テストへ現行サービスコードを当てる形が壊れやすい。** `migrate_m3104_test.go` の陽性対照は v107 の DB へ現行の `punishfinder` を当てており、**走査の投影へ列が増えるたびに `no such column` で落ちる**（本サブの `first_hit_startup` で実際に落ちた）。**⇒ スキーマは HEAD、「投入前」は行の削除で作る形へ直した。同型の作りが他にあれば同じ壊れ方をする。**
    8. **★レビュー 低-13 の申し送り＝`000115` の down は新規 DB を golden と食い違う状態へ落とす**（golden は `is_aerial=1` で seed するのに down は 0 を書く）。**意図的であり `000112` が作った型に揃えているが、同型の借金が 1 件増えた。**

#### M37-04 追記（2026-09-13・着地後）

- **★★★【訂正】横断課題 5 の件数が誤っていた。** 「`fastest_unreachable` の B 型候補が 16 行 → 17 行目になる」と書いたが、**実測（CSV 全 31 ファイル / マイグレ適用 DB・両者一致）では B 型候補は 26 行**（うち `fastest_unreachable=1` が 7 行、**`category='target_combo'` は鷹嘴連拳の 1 行のみ**で他 25 行はすべて `unique`）。**⇒ 本サブが 1 行増やしたのは正しいが「25 → 26」であり、`DES-003` §3.3 の「16 行」は第四波（`000084`）でキャラが増えた時点で既に失効していた。★誤った断定を引用した先があれば差し替えること。**
- **★★★【請求 1】`fastest_unreachable` の人手判断 1 行を開発者へ請求した**（着地報告の時点で落としていた）。**⇒ `is_aerial` を `1` へ是正したことで鷹嘴連拳が B 型の人手判断ロースターへ入ったが、値は既定の `false` のままである。** **★`DES-003` §3.3 が「値域が 0/1 で両方妥当なため、製造もレビューもコードからは検出できない。記入段階でしか防げない」と明示警告している列であり、製造が推定してはならない。** 判断材料と波及は完了報告 §13-1 ／ 設計伝達レポート §4-9。
- **★★【請求 2】backfill 用のマイグレ番号 1 本を設計卓へ請求した**（開発者がリレー）。**⇒ `first_hit_startup` は seedgen が SQL へ出力しないため、CSV の 109 行を埋めても DB に入らず `csv_db_sync_test` が赤になる。** 層 B（`_data_` 必須）・命名案 `000116_data_backfill_moves_first_hit_startup`・**打つ時期は「開発者が埋めた直後」**。詳細は設計伝達レポート §4-8。
- **★`is_derived` の基準統一（横断課題 3）はフェーズ5 以降へ送ることが確定した**（2026-09-13 開発者の明示指示）。設計伝達レポート §4-3 の冒頭と §4-6 の followup 登録原稿に割付を明記した。
- **★開発者の手動確認 5 件を完了報告 §13 へ常設化した**（人手判断 1 ／ 実機で見るもの 3 ／ 109 行の手入力 1）。**⇒ 「テストが緑＝人の確認が不要」ではないことを、何が機械で判定でき何ができないかの対で残した。**

#### M37-04 追記2（2026-09-13・鷹嘴連拳を soaring_raid 形式へ）

- **★★★【訂正2】前回の追記で書いた「B 型候補 25 → 26」も最終形と合わない。** 開発者指示で `soaring_eagle_punches` を **elena `soaring_raid` と同じ「空中限定ターゲットコンボ」の形**へ揃えたため、`is_aerial` は `0` へ戻った。**⇒ 本サブは B 型候補を 1 行も増やさない**（実測 25 行で前後不変）。**★初版「16 → 17」・追補1「25 → 26」はいずれも失効。引用先があれば差し替えること。**
- **★★★【撤回】`fastest_unreachable` の人手判断の請求は取り下げた。** `is_aerial=0` に戻したことで B 型ロースターに入らなくなったため。**⇒ 設計卓へリレーしないこと。**
- **★★製造の誤解だった点**——`is_aerial=1` にすれば確定反撃から外せると読んだが、**実測では除外を効かせているのは `is_aerial` ではなく「フレーム列が空であること」だった**。`is_aerial=1` は `isNonPunishableTarget` に当たって**相手技としても完全除外**になり、`soaring_raid` / `satelite_leap` が出ている手動確認レーンにすら出なくなる。**⇒ 形が違っていた。★一般形＝「除外できた」ではなく「先例と同じ形になったか」で確かめること。**
- **★是正後の実測（canary・31 キャラ総当たり）＝3 行が完全に一致した。** `soaring_raid` / `satelite_leap` / `soaring_eagle_punches` とも **始動技 0 件 ／ 相手技（手動確認レーン `data_missing`）62 件**。`TestRun_M3704_AirOnlyTargetCombosShareTheShape` が 3 行まとめて固定する。
- **★`000115` の内容を差し替えた（同じ番号のまま）。** 開発者承認済み・条件は「別の検証 DB への影響と直せるかを報告すること」。**⇒ 対象は本ブランチを checkout して起動した `tacpendium.db` だけ**（CI・テスト DB は毎回ゼロから／E2E DB は起動時に `rm -rf`／過去の検証 DB は v6x 世代／`main` 未マージ）。**★`golang-migrate` はファイルのチェックサムを取らないため旧内容適用済みの DB は再実行されない。⇒ 新 `000115` を「絶対値を書く UPDATE」にしてあり、1 回流せば揃う**（手順は完了報告 §13-1b）。
- **★`is_derived` を `false` → `true` にした波及が広い。** 段階2 の解決索引と numeric/srk エイリアスから 1 行抜け、golden 5 本（`000084` / `000085` / `000086` / `000090` / `000091`）と実測値の固定 4 ファイルが動いた。**⇒ いずれも ±1 で説明がつき、`soaring_raid` / `satelite_leap` が元から索引・辞書に居ないことと揃った。**
- **★★開発者の問い「本当に始動技を全部紐付けられたのか」への回答を恒久化した**＝新規 `docs/progress/20260913-M37-04-dropped-starters.md`。**紐付けは 1 件もしていない**（指示書 §0.2 / §3-3）。**⇒ 落ちた 105 行の全数（25 キャラ）を `move_code` / 技名 / 記録 `startup` / `command` で並べ、開発者の手入力リストとして使える形にした。**

#### M37-04 追記3（2026-09-14・106 行を機械解決で投入）

- **★★★開発者がルールを提示し、手入力を機械解決に置き換えた。** 逐語＝「**commands を見れば全て機械的に対応可能だったので、手入力は省略していいですか？ あなたの方でやってもらえますか？**」。ルール＝**最初の `chain` の手前を初段とし、その技の発生を使う** ／ `d plus` はしゃがみ技 ／ **`d` 以外の方向が指定されていたら `unique` から `chain` の付かない技を探す**。
- **★実測 106/106 が解決し、未解決は 0 件。** 解決先は `normal` 83 / `unique` 23 で、**`special`・`system`・`throw`・`target_combo`（入れ子）は 0 件**。`*_1hit` / `*_1hits` という明示行に当たったものが 4 件あり、ルールの妥当性の裏づけになった。検算＝ryu `fuwa_triple_strike_2hits` → **6**（立中P）で既知の正解と一致。
- **★マイグレ `000116_data_backfill_moves_first_hit_startup`（層 B）を消費した**（**2026-09-14 開発者裁定で払い出し**）。書き方は先例 `000064` に倣い **1 行 1 `UPDATE` ＋ 既存値の保護**。`CHANGE-091` の F-4（CSV で値が空の行を対象に含めない）を守り、**空中限定の 4 行は投入していない**。**⇒ 次に払い出す番号は `000117`**（`000113` は欠番のまま）。
- **★★指示書の「やらないこと」を 2 つ越えた。** §2.2-3「値は 1 行も入れない」／ §3-1 ／ §3-3「初段を機械的に同定しようとすること」。**⇒ 開発者裁定によるが、設計伝達レポート §2-4 へ記録して親の追認を求める。★`D-857`「手入力は開発者の手番」も同じ開発者が変更したものである。**
- **★★★ただし §0.2「初段を同定しない。値を直接持つ」の設計は維持されている。** ルールは**値を作るために 1 回だけオフラインで使った**ものであり、**実行時のコードは列を読むだけ。⇒ 同定ロジックは実装に 1 行も入っていない。**
- **★★挙動が 2 方向に動いた。** **17 行は恒久的に候補から落ち**（記録値が速すぎて偽陽性を出していた）、**88 行は着手前より*緩い有利フレームで候補に出る*ようになった**（記録値より初段のほうが速いため）。例＝dee_jay `funky_dance` は記録 20 だが初段は立中P の 7。**⇒ 有利 20F 以上でしか出なかったものが有利 7F から出る。★ゲームの事実として正しいが、画面上の候補数は着手前より増える。**
- **★あわせて判明——`soaring_eagle_punches` は着手前、`recovery=41` を持っていたため「有利 +41F の相手技」としてジャストパリィタブに 31 ノード出ていた**（そこに 40 本以上の始動技がぶら下がっていた）。**⇒ 空中限定の形へ揃えたことで手動確認レーンへ移り、通常技 1,304 種の延べ出現が減った。これは `soaring_raid` と同じ扱いになった結果である。★「始動技として消えた」だけを見ていると、この波及は見落とす。**
- **★canary 実測（31 キャラ総当たり）**——**新たに現れた code は 0 件**、消えた code は `soaring_eagle_punches` の **1 件のみ**、始動技の延べ出現は **+54,462**。
- **★対応表の全数（106 行・`head` / 解決した技 / 入れた値）は `docs/progress/20260913-M37-04-dropped-starters.md` §6 に残した。⇒ 次に TC が増えたとき同じ手順で埋められる。**

#### M37-04 追記4（2026-09-14・手動確認の完了）

- **★★開発者が手動確認 5 件の完了を宣言した**（逐語＝「**全て問題なし。設計卓へ連絡します。**」）。**⇒ 本サブの手動確認は閉じる。** 内訳は 不破三連撃(2発止め) の境界が 5 → 6 ／ 88 行が緩い有利で出るようになったこと ／ 17 行が恒久的に落ちたこと ／ 鷹嘴連拳が手動確認レーンへ移ったこと ／ `through` 4 行の残存（完了報告 §13）。
- **★開発者の手元 DB は v114 以下だった**（実測＝`is_aerial=0 / startup=6 / is_derived=0`）。**⇒ `000115` は新旧どちらも未適用であり、差し替えに伴う修復は不要だった。** アプリ起動時の `m.Up()` で `000115`（新）と `000116` が順に当たる。**★「旧内容が静かに残る」経路は、今回は空振りだった。⇒ ただし危険そのものが消えたわけではない**（`golang-migrate` はファイルのチェックサムを取らない）。
- **★申し送り（未検証）**——`main` のビルドへ戻すと DB は v116・バイナリのマイグレは v112 までという状態になる。`ErrNoChange` で素通りする見込みだが**実測していない**。
### M37-06: modifier の項目確定と表現形式（`B04` / `B05` の未了分）（2026-09-14）

- **結果**: flags を **10 → 14 値**（追加 7 ／ 選択肢から外す 3 ／ 表示語の変更 1＝`low_jump`「低ジャンプ」→「低空」。コードは不変＝`CHANGE-057`）。**★外した 3 値の表示語は残す**（消すと既存行が `{just}` で出る＝`M37-02` `B04` の逆行）**⇒ 選択肢 14 / 引き当て 17 を別の定数へ分けた**。**問い (ii) は開発者裁定で「案 C」**＝`RecipeText` が `{表示語}` をバッジへ描き替える（**追加クエリ 0・`recipe_cache` の形式変更 0**）。**★★描画は `[修飾] 技` の順である**（2026-09-14 開発者指示＝「modifier の情報を見てから技を見るという順番の方が自然」。**サーバ文字列は `技 {修飾}` のままであり、変えたのは描画順だけ**）。`parry_drive_rush` の表記は「生ラッシュ」へ寄せた。**消費マイグレ 0 本 ／ CHANGE 自採番なし**。`go test ./...` **EXIT=0 / `--- FAIL` 0 件** ／ `pnpm test` **EXIT=0・2931 passed** ／ `make e2e` **EXIT=0・347 passed（flaky 0）**。
- **報告**: 完了報告 [M37-06-completion-report.md](M37-06-completion-report.md) ／ レビュー [m37-06-review.md](m37-06-review.md) ／ 設計伝達レポート `docs/handover/design-reports/20260914-m37-06-design-exceptions.md`
- **★横断課題**:
    1. **★★★問い (ii) は指示書 §3-1 の既定の分岐（止まって請求する）から外れている。** 実査では確かに `recipeCache` が構造を持たなかった（`{presetId: displayString}` の平文）が、**開発者が 3 案から「案 C」を選んだ**（2026-09-14・逐語「3、案C」）。**⇒ 一般形＝「構造を持たない」は「案 A か B の二択」を意味しない。文字列の中に既に表示語が入っているなら、描画時に替えるという第 3 の道がある。** 設計卓は受理の手番でここを見ること（完了報告 §0.1）。
    2. **★★指示書 §0.5「ボタン群をやめる」は前提が実物と食い違っていた。** modifier の欄は `MAX_BUTTONIZED_OPTIONS` の対象ではない（実測＝素のチェックボックスであり `OptionButtonGroup` を 1 度も通っていない）。**⇒ やめる対象が存在しなかった。** 指示書 §2.4-4 の分岐に入って現行の形を維持し、縦は実測で ±0 に収めた。**★一般形＝「上限に当たる」を根拠に形を変える指示は、その欄が本当に上限の仕組みに乗っているかを先に実査すること。**
    3. **★★★Go ⇄ フロントの表示語一致を機械検査にした**（`web/src/features/combo/modifier-flag-labels.sync.test.ts`）。**着手前は `DES-004` §2.3 が逐語で「機械検査は無い」と書いていた状態である。⇒ 足した理由は「あると良いから」ではなく、案 C が両側の一致に*依存するようになった*からである**（ずれるとバッジが黙って出なくなる）。**★followup `modifier-flag-labels-triplicated-without-check` が言う「定数の移設」はしていない**——照合だけを足し、定義の置き場は 1 文字も動かしていない。**★`DES-004` §2.3（3 か所目）は依然として検査の外である。**
    4. **★★`recipe_cache` の再構築が要る（開発者の手番）。** 保存済みの `recipe_cache` は古い表示語（`{低ジャンプ}`）を持ち続ける。**⇒ 設定画面の「キャッシュ再構築」を 1 回押すこと。**新規に作る文字列は押さなくても「低空」である（`M37-02` が同型の申し送りをしている）。
    5. **★`cancel_drive_rush` の表記の割れが残る**（サーバ「キャンセルラッシュ」／ UI「キャンセルドライブラッシュ」）。**開発者が「そのままでよい」と裁定した**（2026-09-14）。⇒ `parry` 側だけが揃った状態である。§J 原稿は完了報告 §10。
    6. **★実 DB での確認をしていない**（`M37-03` の横断課題 7 と同型）。クリーンクローンに `*.db` が 0 件で、削除 3 値を持つ行数を数え直せなかった。**⇒ `M37-RESEARCH-01` の「各 1 件」は転記していない**（計測点 `M-157`）。**代わりに行数に依存しない形で担保した**——テスト側で当該 flag を持つ行を作って描画し、内部識別子が出ないことを見ている。
    7. **★着手前から `gofmt` が 2 件非適合であり、CI の gofmt ジョブは枝元（`a3fe6a2`）で赤だった**（`internal/model/combo.go` / `internal/service/notation/flagtext_internal_test.go`）。**本サブの成果ではないが、どちらも触るファイルなので整形した。⇒ 他レーンが同じ 2 本を触っていた場合は衝突しうる。**
    8. **★★★「高」指摘の不採用は 0 件**（レビュー 12 件＝高 1 ／ 中 4 ／ 低 7。**高-1 は採用・是正済み**＝「機械検査は無い」という失効記述がコードコメント 2 か所に残っていた件。**★不採用は低-4 / 低-6 の 2 件のみで、いずれも理由を報告書へ記録した**）。**再レビュー往復 0 回。**採否の全数は完了報告 §9.1 とレビュー報告書末尾の「取り込み結果（自動トリアージ）」に在る。
    8b. **★★確定反撃サーチ（`PunishList` / `PunishTree`）は `RecipeText` を通らない**（実測＝`combo.recipe` を素の文字列で直描き）。**⇒ 一覧・詳細・マイコンボ・比較・セットプレイ 5 面がバッジになった一方、確定反撃サーチは従来どおり `{}` 付きの平文である。★意図した現状であり、通すかどうかは別の判断**（同面は「レシピの表示」ではなく候補の一行要約）。
    8c. **★★★修飾の位置は面によって違う。これは 2026-09-14 開発者裁定であり「揃え漏れ」ではない。** 一覧・詳細・比較・セットプレイ（`RecipeText` を通る面）は**技の左**、編集画面（`StepRow`）は**行の右端**。**開発者の逐語＝「編集画面での非対称性は問題視しません。この画面の場合はこちらの方が編集ボタンに近いので見やすいです」。⇒ 一般形＝同じ情報でも、面の目的（読む／操作する）が違えば最適な位置が違う。★「全面で揃える」を無条件の善としないこと。** 本サブの目的は*語彙と見た目*の一致であり、**位置の一致ではなかった**（完了報告 §3.4a）。
    9. **★★★レビューが見つけた一般形＝「自分がその手番で失効させた記述」は、自分では見つけにくい。** 本サブは `DES-004` §2.3 の差し替え原稿には「機械検査の状況が変わった」を**正しく書いていた**のに、**同じ事実を述べているコードコメント 2 か所は旧のまま残した**。**⇒ 原稿だけが直って実体が旧のまま、という非対称である。★一般形＝「〜は無い」「〜は未実装」と断言している既存記述は、それを覆す変更を入れた手番で `grep` して全数を拾うこと**（教訓 `E-118` の版数と同型だが、対象が「版」ではなく「事実の断言」である）。
### M37-05: 始動位置のマス数の不変条件（`P-60` の決着）（2026-09-13）

- **結果**: `go test ./...` ／ `pnpm test`（233 ファイル・2909 テスト）／ `make e2e`（全数）すべて green。**マイグレ消費 0 本**（最新は `000112` のまま）。**CHANGE は自採番せず原稿 3 本を完了報告 §8 に置いた**（`DES-002` §4.2 ／ `DES-005` §5.7 ／ `DES-003` §3.3）。**★確定事項＝`PATCH` 経路が `fillStartPositionMassForPatch` で区分の代表値を補完するようになり、`PUT` との食い違いが消えた。★`position` は 1 バイトも書かない。★`carry_distance_mass` は対象外。**
- **報告**: 完了報告 [M37-05-completion-report.md](M37-05-completion-report.md) ／ レビュー [m37-05-review.md](m37-05-review.md)
- **★横断課題**:
    1. **★★★「補完を外すと赤くなる数」と「入れて既存が赤くなる」は別の確認である**（レビュー 高-1）。**製造は前者（positive control で 10 件赤）を実施したが、後者を確認しないまま完了報告へ「`go test ./...` 緑」と書き、実際は `TestUpdateMetadata_PositionMass_ClearsWithPresentNull` が赤であった。** **★★直接の原因は検証コマンドを `| head -20` へ通したことであり、`FAIL` 行が切り落とされ、`$?` もパイプ末尾の `echo` を拾っていた。⇒ 一般形＝全数テストの合否はパイプを挟まずファイルへ落として終了コードで見ること。** **★赤の中身は実装の欠陥ではなく、`D-864` が意図的に変えた挙動を旧のまま固定した既存テスト（`M37-01` 由来）であり、期待値の側を直した。**
    2. **★★不変条件が閉じているのは片方向だけである。** `PATCH` は「区分あり ⇒ マス数が入る」を守るが、**「マス数あり ⇒ 区分が決まっている」は守らない**——`position` が不問の行へ `PATCH` でマス数だけを送ると `position` は NULL のまま値が入る。**★逆向きを閉じているのは画面の `positionFromMass` 導出と `hasKeyChanges` の `PUT` 振り分けの 2 つだけであり、API 直叩きは射程外である**（指示書 §0.4 ／ §7-2 が「別の裁定が要る」としている）。**⇒ 設計書へ「3 経路で成り立つ」と無限定に書かないこと。**
    3. **★`import.go` の事前重複判定は正規化前の `position` を使っている。** `internal/service/comboio/import.go:335-363` の `checkDuplicate` は CSV の生の値で判定する一方、`normalizePositionAndMass` の godoc は「重複判定より前に呼ぶこと」と定めている。**⇒ `Create` の内側では順序が正しいが、この取り込み層の事前判定はその保証の外に在る。★開発者実測では食い違い行 0 件であり実害は無い。本サブは CSV 経路が射程外のため直していない。**
    4. **★`followup` §DD の `position-mass-clear-differs-between-patch-and-put` と保留 `P-60` は解消した。⇒ 状態の更新は設計卓の手番である**（`D-838`。**製造は `followup-backlog.md` を 1 文字も編集していない**）。
    5. **★段 1-1（違反行の実査）は開発者が手元の dev DB で実測した**——**全 133 行（有効 109 ／ 削除済み 24）で違反 A・B とも 0 件**。**⇒ 埋め戻し 0・マイグレ 0。★クラウド実行の作業領域には dev DB が無く、`migrations` は `combos` を 1 行も seed しないため、製造側では原理的に測れない**（`M37-03` §7.1 と同型）。**照合 SQL は完了報告 §2.1 に全文を残した。**

### M37-07: 始動技の持続当てを重複判定キーへ加える（2026-09-14）

- **結果**: `go test ./...`（EXIT=0・ok 60・FAIL 0）／ `pnpm test`（234 ファイル・2950 テスト）／ `make e2e`（**全数 352 passed・EXIT=0**）すべて green。**マイグレ消費 1 本＝`000117`**（払い出し済み・自採番なし）。**CHANGE は自採番せず原稿 3 束を設計伝達レポート §1 / §6 に置いた**（`SUPP-001` §2.2 ＝正本 ／ `DES-003` §3.3 ／ `DES-006` §2.3 ／ `DES-002` §4.2・§7 ／ `DES-005` §5.7・§5.6・§5.4）。**★確定事項＝重複判定キーが 7 → 8 要素になった。`combos.starter_meaty` は `INTEGER NOT NULL DEFAULT 0` の 2 値で `CHECK` を持たない。★`recipe_hash` は 1 バイトも変わっていない。★`PATCH` には載せない（識別キーのため `PUT` へ行く）。★`hit_type` は 8 値のまま・`combo_oki_options` は差分 0。**
- **報告**: 完了報告 [M37-07-completion-report.md](M37-07-completion-report.md) ／ レビュー [m37-07-review.md](m37-07-review.md)
- **★横断課題**:
    1. **★★★`SUPP-001` §2.2 が約束している構造が実装に存在しない。** 同節は「重複判定で比較するフィールドはリスト定数として定義する ／ **リスト定数を 1 箇所修正するだけで挙動を切り替えられる構造とする**」と書いているが、**実測（`grep -rn "DuplicateCheckFields" --include=*.go .`）は定義行のみの 1 件**であり、判定ロジックからも自身のテストからも参照されていない。**⇒ 書き換えても挙動は 1 バイトも変わらない。実際のキーは 30 箇所に分かれて持たれている。** 本サブは値だけを 8 要素へ更新し、godoc へ「これは写しであってスイッチではない」と足し先一覧を書き足したうえで、**配線し直すのは射程外**として設計伝達レポート §4-1 へ 2 案（記述を実態へ合わせる／実装を記述へ合わせる）つきで回した。**★層独立性のため `repository` と `validation` で意図的に二重定義している**（`M1-03` 機械レビュー・高優先の対応）**ため素直には畳めない。⇒ 設計卓の手番。**
    2. **★★失効記述の取りこぼしが 11 件あり、レビューが検出した。** 「判定キー 6 項」等の項数を書いた記述が本番コード 6 件・E2E spec 2 件・テスト 3 件に残っていた。**★★直接の原因は、足し先を数えるための `grep` を `| head -20` へ通したこと**——20 行で切られ、`internal/service/validation/duplicate.go` 以降が視界に入っていなかった。**しかも `--include=*.go` しか掛けておらず、フロント（`*.tsx`）は一度も走査していなかった。⇒ 一般形＝「全数を数える」ための `grep` を `head` で切らないこと（`M37-05` の `go test | head -20` と同型であり、対象がテスト出力から `grep` へ移っただけである）。★レビューの一覧に無かった `web/e2e/m23-05-duplicate-collision.spec.ts:21` を取り込み時に追加で検出した。**
    3. **★★キーの独立再実装が 1 つ在り、足し忘れていた。** `internal/service/combo/existing_duplicates_audit_test.go` は `auditKey` 構造体と生 SQL で識別キーを**別に組んでおり**、`TACPENDIUM_AUDIT_DB` 未設定なら skip されるため **`go test ./...` は緑のまま**である。**⇒ 開発者が実 DB を監査した瞬間に、持続当て違いの 2 行が「重複」として誤報される形だった。★「テストが緑」は足し先を数え切った証拠にならない（環境変数で走行が切り替わるテストは、その環境でしか観測できない）。**
    4. **★★表示語が既存の E2E ロケータと部分一致で衝突した。** 開発者裁定の「持続当て（**始動技**）」が「始動技」を部分文字列として含むため、`getByText("始動技")` が 2 要素に当たり `m12-03` が strict mode violation で落ちた。**⇒ 表示語は変えられないためロケータ側を `{ exact: true }` にした（主張の中身は不変）。★一般形＝既存ラベルを部分文字列として含む新ラベルを足すときは、`web/e2e/` の部分一致ロケータを全数走査すること。★フロントの Vitest 側は Testing Library の `getByText(string)` が既定で完全一致のため無事だった。**
    5. **★指示書とチェックリストに失効記述が 2 件あった。** `M37-07` 指示書 §2.1 段 1-2 とチェックリスト F-4 が「`ls migrations/` の最新は **`000115`**」のままである（v1.1.0 が `§0.6 #3` だけを `000116` へ更新して追随していない）。**実測は `000116` であり `§0.6 #3` と一致する。⇒ 版ゲートは通した。★指示書の是正は設計卓の手番である。**
    6. **★`csv-import-precheck-duplicate-uses-unnormalized-position`（既知の穴）は直していない。** 本サブは同じ `checkDuplicate` へ `starter_meaty` を足したが、`position` が正規化前である問題はそのままである（指示書 §4.1 が「本サブでその穴を直す必要は無いが、足す先には含まれる」と明示）。**⇒ `followup-backlog.md` の行の更新は設計卓の手番**（`D-838`。**製造は同ファイルを 1 文字も編集していない**）。
    7. **★★実 DB での確認は完了した**（**2026-09-14 の開発者実測で更新**。★本項は当初「実測は本手番では取れない」と書いていたが、同日中に開発者が実施したため事実が覆った。⇒ 黙って書き換えず更新である旨を明記する——`progress-log` は横断インデックスであり、次のサブと設計卓が前提としてそのままコピーするため、古い断りを残すほうが有害である）。**実測＝列定義 `INTEGER / NOT NULL / DEFAULT 0` ／ `combos` 総数 144（`<> 0` が 0・`IS NULL` が 0）／ 本登録・未削除 111 ／ 識別キー ＋ `recipe_hash` が一致する組 0 組・0 件。** **★★★指示書 §2.1 段 1-4 とチェックリスト §8 の対照値「133 行〔有効 109 / 削除済み 24〕」とは食い違う**——**あちらは `M37-05`（2026-09-13）時点の値であり、1 日のあいだに DB が増えている。⇒ 結論は 1 つも変わらない（全行 0・重複 0 組）が、チェックリスト §8 は「数え直させる」ための対照値であり、古いままだと次に数え直す担当が「合わない」と誤って止まる。★是正は設計卓の手番である**（製造は指示書・チェックリストを編集しない）。 **★★あわせて「0 組」の読み方を書き分けること**——**重複が無いことの確認ではあるが、監査の突合せロジックが `starter_meaty` を正しく織り込んでいることの証明ではない**（比較対象の組が 1 つも無いため）。**⇒ 積極的に示されたのは「新列を含む `SELECT` が実 DB で通り 111 行を読めた」ことであり、突合せの正しさは Go のテスト側が担う。** **★製造の作業ツリーでは原理的に取れない**（クリーンクローンに DB が無く `combos` は seed ではなく利用者データ。`M37-05` / `M37-03` と同型）**点は変わらない。**
    8. **★★開発者の手動確認は全 5 項目合格した**（2026-09-14。B-1 実 DB ／ B-2 一覧フィルタの横幅 ／ B-3 編集画面 ／ B-4 `PUT`/`PATCH` の振り分け ／ B-5 CSV の往復。詳細は完了報告 §5.9）。**★★★このうち `B-2` は指示書 §2.4-5 が名指しで開発者判断を求めていた唯一の項目である**——同節は「一覧のフィルタへ足す」を裁定で確定させたうえで「`P-21` / `M27-03`〔一覧の横幅・列の並び〕の面に近づくことは承知のうえの決定である。⇒ 横幅が苦しくなったら、外すのではなく止めて報告すること」と条件を付けていた。**⇒ その分岐には入らなかった。承知のうえで受け入れたリスクが実機で問題にならなかった、という結果である。★製造は「苦しいか」を視覚的に判定できないため、この観測は開発者にしか取れない。** **★★B-3 の「紛れ」の確認は表示語の存在理由そのものである**——step の modifier「持続当て」と状況欄の「持続当て（始動技）」が同一画面に出る。**⇒ 開発者裁定で「（始動技）」を足した判断が実機で機能した。**

### M36-01: 配布アーカイブの組み立てとチェックサム（2026-09-15）

- **結果**: `make release-archives` 一本で 3 OS ぶんの配布物が出るようになった（**`DES-002` §11.2 の構成が初めて実体になった**）。`go test ./...`（EXIT=0・ok 60・FAIL 0）／ `pnpm test`（234 ファイル・2950 テスト）／ `make e2e`（**全数 352 passed・EXIT=0**）すべて green。**マイグレ消費 0 本 ／ 新規依存 0 件 ／ CHANGE は自採番せず原稿 2 件を完了報告 §8-2 / §8-3 へ置いた**。**★確定事項＝出力先は `dist/release/`（`.gitignore` の `/dist/` 済み・成果物は 1 件もコミットしていない）。構成の正本は `scripts/release-targets.sh` 1 か所（組み立て・検査・`Makefile` の 3 か所へ名前を散らしていない）。破壊確認は `scripts/check-release-archive.sh --self-test` として常設化し、`check-artifact-integrity.sh` が機械強制する（対照 11 件＝陰性 5 / 陽性 6）。★nightly のワークフローは 1 バイトも変えていない。** **★★★ライセンス関係ファイルは全 7 件をパス保持で同梱した**〔`LICENSE` ／ `DATA-LICENSE.md` ／ `NOTICE` ／ `REUSE.toml` ／ `LICENSES/` 配下 3 本〕**。⇒ 2026-09-16 の開発者判断である。★着手時は既定どおり 1 件も入れず、判断を上げてから実施した（実装が判断を下してはいない）。** **★7 件が 1 セットなのは相互参照のためである**——**`NOTICE:4-6` が自ら「配布物に付随する告知」と名乗り、`LICENSE` ／ `LICENSES/` 配下 ／ `REUSE.toml` ／ `DATA-LICENSE.md` の 4 つすべてを名指ししている。⇒ 部分的に入れると、同梱した `NOTICE` の参照先が欠ける。★`LICENSES/` のディレクトリ名まで保つのも同じ理由である**〔basename で平坦化すると `LICENSES/MIT.txt` が `MIT.txt` として直下に落ちる〕**。**
- **報告**: 完了報告 [M36-01-completion-report.md](M36-01-completion-report.md) ／ レビュー [m36-01-review.md](m36-01-review.md)
- **★横断課題**:
    0. **★★未確定のまま配布物へ載るものが 2 つある**（ライセンス同梱の帰結）。**`NOTICE` の連絡先は伏せ字であり、記載の公開リポジトリ URL `https://github.com/plexiblinp/tacpendium` は未開設である**（`NOTICE` 内に明記）。**⇒ 2026-09-16 の同梱判断で、この 2 つが利用者の手元へ届くようになった。★公開の手番までに差し替えが要る。**
    1. **★★★「組める」ことは「配布してよい」ことではない。** 現時点で `make release-archives` を打つと、**`<img>` 27 箇所がすべてリンク切れの説明書**が入ったアーカイブ 3 本が、検査全緑で出来上がる（`docs/usermanual/images/` は実測 0 枚）。**★版ゲート 3b がこれを不合格にしないのは正しい**（撮影は開発者の手番であり本サブの後）**が、その帰結としてリリース可否の門がどこにも無い状態になった。⇒ 実際にリリースを打つ前に、撮影の完了を人が確かめること。★機械では止まらない。**
    2. **★★macOS の名前の非対称を「揃えず可視化した」**（設計卓裁定 `D-887`）。アーカイブ名 `tacpendium-macos-arm64.tar.gz`（`DES-002` §11.2）の中に `tacpendium-darwin-arm64`（`Makefile:74`）が入る。**★`macos` と書いてあるのは設計書 1 か所だけで、実装と `README.txt` の 2 か所は `darwin` で揃っている**（実測）。**⇒ 原因は命名規則が 2 つ並んでいること。`Makefile` は 3 つとも GOOS 名で出すため、`windows` と `linux` は利用者向けの語とたまたま一致して隠れ、macOS だけが露出した。★CHANGE 請求として完了報告 §8-3 へ（寄せ先 3 案と波及先つき）。**
    3. **★★SHA-256 の検証手順が、検証したい時点では読めない場所にしかない。** 手順は `README.txt` に足したが、その `README.txt` はアーカイブの中にある。**⇒ ダウンロード直後に照合したい利用者はまだ展開していない。★同じ 1 行がリリースページ側にも要る＝`M36-02`（射程 6）への従属である。**
    4. **★`README.txt` の末尾にある「リポジトリを扱う人向けの注記」が、本サブで初めて利用者の手元へ届く形になった。** `CHANGE-191` の時点では `README.txt` はリポジトリ内にしか無かった。**⇒ 配布時に落とすか残すかは `CHANGE-191` を起こした面の判断である**（実害は小さい。「読み飛ばしてください」と断ってある）。
    5. **★★指示書・チェックリストに記載の食い違いが 3 件あった**（いずれも勝手に直していない）。(a) 指示書 §4.1d の `README.txt:14` は**実測 `:19`**（内容は正しく行番号だけのずれ） (b) チェックリスト §8 対照値「ライセンス関係 4」は**ルート直下だけの数え方**であり、B-3 の「`REUSE.toml` が指すもの」に素直に従うと `LICENSES/` 3 本を含めて **7** になる (c) `DES-002` §11.2 と `CHANGE-192` §2.1 の「22 枚の PNG」は**実測 27**（章 22 と図 27 の混同）。**⇒ 是正は設計卓の手番。**
    6. **★新設の `scripts/check-release-archive.sh` が `CLAUDE.md` §8「常設の機械検査（まとめ）」表に載っていない。** **⇒ `CLAUDE.md` は製造が勝手に編集する面ではないため、載せるかどうかは設計卓・開発者の手番**（`check-artifact-integrity.sh` が自己検査を拾っているので、機械的な強制はすでに効いている）。
    7. **★★★「コミットしない」の範囲を広く取り違えると、成果物の中に失効記述が生まれる。** 開発者指示（2026-09-15・逐語＝「本ブランチに対するコミットはしないでください」）を*作業一式への禁止*と読み、完了報告・本ログ・レビュー報告の 3 か所へ「1 度もコミットしていない」と書いた。**★翌日の確認で範囲が明確化された**（2026-09-16・逐語＝「コミットしないのは『組み立ての成果物』だけです — zip / tar.gz そのものとチェックサムファイルです」）**。⇒ 3 か所とも、コミットした瞬間に失効する記述だった。** **★★機械では捕まらない**——`go test` も lint も型検査も文書を見ない。**⇒ 人が読む以外に経路が無い**（`D-250` と同型）。**★一般形＝範囲が読み取れない禁止は、広く取る前に確かめること。** **★成果物**〔`dist/release/` の zip / tar.gz / `.sha256`〕**は `.gitignore` の `/dist/` で既にカバーされており、コミット対象になりようがなかった。**
    8. **★指示書とチェックリストは開発者提示の v1.2.0 を適用したが、作業ツリーの `docs/instructions/` 配下は v1.1.0 のままである。** **⇒ リポジトリへの反映は設計卓の手番。★Phase B のレビュアーへは v1.2.0 の実体パスを明示して渡した**（渡さないと、是正前の広い `P-4` で `dist-readme.txt` の編集が射程外と誤判定される）。

### M32-03: 操作説明書を `M37` の着地へ追随させる ＋ クイックスタート新設（2026-09-15）

- **結果**: 実装差分 0 行のため `go test` / `pnpm test` / `make e2e` は回していない（指示書 §5・チェックリスト C-4）。常設検査は `check-artifact-integrity` / `check-doc-refs` / `check-doc-inventory` / `check-dist-readme` / `check-stop-discipline` / `check-md-emphasis` がすべて **EXIT=0**。**マイグレ消費 0 本 ／ CHANGE 消費 0 本**（原稿は設計伝達レポート §1 / §6 へ）。**★8 章の判定＝改稿 4 章**〔`ch05` / `ch07` / `ch08` / `ch17`〕**／ 読んだが直す所は無し 3 章**〔`ch06` / `ch10` / `ch11`〕**／ レビュー取り込みで 1 文足した 1 章**〔`ch20`〕**。★14 章の差分は `ch03` の 1 文のみ**（開発者の明示指示による例外）**。★本編は縮めていない**（`+23/-3`・削除 3 行はすべて置換の片側）**。★撮影の置き場は 27 → 28 枚**（クイックスタートの 1 枚を追加。**全 28 枚が `figure.todo` のまま**）。
- **報告**: 完了報告 [M32-03-completion-report.md](M32-03-completion-report.md) ／ レビュー [m32-03-review.md](m32-03-review.md)
- **★横断課題**:
    1. **★★★`M32-02` 本文執筆後に着地した `CHANGE` は 20 本**〔`192`〜`211`〕**であり、指示書 §2.2 が名指しする 8 本より多かった。** 境界は `git log --diff-filter=A -- docs/change-notes/` を本文最終コミット `8df45ab` 以降で回して機械的に引いた。**⇒ 残る 12 本を全数実読して判定表に落とし、影響ありと判定した 2 本**〔`CHANGE-192` 到達経路 ／ `CHANGE-207` 重複判定キー〕**を取り込んだ。★次に同型の「追随サブ」を起票するときは、対応表を作る前にこの `git log` で境界を引くこと。**
    2. **★★`ch08` の「大事」box が*現に誤っていた*。** 「重複判定キーはこの **6 つ**」と書いていたが、実測（`internal/service/combo/duplicate_keys.go:33-42`）は 8 要素で、`character_id` を除くと利用者から見て **7 つ**である（`CHANGE-207` / `M37-07` が `starter_meaty` を足した）。**★指示書 §2.2 の対応表はこれを名指ししていない。⇒ 表は `CHANGE` の反映先から引いたものであり本文を読んで作られていない（同 §4.5 の警告どおり）。**
    3. **★★★`M34-02` のトレイ常駐が利用者向け文書へ届いていなかった。** `CHANGE-187` §5 は「`M32` への申し送り 2 件」〔移行手順 ／ **終了は通知領域のアイコンから**〕を明記しているが、**`M32-03` 指示書はこれを拾っていない。** 実測の失効記述は 3 か所〔`dist-readme.txt:22` / `:74` のコンソール参照 ／ `ch03` の「ウィンドウをタスクトレイへしまってある状態から」〕。**⇒ 開発者の明示指示により是正した。★移行手順**（ショートカットの作業フォルダを変えていた利用者は `config.toml` を exe の隣へ）**は射程外として書いていない。**
    4. **★★指示書 §2.5.4-2「キャラクターを取り込む（リュウ以外は取込が要る）」は失効していた。** キャラクター・技は `migrations/` の seed で投入済みであり、初回に取込は要らない。22 章にもその画面は無い（`ch16` は**コンボの CSV 取込**であって別物）。**⇒ クイックスタートの節 2 を「最初に聞かれることに答える」へ差し替えた。**
    5. **★★★指示書 §2.5.3 の 3 条件は同時に満たせない**（**レビュー 中-4 の取り込みで判明**）**。** 「節 5 つ」「各節 3 行程度 ＋ 図 1 枚」「**全体が 1 画面に収まる**」の 3 つのうち、**算術上の下限が図 0 枚でも約 990px**〔5 節 ×（3 行 × 26.6px ＋ 見出し・余白 70px）＋ ヘッダ 150px ＋ フッタ 90px〕**であり、ノート PC のビューポート高 ≒ 800〜900px を超える。** 分量を詰めて概算 2,000px 超 → **約 1,389px** まで下げたが、これ以上は指示書が求める節そのものを落とすことになる（芯の節 3 は `I-3` が保護）。**⇒ 製造の判断では閉じない。設計伝達レポート §4 で裁定を仰ぐ。★概算は CSS の寸法からの計算であり実測ではない（製造もレビューも描画していない）。**
    6. **★★`CHANGE-192` §2 の配布アーカイブ構成にクイックスタートが無い。** 同図は `exe` ＋ `README.txt` ＋ `manual/{readme.html, images/}` であり、アーカイブは `nightly-crossbuild.yml:109` のとおり **Releases 公開時の人の手番**でスクリプトが無い。**⇒ 本サブでは CI を触らず、配布 `README` が名指しするのは `manual/tacpendium-readme.html` だけにして、クイックスタートへはその冒頭のリンク経由で送る形にした**（レビュー 高-2 の取り込み）**。★構成図への追加は CHANGE 原稿として設計伝達レポート §1 / §6 へ出す。**
    7. **★「高」指摘の不採用は 0 件である。** レビューは 14 件（高 2 / 中 7 / 低 5）を挙げ、**採用 9 / 不採用 5**。不採用はすべて「中」「低」であり理由をレビュー報告書末尾の「取り込み結果（自動トリアージ）」へ記した。**⇒ Phase C の安全弁は発動していない。**
    8. **★★高-1 は「対応表を信じきるな」が*製造の側でも*当たった例である。** `ch05` の絞り込みの中立ラベルを `CHANGE-209` §4 の*状態の説明語*「指定なし」から写していたが、**実装は `comboList.filter.all` ＝「全て」**（`ComboListFilters.tsx:451`）である。**★同じ `ch05` の 4 段落下で同じラベルを「全て」と書いており本文内で 2 通りになっていた。⇒ 一次源が `CHANGE` でも、画面に出る語は実装を引くこと。**
    9. **★開発者の裁定 2 件がリポジトリ上に記録されていない**（レビューの「不明事項 1」）**。**〔`ch20` の「発生」の食い違いに触れないこと ／ `ch03`・`dist-readme.txt` のトレイ是正と前付けのリンク〕**はいずれも本セッションの対話で与えられており、ボード・コミットに裁定行が無い。⇒ 設計伝達レポート §4 で受理の手番に記録を請求する。**
    10. **★指示書・チェックリストの失効記述 2 件。**〔§2.3-1 の引用先「`M32-02` レポート **§1-1**」は実際には **§3.4**（枚数 27 そのものは正しい） ／ §2.5.5 が「`docs/usermanual/combmgr-friend-readme.html` が実在する」とするが、同ファイルは `M32-01`（`582106f`）で改名され中身も `M32-02` が全面改稿しており**参照先を失っている**〕**。⇒ 是正は設計卓の手番である。**
    11. **★★【2026-09-17 追補＝`M36-01` と `M32-03` の統合後の現状】上記の作業時点の記録は書き換えず、現在値を補う。** **撮影対象は 27 → 29 枚**である（`tacpendium-readme.html` の `figure.todo` が **28**、`tacpendium-quickstart.html` が **1**。`<img>` も合計 **29**）。上の結果欄にある「27 → 28 枚／全 28 枚」は、`ch07` で本編へ増えた 1 枚を数えた一方、クイックスタートの 1 枚を合計へ足していないため、統合後の実体より 1 枚少ない。**また、横断課題 6 の「スクリプトが無い」は `M36-01` の着地後には失効している。現在は `make release-archives` → `scripts/build-release-archives.sh` が組み立て、`scripts/release-targets.sh` を構成の正本として `docs/usermanual/` をディレクトリごと `manual/` へ同梱するため、クイックスタートも自動的に入る。** **★ただし `CHANGE-192` §2 の構成図にクイックスタートが明記されていない、という前半の指摘は現状でも有効である。**

### M38-02: 技編集をメニューから外し、「引っ越し取込」を「他から引っ越し」へ改名（2026-09-17）

- **結果**: `go test ./...` EXIT=0 / `--- FAIL` 0 件 ／ `pnpm test` EXIT=0 / 234 files・2953 tests ／ `make e2e` EXIT=0 / 351 passed・1 flaky（`m31-02-tag-field-drag` の右ドラッグ文字選択。本サブはタグ欄にもドラッグ挙動にも触れていない）。**消費マイグレ番号 0 本 ／ CHANGE 自採番 0 本**（原稿は設計伝達レポート §1 / §6）。確定事項＝**技編集はコード・ルート・テストとも温存し、導線だけを外した**（フェーズ5 で setplay only 画面へリメイク）／**改名は表示語のみでルート `/import/combo/helper` は不変**。
- **報告**: 完了報告 `docs/progress/M38-02-completion-report.md` ／ レビュー `docs/progress/m38-02-review.md`
- **★横断課題**:
    1. **★★★指示書 §0.1 の前提「設定画面から技編集への導線を外す」は as-built と食い違っていた。** `DES-005` §3（`05-screen-design.md:131`）は「主要ナビには含めず設定配下へ配置する」と定めているが、**実装はヘッダのメインナビに置かれていた**（`Header.tsx:37` の 1 行のみ。設定画面・Footer・確定反撃サーチはいずれも 0 件）。**⇒ 設計書間の矛盾ではなく設計書と実装の乖離であるため止めずに進め、CHANGE 原稿へ載せた。★同乖離は M38-02 以前から在った。**
    2. **★★★指示書 §2.3-2 / §4.3 の「表示語は `ja.json` から引く」は本画面では成立しない。** `ja.json` / `en.json` に intake・helper 系のキーは **0 件**であり、`DES-005` §5.19 の「i18n キーは追加しない（import/export 系の固定 ja 流儀）」どおり**全面直書き**である。**⇒ 表示語の正本は `Header.tsx` と `IntakeHelperPage.tsx` の 2 箇所。指示書の趣旨（設計書・`CHANGE` 通知書から写さない）は満たしている。**
    3. **★★★`retired-words.test.ts` の走査根は `web/src` だけであり、Go・`web/e2e`・`migrations`・`docs/` を 1 バイトも見ない。** そのため `M24-07` の「取込ヘルパー」が **Go 側 19 箇所 ＋ `migrations/` 1 箇所**に残ったまま一度も赤くならなかった（本サブで是正）。**★しかも製造自身が同じ穴に落ちた**——段 3b の走査を `web/` `internal/` `cmd/` `docs/usermanual/` の 4 箱に切ったため `migrations/` の 1 件を取りこぼし、**レビュー 高-1 が検出した**。**⇒ 走査根を広げるかは設計卓の判断。★「申し送りだけでは 3 度目の同型が起きる」というレビューの警告を添えて §4 へ送る。**
    4. **★★指示書 §2.2-3「導線を踏んでいた E2E を URL 直打ちへ寄せる」は実測で no-op であった。** 対象 4 本（`moves-edit` / `m14-03d` / `m14-03e` / `m31-02-character-picker-drag`）は**全数が元から `page.goto` の直打ち**であり、寄せ替えた spec も消した spec も 0 本である。
    5. **★`docs/handover/code-facts.md:501-502` の 2 行が失効した**（`:501` はナビ表示語「引っ越し取込」、**`:502` は消えた `/moves/edit` 導線を `active` と主張**）。**派生資料であり `scripts/generate-code-facts.sh` の生成物であるため本サブでは触っていない。⇒ 再生成の要否を §4 へ送る。**
    6. **★`followup` の `import-screen-has-two-names` に `IntakeHelperPage` が登録されていない。** 本サブは開発者裁定により h1 の括弧書きを残した（ナビ「他から引っ越し」／ h1「他から引っ越し(他のアプリ・メモ・表計算から)」）。**★この非対称は着手前から在り、`DES-005` §2 行19 が元から括弧込みである。⇒ 同型を*増やして*はいないが、台帳に載っていない。§4 へ候補を出す。**
    7. **★「高」指摘の不採用は 0 件である。** レビューは 10 件（高 4 / 中 4 / 低 2）を挙げ、**採用 6 ／ 送付 2 ／ 不採用 2**。不採用はいずれも「低」であり、理由はレビュー報告書末尾の「取り込み結果（自動トリアージ）」に記した。**⇒ Phase C の安全弁は発動していない。再レビュー往復も 0 回。**
    8. **★適用済みマイグレーションのコメント編集には先例がある**（レビューの「不明事項 ①」への回答）**。** `M29-01` が `SAゲージ` の統一で同じことをしている（実物＝`migrations/000020_add_gauge_consumed_columns.up.sql:2`、経緯は `retired-words.test.ts` の `SA ゲージ` エントリの `reason` に逐語）。**⇒ コメント行に限り可。スキーマ・データには触れていない。**
    9. **★`web/e2e/combo-crud.spec.ts` を `M38-01` と同時に触っている可能性がある**（両サブは並列可）。本サブの変更は 44 行目の**コメント 5 行だけ**であり衝突しても解決は自明だが、**取り込みの手番で確認が要る。⇒ 製造からは確認できない**（取り込み系の git 操作は `deny`）。
    10. **★★★【完了報告提出後の開発者裁定・2026-09-17】`/moves/edit` を残す理由が差し替わった。** 指示書 §0.1 / §0.2 は **開発者の逐語として** 「**フレームが特殊なので初期は開発者自身が直したい**」「**フェーズ5 で setplay only 画面へリメイクする**」と記録していたが、**訂正後は「消すコストが高かったから残した。フレームの誤りはマイグレ等で直す」である。⇒ コードコメント 2 ファイルと CHANGE 原稿 A を差し替えた。★指示書 §0.1 / §0.2 ・`M38-overview` §2 ・ボード `D-892` は旧理由のままであり、是正は設計卓の手番**（設計伝達レポート §2-3 で請求済み）。
    11. **★★【同上】説明書の `ch14`（moves 編集グリッド章）を丸ごと削除した。** 当初は章を残して「いまメニューに出していません」と書いたが、**「あまり見せたくない機能について言及を残すのは嫌だ」**との判断で撤回。**節・TOC 行・`ch20` の相互参照・`shot todo` 枠を削除し、「全 22 章」→「全 21 章」を 4 箇所**〔`tacpendium-readme.html` ／ **`dist-readme.txt` 正本 2 箇所** ／ 生成物 `README.txt` 2 箇所〕**で是正して `check-dist-readme.sh --write` で再生成した。★`dist-readme.txt` は指示書 §3-5 が「触るな」と明記していた**（`M36-01` の手番・`D-887`）**。★★★ただしその前提は着手時点で既に失効していた**（2026-09-18 実査）——**`D-890`**（2026-09-17）**が `M36-01` を受理済みであり、同サブの `dist-readme.txt` / `README.txt` への変更**（`37573df` ／ `e2e4260`）**はマージ `1795065` 経由で本サブの基点 `7ce1393` に入っていた。⇒ `D-888` が塞ごうとした「上書きによる消失」は起きていない。★「指示書の禁止を上書きした」は過大な整理であった。⇒ 正しくは「禁止の前提が消えていた」である**（設計伝達レポート §2-4 で、起票時に他サブの手番が閉じていないかを確かめるよう請求した）。**⇒ 撮影枠は readme 28 → 27、総数は quickstart の 1 枚を含めて 29 → 28 枚。★章 `id` は詰めていない**（`ch13` の次が `ch15`。番号は利用者に見えないため）。**★HTML 構造は機械検証済み**〔タグ均衡・TOC 21 ＝ 節 21・アンカー 21 件すべて解決・空の部なし〕。
### M38-01: 新規登録・編集の必須と値域の是正（矢印 ／ 並び ／ 必須の入れ替え ／ 不問 ／ ヒット種別）（2026-09-17・**追補2 = 2026-09-18**）

- **結果**: **全数 green**（★**追補2 実施後の実測**＝ `go test ./...` **EXIT=0**（`^--- FAIL` **0 件**） ／ `pnpm test` **EXIT=0**（234 files / 2971 tests） ／ `tsc --noEmit` **EXIT=0** ／ `make e2e` **EXIT=0**（**364 passed・失敗 0・flaky 0**）。常設検査 **10 本**すべて EXIT=0（★報告を書いた後に `D-890` の 3 本を回し直した）。**★マイグレ消費 0 本 —— 払い出されていた `000118` を未消費で返す**（開発者裁定 2026-09-17）**。★スキーマ変更 0・列の追加 0・新規依存 0・CHANGE 自採番 0**（原稿は設計伝達レポート §1 / §6 へ）。**★段 1 の実査で「ヒット種別の不問」は分岐 (A) と確定** —— `withUnspecifiedFirst` が `value=""` の中立選択肢を先頭へ動的に足していたものであり（「1」は `shortcutKeyForIndex(0)` の数字キー表示）、**バグではなく `M24-12`（2026-08-28 開発者指示）で 4 欄へ一律に足したものの副作用**であった。**★★★`VAL-C15` は最終的に 2 欄になった**〔着手前＝消費ゲージ 2 欄 → 本体で開始残量 2 欄へ入れ替え → **追補2 で開始残量 2 欄も外し、`damage` / `knockdownAdvantage` だけに**〕**。⇒ 欄数の変更は指示書が 5 箇所で禁じており、開発者裁定が上書きした**（下の横断課題 15）**。**
- **報告**: 完了報告 [M38-01-completion-report.md](M38-01-completion-report.md) ／ レビュー [m38-01-review.md](m38-01-review.md)
- **★横断課題**:
    1. **★★★「不問」と「空のまま」は wire 上どちらも `null` であり、サーバでも zod でも区別できない**（Go の `encoding/json` はキーの省略と明示的な null すら区別しない＝`DES-006` §5）**。⇒ 必須 4 欄のうち開始残量 2 欄は*サーバでは強制できない*。** 門はフロント（`web/src/features/combo/requiredPublished.ts`・**payload ではなくフォーム state を見る**）に置き、BE / CSV 側の当該 2 欄の `present()` は「常に真」とした（**2026-09-17 開発者裁定**）。**★`!= nil` へ「直す」と不問の保存そのものが 400 で落ちる。** 破壊確認＝`TestC15_StartGauges_NilIsNotError`。**⇒ `DES-006` §2.1 の `VAL-C15` 行はこの非対称を持たないため CHANGE 原稿で明記する。**
    2. **★★「保存された NULL は必ず不問である」はエディタ経路に限った命題である。** ⇒ API 直叩き・`Materialize`・仮登録からの昇格は**不問を選ぶ意思なしに NULL を書ける**（門を通らないため）。★害は無い（この 2 列の NULL は意味が 1 つしかない）が、**「空のまま保存された NULL は存在しない」を前提にした処理を書かないこと。**
    3. **★★★`hit_type` の既定を `""` → `normal` へ変えた帰結＝既存の NULL 行と新規の `normal` 行が重複判定で別キーになる**（`DES-006` §2.3「NULL 同士は一致」）**。⇒ 見た目が同じコンボを重複登録できる状態が新たに生じた。★着手前も同じ穴は在ったが、既定が NULL だったため畳まれて表に出ていなかった。⇒ 本サブは境界の位置を動かした。** **★★母数が付いた**（2026-09-17・開発者が実 DB で実測）——`hit_type IS NULL AND deleted_at IS NULL AND is_draft = 0` が **91 件**。**★検証用 DB であり、残っていてもエラーは起こさないのでこのままでよい**（開発者判断）**。⇒ 実利用の DB でも同じ形が起きるため、`DES-006` §2.3 への明記は要る。**
    12. **★★★開発者の実機確認で「不問」の入力方法を作り直した**（`badc7f0`・2026-09-17）**。⇒ 逐語＝「キーボードからマウスに持ち変えずに入力できる、という良さが、トグルボタンで切り替える作りだと消えてしまう」。** **★トグルを独立した順送りの停止点にしたことで、数値を打つだけの利用者も毎回そこを通過させられていた**（+2 停止）**。⇒ 入れ子の `data-seq-stop` を外し、切り替えを*数値欄の中の `Space`* にした**（停止点 18 → 16）**。** **★★★旧案はキーボードの担保としても弱かった**——`excludedKeys.ts` の逐語「**Space を登録した利用者は、入力面が表示されている間、Space でフォーカス中のボタン・スイッチを実行できなくなる**」**。⇒ 「Switch へ Tab して Space」は Space を技に割り当てた利用者では成立しない。★数値欄の中なら `useKeyboardInput` の最初のガード**（`isEditableElementFocused()`）**が効くため奪われない。** **★一般形＝「キーボードで到達できる」と「キーボードの流れを壊さない」は別の主張である。⇒ 停止点を 1 つ足すことは、その欄を使わない全員への課金である。**
    13. **★★必須化は目的ではなく*区別を作る手段*である**（2026-09-17 の対話で確認）**。⇒ 開発者の狙いは「意識的に入れなかったのか、単に面倒で入れなかったのかを明らかにしたい」であり、必須化はそれを「保存時にどちらかを選ばせる」ことで達成している。** **★★必須化をやめるなら、区別を残すには*永続化する 3 つ目の状態*が要る**（＝列。`oki_verified` / `migrations/000096` とまったく同じ形）**。⇒ 列は `M38-01` の射程外**（指示書 §0.3）**であり、設計卓の裁定と CHANGE が要る。★いまは「必須のままで様子を見る」**（開発者判断）**。⇒ 使ってみて重ければ列案へ移る。**
    14. **★★★追補2（2026-09-18・開発者裁定）＝「区別を諦め、`VAL-C15` を 4 欄 → 2 欄にした」。** 逐語＝「**空欄とNULLの状態がわかりにくく感じます**（略）**コンボ開始時のドライブ・SAゲージの必須を外す。NULLだった場合はBEの方で不問扱いにする。**」**★違和感の正体は状態数の不一致である** —— **UI が 3 状態**（数値 / 不問 / 空のまま）**なのに DB は 2 状態**（値 / NULL）**であり、余った 1 状態が「不問」と見分けられなかった**（placeholder の有無だけ）**。⇒ UI の状態数を DB へ揃えた。★空欄＝NULL＝不問の 1 状態である。** **★★製造は上の 13 で書いた狙い**（意識的 / 面倒の区別）**を本変更が*達成しない*ことを明示的に指摘し、開発者が「諦める」と裁定した。⇒ 区別を残すには列が要るという結論は不変であり、将来やるなら別サブの射程である。** **★★★トグル・Space・門**（`requiredPublished.ts`）**はすべて削除した。placeholder「不問」は*空なら常に*出る。⇒ 分かりにくさの核は「トグル ON のときだけ出していた」ことであった。**
    15. **★★★追補2 は指示書が*明示的に禁じた*変更である。** 指示書 §2.4.1〔逐語「**★「4 欄」という数を動かさない**」〕／ §3-2 ／ §6-3 ／ チェックリスト §0-3 ／ B-1 の **5 箇所**が欄数 4 を要求している。**⇒ 開発者裁定が上書きした**（`CLAUDE.md` §9 ハード列＝ユーザー体験に影響する判断は開発者）**。★製造は着手前に衝突を指摘し、裁定を得てから実装した。⇒ 設計伝達レポート §2-0 に新規エントリとして明記し、`DES-006` §2.1 の CHANGE 原稿も 2 欄版へ差し替えた。★指示書とチェックリストの 5 箇所は「文書と実装が食い違ったまま」であり、版を上げるか失効として畳むかは設計卓の判断である。** **★一般形＝「指示書に反する」と「独自判断で反した」は別である。⇒ 後者だけが規律違反であり、前者は記録の問題である。**
    16. **★★追補2 で「上にあるものが必須」という手掛かりが成立しなくなった。** 先頭 4 欄のうち 3・4 番目（開始残量）が任意になったためである。**⇒ 指示書 §2.3-3 の*落とせない条件*「必須でないものを上へ混ぜない」を、開発者が「位置は維持する」と裁定して緩めた。★手掛かりは節の凡例「この節では、印の無い欄は任意です。」だけが担う。⇒ テストの主張もそこへ合わせた**（「印が先頭 4 つ連続」→「**先頭 2 つ連続**」）**。** **★一般形＝*配置で意味を伝える設計*は、必須度が動いた瞬間に黙って嘘になる。⇒ 配置に意味を持たせるなら、その意味を検査する床**（本件では印の連続を数えるテスト）**を同時に置くこと。**
    17. **★追補2 で画面項目を 2 つ整理した**（開発者の追加指示）**。**〔**運び量を「相手の大きさ」の直下へ移動** ／ **始動技の読み取り専用表示を削除**（逐語＝「レシピの方で見れるのでわざわざ基本情報タブで見る必要がない」）〕**。★★保存される値は 1 バイトも変わらない** —— 始動技の自動推定（`effectiveStarterMoveId`）は `ComboEditor` に残り、**重複判定キーの `starter_move_id` を作り続ける**。⇒ 消えたのは表示だけである。**★副産物として prop が 2 つ**（`moves` / `autoStarterMoveId`）**と `labelOfMove` が未使用になり削除できた**（テストの呼び出し 23 か所も機械的に追随）**。★失効させた理屈＝「運び量を状況の塊から*離して置く*ことでキーでないことを示す」**（`D-731` の不変条件 1）**。⇒ 理屈は今も正しいが、手掛かりとしては働いていなかった**（開発者が違和感を申告した）**。★キーでないことは 1 ビットも変わっていない**（正典は `SUPP-001` §3.2）**。**
    18. **★★追補2 で残る横断課題＝「同じ NULL が画面で 2 つの呼び名を持つ」。** 開始残量の NULL を、**エディタは「不問」と呼び**（placeholder）、**詳細・比較・一覧・テキスト書き出しは `"-"` と表示する**。**★formatter**（`utils.ts` の `formatDriveGauge` / `formatSAGauge`）**を消費ゲージと共用しており、そちらの NULL は「不問」ではなく未入力である。⇒ 変えると意味が混ざる。** 分けるには開始残量専用のフォーマッタが要り、**本サブの射程を超えるため触っていない**（設計伝達レポート §4-6b）。
    4. **★★相手の大きさにも未文書の「不問」がある。** `withUnspecifiedFirst` は **3 軸**に掛かっていた〔始動位置（**正規**＝`CHANGE-200` が NULL を「不問」と読む先例を確立）／ ヒット種別（本サブで外した）／ **相手の大きさ**〕**。⇒ 後者は `SUPP-001` §3.2 の値域 4 値に「不問」が無く、ヒット種別とまったく同じ形であり、`opponent_size` も重複判定キーの 1 つである。★2026-09-17 開発者裁定＝「報告のみ。触らない」**（逐語＝「ヒット種別は必ずいずれかの状態を持つが、他は不問でも成立する、むしろ不問がないと不便」）**。**
    5. **★`DES-005` §5.7 の失効が 2 件。**〔ボタン数「ヒット種別（8）」は着手前の実装が **9** で食い違っていた（本サブで実装が 8 になり一致した。★始動位置・相手の大きさの非対称は残る） ／ **射程 2 の並び替えで「表示項目（上から順）」の列挙が実態とずれた**〕**。⇒ CHANGE 原稿の対象に加えた。**
    6. **★`DES-006` §2.1 の `VAL-C13` 注記「`PATCH` の単純更新では非実行」が実装と食い違う**（`ValidateMetadataRanges` が PATCH で `validateC13DriveDamageRange` を呼んでいる）**。★本サブで作り込んだものではない。** 射程外だが実査で見つけたので申し送る。
    7. **★既存行の消費ゲージ NULL を `"0"` へ寄せる挙動の根拠が失効した。** `ComboEditor` は NULL の既存行を開くと消費 2 欄へ `"0"` を入れ、**開いて保存すると「消費 0」が書き込まれる**。その理由は「必須化した 2 欄を空のまま開くと保存が止まるため」であり、**必須から外れた本サブで根拠が消えた**。★挙動は変えていない（射程外）。**⇒ 残すか戻すかは開発者の判断である。**
    8. **★矢印キーの抑止とスピナー撤去は適用範囲が違う。** `NO_SPINNER` はコンボエディタの `type="number"` 全欄に配ってあるが、**矢印の抑止は `useFieldSequence` を張った面（基本情報タブ）の中だけ**である。⇒ レシピタブ・セットプレイ・プリセット等の数値欄は従来どおり矢印で増減する。**★「全欄で止めた」と誤読されないよう `numericInput.ts` の docstring へ明記した。**
    9. **★`SetplaySuggestionSection.tsx` の数値 4 欄だけスピナーが残っている**（`NO_SPINNER` が当たっていない唯一の箇所）**。★コンボエディタ外なので射程外**だが、`M24-12` の「同じ画面でスピナーの有無がまだらにならないように揃える」という判断の外側に居る。
    10. **★★「高」指摘の不採用は 0 件である。** レビューは **15 件**（高 4 / 中 7 / 低 4）を挙げ、**採用 15 / 不採用 0**。**⇒ Phase C の安全弁は発動していない。★再レビューの往復も 0 回であり、停止規律の記録が要る未解消項目は無い。**
    11. **★★高-2 は「失効記述の走査は自分の直した範囲で終わらない」の実例である。** 製造は「消費ゲージ」を全数走査して 3 件を是正した（`d9a4dc4`）が、レビューは**別の切り口**〔`grep -A6 "必須 4 欄\|必須欄"` で直後 6 行に消費ゲージが現れるもの〕**で 19 か所を検出した。⇒ 語で引くと、語を含まない箇所が落ちる。★「必須 4 欄」という*正しいままの語*の直後に、失効した*列挙*が続く形であった。**

### M33-02: 9 群の生成と同一性の検証（2026-09-19）

- **結果**: **比較 4 面すべて一致**〔正規化スキーマ `92e924e8…` ／ 全行 21 表 ／ `sqlite_sequence` `59448da1…` ／ 件数〕**。⇒ `M33-overview` §6.2 段 3 の条件を満たす。** 旧 115 本（230 ファイル・2.9 MB）を **9 群 18 ファイル・980 KB** へ置き換えた（`000001`〜`000009`・層 A 4 本 / 層 B 5 本）。**マイグレ消費 0・CHANGE 消費 0。** **★`go test ./...` は赤**（EXIT=1 / 2 パッケージ / 158 テスト＝歴史テスト 141・golden 17。**いずれも `M33-03` の射程であり、58 パッケージは緑**）**。★`make e2e` は全数緑**〔開発者指示で追加実行。**364 実行 / 362 passed / flaky 2 / failed 0 / EXIT=0**〕
- **報告**: 完了報告 `docs/progress/M33-02-completion-report.md` ／ レビュー `docs/progress/m33-02-review.md`
- **★横断課題**:
  1. **★★★`REUSE.toml` の連番グロブが `users` / `tags` を静かに `CC-BY-SA-4.0` へ落としていた。** 新系列の `000009_seed_initial_users_tags.*`（層 A であるべき）が `migrations/000009_*.sql` に当たり、**違反 0 件のまま層 B へ解決していた**（実測）。機序は 2 つの重なり〔REUSE 3.3 で連番グロブが命名規約を上書きする ／ `check-migration-license.sh` の旧凍結表も `000009` を層 B としており規則 (3) が黙る〕。**⇒ 2026-09-19 開発者裁定により、本サブで `REUSE.toml` 表 (4) の撤去と凍結表の差し替えを実施した。★層の割当は 1 つも変えていない。★禁止ライセンス列にも触れていない。**
  2. **★★機械検査の死角は是正後も残る。** 規則 (4) は `_data_` を持つ側で「どの表へ書くか」を見ない。**⇒ 凍結表に無い新しい連番なら、`users` へ書くファイルに `_data_` を付けても検査は緑である**（一時ファイルで実測）。**指示書 §4.2 の警告は今も有効。** 規則 (4) の拡張は `M33-03` の判断事項。
  3. **★★`SUPP-001` §5.5.4 規約 (18) の正規化スキーマ比較には死角が 9 種類ある**〔`AUTOINCREMENT` ／ `WITHOUT ROWID` ／ partial index の `WHERE` 述語 ／ `COLLATE` ／ 生成列 ／ トリガ ／ ビュー ／ 索引の照合順 ／ `CHECK` 節〕**。⇒ `setups.id` から `AUTOINCREMENT` を 1 語外した DB は比較 4 面すべてが緑で通る**（実測）**。★本サブは 9 種類とも旧新で突き合わせて一致を確認した。** 規約 (18) への注記は設計卓の手番。
  4. **★★本番ソースに失効した連番参照が 65 箇所**（非テストの `internal/` / `cmd/`・実測）**。⇒ `check-doc-refs.sh` はルール面 37 ファイルしか見ないため 1 件しか出ない。★最も危険なのは「死んだ参照」ではなく「別のファイルを指す*生きた*参照」であり、`migrations/000007` を users / tags の出所として挙げる 4 箇所**〔`internal/model/tag.go:32` ／ `internal/api/middleware/user.go:30` ／ `internal/service/user/service.go:61` / `:91`〕**は、新系列では `seed_presets` を指す。⇒ `M33-03` の最優先項目。**
  5. **★本サブの `REUSE.toml` 変更が設計書 3 か所を失効させた**〔`DES-001` §5.1 層 B の行 ／ `SUPP-001` §2.7 ライセンス項 2 ／ 同 §2.7 の「7 群前後へ潰す」〕**。⇒ as-built 化は設計卓の手番。★あわせて §2.7 の本数**（現行 111 本 / `000001`〜`000112`。**★「102 本」は `CHANGE-194` で既に失効した旧記述であり、そこを起点にしないこと**）**も 9 本へ。**
  6. **★採用は条件付きである**（`M33-overview` §6.2 段 3）**。⇒ 比較が全一致したので `M33-03` へ進める。不採用なら旧系列のままであり、上記 3 / 4 / 5 の是正もすべて不要になる。**
  7. **★「高」指摘の不採用は 0 件。** レビューは **13 件**（高 3 / 中 8 / 低 2）を挙げ、**採用 13 / 不採用 0**。**⇒ Phase C の安全弁は発動していない。★再レビューの往復も 0 回。**
### M38-03: 説明書へ画像 29 枚を貼り込み、macOS のアーカイブ名を `darwin` へ寄せ、`check-release-archive.sh` を `CLAUDE.md` §8 へ載せる（2026-09-19）

- **結果**: 3 射程とも着地。**A**＝`img` 29 件 ↔ 画像 29 枚が 1:1・`todo` 0 件・章 id を `ch01`〜`ch21` へ詰めた（`M38-02` が消した `ch14` の後を開発者の画像名に追随。参照は本編内部の 16 行のみ・外部 0）／ **B**＝`tacpendium-macos-arm64.tar.gz` → `tacpendium-darwin-arm64.tar.gz`（案 (a)・`D-893`。正本 `release-targets.sh` の 1 行 ＋ 自己検査の対照名を正本から引く形へ。`--self-test` EXIT=0・`make release-archives` EXIT=0・`check-release-archive.sh` EXIT=0）／ **C**＝`CLAUDE.md:260` に 1 行・`check-doc-refs.sh` EXIT=0。**テスト全数 green**〔`go test` EXIT=0・FAIL 0 ／ `pnpm test` 234 files・2974 tests ／ `make e2e` EXIT=0・363 passed・flaky 1（`m31-02` ドラッグ・retry 通過・`web/src` 無変更）〕。マイグレ 0・CHANGE 未採番（原稿は設計伝達レポート §1 / §6）。**開発者の追加指示 2 件**〔始動技＝食い違い無し（実査 9 行）／ 章番号の追従＝実施〕**＋ 計画時の未決 5 点はすべて実装前に裁定を得た**
- **報告**: 完了報告 `docs/progress/M38-03-completion-report.md` ／ レビュー `docs/progress/m38-03-review.md`（高 2 / 中 2 / 低 5・**「高」の不採用 0 件**・往復 0 回・取り込み `c0f13f53`）
- **★横断課題**:
  1. **★`M38-02` 完了報告 §10-2 の「章 `id` は詰め直していない（`ch13` の次が `ch15`）」は本サブで失効した。** 開発者裁定で `ch14`〜`ch21` へ詰めた（画像名が先に追随していたため。`#ch15`〜`#ch22` の外部参照は 0 と実査）。⇒ 以後の章の増減はこの連番を基準にする
  2. **★★「全 22 章」の写しは 4 面ではなく 5 面あった。** `README.md:11,218`（リポジトリの README）が `M38-02` の追随の外に残っており、レビュー 高-1 で発見・本サブで是正。`followup` の `usermanual-chapter-count-22-scattered` の数え上げ更新は設計卓の手番
  3. **★`M38-01` の必須化（ダメージ・有利フレーム）が説明書へ届いていなかった**（ch08 `:477` ／ QS `:88`「足りない項目があっても保存は止まりません」）。本サブで開発者裁定のもと 2 文を是正。**⇒ 画面の挙動を変えるサブは `docs/usermanual/` を走査対象に入れること**（`M32-03` §2.4 の「本文が画面の構造を主張している箇所」と同型）
  4. **★`dist-readme.txt` のアーカイブ名（`.sha256` の案内）は正本 `release-targets.sh` と機械で結ばれていない 2 か所目である**（今回の改名で手直しが要った）。対照を `check-dist-readme.sh` か `check-release-archive.sh --self-test` のどちらへ置くかは設計卓（レビュー 中-2）
  5. `manual/images/.gitkeep`（開発内部の撮影メモ）が配布アーカイブへ同梱される（`RELEASE_MANUAL_EXCLUDE` は `dist-readme.txt` のみ）。`M36-01` の面（レビュー 低-3）
  6. `DES-002` §11.2 は改名のほか「全 22 章」「27 枚の PNG」も旧値。旧アーカイブ名 `tacpendium-macos-arm64` は `parallel-board.md` ／ `followup-backlog.md` ／ `M36-01` 指示書・チェックリストにも残る（設計卓の面。CHANGE 採番時に拾う）
  7. `check-md-emphasis.sh` の常時走査は着手前から赤（798 行 ／ 床 247。主部は `parallel-board.md` 109 ほか設計卓の `.md`）。本サブ由来 0
### M33-03: ガードと資料の作り直し（歴史テスト 141 本の分類 ／ golden 17 stem ／ 失効参照 ／ 移行手順）（2026-09-19）

- **結果**: **`go test ./...` が EXIT=1 / `--- FAIL` 158 → EXIT=0 / FAIL 0**（ok 60 ＋ no test files 9 ＝ `go list` 69・検算一致）。**歴史テスト 141 本の分類＝(i) 消した 102 / (ii) 書き直した 34 / (iii) 諮った 5**（合計 141・検算済み。(iii) は `rules_m1905_test.go` の 5 本で、**勝手に消さず開発者裁定を得て述語の突き合わせへ書き直した**）。**golden 17 stem は byte 一致の再建が構造的に不可能**〔seedgen は 12 列の `INSERT…SELECT…CROSS JOIN`・新 `000004` は id 明示 22 列の `VALUES` ＋ 自己参照 514 行の 2 パス。★`is_derived` backfill 4 stem は対応先 SQL が列値として溶けており stem 対応が原理的に付かない〕**⇒ 比較先を `internal/seedgen/testdata/` へ移し、旧コミット済み SQL と本体が差分 0/34 で一致することを実測**（＝ドリフト 0）**。失効参照は真の全数 85 箇所**（`M33-02` の「65 箇所」式は stem 形を 20 件取りこぼす）**で、生きた誤参照 9 箇所を是正**（指示書の 4 箇所 ＋ 実査の追加 5 箇所。**うち 2 件はフロント**）**。ガードは規則 (4) の空回りを解消**〔凍結表を残したまま凍結分にも (4) を評価〕**＋ `has_data` 側へ書き込み先検査 ＋ 規則 (5) 新設。破壊確認 3 件はいずれも「塞ぐ前は EXIT=0」を実測し赤くした規則を名指し。自己検査 11 → 15 対照。** テスト全数 green〔`pnpm test` 234 files / 2974 tests ／ `make e2e` EXIT=0・364 passed・flaky 0〕。**マイグレ消費 0 本**（`ls migrations/*.up.sql` は 9 本のまま）・CHANGE 未採番（原稿は設計伝達レポート §1 / §6）
- **報告**: 完了報告 `docs/progress/M33-03-completion-report.md` ／ レビュー `docs/progress/m33-03-review.md`
- **★横断課題**:
  1. **★★★`D-187` の不変条件が HEAD では 132 行違反している**（`startup IS NULL` なら `startup_basis` は `unknown`。実測）**。⇒ 旧 `TestRun_M19P2_ManualBackfill` は v64 でしか見ていなかったため誰も気づいていない。★不変条件として成立しないので HEAD スコープへ引き上げなかった。** **★★【2026-09-19 追記・内訳を実測】126 が `category='system'` の移動 move**〔**14 キャラ × 9。★14 キャラは第四波そのもの**＝旧 `000084` の見出し逐語「第四波 14 キャラ（未 seed 12 + 仮登録 2）」〕**／ `target_combo` 4 ／ `special` 2。原因は旧 `000065` の是正が第三波までの母集団にしか当たらず、第四波の backfill**（旧 `000089`）**が CSV の `standalone` を入れ直したことである。★CSV とマイグレ SQL の揺らぎではない**〔**CSV 2743 行 ↔ DB の `startup_basis` 突合は不一致 0 件** ／ **移動 system move は 31 個の CSV すべてに 1 行も無い** ／ **CSV 側の違反は 6 行だけ**〕**。★同ファイルの `drive_reversal` は 31 キャラすべてが `unknown` であり、SQL 自身の慣習が `unknown` であることを示す。★実害は出ていない**〔`usesFirstHitStartup` の述語 110 行のうち `first_hit_startup` 未記入の 4 行が上の `target_combo` 4 行と完全一致し、`candidateStartup` が `nil` を返して候補から落とす＝fail-closed〕**。⇒ 開発者裁定 2026-09-19 の逐語＝「発生フレームを持たない技はunknownへ修正」。`D-187` は撤回せず、132 行すべてが是正対象。是正は `000010` の別サブである**（**本サブはマイグレ消費 0 本が射程条件であり、CSV だけ先に直すと `TestCSVAndDBAgreeOnFrameCostColumns` が赤くなる**）
  2. **★★`internal/seedgen/testdata/**` は段 3 が作った *新しいライセンスの穴* だった。** 層 B の素材（SF6 の事実）が `REUSE.toml` の既定 `path = "**"` へ落ちて **`AGPL-3.0-or-later` へ解決し、`ALLOW internal/**` で公開され、どの検査も緑だった**（`check-migration-license.sh` は `migrations/` だけ・`check-public-snapshot.sh` は ALLOW/DENY の網羅だけを見る）**。⇒ `D-777` の一般形そのもの。開発者裁定で層 B へ 1 行足し、ガードへ規則 (5) を新設して経路を塞いだ。★`DES-001` §5.1 / `SUPP-001` §2.7 への as-built 化は設計卓の手番**
  3. **★★`SUPP-001` §5.5 規約 (19) は「対象ファイルが消えた」場面を覆っていない。** 同規約の 3 点セットは「CSV の 1 値が間違っていた」場面の手順であり、手順 3（データ修正マイグレを置く）に相当するものが無い。⇒ 規約の追補は設計卓の面
  4. **★★`rules_m1905_test.go` 5 本は `setplay` サービスのロジックテストであり、`internal/infra/migration` に住む理由がもう無い**（マイグレの版を固定するためにそこに居た）**。⇒ 同ファイルのヘッダ自身の規約に従うなら setplay サービスの隣が筋。移設は差分が大きく本サブの射程外**
  5. **★旧テストの主張が「17 キャラ時点でしか成り立っていなかった」例が 2 件出た。** (a) `TestM1905_TargetGateSwitch` の「除外 23 行の理由は `fastest_unreachable` ただ 1 つ」は HEAD では単独入力不可だけで落ちる行が 12 行ある ／ (b) `TestRun_M1403c_UpContract` の「CSV + 移動 9」は system move が 11 種（移動 9 ＋ `drive_parry` ＋ `drive_reversal`）になって失効。**⇒ 件数を写した契約テストは、母数が動くと*主張ごと*古くなる**
  6. **★「偶然そのまま正しい」箇所は指示書の 2 箇所ではなく 3 箇所だった**（`internal/repository/tag/repository.go:196` ／ `internal/seedgen/model.go:63` ／ **実査の追加＝`web/e2e/m22-03-optimistic-locking.spec.ts:74`**）**。⇒ 次に連番の起点が動いたら 3 箇所とも壊れる。** あわせて `scripts/generate-code-facts.sh:745` の `'^\| 000001 '` も同型で偶然通る
  7. **★`M33-overview` §5 と指示書 v1.0.0 §2.2 が食い違っていた**（前者は「歴史テスト 28 ファイルを*旧系列側へ移す*」・後者は「分類して消す／書き直す」。`M33-02` は `migrations/legacy/` を作っていない）**。⇒ より新しく具体的な指示書 §2.2 に従った。** 畳むのは設計卓の面
  8. **★★完了条件 §6-7（移行手順が乾式で通る）は未充足である。⇒ 開発者裁定（2026-09-19・逐語「乾式なし・プロンプトだけ」）。** 成果物は `scripts/migrate-userdata-prompt.md` 1 枚で、外せない 4 点〔投入順 ／ `combos` 自己 FK の 2 パス ／ `sqlite_sequence` の明示補正 ／ `foreign_key_check` 0 件〕は新 baseline の実測に基づく。**★技術的には乾式は可能だった**（旧 111 本は `git show b5cd716^` から取れる）**。⇒ できなかったのではなく判断で行わなかった**
  9. **★`tmp/` に `.go` ファイルを置くと `go build ./...` / `go vet ./...` が拾って壊れる**（本サブで実際に踏んだ）**。⇒ 移行プロンプトへ注記した。** 作業用の Go ファイルはリポジトリ外のスクラッチへ置くこと
  10. **★★レビュー 17 件（高 5 / 中 7 / 低 5）は全件採用・不採用 0 件。「高」の不採用は 0 件であり安全弁は発動していない。往復 0 回。** ⇒ 採否の正本は完了報告 §14。**★高-3 の是正として `head_seed_invariants_test.go` を新設し、消した (i) 102 本に含まれていた HEAD で表現できる主張 7 本を復元した**（うち `D-317` の交差検査は repo 全体でガードが 0 件になっていた）。**★高-1 は `SUPP-001` §5.5.2 規約 (2) との食い違いであり、49 本の移設 or 規約改訂の判断を設計卓へ回す**（横断課題 11）
  11. **★★`SUPP-001` §5.5.2 規約 (2) が新系列の世界を想定していない。** 区間が 1 つしか無いため `internal/infra/migration` の*すべて*のテストが HEAD スコープになったが、規約 (2) は「HEAD スコープはサブ名へ相乗りさせない」と定める。⇒ **49 本・22 ファイルを `migrate_head_test.go` へ移すか、規約 (2) を改めるか**の判断が要る（設計卓の面）**。★★【2026-09-19 追記・母数を実測】抵触は 39 本ではなく 49 本である**〔全 77 本＝`TestRun_HEAD_*` **11** ／ `TestRun_M*` **44** ／ `TestM1905_*` **5** ／ その他 17。**39 は書き直した分だけを数えた過小値であり、書き直していない既存のサブ名テストも区間が 1 本になった時点で同じく HEAD スコープである**〕
  12. **★製造の自作の失効参照が 1 件出た。** 段 1 で整えたコメント（`repository/preset/queries.go` / `service/preset/service.go`）が、**段 2 で自分が削除したテストを指していた**。⇒ **段を別の手番として扱うと、前の段の成果物が次の段で失効しうる。** 段をまたぐ参照は最後にもう一度走査すること
  13. **★開発者裁定 7 件がボードに採番されていない**（レビューが「真偽を判定できない」と記録。**★2026-09-19 に `D-187` の処遇の裁定が 1 件増えて 7 件**）。⇒ 採番は設計卓の手番。**とくに「乾式を行わない」は完了条件 §6-7 を ✗ にしている根拠であり、採番が無いとチェックリスト E-2 の不合格に見える**

### M39-01: `startup_basis` の不変条件の是正（新系列への折り込み）（2026-09-19）

- **結果**: **`go test ./...` EXIT=0 / FAIL 0 件・`pnpm test` 2974 件緑・`make e2e` 364 passed / EXIT=0**。**★マイグレ消費 0 本**（案 A＝`D-910` の `D-336` カーブアウト。`migrations/*.up.sql` は 9 本のまま・`000010` は未使用のまま予約）。**`D-187` の違反 132 行を `migrations/000004_data_seed_moves.up.sql` の値として是正し、`character_data/` 6 行を同じコミットに載せた**（`1e7900b`）。**★動いたのは `startup_basis` 列のちょうど 132 セルだけであることを機械で立証**〔構造差 0 件 ／ タプル以外の 561 行は完全一致 ／ 値の遷移は `'standalone'→'unknown'` の 1 種類〕**。★同一性の再検証は `M33-02` と同じ 4 面で再走させ、差分は `moves.startup_basis` の 132 セルちょうど**（正規化スキーマ `92e924e8…` と `sqlite_sequence` `59448da1…` は記録値のまま不変）**。★ガードを `TestRun_HEAD_StartupBasisUnknownWhenStartupNull` として常設化し、破壊確認を対で置いた。**
- **報告**: 完了報告 `docs/progress/M39-01-completion-report.md` ／ レビュー `docs/progress/m39-01-review.md`
- **★横断課題**:
  1. **★★★ラッシュ生成経路が実行時に `D-187` を破れる**（製造が段 1 の*書く経路*の全数で発見し、レビューが独立に追認）**。`internal/repository/move/rush.go:31` が `startup_basis` を `'through'` のリテラルで INSERT しつつ `startup` を元技からコピーし、`internal/service/move/service.go:113` の `rushEligible` は `category ∈ {normal,unique} ∧ !is_aerial` しか見ず `startup NOT NULL` を要求しない。⇒ 該当元技は HEAD に 3 件実在**〔`rashid/run`(1364) ／ `alex/prowler_stance`(2145) ／ `dee_jay/speedy_maracas`(2555)〕**。★★本サブのガードは*新規 DB* に対して走るため、この経路で壊れた利用者 DB は緑のまま素通りする。⇒ followup `d187-startup-basis-invariant-violated-at-head` を「ガードが上がったから」だけで閉じないこと。★是正は `M19-04` §4.5 の設計判断を覆すため裁定が要る**（`PATCH /api/moves/:id` からは破れないことも確認済み＝`UpdateMoveFields.Startup` は `*int` で NULL へ戻す経路が無い）
  2. **★★案 A の帰結＝マイグレに件数ハードガードを置けない。** ラッシュ版を 1 つ生成した利用者 DB では違反が 133 になり、起動時の `migration.Run` が中断してアプリが起動しなくなる。⇒ 件数はヘッダコメントと常設テストで担保した（現行系列に `RAISE(ABORT)` の前例が無いことも実測）
  3. **★★`SUPP-001` の 2 箇所が本サブで失効した。⇒ 設計卓の面。** (a) §5.5 規約 (20) の付記「『適用済みマイグレは書き換えない』は引き続き生きている」 ／ (b) §2.7 のライセンス表 2 の「適用済みマイグレは書き換えないので、この列挙は以後変わらない」。**★`D-910` は「公開前かつ適用済み DB が開発者の検証環境 1 つだけ」という窓に限ったカーブアウトであり、窓は公開で閉じる。⇒ その条件つきで as-built 化が要る**
  4. **★★`M33-02` の「旧 111/115 本と新 9 本が全一致する」という到達点を、本サブで*意図的に手放した*。⇒ 以後は「`startup_basis` の 132 セルを除いて一致」である。** ★ただし `docs/design/` に「全一致」と書いた記述は無い（実測。3 件は §2.2 の「**完全**一致」で無関係）。⇒ 失効したのは `M33-02` 完了報告の到達点であり、設計書の記述ではない
  5. **★`M39-overview.md` の版が指示書 v1.1.0 のヘッダの宣言（v1.1.0）と合っていない**（リポジトリは v1.0.0 のまま）。⇒ 設計卓の面
  6. **★`docs/handover/docs-map.md` に `M39` の資料が 1 件も載っていない**（実測 0 件）。`check-derived-docs.sh` は docs-map / retrospective-digest を ⚠ 陳腐化疑いとして出している。⇒ 再生成は本サブの手番ではないが、載っていない事実を記録として残す
  7. **★★カナリアの環境変数の取り違えで「緑のまま黙って skip」を踏みかけた。** `TestCanary_SetplayProjection` は `CANARY_OUT` ではなく **`CANARY_SETPLAY_OUT`** である。終了コードだけを見ていたら before を取れていないことに気づけなかった。**⇒ 出力ファイルの実在を確かめて気づいた。「緑である」は「走った」の証明ではない**
  8. **★`pnpm test --run` は pnpm に直接渡すと `Unknown option: 'run'` で EXIT=1 になる。⇒ `pnpm test -- --run` が正しい**（テストが落ちたのではない）
  9. **★★レビュー 9 件（高 3 / 中 4 / 低 2）は全件採用・不採用 0 件。「高」の不採用は 0 件であり安全弁は発動していない。往復 0 回。** ⇒ 採否の正本は完了報告 §12。**★高-1 は `D-890` そのものを踏んだもの**〔完了報告を入力に取る検査を、報告を書く*前*に回した値で「緑」と書いた〕**。⇒ 製造 CLI の当該節が警告している型を、その節を読んだうえで踏んだ**

### M36-02: リリースの門と来歴（attestation / SBOM / タグ署名 / CI からのリリース）（2026-09-19）

- **結果**: **`go test -count=1 ./...` EXIT=0 / FAIL 0 件 / ok 60 件 /（cached）0 件・`pnpm test` 2974 件緑・`make e2e` 364 passed / failed 0 / flaky 0**。**★マイグレ消費 0 本 ／ CHANGE 自採番なし**（`D-293`。原稿は設計伝達レポート §1・§6）。**★`go.mod` / `web/package.json` は 1 行も変わっていない**（増えたのは CI のアクション参照のみ）。射程 8 件のうち **1〜7 を実装、8 は `M38-03` で既に閉じていたため実測で示した**。門 `scripts/check-manual-images.sh`（新規・自己検査 陰性 3 / 陽性 6）／ 射程 7 を `check-dist-readme.sh` へ ／ リリース本文 `scripts/generate-release-notes.sh`（新規）／ `.github/workflows/release.yml`（新規・`actions/attest@v4` ＋ `anchore/sbom-action@v0`）／ `.github/allowed_signers`（**空の器。鍵は作っていない**）。**★破壊確認 3 本を実出力で示した**〔図を 1 枚どけると門が赤 ／ アーカイブ名を 1 つ変えると赤 ／ 組み上がったアーカイブ内から図を 1 枚どけると赤〕**。★`nightly` / `pr-checks` / `release-targets.sh` は差分 0 行**（`CHANGE-129` の境界）。
- **報告**: 完了報告 `docs/progress/M36-02-completion-report.md` ／ レビュー `docs/progress/m36-02-review.md`
- **★横断課題**:
  1. **★★★attestation / タグ署名 / 公開の「検証が通った出力」は、製造の手番では原理的に作れない。⇒ 開発者の手番である。** `gh` CLI 不在 ／ `git tag` は `deny` ／ **attestation は Sigstore が*実行中の* Actions へ短命証明書を発行して初めて生まれる**。⇒ 完了報告 §7 に「鍵を用意する側の手順」を書き、§8 原稿 1 に必須 5 フィールドで記録した。**★`M36` は実走が返るまで閉じない。**
  2. **★★★指示書 v1.1.0 の射程 8 は、着手時点で既に解決済みであった。** `images/.gitkeep` は `3bc5c71`（`M38-03`・開発者指示）で `SCREENSHOT-RULES.md` へ改名され、`RELEASE_MANUAL_EXCLUDE` は既にそれを除外している。**⇒ 存在しないファイル名を足すと死んだ設定になるため足さず、配布 3 本での不在を実測で示した**（レビュアーも独立に追認）。**★この判断は開発者が覆せる。⇒ あわせて followup `release-manual-gitkeep-bundled` の状態欄を「`M38-03` で先に閉じた」へ更新する必要がある（設計卓の面）。**
  3. **★★★`DES-002` §11.3 は「CI は 2 本立てとする」と明記しており、`release.yml` の新設で 3 本目になった。⇒ CHANGE 原稿が必須**（§11.2 側にも来歴の as-built が要る）。**⇒ 設計伝達レポート §1 / §6 へ。★自採番しない。**
  4. **★★「一次情報」の格付けを 1 件誤り、レビューが検出した（高-1）。** タグ署名検証の出典に*第三者の個人リポジトリの PR* を引き、その説明文を逐語として載せていた。**⇒ `git/git` の `Documentation/config/gpg.adoc` へ差し替え、「タグを持たない checkout は検証対象 0 件で緑になる」は公式の記述でないため格付けを「自前の推論」と明記した。★同じ記述が `release.yml` のヘッダにも入っており、コードに残ると後任が裏を取らない。** **★★教訓＝`docs.github.com` と `git-scm.com` がともに egress proxy で遮断されていたが、遮断は理由にならない。⇒ `git/git` の `Documentation/` は到達でき、そこに答えが在った。「一次情報へ到達できないとき、二次情報を一次情報として書く」のが最も危ない。**
  5. **★★「対照を書いたのに誰も回さない検査」を 1 本作りかけ、レビューが検出した（高-2）。** `check-artifact-integrity.sh` の走査は `scripts/check-*.sh` ＋ 明示 3 本であり、**`generate-release-notes.sh` は名前が `check-*` でないため対象外だった**（実測で検査 18 件に不在）。にもかかわらず同ファイルは「このマーカーは `check-artifact-integrity.sh` が拾う」と**事実に反する記述**を持ち、`CLAUDE.md` §8 の表にも載っていた。**⇒ 明示リストへ足して 19 件になった。★`check-*` 以外の命名で `--self-test` を持たせるときは、同時に明示リストへ足すこと。**
  6. **★`RELEASE_TARGETS` の 2 列目（実行ファイル名）と、射程 7 の逆方向の照合は、まだ機械で結ばれていない。** 前者は `dist-readme.txt` の 20〜22 行目・148 行目に写しが在る。後者は「旧名が残ったまま新名も在る」状態を緑にする。**⇒ どちらも指示書の射程外のため広げず、完了報告 §8 原稿 2 / 原稿 4 として停止時記録へ回した（設計卓の起票待ち）。**
  7. **★★レビュー 15 件（高 4 / 中 5 / 低 6）。「高」の不採用は 0 件であり安全弁は発動していない。往復 0 回。不採用 3 件はすべて「中」「低」で、射程外・宛先違いを理由に申し送った。** ⇒ 採否の正本は完了報告 §10.1。**★最も価値が高かったのは中-4**〔門は源泉だけを見てアーカイブの中を見ていない〕**——源泉を見る門と「`images/` がディレクトリとして在るか」しか見ない検査の 2 つを、「源泉には図が在るがアーカイブには入っていない」状態が両方すり抜ける。`D-890` の問いそのものであり、展開して同じ門を向ける段を足した。**
  8. **★停止規律の記録先は設計伝達レポート §4（原稿 5 件）。⇒ `followup-backlog.md` は 1 文字も編集していない**（`D-838`）。
  9. **★★★【2026-09-20 追補】attestation は public リポジトリでしか取れない**（GHEC を除く）**。⇒ 本リポジトリ `combomgr` は非公開の開発リポであり、実走できない。★完了報告 §7 の初版は「`combomgr` に rc タグを打つ」と書いており、これは製造の事実誤りであった**（§0.3 に訂正の経緯を残した）**。⇒ 実走先は公開リポ `tacpendium` であり、フェーズ5 冒頭の公開手順へ項目として組み込むこと**（`private-vuln-reporting-not-enabled` と同じバケツ。設計伝達レポート §4-6 が原稿）**。**
  10. **★★【2026-09-20 追補】`release.yml` を public リポジトリ限定にした**（`if: github.event.repository.private == false`・`92ae417`）**。⇒ `make-public-snapshot.sh` の設計**（`D-637`＝公開リポ = f(開発リポの tag, 許可リスト)）**では開発リポへタグを打つことがスナップショット生成の正規の契機であり、しかも `public-snapshot-manifest.txt` の `ALLOW .github/**` により `release.yml` は両リポに存在する。⇒ ガードが無いと生成のたびに開発リポ側が赤くなる。★赤が常態化すると本物の赤に気づけなくなる。** **★`!= true` ではなく `== false`（fail-closed）。★副次効果として「意図しない版が公開される」が構造的に起きなくなった**（開発者の懸念・2026-09-20）**。**
  11. **★【2026-09-20】射程 8 は「足さない」で開発者が追認した。⇒ `followup` の `release-manual-gitkeep-bundled` の状態欄を「`M38-03` で先に閉じた」へ更新すること（設計卓の面）。**
### M39-02: ラッシュ版の生成経路が実行時に `D-187` を破る穴を塞ぐ（2026-09-19）

- **結果**: **`go test ./...` EXIT=0 / FAIL 0 件・60 pkg ／ `pnpm test -- --run` 2974 件緑 ／ `make e2e` EXIT=0・362 passed・2 flaky**（タグ欄ドラッグ。射程と交点なし）。**★マイグレ消費 0 本**（`migrations/` の差分 **0 行**・`*.up.sql` は 9 本のまま・次番は `000010` で不変）。**★CHANGE 自採番 0 本**（原稿 1 本は設計伝達レポート §1 / §6 へ）。**是正は案 (a)**〔元技の `startup` が NULL なら `startup_basis` に `'unknown'`〕**を Go 側**（`rushStartupBasis`）**で実装し、`rushEligible` は 1 行も触っていない**。**★是正*前*に壊れることを実 API（`POST /api/moves/1364/rush-variant`）で再現し、違反が 0 → 1 になることを出力で示した。★その状態で `M39-01` のガードが `EXIT=0` の緑のまま素通りすることも示した**（本サブの存在理由そのもの）。**★実行時の経路のガードと破壊確認を `rush_runtime_invariant_test.go` へ対で新設し、対照**（`startup` を持つ元技では `'through'` のまま）**は既存 `rush_test.go` の述語へ `startup IS NOT NULL` を足して明示化した。**
- **報告**: 完了報告 `docs/progress/M39-02-completion-report.md` ／ レビュー `docs/progress/m39-02-review.md` ／ 設計伝達レポート `docs/handover/design-reports/20260919-m39-02-design-exceptions.md`
- **★横断課題**:
  1. **★★★`docs/design/03-data-model.md` §3.3 の「rush 生成経路（`insertRushVariantSQL`）は `'through'` を明示して INSERT する」が失効した。** ⇒ 「ラッシュ版の `startup_basis` は元技の `startup` の有無で決まる」を足す CHANGE 原稿を設計伝達レポート §1 / §6 へ置いた。**★設計書本体は 1 文字も編集していない**（`CLAUDE.md` §8）。**★三値の述語そのものと機械付与 (ii) には触れない**
  2. **★★followup の対の 2 行**〔`d187-startup-basis-invariant-violated-at-head` ／ `rush-variant-can-violate-d187-at-runtime`〕**を*対で*閉じられる状態になった**（指示書 §8-2）。**⇒ `followup-backlog.md` は 1 文字も編集していない**（`D-838`）**。閉じるのは設計卓の手番である**
  3. **★不変条件の検出式を 2 か所に持つことになった。** 正本は `internal/infra/migration/head_seed_invariants_test.go:236-245` の `startupBasisInvariantSQL` だが、**同定数は package `migration_test` に属し外部パッケージから import できない**。⇒ `internal/repository/move/rush_runtime_invariant_test.go` で同じ式を書き直し、相互参照コメントを双方向に置いた。**★式を変えるときは両方を変える必要がある**（共有できないことを承知のうえでの次善手）
  4. **★`.claude/commands/precheck_seed_data.md:111` の「`category='rush_variant'` → `startup_basis='through'` か」は据え置いた。** 同記述は CSV/seed の precheck であり実行時の経路ではない。**⇒ seed 由来の rush 行 514 件は全件 `startup` が非 NULL である**（実測）ため、seed に対しては引き続き `'through'` が正しい
  5. **★`docs/handover/docs-map.md` に `M39` の資料が載っていない状態が続いている**（`M39-01` §4-4 の申し送りのまま。本サブでも再生成していない）。⇒ `docs/` をまとめて触る手番の面
  6. **★使い捨て DB が `tmp/m39-02/` に 2 つ残っている**（`.gitignore` 済みでコミットには入っていない）。**製造は削除していない**——`CLAUDE.md` §10 が `*.db` の直接削除を機械強制で禁じているため。**⇒ 消すのは開発者の手番**（害は無い）
  7. **★★★「ラッシュ版はない」と入力担当が書いている技にも生成ボタンが出る**（レビュー 中-4 が実データから発見）**。`migrations/000004` の `dee_jay/speedy_maracas` の `notes_tool` に逐語「空中技ではないが、ラッシュ版はない。」が在る。⇒ 本サブの不具合ではない**〔不変条件の観点では `'unknown'` が正しい〕**が、案 (b)**〔`rushEligible` で `startup IS NULL` を弾く〕**の判断材料が実データに在った。★`rushEligible` は `roles-and-routing` のハード列**（UX）**であり製造の自己判断の対象外のため 1 行も触っていない。⇒ 設計伝達レポート §4-1 へ原稿として上げ、判断を開発者へ返す。★ただし「`startup` が NULL か」と「実機にラッシュ版が在るか」は別の述語である**——`notes_tool` が明言しているのは 3 件中 1 件だけであり、残り 2 件の根拠は無い
  8. **★★レビュー 7 件（高 1 / 中 3 / 低 3）は全件採用・不採用 0 件。「高」の不採用は 0 件であり安全弁は発動していない。往復 0 回。** ⇒ 採否の正本は完了報告 §10.1。**★高-1 は製造の自作の失効記述であった**〔完了報告に「相互参照コメントを双方向に置いた」と書いたが、**取り込み前は複製側にしかなく、欠けていたのは*正本側*であった**〕**。⇒ 正本側へ相互参照を足して記述を事実にした。★テスト・lint・型検査では永久に検出されない型である**
  7b. **★★★【2026-09-20 裁定・製造の訂正】上の 7 は前提が誤っていた。⇒ 「利用者が UI から作れる」は事実ではない。** **★画面18**〔moves 編集グリッド〕**の導線は 2026-09-17 に除去済みである**（`CHANGE-214` ／ `M38-02` ／ `D-892`。`web/src/components/Header.tsx:39` が明記し、**フロント全体で `/moves/edit` への導線は 0 件**＝URL 直打ちでしか到達できない）**。★`FR703` は「公式データに不備があった場合、*少なくとも開発者が*手動で修正できる」であり開発者向けの面である。★ラッシュ版の著者責任は `FR704` により外部の手入力支援ツール**（`FR701` / `moves-input-tool`）**に在る**〔実測＝`character_data/*.csv` が rush 行を直接著者しており `rush_*` の出現は **1034 箇所**・seed の rush 行は **514**。`seedgen` は rush 行を導出していない〕**。⇒ 開発者裁定は「生成ボタンが出ても問題はない ／ 手動削除対応で今後も問題ない ／ ここでの修正対象ではない」であり、案 (b) は不採用・`rushEligible` は現状維持・followup への新規登録もしない。★レビュー 中-4 が指摘した*事実***（`notes_tool` の逐語）**は正しく、誤っていたのは製造が付けた*帰結*である。★★次の担当は 7 ではなく本項を前提にすること。**
  7c. **★生成機構は二重ではない**（開発者の問いへの回答）**。`InsertRushVariant` の呼び出し経路はリポジトリ全体で 1 本だけである**〔`MoveEditGrid.tsx` → `useGenerateRushVariant` → `POST /api/moves/:id/rush-variant` → `Service.GenerateRushVariant` → `repository.InsertRushVariant`〕**。★仮想コントローラのラッシュ版トグルは行を作らず `rush_<code>` を引くだけである。⇒ 外部ツール**（公式データの著者）**と画面18**（`FR703` の開発者向け手動修正）**で役割が分かれている。★補助実測＝ラッシュ版を省いた eligible 技は seed 上 31 件**〔母数 545・rush 行を持つ 514〕**だが、`notes_tool` に「ラッシュ版はない」の明言が在るのは 1 件だけである。★`dee_jay/rush_speedy_maracas` は seed・CSV とも 0 件。**
  7d. **★★★【2026-09-20】開発者が検証 DB で移行ランブックの `M39-02` 節を実行し、違反行は 0 件であった**〔バックアップ作成済み ／ `foreign_key_check` 0 件 ／ 整合性検査 OK ／ 全テーブルのデータ変更なし〕**。⇒ 実環境に本経路由来の違反行は 1 行も無く、`UPDATE` は不要であった。★★これにより設計伝達レポート §4-2 が「残る前提」として挙げていた唯一の未確定事項が消えた。⇒ followup の対 2 行**〔`d187-startup-basis-invariant-violated-at-head` ／ `rush-variant-can-violate-d187-at-runtime`〕**は*無条件で*閉じられる**（**閉じるのは設計卓の手番**）**。★手順そのものは残す**——**0 件であったことは手順が不要だったという意味ではない。数えたからこそ 0 と言える。**
  9. **★不変条件の述語を「共有できない」と書いたのは誤りであった**（レビュー 中-2）**。⇒ 両パッケージとも `internal/testutil/dbtest` を import 済みで循環もせず、共有する道は在った。採らなかったのは同 helper が「DB を用意する道具」であり述語の置き場ではないと判断したためである。⇒ 「共有しないことを*選んだ*」へ言い換えた。★設計卓が「述語は共有すべき」と判断するなら小サブになる**

### M40-02: 5 ファイルの独立実装への書き換え（**★本体は「書き換えるかどうかの判定」**）（2026-09-20）

- **結果**: **`go test ./...` EXIT=0 / FAIL 0 件・60 pkg ／ `pnpm test -- --run` EXIT=0・234 files / 2974 tests（着手前と完全一致）／ `make e2e` EXIT=0・spec 81 本・計 364**（着手前 `363 passed + 1 flaky`／着手後 `364 passed + 0 flaky`。**★`make e2e` は実装コミットの後とレビュー取り込みの後の 2 回実走し、どちらも 364**。flaky はタグ欄ドラッグで射程と交点なし）。**★マイグレ消費 0 本**（`migrations/` 差分 0 行・次番 `000010` で不変）。**★CHANGE 自採番 0 本**（原稿 1 本は設計伝達レポート §1 / §6）。**★★★判定＝(i) 2 件 / (ii) 0 件 / (iii) 3 件**——**書き換えたのは `useSessionStorage.ts`**〔`CLAUDE.md` §10.X の「専用ヘルパ経由」から外れていた＝台帳 §1 脚注「#7 の非整合」の解消。あわせて保存を `setState` の updater の外へ出し React の純粋性違反も解消〕**と `useRecentCombos.test.ts`**〔`toContain("limit=3")` が `limit=30` を通す穴を `URLSearchParams` の厳密一致で塞いだ。`it` 3 本のまま `expect` 7 → 14〕**の 2 件だけである。★`useIsMobile.ts` / `useUpdateSetup.ts` / `useDeleteSetup.test.ts` の 3 件は開発者裁定で据え置き**（収束の説明は完了報告 §5.1）。**★一致先コードは 1 行も開いていない**（外部取得 0 回＝追補報告 §7.2-1）。**★`useSessionStorage.test.ts` は差分 0 行のまま 6 本が緑**＝実装だけを先に直した証拠。
- **報告**: 完了報告 `docs/progress/M40-02-completion-report.md` ／ レビュー `docs/progress/m40-02-review.md` ／ 設計伝達レポート `docs/handover/design-reports/20260920-m40-02-design-exceptions.md`
- **★横断課題**:
  1. **★★★追補報告 §7.2 段 5 の完了条件が成り立たなくなった。** 同段は「**上記 5 ファイルの問題となった一致が消えたことを確認する**」としているが、**本サブは 5 件中 2 件しか書き換えていない**（開発者裁定）。**⇒ 再スキャンの差分判定の基準を設計卓が更新する必要がある**（案＝(i) 2 件は消えたことを確認 ／ (iii) 3 件は残存 match として収束の説明を disposition に記録）。設計伝達レポート §4-1。**★これが本サブで最も重い申し送りである**
  2. **★★「followup 扱い」と 5 箇所が宣言していたのに、`followup-backlog.md` に ID 付きの行が 1 つも無かった**〔`web/CLAUDE.md` §1 脚注 ／ `change-report-085.md` L58・L109 ／ `transport-audit-20260725.md` L393 ／ `20260804-resource-exhaustion-audit.md` L-7〕**。⇒ 「followup 扱い」と*書くこと*が起票の代わりになっていた型である。本件そのものは是正したが、同じ型が他にも在る可能性が高い**（`grep -rn "followup 扱い"` の棚卸しを提案）。設計伝達レポート §4-2
  3. **★`docs/change-notes/change-report-085.md:58` が失効した**（レビュー 高-3）。逐語「是正は followup 扱い」が事実でなくなった。**⇒ CHANGE 本体は歴史記録のため製造は編集していない**（`CLAUDE.md` §8 ／ `D-274` (3)）。設計伝達レポート §4-6
  4. **★★浅いクローンでは初出コミットを引けない。** `.git/shallow` に境界 20 件があり、**`git log --diff-filter=A` は 5 件とも graft 境界 `b873d59`（2026-09-11）を「追加」として返す**が、**実際の初出は 2026-05 のフェーズ1 である**（`git cat-file -t` で真の初出 SHA 5 件とも「存在しない」を実測）。**⇒ 監査証跡は初回 SCANOSS の `scan-review-chronology-initial.csv` の `FirstCommit` 列で代替した。★CSV を持たない対象では代替が無い**。設計伝達レポート §4-5
  5. **★setup hooks のテスト 4 本**〔`useCreateSetup` / `useDeleteSetup` / `useSetup` / `useUpdateSetup`〕**が import 順に違反している**（レビュー 中-1）。**⇒ 1 本だけ直すと (iii) の根拠にした統一様式が崩れ、4 本直すと射程を 3 ファイル超過する。★`check-import-order.sh` はベースライン固定型で「既存分を機械的に並べ替えない。書いた本人が触るときに直していく」と明記しており、在庫として許容されている状態である**。設計伝達レポート §4-7
  6. **★射程（5 ファイル）を 3 ファイル超過した**〔`scripts/check-browser-storage-keys.sh` の `DIRECT_ALLOW` ／ `scripts/check-import-order.sh` の `BASELINE` と実測コメント ／ `web/CLAUDE.md` §1 脚注〕**。⇒ 3 件とも「本サブの変更によって記述が偽になったもの」の是正であり、レビューも「射程超過ではなく失効記述の是正として妥当。残すほうが有害だった」と判定した。★ただし親の受理が要る**。設計伝達レポート §2-1
  7. **★`useSessionStorage` に意図した挙動差が 1 つある**——**`T` が `null` を含む場合、保存済みの `null` が「未設定」へ畳まれる**（helper の `load(): T | null` が未保存・parse 失敗・読取例外をすべて `null` で表すため）。**⇒ 既存の唯一の利用箇所は `number[]` で該当しない。★諮らずに報告した**（レビュー 中-4 の指摘どおり諮る余地はあった）
  8. **★`combo-list-expanded-ids-v1` の永続化を守る自動テスト・E2E が 0 件**（実測）。`ComboTable.test.tsx` の言及は `sessionStorage.clear()` による漏れ止めであって主張ではない。設計伝達レポート §4-3
  9. **★★レビュー 13 件（高 4 / 中 5 / 低 4）。「高」の不採用は 0 件であり安全弁は発動していない。往復 0 回。不採用 0 件・部分採用 1 件**（中-1。理由は完了報告 §10）。**⇒ 採否の正本は完了報告 §8.2。★高-1 / 高-2 は工程順による**——本 CLI は Phase B（レビュー）が Phase D-0（完了報告）より前であり、**レビュー時点で完了報告が存在しないのは仕様どおりである**。**★次回はレビュアーへのプロンプトにその旨を書くと指摘の精度が上がる**（設計伝達レポート §7-4）
  10. **★`check-browser-storage-keys-stderr-syntax-error`**（`followup` L356）**は当環境で再現しない**——着手基点版・変更後版とも `bash -n` が通り、実行時の stderr は **0 バイト**（実測）。**⇒ 「直した」とは書かない。本サブは構文に触れていない。★設計卓が閉じられるかの判断材料として記録する**
### M40-01: 帰属と宣言の是正（shadcn/ui の MIT ／ 三層への来歴の軸 ／ 残 3 件）（2026-09-20）

- **結果**: 公開ゲート `A` の法務残件 4 件を畳んだ。**三層へ直交する「来歴の軸」を `REUSE.toml` (6) に新設**（T1＝第三者の許諾下で同梱・再配布 ／ T2＝第三者素材を含むが配布しない）。shadcn/ui の帰属は `NOTICE` §6 へ（`Copyright (c) 2023 shadcn` ＋ MIT 条項全文）。`docs/seed-data/**` は層 B から `LicenseRef-Tacpendium-NotForDistribution` へ移し「暫定」を外した。`name_ja` の取得経路は `NOTICE` §2 へ。evidence は chronology だけ `DENY`（除外 13 → 14 件を実測）。**マイグレ消費 0 本 ／ CHANGE 自採番 0 本（原稿 2 本は設計伝達レポート §1 / §6）／ 新規依存 0 件。** `go test ./...` EXIT=0・FAIL 0 件 ／ `pnpm test` 234 ファイル 2974 件 passed ／ `make release-archives` ＋ `check-release-archive.sh` EXIT=0（**配布 3 本すべてに帰属が入ることを実物で確認**）。`make e2e` は実装を 1 行も触らないため回していない。
- **報告**: 完了報告 `docs/progress/M40-01-completion-report.md` ／ レビュー `docs/progress/m40-01-review.md`
- **★横断課題**:
  1. **★★【裁定済み・2026-09-20】改変 4 件の outbound が `AGPL-3.0-or-later` から `MIT` へ変わった**（完了報告 §5b）。**⇒ 上流そのままの 18 件は宣言が事実へ一致しただけだが、`dialog` / `alert-dialog` / `sheet` / `sonner` の 4 件は*本 repo の改変分も MIT で提供する*宣言になる。★開発者確定「(a) 軸を足す」はそこまでを名指しで承認したものではなかったため、代案 2 つを添えて諮った。★★同日に裁定が返った＝現状維持（22 件を 1 表で `MIT`）。⇒ 代案 2 つは不採用。★★★決着したため `followup-backlog.md` へは登録しない**（再開に必要な条件が無い）**。★手放す実体は呼び出し側 2 行 × 3 ＋ `sonner` のアイコン設定であり、`ModalPresenceMarker` の実装本体（`web/src/lib/modal-presence.ts`）は層 A のまま残ることを実測で確かめたうえでの裁定である。★一度 MIT で配ったものは取り消せないため、判断の重みを `REUSE.toml` (6-T1) のコメントへ残した。**
  2. **★★★新しく書いた検査が、守るはずの最大の回帰を素通りしていた**（レビュー 高-2 / 高-3。完了報告 §8b）。**⇒ 初版は `REUSE.toml` から shadcn ブロックを丸ごと消しても EXIT=0 であり、自己検査は全対照が緑、`check-artifact-integrity.sh` も緑であった。★一般形＝「検査を書いた」は「検査が効く」の証拠にならない。⇒ 新しい検査を書いたら *守りたい事故そのものを実際に起こして* 赤くなることを確かめること。対照の設計では分からず、実リポジトリでの変異でしか分からない。**
  3. **★`docs/change-notes/CHANGE-226-notification.md` が存在しない**。指示書 `M40-01` §1-6 / §9 とレビューチェックリスト E-3 が参照しているが実体が無い（中身は `change-number-registry.md:203` ／ `DES-001` ／ `SUPP-001` に在る）。**⇒ `check-doc-refs.sh` の走査範囲にレビュー・指示書は含まれないため機械では出ない。設計卓の手番。**
  4. **★`three-layer-lacks-third-party-axis` の選択肢が 2 文書で食い違っていた**（followup は 2 択・現状は「(b) 除外で切る」、チェックリスト B-2 は 3 択）。**⇒ 指示書 v1.1.0 の 3 択に従い (a) を採った。followup を閉じるときは、除外では著作権者の宣言が偽である問題は解けない旨を残すこと。**
  5. **★`docs/progress/**` は `ALLOW` であり、完了報告・レビュー報告は日常的に短縮 SHA を引用している。⇒ 本サブのファイル単位 `DENY` は chronology のような*塊*には効くが、この面には効かない。★あわせて開発者確定は「SHA 3 件だけ伏せる」であり、追補報告に残る非公開リポの*日付*は伏せていない。⇒ 広げるかは開発者の判断。**
  6. **★`docs/progress/M26-02-completion-report.md:81` の判断**（`LICENSES/MIT.txt` の `<year> <copyright holders>` を埋めた）**が本サブ §5 で反転した。★歴史記録は書き換えない**（`D-274` (3)）**が、反転を辿れるようにしておく必要がある。**

### M26-04 追補: 公開候補の SCANOSS 再スキャン（2026-09-21）

- **結果**: 公開候補 `51915cf93349deaa1b4a63122fd64c89b2b6d2da` の `cmd/`・`internal/`・`web/src/` を Windows ローカルで SCANOSS 1.54.2 により再スキャンし、devContainer で ZIP SHA-256、固定 commit、全 path / Git blob、成果物件数、初回差分を検証した。**最終＝none 960 / snippet 61 / file 19 / match 80。初回 81 件との差分＝added 1 / removed 2 / unchanged 79。** M40-02 で書き換えた `useSessionStorage.ts` の旧 80% と `useRecentCombos.test.ts` の旧 95% は `removed`。開発者確定で据え置いた 3 件は `unchanged`。新規 1 件は `useRecentCombos.test.ts` の 42% / Apache-2.0 表示で、React Query hook test の定型構造による低優先度の偽陽性と判定した。shadcn/ui の一致は MIT 帰属済みの既知 vendored source として継続。正本は `docs/progress/M26-04-scanoss-followup-report.md` §9、evidence は `docs/progress/evidence/m26-04-scanoss/` の `final-51915cf93349` 2 ファイル。
- **公開ゲート**: 再スキャンと disposition は完了。ただし `public-release-runbook.md` §2.A.1 の現行完了条件「新規 match が増えていないこと」に対して新規 1 件があるため、`A9` / `A-1` のチェック状態は変更していない。
