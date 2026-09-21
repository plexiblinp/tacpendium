# change-report-064: CHANGE-064 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-064（レシピ taxonomy 明文化＋方向別 dash の modifier.type 廃止・system move 一本化・M16-04／④''） |
| 反映日 | 2026-07-07 |
| 反映担当 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 起票文書 | `docs/change-notes/CHANGE-064-notification.md` |
| ステータス | **反映（DES 適用済み・commit は開発者）** |
| 背景 | M16-04（G-i・破壊的移行）実装・独立レビュー完了（重大ゼロ）。方向別 modifier.type dash を撤去し既存データを system move dash へ移行（UPDATE-in-place の transform＋無損失 skip・純 SQL マイグレ 000022）。taxonomy 原則を DES に明文化。 |

---

## 1. 反映したファイル（旧→新）

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-004 内部表現仕様 | v1.8.0 → **v1.9.0**（§2.2 taxonomy 振り分け原則 (a)/(b)/(c) 明文化・§2.3 dash canonical 注記を M16-04 完了へ更新） |
| DES-003 データモデル | v1.26.0 → **v1.27.0**（§3.5 `combo_steps` taxonomy 明文化＝move_id あり=技/system move・NULL=非技 type〔parry/cancel のみ〕） |
| SUPP-001 設計補足（自由改訂） | v1.26.0 → **v1.27.0**（§3.3.3 非技 type 表から dash 撤去・§3.3.2 格上げ注記） |

REQ-001 / DES-001 / DES-002 / DES-005 / DES-006 は**変更なし**（§3 参照）。

## 2. 修正概要（DES-004 §2.2/§2.3・DES-003 §3.5・SUPP-001 §3.3.3）

- **DES-004 §2.2**: レシピ要素の振り分け原則を明文化。(a) moves 行〔system move 含む・移動は 1入力=1move〕/ (b) 非技 `modifiers.type`＝parry/cancel のみ〔移動は置かない〕/ (c) flag＝直近 move の修飾。判断基準（独立入力＝(a)／出し方の種別＝(b)／修飾＝(c)）を併記。
- **DES-004 §2.3**: dash canonical 注記を「M16-04（CHANGE-064・マイグレ 000022）で方向別 modifier.type dash を廃止・既存データを system move dash へ移行完了（migratable transform／移行先不在 skip）」へ更新。
- **DES-003 §3.5**: `combo_steps` のステップ種類を taxonomy として明文化（(a)/(b) と DES-004 §2.2 整合）。dash は非技 type に含まない旨を明記。
- **SUPP-001 §3.3.3**: 非技 type 表から `dash_forward`/`dash_back` を撤去し parry/cancel のみに。dash＝system move（DES-004 §2.1）で 1入力=1move 原則に整合させた旨、§3.3.2 の移動表記ルール格上げを注記。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-006（バリデーション） | **変更なし** | Go に `modifiers.type` 許容値検証が存在せず（許容値は UI 固定選択式で担保）、dash 撤去で追加/削除する VAL 規定が無い（progress §M16-04-1・Plan Mode 確定）。 |
| DES-002 §7.6（コンボ CSV 契約） | **変更なし** | CSV は意味単位（move_code ベース・DB 管理列除外）で、dash の system move 一本化に不変（M13-6 頑健性・往復回帰確認済み）。 |
| DES-005（画面設計・表示） | **変更なし** | 移行後の system move dash は ryu の `official_ja_move` alias で「前ダッシュ/後ろダッシュ」表示が不変（伝達メモ §2・resolver フォールバック）。表示層に規定変更なし。 |
| DES-004 §2.1（移動 system move 表） | **変更なし（既存完備）** | `dash_forward`/`dash_back` は CHANGE-048 で既に §2.1 の移動 system move 表に記載済み。本 CHANGE は §2.2 原則明文化と §2.3 完了反映のみで、§2.1 表への追加は不要（漏れでなく既存完備）。 |
| REQ-001 / DES-001 | **変更なし** | 要件・技術スタックに影響なし。 |

## 4. 整合性チェック結果

- **taxonomy の一貫性**: DES-004 §2.1（移動＝system move）⇔ §2.2（振り分け原則 (a)/(b)/(c)）⇔ §2.3（非技 type＝parry/cancel のみ）⇔ DES-003 §3.5（combo_steps move_id/modifiers.type 区別）⇔ SUPP-001 §3.3.3（dash 撤去）が相互整合。dash は全文書で system move（§2.1）に一本化され、非技 type からは撤去された。
- **先行 CHANGE との整合**: CHANGE-062（単値 dash 幽霊・high_jump=unique 是正）・CHANGE-048（dash system move 正典補完）・CHANGE-057（一本化＝M16 確定）の帰結として本 CHANGE で方向別 dash の実撤去・移行が完結。
- **実装詳細の DES 非記載**: マイグレ 000022 の DML（相関副問い合わせ・`WHERE EXISTS` skip）・空 `modifiers` の `{}`→`NULL` 正規化（recipe_hash 一致）・専用 fixtures テストは DES 規定文言でないため DES 本文に非記載（完了報告 `progress-log.md` §M16-04 に記録）。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | **064 反映（次 065）**・§1 番号表に 064 行・§3 改訂表に 2 行（DES-004 v1.8.0→v1.9.0・DES-003 v1.26.0→v1.27.0）・版ログ v1.53.0 追記（SUPP-001 は自由改訂で改訂表対象外・注記） |
| M16-overview | **§4.8/§6 の要決定確定反映（v1.2.3・同トランザクション）**。§5-7 の M14-03b DoD 申し送り（skip 掃き取り follow-up マイグレ・alias 対・dup 再測定・down 非対称）は v1.2.2 で反映済み |
| followup-backlog | **M14-03b prep note 追記**（全キャラ dash seed＋alias 対・skip 残行掃き取り follow-up マイグレ〔伝達メモ §3-1〕・dup 再測定・down 非対称ロールバック注記）＝overview §5-7 と複線記録 |
| model-allocation | M16-04 実績（Opus 4.8＋Plan Mode・レビュー Sonnet 4.6）は v1.29.0 の M16 配分に既反映。追記任意（実績確定の注記のみ） |
| retrospective-log | 教訓 C-3（保存列 vs 都度計算／DB 制約 vs サービス層強制／表示安定 vs cache regen の取り違え）・C-4（表示ラベル撤去×skip 残行の結合）を一時ノート経由でセッション末に転記 |

## 6. 残ゲート（開発者）

- 本三点セット（通知書＋改訂 DES-004/003＋本レポート）と SUPP-001 自由改訂の**内容確認・commit/push**。
- 通知書 §7 の確認事項（反映確定の可否・§2.1 表の既存完備扱い）。
- dev DB の combo #91 削除（必要なら・dev クリーンアップ。出荷マイグレ非直書き）。

---

*以上、change-report-064。配置 `docs/change-notes/change-report-064.md`。*
