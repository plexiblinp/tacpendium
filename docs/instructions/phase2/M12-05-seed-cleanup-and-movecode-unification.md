# 指示書 M12-05: 検証データ / seed 整理 + B-7 move_code 旧形→新形統一(案B)

| 項目 | 内容 |
|------|------|
| 文書ID | M12-05 |
| バージョン | 1.0.0 |
| 種別 | 実装指示書(マイグレーション + フロント + テスト fixture) |
| 対象 | 製造担当 Claude Code |
| モデル | **Opus 4.8 / Plan Mode 必須**(破壊的マイグレ + `dbtest.Setup` 波及 + ロックステップ) |
| レビュー | M12-05 レビューチェックリスト(Sonnet 4.6) |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 本流スパイン・M12 担当)/ 2026-06-25 |
| 前提 | M12-04 完了。**M12-RESEARCH-02-report.md** でスコープ確定。設計判断は §10(開発者確定 2026-06-25) |
| 主参照 | M12-RESEARCH-02-report、code-facts §10/§1/§2、DES-003 §3.4/§6/§7、DES-004 §2.1、followup-backlog §B-7、retrospective-digest §5 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-25 | 初版。M12-RESEARCH-02 を受けた案B(seed 整理 + B-7)。 |

---

## 1. 背景と目的

### 1.1 背景

先行リリース(M12 完了点)に向けて、(1) 耐久テスト用 seed の除去で配布 DB をクリーン初期状態にし、(2) B-7(仮想コントローラ / seed の move_code 旧形→新形統一)を解消する。M12-RESEARCH-02 で実態が確定済み:

- 耐久 seed(000012)= aki/jamie/guile の combos 36 件(ryu は含まない)。
- 旧形 move_code の実コード逸脱点 = seed(000004 ryu moves / 000006 ryu aliases / 000010 ajg moves / 000011 ajg aliases / 000012 combo_steps)+ コントローラ `useControllerInput.ts` の 1 ファイル。production Go・i18n・recipe 実コードには旧形ゼロ(recipe は move_id 参照で保存データ安全)。
- 取込 dist CSV(ryu/ken/ingrid/c_viper/dhalsim)は全て新形。**ajg は dist CSV 無し**。
- コントローラを新形化すると、旧形 seed のまま残るキャラ(=ajg)で通常技/投げが無反応化する。

### 1.2 目的

§10 の確定設計判断に沿って次を実施する:

1. 新規マイグレ **000017** で **ajg(characters/moves/aliases/combos/custom_states)を除去**し、**ryu の moves.code を旧形→新形に統一**する。
2. 仮想コントローラ `BUTTON_TO_MOVE_CODE` の旧形 7 値を新形へ更新する(B-7(a))。
3. 上記に伴うテスト fixture(Go 12 + フロント 7 + `migrate_test` の 36 件アサーション)をロックステップで追従させる。

### 1.3 このマイルストーン(指示書)で作らないもの

- ajg の再投入・正典化(除去で確定。再追加は別スコープ)。
- ブランカ等「先行リリース5体外」の新規追加(別スコープ)。
- FR701 取込ツール本体の変更(別チャット・別設計書)。dist CSV はそのまま使用。
- DES 本体の改訂(本サブは CHANGE 見込みなし。§4.4 で着手前確認)。
- custom_states 消費のモデル化(フェーズ2 スコープ外、notes 管理)。

---

## 2. 成果物

### 2.1 作成するファイル
- `migrations/000017_<説明>.up.sql` / `.down.sql`(ajg 除去 + ryu code 新形化。`<説明>` は命名規則に沿って製造担当が付与)。
- マイグレテスト(000017 の検証。既存 `migrate_test.go` への追加 or 新規)。

### 2.2 修正するファイル(実パスは §3.4 で HEAD 確認)
- `web/src/features/combo/components/VirtualController/useControllerInput.ts`(`BUTTON_TO_MOVE_CODE`)。
- 旧形 code に依存するテスト fixture(Go 12 ファイル + フロント 7 ファイル。実体は §3.4.1 で再確認)。

### 2.3 変更しないもの(原則)
- DES 本体(CHANGE 見込みなし。§4.4)。
- 取込パイプライン(FR704)・取込 CSV・resolver(move_id 参照のため改名の影響を受けない)。
- 既存マイグレ 000001〜000016(編集しない。追記の 000017 で対応)。

### 2.4 例外・BE 変更の範囲
- 本サブの BE 変更は **マイグレーション 000017 とテストのみ**。ハンドラ・service・repository のロジック変更は含まない(code 改名は seed SQL とコントローラのみで、production Go は旧形参照ゼロ)。

---

## 3. 前提条件

