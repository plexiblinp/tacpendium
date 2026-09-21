# M1-04 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 文書ID | M1-04-REVIEW |
| バージョン | 1.0.0 |
| 対象指示書 | `docs/instructions/M1-04-presets-and-recipe-cache.md` |
| 用途 | 品質レビュー担当 Claude が独立レビュー時に使用するチェックリスト |

---

## 0. レビュー担当の作業手順

1. 本ファイル、対象指示書本体、CLAUDE.md、SUPP-001 §2.3 §7、DES-004 §5 を読む
2. M1-03 の実装(`internal/service/combo/`)も読み、TODO箇所が適切に埋められたか確認
3. 製造ターミナルで作成されたファイル群を `view` ツールで読む
4. 下記チェックリストに沿ってレビュー実施
5. レビュー結果を `docs/progress/m1-04-review.md` に出力

**重要ルール:**

- コードは一切変更しない
- ファイル作成は `docs/progress/m1-04-review.md` のみ
- Git 操作はしない
- 不明点があれば報告書に記載し、推測で進めない

---

## 1. 設計準拠性

- [ ] DES-004 §5 のエイリアス変換アルゴリズムが正しく実装されているか
- [ ] DES-004 §5.3 のフォールバック順(当該プリセット → official_ja_move → moves.code)が実装されているか
- [ ] SUPP-001 §7.1 の公開関数(ResolveComboRecipe / RecomputeComboCache / DeleteComboCache / RecomputePresetCache / DeletePresetCache / ComputeSingleCache)が実装されているか
- [ ] SUPP-001 §7.2 の呼出元責務通りに combo サービスが notation サービスを呼んでいるか
  - Create 時: RecomputeComboCache
  - UpdateWithKeyChange(キー変更編集): 旧 DeleteComboCache + 新 RecomputeComboCache
  - UpdateMetadata(メタデータ編集): 呼出不要(レシピ変更がないため)
  - Delete: DeleteComboCache
- [ ] M1-03 の TODO 箇所(combo service.go 内)が全て埋められているか
- [ ] 連結子の仮実装が指示書通りで、将来変更しやすい構造か(定数化など)

## 2. コード品質

- [ ] エラーラップが `fmt.Errorf("...: %w", err)` 形式
- [ ] `context.Context` がサービス層・リポジトリ層の全公開メソッドに引数として存在
- [ ] 公開関数に godoc コメント
- [ ] サービス層がリポジトリ層を介してDB操作している(直接 sql.DB を使っていない)
- [ ] DTO ↔ モデル変換が適切
- [ ] notation サービスのトランザクション境界が明確(combo サービスから渡される tx を使う形)

## 3. テスト網羅性

- [ ] resolver の主要ケース(通常 move、フォールバック1、フォールバック2、非技ステップ、flags 付き)がテストされているか
- [ ] cache の主要ケース(キャッシュなし時の計算+挿入、キャッシュあり時の取得、再計算、削除)がテストされているか
- [ ] combo サービス連携(Create 後の cache 確認、Delete 後の cache 削除確認)がテストされているか
- [ ] テストが他のテストに影響を与えないか(各テストで独立 DB)

## 4. パフォーマンス考慮

- [ ] RecomputePresetCache の同期処理が、リュウのコンボ件数(M1段階では数件想定)で問題なく完了する実装か
- [ ] combos.recipe_cache カラムへの SELECT がコンボIDで直接アクセスされる(主キー検索のため追加インデックス不要)
- [ ] recipe_cache JSON のパース失敗時にコンボ取得自体が失敗しないか(警告ログのみで処理継続)

## 5. 案A(combos.recipe_cache カラム)準拠の確認

- [ ] recipe_cache が **combos テーブルのカラム**(TEXT、JSON 文字列)として実装されているか(別テーブル化されていないか)
- [ ] JSON のキー型が `preset_id` の文字列化整数(`"1"`, `"2"`...)で統一されているか
- [ ] `RecomputeComboCache` が JSON 全体を組み立てて UPDATE する実装か(部分更新ではなく)
- [ ] `DeleteComboCache` が `recipe_cache = NULL` への UPDATE で実装されているか(行削除ではない)
- [ ] recipe_cache の UPDATE で `version` カラムをインクリメントしていないか(キャッシュ更新は楽観的排他の対象外)

## 6. 禁止事項

- [ ] `localStorage` 等のフロント禁止項目に触れていないか
- [ ] `console.log` / `fmt.Println` の本番コード残存がないか
- [ ] Git 操作の Bash 実行がないか
- [ ] 設計書に記載のない機能の追加がないか

## 7. 統合確認

- [ ] `cmd/combomgr/main.go` の DI が正しく更新されているか(notation サービスを combo サービスに渡す)
- [ ] preset ルートが `/api/presets` で登録されているか
- [ ] M1-03 の既存テストが引き続き通過するか(combo サービスの修正によりテストが壊れていないか)
- [ ] M1-03 の combo リポジトリへの recipe_cache 操作メソッド追加が、既存メソッドを壊していないか

---

## 7. 出力フォーマット(`docs/progress/m1-04-review.md`)

```markdown
# M1-04 レビュー報告書

## 総評
(全体所感を3〜5行)

## 設計準拠性レビュー結果
| チェック項目 | 結果 | 詳細 |
|-------------|------|------|

## コード品質レビュー結果

## テスト網羅性

## パフォーマンス考慮

## 禁止事項違反の有無

## 統合確認(M1-03 連携)

## 推奨修正(優先度別)
- 高(M1 完了前に修正必須):
- 中(並行可):
- 低(将来対応):

## 良かった点

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際のパフォーマンス測定・大規模データでの動作確認は別途実施が必要。
```

---

*以上*
