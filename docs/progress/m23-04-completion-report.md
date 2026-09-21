# M23-04 完了報告: 復元時のバリデーション(落とさずに戻して警告する)

| 項目 | 内容 |
|------|------|
| 作業 ID | M23-04 |
| 対象指示書 | `docs/instructions/M23-04-restore-validation.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M23-04-review-checklist.md` v1.0.0 |
| 実施日 | 2026-08-22 |
| ブランチ | `claude/m23-04-implementation-plan-5owzyd` |
| 消費マイグレーション | **0 本**(§4.6 のとおりスキーマ不変) |
| 消費 CHANGE 番号 | **0 件**(反映は設計卓が `CHANGE-124` で行う＝§7.4) |

---

## 1. §3.3 実査 7 件の結果(走査コマンドと件数付き)

**★E-125 に従い、終了コードだけを根拠にしていない。** 各行に走査コマンドと件数を添える。

### 1-1. 成功応答に `warnings` を載せる実装が既に在るか

```
$ grep -rn 'warnings' --include=*.go internal/ | grep -v _test
internal/api/comboio/dto.go:26   Warnings []string `json:"warnings"`
internal/api/comboio/dto.go:37   Warnings []string `json:"warnings"`
internal/api/comboio/dto.go:74,86  (orEmpty で常に空配列化)
internal/api/move/dto.go:31      Warnings []movewarning.WarningCode `json:"warnings"`
internal/api/move/handler.go:65,70
internal/service/comboio/types.go:69,81 / import.go:47,69,101,110
internal/service/comboio/csvcore/csvimport.go:84 / validate.go:291  (FileWarnings)
internal/service/validation/result.go:83  (ValidationResult.Warnings() メソッド)
```

**結果＝★変更系の成功応答に `warnings` を載せる実装は無い。** 実装ファイル 6 件・定義 5 個がヒットしたが、その全部が**取得・プレビュー系**である。

| 既存 | どこ | 形 | 変更系か |
|---|---|---|---|
| CSV 取込プレビュー | `api/comboio/dto.go` | `[]string`(常に空配列化＝`orEmpty`) | ✗ プレビュー |
| 技一覧 | `api/move/dto.go` | `[]movewarning.WarningCode` | ✗ 取得 |
| `ValidationResult.Warnings()` | `service/validation/result.go` | メソッド。フィールドではない | — |

**変更系の応答が持っているのは `validations`(`*ValidationResult`)であり、これは `400 validation_failed` の `details.validations` と対になる「登録・更新時の検証結果」である。**

**⇒ 指示書 §4.3 の形で新設した。** **★後続サブ・`M23-05` はこの形に載る**(§7.5-1 が依存を明示しているため以下に逐語で置く)。

```jsonc
// POST /api/combos/{id}/restore と POST /api/setups/{id}/restore の 200 応答
{
  "id": 42,
  "...": "(復元後に取得し直した表現。既存のまま)",
  "warnings": [
    {
      "code": "VAL-R01",
      "severity": "warning",
      "message": "紐付いているセットプレイ 1 件がゴミ箱にあります。復元してもコンボ詳細には表示されません",
      "details": { "setups": [ { "id": 7, "name": "起き攻めA" } ] }
    }
  ]
}
```

- **キーは camelCase**(`CLAUDE.md` §4)。
- **警告 0 件のときは `warnings` キー自体が出ない**(`omitempty` ＋ ハンドラ側で「0 件なら代入しない」の二重)。**空配列は返らない。**
- **`details` は `M23-02` の `409 setup_in_use`(`details.combos` に `[]ComboRef`)へ揃えてある**(**D-417**＝新しい見せ方を作らない)。`VAL-R01` は `details.setups`(`[]SetupRef`)、`VAL-R02` は `details.combos`(`[]ComboRef`)。
- **`severity` を残してある。** `VAL-C08` / `VAL-S03` / `VAL-R01` / `VAL-R02` はいずれも WARNING だが、**§4.1 は ERROR 種別も復元を止めず警告として返すと定めており**、種別を落とすとその区別が応答から消える。