### 3.1 必読ドキュメント
- **M12-RESEARCH-02-report.md**(全節。特に A-1/A-2/A-3、B-1/B-2、C-1〜C-4、D-2〜D-4、E-1〜E-3、F-1/F-4、§要決定事項)。
- **code-facts §10**(マイグレ一覧・000001 の FK 定義・000016 の再構築技法)・**§1/§2**(VirtualController・useControllerInput)。
- **DES-003** §3.4(combos)・§6(実装時決定項目)・§7(マイグレーション方針)。
- **DES-004 §2.1**(move_code 正典 = 新形)。
- **followup-backlog §B-7**(必要作業 (a)〜(e)・CHANGE 不要根拠)。
- **retrospective-digest §5**(破壊的マイグレ × `dbtest.Setup`)・§1 パターン A。

### 3.2 任意参照
- CHANGE-046 / change-report-046(000016 の非破壊テーブル再構築技法の前例)。

### 3.3 参照不要
- M12-01〜04 の UX 系指示書(本サブと無関係)。

### 3.4 着手前の確認(結果を Plan Mode で開発者に報告すること)

> 報告の事実は調査時点(commit `5acf478`)のもの。**HEAD で再確認**してから着手する(retrospective-digest §1 パターン A)。「あるはず」で書かない。

#### 3.4.1 旧形 code とテスト fixture の HEAD 再確認
- M12-RESEARCH-02-report A-2 の旧形 code(`stand_*`/`crouch_*`/`jump_*`/`forward_throw`/`back_throw`・ryu の rush base 6)を **seed 4 ファイルで HEAD 再 grep**。新旧対応表(A-2)が HEAD と一致するか報告。
- report B-2 の **旧形依存テスト(Go 12 + フロント 7)と `migrate_test.go` の 36 件 exact 依存(L452/L453)・rush exact(L487-493)を HEAD で再特定**。ファイル数・該当行が変動していれば差分を報告。

#### 3.4.2 マイグレ 000017 の方式と down 戦略(§10-1 確定 + Plan Mode)
- 方式 = **案A(新規 000017・追記)で確定**(§10-1)。次連番 = 000017(report E-1)。
- **down 戦略を Plan Mode で提示**: golang-migrate 規約上 down ファイルは必須。除去(ajg)+ code 改名(ryu)を**忠実に逆操作で復元する down** か、**前方専用クリーンアップとして down を最小化(復元せず、その旨を SQL コメントで明記)する** かを、既配布 DB なし(開発者確定)を前提に提案する。

#### 3.4.3 ajg 除去の FK・依存順・cascade(report E-3 / 000001 の FK 定義)
- 000001 で `moves.character_id` / `combos.character_id` は **`ON DELETE CASCADE` を持たない**(combo_steps/combo_setups/combo_tags は combos からの CASCADE あり)。マイグレ接続は **FK=OFF**(report E-3・B-1)。
- よって ajg 除去は **明示 DELETE を依存順で**行う: combos(→ steps/setups/tags は CASCADE)→ preset_aliases(対象 move 参照分)→ moves → characters(custom_states 列ごと消える)。**この順序・対象を Plan Mode で確定**。

#### 3.4.4 ryu code 新形化の衝突・エイリアス波及
- `UPDATE moves SET code=新形 WHERE character=ryu AND code=旧形` 系で **`UNIQUE(character_id, code)` 衝突が起きない**ことを確認(新形 code が既存と重複しないか)。
- **preset_aliases(000006)が move_id 参照で改名の影響を受けない**(report C-3)ことを再確認し、aliases に追加操作が**不要**である裏取りを報告。不要でない事実が出たら対象を列挙。

#### 3.4.5 CHANGE 要否(§4.4)
- DES-003 §6/§7・配布前提・REQ を grep し、**ajg 除去・耐久 seed 除去・ryu code 統一が DES 本体規定と矛盾しない**こと(= CHANGE 不要)を確認。乖離が出たら起票候補として報告(設計担当が判断)。

#### 3.4.6 B-7(e)全キャラ回帰の手動確認手順
- コントローラ新形化後、ryu + 取込5体で**通常技/投げが技に解決される**(無反応でない)ことの手動確認手順を整理(ブラウザ実機は開発者ゲート、§9)。

---

## 4. 詳細仕様

### 4.1 マイグレ 000017(ajg 除去 + ryu code 新形化)

- **ajg 除去**: aki/jamie/guile の characters(000009 由来)・moves(000010)・preset_aliases(000011 由来・対象 move 参照分)・combos(000012 由来・steps/setups/tags は CASCADE)を DELETE(§3.4.3 の順序)。custom_states は characters 行ごと消える(report F-1: aki=poison / jamie=drunk_level / guile=NULL)。
- **ryu code 新形化**: ryu の moves.code を旧形→新形へ UPDATE(report A-2 対応表。通常技 18 + 投げ 2 + rush base 6)。preset_aliases は move_id 参照で不変(§3.4.4 で裏取り)。
- **整合**: 000012(ajg combos)は 000017 で除去されるため、その combo_steps の旧形 code join も道連れ(report C-2/C-4)。新規 DB は「000012 で投入 → 000017 で除去」= 実質未投入(無効化マイグレの趣旨)。
- **drive_damage**: 000012 は drive_damage を投入していない(report A-4)。000016(REAL 化)との整合は確認済み。本マイグレで drive_damage に触れない。

