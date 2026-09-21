# M37-RESEARCH-01 調査報告

記録日: 2026-09-13 ／ 担当: Codex ／ 自動モード（開発者承認済み）。
対象: `A`・`B05`・`B06`・`B11`。実装・データ是正・要否の仕分けは行っていない。

調査結果の要約:

- `A`: フロントのマス数フィールド参照は8行（型6・スキーマ2）。入力・表示部品への参照は0行。7区分の既存入力はある。API・CSV・DBは0〜160の整数を受ける。
- `B05`: 定義は flags 10値、type 2値、自由メモ notes。編集のバッジとサーバ生成レシピで表示が異なる。実DBのレシピ文字列にも `{od_lm}` 等が残る。
- `B06`: 「初段の発生値を使っていない」は名指しの行で確認できた。2発止め=5F、初段の立ち中P=6F。5Fがゲーム上の第2段発生そのものかは未確認。同形の広い母集団は109行、うち地上候補の静的条件を満たすのは105行であり、誤データ105件という意味ではない。
- `B11`: 指示書が挙げた3区画は現存し、さらにショートカット・コマンド技入力の2区画がある。告知3文は逐語一致。維持に関わるテストの直接参照とヘルパ経由参照を付録に列挙した。

## 1. 版ゲートの結果

| 項目 | 結果 |
|---|---|
| 指示書 | `docs/instructions/M37-RESEARCH-01-request-batch-survey.md` v1.0.0 |
| main上のoverview | `git show main:docs/instructions/M37-overview.md` 成功、v1.1.0。要求された存在条件を満たす |
| HEAD | `55761264`。以下のログを採取。これは観測HEADと直近履歴であり、ブランチ作成時の分岐点を別途断定するものではない |
| 既存成果物検索 | `rg --files docs/progress -g '*.md'` に識別子の境界付き正規表現を適用、0件 |
| 開始時 | `git status --short` 出力なし |
| 実DB | `/home/node/.local/share/tacpendium/tacpendium.db`。`config.toml` のDB pathは空、Linux既定パスを `internal/infra/db/db.go` で確認。schema_migrations=(112, dirty=0)、moves=3026、31キャラ |
| DBアクセス | Python sqlite3、URI `mode=ro` と `PRAGMA query_only=ON`。SELECTのみ。アプリ起動・マイグレーション・DB変更なし |
| CSV母集団 | `character_data/*.csv` 31ファイル、2743データ行。追加生成moveを含むDB総数とは母数が異なる |
| 地図 | `code-facts.md`（2026-09-12、d13f65f）を起点に、DTO・Props・SQL・実DBで裏取り。再生成なし |

```text
55761264 Merge pull request #210 from plexiblinp/claude/adoring-thompson-hl2142
4c9ac996 docs: M37-RESEARCH-01 を発行し、M36/M37 の確認事項 6 件を決着させる（D-855）
4d99cb4e docs: M37 を起票し、M33-01 のチェックリストを発行する（D-854）
73746a75 docs: リリース前要望の束を受理し M36 を起票する（D-853・M-170）
e8c9baa7 Merge pull request #209 from plexiblinp/claude/optimistic-bell-j9uzl0
```

参照した設計・裁定: M37-overview §1/§4、DES-003の位置2列・startup_basis・move_derivations、DES-004 §2.1/§2.3、DES-005 §5.7/§5.20/§6.1/§6.4.3/§6.7、DES-006 VAL-C16、ボード D-730/D-731/M-137/D-853。D-730の境界91〜111はD-731で91〜112へ更新されている。

## 2. A の配線状況

### 2.1 全参照

式: `rg -n 'startPositionMass|carryDistanceMass' web/src` → 8行、2ファイル、各フィールド4行。各行の用途は以下。

| ファイル | 行 | フィールド | 用途 |
|---|---:|---|---|
| web/src/features/combo/types.ts | 91 | startPositionMass | ComboSummary 型 |
| web/src/features/combo/types.ts | 93 | carryDistanceMass | ComboSummary 型 |
| web/src/features/combo/types.ts | 232 | startPositionMass | Combo 型 |
| web/src/features/combo/types.ts | 234 | carryDistanceMass | Combo 型 |
| web/src/features/combo/types.ts | 286 | startPositionMass | CreateComboRequest 型 |
| web/src/features/combo/types.ts | 288 | carryDistanceMass | CreateComboRequest 型 |
| web/src/features/combo/schema.ts | 51 | startPositionMass | z.number().int().min(0).max(160).nullable().optional() |
| web/src/features/combo/schema.ts | 52 | carryDistanceMass | 同上 |

ComboDetailはComboSummaryを継承する。型が存在することとフォームが値を送ることは別である。

### 2.2 入力・表示への否定確認

式: `rg -n 'start_position_mass|carry_distance_mass|startPositionMass|carryDistanceMass|StartPositionMass|CarryDistanceMass' web/src web/e2e` → 同じ8行。`*.tsx`・i18n JSON・E2Eの該当は各0行。

部分名・変換関数の式: `rg -n 'positionFromMass|representativeMassOf|massToPercent|percentToMass|POSITION_BANDS|MAX_POSITION_MASS' web/src` → 47行（constants/position.ts 13、同test 34）。部品・ページへの該当0行。両探索から、名前付きの2フィールドと変換関数が画面に配線されていないことを確認した。

### 2.3 既存の7区分入力

式: `rg -n 'POSITION_OPTIONS|POSITION_VALUES|constants/position' web/src/features/combo/labels.ts web/src/features/combo/components/ComboEditorBasicFields.tsx web/src/constants/combo-list.ts`。入力本体は `ComboEditorBasicFields.tsx:445` の `options={withUnspecifiedFirst(POSITION_OPTIONS)}` 1か所。7区分+不問の8選択肢で、送る値は従来のposition。

`constants/position.ts` の区分表は7行相当、境界は0–25/26–47/48–69/70–90/91–112/113–134/135–160、代表値12/36/58/80/102/124/148。表示順は `constants/combo-list.ts` のPOSITION_VALUES、ラベルは `labels.ts:46` の7値。変換関数は存在するが、区分入力部品はそれを呼ばない。

### 2.4 API・CSV受け口

式: `rg -n 'StartPositionMass|CarryDistanceMass|start_position_mass|carry_distance_mass' internal/api/combo internal/service/combo internal/service/comboio migrations/000105*`。受け口は2フィールド、DB列2本、CSV列2本（検索行の一覧は付録A）。

| 経路 | 実物と形 |
|---|---|
| API | dto.go:39/41、260/262の `*int`、JSON camelCase、未指定/null可。toInput・toResponseで両方を転送。小数を格納する型ではない |
| 正規化 | service/combo/service.go:342/799でCreate・UpdateWithKeyChangeの入口から `normalizePositionAndMass` を呼ぶ。マス優先でpositionを導出、マスなしならposition代表値を補完。carryは触らない |
| CSV | csvcore/contract.go:52/53のsnake_case列、validate.go:70/72で整数解析・0〜160 ERROR、空セル=nil。import.go:402/403でAPIと共通のCreateInputへ渡す。export.go:202/203、csvexport.go:115/116で整数文字列へ戻す |
| DB | 000105:29–36、INTEGER nullableと `BETWEEN 0 AND 160` CHECKが各1本。position旧値からstartだけをバックフィル |

0〜160という値域・整数マスという単位はD-730/D-731と一致する。パーセントの保存列・CSV列は上記2値にはない。運び量を区分へ丸める処理は正規化関数にない。

### 2.5 既存バリデーション

式: `rg -n 'validatePositionMassRange|CodePositionMassRange|VAL-C16' internal/service/validation docs/design/06-validation.md`。対象値2個、範囲検証関数1本、API/CSVが返す記述的コード1種 `VAL-RANGE`。

DES-006はVAL-C16（ERROR、null許容）。実装validation/combo.go:29/158/275はVAL-RANGEを返す。CSVもVAL-RANGE/ERROR、フロントzodにもint/min/maxがある。DBはCHECK2本。マス↔%変換は `massToPercent` と `percentToMass` の2関数（後者は四捨五入し0〜160にクランプ）だが入力UIは0件。position未知コードはnormalize関数がそのまま通す既存挙動であり、7区分の検証を新設済みとは数えない。

## 3. B05 modifier の実査

### 3.1 定義と全数

式: `rg -n 'type Modifiers|interface Modifiers|MODIFIER_FLAGS_COMMON|MODIFIER_OD_VARIANT_FLAGS|MODIFIER_NON_MOVE_TYPES|ModifierType' internal/model internal/service/comboio/csvcore web/src/features/combo`。