### 1-2. `VAL-C08` / `VAL-S03` / `VAL-D01` の実装の在否と形

```
$ grep -rn "VAL-C08" --include=*.go internal/ | wc -l   → 6
$ grep -rn "VAL-S03" --include=*.go internal/ | wc -l   → 9
$ grep -rn "VAL-D01" --include=*.go internal/ | wc -l   → 1   ← コメント 1 行のみ
```

| コード | 実装 | 形 | 本サブでの扱い |
|---|---|---|---|
| **`VAL-C08`** | `internal/service/validation/combo.go:261` | **関数として切り出し済み**(`validateC08MoveExists`、unexported) | **export 用の入口 `ValidateMoveExistence` を足した。判定内容は変えていない** |
| **`VAL-S03`** | `internal/service/setup/validate.go:75` と `:120` | **★インラインで 2 か所に重複**(`ValidateSetupCreate` / `ValidateSetupUpdate`) | **`validateS03MoveExists` へ 1 本化し、`ValidateSetupMoveExistence` を export。判定内容は変えていない**(§3.3-2 が求めた「切り出しの範囲を計画に書く」を Plan Mode で提示済み) |
| **`VAL-D01`** | **★実装が存在しない**(ヒットは `combo.go:4` の doc コメント 1 行のみ) | — | **走らせていない。下記参照** |

**★`VAL-D01` は報告事項である。** 指示書 §1.3 の表は「`character_id` が存在するキャラクターか＝`VAL-D01`・ERROR」を既存コードとして挙げているが、**実装上その役割は `VAL-C01`(コンボ)と `VAL-S01`(セットプレイ)が担っており、`VAL-D01` という識別子のコードは 1 行も無い。**

**本サブでは新設していない。** 理由は §4.5-2 と同じである——**`characters` はアプリの操作で消えない**(下記 1-4 の実査)。**起こりえないことに対する検証を書かない**(**E-117** の型)。**⇒ 指示書 §1.5-2 が名指しした `VAL-C08` / `VAL-S03` の 2 件だけを走らせた**(DoD §7.1-2 もこの 2 件のみを要求している)。

**★2026-08-22 追記・決着＝設計卓の対応は不要。** その後 `DES-006` を実査した。**§2.2 の `VAL-D01`〜`D03` は仮登録(`is_draft = true`)向けの緩和ルールの記述であり、独立実装を持つ前提ではない。** **同節は `VAL-D03` について既に「独立した実装関数・定数を持たない／`VAL-Cxx` の nil スキップに畳み込まれた挙動」と明記している**(`CHANGE-060` ／ `M16-01`)。**`VAL-D01` も同型で、実体は `VAL-C01`(draft でもスキップされない)である。** **⇒ 指示書 §1.3 の表と実装は食い違っていない。** 設計伝達レポート §4-4 で閉じた。

### 1-3. `superseded_by_combo_id` を持つ旧行がゴミ箱の一覧に出るか

```
$ grep -n "superseded_by_combo_id" internal/repository/combo/repository.go
716:  whereParts = append(whereParts, "deleted_at IS NOT NULL", "superseded_by_combo_id IS NULL")
```

**結果＝★出ない。設計卓の見立てどおり。** `OnlyDeleted` の分岐が `superseded_by_combo_id IS NULL` を無条件に足しており、切り替えの導線も無い(`M23-01` §4.3-2)。**⇒ 一括復元でも選べない。§4.5-3 の裁定(検証を作らない)の根拠 1 は健在であり、falsifier は発火しなかった。**

### 1-4. `characters` / `moves` の行がアプリの操作で削除・改名されうるか

```
$ grep -rn "DELETE FROM moves\|DELETE FROM characters" --include=*.go internal/ cmd/
internal/seedgen/generate.go:306   ← seed SQL を生成するツール。生成された文字列であり実行時経路ではない
$ grep -rn "g.DELETE\|DELETE(" --include=routes.go internal/api/ | wc -l  → 12
   (preset / combo×3 / tag / setup×4 / punish×4。★キャラ・技の DELETE ルートは 0 件)
```

