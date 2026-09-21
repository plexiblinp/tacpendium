# M19-07 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M19-07-bundled-setup-verified-conditions.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M19-07-review-checklist.md` v1.0.0 |
| 対象コミット | `bfff484` / `b579fc0` / `b3ecbe8` / `21fb5a4`（分岐点 `d7710a6`） |
| 完了報告 | `docs/progress/m19-07-completion-report.md` |
| 設計伝達レポート | `docs/handover/design-reports/20260809-m19-07-design-exceptions.md` |
| レビュー日 | 2026-08-09 |
| 判定 | **合格（§0.2 の重大 R-1〜R-9 ゼロ。G-1・G-2・G-3 いずれも充足）** |

---

## 総評

**本サブは「既存の非対称を揃えるだけ」という指示書の性格どおりに完結しており、重大判定 R-1〜R-9 はいずれも該当しない。** 最重要ゲート 3 点（G-1 同一 Tx／G-2 対称を超えない／G-3 copy で引き継がない）は実装・テストの両面で確認できた。
特筆すべきは、指示書 §2.1 が「サービス層に作業がある」かのように書いていたのに対し、実査で **M19-03 が既に `CreateSetupInTx` 内で `insertVerifiedConditions` を呼んでいた**ことを突き止め、二重実装（`ON CONFLICT DO UPDATE` のためエラーにならず気づけない形）を回避した点である。結果として `internal/service/` ／ `internal/repository/` は diff 0 で、R-4 が構造的に発生していない。
テストは「渡したセル／渡さなかったセルの対」（`SUPP-001` §5.5.2 (3)）を素直に実装しており、件数だけを見る誤りを避けている。`go test ./...`・`pnpm test`（120 files / 940 tests）・`go vet`・`gofmt`・`tsc --noEmit` を本レビューでも再実行し、いずれも green を確認した。
残る指摘はすべて軽微〜中で、M19 完了をブロックするものは無い。ただし **`CreateRequest` が POST と PUT（キー変更編集）で共用されている**点だけは、CHANGE 起票時に必ず反映内容へ含めてほしい（下記 §指摘 2）。

---

## 設計準拠性レビュー結果

### 重点ゲート

| # | ゲート | 評価 | 根拠 |
|---|--------|------|------|
| **G-1** | 同一トランザクション | **◎** | `service/combo/service.go:207` で `BeginTx` → `:252-256` で `CreateSetupInTx(ctx, tx, …)` → `:280` `Commit`。`setup/service.go:243` `InsertComboSetup` の**直後** `:248` `insertVerifiedConditions(ctx, tx, …)`。`defer` の `err != nil → Rollback` も既存経路のまま。`TestService_Create_BundledVerifiedConditions_RolledBackWithCombo` が `combos`／`setups`／`combo_setups`／`combo_setup_results` の**全 4 表 0 行**を固定 |
| **G-2** | 「対称にする」を超えていない | **◎** | `internal/api/setup/` **diff 0**（`CreateSetupRequest` 不変）／`internal/repository/` **diff 0**（新書込経路なし）／`verifiedConditions` の要素は `techType` / `inCorner` のみ（`result`・note を足していない）／`SetupResultConditionRequest` は**再定義せず import で 1 つのまま**（R-8 回避） |
| **G-3** | `copy` で成立条件を引き継がない | **○** | `ComboEditor.tsx:145-146` が `setupsToCreate` / `linkedSetups` をモードに依らず `[]` で開始。`ComboEditor.test.tsx` の 3 件で固定。**ただし固定しているのは「同梱セットプレイが 0 件」という構造的帰結**であり、成立条件そのものの非引き継ぎを直接固定してはいない（現行仕様では他に書きようがないため許容。§指摘 8） |

### チェックリスト §1〜§7

