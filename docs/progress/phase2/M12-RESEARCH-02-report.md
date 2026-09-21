# M12-RESEARCH-02 調査報告: M12-05(seed 整理 + B-7 move_code 統一・案B)着手前調査

| 項目 | 内容 |
|------|------|
| 文書ID | M12-RESEARCH-02-report |
| 対象指示書 | `docs/instructions/M12-RESEARCH-02-seed-cleanup-movecode-survey.md`(v1.0.0) |
| 種別 | 調査報告(read-only。実装・マイグレ作成・コード変更ゼロ) |
| 作成日 | 2026-06-25 |
| 調査担当 | 製造担当 Claude Code(research_plan) |
| 調査方式 | 実 SQL / 実コード / 実テストの view + grep(全数)。件数・code・JSON は実値 |
| 開発者提供 | D-1 再取込対象 = `combomgr-importer/dist` の **c_viper / dhalsim / ingrid / ken / ryu**(2026-06-25 受領) |

> **read-only 厳守**: 本調査ではソース・マイグレ・seed・DES・テストを一切変更していない。書き込みは本報告ファイルのみ。
> **judgement-free**: 「削除して安全」「この順で消すべき」等の最終判断はしない。複数案は §推奨 で併記し、決定は M12-05 の Plan Mode(開発者)に委ねる。

---

## 0. 結論サマリ(冒頭集約)

1. **旧形 move_code の所在は seed の 4 ファイルに限定**。production コード(非テスト Go)には **0 件**。非テストのフロントは **`useControllerInput.ts` の `BUTTON_TO_MOVE_CODE` 1 箇所のみ**(`controllerTypes.ts` の 1 件はコメント)。i18n(`*.json`)・recipe 実コード・取込 CSV には旧形 **0 件**。
2. **取込 CSV(dist 5体)は完全に新形(正典)準拠**。FR704 で再取込すれば対象キャラの `moves.code` は新形になる。`moves` の upsert キーは `(character_id, code)` のため、**旧形 seed 行は新形行と別レコードとして残存(置換されず orphan 化)**する。
3. **B-7 ロックステップの seed 側(b)は移動対象が 4 ファイル**: `000004`(ryu moves+rush)・`000006`(ryu aliases)・`000010`(aki/jamie/guile moves)・`000011`(aki/jamie/guile aliases)。`000012`(耐久 combos)の combo_steps も旧形 code で move を引いているが、000012 は M12-05 の主除去対象。
4. **dbtest.Setup は全マイグレを適用**(B-1 確定)。**耐久 seed(36 件)に固定値で依存するテストが 2 つ**(`migrate_test.go` の count=36 / recipe_cache=36)。**旧形 code に依存するテストが多数**(Go テスト 12 ファイル + フロントテスト 7 ファイル)。これらは 000012 除去 / B-7 code 改名で fixture 修正が要る。
5. **再取込対象 5体(ryu/ken/ingrid/c_viper/dhalsim)に aki/jamie/guile は含まれない**。aki/jamie/guile は先行リリース対象外かつ旧形 seed の本体。コントローラ(a)を新形化すると、**aki/jamie/guile の seed を新形化 or 除去しない限り、当該3体で B-7 と同じ無反応症状が残る**(要決定の核心)。
6. **custom_states を「複数」持つキャラは現状ゼロ**(各キャラ `states` 配列は最大 1 要素)。jamie の `drunk_level`(composite)は正典(Drink Level / Int 0–4)と型が乖離(F-2)。
7. **次マイグレ連番 = 000017**(最終 000016 の次)。

末尾 §要決定事項 に M12-05 スコープ確定用の論点を番号付きで集約。

---

## A. seed / migration 共存実体

### A-1. 000012_seed_combos_durability(実態)

- **combos 件数 = 36**(aki 12 / jamie 12 / guile 12)。**ryu は対象外**(INSERT も DELETE も ryu を含まない)。
- 対象 character_id: `characters.code IN ('aki','jamie','guile')`(コードで join、id 直書きなし)。
- 投入カラム: `character_id, is_draft(=0), position, opponent_stance, hit_type, damage, step_count, memo`。memo を各キャラ内一意の相関キーにして combo_id を後段で引く設計。
- **combo_steps**: 全て move ステップ(`modifiers` なし)。memo で combo_id、`(character_id, code)` で move_id を引く。step 数 = 各 combo の `step_count` 合計 = **96 行**(AKI 34 / JAM 31 / GUI 31)。
- 末尾 UPDATE は 2 つ:
  - (3) `starter_move_id` を step_order=1 の move_id で更新(aki/jamie/guile)。
  - (4) `recipe_cache` を `official_ja_move` エイリアスから連結(`" > "` 固定)し、全プリセット ID に同一文字列で JSON 投入(aki/jamie/guile)。
