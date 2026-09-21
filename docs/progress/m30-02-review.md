# M30-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 文書ID | M30-02-review |
| バージョン | 1.0.0（2026-09-09） |
| 対象指示書 | `docs/instructions/M30-02-controller-selection-and-labels.md` v1.0.0 |
| 対象チェックリスト | `docs/instructions/reviews/M30-02-review-checklist.md` v1.0.0 |
| 対象完了報告 | `docs/progress/M30-02-completion-report.md` v1.0.0 |
| 対象差分 | `4c0dcb2` → `e1b0a46`（ブランチ `claude/m30-02-implementation-plan-2wa8l9`・18 ファイル / +1235 / -188） |

---

## 総評

射程 5 件すべてに着地があり、契約の棚卸しを先にコミットして `data-testid` と aria 名を 1 つも動かさなかった点、`SD-020` を 2 面まとめて 1 コミットで入れ両面にテストを置いた点、破壊確認を 3 件実施した点は、チェックリストの中心（束 D-1・観点 1・束 B-1）を正面から満たしている。数字も裏取りできた——`pnpm test` 222 files / 2653 passed、`git diff --numstat` の 18 行、`make e2e-only P=m30-0` の 16 passed、`check-import-order` の 101 → 100 はすべて再現した。母集団 1024 / 186 / 105 も CSV から独立に一致した。

一方で、本サブは「`CHANGE-166` が明文化した規則を A1 について失効させる」変更でありながら、その規則を宣言しているコード注記を 1 行も直していない。出し分けの唯一の正本である `moveSurfacing.ts` に「接尾辞なしの必殺技は未分類へ落ちる。これは不具合ではない」がそのまま残っており、`M30-03` の担当が最初に読む場所である。

機能面では、新設した活性条件 `isOdVariantApplicable` に 2 つの穴がある。1 つは判定が `_od` 末尾だけを見るため実在する OD 必殺技 31 件を弾いてしまうこと、もう 1 つはインライン面で「OD 技で選ぶ → 技を通常技へ変える → 追加」の順に操作すると `SD-020` が塞いだはずの状態が復活することである。どちらも現行テストの経路の外にある。

---

## 設計準拠性レビュー結果

### 束 A — 契約の棚卸し（評価: ◎）

| 観点 | 判定 | 内容 |
|---|---|---|
| A-1 実測で一覧が出ているか | ◎ | 完了報告 §1.1 が面ごとの `data-testid` 一覧、§1.2 が数字キーの現物、§1.3 が固定しているテスト 12 本を単体・E2E 両方で挙げている |
| A-2 母集団が実装か | ◎ | `testid-convention.md` ではなく実装を走査している。数字キーについては `optionButtons.ts` を正本とし「仮想コントローラは 1 つも消費していない」を独立に確認できた（`web/src/features/combo/components/VirtualController/` 配下に `keydown` / `onKeyDown` が 1 件も無い） |
| A-3 棚卸しにコード変更が混ざっていないか | ◎ | `b1c613e` は `docs/` のみ |

### 束 B — `SD-020`（評価: ○）

| 観点 | 判定 | 内容 |
|---|---|---|
| B-1 2 面それぞれにテストが在るか | ◎ | ダイアログ側 `ModifiersEditor.test.tsx` 5 件、インライン側 `RecipeBuilder.test.tsx` 4 件。破壊確認 B の「7 failed（2 面とも）」はテスト本文を読んで裏が取れた |
| B-2 2 面が 1 コミットか | ◎ | `6cfb976` に両面が入っている |
| B-3 「既定非表示」であって「削除」でないことを試験しているか | ◎ | 単体・E2E とも展開して 3 つ出ることまで見ている。観点 7-2 が警戒した「初期状態が非表示なら何もしなくても緑」にはなっていない |
| 射程拡大（活性条件） | △ | 判定そのものに 2 つの穴がある。下記「推奨修正 高-2 / 高-3」 |
| `OD_VARIANT_ORDER` の値の集合 | ◎ | 変えていない（§4-4 遵守）。`inputResolution.ts:273` は着手時点のまま |
| データ属性を足していないか | ◎ | マイグレ 0 本・`migrations/` の差分 0（束 E-4 遵守） |

