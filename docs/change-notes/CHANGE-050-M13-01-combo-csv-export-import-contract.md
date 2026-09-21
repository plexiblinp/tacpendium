# CHANGE-050 通知書: コンボ CSV エクスポート/インポート契約の正典化（M13-01）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-050 |
| サブマイルストーン | M13-01 |
| 起票日 | 2026-06-28 |
| 起票者 | 設計担当 Claude（フェーズ3 キックオフ担当） |
| 承認者 | 開発者（M13-01 着手前。コンボ CSV 契約の正典化＝製造担当が本契約に対して M13-01 を実装する。本通知書は DES 反映用） |
| ステータス | **反映済み**（DES-002 v1.24.0→v1.25.0 / DES-006 v1.13.0→v1.14.0。commit は開発者） |
| 影響設計書 | DES-002（v1.24.0→v1.25.0）/ DES-006（v1.13.0→v1.14.0）。**DES-005 は変更なし**（§5.13/§5.14 が既に完備） |
| 関連 | M13-RESEARCH-01-report（統合可否・10 要決定事項）、指示書 M13-01 v1.0.0、phase3-overview §M13 |

---

## 1. 変更の概要

M13-01（FR401/405 コンボ CSV エクスポート/インポート）の着手前に、**コンボ CSV のカラム契約**を DES へ正典化する。先行調査（M13-RESEARCH-01）で、import 検証（DES-006 §6 VAL-I01〜09）・コンボ/セットプレイ CSV 分離（`local_id`/`parent_combo_local_id`）・行選択・重複動作（DES-005 §5.13/§5.14）は**既に DES に存在**することが判明した。未記載だった以下 2 点のみを補う:

- **コンボ CSV のカラム契約**が DES に無い（DES-002 §7.5 は FR704 moves 契約で別物）。→ **DES-002 §7.6 を新設**。
- **CSV 式注入（数式/DDE 注入）の無害化**が VAL に無い（VAL-I08 は URL 非リンク化のみ）。→ **DES-006 §6 に VAL-I10 を新設**。

## 2. 変更の内容

### 2.1 DES-002（v1.25.0）— §7.6 新設「コンボ CSV エクスポート/インポート フォーマット（FR401/405）」

- **位置づけ**: ユーザデータの可搬化（export FR401 / import FR405）。**公式データ取込（FR704・§7.5）とは別系統**。エンドポイント §4.2（`GET /api/export/csv`・`POST /api/import/csv`〔+ `/preview`〕）、画面 DES-005 §5.13/§5.14、検証 DES-006 §6。
- **意味単位（code ベース）**: 物理列直書きをせず `character_code`/`move_code` 等で出力・取込。DB 管理列（id/version/created_at/updated_at/deleted_at/step_count/recipe_cache）は非出力（取込時再生成）。スキーマ変更（M14 の moves 列増減等）に頑健（M13-RESEARCH-01 §C-4）。
- **コンボ CSV カラム**（DES-003 combos 対応）: `local_id` / `character_code` / `recipe`（move_code 系列） / メタデータ（is_draft・damage・drive_available_at_start・sa_available_at_start・**drive_damage〔REAL・小数 -6〜6〕**・knockdown_advantage・position・opponent_stance・hit_type・opponent_size・memo・situation・**起き攻め 6 列〔NULL 可・空=NULL／true/false 明示〕**） / `tags`（name 埋込・import で解決/新規作成） / **`starter_move_id` は非出力＝import 時にレシピ先頭から再導出**（VAL-C02/C03 整合・レガシー starter≠先頭は正規化）。
- **セットプレイ CSV カラム**（DES-003 setups 対応）: `parent_combo_local_id`（コンボ local_id 参照／既存コンボは実 ID）+ レシピ・名称・メタデータ。
- **型・NULL 表現**: drive_damage REAL（小数欠落させない）、起き攻め 6 列 NULL 可（空=NULL／true・false 明示）。
- **重複動作**: VAL-C02（DuplicateKey）重複時の スキップ/上書き/新規追加 はユーザ選択（DES-005 §5.14）。
- **無害化・検証**: DES-006 §6（VAL-I01〜I10）。コンボ CSV（FR405）は NFR103 文脈（FR704 の §7.4 ローカルファイル文脈と異なる）。

### 2.2 DES-006（v1.14.0）— §6 に VAL-I10 新設

