# M11 マイルストーン全体像(M11-overview): custom_states 開始時状態の機能化

| 項目 | 内容 |
|------|------|
| 文書ID | M11-OVERVIEW |
| バージョン | 1.1.0 |
| 作成日 | 2026-06-20 |
| 作成者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 位置づけ | M11 の全体像。phase2-overview §M11 を実作業に分解する。サブユニット構成・主要設計判断・CHANGE 起票予定を確定する(構造は §4.12 に従い開発者合意の上で確定) |
| 前提 | phase2-overview v0.2.0 §M11、m10-to-m11-handover §4/§5、M11-RESEARCH-01 報告(+ FU-1〜4)、m11-custom-states-definitions v0.2.0、設計判断 D-A〜D-D(2026-06-20 開発者確定) |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-20 | 初版。M11-RESEARCH-01(+FU)と設計判断 D-A〜D-D を反映。単一 M11-01 構成を提案 |
| 1.1.0 | 2026-06-20 | M11-01 完了(CHANGE-040/041/042 反映・E2E 確認済)を反映。**M11-02(nullable メタデータの PATCH クリア一般化)を追加**(§3.1/§3.3)。M11-01 の custom_states クリア修正で露見した既存潜在バグの一般解=§5.1 案B(開発者確定)。実装はウォームな M11-01 担当。situation センチネルの扱い・一般解方式(full-replace か presence-detection か)は着手前の小調査+Plan Mode で確定 |

---

## 0. 本書の位置づけ

### 0.1 M11 の位置づけ(フェーズ2 本流スパインの継続)

M10(複数キャラ登録 UI)完了により他キャラのコンボ登録が可能になった。一方 situation(キャラ固有の開始時状態)は汎用入力のまま据え置きで、custom_states は phase-1 で保存/API のみ実装され消費(機能化)は未実装。M11 はこの custom_states の消費を有効化する = **開始時状態(電刃錬気などの boolean / ストック等の int)をコンボに付与・表示・参照できるようにする**。phase2-overview §M11 の正本に従い、boolean 中心・**消費はモデル化せず notes 管理**(アプリでは構築しない。将来の利用者要望次第で検討する可能性はあるが現時点では実装しない)。

### 0.2 M11-RESEARCH-01(+FU)で確定した現状(設計の前提)

| 観点 | 確定事実 | 出所 |
|------|---------|------|
| 物理スキーマ | `characters.custom_states` / `combos.situation` はともに **TEXT**(NULL 可、CHECK/専用 index なし)。論理「JSON」= 物理 TEXT。**スキーマ変更は不要** | RESEARCH §0.1/§1.2 |
| データ現状 | 状態保有3体は**未投入**(ryu=`'{}'` 空オブジェクト、ingrid/c_viper=NULL)。先行リリース5体すべて行は存在 | RESEARCH §0.2 |
| API/参照 | situation は全層 `*string` の素通し。`custom_states` キーをパース/参照する箇所は**0件**。検証も0件 | RESEARCH §0.3 |
| 付与 UI | ComboEditor に situation 入力は**実在しない**(§5.7 表示項目5 のうち situation のみ未描画)。詳細・比較も独立カラムのみ描画 | RESEARCH §0.4 |
| フォーム機構 | ComboEditor は**局所 useState**(react-hook-form 不使用)。`CreateComboRequest` 組立は `buildCreatePayload()`(:144)の単一箇所。situation は現状未送信 | FU-1 |
| 取得経路 | 選択キャラの custom_states 定義は既存 `useCharacters`(queryKey `["characters",{gameId}]`)の戻り `Character[].customStates` に**含まれる**(未使用)。新規 API/フック不要 | FU-3 |
| 命名衝突 | 既存 UI の「状況/situation」ラベルは**独立カラム用に占有済み**(`comboDetail.situation.*` 等) | FU-4 / §0.7 |

---

## 1. M11 のスコープと目的

### 1.1 スコープ(phase2-overview §M11)

| 項目 | 内容 |
|------|------|
| 含む | 開始時状態の**付与**(コンボ登録/編集での入力)・**表示**(詳細/比較)・**参照**。Boolean=トグル / Int=数値入力(案B、データ駆動)。3体への定義 seed 投入 |
| 含まない | 状態の**消費セマンティクス**(コンボ中の減少・レベルで技変化・レシピ反映・**バリデーション連動**)。アプリでは構築しない(利用者が notes 管理。現時点では実装しない) |

