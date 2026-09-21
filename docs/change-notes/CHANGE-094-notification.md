# CHANGE-094 通知書: セットプレイ提案の候補集合と費用規則の変更（M19-05 消費側）

| 項目 | 内容 |
|------|------|
| CHANGE 番号 | **094**（`change-number-registry` を 2026-08-09 に実査して払い出し。092＝欠番〔D-239〕／093＝反映済） |
| 状態 | **採番済**（**反映済ではない**。DES 本体への反映は設計卓が三点セットで確定する） |
| 起票 | 製造担当 Claude Code（M19-05） |
| 対象サブ | **M19-05 消費側**（段階 A・B のみ。**段階 C と R6 警告はスコープ外**＝`M19-05-PLAN-MODE-RULINGS` v1.1.0 の D-260／D-261／D-262） |
| スキーマ変更 | **なし**（`moves` のデータ変更 0 行・`move_derivations` への行追加なし） |
| マイグレ | **非消費**（`migrations/` に新規ファイルなし） |
| 影響設計書 | **DES-002 §4.2**（提案挙動）／**DES-005 §5.6 項目12**（制約告知の文面）。**DES-003 は変更なし**（列の定義・値域は M19-04＝CHANGE-091 で確定済み。本 CHANGE は消費側の規則のみ） |
| 設計正本 | `M19-DESIGN-07` v1.7.0 §2-1・§2-2・§3・§5-3・§5-4・§9-1・§9-4 ／ `M19-DESIGN-08` v1.2.0 §1 |
| 実装 | commit `90e1008`（段階 A）／`4dc6205`（段階 B） |

---

## 1. 変更の概要

M19-04 と Phase 2 で `moves` に投入された 4 本の資産（`startup_basis` / `chain_cancel_total` /
`fastest_unreachable` / `move_derivations`）は、契約 F-3 により**エンジン・API から一度も
読まれていなかった**。本 CHANGE でその消費が始まり、セットプレイ提案の挙動が 3 点で変わる。

| # | 変更 | 効果 |
|---|---|---|
| 1 | **filler 候補規則の 2 ゲート化** | 候補 1482 → 1470 行 |
| 2 | **費用規則 4 分類と合成 filler 単位** | **実機で入力できないレシピの是正**（リュウ立弱P×2 は 26F でなく 22F） |
| 3 | **target ゲートの切替と through target 解禁** | 候補 903 → 937 行。**GC-2 が通り golden 5/5** |

**恒等式 `S = Σcost(i)` / `N = KA + 2 − S` / `G = N − active` は不変**であり、新しい式は
持ち込んでいない。エンジン（`internal/service/setplay/setplay.go`）は無改修＝**区分 2**。

---

## 2. 変更の内容

### 2.1 filler 候補規則（段階 A・`M19-DESIGN-08` §1 ／ `M19-DESIGN-07` §5-3・§5-4）

**旧**: `total >= 1 AND category != 'target_combo'`

**新**:

```
total >= 1
  AND NOT (category = 'target_combo' AND is_derived = 1)          -- ゲート 1
  AND NOT (startup_basis IN ('standalone','unknown')
           AND EXISTS(SELECT 1 FROM move_derivations d
                      WHERE d.child_move_id = moves.id))           -- ゲート 2
```

- **ゲート 1** は「`category` を外す」ではなく「`category` を `is_derived` へ置き換える」。
  空振りでも出るパターン 3 だけが候補に入り、前段のヒット／ガードを要するパターン 1／2 は
  引き続き除外される。
- **ゲート 2** は設計過程で発見された既存の穴の是正（単独入力不可の除外が無かった）。
  該当行はチェーン合成・表記展開の経由でのみ登場する。

**実測（2026-08-09・マイグレ v68・17 キャラ seed 済み）**:

| 区分 | 件数 |
|---|---:|
| 緩和（新たに候補入り） | **4**（zangief `machine_gun_chops` / `machine_gun_chops_2hits` / `power_stomps` / `power_stomps_2hits`） |
| 維持（除外され続ける） | **76**（`target_combo` 全 80 のうち `is_derived=1`） |
| ゲート 2 で除外 | **16**（`standalone` 由来 11 ／ `unknown` 由来 5） |
| filler 候補の総数 | **1482 → 1470** |

