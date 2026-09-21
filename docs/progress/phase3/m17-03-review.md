# M17-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | 指示書 `docs/instructions/phase3/M17-03-stage2-ui.md` v1.0.0 の製造成果物(feature/m17-03 直近 4 コミット: fefdc10 / e7655d2 / f9adf0a / 1e2af3a) |
| チェックリスト | `docs/instructions/phase3/reviews/M17-03-review-checklist.md` v1.0.0 |
| レビュー実施日 | 2026-07-16 |
| レビュー方式 | コード読取 + 読み取り系 Git + 検証実行(Vitest 全件 / tsc / Playwright E2E 全件。コード変更なし) |

## 総評

段階2 UI の核心要件(死守 3 契約・FE が規則を持たない・一様フォールバック・段階1/既存タブの温存・空 entries で壊れない・BE 非改変)はすべて満たされており、重大指摘(チェックリスト §9)はゼロ。純関数分離(`inputResolutionStage2.ts`)・テンキーキー構築のシンプルさ・データ不整合時の縮退設計など実装品質は高い。レビュー時に Vitest 718 件・E2E 25 件を実際に実行し全 green を確認した。指摘は「`useUpdateMove`(isAerial 編集)が `["command-index"]` を invalidate しない穴」(中)と、UX/ドキュメントの軽微数件のみ。M17-03 は完了承認可能と判断する。

## 設計準拠性レビュー結果

チェックリスト各節を ◎(完全準拠)/○(準拠・軽微指摘あり)/△(要修正)/×(重大)で評価する。

### §1 【最重要】死守 3 契約・スコープ — ◎

- **公式表記のみ**: `buildTokenKey` は単方向(テンキー 1〜9)+ボタンのみを組む。汚い入力・簡易入力の解釈経路は存在しない。
- **モーション解析なし**: 方向トークンの列・時間依存の実装なし。単体テストで `queryByText(/236|214|623/)` の不在を明示アサート。必殺技は 2 段直接指定のまま不変。
- **出口は必ず `move_code`**: `ResolvedInput { moveId, code }` → `addResolvedMove` → `StepInput { moveId, moveCode }`(`useControllerInput.ts` は無変更)。修飾情報入力・ラッシュ版トグルの後段経路も不変で、段階2 確定 code(例 `collarbone_breaker`)にも `rush_<code>` が既存 `resolveRushByCode` で働くことを単体テストで確認済み(§3.3-7)。
- **スコープ厳守**: FE が構築するキーは `[1-9]?(LP|MP|HP|LK|MK|HK)` 形のみで、投げ(`5/6LP+LK` 形)・溜め・一回転・モーション列のキーは構築不能=解決表に載っていても引かれない。BE 側も fold 時に `is_aerial`/category/形状で絞る(`internal/service/inputresolve/service.go` L91)ため二重に安全。

### §2 【最重要】FE が規則を持たない(二重実装の禁止) — ◎

- `resolveDirectionalInput` は `entries[buildTokenKey(...)]` を 1 回引くだけ。正規化・特殊技優先・id 最小タイブレークは FE に一切存在しない(`inputResolutionStage2.ts` 全 103 行を確認)。
- 単体テスト「FE は規則を持たない: 解決表が言う code にそのまま従う」が二重実装禁止の証跡として秀逸(moves に `crouching_medium_punch` があっても表が指す unique に従う)。
- **キー構築契約**: `方向数字＋LP/MP/HP/LK/MK/HK`・ニュートラルは数字なし。migrations/000035 の実キー(`'6HP'`/`'2MP'`/ニュートラルは `'MP'` 等の裸ボタン名)と一致することをレビュー側でも grep で独立確認した。E2E が実レスポンス経由の解決(前+強P→鳩尾砕き)まで検証している。

### §3 【最重要】一様フォールバック(DES-004 §2.4.5) — ◎

- 全方向が同一経路: (a) token_key 構築 → (b) 解決表 → (c) ミスなら `contractToZone` で 3 ゾーン縮約 → 段階1 構造引き → (d) 双方ミスは null(非活性)。方向ゾーンによる経路分岐は存在しない(`HitBoxLayout.tsx` の `resolve` も単一関数)。
- 縮約規則は仕様どおり(7/8/9→up=jumping / 1/2/3→down=crouching / 4/5/6→neutral=standing)。9 方向すべて単体テストで網羅。
- **段階1 不変**: `inputResolution.ts` は diff ゼロ、`inputResolution.test.ts` も無修正(不変の証跡)。
- 補足: entries ヒットだが moves に該当 code 不在(データ不整合)のとき段階1 へ縮退する拡張は、仕様未規定領域だが「壊れない」優先の妥当な防御でありコメント・テストも付されている(規則の二重実装ではない)。

