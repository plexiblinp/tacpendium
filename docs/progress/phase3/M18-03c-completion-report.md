# M18-03c 完了報告: 確定反撃 drainage

| 項目 | 内容 |
|---|---|
| 文書 ID | M18-03c-REPORT |
| 作成日 | 2026-07-28 |
| 対応指示書 | `docs/instructions/phase3/M18-03c-drainage.md` v1.0.2 |
| 補足通知 | `docs/instructions/phase3/M18-materialize-damage-scope-relay.md` |
| 消費した CHANGE 番号 | **CHANGE-090**（中央払い出し済み。自採番なし） |
| 消費したマイグレ連番 | **なし（0 本）** |
| ブランチ | `feature/m18-03c` |
| 結果 | §1.2 の 7 点を実装し、直列 E2E を含む全品質ゲート green |

## 1. 着手前実査

### 1.1 スキーマと対象資料

- 基準時点は **2026-07-28**。実 DB `m19-verify.db` の `schema_migrations` は 39 行、disk 上の最新マイグレは **000042** だった。指示書の前提 000041 との差は、先行して取り込まれた M19-03 の 000042 による。M18-03c はマイグレを作らず、既存マイグレも変更していない。
- 指示書が参照する `M18-materialize-damage-scope.md` は作業ツリーに存在しなかったため、開発者が格納した `M18-materialize-damage-scope-relay.md` を通知書として読み替えた。SA／CA の等倍、多段技 `damage` の意味、実装範囲の裁定は指示書と整合していた。
- `M18-01-lessons-learned.md` の独立ファイルは存在しなかったが、同内容の L-1／L-3／L-7 は handover／retrospective の正典から確認した。

### 1.2 SA／CA の始動技候補実測

一次源は上記実 DB の `moves`、集計単位は条件に一致した **move 行数**。次の指示書指定 SQL を 2026-07-28 に実行した。

```sql
SELECT category, COUNT(*) FROM moves
WHERE category IN ('super_art','critical_art')
  AND damage > 0 AND is_aerial = 0 AND startup IS NOT NULL
GROUP BY category;
```

結果は `super_art = 54`、`critical_art = 10`、**合計 64 行**。0 件ではないため、materialize 時の category 例外を実装した。

### 1.3 案 C と既存配線の実査

- 現行のジャンプ強攻撃候補は **21 行**、案 C 適用後は **23 行**。増分は `juri.neutral_jumping_heavy_kick` と `ken.neutral_jumping_heavy_kick` の 2 行。
- `category='unique'` の除外対象は **7 行／7 code**。12 キャラの `jump_neutral`／`jump_forward`／`jump_back` の `total` 不一致は **0 行**。
- `POST /api/combo-punish-curations` は route → handler → service → repository まで到達可能だったため、BE を作り直さず既存 API を利用した。
- `ComboEditor` は既存 `location.state` の `punishReturn`／`punishContext` を使っており、同じ機序へ `opponentMoveId`／`hitType` を追加した。Props 契約は変更していない。
- `internal/service/setplay/` は `model.Combo` を読むが、今回は `model.Combo` を変更していない。Combo 用 divergence guard は存在せず、move 用 divergence test は全件 green。

## 2. 実装結果

### 2.1 案 C と変換済み表示

- 始動技抽出を `is_aerial && category == "normal" && strings.Contains(code, "jumping_heavy_")` に変更し、定数を中間一致の実態に合わせて改名した。
- フレーム式、3 レーン境界、`JumpSlack = 4`、`MovementTotals`、相手技除外規則は不変。
- BE がキャラクター単位で active な `materialized_from_combo_id` を取得し、孫 `ComboNode.hasMaterializedVersion` を返す。相手技を条件に含めず、draft は含め、論理削除済み PC 版は除外する。
- FE はフラグが立つ基底を通常一覧の末尾に「変換済み (N 件)」として畳み、展開時に「PC 版を作成済み」を表示する。N=0 ではセクションを出さない。

