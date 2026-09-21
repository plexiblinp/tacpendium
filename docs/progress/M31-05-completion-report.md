# M31-05 完了報告: 各キャラの設置系 `custom_states` を足す（`P4M-023`）

| 項目 | 内容 |
|------|------|
| 作業 ID | **M31-05** |
| 指示書 | `docs/instructions/M31-05-custom-states-placement-expansion.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M31-05-review-checklist.md` v1.0.0 |
| 実施日 | 2026-09-10 |
| 着手基点 | `3ee9162` |
| 消費マイグレ | **`000110`（1 本）** |
| 消費 CHANGE | **0 本**（★`DES-003` §3.2 への `options` 追加は**請求のみ**。起票は設計卓＝`D-293`） |
| レビュー報告 | `docs/progress/M31-05-review.md`（高 3 / 中 6 / 低 6。**★取り込み結果は同書末尾**） |

---

## 0. ★★2026-09-10 追補（**開発者の実機確認による**）

**Phase D の後、開発者が実機で確認し、5 点の是正指示が出た。⇒ マイグレ `000110` は未着地であるため、番号を増やさず同じファイルを書き換えた。**

| # | 開発者の指摘・回答 | 何を直したか |
|---|---|---|
| **★★1** | **「設置系の技が始動時、終了時に分かれているが、分ける必要はないので直して欲しい。恐らくストック数等に釣られたものと思われるが、それらとは扱いが別。」** | **`value_definition.single_value` を新設し、本サブが足す int state 全件を 1 欄 / 1 行にした**（§0.1） |
| **2** | **ジュリは設置できるものが 2 つある**（`fuha_saihasho` と `saihasho_od`） | `flag` → **level ＋ options「なし / 風破版 / OD」**。★実データに「[風破]OD歳破衝」は無く、`saihasho_od` は風破なしである |
| **3** | **ヨガサンバーストは弱中強の使い分けもある** | **「ホールド段階」と「強度」の 2 state へ割った**。★`moves` は `k` しか持たず強度が畳まれている（ヤスミンの OD＝§0.2-3 と同型） |
| **4** | **サンオーダーはレベルと強度を分けたい**（入力しやすさ） | **「レベル」4 択と「強度」4 択の 2 state へ割った** |
| **5** | **舞は分割しない。「乱れ」が分かりにくいので「乱れ花蝶扇」へ**（OD 版から派生） | **通常版 / 焔版の 2 本立てを維持**し、選択肢のラベルだけ改めた |

**⇒ state は 12 → 14 件になった。** 全群が上限 10 の内側で、**最大は yasmine の 7 で余白は 3** である（追補前はイングリッドが 10 で余白 0 だった）。

### 0.1 ★★①② を持たないこと（`single_value`）

**開発者の指摘はそのとおりであった。** ①`start_min` / ②`end` は `M16-07` が**ストック系のために**足した拡張であり、`custom_states` の原点は `CHANGE-040` の「**開始時状態の付与のみを扱う**」である（`customStates.ts` の冒頭が逐語で書いている）。**⇒ 設置系をそこへ乗せたのは製造の取り違えである。**

| 項目 | 内容 |
|---|---|
| **対象** | **本サブが足す int state 11 件**（`flag` 3 件は元から 1 値）。**⇒ 14 件すべてが 1 欄 / 1 行になる** |
| **★変えないもの** | **既存のストック系 6 件**——`fuha_stock` ／ `flame_stock` ／ `windclad` ／ `blanka_chan_bomb`（残弾） ／ `shuriken_bomb_stock`（残弾） ／ `sun_crest`。**`single_value` を持たないため 1 文字も変わらない**（陰性対照をテストで固定） |
| **格納形** | **`{start_min, end}` のまま両方へ同じ値を書く。⇒ 形を分岐させない**（parse / build / 後方互換の経路をどれも変えずに済む）。`normalizeIntValue` が畳む |
| **ラベル** | **固定句を付けず state 名だけ**（「細工手裏剣設置数」「ヨガアーチ設置」）。★①②が無いのだから「始動時 / 終了時」を言う相手が居ない |
| **★副産物** | **`phrase_kind`（「始動時に置いてある数」）を撤去した。** 固定句そのものが消えるため不要になる。**⇒ レビュー 中-2 の是正**（残弾と設置数がラベル上で区別できない）**は保たれたまま、機構が 1 つ減った** |
| **★あわせて** | キンバリーの `show_delta` を外した（**1 つの値に増減は無い**） |

### 0.1b ★★是正後の実機確認は通っている

**2026-09-10、開発者が上記 5 点の是正後の画面を確認し、全項目 問題なしと回答した**（逐語＝「直したものはすべて問題なしです」）。**⇒ 本サブに確認待ちの項目は 1 件も残っていない。**

### 0.2 ★語幹がタブに当たらない state が 1 件 → 3 件に増えた

`flame_kachousen` に加え、新設した **`yoga_sunburst_strength` / `order_of_the_sun_strength`**（後置語 `_strength` は `STATE_CODE_SUFFIXES` に無い）。

**★いずれも兄弟 state がタブを担保するので実害は 0 件である**（`TestRun_M3105_FlameKachousenCoveredByFlameStock` ／ `TestRun_M3105_StrengthStatesCoveredBySibling` が名指しで主張する）。**⇒ ただし増えたこと自体が申し送りに値する**——`M30-01` 完了報告 §6 の「**案 D＝state 定義に技コードの接頭辞を持たせる**」の必要性がそのぶん増えた（§7-8）。

---

## 1. 変更したファイル

`git diff --stat 3ee9162`（**★2026-09-10 追補まで反映した最終形。文書 4 本を含む**）:

```
 .../20260910-m31-05-design-exceptions.md           | 263 +++++++++
 docs/progress/M31-05-completion-report.md          | 426 ++++++++++++++
 docs/progress/M31-05-review.md                     | 310 ++++++++++
 docs/progress/progress-log.md                      |  15 +
 internal/infra/migration/migrate_m3105_test.go     | 626 +++++++++++++++++++++
 ...seed_custom_states_placement_expansion.down.sql |  46 ++
 ...a_seed_custom_states_placement_expansion.up.sql | 157 ++++++
 web/e2e/m30-01-controller-surfacing.spec.ts        |   7 +-
 web/src/features/combo-io/export-model.ts          |   4 +-
 .../combo/components/ComboDetailHeader.tsx         |   4 +-
 .../combo/components/ComboEditorBasicFields.tsx    | 158 +++++-
 web/src/features/combo/components/CompareTable.tsx |   4 +-
 web/src/features/combo/customStates.test.ts        | 237 ++++++++
 web/src/features/combo/customStates.ts             | 135 ++++-
 web/src/features/combo/moveSurfacing.test.ts       |  53 ++
 web/src/features/combo/optionButtons.test.ts       |  17 +
 16 files changed, 2425 insertions(+), 37 deletions(-)
```

**★新規ファイル 6 本（完了報告 ／ レビュー報告 ／ 設計伝達レポート ／ `migrate_m3105_test.go` ／ マイグレ up・down）はいずれも `+` だけである**（`E-225` の観点）。**deletions が付いた新規ファイルは無い。** 作成前に `ls migrations/000110*` ／ `ls internal/infra/migration/migrate_m3105*` ／ `ls docs/progress/M31-05*` で同名の不在を確かめてから書いた。

**★この図は Phase C の最後に撮り直したものである**（レビュー 中-5。**★この節は `E-225` を確かめるために置かれている。⇒ 貼る図が実物と違えば、節の目的そのものが機能しない**）。

**`character_data/*.csv` は 1 行も触っていない。`moves` も 1 行も増やしていない**（§3-3 / §0.2-3）。

---

## 2. ★★段 1 の実測（`D-807` の暫定採択＝案 (vi) の検算）

### 2.0 測定環境

`migrations` を一時 DB へ全適用（`internal/infra/migration` の build tag `probe` 付き一時プローブ。**計測後に削除済み・コミットしていない**）し、実 DB の `moves` と `characters.custom_states` を直接引いた。タブ照合は `web/src/features/combo/moveSurfacing.ts` の `expandStateCodes` ＋ `move.code.includes(stateCode)` を実装どおり再現して測った。

**⇒ CSV ではなく実 DB で測っている**（`moveSurfacing.roster.test.ts` の冒頭が警告する「CSV 2743 行 / 実 DB 3026 行」の食い違いを避けるため）。

### 2.1 実査 1 — 案 (ii) / 案 (vi) の state 数（**実数**）

| キャラ | ファミリー | 変種数 | 案(ii) | 案(vi) |
|---|---|---|---|---|
| kimberly | 細工手裏剣設置 | 6（弱中強 ＋ 乱れ弱中強） | 6 | 1 |
| juri | 歳破衝設置 | 1 | 1 | 1 |
| blanka | ブランカちゃん人形設置 | 1 | 1 | 1 |
| dhalsim | ヨガアーチ | 4 | 4 | 1 |
| dhalsim | ヨガサンバースト | 3 | 3 | 1 |
| jp | ヴィーハト | 4 | 4 | 1 |
| jp | ラヴーシュカ発動中 | 1 | 1 | 1 |
| rashid | イウサール発動中 | 1 | 1 | 1 |
| mai | 花蝶扇バウンド中 | 10（ホールド 4 ＋ 乱れ 1、各焔版） | 10 | **2** |
| ingrid | サンオーダー発動中 | 9（Lv1〜3 × 弱中強） | 9 | 1 |
| yasmine | パンギル・サ・リクラン | 6（弱中強 ＋ OD 弱中強） | 6 | 1 |
| **新規計** | **11 ファミリー** | **46** | **46** | **14**（★追補後） |

**既存 9 件と合わせた 9 体の総 state 数＝案(ii) 55 ／ 案(vi) 23**（★追補後）**。**

**★★2 state へ割ったファミリーが 3 つある**——**舞**（通常版 / 焔版。**当初は 1 state 11 択で、開発者裁定「10を超えるものはボタン化の対象外。」**（`D-578(4)`）**の外側へ出ていた**＝レビュー 高-1）／ **イングリッド**（レベル / 強度）／ **ダルシムのサンバースト**（ホールド段階 / 強度）。**★後の 2 つは 2026-09-10 の開発者の要望（入力しやすさ）による＝§0。詳細は §3.2 と §5-10 / §5-13。**

**⇒ 設計卓の見積もり「9 体ぶんで state が 50 前後になる」は実数と一致した**（束 A-1 の検算）。**暫定採択の根拠は崩れていない。**

### 2.2 ★★実査 2 ／ 段 1-2 — キャラ固有状態タブの照合（指示書 §4.2）

**★★案 (ii) は実際に壊れる。** `yoga_arch_set_light` は **0 件**に当たった——`_set_light` は `STATE_CODE_SUFFIXES`〔`_stock` / `_mode` / `_is_set` / `_crest` / `_charge`〕に無いため語幹化されず、`yoga_arch_light` に届かない。**指示書 §4.2 の予測はそのとおりだった。**

