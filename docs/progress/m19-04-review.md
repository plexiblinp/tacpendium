# M19-04 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M19-04-frame-cost-columns.md` v1.1.0（CHANGE-091 v1.1.0） |
| チェックリスト | `docs/instructions/reviews/M19-04-review-checklist.md` v1.1.0 |
| レビュー対象 | worktree `wt/m19-04` の未コミット差分（新規 8 ファイル ＋ 変更 25 ファイル。`docs/handover/code-facts.md` は本サブ無関係と確認済み） |
| レビュー日 | 2026-08-01 |
| 実行した検証 | `go vet ./...`（exit 0）／`go test ./...`（全 ok）／`go test -count=1` で migration・seedgen・punishfinder・repository/move・setplay を強制再実行（全 ok）／`go run ./cmd/seedgen -check`（OK）／`gofmt -l`（0 件）／CSV 17 本を RFC4180 パーサで全行機械照合／**実測資料 v2.3.0 と 000052 の全 37 UPDATE を 1 件ずつ突合** |

## 総評

**チェックリスト §9「重大な問題」に該当する項目はゼロである。** とくに最重点の 4 点——サイレント no-op の排除・確定反撃サーチへの非干渉・`fastest_unreachable` の部分一致・seedgen 生成側の無改変——はいずれも実装とテストの両方で担保されており、レビュー側の独立検証と一致した。

**最も事故りやすいと目された `chain_cancel_total` 37 行の写像は、レビュー側で実測資料 v2.3.0 の確定値表と 1 件ずつ突合し、全 37 行が完全一致した。** 一次源は `character_data/chain-cancel-measurements.md` であり、CSV には 1 文字も転記されていない（全 CSV の新 3 列が空文字であることを機械検証）。ロースターの非対称（リリー 4 技・ザンギエフ 6 行）も正しく扱われている。「total − 4」型の規則充填は 1 件もない。

製造の独自判断 4 件（連打版の `standalone`／`damage` NULL 据置き／`move_derivations` 未投入／件数前提テストの追従）は、いずれも根拠が設計正本または実コードに紐づいており、設計伝達レポートで漏れなく開示されている。とくに (a) は指示書 §4.6 の括弧書き（`through` が妥当）と設計正本 DESIGN-07 §9-1（`basis=standalone`）の食い違いに対し、指示書自身の委譲文言に従って正本を採る判断であり、**妥当**と判定する。

残る指摘は「実装は正しいが回帰ガードが 1 本足りない」「スコープ外の小さな追加が 1 件ある」「M19-05 の前提が 1 つ欠けている（開示済み）」の 3 系統で、いずれも設計・契約違反ではない。

---

## 設計準拠性レビュー結果

### §1 サイレント no-op の排除 — ◎

- 投入件数は `migrate_m1904_test.go` の `const` ブロックに集約され、テスト名に数字は埋め込まれていない（M14-03d §3.3-1 準拠）。
- **「0 件でも成功する」テストになっていない**ことを確認した。
  - `startup_basis` は `standalone` / `through` / `unknown` の 3 値で**総数を分割**する形（676+171+18+160 = 1025）で固定されており、内訳のどれかが 0 になれば必ず落ちる。さらに値域外 0 件のアサートも入っている。
  - ザンギエフ 3 行は `count(*) = 3`（`INSERT … FROM characters c WHERE c.code='zangief'` 型なので親行欠落時の 0 件投入を検出できる）＋ `moves` 総数 1028 ＋ alias 3 件 ＋ 4 フレーム値の実値照合 ＋ 検算式の自己検証まで固定。
  - `chain_cancel_total` は総数 37 ＋ **キャラ別内訳 11 行**（ryu 3 / zangief 6 / lily 4 …）＋ 代表値 8 件 ＋ **未 seed キャラ 0 件**＋**弱攻撃 4 種以外 0 件**の否定形まで固定。写像ミスの検出設計として十分。
- c_viper / dhalsim 18 行が `unknown` のまま残ることを、行数と `<> 'unknown'` の 0 件の両方で固定している。
- down 整合は 4 本すべてで検証。`SchemaUpDown` は再 up まで往復している。
- 契約 F-2 は `TestRun_M1904_StartupTotalUnchanged` が v48 → HEAD の全行スナップショット比較（NULL の同一性まで比較）で担保しており、「件数と値のスナップショット比較で示す」という DoD の要求を満たす。

### §2 確定反撃サーチへの非干渉（契約 F-1） — ◎（増分の固定のみ △）

