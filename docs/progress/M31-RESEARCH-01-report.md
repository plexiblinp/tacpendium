# M31-RESEARCH-01 調査レポート: moves.setup_only

- 調査日: 2026-09-09
- 担当: Codex / research_plan 自動モード（開発者承認済み）
- 指示書: [M31-RESEARCH-01 v1.0.0](../instructions/M31-RESEARCH-01-setup-only-flag.md)
- コード基準: `026aa326`。開始時の作業ツリーは変更なし。
- 母集団: `/home/node/.local/share/tacpendium/tacpendium.db` の `moves` 全3,026行・31キャラ（schema_migrations = 106、dirty = 0）。CSVを母集団にしていない。
- 測定方法: Python sqlite3 の `file:/home/node/.local/share/tacpendium/tacpendium.db?mode=ro` URI接続。各接続内で読み取りトランザクションを開始してSELECT。DB・コード・設計書は変更していない。これは既存ローカルDBの実測であり、新規マイグレーション適用によるseed再構築ではない。

結論サマリ: `setup_only=1` は0行。列の目的は一度も決まっていないわけではなく、CHANGE-022と現行DES-003には「コンボ登録UIの技選択から除外」、M19-01には「ユーザー登録のセットプレイ専用 move」という開発者確定記録がある。現実装は値を取得・返却・ラッシュ生成時に複製するが、表示や提案の判定には使っていない。fillerから除外しないことはテストで明示されている。

追加の発見: キャミィの保留9件は moves に全件存在し、未登録なのは子としての move_derivations である。custom_states と本列は保存する対象・粒度が異なり、同じ概念だから片方が不要、と判断できる事実は得られていない。以下は事実と未採択の選択肢であり、実装方針を決定しない。

## 1. 列の来歴

| 時点・資料 | 確認できた事実 |
|---|---|
| [CHANGE-022 §2](../change-notes/phase2/CHANGE-022-moves-frame-data-and-csv-contract.md)（列定義は61行） | 「セットプレイ専用フラグ。true の move はコンボ登録 UI の技選択から除外する。将来のセットプレイ自動提案機能のための予約列。本フェーズではフラグ保持のみで利用ロジックは未実装」。115行では「既定 false。手動付与を想定」 |
| [M8-01 §4](../instructions/phase2/M8-01-moves-frame-columns-migration.md)・[レビュー](phase2/m8-01-review.md) | 列を追加しモデル・DTO・GET・フロント型へ搬送。本フェーズはフラグ保持のみ（指示書186行）。レビューも物理型・搬送・既定falseを確認 |
| `migrations/000013_add_moves_frame_columns.up.sql:1–11` | CHANGE-022/025を参照。`ALTER TABLE moves ADD COLUMN setup_only INTEGER NOT NULL DEFAULT 0; -- BOOLEAN`。コメントは加算的追加・既存行補完・backfillなし・0/1の物理表現を述べる。どの技・画面で使うかはSQL内には書かれていない |
| モデルコメントの導入 | `git log -L 68,68:internal/model/move.go` で追跡。`39f2cd07a23eb2a50a96a9617d466eb2b0d67526`（2026-06-12、M8製造）の追加時から「予約列」。Git記録はauthor plexiblinp / Co-Authored-By Claude Opus 4.8。個別に誰が文言を選んだかまでは履歴から不明 |
| M14-01 | `fa911c08`（2026-06-30）は周辺列削除に伴う整列変更。予約列コメントの新規導入ではない |
| [M19-01 §4.5](../instructions/M19-01-setplay-suggestion-engine-and-ui.md)（261–263行） | 2026-07-24開発者確定として「ユーザー登録のセットプレイ専用 move」「コンボ登録等の技選択から隠すための行区分」。ONがあるキャラをONだけのfiller候補にする案は撤回。trueもfiller候補へ含める |
| [M19-01完了報告](M19-01-report.md)・[CHANGE-085反映報告](../change-notes/change-report-085.md) | filler絞り込みを実装していないことを記録。反映報告91行では予約列記述の陳腐化とコンボ登録UIからの除外という役割を記録 |
| [現行DES-003 §3.3](../design/03-data-model.md)（347行） | 「本列の役割はコンボ登録 UI からの除外のみ」。2026-07-26 errata③で、予約列・提案未実装という従来説明を訂正している |
| [followup §CD](../handover/followup-backlog.md)（1632行）・D-781 / D-788 | データ0件と開発者の保留・専用サブ要求を記録。M31での具体的な付与対象は未決 |

