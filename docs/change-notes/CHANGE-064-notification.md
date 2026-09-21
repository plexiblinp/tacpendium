# CHANGE-064 通知書: レシピ taxonomy の明文化＋方向別 dash の modifier.type 廃止・system move 一本化（M16-04・④''）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-064 |
| サブマイルストーン | M16-04 |
| 起票日 | 2026-07-07 |
| 起票者 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 承認者 | 開発者（実装・レビュー完了。G-i 個別承認 2026-07-06・commit 8946590 / 5a44b59 / 9860d7b＝Phase1 非破壊＋Phase2 マイグレ 000022） |
| ステータス | **反映済み**（DES 適用・三点セット）。REQ-001 不変 / **DES-004 §2.2・§2.3 → 改訂**・**DES-003 §3.5 → 改訂** / SUPP-001 §3.3.3 自由改訂 / 他 DES 変更なし |
| 影響設計書 | **DES-004 §2.2/§2.3**（taxonomy 原則明文化＋方向別 dash の modifier.type 廃止完了反映）・**DES-003 §3.5**（combo_steps taxonomy 明文化）。マイグレ DML 技法・空 `modifiers` の `{}`→`NULL` 正規化・テストは実装詳細で DES 規定文言外 |
| 関連 | 指示書 `M16-04-step-taxonomy-and-dash-unification.md` v1.0.1 / 伝達メモ `M16-04-to-design-memo.md` §1〜§4 / レビュー `m16-04-review.md`（重大ゼロ・質問1＝§4.2 追補・低2不採用）/ 完了報告 `progress-log.md` §M16-04 / 先行 CHANGE-062（単値 dash 幽霊・high_jump 是正）・CHANGE-057（一本化＝M16 確定）・CHANGE-048（dash system move 正典補完） |

---

## 1. 変更の概要

M16-04（G-i・④''）の実装完了を DES へ反映する。内容は次の 2 本。

- **taxonomy 原則の明文化**（非破壊・設計）: レシピ要素を (a) moves 行〔system move 含む〕/ (b) 非技ステップ `modifiers.type` / (c) flag の 3 種に振り分ける原則を DES-004 §2.2・DES-003 §3.5 に明記。移動（dash・ジャンプ・微歩き）＝system move を「1入力=1move」で原則化。
- **方向別 dash の modifier.type 廃止・system move dash 一本化**（破壊的マイグレ 000022・as-built）: `modifiers.type` の方向別 dash（`dash_forward`/`dash_back`）を許容値・UI から撤去し、既存データを system move dash へ移行（UPDATE-in-place の transform／移行先不在は無損失 skip）。DES-004 §2.1「1入力=1move」原則に SUPP-001 §3.3.3 が違反していた二重表現（M15 監査 L-M15-3-3）の是正。

**CHANGE 対象＝** taxonomy 原則の DES 明文化＋dash 廃止の完了反映。**CHANGE 対象外＝** マイグレ DML 技法・`{}`→`NULL` 正規化（recipe_hash 一致）・専用 fixtures テスト（実装詳細で DES 規定文言でない・完了報告に記録）。

## 2. 変更の内容（DES-004 §2.2/§2.3・DES-003 §3.5・SUPP-001 §3.3.3）

| # | 対象 | 変更 |
|---|------|------|
| a | DES-004 §2.2 | **taxonomy 振り分け原則 (a)/(b)/(c) を明文化**。(a) moves 行〔system 含む・移動は 1入力=1move〕/ (b) 非技 `modifiers.type`＝`parry_drive_rush`/`cancel_drive_rush` のみ〔移動は置かない〕/ (c) flag＝直近 move の修飾。判断基準を併記。 |
| b | DES-004 §2.3 | dash canonical 注記を **M16-04（CHANGE-064・マイグレ 000022）で完了**へ更新（方向別 modifier.type dash 廃止・既存データを system move dash へ移行）。以後 `modifiers.type` 非技種別は parry/cancel のみ。**列の削除・保存挙動の他項目は不変**。 |
| c | DES-003 §3.5 | `combo_steps` の **taxonomy を明文化**（move_id あり＝技/system move〔移動含む〕・NULL＝非技 type〔parry/cancel のみ〕）。dash は非技 type に含まない。 |
| d | SUPP-001 §3.3.3（自由改訂） | 非技 type 表から `dash_forward`/`dash_back` を撤去（parry/cancel 残置）。§3.3.2 の移動表記ルールを taxonomy 原則へ格上げした旨を注記。 |

## 3. 真因の記録（仕様変更でない旨）

本 CHANGE は新機能の仕様変更ではなく、**確立済み原則（DES-004 §2.1「移動は 1入力=1move の独立 move。2通り表現はデータ揺れを生むため不採用」）に対する違反の是正**である。dash が system move（§2.1）と `modifiers.type`（SUPP-001 §3.3.3）で二重定義されていた揺れを、M15 の横断監査（L-M15-3-3）で顕在化し、M16-04 で system move へ一本化＋既存データ移行した。単値 `dash` の doc 幽霊・high_jump の三者不一致は先行 CHANGE-062 で是正済み。

