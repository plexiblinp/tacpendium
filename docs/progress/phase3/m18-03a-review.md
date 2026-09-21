# M18-03a レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | 指示書 `docs/instructions/phase3/M18-03a-punish-mylist.md` **v1.0.1** ＋ 2026-07-26 チャット確定分（第3セクション「区分を判定できない反撃」） |
| チェックリスト | `docs/instructions/phase3/reviews/M18-03a-review-checklist.md` v1.0.1 |
| 対象コミット | `8904c7e` / `828aabc` / `4b64318` / `1f6923d` / `ccea983` / `7eac1c9` / `63419aa`（base = `2bb87a5`） |
| レビュー実施日 | 2026-07-26 |
| 判定 | **§9 の重大問題ゼロ。承認可**（推奨修正「高」は 0 件） |

---

## 総評

指示書 §4.1 の 2 つの帰結（pruning はマイリストの表示を制御しない／curation を孤児にしない）が、SQL・サービス・テストの三層で明示的に固定されており、設計意図の取り違えは見当たらない。スキーマ凍結ゲート（新規マイグレ 0・新表/新列 0・`seedgen`・`model.Combo`・`combos` INSERT 列・`DuplicateKey`/`CalcRecipeHash`/`RecomputeComboCache` の不変）は `git diff 2bb87a5..HEAD` で該当ディレクトリの差分 0 を実確認した。CHANGE 番号も中央払い出しの CHANGE-088 をそのまま消費しており自採番はない。

