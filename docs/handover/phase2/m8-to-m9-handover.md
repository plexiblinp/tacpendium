# M8 → M9 引き継ぎ事項

| 項目 | 内容 |
|------|------|
| 文書ID | m8-to-m9-handover |
| バージョン | 1.2.0 |
| 作成日 | 2026-06-13 |
| 作成者 | 設計担当 Claude（フェーズ2 継続担当・M8 スパイン期間） |
| 引継ぎ対象 | 設計担当 Claude（フェーズ2 継続担当・新セッション。M9-02 以降の本流を担う） |
| 用途 | 本セッション（M8-RESEARCH-01 / CHANGE-024〜027 / M8-01 / M8-02）の完遂を引き継ぐ。**M9-01（FR701 取込ツール）は別チャットで完了済み**のため、次セッションは **M9-02（FR704 本体取込）から開始**する |
| 前提 | design-instruction-playbook v1.9.1、phase2-overview v0.2.0、phase2-kickoff-design-session-handover v1.0.0（前セッションの主引き継ぎ） |

---

## 0. 新セッション開始時の最優先作業

> **開始点**: M8（M8-01 スキーマ / M8-02 E2E 基盤）完了。M9-01（FR701 取込ツール）は別チャットで完了済み。**本セッションは M9-02（FR704 アプリ取込）の設計から始める**（M9-01 の再着手は不要）。

1. `design-instruction-playbook.md`（設計担当の恒久運用ルール、最初に読む）と **本書** を読む。
2. `phase2-overview.md` v0.2.0（M8〜M12 構成の正本。M8-02 追加済み）。
3. 関連 CHANGE 通知書（024〜027）と change-report（024〜027）、`change-number-registry`（次採番 **028**）。
4. M9-02 設計の前提資料: DES-002 v1.13.0 §7.5（CSV 契約）、DES-003 v1.18.0 §3.3（moves）、DES-004 v1.6.0 §2.1（code 規約）、SUPP-001 v1.24.0 §4.5（E2E 実装メモ）/ §3.3.2（seed 境界）、`fr701-mainline-handover` + `fr701-m9-02-handover-addendum`（FR701 ツール由来の本体連携）。
5. 現状認識を 1 メッセージで開発者に共有してから、**M9-02（FR704 アプリ取込）の設計**に着手する（§3）。

---

## 1. 本セッションが完遂したこと

- **E2E Playwright 前倒し検討**: M8-RESEARCH-01（read-only 実現性調査、本プロジェクト 7 例目の調査担当運用）→ 採否案 A（段階導入）採用 → **CHANGE-024 起票・反映**（DES-002 §12 v1.13.0 / SUPP §4.5 v1.23.0、phase2-overview に M8-02 追加、model-allocation v1.9.0）。
- **FR701 実データ反映訂正**: 並列委任の FR701 ツール設計（別チャット）が 30 キャラ全数調査で判明した事実を、影響面で 3 通に分割して **CHANGE-025/026/027 起票・反映**（詳細 §2）。
- **M8-01（moves 8 列追加マイグレーション）**: 製造指示書 v1.2.1 + レビューチェックリスト v1.1.0 作成 → 投入 → 検収完了。Plan Mode で真偽列を `INTEGER NOT NULL DEFAULT 0` に確定（SUPP §2.7 規約化）、検収申し送り A-1〜A-4 対応（§7）。
- **M8-02（E2E 基盤）**: 製造指示書 v1.0.0 + レビューチェックリスト v1.0.0 作成、投入。**製造中**（§6）。
- **retrospective-log v1.0.30**: §6.6.1「M8 期間の反省」（M8-1〜M8-3 + M8-A4 + B 追認）。

---

## 2. 確定事項（再協議不要）

