# change-report-063: CHANGE-063 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-063（M16-03 実装反映＝起き攻め正規化・シミー 4 区分化・打撃重ね・G-h） |
| 反映日 | 2026-07-05 |
| 反映担当 | 設計担当 Claude（M16 期） |
| 起票文書 | `docs/change-notes/CHANGE-063-notification.md` |
| ステータス | **反映（DES 改訂を適用・commit は開発者）**。§7 確認事項＝A-2 は暫定案（詳細/比較の表示非対称を明記）で反映・B-4 CSV 列名は本命名で確定 |
| 背景 | M16-03（G-h）実装完了・重大 0/高優先 0。Plan Mode 3 決定（語彙ベースライン/available sparse/VAL-C11 uniform）。起き攻めは dup/recipe 非対象（非回帰確認済み）。 |

---

## 1. 反映したファイル（旧→新）

| ファイル | 旧 → 新 |
|--------|---------|
| DES-003 データモデル | v1.25.0 → **v1.26.0**（§3.4 起き攻め正規化・sparse・語彙・tri-state 縮約・列挙値） |
| DES-005 画面設計 | v2.36.0 → **v2.37.0**（§5.6 詳細ラベル一覧・§5.7 正規化 editor・§5.8 比較 12 変種・§5.13 出力・ラベル正典） |
| DES-002 アーキテクチャ | v1.29.0 → **v1.30.0**（§7.6 CSV 新 6 列・§4.2 相当 PATCH replace-set） |
| DES-006 バリデーション | v1.16.0 → **v1.17.0**（VAL-C11 全 attack_type 一様適用） |

REQ-001 / DES-001 / DES-004 / SUPP-001 は**変更なし**。

## 2. 修正概要

- **DES-003 §3.4**: 6 bool 撤去→`combo_oki_options`（`id, combo_id FK CASCADE, attack_type, tech_type, uses_dr, UNIQUE(combo_id,attack_type,tech_type,uses_dr)`）。**available は sparse（列なし・行存在＝利用可能）＝将来スケッチの `available` 列を是正**。語彙リテラル（`throw_meaty`/`shimmy`/`strike_meaty` × `neutral_tech`/`back_tech` × `uses_dr`）を DB/API/CSV/FE の**正典契約値**として固定。tri-state→presence 縮約（false/null 非区別）。knockdown_advantage 残置。
- **DES-005 §5.6/§5.7/§5.8/§5.13**: 詳細＝利用可能ラベル一覧のみ／editor＝正規化オプション UI（シミー ドライブラッシュ・打撃重ね）／比較・出力＝12 変種 ✓/✗。ラベル正典＝`web/src/constants/oki.ts` の `okiOptionLabel()`（「ドライブラッシュ」正式名称・旧 en「DR」略記撤去）。test-id `combo-editor-oki-<attackType>-<techType>-<dr|nogauge>`。**A-2＝詳細（利用可能分）と比較/出力（全変種）の表示非対称を明記**（暫定案採用）。
- **DES-002 §7.6・§4.2 相当**: CSV 新 6 列（`oki_shimmy_*_tech_dr`×2・`oki_strike_meaty_*`×4）を任意列末尾追加（旧 CSV 後方互換）。**PATCH は起き攻めを replace-set（`okiOptions *[]OkiOptionDTO`・全置換）＝per-field トライステート対象外**と明記。
- **DES-006 VAL-C11**: 全 attack_type へ一様適用（uniform）。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| dup（DuplicateKey）・recipe_hash・recipe_cache | **不変** | 起き攻めは非対象（`RecomputeComboCache` 非呼出・非回帰確認済み・§C-5） |
| knockdown_advantage | **残置・不変** | 正規化対象外 |
| REQ/DES-001/004・SUPP-001 | **変更なし** | 正規化＋表示/CSV/VAL 追従に閉じる |
| code-facts | **本 CHANGE では変更せず＝別途再生成** | §10 stale（000021 まで）・§8 の 6 oki bool→オプション配列＝`/regen_code_facts`（開発者実行・§5） |

## 4. 整合性チェック結果

- **正典一貫**: DES-003 §3.4（語彙リテラル・sparse）↔ DES-005（`okiOptionLabel` 表示）↔ DES-002 §7.6（CSV 列＝同リテラル）↔ DES-006 VAL-C11（同 attack_type）が一致。
- **ドライブラッシュ正式名称**: DES-005 §5.6 正典（「DR」略記排除）に整合（旧 en i18n の「DR」撤去）。
- **CSV 後方互換**: 新 6 列は任意列（CHANGE-061 の DES-002 §7.6 パターン踏襲）＝旧 CSV 非破壊。
- **PATCH 契約**: replace-set 明記で「per-field 更新できる」誤解を排除。
- **dup/recipe 非対象**: recipe_hash 不変が Go テストで確認済み。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | **063 反映（次 064）**・§改訂表 4 行（DES-003 v1.25→1.26・DES-005 v2.36→2.37・DES-002 v1.29→1.30・DES-006 v1.16→1.17）・版ログ |
| **code-facts 再生成** | **`/regen_code_facts`（開発者実行）**＝§10 を 000021 まで・§8 を新オプション構造へ更新（C-4） |
| retrospective-log / digest §5 | C-3（ADD/正規化系 down の破壊性＝新変種喪失）を TMP 記録済み（log 転記→再蒸留） |
| M16-06 | 起き攻めラベルは本 CHANGE で `okiOptionLabel` 正典化済み＝M16-06 対象外（M16-06 は始動/消費ラベル・エクスポート消費のみ） |

## 6. 残ゲート（開発者）

- 本 CHANGE（DES-003 §3.4・DES-005 §5.6/§5.7/§5.8/§5.13・DES-002 §7.6/§4.2・DES-006 VAL-C11）の承認・commit/push。
- **`/regen_code_facts`**（code-facts 再生成）・転記後の **`/retrospective-digest-update`**。

---

*以上、change-report-063。配置 `docs/change-notes/change-report-063.md`。A-2（表示非対称）は暫定案＝明記で反映。B-4 CSV 列名は本命名で確定。code-facts は別途 `/regen_code_facts` で再生成。*