### 1.1 文書の不整合（事実）

- [M19-DESIGN-02 §5](../handover/M19-DESIGN-02-suggestion-logic.md) 59行には今も「ON 行が 1 件以上あるキャラはそれのみ、0 件なら全技」という活用開始案が残る。M19-01 §4.5は同節も書き換えたと述べるが、現ファイルはその記述と一致しない。
- [SF6セットプレイ-ドメイン知識集成 §7-3/§9-14](../handover/SF6セットプレイ-ドメイン知識集成.md) は意味を照会中とし、撤回版「v1.0.2」が存在しないと記録している。一方、現行DES-003・M19-01・followupの `M19-setup-only-filter`（250行）は撤回・行区分を記録する。資料を一律に同じ状態の仕様として読めない。
- 本調査では矛盾を独自に解消せず、各記録の内容を併記する。実装は行わない。
- 指示書がセットプレイ画面として挙げるDES-005 §5.19は現行では引っ越し取込、§5.19bはゲーム更新影響コンボ。セットプレイ登録・編集の実際の節は§5.9（947行）である。§5.7と§5.9、コード側の2入力面を照合した。

## 2. 実装で既に決まっていること

### 2.1 本番コードの全参照経路

全ヒットのファイル・行は付録A。定義・SQL搬送・コピーと、値を使う条件分岐を区別した。

| パス（リポジトリルート相対） | 動作 |
|---|---|
| `internal/model/move.go:68` | boolフィールド。DB名setup_only、JSON名setupOnly。「予約列」コメント |
| `internal/repository/move/repository.go:40,135` | MoveListItemのフィールドと一覧Scan |
| `internal/repository/move/queries.go:21,37` | 一覧・詳細でSELECT。一覧のWHEREはcharacter_id、詳細はid。setup_onlyによる除外はない |
| `internal/repository/move/edit.go:47` | 詳細Scan。更新入力の項目ではない |
| `internal/repository/move/rush.go:30,76` | ラッシュ版INSERTに列を指定し `src.SetupOnly` を複製する。付与判定や元行更新ではない |
| `internal/repository/setplay/repository.go:28,70,96` | MoveCandidateに取得。WHEREはcharacter_id。target・filler共通の母集団に保持 |
| `internal/api/move/dto.go:25,53,79,99` | MoveResponse/MoveDetailResponseの両方に `json:"setupOnly"`（omitemptyなし）で返却 |
| `internal/service/setplay/service.go:434` | コメントは「is_derived / rush_variant / setup_only 単独では絞らない」。本番処理にSetupOnlyの値参照は0件 |
| `web/src/features/moves/types.ts:38,91` | Move/MoveDetailのboolean定義。フロント本番コードの直接参照はこの2定義のみで、値を使う表示条件は0件 |

`internal/api/move/dto.go:109` のUpdateMoveRequestはtotal/startup/active/onHit/onBlock/damage/recovery/isAerial/rawDataのみ。setupOnlyを書き換えるPATCH入力はない。`internal/seedgen` と `character_data` に本列の参照は0件で、現在のCSV投入契約にsetup_onlyフィールドはない。過去のFR704契約記述（DES-002:1044）の手動付与想定と、現在の書き込み口は別である。

### 2.2 fillerの逐語と適用限界

`internal/service/setplay/refine_test.go:104`:

> // §4.1「除外しないもの」: is_derived / rush_variant / setup_only は filler に含まれる。

