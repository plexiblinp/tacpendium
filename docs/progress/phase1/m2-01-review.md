# M2-01 レビュー報告書

## 総評

仮想コントローラのコア実装(controllerTypes.ts / HitBoxLayout.tsx / useControllerInput.ts / VirtualController.tsx)は、設計書 DES-005 §6.2 の論理ボタン定義・SUPP-001 §3.3.x の modifiers 構造と高い整合性を保って実装されており、完成度は高い。RecipeBuilder・StepRow の改修も M1-06 の既存ロジックを壊さず、`useMovesByCharacter` の重複呼出防止も実現できている。

一方で、**製造担当の実装完了報告が progress-log.md に未記載**(seed 確認コマンド出力・E2E シナリオ手順書・curl 結果が提出されていない)であることを重大な問題として指摘する。また、チェックリストが明示要求する **`drive_parry` ボタンクリックのテストが欠落**している点も高優先度で修正が必要。

ビルド・全テスト通過・TypeScript 型エラーなし(pnpm build / vitest / tsc --noEmit の3点確認済み)。

---

## 設計書本体との照合(§1 観点)

### 1.1 論理ボタン定義(controllerTypes.ts)
**◎** `LogicalButton` 型が DES-005 §6.2 の14種(direction_neutral / direction_1〜9 / 6攻撃ボタン / drive_impact / drive_parry / throw / parry_drive_rush / step_commit / step_delete)と完全一致。設計書外の値の追加・削除なし。`throw` が論理ボタン名であることの注釈コメントも適切。

### 1.2 modifiers の構造
**◎** `Modifiers` 型が SUPP-001 §3.3.0 の Go 構造体と整合(flags?: string[] / type?: string / notes?: string、すべて optional で omitempty 相当)。flags 4種・type 4種が SUPP-001 §3.3.1 / §3.3.3 と完全一致。notes 50文字超で赤色警告が ModifiersEditor に実装されている。

### 1.3 moves テーブルの seed 確認
**×** 製造担当からの実装完了報告(§3.4.1 の確認コマンド出力)が `docs/progress/progress-log.md` に記録されていない。M2-01 セクション自体が progress-log に存在しない。チェックリスト §1.3 / §7.1 の要件を満たしていない。

### 1.4 move.code 検索パターン
**◎** `BUTTON_TO_MOVE_CODE` 定数マップで9種(stand_light_punch 〜 stand_heavy_kick の6種 + drive_impact + drive_parry + forward_throw)を完全一致検索している。論理ボタン `throw` → `forward_throw` の解決が SF6 仕様どおり正しく実装されている。move 不在時の `console.warn` ログも指示書 §4.4.2 のフォーマット例(`characterId=..., code=...`)に沿っている。

### 1.5 非技ステップの構造
**○** `parry_drive_rush` クリック時に `{ moveId: undefined, modifiers: { type: "parry_drive_rush" } }` が生成される。指示書の例示(`{ moveId: null, flags: [], notes: "" }`)と細部が異なるが、`flags` 省略(undefined = 空と等価)・`notes` 省略(undefined = 空と等価)・`moveId: undefined`(API 送信時に `s.moveId ?? null` で null に変換)はいずれも "同等の構造" の範囲内。機能的な問題なし。

---

## 設計意図との整合(§2 観点)

### 2.1 技セレクタとの併存
**◎** RecipeBuilder.tsx の既存 `<select>` が削除されず、`handleVCStepAdd` / `handleAdd` 両経路が同じ `steps` state を更新する構造が正しく実装されている。

### 2.2 方向ボタン・step_commit の「何もしない」挙動
**◎** `BUTTON_TO_MOVE_CODE` に direction 系が含まれず、switch 文にもケースがないため、direction_1〜9 / direction_neutral / step_commit クリック時は何もしない。テストでも検証済み。

### 2.3 modifiers 編集 UI の格上げ
**◎** StepRow の `onEdit` プロップが `setEditingStepIndex` に接続され、ModifiersEditor がモーダルとして表示される。既存 modifiers の初期値反映・保存・キャンセル・背景クリックでの閉じる動作が正しく実装されている。技ステップ / 非技ステップでの type ラジオの表示切替も仕様どおり。

