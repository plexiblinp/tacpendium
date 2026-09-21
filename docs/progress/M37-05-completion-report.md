# M37-05 完了報告: 始動位置のマス数の不変条件（`P-60` の決着）

| 項目 | 内容 |
|------|------|
| 文書ID | M37-05-COMPLETION |
| 対象指示書 | `docs/instructions/M37-05-position-mass-null-invariant.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M37-05-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-13 |
| 着手基点 | `9a4d391` |
| ブランチ | `claude/admiring-babbage-8hdc23` |
| マイグレ消費 | **0 本**（`000112` が最新のまま。**`000113` は欠番・`000114` は `M37-04`**） |
| CHANGE 消費 | **0 本**（**自採番していない**＝`D-293`。原稿は §8） |

---

## 0. ★★★1 行で言うと

**`PATCH` 経路にだけ空いていた穴を塞いだ。**

```
start_position_mass IS NULL  ⇔  position = 不問
```

**★この不変条件は `POST` / `PUT` では着手前から成り立っていた**（両経路が `normalizePositionAndMass` を呼ぶ）。
**⇒ 本サブが作ったのは新しい規則ではなく、1 本だけ残っていた例外の解消である。**

**★★★ただし `PATCH` で閉じたのは*片方向*だけである**（Phase C でレビュー 中-1 として明示化）——
**「区分あり ⇒ マス数が入る」は本サブが守る。「マス数あり ⇒ 区分が決まっている」は守らない。**
**⇒ `position` が不問の行へ `PATCH` でマス数だけを送ると、`position` は NULL のまま値が入る。**
**★逆向きを閉じているのは (a) 画面が `positionFromMass` で区分を導出すること (b) 区分が変われば `hasKeyChanges` が `PUT` へ振り分けること —— の 2 つであり、API を直接叩く経路は射程外である**（指示書 §0.4 ／ §7-2＝別の裁定が要る）。

---

## 1. 着手前の版ゲート（指示書 §0.7・チェックリスト G-4）

| # | 確かめたこと | 実測 |
|---|---|---|
| 1 | チェックリストの存在 | `docs/instructions/reviews/M37-05-review-checklist.md` v1.0.0（8865 バイト）**在り** |
| 2 | `CHANGE-195` が `DES-002` へ反映 | `DES-002` は **1.93.0**（≥ 1.92.0）。§4.2 の `PATCH /api/combos/{id}` 行に `CHANGE-195` ブロック**在り** |
| 3 | `M37-02` / `M37-03` の着地 | 両者の完了報告・レビュー報告が `docs/progress/` に在り、`progress-log.md` にも索引行が在る。ボード §1.1 も「走行中 0 本」 |
| 4 | `ls migrations/` の最新 | **`000112_data_correct_guile_perfect_variant_codes`**（全 222 ファイル＝111 組）。ボードの「次は `000115`」「`000113` は欠番」「`000114` は `M37-04` へ払い出し済み」と整合 |
| 5 | 枝元 | `git log --oneline -1` ＝ `9a4d391 Merge pull request #218 from plexiblinp/claude/adoring-thompson-hl2142` |

**`check-import-order.sh` の着手時実測**（チェックリスト G-6・`M37-01` §7-2 の教訓）:
**99 ファイル / ベースライン 99（本番 14 ／ テスト 85）**。**★「緑だから増えていない」ではなく、着手時の実数を控えた。** 完了時の再測は §6.3。

---

## 2. 段 1 — 実査（指示書 §2.1・チェックリスト G-1 / G-2 / G-3）

### 2.1 ★★★不変条件に違反する既存行 — **0 件**（**開発者が実測**）

**★本セッション（クラウドのクリーンクローン）では測れない。**
`find . -name '*.db'` は **0 件**、`grep -l "INSERT INTO combos" migrations/*.up.sql` も **0 件**（**migrations は `combos` を 1 行も seed しない**）。
**⇒ 使い捨て DB を作っても常に 0 件であり、「利用者が実際に持っている行」にはならない**（`M37-03` §7.1 と同型）。

**★★★そこで照合 SQL を開発者へ渡し、手元の dev DB で実測してもらった**（2026-09-13）。

| 調査項目 | 件数 | 実測/算出 |
|---|---:|---|
| 母集団（全行） | **133** | **実測（開発者）** |
| 　うち有効（`deleted_at IS NULL`） | **109** | **実測（開発者）** |
| 　うち削除済み | **24** | **実測（開発者）** |
| **違反A: `position` が区分なのに `start_position_mass IS NULL`（有効）** | **0** | **実測（開発者）** |
| **違反B: `position` が不問なのにマス数あり（有効）** | **0** | **実測（開発者）** |
| 違反A（削除済み） | **0** | **実測（開発者）** |
| 違反B（削除済み） | **0** | **実測（開発者）** |
| 参考: マス数と区分の食い違い（削除済み含む） | **0** | **実測（開発者）** |
| 参考: 運び量が NULL（有効） | **109** | **実測（開発者）** |

**⇒ 埋め戻しの対象は 1 行も無い。★マイグレを消費していない**（指示書 §4.4 / チェックリスト E-1 / E-4）。
**★運び量は有効行すべてが NULL であり、これは正常な状態である**（`D-731` 不変条件 2。**埋める対象ではない**）。

**★違反Aの区分別内訳は「該当なし」である**（母数 0 のため）。

**★★これは `D-864` の記述と整合する** ——「**旧行は `000105` が `position` からバックフィルしており、レガシー由来の NULL は残っていない**」。

#### 使った照合 SQL（**開発者が手元で回せる形。★後任もここから追試できる**）

