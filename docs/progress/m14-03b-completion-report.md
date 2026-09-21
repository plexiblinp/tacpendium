# M14-03b 完了報告（配布 seed 投入・変換インフラ・seed 契約 6 件）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03b-distribution-seed.md` v2.3.0 |
| レビューチェックリスト | `docs/instructions/reviews/M14-03b-review-checklist.md` v2.1.0 |
| 実施日 | 2026-07-15 |
| 手入力データ場所 | `character_data/*.csv`（開発者指定・コミット済）|
| 承認記録 | Plan 承認 2026-07-15、設計担当回答書 2026-07-16（§D custom_states 確定値）、mai CA 衝突是正承認 2026-07-15 |

---

## 1. Plan Mode 確定方式（§3.3 11 項目の実査結果）

実コード確認で指示書前提とのズレ 6 件を検出・是正した（詳細は承認済み Plan §「事前確認」）。要点:

1. **roster 実査**: characters は実 5 行のみ（ryu/ken/ingrid/c_viper/dhalsim。guile は 000009→000017 で削除済）。→ 第一波 7 キャラの character 行を 000024 で先行 INSERT。
2. **移動 move 実査**: ryu は 7 種のみ（forward/back 不在）。→ 000025 の存在チェック INSERT で forward/back を additive 追加（Q2=Add）。
3. **CSV 実査**: 20 列（+is_derived）。移動 9 種は CSV 非混入（system 行は drive_parry のみ）＝drop は防御的 no-op、drive_parry は通過。
4. **列不在**: moves に `is_derived`/`command`/`condition_*`/`is_projectile`/`target_combo` の物理列なし。→ CSV 原本で保全（コミット済）・索引は seedgen 時に CSV から構築。**moves スキーマ不変**。
5. **手入力ツール**: `autopilot-combomgr/projects/moves-input-tool` は別 go module かつ .gitignore で import 不可・CSV→SQL codegen 不在。→ seedgen を本体 repo に新規実装（設計参照のみ）。
6. **DB 同梱**: マイグレ embed・起動時適用で確定（`.db` embed 非採用）。次連番 000024。

開発者承認事項（§3.3-7 / §3.3-9）:
- **§3.3-9 custom_states（show_delta 表）**: 設計担当回答書（2026-07-16）の確定 7 state / 6 キャラを 000027 に投入（下記 §4）。
- **§3.3-7 ryu recovery 将来 total 整合**: Q4=再計算。将来マイグレで recovery 設定 + `total = startup+active−1+recovery` 再算出。**ただし M14-03c（ryu 全面差し替え）実行時に recovery/total が CSV 値で新規 INSERT・生成時算出されるため本契約は解消される**（M14-03c を実行しない判断時のみ将来マイグレが必要）。

## 2. seed 契約 6 件〔(a)〜(f)〕の充足

| 契約 | 実装 | 検証 |
|------|------|------|
| **(a)** 移動 9 種×全キャラ＋alias 対 | 000025（全 12 キャラに 9 種・official_ja_move alias を存在チェックで冪等投入。ryu に forward/back 追加） | `TestRun_M1403b_SeedIntegrity`: 全 12 キャラが 9 種所持・**alias 欠落 0（生 code フォールバック無し）** |
| **(b)** 掃き取りマイグレ | 000028（残 modifier.type dash→system move 移行＋残行ゼロ検証。000025 より後の連番） | `TestRun_M1403b_SweepMigratesSkippedDash`: skip 相当行を移行・残行ゼロ |
| **(c)** dup スキャン＋再測定 | seedgen **生成時スキャンは 2 軸**（同一キャラ内 code 衝突・alias_text 衝突）で fail・報告。(preset_id,move_id) は 1 move につき official alias 1 件かつ code 一意のため構造的に衝突不能＝**再測定側の 3 軸目**で担保。生成成功後 clean DB 再測定 | `TestRun_M1403b_DupRemeasurement`: 3 軸とも **0 件** |
| **(d)** target_combo passthrough | seedgen が category=target_combo を無改変通過 | `TestGenerate_RemapAndRawData`（target_combo 通過）|
| **(e)** custom_states 新規 INSERT＋show_delta | 000027（確定 7 state・6 キャラ。§4）＋実データ E2E | `TestRun_M1403b_SeedIntegrity`（8 キャラ def・show_delta 5）＋E2E `m14-03b-custom-states-realdata` |
| **(f)** command 索引 IF | `internal/moveindex`（非派生のみ・id 最小タイブレーク・Lookup/LookupAll/Skipped）。seedgen が消費 | `internal/moveindex/*_test.go`・`TestGenerate_IndexExcludesDerivedAndEmpty` |