### §4 入力面(§3.3-1・開発者判断) — ○

- 3×3 テンキーパッド(案A)は Plan Mode で 3 案比較の上、**開発者判断の記録あり**(完了報告 §1-1/§2。製造の独断ではない)。単方向(前/後)・斜め 4 種すべて入力可能。
- 1P 側(右向き)基準・左右反転非対応は現行流儀と整合(コード内・完了報告に明記)。
- スマホ幅: 既存の `grid grid-cols-3` の行数拡張(1→3 行)であり構造上は成立する見込みだが、実機の使い勝手(DES-005 §5.7)はコード上で判定不能 → 開発者の実機確認に委ねる(制約事項参照)。
- 軽微: 可視ラベルと aria の乖離(dir 8=可視「ジャンプ」/aria「上」等。既存テストセレクタ温存の意図的判断とコメントあり)。ラベル文言確定(開発者、指示書 §9.2)の際に合わせて整理を推奨(低)。

### §5 解決表の取得 — ○

- **キャラ選択時 1 回**: `useCommandIndex` は `queryKey: ["command-index", characterId]`(flat tuple=architecture-patterns §1.1 規約準拠)+ `staleTime` 5 分(moves と同値)。入力ごとの API 呼び出しはない。キャラ切替は queryKey 変化で自動再取得。
- **空 entries / 取得失敗**: `commandIndex?.entries ?? EMPTY_ENTRIES`(module 定数で参照安定化=Vitest 安定参照モックの既知教訓に整合)で段階1 のみ動作。c_viper の E2E で「画面が壊れない+攻撃ボタン非活性」を実データ検証。
- **指摘(中)**: invalidate 不要の判断(「move_commands を変える FE mutation は存在しない」)に穴がある。**解決表は BE が fold 時に `moves.is_aerial` を読む**(request 時 fold)ため、`useUpdateMove`(PATCH で `isAerial` 編集可)の成功後は畳み結果が変わり得るが、`["command-index", characterId]` は invalidate されない。staleTime 5 分以内に技編集グリッド→仮想コントローラと遷移した場合、空中化した技が段階2 で引けてしまう短い窓が残る(自己修復あり・影響軽微)。`useUpdateMove.onSuccess` への invalidate 1 行追加を推奨。
- 軽微: 指示書 §5.2/チェックリスト §5 は未 seed キャラ E2E に「c_viper/dhalsim」を挙げるが、実装は c_viper のみ(同一経路のため検証価値の差は小さい)(低)。

### §6 既存の温存(非回帰) — ◎

- 変更コンポーネントは `VirtualController.tsx`(state+フック)と `HitBoxLayout.tsx`(通常技タブ)のみ。`DirectSpecPanel` / `SpecialMovePanel` / `SystemRow` / `useControllerInput` / 全技プルダウン(RecipeBuilder 側)は diff ゼロ。
- **BE 非改変**: `git diff fc3e940..HEAD -- internal/ migrations/ cmd/ go.mod go.sum` が空であることを確認。スキーマ変更ゼロ。§4.5 は実測 0 件につき現状維持(指示書どおり BE を触っていない)。
- 段階1 は索引非依存のまま(c_viper E2E が実証)。

### §7 実データ検証(E2E) — ◎

レビュー側で E2E 全スイートを実行し **25 件全 passed** を確認(使い捨て DB スタック)。

- ryu: 前(6)+強P→鳩尾砕き / 前(6)+中P→鎖骨割り(単方向特殊技)/ 立ち(5)+中P→立ち中P(裸キー `MP`/`HP` は jumping 系と索引上衝突するが is_aerial 除外で standing が勝つことの実データ検証)/ しゃがみ(2)+中P→しゃがみ中P。✓
- lily: 下(2)+強P→しゃがみ強P、`グレートスピン` 非含有を明示アサート(索引には `great_spin`→`2HP` が実在し〔000035 L141〕、fold の is_aerial 除外が効いている実データ検証として適切)。✓
- 未 seed(c_viper): パッド描画・方向クリック・攻撃ボタン非活性・既存タブ健在。✓
- `236LP` 等のモーション入力 UI は不存在(単体テスト+コード確認)。✓
- 既存スイート(m15-03 レシピ入力・m12 系・m14-03b・m17-01/02 等)も全 green=非回帰。✓

### §8 コード品質・ドキュメント — ○