> **★設計文書の「`target_combo` 67 行・維持 63 行」は 11 キャラ時点の値**であり、第三波 6 キャラの
> seed 後は 80 / 76 である。**件数固定テストは実測値で書いた**（`M19-DESIGN-07` §4-3 の規約・D-259）。

### 2.2 費用規則 4 分類と合成 filler 単位（段階 B・`M19-DESIGN-07` §2-1・§2-2）

| # | 条件 | `cost(i)` | 実装 |
|---|---|---|---|
| 1 | i が target 直前の**表記用親** | **0** | 前置した親ステップを `role=parent` / `counted=false` とし S に加算しない |
| 2 | i と i+1 が**同一チェーングループ員として隣接** | **`chain_cancel_total(i)`** | 合成 filler 単位の Total に内包 |
| 3 | i が **target**（最終ステップ） | **`startup(i)`** | 既存（`through` は通し値のまま） |
| 4 | その他（単発 filler・チェーン末端） | **`total(i)`** | 既存 |

**合成 filler 単位**: チェーングループ（`chain_cancel_total` が非 NULL）から長さ 2〜k の連鎖列を
疑似 filler として合成し、既存 subset-sum へそのまま渡す。
**単位 total ＝ Σ(非末端の `chain_cancel_total`) ＋ 末端の `total`**。機械合成・追加実測不要。

- **2 番目以降の位置**には「単独入力不可のグループ員があればその集合、無ければグループ全員」を置く。
  **キャラ名でなく性質で書いた**ため、ザンギエフ連打版 3 行はこの一般則だけで 2 番目以降に入り、
  **特例が要らない**（`M19-DESIGN-07` §9-1 の実測性質 ①②）。差し込んだ行自身の値を費用規則が読む。
- **k は budgetCap（= KA + 2）で自然に有限**。`maxChainLen` は病的入力向けの後段防御。
- **`rush_variant` には新規の手を入れていない**（§8.3「壊れていないものを直さない」）。

### 2.3 target ゲートの切替・through target 解禁・表記展開（段階 B・`M19-DESIGN-07` §3）

| 軸 | 旧 | 新 |
|---|---|---|
| 空中 | `is_aerial = 1` を除外 | **`fastest_unreachable = 1` を除外** |
| 派生 | 非 rush の `is_derived = 1` を除外 | **単独入力不可を除外 ＋ 非 rush かつ `is_derived=1` で `startup_basis != 'through'` を除外** |

**★`through` 以外の派生技（状態変種 standalone）は除外を維持する。** `M19-DESIGN-07` §9-4 が
「状態変種 standalone の target 除外は**暫定 `is_derived` ゲート継続**」と明記している範囲である。
**ここを外すと `denjin_charge_*` / `flame_*` / `mine_set_*` / `drink_level_*` / `windclad_*` 等の
状態前提技が一斉に target へ入る（実測 +172 行）。**

**表記展開**: `startup_basis='through'` かつ親参照を持つ技の**直前に親ステップを 1 つ前置**する
（role 非依存。filler に使う解でも同じ）。前置した親は**計上ゼロ**＝費用規則の分類 1。
格納（`setup_steps`）も展開後の表記順で親行を含む。

**実測**:

| 区分 | 件数 |
|---|---:|
| 解禁（新たに target 入り） | **57**（全件 `startup_basis='through'`。うち `kimberly/elbow_drop` の 1 行だけが `is_derived=0` で、`is_aerial` → `fastest_unreachable` の切替側で解禁） |
| 除外（target から外れる） | **23**（全件 `fastest_unreachable=1` ＝ B 型の誤提案。理由は一本） |
| target 候補の総数 | **903 → 937** |

---

## 3. 判断の根拠

### 3.1 `is_aerial` を軸から外す理由

`is_aerial` の実セマンティクスは「空中技か」ではなく「**通常技と特殊技でラッシュ版を作るか否か**」で
あり（D-222）、target 可否の軸ではない。「単独で最速入力しても地上の相手に当てられない」という
**事実そのもの**を持つ列が `fastest_unreachable` である（`M19-DESIGN-07` §3）。
除外 23 行は「従来 `is_aerial=0` のため target に出ていたが、実機では最速で当たらない」行であり、
**誤提案の是正**にあたる。

