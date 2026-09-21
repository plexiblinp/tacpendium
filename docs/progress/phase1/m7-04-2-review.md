# M7-04 レビュー報告書

## 総評

M7-04-2 の実装は全体的に堅実。マイグレーション構造・custom_states JSON・down SQL の依存関係処理はいずれも高い品質で M1-02 パターンを正確に踏襲している。スキーマ変更なし(CHANGE 不要)の判断も正しい。

**完了承認は可能**だが、指示書 §5.1 / §0.3 で明示的に必須とされた「非リュウ作成パスの API/統合テスト 1 本」が未追加であり、M7-05 着手前の修正を推奨する。これは ComboEditor の UI を作らない代わりに custom_states キャラの作成パス耐久を担保する唯一の手段として指示書が位置づけていたもの。

チェックリスト §9 の重大問題基準には該当しない。ビルド・テスト・スキーマ整合・マイグレーション冪等性・回帰なしは全て確認できる。

---

## 設計準拠性レビュー結果

### §1 seed の整合

| 観点 | 結果 | 備考 |
|------|------|------|
| マイグレーション連番(000009〜000012、過去改変なし) | ◎ | 000008 の次から正しく連番 |
| characters 3 件(code/name_ja/name_en/game_id) | ◎ | SELECT-FROM-CROSS-JOIN で game_id を動的解決 |
| UNIQUE(game_id, code) 違反なし | ◎ | `aki`/`jamie`/`guile` は既存と重複なし |
| custom_states: AKI(毒 = opponent/flag/boolean) | ◎ | DES-003 §3.2 `poison` 正準例と完全一致 |
| custom_states: ジェイミー(drunk_level = composite) | ◎ | DES-003 §3.2 `drunk_level` 正準例と完全一致 |
| custom_states: ガイル = NULL | ◎ | |
| moves: 通常技18+システム6 を 3 キャラ一括 | ◎ | 命名規則 DES-004 §2.1 準拠 |
| moves: キャラ固有 unique/special/super_art | ◎ | 数値カラムは全 NULL(リュウ seed 踏襲) |
| preset_aliases: official_ja_move 分のみ投入 | ◎ | 他 4 プリセットは空のまま(000005 不改変) |
| down マイグレーション: 各テーブルから 3 キャラ分削除 | ◎ | ON DELETE CASCADE を活用、000009 の down は characters のみ |
| up → down → up 冪等性 | ◎ | progress-log に検証記録あり |
| 000001〜000008 不改変 | ◎ | |
| recipe_cache 計算(000012) | ◎ | group_concat + json_quote で全プリセット ID に同一文字列。map[string]string 型と整合 |
| starter_move_id の更新 | ◎ | step_order=1 の move_id で UPDATE |

**grep による機械確認:**
```
grep "gauge_consumed" migrations/000012_*.sql → 0件(削除済みカラムを再導入していない)
grep "corner_self_near\|any" internal/model/combo.go → PositionCornerSelfNear ✓ / OpponentStanceAny ✓
```

### §2 A 系統: プリセットフォールバック

| 観点 | 結果 | 備考 |
|------|------|------|
| 000005 不改変 | ◎ | |
| 空 4 プリセットのエイリアス本格整備なし | ◎ | |
| フォールバック動作確認 | ○ | progress-log に実機 API 確認記録あり(srk/numeric_ja → official_ja_move と同一文字列) |

### §3 C 系統: スキーマ耐久

| 観点 | 結果 | 備考 |
|------|------|------|
| 各キャラ 12 件 × 3 = 36 件の seed コンボ | ◎ | migrate_test で件数アサーション |
| custom_states エンドツーエンド(API ラウンドトリップ) | ○ | 実機 API スモークで確認(progress-log 記載) |
| スキーマ変更なし | ◎ | CHANGE 起票不要を正しく判断 |

### §4 M7-15 持ち越し

| 観点 | 結果 | 備考 |
|------|------|------|
| B-2/B-4 動作確認 | ○ | progress-log に記録。ただし実機確認のため E2E の機械的証跡なし |

### §5 スキーマ非変更

| 観点 | 結果 | 備考 |
|------|------|------|
| ALTER TABLE 等のスキーマ変更なし | ◎ | 000009〜000012 は全て INSERT/UPDATE のみ |
| custom_states は既存 JSON 列に収まる | ◎ | |

### §6 コード品質

| 観点 | 結果 | 備考 |
|------|------|------|
| ComboListFilters.tsx の動的キャラリスト対応 | ◎ | useCharacters + フォールバック option |
| ComboDetailHeader.tsx の useCharacterName 対応 | ◎ | |
| MyComboPage.tsx の characterId state 化 + CharacterSelector 実配線 | ◎ | キャラ切替時に選択モード解除 |
| ComboListFilters.test.tsx: QueryClientProvider ラップ | ◎ | |
| countCombos ヘルパ: 耐久 seed 除外 | ◎ | |

### §7 既存挙動の温存

| 観点 | 結果 | 備考 |
|------|------|------|
| リュウ seed(000003/000004/000006)不改変 | ◎ | |
| go test パス | ◎ | progress-log 記録 |
| npm test パス(79ファイル/427テスト) | ◎ | progress-log 記録 |
| CHANGE-019 で削除したゲージ関連の不復活 | ◎ | grep 確認済み |