### 索引 IF 仕様（(f)・M17 G-k 申し送り）

- `Lookup(charKey, token) → (move_code, ok)`: **非派生（is_derived=false）候補のみ**・複数残存時は **move.id 最小（投入順が若い）でタイブレーク**して単一返却。
- `LookupAll(charKey, token) → []move_code`: 候補一覧（id 昇順・デバッグ/人レビュー用）。
- `Skipped() → []Skipped`: 索引非搭載行の記録（**fail しない**）。理由: `derived` / `empty-command` / `unknown-token`(raw{…}) / `condition-residual`(cond{…})。
- 索引キーは CSV 記載の正準表記そのまま（空白正規化のみ・**numpad 正規化層は M17 で後付け可能な位置**）。キャラ別スコープ。
- **本サブの消費者は seedgen（変換系）のみ。本体ランタイム/エンドポイント/UI へ非露出**（指示書 §2.3.1）。M17 G-k は同一モジュールを消費可能。
- 索引実測（第一波 9 キャラ）: 索引非搭載 **278 件**（derived 137・empty-command 141・unknown-token/cond-residual 0※）。※guile の cond{…} 2 行は is_derived=true のため derived に計上。

## 3. 変換インフラ（seedgen）

- 配置: `cmd/seedgen`（CLI）＋ `internal/seedgen`（csv 解析・remap・total 検算・dup スキャン・SQL 生成）＋ `internal/moveindex`（索引）。**dev/build 時専用・本体ランタイム非経路**（取込 FR704 非復活）。
- 生成物: `migrations/000026_seed_moves_first_wave.{up,down}.sql`（**コミット済**）。`go run ./cmd/seedgen -check` で再生成一致を検証（`TestGolden_CommittedMigrationMatchesRegeneration` でドリフト検出）。
- 処理: move_code は CSV を正とし再採番せず・total は式で検算（不一致は fail）・recovery 整数前提（非整数 fail）・raw_data は notes/notes_tool のみ（空→NULL）・移動 9 種 drop・target_combo/rush_variant/drive_parry 通過・rush の original_move_id を元技 code で解決。
- **is_projectile / command / condition_* は列不在のため投入せず CSV 原本で保全**（M18 G-b で is_projectile 列追加時に回収）。

### mai CA alias_text 衝突の是正（dup スキャンが検出）

seedgen の dup スキャンが `mai` の SA3/CA の name_ja 完全一致（「不知火流・炎舞仇桜」）を検出し生成を fail。他 8 キャラは CA に「CA 」接頭辞で区別しているため、開発者承認（2026-07-15）のうえ `character_data/mai.csv` の ca 行 name_ja を「CA 不知火流・炎舞仇桜」へ是正（規約統一）。**dup スキャンが設計どおり機能した実例**。

## 4. custom_states DEF（確定値・設計担当 2026-07-16）

7 state / 6 キャラ。int(stock) のみ show_delta=true（flag には付与しない）。

| キャラ | code | type | value_definition | scope | show_delta | 操作 |
|---|---|---|---|---|---|---|
| lily | windclad | stock | int 0–3 | persistent | true | INSERT |
| juri | fuha_stock | stock | int 0–3 | persistent | true | INSERT |
| juri | feng_shui_engine | flag | boolean | conditional/sa2_active | — | INSERT |
| kimberly | shuriken_bomb_stock | stock | int 0–2 | persistent | true | INSERT |
| mai | flame_stock | stock | int 0–5 | persistent | true | INSERT |
| guile | solid_puncher | flag | boolean | conditional/sa2_active | — | INSERT |
| ryu | denjin_charge | flag | boolean | persistent | — | UPDATE（是正）|

