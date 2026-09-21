# M14-03c レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03c-ryu-reseed.md` v1.0.2 |
| チェックリスト | `docs/instructions/reviews/M14-03c-review-checklist.md` v1.0.1 |
| レビュー実施日 | 2026-07-16 |
| レビュー対象コミット | 42edc61(docs)→ 436806f(seedgen)→ a5a7b60(migrations)→ b615b8c(test)→ cac2d6c(e2e)→ e8fe319(報告) |
| レビュー手法 | 全成果物 Read + 突合元(000004/000006/000017/000025/000026/000001 DDL/ryu.csv)照合 + `go test ./...`(count=1)・`go run ./cmd/seedgen -check` の独立再実行 |

## 総評

重大指摘ゼロ。本サブの核心である「ryu 限定の破壊性」「移動 system move の温存」「seedgen 変換規則の無改変」は、いずれも実装・テスト・独立再実行の三重で確認できた。特筆すべきは、旧 49 code の列挙削除でなく「移動 9 種以外の全行」NOT IN 掃討方式を採り、先行リリース済みユーザー DB のユーザー生成 rush_variant による 000030 UNIQUE 衝突(dirty・起動不能)を構造的に排除した判断で、`TestRun_M1403c_SweepsUserRows` が回帰防止として固定している。setup_steps.move_id の宙吊り参照を Plan Mode 実査で発見しスコープを承認付きで拡張した点も、教訓 M17-D1(既存ユーザー DB への影響の書き出し)の実践として適正。指摘は設計側ドキュメントの追従とデータ内容の確認質問が中心で、コード修正を要する重大事項はない。

## 設計準拠性レビュー結果

チェックリスト v1.0.1 §1〜§8 の評価。凡例: ◎=問題なし ○=軽微指摘あり △=要対応 ×=重大。

### §1 ryu 限定の破壊性(最重要) — ◎

- 000029.up の全 DELETE は `characters.code='ryu' AND game_id∈(SELECT ... code='sf6')` のサブクエリで厳密限定。combo_setups/combo_steps は combos 経由サブクエリで特定(指示書 §4.1 どおり)。
- FK 逆順(combo_tags→combo_oki_options→combo_setups→combo_steps→combos→〔setups 系〕→preset_aliases→moves)を実 DDL(000001)と突合し整合を確認。moves を参照する 5 列(combos.starter_move_id / combo_steps.move_id / preset_aliases.move_id / setup_steps.move_id / moves.original_move_id)の洗い出しは DDL grep で裏取りし完全(combo_oki_options は moves 非参照)。
- FK=OFF(migrate.go は PRAGMA 無し接続)前提で CASCADE に頼らず全て明示 DELETE(digest §5 準拠)。FK=OFF と CASCADE 連鎖の同居なし。`PRAGMA foreign_key_check` ゼロを 4 テストで検証。
- 旧 moves の特定は「移動 9 種以外の全行」NOT IN 方式。指示書 §4.2 の「旧 code の厳密特定」の字義からは逸脱するが、開発者確認済み(2026-07-16)かつ旧 49 code を up 冒頭コメントに監査用列挙しており、ユーザー生成 rush_variant の掃討という採用理由も妥当(下記「良かった点」参照)。
- 旧 moves の preset_aliases は全 preset 横断で削除、移動 9 種の alias は温存(NOT IN 除外)。
- 他キャラ非波及は `TestRun_M1403c_OtherCharsUnaffected` が非 ryu 11 キャラの moves/alias 件数を v28→HEAD スナップショット比較(固定値の二重管理を避ける良い方式)。

### §2 移動 system move の非削除 — ◎

- 移動 9 種(000004 由来 7 + 000025 由来 2)は moves/alias とも NOT IN で温存。`TestRun_M1403c_MovementMovesPreserved` が **同一 id のまま**(削除→再投入でない)と alias 文字列不変を立証。
- drive_parry は指示書 §4.2/§9.3 の「巻き込まない」の文言と異なり削除→CSV 再投入だが、ryu の drive_parry は 000004 由来(M14-03b 投入分ではない)であり、残すと 000030 の INSERT が UNIQUE(character_id, code) 衝突するため削除が正しい。000026(第一波)の drive_parry 行(`'drive_parry', 'system', 0, 1, 12, 45, ...`)と同一の値・alias「ドライブパリィ」で再投入されており、**M14-03b との整合はむしろ実装側が正**。開発者確認済み・完了報告 §1 に記録あり(指示書本文の未改版は「推奨修正・中」参照)。
- ryu.csv に移動 9 種は非混入(実査で確認)。混入時も seedgen の drop(`isMovementSystem`)が防御する。

