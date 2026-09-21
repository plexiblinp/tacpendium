# 指示書 M18-01: 確定反撃スキーマ基盤（combo_punishes／距離除外 2 表／materialize 出自／is_projectile／hit_type 拡張）

| 項目 | 内容 |
|------|------|
| 文書ID | M18-01 |
| バージョン | **v0.2.3**（**M18-01 完了・残ゲートなし**。E2E は開発者環境で `make e2e` green ＋手動 E2E 確認済〔2026-07-22〕。plan v0.6.0-plan／CHANGE-081 改訂版と突合済） |
| 作成日 | 2026-07-19 |
| 作成者 | M18 指示書担当 Claude（playbook §15.6） |
| サブ | M18-01（スキーマ基盤・M18-02/03 の前提） |
| 推奨モデル | 製造 = **Opus 4.8 ＋ Plan Mode 必須**（新ドメイン・新規テーブル 3・新列 2・backfill・契約整合／model-allocation M18-01）。レビュー = Sonnet 4.6 |
| Plan Mode | **必須**（§3.3 でマイグレ連番の実査・seedgen 非改変・dbtest スキーマ・DROP COLUMN 方式を確定させる） |
| 配置（完成品） | `docs/instructions/phase3/M18-01-schema-foundation.md` |

---

## 更新履歴
- v0.1.0（2026-07-19）: 初版ドラフト。CHANGE-078〜082（着手前ゲート・起票済）を搬送順に実装手順化。is_projectile の 7 件是正（開発者確定 2026-07-19）を反映。中央初回レビュー（委任 §5）前。
- v0.1.1（2026-07-19）: 確認事項③を解決反映＝shuriken_bomb 系は **recovery=0・on_block=NULL**（#5 addendum-report §1/§2 dev DB 実測）で確定し、§4.4/§11-3 の「recovery=NULL 要検証」を close（A-3 の "recovery=NULL" は report 誤記・A-1 と整合）。①パッケージングは中央へ上申（推奨＝CHANGE-081 同梱）。
- v0.1.2（2026-07-19）: 確認事項①を中央確定反映＝is_projectile 是正 7 件＋backfill は **CHANGE-081 に同梱・別 CHANGE 不要・検算は change-report-081 に集約**。§11 の未確定を解消（残は暫定案どおり確定扱いの②④のみ）。初回レビュー投入可。
- v0.2.3（2026-07-22）: **残ゲート解消＝完了**。開発者環境で `make e2e` を実行し green、加えて手動 E2E でも問題なしを確認（E-17 の開発者実確認に相当）。§5.2 の環境制約注記を「解消済」へ、§11-7 をクローズ。
- v0.2.2（2026-07-22）: **実装完了（9 コミット `4df5f28`〜`d95355c`・push 済）を一次受け**。差し替え版（plan v0.6.0-plan §3.4／CHANGE-081 改訂版 §2-b/§4/§5）と §4.4 を突合し**一致を確認**。反映＝(1) §4.5 hit_type ラベルを開発者変更「**パニッシュカウンター(ジャストパリィ反撃)**」へ（内部値・スキーマ・CSV 写像・dup は不変）、(2) §4.4 件数の母数を是正（**backfill 一次源 seeded-10＝104 は不変**／「全 CSV 109」は RESEARCH スナップショット後に未 seed CSV が追加されたため**実測 122** へ）、(3) §4.5 に `HIT_TYPE_OPTIONS` への新値追加を**是認**として明記、(4) §5.2 に E2E 未実行（環境要因）と代替担保・再実行ゲートを記録。
- v0.2.1（2026-07-19）: **中央承認 (A)(B) を反映**（文書追従のみ・要件不変＝実装中の手戻りなし）。(A) is_projectile は backfill 専用・`internal/seedgen` 非改変で確定（決定 #3→**#3-rev**）。CHANGE-081 は**番号 081 保持で通知書改訂済**・plan **v0.6.0-plan**・registry **v1.73.0**。(B) 「manon/luke 自動反映」は撤回・是正済で、**followup-backlog C-1（`M14-03-is-projectile-backfill`）へ繰越登録**（指示書本体への追記は M14-03d/e 起動時に中央が実施）。将来の seedgen inline 出力は M18-01 スコープ外＝M14-03d/e 着手時判断で合意。連番・CHANGE 不変（000036–000039・次 000040／次 CHANGE 083）。
- v0.2.0（2026-07-19）: **設計是正（製造 Plan Mode 実査 §4.4 エスカレーション）**＝is_projectile 投入を **backfill 専用（Option A・is_derived と完全同型）** に確定し、v0.1.3 の「seedgen を is_projectile 出力へ変更」要件を**撤回**（golden byte-identical 比較の失敗／既存マイグレ改変抵触／000026・000030 が 000039 より前に実行され `no such column` で実行不能、の 3 点により成立しない）。§1.2/§2.1-5/§2.3/§3.3-2/§4.4/§5.1/§7.5/§11 を改訂。manon/luke（true 5 件）の扱いを §11-5 で中央へ申し送り。
- v0.1.3（2026-07-19）: **中央レビュー合格・製造フェーズへ**。マイグレ連番を中央払い出し値で確定反映（000036=G-c／000037=G-d 2 表／000038=G-e／000039=G-b・次 000040）。Plan Mode §3.3-1 の「末尾 000035 確認・不一致なら中央へ請求し直す」ゲートは維持。is_projectile seeded-10=**104** を中央確定として明記。版表記是正（CHANGE-078/080/081/082→plan v0.5.0-plan/overview v0.1.1・CHANGE-079=2 表版）は中央側で完了。

