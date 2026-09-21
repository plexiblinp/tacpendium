# M14-03c 完了報告(ryu 正規再 seed=moves 差し替え+combos クリア)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03c-ryu-reseed.md` v1.0.2 |
| レビューチェックリスト | `docs/instructions/reviews/M14-03c-review-checklist.md` v1.0.1 |
| 実施日 | 2026-07-16 |
| 手入力データ | `character_data/ryu.csv`(84 技・20 列・コミット済) |
| 承認記録 | Plan 承認 2026-07-16。開発者回答 4 件(同日): §4.3.1 seedgen I/O 境界拡張(指示書 v1.0.2 として正式化)・setups クリア追加・down 忠実復元・drive_parry 削除→CSV 再投入 |

---

## 1. Plan Mode 確定方式(指示書 §3.3 の 6 項目・実査結果)

1. **FK 依存順**: マイグレ接続は FK=OFF(`migrate.go` が PRAGMA 無し接続)=CASCADE 不発火。よって全て明示 DELETE を FK 逆順で実施: combo_tags → combo_oki_options → combo_setups → combo_steps → combos →(setups 系)→ preset_aliases → moves。FK=OFF と明示 DELETE の同居なし(digest §5)。
2. **旧 moves の特定**: 実査で ryu 現 moves=**58**(000004 の 56〔000017 rename 適用後〕+000025 の forward/back)。moves を参照する列は combos.starter_move_id / combo_steps.move_id / preset_aliases.move_id / **setup_steps.move_id** / moves.original_move_id(自己参照)の 5 つ(000001/000021 DDL 全確認)。削除 WHERE は**「移動 9 種以外の全行」(NOT IN)方式**を採用(下記 §2)。
3. **移動 move 非重複**: 移動 9 種は NOT IN で温存(削除・再投入なし)。ryu.csv に移動 9 種は非混入(実査)=seedgen の drop は防御的 no-op。**同一 id のままであることをテストで立証**(`TestRun_M1403c_MovementMovesPreserved`)。
4. **新 seed の適用**: seedgen 再利用(§4.3.1 拡張・下記 §3)。ryu.csv=84 技(normal18/special27/rush_variant17/super_art9/unique5/target_combo3/throw2/drive_impact1/critical_art1/system1=drive_parry)。dup スキャン・正準形検証・total 検算すべて通過(検出 0 件)。
5. **dbtest 波及**: `migrate_m1403b_test.go`・000017 テストはバージョン固定(Migrate(28)/(23))で非影響、HEAD 系テストは下限アサート・code 動的解決で生存。テスト参照 code(standing_light_punch/hadoken_light/throw_forward 等)と alias 文字列(立ち弱P 等)は新 CSV でも同名同値。**結果: 既存 Go テストの修正 0 件で全通過**。
6. **down 整合**: 000029.down は旧 49 moves+official_ja_move alias 49 件を忠実復元(開発者承認・下記 §5)。combos は復元不能(了解済み)を up/down 双方に明記。

### 実査で検出した指示書とのズレ(2 件・いずれも開発者確認のうえ確定)

- **setups/setup_steps が削除列挙に欠落**: setups は character_id 持ち・setup_steps.move_id が moves 参照のため、旧 moves 削除後に宙吊り参照が発生し得る(setup API は実装済み=実ユーザーが作成可能)。→ **ryu の setups もクリアに含める**(開発者承認 2026-07-16。スコープの明示的拡張)。
- **drive_parry**: 指示書 §4.2/§9.3 の「drive_parry を巻き込まない」は、ryu の drive_parry が 000004 由来(M14-03b 投入分ではない)かつ ryu.csv にも drive_parry があるため、残すと 000030 の INSERT が UNIQUE(character_id, code) 衝突する。→ **削除→CSV 再投入**(開発者確認 2026-07-16。第一波キャラの 000026 と同一扱い。code・alias 文字列「ドライブパリィ」不変・フレームデータは NULL→実値に改善)。

## 2. 成果物

| ファイル | 内容 |
|---|---|
| `migrations/000029_clear_ryu_legacy_seed.{up,down}.sql`(手書き) | up: ryu の combos+従属行・setups+setup_steps・旧 moves(移動 9 種以外)+alias(全 preset 横断)を FK 逆順で明示 DELETE。down: 旧 49 moves+alias 49 件を忠実復元 |
| `migrations/000030_seed_moves_ryu.{up,down}.sql`(seedgen 生成・手編集禁止) | ryu 84 技+official_ja_move alias 84 件+rush 17 種の original_move_id 解決。down は投入 code IN 限定削除 |
| `cmd/seedgen` / `internal/seedgen` | §4.3.1 の I/O 境界拡張(下記 §3) |
| `internal/infra/migration/migrate_m1403c_test.go` | 契約テスト 5 本(下記 §6) |
| `web/e2e/`(3 spec のコメントのみ) | ryu seed 前提の stale コメントを再 seed 後へ追従 |

### 削除方式: NOT IN(移動 9 種)掃討を採用(明示 49 code IN リストは不採用)

