# M35-02 完了報告 — `ryu` の `axe_kick_2` → `axe_kick`（三点更新）

| 項目 | 内容 |
|------|------|
| 作業 ID | **M35-02** |
| 指示書 | `docs/instructions/M35-02-ryu-axe-kick-code-fix.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M35-02-review-checklist.md` **v1.0.0** |
| 実施日 | **2026-09-10** |
| 着手基点 | `0660fa2` |
| ブランチ | `claude/m35-02-implementation-plan-8xi0wv` |
| CHANGE 消費 | **0 本**（設計書の契約は変わらない） |
| マイグレ消費 | **1 本＝`000108`**（`D-800` 払い出し。**自採番していない**） |
| 製造 CLI | `/implement_plan_full`（Phase A 実装 → Phase B fresh subagent レビュー → Phase C 自動トリアージ） |

---

## 0. 一行で

**`ryu` の `rush_axe_kick`（かかと落としのラッシュ版）が、どの入力面からも選べなかった。** 基底技の `move_code` を `axe_kick_2` から `axe_kick` へ是正し、**CSV 正本 ／ golden 再生成 ／ 追随マイグレの三点を揃えた。**

---

## 1. 機序（**なぜ誰も気づかなかったか**）

`resolveRushByCode`（`web/src/features/combo/inputResolution.ts:60`）は

```ts
moves.find((m) => m.code === `rush_${baseCode}`)
```

で探す。基底技の code が `axe_kick_2` だったため **`rush_axe_kick_2` を探し**、実在する `rush_axe_kick` に到達できず `null` を返していた。

**★`null` は「該当なし」であって「エラー」ではない。** 呼び出し側（`DirectSpecPanel.tsx:63` ／ `hasUniqueRushVariant` ／ `inputResolutionStage2.ts:100`）はこれを**データ駆動の非活性**として扱う。⇒ `DirectSpecPanel` は当該ボタンを `disabled` にして描画する。

**★★したがって壊れ方は「ボタンが出ない」ではなく「ボタンは並ぶが押せない」である。** テストも lint も型検査も緑のままであり、**人が実機で気づく以外に検出の経路が無かった**（§5 でこの経路を機械化した）。

**★誤っているのはデータであり、`resolveRushByCode` の実装は正しい**（指示書 §3-3）。

**是正の向きは開発者が確定済み**（2026-09-08 逐語＝「`axe_kick_2` 側の方が誤り。`axe_kick`、`rush_axe_kick` が正しい」）。⇒ **`rush_axe_kick` は 1 文字も触っていない。**

---

## 2. 段 1 実査（指示書 §2.1・**5 件すべてに結果がある**）

### 2.1 ★母集団

**母集団は `moves` テーブルである**（`SUPP-001` §5.5.3.2 ／ `M-145` の対処）。`character_data/*.csv` は入力の一部にすぎない。以下は **HEAD まで migrate した使い捨て DB**（`newMigrator` と同じ経路・`t.TempDir()`）に対する実測であり、計測用プローブは計測後に削除して `git status --short` が空であることを確認した。

### 2.2 実測値

| # | 測ったこと | 実測値 |
|---|---|---|
| **1-1** | `moves` の `ryu/axe_kick_2` | **1 件**（`move_id=1065`）。**全キャラ通算でも 1 件** |
| **1-2** | `combo_steps` ／ `setup_steps` ／ `combos.starter_move_id` が当該 `move_id` を参照 | **すべて 0 件**（新規 DB は利用者データを持たない）。**★3 表とも `move_id` 参照であり `move_code` 列を持たない**（`migrations/000001_init_schema.up.sql:100` ／ `:185` ／ `:66`） |
| **1-3** | `preset_aliases` が当該 `move_id` を指す件数 | **3 件**——`official_ja_move`「かかと落とし」／ `numeric`「4HK」／ `srk`「4HK」。**すべて `move_id` 参照** |
| **1-4** | `rush_axe_kick` の実在 | **1 件**。`moves.original_move_id` が `1065` を指す行も **1 件**＝これ |
| **1-5** | 改名先 `axe_kick` の空き | **0 件**（ryu にも全キャラ通算でも）⇒ **`UNIQUE(character_id, code)` の衝突なし**（チェックリスト B-4） |

### 2.3 ★★段 1-2 の帰結——「止めて報告」条件には当たらない

指示書 §7 は「既存のコンボが `code` 経由で参照していることが分かったら止めて報告」と定めている。**実査の結果、`code` 経由の参照は 1 件も存在しない**——`combo_steps` ／ `setup_steps` ／ `combos.starter_move_id` はいずれも `move_id`（外部キー）であり、**そもそも `move_code` 列を持たない**。

**⇒ 止まる条件には当たらないため、段 2 へ進んだ。**

**★これは「参照が 0 件だった」ではなく「参照の仕組み上ありえない」である。** 前者なら将来データが入れば変わるが、後者はスキーマが変わらない限り変わらない。**⇒ `move_code` の改名は、DB 内の利用者データを 1 行も壊さない。**

### 2.3.1 ★★ただし DB の外に 1 本ある（レビュー 中-3 の採用）

**★上の断定は「DB 内」に限る。** レビューの指摘を受けて `internal/service/comboio` を実査したところ、**`move_code` を文字列として運ぶ経路が DB の外に 1 本ある**ことが分かった。

- コンボ CSV の `recipe` 列は**セル内 JSON `[{move_code, modifiers}]`** である（`internal/service/comboio/csvcore/contract.go:56`）
- 取込時に `codeResolver.moveID(character_code, move_code)` が id を解決する（`lookup.go:73`）
- **未知の `move_code` は `VAL-I07` の WARNING**（ERROR ではない）であり（`csvcore/validate.go:197-201`）、`toComboSteps` は `MoveID` を `nil` のまま取り込む（`import.go:443-455`）

**⇒ 本サブ以前にエクスポートされた ryu のコンボ CSV が `axe_kick_2` を含んでいた場合、再取込するとそのステップは技を失った状態で入る。★エラーで止まらず WARNING に落ちるため、利用者が警告を読み飛ばせば静かに欠落する。**

**★本サブでは直さない。** 指示書 §2.1-2 の「止めて報告」条件は DB 内の `code` 経由参照を指しており、厳密には当たらない。**★また同じ帰結は `000063` ／ `000106` ／ `000107` にも当たる**——**本サブ固有ではなく「三点更新」という型に属する申し送りである。⇒ 設計伝達レポート §4 へ回す**（§12.1-4）。