モデル `internal/model/combo.go:127` は3フィールド（Flags []string / Type string / Notes string）、TS types.ts:199とCSV内部DTOにも対応。DBはcombo_steps.modifiers/setup_steps.modifiersのJSON TEXTであり、flag専用列・flagマスタ表ではない。UI定義はlabels.ts:192以降のflags=7+3=10、type=2。任意の文字列を収容できるデータ型なので、この12値を「DBに入り得る文字列の全数」とは呼ばない。

### 3.2 各値の意味・表示・使用数

式: §7のsqlite3集計。各flagは同一ステップ内の重複を除き「その値を持つステップ数」で数える。実DB全行（論理削除親も含む）の母数はcombo_steps=710、setup_steps=131。seedだけの件数ではない。JSON不正は両表0件。

| 種類/値 | 意味・編集表示 | サーバ生成レシピの付加文字列 | combo | setup |
|---|---|---|---:|---:|
| flag just | ジャスト | `{ジャスト}` | 1 | 0 |
| flag delay | ディレイ | `{ディレイ}` | 1 | 0 |
| flag link | 目押し | `{目押し}` | 0 | 0 |
| flag low_jump | 低ジャンプ | `{最低空}` | 0 | 0 |
| flag first_hit_cancel | 一段目キャンセル | `{first_hit_cancel}` | 1 | 1 |
| flag neutral_jump | 垂直ジャンプ中 | `{neutral_jump}` | 1 | 0 |
| flag forward_jump | 前ジャンプ中 | `{forward_jump}` | 1 | 0 |
| flag od_lm | OD(弱中) | `{od_lm}` | 2 | 0 |
| flag od_mh | OD(中強) | `{od_mh}` | 1 | 0 |
| flag od_lh | OD(弱強) | `{od_lh}` | 0 | 0 |
| type parry_drive_rush | パリィドライブラッシュ | `生ラッシュ` | 5 | 0 |
| type cancel_drive_rush | キャンセルドライブラッシュ | `キャンセルラッシュ` | 0 | 0 |
| notes | メモ（50文字以内目安） | ` (メモ本文)` | 0 | 0 |

現存親 `deleted_at IS NULL` に限ると、flag od_lmのcombo件数だけ2→1、その他のflag件数は上表と同じ。未定義flag/typeはこの実DBでは0種。dashは過去の移行・コメントに残るが、現UI選択肢にも実DB typeにも0件。

### 3.3 画面の所在と現在の見え方

全10flagは共通部品経由で以下の画面群に出る。OD3値は必殺技ODでのみ新規付与可、既存の非適用値は消せるよう表示される。未使用4値（link/low_jump/od_lh/cancel_drive_rush）も入力選択肢には存在する。「DB件数0」を「画面に出ていない」とは数えない。

| DES-005 | 実コード | 表示 |
|---|---|---|
| §5.7/§5.9、§5.7同梱セットプレイ | RecipeBuilder / SetupRecipeEditor → ModifiersEditor、StepRow → ModifiersSummary | flagsは日本語バッジ。notesは `※` + title。typeのみならバッジは出ず主ラベルで表す。ModifiersEditorのtype-onlyタイトルは内部typeを返す分岐がある |
| §5.4/§5.5 | ComboTableRow → RecipeText | サーバ生成文字列を表示。全文/省略のどちらでも修飾の波括弧を書き換えない |
| §5.6 | ComboDetailRecipe / SetupAccordionItem / SetupCandidateList → RecipeText | 同上 |
| §5.8 | CompareTable / AddComboToCompareModal → RecipeText | 同上 |
| §5.7 | SetupTreeRow / SetupRegistrationSection / SetupSelectorModal → RecipeText | 既存セットプレイ文字列を表示 |
| §5.15 | TrashComboDetailPage:188 | defaultRecipeを直接表示 |
| §5.20/§5.21 | PunishTree:252/606、PunishList:216 | combo.recipe / rc.recipeを直接表示 |
| §5.7/§5.9の未保存サマリ | utils.ts:141 formatRecipeLine、RecipeBuilder / SetupInputRow、SetupRecipeEditorのステップ表示 | 技名とtypeラベルを組む。formatRecipeLineにはflags/notesの描画なし。個別ステップのバッジとは別経路 |

文字列生成元は `internal/service/notation/resolver.go:21` のflagTextとapplyFlags。日本語変換4値、残り6値は `{` + flag + `}` のフォールバック。flags全10値を囲むので、バッジを変えるだけではこの文字列経路は変わらない。

実DBのrecipe_cacheをJSONとしてデコードしてから値中の波括弧を検索すると、combos 2行・setups 1行。実例（先頭プリセットの文字列）:

```text
combo 8: 立ち弱P > 弱波動拳 > OD波動拳 > OD波動拳 {od_lm}
combo 78: 立ち弱P > 立ち弱K {first_hit_cancel} {od_mh} > 立ち中K > 立ち中P {forward_jump} {neutral_jump} > 立ち強P {ジャスト} {ディレイ}
setup 16: 立ち弱P > 立ち中P > 立ち強P {first_hit_cancel}
```

これはコードと保存文字列の実査であり、ブラウザ全画面の撮影結果ではない。JSON本体の `{` を検索した109件はJSONオブジェクトの構文も数えるため、表示件数には採用していない。

### 3.4 設計に言及があるが実装に無いもの

式: DES-004 §2.3の具体的flag10値/type2値とlabels.tsの集合差 → 0値。DES-005 §6.7は「微歩き等」を修飾情報の例として記すが、現行modifierにmicro_walkは0値。DES-004 §2.1はmicro_walk案を不採用とし、独立move `micro_forward` / `micro_back` を定める。これは資料間の表現差の事実であり、flag追加の提案ではない。

high_jumpはDES-004が「過去の幽霊仕様を撤去、キャラ固有unique move」と明記するため不足へ数えない。「その他: 言語化が難しい技の当て方」は具体的コード未指定なので集合差の1値にはしない。low_jumpの短縮正表記「低ジャンプ」とサーバ文字列「最低空」も異なる。

## 4. B06 の仮説検証

仮説のうち「候補が初段の発生を使っていない」は確認できたが、「5Fがその段の正しいゲーム値」までは本データから確定できない。同形109行（うち地上候補の静的条件105行）。

### 4.1 名指しの実データ

式: `rg -n '不破三連撃|standing_medium_punch' character_data/ryu.csv` と §7のDB SELECT。CSV・DBでstartup/category/startup_basis/is_derivedを照合した。

| ryu code | CSV行 | startup（CSV=DB） | category | basis | derived |
|---|---:|---:|---|---|---:|
| standing_medium_punch | 4 | 6 | normal | standalone | 0 |
| fuwa_triple_strike_2hits | 30 | 5 | target_combo | standalone | 1 |
| fuwa_triple_strike | 31 | 17 | target_combo | standalone | 1 |

CSV commandは2発止め `p_m chain k_l`、全段 `p_m chain k_l chain k_h`。地上初段立ち中Pの6Fに対し、2発止めは5F・全段は17Fであり、同じ初段値で揃えていない。両fuwa行のmove_derivations親参照は0件。

### 4.2 候補抽出の実装

式: `rg -n 'Startup|startup|Category|category|StartupBasis|startup_basis|IsDerived|is_derived' internal/repository/punish internal/service/punishfinder`（テストを除いたSQL/struct/サービスを実読）。

`repository/punish/queries.go:10` はstartup/categoryを投影する。ScanMoveにはStartup/CategoryがあるがStartupBasis/IsDerivedはない。`service/punishfinder/service.go:350` のbuildStartersは damage>0 を共通条件にする。地上は非空中かつstartup非NULLかつstartup<=有利、ダッシュはさらにdash.totalを引いたslack、ジャンプはis_aerial/category=normal/code/ジャンプ全体を使う。

従って地上で有利5Fなら、fuwa_2hitsの数値条件は `5 <= 5` で成立する一方、standing_medium_punchは `6 <= 5` で不成立。starterNodeはsm.Startupをそのまま応答へ転送する。これは既存コードの条件評価であり、距離成立やゲーム内での発動成功を実測したものではない。

startup_basis/is_derived/親関係を判定するコードはこの走査経路に0件。`isSoloUnavailable` はsetplayサービスの述語でありpunishfinderは呼ばない。相手技側の除外条件と自分の始動候補側の条件も混同しない。

### 4.3 同じ形の件数

式: §7のSQL・CSV DictReader集計。全126行の個別根拠は付録B。

