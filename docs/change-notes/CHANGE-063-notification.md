# CHANGE-063 通知書: M16-03 実装反映（起き攻めの正規化＝`combo_oki_options`・シミー 4 区分化・打撃重ね・G-h）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-063 |
| サブマイルストーン | M16-03（承認ゲート G-h・Plan Mode ExitPlanMode で取得済み） |
| 起票日 | 2026-07-05 |
| 起票者 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 承認者 | 開発者（M16-03 実装完了・重大 0/高優先 0〔fresh subagent レビュー〕・`docs/progress/phase3/M16-03-report.md`＋伝達メモ `20260705-M16-03-design-handover.md`。Plan Mode で 3 決定＝語彙ベースライン/available sparse/VAL-C11 uniform を確定） |
| ステータス | **起票（反映案）**。REQ 不変 / DES-003 §3.4・DES-005 §5.6/§5.7/§5.8/§5.13・DES-002 §7.6/§4.2 相当・DES-006 VAL-C11 → 改訂 / DES-001/004・SUPP-001 変更なし |
| 影響設計書 | **DES-003 §3.4**（正規化・sparse・語彙・tri-state 縮約・列挙値）＋ **DES-005 §5.6/§5.7/§5.8/§5.13**（詳細/editor/比較/出力）＋ **DES-002 §7.6・§4.2 相当**（CSV 新 6 列・PATCH replace-set）＋ **DES-006 VAL-C11**（uniform） |
| 関連 | M16-03 指示書 v1.0.0＋レビューチェックリスト ／ 伝達メモ（§0/§A〜§D）／ M16-overview v1.2.0 §4.3 ／ CHANGE-061（CSV 任意列パターン・M16-02） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

---

## 1. 変更の概要

M16-03（G-h）実装完了に伴い、起き攻めの正規化を設計書へ反映する。**6 bool を `combo_oki_options` へ正規化**（sparse＝available 列なし・行存在＝利用可能）、**シミー 4 区分化＋打撃重ね**、**6 bool を決定論 backfill → DROP**。起き攻めは **dup/recipe 非対象**（recipe_hash 不変・Go テストで非回帰確認済み）。Plan Mode で 3 決定（語彙ベースライン／available sparse／VAL-C11 uniform）が確定。

本 CHANGE は確定反映（§2）＋製造独自判断への回答（§4）＋要設計判断（§7＝A-2 表示方式）で構成する。

## 2. 変更の内容

### DES-003 §3.4（combos・起き攻め正規化）

- 6 bool（`oki_meaty_*` / `oki_shimmy_*`）を撤去し **`combo_oki_options` へ正規化**。DDL: `combo_oki_options(id, combo_id FK CASCADE, attack_type TEXT, tech_type TEXT, uses_dr INTEGER, UNIQUE(combo_id, attack_type, tech_type, uses_dr))`。
- **available は sparse（列を持たず、行の存在＝利用可能）**（Plan Mode 確定）。**DES-003 §3.4 の将来スケッチ `(…, available)` は「available 列は持たず行存在で表す」に是正**（§B-2・後続実装の available 列前提の混乱を防ぐ）。
- **語彙（正典・列挙リテラル値）**: `attack_type` ∈ {`throw_meaty` / `shimmy` / `strike_meaty`}・`tech_type` ∈ {`neutral_tech` / `back_tech`}・`uses_dr` ∈ {`false` / `true`}。**これらのリテラル文字列が DB 値・API JSON 値・CSV セル解釈・FE 定数の契約**（`internal/model/combo.go` の `OkiAttackType*`/`OkiTechType*` ↔ FE `web/src/constants/oki.ts`）。**値変更は DB/CSV/API 全波及**のため正典値として固定明記（§B-3）。
- **tri-state → presence 縮約**: 旧 6 bool の nullable tri-state（null/false/true）を **presence 型へ縮約（false と null を非区別・両方「行なし」）**。backfill 仕様「false の bool は行を作らない」がこれを承認（§A-3・実害小＝editor は元々 false/null を区別せず・VAL-C11 も false を nil 同等扱い）。
- **knockdown_advantage は combos 残置・不変**。