- **`internal/service/punishfinder/` と `internal/service/setplay/` の diff は 0**（`git status` / `git diff --stat` で確認。両ディレクトリは変更ファイル一覧に一切現れない）。
- 判定値は `service_test.go` の `const`（`wantLegacyJumpHeavy=23` / `wantOptionC=25` / `wantUniqueAerial=7`）にあり、テスト名に数字はない。3 値とも不変で green。
- **ザンギエフ 3 行の増分内訳「成立レーン ±0・手動確認レーン +3」を、レビュー側で実コードから独立に追跡し、報告の妥当性を確認した。**
  1. `internal/repository/punish/queries.go:10` の `listMovesForScanSQL` は `WHERE m.character_id = ?` のみで **`is_derived` によるフィルタが無い**。よって連打版 3 行は走査に確実に載る（「そもそも走査されない」という楽観的説明ではない）。
  2. 自技経路: `internal/service/punishfinder/service.go:330` の `buildStarters` が `sm.Damage == nil` を**ループ先頭でスキップ**する。3 レーン（地上／ダッシュ／ジャンプ）いずれの判定にも到達しない。**成立レーン増分 0 は正しい。**
  3. 相手技経路: `isNonPunishableTarget`（`service.go:398`）は `IsAerial` と「移動 system move」のみを弾くため連打版は通過 → `service.go:217` の `damage=0` 完全除外にも該当せず（NULL のため）→ `service.go:225` の `om.Damage == nil` 分岐で `ManualReviewNodes` に載る。**手動確認レーン +3（`unknown_damage`）は正しい。**
  4. canary テストは `dbtest.Setup` の実 DB で全キャラの全 `moves` を `buildStarters` に通す実装であり、連打版 3 行も実際に通したうえで 23/25/7 が不変であることを示している。**成立レーンの非干渉は prose ではなく機械的に担保されている。**
- △ **ただし「手動確認レーン +3」を固定するテストは無い。** 報告書 §6 の文章のみである（→ 推奨修正 中）。

### §3 機械 backfill の条件 — ◎

- `fastest_unreachable` は **`code LIKE '%jumping\_%' ESCAPE '\'`＝部分一致**。前方一致ではない。さらに `ESCAPE` でアンダースコアをリテラル化しており、指示書の要求を上回る厳密さ。
- **前方一致だったら落ちるテストが入っている**点を高く評価する（`m1904PrefixMissed = 2` と `code='neutral_jumping_heavy_kick' AND fastest_unreachable=1` の 2 本）。「部分一致で書いた」ではなく「前方一致では取り落とす 2 行が実際に付与されている」を逆向きに固定しており、M18-03c の再発を構造的に防いでいる。
- `standalone` の条件は `is_derived = 0` かつ c_viper / dhalsim 除外。除外は `characters.code IN (...)` に加えて `games.code='sf6'` でスコープしており、000041 の前例より厳密。
- `through` の条件は `category = 'rush_variant'`。
- down は up と同一 WHERE で対象限定（全行一括 UPDATE にしていない）。000041 の思想を正しく踏襲。
- 既存値の上書きなし（§1 の F-2 スナップショットテストで担保）。

### §3.5 `chain_cancel_total` の投入 — ◎（本レビューの最重点・全件突合済み）

**37 行すべてを実測資料 `character_data/chain-cancel-measurements.md` v2.3.0 §確定値表と 1 件ずつ照合し、全一致を確認した。**

| キャラ | 資料の値 | 000052 の UPDATE | 判定 |
|---|---|---|---|
| リュウ | 9 / 10 / 12 | `standing_light_punch`=9・`crouching_light_punch`=10・`crouching_light_kick`=12 | 一致 |
| ジュリ | 10 / 10 / 13 | 同順で 10・10・13 | 一致 |
| ザンギエフ（通常） | 15 / 13 / 12 | `standing_light_punch`=15・`crouching_light_punch`=13・`crouching_light_kick`=12 | 一致 |
| ザンギエフ（連打版） | 12 / 10 / 11 | `standing_light_punch_rapid`=12・`crouching_light_punch_rapid`=10・`crouching_light_kick_rapid`=11 | 一致 |
| テリー | 9 / 10 / 13 | 同順 | 一致 |
| ガイル | 10 / 9 / 12 | `standing_light_punch`=10・`crouching_light_punch`=9・`crouching_light_kick`=12 | 一致（Stand LP と Crouch LP の値が入れ替わっていないことを確認） |
| リリー（4 技） | 11 / 10 / 12 / 12 | `standing_light_punch`=11・`standing_light_kick`=10・`crouching_light_punch`=12・`crouching_light_kick`=12 | 一致 |
| イングリッド | 9 / 10 / 12 | 同順 | 一致 |
| キンバリー | 10 / 9 / 9 | `standing_light_punch`=10・`crouching_light_punch`=9・`crouching_light_kick`=9 | 一致 |
| ケン | 9 / 10 / 13 | 同順 | 一致 |
| 舞 | 9 / 10 / 11 | 同順 | 一致 |
| マノン | 12 / 10 / 13 | `standing_light_punch`=12・`crouching_light_punch`=10・`crouching_light_kick`=13 | 一致 |

合計 3+3+6+3+3+4+3+3+3+3+3 = **37 行**。

