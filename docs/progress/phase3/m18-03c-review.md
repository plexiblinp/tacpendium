# M18-03c 実装レビュー

| 項目 | 内容 |
|---|---|
| 対象 | `5673dbb..1bd3bab` |
| 実施日 | 2026-07-28 |
| 判定 | **修正後承認** |
| 指摘件数 | 重大 0 / 高 0 / 中 1 / 低 0 |

## 総評

案 C、materialize 済み基底の折りたたみ、手動登録の `combo_punishes` 接続、第3セクション限定 curation、`hit_type` プリフィル、SA／CA のダメージ加算除外は、いずれも指示書の実装境界に沿っている。重大問題の判定基準に該当する変更はなく、対象 Go テストと Vitest 56 件も再実行で green だった。

ただし、チェックリストが明示的に要求する二つの重要な回帰条件が自動テストとして固定されていない。実装の静的確認では正しいものの、§12 の完了承認条件を満たすには下記の中指摘を解消する必要がある。

## 指摘事項

### [中] 重要な不変条件 2 件が、要求どおりの回帰テストになっていない

- 根拠:
  - `internal/service/punishfinder/service_test.go:307` の案 C テストは、従来形 1 件、新規 neutral 1 件、除外例を合成 fixture で確認するが、指示書 §5.1 の「既存 21 件の挙動不変」を固定していない。21→23 は `docs/progress/phase3/M18-03c-completion-report.md:37` の一時点の実測だけである。
  - `internal/repository/punish/repository_test.go:135` は active／draft／deleted／他キャラを確認するが、相手技 A・B を作らない。`internal/service/punishfinder/service_test.go:392` も materialized map を fake から直接渡すため、「相手技 A で変換した基底が相手技 B の孫でも畳まれる」という §5.1／レビューチェックリスト §8 の要求を実経路で検証していない。
- 影響:
  - 現行 SQL は相手技を条件に含めず、現行述語も既存候補を維持しており、直ちに発生している機能不良ではない。
  - 将来、走査述語や materialize 判定へ誤って相手技条件を持ち込んでも、現在の対象テストだけでは検出できない。
- 推奨修正:
  1. seed データを使い、案 C 適用後が既存 21 件をすべて含む 23 件で、増分が Juri／Ken の neutral 2 件、unique 7 件が 0 件であることを固定する。
  2. 相手技 A に対して materialize した基底を相手技 B の走査でも `hasMaterializedVersion=true` と確認する結合テストを追加する。可能なら同じテストで draft と論理削除後の解除も確認する。

## チェックリスト判定

### 0. 準備・着手前実査

- ✓ CHANGE-090、指示書 §2.3／§4、design outline、DES の指定箇所、handover／retrospective を照合した。
- ✓ SA／CA 実測値、案 C の現行件数、`location.state`、curation API 到達性、setplay の参照関係が完了報告に記録されている。
- ✓ 指定されていた `M18-materialize-damage-scope.md` は作業ツリーに存在しないが、通知 relay と完了報告に読み替え根拠が記録され、内容は指示書と整合する。

### 1. 案 C

- ✓ 述語は `IsAerial && category == normal && strings.Contains(code, "jumping_heavy_")`。
- ✓ 定数名は `jumpHeavyCodePart` に改名され、`prefix` を残していない。
- ✓ Juri／Ken の `neutral_jumping_heavy_kick` を含む。
- ✓ `category=unique` を除外する。
- ✓ 完了報告の実測では既存 21 件を維持して 23 件へ増加している。
- ✓ `JumpSlack=4`、`MovementTotals`、フレーム式、地上／dash／jump 境界は不変。`jump_neutral` の追加取得なし。
- ✓ 相手技側の movement system move と `is_aerial` の除外規則は不変。

### 2. materialize 済みノーマル版の折りたたみ

