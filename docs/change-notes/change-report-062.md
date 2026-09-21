# change-report-062: CHANGE-062 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-062（DES-004 spec 是正＝単値 `dash` 幽霊削除・`high_jump`=unique 正典化・doc 限定） |
| 反映日 | 2026-07-05 |
| 反映担当 | 設計担当 Claude（M16 期） |
| 起票文書 | `docs/change-notes/CHANGE-062-notification.md` |
| ステータス | **反映（DES 改訂を適用・commit は開発者）**。§5 確認事項なし（単値 dash 幽霊削除・high_jump=unique はいずれも開発者確定済み・doc 限定） |
| 背景 | M16-RESEARCH-01 が実コードで検出した DES-004 の 2 つの自己矛盾（§2.1 vs §2.3 の単値 dash 幽霊・high_jump の三者不一致）を解消。**doc 限定（実装変更なし・実装は既に正）**。M16-04（G-i）着手前に設計書を実態へ合わせ二重管理を避ける。 |

---

## 1. 反映したファイル（旧→新）

| ファイル | 旧 → 新 |
|--------|---------|
| DES-004 内部表現仕様書 | v1.7.0 → **v1.8.0**（§2.3 単値 `dash` 削除・flag `high_jump` 削除／§2.1 `high_jump`=unique 明記） |

REQ-001 / DES-001 / DES-002 / DES-003 / DES-005 / DES-006 は**変更なし**。

## 2. 修正概要

### DES-004 §2.3（非技ステップ modifier.type・単値 `dash` 幽霊削除）
- **modifier.type の単値 `dash` 行を削除**。M16-RESEARCH-01 実測＝実コード（`internal/model/combo.go`・`web/src/features/combo/labels.ts`）に単値 `dash` は 0 件で、実装は方向別 `dash_forward`/`dash_back` のみ。§2.3 の単値 `dash` は spec のみの幽霊だった。
- 削除に伴い、dash の canonical＝方向別 system move `dash_forward`/`dash_back`（§2.1）である旨と、**modifier.type としての方向別 dash の廃止・実データ移行は M16-04（④''）**である旨を注記（本 CHANGE は単値幽霊の doc 削除のみ）。

### DES-004 §2.3（flags `high_jump` 幽霊削除）
- flags 表から `high_jump`（「（高空）」・未実装 planned）の行を**削除**（実装は flag でなく unique move＝幽霊 flag の解消）。

### DES-004 §2.1（`high_jump` の unique 正典化）
- 移動・ジャンプ動作の節に注記を追加：**`high_jump` はキャラ固有の unique 特殊技（`category="unique"`）**であり、移動 system move（`category="system"`）でも modifier flag でもない。実 DB は c_viper の `high_jump_forward`/`high_jump_neutral`（category=unique）で存在。将来他キャラに類似の特殊ジャンプが追加された場合も unique move として登録する。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| 実装（BE/FE） | **変更なし** | doc 限定（実装は既に方向別 dash・c_viper high_jump unique で正） |
| DES-004 §2.1 の `dash_forward`/`dash_back`（system move） | **不変** | 既に canonical として正しく列挙済み（CHANGE-048） |
| 方向別 modifier.type dash の廃止・実データ移行 | **本 CHANGE 対象外** | M16-04（④''）で実施 |
| REQ/DES-001/002/003/005/006 | **変更なし** | DES-004 spec 是正に閉じる |
| dup（DuplicateKey）・recipe_hash・recipe_cache | **不変** | 表記 spec の是正のみ・データ非関与 |

## 4. 整合性チェック結果

- **§2.1 ↔ §2.3 の自己矛盾解消**：単値 `dash`（§2.3 幽霊）を削除し、canonical を §2.1 方向別 system move に一本化。M16-RESEARCH-01 が検出した自己矛盾が解消。
- **high_jump の三者一致**：flag（§2.3 幽霊）を削除し、§2.1 で unique 特殊技として正典化。実 DB（c_viper・category=unique）と一致。
- **M16-04 への含意**：spec が実態と一致したため、M16-04 の CHANGE は taxonomy 明文化＋方向別 modifier.type dash 廃止＋移行に集中でき、幽霊仕様の後追い是正が不要になる。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | **062 反映（次 063）**・DES-004 v1.7.0 → v1.8.0 |
| SUPP-001 §3.3.1/§3.3.2（**派生・自由改訂・change-note 管理外**） | `high_jump` を「キャラ固有 unique 特殊技（category=unique・移動 system move でも flag でもない）」へ整合（v1.25.0 → v1.26.0）。SUPP-001 は CHANGE 管理対象外のため本 CHANGE の成果物としては扱わず、自由改訂として別途適用済み。正典は DES-004 §2.1。 |
| SUPP-001 §3.3.3（方向別 modifier.type dash） | **本 CHANGE 対象外**＝M16-04（④'' dash 一本化）で扱う |
| M16-04（G-i） | 要決定 6 件は確定済み。spec 是正（本 CHANGE）済みで幽霊仕様の後追いは不要 |

## 6. 残ゲート（開発者）

- 本 CHANGE（DES-004 §2.1/§2.3）の承認・commit/push。承認は起票時に取得済み（2026-07-05：単値 dash 幽霊削除・high_jump=unique）。

---

*以上、change-report-062。配置 `docs/change-notes/change-report-062.md`。doc 限定（実装は既に正）。方向別 modifier.type dash の廃止・実データ移行は M16-04（④''）で実施。SUPP-001 の high_jump 整合は自由改訂（change-note 管理外）で別途適用。*