- **down.sql**: `DELETE FROM combos WHERE code IN ('aki','jamie','guile')`。combo_steps は `ON DELETE CASCADE` で連鎖削除。ryu combos は対象外(そもそも存在しない)。

### A-2. 000004 / 000010 の旧形 move_code(全数)

両ファイルとも旧形。正典(DES-004 §2.1 = 新形)との突合は下表。

| 区分 | seed の旧形(実値) | 正典(新形) | 件数/キャラ |
|------|----------|-----------|------|
| 通常技・立ち | `stand_light_punch` … `stand_heavy_kick` | `standing_light_punch` … `standing_heavy_kick` | 6 |
| 通常技・しゃがみ | `crouch_light_punch` … `crouch_heavy_kick` | `crouching_light_punch` … `crouching_heavy_kick` | 6 |
| 通常技・ジャンプ攻撃 | `jump_light_punch` … `jump_heavy_kick` | `jumping_light_punch` … `jumping_heavy_kick` | 6 |
| 通常投げ | `forward_throw` / `back_throw` | `throw_forward` / `throw_back` | 2 |

- 旧形が含まれるキャラ: **ryu(000004)・aki/jamie/guile(000010)**。1 キャラあたり旧形 = 通常技 18 + 投げ 2 = **20 code**。
- **ryu 000004 のラッシュ版 6 件**は旧形 base を埋め込む: `rush_stand_medium_punch` / `rush_stand_medium_kick` / `rush_crouch_medium_punch` / `rush_crouch_medium_kick` / `rush_stand_heavy_punch` / `rush_crouch_heavy_kick`(正典なら `rush_standing_*` / `rush_crouching_*`)。
- **既に正典準拠(改名不要)**: `drive_impact` / `drive_parry`(正典)、特殊・必殺・SA(`hadoken_*` / `shoryuken_*` / `tatsumaki_*` / `shien_*` / `ryusui_*` / `sonic_*` / `sa1_*` 等)、移動/システム(`jump_neutral` / `jump_forward` / `jump_back` / `micro_forward` / `micro_back`)。
- **想定外の発見(事実)**: 000004 / 000010 の `dash_forward` / `dash_back`(category=system)は、DES-004 §2.1 の「移動・ジャンプ動作」表に列挙されている code(`forward` / `back` / `micro_forward` / `micro_back` / `jump_neutral` / `jump_forward` / `jump_back`)に **含まれない**(同表に dash 系の行なし)。B-7 の通常技/投げスコープ外だが、正典表と seed に不一致が存在する事実として記録(判断はしない)。

### A-3. classic5 の moves が seed か取込か

- 移動 seed は **000004(ryu)と 000010(aki/jamie/guile)のみ**(grep 全数で確認)。
- **ken / ingrid / c_viper / dhalsim の moves seed は存在しない**。000014 は characters 行(表示名)のみ加算 INSERT(`ON CONFLICT DO NOTHING`)。→ **マイグレのみの DB ではこの4体は moves が 0 件**。moves は実行時の FR704 取込(`combomgr-importer/dist` の CSV)由来。
- 取込 CSV の code は **新形(正典準拠)**(A の dist 実査・D-2 参照)。→ 取込済みなら ken/ingrid/c_viper/dhalsim の `moves.code` は新形。
- **ryu の moves は現状 000004(seed・旧形)に由来**。再取込していなければ旧形のまま。再取込で新形 ryu moves が別 code として加わる(A-2 / D-2 / D-3)。

**正典との差**: ryu=旧形 seed、aki/jamie/guile=旧形 seed、ken/ingrid/c_viper/dhalsim=新形(取込時)。同一 DB 内に旧形と新形が混在しうる。

**M12-05 含意**: B-7 の seed(b)が触るのは旧形を持つ **ryu + aki/jamie/guile** のみ。ken/ingrid/c_viper/dhalsim は seed 移行対象でない(取込で新形)。

