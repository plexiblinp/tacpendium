# M18 指示書担当 引継ぎ書（→ 次セッション・M18-03 着手用）

| 項目 | 内容 |
|------|------|
| 版 | v1.0.0（2026-07-25） |
| 引継ぎ理由 | コンテキスト増大。**M18-03 は M18 最大のサブ**（materialize＋ダメージ規則＋重複防止＋採用画面＋curation＋手動入力＋export＋pruning 解除 UI）で、劣化した文脈で走ると M17 の轍（E-19・跨文書不整合）を踏むリスクが高い。**M18-02 クローズ＝クリーンな境界**で引き継ぐ |
| あなたの役割 | playbook §15.6【M18 指示書担当】。サブ設計の詰め・実装指示書/レビューチェックリスト作成・製造 Q&A 一次受け・完了報告一次受け・DES 反映要点抽出 |

---

## 0. まず読むもの（この順で）
1. 本引継ぎ書（全体像）。
2. `M18-overview.md`（**v0.1.8**・**M18 の正本**＝あなたがメンテ担当）。
3. `phase3-overview.md` §M18（上位正本）。
4. `design-instruction-playbook.md` §15.5〜15.7・§21・§4.15（並列運用・禁止事項）。
5. M18-03 該当の DES：DES-002 §4.2／DES-003（§3.4 combos・§3.15〜3.17 既存 3 表・combo_punish_starters）／DES-005（画面 5 マイコンボ・§5.4 ツリー・§5.7 始動技自動推定）／DES-006（FR301 dup・VAL-C02）／SUPP-001。
6. 開発者手交 spec draft（materialize 思想）。

---

## 1. 【厳守】並列運用の禁止事項（playbook §15.7）
- **CHANGE 番号・マイグレ連番を自採番しない**。使う直前に**中央へ請求**（開発者リレー・チャット間直接通信なし）。指示書には数字を書かず「中央払い出し」と書く（§4.15）。
- **DES・REQ 本体を直接改訂しない**（読むのは可）。改訂は「DES 反映要点」を完了報告にまとめ中央へ渡す（反映は中央が三点セットで）。
- **跨チャット版突合の禁止**。現行版の正本は常に中央。版に疑義があれば開発者経由で中央に確認。
- 質問は成果物末尾に「開発者への確認事項」として番号付きで集約（何を/なぜ/暫定案）。

---

## 2. 現行版マニフェスト（2026-07-25 時点・中央配布版を正とする）

| 資料 | 版 |
|------|----|
| REQ-001 | 2.17.0 |
| DES-001 / 002 / 003 / 004 / 005 / 006 / SUPP-001 | 1.4.0 / 1.34.0 / **1.33.0** / **1.15.0** / **2.48.0** / **1.21.0** / 1.27.0 |
| M18 物理設計プラン | **v0.6.0-plan** |
| M18-overview | **v0.1.8**（自分がメンテ） |
| 使用済み CHANGE | 078〜084（**次 085**） |
| 使用済みマイグレ | 〜000041（**次 000042**） |
| followup-backlog C-1 | `M14-03-is-projectile-backfill`／`M14-03-dash-total-backfill`（未 seed キャラの backfill 併走） |

> DES 反映は**実装後に中央**が行うため、M18-01/02 の CHANGE（078〜084）は**通知書は起票済だが DES 本体反映は中央作業**。DES-003 は v1.33.0（M18-01 反映済）だが、M18-02 分（combo_punish_starters・移動 total 注記）は**中央反映待ち**の可能性。着手時に中央へ現行版を確認。

---

## 3. これまでの到達点（M18-01・M18-02 完了）

### M18-01（スキーマ基盤）＝完了・E2E green
- 新表 3（`combo_punishes`／`combo_punish_prunings`〔マッチアップ単位〕／`combo_punish_curations`〔個別コンボ単位〕）・新列 2（`combos.materialized_from_combo_id`〔self-FK nullable〕／`moves.is_projectile`）・`hit_type` 4 値化（`just_parry_punish_counter` 追加・**FE ラベル「パニッシュカウンター(ジャストパリィ反撃)」**）。
- is_projectile 初期値＝**backfill 専用**（seedgen 非改変・is_derived 同型）。seeded-10 で 104 件。
- 成果物：`M18-01-schema-foundation.md` v0.2.3／`M18-01-review-checklist.md` v0.2.3／`M18-01-des-reflection-points.md`／`M18-01-lessons-learned.md`／`M18-01-visibility-check.md`。

