# 指示書 M18-02: 確定反撃サーチ（探す画面・走査サービス・3 階層ツリー）

| 項目 | 内容 |
|------|------|
| 文書ID | M18-02 |
| バージョン | **v1.0.1**（2026-07-23・**マイグレ連番の中央払い出しを確定反映**＝000040/000041。要件は v1.0.0 から不変＝**製造投入可**） |
| 作成者 | M18 指示書担当（playbook §15.6・委任 v1.2.0 §6＝設計から委任） |
| サブ | M18-02（M18-01 完了済に依存・M18-03 の前提） |
| 推奨モデル | 製造 = **Opus 4.8 ＋ Plan Mode 必須**（新ドメインの走査ロジック・新テーブル・新画面）。レビュー = Sonnet 4.6 |
| 配置（完成品） | `docs/instructions/phase3/M18-02-punish-search.md` |
| 前提正本 | REQ-001 v2.17.0／DES-002 v1.34.0／**DES-003 v1.33.0**／**DES-004 v1.15.0**／DES-005 v2.48.0／DES-006 v1.21.0／SUPP-001 v1.27.0 |

---

## 更新履歴
- v1.0.1（2026-07-23）: **中央がマイグレ連番を払い出し**（000040＝CHANGE-083／000041＝CHANGE-084 v2・次 000042）。§2.1 の表と §3.3-1 に確定値を反映。**要件・仕様の変更なし**（連番の確定のみ）。製造投入可。
- v1.0.0（2026-07-23）: 初版。CHANGE-083（`combo_punish_starters`）・CHANGE-084 v2（移動 5 code × 10 キャラ＝50 行 backfill）を実装手順化。走査サービス・3 階層ツリー・ダッシュ/ジャンプ経由・新規登録導線を含む。

---

## 1. 背景と目的

### 1.1 背景
M18-01 でスキーマ基盤（`combo_punishes`／`combo_punish_prunings`／`combo_punish_curations`／`combos.materialized_from_combo_id`／`moves.is_projectile`／`hit_type` 4 値）が完成した。本サブはその上に**確定反撃サーチ（探す画面）**を実装する。

**ワークフロー（開発者の意図・設計の骨格）**：
1. **フレーム計算**で「反撃できそうな始動技」を機械的に列挙する（＝ツリーの子まで）。
2. ユーザーが**実践で距離等を検証**し、始動技を**採用／到達不能**に振り分ける（`combo_punish_starters`）。
3. 採用した始動技の下に**孫＝コンボ**を展開し、使えるものを採用（`combo_punishes`）→ 採用確定反撃画面（M18-03）へ。

### 1.2 目的（本サブ完了時の状態）
- 自キャラ×相手キャラ×タブ（ガード／ジャストパリィ）で走査し、**3 階層ツリー**（相手技 → 始動技 → コンボ）が表示される。
- **地上・ダッシュ経由・ジャンプ経由**の 3 レーンで候補が出る（判定根拠がユーザーに見える）。
- 自動走査できない技は**消さず「手動確認レーン」**に出る。
- 始動技の検証結果（採用／到達不能）と、コンボの採用（keep）・相手技の pruning が永続化される。
- 孫の末尾から**コンボ新規登録へ遷移**でき、登録後は元の位置へ戻る。

### 1.3 スコープ外
- **materialize 生成規則・ダメージ規則（×1.2／手入力）・FR301 重複防止の実行**＝M18-03。
- **採用確定反撃画面（使う・2 階層）・curation UI・export 整合**＝M18-03。
- **新スキーマの追加**：本サブは CHANGE-083 の 1 表のみ。**これ以外の新テーブル／新列が必要と判明したら、着手前に中央経由で開発者の個別承認**を得る（委任 §6・勝手に足さない）。
- ジャンプ攻撃版の全体（素のジャンプ +3）の保存＝**しない**（必要時に導出）。

---

## 2. 成果物

### 2.1 作成/修正するファイル

