# M19-RESEARCH-04 追補調査報告（X-1 / X-2）

| 項目 | 内容 |
|------|------|
| 文書ID | M19-RESEARCH-04-report-addendum |
| バージョン | 1.0.0 |
| 依頼書 | `docs/instructions/M19-RESEARCH-04-addendum.md` v1.0.0 |
| 本編 | `docs/progress/M19-RESEARCH-04-report.md` v1.0.0 |
| 調査日 | 2026-07-31 |
| 追補時点の HEAD | 作業ツリー HEAD＝`d25cfec`（＝本編基準 `06c9175` ＋ 本編成果物の docs 2 コミットのみ。**調査対象のコード・マイグレ・CSV・テスト・コマンド定義は `06c9175` から不変**）。リモート main の現在位置は本セッションから検証不能（`git fetch` はプロジェクト設定で deny・clone 時点の `origin/main`＝`06c9175`） |
| 様式の選択 | **別ファイル方式**を選択（本編 v1.0.0 を確定版のまま保つため。依頼書「どちらでもよい・選んだ方を報告」に基づく） |
| read-only | 遵守（書き込みは本レポートと依頼書配置のみ） |

---

## 結論サマリ

1. **X-1: 保護機構は「`precheck_seed_data` コマンド実行時の対象決定ゲート」であり、CSV ファイルの書き換え操作一般を機械的に阻む仕組みではない**。実体はリポジトリ内の Claude Code カスタムコマンド `.claude/commands/precheck_seed_data.md`（プロンプト実装・Go バイナリではない）。hooks / settings.json に `character_data/` への書込を阻むガードは存在しない（grep 0 件）。
2. **X-1-d の判定: 「新列を追加した CSV を保存する操作」はこの保護に抵触しない**（判定できた）。理由は 2 点——(1) 保護の発動点は `precheck_seed_data` の Phase 0 手順 4 のみで、同コマンドを経由しない CSV 編集には作用しない。(2) 仮に同コマンドを経由しても、**現在の `seed-progress.md` は全 15 キャラが `seed_imported=未`**のため警告条件（`済` のキャラを対象に含む）は現状 1 キャラも成立しない。
3. **矛盾の事実指摘: seed 済み 10 キャラ（000026/000030 で配布 seed 投入済み）も `seed_imported=未` のまま**であり、進捗表が実態と乖離している（列の更新は「seed 投入工程/開発者が手動更新」とされ、未更新）。**保護機構は表が正しく更新されて初めて意味を持つ**。
4. **X-2: 「CSV の特定列から backfill マイグレを生成する」機構は存在するが、列は汎用化されていない**。`-mode derived-backfill` は `is_derived` 列に**ハードコード**（対象列・SET 句とも引数化されていない）。**is_projectile の backfill（000039）と movement total（000041）は seedgen 生成ではなく手書き**（生成マーカーなし・golden なし・対応モードなし）。
5. **新列 3 本の backfill を seedgen で生成する場合、既存モードの拡張でも新モードでも、CSV 列追加に伴う共通改修（`csvColumns`／`parseRow`／`MoveRow`／`testHeader`＋単体テスト 12 本の行データ 20 フィールド前提）が支配的**。golden 4 stem は「読めるようにした後、出力を変えない限り」green のまま（本編 A-3 と整合）。

---

## X-1. `seed_imported=済` の保護機構

### X-1-a. 「コマンド」の実体

**実態**: **リポジトリ内**。`.claude/commands/precheck_seed_data.md`（134 行・Claude Code カスタムコマンド＝プロンプト実装。Go の実行バイナリ・シェルスクリプトではない）。`allowed-tools: Read, Grep, Glob, Bash, Edit, Write`（同ファイル `:4`）。手入力ツール（別 go module）側の機構ではない。

補足（機械的ガードの不在確認）: `.claude/hooks/` は `notify-bell.sh` / `post-edit-check.sh` / `pre-push-guard.sh` / `stop-test.sh` の 4 本のみで、`character_data` / `seed-progress` への言及は **hooks・settings.json とも 0 件**。`post-edit-check.sh` は `.go` / `.ts(x)` のみ検査対象（`:19-28`）で CSV は素通し。**CSV 書込をブロックする機械強制は存在しない。**

