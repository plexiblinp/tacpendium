# M12-05 レビュー報告書

対象ブランチ: `feature/m12-05`(M12-05 コミット範囲: `4dcd03d` 〜 `0466b9b`、計4コミット)
レビュー方式: 実 SQL / 実コード / 実テストの Read + Grep + テスト実行(独立レビュアー)
実行確認: `go test ./internal/...` 全緑、`pnpm test --run`(web)= 90 ファイル / 535 テスト全緑、`migrate_test` を `-count=1` で再実行し version=17 / dirty=false を確認。

## 総評
最高リスクサブ(破壊的マイグレ + dbtest.Setup 波及 + 19 fixture ロックステップ)を、指示書 §10 の確定判断どおりに完遂している。マイグレ 000017 は FK=OFF を前提に子行を明示 DELETE する依存順、ryu code の CASE+IN による明示列挙(接頭辞一括置換の回避)、前方専用 down の根拠明記まで、研究報告とチェックリストの懸念を全て先回りして潰している。Go・フロントの全テストが緑で、ajg 依存テスト(NonRyu / CharacterFilter)は単純置換でなく意図を保った再設計になっている。重大(§9)指摘ゼロ。優先度「高」の修正必須事項なし。残るのは documentation/traceability の軽微点のみ。

## 設計準拠性レビュー結果

### §1 着手前確認 + §10 設計判断の反映 — ◎
- §10 の 7 判断すべてに整合(案A 新規 000017 / ryu 手移行 / ajg 除去 / ken・dhalsim NULL 据え置き / fixture スコープ / 単一サブ / CHANGE なし)。
- down 戦略 = 前方専用最小化を採用し、down.sql 冒頭で「既配布 DB なし(開発者確定 2026-06-25)」を根拠に復元しない旨を明記(指示書 §3.4.2・開発者確認1 の第一候補どおり)。

### §2 ajg 除去(最重点)— ◎
`migrations/000017_...up.sql` (A) ブロック:
- 依存順が正しい: combo_steps / combo_tags / combo_setups(子・防御的に3テーブル)→ combos → preset_aliases(move_id 参照分)→ moves → characters。FK=OFF で CASCADE 非連鎖のため明示 DELETE する設計判断が妥当(コメントでも明記)。
- `TestRun_Migration000017_*`(`migrate_test.go:505-596`)が (a) ajg characters/moves/preset_aliases/combos = 0、(b) combos 全体 = 0、orphan combo_steps = 0、(d) orphan preset_aliases = 0 を検証し緑。custom_states は characters 行ごと消える(専用列のため自動)。
- 巻き込みなし: 対象は `code IN ('aki','jamie','guile')` の character_id サブクエリに限定。他キャラ・取込データへの波及なし。

### §3 ryu code 新形化(B-7(b))— ◎
- 旧形 26 code(通常技18 + 投げ2 + rush6)を CASE で明示し `WHERE ... code IN (...)` で対象限定。接頭辞一括置換を回避しており、`jump_neutral/jump_forward/jump_back/dash_forward/dash_back/micro_forward/micro_back` の正典 movement code を破壊しない(テストで count=1 を明示検証 `migrate_test.go:582-590`)。
- 新旧対応表は研究報告 A-2 と完全一致。UNIQUE(character_id, code) 衝突なし(新形は ryu 既存 code と重複しない)。
- rush の original_move_id は数値参照のため base 改名で不変。`TestRun_RushVariantOriginalMoveID` が `rush_standing_medium_punch` → base `standing_medium_punch` を exact 検証し緑。
- preset_aliases は move_id 参照で不変。orphan 不在をテストで担保。

### §4 コントローラ(B-7(a))— ◎
`useControllerInput.ts:18-28`:
- 旧形 7 値(stand_* 6 + forward_throw)を新形(standing_* 6 + throw_forward)へ更新済み。
- `drive_impact` / `drive_parry` は不変(正典のまま)。
- `controllerTypes.ts:20` のコメントも `forward_throw` → `throw_forward` に追従(コメントの表記揺れまで是正)。
- `VirtualController.test.tsx` が新形 moveCode の期待値で緑。

