# CHANGE-062 通知書: DES-004 の spec 是正（単値 `dash` 幽霊削除・`high_jump` を unique 正典化）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-062 |
| サブマイルストーン | M16-04 前提の spec 是正（M16-RESEARCH-01 が検出した DES 自己矛盾の解消・doc 限定・実装非依存） |
| 起票日 | 2026-07-05 |
| 起票者 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 承認者 | 開発者（2026-07-05：単値 dash 幽霊削除・**high_jump=unique（ヴァイパー特有の特殊技）** で確定） |
| ステータス | **起票（反映案）・doc 限定（実装変更なし）**。DES-004 → 改訂 / 他不変 |
| 影響設計書 | **DES-004 §2.1/§2.3**（単値 `dash` 幽霊削除・`high_jump` flag 幽霊削除・high_jump=unique 正典化） |
| 関連 | M16-RESEARCH-01 report（DES-004 §2.1 vs §2.3 自己矛盾・high_jump 三者不一致の検出）/ M16-overview v1.2.0 §4.8 / CHANGE-048（dash_forward/dash_back 方向別を §2.1 に追記）/ M16-04（modifier.type 方向別 dash の実データ移行＝別サブ） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

---

## 1. 変更の概要

M16-RESEARCH-01 が実コードで検出した **DES-004 の 2 つの自己矛盾**を解消する。**doc 限定（実装変更なし・実装は既に正）**。M16-04（G-i）着手前に設計書を実態へ合わせ、二重管理を避ける。

## 2. 変更の内容

### DES-004 §2.3（非技ステップ modifier.type・単値 `dash` 幽霊削除）

- **modifier.type の単値 `dash` を削除**。M16-RESEARCH-01 実測＝実コード（`internal/model/combo.go`・`web/src/features/combo/labels.ts`）に**単値 `dash` は 0 件**で、実装は**方向別 `dash_forward`/`dash_back` のみ**。§2.3 の単値 `dash`（line 158 付近）は spec のみの幽霊。
- 是正: dash は canonical = **方向別 system move `dash_forward`/`dash_back`（§2.1）**。**modifier.type としての方向別 dash（SUPP-001 §3.3.3）は廃止対象＝M16-04（④''）で実データ移行**（本 CHANGE は単値幽霊の doc 削除のみ・方向別 modifier.type dash の廃止は M16-04）。

### DES-004 §2.1/§2.3（`high_jump` の正典化＝unique 特殊技）

- **`high_jump` を unique（特殊技）として正典化**（開発者確定：ヴァイパー特有の技）。実 DB は c_viper の `high_jump_forward`/`high_jump_neutral`（category=unique）で存在。
- **§2.3 の flag `high_jump`（「未実装（planned）」・line 141 付近）を削除**（実装は flag でなく unique move＝幽霊 flag の解消）。
- §2.1/§3.3.2 の記述を「high_jump はキャラ固有の unique 特殊技（移動 system move ではない・flag でもない）」に統一。移動の system move（`forward`/`back`/`micro_*`/`dash_*`/`jump_*`）とは別系統。

## 3. 影響範囲・整合

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-004 §2.1/§2.3 | §2（単値 dash 幽霊削除・high_jump=unique 正典化・flag 幽霊削除） |
| 実装 | なし | doc 限定（実装は既に方向別 dash・c_viper high_jump unique で正） |
| M16-04 | modifier.type 方向別 dash の廃止・実データ移行 | **本 CHANGE の対象外**（M16-04 で実施） |

## 4. 直列化・後続

- **registry**: 承認後に 062 消化・次 063。DES-004 v1.7.0 → v1.8.0。三点セット（本通知書＋改訂 DES-004＋change-report-062）。
- **M16-04 への含意**: spec が実態と一致したため、M16-04 の CHANGE は taxonomy 明文化＋方向別 modifier.type dash 廃止＋移行に集中でき、幽霊仕様の後追い是正が不要になる。

## 5. 開発者への確認事項

- なし（単値 dash 幽霊削除・high_jump=unique はいずれも開発者確定済み・doc 限定）。承認・commit のみ。

---

> 起票（反映案・doc 限定）。承認後に改訂 DES-004（v1.7.0→v1.8.0）＋ change-report-062 ＋ registry（062 反映・次 063）を確定。方向別 modifier.type dash の廃止・実データ移行は M16-04（④''）で実施。

*以上、CHANGE-062 通知書。配置 `docs/change-notes/CHANGE-062-notification.md`。*
