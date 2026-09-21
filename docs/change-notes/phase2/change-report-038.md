# change-report-038: CHANGE-038 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-038（drive_parry 取込方針の是正） |
| 反映日 | 2026-06-18 |
| 反映担当 | 設計担当 Claude（フェーズ2 本流スパイン・M10 担当） |
| 承認 | 開発者 明示依頼（旧 CHANGE-023/026 方針の取り残し是正） |

---

## 1. 修正されたファイル一覧（旧版 → 新版）

| ファイル | 種別 | 旧版 → 新版 |
|----------|------|-------------|
| 02-architecture.md（DES-002） | 設計書本体（CHANGE 管理） | v1.19.0 → **v1.20.0** |
| 03-data-model.md（DES-003） | 設計書本体（CHANGE 管理） | v1.20.0 → **v1.21.0** |
| 04-notation-spec.md（DES-004） | 設計書本体（CHANGE 管理） | v1.6.1 → **v1.6.2** |
| change-number-registry.md | 補足資料（自由改訂） | v1.24.0 → **v1.25.0** |
| CHANGE-038-M9-02-drive-parry-import-scope.md | CHANGE 通知書本体 | 新規（承認済み・反映済み） |

## 2. ファイル別の修正内容

| ファイル | 節 | 修正内容 |
|----------|-----|----------|
| DES-002 | §7.5 取込対象 | 共通システムの取込対象を drive_impact のみ→drive_impact＋drive_parry に変更。取込対象外リストから drive_parry を除去（ジャストパリィは残置）。drive_parry(move)/parry_drive_rush(modifiers.type)役割分担注記を追加。ヘッダ版・ステータス更新 |
| DES-003 | §3.3 | 「ドライブインパクトの扱い」に並置して「ドライブパリィの扱い」注記を追加（`category=system`・`code=drive_parry`・active 空＋raw_data 退避・役割分担）。ヘッダ版・ステータス（第24版）更新 |
| DES-004 | §2.1 | 共通システム行の move_code 例から `parry_drive_rush` を除去し `drive_parry`（FR701 取込）に整理、parry_drive_rush は §2.3 参照と明記。ヘッダ版・ステータス（第10版）更新 |
| change-number-registry.md | §1 / §3 / §4 | §1 に 038（反映済み）・次回 039。§3 に 3 行（DES-002/003/004）。§4 に v1.25.0 |

## 3. 影響範囲表に挙がったが修正しなかったもの（漏れ検知）

| 対象 | 修正不要の理由 |
|------|----------------|
| DES-003 §3.3 category enum | `system` は既存（drive_parry を `category=system` で表現可能）。enum 追加不要 |
| DES-004 §2.3 modifiers.type | `parry_drive_rush` は既に modifiers.type として正しく定義済み。§2.1 から参照を寄せるのみで §2.3 は不変 |
| moves スキーマ（DES-003 列定義） | 既存列で drive_parry を表現可能。列追加・マイグレーション不要 |
| 外部 FR701 取込ツール設計書 | 別設計書・別チャット管理。drive_parry の取込実装は過去担当チャットで対応中（本 CHANGE は本体 DES の是正） |
| CHANGE-023 / CHANGE-026 の md | 改廃しない。方針転換の旨は Claude Code が当該 md へ追記予定 |

## 4. 移行影響・後方互換

- データ移行不要。取込スコープの加算的拡張で既存データ・スキーマに破壊的影響なし。drive_parry の投入は今後の取込で行う。

## 5. セルフチェック結果（playbook §16.4.2）

- DES-002/003/004 の版・ステータス整合を確認。
- DES-002 §7.5 取込対象に drive_parry 追加・対象外リストから drive_parry 除去・役割分担注記の3点を確認。DES-003 §3.3 注記の並置を確認。DES-004 §2.1 行整理を確認。
- 3 設計書で drive_parry / parry_drive_rush の概念がぶれていないか目視突合（move＝drive_parry、modifiers.type＝parry_drive_rush で一貫）。
- registry の 038 使用済み／039 次回／§3 3 行／§4 v1.25.0 の相互整合を確認。

---

*以上、change-report-038 v1.0.0。リポジトリ正規パスへの実反映・git 操作、および CHANGE-023/026 md への方針転換追記は開発者／Claude Code の責任範囲。*
