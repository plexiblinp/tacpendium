# 指示書 M11-RESEARCH-01: custom_states 保存/API/データ現状 + situation 付与・表示 UI の現状 全数調査

| 項目 | 内容 |
|------|------|
| 指示書 ID | M11-RESEARCH-01 |
| バージョン | 1.0.0 |
| 推奨モデル | **Sonnet 4.6**(調査担当パターン、read-only 厳守、grep / view 中心の事実列挙で創発的判断を含まない。過去例 M5/M6/M7-RESEARCH-01〜04 に整合。トークンに余裕がある場合は Opus への昇格を開発者が判断)|
| Plan Mode | **任意**(事実列挙のみで設計判断 / 複数関心統合 / バックエンド変更のいずれにも該当しない、playbook §8.2)|
| 機械レビュー | **不要**(調査結果レポートは事実列挙のみで実装変更を含まない、調査担当運用パターン = architecture-patterns §6)|
| 並列性 | 単独(M11 設計の前提条件。本調査完了後に設計担当が M11 overview → 付与/表示 UI 指示書 → CHANGE-040 判断の順で進める)|
| 依存指示書 | M10-02 完了承認済み(2026-06-19/20、E2E 通過)|
| 想定所要時間 | 60〜90 分(2 軸〔custom_states データ現状 / situation UI 現状〕の read-only 調査 + レポート作成)|
| 作成者・作成日 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当)、2026-06-20 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-20 | 初版作成。M11(custom_states 開始時状態の機能化)着手前の現状裏取り。設計担当は実コードを直接見られないため、(1) custom_states の保存/API/データ現状、(2) situation 付与・表示 UI の現状を事実列挙させ、M11 付与 UI 設計(案B = Boolean トグル + Int 数値入力、消費は非モデル化)・定義投入スコープ(クラシック5体の状態保有3体)・CHANGE-040 判断の材料とする。architecture-patterns §6 調査担当運用パターン準拠 |

---

## 0. この指示書の特殊性

### 0.1 製造担当として起動 + 調査だけ実施して閉じる運用

本指示書は **調査担当運用パターン**(architecture-patterns §6)に基づく事実列挙のみの調査依頼。製造担当として Claude Code セッションを起動し、本指示書 §4 の事実列挙を実施 → §5 レポートに記録 → セッションを閉じる。実装は本調査の対象外(M11 製造工程は別指示書)。

### 0.2 read-only 厳守

本指示書では **コードの変更を一切行わない**。`view` / `grep` / `git log` / `git blame` / `find` / `ls` / SQL の SELECT などの読み取り系のみを使用。ファイル編集系(`str_replace` / `create_file` / 書き込み系 `bash`)は **使用禁止**。例外は §5 レポートファイル作成のみ。DB は **SELECT のみ**(INSERT/UPDATE/DELETE/マイグレーション実行は禁止)。

### 0.3 判断・提案を含めない(judgement-free)

調査結果は **事実列挙のみ**。「この方式で実装すべき」「ここは NULL なので seed が必要」等の判断・提案・設計結論は **含めない**。観察された事実 + 既存コード状態 + 設計書本体規定との比較 = 設計担当が M11 設計に活用するための情報供給のみが目的。**設計判断は設計担当 + 開発者が行う**。

ただし以下 2 種類は判断ではないため記録する:
- **想定外の発見**(custom_states / situation が想定外の箇所で参照・描画されていた等)
- **明らかな矛盾の事実指摘**(設計書本体規定とコードの不整合、論理型と物理型の乖離、コメントとロジックの矛盾等): 事実として列挙し、解釈・解消方針は含めない

### 0.4 本調査の主目的

| 軸 | 主目的 |
|----|--------|
| **§4.1 custom_states の保存/API/データ現状** | `characters.custom_states` と `combos.situation` の物理スキーマ・API 経路・現在のデータ値を事実列挙。**論理型(設計書「JSON」)と物理型(code-facts `*string`)の乖離**、`custom_states` キーをパース/参照する箇所の有無、先行リリース対象キャラ行の現存と各 `custom_states` 値(NULL か / 中身)を確定する |
| **§4.2 situation 付与・表示 UI の現状** | DES-005 §5.7 表示項目5「situation(キャラ固有状態、動的に表示)」入力と §5.6 表示項目4「situation JSON の中身」表示が **コード上で実在するか・実装方式**を事実列挙。code-facts §1 フロント Props に situation/customStates の言及が無い事実の実体(専用 UI 不在 / ComboEditor 内に埋込 / 未描画のいずれか)を確定する |
| **§4.3 調査対象外との混同回避** | 起き攻め `oki_*` BOOLEAN群 / 独立カラム化済み状況(position 等)/ ステップ修飾 modifiers は custom_states と別物。grep で同時ヒットしうるため明確に区別する |