**★段 1 の走査軸に「DB 外の成果物が `move_code` を文字列で持つか」が無かったことは、本サブの取りこぼしである**（`SUPP-001` §5.5.4 (11) が求める 2 本目の軸と同じ性質）**。⇒ 次に同型の改名を行う担当は、この軸を最初から持つこと。**

### 2.4 走査に使った式（チェックリスト B-2）

```bash
# axe_kick_2 の全数（36 件 / 22 ファイル）
grep -rn "axe_kick_2" . | grep -v "^./.git/"

# rush_variant の対応ずれを全キャラで走査
awk -F, 'FNR==1{next} $3=="rush_variant"{ if("rush_" $17 != $2) \
  print FILENAME": "$2" original="$17 }' character_data/*.csv
```

### 2.5 `axe_kick_2` を参照していた非ドキュメント箇所（**7 ファイル・11 行**）

| ファイル | 行 | 扱い |
|---|---|---|
| `character_data/ryu.csv` | `:27`（`move_code`）／ `:84`（`original_move_code`） | 三点 1（§3） |
| `migrations/000030_seed_moves_ryu.{up,down}.sql` | up `37` ／ `117` ／ `153`、down `9` ／ `11` | 三点 2（§4） |
| `migrations/000035_seed_move_commands.{up,down}.sql` | up `602`、down `10` | 三点 2 |
| `migrations/000072_m20_seed_aliases_numeric.{up,down}.sql` | up `1101`、down `22` | 三点 2 |
| `migrations/000073_m20_seed_aliases_srk.{up,down}.sql` | up `1113`、down `22` | 三点 2 |
| `internal/infra/migration/migrate_m1403c_test.go` | `:99` ／ `:107` | 追随（§6） |
| `web/src/features/combo/moveSurfacing.test.ts` | `:74` ／ `:220` | 失効実例の差し替え（§7.3） |

**残りはすべて `docs/` 配下の歴史記録**（完了報告・レビュー報告・ボード・指示書）**であり、書き換えない**（`D-274` (3)）。

### 2.6 ★★golden の内訳が先例と違う

**terry の先例**（`M28-05` ＝ `000106` ／ `M30-02` 追補 ＝ `000107`）**は `000026`（第一波）を動かしたが、ryu は動かさない。**

**★理由＝ryu は `FirstWaveOrder` に含まれない。** 旧 seed を `000029` で掃き、`000030` で再投入した経緯があるためである（`generate_m1702_test.go:94` が `FirstWaveOrder + "ryu"` と書いている）。`000026` に在る `axe_kick` は **ken の `gorai_axe_kick`** であって ryu のものではない。`000034` が持つのは `rush_axe_kick`（改名しない側）だけである。

**⇒ 本サブが動かした golden は `000030` ／ `000035` ／ `000072` ／ `000073` の 4 本**（先例と同数だが**内訳が違う**）。

**★この読みは推測ではなく実測で裏づけた**——CSV を直した直後に `go test ./internal/seedgen/` を回し、**落ちた golden がちょうどこの 4 本**（`000026` は緑のまま）であることを確認してから再生成した。

### 2.7 ★★射程外で見つかったもの（**2026-09-10 訂正**）

> **★★★本節は 1 度誤っていた。** 初版は「`ingrid` 2 / `lily` 1 / `mai` 1 の 4 件は `ryu` と同型であり、いまも入力面から到達できない」と書いたが、**実測の結果それは誤りであった。⇒ 訂正の全文は設計伝達レポート `docs/handover/design-reports/20260910-m35-02-design-exceptions.md` §0。**

#### 2.7.1 実際に見つかったもの ── `original_move_code` の dangling 参照 4 件

| キャラ | rush 版の `move_code` | 基底技（**実在する**） | `original_move_code` | 実在 |
|---|---|---|---|---|
| `ingrid` | `rush_glowing_touch_1hits` | `glowing_touch_1hits`（`unique`） | `glowing_touch_1` | **無い** |
| `ingrid` | `rush_luminous_uppercut_1hits` | `luminous_uppercut_1hits`（`unique`） | `luminous_uppercut_1` | **無い** |
| `lily` | `rush_desert_storm_1hits` | `desert_storm_1hits`（`unique`） | `desert_storm_1` | **無い** |
| `mai` | `rush_hoshi_kujaku_1hits` | `hoshi_kujaku_1hits`（`unique`） | `hoshi_kujaku_1` | **無い** |

**★4 件とも `move_code` は正しく `rush_` ＋ 基底である。⇒ `isOnUniqueTab`**（`web/src/features/combo/moveSurfacing.ts:141-146`）**が `true` を返し、入力面には出ている。★`ryu` とは壊れていた列が違う。**

| | `ryu`（本サブが是正） | 上の 4 件 |
|---|---|---|
| 壊れていた列 | **`move_code`** | **`original_move_code`** |
| `original_move_id` | **正常に解決していた** | **NULL** |
| 入力面 | **到達できない** | **到達できる** |
| 実害 | ラッシュ版が押せない | セットプレイ提案からの脱落 ／ `numeric`・`srk` の別名欠落 |

#### 2.7.2 ★既に登録・割付済みであった

`docs/handover/followup-backlog.md` の **`rush-original-move-code-typo`**（**未着手**）。割付は **別サブ**（**開発者裁定 2026-08-13** ／ `D-336` (b) 経路）。**⇒ 本サブが新たに見つけたものではない。★`DES-004` §3.2.1 の `:320` 直下の注記も、同 4 件を dangling 参照として正確に記録していた。**

**★本サブが足せたのは実害 1 件だけである**——**表記プリセット `numeric` / `srk` の別名を持たない**（`000072` / `000073` の全数走査で 0 行。対照＝`zangief/rush_power_stomps_1hits` は両方 1 行）。機序は `internal/seedgen/generate_m2002.go:88-91` `:636-641` が自ら記録している。

#### 2.7.3 ★★「未分類 4 件」の正体（**初版の取り違え**）

初版は `moveSurfacing.roster.test.ts` の `rush_variant: 5 → 4` を「独立の裏づけ」として引いたが、**同テストが数えているのは `isOnUniqueTab` 側であり母集団が違う。★件数が同じ 4 だったのは偶然である。**

**実測した本当の 4 件**（2026-09-10）:

- `alex/rush_standing_heavy_punch_holding`
- `alex/rush_standing_heavy_kick_holding`
- `jamie/rush_drink_level_1_standing_light_punch`
- `zangief/rush_standing_heavy_punch_holding`

**いずれも基底が `normal` として実在し `original_move_code` も正しい。落ちる理由は `HitBoxLayout` の方向×強度×ボタンから到達できないことである。⇒ 3 つ目の別の型であり、`M35-02` の射程とも `rush-original-move-code-typo` の射程とも違う。**

#### 2.7.4 ★誤った原因（**機構の話**）

§2.4 の `awk` 式は **`"rush_" + original_move_code != move_code`** を見ており、**2 種類の欠陥を区別せずに拾う**。`ryu` は両方の列が同じ値だったため、**拾ったものの意味を結果から逆算して決めてしまった。⇒ 教訓は設計伝達レポート §7-6。**

---

## 3. 三点 1 — CSV 正本

`character_data/ryu.csv`

| 行 | 前 | 後 |
|---|---|---|
| `:27` | `ryu,axe_kick_2,unique,かかと落とし,…` | `ryu,axe_kick,unique,かかと落とし,…` |
| `:84` | `…,original_move_code=axe_kick_2,…` | `…,original_move_code=axe_kick,…` |

**★両方直した**（チェックリスト A-2）**。`:84` を落とすと `rush_axe_kick` の参照先が消え、「直したつもりで別の壊れ方をする」。**

**★`:84` の 2 列目（`rush_axe_kick` 自身の `move_code`）は触っていない。**

---

## 4. 三点 2 — golden 4 本の再生成

**★手編集していない**（チェックリスト A-3）。`cmd/seedgen` で生成し直した。

### 4.1 再生成に使ったコマンド（リポジトリルート）

```bash
go run ./cmd/seedgen -chars ryu -out 000030_seed_moves_ryu \
  -note "M14-03c: ryu の moves + official_ja_move alias + recovery を手入力 CSV 由来で投入する(旧 seed は 000029 で削除済み)。"

go run ./cmd/seedgen -mode move-commands \
  -chars terry,guile,lily,ingrid,kimberly,juri,ken,mai,zangief,ryu \
  -out 000035_seed_move_commands \
  -note "M17-02: command 索引 move_commands の seed(非派生のみ・CHANGE-069 §2.1-b)"

go run ./cmd/seedgen -mode aliases -preset numeric \
  -chars guile,ingrid,jamie,jp,juri,ken,kimberly,lily,luke,m_bison,mai,manon,marisa,rashid,ryu,terry,zangief \
  -movement-chars c_viper,dhalsim,guile,ingrid,jamie,jp,juri,ken,kimberly,lily,luke,m_bison,mai,manon,marisa,rashid,ryu,terry,zangief \
  -out 000072_m20_seed_aliases_numeric \
  -note "M20-02: 表記プリセット numeric のエイリアス投入(D-311 / D-314 / D-315 / D-321)"

# srk は -preset srk / -out 000073_m20_seed_aliases_srk / -note の numeric→srk 置換のみ
```

4 本とも `cmd/seedgen` の `preM2003Stems` に含まれ、`formatFor(stem)` が `FormatPreM2003` を自動選択するため**追加フラグは不要**。`-chars` ／ `-movement-chars` は `generate_m2002_golden_test.go` の `m2002CharOrder` ／ `m2002MovementChars` と同一である。

### 4.2 再生成の結果が想定どおりであることの確認

`git diff -U0 -- migrations/` を全数読み、**動いた 8 ファイル・11 行がすべて `axe_kick_2` → `axe_kick` の 1 対 1 置換であること**を確認した。**目視だけでなく機械照合した**——差分の `+` 側に逆置換をかけて `-` 側と `diff` し、**差異ゼロ**を得た。

- **行の増減なし**（`8 files changed, 11 insertions(+), 11 deletions(-)`）
- **並び替えなし**（`axe_kick` は `axe_kick_2` と同じソート位置に入るため、down の code 列挙の並びも変わらない）
- **他キャラへの波及なし**
- **`rush_axe_kick` の出現数は差分の左右で同数（5 / 5）**＝1 文字も触っていない（チェックリスト B-3）

### 4.3 検査

- `go test ./internal/seedgen/` … **ok**
- `go run ./cmd/seedgen -check` … **`OK: 生成物は既存ファイルと一致` / exit 0**
- `migrations/` に残る `axe_kick_2` … **0 件**

---

## 5. 三点 3 — 追随マイグレ `000108`

`migrations/000108_data_correct_ryu_axe_kick_code.up.sql` ／ `.down.sql`（**新規**）

| 観点 | 採ったこと |
|---|---|
| **層** | **ファイル名に `_data_` を入れた**（層 B＝`CC-BY-SA-4.0`）。SF6 の技名は SF6 の事実である |
| **絞り** | **`character_id` と対で絞る**——`moves.code` はテーブル全体では一意でない（`UNIQUE` は `(character_id, code)`）。**巻き添えは静かに起きる** |
| **ガード** | **`NOT EXISTS`**（改名先が空いているときだけ当てる。`SUPP-001` §5.5.4 (8)）。**無いと新規 DB で `UNIQUE` 違反になりマイグレが落ちる**——新規 DB は golden 由来で既に `axe_kick` を持つため |
| **`down`** | **書いた**（`SUPP-001` §5.5.4） |
| **DDL** | **書いていない**（DML のみ） |
| **番号** | **`000108`**。`D-800` の払い出しどおりであり、**自採番していない** |

### 5.1 ★DB 側の追随 `UPDATE` は要らない（チェックリスト C-5 への回答）

チェックリスト C-5 は「`preset_aliases` の参照も更新されているか」を最重要の 1 つに挙げている。**回答＝更新は要らない。ただし「やらなくてよい」ではなく「やる対象が無い」である。**

`DES-004` §2.1 が言う「`move_code` は `preset_aliases` の解決キーである」は、**`preset_aliases` の行が `move_code` を持っているという意味ではない**。`preset_aliases` は `move_id` を持ち（`DES-003` §3.14）、**`code` はそれを解決するために seed SQL の中で使われる**。⇒ 動くのは「`code` で INSERT 先を解決している golden SQL」だけであり、**それは §4 で再生成済みである。**

