# M12-05 レビューチェックリスト v1.0.0

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M12-05-seed-cleanup-and-movecode-unification.md` v1.0.0(seed 整理 + B-7 move_code 旧形→新形統一・案B。マイグレ + フロント + テスト fixture) |
| 対象指示書ID | M12-05 |
| レビューモデル | Sonnet 4.6 |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 本流スパイン・M12 担当)/ 2026-06-25 |
| 関連 CHANGE | **見込みなし**(seed/移行はデータ = DES 本体規定外、B-7 は正典 DES-004 §2.1 既新形)。着手前確認で DES 乖離が出た場合のみ起票 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-25 | 初版(指示書 v1.0.0 と対)。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備
- 必読: `M12-05-seed-cleanup-and-movecode-unification.md` v1.0.0、**`M12-RESEARCH-02-report.md`**、code-facts §10(000001 の FK 定義・000016 技法)・§1/§2、DES-003 §6/§7、DES-004 §2.1、followup-backlog §B-7、retrospective-digest §5。
- **前提ゲート**: (1) M12-04 完了 + M12-RESEARCH-02 完了。(2) Plan Mode §3.4 実態確認(旧形 code / 19 fixture / 36 件 / FK 順序 / down 戦略 / CHANGE 要否)が完了報告にあるか。(3) §10 設計判断どおりの実装か。

### 0.2 基本姿勢
- 機械チェック + 設計意図。**破壊的マイグレ + ロックステップの最高リスクサブ**。最重点 = (a) ajg 除去の網羅と FK/順序、(b) ryu code 新形化の orphan 不発生・aliases 不変、(c) `dbtest.Setup` 緑 + 19 fixture 追従、(d) DES 無改訂・製造が DES を直接編集していない。
- code-facts は参考。最終根拠は実コード・実 SQL。

### 0.3 報告フォーマット
- 各節「OK / 重大(§9)/ 軽微(§10)/ 質問(§11)」。

---

## 1. 着手前確認 + §10 設計判断の反映
- [ ] §3.4.1 旧形 code(A-2 対応表)と 19 fixture が HEAD で再確認され報告されているか。
- [ ] §3.4.2 マイグレ方式 = 案A(新規 000017)で、**down 戦略**(忠実復元 / 前方専用最小化)が Plan Mode で提示・確定されているか。
- [ ] §3.4.3 ajg 除去の **DELETE 対象・依存順**(combos→preset_aliases→moves→characters、FK=OFF・cascade 非連鎖)が報告どおりか。
- [ ] §3.4.5 CHANGE 要否の確認結果(DES-003 §6/§7・配布前提・REQ grep)が完了報告にあるか。
- [ ] §10 の 7 判断(方式 / ryu 手移行 / ajg 除去 / ken・dhalsim NULL 据え置き / fixture スコープ / 単一サブ / CHANGE なし)どおりに実装されているか。

## 2. ajg 除去(最重点)
- [ ] 新規 DB 構築後、aki/jamie/guile の **characters / moves / preset_aliases / combos が 0 件**(steps/setups/tags は CASCADE で連鎖削除)。
- [ ] ajg の **custom_states**(aki=poison / jamie=drunk_level / guile=NULL)が characters 行ごと消えている。
- [ ] DELETE が **依存順**で行われ、FK=OFF 環境で orphan(参照先を失った子行)を残していない。preset_aliases(対象 move 参照分)・moves が明示 DELETE されている(cascade に頼れない列のため)。
- [ ] **耐久 combos(000012 由来 36 件)が 0 件**(ajg 除去に内包)。

## 3. ryu code 新形化(B-7(b))
- [ ] ryu の **moves.code が新形のみ**(旧形 `stand_*`/`crouch_*`/`jump_*`/`forward_throw`/`back_throw`・rush base 旧形が**全て消えている**)。A-2 対応表どおり。
- [ ] `UNIQUE(character_id, code)` 衝突が起きていない(新形 code が既存と重複しない)。
- [ ] **preset_aliases(000006 由来)が move_id 参照で不変**(改名で alias 行が壊れていない)。aliases に不要な追加操作をしていない。
- [ ] resolver / recipe_cache が move_id 経由で不変(report C-3。code 文字列依存ゼロ)。

## 4. コントローラ(B-7(a))
- [ ] `useControllerInput.ts` の `BUTTON_TO_MOVE_CODE` の旧形 **7 値**(stand_* 6 + forward_throw)が新形(standing_* 6 + throw_forward)へ更新。
- [ ] `drive_impact` / `drive_parry` は**正典のまま不変**。
- [ ] 新形マッピングが ryu(seed 新形化後)+ 取込5体の moves で解決される(`addMoveStep` の完全一致が成立)。

## 5. マイグレーション(000017)
- [ ] **追記の 000017** で実施し、既存 000001〜016 を**編集していない**(§10-1)。連番 = 000017。
- [ ] **`dbtest.Setup`(全マイグレ適用)が緑**(retrospective-digest §5)。新規 DB 構築でも破綻しない。
- [ ] down ファイルが存在し、§3.4.2 で確定した戦略どおり(前方専用最小化なら SQL コメントで明記)。
- [ ] drive_damage に触れていない(000012 は未投入・000016 と整合済み、report A-4)。

## 6. テスト fixture 追従(ロックステップ)
- [ ] `migrate_test.go` の **36 件 exact 依存(L452/L453)**が ajg 除去後の最終状態(= 0)へ修正、または意図再設計されている。
- [ ] `TestRun_RushVariantOriginalMoveID`(L487-493 相当)の rush exact 比較が ryu 新形 code へ更新。
- [ ] 旧形 code 直書きの **Go 12 + フロント 7 = 計 19 ファイル**が新形へ追従し、緑。`VirtualController.test.tsx` 等の期待値も新形。
- [ ] ajg 前提のテスト(36 件依存等)が単純置換でなく**意図を確認して再設計**されている。

## 7. 既存挙動の温存(非破壊性)
- [ ] 取込5体(ryu/ken/ingrid/c_viper/dhalsim)の登録・閲覧・コンボ操作が非回帰。
- [ ] 先行リリース3体の custom_states(ryu/ingrid/c_viper)が不変。ken/dhalsim は NULL 据え置き。
- [ ] resolver/recipe・保存済みコンボ/セットプレイが move_id 経由で不変(code 改名の影響を受けない)。
- [ ] 既存 E2E(コンボ CRUD / 比較 / セットプレイ)が通過。

## 8. ドキュメント・規約
- [ ] CHANGE 要否(§4.4)の判定結果が完了報告に明記され、**製造担当が DES を直接編集していない**。
- [ ] followup-backlog §B-7 のクローズ可否(残課題の有無)が完了報告にある。
- [ ] 旧形 code が seed・コントローラ・テストから全数消えたことの grep 結果が報告にある。

---

## 9. 重大な問題の判定基準(完了承認を妨げる)
- ajg のいずれか(characters/moves/aliases/combos/custom_states)が新規 DB に**残存**、または除去で**他キャラ/取込データを巻き込んでいる**。
- ajg 除去で **orphan 子行**(参照先を失った preset_aliases/moves/steps 等)が残っている。
- ryu code 新形化で **旧形が残存**、`UNIQUE` 衝突、または **preset_aliases/recipe が壊れている**。
- 既存マイグレ 000001〜016 を**編集している**(§10-1 違反)。
- **`dbtest.Setup` / 新規 DB 構築が破綻**、または 19 fixture のいずれかが未追従で赤。
- コントローラの `drive_impact` / `drive_parry` を変更している、または旧形 7 値の更新漏れ。
- 製造担当が **DES 本体を直接編集**している。

## 10. 軽微な問題の判定基準(持ち越し許容)
- マイグレ SQL の整形・`<説明>` 命名の好み(機能が満たされていれば可)。
- テスト fixture の記述スタイル(新形へ追従し緑になっていれば可)。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / report §Y に対し実装が Z。意図確認したい」の形で根拠併記。

## 12. レビュー完了の判定
- §1〜§8 全 OK、§9 重大ゼロ、前提ゲート + Plan Mode §3.4 報告(特に down 戦略・ajg DELETE 順序・CHANGE 要否)が揃っている。特に **§2 ajg 除去の網羅/FK**・**§3 ryu orphan 不発生**・**§5 `dbtest.Setup` 緑**・**§6 19 fixture 追従**を確認。§10 軽微は持ち越し可。

---

*以上、M12-05 レビューチェックリスト v1.0.0*