- **guile solid_puncher** は DES-003 §3.2 の記載例をそのまま採用。**juri feng_shui_engine** は同型。
- **ryu 是正（実査報告）**: 現行 000015 の def は `denjin_charge`/電刃錬気/Denjin Charge/flag/boolean で**正しいが `scope` キー無し**。000027 で `scope:"persistent"` を付与（他フィールド温存）。**想定外の別 state は無し**。ingrid（sun_crest・000023）は是正不要。
- **per-combo 2 値 situation `{start_min,end}`**: BE opaque 素通し（`situation *string`）で DDL/DTO 不変。**本サブは moves のみ seed（combos 無し）＝situation 写像は実データで exercise されない**。取込写像の実装能力は変換系側にあるが、combo seed が無いため本サブでは未行使。E2E は Ingrid 既存 def で実施。

## 5. seed マイグレ構成（000024〜000028）

| 連番 | 内容 | 生成 |
|---|---|---|
| 000024 | 第一波 7 キャラ characters 行（ON CONFLICT DO NOTHING）| 手書き |
| 000025 | 移動 9 種×全 12 キャラ＋official_ja_move alias（冪等・ryu forward/back 追加）| 手書き |
| 000026 | 第一波 9 キャラの moves(752)＋alias＋recovery | seedgen 生成 |
| 000027 | custom_states DEF（§4）| 手書き |
| 000028 | dash 掃き取り＋残行ゼロ検証（000025 後）| 手書き |

- FK 依存順 characters→moves→preset_aliases。既存 000001〜000023 非改変。各 down 整備・往復検証（`TestRun_M1403b_DownRollback`）。
- **掃き取り down の限界**: 000028 の down は **no-op（意図的）**。up は clean/user DB で移行対象 0 件（skip 0）＝実質 no-op。移行した行があっても「native dash」と「移行済 dash」を marker 無しに区別できず（000022 down と同じ非対称）、system-move-dash を一律 modifier.type へ戻すと native 入力を破壊するため、あえて逆写像しない。

## 6. 自己テスト結果（§5・ケース数）

- **Go**: `go test ./...` **全パッケージ PASS**。
  - seedgen 単体 9 ケース（remap・total 不一致 fail・code dup fail・alias_text dup fail・unknown category fail・移動 drop・rush original・索引除外・golden ドリフト）。
  - moveindex 単体 6 ケース（単一解決・空白正規化・id タイブレーク・未解決・skip4 種・キャラスコープ）。
  - migrate M14-03b 4 ケース（seed 整合(a)・dup 再測定(c)・掃き取り(b)・往復ロールバック）＋既存 SeedRowCounts/000017 追従。
- **dbtest.Setup 波及追従**: `migrate_test.go`（characters 5→12・guile 0→1・super_art exact→min・000017 テストは v23 固定）、`combo/service_test.go`（ingrid 手動 INSERT 削除＝seed 済み利用で UNIQUE 衝突回避）。
- **E2E（`make e2e`）**: 13 passed。新規 `m14-03b-custom-states-realdata`（ingrid ①②③ 実データ）green。`m12-05` を guile 再追加へ追従。**既存 4 件失敗（m12-03 A/B・m12-06×2・m15-01）は本 seed 変更前の baseline でも再現＝既存問題（スコープ外）**。`combo-csv-io.spec.ts`（ryu 使用・件数非依存）は通過確認のみ。

## 7. 品質チェック・網羅表（段階投入の残範囲）

### 全 30 キャラ 投入状況（31 番目は未実装・F-11）

- **実 moves seed 済み（10 キャラ）**: ryu（既存 000004）＋ terry/guile/lily/ingrid/kimberly/juri/ken/mai/zangief（000026）。
- **character 行＋移動 move のみ（実技未投入・2 キャラ）**: c_viper / dhalsim。
- **未投入＝character 行なし（18 キャラ）**: aki, akuma, alex, blanka, cammy, chun_li, dee_jay, ed, e_honda, elena, jamie, jp, luke, manon, marisa, m_bison, rashid, sagat。
- **custom_states def（8 キャラ）**: ryu/ingrid/c_viper（既存）＋ lily/juri/kimberly/mai/guile（000027）。

