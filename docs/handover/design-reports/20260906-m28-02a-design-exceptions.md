# 設計伝達レポート: M28-02a（`FR702` 追従のスキーマとバックエンド ＋ 始動位置・運び量）

| 項目 | 内容 |
|------|------|
| 作業ID | M28-02a |
| 対象指示書 | `docs/instructions/M28-02a-game-update-schema-and-backend.md` **v1.5.0** ／ チェックリスト `docs/instructions/reviews/M28-02a-review-checklist.md` v1.0.0 |
| CHANGE | **未起票。★製造は番号を消費していない**＝`D-293`。**たたき台は §6。宛先は `DES-002` / `DES-003` / `DES-005` / `DES-006` / `REQ-001` / `SUPP-001` の 6 本** |
| マイグレ | **消費 2 本＝`000104` / `000105`**（**★着手承認の手番で開発者が払い出した**。`ls migrations/` の実査で末尾は `000103` だった）。**⇒ 次に払い出す番号は `000106`** |
| 作成日 | 2026-09-06 |
| 実装コミット | `claude/m28-02a-implementation-3alpzk`・`426c97f..5d1b7af`（**6 コミット・push 済み**）。差分（`docs/` 除く）＝**92 ファイル / +5638 / −3011**。★うち `character_data/*.csv` 31 本が **+2774 / −2774**（全行末尾へ 24 列目の空欄を足したため全行が「変更」として出る）。**⇒ CSV を除くと 61 ファイル / +2864 / −237** |
| 源泉 | 完了報告 `docs/progress/M28-02a-completion-report.md` ／ レビュー `docs/progress/m28-02a-review.md`（**重大 0 / 高 4 / 中 3 / 低 6・高の不採用 0 件**）／ **開発者裁定 2 回**（2026-09-06 着手前 4 件 ／ 2026-09-06 手動確認 5 件）／ 実装直後の同一セッションで生成 |
| 宛先 | 設計卓（親チャット） |

**本レポートは ①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題 に絞る。指示書どおりの部分は割愛する。**

**★★最重要は §2-1（本スキーマ初の `CHECK` 制約を入れた ＝ `DES-003` §3.4 の方針に反する。受理か差し戻しの裁定が要る）と §1-1（新設 API 1 本 ＋ 一覧フィルタ 1 本の契約。`DES-002` §4.2 の経路表に載る）である。**

> **★★設計卓は `docs/progress/` を読まない**＝2026-08-11 開発者裁定①。**したがって本レポートは参照だけを書かず、判断に要る中身をここへ埋めてある。**

> **★本サブは「マーカーを立てる持ち場」を指示書が想定していない場所へ移した。** 指示書 §2.2-4 は「`seedgen` が SQL へ出力する側に入れること」とだけ書いており、**製造は初版でそれを moves の seed 波の生成物へ入れて失敗した**（golden が落ちる）。**⇒ `cmd/seedgen -mode game-version` という新しい生成モードを 1 つ足している。§1-3 に全文を書いた。**

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### §1-1 ★★新設した API 1 本と一覧フィルタ 1 本（`DES-002` §4.2 の経路表に載る）

#### (a) `POST /api/combos/:id/acknowledge-version` — 「確認した」（`FR702`）

**基準（`combos.baseline_version`）を `games.current_data_version` へ進める。**
実体＝`internal/api/combo/handler.go`（`AcknowledgeGameVersion`）／ `internal/service/combo/service.go` ／ `internal/repository/combo/repository.go`（`advanceBaselineVersionSQL`）。

**応答の実 DTO**（`GET /api/combos/:id` と同一型 ＝ `ComboResponse`。本サブが足した欄だけを抜いた実行結果）:

```json
{
  "affectedByGameUpdate": true,
  "baselineVersion": "2026.08.03.01",
  "carryDistanceMass": 45,
  "id": 1,
  "position": "mid_screen",
  "startPositionMass": 80
}
```

**エラー契約の全行**:

| 状況 | ステータス | コード |
|---|---|---|
| 成功 | **200** | —（`ComboResponse` を返す） |
| `:id` が整数でない | 400 | `invalid_id` |
| 対象が無い／**論理削除済み** | 404 | `not_found` |
| write lock を取れない | 503 | `database_busy` |
| それ以外 | 500 | `internal_error` |

**母集団の述語**: `WHERE id = ? AND deleted_at IS NULL`。
**⇒ ゴミ箱の行は「確認した」にできない**（404 になる）。**★仮登録（`is_draft = 1`）は対象に含む** —— 下書きも基準を持つため。

**★★持たせなかった分岐（読む側が誤読しないために要る）**:

1. **要求本文を取らない。** 版数をクライアントから受けない。**⇒ 任意の版へ「進めた」ことにできない。**
   `games` から直に読む（`SET baseline_version = (SELECT current_data_version FROM games WHERE code = ?)`）。