### DES-005 §5.6/§5.7/§5.8/§5.13（表示・editor）

- §5.7 editor: 6 チェックボックス → **正規化オプション UI**（attack_type × tech_type × uses_dr・シミーにドライブラッシュ切替・打撃重ね追加）。
- §5.6 詳細: **利用可能なオプションのラベル一覧のみ**（0 件は「設定なし」）。旧「6 行 ✓/✗/-」から変更。
- §5.8 比較 / §5.13 出力: **12 変種すべてを個別行で ✓/✗**（コンボ間の差分を列そろえ＝非対称解消）。
- **ラベル正典**（§B-5）: `web/src/constants/oki.ts` を単一正典化（`OKI_ATTACK_TYPE_LABELS`〔投げ重ね/シミー/打撃重ね〕・`OKI_TECH_TYPE_LABELS`〔その場受け身/後ろ受け身〕・`OKI_USES_DR_LABEL`〔**「ドライブラッシュ」**〕・`okiOptionLabel()`）。ラベル生成規則＝`"投げ重ね(その場受け身)"` / `"シミー(後ろ受け身・ドライブラッシュ)"`（`attackType(techType[・ドライブラッシュ])`）。**旧 en i18n の「DR」略記を撤去**（DES-005 §5.6 正典＝「ドライブラッシュ」に整合）。test-id は `combo-editor-oki-<attackType>-<techType>-<dr|nogauge>`（§B-6）。

### DES-002 §7.6・§4.2 相当（CSV・PATCH）

- §7.6: **CSV 新 6 列を任意列として列末尾追加**（既存 6 列は必須列のまま）。新列名（§B-4・製造裁量）: `oki_shimmy_neutral_tech_dr`・`oki_shimmy_back_tech_dr`（シミー ドライブラッシュ）／ `oki_strike_meaty_neutral_tech`・`oki_strike_meaty_neutral_tech_dr`・`oki_strike_meaty_back_tech`・`oki_strike_meaty_back_tech_dr`（打撃重ね）。export は行あり→"true"・行なし→空セル。import は "true"→行生成・"false"/空→行なし（旧 CSV 後方互換）。
- **§4.2 相当（PATCH 仕様）**: 起き攻めの PATCH を **replace-set（子集合の全置換・`okiOptions *[]OkiOptionDTO`：nil=不変更 / 非 nil〔空配列含む〕=全置換）** に明記。**per-field トライステート（`Optional[bool]`）の対象外**（`TagIDs` と同方式・§A-1）。「他メタデータと同じく per-field 更新できる」誤解を防ぐ。

### DES-006 VAL-C11（起き攻め整合性検証）

- **VAL-C11 を全 attack_type へ一様適用（uniform）**（Plan Mode 確定・§C-2）。従来は meaty 2 ペアのみ（シミーはドライブラッシュなしで対象外）だったが、uniform 化でシミー/打撃重ねでも「ドライブラッシュのみ設定・ノーゲージなし」等に WARNING。「非対称是正」の設計意図と整合。指示書 §4.5「新規 VAL を足さない」との緊張は「同一ルールの一様適用＝追従」と解する。

## 3. dup/recipe 非対象（変更なし・確認）

- 起き攻めは `DuplicateKey`・`CalcRecipeHash(steps)`・recipe_cache に非関与（M16-RESEARCH-01 裏付け）。PATCH の oki 置換後に `RecomputeComboCache` を呼ばない結線（§C-5）＝recipe_hash 不変・dup 判定不変（Go テスト非回帰確認済み）。

## 4. 確定した設計判断（製造独自判断への回答・伝達メモ B/C）