### 束 C — `P4M-016` / `P4M-018`（評価: ○）

| 観点 | 判定 | 内容 |
|---|---|---|
| C-1 純粋関数 ＋ 単体テスト | ◎ | `parseSpecialCode` / `splitSpecialVariant` / `isOdVariantApplicable` がすべて `inputResolution.ts` の純関数で、`inputResolution.test.ts` に 6 + 6 + 6 件 |
| C-2 `moveSurfacing.ts` と判定が重複していないか | ◎ | `moveSurfacing.ts` の差分は 0 バイト。`isOnSpecialTab` は従来どおり `parseSpecialCode` を呼ぶだけであり、規則は 1 か所に留まっている |
| C-3 逐語が実測で再現されてから直っているか | ◎ | `terry.csv:27` を特定し、`round_wave_heavy` が唯一の例であることまで示している。独立に走査したところ、「強度が 1 つしか無く `name_ja` に強度語が無い」ファミリーは seed 全体で `terry/round_wave_heavy` 1 件だけであり、報告の断定は正しい |
| C-3 直さずに止めたか | ◎ | マイグレ自採番を避け §6-1 の請求に回したうえで、E2E に陽性対照（まだ「強」のままである）を置いている。§4-5 の禁止に触れていない |
| C-4 「出ているものを消しただけ」になっていないか | ◎ | 案 B は変種軸への畳み込みであり、確定するステップは着手時点と同一の `move_id`。`VirtualController.test.tsx` が「ホールドを選ぶと強度がホールド版へ切り替わる」まで見ている |
| 案の選定 | ◎ | 案を 3 つ出して開発者が案 B を選んでいる（§4-6 遵守） |

### 束 D — `SM-080` / `SM-149`（評価: ◎）

| 観点 | 判定 | 内容 |
|---|---|---|
| D-1 `data-testid` を変えていないか | ◎ | 差分の削除行に現れる `testId` 4 種はすべて移動に伴う再掲であり、追加行に同一値で復活している。走査で確認した |
| D-2 数字キーと `OptionButtonGroup` の衝突 | ◎ | 数字キーの割当に一切触れていない。`optionButtons.ts` / `OptionButtonGroup.tsx` の差分 0 |
| D-3 コミットが最後か | ◎ | `2335d59` が最終コミット（§2.8-5 遵守） |
| D-4 `M30-01` の 9 種を変えていないか | ◎ | タブ 8 枚の `data-testid` は不変。`m30-01` の E2E も 8 枚の主張を残したまま緑 |
| ボタン名を製造が決めていないか | ◎ | 案 A（現行維持）を開発者が選んでいる。ja / en とも `controller.direction.*` は 1 値も変わっていない |

### 束 E — 射程（評価: ○）

| 観点 | 判定 | 内容 |
|---|---|---|
| E-1 §4「やらないこと」13 項目 | ○ | 13 項目のうち直接の違反は無い。ただし §4-1「何を出すかの規則を変えること」は実質的に越えている——`parseSpecialCode` の 3 段化は `isOnSpecialTab` の述語を通じて 186 件を未分類から必殺技タブへ移す。これは 2026-09-09 の開発者判断（案 A）に基づく実施であり、報告 §6-2 が CHANGE 起票の請求として明示しているため手続き上は妥当だが、その帰結が下記「高-1」の未処理を生んでいる |
| E-2 `moveSurfacing.ts` を書き換えていないか | ◎ | 差分 0 バイト |
| E-3 `docs/design/` を編集していないか | ◎ | 差分 0。§6 に 8 件の請求として整理されている |
| E-4 データ属性を足していないか | ◎ | 追加なし |
| §4-13 CHANGE / マイグレの自採番 | ◎ | 0 本。`ls migrations/` の最大が `000106` である点も報告どおり |