2. **楽観的排他を要求しない**（`version` を受けず、上げもしない）。**⇒ 409 は無い。**
   理由＝基準の前進はコンボの内容の変更ではなく「利用者が見た」ことの記録であり、他端末で編集中の版を無効にしない。
3. **一括操作は無い。** 1 件ずつだけである（部分消化＝`M28-overview` §3.2.7 の軸 3）。
4. **冪等ではないが安定である。** 同じ版のまま何度呼んでも結果は変わらない。版が進んだ後に再度呼べばそのときの最新まで進む。
5. **`updated_at` は進める。⇒ 更新日時順の一覧では並びが動く。** 意図した挙動である（据え置くと「いつ確認したか」がどこにも残らない）。

#### (b) `GET /api/combos?affected_by_game_update=true|false` — 影響可能性による絞り込み

| 値 | 挙動 |
|---|---|
| `true` | 影響可能性ありのみ |
| `false` | 影響なしのみ |
| 省略 | 絞り込まない |
| **上記以外** | **400 `invalid_query_param`** |

**★値域外を 400 に落としたのは既存の `setup_in_corner` と同じ扱いである** —— 「絞り込まない」に倒すと typo が全件返却に見える。
**★既存の `position` / `hit_type` / `opponent_stance` は値域を見ない**（既存挙動）。本フィルタだけが bool のため厳密に見る。

#### (c) `ComboResponse` に足した 4 欄（camelCase）

| JSON | 型 | 備考 |
|---|---|---|
| `baselineVersion` | `string?` | `omitempty` あり |
| `affectedByGameUpdate` | `bool` | **★`omitempty` を付けていない** —— `false` は「影響なし」という情報であり、キーが消えると「判定していない」と区別が付かない |
| `startPositionMass` | `int?` | 0〜160 |
| `carryDistanceMass` | `int?` | 0〜160 |

**`CreateRequest`（`POST` / `PUT`）が受けるのは `startPositionMass` / `carryDistanceMass` の 2 欄だけである。**
**★`baselineVersion` / `affectedByGameUpdate` は受けない**（サーバが入れる／導出する）。
**★`PATCH`（`UpdateMetadataRequest`）には 4 欄とも無い**（§4-1 の残課題）。

### §1-2 ★★`FR702` の判定の定義（`REQ-001` `FR702` ／ `DES-003` へ）

**保存しない。SELECT のたびに導出する。⇒ 影響コンボを持つ表は無い。**

```sql
EXISTS (
    SELECT 1 FROM combo_steps cs
    JOIN moves m ON m.id = cs.move_id
    WHERE cs.combo_id = combos.id
      AND m.last_changed_game_version IS NOT NULL
      AND (combos.baseline_version IS NULL
           OR m.last_changed_game_version > combos.baseline_version)
)
```

実体＝`internal/repository/combo/repository.go`（`affectedByGameUpdateCondSQL`）。
**★判定式は 1 か所しかなく、SELECT の派生列と一覧の WHERE が同じ式を共有する**（書き写すと表示と絞り込みが静かにずれる）。

**★★NULL の向き（指示書 §2.2-5 が「決めて報告すること」としていた点。⇒ 製造が確定させた）**:

| 状態 | 判定 | 根拠 |
|---|---|---|
| **基準が NULL** | **影響可能性あり** | 「いつの前提か分からない」＝**不明** ⇒ 安全側（`FR307` と同じ向き）。出し漏らさない |
| **マーカーが NULL** | **影響なし** | **★これは「不明」ではない。**`D-725` により「初回公開より前は存在しない」＝「**まだ一度も変わっていない**」という**既知**の状態 |
| `move_id` が NULL のステップ | 判定に入らない | `JOIN moves` で構造的に落ちる（`DES-003` §3.5 の taxonomy） |
| マーカー ＝ 基準（同値） | 影響なし | 基準より**新しい**ものだけを出す |

**★★この 2 種類の NULL を混同すると、出し漏らすか（基準 NULL を影響なしに倒す）、全件が出続けるか（マーカー NULL を影響ありに倒す）のどちらかになる。⇒ `DES-003` へ明文化してほしい。**

**⇒ `REQ-001` `FR702` ／ `DES-003` §3.3・`combos` の節へ、上記の判定定義と NULL の向きを明文化してほしい。**

### §1-3 ★★マーカーの持ち場と、配信者の運用手順（`SUPP-001` ／ `character_data` の CSV 列契約へ）

**指示書 §2.2-4 は「`seedgen` が SQL へ出力する側に入れること」とだけ書いていた。製造はその形を 2 度作り、1 度目は誤りだった。**