### 2.4 notes の保存パス(M2-04 への接続点)
**△** ModifiersEditor で notes を入力・保存する経路は実装されており、ComboEditor 経由で API に送信される。ただし、**シナリオ D の curl 結果が実装完了報告に含まれておらず**、保存ラウンドトリップの確認ができていない。notes の画面表示が実装されていない点は仕様どおり(M2-04 で対応)。

### 2.5 useMovesByCharacter の呼出階層
**◎** ComboEditor.tsx の1か所でのみ `useMovesByCharacter(RYU_CHARACTER_ID)` を呼び出し、`movesQ.data ?? []` を RecipeBuilder に props として渡している。重複呼出がない。

---

## テストの妥当性(§3 観点)

### 3.1 VirtualController テスト

| チェック項目 | 結果 |
|-----------|------|
| 全論理ボタンが画面に存在する | **△** 対角方向ボタン4種(左上/右上/左下/右下)が未確認。step_commit は HitBoxLayout に存在しない(後述) |
| LP クリック → stand_light_punch | ✓ |
| DI クリック → drive_impact | ✓ |
| **drive_parry クリック → drive_parry move** | **✗ テストなし**(チェックリスト §3.1 明示要求) |
| 投げ クリック → forward_throw | ✓ |
| ラッシュ クリック → 非技ステップ | ✓ |
| 削除クリック → onStepDelete | ✓ |
| 方向ボタン単独 → 何も呼ばれない | ✓ |

### 3.2 ModifiersEditor テスト
**◎** flags 4種・初期値反映・技/非技ステップでの type 表示切替・notes 50文字超警告・保存/キャンセルの全項目がテストされている。アサーションも具体的(flag値の内容まで確認)。

### 3.3 テスト設計品質
**○** テスト名が日本語で「何を確認するか」を明示している。アサーションが `objectContaining` / 実値比較で具体的。モックの扱い(makeMove ヘルパ)が明確。エッジケース(move 不在時の console.warn 発火)は未テスト。

### 3.4 E2E シナリオ
**×** E2E シナリオ A〜D が実装完了報告に再掲されていない。シナリオ D の curl 結果も未提出。

---

## API 整合性とエラーハンドリング(§4 観点)

### 4.1 API 呼出
**◎** フロント側 `Modifiers` 型が Go 構造体と整合。`handleSave` での空値省略ロジック(flags 空なら省略・type は isNonMove のみ・notes は trim 後 0文字なら省略)が `omitempty` と同様の挙動を実現している。M1-06 の `buildCreatePayload` / `useCreateCombo` / `useUpdateComboWithKeyChange` の変更なし。

### 4.2 編集2方式の判定ロジック温存
**◎** `hasKeyChanges()` 関数が変更されておらず、`currentKey.steps` に modifiers が含まれているため、modifiers 変更は PUT を発火する挙動が温存されている。

### 4.3 エラーハンドリング
**○** move 不在時の console.warn 実装あり。API エラー処理は M1-06 の ValidationDisplay / DuplicateWarning を継承。

---

## コード品質・規約遵守(§5 観点)

**◎** localStorage / console.log の使用なし。`any` 型なし。pnpm tsc --noEmit エラーなし。pnpm build 成功。

**△ StepInput 型の重複定義**: `useControllerInput.ts` / `VirtualController.tsx` / `RecipeBuilder.tsx` の3ファイルで同一の `type StepInput = Pick<Step, "moveId" | "moveCode" | "modifiers">` が重複定義されている。機能的な問題はないが、フィールド変更時に3か所修正が必要。

**△ RecipeBuilder の draftNotes に 50文字警告なし**: 技セレクタ経由のステップ追加パスにある `<input>` の `maxLength={200}` は入力を許可するのみで、50文字超の UI 警告がない。ModifiersEditor の notes フィールドとの一貫性がない。ただし draftNotes は ModifiersEditor 経由ではなく追加時の一時入力欄のため、軽微な問題にとどまる。

---

## M1-06 既存挙動の温存(§6 観点)

**◎** ComboEditorBasicFields.tsx / ValidationDisplay.tsx / DuplicateWarning.tsx が変更されていない(ファイルタイムスタンプ・内容確認)。hasKeyChanges / useCreateCombo / useUpdateComboMetadata / useUpdateComboWithKeyChange が引き続き正常に動作する。

