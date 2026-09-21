# M14-03e 設計伝達レポート（第三波 seed・code 品質実地判定）

| 項目 | 内容 |
|---|---|
| 対象 | **親チャット（設計卓）** |
| 発信 | 製造担当 Codex / 2026-08-01 |
| 指示書 | `docs/instructions/M14-03e-third-wave-code-quality.md` **v1.2.0** |
| CHANGE / マイグレ | CHANGE なし（スキーマ変更ゼロ） / **000053〜000059** |
| 実装コミット | ブランチ `wt/m14-03e`。実装・テストは **未コミット**（`implement_plan_full_wt` の運用）。基点 `0c207bf`、実装コミット 0 |
| 関連 | `docs/progress/m14-03e-completion-report.md` / `docs/progress/m14-03e-review.md` |
| 作成条件 | **実装直後の同一セッション内で生成**。ユーザー裁定と独立レビューの自動トリアージを反映済み |

本レポートは **①製造が独自に確定した実装仕様 ②契約・設計に反する独自判断 ③製造判断 ④設計担当が未把握の残課題** に絞る。指示書どおりの投入内容は割愛する。

**最重要は §4-1。** `chain_cancel_total` の第三波 16 行は列未着地のため正しく見送れたが、後続投入の正本と生成方式が M14-03e 指示書と CHANGE-091 で一致していない。値を入れる前に親チャットの裁定が要る。

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### 1-1 `move_code` は少なくとも 50 文字まで長さ上限なしで扱える

Jamie に 40 字超が 7 件あり、最長は `drink_level_4_ransui_haze_3_drink_while_retreating` の 50 字だった。次の全経路で欠損・切詰め・レイアウト破壊が無いことを確認した。

- DB: `moves.code` は `TEXT NOT NULL` で長さ制約なし。
- seedgen / migration: CSV の値を再採番せず生成し、clean DB へ同値投入。
- API / CSV: Go・JSON・CSV は `string` として保持し、上限制約なし。
- 画面18: Table の横スクロール領域に収まり、alias 表示と編集が成立（`web/e2e/m14-03e-third-wave-seed.spec.ts:62-101`）。
- 固定テスト: `TestThirdWave_MoveCodeQualityMeasurements` が Jamie の最長 50 字・40 字超 7 件を固定（`internal/seedgen/generate_m1403e_test.go:114-153`）。

**製造判定は「実害なし＝許容」**。以降の波では正準形・dup 検査は継続するが、40 字超だけを理由に短縮・停止しない。

⇒ **DES-004 §2.1 の正準形説明に、現行契約は長さ上限を設けず、過長時は表示側の overflow / truncate で扱う旨を明文化してほしい。**

### 1-2 並行 worktree 内でマイグレ番号に穴があっても `golang-migrate` は適用できる

本 worktree の既存終端は 000048 だったが、並行レーンとの衝突回避としてユーザーから **000053 開始**の指定を受けた。clean DB の migration test で **000048→000053→000059** が成功し、down / re-up も成立した（`TestRun_M1403e_UpContract` / `TestRun_M1403e_DownRestoresPreState`）。

これは「番号の穴が engine 上許容されるか未確認」という M14-03e 指示書冒頭の懸念に対する実測結果である。ただし、最終統合で同一 version が重複してよいという意味ではない。000049〜000052 は並行レーンの着地で埋まる前提で、重複 version の回避は引き続き必要。

⇒ **並行運用資料に「branch 単体の欠番は `golang-migrate` で適用可能。統合時の version 重複禁止は別契約」と分けて明文化してほしい。**

### 1-3 過去マイルストーンの migration test は `HEAD` でなく自身の終端 version に固定する

第三波追加後、M14-03d のテストが `m.Up()` で未来の第三波まで読み込み、「manon だけが増える」という自身の契約を誤って失敗させた。M14-03d の終端 **v48** へ固定し、down / re-up も v48 を明示する形へ是正した（`internal/infra/migration/migrate_m1403d_test.go:59-64`, `:189-215`, `:226-269`）。

第三波自身も終端を **v59** に固定した。これにより、後続波が追加されても第三波の契約テストが未来のseedを自身の成果として数えない。

