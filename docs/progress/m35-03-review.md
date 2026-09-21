# M35-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M35-03-rush-original-move-code-typo.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M35-03-review-checklist.md` v1.0.0（`D-816`） |
| 対象完了報告 | `docs/progress/M35-03-completion-report.md` |
| 着手基点 | `23b8a08` ／ レビュー時 HEAD `5812603` |
| 実施日 | 2026-09-11 |

---

## 総評

是正そのものは高い水準で仕上がっている。`M35-02` との壊れ方の違いを最初に切り分け、軸 A と軸 B を別々の道具で数えて集合として突き合わせ、さらに「片方を壊すともう片方が動かない」ことまで機械で裏づけている。マイグレ `000111` は新規 DB で全文が 0 行に当たる型であり、往復テストが唯一の証拠になることを正しく理解して書かれている。`character_id` の破壊確認が最初に空振りし、守っていたのが `000074` の backfill だったと特定して主張を置き直した §9.1 は、規約 (10′) の教科書的な適用である。

レビュアー側でも独立に実測した。`go test ./internal/infra/migration/`（73.6s・ok）、`./internal/seedgen/`、`./internal/aliasindex/`、`./internal/service/setplay/` はいずれも緑、`go run ./cmd/seedgen -check` は exit 0、`check-migration-license.sh` は違反なし、`check-artifact-integrity.sh` は違反なし、完了報告の `check-md-emphasis.sh` は 0 行である。`git diff --numstat 23b8a08` の新規 4 本はいずれも deletions 0 であり、上書き消失（`E-225`）は起きていない。

残す指摘は実装の欠陥ではなく、ほぼすべてが記録面である。**是正の結果として失効した記述がコード内とドキュメントに残っており、しかもそれを回収する経路（設計伝達レポート）が本手番では動かないことになっている。** 本プロジェクトではこの型を「高」として扱う。あわせて、本サブが実際に直した利用者影響がもう 1 件あり（保存が 400 で弾かれる経路）、それが指示書にも followup 行にも完了報告にも記録されていない。

---

## 設計準拠性レビュー結果

### 束 A — 既存 DB が直ることの証拠

| # | 評価 | 所見 |
|---|---|---|
| A-1 | ◎ | 両経路が別のテストで示されている。新規 DB は `TestRun_M3503_FreshDBIsAlreadyCorrectBeforeTerminus`（`versionBefore(t, 111)` 時点で既に是正後）、既存 DB は `TestRun_M3503_DownUpRoundTrip`（down で是正前を作り re-up で復帰）。**「新規 DB は seed で埋まるのでテストは緑のまま通りうる」という本チェックリスト最大の関心事に、往復で正面から答えている。** 破壊確認 4 / 5（backfill と INSERT を無効化）で「状態テストは緑のまま・往復だけが赤」を実測しているのも正しい |
| A-2 | ◎ | 是正前 0 行の実測（完了報告 §2.5）と是正後 1 行ずつが対で示されている。`migrate_m3503_test.go` と `migrate_m2002_test.go` の双方が **件数ではなく値まで**（`DR > 4MK` / `DR > 4HP` / `DR > 6HP` / `DR > 4HK`）固定している。レビュー側で CSV の `command` 列を独立に読み、`l k_m` → `4MK` ／ `l p_h` → `4HP` ／ `r plus p_h` → `6HP` ／ `l plus k_h` → `4HK` と一致することを確認した |
| A-3 | ◎ | 対照 `zangief/rush_power_stomps_1hits` は `assertControlM3503` が v111・down 後・re-up 後の 3 点で `DR > 22MK` 固定。CSV の `d d plus k_m` と整合 |
| A-4 | ◎ | `TestRun_M3503_SetplayTargetsGainTheFour` が本番の `setplay.ProjectCandidates` 経由で「是正前は入らない／v111 で入る」を対で固定。規則を二重に持っていない。`TestService_RushTargetRequiresResolvedOriginal` は `OriginalMoveID` 以外が 1 つも違わない 2 本を並べており、差の原因を `service.go:144` に閉じ込めている。単一種別と全種別の両方を見ている点も適切 |

