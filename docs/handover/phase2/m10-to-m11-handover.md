# M10 → M11 引き継ぎ（設計担当チャット継続用）

| 項目 | 内容 |
|------|------|
| 文書ID | M10-TO-M11-HANDOVER |
| バージョン | 1.0.0 |
| 作成日 | 2026-06-18 |
| 作成者 | 設計担当 Claude（フェーズ2 本流スパイン・M10 担当） |
| ステータス | M10 完了（M10-01/02 E2E 通過）。M11 は新規チャットで着手 |
| 用途 | M10 完了状態・現行設計書バージョン・M11 スコープの既知事項・持ち越し課題を、M11 担当の新規設計チャットへ引き継ぐ。**M11 はコンテキストを新鮮に保つため別チャットで実施**（M10 担当の判断＝設計重い M11 を圧縮済みチャットに載せない、retrospective-log §7.1 コンテキスト圧迫メタパターン回避） |
| 前提 | 本書と docs-map.md（`docs/handover/docs-map.md`、自動生成）を最初に読むこと。文書ID→実パスは docs-map で解決する |

---

## 1. M10 完了状態

- **M10-01（ComboEditor キャラクター選択化、A-1）完了**（E2E 通過）。新規モードはキャラ選択プルダウン化、編集モードは固定表示、CHANGE-036 の切替挙動（dirty 時に確認→破棄で全体リセット／キャンセルで選択 revert）を実装。選択キャラに moves／始動技／仮想コントローラ／束ねセットプレイ／重複検知が追従。既定は `INITIAL_CHARACTER_ID`。フロント完結（登録系 API は character_id 既存）。
- **M10-02（リュウ固定依存 UX の画面横断解消、A-2）完了**（E2E 通過）。新規登録の既定キャラを文脈追従（一覧 ComboListPage の選択キャラ→`?character=`→ComboEditor `initialCharacterId`、文脈なしは INITIAL_CHARACTER_ID）。コンボ追加モーダルの既定を比較リスト先頭コンボのキャラに追従（`defaultCharacterId`）。一覧情報バーのリュウ固定 defect も是正。**マイコンボには新規登録導線が無く・設けない**（導線はホーム／フッター／一覧の3箇所）。選択モード（useSelectMode）はキャラ非依存＝対象外と確認。
- M10 で **situation（キャラ固有状態）は汎用入力のまま据え置き**（custom_states 消費は M11、§4 参照）。

## 2. 現行設計書バージョン一覧（M10 完了時点）

| 文書ID | バージョン | 備考（M10 期間の変更） |
|--------|-----------|----------------------|
| REQ-001 | v2.15.0 | 変更なし |
| DES-001 | v1.3.0 | 変更なし |
| DES-002 | **v1.20.0** | CHANGE-038（§7.5 drive_parry 取込スコープ＋役割分担注記） |
| DES-003 | **v1.21.0** | CHANGE-038（§3.3「ドライブパリィの扱い」注記） |
| DES-004 | **v1.6.2** | CHANGE-037（§3.4 サンプル code 整合）＋CHANGE-038（§2.1 共通システム行整理） |
| DES-005 | **v2.21.1** | CHANGE-036（§5.7 切替挙動）＋CHANGE-039（§4.3/§5.7/§5.8 既定キャラ文脈追従）＋v2.21.1 errata（新規登録の文脈追従元を一覧のみに是正） |
| DES-006 | v1.11.0 | 変更なし |
| SUPP-001 | v1.24.0 | 変更なし |
| playbook | v1.11.0 | 変更なし |
| change-number-registry | **v1.27.0** | 後述 |
| model-allocation | **v1.16.0** | M10-01=Opus 4.8／M10-02=Sonnet 4.6 確定 |
| retrospective-log | **v1.0.38** | §6.6.3 M10 期間 確定 |
| code-facts | commit ff0620b | §7-2 リクエスト DTO 追加版 |
| docs-map | commit 9fd1a69 | **要再生成**（後述§7） |

