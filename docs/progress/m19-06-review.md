# M19-06 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M19-06-setup-result-filter.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M19-06-review-checklist.md` v1.0.0 |
| 対象ブランチ / コミット | `claude/m19-06-result-filter-setup-xu6h2p` / `482e23c`・`345c9a8`・`d8be129`（**レビュー中に `a0aad46`〔完了報告 §9 へ E2E 結果を記載〕が着地したため、これも対象に含めた**） |
| レビュー日 | 2026-08-09 |
| レビュー範囲 | `git diff main...HEAD` の全 16 ファイル（実装 10・テスト 4・ドキュメント 3〔うち progress-log は追記〕） |
| 読んだ資料 | `CLAUDE.md` ／ 指示書 M19-06 ／ 本チェックリスト ／ `SUPP-001` §5.5（§5.5.2 の (1)〜(5)・終端固定を含む） ／ `DES-002` §4.2（ステータス欄の CHANGE-087 反映記述） ／ `DES-003` §3.19（`migrations/000042` の DDL とコメント経由） ／ `DES-005` §5.4・§5.5・§5.6 項目10 系 ／ `docs/process/m18-m19-contract.md` §1〜§5（§2 F-1〜F-6・§3.2 全数） ／ `docs/handover/` は **`design-reports/20260809-m19-06-design-exceptions.md`（本サブの対象物）・`retrospective-digest.md`（§0〜§3）・`docs-map.md`／`m19-desk-status.md`／`code-facts.md`／`followup-backlog.md`（所在・規模の確認のみ）** を参照。**`docs/handover/` 配下 30 件超の全読はしていない**（M19-DESIGN-01〜09・SF6 ドメイン知識集成・phase1/phase2 アーカイブ等は未読。本サブの判定に必要な範囲を優先した） |
| 実行した検証 | `go vet ./internal/...`（出力なし）／`gofmt -l internal/ cmd/`（出力なし）／`go test ./internal/repository/combo/ ./internal/api/combo/ ./internal/model/`（**ok**）／`pnpm exec vitest run useComboListFilters.test.tsx ComboListFilters.test.tsx`（**29 passed**）／`git diff --stat main...HEAD` によるファイル面の実査 |

---

## 総評

**本サブの肝である「3 状態を混ぜないこと」は、SQL 述語・型・テスト・ドキュメントのすべてで守られている。** G-1（`unverified` と `ng` の分離）・G-2（セットプレイ 0 件のコンボが 3 値のどれにも該当しない）・G-3（新項目未指定時の既存フィルタ不変）は、コードとテストの両面で確認でき、**§0.2 の重大（R-1〜R-7）はゼロ**である。SQL のバインド引数はプレースホルダの出現順と `args` の append 順を 3 述語すべてで手検算し、**すべて一致**していた。

**指示書が規定していなかった軸（論理削除された `setups`）を製造が発見し、実装に入る前に開発者裁定を取ってから実装している点は、本サブで最も価値の高い挙動である。** §2.5 の対象画面 4 項目の「触らない」判定も、`MyComboPage.tsx` と `internal/service/comboio/export.go:101-110` を当方で独立に実査して裏取りでき、報告内容と一致した。

**残る指摘は 2 点で、いずれも絞り込みの正しさには影響しない。** (a) 成立状態を「全て」に戻したときに軸 2 つの値が URL・セッションに残り、`disabled` のため個別に消せない、(b) 軸を「不問」にしたときの 3 値の意味（セル横断で「1 つでもあるか」を見る）が CHANGE-094 の反映文へ書かれていない。

**なお、レビュー着手時点では完了報告 §9（E2E 非回帰の実行結果）が `<!-- E2E-RESULT -->` の空プレースホルダだったが、レビュー中に `a0aad46` が着地し「70 passed / 0 failed」と切り分け経緯が記載された。** 本報告は**記載後の状態**で判定している。

---

## 設計準拠性レビュー結果