```sql
-- ★「不問」は position の NULL と空文字の両方を見る
--   (画面経由は NULL だが、CSV は空文字を書きうるため)。

-- 【違反A】position が区分なのに start_position_mass が NULL
SELECT COUNT(*) FROM combos
WHERE deleted_at IS NULL
  AND position IS NOT NULL AND position <> ''
  AND start_position_mass IS NULL;

-- 【違反B】position が不問なのに start_position_mass が値を持つ
SELECT COUNT(*) FROM combos
WHERE deleted_at IS NULL
  AND (position IS NULL OR position = '')
  AND start_position_mass IS NOT NULL;

-- 【内訳】違反Aを区分ごとに
SELECT position, COUNT(*) FROM combos
WHERE deleted_at IS NULL
  AND position IS NOT NULL AND position <> ''
  AND start_position_mass IS NULL
GROUP BY position ORDER BY COUNT(*) DESC;

-- 【削除済みも含めた版】★復元されうる行も母集団に入る
SELECT COUNT(*) FROM combos
WHERE deleted_at IS NOT NULL
  AND position IS NOT NULL AND position <> ''
  AND start_position_mass IS NULL;
SELECT COUNT(*) FROM combos
WHERE deleted_at IS NOT NULL
  AND (position IS NULL OR position = '')
  AND start_position_mass IS NOT NULL;

-- 【参考・不変条件の対象外】マス数と区分が食い違っている行
SELECT COUNT(*) FROM combos
WHERE start_position_mass IS NOT NULL
  AND position IS NOT NULL AND position <> ''
  AND position <> CASE
        WHEN start_position_mass BETWEEN   0 AND  25 THEN 'corner_self'
        WHEN start_position_mass BETWEEN  26 AND  47 THEN 'corner_self_near'
        WHEN start_position_mass BETWEEN  48 AND  69 THEN 'mid_self'
        WHEN start_position_mass BETWEEN  70 AND  90 THEN 'mid_screen'
        WHEN start_position_mass BETWEEN  91 AND 112 THEN 'mid_opponent'
        WHEN start_position_mass BETWEEN 113 AND 134 THEN 'corner_opponent_near'
        WHEN start_position_mass BETWEEN 135 AND 160 THEN 'corner_opponent'
      END;
```

### 2.2 ★「不問」の実表現 — **名前付きの定数は無い**（実測・チェックリスト G-2）

**★指示書は「不問」と日本語で書いているが、実物に対応する定数は存在しない。**

| 側 | 実物 | 出所 |
|---|---|---|
| Go | **SQL `NULL`（`*string == nil`）**。**`PositionBands` は 7 区分だけで、不問を含まない** | `internal/model/position.go:37-39` ／ `internal/model/combo.go:217`（逐語＝「NULL = 不問 / 未入力。0 は『自分画面端にぴったり』であって未入力ではない」） |
| TS | **空文字 `""` が番兵**。ラベルだけが `UNSPECIFIED_LABEL = "不問"` | `web/src/features/combo/labels.ts:32` ／ `ComboEditorBasicFields.tsx:246-250` |
| 選択肢の並べ方 | **`withUnspecifiedFirst` は `ComboEditorBasicFields.tsx:1377-1381` のモジュール private**（`constants/position.ts` には無い） | 実測 |

**★★紛らわしいもの**: `OpponentStanceAny = "any"` は**別の欄の不問**であり、本件とは無関係である（`web/src/constants/combo-list.ts:111-116` が明記）。

### 2.3 ★代表値 7 個 — **数え直した**（実測・チェックリスト G-1）

**★`M37-RESEARCH-01` §2.3 の値をそのまま転記していない。Go と TS の両方を開いて数えた。**

| # | 区分コード | 境界 | 代表値 |
|---|---|---|---:|
| 1 | `corner_self` | 0–25 | **12** |
| 2 | `corner_self_near` | 26–47 | **36** |
| 3 | `mid_self` | 48–69 | **58** |
| 4 | `mid_screen` | 70–90 | **80** |
| 5 | `mid_opponent` | 91–112 | **102** |
| 6 | `corner_opponent_near` | 113–134 | **124** |
| 7 | `corner_opponent` | 135–160 | **148** |

**出所は 2 本**: `internal/model/position.go:46-54` ／ `web/src/constants/position.ts:47-65`。
**★両者は 1 行ずつ一致した**（既知の二重化＝`position-bands-duplicated-go-and-ts`）。**⇒ 本サブは 3 本目を作っていない**（§4.3）。

### 2.4 ★★`PATCH` 経路が `position` に触れていない — **構造的に不可能**（実測・チェックリスト A-1）

**★「触っていない」より強い事実が見つかった。**

- `comborepo.UpdateMetadataInput`（`internal/repository/combo/repository.go:89-127`）に **`Position` 欄が存在しない**
- `repository.UpdateMetadata`（`:1297-1389`）の SET 句組立に **`position` という文字列が 1 回も現れない**
- `normalizePositionAndMass` は `*CreateInput` を取るため、**そもそも型が合わず `PATCH` から呼べない**

**⇒ 本サブの変更後も `position` は 1 バイトも書かれない。**

### 2.5 ★CSV の空セルが `nil` で通る — **不変**（実測・チェックリスト E-2）

`csvcore/validate.go:299-303` の `intField` が `s == "" → return nil` を返し、**issue を 1 件も立てない**。
`import.go:233` が `Create` を呼ぶため、区分が決まっていれば `normalizePositionAndMass` が代表値を入れる（**着手前と同じ**）。
**⇒ 本サブは CSV 経路に 1 バイトも触っていない**（§2.5 の否定確認は §5.5 のテストで固定した）。

---

## 3. 作ったもの

### 3.1 変更したファイルと変更統計（着手基点 `9a4d391`）

