# M18-03a 完了報告: 確定反撃マイリスト（使う画面）＋隠したもの管理

| 項目 | 内容 |
|------|------|
| 文書ID | M18-03a-REPORT |
| 作成日 | 2026-07-26 |
| 対応指示書 | `docs/instructions/phase3/M18-03a-punish-mylist.md` **v1.0.1** |
| 準拠範囲 | **指示書 v1.0.1 ＋ 2026-07-26 のチャット確定分（第3セクション「区分を判定できない反撃」）**。後者は指示書へ事後反映予定（開発者了承済み） |
| 消費した CHANGE 番号 | **CHANGE-088**（中央払い出し値。**自採番していない**） |
| 消費したマイグレ連番 | **なし（0 本）**。`migrations/` の末尾は **000041** のまま |
| ブランチ | `wt/m18-03a` |

---

## 1. §3.3 Plan Mode 実査結果（実値）

**基準時点 2026-07-26 / dev DB `~/.local/share/combomgr/combomgr.db`（495,616 bytes・最終更新 2026-07-26 04:42）/ `schema_migrations` = version 41 / dirty 0。**
`sqlite3` CLI が devContainer に無いため、Python の `sqlite3` を `mode=ro&immutable=1`（読み取り専用）で接続して計測した。**DB への書き込みは行っていない。**

### 1-1. `combo_punish_curations` の未使用確認（grep 結果・出力を切らずに実行）

`grep -rn "combo_punish_curations\|ComboPunishCuration" internal/ web/src/ migrations/` → **全 10 ヒット**。

| ファイル | ヒット数 |
|---|---|
| `migrations/000037_create_combo_punish_prunings_and_curations.up.sql` | 3 |
| `migrations/000037_create_combo_punish_prunings_and_curations.down.sql` | 1 |
| `internal/infra/migration/migrate_m1801_test.go` | 6 |

**repository / service / api / `web/src/` はいずれも 0 件。** 指示書 §4.2 の想定どおり「拡張」ではなく **「新設」** で正しく、本サブが本表の初めての消費者になった。

### 1-2. 実 DDL と DES-003 §3.17 の一致

`migrations/000037_*.up.sql` の実 SQL を確認。**記述と一致**（`id` / `combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE` / `opponent_move_id INTEGER NOT NULL REFERENCES moves(id)` / `note TEXT` / `created_at`・`updated_at` は **TEXT** `DEFAULT (datetime('now'))` / `UNIQUE (combo_id, opponent_move_id)` / `CREATE INDEX idx_cpc_opponent_move ON combo_punish_curations(opponent_move_id)`）。不一致なし。

### 1-3. 論理削除済みコンボに紐づく `combo_punishes` の件数

```sql
SELECT COUNT(*) FROM combo_punishes cp
JOIN combos c ON c.id = cp.combo_id
WHERE c.deleted_at IS NOT NULL;
```

**0 件**。数えた単位＝`combo_punishes` の行数。

周辺の実測（同一時点・同一 DB）:

| 数えたもの（単位） | 件数 |
|---|---|
| `combo_punishes` の行数（全体・deleted 条件なし） | **0** |
| `combo_punish_prunings` の行数 | 1 |
| `combo_punish_curations` の行数 | **0** |
| `combo_punish_starters` の行数 | 14 |
| `combos` の行数（生存 / 論理削除） | 35 / 6 |

### 1-4. 開発者追加依頼のクエリ（第3セクションのバケツが空か）

```sql
SELECT c.hit_type, COUNT(*) AS n
FROM combo_punishes cp JOIN combos c ON c.id = cp.combo_id
WHERE c.deleted_at IS NULL GROUP BY c.hit_type;
```

**結果 0 行**（母数の `combo_punishes` が 0 行のため）。**PC 系以外は 0 件＝バケツは現時点で空。** よってセクションは実装し、**テストは合成データで記述**した。

> 補足: `combo_punish_starters` が 14 行ある一方 `combo_punishes` が 0 行なのは、M18-02 の試用で始動技レベルの採否までは触ったがコンボ採用まで進んでいない状態と読める。**「既に normal のコンボを採用済みで現に見えなくなっている」実データは存在しない。**