### §1. 着手前（Plan Mode）の報告 — ○

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 1.1 | 指示書 §3 の 8 項目 | ○ | 完了報告・設計伝達レポートで 8 項目とも追跡できる。ただし **§3-6・§3-7 は「実測不能」**（dev DB がこの実行環境に無い） |
| 1.2 | 契約の全条項の列挙 | ◎ | 設計伝達レポート §2 に F-1〜F-6 と §3.2 が表で列挙され、当方の `git diff --stat` 実査と一致（後述 §8） |
| 1.3 | §2.5 の 4 項目の判定と理由 | ◎ | **当方で独立に裏取り済み**。`MyComboPage.tsx:52,148` は `useSearchParams` 独自実装で `useComboListFilters` を使っていない。`export.go:101-110` は `ExportQuery` の 6 フィールドを明示列挙して `ListFilter` へ詰め替えており、新項目は流れない。いずれも「気づかなかった」ではない |
| 1.4 | `OKI_TECH_TYPES` の BE/FE 一致 | ◎ | BE `model.OkiTechTypeNeutral`/`Back`（`IsValidOkiTechType`）と FE `OKI_TECH_TYPES = ["neutral_tech","back_tech"]` が一致 |
| 1.5 | `combo_setup_results` の行数・分布 | △ | **実測できていない**（§11.5 該当）。理由（fresh clone に `*.db` が無い・`.gitignore:24-27`）と代替担保（3 値の該当／非該当の対固定）は明記されており、報告としては要件を満たす。**実データ確認は開発者側で要実施** |
| 1.6 | 食い違い時の事前報告 | ◎ | 論理削除 `setups` の件を **実装前に開発者へ上げて裁定を得ている**（`PARENT-E21` の想定どおりの挙動） |

### §2. 3 状態の意味論（本サブの中心） — ◎

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 2.1 | `ok` = `EXISTS(... AND result='ok')` | ◎ | `setupResultWhere`（`internal/repository/combo/repository.go:503` 以降）の `withResult(model.SetupResultOK)` |
| 2.2 | `ng` = `EXISTS(ng)` かつ `NOT EXISTS(ok)` | ◎ | `"(" + ngCond + " AND NOT " + okCond + ")"`。**`ok` の単純な否定になっていない**（R-1 なし）。テスト `TestRepository_List_SetupResult_ThreeStates` が `mixed`（一部 ok・一部 ng）を **`ok` に含み `ng` に含まない**ことで対固定 |
| 2.3 | `unverified` = セットプレイ 1 つ以上 かつ 当該セルの行なし | ◎ | `hasSetup`（`combo_setups` への明示 EXISTS）と `NOT anyResult` の AND。**「`ok` でない」実装ではない**（R-1 なし） |
| 2.4 | セットプレイ 0 件が 3 値のどれにも該当しない | ◎ | `ok`/`ng` は `combo_setup_results` の EXISTS が組の存在を含意する（**`migrations/000042` の FK が `combo_setups(combo_id, setup_id)` を親としており、当方でも DDL を確認**）。`unverified` は明示 EXISTS で除外。テスト `..._ComboWithoutSetupMatchesNone` が **3 値 × 軸あり／なしの 6 通り**＋「絞り込み無しなら返る」まで固定（R-2 なし） |
| 2.5 | 語彙の再利用 | ◎ | FE は `SETUP_RESULTS` / `SETUP_RESULT_UNVERIFIED` / `OKI_TECH_TYPES` / `OKI_TECH_TYPE_LABELS` をそのまま使用。**`web/src/constants/` に diff 0**。BE の `model.SetupResultUnverified` は保存値の const ブロックとは分離され、「保存されない・絞り込み専用」とコメントで明記。判定関数も `IsValidSetupResultValue`（保存値）と `IsValidSetupResultFilterValue`（絞り込み）に分けてある（R-7 なし） |

**★SQL バインド引数の検算（当方で独立に実施・すべて一致）**

| 述語 | プレースホルダの出現順 | `args` の append 順 | 判定 |
|---|---|---|---|
| `ok` | `result` → `tech_type` → `in_corner` | `result` → `cellArgs...` | **一致** |
| `ng` | ng 側（`result`,`tech`,`corner`）→ ok 側（`result`,`tech`,`corner`） | `ngArgs...` → `okArgs...` | **一致** |
| `unverified` | `hasSetup`（0 個）→ `anyResult`（`tech`,`corner`） | `cellArgs...` | **一致** |
| `List` 全体 | `whereParts` の append 順（… `is_draft` → **成立条件** → 削除条件〔引数なし〕）→ `LIMIT`/`OFFSET` | `args` の append 順が同一。`filter.SetupResult != nil` のブロック内で `whereParts` と `args` を同時に積む | **一致** |