### A-4. 000012 seed と 000016(drive_damage REAL 化)の整合

- **000012 は `drive_damage` を INSERT していない**(投入カラムに drive_damage を含まない → NULL のまま)。
- 適用順は連番どおり **000012 → 000016**。000016 はテーブル再構築(`new_combos` へ全列 SELECT コピー → DROP → RENAME)で、`drive_damage` を `SELECT ... drive_damage ...` でそのまま移送(NULL は NULL)。
- → **000012 投入後に 000016 を適用しても破綻しない**(drive_damage は NULL のまま REAL 列へ移送)。「整数を REAL で受ける」問題は 000012 経由では発生しない(値を入れていないため)。

---

## B. dbtest.Setup 波及

### B-1. dbtest.Setup は全マイグレを適用(確定)

- 定義: `internal/testutil/dbtest/dbtest.go`。`Setup(t)` / `SetupWithPath(t)` とも `migration.Run(ctx, dbPath, combomgr.MigrationsFS)` を呼び、**embed の全マイグレ(000001〜000016)を一時 DB に適用**。
- → 各テストの DB には **耐久 seed 36 件・旧形 move seed が常に入る**(retrospective-digest §5 の波及前提が成立)。

### B-2. 耐久 seed / 旧形 code へのテスト依存(全数 grep)

**(i) 耐久 seed(36 件)への固定値依存 — 000012 除去で壊れる:**

| 箇所 | 依存内容 | 影響 |
|------|---------|------|
| `internal/infra/migration/migrate_test.go:452` | `combos WHERE code IN ('aki','jamie','guile') == 36`(exact) | 000012 除去で 0 になり **失敗** |
| `internal/infra/migration/migrate_test.go:453` | 同条件 + `recipe_cache IS NOT NULL == 36`(exact) | 同上 **失敗** |

**(ii) 耐久 seed を「除外」して動くテスト(除去しても緑のまま):**

| 箇所 | 内容 |
|------|------|
| `internal/service/combo/service_test.go:75,816` 周辺 `countCombos` ヘルパ | `WHERE character_id NOT IN (aki/jamie/guile)` で除外集計。000012 除去後も count=0 を維持 → 緑のまま(ただしヘルパ内コメント/条件が耐久 seed 前提) |

**(iii) 旧形 move_code への依存 — B-7 の code 改名で壊れる(全数):**

- Go テスト(`stand_*` / `crouch_*` / `forward_throw` / `back_throw` を直書き)= **12 ファイル**:
  `internal/repository/combo/repository_test.go`(33 ヒット)、`internal/repository/setup/repository_test.go`(18)、`internal/service/notation/resolver_test.go`(16)、`internal/service/setup/service_test.go`(4)、`internal/service/combo/service_test.go`(3)、`internal/infra/migration/migrate_test.go`(3)、`internal/api/combo/handler_test.go`(3)、`internal/repository/preset/repository_test.go`(2)、`internal/service/notation/{setup_resolver_test.go,service_test.go,cache_test.go}`(各1)、`internal/service/movesimport/parse_test.go`(1)。
  - 特に `migrate_test.go:487-493`(`TestRun_RushVariantOriginalMoveID`)は `rush_stand_medium_punch` → `stand_medium_punch` を **exact 比較**。ryu seed の code 改名で **失敗**。
- フロントテスト(`.test.tsx`/`.test.ts`)= **7 ファイル**:
  `web/src/features/combo/components/VirtualController/VirtualController.test.tsx`(11)、`web/src/features/setup/components/SetupRecipeEditor.test.tsx`(2)、`web/src/pages/ImportMovesPage.test.tsx`(1)、`web/src/features/import/types.test.ts`(1)、`web/src/features/combo/components/ModifiersEditor.test.tsx`(1) 等。

**正典との差**: テスト fixture が旧形・耐久 seed に固定で依存している(設計の正典は新形・耐久 seed は検証用)。

**M12-05 含意**:
- 000012 除去だけでも `migrate_test.go` の 2 アサーション修正が **必須**(= 単純な seed 除去で済まない事実)。
- B-7 の code 改名は **Go 12 + フロント 7 = 計 19 のテストファイル**に fixture 波及。改名と同時にテスト修正がロックステップで要る。

### B-3. 既存マイグレテストへの新規無効化マイグレ波及(机上)