### 1-5. `Header.tsx` の `NAV_LINKS` 実装形

単一の `NAV_LINKS: NavLink[]`（20-33 行）を **デスクトップ nav（55 行〜）とモバイル Sheet ドロワー（93 行〜）が共に map** している。**配列に 1 行足すだけで両対応**（M18-02 が「確定反撃サーチ」を足した形と同じ）。

### 1-6. queryKey の実体

`PUNISH_FINDER_KEY = "punish-finder"`（非公開）＋ 非公開ヘルパー `useInvalidatePunishFinder()`。既存 **5 mutation 全部**が `onSuccess: invalidate` で相乗り。**本サブでは既存ヘルパーを拡張**（§4 で後述）。

### 1-7. コンボ表示項目の解決経路

`internal/repository/punish/` は **コンボ列を一切引いていなかった**。探す画面の孫コンボは `punishfinder` が `combo.Repository.List(ListFilter{CharacterID, StarterMoveIDs})` で `*model.Combo` を取り、技名は `queries.go: listMovesForScanSQL` の `LEFT JOIN preset_aliases … preset_id = (SELECT id FROM presets WHERE code='official_ja_move')` で解決していた。

### 1-8. `PunishTree.tsx`（438 行）の構造

「自動判定できない相手技」は **406-435 行の独立 `<section>`**。成立ツリー（307-404 行）と DOM 上も完全に別で、採否トグル・pruning ボタン・note 入力欄はすべて成立ツリー側にある。**§4.5 の追加は当該 `<li>` 内部の拡張のみで、既存操作と干渉しない。**

---

## 2. 開発者確定事項（2026-07-26・指示書外）

**指示書の穴を 1 件検出し、開発者裁定を得て実装した。**

- **事象**: 探す画面の「確定反撃に採用」は `hit_type` を見ない（`PunishTree.tsx` の採用ボタン／母集合の `combo.List` とも `hit_type` で絞らない）。よって `hit_type` が `normal` / `counter` / **NULL** のコンボが `combo_punishes` に入り得る。§4.3-3「`hit_type` でタブ絞り」を literal に実装すると、それらは**どちらのタブにも出ず黙って消える**。
- **裁定**: 件数を出す案を採用。**ただし条件 3 つ**（いずれも実装済み）:
  1. **件数だけでなく展開して中身が見える**（折りたたみで相手技・コンボ・`hit_type` バッジ）
  2. **理由と次のアクションを書く**（「ガード始動／ジャストパリィ始動のどちらか判定できない記録です。パニッシュカウンター版に変換すると、上の一覧に出ます。**変換機能は M18-03b で対応予定です。**」）
  3. **3 つ目のタブにしない**。両タブ共通で**画面下部に 1 セクション**、見出し＝**「区分を判定できない反撃（N 件）」**
- **ドメイン上の位置づけ**: このバケツは **M18-03b の materialize が処理すべき入力キュー**であり、ゴミ箱ではない。

---

## 3. 実装内容

### 3.1 BE

| 対象 | 内容 |
|---|---|
| `internal/repository/punish/{repository,queries,scan,crud}.go` | `combo_punish_curations` の SELECT/INSERT/DELETE を**新設**。`ListPunishEntries`（採用済み確定反撃の表示用投影）・`ListCurations`・`ListPrunings` を追加。**`RemovePunish` を同一トランザクション化**し同一キーの curation を連動削除 |
| `internal/service/punishlist/`（新規） | マイリストの取得。**走査を一切しない**。狭い `Repository` IF を自前定義（`ComboLister` と同じ流儀） |
| `internal/service/punishfinder/service.go` | `ManualReviewNode` に `registeredCombos` を**追加のみ**（既存フィールドの意味・型は不変＝後方互換） |
| `internal/api/punish/{handler,routes,dto}.go` ＋ `cmd/combomgr/main.go` | endpoint 3 本を追加。`NewHandler` を 2 サービス受け取りへ拡張 |

**新 endpoint（DES-002 §4.2 へ追加）**