**★誤りだった初版**: `moves` の seed 波（`-mode moves`）の生成物へマーカーの `UPDATE` を混ぜた。
値が空の間は生成物が byte-identical なので **golden 17 本は緑のまま通る**が、
**★CSV へ値を 1 つ書いた瞬間に `000026` の golden が落ちる**。しかも失敗メッセージは
「**適用済みマイグレであり上書き再生成してはならない**」であり、**直し方の無い赤**である。
**⇒ 配信者がマーカーを立てるという、この機能を使う唯一の操作が成立していなかった。**

**★同じ壁に本プロジェクトは既に一度当たっている** —— `zangief` / `dhalsim` の連打版を `character_data` に載せていないのは
「載せると生成物が変わって golden が壊れる」ためである（`internal/infra/migration/csv_db_sync_test.go` 冒頭・`D-94` / `D-99`）。
**初版の設計はその先例と正面衝突していた。レビューが実測で検出した。**

**★★是正後の形（＝確定した仕様）**:

| # | 内容 |
|---|---|
| 1 | `character_data/*.csv` の**列契約を 23 列 → 24 列**（`last_changed_game_version` を末尾へ）。全 31 ファイル |
| 2 | **`writeMovesInsert` も moves 波の生成物も 1 文字も変わらない** ⇒ **golden はマーカーの有無に関わらず永続的に安全** |
| 3 | **`cmd/seedgen -mode game-version` を新設**し、マーカーの `UPDATE` を**独立したマイグレ**として生成する（`derived-backfill` / `move-commands` と同じ流儀。新しい流儀は作っていない）。実体＝`internal/seedgen/generate_m2802a.go` |
| 4 | **★同マイグレが `games.current_data_version` を引き上げる**（`current_data_version < ?` を条件に置き、**引き下げはしない**） |

**★★4 の理由（指示書に無く、製造が確定させた）。**
**マーカーだけ立てて現在版を据え置くと、以後に登録されるコンボの基準がマーカーより古くなる。**
**★登録した瞬間に「影響可能性あり」で出る。** 利用者から見ると何もしていないのに警告が出る。**⇒ 版の引き上げを同じマイグレへ含めて、その状態を作れないようにした。**

**★配信者の運用手順（実測して全緑を確認した）**:

```
1. character_data/<char>.csv の 24 列目へ YYYY.MM.DD.NN を書く
2. go run ./cmd/seedgen -mode game-version -chars <対象> -out <連番>_mark_moves_game_version -note "..."
3. 生成された 2 ファイルを migrations/ へ置く（★連番は設計卓から払い出しを受ける）
4. go test ./...
```

**★★2 の連番は毎回払い出しが要る。⇒ SF6 のアップデートのたびにマイグレを 1 本消費する運用になる。**
**この頻度が許容できるかは設計卓・開発者の判断事項である**（`M28-overview` §3.2.8 の軸 10「開発者のアップデート対応のしやすさ」に当たる）。

**down で失われるもの**: マーカーは **NULL へ戻る。★「立てる前の値」へは戻らない**（前の値を記録していない）。
`games.current_data_version` は **down で戻さない**（戻す先を記録していない）。

**⇒ `SUPP-001` へ「CSV 列契約 24 列」と上記の運用手順を、`DES-003` へ `moves.last_changed_game_version` を明文化してほしい。**

### §1-4 始動位置の区分表と、マス数 ⇄ 区分の不変条件（`SUPP-001` §3.2 ／ `DES-003` へ）

**`position` は 5 値 → 7 値**（`mid_self`「自分中央寄り」/ `mid_opponent`「相手中央寄り」＝`D-733`）。

| 順 | code | ラベル | マス | 代表値 |
|---|---|---|---|---|
| 1 | `corner_self` | 自分画面端 | 0〜25 | 12 |
| 2 | `corner_self_near` | 自分画面端寄り | 26〜47 | 36 |
| 3 | **`mid_self`** | **自分中央寄り** | 48〜69 | 58 |
| 4 | `mid_screen` | 画面中央 | 70〜90 | 80 |
| 5 | **`mid_opponent`** | **相手中央寄り** | 91〜112 | 102 |
| 6 | `corner_opponent_near` | 相手画面端寄り | 113〜134 | 124 |
| 7 | `corner_opponent` | 相手画面端 | 135〜160 | 148 |

**★★指示書 §2.4.6-1 の「既存の 5 区分はそのまま残り、間に 2 つ挿入されるだけである」は、値域の話としては正しいが表示順の話としては誤りである。**
**表示順では末尾 2 値の順序も入れ替わる**（旧 `corner_opponent, corner_opponent_near` → 新 `corner_opponent_near, corner_opponent`）。
**⇒ 2 つを混同しないよう `SUPP-001` §3.2 へ「値域」と「表示順」を分けて書いてほしい。**

**★製造が確定させた不変条件**（指示書 §2.4.4-4 が「案を出して報告すること」としていた点）:

| 入力 | 振る舞い |
|---|---|
| マス数あり | **マス数が勝つ。**`position` を区分表から導出して上書きする |
| マス数なし・`position` あり | `position` の**代表値**をマス数へ入れる（**★既存エディタはこの経路 ⇒ 現行画面は無改修で動く**） |
| どちらも無し | 両方 NULL（不問） |

実体＝`internal/service/combo/service.go`（`normalizePositionAndMass`）。
**★★重複判定より前に呼ぶ必要がある** —— 判定は `input.Position` を直接読む箇所が 3 つあり、
正規化前に走ると「マス数から導いた区分」ではなく「送られてきた区分」で重複を見てしまう。

**★`position` は列として残した**（消していない）。理由＝重複判定キーの 1 項であり 6 か所の SQL 述語が直接比較しているため、
導出にすると重複判定のたびに `CASE` の計算が要る。**⇒ `DuplicateKey` は 1 文字も変えていない。**

### §1-5 ★★エディタの数字キー割当が動く（`DES-005` へ）

並び順の変更に伴い、**既存の値のショートカットがずれる**（`shortcutKeyForIndex` は index+1。不問を先頭に置いた 8 個）。

| 値 | 旧キー | 新キー |
|---|---|---|
| 画面中央 | **2** | **5** |
| 自分画面端 | 3 | 2 |
| 相手画面端 | 5 | **8** |

**★ボタン数は 8（不問込み）で上限 10 の内側 ⇒ ボタン群のまま**（`MAX_BUTTONIZED_OPTIONS = 10`）。
**★開発者は「問題なし」と確認済み**（2026-09-06）。**⇒ `DES-005` へ as-built として書いてほしい。**

### §1-6 CSV 列契約（`DES-002` §7.6 へ）

**末尾へ 2 列追加し任意列に登録した**（`ColOkiVerified` の先例どおり）: `start_position_mass` / `carry_distance_mass`。
**★`baseline_version` は載せない** —— DB 管理列であって利用者の入力ではない（先例＝`materialized_from_combo_id` / `superseded_by_combo_id`）。

**★載せた理由**——載せないと**出力 → 取込で値が消える**。始動位置は `position` の代表値へ丸め戻され（73 が 80 になる）、
**運び量は `position` から逆算できないため完全に失われる**。

**後方互換**: 旧 CSV（2 列なし）の取込は通る（必須列 22 は不変）。新 CSV を旧版へ食わせると unknown 列の**警告**であり取込は止まらない（2 列の値は捨てられる）。

---

## §2 契約・設計に反する独自判断（★受理／差し戻しの裁定が要る）

### §2-1 ★★本スキーマ初の `CHECK` 制約を入れた（`DES-003` §3.4 の方針に反する）

| 項目 | 内容 |
|---|---|
| **何に反したか** | `DES-003` §3.4 ／ `internal/model/combo.go:6` の「**CHECK 制約は DB 側に付けず、アプリ層で制約する方針**」。**実測: 着手前の 103 マイグレに CHECK は 0 件だった** |
| **なぜそう判断したか** | **指示書 §2.2-3-b が DB 側の `CHECK` を名指しで要求している**（「入口を全部塞ぐこと —— DB 側の `CHECK` 制約 ／ アプリ側のバリデーション ／ マイグレで投入する値そのもの」）。**★アプリ層だけでは生 SQL の `UPDATE` を塞げない** —— マーカーを立てるのは配信者であり、その経路は DML マイグレ＝生 SQL である。**★形式が崩れると辞書順が静かに壊れ、エラーにならない** |
| **実装がどうなっているか** | `migrations/000104_add_game_update_tracking.up.sql`（3 列）／ `migrations/000105_add_combos_position_mass.up.sql`（2 列）。GLOB で固定幅・全桁数字、`substr`+`CAST` で月 1〜12・日 1〜31 |
| **★実測** | `ALTER TABLE ... ADD COLUMN` のインライン `CHECK` は通り、実際に強制される。**`DROP COLUMN` も CHECK 付き列に対して通る**（`modernc.org/sqlite v1.50.0`）**⇒ テーブル再構築を伴う down は不要だった** |

**⇒ 裁定を請う。** 受理なら `DES-003` §3.4 へ**例外の条件**（「静かに壊れる形式で、かつ生 SQL の経路が在るもの」等）を書いてほしい。
**差し戻すなら、指示書 §2.2-3-b との矛盾をどちらへ倒すかの判断が要る。**

### §2-2 ★`DES-006` に採番の無い検証コード `VAL-RANGE` を導入した

