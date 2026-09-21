# M19-RESEARCH-01 調査報告 ＋ PoC デモ結果

- 対象指示書: `docs/instructions/M19-RESEARCH-01-setplay-suggestion-engine-poc.md`（v1.0.3）
- 種別: read-only 調査 ＋ PoC デモ（judgement-free・合否判定は開発者）
- 実施日: 2026-07-22（Claude Code on the Web セッション）
- 別リポ実査対象: `autopilot-combomgr/projects/setplay-suggestion`（read-only）
- 本 report は本実装 M19-01 のスコープ確定入力。**合格線・統合方式・+1 補正の要否は決定していない**（材料提示のみ）。

---

## 0. 結論サマリ（先に読む用）

1. **【調査可否】実行可能だった**（自由入力指示「調査できないなら不能と教えて」への回答）。エンジンは実在し、Go 1.24.7 で `go build`/`go test`/`go run` が通り、実データ PoC も seed DB を組んで実走できた。制約は D-4/E-2 のみ（後述）。
2. **【A-2 最重要】エンジン入力に有利フレームが入る＝YES**。公開エントリは `Suggest(knockdownAdvantage int, moves []Move, target Target, opt Options)`。`knockdownAdvantage`（KA）が第1引数の明示パラメータ。
3. **【A-1/A-4 G-4 裏取り】言語＝Go 1.24・標準ライブラリのみ＝事実確認済み**。`go.mod` に `require` 節なし・`go.sum` 不在・全 import が stdlib（`errors`/`sort`/`encoding/json`/`flag`/`fmt`/`io`/`os`）。外部依存ゼロ＝ライセンス汚染リスクなし。テスト 18 関数すべて PASS。
4. **【A-3b/D-3 オフバイワン】開発者仮説「+1 を考慮せず有利フレーム値そのもの（例 40）で計算」は事実として裏付けられた**。マッチ条件は `Σ(空振り技 total) + target.startup == KA`（`budget := knockdownAdvantage - target.Startup`、setplay.go:114）。エンジンは **target の第1 active フレームを絶対フレーム KA に置く（KA+1 ではない）**。さらに **active 窓（持続 N フレーム目）を一切計算しない**（完全一致・目押し窓は対象外＝設計仕様、setplay.go:99-100 / INTAKE §1）。
5. **【D-2 golden-case】Appendix A の 5 件は strict 基準（期待レシピ一致 かつ 着弾が KA+1 側）で 0/5 再現**。GC-5（ガイル）のみ期待レシピをエンジンが出力するが、その着弾（第1 active）は KA(34) で KA+1(35) ではない。残り 4 件はエンジンの exact-match 算術と golden の frame が一致せず（後述表）。
6. **【E 母集団】クラウド clone の seed DB は combos=0・setups=0・combo_setups=0・setup_steps=0**。moves のみ 944 行（うち total>0 が 834 行）。combos に `knockdown_advantage` を投入する seed は皆無、かつ durability コンボ seed（000012）は 000017 で削除され再投入されない＝**seed の事実**。したがって **D-4（既存 combo_setups からの recall）と E-2 の実測は「母集団 0」で未測定**。開発者の個人 DB（実コンボ・実セットプレイ）はクラウドに存在しない。
7. **【要決定事項】** `knockdown_advantage` の意味論（無敵ダウン時間か／行動可能フレームか）と +1 補正・active 窓モデルの要否が最大論点（§末尾 要決定事項 7）。DES-003 §3.4 の定義（L345「ダウン後の有利フレーム数」）は意味論を明示しておらず、DES 反映候補。

### PoC 実行方法（再現用・ハーネスは `/tmp` 使い捨て＝リポに残さない）
- エンジン単体: `cd autopilot-combomgr/projects/setplay-suggestion && go test ./...` / `echo '<JSON>' | go run ./cmd/setplay`（INTAKE §3 の例で確認）。
- seed DB PoC: `/tmp/poc` に独自 go.mod（`go 1.25`・`modernc.org/sqlite v1.50.0` + エンジンを `replace` で実物 import）を置き、`combomgr/migrations/*.up.sql` を連番で raw 適用して seed DB を構築 → 実エンジン `setplay.Suggest` を呼ぶドライバ。**本体 DB 原本・両リポのソースは 1 バイトも変更していない**。

---

## A. 別リポエンジンの実体（I/O 契約・言語・アルゴリズム・動作可否）