**★これを実測で裏づけた**（§8 の `TestRun_M3502_LinksSurvive`）——改名の前後で `preset_aliases` ／ `move_commands` ／ `moves.original_move_id` が**同一の `move_id` を指し続ける**ことを固定した。**件数だけでは「別の行に付け替わった」形の事故を取り落とす**ため、`move_id` の同一性と参照の生存を対で見ている。

### 5.2 ★このマイグレは新規 DB では 1 行も更新しない

同じ是正を CSV 正本と golden 4 本にも入れてあるため、新規 DB は最初から是正後の code で seed される。**`UPDATE` は 0 行に当たって成功する——エラーにならない**（`SUPP-001` §5.5.4 (6)）。

**⇒ 本マイグレの存在価値は「既に適用済みの DB（開発者の手元）を追随させる」ことだけであり、その経路は CI では再現できない。** したがってテストは**件数ではなく `v108` 時点の最終状態と `down` → re-up の往復**で固定した（§8）。

### 5.3 ★改名先が旧体系の綴りと同じことについて

`axe_kick` は **`000004` 由来の旧体系 seed が使っていた綴りでもある**（それを `000029` が掃いた）。**⇒ 「旧体系の名前へ戻す」形になるが、開発者の確定どおりであり、旧 seed 行が復活するわけではない**（`000029` は削除済み・本マイグレは既存行の改名のみ）。この点は up の SQL コメントにも書いた。

### 5.4 検査

```
$ bash scripts/check-migration-license.sh
結果: 違反なし                                            (exit 0)

$ bash scripts/check-migration-license.sh --list | grep 000108
  B      新規       CC-BY-SA-4.0   000108_data_correct_ryu_axe_kick_code.down.sql
  B      新規       CC-BY-SA-4.0   000108_data_correct_ryu_axe_kick_code.up.sql
```

**⇒ 層 B と判定された**（チェックリスト C-1 / C-2）。

---

## 6. ★★版固定テストの追随（**先例に無い、本サブ固有の点**）

`internal/infra/migration/migrate_m1403c_test.go` は **終端 `v30`**（`000030` の直後）に固定されており、

- `:99` … `axe_kick_2` を「**新体系に在る** code」として 1 件を主張
- `:107` … `axe_kick` を「**旧体系で不在であるべき** code」として 0 件を主張

と書いていた。**golden `000030` が `axe_kick` を seed するようになったため、この 2 つの主張が反転する。**

**★先に赤を実測してから直した**:

```
--- FAIL: TestRun_M1403c_UpContract
    migrate_m1403c_test.go:103: 新 code "axe_kick_2" = 0, want 1
    migrate_m1403c_test.go:111: 旧 code "axe_kick" が残存 = 1, want 0
```

**是正**: `:99` の列挙から `axe_kick_2` を外して `axe_kick` を置き、`:107` の不在リストから `axe_kick` を外して `axe_kick_2` を置いた。**要素数はどちらも変わっていない**（主張は対のまま入れ替わる）。理由はコード内のコメントに明記した。

### 6.1 ★これは「落ちたテストを緩める」ではない

**主張の意味は「新体系が使う code はこれである」**であって「その綴りが未来永劫この形である」ではない。開発者の確定により新体系の code が変わったので、主張の側も追随させた。**強さは変わっていない**——是正前は 1 件/0 件だった 2 行が、是正後に 0 件/1 件へ**反転するだけ**である。

**★terry の先例には版固定テストが無かった**（`000026` を動かしたが、その版に固定された契約テストが存在しない）**ため、この追随は本サブが初めて行う。⇒ 先例をそのまま写しても出てこない作業であり、明示して残す。**

---

## 7. 面の側の追随

### 7.1 `inputResolution.test.ts` — 純粋関数の単体テスト（指示書 §5-2）

`resolveRushByCode` が `axe_kick` → `rush_axe_kick` を解決することを固定した。**同じテストの中に陽性対照を置いた**——旧の綴り `axe_kick_2` では `rush_axe_kick_2` を探して `null` になること、および `hasUniqueRushVariant` が `false` になることを対で主張している。**⇒ 機序がテストの形で残る。**

### 7.2 ★★`moveSurfacing.roster.test.ts` — **実データ由来の実測値が動いた**

**★★これが「是正が実データで効いた」ことの最も強い証拠である。** 同テストは**フィクスチャではなく `character_data/*.csv` を読んで**「入力面に出ない行」を数えている。

| 主張 | 着手時点 | 是正後 |
|---|---|---|
| 未分類の総数（CSV 由来・固有状態タブ無しの基準） | **144** | **143** |
| うち `category = rush_variant`（＝ラッシュ版の孤児） | **5** | **4** |
| キャラ別 `ryu` | **3** | **2** |

**★他 30 キャラは 1 件も動いていない。⇒ 本サブが `ryu` の 1 件だけを触ったことの機械的な裏づけである。**

**★★残る `rush_variant: 4` を §2.7 の 4 件と同一視したのは誤りであった**（2026-09-10 訂正）**。⇒ 正体は `alex` 2 / `jamie` 1 / `zangief` 1 であり、件数が一致したのは偶然である**（§2.7.3）。

**★これらの数字は「緑にするために合わせた値」ではない。** 是正の副作用として動いた実測であり、**動くこと自体が検出したい変化である**（同テストが自ら述べている性質）。

### 7.3 `moveSurfacing.test.ts` — **失効した実例の差し替え**

同ファイルは「**区分 C ＝ `rush_variant` の孤児**」というフィクスチャを持ち、その実例に ryu の `axe_kick_2` ／ `rush_axe_kick` を使っていた。**本サブ後、その組は実在しない。⇒ 残すと「ryu はまだ壊れている」と後任に読まれる。**

**★★1 度目の差し替えは誤っていた**（2026-09-10 再訂正）——「いま実在する `ingrid` の組」として `glowing_touch_1` ／ `rush_glowing_touch_1hits` を置いたが、**`ingrid` の実データの基底は `glowing_touch_1hits` であり、この組は実在しない**（§2.7）。

**⇒ 明らかに合成と分かる名前へ改めた**（`example_unique_1hits` ／ `rush_example_unique_1`）**。★挙動の主張は 1 バイトも変えていない**（孤児は未分類バケットへ落ちる）。**★合成にした理由をコメントへ書いた**——**実データに「基底が `unique` の孤児」は現存しない**（`M35-02` が `ryu` の 1 件を是正して 0 件になった）**。⇒ 区分 C の挙動を守るには合成するしかない。★実在する未分類 4 件は基底が `normal` であり、このフィクスチャの位置には置けない。**

