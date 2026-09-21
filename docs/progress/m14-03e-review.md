# M14-03e レビュー報告書

## 総評

M14-03e は、第三波 6 キャラの前提行・移動技・moves/alias・`is_derived`・command 索引・`is_projectile`・移動 `total` を clean migration 経路へ投入し、チェックリストの完了承認条件を満たしている。重大指摘は 0 件で、実装は承認可能である。

`move_code` の無改変、seedgen の再利用、000026 の byte-identical、前提マイグレの件数固定、他キャラ非波及、down/re-up、`chain_cancel_total` の正しい見送りをコードとテストで確認した。初回レビューの軽微指摘 1 件と追補レビューの軽微指摘 1 件はいずれも文書追従で、取り込み済み。

| 区分 | 件数 |
|---|---:|
| 重大 | **0** |
| 軽微 | **0**（初回 1・追補 1 は修正済み） |
| 質問 | **0** |

**結論: 残指摘なし。M14-03e は承認可。**

### 追補レビュー（000059・2026-08-01）

初回レビュー後、開発者から第三波 6 キャラの移動 `total` 実測値を受領し、000059 を追加したため同じ独立レビュー担当が追補差分を再レビューした。

- 指定値 6 キャラ分が一致し、対象は 6×5＝30 行に限定されている。
- down は v58 の NULL へ忠実に戻り、re-up で同値へ復帰する。他キャラ・他フレーム列へ波及しない。
- 値の一次源と受領日、v59 固定、キャラ・code 別値、30 行件数が migration・test・完了報告・followup で一致する。
- `web/e2e/tsconfig.json` は親の `ESNext` / `bundler` 継承として妥当で、E2E 用 TypeScript 型検査も PASS。
- 軽微指摘 1 件（設計伝達レポートのテスト参照行番号）は採用・修正済み。

追補差分の最終結果は **重大 0 / 軽微 0 / 質問 0、承認可**。

## 0. レビュー前提 — OK

- 指示書 `docs/instructions/M14-03e-third-wave-code-quality.md` v1.2.0、チェックリスト v1.2.0、M14-03d 指示書・完了報告、M14 overview・研究資料・引継ぎ資料、DES-003 §3.2/§3.3/§3.9、DES-004 §2.1、code-facts、完了報告を参照した。
- ユーザー指示により Plan 表示は省略されたが、完了報告 §1 に 13 項目の実査結果があり、特に CSV 実測、v48 の親行 0、移動技 0、`chain_cancel_total` 列なしが実コード・テストと一致する。
- Git 操作は行っていない。コード・マイグレーション・既存文書も変更していない。

## 1. 【最重要】§4.3 の実測と判定 — OK

- 完了報告 `docs/progress/m14-03e-completion-report.md:34` 以降に 6 キャラ別の行数、正準形違反、40 字超、最長 code、英語名由来候補、code/alias 重複、CA/SA 欠落が記録されている。Jamie の 40 字超 7 件も `:47` 以降に列挙されている。
- 類型あり 4 体と対照群 marisa/jp は `:57` 以降で分けて判定されており、全キャラ共通問題ではないという量産波向け結論に落ちている。
- 過長 code の実害判定は、DDL、Go/JSON/CSV の文字列経路、画面18の `overflow-auto`、alias 優先のレシピ表示を根拠にしている（完了報告 `:63-72`）。targeted E2E も Jamie の 50 字 code、alias、編集可能性、専用横スクロールを検証している（`web/e2e/m14-03e-third-wave-seed.spec.ts:62-101`）。
- Luke は `no_chaser_od` が存在し誤った `chaser_od` が存在しないことを固定している（`internal/seedgen/generate_m1403e_test.go:104-111`）。第一波 Juri と同じく実害なしという判定は妥当。

## 2. `move_code` を是正していない — OK

- `GenerateWithHeader` の既存 validate を通すだけで、再採番・自動リネーム・自動 skip の追加はない。第三波 golden は CSV から現 SQL を再生成して一致を要求する（`internal/seedgen/generate_m1403e_test.go:36-69`）。
- Jamie の 40 字超 7 件は CSV のまま保持され、最長 50 字をテストで固定している（同 `:114-153`）。
- 正準形、キャラ内 code 重複、alias 重複は seedgen validate の既存 fail 契約を通過している。投入後にも migration test が重複 0 を確認する（`internal/infra/migration/migrate_m1403e_test.go:125-137`）。

## 3. 変換インフラの再利用 — OK

