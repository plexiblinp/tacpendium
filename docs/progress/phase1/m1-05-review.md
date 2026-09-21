# M1-05 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー日 | 2026-05-05 |
| レビュー担当 | 品質レビュー担当 Claude |
| 対象指示書 | `docs/instructions/M1-05-combo-list-detail-pages.md` v1.3.0 |
| 対象チェックリスト | `docs/instructions/reviews/M1-05-review-checklist.md` |

---

## 総評

全体として指示書・設計書の仕様を高い水準で実現しており、特に CHANGE-002・CHANGE-006 の正確な反映と、`getSetupDisplayName` をはじめとするユーティリティのテスト充実度が評価できる。TanStack Query の設計も一貫しており、暫定実装箇所もコードコメントと引継ぎ書に明示されている点は次担当への配慮として良好。

ただし `BUILTIN_PRESET_CODES` にプリセットコード値の誤り(DB と不一致)があり、現時点では当該コードが未参照のため実害は出ていないが、M2 以降で参照されると確実にバグになる。M1 完了前に修正が必要。詳細画面の作成日時・更新日時の表示欠落、および `useCombo` の enabled 条件の弱さも M2 着手と並行して解消を推奨する。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| DES-005 §5.4 列構成(CHANGE-002反映後) | ◎ | 始動状況・ダメージ・ルート・タグ・登録状態・備考・操作の順で正確に実装 |
| └ 始動状況グループ列が先頭 | ◎ | ComboTableRow の列定義で確認 ✓ |
| └ ステップ数列の削除 | ◎ | 存在しない ✓ |
| └ 相手スタンス独立列の削除 | ◎ | 存在しない。始動状況グループに包含 ✓ |
| └ 備考(メモ)列の追加 | ◎ | `comboList.column.memo` で実装 ✓ |
| └ 登録状態列の追加 | ◎ | `comboList.column.draftState` + バッジで実装 ✓ |
| DES-005 §5.4 ツリー構造(展開アイコン▶/▼) | ○ | ChevronRight/ChevronDown アイコン使用。ただし下記△を参照 |
| └ セットプレイ紐付け時のみ表示 | △ | 全コンボ行に常時表示。API 一覧レスポンスにセットプレイ件数が含まれないため、ON/OFF 制御の手段がない。設計意図との差異だが API 側制約が原因(M1-03 スコープ) |
| └ 展開時プレースホルダ表示 | ◎ | SetupTreeRow で「(セットプレイは M4 で実装予定)」 ✓ |
| DES-005 §5.6 コンボ詳細の表示要素 | ○ | 主要要素は実装。item 10 に欠落あり(下記参照) |
| └ ヘッダ(キャラ・状況4項目・ID) | ◎ | ComboDetailHeader で position/opponent_stance/hit_type/opponent_size + ID ✓ |
| └ メタデータ(ダメージ・ゲージ・起き攻め6B・メモ) | ◎ | ComboDetailMetadata で全項目実装 ✓ |
| └ レシピ(プリセット切替UI) | ◎ | ComboDetailRecipe + PresetSwitcher で実装 ✓ |
| └ タグ一覧 | - | M3 範囲のため M1-05 での実装不要(指示書§4.2.2 に明記なし) |
| └ セットプレイ展開エリア | ◎ | 「(セットプレイ機能は M4 で実装予定)」プレースホルダ ✓ |
| └ メタデータ(作成日時・更新日時) | × | DES-005 §5.6 item 10「メタデータ（作成日時、更新日時）」が未実装。`ComboSummary` に `createdAt`/`updatedAt` フィールドはあるが、詳細画面に表示されていない |
| └ アクション(編集・削除・戻る) | ◎ | 全て実装。コピーは M2 範囲で正しく省略 ✓ |
| プリセット切替UI・official_ja_move 初期選択 | ◎ | `BUILTIN_PRESET_CODES.officialJaMove` を優先して初期選択、フォールバックヒント表示あり ✓ |
| 他4プリセットのフォールバック動作 | ◎ | エイリアス空のプリセットは notation サービスでフォールバック(コメント・ヒント文言で説明) ✓ |
| SUPP-001 §2.4 getSetupDisplayName | ◎ | 仕様通りに実装、PC=30/モバイル=20文字 ✓ |
| SUPP-001 §3.2 状況コード→ラベル変換 | ◎ | POSITION/OPPONENT_STANCE/HIT_TYPE/OPPONENT_SIZE 4種、`any` 含む(CHANGE-003反映) ✓ |
| SUPP-001 §5.1 move_id/move_code 両方 | ◎ | `ComboStep.moveId` + `ComboStep.moveCode` 両フィールド ✓ |
| BUILTIN_PRESET_CODES のコード値 | × | `numpadJa: "numpad_ja"` / `numpadEn: "numpad_en"` だが、DB seed(000005)は `numeric_ja` / `numeric_en`。**コード値不一致。現時点は未参照のため実害なしだが M2 以降に確実にバグ化する** |