- `migrate_test.go` の seed 検証テスト(`TestRun_SeedData` 系・行 440-471)は **全マイグレ適用後の最終状態**を exact/min でアサート。
- 仮に新規 000017 で 000012 の耐久 combos を DELETE すると、`combos==36`(L452)・`recipe_cache==36`(L453)が **0 になり破綻**。→ 新規無効化マイグレ追加方式でも当該テスト修正は不可避。
- 000016 round-trip テスト(`TestRun_*` の drive_damage REAL 検証群)は drive_damage 型・データ移送が対象で、耐久 seed の有無に直接依存しない見込み(combos 行数は数えるが drive_damage 値は 000012 で未投入)。**新規 000017 が combos を DELETE する場合のみ、行数前提の有無を要再確認**(本調査では追加せず机上評価)。

---

## C. B-7 実装範囲(実査)

### C-1. BUTTON_TO_MOVE_CODE の旧形マッピング(全列挙)

`web/src/features/combo/components/VirtualController/useControllerInput.ts:17-27`:

```ts
const BUTTON_TO_MOVE_CODE: Partial<Record<LogicalButton, string>> = {
  light_punch: "stand_light_punch",
  medium_punch: "stand_medium_punch",
  heavy_punch: "stand_heavy_punch",
  light_kick: "stand_light_kick",
  medium_kick: "stand_medium_kick",
  heavy_kick: "stand_heavy_kick",
  drive_impact: "drive_impact",   // 正典・改名不要
  drive_parry: "drive_parry",     // 正典・改名不要
  throw: "forward_throw",
};
```

- **旧形 = 7 件**(stand_* 6 + forward_throw 1)。`drive_impact` / `drive_parry` は正典のまま。
- `addMoveStep` は `moves.find(m => m.code === code)` の **完全一致**。見つからないと `console.warn` で握りつぶし(B-7 症状の発生点)。

### C-2. 旧形 code を参照する箇所(全数 grep・系統網羅)

パターン `stand_(light|medium|heavy)` / `crouch_(light|medium|heavy)` / `jump_(light|medium|heavy)` / `forward_throw` / `back_throw` を `.go/.ts/.tsx/.sql/.json/.csv/.md` で全数取得。**実装(非テスト)への影響箇所**は以下に限定:

| レイヤ | ファイル | 種別 |
|--------|---------|------|
| マイグレ seed | `000004`(ryu moves+rush)・`000010`(aki/jamie/guile moves) | move 定義 |
| マイグレ seed | `000006`(ryu aliases)・`000011`(aki/jamie/guile aliases) | `CASE m.code WHEN 'stand_*'…` で日本語名を引く |
| マイグレ seed | `000012`(耐久 combos) | combo_steps が `move_code='stand_*'` 等で move を join(M12-05 除去対象) |
| フロント実装 | `web/src/features/combo/components/VirtualController/useControllerInput.ts` | C-1 のマッピング(唯一の非テスト実装参照) |

- **非テスト Go(production)= 0 件**(全 12 Go ヒットは `_test.go`)。
- **i18n(`web/src/**/*.json`)= 0 件**。
- **recipe 表示の実コード = 0 件**(下記 C-3)。`controllerTypes.ts:20` の `forward_throw` は **コメント**(コード参照ではない)。
- 取込 CSV(`combomgr-importer/dist/*.csv`)= 旧形 0 件(全て新形)。
- 残りのヒットは `docs/`(設計書・指示書・進捗・change-notes)と `_test.go` / `.test.tsx`。

**正典との差**: 実装の逸脱点は **seed 4 ファイル + コントローラ 1 ファイル**(followup-backlog §B-7 の根本原因記述と一致)。

### C-3. move code 変更が保存済みコンボを壊さないか(再確認)

- スキーマ(000001): `combo_steps.move_id INTEGER REFERENCES moves(id)`(ID 参照)。`setup_steps` も同様。**code 文字列は保持していない**。
- recipe 解決: `internal/service/notation/resolver.go:79,95,111` は `presetRepo.FindAlias(ctx, presetID, moveID)` で **move_id で alias を引く**。`recipe_cache` は move_id 経由で構築され、code 文字列に依存しない。
- preset_aliases(000006/000011)は **挿入時に `CASE m.code` を使う**が、格納される行は `move_id` キー(`UNIQUE(preset_id, move_id)`)。
- → **既存 combos / setups / preset_aliases(格納済み)は move.code 改名の影響を受けない**(followup-backlog §B-7(d) と一致)。影響は「seed 挿入 SQL が code 文字列でマッチしている箇所」のみ。