- **一次源は実測資料であり CSV ではない。** CSV の `chain_cancel_total` 列は全 1479 データ行が空文字であることを RFC4180 パーサで機械検証した（転記ゼロ＝値が 2 か所に存在しない）。
- 未 seed キャラ（エレナ / JP / ジェイミー / ルーク / ベガ / ラシード / **マリーザ**）の行は 1 件も入っていない。マリーザは指示書 §4.4.5 の除外リストに無いが、資料の版が v2.1.0 → v2.3.0 に上がったことによる差であり、投入範囲を「seed 済み 11 キャラ」で限定したため自動的に成立している。マイグレ冒頭コメントに経緯が明記されており、追跡可能。
- **「total − 4」等の規則で埋めた行は 1 件も無い。** マイグレ冒頭に禁止理由（同一単発値が最大 3 通りに割れる）が明記され、テストの代表値も規則から外れる値（`kimberly/crouching_light_kick` = total−5、`manon/crouching_light_punch` = total−6、`juri/crouching_light_kick` = total−2）を意図的に選んでいる。**規則充填を検出する形になっている点は設計として優れている。**
- 資料に無い行は NULL のまま（`standing_light_kick` 10 行は人手一覧へ回っている）。

### §4 CSV 読取り層と golden — ○（1 件のスコープ超過）

- **`writeMovesInsert` / `writeAliasInsert` / `rawDataSQL` / `CustomHeader` は無改変。** `go run ./cmd/seedgen -check` が `OK: 生成物は既存ファイルと一致` を返し、golden も green。既知の provenance 誤記（`CustomHeader`）にも手を付けていない。
- CSV は **17 ファイル全部**にヘッダと全行へ 3 列を空欄追加。レビュー側で全ファイルを RFC4180 で読み直し、**既存 20 フィールドが全行で完全一致・追加 3 フィールドが全行で空文字・行数不変**であることを確認した。`marisa.csv` の埋め込みカンマ行（クォート付き）も壊れていない。
- ヘッダは 17 ファイルで完全同一（`sort -u` で 1 種）。`move_code` の整形・短縮・リネームは無い。
- **`zangief.csv` に行を足していない**（行数 79 で不変。連打版 3 行はマイグレ 000051 のみ）。
- `csvColumns` を 23 に、`cr.FieldsPerRecord = len(csvColumns)` により列数不一致は Read 段階で hard fail する。`parseBool("")` → false・`parseNullableInt("")` → nil で、空欄は正しく既定値扱い。
- △ **`internal/seedgen/generate.go` の `validate()` に `validStartupBases` 検査を追加している。** 指示書 §4.2 が列挙した三点更新（`csvColumns` / `parseRow` / `MoveRow`）＋ `testHeader` ＋ テスト行リテラル、およびチェックリスト §4 第 2 項「変更が I/O 境界のみに限られているか」からは外れる。「生成側に触るな」という §4.2 の★条件には抵触しない（`validate` は生成関数ではない）ため**重大ではない**が、スコープ超過であることは事実であり、副作用もある（→ 推奨修正 中）。

### §5 新表とスキーマ — ◎（1 件の運用申し送り不足）

- `move_derivations` は **`ON DELETE CASCADE` を付けていない**。`ON UPDATE CASCADE` のみを付け、明示削除・明示再ポイントの責務を DDL コメントで宣言している。`architecture-patterns` §11・followup `fk-enforcement-per-connection`・DES-003 §3.19 の方針と一致。
- 親が `moves`（1 段）であることを前提に `combo_punishes` の列インライン FK 流儀を採っており、`combo_setup_results`（複合キー・1 段深い）の流儀を誤流用していない。判断理由がコメントに残っている。
- `moves` の識別キー変更経路は Plan Mode で実査済み（アプリ実行時 0 件・`UpdateFields` allowlist 9 列に `code`/`id` を含まない・マイグレ層には 000029→000030 の物理削除→再 INSERT の前例あり）。結論が「無い」ではなく「アプリには無いがマイグレにはある」と正確に切り分けられている。
- 型・制約は指示書 §4.1 のとおり。**`chain_cancel_total` に NOT NULL も DEFAULT も付いていない**ことを `pragma_table_info` の `notnull` と `dflt_value` の両方で固定している（0 と未実測を混同しないという設計意図をテストで守っている）。
- `parent_move_id` の索引は理由付きで追加（親側から引く明示削除・再ポイントのため）。
- DES-006 に VAL を足していない。DES 本体の編集も無い。
- △ **明示削除の責務が DDL コメントにしか無く、followup-backlog にもスラッグ登録されていない。** 現時点はデータ 0 件のため無害だが、M19-05 で行が入った後に seed 再生成波（DELETE → INSERT で `moves.id` が再発番）が走ると、FK=OFF のマイグレ接続では**残った `move_derivations` 行が別の技を指す**（削除エラーにならない）。これは本サブが最も警戒している「静かに壊れる」型そのものである（→ 推奨修正 中）。