---

## コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| TypeScript strict 有効、any 使用なし | ◎ | `any` 使用箇所なし。`"any"` 文字列リテラル(スタンスコード)は問題なし |
| 関数コンポーネント + Hooks のみ | ◎ | class コンポーネント不使用 ✓ |
| ブラウザストレージ API 使用なし | ◎ | localStorage/sessionStorage/IndexedDB 不使用 ✓ |
| TanStack Query の queryKey 設計一貫性 | ◎ | `["combos", filter]` / `["combo", id]` / `["combo", comboId, "recipe", presetId]` / `["presets"]` で一貫 ✓ |
| ページコンポーネントの適切な分割 | ◎ | ComboListPage → ComboFilterBar + ComboTable → ComboTableRow + SetupTreeRow。ComboDetailPage → ComboDetailHeader + ComboDetailRecipe(+ PresetSwitcher) + ComboDetailMetadata。肥大化なし ✓ |
| DELETE の 204 No Content 対応 | ◎ | `fetchJSON` ではなく raw `fetch` を使用、コメントで理由説明 ✓ |
| useCombo の enabled 条件 | △ | `id !== undefined && id !== ""` のチェックだが、`"new"` 等の非数値文字列でも enabled=true になる。M1-06 で `/combos/new` ルートが追加された後、`/combos/new` → `ComboDetailPage(id="new")` → `GET /api/combos/new` が発火しバックエンドで 400 エラーになる。現時点は当該ルートが未登録なので無害 |
| Go DTO とフロント型の整合 | ◎ | `DriveGaugeConsumedTotal *float64` → `driveGaugeConsumedTotal?: number` 等、目視確認で一致 ✓ |
| CHANGE-006 (counter_type → hit_type) 反映 | ◎ | 指示書 §4.4 が `COUNTER_TYPE_LABELS` 表記のまま残っているが、実装は `HIT_TYPE_LABELS` として正しく修正済み ✓ |

---

## UI 品質

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| ローディング表示 | ◎ | 一覧・詳細ともに `isLoading` 時の表示あり ✓ |
| エラー表示 | ◎ | 一覧・詳細ともに `isError` + `error.message` 表示あり ✓ |
| 空状態(0件)の表示 | ◎ | ComboTable 側で 0件時に `comboList.empty` メッセージ ✓ |
| 削除確認ダイアログ | ○ | `window.confirm()` で実装。native ダイアログだが指示書の要件は満たす。shadcn/ui AlertDialog は M2 以降で差し替え可能(引継ぎ書 §3.4 に記録済み) |
| 仮登録バッジ | ◎ | amber-100/amber-800 で視覚的に識別可能。本登録は emerald-100/emerald-800 ✓ |
| ホバー・遷移のインタラクション | ◎ | hover:bg-slate-50、hover:underline 等 適切 ✓ |
| ComboDetailRecipe でプリセット読込中表示 | △ | `presetsQuery.isLoading` 時の UI がない。`recipeQuery.isLoading` は表示しているが、プリセット一覧ロード中は PresetSwitcher が非表示になるだけで、ユーザーへのフィードバックがない |

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| getSetupDisplayName(name あり/null短/null長) | ◎ | 6 ケース実装(name あり・null 短い・null 長い PC・undefined・モバイル 20 文字・空文字列のフォールバック) ✓ |
| 状況コード→ラベル変換テスト | ◎ | `labelFor` の正常系・未知コード前方互換・undefined/null 各ケース ✓ |
| formatStarterStatus | ◎ | 3情報結合・欠損時ハイフン埋め ✓ |
| formatDamage/formatDriveGauge/formatSAGauge | ◎ | undefined/正常値/小数末尾除去 各ケース ✓ |
| formatMemo | ◎ | 短い/空/30文字超省略 ✓ |

---

## 禁止事項違反の有無

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| localStorage/sessionStorage/IndexedDB 使用 | ◎(なし) | grep 確認で不使用 ✓ |
| console.log 本番コード残存 | ◎(なし) | grep 確認で不存在 ✓ |
| 設計書に記載のない機能の追加 | ◎(なし) | なし ✓ |
| M0 プロトタイプの古い列構成(CHANGE-002 前)の採用 | ◎(なし) | CHANGE-002 反映済み ✓ |

---

## 統合確認

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| router.tsx に `/`・`/combos/:id` が登録 | ◎ | `/`、`/combos`(エイリアス)、`/combos/:id` が登録 ✓ |
| M1-01 の HealthCheckPage が壊れていない | ◎ | `/health` ルートが router.tsx に残置 ✓ |
| バックエンド API の URL・形式との整合 | ◎ | `/api/combos`・`/api/combos/:id`・`/api/combos/:id/recipe?preset_id=X`・`/api/presets` と一致 ✓ |
| handler.go の GetRecipe 実装と API 呼出の整合 | ◎ | `fetchJSON<ComboRecipeResponse>(/api/combos/${comboId}/recipe?preset_id=${presetId})` ↔ `RecipeResponse{ ComboID, PresetID, Text }` が対応 ✓ |