### 3.2 `is_derived` ゲートを `through` 限定で解禁する理由

`M19-DESIGN-07` §5-3 の「除外条件を `basis=unknown` のみへ狭められる」は **filler 側の `category`
ゲート**についての記述であり、同項の 2026-08-02 errata が「**緩和するのは `category` ゲートだけで
`is_derived` ゲート（§9-4）は継続する**」と明記している。target 側で `is_derived` ゲートを
全面撤去すると §9-4 に反する。

### 3.3 `through` 行の `total` も通し値である、という前提の所在

`through` の技を**単発 filler** に使うとき、費用は分類 4 ＝ `total` である。この `total` が
**通し値**であることの根拠は **`M19-DESIGN-02` §3**（「through の技を filler に使う場合は
通し `total`〔例: 紫電 51〕で計上可」「計上は通し `total` 1 つ」）にある。

**★`DES-003` §3.3 の `startup_basis` は「格納されている `startup` の由来」しか定義していない**ため、
正典だけを読むと `total` 側の根拠が辿れない。**反映時にこの所在を残すこと。**

### 3.4 CSV・seed・マイグレを触らない理由

本サブは**消費側**であり、値は M19-04 と Phase 2 で投入済みである。
`moves` のデータ diff 0 ／ `internal/seedgen/` diff 0 ／ golden 未再生成 ／
`migrations/` に新規ファイルなし（指示書 §0.2「解除しないもの」）。

---

## 4. 影響範囲・移行影響・リスク

| 対象 | 影響 |
|---|---|
| `GET /api/combos/:comboId/setplay-suggestions` | **応答の中身が変わる**（候補集合・費用・ステップ列）。**JSON スキーマは不変**——`role` の値域は M19-02 時点で `"filler" \| "target" \| "parent"` が定義済み、`counted` も既存フィールドである |
| 保存済み `combo_setups` | **移行不要**。既存レコードは読み替えない |
| `recipe_hash` | **表記展開により、親ステップを含む提案の hash は親なしの同型レシピと別値になる**。`alreadyAdopted` は「同じ表記のものだけ既存と判定する」という既存基準どおりに働く。**★ただし M19-05 以前に採用済みの setup（親行なし）は、同じ意味のレシピでも `alreadyAdopted` にマッチしない**——実害は「同じ意味の setup を二重に採用できてしまう」に留まり、既存データは壊れない |
| `internal/service/punishfinder/` | **diff 0**。契約 §3.2 と F-1 の解除を使わなかった |
| FE | i18n `setplay.limitations.*` の 3 キーを更新（`_marker` / `outOfScope` / `weakChain`）。**コンポーネントの改修なし** |

**リスク**: 提案件数が増えるキャラ（jamie・ken・kimberly・marisa 等の through 派生技を持つキャラ）で
target が増える。**打ち切りは M19-02 でランキング後に是正済み**のため、増分は上位表示の外に落ちる。

---

## 5. 直列化・後続

| # | 内容 | 送り先 |
|---|---|---|
| 1 | **DES-002 §4.2 / DES-005 §5.6 項目12 への反映** | **設計卓**（三点セット。製造は DES 本体を編集しない） |
| 2 | **別の単位に属するチェーングループ員が隣接する解の除去** | **設計卓の裁定待ち**（判定法が DESIGN-07/08 に未定義。開発者裁定 2026-08-09＝残件として報告）。**★2026-08-09 の実機確認で、単発どうしだけでなく「単発と合成単位の継ぎ目」でも起きることが判明**——判定は「**単位の境界をまたぐ隣接**」で書く必要がある（設計伝達レポート §6-1-1 に実例） |
| 3 | **段階 C（確定反撃の除外）の再設計** | followup `punishfinder-standalone-exclusion-redesign`（D-260） |
| 4 | **R6 警告** | followup `r6-parent-step-consistency-warning`（D-262） |
| 5 | **`ken/thunder_kick` の親参照投入** | followup `gc2-thunder-kick-parent-reference`（D-264。update 波） |
| 6 | **表記展開で親が複数の行の扱い** | followup `notation-expansion-multiple-parents`（推測 2 の承認条件） |

---

*以上、CHANGE-094 通知書 v1.0.0（2026-08-09 起票・**採番済**）。DES 本体は 1 文字も改訂していない。*
