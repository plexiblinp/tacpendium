# M14-03b レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03b-distribution-seed.md` **v2.3.0**（seed 契約 6 件・段階投入・派生技フラグ・RESEARCH-02 反映） |
| 対象指示書ID | M14-03b |
| レビューモデル | Sonnet 4.6（model-allocation v1.30.0。実使用は開発者判断） |
| バージョン | 2.3.0 |
| 作成者・作成日 | 設計担当 Claude（M14-03b/M17 期）/ 2026-07-09 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（M14-03 単一時）。 |
| 1.1.0 | 2026-06-30 | a/b 分割対応。 |
| 2.0.0 | 2026-07-09 | 指示書 v2.0.0（全面改訂）対応。seed 契約 6 件〔(a)〜(f)〕・段階投入・掃き取りマイグレ・dup スキャン・show_delta の観点を新設。旧 §1.3 recovery backfill（M14-03a 帰属時代）・§1.4 画面18 E2E（M14-03a 完了済）を撤去し、recovery は本サブ帰属（ryu 含む）として再定義。 |
| 2.1.0 | 2026-07-09 | 指示書 v2.1.0 追従。ryu recovery は NULL 残置・第一波は着手前確定・テリー CSV が一次サンプル。 |
| 2.3.0 | 2026-07-09 | 指示書 v2.3.0 追従（RESEARCH-02 反映）。移動 9 種 drop・recovery 単一値・**show_delta 4 キャラは新規 INSERT**（UPDATE でない・F-8 訂正）・**派生技フラグ `is_derived`＝非派生のみ索引・id タイブレーク**・第一波コア 5＋友人分オプション・ryu 再 seed は M14-03c 分離（本サブは触らない）・意図的除外の差分レポート。§1(e)/(f)・§9 を更新。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: 指示書 v2.0.0 全節、DES-003 §3.2/§3.3/§3.5/§3.9、DES-004 §2.1/§2.2/§2.3、m16-to-m17-handover §3、followup-backlog §C、code-facts §8/§9/§10、retrospective-digest §1-A/§5。
- **Plan Mode 着手前確認結果の確認（必須）**: 指示書 §3.3 の **10 項目すべて**に Plan Mode 質問書＋開発者回答が残っているか。とくに **7（将来の ryu recovery 投入時の total 整合方針）と 9（show_delta 表）は開発者承認の記録が必須**。未確認のまま実装した項目があればその時点で重大（§9＝推測実装）。

### 0.2 レビューの基本姿勢

- 本サブはデータ投入＋索引 IF 切り出し。**スキーマ・既存マイグレ・本体ランタイムを壊さない**こと、**取込経路を復活させていない**こと、**dev DB 残渣が配布物へ漏れていない**ことを重点確認する。
- **旧方針の混入に注意**: DES-002 §7.5・SUPP-001 §3.3.3 の「dash = modifiers.type」記述は M16-04 で失効済。実装がこれに従っていたら重大。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。

---

## 1. seed 契約 6 件の充足（最重要・指示書 §7.1）

- [ ] **(a)** 移動 system move 9 種（`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`・`category=system`）が **characters 全行**に投入され、`preset_aliases`（official_ja_move・`(preset_id, move_id)`）が**対で**投入されているか。ryu 既存行と重複していないか。
- [ ] **(b)** 掃き取りマイグレが**全キャラ dash seed マイグレより後の連番**にあり、modifier.type dash 残行ゼロが検証（テスト or マイグレ内検証）されているか。FK=OFF と明示 DELETE が同居していないか。down の限界が完了報告に明記されているか。
- [ ] **(c)** 変換系に dup スキャン（同一キャラ内 move_code 衝突・alias 衝突・`(preset_id,move_id)` 事前検出）があり、検出時に**生成 fail＋一覧報告**（自動リネーム・自動 skip なし）か。clean 配布 DB の全域再測定結果（M16-RESEARCH-01 と同軸）が完了報告にあるか。
- [ ] **(d)** category=target_combo の行が remap で**無改変通過**か（自動再分類・警告付与なし。テストで担保）。
- [ ] **(e)** show_delta 対象キャラは custom_states **未定義**（F-8）＝**状態定義の新規 INSERT＋show_delta**が**開発者承認値**で行われているか（UPDATE で済ませていないか＝定義が無いと UPDATE は無効）。第一波コアで対象は lily/kimberly。2 値 situation `{start_min,end}` の写像（旧スカラ→end）が DES-003 §3.2 どおりか。Ingrid＋対象キャラの実データ E2E が通過しているか。
- [ ] **(f)** 索引モジュールが独立 IF として切り出され、消費者が変換系のみ（本体ランタイム非経路・エンドポイント/UI 露出なし）か。**非派生技（`is_derived=false`）のみを索引化**しているか。`Lookup` が id 最小タイブレークの単一返却＋`LookupAll`（候補一覧）を持つか。command 空欄/未知トークン `raw{-}`/条件残留 `cond{…}` の行が索引非搭載＋記録（fail しない）か。IF 仕様が完了報告に明記され M17 の消費を塞がない形か。
- [ ] **移動 9 種 drop**: 手入力 CSV の category=system 移動 9 種を変換系で drop しているか（(a) 静的 seed が唯一の投入元）。drive_parry は通過か。
- [ ] **ryu 非改変**: 本サブが ryu の moves/combos に触れていないか（ryu 再 seed は M14-03c＝別サブ）。

## 2. マイグレ／seed の健全性