### M18-02（確定反撃サーチ・探す）＝完了・受理確定（残ゲート＝E2E pin 一致再実行のみ）
- 新表 `combo_punish_starters`（self×相手技×始動技・verdict adopted/unreachable・**レーン非依存**）＝CHANGE-083（000040）。
- 移動 system move の `total` backfill 50 行（10 キャラ×5 code）＝CHANGE-084 v2（000041）。**移動の total は「全体フレーム」直接保持＝算出式の検算対象外**（付帯条件 1・DES-003 注記要）。
- 3 階層ツリー（相手技→始動技→コンボ）・3 レーン（その場/前方ステップ/ジャンプ経由）＋手動確認レーン（「自動判定できない相手技」）。
- 判定：有利＝ガード`-(on_block)`／JP`recovery`。ダッシュ＝`有利−dash全体≥4`。ジャンプ＝`有利≥jump全体−4`（`JUMP_SLACK=4`・経験則・verdict 分布で調整）。**ジャンプ判定はキャラの jump 全体（43 等）を使う（空中技自身の total ではない）**。
- 相手技除外：damage=0 完全除外／damage NULL・is_projectile・on_block NULL・recovery=0 は手動確認レーン／**移動 9 種＋is_aerial=1 は反撃対象外として完全除外**（§1-1 追加）。
- 空中技抽出：`is_aerial=1`（主）AND 接頭辞（補助）の二重担保（**E-21＝実データで確定**）。
- 新規登録導線：`/combos/new` へキャラのみプリフィル（P1）・登録後は確定反撃サーチへ戻す。
- 成果物：`M18-02-punish-search.md` v1.0.1／`M18-02-review-checklist.md` v1.0.1／`M18-02-des-reflection-points.md` v1.1.0／`M18-02-approval-request.md`／`M18-02-blocker-report.md`／`M18-02-RESEARCH-01-dash-frames.md`／`M18-02-design-outline.md` v0.9.0。

---

## 4. M18-03 のスコープ（overview §2.1 f〜k・§3）

**採用確定反撃画面（使う・2 階層＝相手技→コンボ。始動技はコンボ行の属性表示に留める）** ＋ materialize ＋ マイリスト（curation/note）＋ 手動入力（ジャストパリィ始動）＋ export 整合。**新スキーマは追加しない見込み**（要と判明したら着手前に中央経由で個別承認＝委任 §6）。

### 4.1 materialize 生成規則（開発者確定 2026-07-02・spec draft・**設計の核心**）
- 確定反撃版はオンデマンドで**別コンボとして materialize**（出自＝`materialized_from_combo_id` に基底コンボ参照・全自動生成しない・生成後は独立フォーク）。
- **ダメージ規則**：
  - 生成元ノーマルヒット → **始動技ダメージにのみ 1.2 倍**（合計に「始動技ダメージ×0.2」を加算。**コンボ全体を 1.2 倍にしない**）＋ヒット区分を**パニッシュカウンター**にして別登録。
  - 生成元カウンターヒット → **ダメージ不変で区分のみ変更**。
  - 生成後編集可。ジャストパリィ始動＝**手入力**（`just_parry_punish_counter`）。
- **重複防止（FR301）**：生成前に「同一レシピ＋ヒット区分＝パニッシュカウンター」の既存コンボを探索しあれば生成しない。**dup キーは実コード（`DuplicateKey` 6 項＝CharacterID/StarterMoveID/Position/OpponentStance/HitType/OpponentSize＋`CalcRecipeHash`）で先に引く**（M17-E19 の轍＝既存 VAL 未確認で矛盾を書く、を踏まない）。テスト軸を決める前に code-facts＋実コードで確定。

### 4.2 M18-03 に相乗りが確定した項目（開発者 2026-07-25）
- **pruning 解除・再表示 UI（「隠した相手技」一覧）**＝§3-1。解除 API（`DELETE /api/combo-punish-prunings`）は実装済。**pruning/curation を「隠したもの管理」として 1 箇所に集約**。片道操作に逆導線がない現状を解消する。

### 4.3 export 整合（E-17）
materialize コンボも export 対象＝出力正典（DES-005 §5.13＝A4 固定・縮小フィット下限 70%・メディア link のみ）に従う。**DoD に開発者の実出力目視**を入れる（E-17）。

---

## 5. M18-03 へ持ち越す設計課題・確認事項