### 7.4 ★`VirtualController.test.tsx` — 入力面での陽性対照（**新規 2 本**）

**指示書 §2.3-1 ／ チェックリスト D-1 が求める「直す前は選べない・直した後は選べる」を、面の上で機械化した。**

- **陽性対照**: 基底 code が rush 版と対応していないと、ボタンは `disabled` のまま並び、クリックしても `onStepAdd` が呼ばれない
- **是正後**: 対応していれば `disabled` が外れ、クリックで `rush_axe_kick` が積まれる

**★★壊れ方を実データどおりに写した。** `ryu` は `rush_collarbone_breaker` 等を持つため `hasUniqueRushVariant` が `true` であり、**ラッシュトグル自体は着手時点から出ていた**。⇒ 壊れ方は「トグルが出ない」ではなく「**トグルは出るが、かかと落としのボタンだけが押せない**」である。**兄弟の rush ボタンが押せることも対で主張している。**

**★兄弟を混ぜないとトグルごと消え、実際より分かりやすい壊れ方を検査してしまう**（最初の実装で実際にそうなり、テストが赤になって気づいた）。

**★2 本に分けたのは `renderVC` が `unmount` を返さないためである**（1 テスト 1 レンダー）。

---

## 8. マイグレ契約テスト（新規）

`internal/infra/migration/migrate_m3502_test.go` —— `migrate_m3002_test.go`（`000107`）と同型。

| テスト | 何を固定するか |
|---|---|
| `TestRun_M3502_V108State` | `v108` 時点で旧 code 0 件・新 code 1 件・`rush_axe_kick` 1 件を**対で**固定。**加えて `v107` 時点で既に新 code であること**＝golden が是正されている根拠（`000108` の `UPDATE` が新規 DB では 0 行に当たることの裏づけ） |
| `TestRun_M3502_RushIsReachable` | **本サブの目的そのもの**。`resolveRushByCode` が組み立てる `rush_` + 基底 code が実在し、**かつ**その rush 版の `original_move_id` が基底技を指すこと。**★命名と参照を対で見る**——前者だけだと偶然一致した状態を通し、後者だけだとフロントから到達できない状態を通す |
| `TestRun_M3502_DownUpRoundTrip` | `down` → re-up。**★これだけが「既存 DB の追随」経路を実際に動かす唯一の検証である** |
| `TestRun_M3502_LinksSurvive` | `preset_aliases` ／ `move_commands` ／ `moves.original_move_id` が改名の前後で**同一の `move_id`** を指し続けること |

**★件数で固定していない**（指示書 §4.3 ／ `SUPP-001` §5.5.4 (6)）。`UPDATE` の影響行数は固定していない。`preset_aliases` も「3 件」ではなく「**0 でないこと**」で見ている——別名プリセットは後続サブで増え得るためである。

**★区間終端は `m3502Terminus = 108`（HEAD を終端にしない）**——`SUPP-001` §5.5 規約 (1)(2)。HEAD 終端だと後続サブの正当な是正でこのファイルが落ち、「期待値を緩める」誘惑が発生する。**版数リテラルは名前付き定数 1 か所に閉じた**（followup `migration-version-literals-in-tests`）。

---

## 9. 破壊確認（**緑が本物であることを示す**）

**いずれも実施後に復元し、`git status --short` が空（差分 0）であることを確認した。**

### 9-1. `ryu.csv:27` を旧 code へ戻す

```
$ go run ./cmd/seedgen -check
OK: 生成物は既存ファイルと一致
exit=0                     ← ★緑を返す

$ go test ./internal/seedgen/
--- FAIL: TestGolden_MoveCommandsMatchesRegeneration
--- FAIL: TestGolden_M2002NumericAliasesMatchesRegeneration
--- FAIL: TestGolden_M2002SRKAliasesMatchesRegeneration
--- FAIL: TestGolden_RyuMigrationMatchesRegeneration
exit=1                     ← ★こちらだけが捕まえる
```

**★★これは `M28-05` §6-2 の実測より強い形である。** terry は `FirstWaveOrder` に居るため、`terry.csv` を壊すと `-check` が赤くなった（`000026` を守っているため）。**ryu は `000026` に居ないため、`-check` は基底 CSV を壊しても緑のままである。⇒ ryu について `seedgen -check` は golden をまったく守らない。**

**★「`-check` が緑だから golden は守られている」と読むと、ryu では守られていない区分を守っていることにできる**（`CHANGE-163` §1 ／ `SUPP-001` §5.5.4 (10)）。

### 9-2. golden の 1 行だけを手で旧 code へ戻す（手編集ドリフト）

`000072` の別名 1 行と `000030` の別名 1 行を旧 code へ戻した。

```
$ go run ./cmd/seedgen -check     → OK / exit 0        ← ★緑のまま
$ go test ./internal/seedgen/
--- FAIL: TestGolden_M2002NumericAliasesMatchesRegeneration
--- FAIL: TestGolden_RyuMigrationMatchesRegeneration
exit=1
```

### 9-3. マイグレのファイル名から `data_` を外す

```
$ bash scripts/check-migration-license.sh
NG  ★静かな漏れ: migrations/000108_correct_ryu_axe_kick_code.up.sql は
    ゲームデータ表(moves)へ書くのに `_data_` を持たず層 A(AGPL)へ落ちている。
結果: 違反 2 件                                          (exit 1)
```

**⇒ 期待どおり赤。** 復元後は `結果: 違反なし`。

### 9-4. `000108` の `up` を無効化する

```
--- FAIL: TestRun_M3502_DownUpRoundTrip
    migrate_m3502_test.go:193: 是正後の ryu axe_kick_2 = 1 件, want 0
    migrate_m3502_test.go:193: 是正後の ryu axe_kick = 0 件, want 1
```

**★★往復テストだけが捕まえた。** `TestRun_M3502_V108State` は緑のままである——新規 DB は golden 由来で既に是正後だからである。**⇒ §5.2 で述べた「往復だけが追随経路を動かす」ことの実測である。**

### 9-5. rush の元技参照だけを壊す（`RushIsReachable` が効くか）

`000030` の `WHEN 'rush_axe_kick' THEN 'axe_kick'` を旧 code へ戻した。