### 0.5 背景(M11 設計で確定済みの前提 = 調査のフレーミング)

> 以下は設計担当 + 開発者で確定済みの前提。調査担当は **この前提を変更しない**。事実が前提と食い違う場合は §0.3 のとおり「矛盾の事実」として記録する(解釈は設計担当が行う)。

- M11 = custom_states 開始時状態の機能化。**付与 + 表示 + 参照のみ**。状態の**消費(コンボ中の減少・レベルによる技変化・バリデーション連動)はモデル化しない**(フェーズ3 まで作らず利用者が notes で管理。開発者方針 2026-06-20)。
- 付与 UI は **案B = Boolean(トグル)+ Int(開始時の数値入力)の両方**を扱う(いずれも消費は非モデル化)。
- 先行リリース対象はクラシック5体(リュウ / ケン / イングリッド / C.ヴァイパー / ダルシム)。このうち開始時状態を持つのは **リュウ(電刃錬気 = Boolean)/ イングリッド(サンシンボル = Int)/ C.ヴァイパー(バウンサーステップ = Boolean)の3体**(ケン・ダルシムは状態なし)。
- 定義の置き場 = `characters.custom_states`(JSON、DES-003 §3.2)。値の置き場 = `combos.situation` の `custom_states` キー配下(DES-003 §3.x、例 `{"custom_states": {...}}`)。
- 現状(architecture-patterns §9.1)= custom_states は phase-1 で「保存 + API 返却」のみ、combos / steps / modifiers から参照されず、フロント表示 UI もない、フロント型に `customStates?` はあるが未使用 ——**この記述の現状を実コードで再確認するのが本調査の一部**。

### 0.6 結果の扱い

調査結果レポート(`docs/progress/M11-RESEARCH-01-report.md`、配置は docs-map の RESEARCH レポート規約に従う)は設計担当が読んで、以下を判断する材料に使う:
- M11 付与 UI 設計(situation 既存入力を機能化するか / 新設するか、`custom_states` キーの読み書き経路)。
- 定義投入スコープの確定(クラシック5体の状態保有3体への `characters.custom_states` 投入要否 = 現在値が NULL か否かで決まる)。
- CHANGE-040 のスコープ確定(DES-005 §5.7/§5.6 の situation 機能化、DES-003 の正典化要否)。

---

## 1. 背景と目的

### 1.1 背景

- M10 完了(登録系の複数キャラ化、E2E 通過)により他キャラのコンボ登録が可能になった。一方 situation(キャラ固有の開始時状態)は汎用入力のまま据え置きで、custom_states は保存 / API のみ実装され消費(機能化)は未実装(architecture-patterns §9.1)。
- M11 はこの custom_states の消費(= 付与・表示・参照)を有効化する。設計担当は分担上コードを直接見られないため、付与 UI 設計・定義投入スコープ・CHANGE 判断の前に、現状を実コードで裏取りする必要がある(retrospective-digest §1 パターンA「実装済み前提を裏取りせず書かない」/「DB 実査 ≠ 仕様正典」/「論理型 ≠ 物理 SQL 宣言」)。
- 前向き注意(M10-2/M10-5、handover §5): 固定前提・未消費前提を有効化する改修は phase-1 時代の固定/未消費前提を露出させる。有効化対象(situation/custom_states)周辺の phase-1 固定値・未消費前提の残存を本調査で事実確認する。

### 1.2 目的

本指示書完了時に以下を達成する:

- `characters.custom_states` / `combos.situation` の **物理スキーマ・API 経路・現在データ値の完全なマップ**。
- `custom_states` キーを **読み書き / パース / 参照する箇所の有無**(arch-patterns §9.1「参照されない」の現状確認)。
- situation 付与・表示 UI の **実在有無と実装方式**(ComboEditor / コンボ詳細 / コンボ比較)。
- situation/custom_states 周辺の **phase-1 固定/未消費前提の残存**の事実列挙。
- 設計担当が M11 設計・投入スコープ・CHANGE-040 判断に必要な情報の供給。

### 1.3 このマイルストーンで作らないもの

- **M11 本体の実装**(付与 UI・表示・seed)。本調査は事実列挙のみ。実装は別指示書。
- **判断・提案・設計結論**(§0.3 judgement-free)。
- **設計書本体(DES-003/004/005/006)の改訂**(改訂は設計担当が CHANGE-040 で実施)。
- **custom_states の消費ロジック調査**(消費は M11 で作らない = §0.5。消費に関する深掘りは不要)。

---

## 2. 成果物

### 2.1 作成するファイル

- `docs/progress/M11-RESEARCH-01-report.md`(調査結果レポート、§5 フォーマットに従う)

### 2.2 修正するファイル

なし(read-only 厳守、§0.2)

### 2.3 変更しないもの

- バックエンド全般(handler / service / repository / model / migration / config / validation / notation)
- フロントエンド全般(pages / features / components / hooks / lib / types / i18n)
- 設計書本体(REQ-001 / DES-001〜006)・補足資料全件
- 既存テストファイル・DB の中身(SELECT のみ)

---

## 3. 前提条件

### 3.1 必読ドキュメント

- 本指示書
- **custom_states / situation の設計書本体規定**:
  - `docs/design/03-data-model.md`(DES-003)§3.2 characters.custom_states(構造定義)/ §3.x combos.situation(`custom_states` キー、§396-408 付近)
  - `docs/design/05-screen-design.md`(DES-005)§5.6 表示項目4(situation JSON の中身)/ §5.7 表示項目5(situation = キャラ固有状態、動的に表示)
- **現状記述(再確認の出発点)**:
  - `docs/handover/architecture-patterns.md` §9.1(custom_states は保存/API のみ、参照・表示 UI なし、`customStates?` 未使用)
  - `docs/handover/code-facts.md` §7-2(`CreateRequest.situation` / `ComboResponse.situation`)/ §8(`model.Combo.Situation *string` / `model.Character.CustomStates *string`)/ §1 フロント Props(situation/customStates の言及が無い事実)
- **調査運用ルール**:
  - `docs/handover/architecture-patterns.md` §6(調査担当運用パターン)
  - `docs/handover/retrospective-digest.md` §0 / §1 パターンA(DB 実査 ≠ 正典、論理型 ≠ 物理宣言)

### 3.2 任意参照(必要時のみ)

- 過去の調査レポート(`M7-RESEARCH-01〜04-report`、フォーマット参考のみ)
- `docs/design/02-architecture.md`(DES-002)§4.2(コンボ系エンドポイント)
- `docs/design/06-validation.md`(DES-006)(situation/custom_states 検証の有無確認 = §4.1.4 連動)

### 3.3 参照不要

- custom_states の消費セマンティクス(M11 で作らない、§0.5)
- moves / 取込 / 仮想コントローラ(M11 非依存)
- フェーズ3 以降の機能(プリセット管理・i18n 英語ロケール等)

### 3.4 着手前の確認

#### 3.4.1 既存構造の把握

- [ ] `git log --oneline -10` で最近のコミット履歴を確認(M10-02 完了承認後の状態)。
- [ ] `code-facts.md` ヘッダの `commit`(`3e0f4bf`)と `git rev-parse --short HEAD` を比較。不一致なら `/regen_code_facts` で再生成してから §4 の事実と突き合わせる(playbook §6.2)。
- [ ] `ls migrations/`(または相当パスを find で特定)でマイグレーション SQL の所在を確認。

#### 3.4.2 調査範囲の明示確認

- [ ] §4.1 = custom_states / situation の物理スキーマ・API・データ現状
- [ ] §4.2 = situation 付与・表示 UI の現状
- [ ] §4.3 = 調査対象外(`oki_*` / 独立カラム status / modifiers)との混同回避

---

## 4. 調査内容