### A-1 実在・構成・言語（G-4 裏取り）
- **実態**: `autopilot-combomgr/projects/setplay-suggestion/` に実在。構成＝`setplay/setplay.go`（本体・223 行）・`setplay/setplay_test.go`（テスト）・`cmd/setplay/main.go`（デモ CLI・JSON I/O）・`go.mod`・`INTAKE.md`。
- `go.mod`: `module github.com/plexiblinp/autopilot-combomgr/projects/setplay-suggestion` / `go 1.24` / **`require` 節なし**。
- **`go.sum` 不在**（外部依存ゼロの決定的証拠）。全 `.go` の import は stdlib のみ＝`errors`/`sort`（本体）、`encoding/json`/`flag`/`fmt`/`io`/`os`（CLI）、加えて自パッケージ import のみ。
- **契約・正典との差**: なし（stdlib-only は本体 combomgr のライセンスポリシー〔SUPP-001 §5.7〕に完全適合）。
- **後続含意**: 統合方式の候補は「`internal/` へ純ロジック移植」が最有力（外部依存ゼロゆえ vendoring 不要）。別プロセス化の必要性は薄い。
- **推奨**（決定しない）: (a) `internal/service/setplay` へ移植 or (b) `internal/model` へ型・`internal/service` へロジック分割。いずれも実現可能。

### A-2【最重要】公開エントリのシグネチャと KA 入力の有無
- **実態**: 公開関数は 2 つ。
  - `func DefaultOptions() Options`（setplay.go:75）
  - `func Suggest(knockdownAdvantage int, moves []Move, target Target, opt Options) ([]Suggestion, error)`（setplay.go:103）
- 型定義（実値引用）:
  - `type Move struct { Name string; TotalFrames int }`（`json:"name"`/`json:"totalFrames"`）
  - `type Target struct { Name string; Startup int }`（`json:"name"`/`json:"startup"`）
  - `type Suggestion struct { Fillers []Move; Target Target; TotalFrames int }`
  - `type Options struct { AllowRepeat bool; MaxFillers int; MaxResults int }`
- **入力に有利フレームが入るか＝YES**。`knockdownAdvantage`（＝KA＝ダウン後有利フレーム）が `Suggest` の第1引数。入力全体＝「KA ＋ 空振り候補 moves（name/total）＋ 当てたい技 target（name/startup）＋ 探索 Options」。
- **契約・正典との差**: `Move.TotalFrames`↔`moves.total`、`Target.Startup`↔`moves.startup`、`Name`↔`moves.code` の対応が想定（INTAKE §5）。DES-003 §3.3 と整合。
- **後続含意**: 指示書 §開発者確認事項 Q1 の前提（有利フレームが入る）が確定。グルーは「KA → 当てたい技を列挙 → 各技を target に据えて Suggest を呼ぶ」構成になる（列挙規則＝Q3・M19-01）。

### A-3 レシピ探索アルゴリズム
- **実態**: subset-sum。`budget := knockdownAdvantage - target.Startup`（:114）を、空振り技の `TotalFrames` 合計で**ちょうど**埋める。`sanitize`（:144）で非正 total を除外・完全重複を dedup・total 昇順（同値は Name 昇順）に整列。`computeMaxDepth`（:169）で探索深さ上限＝`budget / 最小total`。反復深化（空振り技数 k を 0 から増加、`searchDepth` :184）＝**少手数の提案を先に生成**。枝刈り＝残予算超過で break・下限枝刈り（最小total×depth が残予算に届かなければ打ち切り）。
  - (i) **相手起き上がりタイミングの扱い**: 「first-active が KA になる」以上のモデルなし（後述 A-3b）。
  - (ii) **meaty active 窓の計算**: **なし**。「完全一致（発生ちょうどの最速重ね）のみ・持続フレームによる目押し窓は扱わない（MVP 仕様）」とコメント明記（:99-100）。
  - (iii) **filler で有利フレームを消費**: あり。空振り技が `total` を消費。`AllowRepeat`（既定 true）で同一技の複数回空振り可。
- **契約・正典との差**: active 窓非計算は「エンジン既存範囲外」であり M19 のグルー/エンジン改修候補（判定は開発者）。
- **後続含意**: golden-case が「持続 N フレーム目で当てる」前提（Appendix A）なのに対し、エンジンは active-1 を KA に合わせるだけ＝両モデルは構造的に異なる（D-2/D-3 で実測）。

