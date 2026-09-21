# M33-03 完了報告 — ガードと資料の作り直し

| 項目 | 内容 |
|------|------|
| 作業 ID | `M33-03` |
| 指示書 | `docs/instructions/M33-03-guards-docs-and-migration-path.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M33-03-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-19 |
| ブランチ | `claude/keen-hypatia-imze0q` |
| 着手基点 | **`9de8fa9`** |
| マイグレ消費 | **0 本**（`ls migrations/*.up.sql` は **9 本**のまま） |
| CHANGE 消費 | **0 本**（自採番していない＝`D-293`。原稿は設計伝達レポート §1 / §6 へ） |

---

## 0. 数値の読み方

**「実測」は本手番で実際にコマンドを流して得た値。「算出」は実測値から計算した値。「引用」は他資料の値。**

---

## 1. 着手前の版ゲート（指示書 §0.4）— **6 点とも通過**

| # | 確かめたこと | 結果 | 種別 |
|---|---|---|---|
| 1 | チェックリストの存在 | あり（8104 bytes・2026-09-19 発行） | 実測 |
| 2 | `ls migrations/*.up.sql` が 9 本・`000001`〜`000009` | **9 本・欠番 0** | 実測 |
| 3 | `go test ./...` が EXIT=1・赤は 2 パッケージだけ | **EXIT=1 / `--- FAIL` 158 / `internal/infra/migration` ＋ `internal/seedgen` の 2 本だけ（3 本目なし）** | 実測 |
| 4 | `bash scripts/check-migration-license.sh` が EXIT=0 | **EXIT=0** ／ `--self-test` **11 対照すべて OK** | 実測 |
| 5 | `SUPP-001` §2.7 が「9 本・`000001`〜`000009`・欠番 0 件」 | 記載あり（`CHANGE-221` 反映済み） | 実測 |
| 6 | 枝元 | `9de8fa9`（`Merge pull request #236`） | 実測 |

---

## 2. 開発者裁定（2026-09-19・本手番で得たもの）

**★製造の独断ではない。⇒ 5 件とも照会して裁定を得た。**

| # | 事項 | 裁定 |
|---|---|---|
| 1 | golden 17 stem の処遇 | **`testdata/` へ凍結 golden ＋ 意味比較 1 本**。★「仮に CSV と SQL のドリフトが疑われた場合は報告」 |
| 2 | ガードの穴 | **両方やる**（規則 (4) の実効化 ＋ `has_data` 側へ書き込み先検査） |
| 3 | 移行手順 | **最小限のプロンプト 1 枚。★乾式検証は行わない**（⇒ §7 に未充足として明記） |
| 4 | 新系列の down 往復テスト | **新設する** |
| 5 | 失効参照の射程 | **フロントも含めて全部直す** |
| 6 | `internal/seedgen/testdata/**` の層 | **`REUSE.toml` の層 B へ 1 行足す**（§5.4） |

---

## 3. 段 1 — 失効参照の是正

### 3.1 数え方（★出力をファイルへ全量落として `wc -l`。`head`/`tail` を通していない）

```bash
# 式1: 正しい式（数値の偽陽性を除き、stem 形も拾う）
grep -rnP '(?<![0-9])0000[0-9]{2}(?![0-9])' internal/ cmd/ --include='*.go' \
  | grep -v '_test.go' > tmp/m33-03/refs-go-nontest.txt ; wc -l   # -> 85

# 式2: 完了報告 M33-02 §11 の「65 箇所」式（再現）
grep -rnE "migrations/0000[0-9]{2}|\b0000[0-9]{2}\b" --include='*.go' internal cmd \
  | grep -v "_test.go" ; wc -l                                    # -> 65

# 式3: 素朴な式（偽陽性を含む）
grep -rnE '0000[0-9]{2}' internal/ cmd/ --include='*.go' | grep -v '_test.go' ; wc -l  # -> 92
```

| 指標 | 値 | 種別 |
|---|---|---|
| **正しい式（式1）** | **85** | 実測 |
| `M33-02` の 65 式（式2） | 65 | 実測（再現） |
| 素朴な式（式3） | 92 | 実測 |

**★★指示書・`M33-02` 完了報告が使う「65 箇所」は 20 件を取りこぼしている。**
落ちているのは**すべて「連番の直後が `_` の stem 形」**（`"000026_seed_moves_first_wave"` 等）で、
`\b0000[0-9]{2}\b` は `_` が語構成文字なので後端 `\b` が成立せず、`migrations/` 接頭辞も無いため
両方の選択肢から漏れる。**⇒ 落ちた中に `cmd/seedgen/main.go:142` の既定出力 stem（実コード）が含まれる。**

**★素朴な式（92）に含まれる偽陽性 7 件**（連番ではない）:
`internal/desktop/desktop_windows.go:24-28`（`0x00000000` 等の MessageBox 定数 5 件）／
`internal/api/middleware/logger.go:90`（`"20060102T150405.000000000"` の日時書式）／
`internal/service/auth/password.go:37`（`maxHashIterations = 10000000`）

**★`internal/infra/migration/` の非テストは 0 件**（`migrate.go` 127 行 ＋ `doc.go` 2 行のみ。
141 本の失効はすべて `*_test.go` 側）。⇒ seedgen 族と migration を除いた全数は **25 箇所**。

### 3.2 3 分類の内訳（**seedgen 族を除く 25 箇所**）

| 分類 | 件数 | 扱い |
|---|---|---|
| **(a) 生きた誤参照**（指示書が名指し） | **4** | 直した |
| **(a′) 生きた誤参照（実査で追加発見）** | **5** | 直した（★指示書の表に無い） |
| **(b) 死んだ参照** | **7** | 文言ごと差し替えた |
| **(c) 歴史記述** | **12** | 内容を 1 文字も変えず「**旧**」を明示した |
| **偶然そのまま正しい** | **1** | 注記のみ（+ seedgen 側 1 + E2E 側 1 ＝ 計 3） |

検算: 4 + 5 + 7 + 12 = 28。★(a′) の 1 件はフロント、(b) の 1 件は seedgen と同時処理のため
「25 箇所」より多い（25 は Go の `internal/` / `cmd/` 非テストのみの母数）。

### 3.3 (a) 生きた誤参照 — 指示書が名指しする 4 箇所（`000007` → `000009`）

| file:line | 直したもの |
|---|---|
| `internal/model/tag.go:32` | **番号とファイル名の両方**（正＝`migrations/000009_seed_initial_users_tags.up.sql`） |
| `internal/api/middleware/user.go:30` | `migrations/000007` → `000009` |
| `internal/service/user/service.go:61` | 同上 |
| `internal/service/user/service.go:91` | 同上 |

**★★番号だけ差し替えると別の偽になる。** `tag.go:32-35` と `service.go:91` は
「**同マイグレのヘッダ自身が**『本来は初回起動ウィザードで生成』『M6 着手時に
ウィザード経由生成へ切り替える』**と宣言していた**」と書いていたが、
**新 `000009` のヘッダにその文言は無い**（実測）。⇒ 出所（新 `000009`）と経緯（旧 `000007` の
ヘッダ）を分けて書き直した。

**★値の一致を実測で確かめた**——`tag.go` の 3 行（`使用中/#10B981` / `練習中/#3B82F6` /
`頻度低下/#6B7280`）は `migrations/000009_seed_initial_users_tags.up.sql:16-19` の現物と一致する。

### 3.4 (a′) 実査で追加発見した生きた誤参照 5 箇所

**★指示書の表に無い。⇒ 開発者裁定 5（フロントも含めて全部直す）により射程へ含めた。**

| file:line | 現在形の断定 | 直した先 |
|---|---|---|
| `internal/repository/movecommand/repository.go:3` | 「seed マイグレ(`000035`〜)が**投入し**」 | `000005_data_seed_move_commands` |
| `internal/repository/character/upsert.go:37` | 「classic 5 体は seed `000015` で正規名が**入る想定**」 | `000003_data_seed_characters` |
| `cmd/tacpendium/main.go:702` | 「presets.id は 1 / 3 / 5 と欠番が**あり**(`000069`)」 | `000007`（実測: 新 `000007` の id は 1 / 3 / 5） |
| `web/src/features/combo/inputResolutionStage2.ts:40` | 「索引の実キー(`000035`)と**一致する**表記」 | `000005`（★フロント） |
| `web/.../VirtualController.test.tsx:350` | 「`collar_bone_breaker`(**`000004` 由来**の旧綴り)」 | 旧 `000004_seed_moves_ryu` と明示 |

**★★最後の 1 件が最も危ない形だった**——旧 `000004` は `seed_moves_ryu`（旧綴りの出所）だが、
**新 `000004` は `data_seed_moves` であり `collar_bone_breaker` を 1 件も持たない**
（`grep -c` が **0 件**＝実測）。⇒ 別のファイルを指して存在していた。

### 3.5 (b) 死んだ参照 — 引用先が消滅したもの

`internal/model/move.go:24,26`（`000109` / `000025` → `000004_data_seed_moves`）／
`internal/model/combo.go:280,287`（`000038` / `000078` → `000001_init_schema`）／
`internal/repository/combo/repository.go:1560`（`000078` → `000001_init_schema`）／
`internal/repository/preset/repository.go:314`（`000074` → `000001_init_schema:106`）／
`internal/moveindex/moveindex.go:14`（4 stem の名指し → 表名ベース）

**★★逐語引用であり、引用先が消滅していた。**
対象は `internal/repository/preset/queries.go:129` と `internal/service/preset/service.go:276`。
旧 `000075` のヘッダの「★DB では守れないもの」を
引用していたが、`grep -rn "DB では守れない" migrations/` が **0 件**（実測）。
⇒ 正本を `DES-003` §3.9 / `D-317` へ寄せ、旧 `000075` が明文化していた経緯として残した。

**★旧番号を来歴として残す書き方は、新系列自身の慣習である。**
`migrations/000001_init_schema.up.sql:106` 自身が `-- ★FK ではない(000074 の as-built)` と
書いている。⇒ 本手番もそれに倣った。

### 3.6 (c) 歴史記述 — 「旧」を明示した（★1 件ずつ見た）

内容を 1 文字も変えず、番号の前に「旧」を付けた。⇒ 指示書 §2.1-(c) の
「★ただし『旧系列の』と読めるかを 1 件ずつ見ること」に対する一律の答えである。

**是正後の残存**: `grep -rnP '(?<![0-9])0000(1[0-9]|[2-9][0-9])(?![0-9])' internal/ cmd/ --include='*.go' | grep -v '_test.go'`
は **73 行**（seedgen 族込み）。seedgen 族を除くと **14 行**である。
**⇒ 14 行すべてが「旧」明示または `M33-02` の経緯の説明である**（実測・目視全数）。

### 3.7 「偶然そのまま正しい」箇所（★指示書 §2.1 が明記を求めている）

| file:line | 内容 | なぜ偶然か |
|---|---|---|
| `internal/repository/tag/repository.go:196` | `combo_tags は ON DELETE CASCADE(migrations/000001)` | 新 `000001` も最終スキーマ |
| `internal/seedgen/model.go:63` | `moves.category の enum(000001 コメント)` | 同上 |
| **`web/e2e/m22-03-optimistic-locking.spec.ts:74`** | `新規行は version = 1(migrations/000001 の NOT NULL DEFAULT 1)` | 同上。**★指示書が挙げた 2 箇所に入っていない実査の追加分**（実測: `000001_init_schema.up.sql:130,155` に `version INTEGER NOT NULL DEFAULT 1`） |

**★★次に連番の起点が動いたら 3 箇所とも壊れる。** ⇒ 「偶然正しい」は「正しい」ではない。

### 3.8 フロントと E2E（★開発者裁定 5）

| 母数 | 件数 | 扱い |
|---|---|---|
| `web/src` 非テスト | **4** | 1 件が生きた誤参照（§3.4）、3 件は「旧」明示 |
| `web/src` テスト | **6** | 1 件が生きた誤参照（§3.4）、5 件は新系列の実体へ／「旧」明示 |
| `web/e2e` spec | **29** | **4 件は現在形が偽**（「前提: 使い捨て DB(マイグレ `000078` まで適用済み)」等）⇒ 新系列の終端へ。ほかは新系列の実体へ／「旧」明示 |

**★`D-881` の再発防止**——「Go だけ見てフロントを取りこぼした」先例があるため `--include` を
Go に絞らずに走査した。⇒ **絞っていたら 10 件（うち生きた誤参照 2 件）を落としていた。**

### 3.9 `.claude/commands/precheck_seed_data.md:138` の扱いと理由

**歴史注記化を採った。** ⇒ 理由は実測である:

**新 `000008_data_seed_preset_aliases.up.sql` は `move_code` を 1 件も含まない**
（`move_id` で持つ。`grep -c 'tatsumaki_senpu_kyaku'` が新 `000008` で **0 件** ／ 旧 `000072` で **8 件**）。
⇒ 「`ken/tatsumaki_senpu_kyaku_od` が存在しない」という形の裏取りを新系列へ差し替えると、
**どの技でも 0 件になり「常に通る空の検査」になる。** ★差し替えも `ALLOW` も不正確である。

⇒ 「2026-08-19 実測（当時の旧 `000072`）」と明記し、
**新系列では同じ形で再現できない旨と、DB へ問う代替手順**を書いた。
`migrations/` 接頭辞を落としたため **`check-doc-refs.sh` の dead reference は 1 件 → 0 件**（実測）。
`:40`（`000049`）と `:48`（`000064`/`000067`/`000068`）も同型なので「旧」を明示した。

---

## 4. 段 2 — 歴史テスト 141 本の処遇

### 4.1 ★★分類の内訳（**合計 141・検算済み**）

| 分類 | 件数 | 扱い |
|---|---|---|
| **(i) 旧版数の適用/巻き戻しそのものを主張** | **102** | **消した** |
| **(ii) 最終状態の主張で版数は手段** | **34** | **書き直した**（緑） |
| **(iii) 判断がつかない** | **5** | **開発者へ諮った** ⇒ 裁定を得て書き直した |
| 合計 | **141** | 検算: 102 + 34 + 5 = 141 |

**★「141 本を処理した」では足りないので分けて書く**（指示書 §4.1 / チェックリスト B-1）。

#### (i) 102 本の内訳

| 型 | 件数 | 根拠 |
|---|---|---|
| 機械判定（本体で `m.Migrate` を 2 回以上 or `m.Steps` を使う） | **94** | 実測（`tmp/m33-03/dan2-classify.txt`） |
| **書き直しを試みて (i) と判明** | **8** | 実測 |

**★★機械判定を鵜呑みにせず、書き直してから再分類した 8 本**（doc がいずれも
「`000NNN` の**直後の状態**」と明記していた＝新系列に「直後」が存在しない）:
`TestRun_M19P2_BeforeState` / `TestRun_M19P2_ManualBackfill` / `TestRun_M19P2_FrameCorrection` /
`TestRun_M19P2b_BeforeState` / `TestRun_M19P2b_RenameAndBasis` / `TestRun_M19P2b_Addendum` /
`TestRun_M3704_FirstHitStartupColumnAddedEmpty` /
`TestRun_Migration000017_SeedCleanupAndRyuUnification`

**(i) と (ii) を分けた問い＝「新系列でも同じことを言いたいか」**（指示書 §2.2）。

### 4.2 ★★★根本原因を先に潰した — `versionBefore`

`internal/infra/migration/migrate_test.go` の `versionBefore(t, target)` は `migrations/` の
実物から `v < target` の最大を返す。
**★新系列では `versionBefore(t, 110)` が黙って 9（＝HEAD）を返す**
（`t.Fatalf` は `best == 0` のときだけ）。

⇒ これが `migrate_m3105_test.go:390` の「陽性対照が崩れている: dhalsim の投入前タブ = 7 件, want 0」
**3 行の直因**であり、**唯一の `no migration found` 以外の実アサーション失敗**だった。
★先に潰さないと、書き直したテストが同じ形を再生産する。

**★★副産物 = `TestRun_M3503_FreshDBIsAlreadyCorrectBeforeTerminus` は緑だった。**
⇒ 141 本に入っていない。しかしそれは `versionBefore` が HEAD を返していたからであり、
「`000111` を通す前」という前提は新系列に存在しない。⇒ **緑だったが誤りなので消した**（141 の外の 1 本）。

### 4.3 (ii) 34 本の書き直し方針 — **件数の固定をやめた**

着手時点の (ii) は「その波の母数」を期待値に写していた。⇒ 後続の seed 波で必ず落ちる
（`SUPP-001` §5.5.7 (i) が警告している型）。**主張の芯を残して構造の主張へ置き換えた。**

| テスト | 着手時点 | 書き直し後 |
|---|---|---|
| `TestRun_M1403b_SeedIntegrity` | `characters = 12` / `9 移動を持つキャラ = 12` | **「9 移動を持つキャラ数 == characters 全数」**。★12 を写す形は 13 キャラ目が 9 移動を持たなくても緑になる ⇒ **主張は強くなった** |
| 同上（`show_delta`） | `show_delta=true state = 5` | **「flag な state に `show_delta` が付いている行 = 0」**（★これが本来の主張） |
| 同上（`juri`） | `state 数 = 2` | **`fuha_stock` / `feng_shui_engine` を名指し**（現在 3 state） |
| `TestRun_M1403c_UpContract` | `ryu moves = 93（CSV 84 + 移動 9）` | **CSV との集合突き合わせ**（`assertCharMovesMatchCSV`） |
| `TestRun_M1403d_UpContract` | `manon moves = 81（CSV 72 + 移動 9）` | 同上 |
| `TestRun_M1403f_JumpNormalsHaveNoParent` | `jump_* を親にする行 = 52` | **「0 でない」**（★捕まえたいのは「ガードが広すぎて②まで消えた」＝0 になる形だけ） |
| `TestRun_M1904c_CorrectedState` | `is_projectile=1 = 135` | **母数の生存確認のみ**（★名指し 3 行の主張が本体） |
| `TestRun_M2006_P34Rows` | 非 system 全行で `= 13` | **母集団を P-34 対象集合へ閉じて `= 13`**（ガードの強さは不変） |

**★★★「+9」の前提そのものが失効していた**——実測で **ryu の system move は 11 種**
（移動 9 ＋ `drive_parry` ＋ `drive_reversal`）。⇒ 件数を再実測して 94 に直すだけでは、
**次に全キャラへ system move を足した瞬間に同じ手番が要る。**
CSV は seed の正本（`SUPP-001` §5.5 規約 (19)）なので、突き合わせへ変えた。
**★突き合わせは件数より強い**——「84 行」は 1 行入れ替わっても緑になる。

### 4.4 (iii) 5 本 — 諮って裁定を得た（`rules_m1905_test.go`）

**★勝手に消していない**（指示書 §2.2-3 / §7-1）。一覧を出して止まり、開発者へ諮った。

**諮った理由**: 主張の芯は `setplay.ProjectCandidates` のゲート規則であってマイグレの話ではない
（＝「いま要る」側）。しかし期待値がすべて **v68・17 キャラ時点の実測値**であり、
**同ファイルのヘッダ自身が**「本ファイルは `dbtest.Setup`（= HEAD まで適用）を使わず
`m1905Version(68)` へ版を固定する。HEAD で走らせると残り 14 キャラの seed 波が入った瞬間に落ちる」
「HEAD スコープの不変条件は `TestRun_HEAD_*` の名前空間が持つべきであり、サブ名の名前空間へ
相乗りさせない」**と宣言していた。⇒ 版を固定する機構が消えたため、どちらの読みも成立する。**

**裁定 = 構造の主張へ書き換えて残す。**

#### ★なぜ書き換えがトートロジーにならないか

同ファイルのコメントが設計を書いている:
- `:161`「**旧規則(対照群)と新規則(本番の `ProjectCandidates` 経由)を同じ DB で並べて測り**」
- `:402`「**新側の実測は `ProjectCandidates` 経由で行う(規則を二重に持たない)**」

⇒ **旧規則＝テスト内の SQL 述語 ／ 新規則＝本番の Go 実装。**
凍結リテラルはその差分を v68 で撮った写真にすぎない。
⇒ 差分を「凍結リストと一致するか」ではなく「**ゲート述語の集合と一致するか**」で見れば、
**Go 実装と SQL 述語の突き合わせ**になり seed 波に依存しない。

**★この形はテストの中に既に半分在った**——検算「`after = before + 4 - 16`」は
*measured な before / after* と *凍結した 4 / 16* を混ぜていた。⇒ ゲートの大きさも測れば、
同じ検算がそのまま drift-proof になる。

#### ★★実測で分かったこと — 旧テストの主張が 17 キャラ時点でしか成り立っていなかった

旧 `TestM1905_TargetGateSwitch` は「**除外 23 行の理由は `fastest_unreachable` ただ 1 つである**」と
主張していたが、HEAD では **(b) 単独入力不可だけで落ちる行が 12 行ある**
（`ken`/`ryu`/`luke`/`rashid`/`zangief` の `aerial_*` 系。実測でいずれも `is_aerial=0`・
`is_derived=0`・`fastest_unreachable=0`・`basis=standalone` で親参照を持つ）。
⇒ 新ゲートは `is_derived` を「basis ＋ 親参照」へ切り替えたので **(b) も効く**。
**★「理由は 1 つ」は*たまたま*成り立っていただけである。** ⇒ 述語を 2 系統へ是正した。

#### 実測ログ

```
filler 候補: 旧規則 2730 -> 新規則 2630 (ゲート 1 で +8 / ゲート 2 で -108)
target 候補: 旧ゲート 1643 -> 新ゲート 1742 (解禁 138 / 除外 39)
チェーングループ員 93 行・うち単独入力不可 4 行（全数が連打版）
```

**★v68 の凍結リストはコメントとして残した。** ⇒ **当時*人が確認した*列挙**であり、
述語へ置き換えると人手レビューの痕跡が消える。

### 4.5 ★HEAD スコープへ 2 本引き上げた（`migrate_head_test.go`）

| テスト | 出所 | 何を見るか |
|---|---|---|
| **`TestRun_HEAD_DownUpRoundTrip`** | **新設**（開発者裁定 4） | 新系列の down が up を巻き戻し、再 up で復帰する。★down 全戻しで表が 0 になることまで見る |
| **`TestRun_HEAD_StartupBasisPartitionsAllMoves`** | 旧 `TestRun_M19P2_ManualBackfill` から | `startup_basis` が `moves` の全行をちょうど 3 値へ分割する。★件数を書かない |

**★★★新系列 9 本の `.down.sql` は 1 本もテストされていなかった。**
⇒ `TestRun_HEAD_DownUpRoundTrip` を入れるまでである。★48 本を消した穴ではなく、
**着手時点から空いていた穴**である。

#### ★★引き上げ*なかった*もの — `D-187` の不変条件（**申し送り事項**）

旧 `TestRun_M19P2_ManualBackfill` は「`startup IS NULL` なら `startup_basis` は `unknown`」
（`D-187` の是正）を主張していたが、**HEAD では 132 行が違反している**（実測）。
⇒ **不変条件として成立しないので引き上げなかった。**

**★旧テストは v64 でしか見ていなかったため、誰も気づいていない。**
⇒ データ品質の課題として設計伝達レポート §4 へ原稿を回す。

##### ★★【2026-09-19 追記】132 行の内訳を実測した ＝ 開発者裁定を受けて確定

**★上の「132 行が違反」だけでは「データが壊れている」と読める。実態は違う。**
新 baseline を in-memory SQLite へ適用して実測した（`migrations/000001` → `000004` を `executescript`）。

| 内訳 | 行数 | 備考 |
|---|---|---|
| `category='system'`（移動 move 9 種） | **126** | **14 キャラ × 9** |
| `category='target_combo'` | 4 | `chun_li/soaring_eagle_punches` ／ `dee_jay/party_in_the_air` ／ `elena/soaring_raid` ／ `elena/raptor_range` |
| `category='special'` | 2 | `blanka/blanka_chan_bomb_activated` ／ 同 `_od` |
| **計** | **132** | すべて `startup_basis='standalone'` ∧ `startup IS NULL` |

**★★14 キャラは第四波そのものである**——`aki` `akuma` `alex` `blanka` `c_viper` `cammy`
`chun_li` `dee_jay` `dhalsim` `e_honda` `ed` `elena` `sagat` `yasmine`。
旧 `000084_seed_moves_fourth_wave.up.sql` の見出しの逐語＝「第四波 14 キャラ（未 seed 12 + 仮登録 2）」。
非 system の 6 行も**同じ 14 キャラのうち 4 キャラに閉じる**。

**⇒ 原因は 1 つである。** `D-187` の是正（旧 `000065`・153 行＝既 seed 11 キャラ 99 ＋ 第三波 54）は
第三波までの母集団にしか当たっておらず、第四波の backfill（旧 `000089`。逐語「CSV 由来 …
`AND startup_basis = 'unknown'`」）が CSV の `standalone` を入れ直した。
**★ガードが v64 固定だったので、この再発を誰も見られなかった。**

**★★同じファイルの中に「正しい値」の対照が在る。** `drive_reversal` も `category='system'` ∧
`startup IS NULL` だが、**31 キャラすべてが `unknown` である**。
⇒ **マイグレ SQL 自身の慣習が `unknown` であり、126 行はその規則の適用漏れである。**

**★★CSV とマイグレ SQL の揺らぎではない**（実測）。

| 測ったこと | 結果 |
|---|---|
| CSV 2743 行 ↔ DB の `startup_basis` の突合 | **不一致 0 件** |
| 31 個の CSV に移動 system move（`forward` 等 9 種）が在るか | **1 行も無い** ⇒ 126 行は**マイグレ SQL のみ**が源泉 |
| CSV 側の違反（`startup` 空欄 ∧ `startup_basis` が `unknown` 以外） | **6 行だけ** ＝ 非 system の 6 行と完全一致 |

**★punishfinder の穴と同じ 4 行である。** `usesFirstHitStartup` の述語
（`target_combo` ∧ `is_derived` ∧ `standalone`）は HEAD で 110 行あり、
**うち `first_hit_startup` 未記入の 4 行が上の `target_combo` 4 行と完全に一致する**。
`candidateStartup` は `nil` を返して候補から落とすので、**偽陽性は出ていない**（fail-closed）。
⇒ **いま実害は無い。純粋にデータの一貫性の問題である。**

> **開発者裁定 2026-09-19（逐語）**:
>
> **発生フレームを持たない技はunknownへ修正**

⇒ `D-187` の主張は**撤回しない**。132 行すべてが是正対象である。
**★ただし是正は本サブではできない**——`TestCSVAndDBAgreeOnFrameCostColumns`
（`internal/infra/migration/csv_db_sync_test.go:121,143`）が CSV↔DB を `startup_basis` で
突合しているため、**追随マイグレの無い CSV 修正は即赤になる**。
⇒ CSV 正本 ＋ 是正マイグレ（`000010`）は同じ手番でしか落とせず、
**本サブはマイグレ消費 0 本が射程条件である**（指示書 G-1 / G-7 ／ チェックリスト §0 の ★7）。
**⇒ 是正は別サブ。手順は設計伝達レポート §4-1 の §J 原稿に書いた。**

### 4.6 構造 — `helpers_test.go` を新設

`newMigrator`（**25 ファイルが利用**）／ `scanInt`（**20 ファイル**）／ `fkCheck`（4 ファイル）／
`scanStr` ／ `aliasText` を寄せた。**★同名の事前確認済み**（`E-225`）。

**理由**: サブ名のファイルは、そのサブの主張が失効したときに丸ごと消える。
**実際に本手番で 13 ファイルが「テスト 0 本」になって消えた。** ★共通の足場がその中に
混ざっていると、消す手番で気づかないまま連鎖して壊れる。
（`newMigrator` は `migrate_m1403b_test.go`、`fkCheck` は `migrate_m1403c_test.go` に住んでいた。）

**削除したファイル: 15**（`internal/infra/migration/` のテスト 13 本 ＋ ほか）。
**未使用になった宣言 25 件も削除。**

**★`template_exclusion_test.go` の `dbtest.DisableTemplate()` 除外は維持した**
（このパッケージはマイグレの適用過程そのものを検証するため）。

---

## 5. 段 3 — golden 17 stem の作り直し

### 5.1 ★★byte 一致は新系列に対して構造的に再建できない（諮って裁定を得た）

| 面 | 実測 |
|---|---|
| seedgen の出力 | `INSERT INTO moves (character_id, code, ...)` **12 列** ＋ `SELECT ... FROM characters c CROSS JOIN (...)` |
| 新 `000004_data_seed_moves` | **id 明示の `VALUES` タプル 22 列**。さらに自己参照 **514 行**を「NULL で入れてから `UPDATE`」の 2 パスで解く |

⇒ **seedgen にその生成能力は無い。**
さらに **`is_derived` backfill 系 4 stem は対応先の SQL ファイルそのものが存在しない**
（列値として `000004` に溶けた）。⇒ **stem 単位の対応が原理的に付かない。**

**★`SUPP-001` §5.5 規約 (19) の 3 点セットは適用できない**——同規約は
「**CSV の 1 値が間違っていた**」場面の手順であり（手順 3 が「データ修正マイグレを置く」）、
「**対象ファイルが消えた**」場面を覆っていない。⇒ 設計伝達レポート §1 / §6 へ原稿を回す。

### 5.2 比較先を `migrations/` → `internal/seedgen/testdata/` へ

- **17 stem × up/down = 34 ファイル**を現 CSV からの生成物として凍結（★同名の事前確認済み）
- `assertGolden` の探索先を `testdata` へ。**失効したメッセージを書き換えた**
  （「★適用済みマイグレなら上書き再生成してはならない」）
- `generate_test.go` のインライン比較 2 本を `assertGolden` へ統一（着手時点は 2 本だけ別実装）
- **17 本は (ii) 扱い。消したのは 0 本**

### 5.3 ★★★凍結が忠実であることを実測で示した（**ドリフト 0**）

**開発者の指示「仮に CSV と SQL のドリフトが疑われた場合は報告」への回答である。**

```bash
for f in internal/seedgen/testdata/*.sql; do
  n=$(basename $f)
  git show "b5cd716^:migrations/$n" > /tmp/old.sql
  diff -q <(grep -v '^--' /tmp/old.sql) <(grep -v '^--' $f)
done
#   -> ドリフトのあった stem ファイル数: 0 / 34
```

**⇒ ドリフトは無い。凍結したのは、適用され検証された SQL そのものである**
（差分はヘッダのコメント行だけであり、それは §5.5 で意図的に直したものである）。

### 5.4 ★★★段 3 が作った新しいライセンスの穴（**同じ手番で塞いだ**）

**`internal/seedgen/testdata/**` は SF6 の事実を含む層 B の素材だが、実測でこうなっていた:**

| # | 実測 |
|---|---|
| 1 | `REUSE.toml` の層 B グロブは `character_data/**` / `docs/seed-data/**` / `migrations/*_data_*.sql` の **3 つだけ** ⇒ 既定の `path = "**"` へ落ちて **`AGPL-3.0-or-later`（層 A）へ解決していた** |
| 2 | 公開スナップショットは **`ALLOW internal/**`** ⇒ **公開される** |
| 3 | **どの検査も赤くならない**——`check-migration-license.sh` は `migrations/` だけを走査し、`check-public-snapshot.sh` は ALLOW/DENY の網羅だけを見る。**両方 EXIT=0** |

**⇒ `D-777` の一般形そのものである**——逐語はこうである:
**「グロブで解決する宣言は、ファイルを動かした瞬間に黙って外れる。**
**⇒ そして外れた先が既定なので、検査は緑のままである。」**

**★開発者裁定 6 = `REUSE.toml` の層 B へ 1 行足す。** ⇒ 実施し、
**ガードへ規則 (5) を新設して同型の経路を塞いだ**（§6.3）。
実測: `scripts/migrate-userdata-prompt.md` → `MIT`（層 C）／ `testdata/**` → `CC-BY-SA-4.0`（層 B）。

### 5.5 ★生成物に焼き込まれた失効文字列（3-1 と同じ手番で処理＝2 度触らない）

`internal/seedgen/generate.go` の `defaultHeader` は **文字列リテラルであり生成 SQL の byte に出る**。

| 着手時点 | 是正後 |
|---|---|
| 「移動 system move 9 種は drop 済(投入元は **000025**)」 | 「移動 system move は CSV に無い(seed の投入元は `000004_data_seed_moves`)」 |
| 「既存マイグレ **000001〜000025** は非改変」 | 落とした |

**★「`000001`〜`000025`」は範囲表記である。**
**⇒ 新 `000001` が在ることを理由に「偶然正しい」とは言えない。**
あわせて `FirstWaveStem` 定数を導入し、`cmd/seedgen/main.go:142` の既定 stem 直書きを外した。

### 5.6 ★再生成を機構にした（転記の経路を消した）

```bash
TACPENDIUM_UPDATE_GOLDEN=1 go test ./internal/seedgen/
```

**★着手時点の手順は各テストの doc に書かれた CLI であった。**
⇒ `-note` を Go の定数から**人が転記する**形だった。★転記を誤ると golden だけが動く。
テスト経由なら生成引数がテスト本体と同一になる。**20 箇所の doc を正本へ差し替えた**
（CLI の行は「生成に使った引数の記録」として残した）。

### 5.7 ★失われる主張を意味で埋めた — `TestRun_HEAD_SeedValuesMatchCSV`

**着手時点はこの主張を golden が受け持っていた**——17 stem が「CSV から再生成した SQL」と
「コミット済みの `migrations/0000NN_*.sql`」を byte 比較していた。
**⇒ 配布されるシードが CSV 由来であることは、その byte 一致が担保していた。**
⇒ 比較先を `testdata/` へ移すと、そこで守れるのは「CSV → SQL の変換規則がドリフトして
いない」ことだけになり、**「配布されるシードがその出力と一致する」は誰も見なくなる。**

⇒ その穴を**意味**で埋めた（byte ではなく値で突き合わせる）。

| 項目 | 値 | 種別 |
|---|---|---|
| 突き合わせた行 × 列 | **2743 行 × 9 列** | 実測 |
| CSV データ行の全数 | **2743** | 実測 |
| 検算 | 一致 ⇒ **取りこぼし 0** | 算出 |

**母集団の分担**: 既存の `TestCSVAndDBAgreeOnFrameCostColumns` は「seedgen が読むだけで
SQL へ出力しない列」、本テストは**その補集合**（seedgen が実際に `INSERT` する列）。
⇒ **2 本で CSV の全列が母集団になる。**

### 5.8 `internal/seedgen/` の失効参照

| 母数 | 件数 | 種別 |
|---|---|---|
| 非テスト | **40** | 実測 |
| 全体（テスト込み・行ベース） | **142 行 / 182 出現** | 実測 |

**★指示書の「約 35 箇所」とのずれを報告する**（`M33-01` が golden を 4 本 → 17 stem と
報告したのと同型）。`grep -rnE '0000(1[0-9]|[2-9][0-9])' internal/seedgen/` の実測値である。

**★`preM2003Stems` 6 件は中身を 1 つも変えていない**（綴りも変えていない）。
⇒ **集合の*意味*が「適用済みマイグレ」→「凍結 golden」へ変わっただけ**であり、
由来を辿れるようにするため。

---

## 6. 段 4 — ガードの穴を塞ぐ

### 6.1 判断と理由 — ★**凍結表は残し、凍結分にも規則 (4) を評価する**

**設計卓の推し（`D-902`）は「9 本を凍結表から外して規則 (4) の判定へ委ねる」だった**。
実査でも**外しても 9 本すべて (4) を通る**（緑）ことを確かめた。

**★それでも残した理由 = 規則 (3) が持つ力が (4) に無い。**
(3) は層の***値***を固定するので、`REUSE.toml` を書き換えて層を入れ替えたときに赤くなる。
(4) は命名と中身しか見ない。

⇒ かわりに **凍結分にも規則 (4) を評価する形へ変えた**。
**★これで「空回り」は消え、(3) の力も残る。⇒ 外す案より厳密に強い形である。**

**空回りだったことの実測**: 着手時点は `if num in frozen: (3) else: (4)` であり、
`M33-02` が新系列 9 本を*全数*凍結表へ入れたため **(4) が 1 本も評価されない**
（`--list` の実測で **18/18 が「凍結」**）。⇒ 規則 (4) を守る唯一の経路が
`--self-test` の陽性対照だけになっていた。**★検査が在ることと効くことは別である。**

### 6.2 規則 (4a) へ書き込み先の検査を足した（★穴そのもの）

着手時点の (4a) は**層だけを見て書き込み先を一切見ていなかった**。
⇒ `APP_TABLES = ("games", "presets", "users", "tags")` を足し、
**`_data_` を持つのに層 A の表へ書いていたら赤**にする。
★followup `migration-license-check-blind-to-write-target-when-data-named` の是正。

### 6.3 規則 (5) を新設 — 凍結 golden の層

**★走査範囲を `migrations/` の外へ広げる唯一の規則である。** §5.4 の経路を塞ぐ。

### 6.4 `CASCADE` 偽陽性を潰した

`_WRITE_RE` の `UPDATE` 枝が `ON UPDATE CASCADE` の `CASCADE` を表名として捕獲する
（`000001_init_schema.up.sql:118, 119, 222` の 3 箇所）。

```
着手時点の捕獲: ['cascade', 'sqlite_sequence']
是正後の捕獲  : ['sqlite_sequence']
⇒ 落ちた語: ['cascade']
```

着手時点は `GAME_TABLES` 照合で落ちるため**無害**だったが、`APP_TABLES` を足す以上ここで潰した。

### 6.5 ★★★破壊確認 3 件（**いずれも「塞ぐ前は緑」を実測し、赤くした規則を名指し**）

**★`M33-02` の教訓＝破壊確認は「赤になったか」ではなく「*どの規則が*赤にしたか」まで見る。**
⇒ 違反メッセージへ規則番号を入れた。

| # | 破壊の形 | 着手時点のスクリプト（`git show 9de8fa9:...`） | 本サブのスクリプト |
|---|---|---|---|
| **1** | `_data_` 付きで `users` へ書く（`M33-02` の実測の再現） | **EXIT=0（違反なし）** | **EXIT=1 / 規則(4a) が 2 件** |
| **2** | `REUSE.toml` から `testdata` の 1 行を抜く | **EXIT=0**（testdata を見ない） | **EXIT=1 / 規則(5) が 34 件** ⇒ 1 行を戻すと EXIT=0 へ復帰 |
| **3** | 凍結分 `000002`（層 A・`_data_` 無し）を `moves` へ書かせる | **EXIT=0（違反なし＝空回りの証拠）** | **EXIT=1 / 規則(4b)** |

**★3 件とも後片付け済み。`git diff --numstat 9de8fa9 -- migrations/` は 0 ファイル**（§3-2 を守った）。

### 6.6 自己検査

| 時点 | 陽性 | 陰性 | 計 |
|---|---|---|---|
| 着手時点 | 9 | 2 | **11** |
| 本サブ着地 | **12** | **3** | **15** |

**すべて OK（EXIT=0）。** ★追加した 3 陽性・1 陰性は、上の破壊確認と同じ形を合成ツリーで固定する。

### 6.7 §2.4-3 の整合確認

`check-migration-license.sh` の例外 3 行（`M33` が「適用済みだから変わらない」の前提が
崩れる唯一の形である旨）と `SUPP-001` §2.7 の現行記述（9 本・欠番 0 件・次は `000010` /
`REUSE.toml` の連番グロブ表は撤去）は **矛盾しない**。
片方は「例外が 1 度あった」経緯、片方は結果の記述である。⇒ 凍結表を残す判断と理由を
コメントへ明記した。

---

## 7. 段 6 — 移行手順（★★未充足を明記する）

**成果物 = `scripts/migrate-userdata-prompt.md`（114 行）。**
`scripts/*.md` は既存の型（`dev-throwaway-db-guide.md` の先例）。`scripts/**` は層 C（`MIT`）。
**★配布物には載せない**（`release-targets.sh` を触っていない）。

### 7.1 ★★★乾式検証を行っていない — **完了条件 §6-7 / チェックリスト E-2 を満たさない**

**開発者裁定（2026-09-19）である。** 照会に対する回答は逐語で「**乾式なし・プロンプトだけ**」。

**⇒ 指示書 §6-7 とチェックリスト E-2 は充足していない。**
（§6-7＝「移行手順が在り、乾式で通る」／ E-2＝「乾式で通った*出力*が在るか。
⇒ FK 違反 0 件が示されているか」）
★プロンプト冒頭にもその旨を書いた（「実際に流したのは誰でもない」）。

**★乾式は技術的には可能だった**（旧 111 本は `git show b5cd716^:migrations/<名>` から取れる）。
⇒ **できなかったのではなく、開発者の判断で行わなかった。**

### 7.2 外せない 4 点（欠けるとローカル AI は「表ごとに `INSERT`」を書いて FK 違反する）

| # | 内容 |
|---|---|
| 1 | **投入順**: `users` → (`tags`, `presets`, `setups`) → (`combos`, `preset_aliases`) → 接続表 9 → `combo_setup_results`（複合 FK なので `combo_setups` の後）。**★`presets` は `users` より後**——新 baseline の投入順（`000007` presets → `000009` users）と**逆**である（組込プリセットが `user_id IS NULL` なので成立していただけ） |
| 2 | **`combos` の自己参照 2 本**（`materialized_from_combo_id` / `superseded_by_combo_id`）は NULL で入れてから `UPDATE` の 2 パス。**★`M33-02` では両方 0 行で出番が無く、移行が初めて踏む** |
| 3 | **`sqlite_sequence` の明示補正**（`SUPP-001` §5.5 規約 (21)） |
| 4 | **`PRAGMA foreign_key_check` が 0 件**（★件数だけでなく返ってきた行を出力させる） |

### 7.3 ★実測に基づいて書いた（新 baseline を適用した DB を組んで数えた）

| 指標 | 値 | 種別 |
|---|---|---|
| 表の全数 | **21** | 実測 |
| 純ユーザーデータ表（新 DB で 0 行） | **12** | 実測 |
| seed のある表 | **9**（`characters` 31 / `games` 1 / `move_commands` 1634 / `move_derivations` 459 / `moves` 3057 / `preset_aliases` 7635 / `presets` 3 / `tags` 3 / `users` 1） | 実測 |
| `sqlite_sequence` の行 | **9**（うち **`combos` 0 / `combo_oki_options` 0**） | 実測 |
| `AUTOINCREMENT` を持つ表 | **16** | 実測 |

**★`combos` と `combo_oki_options` は 0 行なのに `sqlite_sequence` に行を持つ**
（規約 (21) の実例。行の書き出しでは再現されない）。
★`move_commands` / `move_derivations` / `combo_tags` / `combo_setups` / `combo_setup_results` は
複合 PK のため seq を持たない。

**hybrid 4 表**（`users` / `tags` / `presets` / `preset_aliases`）の seed 行と利用者行を分ける
述語は**未定**（followup `m33-users-tags-seed-vs-user-predicate-undefined`）。
⇒ 「**新 baseline に既にある行が seed 行**」という運用形をプロンプトへ書いた。

### 7.4 dump の置き場

`tmp/` の下（`.gitignore` の `/tmp/` で無視される）。★`docs/` の下へは置かない（丸ごと公開される）。
**★あわせて「`tmp/` に `.go` を作らない」を明記した**——**本サブで実際に踏んだ**
（作業用 `probe_test.go` を `tmp/m33-03/` へ置いたところ `go vet ./...` が拾って壊れた）。

---

## 8. 段 5 — 生きた資料と `code-facts`

| # | 項目 | 結果 |
|---|---|---|
| 1 | `code-facts.md` 再生成 | **157 insertions / 571 deletions**（1 ファイル） |
| 2 | ★§10 の内容確認 | **10-1 の一覧が 111 行 → 9 行**へ。9 件とも新系列の実体と一致（目視全数） |
| 3 | `check-derived-docs.sh` の変化量 | **444 / 1080 件（41%）→ 0 / 1080 件（✅ 最新）** |
| 4 | `release-targets.sh:92` | 「ゲームデータのマイグレ **20 本**」→ **10 本**（up 5 / down 5・実測） |
| 5 | `docs-map` | **Phase D の後に回す**（本サブが `docs/progress/` へ報告 2 本を足すため。いま回しても 2 本ぶん古くなる） |
| 6 | `generate-code-facts.sh:745` | `need ... '^\| 000001 '` は **新系列でも偶然通る**（新 `000001` も `init_schema`）。★次に連番の起点が動いたら黙って壊れる型である |

---

## 9. テストと検査

### 9.1 ★★`go test ./...`（★パイプ越しに合否を判定していない）

```bash
$ go test ./... > tmp/m33-03/gotest-final.txt 2>&1 ; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" tmp/m33-03/gotest-final.txt   # ->  0
$ grep -cE "^ok "      tmp/m33-03/gotest-final.txt   # -> 60
$ grep -c "no test files" tmp/m33-03/gotest-final.txt # ->  9
$ go list ./... | wc -l                              # -> 69
$ wc -l < tmp/m33-03/gotest-final.txt                # -> 69  (★全量。head / tail を通していない)
```

| 項目 | 着手時点 | 着地 | 種別 |
|---|---|---|---|
| **EXIT** | **1** | **0** | 実測 |
| **`--- FAIL`** | **158** | **0** | 実測 |
| `ok` | 58 | **60** | 実測 |
| `no test files` | 9 | 9 | 実測 |
| 検算 | — | `60 + 9 = 69` = `go list` の全数 | 算出・**一致** |

**★★158 → 0。⇒ 本サブの中心の完了条件（§6-1）を満たした。**

### 9.2 フロント全数

```bash
$ cd web && pnpm test > ../tmp/m33-03/pnpmtest.txt 2>&1 ; echo "EXIT=$?"
EXIT=0
$ wc -l < ../tmp/m33-03/pnpmtest.txt   # -> 3593  (★全量)
```
**Test Files 234 passed (234) / Tests 2974 passed (2974)**（実測）。

### 9.3 E2E 全数（★`make e2e` を使った。`pnpm exec playwright test` を直接叩いていない＝`D-599`）

```bash
$ make e2e > tmp/m33-03/e2e.txt 2>&1 ; echo "EXIT=$?"
EXIT=0
$ wc -l < tmp/m33-03/e2e.txt   # -> 420  (★全量)
```
**Running 364 tests using 1 worker / 364 passed (7.0m)**（実測・取り込み後の再実行）。**flaky 0 / failed 0。**

### 9.4 常設の機械検査

| # | 検査 | EXIT | 備考 |
|---|---|---|---|
| **1** | **`check-artifact-integrity.sh`**（★1 本目に回した） | **0** | 違反なし |
| 2 | `check-migration-license.sh` | **0** | §6 |
| 3 | `check-migration-license.sh --self-test` | **0** | **全 15 対照 OK** |
| 4 | `check-doc-refs.sh` | **0** | dead reference **1 件 → 0 件** |
| 5 | `check-browser-storage-keys.sh` | **0** | — |
| 6 | `check-enum-sync.sh` | **0** | — |
| 7 | `check-import-order.sh` | **0** | ベースラインどおり（増加なし） |
| 8 | `check-stop-discipline.sh` | **0** | — |
| 9 | `check-completion-report-md-emphasis.sh` | **0** | — |
| 10 | `check-public-snapshot.sh` | **0** | 母数 3065 / 公開 3036 / 除外 29 |
| 11 | `check-doc-inventory.sh` | **0** | 型に無いファイルなし |
| 12 | `check-derived-docs.sh` | **0** | `code-facts` ✅ 最新 |
| 13 | `check-instruction-format.sh` | **0** | — |
| 14 | `check-md-emphasis.sh <本手番の新規 .md>` | **0** | §11 |
| 15 | `check-progress-log-index.sh` | — | **★Phase D の後に回し直す**（`D-890`） |

### 9.5 gofmt / vet / build

`gofmt -l`: clean ／ `go vet ./...`: 出力なし ／ `go build ./...`: OK ／
`cd web && pnpm exec tsc --noEmit`: EXIT=0（いずれも実測）。

### 9.x ★【2026-09-19 追記の手番】全数テストを回さなかった理由

**★この追記の手番は `.md` 2 ファイルしか変えていない。**
`git diff --stat -- migrations/ character_data/ '*.go'` が **0 行**であることを実測で確認した。
⇒ **コード・マイグレ・CSV の差分が 0 なので、全数テストの結果は直前の実測から変わりようがない。**
**⇒ `go test ./...` ／ `pnpm test` ／ `make e2e` は回していない。**

**⇒ 代わりに回したのは、報告そのものを入力に取る検査である**（`D-890`）:

| 検査 | 結果 |
|---|---|
| `check-md-emphasis.sh docs/progress/M33-03-completion-report.md` | **EXIT=0**（検出 0 行） |
| `check-md-emphasis.sh docs/handover/design-reports/20260919-m33-03-design-exceptions.md` | **EXIT=0**（検出 0 行。★1 度赤くなった＝表セル内で外側の強調の中へ `**` を入れ子にしたため。閉じ位置を分けて解消した） |
| `check-stop-discipline.sh` | **EXIT=0**（違反なし） |
| `check-progress-log-index.sh` | **EXIT=0**（119 件すべて追記あり） |
| `check-doc-refs.sh` | **EXIT=0**（dead reference なし） |
| `check-artifact-integrity.sh` | **EXIT=0**（自己検査 17 件 ／ 生成物 4 件すべて OK） |

---

## 10. 変更統計

```bash
$ git diff --stat 9de8fa9 | tail -1
140 files changed, 18532 insertions(+), 10589 deletions(-)
```

★上は**レビュー取り込み後**の最終値である（コミット 12 本）。取り込み前は
`134 files / +16382 / -10094` であった。

| コミット | 段 | 統計 |
|---|---|---|
| `edd8ac6` | 段 1 | 42 files / +81 / −74 |
| `815bd67` | 段 2 | 37 files / +457 / −9140 |
| `6abb598` | 段 2（`rules_m1905`） | 2 files / +293 / −130 |
| `c62561a` | 段 3 | 49 files / +15103 / −146 |
| `d638508` | 段 4 | 2 files / +173 / −31 |
| `95a03c7` | 段 6 | 1 file / +114 |
| `0c45ba0` | 段 5 | 2 files / +161 / −573 |

### ★★新規のはずのファイルに deletions が付いていないか（`E-225`）

**新規 38 ファイル**（`internal/seedgen/testdata/` 34 ＋ `helpers_test.go` ＋
`head_seed_invariants_test.go` ＋ `migrate-userdata-prompt.md` ＋ 報告 3 本）
**の deletions 合計 = 0**（実測）。⇒ 「新規のつもり」のファイルはすべて `+` だけである。

**削除したファイル: 15**（意図的。§4.6）。

---

## 11. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし**（本サブの CHANGE 消費は **0 本**。★自採番していない＝`D-293`。原稿は設計伝達レポート §1 / §6 へ回す） |
| 2 | **その番号の写し先（4 か所）** | **なし**（番号を消費していないため） |
| 3 | **消費したマイグレ連番** | **なし**（`ls migrations/*.up.sql` は **9 本**のまま。★次に払い出すのは `000010`） |
| 4 | **版を上げた文書の参照元** | **なし**（文書の版を上げていない） |
| 5 | **★`REUSE.toml` を変えた** | **開発者裁定 6 で層 B へ 1 行足した**（§5.4）。⇒ `DES-001` §5.1 / `SUPP-001` §2.7 のライセンス項へ反映が要る ⇒ 設計伝達レポート §1 / §6 へ原稿 |
| 6 | **`docs-map` の再生成** | **Phase D の後**（§8-5） |

---

## 12. 不変の証跡（★触っていないこと）

| # | 対象 | 差分 | 種別 |
|---|---|---|---|
| 1 | `migrations/` | **0 ファイル** | 実測 |
| 2 | `docs/design/` | **0 ファイル** | 実測 |
| 3 | `docs/handover/followup-backlog.md` | **0 ファイル**（`D-838`） | 実測 |
| 4 | `docs/progress/20260906-squash-research/` | **0 ファイル**（`D-196`） | 実測 |
| 5 | `ls migrations/*.up.sql` | **9 本**（着手時と同じ） | 実測 |
| 6 | 開発者の手元 DB | 触っていない（使ったのは `.gitignore` 済みの `tmp/m33-03/*.db`。後片付け済み） | — |

### ★`docs/progress/20260906-squash-research/` の削除 — 候補と根拠まで（`D-196`）

**公開の危険は既に機構で閉じている**——`scripts/public-snapshot-manifest.txt:27` に
`DENY docs/progress/20260906-squash-research/**` が入っている（開発者確定 2026-09-08）。
⇒ **残る理由は 6.2MB のディスクだけである。消すのは開発者の手番。**

---

## 13. 完了条件の逐条確認（指示書 §6）

| # | 条件 | 結果 |
|---|---|---|
| 1 | `go test ./...` が EXIT=0（158 の赤が消えている） | **○**（§9.1） |
| 2 | 歴史テスト 141 本の分類の内訳（消した／書き直した／諮った・合計 141） | **○**（§4.1。102 / 34 / 5） |
| 3 | `000007` を指す 4 箇所が是正されている | **○**（§3.3・名指しで確認） |
| 4 | 失効参照 65 箇所の 3 分類の内訳・「偶然正しい」2 箇所も明記 | **○**（§3.1〜§3.7。★真の全数は **85**・偶然正しいは **3** 箇所） |
| 5 | golden 17 stem と新系列の対応表・対応が付かないものは諮ってある | **○**（§5.1。**17 stem すべて対応が付かない**⇒ 諮って裁定を得た） |
| 6 | ガードの判断と理由、破壊確認の出力 | **○**（§6.1・§6.5） |
| 7 | **移行手順が在り、乾式で通る** | **✗ 未充足**（§7.1。**開発者裁定により乾式を行わない**） |
| 8 | `code-facts` を再生成し変化量を貼った | **○**（§8。41% → 0%） |
| 9 | §5 の検査がすべて緑 | **○**（§9.4） |
| 10 | 完了報告 ＋ `progress-log` へ索引行 1 行 | **○**（本書 ＋ Phase D） |
| 11 | 設計伝達レポートを出した（CHANGE 原稿は §1 と §6 へ） | **○**（Phase D の後） |
| 12 | 着手前の版ゲート 6 点を通した | **○**（§1） |
| 13 | 完了報告を書いた*後に*、報告を入力に取る検査を回し直した | **○**（§9.4-15 / `D-890`） |
| 14 | マイグレを 1 本も作っていない | **○**（§12-5） |

**⇒ 14 条件のうち 13 が ○、1 が ✗（開発者裁定による未充足）。**

---

## 14. レビュー結果と取り込み（Phase C）

| 欄 | 値 |
|---|---|
| レビュー報告書 | `docs/progress/m33-03-review.md` |
| 指摘の件数 | **17 件**（高 5 / 中 7 / 低 5） |
| 採用 | **17 件** |
| 不採用 | **0 件** |
| **「高」指摘の不採用** | **0 件** ⇒ Phase C の安全弁は発動していない |
| 再レビュー往復 | **0 回**（上限 2 回に対して余裕あり） |

### 14.1 「高」5 件の採否と対応

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| **高-1** | `SUPP-001` §5.5.2 規約 (2) 違反。HEAD 終端へ移した 39 本がサブ名の名前空間に残る | **採用** | **★規約 (2) の逐語を自分で確認した**（「`migrate_head_test.go` に `TestRun_HEAD_*` として置き、サブ名へ相乗りさせない」）。⇒ 7 ファイルへ「本ファイルの終端は HEAD である／名前空間は未解決」を明記し、**移設 or 規約 (2) の改訂を設計卓へ CHANGE 原稿として回した**（§15-9）。★49 本の移設は設計判断であり `CLAUDE.md` §8 により製造の独断で行わない。**★★【2026-09-19 追記・母数を実測】抵触は 39 本ではなく 49 本・22 ファイルである**〔`internal/infra/migration/*_test.go` の全 77 本＝`TestRun_HEAD_*` **11** ／ `TestRun_M*` **44** ／ `TestM1905_*` **5** ／ その他 17。**★39 は私が書き直した分だけを数えた過小値であった**——**書き直していない既存のサブ名テストも、区間が 1 本になった時点で同じく HEAD スコープである**。上位は `migrate_m3105_test.go` 6 ／ `rules_m1905_test.go` 5 ／ `migrate_m3704_test.go` 5 ／ `migrate_m3007_test.go` 4 ／ `migrate_m1403f_test.go` 4〕 |
| **高-2** | 撤回済みの設計原則の逐語が残り、同ファイルのコードが真逆を実行 | **採用** | 7 ファイルの「HEAD を終端にしない」段落（計 87 行）を落として現状の説明へ差し替え。あわせて `m1403f` の「v80 → v91 で移動する」／`m1403d` の旧連番 6 行表／**削除済みテストを指す 2 件**（`TestRun_M1904c_DownUpRoundTrip` / `TestRun_M2805_DownUpRoundTrip`）を是正。**実測: コメントが参照する非存在テスト 2 件 → 0 件** |
| **高-3** | 削除した (i) 102 本に HEAD で表現できる主張が含まれ、期待値表が孤児で残存 | **採用** | **`head_seed_invariants_test.go` を新設し、7 本の HEAD テストとして復元**（§14.2）。孤児の期待値表はすべて復元テストが消費する形にした |
| **高-4** | 移行プロンプトが `schema_migrations` を運ばない旨を書いていない | **採用** | 「システム表のうち運ぶのは `sqlite_sequence` だけ」を独立の項として追加。運ぶと `no migration found for version <旧の終端>` で abort ＋ `dirty` になる機序も書いた |
| **高-5** | `go run ./cmd/seedgen -check` が恒常赤 | **採用** | `outDirFor()` / `frozenGoldenStems`（17 件）を追加し、既定 stem が凍結 golden なら `internal/seedgen/testdata` を見るようにした。`-migrations` を明示したときは呼び出し側が勝つ（`flag.Visit`）。**実測: EXIT=1 / DIFF 2 件 → EXIT=0「OK: 生成物は既存ファイルと一致」** |

### 14.2 高-3 の復元内容（★主張を 1 つも捨てていない）

`internal/infra/migration/head_seed_invariants_test.go`（新設・同名の事前確認済み）:

| テスト | 復元した主張 | 出所 |
|---|---|---|
| `TestRun_HEAD_NoCrossingAliasTextEn` | **`D-317` の交差検査が 0 件**（★最も危なかった。repo 全体でガードが 0 になっていた） | 旧 `migrate_m2003_test.go` (g) |
| `TestRun_HEAD_SeedSatisfiesUniqueConstraints` | 実 seed が一意制約 4 種を満たす | 旧 `migrate_m2003_test.go` |
| `TestRun_HEAD_PresetAliasCharacterIDFilled` | `preset_aliases.character_id` が NULL 0 件 | 旧 P-34 の期待値 |
| `TestRun_HEAD_MovementSystemMoveTotals` | 移動 system move の `total` 実測値（★CSV に無いので `SeedValuesMatchCSV` は見ない） | 孤児 `m1403fMovementTotals` |
| `TestRun_HEAD_MoveDerivationCounts` | キャラ別の `move_derivations` 件数（下限で固定） | 孤児 `m1403fDerivationCounts` / `m1403fJumpDerivCounts` |
| `TestRun_HEAD_FourthWaveCustomStates` | 第四波の `custom_states` 9 状態 | 孤児 `m1403fCustomStates` |
| `TestRun_HEAD_SeededCharacterSetsAreDisjoint` | 2 つのキャラ集合が実在し重複しない | 孤児 `m1403fSeeded17` / `m1403fNew12` |

**★★★自作の失効参照を 1 件見つけて直した。** 段 1 で `internal/repository/preset/queries.go:131` と
`internal/service/preset/service.go:277` のコメントを整えたが、そのとき残した
「seed 経路は `migrate_m2003_test.go` (g) が 0 件を固定している」が残っていた。
**⇒ 段 2 で自分が削除したテストを指していた。** `TestRun_HEAD_NoCrossingAliasTextEn` へ差し替えた。
**★段 1 と段 2 を別の手番として扱ったために生まれた矛盾である。**

### 14.3 「中」7 件・「低」5 件

**中（7 件・全採用）**: コード上で 1 度も使われない宣言 **47 件を削除**（★着手時の検出器が
doc コメントの言及を「使用」と数えていた誤り。実測で 0 件になるまで消した）／
`helpers_test.go` の `scanStr` / `aliasText`（移設先で 0 呼び出し）を削除／
移行プロンプトへ `PRAGMA foreign_keys` の明示と hybrid 表の「中身が違う行は列挙して報告」を追加／
`M2006_P34Rows` の「強さは変わらない」を **「ガードは 1 つ弱くなった」へ訂正**（不正確だった）／
`csv_db_sync_test.go` の「2 本あわせて CSV の全列が母集団」を **覆っていない 9 列の列挙へ訂正**／
規則 (5) の走査範囲が 1 ディレクトリ固定である限界を明記／
`GAME_TABLES` の `custom_states` が表でなく列である旨を明記。

**低（5 件・全採用）**: `assertGolden` の doc へ「`TACPENDIUM_UPDATE_GOLDEN` は無条件に上書きする。
守っているのは git diff に出ることだけ」を明記／`assertV63StateM1904c` →
`assertCorrectedStateM1904c` へ改名（v63 は存在しない版）／`docs-map` は Phase D の後に回す
（レビューも妥当と判定）／testdata 34 ファイルが公開スナップショットへ入ることは
**層 B として宣言済み**（§5.4）。

### 14.4 ★レビュアーが判定できなかった点（`不明`）への回答

レビューは「完了報告 §2 が挙げる開発者裁定 7 件は `parallel-board.md` に採番が無く、
レビュー側からは真偽を判定できない」と記録した。**★これは正しい観察である。**

⇒ 7 件はいずれも**本手番の対話で開発者へ照会して得た回答**であり、
**ボードへの採番（`D-905` 以降）は設計卓の手番である**（製造はボードを編集しない）。
⇒ 設計伝達レポート §3-1「開発者へ確認して確定した点」へ全件を逐語で載せる。
**★とくに「乾式を行わない」は完了条件 §6-7 を ✗ にしている根拠である。**
**⇒ 裁定が無ければチェックリスト E-2 の不合格条件に当たる。採番を最優先で。**

---

## 15. 申し送り（設計伝達レポートへ回す原稿の見出しのみ）

| # | 内容 | 宛先 |
|---|---|---|
| 1 | **`D-187` の不変条件が HEAD では 132 行違反している**（§4.5）。★旧テストは v64 でしか見ていなかったため誰も気づいていない。**★★【2026-09-19 追記】内訳を実測した**——**126 が `category='system'` の移動 move**（**14 キャラ × 9 ＝ 第四波そのもの**）／ `target_combo` 4 ／ `special` 2。**原因は旧 `000065` の是正が第三波までにしか当たっていないこと**であり、**CSV とマイグレ SQL の突合は 0 件不一致である**。**★同ファイルの `drive_reversal` は 31 キャラすべてが `unknown` であり、SQL 自身の慣習が `unknown` であることを示す**。**開発者裁定 2026-09-19 の逐語＝「発生フレームを持たない技はunknownへ修正」**。⇒ **`D-187` は撤回しない。是正は `000010` の別サブである**（**本サブはマイグレ消費 0 本が射程条件**） | §4（§J 行の原稿・データ品質） |
| 2 | **`rules_m1905_test.go` 5 本は `setplay` サービスのロジックテストであり `internal/infra/migration` に住む理由がもう無い**（§4.4）。⇒ 移設は差分が大きく本サブの射程外 | §4（§J 行の原稿） |
| 3 | **`SUPP-001` §5.5 規約 (19) は「対象ファイルが消えた」場面を覆っていない**（§5.1） | §1 / §6（CHANGE 原稿） |
| 4 | **`REUSE.toml` の層 B へ `internal/seedgen/testdata/**` を足した**（§5.4）⇒ `DES-001` §5.1 / `SUPP-001` §2.7 へ反映 | §1 / §6（CHANGE 原稿） |
| 5 | **規則 (4) の `has_data` 拡張・凍結分への (4) 評価・規則 (5) の新設**（§6） | §1 / §6（CHANGE 原稿） |
| 6 | **`M33-overview` §5 と指示書 §2.2 の食い違い**（前者は「歴史テスト 28 ファイルを*旧系列側へ移す*」、後者は「分類して消す／書き直す」。`M33-02` は `migrations/legacy/` を作っていない）⇒ **より新しく具体的な指示書 §2.2 に従った** | §2（契約に反する独自判断） |
| 7 | **失効参照の数え方**——`M33-02` の「65 箇所」式は stem 形を 20 件取りこぼす（§3.1） | §4（§J 行の原稿） |
| 8 | **`generate-code-facts.sh:745` の `'^\| 000001 '` は偶然通る**（§8-6） | §4（§J 行の原稿） |
| **9** | **★★`SUPP-001` §5.5.2 規約 (2) と現状が食い違う**（レビュー 高-1）。**⇒ 新系列は区間が 1 つしか無いため、`internal/infra/migration` の*すべて*のテストが HEAD スコープになった。** 規約 (2) は「HEAD スコープはサブ名へ相乗りさせない」と定めるが、**49 本・22 ファイル**がサブ名のままである〔全 77 本の内訳＝`TestRun_HEAD_*` 11 ／ `TestRun_M*` 44 ／ `TestM1905_*` 5 ／ その他 17。**★レビューの 39 本は書き直した分だけを数えた過小値である**〕。★**移設する**（49 本を `migrate_head_test.go` へ）か**規約 (2) を改める**（区間が 1 つの世界を想定していない）かの判断が要る | **§1 / §6（CHANGE 原稿）** |
| **10** | **★開発者裁定 7 件がボードに採番されていない**（レビューの `不明`）。⇒ 採番は設計卓の手番。**とくに「乾式を行わない」は完了条件 §6-7 を ✗ にしている根拠であり、採番が無いとチェックリスト E-2 の不合格に見える** | **§3-1 ＋ ボード採番** |

---

*以上、`M33-03` 完了報告。* **★§7.1 の未充足（乾式検証なし＝開発者裁定）と §14 が Phase C 待ちであることを、読み飛ばさないこと。**