### 配布 blocker 残状態

**配布 blocker 未解除**。blocker 解除＝全 30 キャラの実 moves 充足であり、現状 10/30。残 20 キャラは同一インフラの後続マイグレで段階投入する（本サブ完了 ≠ 配布可能）。

### clean マイグレ由来 DB の確認

全検証は `t.TempDir()` の使い捨て DB へ全マイグレ適用して実施（dev DB 非流用）。dev DB 残渣（幽霊 ken moves・偽 recovery/total・E2E rush）の混入なし。dup 再測定 0 件。

### 禁則表現 grep

新規ファイル（migrations 000024-000028・seedgen・moveindex・character_data）に「起き攻け」誤字・「DR」略記・簡体字（风 等）なし。custom_states は Japanese kanji（風纏い/風破/風水）を使用。

### 意図的除外の可視化〔H-5〕（importer 差分・報告のみ）

importer（`combomgr-importer/dist/*.csv`・別 repo・**参照可**）の行数と手入力 CSV の行数比較（**move_code 体系が異なる〔F-1〕ため厳密突合でなく件数の目安**）:

| char | importer | hand-input | 差の主因 |
|---|---|---|---|
| terry | 58 | 70 | hand は rush_variant＋drive_parry を含む（importer 非搭載・F-2）|
| guile | 72 | 88 | 同上 |
| lily | 66 | 81 | 同上 |
| ingrid | 67 | 91 | 同上 |
| kimberly | 78 | 95 | 同上 |
| **juri** | **79** | **73** | **hand が importer より少ない＝公式にあって手入力に無い行の可能性（要開発者確認）** |
| ken | 68 | 80 | 同上（rush 差）|
| mai | 82 | 96 | 同上 |
| zangief | 64 | 78 | 同上 |

大半は rush_variant＋drive_parry が hand 側に加わるため hand > importer。**juri のみ hand < importer** で、公式にあって手入力に無い行がある可能性（意図的除外か漏れかは開発者判断）。変換系は手入力を正とし差分で止めず、本報告のみとする。

## 8. 設計担当への申し送り（DES 反映候補・製造は DES 非編集）

1. **is_derived の恒久配置は M17-02 G-k の未決事項**。本サブは CSV 保全＋seedgen 時フィルタで閉じた（moves スキーマ不変・CHANGE 不要）。M17-02 で move_commands テーブル＋is_derived 恒久配置を正典化（bool 列にすると技ピッカー UI でも再利用可・索引テーブル側フィルタのみだと再利用時に再スキーマ変更）。
2. **索引モジュール `internal/moveindex` の正典化**（CHANGE 候補・M17 で消費者拡張）。
3. **Q4 ryu recovery 将来 total 契約は M14-03c 実行で解消**（§1）。
4. **失効 dash 記述**（DES-002 §7.5・SUPP-001 §3.3.3）の是正は M17 の DES 改訂に同梱（指示書 §10）。
5. **juri の importer 差分**（公式にあって手入力に無い行の可能性・§7）。
6. **既存 E2E 4 件の pre-existing 失敗**（m12-03 A/B・m12-06×2・m15-01）は本サブ非起因（baseline 再現）だが要別途対応。
7. **開発者の手入力メモ**（`docs/human-notes/Memo_Someday.txt`）が checkpoint 1 コミットに混入（git add -A による巻き込み・開発者の未コミット編集）。履歴整理時に分離検討。

## 9. M14-03c への引き継ぎ

- ryu 正規再 seed（moves 全面差し替え＋combos クリア）は本サブと同一の seedgen インフラで実施可能（`character_data/ryu.csv` は受領済み）。連番は 000028 の後。本サブでは ryu の moves/combos に非改変（forward/back の additive 追加と denjin_charge の scope 是正のみ）。

---

*以上、M14-03b 完了報告。*