`resultExists` は `%s` を 2 つ持つフォーマット文字列で、第 1 が `result` 句・第 2 が `cell` 句である。`withResult` は必ず第 1 に `" AND csr.result = ?"` を、`anyResult` は第 1 に `""` を渡すため、**`cell` の 2 引数が常に `result` の後ろに来る**構造になっている。値はすべてプレースホルダ経由で、SQL 断片は定数のみから組まれている（インジェクション面も問題なし）。

### §3. 軸の指定 — ◎

- **3.1 / 3.2**: `SetupTechType *string` / `SetupInCorner *bool` が独立。4 セルから 1 つを選ばせる形ではない。各軸に「不問」（nil / UI は `""`）がある。
- **3.3**: **`List` の `if filter.SetupResult != nil` の中でしか軸を参照しない**という構造で担保され、`ListFilter` のフィールドコメント・`List` 内コメント・`setupResultWhere` の doc コメント・ハンドラのコメントの 4 箇所に明記されている。テスト `..._AxesWithoutStateDoNotFilter` が 3 通りとも全件一致で固定。
- **3.4**: ラベルは `OKI_TECH_TYPE_LABELS`（その場受け身／後ろ受け身）と i18n `setupResult.corner.inCorner`＝「相手が画面端」／`.midScreen`＝「画面中央」を使用。**正典どおり**。

### §4. バックエンド — ○

- **4.1 / 4.2 ◎**: 既存 13 フィールドは不変（diff は純粋な追加。`ListFilter` 側の削除行 0）。命名 `SetupResult` / `SetupTechType` / `SetupInCorner` は `Position` / `HitType` / `OpponentStance` の流儀に合致。
- **4.3 ◎**: 論理削除された**コンボ**の扱いは `IncludeDeleted` / `OnlyDeleted` のまま。新しい規則を作っていない。テスト `..._RespectsDeletedComboFlags` が既定／`IncludeDeleted`／`OnlyDeleted` の 3 通りを固定。
- **4.4 ◎**: `setup_result` / `setup_tech_type` は値域外で 400、`setup_in_corner` はパース失敗で 400。`TestHandler_List_400_InvalidSetupResultFilters` が 4 ケース＋**サービス未呼出**まで固定。
- **4.5 ○**: エラーコードは既存の 2 系統（`invalid_query` / `invalid_query_param`）をそれぞれの前例へ割り当てており、**既存が割れている状態をそのまま踏襲**。設計伝達レポート §3-3 で明示済み。§9 軽微（統一は別サブ）。

### §5. フロントエンド — ○

- **5.1 ◎**: `ComboListFiltersState` の既存 8 フィールド不変、3 項目追加のみ。
- **5.2 ◎**: 既存のフィルタ群（`ComboListFilters.tsx` の同一 flex 行）内に配置。新しい面を作っていない。
- **5.3 ◎**: 3 つとも native `<select>`（N-6 は仕様）。
- **5.4 ◎**: 既存の URL クエリ + `combo-list-filters-v1`（**sessionStorage**・`createSessionStorageHelper` 経由）にそのまま相乗り。新しい保持機構・新しいストレージキーを作っていない（**CLAUDE.md §10.X のキー表に追記が必要な新規キーは無い**）。
- **5.5 ○**: `hasActiveFilters` に 3 項目とも加算、`clearFilters` は `character_id`/`sort`/`order` 以外を捨てる実装なので確実に戻る。テストで固定済み。**ただし後述の「軸の残留」がある**。
- **5.6 ◎**: `ColumnVisibility` / `combo-list.ts` に diff 0（N-4 は仕様）。テストで「成立条件の列を足していない」ことまで固定。
- **5.7 ○**: 見出し 3 キーを `ja.json` / `en.json` の**両方**へ追加（`locales.test.ts` のキー一致検証に整合）。値ラベルは既存の i18n キーと `OKI_TECH_TYPE_LABELS` を再利用。**受け身種別のラベルだけは i18n ではなくハードコードの日本語**だが、これは指示書 §2.1 (d) が「ラベルの正典は `OKI_TECH_TYPE_LABELS`」と指定した結果であり、既存 M16-03 の流儀を踏襲したもの。**新しい流儀は作っていない**（§9 軽微）。