| メソッド | パス | 備考 |
|---|---|---|
| GET | `/api/punish-list` | `self`（必須）/ `opp`（任意）/ `guard`（既定 `just_parry`）。**隠したもの一覧を畳んで返す**（別 GET を立てない）。副作用なし |
| POST | `/api/combo-punish-curations` | `comboId` / `opponentMoveId` / `note` |
| DELETE | `/api/combo-punish-curations` | **キー項目をボディで受ける**（M18-02 の実装形） |

**既存 endpoint の挙動追記**: `DELETE /api/combo-punishes` は同一キーの curation も削除する（**シグネチャは不変**）。`GET /api/punish-finder` は `manualReviewNodes[].registeredCombos` を返す（後方互換）。

**マイリスト取得の 5 段**: 段1（自キャラ絞り）・段2（`deleted_at IS NULL`）・段4（curation 除外）は SQL、段3（`hit_type` タブ絞り）・段5（相手技グルーピング）はサービス層。**段3 を SQL に置かなかった理由**は、タブ外（区分不明）を数え漏らさないため 1 回の取得結果から振り分ける必要があるから。

### 3.2 FE

- `web/src/features/punish/{types,api}.ts`：マイリスト型と `usePunishList` / `useAddCuration` / `useRemoveCuration` / `useRemovePruning` を追加。
- `PunishList.tsx`（新規）：**2 階層**（相手技 → コンボ）。**始動技は行の属性表示で階層を切らない**。▶/▼ は DES-005 §5.4 準拠、クリック領域は行ヘッダー全体。空状態に `/punish/search` へのリンク。「確定反撃の採用を解除」（**既存 `DELETE /api/combo-punishes` を使用**）。画面下部に「区分を判定できない反撃（N 件）」。**※当初あった「使わないので隠す」は 2026-07-26 の開発者フィードバック 4 で撤去（§8.5）。**
- `HiddenItemsPanel.tsx`（新規）：pruning と curation を**別セクション**で表示・解除（粒度の括弧書きは §8.5 の項目 5 で削除）。
- `PunishTree.tsx`：「自動判定できない相手技」の配下に「**登録済みの確定反撃**」見出し付きで表示（成立ツリーと混ぜない）。
- `PunishListPage.tsx`（新規）・`router.tsx`・`Header.tsx`。
- **`hit_type` の 4 値リテラルを新規定義していない**（`HIT_TYPE_LABELS` を `labelFor` 経由で参照）。
- **ブラウザストレージ不使用**。選択状態は URL クエリ（`self`/`opp`/`guard`/`tab`）に保持。

### 3.3 invalidate ヘルパーの拡張（§3.3-5 への回答）

既存の非公開ヘルパー `useInvalidatePunishFinder()` を **`useInvalidatePunish()` に改名し、`[punish-finder]` と `[punish-list]` の両キーを無効化**するよう拡張した。全 8 mutation が相乗りする。

**理由**: 8 操作はいずれも**両画面に影響し得る**（探す画面での採用 → マイリストに行が増える／隠したもの管理での pruning 解除 → 探す画面に技が戻る）。片側だけ無効化する組み合わせを作ると必ずどちらかが stale になる。非公開関数のため外部影響はなく、**新しい流儀を増やさず既存ヘルパーを拡張する形**を採った。

---

## 4. 自己テスト結果

| 区分 | 結果 |
|---|---|
| `go test ./...` | **全 green** |
| `cd web && pnpm test`（vitest） | **116 files / 832 tests 全 green**（初版 827 ＋ レビュー取り込み 3 ＋ フィードバック対応 2） |
| `pnpm lint`（＝`tsc --noEmit`） | **green**。E2E 側 `tsc -p e2e/tsconfig.json` も green |
| `make e2e` | **45/45 pass**（詳細は下記） |

### 4.1 E2E（`make e2e`・**pin 一致環境で実行**）

Playwright chromium は `~/.cache/ms-playwright/chromium-1223` にインストール済みで、`make e2e` が `playwright install chromium` を実行してから走る **pin 一致環境**。回避手段は不要だった。

**追加 spec の単独実行結果（受理条件・2026-07-26 実行）**

```
cd web && pnpm e2e m18-03a-punish-mylist.spec.ts
→ Running 3 tests using 1 worker … 3 passed (6.7s)
```