**★★★あわせて 1 つ落とし穴を実測で踏んだ**——**`_set` 単独でも語幹化されない。** `shuriken_bomb_set` は 0 件に当たる。**⇒ 後置語は既存表に在る `_is_set` を使う必要がある**（先例＝`m_bison` の `psycho_mine_is_set`）。**この 1 文字の差で「足したのにタブに出ない」が起きる。**

**★案 (vi) は 11 件すべてが当たった**（実測）:

| キャラ | 追加 state code | 単独ヒット | タブ件数 before → after |
|---|---|---|---|
| kimberly | `shuriken_bomb_is_set` | 6 | 6 → 6 |
| juri | `saihasho_is_set` | 3 | 11 → 13 |
| blanka | `blanka_chan_bomb_is_set` | 3 | 25 → 25 |
| dhalsim | `yoga_arch_is_set` ／ `yoga_sunburst_is_set` ／ **`yoga_sunburst_strength`** | 4 ／ 3 ／ **0** | **0 → 7** |
| jp | `departure_is_set` ／ `lovushka` | 8 ／ 1 | **0 → 9** |
| rashid | `ysaar` | 1 | **0 → 1** |
| mai | `kachousen` ／ **`flame_kachousen`** | 18 ／ **0** | 26 → 35 |
| ingrid | `order_of_the_sun` ／ **`order_of_the_sun_strength`** | 3 ／ **0** | 31 → 31 |
| yasmine | `pangil_sa_likuran_is_set` | 4 | 5 → 9 |

**★単独ヒット 0 件の 3 件は、いずれも兄弟 state がタブを担保する**（§0.2）**。⇒ タブ件数は追補の前後で 1 件も動いていない。**

**★before は「足す前」の実測である**（陽性対照＝§4）。**⇒ dhalsim / jp / rashid は足す前に 0 件であり、足した後に出るようになった。**

**★before = after のキャラ 3 体**（kimberly / blanka / ingrid）**は、既存 state の語幹が同じファミリーを既に拾っていたためである。⇒ 追加 state 自身は単独で 6 / 3 / 3 件に当たっており、「当たらない」のではない。**

### 2.3 実査 3 — 案 (vi) の実装見積もり（**★指示書の見立てを 1 点超過した**）

**★`isSupportedState` は 1 文字も触っていない**（`level` は元から通る）。**★`options` を持たない `level` の描画も 1 行も変えていない。**

**★★ただし指示書の「足すのは『選択肢が在れば選択を出す』分岐だけのはずである」は、エディタについては正しいが、表示側にラベル解決が要ることが実物で分かった。** 数値のままだと詳細・比較・エクスポートに「ヨガアーチ設置：終了時: 3」と出て、利用者に数字と変種の対応を覚えさせる形になる——**これは案 (v) を推さなかった理由そのものである。**

実際に足したもの:

| ファイル | 足したもの |
|---|---|
| `customStates.ts` | `CustomStateOption` 型 ／ `value_definition.options` ／ `stateOptions` / `hasStateOptions` / `optionLabelFor` ／ `ResolvedCustomState.valueLabel` ／ `customStateValueText`（表示 3 面の SSOT） ／ `OPTION_PHRASE`（下記） |
| `ComboEditorBasicFields.tsx` | int 分岐に「`options` が在れば `OptionButtonGroup`、無ければ数値 `Input`」の分岐（①② の 2 か所）。**★汎用部品は既存の `OptionButtonGroup` をそのまま使った**（M24-12 §4.3 の「同じ形を複製しない」） |
| `ComboDetailHeader.tsx` ／ `CompareTable.tsx` ／ `export-model.ts` | `formatIntStateValue` の直接呼び出しを `customStateValueText` へ差し替え（**3 面で同じ判断を 3 回書かないため**） |

### 2.4 実査 4 — `subject`

**11 件すべて `self`。** 判定軸は `CHANGE-154` の「その状態が誰に付いているか」であり、「設置技かどうか」では決めていない。`m_bison` の `psycho_mine_is_set` が `opponent` なのは**相手に付く**ためであり、本サブの 11 件はいずれも自分の側〔ステージ上に自分が置いた物 ／ 自分に付く発動状態〕である。

**★同じ節が同型の是正を 2 度受けている**（`CHANGE-154` / `CHANGE-169`）**ため、3 度目を作らないよう `migrate_m3105_test.go` が `subject == "self"` を 11 件について機械で見る。**

### 2.5 ★★実査 5 — 同じファミリーの変種を同時に 2 つ以上設置できるキャラ

**kimberly のみである。** 根拠は 2 つ。

1. **開発者の逐語は「細工手裏剣設置数」であり、個数を指している。⇒ 1 つの値で「どの強度で置いたか」は表せない。**
2. 既存 `shuriken_bomb_stock`（残弾・0〜3）が複数所持を裏づける。

**⇒ kimberly だけ案 (vi) の `level` ではなく `type: stock`（0〜3・`show_delta: true`）で入れた**（2026-09-10 開発者確認）。**★案 (ii) の変種別フラグ 6 本も検討したが、開発者が求めたのは「数」であり、フラグでは同じ強度を 2 つ置いた場合の個数が落ちる。**

**推測: 上限 3 は既存の残弾 stock（0〜3）からの推測である。** フィールド上の同時設置数の上限は実機でしか確かめられない。**開発者の実機確認で 3 でないと分かったら、追随マイグレ 1 本で直る**（値域だけの DML）。

### 2.6 実査 6 — `start_min` / `end` が変種の値にどう効くか

**★★本節の結論は追補で覆った**（§0.1）。**⇒ 以下は経緯として残す。**