### 1.2 目的(M11 完了時に達成される状態)

- コンボ登録/編集で、選択キャラの開始時状態を付与できる(リュウ=電刃錬気トグル、イングリッド=サンシンボル 0–4 数値、C.ヴァイパー=バウンサーステップトグル)。
- 付与した状態がコンボ詳細・比較で表示される。
- 状態を持たないキャラ(ケン/ダルシム等)では付与セクションが現れない(データ駆動)。
- 既存「状況」(独立カラム)とは別の「キャラ固有状態」セクションとして提示される(D-A)。

### 1.3 このマイルストーンで作らないもの(スコープ外)

- custom_states の**消費・検証**(D-B/Q3。アプリでは構築しない=現時点では実装しない)。
- 非先行リリースキャラへの seed 投入(D-C-1。行が存在しない/対象外)。aki/jamie/guile への変更(D-C-2)。
- 英語ロケール整備(フェーズ3)。
- DES-003 の custom_states **構造**そのものの拡張(スキーマ変更不要)。

---

## 2. 主要設計判断(本 overview で確定 / D-A〜D-D)

### 2.1 スキーマ変更は不要 → 付与 = situation の custom_states キー読み書き新設

`combos.situation` は TEXT で既存。M11 は列追加ではなく、situation 文字列内の `custom_states` キーの**読み書きを新設**する(付与時に書き、表示時に読む)。バックエンドは situation を素通しするため、**登録系 API・スキーマは不変**の見込み(フロント完結 + seed)。

### 2.2 付与 UI は新規実装・データ駆動・既存 useState/controlled パターン

situation 入力は未描画のため M11 で新規実装。選択キャラの custom_states 定義(`states[]`)を `useCharacters` の戻りから読み、`type=flag`→トグル / `type=level`/`stock`(int)→数値入力で**動的描画**。ComboEditor の既存 **局所 useState + controlled component**(`ComboEditorBasicFields` の親委譲)パターンに乗せる(react-hook-form は導入しない)。未対応 type(composite 等)は描画スキップ(jamie の既存 composite seed に当たっても落ちない防御)。

### 2.3 UI 呼称 = 新セクション「キャラ固有状態」(D-A=案1)

custom_states は新セクション「キャラ固有状態」として提示し、既存「状況」(独立カラム)はそのまま。i18n キーも別系統(既存 `comboDetail.situation.*` / `compare.row.situation` と衝突回避)。

### 2.4 Int 付与 = 自由入力 + 入力コントロール制約、消費非モデル化(D-B=案1)

専用バリデータは作らない。ただし数値入力は (1) `value_definition.min`/`max` を下限/上限に尊重(スピナー・手動とも最大超過させない)、(2) **`-` / `e` / `.` を入力不可**(既存ドライブ/SAゲージ開始残量入力と同方式を踏襲)。Int 全8状態の範囲は m11-custom-states-definitions §2 で確定。付与 UI は全キャラ分をデータ駆動で扱う(テスト対象はイングリッド)。

### 2.5 seed = 3体限定、ryu の `'{}'`→電刃 置換(D-C)

`characters.custom_states` 投入は ryu / ingrid / c_viper の3体(D-C-1)。**ryu は phase-1 seed 000003 の `'{}'`(「固有状態なし」前提)を `denjin_charge` 定義へ置換(UPDATE)**(前向き注意 M10-2/M10-5 の型)。ingrid/c_viper は NULL→新規投入。code 確定(D-C-3): `denjin_charge` / `sun_crest` / `limit_decoupler`。aki/jamie/guile は触らない(D-C-2)。投入 JSON は定義書 §3.1。

### 2.6 サブユニット = 単一 M11-01(D-D=案1。「D-C-4.案A」を本案と解釈・要追認)

seed + 付与 + 表示を単一 M11-01 で実施(§3)。custom_states は一機能で密結合し、新規プラミングが少ない(API/フック不要)ため単一で収まる。

### 2.7 §4.11 既知制約(消費非構築の利用者帰結)

開始時状態は**付与のみ**で、コンボ進行に伴う状態変化(減少・解除)は**アプリが追跡しない**。利用者はコンボ中の状態変化を notes で補足する。これは穴ではなく方針(アプリでは構築しない=現時点では実装しない)であり、付与 UI 側で消費の穴埋めをしない。

---

## 3. サブユニット分割