## 3. CHANGE 番号の状態（registry v1.27.0）

- **使用済み**: 〜039（M10 期間：CHANGE-036 / 037 / 038 / 039）。
- **次回採番は 040 から**。欠番 008 / 009 / 014（再利用しない）。
- CHANGE-039 は実装整合 errata で DES-005 v2.21.0→v2.21.1（新規 CHANGE は起こさず 039 の errata として処理）。
- **CHANGE-023 / 026 の md に「CHANGE-038 で drive_parry 取込方針が転換した旨」を Claude Code が追記予定**（履歴追跡用。md 自体は改廃しない）。

## 4. M11 スコープ（既知事項・設計は M11 チャットで）

> **M11 = custom_states 開始時状態（situation のキャラ固有状態）の機能化**。本節は既知事項と論点の整理のみ。詳細設計（overview／指示書／CHANGE／Plan Mode）は M11 チャットで通常フローに沿って行う。

- **現状**: custom_states は phase-1 で**保存／API のみ実装、消費（機能化）は未実装**（architecture-patterns §9.1）。DES-005 §5.7 表示項目5「situation（キャラ固有状態）」は M10 時点で汎用入力のまま。
- **目的（想定）**: キャラ固有の開始時状態（例：電刃〔denjin〕等の boolean 状態）をコンボに付与・参照できるようにする。キャラを選んでも situation が機能しない M10 の既知制約（C.ヴァイパー／ダルシム等でも未機能）を解消する。
- **設計で詰める論点（M11 チャットで）**:
  1. custom_states の**消費ロジック**（保存済み状態をどこで読み・コンボ計算／表示へどう効かせるか）。
  2. **キャラ別の状態定義**（どのキャラがどの開始時状態を持つか。データ駆動か定義テーブルか）。
  3. **状態付与 UI**（situation のキャラ別動的状態 UI）。DES-005 §5.7 表示項目5 の機能化。
  4. 影響する設計書（DES-003 custom_states スキーマ／DES-005 §5.7／場合により DES-002 API）と CHANGE 判断。
- **関連参照**: REQ-001（custom_states / situation の FR）、DES-003 §3.x（custom_states スキーマ）、DES-005 §5.7、architecture-patterns §9.1。**実コードで custom_states の保存/API の現状を裏取りしてから設計する**（想定で書かない）。

## 5. M11 着手時の前向き注意点（retrospective-log §6.6.3 由来）

- **「固定前提・未消費前提を有効化する改修は、phase-1 時代の固定/未消費前提を露出させる」**（M10-2／M10-5）。M11 は custom_states 消費の有効化＝まさにこの型。**有効化対象（situation／custom_states）の周辺で、phase-1 で固定値・未消費を前提にしたハードコードや分岐が残っていないかを §3.4 着手前確認に含める**こと。
- **実コード・実態・正典の未確認を避ける**（M10-DP／M10-1／M10-4＝パターン A）。修正対象・E2E 起点・導線の存在は実コードで確認してから指示書に書く。正典は DES 本体（最新 CHANGE 反映後）で確認（DB 実査＝正典ではない）。
- **将来送り／スコープ外の組合せが生む利用者帰結を明記**（playbook §4.11）。

## 6. 持ち越し課題（followup-backlog 参照）

> 正典は `docs/handover/followup-backlog.md`（旧 m9-03-followup-backlog.md を改称・継承）。M11 スコープ外だが M11 期間の優先で再評価可。