| # | 対象 | 種別 | CHANGE | マイグレ |
|---|------|------|--------|----------|
| 1 | `migrations/000040_create_combo_punish_starters.up/.down.sql` | 新規 | CHANGE-083 | **000040**（中央払い出し済 2026-07-23） |
| 2 | `migrations/000041_backfill_movement_total.up/.down.sql` | 新規 | CHANGE-084 v2 | **000041**（中央払い出し済・**UPDATE のみ／DDL なし**） |
| 3 | 走査サービス（`internal/service/` 相当・実パスは §3.3 で実査） | 新規 | — | — |
| 4 | リポジトリ（`combo_punish_starters` の CRUD・走査クエリ） | 新規 | — | — |
| 5 | ハンドラ／ルーティング（§4.5 の endpoint） | 修正 | — | — |
| 6 | FE：確定反撃サーチ画面（ツリー・レーン・検証操作・新規登録遷移） | 新規 | — | — |
| 7 | FE：`ComboEditor` 呼び出し側（戻り先 state の受け渡し） | 修正 | — | — |
| 8 | dbtest スキーマに新表 1 を反映 | 修正 | — | — |

> **連番は中央払い出し済（2026-07-23）**：搬送順 **000040（CHANGE-083・CREATE TABLE）→ 000041（CHANGE-084 v2・backfill）**、次マイグレは 000042。**Plan Mode §3.3-1 で `ls migrations/` の末尾が 000039 であることを実査確認**してからこの番号を使う。**中央はリポジトリを直接見られないため、この最終確認は製造側の責任**。不一致なら**自採番せず中央へ再請求**する（playbook §4.15）。消費した実連番は完了報告に明記。

### 2.2 変更しないもの
- 既存マイグレ（000001〜000039）を**一切改変しない**。
- **`internal/seedgen` を改変しない**（`isMovementSystem()` の drop は維持＝CHANGE-084 §3-B）。golden テスト（`000026`/`000030` の byte-identical）は green のまま。
- `DuplicateKey`（6 項）・`CalcRecipeHash`・`RecomputeComboCache`（本サブの新表・backfill はいずれも dup/recipe 非対象）。
- 既存 3 表（`combo_punishes`／`prunings`／`curations`）の定義。

---

## 3. 前提条件

### 3.1 必読
- CHANGE-083 通知書／**CHANGE-084 通知書 v2**（§2 a〜a-4・§3.1 値表・§4 付帯条件 3 点）。
- M18-02 設計骨子 v0.9.0（ツリー構造・レーン・判定式・新規登録導線）。
- DES-003 v1.33.0 §3.3（`moves` 列・`is_projectile`・`drive_parry` errata）・§3.4（`combos`・`materialized_from_combo_id`）・§3.15〜3.17（既存 3 表）。
- **DES-004 v1.15.0 §2.1**（code 規約・**`jumping_` ＝空中攻撃／`jump_` ＝移動 system move 専用**の接頭辞区別・2026-07-23 errata）・§2.5（`is_projectile` の正典）。
- DES-002 v1.34.0 **§4.2**（API＝**endpoint の正典節は §4.2。§7 ではない**）・「規則は BE に一元化し FE は引くだけ」の先例（`GET /api/characters/{id}/command-index`）。
- DES-005 v2.48.0 §2（画面一覧）・§4.3（キャラ文脈追従＝CHANGE-039）・§5.4（ツリー UI イディオム・空状態 CTA）・§5.7（始動技は自動推定・読み取り専用）。
- M18-02-RESEARCH-01-report（移動 4 code 全 NULL）／M18-RESEARCH-01-report §A（`on_block` NULL 179 件）／addendum-report（`recovery=0`）。
- retrospective-digest（**E-14**／E-15／E-16／E-18／**E-21**／**E-22**／**E-24**）・playbook §4.15／§5.4.1。

### 3.2 参照不要
M18-03（materialize・採用画面）／M19（セットプレイ）の設計。

### 3.3 着手前の確認（Plan Mode 必須・出力を切らず件数を数える＝§5.4.1）
1. **マイグレ連番（中央払い出し済＝000040／000041・次 000042）**：`ls migrations/` を**出力を切らずに**実行し、末尾が **000039** であることを確認（§5.4.1）。一致すれば払い出し番号をそのまま使用（000040＝CHANGE-083 → 000041＝CHANGE-084 v2）。**不一致なら自採番せず中央へ再請求**（中央は disk を直接見られないため、この確認は製造側の責任）。
2. **空中技の実 code**：`moves` で `is_aerial = 1` の code を**全件列挙**し、接頭辞が **`jumping_`** であること・強度接尾辞（`heavy` 等）の実表記・件数（RESEARCH では 70 件／母数 944）を実データで確認する。**DES-004 の記述ではなく実データで確定**（E-21）。`jump_`（移動）と混ざっていないことも確認。
3. **`total` の充足**：空中技の `total` 非 NULL 件数（**参考値**。判定には使わないが、将来の混同を避けるため実態を把握）。
4. **走査対象の母数**：相手技側で `damage=0` の件数・`damage IS NULL` の件数・`on_block IS NULL` の件数・`is_projectile=1` の件数（各母数併記）。**除外規則の各レーンに実データが 1 件以上乗るか**を確認（テスト設計の根拠にする）。
5. **既存 3 表のリポジトリ実装**：`combo_punishes`／`prunings`／`curations` の CRUD が M18-01 でどこまで作られているか実査（本サブで追加が要る範囲を確定）。
6. **FE の既存資産**：`ComboEditor` の Props（`mode`／`initialCharacterId`／`initial`）・ツリー UI の既存実装（§5.4）・`HIT_TYPE_LABELS`／`HIT_TYPE_LABEL_JA`／`HIT_TYPE_OPTIONS`（E-14 の回帰対象）。
7. **走査クエリのキャッシュ経路**：`PATCH /api/moves/{id}` 成功時の invalidate 先（既存の command-index invalidate の実装に倣う）。