### 2.2 手動確認レーンの登録完結

- 自動採用は**手動確認レーンだけ**を対象とする。両レーンから `/combos/new` へ検索時キャラクターと正規化済み `hitType` を渡し、手動確認レーンだけが追加で `opponentMoveId` を渡す。
- ガードタブは `punish_counter`、ジャストパリィタブは `just_parry_punish_counter` を既存 SSOT からプリフィルする。4 値リテラルの新設はない。
- 確定反撃サーチ経由では、手動確認レーン／成立ツリーのどちらもキャラクターと `hit_type` の選択を固定する。さらに保存要求値または保存結果が検索時キャラクターと異なる場合は紐づけをスキップし、コンボが保存済みであることと理由を警告する。
- コンボ保存成功後に既存 `POST /api/combo-punishes` を呼ぶ。紐づけ成功時は探す画面へ戻り、当該相手技の「登録済みの確定反撃」に現れる。
- 紐づけだけが失敗した場合は、コンボが保存済みであることと紐づけ失敗を toast で明示し、入力済みコンボを削除せず詳細へ遷移する。
- 成立ツリー側の「このコンボを新規登録する」は検索キャラクターとタブ別 `hit_type` を固定するが、`combo_punishes` の自動登録はしない。保存後に探す画面から利用者が明示的に採用する。

### 2.3 curation 導線

- 第3セクションのコンボ行だけに、任意 note「隠す理由(任意)」と「使わない」を追加した。
- 既存 `POST /api/combo-punish-curations` を呼び、成功後は第3セクションから除外され、「隠したもの管理」の「使わない反撃」から解除できる。
- curation 成功後は行ごとの note 入力 state を削除し、解除後に同じ行が戻った際に古い理由が再表示されないようにした。
- PC 系タブの本体には curation 導線を追加していない。

### 2.4 materialize ダメージ

- 始動技取得を `damage` と `category` の組に拡張した。
- `super_art`／`critical_art` は加算せず、既存理由コードの流儀に沿った `starter_move_not_pc_scaled` を返す。通常 category と既存の縁 3 パターンは不変。
- 通知は通常のコンボ登録時ではなく、「パニッシュカウンター版を作る」で新しい PC 版の生成に成功した時だけ表示する。通常加算時は「通常版の合計ダメージ＋始動技ダメージの20%」という計算前提から説明し、加算をスキップした場合は理由と元の値を使ったことを説明する。
- 全生成結果で、多段始動は実測と異なる可能性と生成後の実測値への調整を案内する。未知の `damageSkipReason` も理由コードを含むフォールバック文言を表示し、silent に落とさない。生成物の `memo` は変更しない。
- 新規生成時の説明 toast は文章量を考慮して自動では消さず、右上の×ボタンで明示的に閉じる。「開く」操作は維持する。専用クラスだけで位置を上書きし、共通 `Toaster` の既定値と短い通知には波及させない。
- 連続生成では固定 ID を結果種別ごとに分ける。通常加算／counter 変換は `materialize-result`、加算スキップ（SA／CA・値欠損・未知理由）は `materialize-result-attention` とし、同種は最新 1 件へ置換する。これにより永続通知は最大 2 件に収まり、回復しにくいスキップ理由が通常結果に押し流されない。

## 3. 変更資産と不変条件

主な変更:

- BE: `internal/repository/punish/`、`internal/service/punishfinder/`、`internal/service/combo/service.go`、`internal/api/combo/dto.go`
- FE: `web/src/constants/punish.ts`、`ComboEditor.tsx`、`PunishTree.tsx`、`PunishList.tsx` と対応する型・テスト
- E2E: `web/e2e/m18-03c-drainage.spec.ts`、既存文言追随の `m18-03a-punish-mylist.spec.ts`

不変を確認:

- 新規テーブル／新規列／新規 endpoint／新規マイグレは **0**。
- `model.Combo`、combos INSERT 列、`DuplicateKey`、`CalcRecipeHash`、`RecomputeComboCache` は不変。
- materialize のコピー範囲、FR301、出自、トランザクション境界は不変。
- `Header.tsx`、`internal/service/setplay/`、M19 資産、seedgen、migration、DES 本体は変更していない。
- `ComboEditor` の Props 契約は不変。走査規則を FE に複製していない。
- 見送り確定の `combo／punish リポジトリの punish 書込メソッド重複整理` と `getMoveDamage の層分離` には触れていない。

## 4. テスト結果

### 4.1 単体・ビルド

- 対象 Go テスト: punish repository／punishfinder／combo materialize **green**。
- 独立レビュー後、seed 全体の案 C 回帰（既存 21＋neutral 2、unique 7 除外）と相手技 A→B の fold 結合テストを追加し、同 3 package を再実行して **green**。
- 初回の対象 Vitest: **56 tests green**。Claude 独立レビュー取り込み後は **5 files / 66 tests green**、実機フィードバック追補後は **6 files / 102 tests green**。
- 一次受け Q4 追補後の対象 Vitest: **3 files / 36 tests green**。`make test`: Go 全 package green、Web **119 files / 910 tests green**。
- `make build`: TypeScript／Vite／Go build **成功**。Go module stat cache の read-only warning は出たが exit 0 で成果物に影響なし。

### 4.2 E2E

- 新規 `m18-03c-drainage.spec.ts` 単独: 初回 **3/3 passed**。Claude 独立レビュー取り込み後にも **3/3 passed**。実機フィードバック追補で成立ツリーの固定確認を追加して **4/4 passed**。一次受け Q4 で同種置換／最新の「開く」と、モバイル幅 390×844 で通常・要注意の最大 2 件／後続操作を追加し、最終 **6/6 passed**。moves への書き込みなし。
- 既存 `m18-03b-materialize.spec.ts` 単独: **4/4 passed**。
- `m18-03a` 3 ケースは 03a＋03b の組合せ実行で初回 **3/3 passed**。03b の並列時 500 は単独 4/4 で非再現。
- 一次受け Q4 追補後、既存 `m18-03a`／`m18-03b` を `--workers=1` で再実行し、**7/7 passed**。固定 ID 追加による既存 spec への波及は 0。
- フルスイートを既定並列で実行した初回結果は **55 passed / 9 flaky / 1 failed**。初回失敗は次の spec:
  - flaky: `m17-01-media-fields`、`m17-05c-pdf-pagination`、`m18-02-punish-search`、`m18-03b-materialize`、`m18-03c-drainage`、`m19-01-setplay-suggestion`、`m19-02-suggestion-refinement`、`m19-03-setup-results`、`moves-edit`
  - retry 後も failed: `m12-06-draft-promotion`
- `m12-06-draft-promotion` は単独 **1/1 passed**、新規 03c も単独 **3/3 passed**。さらに同じ 65 件を `--workers=1` で再実行し、**65/65 passed（1.2 分）**。並列時の作成 API 500／状態不一致はいずれも単独・直列で消えたため、既知の共有 SQLite 書き込み競合／共有状態干渉と切り分けた。実装起因の再現失敗は 0 件。
- 既定 port 47390 は作業開始前から別プロセスが使用していたため、検証時だけ 47590／5473 の一時設定を用いた。一時設定ファイルは削除済みで成果物に含めていない。

## 5. 文言固定テストの実査

2026-07-28 に `web/e2e/**` と `web/src/**/*.test.tsx` を全件 grep し、次を確認した。