| 集合（誤り判定ではない） | CSV | DB |
|---|---:|---:|
| category=target_combo | 126 | 126 |
| そのうち is_derived=true/1 | 117 | 117 |
| そのうち非derived | 9 | 9 |
| target_combo AND basis=standalone | 118 | 118 |
| target_combo AND basis=through | 4 | 4 |
| target_combo AND basis=unknown | 4 | 4 |
| target_combo AND derived AND standalone（fuwaと同じ属性） | 109 | 109 |
| 上記109のstartupあり | 106 | 106 |
| 上記109かつstartupあり・非空中・damage>0 | 105 | 105 |
| 全target_comboでstartupあり | 120 | 120 |
| 全target_comboでstartupあり・非空中・damage>0 | 119 | 119 |

126行のCSVとDBのstartup/basis/derivedは差分0件。109の各startupが「何段目の値か」は専用列がなく未確定。これらの件数をそのまま修正件数に転記できない。非derived9行やthrough4行は109の外にあるが、現在の候補判定の母集団には含まれる。

### 4.4 basisと親関係

式: move_derivationsをtarget_comboへJOIN → 親辺5本、子5行。4行はjamieの乱酔旋（through）、残る1行はdee_jay/funky_dance（standalone、親jus_cool）。fuwaの親辺は0本。setplayの「standalone/unknownかつ親あり」除外を仮に参照しても、親0件のfuwaはその述語を満たさない。現状punishfinderは親を読まない。

### 4.5 是正の選択肢に関する構造上の事実

| 変更点になり得る場所 | 現在の構造から分かること |
|---|---|
| データstartup | CSVとDBに既存列がある。値を変更すると現行punishfinderは変更後の値を読む。同列は他の機能も読む共通データである |
| 候補判定 | buildStartersが一元的に始動候補を組む。categoryは既に渡るが、basis/derived/親を使う場合は現投影に情報が足りない |
| 初段へ対応付け | CSVにcommand列、DBに親関係表がある。ただしfuwaの親辺は0件で、DB movesにcommand列もない。全126行へ機械的に初段を引ける対応表はこの実査で得られていない |

どの列をどう直すか、除外するか、ゲーム上の正しい値を何とするかは決めていない。

## 5. B11 の情報量

### 5.1 区画ごとの逐語と計算元

式: `rg -n 'data-testid="recipe-gamepad-readout|font-medium text-gray-700' web/src/features/gamepad/components/GamepadRecipeReadout.tsx`。トップレベル区画は5個、当初3区画は残存。

| 表示順 | 見出し・表示内容（逐語） | 算出元・他の所在 |
|---|---|---|
| 1 | `押している入力`、テンキー方向 + ` ＋ ` + ボタン名。非受け手時 `（この面は受付中ではありません）` | numpadFromDirection(held.direction)、logicalButtonLabel。同じheldは仮想ボタンの点灯にも使う。保存レシピには生入力を保存しない |
| 2 | `確定したステップ`、空は `まだありません`、非空は技名/nameJa→code→fallback | resolvedEntriesのresolvedだけ。最新が先、最大5件。入力済みステップ一覧にも技は出るが、読取欄は独立履歴であり全レシピではない |
| 3 | `ショートカット`、`前置き中 — 続けて …` / `前置きボタンを押すと …` / `未登録（コントローラ設定で「ショートカット前置き」を登録すると使えます）`、直前操作結果 | shortcut.active/availableとlastAction。操作名+結果4種、成功した修飾は `修飾の編集を開きました`。ステップ一覧には操作失敗理由はない |
| 4 | `コマンド技入力`、`このキャラクターのコマンド表を取得できていないため使えません` / `入力中 —` +方向列+ `＋ 攻撃ボタンで確定` / 操作名+ `の操作で切り替えます` | commandModeとcommandModeAvailable。空方向は `（方向を入力してください）`。履歴は方向・攻撃ボタン・解決した技名または理由。方向なしは `（方向なし）`。最大5件 |
| 5 | `解決できなかった入力`、空は `ありません`、非空は方向+ボタン+ `—` +理由 | unresolvedEntries。resolvedとは別の最大5件。入力ステップへは追加しないため、保存レシピから同じ失敗情報は取れない |

未解決理由は6値（以下はソースの文字列そのまま）:

1. `同じ種類のボタン 2 つ（OD）は、物理コントローラからは入れられません。必殺技タブから選んでください`
2. `強度の違うボタンの同時押しは技を特定できません`
3. `3 つ以上の同時押しは技を特定できません`
4. `この組み合わせに対応する操作がありません`
5. `このキャラクターに該当する技がありません`
6. `ラッシュ版は空中では出せません`

コマンド入力理由は4値:

1. `同じコマンドの技が複数あるため 1 つに決められません（必殺技タブから選んでください）`
2. `この方向の並びに一致するコマンドがありません`
3. `モードを抜けたため確定していません`
4. `コマンドは判別できましたが、このキャラクターに該当する技がありません`

`usePhysicalRecipeInput.ts:75/296/340/345` に区画ごと独立の上限5件。呼出元はVirtualController:254の1か所で、コンボ・セットプレイ両方へ共有される。描画条件は `gamepad.inputActive`。現式は `available && (connected || keyboard.registered)` であり、Gamepad接続だけではない（VirtualController近傍コメントのconnectedだけという説明は現在の式より狭い）。DES-005 §5.7/§5.9/§6.4.3に対応。

### 5.2 B10の3文

式: `GAMEPAD_INPUT_NOTICE_POINTS` の文字列配列とoverview §1.3のフェンスを比較 → 3文とも一致、差分0文。

```text
素早く入力すると、別々のつもりの入力が 1 ステップにまとまることがあります。
ゆっくり正確に入力してください。
これは不具合ではなく、入力を取りこぼさないための意図的な設定です。
```

定義はGamepadInputNotice.tsx:17、描画は同:23。VirtualController:253が上記inputActiveのときに呼ぶ。定数を別面へ複製せず、同一部品を共有する。

### 5.3 維持を要求するコメント・テストの全数

数え方: 直接test-id/定数参照はテスト7ファイル31行。`actionText` / `shortcutText` / `commandPane` のヘルパと呼出しは4ファイル43行（直接参照31行とは別の集合）。行数をテストケース数と取り違えない。完全一覧と再現式は付録C。

3文・旧3区画に直接関係する床は以下。追加2区画の床も付録で取りこぼさず残した。

| ファイル | テスト開始行 | 主張 |
|---|---|---|
| gamepadRecipeInput.test.tsx | 304,317 | 失敗入力の理由とボタンを表示 |
| 同 | 327,337 | 成功表示、後続成功で失敗履歴が押し出されない |
| 同 | 407 | 点灯は消えても確定表示は残る |
| 同 | 477,490 | 未接続非表示/接続時表示 |
| 同 | 500 | 告知定数が3件・全項目が非空・「不具合ではなく」を含む |
| 同 | 515 | 判定窓数値・ミリ秒/msを文面へ出さない |
| 同 | 528,569 | 2面の読取欄を受け手切替の対象に使用、告知が2面で同文 |
| VirtualController.test.tsx | 529 | providerなしなら告知・読取欄なし |
| gamepadShortcut.test.tsx | 358,577 | 前置き単体を失敗入力に出さない、読取欄を介した受け手切替 |
| keyboardRecipeInput.test.tsx | 476 | 削除キーを失敗入力に出さない |

コメントの直接の維持要求はGamepadInputNotice:1–15（必須・2面共有・3点目を落とさない・時間を書かない・常設）、GamepadRecipeReadout:1–11（現在5区画・失敗を黙って捨てない）、同:85/258（独立上限・失敗表示）、usePhysicalRecipeInput:69–75/168/281/344（独立バッファ・失敗保持）、VirtualController:244付近（両面へ同じ告知・読取欄）。コメントの該当行も付録Cに保存。

テストは今回実行せず、既存コードの主張を調査した。read-only範囲であり、床を削除・変更していない。

### 5.4 縦寸法の概算材料

式: ControllerButton / HitBoxLayout / SpecialMovePanel / GamepadInputNotice / GamepadRecipeReadout のclassNameと行生成を読む。以下はDOM/CSSからの概算であり、実機px測定ではない。