---

## 1. 背景と目的

### 1.1 背景
M17 完了時点の現行正本は REQ-001 v2.17.0（NFR406 フェーズ3・CHANGE-077 済）／DES-002 v1.34.0／DES-003 v1.32.0／DES-004 v1.14.0／DES-005 v2.47.0／DES-006 v1.20.0（委任パッケージ §2.1 版マニフェスト）。M18 は確定反撃記録の新ドメインで、本サブ M18-01 はその**スキーマ基盤**。設計は物理設計プラン v0.5.0-plan §2/§3 と CHANGE-078〜082 で確定済み。既存の重複判定は `DuplicateKey`（`internal/repository/combo/repository.go`・`CharacterID`/`StarterMoveID`/`Position`/`OpponentStance`/`HitType`/`OpponentSize` の 6 項）＋ `CalcRecipeHash`（recipe_hash）で、`hit_type` を含む（RESEARCH-01 §C・M16-RESEARCH-01 と差分なし）。`combos.hit_type` は `hit_type TEXT`（DB CHECK なし）と実査確定（code-facts・RESEARCH-01 §C）。

### 1.2 目的
本サブ完了時に達成される状態：
- 新テーブル 3（`combo_punishes`／`combo_punish_prunings`／`combo_punish_curations`）と新列 2（`combos.materialized_from_combo_id`／`moves.is_projectile`）が作成され、down で整合的に戻せる。
- `moves.is_projectile` の初期値が**是正後 CSV の true 全件**（seeded-10＝104 件）で **backfill 投入**され、既存 seed マイグレ・seedgen の生成 SQL はいずれも不変（golden green 維持）。
- `hit_type` に `just_parry_punish_counter` が model 定数・VAL whitelist・FE ラベル・CSV 写像・比較/絞り込みで通る（マイグレなし・後方互換）。
- 既存行・既存挙動は不変（すべて CREATE TABLE / ADD COLUMN の非破壊）。M18-02（ファインダー）／M18-03（materialize＋マイリスト）が本基盤に乗る。

### 1.3 このマイルストーンで作らないもの（スコープ外）
- **G-b の算出式・走査サービス**（有利フレーム計算・確反成立判定）＝ M18-02（本サブは `is_projectile` 列の追加と初期値投入のみ）。
- **materialize 生成ロジック・ダメージ規則（×1.2／手入力）・重複防止の実行**＝ M18-03（本サブは `materialized_from_combo_id` 列と `hit_type` 新値の器のみ）。
- **紐づけ／materialize の API 本実装**（DES-002 §7 の endpoint 具体化）＝ M18-02/03。
- **2 画面 UI（ファインダー／マイリスト・pruning/curation UI・ツリー）**＝ M18-02/03。
- **非 projectile の recovery=0 データ品質チェック**＝ 別枠 read-only 追補 `M18-RESEARCH-01-addendum`（§9.3・確認事項も参照）。

### 2. 成果物

### 2.1 作成/修正するファイル
実配置は既存構成（`migrations/`・`internal/model/`・`internal/repository/`・`internal/seedgen/`・`web/src/`）に合わせる。パスは着手前確認（§3.3）で実査確定。