- **moves スキーマ（DES-003 §3.3 v1.18.0）**: 8 列追加済み（M8-01 検収完了）。`startup` / `total` は **NULL 可**（CHANGE-025、算出不能行は NULL）。真偽列 `is_aerial` / `setup_only` は物理 `INTEGER NOT NULL DEFAULT 0`（SUPP §2.7。論理型は BOOLEAN）。category enum に **`critical_art`** 追加（CA は SA3 と別行）。
- **code 規約（DES-004 §2.1 v1.6.0）**: 英語表示名の機械変換（`standing_medium_punch` 形式、強度接尾辞 `_light/_medium/_heavy/_od`、slug 連結 `aki`/`c_viper`/`m_bison`、`_2` フォールバック、SA=`sa1_`〜`sa3_`、CA=`ca`、投げ 1・2 件目 `throw_forward`/`throw_back`、`rush_<元技code>`）。
- **取込対象（DES-002 §7.5 v1.13.0、CHANGE-026）**: キャラセグメント（通常/特殊/必殺/SA/通常投げ）は**非攻撃含め全行**取込、共通システムは **DI のみ**（位置+名称 `ドライブインパクト` 前方一致で判別、ダメージ判別は撤回）。ターゲットコンボは段数付き行を所属 category で取込・機械判別なし。
- **通常投げ**: 1・2 件目 = 前投げ/後ろ投げ自動採番（公式名は notes に `公式名: …` 退避）、3 件目以降 = 公式名保持・要確認、`（ジャンプ中に）`は is_aerial=true。
- **on_hit/on_block + notes 書式**: `D`→空欄+notes、`※N`→数値+notes、範囲→空欄+notes。notes 付記書式 `【ツール付記】…`。drive_gauge_decrease_punish は出力。
- **recovery 入力パターン**: 整数 / `全体 N` / `着地後N` / `N+着地後M` / `N-着地まで` / `[※2] 1-12` / 空欄。空欄→total NULL。
- **command/condition**: CSV に 3 列（command/condition_ja/condition_en）追加、FR704 は **moves.raw_data へ同名キー退避**（専用列なし=マイグレ不要、CHANGE-027）。official_ja_command 接続はフェーズ3以降。
- **seed**: 既存 seed（moves 186 件・characters）は削除・ツール再生成前提。参照 combos/combo_steps/recipe_cache はクリア（CHANGE-025）。seed クリア+再生成マイグレは M9 で設計。
- **total 算出式（案B、開発者定義 2026-06-10）**: `total = 発生 + 持続 − 1 + 硬直`（+ 備考「空振り時増加F」は FR703 手動補正）。`−1` は発生最終フレームと持続初フレームの重複補正。**DES-003 §3.3 への正式記載は M9-02 着手前に CHANGE 起票**（現行注記 L332 のプレースホルダを具体化。次番号 028）。
- **E2E**: 段階導入（CHANGE-024）。基盤=M8-02。視覚/レスポンシブ/LAN/実機は手動継続、CI は本フェーズ非構築。
- **真偽列物理表現**: BOOLEAN 論理型は migration で `INTEGER NOT NULL DEFAULT 0`（SUPP §2.7）。

---

## 3. 本流タスク（M9-02 以降）

### M9-01（FR701 取込ツール）= 完了（別チャット）

CSV 出力ツールは完成。本体とは CSV 契約（DES-002 §7.5）越しに疎結合。FR701 由来の本体連携事項は CHANGE-025/026/027 + 下記 addendum で反映済み。

### M9-02（FR704 アプリ取込）= 次の本流。着手前確認・設計入力

`POST /api/import/moves`（DES-002 §4.2）、プレビュー + 行単位 upsert（upsert キー `(character_id, code)`）。設計入力:

1. **total 算出ロジック**: §2 の式を実装。recovery は公式原文文字列（§2 のパターン）をパースして硬直を得る。算出不能（発生・硬直空欄、実測 11 行）は total=NULL。**着手前に total 式の DES-003 記載 CHANGE（028）を起票**。
2. **combo_scaling キー = 確定済み**: 正準キーは **`initial_scaling` / `combo_scaling` / `immediate_scaling` / `multiplier_scaling`**（DES-003 §3.3 L302-305）。FR701 ツールの旧写像（initial/combo/immediate/multiplicative）は不一致 → **ツール側が本体定義へ追従**（2026-06-13 回答済み、addendum §1）。M9-02 はこの正準キーで補正値を解釈する。ツール追従が反映されたか取込前に確認。
3. **notes パース（addendum §2）**: ツールは 3 層出力（原文ブロック `;` 連結 / 境界 `【ツール付記】` / 付記ブロック `; ` 連結）。**パース方針 = `【ツール付記】`で 2 分割**（前半=原文・後半=付記）。原文に `; `（スペースあり）が含まれると境界が曖昧化する残リスクあり → 本体の notes 取扱い方針（原文再分割の要否・表示要件）を m9-overview で確定。
4. **properties 正規化**: 取込時に公式属性 → コード値正規化（CHANGE-022 既定。raw_data に残余退避）。
5. **critical_art 写像**: CA 行を `category=critical_art`、code `ca` で取込。
6. **取込対象判別**: §2（位置+名称、DI のみ共通システム）。
7. **フレーバー母集団（addendum §3、認識共有）**: フレーバー判定不変条件 1,041 件はスコープフィルタ前の全マージ行が母集団。検証時に取込行のみで数え直すと一致しない（TOOL-002 §9.1）。対応不要、検証時の注意のみ。
8. **【アーキテクチャ判断・M8-A4】model.Move vs MoveListItem の二重定義**: `internal/model/move.go` の `Move`（構築箇所ゼロの実質デッドコード）と `repository/move` の `MoveListItem`（GET 経路が実使用する投影型）にフィールド集合が二重に存在し手動同期が必要。M9 でフィールド利用が増えるほど同期漏れリスク増。**M9-02 設計時に正準 move 型への集約を判断**（推奨: 単一の正準型に集約 = MoveListItem を model.Move から導出するか、repository が model.Move を scan する形へ寄せる。実コード可視な M9-02 で確定）。
9. CHANGE 見込み: 取込プレビュー/グリッド編集/サイズ上限の挙動を m9-overview で設計し、DES-005 への UI 追記要否を判断。

### M9-03（FR703 手動修正）

取込プレビューのグリッド編集、ラッシュ版生成、is_aerial 手動トグル、投げ並び順の例外補正、notes 付記の手動編集。M9-02 の取込結果に作用。

### M10〜M12（phase2-overview §3）

- M10（複数キャラ登録 UI、A-1/A-2）: ComboEditor のリュウ固定解消。M9 でデータ投入後。
- M11（custom_states 開始時状態）: boolean 中心、消費はモデル化せず notes 管理。M8 と独立。
- M12（先行リリース仕上げ）: M12-01 UX、M12-02 seed 整理（耐久 seed 000012 除去）、**M12-03 統合 E2E + 配布判定**。

---

## 4. ドキュメント状態（最新版数）

| 文書 | 版 | 備考 |
|------|-----|------|
| DES-002 | v1.13.0 | §7.5（CHANGE-026/027）+ §12（CHANGE-024）+ §4.2 errata（v1.12.1） |
| DES-003 | v1.18.0 | §3.3（CHANGE-025/027） |
| DES-004 | v1.6.0 | §2.1 code 規約（CHANGE-025） |
| SUPP-001 | v1.24.0 | §4.5 E2E 段階導入 + 実装メモ、§3.3.2 seed 境界、§2.7 真偽列規約 |
| phase2-overview | v0.2.0 | M8-02 追加 |
| model-allocation | v1.9.0 | M8 行（RESEARCH-01/01/02） |
| retrospective-log | v1.0.30 | §6.6.1 M8 期間 |
| change-number-registry | — | 024〜027 反映済み、**次採番 028**、欠番 008/009/014 |
| docs/design/testid-convention.md | （製造新設） | test-id 正本、補足資料同格（自由改訂） |