| 節 | 項目 | 評価 | 所見 |
|----|------|------|------|
| §1.1 | Plan Mode 8 項目の報告 | **不明** | **Plan Mode の記録は本レビューから参照できない。** 完了報告・設計伝達レポートには §3 の 1〜7 に対応する記述があるが、**§3-8（`SETUP_RESULT_CELLS` と `OKI_TECH_TYPES` の BE/FE 値域一致）の実査結果だけは明示されていない**（テストコメントに埋もれている。§指摘 9） |
| §1.2 | 契約全条項の確認 | ◎ | 設計伝達レポート §2 で F-1〜F-6・§3.2 を名指しで「触れていない」と明記。`git diff --stat` で `moves` 系（`character_data/`・`internal/seedgen/`）・`punishfinder/`・`setplay/` **diff 0** を独立確認 |
| §1.3 | §3-2 の突合 | ◎ | 差は `verifiedConditions` のみ。**`BundledSetupStepRequest` と `SetupStepRequest` が「別名・同構造」であること**も副産物として報告済み（R-8 は「同名で中身が違う型」なので別事象という判定は妥当） |
| §1.4 | Tx 境界の実査 | ◎ | 行番号つきで実査結果が示されており、推測ではない |
| §1.5 | §2.5 の 2 件の判定 | ◎ | `SetupSelectorModal` は全 87 行を実査。**書き込み 0 本・`POST …/setup-links` はコンボ作成成功後**まで裏づけがあり、「触らない理由が 2 つあり、どちらか一方でも十分」と明記。**気づかずに触らなかったのではない**ことが証明されている |
| §2.1〜2.5 | 同一 Tx 節 | ◎ | 上記 G-1。**新しい書き込み経路なし**（既存 `repository/setup/setup_results.go` の `InsertSetupResultsTx` をそのまま使用）／**即時保存なし**（`VerifiedConditionsField` は API を一切呼ばず、`SetupInputRow.test.tsx` が `fetch` を spy して未呼出を固定＝R-9 の回帰ガード） |
| §3.1〜3.6 | 対称を超えていないか | ◎ | 追加は 1 フィールドのみ。`UpsertSetupResult` 経路も不変。パッケージ境界の形と理由は設計伝達レポート §3-2 に案 A〜D の採否つきで記載（§指摘 1 に留意） |
| §4.1〜4.4 | 3 モード | ◎ | `new` / `copy` のみ `SetupRegistrationSection` を描画（`ComboEditor.tsx:558`）。`edit` は不変。N-7（成立条件「以外」の引き継ぎ）も現行のまま |
| §5.1〜5.6 | フロントエンド | ◎ | セルは `SETUP_RESULT_CELLS`、受け身語彙は `OKI_TECH_TYPE_LABELS`、端は `cornerLabelKey()`（項目10 と同一 i18n キー）、legend/hint は `setplay.confirmedConditions*`（項目12 と同一）。**第 3 の語彙は作っていない**。`CreateSetupInput.verifiedConditions`（既存 optional フィールド）へステージング。既定は全セル未チェック |
| §5.2 | Grid / Editor の再利用可否 | ◎ | 不可の理由が props レベルで具体的。とくに **`SetupResultGrid` は全セル未検証だと `null` を返して何も描かない**、**`SetupResultEditor` は 1 クリックごとに即時 API 書込＝R-9 そのもの**、は正しい読み |
| §6.1〜6.7 | テスト | ○ | §4 の 11 要件はすべて対応するテストが存在し green（本レビューで再実行確認）。**要件 11（E2E 非回帰）のみ本レビューでは未再実行**（下記 制約事項）。要件 4（対での固定）は (a) 組の完全一致 (b) 渡さなかった 2 セルが各 0 行 (c) `model.OkiTechTypes` 由来の `allCells()` との網羅検算、の 3 段で満たしている |
| §6.6 | HEAD 依存 | ○ | 本サブはマイグレ非消費。追加テストは `countAllSetupResults` / `countAllComboSetups`（seed 0 行の表）と自作コンボのみを数え、seed 件数を期待値に持ち込んでいない。既存ヘルパ `countCombos` / `validRyuInput` への依存は本ファイル群の既存慣行の範囲 |
| §7.1〜7.4 | 否定形確認 | ◎ | 3 系統すべてを走査。**キーワード完全一致では取り落とす近縁変形**（`セットプレイ編集画面に**は成立条件 UI を**置かない`）を自力で拾い、E2E spec の v1 形コメント 1 件を検出・報告している。撤回記録（`05-screen-design.md:323-324` 等）は除外対象として尊重 |
| §7.5 | 触っていないことの証跡 | ◎ | `migrations/`・`punishfinder/`・`setplay/`・`internal/api/setup/`・`internal/repository/`・`character_data/`・`internal/seedgen/` の **diff 0** を本レビューでも再確認 |
| §7.6〜7.8 | 報告物 | ◎ | 指示書 §7.2 の 8 項目すべてが完了報告に存在。`progress-log.md` 追記あり（D-191）。CHANGE 要否は「要・番号 096・起票は設計卓」で、**DES 本体は 1 文字も編集されていない** |
| §10 | 設計卓へ上げるもの | ◎ | 該当 3 件（レジストリ失効／v1 残骸／M19-03 指示書の撤回マーカー欠落）＋非該当 4 件を明示。**該当しなかったものも列挙している**のは良い |