### 束 B — 2 つの軸を混ぜていないか

| # | 評価 | 所見 |
|---|---|---|
| B-1 | ◎ | 完了報告 §2.4 が `A ∖ B = 4` / `A ∩ B = 0` / `B ∖ A = 4` を明示。**件数の一致が同一性の証拠にならないことを、集合として示したうえで「交わらないのは構造である」まで踏み込んでいる。** 走査は `M35-02` の `awk` を捨て、参照先の実在を直接問う式へ替えている。軸 B は実装関数 `isOnUniqueTab` / `surfaceBuckets` そのもので数えており規約 (11″) に適合。破壊確認 7（`move_code` を 1 件変えると軸 B が 4 → 5、軸 A は 0 件のまま）が機械照合になっている |
| B-2 | ◎ | `alex` 2 ／ `jamie` 1 ／ `zangief` 1 に差分は無い。`moveSurfacing.roster.test.ts` の変更は 8 行すべてコメントであり、`rush_variant: 4` の期待値は動いていない |
| B-3 | ◎ | CSV 差分は 4 行 4 セルのみ。`git diff` で確認し、`move_code` 列に変更が無いことを確認した。完了報告 §3 の逆置換照合も妥当 |

### 束 C — golden `000026` と規約 (16)

| # | 評価 | 所見 |
|---|---|---|
| C-1 | ◎ | 完了報告 §2.7 に `grep` の手順と結果がある。**さらに価値があるのは「連番の `grep` では足りなかった」という発見である**——`rules_m1905_test.go` は `000026` という文字列を 1 度も持たないが `original_move_id` に依存して必ず動く。弁別に効いたのは `grep original_move_id` ＋ 終端の突き合わせであった。ただしこの知見の落とし先が確保されていない（下記「中」#4） |
| C-2 | ◎ | (a) 触ったのは `000026` / `000072` / `000073` の再生成で必ず動くものだけで、`migrate_m1403c_test.go`（`000030` の版）には無差分。(b) `m2002RushNoOriginal` を削除せず `m2002RushLateResolved` へ入れ替え、要素数 4 のまま主張を「別名 0 行」から「別名が値まで一致」へ強めている。加えて `original_move_id IS NULL` が 0 行であることを母数付きで足しており、**主張の本数は増えている**。(c) 再生成の前後それぞれの赤が §7.1 / §7.2 に貼られている。(d) 見出しコメントは役割で書き直されている |
| C-3 | ◎ | `000026` の差分は 3 キャラの `CASE` 4 行のみで行の増減なし。他の seed golden はファイル全体無差分。`go run ./cmd/seedgen -check` が exit 0、`TestGolden_*MatchesRegeneration` 群も緑であることをレビュー側で再実行して確認した |

### 束 D — マイグレの層と `preset_aliases` の `INSERT`

| # | 評価 | 所見 |
|---|---|---|
| D-1 | ◎ | `000111_data_correct_rush_original_move_refs.{up,down}.sql`。`check-migration-license.sh` を再実行し違反なし・層 B・`CC-BY-SA-4.0` を確認。`_data_` を外す破壊確認も §9-1 に記録あり |
| D-2 | ◎ | `000111` は `D-812` の払い出しどおり。自採番なし |
| D-3 | ◎ | `INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)` で `m.character_id` を入れている。**さらに評価できるのは、この主張が最初は空振りしていたことを自分で見つけた点である**（§9.1）。`v111` まで上げるだけでは `000074` の backfill が代わりに守るため列を落としても緑になる。`down` → `re-up` の経路へ主張を置き直し、`assertCorrectedM3503` にも `character_id == moves.character_id` を足して二重に見ている |
| D-4 | ◎ | `down` に `DELETE` がある。`preset_id` を `numeric` / `srk` に絞って `official_ja_move` を巻き添えにせず、その主張が `DownUpRoundTrip` にテストとして入っている。`(move_id, alias_text)` まで指定して「up が入れた行だけを戻す」意図を SQL の形で残しているのも良い |