```
internal/service/combo/m37_05_position_mass_invariant_test.go          +360 -0
internal/service/combo/m37_05_representative_mass_fill_internal_test.go +151 -0
internal/service/combo/service.go                                      +79  -4
internal/service/comboio/csvcore/m37_05_empty_mass_cell_test.go        +92  -0
web/e2e/m37-05-position-mass-invariant.spec.ts                         +158 -0
web/src/features/combo/components/ComboEditorBasicFields.test.tsx      +123 -0
web/src/features/combo/components/ComboEditorBasicFields.tsx           +29  -0
web/src/features/combo/components/MassPercentInput.test.tsx            +75  -2
web/src/features/combo/components/MassPercentInput.tsx                 +23  -1
 9 files changed, 1090 insertions(+), 7 deletions(-)
```

**★★新規ファイル 5 本はすべて `-0` である**（教訓 `E-225` の観点。**deletions のある新規ファイルはそれ自体が矛盾している**）。
**★作る前に `ls` / `find` で同名の不在を確認した** ——
`internal/service/combo/` には `m37_01_position_mass_patch_test.go` しか無く、`web/e2e/` にも `m37-05-*` は無かった。

**★★★訂正（Phase C・レビュー 高-1 / 高-2）**——**初版は「既存の `m37_01_*` は 1 行も触っていない」と書いたが、これは誤りであった。**
**同ファイルの `TestUpdateMetadata_PositionMass_ClearsWithPresentNull` は本サブの変更で赤くなり、期待値と注記を直した。**
**⇒ 上の変更統計は Phase A 時点のものであり、Phase C 後の全数は §9.6 に記す。**

**削除 7 行の内訳**（**上書き事故ではない**）: `service.go` の 4 行＝`normalizePositionAndMass` の後半を切り出し関数の呼び出しへ置換 ／
`MassPercentInput.test.tsx` の 2 行＝`ExpectedKeys` 末尾と it 名 ／ `MassPercentInput.tsx` の 1 行＝percent 欄の `onBlur` を差し替え。

### 3.2 段 2 — `PATCH` に補完だけを持たせた（指示書 §2.2）

**★★★採った形＝「補完の半分を関数として切り出し、`PATCH` からはそれだけを呼ぶ」。**

| # | 追加 | 位置 |
|---|---|---|
| 1 | `representativeMassFill(position *string, mass *int) *int` | `internal/service/combo/service.go` |
| 2 | `fillStartPositionMassForPatch(current *model.Combo, input *UpdateMetadataInput)` | 同上 |
| 3 | 呼び出し（`s.repo.UpdateMetadata` の直前） | `UpdateMetadata` 内 |

`normalizePositionAndMass` の後半は `representativeMassFill` の呼び出しへ置き換えた。**⇒ 規則は 1 か所にしか無い**（指示書 §2.2-4 / §4.5）。

**「更新後のマス数」の決め方**（§2.2-1。**明示クリアとキー不在の両方を含む**）:

| 入力 | 更新後 | 埋めるか |
|---|---|---|
| `present` ＋ 値 | 送られてきた値 | **埋めない**（利用者の値が勝つ） |
| `present` ＋ `null`（明示クリア） | `nil` | **★埋める** |
| **キー不在**（`Present == false`） | **DB の現在値** | **★NULL なら埋める** |

### 3.3 段 3 — 画面の側で先に埋めた（指示書 §2.3）

| # | 変更 | 位置 |
|---|---|---|
| 1 | `MassPercentInput` に `onBlur?: () => void` を足した（**mass / percent の両モードの `<input>` から呼ぶ**） | `MassPercentInput.tsx` |
| 2 | `fillStartPositionMassOnBlur` を足し、**始動位置の `MassPercentInput` にだけ渡した** | `ComboEditorBasicFields.tsx` |
| 3 | props 完全一致テスト（破壊確認 層 1）を **6 → 7** へ更新し、理由を書いた | `MassPercentInput.test.tsx` |

**★★運び量には `onBlur` を渡していない。⇒ 「運び量が埋まらない」ことは JSX の上で構造的に保証される**（`D-731` 不変条件 2 / §4.3）。

---

## 4. 設計判断とその理由

### 4.1 ★★★`normalizePositionAndMass` を `PATCH` から呼ばなかった（指示書 §0.3 / §4.1）

**★同関数は 2 つの仕事をする。⇒ 要るのは補完だけである。**

| 半分 | `PATCH` で |
|---|---|
| **補完**（マス無し → 区分の代表値） | **★これが要る** |
| **導出**（マス在り → `position` を上書き） | **★★★これは呼んではならない** |

**★★導出を呼ぶと、区分をまたぐマス数が届いたときに `position` が黙って変わる。**
`position` は重複判定キー（`internal/service/combo/duplicate_keys.go:18-26`）であり、動くと
(1) 既存行と重複キーが衝突しうる (2) `PUT`〔旧行を論理削除して新規行を作る〕を通らないため履歴の作られ方が変わる
(3) **`PATCH` の契約〔識別キーが変わらない編集〕が嘘になる**。

**⇒ 破壊確認を置いた**（§5.3）。

### 4.2 ★検討した 3 案と、採らなかった理由

| 案 | 内容 | 採否 |
|---|---|---|
| **A** | **補完の半分を関数へ切り出し、両者から呼ぶ** | **★★採用**。規則が 1 か所に留まり、`PATCH` が導出に触れる経路が型の上で存在しない |
| B | `normalizePositionAndMass` に「導出をやめる」引数を足す | **却下**。分岐を持つ関数は「どちらで呼ばれているか」を読む側が追う必要があり、**次の担当が既定で導出付きを呼ぶ**（`CHANGE-195` の穴と同じ型） |
| C | `PATCH` 側に代表値の対応表を直接書く | **却下**。**代表値表の 3 本目になる**（指示書 §4.5 / チェックリスト D-5 が名指しで禁じている） |