同21行のfixtureは `Code: "setuponly21"`、`Category: model.MoveCategoryNormal`、`Total: ptr(21)`、`SetupOnly: true`。同105–117行の `TestRefine_FillerIncludesDerivedRushSetupOnly` はそのcodeが提案中で使われることを検証する。

> t.Errorf("filler %s must be usable (is_derived/rush/setup_only are not excluded)", code)

`internal/service/setplay/service_test.go:337–357` も `SetupOnly: true` の `so_filler` が使われることを検証する。

> t.Errorf("setup_only=true move must be usable as filler, got %+v", res.Proposals)

「trueなら無条件に候補へ入る」という意味ではない。現行 `collectFillerSingles`（service.go:439）はtotalが1以上、target_comboかつis_derivedではない、`isSoloUnavailable`でないことを要求する。setup_onlyだけでは除外しない。`collectTargets`（610行）にも本列の条件はなく、startup/active、種別、fastest_unreachable、basis・親参照、damageなど別条件がある。M19初期の「全技」を現行の無条件包含と読み替えない。

本調査ではテストを読んで期待値を確認した。テスト・ビルド・サーバ起動・マイグレーション実行はしていない。

## 3. 立てるべき技の候補

「立てるべき」は未決であり、以下は判断材料となる既存行・保留記録である。

### 3.1 実DBの件数

| category | moves行数 | setup_only=1 |
|---|---:|---:|
| normal | 579 | 0 |
| unique | 193 | 0 |
| special | 1024 | 0 |
| super_art | 138 | 0 |
| critical_art | 32 | 0 |
| system | 310 | 0 |
| target_combo | 126 | 0 |
| throw | 79 | 0 |
| drive_impact | 31 | 0 |
| rush_variant | 514 | 0 |
| 合計 | 3026 | 0 |

フラグによってセットプレイ専用と明示されている実データは0件。「ゲーム上セットプレイでしか使わない技」の全数は、このDBには別の判定列がなく、技名・categoryだけでは確定できない。0件という実測を、ゲーム上の専用技が存在しないという意味にはしない。

### 3.2 キャミィの保留9件

[followupの当該行](../handover/followup-backlog.md)（1213行）の開発者裁定は逐語で次のとおり。

> 実測は可能ですが、セットプレイはともかく、コンボではあまり意識しないので、表示が増える形になると煩雑になります。`setplay_only` 列がまだちゃんと動いていない現状、保留でもいいかな

同じ記録は「再開条件＝`setplay_only` が機能すること」とする。実スキーマ名は `setup_only` で、setplay_only列・同名コードは0件。D-724（parallel-board:619）も同条件を記録している。引用の綴りは変更していない。

DBと `character_data/cammy.csv:58–60,70–72,76–78` で照合した9行は以下。すべてcategory=special、setup_only=0。親件数は `move_derivations.child_move_id = moves.id` の行数。

| move_code | total | 親件数 |
|---|---:|---:|
| cannon_strike_light_od_hooligan_combination_od | 53 | 0 |
| cannon_strike_medium_od_hooligan_combination_od | 51 | 0 |
| cannon_strike_heavy_od_hooligan_combination_od | 50 | 0 |
| fatal_leg_twister_light_od_hooligan_combination | 69 | 0 |
| fatal_leg_twister_medium_od_hooligan_combination | 67 | 0 |
| fatal_leg_twister_heavy_od_hooligan_combination | 64 | 0 |
| silent_step_light_od_hooligan_combination_od | 39 | 0 |
| silent_step_medium_od_hooligan_combination_od | 38 | 0 |
| silent_step_heavy_od_hooligan_combination_od | 37 | 0 |

ODキャノンストライク・フェイタルレッグツイスター・ODサイレントステップの弱中強各3行である。親側のODフーリガンは `hooligan_combination_od` 1行（special、setup_only=0）で、弱中強ODの親行はない。