**結果＝★アプリ操作での削除経路は無い。設計卓の見立てどおり。** **⇒ §4.5-2 の裁定は変わらない。** 公式データ取り込みツールはフェーズ2 の別ツールであり本体に無い(`DES-006` §9)。

### 1-5. コンボが紐付けているセットプレイを、削除済みも含めて取れる経路

```
$ grep -n "deleted_at IS NULL" internal/repository/setup/repository.go | grep -n "s\."
684:  WHERE cs.combo_id = ? AND s.deleted_at IS NULL      (ListSetupsByComboID)
726:  WHERE cs.combo_id IN (...) AND s.deleted_at IS NULL (ListSetupsByComboIDs)
削除済みを含む側 → 0 件
```

**結果＝★無かった。リポジトリ層へ 1 本追加した。**

- `internal/repository/setup/restore.go`: **`FindDeletedSetupRefsByComboID(ctx, tx, comboID) ([]model.SetupRef, error)`**
- **★表示用と統合していない。** 表示は「いま見えているものだけ」、こちらは「**見えなくなっているものだけ**」であり、求める集合が正反対である(`M23-03` §4.5 が `FindComboIDsBySetupID` を 2 本に割った理由と同型)。

### 1-6. セットプレイが紐付いている親コンボの一覧を取れる経路(2 本のどちらか)

```
$ grep -n "ComboIDsBySetupID" internal/repository/setup/repository.go
391:  FindLiveComboIDsBySetupID          → JOIN combos c ... AND c.deleted_at IS NULL   ← 表示用
423:  FindComboIDsBySetupIDAllowDeleted  → SELECT combo_id FROM combo_setups (述語なし)  ← 検証用
```

**結果＝★`VAL-R02` が使うのは `FindComboIDsBySetupIDAllowDeleted`(削除済みを含む側)である。**

**判定は 2 本を両方引いて行う** ——母集団を AllowDeleted 側、生存件数を Live 側から取り、**「母集団 > 0 かつ 生存 == 0」で発火**させる。**Live 側だけを見ると、親が全部削除済みのとき母集団まで 0 件になり、警告が永久に出なくなる**(静かに壊れる形)。

**★破壊確認を実施した**(§4 に記録)。

### 1-7. 復元が張っているトランザクションの範囲

```
$ sed -n '789,812p' internal/service/combo/service.go     (M23-04 前)
$ sed -n '53,81p'   internal/service/setup/restore.go     (M23-04 前)
  → いずれも BeginTx → repo.Restore → Recompute*Cache → Commit
```

**結果＝★軸 D の逐語どおり。見立てどおり。** **⇒ 検証は `Commit` の直前・Tx の内側に置いた**(§4.2)。読み取りも Tx へ入れるため、tx 版のリポジトリ関数を 3 本追加した(`FindByIDAllowDeletedTx` / `FindLiveComboIDsBySetupIDTx` / `FindComboIDsBySetupIDAllowDeletedTx`)。

---

## 2. §4.8 否定形確認 —— **4 件それぞれについて「この理由で作らないと判断した」**

**★「4 件とも実装しなかった」ではない。** 4 件は別々の理由で、別々の性質の判断である。