### 束 E — 共通

| # | 評価 | 所見 |
|---|---|---|
| E-1 | △ | **生成器の実装は無差分だが、`internal/seedgen/` には差分がある**（`generate_m2002_golden_test.go`・+13 / -4）。完了報告 §11 の「`internal/seedgen/` の差分は 0 である（完了条件 11）」は、同報告 §7.3 の追随 5 ファイル表および実 diff と矛盾する。下記「中」#3 |
| E-2 | ○ | `check-import-order.sh` を再実行。「現在 99 / ベースライン 101・違反なし」でベースラインどおり。本サブは import 行を足していない。ベースライン引き下げを別手番へ送る判断は妥当 |
| E-3 | ◎ | `check-md-emphasis.sh docs/progress/M35-03-completion-report.md` をレビュー側で再実行し検出 0 行・exit 0 |
| E-4 | × | **`progress-log.md` への索引行が未追記。** `check-progress-log-index.sh` を実行すると `NG 作業 ID m35-03 が docs/progress/progress-log.md に現れない` / 違反 1 件。完了報告は Phase D へ送っているが、現時点では完了条件 13 が未達である。下記「中」#2 |
| E-5 | ◎ | `lily.csv` の `name_ja` は `デザートストーム(ラッシュ)` のまま。`D-305` / `D-809` どおり |
| E-6 | ○ | `000111.up` の `alias_text_en` を書かない判断に `-- 推測: 生成器の層 C-rush は alias_text_en を出力しないため、それに合わせた。` がある。根拠（`000075` の部分索引は `alias_text_en IS NOT NULL` の行だけを見る）まで添えてあり適切。形式は `CLAUDE.md` §9-3 の「推測:〜と仮定した」に対して「推測:〜に合わせた」だが、意図は満たしている |

---

## 設計準拠性以外の指摘事項

### 1. 失効した記述がコード内に残っている（高）

`internal/seedgen/generate_m2002.go:634-638`。

```
// ★元技が CSV に実在するかを確かめる。実在しない場合は当てない(D-305)。
// 実データには original_move_code が glowing_touch_1 のように実体
// (glowing_touch_1hits)と食い違う入力ミスが 4 件あり、DB 側では
// original_move_id が NULL になっている。⇒ 推測で元技を当てない。
```

本サブの着地でこの 4 件は 0 件になった。ガード自体は残すべきだが、**「4 件あり」「NULL になっている」は現在形の事実の記述であり、いま読むと誤りである。** 完了報告 §12-6 はこれを認識しているが、完了条件 11（`internal/seedgen/` の差分 0）を理由に触らず設計卓へ返している。判断としては筋が通っているが、返した先が動いていない（次項）。

同型の失効が次の 2 か所にもある。いずれも製造の手番では直せない面である。

- `docs/design/04-notation-spec.md:342`（`dangling 参照であり…4 件` の注記）
- `docs/handover/followup-backlog.md:328`（`rush-original-move-code-typo` の状態が `未着手`）

### 2. 失効記述の回収先が本手番で確保されていない。★重複 followup 行が 1 本見落とされている（高）

完了報告 §12 は 4 / 5 / 6 を「設計伝達レポート §4 で請求する」としているが、**同じ §12-7 が「開発者の判断で本手番では `/design_handover_report` を回さない」と書いている。** したがって現時点で、失効 3 件はどこにも請求が立っていない。`CLAUDE.md` §10.Y のとおり `followup-backlog.md` §J は製造が直接書ける唯一の面であり、少なくともここへ 1 行（ID・発生元・未解消の理由・再開に必要な条件・記録日）を残せば回収経路が保たれる。**現状は「完了報告の §12 表にだけ書いてある」状態であり、後任が完了報告を開かない限り誰にも届かない。**

あわせて、回収対象の列挙が 1 本足りない。