```
--- FAIL: TestRun_M3502_RushIsReachable
    migrate_m3502_test.go:148: rush_axe_kick の original_move_id を解決できない: sql: no rows in result set
```

### 9-6. 面のテストが効くか

`VirtualController.test.tsx` の是正後フィクスチャの基底 code を旧綴りへ戻すと、**当該テスト 1 本だけが赤**（`1 failed | 49 passed`）。復元後 `50 passed`。

### 9-7. ★`up` 側の `id` 同一性の主張が効くか（**レビュー 中-4 の採用後に追加**）

`000108.up` の `UPDATE` を `id` が変わる形（`SET code = 'axe_kick', id = id + 500000`）へ差し替えた。

```
--- FAIL: TestRun_M3502_DownUpRoundTrip
    migrate_m3502_test.go:211: re-up 後の move.id = 501065, want 1065 (改名で行が入れ替わっている)
```

**★★捕まえたのは追加した行だけである。** `TestRun_M3502_LinksSurvive`（down 側で `id` を見ている）は**この壊し方を捕まえない**——**既存 DB が実際に通るのは up 側だから**である。**⇒ レビュー 中-4 の指摘は正しかった。**

---

## 10. 検査（**すべて出力で判定・常設検査は最後**）

| # | 検査 | 結果 |
|---|---|---|
| 1 | `go build ./...` ／ `go vet ./...` | **通過**（出力なし） |
| 2 | `go test ./...` | **`FAIL` 0 件**（全パッケージ `ok`） |
| 3 | `cd web && pnpm test` | **`224 files / 2674 tests` 全緑** |
| 4 | `cd web && pnpm exec tsc --noEmit` | **exit 0** |
| 5 | `bash scripts/check-migration-license.sh` | **違反なし**／`000108` は**層 B** |
| 6 | `make e2e-only P=m30-01` | **9 passed** |
| 7 | `make e2e-only P=m30-02` | **7 passed** |
| 8 | `make e2e-only P=m15-03` | **1 passed** |
| 9 | `make e2e-only P=m12-05` | **2 passed**（ryu の仮想コントローラ回帰を含む） |
| **10** | **`bash scripts/check-artifact-integrity.sh`**（**1 本目**） | **違反なし**（検査 15 件の自己検査 ＋ 生成物 4 件が健全） |
| 11 | `bash scripts/check-doc-refs.sh` | dead reference なし |
| 12 | `bash scripts/check-browser-storage-keys.sh` | 違反なし |
| 13 | `bash scripts/check-enum-sync.sh` | ベースラインどおり |
| 14 | `bash scripts/check-stop-discipline.sh` | 違反なし |
| 15 | `bash scripts/check-instruction-format.sh` | 違反なし |
| 16 | `bash scripts/check-doc-inventory.sh` | 型に無いファイルなし |
| 17 | `bash scripts/check-import-order.sh` | 違反なし（§12 に注記） |
| 18 | `bash scripts/check-progress-log-index.sh` | **Phase D で追記した直後に回す** |
| 19 | `bash scripts/check-md-emphasis.sh <本ファイル>` | §13 に結果 |

**★`make e2e-only` を使い、`playwright` を直接叩いていない**（`CLAUDE.md` §11 ／ `D-599`）。

---

## 11. 変更したファイル一覧と変更統計

**着手基点 `0660fa2`。**

```
$ git diff --stat 0660fa2..HEAD
 character_data/ryu.csv                             |   4 +-
 internal/infra/migration/migrate_m1403c_test.go    |  22 +-
 internal/infra/migration/migrate_m3502_test.go     | 254 +++++++++++++++++++++
 migrations/000030_seed_moves_ryu.down.sql          |   4 +-
 migrations/000030_seed_moves_ryu.up.sql            |   6 +-
 migrations/000035_seed_move_commands.down.sql      |   2 +-
 migrations/000035_seed_move_commands.up.sql        |   2 +-
 .../000072_m20_seed_aliases_numeric.down.sql       |   2 +-
 migrations/000072_m20_seed_aliases_numeric.up.sql  |   2 +-
 migrations/000073_m20_seed_aliases_srk.down.sql    |   2 +-
 migrations/000073_m20_seed_aliases_srk.up.sql      |   2 +-
 .../000108_data_correct_ryu_axe_kick_code.down.sql |  26 +++
 .../000108_data_correct_ryu_axe_kick_code.up.sql   |  70 ++++++
 .../VirtualController/VirtualController.test.tsx   |  64 ++++++
 web/src/features/combo/inputResolution.test.ts     |  27 +++
 .../features/combo/moveSurfacing.roster.test.ts    |  22 +-
 web/src/features/combo/moveSurfacing.test.ts       |  15 +-
 17 files changed, 502 insertions(+), 24 deletions(-)
```

### 11.1 ★新規ファイルの上書き確認（教訓 `E-225`）

**新規のつもりのファイルが `+` だけか**を上表で読んだ。

```
$ git diff --name-status 0660fa2..HEAD | grep -v '^M'
A	internal/infra/migration/migrate_m3502_test.go
A	migrations/000108_data_correct_ryu_axe_kick_code.down.sql
A	migrations/000108_data_correct_ryu_axe_kick_code.up.sql
```

**新規は 3 本のみで、いずれも `A`（追加）であり、変更統計は `254 +` ／ `26 +` ／ `70 +` と insertions だけである。⇒ 上書きで消えた行は無い。** 削除されたファイルも 0 件である。**作成前に `ls` で同名不在を確認してから書いた。**

### 11.2 コミット

| コミット | 内容 |
|---|---|
| `10e1b74` | CSV 正本 ＋ golden 4 本（三点 1・2） |
| `b7c35e2` | 追随マイグレ `000108` ＋ 契約テスト ＋ 版固定テストの追随（三点 3） |
| `f62a5d7` | 面のテスト（解決の固定・失効実例の差し替え・実測値の更新） |
| `8e77e6d` | 入力面での陽性対照 2 本 |

---