| 項目 | 内容 |
|---|---|
| **何に反したか** | `DES-006` は VAL コードの正典であり、`VAL-C01`〜`C15` が採番されている。**製造は番号を自採番しない**（`D-293` と同じ理由。指示書 §2.2-3-b も「`DES-006` へ検証コードが要るなら設計卓へ請求する」としている） |
| **なぜそう判断したか** | マス数の値域（0〜160）を弾く必要があるが、**`VAL-Cxx` を自採番できない**。**★先例として `VAL-ENUM` が在る** —— `csvcore` が使う記述的コードで、`DES-006` に番号を持たない |
| **実装がどうなっているか** | `internal/service/validation/combo.go`（`CodePositionMassRange = "VAL-RANGE"` ／ `validatePositionMassRange`）／ `internal/service/comboio/csvcore/validate.go`（同じコードで CSV 層）。**ERROR ＝ 400 + `validations`** |

**⇒ 裁定を請う。** `VAL-C16` 等を採番して置き換えるか、`VAL-ENUM` と同じく記述的コードのまま許容するか。
**★`VAL-ENUM` が既に前例として存在する以上、「記述的コードは使わない」という契約は現状の実装と合っていない。**
**⇒ どちらに倒すにせよ `DES-006` へ「CSV 層／記述的コードの扱い」を 1 行書いてほしい。**

---

## §3 製造の判断

### §3-1 開発者へ確認して確定した点

| # | 論点 | 回答（2026-09-06） |
|---|---|---|
| 1 | マイグレ本数 | **`000104` + `000105` の 2 本**（`000105` の払い出しを承認。**★§2.8 のコミット割りを守るには DDL も 2 本に割るのが素直**という製造の提案に対して） |
| 2 | 初期ゲームバージョン | **`2026.08.03.01`**。逐語＝「2026.08.03 が本アプリに現在入っているキャラクターデータのスト6バージョンです。」**★`NN` は 01 スタートでよい**（2026-09-06 追加確認） |
| 3 | 運び量の値域 | **0〜160**（指示書の物差しのまま。**★製造は「側面入れ替え・引き寄せ系を負値で表す」案も出したが採られなかった** ⇒ 前方への運び量のみを表現する） |
| 4 | 一覧フィルタのラベル | **「始動位置」へ揃える**。**★指示書 §2.4.7 の逐語は「詳細・比較・エディタ」であり一覧フィルタを含まない**が、同じ画面で列見出しが「始動位置」・絞り込みが「ポジション」に割れていたため確認して揃えた。**★変えたのは表示文字列 1 つであり「一覧をやり直した」には当たらない** |

**★あわせて実装後の手動確認 5 件（実 dev DB でのマイグレ／初期版数／数字キーのずれ／英語ラベル／マーカー運用の初回）を提示し、全件「問題なし」の回答を得た。**

### §3-2 推測で進めた点

| # | 箇所 | 推測の内容と根拠 |
|---|---|---|
| 1 | **新区分の英語ラベル** | `mid_self` = `Own side of mid-screen` ／ `mid_opponent` = `Opponent side of mid-screen`。**★日本語は `D-733` の確定値だが、英語は製造の造語である**（`D-733` は英語に触れていない）。**★開発者は「問題なし」と確認済み**だが、格ゲー英語圏の慣用に寄せたいなら差し替え候補 |
| 2 | **`down` マイグレの意味論** | `000104` / `000105` とも列ごと `DROP COLUMN`。**★失われるもの**——利用者が入れた実測マス数と運び量（`position` からは代表値までしか戻らない）／ **部分消化の履歴**（再 up 時は全行が「その時点の最新」で一律に埋め直される）。**指示書 §2.1-5 は「down で何が失われるかを書くこと」としており、内容は製造が確定させた** |
| 3 | **`comboio` の CSV 値域検証を ERROR にした** | 既存の `VAL-C04` / `C05` / `C13`（範囲＝ERROR）へ揃えた。`VAL-C10`（`knockdown_advantage`）は WARNING だが、**マス数は DB の CHECK と同じ値域であり、通しても INSERT で落ちる**（そのとき行ごと失敗し利用者にどのセルが悪いか伝わらない）ため ERROR 側へ倒した |

### §3-3 リファクタリング 1 件（設計判断ではないが as-built として）

**`combos` の SELECT 句 6 か所の写しを 1 か所へまとめた**（`comboSelectSQL`）。
**★目的はリファクタではなく、安全に列を足すための前提である** —— 2 列 ＋ 判定式を 6 か所へ写すと、
**1 か所の写し忘れで `scanCombo` の Scan 順がずれ、エラーにならずに違う列を読む**（型が合ってしまう組が実在する）。

---

## §4 設計担当が未把握の残課題・申し送り

**★★以下は `followup-backlog.md` への登録候補である。製造は本表を編集しない**（`D-382`）。**設計卓が畳んでほしい。**

### §4-1 `combo-baseline-not-advanced-on-patch`（**新規登録**）

