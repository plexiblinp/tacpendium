# M1-06 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M1-06-combo-editor-page.md` v1.1.0 |
| チェックリスト | `docs/instructions/reviews/M1-06-review-checklist.md` |
| レビュー実施日 | 2026-05-05 |
| レビュー担当 | 品質レビュー担当 Claude (claude-sonnet-4-6) |
| レビュー対象ブランチ | feature/m1-06-combo-editor-page |

---

## 総評

設計要件の大半を高品質に実装しており、CHANGE-001/003/006 の反映・仮登録バリデーション緩和・PATCH/PUT 分岐ロジック・確認ダイアログのいずれも正確に実装されている。TypeScript コンパイルは全通過、`any` 使用・ブラウザストレージ API 使用も皆無で、コード品質は全体的に良好。

ただし、**`driveAvailableAtStart` / `saAvailableAtStart` / `driveDamage` の 3 フィールドが PATCH 経路でサイレントに損失される**という設計ギャップが存在する。根本原因は M1-03 の `UpdateMetadataRequest` が上記 3 フィールドを欠落させていることにあり、変更通知書(CHANGE-NOTE)の発行が必要。また、保存成功後の WARNING 確認モーダルが未実装であり、§4.6 仕様に違反している。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| DES-005 §5.7 入力項目の網羅: キャラクター | ◎ | disabled select、リュウ固定、SUPP-001 §4.1 準拠 |
| DES-005 §5.7 入力項目の網羅: ダメージ | ◎ | 数値 input、min=0 |
| DES-005 §5.7 入力項目の網羅: position / opponent_stance / hit_type / opponent_size | ◎ | SUPP-001 §3.2 の全コード値を実装、ラベル正確 |
| DES-005 §5.7 入力項目の網羅: opponent_stance に `any` (CHANGE-003) | ◎ | `labels.ts` に `{ value: "any", label: "どちらでも可" }` あり |
| DES-005 §5.7 入力項目の網羅: starter_move_id | ◎ | 自動推定(レシピ1ステップ目) + 手動上書き両対応 |
| DES-005 §5.7 入力項目の網羅: ドライブゲージ / SA ゲージ / driveDamage | ○ | UI に表示あり。ただし PATCH 経路での保存に問題あり(後述「高」参照) |
| DES-005 §5.7 入力項目の網羅: knockdownAdvantage (CHANGE-003 ラベル、w-24) | ◎ | `w-24` クラス使用、「有利フレーム」ラベル正確 |
| DES-005 §5.7 入力項目の網羅: 起き攻め BOOLEAN 6 個 (CHANGE-001) | ◎ | `OKI_FIELDS` で 6 フィールドすべて実装、カラム名も DES-003 §3.4 と完全一致 |
| DES-005 §5.7 入力項目の網羅: メモ | ◎ | textarea、maxLength=2000 |
| DES-005 §5.7 入力項目の網羅: タグ | ○ | M3 プレースホルダ表示のみ。指示書 §1 で明示的に M3 先送りのため許容 |
| DES-005 §5.7 入力項目の網羅: 仮登録トグル | ◎ | is_draft チェックボックス、視覚的にも識別しやすい独立 fieldset |
| SUPP-001 §2.1 仮登録時バリデーション緩和 | ◎ | `schema.ts` が `comboFormSchemaPublished` / `comboFormSchemaDraft` を分離し、仮登録ではレシピ 0 件・starter NULL を許容 |
| SUPP-001 §2.2 PATCH/PUT 判定対象 7 フィールド | ◎ | `utils.ts` の `hasKeyChanges` が character_id / starter_move_id / position / opponent_stance / hit_type / opponent_size / steps(move_id + modifiers) の全 7 フィールドを比較 |
| PUT 時の確認ダイアログ表示 | ◎ | 「この編集はコンボの再登録となります(古いコンボはゴミ箱へ移動)。続行しますか?」— HANDOVER-001 §3.1 の文言と完全一致 |
| 仮想コントローラを本格実装していないか | ◎ | グレープレースホルダ 1 行のみ。実装なし |
| バリデーション WARNING/ERROR の表示 | ◎ | `ValidationDisplay.tsx` が error=赤・warning=黄 で表示 |
| 重複警告 VAL-C02 ERROR の専用モーダル | ○ | `DuplicateWarning.tsx` にモーダルあり。「既存コンボの詳細を見る」ボタンはなし(API が重複コンボ ID を返さないため §4.5.1 の「シンプルなエラーメッセージ表示でよい」を適用、許容) |
| 保存後の遷移(コンボ詳細画面) | △ | `navigate(\`/combos/${data.id}\`)` で遷移あり。ただし WARNING あり 200 の場合に確認モーダルなし(後述「中」参照) |
| 409(楽観衝突)エラー処理 | ◎ | 「他のユーザーによって更新されています。再読み込みして…」のメッセージ表示 |
| 500 エラー処理 | ◎ | `handleError` で汎用エラー表示 |
| router.tsx に `/combos/new` / `/combos/:id/edit` | ◎ | 両ルートとも登録済み |

---

## コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| TypeScript strict 有効、`any` 使用なし | ◎ | `tsc --noEmit` 全通過。`any` 型使用なし(文字列値 `"any"` は対象外) |
| 関数コンポーネント + Hooks のみ | ◎ | class コンポーネントなし |
| ブラウザストレージ API 使用なし | ◎ | localStorage / sessionStorage / IndexedDB 使用なし |
| console.log の本番コード残存なし | ◎ | 使用なし |
| フォーム状態管理が適切 | ◎ | `useState` + zod safeParse の組み合わせ、適切な管理 |
| サブコンポーネントへの適切な分割 | ◎ | ComboEditorBasicFields / RecipeBuilder / StepRow / ValidationDisplay / DuplicateWarning の 5 分割 |
| `ApiError` クラスの設計 | ◎ | status / body / validations を保持し、呼び出し元で 400/409/5xx の分岐が明確 |
| `useCombo` / `useCreateCombo` / `useUpdateComboMetadata` / `useUpdateComboWithKeyChange` | ◎ | 指示書 §2.1 の成果物ファイル通りに実装 |
| `useMovesByCharacter` | ◎ | `features/moves/api.ts` として分離、5 分キャッシュ(技マスタは静的に近いため妥当) |
| `extractKeyFields` ヘルパ | ◎ | `utils.ts` の薄いヘルパ、責務分離が明確 |

---

## UI 品質

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| 保存中の loading 表示 | ◎ | `isMutating` で「保存中...」に切り替え、ボタン disabled |
| 保存後の遷移 | △ | 詳細は下記「推奨修正（中）」参照 |
| エラー時の挙動 | ◎ | topMessage + ValidationDisplay の二段階表示 |
| 仮登録トグルの視覚的識別性 | ○ | 独立 fieldset で視覚的に分離されているが、色や強調なし。機能上は問題ない |
| 技セレクタの optgroup によるカテゴリ分類 | ◎ | MOVE_CATEGORY_ORDER に沿って optgroup 表示、使いやすい |
| 編集モードでの初期値投入 | ◎ | `initialBasic(initial)` で全フィールドを正確にプリセット |

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `hasKeyChanges` のテスト: position 変更 → true | ◎ | 実装あり |
| `hasKeyChanges` のテスト: recipe(modifiers のみ)変更 → true | ◎ | 実装あり |
| `hasKeyChanges` のテスト: タグのみ変更 → false | ◎ | 実装あり |
| `hasKeyChanges` のテスト: メモのみ変更 → false | ◎ | 実装あり |
| 追加テスト: hit_type 変更 → true (CHANGE-006) | ◎ | 実装あり |
| 追加テスト: steps 長さ変更 → true | ◎ | 実装あり |
| 追加テスト: flags 順序違いは同一 → false | ◎ | 実装あり(重要なエッジケース) |
| RecipeBuilder コンポーネントテスト(任意) | 不明 | 実装なし。指示書 §5 で「任意」のため許容。実機確認は開発者目視に委ねる |

テスト全 10 件(`utils.test.ts` 7 件 + `api-client.test.ts` 3 件)全通過確認済み。

---

## 禁止事項違反の有無

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `localStorage` / `sessionStorage` / `IndexedDB` 使用なし | ◎ | 使用なし |
| `console.log` 本番コード残存なし | ◎ | 残存なし |
| 仮想コントローラの本格実装をしていないか | ◎ | プレースホルダ 1 行のみ |
| 設計書に記載のない機能の追加なし | ◎ | 指示書スコープ内に留まっている |

---

## 統合確認

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| router.tsx に `/combos/new` 登録 | ◎ | 登録済み |
| router.tsx に `/combos/:id/edit` 登録 | ◎ | 登録済み |
| M1-05 一覧画面「編集」リンクの遷移先 | 不明 | M1-05 は並列開発中のため本 worktree では確認不可。統合後に要確認 |
| M1-05「新規登録」ボタンの遷移先 | 不明 | 同上 |
| 現在の router.tsx に `/combos` / `/combos/:id` (M1-05 ルート)が存在しない | △ | 並列開発の性質上これは想定内。ただし統合時に `/combos/:id` の詳細画面への navigate が正常動作するか確認必須 |

---

## 推奨修正(優先度別)

### 高 (M1 完了前に修正必須)

**H-01: `driveAvailableAtStart` / `saAvailableAtStart` / `driveDamage` の PATCH 経路でのサイレントデータ損失**

- **現象**: ユーザーが「ドライブゲージ」「SA ゲージ」「ドライブダメージ」だけを変更して保存ボタンを押すと、これら 3 フィールドはキー変更フィールドではないため `hasKeyChanges` = false となり PATCH が呼ばれる。しかしフロント側 `buildPatchPayload` / バックエンド側 `UpdateMetadataRequest` / リポジトリ層 `UpdateMetadataInput` のいずれにもこれら 3 フィールドが含まれていないため、変更がサイレントに失われる。ユーザーには成功メッセージが表示されるが、DB は更新されていない。

