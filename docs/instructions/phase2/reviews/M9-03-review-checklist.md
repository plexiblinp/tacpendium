# M9-03 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `M9-03-instruction.md` v1.0.2（FR703 手動修正・moves 編集グリッド・ラッシュ版生成） |
| 対象指示書ID | M9-03 |
| レビューモデル | Sonnet 4.6（model-allocation v1.11.0） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン）/ 2026-06-14 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-14 | 初版（指示書 v1.0.0 と対） |
| 1.0.1 | 2026-06-14 | M9-03 Plan Mode 4 決定（CHANGE-032）に追従。§0.1 前提ゲートに CHANGE-032 + 確定結果、§1.1 に GET 単一フル・フル返却・楽観ロックなし、§1.2 に rush 重複 409、§1.3 に name_ja 表示のみ。対象指示書 v1.0.2 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: `M9-03-instruction.md` v1.0.2、DES-002 v1.15.0 §4.2、DES-003 v1.20.0 §3.3、DES-006、CHANGE-030（raw_data 確定キー）、CHANGE-031（編集/rush エンドポイント・編集グリッド画面）、code-facts §2/§4/§7/§8/§9。
- **前提ゲートの確認**: (1) **CHANGE-030 反映済み**（raw_data キー構造。M9-03 §4.5 が依存）。(2) **CHANGE-031 + CHANGE-032 反映済み**（編集/rush/単一フル GET エンドポイント・画面18・編集系挙動。実装コミットの前提）。(3) **M9-02 実機ゲート（B-1/2/3/5/6）通過済み**（M9-03 は取込結果に作用）。いずれか未了なら、その時点で重大（前提未充足の実装）。
- **Plan Mode 5 項目は確定済み（2026-06-14、CHANGE-032）**: 画面構成=新規画面18 / 編集 API=PATCH ポインタ・フル返却・**楽観ロックなし（last-write-wins）**・編集時フルは **`GET /api/moves/:id`** / rush 重複=**409 + 既存 id** / notes=notes_tool のみ・**name_ja 表示のみ（編集スコープ外）** / 検証=要確認のまま保存可・enum/FK/NOT NULL 拒否。実装がこの確定どおりかを §1 で照合する。
- **Plan Mode 着手前確認結果の確認（必須。playbook §8.4.4）**: 指示書 §3.4 の 5 項目（画面構成 / 編集 API 形・version / rush 対象判定・重複 / notes 編集対象 / 検証強度）に Plan Mode 質問書 + 開発者回答が残っているか。

### 0.2 レビューの基本姿勢

- 機械的チェック（§1〜§4・§6・§7）に加え、設計意図（§5）の精神に沿うかを確認する。
- 症状のレイヤ ≠ 真因のレイヤに注意（フロント/BE を決めつけない）。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。重大は完了承認を妨げる。

---

## 1. 設計書本体との照合（retro R-01、最重要）

### 1.1 編集エンドポイント（DES-002 §4.2＝CHANGE-031、指示書 §4.1）

- [ ] `PATCH /api/moves/:id` が新設され、フィールド部分更新（ポインタ・nil 不変更、`PATCH /api/combos/:id` と同方式）で実装されているか。
- [ ] 対象フィールド（total / startup / active / on_hit / on_block / drive_gauge_* / super_art_gauge_increase / damage / properties / is_aerial / combo_scaling / raw_data notes 付記）が更新できるか。
- [ ] total は手動入力値を保存（取込時の自動算術と別系統）か。
- [ ] **`GET /api/moves/:id`（単一フル）が新設**され、narrow 一覧が返さない 6 フィールド（damage / combo_scaling / drive_gauge_increase / drive_gauge_decrease_punish / super_art_gauge_increase / raw_data）+ name_ja を返すか（編集時取得用。CHANGE-032）。
- [ ] `PATCH`/`rush-variant` が**更新後/生成後のフル move を返す**か（in-place 同期。CHANGE-032）。
- [ ] **楽観ロックを入れていない**（last-write-wins、moves に version 列を追加していない＝スキーマ不変）か（CHANGE-032。updated_at ベースの compare-on-write は可）。

### 1.2 ラッシュ版生成（DES-003 §3.3 L287、DES-002 §4.2＝CHANGE-031/032、指示書 §4.2）

- [ ] `POST /api/moves/:id/rush-variant` が、`category ∈ {normal, unique}` ∧ `is_aerial = false` を**サーバ側で強制**し、違反を 400 + 理由で返すか。
- [ ] 生成内容が `code = rush_<元技code>`・`category = rush_variant`・`original_move_id = :id`・フレーム/補正は元技コピーか。
- [ ] **同 original_move_id（= `rush_<元技code>`）の重複時に 409 Conflict + 既存 id を返す**か（事前チェックで生制約エラーを漏らさない。CHANGE-032）。

### 1.3 is_aerial トグル・投げ補正（DES-003 §3.3 L279、DES-002 §7.5 L422、指示書 §4.3/§4.4）

- [ ] is_aerial を `PATCH` で更新でき、トグル後にラッシュ版生成可否（§1.2）が連動するか。
- [ ] 通常投げ 3 件目以降（extra_throw）の **is_aerial を `PATCH` で補正**できるか（実例 dhalsim `yoga_splash`）。
- [ ] **name_ja（official_ja_move エイリアス）は表示のみで編集不可**か（CHANGE-032。エイリアス編集＝命名補正は M9-03 スコープ外。preset_aliases 書込経路を作っていないこと）。

### 1.4 notes 付記編集（CHANGE-030 raw_data キー、指示書 §4.5）

- [ ] raw_data の `notes_tool`（`【ツール付記】` ブロック）を編集でき、`notes`（原文）は表示のみか（Plan Mode-4）。