| 項目 | 内容 |
|---|---|
| **何が起きるか** | **基準の「更新時」が `PUT`（キー変更＝新規 INSERT）でしか成立していない。** `PATCH`（メタデータ更新）は基準を進めない。⇒ **「メモを直しても影響可能性は残る／区分を直すと黙って消える」という非対称**になっている |
| **根拠** | `internal/repository/combo/repository.go`（`insertComboSQL` の `COALESCE` が基準を入れる唯一の場所）／ `UpdateMetadataInput` に基準・マス数の欄が無い。指示書 §2.2-2 は「登録・**更新**時に当時の最新を書く」としている |
| **★設計判断が要る理由** | **`FR307`（自動断定しない）から見ると `PATCH` 側が正しく、`PUT` 側が「無事の自動断定」に近い。** これは `M28-overview` §3.2.6 が案 (e) を落とした理由そのものである（「編集したら確認済みになる」）。**⇒ 製造が独断で決める事項ではない** |
| **割付の候補** | **`M28-02b`**（画面が「確認した」を出す手番に、`PUT` 側の挙動と併せて決めるのが筋）。★スキーマ変更は不要 |
| **区分** | 新規登録 |

### §4-2 `duplicate-precheck-ignores-position-mass`（**新規登録**）

| 項目 | 内容 |
|---|---|
| **何が起きるか** | **事前重複チェックがマス数を知らない。** `CheckDuplicateInput` にマス数の欄が無く、正規化（`normalizePositionAndMass`）を通らない。⇒ **手編集 CSV で `position` とマス数を食い違わせた行**では、事前チェックが見る区分と保存後の区分が別になる |
| **根拠** | `internal/service/comboio/import.go`（`checkDuplicate` が `dto.Position` を正規化前に使う）／ `internal/api/combo/dto.go`（`CheckDuplicateRequest` にマス数なし）。**★`service.go` の `normalizePositionAndMass` の godoc 自身が「正規化前に走ると送られてきた区分で重複を見てしまう」と警告している経路が 1 本残っている** |
| **現時点の実害** | **限定的**。正規の経路（画面・API の `POST`/`PUT`）は正規化を通る |
| **★将来効く場面** | **`M28-02b` が 3 方式入力を出すと、リアルタイム重複警告でも同じずれが起きる** |
| **割付の候補** | **`M28-02b`**。★`POST /api/combos/check-duplicate` の契約変更を伴う（`CheckDuplicateRequest` にマス数を足して正規化を共有させる）ため、画面側と一緒に決めるのが筋 |
| **区分** | 新規登録 |

### §4-3 `csv-db-frame-cost-columns-drift`（**既存行の更新**）

| 項目 | 内容 |
|---|---|
| **更新後の状態** | **★同 followup の「残る運用＝次に『保全のみ・SQL 非投入』の列が増えたとき、同テストへ足すこと」に、本サブが 1 件応えた。** ただし**本列は性質が逆である**——`last_changed_game_version` は **SQL へ投入する**列であり、`-mode game-version` の成果物が CSV の値をそのまま DB へ入れる |
| **根拠** | `internal/infra/migration/csv_db_sync_test.go`（`TestCSVAndDBAgreeOnFrameCostColumns` へ 24 列目の突合を追加。2743 行） |
| **★足した理由** | 投入する列でも**既存行の経路は別**である —— 既に投入済みの 3026 行にマーカーを立てるのは DML マイグレであり、**そのとき CSV を直し忘れると「DB だけが進む」形になる**。それは先例 3 列で実際に起きた |
| **区分** | 既存行の更新（**★「保全のみ」だけでなく「投入する列」も対象になりうる**旨を追記してほしい） |

### §4-4 `csv-import-position-whitelist-stale`（**新規登録・★既に解消済み**）

| 項目 | 内容 |
|---|---|
| **何が起きていたか** | **`csvcore.DefaultPositions` が着手前 4 値で `corner_self_near` を欠いていた**（本体の値域は 5 値）。⇒ その値のコンボを CSV で往復させると `VAL-ENUM` の未知値警告が出る |
| **★なぜ気づけなかったか** | **`hit_type` と `opponent_size` には同期テストが在り、`position` だけ無かった。** `scripts/check-enum-sync.sh` も `Position*` を構造的に見ない（抽出パターンが接尾辞 `Category`/`Status`/`Type`/`Code` にしか一致しない＝`check-enum-sync-misses-size-suffix` と同じ穴） |
| **根拠** | `internal/service/comboio/csvcore/rules.go`（`DefaultPositions`）／ `enum_sync_test.go`（`TestDefaultPositionsMatchesModel` を新設） |
| **★解消済み** | `model.PositionValuesInDisplayOrder()` を参照する形へ変え、同期テストを足した |
| **★型** | **`csv-column-contract-unobserved-in-pr` / `gofmt-not-in-pr-checks` / `import-order-unchecked` / `check-enum-sync-misses-size-suffix` と同じ型の 5 例目**（守るべきものはあるが観測が無い） |
| **区分** | 新規登録（**解消済みとして**。★「同じ型の 5 例目」であることを記録に残す価値がある） |