### C-4. 新形統一時の (a)/(b) 変更点(全数・ロックステップ対象)

- **(a) コントローラ**: `useControllerInput.ts` の `BUTTON_TO_MOVE_CODE` 7 値(stand_* 6 + forward_throw)を新形へ。
- **(b) seed**(旧形を持つキャラのみ):
  - `000004`: ryu 通常技 18 + 投げ 2 + rush base 6(`rush_stand_*`/`rush_crouch_*`)。
  - `000006`: ryu の `CASE m.code WHEN 'stand_*'…`(旧形キー 18+)。
  - `000010`: aki/jamie/guile 通常技 18×3 + 投げ 2×3。
  - `000011`: aki/jamie/guile の `CASE m.code`(旧形キー)。
  - `000012`: combo_steps の `move_code='stand_*'/'crouch_*'/'jump_*'`(M12-05 で除去予定のため、除去なら対象外)。
- **recipe 表示 / エイリアスが旧 code に依存する箇所**: 実コードは **ゼロ**(C-3。resolver は move_id 参照)。seed alias は挿入時の `CASE` キーのみ(上記 (b) に含む)。
- **(e) 全キャラ仮想コントローラ回帰**: コントローラ新形化後、対象キャラの normal/throw が解決されるかは moves 側が新形であることが前提(A-3 の混在に依存)。

**M12-05 含意**: (a) を新形化した瞬間、**moves が新形になっていないキャラ(=旧形 seed のまま残る aki/jamie/guile)で normal/throw が無反応化**。ロックステップで「seed 新形化 or seed 除去 or 再取込」を同一サブで揃える必要(§D-4 / 要決定)。

---

## D. FR701 再取込の実現性

### D-1. 再取込 CSV 作成済みキャラ(開発者提供・転記)

- `combomgr-importer/dist/` に CSV 存在: **`ryu.csv` / `ken.csv` / `ingrid.csv` / `c_viper.csv` / `dhalsim.csv`**(各 `*.review.md` 併存)。= 先行リリース5体。
- 参考: `combomgr-importer/testdata/golden/` には 30+ キャラの golden CSV があるが、dist(配布想定)は上記5体のみ。**aki/jamie/guile は dist に無い**(golden には存在)。

### D-2. 再取込で初期キャラ(ryu)の moves.code が新形になるか

- dist CSV の `move_code` 列は **完全に新形**: `standing_light_punch`…/`crouching_*`/`throw_forward`/`throw_back`/`drive_parry`(実査・旧形 0 件)。CSV ヘッダの code 列 = `move_code`(2 列目)、`character_code`(1 列目)。
- 取込経路: `internal/service/movesimport/service.go:96` が `charRepo.UpsertByCode` でキャラ id 解決 → moves を `internal/repository/move/upsert.go` で **`ON CONFLICT(character_id, code) DO UPDATE`**。
- → **ryu を再取込すると `standing_*` 等の新形行が作られる**。旧形 `stand_*`(000004)は **upsert キーが異なるため別行として残存**(置換されず orphan)。
- **捨て仕事化の範囲**: 再取込で新形 ryu が入るなら、000004(ryu moves・旧形)+000006(ryu aliases・旧形キー)を手動で新形化する作業は **二重投入になり捨て仕事**になりうる。ただし旧形行を消すには別途 DELETE が要る(upsert は消さない)。

### D-3. 順序依存と冪等性

- moves upsert キー = `(character_id, code)`(`internal/repository/move/upsert.go:21`)。characters upsert = `(game_id, code) DO NOTHING`(`character/upsert.go:25`)。→ **同一 code の再取込は冪等(UPDATE)**。ただし **旧形→新形は別 code = 別行**になり冪等で消えない。
- マイグレ down: `000004`/`000010` は対象キャラの moves 全削除、`000012` down は対象キャラ combos 全削除(steps は CASCADE)。`000009`(aki/jamie/guile characters INSERT)・`000015`(classic3 custom_states UPDATE)は custom_states 系。
- 順序前提(マイグレ適用は連番昇順): characters(000003/000009/000014)→ moves seed(000004/000010)→ aliases(000006/000011)→ 耐久 combos(000012)→ custom_states(000015)。再取込(実行時)は全マイグレ後。
- 推測(コード経路から): 再取込→旧形 seed 削除→custom_states 整備、の順なら、削除前に新形が入っていれば参照整合は保てる。**実 DB での再取込結果は本調査では実行していない**(read-only)。「推測: upsert ロジック上は新形行追加 + 旧形行残存」。