**3/3 pass・retry 発生なし・flaky なし。** 既存スイートの不安定さ（§4.2 の SQLite 書き込み競合）とは独立に、**本サブの追加 spec 自体は単独で安定して green** である。フルスイート（`make e2e`）でも 45/45 pass。

- **A（1 本動線・E-20）**: 採用 → マイリストに出る → **curation（API 経由）で隠す** → 消える → 「隠したもの管理」で解除 → 戻る。あわせて**レシピ表示**と、**採用解除で curation が孤児にならない**ことも検証。<br>※ 当初は UI の「使わないので隠す」を押す形だったが、**同導線を §8.5 項目 4 で撤去したため API 経由へ組み替えた**（BE の表示制御と解除導線は温存されており、検証内容は等価）。
- **B（片道操作の解消）**: pruning → 探す画面から消える → マイリストの隠したもの管理で解除 → 探す画面に戻る。
- **C（開発者確定分）**: `hit_type` が `normal` と **NULL** の採用が**どちらのタブにも出ず**、第3セクションに出る。

### 4.2 既存 E2E の状況（**正直な報告**）

**フルスイートは E2E 実行環境の SQLite 書き込み競合により、本サブの変更と無関係に不安定である。**これは**本サブ以前から存在する**。

**切り分けの実測**（`pnpm e2e --grep-invert "M18-03a"` ＝ 本サブの spec を除外したベースライン）:

| 実行 | 結果 |
|---|---|
| ベースライン（M18-03a spec を除外） | **1 failed ＋ 2 flaky**（`m17-01-media-fields` / `character-default` / `m17-05c-fix-output`） |
| M18-03a 込み・最終形 | **45 passed（うち 1 flaky が retry で吸収）** ／ その前の試行では 2 flaky |

失敗の様態はいずれも `{"error":{"code":"internal_error","message":"コンボ作成中にサーバーエラーが発生しました"}}`＝**並列 worker からの SQLite 書き込み競合**であり、失敗する spec は実行ごとに変わる（PDF 系・CSV 系・presence-detection 系など本サブと接点のないもの）。**M18-03a の spec が原因ではない**ことは上記ベースラインで確認済み。

**本サブ側で行った緩和**: 追加 spec が**相手技へ一切書き込まない**よう設計を変更した。当初は M18-02 spec と同様に相手技の `recovery` を PATCH していたが、これが M18-02 spec と同じ move を掴んで版衝突を起こしていた。**飛び道具（ken `hadoken_light`・`damage=600` / `is_projectile=1`）を相手技に使う**ことで、書き込みゼロで「自動判定できない相手技（distance_dependent）」に必ず落ちる決定論を得た。結果、本サブの spec は `moves` へ 1 回も書き込まない。

> **申し送り**: E2E 実行環境の SQLite 書き込み競合そのものは本サブのスコープ外のため未着手。`retries: 1` で概ね吸収できているが、worker 数か `busy_timeout` の見直しを別途起票することを推奨する。

---

## 5. 品質チェック（DoD §7.3）

- [x] **新規マイグレを作っていない**（`migrations/` 末尾は 000041 のまま。`git status` に新規 SQL なし）
- [x] **新テーブル・新列を追加していない**
- [x] `DuplicateKey` / `CalcRecipeHash` / `RecomputeComboCache` / `model.Combo` / `combos` の INSERT 22 列が**不変**（`internal/seedgen` も未改変。golden green）
- [x] **`hit_type` の 4 値リテラルを新規に定義していない**（BE は `model.HitType*`、FE は `HIT_TYPE_LABELS` を参照）
- [x] 走査規則を FE に二重実装していない
- [x] `ComboEditor` の Props 契約と `location.state` のキー（`punishReturn` / `punishContext`）が不変
- [x] **M19-01 の資産（`internal/service/setplay/` ・ `web/src/features/setplay/`）に触れていない**
- [x] materialize / FR301 / 案C / export 整合を**前倒し実装していない**

---

## 6. スコープ外だが必要だった変更（**要確認**）

**`web/src/components/Header.tsx` のデスクトップ nav に 1 クラス追加した。**

