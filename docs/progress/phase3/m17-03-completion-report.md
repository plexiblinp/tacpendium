# M17-03 完了報告(製造)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M17-03-stage2-ui.md` v1.0.0(段階2 UI=仮想コントローラの方向入力拡張＋解決表の消費) |
| 作業環境 | ブランチ `feature/m17-03`(/implement_plan_full による一気通貫実行) |
| 実装モデル | Opus 4.8(Plan Mode 承認済み) |
| 作成日 | 2026-07-16 |
| 関連 | レビュー報告書 `docs/progress/phase3/m17-03-review.md`(Phase B で生成) |

---

## 1. Plan Mode 確定事項(指示書 §3.3 の 8 項目)

1. **【核】入力面の形(開発者判断)**: **案A = 3×3 テンキーパッド**を開発者が選択・承認(AskUserQuestion で 3 案を UI モック付き提示 → 案A 採用)。判断の経緯は §2 参照。
2. **キー構築**: `方向テンキー数字(1-9)+ボタン名(LP/MP/HP/LK/MK/HK)`、ニュートラル(5)は数字なし。migrations/000035 の実 seed キー(`'6HP'`/`'2MP'`/`'LP'` 等)と一致確認、E2E で実レスポンス経由の解決(前+強P → 鳩尾砕き)まで実データ検証済み。
3. **段階1 フォールバック**: 9→3 縮約(7/8/9→jumping / 1/2/3→crouching / 4/5/6→standing)して既存 `resolveStage1MoveId` を呼ぶ。**`inputResolution.ts`(段階1)は diff ゼロ(不変)**。
4. **解決表の取得**: queryKey `["command-index", characterId]`(flat tuple+number=code-facts/architecture-patterns §1.1 規約)、staleTime 5 分(moves と同じ)、キャラ切替は queryKey 変化で自動再取得。invalidate は当初「move_commands を変える FE mutation は存在しない」ため不要と判断したが、**レビュー指摘(中)で穴を検出**: 解決表は BE が fold 時に `moves.is_aerial`/category も読むため、`useUpdateMove`(isAerial を PATCH 可)の成功時に `["command-index", characterId]` を invalidate するよう修正済み(`useGenerateRushVariant` は生成行が `is_derived=true`=索引対象外のため不要のまま)。
5. **既存タブの温存**: 変更ファイルは VirtualController.tsx(state+フック)と HitBoxLayout.tsx(通常技タブ)のみ。特殊技/必殺技/SA/システム行/全技プルダウンは不変(E2E 非回帰確認)。
6. **【要判断】ニュートラルの非対称(§4.5)**: **`5X` 単独形キーは実測 0 件**(`grep -cE "'5(LP|MP|HP|LK|MK|HK)'" migrations/000035_seed_move_commands.up.sql` → 0。`5` を含むキーは投げの `5/6LP+LK` 形 11 件のみ=段階2 形状パターン `^[1-9]?(LP|MP|HP|LK|MK|HK)$` 外で解決表に載らない)→ **現状維持・BE 非改変**(指示書の指示どおり)。
7. **修飾情報・ラッシュ版との整合**: 段階2 は moveId+moveCode を確定するだけで出口(`addResolvedMove` → `StepInput`)は不変=修飾情報入力は従来どおり。ラッシュトグルは段階2 確定 code にも `rush_<確定技>` を既存 `resolveRushByCode` で解決(§3.3-7。例: 6MP=鎖骨割り+rush ON → rush_collarbone_breaker)。上系(7/8/9)は rush 時無効(現行 up 無効の一般化)。
8. **i18n**: 仮想コントローラの UI 文字列は全てハードコード日本語(現行流儀)であり、新ラベルも同流儀で追加 → **ja/en キーは足していない**(parity テスト非該当・通過)。

## 2. 入力面の最終形と判断の経緯(§3.3-1)

- **提示 3 案**: 案A=3×3 テンキーパッド(推奨)/案B=現行 3 ゾーン+前後モディファイア行/案C=9 方向横並びチップ。各案の UI モック・長所短所(縦幅 vs 方向の空間対応・状態合成の複雑さ・スマホ幅成立性)を添えて開発者へ提示。
- **開発者判断**: **案A 採用**。理由=9 方向がそのまま token_key の方向部になり FE が規則を持たずに済む・斜め下(ガードしながらの入力)が 1 タップ・テンキー記法(6HP 等)と空間対応が一致・段階1 とはゾーン縮約 1 段で接続・既存 `grid grid-cols-3` の行が 1→3 になるだけでスマホ幅でも成立。
- **実装詳細**: 行順は見た目どおり 7 8 9 / 4 5 6 / 1 2 3。1P 側(右向き)基準で 6(前)=右列。左右反転(2P 側)は現行流儀どおり非対応。主ラベルは日本語(後ジャンプ/ジャンプ/前ジャンプ/後ろ/立ち/前/下後ろ/しゃがみ/下前=**仮文言・確定は開発者**)、副ラベルにテンキー数字。矢印記号は M15-03 指摘6 の経緯(記号除去)により不使用。5/2/8 の aria(ニュートラル/下/上)は既存値を維持。

## 3. 変更点(成果物)

