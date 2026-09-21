# M24-09b 完了報告: テスト資産と残リファクタ

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M24-09b-test-assets-and-residual-refactor.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M24-09b-review-checklist.md` v1.1.0 |
| ブランチ | `claude/m24-09b-implementation-507r2d` |
| 着手基点 | `210ab49` |
| 実施日 | 2026-08-25 |
| CHANGE | **消費 0 件**（§9.4 の 3 条件はいずれも不発動。判定は §10） |
| マイグレ | **消費 0 本 ／ 既存マイグレの本文は 1 バイトも変更なし** |
| 新規依存 | **0 件** |

> **★本報告は `CO-025`（E2E flake）と `CO-007`（`000012` down の orphan 判定）の調査結果の正本である**（指示書 §7.5）。

---

## 0. 結論（先に 5 項目の可否）

| # | ID | 実施したか | 結末 |
|---|---|---|---|
| **1** | **`CO-025`** E2E timing flake クラスタ | **調査のみ・実装しない** | **指示書 §4.1 の表の第 2 行に該当**。3 spec は 4 回とも 0 flaky。落ちたのは別の spec 1 組で、`--workers=1` では緑（＝timing ではなく競合）。**開発者承認済み**（2026-08-25） |
| **2** | **`CO-007`** `000012` down の orphan 判定 | **判定のみ**（仕様どおり） | **orphan は構造上ありうる。実測でも出た。** マイグレ本文は 1 バイトも変更していない |
| **3** | **`CO-006`** inline INSERT のパターン化 | **部分実施** | 共通ヘルパを新設し **16 か所 / 4 ファイル**を寄せた（149 → 133）。**残り 133 か所は寄せていない・理由は §6** |
| **4** | **`CO-012`** config の TOML 再エンコード＋アトミック書込の重複 | **実施** | 1 本へ寄せた。**★指示書が挙げていた場所と実体が違った**（§3.3-4） |
| **5** | **`calc-recipe-hash-three-implementations`** | **実施** | 3 実装 → 1 本。`canonicalModifiersJSON` / `emptyRecipeHash` も同じ手番で統合 |

---

## 1. §3.3 着手前の実査（9 件・全件実施）

### #1 `M24-01` との `web/e2e/` 交差 ／ ポート

| 項目 | 実測 |
|---|---|
| 共通 fixture | **存在しない。** `web/e2e/` 直下は `*.spec.ts` 50 本 ＋ `tsconfig.json` のみ |
| `playwright.config.ts` | **触っていない**（`git diff --stat 210ab49 -- web/` が空） |
| ポート 47390 / 5273 | **4 回の実測すべての直前に空であることを確認**（`ss -ltn` の出力が 0 行）。最終確認でも空 |

**⇒ 交差なし。`CO-025` を実装しなかったため `web/e2e/` の差分は 0 バイトであり、`M24-01` との衝突面は最終的に消滅した。**

> **★実査範囲の限界（レビュー低-4）。** 上表の「共通 fixture は存在しない」は **`web/e2e/` 直下にファイルが無い**ことを根拠にしている。**しかし `web/playwright.config.ts` は `webServer` 1 組と `COMBOMGR_DB_PATH` 1 個を全 spec で共有する、実質の共通基盤である。** **⇒ 「fixture ファイルが無い」ことと「共有面が無い」ことは別である。** 本サブは同ファイルを触っていないため結論は変わらないが、**次に `web/e2e/` の交差を実査する指示書は、観点に `playwright.config.ts` を加えること。**

### #2 `CO-025` の実測 → §2 へ（本サブの中心のため独立節）

### #3 Go テストの inline INSERT

- **着手時の全数: 149 か所 / 35 ファイル**（`grep -rc "INSERT INTO" --include=*_test.go internal/`）
- 対象表の内訳: `combos` 40 ／ `combo_setups` 14 ／ `setups` 13 ／ `users` 10 ／ `preset_aliases` 10 ／ `combo_setup_results` 9 ／ `tags` 8 ／ `combo_tags` 8 ／ `combo_steps` 7 ／ `moves` 6 ／ `combo_punishes` 6 ／ 他 7 表
- **既存ヘルパ**: `internal/testutil/dbtest`（`Setup` / `SetupWithPath` の 2 本＝**DB 初期化のみ。行投入ヘルパは無し**）。加えて**パッケージ内ローカルの `insertXxx` ヘルパが 16 本**散在。
- **⇒ 新設せず `dbtest` へ追加した**（§3.3-3 の「既存ヘルパが在るなら新設しない」）。

### #4 `CO-012` 重複の実体 —— **★指示書の記述と食い違った**

指示書 §2.1-4 は `internal/api/config/` ／ `internal/service/config/` を挙げているが、**`internal/api/config/` に TOML 書込は 1 行も無い**（`handler.go` 117 行は DTO 変換と HTTP 応答のみ）。

実体は次の 2 本だった。

| 場所 | 関数 | 内容 |
|---|---|---|
| `internal/config/config.go:153` | `Save`（公開） | tmp 作成 → `toml.NewEncoder.Encode` → `Sync` → `Close` → `Rename`。各段のエラーで `os.Remove(tmp)` |
| `internal/service/config/service.go:440` | `writeAtomic`（非公開） | **上記と論理的に同一**。差はエラー文言 1 か所のみ（`"config: rename tmp: %w"` vs `"config: rename: %w"`） |

**「似て見えるだけ」ではなく実際に同一処理である**（`E-205` の判定を通した）。エラー文言をアサートしているテストは **0 件**。

### #5 `CalcRecipeHash` 相当の 3 実装 → §4 へ（独立節）

### #6 `migrations/000012` の内容 → §3 へ（独立節）

### #7 着手前の状態

| スイート | 着手前（`210ab49`） |
|---|---|
| `go test ./...` | **53 パッケージ ok / FAIL 0**（テスト関数 1331 本） |
| `pnpm test` | **182 files / 1829 tests passed** |
| `make e2e` | **175 passed / 0 failed**（run 1・run 3。run 2 のみ 2 failed＝§2） |

### #8 本サブが触るファイルを参照している既存テストの全数（3 系統を別々に）

| 系統 | 件数 | 内訳 |
|---|---|---|
| **Go** | **8 ファイル** | ハッシュ系 6（`infra/migration/migrate_test.go` ／ `repository/setup/repository_test.go` ／ `service/combo/duplicate_keys_test.go` ／ `service/combo/trash_duplicate_test.go` ／ `service/setplay/service_test.go` ／ `service/setup/validate_test.go`）＋ config 系 2（`internal/config/config_test.go` ／ `internal/service/config/service_test.go`） |
| **Vitest** | **0 ファイル** | 本サブは `web/src` を 1 バイトも触っていない |
| **`web/e2e/`** | **0 ファイル** | `CO-025` を実装しなかったため spec を触っていない |

### #9 `check-artifact-integrity.sh`

**着手前・完了時とも「違反なし」（exit 0）。** 検査 11 件の自己検査すべて OK ／ 生成物 4 件 OK。**⇒ §1.1.1 の前提（`check-md-emphasis.sh` の依存は `IMPROVE-01` で解消済み）は成立している。**

---

## 2. `CO-025`: E2E timing flake クラスタ —— **実測と判定**

### 2.1 実測（`make e2e` × 3 ＋ `--workers=1` × 1）

**★4 回とも直列に実行した。各回の直前にポート 47390 / 5273 が空であることを確認している**（指示書 §2.4-1 / チェックリスト §3）。**⇒ ポート衝突による汚染はない。**

| 回 | 実行形 | 結果 | 所要 | 落ちた spec |
|---|---|---|---|---|
| 1 | `make e2e` | **175 passed / 0 failed / retry 0** | 3.6m | — |
| 2 | `make e2e` | **173 passed / 2 failed** | 5.4m | `m23-09-pre-save-duplicate-dialog.spec.ts:204` ／ 同 `:291`（**両方とも retry #1 でも赤**） |
| 3 | `make e2e` | **175 passed / 0 failed / retry 0** | 3.4m | — |
| 4 | `pnpm e2e --workers=1` | **175 passed / 0 failed** | 5.3m | — （**run 2 で落ちた 2 本を含めて緑**） |

コマンド:

```bash
for i in 1 2 3; do make e2e > run$i.log 2>&1; done
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium (cd web && pnpm e2e --workers=1) > run4-workers1.log 2>&1
```

### 2.2 `CO-025` の 3 spec は 1 度も落ちていない

| ID | spec | 4 回の結果 |
|---|---|---|
| **`CO-025`** | `moves-edit.spec.ts` | **0 回** |
| **`CO-025`** | `combo-custom-states.spec.ts` | **0 回** |
| **`CO-025`** | `m12-06-draft-promotion.spec.ts` | **0 回** |

**あわせて指示書 §11-1 の 2 件も測った**（暫定案どおり観測のみ）:

| ID | spec | 4 回の結果 |
|---|---|---|
| **`CO-021`** | `m14-03b-custom-states-realdata.spec.ts` | **0 回** |
| **`CO-022`** | `m17-01-media-fields.spec.ts` | **0 回** |

**★`CO-021` と `CO-025` は 1 件ではない**（指示書 §11-1 が「同じファイルかもしれない」としていた点）。**`combo-custom-states.spec.ts` と `m14-03b-custom-states-realdata.spec.ts` は `web/e2e/` に両方実在する別ファイルである。**

### 2.3 落ちた 2 本の中身（**★これが新しい事実**）

両方とも同じ形で落ちた。

```
Test timeout of 30000ms exceeded.
Error: page.waitForResponse: Test timeout of 30000ms exceeded.
  49 |     page.waitForResponse((r) => r.url().endsWith("/api/combos") && r.request().method() === "POST"),
  50 |     page.getByRole("button", { name: "保存" }).click(),
     at createComboViaUI (web/e2e/m23-09-pre-save-duplicate-dialog.spec.ts:49:10)