---

## 4. 詳細仕様

### 4.1 CHANGE-083：`combo_punish_starters`（始動技レベルの検証結果）

```sql
-- up
CREATE TABLE combo_punish_starters (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  self_character_id INTEGER NOT NULL REFERENCES characters(id),
  opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
  starter_move_id   INTEGER NOT NULL REFERENCES moves(id),
  verdict           TEXT NOT NULL,                          -- 'adopted' | 'unreachable'
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (self_character_id, opponent_move_id, starter_move_id)
);
CREATE INDEX idx_cps_opponent_move ON combo_punish_starters(opponent_move_id);
-- down
DROP INDEX IF EXISTS idx_cps_opponent_move;
DROP TABLE IF EXISTS combo_punish_starters;
```
- **`verdict` は自由 TEXT ＋ VAL 担保**（DB CHECK を新設しない＝CHANGE-082 で確立した方針）。許容値 whitelist を Go 側に持ち、未知値を弾く。
- timestamps は `TEXT`（新表の統一方針・DES-003 §3.17 注記）。
- 相手キャラは `opponent_move_id → moves.character_id` で導出（明示列を持たない）。
- **用途は探す画面の検証作業状態**。採用の正は `combo_punishes`（役割を混同しない）。
- **ジャンプ攻撃も本表で表現**（`starter_move_id` に空中技 id が入るだけ・追加スキーマ不要）。

### 4.2 CHANGE-084 v2：移動 system move の `total` backfill（**50 行**）

**スキーマ変更なし**（UPDATE のみ）。値の一次源は CHANGE-084 v2 §3.1 の表（開発者提供 2026-07-23）。

| character | dash_forward | dash_back | jump_neutral / jump_forward / jump_back |
|---|---:|---:|---:|
| ryu | 19 | 23 | 43 |
| ken | 19 | 23 | 43 |
| ingrid | 20 | 23 | 43 |
| terry | 19 | 23 | 43 |
| guile | 21 | 23 | 43 |
| lily | 21 | 24 | 45 |
| kimberly | 18 | 23 | 43 |
| juri | 22 | 23 | 43 |
| mai | 18 | 23 | 43 |
| zangief | 22 | 25 | 44 |

**実装要件**：
- 対象＝**10 キャラ × 移動 5 code ＝ 50 行**（`dash_forward` 10／`dash_back` 10／`jump_*` 30）。ジャンプ 3 code は**同一値**。
- **c_viper／dhalsim は対象外**（仮登録キャラ・攻撃技 0 件・候補生成に寄与しない）。
- **`total` のみ更新**。`startup`/`active`/`recovery` は **NULL のまま**（実測値がないものを埋めない）。
- **【付帯条件 2】マイグレ冒頭コメントに値の出所を残す**：「開発者提供・実測値・2026-07-23 受領・CHANGE-084 v2 §3.1 が一次源」。**一次源が DB/CSV/マイグレに存在しないため、出所が失われると再検証不能**（E-24）。
- down は当該 50 行の `total` を NULL に戻す。
- **【付帯条件 3】検算＝50 行**（数えた対象＝移動 5 code × 10 キャラで `total IS NOT NULL` になった `moves` 行数。内訳 10／10／30）。change-report に集約。
- キャラ・code の特定は `characters.code` ＋ `moves.code` で行う（id 直書きしない＝環境差で壊れる）。

### 4.3 走査サービス（BE・**規則は BE に一元化**）

**FE は結果を描くだけ**とし、算出規則を FE に二重実装しない（既存 `command-index` の先例＝DES-002 §4.2）。