| # | 検証 | 判断 | 根拠 |
|---|---|---|---|
| **1** | `recipe_cache` が現在の表記規則と食い違う | **作らないと判断した。既に解決済みだからである** | 復元は `RecomputeComboCache` / `RecomputeSetupCache` を呼んでおり、**復元した時点で現在のプリセット・エイリアスで作り直されている**(`M23-RESEARCH-01` D-1)。**⇒ 食い違いは発生しえない。** `architecture-patterns` §11 の**段 4**(どちらでも実挙動が変わらない) |
| **2** | 技・キャラの改名・削除 | **作らないと判断した。起こりえないからである** | **§3.3-4 で実査した**——`moves` / `characters` を削除する経路は本番コードに 0 件(唯一のヒットは seed SQL 生成ツール)。**起こりえないことに対する検証を書かない**(**E-117**)。**★ただし `VAL-C08` / `VAL-S03` は走らせている。理由が違う**——「削除中に消えた」ではなく「**検証の緩かった経路(CSV 取込・API 直叩き)で登録時から不整合だった行**」に気づくためである(§4.5-2) |
| **3** | `superseded_by_combo_id` を持つ旧行の復元 | **作らないと判断した。到達せず、壊れる不変条件も無いからである** | 根拠 2 つとも実査で健在。(a) **旧行はゴミ箱の一覧に出ない**(§3.3-3 実査＝`repository.go:716`)。一括復元でも選べない。(b) **仮に API を直接叩いて復元しても壊れる不変条件が無い**——`PUT` は重複判定キーを変える操作であり、旧行と新行のキーは通常異なる。**⇒ `DES-002` §4.2 の持ち越し 1 件は「`M23-04` で判断し、作らないと決めた」として閉じる**(設計卓が `CHANGE-124` で反映) |
| **4** | タグの紐付けが消えている | **作れないと結論した。検出する情報がどこにも残っていないからである** | `combo_tags` は `ON DELETE CASCADE` であり、**タグを削除した時点で行が消えている。** 復元の時点で「そこに何が紐付いていたか」を知る手段が無い。**検出には消える前の記録＝監査ログが要り、それは `FR013` の凍結対象である**(`M23-overview` §4.1)。**★「検討していない」のではなく「検討して、作れないと結論した」** |

---

## 3. `DES-006` へ載せる `VAL-R` の最終形(**★設計卓が逐語で写す。`CHANGE-124` の反映がこれ待ち**)

### 3.1 新設コード 2 件

| ID | 検証内容 | 種類 | 適用経路 | 発火条件(as-built) |
|---|---|---|---|---|
| **`VAL-R01`** | 復元するコンボが紐付けているセットプレイに、論理削除されたものが含まれる | **WARNING** | `POST /api/combos/{id}/restore` | **削除済みのものが 1 件でも含まれる**とき |
| **`VAL-R02`** | 復元するセットプレイが紐付いている親コンボが、すべて論理削除されている | **WARNING** | `POST /api/setups/{id}/restore` | **親が 1 件以上あり、かつそのすべてが削除済み**のとき。**★親が 0 件のときは発火しない** |

**★`VAL-R01` と `VAL-R02` の発火条件が非対称であることは意図である。揃えないこと**(**D-494**＝揃えること自体が無償ではない)。

- **`VAL-R01` が「1 件でも」なのは、コンボ詳細のセットプレイ欄が期待より少なく見えるためである。**
- **`VAL-R02` が「すべて」なのは、セットプレイが親コンボ経由でしか画面に出ないためである**(`VAL-S05`＝親に紐付かない単独作成は禁止)。生きた親が 1 つでも残っていればそこから見える。0 個のときだけ「戻したのにどこにも出ない」になる。

**★`VAL-R02` が「親 0 件では発火しない」のは as-built の追加確定事項である**(指示書は明記していない)。**0 件は「全部削除済み」ではなく「紐付けが既に失われている」状態であり**(`M23-02` §4.2-6＝同サブ適用前に論理削除されたセットプレイ)、**別の話である。** 0 件で発火させると、集合が空のときに真になる述語ができ、該当する行が復元のたびに警告を浴びる。

**★`details` の形**（取り込み工程で `VAL-R02` を広げた。レビュー中-3）。**`VAL-R01` は `details.setups: []SetupRef{id, name}`、`VAL-R02` は `details.combos: []ComboRef{id, memo}`。** 2 つとも「どれが問題か」を id ＋ 人が読める文字列で返す形であり、**発火条件の非対称（意図的・§4.7）と違って、details の形に非対称は無い。**

**★`VAL-R03` 以降は未採番のままである**(欠番にしていない)。**§3.3 の実査で `VAL-R01` / `VAL-R02` はどちらも成立したため、載せずに残す番号は無い。**

### 3.2 復元経路の適用一覧(既存コードの再利用を含む)