### 3.1 分割方針(単一 M11-01、D-D=案1)

| サブ | 名称 | 内容 |
|------|------|------|
| M11-RESEARCH-01 | 現状調査(完了) | custom_states/situation の現状 + FU-1〜4(read-only、完了) |
| **M11-01** | custom_states 開始時状態の機能化(完了) | seed 定義投入(3体)+ 付与 UI(ComboEditor)+ 表示(詳細/比較)。Opus + Plan Mode 必須。CHANGE-040/041/042 反映済・開発者 E2E 確認済 |
| **M11-02** | nullable メタデータの PATCH クリア一般化 | M11-01 事後に判明した「PATCH で nullable メタデータ(memo/damage/ゲージ/knockdown_advantage 等)を空に戻しても永続化されない」同型バグの一般解。Opus + Plan Mode 必須。詳細 §3.3 |

> M11-02 は M11-01 の再分割ではなく、M11-01 の custom_states 修正(CHANGE-042 空文字センチネル)で露見した**既存(M11 以前からの)潜在バグの一般化対応**として事後追加(2026-06-20 開発者確定=§5.1 案B)。実装はウォームな M11-01 担当が担う(ComboEditor/repository の文脈活用)。

### 3.3 M11-02 の範囲と論点(着手前に確定)

- **症状**: `repository.UpdateMetadata` は「明示指定列のみ更新 / `nil`=不変更」方式。フロント `buildPatchPayload` は空入力を `null` で送る(`memo: nullIfEmpty`、`damage: parseOptInt` 等)ため、編集で memo/damage/ゲージ等を**空に戻しても旧値温存**。起き攻め 6 BOOLEAN は off を `false`(非 null)で送るため正しくクリアできており対象外。
- **一般解の方式(着手前の小調査 + Plan Mode で確定)**: フロント `buildPatchPayload` が**全フィールドを毎回送るか / 変更分のみか**で適切解が変わる。
  - 全フィールド送出なら **full-replace 寄り**(送られた null=クリア)。
  - 変更分のみなら **presence-detection トライステート**(フィールド不在=不変更 / JSON `null`=クリア。Go は `json.RawMessage`/カスタム Unmarshal で「不在」と「null」を判別)。
  - いずれも `nil`(=絶対送らない)で「不変更」を保てる設計を選ぶ。**まず現状の buildPatchPayload 構造と UpdateMetadata の per-field nil 判定を実 view 確認**してから方式を確定する(retrospective-digest §1 推測回避)。
- **situation(custom_states)の扱い ★設計判断**: CHANGE-042 で situation は空文字 `""`=NULL クリアのセンチネルを採用済み。一般解導入時に situation をどう扱うか:
  - **(推奨) 据え置き**: situation は**オブジェクト値**フィールドで `""` が正当値として現れず曖昧さがないため `""`センチネルのまま。スカラー nullable(memo/int)は `""` が曖昧(空 memo か未設定か区別不能)なので presence-detection/null=クリアを採る。= 「object は `""`、scalar は null=クリア」の**原則ある使い分け**として文書化。出荷済み CHANGE-042 を手直ししない。
  - (代替) 全フィールドを単一規約(null=クリア)に統一し、situation も `""`→`null` へ移行。完全な統一だが出荷済み修正を churn する。
- **CHANGE 見込み**: DES-002 §4.2 PATCH の nullable メタデータのクリア規約を明文化(CHANGE-043 予定)。DES-005/006/003 は変更なしの見込み。

### 3.4 採用しない案(初版時の検討)

- **案2(seed 分離: M11-01=seed / 付与+表示)**: custom_states は付与/表示/seed が密結合のため M11-01 を単一にした(初版の判断、不変)。M11-02 はこれとは別軸(PATCH クリア一般化)の事後追加。

---

## 4. M11-01 の概要

### 4.1 スコープ(3本柱)

1. **seed 定義投入**(加算的マイグレーション): ryu の `'{}'`→`denjin_charge` 置換(UPDATE)、ingrid=`sun_crest`(int 0–4)新規、c_viper=`limit_decoupler` 新規。投入 JSON は定義書 §3.1。
2. **付与 UI**(ComboEditor、フロント): `BasicFieldsValue` に custom_states 付与値を保持するフィールド追加 → 「キャラ固有状態」fieldset 新設(`ComboEditorBasicFields` の既存 fieldset パターンに倣う)→ 選択キャラ定義(useCharacters の customStates)から動的描画(flag→トグル / int→数値入力)→ `buildCreatePayload`/`buildPatchPayload`/`runPut` に situation 組立追加 → `initialBasic` で edit/copy 時に既存 situation を読込(round-trip)。
3. **表示**(フロント): `ComboDetailHeader` に「キャラ固有状態」セクション追加、`CompareTable` の `rows` に行追加。custom_states を持つコンボのみ表示。