#### 4.3.1 有利フレームの算出（plan v0.6.0-plan §2・確定）
| タブ | 有利フレーム |
|---|---|
| ガード | `-(opponent_move.on_block)` |
| ジャストパリィ | `opponent_move.recovery` |

#### 4.3.2 相手技の絞り込み（親ノード）
| # | 条件 | 扱い |
|---|------|------|
| a | `damage = 0` | **完全除外**（画面に出さない）＝ダメージのないキャラ固有 move はガード後の反撃対象にならない（開発者確定） |
| b | `damage IS NULL` | **手動確認レーン**（0 と NULL は意味が違う。黙って落とさない） |
| c | `is_projectile = 1` | **手動確認レーン**（距離依存・バッジ「距離依存」） |
| d | `on_block IS NULL`（ガードタブ） | **手動確認レーン**（バッジ「データ不足」） |
| e | `recovery IS NULL`（ジャストパリィタブ） | 同上 |
| f | `recovery = 0` かつ `is_projectile = 0`（ジャストパリィタブ） | **手動確認レーン**（有効値 0 だと結果が静かに空になり「刺さらない」と「データがない」が区別できないため） |
| g | `combo_punish_prunings` に登録済 | 候補から除外（解除で復帰） |
| h | 上記以外で有利フレーム ≤ 0 | 候補なし（正常） |

> a を先に適用すると、f の対象の多く（移動・構え系）は damage=0 で落ちる。**実際の重なりは Plan Mode（§3.3-4）で実測**し、テストケースの根拠にする（E-16/E-18・E-24＝基準時点を書く）。

#### 4.3.3 始動技の候補（子ノード・3 レーン）
自キャラの `moves` から、**共通条件＝`damage > 0`**（ダッシュ・構え等は始動になり得ない）。

| レーン | 成立条件 | 備考 |
|---|---|---|
| **地上** | `startup ≤ 有利フレーム` | 基本レーン |
| **ダッシュ経由** | `残り猶予 = 有利フレーム − dash_forward.total` が **`≥ DASH_MIN_SLACK`** かつ `startup ≤ 残り猶予` | `dash_forward.total` が **NULL のキャラはレーンごとスキップ**（未 backfill・未 seed キャラ対応） |
| **ジャンプ経由** | `有利フレーム ≥ (jump_forward.total − JUMP_SLACK)` かつ `is_aerial = 1` かつ **強攻撃**（`jumping_heavy_*`・§3.3-2 で実 code 確定） | `jump_forward.total` が NULL ならレーンごとスキップ |

**定数（マジックナンバー化しない・1 箇所定義＋根拠コメント必須）**：
```
DASH_MIN_SLACK = 4  // ダッシュ後に最速技（概ね 4F）が出せる下限
JUMP_SLACK     = 4  // ジャンプ攻撃は攻撃判定が下方向に伸び着地前に着弾するため
                    // 素のジャンプ全体より 4F ほど早く当たる、という経験則の近似値。
                    // 実測値ではない。運用後に combo_punish_starters.verdict の分布
                    // （unreachable=偽陽性／手動登録=偽陰性の兆候）を見て調整する。
```
- **ジャンプの判定に使うのは「キャラのジャンプ全体」**（`jump_forward.total`＝43/44/45）であり、**空中技自身の `total` ではない**。空中技は「何を出すか」の列挙に使う。
- ジャンプ攻撃で全体が +3 になるのは**着地後の硬直**で、**着地までは不変**＝成立判定に影響しない。
- **判定根拠が異なる 3 レーンは、画面上で別レーン／別バッジとして区別する**（silent に混ぜない）。

#### 4.3.4 コンボの候補（孫ノード）
`combos.starter_move_id = 当該始動技` で引く。`materialized_from_combo_id` を持つ生成物も**通常コンボと同格**で含める。

#### 4.3.5 キャラ非依存（E-15）
キャラ別の分岐・ハードコードを作らない。すべて seed 実データ駆動。

### 4.4 API（**DES-002 §4.2** へ追加）

| method | path | 用途 |
|---|---|---|
| GET | `/api/punish-finder` | 走査結果（query: `self_character_id`・`opponent_character_id`・`guard_type=block\|just_parry`）。**BE が算出済みのツリー**（3 階層＋レーン＋手動確認レーン＋バッジ理由）を返す |
| POST / DELETE | `/api/combo-punish-starters` | 始動技の検証結果（`verdict`＝adopted／unreachable・`note`） |
| POST / DELETE | `/api/combo-punishes` | コンボ採用（keep）の登録・解除（`note`＝採用理由） |
| POST / DELETE | `/api/combo-punish-prunings` | pruning の登録・解除（`note`） |