[M14-03f完了報告 §19-3](M14-03f-completion-report.md) は「move_derivationsの裁定」としてこの9件を「行を作らない」に数えている。したがってfollowupの「9件が投入できていない」をmovesの不在と解釈すると現物と食い違う。9件のmoveは既存で、未登録なのは子側の親参照。なお `silent_step_light_od_hooligan_combination_od` は `000101` でreverse_edge_odの親としては使われている（up.sql:561–568）。「子としての親参照0件」は、このmoveが親側でも一度も使われないという意味ではない。

9件へのフラグ付与・強度別親の新設は未承認。本報告の9行照合は文書の件数・名称と既存データによるもので、これらをセットプレイ専用と新たに裁定していない。

### 3.3 custom_statesとの重なり

[CHANGE-169 §2.2](../change-notes/CHANGE-169-notification.md) の選定基準:

> なおここに出す技の基準は、始動技よりも先にやっておくムーブかどうかです。

| 比較軸 | setup_only | custom_states |
|---|---|---|
| 定義の単位 | movesの1行にboolean | charactersのJSON内にcode/type/subject等の状態定義 |
| コンボ単位の値 | moveを参照してもフラグはmoves側の値 | combos.situation.custom_statesに付与値。flagまたはstart_min/end等 |
| 記録された目的 | コンボ登録UIの技選択から隠す行区分 | 始動より先に成立している状態を記録する |
| 技への対応 | move行自身 | move_idへのFK・1対1対応ではない。名前・粒度は一致不要（CHANGE-169 §2.4） |
| 現行画面 | 値による出し分けなし | 状態入力に使用。仮想コントローラのキャラ固有状態タブは状態code/語幹とmove.codeの文字列照合にも使用 |

コード根拠: `internal/model/character.go:15`、`web/src/features/combo/customStates.ts:1–55,131,153,187`、`moveSurfacing.ts` の `isOnCharacterStateTab`。実DBの状態定義は14キャラ・18定義、cammyはcustom_statesなし。

重なりを確認するための実例（movesテーブルで照合、付与候補の決定ではない）:

| 例・限定した抽出集合 | moves件数/category | 既存state・照合結果 |
|---|---|---|
| ryuの `denjin_charge` 完全一致 | 1 / special | 同codeのflag状態がある。状態と発動するmoveが別々に存在する |
| ryuのcodeに `denjin` を含む全行 | 9 / special 5・super_art 4 | 発動move以外の強化技も含まれる。codeにstate名があることだけで専用技と断定できない |
| juriの `fuha_saihasho` 完全一致 | 1 / special | 既存stateはfuha_stockとfeng_shui_engine。CHANGE-169の設置状態とは同一名でない |
| kimberlyのcodeに `shuriken_bomb` を含む全行 | 6 / special | 既存shuriken_bomb_stockは残弾。CHANGE-169 §2.5はフィールド設置数と別物と明記 |
| blankaのcodeに `blanka_chan` を含む全行 | 3 / special | 既存blanka_chan_bomb状態は残弾。同名moveはあるが、設置済み状態と同じ意味ではない |

上記moveのsetup_onlyは全て0。CHANGE-169には、ヤスミンのmoveはODを1行で持つ一方stateは弱中強を持つという裁定もある。実装・記録上、開始状態の記述と技候補の表示制御は同じ情報ではない。どの具体的なムーブを両方で扱うか、片方のみで扱うかはドメイン判断が残る。

## 4. 画面での扱いの候補

