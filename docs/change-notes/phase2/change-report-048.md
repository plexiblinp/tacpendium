# change-report-048: CHANGE-048 設計書本体 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-048(DES-004 §2.1 に system move `dash_forward`／`dash_back` を追記) |
| 反映日 | 2026-06-25 |
| 反映担当 | 設計担当 Claude(フェーズ2 本流スパイン・M12 担当) |
| 起票文書 | `CHANGE-048-M12-05-dash-system-moves.md` |
| 背景 | M12-05 設計担当への申し送り §5・研究報告 A-2(seed に dash 系実在・DES-004 §2.1 表に未列挙の不整合) |

---

## 1. 反映したファイル(旧→新)

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-004 内部表現仕様 | v1.6.2 → **v1.6.3** |

単一設計書・正典補完。

## 2. 修正概要

### DES-004(v1.6.3)
- §2.1「移動・ジャンプ動作」表に 2 行追記: `dash_forward`(前ダッシュ)/ `dash_back`(後ろダッシュ／バックダッシュ)。配置は `micro_back` の直後(地上移動グループ)。
- ステータス欄に第11版(CHANGE-048反映)を前置。

## 3. 影響範囲に挙がったが「変更しなかった」項目(漏れ検知)

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-004 §2.3 modifier flag `dash` | **変更なし** | §2.3 の `dash` は修飾フラグ。本件の `dash_forward`/`dash_back` は独立 system move で別系統 |
| DES-001/002/003/005/006 | **変更なし** | dash 系は notation 内部表現のみ。スキーマ・画面・検証に波及しない |
| seed(000004/000010) | **変更なし** | dash 系は既に seed に実在。本 CHANGE は正典表の記載補完のみ(実装変更なし) |
| `micro_*` / `jump_*` | **変更なし** | 既に §2.1 表に列挙済み。欠落は dash 系のみ(全数確認済み) |

## 4. 整合性チェック結果

- §2.1 表の欠落が `dash_forward`/`dash_back` の 2 件のみであることを、seed の system code(製造申し送り §1.2 列挙 = `micro_forward`/`micro_back`/`jump_neutral`/`jump_forward`/`jump_back`/`dash_forward`/`dash_back`)と §2.1 表(`forward`/`back`/`micro_*`/`jump_*`)の差分で確認。
- §2.3 の `dash`(modifier flag)と §2.1 の `dash_forward`/`dash_back`(system move)が別概念であることを確認(衝突なし)。
- 挙動・データ・スキーマ・API・画面・検証のいずれも不変(正典文書の完全化のみ)。

## 5. 派生・後続

| 文書 | 対応 |
|------|------|
| change-number-registry | §1 で 048 使用済み・次番号 049、§3 に 1 行(DES-004 v1.6.2→v1.6.3)、§4 に 1.36.0 |
| 教訓・申し送りメモ | §2.5 の「DES-004 §2.1 dash 系未列挙(要処遇判断)」を **CHANGE-048 反映済み**へ更新 |
| docs-map | DES-004 のバージョンは次回再生成で追従(自動生成・手編集禁止) |

## 6. 残ゲート(開発者)

- push/マージは開発者(設計担当は反映物を提示)。
- 日本語名(前ダッシュ/後ろダッシュ)の表示細部に調整希望が出た場合は後続パッチで対応。

---

*以上、change-report-048。配置 `docs/change-notes/change-report-048.md`。*