- `docs/handover/followup-backlog.md:344` の **`rush-variant-dangling-original-move-code`** が、`:328` と同じ 4 件を指す**重複行**として存在し、状態は `未割付` / `未着手` のままである。完了報告 §12-5 は `:328` しか挙げていない。片方だけ畳むと、残った方を読んだ後任が同じ調査をやり直す。**`:344` は本文で「実害の有無を確かめてから直す」と書いており、本サブがまさにその答えを出した行である。**
- 派生として `docs/handover/m21-to-m22-handover.md:187` にも同スラッグの「調査が先」の行があるが、こちらは歴史的な引継ぎ資料であり据え置きで構わない。

### 3. 直った利用者影響がもう 1 件あり、記録されていない（中）

完了報告 §1 は実害を 2 件（セットプレイ候補からの脱落 ／ 別名 0 行）としており、同じ記述が `000111.up` のヘッダと `migrate_m3503_test.go` の冒頭コメントにも複写されている。しかし **`VAL-C12` の経路がもう 1 件ある。**

- `internal/service/validation/combo.go:483-508` の `validateC12RushVariantOriginal` は、レシピ中に `rush_variant` があるとき `FindOriginalMoveID` が `nil` を返したら `AddError`（Error severity）する。
- `internal/service/combo/deps_adapter.go:60-74` は `original_move_id` が NULL のとき `(nil, nil)` を返す。
- `internal/service/combo/service.go:368` が `result.HasError()` でトランザクションを巻き戻し、ハンドラが 400 を返す。

**軸 A の 4 件は入力面に出ている**（完了報告 §2.3 の実測。`isOnUniqueTab=true`）。つまり是正前は、`ingrid` / `lily` / `mai` の利用者がこの 4 技を編集画面で選べたのに、保存すると `ラッシュ版 move id=N に対応する元技が見つかりません` で 400 になった。**3 件のうち唯一、利用者にエラーとして見えていた経路である。**

本サブはこれも同時に直しているので追加の実装は不要だが、次の 2 点を求めたい。

- 完了報告 §1 の「実害は 2 つ」と、`000111.up` ヘッダ ／ `migrate_m3503_test.go` の同記述を 3 件へ改める（記録の正確性。後任はここを写す）
- 対の主張を 1 本置けるなら置く。`internal/service/validation/combo_test.go` に `OriginalMoveID` が NULL の `rush_variant` で `CodeC12RushVariantOriginal` が立つ／解けていれば立たない、という対のテストがあれば、`service.go:144` 側と同じ形で床になる（実装は正しいので、守るのはデータ側の前提である）

### 4. `§2.7` の申し送りが宙に浮いている（中）

完了報告 §2.7 は「弁別に効いた道具は `grep original_move_id` ＋ 終端の突き合わせであった（設計卓への申し送り＝§12）」と書いているが、**§12 の表に該当する行が無い**（1 CHANGE 番号 ／ 2 マイグレ連番 ／ 3 版を上げた文書 ／ 4 `DES-004` 注記 ／ 5 followup 状態 ／ 6 seedgen コメント ／ 7 設計伝達レポート の 7 行のみ）。

これは体裁の問題ではない。`SUPP-001` §5.5.4 規約 (16) の末尾は「golden を再生成する前に、その版を終端にしている契約テストを `grep` で探すこと」とだけ書いており、**本サブは「連番の `grep` では取りこぼす」という反証を実地で得た最初の事例である**（`CHANGE-178` が初めて実効した手番でもある）。落とすと、次の担当が同じ取りこぼしを踏む。§12 へ 1 行として足すか、`followup-backlog` §J へ残すこと。

### 5. `progress-log.md` への索引行が未追記（中）

再掲。`bash scripts/check-progress-log-index.sh` が違反 1 件を返す。`CLAUDE.md` §8 は「サブ完了時の追記は必須」としており、指示書の完了条件 13 でもある。Phase D で回す計画は理解したが、**レビュー時点では未達であり、M35 完了前に必ず入れること。**

### 6. `itoaM3503` は標準ライブラリの再実装（低）