### §5 マイグレーション(000017)— ◎
- 追記の 000017 のみ。既存 000001〜016 は M12-05 の4コミットで一切未編集(`git diff 4dcd03d~1..HEAD --name-only` で確認)。連番 = 000017 で正しい。
- 全マイグレ適用(version=17 / dirty=false)が成立。dbtest.Setup 依存テスト群すべて緑 = ハーネス破綻なし。
- down.sql は実質コメントのみ(no-op)。golang-migrate は up 適用のみで version=17 到達を確認済みのため許容範囲。
- drive_damage には触れていない(研究報告 A-4 と整合)。

### §6 テスト fixture 追従(ロックステップ)— ◎
- `migrate_test.go` の旧 36 件依存(combos==36 / recipe_cache==36)を ajg 除去後の最終状態(combos==0)へ修正。意図再設計済み。
- `TestRun_RushVariantOriginalMoveID` を ryu 新形 code へ更新。
- 旧形直書きの全 fixture を新形へ追従(Go 13 + フロント 5)。サブエージェント全数監査 + 自己 grep で、コード中の旧形残存は `migrate_test.go:545-555` の `oldForms` 配列のみ(= 旧形が 0 件であることを検証する負アサーション。意図的で正当)。
- ajg 前提テストの再設計(重点):
  - `service/combo/service_test.go` `TestService_Create_NonRyu_CustomStatesCharacter_OK`: ハードコード id=2(aki)を ingrid(code 引き)へ変更。classic5 は seed に moves が無いため、テスト内で新形 moves を INSERT してから作成パスを検証する正しい再設計。precondition(ingrid が custom_states を持つ)も確認。
  - `repository/tag/repository_test.go` `TestListWithUsage_CharacterFilter`: 旧 `int64(1/2/3)` 直書き(2/3=aki/jamie)を `lookupChar("ryu"/"ken"/"ingrid")` の code 引きへ変更。FK 制約に追従する適切な再設計。

### §7 既存挙動の温存(非破壊性)— ○
- resolver / recipe_cache は move_id 経由で code 改名の影響を受けない(研究報告 C-3 と整合、production Go の旧形参照ゼロ)。
- 先行リリース3体(ryu/ingrid/c_viper)の custom_states 不変、ken/dhalsim は NULL 据え置き(migrate_test の検証群が緑)。
- 既存 Go/フロントの全テストが緑で非回帰。実機・E2E のブラウザ確認は開発者ゲート(下記制約事項)。

### §8 ドキュメント・規約 — △
- 製造担当が DES 本体を直接編集していないことを確認(M12-05 の4コミットは `docs/design/` を一切含まない。main-diff に出る `05-screen-design.md` 等は前マイルストーン CHANGE-047 由来)。CHANGE 不要判定も妥当。
- 一方、`docs/handover/followup-backlog.md` の §B-7 がクローズ表記になっておらず、`docs/progress/progress-log.md` に M12-05 / 000017 の記録が見当たらない。完了報告(開発者へ返す成果物)で B-7 クローズ可否を明記する要件(指示書 §7.4)は、リポジトリ上では未反映。実害はないが traceability の軽微点。

## 設計準拠性以外の指摘事項
- `internal/service/combo/service_test.go:75-77` の `countCombos` ヘルパは依然 `WHERE character_id NOT IN (... 'aki','jamie','guile')` で ajg を除外している。000017 後は subquery が空集合のため **動作上は無害(全 combos を数える正しい挙動)**だが、除外対象がもう存在しないためコメント「耐久テスト用 seed(aki/jamie/guile)を除外」が陳腐化している。バグではなく、将来の読者向けクリーンアップ候補。
- `web/src/features/mycombo/components/CharacterSelector.test.tsx:68` に mock として `code: "aki"` が残るが、これは DB 非依存のコンポーネント単体テストの固定 props であり M12-05 の編集対象外。無害。
- マイグレ SQL / テストの整形・命名は規約内(チェックリスト §10 で軽微許容)。