### D-4. 「再取込なし」案と「再取込で置換」案の比較材料(決定しない)

| 観点 | 案① 再取込なし(コントローラ(a)+seed(b) ロックステップ) | 案② 再取込で seed 置換 |
|------|----------------------------------|------------------|
| 触る対象 | コントローラ 1 + seed 4(000004/000006/000010/000011)を旧→新へ書換 | コントローラ 1 + 取込実行 + 旧形 seed 行の DELETE/無効化 |
| ryu | 000004/000006 を手で新形化 | 取込で新形 ryu。000004/000006 は捨て仕事(別途 orphan 削除要) |
| aki/jamie/guile | 000010/000011 を手で新形化(先行リリース対象外) | **dist に CSV 無し** → 取込不可。手移行 or seed 除去が別途要 |
| ken/ingrid/c_viper/dhalsim | seed 無し(影響なし) | 取込で新形(既に新形) |
| 捨て仕事 | 将来 FR701 再取込時に手移行(b)が捨て仕事化(backlog §B-7 指摘) | ryu 手移行を回避できる。aki/jamie/guile は別問題が残る |
| 回帰範囲 | 全キャラ仮想コントローラ回帰(B-7(e)) | 同左 + 取込整合確認 |

- **キー事実**: 再取込5体に aki/jamie/guile は含まれない。aki/jamie/guile(旧形 seed の本体・先行リリース対象外)は **どちらの案でも別途「手移行 or 除去」判断が必要**(§要決定 4)。

---

## E. マイグレ方式の選択材料(Plan Mode 用)

### E-1. 次連番・命名

- 最終連番 = **000016**(`change_drive_damage_to_real`)。**次 = 000017**。
- 命名規則: `NNNNNN_description.{up,down}.sql`(DES-003 §7、embed.FS で同梱)。

### E-2. 「無効化マイグレ(新規 000017)」vs「000012 自体を編集」

| 観点 | 案A 新規 000017 で 000012 を DELETE | 案B 000012 を直接編集 |
|------|-----------------|-----------------|
| 既適用環境 | golang-migrate は適用済みマイグレを **再実行しない** → 既存 DB には 000017 の DELETE が新規適用され除去される | 既存 DB では 000012 は **再適用されず**、編集は反映されない(新規 DB のみ反映) |
| 新規 DB | 000012 で投入 → 000017 で即削除(実質未投入) | 編集後の 000012 で投入(クリーン) |
| 履歴 | 追記のみ(可逆 down 可) | 既存マイグレ改変(配布済み環境と DB 状態が乖離するリスク) |
| テスト | `migrate_test.go` の 36 件アサーション要修正(B-3) | 同左 |
| 開発者確認3(既配布 DB の有無)依存 | 既配布あり → 案A が安全 | 新規 DB のみ前提なら案B も可 |

- 開発者への確認事項3(先行リリース前 = 新規 DB のみ前提か)が方式選択に直結。**本調査では決定しない**。

### E-3. 000016 の非破壊テーブル再構築技法(参照テンプレート)

- 技法: マイグレ接続は `foreign_keys=OFF`(`migrate.go` が pragma 無しで接続。アプリ接続のみ `db.go` で FK=ON)→ 子テーブルの CASCADE が連鎖しない。親を直接 RENAME せず **一時名 `new_combos` 経由**で `legacy_alter_table` の自動 FK 書換を回避(子は `combos` 参照を維持)。
- 本件(seed の DELETE / move code UPDATE)への適用評価:
  - **seed DELETE**(000012 除去): テーブル再構築は不要。`DELETE FROM combos WHERE …` で足りる(子 combo_steps は FK=OFF でも明示 DELETE か、アプリ接続でないため CASCADE 非連鎖に留意。down 同様)。
  - **move code UPDATE**(B-7 seed 新形化): `UPDATE moves SET code=… WHERE code=…` 系。`UNIQUE(character_id, code)` に注意(旧→新で衝突しないことの確認)。テーブル再構築は不要。
  - → **000016 のフル再構築技法は本件には過剰**(型変更でないため)。同注意点として「FK=OFF 環境での CASCADE 非連鎖」「UNIQUE 衝突」は共通。