### §8 ドキュメント

| 観点 | 結果 | 備考 |
|------|------|------|
| progress-log.md に M7-04-2 セクション追記 | ◎ | Plan Mode 確定事項・系統別実装・検証結果・開発者依頼を記録 |
| 設計書本体への変更なし | ◎ | |

---

## 設計準拠性以外の指摘事項

### 指摘 1: `html_work/` と `work_html/` の表記不一致

- **場所**: `.gitignore` L70、`migrations/000009` コメント L4、`migrations/000010` コメント L2
- **事実**: 指示書は `html_work/` と記載しているが、実体のフォルダは `work_html/`。`.gitignore` も `work_html/` で除外。マイグレーション SQL コメントも `work_html/` を参照。
- **評価**: 製造担当が progress-log に差異を正直に記録しており、seed SQL 自体の内容は HTML から正しく抽出されている。**指示書記述ミス**が原因であり、実装の正確性には影響なし。軽微。

### 指摘 2: `ComboDetailHeader.tsx` のフォールバック文言が "リュウ" 固有

- **場所**: `web/src/features/combo/components/ComboDetailHeader.tsx` L25
- **コード**: `const displayName = characterName || t("comboDetail.characterRyu");`
- **問題**: characterId が解決できない時のフォールバックが「リュウ」固定。AKI/ジェイミー/ガイルのコンボ詳細でロード遅延が起きた場合に「リュウ」と表示される。ただし useCharacters は TanStack Query でキャッシュされるため実用上は短命。
- **評価**: UX の軽微な問題。フェーズ 2 で i18n のフォールバック文言整備時に修正が望ましい。

---

## 推奨修正（優先度別）

### 高（M7 完了前に修正必須）

1. **非リュウ作成パスの API/統合テスト追加**
   - 場所: `internal/service/combo/service_test.go`
   - 要件: 指示書 §5.1 / §0.3 で明示: AKI または ジェイミーのコンボを `svc.Create()` で作成し、(a) エラーなし・`combo.ID > 0`、(b) recipe_cache が全プリセット分設定されること、を確認
   - 理由: ComboEditor のキャラ選択 UI を作らない代わりの唯一の作成パス耐久担保手段として指示書が明示した要件。progress-log の「テスト件数増減 Go ±0」は本要件が未実施であることを示している
   - 実装例イメージ:
     ```go
     func TestService_Create_NonRyu_CustomStatesCharacter_OK(t *testing.T) {
         db, svc := newSvc(t)
         // AKI (character_id = 2) の任意の技 2 つで CreateInput を組む
         // svc.Create → エラーなし + recipe_cache 非 nil を確認
     }
     ```

### 中（M7-05 着手と並行可）

2. **migrate_test.go に custom_states JSON 有効性の確認を追加**
   - 場所: `internal/infra/migration/migrate_test.go`
   - 内容: `SELECT count(*) FROM characters WHERE code IN ('aki','jamie') AND json_valid(custom_states)` = 2 のアサーションを `TestRun_SeedRowCounts` に追加
   - 理由: 現状は `IS NOT NULL AND != ''` のみで JSON 構造の妥当性を保証していない

3. **CharacterSelector.test.tsx に複数キャラ時の動作テストを追加**
   - 場所: `web/src/features/mycombo/components/CharacterSelector.test.tsx`
   - 内容: 2 キャラ返却時に select が enabled になること / onChange が呼ばれることの確認
   - 理由: MyComboPage.tsx で onChange 実配線が変更されたが、CharacterSelector のテストは単一キャラ(disabled 状態)のみ

### 低（将来対応）

4. `ComboDetailHeader.tsx` のフォールバック文言を汎用の "不明" 表記 (`t("common.unknown")` 等) に変更

---

## 良かった点

- **DES-003 §3.2 正準例との完全一致**: AKI・ジェイミーの `custom_states` JSON が設計書の example と一字一句一致。指示書の構造定義を正確に読み込んだ証拠
- **down マイグレーションの精巧な設計**: 000009 の down は characters のみを削除し、子テーブル(moves/preset_aliases/combos/combo_steps)への連鎖は ON DELETE CASCADE または後続 down に委任。依存関係の理解が高い
- **recipe_cache のフォールバック対応**: 000012 が全プリセット ID に official_ja_move 由来の同一テキストを設定することで、空プリセットのフォールバック動作をシードレベルで表現している
- **テスト修正の対応が的確**: `ComboListFilters.test.tsx` の `QueryClientProvider` ラップ、`countCombos` の耐久 seed 除外、いずれも「既存テストを壊さない最小修正」の原則に沿っている
- **progress-log の正直な記録**: `html_work/` vs `work_html/` の表記差異・テスト件数増減・スキーマ変更なしの確認、全て透明に記録されており次担当が文脈を把握しやすい

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス(NFR001 100ms)・実機目視テスト(プリセット切替の見た目・E2E シナリオ B-2/B-4 等)は別途実施が必要。
- 実機テストは progress-log に記録された API スモーク(実機 API で 4 キャラ + フォールバック確認)が唯一の証跡であり、本格 E2E は開発者実機での確認を依頼。