### 束 F — 検査と報告（評価: △）

| 観点 | 判定 | 内容 |
|---|---|---|
| F-1 最後にもう一度回しているか | ○ | `check-artifact-integrity` / `check-stop-discipline` / `check-doc-refs` / `check-browser-storage-keys` / `check-enum-sync` / `check-import-order` / `check-doc-inventory` を HEAD で再実行し、すべて緑を確認した。`go test ./...` も exit 0 |
| F-2 未実施を断定で書いていないか | ◎ | `M30-01` の再発は無い。§5-6 は「Phase D で追記する」と正しく未完で書かれている |
| F-3 `make e2e` を全数で回しているか | 不明 | 本レビューでは `make e2e-only P=m30-0` の 16 本のみ実走した（16 passed）。報告の「285 passed」は追試していない。下記「制約事項」参照 |
| F-4 `check-md-emphasis` を通しているか | ◎ | 再実行して検出 0 行 |
| 完了条件 §5-9（progress-log 追記） | × | 未達。`bash scripts/check-progress-log-index.sh` が「作業 ID `m30-02` が現れない」で違反 1 件を出す |

---

## 設計準拠性以外の指摘事項

### 1. `isOdVariantApplicable` の判定が `_od` 末尾に限られている

`web/src/features/combo/inputResolution.ts:299-302`。

```ts
return move.category === "special" && move.code.endsWith("_od");
```

seed を走査すると、`category='special'` かつ「OD 技である」が `code` の途中の `od` トークンで表現されている行が 31 件ある。

| キャラ | 例 |
|---|---|
| mai | `flame_od_kachousen` ／ `flame_od_ryuuenbu` ほか 6 件 |
| blanka | `lightning_beast_od_rolling_attack` ほか 6 件 |
| lily | `windclad_od_condor_spire` ほか 4 件 |
| m_bison | `mine_set_od_psycho_crusher_attack` ほか 3 件 |
| rashid | `buffed_od_spinning_mixer` ほか 2 件 |
| cammy | `fatal_leg_twister_light_od_hooligan_combination` ほか 3 件 |
| ryu / ken / e_honda / c_viper / yasmine | `denjin_charge_od_hadoken` ほか各 1〜2 件 |

これらはいずれも `name_ja` が「OD…」で始まる正真正銘の OD 必殺技であり、着手時点は `od_lm` / `od_mh` / `od_lh` を付けられた。本サブ以後は付けられない。単体テストは `hadoken_od` / `hadoken_light` / `crouching_light_punch` / `some_od`（`super_art` / `unique`）しか見ておらず、この形が 1 件も入っていない。

### 2. インライン面で活性条件を回避できる

`web/src/features/combo/components/RecipeBuilder.tsx:106-123`。`handleAdd` は `buildModifiers(nonMoveType, draftFlags, draftNotes)` を素通しし、`draftFlags` を追加時に検証しない。`ModifierOdVariantFields` の `disabled = !applicable && !checked` は「既存データを外せるようにする」ための緩和だが、インライン面の `draftFlags` は既存データではない。

再現手順:

1. 全技一覧を展開し「OD 強度組合せ」を開く
2. 技に `OD波動拳` を選び `OD(弱中)` にチェック（`applicable` なので活性）
3. 技を `しゃがみ弱P` に変える（`checked` が真なので `disabled` にならない）
4. ［追加］

結果として `modifiers.flags: ["od_lm"]` を持つ通常技ステップが積める。これは `SD-020` の射程拡大が塞いだはずの「しゃがみ弱P に OD(弱中) を付けられる」そのものである。`RecipeBuilder.test.tsx` の 4 件は「選ぶ → 判定を見る」までで止まっており、「選び直してから追加する」経路を通っていない。