- **何が起きたか**: 指示書 §2.1-11 のとおり `NAV_LINKS` に「確定反撃マイリスト」を 1 行足したところ、**既存 E2E が 15 本失敗**した。原因は nav が 13 本目で 1280px 幅（Playwright の Desktop Chrome）に収まらなくなり、**はみ出した nav が本文を覆って全画面のクリックが通らなくなった**こと。nav リンクを一時的に外すと 15 本すべて green に戻ることで因果を確定した。
- **対処**: `<nav className="hidden sm:flex items-center gap-4">` に **`min-w-0 overflow-x-auto whitespace-nowrap`** を追加し、はみ出しを nav 内スクロールに閉じ込めた。**収まる幅では見た目は従来どおり**で、既存 E2E は全 green に復帰。
- **なぜスコープ外に踏み込んだか**: リンク追加は指示書の要求であり、それが**全画面のクリックを壊す**以上、リンクだけ足して放置する選択肢が無かったため。共有コンポーネントへの変更ではあるが、**1 クラス文字列の追加**に留めている。
- **確認いただきたい点**: この degrade 方針（nav 内横スクロール）で良いか。代替として「デスクトップ nav の表示ブレークポイントを上げてドロワーへ倒す」案があるが、1280〜1535px の利用者が横並びナビを失うため採らなかった。

**あわせて、新規 mutation に `onError` トーストを追加した**（`MoveEditGrid.tsx:131` と同じ house pattern）。解除の失敗が黙って握られると「解除したのに隠れたまま」に見え、本サブの目的（片道操作の解消）が崩れるため。

---

## 7. DES 反映要点（**製造は DES 本体を直接編集していない**。反映は中央）

1. **DES-002 §4.2**: 新 endpoint 3 本（`GET /api/punish-list` / `POST`・`DELETE /api/combo-punish-curations`）を追加。既存 2 本の挙動追記＝**`DELETE /api/combo-punishes` は同一キーの curation を同一トランザクションで削除する**（シグネチャ不変）／**`GET /api/punish-finder` は `manualReviewNodes[].registeredCombos` を返す**（後方互換）。
2. **DES-005**:
   - **画面21「確定反撃マイリスト」**（`/punish/list`）を新設。§2 画面一覧へ追加し、**「画面5 マイコンボとは別系統」の 1 行**を添える。
   - §5.20 **既知の限界 1（pruning の解除 UI が無い）は解消済みへ更新**（「隠したもの管理」から解除でき、E2E B で往復を実証）。
   - §5.20 **既知の限界 2（自動判定できない相手技の既登録が見返せない）は「解消済み」と書かない**。**表示側は実装済だが、そこへ至るデータを UI から作れない**ため、ユーザーから見た限界は残る（§8.5 の項目 7b・`followup-backlog` §I-(c)）。**「表示側は実装済・登録導線は M18-03b」**の形で反映する。
   - **M18-overview §2.1-g（curation で非採用を隠す）は未達**。開発者裁定で登録導線を撤去した結果、`POST /api/combo-punish-curations` が UI から到達不能になり、「使わない反撃」セクションは通常操作では常に空。**表・API・除外ロジック・解除導線は温存**しており、UI を戻せば即機能する。**本体の暫定案＝ M18-03b で materialize の変換導線の隣に再設計**（「変換する／変換せず使わない」が同じ画面に並ぶのが自然で、裁定の趣旨とも噛み合う）。
   - **新規事項**: マイリストに「**区分を判定できない反撃（N 件）**」セクションを持つこと（両タブ共通・画面下部・折りたたみ）。**これは指示書 v1.0.1 に無く、2026-07-26 のチャットで開発者が確定した内容**であり、指示書側にも事後反映が必要。
3. **DES-003 §3.17**: `combo_punish_curations` の**初めての消費者が現れた**（表が未使用でなくなった）。
4. **CLAUDE.md §10.X**: 本サブはブラウザストレージを使用しないため**追記不要**（選択状態は URL クエリ）。

---

## 8. 事後確認事項への回答（指示書 §10-1）

**論理削除済みコンボの扱い**: §4.3-2 の現行案どおり**マイリストに出さない**で実装した。