### 4.3 ★補完を `repo.UpdateMetadata` の直前に置いた理由

- **エラー面が変わらない** —— `FindByID` は行が無いとき `ErrNotFound` を返し（`repository.go:1964-1965`）、直後の `repo.UpdateMetadata` が返す値と**同一**である。版ずれ（`ErrConflict`）の面も不変
- **検証と干渉しない** —— 埋める値は必ず 0〜160 のため `VAL-RANGE` に当たらない。`start_position_mass` は `requiredPublishedFields`（`validation/combo.go:413-422`）に**入っていない**ため `VAL-C15` とも無関係
- **`current` を 1 回引く必要がある** —— キー不在のときの「更新後の値」が DB 側にしか無いためである。**★同関数には既に同型の `FindByID` が 3 か所あり、作法を揃えた**

### 4.4 ★★段 3 で「blur」を選び、`onBlur` ポートを足した（**開発者裁定・案 A**）

**★`onChange` では埋められない** —— 毎キーストロークで発火するため、**利用者が `80` を消して `12` と打ち直そうとした瞬間に `80` が戻り、打ち直せなくなる**。⇒ 確定の合図が要る。

**★★もう 1 つの制約** —— `MassPercentInput.convention.test.ts`（破壊確認 **層 2**）が、同ファイルの実装に `representativeMassOf` / `POSITION_BANDS` / `positionFromMass` 等が現れることを**禁じている**。**⇒ 代表値の知識は親にしか置けない。⇒ 親が blur を受け取る手段が要る。**

| 案 | 内容 | 採否 |
|---|---|---|
| **A** | **`MassPercentInput` に `onBlur` ポートを足す** | **★★採用**（開発者裁定 2026-09-13） |
| B | 親の `<div data-seq-stop>` で `focusout` をバブリングで拾う | **却下** |

**★★★A を採った決め手は「運び量が埋まらない」ことの保証である**（チェックリスト C-1）。
A では**始動位置にだけ `onBlur` を渡す**ことが JSX に見える。**B では、将来だれかが 2 つを同じラッパへまとめた瞬間に運び量まで埋まり、型もテストも何も言わない**（指示書 §4.3 が名指しする事故の型そのもの）。

**★代償＝props 完全一致テスト（層 1）を 6 → 7 へ更新した。★趣旨は壊していない** ——
同テストが守っているのは「**区分の口を持たせない**」ことであり、その本体は層 2 である。`onBlur` は区分と無関係な汎用の口であり、**本部品は代表値も区分表も受け取らない**。

### 4.5 ★★★帰結を承知して作った（指示書 §2.2-1′・チェックリスト B-4）

**メモだけを直す `PATCH` でも、元が NULL で `position` が区分なら代表値が入る。**

**★これは意図した形である**（`D-864`）。**`PUT` は着手前からそう振る舞っており**（マス数が NULL のコンボの `hitType` を変えるだけで代表値が入った）、**本サブはそこへ寄せた**。
**⇒ `PATCH` と `PUT` の食い違いが消えたことが、本サブの成果そのものである。**

テストで固定した: `TestPatch_MemoOnly_FillsFromDBPosition`。

---

## 5. テスト（指示書 §5）

### 5.1 ★★★不変条件を 3 経路で確かめた（§5-1・チェックリスト B-1）

**★★閉じているのは片方向である**（§0 の但し書き）。**⇒ 下表が示すのは「区分あり ⇒ マス数が入る」「不問 ⇒ NULL のまま」までである。**

`TestInvariant_AllThreePaths`（`internal/service/combo/m37_05_position_mass_invariant_test.go`）

| 経路 | 条件 | 結果 |
|---|---|---|
| **POST** | 区分あり・マス数なし | **代表値 80 が入る** |
| **POST** | 不問・マス数なし | **両方 NULL のまま** |
| **PATCH** | 区分あり・マス数を明示クリア | **代表値 12 が入る**（`corner_self`） |
| **PUT** | 区分あり・マス数なし（`hit_type` を変えてキー変更） | **代表値 102 が入る**（`mid_opponent`） |

### 5.2 ★★`PATCH` の補完（§5-2・チェックリスト B-2 / B-3）

- `TestPatch_ClearMass_FillsRepresentative` — **7 区分すべて**で代表値が入り、**`position` は 1 つも動かない**
- `TestPatch_Unspecified_StaysNull` — **不問の行は明示クリアでもキー不在でも NULL のまま**
- `TestPatch_MemoOnly_FillsFromDBPosition` — **キー不在（メモだけ）でも DB の区分から埋まる**

### 5.3 ★★★破壊確認（§5-3・チェックリスト A-3 / A-4）

`TestPatch_CrossBandMass_DoesNotMovePosition`:
`position = mid_screen` の行へ**区分をまたぐ `12`** を `PATCH` → **`position` は `mid_screen` のまま**・マス数は `12`。**DB から読み直しても同じ。**

**★★逆向きの対照（A-4）を 3 通りで置いた** ——「補完が効いた」ことの証拠になるよう、**補完が効かない条件**を固定した。

1. `TestPatch_Unspecified_StaysNull` — 区分が無ければ何も入らない
2. `TestRepresentativeMassFor_OnlyFillsWhenBandIsKnown` — **埋めない 3 通り**（マス数が既に在る／不問／未知の区分）を直接固定
3. **★★★補完を外した実測（positive control）** ——
   `fillStartPositionMassForPatch` の呼び出しを外して走らせると、**10 件が赤になった**:
   `TestInvariant_AllThreePaths/PATCH:...`／`TestPatch_ClearMass_FillsRepresentative` の**7 区分すべて**／
   `TestPatch_MemoOnly_FillsFromDBPosition`／`TestPatch_CarryDistanceMass_NeverFilled`。
   **★同時に `TestPatch_Unspecified_StaysNull` と `TestPatch_CrossBandMass_DoesNotMovePosition` は緑のままであった。**
   **⇒ 「補完が効いている」ことと「効きすぎていない」ことの両方が測れている。**