| 区画 | 縦を占める構造 |
|---|---|
| 見出し・状態 | flex-wrap。幅不足なら折返しで増える |
| 告知 | 3項目、text-xs・leading-relaxed、上下py-1.5。各文は横幅により複数行になる |
| 読取 | 5見出し、space-y-1.5、p-2。成功/失敗/コマンド履歴が各最大5行=最大15エントリを追加し、長い理由はさらに折り返す |
| タブ | 8枚、h-auto flex-wrap。1行固定ではない |
| 通常技 | HitBoxLayout:111、sm以上は方向3行と攻撃2行+ラッシュ行を横並び。sm未満は縦積み |
| 必殺技 | SpecialMovePanel:117、ファミリー3列=ceil(件数/3)行。変種/強度/OD展開群をその下に縦積み。局所スクロール用の高さ上限・overflow-y指定は同ファイル0件 |
| ボタン | ControllerButton:59、moveサイズはmin-h 3.25rem、上下py-2。family数による複数行がこの最低高を繰り返す |

「縦スクロールなしで全入力できる」かの受入判定は行っていない。B14の実機判定はoverview D-855の開発者手番である。

## 6. 分からなかったこと

1. 109行の各startupが厳密にどの段のゲーム内発生を表すか。データ属性と値は数えられるが、全行の正しいゲーム値・変更すべき値は確定していない。fuwaの5Fも第2段ゲーム値としての外部検証はしていない。
2. 全TCの初段対応。commandは状態/空中で同じ文字列を持ち得る。単純な先頭command完全一致では、126行中64行が候補発生と不一致・3行一致・59行は複数発生/未入力等で判定不能だった。この補助探索を誤り件数には使っていない。
3. 各modifierの「必要/不要」や情報欄の「無いと困る/あると良い」。要否は調査対象外の判断。0件は現在のローカルDBでの利用数に限る。
4. ブラウザの全画面実描画と厳密な縦px。今回は静的描画経路・CSS・実DB文字列まで。画面サイズ・入力状態による実機結果は未採取。

想定外の事実: 3区画ではなく5区画、low_jumpの表示語差、DES-005 §6.7の微歩きの例とDES-004の独立move規定、JSON構文の波括弧による検索偽陽性、CSVにはあるcommandがDB movesにはないこと。実装方針は選んでいない。

## 7. 使った式と追試

作業ディレクトリはリポジトリルート。`rg -n` はヒット行数、`-o` は出現回数なので混同しない。付録A/Cは以下の式の各ヒットをそのまま採取。存在しない推定ファイル名への探索失敗は0件証明に使わず、`rg --files` で実ファイルへ解決して読み直した。

```bash
git log --oneline -5
git show main:docs/instructions/M37-overview.md
rg --files docs/progress -g '*.md' | rg -i '(^|[-/])M37-RESEARCH-01(-|\.)'
rg -n 'startPositionMass|carryDistanceMass' web/src
rg -n 'start_position_mass|carry_distance_mass|startPositionMass|carryDistanceMass|StartPositionMass|CarryDistanceMass' web/src web/e2e
rg -n 'positionFromMass|representativeMassOf|massToPercent|percentToMass|POSITION_BANDS|MAX_POSITION_MASS' web/src
rg -n 'POSITION_OPTIONS|POSITION_VALUES|constants/position' web/src/features/combo/labels.ts web/src/features/combo/components/ComboEditorBasicFields.tsx web/src/constants/combo-list.ts
rg -n 'type Modifiers|interface Modifiers|MODIFIER_FLAGS_COMMON|MODIFIER_OD_VARIANT_FLAGS|MODIFIER_NON_MOVE_TYPES|ModifierType' internal/model internal/service/comboio/csvcore web/src/features/combo
rg -n '不破三連撃|standing_medium_punch' character_data/ryu.csv
rg -n 'startup_basis|StartupBasis|is_derived|IsDerived|isSoloUnavailable' internal/repository/punish internal/service/punishfinder -g '!*test*'
rg -n '<RecipeText|ModifiersSummary|formatRecipeLine' web/src -g '!*.test.*'
rg -n 'overflow-y-|max-h-(\[|[0-9])' web/src/features/combo/components/VirtualController/SpecialMovePanel.tsx
```

DB計数を再現する読み取り専用スクリプト（後日のDB変更で件数は変わり得る）:

```python
import sqlite3, csv, json, collections, re
from pathlib import Path
c = sqlite3.connect('file:/home/node/.local/share/tacpendium/tacpendium.db?mode=ro', uri=True)
c.execute('PRAGMA query_only=ON')
c.execute('BEGIN')
print(c.execute('SELECT * FROM schema_migrations').fetchall())
print(c.execute("SELECT startup_basis,is_derived,count(*),sum(startup IS NOT NULL),sum(startup IS NOT NULL AND is_aerial=0 AND damage>0) FROM moves WHERE category='target_combo' GROUP BY 1,2").fetchall())
print(c.execute("SELECT code,startup,category,startup_basis,is_derived FROM moves WHERE character_id=(SELECT id FROM characters WHERE code='ryu') AND (code LIKE '%fuwa%' OR code='standing_medium_punch')").fetchall())
print(c.execute("SELECT m.code,m.startup_basis,p.code FROM move_derivations d JOIN moves m ON m.id=d.child_move_id JOIN moves p ON p.id=d.parent_move_id WHERE m.category='target_combo'").fetchall())
for table in ['combo_steps','setup_steps']:
    flags, types = collections.Counter(), collections.Counter()
    notes = 0
    rows = c.execute('SELECT modifiers FROM '+table).fetchall()
    for (v,) in rows:
        m = json.loads(v) if v else None
        if not isinstance(m,dict): continue
        flags.update(set(m.get('flags') or []))
        if m.get('type'): types.update([m['type']])
        notes += bool(m.get('notes'))
    print(table,len(rows),flags,types,notes)
for table in ['combos','setups']:
    hits = []
    for i,cache in c.execute('SELECT id,recipe_cache FROM '+table+' WHERE recipe_cache IS NOT NULL'):
        values = [v for v in json.loads(cache).values() if re.search(r'\{[^{}]+\}',v)]
        if values: hits.append((i,values[0]))
    print(table,len(hits),hits)
rows = [dict(r,source=str(p),line=i) for p in sorted(Path('character_data').glob('*.csv')) for i,r in enumerate(csv.DictReader(p.open()),2)]
tc = [r for r in rows if r['category']=='target_combo']
print(len(rows),len(tc),collections.Counter(r['startup_basis'] for r in tc))
db = {(ch,code):(s,b,d) for ch,code,s,b,d in c.execute('SELECT c.code,m.code,m.startup,m.startup_basis,m.is_derived FROM moves m JOIN characters c ON c.id=m.character_id')}
print('differences',[(r['character_code'],r['move_code']) for r in tc if db.get((r['character_code'],r['move_code'])) != (int(r['startup']) if r['startup'] else None,r['startup_basis'],int(r['is_derived']=='true'))])
c.rollback()
```

## 8. 成果物と索引

新規成果物は本レポート。CLAUDE.md §8および対象指示書 §4-8が必須とするprogress-logへの索引を追記する。これは調査コマンドの一般的な「レポートのみ」と異なるため、対象指示書の明示要求と上位共有ルールに従った文書上の追記である。

アプリコード・既存テスト・設計書・CSV・DB・followup-backlogは変更しない。開始時のgit diffは空。終了時は索引追記がtracked diffに現れ、レポートはuntrackedのため「git diff全体が空」とは報告しない。Git書込み操作（add/commitを含む）は行わない。

検査結果は末尾に記録する。

## 付録A. マス数のAPI・CSV・DB参照行