着手時の実測: **int state は必ず ①`start_min` / ②`end` の 2 欄になる**（`normalizeIntValue` / エディタ / 表示のいずれも）。そこで固定句だけを差し替えた——`STOCK_PHRASE`（「始動時に必要な最低のストック数」）は**量の大小を前提にした言い回し**であり、変種（弱 / 中 / 強 / OD）には順序が無いためである。

**★★開発者の指摘で、そもそも ①② を持つべきではないと分かった。** ①② は `M16-07` が**ストック系のために**足した拡張であり、`custom_states` の原点は `CHANGE-040` の「開始時状態の付与のみを扱う」である。**⇒ `single_value` を新設して 1 欄にした。`OPTION_PHRASE` は「始動時 / 終了時」の 2 欄が残る既存 state のためだけに残っている。**

**★`show_delta` は 14 件のいずれにも付けていない**（1 つの値に増減は無い）。**★キンバリーの `show_delta: true` も追補で外した。**

### 2.7 ★★★束 A-4 — `options` を足しても `sun_crest` が変わらないこと

**`sun_crest` は `options` を持たないため、足した分岐を 1 つも通らない。**

- `customStates.test.ts`: `hasStateOptions(intDef) === false` ／ ラベルが従来どおり「サンシンボル：始動時に必要な最低のストック数」であること ／ `valueLabel` が `undefined` で数値のままであること（**陰性対照**）
- `migrate_m3105_test.go`: `TestRun_M3105_SunCrestUnchanged` が実 DB で `type=level` かつ `options` 0 件を主張
- E2E `m14-03b-custom-states-realdata.spec.ts`（**ingrid の `sun_crest` を実サーバ越しに行使する既存 spec**）が **1 passed**

**⇒ 案 (vi) の前提は崩れていない。止めて返す条件には当たらなかった。**

### 2.8 束 A-5 — 案 (iii)（`type: composite`）について

**再提案していない。** `000009` が入れ `000017` が削除した型であり、`isSupportedState` が明示的にスキップする。**本サブは `isSupportedState` を 1 文字も変えていない**（束 E-3）。

---

## 3. 投入した 14 state（9 キャラ・マイグレ `000110`）

### 3.1 code の付け方（**規則を 1 つ決めた**）

| 種別 | 形 | 先例 |
|---|---|---|
| **設置物の有無・数** | **`<family>_is_set`** | `m_bison` の `psycho_mine_is_set` |
| **発動中の状態** | **素の `<family>`** | `blanka` の `lightning_beast` ／ `juri` の `feng_shui_engine` ／ `yasmine` の `bayani_mode` |

**★どちらもタブの語幹照合が当たる形である**（前者は `_is_set` が落ちて語幹になり、後者は素のまま `move_code` の部分文字列になる）。

**★★例外が 3 件ある**（§0.2）。いずれも**兄弟 state がタブを担保する**形である。

| code | 当たらない理由 | 担保する兄弟 |
|---|---|---|
| `flame_kachousen` | `flame_light_kachousen_holding` に `flame_kachousen` という並びが無い | 既存 `flame_stock`（語幹 `flame`）が焔版 26 件を全件拾う |
| `yoga_sunburst_strength` | 後置語 `_strength` が `STATE_CODE_SUFFIXES` に無い | `yoga_sunburst_is_set`（語幹 `yoga_sunburst`） |
| `order_of_the_sun_strength` | 同上 | `order_of_the_sun` |

**`migrate_m3105_test.go` はこの 3 件だけを明示的な例外にし、代わりに「当該ファミリーの技が実際にタブに載っている」を名指しで主張する**（`TestRun_M3105_FlameKachousenCoveredByFlameStock` ／ `TestRun_M3105_StrengthStatesCoveredBySibling`）。**★例外を素通しにしない。**

### 3.2 中身（**★2026-09-10 追補後の最終形**）

| キャラ | code | type | 値 |
|---|---|---|---|
| kimberly | `shuriken_bomb_is_set` | stock 0〜3・**single** | 細工手裏剣設置数（数値入力） |
| juri | `saihasho_is_set` | level ＋ options 0〜2・**single** | なし / **風破版** / OD（**★state 名に「[風破]」は付けていない**＝`CHANGE-169` §2.4。§2.4 は state 名の規定であり、選択肢ラベルには使える） |
| blanka | `blanka_chan_bomb_is_set` | flag | ブランカちゃん人形設置 |
| dhalsim | `yoga_arch_is_set` | level ＋ options 0〜4・**single** | なし / 弱 / 中 / 強 / OD |
| dhalsim | `yoga_sunburst_is_set` | level ＋ options 0〜3・**single** | なし / 通常 / ホールド / 最大ホールド |
| **dhalsim** | **`yoga_sunburst_strength`** | level ＋ options 0〜3・**single** | なし / 弱 / 中 / 強（**★追補で新設**） |
| jp | `departure_is_set` | level ＋ options 0〜4・**single** | なし / 弱 / 中 / 強 / OD |
| jp | `lovushka` | flag（`conditional` / `sa2_active`） | ラヴーシュカ発動中 |
| rashid | `ysaar` | flag（`conditional` / `sa2_active`） | イウサール発動中 |
| mai | `kachousen` | level ＋ options 0〜5・**single** | なし / ホールド弱 / 中 / 強 / OD / **乱れ花蝶扇** |
| mai | `flame_kachousen` | level ＋ options 0〜5・**single** | 同上の**焔版**（§0.2-2） |
| ingrid | `order_of_the_sun` | level ＋ options 0〜3・**single** | なし / Lv1 / Lv2 / Lv3 |
| **ingrid** | **`order_of_the_sun_strength`** | level ＋ options 0〜3・**single** | なし / 弱 / 中 / 強（**★追補で新設**） |
| yasmine | `pangil_sa_likuran_is_set` | level ＋ options 0〜6・**single** | なし / 弱 / 中 / 強 / OD弱 / OD中 / OD強（§0.2-3。`moves` は増やさない） |