### §6 rush 生成経路 — ○（実装は正・回帰ガードが無い）

- `insertRushVariantSQL` に `startup_basis` 列と `'through'` リテラルを追加済み。`is_derived` と同じくバインドせずリテラルで書いており、`model.Move` にフィールドを足さずに済ませている（契約 F-3 の観点で適切な実装選択）。理由コメントも十分。
- `chain_cancel_total`（NULL）と `fastest_unreachable`（0）は DEFAULT のまま。
- × **チェックリスト §6 第 3 項「rush 生成後の行の新列値を固定するテスト」が無い。** `internal/repository/move/` にも `internal/service/move/` にも `startup_basis` を検査するテストは存在しない（`service_test.go` は fake repo のため実 SQL を通らない）。指示書 §4.5 が「型エラーにも実行時エラーにもならない静かに壊れる型」と明示して要求した箇所であるにもかかわらず、**リテラルを消しても現在どのテストも落ちない**（→ 推奨修正 高）。

### §7 非露出（契約 F-3） — ◎

- `startup_basis` / `chain_cancel_total` / `fastest_unreachable` / `move_derivations` の 4 語を全リポジトリ（`*.go` / `*.ts` / `*.tsx` / `*.sql`）で grep したところ、ヒットは **migrations／`internal/seedgen`（CSV 保全のみ）／`internal/repository/move/rush.go`（SQL リテラル）／`internal/infra/migration` のテスト**のみ。`internal/api/` ・`internal/model/` ・`internal/service/` ・`web/src/` へのヒットは 0。画面18 の DTO・`UpdateFields` allowlist にも入っていない。
- `TestGenerate_FrameCostColumnsNotEmitted` が「生成 SQL に新列名も値も出ない」ことを機械的に固定しており、将来の露出も検出できる。
- 既存 golden・期待 SQL は無傷（`-check` OK）。

### §8 人手判断の一覧 — ◎

- 3 系統すべて出ている（`startup_basis` 160 行 / `fastest_unreachable` B 型 7 行 / `chain_cancel_total` 10 行）。件数だけの報告になっていない。
- 各行に `character_code` / `move_code` / `name_ja` / `category` / `is_derived` / `is_aerial` / `command` / `startup` / `total` / `original_move_code` / `condition_ja` の 11 列がそろっている。**技名と入力コマンドが並んでおり、開発者が判断できる形**になっている。
- `character_code` 昇順 → `move_code` 昇順の安定ソートで、差分が取れる。記入欄の列も用意されている。
- `original_move_code` / `condition_ja` が `moves` に存在しない列であることを明記し、CSV から結合して補っている（結果として大半が空欄だが、これは元データが空である事実の反映であり誤りではない）。
- `chain_cancel_total` の絞り込み条件（地上弱通常技 4 種）は資料のロースターに整合し、44 − 34 = 10 の算術も合う。開発者確認済みと報告されている（原文はレビュー側で検証不能＝下記「不明」）。

### §9 ドキュメント・否定形確認 — ◎

- §4.9 の否定形確認 5 件すべてを、3 系統（本番コード／テスト資産／設計文書・指示書）で実施し結果を表で報告している。**本番コードだけを見て「直っている」と報告していない**（設計正本 `M19-DESIGN-07:67` に `G = 1 − N` が残存していることを検出し、製造は編集せず設計伝達レポート §4-2 へ回している。レビュー側でも当該行の残存を確認した）。
- `setplay.go:94,101` の `1 − Gmax` / `1 − Gmin` を「旧定義の残骸ではない」と根拠付きで弁別している。**機械 grep のヒットを鵜呑みにせず意味で判定している**点を評価する。
- 消費連番（000049〜000052）と、後続レーンが 000053 から取るべきことが明記されている。
- 製造は DES を直接編集していない（`docs/design/` に差分 0）。
- 設計伝達レポートは ①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題 の 4 節に整理され、指示書どおりの部分は割愛されている。
- 禁則表現・簡体字・「起き攻け」誤字・「DR」略記を新規 md とマイグレに grep したが 0 件。

---

## 製造の独自判断の妥当性

