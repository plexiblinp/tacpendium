# M11 custom_states 定義データ(確定版)

| 項目 | 内容 |
|------|------|
| 文書種別 | 補足資料(M11 作業用リファレンス。CHANGE 通知書対象外・自由改訂) |
| バージョン | 0.2.0 |
| 作成日 | 2026-06-20 |
| 作成者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 位置づけ | 開発者提供(2026-06-20)の custom_states 定義データ確定版。M11 の付与/表示 UI 指示書・seed 定義投入・CHANGE-040 が参照する一次データ。**正典化は CHANGE-040 で DES-003 へ反映する時点で確定**(本書は作業用の集約) |
| 前提 | DES-003 §3.2(custom_states 構造定義)、phase2-overview §M11、M11-RESEARCH-01 報告(現状裏取り)、設計判断 D-A〜D-D(2026-06-20 開発者確定) |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 0.1.0 | 2026-06-20 | 初版。開発者提供データを型確定後の形で集約(Boolean 8 / Int 8) |
| 0.2.0 | 2026-06-20 | 設計判断 D-A〜D-D 確定を反映。(1) Int 全8状態の min/max を確定記載(§2)、(2) 先行リリース3体の code を確定(§3)、(3) Int 入力仕様(-/e/. 拒否・最大値ヒント)を §4.1 に新設、(4) データ駆動 UI 方針(全キャラ通用・seed は3体)を §5 に明記、(5) 決定記録 §0 を新設 |

---

## 0. 決定記録(2026-06-20 開発者確定)

| ID | 決定 |
|----|------|
| D-A | UI 呼称 = 案1。custom_states 用に新セクション「キャラ固有状態」を立て、既存「状況」(独立カラム)はそのまま。i18n キーも別系統 |
| D-B | Int 付与 = 案1(自由入力・専用バリデータは作らない)。ただし入力コントロールは min/max を尊重(スピナー/手動入力の最大値に注意)、かつ `-` / `e` / `.` を入力不可(既存ドライブゲージ等と同方式)。**全キャラ分の定義を先行整備**(UI はデータ駆動、テスト対象はイングリッドのみ) |
| D-C-1 | seed 定義投入対象 = 先行リリース3体(ryu / ingrid / c_viper)に限定 |
| D-C-2 | aki / jamie / guile(phase-1 耐久 seed 由来・先行リリース対象外)は M11 で触らない(jamie の既存 `drunk_level`/composite は据え置き、M12-02 の seed 整理対象) |
| D-C-3 | code 確定: リュウ `denjin_charge` / イングリッド `sun_crest` / C.ヴァイパー `limit_decoupler` |
| D-D | サブユニット = 案1(単一 M11-01。seed + 付与 + 表示)。Opus + Plan Mode 必須。**「D-C-4.案A」を D-D 案1 と解釈**(要追認) |

---

## 1. 目的・位置づけ

開発者提供の custom_states 定義(キャラ固有の開始時状態)を型・code・範囲の確定形で集約する。M11 = 開始時状態の**付与・表示・参照のみ**の機能化(消費は非モデル化、利用者が notes 管理)。本書は付与/表示 UI 指示書・seed 定義投入・CHANGE-040 の参照元。`custom_states.code` は DES-003 §6「実装時に開発者と協同で決定」に従い、先行リリース3体は §3 で確定、その他は §2 で案を併記する。

---

## 2. 確定定義表(全 16 状態 / 14 キャラ)

> 型: **Boolean**(使用で解除される install / フラグ型 → トグル)/ **Int**(ストック・レベル → 数値入力。ストックが尽きない限り強化状態継続)。subject は明記行以外すべて `self`。「消費の性質」列は**参考情報**で M11 では非モデル化(notes 管理)。先行リリース対象=クラシック5体の状態保有行に ★。`code` は先行リリース3体が確定、他は案。