**★`single` ＝ `value_definition.single_value: true`。⇒ 画面は 1 欄、表示は 1 行、ラベルは state 名だけ**（§0.1）。**★`flag` 3 件は元から 1 値なので指定しない。**

### 3.3 ★★既存 state を 1 つも消していない

`characters.custom_states` は JSON 1 列であり `UPDATE ... SET custom_states = ...` は**全置換**になる。**⇒ 既存 state を含めた完全な JSON を書いた**（先例 `000094`）。**JSON は実 DB の現行値から機械的に組み立てており、手で書き写していない。**

**★とくに次の 2 件は名前が似ているが別物である**（`CHANGE-169` §2.5・**製造が 1 度これで外している**）:

| キャラ | 既存（残す） | 今回足した |
|---|---|---|
| kimberly | `shuriken_bomb_stock`＝**手持ちの残弾** | `shuriken_bomb_is_set`＝**フィールドへ設置した数** |
| blanka | `blanka_chan_bomb`（stock）＝**残弾** | `blanka_chan_bomb_is_set`＝**設置したかどうか** |

`migrate_m3105_test.go` がこの 2 件を**名指しで**残存確認する。

### 3.4 `aki` には足していない

開発者の逐語＝「いらない事がわかった」。**`TestRun_M3105_AkiUntouched` が「`poisoned` 1 件のまま」を機械で主張する**——★次に触る人が「9 体に足したなら 10 体目も」と読まないようにするためであり、漏れではなく裁定である。

### 3.5 ライセンス層

**ファイル名に `_data_` を入れてある**（`000110_data_seed_custom_states_placement_expansion.{up,down}.sql`）。`bash scripts/check-migration-license.sh --list` の実出力:

```
  B      新規       CC-BY-SA-4.0         000110_data_seed_custom_states_placement_expansion.down.sql
  B      新規       CC-BY-SA-4.0         000110_data_seed_custom_states_placement_expansion.up.sql
```

**⇒ 層 B（`CC-BY-SA-4.0`）と判定される**（束 C-1 / C-2）。

### 3.6 マイグレ番号

**`000110` は自採番していない。** 出所は **`docs/instructions/reviews/M31-05-review-checklist.md` 束 C-3 の「★`000110` が次である」**（設計卓発行・`D-807`）。**ボード §2.2 は `000108`→`M35-02` ／ `000109`→`M31-04` を払い出し済みで、どちらもまだ disk に無い**（disk 末尾は着手時点で `000107`）。

**★★申し送り＝`M35-02`（`000108`）と `M31-04`（`000109`）より先に本サブが着地すると、既存 DB では後から入る 2 本が適用されない**（`golang-migrate` の version は単調であり、現在版より小さい番号は走らない）。**⇒ マージ順は `M35-02` / `M31-04` → 本サブ、が安全である。§7 へ再掲した。**

---

## 4. テスト・検査の実測

| # | 何を | 結果 |
|---|---|---|
| 1 | `bash scripts/check-artifact-integrity.sh`（**1 本目**） | **緑**（`結果: 違反なし`。検査 15 件の自己検査 ＋ 生成物 4 本） |
| 2 | `bash scripts/check-migration-license.sh` | **緑**（`結果: 違反なし`。§3.5 に `--list` の実出力） |
| 3 | `go test ./...` | **緑**（`migrate_m3105_test.go` 6 本を含む） |
| 4 | `cd web && pnpm test` | **緑**（`Test Files 224 passed / Tests 2704 passed`。★追補後の再走行） |
| 5 | `make e2e-only P=m14-03b` | **`1 passed`**（ingrid `sun_crest` の ①②③。**A-4 の陽性側**） |
| 6 | `make e2e-only P=combo-custom-states` | **`1 passed`** |
| 7 | `make e2e`（全数） | **緑**（★追補後の最終走行＝**`294 passed`・flaky 0**。以下は Phase C 時点の記録＝`293 passed / 1 flaky`・exit 0。**★flaky は `m31-02-tag-field-drag`**〔ドラッグの文字選択〕**で本サブと無関係であり、リトライで通っている。★同 spec は Phase A の 2 回の全数走行では素通しだった**）。★Phase A の 1 回目は `1 failed / 293 passed` で、**§4.3 の 1 件を直して再走行し `294 passed` を得ている** |
| 8 | `bash scripts/check-import-order.sh` | **緑**（`結果: 違反なし`。**★ベースラインより 2 ファイル少ないという情報が出るが、本サブ由来ではない**＝§4.4） |
| 9 | `bash scripts/check-enum-sync.sh` ／ `check-stop-discipline.sh` ／ `check-doc-refs.sh` ／ `check-browser-storage-keys.sh` | **すべて緑**（列挙は増加なし ／ 停止規律・dead reference・ストレージ台帳いずれも違反なし） |
| 10 | `bash scripts/check-md-emphasis.sh docs/progress/M31-05-completion-report.md` | **緑**（`検出: 0 行`） |
| 11 | `bash scripts/check-progress-log-index.sh` | **★Phase D の索引行を足した直後に回す** |

### 4.1 ★★陽性対照（§2.3-2 / 束 B-1）

`TestRun_M3105_CharacterStateTabNotEmpty` が **同じ DB で投入前後を対にして**測る:

1. `versionBefore(110)` まで上げ、9 キャラのタブ件数を測る。**`dhalsim` / `jp` / `rashid` が 0 件であることを主張する**（★これが陽性対照そのものである。0 でなければ「元から出ていた」ことになり、後の測定が意味を失う）
2. `110` まで上げ、9 キャラすべてでタブが空でないこと・減っていないことを主張する
3. **足した code の 1 本ずつ**が `move_code` に 1 件以上当たることを主張する（★「他の state のおかげで空でない」を通さないため）

**★件数そのものは固定していない**（`SUPP-001` §5.5.4 (6)）。`moves` は今後も増えるためである。**固定したのは「0 → 1 件以上」の向きと「足した code が当たる」ことである。**

### 4.2 ★陰性対照

- `moveSurfacing.test.ts`: **案 (ii) の形（`yoga_arch_set_light` 等 4 本）が 1 件も当たらないこと** ／ **`_set` 単独では語幹化されないこと**
- `customStates.test.ts`: **`options` を持たない `level`（`sun_crest` 相当）が従来どおり数値のまま**であること
- `migrate_m3105_test.go`: **`aki` が `poisoned` 1 件のまま**であること

### 4.3 ★★全数 E2E で 1 件が赤くなった（**直した**）

`web/e2e/m30-01-controller-surfacing.spec.ts:104`「★舞は状態 code の語幹で拾える」が **26 件で固定**していたため落ちた。

**★これは想定内の変化である。** 舞へ `kachousen` を足したことで、語幹 `kachousen` が**焔なしの 9 件**（`kachousen_light` / `kachousen_medium` / `kachousen_heavy` / `kachousen_od` / `kachousen_holding_*` 4 件 / `midare_kachousen`）を新たに拾う。**⇒ 26 ＋ 9 ＝ 35。**

**★既存の `flame_stock` が拾っていた 26 件は 1 件も減っていない**（§2.2 の実測と一致）。**⇒ 期待値を 35 へ更新し、増えた 9 件の内訳を spec のコメントへ残した。「緑にするために合わせた値」ではない。**

**★同 spec の「未分類タブの件数が実 DB で固定である」（jamie 2 / mai 1 / blanka 2 / manon 0）は 1 件も動いていない。** 足した state が拾う技はいずれも既に必殺技タブ・SA タブに載っており、未分類には居なかったためである。

### 4.4 ★`check-import-order.sh` の情報について

同スクリプトは `OK  ベースラインより 2 ファイル少ない → 本スクリプトの BASELINE を 99 へ下げること` を出すが、**これは本サブ由来ではない**（着手基点 `3ee9162` の時点で既に生じていた差である）。**⇒ `--list` には `ComboEditorBasicFields.tsx` の 2 件が載っているが、いずれも着手基点 `3ee9162` の時点から在るものであり、本サブは 1 件も増やしていない**（レビュー側でも `git show 3ee9162:` で確認済み＝レビュー 低-3）。**BASELINE を下げるのは別の手番であり、本サブでは触らない。**

---

## 5. 設計判断とその理由

| # | 判断 | 理由 |
|---|---|---|
| 1 | **`options` は `value_definition` の中に置いた**（`type` の兄弟ではない） | **値の定義であり状態の種別ではない。** `DES-003` §3.2 の `value_definition` は「値の定義。単純な整数・フラグから複数フィールドを持つオブジェクトまで表現可能」と書いており、選択肢はこの節の中身である |
| 2 | **`options` が空配列なら「持たない」と同じに扱う** | 選択肢 0 個の選択 UI は操作できない。**⇒ 数値入力へ落ちる方が壊れない** |
| 3 | **`optionLabelFor` は未定義の値で `undefined` を返す** | 呼び出し側が「ラベルが無ければ数値を出す」へ落ちられるようにするため。**⇒ 値域外の値が入っても画面が空欄にならない** |
| 4 | **表示 3 面は `customStateValueText` という 1 本の関数を通す** | 同じ判断を 3 か所へ書くと、**片方だけ直って「同じコンボが面によって『弱』と『1』で出る」**（`M24-03` レビュー 高-2 と同型） |
| 5 | **`options` 付きのとき値域の `(0〜4)` を画面に出さない** | 数字を覚える形（案 (v)）へ逆戻りするため |
| 6 | **選択の未付与は既定値（min＝「なし」）を選択済みとして見せる** | flag 分岐が `M24-12` §4.12 で決めた「**『未選択』という第 3 の見た目を作らない**」に揃えた |
| 7 | **`down` は NULL だった 3 キャラを NULL へ戻す**（`{"states":[]}` ではない） | `customStates.ts` では同じ挙動になるが、**「定義を持たない」と「空の定義を持つ」は DB 上の別状態**である。往復で形を変えない |
| 8 | **mai の焔版を明示的に持つ**（`flame_stock` との組み合わせで導出しない） | §0.2-2 の開発者の逐語「焔版も扱います」に素直。**★導出にすると「焔ストックが 0 なのに焔版がバウンド中」という組み合わせを画面が許してしまう** |
| 9 | **`moveSurfacing.ts` を 1 文字も変えていない** | §3-7。**データ側で解けた**（`_is_set` は既存の後置語表に在る） |
| **10** | **★★mai を 2 state（通常版 6 択 ／ 焔版 6 択）へ割った**（2026-09-10 開発者判断・レビュー 高-1） | **1 state に 10 変種 ＋「なし」を詰めると選択肢が 11 個になり、開発者裁定「10を超えるものはボタン化の対象外。」**（`D-578(4)`）**の外側へ出る。⇒ 11 個目に数字キーが割り当たらず**（`shortcutKeyForIndex` が `null`）**、roving tabindex は群全体を 1 停止にするため矢印でも移動できない。★マウス以外で選べない状態だった。★型検査・単体・E2E はいずれも緑のまま通っていた。** ★副次的に、通常版と焔版が同時にバウンドしている状況も表せるようになった |
| **11** | **★★`value_definition.single_value` を新設し、本サブが足す int state を 1 欄にした**（2026-09-10 開発者の実機確認） | **①② は `M16-07` がストック系のために足した拡張であり、`custom_states` の原点**（`CHANGE-040`）**は「開始時状態の付与のみを扱う」である。⇒ 設置系をそこへ乗せたのは製造の取り違えだった**（§0.1）。**★格納形は `{start_min, end}` のまま両方へ同じ値を書く**——形を分岐させないことで parse / build / 後方互換の経路をどれも変えずに済む |
| **13** | **`phrase_kind` を撤去した**（追補） | **1 欄になれば固定句そのものが消えるため不要になる。⇒ レビュー 中-2 の是正**（残弾と設置数がラベル上で区別できない）**は保たれたまま、機構が 1 つ減った。★冗長な機構を残さない** |
| **14** | **★イングリッドとダルシムのサンバーストを「レベル / 段階」と「強度」へ割った**（2026-09-10 開発者の要望） | **掛け合わせを 1 state へ詰めるとどちらも 10 択（＋なし込み）で、上限 10 に余白 0 で張り付いていた。⇒ 割ると 4 択 ×2 になり、次に変種が増えても線を越えにくい。★開発者の理由は「入力しやすさ」である** |
| **12** | **`setIntField` は正規化後が既定なら state ごと消す**（レビュー 中-3） | **保存内容は元から同じ**（`buildSituation` が既定値を落とす）**が、離脱ガードは基本情報の生の値を見る。⇒ 「なし」を確認のつもりで押しただけで確認ダイアログが出ていた** |