| 面 | 現状のコード・挙動 | 出す/出さないを決める場合の境界 |
|---|---|---|
| コンボの仮想コントローラ8タブ | RecipeBuilder:196からmovesを渡す。isControllerSurfaced:180は7面の論理和でsetupOnlyを見ない。未分類はその否定 | コンボ選択から除外というDES-003の記述はある。8タブのどこまで・既存選択・物理入力との関係は具体化されていない |
| コンボの全技一覧プルダウン | RecipeBuilder:88、useControllerInputOmission:75。既定は全件。ONは分類済み技を省く | setup_onlyと「タブに分類済み」は別軸。isControllerSurfacedをfalseにするだけだと未分類・全技一覧の残る側に入る |
| セットプレイのレシピ入力 | SetupRecipeEditor:85,115,197。同じmoves取得・省略フック・VirtualControllerを使う | 共通部品に除外を入れると両面に影響する。セットプレイ側で出す範囲との区別が必要な判断点 |
| filler提案候補 | collectFillerSingles:439。setup_onlyによる絞り込みなし、trueを含めるテストあり | 表示制御と提案候補制御は独立。true限定/true除外のいずれも現行のテスト期待値と違う |
| target提案候補 | collectTargets:610。setup_only条件なし | fillerとtargetは別述語。どちらにも同じ用途を自動適用する根拠はない |
| 技編集グリッド・GET/PATCH | GETは返す。PATCHに付与項目なし | ユーザー付与/配布時付与のどちらを用意するか未決 |

始動技選択、キーボード/ゲームパッド入力、既存レシピの表示・再編集、取込での解決も、コンボから「隠す」の具体的な範囲を決める際の関連面となる。本列の参照検索では、これらにsetupOnlyの本番分岐は0件。表示を省くことと保存を禁止することは別であり、現行の本列から保存禁止仕様は確認できない。

## 5. 選択肢の一覧（未採択・推奨なし）

いずれもfillerの有用性判定へ転用する案ではない。選択肢は新たな実装承認を意味しない。

| 選択肢 | 付与対象の決め方 | 画面・データ上で決めること |
|---|---|---|
| A: 記録済みのユーザー登録専用moveの行区分として使う | M19-01の「ユーザー登録」を範囲とし、配布moveへは自動付与しない | 登録/付与する経路、コンボ側の候補から隠す面、セットプレイで選択できる面。現状は付与口がない |
| B: 配布済みの技も個別に選んで行区分を付ける | キャミィ9件など具体的なcodeを開発者が選定し、必要なら親行も区別する | M19のユーザー登録という範囲との関係、データ管理元、既存レシピの扱い。列を立てるだけでは現在の表示は変わらない |
| C: 開始状態の表現と技の表示制御を別々に選定する | 始動前の状態はcustom_statesで表し、技の非表示が別途必要と裁定された行だけsetup_onlyを付ける | 状態とmoveの非1対1を前提に対応を決める。状態code一致をフラグへの機械変換規則にしない。Bとの併用もあり得る |

## 6. 決められないこと

| 開発者・設計担当へ返す問い | 未決の理由・必要な知識 |
|---|---|
| どのmove_codeをコンボ候補から省くのか | 0件の現行値から対象を導けない。「コンボではあまり意識しない」と「絶対に使わない」は同じでない |
| ユーザー登録move限定か、配布済みmoveも含めるか | 過去確定事項とM31のデータ整備候補の範囲を合わせる判断が必要 |
| キャミィ9件の親をどう分けるか | 子moveは既存。弱中強OD親は1行。必要な強度別フレーム実測と親子対応はドメイン判断が必要 |
| 非表示の範囲はどこまでか | 全技一覧、8タブ、始動技選択、物理入力、取込、既存レシピ閲覧/再編集では役割が違う |
| 付与は誰がどの経路で行うか | 現行PATCH/CSVに本列の入力がない。ユーザー登録という過去の意図だけでは運用を決められない |
| custom_statesと併用する具体例は何か | 状態の選定基準は既決だが、全moveとの対応・非表示の必要性は未決。残弾と設置済みなど名称だけでは判別できない |
| M19-DESIGN-02の残存案・照会中資料をどう整理するか | 現行DES-003/M19-01と食い違う記述が残存。設計卓の文書整合の手番であり本調査で変更しない |

### 6.1 調査範囲・未確認の限界