- CHANGE 通知書 024/025/026/027 + change-report 024/025/026/027 は反映済み。
- **次の CHANGE = 028**（最有力は total 算出式の DES-003 §3.3 記載＝M9-02 着手前）。

---

## 5. E2E ワークストリーム（M8-02）

- **状態: 基盤成立（`make e2e` 通過、2026-06-13）**。combo-crud.spec.ts（コンボ CRUD スモーク 1 本）が毎回検証される。
- **自動化済み**: combo-crud（/combos/new → 仮登録 ON → メモ保存 → 詳細遷移・メモ可視 → 編集 → メモ更新・旧メモ消失 → 削除確認ダイアログ → 一覧へ）。前提=ウィザード完了済み DB、件数非依存。
- **自動化対象外（手動継続）**: 視覚・レイアウト・レスポンシブ・shadcn/ui の見た目、**RecipeBuilder 操作（ステップ入力・技セレクタ・D&D＝レシピ本体。現 spec は isDraft で迂回し未カバー）**、LAN/実機、セットプレイ・タグ・比較（spec 未作成、M9〜M12 で追加）。
- **既知の自動化ギャップ**: 現 CRUD spec はコンボのメタ情報（メモ）レベルで、レシピ本体は検証していない。レシピ本体の自動化は D&D 等の難度があり**将来検討**（spec 拡充時の候補）。
- 基盤内容（指示書 v1.0.0）: `@playwright/test` + `playwright.config.ts`（vite 5173 / backend 47318、dual webServer + reuseExistingServer）+ test-id 規約（`docs/design/testid-convention.md`）+ ローカル実行（`pnpm e2e` / `make e2e`）+ 初回 spec `combo-crud.spec.ts` 1 本。
- 再利用 E2E パターン（spec 拡充時に踏襲、SUPP §4.5 実装メモ）: (a) `isDraft: true` 0 ステップ保存で RecipeBuilder を回避、(b) seed 件数非依存 self-contained spec（M9 で seed 再生成のため必須）、(c) playwright.config の動的ポート読取（L-04 追従）。
- 積み残し: `playwright.config.ts` を `web/tsconfig.json` の include に未追加（フェーズ3 で再検討）。
- 以降の spec 拡充は M9〜M12 の機能追加に相乗り。

---

## 6. 申し送り・リスク

- **設計担当ミスの傾向（retrospective-log §1 / §6.6.1）**: 「実コード/既存慣習確認の省略」（論理型 vs 物理宣言、設計書表記 vs 実装実態）が継続パターン。M9-02 着手時は **DES-003 §3.3 の実 JSON キー・既存実装慣例・実ルートを view 確認**してから指示書化すること（M8-1/M8-2 の再発防止）。
- **M8-A4（model.Move 集約）は M9-02 のアーキテクチャ判断**として必ず扱う（§3）。
- **total 式 CHANGE（028）を M9-02 着手前に起票**（案B 既定、開発者承認済みの式を DES-003 §3.3 へ記載）。
- FR701 ツールは別チャットで完了。本体連携は CSV 契約（DES-002 §7.5）+ TOOL-002 を介す。combo_scaling キー追従の反映確認だけ M9-02 取込前に行う（§3）。
- model 配分は各サブユニット着手時に model-allocation へ追記（M9-02 は複数システム統合・取込ロジックで関心数中〜大 → Opus クラス検討）。

---

## 更新履歴

| 版 | 日付 | 内容 |
|----|------|------|
| 1.0.0 | 2026-06-13 | 初版 |
| 1.1.0 | 2026-06-13 | §5 を M8-02 基盤成立（make e2e 通過）へ更新。自動化済み/対象外スコープを確定、レシピ本体未カバーの既知ギャップを明記 |
| 1.2.0 | 2026-06-13 | マイルストーン間 handover の命名へ変更（`m8-to-m9-handover`、タイトル「M8 → M9 引き継ぎ事項」）。M9-01 完了・M9-02 開始を用途と §0 で明示 |

*以上、M8 → M9 引き継ぎ事項 v1.2.0*