### R-1〜R-9 の判定

| # | 判定 | 根拠 |
|---|------|------|
| R-1 別 Tx | **非該当** | 同一 Tx（G-1） |
| R-2 `CreateSetupRequest` 変更 | **非該当** | `internal/api/setup/` diff 0 |
| R-3 `result` / note の追加 | **非該当** | 要素は 2 フィールドのみ。`TestService_Create_BundledVerifiedConditions_OnlyOkNoNote` が DB 側で固定 |
| R-4 新しい書き込み経路 | **非該当** | `internal/repository/` diff 0 |
| R-5 `copy` で引き継ぎ | **非該当** | G-3 |
| R-6 `moves` に diff | **非該当** | `character_data/` `internal/seedgen/` diff 0・SQL なし |
| R-7 `punishfinder/` `setplay/` に diff | **非該当** | diff 0 |
| R-8 同名で中身が違う型 2 つ | **非該当** | 型を 1 つも新設せず import で共有 |
| R-9 即時保存 | **非該当** | `VerifiedConditionsField` は API 非呼出。`fetch` spy で固定 |

### N-1〜N-7（誤判定していないことの明示）

**以下はいずれも仕様であり、本レビューは指摘としていない。** N-1 `ng` 入力不可／N-2 note 入力不可／N-3 編集モードに入力 UI なし／N-4 `SetupSelectorModal` に入力 UI なし（§2.5-1 で「触らない」と判定され理由も明記済み）／N-5 `migrations/` に新規ファイルなし／N-6 既定が全セル未チェック／N-7 `copy` で成立条件「以外」は現行どおり。

---

## 設計準拠性以外の指摘事項

### 1. 〔中〕`internal/api/combo` → `internal/api/setup` は本プロジェクト初の api → api 参照である

`grep` で確認したところ、ハンドラ層パッケージ間の import は `internal/api/combo/dto.go:9` の 1 件のみで、**既存の前例が無い**。

- 指示書 §8.2 が「パッケージ境界を跨ぐ手段は推測可」としており、`DES-002` §2「依存方向は上から下への一方向とし、下位層は上位層を参照しない」にも反しない（同層参照）。**採用そのものは妥当**であり、案 A〜D の採否も設計伝達レポート §3-2 に残っている。
- ただし **「api パッケージ同士は import してよい」という前例をここで作った**ことになる。逆向き（`api/setup` → `api/combo`）が将来必要になると即座に import cycle になるが、その制約はコードのどこにも書かれていない（`dto.go:6-8` のコメントは「現時点で循環しない」ことしか述べていない）。
- 製造自身が設計伝達レポート §3-2 で「パターンとして問題があれば `architecture-patterns.md` 側で方針を示してほしい」と上げている。**方針を明文化するまでが対応**と考える。

### 2. 〔中〕`CreateRequest` は POST と PUT（キー変更編集）で共用されており、PUT 側では `verifiedConditions` が黙って無視される

`internal/api/combo/dto.go:21` のコメントどおり、`CreateRequest` は **`POST /api/combos` と `PUT /api/combos/:id`（キー変更編集）の両方の入力**である（`handler.go:371` が `toServiceCreateInput(req.CreateRequest)` を呼ぶ）。