`internal/infra/migration/migrate_m3503_test.go:397-407`。`strconv.FormatUint(uint64(v), 10)`（あるいは `strconv.Itoa(int(v))`）で済む。`CLAUDE.md` §6 の「重複機能は導入しない」の精神からも、独自実装を置く理由が読み取れない。1 桁ずつ先頭へ `append` し直す実装でもあり、読み手に「何か特別な事情があるのか」と考えさせる。

### 7. `group_concat` に `ORDER BY` が無い（低）

`migrate_m3503_test.go:105`（`m3503Alias`）と `migrate_m2002_test.go` の同型のクエリ。2 行以上に当たったときに連結順が不定であり、**失敗メッセージが実行ごとに変わりうる。** 期待値が単一値なので判定自体は安定するが、`group_concat(pa.alias_text, '|' ORDER BY pa.alias_text)` にしておくと落ちたときの読み口が安定する。

### 8. `000111.up` の `NOT EXISTS` ガードは一意制約の片方しか見ていない（低）

ガードは `UNIQUE (preset_id, move_id)`（`000001`）に対応している。**`000075` が張るもう 1 本 `ux_preset_aliases_preset_char_alias` は `(preset_id, character_id, alias_text)` であり、こちらは見ていない。** 同一キャラ・同一プリセットに別の技が `DR > 4MK` 等を持っていれば `INSERT` が落ち、マイグレが中断する。

実害は現状ゼロと判断する。組み込みプリセットの別名は `internal/service/preset/service.go:374`（`VAL-P01` / `authorizeMutation`）で編集が拒否され、生成器側でも `dropCollisions` が同値を作らない（`collision` の実測値が不変であることで裏づけ済み）。**ただし「見ていない」ことは SQL からは読み取れない。** up のヘッダに 1 行「もう 1 本の UNIQUE には当たらない。理由は組み込みが編集不可であり、生成器が同一キャラ内の同値を落とすためである」と書いておくと、次に同型のマイグレを書く人がガードを写すときに判断できる。

### 9. `check-import-order.sh` のベースライン（低・申し送り）

「現在 99 / ベースライン 101」。本サブ由来ではなく、`M35-02` / `M31-04` も同じ申し送りをしている。共有スクリプトを並列レーンと同時に触らない判断は妥当。ただし**申し送りが 3 サブ続いており、誰も引き取っていない。** 改善レーンへ 1 行立てるのが筋である。

---

## 推奨修正（優先度別）

### 高（M35 完了前に修正必須）

1. **`internal/seedgen/generate_m2002.go:634-638` の失効コメントの扱いを決着させる。** ガードは残し、「入力ミスが 4 件あり…NULL になっている」を過去形（`M35-03` で 0 件になった旨）へ改めること。完了条件 11 の「`internal/seedgen/` の差分 0」と衝突するため、製造の独断で書き換えるのではなく、**開発者または設計卓の裁定を 1 往復で取る。** 差分 0 を維持するなら、代わりに (2) の記録が必須になる。
2. **失効記述 4 件の回収先を、この手番のうちに確保する。** 設計伝達レポートを回さない以上、`docs/handover/followup-backlog.md` §J 停止時記録へ必須 5 フィールドで 1 行残すこと（`CLAUDE.md` §10.Y は §J が製造の書ける唯一の面と定めている）。対象は次の 4 件。
   - `docs/design/04-notation-spec.md:342` の dangling 注記（CHANGE 候補）
   - `docs/handover/followup-backlog.md:328` の状態 `未着手`
   - **`docs/handover/followup-backlog.md:344` の重複行 `rush-variant-dangling-original-move-code`（完了報告 §12 に未記載）**
   - `internal/seedgen/generate_m2002.go:634-638` のコメント

### 中（M36 着手と並行可）