- 禁則 grep: 追加差分に簡体字・「起き攻け」誤字・「DR」略記の違反なし(完了報告中の「起き攻け」は規約引用であり除外対象、既往レポートと同じ扱い)。
- i18n: キー追加なし(仮想コントローラの現行流儀=ハードコード日本語を踏襲)。parity テスト非該当で妥当。
- 完了報告: Plan Mode 8 項目の確定記録(とくに §3.3-1 の開発者判断の経緯・§3.3-6 の `5X` 実測 0 件)・DES-005 §6.4 反映要点(CHANGE 用)を完備。DES 本体は未編集(diff で確認)。
- tsc(`pnpm run lint`)通過・Vitest 103 ファイル 718 件全 passed をレビュー側でも再現。
- 軽微: 完了報告 §4 の E2E 件数「24 passed」はレビュー実測では 25 passed(新規 3 件込み)。記載の軽微な計数差(低)。

**チェックリスト §12 判定**: §1〜§8 OK・§9 重大ゼロ・Plan Mode 8 項目(§3.3-1 は開発者判断記録付き)確認済み → **レビュー完了(承認相当)**。§10 軽微は持ち越し可。

## 設計準拠性以外の指摘事項

1. **(中・§5 と同件)`useUpdateMove` の invalidate 対象**: `web/src/features/moves/api.ts` の `useCommandIndex` コメント「invalidate 追加は不要: move_commands を変える FE mutation は存在しない」は、move_commands テーブルに対しては正しいが、**畳み済み解決表が `moves.is_aerial`(PATCH 編集可)にも依存する**点を見落としている。retrospective-digest §4(M4-03「新規 queryKey 追加時は既存 mutation の invalidate 要否を明示」)の趣旨からは、`useUpdateMove.onSuccess` に `["command-index", characterId]` の invalidate を足すか、少なくともコメントの根拠を「is_aerial 編集時は staleTime 内の短い不整合窓を許容する」と正確化すべき。
2. **(低)unique タブのラッシュトグルが方向リセットを通らない**: `VirtualController.tsx` の特殊技タブ側 Switch は `setRushOn((prev) => !prev)` 直呼びで、`handleRushToggle` の「上系(7/8/9)ならニュートラルへ戻す」補正を通らない。unique タブで rush ON → 通常技タブへ戻ると direction が 7/8/9 のまま(方向ボタン disabled+active・攻撃ボタン全非活性)になり得る。壊れはしない(別方向クリックで復帰)が挙動不統一。旧実装(zone="up")から連続する既存性質の一般化であり優先度は低い。
3. **(低)E2E spec コメントの不正確**: `m17-03-stage2-input.spec.ts` L90 の「c_viper は E2E 使い捨て DB では技 seed なし」は厳密には不正確(migrations/000025 で移動 system 技 9 種は全キャラ投入済み)。normal 技が無いため「弱パンチ非活性」のアサーション自体は正しい。
4. **(低)code-facts.md の陳腐化**: `HitBoxLayout` の Props(zone/onZoneChange→entries/direction/onDirectionChange)・新フック `useCommandIndex`・新 queryKey `["command-index", characterId]` が code-facts 未反映(自動生成資料のため製造の責ではない)。`/regen_code_facts` の実行を推奨。
5. コーディング規約(CLAUDE.md §4): JSON/DTO camelCase(`CommandIndexResponse` は BE DTO とミラー一致)・マジックストリング回避・TODO なし・`console.log` 追加なし、いずれも準拠。新規依存追加なし。

## 推奨修正(優先度別)

- **高(M17完了前に修正必須)**:
  - なし。
- **中(M18着手と並行可)**:
  - `useUpdateMove.onSuccess` に `["command-index", characterId]` の invalidate を追加(または `useCommandIndex` のコメントを「is_aerial 編集の staleTime 内不整合を許容」と正確化)。1 行程度の修正。
- **低(将来対応)**:
  - unique タブの Switch を `handleRushToggle` 相当(上系方向リセット付き)へ統一。
  - 方向ボタンの可視ラベル/aria の整合(ラベル文言確定〔開発者〕と同時に)。
  - dhalsim の未 seed E2E 追加(c_viper と同一経路のため任意)。
  - E2E spec L90 コメントの正確化(「normal 技 seed なし」)。完了報告の E2E 件数(24→25)の訂正。
  - `/regen_code_facts` 実行(次サブ着手前)。
  - `5X` 形キーの将来混入検知(seed 投入工程でのガード)は完了報告 §6 の申し送りどおり設計担当の判断待ち。

## 良かった点