- M14-03b の `GenerateWithHeader` / `GenerateDerivedBackfill` / `GenerateMoveCommands` を再利用しており、第三波専用のコピー変換実装はない（`internal/seedgen/generate_m1403e_test.go:39-69`）。
- 生成対象 000055〜000057 は各 1 本に対して golden 1 本がある。
- 独立実行した `go run ./cmd/seedgen -check` は `OK: 生成物は既存ファイルと一致`。`internal/seedgen` のテストも PASS し、000026 byte-identical の回帰ゲートを満たした。
- `internal/moveindex` の規則変更はなく、第三波の索引非搭載理由も派生 250 行＋意図的空 command 2 行に限定される（`internal/seedgen/generate_m1403e_test.go:72-102`）。

## 4. seed の健全性 — OK

- 新規連番は 000053〜000059。000053 が 6 キャラを投入し（`migrations/000053_seed_characters_third_wave.up.sql:10-22`）、000054 が各キャラへ移動 9 種と alias を FK 順で投入し、000059 が移動 `total` 30 行を backfill する。
- 親行欠落のサイレント no-op は、v48 で対象 characters が 0 であることと、HEAD でキャラ別・全体の moves/alias/commands 件数を固定するテストで検出できる（`internal/infra/migration/migrate_m1403e_test.go:28-64`, `:112-123`）。
- moves 625、alias 625、derived 250、rush 101、commands 319、projectile 31 は SQL・完了報告・migration test が一致する。
- 各キャラで移動 9 種が 1 行、`drive_parry` が 1 行、対象 5 code の移動 `total` が開発者提供値と一致し、対象外 4 code が NULL であることを固定している。seedgen 経路での移動技再投入はない。
- down で v48 に復帰し、再 up で 625 moves に戻る。FK check も両方向で実施される（同 `:172-209`）。

## 5. 非破壊 — OK

- 000053〜000059 はデータ投入・backfill のみで DDL はなく、`chain_cancel_total` UPDATE もない。
- v48 の既存 13 キャラについて `(moves, official_ja_move alias)` の before/after を比較し、他キャラ非波及を固定している（`internal/infra/migration/migrate_m1403e_test.go:142-170`）。対象 SQL も第三波 code に限定され、既存キャラの `custom_states` を更新する経路はない。
- 本体ランタイムの取込経路復活や新規依存追加はない。
- 完了報告 `:128-139` は全 Playwright の既知 flakeについて、失敗 spec が第三波 spec ではないこと、対象 2 件を単独直列で 2/2 PASS としたことを記録しており、「flaky なので無視」ではなく切り分け根拠がある。

## 6. `is_aerial` の検算 — OK

- 完了報告 `:25` に、`is_aerial=false`・単方向＋ボタン・空中専用の候補 0 件、本体規則を追加していないことが明記されている。
- seedgen の索引非搭載理由に未知 token・条件残留が混ざると第三波 invariant test が失敗するため、command 索引面でも想定外のサイレント除外を検出できる。

## 7. 縮小投入・E2E・ドキュメント — OK（初回軽微は修正済み）

- 6 / 6 キャラ投入で縮小なし。対象 E2E は各キャラの characters/moves/alias/移動 9 種と Jamie の画面18表示・編集・横スクロールを検証する（`web/e2e/m14-03e-third-wave-seed.spec.ts:17-103`）。
- 旧 M12-05 fixture は Jamie の正規再追加へ追従している（`web/e2e/m12-05-seed-cleanup-and-controller-resolve.spec.ts:13-40`）。
- 完了報告には 13 項目、実測・判定、dup、連番、残キャラ、`is_aerial`、`chain_cancel_total` 見送り、配布 blocker 非解除が揃っている。

### 軽微 1（初回レビュー時点・修正済み）: followup の M14-03e 関連行が相互矛盾している

- **重大度:** 軽微（実装・配布 blocker 判定には影響しないが、後続波が読むローリング正本の状態が不正確）
- **根拠:**
  - `docs/handover/followup-backlog.md:131` は `is_projectile` backfill を「未着手（M14-03d/03e の必須作業項目）」のままにしているが、000058 は第三波 31 行（Luke 6 行を含む）を投入済みで、完了報告 `:83`, `:93` と矛盾する。
  - 同 `:137` は m_bison/rashid/jamie/luke/jp を「未登録」「未着手」のまま記載するが、000053 と直後の網羅表 `:138` は第三波 6 キャラ投入済みとしている。marisa も前提行対象なのに旧列挙に含まれていない。
  - 同 `:142` は「M14-03e で luke の backfill は必須のまま」と未来形のままで、`000058_backfill_moves_is_projectile_third_wave.up.sql:16-19` の完了状態へ追従していない。
  - 同 `:143` の移動 total 未消化キャラ列挙から marisa が漏れている。実際は完了報告 `:109-111` のとおり第三波 6 キャラすべてで移動 5 code の実測値が未受領。