### §4-5 `position-label-ja-outside-label-key-check`（**新規登録・★既に解消済み**）

| 項目 | 内容 |
|---|---|
| **何が起きていたか** | **`web/src/features/combo/labels.ts` の `POSITION_LABEL_JA` だけが `ja.json` 由来でない直書き**であり、`label-keys.test.ts` の `derived` 検査の外に在った（`HIT_TYPE_LABEL_JA` / `OPPONENT_SIZE_LABEL_JA` は守られていた）。⇒ 語が 2 か所にある状態（教訓 `E-76`）が position だけ残っていた |
| **根拠** | `web/src/constants/label-keys.test.ts`（`derived` 表へ登録 ＋ `POSITION_OPTIONS` の並び一致検査を新設） |
| **★併せて解消** | `POSITION_OPTIONS`（エディタ）が独立した写しで、**一覧フィルタとエディタで並び順が別々に定義されていた**。⇒ `POSITION_VALUES` から導出する形へ |
| **区分** | 新規登録（解消済みとして） |

### §4-6 ★区分表が Go と TS に二重に直書きされている（**登録は任意**）

`internal/model/position.go`（`PositionBands`）と `web/src/constants/position.ts`（`POSITION_BANDS`）。
**値の集合**は `check-enum-sync.sh` / `TestDefaultPositionsMatchesModel` が見るが、
**境界（`48〜69` 等）と代表値（`58` 等）は両側とも自前のテストで固定しているだけ**であり、片側の変更がもう片側へ波及しない。
**7 行しかないので実害は小さいが、`M28-02b` が FE 側で導出を使い始めると効いてくる。**
**⇒ 登録するかは設計卓の判断。★製造は両側が同じ確定値（`D-731` / `D-733`）を名指しで固定する形にしてある。**

---

## §5 参考（触れていない＝不変の証跡）

- `DuplicateKey` は不変: `internal/service/combo/duplicate_keys.go` / `duplicateKeyPredicates` に差分なし
- `combos.position` の既存値は 1 行も書き換えていない: `TestRun_M2802a_PositionMassSchema` が移行前後の分布 8 種を突合
- `recipe_hash` 非波及: 新 5 列は `CalcRecipeHash` の材料に入っていない
- 影響コンボを保存する表は無い: `migrations/000104` / `000105` に `CREATE TABLE` なし
- `moves` の seed 波の生成物は不変: golden 17 本が緑（**★マーカーに値が在る状態でも**）
- CSV 必須列 22 は不変: `column_contract_test.go`（任意列のみ 12 → 14）
- 画面の作りは変えていない: 変更は表示文字列と並び順の定数のみ（3 入力方式の UI は未実装）
- 一覧の 3 列（`M27-03` / `CHANGE-155`）は未着手: `ComboTable.tsx` / `ComboTableRow.tsx` に差分なし
- `docs/design/` / `followup-backlog.md` は未編集

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**番号は起票時に `change-number-registry` で採番。★製造は消費していない。**
**マイグレは `000104` / `000105` の 2 本を消費した（着手承認の手番で開発者が払い出した。`ls migrations/` を実査して末尾 `000103` を確認済み）。⇒ 次に払い出す番号は `000106`。**
**★ボード §2.2 と `change-number-registry` §1 の「次に払い出す番号」の更新が要る（現在 `000104` のまま）。**

| # | 宛先 | 反映内容 |
|---|---|---|
| 1 | **`DES-003`** | 新列 5 本（`moves.last_changed_game_version` / `combos.baseline_version` / `games.current_data_version` / `combos.start_position_mass` / `combos.carry_distance_mass`）／ §3.4 の「dup・`recipe_hash` の非対象」へ新 5 列を追加 ／ **★§1-2 の判定定義と NULL の向き** ／ **★§2-1 の `CHECK` 方針の例外**（裁定後） |
| 2 | **`SUPP-001` §3.2** | `position` を 5 値 → 7 値（`mid_self` / `mid_opponent`）。**★「値域」と「表示順」を分けて書くこと**（§1-4） ／ **★`character_data` の CSV 列契約 23 列 → 24 列と、配信者の運用手順**（§1-3） |
| 3 | **`DES-002` §4.2** | **★§1-1 の API 契約**（`POST /api/combos/:id/acknowledge-version` の全行 ／ 一覧フィルタ `affected_by_game_update`） |
| 4 | **`DES-002` §7.6** | CSV 列契約へ 2 列追加（任意列）。`baseline_version` を載せない旨と理由（§1-6） |
| 5 | **`DES-006`** | `DuplicateKey` は**不変**である旨（`position` を使い続け、マス数は入れない）／ **★§2-2 の `VAL-RANGE` の裁定**（採番するか記述的コードを許容するか） |
| 6 | **`DES-005`** | 詳細・エディタ・一覧フィルタのラベル「ポジション」→「**始動位置**」／ 区分の表示順 ／ **★§1-5 の数字キー割当のずれ** ／ **★比較画面には対象の文字列が存在しない**旨（`CompareTable` は軸名なしのタグ・行見出しは「状況」） |
| 7 | **`REQ-001` `FR702`** | §1-2 の判定定義 ／ 「確認した」操作 ／ **★「影響可能性」であって破綻の断定ではない**（`FR307` 整合）ことの as-built |
| 8 | **`M28-overview` §3.6** | 「パーセンテージで持つ」の改訂（`D-731` で承認済み。**★製造は請求するだけ**） |