本節は §0.2 read-only 厳守 + §0.3 judgement-free 原則に従って実施する。コマンド例は **参考**(より効率的な手段が存在する場合は調査担当の裁量で変更してよい)。**全数性が核心**: grep は snake_case / camelCase の両系統で実行し、ヒット 0 件の領域も「0 件であった」と明示的に記録する。

追跡するシンボルのバリエーション:
- snake_case(DB / SQL / JSON タグ): `custom_states` / `situation`
- camelCase(Go フィールド / フロント型 / API): `CustomStates` / `customStates` / `Situation` / `situation`
- 部分一致での取りこぼし防止: `custom_state` / `customState`

### 4.1 custom_states / situation の保存・API・データ現状(Q1)

#### 4.1.1 横断 grep(全使用箇所の起点)

- [ ] リポジトリ全体で以下を grep し、**ファイルパス + 行番号 + 該当行**を全件列挙し、領域別(バックエンド Go / フロント TS / マイグレーション SQL / テスト / seed / i18n / ドキュメント)に分類:
  - `grep -rni "custom_states" .`
  - `grep -rni "customStates" .`
  - `grep -rni "situation" .`
- [ ] 各ヒットが custom_states / situation 本体に関するものか、無関係な別語(英文コメント等)かを事実として区別。

#### 4.1.2 物理スキーマ(マイグレーション SQL)

- [ ] `characters.custom_states` の物理列宣言(CREATE TABLE / ALTER。**物理型〔TEXT / JSON〕・NULL 可否・DEFAULT**)。
- [ ] `combos.situation` の物理列宣言(同上)。
- [ ] **DES-003 の論理型「JSON」と物理宣言の一致 / 乖離**を事実として明記(retrospective-digest §1-A。code-facts は両者を `*string` と記録 = 物理が TEXT の可能性 → 実マイグレーションで確定)。
- [ ] 当該2列に対する CHECK 制約・インデックスの有無。

#### 4.1.3 現存 characters 行と custom_states の現在値

- [ ] `SELECT id, code, name_ja FROM characters ORDER BY id;` で **現存するキャラ行の全件**(件数・id・code・name_ja)を列挙。先行リリース5体(リュウ/ケン/イングリッド/C.ヴァイパー/ダルシム)の行が存在するか、それ以外のキャラ行が存在するかを事実記録(code 値も記録 = 設計担当が定義投入の対象 code を確定する材料)。
- [ ] `SELECT id, code, custom_states FROM characters ORDER BY id;` で **各行の custom_states 現在値**を列挙(NULL か / 非 NULL なら JSON 文字列の中身)。特に上記5体それぞれが NULL か否かを明示。
- [ ] 非 NULL の行が存在する場合は、その JSON 構造が DES-003 §3.2 の構造(`states[].code/name_ja/name_en/subject/scope/type/value_definition`)に沿うかを事実記録(解釈は加えない)。

#### 4.1.4 situation の API serialize/deserialize 実態 + custom_states 参照箇所

- [ ] リクエスト経路: `CreateRequest` / 更新リクエスト DTO の `situation` フィールド(型・omitempty)と、`c.Bind` 以降で situation を **どう保存するか**(raw 文字列のまま保存か / JSON パースするか)を service / repository まで追って事実列挙。
- [ ] レスポンス経路: `ComboResponse.situation` への詰め込み(`toComboResponse` 等)で situation を **どう返すか**(raw 文字列か / 構造化するか)。
- [ ] **`custom_states` キーをパース / 参照 / 読み出す箇所が存在するか**(バックエンド・フロント横断)。arch-patterns §9.1 は「combos/steps/modifiers から参照されない」と記述 = **現状を再確認し、0 件なら「0 件であった」と明示**。1 件でも存在する場合は想定外の発見としてレポート §0.7 に記録。
- [ ] DES-006(バリデーション)で situation / custom_states を検証する規定・実装が存在するか(grep。0 件なら明示)。

#### 4.1.5 フロント型・hooks・API クライアントでの situation/customStates

- [ ] フロント型定義(`types.ts` 等)の `Combo` / `ComboDetail` / リクエスト型での `situation` / `customStates?` フィールド(型・nullable・オプショナル性)。
- [ ] `customStates?` 型を **実際に読む / 描画する箇所が存在するか**(arch-patterns §9.1「未使用」の現状確認。0 件なら明示)。
- [ ] `situation` をフロントで扱う箇所(parse するか / string のまま扱うか)。