### §3 新 moves seed(手入力 CSV 由来) — ◎

- seedgen(M14-03b 成果物)を再利用。新規実装・コピー実装・手作業生成なし。000030 は seedgen 生成物で、`TestGolden_RyuMigrationMatchesRegeneration` が手編集ドリフトを検出する。
- **§4.3.1 の 3 条件充足を確認**:
  1. **I/O 境界のみ**: 436806f の diff は `GenerateWithHeader`/`CustomHeader`(ヘッダ関数注入)+ `cmd/seedgen` の `-chars`/`-out`/`-note` フラグのみ。削除行は旧 `writeHeader` のみで、validate・remap・alias 対・移動 9 種 drop・dup スキャンの各関数は 1 行も変更なし(diff で確認)。`internal/moveindex` は無改変(変更ファイル一覧に非含有)。
  2. **byte-identical**: `TestGolden_CommittedMigrationMatchesRegeneration` PASS + `go run ./cmd/seedgen -check`「OK: 生成物は既存ファイルと一致」を**レビュー側で独立再実行し確認**。
  3. **ryu 非ハードコード**: 対象キャラは `-chars` パラメータ(既定=`FirstWaveOrder`・無改変)。`-chars`/`-out` の対指定強制は 000026 誤上書きを防ぐ良い防御。第二波 20 キャラでそのまま再利用可能。
- move_code は CSV 値のまま(再採番なし)・正準形 `^[a-z0-9_]+$` 検証あり。recovery は単一整数(非整数 fail)・NULL 行は total NULL。is_derived/target_combo は passthrough(moves 列に非投入=DES-003 §3.3 で is_derived 列は未定義・M17-02 G-k で確定、の現行契約と整合)。is_projectile/command/condition_* は非投入・CSV 原本保全(M14-03b §4.1 と同一)。
- alias は 84 moves に対し 84 件を対で投入(生 code フォールバックなし)。FK 依存順 moves→preset_aliases。dup スキャン 0 件(84 行の total 検算もサンプル手計算で整合確認: 例 standing_light_punch 4+3−1+7=13)。
- UNIQUE 衝突なし: 000029 の掃討が先行するため構造的に不成立。テストで up 成功を確認。

### §4 マイグレの健全性 — ○

- 新規連番 000029/000030 で追加。既存 000001〜000028 は非改変(git diff --name-only で確認)。
- down 整合: 000029.down は旧 49 moves(000017 rename 後 code・category は 000004 準拠・数値列 NULL)+ official_ja_move alias 49 件を復元。code 一覧・category・alias 文字列を 000004/000017/000006 と全数突合し**転記ミスなし**(例: high_blade_kick→ハイブレードキック、sa2_shin_shoryuken→SA2 心・昇龍拳、rush 6 種の JOIN 方式も 000004 と同一)。`TestRun_M1403c_DownFidelityAndReUp` が (code, category, 元技 code, alias) の集合一致 58 行 + re-up 93/93/0 を機械検証しており、手書き down の品質担保として優良。
- 復元不能 5 項目(実コンボ・setups・ユーザー rush・ユーザー alias・ユーザー編集値)を up/down 両冒頭に明記(開発者了解済み)。
- `go test ./...` 全通過を**レビュー側で count=1 再実行し確認**(既存テスト修正 0 件の主張どおり)。
- dev DB 退避の実施をファイルシステムで確認(`~/.local/share/combomgr/combomgr.db.pre-m14-03c-bak` 2026-07-16 存在。検証コピー `tmp/devcopy-m1403c.db` も存在)。
- 減点(軽微): 本サブが指示書 §2.1 の裁量(分割数)により **000029 と 000030 の 2 連番を消費**した。チェックリスト §4 の「M17-01 は 000030」は陳腐化しており、完了報告にも連番消費の明示的な申し送りがない。M17-01 指示書は Plan Mode で「埋まっていれば次番号」と自己調整する建付けのため実害は低いが、設計側資料(チェックリスト・handover §3.2)の追従が必要(推奨修正・中)。