**★画面側にも同じ対照を取った** —— `onBlur` の配線を外すと `M37-05` の describe のうち **3 件**が赤、
**運び量の 2 件と不問の 1 件は緑のまま**であった。

### 5.4 ★★運び量の非退行（§5-4・チェックリスト C-1 / C-2 / C-3）

- `TestPatch_CarryDistanceMass_NeverFilled` — **区分が決まっている行でも**、明示クリア・キー不在のどちらでも **NULL のまま**
- `TestFillStartPositionMassForPatch_NeverTouchesCarry` — **関数のレベルで** `CarryDistanceMass` の `Present` も `Value` も変わらないことを固定
- 画面: 「運び量は、区分が決まっていても離れて空のまま」「値を消して離れても空のまま」の 2 本
- E2E: 「運び量は、区分が決まっていても空のまま保存される」（**始動位置は `80 マス`、運び量は `-`**）

### 5.5 ★★CSV の非退行（§5-5・チェックリスト E-2 / E-3）

`internal/service/comboio/csvcore/m37_05_empty_mass_cell_test.go`（新規 2 本）

- 空セル → `nil` のまま通り、**マス数 2 列に指摘が 1 件も立たない**
- 「不問 ＋ 空セル」も通る
- **★本サブは CSV / API 経路へ新しい拒否を 1 つも足していない**（指示書 §0.4 / §3-4）

### 5.6 ★画面（§5-6・チェックリスト D-1〜D-5）

`ComboEditorBasicFields.test.tsx` の新 describe（8 本）＋ `MassPercentInput.test.tsx`（3 本）＋ E2E（5 本）。

| 観点 | 結果 |
|---|---|
| **D-1 保存より前に代表値が戻る** | **★E2E で確認**（保存せずに欄から離れるだけで `80` が戻る） |
| **D-2 不問なら空のまま** | 単体 ＋ E2E |
| **D-3 マス目 / パーセンテージで同じ結果** | 単体（`80` / `12`）＋ E2E（`80` / `7.5%`） |
| **D-4 既存の流儀に合わせた** | `setPositionBand` と**同じ `representativeMassOf`** を引く |
| **D-5 代表値表を 3 本目に増やしていない** | Go 1 本 ＋ TS 1 本のまま（§2.3） |

**★「値が入っているときは離れても書き換えない」も固定した** —— `85` を入れて離れても `80` へ潰さない。

### 5.7 全数（§5-7）

| 対象 | 結果 |
|---|---|
| `go test ./...` | **★★★Phase A 時点は赤であった。⇒ Phase C で是正し、現在は緑（exit 0・`--- FAIL` 0 行）**（§9.6） |
| `cd web && pnpm test` | **緑** —— **233 ファイル / 2909 テスト** |
| `make e2e`（全数） | **緑 —— 350 passed / 失敗 0**（Phase A 後 7.8 分 ／ **Phase C 後 8.2 分**。§6.4） |
| `make e2e-only P=m37-05` | **緑 —— 5 / 5 passed**（Phase A 後 43.9s ／ **Phase C 後 57.4s**） |

---

## 6. 検査の実測（§5-8・チェックリスト G-5〜G-7）

### 6.1 `check-artifact-integrity.sh`（★1 本目に回した）

**緑** —— 検査 16 件の自己検査すべて OK ／ 生成物 4 件（`code-facts` / `docs-map` / `retrospective-digest` / `custom-commands`）すべて OK。

### 6.2 `check-enum-sync.sh`

**緑** —— 「ベースラインどおり(増加なし)」。

### 6.3 ★★`check-import-order.sh`

| 時点 | 実測 | ベースライン |
|---|---:|---:|
| **着手時** | **99（本番 14 ／ テスト 85）** | 99 |
| **完了時** | **99（本番 14 ／ テスト 85）** | 99 |

**★★着手時の実測値を控えたうえで比較した**（`M37-01` §7-2 の教訓）。**⇒ 「緑だから増えていない」と読んでいない。**
**★`BASELINE` は下げていない**（`D-388`。`D-864` が 101 → 99 へ下げたのは開発者の手番であり、本サブは触っていない）。

### 6.4 `make e2e`（全数）

**2 回とも緑である。⇒ Phase C の取り込み後にもう一度全数を回した。**

| 実行 | 対象 | 結果 |
|---|---|---|
| 1 回目（Phase A 後・`fe2a32b` 時点） | 全数 | **350 passed / 失敗 0（7.8 分・exit 0）** |
| **2 回目（Phase C 後・`3571832` 時点）** | 全数 | **350 passed / 失敗 0（8.2 分・exit 0）** |

**★どちらも再実行（retry）による救済は 0 件である。**

- 本サブの新規 spec 5 本を含む（`m37-05-position-mass-invariant.spec.ts:35 / :56 / :73 / :109 / :150`）
- **★★既存の `m37-01-position-mass-input.spec.ts` は影響を受けなかった —— 2 回目は個別行で直接確認した**（No. 308〜316 の **9 本すべて緑**。**うち `:231` が「未入力で保存 → 詳細が `-`」であり、*不問のまま*保存する経路なので補完は効かない**）。
  **★1 回目は出力を `tail` で切り詰めて取得したため同 spec の行が残っておらず、根拠は「失敗 0 件」という全体の結果だけであった。⇒ 2 回目でファイルへ全量を落とし、個別行の観測に置き換えた。**