| # | 対象 | 種別 | CHANGE | マイグレ連番 |
|---|------|------|--------|--------------|
| 1 | `migrations/000036_create_combo_punishes.up/.down.sql` | 新規 | CHANGE-078 | **000036**（中央払い出し済 2026-07-19） |
| 2 | `migrations/000037_create_combo_punish_prunings_and_curations.up/.down.sql`（2 表を 1 マイグレ） | 新規 | CHANGE-079（**2 表版**） | **000037**（中央払い出し済） |
| 3 | `migrations/000038_add_combos_materialized_from.up/.down.sql` | 新規 | CHANGE-080 | **000038**（中央払い出し済） |
| 4 | `migrations/000039_add_moves_is_projectile.up/.down.sql`（ADD COLUMN＋true 群 backfill UPDATE） | 新規 | CHANGE-081 | **000039**（中央払い出し済） |
| 5 | `internal/seedgen/model.go`（is_projectile コメント `:9`/`:58` の更新**のみ**。**SQL 出力は変更しない**＝`generate.go:191-219 writeMovesInsert` は 12 列のまま） | 修正 | CHANGE-081 | —（マイグレ外） |
| 6 | `character_data/kimberly.csv`・`character_data/juri.csv`（is_projectile 是正 7 件） | 修正 | CHANGE-081 | —（seed 元データ） |
| 7 | `internal/model/combo.go`（`HitTypeJustParryPunishCounter` 定数） | 修正 | CHANGE-082 | —（マイグレ外） |
| 8 | hit_type 許容値 whitelist（VAL・Go／該当箇所を実査） | 修正 | CHANGE-082 | — |
| 9 | `web/src/`（hit_type ラベル写像・CSV 写像・比較/絞り込み・型） | 修正 | CHANGE-082 | — |
| 10 | dbtest スキーマ（`dbtest.Setup` 系）に 3 新表・2 新列を反映 | 修正 | — | — |

> **連番は中央払い出し済（2026-07-19・搬送順 000036→000037→000038→000039、次 000040）**。Plan Mode §3.3-1 で `ls migrations/` を実査し**末尾が 000035** であることを確認してからこの番号を使う。末尾が 000035 でない場合は**自採番せず中央へ請求し直す**（playbook §4.15）。消費した連番は完了報告に明記する。

### 2.2 変更しないもの（原則）
- 既存マイグレ（`000001`〜現行末尾）を**一切改変しない**（新規連番のみ追加）。
- 既存 `combos`／`moves` の他列・既存挙動・既存 API レスポンス（新列/新値以外）。
- `DuplicateKey`（6 項）・`CalcRecipeHash` の判定ロジック（hit_type 新値は whitelist 追加のみで自動的に別コンボ扱い＝改修不要）。
- 起き攻め・メディア・ゲージ等、M18 と無関係な列・契約。

### 2.3 例外条項
- BE への追加は本サブでは**新表 3・新列 2・hit_type 定数/VAL・seedgen のコメント更新**に限る（seedgen の SQL 出力は変更しない）。API endpoint（紐づけ・materialize）本実装は M18-02/03（§1.3）。該当以外の BE 追加は行わない。

---

## 3. 前提条件

### 3.1 必読ドキュメント（行レベル参照）
- 委任パッケージ M18-01 v1.2.0（本サブの境界・§15.7 禁止事項）。
- M18-overview v0.1.1 §3/§5（サブ分割・依存・搬送順・E-14/E-20）。
- 物理設計プラン **v0.6.0-plan** §2（G-b 算出式・is_projectile〔決定 #3-rev＝backfill 専用〕・NULL/recovery=0 の扱い）・§3.1〜§3.5（DDL）。※差し替え版の実体受領時に本指示書 §4.4 と突合する（不一致なら中央へ）。
- CHANGE-078／CHANGE-079（**2 表版**）／CHANGE-080／CHANGE-081／CHANGE-082 通知書（各 §2 変更内容・§4 設計判断・§5 影響範囲）。
- M18-RESEARCH-01-report v1.0 §A（seed 充足）・§B（is_projectile 実測・seedgen 実装位置 `internal/seedgen/model.go:9/58`・`csv.go:108-110`）・§C（FR301 dup キー・`combo_punishes`/`is_projectile` 現行 0 件）。
- DES-003 v1.32.0 §3.3（moves 列）・§3.4（combos 列・hit_type）・§7（マイグレ方針）。DES-006 v1.20.0 §2（hit_type 許容値／VAL-C02）。DES-005 v2.47.0（hit_type ラベル面）。
- retrospective-digest §5（**FK=OFF × 明示 DELETE 非同居**）・E-14／E-15／E-16／E-18／E-19。playbook §4.15（連番を数字で固定しない）・§4.17（破壊的マイグレの定型観点）・§5.4.1（確認コマンドの出力を切らない）。
- code-facts（commit `5d0cba1`）：`hit_type TEXT`・`DuplicateKey` 構造体・migrations DDL。**seedgen は code-facts 非対象**のため実コードを view で実査。

### 3.2 参照不要
- M18-02（ファインダー）／M18-03（materialize＋マイリスト）の設計は本サブでは不要（依存先＝本基盤が前提）。M19（セットプレイ提案）関連は全て不要。