- サービス層で `input.Setups` を読むのは `Create`（`service/combo/service.go:252`）**だけ**であり、`UpdateWithKeyChange` は一切読まない。したがって **PUT に `setups[].verifiedConditions` を載せても、エラーにも警告にもならず単に無視される**。
- これは `setups` 自体が以前から同じ扱いであるため **本サブが作った不具合ではない**。実害も現時点では無い（FE は edit モードで `setups` を送らない）。
- しかし本サブは「**`edit` には入力 UI を出さない**」を明示的な仕様として選んでおり、設計伝達レポート §1-1 も `POST /api/combos` だけを書いている。**CHANGE-096 で `DES-002` に反映する際、「同じリクエストボディを持つ PUT では無視される」ことを併記しないと、API 単体利用者が「PUT でも書ける」と読む。**
- 併せて、PUT 経路には `ErrInvalidResultValue` → 400 の写像も無い（`handler.go:373-385` の `switch` に無い）。無視される以上そのエラーは発生しないので実害は無いが、§指摘 3 の非対称と同根である。

**推奨**: 実装変更は不要。**CHANGE 起票時に「PUT では無視される」旨を `DES-002` へ明記**する（または followup で PUT 側の `setups` を明示的に拒否する）。

### 3. 〔中〕値域外 `techType` の応答が 同梱 400 / 単独 500 で食い違う（製造は認識済み・裁定待ち）

完了報告 §11-2・設計伝達レポート §4-1 のとおり。`internal/api/setup/handler.go:46-53` の `CreateSetup` が `ErrInvalidResultValue` を写像しておらず 500 に落ちる（M19-03 からの取りこぼし）。

- **本サブで直さなかった判断は正しい**（R-2 / §4-8 の「`CreateSetupRequest` を使う既存経路が不変」に抵触するため）。裁定を設計卓へ上げている点も適切。
- ただし **「非対称を揃えるサブ」が、別の新しい非対称を残した**形にはなっている。裁定 (a)（単独も 400 へ揃える）で followup を起票するのが素直だと考える。

### 4. 〔低〕`cornerLabelKey` を定数ファイルではなくコンポーネントファイルから import している

`VerifiedConditionsField.tsx:10` が `import { cornerLabelKey } from "./SetupResultGrid"`。**語彙の正典を参照するという方針自体は正しい**が、CLAUDE.md §4「列挙的文字列定数はパッケージ定数として定義」の趣旨からすると、`web/src/constants/setup-result.ts`（`SETUP_RESULT_CELLS` / `setupResultCellKey` の置き場）に移すのが筋。`SetplaySuggestionSection` も同じ import をしており**本サブ固有ではない**ため、followup 扱いで足りる。

### 5. 〔低〕i18n の hint 文言が「採用」語彙のままで、コンボ新規登録画面と噛み合わない

`setplay.confirmedConditionsHint`（ja）＝「…チェックしなくても**採用できます**。不成立の記録は登録後にコンボ詳細から行えます。」。コンボ新規登録画面には「採用」という操作が存在しない（項目12 の採用ダイアログ専用の語彙）。

- **キーを共有した判断は正しい**（第 3 の語彙を作らない）。直すなら**文言側を両面で通じる形にする**（例:「チェックしなくても登録できます」）べきで、これは `DES-005` 反映時の判断事項。ja/en 両方の同期が要る。

### 6. 〔低〕テストコメントと実体の不一致が 1 件

`internal/service/combo/bundled_setup_results_test.go:157` のコメント「**システムエラー**(存在しないキャラクター指定)で落ちた場合も…」に対し、テスト本体（`:165-169`）は `err == nil` かつ `result.HasError()` を検査している＝**バリデーションエラー経路**である。コメントを実体に合わせるべき。

### 7. 〔低〕完了報告内の自己矛盾（テストファイル数）