```

**`POST /api/combos` が 1 度も発火していない。** 当該ヘルパは自ら次の注記を持っている。

> `createComboViaUI` の JSDoc 注記（逐語）:
> `createComboViaUI は本登録のコンボを 1 件作る(ゴミ箱に同じものが無い前提)。`

**⇒ 保存前重複ダイアログが開くと POST は出ない。** 前提が崩れた状態で呼ばれたと読むのが自然である。

### 2.4 判定 —— **timing ではなく競合。恒久対策は入れない**

**`--workers=1` で 2 本とも緑になった。** 教訓 `E-216` の基準（「隔離実行」と「直列実行」の 2 手。結果が変わるなら timing ではなく競合）にそのまま当たる。

**E2E は 1 スイートにつき使い捨て DB を 1 個だけ作り、全 worker がそれを共有する**（`playwright.config.ts` の `webServer` は 1 組・`COMBOMGR_DB_PATH` は 1 個）。**⇒ spec ファイル間でデータが干渉しうる構造である。**

**指示書 §4.1 の表の第 2 行（落ちる spec が毎回違う）に該当する。**

- **3 spec を直しても解決しない**（そもそも 3 spec は落ちていない）。
- **恒久対策は入れずに終える。** `web/e2e/` の差分は **0 バイト**。

### 2.5 ★報告のみ・未対応（開発者承認済み）

**`m23-09` の競合は本サブでは直していない**（2026-08-25 開発者承認）。理由:

1. **`m23-09` は M23 の成果物であり、本サブの割付にない**（`M24-overview` §3）。割付を製造が独断で広げない。
2. 直すなら「spec 間で判定キーが衝突しない設計」または「spec ごとの DB 分離」の話になり、規模が `CO-025` を超える。
3. **4 回で 1 回しか出ておらず、恒久対策を設計するには観測が足りない。**

**★followup に同型の未着手記録が既に 4 件ある。** `e2e-flaky-isolation`〔「3 回走らせると毎回異なる spec が 1 件落ちる／単独実行なら green」〕／ `e2e-sqlite-write-contention`(a)〔並列 worker の書き込み競合〕／ `e2e-flaky-combo-post-500` ／ `e2e-flaky-m18-03c-drainage`。

**⇒ 本サブの実測は `e2e-flaky-isolation` の記述にそのまま当てはまる。** `CO-021` / `CO-022` / `CO-025` と合わせて **7 件が同じ症状の別々の記録**である。**個別 spec の問題ではなく、スイート全体（1 個の DB を全 worker で共有する構造）の問題であるという `m23-close-report` §7-1 の見立てを、本サブの実測が支持した。**

---

## 3. `CO-007`: `migrations/000012` の down が orphan を残すか —— **判定**

**★マイグレーションの本文は 1 バイトも変更していない**（`git diff --stat 210ab49 -- migrations/` が空）。

### 3.1 up が何を作り、down が何を消すか（逐語）

**up（`000012_seed_combos_durability.up.sql`）は 4 文。**

1. `INSERT INTO combos (character_id, is_draft, position, opponent_stance, hit_type, damage, step_count, memo) SELECT ... FROM v JOIN characters ch ON ch.code = v.char_code;`
   —— AKI / ジェイミー / ガイル 各 12 件 = **36 行**。
2. `INSERT INTO combo_steps (combo_id, step_order, move_id) SELECT ... FROM s JOIN combos cb ON cb.memo = s.memo JOIN moves mv ON ...;`
   —— memo を相関キーに **96 行**。
3. `UPDATE combos SET starter_move_id = (SELECT cs.move_id FROM combo_steps cs WHERE cs.combo_id = combos.id AND cs.step_order = 1) WHERE character_id IN (SELECT id FROM characters WHERE code IN ('aki', 'jamie', 'guile'));`
4. `UPDATE combos SET recipe_cache = (...) WHERE character_id IN (SELECT id FROM characters WHERE code IN ('aki', 'jamie', 'guile'));`

**down（`000012_seed_combos_durability.down.sql`）は全文 5 行、実行文は 1 つだけ。**

```sql
-- 000012_seed_combos_durability.down.sql
-- 追加 3 キャラの耐久テスト用コンボを削除する(combo_steps は ON DELETE CASCADE で連動削除)。
-- リュウのコンボは対象外。
DELETE FROM combos
WHERE character_id IN (SELECT id FROM characters WHERE code IN ('aki', 'jamie', 'guile'));
```

### 3.2 判定 1: **down は orphan を残す**（構造上ありうる・実測でも出た）

**根拠（構造）**——000012 の時点で `combos` を参照する子表は 3 つで、いずれも `ON DELETE CASCADE` を持つ（`000001_init_schema.up.sql` の 98 / 121 / 194 行＝`combo_steps` / `combo_tags` / `combo_setups`）。

**しかし CASCADE は発火しない。** マイグレーション実行側の接続は `internal/infra/migration/migrate.go` で

```go
db, err := sql.Open("sqlite", dbPath)
```

と開かれており、**DSN に `_pragma=foreign_keys(1)` を持たない。SQLite の既定は `foreign_keys=OFF` である。**

**★これは欠けではなく意図である。** `docs/handover/architecture-patterns.md` §11 が明記している——「**マイグレーション接続が FK=OFF であることは、欠けではなく意図である**（`M23-10` 実査で確認）。**表を作り直すマイグレーションを FK=ON で走らせないための構造でもある。** ⇒ 「揃っていない」と読んで揃えにいかないこと」（`D-494`）。

**根拠（実測）**——一時プローブで 000012 まで up → 子行を仕込む → 000011 へ down し、残存行を数えた。

```
CO007 migration_conn_foreign_keys=0
CO007 before combos=36 combo_steps=96
CO007 user_combo_before=1
CO007 after combos=0 orphan_combo_steps=96 orphan_combo_tags=1 orphan_combo_setups=0
CO007 user_combo_after=0
CO007 control_conn_foreign_keys=1
```

- **`combo_steps` に orphan が 96 行残った。**
- **`combo_tags` に仕込んだ 1 行も orphan として残った**（up が作らない子表でも同じことが起きる＝実 DB では利用者のタグ付けが該当する）。
- `combo_setups` は 0 だが、これは**仕込んでいないから 0 なのであって、残らない証拠ではない**。同じ CASCADE 依存であり、行があれば同じく残る。
- 対照として `_pragma=foreign_keys(1)` の接続は `1` を返した（**FK を ON にできる環境である**ことの陽性対照。**⇒ 「0」はスクリプトの読み取り失敗ではない**）。

**★プローブは恒久テストにせず削除した。** orphan が残る現状を「仕様」として固定するテストになるためである。

**★down.sql 自身のコメント「combo_steps は ON DELETE CASCADE で連動削除」は成立していない。** ただし**本文を 1 バイトも編集しない**（`D-535`＝適用済みマイグレーションは歴史的記録である）ため、報告に留める。

### 3.3 判定 2: **down は up が入れていない行も消す**（orphan とは別種の問題）

down の条件は `character_id` だけであり、**up が入れた 36 行を特定していない**（up 側は `memo` を相関キーにしているのに、down 側は使っていない）。

**⇒ 利用者が後から作った aki / jamie / guile のコンボも消える。** 実測でも `user_combo_before=1` → `user_combo_after=0` となった。

### 3.4 ★実データを見ないと判定できない部分（明記）

- **実 DB に `combo_setups` / `combo_tags` の該当行が何行あるかは判定できない。** 本サブの実測は「この形の orphan は残る」ことを示すだけであり、**実 DB の件数を触った証拠ではない**（クラウド実行環境に dev DB が無い＝followup `dev-db-absent-in-cloud-session`）。
- **「実測で落ちなかった」を「落ちる経路が無い」とは書いていない**（教訓 `E-237`）。本節の実測はすべて**陽性**（orphan が出た側）である。
- **000012 の down が実際に運用で実行されたことがあるかは判定していない。** マイグレーションの適用履歴は `schema_migrations` にしか残らず、down の実行痕跡は残らない。

### 3.4-1 ★★2026-08-25 追補: 実 DB の数字と「実際のロールバック経路」で判定が変わった

**開発者が実 dev DB（`~/.local/share/combomgr/combomgr.db`・`mode=ro`）で 4 本の SELECT を実行した結果、全て 0 件だった。**

| 問い | 実 DB の実測 |
|---|---|
| aki / jamie / guile のコンボ | **0 件** |
| うち up 由来でないもの（`memo` 近似判定） | **0 件** |
| 対象コンボに属する子行（3 表） | **すべて 0 件** |
| 現存 orphan（3 表） | **すべて 0 件**（`M23-10` 後日談の掃除以降、増えていない） |

**★「0 件だった」で終わらせず、なぜ 0 なのかを追ったところ、§3.2 の判定に重要な限定条件が要ることが分かった。**

#### (a) `000017` が既に耐久 seed を消しており、その down は復元しない

`migrations/000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` が **aki / jamie / guile を除去している**。**★同マイグレは子行を先に明示 DELETE しており、その理由を逐語で書いている**——

> マイグレーション接続は foreign_keys=OFF（migrate.go が pragma 無しで接続。アプリ接続のみ db.go で FK=ON）。よって combos を DELETE しても子テーブル（combo_steps 等の ON DELETE CASCADE）は連鎖削除されない。**orphan を残さないため、子行を先に明示 DELETE する。**

**⇒ `000017` は §3.2 の構造的根拠を独立に裏づけているだけでなく、「正しい書き方」の実例でもある**（`000012` はそれより前に書かれており、その作法を持っていない）。

**`000017` の down は「前方専用クリーンアップ・不可逆」と明記された実質 no-op** であり、**復元しない。**

#### (b) ★実際のロールバック経路（head → `000011`）では `000012` の down は 0 行にヒットする

**一時プローブで測り直した**（head まで up → 利用者のガイルコンボを 1 件 ＋ 子行を仕込む → `m.Migrate(11)`）。

```
CO007B head_character_aki=0  head_character_jamie=1  head_character_guile=1
CO007B head_ajg_combos=0
CO007B before_user_combo=1 before_steps=1 before_tags=1
CO007B after_user_combo=1  orphan_steps=0  orphan_tags=0
CO007B after_character_aki=0  after_character_jamie=0  after_character_guile=0
CO007B orphan_combos_of_characters=1
CO007B orphan_moves_of_characters=2
CO007B user_combo_is_orphan=1
```

**理由**——`000053.down`（第三波）と `000024.down`（第一波）が **`characters` から jamie / guile を先に削除する**ため、`000012.down` が走る時点で `WHERE character_id IN (SELECT id FROM characters WHERE code IN ('aki','jamie','guile'))` の副問い合わせが空になる。**⇒ 0 行削除。orphan も作らない。**

#### (c) ★★では実害はどこにあるか——`combos` 自身が `characters` の orphan になる

**上の実測の後半が本題である。** **`orphan_combos_of_characters=1` / `orphan_moves_of_characters=2`。**

- **`guile` と `jamie` は現行ロスターのキャラである**（`000024` 第一波 ／ `000053` 第三波 で再投入済み。head の `characters` に実在）。**⇒ 利用者がこの 2 キャラのコンボを持っているのは普通のことである。**
- `000024.down` / `000053.down` はいずれも **`DELETE FROM characters ...` の 1 文だけ**で、注記は「**依存行は 000025〜000027 / 000054〜000058 の down が先に除去済み**」と書いている。**★しかしそれが指すのは seed 由来の `moves` / `preset_aliases` / `custom_states` であって、利用者が作った `combos` ではない。** seed マイグレは利用者データを知らない。
- **`combos.character_id` は `ON DELETE CASCADE` を持たない**（`000017` の注記が明記）。**⇒ FK=OFF と相まって、利用者のコンボは削除されずに残り、存在しないキャラを指したままになる。**

#### (d) 判定（**§3.2 を置き換えるのではなく、限定条件を付ける**）

| 経路 | `000012.down` の挙動 | orphan |
|---|---|---|
| **DB がバージョン 12〜16 に居るとき**（`000017` 適用前） | **36 件＋利用者分を削除する** | **★`combo_steps` / `combo_tags` / `combo_setups` に残る**（§3.2 の実測どおり） |
| **head からのロールバック**（実運用で起こりうる唯一の経路） | **0 行**（`characters` 側が先に消えている） | **`000012` は作らない。★代わりに `000024.down` / `000053.down` が `combos` / `moves` を `characters` の orphan にする** |

**⇒ `CO-007` の「`000012` の down が orphan を残すか」への答えは「**残す。ただし DB がバージョン 12〜16 に居るときに限る**」である。** **★実運用で踏む経路は (c) のほうであり、そちらは `000012` の問題ではない。**

**★これは指示書 §4.2 の射程を超える発見である。** `CO-007` は `000012` だけを対象としているが、**同じ型の欠陥が `000024` / `000053` にあり、しかもそちらは現行ロスターのキャラ＝利用者データに当たる。** 設計伝達レポート §4 へ別項目として回した。

**★言えないこと（変わらず）**——**実 DB でロールバックを実行した証拠ではない。** 上は使い捨て DB での再現であり、**開発者の実 DB は現在 head に居て、当該キャラのコンボが 0 件である**（だから今この経路を踏んでも失うものが無い）。**「今 0 件である」ことは「将来も 0 件である」ことを意味しない**——guile / jamie は現行ロスターだからである。

### 3.5 rollback 方針は決めていない

**指示書 §4.2 のとおり、判定までが本サブの範囲である。** 方針は設計卓が決める。

---

## 4. `calc-recipe-hash-three-implementations`: `CalcRecipeHash` の統合

### 4.1 統合前の所在と呼び元の全数（**★設計伝達レポート §1 にも本文で載せる**）

| # | 所在（統合前） | 名前 | 本番の呼び元 | テストの呼び元 |
|---|---|---|---|---|
| 1 | `internal/service/combo/duplicate_keys.go:45` | `CalcRecipeHash`（公開） | **10 か所**（すべて `internal/service/combo/service.go`＝`:257` / `:539` / `:643` / `:966` / `:1010` / `:1063` / `:1080` / `:1194` / `:1297` / `:1549`） | **13 か所 / 4 ファイル** |
| 2 | `internal/service/setup/duplicate_keys.go:16` | `CalcSetupRecipeHash`（公開） | **7 か所**（`service/setup/service.go` 3 ／ `service/setup/restore.go` 2 ／ `service/setup/check_duplicate.go` 1 ／ `service/setplay/service.go` 1） | **11 か所 / 3 ファイル** |
| 3 | `internal/repository/setup/repository.go:1142` | `calcSetupRecipeHashFromSteps`（非公開） | **2 か所**（`repository/setup/repository.go:899` / `:988`） | 0（`FindDuplicateInCombo` 経由で行使） |

**本番の呼び元は合計 19 か所。** `canonicalModifiersJSON` **3 本**・`emptyRecipeHash` **3 本**もそれぞれ独立していた。共有コードは 1 行もなかった（`M23-05` の実測どおり）。

### 4.2 ★3 本の出力は統合前に一致していた（§4.5 手順 1）

**一時プローブを 3 パッケージへ入れ、同一の 9 入力クラスで比較した**（統合前・commit `210ab49`）。

| 入力クラス | 3 本の一致 | 値 |
|---|---|---|
| `nil` ／ 空スライス ／ `emptyRecipeHash` | **一致** | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 単一ステップ | **一致** | `b62d366e425f8cdff7dadb8ed0ab2f78c991e3d071b9db9f005b1ac01fac7558` |
| `MoveID = nil` | **一致** | `9093792ad91b3e9635903979e299021423dbc6d7b0eaafb89d7a74d058156335` |
| 2 ステップ（昇順 ／ 逆順） | **一致**（相互にも一致） | `f63230348f0164d8ba030f56036a3abc6d212016e8f59b34497a544e5a7a02f1` |
| modifier flags（`["a","b"]` ／ `["b","a"]`） | **一致**（相互にも一致） | `697ba70672258d15d3d2cf9f263762205046bdc364fd9a6d15676209a78f1ef3` |
| modifier 空 struct | **一致** | `afa0a503af9f8c418edc1ece1c562ed83ff18da31f9415bf6e45f5d0f01a2beb` |
| `canonicalModifiersJSON(nil)` | **一致** | `null` |
| `canonicalModifiersJSON(flags)` | **一致** | `{"flags":["a","b"],"type":"t","notes":"n"}` |

**⇒ §9.1-4 の停止条件（3 本の出力が一致していない）には当たらなかったため、報告のうえ統合した。**

**★この実測値をそのまま golden として `internal/recipehash/recipehash_test.go` へ固定した。** 本テストが緑であることは「**統合後の 1 本が、統合前の 3 実装と同じ値を返す**」の主張である（§5.1-1 / §5.1-2）。

### 4.3 統合先と、その選び方

**`internal/recipehash`（新規パッケージ）。**

| 候補 | 採否 | 理由 |
|---|---|---|
| `internal/service/notation/` ／ `internal/service/preset/` | **不採用** | **契約 F-1 のパッケージ**。§2.2 の停止条件に当たる |
| `internal/service/setup/` | **不採用** | **`repository/setup` が service を import すると依存の向きが逆転する**（統合前のコメント「パッケージ循環を避けるため独立実装」がこの制約を指していた） |
| `internal/model/` | **不採用** | ドメインモデルへ `crypto/sha256` を持ち込むことになる |
| **`internal/recipehash/`** | **採用** | **サービス層・リポジトリ層の両方より下に置ける。** `internal/aliasnorm` / `internal/sanumber` / `internal/moveindex` / `internal/aliasindex` と同じ「純粋ユーティリティは `internal` 直下」の既存の型に倣った（**推測: この置き場の選定は §9.2 の委任範囲外なので明示する**。パッケージ godoc にも同じ注記を入れた） |

**★新規ファイルを作る前に同名の存在を確認した**（教訓 `E-225`）——`ls internal/recipehash`（不在）／ `find . -name "recipehash*" -o -name "recipe_hash*"`（0 件）。

### 4.4 公開 API は変えていない → **呼び元の編集は 0 件**

`CalcRecipeHash` / `CalcSetupRecipeHash` / `calcSetupRecipeHashFromSteps` はいずれも**残し**、中身を委譲 1 行にした。

- **本番の呼び元 19 か所は 1 行も変えていない。**
- `canonicalModifiersJSON` 3 本・`emptyRecipeHash` 3 本・`sortStepsByOrder` 1 本を**同じ手番で**除去した（§4.5 手順 3。**ハッシュ本体は 1 本なのに正規化が 3 本、という状態を作らない**）。

### 4.5 ★godoc に呼び出し元を列挙していない

教訓 `E-224`（呼び出し元の列挙は、増えたときにしか壊れない形の記述）。**代わりに契約を書いた**——「同じレシピからは必ず同じ値が出る」「呼ぶ場所によって値が変わらない」。あわせて 3 か所の入口に「**中身を書かないこと**」を明記した（統合が黙って崩れる形を防ぐ）。

---

## 5. `CO-012`: config の TOML 全再エンコード＋アトミック書込の重複

### 5.1 判定: **同一処理である → 寄せた**（`E-205` の「似て見えるだけ」ではなかった）

`internal/service/config.writeAtomic` を削除し、**`appconfig.Save` を呼ぶ**（`internal/service/config/service.go:267` / `:311`）。

- **層をまたいでいない。** `internal/service/config` は既に `appconfig`（`internal/config`）を import しており、**依存の向きは 1 本も増えていない**。api 層 ↔ service 層の話ではなかった（§3.3-4）。
- エラー文言の差（`"config: rename: %w"` → `"config: rename tmp: %w"`）は残る。**アサートしているテストは 0 件**。

### 5.2 ★寄せなかったもの: `PersistPort` と `configForPersistence`

どちらも「ディスクの値を起点に一部だけ差し替える」形だが、**求めている集合が違う**。

| | `PersistPort`（`internal/config`） | `configForPersistence`（service） |
|---|---|---|
| 何を求めるか | **ポートだけをディスク値の上に載せて記録する** | **env 上書き中の項目をディスク値へ戻す**（焼き付き防止） |
| 対象 | `server.port` 1 項目 | `logging.level` / `database.path` / `server.port` の 3 項目 |

**⇒ 分けたまま。** `M23-03` の `#6`（分けるのが正しかった）と同型である（教訓 `E-205` / `E-255`）。