指示書の穴（探す画面の「確定反撃に採用」が `hit_type` を見ないため `normal`/`counter`/**NULL** が母集合に混入し、タブ絞りで黙って消える）を実装前に検出して開発者裁定を仰ぎ、確定した 3 条件（展開して中身が見える／理由と次のアクション／3 つ目のタブにしない）をすべて満たす形で実装している。**NULL ケースはサービス単体テスト・E2E C の両方で押さえられており**、本レビューの重点確認事項はクリアしている。

一方で、本サブが新設した「見返す画面」に載ることで初めて顕在化する silent-drop 経路が 1 本残る（コンボの識別キー編集＝PUT が旧コンボを論理削除するが `combo_punishes` を引き継がないため、採用がマイリスト・隠したもの管理・探す画面の既登録表示のすべてから消える）。完了報告の「実測 0 件だから実害なし」は母数が 0 であることに由来しており、将来の実害を否定する根拠にはなっていない。本サブでの実装変更は不要（指示書 §2.2 が該当資産を凍結）だが、事後確認事項への回答として補強が要る。

テスト・E2E ともグリーンを実機で再確認した（Go 全パッケージ green／FE 116 files・827 tests green）。E2E 追加 spec の retry 安全性に弱さがある点だけが技術的な残課題である。

---

## 設計準拠性レビュー結果

### §1.1 3 表の役割分担（指示書 §4.1）— ◎

- [✓] マイリストの母集合が `combo_punishes`。`internal/repository/punish/queries.go` の `listPunishEntriesBaseSQL` は `FROM combo_punishes cp JOIN combos c` で始まり、`materialized_from_combo_id` も `combo_punish_starters` も参照していない。
- [✓] **マイリストが pruning を表示制御に使っていない**。母集合 SQL に `combo_punish_prunings` への参照が 1 箇所も無い。`internal/repository/punish/repository_test.go:275` `TestRepository_ListPunishEntries_IgnoresPruning` と `internal/service/punishlist/service_test.go:172` `TestList_PruningDoesNotHideAdoptedPunish` の 2 層で固定。
- [✓] **curation が孤児にならない**。`internal/repository/punish/crud.go:34` `RemovePunish` が `BeginTx` → `removePunishSQL` → `removeCurationSQL` → `Commit` の 1 トランザクション。`TestRepository_RemovePunish_CascadesCuration`（連動削除）と `TestRepository_RemovePunish_AtomicOnFailure`（curations 表を DROP して 2 文目を失敗させ、両方残ることを確認）で原子性まで検証されている。
- [✓] `combo_punish_starters` を使う画面から引いていない。`internal/service/punishlist/service.go:29` の `Repository` IF は 5 メソッドで、starter 系を含まない。

### §1.2 `combo_punish_curations` の配線（指示書 §4.2）— ◎

- [✓] SELECT／INSERT／DELETE を新設。`removeCurationSQL` は `WHERE combo_id = ? AND opponent_move_id = ?`＝UNIQUE キー指定で、サロゲート id を使っていない（M18-02 の実装形の踏襲）。
- [✓] UNIQUE 二重登録は `ON CONFLICT (combo_id, opponent_move_id) DO UPDATE SET note = excluded.note` で弾かれ、pruning／starters と返し方が一致。`TestRepository_CurationCRUD` が行数 1 のまま note が更新されることを assert。存在しないキーの DELETE が壊れないことも同テストの冒頭で確認。
- [✓] `note`（隠す理由・任意）の入力欄が FE にある（`PunishList.tsx:94` `aria-label="隠す理由(任意)"`＝探す画面の pruning note と同じラベル流儀）。DB の `note` 列まで往復することは repository テストで確認。
- [✓] 既存 3 表の DDL 不変（`git diff` で `migrations/` に差分 0）。
- [✓] Plan 実査記録あり（完了報告 §1-1／§1-2）。grep 全 10 ヒットの内訳がファイル別件数で、実 DDL は列・UNIQUE・INDEX・timestamps TEXT まで照合済み。`migrations/000037_*.up.sql` を実読して報告記載と一致することを確認した。

### §1.3 マイリストの取得仕様（指示書 §4.3）— ○

- [✓] 5 段が実装されている。段1（`WHERE c.character_id = ?`）・段2（`AND c.deleted_at IS NULL`）・段4（`excludeCuratedClause` の `NOT EXISTS`）は SQL、段3（`hit_type` タブ絞り）・段5（グルーピング）は `internal/service/punishlist/service.go:174-188`。
- [△] **段3 を SQL でなくサービス層に置いた**のは指示書表の字面からの逸脱だが、「1 回の取得結果から振り分けないと『どちらのタブにも出ない採用』を数え漏らす」という理由が `repository.go:80` の `PunishEntryFilter` doc コメントと完了報告 §3.1 に明記されており、開発者確定の第3セクションを成立させるための必然。**逸脱として妥当**と判断する。
- [✓] 走査を一切していない。`punishlist` パッケージにフレーム判定・レーン判定・除外規則 a〜h の痕跡なし。
- [✓] `punishfinder` に相乗りせず `internal/service/punishlist/` に別置。
- [✓] 未 seed・不存在の有効 ID は 200＋空。`TestList_EmptyIsNotNil`（空スライスが nil でないことまで確認）＋ handler テスト `TestPunishList_200_EmptyAndDefaultsToJustParry`（`"nodes":[]` 等が `null` でなく `[]` でシリアライズされる）。404／500 を返す経路は無い。
- [✓] 規則は BE 一元化。FE 側に判定コードなし。

### §1.4 画面21（指示書 §4.4）— ○

- [✓] route `/punish/list`（`web/src/router.tsx`）。Header は単一 `NAV_LINKS` 配列に 1 行追加のみで、デスクトップ nav とモバイル Sheet ドロワーの両方が同配列を map する既存実装形に完全準拠（新しい流儀を作っていない）。
- [✓] タブ切替（ガード＝`punish_counter`／ジャストパリィ＝`just_parry_punish_counter`）。既定＝ジャストパリィが **BE（`handler.go:157`）と FE（`PunishListPage.tsx:35`）の両方**で担保されている。
- [✓] **`hit_type` の 4 値リテラルを新規定義していない**。BE は `model.HitTypePunishCounter` / `model.HitTypeJustParryPunishCounter` を参照（`punishlist/service.go:40-50`）、FE は `HIT_TYPE_LABELS` を `labelFor` 経由で参照（`PunishList.tsx:85`）。4 箇所目の定義は作られていない。
- [✓] 2 階層。始動技は `ComboNode` の属性（`starterMoveCode` / `starterMoveNameJa`）として行に出るのみで階層を切っていない。`TestList_GroupsByOpponentMove` が「始動技が違っても同じ相手技ノードに入る」ことを固定。
- [✓] ▶/▼ イディオム（`ChevronRight`/`ChevronDown`）。展開のクリック領域は行ヘッダー全体（`role="button"` + `tabIndex={0}` + `onKeyDown` の div）で、`PunishTree.tsx` と同じ流儀。
- [✓] 空状態に `/punish/search` へのリンクあり（`PunishList.tsx:189`）。テストで `href` まで assert。
- [✓] 「確定反撃の採用を解除」は既存 `DELETE /api/combo-punishes`（`useRemovePunish`）を使用。二重実装なし。
- [△] **空状態文言と第3セクションが同時表示され得る**。`list.nodes.length === 0` だけで空状態を出すため、タブ内 0 件・区分不明 2 件のとき「まだ確定反撃が登録されていません。」と「区分を判定できない反撃(2 件)」が同一画面に並び、文言が矛盾する（推奨修正・低）。
- [△] **`expandedMoves` の Set を `nodes` と `unclassifiedNodes` で共有している**（`PunishList.tsx:42`）。同一 `moveId` が両セクションに現れる（＝同じ相手技に `punish_counter` のコンボと `normal` のコンボが両方採用されている）場合、片方を開くともう片方も連動して開く（推奨修正・低）。

### §1.5 「隠したもの管理」（指示書 §4.4-4）— ◎

- [✓] pruning・curation が別セクションで、見出し「確定反撃のない技」／「使わない反撃」＋粒度説明文付き。
- [✓] 粒度の違いが文言で伝わる（「コンボによらない」／「このコンボだけ」）。`HiddenItemsPanel.test.tsx` が両文言の存在を assert。
- [✓] pruning の解除は既存 `DELETE /api/combo-punish-prunings` を呼ぶ FE 接続のみ。**BE を作り直していない**（`crud.go` の `RemovePruning` は無改変）。
- [✓] curation の解除は `DELETE /api/combo-punish-curations`。
- [✓] 解除後に再出現することを E2E A（curation）・E2E B（pruning・探す画面へ戻ることまで）で検証。

### §1.6 探す画面の改修（指示書 §4.5）— ◎

- [✓] 「自動判定できない相手技」の配下に登録済み `combo_punishes` が出る（`ManualReviewNode.RegisteredCombos`）。
- [✓] 配信は `GET /api/punish-finder` のレスポンス経由。FE から別 API を叩いて合成していない。
- [✓] 既存フィールドの意味・型が不変（`RegisteredCombos` の追加のみ）。0 件時は `null` でなく空スライスにする配慮あり（`manualNode()`）。
- [✓] 「登録済みの確定反撃」見出しを置き、成立ツリー（307-404 行）とは DOM 上も別。`TestScan_RegisteredCombosDoNotLeakIntoAcceptedTree` が成立ツリー側の不変を固定。
- [✓] 相手技の除外規則は不変（`isNonPunishableTarget` 無改変）。
- [✓] `curation` でも `hit_type` でも絞らない設計判断（探す画面では登録済みの事実をそのまま見せる）がコメントで説明されており、マイリスト側の `ExcludeCurated: true` と対称に整理されている。

### §2 データ・API 契約・スキーマの不変 — ◎

- [✓] **新規マイグレなし**。`git diff 2bb87a5..HEAD --stat -- migrations/` が空。`ls migrations/` の末尾は `000041_backfill_movement_total`。
- [✓] 新テーブル・新列なし。
- [✓] `internal/seedgen` 差分 0。
- [✓] `internal/model/` 差分 0（＝`model.Combo` 不変）、`internal/repository/combo/` 差分 0（＝`combos` INSERT 22 列・`DuplicateKey`・`CalcRecipeHash`・`RecomputeComboCache` 不変）。
- [✓] `ComboEditor` の Props 契約・`location.state` キー（`punishReturn`／`punishContext`）不変（`web/src/features/combo/` に差分なし）。
- [✓] DELETE はキー項目をボディで受ける（`CurationRequest`）。規則は BE 一元化。
- [✓] `GET /api/punish-list` に隠したもの一覧が畳まれている（別 GET を立てていない）。

### §3 フロントエンドの動作仕様 — ○

- [✓] invalidate は既存ヘルパーの拡張（`useInvalidatePunishFinder` → `useInvalidatePunish`。`[punish-finder]` と `[punish-list]` の両キーを無効化）。全 8 mutation が相乗り。非公開関数のため外部影響なし。拡張理由が完了報告 §3.3 に明記されている（チェックリストの要求を満たす）。
- [✓] 採用・解除・隠す・解除の各操作後に更新される（E2E A/B で実挙動を確認）。
- [✓] **ブラウザストレージ不使用**。`grep -rn "localStorage\|sessionStorage\|indexedDB" web/src/features/punish/ web/src/pages/PunishListPage.tsx` が 0 ヒット。選択状態は URL クエリ（`self`/`opp`/`guard`/`tab`）。
- [✓] 探す画面の既存操作は非回帰（差分は `manualReviewNodes` の `<li>` 内部に限定。既存テスト＋追加 2 ケースが green）。
- [△] FE 単体テストは `../api` をモジュールごとモックするため、`invalidate` 自体の発火は単体では検証されていない（E2E A/B で担保。指摘というより記録）。

### §4 テストの妥当性（指示書 §5）— ○

- [✓] curation の CRUD・UNIQUE 二重登録の棄却・存在しないキーの DELETE。
- [✓] 5 段が各 1 件以上。とくに論理削除済みコンボが出ないこと（`TestRepository_ListPunishEntries` 末尾）と、pruning された相手技の採用済み反撃が出ること（専用テスト 2 本）。
- [✓] `hit_type` タブの絞りが双方向（`TestList_HitTypeTabFiltersBothWays` がガード側・ジャストパリィ側の両方を assert）。
- [✓] **NULL ケースが押さえられている**（本レビューの重点）。`TestList_UnclassifiedHitTypes` が `normal`／`counter`／**`nil`** の 3 件を両タブでループして「タブ側に出ない・第3セクションに出る」を確認。E2E C も `hit_type` 未指定でコンボを作って `unclassifiedNodes` に落ちることを実 API で検証している。
- [✓] `DELETE /api/combo-punishes` の curation 連動削除と原子性。
- [✓] `GET /api/punish-finder` の成立ツリー不変。
- [✓] 未 seed・不存在 ID で 200＋空。
- [✓] E2E A（1 本動線・採用解除で curation が孤児にならないことまで）・B（pruning の片道解消）・C（区分不明）。
- [△] **E2E 3 本が retry 安全でない**。`retries: 1` かつ使い捨て DB はバックエンド起動時に 1 度だけ作られるため、1 回目失敗時の残存状態が 2 回目に持ち越される。A は `page.getByRole("button", { name: "使わないので隠す" }).first()` と `解除して再表示 .first()` が「対象行が 1 件だけ」を暗黙に仮定しており、残存があると別のコンボを操作して `コンボ #<id> が Hidden` の assert が落ちる。同様に `隠している反撃はありません。`／`隠している相手技はありません。` は残存 0 件を仮定する。B は途中失敗で pruning が残ると冒頭の「前提: 相手技が探す画面に出ている」で落ちる（推奨修正・中）。
- [△] handler の「未 seed で 200＋空」は fake service 経由のため、handler → service → repository を貫通した確認ではない（各層で個別に担保されているので実害は小さい）。

### §5 設計意図との整合 — ○

- [✓] 隠す操作 2 系統（pruning／curation）とも逆導線がある。**チェックリスト §9 が定義する意味での片道操作は残っていない。**
- [✓] 2 系統がユーザーに区別できる（別セクション・別文言・別 endpoint）。
- [✓] `combo_punish_starters`（作業状態）と `combo_punishes`（採用の正）の混同なし。
- [✓] materialize／FR301／案C／export 整合の前倒しなし。`internal/service/setplay/`・`web/src/features/setplay/` に差分 0。
- [✓] 探す（3 階層・走査）と使う（2 階層・取得）の非対称が保たれている。
- [△] **区分不明セクションの行から「確定反撃の採用を解除」ができない**（`renderMoveNode(node, false)`＝`withActions=false`）。かつ、当該コンボが探す画面の成立ツリーに孫として現れない場合（`starter_move_id` が NULL／レシピが空／相手技が手動確認レーン等）、**採用を解除できる UI が本アプリのどこにも無い**（`grep -rln "combo-punishes"` の結果、解除導線は `PunishTree.tsx` と `PunishList.tsx` の 2 箇所のみで、後者は区分不明行に出さない）。E2E C が作るデータがまさにこの状態である。「隠す」ではないので §9 の片道操作には該当しないが、隣接する片道性である（推奨修正・中）。

### §6 コード品質・規約遵守 — ◎

- [✓] 「ジャストパリィ」を略していない。
- [✓] 内部値と表示ラベルが分離（BE は `model.*` 定数、FE は `PUNISH_GUARD_TYPE_LABELS`／`HIT_TYPE_LABELS`）。
- [✓] 新規ファイルの配置が既存構成に沿っている。
- [✓] **既存の解決経路を再利用している**。`officialJaPresetSubquery` を定数化し、`listPunishEntriesBaseSQL`／`listCurationsBaseSQL`／`listPruningsBaseSQL` の 3 本で共用。始動技コード解決を二度実装していない（指示書 §3.3-6 の要求）。

### §7 既存挙動の温存 — ◎

- [✓] Go 全テスト green（実行して確認）。FE 116 files / 827 tests green（実行して確認）。`go build ./...` も通る。
- [✓] M18-01／M18-02 の挙動不変（走査結果・3 レーン・除外規則）。
- [✓] M19-01 資産に触れていない。
- [△] `web/src/components/Header.tsx` に 1 クラス（`min-w-0 overflow-x-auto whitespace-nowrap`）を追加している。完了報告 §6 が「スコープ外だが必要だった変更」として自己申告し、因果（リンクを外すと 15 本 green に戻る）と代替案（ブレークポイント引き上げ）を示したうえで開発者判断を仰いでいる。**手続きとしては適切**。ただし共有コンポーネントの変更であり、最終判断は開発者に属する。

### §8 ドキュメント — ○

- [✓] DES 反映要点が 3 点＋新規事項（区分不明セクション）で記載され、指示書 §7.4 が求める「画面5 マイコンボとは別系統」の 1 行も含まれている。
- [✓] CHANGE-088（中央払い出し値）を明記。**自採番していない**（`docs/change-notes/` に新規ファイルなし）。マイグレ 0 本も明記。
- [✓] Plan Mode 実査結果が実値で記載され、基準時点（2026-07-26・DB サイズ・`schema_migrations`=41）と単位（「数えた単位＝`combo_punishes` の行数」）が併記されている。読み取り専用接続を使った旨まで書かれており E-16／E-18／E-24 を満たす。
- [✓] DES 本体を直接編集していない（`docs/design/` に差分 0）。
- [△] `docs/progress/progress-log.md` を更新していない（CLAUDE.md §8「製造工程で発見された課題・TODO は progress-log に記録」）。ただし直近の M18-02 も同様に完了報告のみで済ませており、慣行のドリフトが先行している（推奨修正・低）。
- [△] 完了報告 §4.2 の申し送り（E2E 実行環境の SQLite 書き込み競合・worker 数／`busy_timeout` 見直し）が `docs/handover/followup-backlog.md` へ起票されていない（推奨修正・低）。

### §9 重大な問題 — **該当なし（0 件）**

チェックリスト §9 の 13 項目をすべて個別に確認し、いずれも該当しないことを実コード／`git diff` で確認した。とくに次の 5 点は明示的に検証済み。

| 項目 | 判定根拠 |
|---|---|
| 新規マイグレ／既存マイグレ改変／`seedgen` 改変 | `git diff 2bb87a5..HEAD --stat -- migrations/ internal/seedgen/` が空 |
| マイリストが pruning で表示制御されている | 母集合 SQL に pruning 参照 0・専用テスト 2 本 |
| curation が孤児になる | `RemovePunish` の 1 トランザクション化＋連動削除テスト＋原子性テスト |
| 片道操作が残っている | pruning／curation とも「解除して再表示」導線あり・E2E A/B で往復を実証 |
| `hit_type` 4 値リテラルの 4 箇所目 | BE は `model.HitType*`、FE は `HIT_TYPE_LABELS` を参照。新規定義なし |

---

## 設計準拠性以外の指摘事項

### 1. 論理削除の silent-drop 経路が 1 本残る（評価の過小）

`internal/service/combo/service.go:517-520` のとおり、**識別キー変更を伴う編集（PUT）は旧コンボを `deleted_at` で論理削除して新コンボを INSERT する**。`combo_punishes` / `combo_punish_curations` を新コンボへ引き継ぐコードは存在しない（`grep -rn "combo_punish" internal/service/combo/ internal/repository/combo/` が 0 ヒット。setup は `SetupCarryOptions` で引き継がれるが punish は対象外）。

その結果、指示書 §4.3-2 の `deleted_at IS NULL` により、**ユーザーがコンボを編集しただけで、その採用がマイリスト・隠したもの管理（`listCurationsBaseSQL` も `c.deleted_at IS NULL` で絞る）・探す画面の既登録表示のすべてから同時に消える**。ゴミ箱にも「反撃として採用されていた」情報は出ない。

完了報告 §8 の「実測 0 件のため実害はない」は、`combo_punishes` の総行数が 0（同 §1-3）であることに由来しており、**将来の実害を否定する根拠になっていない**。指示書 §10 の事後確認事項 1 が想定していたのは「ユーザーがゴミ箱に入れた場合」だが、実際にはより頻度の高い「編集した場合」でも同じ状態が発生する。

**本サブでの実装変更は不要**（指示書 §2.2 が `model.Combo`／`combos` INSERT 列／combo サービスを凍結しているため、引き継ぎ実装は明確にスコープ外）。事後確認事項への回答を「0 件だから実害なし」から「PUT 経由でも発生する。現状 0 件だが機能が使われ始めれば発生する」へ改め、M18-03b または中央へ判断を送るべき。

### 2. 区分不明セクションの行に採用解除がない（隣接する片道性）

§5 の [△] に記載のとおり。第3セクションは「M18-03b の materialize が処理すべき入力キュー」と位置づけられているので、次のアクションが提示されている点は開発者確定条件を満たす。ただし **`DELETE /api/combo-punishes` は既存 endpoint であり、行に 1 ボタン足すだけで解除導線が閉じる**。「隠す」を出さない判断（curation はタブ内の表示制御であり区分不明バケツには意味が薄い）は妥当だが、「採用を解除」まで落とす必要はない。

### 3. E2E spec の retry 安全性

§4 の [△] に記載。`.first()` に依存する 3 箇所（A の「使わないので隠す」／A・B の「解除して再表示」）を、対象コンボ id を含む行にスコープした locator（例: `page.locator("li", { hasText: \`コンボ #${comboId}\` }).getByRole("button", { name: "使わないので隠す" })`）へ変えると、残存状態に対して頑健になる。B は冒頭の前提 assert の前に pruning を DELETE しておけば idempotent になる。

なお、追加 spec が `moves` へ一切書き込まない設計（飛び道具 `hadoken_light` を相手技に使って決定論を得る）に変更されている点は、M18-02 spec との版衝突を根治する良い判断であり、この指摘とは別に評価したい。

### 4. query パラメータ命名の非一貫（DES 反映時の確認事項）

`GET /api/punish-finder` は `self_character_id` / `opponent_character_id` / `guard_type`（snake_case・フルネーム）、新設の `GET /api/punish-list` は `self` / `opp` / `guard`（短縮形）。**指示書 §4.6 が後者を明記しているため実装の瑕疵ではない**が、同一機能領域の隣接 endpoint で命名規則が割れる。DES-002 §4.2 への反映時に、中央で意図的な差か否かを確認しておくのが望ましい。

### 5. `punishfinder.Scan` の無条件クエリ追加

`internal/service/punishfinder/service.go` の Scan が、手動確認レーンの有無に関わらず毎回 `ListPunishEntries`（当該相手キャラの全採用済み反撃）を実行する。消費されるのは `manualNode()` に渡る分だけ。件数規模から実害はないが、`registeredIdx` の構築を手動確認ノードが 1 件以上ある場合に遅延させる余地がある（低）。

### 6. `AddCuration` に「対応する採用が存在するか」の検証がない

API を直接叩けば `combo_punishes` に無い組の curation を作れ、それは「隠したもの管理」の『使わない反撃』にだけ現れる（マイリスト側に対応行が無い）。ただし `AddPunish` / `AddPruning` も同水準の検証しか持たず、FE からは到達しない経路であるため、**house style としては一貫している**。将来の API 直叩き耐性を上げるなら全 punish 系で揃えて検討すべき事項（低）。

### 7. `repository_test.go` 内の `hit_type` リテラル

`setupPunishFixture(t, db, strPtr("punish_counter"))` 等でテスト内にベタ書き。§7.3 の「4 値リテラルを新規に定義していない」には抵触しない（定義ではない）が、`model.HitTypePunishCounter` を参照するほうが `punishlist/service_test.go` と揃う（低）。

### 8. コーディング規約チェック（問題なし）

- JSON タグは全て camelCase（`selfCharacterId` / `opponentMoveId` / `unclassifiedNodes` 等）。DB 列名との分離が保たれている。
- エラーは全て `fmt.Errorf("...: %w", err)` で wrap。
- 公開型・公開メソッドに godoc コメントあり。パニック不使用。
- `console.log` / `fmt.Println` の混入なし。`eslint-disable` / `nolint` の追加なし。
- 新規依存ライブラリの追加なし（`go.mod` / `package.json` に差分なし）。
- FE の Set トグル記法（`next.has(id) ? next.delete(id) : next.add(id)`）は `PunishTree.tsx:106` の既存流儀の踏襲であり、本プロジェクトは eslint を持たない（`lint` = `tsc --noEmit`）ため指摘としない。
- セキュリティ: SQL は全て `?` プレースホルダ。動的に連結されるのは定数句（`opponentCharacterClause` / `excludeCuratedClause` / ORDER BY）のみで、ユーザー入力の連結はない。

---

## 推奨修正（優先度別）

### 高（M18 完了前に修正必須）

**なし。** §9 の重大問題ゼロ、DoD §7.1〜§7.5 は充足している。

### 中（M19 着手と並行可）

1. **事後確認事項への回答を補強する**（指摘 1）。完了報告 §8 に「PUT（識別キー変更を伴う編集）でも旧コンボが論理削除されるため、コンボを編集しただけで採用がマイリスト・隠したもの管理・探す画面の既登録表示から同時に消える。現時点で 0 件なのは `combo_punishes` が 0 行だからであり、機能が使われ始めれば発生する」旨を追記し、対処（引き継ぎ／注記／許容）の判断を M18-03b または中央へ送る。**コード変更は不要**（指示書 §2.2 のスコープ外）。
2. **区分不明セクションの行に「確定反撃の採用を解除」を出す**（指摘 2）。既存 `useRemovePunish` を使うだけで、現在どの UI からも解除できないケースが解消する。「使わないので隠す」は出さないままでよい。
3. **E2E 3 本を retry 安全にする**（指摘 3）。`.first()` を対象コンボ id スコープの locator へ、B の前提 assert 前に pruning を先行 DELETE。

### 低（将来対応）

4. 空状態の判定を `list.nodes.length === 0 && countCombos(list.unclassifiedNodes) === 0` にする（区分不明が存在するのに「まだ確定反撃が登録されていません」と出るのを避ける）。
5. `expandedMoves` をセクション別に分ける（`nodes` と `unclassifiedNodes` で `moveId` が衝突したときの連動展開を避ける）。キーを `"tab:20"` / `"unc:20"` のように接頭辞付きにするだけでよい。
6. `docs/progress/progress-log.md` へ M18-03a の要点・課題・申し送りを追記（CLAUDE.md §8）。M18-02 も未追記のため、そちらと併せて中央で慣行を確定するのが望ましい。
7. E2E 実行環境の SQLite 書き込み競合（完了報告 §4.2 の申し送り）を `docs/handover/followup-backlog.md` へ起票。
8. `punishfinder` の `ListPunishEntries` 呼び出しを手動確認ノードが 1 件以上ある場合に限定（指摘 5）。
9. `repository_test.go` の `hit_type` リテラルを `model.HitType*` へ（指摘 7）。
10. `/api/punish-list` の query 命名について DES 反映時に中央確認（指摘 4）。

---

## 良かった点

1. **設計意図を「テストで固定した」こと。** §4.1 の 2 帰結は文章では守りやすくても実装ではすり抜けやすい。母集合 SQL に pruning への参照を 1 つも書かないという構造的な担保に加え、repository 層とサービス層の両方に「pruning しても消えない」テストを置いた。とくに原子性テストを「`DROP TABLE combo_punish_curations` で 2 文目を確実に失敗させる」という実行可能な形で書いたのは、検証しにくい要件に正面から向き合った良い設計である。

2. **指示書の穴を、実装を止めて開発者へ上げたこと。** 「`hit_type` でタブ絞り」を literal に実装すれば指示書には準拠する。それをせず、`combo_punishes` の実際の入り口（採用ボタンが `hit_type` を見ない）を辿って silent-drop を予見し、裁定を仰いだ。CLAUDE.md §9 の第一選択そのものであり、確定した 3 条件（展開可・理由と次のアクション・3 つ目のタブにしない）をすべて満たしたうえで **NULL ケースまでテストで押さえた**のも徹底している。

3. **「引いてから同型を名乗る」（L-1）の実践。** `combo_punish_curations` の未使用確認をファイル別ヒット数まで、実 DDL を列・UNIQUE・INDEX・timestamps の型まで照合し、報告に基準時点と数えた単位を併記した。`sqlite3` CLI が無い環境で Python の読み取り専用接続を選んだ判断も、DB を触らないという制約を守るうえで適切。

4. **名前解決の二度実装を避けたこと。** `officialJaPresetSubquery` を定数に切り出し、新設 3 本のクエリで共用した。指示書 §3.3-6 の「同じ解決経路を再利用する」を、コピペではなく共通化で実現している。

5. **Header 回帰の扱い。** 「nav リンクを一時的に外すと 15 本すべて green に戻る」で因果を確定してから、最小の 1 クラス追加に留め、代替案とその不採用理由まで添えて開発者判断を仰いだ。スコープ外への踏み込みとしては模範的な手順である。

6. **E2E の決定論の取り方。** 相手技へ PATCH する M18-02 spec の流儀を踏襲せず、「飛び道具は必ず `distance_dependent` に落ちる」という不変条件を使って書き込みゼロで決定論を得た。他 spec との版衝突を根治する発想であり、後続サブでも踏襲する価値がある。

7. **報告の正直さ。** E2E フルスイートの既存不安定性について、ベースライン（`--grep-invert "M18-03a"`）を実際に取って「本サブの spec が原因ではない」を切り分けたうえで、失敗の様態と未着手の理由を明記している。都合の悪い事実を丸めていない。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 検証として実行したのは `go build ./...` / `go test ./...` / `cd web && pnpm test` の 3 つ（いずれも green）。`make e2e` は実行していない（DB・アプリの状態を変える操作を避けたため）。E2E の結果は完了報告 §4.1 の記載（45/45 pass・pin 一致環境）を前提としている。
- コードの変更は一切行っていない。Git は `status` / `diff` / `log` / `show` の読み取り系のみ使用した。
- **不明**: 完了報告 §1-3〜§1-4 の dev DB 実測値（`combo_punishes` 0 行・論理削除紐づき 0 件・`combo_punish_starters` 14 行等）は、レビュー時点で DB へ接続していないため再現確認していない。報告記載の手順（読み取り専用接続）と数値の内的整合性に矛盾は見当たらない。
- **不明**: 指示書 v1.0.1 に未反映の「区分を判定できない反撃」セクションについて、開発者裁定の 3 条件の原文はレビュー依頼文からの引用であり、原典（2026-07-26 のチャット）は参照していない。引用された 3 条件に照らす限り、実装は 3 条件すべてを満たしている。

---

*以上、M18-03a レビュー報告書。配置 `docs/progress/phase3/m18-03a-review.md`。判定＝重大問題ゼロ・承認可、推奨修正「高」0 件・「中」3 件・「低」7 件。*

---

## 取り込み結果（自動トリアージ）

| 項目 | 実施日 | 内容 |
|------|--------|------|
| トリアージ | 2026-07-26 | 製造担当 Claude Code（`/implement_plan_full` Phase C・自動トリアージ） |
| 判定 | — | **「高」0 件のためエスカレーション不要**。「中」3 件は全採用、「低」7 件は 6 採用・1 不採用 |
| 追加コミット | — | `10fd2af`（コード修正）／`9408288`（文書反映） |

### 中（3 件・すべて採用）

| # | 指摘 | 採否 | 対応内容と理由 |
|---|------|------|----------------|
| 中-1 | 論理削除の silent-drop 経路の評価が過小 | **採用（文書のみ）** | 指摘は事実。`internal/service/combo/service.go` の識別キー変更編集が旧コンボを `deleted_at` で論理削除し、`combo_punishes` 引き継ぎコードが存在しないことを実コードで再確認した（combo 層の `combo_punish` 参照は `repository_test.go` の `hit_type` 文字列 4 件のみ＝引き継ぎロジックなし）。完了報告 §8 を「0 件だから実害なし」から「**PUT 経由でも発生する。0 件なのは母数が 0 行だから**」へ差し替え、処遇判断を M18-03b／中央へ送った。あわせて `followup-backlog.md` §I-(b) `combo-punish-carryover-on-edit` として起票。**コード変更なし**（指示書 §2.2 が combo サービスを凍結＝スコープ外という指摘者の判断に同意） |
| 中-2 | 区分不明セクションの行から採用解除ができない | **採用（コード修正）** | 指摘のとおり、当該コンボが探す画面の成立ツリーに孫として現れない場合、解除できる UI がアプリのどこにも無かった。`renderCombos` の引数を `withActions` から `showCuration` へ改め、**「確定反撃の採用を解除」は両セクションに出し、「使わないので隠す」は従来どおりタブ内のみ**とした（curation はタブ内の表示制御であり区分不明バケツには意味が薄い、という指摘者の整理に同意）。既存 `useRemovePunish` を使うのみで新 API なし。テスト 1 本追加 |
| 中-3 | E2E 3 本が retry 安全でない | **採用（コード修正）** | 指摘のとおり修正した。(1) `.first()` 依存を**対象コンボ id にスコープした locator**（`page.locator("li").filter({ hasText: \`コンボ #${comboId}\` })`）へ置換、(2) 相手技ノードは「先頭 1 つ」ではなく**出ているノードを全展開**、(3) B は前提 assert の前に **pruning を先行 DELETE** して idempotent 化、(4) 「残存 0 件」を仮定する assert（`隠している反撃はありません。`／`隠している相手技はありません。`）を**対象行の `toBeHidden`** へ変更。<br>**残存事象（正直な記録）**: `--repeat-each` で同一バックエンドに反復実行すると、なお 1〜2 本が flaky になる。原因は locator ではなく **`POST /api/combo-punish-prunings` 等が 500 を返すバックエンド側の書き込み競合**（isolated 実行でも 1 回目が 128ms で 500）。これは §I-(a) に起票した既知の基盤問題であり本サブのスコープ外。**通常の `make e2e` は 45/45 pass**（3 flaky は M18-03a と無関係な PDF 系・メディア系で retry 吸収） |

### 低（7 件・6 採用 / 1 不採用）

| # | 指摘 | 採否 | 対応内容と理由 |
|---|------|------|----------------|
| 低-4 | 空状態文言と第3セクションが同時表示され得る | **採用** | `list.nodes.length > 0` → 一覧、`unclassifiedCount > 0` → 「このタブに該当する確定反撃はありません。」、いずれでもない → 従来の空状態（CTA 付き）の 3 分岐へ。矛盾表示を解消。テスト 1 本追加 |
| 低-5 | `expandedMoves` の Set をセクション間で共有 | **採用** | キーを `"tab:20"` / `"unclassified:20"` の接頭辞付き文字列へ変更（指摘者の提案どおり）。連動展開しないことをテストで固定 |
| 低-6 | `progress-log.md` 未更新 | **採用** | M18-03a の要点・指示書の穴と開発者裁定・課題/申し送りを追記（CLAUDE.md §8）。なお指摘のとおり M18-02 も未追記であり、**慣行のドリフト自体は中央判断**として据え置く（本サブ分のみ追記） |
| 低-7 | E2E 書き込み競合が followup-backlog へ未起票 | **採用** | `followup-backlog.md` §I（M18 期の新規論点）を新設し `e2e-sqlite-write-contention`（a）として起票。ベースライン実測値と M18-03a 側で実施済みの緩和も併記 |
| 低-8 | `punishfinder` の `ListPunishEntries` を手動確認ノードがある場合に限定 | **不採用** | 指摘者自身が「件数規模から実害はない」としており、**遅延化は `Scan` に 2 本目の実行経路を生む**（手動確認ノードは pass1 のループ内で確定するため、遅延初期化にはループ後の再走査か lazy クロージャが要る）。可読性と分岐の少なさを優先して現状維持とする。将来 `moves` 規模が桁で増えた場合に再検討 |
| 低-9 | `repository_test.go` の `hit_type` リテラル | **採用** | `strPtr(model.HitTypePunishCounter)` / `strPtr(model.HitTypeJustParryPunishCounter)` へ置換し `punishlist/service_test.go` と揃えた。テスト内リテラル 0 件 |
| 低-10 | query 命名について DES 反映時に中央確認 | **採用（対応済み）** | 設計伝達レポート `docs/handover/phase3/design-reports/20260726-m18-03a-design-handover.md` の §3-3（残課題）と §5（CHANGE 起票チェックリスト）に、`self_character_id` 系と `self` 系の 2 流儀がある事実と裁定依頼を記載済み。**追加対応なし** |

### 取り込み後の検証

| 区分 | 結果 |
|---|---|
| `go build ./...` / `go test ./...` | **全 green** |
| `pnpm exec tsc --noEmit`（＝`pnpm lint`） | **green**。E2E 側 `tsc -p e2e/tsconfig.json` も green |
| `pnpm exec vitest run` | **116 files / 830 tests 全 green**（取り込みで +3 本） |
| `make e2e` | **45/45 pass**（3 flaky は M18-03a と無関係・retry 吸収） |

### 未対応として残すもの

- **低-8**（上記の理由で不採用）。
- **中-3 の残存事象**（`--repeat-each` 下の flaky）は §I-(a) の基盤課題として繰越。
- 中-1 の**コード対応**（採用の引き継ぎ）は §I-(b) として M18-03b／中央の判断待ち。

> 本節は `/implement_plan_full` Phase C の品質補償（採否理由の事後監査可能化）として製造担当が追記した。**レビュー本文（本節より上）はレビュー担当の成果物であり改変していない。**