### A-3b【オフバイワン・最重要級】KA そのものか KA+1 か
- **実態（該当行引用）**:
  - パッケージ doc（setplay.go:8）: `Σ(空振り技の全体フレーム) + 当てたい技の発生 = KA`。
  - `budget := knockdownAdvantage - target.Startup`（:114）。
  - マッチ成立は `depth==0 && remaining==0`（:188-197）＝`Σfiller.total == budget`＝**`Σfiller.total + target.Startup == KA`**。
  - `Suggestion.TotalFrames` は「常に入力の knockdownAdvantage に等しい」（:52-54）。
  - **`+1` 補正・無敵明けオフセットの定数/式は実装に存在しない**（`grep` で `+1`/`wakeup`/`invuln`/`meaty` はコメント含め 0 件）。
- **判定（事実）**: エンジンは **KA そのもの（例 40）** で解く。**target の第1 active フレームを絶対フレーム KA に置く**（標準的なフレーム勘定＝空振りが 1..Σtotal を占め、target 入力が Σtotal+1、first-active が Σtotal+startup=KA）。**開発者仮説「先行実装は +1 を考慮せず有利フレーム値そのもので計算していた可能性が高い」は事実として裏付けられた**（judgement ではなく「実装が N か N+1 か」の事実 = N）。
- **契約・正典との差**: DES-003 §3.4 L345「knockdown_advantage｜ダウン後の有利フレーム数」は**無敵時間か行動可能フレームかを明示していない**（前提事実 8 の通り）。この意味論の曖昧さが +1 論点の根。**DES 反映候補**。
- **後続含意**: 開発者の meaty モデル（無敵ダウン、起き上がり＝KA+1 に active を重ねる）を採るなら、エンジンのマッチ条件（現状 `== KA`）を 1 箇所調整（`== KA+1` 相当）＋ active 窓の導入が要る。INTAKE §4 も「ズレがあればマッチ条件（現状は等値）を 1 箇所調整すれば対応可能」と自己申告。

### A-4 動作可否
- **実態**: `go test ./...` → `ok github.com/.../setplay 0.003s`（テスト関数 18 個: `TestExactMatchNoFiller`〜`TestZeroOptionsDisallowsRepeat`、すべて PASS）。`go build`・`go vet` クリーン（INTAKE §3 申告と一致）。CLI 実走（INTAKE の例 `KA=46, target 236P su13, moves 5LP(11)/step(22)`）→ budget 33 を `5LP+step` と `5LP×3` の 2 通りで少手数順に返すことを確認。
- **後続含意**: 動作する既存資産＝そのまま移植の土台にできる。

### A-5 前提データ形状
- **実態**: `Move.Name`＝表示/識別（`moves.code` を渡す想定・INTAKE §1/§5）、`Move.TotalFrames`＝空振り消費フレーム（`moves.total`）、`Target.Startup`＝発生（`moves.startup`）。**非正（≤0）total は「未設定/NULL」とみなし黙って除外**（sanitize :148）。同名・異フレームは別候補（dedup は Name+total 完全一致のみ）。`Options` ゼロ値は `AllowRepeat=false`＝必ず `DefaultOptions()` 起点に上書きが必要（INTAKE §4 の落とし穴）。
- **契約・正典との差**: 技コード体系はエンジン側で独自定義せず**不透明文字列の素通し**＝DES-004 の正典（英語表示名の機械変換 code）をグルーが渡せば整合。

---

## B. 旧式化突合（エンジン前提 vs 現行 DES-003/DES-004）

### B-1 moves frame フィールド
- **実態**: エンジンが読むのは `total`（空振り）と `startup`（target）のみ。現行 DES-003 §3.3＝`startup`/`active`/`total`/`recovery` はいずれも NULL 可。`total = startup + active − 1 + recovery`（案B・CHANGE-028、DES-003 L310-314）で算出、算出不能行は NULL。エンジンは `total ≤ 0`/NULL を黙って除外（sanitize）。target の `startup ≤ 0` は `ErrInvalidTargetStartup` を返す（:107-109）。
- **契約・正典との差（事実）**: DES-003 L320/322「公式備考『空振り時硬直 N フレーム増加』は `total` に算入せず、利用者が手動微修正」＝**空振り時硬直が変動する技を空振り候補に入れると、エンジンの total 消費が実挙動とズレる**（INTAKE §4 の既知割り切りと一致）。
- **後続含意**: グルーが空振り候補を集める際、空振り時硬直変動技の扱いを本実装で決める必要（判定は開発者）。