| # | 判断 | 判定 | 根拠 |
|---|---|---|---|
| (a) | 連打版の `startup_basis = 'standalone'` | **妥当** | 指示書 §4.6 の括弧書きは「`through` が妥当だが **DESIGN-07 §1-3 の実測記述に従うこと**」であり、参照先の §1-3 は su/act/rec/total の表で `startup_basis` に言及していない。`basis=standalone`＋親参照を明記しているのは §9-1 であり、レビュー側でも原文を確認した。指示書自身が設計正本へ委譲している以上、正本を採るのが正しい。意味論的にも整合する（連打版の startup 4/3/3 は連打版という技自身の単独値）。設計伝達レポート §2-1 で「指示書の括弧書きは誤誘導なので訂正してほしい」と明示的にエスカレーションしている点も適切 |
| (b) | 連打版の `damage`/`on_hit`/`on_block` を NULL 据置き | **妥当** | 実測資料・DESIGN-07 のどちらにも値が無く、通常版からのコピーは推測充填になる。指示書全体を貫く「推測で埋めない」原則の新規行への適用として一貫している。副作用（手動確認レーン +3）を自ら計測し、代替案（`damage=0` にすれば完全除外できるが値の捏造になる）を比較したうえで採らなかった旨まで開示している。将来の除外が必要なら別述語を M19-05 で設計すべき、という提案も筋が通っている |
| (c) | `move_derivations` へデータ未投入 | **妥当（ただし M19-05 の前提が欠ける）** | 指示書 §2.1 の成果物一覧に投入が無く、§4.1 も「新表を作る」までである。加えて DESIGN-07 §9-1 自身が「通常版↔連打版のリンクは今回の承認ゲートに含めず個別承認とする」と後送りしており、親の基数（各連打版 × 通常版 3 = 9 行か 1:1 の 3 行か）が設計側で未確定。**推測で入れないという判断は正しい。** 現時点は F-3 により誰も参照しないため機能影響ゼロ。ただし `standalone ∧ 親参照あり → 単独入力不可` の導出が効かないため、**M19-05 が親参照より先に着地すると連打版 3 行が単独 filler/target として選ばれうる**。暫定の歯止めは `is_derived=1`（DESIGN-07 §9-4 の暫定ゲート）のみ。設計伝達レポート §4-1 で最重要として起票済み |
| (d) | 既存の件数前提テスト 2 本を `expectedMovesDelta` で追従 | **妥当** | 期待値の数字を書き換える（＝テストを緩める）のではなく、キャラ別の意図的増分を理由コメント付きの表に外出しし、**表に載っていないキャラは従来どおり 1 行も増減してはならない**強さを保っている。`migrate_m1403d_test.go` 側も同じ表を参照するので二重管理にならない。`parseSnapshot` は書式が変わったら `t.Fatalf` するので、フォーマット変更に対しても安全。M14-03d 教訓 4（grep でなく全体実行で確定）の運用どおり 2 本を検出できている |

---

## 設計準拠性以外の指摘事項

1. **`migrate_m1904_test.go` の `deref` が値を 1 桁でしか表示しない。** `string(rune('0' + *p%10))` のため、`startup=13` は `"3"`、`total=25` は `"5"` と表示される。比較自体は `eq` が値で行うので誤検知はしないが、**F-2 違反が起きたときの差分メッセージが誤読を招く**（13 と 3 が同じ表示になる）。`strconv.Itoa` で足りる。コメントに「差分表示用の簡易表現」と断ってはいるが、障害時に最も読まれる出力である。
2. **000052 が「値でグルーピング」した UPDATE 文になっている。** 同一値の複数 code を `code IN (...)` でまとめているため、資料の確定値表（技ごとに 1 行）との 1:1 目視照合がしづらい。前例の 000041 は code 単位である。値の正しさは確認済みなので実害はないが、次回の追記（M14-03e の未 seed 18 行）で照合コストが上がる。
3. **000049 のヘッダコメントに「backfill 専用」という語が残っている。** 撤回されたのは「新列の**値の置き場所**は DB backfill 専用（＝CSV には持たない）」であり、当該コメントは「**投入方式**が backfill 型」という別の（正しい）主張なので誤りではない。報告書 §8 の弁別も妥当。ただし §4.9-3 の走査キーワードと字面が衝突するため、次回の否定形確認で再び手を止めさせる。「SQL 非投入（値は backfill マイグレで投入）」等への言い換えを推奨。
4. **完了報告のファイル名が `docs/process/m18-m19-contract.md` §5 の規約（`<id>-completion-report.md`）と一致しない**（`M19-04-report.md`）。`docs/progress/` には両方の慣行が混在しているため実害は無いが、契約に明文がある以上は揃えるか契約側を直すのが筋。
5. **手入力ツール（別 go module・`.gitignore` 配下）への周知。** CSV が 20 列 → 23 列になったため、ツールが 20 列で書き戻すと `cr.FieldsPerRecord` により `seedgen` / `-check` が**失敗する**。silent ではなく loud に落ちる安全側の設計なので緊急性は無いが、Phase 2 で開発者が CSV へ記入する前に確認しておくべき事項。指示書 §4.4.5 は「CSV では列だけ用意して値は素通しする運用」と書いており、その「素通し」がツール側で成立するかは本レビューでは確認できない。
6. コーディング規約（CLAUDE.md §4）への準拠は良好。`gofmt -l` 0 件、`go vet` exit 0、`console.log` / `fmt.Println` の混入なし、マジックナンバーは `const` 化済み、新規依存の追加なし。SQL リテラルの文字列連結（`rapidWhere`）はテスト内の定数結合のみで、外部入力を含まないためインジェクション懸念はない。