### 3. `data-testid` `recipe-od-variant-section` が 2 面で重複しうる

`ModifierOdVariantFields.tsx:55` は 1 つの定数を両面で描く。プルダウンを展開したままステップの修飾ダイアログを開くと、同一 `data-testid` が 2 個 DOM に存在する。Playwright の strict mode と RTL の `getByTestId` はどちらもその状態で落ちる。現行 spec はこの同時表示を作らないため緑だが、`M30-03` 以降が両面をまたぐ spec を書いた時点で落ちる。`layout` で `recipe-od-variant-section-inline` / `-dialog` に割るのが素直である。

### 4. テスト fixture の `moveId` が重複している

`web/src/features/combo/components/VirtualController/VirtualController.test.tsx:65-68`。新規追加した `lightning_beast_light_rolling_attack` と既存の `german_suplex` がともに id `172` である。同ファイルは id `13` / `15` にも既存の重複があるため新規の逸脱ではないが、本サブが 1 件増やした。`isControllerSurfaced` は `normalIds.has(move.id)` で判定するため、片方が通常技タブへ載る形にデータが動いた瞬間、もう片方も静かに掲載済み扱いになる。同ファイル 707 行の `expect(onStepAdd).toHaveBeenCalledWith({ moveId: 172, ... })` も、id だけでは 2 つの move を区別できない。

### 5. 新設した利用者可視文言が i18n の外にある

`ModifierOdVariantFields.tsx:22-24`。

```ts
export const OD_VARIANT_SECTION_LEGEND = "OD 強度組合せ";
export const OD_VARIANT_UNAVAILABLE_HINT = "このステップは必殺技の OD ではないため選べません";
```

`MODIFIER_FLAGS` のラベルが元々ハードコードであるためこの面の流儀としては一貫しているが、同じ文言「OD 強度組合せ」が仮想コントローラ側では `controller.special.odVariantsLegend` として ja / en の locale に入っている。同じ語が 2 つの経路を持つ状態であり、片方だけ直すと単体・E2E が共有している `getByRole("button", { name: /OD 強度組合せ/ })` が片面だけ通る。`OD_VARIANT_UNAVAILABLE_HINT` は英語 locale に対応がなく、en では日本語のまま出る。

### 6. `data-testid` の命名が既存規約から少し外れている

`docs/design/testid-convention.md` は「小文字ケバブケース」を定めている。`recipe-special-variant-max_holding` は列挙値そのものを埋めているためアンダースコアが入る。`recipe-unclassified-{code}` のようにデータ由来の code を埋める既存例はあるが、これは固定の列挙値であり `max-holding` にできた。あわせて `recipe-special-od-variants`（コントローラ側の折りたたみ）と `recipe-od-variant-section`（修飾フラグ側の折りたたみ）は語がほぼ同じで役割が違う。

### 7. `splitSpecialVariant` の後退経路が注記されていない

`inputResolution.ts:181-187`。最初に一致した接尾辞で基底が実在しなかった場合、ループは次の接尾辞へ進む。したがって `X_max_holding` は `X` が無く `X_max` が在れば「ホールド版の `X_max`」として畳まれる。現行 seed では発生しない（走査で衝突 0 件・孤児 0 件を確認）が、注記は「順序」だけを説明しており、この経路に触れていない。

### 8. import 順（既存分）

`SpecialMovePanel.tsx:18` と `HitBoxLayout.tsx:16` は `react-i18next` が相対 import の後ろに残っている。どちらも本サブが大きく書き換えたファイルだが、着手時点からの持ち越しであり `check-import-order` のベースライン内である（101 → 100）。

---

## 推奨修正（優先度別）

### 高（M30 完了前に修正必須）