```text
migrations/000105_add_combos_position_mass.up.sql:29:ALTER TABLE combos ADD COLUMN start_position_mass INTEGER
migrations/000105_add_combos_position_mass.up.sql:30:    CHECK (start_position_mass IS NULL OR (start_position_mass BETWEEN 0 AND 160));
migrations/000105_add_combos_position_mass.up.sql:35:ALTER TABLE combos ADD COLUMN carry_distance_mass INTEGER
migrations/000105_add_combos_position_mass.up.sql:36:    CHECK (carry_distance_mass IS NULL OR (carry_distance_mass BETWEEN 0 AND 160));
migrations/000105_add_combos_position_mass.up.sql:59:SET start_position_mass = CASE position
internal/service/comboio/export.go:202:		StartPositionMass:     c.StartPositionMass,
internal/service/comboio/export.go:203:		CarryDistanceMass:     c.CarryDistanceMass,
internal/service/combo/service.go:84:	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。
internal/service/combo/service.go:86:	StartPositionMass *int
internal/service/combo/service.go:87:	// CarryDistanceMass は運び量(0〜160・M28-02a)。★区分へ丸めない。
internal/service/combo/service.go:88:	CarryDistanceMass     *int
internal/service/combo/service.go:1772:	if input.StartPositionMass != nil {
internal/service/combo/service.go:1773:		if code, ok := model.PositionFromMass(*input.StartPositionMass); ok {
internal/service/combo/service.go:1780:			input.StartPositionMass = &mass
internal/service/combo/service.go:1792:		StartPositionMass:     input.StartPositionMass,
internal/service/combo/service.go:1793:		CarryDistanceMass:     input.CarryDistanceMass,
internal/api/combo/dto.go:35:	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。
internal/api/combo/dto.go:39:	StartPositionMass *int `json:"startPositionMass,omitempty"`
internal/api/combo/dto.go:40:	// CarryDistanceMass は運び量(0〜160・M28-02a)。★始動位置とは別の値であり区分へ丸めない。
internal/api/combo/dto.go:41:	CarryDistanceMass     *int     `json:"carryDistanceMass,omitempty"`
internal/api/combo/dto.go:259:	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。
internal/api/combo/dto.go:260:	StartPositionMass *int `json:"startPositionMass,omitempty"`
internal/api/combo/dto.go:261:	// CarryDistanceMass は運び量(0〜160・M28-02a)。
internal/api/combo/dto.go:262:	CarryDistanceMass *int    `json:"carryDistanceMass,omitempty"`
internal/api/combo/dto.go:427:		StartPositionMass:     req.StartPositionMass,
internal/api/combo/dto.go:428:		CarryDistanceMass:     req.CarryDistanceMass,
internal/api/combo/dto.go:558:		StartPositionMass:       combo.StartPositionMass,
internal/api/combo/dto.go:559:		CarryDistanceMass:       combo.CarryDistanceMass,
internal/service/comboio/import.go:402:		StartPositionMass: dto.StartPositionMass,
internal/service/comboio/import.go:403:		CarryDistanceMass: dto.CarryDistanceMass,
internal/service/comboio/csvcore/csvexport.go:115:		ColStartPositionMass: intPtrToStr(c.StartPositionMass),
internal/service/comboio/csvcore/csvexport.go:116:		ColCarryDistanceMass: intPtrToStr(c.CarryDistanceMass),
internal/service/comboio/csvcore/combo.go:73:	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。未設定は nil。
internal/service/comboio/csvcore/combo.go:75:	StartPositionMass *int `json:"start_position_mass,omitempty"`
internal/service/comboio/csvcore/combo.go:76:	// CarryDistanceMass は運び量(0〜160・M28-02a)。未設定は nil。
internal/service/comboio/csvcore/combo.go:78:	CarryDistanceMass *int `json:"carry_distance_mass,omitempty"`
internal/service/comboio/csvcore/contract.go:52:	ColStartPositionMass = "start_position_mass"
internal/service/comboio/csvcore/contract.go:53:	ColCarryDistanceMass = "carry_distance_mass"
internal/service/comboio/csvcore/contract.go:118:	ColStartPositionMass,
internal/service/comboio/csvcore/contract.go:119:	ColCarryDistanceMass,
internal/service/comboio/csvcore/contract.go:145:	ColStartPositionMass: true,
internal/service/comboio/csvcore/contract.go:146:	ColCarryDistanceMass: true,
internal/service/comboio/csvcore/validate.go:70:	c.StartPositionMass = cfg.intField(&rr, ColStartPositionMass, cell,
internal/service/comboio/csvcore/validate.go:72:	c.CarryDistanceMass = cfg.intField(&rr, ColCarryDistanceMass, cell,
```

## 付録B. target_combo 全126行（CSVとDBの3属性差分0）

`line` はCSVヘッダを1行目として数えた行。空startupはNULL。basis/derivedも両側一致。105の集計はDB列の述語であり本表の外観で数えていない。