- `m19-03-setup-results.spec.ts` の flaky（`M37-03` §8.1 の申し送り）は**2 回とも再現しなかった**

---

## 7. ■ 併せて更新が要るもの

| # | 対象 | 状況 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **★消費していない**（**自採番していない**＝`D-293`）。⇒ `change-number-registry.md` §1・契約 §4・ボード §2.1 / §2.4 の 4 か所とも**更新不要**。原稿は §8 |
| 2 | **消費したマイグレ連番** | **★0 本**。`ls migrations/` の最新は **`000112`** のままであり、ボード §2.2 の「次は `000115`」と食い違わない |
| 3 | **版を上げた文書の参照元** | **★無し**（設計書本体を 1 文字も書き換えていない＝`CLAUDE.md` §8 / チェックリスト F-5） |
| 4 | **説明書の追随**（指示書 §2.4） | **★不要**。`docs/usermanual/` は `tacpendium-readme.html` / `dist-readme.txt` / `images/` のみで、**「マス数」「始動位置」の記述は 0 件**（実測）。⇒ 指示書の「書かれていないなら足さなくてよい」に該当 |
| 5 | **スクリーンショット** | **★撮っていない**（開発者の手番・`M37` の全着地後＝チェックリスト F-3） |
| 6 | `docs/handover/followup-backlog.md` | **★1 文字も編集していない**（`D-838` / チェックリスト F-4）。§DD の `position-mass-clear-differs-between-patch-and-put` の**状態更新は設計卓の手番**である |

---

## 8. ★CHANGE 原稿（**起票していない**＝`D-293`・チェックリスト G-9 / §6-5）

**★設計伝達レポートをまだ作っていないため、原稿をここへ置く。⇒ レポート作成時に §4 へ移すこと**（`CLAUDE.md` §9）。

### 8.1 原稿 1 — `DES-002` §4.2（`PATCH /api/combos/{id}`）

> **【CHANGE-XXX・`M37-05`・2026-09-13】`PATCH` がマス数を区分の代表値で補完する。**
>
> **★★★`CHANGE-195` §2.3 の「持たせなかった分岐 1」が変わった** ——
> 着手前の `PATCH` は `position` に触れず、マス数も送られたとおりに保存していた。
> **⇒ 本経路の結果として `start_position_mass` が NULL になるとき、DB 上の `position` が区分なら代表値で埋めるようになった。**
>
> | 入力 | 着手前 | as-built |
> |---|---|---|
> | `"startPositionMass": null`（明示クリア） | **NULL で保存** | **★区分の代表値で保存**（不問なら NULL） |
> | **キーが無い**（変更しない） | DB の値のまま | **★DB の値が NULL かつ区分が決まっていれば代表値が入る** |
> | `"startPositionMass": 80` | 80 を保存 | **不変** |
>
> **★★★`position` は依然として本経路に載らない。⇒ `normalizePositionAndMass` は呼ばない**（同関数は*導出*も行うため）。
> **⇒ 区分をまたぐマス数を直接投げても `position` は動かない**（破壊確認あり）。
>
> **★★★閉じるのは片方向である。⇒ 「マス数あり ⇒ 区分が決まっている」は本経路では守られない**（`position` が不問の行へマス数だけを送れば、`position` は NULL のまま値が入る）。**★逆向きを閉じているのは画面の区分導出と `PUT` 振り分けであり、API 直叩きは射程外である**（`D-864` ／ 指示書 §7-2＝別の裁定が要る）。**⇒ 設計書へ「3 経路で成り立つ」と無限定に書かないこと。**
>
> **★★`carryDistanceMass` は対象外である** —— 運び量は区分を持たず代表値という概念が無い（`D-731` 不変条件 2）。**NULL は正常な状態である。**
>
> **★応答 DTO 不変・スキーマ変更 0・マイグレ消費 0。**

### 8.2 原稿 2 — `DES-005` §5.7（入力 UI）

> **【CHANGE-XXX・`M37-05`・2026-09-13】マス数の欄を空にしたまま離れると、区分の代表値が入る。**
>
> **★★`CHANGE-196` の as-built に 1 行足る** —— マス目 / パーセンテージのどちらの方式でも、
> **欄から離れた時点で**、区分が決まっていれば代表値が入る。**⇒ 不問なら空のままである。**
>
> **★★★「保存してから値が生えてくる見え方」にしないための措置である**（`D-864`）。サーバ側も同じ補完を行うため保存結果は同じだが、**利用者には「消したのに生えてきた」と映る**。
>
> **★入力中は空のままである**（打ち直せる）。**★運び量には掛からない。**

### 8.3 原稿 3 — `DES-003` §3.3（`position` / `start_position_mass` の行）

> **【CHANGE-XXX・`M37-05`・2026-09-13】不変条件が 1 行になった。**
>
> ```
> start_position_mass IS NULL  ⇔  position = 不問
> ```
>
> **★同節の既存の記述**（「マス数があればマス数が勝つ／マス数が無く `position` があれば代表値／どちらも無ければ両方 NULL」）**は `POST` / `PUT` の正規化として引き続き正しい。**
> **⇒ 足るのは「`PATCH` 経路も同じ不変条件を守る」ことと、「`NULL` に 2 つ目の意味を持たせない」ことである**（`D-864`。**「未測定」「クリア済み」といった別の意味は足さない**）。
>
> **★`carry_distance_mass` は本不変条件の対象外である。⇒ NULL は正常な状態であり、埋める対象ではない。**
>
> **★★★`PATCH` が守るのは片方向である**（「区分あり ⇒ マス数が入る」）。**逆向き**（「マス数あり ⇒ 区分が決まっている」）**は画面の区分導出と `PUT` 振り分けが担っており、API 直叩きは射程外である。⇒ 本節に無限定の双方向として書かないこと。**