### 3.3 着手前の確認（Plan Mode 必須）
以下を grep/view で確定させ、Plan Mode で提示する（出力を切らず件数を数える＝§5.4.1）。
1. **マイグレ連番（中央払い出し済＝000036/000037/000038/000039・次 000040）**：`ls migrations/` で現行末尾が **000035** であることを実査確認（§5.4.1・出力を切らない）。一致すれば払い出し番号をそのまま使用（搬送順 G-c=000036→G-d=000037→G-e=000038→G-b=000039）。**不一致なら自採番せず中央へ請求し直す**。
2. **seedgen の非改変確認**：`generate.go:191-219 writeMovesInsert` が 12 列出力（is_projectile 非出力）であること・`model.go:9`（raw_data は notes/notes_tool のみ）を確認。**SQL 出力は変更しない**（コメント `:9`/`:58` のみ更新）。golden テスト（`generate_test.go:139-167`/`176-199`）が CSV 是正後も green であることを確認。
3. **dbtest スキーマ適用経路**：`dbtest.Setup`（または相当）が migrations をどう読むか（全 up 適用か固定スキーマか）を実査。新表 3・新列 2 が test でも作られることを確認。
4. **DROP COLUMN 方式**：`combos`／`moves` の ADD COLUMN の down（`DROP COLUMN` が modernc.org/sqlite で通るか、テーブル再構築が要るか）を実査。再構築が要る場合の FK 扱い（下記 §4 の digest §5 順守）。
5. **hit_type 許容値の whitelist 位置**：Go 側（VAL）と FE 側（型・ラベル・CSV 写像・比較/絞り込み）の現行 3 値（normal/counter/punish_counter）の定義箇所を全数列挙。
6. **is_projectile true 群の確定**：是正後 `character_data/*.csv`（seeded-10）で `is_projectile=true` 行を**再集計**し、件数（見込み 104）と code 一覧を確定。backfill UPDATE の対象キーに使う。

---

## 4. 詳細仕様

> **全マイグレ共通（digest §5・playbook §4.17）**：可逆前進マイグレ＋事前バックアップ、**FK=OFF と明示 DELETE を同一マイグレに同居させない**、down は忠実復元、既存マイグレ非改変（新規連番のみ）。本サブの up は CREATE/ADD のみで明示 DELETE を含まない。down の DROP でテーブル再構築が要る場合は、FK=OFF を使う再構築マイグレに**明示 DELETE を混ぜない**（別マイグレに分ける・digest §5・M12-5）。搬送順 **G-c(1)→G-d(2)→G-e(3)→G-b(4)** を厳守（連番の一元性のため worktree 並列不可＝overview §5）。

### 4.1 G-c：`combo_punishes` 中間テーブル（CHANGE-078・plan §3.1）
combo ↔ 相手技の多対多・キュレート分のみ保存（「刺さり得る」全集合は導出＝非保存）。**`guard_type` は持たない**（block/ジャストパリィは紐づくコンボの `hit_type` で判別＝§4.5）。

```sql
-- up
CREATE TABLE combo_punishes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id          INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
  note              TEXT,                                   -- 採用理由メモ・nullable
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (combo_id, opponent_move_id)
);
CREATE INDEX idx_combo_punishes_opponent_move ON combo_punishes(opponent_move_id);
-- down
DROP INDEX IF EXISTS idx_combo_punishes_opponent_move;
DROP TABLE IF EXISTS combo_punishes;
```
- 自/相手キャラ id は join 導出（明示列なし）。`dup`／`recipe_hash` 非対象。
- FK CASCADE：`combo` 削除で紐づけ行も削除（意図どおり）。

### 4.2 G-d：距離除外の 2 表（CHANGE-079 **2 表版**・plan §3.2）
**2 表を 1 マイグレで作成**。pruning＝マッチアップ単位（物理的に無理）／curation＝個別コンボ単位（届くが使わない・keep と対称）。

```sql
-- up（両表を同一マイグレで）
CREATE TABLE combo_punish_prunings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  self_character_id INTEGER NOT NULL REFERENCES characters(id),
  opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (self_character_id, opponent_move_id)
);
CREATE INDEX idx_cpp_opponent_move ON combo_punish_prunings(opponent_move_id);

CREATE TABLE combo_punish_curations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id          INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (combo_id, opponent_move_id)
);
CREATE INDEX idx_cpc_opponent_move ON combo_punish_curations(opponent_move_id);
-- down（作成の逆順で両表 DROP）
DROP INDEX IF EXISTS idx_cpc_opponent_move;
DROP TABLE IF EXISTS combo_punish_curations;
DROP INDEX IF EXISTS idx_cpp_opponent_move;
DROP TABLE IF EXISTS combo_punish_prunings;
```
- 粒度の非対称は**意図**（pruning=物理事実／curation=コンボ単位の取捨）。相手キャラ id は `opponent_move_id → moves.character_id` で導出。
- curation の FK CASCADE：`combo` 削除で当該 curation 行も削除。pruning は combo 非依存（マッチアップ事実）で残る。

