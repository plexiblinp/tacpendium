# change-report-040: CHANGE-040 設計書本体 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-040(custom_states 開始時状態の付与・表示 機能化、M11-01) |
| 反映日 | 2026-06-20 |
| 反映担当 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 起票文書 | `CHANGE-040-M11-01-custom-states-activation.md` |
| 関連 | M11-overview v1.0.0 / m11-custom-states-definitions v0.2.0 / M11-RESEARCH-01 報告(+FU) |

---

## 1. 反映したファイル(旧→新バージョン)

| 設計書 | 旧 → 新 | ステータス版 |
|--------|---------|------------|
| DES-005 画面設計書 | v2.21.1 → **v2.22.0** | 第33版 |
| DES-006 バリデーション設計書 | v1.11.0 → **v1.12.0** | 第14版 |

## 2. ファイル別 修正概要

### 2.1 DES-005(v2.22.0)
- **§5.6 表示項目4(コンボ詳細)**: 旧「状況(position…、situation JSON の中身)」を2項目に分割。項目4=「状況(position／opponent_stance／hit_type／opponent_size)」、新項目5=「キャラ固有状態(custom_states)」(situation 内 custom_states キーをデータ駆動表示・独立カラム「状況」とは別セクション・Boolean は状態名／Int は状態名と数値・custom_states を持つコンボのみ表示)。以降の項目を5→6…10→11 へ採番し直し。
- **§5.7 表示項目5(コンボ登録・編集)**: 旧「状況入力」の最終サブ項目だった「situation(キャラ固有状態、動的に表示)」を独立項目化。項目5=「状況入力」(situation サブ項目を除去)、新項目6=「キャラ固有状態(custom_states)入力」(別セクション・データ駆動・flag→トグル／int→数値入力〔min/max 尊重・-/e/.不可=既存ゲージと同方式〕・状態なしキャラ非表示・未対応 type 非描画・値は situation の custom_states キーに格納・消費は非モデル化)。以降の項目を6→7…13→14 へ採番し直し。
- **ヘッダ**: バージョン 2.22.0、ステータスに第33版(CHANGE-040)を前置。

### 2.2 DES-006(v1.12.0)
- **§2.4 新設**「キャラ固有状態(custom_states)入力に対する検証 — 行わない」: 値域・必須・型・存在の VAL-* を設けない / int 入力欄の min/max・-/e/.不可は UI 入力コントロール上の制約でありバリデーション規定(VAL-*)ではない / custom_states は重複判定(VAL-C02)の対象に含めない(§2.3 の主要項目は position/opponent_stance/hit_type/opponent_size のみ) / 仮登録(is_draft)でも同様に検証しない。消費はモデル化せずアプリでは構築しない旨を明記。
- **ヘッダ**: バージョン 1.12.0、ステータスに第14版(CHANGE-040)を前置。

## 3. 影響範囲に挙がったが「変更しなかった」ファイル(漏れ検知)

| 設計書 | 判断 | 根拠 |
|--------|------|------|
| DES-003 データモデル設計書 | **変更なし** | `characters.custom_states`／`combos.situation` は論理「JSON」・物理 TEXT で既存(M11-RESEARCH-01 §0.1)。M11 はスキーマ・構造を変えず situation 内 custom_states キーの読み書きを足すのみ。先行リリース3体の定義(code・value_definition)は seed マイグレーションと補足資料 m11-custom-states-definitions が保持。§3.2 例示(`drunk_level`/composite 等)は器の表現力例として据え置き(jamie 既存 seed と整合、D-C-2) |
| DES-002 アーキテクチャ設計書 | **変更なし** | 登録系 API は situation を既存 DTO で素通し。API 契約・スキーマに変更なし(M11 はフロント + seed) |
| DES-004 内部表現仕様書 | **変更なし** | recipe notation と無関係 |
| REQ-001 要件定義書 | **変更なし** | custom_states 機能化は phase2-overview §M11 のスコープ内で、FR 追加・改訂を要しない(消費・検証は非構築) |

## 4. 派生ドキュメント(CHANGE 対象外・自由改訂、§3 登録対象外)

| 文書 | 対応 |
|------|------|
| M11-overview v1.0.0 / m11-custom-states-definitions v0.2.0 | 新規作成・更新(M11 作業リファレンス) |
| architecture-patterns §9.1 | 消費非構築の framing 是正(「アプリでは構築しない／現時点では実装しない」)。自由改訂 |
| change-number-registry | §1 で 040 を使用済み・次番号 041、§3 に2行追加、§4 履歴 1.28.0 追記 |
| model-allocation | M11-01 行を確定(Opus 4.8 / レビュー Sonnet 4.6) |

## 5. 整合性チェック結果

- DES-005 §5.6 の採番が 1〜11 で連番、§5.7 の採番が 1〜14 で連番であることを確認。
- DES-005 §5.7 表示項目6 と DES-006 §2.4 の相互参照(int 入力制約は UI 制約、バリデーション規定ではない)が一致。
- DES-006 §2.3(重複判定キー= position/stance/hit/size)と §2.4(custom_states は VAL-C02 対象外)が矛盾しないことを確認。
- 消費非構築の framing が全資料で「アプリでは構築しない／将来要望次第での検討にとどめ現時点では実装しない」に統一されていることを確認(CHANGE-040／overview／definitions／instruction／architecture-patterns §9.1)。

---

*以上、change-report-040。配置 `docs/change-notes/change-report-040.md`。*