#### 4.1.6 既存 seed の custom_states 投入実態

- [ ] seed / フィクスチャ SQL(`*.sql` / `testdata/` / マイグレーション内 INSERT)で `characters.custom_states` に値を入れている箇所が存在するか。
- [ ] 存在する場合、対象キャラ(code)と投入 JSON の中身を事実列挙(arch-patterns §9.1 は AKI/ジェイミーの耐久 seed に言及 = M7-05 でのクリア状況を含め現状確認)。先行リリース5体の seed に custom_states 投入があるかを明示。

### 4.2 situation 付与・表示 UI の現状(Q4)

#### 4.2.1 ComboEditor の situation 入力(DES-005 §5.7 表示項目5)

- [ ] ComboEditor(`features/combo` 配下、実パスは view で特定)に DES-005 §5.7 表示項目5「situation(キャラ固有状態、動的に表示)」に対応する**入力 UI が実在するか**(有/無を明示)。
- [ ] 実在する場合の実装方式を事実記録: 汎用テキスト入力か / 構造化入力か、該当ファイル・コンポーネント名、Props、state 機構(react-hook-form の defaultValues か局所 state か)、選択キャラに応じた動的描画があるか。
- [ ] **code-facts §1 フロント Props に situation/customStates の言及が無い事実の実体**を確定: (a) situation 専用コンポーネントが存在しない / (b) ComboEditor 内に Props 名を伴わず埋め込まれている / (c) 入力自体が未描画、のいずれであるかを実 JSX の view で事実記録。
- [ ] 位置関係: §5.7 表示項目5 の他項目(position / opponent_stance / hit_type / opponent_size / drive_available_at_start / sa_available_at_start)がどう描画されているかと、situation の描画有無を対比(表示項目5 のうち situation だけ未描画なら、その事実)。

#### 4.2.2 コンボ詳細の situation 表示(DES-005 §5.6 表示項目4)

- [ ] コンボ詳細(`ComboDetail*` 等、実パスは view で特定)に「状況」セクションがあり、その中で **situation(JSON の中身)が表示されているか**(有/無を明示)。
- [ ] 表示している場合の実装(raw 文字列表示か / 構造化表示か)、該当コンポーネント。

#### 4.2.3 コンボ比較画面の situation

- [ ] コンボ比較(`CompareTable` 等)の表示行に situation が含まれるか(有/無を明示)。

#### 4.2.4 phase-1 固定/未消費前提の残存(前向き注意 M10-2/M10-5)

> 有効化対象(situation/custom_states)周辺で、phase-1 時代の固定値・未消費前提のハードコードや分岐が残っていないかを **事実列挙**(解釈・修正方針は含めない)。

- [ ] situation / custom_states 周辺に特定キャラ固定(リュウ固定等)のハードコード・分岐が存在するか。
- [ ] custom_states が未消費・未描画であることを前提にした条件分岐・スタブ・コメント(例:「未実装」「TODO」「phase2」等)が situation/custom_states 周辺に存在するか。
- [ ] `customStates?` を有効化した際に round-trip(保存 → 取得 → 再保存)へ影響しうる既存処理(situation の上書き・欠落・無視等)が存在するか。

### 4.3 調査対象外シンボルとの混同回避(重要)

以下は custom_states / situation と **別物**。grep で同時ヒットしうるため、レポートで明確に区別する:

- [ ] `combos.oki_meaty_*` / `oki_shimmy_*`(起き攻め BOOLEAN群、DES-003 §3.x)= **別物**(custom_states ではない)。
- [ ] `combos.position` / `opponent_stance` / `hit_type` / `opponent_size`(独立カラム化済みの状況、DES-003 §3.x)= **別物**(situation JSON の外。DES-003 §396「situation の使い分け」で独立カラム以外を situation が保持、と区別済み)。
- [ ] `combo_steps.modifiers`(ステップ修飾、DES-003)= **別物**。
- [ ] `combos.drive_available_at_start` / `sa_available_at_start`(開始残量の独立カラム)= **別物**(situation ではない)。

レポートでは §4.1.1 の grep ヒットのうち上記に該当するものを「調査対象外(別シンボル)」として分離記録する。

---