| キャラ | 日本語名 | 英語名 | 型 | code | Int 範囲 | subject | 消費の性質(参考・非モデル化) | 先行 |
|--------|---------|--------|----|------|---------|---------|------------------------------|:---:|
| ジェイミー | 酔いレベル | Drink Level | Int | `drink_level`(案) | 0–4 | self | 技使用で減算されない(Lv で技変化、本フェーズ非対象) | |
| ジェイミー | 絶唱魔身(SA2強化中) | The Devil's Song (install SA2) | Boolean | `devils_song`(案) | — | self | 時間+技でゲージ減・ゼロで解除(複雑なため Boolean) | |
| マノン | メダルレベル | Medal Level | Int | `medal_level`(案) | **1–5** | self | 技使用で減算されない | |
| キンバリー | 手裏剣ストック | Shuriken Bomb Stocks | Int | `shuriken_bomb_stocks`(案) | 0–2 | self | 技使用で減算 | |
| リリー | 風纏い | Windclad | Int | `windclad`(案) | 0–3 | self | 技使用で減算 | |
| ジュリ | 風破ストック | Fuha Stocks | Int | `fuha_stocks`(案) | 0–3 | self | 技使用で減算 | |
| ジュリ | 風水エンジン | Feng Shui Engine | Boolean | `feng_shui_engine`(案) | — | self | 時間+技でゲージ減・ゼロで解除(複雑なため Boolean) | |
| リュウ | 電刃錬気 | Denjin Charge | Boolean | **`denjin_charge`** | — | self | 技使用で解除 | ★ |
| 本田 | 肩屋入り | Sumo Spirit | Boolean | `sumo_spirit`(案) | — | self | 技使用で解除 | |
| ガイル | ソリッドパンチャー | Solid Puncher | Boolean | `solid_puncher`(案) | — | self | 時間+技でゲージ減・ゼロで解除(複雑なため Boolean) | |
| ブランカ | ブランカちゃん人形 | Blanka-chan Bomb | Int | `blanka_chan_bomb`(案) | 0–3 | self | 技使用で減算 | |
| ブランカ | ライトニングビースト(SA2強化中) | Lightning Beast (install SA2) | Boolean | `lightning_beast`(案) | — | self | 時間+技でゲージ減・ゼロで解除(複雑なため Boolean) | |
| 舞 | 焔ストック | Flame Stock | Int | `flame_stock`(案) | 0–5 | self | 技使用で減算 | |
| C.ヴァイパー | バウンサーステップ(SA1強化中) | Limit Decoupler (install SA1) | Boolean | **`limit_decoupler`** | — | self | 時間+技でゲージ減・ゼロで解除(複雑なため Boolean) | ★ |
| イングリッド | サンシンボル | Sun Crest | Int | **`sun_crest`** | **0–4** | self | 技使用で減算(ストックが尽きるまで強化状態継続) | ★ |
| アキ | 毒状態 | Poisoned state | Boolean | `poison`(既存 seed) | — | **opponent** | 技ヒットで解除。相手の状態だがアプリ上は通常状態同様に扱う | |

集計: Boolean 8 / Int 8。subject=opponent は アキ「毒状態」1件のみ。Int 8状態の範囲は本表で全確定。

> マノン メダルレベルのみ **min=1**(他の Int は min=0)。DES-003 §3.2 の例示 `medal_level`(min:1, max:5)と一致。

---

## 3. 先行リリース対象の状態(seed 投入対象 = 3体、D-C-1)

先行リリース対象はクラシック5体(リュウ / ケン / イングリッド / C.ヴァイパー / ダルシム)。状態保有は **3体**。**ケン・ダルシムは状態なし**。**M11 の characters.custom_states 投入はこの3体のみ**(他キャラは行が存在しないか対象外。定義は §2 に参照保持)。

| キャラ(code) | 状態 | code | 型 | value_definition | M11 付与 UI |
|--------------|------|------|----|-----------------|-----------|
| ryu | 電刃錬気 / Denjin Charge | `denjin_charge` | Boolean(flag) | `{ "kind": "boolean" }` | トグル |
| ingrid | サンシンボル / Sun Crest | `sun_crest` | Int(level) | `{ "kind": "integer", "min": 0, "max": 4 }` | 数値入力(0–4) |
| c_viper | バウンサーステップ(SA1強化中) / Limit Decoupler (install SA1) | `limit_decoupler` | Boolean(flag) | `{ "kind": "boolean" }` | トグル |

- **付与 UI(案B)は Boolean と Int の両方を、先行リリース5体だけで E2E 検証できる**(リュウ/ヴァイパー=Boolean、イングリッド=Int)。
- 「電刃」は **リュウの状態(電刃錬気 / Denjin Charge = Boolean)**。ケンの状態ではない。
- **ryu の現状は seed 000003 で `'{}'`(空オブジェクト=phase-1「固有状態なし」前提)。M11 はこれを `denjin_charge` 定義へ置換(UPDATE)する**(前向き注意 M10-2/M10-5 の型)。ingrid/c_viper は現状 NULL → 新規投入。

### 3.1 characters.custom_states 投入 JSON(3体・確定)

```json
// ryu
{ "states": [ { "code": "denjin_charge", "name_ja": "電刃錬気", "name_en": "Denjin Charge",
  "subject": "self", "type": "flag", "value_definition": { "kind": "boolean" } } ] }
// ingrid
{ "states": [ { "code": "sun_crest", "name_ja": "サンシンボル", "name_en": "Sun Crest",
  "subject": "self", "type": "level", "value_definition": { "kind": "integer", "min": 0, "max": 4 } } ] }
// c_viper
{ "states": [ { "code": "limit_decoupler", "name_ja": "バウンサーステップ(SA1強化中)", "name_en": "Limit Decoupler (install SA1)",
  "subject": "self", "type": "flag", "value_definition": { "kind": "boolean" } } ] }
```