---

## §7 教訓（`retrospective-log` 行き）

> **★親（設計卓）は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映であり、**実施者は設計担当**（反映担当は 2026-08-11 に廃止）。

1. **★★「機能を無効にした状態で緑」は「機能が動く」の証明にならない。**
   本サブは初版で「マーカーの値が空のとき golden が緑」を確認して完了報告に「golden 17 本は緑のまま」と書いた。
   **値を 1 つ入れた瞬間に落ちる状態だったが、それを試していなかった。**
   **⇒ 一般形＝新しい列・新しい経路のテストは、値が在る状態で書くこと。**
   **★「空のときに何も起きない」を確認するテストは、まさに事故が起きる状況を素通しする。**

2. **★★生成物を byte 比較する検査（golden）が在るとき、生成元へ列を足すのは「足す」ではなく「壊す」である。**
   `assertGolden` は「現在の CSV から再生成した SQL」と「適用済みマイグレ」を比較する。
   ⇒ **生成元に列が増えれば、その列を出力に混ぜた瞬間に過去の全 golden が落ちる。**
   しかも失敗メッセージは「再生成してはならない」であり**直し方が無い**。
   **★先例は在った** —— `zangief` / `dhalsim` の連打版を CSV に載せていないのは同じ理由である（`D-94` / `D-99`）。
   **⇒ 一般形＝`seedgen` に新しい出力を足すときは、既存 golden の対象範囲を先に数えること。**
   **★解き方は「別モードの成果物として独立させる」**（`derived-backfill` / `move-commands` が既にその形だった）。

3. **★★「N 側だけ上げる」変更は、対になる値を同じ手番で上げないと静かに壊れる。**
   マーカー（`moves`）だけ立てて現在版（`games`）を据え置くと、
   **以後に登録されるコンボが「登録した瞬間に影響可能性あり」で出る。**
   **⇒ 一般形＝「基準」と「基準と比較される値」は、片方だけ動かせる形にしない。**
   **★副作用として、版数を固定値で書いたテストが壊れる**（実測: マイグレを 1 本足しただけで `TestAcknowledgeGameVersion` が落ちた）。
   **⇒ 可変の基準に依存するテストは「現在値より確実に大きい値」を使うこと。**

4. **★「2 種類の NULL」を区別できる語彙を持つこと。**
   本サブには **「不明（基準が NULL）」と「既知の未変更（マーカーが NULL）」**が同居しており、
   **向きが逆である**（前者は安全側＝出す／後者は出さない）。
   **⇒ 混同すると、出し漏らすか全件が出続けるかのどちらかになる。**
   **★どちらも `NULL` という同じ値で表されるため、型では区別できない。コメントとテストでしか守れない。**

5. **★同じ列並びの写しが N 箇所に在るとき、列を足す前にまとめること。**
   `combos` の SELECT 句は 6 か所に byte-identical な写しとして置かれていた。
   **1 か所の写し忘れで `scanCombo` の Scan 順がずれ、★エラーにならずに違う列を読む**（型が合ってしまう組が実在する）。
   **⇒ 「足すために、まず 1 か所へまとめる」はリファクタではなく前提である。**

6. **★完了報告に「✔」を書く前に、その検査を実際に回すこと。**
   §12-9 に「`progress-log.md` へ追記されている ✔」と書いたが、その時点で未実施だった
   （`implement_plan_full` の Phase D は Phase C の後であり、**未実施であること自体は正しい**）。
   **★これは `D-510` と同型を、同じ報告の別の欄でやっていた形である。**
   **⇒ 一般形＝完了条件の表は「観測した結果」だけを埋め、工程順で未到達のものは「Phase X で実施」と書く。**

7. **★「間に N 個挿入するだけ」は値域の話であって表示順の話ではない。**
   指示書 §2.4.6-1 は「既存の 5 区分はそのまま残り、間に 2 つ挿入されるだけである」と書いていたが、
   **表示順では末尾 2 値の順序も入れ替わっていた。**
   **⇒ 一般形＝列挙値を増やす変更では「値域」と「表示順」を別々に数えること。**
   **★副作用としてエディタの数字キー割当が動く**（index ベースのショートカットを持つ画面では、順序変更が操作の変更になる）。