- **高-1: 失効した記述がコードに残っている。**
  本サブは `CHANGE-166` の規則を A1 の 186 件について失効させた（完了報告 §6-2 が自らそう書いている）。にもかかわらず、その規則を宣言しているコード注記が 1 行も直っていない。
  - `web/src/features/combo/moveSurfacing.ts:13-15` — 「必殺技ファミリー UI の規則（強度接尾辞を持たない move_code は載らない）は `CHANGE-166` が明文化した意図された設計であり…接尾辞なしの必殺技は『未分類』へ落ちる。これは不具合ではない」。A1 については偽になった。
  - `web/src/features/combo/moveSurfacing.ts:147` — `isOnSpecialTab` の godoc「強度接尾辞を持たない move_code が落ちるのは意図された設計である」。同上。
  - `web/src/features/combo/components/VirtualController/VirtualController.tsx:283-285` — 「ここに並ぶ最大の族は、強度接尾辞を持たない必殺技である（seed 実測 291/330）。ファミリー UI に載らないのは…意図された設計であり、本サブはその規則を変えていない」。件数も規則も現行と違う（実測は 105/144）。
  - `web/src/features/combo/inputResolution.ts:200` — 「存在する強度のみ `byStrength` に入る」。`SpecialFamily.byStrength` は本サブで `byVariant` に置き換わり、フィールドとしては存在しない。
  - `web/src/features/combo/components/VirtualController/SpecialMovePanel.tsx:20-23` — ファイル冒頭の構造説明が「上段=技名、下段=強度」の 2 段のままで、中段の変種行と「強度なし通常版」が書かれていない。

  `moveSurfacing.ts` は本プロジェクトが「出し分けの唯一の正本」と定めたファイルであり、`M30-03` の担当が最初に読む場所である。テストも lint も型検査もこれを検出しないため、人が直す以外の経路が無い。`M30-03` は同じ関数の別枝を広げるサブであり、この注記を前提として読むと A2 の扱いを誤る。

- **高-2: `isOdVariantApplicable` が実在する OD 必殺技 31 件を弾く（設計準拠性以外の指摘 1）。**
  `code` の途中に `od` トークンを持つ状態版 OD（`flame_od_kachousen` 等）が対象外になり、着手時点にできた入力ができなくなっている。判定を「`_od` で終わる、または `_` で割ったトークンに `od` を含む」へ広げるか、少なくとも「A2 形の OD は当面対象外である」ことを godoc と完了報告に明記し、`followup-backlog.md` §J もしくは設計伝達レポート §4 へ残すこと。テストにも A2 形の OD を 1 件入れる。

- **高-3: インライン面で活性条件を回避できる（設計準拠性以外の指摘 2）。**
  `handleAdd` で `draftFlags` を追加時に濾すか、`draftMove` が変わった時点で非適用の OD フラグを落とす。テストは「OD 技で選ぶ → 通常技へ変える → 追加」の順序を通す 1 件を足すこと。

### 中（M31 着手と並行可）

- **中-1: `recipe-od-variant-section` を 2 面で割る（指摘 3）。** 現状は緑だが、両面をまたぐ spec を書いた瞬間に落ちる。`M30-03` が触る前に割っておくのが安い。
- **中-2: `VirtualController.test.tsx` の fixture id 重複を解消する（指摘 4）。** 新規追加分（`172`）だけでも別 id へ。既存の `13` / `15` は本サブの責任ではないが、同じ手番で直すなら記録を残すこと。
- **中-3: `progress-log.md` の索引行を追記する。** 指示書 §5-9 が完了条件に挙げており、現状 `check-progress-log-index.sh` が違反 1 件を出す。報告 §5-6 が「Phase D で追記する」と正しく未完で書いている点は評価できるが、完了条件としては未達のままである。
- **中-4: 完了報告 §2.2 の実測表を完了時点の値へ揃える。** 「変種マーカーで終わる必殺技ファミリーは 19 本」は着手時点の値である。完了時点は 22 本であり、表に 3 本が欠けている——`blanka/lightning_beast_electric_thunder_holding` ／ `cammy/razors_edge_slicer_holding` ／ `luke/aerial_flash_knuckle_holding`。この 3 本は基底が A1 であるため `P4M-016` と合流して初めて畳めるもので、報告本文は「畳んだ結果 18 本」の括弧内でその 3 本に触れているが、上の表と件数だけを読む後任は 19 → 18 と読み違える。結論の 18 本は独立に検証して正しい。`M-145`（実測の母集団）と同型のずれである。
- **中-5: 新設文言の扱いを揃える（指摘 5）。** `OD_VARIANT_SECTION_LEGEND` を locale へ寄せるか、コントローラ側の `odVariantsLegend` と同じ定数を共有する。少なくとも `OD_VARIANT_UNAVAILABLE_HINT` の en が無い点は記録すること。