- **未 seed・不存在 ID は 404 でなく 200 ＋空**（「壊れない」優先＝DES-002 §4.2 の既存方針）。
- `PATCH /api/moves/{id}` 成功時に走査結果のキャッシュを invalidate（`is_projectile`／`on_block`／`recovery`／`startup`／`damage`／`total` はいずれも走査結果を変える）。

### 4.5 画面（DES-005 §2 に **画面 19＝確定反撃サーチ**を追加）

route は `/punish/search`（コンポーネント名・query key も同時に固定する）。

```
[1] 自キャラ選択 → [2] 相手キャラ選択
[3] タブ: ガード / ジャストパリィ
[4] ツリー（▶/▼＝§5.4 と同イディオム）
     ├ 成立レーン: 相手技（有利F 表示）
     │    └ 始動技（レーンバッジ: 地上/ダッシュ経由/ジャンプ経由・startup・残り猶予）
     │          ├ コンボ（ダメージ等）→ [採用]
     │          ├ …
     │          └ ＋ このコンボを新規登録する      ← 孫 0 件でも常時表示
     │    └ 始動技の操作: [採用] / [届かない]（= combo_punish_starters）
     └ 手動確認レーン: 除外された相手技（バッジ＝距離依存／データ不足）
            └ [手動で確定反撃を登録]（M18-03 の登録導線へ・本サブでは導線のみ）
[5] 相手技の操作: [pruning に追加]（＝物理的に届かない）
```

**新規登録への遷移（§10 確定分）**：
- 遷移先は既存の **`/combos/new` → `ComboEditorPage`**（新 route を作らない）。
- **プリフィルはキャラのみ**（`mode="new"` ＋ `initialCharacterId`＝自キャラ）。**CHANGE-039 のキャラ文脈追従に確定反撃サーチを加える**（新しい流儀を作らない）。始動技は**レシピ 1 手目から自動推定**され、`starter_move_id` の契約（VAL-C03・常にレシピ 1 ステップ目と一致）に触れない。
- **登録後は確定反撃サーチへ戻す**：router state に戻り先（自キャラ・相手キャラ・タブ・展開中の相手技/始動技）を持たせ、**元の位置へ復帰**する。復帰時に走査結果を再取得し、**登録したコンボが孫に現れる**こと。
- **フォールバック必須**：戻り先 state が無い場合（`/combos/new` を直接開いた等）は**従来どおり一覧へ**。**キャンセル時も同じ戻り先**へ。

**表示の原則**：除外された相手技は**消さずに理由バッジ付きで見せる**。レーンごとに判定根拠が違うことを見せる。

---

## 5. テスト要件

### 5.1 BE（Go）
- **マイグレ 2 本の up/down**：新表・UNIQUE・INDEX の生成と消滅。backfill の適用と巻き戻し。`dbtest.Setup` に新表が反映されること。
- **backfill 検算**：更新行数＝**50**（内訳 dash_forward 10／dash_back 10／jump_* 30）。値がキャラ別に正しい（ryu=19/23/43・lily=21/24/45・zangief=22/25/44 を最低限 assert）。**c_viper／dhalsim は NULL のまま**であること。
- **算出式の境界**：`startup == 有利フレーム` は成立／`startup == 有利フレーム + 1` は不成立（ガード・ジャストパリィ両方）。
- **除外規則 a〜g**：各条件で**最低 1 件ずつ**（Plan Mode §3.3-4 の実測で対象を選ぶ）。特に `damage=0` が**画面に出ない**こと、`damage IS NULL` が**手動確認レーンに出る**ことを区別して検証。
- **ダッシュ経由**：`残り猶予 = 有利 − dash_forward.total` の境界（`残り猶予 == 4` は成立／`3` は不成立）。**`total` が NULL のキャラでレーンがスキップされ、例外にならない**こと。
- **ジャンプ経由**：`有利 == jump総体 − 4` は成立／`− 5` は不成立。**強攻撃のみ**が出る（`jumping_medium_*` 等が出ない）。`is_aerial=1` 以外が混ざらない。
- **キャラ非依存（E-15）**：2 マッチアップ以上で同一ロジックが働く。
- **未 seed／不存在 ID**：**200 ＋空**（404 や 500 にしない）。
- **verdict**：許容値のみ受理・未知値を弾く。UNIQUE 重複を弾く。
- **pruning**：登録で候補から消え、解除で戻る。