### 4.3 G-e：`combos.materialized_from_combo_id`（CHANGE-080・plan §3.3）
別コンボとして materialize する際の出自（生成元＝基底コンボ）参照。**combos は相手技列を持たない**。

```sql
-- up
ALTER TABLE combos ADD COLUMN materialized_from_combo_id INTEGER REFERENCES combos(id);  -- NULL=通常コンボ
-- down
-- DROP COLUMN が modernc.org/sqlite で通れば:
ALTER TABLE combos DROP COLUMN materialized_from_combo_id;
-- 通らなければテーブル再構築（§3.3-4 実査）。再構築時は FK=OFF を使い、明示 DELETE を同居させない（digest §5）
```
- `dup`／`recipe_hash` 非対象（出自は同一性に影響しない）。ドリフト検出は本列で可能（M18-03）。生成規則・hit_type 分岐は M18-03。

### 4.4 G-b：`moves.is_projectile`（CHANGE-081・plan §3.4）＋ seedgen ＋ CSV 是正
飛び道具は距離依存で単一値が有利フレームにならないため、`is_projectile=true` を自動走査から除外する唯一の一次源とする（on_block-NULL は判別材料にならない＝RESEARCH B-3）。**算出式・走査は M18-02**（本サブは列と初期値のみ）。

```sql
-- up
ALTER TABLE moves ADD COLUMN is_projectile INTEGER NOT NULL DEFAULT 0;  -- bool(0/1)
-- 続けて、是正後 CSV の is_projectile=true 群（seeded-10）を backfill UPDATE
-- 例（実キー群は §3.3-6 で確定した code 一覧を使う。character_id + code で特定）:
--   UPDATE moves SET is_projectile = 1 WHERE ...;
-- down
ALTER TABLE moves DROP COLUMN is_projectile;   -- 不可なら再構築（§4.3 と同じ FK 注意）
```

**初期値投入（backfill 専用・is_derived〔000032 ADD COLUMN＋000034 backfill〕と完全同型）**：
1. **既存 seed 行**：ADD COLUMN（DEFAULT 0）後、**是正後 CSV の is_projectile=true（seeded-10）を決定論 backfill UPDATE** で 1 に更新（同一マイグレ 000039 内）。既存 seed マイグレ（000026/000030）は**改変しない**。
2. **seedgen の moves INSERT は変更しない**（`writeMovesInsert` の 12 列出力を維持＝is_projectile は非出力のまま）。`internal/seedgen/model.go` の is_projectile コメント（`:9`/`:58`）のみ「保全のみ・SQL 非投入（M18 G-b で列追加予定）」→「**保全のみ・SQL 非投入。列は 000039 で追加済・初期値は同マイグレの backfill で投入**」へ更新する（コメント修正のみ・生成 SQL のバイト列は不変）。
3. **未 seed（manon/luke・true 5 件）**：本サブの対象外。**M14-03d/e の seed 投入時に is_projectile の backfill を併せて行う必要がある**（seedgen が出力しないため自動反映されない。中央承認済＝**followup-backlog C-1 `M14-03-is-projectile-backfill`** へ繰越登録済・§11-5）。

> **なぜ backfill 専用か（製造 Plan Mode 実査 2026-07-19・指示書 v0.1.3 の要件を撤回）**：seedgen を is_projectile 出力へ変更すると、(a) golden テスト（`generate_test.go:139-167`=000026／`176-199`=000030）が CSV 再生成 SQL とコミット済みマイグレを byte-identical 比較するため必ず失敗し、(b) 解消のため 000026/000030 を再生成すると既存マイグレ改変（§2.2・チェックリスト §9 の重大問題）に抵触、(c) さらに **000026/000030 は 000039（ADD COLUMN）より前に実行される**ため is_projectile を含む INSERT は `no such column: is_projectile` で実行不能。よって既存 seed への inline 出力は**実行順序上そもそも成立しない**。is_derived が backfill 専用である先例と整合する。
>
> **CSV 是正が golden を壊さないことの根拠**：`model.go:9`＝`raw_data は notes/notes_tool のみ（空→NULL）。command/condition_*/is_projectile は列が無く投入しない`（RESEARCH §B-2 実査）。is_projectile は生成 SQL のどの列にも現れないため、CSV の is_projectile を false→true に是正しても**生成 SQL のバイト列は不変＝golden green を維持**する（kimberly/juri は 000026 に含まれるため、この確認は必須。§5.1 で assert）。

**CSV 是正（開発者確定 2026-07-19・false→true 7 件）**：backfill 対象一覧の**元データ**（および将来 seed の正データ）として CSV を是正する。生成 SQL は不変（上記根拠）。
- `kimberly`：`shuriken_bomb_light`／`shuriken_bomb_medium`／`shuriken_bomb_heavy`／`shuriken_bomb_spread_light`／`shuriken_bomb_spread_medium`／`shuriken_bomb_spread_heavy`（6 件）。
- `juri`：`fuha_saihasho`（1 件）。