### §5 スコープ遵守 — ◎

- スキーマ変更ゼロ(データ差し替え + seedgen I/O 拡張のみ)。CHANGE 不要の判断は指示書 §4.3.1 の帰結どおり(seedgen はランタイム非経路)。
- 変更ファイルは migrations 2 対・seedgen 3 ファイル・テスト 1・e2e コメント 3・docs のみ(git diff --name-only で全数確認)。本体アプリコード(service/api/repository/web/src)は無変更=FR704 復活なし。
- ryu の custom_states(denjin_charge・000027 是正済み)に非接触(000029/000030 は characters を UPDATE しない)。
- setups/setup_steps クリアは指示書スコープ外だが、開発者承認(2026-07-16)を得た明示的拡張として完了報告 §1 に記録あり。宙吊り参照防止のため技術的にも必須であり妥当。

### §6 テストの妥当性 — ○

- 契約テスト 5 本(UpContract / OtherCharsUnaffected / MovementMovesPreserved / SweepsUserRows / DownFidelityAndReUp)は、件数・新旧 code 存否・rush 17 全解決・非波及・掃討・down 忠実性・FK check を網羅し、指示書 §5.1 の全項目に対応。特に SweepsUserRows は「既存ユーザー DB で走ったら何が消えるか」をテストコードとしてモデル化した好例。
- 減点(軽微): E2E 側に「ryu の combos 一覧が空」「新 code での表示」の**明示アサートはない**(moves-edit/m15-03 は API 起点の動的取得で code 非依存に通過)。clean DB の combos=0・新 code 存否は Go マイグレテストが担保しており実質カバーされているが、チェックリスト §6 の字義(E2E で確認)からは間接的。`make e2e` 18 passed/1 flaky(retry 成功)は報告値を採用(本レビューでは E2E 未再実行=制約事項参照)。

### §7 既存挙動の温存 — ◎

- 他キャラの moves/alias/custom_states 不変(スナップショットテスト + 本体コード無変更)。
- 技編集・export/import・recipe_hash・DuplicateKey の実装コードに変更なし。ryu 旧 code をハードコードした本番コードが存在しないことを grep で確認(該当は inputResolution.test.ts の合成 fixture のみ=データ駆動のため新 code 移行の影響なし)。
- 既存 seed(presets・custom_states)非接触。全 Go テスト通過(再実行確認)。

### §8 ドキュメント・完了報告 — ○

- Plan Mode 6 項目の確定方式(§1)・seedgen 拡張の経緯と golden 結果(§3)・他キャラ非波及の件数(§4)・down の限界(§5)・dev DB 退避(§7)・配布 blocker 残状態(残り 20 キャラ・§9)をすべて記載。
- Q4(ryu recovery の将来 total 契約)の解消を §9 に明記。
- DES 反映の設計担当への伝達メモあり(製造は DES を直接編集していない)。dev バックエンド再起動の開発者アクションを既知の罠(dev_backend_restart_pitfall)として明記した点も良い。
- 減点(軽微): 上記 §4 のとおりマイグレ連番 2 本消費(次は 000031)の申し送りが欠落。

## 設計準拠性以外の指摘事項