| 経路 | 走る検証 | 種類 |
|---|---|---|
| `POST /api/combos/{id}/restore` | **`VAL-C08`**(既存・再利用) ／ **`VAL-R01`**(新設) | WARNING / WARNING |
| `POST /api/setups/{id}/restore` | **`VAL-S03`**(既存・再利用) ／ **`VAL-R02`**(新設) | WARNING / WARNING |

### 3.3 ★`DES-006` §1.1 に対する明示的な例外(**必ず書くこと**)

> **復元経路のバリデーションは、種類が ERROR のものも含めて復元を中止させない。**
>
> これは `DES-006` §1.1 の「**例外はブロッキング**」に対する明示的な例外である(`M23-overview` §4.1 / **D-463**)——**落とすと利用者は取り返す手段を失い、ゴミ箱が安全網でなくなる。**
>
> **★これを書かないと、後から「ERROR なのに止めていない」を不具合として直されうる。**

**実装側にも同じ注記を置いてある**(`internal/service/validation/restore.go` の冒頭 ／ `combo.Restore` ／ `setup.Restore` の godoc)。

**★「復元そのものが成立しない」ケースは従来どおり `404` である**(削除済みでない行の復元)。これは検証ではなく前提条件であり、本サブは触っていない(`repo.Restore` の `WHERE deleted_at IS NOT NULL`)。

### 3.4 検証処理自体が失敗したときの扱い(§4.2 末尾)

**復元は成功させ、`500` を返さず、警告は空として扱う。ログには `slog.ErrorContext` で残す。**
理由＝**検証は付加価値であり、それが壊れたことで復元という利用者の主目的を巻き添えにしない。**

---

## 4. 契約違反の独自判断 —— **0 件**

**★指示書 §9.2 の「推測で進めてよい事項」の範囲を超えた判断は 1 件も無い。**

以下は §9.2 が明示的に製造判断へ委ねている範囲内であり、契約違反ではない。**記録のため列挙する。**

| # | 判断 | §9.2 のどれか | 内容 |
|---|---|---|---|
| 1 | `warnings` の要素の内部構造 | §9.2-1 | `ValidationIssue` を再利用し `Details map[string]any` を `omitempty` で足した。**`M23-02` の `details.combos` の形に寄せることは守っている。★既存の `400 validation_failed` + `details.validations` の応答形は変わらない**(復元経路以外では nil のまま消える) |
| 2 | 警告文言の日本語・英語 | §9.2-2(`DES-006` §12 が協同決定としている項目) | `trash.warning.*` として ja/en へ追加 |
| 3 | 検証を切り出す関数の置き場・粒度 | §9.2-3 | `validation.ValidateMoveExistence` ／ `setup.ValidateSetupMoveExistence` ／ `validation/restore.go` 新設 |
| 4 | テストのデータ組み立て | §9.2-4 | 直 SQL で「登録時から不整合だった行」を再現する等 |

### 4.1 ★推測で進めた点(コード内コメントにも明示済み)

| # | 推測 | 仮定した内容と理由 |
|---|---|---|
| 1 | **`message` の扱い** | **サーバは日本語の診断文を持たせ、画面はそれを表示せず `code` から翻訳キーで組み立てる**と仮定した。§4.3-4 は「既存の形に揃える／見つからなければコードとパラメータを返しフロントで組む」としており、**§3.3-1 で既存の形が見つからなかったため後者を採った**(`M17-05a` の「VAL エラーは FE 表示層で日本語化」＝`DES-006` §6 の先例)。**サーバ側に文言を残したのは、既存 VAL 全件が `Message` を持っており、そこだけ空にすると API 単体で叩いたときに何の警告か分からなくなるためである。** 画面がそれを使っていないことはフロントテストが主張している |
| 2 | **`SetupRef{id, name}`** | `M23-02` の `ComboRef{id, memo}` に対応する形。**`setups` は `name` 列を持つため、`ComboRef` が memo を名前に読み替えたような操作は要らない** |
| 3 | **`VAL-R02` の「親 0 件では発火しない」** | 上記 §3.1 の理由による。指示書は明記していないが、**§5.1-3 が `VAL-R01` について同じ趣旨(0 件と全部削除済みを取り違えない)を明示しており、対称の扱いを採った** |