### 4.2 主要な関心

- new/edit/copy の3モードでの situation round-trip(現状 situation は全経路で未送信=FU-1。3経路すべてに組立追加)。
- データ駆動描画(type 別: flag/level/stock)、未対応 type のスキップ、状態なしキャラでのセクション非表示。
- 命名衝突回避(既存「状況」独立カラムと別系統)。
- seed の既存値置換(ryu の UPDATE)。

### 4.3 設置先(M11-RESEARCH-01 FU で確定)

| 対象 | 設置先 |
|------|--------|
| situation 組立 | `ComboEditor.tsx` `buildCreatePayload()`(:144)/ `buildPatchPayload()`(:173)/ `runPut()`(:305)/ `initialBasic()`(:523) |
| 付与 UI セクション | `ComboEditorBasicFields.tsx` の fieldset(基本情報と起き攻めの間 等)+ `BasicFieldsValue` 拡張 |
| 定義の取得 | `useCharacters()`(`["characters",{gameId}]`)の `Character[].customStates` |
| 詳細表示 | `ComboDetailHeader.tsx` の `<dl>` 群に新セクション |
| 比較表示 | `CompareTable.tsx` の `rows` に新 `RowDef` |

### 4.4 Plan Mode 必須項目(指示書 §3.4 で具体化)

custom_states 付与値の state 保持方式(`BasicFieldsValue` 拡張 vs 別 useState)/ 選択キャラ定義の取得配線(`useCharacters` から find)/ Int 入力の既存ゲージ弾きパターン(`-`/`e`/`.` 拒否)の実装位置確認 / situation 組立の3経路(create/patch/put)+ round-trip(initialBasic 読込)/ seed UPDATE マイグレーション番号・方式 / 未対応 type・状態なしキャラの描画。

---

## 5. 実行順序と依存関係

- M11-RESEARCH-01(完了)→ 本 overview(承認)→ M11-01 指示書 + CHANGE-040 起票 → 製造 → レビュー → 実機 E2E → 完了。
- M11 は moves 取込(M8/M9)に非依存。M10 完了(キャラ選択化)が前提(付与 UI が選択キャラに追従するため)。
- M12 は M11 完了後(先行リリース判定は M12-03)。

---

## 6. M11 で扱わないもの

| 項目 | 扱い |
|------|------|
| custom_states 消費・検証 | アプリでは構築しない(D-B/Q3。現時点では実装しない)。利用者が notes 管理 |
| 非先行リリースキャラへの投入 | 対象外(D-C-1)。定義は参照保持 |
| aki/jamie/guile の seed | 触らない(D-C-2)。jamie の composite は M12-02 整理対象 |
| DES-003 custom_states 構造拡張 | 不要(スキーマ既存で足りる) |
| 英語ロケール | フェーズ3 |

---

## 7. モデル配分(model-allocation v1.17.0)

- **M11-RESEARCH-01** = Sonnet 4.6 / レビュー不要(完了、調査担当運用8例目)。
- **M11-01** = **Opus 4.8 + Plan Mode 必須(想定)**。付与の3モード round-trip + データ駆動描画 + seed 既存値置換 + 命名整理で複数関心が絡む(playbook §7.1 Opus 信号)。レビュー = Sonnet 4.6(機械的チェック中心)。着手時に指示書 §7 で確定し model-allocation に追記。

---

## 8. CHANGE 通知書の起票予定(次番号 040)

| 文書 | 想定改訂 | 要否 |
|------|---------|------|
| DES-005 §5.7 表示項目5 | situation を「キャラ固有状態」動的付与 UI として機能化(呼称 D-A・動的描画・Int 入力仕様) | **要** |
| DES-005 §5.6 表示項目4 | 「キャラ固有状態」表示セクションの追加(独立カラム「状況」と分離) | **要** |
| DES-006 | 「custom_states 入力は検証しない」を明示追記(将来の再導入防止、digest §3「規定なしも明示」) | **要** |
| DES-003 §3.2 | 例示(drunk_level 等)の確定リストへの正典化・value_definition の整合 | 要否を起票時判断(jamie 据え置き=D-C-2 と整合する範囲で) |
| DES-002 / DES-004 | API 不変(situation 既存)/ recipe notation 無関係 | 不要の見込み |