**件数の検算（E-16/E-18・何を=CSV is_projectile 列 true 行数／単位=技／母数併記）**：
- 是正前（RESEARCH B-2）：全 CSV **102**・seeded-10 **97**・未 seed 5。
- 是正後（見込み・**実装時に是正後 CSV で再集計して一致確認**）：全 CSV **109**・seeded-10 **104**（97+7）・未 seed 5。per-char：kimberly 0→6・juri 4→5。
- backfill UPDATE の**更新件数は seeded-10 の true 件数（104・中央確定）と一致**することを完了報告に件数で明記（数えた対象＝moves の is_projectile=1 行数）。実装時に是正後 CSV から再集計し 104 に一致することを検算する（乖離時は中央へ）。
- 本是正＋backfill は **CHANGE-081 に同梱**（別 CHANGE 不要・2026-07-19 中央確定）。検算結果は **change-report-081** に集約する。

> **確認済（2026-07-19 開発者回答・#5 addendum-report §1/§2 dev DB 実測）**：shuriken_bomb 系 6 variant は **recovery=0・on_block=NULL**（recovery は NULL ではない＝RESEARCH A-1「攻撃系 recovery NULL 0 件」と整合。A-3 の "recovery=NULL" は report の誤記）。NULL は on_block 側。is_projectile=true 是正後は projectile として自動走査除外のため、recovery=0 は finder 挙動に影響しない。本サブ（列追加のみ）への影響なし。

### 4.5 hit_type 拡張：`just_parry_punish_counter`（CHANGE-082・plan §3.5・**マイグレ不要**）
`combos.hit_type` は `hit_type TEXT`（CHECK なし）＝**DB 変更なし**。ジャストパリィ始動の確定反撃を**別コンボとして一意化**する（FR301 dup キーが hit_type を含むため、同一レシピでも別コンボになる）。命名は略さない（キャラ JP／Japan 混同回避）。

| 面 | 変更 | 参照 |
|---|------|------|
| Go model | `internal/model/combo.go` に `HitTypeJustParryPunishCounter = "just_parry_punish_counter"` を追加（既存 normal/counter/punish_counter に併記） | plan §3.5-a |
| VAL | hit_type 許容値 whitelist（Go）に新値を追加 | DES-006 §hit_type |
| FE ラベル | 内部値→**「パニッシュカウンター(ジャストパリィ反撃)」**（開発者変更 2026-07-22・半角括弧＝既存規約 `OD(弱中)` と同一。「ジャストパリィ」を略さない方針を満たす）。既存 `punish_counter` ラベルは据置 | 開発者指示・DES-005 反映要点 |
| CSV 写像 | import/export の hit_type 写像に新値（後方互換＝新値は新コンボにのみ・旧 CSV 不変） | plan §3.5-d |
| 比較/絞り込み | hit_type フィルタに新値 | plan §3.5-e |
| FR301 dup | 追加改修なし（既存キーに hit_type が入るため自動対応） | RESEARCH §C |

- **保存値**＝`just_parry_punish_counter`（"jp" を含めない・**表示文言の変更は内部値/スキーマ/CSV 写像/dup 判定に影響しない**）。materialize（M18-03）が本区分を使うため、本サブ（materialize 実装前）で反映する。
- **`HIT_TYPE_OPTIONS`（コンボエディタ select）への新値追加は是認**（指示書担当判断 2026-07-22）。理由＝ジャストパリィ確反は**元来「手入力」が正典**（overview §2.1-h/j）であり手動作成は設計意図に反しない／除外すると materialize 済コンボの編集時に選択肢が欠落し表示が崩れる／dup キー・export への影響なし。M18-03 の手動入力導線は「本経路で既に作成済のコンボが存在しうる」前提で設計する（移行作業は不要）。
- ダメージ規則（×1.2／手入力）・重複防止の実行は M18-03。本サブは値・ラベル・写像・whitelist まで。

---

## 5. テスト要件