> **2026-07-26 追記（レビュー指摘により補強）**: 当初「§3.3-3 の実測が 0 件のため実害なし」と書いたが、**これは母数（`combo_punishes`）が 0 行であることに由来しており、将来の実害を否定する根拠になっていない**。実査で次が判明したため、判断材料を差し替える。
>
> **論理削除は「ゴミ箱に入れた場合」だけで起きるのではない。** `internal/service/combo/service.go` のとおり、**識別キー変更を伴う編集（PUT）は旧コンボを `deleted_at` で論理削除して新コンボを INSERT する**。そして `combo_punishes` / `combo_punish_curations` を新コンボへ引き継ぐコードは**存在しない**（`internal/service/combo/` ・ `internal/repository/combo/` に `combo_punish` 参照 0 件。`setups` は `SetupCarryOptions` で引き継がれるが punish は対象外）。
>
> したがって **ユーザーがコンボを編集しただけで、その採用がマイリスト・隠したもの管理・探す画面の既登録表示のすべてから同時に消える**。ゴミ箱にも「反撃として採用されていた」情報は出ない。指示書 §10 の事後確認 1 が想定していたのは「ゴミ箱に入れた場合」だが、**実際にはより頻度の高い「編集した場合」でも同じ状態が発生する**。
>
> **本サブでは対処しない**（指示書 §2.2 が `model.Combo` ・ `combos` の INSERT 列 ・ combo サービスを凍結しており、引き継ぎ実装は明確にスコープ外）。**処遇の判断を M18-03b または中央へ送る**。処遇候補は (1) 引き継ぎ実装 (2) 編集時の注記・警告 (3) 許容の明文化。`docs/handover/followup-backlog.md` §I-(b) `combo-punish-carryover-on-edit` として起票済み。
>
> なお **materialize（M18-03b）は `combos` の INSERT 経路と `combo_punishes` を同一トランザクションで扱う**ため、採用の引き継ぎ規則をそこで併せて決めるのが自然である。

---

## 8.5 開発者フィードバック対応（2026-07-26・実機画面確認後）

レビュー取り込み後、開発者が実機で画面確認を行い 9 件のフィードバックを提示した（言及の無い項目は合格）。方針は「全対応は不要、実施可能なものを切り分ける」。

| # | 内容 | 対応 |
|---|------|------|
| 1 | pruning トーストに再表示先を明記 | **実施**。description に「確定反撃マイリストの『隠したもの管理』から再表示できます」 |
| 2 | 一時非表示 tooltip の「再走査」が分かりにくい | **実施**。「この端末のみ・画面更新で戻ります」へ |
| 3 | 一時非表示がアイコンのみで分かりにくい | **実施**。アイコン + 「一時非表示」テキストへ。※開発者は当初 pruning=DB／curation=一時と理解していたが、**実際は pruning・curation とも DB 永続**で、アイコンのみのボタンは第 3 の仕組み（ブラウザ内 `useState`）である旨を報告済み |
| 4 | マイリストの隠す機能は事故になるので削除 | **実施**。UI 導線のみ撤去し、BE・「隠したもの管理」の解除導線は温存 |
| 5 | 「(コンボによらない)」「(このコンボだけ)」が不自然 | **実施**。括弧書きを削除 |
| 6 | 「(偽陽性を含みます)」は一般向けでない | **実施**。削除 |
| 7 | コンボのレシピを表示したい | **実施**。探す画面の孫コンボ・既登録、マイリストの 3 箇所。`model.ExtractDefaultRecipe` を新設（抽出の 3 コピー目を作らない）。`recipe_cache` は**既存列を SELECT 句に足すだけ**で**マイグレ 0 本は維持** |
| 8 | 編集で確定反撃から消える件を警告したい | **申し送り**（開発者確定）。`followup-backlog.md` §I-(b) を強化 |
| 7b | 手動確認レーンの登録導線が未接続（新規発見） | **申し送り**（開発者確定）。`followup-backlog.md` §I-(c) を新設 |
| 9 | 失敗トーストが確認できない | **回答のみ**（コード変更なし）。バックエンドを停止してから操作すると `onError` が発火する |

### 開発者による再確認の結果（2026-07-26）

項目 1〜6 は実機で確認いただき合格。**項目 7（レシピ表示）で不具合が 1 件見つかり修正した。**