### §6. テスト — ○

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| 6.1 | §4 の 10 要件 | ◎ | 1〜9 は該当テストが存在し **green を当方で再実行確認**。10（E2E 非回帰）も `a0aad46` で **70 passed / 0 failed** が記載された |
| 6.2 | 3 値の該当／非該当の対固定 | ◎ | 期待集合を**ラベル名で明示**したうえ、`len(got) == len(allLabels)` で「全件該当（＝広く当てすぎ）」も弾いている。`SUPP-001` §5.5.2 (3) の趣旨どおり |
| 6.3 | 一部 ok・一部 ng | ◎ | fixture `mixed`（セットプレイ 2 つ・同一セルで ok と ng）で固定 |
| 6.4 | セットプレイ 0 件 | ◎ | 6 通り＋「絞り込み無しなら返る」の裏取り付き |
| 6.5 | 軸 4 通り | ◎ | 指示書の 4 通りに加え**逆側の軸 2 通り**を足して「軸が効いていること」を対で固定（`otherCell` だけが残る）。良い設計 |
| 6.6 | 既存フィルタ不変 | ○ | `..._ExistingFiltersUnchanged`（絞り込み無し・`position` 該当／非該当・`is_draft` 両値・`character_id`）＋ `TestHandler_List_SetupResultFilters_AbsentAreNil`。**コード側でも `filter.SetupResult != nil` の外に一切手が入っていない**ことを確認（G-3 充足） |
| 6.7 | 比較区間が自サブに閉じているか | △ | マイグレ契約テストではないため §5.5.2 (1)(2) の直接の対象外だが、**`allLabels` との完全一致アサートは「HEAD の `combos` が空である」ことに依存**している。現状は `000012` の seed が `000017`／`000029` で消えているため空だが、`000012` 自身が「フェーズ3で総入れ替え」と書いており、**将来コンボを投入するマイグレが入ると本テストが落ちる**。落ち方は `labelsOf` の `t.Fatalf("unexpected combo id ...")` で明示的なので気づけるが、**fixture 由来のラベルだけに絞ってから比較する形が安全**（低） |
| 6.8 | E2E 非回帰 | ◎ | 完了報告 §9（`a0aad46`）に **70 passed / 0 failed（1.4 分）**、および 1 回目の 34 failed が `config.toml` 未初期化に由来したことの切り分け（落ちた spec 群だけの再実行で 7/7 green → 全数再実行で 70/70 green）まで記載。**新規 spec なし＝非回帰のみ**も明記。当方でも `web/e2e/` に select を位置（`nth`）で引く spec が無いことを確認しており、記載内容と矛盾しない |

### §7. 否定形確認 — ◎

- **7.1 / 7.2**: 指示書 §5 の 2 キーワードを **3 系統（本番コード／テスト資産／設計文書）** で走査した結果が完了報告 §5 に箇所付きで載っている。当方で `SetupResultGrid.tsx`・`setup-result.ts`・`migrations/000042` のコメント・`internal/model/setup.go:45-54,63-66` を確認し、いずれも「行が無い＝未検証」を保っていることを裏取りした。
- **7.3**: 混入は発見されておらず、実装前報告の必要は生じていない（§11.2 該当なし）。

### §8. 完了条件と報告 — ○