---

## 推奨修正(優先度別)

### 高(M1 完了前に修正必須)

1. **`BUILTIN_PRESET_CODES` のコード値修正** (`web/src/features/preset/types.ts`)

   ```typescript
   // 現状(誤)
   numpadJa: "numpad_ja",
   numpadEn: "numpad_en",

   // 修正後(DB seed 000005 の実際のコード値に合わせる)
   numericJa: "numeric_ja",
   numericEn: "numeric_en",
   ```

   DB の `migrations/000005_seed_presets.up.sql` は `numeric_ja` / `numeric_en` を INSERT しているのに対し、フロント定数が `numpad_ja` / `numpad_en` を参照しておりコードが不一致。現在は `officialJaMove` のみ参照されているため実害なしだが、M2 以降でこれらのコードを参照する実装が加わると確実にバグになる。

### 中(M2 着手と並行可)

2. **詳細画面に作成日時・更新日時を追加** (`web/src/features/combo/components/ComboDetailMetadata.tsx`)

   DES-005 §5.6 item 10 で定義されているが未実装。`combo.createdAt` / `combo.updatedAt` は API レスポンスに含まれており、表示コスト低。

3. **`useCombo` の `enabled` 条件に数値チェックを追加** (`web/src/features/combo/api.ts`)

   M1-06 で `/combos/new` ルートが登録されると `id="new"` で `GET /api/combos/new` が飛びバックエンドが 400 を返す。修正例:

   ```typescript
   enabled: id !== undefined && id !== "" && !isNaN(Number(id)),
   ```

4. **一覧ルート列の暫定 "-" 表示を進捗ログに課題として記録**

   現在の引継ぎ書 §3.4 に記載済みだが、進捗ログの課題バックログ（`docs/progress/progress-log.md`）にも「一覧 API への recipe_cache 結合を M3 以降で検討」として明示的に残すことを推奨。

### 低(将来対応)

5. **`ComboDetailRecipe` でプリセット読込中のフィードバック追加**

   `presetsQuery.isLoading` 時に「プリセットを読み込み中...」等のメッセージを表示すると UX が向上する。

6. **展開アイコンのセットプレイ件数制御**

   DES-005 §5.4「セットプレイ紐付け時のみ表示」を厳密に実装するには、一覧 API または別途バルク取得 API でセットプレイ件数を返す必要がある。M4 でセットプレイ機能が実装される際に合わせて対応。

---

## 良かった点

1. **CHANGE-002 / CHANGE-006 の正確な反映**: 列構成の再設計(始動状況グループ先頭・ステップ数削除・相手スタンス独立列削除・備考追加・登録状態追加)と hit_type へのリネームが、指示書の意図通りに実装された。特に §4.4 が古い名前(COUNTER_TYPE_LABELS)で記載されているにもかかわらず、実装側で HIT_TYPE_LABELS に修正したのは正しい判断。

2. **テストの充実度**: `getSetupDisplayName` に 6 ケース、`labelFor` に 3 パターン(正常・未知コード・null 系)、整形関数群もエッジケース網羅。必須テスト要件を超えた品質。

3. **DELETE の 204 No Content 対応**: `fetchJSON` が JSON を期待するため、`DELETE` だけ raw `fetch` を使用した設計判断は適切。コメントで理由を明記しており保守性が高い。

4. **暫定実装の文書化**: 一覧ルート列 "-"・タグ列 "-"・始動技 `#<id>` 表示・`window.confirm` 削除確認・展開アイコン常時表示など、暫定である箇所がコードコメントと引継ぎ書 §3.4 の表で明示されており、次担当が誤解なく理解できる。

5. **TanStack Query の設計一貫性**: queryKey が 4 種類すべて一貫した命名体系で、invalidation ロジックも適切(`["combos"]` を一括無効化)。`usePresets` の `staleTime: 5 * 60 * 1000` 設定も合理的。

6. **SUPP-001 §2.4 `getSetupDisplayName` の先行実装**: M1-05 段階ではセットプレイデータがないにもかかわらず、将来 M4 で使うフォールバック関数を用意しておく対応は指示書通りで良好。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際のブラウザでの見え方・色彩・インタラクション体験は開発者目視に委ねる。
- 動作確認(make test 通過・開発サーバー起動・プリセット切替動作)は本レビューの対象外。引継ぎ書 §4.1〜§4.2 に従い devContainer 内での実施が必要。
- バックエンド実装(M1-03 で完成済みのサービス層・リポジトリ層)は本レビューの対象外。

---

*以上*