| CSV | line | code | 名称 | startup | basis | derived |
|---|---:|---|---|---:|---|---|
| character_data/aki.csv | 57 | hun_dun | 渾沌 | 8 | standalone | false |
| character_data/aki.csv | 58 | qiong_qi | 窮奇 | 14 | standalone | false |
| character_data/akuma.csv | 27 | viscera_piercer | 六腑穿ち | 7 | standalone | true |
| character_data/akuma.csv | 28 | bone_crusher_axe_kick | 骸斬り | 20 | standalone | true |
| character_data/akuma.csv | 30 | kikoku_combination_2hits | 鬼哭連撃(2発止め) | 10 | standalone | true |
| character_data/akuma.csv | 31 | kikoku_combination | 鬼哭連撃 | 9 | standalone | true |
| character_data/alex.csv | 47 | palm_strikes | パームストライク | 15 | standalone | true |
| character_data/alex.csv | 48 | twisted_drop | ツイストドロップ | 15 | standalone | true |
| character_data/cammy.csv | 84 | lift_combination | リフトコンビネーション | 9 | standalone | true |
| character_data/cammy.csv | 85 | swing_combination | スイングコンビネーション | 13 | standalone | true |
| character_data/chun_li.csv | 33 | soaring_eagle_punches | 鷹嘴連拳 | 6 | standalone | false |
| character_data/dee_jay.csv | 27 | threebeat_combo_2hits | 3ビートコンボ(2発止め) | 9 | standalone | true |
| character_data/dee_jay.csv | 28 | threebeat_combo | 3ビートコンボ | 14 | standalone | true |
| character_data/dee_jay.csv | 29 | dee_jay_special_2hits | ディージェイスペシャル(2発止め) | 11 | standalone | true |
| character_data/dee_jay.csv | 30 | dee_jay_special | ディージェイスペシャル | 13 | standalone | true |
| character_data/dee_jay.csv | 31 | funky_dance_2hits | ファンキーダンス(2発止め) | 12 | standalone | true |
| character_data/dee_jay.csv | 32 | funky_dance | ファンキーダンス | 20 | standalone | true |
| character_data/dee_jay.csv | 33 | funky_dance_feint | ファンキーダンス・フェイク | 1 | standalone | true |
| character_data/dee_jay.csv | 34 | party_in_the_air | フライングパーティー | NULL | standalone | true |
| character_data/e_honda.csv | 62 | double_slaps | 連ね張り手 | 4 | standalone | false |
| character_data/e_honda.csv | 63 | toko_shizume | 地鎮 | 22 | standalone | false |
| character_data/e_honda.csv | 64 | toko_shizume_sumo_spirit | 地鎮(肩屋入り) | 22 | standalone | true |
| character_data/ed.csv | 27 | flicker_combination_2hits | フリッカーコンビネーション(2発止め) | 7 | standalone | true |
| character_data/ed.csv | 28 | flicker_combination | フリッカーコンビネーション | 7 | standalone | true |
| character_data/ed.csv | 29 | body_blow_combination | ボディブローコンビネーション | 13 | standalone | true |
| character_data/ed.csv | 30 | hitman_combination_2hits | ヒットマンコンビネーション(2発止め) | 7 | standalone | true |
| character_data/ed.csv | 31 | hitman_combination | ヒットマンコンビネーション | 11 | standalone | true |
| character_data/ed.csv | 32 | low_smash_combination | ロースマッシュコンビネーション | 10 | standalone | true |
| character_data/elena.csv | 27 | starling_beak | スターリングビーク | 17 | standalone | true |
| character_data/elena.csv | 28 | handstand_whip | ハンドスタンドウィップ | 14 | standalone | true |
| character_data/elena.csv | 29 | hind_kick | ハインドキック | 12 | standalone | true |
| character_data/elena.csv | 30 | fluttering_lark | ラークフラッター | 15 | standalone | true |
| character_data/elena.csv | 31 | turning_tail | ターニングテイル | 17 | standalone | true |
| character_data/elena.csv | 33 | trunk_slap_2hits | トランクスラップ(2発止め) | 13 | standalone | true |
| character_data/elena.csv | 34 | trunk_slap | トランクスラップ | 7 | standalone | true |
| character_data/elena.csv | 35 | soaring_raid | ソアーレイド | NULL | standalone | true |
| character_data/elena.csv | 36 | raptor_range | ラプターレンジ | NULL | standalone | true |
| character_data/guile.csv | 21 | recoil_cannon | リコイルキャノン | 16 | standalone | true |
| character_data/guile.csv | 22 | double_shot | ダブルバレット | 12 | standalone | true |
| character_data/guile.csv | 23 | drake_fang | ドレイクファング | 20 | standalone | true |
| character_data/guile.csv | 24 | phantom_cutter | ファントムカッター | 10 | standalone | true |
| character_data/ingrid.csv | 26 | pretty_heel_kick | エアリートス | 12 | standalone | true |
| character_data/ingrid.csv | 28 | glowing_touch | グロータッチ | 20 | standalone | true |
| character_data/ingrid.csv | 30 | luminous_uppercut | ルミナスアッパー | 23 | standalone | true |
| character_data/ingrid.csv | 31 | satelite_leap | サテライトリープ | NULL | unknown | true |
| character_data/jamie.csv | 28 | phantom_sway_2hits | 幻酔舞 | 12 | standalone | true |
| character_data/jamie.csv | 29 | phantom_sway | 幻酔舞(飲酒) | 12 | standalone | true |
| character_data/jamie.csv | 30 | phantom_sway_drink_and_reach_drink_lv4 | 幻酔舞(飲酒 / 酔いLv4到達) | 12 | standalone | true |
| character_data/jamie.csv | 31 | bitter_strikes_2hits | 鋭鍾打(2発止め) | 6 | standalone | true |
| character_data/jamie.csv | 32 | bitter_strikes | 鋭鍾打 | 8 | standalone | true |
| character_data/jamie.csv | 33 | full_moon_kick_2hits | 円月脚 | 15 | standalone | true |
| character_data/jamie.csv | 34 | full_moon_kick | 円月脚(飲酒) | 15 | standalone | true |
| character_data/jamie.csv | 35 | full_moon_kick_drink_and_reach_drink_lv4 | 円月脚(飲酒 / 酔いLv4到達) | 15 | standalone | true |
| character_data/jamie.csv | 41 | intoxicated_assault_1hit | [酔いレベル3]酩酊襲(2発止め) | 21 | standalone | true |
| character_data/jamie.csv | 42 | drink_level_3_intoxicated_assault | [酔いレベル3]酩酊襲 | 21 | standalone | true |
| character_data/jamie.csv | 43 | drink_level_4_ransui_haze_2_retreat | [酔いレベル4]乱酔旋(2段目/後退) | 16 | through | true |
| character_data/jamie.csv | 44 | drink_level_4_ransui_haze_3_immediate | [酔いレベル4]乱酔旋(3段目/即時) | 38 | through | true |
| character_data/jamie.csv | 108 | drink_level_4_ransui_haze_3_delay | [酔いレベル4]乱酔旋(3段目/ディレイ) | 53 | through | true |
| character_data/jamie.csv | 109 | drink_level_4_ransui_haze_3_drink_while_retreating | [酔いレベル4]乱酔旋（3段目/後退飲酒） | 15 | through | true |
| character_data/jp.csv | 29 | grom_strelka | グロームストレルカ | 10 | standalone | true |
| character_data/jp.csv | 58 | zilant | ジラント | 20 | standalone | true |
| character_data/jp.csv | 59 | zilant_mid | ジラントルカー | 21 | standalone | true |
| character_data/jp.csv | 60 | zilant_low | ジラントナガー | 21 | standalone | true |
| character_data/juri.csv | 58 | death_crest | 死紋蹴 | 17 | standalone | true |
| character_data/ken.csv | 67 | chin_buster | 顎撥二連 | 11 | standalone | true |
| character_data/ken.csv | 68 | triple_flash_kicks_2hits | 閃光連脚(2発止め) | 11 | standalone | true |
| character_data/ken.csv | 69 | triple_flash_kicks | 閃光連脚 | 13 | standalone | true |
| character_data/kimberly.csv | 75 | bushin_tiger_fangs | 武神虎連牙 | 10 | standalone | true |
| character_data/kimberly.csv | 76 | bushin_prism_strikes_2hits | 武神天架拳(2発止め) | 6 | standalone | true |
| character_data/kimberly.csv | 77 | bushin_prism_strikes_3hits | 武神天架拳(3発止め) | 12 | standalone | true |
| character_data/kimberly.csv | 78 | bushin_prism_strikes | 武神天架拳 | 26 | standalone | true |
| character_data/kimberly.csv | 79 | bushin_hellchain_3hits | 武神獄鎖拳(3発止め) | 10 | standalone | true |
| character_data/kimberly.csv | 80 | bushin_hellchain | 武神獄鎖拳 | 15 | standalone | true |
| character_data/kimberly.csv | 81 | bushin_hellchain_throw | 武神獄鎖投げ | 15 | standalone | true |
| character_data/lily.csv | 65 | desert_storm_2hits | デザートストーム(2発止め) | 20 | standalone | true |
| character_data/lily.csv | 66 | desert_storm | デザートストーム | 20 | standalone | true |
| character_data/lily.csv | 67 | double_arrow | ダブルアロー | NULL | unknown | true |
| character_data/luke.csv | 28 | double_impact | ダブルインパクト | 11 | standalone | true |
| character_data/luke.csv | 63 | triple_impact_2hits | トリプルインパクト(2発止め) | 8 | standalone | true |
| character_data/luke.csv | 64 | triple_impact | トリプルインパクト | 10 | standalone | true |
| character_data/luke.csv | 65 | nose_breaker | ノーズブレイカー | 9 | standalone | true |
| character_data/luke.csv | 66 | snapback_combo_2hits | スナップバックコンボ(2発止め) | 12 | standalone | true |
| character_data/luke.csv | 67 | snapback_combo_3hits | スナップバックコンボ(3発止め) | 11 | standalone | true |
| character_data/luke.csv | 68 | snapback_combo | スナップバックコンボ | 11 | standalone | true |
| character_data/m_bison.csv | 63 | shadow_hammer | シャドウハンマー | 22 | standalone | true |
| character_data/m_bison.csv | 64 | shadow_spear | シャドウスピア | 16 | standalone | true |
| character_data/m_bison.csv | 65 | hell_attack | ヘルアタック | 7 | unknown | true |
| character_data/mai.csv | 26 | hien_ren_kyaku_2hits | 飛燕連脚(2発止め) | 7 | standalone | true |
| character_data/mai.csv | 27 | hien_ren_kyaku | 飛燕連脚 | 10 | standalone | true |
| character_data/mai.csv | 29 | hoshi_kujaku | 星孔雀 | 9 | standalone | true |
| character_data/manon.csv | 26 | a_terre | ア・テール | 10 | standalone | true |
| character_data/manon.csv | 27 | en_haut | アン・オー | 14 | standalone | true |
| character_data/manon.csv | 29 | allonge | アロンジェ | 4 | standalone | true |
| character_data/manon.csv | 30 | temps_lie | タン・リエ | 5 | standalone | true |
| character_data/marisa.csv | 37 | malleus_breaker | マレウスビート | 18 | standalone | true |
| character_data/marisa.csv | 40 | falx_crusher | ファルクスクラッシュ | 16 | standalone | true |
| character_data/marisa.csv | 85 | light_two_hitter | ライトワンツー | 14 | standalone | true |
| character_data/marisa.csv | 86 | medium_two_hitter | ミドルワンツー | 14 | standalone | true |
| character_data/marisa.csv | 87 | heavy_two_hitter | ヘビィーワンツー | 24 | standalone | true |
| character_data/marisa.csv | 88 | volare_combo | ヴォラーレコンボ | NULL | unknown | true |
| character_data/marisa.csv | 89 | novacula_swipe | ノバキュラスワイプ | 11 | standalone | true |
| character_data/marisa.csv | 90 | novacula_thrust | ノバキュラシュート | 11 | standalone | true |
| character_data/rashid.csv | 84 | rising_kick | ライジング・キック | 13 | standalone | true |
| character_data/ryu.csv | 29 | high_double_strike | 上段二連撃 | 9 | standalone | true |
| character_data/ryu.csv | 30 | fuwa_triple_strike_2hits | 不破三連撃(2発止め) | 5 | standalone | true |
| character_data/ryu.csv | 31 | fuwa_triple_strike | 不破三連撃 | 17 | standalone | true |
| character_data/sagat.csv | 28 | middle_step_kick | ステップミドルキック | 16 | standalone | true |
| character_data/sagat.csv | 29 | tiger_sting | タイガースティング | 16 | standalone | true |
| character_data/sagat.csv | 30 | tiger_slash | タイガースラッシュ | 20 | standalone | true |
| character_data/sagat.csv | 31 | tiger_rise | タイガーライズ | 18 | standalone | true |
| character_data/terry.csv | 51 | power_drive | パワードライブ | 15 | standalone | true |
| character_data/terry.csv | 52 | power_shoot | パワーシュート | 18 | standalone | true |
| character_data/terry.csv | 53 | power_dunk | パワーダンク | 18 | standalone | true |
| character_data/terry.csv | 54 | passing_sway | パッシングスウェー | 13 | standalone | true |
| character_data/terry.csv | 55 | jumping_lariat | ジャンプラリアットパンチ | 24 | standalone | true |
| character_data/terry.csv | 56 | jumping_knee | ジャンプニーアタック | 24 | standalone | true |
| character_data/terry.csv | 57 | fire_kick | ファイヤーキック | 13 | standalone | true |
| character_data/yasmine.csv | 26 | kidlat_na_hiwa | キドラット・ナ・ヒワ | 8 | standalone | true |
| character_data/yasmine.csv | 27 | tatlong_hiwa | タッロング・ヒワ | 12 | standalone | true |
| character_data/yasmine.csv | 28 | sunod_sunod_na_sipa_2hits | スノスノッド・ナ・シパ(2発止め) | 13 | standalone | true |
| character_data/yasmine.csv | 29 | sunod_sunod_na_sipa | スノスノッド・ナ・シパ | 16 | standalone | true |
| character_data/yasmine.csv | 30 | kumbinasyong_pampabagsak | コンビナション・パムパバッグサ | 8 | standalone | true |
| character_data/zangief.csv | 56 | machine_gun_chops_2hits | マシンガンチョップ(2段止め) | 9 | standalone | false |
| character_data/zangief.csv | 57 | machine_gun_chops | マシンガンチョップ | 9 | standalone | false |
| character_data/zangief.csv | 59 | power_stomps_2hits | ストンピング(2段止め) | 9 | standalone | false |
| character_data/zangief.csv | 60 | power_stomps | ストンピング | 10 | standalone | false |