---

## 推奨修正（優先度別）

### 高（M19 完了前に修正必須）

1. **`insertRushVariantSQL` が生成する rush 行の新列値を固定するテストを 1 本追加する。**（チェックリスト §6 第 3 項が未充足）
   実 DB（`dbtest.Setup`）で rush 版を 1 件生成し、`startup_basis='through'` ／ `chain_cancel_total IS NULL` ／ `fastest_unreachable=0` を assert する。現状は SQL からリテラルを消しても**どのテストも落ちない**ため、指示書 §4.5 が警戒した「機械 backfill 後に生成される rush 行だけが unknown で取り残される」失敗モードが無防備のままである。実装は正しいので、ガードを足すだけで済む。

### 中（M20 着手と並行可）

2. **`move_derivations` の明示削除責務を followup-backlog へスラッグ登録し、seed 波の手順に載せる。** 現状は 000049 の DDL コメントにしか無い。データ 0 件の今は無害だが、M19-05 で行が入った後に seed 再生成波（`000029 clear → 000030 seed` 型の DELETE → INSERT）が走ると、FK=OFF のマイグレ接続では残存行が**再発番された別の技を指す**（削除エラーにならない）。本サブが最も警戒している「静かに壊れる」型そのものである。
3. **`move_derivations` へのデータ投入を M19-05 着手の前提として確定させる。**（設計伝達レポート §4-1 の起票を支持）DESIGN-07 §9-1 は `basis=standalone` ＋ 親参照の**対**で「単独入力不可」を導出する設計だが、現状は片方だけが入っている。親の基数（9 行か 3 行か）を設計側で確定させないまま M19-05 が着地すると、連打版 3 行が単独 filler / target に混入する。暫定の歯止めは `is_derived=1` ゲート（DESIGN-07 §9-4 で「恒久依存にしない」と明記された暫定措置）だけである。
4. **「手動確認レーン +3」を固定するテストを検討する。** 成立レーンの ±0 は canary が実 DB 全件を `buildStarters` に通すことで機械的に担保されているが、相手技側の +3 は報告書の文章のみである。`punishfinder` 本体には触れずに `internal/infra/migration` 側で「zangief の damage IS NULL な `_rapid` 行が 3 件」を固定するだけでも、`unknown_damage` 分岐に載る前提条件は押さえられる。
5. **`internal/seedgen/generate.go` の `validate()` 追加をスコープ超過として設計卓の裁定にかける。** 現状は無害（CSV が全行空欄なので `validStartupBases[""]` で通り、golden・`-check` とも green）だが、Phase 2 で開発者が CSV に値を書き始めると、**タイポ 1 件で `Generate` 全体（既存 7 stem を含む）が停止する**。バリデーションを足すこと自体は良い設計だが、指示書 §4.2 が「I/O 境界のみ」と限定した理由（golden の byte-identical が無改変の機械的証明になる）に照らすと、Phase 2 の新規ファイル側へ寄せるほうが契約に忠実。また `chain_cancel_total` / `fastest_unreachable` には同等の値域検証が無く、3 列で扱いが非対称である点も整理が要る。

### 低（将来対応）

6. `deref`（`migrate_m1904_test.go:358`）を `strconv.Itoa` ベースに直す（1 桁表示の誤読防止）。
7. 000052 の UPDATE を code 単位（000041 と同じ粒度）へ分解し、資料との 1:1 照合を容易にする。次回追記時のコスト削減。
8. 000049 のコメントから「backfill 専用」の語を言い換える（§4.9-3 の走査で再度ヒットするのを避けるため）。
9. 完了報告のファイル名を契約 §5 の `<id>-completion-report.md` へ揃えるか、契約側の記述を実態に合わせて改める。
10. 手入力ツール（別モジュール）が 23 列を素通しするかを Phase 2 着手前に確認する。

---

## 良かった点