| # | 項目 | 評価 | 当方の実査結果 |
|---|---|---|---|
| 8.1 | `moves` に diff 0（R-4） | ◎ | `git diff --name-only main...HEAD` に `moves`／`character_data` を含むパスは **0 件** |
| 8.2 | `punishfinder/` ／ `setplay/` に diff 0（R-5） | ◎ | `git diff --stat main...HEAD -- internal/service/punishfinder/ internal/service/setplay/` が **空** |
| 8.3 | `migrations/` に新規ファイルなし（R-6） | ◎ | 同上で `migrations/` も **空**（N-7 のとおり、無いことが仕様） |
| 8.4 | 完了報告に §7.2 の 7 項目 | ◎ | 1〜7 すべて存在（§3-6・§3-7 は「実測不能」と明記された形で充足） |
| 8.5 | `progress-log.md` への追記（D-191） | ◎ | 11 行の追記あり。E2E の初回 34 failed が本サブ無関係（`config.toml` 未初期化）だった切り分けまで記録されており、教訓としての価値も高い |
| 8.6 | 設計伝達レポート §2 | ◎ | 「**なし**」＋ F-1〜F-6・§3.2 の接触表。**凍結条項への接触ゼロ**は当方の実査と一致 |
| 8.7 | CHANGE の要否 / DES 直接編集なし | ◎ | 「要・番号 094（registry 実査）・起票は設計卓」と明記。**`docs/design/` に diff 0** を当方でも確認 |

### §11. 設計卓へ上げる — ○

- **11.5 該当**（`combo_setup_results` の実データで動作確認できていない）が、完了報告 §4 と設計伝達レポート §4-1 に明記されている。**11.1〜11.4 は該当なし**（当方の実査でも同意見）。

---

## 設計準拠性以外の指摘事項

### (1) 【レビュー中に解消】完了報告 §9「E2E 非回帰の実行結果」が空だった — **解消済み**

レビュー着手時点の `d8be129` では `docs/progress/m19-06-completion-report.md` §9 が `<!-- E2E-RESULT -->` の空プレースホルダで、同 §8 の完了条件表・§4 テスト要件表（#10）がいずれも「結果は §9」を参照していたため、**指示書 §6 の完了条件「E2E 非回帰」の証跡が存在しない状態**だった。

**レビュー中に `a0aad46` が着地し、`70 passed / 0 failed（1.4 分）`・新規 spec なし・1 回目の 34 failed の切り分け（`config.toml` 未初期化）・申し送りまで記載された。指摘は解消。** 記録として残す。

なお E2E 側の回帰リスク自体も低い。`web/e2e/` で `<select>` を位置（`nth`）で引いている spec は無く、唯一 `character-default.spec.ts:15-17` が `.filter({ has: option "ダルシム" })` で引いているが、新設 3 つの select はいずれもキャラ名 option を持たないため衝突しない（当方で確認）。

### (2) 成立状態を「全て」に戻したとき、軸 2 つの値が残留する — **中**

`ComboListFilters.tsx` は成立状態の select で `onFilterChange({ setupResult: null })` のみを送る。`updateFilters` は `{...filters, ...next}` のマージなので、**`setup_tech_type` / `setup_in_corner` は URL とセッションに残る**。その状態では

- 軸 2 つの select は `axesDisabled` で **`disabled` になるため、ユーザーが個別に「全て」へ戻せない**（残留値が表示されたまま操作不能）。
- `hasActiveFilters` は true のままなので、**絞り込みが 1 つも効いていないのに「フィルタあり」表示とクリアボタンが出る**。
- 再び成立状態を選ぶと、**ユーザーが意識していない軸が黙って復活する**。

`useComboListFilters.test.tsx` の「軸だけでもアクティブなフィルタに数える（クリアで確実に戻すため）」は `hasActiveFilters` 側の設計判断として妥当だが、**UI から個別に消せない状態を作らない**という §1-2 の裁定（「効かない指定を作れないようにする」）の趣旨とはねじれている。素直な解は成立状態を `null` にする onChange で `{ setupResult: null, setupTechType: null, setupInCorner: null }` を送ること。**絞り込み結果（`apiFilter`）は正しい**ため、影響は UI の一貫性に閉じる。

### (3) 軸を「不問」にしたときの 3 値の意味が、CHANGE-094 の反映文に書かれていない — **中（ドキュメント）**

実装は軸が nil のとき `cell` 句を落とすため、意味は次になる。

| 状態 | 軸を両方「不問」にしたときの意味 |
|---|---|
| `ok` | **いずれかのセル**に `ok` の行がある |
| `ng` | いずれかのセルに `ng` の行があり、かつ**どのセルにも** `ok` の行が無い |
| `unverified` | セットプレイを 1 つ以上持ち、かつ**どのセルにも**行が 1 つも無い |