### 5.1 ★退けた案（**後任が同じ検討を繰り返さないため**）

| 案 | 退けた理由 |
|---|---|
| **kimberly を案 (ii)（変種別フラグ 6 本）で表す** | **開発者の逐語は「設置数」であり、個数を指している。⇒ フラグでは同じ強度を 2 つ置いた場合の個数が落ちる**（2026-09-10 開発者確認） |
| **kimberly を変種別 `stock` 6 本で表す**（「どの強度を何個」を両立させる形） | **画面に 6 欄 × ①② ＝ 12 個の数値入力が並ぶ。⇒ 開発者が求めた「設置数」1 つに対して代償が大きい。★ただし「どの強度を何個置いたか」は原理的にこの形でしか表せない**——必要になったら追随マイグレで足せる |
| **舞の焔版を `flame_stock` との組み合わせで導出する** | **「焔ストックが 0 なのに焔版がバウンド中」という組み合わせを画面が許してしまう**（§5-8） |
| **選択肢が 10 を超えたらプルダウンへ落とす分岐を足す** | **`optionButtons.ts` の設計意図**（ボタン化するかは欄ごとに人が決める・実行時に個数から自動で切り替えない）**を変える。⇒ 設計卓の裁定が要るため、製造の手番では採らない** |

---

## 6. ★★推測で進めた箇所（`CLAUDE.md` §9-3）

**★該当 state のマイグレコメントへも 1 行ずつ落としてある**（§9-3 は「コード内コメントまたは出力メッセージで明示する」と定めており、完了報告だけでは足りない）。

**★★2026-09-10 の開発者の実機確認で 3 件が解消した**（§0）。**⇒ 残る推測は 1 件だけである。**

| # | 推測 | 状態 |
|---|---|---|
| 1 | ~~kimberly の設置数の上限を 3 とした~~ | **★確定した**（2026-09-10 開発者の実機確認＝「0〜3」） |
| 2 | ~~`departure_is_set` の語幹が `departure_shadow` / `departure_window` にも当たる~~ | **★確定した**（2026-09-10 開発者の実機確認＝「乗っていい」） |
| 4 | ~~ingrid の 9 択の並び~~ | **★論点が消えた**（追補で「レベル」と「強度」の 2 state へ割ったため） |
| **★3** | **mai の `kachousen` の語幹が非ホールド版（`kachousen_light` 等）にも当たる** | **★推測のまま。** バウンドしない版もタブに載るが、同じファミリーであり無関係ではない。**`characterStateMoves` は元から「状態を発生させる技そのもの」を落とさない設計であり**（`moveSurfacing.ts` の逐語）**、同じ流儀に揃えた** |

---

## 7. ■ 併せて更新が要るもの