## 4. 確定した設計判断（実装報告への回答）

| 項目 | 判断 | 根拠 |
|------|------|------|
| 指示書 §4.2 原文 vs 確定方針（dup 検出・targeted RecomputeComboCache をマイグレに積むか） | **積まない**（確定方針。指示書 v1.0.1 で §4.2 追補済み） | recipe_hash は `CalcRecipeHash(steps)` 都度計算＝保存列なし・dup は DB 制約でなく CRUD 時 Go 強制（配布は M14-03b remap）・recipe_cache は移行前後で表示文字列がバイト一致＝regen 不要（伝達メモ §3・レビュー質問・progress §M16-04-4/5） |
| alias 実査 | ryu dash は `official_ja_move` に alias 実在（`migrations/000006`）＝000022 の alias INSERT 不発。他キャラは M14-03b で move+alias を対に | 伝達メモ §2・progress alias 実査 |
| skip 行の生 code fallback（dev #91） | 実害なし（cache 非 regen で「前ダッシュ」維持・#91 は dev-disposable・clean/user DB は ryu のみで skip 0）。恒久解消は M14-03b 全キャラ seed | レビュー低-1（不採用）・伝達メモ §3-1 |
| down の lossy/非対称（native dash も modifier.type dash 化） | 逆写像仕様どおり・marker 不在下の最善。既知制約に記載 | レビュー低-2（不採用）・progress 既知制約 |

## 5. 影響範囲・移行影響・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | **DES-004 v1.8.0 → v1.9.0** | §2.2 taxonomy 原則・§2.3 dash 廃止完了反映 |
| 設計書本体 | **DES-003 v1.26.0 → v1.27.0** | §3.5 combo_steps taxonomy 明文化 |
| 設計補足 | **SUPP-001 v1.26.0 → v1.27.0**（自由改訂） | §3.3.3 dash 撤去・§3.3.2 格上げ注記 |
| 設計書本体 | REQ-001 / DES-001 / DES-002 / DES-005 / DES-006 | **変更なし**（modifier.type 許容値検証は Go に不在＝DES-006 不変〔progress §M16-04-1〕・表示層は system move dash の alias で表示不変＝DES-005 不変・M13 CSV は意味単位 move_code で dash 一本化に不変＝DES-002 不変） |
| 実装（DES 規定文言外） | マイグレ 000022・`model/combo.go`・`labels.ts`・`resolver.go`・`ModifiersEditor`/`RecipeBuilder`/`SetupRecipeEditor` | as-built（3 コミット・Go 33 パッケージ／Vitest 664 件通過） |
| 移行影響 | 既存 modifier.type dash → system move dash（transform）・移行先不在は skip（無損失） | clean/user DB は ryu のみ＝全件 migratable・dup 衝突 0 件（RESEARCH 時点・M14-03b 後に再測定） |
| リスク | skip 行の再計算時 生 code fallback（dev #91・実害なし）・down 非対称 | M14-03b 全キャラ seed＋skip 掃き取り follow-up マイグレで恒久解消（overview §5-7） |
| 新規 test-id | なし（`ModifiersEditor` は配列駆動で dash 選択肢が自動消滅） | — |

## 6. 直列化・後続

- **registry**: 064 反映（次 **065**。欠番 008/009/014）。
- **三点セット**: 本通知書＋改訂 DES 本体（DES-004/DES-003）＋`change-report-064`。SUPP-001 §3.3.3 は自由改訂で適用。
- **同トランザクション**: M16-overview §4.8/§6 の要決定確定反映（v1.2.3）。
- **後続**: M14-03b DoD（全キャラ dash seed＋alias 対・**skip 残行掃き取り follow-up マイグレ**・dup 再測定・down 非対称ロールバック注記＝overview §5-7）／M16-05（④' target_combo）／M16-06（表記 rollout）。

## 7. 開発者への確認事項

1. **反映確定の可否**: DES-004 §2.2/§2.3・DES-003 §3.5 の改訂と SUPP-001 §3.3.3 自由改訂を本三点セットで適用しました。内容に相違がなければ commit/push（開発者作業）をお願いします。暫定案＝この内容で確定。
2. **DES-004 §2.1 の移動表**: dash system move は CHANGE-048 で既に §2.1 に記載済みのため本 CHANGE では追加していません（漏れでなく既存完備＝change-report §3）。この扱いで問題ないでしょうか。

---

> 反映済み（三点セット）。改訂 DES-004 v1.9.0 / DES-003 v1.27.0（＋SUPP-001 v1.27.0 自由改訂）＋ change-report-064 ＋ registry（064 反映・次 065）で確定。commit/push は開発者。

*以上、CHANGE-064 通知書。配置 `docs/change-notes/CHANGE-064-notification.md`。*