したがって **4 セル中 1 セルだけ `ok` を記録したコンボは `ok` に該当し、`unverified` には該当しない**（残り 3 セルは未記録だが「行が 1 つある」ため）。これは指示書 §2.1 (b) の逐語実装として妥当だが、**「一部だけ記録済み」のコンボを未検証として拾いたいという読み方も自然に発生しうる**。設計伝達レポート §4-2 は「セットプレイ単位ではない」ことは書いているが、**セル単位（軸不問時）の意味は書かれていない**。CHANGE-094 の `DES-002` §4.2 反映文へ 1 行入れておくと、後続が「どちらだったのか」を復元できる（本サブが `chain_cancel_total` の NULL 2 種を引いて警戒しているのと同じ形の予防）。

### (4) テストの `allLabels` 完全一致が HEAD の `combos` 空を前提にしている — **低**

§6.7 に前述。`internal/repository/combo/list_setup_result_test.go:164` の `allLabels` と `..._ExistingFiltersUnchanged` / `..._AxesWithoutStateDoNotFilter` の完全一致アサートが該当。`labelsOf` が未知 ID で `t.Fatalf` するため silent には壊れないが、`migrations/000012` のコメントが「フェーズ3で総入れ替え」と述べている以上、将来の seed で落ちうる。**fixture 由来のラベルだけを残してから比較する**（未知 ID は無視する or 別アサートにする）と自サブに閉じる。

### (5) i18n キーの重複 — **低**

`comboList.filter.setupResult`＝「成立条件」は既存の `setupResult.heading` と、`comboList.filter.setupInCorner`＝「画面端」は既存の `setupResult.axisLabel` と**同一文言**である。フィルタ見出しという別文脈のキーなので誤りではないが、文言を変えるときに 2 か所を直す必要が生じる（`setupResult.*` を再利用する選択肢もあった）。設計伝達レポート §5-4 で「推測した箇所」として申告済みであり、§9 軽微の範囲。

### (6) コーディング規約・その他 — 指摘なし

- Go: エラー wrap は `List` の既存経路のまま、公開 API の godoc あり、`fmt.Println` / `console.log` の混入なし、マジックストリングは `model.*` 定数化済み。`gofmt` / `go vet` clean を当方でも再実行確認。
- TypeScript: `any` なし、`strict` 通過（`pnpm run lint` の再実行はしていないが型付きの実装で、当方が実行した vitest は型解決を伴う）。import 順（React → サードパーティ → `@/` → 相対）も維持。
- ブラウザストレージ: **新規キーなし**（既存 `combo-list-filters-v1` に相乗り）。CLAUDE.md §10.X の表への追記は不要。
- セキュリティ: SQL はすべてプレースホルダ。ユーザー入力は API 層で値域固定されており、リポジトリ層も値域外を `1 = 0` に倒す二重防御。**依存ライブラリの追加なし**（`go.mod` / `package.json` に diff 0）。

---

## 推奨修正（優先度別）

### 高（M19 完了前に修正必須）

- **なし。** §0.2 の重大（R-1〜R-7）はゼロ。G-1・G-2・G-3 はいずれも充足しており、実装をブロックする指摘は無い。

### 中（M20 着手と並行可）

1. **成立状態を「全て」に戻したときに軸 2 つも `null` へ落とす**（指摘 (2)）。`ComboListFilters.tsx` の成立状態 select の onChange で、値が空のとき `{ setupResult: null, setupTechType: null, setupInCorner: null }` を送る。既存テスト「軸だけでもアクティブなフィルタに数える」は URL 直指定のケースなので影響しない。
2. **CHANGE-094 の `DES-002` §4.2 反映文へ「軸不問時はセル横断で評価する」旨を 1 行足すよう設計卓へ依頼する**（指摘 (3)）。**製造側の作業は「上げること」まで**で、DES 本体は編集しない。

> **（指摘 (1)〔完了報告 §9 の E2E 結果〕は `a0aad46` で解消済みのため、推奨修正から外した。）**

### 低（将来対応）

4. **`allLabels` 完全一致アサートを fixture 由来のラベルに閉じる**（指摘 (4)）。
5. **i18n キーの重複**（指摘 (5)）は現状維持で可。文言変更時に 2 か所を直す必要がある点だけ認識しておく。
6. **`GET /api/combos` の 400 コード 2 系統（`invalid_query` / `invalid_query_param`）の統一**は本サブのスコープ外。既に完了報告 §6-4 に「既知の限界」として記録済みであり、**followup へ送るかは設計卓の判断**。