### B-2 技コード体系
- **実態**: エンジンは技コードを独自体系で持たず `Name string` の不透明素通し。したがって DES-004 v1.14.0 の表記正典との**乖離（旧コード・改名・欠落）はエンジン内に存在しない**。整合性はグルーが `moves.code` を渡すかどうかに依存。
- **契約・正典との差**: なし（エンジンは code 体系非依存）。

### B-3 M18 由来の新列の影響
- **実態**: エンジンはフレーム数値（total/startup）のみ扱い、`is_derived`（マイグレ 000032・実在）・`hit_type`（combos・CHANGE-006 の既存列）・その他フラグを一切参照しない＝**認識しないことによる機能影響はなし**。
- **想定外の発見（§0.3 事実指摘）**: 指示書 B-3 が例示する `moves.is_projectile` と `materialized_from_combo_id` は**現行 migrations に存在しない**（`grep` で DDL ヒット 0 件）。`hit_type` は M18 由来の新区分ではなく CHANGE-006（`counter_type`→`hit_type`、値＝`normal`/`counter`/`punish_counter`）の既存列。※指示書の前提列挙に現状スキーマと合わない項目がある旨を事実として記録（取込担当が本体最新で確認）。
- **後続含意**: エンジンは frame-only ゆえ M18 系スキーマ変化に鈍感＝旧式化リスクは「フレーム意味論」（B-1/A-3b）に限局。

### B-4 互換ギャップの事実列挙
- エンジンが参照する `moves.total` … 現行スキーマに `total INTEGER NULL可` として**存在**（model.Move: `Total *int`）。
- エンジンが参照する `moves.startup` … 現行スキーマに `startup INTEGER NULL可` として**存在**（model.Move: `Startup *int`）。
- エンジンが渡す識別子 `moves.code` … 現行スキーマに `code TEXT NOT NULL UNIQUE(character_id,code)` として**存在**。
- エンジンの候補源として想定される `moves.setup_only`（予約列）… 現行スキーマに `setup_only INTEGER NOT NULL DEFAULT 0` として**存在**（DES-003 L277「将来のセットプレイ自動提案機能のための予約列。本フェーズではフラグ保持のみ・利用ロジック未実装」）。**seed で `setup_only=1` の行は 0 件**（E-3）。
- **不在による欠落ギャップ＝なし**（エンジンが読む列はすべて現行スキーマに存在）。M14-d `moves-input-tool`「旧式の可能性」型のカラム・ドリフトは**エンジン側には未検出**。旧式化は列不整合ではなく**フレーム意味論（+1・active 窓）**に集約される。

---

## C. グルー層の分界（エンジン既存 vs M19 新規）

### C-1 「有利フレーム → 当てたい技の列挙」
- **実態**: エンジン内に**なし**（`target` は入力で受ける）。本体 combomgr にも生成ロジックなし。既存 `GET /api/combos/:comboId/setup-candidates`（FR011）・`GET /api/setups/candidates?characterId=X&knockdownAdvantage=Y`（C-08）は `service.GetSetupCandidatesByKnockdown` → `repo.FindCandidateSetups`＝**既存 setups の DB 検索**であり、frame からのレシピ生成ではない（＝指示書前提事実 5「FR011 は転用ヘルパーでエンジンではない」を裏取り）。
- **後続含意**: **M19 新規**（advantage→当てたい技の列挙規則＝Q3/M19-01）。

### C-2 ランキング
- **実態**: エンジンは**少手数順（反復深化）→ 同手数内は候補 total 昇順（同値 Name 昇順）**で並ぶ。`MaxResults`（既定 200）到達で打ち切り。それ以上の優先度基準（実用性・技種重み等）は**なし**。
- **後続含意**: 実用寄りランキングが要るなら **M19 新規**。

### C-3 採択 → 保存
- **実態**: エンジンに保存連携は**なし**。本体には `setups`/`setup_steps`/`combo_setups`（DDL 000001）＋ `CreateSetup`/`CreateSetupLink`/`CreateSetupInTx` 等の API が既存。INTAKE §5 は `Suggestion.Fillers`＋`Target` → 順序付き `setup_steps`（move_id 列＋最終 target ステップ）→ `combo_setups` で対象コンボ紐付け、を想定。
- **後続含意**: **既存 setups API 再利用の見込み**（M19 は結線＝グルー）。新テーブル不要の見込み（指示書前提事実 6 と整合）。