| # | 何を | 状態 |
|---|---|---|
| **1** | **CHANGE 番号の消費** | **0 本。** `DES-003` §3.2 への **CHANGE は請求のみ**で、**起票は設計卓**である（`D-293`）。**⇒ `change-number-registry.md` §1 への登録は無い**（払い出していないため） |
| **2** | **消費したマイグレ連番** | **`000110` の 1 本。** ボード §2.2 の「次に払い出す番号」は **`000111`** になる。**★設計卓の手番**（製造はボードを編集しない） |
| **3** | **★★マージ順** | **`M35-02`（`000108`）と `M31-04`（`000109`）を先に着地させること。** 本サブが先に入ると、既存 DB では後続の 2 本が適用されない（`golang-migrate` の version は単調） |
| **4** | **版を上げた文書** | **なし。** 指示書・チェックリスト・設計書のいずれも編集していない |
| **5** | **`web/CLAUDE.md` の台帳** | **なし。** ブラウザストレージのキーは 1 つも増やしていない |
| **6** | **★★`DES-003` §3.2 への反映（CHANGE 請求 3 点）** | **★要る。⇒ 設計伝達レポート（`/design_handover_report`）へ書く**（束 E-1）。**(1)** `value_definition.options`（ラベル付き選択肢）の追加 ／ **(2) ★同節の「設置技が置かれた状態から始まるコンボ → `subject: self`, `type: flag`」が as-built で失効した**——投入 14 件のうち `flag` は 3 件だけで、10 件が options 付き `level`、1 件が `stock` である（**★動作は正しいままでテストも lint も緑になる。⇒ 人が読む以外に見つける経路が無い**＝レビュー 高-2） ／ **(3) ★`value_definition.single_value`**（int state を 1 つの値として扱う。**⇒ 追補で `phrase_kind` の請求と差し替えた**＝§0.1） |
| **8** | **★語幹がタブに当たらない state が 3 件になった**（§0.2） | **実害は 0 件**（兄弟が担保・テストで固定）**だが、`M30-01` 完了報告 §6 の「案 D＝state 定義に技コードの接頭辞を持たせる」の必要性がそのぶん増えた。⇒ 設計伝達レポートへ載せる** |
| **7** | **★指示書の分岐表からの逸脱 2 件**（レビュー 中-1） | **kimberly を案 (ii) でも案 (vi) でもない `type: stock` にした**（指示書 §2.1 は「実査 5 が『居る』なら案 (ii)」と指示していた） ／ **ingrid の選択肢を 9 択にした**。**★どちらも 2026-09-10 の開発者確認によるが、裁定番号もボードの行も無い。⇒ 設計伝達レポート §2 へ書き、設計卓に裁定番号を払わせる** |

---

## 8. レビュー結果

| 項目 | 値 |
|---|---|
| 指摘件数 | **15 件** |
| 優先度別内訳 | **高 3 ／ 中 6 ／ 低 6** |
| 採否 | **15 件すべて採用** |
| **「高」指摘の不採用** | **0 件**（★エスカレーション事項なし） |
| 開発者判断（ハード列）へ回した件 | **2 件**——高-1（舞の 11 択の畳み方）／ 中-2（キンバリーのラベル）。**どちらも 2026-09-10 に回答を得て実装済み** |
| 再レビュー往復 | **0 回**（初回のみ。停止規律の上限 2 回に達していない） |
| レビュー報告書 | `docs/progress/M31-05-review.md`（**★末尾に「## 取り込み結果（自動トリアージ）」を追記してある**） |

### 8.1 ★レビューが独立に検算した範囲

レビュアーは v107 / v110 の DB を**別途組み立てて**、本報告 §2 の数値を全件再現している。**⇒ 1 件の食い違いも無かった。**

- 既存 state の**欠落 0 件・改変 0 件**（SF6 全キャラで突合。変化は 9 キャラの末尾追加のみ）
- `down` で v107 と**完全一致**（`NULL` 3 体を含む）
- タブ照合の before → after、追加 code の単独ヒット数、案 (ii) が 0 件、`_set` 単独が 0 件

### 8.2 ★★レビューが見つけた最大のもの

**舞の選択肢が 11 個で、開発者裁定「10を超えるものはボタン化の対象外。」**（`D-578(4)`）**の外側に出ていた**（高-1）。**⇒ 11 個目「焔乱れ」に数字キーが割り当たらず、`OptionButtonGroup` の roving tabindex は群全体を 1 停止にするため矢印でも移動できない。★マウス以外で選べない状態だった。**

**★型検査・単体・E2E はいずれも緑のまま通っていた**——新しい分岐が `shouldButtonizeOptions` を呼ばないため、線引きを固定しているテストの射程外に居たからである。**⇒ 2 state へ割ったうえで、`optionButtons.test.ts` の「実際の欄の個数」表へ今回の 7 欄を追記した**（次に選択肢を増やす人が線を越えたことに気づけるようにするため）。

---

## 9. 完了条件の充足

| # | 条件 | 状態 |
|---|---|---|
| 1 | 段 1 の実数と実測が示されている | **○**（§2.1 / §2.2。案 (vi) は成立したため止めていない） |
| 2 | 段 1-2 の実測（タブの照合）が示されている | **○**（§2.2） |
| 3 | 9 体ぶんの state が入っている・`aki` には入れていない | **○**（§3.2 / §3.4） |
| 4 | 既存の state が 1 つも消えていない | **○**（§3.3。機械検査あり） |
| 5 | `_data_` が入り層 B と判定される | **○**（§3.5） |
| 6 | 9 体それぞれタブが空でないことが陽性対照とセット | **○**（§4.1） |
| 7 | §5 の検査がすべて緑 | **○**（§4。`go test` 緑 ／ `pnpm test` 224 files・**2704 tests** 緑 ／ `make e2e` **294 passed・flaky 0** ／ 常設検査すべて緑） |
| 8 | 完了報告 ＋ progress-log の索引行 | **○**（Phase D で追記し `check-progress-log-index.sh` が緑） |
| 9 | 完了報告を `check-md-emphasis.sh` に通す | **○**（`検出: 0 行`。★フェンス内の逐語引用による偽陽性も出ていない） |
| 10 | 設計伝達レポートを出す（**CHANGE 請求 4 点**を含む） | **○** `docs/handover/design-reports/20260910-m31-05-design-exceptions.md` |
| **★11** | **開発者の実機確認** | **○ 2 巡とも通過**（2026-09-10。1 巡目で 5 点の是正指示 → §0 で反映 → 2 巡目で**全項目 問題なし**）。**⇒ 確認待ちの項目は 1 件も無い** |

---

*以上、M31-05 完了報告。*