---

## 9. ★★★指示書・チェックリストとの差（すべて記録する）

### 9.1 ★段 1-1 を本セッションでは測れなかった（**開発者の実測で埋めた**）

**★理由は §2.1 に記した。⇒ 開発者が手元の dev DB で実測し、違反 0 件が確定した。**
**★「実測（開発者）」と「実測（本セッション）」を書き分けてある**（計測点 `M-157` / チェックリスト G-3）。

### 9.2 ★E2E の期待を 1 か所直した（**実装ではなくテストの誤りであった**）

初版の spec は「マス数が NULL のとき詳細に `-` が出る」と書いたが、**実物は要素ごと出ない**（`ComboDetailHeader.tsx:85` の `combo.startPositionMass != null && (...)`）。
**⇒ `toHaveCount(0)` へ直した。★運び量の `-` とは見せ方が違う**（運び量は `ComboDetailMetadata` 側で常に描かれる）。
**★これは既存の見せ方であり、本サブは変えていない。**

### 9.3 ★`MassPercentInput` の props 完全一致テストを 6 → 7 へ更新した

**★指示書はこの更新を明示的に求めていないが、`onBlur` を足すと同テストが型エラーで落ちるため不可避である。**
**⇒ 開発者裁定（案 A）で承認済み。理由は §4.4、テスト側にも 12 行のコメントで残した。**
**★層 2（convention test）は 1 文字も触っていない**（区分の識別子は 1 つも増えていない）。

### 9.4 ★指示書の推定「CHANGE 消費 1〜2 本の見込み」との差

**★原稿は 3 本になった**（`DES-002` / `DES-005` / `DES-003`）。**⇒ 1 本の CHANGE で 3 節を扱うか 2〜3 本に割るかは設計卓の裁量である。★製造は自採番していない。**

### 9.5 レビュー結果を参照する欄（**Phase C 後に記入**）

| 欄 | 実測 |
|---|---|
| レビュー報告書 | `docs/progress/m37-05-review.md` |
| 指摘の件数 | **13 件**（高 4 ／ 中 4 ／ 低 5） |
| **★「高」指摘の不採用** | **0 件**（4 件すべて採用・修正済み） |
| 中の採否 | **4 件中 3 件を採用。1 件（中-3）はレビュー時点の未実測が原因で、既に実測済みであった** |
| 低の採否 | **5 件中 3 件を採用、2 件は記録のみ**（§9.7） |
| 再レビュー往復 | **0 回**（初回レビューのみ。上限 2 回に達していない） |

### 9.6 ★★★Phase C のトリアージ（採否と理由）

**★★「高」指摘の不採用は 0 件である。⇒ エスカレーションは発生していない。**

| # | 指摘 | 採否 | 理由と対応 |
|---|---|---|---|
| **高-1** | **`go test ./...` が赤** | **★採用** | **★★事実であった。自分で再実行して確認した**（`EXIT=1` ／ `TestUpdateMetadata_PositionMass_ClearsWithPresentNull`）。**★赤の中身は実装の欠陥ではなく、`D-864` が意図的に変えた挙動を旧のまま固定した既存テストである** ⇒ 期待値を代表値 80 へ直し、`carryDistanceMass` の nil 期待は**残した**（運び量が埋まらないことの証拠であり価値が上がる）。`position` 不動の確認も 1 つ足した。**★§3.1 / §5.7 の誤った記述も訂正した** |
| **高-2** | `m37_01_*` の注記 2 か所が失効 | **★採用** | ヘッダへ「マス数はもう素通しではない」ブロックを、テスト名注記へ「他の Optional 列と同じではない」を追記し、`m37_05_*` の該当テストを指した |
| **高-3** | `ComboEditorBasicFields.tsx` の注記が失効に近い | **★採用** | 「サーバの `PATCH` は触らないわけではなくなった／ただし `position` は書かないので `PUT` 振り分けは依然必要」を 8 行で追記した |
| **高-4** | `progress-log.md` に索引行が無い | **★採用** | Phase D で追記し、`check-progress-log-index.sh` の緑を確認した（違反 0 件） |
| **中-1** | 不変条件は片方向しか閉じていない | **★採用**（記述のみ・実装変更なし） | **★レビューの指摘どおり実装の変更は不要である**。`representativeMassFor` の godoc・完了報告 §0 / §5.1・CHANGE 原稿 §8.1 / §8.3 に限定を足した |
| **中-2** | E2E の 1 本がサーバ補完を検証していない | **★採用**（**強化した**） | **★コメントを実態へ直したうえで、`PATCH` の要求本文に `102` が載っていることを直接検証する形へ変えた。⇒ 指示書 §0.6（保存より前に画面が埋める）の証拠がワイヤ上に出る。★positive control で赤くなることも実測した**（§5.3） |
| **中-3** | `make e2e` 全数が未実測 | **★該当なし**（レビュー時点の情報差） | レビュー対象 `317cdd6` の時点では空欄だったが、**`fe2a32b` で既に記入済み**（350 passed）。**★Phase C 後に再度全数を回した**（§6.4） |
| **中-4** | `FindByID` が 1 回増えた | **★採用** | **★レビューの指摘どおり、既存 3 か所も含め必ず 1 回は先に実行済みであった**。`UpdateMetadata` 内に 1 回だけ引くメモ化クロージャ `currentBefore()` を置き、**4 か所すべてをそれ経由にした**。**★各呼び出し元のエラーの扱いは 1 文字も変えていない**（KA 変更分岐の `findErr == nil` 握り潰しもそのまま） |
| **低-1** | CSV 非退行が `ExportCSV` 往復 | **★採用** | **生の CSV テキストを直接 `ParseAndValidate` へ渡すテストを 1 本足した**。★ヘッダは `CSVColumns` から組む（写経すると列追加で落ちるため） |
| **低-2** | 呼び出し位置の注記が無い | **★採用** | `fillStartPositionMassForPatch` の godoc に「検証より後・`repo.UpdateMetadata` の直前」と、**将来必須欄になったら前へ move すべき条件**を書いた |
| **低-3** | `representativeMassFill` の命名 | **★採用** | **`representativeMassFor` へ改名した**（値を返すだけで代入しないため）。★呼び出し 2 か所とテストも追随 |
| **低-4** | 画面の先回り補完は「欄を触って離れた」ときだけ | **★不採用（記録のみ）** | **★実装しない**。(1) 開発者実測でその形の既存行は**0 件** (2) UI の通常操作では作れない (3) **指示書 §2.2-1′ が「メモだけの `PATCH` でも代表値が入る」ことを*意図した形*として明記している**。⇒ マウント時補完は射程超過である。**★残余であることは §10.4 に記録した** |
| **低-5** | 代表値 7 個のベタ書きが重複 | **★不採用（記録のみ）** | **★意図した外形固定である**（レビュー自身も「外形固定として妥当」と評価）。**⇒ 表駆動の `TestRepresentativeMassFor_CoversAllBands` と役割が違う**——片方が表から期待値を作り、片方が表の外から値を固定する。両方が緑でなければ「表が変わったのか、実装が変わったのか」を切り分けられない |