### X-1-b. 保護の発動条件

**実態**: 発動点は `precheck_seed_data.md` の **Phase 0 手順 4**（`:79`）:

> 「**既配布の保護**: 対象に `seed_imported=済` のキャラが含まれる場合、**警告して停止**し開発者の明示承認を待つ(既配布 CSV の変更は後続 UPDATE マイグレ扱いになるため)」

（禁止事項 `:132` にも同旨「`seed_imported=済` のキャラを対象に含む場合は警告停止し、開発者の承認を得る」。）

「修正対象に含める」の具体的意味＝**同コマンドの対象決定（Phase 0 手順 3、`:76-78`）でそのキャラが対象に入ること**。対象になるのは (a) 引数でキャラ名を明示指定した場合、(b) 引数省略時に `precheck` 列が「済」でない場合、の 2 経路。**CSV の書き換え全般でも特定の列でもなく、「このコマンドの実行対象への選入」がトリガー**である。停止は絶対拒否ではなく「開発者の明示承認を待つ」ゲート（`:79`）。なお実際の書込自体も Phase 3（承認後）に限定され（`:64` 「Phase 1 は完全 read-only」）、修正は「原則 `command` 列など**対象列だけ**」（`:103`）とされている。

### X-1-c. `seed-progress.md` の現在の内容

**実態**（`character_data/seed-progress.md`・全 29 行・commit `06c9175` 時点＝現在も同一）: 登録 15 キャラ全行が **`precheck=済`・`seed_imported=未`**。

| character_code | precheck | seed_imported |
|---|---|---|
| terry / guile / zangief / lily / juri / mai / ingrid / kimberly / ken / ryu | 済 | **未** |
| jamie / luke / manon / m_bison / rashid | 済 | **未** |

**矛盾の事実指摘**: 上段 10 キャラは本編 D 軸のとおり **000026/000030 で配布 seed へ投入済み**だが、`seed_imported` は「未」のまま。同ファイル `:7` は「**seed_imported** = 配布 seed への取込(投入)が完了したか(**seed 投入工程/開発者が手動更新**。コマンドは読むだけ)」と定義しており、**手動更新が行われていない状態**である。したがって**保護機構の警告条件は、現時点ではどのキャラに対しても成立しない**。

### X-1-d. 新列を追加した CSV の保存は保護に抵触するか

**判定: 抵触しない（判定できた）。** 根拠:

1. **経路の限定**: 保護は `precheck_seed_data` コマンドの Phase 0 対象決定に限定して定義されており（X-1-b）、CSV ファイルへの書込操作そのものを検査・阻止する機械的機構（hook・設定・ファイルガード）はリポジトリに存在しない（X-1-a の 0 件確認）。M19-04 の製造サブが `precheck_seed_data` を経由せず CSV を編集する場合、この保護が作動する場面は無い。
2. **条件の不成立**: 仮に `precheck_seed_data` 経由で seed 済み 10 キャラを修正対象にしても、現在の進捗表は全キャラ `seed_imported=未` のため警告条件が成立しない（X-1-c）。

**契約・正典との差**: 保護の設計意図（`seed-progress.md:10`「既配布 CSV の変更は後続 UPDATE マイグレ扱いになる」）は本編 C-2 の実測（CSV 変更が既存 DB に届く唯一の方法＝新連番マイグレ）と整合しているが、**運用実態（`seed_imported` 未更新）により保護が空振り状態**である点が文書の前提と食い違う。

**後続スコープへの含意**: M19-04 が seed 済み 10 キャラの CSV に新列値を書き込む作業手順は、**保護機構によって変わらない**（保護を外す／例外を設ける必要が無い）。一方、書込を掣肘する仕組みが実質何も無いことも同時に確定した。