- **事象**: 探す画面の**成立ツリーの孫コンボにだけレシピが出なかった**（マイリストと手動確認レーンの既登録では出ていた）。
- **原因**: `punishfinder` の pass2 で `ComboNode.Recipe` への**代入が入っていなかった**。型にフィールドは追加したが、代入を差し込む一括置換がインデント不一致で**silent に失敗**しており、コンパイルも既存テストも通ってしまっていた（未代入＝ゼロ値の空文字となり、FE 側の「空ならレシピ行を出さない」分岐に吸収されたため表面化しなかった）。
- **修正と再発防止**: 代入を追加し、**レシピを出す 3 箇所すべてに回帰テストを追加**した（Go: `TestScan_GrandchildCombosCarryRecipe`／FE: 孫コンボ・手動確認レーンの既登録）。`recipe_cache` 未生成時に空文字となりレシピ行を出さないことも併せて固定。**修正後に開発者が実機で表示を確認済み。**
- **教訓**: 「型を足す」「代入する」「表示する」の 3 段のうち、**中間の代入だけが抜けても静かに通る**（ゼロ値が正常系の分岐に吸収される）。フィールド追加時は表示箇所ごとにテストを張ること。

**Header ナビの degrade 方針（`min-w-0 overflow-x-auto`）は開発者承認済み**（2026-07-26）。設計伝達レポート §1-2 の「追認を求める」は解消。

**未確認で残るもの**: 探す画面「自動判定できない相手技」配下のレシピ表示。**現状 UI からデータを作れない**ため（§I-(c) の未接続導線）、実機確認は M18-03b で導線が繋がってからとする。単体テストでは担保済み。

### 実機確認環境についての注意（原因特定済み）

開発者から「リュウ vs ケンの弱波動拳に、登録した覚えのないものが出ている」との報告があり実査した。

- **dev DB**（`~/.local/share/combomgr/combomgr.db`）の `combo_punishes` は **0 行**。
- **E2E 用の使い捨て DB**（`web/e2e/.tmp/combomgr-e2e.db`）に `hadoken_light`(ken) 宛の登録が 2 件（memo が `e2e-unclassified-normal-…` / `e2e-unclassified-null-…`）＝**本サブが追加した E2E テスト C のフィクスチャ**。
- 実行中プロセスを確認したところ、開発者の `go run ./cmd/combomgr` が **ポート 47390（E2E 専用ポート）** で listen していた。つまり `COMBOMGR_DB_PATH` / `PORT` が E2E 用の値のままで、**dev サーバーが E2E DB を見ている**状態だった。
- **手動確認は既定ポートの dev サーバーで行う必要がある**。E2E の使い捨て DB は実行後も残る設計のため混同しやすい。

## 9. コミット一覧

**main..HEAD = 17 commits**（先頭 `8904c7e`・末尾 `5930e77`）。段階別の要点は次のとおり。

| 段階 | commit | 内容 |
|---|--------|------|
| 実装 | `8904c7e` | repository: curation 配線とマイリスト取得クエリ、`RemovePunish` のトランザクション化 |
| 実装 | `828aabc` | `internal/service/punishlist` 新設 |
| 実装 | `4b64318` | punishfinder: 自動判定できない相手技へ既登録を載せる（§4.5） |
| 実装 | `1f6923d` | api: `punish-list` と curation の endpoint、main.go 配線 |
| 実装 | `ccea983` | web: 画面21・隠したもの管理・区分不明セクション |
| 実装 | `7eac1c9` | E2E A/B/C 追加、Header はみ出し回帰の修正、onError トースト |
| 報告 | `63419aa` / `dc668d6` | 完了報告 / 設計伝達レポート |
| レビュー取り込み | `10fd2af` / `9408288` / `127f273` / `c31fd46` | 中 3 件・低 6 件の反映と採否理由の記録 |
| フィードバック対応 | `95eb27b` / `f363b58` / `9cfc115` / `21cc967` / `5930e77` | 項目 1〜7 の実装、申し送り、`config.toml` 汚染の起票、E2E assert 修正、**レシピ未表示の修正** |