3. **実害の件数を 2 件から 3 件へ改める。** 完了報告 §1 ／ `000111.up` ヘッダ ／ `migrate_m3503_test.go` 冒頭の 3 か所。追加分は `VAL-C12` 経由で保存が 400 になっていた経路（本文 §3 参照）。可能なら `internal/service/validation/` に対のテストを 1 本。
4. **完了報告 §11 の「`internal/seedgen/` の差分は 0」を実態に合わせる。** 実際は `generate_m2002_golden_test.go` に差分がある（同報告 §7.3 の表とも矛盾）。「生成器の実装は無差分。テストは規約 (16) に基づき追随」と書き分け、**完了条件 11 の文言がテストを含むのかを設計卓へ確認事項として返す**（規約 (16) と正面から緊張する）。
5. **`progress-log.md` へ索引行を追記する**（完了条件 13・`check-progress-log-index.sh` が違反 1 件）。
6. **§2.7 の申し送りを §12 の行として立てる。** 規約 (16) の `grep` 手順は連番だけでは取りこぼす、という実地の反証は `SUPP-001` へ戻す価値がある。

### 低（将来対応）

7. `itoaM3503` を `strconv` へ置き換える。
8. `group_concat` に `ORDER BY` を付ける（2 か所）。
9. `000111.up` のヘッダへ「`ux_preset_aliases_preset_char_alias` には当たらない理由」を 1 行。
10. `check-import-order.sh` のベースライン 101 → 99 を引き取る手番を立てる（3 サブ連続の申し送り）。

---

## 良かった点

- **破壊確認 8 件と、そのうち 1 件が空振りしたことの自己申告（§9.1）。** `character_id` の主張は書かれていて緑で、レビューでも読める形をしていた。回して初めて「守っていたのは `000074` の backfill だった」と分かり、ガードと同じ層へ主張を置き直している。規約 (10′) の運用として模範的であり、**空振りを隠さず節を立てて書いたことの価値が大きい。**
- **2 軸を「別の道具で数えて集合で突き合わせ、さらに独立性を機械で裏づけた」こと。** `M35-02` が踏んだ形を避けるだけでなく、破壊確認 7 で「片方を壊してももう片方が動かない」ことまで示している。件数の一致に頼らない証明になっている。
- **規約 (16) の初適用で、指定された手順の穴を見つけたこと。** 連番 `grep` では `rules_m1905_test.go` が出てこない、という発見は本サブ固有ではなく一般に効く。
- **`versionBefore(t, 111)` の採用と、その理由の記述。** `109` 直書きなら `M31-05` マージ後に黙って他レーンの `down` まで走る、という説明が現場に残っている。
- **`down` の設計。** `official_ja_move` を巻き添えにしない絞りに加え、`000108` が持っていた「全降下で孤児行が残る」欠陥が本サブには当たらない理由（改名が無い）を明示し、沈黙させていない。
- **CSV 置換で `glowing_touch_1` が `glowing_touch_1hits` の接頭辞であることに気づき、セル単位でアンカーした上で逆置換照合まで回したこと。**
- **完了報告 §7.4 の自己申告。** 機械置換で `M14-03f` の履歴の算術まで書き換えてしまい、同じ手番で戻したことを残している。「機械置換は値と歴史の記述を区別しない」は再利用できる教訓である。
- **テストが件数ではなく値・`id` の同一性・母数付きの 0 件で固定されていること。** `NoDanglingRushRemains` と `migrate_m2002_test.go` に足した床は、5 件目の dangling が生まれたときに効く。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- レビュー側で再実行したのは `go test`（`internal/infra/migration` / `internal/seedgen` / `internal/aliasindex` / `internal/service/setplay`）・`go vet`・`go run ./cmd/seedgen -check`・`check-migration-license.sh`・`check-artifact-integrity.sh`・`check-import-order.sh`・`check-enum-sync.sh`・`check-progress-log-index.sh`・`check-md-emphasis.sh` である。`cd web && pnpm test` と `make e2e-only P=combo-crud` は再実行していない（完了報告の記録を採用した）。
- 本文 §3 の `VAL-C12` 経路は、`validation/combo.go` → `deps_adapter.go` → `service.go:368` → ハンドラ 400 の呼び出し連鎖をコードで追って導いた。**実機または追加テストでの再現は行っていない。**
- 不明: `000110` は本ツリーに存在しないため、`M31-05` マージ後に `versionBefore(t, 111)` が `110` を返す状態での挙動は、本レビューでは実測できない。テスト側の意図（直前の版だけを降ろす）は正しいと読めるが、マージ後の再実行が要る。