先行リリース済みビルドには `POST /moves/:id/rush-variant`(ユーザーによるラッシュ版生成)があり、ユーザー DB に `rush_<旧code>` 行が存在し得る。旧 49 code の列挙削除だとこれらが生き残り、**000030 の INSERT が UNIQUE(character_id, code) 衝突 → マイグレ失敗(dirty)・起動不能**(しかも 000029 コミット済みで ryu 削除だけ完了した最悪形)に至る。NOT IN 掃討で衝突を構造的に排除した(`TestRun_M1403c_SweepsUserRows` が回帰防止)。旧 49 code の列挙は 000029.up のコメントに監査用として記載。

## 3. seedgen 拡張(§4.3.1 の 3 条件の充足)

- **(1) I/O 境界のみ**: `internal/seedgen` に `GenerateWithHeader`(ヘッダ関数パラメータ)+`CustomHeader`(stem/note からヘッダ組立)を追加、既存 `Generate` は既定ヘッダを渡す薄い委譲へ。`cmd/seedgen` に `-chars`(対象キャラ・カンマ区切り)/`-out`(出力 stem)/`-note`(ヘッダ説明行)フラグを追加(対指定必須・既定=第一波)。**変換規則(validate/remap/alias 対/recovery 単一値/is_derived・target_combo passthrough/移動 9 種 drop/dup スキャン)は 1 行も変更なし**(diff の削除行は旧 writeHeader のみ)。`internal/moveindex` は無改変。
- **(2) byte-identical 回帰ゲート**: 既存 golden `TestGolden_CommittedMigrationMatchesRegeneration` **PASS**+`go run ./cmd/seedgen -check`「OK: 生成物は既存ファイルと一致」=**000026 は byte 単位で不変**。
- **(3) ryu 非ハードコード**: 対象キャラはパラメータ(既定=`FirstWaveOrder`)。第二波 20 キャラでも `-chars <code>,... -out <stem>` で再利用可能。`FirstWaveOrder` 自体は無改変。
- 新規 golden `TestGolden_RyuMigrationMatchesRegeneration` を追加(ryu.csv → 000030 一致・手編集ドリフト検出)。再生成コマンドはテストコメントに記載。

## 4. ryu 限定の破壊性・他キャラ非波及

- 全 DELETE の WHERE は `characters.code='ryu' AND game_id∈(sf6)` のサブクエリで厳密限定。
- **他キャラ非波及の件数検証**: `TestRun_M1403c_OtherCharsUnaffected` が v28 で非 ryu 11 キャラの moves/alias 件数をスナップショットし、HEAD 後に全キャラ不変を確認(terry70/guile88+9/lily81/ingrid91/kimberly95/juri73/ken80/mai96/zangief78+移動・classic 組を含む。固定値の二重管理を避けるスナップショット方式)。
- dev DB コピーでの実測: ken moves=89 が適用前後で不変・FK violations 0。

## 5. down の限界(復元不能 4 項目)

000029.down は「旧 49 moves(code=000017 rename 後・数値列 NULL)+official_ja_move alias 49 件」を再 INSERT し、**v28 の clean 状態へ集合一致で復元**する(`TestRun_M1403c_DownFidelityAndReUp` が (code, category, 元技 code, alias_text) の集合一致を機械検証)。以下は down で復元されない(up/down 両ファイルの冒頭に明記):

1. ryu の実コンボ(combos+従属行)=開発者了解済み(消してよい)
2. ryu のセットプレイ(setups/setup_steps)=開発者承認済み
3. ユーザー生成のラッシュ版 moves(NOT IN 掃討分)
4. ユーザー定義 preset に付けた ryu 旧 moves の alias/旧 moves へのユーザー編集値

完全なロールバックが必要な場合は適用前バックアップから DB を復元する(down ファイルに記載)。

## 6. テスト結果

- **Go**: `go test ./...` **全通過**(既存テスト修正 0 件)。新規 `migrate_m1403c_test.go` 5 本:
  1. `UpContract`: ryu moves=93(84+移動 9)・alias=93・combos/setups=0・新 code 存在(tatsumaki_senpu_kyaku_light 等 7 種)・旧 code 不在(tatsumaki_light 等 6 種)・rush 17 全解決・foreign_key_check クリーン
  2. `OtherCharsUnaffected`: 非 ryu 11 キャラの moves/alias 件数 v28→HEAD 不変
  3. `MovementMovesPreserved`: 移動 9 種が同一 id・alias 不変(削除→再投入していない立証)
  4. `SweepsUserRows`: ユーザー rush(rush_hadoken_light)・custom preset alias・ryu 実コンボ一式(steps/tags/oki/setup リンク)・セットプレイを v28 で投入 → **up 成功**・ryu 分全掃・preset/tag 本体は残存・FK クリーン
  5. `DownFidelityAndReUp`: v28 集合一致(58 行)+re-up で 93/93/0