- **B-7（中・M12-02 系連動）**: 仮想コントローラ `BUTTON_TO_MOVE_CODE` ／ seed の move_code 旧形→新形（`standing_*` 等）統一。正典は DES-004 §2.1＝新形、逸脱は seed・コントローラ側。コントローラ更新と seed 新形化はロックステップ必須。初期キャラの FR701 再取込＋seed 削除（M12-02）と束ねるのが効率的。M10-02 の文脈追従で当該不具合に遭遇する導線が増えたため優先再評価の余地。
- **B-8（低）**: 一覧情報バーのロード中フォールバックがリュウ固定文言。方針＝ロード中は中立フォールバック（スケルトン/空）。DES-005 §5.4 範囲内＝CHANGE 不要の小修正。
- **B-9（低・フェーズ3）**: 情報バー頭文字の i18n（英語ロケール整備に合流）。
- **drive_parry 取込（課題5）**: CHANGE-038 で本体 DES（DES-002 §7.5）は受入準備済み。取込実装は**外部 FR701 ツール側（別設計書・別チャット）で対応中**＝本 backlog 管理外。
- **B-1〜B-6（M9-03 由来）**: 命名クラスタ／moves 手動 CRUD／フレーム計算式（開発者課題）／要確認再導出／複数 CSV／検証強度。M9 外後続候補。

## 7. ドキュメント参照・リポジトリ反映の残

- **最初に読む**: 本書 ＋ `docs/handover/docs-map.md`（文書ID→実パス）＋ `docs/handover/retrospective-digest.md`（現役教訓の蒸留）＋ `docs/handover/code-facts.md`。
- **開発者側リポジトリ反映の残（M10-02 完了時点）**: DES-005 v2.21.1 ＋ registry v1.27.0 ＋ CHANGE-039 errata 追補の反映、CHANGE-023/026 md への方針転換追記（Claude Code）。
- **docs-map 再生成が必要**: 前ターンの backlog 改称（`m9-03-followup-backlog.md`→`followup-backlog.md`）＋ M10 期間の新規ファイル（M10-overview／M10-01・02 指示書／reviews／CHANGE-036〜039／change-report-036〜039）反映のため、`scripts/generate-docs-map.sh` を再実行して docs-map を更新する。旧名 `m9-03-followup-backlog.md` を参照する資料があれば新名へ更新。

## 8. モデル配分（model-allocation v1.16.0）

- M10-01 = Opus 4.8（実装）／ Sonnet 4.6（レビュー）。M10-02 = Sonnet 4.6（実装・レビュー）。
- M11 は着手時に判断（custom_states 消費は設計・実装とも関心が絡む見込み＝Opus + Plan Mode 必須の可能性。指示書 §7／model-allocation §7 判断軸で決定）。

## 9. retrospective-log の状態

- §6.6.3「M10 期間の反省」確定（v1.0.38）。M10-DP／M10-1／M10-2／M10-3／M10-4／M10-5。新規 §1 パターン追加は不要（パターン A の再確認）。M10-2／M10-5 の「有効化改修が phase-1 固定前提を露出」を M11 へ前向き送り（§5）。
- 教訓の retrospective-digest 繰り込みは Claude Code の `/retrospective-digest-update` で実施予定。

## 10. 設計担当への申し送り（運用）

- 反映ワークフロー（playbook §16.4）：CHANGE 通知書（承認＝開発者依頼/Plan Mode 確定で承認・反映扱い）→ DES 本体改訂（版・ステータス更新）→ change-report → registry（番号表/改訂表/更新履歴）。セルフチェック（§16.4.2）で版整合・概念ぶれを目視突合。
- 命名：CHANGE 通知書 `CHANGE-{番号}-{サブマイルストーン番号}-{概要}.md`、完了レポート `change-report-{番号}.md`。リネーム時は内側バージョン据え置き。
- 規律：想定で書かない（実コードで裏取り）／CHANGE 対象は REQ-001＋DES-001〜006 のみ（補足資料は自由改訂）／マイルストーン構造・新規 overview・CHANGE 対象の独断拡張禁止（playbook §4.12、パターン F）／将来送り・スコープ外の帰結明記（§4.11）／実機 E2E が完了の必須ゲート。
- 成果物は `/mnt/user-data/outputs/` に出力し present_files で提示。リポジトリ実反映・git 操作は開発者責任。

---

*以上、M10 → M11 引き継ぎ v1.0.0。配置 `docs/handover/m10-to-m11-handover.md`。*