### C-4 提案 UI の受け皿
- **実態**: `web/src/features/combo/components/SetupSelectorModal.tsx`（＋ `.test.tsx`・`SetupRegistrationSection.tsx`）が実在＝候補面。DES-005 §5.6 項目11（転用可能候補＝提案 UI 相乗り先）・§5.13a（selectedIds＝入口には使わない）。
- **後続含意**: 表示先の器は存在。提案結果 DTO の形状合わせは M19-01（C-4）。UI は本調査対象外（作らない）。

---

## D. PoC 品質デモ（実データ実行・合否判定は開発者）

### 前提（母集団の実状）
seed DB（migrations から構築）の combos=0・setups=0・combo_setups=0（E 参照）。よって PoC 入力は **Appendix A の KA 値 ＋ seed moves の frame（total/startup）** で構成。始動コンボ自体は DB 非依存（Appendix A が文脈として KA を与える）。

### D-2【主判定軸】golden-case 再現表
hit 基準（指示書 Appendix A）＝**エンジン出力レシピが期待レシピと一致し、かつ着弾が KA+1 側で成立**。全 golden-case moves は seed に解決でき frame も非 NULL（E-3）。

| # | キャラ | KA | 期待レシピ（filler>target） | 実 frame（Σfiller.total + target.startup） | ==KA? | エンジン出力（実値） | 期待レシピ hit? | 着弾(第1active) | KA+1 側? |
|---|--------|----|------------------------------|------|-------|----------------------|-----------------|-----------------|----------|
| GC-1 | リュウ | 40 | 立ち弱K(18) > 鎖骨割り(su20,act4) | 18+20=**38** | ✗ | **0 件**（budget=20 に合致する組合せなし） | ✗ | 38 (=KA−2) | ✗ |
| GC-2 | ケン | 43 | 奮迅脚(45) > 紫電カカト落とし(su29,act3) | 45+29=**74** | ✗ | 別レシピ `crouching_light_punch(14) > thunder_kick` (43F) | ✗ | 74 (≫KA) | ✗ |
| GC-3 | ジュリ | 27 | 立ち中P(21) > 前投げ(su5,act3) | 21+5=**26** | ✗ | 別レシピ `sa2_feng_shui_engine(7)+crouching_light_kick(15) > throw_forward` (27F) | ✗ | 26 (=KA−1) | ✗ |
| GC-4 | テリー | 27 | しゃがみ弱K(17) > 中K=立ち中K(su9,act3) | 17+9=**26** | ✗ | 別レシピ `standing_light_kick(18) > standing_medium_kick` (27F) | ✗ | 26 (=KA−1) | ✗ |
| GC-5 | ガイル | 34 | ニーバズーカ(27) > 立ち中P(su7,act3) | 27+7=**34** | ✓ | `knee_bazooka(27) > standing_medium_punch` (34F)＝**期待レシピ一致** | △(レシピ一致) | 34 (=KA) | ✗ |

- **結論（事実）**: strict 基準（レシピ一致 かつ 着弾 KA+1 側）で **0/5 hit**。GC-5 のみ期待レシピをエンジンが出力するが、着弾（第1 active）は KA(34) で **KA+1(35) ではない**。
- **なぜ 4/5 で不一致か（事実）**: golden-case は「target の active-N 目（N=2/3/4）が起き上がり KA+1 に重なる」前提で frame が引かれている。エンジンは「target の active-1（startup）を KA に合わせる」exact-match のみ。両モデルが構造的に異なるため、golden の `Σfiller.total + target.startup` は KA と一致しない（38/74/26/26/34）。

### D-3【オフバイワン】着弾が KA 側か KA+1 側か
- **合成デモ（決定論）**: `KA=40, target.startup=30, fillers 候補 {10,5}` → 提案 2 件 `[fillerA(10)]`・`[fillerB(5)×2]`、いずれも `Suggestion.TotalFrames == 40`。**提案の TotalFrames は常に KA**。
- **事実**: エンジンは target の第1 active を**絶対フレーム KA** に置く（KA+1 ではない）。前提事実 8（無敵ダウン＝KA、起き上がり＝KA+1）を採るなら、第1 active が KA に落ちる技（active=1 の技）は**起き上がり(KA+1)より 1F 早く無敵に空振り**する。golden-case でも着弾は全件 KA 以下側（38/74/26/26/34）で、KA+1 側に載ったものは 0 件。**系統的な「KA 側（=N 側）で解く」挙動を確認**（A-3b と一致）。
- 補足（判定しない）: active 窓を持てば、active-2 が KA+1 に載る（GC-3/GC-5 は N=2）ケースは救える余地があるが、エンジンは active 窓を持たない（A-3）。