- ✓ 判定は自キャラの active な子 `Y.materialized_from_combo_id` の存在で行う。
- ✓ SQL／サービスへ相手技条件を持ち込んでいない。
- ✓ `is_draft` で絞っていない。
- ✓ `deleted_at IS NULL` の子だけを数えるため、PC 版論理削除で畳み解除される。
- ✓ 基底を削除せず「変換済み (N 件)」へ畳み、展開時に表示する。
- ✓ 「PC 版を作成済み」バッジを表示する。
- ✓ N=0 では折りたたみを表示しない。
- ✓ 既存の件数付き折りたたみイディオムに沿う。
- ✓ BE は出力専用 `hasMaterializedVersion` だけを追加し、FE はそのフラグだけで表示を分ける。
- ✓ レーン別配列や FE 側の走査判定を追加していない。
- ✓ 既存フィールドの意味・型は不変。

### 3. 手動確認レーンの登録導線

- ✓ `location.state` に `opponentMoveId` を追加し、`ComboEditor` Props は不変。
- ✓ コンボ保存後に既存 `POST /api/combo-punishes` を呼び、新 endpoint は追加していない。
- ✓ 成功後に元の探す画面へ戻り、「登録済みの確定反撃」に表示する。
- ✓ 紐づけ失敗時は保存済みであることを通知して詳細へ退避し、コンボを削除しない。
- ✓ 登録導線のボタン文言と実挙動が一致する。

### 4. curation 登録導線

- ✓ 「区分を判定できない反撃」のコンボ行だけにあり、PC 系タブにはない。
- ✓ materialize ボタンの隣に置かれている。
- ✓ 既存 `POST /api/combo-punish-curations` を再利用し、BE を作り直していない。
- ✓ 任意 note は「隠す理由(任意)」として表示する。
- ✓ 登録後の除外、隠したもの管理への表示、解除後の復帰を E2E と既存管理 UI テストで確認している。

### 5. `hit_type` プリフィル

- ✓ block は `punish_counter`、just parry は `just_parry_punish_counter`。
- ✓ 項目 3 と同じ `location.state` を使用する。
- ✓ 新しい VAL は追加していない。
- ✓ 既存 `HIT_TYPE_VALUES` を参照し、4 値の新規定義や第5の値を追加していない。

### 6. ダメージ加算訂正

- ✓ 基準日、一次源 SQL、実測 `super_art=54`／`critical_art=10` が Plan 相当の実査と完了報告に記録されている。
- N-A 実測 0 件の場合の非実装分岐。実測は合計 64 件。
- ✓ SA／CA 始動では加算せず、`starter_move_not_pc_scaled` を返す。
- ✓ その他 category の加算と既存の縁 3 パターンは不変。
- ✓ 成功メッセージには多段始動の概算注意を無条件で含める。
- ✓ 生成物の `memo` を変更していない。
- ✓ combo 層の変更は始動技の `damage`／`category` 読み取りとダメージ分岐に限られ、コピー範囲、FR301、出自、トランザクション境界は不変。
- ✓ 変更文言の unit／E2E assert は同じ差分で追随している。
- ✓ grep 実査の対象とヒット数は完了報告 §5 に記録されている。
- ✓ 03a／03b spec の結果と並列失敗の spec 名・単独／直列切り分けが記録されている。
- ✓ `m18-03a-punish-mylist.spec.ts` の C ケースに対する追随は、PC 行に curation がないことへ適切に scope を絞っている。

### 7. データ・API・スキーマ不変

- ✓ `5673dbb` 時点ですでに 000042 が存在するため、指示書の「末尾 000041」は先行 M19 取り込みで陳腐化している。対象差分で migration の追加・改変は 0。
- ✓ 新テーブル・新列なし。
- ✓ `internal/seedgen` は不変。
- ✓ `model.Combo`、23 INSERT 列、`DuplicateKey`、`CalcRecipeHash`、`RecomputeComboCache` は不変。
- ✓ materialize の生成規則本体は不変。
- ✓ `Header.tsx` は不変。
- ✓ M19／setplay 資産は不変。
- N-A 新 endpoint を追加していないため、query 名規約の追加確認対象なし。

