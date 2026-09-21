# M24-09b 設計伝達レポート（例外レポート）

| 項目 | 内容 |
|------|------|
| **対象** | **親チャット（設計卓）** |
| 発信 | 製造担当 Claude Code / 2026-08-25 |
| 指示書 | `docs/instructions/M24-09b-test-assets-and-residual-refactor.md` **v1.1.0** |
| 実装コミット | ブランチ `claude/m24-09b-implementation-507r2d` ／ **10 コミット**（`250cc5d` 〜 `09ea338`）／ **PR [#108](https://github.com/plexiblinp/combomgr/pull/108)**。**`claude/` 名前空間のため push 済み**（main への反映は開発者のマージ） |
| 関連 | 完了報告 `docs/progress/M24-09b-completion-report.md` ／ レビュー `docs/progress/m24-09b-review.md`（重大 0 / 高 3 / 中 4 / 低 5・往復 1 回で完了） |
| CHANGE | **消費 0 件**（§9.4 の 3 条件とも不発動） ／ **マイグレ消費 0 本** ／ **新規依存 0 件** |

本レポートは **①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題** に絞る。指示書どおりの部分は割愛する。

> **★最重要は §1-1（`CalcRecipeHash` の統合先と呼び元の全数）と §4-1 〜 §4-1-2（`CO-007` の判定＝rollback 方針の入力）である。** **★§4-1-1 / §4-1-2 は 2026-08-25 の追補である**——**開発者の実 DB 実測を受けて `CO-007` の判定に限定条件が付き、`000024.down` / `000053.down` に別の欠陥が見つかった。§4-1 だけ読むと古い判定になる。**
> **★§2 に 1 件ある**（`CO-012` の面が指示書 §2.1-4 の明文と違った）。受理／却下の裁定を要する。

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

> **★本サブは `DES-002` §4.2 の経路表に載る API を 1 本も新設・変更していない**（`internal/api/` の差分 **0 バイト**）。**⇒ playbook §4.29 の API 逐語ルールは対象外**（指示書 §7.5 が明記）。**ただし指示書 §7.5 は「`CalcRecipeHash` の統合先と呼び元の全数を §1 へ本文として書くこと」を求めているので、以下を参照ではなく本文で置く。**

### §1-1 ★`CalcRecipeHash` 相当の 3 実装を `internal/recipehash` の 1 本へ統合した

**統合前の所在（3 か所・共有コードは 1 行も無かった）:**

| # | 所在 | 名前 | 本番の呼び元 |
|---|---|---|---|
| 1 | `internal/service/combo/duplicate_keys.go:45` | `CalcRecipeHash`（公開） | **10 か所**（すべて `internal/service/combo/service.go`＝`:257` / `:539` / `:643` / `:966` / `:1010` / `:1063` / `:1080` / `:1194` / `:1297` / `:1549`） |
| 2 | `internal/service/setup/duplicate_keys.go:16` | `CalcSetupRecipeHash`（公開） | **7 か所**（`service/setup/service.go:208` / `:286` / `:446` ／ `service/setup/restore.go:170` / `:340` ／ `service/setup/check_duplicate.go:33` ／ `service/setplay/service.go:818`） |
| 3 | `internal/repository/setup/repository.go:1142` | `calcSetupRecipeHashFromSteps`（非公開） | **2 か所**（`internal/repository/setup/repository.go:899` / `:988`） |

**本番の呼び元は合計 19 か所。** `canonicalModifiersJSON` **3 本**・`emptyRecipeHash` **3 本**も各パッケージに独立していた。

**統合後の所在: `internal/recipehash`（新規パッケージ）。公開しているのは 2 本だけである。**

```
$ go doc ./internal/recipehash
func CalcCombo(steps []model.ComboStep) string
func CalcSetup(steps []model.SetupStep) string
```

**★公開入口 3 本（`CalcRecipeHash` / `CalcSetupRecipeHash` / `calcSetupRecipeHashFromSteps`）は残し、中身を委譲 1 行にした。⇒ 本番の呼び元 19 か所は 1 行も変更していない。**

**置き場の決定理由**（`internal/service/notation/` `internal/service/preset/` に入っていないこと＝指示書 §2.2 の停止条件は不発動）:

| 候補 | 採否 | 理由 |
|---|---|---|
| `internal/service/notation/` ／ `internal/service/preset/` | **不採用** | 契約 F-1 のパッケージ。指示書 §2.2 の停止条件に当たる |
| `internal/service/setup/` | **不採用** | **`repository/setup` が service を import すると依存の向きが逆転する**（統合前のコメント「パッケージ循環を避けるため独立実装」がこの制約を指していた） |
| `internal/model/` | **不採用** | ドメインモデルへ `crypto/sha256` を持ち込むことになる |
| **`internal/recipehash/`** | **採用** | サービス層・リポジトリ層の両方より下に置ける。`internal/aliasnorm` / `internal/sanumber` / `internal/moveindex` / `internal/aliasindex` と同じ「純粋ユーティリティは `internal` 直下」の既存の型に倣った（**推測。§3-2 参照**） |

**⇒ `SUPP-001` §5.2（Go 側のディレクトリ構成）へ `internal/recipehash/` を 1 行追記してほしい。** 用途は「recipe_hash 計算の唯一の実装。コンボ／セットプレイの双方、サービス層／リポジトリ層の双方から呼ばれるため両者より下に置く」。

### §1-2 ★`VAL-C02` の判定結果は 1 件も変わっていない（実測で言える）

統合**前**に 3 実装へプローブを入れ、9 入力クラス（`nil` ／ 空スライス ／ 単一ステップ ／ `move_id` NULL ／ 2 ステップ昇順・逆順 ／ modifier flags 昇順・降順 ／ modifier 空 struct）で出力を採取し、**3 本が全クラスで一致することを確認**した。**その実測値を統合後のテストの golden として固定した**（`internal/recipehash/recipehash_test.go` の `goldenEmpty` 〜 `goldenModEmpty`）。

**⇒ 本テストが緑であることは「統合後の 1 本が統合前の 3 実装と同じ値を返す」の主張である。** レビュー担当も **golden 6 本を `sha256sum` で独立に再計算して全一致を確認**している（レビュー報告 §2 の表）。

**⇒ 指示書 §9.4-3（`VAL-C02` の判定結果が変わったら CHANGE 起票）は不発動。DES-006 の反映は不要。**

### §1-3 `config.toml` へ書き戻す経路が 1 本になった

統合前は `internal/config.Save`（公開）と `internal/service/config.writeAtomic`（非公開）の 2 本が論理的に同一の処理を持っていた（差はエラー文言 1 か所のみ）。**後者を削除し `appconfig.Save` へ寄せた。**

**⇒ `SUPP-001` §5.8 / §5.9（設定ファイル）へ「`config.toml` への書き戻しは `internal/config.Save` ただ 1 本を通る」を明文化してほしい。** 起動時のポート競合フォールバック（L-04）と `PUT /api/config` の両方が同関数を通る。

あわせて `Save` を **`encodeTOML`（表現）＋ `replaceAtomically`（置換）** の 2 段へ分けた（指示書 §4.4 が求めた「書き換えの方式を差し替え可能な形に」）。**新しい interface・設定項目・分岐は 1 つも作っていない。**

---

## §2 契約・設計に反する独自判断（★受理／却下の裁定を要する・**1 件**）

### §2-1 `CO-012` の作業面が指示書 §2.1-4 の明文と異なる

| 項目 | 内容 |
|---|---|
| **何に反したか** | **指示書 §2.1 の成果物表 #4** ——「`internal/api/config/` ／ `internal/service/config/`」を修正対象として明記している。**§2.4 の並列性の根拠表**も同じ 2 つを本サブの触る面として挙げている |
| **実装がどうなっているか** | **触ったのは `internal/config/config.go` と `internal/service/config/service.go` である。`internal/api/config/` は 1 バイトも触っていない** |
| **なぜそう判断したか** | **`internal/api/config/` に TOML 書込が 1 行も存在しなかった**（`handler.go` 117 行は DTO 変換と HTTP 応答のみ・`grep -rn "toml.NewEncoder\|os.Rename" internal/api/config/` = 0 件）。重複の実体は `internal/config/config.go:153` の `Save` と `internal/service/config/service.go:440` の `writeAtomic` の間にあった |
| **判断の根拠となる条項** | 指示書 §2.1 冒頭「**★本一覧は「予見できた範囲」であって禁止列ではない。一覧に無いファイルでも §2.2 の禁止列に当たらないなら触ってよい。ただし触った理由を完了報告に書くこと**」。**⇒ 形式上は許容範囲内だが、指示書の明文と実装の面がずれたため §2 へ挙げる** |
| **層をまたいでいないこと** | `internal/service/config` は**着手前から** `internal/config` を import している（`appconfig` エイリアス）。**依存の向きは 1 本も増えていない。** 指示書 §4.4 の「層をまたがない」（api 層 ↔ service 層）は、そもそも該当しない論点だった |

**★親への依頼**: **(a) この面のずれを受理し、`M24-overview` §5.2 の交差表の `M24-09b` 相当行と、今後 config 系を扱う指示書の面の記述を `internal/config/` へ是正するか。(b) 却下して差し戻すか。**

**★あわせて報告**——**`M24-09a` の行（`M24-overview` §5.2）も `CO-012` の面として `internal/api/config/`・`internal/service/config/` を挙げている。** 同じ誤りが 2 か所にある。

---

## §3 製造の判断

### §3-1 開発者へ確認して確定した点（2026-08-25 のセッション内）

| # | 論点 | 確定 |
|---|---|---|
| 1 | **`CO-025` を実装しないこと** | **承認。** 実測（`make e2e` 3 回 ＋ `--workers=1` 1 回）で 3 spec は 0 flaky。指示書 §4.1 の表の第 2 行に該当 |
| 2 | **run 2 で出た `m23-09` の競合を本サブで直さないこと** | **承認。** 実測として報告するに留める（理由＝本サブの割付にない ／ 規模が `CO-025` を超える ／ 観測が足りない） |
| 3 | **指示書 §11-1（`CO-021` / `CO-022`）の暫定案** | **承認。** 実測だけを本サブに含め、恒久対策は割り付けない |
| 4 | **指示書 §11-2（`e2e-suite-rewrites-config-toml-comments`）の暫定案** | **承認。** 本サブでは扱わず、機序と見通しの報告に留める |

### §3-2 推測で進めた点（指示書 §9.2 の委任範囲 ＋ 明示した越境 1 件）

| # | 内容 | 委任の有無 | 明示先 |
|---|---|---|---|
| 1 | **`internal/recipehash` という置き場所と名前** | **★§9.2 の委任範囲外**（同節は「inline INSERT の寄せ方・ヘルパの命名」「config の重複の寄せ先」「待機のポーリング化の実装形」の 3 つのみ）。**ただし §3.3-5 が「★置き場所は実査で決める」と明示的に製造へ委ねている** | **パッケージ godoc に「推測: `internal/aliasnorm`・`internal/sanumber` と同じ『純粋ユーティリティは internal 直下』という既存の型に倣った」と明記**（`internal/recipehash/recipehash.go` の `# なぜ独立したパッケージなのか`） |
| 2 | `dbtest.Insert` / `Cols` / `Raw` の命名・シグネチャ | §9.2 で委任済み | `internal/testutil/dbtest/insert.go` の godoc |
| 3 | `Save` の 2 段分解の粒度 | 指示書 §4.4 が委任 | `internal/config/config.go` の godoc |

### §3-3 ★意図的に「寄せなかった」判断（`E-205` の門を通した）

**`internal/config.PersistPort` と `internal/service/config.configForPersistence` は寄せていない。** どちらも「ディスクの値を起点に一部だけ差し替える」形だが、**求めている集合が違う**——前者は `server.port` **1 項目**をディスク値の上に載せて記録する。後者は env 上書き中の **3 項目**（`logging.level` / `database.path` / `server.port`）をディスク値へ戻す（焼き付き防止）。**`M23-03` の `#6`（分けるのが正しかった）と同型である。**

---

## §4 設計担当が未把握の残課題・申し送り

> **★以下は `followup-backlog.md` へ設計卓が畳む／登録するための材料である。** 製造は同ファイルを **1 バイトも触っていない**（`D-382`。差分 0 バイトを確認済み）。

### §4-1 ★★`CO-007` の判定（**rollback 方針の入力。設計卓の裁定待ち**）

| 項目 | 内容 |
|---|---|
| **スラッグ** | `CO-007`（followup §E の集約文「000012 down orphan（既存・編集禁止）」） |
| **何が起きるか** | **`migrations/000012_seed_combos_durability.down.sql` は `ON DELETE CASCADE` を発火させず、`combo_steps` / `combo_tags` / `combo_setups` に orphan を残す。** |
| **根拠（構造）** | マイグレーション実行側の接続は `internal/infra/migration/migrate.go:55` で `sql.Open("sqlite", dbPath)` と開かれ、**DSN に `_pragma=foreign_keys(1)` を持たない**。SQLite の既定は `foreign_keys=OFF`。**★これは欠けではなく意図である**（`architecture-patterns` §11 ／ `D-494`＝表を作り直すマイグレを FK=ON で走らせないための構造）。000012 時点で `combos` を参照する子表は 3 つで、いずれも `ON DELETE CASCADE`（`migrations/000001_init_schema.up.sql:98` / `:121` / `:194`） |
| **根拠（実測）** | 一時プローブで 000012 まで up → 子行を仕込む → 000011 へ down。`migration_conn_foreign_keys=0` ／ `before combos=36 combo_steps=96` ／ **`after combos=0 orphan_combo_steps=96 orphan_combo_tags=1`** ／ 対照接続（`_pragma=foreign_keys(1)`）は `1`。**★プローブは恒久テストにせず削除した**——orphan が残る現状を「仕様」として固定するテストになるため |
| **★指示書が求めていない 2 つ目の発見** | **down は up が入れていない行も消す。** 条件が `character_id IN ('aki','jamie','guile')` だけで、up 側が使っている相関キー（`memo`）を使っていない。**⇒ 利用者が後から作った当該 3 キャラのコンボも消える**（実測で `user_combo_before=1` → `user_combo_after=0`） |
| **★言えないこと** | **実 DB に `combo_setups` / `combo_tags` の該当行が何行あるかは判定できない**（クラウド実行環境に dev DB が無い＝followup `dev-db-absent-in-cloud-session`）。**down が運用で実行されたことがあるかも判定していない**（`schema_migrations` に down の実行痕跡は残らない） |
| **割付の候補** | **★rollback 方針の決定は設計卓**（指示書 §4.2 が「判定が出てから設計卓が決める」と明記）。**マイグレ本文は 1 バイトも編集していない**（`D-535`） |
| **新規／更新** | **既存行の更新**（followup §E の集約文にある `000012 down orphan`。判定結果を追記） |

### §4-1-1 ★★2026-08-25 追補: 開発者の実 DB 実測で `CO-007` の判定に限定条件が付いた

**開発者が実 dev DB を `mode=ro` で読み、4 本すべて 0 件だった**（aki/jamie/guile のコンボ 0 ／ 子行 0 ／ 現存 orphan 3 表とも 0）。**「0 だから実害なし」で終わらせず理由を追ったところ、判定が二段になった。**

| 経路 | `000012.down` の挙動 | orphan |
|---|---|---|
| **DB がバージョン 12〜16 に居るとき** | 36 件＋利用者分を削除する | **★`combo_steps` / `combo_tags` / `combo_setups` に残る**（§4-1 の実測どおり） |
| **head からのロールバック** | **0 行**（`characters` 側が先に消えている） | **`000012` は作らない** |

**理由**——`migrations/000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql` が既に aki/jamie/guile を除去しており、**その down は「前方専用クリーンアップ・不可逆」と明記された実質 no-op で復元しない**。さらに `000053.down`（第三波）と `000024.down`（第一波）が **`characters` から jamie / guile を先に削除する**ため、`000012.down` の副問い合わせが空になる。

**★★`000017` は §4-1 の構造的根拠を独立に裏づけている。** 同マイグレは子行を先に明示 DELETE しており、その理由を逐語で書いている——「**マイグレーション接続は foreign_keys=OFF …… orphan を残さないため、子行を先に明示 DELETE する**」。**⇒ 「正しい書き方」の実例が既にリポジトリ内にある**（`000012` はそれより前に書かれており、その作法を持っていない）。

**⇒ `CO-007` への答え: 「残す。ただし DB がバージョン 12〜16 に居るときに限る」。** 実運用で踏む経路は下記 §4-1-2 のほうである。

### §4-1-2 ★★新規の発見: `000024.down` / `000053.down` が **現行ロスターのキャラ**の利用者コンボを orphan にする

> **★これは `CO-007` の射程（`000012` のみ）を超える。同じ型の欠陥だが、対象が現行ロスターのキャラ＝利用者データである。**

| 項目 | 内容 |
|---|---|
| **スラッグ（案）** | `character-down-migrations-orphan-user-combos` |
| **何が起きるか** | **`000024.down`（第一波: terry / guile / lily / kimberly / juri / mai / zangief） と `000053.down`（第三波: m_bison / rashid / jamie / luke / marisa / jp）は `DELETE FROM characters …` の 1 文だけであり、利用者が作った `combos` を消さない。** **`combos.character_id` は `ON DELETE CASCADE` を持たず**（`000017` の注記が明記）、**マイグレーション接続は FK=OFF**（意図・`D-494`）。**⇒ 利用者のコンボは残り、存在しないキャラを指したままになる** |
| **根拠（逐語）** | 両 down の注記は「**依存行は 000025〜000027 ／ 000054〜000058 の down が先に除去済み**」と書いているが、**それが指すのは seed 由来の `moves` / `preset_aliases` / `custom_states` であって利用者の `combos` ではない。** seed マイグレは利用者データを知らない |
| **実測** | 使い捨て DB を head まで up → **guile のコンボ 1 件 ＋ `combo_steps` 1 行 ＋ `combo_tags` 1 行**を仕込む → `m.Migrate(11)`。結果: `after_user_combo=1`（消えない） ／ **`orphan_combos_of_characters=1`** ／ **`orphan_moves_of_characters=2`** ／ `user_combo_is_orphan=1`。**`000012.down` 由来の orphan は 0**（`orphan_steps=0` / `orphan_tags=0`） |
| **なぜ `CO-007` より重いか** | **`guile` は `000024`（第一波）、`jamie` は `000053`（第三波）で現行ロスターとして再投入されている**（head の `characters` に実在。`aki` のみ不在）。**⇒ 利用者がこの 2 キャラのコンボを持っているのは普通のことである。** 一方 `000012` の対象は「既に消えた耐久 seed」であり、実運用では空振りする |
| **実 DB の現状** | **開発者の実 DB は head に居り、当該キャラのコンボは 0 件。⇒ 今この経路を踏んでも失うものが無い。** **★ただし「今 0 件」は「将来も 0 件」ではない**——現行ロスターだからである |
| **割付の候補** | **★rollback 方針と同じ手番で扱うのが自然**（`CO-007` の隣）。**★マイグレ本文は編集禁止**（`D-535`）なので、採りうるのは (i) 今後の `characters` 削除 down に「利用者データも消す／消さないを明示する」規約を置く、(ii) ロールバック手順書に「head から下げるときは利用者データを退避する」を書く、のどちらか。**判断は設計卓・開発者** |
| **新規／更新** | **新規登録** |

### §4-2 畳む候補（本サブで解消したもの）

| # | スラッグ | 何が起きたか | 新規／更新 |
|---|---|---|---|
| 1 | **`calc-recipe-hash-three-implementations`**（§AA） | **本サブで解消。** 3 実装 → `internal/recipehash` 1 本。`canonicalModifiersJSON` / `emptyRecipeHash` も同じ手番で統合（`grep -rn "emptyRecipeHash\|canonicalModifiersJSON\|sortStepsByOrder" --include=*.go .` = **0 件**） | **更新 → 完了** |
| 2 | **`CO-012`**（§E の集約文内「TOML 全再エンコード＋アトミック書込重複」） | **本サブで解消。** 同集約文は複数項目をまとめているため、**`CO-012` の部分だけを畳む必要がある** | **更新 → 部分完了** |

### §4-3 ★失効している記述（**製造が書けない資料にある**・§4.9 否定形確認の結果）

| # | 対象 | 何が失効しているか | 割付の候補 |
|---|---|---|---|
| 1 | **`followup-backlog.md` §E の `check-md-emphasis.sh` 段落（`:174-183`）** | 「**devContainer で常に赤（依存の未導入）**」。**`IMPROVE-01`（2026-08-19・`D-452`）で解消済み**であり、本サブの実測でも `check-artifact-integrity.sh` は違反なし。**★とくに危険なのは後段の運用指示**——「**`check-artifact-integrity.sh` は*この 1 件だけが赤*であることを前提に、件数（違反 1 件）で判断すること**」。**後任がこれを読むと「違反 1 件は正常」と誤読する** | **設計卓が畳む**（`D-382`） |
| 2 | **`docs/instructions/M24-overview.md` §3 の `M24-09b` 行（`:150`）** | 割付に「`check-md-emphasis.sh` の devContainer 依存欠如」が残っている（指示書 §1.1.1 が既に指摘した `E-219` の型） | **設計卓が是正** |
| 3 | `docs/instructions/templates/M{N}-{NN}-{slug}.template.md:46` | 「`check-md-emphasis.sh` のベースラインは **373 → 372** へ下がる」。**過去の 1 事例の作業例だが、現行値（436）と誤読されうる** | **設計卓が判断**（テンプレートは設計卓の領域。**残骸とまでは言えないため「記録」扱いでよい**） |

> **★除外したもの（判定の記録）**——`M22-05:162` / `M22-06:153` / `M22-07b:122` / `M22-08:172` / `M22-08:22` ／ `IMPROVE-01-*.md` の 15 ヒットは、**完了済みマイルストーンの指示書＝当時の記録**として残した。**走査 1 で `docs/` 233 件へ適用したのと同じ基準である**（書き換えると当時の前提が失われる＝`D-535` と同じ考え方）。

### §4-4 ★★E2E flake の 7 件を束ねる先が無い（**サブの新設は開発者の承認事項**）

| 項目 | 内容 |
|---|---|
| **何が起きるか** | **同じ症状（E2E が時々落ちる）の未着手記録が 7 件、別々のスラッグで散らばっている**——`CO-021`（`m14-03b-custom-states-realdata.spec.ts:23`） ／ `CO-022`（`m17-01` spec の初回 attempt） ／ `CO-025`（3 spec クラスタ） ／ `e2e-flaky-isolation` ／ `e2e-sqlite-write-contention`(a) ／ `e2e-flaky-combo-post-500` ／ `e2e-flaky-m18-03c-drainage` |
| **★本サブの実測が示したこと** | **`CO-021` / `CO-022` / `CO-025` の 5 spec は 4 回とも 1 度も落ちていない。** 落ちたのは `m23-09-pre-save-duplicate-dialog.spec.ts` の 2 本で、**`--workers=1` では緑**（教訓 `E-216` の基準＝結果が変わるなら timing ではなく競合）。**E2E は 1 スイートにつき使い捨て DB を 1 個だけ作り全 worker で共有する**（`web/playwright.config.ts` の `webServer` は 1 組・`COMBOMGR_DB_PATH` は 1 個）。**⇒ spec ファイル間でデータが干渉しうる構造である** |
| **★確定した事実 1 件** | **`CO-021` と `CO-025` は同じファイルではない**（指示書 §11-1 が「同じなら 1 件である」としていた点）。`combo-custom-states.spec.ts` と `m14-03b-custom-states-realdata.spec.ts` は `web/e2e/` に**両方実在する別ファイル**である |
| **見立て** | **個別 spec の問題ではなく、スイート全体（1 個の DB を全 worker で共有する構造）の問題である。** `m23-close-report` §7-1 の見立てを本サブの実測が支持した。**⇒ `CO-025` の 3 spec を直しても他は残る** |
| **割付の候補** | **★「fe-e2e 安定化サブ」は `M24-overview` v1.1.0 のサブ分割 11 本に存在しない**（指示書 §11-1 が実査済み）。**⇒ サブの新設は開発者の承認事項。** `M24-overview` §2.3 の「割付先が消えている」表（`SM-051` / `SM-080` / `SM-098` / `SM-149`）へ `CO-021` / `CO-022` を足すのが素直だが、**7 件を 1 つの束として扱う先を決めるほうが実質的である** |
| **新規／更新** | **更新**（既存 7 行の割付欄）。**表そのものへの新規行は不要** |

### §4-5 ★`scripts/check-progress-log-index.sh` が偽の緑を返す（**新規登録**）

| 項目 | 内容 |
|---|---|
| **スラッグ（案）** | `check-progress-log-index-substring-false-green` |
| **何が起きるか** | **同スクリプトの照合が部分文字列一致（`grep -qiF -- "$id" "$logfile"`）であるため、`progress-log.md` 内で他エントリが当該 ID を前方参照しているだけで緑を返す。** |
| **再現条件・根拠** | **本サブで実際に踏んだ。** `M24-09b` の索引行が未追記の状態で `exit 0`（`OK 検査した 56 件すべてが progress-log に現れる`）。原因は **M23-10 の横断課題が本サブを「候補」として前方参照している 2 行**（`progress-log.md:4803` / `:4812`）。**★レビュー担当が独立に検出した**（レビュー報告 高-1 後段） |
| **なぜ実害があるか** | **`CLAUDE.md` §8 の索引行追記は「指示書が求めていなくても行う」二重化された要求であり、その検査が構造的に空振りする。** **M19-04b / 04d で実際に追記が落ちた前例があり、そのために置かれた検査である** |
| **割付の候補** | **改善レーン**（スクリプト本体の改修。**本サブでは触っていない**——レビュー自身が「改善レーンの手番」と明記）。**修正案＝見出し行（`### <ID>:`）との一致に絞る** |
| **新規／更新** | **新規登録** |

### §4-6 ★`internal/config.replaceAtomically` の `f.Sync()` を守るテストが無い（**新規登録**）

| 項目 | 内容 |
|---|---|
| **スラッグ（案）** | `config-save-fsync-untested` |
| **何が起きるか** | **`replaceAtomically` が守る不変条件は (a) 一時ファイル経由＋`os.Rename` と (b) rename 前の `f.Sync()` の 2 つだが、テストは (a) しか守っていない。`f.Sync()` の 1 行を削っても 3 本とも緑のままである** |
| **根拠** | `internal/config/save_atomic_test.go` の 3 本（`TestSave_WriteFailure_LeavesExistingFileIntact` / `TestSave_Success_ReplacesCompletelyAndLeavesNoTemp` / `TestSave_CreatesFileWhenAbsent`）。**(a) 側は破壊確認 2（直接上書きへ差し替え）で赤くなることを実証済み** |
| **なぜテストで守らなかったか** | **`fsync` の呼び出し有無をテストから観測するには `os.File` を挟むインタフェースが要る。それは「使われるか分からない抽象」であり、指示書 §4.4 末尾とチェックリスト §5 が明示的に避けよと書いているものである** |
| **割付の候補** | **未割付。判断材料として登録する**（(b) は「書込*中*にプロセスが落ちる」ケースのための行であり、現時点では**コードの構造としてのみ担保されている**） |
| **新規／更新** | **新規登録** |

### §4-7 `e2e-suite-rewrites-config-toml-comments` へ添える材料（**既存行の更新**）

**機序が確定した。** `PUT /api/config` → `Update()` → `configForPersistence()` → `Save()` → **`toml.NewEncoder(&buf).Encode(cfg)`**。**エンコーダは構造体から TOML を丸ごと生成し、元ファイルを 1 バイトも読まない。** ⇒ コメント・空行・キー順・インデントは入力に存在しないので出力にも存在しない。`[defaults]` が増えるのは `Config` 構造体が同セクションを持つのに `config.toml.example` に書かれていないため。

**★実装の見通し（次の担当が測り直さずに済むように）**——**「前段（`encodeTOML`）を差し替えるだけ」では済まない見込みである。** 現行の `github.com/BurntSushi/toml` に**コメントを保持したまま値を書き換える API が無い**。実現するなら **(i) 別ライブラリの Document API**（＝**新規依存の追加**。`CLAUDE.md` §6 で開発者への提案が必須）か **(ii) 自前の行単位パッチャ**のどちらかで、**いずれも「挙動の変更」である。**

### §4-8 `CO-006` の残り（**既存行の更新**）

**149 か所 / 35 ファイル中、寄せたのは 16 か所 / 4 ファイル（149 → 133）。** 寄せ先の道具（`internal/testutil/dbtest.Insert`。**既定値を 1 つも埋めない設計**で、その性質自体を `pragma_table_info` の `dflt_value` と突合するテストが固定している）は用意したので、**後続は 1 か所ずつ足せる。** 残りを寄せなかった理由は列集合が 1 か所ずつ違い、**既定値を試すために意図的に列を省いているものがある**ため（指示書 §4.3 が低優先・後回し可と明記）。

---

## §5 参考（触れていない＝不変の証跡）

- `migrations/` — `git diff --stat 210ab49 -- migrations/` **空**（消費 0 本・最終連番 `000078` のまま）
- `web/` — `git diff --stat 210ab49 -- web/` **空**（`pnpm test` 182 files / 1829 tests が着手前と同一）
- `internal/api/` — 差分 0 バイト（`DES-002` §4.2 の経路表は不変）
- `internal/service/notation/` ／ `internal/service/preset/` — 差分 0 バイト（契約 F-1）
- `docs/design/` — 差分 0 バイト
- `docs/handover/followup-backlog.md` — 差分 0 バイト（`D-382`）
- `scripts/` — 差分 0 バイト（`check-md-emphasis.sh` の依存判定を緩めていない）
- 既存の契約テスト — `TestCalcRecipeHash_Deterministic` / `_StepOrderInvariant` / `_FlagsOrderInvariant` / `_DifferentRecipes_DifferentHashes` / `_NullMoveID` / `_EmptyRecipe` / `_ModifiersNilVsEmpty` の 7 本すべて緑
- `make e2e` **175 passed / 0 failed**（着手前と同一） ／ `go test ./... -count=1` **55 パッケージ ok / FAIL 0**

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**本サブは CHANGE を 0 件消費した。** 指示書 §9.4 の 3 条件はいずれも不発動:

1. `DES-002` §4.2 の経路表に載る API の挙動変更 — **なし**（`internal/api/` 差分 0 バイト）
2. `DES-003` のスキーマ・論理削除の契約 — **触れていない**（`migrations/` 差分 0 バイト）
3. `VAL-C02` の判定結果の変化 — **なし**（§1-2 の golden 対照で実測済み）

**⇒ 本サブ単体では CHANGE の起票を要さない。** ただし次の 2 つは設計卓の判断で起票対象になりうる:

- **§1-1 / §1-3 の `SUPP-001` 反映**（`internal/recipehash/` の追記 ／ config.toml 書き戻し経路の一本化）。**doc 限定の CHANGE で足りる見込み。**
- **§2-1 の裁定結果**（`M24-overview` §5.2 の交差表の是正）。**overview の改版で足りるなら CHANGE 不要。**

**マイグレ連番**: **本サブは 0 本消費した。** `ls migrations/` の実査値の最終連番は **`000078_add_combos_superseded_by`**（着手前と同じ）。**ボード §2.2 の「次に払い出す番号」とのずれは生じていない。**

**CHANGE 番号**: **払い出していない。** `change-number-registry.md` §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 の 4 か所とも更新不要。

---

## §7 教訓（retrospective 行き）

> **★親は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映で、実施者は設計担当。

1. **★★「N 件だけである」の N は、母集合を宣言してから数える。キーワードを 2 通り当てても母集合が狭ければ件数は動かない。** 本サブの §4.9 走査 2 は、指示書が「本番コード ／ テスト資産 ／ 設計文書・指示書」と指定した母集合に対し、**手で選んだ集合へ当てていた。しかもその中の指示書 1 本は、既に残骸と判っていたものだった**——**答えを知ってから母集合を選ぶ形**である。指定どおりに当て直したら結論は変わらなかったが、**「変わらない」を実測で言えることが成果物だった。** `E-236` は「走査を 2 通り以上当ててから数える」と書いているが、**それはキーワードの話であって母集合の話ではない。⇒ 母集合の宣言を `E-236` の対に置く。**

2. **★★工程順として「まだ無い」ものを、完了報告に過去形で書かない。** 本サブは「progress-log へ索引行を追記した」「設計伝達レポート §4 へ並べた」を過去形で断定したが、**どちらも Phase D／Phase C 後の工程であり、報告を書いた時点では存在しなかった。** **★工程順としては正しく、誤りは申告の側だけである**——だからこそ気づきにくい。**⇒ 完了報告のテンプレートで、レビュー後に実施する工程（索引行・設計伝達レポート）は「〜する（Phase X）」の形に固定する。** `E-189` / `E-193` / `E-242` の亜種。

3. **★★機械検査が「緑」を返しても、その緑が何を見た結果かを 1 度読む。** `check-progress-log-index.sh` は照合が部分文字列一致であるため、**他エントリからの前方参照でヒットするだけで緑になる。本サブで実際に踏んだ**（索引行が未追記の状態で `exit 0`）。**★これは `check-artifact-integrity.sh` が「他の検査の緑が信用できるか」を見るという設計思想の、まだ塞がっていない側である**——同スクリプトは各検査の**対照が走った証拠**は見るが、**照合ロジックの精度**までは見ない。**⇒ 「ID が現れる」型の検査は、現れ方（見出しか本文か）まで指定する。**

4. **★「重複を寄せる」判断の前に、重複の実体を実査する。指示書の面の記述は当たっていないことがある。** 本サブは `CO-012` の面として `internal/api/config/` を指定されたが、**同ディレクトリに TOML 書込は 1 行も無かった。** 指示書 §3.3-4 が「重複の中身が分からないと寄せ先が層をまたぐかも決まらない」として実査を課していたのが効いた。**⇒ 「どこにあるか」を書いた指示書は、その所在自体を実査項目に含める。**

5. **★統合の成果を守るには、統合先の公開面を絞る。** レビュー中-4 の指摘。`Calc` / `CanonicalModifiersJSON` / `EmptyHash` を公開したままだと、**2 つの入口を経由しない 3 つ目の呼び元が生えうる**——統合前の状態（呼ぶ場所ごとに独立実装）へ**別の形で**戻ることである。**⇒ 「N 実装を 1 本へ寄せる」サブでは、寄せた後の公開面が本番の必要と一致しているかを DoD に入れる。** 内部テストパッケージにすれば非公開のまま同じ主張が書ける。

6. **★統合前の実測値を、統合後のテストの期待値に据える。** 本サブは統合**前**に 3 実装へプローブを入れて 9 入力クラスの値を採り、**その値を golden として固定**した。結果として「統合前 = 統合後」がテストを信じずに独立検証できる形になり、**レビュー担当が `sha256sum` で 6 本を再計算して裏取りできた。** **⇒ 「型検査が守ってくれない」統合の標準手順にする。**

7. **★破壊確認は「どの経路が赤くなったか」を数えると、統合の完了を証明できる。** 統合後の 1 本を壊したとき **3 経路すべてが赤くなり、赤くならない経路が 0 件**であることを数えた。**「テストが赤くなった」では、経路が 1 本だけ繋がっていない状態を見逃す。** 指示書 §5.3-3 の形は再利用する価値がある。

8. **★flaky の切り分けは「隔離」と「直列」の 2 手で足りることが多い。** 本サブは `make e2e` 3 回で 1 回だけ 2 本が落ち、**`--workers=1` で緑になった**ことから timing ではなく競合と判定できた（`E-216`）。**★あわせて「落ちた spec 名を全部記録する」だけで、別の 2 件（`CO-021` / `CO-022`）の実測が追加費用ゼロで取れた。**

9. **★調査だけで終わるサブでは、実測が汚染されていないことの証跡を先に置く。** ポートが空であることを各回の直前に確認した（指示書 §2.4-1）。**汚染された実測は、実測が無いより悪い**——「3 spec に固定して flaky」という誤った結論が、恒久対策の要否の判断をそのまま誤らせる。

---

*以上、M24-09b 設計伝達レポート。*