- 対象はP4M-005の判断材料。ゲーム実機検証・新データ投入・UI実装・設計変更は0件。
- セットプレイ専用性の全数判定は未確定。実DBの全行集計と、文書が挙げるキャミィ9行・状態比較の限定集合は実測済み。
- 略記 `setplay_only` も検索した。DBに同名列はない。本報告で引用した表記は原文どおり。
- 指示書の「1行も書き換えない」は既存ファイルを対象とし、明示された成果物1ファイルのみ作成。research_planの制約に従いprogress-log追記・Git書き込み・コミットはしない。

## 付録A. 検索の全数記録

検索はsnake_case、camelCase、PascalCaseに加え、綴り揺れと連結形を含む `setup_only|SetupOnly|setupOnly|setplay_only|setuponly`（大文字小文字を無視）を使用。部分一致 `setup.only|setplay.only` も走査した。以下の行番号はレポート作成前の作業ツリーのもの。本レポート自身は母集団から除外。

### 実装・テスト・マイグレーション

| ファイル | ヒット行 |
|---|---|
| `internal/api/move/dto.go` | 25, 53, 79, 99 |
| `internal/api/move/handler_test.go` | 32, 101, 113, 136, 138, 203 |
| `internal/infra/migration/migrate_test.go` | 597, 615, 619, 623, 627, 657 |
| `internal/model/move.go` | 68 |
| `internal/repository/move/edit.go` | 47 |
| `internal/repository/move/queries.go` | 21, 37 |
| `internal/repository/move/repository.go` | 40, 135 |
| `internal/repository/move/rush.go` | 30, 76 |
| `internal/repository/setplay/repository.go` | 28, 70, 96 |
| `internal/service/setplay/refine_test.go` | 21, 104, 105, 112, 114 |
| `internal/service/setplay/service.go` | 434 |
| `internal/service/setplay/service_test.go` | 337, 339, 347, 351, 355, 356 |
| `web/src/features/combo/components/DuplicateRealtimeWarning.test.tsx` | 10 |
| `web/src/features/combo/components/ModifiersEditor.test.tsx` | 14 |
| `web/src/features/combo/components/RecipeBuilder.test.tsx` | 24 |
| `web/src/features/combo/components/SetupInputRow.test.tsx` | 146 |
| `web/src/features/combo/components/VirtualController/VirtualController.test.tsx` | 24 |
| `web/src/features/combo/inputResolution.test.ts` | 25 |
| `web/src/features/combo/inputResolutionStage2.test.ts` | 23 |
| `web/src/features/combo/moveSurfacing.roster.test.ts` | 95 |
| `web/src/features/combo/moveSurfacing.test.ts` | 39 |
| `web/src/features/combo/utils.test.ts` | 454 |
| `web/src/features/gamepad/gamepadRecipeInput.test.tsx` | 163 |
| `web/src/features/gamepad/gamepadShortcut.test.tsx` | 196 |
| `web/src/features/gamepad/recipeInputResolution.test.ts` | 38 |
| `web/src/features/intake/prompt.test.ts` | 13 |
| `web/src/features/keyboard/keyboardRecipeInput.test.tsx` | 173 |
| `web/src/features/moves/MoveEditGrid.test.tsx` | 32 |
| `web/src/features/moves/types.ts` | 38, 91 |
| `web/src/features/physical-input/commandMode.test.tsx` | 241 |
| `web/src/features/physical-input/modalSuppression.test.tsx` | 265 |
| `web/src/features/setup/components/SetupRecipeEditor.test.tsx` | 244, 253 |
| `migrations/000013_add_moves_frame_columns.down.sql` | 2 |
| `migrations/000013_add_moves_frame_columns.up.sql` | 11 |
| `migrations/000029_clear_ryu_legacy_seed.down.sql` | 6 |
| `migrations/000032_add_moves_is_derived.up.sql` | 2 |
| `migrations/000049_add_moves_frame_cost_columns.up.sql` | 11 |

### docs全域（アーカイブを含む）