### 8. テスト妥当性

- ✗ §5.1 のうち「既存 21 件不変」を自動テストとして固定していない。上記中指摘を参照。
- ✓ 畳む判定の active／なし／draft／deleted の各状態は repository／service テストで確認している。
- ✗ 相手技 A で変換し、相手技 B の孫でも畳まれる実経路のテストがない。上記中指摘を参照。
- ✓ E2E A／B／C を新規 spec で、D を既存全スイートで確認している。
- ✓ 新規 spec は `moves` へ書き込まない。
- ✓ 新規 spec 単独 3/3 の結果が完了報告に記載されている。
- ✓ 既存コンボ機能を含む `make test`、build、直列 E2E 65/65 の結果が完了報告に記載されている。

### 9. 重大問題・スコープ

- ✓ §9 の重大問題に該当する変更はない。
- ✓ §4 の 6 項目を超える実装はない。
- ✓ repository 書込重複整理と `getMoveDamage` の層分離には着手していない。helper の改名は同じ materialize ダメージ分岐内で `category` を返すための変更に限定される。
- ✓ 消費 CHANGE は中央払い出し済み CHANGE-090、migration は 0 本と記録されている。

## 検証結果

- `git diff --check 5673dbb..HEAD`: pass
- `env GOCACHE=/tmp/combomgr-m18-03c-review-go-cache go test ./internal/repository/punish ./internal/service/punishfinder ./internal/service/combo`: pass
- `pnpm exec vitest run src/features/combo/components/ComboEditor.test.tsx src/features/punish/components/PunishList.test.tsx src/features/punish/components/PunishTree.test.tsx`: 3 files / 56 tests pass
- completion report の記録: `make test` green、`make build` 成功、新規 E2E 3/3、既存 03b 4/4、全 E2E 直列 65/65

## 良かった点

- materialize 判定を相手技から切り離しつつ、BE の出力フラグ 1 個で FE の表示責務を完結させている。
- 保存成功と punish 紐づけ成功を分け、部分失敗時にユーザーデータを残す設計が明確である。
- combo 中核、schema、seedgen、setplay へ変更を広げず、例外許可されたダメージ分岐へ scope を限定している。

## 取り込み結果（自動トリアージ）

### [中] 重要な不変条件 2 件の回帰テスト不足

**判定: 受理・解消済み。**

指示書 §5.1 とレビューチェックリスト §8 が明示する完了承認条件であり、将来の述語変更を検知する価値も高いため受理した。

- `TestScan_JumpLane_SeedRegression_Existing21PlusNeutral2` を追加。migration 適用済み seed 全体を入力に、従来 prefix 候補 **21 件が全て残る**こと、案 C が **23 件**であること、増分が Juri／Ken の neutral 2 件だけであること、unique 系空中技 **7 件が 0 件混入**であることを固定した。
- `TestScan_MaterializedFlagDoesNotDependOnOpponentMove` を追加。実 repository／service 経路で相手技 A に採用した基底を materialize し、別の相手技 B の孫でも `hasMaterializedVersion=true` になることを固定した。
- repository の既存 active／draft／deleted テストへ、基底と生成物の character が異なる場合も formal predicate `child.materialized_from_combo_id = base.id AND child.deleted_at IS NULL` に従うケースを追加した。SQL は生成物側でなく基底側の character を scope に使う JOIN へ是正した。

再検証:

- `env GOCACHE=/tmp/combomgr-m18-03c-go-cache go test ./internal/repository/punish ./internal/service/punishfinder ./internal/service/combo`: **pass**
- `gofmt`: 適用済み
- 本指摘の未解決項目: **0**

### 最終トリアージ

- 重大 0 / 高 0 / 中 0 / 低 0
- reviewer の中指摘 1 件は受理・修正・対象テスト green。棄却所見なし。