1. **[質問] 「電刃錬気」の表記(データ内容)**: 新 CSV / 000030 の alias は「電刃**錬**気」、旧 000006 alias は「電刃**練**気」、000015 の custom_states は「電刃**錬**気」。プロジェクト内で歴史的に両表記が混在しており、今回の投入で alias 側が custom_states 側(錬)に揃った形になる。公式表記がどちらかの確認を推奨(手入力 CSV の入力値であり本サブの変換処理の問題ではない。precheck 工程を経ている場合は意図的の可能性あり)。不明: 公式表記の正はコード上から判断できない。
2. **[質問] aerial_tatsumaki_senpu_kyaku(_od) の is_aerial=false**: DES-003 §3.3 は「空中技は true」としつつ「接頭辞の付かない空中技は利用者が FR703 で手動 true 化」とも記す。第一波 CSV(ken の aerial_tatsumaki・mai の air 系)も false で統一されており M14-03b 踏襲としては一貫。is_aerial はラッシュ可否導出(normal/unique のみ)に不参加のため実害はないが、入力運用としての意図確認を推奨。
3. **[提案・将来] seedgen validate に original_move_code の実在検証がない**: CSV の original_move_code が typo だと `UPDATE ... CASE` が不一致となり original_move_id が NULL のまま**静かに**投入される。今回は `TestRun_M1403c_UpContract` の「rush 17 全解決」が捕捉するが、第二波ではキャラごとにこのアサートを書く運用になる。変換規則側での検証追加は §2.2 により本サブでは不可のため、第二波指示書の検討事項として設計担当へ申し送りを推奨。
4. **[軽微] cmd/seedgen のエラー wrap 漏れ**: `run()` の `os.WriteFile` エラーが `return err` 素通し(CLAUDE.md §4「エラーは必ず wrap する」)。また `-note` 単独指定(`-chars` なし)は黙って無視される(対指定チェックは `-chars`/`-out` のみ)。dev 専用 CLI のため実害は小さい。
5. **[軽微] `-check` の既定対象は 000026 のみ**: 000030 の drift 検出は golden テスト(`TestGolden_RyuMigrationMatchesRegeneration`)が担う設計で、`-check` 単体では 000030 を検証しない(`-chars ryu -out 000030_seed_moves_ryu -note ...` を併用すれば可能)。golden テストが CI 相当の `go test` で常時走るため実用上は十分。

## 推奨修正(優先度別)

- **高(M14 完了前に修正必須)**:
  - なし(重大指摘ゼロ)。
- **中(M15 着手と並行可)**:
  - 設計担当への申し送りに **マイグレ連番の消費(000029・000030=次は 000031)** を追加し、チェックリスト v1.0.1 §4 の「M17-01 は 000030」・handover の連番注記を追従させる(M17-01 指示書自体は Plan Mode の連番確認手順で自己回復するが、資料間の相互注記が正であるべき)。
  - 指示書 §4.2/§9.3 の「drive_parry を巻き込まない」の文言を、確定した実装(000004 由来のため削除→CSV 再投入=第一波と同一扱い)へ改版する(開発者確認済みの事実の指示書本文への反映。設計担当対応)。
  - 上記「設計準拠性以外」1・2 のデータ内容 2 点(電刃錬気/練気・aerial 系 is_aerial)を開発者に確認し、修正が要る場合は CSV 訂正→seedgen 再生成(000031 以降の follow-up マイグレ)として扱う。
- **低(将来対応)**:
  - seedgen validate への original_move_code 実在検証の追加(第二波指示書で変換規則の改訂として扱う=golden 更新を伴うため設計判断が必要)。
  - cmd/seedgen のエラー wrap・`-note` 単独指定の警告。
  - E2E への「ryu combos 空」「新 code 表示」の明示アサート追加(Go テストで実質担保済みのため任意)。

## 良かった点