## 12. ■ 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の登録**（`docs/handover/change-number-registry.md` §1） | **不要。★消費 0 本である**——`move_code` の値は設計書に載っておらず、設計書の契約は変わらない（指示書の見込みどおり）。**★載っていないことは実査で確かめた**（`docs/design/` に `axe_kick` の記載なし） |
| 2 | **消費したマイグレ連番** | **`000108` の 1 本**。`ls migrations/` の実査で着手時の末尾は `000107` であり、`docs/process/parallel-board.md` §2.2 の「次に払い出す番号」は既に **`000110`** と書かれている（`000108`＝`M35-02` ／ `000109`＝`M31-04` へ払い出し済み＝`D-800`）。**⇒ ずれていない。ボードの更新は不要** |
| 3 | **版を上げた文書の参照元** | **不要。★本サブは設計書・指示書の版を 1 つも上げていない**（`docs/design/` は編集していない＝`CLAUDE.md` §8） |
| 4 | **`docs/handover/followup-backlog.md` §CE の `ryu-axe-kick-code-mismatch`** | **★製造は §CE を直接書けない**（`D-382`。製造が書けるのは §J だけ）**。⇒ 解決済みであることを設計伝達レポート §4 へ書き、設計卓に畳んでもらう** |
| 5 | **派生資料**（`code-facts` 等） | **再生成は不要。★ただし根拠を差し替えた**（レビュー 低-10 の採用）——**`check-artifact-integrity.sh` が見るのは生成物の *健全性* であって *鮮度* ではない。鮮度は `check-derived-docs.sh` が担う**（`CLAUDE.md` §8）**。⇒ 同スクリプトを実行した実測は `code-facts` 21% ／ `docs-map` 13% ／ `custom-commands` 38% の陳腐化疑いだが、★いずれも本サブ起因ではない**（`code-facts.md` に `axe_kick` の記載は無い。本サブが足した新規は**テストとマイグレのみ**で、Go/TS の公開シンボルを 1 つも足していない）**。⇒ 結論は変わらず「再生成不要」** |

### 12.1 ★横断の申し送り（**本サブでは直していない**）

| # | 事項 | 根拠 |
|---|---|---|
| **1** | **★★2026-09-10 訂正。** `original_move_code` の dangling 参照 4 件（`ingrid` 2 ／ `lily` 1 ／ `mai` 1）。**★「入力面から到達できない」は誤りであった**（入力面には出ている＝§2.7.1）**。実害はセットプレイ提案からの脱落と `numeric`・`srk` の別名欠落である** | **★既に followup `rush-original-move-code-typo` として登録・割付済み**（**別サブ**・開発者裁定 2026-08-13 ／ `D-336` (b)）**。⇒ 本サブが新規に見つけたものではない。** 追補の見積りは設計伝達レポート §4-2 |
| **2** | **`inputResolution.ts:78` のコメントが失効している**——「存在しなければトグルを出さない＝`ryu` 等での空状態回避」と書いてあるが、**`ryu` は `rush_collarbone_breaker` 等を持つため `hasUniqueRushVariant` は着手時点から `true` であった** | **★本サブが失効させたのではなく、着手前から失効していた**（実測で確認）。**⇒ 射程外のため直していない。★同型が `VirtualController.test.tsx` のテスト名「既定(`ryu` 相当・unique ラッシュ版なし)」にもある** |
| **3** | **`check-import-order.sh` がベースラインより 2 ファイル少ないと報告する**（`BASELINE` を 99 へ下げる提案） | **★本サブとは無関係**——本サブは import 行を 1 行も足していない。**着手前から在った改善余地であり、改善レーンの手番** |
| **4** | **★★旧 `move_code` を含む既存エクスポート CSV の再取込は `VAL-I07`（WARNING）になり、当該ステップが技を失ったまま入る** | §2.3.1（レビュー 中-3）**。★本サブ固有ではなく「三点更新」という型に属する**——`000063` ／ `000106` ／ `000107` にも同じ帰結が当たる |
| **5** | **★★`v108` から `v29` まで降ろすと孤児行が残る**（`000030.down` の code 列挙が `axe_kick` なのに、行は `axe_kick_2` に戻っているため当たらない） | レビュー 中-7。**★機序を `000108` の down SQL コメントへ 3 段で書き残した。★本サブが作った欠陥ではなく `000063` ／ `000106` ／ `000107` と共有する既存クラスであり、`m.Down()` / `Migrate(0)` を呼ぶテストは 1 本も無い**（実測）**。`M33` の統合で消える性質でもある。⇒ 記録のみ** |
| **6** | **`check-derived-docs.sh` が製造 CLI の検査表に載っていない** | レビュー 低-10。**`CLAUDE.md` §8 が警告する「回すきっかけが無くなる」型そのもの。⇒ CLI 側の運用課題であり本サブの手番ではない** |

---

## 13. Markdown の閉じない強調チェック（`D-775`）

<!-- COMPLETION-REPORT-MD-EMPHASIS -->

**この手番で `docs/progress/` へ新規に作ったファイルを、`check-md-emphasis.sh` のファイル引数モードへ通した結果は §13.1 に置く。**

### 13.1 結果

- `docs/progress/M35-02-completion-report.md`（本ファイル） … **§13.2**
- `docs/progress/m35-02-review.md`（Phase B のレビュー報告書 ＋ Phase C の取り込み結果） … **§13.3**

### 13.2 実行結果

```
$ bash scripts/check-md-emphasis.sh docs/progress/M35-02-completion-report.md
検出: 0 行(ファイル指定のためベースライン比較を行わない)
exit=0
```

**⇒ 本ファイルは緑である**（Phase A 完了時点で 0 行。**Phase C の追記後に再度通して 0 行**）。

### 13.3 レビュー報告書

```
$ bash scripts/check-md-emphasis.sh docs/progress/m35-02-review.md
docs/progress/m35-02-review.md:320
検出: 1 行
```

**★1 行検出されたので自分で直した。** 原因は Phase C で書いた `**未解消ではなく「…」**であり` の形——**閉じ `**` の直前が約物**（`」`）**だと CommonMark が強調を閉じない。★`**` の個数は偶数のままなので、偶数チェックでは検出できない。** 閉じ `**` の直前の約物を強調の外へ出して解消した（`**未解消ではない**——「…」であり`）。

```
$ bash scripts/check-md-emphasis.sh docs/progress/m35-02-review.md
検出: 0 行
exit=0
```

**★検出行は自分がこの手番で書いた行である**（行番号で確認）**。既存の歴史記録の行は 1 行も直していない。**

---

## 14. レビューと取り込み（Phase C）

<!-- COMPLETION-REPORT-WRITE-TIMING -->

**★本節は Phase C の後に、実測で埋めた**（`D-510`）**。Phase A / B の時点ではプレースホルダのままにしてあった。**