1. **【M18-02 小追補】neutral ジャンプ強Kを確定反撃候補に含める（案C・開発者 2026-07-25 決定）**：抽出を `category=normal AND code に "jumping_heavy_" を含む` へ緩める（`neutral_jumping_heavy_kick` を拾う）。判定式・レーンは現行ジャンプ経由と同一（jump 全体同値・SLACK 同じ）。**新スキーマ/新データ不要**。unique 系空中特殊技 8 件は除外維持。→ **M18-02 のコード小修正**（punishfinder の抽出述語）。M18-03 着手時に同一ブランチで拾うか、独立の小追補にするかは中央/開発者と相談。DES 反映要点にも記載。
2. **【M18-03 で設計】自動判定できない相手技への既登録確定反撃の表示**（M18-02 §3-2）：手動確認レーンの相手技配下に、登録済み `combo_punishes` を（フレーム判定を経ず）表示する導線。
3. **【要実測・M18-03 着手時】自技の startup NULL の silent 脱落**（M18-02 §3-5）：相手技側は「消さず手動確認レーンに出す」を徹底したが、自技側は `startup IS NULL` で静かに脱落（設計思想の非対称）。`is_aerial=0 AND damage>0 AND startup IS NULL` の件数を実測し、多ければ自技側にも「データ不足」表示を検討。
4. **【将来・需要待ち】レーン別採否**（M18-02 §1-2）：`combo_punish_starters` に `lane` 列追加＋UNIQUE 拡張のスキーマ変更。verdict 分布で需要が実データ確認できてから起票（早すぎる一般化を避ける）。
5. **採用画面の 2 階層と探す画面の 3 階層の一貫性**：E-20「上から下へ 1 本の動線」（探す→登録→使う）を M18-03 で通し設計。M18-03 着手時に E-14 突合（M18-02 が触った `internal/service/punishfinder/`・`web/src/features/punish/`・combo_punish_starters リポジトリ・punish 系 endpoint × M18-03 改造対象）。

---

## 6. 適用すべき教訓（retrospective-digest・E-21/E-22 は M18 で採番）
- **E-21（L-1）**：「既存 X と同型」と書くなら、X の**実機序を実コードで 1 回引く**。書いた後に検証ではなく、書く前に。
- **E-22（L-2）**：**新列/新値を参照する SQL・seed・backfill は、その列を追加するマイグレより後に実行されるか**を連番で確認。既存マイグレ（改変不可）から新列を参照しない。golden/スナップショット等の**出力固定資産**も E-14 の突合対象に含める。
- **E-24**：集計値・投入値には「何を・単位・**基準時点・一次源**」を書く（M18-02 で addendum の 97→104 陳腐化、全 CSV 109→122 で実証）。
- **E-16/E-18**：件数は数えた対象・単位・母数を併記し検算。
- **silent に消さない**：M18 の設計思想の核。除外は「消す」でなく「理由バッジ付きで別レーンに出す」。§5-3 の自技側非対称はこの思想に照らして要検討。
- **Plan Mode（Opus 4.8＋Plan 必須）**：着手前実査で設計前提が覆ることが M18-01/02 で 2 回起きた（seedgen 実行順序／空中技接頭辞）。§3.3 に「何を・どう実査し・不一致時どうするか」まで具体的に書く。

---

## 7. 中央への確認手順（着手時）
1. M18-03 サブ設計を詰め、**新スキーマ要否を最初に判定**（要なら承認ゲート＝中央経由で開発者承認を先に取る）。
2. マイグレ連番・CHANGE 番号は使う直前に中央へ請求（次 085／000042）。
3. DES 現行版に疑義があれば中央へ確認（特に DES-003 の M18-02 分反映状況）。
4. 実装指示書ドラフトは委任の初回同様、必要なら中央レビューを挟む。

---

## 8. 生成済み成果物一覧（`/mnt/user-data/outputs/`）
- M18-overview.md（v0.1.8・**正本**）
- M18-01-schema-foundation.md / M18-01-review-checklist.md / M18-01-des-reflection-points.md / M18-01-lessons-learned.md / M18-01-visibility-check.md
- M18-02-punish-search.md / M18-02-review-checklist.md / M18-02-des-reflection-points.md（v1.1.0）/ M18-02-approval-request.md / M18-02-blocker-report.md / M18-02-RESEARCH-01-dash-frames.md / M18-02-design-outline.md
- **M18-02-des-reflection-points.md v1.1.0 が M18-02 の最新の中央リレー用**（§3-6 の neutral ジャンプ含む）。

---

*以上、引継ぎ書 v1.0.0。M18-01/02 はクローズ、M18-03 は未着手。最初の一手＝M18-03 のスコープ確定と新スキーマ要否の判定（§4.1 materialize・§4.2 pruning 解除 UI 相乗り）。*