### D-4【副次】recall（既存 combo_setups 再現率）
- **未測定（母集団 0）**。seed DB の `combo_setups`=0・`setups`=0（E-2）。クラウド clone に開発者の個人紐付けデータが存在しないため、「手動紐付けの何割をエンジンが再現できるか」は本環境で測れない。
- 代替提示: golden-case を当てたい技起点で与えた再現（D-2）＝strict 0/5・レシピ一致 1/5。実 recall が要るなら開発者の実データ供給（ローカル実行）が前提（要決定事項 6）。

### D-5 性能（参考値・合否判定しない）
| キャラ | 候補 moves | KA=20..60 全 41 回 Suggest の合計時間 | 1 回あたり概算 |
|--------|-----------|--------------------------------------|----------------|
| ryu | 84 | 0.86 ms | ~21 µs |
| ken | 80 | 0.81 ms | ~20 µs |
| juri | 73 | 0.88 ms | ~21 µs |
| terry | 70 | 0.70 ms | ~17 µs |
| guile | 88 | 2.83 ms | ~69 µs |
- **事実**: 1 コンボ（1 KA・1 target）あたりの導出は概ね数十 µs、キャラ全 moves 走査でも ms 未満〜数 ms。NFR001（DB 操作 100ms）の参考として桁は十分小さい（合否は開発者）。`AllowRepeat=true` ＋ 大 KA ＋ 小 total 候補が多いキャラ（guile）で提案数・時間が増える傾向。

---

## E. 母集団実測（seed DB へ SELECT）

### E-1 knockdown_advantage 非 NULL のコンボ数・キャラ別分布
- **実態**: `combos` 総数 **0**、`knockdown_advantage` 非 NULL **0**、キャラ別分布は空。
- **事実の根拠**: (1) 唯一の combos seed（000012 durability・36 件）は `knockdown_advantage` を**投入しない**（列＝character_id/is_draft/position/opponent_stance/hit_type/damage/step_count/memo のみ）。(2) その 36 件（aki/jamie/guile）は 000017（`DELETE FROM combos` 他）で削除され、以降 combos を再投入する seed はない。(3) `combos.knockdown_advantage` に値を入れる INSERT/UPDATE は全 migrations に皆無（ヒットは rebuild の列名のみ）。
- **後続含意**: クラウド seed 単体では KA 母集団が実質ゼロ。KA を持つのは開発者の個人 DB 側のみ。

### E-2 combo_setups / setups / setup_steps 件数
- **実態**: `setups`=**0**、`setup_steps`=**0**、`combo_setups`=**0**（seed に INSERT 皆無）。
- **後続含意**: 既存紐付けからの学習・recall（D-4）は本環境では不能。UI/保存経路の実データ検証は開発者ローカルが要る。

### E-3 golden-case 入力の seed 充足
- **実態**: `characters`=12（うち frame 入り 10＝guile/ingrid/juri/ken/kimberly/lily/mai/ryu/terry/zangief、frame 無し stub 2＝c_viper/dhalsim〔moves 各 9・total 全 NULL〕）。`moves`=944（`total>0`=834）。`setup_only=1`=**0 件**。
- Appendix A の 5 件で必要な moves は**全て seed に解決でき、total/startup とも非 NULL**（GC-1 立ち弱K/鎖骨割り、GC-2 奮迅脚→quick_dash/紫電カカト落とし→thunder_kick、GC-3 立ち中P/前投げ→throw_forward、GC-4 しゃがみ弱K/中K→standing_medium_kick、GC-5 ニーバズーカ→knee_bazooka/立ち中P）。
- **薄い箇所**: (a) `setup_only` フラグ立ての seed 行が 0＝エンジンの「空振り候補」自然フィルタ（INTAKE §5）が現 seed では効かない（全 moves が候補になる）。(b) frame stub の 2 キャラ（c_viper/dhalsim）は total 全 NULL＝PoC 対象外。(c) KA を持つ実コンボ・実セットプレイが seed に 0。
- **後続含意（要決定事項へ）**: golden-case の moves 充足は足りるが、KA 母集団・setup_only 運用・実 recall 検証には**開発者の実データ追加（またはローカル DB での再走）**が要る（要決定事項 6）。