---

## ドキュメント・進捗ログ(§7 観点)

**×** progress-log.md に M2-01 の完了報告エントリが存在しない。以下が未記録:
- §3.4.1 の seed 確認コマンド出力
- E2E シナリオ A〜D の動作確認手順書
- notes の「入力・保存まで動作するようになった」部分進捗
- m1-known-limitations.md における notes 表示未実装の記述(ファイル自体が存在しない)

---

## 質問・確認事項

### 質問 1: step_commit の HitBoxLayout 欠落

**状況**: `controllerTypes.ts` の `LogicalButton` 型には `step_commit` が定義されているが、`HitBoxLayout.tsx` のシステムブロックに `step_commit` ボタンが存在しない。

**判断に迷った理由**: 指示書 §4.3.2 のレイアウト図には `[DI] [DP] [投げ] [ラッシュ] [削除]` のみが示されており step_commit は含まれていないが、チェックリスト §3.1 は「全14論理ボタンが画面に存在する」と要求している。

**想定される選択肢**:
- 案A: step_commit ボタンを HitBoxLayout に追加する(「確定」ボタンとして配置、クリック時は何もしない)
- 案B: M2 では未使用ボタンのため、HitBoxLayout には表示しないままとする。チェックリスト §3.1 の「全14」は型定義要件への言及と解釈する

**レビュー担当の推奨**: 指示書 §4.2.2 の「クリック時は何もしない」は画面上のボタンとして存在することを前提にした記述と読むのが自然。設計担当 Claude に確認の上、案A で追加することを推奨する。

---

## 推奨修正(優先度別)

### 高(M2 完了前に修正必須)

1. **drive_parry クリックのテスト追加** (`VirtualController.test.tsx`)
   - チェックリスト §3.1 の明示要件が未達
   - 既存の `DI クリック` テストと同パターンで追加可能
   - DP ボタン(aria="ドライブパリィ")クリック → `onStepAdd` が `{ moveId: 8, moveCode: "drive_parry" }` を含む step で呼ばれることを確認

2. **実装完了報告の progress-log.md への追記**
   - §3.4.1 の seed 確認コマンド出力を貼付
   - E2E シナリオ A〜D の動作確認手順書を再掲
   - シナリオ D の curl 結果を貼付
   - notes の「入力・保存まで動作するようになった」部分進捗を記録

### 中(M2-02 着手と並行可)

3. **対角方向ボタン4種の描画テスト補完** (`VirtualController.test.tsx`)
   - 現在「全論理ボタンが描画される」テストが 左上/右上/左下/右下 を未確認
   - `getByRole("button", { name: "左上" })` 等4行を既存テストに追記

4. **step_commit ボタンの扱いを設計担当に確認** (質問1)
   - 指示書 §4.3.2 とチェックリスト §3.1 の矛盾解消
   - 確認後、HitBoxLayout への追加 or 省略の方針を確定

### 低(将来対応)

5. **StepInput 型のエクスポート化で重複排除**
   - `useControllerInput.ts` か `types.ts` で1度定義してエクスポートするリファクタリング
   
6. **RecipeBuilder の draftNotes に 50文字警告を追加**
   - ModifiersEditor との一貫性のため

---

## 良かった点

- **`forward_throw` 解決の実装が明確**: `BUTTON_TO_MOVE_CODE` 定数マップと `findMove` ヘルパの分離により、「論理ボタン → move.code → move 検索」の流れが読みやすく保守しやすい構造になっている
- **`useMovesByCharacter` の重複防止**: 指示書 §4.5.2 の指示を正確に守り、ComboEditor.tsx の1か所だけで呼び出してすべての子に props 渡しする設計が実現されている
- **ModifiersEditor のローカル状態管理**: 「保存」時のみ親に伝播し、キャンセル時は破棄される一方向データフローが明快に実装されている
- **throw → forward_throw テストが存在する**: チェックリスト §3.1 が "drive_parry / 投げ(throw ボタン)" の両方をテストするよう求めているうち、throw 側は漏れなく実装されており、SF6 仕様の理解が正確に反映されている

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- §3.4.1 の seed 確認コマンド出力が実装完了報告に含まれていないため、drive_parry / forward_throw の seed 状況はレビュー担当で直接確認できていない。