---

## 良かった点

1. **指示書が規定していなかった軸（論理削除された `setups`）を実装前に発見し、開発者裁定を取ってから実装した。** `setups` の SoftDelete が `combo_setups` を消さないという実装事実まで辿ったうえで、「除外しないと画面上セットプレイが無いコンボが `unverified` に出る」という**症状の形**で提示している。`PARENT-E21`（食い違ったら実装に入らず報告）の理想的な適用例。
2. **「なぜそうしたか」がコードのコメントに残っている。** `setupResultWhere` の doc コメントは 3 述語の意味・EXISTS 意味論の理由・圏外と未検証を混ぜない理由・論理削除 `setups` を除外する理由を、**根拠の文書 ID 付き**で書いている。半年後に読んでも判断を復元できる。
3. **「成立状態が nil なら軸を読まない」を、コメントではなく構造で担保している。** `if filter.SetupResult != nil` の内側でしか軸を参照しない設計にしたうえで、その事実自体をコメントに書いている（「この if の中でしか軸を参照しないことが、その扱いの実装上の担保である」）。規約を守る努力ではなく、**破れない形**にしている。
4. **テストが指示書の要求を超えている。** 軸の 4 通りに対し**逆側の軸 2 通り**を足して「軸が効いていること」を対で固定、セットプレイ 0 件は 6 通り＋「絞り込み無しなら返る」まで固定、値域外・論理削除 `setups` の追加テストもある。`SUPP-001` §5.5.2 (3)（件数だけでは広く当てすぎを検出できない）を**趣旨として**適用できている。
5. **§2.5 の「触らない」判定に、必ず実ファイルと行番号が付いている。** `MyComboPage.tsx:147-158` / `export.go:101-110` / `router.tsx` の全 19 ルート。当方の独立実査と完全に一致した。**「触らなかったこと」と「気づかなかったこと」の区別**が、報告を読むだけで付く。
6. **BE と FE の語彙同期を、判定関数の分離という形で表現している。** `IsValidSetupResultValue`（保存値）と `IsValidSetupResultFilterValue`（絞り込み）を別関数にし、`SetupResultUnverified` を保存値の const ブロックから離して「保存されない」と明記したことで、**将来誰かが `unverified` を DB へ書こうとしたときにコードが止める側に立つ。**
7. **E2E の初回 34 failed を「回帰」と早合点せず、ページスナップショットから `config.toml` 未初期化を切り分け、progress-log に教訓として残した。** 「落ちた spec 名だけを見て回帰と読むと誤る」は、この環境で今後も繰り返し起きる型である。

---

## 制約事項

- 本レビューは**コード上で判定可能な範囲のみ**対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **実データによる検証は行っていない**（本レビュー環境にも dev DB は存在しない）。特に **`unverified` がセットプレイ 0 件のコンボを含まないこと**の実データ確認は、開発者側の dev DB で `GET /api/combos?setup_result=unverified` を叩いて行う必要がある（チェックリスト §11.5）。
- **E2E は実行していない**（本レビューでは `go test` の対象 3 パッケージと、変更のあった FE テスト 2 ファイルのみ再実行した）。E2E 非回帰の判定は完了報告 §9 の記入待ちである。
- `docs/handover/` 配下は全件を読んでいない（読んだ範囲はメタ表に明記）。未読資料に本サブの判定を覆す記述があれば、本報告の結論は変わりうる。
- **不明: `pnpm test` の全件（119 files / 924 tests）と `pnpm run lint` については、完了報告の記載を再現確認していない**（当方が実行したのは変更 2 ファイル分の vitest のみ）。完了報告の記載を否定する材料は無いが、当方の検証で裏取りしたものではない。

---

*以上、M19-06 レビュー報告書。**重大ゼロ・G-1／G-2／G-3 いずれも充足**。中 3 件（E2E 証跡の空欄・軸の残留・CHANGE 反映文への 1 行）を推奨する。*

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C により、製造担当 Claude Code が自動でトリアージ・取り込みを実施した（2026-08-09）。