### 4.2 仮想コントローラ(B-7(a))

- `useControllerInput.ts` の `BUTTON_TO_MOVE_CODE` の旧形 **7 値**(`stand_light_punch`〜`stand_heavy_kick` の 6 + `forward_throw` の 1)を新形(`standing_*` 6 + `throw_forward` 1)へ更新(report C-1)。
- `drive_impact` / `drive_parry` は正典のまま(変更しない)。
- `addMoveStep` の `moves.find(m => m.code === code)` 完全一致が、ryu(seed 新形化後)+ 取込5体(新形)で解決されるようになる(report C-1/C-4)。

### 4.3 テスト fixture 追従(ロックステップ・report B-2)

- **`migrate_test.go`**: L452/L453 の `combos WHERE code IN (aki,jamie,guile) == 36` / `recipe_cache IS NOT NULL == 36` を、**ajg 除去後の最終状態(= 0)**に合わせて修正(または該当テストの意図を再設計)。L487-493 `TestRun_RushVariantOriginalMoveID` の rush exact 比較を ryu 新形 code(`rush_standing_*` 等)へ更新。
- **旧形 code を直書きする Go テスト 12 ファイル + フロント 7 ファイル**(report B-2 (iii) の一覧)を、A-2 新旧対応表で**全数**新形へ更新。`VirtualController.test.tsx` 等のコントローラ系も新形 code で期待値を更新。
- **方針**: fixture の更新は「旧形 → 新形」の機械置換が基本だが、ajg を前提にしたテスト(36 件依存等)は**意図を確認して再設計**する(単純置換ではない)。

### 4.4 CHANGE 要否

- **見込み = CHANGE 不要**(seed/マイグレはデータ = DES 本体規定外〔DES-003 §6/§7〕、B-7 は正典 DES-004 §2.1 が既に新形 = 実装是正のみ〔followup-backlog §B-7〕)。
- §3.4.5 の着手前確認で DES 乖離が出た場合のみ、設計担当へ起票候補として報告する(製造担当は DES を直接編集しない)。

---

## 5. テスト要件

### 5.1 必須テスト(Go test / Vitest)
- **マイグレ 000017(新規 or migrate_test 追加)**: 全マイグレ適用後に (a) ajg の characters/moves/preset_aliases/combos が **0 件**、(b) 耐久 combos が **0 件**、(c) ryu の moves.code が**新形のみ**(旧形 0 件)、(d) ryu の preset_aliases が move_id 整合を保つ、を検証。
- **`dbtest.Setup` 緑維持**: 全マイグレ適用ハーネスが破綻しない(retrospective-digest §5)。
- **旧形依存テスト 19 ファイルが新形で緑**(§4.3)。
- **コントローラ解決**: 新形 `BUTTON_TO_MOVE_CODE` が ryu + 取込キャラの moves で解決される(無反応にならない)ユニット/コンポーネントテスト。

### 5.2 E2E シナリオ(§6 参照・実装方式非依存で記述)
- **B-7 回帰(最重点)**: 取込キャラ(例 c_viper)を選択し、仮想コントローラの通常技ボタン・投げが**ステップに追加される**(従来の無反応が解消)。
- **配布クリーン確認**: 新規 DB 構築直後の状態で、コンボ一覧に**耐久 seed(ajg の 36 件)が存在しない**・キャラ選択に ajg が出ない(取込5体 + ryu のみ)。
- ryu の通常技/投げも仮想コントローラで解決される(seed 新形化の確認)。

---

## 6. レビュー観点(別ファイル参照)

`docs/instructions/reviews/M12-05-review-checklist.md`(Sonnet 4.6)。最重点 = (a) ajg 除去の網羅と FK/順序、(b) ryu code 新形化の orphan 不発生・aliases 不変、(c) `dbtest.Setup` 緑 + 19 fixture 追従、(d) DES 無改訂。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件
- 新規 DB 構築後、**ajg(characters/moves/aliases/combos/custom_states)が存在しない**。
- 新規 DB 構築後、**耐久 combos(000012 由来)が存在しない**。
- **ryu の moves.code が新形**(旧形 0 件)。preset_aliases が move_id 整合を保つ。
- 仮想コントローラが **ryu + 取込5体で通常技/投げを解決**(無反応ゼロ)。