| ファイル | ヒット行 |
|---|---|
| `docs/change-notes/CHANGE-069-notification.md` | 37 |
| `docs/change-notes/CHANGE-085-notification.md` | 40 |
| `docs/change-notes/CHANGE-093-notification.md` | 63 |
| `docs/change-notes/change-report-085.md` | 27, 70, 81, 91 |
| `docs/change-notes/phase2/CHANGE-022-moves-frame-data-and-csv-contract.md` | 28, 61, 115, 154, 176, 177, 190, 196 |
| `docs/change-notes/phase2/CHANGE-026-fr701-csv-import-scope-corrections.md` | 140 |
| `docs/change-notes/phase2/change-report-022-moves-frame-data-and-csv-contract.md` | 5, 28, 29 |
| `docs/design/02-architecture.md` | 1044 |
| `docs/design/03-data-model.md` | 96, 347 |
| `docs/design/supp-001-detailed-design.md` | 59, 277 |
| `docs/handover/M19-DESIGN-02-suggestion-logic.md` | 59, 93 |
| `docs/handover/M19-DESIGN-04-handoff-to-instruction.md` | 35 |
| `docs/handover/M19-DESIGN-05-startup-moves-frame-model.md` | 102 |
| `docs/handover/M19-DESIGN-07-frame-cost-model.md` | 197 |
| `docs/handover/SF6セットプレイ-ドメイン知識集成.md` | 9, 122, 158 |
| `docs/handover/archive/change-number-registry-M20.md` | 79 |
| `docs/handover/change-number-registry.md` | 64, 127, 261 |
| `docs/handover/code-facts.md` | 522, 524, 638, 669, 681, 965 |
| `docs/handover/design-instruction-playbook.md` | 911, 916, 917 |
| `docs/handover/design-reports/20260908-m31-01-design-exceptions.md` | 165, 190 |
| `docs/handover/followup-backlog.md` | 250, 1191, 1213, 1632 |
| `docs/handover/phase2/m8-to-m9-handover.md` | 39 |
| `docs/handover/phase2/phase2-kickoff-design-session-handover.md` | 30, 86, 121, 131 |
| `docs/handover/retrospective-log.md` | 687, 691 |
| `docs/human-notes/milestone-startup-kit/m9-fr701-importer-startup-kit.md` | 163 |
| `docs/human-notes/milestone-startup-kit/m9-startup-kit.md` | 64 |
| `docs/human-notes/milestone-startup-kit/phase2-continuation-startup-kit.md` | 48, 70, 217 |
| `docs/human-notes/model-allocation.md` | 211 |
| `docs/instructions/M14-RESEARCH-01-distribution-fix-schema-cleanup-survey.md` | 77 |
| `docs/instructions/M14-overview.md` | 55 |
| `docs/instructions/M19-01-setplay-suggestion-engine-and-ui.md` | 24, 25, 27, 261, 262, 263, 363, 435, 500 |
| `docs/instructions/M19-02-suggestion-refinement.md` | 52, 183, 357, 410, 428 |
| `docs/instructions/M19-overview.md` | 119, 209, 244 |
| `docs/instructions/M31-RESEARCH-01-setup-only-flag.md` | 1, 17, 33, 37, 45, 71, 72, 79, 81, 91, 99, 100, 111, 138, 156 |
| `docs/instructions/M31-overview.md` | 6 |
| `docs/instructions/phase2/M8-01-moves-frame-columns-migration.md` | 21, 37, 139, 176, 186, 190, 203, 230 |
| `docs/instructions/phase2/M9-02-instruction.md` | 145, 152 |
| `docs/instructions/phase2/M9-overview.md` | 57 |
| `docs/instructions/phase2/phase2-overview.md` | 58 |
| `docs/instructions/phase2/phase2-tool-delegation-brief-fr701-importer.md` | 124 |
| `docs/instructions/phase2/reviews/M8-01-review-checklist.md` | 60, 78 |
| `docs/instructions/reviews/M19-01-review-checklist.md` | 20, 21, 23, 62, 107, 152, 166 |
| `docs/instructions/reviews/M19-02-review-checklist.md` | 55, 125, 189 |
| `docs/process/archive/parallel-board-rulings-M20.md` | 42, 92 |
| `docs/process/parallel-board.md` | 555, 562, 619, 687, 1014, 1200, 1518 |
| `docs/progress/20260802-whiff-discriminator-search-report.md` | 163, 175, 186, 188, 202, 234, 237, 280, 448, 449, 456, 458, 484, 571, 576, 615, 661, 663, 665 |
| `docs/progress/20260906-squash-research/01-migration-details.md` | 569, 582, 589, 1753, 2011, 2996 |
| `docs/progress/M14-RESEARCH-01-report.md` | 53, 66, 70, 348 |
| `docs/progress/M14-RESEARCH-03-report.md` | 430, 1254 |
| `docs/progress/M19-01-report.md` | 74 |
| `docs/progress/M19-02-report.md` | 73, 143 |
| `docs/progress/M19-RESEARCH-01-report.md` | 99, 176, 178, 179 |
| `docs/progress/M19-RESEARCH-02-report.md` | 112 |
| `docs/progress/M19-RESEARCH-04-report.md` | 279 |
| `docs/progress/M19-audit-20260725.md` | 105, 131, 137, 241, 294, 325, 360 |
| `docs/progress/M24-RESEARCH-01-report.md` | 318 |
| `docs/progress/M28-04-completion-report.md` | 105 |
| `docs/progress/M31-01-completion-report.md` | 269, 276, 278, 287, 289, 560, 601, 603, 605, 606 |
| `docs/progress/m19-02-review.md` | 19 |
| `docs/progress/m31-01-review.md` | 67, 293 |
| `docs/progress/phase2/m8-01-review.md` | 32, 55, 62, 91 |
| `docs/progress/phase3/M18-02-RESEARCH-01-report.md` | 128 |
| `docs/progress/phase3/M18-RESEARCH-01-report.md` | 163 |
| `docs/progress/phase3/m17-02-review.md` | 33 |
| `docs/progress/progress-log.md` | 2677, 2685, 2709, 5647, 5649 |
| `docs/progress/progress-summary.md` | 160, 164 |