## 付録C. 告知・読取欄のテスト参照全行

直接参照式: `recipe-gamepad-(notice|readout)|GAMEPAD_INPUT_NOTICE_POINTS`。対象はweb/srcの*.test.ts(x)とweb/e2eの*.spec.ts。

```text
web/e2e/m21-06-command-motion.spec.ts:60:  return page.getByTestId("recipe-gamepad-readout-command").first();
web/e2e/m21-06-command-motion.spec.ts:172:      page.getByTestId("recipe-gamepad-readout-command-directions").first(),
web/src/features/combo/components/VirtualController/VirtualController.test.tsx:535:    expect(screen.queryByTestId("recipe-gamepad-notice")).toBeNull();
web/src/features/combo/components/VirtualController/VirtualController.test.tsx:536:    expect(screen.queryByTestId("recipe-gamepad-readout")).toBeNull();
web/src/features/gamepad/gamepadRecipeInput.test.tsx:20:import { GAMEPAD_INPUT_NOTICE_POINTS } from "./components/GamepadInputNotice";
web/src/features/gamepad/gamepadRecipeInput.test.tsx:310:    const unresolved = screen.getByTestId("recipe-gamepad-readout-unresolved");
web/src/features/gamepad/gamepadRecipeInput.test.tsx:323:      screen.getByTestId("recipe-gamepad-readout-unresolved").textContent,
web/src/features/gamepad/gamepadRecipeInput.test.tsx:332:      screen.getByTestId("recipe-gamepad-readout-resolved").textContent,
web/src/features/gamepad/gamepadRecipeInput.test.tsx:349:      screen.getByTestId("recipe-gamepad-readout-unresolved").textContent,
web/src/features/gamepad/gamepadRecipeInput.test.tsx:419:      screen.getByTestId("recipe-gamepad-readout-resolved").textContent,
web/src/features/gamepad/gamepadRecipeInput.test.tsx:481:    expect(screen.queryByTestId("recipe-gamepad-notice")).toBeNull();
web/src/features/gamepad/gamepadRecipeInput.test.tsx:482:    expect(screen.queryByTestId("recipe-gamepad-readout")).toBeNull();
web/src/features/gamepad/gamepadRecipeInput.test.tsx:492:    expect(screen.getByTestId("recipe-gamepad-notice")).toBeTruthy();
web/src/features/gamepad/gamepadRecipeInput.test.tsx:493:    expect(screen.getByTestId("recipe-gamepad-readout")).toBeTruthy();
web/src/features/gamepad/gamepadRecipeInput.test.tsx:503:    const notice = screen.getByTestId("recipe-gamepad-notice");
web/src/features/gamepad/gamepadRecipeInput.test.tsx:505:    for (let i = 1; i <= GAMEPAD_INPUT_NOTICE_POINTS.length; i += 1) {
web/src/features/gamepad/gamepadRecipeInput.test.tsx:507:        screen.getByTestId(`recipe-gamepad-notice-point-${i}`).textContent,
web/src/features/gamepad/gamepadRecipeInput.test.tsx:510:    expect(GAMEPAD_INPUT_NOTICE_POINTS).toHaveLength(3);
web/src/features/gamepad/gamepadRecipeInput.test.tsx:517:    const notice = screen.getByTestId("recipe-gamepad-notice");
web/src/features/gamepad/gamepadRecipeInput.test.tsx:554:      "[data-testid='recipe-gamepad-readout']",
web/src/features/gamepad/gamepadRecipeInput.test.tsx:579:    const notices = screen.getAllByTestId("recipe-gamepad-notice");
web/src/features/gamepad/gamepadShortcut.test.tsx:295:  return screen.queryByTestId("recipe-gamepad-readout-action")?.textContent ?? "";
web/src/features/gamepad/gamepadShortcut.test.tsx:365:    const unresolved = screen.getByTestId("recipe-gamepad-readout-unresolved");
web/src/features/gamepad/gamepadShortcut.test.tsx:432:    screen.queryAllByTestId("recipe-gamepad-readout-shortcut")[0]?.textContent ??
web/src/features/gamepad/gamepadShortcut.test.tsx:581:    const setupControllers = screen.getAllByTestId("recipe-gamepad-readout");
web/src/features/keyboard/keyboardRecipeInput.test.tsx:486:      screen.getByTestId("recipe-gamepad-readout-unresolved").textContent,
web/src/features/physical-input/commandMode.test.tsx:341:  return screen.getByTestId("recipe-gamepad-readout-command");
web/src/features/physical-input/commandMode.test.tsx:434:      screen.getByTestId("recipe-gamepad-readout-command-directions")
web/src/features/physical-input/commandMode.test.tsx:592:      screen.getByTestId("recipe-gamepad-readout-command-directions")
web/src/features/physical-input/commandMode.test.tsx:812:      screen.getByTestId("recipe-gamepad-readout-command-directions")
web/src/features/physical-input/modalSuppression.test.tsx:389:  return screen.queryByTestId("recipe-gamepad-readout-action")?.textContent ?? "";
TOTAL matching lines=31
```

ヘルパ定義・間接呼出し式: `\b(actionText|shortcutText|commandPane)\(`。関係する4ファイルだけを掲載。

