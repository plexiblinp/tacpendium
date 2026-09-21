# M18-02-RESEARCH-01 調査結果レポート: 移動 system move（前ダッシュ・ジャンプ）のフレーム保持実態

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/phase3/M18-02-RESEARCH-01-dash-frames.md`（v1.1.0） |
| 種別 | read-only 調査（事実列挙のみ・judgement-free） |
| 対象 code | `dash_forward` / `jump_neutral` / `jump_forward` / `jump_back`（4 code） |
| 調査日 | 2026-07-23 |
| 書き込み | **本レポートファイルの作成のみ**（DB は SELECT 相当のみ・コード/マイグレ/CSV/設計書 変更なし） |

---

## 調査手法に関する前置き（重要・事実）

- **dev DB `~/.local/share/combomgr/combomgr.db` は本実行環境（クラウド新規コンテナ）に存在しなかった**（`ls` で不在を確認）。
- そのため **`migrations/*.up.sql`（全 39 本）を番号順に一時 DB（scratchpad 上の使い捨て SQLite）へ適用して seed 状態を再構成**し、その上で SELECT した。
  - 正当性：対象 4 code の `moves` 行は **seed マイグレのみが投入元**（§2 で全数追跡）。ユーザー生成データは対象 4 code の行に影響しないため、マイグレ再構成は本番 dev DB の seed 状態と等価（dev DB もアプリ起動時に同じマイグレを適用して作られる）。
  - 39 本すべてがエラーなく適用され、`characters=12`・`moves=944` を得た。
- **プロジェクト成果物（コード・マイグレ・CSV・設計書・既存 DB）への書き込みはゼロ**。一時 DB は scratchpad 内のみ。
- `sqlite3` CLI は環境に無く、指示書 §2.2 の許可どおり **python3 標準 `sqlite3` モジュール**（`sqlite_version 3.45.1`）を使用した。

---

## 結論サマリ（冒頭）

**対象 4 code すべてが「ケース B（値なし）」に該当する。具体的には全キャラで全フレーム列が NULL。**

| code | 行数（母数=characters 12） | 保有キャラ数 | `total` 非 NULL | `startup` 非 NULL | `total` の相異値種類数 | 判定 |
|------|------|------|------|------|------|------|
| `dash_forward` | 12 / 12 | 12（全キャラ） | **0** | 0 | 0 | **ケース B（全 NULL）** |
| `jump_neutral` | 12 / 12 | 12（全キャラ） | **0** | 0 | 0 | **ケース B（全 NULL）** |
| `jump_forward` | 12 / 12 | 12（全キャラ） | **0** | 0 | 0 | **ケース B（全 NULL）** |
| `jump_back` | 12 / 12 | 12（全キャラ） | **0** | 0 | 0 | **ケース B（全 NULL）** |

- ケース B の内訳は **「全キャラ同一の便宜値」ではなく「NULL（値そのものが不在）」**。`startup`/`active`/`total`/`recovery`/`on_block`/`on_hit`/`damage` の 7 フレーム系列すべてが 48 行（12 キャラ × 4 code）で NULL。
- `is_aerial` は 4 code とも全キャラ **0**（ジャンプ 3 code も 0＝ジャンプ move 自体には空中フラグが立っていない）。`is_derived`=0・`is_projectile`=0・`raw_data`=NULL も 48 行すべて共通。
- code 間・キャラ間の非対称は **なかった**（ダッシュだけ値あり等の割れは存在せず、4 code × 12 キャラすべて均一に NULL）。
- 欠けているキャラは **なし**（4 code とも 12 キャラ全員が 1 行ずつ保有。攻撃技を持たない `c_viper`/`dhalsim` もこの 4 code は保有）。

---

## §1 対象 4 code の全キャラ実列挙（3-1・全 48 行・truncate なし）

取得列は指示書 §3-1 指定の全列。`characters` 総数 = **12**（`ryu, ken, ingrid, c_viper, dhalsim, terry, guile, lily, kimberly, juri, mai, zangief`）。
全 48 行で `category=system`、`startup=active=total=recovery=on_block=on_hit=damage=NULL`、`is_aerial=is_derived=is_projectile=0`、`raw_data=NULL`。

### §1-1 `dash_forward`（12 行）

| char | category | startup | active | total | recovery | on_block | on_hit | damage | is_aerial | is_derived | is_projectile | raw_data |
|------|------|------|------|------|------|------|------|------|------|------|------|------|
| ryu | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ken | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ingrid | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| c_viper | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| dhalsim | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| terry | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| guile | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| lily | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| kimberly | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| juri | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| mai | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| zangief | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |

### §1-2 `jump_neutral`（12 行）

| char | category | startup | active | total | recovery | on_block | on_hit | damage | is_aerial | is_derived | is_projectile | raw_data |
|------|------|------|------|------|------|------|------|------|------|------|------|------|
| ryu | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ken | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ingrid | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| c_viper | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| dhalsim | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| terry | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| guile | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| lily | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| kimberly | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| juri | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| mai | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| zangief | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |

### §1-3 `jump_forward`（12 行）

| char | category | startup | active | total | recovery | on_block | on_hit | damage | is_aerial | is_derived | is_projectile | raw_data |
|------|------|------|------|------|------|------|------|------|------|------|------|------|
| ryu | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ken | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ingrid | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| c_viper | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| dhalsim | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| terry | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| guile | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| lily | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| kimberly | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| juri | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| mai | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| zangief | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |

### §1-4 `jump_back`（12 行）

| char | category | startup | active | total | recovery | on_block | on_hit | damage | is_aerial | is_derived | is_projectile | raw_data |
|------|------|------|------|------|------|------|------|------|------|------|------|------|
| ryu | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ken | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| ingrid | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| c_viper | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| dhalsim | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| terry | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| guile | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| lily | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| kimberly | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| juri | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| mai | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |
| zangief | system | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 0 | 0 | 0 | NULL |

**判定の核心（指示書 §3-1 (a)〜(d)）への回答**：
- (a) `total`：**全 48 行で NULL**。
- (b) 値が入っているキャラ：**皆無**（便宜値・キャラ別値のいずれも存在しない）。
- (c) `startup`/`active`/`recovery`：**全 NULL**。よって `total = 発生 + 持続 − 1 + 硬直`（DES-003 §3.5・CHANGE-028）を導出できる素材も無い。
- (d) ジャンプ 3 code どうしの差：**差なし**（`jump_neutral`/`jump_forward`/`jump_back` すべて同一＝全 NULL）。

---

## §2 値の出所（3-2・マイグレ / CSV / seedgen 追跡）

### §2-1 `moves` テーブルのフレーム列 DDL 由来（事実）

- フレーム列は初期 DDL（`000001_init_schema.up.sql` の `CREATE TABLE moves`）には **無く**、後続の `ALTER TABLE moves ADD COLUMN` で追加される（code-facts `internal/infra/migration` 節に `ADD COLUMN startup INTEGER`・`ADD COLUMN is_aerial INTEGER NOT NULL DEFAULT 0` 等を確認）。
- `internal/model/move.go` の `Move` struct では `Startup/Active/Total/OnHit/OnBlock/Damage/Recovery` がすべて `*int`（**NULL 可**）、`IsAerial`/`SetupOnly` が `bool`（NOT NULL）。

### §2-2 対象 4 code を INSERT / UPDATE しているマイグレ全件（ファイル・行番号）

`migrations/` 全体を grep（4 code の系統網羅）。フレーム列に値を入れている箇所は **1 件も無かった**。

| マイグレ | 該当行 | 対象 4 code への操作 | フレーム列への値投入 |
|------|------|------|------|
| `000004_seed_moves_ryu.up.sql` | 112, 114, 115, 116 | ryu へ `dash_forward`/`jump_neutral`/`jump_forward`/`jump_back` を `category='system'` で INSERT | **なし**（各行の値は `'system', NULL`＝category とフレーム相当が NULL） |
| `000025_seed_movement_system_moves_all.up.sql` | 27, 29, 30, 31（INSERT 本体）/ 48, 50, 51, 52（alias） | 全キャラへ移動 9 種（4 code 含む）を INSERT。**投入列は `character_id, code, category` の 3 列のみ** | **なし**（フレーム列は SELECT 句に不在＝未指定＝NULL のまま） |
| `000014_seed_characters_classic5.up.sql` | 14 | コメントのみ（「純粋入力ジャンプの seed 管理は本 MS では扱わず」） | なし（コメント） |
| `000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` | 69, 91 | コメントのみ（4 code は変換対象外の言及） | なし（コメント） |
| `000022_unify_dash_to_system_move.up.sql` | 2, 3, 44, 69 | **`combo_steps`/`setup_steps` の `modifiers.type` dash を system move dash 参照へ移行**（`moves` のフレーム列は非対象） | なし |
| `000028_sweep_modifier_dash.up.sql` | 3, 30, 55, 69, 71 | 同上（`combo_steps`/`setup_steps` の掃き出し。`moves` フレーム非対象） | なし |
| `000029_clear_ryu_legacy_seed.up.sql` | 11, 12, 114, 115, 122, 123 | ryu legacy seed 削除時に **移動 9 種（4 code 含む）は「削除しない」保護対象として列挙** | なし（削除除外の列挙のみ・値投入なし） |

**結論（§2-2）**：対象 4 code の `moves` 行への**フレーム値投入マイグレは存在しない**。投入元は (i) ryu のみ `000004`（frames NULL）、(ii) 全キャラ `000025`（3 列のみ＝frames 未指定）の 2 経路で、いずれも**フレーム列を NULL のまま残す**。

### §2-3 CSV（`character_data/*.csv`）における対象 4 code の存在（事実）

- CSV 実ヘッダ（`character_data/ken.csv` ほか全 15 ファイル共通・**実物を確認**）：
  `character_code,move_code,category,name_ja,startup,active,recovery,total,on_hit,on_block,damage,is_aerial,is_projectile,is_derived,notes,notes_tool,original_move_code,command,condition_ja,condition_en`
- **対象 4 code（`move_code` 列の完全一致）を含む CSV 行は 15 ファイル中 0 件**（`awk -F, '$2==...'` で全ファイル走査・ヒット 0）。
- 補足（false-positive の弁別）：`grep` の部分一致では `character_data/rashid.csv` がヒットするが、実体は `buffed_dash_forward` / `buffed_jump_forward` / `buffed_jump_neutral` / `buffed_jump_back`（**`category=unique` の「【強化】」派生技**・`move_code` が別物）であり、**対象の system move 4 code ではない**。なお rashid は現行 dev DB の 12 キャラに含まれない（未 seed）。

### §2-4 seedgen 経路との関係（どちらが一次源か・事実）

- `internal/seedgen/model.go`（29〜34, 70〜72 行）に `movementSystemCodes`（移動 9 種 = `forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`）が定義され、`isMovementSystem()` が `category=="system" && movementSystemCodes[code]` の行を **drop 対象**とする。
- `internal/seedgen/generate.go`（166, 177 行）が生成 SQL 冒頭に `-- 移動 system move 9 種は drop 済(投入元は 000025)。` を出力。テスト `generate_test.go`（122〜126 行）も `dash_forward` が `Dropped` に入り UpSQL に出ないことを保証。
- したがって **対象 4 code の一次源は CSV/seedgen ではなく、`000025`（全キャラ）＋ `000004`（ryu）の手書き静的 seed**。CSV に 4 code を書いても seedgen が drop するため CSV は投入経路にならない。
- `000026_seed_moves_first_wave.up.sql`（4 行目コメント）も「移動 system move 9 種は drop 済（投入元は 000025）」と明記。

---

## §3 比較材料（3-3・判断なし・事実のみ）

### §3-1 他の移動 system move のフレーム充填状況

| code | 行数（母数=12） | フレーム列いずれか非 NULL の行数 |
|------|------|------|
| `dash_back` | 12 | **0** |
| `micro_forward` | 12 | **0** |
| `micro_back` | 12 | **0** |
| `forward` | 12 | **0** |
| `back` | 12 | **0** |

→ 移動 system move 9 種は **全 9 code × 全キャラでフレーム列がすべて NULL**（対象 4 code と完全に同傾向）。

### §3-2 `drive_parry`（`category=system` の非攻撃 move）の充填状況

| char | startup | active | total | recovery | raw_data |
|------|------|------|------|------|------|
| ryu | 1 | 12 | 45 | 33 | NULL |
| ken | 1 | 12 | 45 | 33 | NULL |
| ingrid | 1 | 12 | 45 | 33 | NULL |
| terry | 1 | 12 | 45 | 33 | NULL |
| guile | 1 | 12 | 45 | 33 | NULL |
| lily | 1 | 12 | 45 | 33 | NULL |
| kimberly | 1 | 12 | 45 | 33 | NULL |
| juri | 1 | 12 | 45 | 33 | NULL |
| mai | 1 | 12 | 45 | 33 | NULL |
| zangief | 1 | 12 | 45 | 33 | NULL |

- `drive_parry` は **10 キャラ**が保有（母数 12 中。`c_viper`・`dhalsim` は非保有）。
- フレームは **全キャラ一律 `startup=1, active=12, total=45, recovery=33`**（`total = 1 + 12 − 1 + 33 = 45` で DES-003 §3.5 の算出式と整合）。
- `raw_data` は **全 10 行で NULL**（後述 §4・想定外の発見も参照）。
- 対比：同じ `category=system` でも **`drive_parry` はフレーム充填済／移動 9 種は全 NULL**という非対称が現データに存在する。

---

## §4 raw_data の記述（3-4・事実確認のみ）

- **対象 4 code の `raw_data` は全 48 行で NULL**。ダッシュ／ジャンプの全体フレーム・着地硬直等に相当する文字列は**一切残っていない**（`notes`/`notes_tool` 等の退避も無し）。
- 移動 system move 9 種すべてで `raw_data` は NULL。
- （スコープ注記どおり、外部サイト等からの正値補完は行っていない。DB/CSV/マイグレ内の文字列のみを確認した結果が上記。）

---

## §5 空中技（`is_aerial=1`）の存在状況（3-5・事実のみ）

- `moves` 総行数（母数）= **944**。
- **`is_aerial = 1` の行数 = 70**。
- そのうち **`startup` 非 NULL = 70**（＝空中技 70 件はすべてフレーム判定に使える `startup` を保持）。
- キャラ別 `is_aerial=1` 件数（合計 70）：

| char | is_aerial=1 件数 |
|------|------|
| kimberly | 10 |
| zangief | 9 |
| lily | 7 |
| ken | 7 |
| juri | 7 |
| terry | 6 |
| ryu | 6 |
| mai | 6 |
| ingrid | 6 |
| guile | 6 |
| c_viper | 0 |
| dhalsim | 0 |

（`c_viper`・`dhalsim` は攻撃技を持たないため空中技 0。10 キャラ分の合計 = 10+9+7+7+7+6+6+6+6+6 = 70。）

---

## 想定外の発見（事実指摘のみ・判断しない）

1. **`drive_parry` の現データが DES-003 §3.3（CHANGE-038）の記述と食い違う。**
   DES-003 §3.3 は drive_parry を「持続は公式が注釈付き範囲（`[※2] 1-12`）で記載されるため **active は空とし、原文を raw_data/notes へ退避**する」と記す。しかし現行 seed の実データは **`active=12`（充填）・`raw_data=NULL`（退避なし）**。指示書 §3-3 が「先例」として挙げた active 空＋raw_data 退避の扱いは、**少なくとも現在の `drive_parry` seed 行には適用されていない**。（この設計記述は CSV 取込 FR701 前提のもので、取込は M14-02／CHANGE-054 で廃止済み。現 drive_parry は静的 seed 由来。）
2. **ジャンプ move の `is_aerial` は 0。** `jump_neutral`/`jump_forward`/`jump_back` はジャンプ動作そのものだが `is_aerial=0`。空中技（跳び込み攻撃）側が `is_aerial=1` を持つのであって、ジャンプ移動 move には立たない（DES-004 §2.1・(c) flag／§3-5 の空中技 70 件は別 move 群）。
3. **`rashid.csv` 等の未 seed CSV が存在する。** `character_data/` は 15 ファイルだが dev（再構成）DB のキャラは 12。`rashid`/`luke`/`m_bison`/`jamie`/`manon` 等は CSV があるが未投入。rashid CSV には `buffed_dash_forward` 等（`category=unique`・フレーム値あり：例 `buffed_dash_forward` は startup=1/active=20/recovery=0/total=20）が入っているが、これらは **対象 system move 4 code とは別 code**。
4. **フレーム列は初期 DDL に無く後付け。** `moves` の `startup`/`active`/`total`/`recovery`/`on_hit`/`on_block`/`is_aerial` は `000001` の DDL に無く、後続マイグレの `ADD COLUMN` で追加された（`is_aerial` のみ NOT NULL DEFAULT 0、他は NULL 可）。移動 9 種はこの後付け列に対して値未設定のまま。

---

## 要決定事項（番号付き・設計担当が判断・本レポートでは決定しない）

1. **前ダッシュ全体フレームのデータ源をどう確保するか。** 現状 `dash_forward` の `total` は全キャラ NULL のため、`残り猶予 = 有利フレーム − dash_forward 全体` が計算不能。既存列（`total`）へ値を投入する方針か、新列を追加する方針か（新列追加なら中央経由で開発者承認ゲート）、または「データ待ち」で手動確認レーンに留めるか。
2. **`total` 列を転用してよいか。** 移動 9 種の `total` は「発生+持続−1+硬直」の攻撃技用途で定義されている。ダッシュ/ジャンプの「全体フレーム」を同じ `total` に載せるのが意味論的に妥当か、専用列が要るか。
3. **ジャンプ経由の判定に必要な列の粒度。** 指示書注記のとおりジャンプは「離陸〜攻撃可能まで」と「全体（着地硬直込み）」の区別が要る見込み。現 `moves` スキーマ（`startup`/`total` 等）でこの 2 値を表現できるか、着地硬直用の列が要るか。
4. **値の入手手段。** CSV/seedgen は移動 9 種を drop する現設計のため、CSV に書いても投入されない。値を入れるには (a) seedgen の drop 対象から外す、(b) 静的 seed マイグレ（000025 系）に値を足す、のいずれかが要る。どちらを一次源にするか。
5. **`drive_parry` 記述と実データの齟齬（想定外の発見 1）の是正要否。** DES-003 §3.3 の active 空＋raw_data 退避の記述と現データ（active=12・raw_data=NULL）の食い違いを errata / CHANGE で正すか、放置可か。
6. **ジャンプ move の `is_aerial=0` を前提に、ジャンプ経由の反撃式で「ジャンプ move」と「空中技 move」をどう連結するか**（空中技 70 件側は `startup` を持つ＝判定素材はある）。

---

## 検算（E-16／E-18・何を・単位・母数を併記）

| 集計対象 | 値 | 単位 | 母数 |
|------|------|------|------|
| `characters` 総数 | 12 | 行 | — |
| `moves` 総数 | 944 | 行 | — |
| `dash_forward` 行数 | 12 | 行 | characters 12 |
| `jump_neutral` 行数 | 12 | 行 | characters 12 |
| `jump_forward` 行数 | 12 | 行 | characters 12 |
| `jump_back` 行数 | 12 | 行 | characters 12 |
| 対象 4 code 合計行数 | 48 | 行 | 12 キャラ × 4 code |
| 対象 4 code の `total` 非 NULL | 0 | 行 | 48 |
| 対象 4 code の `startup` 非 NULL | 0 | 行 | 48 |
| 対象 4 code の相異なる `total` 値の種類数 | 0（各 code とも 0） | 種 | 非 NULL 0 件 |
| 移動 9 種（対象 4 + `dash_back`/`micro_forward`/`micro_back`/`forward`/`back`）のフレーム非 NULL | 0 | 行 | 各 code 12 行 |
| `drive_parry` 保有キャラ | 10 | キャラ | characters 12 |
| `drive_parry` の相異なる `total` 値 | 1 種（=45） | 種 | 10 行 |
| `is_aerial=1` 行数 | 70 | 行 | moves 944 |
| `is_aerial=1` かつ `startup` 非 NULL | 70 | 行 | is_aerial=1 の 70 |
| CSV（15 ファイル）中の対象 4 code 行（move_code 完全一致） | 0 | 行 | CSV 15 ファイル |

---

## 完了条件（DoD）チェック

- [x] §3-1〜3-5 の全項目に事実で回答（不明の穴埋めなし）。
- [x] 全キャラの対象 4 code を行単位で列挙（48 行・truncate なし）。
- [x] 集計値に「数えた対象・単位・母数」を併記。
- [x] 結論を code ごとに確定（4 code すべてケース B＝全 NULL）。
- [x] **書き込みゼロ**：本レポートファイル作成のみ。DB は一時再構成への SELECT のみ・プロジェクトの DB/コード/マイグレ/CSV/設計書は不変更。

*以上、M18-02-RESEARCH-01 調査結果レポート。read-only・judgement-free。中央への報告は事後で可（採番なし）。*