### 5.3 ★「書き換えの方式」を差し替え可能にした（§4.4 後段）

`Save` を意味の違う 2 段へ分けた。**新しい interface・設定項目・分岐は 1 つも作っていない**（使われるか分からない抽象は負債＝チェックリスト §5）。

```go
func Save(path string, cfg *Config) error {
	data, err := encodeTOML(cfg)     // 「どう表現するか」
	if err != nil { return err }
	return replaceAtomically(path, data) // 「どう置き換えるか」
}
```

**⇒ コメント保全を扱うときに差し替えるのは前段だけでよく、後段（守りたいアトミック性）を作り直さずに済む。**

### 5.3-1 ★アトミック書込のテストが守っている範囲（**`f.Sync()` は守れていない**・レビュー中-2）

`replaceAtomically` が不変条件「書込中に落ちても設定ファイルが壊れない」を担保しているのは 2 つの要素である。

| 要素 | テストで守れているか |
|---|---|
| **(a) 一時ファイル経由 ＋ `os.Rename`** | **守れている。** `TestSave_WriteFailure_LeavesExistingFileIntact` が `path+".tmp"` をディレクトリで塞いで `os.Create` を失敗させ、既存ファイルが 1 バイトも変わらないことを主張する。破壊確認 2（直接上書きへ差し替え）で赤くなることも実証した |
| **(b) rename 前の `f.Sync()`** | **★守れていない。** **`f.Sync()` の 1 行を削っても 3 本とも緑のままである** |