---

## F. D-7 連動(複数 custom_states キャラの動作確認)

### F-1. characters.custom_states の実 JSON(全列挙)

マイグレ適用後の最終状態(000003→000009→000014→000015 の累積):

| キャラ | 最終 custom_states(実値) | 由来マイグレ |
|--------|--------------------------|------------|
| ryu | `{"states":[{"code":"denjin_charge","name_ja":"電刃錬気","name_en":"Denjin Charge","subject":"self","type":"flag","value_definition":{"kind":"boolean"}}]}` | 000003=`{}` → 000015 で置換 |
| ingrid | `{"states":[{"code":"sun_crest","name_ja":"サンシンボル","name_en":"Sun Crest","subject":"self","type":"level","value_definition":{"kind":"integer","min":0,"max":4}}]}` | 000014=NULL → 000015 |
| c_viper | `{"states":[{"code":"limit_decoupler","name_ja":"バウンサーステップ(SA1強化中)","name_en":"Limit Decoupler (install SA1)","subject":"self","type":"flag","value_definition":{"kind":"boolean"}}]}` | 000014=NULL → 000015 |
| aki | `{"states":[{"code":"poison","name_ja":"毒","name_en":"Poison","subject":"opponent","scope":"persistent","type":"flag","value_definition":{"kind":"boolean"}}]}` | 000009 |
| jamie | `{"states":[{"code":"drunk_level","name_ja":"酔いレベル","name_en":"Drunk Level","subject":"self","scope":"persistent","type":"composite","value_definition":{"kind":"object","fields":[{"code":"level","kind":"integer","min":0,"max":4},{"code":"unlocked_moves","kind":"string_list"}]}}]}` | 000009 |
| guile | `NULL` | 000009(NULL ベースライン) |
| ken | `NULL` | 000014(custom_states 列に値を入れていない) |
| dhalsim | `NULL` | 000014 |

- 補足: 000003 は ryu に `'{}'`(空オブジェクト)を投入、000015 で `denjin_charge` へ**置換**。000009 は aki/jamie/guile を INSERT(custom_states 含む)。000014 は ken/ingrid/c_viper/dhalsim を表示名のみ INSERT(custom_states 未指定 = NULL)。000015 が ingrid/c_viper(と ryu)を UPDATE。

### F-2. jamie の drunk_level と正典の乖離

- jamie 実値: `type:"composite"`、`value_definition.kind:"object"`、fields = `level(integer,0–4)` + `unlocked_moves(string_list)`。state コード = `drunk_level`、name = `酔いレベル / Drunk Level`。
- 正典(m11-to-m12-handover §3-a が参照する m11-custom-states-definitions): **Drink Level / Int 0–4**(単純 level/integer 想定)。
- **乖離(事実)**: jamie は (1) state コード/表示名が `drunk_level`/「酔いレベル」(正典は Drink Level)、(2) 型が `composite`(object + unlocked_moves)で **classic3 の `level`/`integer` 単純型と構造が異なる**。handover §3-a の「乖離」記述と一致。

### F-3. 複数 custom_states を持つキャラの実在

- 全キャラの `states` 配列は **最大 1 要素**(ryu/ingrid/c_viper/aki/jamie 各 1、guile/ken/dhalsim は NULL)。
- → **「特殊状態を複数持つキャラ」は現状ゼロ**(D-7 の対象は実在しない)。
- 先行リリース3体(ryu/ingrid/c_viper)の構成: ryu=`denjin_charge`(flag/boolean)、ingrid=`sun_crest`(level/integer 0–4)、c_viper=`limit_decoupler`(flag/boolean)。いずれも単一 state。

### F-4. 先行リリース5体 vs 5体外の custom_states 取り扱い材料(整理・決定しない)

| キャラ | 先行リリース | 現 custom_states | 状態 |
|--------|:---:|------|------|
| ryu | ○ | denjin_charge(flag) | 000015 で正典化済み |
| ken | ○ | NULL | 未設定(取込で moves のみ。custom_states 未投入) |
| ingrid | ○ | sun_crest(level 0–4) | 000015 で正典化済み |
| c_viper | ○ | limit_decoupler(flag) | 000015 で正典化済み |
| dhalsim | ○ | NULL | 未設定 |
| aki | × | poison(flag, opponent) | phase-1 seed のまま |
| jamie | × | drunk_level(composite) | 正典と乖離(F-2) |
| guile | × | NULL | phase-1 seed(NULL) |