## 5. レポートフォーマット(調査結果の記録)

調査担当は以下のフォーマットで `docs/progress/M11-RESEARCH-01-report.md` を作成する。**結論サマリ §0 を冒頭に置く**(設計担当が最初に読む箇所、architecture-patterns §6 規定通り)。

### 5.1 レポート構造(テンプレート)

```markdown
# M11-RESEARCH-01 調査結果レポート

| 項目 | 内容 |
|------|------|
| 対応指示書 | M11-RESEARCH-01 v1.0.0 |
| バージョン | 1.0.0 |
| 実施日 | 2026-XX-XX |
| 実施モデル | Sonnet 4.6（または開発者ご判断で昇格）|
| 調査担当 | Claude Code セッション |

## 0. 結論サマリ（設計担当が最初に読む、事実集約）

### 0.1 custom_states / situation の物理スキーマ
- characters.custom_states の物理型・NULL 可否・DEFAULT（+ DES-003 論理型「JSON」との一致/乖離）
- combos.situation の物理型・NULL 可否・DEFAULT（+ 論理型との一致/乖離）

### 0.2 現存 characters 行と custom_states 現在値
- 現存キャラ行の件数 + 先行リリース5体（リュウ/ケン/イングリッド/C.ヴァイパー/ダルシム）の存在有無 + code
- 各行の custom_states が NULL か / 非 NULL（中身概要）。5体それぞれの NULL 有無を明示

### 0.3 situation API 実態 + custom_states 参照箇所
- situation の保存/返却が raw 文字列か / パースありか（3〜5 行）
- custom_states キーをパース/参照する箇所の件数（0 件ならその旨）
- situation/custom_states のバリデーション規定/実装の有無

### 0.4 situation 付与・表示 UI の現状
- ComboEditor の situation 入力: 実在有無 + 実装方式（汎用入力か / 未描画か）
- コンボ詳細・比較の situation 表示: 有無
- code-facts §1 に Props が無い事実の実体（(a)/(b)/(c) のいずれか）

### 0.5 phase-1 固定/未消費前提の残存
- situation/custom_states 周辺の固定ハードコード・未消費前提分岐・スタブの有無（事実列挙）

### 0.6 既存 seed の custom_states 投入実態
- seed で custom_states に値を入れる箇所の有無 + 対象キャラ

### 0.7 想定外の発見
（存在する場合は事実列挙、無ければ「特になし」）

### 0.8 明らかな矛盾の事実指摘
（論理型 vs 物理型、設計書 vs コード、コメント vs ロジック等。なければ「特になし」）

---

## 1. custom_states / situation の保存・API・データ現状
### 1.1 横断 grep の全ヒット一覧（領域別、対象/対象外の区別を付す）
### 1.2 物理スキーマ（マイグレーション SQL）
### 1.3 現存 characters 行と custom_states 現在値（SELECT 結果）
### 1.4 situation の API serialize/deserialize + custom_states 参照箇所
### 1.5 フロント型・hooks・API クライアント
### 1.6 既存 seed の custom_states 投入実態
（各節 事実列挙、ヒット 0 件は「0 件」と明示）

## 2. situation 付与・表示 UI の現状
### 2.1 ComboEditor の situation 入力
### 2.2 コンボ詳細の situation 表示
### 2.3 コンボ比較の situation
### 2.4 phase-1 固定/未消費前提の残存

## 3. 調査対象外シンボルとの区別
（oki_* / position 等独立カラム / modifiers / available_at_start の同時ヒットを分離記録）

## 4. 関連ドキュメント
（表形式）

## 5. 調査担当からの完了宣言
（read-only + judgement-free 厳守の宣言、セッションを閉じる）

*以上、M11-RESEARCH-01 調査結果レポート v1.0.0*
```

### 5.2 レポート作成時の注意

- **結論サマリ §0 を最初に書く**(設計担当が最初に読む箇所)。
- **事実列挙のみ、判断・提案・設計結論は含めない**(§0.3 judgement-free)。
- **全数性を担保**: grep のヒット 0 件の領域も「0 件であった」と明示する。
- **論理型 vs 物理型の乖離は §0.8 + §1.2 で事実として明記**(本調査の核心の一つ)。
- **調査対象 / 対象外の区別を全箇所で明示**(§4.3)。
- **コード片の引用は最小限**(行番号 + 該当数行のみ)。
- **行番号・SELECT 結果は調査実施時点のものを記録**。