- **NOT IN 掃討方式の採用判断**: 「clean DB では列挙で足りるが、先行リリース済みユーザー DB のユーザー生成 rush_variant が 000030 の UNIQUE 衝突→dirty・起動不能を招く」という失敗モードを実装前に特定し、方式選択で構造的に排除した。教訓 M17-D1(破壊的マイグレは既存 user DB で何が消えるかを書き出す)の模範的実践であり、`TestRun_M1403c_SweepsUserRows` として回帰防止まで固定した点が優れている。
- **setup_steps.move_id の宙吊り参照の発見**: 指示書の削除列挙に欠落していた setups 系を Plan Mode 実査(参照列の全数洗い出し)で発見し、推測で進めず開発者承認を取ってスコープを明示的に拡張した。手順・記録とも適正。
- **down の忠実復元の機械検証**: 手書き down(49 技+alias 49 件)を「v28 グラウンドトゥルースとの集合一致」で検証する方式は、転記ミスという手書き SQL 最大のリスクを直接潰しており、レビュー側の全数突合でも差分ゼロだった。
- **seedgen 拡張の最小性**: ヘッダ関数注入 + CLI フラグのみという最小の diff で要求を満たし、golden 2 本 + `-check` により「変換規則に触れていない」ことを機械的に立証可能にした。`-chars`/`-out` の対指定強制(000026 誤上書き防止)も細かいが良い防御。
- **スナップショット方式の非波及テスト**: 他キャラ件数を固定値でなく v28 実測から比較することで、テストと seed の二重管理を回避した。
- **完了報告の質**: DoD 照合表・復元不能項目の列挙・dev バックエンド再起動の申し送り(既知の罠の再発防止)まで含み、レビューに必要な情報が過不足なく揃っていた。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `go test ./...`(count=1)と `go run ./cmd/seedgen -check` はレビュー側で独立再実行し通過を確認したが、`make e2e` と dev DB コピーへの適用実測は完了報告の記載値を採用した(E2E スタックの再実行は未実施)。
- 手入力 CSV(`character_data/ryu.csv`)の**データ内容の正しさ**(フレーム値・公式表記との一致)は本レビューの対象外(precheck 工程の管轄)。本レビューで気づいた表記・フラグの 2 点のみ質問として挙げた。

---

## 取り込み結果(自動トリアージ)

実施: 製造担当 Claude Code(2026-07-16・`/implement_plan_full` Phase C)。**高=なし**のためエスカレーション事由なし。

| # | 指摘 | 優先度 | 採否 | 理由・対応 |
|---|------|--------|------|-----------|
| 1 | マイグレ連番消費(000029/000030=次は 000031)の申し送り欠落 | 中 | **採用** | 完了報告 §9 に【設計担当】申し送りとして追記(チェックリスト §4「M17-01 は 000030」の追従依頼を含む)。チェックリスト本体の改版は設計担当領域のため製造は直接編集しない |
| 2 | 指示書 §4.2/§9.3 の drive_parry 文言未改版 | 中 | **採用(申し送り)** | 指示書本体は製造が直接編集しない運用(CLAUDE.md §8)のため、完了報告 §9 に設計担当への改版依頼として明記(経緯は §1 に記録済み) |
| 3 | データ内容の確認 2 点(電刃錬気/練気・aerial 系 is_aerial=false) | 中 | **採用(確認実施)** | 開発者に確認し回答取得(2026-07-16): 「錬」が公式表記として正(旧 000006 の「練」が誤=今回の再 seed で是正)・is_aerial=false は第一波と同一の意図的運用。**いずれも修正不要**で確定。完了報告 §9 に記録 |
| 4 | seedgen validate に original_move_code 実在検証がない | 低 | **採用(申し送り)** | 変換規則の改訂(golden 更新を伴う)は指示書 §2.2 により本サブでは不可。完了報告 §9 に第二波向けの設計判断事項として申し送り |
| 5 | cmd/seedgen のエラー wrap 漏れ・`-note` 単独指定の黙殺 | 低 | **採用(修正)** | `os.WriteFile` 3 箇所を `fmt.Errorf("...: %w")` で wrap(CLAUDE.md §4 準拠)。`-note` 単独指定はエラー化。cmd/seedgen は I/O 境界(CLI)であり §4.3.1 の範囲内。修正後も golden+`-check` 通過を確認 |
| 6 | `-check` の既定対象が 000026 のみ(000030 は golden テスト担保) | 低 | **不採用** | レビュー自身の判定どおり golden テストが `go test` で常時走るため実用上十分。`-check` の複数 stem 対応は CLI 拡張の便乗改修になるため見送り(スコープ厳守) |
| 7 | E2E への「ryu combos 空」「新 code 表示」の明示アサート追加 | 低 | **不採用** | Go マイグレテスト(UpContract)が combos=0・新旧 code 存否を直接担保済み。E2E spec 追加は本サブのスコープ(コメント追従のみ)を超える便乗改修のため見送り(レビューも「任意」と判定) |

対応コミット: cmd/seedgen 修正+完了報告 §9 追記+本節追記(レビュー報告書生成後の 1 コミット)。