## 推奨修正(優先度別)
- 高(M12完了前に修正必須): なし。
- 中(M13着手と並行可):
  - followup-backlog §B-7 のクローズ可否を明記し、progress-log に M12-05/000017 の記録を残す(指示書 §7.4・traceability)。製造の完了報告が開発者へ返っていれば実害はないため中。
- 低(将来対応):
  - `service/combo/service_test.go` の `countCombos` ヘルパのコメント/不要な ajg 除外条件を整理(ajg は除去済みのため除外句は実質 no-op)。

## 良かった点
- FK=OFF・CASCADE 非連鎖・UNIQUE 衝突という研究報告/チェックリストの主要リスクを、SQL コメントで明示しながら正面から潰している。特に接頭辞一括置換を避けて 26 code を CASE+IN で明示列挙し、movement code 破壊を防いだ判断が秀逸。
- 000017 専用テストが (a)〜(d) に加えて orphan(combo_steps / preset_aliases)と「正典 movement code が壊れていない」ことまで明示検証しており、negative assertion(旧形 0 件)も網羅。レビュー観点を先取りした自己テスト設計。
- ajg 依存テストを単純置換でなく ingrid への置換 + 必要 moves の INSERT + precondition 確認、id 直書き→code 引きへと意図を保って再設計しており、指示書 §4.3 の「再設計」要件を正確に満たしている。
- 指示書/研究報告の「フロント7・計19」に対し HEAD 実測「フロント5・Go 13(うち migrate_test 含む)」という差分は妥当。フロントは旧形を実際に直書きしていたのが5ファイルであり、Go 側は研究報告の12に加え `repository/tag/repository_test.go`(ajg id 依存)が再設計対象として正当に追加されている。過不足なく追従している。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- B-7(e) 全キャラ仮想コントローラ回帰の実機確認(ryu + 取込5体で通常技/投げが解決)は開発者ゲート。E2E spec `web/e2e/m12-05-...spec.ts` は配布クリーン(ajg 不在)と ryu の B-7 回帰を自動化済みだが、製造環境ではブラウザ未導入のため未実行(spec 冒頭に明記)。Playwright 構築済み環境での実行は開発者が実施すること。

---

## 取り込み結果(自動トリアージ)

`/implement_plan_full` Phase C による自動トリアージ。優先度「高」指摘ゼロのためエスカレーションなし。各指摘の採否と理由:

| 指摘(優先度) | 採否 | 理由 |
|----------------|------|------|
| 中: followup-backlog §B-7 クローズ明記 + progress-log に M12-05/000017 記録(§7.4 traceability) | **採用** | 指示書 §7.4・CLAUDE.md §8 の要件。`docs/progress/progress-log.md` に M12-05 節を追加、`docs/handover/followup-backlog.md` §B-7 にステータス(M12-05 で解消・残課題なし)を追記。実害はないが traceability を満たすため反映。 |
| 低: `internal/service/combo/service_test.go` `countCombos` の陳腐化した ajg 除外コメント整理 | **採用** | 当該ファイルは本サブで編集済み、かつ陳腐化は本サブの ajg 除去で生じたもの。クエリは挙動不変(ajg 除去後 NOT IN は空集合=全 combos 計数)のまま、コメントを「ajg 除去済み・除外句は防御として残す」へ更新。 |
| (指摘外・参考)`web/src/features/mycombo/components/CharacterSelector.test.tsx:68` の mock `code:"aki"` | **不採用** | DB 非依存のコンポーネント単体テストの固定 props。move_code 旧形でも ajg seed でもなく、本サブ(seed 整理 + move_code 新形化)のスコープ外。無害のため現状維持(スコープ厳守)。 |

いずれも reversible なローカル/ドキュメント変更。優先度「高」の不採用はなし(エスカレーション不要)。