### 7.2 自己テスト結果(製造担当の責任範囲)
- §5.1 のユニット/マイグレテストが緑(ケース数で報告)。`dbtest.Setup` 依存テスト全緑。

### 7.3 品質チェック
- 旧形 code が seed・コントローラ・テストから**全数消えた**ことを grep で確認(production Go・i18n は元から 0)。
- マイグレ接続 FK=OFF・`UNIQUE(character_id, code)` 衝突なしを確認。

### 7.4 ドキュメント
- CHANGE 要否(§4.4)の判定結果を完了報告に明記。**製造担当は DES を直接編集していない**。
- followup-backlog §B-7 のクローズ可否(残課題の有無)を完了報告に記す。

### 7.5 完了報告
- §10 設計判断どおりに実装したか(逸脱した箇所は「推測/独自判断」として明示)。
- B-7(e)全キャラ仮想コントローラ回帰の手動確認手順(開発者ゲート用)。

---

## 8. 参照ドキュメント

- M12-RESEARCH-02-report v1.0.0、code-facts(`5acf478`)§10/§1/§2。
- DES-003 v1.22.0 §3.4/§6/§7、DES-004 v1.6.2 §2.1、DES-002 v1.23.0 §7(取込)。
- followup-backlog §B-7、M12-overview §3(M12-05)、m12-design-session-handover §3.1。
- retrospective-digest §5 / §1 パターン A、CHANGE-046(000016 技法)。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- ajg 除去の DELETE 対象・順序(FK=OFF と cascade の非連鎖を確認してから)。
- ryu code 新旧対応(A-2 表を HEAD で裏取りしてから)。
- テスト fixture の 19 ファイル(report B-2 一覧を HEAD で再特定してから)。

### 9.2 推測で進めてよい事項(その旨を明示)
- マイグレファイルの `<説明>` 命名・SQL の整形スタイル(規約内で製造担当裁量)。

### 9.3 不明事項発見時
- DES 乖離・想定外の旧形参照箇所・dbtest 依存の新規発見は、独自判断せず設計担当へ報告(Plan Mode / 完了報告)。

### 9.4 Plan Mode で含めるべき項目
- §3.4.1〜3.4.6 の再確認結果。**down 戦略**(§3.4.2)・**ajg DELETE の順序/対象**(§3.4.3)・**CHANGE 要否**(§3.4.5)を必ず含める。

---

## 10. 確定した設計判断(開発者確定 2026-06-25)

| # | 判断 | 内容 |
|---|------|------|
| 10-1 | マイグレ方式 | **案A = 新規 000017(追記のみ)**。既存マイグレ 000001〜016 は編集しない。 |
| 10-2 | ryu の扱い | **手移行で新形化**(000017 で moves.code を UPDATE)。seed code = 取込 code = 新形となり orphan が出ない。再取込は将来も可。 |
| 10-3 | aki/jamie/guile | **除去**(characters/moves/aliases/combos/custom_states)。先行リリース対象外 + dist CSV 無し + 旧形 seed・耐久 combos の本体。 |
| 10-4 | ken / dhalsim の custom_states | **NULL 据え置き**(モデル化すべき開始時状態なし=開発者確定)。 |
| 10-5 | テスト fixture | **本サブのスコープに含める**(migrate_test 2 件 + Go 12 + フロント 7 = 計 19 をロックステップ追従)。 |
| 10-6 | サブ構成 | **単一実装サブ**(seed 整理 + B-7 を一体で実施)。 |
| 10-7 | CHANGE | **見込みなし**(seed/移行はデータ = DES 本体規定外、B-7 は正典既新形)。§3.4.5 着手前確認で最終判定。 |

---

## 開発者への確認事項

1. **down 戦略の最終承認**
   何を確認したいか: §3.4.2 の down(忠実復元 / 前方専用で最小化)のいずれを採るか。
   なぜ確認が必要か: golang-migrate 規約上 down は必須だが、ajg 全削除 + ryu code 改名の忠実な逆操作は重く、既配布 DB なしなら前方専用クリーンアップで足りる可能性がある。
   暫定案: 製造担当が Plan Mode で両案の SQL 規模を提示 → 既配布 DB なし(確定)を前提に**前方専用で最小化(復元せず SQL コメントで明記)**を第一候補とする。最終はご判断。

2. **B-7(e)全キャラ回帰の実機確認**
   何を確認したいか: コントローラ新形化後の「ryu + 取込5体で通常技/投げが解決」のブラウザ実機確認は開発者ゲートでよいか。
   なぜ確認が必要か: 設計担当・製造担当はブラウザ実機確認の権限を持たない(playbook §1.3)。
   暫定案: E2E spec(§5.2)で自動化できる範囲を製造担当が作成し、実機の最終確認は開発者が実施。
