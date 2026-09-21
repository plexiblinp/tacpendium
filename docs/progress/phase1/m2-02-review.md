# M2-02 レビュー報告書（再レビュー v1.1.0 対応）

| 項目 | 内容 |
|------|------|
| 対応チェックリスト | M2-02-review-checklist.md(v1.1.0) |
| レビュー実施日 | 2026-05-07 |
| レビュー担当 | 品質レビュー担当 Claude(Sonnet 4.6) |
| 前回レビュー | 同日(v1.0.0 チェックリスト対応) |

---

## 総評

v1.1.0 チェックリストの主要追加要件（構造化フィールド方式への変更、`UpdateMetadataInput.IsDraft *bool` 追加、ラベル合成表示）はいずれも正しく実装されており、前回レビューで「軽微な問題」として挙げた `label` 欠落・サービス層テスト不在の大部分が解消されている。重大な問題は引き続き curl レスポンス未添付1件のみ。新規追加された§3.2.1（ラベル合成）要件については、始動技・ヒット種別・ポジションの3軸は実装済みだが、キャラ名・opponentStance/opponentSize の表示が未対応という軽微な不足がある。全体として完成度は高く、M2-02 完了に向けた大きな障害はない。

---

## レビュー結果サマリー

- 重大な問題: **1件**（curl レスポンス未添付、前回から継続）
- 軽微な問題: **4件**（キャラ名未表示、opponentStance/Size 未表示、テスト部分不足2件）
- 質問・確認事項: **0件**

---

## v1.0.0 → v1.1.0 変更点の対応状況

| 変更項目 | 実装状況 |
|----------|----------|
| `DuplicateInfoResponse` に全8構造化フィールド追加 | ✅ `dto.go:158-167` |
| `DuplicateInfo`(サービス層)に全8フィールド追加 | ✅ `service.go:82-91` |
| `ComboDuplicateAdapter` が `StepCount` を返す | ✅ `service.go:549` |
| `useCheckDuplicate.ts` の `DuplicateInfo` 型更新 | ✅ `hooks/useCheckDuplicate.ts:23-32` |
| `DuplicateRealtimeWarning` が `moves` prop でラベル合成 | ✅ `DuplicateRealtimeWarning.tsx:17-48` |
| `CheckDuplicateResponse` 型更新(types.ts) | ✅ `types.ts:186-197` |
| `ComboEditor` が `moves` を `DuplicateRealtimeWarning` へ渡す | ✅ `ComboEditor.tsx:299` |
| ハンドラテストに構造化フィールドアサーション追加 | ✅(一部、後述) |
| サービス層 `CheckDuplicate` テスト追加 | ✅ `service_test.go:400-503` |
| `UpdateMetadataInput.IsDraft *bool` 追加 | ✅ `repository.go:60` |
| UPDATE SQL で `IsDraft nil` 時に更新スキップ | ✅ `repository.go:403-404` |

---

## 設計準拠性レビュー結果（v1.1.0 新規・変更項目を中心に）

### §1.5.1 UpdateMetadataInput 拡張の整合性

**◎** `internal/repository/combo/repository.go:60` に `IsDraft *bool` が正しくポインタ型で追加されている。`UpdateMetadata` の UPDATE SQL 組み立て(`repository.go:403-404`)で `input.IsDraft != nil` の場合のみ `is_draft` カラムを更新する分岐が実装されており、後方互換性が確保されている。ハンドラ層の `UpdateMetadataRequest.IsDraft *bool`(`dto.go:57`)も同型。

### §1.5.2 サービス層 is_draft 切替時バリデーション挙動

**○** `service.go:208-219` に `IsDraft != nil && !*IsDraft` のガード条件で、仮登録→本登録時にフルバリデーション(`ValidateComboForCreate`)を実行するコードが実装されている。バリデーション失敗時は更新なしでエラー返却 ✅。ただし **サービス層テストで is_draft 切替時の挙動(VAL-C01〜C12 実行、VAL-C02 失敗時はエラー)がカバーされていない**（後述 §軽微4）。

### §2.1 重複検知 API レスポンス形式（v1.1.0 仕様）

**◎** `DuplicateInfoResponse` が `id, characterId, starterMoveId, position, opponentStance, hitType, opponentSize, stepCount` の8フィールドを持ち、`label` フィールドは存在しない。JSON タグも camelCase で仕様通り。ハンドラ(`check_duplicate_handler.go:64-73`)がサービス層の `DuplicateInfo` の全フィールドを正しくマッピングしている。

### §3.2 DuplicateRealtimeWarning の動作

**○** `role="alert"` ✅、`/combos/{id}` リンク ✅。警告文言「既存コンボ（#{{id}}）と重複: {{starter}} / {{hitType}} / {{position}}（{{stepCount}}手）」で、始動技名・ヒット種別ラベル・ポジションラベルを解決して表示している。

### §3.2.1 表示文字列合成の検証（v1.1.0 新規、Q2 関連）

**△** 始動技名(`resolveStarterLabel`: `moves.find()` → `nameJa` または `技#id` フォールバック) ✅、ヒット種別ラベル(`labelFor(HIT_TYPE_LABELS, ...)`) ✅、ポジションラベル(`labelFor(POSITION_LABELS, ...)`) ✅。ただし以下が未対応:

- **キャラ名が表示されない**: `useCharacters` フックを使って `characterId` → `name_ja` を解決する実装がない。i18n 文言テンプレートに `{{character}}` が含まれていない。チェックリスト §3.2.1 が必須としている（後述 §軽微1）。
- **`opponentStance` / `opponentSize` が表示されない**: 構造化フィールドとして API から受け取っているが、i18n テンプレートに含まれず表示されない（後述 §軽微2）。
- **表示文字列テスト**: `DuplicateRealtimeWarning.test.tsx:44` のアサーションが `toContain("comboEditor.duplicateRealtime")` のみで、実際のラベル文字列（始動技名 "立ち強P"、"通常"、"画面中央"等）の検証が行われていない（後述 §軽微3）。

### §4.1 バックエンドテスト網羅性

**○** ハンドラテスト: `TestHandler_CheckDuplicate_200_WithDuplicates` が `ID`, `CharacterID`, `StepCount`, `Position` の4フィールドをアサーション済み。`StarterMoveID`, `OpponentStance`, `HitType`, `OpponentSize` のアサーションはない（後述 §軽微4）。サービス層テスト: `TestService_CheckDuplicate_NoDuplicate`・`WithDuplicate`・`ExcludeComboID` の3テストが追加され、`CharacterID` と `StepCount` も検証済み ✅。

### §4.2 フロントエンドテスト

**△** `DuplicateRealtimeWarning.test.tsx`: `moves` prop を受け取る形式になっており、テストが新しい型シグネチャに対応している ✅。ただしアサーション内容が i18n キー名の出現確認のみで、実際のラベル解決結果の検証が欠けている（§3.2.1 関連、後述 §軽微3）。

### §4.3 E2E 手順書

**△** 前回レビューから変更なし。curl レスポンスが progress-log.md に未添付（§重大1 参照）。

---

## 設計準拠性以外の指摘事項

1. **`CheckDuplicate` サービス層の構造化フィールド取得元**: `service.go:453-462` で `CharacterID`, `StarterMoveID`, `Position` 等を **入力値(`input`)** からコピーして返している。これは重複判定がこれらフィールドの完全一致フィルタで行われるため、候補コンボのフィールド値と入力値は同一であり、実用上問題ない。`StepCount` のみ候補コンボの値(`c.StepCount`)を使用しており、こちらも正しい。

2. **`useCheckDuplicate` の `setIsLoading(true)` タイミング**: 前回指摘と同様、デバウンスタイマー設定前に `setIsLoading(true)` が呼ばれる。`DuplicateRealtimeWarning` は `isLoading` を参照しないため UI 影響なし（継続中の低優先課題）。

---

## 推奨修正（優先度別）

- **高（M2完了前に修正必須）**:
  1. **curl レスポンスの progress-log.md への追記**（前回から継続）: 正常系(重複なし)・正常系(重複あり・構造化フィールド確認)・異常系(characterId 欠落→400)・excludeComboId 指定ケースの curl 実行結果を追記する。チェックリスト §9 の重大基準に該当。

- **中（M2-03 着手と並行可）**:
  2. **キャラ名の表示**: `DuplicateRealtimeWarning.tsx` に `useCharacters` フック(または `characters` prop)を追加して `characterId` → `name_ja` を解決し、i18n テンプレートに `{{character}}` プレースホルダを追加する。チェックリスト §3.2.1 要求事項。
  3. **ハンドラテストの全8フィールドアサーション**: `TestHandler_CheckDuplicate_200_WithDuplicates` に `StarterMoveID`, `OpponentStance`, `HitType`, `OpponentSize` のアサーションを追加する。
  4. **`UpdateMetadata` is_draft 切替時のサービス層テスト追加**: `TestService_UpdateMetadata_PromoteDraft_VAL_C02` のようなテストで、仮登録→本登録時に VAL-C02 エラーが返ること・昇格成功ケースを検証する。

- **低（将来対応）**:
  5. **`opponentStance` / `opponentSize` の表示追加**: i18n テンプレートに「相手スタンス」「相手サイズ」を追加して全6軸表示を完成させる。現状の表示内容でも実用上支障はないが、§3.2.1 との完全整合のため。
  6. **`DuplicateRealtimeWarning` テストで実ラベル検証**: i18n モックを設定し、`"立ち強P"` や `"通常"` 等の実際のラベル文字列がテキストに含まれることを検証する。
  7. **重複警告のリンクを新規タブで開く**: `<Link ... target="_blank" rel="noreferrer">` を追加（前回からの継続軽微課題）。

---

## 良かった点

1. **v1.1.0 追加要件への迅速対応**: 構造化フィールドへの変更・ラベル合成表示・`UpdateMetadataInput.IsDraft *bool` の3つの主要変更を全て正しく実装している。
2. **サービス層 CheckDuplicate テストの追加**: 実 DB を使った統合テスト(`service_test.go:400-503`)で `NoDuplicate`・`WithDuplicate`(CharacterID/StepCount検証込み)・`ExcludeComboID` の3ケースが網羅されており、前回の指摘が解消されている。
3. **始動技名の適切なフォールバック**: `resolveStarterLabel` が moves から `nameJa` を解決できない場合に `技#${id}` を表示するフォールバックを持っており、M2 段階での実装として堅牢。
4. **`DuplicateRealtimeWarning` の `moves` 受け渡し**: `ComboEditor` が既に保持している `movesQ.data` を `moves` として渡すことで、余分な API コールを発生させない効率的な実装。
5. **`CheckDuplicateResponse` の型定義整合**: `types.ts` の `CheckDuplicateResponse` が全8フィールドを正確に反映しており、フロントとバックエンドの型定義が一致している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `go test ./...` および `pnpm test` の実行結果は本レビュー時点では未確認（ローカル実行環境での確認を推奨）。

---

*以上*