```text
web/e2e/m21-06-command-motion.spec.ts:59:function commandPane(page: import("@playwright/test").Page) {
web/e2e/m21-06-command-motion.spec.ts:131:    await expect(commandPane(page)).toContainText("入力中");
web/e2e/m21-06-command-motion.spec.ts:151:    await expect(commandPane(page)).toContainText("入力中");
web/e2e/m21-06-command-motion.spec.ts:191:    await expect(commandPane(page)).toContainText("236");
web/e2e/m21-06-command-motion.spec.ts:192:    await expect(commandPane(page)).toContainText(
web/e2e/m21-06-command-motion.spec.ts:216:    await expect(commandPane(page)).toContainText(
web/e2e/m21-06-command-motion.spec.ts:228:    await expect(commandPane(page)).toContainText("入力中");
web/src/features/gamepad/gamepadShortcut.test.tsx:294:function actionText(): string {
web/src/features/gamepad/gamepadShortcut.test.tsx:385:    expect(shortcutText()).toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:390:    expect(shortcutText()).not.toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:401:    expect(shortcutText()).toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:404:    expect(shortcutText()).not.toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:413:    expect(shortcutText()).not.toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:420:    expect(actionText()).toContain("削除する対象がありません");
web/src/features/gamepad/gamepadShortcut.test.tsx:425:    expect(shortcutText()).toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:426:    expect(actionText()).toBe("");
web/src/features/gamepad/gamepadShortcut.test.tsx:430:function shortcutText(): string {
web/src/features/gamepad/gamepadShortcut.test.tsx:484:    expect(actionText()).toContain("削除しました");
web/src/features/gamepad/gamepadShortcut.test.tsx:492:    expect(actionText()).toContain("削除する対象がありません");
web/src/features/gamepad/gamepadShortcut.test.tsx:504:    expect(actionText()).toContain("保存しました");
web/src/features/gamepad/gamepadShortcut.test.tsx:514:    expect(actionText()).toContain("保存できる状態ではありません");
web/src/features/gamepad/gamepadShortcut.test.tsx:523:    expect(actionText()).toContain("保存はこの面では行えません");
web/src/features/gamepad/gamepadShortcut.test.tsx:544:    expect(actionText()).toContain("修飾の編集を開きました");
web/src/features/gamepad/gamepadShortcut.test.tsx:552:    expect(actionText()).toContain("修飾する対象がありません");
web/src/features/gamepad/gamepadShortcut.test.tsx:625:    expect(shortcutText()).not.toContain("前置き中");
web/src/features/gamepad/gamepadShortcut.test.tsx:635:    expect(shortcutText()).toContain("未登録");
web/src/features/physical-input/commandMode.test.tsx:340:function commandPane(): HTMLElement {
web/src/features/physical-input/commandMode.test.tsx:519:    const pane = commandPane();
web/src/features/physical-input/commandMode.test.tsx:534:    expect(commandPane().textContent).toContain("切り替えます");
web/src/features/physical-input/commandMode.test.tsx:537:    expect(commandPane().textContent).toContain("入力中");
web/src/features/physical-input/commandMode.test.tsx:552:    expect(commandPane().textContent).toContain("入力中");
web/src/features/physical-input/commandMode.test.tsx:573:    expect(commandPane().textContent).toContain("入力中");
web/src/features/physical-input/commandMode.test.tsx:575:    expect(commandPane().textContent).not.toContain("（方向なし）");
web/src/features/physical-input/commandMode.test.tsx:616:    expect(commandPane().textContent).toContain(
web/src/features/physical-input/commandMode.test.tsx:633:    expect(commandPane().textContent).toContain(
web/src/features/physical-input/commandMode.test.tsx:648:    expect(commandPane().textContent).toContain("取得できていない");
web/src/features/physical-input/commandMode.test.tsx:659:    expect(commandPane().textContent).not.toContain("入力中");
web/src/features/physical-input/commandMode.test.tsx:684:    expect(commandPane().textContent).toContain("入力中");
web/src/features/physical-input/commandMode.test.tsx:698:    expect(commandPane().textContent).not.toContain("入力中");
web/src/features/physical-input/commandMode.test.tsx:699:    expect(commandPane().textContent).toContain("236");
web/src/features/physical-input/commandMode.test.tsx:700:    expect(commandPane().textContent).toContain(
web/src/features/physical-input/modalSuppression.test.tsx:388:function actionText(): string {
web/src/features/physical-input/modalSuppression.test.tsx:456:    expect(actionText()).toBe("");
TOTAL matching lines=43
```

### コメントを含む維持要求の検索証拠

式: `告知|3 点|3 区画|5 区画|落とさない|黙って|読取表示|区画ごと|常設`、対象は下記4実装ファイル。コメントと実コードの区別は行本文で示す。


- ` web/src/features/gamepad/components/GamepadInputNotice.tsx:1:// 物理入力の告知（M21-03 §4.6・D-347 の帰結・必須）。 `
- ` web/src/features/gamepad/components/GamepadInputNotice.tsx:6:// ★3 点目（不具合ではなく意図的な設定であること）を落とさないこと。1・2 だけだと `
- ` web/src/features/gamepad/components/GamepadInputNotice.tsx:13:// ★常設の注記にした（§9.2-2 で形は自由）。初回のみの説明にしなかったのは、 `
- ` web/src/features/gamepad/components/GamepadInputNotice.tsx:16:/** 告知の 3 点。★順序も内容もここが正本である。 */ `
- `` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:1:// 物理入力の読取表示（M21-03 §4.3・`FR106`）。 ``
- ` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:3:// ★**現在 5 区画である**（区画は増えてきた。件数を書き写す側の記述を足さないこと）—— `
- ` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:5://   (3) 解決できなかった入力（§9.2-1 の設計卓の見込みどおりの 3 区画） `
- ` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:9:// ★(3) が要件である。黙って捨てると、利用者は「入力されなかった」と「解決できなかった」を `
- ` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:44:// ショートカット操作が効かなかった理由（M21-04 §4.5-3）。★黙って何も起きない形にしない。 `
- ` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:85:  /** 解決できなかった入力（新しいものが先頭）。★上限は区画ごとに独立している。 */ `
- ` web/src/features/gamepad/components/GamepadRecipeReadout.tsx:258:      {/* (3) 解決できなかった入力。★黙って捨てない（§4.3-3） */} `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:44:/** 読取表示に出す 1 件（確定 / 解決できなかった のどちらも出す＝§4.3-2 / §4.3-3）。 */ `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:53: * コマンド技入力モードで確定した 1 件の読取表示（M21-06 §4.1-6・§4.2-7）。 `
- `` web/src/features/physical-input/usePhysicalRecipeInput.ts:55: * ★確定できたものも、できなかったものも出す。**黙って捨てない**（`E-84`）。 ``
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:69: * 読取表示に残す件数（**区画ごとに独立**）。★UI 都合の上限であり判定には関与しない。 `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:73: *   告知が想定している利用者像とちょうど重なる**（レビュー指摘 中-5）。 `
- `` web/src/features/physical-input/usePhysicalRecipeInput.ts:82: * ★**効かなかったことも出す。** 黙って何も起きない形にしない（`E-84`）。 ``
- `` web/src/features/physical-input/usePhysicalRecipeInput.ts:141:   * ★告知・読取表示の出し分けはこちらで行う。`available` は provider の内側にいるかを ``
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:142:   *   示すだけで、provider はアプリ全体に常設されるため**本番では常に true** である `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:144:   *   告知と読取表示が常設される**（レビュー指摘 中-1）。 `
- `` web/src/features/physical-input/usePhysicalRecipeInput.ts:153:   * ★読取表示・点灯の出し分けはこちらを使う。`connected` だけで出し分けると、 ``
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:154:   *   **コントローラを持たずキーボードだけで入力する利用者に読取表示が出ない**—— `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:168:  /** 解決できなかった入力（新しいものが先頭）。★黙って捨てない（§4.3-3）。 */ `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:182:  /** モードで確定した／確定できなかった入力（新しいものが先頭）。★黙って捨てない。 */ `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:281:   * ★**解決できなかった入力も必ず読取表示へ残す**（§4.2-7・チェックリスト重大 13）。 `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:344:    // ★解決できなかった入力も読取表示に残す。黙って捨てない（§4.3-3）。 `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:375:   * ★導線が無い／実行できる状態でない場合は、黙って何も起こさずに理由を残す（§4.5-3）。 `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:455:  // ★入力手段が無くなったら読取表示も捨てる。点灯（provider 側）だけが消えて「確定したステップ」が `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:458:  //     キーボードだけの利用者は**確定した直後に読取表示が消える**（パッドが未接続であるため）。 `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:464:    // ★モードの読取表示も対称に捨てる（M21-06）。片方だけ残すと、いつの入力なのか `
- ` web/src/features/physical-input/usePhysicalRecipeInput.ts:472:  //   方向はステップにならず・解決もせず・読取表示は「取得できていない」枝が優先されて `
- `` web/src/features/physical-input/usePhysicalRecipeInput.ts:475:  //   読取表示へ出る**（`E-84`／§4.1-7）。黙って消さない。 ``
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:52:   *   渡さなければ、その操作は「この面では行えません」として読取表示に出る。 `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:88:// システム行(DI/DP/投げ/ラッシュ/削除)はタブ外に常設(既存挙動温存・E2E 非回帰)。 `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:199:  // ★共通技を常設行からタブへ移設したため、点灯も move_code の集合で渡す(M30-01 追補)。 `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:236:            ★キーボードの状態表示は**常に出す**(M21-05 §4.1-3)。パッドの読取表示と違い、 `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:246:        物理入力の告知(§4.6)と読取表示(§4.3)。★2 面が同じ部品を描画する。 `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:248:        アプリ全体に provider が常設されるため本番では常に true であり、それで出し分けると `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:249:        物理コントローラを一度も接続していない利用者にも常設されてしまう(レビュー指摘 中-1)。 `
- ` web/src/features/combo/components/VirtualController/VirtualController.tsx:336:            ★★M30-01 追補(2026-09-08 開発者指示): 共通技はタブ外の常設行から**タブへ移設**した。 `
- ` TOTAL matching lines=40 `

## 最終検証記録

- `bash scripts/check-md-emphasis.sh docs/progress/M37-RESEARCH-01-report.md`: 検出0行。引用コード中の強調記号は引用内容を保持したインラインコード表示にして検査した。
- CSV/DBの126行のstartup/basis/derived差分0、集計109/106/105/119を再計数して一致。告知3文のプログラム比較も一致。
- 報告中の具体的なソースファイル参照の不存在0件。
- `git diff --check`: 問題なし。成果物は本レポートとprogress-logの索引追記のみ。テスト・アプリ・移行は実行していない。コミットなし。