---

## 6. 完了条件(Definition of Done)

### 6.1 機能完了

- [ ] `docs/progress/M11-RESEARCH-01-report.md` が §5.1 テンプレートに従って作成されている。
- [ ] §0 結論サマリ(0.1〜0.8)が冒頭に配置されている。
- [ ] §1(1.1〜1.6)・§2(2.1〜2.4)・§3 がすべて埋まっている(各節 事実列挙、ヒット 0 件はその旨明示)。
- [ ] 現存 characters 行と各 custom_states 現在値が SELECT 結果として記録されている(先行リリース5体の NULL 有無が明示)。
- [ ] situation の物理型 vs 論理型の一致/乖離が明記されている。
- [ ] custom_states キーをパース/参照する箇所の件数が明示されている(0 件含む)。
- [ ] ComboEditor の situation 入力の実在有無・実装方式が明記されている。

### 6.2 制約遵守

- [ ] **read-only 厳守**(コード・DB 変更なし、§5 レポート作成のみ例外、DB は SELECT のみ)。
- [ ] **judgement-free**(判断・提案・設計結論を含まない、事実列挙のみ)。
- [ ] **全数性**(grep 両系統 + ヒット 0 件領域も明示)。
- [ ] **調査対象 / 対象外の区別**(§4.3 のシンボルを取り違えていない)。
- [ ] **想定外の発見 + 明らかな矛盾は §0.7 / §0.8 / 各章で事実として記録**。

### 6.3 スコープ外への変更がないこと

- [ ] バックエンド・フロント・設計書本体・補足資料・既存テスト・DB の中身に変更がない。

---

## 7. 注意事項

### 7.1 read-only 厳守の徹底

本指示書では **コードの変更を一切行わない**。読み取り系のみを使用し、DB は SELECT のみ。書き込みは §5 レポートファイル作成のみ例外。

### 7.2 judgement-free の徹底

調査結果は **事実列挙のみ**。設計結論・実装方針・推奨は含めない。

事実列挙の典型例:
- ✅「`characters.custom_states` は `migrations/000001_*.up.sql` で `custom_states TEXT`(NULL 可、DEFAULT なし)と宣言。DES-003 §185 の論理型『JSON』に対し物理は TEXT」(型乖離の事実)
- ✅「`SELECT custom_states FROM characters` の結果、id=1(ryu)〜5 すべて NULL」(データの事実)
- ✅「`custom_states` をパース/参照するコードは バックエンド・フロント横断で 0 件」(参照有無の事実)
- ✅「ComboEditor に situation 入力は実在せず、§5.7 表示項目5 のうち situation のみ未描画」(UI の事実)
- ❌「よって5体に seed 投入が必要」(判断 = 禁止)
- ❌「situation 入力を新設すべき」(提案 = 禁止)

### 7.3 全数性の徹底(本調査の核心)

本調査の価値は **M11 設計の前提となる現状を 1 件も取りこぼさないこと**。grep は両系統で実行し、ヒット 0 件の領域も「0 件であった」と明示する。判断に迷う箇所は「判断せず事実だけ記録」する(設計判断は設計担当)。

### 7.4 設計担当への質問チャネル

調査内容で迷った場合、製造担当(調査担当)は **Plan Mode CLI 直接質問**(playbook §8.4.1)で開発者を介して設計担当に確認する。直接の Q&A セッションは設けない(playbook §1 役割分離)。

### 7.5 関連教訓

本指示書は調査担当運用パターン(architecture-patterns §6)に基づく。過去例(M5〜M7-RESEARCH)の運用知見を継承する:「想定外の発見が価値」(§0.7)/「設計担当のコンテキスト温存と判断品質向上の両立」(調査担当=事実列挙、設計担当=判断)/「設計・CHANGE 判断材料の供給源」。

---

*以上、M11-RESEARCH-01 指示書 v1.0.0。配置 `docs/instructions/M11-RESEARCH-01-custom-states-situation-current-state.md`、調査結果レポートは `docs/progress/M11-RESEARCH-01-report.md`。本調査は機械レビュー不要(調査担当運用パターン)。*