### harness の忠実性に関する注記（限界の明示）
- seed DB は golang-migrate ではなく `*.up.sql` を連番で raw 適用して構築した。moves(944)・aliases・characters は本体と整合し、golden-case の実フレームも取得できた＝PoC が使うデータは忠実。combos=0 は 000017 の `DELETE` に起因する**真の seed 事実**（harness 由来の欠落ではない）。テーブル再構築マイグレ（000016/000019/000021）の raw 再適用と golang-migrate の完全一致は未検証だが、PoC が参照するデータ（moves/frame）には影響しない。

---

## 本実装（M19-01）スコープ確定のための要決定事項

1. **エンジン統合方式**（`internal/` 移植 or 別プロセス）＝A-1/A-4 の結果、**Go stdlib-only ゆえ `internal/service/setplay` 等への純ロジック移植が有力**（外部依存ゼロ）。移植先レイヤ（service/model 分割）を確定要。
2. **旧式化ギャップの是正範囲**＝B-4 のとおり列不整合は無し。是正対象は「フレーム意味論」に限局（下記 7 と一体）。空振り時硬直変動技（B-1）の扱いを決める要。
3. **グルー層の新規実装範囲**＝C-1（advantage→当てたい技の列挙規則＝Q3）・C-2（実用ランキングの要否）を M19-01 で確定。エンジン自体は target/ランキング未内包＝新規。
4. **提案 UI の相乗り**＝C-4（DES-005 §5.6 項目11 の候補面・selectedIds 非入口）。提案結果 DTO と `SetupSelectorModal` の props 整合を確定要。
5. **永続方針**＝C-3。既存 `setups`+`setup_steps`+`combo_setups` 再利用で足りる見込み（新テーブル不要）。`Suggestion`→`setup_steps` 写像（順序・move_id・最終 target ステップ）を確定要。
6. **母集団不足時の実データ追加要否**＝E-1/E-2/E-3。クラウド seed は KA・setups・combo_setups が 0。**実 recall（D-4）と保存経路検証には開発者の実データ供給かローカル実行が前提**。PoC を本番品質で回すなら実データ追加が要る。
7. **【最重要】`knockdown_advantage` の意味論確定と +1・active 窓の要否**＝A-3b/D-2/D-3。エンジンは現状 **KA そのもの（N）で target 第1 active を KA に置き、active 窓を持たない**。開発者の meaty モデル（起き上がり=KA+1、持続 N 目で重ねる）を採るなら、(i) マッチ条件を `==KA` から `==KA+1` 相当へ 1 箇所調整、(ii) active 窓（持続 N フレーム目のいずれかが KA+1 に載る範囲判定）の導入、の 2 点が本実装/エンジン改修スコープに入る。**DES-003 §3.4 L345 の定義（無敵時間か行動可能フレームか）の明確化＝DES 反映候補**（本サブでは DES を直接改訂しない＝中央へ「DES 反映要点」として請求）。

---

## 完了条件チェック（指示書 §6）
- [x] A〜C・E 全項目を実値で報告。確認不能（D-4）は「未測定・母集団 0」と明記。
- [x] A-2（入力に有利フレームが入る＝YES）と A-1/A-4（Go stdlib-only の裏取り＝G-4）を事実確定。
- [x] B-4 の互換ギャップを事実列挙（列不整合なし・旧式化はフレーム意味論に集約）。
- [x] D-2 golden-case 再現表（0/5 strict・レシピ一致 1/5）＋ D-3（KA 側で解く事実）/D-4（未測定）/D-5（性能実測）。
- [x] read-only を逸脱していない（両リポのソース・マイグレ・seed・DES/REQ・DB 原本を変更していない。PoC ハーネスは `/tmp` 使い捨て）。
- [x] 採番していない（要決定事項 7 の DES 反映は中央へ請求）。
- [x] 末尾「要決定事項」を Plan Mode 入力粒度で 7 項そろえた。

*以上、M19-RESEARCH-01 調査報告 ＋ PoC v1.0.3 対応。judgement-free（合格線・統合方式・+1 補正の要否は開発者判定）。*