完了報告 §1 の表直前は「**うち 4 ファイルがテスト**」、§7 冒頭・設計伝達レポート §7 は「**うち 5 ファイルがテスト**」。実際は追加テスト 5 本（Go 2・TSX 3）＋ E2E 1 本（コメントのみ）。§1 側が誤り。

### 8. 〔低〕G-3 のテストが「成立条件」ではなく「同梱セットプレイ 0 件」を固定している

`ComboEditor.test.tsx` の 3 件は `setups-count === "0"` / `linked-count === "0"` を見ている。現行仕様（`DES-005` §5.7:374＝コピーでセットプレイは引き継がない）では**これ以上直接には書けない**ため許容だが、将来「copy でセットプレイを引き継ぐ」に仕様変更した場合、このテストは落ちるものの **G-3 の本体（成立条件だけを外す）を守るガードにはならない**。仕様変更時にはテストの張り替えが必要である旨を、テストのヘッダコメントに 1 行足しておくと安全（現状のコメントは「構造的に引き継がれない」までしか書いていない）。

### 9. 〔低〕指示書 §3-8（BE / FE の値域一致）の実査結果が報告に明示されていない

完了報告・設計伝達レポートのどちらにも独立した項目が無く、`bundled_setup_results_test.go:37` のコメント「値域の正典は `model.OkiTechTypes`(BE)であり、FE の `SETUP_RESULT_CELLS` と一致する」に埋もれている。実体としては両側とも `neutral_tech` / `back_tech` の 2 値で一致しており（`internal/model/combo.go:56-65` ／ `web/src/constants/oki.ts`）**結論は正しい**が、チェックリスト §1.1 の「8 項目すべてが報告されている」の観点では 1 項目が明示的でない。

なお、**BE と FE の値域が片側だけ増えたときに機械的に検出する手段は現状無い**（CLAUDE.md §4 の grep 運用に依存）。BE 側テストの `allCells()` は `model.OkiTechTypes` 由来なので BE 側の増加は検出できるが、FE 側 `SETUP_RESULT_CELLS` との突合は誰も見ていない。followup 候補。

### 10. 〔低〕E2E コメントの是正は、指示書 §5 が求めた「報告」をわずかに超える

指示書 §5 は「**見つかったら報告すること**」であり、是正までは求めていない。今回の変更は他サブ（M19-03）の E2E 資産に対するコメントのみの改変で、**アサーション・テスト名は不変**、かつ完了報告 §9-1 と設計伝達レポート §4-6 で明示的に報告されている。害は無く、むしろ後続の誤判定を防ぐ実益があるため**是正自体は支持する**が、「報告のみを求められた項目を直した」ことは記録として残しておく。

---

## 推奨修正（優先度別）

### 高（M19 完了前に修正必須）

**なし。** 重大判定 R-1〜R-9 に該当する事象は無く、G-1・G-2・G-3 はいずれも充足している。

### 中（M20 着手と並行可）

1. **CHANGE-096 の `DES-002` 反映に「`PUT /api/combos/:id`（キー変更編集）では `setups[].verifiedConditions` は無視される」を明記する**（§指摘 2）。実装変更は不要。あるいは followup として PUT 側で `setups` 非空を明示的に弾く。
2. **値域外 `techType` の 同梱 400 / 単独 500 の非対称に裁定を出す**（§指摘 3）。設計伝達レポート §4-1 の選択肢 (a)〜(c) のいずれか。(a) を選ぶなら followup を起票する。
3. **api → api 参照の方針を `architecture-patterns.md` に明文化する**（§指摘 1）。「ハンドラ層の DTO 型はドメインを跨いで import してよい／逆向きの依存を作らない」等。製造自身が請求している。
4. **CHANGE 番号レジストリと契約 §4 の失効を是正する**（完了報告 §8.1・設計伝達レポート §4-2）。`change-number-registry.md` §1 表への 095 行追加と「次回起票」の 096 化、`m18-m19-contract.md` §4 の同期。**本サブの番号は 096。**

### 低（将来対応）