- **具体的修正案:** `:131` は「M14-03d=該当 0、M14-03e=000058 で 31 行完了、03f 以降は継続」に更新する。`:137` は前提マイグレの恒久注意として残しつつ「第三波は 000053/000054 で解消、今後の未 seed 波に適用」へ更新する。`:142` は Luke 6 行完了へ、`:143` は未消化対象を第三波 6 キャラ（marisa を含む）へ修正する。

## 7.1 `chain_cancel_total` — OK（条件不成立のため見送り）

- v48 の `moves` に `chain_cancel_total` 列がないことを migration test が明示確認する（`internal/infra/migration/migrate_m1403e_test.go:38-45`）。000053〜000059 に同列への UPDATE はない。
- 完了報告 `:113-122` に後続 backfill 対象 6 キャラ 16 行が記載され、Jamie は Stand LK、Luke/Marisa は 2 技のみという非対称も正しい。

## 9. 重大な問題 — OK（0 件）

チェックリスト §9 に該当する問題はない。前提マイグレ、件数固定、golden、他キャラ非波及、down 整合、clean DB 証跡、配布 blocker 非解除を確認した。

## 10. 軽微な問題 — 検出 2 件・残件 0

初回の `followup-backlog.md` 実績追従漏れ 1 件と、追補の設計伝達レポート参照行番号 1 件。いずれも修正済み。

## 11. 質問・確認事項 — 0 件

設計担当へ確認を要する曖昧点はない。

## 12. レビュー完了判定

**承認可。** §1〜§7 の機能・品質条件を満たし、重大 0 件。初回・追補で検出した軽微 2 件はいずれも文書整合を修正済みで、残指摘はない。

## 制約事項

- 独立実行では、`internal/seedgen`、`internal/infra/migration`、`internal/repository/movecommand`、`internal/service/punishfinder` と seedgen `-check` が PASS した。
- `make test` はレビュー環境のネットワーク sandbox により `internal/infra/netutil` の socket/netlink テストだけ実行不能だった。M14-03e 関連 package は PASS しており、製造側の sandbox 外 `make test` PASS 証跡も完了報告にあるため、製品回帰とは判定しない。
- targeted Playwright の独立再実行は sandbox の listen 制限で起動できず、追加の権限付き実行は完了優先の指示により中止した。判定は spec 本文、製造側 targeted PASS、全体実行と単独切り分けの証跡に基づく。

## 良かった点

- M14-03d で発覚した「親 characters が無いと成功したまま 0 行投入」を、前提 2 migration とキャラ別・全体の固定件数で確実に封じている。
- seedgen の既知ヘッダ誤りをスコープ内で直さず、golden の不変性と恒久修正課題を分離した判断が指示書どおり。
- Jamie の過長 code を短縮せず、DDL・API・UI の実コードとブラウザ証跡で「許容」を判断したため、量産波の前提として再利用できる。
- `chain_cancel_total` は並行 worktree の将来状態を推測せず、列の実在確認後に正しく見送って 16 行を申し送っている。

## 取り込み結果（自動トリアージ）

実施日: 2026-08-01

| 指摘 | 判定 | 取り込み内容・理由 |
|---|---|---|
| 軽微 1: `followup-backlog.md` の M14-03e 実績追従漏れ | **採用・修正済み** | ローリング正本を後続波が参照するため、古い未来形・未登録表記を残す実害がある。`M14-03-is-projectile-backfill` を「M14-03d/03e 対応済み・03f 以降継続」へ更新し、第三波 31 行の内訳を明記した。未 seed 前提は第三波 000053/000054 で解消済みとし、今後の波へ一般化した。Luke の backfill は 000058 で完了済みへ更新した。移動 total も追補 000059 で第三波 30 行を解消済みへ更新した。 |
| 追補軽微 1: 設計伝達レポートのテスト参照行番号 | **採用・修正済み** | 000059 のテスト追加で移動した `OtherCharsUnaffected` と `DownRestoresPreState` の参照を、現在の `:205-233` / `:235-272` へ更新した。 |

文書のみの追従修正であり、コード・マイグレーション・テスト結果への変更はない。指摘反映後の残件は **重大 0 / 軽微 0 / 質問 0**。M14-03e は承認可とする。