- `PunishTree.test.tsx`: 新規登録 3 箇所、手動登録 2 箇所、登録済み見出し 4 箇所、変換済み／PC 作成済み 5 箇所、materialize ボタン 1 箇所。
- `PunishList.test.tsx`: PC 生成バッジ／materialize／使わないに関する 7 箇所。
- `HiddenItemsPanel.test.tsx`: 「使わない反撃」関連 2 箇所。
- `m18-03a-punish-mylist.spec.ts`: 「使わない」導線の配置と告知文 5 箇所。PC 行に curation が無いことへ scope を絞って追随。
- `m18-03b-materialize.spec.ts`: `PC版(生成)` 1 箇所。
- 新規 `m18-03c-drainage.spec.ts`: 変換済み、PC 作成済み、手動登録、登録済み、使わないの実動線を固定。

旧「確定反撃候補を保存」は 0 hit。変更対象文言を期待する既存テストの未追随はなく、全 Vitest／E2E green で確認した。

## 6. DES 反映要点

製造側は DES 本体を編集していない。中央反映時は次を更新する。

1. **DES-005 §5.20**: 「未反映の確定事項」だった案 C を as-built へ昇格する。現行 21 行から 23 行、neutral 増分 2、unique 7 行除外、3 方向 total 不一致 0。
2. **DES-005 §5.20 の既知の限界 2**: 手動確認レーンの新規登録が `combo_punishes` まで到達するようになったため「解消済み」とする。
3. **許容済みの非対称**:
   - draft の PC 版でも畳まれる一方、FR301 の既存検出は `is_draft=0` 固定。
   - 同一レシピの counter 版は FR301 で変換できず、孫に残り得る。
   - PC 系タブのコンボは curation で隠せず、第3セクションだけが「使わない」を持つ。
   いずれも承知のうえの仕様で、欠陥ではない。
4. **DES-003 §3.3 errata**: SA／CA は PC 補正が乗らず等倍、多段技の `moves.damage` は合計値という通知書の事実を保全する。実 DB の対象候補は SA 54／CA 10。
5. **DES-002／DES-005 §5.21**: 手動登録の `opponentMoveId`／`hitType` 引き渡し、保存後の punish 採用、部分失敗の非原子的扱い、第3セクション限定の curation、変換済み折りたたみ、無条件の概算注意を as-built として記録する。
   - 両レーンで検索時キャラクターとタブ別 `hit_type` を固定し、自動採用だけを手動確認レーンに限定する。
   - 不一致時は防御的に紐づけをスキップする。
   - materialize の説明は生成結果別に、計算前提／スキップ理由／実測値への調整を案内し、新規生成時は×で閉じるまで表示する。
   - 連続生成時は通常結果と加算スキップ結果を別の固定 ID で各 1 件に置換し、永続通知を最大 2 件に制限する。スキップ理由は通常結果では置換しない。

## 7. backlog と M18 クローズ

- `punish-manual-registration-not-wired`: 本実装で解消。
- `punish-hide-normal-after-materialize`: 「消す」ではなく設計裁定どおり「理由付きで畳む」として解消。
- 独立レビューは重大 0／高 0／中 1／低 0。中指摘のテスト粒度を受理して回帰テスト 2 本を追加し、最終未解決は **0**。詳細は `docs/progress/phase3/m18-03c-review.md`。
- Claude の独立セカンドレビューは重大 0／高 0／中 3／低 5。開発者判断を経て 6 件を取り込み、`hit_type` 定数構造に関する中-2／低-4 は同一の後続候補 `hit-type-named-constants` として延期した。取り込み後のコード上の未解決は **0**。詳細は `docs/progress/phase3/m18-03c-review_claude.md`。
- `hit-type-named-constants`: 既存 SSOT の値配列を位置インデックスで参照する構造と、それに伴う non-null assertion を名前付き定数へ整理する。M18 の設計凍結範囲を越えるため製造側では中央 backlog／DES 本体を変更せず、後続設計へ申し送る。
- 一次受け Q4 は §4.8 の通知実装の不備修正として、固定 ID の出し分けと回帰テストを追加した。新機能やスキーマ変更はなく、新たな未解決 blocker はない。
- M18-03c の完了により、製造上の M18 最終サブをクローズ可能。

---

以上、M18-03c の実装・テスト・ビルド確認を完了した。