- **実測資料からの 37 行転記が完全に正確だった。** レビュー側で v2.3.0 の確定値表と全 37 行を独立照合し、1 件の不一致も無かった。ガイル（Stand LP 10 / Crouch LP 9）やキンバリー（10 / 9 / 9）のように**値が近接して入れ替わりやすい組**でも正しい。リリーの 4 技目（`standing_light_kick`）とザンギエフの通常/連打 6 行という非対称も落とさずに拾えている。写像を「技名の文字列変換」ではなく「単発値 su/act/rec/total の 4 値一致による機械照合」で確定させた手順が、この精度の直接の要因である。
- **`fastest_unreachable` を「部分一致で書いた」で終わらせず、「前方一致なら取り落とす 2 行が実際に付与されている」を逆向きに固定した。** `m1904PrefixMissed = 2` という定数名まで含めて、M18-03c の再発を構造的に防いでいる。指示書の要求（部分一致であること）を、検証可能な形へ翻訳できている。
- **`chain_cancel_total` の代表値テストに、規則充填では絶対に出ない値（total−5・total−6・total−2）を意図的に選んでいる。** 「total − 4 で埋めていないこと」を、禁止コメントではなくテストで検出できる形にしている。
- **既存テストの追従を「緩める」のではなく「増分を明示する」形にした。** `expectedMovesDelta` は表に無いキャラの厳密性を一切損なわず、増分の理由をコード内に残す。数字だけ合わせる誘惑に流れなかった点は、本プロジェクトの過去教訓（M14-03d）への正しい応答である。
- **契約 F-2 をスナップショット比較（NULL 同一性を含む全行）で担保した。** 件数一致ではなく値の一致まで見ており、DoD の「件数と値のスナップショット比較で示す」を文字どおり満たしている。
- **否定形確認で機械 grep のヒットを意味で弁別した。** `setplay.go` の `1 − Gmax` を「旧定義の残骸ではない」と根拠付きで除外し、逆に設計正本自身に残る `G = 1 − N` を検出して（編集はせず）設計卓へ回した。走査対象を 3 系統に広げた効果が実際に出ている。
- **指示書と設計正本の食い違い（連打版の `startup_basis`）を、独自解釈で押し通さずに委譲文言の解釈として整理し、設計伝達レポート §2-1 で「指示書側を訂正してほしい」と明示した。** 判断・根拠・依頼が分離して書かれており、設計担当が読んで即座に裁定できる形になっている。
- **母数の実測差（+81）を「±10% 以内だから進む」で済ませず、内訳（CSV 72 行 ＋ 移動 system move 9 行）まで分解して説明した。** 指示書の見込み（+72）とのズレの理由が特定されており、後続が同じ数字で混乱しない。
- **`golang-migrate` の連番の穴について一次ソース（`source/migration.go:93`）まで当たり、ボード D-104 の未決に回答した。** さらに「真の危険は逆（大きい番号の後に小さい番号を差し込むと永久にスキップされる）」という、指示されていない重要な発見まで報告している。
- マイグレ・テスト・報告書のコメント密度が高く、「なぜその形なのか」が後任に伝わる。とくに 000051 の「000052 は本マイグレより後でなければならない／前に置くと 0 件更新になり、それはエラーにならない」は、順序依存を将来の読者に残す良い記述。

---

## 不明・レビューで判定できなかった事項

- **不明: Plan Mode の「質問書と回答」の原文（指示書 §3.3）が残っているか判断できない。** 完了報告 §2 に 11 項目の結果表があり、チェックリスト §0.1 が重視する 1（マイグレ末尾実査）・2（母数再実査）・3（`characters` 実在確認）はすべて具体値付きで提示されている。結果としては要件を満たすが、開発者とのやり取り自体はレビュー側からは参照できない。
- **不明: `chain_cancel_total` の絞り込み条件に対する開発者確認（指示書 §11）の実施有無を検証できない。** 報告書と一覧の双方に「開発者確認済み（2026-08-01）」とあるが、原文が無いため報告を採用した。条件自体（地上弱通常技 4 種）は実測資料のロースターと整合し、44 − 34 = 10 の算術も合う。
- **不明: `make e2e` の実行結果を再現していない。** 報告書 §10 の「passed 62 / flaky 6 / failed 1（`m14-03b-custom-states-realdata`）」および「単独実行で green」はレビュー側で再実行していない。ただし判定根拠 2・3（失敗領域が変更範囲と交わらない・新列が API/フロントに露出していない）はレビュー側の grep 結果と一致しており、判定は妥当と考える。
- **不明: 手入力ツール（別 go module・`.gitignore` 配下）が 23 列を保全するか確認できない。** リポジトリ内に実体が無いため未検証。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。

---