- 取り扱い選択肢(各キャラで併記、決定は開発者): **(a) 再投入で正典化** / **(b) 行・状態の除去** / **(c) 据え置き**。
- ブランカ等「5体外の新規追加」は §開発者への確認事項2 で要確認(本調査スコープ外)。

---

## §推奨(複数案の併記・決定はしない)

> playbook §13.4 形式。各論点で観測事実に基づく選択肢を併記。M12-05 の Plan Mode で開発者が決定する。

- **R-1(マイグレ方式)**: 案A=新規 000017 で無効化 / 案B=000012 直接編集。**開発者確認3(既配布 DB の有無)**で分岐。新規 DB のみ前提なら両案可、既配布ありなら案A 寄り。いずれも `migrate_test.go` の 36 件アサーション修正が必須(B-3)。
- **R-2(B-7 段取り)**: 案①=コントローラ+seed ロックステップ手移行 / 案②=ryu 再取込で置換。再取込で ryu は捨て仕事回避できるが、**aki/jamie/guile は dist CSV が無く別途判断**(D-4)。
- **R-3(aki/jamie/guile)**: (a)新形へ手移行 / (b)moves+aliases+耐久 combos ごと除去 / (c)据え置き。**コントローラ新形化と非整合だと当該3体で B-7 症状が残る**(C-4)— (c) 単独は症状残存と両立しない事実。
- **R-4(テスト fixture)**: 000012 除去で migrate_test 2 件、B-7 改名で Go 12 + フロント 7 の fixture 修正がロックステップで必要。

---

## §M12-05 スコープ確定のための要決定事項

1. **マイグレ方式**: 新規 000017 無効化(案A)か 000012 直接編集(案B)か。前提として **既配布 DB の有無**(開発者確認3)を確定する。どちらでも `migrate_test.go` L452/L453 の 36 件アサーション修正が必須。
2. **B-7 ロックステップ範囲**: コントローラ(a)新形化と同時に新形化/除去する seed の確定 — 000004/000006(ryu)・000010/000011(aki/jamie/guile)。`000012` は除去前提(combo_steps の旧形 join も道連れ)。
3. **FR701 再取込の段取り**: ryu を再取込で新形置換するか(000004/000006 を捨て仕事として別途 orphan 削除)、手移行するか。再取込対象は **ryu/ken/ingrid/c_viper/dhalsim の5体**(dist 実在・新形)で確定。
4. **aki/jamie/guile(先行リリース対象外・旧形 seed 本体)の扱い**: dist CSV が無いため再取込不可。(a)手移行 /(b)moves+aliases+耐久 combos ごと除去 /(c)据え置き(=コントローラ新形化と非整合で症状残存)。custom_states も含めて判断(jamie は正典乖離・F-2)。
5. **dbtest fixture 移行の要否**: 000012 除去で migrate_test の 2 アサーション、B-7 改名で Go 12 + フロント 7 のテスト fixture をロックステップ修正する範囲を M12-05 スコープに含める(= 単純 seed 除去では済まない)。
6. **custom_states 正典化対象キャラ**: 先行リリース5体のうち ken/dhalsim は NULL(未設定)。5体外(aki/jamie/guile)の正典化/除去/据え置き、ブランカ等5体外の新規追加可否(開発者確認2)。

---

## §完了条件の自己チェック(指示書 §6)

- [x] §4 A〜F の全項目を実 SQL / 実コード / 実テストの view・grep で確認して報告。
- [x] 件数・move code・custom_states JSON を実値で報告(36 件・96 steps・旧形 20 code/キャラ・各 custom_states JSON 逐語)。
- [x] read-only 逸脱なし(実装・マイグレ作成・seed 変更・DES 変更ゼロ。書き込みは本報告のみ)。
- [x] §要決定事項 6 項を M12-05 Plan Mode 入力粒度で集約。
- [x] 未実行/未確認は明示(実 DB での再取込は未実行=D-3「推測」明示。dash 系の正典表不一致は想定外発見として事実記録)。

---

*以上、M12-RESEARCH-02 調査報告。本報告が M12-05 修正指示書のスコープ確定入力となる。*