- **純関数分離の徹底**: 段階2 ロジックを `inputResolutionStage2.ts` に副作用なしで切り出し、段階1(`inputResolution.ts`)は diff ゼロ・テストも無修正で「不変の証跡」を残した構成は模範的。
- **「FE は規則を持たない」の証跡テスト**: 「解決表が言う code にそのまま従う(特殊技優先を再実装しない証跡)」というテストケースは、レビュー観点(二重実装禁止)をテストとして固定化しており、将来の退行防止として価値が高い。
- **データ不整合への縮退設計**: entries ヒットだが moves に code 不在のケースを「壊れない優先」で段階1 へ縮退させ、コメント・テストまで揃えた防御は仕様の趣旨(200+空 entries=壊れない)をよく汲んでいる。
- **E2E の選球眼**: lily の `great_spin`(索引に実在する空中特殊技)を「出たら重大」の負のアサーションで固定した点、ryu の裸キー(`MP`)を「ジャンプ攻撃が奪っていない」検証に使った点は、実データの危険地帯を正確に突いている。
- **Plan Mode 運用**: 入力面の形を 3 案+UI モックで提示して開発者判断を仰ぎ、`5X` 実測(0 件)で止まらず進む/止まるの判断を指示書どおり実行。§4.5 の残存リスクを申し送りに明記した誠実な報告。
- **参照安定化の配慮**: `EMPTY_ENTRIES` module 定数によるレンダー毎の新オブジェクト回避は、過去の Vitest 無限ループ教訓を踏まえた丁寧な実装。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 補足: レビューの一環として Vitest 全件(718 passed)・`tsc --noEmit`・Playwright E2E 全件(25 passed、使い捨て DB スタック)を実行し通過を確認したが、スマホ実機での使い勝手(方向パッドのタップ精度・画面幅)と実ブラウザでの UX はコード上で判定できないため、開発者の実機確認を要する。
- BE(M17-02 成果物)の再レビューは対象外(非改変の確認のみ実施)。

---

## 取り込み結果(自動トリアージ)

/implement_plan_full Phase C による自動トリアージ(2026-07-16)。**優先度「高」の指摘は 0 件**のため開発者エスカレーションなし。

| # | 指摘 | 優先度 | 採否 | 理由・対応 |
|---|------|--------|------|-----------|
| 1 | `useUpdateMove` が `["command-index", characterId]` を invalidate しない | 中 | **採用** | 指摘どおり解決表は fold 時に `moves.is_aerial`/category を読むため invalidate 判断に穴があった。`useUpdateMove.onSuccess` に invalidate 1 行を追加し、`useCommandIndex` のコメントも根拠を正確化(retrospective-digest §4 M4-03 の趣旨に整合) |
| 2 | unique タブの Switch が `handleRushToggle`(上系方向リセット)を通らない | 低 | **採用** | 1 行修正で挙動不統一が解消し、M17-03 の新挙動(9 方向で direction が 7/8/9 のまま disabled+active になる)に直結するため取り込み。統一挙動の Vitest 1 ケースも追加 |
| 3 | 方向ボタンの可視ラベル/aria の乖離 | 低 | 持ち越し | ラベル文言の確定は開発者(指示書 §9.2)。aria 既存値の維持はテストセレクタ非破壊の意図的判断であり、文言確定時に併せて整理する |
| 4 | dhalsim の未 seed E2E 未実装(c_viper のみ) | 低 | 持ち越し | レビュー自身が認定するとおり c_viper と完全同一経路で検証価値の差が小さく、E2E 実行時間の増加に見合わない |
| 5 | E2E spec コメント「技 seed なし」の不正確 | 低 | **採用** | 「normal 技の seed なし(移動 system 技 9 種のみ=000025)」へ正確化 |
| 6 | 完了報告の E2E 件数 24 vs 実測 25 | 低 | **採用** | 全 25 件(製造時は 1 件 flaky→retry 吸収、レビュー時はストレート passed)へ訂正 |
| 7 | code-facts.md の陳腐化(`/regen_code_facts` 推奨) | 低 | **採用** | `scripts/generate-code-facts.sh` を実行し再生成(HitBoxLayout Props・useCommandIndex・command-index ルート・マイグレ 000029〜000035 の追補)。**スキル規約によりコミットは開発者に委ねる**(未ステージのまま) |
| 8 | `5X` 形キーの将来混入検知 | 低 | 持ち越し | 完了報告 §6 の申し送りどおり設計担当の判断待ち(seed 投入工程のガードは本サブのスコープ外) |

取り込み後の検証: Vitest(VirtualController 18 件含む対象スイート)passed・`tsc --noEmit` 通過。

---

*以上、M17-03 レビュー報告書。作成: レビュー担当 Claude(Opus 4.8)/ 2026-07-16。取り込み結果追記: 製造担当 / 同日。*