**⇒ (b) はまさに「書込*中*に落ちる」ケースのための行であり、指示書 §4.4 が名指しした不変条件のうち、クラッシュ耐性そのものを担う側にテストが無い。**

**★テストで守る方法を採らなかった理由**——`fsync` の呼び出し有無をテストから直接観測するには `os.File` を挟むインタフェースが要る。**それは「使われるか分からない抽象」であり、指示書 §4.4 末尾とチェックリスト §5 が明示的に避けよと書いているものである。** **⇒ 「テストで守れない」と明記して §12 へ回す。**

**★あわせて §5.1-3 の言い回しを実態へ合わせる。** 本サブのテストが実際に主張しているのは「**書込に失敗したとき、既存の設定ファイルが変わらない**」であって、「書込の途中でプロセスが落ちても壊れない」ではない。後者は `f.Sync()` と `rename` のアトミック性に依存しており、**現時点ではコードの構造としてのみ担保されている。**

### 5.4 ★コメントが落ちる機序（指示書 §11-2 の暫定案が求めた報告）

**判明した。** `PUT /api/config` → `Update()` → `configForPersistence()` → `Save()` → **`toml.NewEncoder(&buf).Encode(cfg)`**。

**エンコーダは Go の構造体から TOML を丸ごと生成する。元ファイルを 1 バイトも読まない。** ⇒ コメント・空行・キー順・インデントは入力に存在しないので、出力にも存在しない。`[defaults]` が増えるのは、`Config` 構造体が `Defaults` セクションを持つのに `config.toml.example` に書かれていないためである（**構造体に在るものは全部書き出される**）。

**本サブの `make e2e` 実行で実物が再現している。**

| | `config.toml.example`（43 行） | E2E 実行後の `config.toml`（19 行） |
|---|---|---|
| コメント | あり（パスワード復旧手順を含む） | **0 行** |
| `[defaults]` | 無し | **追加されている** |
| `password_hash` | `# password_hash = ""`（コメントアウト） | **実キーとして実体化** |
| 値（`port` / `path` 等） | — | **保たれている**（`config-toml-write-back-env-asymmetry` の是正が効いている） |

### 5.5 ★見通し（次に扱う担当のために残す）

**「前段を差し替えるだけ」では済まない見込みである。** 現行の `github.com/BurntSushi/toml` に**コメントを保持したまま値を書き換える API が無い**（エンコーダは 構造体 → TOML の一方向のみ）。実現するなら

- **(i) 別ライブラリの Document API** → **新規依存の追加**にあたり `CLAUDE.md` §6 で開発者への提案が必須
- **(ii) 自前の行単位パッチャ** → TOML パーサの部分自作

のどちらか。**いずれも「挙動の変更」であり、本サブの性格（挙動を変えないリファクタ）を超える。** 指示書 §11-2 の暫定案（本サブでは扱わない）は妥当だと判断した。**開発者承認済み**（2026-08-25）。

---

## 6. `CO-006`: inline INSERT のパターン化 —— **部分実施**

### 6.1 やったこと

`internal/testutil/dbtest` へ `Insert` / `Cols` / `Raw` / `Execer` を追加した（**新設ではなく既存パッケージへの追加**＝§3.3-3）。

**★ヘルパは既定値を 1 つも埋めない。** 指定した列だけが INSERT 文に出る。埋めると「その既定値に依存した主張がたまたま通る」形になりうるため（教訓 `E-218` の変種）。**列を省いたときの値はスキーマ既定に委ねられ、寄せる前の inline INSERT と同じ結果になる。**

**この性質は `insert_test.go` が `pragma_table_info` の既定値と突合して固定している**（`TestInsert_OnlyEmitsGivenColumns`）。