### 5.2 FE
- ツリーが 3 階層で描画され、レーンバッジが表示される。
- 孫 0 件でも「新規登録」リンクが出る。
- 新規登録へ遷移するとキャラが既定選択される。登録後に元の位置へ戻り、登録したコンボが孫に現れる。**戻り先 state 無しでは一覧へ**。
- 手動確認レーンに理由バッジが出る。

### 5.3 E2E（`make e2e`・pin 一致環境で実行）
- A：確定反撃サーチで走査 → 始動技を採用 → コンボを採用 → 採用が永続化される。
- B：**既存機能の非回帰**（コンボ CRUD／一覧／比較／エクスポート／**hit_type 4 値の表示**＝E-14）。

> **テストは「ジャストパリィタブ」を主軸に組む**。ガード（`on_block` 起因）で有利 22F 以上が出る場面は稀で、**ダッシュ／ジャンプ経由はジャストパリィタブが主戦場**（有利＝相手技の `recovery`。実データに 20〜40 台が実在）。**ガードタブでダッシュ／ジャンプ候補が 0 件になるのは正常動作**であり、テストの失敗ではない。

---

## 6. レビュー観点
`docs/instructions/phase3/reviews/M18-02-review-checklist.md` に従う（本指示書と 1:1）。

---

## 7. 完了条件（DoD）
- §5.1〜5.3 が green（E2E は pin 一致環境で実行）。
- 既存マイグレ非改変・**seedgen 非改変**（golden green）。連番は中央払い出し値。
- backfill 検算 50 行を完了報告に明記（数えた対象・内訳）。
- **完了報告に DES 反映要点**：DES-003（`combo_punish_starters` 新設＋**移動 system move の `total` は「全体フレーム」を直接保持＝算出式の検算対象外**〔付帯条件 1〕）／DES-002 §4.2（新 endpoint）／DES-005（**画面 19** 追加・3 階層ツリー・レーン・検証 UI・新規登録導線）／DES-006（`verdict` の VAL）。**DES 本体は編集しない**。
- 消費した実マイグレ連番を明記。

---

## 8. 注意事項

### 8.1 推測で進めてはいけない
- マイグレ連番（**中央請求**）。空中技の実 code 接頭辞・強度表記（**実データで確定**・E-21）。除外規則の対象件数（実測）。既存 3 表のリポジトリ実装範囲。

### 8.2 推測で進めてよい（明示すること）
- テストのファイル名・配置（既存規約に合わせる）。ツリーの細部レイアウト・バッジ文言（§5.4 のイディオムに準拠すれば可）。

### 8.3 迷ったら
- **新テーブル／新列が要ると判明したら、実装を止めて中央へ確認**（委任 §6・勝手に足さない）。
- 設計変更が要るものは「DES 反映要点」または確認事項として中央へ（推測で埋めない）。

---

## 9. 完了後の次ステップ
M18-03（materialize ＋ 採用確定反撃画面〔**2 階層**：相手技 → コンボ〕）は本サブに依存。**E-20 の 1 本動線**（探す→登録→使う）を通すため、M18-03 着手時に「本サブが触ったファイル × M18-03 の改造対象」を突合して回帰ゲートを足す（E-14）。

---

## 10. 開発者への確認事項
1. **【要確認】画面 19 の登録**：DES-005 §2 に **19＝確定反撃サーチ**を追加（画面名・route `/punish/search`）でよいか。**暫定案**：そのとおり（採用確定反撃＝画面 20 は M18-03 で追加）。
2. **【報告】CHANGE-084 v2 の軽微な stale**：§7 に「開発者から **12 キャラ分**の値を受領後に実装」、§6 申し送りが `dash_forward` のみ言及、と v1 の記述が残っています。実装は §2／§3.1／§4（10 キャラ・5 code・50 行）に従うため**実害はありません**が、中央での是正をご検討ください（§1 の「12 キャラ × 4 code ＝ 48 行」は RESEARCH の実測結果の記述なので**正しい**）。
3. **【任意】`JUMP_SLACK` の調整方針**：初版は定数（1 箇所定義＋根拠コメント）。運用後に `combo_punish_starters.verdict` の分布（`unreachable` 件数＝偽陽性の実測）を見て調整する想定でよいか。**暫定案**：そのとおり。UI 設定への昇格は必要と判明してから。

*以上、M18-02 実装指示書 v1.0.0。配置 `docs/instructions/phase3/M18-02-punish-search.md`。*