- [ ] 新規連番 **000024〜**で追加され、**既存マイグレ 000001〜000023 が非改変**か。
- [ ] FK 依存順（characters→moves→preset_aliases）で投入され FK 違反が出ないか。
- [ ] 冪等性・down 整合・`dbtest.Setup` 経由の全テスト通過。件数前提テストの追従が列挙どおりか。
- [ ] 大量 INSERT がテーブル単位で要約可能な構造（seed 行の手書き散在でなく生成物）か。ロスター非依存（31 化で機構不変・行追加のみ）か。
- [ ] **clean マイグレ由来 DB から構築**され、dev DB 残渣（幽霊 ken moves・偽 recovery/total・E2E rush）が混入していないか（確認方法と結果が報告にあるか）。

## 3. 温存対象の非破壊（重点）

- [ ] 全スキーマ不変（本サブは INSERT/UPDATE と索引 IF のみ）。
- [ ] 技編集（画面18・service/move・GET/PATCH /api/moves）・export/import（comboio）・recipe_hash 算出・`DuplicateKey` 本体が不変か。
- [ ] **本体ランタイムに取込経路を復活させていない**か（FR704 降格維持。索引モジュールの本体配下新設は指示書 §2.3.1 の許容範囲内＝ランタイム非消費か）。
- [ ] situation を opaque のまま扱っているか（DDL/DTO/BE 不変・dup/recipe 非対象）。

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7）

- [ ] 変換系単体（remap・total 欠落 NULL・raw_data 空→NULL・recovery・category・move_code 採番・target_combo passthrough・dup fail）がケース数で報告されているか。
- [ ] 索引モジュール単体（解決・未解決・重複検出）。
- [ ] seed マイグレ up/down・掃き取り（skip 行 fixture で残行ゼロ）・FK 順。
- [ ] E2E: Ingrid ①②③・4 キャラ def 反映・`combo-csv-io.spec.ts` clean DB 通過・`make e2e` 全体通過。

## 5. 設計意図との整合（精神の確認）

- [ ] 「配布 DB は手入力 seed をマイグレ経路で同梱」＝取込でなく seed マイグレか（`.db` embed へ逸脱していないか）。
- [ ] 「段階投入」＝インフラ＋確定第一波の投入で、**未投入キャラの網羅表**が完了報告にあるか（配布 blocker 解除＝全キャラ充足時点、との区別が明記されているか）。
- [ ] 「二度作らない」＝索引 IF が M17 G-k から再利用可能な形か（M17 要件の先行実装をしていないか＝スコープ超過も逆に問題）。
- [ ] dash の正典が DES-004 §2.1/§2.3（system move）で一貫し、§7.5/SUPP-001 §3.3.3 の失効記述に従った実装が無いか。

## 6. コード品質・規約遵守

- [ ] `move_code` が DES-004 §2.1 正準形（`_2` フォールバック含む）か。alias 文字列が ryu 既存 seed の表記と整合か。
- [ ] 禁則表現・簡体字・「起き攻け」誤字・「DR」略記の grep 除去。

## 7. 既存挙動の温存（非破壊性）

- [ ] 既存 ryu moves の total・フレーム値・recovery に**一切触れていない**か（ryu recovery は NULL 残置が仕様＝指示書 §4.4）。
- [ ] 既存テスト・既存 seed（ryu・presets・custom_states classic3/Ingrid）が壊れていないか。

## 8. ドキュメント・進捗ログ

- [ ] 完了報告に Plan Mode 確定方式（10 項目）・段階投入の残範囲・dup 再測定結果・索引 IF 仕様・掃き取り down の限界・M14 完了判定（配布 blocker 残状態）が含まれるか。
- [ ] DES 反映が要る点（索引モジュール正典化・§7.5/SUPP-001 失効記述の是正候補）が設計担当への伝達メモで申し送られているか（**製造が DES を直接編集していない**か）。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 10 項目（§3.3）のいずれかが未確認のまま実装されている（推測実装）。とくに 7・9 の開発者承認記録が無い。
- 既存マイグレ（000001〜000023）を改変している。スキーマを変更している。
- 本体ランタイムに取込経路を復活させている（FR704 降格違反）。索引モジュールを本体ランタイムが消費している。
- 移動 system move の alias 対が欠落している（生 code フォールバック発生）。
- 掃き取りマイグレが dash seed より前の連番にある、または残行ゼロ検証が無い。
- dup 検出非 0 で自動リネーム・自動 skip して投入した。
- dev DB 残渣が配布 seed に混入している（clean 構築の証跡が無い）。
- target_combo を自動再分類している（CHANGE-065 違反）。
- show_delta を開発者承認なしの推測値で投入した、または**未定義 state に UPDATE をかけて無効になっている**（新規 INSERT が要る・F-8）。
- 索引が派生技（`is_derived=true`）を載せている、or 非派生複数の順序が id タイブレークでない。
- 本サブが ryu の moves/combos を改変している（ryu 再 seed は M14-03c）。
- FK 依存順違反・`dbtest.Setup` 破壊・down 整合なし・FK=OFF×明示 DELETE 同居。

## 10. 軽微な問題の判定基準（持ち越し許容）

- 変換系・索引モジュールの配置・内部分割の細部。
- seed マイグレの分割数。
- 手入力未完による第一波の縮小（残範囲が明示されていれば許容）。※ryu recovery の NULL 残置は仕様（軽微ですらない）。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / 設計書 DES-00N（実パス）§Y に対し、実装が Z。意図確認したい」の形で根拠節を併記して設計担当へ。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の Plan Mode 着手前確認結果（10 項目・うち 7/9 は開発者承認付き）が揃っている。§10 軽微は持ち越し可。

---

*以上、M14-03b レビューチェックリスト v2.1.0。配置 `docs/instructions/reviews/M14-03b-review-checklist.md`。*