**★★レビュー報告書末尾にも同じ採否表を「## 取り込み結果（自動トリアージ）」として追記してある。**

### 9.7 Phase C 後の全数（**再実測**）

| 対象 | 結果 |
|---|---|
| `go test ./...` | **緑 —— exit 0 ／ `--- FAIL` 0 行**（★パイプを挟まずファイルへ落として終了コードで判定した） |
| `cd web && pnpm test` | **緑 —— 233 ファイル / 2909 テスト** |
| `pnpm exec tsc --noEmit` | **緑** |
| `make e2e-only P=m37-05` | **緑 —— 5 / 5 passed（57.4s）** |
| `make e2e`（全数） | **緑 —— 350 passed / 失敗 0（8.2 分・exit 0）**（§6.4） |
| `check-import-order.sh` | **99 / 99（本番 14 ／ テスト 85）——着手時と同値** |
| `check-enum-sync.sh` | **ベースラインどおり** |
| `check-progress-log-index.sh` | **緑 —— 違反 0 件**（高-4 の是正後） |

---

## 10. ★横断課題（他サブ・他マイルストーンへ波及するもの）

### 10.1 ★`import.go` の事前重複判定は正規化前の `position` を使っている（**本サブの射程外**）

`internal/service/comboio/import.go:335-363` の `checkDuplicate` は `CheckDuplicateInput{Position: strToPtr(dto.Position)}`（**CSV の生の値**）で判定する。
一方 `normalizePositionAndMass` の godoc（`service.go:1777-1779`）は「**重複判定より前に呼ぶこと**」と明記している。
**⇒ `Create` の内側では順序は正しいが、この取り込み層の事前判定はその保証の外に在る。**

**★★実害は現時点では小さい** —— マス数と `position` が食い違う CSV でしか踏めず、開発者の実測でも**食い違い行は 0 件**であった。
**★本サブでは直していない** —— 指示書 §0.4 / §3-4 が CSV 経路への手入れを射程外としているためである。**⇒ 設計卓へ申し送る。**

### 10.2 ★`followup` §DD の `position-mass-clear-differs-between-patch-and-put` は**解消した**

**★状態の更新は設計卓の手番である**（`D-838`。**製造は `followup-backlog.md` を 1 文字も編集しない**）。
**⇒ 保留 `P-60` も決着（`D-864`）どおり実装が入った。**

### 10.3 ★`VAL-C16` / `VAL-RANGE` の食い違いは**触っていない**

`CHANGE-195` §3.1 の申し送りのままである（チェックリスト F-1）。**★本サブは経路を 1 つも増やしていない**（4 経路のまま）。

---

### 10.4 ★画面の先回り補完は「マス数欄を触って離れた」ときだけ働く（**残余・レビュー 低-4**）

区分が決まっていてマス数が NULL の行を**メモだけ直して保存**すると、値はサーバ補完で入り、利用者からは保存後に生えて見える。

**★本サブでは直していない。理由 3 つ**: (1) 開発者実測でその形の既存行は **0 件** (2) **UI の通常操作では作れない**（区分を選べば代表値が入る） (3) **指示書 §2.2-1′ がこの形を*意図した形*として明記している**。
**⇒ 編集画面のマウント時補完を入れるかは別の判断である。設計卓へ申し送る。**

---

## 11. 停止時記録（`CLAUDE.md` §9・`D-838`）

**★★上限（再レビュー往復 2 回／タイムボックス／終了指示）には達していない。⇒ 未解消項目は無い。**
**★Phase C 終了時に未解消の指摘が残った場合は、ここへ必須 5 フィールド付きの原稿を足し、設計伝達レポート §4 へ移す。**
**★`docs/handover/followup-backlog.md` は 1 文字も編集しない。**

---

*以上、M37-05 完了報告。* **★★★§4.1 が本サブの核である** —— **`normalizePositionAndMass` をそのまま `PATCH` から呼ぶのが、最も自然に書けて、最も害が大きい形であった。** **★★次に重いのは §5.4 である** —— **運び量は名前が似ているだけであり、埋める対象ではない。**