---

## 取り込み結果（自動トリアージ）

**実施日**: 2026-09-11 ／ 製造 CLI `/implement_plan_full` Phase C
**再レビュー往復**: 0 回（上限 2 回・未達）

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|---|---|---|---|
| 1 | **高** | `generate_m2002.go:634-638` の失効コメント | **★採用**（**2026-09-11 開発者裁定の後**） | **初回は保留した**——指示書 完了条件 11（`internal/seedgen/` の差分 0）／ §2.2-7 ／ §3-4 が明示的に禁じている面であり、製造の独断では書き換えられなかった（`CLAUDE.md` §8）。**★開発者が「修正してください」と裁定した**（2026-09-11）**ので是正した。** 現在形の事実記述を過去形へ改め、**いつ・誰が 0 件にしたかを対で書いた**（`D-775`）。**★ガードは残した**——`D-305` は 1 文字も変わっていない。**あわせて再発を検出する床 2 本を名指しした**（`rushNoOriginal: 0` ／ `v73` の母数付き 0 行） |
| 2 | **高** | 失効記述の回収先が立っていない ／ `followup-backlog.md:344` の重複行が §12 から漏れている | **採用** | 指摘のとおり。**設計伝達レポートを回さない以上、完了報告の表にだけ書いても後任が本報告を開かない限り誰にも届かない。** `docs/handover/followup-backlog.md` §J へ必須 5 フィールドつきで **3 行**を登録した（`m35-03-stale-records-after-dangling-fix` ／ `regulation-16-grep-by-sequence-misses-column-pinned-tests` ／ `import-order-baseline-101-vs-99`）。重複行 `:344` も回収対象へ入れ、完了報告 §12-10 として明記した |
| 3 | 中 | 実害がもう 1 件ある（`VAL-C12` 経由で保存が 400） | **採用** | **独立に検証して事実と確認した。** `combo.go:483-499` → `deps_adapter.go:60-74` → `service.go:368` の経路が実在する。記録を 3 か所（完了報告 §1 ／ `000111.up` ヘッダ ／ `migrate_m3503_test.go` 冒頭）で 2 件 → 3 件へ改めた。**あわせて対の床を新設した**——`TestC12_RushVariant_OriginalIDIsNull`。**★`origID == nil` の分岐は着手時点でテストが 1 本も通っていなかった**（既存 2 本は `ExistsForCharacter` 側）。破壊確認で赤になることも実測した |
| 4 | 中 | 完了報告 §11 の「`internal/seedgen/` の差分は 0」が §7.3 と矛盾 | **採用** | **事実の誤りであり訂正した。** 「生成器の実装は無差分」と「ディレクトリの差分は 0 ではない（規約 (16) の追随）」を書き分け、**完了条件 11 の文言の確定を設計卓へ返す**行を §12-8 として立てた |
| 5 | 中 | `progress-log.md` の索引行が未追記 | **採用** | Phase D で追記する（本 CLI の独立工程）。`check-progress-log-index.sh` の緑を確認する |
| 6 | 中 | §2.7 の申し送りが §12 に無い（宙に浮いている） | **採用** | §12-9 として立て、§J にも本文を置いた。**規約 (16) の `grep` 手順が連番では取りこぼす、という実地の反証**は `SUPP-001` へ戻す価値がある |
| 7 | 低 | `itoaM3503` は標準ライブラリの再実装 | **採用** | `strconv.FormatUint` へ置き換え、関数を削除した |
| 8 | 低 | `group_concat` に `ORDER BY` が無い | **採用** | 2 か所（`migrate_m3503_test.go` ／ `migrate_m2002_test.go`）へ `ORDER BY pa.alias_text` を足した |
| 9 | 低 | `000111.up` の `NOT EXISTS` は一意制約の片方しか見ていない | **採用** | up のヘッダへ「もう 1 本の `ux_preset_aliases_preset_char_alias` には当たらない理由」を (a) 組み込みは編集不可 (b) 生成器が同一キャラ内の同値を落とす、の 2 点で明記した。**★実装は変えていない**（現状その行は在り得ないため） |
| 10 | 低 | `check-import-order.sh` のベースライン 101 → 99 | **★不採用（記録して送る）** | **本サブ由来ではなく、共有スクリプトである。** 走行中の並列サブと同時に触ると衝突面が増える（`M35-02` ／ `M31-04` も同じ判断）。**★ただし「3 サブ連続で誰も引き取っていない」という指摘は正しい。⇒ §J へ `import-order-baseline-101-vs-99` として立て、改善レーンの手番を請求した。** 握り潰していない |

