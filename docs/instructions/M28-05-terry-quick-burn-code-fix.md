# 指示書 M28-05: terry `quick_burn_light` の `move_code` 是正

| 項目 | 内容 |
|------|------|
| 文書ID | M28-05 |
| バージョン | **1.0.0**（2026-09-06） |
| 作成日 | 2026-09-06 |
| 作成者 | 設計担当 Claude（設計卓／フェーズ4 期） |
| 対象マイルストーン | **`M28`**（破壊的変更の窓）。上位＝`docs/instructions/M28-overview.md` v1.12.0 |
| 推奨モデル | **標準実装**（**★1 行の改名だが、動く golden は 4 本ある**。実モデル名は `docs/human-notes/model-allocation.md`） |
| Plan Mode | **必須**（`CLAUDE.md` §9＝データ移行を伴う変更） |
| レビュー | **必要**（チェックリストは着手承認の手番で設計卓が起こす＝`D-736`） |
| CHANGE 消費 | **0 本**（**★`docs/design/` の名指しは 0 件であることを `M28-04` が実査済み。⇒ 出たら止めて請求する**＝`D-293`） |
| マイグレ消費 | **1 本＝`000106`**（**★`M28-04` が未消費のまま返した番号である**） |
| 前提サブ | **無し**（**★`M28-04` の完了は本サブの前提ではない。⇒ 独立して走る**） |
| 射程 identity | **1 件**——`terry-quick-burn-light-move-code-error` |
| 配置 | `docs/instructions/M28-05-terry-quick-burn-code-fix.md` |
| 出力 | `docs/progress/M28-05-completion-report.md` |

---

## 0. この指示書の特殊性

### 0.1 ★★`M28` の窓のうちに片付ける必要がある

**`move_code` のリネームは配布 DB の識別子が変わる。⇒ `M28` が「破壊的変更の窓」である族そのものである**（`D-725`）。

**★★公開後に変えると利用者のデータに影響しうる。⇒ 公開前に済ませる。**

### 0.2 ★★誤りであることは確定している。調べ直さない

**開発者のインゲーム確認（2026-09-06）＝「`quick_burn_light` として登録されているなら、それは誤りで、`quick_burn` に直す必要がある」。⇒ terry の `quick_burn` は強度の区別が無い技である。**

**★`sonic_break_light` → `sonic_break`（`M19-04c` 節 A）とまったく同型である。**

### 0.3 ★★前例より影響範囲が広い。golden は 4 本動く

| 先例 | 本サブ |
|---|---|
| **`sonic_break_light` は `is_derived=1` で `move_commands` 索引に非搭載** | **★★`quick_burn_light` は `is_derived=0` かつ `command` 非空のため索引に載っている**（`migrations/000035_seed_move_commands.up.sql` に `'quick_burn_light', '214LP'`） |
| **動く golden は 1 本** | **★★動く golden は 4 本** |

| # | golden | 固定しているテスト |
|---|---|---|
| 1 | `000026`（moves ＋ `official_ja_move` 別名） | `TestGolden_CommittedMigrationMatchesRegeneration` |
| 2 | `000035`（command 索引） | `TestGolden_MoveCommandsMatchesRegeneration` |
| 3 | `000072`（numeric alias） | `TestGolden_M2002NumericAliasesMatchesRegeneration` |
| 4 | `000073`（srk alias） | `TestGolden_M2002SRKAliasesMatchesRegeneration` |

### 0.4 ★DB 側の追随は要らない

**`move_commands` も `preset_aliases` も `moves.id` 参照であり、`code` の改名で紐付きは切れない**（`DES-003`）。

**⇒ 動くのは「`code` で INSERT 先を解決している golden SQL」だけである。**

---

## 1. 前提として読むもの

| # | 資料 | 読む理由 |
|---|---|---|
| **1** | **`docs/change-notes/CHANGE-163-notification.md` §1** | **★★golden の破壊確認は射程の全区分から 1 件ずつ取る。⇒ 本サブは 4 区分ある** |
| 2 | `SUPP-001` §5.5.4 の規約 (6)〜(10) | **★とくに (6)（素の `UPDATE` は 0 行に当たって成功する）と (10)** |
| 3 | `migrations/000063_correct_moves_data_m1904c.up.sql` 節 A | **★同型の先例。⇒ 書き方を写せる** |
| 4 | `DES-004` §2.1（変種サフィックス表） | **正しい code の導出根拠** |
| 5 | `docs/handover/code-facts.md` | 実装の現在地 |

