# M9-04 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `M9-04-instruction.md` v1.0.0（FR703 編集グリッド仕上げ・要確認再導出・ラッシュボタン非活性化・表示順） |
| 対象指示書ID | M9-04 |
| レビューモデル | Sonnet 4.6（model-allocation v1.12.0） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン）/ 2026-06-14 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-14 | 初版（指示書 v1.0.0 と対） |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備
- 必読: `M9-04-instruction.md` v1.0.1、M9-overview §12（M9-04 設計）、DES-002 v1.17.0 §4.2、DES-005 v2.18.0 §5.17/§5.18、DES-003 v1.20.0 §3.3、取込プレビューの WarningCode 判定実装。
- **前提ゲート**: (1) M9-03 検収完了。(2) **CHANGE-034 反映済み**（MoveResponse warnings 加算 + DES-005 §5.18）＝完了承認の前提。(3) Plan Mode §3.4 の 2 項目（接地点 / 判定一致・extra_throw 文脈）に質問書 + 開発者回答が残っているか。

### 0.2 基本姿勢
- 機械チェック（§1〜§4・§6・§7）+ 設計意図（§5）の精神。

### 0.3 報告フォーマット
- 各節「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」。

---

## 1. 設計書本体との照合（最重要）

### 1.1 要確認再導出（指示書 §4.1、DES-002 §4.2＝CHANGE-034、DES-005 §5.17）
- [ ] `MoveResponse` に `warnings: WarningCode[]`（空配列可）が**加算**され、`GET /api/moves` 各行でサーバ算出されているか。
- [ ] 算出種別が `total_null` / `unknown_properties` / `unknown_combo_scaling_key` / `extra_throw` を網羅するか（recovery_word は total_null に吸収＝再導出不可で正しい）。
- [ ] `unknown_combo_scaling_key` が combo_scaling の正準キー（initial/combo/immediate/multiplier_scaling、DES-003 §3.3）外を検出するか。
- [ ] `unknown_properties` がホワイトリスト（high/mid/low/throw/projectile/air_projectile）外を検出するか。
- [ ] `extra_throw` がキャラ内の通常投げ 3 件目以降に付くか（キャラ単位の集合で算出）。

### 1.2 判定ロジックの一致（指示書 §3.4-2 / §4.1）
- [ ] 取込プレビュー（§5.17）の WarningCode 判定と編集グリッドの再導出が**同一共有実装**（または同一入力で同一結果のパリティ）になっているか。二重実装による乖離が無いか。

### 1.3 表示順（指示書 §4.3、DES-005 §5.18＝CHANGE-034）
- [ ] 表示順並び替えが**表示のみ**で、DB の並び・主キーを変更しないか（保存/API を呼ばないか）。

---

## 2. API 整合性
- [ ] `warnings` 加算が**後方互換**（既存 consumer に影響なし）か。`GET /api/moves` の既存フィールド（MoveResponse）が不変か。
- [ ] `PATCH`/`rush-variant`/`GET /api/moves/:id` の既存契約（CHANGE-031/032）が不変か。

---

## 3. フロントエンドの動作仕様
- [ ] 編集グリッドが warnings 全種を強調（total_null 以外も）。取込プレビュー（§5.17）と同じ WarningCode 表現か。`moveNeedsConfirmation` が warnings ベースか。
- [ ] rush_variant（`code = rush_<元技code>`）が既存の行で「ラッシュ版」ボタンが disabled か。既存活性条件（対象カテゴリ ∧ 非空中、dirty ガード）に「未生成」を AND しているか。後段 409 も保険で残っているか。
- [ ] 表示順並び替え（列ソート/ドラッグ）が表示のみで動作するか。

---

## 4. テストの妥当性（ケース数で確認）
- [ ] Go: warnings 各種別の付与 + **取込プレビュー判定とのパリティ** + extra_throw のキャラ内採番 + warnings 加算後の既存フィールド不変。
- [ ] Vitest: warnings 全種強調 / rush ボタン disabled / 表示ソートが API を呼ばない。
- [ ] E2E: 既存 moves-edit / combo-crud / 取込 spec が通過。

---

## 5. 設計意図との整合
- [ ] **判定は単一実装**（取込プレビューと編集グリッドで同じ WarningCode 判定）＝二重実装の乖離防止（§4.1 の趣旨）。
- [ ] **warnings は読取時算出**（moves に永続化しない＝スキーマ不変。バックログ B-4 案2）。
- [ ] **表示順は表示のみ**（永続データ不変）。

---

## 6. コード品質・規約
- [ ] JSON タグ・DTO 型が camelCase 統一（SUPP §6.4）。enum（WarningCode）のバックエンド↔フロント同期。
- [ ] 既存パターン（code-facts §2/§4）に整合。

---

## 7. 既存挙動の温存（非破壊性）
- [ ] **`GET /api/moves` の既存契約（MoveResponse の warnings 以外）が不変**か。
- [ ] moves スキーマに列を追加していないか（warnings は非永続・算出）。
- [ ] 取込パイプライン（FR704）・編集 API（M9-03）・コンボ CRUD に影響していないか。
- [ ] 既存 moves-edit / combo-crud / 取込 spec が通過するか。

---

## 8. ドキュメント
- [ ] `MoveResponse.warnings` 追加・§5.18 拡張の DES 追記は**設計担当が CHANGE-034 で対応**。製造担当が DES-002/DES-005 を直接編集していないか。
- [ ] 完了報告に Plan Mode 確定（接地点・判定一致）とテストケース数を含むか。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）
- 前提ゲート（CHANGE-034 反映 / Plan Mode 2 項目）未充足のまま実装。
- `GET /api/moves` の既存フィールド（warnings 以外）が変わっている。
- warnings 判定が取込プレビューと不一致（二重実装で乖離）。
- 表示順並び替えが DB の並び・主キーを変更している。
- moves スキーマに列追加している（warnings は非永続のはず）。

## 10. 軽微な問題の判定基準（持ち越し許容）
- warnings 強調・表示ソート UI の細部。ラッシュボタン非活性のツールチップ文言。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / DES-00N §Y に対し実装が Z。意図確認したい」の形で根拠節併記。

## 12. レビュー完了の判定
- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の前提ゲート + Plan Mode 2 項目が揃っている。§10 軽微は持ち越し可。

---

*以上、M9-04 レビューチェックリスト v1.0.0*
