# CHANGE-085 addendum: セットプレイ提案の target 種別フィルタ／damage 既定除外（DES-005 反映範囲の拡張通知）

| 項目 | 内容 |
|------|------|
| 種別 | 製造→設計担当 への**反映範囲拡張の通知**(CLAUDE.md §8 準拠) |
| 関連 CHANGE | **CHANGE-085**(中央起票済み・DES-002〔提案エンドポイント〕＋DES-005〔提案 UI〕集約・マイグレ非消費) |
| 起票 | M19-01 製造担当 / 2026-07-24（実画面確認前レビュー対応） |
| ステータス | **通知**(実装済み・DES 本体反映は設計担当) |

---

## 1. 何を拡張したか

実画面確認前の開発者レビューを受け、指示書 §4.2（target 列挙規則）・§4.6.1（提案 UI）を**超える**以下を実装した。CHANGE-085 の DES-005／DES-002 反映時に**含めて反映**されたい（製造担当は DES 本体を編集していない）。

1. **target 種別フィルタ**: 提案 UI に「当てたい技の種別」チェックを追加。BE は `category` + `is_projectile`（+ rush は `original_move_id` の元技カテゴリ）から種別を算出:
   - `normal`(通常技)・`unique`(特殊技)・`special_projectile`(必殺技・弾=`is_projectile=true`) … **既定 ON**
   - `special`(必殺技・非弾)・`throw`(投げ) … 既定 OFF
   - **`normal_rush`(通常技ラッシュ)・`unique_rush`(特殊技ラッシュ)** … 既定 OFF（**開発者指示で追加・2026-07-24**。`rush_variant` を元技カテゴリで分類。rush 種別選択時は is_derived 除外を外す。フレーム基準はフレームメーター準拠＝実機確認前提）。
   - `rush_variant` の元 special・その他派生（target_combo 2nd hit 等）は **提供せず M19-02 へ留保**。
2. **damage 既定除外**: 既定で `damage>0` の技のみ target。`category=system`（ドライブパリィ等）は常に自動対象外。「ダメージ0の技も含める」トグルで opt-in（system は含めない）。
3. **提案生成の1ステップ化**: 条件指定→「提案を出す」まで生成しない（候補過多と truncated による有効候補の埋没を回避）。
4. **技単位指定**: 特定技ピッカー（`target_move_id`）。明示指定時は種別/damage/is_derived/is_aerial をバイパス。
5. **表示**: 提案行から「発生(S)」表示を削除（DTO の `s` は契約として保持）。
6. **ソート**: `n`(持続が深い順)／`target`(重ねる技順)。手数ソートを廃止。

## 2. API 変更（後方互換・追加のみ）

`GET /api/combos/:comboId/setplay-suggestions` に **query 追加**:
- `target_types`（カンマ列・省略時 `normal,unique,special_projectile`）
- `include_zero_damage`（bool・省略時 false）
- `sort` は `n|target`（`steps` を廃止）

`is_derived` に加え **`is_projectile` も BE の SELECT でのみ参照**（moves API 非露出・§2.3 例外の最小適用）。**スキーマ変更・マイグレ・新テーブル/列なし**。

## 3. 依頼事項

- CHANGE-085 の DES-005（提案 UI）反映に、上記「種別フィルタ・damage 既定除外・生成ステップ・技ピッカー・S 非表示・sort=n/target」を含めてください。
- DES-002 のエンドポイント記述に上記 query パラメータを追記してください。
- ラッシュ版 target の解禁は M19-02（startup_basis）で扱う旨を M19 overview 側に残してください。

---

*本書は CHANGE-085 の反映範囲拡張通知であり、製造は DES 本体を直接編集していません。*