### 6.2 寄せた範囲: **16 か所 / 4 ファイル**（149 → 133）

| ファイル | 寄せた形 |
|---|---|
| `internal/repository/combo/superseded_test.go` | **同一の INSERT が 4 か所に複製されていた** → `insertAliveCombo` 1 本へ。既存の `insertDeletedCombo` の中身も寄せた（列集合は不変） |
| `internal/service/tag/service_test.go` | **同一の INSERT が 3 か所に複製されていた** → `insertTaggableCombo` 1 本へ。`combo_tags` の 3 か所も寄せた |
| `internal/repository/tag/repository_test.go` | 既存ヘルパ `insertComboForCharacter` / `insertComboTag` の中身 |
| `internal/repository/punish/m23_03_reference_exclusion_test.go` | `db.Exec` ＋ `LastInsertId` ＋ エラー処理のボイラープレート |

**★主張は 1 つも変えていない。** 列集合は寄せる前と同一であり、`go test ./... -count=1` は全緑（§8）。

### 6.3 ★残り 133 か所は寄せていない（理由）

1. **列集合が 1 か所ずつ違う。** `combos` への 40 か所だけでも `(character_id, is_draft, version, step_count)` / `(character_id, starter_move_id)` / `(character_id, materialized_from_combo_id, is_draft, deleted_at)` / `(character_id, starter_move_id, damage, step_count, hit_type, recipe_cache)` … と多様である。
2. **既定値を試すために意図的に列を省いているものがある。** 機械的に寄せると、その意図が読めなくなる。
3. **本項は低優先である**（指示書 §4.3）。**§4.4 / §4.5 と時間が競合したため後回しにした。**

**★「やらなかった」を黙って落としていない。** 寄せ先の道具（`dbtest.Insert`）は用意してあるので、後続は 1 か所ずつ足せる。

---

## 7. §4.9 否定形確認（撤回した仕様の残骸の全文走査）

**★走査コマンドはすべて `LC_ALL=C.UTF-8` を付け、陽性対照を混ぜ、キーワードを 2 通り当てた**（教訓 `E-236`）。

### 7.1 走査 1: 「`CalcRecipeHash` 相当は複数ある」

```bash
# 走査 1-A(実装側)
LC_ALL=C.UTF-8 grep -rn --include=*.go -E "同アルゴリズム|独立実装|パッケージ循環" internal/ cmd/
# 走査 1-B(別キーワード)
LC_ALL=C.UTF-8 grep -rn --include=*.go -E "3 (か所|本|実装)|三 ?(か所|本)|各パッケージが自前" internal/ cmd/
# 走査 1-C(文書側)
LC_ALL=C.UTF-8 grep -rn -E "CalcRecipeHash|canonicalModifiersJSON|emptyRecipeHash|CalcSetupRecipeHash|calcSetupRecipeHashFromSteps" docs/
```

**★陽性対照**: 走査 1-B が `internal/recipehash/recipehash_test.go:10` 等の実在ヒットを拾うことを確認（走査が動いている証拠）。

**検出した箇所**（走査ヒット）:

| # | 箇所 | 内容 |
|---|---|---|
| 1 | `internal/repository/setup/repository.go:1140-1141` | 「combo パッケージの `CalcRecipeHash` と同アルゴリズム(SHA-256)。**パッケージ循環を避けるため独立実装**。」 |
| 2 | `internal/service/setup/duplicate_keys.go:15` | 「combo パッケージの `CalcRecipeHash` と**同アルゴリズム**。」 |
| 3 | `internal/service/combo/duplicate_keys.go:34-44` | アルゴリズムの逐語が combo 側にだけ書かれていた（統合後は `recipehash` が正本） |
| 4 | `docs/` 233 件 | change-notes ／ design-reports ／ retrospective-log ／ instructions/phase3 ／ archive |
| 5 | `docs/handover/followup-backlog.md:680` | `calc-recipe-hash-three-implementations` の行（**状態が「未着手」のまま**） |

**手当てした箇所**（別表・教訓 `E-193`）:

| # | 箇所 | 手当て |
|---|---|---|
| 1 | `internal/repository/setup/repository.go` | **是正**。「サービス層ではなく `recipehash` を直接呼ぶのは、リポジトリ層がサービス層を import すると依存の向きが逆転するため」へ書き換え（**理由は残し、失効した事実だけを差し替えた**） |
| 2 | `internal/service/setup/duplicate_keys.go` | **是正**。「`recipehash` が持つ唯一の実装に委ねる」へ |
| 3 | `internal/service/combo/duplicate_keys.go` | **是正**。逐語を `recipehash.Calc` の godoc へ移し、参照に変えた |
| 4 | `docs/` 233 件 | **残す（理由）**。**すべて「当時の記録」であり残骸ではない**。change-notes・design-reports・retrospective-log・archive は歴史的記録であり、書き換えると当時の前提が失われる（`D-535` と同じ考え方）。`instructions/phase3/` も同様 |
| 5 | `docs/handover/followup-backlog.md:680` | **残す（触らない）**。**製造が直接書けるのは §J だけである**（`D-382`）。**⇒ 本報告 §12 へ候補として並べた**（設計伝達レポートは本レビュー後に `/design_handover_report` で生成する） |

**★当たったファイルは全文を目で見た**（教訓 `E-235`＝同じファイルの下部だけが旧のまま残る形）。是正した 3 ファイルはいずれも全文を確認済み。`repository/setup/repository.go` は該当箇所が 3 か所（`:899` / `:918` / `:1136-1145`）あり、**`:918` の「近似は `CalcSetupRecipeHash` と一致する保証が無い」は現在も成立するため残した**。

### 7.2 走査 2: 「`check-md-emphasis.sh` は devContainer で常に赤である」

> **★本節はレビュー高-3 を受けて当て直したものである。** 初版は手で列挙した集合（`CLAUDE.md` / `docs/process` / `scripts` 等 ＋ **`docs/instructions/` からは `M24-overview.md` 1 本だけ**）へ当てており、**指示書 §4.9 が指定した母集合（本番コード ／ テスト資産 ／ 設計文書・指示書）より狭かった。しかもその 1 本は既に残骸と判っていたものであり、答えを知ってから母集合を選ぶ形になっていた。** 以下は指定どおりの母集合へ当て直した結果である。

**★除外基準を先に宣言する。** **完了済みマイルストーンの指示書・チェックリスト・更新履歴は「当時の記録」であり残骸として扱わない。** これは走査 1 で `docs/` の 233 件（change-notes ／ design-reports ／ retrospective-log ／ `instructions/phase3/` ／ archive）へ適用したのと**同じ基準**である。理由も同じで、**書き換えると当時の前提が失われる**（`D-535` と同じ考え方）。**⇒ 除外の可否は判定の対象であり、判定の前に母集合から落とさない。** 下表には除外したものも全件挙げる。

```bash
# 指定母集合 (1) 本番コード ＋ (2) テスト資産
LC_ALL=C.UTF-8 grep -rn -E "markdown-it-py|check-md-emphasis" internal/ cmd/ web/src web/e2e
# 指定母集合 (3) 設計文書
LC_ALL=C.UTF-8 grep -rn -E "markdown-it-py|check-md-emphasis" docs/design/
# 指定母集合 (3) 指示書(サブディレクトリ・テンプレート・チェックリストを含む全体)
LC_ALL=C.UTF-8 grep -rn -oE "markdown-it-py|check-md-emphasis" docs/instructions/ | sort -u
# 参考: 継続更新資料(指定母集合の外だが、失効すると実害が出るため併せて当てた)
LIVE="CLAUDE.md web/CLAUDE.md docs/handover/followup-backlog.md docs/process \
      docs/handover/architecture-patterns.md docs/handover/retrospective-digest.md \
      scripts .devcontainer Makefile"
LC_ALL=C.UTF-8 grep -rn -E "markdown-it-py" $LIVE
LC_ALL=C.UTF-8 grep -rn -E "check-md-emphasis" $LIVE
```

**★陽性対照**: `grep -c "常に赤" docs/handover/followup-backlog.md` = **2**（既知の 1 件が拾えている）。**★キーワードは 2 通り**（`markdown-it-py` ／ `check-md-emphasis`）。

**検出した箇所と判定（ヒット行単位・全件）**:

| # | 母集合 | 箇所 | 判定 |
|---|---|---|---|
| 1 | **(1) 本番コード** | `internal/` ／ `cmd/` ／ `web/src` | **ヒット 0 件** |
| 2 | **(2) テスト資産** | `internal/**/*_test.go` ／ `web/e2e/` | **ヒット 0 件** |
| 3 | **(3) 設計文書** | `docs/design/` | **ヒット 0 件** |
| 4 | **(3) 指示書** | **`docs/instructions/M24-overview.md:150`** —— `M24-09b` の割付に「`check-md-emphasis.sh` の devContainer 依存欠如」が残っている | **★残骸である**（指示書 §1.1.1 が既に指摘）。**指示書・overview は設計卓の領域**のため触らない。**本報告 §12 へ候補として並べた** |
| 5 | **(3) 指示書** | `M22-05:162` ／ `M22-06:153` ／ `M22-07b:122` ／ `M22-08:172` ／ `M22-08:22`（更新履歴） —— いずれも §3.3 実査項目の「`pip install markdown-it-py` が要る」 | **残す（当時の記録）。** **M22 は完了済みであり、執筆時点（2026-08-16〜18）には実際に要った。** 上記の除外基準どおり |
| 6 | **(3) 指示書** | `IMPROVE-01-clean-clone-toolchain.md` 14 ヒット ／ `reviews/IMPROVE-01-review-checklist.md:27` | **残す（当時の記録）。** **これは当の問題を解消したサブの指示書であり、解消前の状態を「解くべき問題」として書いている。** 書き換えると何を直したのかが失われる |
| 7 | **(3) 指示書** | `M22-07b:265` ／ `M21-01:278` ／ `M24-09b` 指示書・チェックリストの各ヒット | **残骸ではない。** いずれも**検査名を挙げているだけ**、または**ベースライン定数を触るなという規則**であり、**依存の状態を語っていない**。`M24-09b` 指示書 §1.1.1 は「解消済み」と正しく書いている |
| 8 | **(3) 指示書** | `templates/M{N}-{NN}-{slug}.template.md:46` —— 「`check-md-emphasis.sh` のベースラインは 373 → 372 へ下がる」 | **残す（記録）。** 過去の 1 事例の作業例であり、**現在の状態を語る文ではない**（現在のベースラインは 436）。**★ただし読み手が現行値と誤読しうる。テンプレートは設計卓の領域のため触らず、本報告 §12 へ回す** |
| 9 | **参考（継続更新資料）** | **`docs/handover/followup-backlog.md:174-183`** —— 「`check-md-emphasis.sh` が devContainer で常に赤（依存の未導入）」「**それまでの運用**: `check-artifact-integrity.sh` は**この 1 件だけが赤**であることを前提に、**件数（違反 1 件）で判断する**こと」 | **★★残骸である。** `IMPROVE-01`（2026-08-19）で解消済みであり、本サブの実測でも `check-artifact-integrity.sh` は**違反なし**。**★とくに後段の運用指示が危険**——後任が読むと「違反 1 件は正常」と誤読する。**⇒ 触らない**（§2.1-6・`D-382`）。**本報告 §12 へ** |
| 10 | 参考 | `CLAUDE.md:247` | **残骸ではない。** **何を検査するか**を書いており、**状態は書いていない** |
| 11 | 参考 | `docs/handover/retrospective-digest.md:353` | **残骸ではない。** 「依存不在時に『未実行として非ゼロ終了・緑を返さない』陽性対照を自ら持つ」を**正の実例**として引いており、スクリプトは現在も同じ設計である |
| 12 | 参考 | `docs/process/parallel-board.md`（複数行） ／ `docs/process/archive/` | **残骸ではない**（版ログ・裁定ログ＝当時の記録）。**かつ設計卓の領域であり製造は触らない** |
| 13 | 参考 | `scripts/check-md-emphasis.sh` ／ `.devcontainer/verify-env.sh` | **残骸ではない。★緩めていない**（§2.2 の停止条件。`scripts/` の差分 0 バイト） |

**手当てした箇所**: **0 件**（上表で「是正」に当たるものが無い）。**残骸と判定した 3 件（#4 / #8 / #9）はいずれも製造が書けない資料にある**ため、**本報告 §12 へ候補として並べた**。

**★件数の申告**——**指示書 §4.9 が指定した母集合における残骸は 1 件**（#4 = `M24-overview.md:150`）。**参考として当てた継続更新資料に 1 件**（#9 = `followup-backlog.md:174-183`）。**加えて誤読を招きうるものが 1 件**（#8 = テンプレートのベースライン例）。**⇒ 合計 3 件を §12 へ回す。**

**★初版との差**——**結論は変わらなかった**（#4 / #9 は初版でも検出できていた）。**変わったのは根拠である**——初版は「手で選んだ集合に対して 2 件」であり、指定母集合に対する件数ではなかった。当て直しの結果、**M22 期の指示書 5 ヒット・`IMPROVE-01` の 15 ヒットが母集合に入り、宣言した基準で除外した**という手続きが記録に残った。**★この「変わらない」を実測で言えることが本項の成果物である。**

---

## 8. テスト結果（着手前 ↔ 完了時）

**★コマンド自身の出力（スイート名・件数）で書く。「全緑」「exit 0」だけを根拠にしない**（教訓 `E-125`）。

| スイート | 着手前（`210ab49`） | 完了時（`6ab6306`） |
|---|---|---|
| `go test ./... -count=1` | **53 パッケージ ok / FAIL 0** | **55 パッケージ ok / FAIL 0**（**PASS 1610 本**・サブテスト込み） |
| `cd web && pnpm test -- --run` | **182 files / 1829 tests passed** | **182 files / 1829 tests passed**（**着手前と同一＝`web/src` 0 バイトの裏づけ**） |
| `make e2e` | **175 passed / 0 failed** | **175 passed / 0 failed**（3.4m・**flaky 0 / retry 0**）。**★レビュー取り込み（commit `36f3da1`）で `recipehash` の本番コードに触れたため、取り込み後にもう一度回して 175 passed を確認した** |
| `cd web && pnpm lint`（`tsc --noEmit`） | — | **exit 0 / 出力なし** |
| `gofmt -l internal/` | — | **出力なし** |
| `go vet ./...` | — | **出力なし** |

**★パッケージが 2 増えたのは本サブの新規分である**——`internal/recipehash`（新設）と `internal/testutil/dbtest`（従来 `[no test files]` だったところへテストを足した）。

### 8.1 品質チェック（件数つき）

| 検査 | 結果 |
|---|---|
| **`bash scripts/check-artifact-integrity.sh`（★1 本目）** | **違反なし。** 検査 11 件の自己検査すべて OK ／ ALLOW 除外 1 件 ／ 生成物 4 件 OK |
| `bash scripts/check-md-emphasis.sh` | **違反なし。** 対象 559 ファイル ／ **現在 436 行 / ベースライン 436 行（増加なし）** |
| `bash scripts/check-enum-sync.sh` | ベースラインどおり（増加なし） |
| `bash scripts/check-browser-storage-keys.sh` | 違反なし（台帳と実装が一致） |
| `bash scripts/check-doc-refs.sh` | dead reference なし |
| `bash scripts/check-doc-inventory.sh` | exit 0（情報提供型） |

---

## 9. 破壊確認（**必須 3 件・すべて実施**）

**★「赤くなった」だけでは破壊確認にならない。狙ったテストだけが、狙ったアサーションで赤いことまで確認した**（教訓 `E-230`）。

### 9.1 破壊確認 1: 統合後の正規化を 1 段落とす（modifier の順序正規化をやめる）

**壊し方**: `internal/recipehash/recipehash.go` の `CanonicalModifiersJSON` から `sort.Strings(flags)` を除去。

```bash
go test ./internal/recipehash/ -count=1 -v
go test ./internal/service/combo/ -count=1 -run 'TestCalcRecipeHash' -v
```

**出力（狙ったものだけが赤）**:

```
    recipehash_test.go:82: Calc(modifier flags 降順(順序違いでも同じ)) = 1d32e8f8b9... , want 697ba70672... (統合前の 3 実装の実測値)
--- FAIL: TestCalc_GoldenValues (0.00s)
    --- PASS: TestCalc_GoldenValues/nil
    --- PASS: TestCalc_GoldenValues/空スライス
    --- PASS: TestCalc_GoldenValues/単一ステップ
    --- PASS: TestCalc_GoldenValues/move_id_が_NULL
    --- PASS: TestCalc_GoldenValues/2_ステップ(step_order_昇順)
    --- PASS: TestCalc_GoldenValues/2_ステップ(入力が逆順でも同じ)
    --- PASS: TestCalc_GoldenValues/modifier_flags_昇順
    --- FAIL: TestCalc_GoldenValues/modifier_flags_降順(順序違いでも同じ)   ← 狙ったサブテスト
    --- PASS: TestCalc_GoldenValues/modifier_空_struct
    recipehash_test.go:104: CanonicalModifiersJSON([b a]) = {"flags":["b","a"],...}, want {"flags":["a","b"],...}
--- FAIL: TestCanonicalModifiersJSON_Golden
--- PASS: TestEmptyHash_Golden
--- PASS: TestCalc_DoesNotMutateInput
--- PASS: TestCalc_DifferentRecipes_DifferentHashes
```

**★統合前からある契約テストも赤くなった**（7 本中 1 本だけ）:

```
--- PASS: TestCalcRecipeHash_Deterministic
--- PASS: TestCalcRecipeHash_StepOrderInvariant
    duplicate_keys_test.go:51: hash should be invariant to Flags slice order
--- FAIL: TestCalcRecipeHash_FlagsOrderInvariant      ← 狙ったテスト
--- PASS: TestCalcRecipeHash_DifferentRecipes_DifferentHashes
--- PASS: TestCalcRecipeHash_NullMoveID
--- PASS: TestCalcRecipeHash_EmptyRecipe
--- PASS: TestCalcRecipeHash_ModifiersNilVsEmpty
```

**期待どおり**（指示書 §5.3-1）。復旧後は全緑。

### 9.2 破壊確認 2: config のアトミック書込を直接上書きへ差し替える

**壊し方**: `replaceAtomically` を `return os.WriteFile(path, data, 0o600)` に差し替え。

```
    save_atomic_test.go:61: Save は失敗するはずだが nil を返した(書込経路が一時ファイルを経由していない)
--- FAIL: TestSave_WriteFailure_LeavesExistingFileIntact   ← 狙ったテスト(§5.1-3)
--- PASS: TestSave_Success_ReplacesCompletelyAndLeavesNoTemp
--- PASS: TestSave_CreatesFileWhenAbsent
FAIL	github.com/plexiblinp/combomgr/internal/config	0.008s
```

**★`internal/service/config` と `internal/api/config` は緑のままだった。** これは欠陥ではなく設計どおりである——**期待は壊す対象と同じ層に置いてある**（playbook §4.28）。**⇒ 上位層のテストにこの不変条件を守らせようとしても守れない**（書込結果を検査しないため）ことの実証でもある。

復旧後は全緑。

### 9.3 破壊確認 3: 統合後の 1 本を壊し、**どの経路が赤くなったかを数える**

**壊し方**: `recipehash.Calc` の正規化結果を捨てて定数（`emptyHash`）を返す＝**すべてのレシピが同じハッシュになる**。

**★「テストが赤くなった」ではなく「どの経路が赤くなったか」を数えた**（指示書 §5.3-3）。

| # | 経路 | 赤くなったか | 赤くなったテスト | 逐語（狙ったアサーション） |
|---|---|---|---|---|
| 1 | **`internal/service/combo`** | **★赤** | **5 本**（`TestCalcRecipeHash_DifferentRecipes_DifferentHashes` / `TestCalcRecipeHash_NullMoveID` / `TestCheckDuplicate_DeletedSide_NotFiredWhenRecipeDiffers` / `TestService_CheckDuplicate_NoDuplicate` / `TestCheckTrashDuplicate_VALC14_NotFiredWhenRecipeDiffers`） | `duplicate_keys_test.go:59: different move_id should produce different hashes` |
| 2 | **`internal/service/setup`** | **★赤** | **3 本**（`TestM2303_UpdateSetup_StillRejectsDuplicateInsideTrashedCombo` / `TestCheckSetupDuplicate_NotFiredWhenRecipeDiffers` / `TestCheckTrashDuplicateSetup_VALS07_NotFiredWhenRecipeDiffers`） | `m23_09_check_duplicate_test.go:141: ★レシピが違うのに返している: [1]` |
| 3 | **`internal/repository/setup`** | **★赤** | **1 本**（`TestRepository_FindDuplicateInCombo_NotFound_DifferentRecipe`） | `repository_test.go:150: expected no duplicate, got 1` |
| （参考） | `internal/recipehash` 自身 | 赤 | golden 対照 | `Calc(単一ステップ) = e3b0c442..., want b62d366e...` |

**⇒ 3 経路すべてが赤くなった。赤くならない経路は 0 件。** いずれも「**レシピが違うのに重複と判定した**」という、`VAL-C02` / `VAL-S04` / `VAL-S07` の根拠そのものを突くアサーションで赤い。

復旧後は 3 パッケージとも緑（`-count=1` で再確認）。

---

## 10. §9.4 CHANGE の要否 —— **不要（3 条件とも不発動）**

| # | 条件 | 判定 |
|---|---|---|
| 1 | `DES-002` §4.2 の経路表に載る API の挙動が変わった | **不発動。** 本サブは API を 1 本も新設・変更していない。`internal/api/` の差分は 0 バイト |
| 2 | `DES-003` のスキーマ・論理削除の契約に触れた | **不発動。** スキーマ変更 0・マイグレ消費 0・`migrations/` の差分 0 バイト |
| 3 | **`CalcRecipeHash` の統合により `VAL-C02` の判定結果が 1 件でも変わった** | **不発動。** 統合前の 3 実装の出力を 9 入力クラスで実測し、その値を golden として固定した（§4.2）。**⇒ ハッシュ値が変わっていない以上、重複と判定される組も変わらない。** `VAL-C02` / `VAL-C14` / `VAL-S04` / `VAL-S07` / `VAL-R03` を主張する既存テストはすべて緑のまま |

**⇒ 本サブは CHANGE を消費しない。**

---

## 11. ■ 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **消費した CHANGE 番号の登録** | **なし。** 本サブは CHANGE を 0 件消費した（§10）。`change-number-registry.md` §1 への登録は不要 |
| **その番号の写し先（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4）** | **なし。** 番号を払い出していないため写し先も無い |
| **消費したマイグレ連番** | **なし（0 本）。** `ls migrations/` の実査値の最終連番は **`000078_add_combos_superseded_by`**（本サブ着手前と同じ）。ボード §2.2 の「次に払い出す番号」とのずれは生じていない |
| **版を上げた文書の参照元** | **なし。** 本サブは設計書・指示書・チェックリストの版を 1 つも上げていない |
| **その他** | **`docs/progress/progress-log.md` へ索引行を追記する**（Phase D＝レビュー後。★索引行はレビューの後に埋める＝教訓 `E-208`。**本節の初版は「追記した」と過去形で断定していた。レビュー高-1 で是正**） |

---

## 12. 設計伝達レポート §4 へ回す候補（**製造は触らない資料**）

| # | 対象 | 内容 |
|---|---|---|
| 1 | `followup-backlog.md` §AA `calc-recipe-hash-three-implementations` | **本サブで解消した。** 状態が「未着手」のまま。**⇒ 畳む候補**（`D-382` により製造は §J 以外を書けない） |
| 2 | `followup-backlog.md` §E の `check-md-emphasis.sh` 段落（`:174-183`） | **`IMPROVE-01`（2026-08-19）で解消済みの記述が残っている。** とくに「**`check-artifact-integrity.sh` は違反 1 件を前提に件数で判断すること**」という運用指示が失効しており、**後任がこれを読むと「違反 1 件は正常」と誤読する**。**⇒ 畳む候補** |
| 3 | `docs/instructions/M24-overview.md` §3 の `M24-09b` 行 | 割付に「`check-md-emphasis.sh` の devContainer 依存欠如」が残っている（指示書 §1.1.1 が既に指摘）。**⇒ 是正候補** |
| 4 | `followup-backlog.md` §E の `CO-012` 集約文 | **本サブで解消した。** ただし同行は複数項目の集約文であり、`CO-012` の部分だけを畳む必要がある |
| 5 | **★E2E flake の 7 件を束ねる先** | `CO-021` / `CO-022` / `CO-025` ＋ `e2e-flaky-isolation` / `e2e-sqlite-write-contention` / `e2e-flaky-combo-post-500` / `e2e-flaky-m18-03c-drainage`。**本サブの実測は「個別 spec ではなくスイート全体の構造」を支持した**（§2.4 / §2.5）。**★「fe-e2e 安定化サブ」は `M24-overview` v1.1.0 の 11 本に存在しない**（指示書 §11-1）。**⇒ 割付先の決定は開発者の承認事項**（サブの新設） |
| 6 | `followup-backlog.md` §K `e2e-suite-rewrites-config-toml-comments` | **本サブでは扱っていない**（開発者承認済み）。**★機序と実装の見通しが判明したので同行へ添える価値がある**（§5.4 / §5.5） |
| **7** | **★`scripts/check-progress-log-index.sh` の照合が部分文字列一致である** | 同スクリプトは `grep -qiF -- "$id" "$logfile"` で判定するため、**他エントリからの前方参照でヒットするだけで緑を返す。** **本サブで実際に踏んだ**——`M24-09b` の索引行が未追記の状態で `exit 0`（レビューが検出。`progress-log.md` 内の `M24-09b` 2 件は M23-10 の横断課題が本サブを候補として前方参照している行）。**⇒ 見出し行（`### <ID>:`）との一致に絞る等の候補。★スクリプト本体の改修は改善レーンの手番であり、本サブでは触っていない** |
| **8** | **★`internal/config.replaceAtomically` の `f.Sync()` を守るテストが無い** | 現テストが守るのは「一時ファイル経由であること」まで。**`f.Sync()` の 1 行を削っても 3 本とも緑**（§5.3-1）。**テストで守るには `os.File` を挟むインタフェースが要り、それは「使われるか分からない抽象」になるため本サブでは採らなかった。** 判断材料として §J 相当の候補に挙げる |
| **9** | `docs/instructions/templates/M{N}-{NN}-{slug}.template.md:46` | 「`check-md-emphasis.sh` のベースラインは 373 → 372 へ下がる」——**過去の 1 事例の作業例だが、現行値（436）と誤読されうる。** テンプレートは設計卓の領域のため触っていない（§7.2 #8） |