### 低（将来対応）

- **低-1: `data-testid` の命名（指摘 6）。** `recipe-special-variant-max_holding` は規約上は `max-holding`。ただし変えることは契約変更であるため、変えるなら理由と一緒に。現時点では「規約から外れていることを記録に残す」で足りる。
- **低-2: `splitSpecialVariant` の後退経路を注記する（指摘 7）。**
- **低-3: import 順（指摘 8）。** ベースライン内の既存分。改善レーンでまとめて。
- **低-4: 完了報告 §6-6 の「新規 `data-testid` 6 種」と、列挙されている 7 種・末尾の「計 7 種」が食い違っている。** 登録依頼を受ける側が数で照合するため、数を合わせること。
- **低-5: ファミリー行の密度を設計卓へ申し送る候補がある。** `P4M-016` によりファミリーの総数が seed 全体で 254 → 342 に増え、`jamie` 21 ／ `akuma` 20 ／ `ingrid` 17 ／ `blanka` 17 が 3 列グリッドに並ぶ。とくに `jamie` は `the_devil_inside` ／ `_up2` ／ `_up3` ／ `_up4` ／ `_reach_drink_lv4` ほか 7 本が「魔身（酔い+N）」として横並びになる。`P4M-018` が畳んだのと同型の「軸に落とせる並び」であり、`SD-020` の目的（煩雑さを減らす）とは逆方向に効く面がある。開発者判断（案 A）どおりの実装であって違反ではないが、報告の §6 に候補として挙がっていない。

---

## 良かった点

- **契約の棚卸しを独立コミットにし、コードを 1 バイトも動かさなかった。** `b1c613e` は `docs/` のみ。指示書 §2.8-1 とチェックリスト A-3 をそのまま満たしている。
- **`data-testid` と aria 名を据え置いたうえで、据え置いたことを検査するテストを新設した。** `VirtualController.test.tsx` の「`M24-12` の入力の骨格に触れていない」1 件は、方向 9 種・攻撃 6 種の全数と aria 名 2 件を名指しで見ている。チェックリスト観点 1 が警戒した「spec と実装を同じ手で書き換えて両方間違っても緑」を、実装側の存在確認で塞いでいる。
- **aria 名が契約であることを自力で見つけて棚卸しへ足した。** §1.4 の「これは指示書が挙げていない契約である」は、指示書に書かれていない前提を実測で拾った例であり、そのまま `M30-03` の資産になる。
- **`SD-020` の 2 面を 1 コミットに収め、両面にテストを置いた。** 破壊確認 B が 2 面とも落ちることを示している。テスト本文を読んで、ダイアログ 1 件・インライン 2 件・単体 4 件の内訳まで裏が取れた。
- **テストの期待値を動かしたすべての箇所に「なぜ動いたか」を書いた。** `330 → 144` に `330 - 186 = 144` を添える、`95 → 0` に「素の版が合流したため」を添えるなど、`M-145` 型の「緑にするために合わせた」との区別が読み手側でつく形になっている。
- **逐語 (b) を直さず、直っていないことを E2E の陽性対照として残した。** 指示書 §2.2-2 と §4-5 の「原因が分かるまで直さない」を守ったうえで、記録が消えない形にしている。独立に走査したところ、この形は seed 全体で `terry/round_wave_heavy` 1 件しか無く、報告の断定は正確だった。
- **母集団を `moves` 側で数え、CSV と一致することまで確かめた。** `M-145` の取り違えを自分から名指しして回避している。CSV 側の 1024 / 186 / 105 は本レビューでも再現した。
- **`check-import-order` のベースラインを下げなかった判断が正しい。** スクリプト冒頭の注記（レーンごとに測って下げてはならない）に従っており、理由も §5-7 に書かれている。
- **報告に未実施を断定で書いていない。** `M30-01` が踏んだ `D-510` 型の再発が無い。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `make e2e` の全数は実走していない。本レビューで回したのは `make e2e-only P=m30-0` の 16 本のみ（16 passed）。完了報告の「285 passed」は追試していない。
- `moves` テーブルの実測値（総行 3026 ／ CSV との差 283 行）は追試していない。`category='special'` の部分集合 1024 / 186 / 105 は `character_data/*.csv` から独立に再現し、報告と一致した。
- `docs/handover/` 配下は索引（`docs-map.md`）と `followup-backlog.md` の該当 2 項目のみを参照した。`retrospective-log.md` は開いていない。
- 検査は HEAD（`e1b0a46`）で再実行した。`check-artifact-integrity` ／ `check-stop-discipline` ／ `check-doc-refs` ／ `check-browser-storage-keys` ／ `check-enum-sync` ／ `check-import-order` ／ `check-doc-inventory` ／ `check-md-emphasis`（完了報告）はすべて緑、`check-progress-log-index` のみ違反 1 件。`go test ./...` と `pnpm test` はいずれも緑。