### 1.5 検証（DES-006、指示書 §4.7）

- [ ] 保存時に型・制約検証（enum 値域・FK・NOT NULL）。要確認状態（total NULL 等）のまま保存は許容するか（手動補正の段階性）。

---

## 2. API 整合性（retro R-08）

- [ ] 編集/生成のレスポンス型が一覧用と詳細用で適切に分離され流用していないか（retro §3）。
- [ ] 編集/生成成功後、moves 系 queryKey（`["moves","by-character",characterId]`）が invalidate されるか（retro §4。code-facts §2 規約）。
- [ ] ステータスコード契約（成功/400 規則違反/404）がテストで担保されているか。

---

## 3. フロントエンドの動作仕様（指示書 §4.6、DES-005 §5.18＝CHANGE-031）

- [ ] moves 編集グリッド画面（画面18）が新設され、router.tsx 登録・共通ナビ整合があるか。取込プレビュー（画面17）とは別画面・別導線か。
- [ ] キャラ選択 → グリッド表示（要確認強調＝WarningCode）→ インライン編集・is_aerial トグル・ラッシュ生成ボタン（対象カテゴリのみ活性）・notes 付記編集 → 保存、が動作するか。
- [ ] CSV/入力値を式・コマンドとして解釈せず描画エスケープ（無害化）か。
- [ ] 大量行（数百行）のテーブル描画・横スクロール（M9-02 B-4 視覚確認の引き取り）。
- [ ] 既存 UI ライブラリ（shadcn/ui）・combo 編集系パターンを踏襲しているか。

---

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 バックエンド（Go test、指示書 §5.1）
- [ ] `PATCH`: 部分更新（指定のみ変更・nil 不変更）、enum 値域違反拒否、total 手動値保存、raw_data notes_tool 更新。
- [ ] ラッシュ生成: 対象（normal/unique ∧ is_aerial=false）で生成、対象外（special/throw/is_aerial=true）で 400、重複時の確定挙動。
- [ ] 投げ 3 件目補正: extra_throw 行の is_aerial・エイリアス更新。
- [ ] **model.Move / MoveListItem 共有フィールド一致テスト（§4.8、M8-A4 乖離ガード）**。

### 4.2 フロント（Vitest）
- [ ] インライン編集・is_aerial トグル・ラッシュ生成ボタン活性条件・要確認強調・保存。

### 4.3 E2E（seed 非依存 self-contained）
- [ ] 編集（total 手動入力）→ 保存 → `GET /api/moves` 反映。normal 技からラッシュ版生成 → グリッドに rush_variant 出現。
- [ ] 既存 combo-crud / 取込 spec が通過。視覚/レスポンシブは手動継続。

---

## 5. 設計意図との整合

- [ ] **手動補正は寛容**: 要確認状態のまま保存可（段階的修正を許す）。ただし enum/FK/NOT NULL は守る（§4.7 の思想）。
- [ ] **ラッシュ規則はサーバ強制**: クライアント任せにせず category/is_aerial 条件をサーバで判定（§4.2）。
- [ ] **GET 読取路は不変・乖離ガードで代替**: model.Move 集約は行わず（開発者確定）、共有フィールド一致テストで同期漏れを検出（§4.8 の思想）。
- [ ] **取込プレビューと編集グリッドは別系統**: dry-run 表示（画面17）と永続編集（画面18）を混同しない設計か。

---

## 6. コード品質・規約遵守

- [ ] 禁則表現（曖昧語依存）になっていないか（playbook §4.1）。
- [ ] JSON タグ・DTO 型が camelCase 統一か（SUPP §6.4）。
- [ ] enum 定数のバックエンド↔フロント同期（category 等）。
- [ ] ファイル分割・命名が既存パターン（code-facts §2/§4）に整合するか。

---

## 7. 既存挙動の温存（非破壊性）

- [ ] **`GET /api/moves` の API 契約（MoveResponse）が不変**か（code-facts §7。編集 API 追加で変えていないか）。
- [ ] 取込パイプライン（FR704、画面17）・コンボ CRUD（FR405）に影響していないか。
- [ ] moves スキーマに列を追加していないか（original_move_id / is_aerial は既存列）。
- [ ] 既存 combo-crud / 取込 spec が引き続き通過するか。

---

## 8. ドキュメント・進捗ログ

- [ ] 編集/rush エンドポイント・編集グリッド画面の DES 追記は**設計担当が CHANGE-031 で対応**。製造担当が DES-002/DES-005 を直接編集していないか。
- [ ] 完了報告に Plan Mode 確定事項（画面構成・編集 API 形・rush 重複挙動・検証強度）、テストケース数を含むか（指示書 §7.5）。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）

- 前提ゲート（CHANGE-030 反映 / CHANGE-031 承認 / M9-02 実機ゲート）未充足のまま実装。
- Plan Mode 5 項目のいずれかが未確認のまま実装（推測実装）。
- `GET /api/moves` の API 契約（MoveResponse）が変わっている。
- ラッシュ版生成の category/is_aerial 条件をサーバで強制していない（クライアント任せ）。
- model.Move を勝手に集約し GET 読取路を変更している（開発者確定「読取路不変」違反）／乖離ガード不在。
- 編集保存で型・制約（enum/FK/NOT NULL）を検証していない。

## 10. 軽微な問題の判定基準（持ち越し許容）

- 要確認強調・グリッドの視覚表現の細部。
- ラッシュ重複時メッセージ文言。
- notes 付記編集 UI のレイアウト微調整。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / 設計書 DES-00N §Y に対し実装が Z。意図確認したい」の形で根拠節併記。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の前提ゲート + Plan Mode 5 項目が揃っている。§10 軽微は持ち越し可。

---

*以上、M9-03 レビューチェックリスト v1.0.1*