**「高」の不採用は 0 件。** #1 は不採用ではなく **開発者への裁定要求**（保留）であり、**2026-09-11 の裁定を受けて採用へ転じた。⇒ 高 2 件とも採用済みである。**

### ★エスカレーション（Phase C 安全弁）

**#1 は製造では決められない。** 指摘の内容には同意するが、**指示書が明示的に禁じている面**であり、
`CLAUDE.md` §8 の「設計書間の矛盾を発見した場合は独自判断で解釈を選ばない」に当たる。

- **何が衝突しているか**: 指示書 完了条件 11 ／ §2.2-7 ／ §3-4 は `internal/seedgen/` の差分 0 を求める。
  一方で `SUPP-001` §5.5.4 規約 (16) は同ディレクトリの版固定テストの追随を求め、**本サブは実際に追随させた。⇒ 字義どおりの「差分 0」は既に成立していない。**
- **求める裁定**: (a) `generate_m2002.go:634-638` のコメントを過去形へ直してよいか
  ／ (b) 直さないなら誰がいつ直すか ／ (c) 完了条件 11 は「生成器の実装」を指すのか
  「パッケージ全体」を指すのか。
- **保留中の回収先**: `followup-backlog.md` §J の `m35-03-stale-records-after-dangling-fix`
  （必須 5 フィールド記入済み）。

#### ★★裁定の結果（2026-09-11）

**開発者の裁定＝「修正してください」。** ⇒ (a) はコメントを直してよい。
**したがって (c) は「完了条件 11 は生成器の*振る舞い*を指す」と確定した**——
コメントの是正を指示した以上、同条件がパッケージ全体の byte 差分を意味しないことになる。
**(b) は消滅した**（誰がいつ直すかを決める必要が無くなった）。

**★本節は削除せずに残す。** 保留して裁定を取ったこと自体が規律の実績であり、
**次に同じ衝突（指示書の完了条件 vs 規約 (16)）を踏む担当が、経路をここから辿れる。**

是正した箇所は 2 か所。

| 箇所 | 何を直したか |
|---|---|
| `internal/seedgen/generate_m2002.go:635` 付近 | 「入力ミスが 4 件あり…NULL になっている」→ 過去形 ＋ `M35-03` が 0 件にした旨。**ガードを残す理由と、再発を検出する床 2 本を明示** |
| `internal/seedgen/generate_m2002_test.go:308` | 「`D-305` の 4 行と同型」が現存を含意していた。**参照だけを過去形へ**（フィクスチャ自体は規則を固定するもので、実データの有無に依らない） |

**★生成物は 1 バイトも動いていない**（実測）。`go run ./cmd/seedgen -check` が
`OK: 生成物は既存ファイルと一致` / exit 0 を返し、`git diff --stat -- migrations/` は空である。

### 取り込み後の検査

| 検査 | 結果 |
|---|---|
| `go test ./...` | **FAIL 0 件** |
| `cd web && pnpm test` | **2686 tests 緑** |
| `bash scripts/check-md-emphasis.sh`（完了報告 ／ 本報告書） | **0 行 ／ exit 0** |
| `bash scripts/check-stop-discipline.sh` | **違反なし**（§J の必須 5 フィールド） |
| `bash scripts/check-migration-license.sh` | **違反なし** |
| 追加した破壊確認 | `combo.go` の `origID == nil` 分岐を外すと `TestC12_RushVariant_OriginalIDIsNull` が赤 |