⇒ **SUPP-001 §5.5 または seed 波の指示書テンプレートに「歴史的マイグレーション契約テストは自身の終端 version を明示し、HEAD を使わない」を追加してほしい。**

---

## §2 契約・設計に反する独自判断（★親の裁定が要る）

なし。Plan 表示の省略と 000053 開始は、いずれもユーザーの明示的なタスク指示に従ったものであり、製造の独自判断ではない。

---

## §3 製造の判断

### 3-1 開発者へ確認して確定した点

| # | 論点 | 確定内容 | 根拠 |
|---|---|---|---|
| 1 | Plan gate | 過去の同型投入実績があり、ブロッカーが無ければ Plan 表示を省略可。13 項目の内部実査は省略せず、ブロッカー 0 で実装へ進んだ | ユーザー指示 / 完了報告 §1 |
| 2 | マイグレ連番 | 並行レーンとの衝突回避のため **000053 から使用** | ユーザー指示 |
| 3 | 投入範囲 | m_bison / rashid / jamie / luke / marisa / jp の **6 / 6**。縮小なし | ユーザー指示・CSV 実査 |
| 4 | 移動 `total` | 6 キャラの実測値を受領し、5 code × 6 キャラ＝30 行を 000059 で投入 | ユーザー提供・2026-08-01 |

### 3-2 推測で進めた点（指示書 §9.2 の許容範囲）

| # | 項目 | 採った判断 |
|---|---|---|
| 1 | マイグレ分割 | **7 本**。characters / 移動 9 種 / moves+alias / derived / commands / projectile / 移動 total を 000053〜000059 に分離 |
| 2 | `is_projectile` backfill | 第三波 31 行を 1 migration に集約し、キャラ別 UPDATE で一次源 CSV の true 群を明示 |
| 3 | seed canary の追従 | 第三波で増えた jump 候補を実データから再計測し、legacy 37 / 案C 39 / unique 空中 16 に固定（`internal/service/punishfinder/service_test.go:373-390`） |

---

## §4 設計担当が未把握の残課題・申し送り

### 4-1【最重要】`chain_cancel_total` 16 行の正本・生成方式が並行資料間で不一致

本 worktree には `moves.chain_cancel_total` 列が無く、指示書 §4.5 の条件どおり第三波 16 行を見送った（`internal/infra/migration/migrate_m1403e_test.go:35-42`）。列着地後の投入対象 code は完了報告 §6.2 に固定済み。

ただし、後続投入方式は次の 2 契約が一致していない。

| 源泉 | 値の正本 | 生成方式 |
|---|---|---|
| M14-03e 指示書 v1.2.0 §4.5 | `character_data/chain-cancel-measurements.md` | 手書き UPDATE migration。CSV へ転記しない |
| CHANGE-091 v1.1.0 §2.2〜§2.4 | `character_data/*.csv` の新 3 列 | seedgen 新モードで人手 backfill migration を生成 |

M19-04 の migration は 000049〜000052 側に入り、第三波 characters は 000053 で後から作られる。このため、M19-04 内で第三波 16 行を UPDATE しても親行不在でサイレント no-op になる。**統合後の 000059 より後に新規 migration が必須**である。

⇒ 親チャットで次を裁定してほしい。

1. 第三波 16 行の正本を measurement Markdown と CSV のどちらへ統一するか。
2. 手書き UPDATE と seedgen 新モードのどちらを採るか。
3. M19-04 着地後、000059 より後の新規連番で件数 16 を固定する担当サブを割り当てる。

### 4-2【解消済み】第三波の移動 5 code `total` 30 行

m_bison / rashid / jamie / luke / marisa / jp の `dash_forward` / `dash_back` / jump 3 code は、開発者提供の実測値を一次源として 000059 で 30 行を backfill した。値と提供日はマイグレーションの provenance コメントおよび完了報告 §6.1 に記録した。

`TestRun_M1403e_UpContract` がキャラ・code 別の値を固定し、`TestRun_M1403e_MovementTotalBackfillDownReup` が v58 への down で 30 行の NULL 復元、v59 への re-up で 30 行の復帰を固定する。後続対応なし。

### 4-3 配布 blocker は継続