5. `cornerLabelKey` を `web/src/constants/setup-result.ts` へ移す（§指摘 4）。既存 `SetplaySuggestionSection` の import も同時に張り替える。
6. `setplay.confirmedConditionsHint` の「採用」語彙を両画面で通じる文言へ（ja/en 同期）（§指摘 5）。
7. `bundled_setup_results_test.go:157` のコメント修正（§指摘 6）。
8. 完了報告 §1 の「4 ファイル」→「5 ファイル」（§指摘 7）。
9. `ComboEditor.test.tsx` の copy テストに「仕様変更時はこのテストでは G-3 を守れない」旨を 1 行追記（§指摘 8）。
10. `VerifiedConditionsField` と `SetplaySuggestionSection.tsx:573-597` のマークアップ重複の解消（完了報告 §11-1 の既知の限界。**現状は同じ正典を参照しているため表記揺れは起きない**が、セルが増えたときの片肺更新リスクがある）。
11. BE `model.OkiTechTypes` と FE `SETUP_RESULT_CELLS` の値域一致を機械的に固定する手段の検討（§指摘 9）。
12. `docs/instructions/M19-03-setplay-condition-record.md:241,439` の v1 文言への撤回マーカー付与（設計伝達レポート §4-6・設計卓宛）、`docs/handover/M19-引き継ぎキット.md:98` の陳腐化（「中央へ請求済み」→ v3 は着地済み）の是正（同 §4-7）。

---

## 良かった点

1. **「指示書が求めた作業が既に入っていた」ことを実査で突き止め、二重実装を回避した。** `CreateSetupInTx` が既に `insertVerifiedConditions` を呼んでいることに気づかなければ、同一 Tx 内で 2 回呼ばれ、`ON CONFLICT DO UPDATE` のため**エラーにならず気づけない**形になっていた。設計伝達レポート §9-1 で教訓化されている点も含めて良い。
2. **ロールバック検証で `comboID` 絞りではなく DB 全体カウントを選び、その理由を明文化している**（`bundled_setup_results_test.go:79-81`）。「消えたのか、そもそも書かれなかったのか」を区別できない、という指摘は正しく、テストの意味を保っている。
3. **§2.5-1 の判定が「触らなかった」と「気づかなかった」を明確に分けている。** `SetupSelectorModal` 全 87 行の実査結果（書き込み 0 本・`POST …/setup-links` はコンボ作成成功後・唯一の利用元）まで示し、さらに「触らない理由は 2 つあり、どちらか一方でも十分」と冗長化している。指示書 §2.5 の但し書きへの応答として模範的。
4. **否定形確認の走査を、指定キーワードの近縁変形まで広げて v1 形の残骸を実際に 1 件検出した。** 指定文字列（`セットプレイ編集画面に置かない`）と実在文字列（`セットプレイ編集画面には成立条件 UI を置かない`）は完全一致しない。**アサーションも理由も正しいのに言い回しだけが古い**という、最も見逃されやすい形を拾っている。
5. **型を 1 つも新設せず R-8 を構造的に回避した。** type alias すら置かない選択と、案 A〜D の採否表・循環しないことの実査は、後任が判断を追跡できる形になっている。
6. **CHANGE 番号レジストリの失効を自力で検出し、「レジストリ自身が予告していた失効である」ところまで辿って設計卓へ上げた。** 完了報告と対で更新する運用の欠落を、レポートのテンプレート項目化（設計伝達レポート §8「併せて更新が要るもの」）で塞ごうとしている点も良い。
7. **`fetch` を spy して「即時保存していないこと」をテストで固定した**（R-9 の回帰ガード）。「やっていないこと」を固定するのは書きにくいが、v3 原則の違反はここでしか捕まらない。
8. 完了報告・設計伝達レポートともに、**該当しなかった escalate 条件を明示的に列挙している**（§7.3-1／-2／-4／-5＝いずれも非該当）。「報告が無い」と「該当が無い」の区別がつく。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **E2E（`make e2e` / Playwright）は本レビューでは再実行していない。** 完了報告 §7.1 の「70 passed / 0 failed（1 回目は `config.toml` 不在で 36/34、初期化後に再実行して 70/70）」は**製造の報告をそのまま採っている**。設計伝達レポート §6 の手動確認 6 項目（とくに 6-2「チェック直後に書き込みリクエストが出ないこと」・6-4「コピーで引き継がれないこと」）も未実施であり、開発者の実機確認が要る。
- **Plan Mode の報告内容は本レビューから参照できない。** チェックリスト §1.1（指示書 §3 の 8 項目すべてが報告されたか）・§1.6（食い違いが実装前に報告されたか）は、完了報告と設計伝達レポートに残された記述からの推定である。**不明: §3-8（BE / FE 値域一致）が Plan Mode で報告されたかは判断できない**（結論自体はコード上で正しいことを確認済み）。
- 本レビューで再実行し green を確認したのは以下のみ: `go build ./...`／`go vet`（変更 2 パッケージ）／`gofmt -l internal/ cmd/`（出力なし）／`go test ./...`（失敗 0）／`pnpm exec vitest run`（**120 files / 940 tests passed**、完了報告の記載と一致）／`pnpm lint`（`tsc --noEmit` clean）。