### 4.2 ★破壊確認の実測(§5.1-8 が本当に効いているか)

**「テストが在る」は「テストが効く」ではない**(**E-125** と同じ趣旨)。**§5.1-8 が検出したい取り違えを実際に注入して赤になることを確かめた。**

```
$ sed -i 's/FindComboIDsBySetupIDAllowDeletedTx/FindLiveComboIDsBySetupIDTx/' internal/service/setup/restore.go
$ go test ./internal/service/setup/ -run 'TestRestoreSetup_VALR02' -count=1
--- FAIL: TestRestoreSetup_VALR02_FiresWhenAllParentCombosDeleted (0.49s)
--- FAIL: TestRestoreSetup_VALR02_UsesAllowDeletedPopulation (0.96s)
    --- FAIL: .../親が全部削除済み(AllowDeleted_側でないと母集団が_0_になる) (0.47s)
FAIL
$ (差し替えを元に戻す)
$ go test ./internal/service/setup/ -run 'TestRestoreSetup_VALR02' -count=1
ok
```

**⇒ 静かに壊れる形が、実際にテストで落ちる。**

---

## 5. `docs/handover/followup-backlog.md` §J へ書いた項目 —— **1 件も無い**

**★停止規律に該当する事態が発生しなかった。** **再レビュー往復は 0 回**(初回レビューで重大 0 件・「高」1 件も採用したため、再レビューを要する未解消項目が残らなかった)。**⇒ §J は編集していない**(§J 以外の節も編集していない＝**D-382**)。

**レビュー結果と採否の全件は `docs/progress/m23-04-review.md` の「取り込み結果(自動トリアージ)」節が正本である。** 実測＝**重大 0 件 / 高 1 件 / 中 3 件 / 低 8 件**。採否＝**高 1/1 採用・中 3/3 採用・低 5/8 採用**(不採用 3 件＝低-5 は `M23-06` の担当でスコープ外 ／ 低-6 は本サブが持ち込んだ形でなく §2.3 の例外条項 ／ 低-12 は既存の非 Tx 版と形を揃えてある)。**★「高」指摘の不採用は 0 件**であり、開発者エスカレーションは発火していない。

---

## 6. 成果物一覧

### 6.1 バックエンド

| ファイル | 変更 |
|---|---|
| `internal/model/setup.go` | `SetupRef{ID, Name}` を追加 |
| `internal/service/validation/result.go` | `ValidationIssue.Details`(omitempty) ／ `AddWarningWithDetails` |
| `internal/service/validation/restore.go` | **新設。** `VAL-R01` / `VAL-R02` の定数と判定 |
| `internal/service/validation/combo.go` | `ValidateMoveExistence`(`VAL-C08` の単独実行口)を export |
| `internal/service/setup/validate.go` | `VAL-S03` のインライン重複 2 か所を `validateS03MoveExists` へ 1 本化 ／ `ValidateSetupMoveExistence` を export |
| `internal/repository/combo/repository.go` | `FindByIDAllowDeletedTx` |
| `internal/repository/setup/repository.go` | `FindLiveComboIDsBySetupIDTx` / `FindComboIDsBySetupIDAllowDeletedTx`(既存 2 本を runner 化して共用) |
| `internal/repository/setup/restore.go` | `FindDeletedSetupRefsByComboID` |
| `internal/service/combo/service.go` | `Restore` の戻り値を `(ValidationResult, error)` へ ／ `validateRestoredCombo` |
| `internal/service/setup/service.go` / `restore.go` | 同上 ／ `validateRestoredSetup` ／ `FindDeletedSetupRefsByComboIDInTx` |
| `internal/api/combo/dto.go` / `handler.go` | `ComboResponse.Warnings`(omitempty) ／ 復元ハンドラで設定 |
| `internal/api/setup/dto.go` / `restore_handler.go` | 同上 |

### 6.2 フロントエンド