CHANGE-040 として一括起票し、承認後に反映(playbook §16.4)。

---

## 9. リスクと対策

- **situation round-trip の経路漏れ(機能リスク中)**: situation 組立は create/patch/put の3経路 + initialBasic 読込の4点。1点でも漏れると保存/編集で値が消える。→ Plan Mode で4点を列挙確認、E2E で edit 往復を検証。
- **命名衝突(UX リスク中)**: 既存「状況」と新「キャラ固有状態」の混同。→ D-A=別セクション・別 i18n キーで分離、CHANGE-040 で DES-005 文言を整理。
- **seed 既存値置換の取りこぼし(データ整合リスク中)**: ryu の `'{}'`→電刃 は UPDATE(加算でなく置換)。→ マイグレーション方式を Plan Mode 確認、適用後の値を E2E 前提条件で確認。
- **データ駆動描画の type 取りこぼし(技術リスク低)**: 未対応 type(composite)で描画が落ちる懸念。→ 未対応 type はスキップする防御を明記。

---

## 10. M11 期間で意識する教訓(retrospective-digest 由来)

- **前向き注意(M10-2/M10-5)**: 固定/未消費前提の有効化は phase-1 前提を露出させる。→ ryu の `'{}'`(固有状態なし前提)置換が該当。RESEARCH で周辺の固定/未消費前提は0件と確認済み。
- **論理型≠物理型 / DB 実査≠正典(§1-A)**: situation/custom_states は論理「JSON」・物理 TEXT。正典は DES 本体、物理は RESEARCH で確認済み。
- **実コード確認の省略を避ける(§1-A)**: 設置先・取得経路は FU-1〜4 で実コード裏取り済み。指示書はこれに基づき記述。
- **表示項目↔実装実態の対応表(§4 / playbook §4.10)**: 付与/表示の各項目を code-facts/FU と1:1照合して指示書 §3.4 に載せる。

---

## 11. M11 完了判定

- M11-01 完了承認(レビュー + 実機 E2E)。
- リュウ=電刃錬気トグル / イングリッド=サンシンボル数値(0–4、`-`/`e`/`.` 不可)/ C.ヴァイパー=バウンサーステップトグル が付与でき、保存→詳細/比較で表示され、編集往復で保持される。
- 状態なしキャラ(ケン/ダルシム)で付与セクションが現れない。
- 既存「状況」(独立カラム)・登録系 API・他機能に回帰なし。
- CHANGE-040 反映済み(DES-005/006 + 要否判断後の DES-003)。

---

## 12. 関連ドキュメント

| 文書 | 役割 |
|------|------|
| phase2-overview §M11 | M11 スコープの正本 |
| M11-RESEARCH-01 報告(+FU-1〜4) | 現状裏取り |
| m11-custom-states-definitions v0.2.0 | 定義データ確定版(型/code/範囲/投入 JSON) |
| DES-003 §3.2 / §3.x | custom_states 構造 / situation 格納先 |
| DES-005 §5.6 / §5.7 | 表示・付与 UI(CHANGE-040 対象) |
| DES-006 | 検証(非構築の明示追記) |
| architecture-patterns §9.1 | custom_states 現状・消費非構築方針 |
| model-allocation §M11 | モデル配分 |
| code-facts | Props/hooks/ルート(指示書執筆の裏取り) |

---

## 13. 開発者承認チェックリスト

- [ ] **サブユニット構成 = 単一 M11-01**(D-D=案1。「D-C-4.案A」の解釈)で良いか(§3、§4.12 構造合意)。
- [ ] 主要設計判断 §2(D-A〜D-D の反映)に齟齬がないか。
- [ ] CHANGE-040 起票予定 §8(DES-005 §5.6/§5.7 + DES-006 明示 + DES-003 要否)で良いか。
- [ ] M11-01 のモデル = Opus 4.8 + Plan Mode 必須(想定)で良いか(§7、着手時最終確定)。

承認後、M11-01 指示書 + レビューチェックリスト + CHANGE-040 ドラフトを作成する。

---

*以上、M11-overview v1.0.0。配置 `docs/instructions/M11-overview.md`。*