---

## 4. 付与・値の扱い

### 4.1 Int 入力仕様(D-B 確定)

- **自由入力**(専用バリデータは作らない=検証非構築の方針)。ただし以下の入力コントロール制約を設ける:
  - **min/max を尊重**: `value_definition.min`/`max` を数値入力の下限/上限に用いる(スピナー・手動入力とも最大値を超えさせない)。範囲は §2/§3 の確定値。
  - **`-` / `e` / `.` を入力不可**(整数・非負のみ)。**既存のドライブゲージ/SAゲージ開始残量入力(`drive_available_at_start` 0–6 / `sa_available_at_start` 0–3)と同じ入力弾き方を踏襲**(製造担当が当該既存実装を確認し同方式で実装)。
- 値が既定(off / 0)のときの situation への格納方式(キー省略 or 明示)は付与 UI 指示書で確定(situation を冗長化しない方針で省略寄り)。

### 4.2 値の格納先(situation の custom_states キー)

- 付与値は `combos.situation`(TEXT、JSON 文字列)の `custom_states` キー配下に格納。例:
  - Boolean: `{ "custom_states": { "denjin_charge": true } }`
  - Int: `{ "custom_states": { "sun_crest": 3 } }`
- situation は現状フロントで未送信(M11-RESEARCH-01 FU-1)。M11 で `buildCreatePayload` / `buildPatchPayload` / `runPut` に situation 組立を追加し、edit/copy 時は `initialBasic` で既存 situation を読み込む(round-trip)。

---

## 5. M11 スコープ上の注記

- **消費は作らない**(フェーズ3まで・D-B/Q3)。Int の「減算/されない」・Boolean の「解除」挙動は非モデル化、利用者が notes 管理。付与 UI は「開始時点の状態」を入力するのみ。
- **付与 UI はデータ駆動**(D-B): 選択キャラの custom_states 定義(`states[]`)を読み、`type=flag`→トグル、`type=level`/`stock`(int)→数値入力で動的描画する。**全キャラに通用**(将来キャラ追加時も定義投入のみで動く)。**未対応 type(例: composite)は描画をスキップ**(jamie の既存 composite seed に当たっても落ちない防御。jamie は対象外=D-C-2)。取得経路は既存 `useCharacters`(queryKey `["characters",{gameId}]`)の戻り `Character[].customStates`(M11-RESEARCH-01 FU-3)。新規 API/フックは不要。
- **seed 投入は3体限定**(D-C-1)。マノン/キンバリー/リリー/ジュリ/ブランカ/舞 はキャラ行が存在せず投入不可(§2 は将来追加時の参照データ)。ジェイミー(行あり・対象外)は据え置き(D-C-2)。

---

## 6. 未解決・要確認(継続確認事項)

- **英語名の英語コミュニティ整合**(開発者:「指摘あれば直す」とした項目): install 表記(`The Devil's Song (install SA2)` / `Lightning Beast (install SA2)` / `Limit Decoupler (install SA1)`)、`Drink Level`、`Shuriken Bomb Stocks` 等。英語ロケール整備(フェーズ3)時に再点検。本フェーズ表示は日本語が主(NFR307)のためブロッカーではない。
- **非先行リリース状態の code**(§2 の「案」): 将来そのキャラを追加・投入する時点で DES-003 §6 に従い確定。M11 では先行リリース3体のみ確定(§3)。
- **本田「肩屋入り」**: 日本語綴りの確認(参考。開発者提供のまま記録)。
- **DES-003 §3.2 例示の扱い**: 現行例(medal_level / poison / solid_puncher / drunk_level)を本確定リストへ正典化するか据え置くかを CHANGE-040 で判断。jamie の `drunk_level`/composite は D-C-2 により M11 では触らない。

---

## 7. 関連ドキュメント

| 文書 | 関連 |
|------|------|
| DES-003 §3.2 / §3.x situation | custom_states 構造定義 / 値の保持先 |
| DES-005 §5.6 / §5.7 | 表示・付与 UI(M11 機能化対象、新セクション「キャラ固有状態」= D-A) |
| DES-006 | custom_states 入力は検証しない旨を明示追記(CHANGE-040) |
| phase2-overview §M11 | M11 スコープ(boolean 中心・消費非モデル化) |
| M11-RESEARCH-01 報告(+ FU-1〜4) | 現状裏取り(スキーマ・データ・UI 不在・フォーム機構・取得経路) |
| architecture-patterns §9.1 | custom_states 現状・消費非構築方針(v1.0.16) |
| model-allocation §M11 | M11-RESEARCH-01 = Sonnet / M11-01 = 着手時(Opus 想定) |

---

*以上、M11 custom_states 定義データ(確定版)v0.2.0。配置案 `docs/handover/m11-custom-states-definitions.md`。*