**リモート反映済み**（2026-07-26・**開発者が実施**。`origin/wt/m18-03a` = `0ee6c74` で HEAD と一致・差分ゼロを確認）。製造からは行っていない（CLAUDE.md §7 が機械許可するのは `claude/` 名前空間のブランチのみで、本ブランチは対象外）。**本体側の一次受けは `origin/wt/m18-03a`**。main へのマージは引き続き開発者が行う。

---

*以上、M18-03a 完了報告。準拠範囲＝指示書 v1.0.1 ＋ 2026-07-26 チャット確定分（第3セクション）。CHANGE-088 消費・マイグレ 0 本。*

---

## 10. 本体側の判定と受理条件（2026-07-26）

**判定＝条件付き受理。** 凍結項目は全て証跡付き green（`internal/model/` 差分ゼロ／combo 3 層とも差分ゼロ／マイグレ 0 本／M19-01 非接触／`ComboEditor` 不変／ブラウザストレージ不使用／`hit_type` リテラル 4 箇所目なし）、レビューも重大ゼロ。**条件が付いたのは品質不良ではなく、実装完了と機能到達が一致していない箇所が 2 つある**ため（それを明示せずに DES へ「解消済み」と書くと正典が事実と食い違う、という指摘）。

### 10.1 指摘への対応

| # | 指摘 | 対応 |
|---|------|------|
| 1 | curation の登録導線が消え **M18-overview §2.1-g が未達**。endpoint が到達不能で「使わない反撃」は永久に空 | §7-2 と設計伝達レポート **§1-9** に事実として明記。本体の暫定案（03b で materialize の変換導線の隣に再設計）も記録 |
| 1b | 設計伝達レポート **§6-3 が撤去済みの導線を手順に書いている**（§1-8 追記時の更新漏れ） | **修正済み**。現行仕様（通常操作で作れるのは pruning だけ／「使わない反撃」は常に空でよい）へ書き直し、訂正である旨も明記 |
| 2 | §4.5 は実装済みだが到達不能。**DES-005 §5.20 の既知の限界 2 を「解消済み」と書けない** | DES 反映要点を**限界 1 と 2 で分割**し、限界 2 は**「表示側は実装済・登録導線は M18-03b」**へ訂正（§7-2・レポート §1-4／§5） |
| 3 | ナビ 13 本目の件は拾い物。対処は妥当だが対症療法 | 既に §6 とレポート §1-2／§3-2 に記録済み。**degrade 方針は開発者承認済み**。ナビ項目数上限の情報設計は中央で設計課題として起票 |
| — | 本体の設計ミス 2 点（query 名の 2 流儀／編集経路の想定漏れ） | 本体が自認。レポート **§3-3／§3-8 に「本体自認」を追記**して経緯を残した |

### 10.2 受理条件 3 点の充足状況

| 条件 | 状況 |
|---|---|
| §3.3-1 の grep 実査結果を実値で | **充足**。本報告 §1-1 に既載（全 10 ヒットのファイル別内訳・repository/service/api/web は 0 件）。本体が読む**設計伝達レポートには無かった**ため、同レポート **§4-1** へ転記した |
| 本サブ追加 spec の E2E 結果を単独で | **充足**。`pnpm e2e m18-03a-punish-mylist.spec.ts` → **3 passed（retry なし・flaky なし）**。§4.1 と設計伝達レポート **§4-2** に、コマンド・日付・各 spec の内容付きで明記 |
| push | **充足**。2026-07-26 に**開発者がリモート反映を実施済み**（`origin/wt/m18-03a` = `0ee6c74`・HEAD と一致・差分ゼロ）。製造からは行っていない（CLAUDE.md §7 の機械許可は `claude/` 名前空間のみで本ブランチは対象外） |

### 10.3 開発者判断（2026-07-26 確定）

- **push の方法** → 開発者が `wt/m18-03a` をそのままリモート反映（**2026-07-26 実施済み**）。
- **「手動で確定反撃を登録」ボタンの文言**（本体からの問い「03b で閉じるか、それまでに文言を変えるか」）→ **03b まで現状維持**。M18-03b で登録まで繋ぐ際に文言も含めて整える。指示書 §2.2 が探す画面の新規登録導線を凍結しているため、今は触らない。申し送りは `followup-backlog` §I-(c) に記録済み。