### 5.1 必須テスト（Go test 中心・BE）
- **マイグレ up/down（4 本）**：各 up 適用後にテーブル/列・UNIQUE・INDEX が存在し、down 適用後に消える（忠実復元）。`dbtest.Setup` が新表 3・新列 2 を含むこと。
- **FK/CASCADE**：`combo_punishes`・`combo_punish_curations` は combo 削除で行が消える。`combo_punish_prunings` は combo 非依存で残る。
- **UNIQUE**：`combo_punishes(combo_id,opponent_move_id)`／`combo_punish_prunings(self_character_id,opponent_move_id)`／`combo_punish_curations(combo_id,opponent_move_id)` の重複 INSERT が弾かれる。
- **is_projectile backfill**：ADD COLUMN 後、既存行の既定が 0、backfill 後に true 群が 1。**更新件数＝seeded-10 の true 件数（104・中央確定）**を assert（件数検算・E-16/E-18）。
- **seedgen 非改変の検証**：`writeMovesInsert` は 12 列出力のまま（is_projectile 非出力）。**CSV 是正 7 件を入れた状態で golden テスト（000026/000030 の byte-identical 比較）が green** であること＝生成 SQL のバイト列不変を assert。`testHeader`（20 列）は変更不要。
- **hit_type**：model 定数・VAL whitelist が新値を受理し未知値を弾く。既存 3 値の挙動不変。CSV 写像の往復（新値 round-trip）。
- **DuplicateKey**：同一レシピ・`punish_counter` と `just_parry_punish_counter` が**別コンボ**と判定される（FR301・E-19）。

### 5.2 E2E（該当分のみ・スキーマ基盤のため軽量）
- A：既存コンボの作成/編集/一覧/比較/エクスポートが**新列・新値の追加後も回帰しない**（非破壊確認）。
- B：hit_type 絞り込みに新値が現れ、既存 3 値の絞り込みが不変。

> **E2E 実行状況（2026-07-22 実装時）**：リモート環境の Playwright ブラウザ版数不一致（pin `@playwright/test` 1.60＝build **1223** 要求／コンテナ同梱 **1194**）により A/B を確定実行できず（失敗した 4 spec は `combo-crud`/`combo-csv-io` で **M18-01 と無関係な動線**・系統的タイミング差）。**代替担保**＝Go 統合テスト（実マイグレ＋FK CASCADE＋全 seed dbtest）／FE コンポーネントテスト／本番ビルド green。**【解消済 2026-07-22】** 開発者環境（pin 一致）で `make e2e` を実行し **green**、加えて**手動 E2E でも問題なし**を確認。→ 残ゲートなし。

---

## 6. レビュー観点（別ファイル参照）
レビューは `docs/instructions/phase3/reviews/M18-01-review-checklist.md` に従う（本指示書と 1:1）。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件
- 新表 3・新列 2 が搬送順で作成され down 整合。hit_type 新値が model/VAL/FE/CSV/絞り込みで通る。is_projectile 初期値が是正後 true 群で投入済み。

### 7.2 自己テスト結果（製造担当の責任範囲）
- §5.1 全項目 green。マイグレ up→down→up の反復で整合。既存テスト非回帰。

### 7.3 品質チェック
- 既存マイグレ非改変（新規連番のみ）。FK=OFF×明示 DELETE 非同居（digest §5）。連番は中央払い出し値を使用（自採番していない）。

### 7.4 ドキュメント
- 完了報告に **DES 反映要点**（DES-003 新表 3・新列 2／DES-002 §7 endpoint 候補／DES-004 is_projectile／DES-006 hit_type whitelist／DES-005 ラベル／REQ 候補注記）をまとめる。※CHANGE-081 の seedgen 記述是正は**中央で反映済**（081 保持・plan v0.6.0-plan）のため完了報告での再提起は不要。**DES 直接編集はしない**（採番・改訂は中央）。
- **消費した実マイグレ連番を完了報告に明記**（後続サブの連番が動くため・§4.15）。

### 7.5 完了報告
- 触ったファイル一覧（E-14）／is_projectile 件数の検算結果（数えた対象・母数）／**golden テスト green の確認結果**（CSV 是正後も生成 SQL 不変）／DES 反映要点／消費連番。

---

## 8. 参照ドキュメント
委任 M18-01 v1.2.0／M18-overview v0.1.1／物理設計プラン v0.6.0-plan §2/§3／CHANGE-078・079(2表)・080・081(改訂版)・082／M18-RESEARCH-01-report v1.0 §A/§B/§C／DES-003 v1.32.0 §3.3/§3.4/§7・DES-006 v1.20.0 §2・DES-005 v2.47.0・DES-002 v1.34.0 §7／retrospective-digest §5・E-14/15/16/18/19／playbook §4.15/§4.17/§5.4.1／code-facts `5d0cba1`。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- マイグレ連番（**中央払い出しを請求**・自採番禁止）。
- is_projectile true 群の code 一覧・件数（是正後 CSV を実査して確定・数えた対象を明記）。
- DROP COLUMN の可否と再構築要否（実査・§3.3-4）。
- hit_type whitelist/ラベル/写像の現行定義箇所（全数列挙）。

### 9.2 推測で進めてよい事項（明示すること）
- テストのファイル名・配置は既存規約に合わせてよい（その旨を報告に書く）。
- `note` 列の UI 露出は本サブ対象外（列のみ・M18-02/03 で使用）。