**★優先度「高」の指摘はゼロのため、エスカレーション（重大指摘の自動棄却）は発生していない。**

| # | 指摘 | 優先度 | 採否 | 理由 |
|---|---|---|---|---|
| (1) | 完了報告 §9 の E2E 結果が空 | 中 | **対応済み**（レビュー中に `a0aad46` で解消） | レビュー着手後に E2E 全数（70 passed / 0 failed）が確定し、切り分け経緯とともに記載済み。レビュー側も推奨修正から外している |
| (2) | 成立状態を「全て」に戻すと軸 2 つが残留し、`disabled` のため個別に消せない | 中 | **採用・修正した** | **指摘のとおり。** §1-2 の裁定「効かない指定を作れないようにする」の趣旨と、現実装（軸だけが残り操作不能・`hasActiveFilters` は true・次に成立条件を選ぶと黙って復活）がねじれていた。`ComboListFilters.tsx` に `handleSetupResultChange` を追加し、値が空のとき `{setupResult:null, setupTechType:null, setupInCorner:null}` を送る形にした。**別の状態へ切り替えるときは軸を保つ**（消すのは「全て」に戻すときだけ）。テストを 2 本に増やして両方の挙動を対で固定（既存の「軸だけでもアクティブなフィルタに数える」は URL 直指定のケースで不変） |
| (3) | 軸「不問」時の意味（セル横断で評価）が CHANGE-094 の反映文に無い | 中 | **採用・上げた** | **製造は DES 本体を編集しないため、「上げること」までが作業。** 設計伝達レポートに **§4-2b** を新設して 3 値の意味を表で明示し、完了報告 §7 の CHANGE 反映先の表にも「併記を依頼」の 1 行を追加した |
| (4) | テストの `allLabels` 完全一致が HEAD の `combos` 空を前提にしている | 低 | **採用・修正した** | 低優先だが**安価で、比較区間を自サブに閉じるという `SUPP-001` §5.5.2 (1)(2) の趣旨に直結する**ため取り込んだ。`labelsOf` を「fixture 由来のコンボだけを拾う」形へ変更（未知 ID は `t.Fatalf` せず無視）。将来 seed マイグレがコンボを投入しても巻き添えで落ちない |
| (5) | i18n キーの文言重複（`comboList.filter.setupResult` と `setupResult.heading` 等） | 低 | **不採用** | **レビュー自身が「現状維持で可」と述べており、誤りではない。** フィルタ見出しと編集セクション見出しは**別文脈のキー**であり、統合すると片方の文言を変えたいときに他方を巻き込む。既存も `comboList.filter.position`（「ポジション」）と `comboDetail.situation.position`（同）が同文言で並存しており、**この構造自体が既存の流儀**である。設計伝達レポート §5-4 に推測箇所として申告済み |
| (6) | `GET /api/combos` の 400 コード 2 系統の統一 | 低 | **不採用** | **本サブのスコープ外。** 既存が `invalid_query`（パース失敗）と `invalid_query_param`（値域不正）に割れており、新項目はそれぞれの前例へ合わせてある。統一は既存 4 パラメータの挙動変更を伴い、指示書 §8.3「壊れていないものを直さない」に反する。**完了報告 §6-4 に「既知の限界」として記録済み**で、followup へ送るかは設計卓の判断（レビューも同じ整理） |

### 取り込み後の検証

- `go test ./...` **green**（全パッケージ）／`go vet` clean ／ `gofmt -l internal/ cmd/` 出力なし
- `pnpm test` **green**（119 files / **925 tests**。ComboListFilters のテストが 17 → 18 本＝「全てに戻す」1 本を 2 本〔全てに戻す／別の状態へ切り替える〕へ割ったため +1）
- `pnpm run lint`（`tsc --noEmit`）clean
- `migrations/` ／ `moves` ／ `character_data/` ／ `internal/service/punishfinder/` ／ `internal/service/setplay/` の **diff 0 を維持**
- E2E は**取り込みが FE の 1 ハンドラとテストに閉じている**ため再実行していない（取り込み前に全数 70 passed / 0 failed を確認済み。`web/e2e/` に成立条件フィルタを触る spec は無い）

**不明点・推測で進めた箇所はなし。**