### 0件の領域

`cmd/`、`scripts/`、`character_data/`、`internal/seedgen/`、`web/src/types/`、`web/src/lib/`（i18nを含む）、`web/e2e/` は上記シンボル0件。フロントの型はweb/src/typesではなくfeatures/moves/types.tsに存在する。internal/service本番コードでSetupOnlyの値使用は0件（setplay/service.goのコメントは存在）。フロント本番コードは型2箇所以外0件。

### DB測定クエリ

接続先は冒頭のローカルDB。読み取り専用接続で以下のSELECTを実施した。

```sql
SELECT * FROM schema_migrations;
SELECT count(*), count(distinct character_id), sum(setup_only=1) FROM moves;
SELECT category, count(*), sum(setup_only=1) FROM moves GROUP BY category;
SELECT m.code, m.category, m.setup_only, m.startup, m.total,
       (SELECT count(*) FROM move_derivations d WHERE d.child_move_id=m.id) AS parents
FROM moves m JOIN characters c ON c.id=m.character_id
WHERE c.code='cammy' AND (
  m.code GLOB 'cannon_strike_*_od_hooligan_combination_od' OR
  m.code GLOB 'fatal_leg_twister_*_od_hooligan_combination' OR
  m.code GLOB 'silent_step_*_od_hooligan_combination_od')
ORDER BY m.code;
SELECT code, custom_states FROM characters WHERE custom_states IS NOT NULL;
```

状態比較例は同じDBのmovesに対し、§3.3表に示したキャラと完全一致/部分一致の条件でSELECTした。状態定義数はcharacters.custom_statesの各JSONのstates配列長を合計した。

### 成果物の検査

`bash scripts/check-md-emphasis.sh docs/progress/M31-RESEARCH-01-report.md` は検出0行。本文の相対リンクは全件存在を確認。`git status --short` で本レポート1ファイルのみ未追跡であることを確認した。