---

## 13. 変更したファイル

```
$ git diff --stat 210ab49 -- internal/
 internal/config/config.go                          |  51 ++++-
 internal/config/save_atomic_test.go                | 127 ++++++++++++
 internal/recipehash/recipehash.go                  | 142 ++++++++++++++
 internal/recipehash/recipehash_test.go             | 216 +++++++++++++++++++++
 internal/repository/combo/superseded_test.go       |  68 +++----
 .../punish/m23_03_reference_exclusion_test.go      |  24 +--
 internal/repository/setup/repository.go            |  67 +------
 internal/repository/tag/repository_test.go         |  21 +-
 internal/service/combo/duplicate_keys.go           |  85 +-------
 internal/service/config/service.go                 |  40 +---
 internal/service/setup/duplicate_keys.go           |  65 +------
 internal/service/tag/service_test.go               |  57 +++---
 internal/testutil/dbtest/insert.go                 |  73 +++++++
 internal/testutil/dbtest/insert_test.go            | 106 ++++++++++
 14 files changed, 801 insertions(+), 341 deletions(-)
```

> **`docs/` 側は本報告 1 ファイル（新規・`+` のみ）と、Phase D で追記する `progress-log.md` である。★本報告自身の行数は編集のたびに動くため、上のブロックは `internal/` に絞ってある**——**`E-225` が見たいのは「新規のつもりのソースに deletions が付いていないか」であり、そこは編集で動かない。**

> **★上のブロックはコマンドの実測出力である**（レビュー中-3 の是正）。**初版は行を落とし、`recipehash.go` の行数を 147 と書いていた（実測 146→現在 142）。** **`implement_plan_full` Phase A 補足 (b) は「変更統計を貼って新規ファイルが `+` だけかを読む」ことを教訓 `E-225` の唯一の検出経路として置いている。⇒ 貼った統計が実測でなければ、その検出経路は成立しない。加工した数値をコマンド出力として提示しないこと。**

**★新規ファイル 5 本はいずれも `+` のみで deletions が 0 である**（Phase A 補足 (b) / 教訓 `E-225`）——`recipehash.go` / `recipehash_test.go` / `save_atomic_test.go` / `insert.go` / `insert_test.go`。**作る前に `ls` / `find` で同名の不在を確認済み。**

**★触っていないもの**: `migrations/`（0 バイト） ／ `web/`（0 バイト） ／ `docs/design/` ／ `docs/handover/followup-backlog.md` ／ `internal/service/notation/` ／ `internal/service/preset/` ／ `internal/api/`。

### コミット

| commit | 内容 |
|---|---|
| `250cc5d` | `refactor(M24-09b/recipehash)`: `CalcRecipeHash` 相当の 3 実装を 1 本へ統合する |
| `2d1f406` | `refactor(M24-09b/config)`: TOML 全再エンコード + アトミック書込の重複を 1 本へ寄せる |
| `6ab6306` | `test(M24-09b/dbtest)`: inline INSERT の共通ヘルパを足し、明確な重複を寄せる |

---

## 14. 推測で進めた事項（明示）

| # | 内容 | 明示先 |
|---|---|---|
| 1 | **`internal/recipehash` という置き場所と名前。** 「既存の `internal/aliasnorm` / `internal/sanumber` 等と同じ純粋ユーティリティの型に倣った」 | **パッケージ godoc に「推測: 〜に倣った」として明記**（`recipehash.go` の `# なぜ独立したパッケージなのか`） |
| 2 | `dbtest.Insert` の命名・シグネチャ・`Raw` 型の導入 | 指示書 §9.2 で委任済み。`insert.go` の godoc に設計意図を明記 |
| 3 | `Save` の 2 段分解の粒度 | 指示書 §4.4 が委任した範囲。`config.go` の godoc に理由を明記 |

---

## 15. 既知の as-built 差分（挙動を変えないリファクタの例外・**いずれも到達不能**）

| # | 差分 | 影響 |
|---|---|---|
| 1 | `Save` のエンコード失敗時に**一時ファイルが作られなくなった**（分解前は tmp を作ってからエンコードしていた） | **到達不能。** `toml.Encoder.Encode` は本 `Config`（string / int / int64 / bool のみ）で失敗しない。アサートしているテストも 0 件 |
| 2 | `service/config` の rename 失敗時のエラー文言が `"config: rename: %w"` → `"config: rename tmp: %w"` へ変わった | **到達不能に近い**（rename 失敗時のみ）。アサートしているテストは 0 件 |

---

## 16. レビュー取り込み（自動トリアージ・2026-08-25）

レビュー報告書 `docs/progress/m24-09b-review.md`（**重大 0 / 高 3 / 中 4 / 低 5**）を受けての採否。**★「高」の不採用は 0 件**（3 件とも採用）のため、開発者エスカレーションは発火していない。

| 優先度 | ID | 採否 | 反映先 |
|---|---|---|---|
| **高-1** | progress-log 追記を過去形で断定 | **採用** | §11 を「追記する（Phase D＝レビュー後）」へ。実際の追記は Phase D で実施 |
| **高-2** | 設計伝達レポートへの反映を過去形で断定（3 か所） | **採用** | §7.1 / §7.2 を「本報告 §12 へ並べた。レポートは本レビュー後に生成する」へ |
| **高-3** | §4.9 走査 2 の母集合が指定より狭く、絞り込みが未宣言 | **採用** | §7.2 を指定母集合（本番コード／テスト資産／設計文書・指示書）へ当て直し、**除外基準を先に宣言**したうえでヒット行単位の全件表を作り直した。**結論は不変（残骸 3 件）だが、根拠が手選びの集合から指定母集合へ変わった** |
| **中-1** | `Save` godoc に将来計画 | **採用** | 該当 3 行を削除（commit `36f3da1`）。現状の記述は `encodeTOML` の godoc に残した |
| **中-2** | `f.Sync()` を守るテストが無い | **採用（報告として）** | §5.3-1 を新設。テストで守る案（`os.File` を挟むインタフェース）は「使われるか分からない抽象」なので採らず、§12-8 へ回した |
| **中-3** | §13 の `git diff --stat` が実測と不一致 | **採用** | 実測出力へ差し替え。**本報告自身の行数は編集で動くため `internal/` に絞った** |
| **中-4** | `recipehash` の公開面が広い | **採用** | 公開面を `CalcCombo` / `CalcSetup` の 2 本だけに絞り、テストを内部テストパッケージへ（commit `36f3da1`）。`go doc` の出力が 2 本であることを確認 |
| **中-8** | `check-progress-log-index.sh` の偽の緑 | **採用（報告として）** | §12-7 へ。**スクリプト本体は触っていない**（改善レーンの手番） |
| **低-1** | `//nolint:gochecknoglobals` が何も抑止していない | **採用** | `.golangci.yml` 不在・Makefile に lint ターゲット無しを自分で実査したうえで削除。`emptyHash` を const 化し、`sha256("")` との一致を主張するテストを追加（commit `36f3da1`） |
| **低-2** | `CalcCombo` / `CalcSetup` の空判定重複 | **採用** | 早期 return を削除（commit `36f3da1`） |
| **低-4** | §3.3-1 の実査範囲が `web/e2e/` 直下に限られる | **採用（報告として）** | §1 #1 へ注記。**`playwright.config.ts` が実質の共通基盤である**ことを次の指示書向けに残した |
| **低-3** | `dbtest.Raw` がプレースホルダをバイパス | **不採用** | **レビュー自身が「記録のみ・対応不要」と明記。** テスト専用ヘルパ（`internal/testutil/` 配下）であり外部入力を受けない。godoc にその前提を明記済み |
| **低-5** | `service/combo` のパッケージ doc がやや古びる | **不採用** | **レビュー自身が「失効とまでは言えないため是正不要」と判定。** 計算は移ったが「入口を集約する」と読めば成立する |

**★不採用は 2 件で、いずれもレビュー自身が「対応不要」と明記したものである。**

**★レビューが独立に検証してくれた点**（本報告の主張の裏取り）——golden 値 6 本をレビュー側で `sha256sum` により再計算し全一致を確認、`go test ./... -count=1` = 55 パッケージ ok、`emptyRecipeHash` / `canonicalModifiersJSON` / `sortStepsByOrder` のヒット 0 件、inline INSERT 149 → 133 の再計測、新規 5 本の deletions 0。**⇒ `VAL-C02` の判定結果が動いていないことは、本サブのテストを信じずに独立検証されている。**

---

*以上、M24-09b 完了報告。*