---

*以上、M19-07 レビュー報告書。配置 `docs/progress/m19-07-review.md`。*

---

## 取り込み結果（自動トリアージ）

| 項目 | 内容 |
|------|------|
| 実施 | 製造担当 Claude Code（`/implement_plan_full` Phase C） |
| 実施日 | 2026-08-09 |
| **優先度「高」** | **0 件**（レビュー判定どおり）。**したがって「高」の不採用による開発者エスカレーションは発生していない** |
| 採否の内訳 | **採用 9 件／不採用 3 件**（不採用はいずれも「低」。理由は各行に記載） |

### 中（4 件） — **全件採用**

| # | 指摘 | 採否 | 対応・理由 |
|---|------|------|-----------|
| 1 | `CreateRequest` は POST / PUT 共用で、**PUT では `verifiedConditions` が黙って無視される** | **採用** | **指摘は正しい**（独立に再確認: `handler.go:371` が `toServiceCreateInput(req.CreateRequest)` を呼び、`grep 'Setups' internal/service/combo/service.go` は 82/83/**252/253** のみ＝`Create` だけが読む。他ヒットは `CountComboSetups*`／`DeleteComboSetups*` で別物）。**実装は変えない**（`setups` 全体の扱いに及び、対称化の範囲を超える／R-2 の既存経路不変にも触れる）。**設計伝達レポート §4-8 を新設**し、§8 の CHANGE たたき台「影響設計書」「併せて判断が要るもの」へ反映依頼を追加。完了報告 §11-7 にも既知の限界として記載 |
| 2 | 値域外 `techType` の 同梱 400 / 単独 500 の非対称に裁定を | **採用（対応済み）** | 既に設計伝達レポート §4-1 で選択肢 (a)〜(c) を添えて裁定を請求済み。レビューの「(a) で followup 起票が素直」という見解を §8「併せて判断が要るもの」に併記した |
| 3 | api → api 参照の方針を `architecture-patterns.md` に明文化 | **採用（分割対応）** | **同書 §0 が「新パターンが確立したら設計担当 Claude が本書へ追記する」と定めており、製造は編集しない**（対象読者も設計担当）。代わりに **(a)** レビューが指摘した「制約がコードのどこにも書かれていない」欠落を、`internal/api/combo/dto.go:6-11` のコメントで塞いだ（**逆向きの依存を作らない／必要になったら共有パッケージへ切り出す**）。**(b)** 設計伝達レポート §8「併せて更新が要るもの」へ追記依頼を明記 |
| 4 | CHANGE レジストリと契約 §4 の失効是正 | **採用（対応済み）** | 既に完了報告 §8.1・設計伝達レポート §4-2 で上げ済み。レジストリ本体の更新は設計卓の管掌（`change-number-registry.md` の対象読者は設計担当）のため製造は編集しない |

### 低（8 件） — **採用 5 件／不採用 3 件**

| # | 指摘 | 採否 | 対応・理由 |
|---|------|------|-----------|
| 5 | `cornerLabelKey` を `constants/setup-result.ts` へ移す | **不採用（followup）** | 指摘の筋は正しいが、**`SetplaySuggestionSection` の既存 import も同時に張り替える必要があり、本サブが触っていない他サブの資産に diff が出る**。レビュー自身が「本サブ固有ではないため followup 扱いで足りる」としている。§8.3「対称にするを超えないこと」を優先 |
| 6 | `confirmedConditionsHint` の「採用」語彙 | **採用（設計卓へ）** | 文言変更は ja/en 両面かつ **項目12（採用ダイアログ）側の表示にも影響する**ため製造判断で変えない。**設計伝達レポート §4-9 を新設**し、`DES-005` 反映時の判断事項として上げた（推奨文言案つき） |
| 7 | `bundled_setup_results_test.go:157` のコメントと実体の不一致 | **採用・修正済** | 「システムエラー」→「別のバリデーションエラー(VAL-S01: 存在しないキャラクター指定)」へ是正。あわせて**直上のテストとの違い**（2 本目が壊れる形／成立条件を載せた当の 1 本が壊れる形）を 1 行足した |
| 8 | 完了報告 §1 の「4 ファイルがテスト」→ 5 | **採用・修正済** | 「**うち 5 ファイルがテスト**、1 ファイルは E2E のコメントのみ」へ是正（§7 冒頭・設計伝達レポート §7 と一致） |
| 9 | `ComboEditor.test.tsx` の copy テストに仕様変更時の注意を 1 行 | **採用・修正済** | 「本テストが固定しているのは構造的帰結であり、`copy` でセットプレイを引き継ぐ仕様へ変わったら **`verifiedConditions` が空であることを固定するテストへ張り替えること**」をヘッダコメントに明記 |
| 10 | `VerifiedConditionsField` と `SetplaySuggestionSection` のマークアップ重複 | **不採用（followup）** | 完了報告 §11-1 に既知の限界として記載済み。**現状は同じ正典（`SETUP_RESULT_CELLS` / `OKI_TECH_TYPE_LABELS` / 同一 i18n キー）を参照しているため表記揺れは起きない**。差し替えは M19-05 が触った feature の FE ファイルに diff を出すため §8.3 を優先 |
| 11 | BE / FE 値域一致の機械的固定 | **不採用（followup）** | Go と TypeScript の 2 ランタイムに跨る突合は、本サブの範囲で作れる手段が無い（生成物か専用スクリプトが要る）。**完了報告 §2.2 末尾・§11-6 に followup 候補として明記**した |
| 12 | `M19-03` 指示書 `:241,439` の撤回マーカー／`M19-引き継ぎキット.md:98` の陳腐化 | **採用（対応済み）** | いずれも設計卓の管掌文書。設計伝達レポート §4-6 末尾・§4-7、完了報告 §10 の 3・4 で上げ済み |

### 指摘 9（§3-8 の実査結果が報告に明示されていない）

**採用・修正済。** 完了報告に **§2.2「§3-8 の実査結果（`SETUP_RESULT_CELLS` と `OKI_TECH_TYPES` の BE / FE 値域一致）」を新設**し、BE / FE の定義位置・値・`inCorner` が `bool` である旨を表で明示した。あわせて **「片側だけ増えたときの機械的検出手段が無い」** ことを followup 候補として書いた（上記 #11）。

### 指摘 10（E2E コメントの是正は §5 の求めをわずかに超える）

**対応不要（記録のみ）。** レビュー自身が「是正自体は支持する」としており、完了報告 §9-1・設計伝達レポート §4-6 で明示的に報告済み。**アサーション・テスト名は不変。**

### 取り込み後の再検証

```
go vet ./...                     出力なし
gofmt -l internal/ cmd/          出力なし
go test ./internal/service/combo/ ./internal/api/combo/   ともに ok
pnpm lint (tsc --noEmit)         clean
pnpm test ComboEditor.test.tsx   32 passed
```

**取り込みによる実装ロジックの変更はゼロ**（コード変更は `dto.go` のコメント追記 1 か所とテストコメント 2 か所のみ）。したがって E2E の再実行は不要と判断した。

---

*取り込み記録ここまで。*