**推奨（併記・決定しない）**:
- 案 1: `seed_imported` 列を実態（10 キャラ「済」）へ更新してから M19-04 に着手する（保護が本来の意味を持つ状態に直す。ただし更新は「開発者が手動更新」と定義されている）。
- 案 2: 現状のまま M19-04 を進め、進捗表の乖離は別途 followup 扱いにする。
- 案 3: M19-04 指示書に「新列充填は `precheck_seed_data` を経由しない（別作業として扱う）」旨を明記し、保護との関係を手順書レベルで整理する。

---

## X-2. 新列の backfill マイグレを seedgen のモードとして作れるか

### X-2-a. `-mode` の全数と入出力・golden 対応

**実態**（`cmd/seedgen/main.go:52` `-mode` フラグ、`:56-59` mode スイッチ。全 **3 モード**）:

| mode | 生成関数 | 入力 | 出力 | golden |
|---|---|---|---|---|
| `moves`（既定） | `Generate`／`GenerateWithHeader`（`generate.go:36/43`） | `character_data/<code>.csv`（`-chars` 順・省略時 `FirstWaveOrder` 9 キャラ） | moves INSERT ＋ original_move_id UPDATE ＋ alias INSERT の up/down（既定 stem `000026`、`-out` で任意 stem） | **000026**（`generate_test.go:162`）・**000030**（同 `:199`。`-chars ryu -out 000030_...` の生成物） |
| `derived-backfill` | `GenerateDerivedBackfill`（`generate_m1702.go:50`） | 同上（`-chars`/`-out` 必須＝`main.go:61-63`） | `is_derived=1/0` の UPDATE up/down | **000034**（`generate_m1702_test.go:142`） |
| `move-commands` | `GenerateMoveCommands`（`generate_m1702.go:112`） | 同上（`-chars`/`-out` 必須） | `move_commands` INSERT/DELETE の up/down | **000035**（`generate_m1702_test.go:156`） |

補助: `-check`（生成物と disk の差分検査・`main.go:117-131`）・`-index-report`。`cmd/seedgen` 自体にテストファイルは無い（`main.go` のみ）。

### X-2-b. `derived-backfill` の汎用度

**実態**: **対象列は完全にハードコード**。引数で列名を渡す仕組みは無い。

- 値の選別: `generate_m1702.go:71` `if r.IsDerived { derived = append(derived, r) }`——`MoveRow` の **`IsDerived` フィールド直参照**（bool。「値を持つ行」＝true の行）。
- SET 句: `generate_m1702.go:101` `fmt.Fprintf(&b, "UPDATE moves SET is_derived = %d\n", value)`——**列名 `is_derived` がリテラル**。up=1／down=0 の 2 値も固定（`:81-83`）。
- ヘッダ: `BackfillHeader`（`:17-29`）も is_derived 固有の説明文をリテラルで持つ。

**汎用な部分（共有ヘルパ）**: キャラ絞り込みの `charFilter`（`generate.go:186-189`）・code 列挙の `writeCodeList`（`generate.go:295-302`）・「キャラ逆順で down を結合」の運び（`generate_m1702.go:88-91`）・`validate`（dup/total 検算・両モード共用）。**「1 キャラ分の code IN (...) 列挙 UPDATE」という骨格は再利用可能な形で存在するが、「どの CSV 列を読み・どの DB 列に・どの値を書くか」は 1 モード＝1 列で焼き付ける構造**である。また新列 3 本は現状 `MoveRow` にフィールド自体が無い（`model.go:46-68`）ため、いずれの作り方でも CSV 読取り層の拡張が前提になる。

### X-2-c. is_projectile（000039）・movement total（000041）は生成か手書きか

**実態: いずれも手書き**。根拠 3 点:

1. **生成マーカーの不在**: 生成物 4 ファイル（000026/000030/000034/000035）は全て「本ファイルは cmd/seedgen が character_data/*.csv から生成した成果物(手編集しない)」の定型行を持つ（`grep -l "手編集しない" migrations/*.up.sql` の全ヒット＝この 4 件のみ）。**000039・000041 には無い**。
2. **対応モードの不在**: `-mode` は 3 つのみ（X-2-a）で is_projectile / total を出力するモードは存在しない。`internal/seedgen` 非テストコードで `is_projectile` に触れるのは CSV パース（`csv.go:110,130`）と保全コメント（`model.go:10,59`）のみ＝SQL 生成箇所 0 件。
3. **golden の不在**: `assertGolden`／golden テストの対象は 4 stem のみ（本編 A-2）。000039/000041 を byte 比較するテストは無い（`internal/infra/migration/migrate_m1801_test.go`・`migrate_m1802_test.go` は適用後の **DB 状態**を検証するもので、ファイル byte 同一性ではない）。

なお 000041 は値の一次源が「開発者提供・実測値」で **DB/CSV/マイグレのどこにも存在しない**（同ファイルヘッダ原文）ため、そもそも CSV からの生成が構造的に不可能な例である。000039 は CSV の `is_projectile` 列から生成可能な形（「CSV に載る code のみ UPDATE」・000034 と同型の列挙）だが、seedgen にモードが作られず手書きされた。

### X-2-d. 既存モード拡張 vs 新モード——触るファイルと壊れ得るテスト

**両案共通の前提改修**（CSV に新 3 列を追加して読む場合。どちらの案でも必要）:

| 対象 | 内容 |
|---|---|
| `character_data/*.csv`（15 ファイル） | ヘッダ＋全行に 3 列追加（ヘッダ厳密一致のため全ファイル同時） |
| `internal/seedgen/model.go` | `csvColumns`（20→23）・`MoveRow` へ 3 フィールド追加 |
| `internal/seedgen/csv.go` | `parseRow` の位置参照追加（enum 文字列／nullable int／bool のパース） |
| `internal/seedgen/generate_test.go:10` | `testHeader` 定数（20 列リテラル）の更新 |
| **単体テスト 12 本の行データ** | `gen()`/`genRows()` 経由でテスト本文に 20 フィールドの CSV 行をリテラルで持つテスト（`generate_test.go` 10 本・`generate_m1702_test.go` 2 本、呼出 14 箇所）が、列数固定チェックにより**全て Read 段階で fail** → 各行リテラルへのフィールド追記が必要 |
| golden 4 stem テスト | 実 CSV を読むため、CSV とパーサの更新が揃うまで fail。揃った後、**出力を変えない限り byte-identical は維持され green に戻る**（本編 A-3） |

**案 A: 既存モードの拡張**（`derived-backfill` を列パラメータ化する等）:

- 追加で触る: `cmd/seedgen/main.go`（フラグ・mode 分岐・usage コメント）・`internal/seedgen/generate_m1702.go`（`GenerateDerivedBackfill`／`buildDerivedUpdate`／`BackfillHeader` の汎用化）・`generate_m1702_test.go`（既存単体テストの呼出シグネチャ追随）。
- 壊れ得るテスト: **000034 golden**（`TestGolden_DerivedBackfillMatchesRegeneration`）——汎用化後も既定パス（is_derived）の生成物が byte-identical であることが制約になる。`TestGenerateDerivedBackfill_UpdatesOnlyDerivedCodes`（出力形の断定）。
- 性質（事実）: M14-03c §4.3.1 の許容 3 条件は「**変換規則は 1 行も変えない**・I/O 境界のみ」であり、既存生成関数の内部改変はこの枠の外に出る（同条件の再解釈または新裁定が要る）。

**案 B: 新モードの追加**（例 `-mode m19-backfill`・新ファイル）:

- 追加で触る: `cmd/seedgen/main.go`（mode enum・switch・usage）・**新規** `internal/seedgen/generate_m19xx.go`（生成関数＋ヘッダ関数）・**新規**テストファイル（単体＋golden）。
- 壊れ得るテスト: 既存生成関数に触れないため **000026/000030/000034/000035 の golden は共通前提改修が済めば無影響**。新規 golden は生成物コミット後に追加（X-2-e）。
- 性質（事実）: 000034/000035 が新設されたときの前例（M17-02＝`generate_m1702.go` を新ファイルで追加・既存 `generate.go` 非改変）と同型。

（どちらが良いかは判断しない。）

### X-2-e. golden テストを新規に追加する手順（既存パターンの実態）

既存 4 stem の書き方から、**新しい生成物に golden を付けるのに必要な要素は次の 4 点**である:

1. **note 定数**: 生成時に `cmd/seedgen -note` へ渡した説明行と**同一文字列**をテスト側に定数で持つ（例 `backfillMigrationNote`＝`generate_m1702_test.go:97-100`。ヘッダに埋め込まれるため 1 字でも違えば byte 不一致）。
2. **CSV の再読込**: 生成時と**同一キャラ順・通し RowIndex** で `ReadFile` する（例 `readM1702Rows`＝`generate_m1702_test.go:103-117`。`repoRoot(t)` ヘルパ＝`generate_test.go:225-241` でリポジトリルート解決）。
3. **生成関数の呼出し**: 生成時と同じヘッダ関数・stem・note で呼ぶ（例 `GenerateDerivedBackfill(m1702CharOrder, readM1702Rows(t), BackfillHeader("000034_backfill_moves_is_derived", backfillMigrationNote))`）。
4. **byte 比較**: `assertGolden(t, stem, res.UpSQL, res.DownSQL)`（`generate_m1702_test.go:120-135`）——`migrations/<stem>.up.sql`／`.down.sql` を `os.ReadFile` し完全一致を検証する共有ヘルパ。**unexported だが同一パッケージ（`package seedgen`）内のため、新規 `_test.go` からそのまま再利用できる**。加えて再生成コマンドをテスト関数コメントに明記する運用（`:137-141`・`:151-155` の形式）。

（`generate_test.go` の 000026/000030 は `assertGolden` 誕生前の直書き比較（`:178-189`・`:210-221`）で、同じ 4 要素を inline で持つ——新規追加時にどちらの書式へ寄せるかは実装判断。）

**契約・正典との差**: M14-03c §4.3.1 の golden 要求は「**既定出力（000026）の byte-identical**」を回帰ゲートとするものだったが、実装は新生成物にも同型の golden を追加してきた（000030/000034/000035）。新モードに golden を付ける行為自体は前例踏襲であり、文書上の追加要件は見当たらない。

**後続スコープへの含意**: seedgen 生成方式を採る場合、M19-04 の backfill マイグレは「生成物コミット → note 定数・golden テスト追加 → `-check` 通過」までが 1 セットになる（000034/000035 の運びと同一）。手書き方式を採る場合は 000039/000041 と同型（golden なし・DB 状態テストのみ）が前例である。

**推奨（併記・決定しない）**:
- 案 1: 新モード追加（案 B）＋新 stem に golden——「CSV が正本」を機械検証まで含めて成立させる（000034/000035 前例）。
- 案 2: 手書き backfill（000039/000041 前例）——seedgen・テスト群に触れないが、CSV と SQL の一致は人手検証になる。
- 案 3: 折衷——初回投入は手書き、seedgen モード化は将来 seed 波（M14-03d/e）の inline 出力判断（followup-backlog:131）と同時に検討。

---

## 要決定事項（追補分・本編 9 件への追加）

10. **`seed_imported` 列の実態乖離の扱い**（X-1-c/d）: seed 済み 10 キャラが「未」のまま＝保護機構が空振り状態。M19-04 着手前に表を直すか、followup にするか、手順書で保護との関係を明記するか（X-1-d 推奨の 3 案併記）。
11. **backfill マイグレの生成方式**（X-2-c/d/e）: seedgen 新モード（golden 付き・000034/000035 前例）か、既存モード汎用化（M14-03c 3 条件の再裁定が要る）か、手書き（000039/000041 前例・golden なし）か。
12. **CSV 列追加の共通改修の帰属**（X-2-d 前提改修）: 15 CSV・`csvColumns`・`parseRow`・`MoveRow`・`testHeader`・単体テスト 12 本の行リテラル更新を、M19-04 のどのサブ工程（または別サブ）が担うか。

---

*以上、M19-RESEARCH-04 追補調査報告 v1.0.0。read-only・judgement-free（推奨欄は複数案併記のみ・決定なし）。*