### 9.3 不明事項発見時の対応
- **データ品質**に触れる発見（seed の値の疑義等）は、`M18-RESEARCH-01-addendum`（read-only）へ回すか本サブで是正するかを**中央へ確認**（勝手に seed を書き換えない）。設計変更が要るものは「DES 反映要点」または確認事項として中央へ（推測で埋めない）。

---

## 10. 完了後の次ステップ
- 完了報告＋DES 反映要点＋消費連番を中央へ（開発者リレー）。中央が三点セット（通知書は起票済＝改訂 DES＋change-report＋registry）で反映。
- 次サブ M18-02（ファインダー）は本基盤（combo_punishes・is_projectile・2 除外表）に依存。着手時に E-14 で「本サブが触ったファイル×M18-02 改造対象」を突合し回帰ゲートを足す。

---

## 11. 開発者への確認事項

> 本節は全て解決/確定済（①確定・③解決済＝下記／②④は暫定案どおり確定扱い）。初回レビュー投入の障害なし。
1. **【確定・2026-07-19 中央】is_projectile 是正のパッケージング**：7 件の CSV 是正＋backfill は **CHANGE-081 に同梱**（別 CHANGE 不要）。件数検算は **change-report-081** に集約。→ 確定済・確認不要。
2. **【是正確定・v0.2.0】投入経路**：v0.1.3 までの「backfill＋seedgen 出力の 2 経路」は成立しないため撤回し、**backfill 専用の 1 経路**（is_derived と完全同型）に確定（根拠＝§4.4 の 3 点）。→ 指示書担当判断で確定・製造は本版で着手可。
3. **【解決済・2026-07-19】shuriken_bomb 系の recovery**：#5 addendum-report §1/§2 の dev DB 実測で **recovery=0・on_block=NULL**（recovery NULL ではない）と確定。RESEARCH A-1 と整合し、A-3 の "recovery=NULL" は report 誤記。本サブに影響なし・追加調査不要。
5. **【中央承認済・2026-07-19】manon/luke の is_projectile**：「自動反映」記述は**撤回・是正済**。**followup-backlog C-1（`M14-03-is-projectile-backfill`）へ繰越登録済**で、指示書本体への追記は M14-03d/e 起動時に中央が実施。本サブの対象外（§4.4-3）。→ クローズ。

6. **【中央合意済・2026-07-19】seedgen のスキーマ版数対応**：将来 seed への inline 出力（版数分岐＋golden 版数対応）は **M18-01 スコープ外＝M14-03d/e 着手時に判断**で合意。→ クローズ。

7. **【解消済・2026-07-22】E2E**：開発者環境で `make e2e` green ＋手動 E2E 確認済。DoD §7.2 充足・繰越ゲートなし。→ クローズ。

8. **【DES 反映要点・要判断】新表の `created_at/updated_at` 列型表記（何を）**：新表 3 は指示書 DDL どおり `TEXT`、既存表は `DATETIME` 表記。DES-003 反映時にどちらへ寄せるか。**なぜ**：文書の一貫性の問題（実挙動差なし）。**補足（実装報告の根拠の精密化）**：完了報告 §1-3 は「両者とも TEXT アフィニティ」とするが、SQLite の型親和性規則では宣言型 `DATETIME` は **NUMERIC アフィニティ**（TEXT ではない）。ただし `datetime('now')` の戻り値は数値literal として解釈できない文字列のため NUMERIC アフィニティ下でも TEXT として格納され、**結論（実害なし・挙動同一）は変わらない**。**暫定案**：DES-003 には**実 DDL どおり新表＝TEXT** と記載し、既存表の `DATETIME` 表記は据置（統一にはテーブル再構築が必要で、実害ゼロに対しコスト過大）。今後の新表は `TEXT` に統一する方針を DES-003 に注記。

9. **【開発者管掌・2026-07-22】指示書ファイルの disk 反映**：リポジトリ反映は開発者が実施（中央リレー不要）。本 **v0.2.3** が最新。撤回済の seedgen 出力要件を含む v0.1.3 が disk に残らないよう差し替えを依頼済み。

4. **配布物の整合（何を・報告）**：ディスク上の CHANGE-079 は旧・単一表版で上書き残存（現行正本＝2 表版）。overview §前提/§4.2・CHANGE-078/080/081/082 の「plan v0.3.0-plan」表記は現行 v0.5.0-plan への追従漏れ（内容差は G-d のみ）。**暫定案**：私は 2 表版・v0.5.0-plan を正として起草済み。中央の版表記是正のみ依頼（設計内容に影響なし）。

*以上、M18-01 実装指示書ドラフト v0.1.0。配置 `docs/instructions/phase3/M18-01-schema-foundation.md`。中央初回レビュー（委任 §5）後に製造投入。*