seed 済みは **17 / 30**、残り **13 キャラ**。c_viper / dhalsim は攻撃技 0 の仮登録であり最終波候補。全 30 キャラ充足まで配布 blocker を解除しない。

### 4-4 E2E の並列 SQLite flake は継続観察が必要

全 70 tests では失敗箇所が実行ごとに移動し、今回 spec は green。最終的に残った 2 tests は `--workers=1` の単独直列で 2 / 2 PASS したため本波の回帰ではない。followup `e2e-flaky-isolation` の症状が継続している。

---

## §5 参考（触れていない＝不変の証跡）

- **スキーマ非改変**: 000053〜000059 は INSERT / UPDATE / DELETE のみ。DDL なし。
- **変換規則非改変**: `go run ./cmd/seedgen -check` PASS。既存 000026 は byte-identical。新規 000055〜000057 も 1 stem : 1 golden（`internal/seedgen/generate_m1403e_test.go:36-69`）。
- **索引器非改変**: `internal/moveindex` に変更なし。索引非搭載 252 行は derived 250＋JP の意図的 empty command 2 に全数説明可能（同 `:72-102`）。
- **他キャラ非波及**: `TestRun_M1403e_OtherCharsUnaffected` が v48 の既存 13 キャラの `(moves, alias)` を before/after 比較（`internal/infra/migration/migrate_m1403e_test.go:205-233`）。
- **down / re-up**: v48 復帰、FK check、再 up 625 moves を固定（同 `:235-272`）。
- **公式英語名誤りの非流入**: Luke は `no_chaser_od` あり・誤った `chaser_od` なし（`internal/seedgen/generate_m1403e_test.go:104-111`）。
- **DES / CHANGE 本体**: 直接編集なし。

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

本サブ自体は CHANGE 起票なし。以下は設計・後続作業への反映依頼。

- [ ] **§1-1**: DES-004 §2.1 に `move_code` の長さ上限なしと表示側の扱いを追記するか裁定
- [ ] **§1-2**: 並行運用資料へ「branch 欠番の許容」と「統合時 version 重複禁止」の分離を反映
- [ ] **§1-3**: migration contract test の終端 version 固定を SUPP-001 / seed 波テンプレートへ反映
- [ ] **§4-1**: M14-03e §4.5 と CHANGE-091 §2.2〜§2.4 の正本・生成方式を統一
- [ ] **§4-1**: M19-04 統合後、第三波 `chain_cancel_total` 16 行を 000059 より後の新規 migration で投入
- [x] **§4-2**: 第三波の移動 5 code 実測値を受領し、000059 で 30 行を backfill
- [ ] **§4-3**: 残り 13 キャラの seed 波を編成し、c_viper / dhalsim を最終波で扱う

**マイグレ連番について**: 本サブは **000053〜000059 の 7 本**を消費した。通常の「次の空き番号」ではなく、並行レーンとの調整によりユーザーが **000053 開始を明示指定**した。着手時の本 worktree は 000048 終端だったため 000049〜000052 は局所的に空いていたが、clean migration で欠番適用可能を実証済み。最終統合時は並行レーンの 000049〜000052 と重複がないことを確認する。

**CHANGE 番号は起票時に registry で採番する。**

---

## §7 教訓（retrospective 行き）

> **本節は親チャットが読む必要はない。** 宛先は反映係（Codex）で、retrospective-log へのバッチ反映対象。

1. **並行 worktree の migration 採番は「branch 単体の欠番可否」と「統合時の version 一意性」を分けて検証する。** 採番調整だけで止めず、branch 単体の clean up/down と統合時の重複検査を別ゲートにする。
2. **歴史的 migration test が `Up()` で HEAD を読むと、後続 seed を自分の成果として数えて壊れる。** マイルストーン契約は自身の終端 version を絶対指定し、HEAD test は現行配布状態の専用 test に限る。
3. **ローリング正本は代表行だけ更新すると内部矛盾が残る。** 完了時は同一スラッグの本文・状態・訂正注記・網羅表をまとめて検索し、全箇所を同じ実績へ更新する。今回、独立レビューがこの不整合を検出した。
4. **seed 母数を canary に持つテストは「数字だけ更新」しない。** 増分となった実データ集合を列挙・再測定し、テスト名には母数を埋め込まない。