| 項目 | 判断 | 反映先 |
|------|------|--------|
| **B-2/C-1 available sparse** | **DES-003 §3.4 に「available 列なし・行存在＝利用可能」明記**（将来スケッチ是正） | §2 |
| **B-3 列挙リテラル値の契約化** | **DES-003 §3.4 に正典値固定明記** | §2 |
| **A-3 tri-state→presence 縮約** | **DES-003 §3.4 に明記**（false/null 非区別・実害小） | §2 |
| **B-4 CSV 新 6 列名** | **確定・DES-002 §7.6 に追加**（別命名希望なければ本命名で確定＝§7 補足） | §2 |
| **A-1 PATCH replace-set** | **DES-002 §4.2 相当に明記**（per-field 対象外） | §2 |
| **C-2 VAL-C11 uniform** | **DES-006 VAL-C11 を uniform 化** | §2 |
| **B-5 ラベル正典一本化・ドライブラッシュ正式名称** | **DES-005 §5.6/§5.7 に `okiOptionLabel` 形で正典化** | §2 |
| **C-3 down 破壊的（新変種喪失）** | **retrospective-digest §5 記録**（TMP 経由・本番前進のみ想定） | §5 |
| **C-4 code-facts stale** | **`/regen_code_facts` 依頼**（§5・恒久資料再生成・CHANGE 対象外） | §5 |
| **C-5 oki 置換で cache 非再計算** | **仕様どおり・記録**（recipe 非対象） | §3 |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-003 §3.4・DES-005 §5.6/§5.7/§5.8/§5.13・DES-002 §7.6/§4.2・DES-006 VAL-C11 | §2 |
| 恒久資料 | retrospective-digest §5 | down 破壊的（C-3・TMP → 再蒸留） |
| 恒久資料（再生成） | code-facts | **`/regen_code_facts` 必須**（§10 stale=000021 まで・§8 の 6 oki bool→オプション配列・開発者実行） |
| その他 | REQ/DES-001/004・SUPP-001 | **変更なし** |
| 移行 | 000021 | 決定論 backfill（既存シミー→uses_dr=false）・**down 破壊的**（シミー ドライブラッシュ/打撃重ね喪失） |
| dup/recipe | DuplicateKey/recipe_hash/recipe_cache | **不変**（非対象・非回帰確認済み） |

## 6. 直列化・後続

- **registry**: 承認後に 063 消化・次 064。三点セット（本通知書＋改訂 DES-002/003/005/006＋change-report-063）。
- **M16-06 送り**（不変・overview §4.6 記録済み）: 始動/消費ラベル正典化（A-3・M16-02 由来）・エクスポート消費（A-1・M16-02 由来）。**起き攻めラベルは本 CHANGE で `okiOptionLabel` 正典化済み**（M16-06 の対象外）。
- **M16-04 へ**: M16-RESEARCH-01 の要決定 6 件は確定済み（別チャットで着手）。

## 7. 開発者への確認事項

1. **A-2: 詳細ビューと比較ビューの表示方式の非対称（明記 or 統一）**
   何を: 詳細＝利用可能ラベル一覧のみ／比較・出力＝12 変種すべて ✓/✗、という**意図的な非対称**を DES-005 §5.6/§5.8 に**明記して正典化する**か、**統一する**（例：詳細も 12 変種 ✓/✗）か。
   なぜ: 製造は「詳細＝このコンボの情報〔利用可能分で十分・過密回避〕／比較＝コンボ間の差分〔全変種を列そろえ〕」で使い分けが自然と判断。設計の一貫性ポリシー次第。
   暫定案: **非対称を明記して正典化**（製造判断を採用）。詳細は過密回避で利用可能分のみ、比較/出力は差分比較のため全変種。統一を望む場合はご指定を。

2. **B-4: CSV 新 6 列名の確定**
   何を: `oki_shimmy_neutral_tech_dr` / `oki_shimmy_back_tech_dr` / `oki_strike_meaty_neutral_tech` / `oki_strike_meaty_neutral_tech_dr` / `oki_strike_meaty_back_tech` / `oki_strike_meaty_back_tech_dr` で確定してよいか（既存 `oki_meaty_*` 規約に沿う）。
   なぜ: CSV セル解釈の契約になる。
   暫定案: **本命名で確定**（実装済み・既存規約整合）。

---

> 起票（反映案）。承認後に改訂 DES-002/003/005/006 ＋ change-report-063 ＋ registry（063 反映・次 064）を確定。code-facts 再生成（`/regen_code_facts`）を別途実施。A-2 は暫定案（非対称明記）で反映予定。

*以上、CHANGE-063 通知書。配置 `docs/change-notes/CHANGE-063-notification.md`。*