*以上、M19-04 レビュー報告書。判定＝**チェックリスト §9 重大ゼロ。推奨修正「高」1 件（rush 生成行の回帰テスト追加）を充足すれば完了承認可。***

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full_wt` Phase C により製造担当が自動トリアージした結果。**「高」の指摘は不採用ゼロ**（安全弁の発動なし）。

| # | 優先度 | 指摘 | 採否 | 理由・対応内容 |
|---|---|---|---|---|
| 1 | **高** | rush 行の新列値を固定するテストが無い（チェックリスト §6 第 3 項） | **採用** | `internal/repository/move/rush_test.go` を新規作成（`TestInsertRushVariant_FrameCostColumnDefaults`）。`dbtest.Setup` の実 DB で rush 版を 1 件生成し `startup_basis='through'` / `chain_cancel_total IS NULL` / `fastest_unreachable=0` / `is_derived=1` を assert。**ガードが実際に機能することを実証済み**——`insertRushVariantSQL` から `'through'` を一時的に外すと `startup_basis = "unknown", want "through"` で FAIL し、復元で green に戻ることを確認した |
| 2 | 中 | `move_derivations` の明示削除責務を followup-backlog へスラッグ登録 | **採用（導線を変更）** | **`followup-backlog.md` は中央帰属資料で製造は直接編集しない**（同ファイル末尾の注記・playbook §15.7）。したがって (a) **設計伝達レポート §4-1b に登録依頼**として起票（スラッグ案 `move-derivations-explicit-delete-on-reseed`・危険な経路と依頼内容を明記）、(b) `docs/progress/progress-log.md` に課題として記録、の 2 経路で取り込んだ |
| 3 | 中 | `move_derivations` へのデータ投入を M19-05 の前提として確定させる | **対応不要（起票済み）** | 指摘どおり**設計伝達レポート §4-1 に既に起票済み**（親の基数が 9 行か 3 行か未確定であること、暫定の歯止めが `is_derived=1` ゲートのみであることを含む）。レビュアーも「起票を支持」としており、追加作業は無い |
| 4 | 中 | 「手動確認レーン +3」を固定するテストを検討 | **採用** | 契約 F-1 が `punishfinder` の diff 0 を要求するため同パッケージには置けない。レビュアーの提案どおり **`internal/infra/migration/migrate_m1904_test.go` 側で分岐に載る前提条件を固定**した——連打版 3 行が `damage IS NULL` かつ `is_aerial=0` であること（＝自技側は `buildStarters` がスキップ／相手技側は `unknown_damage` へ）と、移動 system move 9 種と衝突しないこと |
| 5 | 中 | `generate.go` の `validate()` 追加をスコープ超過として設計卓の裁定にかける | **採用（裁定依頼として起票）・コードは現状維持** | **設計伝達レポート §3-4 を「★裁定を依頼したい」へ改稿**し、レビュー指摘・製造の反論（(a) 指示書が名指しで禁じたのは生成関数であり `validate` は含まれない (b) golden 7 stem が byte-identical で green＝変換規則は無改変 (c) 他 2 列は `parseNullableInt` / `parseBool` が parse 時点で型検証しており非対称ではない (d) タイポで止まるのは `category` の既存挙動と同一）・裁定が「寄せる」場合の指示先を明記した。**コードは残す**——削ると CSV の値域逸脱が Phase 2 まで検出されなくなるため |
| 6 | 低 | `deref` を `strconv.Itoa` ベースに直す | **採用** | `string(rune('0' + *p%10))` は下 1 桁しか表示されず、差分表示を誤読させる実際の欠陥だった。`strconv.Itoa` へ修正 |
| 7 | 低 | 000052 の UPDATE を code 単位へ分解する | **不採用** | 現状は「キャラ × 同値」でまとめており 121 行。code 単位に分解すると 37 文＋ヘッダで倍以上になる。**レビュアー自身が現形式のまま 37 行すべてを実測資料と 1 件ずつ突合できている**ことが、照合可能性が既に十分である証拠。次回追記時のコストは追記位置がキャラ単位で自明なため大きくない |
| 8 | 低 | 000049 のコメントから「backfill 専用」の語を言い換える | **不採用** | 当該語は **000039 / 000041 が同じ用法で使っている「投入方式の説明」**であり、§4.9-3 の走査対象である「**新列の値の置き場所は DB backfill 専用**」という撤回済みの*主張*とは別物。既存マイグレと語を揃えるほうが読み手の誤解が少ない。走査時の誤検出は §4.9 の判定手順（ヒットの文脈を読む）で吸収できる |
| 9 | 低 | 完了報告のファイル名を契約 §5 の規約へ揃える | **採用** | `docs/progress/M19-04-report.md` → **`docs/progress/M19-04-completion-report.md`** へリネーム（契約 `docs/process/m18-m19-contract.md:107`）。設計伝達レポートの参照も更新 |
| 10 | 低 | 手入力ツールが 23 列を素通しするかを Phase 2 着手前に確認 | **採用（申し送りとして記載）** | 手入力ツールは**別 go module・`.gitignore` 配下**で本サブのスコープ外（指示書 §2.2）のため確認していない。**設計伝達レポート §4-7 に「Phase 2 着手前の確認事項」として起票**（20 列前提だと書き戻し時に新 3 列が落ちるリスクを明記） |

### 取り込み後の検証

- `go test ./...` exit 0 / `go vet ./...` exit 0 / `gofmt -l` 未整形なし
- 新規ガードテスト `TestInsertRushVariant_FrameCostColumnDefaults` が **変異版で FAIL・復元で PASS** することを実証
- `TestRun_M1904_*` 5 本すべて green（前提条件の固定 2 件を追加した後も）
- golden 7 stem green / `go run ./cmd/seedgen -check` OK
- **`internal/service/punishfinder/` と `internal/service/setplay/` の diff は 0 のまま**（取り込みでも触っていない）