- **根本原因**: M1-03 で実装された `UpdateMetadataRequest` / `UpdateMetadataInput` がこれら 3 フィールドを欠落させている。DES-005 §5.7 は「(b) メタデータ編集: ダメージ、**ゲージ消費**、起き攻め情報、knockdown_advantage…」と明記しており、ゲージ関連フィールドはメタデータ編集(PATCH)の対象のはずだった。

- **修正方針**: M1-03 に対して変更通知書(CHANGE-NOTE)を発行し、`UpdateMetadataRequest` / `UpdateMetadataInput` に `DriveAvailableAtStart *int / SAAvailableAtStart *int / DriveDamage *int` を追加する。フロント側も `types.ts` の `UpdateMetadataRequest` と `buildPatchPayload` を対応する形で拡張する。

- **関連ファイル**:
  - `internal/api/combo/dto.go` — `UpdateMetadataRequest` 拡張(M1-03 管轄)
  - `internal/repository/combo/repository.go` — `UpdateMetadataInput` 拡張(M1-03 管轄)
  - `web/src/features/combo/types.ts` — `UpdateMetadataRequest` 拡張
  - `web/src/features/combo/components/ComboEditor.tsx` — `buildPatchPayload()` 拡張

---

### 中 (M2 着手と並行可)

**M-01: 保存成功 + WARNING ありの場合に確認モーダルが表示されない (§4.6 仕様違反)**

- **現象**: `runCreate` / `runPatch` / `runPut` の `onSuccess` ハンドラで `data.validations` に WARNING があっても確認モーダルを出さず即座に `navigate(\`/combos/${data.id}\`)` する。`setValidationResult(data.validations)` は呼ばれるが、直後の `navigate` でコンポーネントがアンマウントされるため、警告は一切表示されない。

- **指示書要件**: §4.6「200 + WARNING あり → 確認モーダル『以下の警告がありますが続行しますか?』」

- **修正方針**: `onSuccess` ハンドラ内で `data.validations?.issues?.some(i => i.severity === "warning")` を判定し、WARNING がある場合は `navigate` の代わりに「警告確認モーダル」を表示する。ユーザーが「続行」した後に `navigate` する。

- **関連ファイル**:
  - `web/src/features/combo/components/ComboEditor.tsx` — `runCreate` / `runPatch` / `runPut` の `onSuccess` を修正

---

### 低 (将来対応)

**L-01: StepRow に既存ステップの modifiers 編集 UI がない**

- 指示書 §4.3.4 は「削除して再追加でもよい(最小実装)」と許容しているため規約違反ではない。M2 で本格的な UI を実装する際に解消する。

**L-02: M1-05 統合後の router.tsx の結合確認**

- 現状 router.tsx に M1-05 のルート(`/combos`, `/combos/:id`)が存在しない。M1-05 マージ後にルートの重複・競合がないこと、および `navigate(\`/combos/${data.id}\`)` が詳細画面に正しく遷移することを確認する。

**L-03: StepRow の key prop が冗長**

- `key={\`${s.stepOrder}-${idx}\`}` は `reorder()` により `stepOrder === idx + 1` が保証されるため `key={idx}` で十分。軽微。

---

## 良かった点

1. **`hasKeyChanges` のテスト充実**: 必須 4 ケースに加え、hit_type 変更(CHANGE-006)・steps 長さ変更・flags 順序無視の 3 ケースを追加。特に「flags の順序違いを同一とみなす」テストは仕様の微妙なエッジケースを正確に捉えており評価が高い。

2. **仮登録バリデーションの zod schema 分離**: `comboFormSchemaPublished` / `comboFormSchemaDraft` の 2 スキーマ分離は、SUPP-001 §2.1 のルールを忠実かつ型安全に実装しており、将来のバリデーションルール変更にも耐えやすい構造。

3. **PUT 確認ダイアログのメッセージ精度**: 「この編集はコンボの再登録となります(古いコンボはゴミ箱へ移動)。続行しますか?」という文言が HANDOVER-001 §3.1 の仕様を完全に反映しており、実装者がドキュメントを丁寧に読んだことが分かる。

4. **`modifiersEqual` の実装**: flags の順序を正規化ソートしてから比較する実装は、サーバー側 recipe_hash 計算の決定論性(SUPP-001 §3.3.0 参照)と整合しており、重複判定の誤検知を防ぐ。

5. **`ApiError` クラスの設計**: HTTP ステータスと JSON 構造化エラーを同一クラスで扱い、呼び出し元で 400/409/5xx の分岐を簡潔に実装できている。`fetchJSON` と `requestJSON` を用途別に使い分けているのも適切。

6. **技セレクタの optgroup**: `MOVE_CATEGORY_ORDER` に従ったカテゴリ別グループ化は指示書 §4.3.2 の要件を超えた実装品質。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際のフォーム入力体験・バリデーション体験・サーバーとの E2E 動作は開発者目視に委ねる。
- `hasKeyChanges` のテストは通過確認済みだが、実際の API 呼び出し分岐(PATCH/PUT)の動作確認は実機テストが必要。
- M1-05 との統合確認は並列開発完了後に実施すること。

---

*以上*