- **seedgen golden**: 000026(既存)・000030(新規)とも PASS。`-check` OK。
- **E2E**: `make e2e` **18 passed・1 flaky(m12-03、retry で成功)**・exit 0。既知 baseline 失敗 4 件(m12-03A/B・m12-06×2・m15-01)は今回の使い捨て DB スタックでは非発生。画面18 の ryu 技編集(moves-edit)・クイック入力の code 解決(m15-03)が新 seed 下で通過。
- **dev DB コピー実測**(`tmp/devcopy-m1403c.db`・退避済み実データのコピーへ適用): version=30 clean(dirty=0)・ryu 93/93・combos/setups 0・新旧 code 存否 OK・ken 非波及・FK 違反 0。

## 7. dev DB 退避と適用状況

- **退避実施**: `~/.local/share/combomgr/combomgr.db{,-wal,-shm}` → 同名 `.pre-m14-03c-bak`(2026-07-16。既存の `.polluted-bak`/`.pre-saprefix-bak` と同規約)。
- **【開発者アクション要】dev バックエンドは稼働中のまま**(go run 27887/29828・vite 稼働中を確認)のため、**実 dev DB へのマイグレ適用は次回バックエンド再起動時**。再起動しないと画面18 は旧 seed のまま表示される(dev_backend_restart_pitfall の再発防止として明記)。検証用コピー `tmp/devcopy-m1403c.db` は適用済み・削除可(DB ファイル削除は開発者操作)。

## 8. DoD 照合(指示書 §7)

| DoD | 結果 |
|-----|------|
| seedgen 拡張が §4.3.1 の 3 条件を満たす(000026 byte-identical・ryu 非ハードコード) | ✅ §3 |
| ryu 旧 moves 削除・combos 従属行クリア(ryu 限定) | ✅ §2・§4(+setups は承認済み拡張) |
| ryu 新 moves(CSV 由来)+alias 投入・move_code は CSV 体系 | ✅ 84+84・再採番なし |
| 移動 system move を削除・再投入していない | ✅ 同一 id 立証(§6-3) |
| 他キャラ非波及(件数担保)・dbtest 全通過・down 整合 | ✅ §4・§5・§6 |
| `make e2e` 非回帰 | ✅ §6 |

## 9. 申し送り

- **Q4 解消**: M14-03b 完了報告 §1 の「§3.3-7 ryu recovery 将来 total 契約(Q4)」は、本サブの全面差し替えで recovery/total が CSV 値・生成時算出で投入されたため**解消**(将来マイグレ不要)。
- **【設計担当】マイグレ連番の消費**: 本サブは §2.1/§9.2 の裁量(分割数)により **000029・000030 の 2 本を消費=次の空き連番は 000031**。M14-03c チェックリスト §4 の「M17-01 は 000030」等、後続資料の連番注記の追従が必要(M17-01 指示書自体は Plan Mode の連番確認で自己回復する建付け)。
- **【設計担当】指示書 §4.2/§9.3 の drive_parry 文言改版**: 「drive_parry を巻き込まない」を確定した実装(000004 由来のため削除→CSV 再投入=第一波 000026 と同一扱い。開発者確認 2026-07-16)へ改版すること(§1 に経緯記録済み)。
- **【設計担当・第二波検討】seedgen validate に original_move_code の実在検証がない**(レビュー指摘): CSV の original_move_code が typo だと original_move_id が NULL のまま静かに投入される。本サブは `TestRun_M1403c_UpContract` の「rush 17 全解決」で捕捉したが、第二波では変換規則の改訂(golden 更新を伴う=設計判断)として検証追加を検討。
- **データ内容の開発者確認 2 件(レビュー質問・2026-07-16 回答済み)**: (1) 「電刃**錬**気」が公式表記として正(旧 000006 の「練」が誤表記=今回の再 seed で是正された形。修正不要)。(2) aerial 系の is_aerial=false は意図どおり(第一波と同一運用・必要時は画面18 で手動 true 化。修正不要)。
- **配布 blocker の残状態**: 未投入キャラは残り 20(SF6 全 30 − ryu − 第一波 9)。第二波は本サブで汎用化した seedgen パラメータ(`-chars`/`-out`/`-note`)をそのまま利用可能。
- **DES 反映(設計担当への伝達メモ)**: 配布 DB の ryu が手入力 CSV 由来へ正規化(全キャラ code 体系一貫)。指示書 §10 のとおり **doc 反映のみの見込み**(スキーマ変更なし・seedgen はランタイム非経路のため CHANGE 不要=指示書 §4.3.1 の判断)。DES-003 §3.3 の記載に ryu 旧 code 例が残っていれば更新候補。
- `character_data/seed-progress.md` の seed_imported 欄は M14-03b 以前から実態と乖離(全キャラ「未」のまま)。本サブでは触れていない(スコープ外)。整備は別途。

---

*以上、M14-03c 完了報告。実装コミット: docs(指示書 v1.0.2)→ seedgen 拡張 → migrations 000029/000030 → マイグレテスト → E2E コメント追従。レビューは `docs/progress/m14-03c-review.md` を参照。*