| 項目 | 実測 |
|---|---|
| レビュー報告書 | `docs/progress/m35-02-review.md`（Phase B の fresh subagent が生成。**`fork` は使っていない**） |
| 指摘の総数 | **11 件** |
| 優先度別内訳 | **高 2 件 ／ 中 5 件 ／ 低 4 件** |
| **「高」指摘の不採用** | **0 件**（**2 件とも採用した**。⇒ 開発者へのエスカレーションは発生していない） |
| 採否 | **採用 10 件 ／ 不採用 1 件**（不採用は低-11 のみ。理由は下表） |
| 再レビュー往復の回数 | **0 回**（初回レビューのみ。**上限 2 回に達していない**） |

### 14.1 各指摘の採否と理由

**★正本はレビュー報告書末尾の「取り込み結果（自動トリアージ）」節である。** 以下はその要約。

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|---|---|---|---|
| 1 | **高** | `inputResolution.ts:78` の失効コメント（`ryu` を「トグルを出さない例」として挙げている） | **採用** | **★指摘のとおり `ryu` は反例である**（unique ラッシュ版を 5 件持つ）**。⇒ まさにこの誤解を否定する面のテストを新設した手番で、誤解の源を残すのは筋が通らない**。着手前から失効していた旨を明記して書き換えた |
| 2 | **高** | `VirtualController.test.tsx` のテスト名「既定(`ryu` 相当・unique ラッシュ版なし)」 | **採用** | **★本サブが同一ファイルに矛盾する記述を持ち込んだ**（8 行上の新規コメントが正面から否定している）**。⇒ 本サブ起因である。**「unique ラッシュ版を持たないキャラでは」へ改め、主張は変えていない |
| 3 | 中 | 走査軸に `comboio` の CSV 入出力契約が入っていない | **採用** | **★自分で実査して裏づけた**（`contract.go:56` ／ `lookup.go:73` ／ `csvcore/validate.go:197` ／ `import.go:443`）**。§2.3 の断定を DB 内に限定し、§2.3.1 を新設。§12.1-4 へ申し送りを足した** |
| 4 | 中 | `down` の非対称の検討が `v107` 止まり（`v29` まで降ろすと孤児行が残る） | **採用（記録のみ）** | **★機序を `000108` の down SQL コメントへ 3 段で書き残した。★修正はしない**——本サブが作った欠陥ではなく `000063` ／ `000106` ／ `000107` と共有する既存クラスであり、レビュー自身も記録のみを推奨している |
| 5 | 中 | `up` 側の `id` 同一性が未固定 | **採用** | **★破壊確認で正しさを確かめた**（§9-7）**。`LinksSurvive` はこの壊し方を捕まえない。⇒ 主張を `DownUpRoundTrip` の re-up 後へ足した**（`id` の同一性 ＋ 参照 3 種の生存） |
| 6 | 中 | `migrate_m1403c_test.go` の見出しコメント 2 か所が不正確 | **採用** | **★指摘のとおり「由来」で括ると 1 要素だけ意味が違う。⇒「役割」で括り直した**（「`000030` が seed する code」「seed 後に残っていてはならない code」）。エラーメッセージも揃えた |
| 7 | 中 | `progress-log.md` への索引行が未追記 | **採用** | **Phase D で追記した**（§14.2）。レビュー自身が「意図的な順序」と認めている |
| 8 | 低 | `migrate_m3502_test.go:48-50` のコメントが対象とずれている | **採用** | **★先例から写した際の取り残しであり、指摘のとおり。⇒ `m3502RushCode` 側へ寄せた** |
| 9 | 低 | `M35_02_SIBLING_RUSH` の綴りとコメントの食い違い | **採用（コメント側で解消）** | **★フィクスチャ側は変えられない**——既定の `MOVES` が `collar_bone_breaker`（旧綴り）を使っており、揃えないと兄弟として機能しない。**⇒ 「既存フィクスチャの綴りへ揃えている。綴りの違いは主張に影響しない」と注記した** |
| 10 | 低 | 派生資料の鮮度判定を「生成物健全性」で代替している | **採用** | **★指摘のとおり `check-artifact-integrity.sh` が見るのは健全性であって鮮度ではない。⇒ `check-derived-docs.sh` を実行し、§12-5 の根拠を実測へ差し替えた**（結論「再生成不要」は変わらない）。**CLI の検査表へ載せる件は §12.1-6 へ申し送り** |
| **11** | 低 | 実 DB の適用証跡（`logs/tacpendium.log` の `108/u`）を報告へ引く | **★不採用** | **★★前提を確かめたところ誤りであった。** 同ログの `108/u` 4 件は**すべて本サブの E2E 実行が書いたもの**であり、DB パスは `web/e2e/.tmp/tacpendium-e2e.db`（**使い捨ての E2E DB**）である。**⇒ `v1` から通しで適用する新規 DB であり、`000108` の `UPDATE` は 0 行に当たる。★「既存 DB の追随が効いた証跡」には *ならない*。** 引用すれば、観測していないことを断定したことになる（`D-510` と同型の誤り）**。⇒ 追随経路の検証は `DownUpRoundTrip` が唯一である**（§5.2）**という整理を変えない** |

### 14.2 ★「高」指摘の不採用は 0 件

**⇒ Phase C の安全弁（重大指摘の自動棄却）は発動していない。** 高 2 件はいずれも採用し、開発者への確認は不要と判断した。

### 14.3 ★不採用 1 件についての補足

**低-11 の不採用は「面倒だから」ではなく「その証跡が主張を支えないから」である。** レビューはログ行の存在を正しく観測したが、**その DB が使い捨ての E2E DB であることまでは確かめていなかった**。**⇒ 本サブはそれを実査して不採用とし、あわせて「E2E のログは追随経路の証跡にならない」という事実を §14.1 に残した**（次に同じログを見る担当が同じ読み違いをしないため）。

## 15. 更新履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 初版 | 2026-09-10 | Phase A（実装）完了時点。**§14 はプレースホルダのまま** |
| 第 2 版 | 2026-09-10 | **Phase C（レビュー取り込み）後。** §14 を実測で埋めた（指摘 11 件・高 2 件はいずれも採用・不採用は低-11 の 1 件のみ）。あわせて §2.3.1（CSV 入出力契約）・§9-7（破壊確認 7）・§12-5 の根拠差し替え・§12.1 の申し送り 3 件を追記 |

---

*以上、M35-02 完了報告。*