| ファイル | 変更 |
|---|---|
| `web/src/features/trash/restoreWarnings.ts` | **新設。** 警告の文面組み立て(単件・一括)と VAL コード定数 |
| `web/src/features/combo/types.ts` | `ValidationIssue.details` ／ `RestoreWarningDetails` ／ `RestoreComboResponse` |
| `web/src/features/setup/types.ts` | `RestoreSetupResponse` |
| `web/src/features/combo/hooks/useRestoreCombo.ts` | 応答本文を返す形へ(従来は void) |
| `web/src/features/setup/api/setupApi.ts` / `hooks/useRestoreSetup.ts` | 戻り型を `RestoreSetupResponse` へ |
| `web/src/features/combo/components/TrashListRow.tsx` | 単件復元の警告トースト |
| `web/src/features/setup/components/TrashSetupListRow.tsx` | 同上(セットプレイ側) |
| `web/src/features/combo/components/TrashBulkActions.tsx` | **一括復元の件数を畳んで 1 枚** |
| `web/src/locales/ja.json` / `en.json` | `trash.warning.*` を 7 キー(両ロケール) |

**★`ComboSummary` / `ComboDetail` / `Combo` の 3 分岐へ `warnings` を足していない**(`web/CLAUDE.md` §2)。**バックエンドが `warnings` を設定するのは復元 2 経路だけであり、一覧・詳細・編集の応答には現れない。** 3 分岐へ足すと「常にあるフィールド」に見えてしまう。**⇒ 復元専用の `RestoreComboResponse` / `RestoreSetupResponse` を新設した。**

### 6.3 テスト

| ファイル | 件数 |
|---|---|
| `internal/service/combo/restore_validation_test.go` | 5 本(§5.1-1 / -2 / -3 / -6 / -7 ＋ `VAL-C08`) |
| `internal/service/setup/restore_validation_test.go` | 6 本 + 2 サブテスト(§5.1-4 / -5 / -6 / -7 / -8 ＋ `VAL-S03`) |
| `internal/api/combo/handler_test.go` | +2 本(§5.2) |
| `internal/api/setup/restore_handler_test.go` | +2 本(§5.2) |
| `web/src/features/trash/restoreWarnings.test.tsx` | 4 本(§5.3) |
| `web/e2e/m23-04-restore-validation.spec.ts` | **新設 3 本**(§5.4) |

**★フロントテストの `t()` は「キーをそのまま返す」モックにしていない。** 実 `ja.json` を引いて `{{var}}` を差し込む最小実装を使っている——**キー返しモックでは「サーバの日本語文をそのまま出していないこと」も「件数が畳まれたこと」も判定できず、実際に一度それで空振りした。** 副産物として**翻訳キーが `ja.json` に実在すること**も同時に守られる。

---

## 7. 自己テスト結果(§7.2・**件数付き**)

| 検査 | 結果 |
|---|---|
| `go test ./...` | **53 パッケージ ok / FAIL 0**。テスト関数 **1246 本 PASS**(`go test ./... -count=1 -v \| grep -c '^--- PASS'`) |
| `cd web && pnpm test` | **Test Files 172 passed (172) / Tests 1686 passed (1686)** |
| `make e2e` | **162 passed / 1 flaky**。flaky は `m19-03-setup-results.spec.ts` B2(本サブの差分が触れない経路。**単体で `--repeat-each=2 --retries=0` を回して 8/8 緑を確認済み**＝並列実行下のタイミング揺れ。**本サブによる回帰ではない**) |
| `gofmt -l internal/ cmd/` | **0 件** |
| `go vet ./...` | **違反なし** |
| `cd web && pnpm run lint`(＝`tsc --noEmit`) | **エラーなし** |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり(増加なし)** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**(台帳 9 件 / 本番コード 8 件。**★本サブはブラウザストレージを使っていない**) |
| `bash scripts/check-artifact-integrity.sh` | **違反なし**(検査 11 件の自己検査 ＋ 生成物 4 件) |

**★レビュー取り込み後(コミット `4e179c7` 以降)に再測した値。** 上表は取り込み前の値である。