---

## 2. やること

### 2.1 ★★母数を出す（**最初の成果物**）

**★`M28-04` が実査済みであり、結果は下表である。⇒ 再実査して一致することを確かめるだけでよい。一致しなければ止めて報告すること。**

| 走査先 | `M28-04` の実測 |
|---|---|
| `character_data/` | **2 件**（`terry.csv` の `quick_burn_light` と `quick_burn_od` の対） |
| `migrations/` | **10 件** |
| `internal/` | **0 件** |
| `web/`（src・e2e とも） | **0 件** |
| `scripts/` | **0 件** |
| `docs/` | **16 件**（**★歴史記録。⇒ 直さない**） |
| **`docs/design/`** | **★★0 件。⇒ CHANGE 不要** |

**★★改名先 `quick_burn` は空きである**（`grep -c '^terry,quick_burn,' character_data/terry.csv` = 0）**。⇒ `UNIQUE (character_id, code)` の衝突も、改名の順序制約も無い。★`sonic_break` のときのような `NOT EXISTS` の順序依存は要らない。**

### 2.2 是正

| # | 内容 |
|---|---|
| **★★1** | **`character_data/terry.csv` の 1 行を `quick_burn_light` → `quick_burn` へ。★CSV を直さずに DB だけ直さないこと**（次の seed 再生成で戻る） |
| **★★2** | **DML マイグレ 1 本**（`000106`）**。`UPDATE moves SET code = 'quick_burn' WHERE character_id = (terry) AND code = 'quick_burn_light'`。★`NOT EXISTS` ガードを付けること。★DDL は書かない** |
| **★★3** | **`WHERE` を `code` だけで絞らないこと**（`moves.code` はテーブル全体では一意でない）。**⇒ `character_id` と対で絞る** |
| **★4** | **`quick_burn_od` は改名しない**（`quick_burn` / `quick_burn_od` の既存形へ合流する） |
| **★★5** | **★★命名規約に従うこと**——**層 B のマイグレは `NNNNNN_data_*.sql`**（`CHANGE-158`）**。★本サブのマイグレは SF6 の事実そのものを直すので層 B である。⇒ `data_` を持たないと `scripts/check-migration-license.sh` の検査 (4) が赤になる** |
| **★6** | **down の中身と、down で何が失われるかを報告に書くこと** |

### 2.3 golden の再生成

| # | 内容 |
|---|---|
| **★★1** | **4 本すべてを再生成すること**（§0.3）。**★1 本だけ直して緑になったら、それは残り 3 本を再生成していないだけである** |
| **★★2** | **動いた理由を報告に書いてから更新すること。⇒ 黙って上書きしない** |

### 2.4 ★★破壊確認（**`CHANGE-163` §1 の規約 (10) を当てる**）

| # | 壊すもの | 期待 |
|---|---|---|
| **★★1** | **`character_data/terry.csv` を改名前へ戻して `-check`** | **`DIFF` / exit 1 になること。★terry は `FirstWaveOrder` の第一波なので引数なしで捕まる** |
| **★★2** | **`000035` の索引だけを改名前の値へ戻す** | **`TestGolden_MoveCommandsMatchesRegeneration` が赤になること。★★これが本サブ固有の確認である**——**先例（`sonic_break_light`）には索引が無かった** |
| **★★3** | **マイグレのファイル名から `data_` を外す** | **`scripts/check-migration-license.sh` が赤になること** |

**★★1 だけで済ませないこと。⇒ `-check` が守るのは `000026` だけであり、索引・別名の 3 本は守らない**（`CHANGE-163` §1）。

---

## 3. やらないこと

