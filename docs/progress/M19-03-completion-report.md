# M19-03 完了報告: セットプレイ成立条件の記録（受け身種別・画面端 × 成立/不成立）

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M19-03-setplay-condition-record.md` v1.0.0 |
| CHANGE | CHANGE-087（`docs/change-notes/CHANGE-087-notification.md`） |
| マイグレ連番 | **000042**（**中央払い出し・2026-07-28**。自採番ではない。詳細は §2） |
| 実施日 | 2026-07-28 |
| ブランチ | `claude/m19-03-setplay-condition-record-bxz4fy` |

---

## 1. 変更点の概要

セットプレイ提案（M19-01／M19-02）はフレーム計算のみで候補を出し間合いをモデル化していないため、実際に成立するかは**相手の受け身種別**と**コンボ終了時に相手が画面端にいるか**で変わる。その検証結果を「**コンボ × セットプレイの組**」に対して記録できるようにした。

| 層 | 変更 |
|---|---|
| マイグレ | `000042_create_combo_setup_results`（**CREATE TABLE のみ 1 本・既存テーブルへの ALTER なし**、down で DROP） |
| model | `ComboSetupResult`、`SetupResultOK`/`SetupResultNG`、`IsValidSetupResultValue`/`IsValidOkiTechType` |
| repository/setup | `setup_results.go`（組単位の一括取得・upsert・物理削除・一括 INSERT） |
| repository/combo | `MoveSetupResultReferences`（識別キー変更編集の明示再ポイント）＋ 紐付け解除系での結果行の明示削除 |
| service/setup | `setup_results.go`（値域検証 → 紐付け存在チェック → Tx）。`CreateSetup` へ「確認できた条件」の同一 Tx 記録 |
| api/setup | `PUT`/`DELETE /api/combos/:comboId/setups/:setupId/results`、`CreateSetupRequest.verifiedConditions` |
| api/combo | `SetupSummary.results` をコンボ詳細に同梱（**追加のみの後方互換**） |
| FE | `constants/setup-result.ts`、`SetupResultGrid`、`SetupResultEditor`、`useSetupResults`、項目10・項目12 への組込み |
| i18n | `setupResult.*` / `setplay.confirmedConditions*` を **ja/en 同時追加** |

変更ファイル 37 本。**`moves` 系ファイルの変更は 0 本**、**punish 系ファイルの変更も 0 本**。

---

## 2. マイグレ連番（自採番していないこと）

- **着手時に中央へ請求し、000042 の払い出しを受けた**（2026-07-28。「他レーンに消費も予約もありません。見込みどおり 000042 を割り当てます」）。
- **disk との最終突合（製造側の責務）を Plan Mode で実施**：

```
$ ls migrations/*.up.sql | wc -l                              → 41
$ ls migrations/ | grep -o '^[0-9]\{6\}' | sort -u | tail -3   → 000039 / 000040 / 000041
$ ls migrations/ | grep -c '^0000[4-9][2-9]'                   → 0（000042 以降は不在）
$ 欠番チェック（連番 1..41 と序数の一致）                        → GAP 0 件
```

末尾 000041・欠番なしを確認し、中央払い出しの 000042 と整合したため再請求は不要と判断した。

- 中央からの申し送り（「Plan Mode で `ls migrations/` を実査し、末尾が 000041 でなければ自採番せず中央へ再請求すること。中央はリポジトリを直接見られないため、払い出しは台帳・完了報告・code-facts に基づく確定であり、disk との最終突合は製造側に委ねている」）を**指示書 §9.1-3 とヘッダ表に追記済み**。

---

## 3. §3.3 着手前の実査結果（6 項目）

### 3.3-1 ★識別キー変更編集での参照引き継ぎ機構（最重要）

| 問い | 実査結果（実体のパスと関数名） |
|---|---|
| (a) UPDATE か DELETE＋INSERT か | **どちらでもない第 3 の形**。`internal/service/combo/service.go:511 UpdateWithKeyChange` が **旧コンボを論理削除**（`UPDATE combos SET deleted_at` service.go:551）→ **新コンボを INSERT して新 `combo_id` を発番**（service.go:582 `InsertCombo`）。旧行は物理削除されず残る |
| (b) `combo_setups` の再ポイント | `internal/repository/combo/repository.go:901 UpdateSetupReferences` ＝ **`UPDATE combo_setups SET combo_id = ? WHERE combo_id = ?`**。呼出は service.go:598／613／622（`carry_all`／`individual`／`SetupCarryOptions==nil`） |
| (c) 同一 Tx か | **同一 Tx**（service.go:540 `BeginTx` 〜 665 `Commit`）。`MovePunishReferences`（repository.go:914・M18-03b）も同じ Tx 内 |

### 3.3-2 E-14 突合（M18-03a／03b／03c）

- `git log --name-only --grep="M18-03a"` / `"M18-03b"` の全変更ファイルを列挙して突合した。
  - M18-03a: `internal/repository/punish/*`・`internal/service/punishfinder|punishlist`・`internal/model/recipe.go`・`web/src/features/punish/*`・`web/src/pages/PunishSearchPage.tsx`
  - M18-03b: `internal/api/combo/{dto,materialize_handler,routes}.go`・`internal/repository/combo/repository.go`・`internal/service/combo/service.go`・`internal/model/combo.go`・`web/src/features/punish/*`・`web/src/constants/punish.ts`
- `git log --grep="M18-03" -- web/src/pages/ComboDetailPage.tsx web/src/features/setup/ web/src/features/setplay/ internal/api/setup internal/service/setup` → **ヒット 0 件**。
- **M18-03b の「登録 UI」はコンボ詳細ではなく確定反撃マイリスト／探す画面**（`web/src/features/punish/components/PunishList.tsx` / `PunishTree.tsx`）に置かれており、**項目10・項目12 との UI 重複は無い**。
- **M18-03c は指示書・実装とも存在しない**（`docs/instructions/` に `M18-03-design-outline.md` / `M18-03a-*` / `M18-03b-*` のみ）。
- 交差するファイルは `internal/repository/combo/repository.go` と `internal/service/combo/service.go` の 2 本のみ。**既存要素の移動・削除はせず追加のみ**とした（E-20 の 1 本動線）。

### 3.3-3 コンボ削除は物理か論理か

- `service.Delete`（service.go:682）は **`SoftDelete`（論理削除）** → `combos` 行が残るため `combo_setups.combo_id` の `ON DELETE CASCADE` は**発火しない** → 本表の行も残る。**これは正しい挙動**（`Restore` で検証結果が戻る）。
- **紐付け解除**（`DELETE /api/combos/:comboId/setup-links/:setupId`）・`unlink_all`・`individual` は **物理 DELETE** のため結果行も消える。
- **孤児行の懸念は発生しない**：取得は必ず `combo_setups` 経由（コンボ詳細の setups 一覧）で、論理削除コンボは一覧に出ない。加えて §4.1.3 の担保として、紐付け解除系のリポジトリ関数で**結果行を明示削除**するようにした（理由は §4）。

### 3.3-4 採用ダイアログの現行実装

- 実体は**モーダルではなくインライン展開**：`web/src/features/setplay/components/SetplaySuggestionSection.tsx` の `SuggestionRow`。
- `data-testid`: `setplay-row` / `setplay-adopt` / `setplay-adopt-save` / `setplay-adopted`（キャンセルは testid なし）。
- 名前の初期値は `t("setplay.adoptNameFormat", {move, n})` で生成し input で編集可（**M19-02 delivered 契約**）。
- 保存は `setupApi.create` → `POST /api/combos/:comboId/setups` → `setupsvc.CreateSetup`。**`InsertSetup` → `InsertSteps` → `InsertComboSetup` → `RecomputeSetupCache` → `Commit` が 1 Tx**。結果行はこの Tx 内・`InsertComboSetup` の**後**に書いた。

### 3.3-5 語彙の SSOT

- `web/src/constants/oki.ts` に `OKI_TECH_TYPES = ["neutral_tech","back_tech"]`、`OKI_TECH_TYPE_LABELS = { neutral_tech: "その場受け身", back_tech: "後ろ受け身" }`。**i18n ではなく日本語固定の定数**（既存 `ComboEditorBasicFields.tsx:492` も同じくロケール非依存で表示）。
- BE 側は `internal/model/combo.go` の `OkiTechType*` と同期。
- → **この定数をそのまま import して再利用した。第 3 の語彙を作っていない。** EN ロケールでも日本語ラベルが出る点は既存挙動と同一（§8 の既知の制約 5）。

### 3.3-6 `combos.position` の値域と表示ラベル

- 値域 5 値（`internal/model/combo.go:26-30`）: `mid_screen` / `corner_self` / `corner_self_near` / `corner_opponent` / `corner_opponent_near`。
- 表示ラベルは `web/src/constants/combo-list.ts:82-86` と `web/src/features/combo/labels.ts:6-10`（日本語固定）: 「画面中央／自分画面端／自分画面端寄り／相手画面端／相手画面端寄り」。
- → **`position` の値は `in_corner` に流用していない**。新規 2 語は開発者確定で **「相手が画面端」／「画面中央」**（既存ラベルの「画面端」「画面中央」と表記を揃えた）。

> **指示書 §11 の開発者確認事項は 2 点とも着手前に確認済み（2026-07-28）**
> - §11-1 端の語彙 → **「相手が画面端」／「画面中央」**で確定。
> - §11-2 項目10 の情報密度 → **「そのまま出す」で確定**（折りたたまない。全 4 セル未検証なら非表示＝hidden-when-empty で密度を抑える）。M12-02／C-13 の「アコーディオン廃止・常時展開」判断と逆行しないため。編集 UI のみトグル展開とした。

---

## 4. ★製造が選んだ方式とその根拠（§4.1.3・§4.2・§4.3.1）

### 4.1 §4.2 識別キー変更編集での引き継ぎ ＝ **ON UPDATE CASCADE ＋ 明示再ポイントの併用**

**指示書の選択肢 (a)（明示再ポイント）と (b)（ON UPDATE CASCADE）の両方を採った。** 単独ではどちらも不十分だったため。

**(b) が必要な理由**: 本表の FK 親は `combos` ではなく **`combo_setups`** であり、その親キー `combo_id` は `UpdateSetupReferences` が**その場で UPDATE する**（§3.3-1 (b) で裏取り済み＝チェックリスト 1.3 の「親キーが実際に UPDATE される実装であること」を満たす）。アプリ接続は `PRAGMA foreign_keys = ON`（`internal/infra/db/db.go:42`）なので、`ON UPDATE CASCADE` が無いと**結果行が 1 行でもある状態でこの UPDATE が FK 違反で失敗し、キー変更編集そのものが 500 になる**。

**(b) だけでは不十分だった理由（★実測で判明）**: `infra/db.Open` は `PRAGMA foreign_keys = ON` を **`conn.Exec` した 1 接続にしか適用しておらず**、`database/sql` の接続プールは上限無しで後から張られた接続には適用されない。実測プローブで **16 接続中 7 本が `foreign_keys=OFF`** だった。FK=OFF の接続がキー変更編集を処理すると CASCADE が発火せず、**ユーザーが実機で検証した成立条件が旧 `combo_id` 側に取り残されて画面から消える（データ消失）**。

→ そこで `combo_punishes` の `MovePunishReferences` と**同じ流儀の明示再ポイント** `MoveSetupResultReferences` を併用した（`internal/repository/combo/repository.go`）。

> **「16 接続中 7 本」の再現性について**: この具体値は着手時に一度だけ実行した使い捨てプローブの計測値で、スクリプトは残していない（レビューでも再現不可と指摘された）。**恒久的に担保しているのは構造的主張の方**（`*sql.DB.Exec` による PRAGMA は 1 接続にしか適用されない／本番コードに `SetMaxOpenConns` が無くプールが無制限／生接続の既定が `foreign_keys=0`）であり、これらはいずれもコード上で独立に確認できる。**再現可能な形で残しているのは回帰テスト** `TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff`（PRAGMA 非適用の生接続を使用）である。

- **呼び出し順は `UpdateSetupReferences` の「後」**。先に子を動かすと FK=ON 下で移動先の `(新 combo_id, setup_id)` がまだ存在せず FK 違反になる。後なら、FK=ON では既に CASCADE 済みで 0 行更新の no-op、FK=OFF では実際に子行を移す。
- 同じ理由で、**紐付け解除系**（`DeleteComboSetup` / `DeleteComboSetupsBySetupID` / `DeleteComboSetupsByComboID` / `...Excluding`）でも結果行を**明示削除**した（`ON DELETE CASCADE` も FK=OFF では発火しないため）。
- **`ON DELETE CASCADE` で足りると判断していない。**
- **決定的な回帰テストを置いた**（`TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff`）。PRAGMA を一切適用しない生接続でキー変更編集を通し、結果が保たれることを検証する。**明示再ポイントを外すと本テストは 0 行＝データ消失を検知して落ちる**ことを確認済み（ミューテーション確認実施）。

> **申し送り（本サブの範囲外）**: 「`db.Open` の PRAGMA がプール全体に効いていない」は **M19-03 で作り込んだ問題ではなく既存の作り**であり、`combo_punishes` 等 M18-01 系の `ON DELETE CASCADE` にも同じ不確実性がある。根治は DSN への `_pragma=foreign_keys(1)` 付与等だが、**全テーブルの FK 強制挙動が変わる全体影響**のため本サブでは触れていない。**followup 候補として起票をお願いしたい**（§9-1）。

### 4.2 §4.1.3 「未検証」の表現 ＝ **行の有無 ＋ `result`**

- `result` は **`NOT NULL`**（マイグレで機械的に保証）。`result` に NULL や「未検証」を意味する値を入れる経路は BE に存在しない（§7 の否定形走査で 0 件）。
- 「未検証へ戻す」は **`DELETE`（行の物理削除）**。
- FE の `SETUP_RESULT_UNVERIFIED = "unverified"` は **画面表現専用の定数**で、保存値ではない。エディタは `next === UNVERIFIED` のとき `upsert` ではなく `deleteResult` を呼ぶ（テストで担保）。
- §3.3-3 の実査で「論理削除では CASCADE が発火しない」ことが判明したが、**孤児行が「未検証でない状態」として残らないこと**は (1) 取得が必ず `combo_setups` 経由であること、(2) 紐付け解除系での明示削除、の 2 点で担保した。E2E D で「解除 → 再紐付けしても以前の結果が復活しない」ことまで確認している。

### 4.3 §4.3.1 取得方式 ＝ **(a) コンボ詳細への同梱**

- 項目10 は**コンボ詳細を開いた時点で全セットプレイ分を表示する**ため、専用エンドポイントだと **N+1 の往復**になる（M19-02 の `alreadyAdopted` で同型の問題があった）。
- 実装は `ListResultsByComboID` を **1 コンボにつき 1 回だけ**呼び、`setup_id` で振り分ける。**セットプレイが何本あっても呼び出しは 1 回**であることを API テストで検証している（`calls !== 1` なら失敗）。
- `SetupSummary.results` は `omitempty` 付きの**追加のみ**。一覧（`GET /api/combos`）では取得せずキー自体が出ない。既存フィールドの型・意味は不変（後方互換テストあり）。

### 4.4 その他の判断（§9.2 の「推測で進めてよい事項」）

| 事項 | 選択 | 根拠 |
|---|---|---|
| 配置 | `setup` ドメイン配下（repository/service/api とも） | 新表の親は `combo_setups` で、それを所有するのが setup ドメイン。新パッケージを作らない |
| レスポンス型 | `model.ComboSetupResult` をそのまま返す | JSON タグが API 契約と一致（`combo_id` は `json:"-"`＝URL 側で表現）。api パッケージ間の相互 import を避けられる。`SetupStepRequest` が `model.Modifiers` を直接使うのと同じ流儀 |
| 3 状態の操作形式 | 巡回トグル（未検証 → 成立 → 不成立 → 未検証） | 要件は「3 状態が明示的に区別でき、未検証へ戻せる」のみ。1 クリックで一巡でき、`data-state` で現在値が明示される |
| `note` の出し方 | 選択中セルのインライン入力欄 | セル単位の要件を満たす最小構成。成立セルにも書ける |
| アイコン | lucide-react の `Check` / `X` / `Minus` | 既存 UI が lucide-react を使用。記号直書きを避け `aria-label` を i18n から解決 |
| **インデックス** | **追加しない** | 主用途が「1 コンボ分を組単位で取得」で、PK `(combo_id, setup_id, tech_type, in_corner)` の先頭列で足りる。1 組あたり最大 4 行と小さい |

---

## 5. テスト結果（ケース数）

### 5.1／5.2 Go（`go test ./...` 全体 PASS）

**新規 Go テスト＝ 58 件（サブテスト込み・トップレベル関数 44 本）**（レビュー取り込みで M-1／L-3 の回帰テスト 2 本を追加）

| ファイル | 件数 | 観点 |
|---|---|---|
| `internal/infra/migration/migrate_m1903_test.go` | 3 | 列 6 本・PK 4 列・timestamps 不在・複合 FK・up/down 往復・PK による 4 行上限・FK 挙動 |
| `internal/repository/setup/setup_results_test.go` | 11 | §5.1 の #1 upsert／#2 三値・NULL 不在／#3 未検証へ戻す／#4 4 行上限／#5 複合 FK／#6 CASCADE／#9 組単位取得／**完全削除でも残らない（M-1）／紐付け確認の Tx 内可視性（L-3）** |
| `internal/service/setup/setup_results_test.go` | 6（+ 値域 7 サブケース） | §5.1 #8 値域外／紐付け不在（多層防御）／三値往復／成立セルの note／採用時の値域検証 |
| `internal/service/combo/setup_results_carry_test.go` | 9 | **§5.1 #7 ★識別キー変更編集**（既定・`carry_all`・`individual`・`unlink_all`・原子性・**FK=OFF 接続**）／PATCH では動かない／採用時の同一 Tx 記録 |
| `internal/api/setup/setup_results_handler_test.go` | 11 | §5.2 upsert／削除／値域外 400（4 パターン）／紐付け不在 404／不正 ID／クエリ必須・型／採用時の条件受け渡し |
| `internal/api/combo/setup_results_embed_test.go` | 4 | 振り分け・**N+1 でないこと**・未検証のみなら `results` キーが出ない・取得失敗の非ブロッキング・**既存 `SetupSummary` の後方互換** |

### 5.3 フロントエンド（Vitest）

**全体 885 tests / 118 files PASS。うち新規 35 件。**（レビュー取り込みで M-2 のテストを 1 本 → 3 本へ拡充＝正味 +2）

| ファイル | 件数 | 観点 |
|---|---|---|
| `SetupResultGrid.test.tsx` | 14 | 三値の描画／**アイコンで描かれている（記号直書きでない）**／凡例／**hidden-when-empty**／**集計を出さない**／note／**SSOT ラベルの再利用** |
| `SetupResultEditor.test.tsx` | 14 | 3 状態の巡回／**未検証へ戻せる（削除呼び出し・未検証値で upsert しない）**／note のセル単位／**成立セルにも書ける**／空文字は null／エラー表示／**既存 ok セルの note を ok のまま編集（M-2）** |
| `SetupAccordionItem.test.tsx`（追加分） | 7 | グリッドの出し分け／`comboId` 無しなら出さない／**編集導線が行クリック遷移と別操作**／**既存挙動（行クリック遷移・紐付け解除）が不変** |
| `SetplaySuggestionSection.test.tsx`（追加分） | 7 | 2×2 チェック／**既定は全て未チェック**／**未チェックでも採用できる**／チェック分のみ送出／**不成立を選べない**／やり直しで初期化 |
| `locales.test.ts` | 既存 2 | **ja/en parity**（**本サブで追加した i18n キーが対象**。受け身種別のラベルは i18n ではなく既存 SSOT `OKI_TECH_TYPE_LABELS` 由来で **ja 固定**＝§8-5 の既知の制約） |

**既存の M19-01／M19-02 の setplay テスト 19 件はそのまま PASS**（delivered 契約が壊れていない）。

### 5.4 E2E（§5.4 の A〜E ＋ 追加 3 本）

`web/e2e/m19-03-setup-results.spec.ts` — **8/8 PASS**

| # | シナリオ | 結果 |
|---|---|---|
| A | 項目10 で編集（その場受け身＝成立／後ろ受け身＝不成立＋note）→ 再読込で保持。未検証へ戻すまで | ✅ |
| B | 提案から採用（条件 1 つチェック）→ 項目10 に成立として表示。記録は ok のみ | ✅ |
| B2 | **チェックせずに採用できる**（結果 0 行・グリッドも出ない） | ✅ |
| **C** | **★識別キー変更編集で成立条件が引き継がれる**（§4.2・必須） | ✅ |
| D | 紐付け解除で結果行が消える。**再紐付けしても復活しない**（孤児なし） | ✅ |
| E | 全 4 セル未検証ならグリッドを表示しない（hidden-when-empty） | ✅ |
| F | **セットプレイ編集画面に成立条件 UI が無い**（§4.4.1） | ✅ |
| G | 値域外 400／紐付け不在 404（多層防御の実経路） | ✅ |

> 実行方法の注記: サンドボックス環境では `playwright install` のブラウザ取得が 403 になるため、`playwright.config.ts` が既に備えている `PW_EXECUTABLE_PATH` で同梱 Chromium を指定して実行した（設定ファイルの変更なし）。

### 5.5 非回帰

- **M19-01（3 本）／M19-02（5 本）の既存 E2E → 8/8 PASS**（提案の生成・採用・gap モード・件数表示・負 KA・制約告知）。
- **全 E2E スイート（レビュー取り込み後の最終実行）: 61 passed / flaky 0 / 1 failed。**
  - 取り込み前は 60 passed / 1 flaky だったが、**flake は解消した**。原因は M19-03 側の実装（`invalidateQueries` を await していなかったため連続操作で画面が 1 手前の状態で止まり得た）で、レビュー取り込み中に発見・修正済み（レビュー報告書「取り込み中に追加で発見・修正した不具合」）。`m19-03-setup-results.spec.ts` は連続 2 回とも 8/8 flake なし。
  - なお `m19-02 A/E` はスイート並列実行時のみ `POST /api/combos` が 500 になることがある（単独実行では 5/5 × 2 回 PASS）。M19-03 の変更前から観測されており、並列ワーカー間の SQLite 競合と見られる。
  - **failed: `m18-03a C` は既存の未追随であり M19-03 とは無関係。** 当該 assert が期待する文言「変換機能は M18-03b で対応予定です。」は **M18-03b 実装時に書き換え済で `web/src` に 0 ヒット**（DES-005 §5.21 に「03a の告知は実装に合わせて書き換え済」と記録あり）。M19-03 は punish 系ファイルを **1 本も変更していない**（§1）。**§9-2 として申し送る。**

---

## 6. 品質チェック

| 項目 | 結果 |
|---|---|
| `go build ./...` | PASS |
| `go vet ./...` | PASS（0 件） |
| `gofmt -l internal/ cmd/` | 0 件 |
| `go test ./...` | 全パッケージ PASS |
| lint（`web`: `tsc --noEmit`） | PASS |
| `pnpm vitest run` | 885 tests / 118 files PASS |
| マイグレ up / down | 両方動作。**down で `combo_setup_results` が DROP** されることをテストで検証（再 up も確認＝冪等な往復） |
| M19-01／M19-02 の delivered 契約 | 壊れていない（既存 E2E 8/8・既存 Vitest 19 件 PASS） |

---

## 7. §5.6 撤回済み仕様の残存確認（否定形・走査コマンドとヒット件数）

| # | 走査 | コマンド | ヒット件数 | 判定 |
|---|---|---|---|---|
| 1 | `setups.description` への定型文の自動生成 | `grep -rn "description" internal/service/setplay/ internal/service/setup/ --include=*.go \| grep -v _test \| grep -iE "生成\|format\|fmt\.Sprintf\|template"` | **0** | ✅ 残っていない |
| 1' | 同上（FE） | `grep -rnE "adoptDescriptionFormat\|descriptionFormat\|setDescription\(" web/src/features/setplay/` | **0** | ✅ |
| 2 | 検証日時に相当する列 | `grep -nE "created_at\|updated_at\|verified_at\|checked_at\|tested_at" migrations/000042_*` | **0** | ✅ 無い |
| 2' | 同上（model / FE DTO） | `ComboSetupResult` 内の `CreatedAt\|UpdatedAt\|VerifiedAt\|CheckedAt` / FE `verifiedAt\|checkedAt\|testedAt\|updatedAt` | **0 / 0** | ✅ |
| 3 | `result` の NULL・「未検証」を意味する値 | `grep -rnE 'Result +\*string\|result = NULL\|"unverified"' internal/ --include=*.go \| grep -v _test` | **0** | ✅ 無い（`result` は `NOT NULL`。FE の `SETUP_RESULT_UNVERIFIED` は画面表現専用で保存経路に無い） |
| 4 | `setup_tags` / `setups` への成立条件列 | `grep -rn "setup_tags" --include=*.go --include=*.sql --include=*.ts --include=*.tsx .` | **0** | ✅ 無い |
| 4' | 既存テーブルへの ALTER | `grep -rnE "ALTER TABLE (setups\|combo_setups\|setup_steps)" migrations/` | **0** | ✅ |
| 5 | セットプレイ編集画面への成立条件 UI | `grep -rnE "SetupResult" web/src/pages/SetupEditorPage.tsx web/src/features/setup/components/SetupBasicInfoForm.tsx web/src/features/setup/components/SetupRecipeEditor.tsx` | **0** | ✅ 無い（使用箇所は `SetupAccordionItem.tsx` のみ＝項目10。E2E F でも確認） |

補助確認: `moves` 系の変更ファイル **0 本**、`ALTER TABLE` を含むマイグレ **0 件**。

---

## 8. 既知の制約

1. **一覧・検索・エクスポートでの絞り込みは未実装**（後続サブ）。本サブのデータモデルは絞り込み可能な形になっている。
2. **提案ロジックは本記録を消費しない**（提案は距離を判定しないため接続しない）。記録は絞り込みと表示にのみ使う。
3. **端の判定はユーザーの主観**（アプリはゲーム状態を読まない）。
4. **検証日時を持たない**ため、バランス調整パッチ後に記録がいつのものか分からない。
5. **未検証セルのメモは保存されない**（画面には下書きとして残るが DB には入らない）。「未検証＝行が無い」が CHANGE-087 §2-d の正典で `result` に NULL も「未検証」値も入れられないため、保存先の行が存在しない。永続化するには三値の表現方式そのものの変更が必要＝別 CHANGE。UI では保存ボタンを無効化し「未検証のセルのメモは保存されません。成立／不成立にすると保存できます」と明示している。
6. **受け身種別のラベルは EN ロケールでも日本語表示になる。** `OKI_TECH_TYPE_LABELS`（日本語固定の既存 SSOT）を再利用したため。第 3 の語彙を作らない指示（§4.6）を優先した結果で、既存の `ComboEditorBasicFields` と同挙動。SSOT 自体の i18n 化は本サブの範囲外（M16-03 の正典に手が入るため）＝**followup 候補**。画面端の 2 語は新規追加のため ja/en 両方を用意している。

---

## 9. 後続へ送る項目（要決定・申し送り）

1. **★`db.Open` の `PRAGMA foreign_keys = ON` が接続プール全体に効いていない**（実測 16 接続中 7 本が OFF）。M19-03 は自表について明示的な再ポイント・明示削除で回避したが、**`combo_punishes` 等 M18-01 系の `ON DELETE CASCADE` にも同じ不確実性が残っている**。根治（DSN への `_pragma=foreign_keys(1)` 付与等）は全テーブルの FK 強制挙動が変わる全体影響のため本サブでは触れていない。**followup 起票をお願いしたい。**
   - 本サブの範囲内で FK 非依存にした経路: 識別キー変更編集の再ポイント／紐付け解除（`DeleteComboSetup` / `DeleteComboSetupsBySetupID` / `DeleteComboSetupsByComboID` / `...Excluding`）／**完全削除（`HardDelete`）**（レビュー M-1 で指摘され取り込み済み）／紐付け存在確認の Tx 内化（レビュー L-3）。
   - **本表以外（`combo_punishes` / `combo_punish_curations` / `combo_punish_prunings` / `combo_steps` / `setup_steps` 等）は未対応**。
2. **`m18-03a-punish-mylist.spec.ts` の C ケースが既存で落ちている**。M18-03b 実装時に書き換えた告知文言「変換機能は M18-03b で対応予定です。」を E2E が依然期待している（`web/src` に 0 ヒット）。M19-03 とは無関係だが、E2E が恒常的に赤いままなので**追随修正の起票をお願いしたい**。
3. **★セットプレイ編集画面（`/setups/:id`）でも成立条件を編集したい**（開発者要望 2026-07-28）。**製造では実装しなかった。理由はコストではなく設計正典との衝突**: 指示書 §4.4.1 と **CHANGE-087 §2-h** が「セットプレイ編集画面には置かない」旨**とその理由**を正典に残すよう明示指定しており（M19-01 の `SetupSelectorModal` と同型の失敗の再発防止）、レビューチェックリスト §8 でも「編集画面に置いている」は**重大問題**の判定基準になっている。構造上の理由は `setups` が `combo_setups` 経由で**複数コンボに紐づき得る**ため保存先の `combo_id` が一意に定まらないこと。
   - **実現案（設計担当の判断材料）**: `SetupResponse.parentComboIds` は既に返っているので、**紐づくコンボが 1 件なら自動選択**、複数なら**対象コンボを選ぶセレクタを置く**ことで実装自体は可能。ただし「どのコンボの条件を編集しているか」を常に画面上で明示する必要がある。
   - **採否には CHANGE-087 の改訂（§2-h の撤回または条件付き緩和）が前提。**
4. **`OKI_TECH_TYPE_LABELS` の i18n 化**（レビュー L-2）。受け身種別のラベルが EN ロケールでも日本語表示になる（§8-5）。M16-03 の正典＝起き攻めラベルの単一 SSOT に手が入るため独立サブが必要。**followup 起票をお願いしたい。**
5. **【運用ルールの確認事項】製造担当が指示書本体へ追記してよいか**（レビュー Q-2）。今回はマイグレ連番の払い出し時に中央から「製造への申し送り（指示書に入れてください）」として文面が示され、開発者経由で指示書 §9.1-3 とヘッダ表への反映を求められたため転記した（出典が分かるよう「中央からの申し送り（2026-07-28）」と明示してある）。CLAUDE.md §8 は設計書本体の直接編集を禁じているが**指示書については明文がない**ため、運用として許容されるかを明確化いただきたい。
6. **CHANGE-087 の反映**は中央が三点セットで実施（DES-003 に新表・DES-005 §5.6 項目10／項目12・**セットプレイ編集画面に置かない旨と理由**）。**DES-006 は変更なし**。**製造担当は DES 本体を直接編集していない。実装は CHANGE-087 の範囲を超えていない**（§4.1 の明示再ポイント併用は、CHANGE-087 §2-b の FK 定義に反する変更ではなく、同じ要件を接続状態に依存せず満たすための実装内の判断）。

---

## 10. §9.4 実データ・実 UI 経由での確認

「ロジックが正しく動く」と「機能が使える」は別（M17-E11）。E2E は **dev DB ではなく seed 済みの使い捨て DB 上で、実バックエンド + 実 Vite の独立スタック**を起動し、**実ブラウザ操作**で検証している。

| 確認内容 | 経路 | 結果 |
|---|---|---|
| 実コンボ・実セットプレイに条件を記録 → **再読込して保持** | E2E A（UI 操作でトグル・note 入力 → `page.reload()`） | ✅ |
| **識別キー変更編集で引き継がれる** | E2E C（**キー変更は `PUT /api/combos/:id` の API 経由**で position を変更 → **新コンボ詳細画面を実ブラウザで開き** `data-state="ng"` を確認）。※コンボ編集画面の UI 操作でのキー変更までは自動化しておらず、**UI 全体を通した実操作ではない**（レビュー M-3） | ✅（限定つき） |
| 提案の採用から条件が記録される | E2E B（提案生成 → チェック → 採用 → 項目10 に反映） | ✅ |
| 紐付け解除で消える | E2E D | ✅ |
| 全セル未検証では出ない | E2E E | ✅ |

*以上、M19-03 完了報告。*