---

## 取り込み結果（自動トリアージ）

**トリアージ実施日**: 2026-09-09 ／ **実施者**: 製造担当（`/implement_plan_full` Phase C）

**★★「高」指摘の不採用は 0 件である。** ⇒ 安全弁（開発者エスカレーション）の発動は無い。

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| **高-1** | 失効した記述がコードに残っている（5 箇所） | **採用** | 5 箇所すべて是正した。`moveSurfacing.ts` の冒頭注記と `isOnSpecialTab` の godoc は「A1 について規則が失効し、いま落ちるのは A2 だけである」と書き直した。`VirtualController.tsx` の未分類タブ注記は件数を 291/330 から 105/144 へ、`inputResolution.ts` は消えた `byStrength` を `byVariant` へ、`SpecialMovePanel.tsx` の冒頭は 2 段構成から 3 段構成（変種行・強度なし・OD の既定非表示）へ改めた。**★指摘のとおり `moveSurfacing.ts` は `M30-03` が最初に読む場所である** |
| **高-2** | `isOdVariantApplicable` が実在する OD 必殺技を弾く | **採用**。**★ただし件数は 31 ではなく 37 である** | 判定を「`_od` で終わる」から「`_` で割ったトークンに `od` を含む」へ広げた。**★自分で実測し直した**（`character_data/*.csv` 全 31 キャラ）: `special` かつ `od` トークンを持ち `_od` で終わらない行は **37**。**★偽陽性・巻き添えはゼロである** — `od` トークンを持つ `special` で `name_ja` に "OD" を含まない行 **0** ／ `_od` 終わりで "OD" を含まない行 **0** ／ `special` 以外で `od` トークンを持つ行 **0**。単体テストに A2 形 4 件と「`odyssey_light` は false」の対照を足し、E2E に `denjin_charge_od_hadoken` の陽性対照と `hadoken_light` の陰性対照を足した |
| **高-3** | インライン面で活性条件を回避できる | **採用** | `handleAdd` で `draftFlags` から OD 変種フラグを濾すようにした（`isOdVariantApplicable(draftMove)` が偽のとき）。**★「抑止するのは新規付与だけ」という方針は変わらない** — これは新規付与の経路である。回帰テストを 2 件足した（回避経路そのもの ＋ **「常時出す群は濾さない」対照**） |
| **中-1** | `recipe-od-variant-section` が 2 面で重複しうる | **採用** | `recipe-od-variant-section-inline` / `-dialog` へ割った。**★`M30-03` が触る前に割るのが安いという指摘に同意する** |
| **中-2** | テスト fixture の `moveId` 重複 | **採用（新規分のみ）** | 本サブが増やした `172` の重複を `173` へ解消した。**★既存の `13` / `15` は触っていない** — 本サブの差分ではなく、直すと本サブの diff に無関係な変更が混ざるため。記録としてここに残す |
| **中-3** | `progress-log.md` の索引行が未追記 | **採用** | Phase D で追記する（CLI の工程どおり）。**★完了報告 §5-6 が「Phase D で追記する」と未完で書いていた点は保つ** — 追記後に `check-progress-log-index.sh` の緑を確認してから実測へ書き直す |
| **中-4** | 完了報告 §2.2 の「19 本」が着手時点の値 | **採用** | 完了報告に 2 時点の表を置いた（着手時点の規則 19 本 ／ `P4M-016` 適用後 22 本）。**★増えた 3 本は基底が A1 であり `P4M-016` と合流して初めて畳めること**も明記した |
| **中-5** | 新設文言が i18n の外にある | **採用** | `OD_VARIANT_SECTION_LEGEND` を廃し、仮想コントローラ側と**同じキー** `controller.special.odVariantsLegend` を共有させた。ヒント文言は `controller.special.odVariantsUnavailable` を新設し **en も入れた**。**★副作用**: `ModifiersEditor.test.tsx` / `RecipeBuilder.test.tsx` が実 `ja.json` を読むようになり、info-mark のテスト 2 件がキー文字列ではなく本文を見る形へ変わった（両テストの注記も更新した） |
| **低-1** | `data-testid` の命名がケバブケースから外れる | **採用** | `recipe-special-variant-max_holding` → `max-holding`。**★本サブで新設した id であり、まだどこへも配布されていない。⇒ 規約へ合わせるなら今が唯一のタイミングである**（配布後は契約変更になる） |
| **低-2** | `splitSpecialVariant` の後退経路が未注記 | **採用** | 「最初に一致した接尾辞で基底が実在しなければ次の接尾辞へ進む」経路を godoc に明記した（現行 seed では発生しないことも併記） |
| **低-3** | import 順（既存分） | **不採用（記録のみ）** | `SpecialMovePanel.tsx` / `HitBoxLayout.tsx` の `react-i18next` は**着手時点からの持ち越し**であり、`check-import-order` のベースライン内である。**★本サブの差分に無関係な整形を混ぜない。⇒ 改善レーンでまとめて直す**（指摘者も同じ結論） |
| **低-4** | 完了報告 §6-6 の種数が食い違う | **採用** | 中-1 / 低-1 の反映後の実数へ揃えた（**8 種**） |
| **低-5** | ファミリー行の密度を設計卓へ申し送る候補 | **採用** | 完了報告 §6 へ 1 行足した（`P4M-016` によりファミリー総数 273 → 342、`jamie` 21 が最大。`SD-020` の目的と逆方向に効く面がある。**★開発者判断どおりの実装であり違反ではない**） |

### ★レビューの数字を 1 件訂正した

**高-2 の「31 件」は実測で 37 件であった。** 内訳は blanka 6 ／ mai 6 ／ lily 4 ／ m_bison 3 ／ cammy 3 ／ elena 3 ／ ingrid 3 ／ rashid 2 ／ ryu 2 ／ ken 2 ／ c_viper 1 ／ e_honda 1 ／ yasmine 1。**★指摘の中身（末尾だけを見ると実在する OD 必殺技を弾く）は完全に正しい。** 件数だけを訂正する。

### 再レビューの往復

**0 回**（初回のみ）。停止規律の上限（2 回）に達していない。