| 検査 | 取り込み後 |
|---|---|
| `go test ./... -count=1` | **53 パッケージ ok / FAIL 0** |
| `cd web && pnpm test` | **Test Files 173 passed (173) / Tests 1697 passed (1697)**(+1 file・+11 件) |
| `make e2e` | **163 passed / flaky 0**(**`m19-03` B2 は再現せず、非回帰の判定を裏付けた**) |
| `gofmt` / `go vet` / `pnpm run lint` / `check-enum-sync` / `check-browser-storage-keys` / `check-artifact-integrity` | いずれもクリーン・違反なし |

---

## 8. 変更しなかったもの(§2.2 の確認)

- **`combos` / `setups` のスキーマ。マイグレーションは 1 本も消費していない。** `docs/process/parallel-board.md` §2.2 の連番は動かない。
- **復元の副作用**——`deleted_at = NULL` ／ `updated_at` 更新 ／ `recipe_cache` 再計算 ／ `version` に触れない ／ 子に何もしない。**検証を足しただけである。**
- **`VAL-C08` / `VAL-S03` / `VAL-C01` / `VAL-S01` の判定内容。適用先を増やしただけである。**
- **既存の `400 validation_failed` ＋ `details.validations` の形。**
- **復元 2 経路以外の応答形**(`warnings` は `omitempty` であり、他経路では nil のまま出ない)。
- **設計書本体**(`DES-006` / `DES-002` / `DES-005`)。**反映は設計卓が `CHANGE-124` で行う。**

---

## 9. 次サブへの申し送り

- **`M23-05`(削除済み行と再登録の衝突)は本サブが作った `warnings` の器の上に載る。** §1-1 の逐語がその契約である。**`ValidationResult` をそのまま返せば載る**(`Details` は任意)。
- **`M23-06` / `M23-07`(ゴミ箱画面の作り込み)へ**——**一括復元の警告は現在「件数を畳んだ 1 枚」までしか出していない**(§11-1 の暫定案)。**どの件に警告が付いたかを一覧で出す導線は作っていない。** **★材料は揃っている**——`VAL-R01` の `details.setups` は `{id, name}`、`VAL-R02` の `details.combos` は `{id, memo}` であり、**どちらも人が読める文字列を持つ**(当初 `VAL-R02` は id だけだったが、レビュー中-3 を受けて取り込み工程で広げた)。
- **`M23-06` / `M23-07` へ(2)**——**単件復元には完了トーストが無い**(警告があるときだけ出る)。一括復元は警告 0 件でも完了トーストを出すため、単件と一括で見え方が揃っていない。**`DES-006` §11.1 の「保存完了トーストと一緒に表示」を単件でも成立させるなら、ゴミ箱画面の作り込みで扱うのが自然**(レビュー低-5・不採用の理由も同じ)。
- **★設計卓・将来の硬化担当へ**——**`VAL-C08` / `VAL-S03` の `moves` 参照だけが復元 Tx の外である**(`MoveAdapter` が `*sql.DB` を直に持つ。**本サブが持ち込んだ形ではなく `CreateSetupInTx` が既に同型**)。`moves` は不変のマスタ(§1-4 の実査)なので TOCTOU の実害は無いが、**将来 `SetMaxOpenConns(1)`(SQLite でよく行われる硬化)を入れると、復元が自分の接続待ちで自己デッドロックする。** 恒久対応は `validation.Dependencies` へ tx 版の入口を持たせることであり、影響範囲が本サブを超えるため触っていない(§2.3 の例外条項)。
- **★製造 CLI(`implement_plan_full`)の工程順について**——**完了報告と `progress-log` の索引行を Phase B(レビュー)より前に commit する流れになっているため、レビュー結果を実施前に断定して書いてしまう形が構造的に起こる。** 本サブでも実際に起き、レビュー高-1 として指摘され訂正した(結果的に「不採用 0 件」は真だったが、**レビュー前に書いた断定であったこと自体が誤り**)。**同じ形は他サブでも起こりうる。恒久是正の要否は設計卓の手番。**

---

*以上、M23-04 完了報告。*