| # | 内容 |
|---|---|
| **★★1** | **全キャラ点検**（`D-161`。**★同型を見つけたら報告するだけ**） |
| **★★2** | **`docs/` の歴史記録を直すこと**（16 件は歴史記録である） |
| **★★3** | **`quick_burn_od` を改名すること** |
| **★★4** | **`code` だけで `UPDATE` を絞ること** |
| **★5** | **golden を理由なく上書きすること** |
| **★6** | **`docs/design/` の編集 ／ `followup-backlog.md` の §J 以外の編集 ／ CHANGE 番号・マイグレ連番の自採番** |

---

## 4. ★★危険（**先に読むこと**）

| # | 危険 | なぜ危ないか |
|---|---|---|
| **★★1** | **golden を 1 本だけ再生成する** | **残り 3 本が古いまま緑に見える。⇒ `-check` は `000026` しか見ない** |
| **★★2** | **素の `UPDATE` を書く** | **0 行に当たっても成功し、エラーにならない**（`SUPP-001` §5.5.4 (6)）**。⇒ `NOT EXISTS` ガードで「当たったこと」を確かめる** |
| **★★3** | **CSV を直さずに DB だけ直す** | **次の seed 再生成で戻る。★戻ってもエラーは出ない** |
| **★4** | **`code` だけで絞る** | **他キャラに同名の code が在れば巻き添えになる。★巻き添えは静かに起きる** |
| **★5** | **マイグレ名に `data_` を付け忘れる** | **層 A へ静かに落ちる**（`check-migration-license.sh` の検査 (4) が止める） |

---

## 5. テスト

| # | 内容 |
|---|---|
| **★★1** | **`go test ./...` が緑**（**★golden 4 本のテストを含む**） |
| **2** | **`cd web && pnpm test` / `make e2e` が緑。★`make e2e` はリポジトリルートで実行すること**——**`web/` で実行すると `Nothing to be done for 'e2e'.` が返り、1 本も走らないのに赤も出ない**（`M28-04` が踏んだ） |
| **★★3** | **§2.4 の破壊確認 3 件を実走すること** |
| **4** | **常設検査が緑**（**★`check-artifact-integrity.sh` を 1 本目に回す。★`check-migration-license.sh` も回す**） |

---

## 6. 完了条件

1. **§2.1 の母数が `M28-04` の実測と一致していること**（一致しなければ止めて報告）。
2. **`character_data/terry.csv` と DB の両方が直っていること。**
3. **golden 4 本が再生成され、動いた理由が報告に在ること。**
4. **§2.4 の破壊確認 3 件が実走されていること。**
5. **§5 が緑であること。**
6. **`docs/design/` に反映が要る箇所が一覧になっていること**（**★0 件のはずである**）。
7. **`docs/progress/progress-log.md` へ追記されていること。**

---

## 7. ★開発者への確認事項

**★★無し。⇒ 誤りであることも、正しい code も、影響範囲も確定している**（§0.2 / §0.3 / §2.1）。

**★同型を見つけたら報告すること。⇒ 直さない**（`D-161`）。

---

## 8. 参照ドキュメント

| ID | パス | 参照する箇所 |
|----|------|------------|
| — | `docs/change-notes/CHANGE-163-notification.md` | **§1（golden の破壊確認の射程）** |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | **§5.5.4 の規約 (6)〜(10)** |
| DES-003 | `docs/design/03-data-model.md` | §3.3（`moves`）／ §3.14（`move_commands`） |
| DES-004 | `docs/design/04-notation-spec.md` | §2.1（変種サフィックス表） |
| — | `docs/handover/followup-backlog.md` | `terry-quick-burn-light-move-code-error` |
| — | `docs/handover/code-facts.md` | 実装の現在地 |

---

*以上、M28-05 指示書 **v1.0.0**。* **★★本サブの落とし穴は「1 行の改名だから軽い」と読むことである。** **★動く golden は 4 本あり、`seedgen` の引数なし `-check` が守るのはそのうち 1 本だけである**（§0.3 / §2.4）**。⇒ 1 本だけ再生成して緑を見たら、それは残り 3 本を再生成していないだけである。** **★★もう 1 つは「`M28` の窓のうちに」という時間の制約である**（§0.1）**——`move_code` のリネームは配布 DB の識別子が変わるため、公開後には動かせない。**
