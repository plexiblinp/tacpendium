# change-report CHANGE-078〜082（M18-01 スキーマ基盤・実装反映報告）

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | **078（G-c）／079（G-d）／080（G-e）／081（G-b）／082（hit_type 拡張）** |
| サブマイルストーン | M18-01（スキーマ基盤） |
| 作成日 | 2026-07-22 |
| 作成者 | 設計担当 Claude（M18 期・中央） |
| 実装 | ブランチ `claude/senior-engineer-support-pjw43m`・9 コミット（`4df5f28`〜`d95355c`）push 済 |
| 指示書 | M18-01 v0.2.3／レビューチェックリスト v0.2.3 |
| 判定 | **受理（完了・残ゲートなし）**。重大問題ゼロ。`make e2e` green ＋手動 E2E 確認済（2026-07-22） |
| 消費連番 | **マイグレ 000036／000037／000038／000039**（中央払い出し・搬送順どおり）。**082 はマイグレ非消費** |

> 5 CHANGE は同一サブ（M18-01）で一体に実装・検証されたため、**change-report を 1 本に集約**する（registry では 078〜082 を個別に「反映」へ更新）。

---

## 1. 実装結果サマリ

| CHANGE | 実装物 | マイグレ |
|---|---|---|
| 078 | `combo_punishes`（UNIQUE(combo_id,opponent_move_id)・INDEX(opponent_move_id)・CASCADE・note・**guard_type なし**） | 000036 |
| 079 | `combo_punish_prunings`（UNIQUE(self_character_id,opponent_move_id)）＋`combo_punish_curations`（UNIQUE(combo_id,opponent_move_id)・CASCADE）＝**2 表を 1 マイグレ** | 000037 |
| 080 | `combos.materialized_from_combo_id`（self-FK・nullable） | 000038 |
| 081 | `moves.is_projectile`（INTEGER NOT NULL DEFAULT 0）＋**backfill 専用投入**（seedgen 非改変） | 000039 |
| 082 | `hit_type` に `just_parry_punish_counter`（model 定数・VAL whitelist・FE ラベル・CSV 写像・比較/絞り込み） | **なし** |

## 2. 非破壊性の証跡

- `git diff` 対象は **000036–000039 の新規追加のみ**（**000001–000035 無改変**）。
- `writeMovesInsert` は **12 列のまま**＋`TestGenerate_IsProjectileNotEmitted` で**非出力を assert**（撤回した要件をテストで固定）。
- `TestGolden_*`（000026・000030 の byte-identical 比較）は **CSV 是正後も green**。
- `DuplicateKey`（6 項）・`CalcRecipeHash` **不変**（hit_type 弁別テストで FR301・E-19 を実証）。
- 既存 3 hit_type 値の表示・挙動**不変**。既存コンボ CRUD／一覧／比較／エクスポート **E2E 非回帰**。

## 3. 件数検算（E-16/E-18）

- **backfill 対象＝seeded-10 の `is_projectile=true`＝104 件**。**数えた対象＝`moves.is_projectile=1` の行数**。内訳＝**是正前 97 ＋ データ是正 7**（kimberly `shuriken_bomb_{light,medium,heavy}`・`_spread_{light,medium,heavy}` 6／juri `fuha_saihasho` 1）。
- **これが一次源で不変**。「全 CSV 件数」（RESEARCH B-2 時点 102、是正後 109 と記載）は**参考値**であり、その後 `character_data/` に未 seed キャラが追加され**現況実測は 122**（内訳＝seeded-10 104＋luke 5＋manon 0＋m_bison 1＋rashid 12）。**`character_data/` は外部から増える母数のため一次源にしない**（m_bison／rashid は moves 未投入＝backfill 非対象）。

## 4. 設計判断の実装時確定

| 項目 | 確定内容 |
|---|---|
| is_projectile 初期値 | **backfill 専用・`internal/seedgen` 非改変**（決定#3→**#3-rev**）。seedgen 版数対応＋golden 版数対応は M18-01 スコープ外、既作成 M14-03d/e 指示書との齟齬回避（E-14） |
| 未 seed キャラ | seedgen 非出力のため **seed 波の moves は is_projectile=0 で入る**。**M14-03d/e で別途 backfill 必須**（followup-backlog C-1 `M14-03-is-projectile-backfill`。実測内訳 luke 5・manon 0） |
| hit_type ラベル | **「パニッシュカウンター(ジャストパリィ反撃)」**（2026-07-22 開発者変更。半角括弧＝既存 `OD(弱中)` 規約準拠。旧案「ジャストパリィパニッシュカウンター」から変更）。内部値・スキーマ・CSV 写像・dup 判定は**不変** |
| `HIT_TYPE_OPTIONS`（エディタ select） | **新値を追加**（ジャストパリィ確反は元来「手入力」が正典・materialize 済コンボ編集時の選択肢欠落を防ぐ・dup／export／CSV 写像への影響なし）。**M18-03 の手動入力導線は「本経路で作成済のコンボが存在しうる」前提で設計**する（移行作業は不要） |
| 新表の timestamps 型 | 新表 3 つは `TEXT`、既存表の `DATETIME` は**据置**（SQLite の型親和性では `DATETIME` は NUMERIC アフィニティだが `datetime('now')` の戻り値は数値literal として解釈されず TEXT 格納＝**挙動同一・実害なし**。統一にはテーブル再構築が要りコスト過大）。**今後の新表は `TEXT` に統一** |

## 5. DES 本体への反映（中央実施・本 report と同時）

| 文書 | 版 | 反映内容 |
|---|---|---|
| **DES-003** | 1.32.0 → **1.33.0**（第36版） | §3.15 `combo_punishes`／§3.16 `combo_punish_prunings`／§3.17 `combo_punish_curations` 新設・§3.4 `materialized_from_combo_id`・§3.3 `is_projectile`・ER 図・インデックス方針・timestamps 型注記 |
| **DES-004** | 1.14.0 → **1.15.0**（第16版） | §2.5 新設＝`is_projectile` を確定反撃の自動走査除外の唯一の一次源として正典化 |
| **DES-006** | 1.20.0 → **1.21.0**（第23版） | §2.7 新設＝`hit_type` 4 値化・自由 TEXT＋VAL whitelist 据置・dup 一意化の帰結 |
| **DES-005** | 2.47.0 → **2.48.0**（第59版） | §5.4 hit_type プルダウン 4 値化＋**表示ラベル正典**・内部値/ラベル分離の明記 |
| DES-002 §7 | 1.34.0（**据置**） | 紐づけ／materialize endpoint は**候補のまま**（本サブ未実装・M18-02/03 で具体化） |
| REQ-001 | 2.17.0（**据置**） | FR301 の hit_type 列挙への新値併記は**見送り**（FR301 の本旨は重複防止であり、許容値の正典は DES-006 §2.7・ラベルは DES-005。REQ に値リストを持たせると二重管理になる。**中央判断**） |

## 6. 残課題・繰越

- **M14-03d/e の is_projectile backfill**（followup-backlog C-1 に登録済・指示書本体への追記は M14-03d/e 起動時に中央が実施）。
- **seedgen の inline 出力（版数対応＋golden 版数対応）**＝M18-01 スコープ外・M14-03d/e 着手時に判断。
- **CHANGE-082 §2-c のラベル文言**は本 report の §4 表記へ追随（内部値・スキーマ影響なし）。
- 指示書 disk 実体（v0.2.3）の反映は**開発者管掌**（中央対応不要・記録のみ）。

---

*以上、change-report CHANGE-078〜082（M18-01）。DES 本体反映・registry 更新は中央が同時実施。*