- **VAL-I10**: インポートデータのセル値を式・コマンドとして解釈・実行しない（先頭 `= + - @` 等を式評価しない）。表示時エスケープ・再エクスポート時は `'` 接頭辞等で無害化。CSV インジェクション（DDE/数式注入）対策（セキュリティ対応）。VAL-I08（URL 非リンク化＝SSRF）と並ぶ表示/出力ハードニング。

### 2.3 DES-005 — 変更なし

§5.13（エクスポート）/§5.14（インポート）が既に **出力形式（CSV/PDF/PNG/クリップボード）・CSV 別ファイル（local_id/parent_combo_local_id）・重複時動作選択（スキップ/上書き/新規追加）・行チェックボックス・NFR103** を規定済み。M13-01 のスコープ（CSV のみ。PDF/PNG/クリップボードは M13-02）は overview/指示書側の段階分割であり DES テキスト変更を要しない。

## 3. 確定した設計判断

| 項目 | 判断 | 根拠 |
|------|------|------|
| コンボ CSV 契約の置き場 | **DES-002 §7.6 新設**（FR704 §7.5 と別系統と明記） | moves CSV（§7.5）と対称。§7 を「CSV データ交換」として両系統を収容 |
| 意味単位（code ベース・DB 管理列除外） | 採用 | M14 の moves 列変更への頑健性（M13-RESEARCH-01 §C-4・F12-7） |
| drive_damage REAL / 起き攻め nullable | 本体モデル（CHANGE-046・DES-003）へ整合 | 統合元の `*int`/非 NULL は旧形＝小数欠落・nil/false 混同を防ぐ（報告 #2/#4） |
| starter_move_id 非出力・import 再導出 | 採用 | VAL-C03（starter＝レシピ先頭）・VAL-C02（DuplicateKey）と整合。レガシー starter≠先頭は正規化（報告 #3） |
| VAL-I10（式注入無害化）新設 | 採用 | 報告 #8 の穴（外部成果物にも本体 movesimport にも無し）。NFR103 のセキュリティ要件として明文化 |
| DES-005 §5.13/§5.14 | **変更なし**（既に完備） | 重複動作・CSV 別ファイル・行選択・形式が既存。漏れ検知の結果、追記不要 |

## 4. 影響範囲

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-002 / DES-006 | §2.1〜§2.2 |
| 設計書本体 | DES-005 / DES-003 / DES-004 | **変更なし**（DES-005 既存完備・DES-003 は drive_damage/oki/starter の既定義を参照・DES-004 は notation 対象外） |
| 実装 | M13-01（comboio export/import・FE/BE） | 本契約に対して実装。Plan Mode で重複動作既定値・code→id・無害化担保層等を確定 |

## 5. 移行影響・リスク

- **後方互換**: 新設のみ（既存契約・既存 API 形状の変更なし）。既存コンボデータへの影響なし。
- **統合元の旧形是正**: drive_damage（`*int`→REAL）・起き攻め（非 NULL→nullable）の型整合を本体側で吸収（M13-01 §4.9）。往復で小数・nil/false を保つ。
- **M14 との順序**: export は意味単位のため M14 の moves 列変更に頑健（順序依存リスクなし）。

## 6. 直列化

- 本 CHANGE-050 が触る DES-002 §7 / DES-006 §6 を同時に触る他 CHANGE は現時点でなし。CHANGE-049（DES-002 設定パス・§アーキ「DBファイル配置」）と非干渉（別節）。

## 7. 開発者への確認事項

1. **§7.6 の置き場**: コンボ CSV 契約を DES-002 §7（公式データ取込）配下の §7.6 に「別系統」と明記して収めた。別章（新 §）への分離を希望する場合はご指示ください。暫定案: §7.6（moves §7.5 と対称・最小構成）。
2. **VAL-I10 のスコープ**: 式注入無害化を「表示時エスケープ＋再 export 時 `'` 接頭辞」で規定。担保層（service/handler/frontend）の具体は M13-01 Plan Mode で確定（DES は要件のみ規定）。この粒度でよいか。

---

> 反映済み（DES-002 v1.25.0 / DES-006 v1.14.0）。change-report-050 / change-number-registry（050 使用済み・次 051）を更新。commit/push は開発者。

*以上、CHANGE-050 通知書。配置 `docs/change-notes/CHANGE-050-M13-01-combo-csv-export-import-contract.md`。*