- **新規** `web/src/features/combo/inputResolutionStage2.ts`: 段階2 純関数。`NumpadDirection`(1-9)/`buildTokenKey`(ニュートラルは数字なし)/`contractToZone`(9→3 縮約)/`resolveDirectionalInput`(**一様フォールバック**=解決表→段階1、方向で経路分岐なし。entries ヒットだが moves に code 不在の不整合時も段階1 へ縮退)/`resolveDirectionalRushInput`(上系 null、確定 code に rush_ 解決)。**正規化・特殊技優先・タイブレークは未実装**(BE 畳み済みの表を `entries[key]` で引くだけ)。
- **修正** `web/src/features/moves/types.ts`: `CommandIndexResponse` 追加。
- **修正** `web/src/features/moves/api.ts`: `useCommandIndex` 追加(§1-4 のとおり)。
- **修正** `VirtualController.tsx`: `useCommandIndex(characterId)` を内部で呼ぶ(消費者 2 箇所=RecipeBuilder/SetupRecipeEditor は無変更で自動受益)。zone state(3 値)→ direction state(1-9、初期 5)。取得失敗・取得中は module 定数 `EMPTY_ENTRIES`=段階1 のみで動く(壊れない)。
- **修正** `HitBoxLayout.tsx`: ZONES(3 件)→ DIRECTIONS(9 件)。testId `recipe-zone-{neutral|down|up}` → `recipe-dir-{1..9}`。resolve を一様フォールバック関数へ差し替え。ラッシュトグル・攻撃ボタン 6 個・枠は不変。
- **テスト**: 新規 `inputResolutionStage2.test.ts`(17 ケース)。`VirtualController.test.tsx` を QueryClientProvider 化(setQueryData 注入)+段階2 5 ケース追加(計 17)。`RecipeBuilder.test.tsx` は render ラッパー 1 つで provider 化(アサーション不変)。**`inputResolution.test.ts` は無修正**(段階1 不変の証跡)。
- **E2E**: 新規 `web/e2e/m17-03-stage2-input.spec.ts`(3 テスト)。`m15-03-recipe-input.spec.ts` は testId 追従 1 行のみ。

## 4. テスト結果

- **Vitest**: 103 ファイル 718 テスト全通過(段階2 新規 17+VC 追加 5 を含む)。
- **E2E**(`make e2e`): **全 green**(全 25 件・新規 3 件含む。製造時実行では `m14-03b` が 1 回 flaky〔キャラ一覧 API の初回 res.ok false〕→ retry で吸収=既知の稀 flaky 想定内・exit 0。レビュー時再実行では 25 件ストレート passed)。
  - ryu: 前(6)+強P → 鳩尾砕き/前(6)+中P → 鎖骨割り(単方向特殊技)/立ち(5)+中P → 立ち中P(ジャンプ攻撃が奪っていない)/しゃがみ(2)+中P → しゃがみ中P。
  - lily: 下(2)+強P → **しゃがみ強P**(グレートスピン〔`is_aerial=1`・migrations/000026 L430〕が出ないことを明示アサート)。
  - c_viper(未 seed): パッド描画・方向クリック・攻撃ボタン非活性で画面が壊れない。既存タブ群健在。
- **禁則 grep**: 簡体字・「起き攻け」・「DR」略記=違反 0 件(新ラベルは「ラッシュ版」既存文言を踏襲)。

## 5. DES 反映要点(DES-005 §6.4 の CHANGE 用・製造は DES を直接編集していない)

- §6.4 の通常技入力方式を更新: 「方向ゾーン(立ち `5`/しゃがみ `2`/ジャンプ `8`)× 6 ボタン」→「**方向パッド(テンキー配列 3×3・`1`〜`9`・1P 右向き基準)× 6 ボタン**。解決は一様フォールバック(解決表 `GET /api/characters/{id}/command-index` を先に引き、ミスなら 9→3 ゾーン縮約で段階1 の構造引き=DES-004 §2.4.5)」。
- ラッシュトグルの記述に追記: ON で上系方向(`7`/`8`/`9`)無効。段階2 確定技(単方向特殊技)にも `rush_<確定技>` が働く(データ駆動非活性)。
- 解決表の取得タイミング(キャラ選択時 1 回・TanStack Query `["command-index", characterId]`・空/失敗時は段階1 のみ=壊れない)を §6.4 の実装注記として追加。
- testId の正: 方向ボタンは `recipe-dir-{1..9}`(旧 `recipe-zone-*` は廃止)。
- CHANGE 番号は起票時に registry で採番(次 070 見込み)。

## 6. 残課題・申し送り

- **方向パッドのラベル文言は仮**(後ジャンプ/下後ろ 等)。確定は開発者(指示書 §9.2)。
- `5X` 形キーは現 seed 0 件だが、**将来 seed に入ると FE から永久に引けない**構造は残存(BE 正規化 `n`→`5` と FE 契約「数字なし」の非対称)。seed 投入工程(precheck_seed_data 等)での検知は設計担当の判断待ち(指示書 §11-2 のとおり実測 0 件につき本サブでは現状維持)。
- SetupRecipeEditor(セットプレイ編集)でも段階2 が自動で有効化された(同一 VirtualController 消費のため)。E2E 全体で非回帰確認済み。

---

*以上、M17-03 完了報告。*
