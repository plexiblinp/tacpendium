# M18-03c レビュー報告書

| 項目 | 内容 |
|---|---|
| 文書 ID | M18-03c-REVIEW-CLAUDE |
| 対象差分 | `5673dbb..3d3ee14`（4 commits・25 files・+1619/-174） |
| 対象ブランチ | `claude/review-m18-03c-drainage-utycok`（`feature/m18-03c` 相当） |
| 実施日 | 2026-07-29 |
| レビュアー | Claude Code（claude-opus-5）／read-only |
| 位置づけ | **既存の `docs/progress/phase3/m18-03c-review.md`（Codex 側レビュー）とは独立のセカンドオピニオン**。開発者の指示により、指摘があっても本レビューでは一切修正していない |
| 判定 | **条件付き承認**（重大 0／高 0／中 3／低 5。中 3 件はいずれも M18 クローズを妨げないが、うち 1 件は開発者判断が必要） |

---

## 総評

指示書 §4 の 6 項目はすべて実装されており、チェックリスト §9 の「重大な問題」16 項目に該当する逸脱は **1 件も無い**。新規マイグレ 0・新テーブル/新列 0・新 endpoint 0・`model.Combo`／INSERT 列／`DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache` 不変・`Header.tsx` 不変・M19 資産不変・seedgen 不変を差分上で確認した。とくに **「変換済みを消さずに畳む」という M18 の設計思想の核**、**畳む判定に相手技を持ち込まない**、**curation 導線を第3セクションに限定する**という 3 つの落とし穴は、いずれも設計意図どおりに実装されている。

BE 側の分界（判定は BE のフラグ 1 個・表示は FE）も守られており、走査述語の変更は始動技の抽出条件 1 行に限定され、フレーム式・レーン境界・`JumpSlack`・相手技除外規則には手が入っていない。materialize 側も `getMaterializeStarter` への差し替えとダメージ分岐 1 箇所に収まっている。

一方で、**指示書が名指ししていない箇所へ挙動が波及している**点が 1 件ある（§4.3／§4.5 が対象と書いた「手動確認レーン」だけでなく、成立ツリー側の「このコンボを新規登録する」にも自動採用と `hit_type` プリフィルが適用されている）。実装として不合理ではないが、完了報告・E2E・DES 反映要点のいずれにも記載が無く、§7.4／§8.3 の観点から**開発者の追認が要る**と判断した。加えて `hit_type` 写像を配列の位置インデックスで引いている点は、規約の字面（4 値リテラルを再定義しない）は満たすが将来の破綻余地を残している。

---

## 設計準拠性レビュー結果

### 項目 1：案C（指示書 §4.1 / チェックリスト §1）— ◎

| 検証 | 結果 | 根拠 |
|---|---|---|
| 述語が `IsAerial && Category=="normal" && Contains(code,"jumping_heavy_")` | ✓ | `internal/service/punishfinder/service.go:351-353` |
| 定数名の改名（`prefix` の語を残さない＝L-7） | ✓ | `constants.go:26` `jumpHeavyPrefix` → `jumpHeavyCodePart`。コメントも「接頭辞」→「部分文字列」へ追随済み |
| juri／ken の `neutral_jumping_heavy_kick` が出る | ✓ | `service_test.go` `TestScan_JumpLane_SeedRegression_Existing21PlusNeutral2` が seed 全キャラで固定 |
| unique 系 7 件が出ない | ✓ | 同テストで `uniqueAerial` 7 件の非混入を assert |
| 既存 21 件不変 | ✓ | 同テストが旧 `HasPrefix` 集合 21 件の全包含を assert |
| フレーム判定・レーン境界・`JumpSlack`・`MovementTotals` 不変 | ✓ | 差分に `adv >= *totals.JumpForward-JumpSlack` の変更なし。`jump_neutral` の新規取得なし |
| 相手技の除外規則不変 | ✓ | `movementSystemCodes`・`is_aerial` 除外に差分なし |

**所見**：`ListMovesForScan` を直接叩いて `buildStarters` を通す形の seed 回帰テストは、走査述語の意図しない緩和/収縮を確実に捕まえる。良い設計。ただし後述【低-1】のとおり 21/23/7 のハードコードは将来のシード追加で必ず赤くなる。

### 項目 2：materialize 後のノーマル版を畳む（§4.2 / §2）— ◎

| 検証 | 結果 | 根拠 |
|---|---|---|
| 判定式が `EXISTS(Y: Y.materialized_from_combo_id = X.id AND Y.deleted_at IS NULL)` | ✓ | `queries.go:60-67`。`JOIN combos base ON base.id = child.materialized_from_combo_id WHERE base.character_id = ? AND child.deleted_at IS NULL` |
| 相手技を判定に持ち込んでいない | ✓ | SQL に `opponent_move_id` が一切現れない。`TestScan_MaterializedFlagDoesNotDependOnOpponentMove` が実 repository／service 経路で相手技 A→B を検証 |
| `is_draft` を条件に入れていない | ✓ | SQL に `is_draft` なし。`TestRepository_MaterializedBaseComboIDs` の `draftBase` ケースで固定 |
| PC 版の論理削除で自動的に畳み解除 | ✓ | 同テスト `deletedOnlyBase` ケース |
| 消していない・畳んでいる | ✓ | `PunishTree.tsx:532-537` で `activeCombos` / `materializedCombos` に分割し、後者は削除せず折りたたみ内に描画 |
| 「変換済み (N 件)」が**コンボ一覧の末尾** | ✓ | `PunishTree.tsx:629-712`。`activeCombos` の直後、新規登録行の直前 |
| 「PC 版を作成済み」バッジ | ✓ | `renderCombo(combo, true)` 内 |
| N=0 でセクションごと非表示 | ✓ | `materializedCombos.length > 0 &&` でガード。`変換済みが 0 件なら折りたたみを出さない` テストあり |
| 03a と同じイディオム（件数付き折りたたみ・Chevron） | ✓ | `ChevronDown`/`ChevronRight` + `aria-expanded`。新しい見せ方を作っていない |
| 判定は BE・フラグ 1 個・出力専用・後方互換 | ✓ | `ComboNode.HasMaterializedVersion bool \`json:"hasMaterializedVersion"\``。既存フィールドの型・意味は不変 |
| レーンごとに配列を分けていない | ✓ | フラグ 1 個のみ |
| 走査規則の FE 二重実装なし | ✓ | FE はフラグを見て `filter` するだけ |

**所見（設計として良い判断）**：折りたたみ内の行では `パニッシュカウンター版を作る` ボタンを出さない（`PunishTree.tsx:594` `!materialized && ...`）。指示書は明示していないが、二重変換で FR301 の `alreadyExisted` 経路に落ちるだけの無駄な操作を封じており、妥当な追加抑制。

**確認できなかった点（不明）**：`combos.materialized_from_combo_id` に索引が張られているかを差分外の migration では追っていない。`Scan` は 1 回あたり `ListMaterializedBaseComboIDs` を 1 本追加で発行するのみ（N+1 ではない）ため、実用上の性能影響は無いと判断した。

### 項目 3：手動確認レーンの登録導線（§4.3 / §3）— ○（中-1 該当）

| 検証 | 結果 | 根拠 |
|---|---|---|
| `location.state` に `opponentMoveId` を追加 | ✓ | `PunishTree.tsx:106-113` |
| `ComboEditor` の Props 契約（`mode`/`initial`/`initialCharacterId`）不変 | ✓ | `ComboEditor.tsx:75` シグネチャ無変更 |
| 保存成功後に既存 `POST /api/combo-punishes` を呼ぶ・新 endpoint なし | ✓ | `ComboEditor.tsx:353-364`。`useAddPunish` を再利用。API 層に差分なし |
| 登録後に「登録済みの確定反撃」に現れる | ✓ | E2E B（`m18-03c-drainage.spec.ts:248-305`）が `POST /api/combo-punishes` 204 と復帰後の表示まで固定 |
| 紐づけ失敗が silent でない・コンボを削除しない | ✓ | `catch` で `toast.error("コンボは保存されましたが、確定反撃の紐づけに失敗しました…")` → コンボ詳細へ退避。削除・巻き戻しなし |
| ボタン文言が実挙動と一致 | ✓ | 「手動で確定反撃を登録」が実際に `combo_punishes` を作るようになった。保存後 toast も「確定反撃候補を保存しました」→「確定反撃を登録しました」へ修正 |
| 追随すべき既存 assert の更新 | ✓ | 旧文言「確定反撃候補を保存」は 0 hit（完了報告 §5）。`m18-03a` spec の「使わないので隠す」assert も `使わない` へ scope を絞って追随 |

**△ 中-1（後述）**：`goNewCombo` が **2 箇所**から呼ばれ、両方に `opponentMoveId` と `hitType` が渡っている。§4.3／§4.5 が対象と書いたのは手動確認レーン（`PunishTree.tsx:538` 「手動で確定反撃を登録」）だが、成立ツリー側（`PunishTree.tsx:394` 「このコンボを新規登録する」）にも同じ自動採用が適用されている。

### 項目 4：curation の登録導線（§4.4 / §4）— ◎

| 検証 | 結果 | 根拠 |
|---|---|---|
| 第3セクションのコンボ行のみ | ✓ | `PunishList.tsx:256` `section === "unclassified" && ...` |
| マイリスト本体（PC 系タブ）に無い | ✓ | `PunishList.test.tsx` 「PC 系のマイリスト本体には curation 登録導線を出さない」＋ `m18-03a` spec で行スコープを絞った `toHaveCount(0)` |
| 変換ボタンの隣 | ✓ | 同一 fragment 内、`パニッシュカウンター版を作る` の直後 |
| 既存 `POST /api/combo-punish-curations` を再利用・BE 不変 | ✓ | `useAddCuration` のコメントのみ更新。BE 差分なし |
| `note`（隠す理由・任意）入力欄・pruning と同じラベル流儀 | ✓ | `aria-label="隠す理由(任意)"` / `placeholder` 同文言。`noteOrNull` で空文字を `null` へ正規化 |
| 登録後に第3セクションから消え、「隠したもの管理」へ現れ、解除で戻る | ✓ | E2E C（`m18-03c-drainage.spec.ts:307-357`）が往復まで固定 |

**所見**：成功時 toast に「『隠したもの管理』の『使わない反撃』から再表示できます」を添えており、隠した先が分からず迷子になる事故を潰している。良い。

### 項目 5：`hit_type` プリフィル（§4.5 / §5）— ○（中-2 該当）

| 検証 | 結果 | 根拠 |
|---|---|---|
| ガードタブ→`punish_counter` / ジャストパリィタブ→`just_parry_punish_counter` | ✓ | `constants/punish.ts:19-24`。E2E B が `combo-editor-hit-type` の value を assert |
| 項目 3 と同じ機序（`location.state`） | ✓ | 新しい流儀を作っていない |
| `hit_type` の VAL を新設していない | ✓ | `internal/validation` に差分なし。FE 側は `parsePunishHitType` で既存 SSOT に含まれる値のみ通す allow-list 方式（未知値は `undefined` へフォールバック）＝DES-006 §2.7 errata の「妥当性は UI と写像側で閉じる」に沿う |
| 4 値リテラルを新規定義していない（5 箇所目を作らない） | ✓（字面） | `HIT_TYPE_VALUES[2]` / `[3]` を参照 |

**△ 中-2（後述）**：リテラル再定義は避けているが、**配列の位置インデックス**で引いているため、`HIT_TYPE_VALUES` の並び替え・要素挿入で写像が静かに壊れる。

### 項目 6：materialize のダメージ加算の訂正（§4.6 / §2.3 例外条項 / §6）— ○（低-2 該当）

| 検証 | 結果 | 根拠 |
|---|---|---|
| §3.3-2 の実測値が実値で記録（基準時点・一次源併記） | ✓ | 完了報告 §1.2：2026-07-28・実 DB `m19-verify.db` の `moves`・`super_art=54`／`critical_art=10`／計 64 行・指示書指定 SQL を明記 |
| 実測 1 件以上 → §4.6-1 を実装 | ✓ | 0 件分岐は N-A |
| SA／CA で加算せず理由コードを返す | ✓ | `service.go:909-913`。`MaterializeDamageStarterUnscaled = "starter_move_not_pc_scaled"`（既存 3 コードの命名流儀に沿う） |
| それ以外の category は従来どおり加算・既存の縁 3 パターン不変 | ✓ | `base_damage_null` / `starter_move_not_set` / `starter_move_damage_null` の分岐と文言に変更なし。`TestMaterialize_SuperArtsAndCriticalArts_DamageUnchanged` が SA/CA 両方で `damage` 据え置き＋理由コードを固定 |
| 生成時メッセージが**無条件**表示（条件付きにしていない） | ✓ | `materializeDamageDescription()` は `damageSkipReason` の有無に関わらず必ず注意文を返す。呼び出しは `PunishTree.tsx` / `PunishList.tsx` の両 toast |
| 生成物の `memo` へ自動追記していない | ✓ | `service.go` のコピー範囲に差分なし |
| 触れた範囲がダメージ分岐のみ | ✓ | `getMoveDamage` → `getMaterializeStarter`（`SELECT damage` → `SELECT damage, category`）＋分岐 1 箇所。コピー範囲・FR301・出自・トランザクション境界は不変 |
| FE の理由コード写像を 1:1 同期 | ✓ | `MATERIALIZE_DAMAGE_SKIP_LABELS` に `starter_move_not_pc_scaled` を追加（CLAUDE.md §4 の定数同期） |

**所見（判定順序）**：SA/CA チェックが `starterDamage == nil` より **先**に評価されるため、SA/CA かつ `damage` NULL のときは `starter_move_damage_null` ではなく `starter_move_not_pc_scaled` が返る。どちらも事実として正しく、ユーザーにとってより本質的な理由が優先されるので妥当と判断した（指摘ではない）。

**△ 低-2（後述）**：注意文が「始動技が多段の場合、ダメージ加算量は概算です」で止まっており、指示書 §4.6-2 の趣旨後半「実測値で調整してください」（＝ユーザーが取るべき行動）が落ちている。

### 項目 7：データ・API 契約・スキーマの不変（§7）— ◎

- ✓ **新規マイグレ 0 本**・既存マイグレの改変 0（`git diff --stat` に `migrations/` が現れない）。指示書前提の「末尾 000041」は先行取り込みの M19-03 由来 000042 により陳腐化しているが、完了報告 §1.1 で差異と根拠が明記されており、本サブは追加も改変もしていない。
- ✓ 新テーブル・新列 0。`ComboNode` の追加は **API レスポンス DTO のフィールド**であって DB 列ではない。
- ✓ `internal/seedgen` 不変。
- ✓ `model.Combo`・`combos` INSERT 列・`DuplicateKey`・`CalcRecipeHash`・`RecomputeComboCache` 不変。
- ✓ materialize の生成規則本体（コピー範囲・FR301・出自・トランザクション）不変。
- ✓ `Header.tsx` 不変（nav 14 本目なし）。
- ✓ `internal/service/setplay/`・`web/src/features/setplay/` 不変。
- N-A 新規 endpoint なしのため冗長形クエリ名規約の対象外。

### 項目 8：テストの妥当性（§8）— ○

- ✓ §5.1 の全項目（案C・畳む 4 ケース・ダメージ・不変）に対応するテストが存在。
- ✓ 畳む判定の 4 状態（PC 版あり／なし／`is_draft=1`／`deleted_at` 非 NULL）を repository テストで網羅。
- ✓ 相手技 A→B の非依存を、fake ではなく **実 repository／service 経路**で固定（`TestScan_MaterializedFlagDoesNotDependOnOpponentMove`）。Codex レビューの中指摘を受けた追加分で、指摘の趣旨を正しく満たしている。
- ✓ E2E A／B／C を新規 spec で、D を既存フルスイートで確認。
- ✓ 追加 spec は `moves` へ書き込まない（spec 冒頭コメントで明言、実装も read-only 走査＋既存属性依存）。
- ✓ 追加 spec の単独実行結果（3/3）を完了報告 §4.2 に明記。並列時の flaky は spec 名を列挙し、単独／`--workers=1` 65/65 で切り分け済み。「既知の flaky」で片付けていない。
- △ 中-1 に関わる**成立ツリー側の自動採用**を検証するテストが無い（unit は `location.state` の受け渡しまでで、`combo_punishes` が実際に作られる先は手動確認レーン経由の E2E B のみ）。
- △ 低-1：seed 依存の 21/23/7 ハードコード。

---

## 設計準拠性以外の指摘事項

### 【中-1】`goNewCombo` の自動採用が、指示書が名指ししていない成立ツリー側の導線にも波及している

- **場所**：`web/src/features/punish/components/PunishTree.tsx:99-114`（`goNewCombo`）／呼び出し `:394`（「このコンボを新規登録する」＝成立ツリー・始動技ノード配下）と `:538`（「手動で確定反撃を登録」＝手動確認レーン）。
- **事実**：`goNewCombo` は引数 `opponentMoveId` を必須にし、`hitType: PUNISH_HIT_TYPE_BY_GUARD[guardType]` を無条件に `location.state` へ載せる。`ComboEditor` 側は `mode === "new"` かつ `opponentMoveId > 0` なら保存成功後に必ず `POST /api/combo-punishes` を発行する（`ComboEditor.tsx:353`）。したがって**成立ツリー側の「このコンボを新規登録する」からの登録も、明示的な「確定反撃に採用」操作なしにマイリストへ入る**。あわせて `hit_type` も `punish_counter` 系にプリフィルされる。
- **指示書との関係**：§4.3-1 は問題を「**手動確認レーン**の『手動で確定反撃を登録』ボタン」と名指ししており、§4.5 も「手動入力」と書いている。§5.2・§5.3-B・チェックリスト §3 も手動確認レーンのみを検証対象にしている。§8.3 は「6 項目を超える作業が必要と判明したら、その場で実装範囲を広げず報告して引き継ぐ」と定めている。
- **評価**：機能として不合理ではない（M18 の狙いは「探す→登録→使う」を 1 本にすることであり、成立ツリーから登録したコンボを採用済みにするのは自然。保存後 toast も「確定反撃を登録しました」と実挙動を述べている）。ただし
  1. ボタン文言「このコンボを**新規登録する**」は採用まで行うことを示していない（§4.3-4／L-7 が求める「文言と実挙動の一致」の裏返し）、
  2. 完了報告 §2.2 は手動確認レーンのみを記述しており、この波及が記録されていない、
  3. E2E・unit ともにこの経路の `combo_punishes` 生成を固定していない、
  4. §7.4 の DES 反映要点にも現れないため、DES-005 §5.20 の as-built が実装と食い違う。
- **推奨**：意図的であれば（推奨）**そのまま残し**、完了報告への追記と DES 反映要点への 1 行追加、および成立ツリー側 1 ケースのテスト追加。意図的でなければ `opponentMoveId` の受け渡しを手動確認レーン側のみに限定する。**いずれにせよ開発者判断が要る**（本レビューでは修正していない）。

### 【中-2】`hit_type` 写像が配列の位置インデックス（`HIT_TYPE_VALUES[2]` / `[3]`）に依存している

- **場所**：`web/src/constants/punish.ts:19-33`。

```ts
export const PUNISH_HIT_TYPE_BY_GUARD: Readonly<Partial<Record<string, HitType>>> = {
  [PUNISH_GUARD_TYPE_BLOCK]: HIT_TYPE_VALUES[2],
  [PUNISH_GUARD_TYPE_JUST_PARRY]: HIT_TYPE_VALUES[3],
};
```

- **事実**：`web/src/constants/combo-list.ts:35-40` は `["normal","counter","punish_counter","just_parry_punish_counter"] as const` を定義しているが、**個別の名前付き定数を export していない**ため、位置参照が「リテラルを再定義しない」唯一の手段になっている。
- **リスク**：`HIT_TYPE_VALUES` に要素を挿入・並び替えすると、`[2]`/`[3]` は依然として `HitType` に型付けされるため **TypeScript は通り、コンパイルエラーにならない**。ユーザーデータ（`combos.hit_type`）へ誤った値が書かれる形で表面化する。現状は `PunishTree.test.tsx` がリテラル `"punish_counter"` / `"just_parry_punish_counter"` を assert しているため事故は検知されるが、それは**テストが偶然守っている**状態であって型では守られていない。
- **CLAUDE.md §4 との関係**：「列挙的文字列定数はパッケージ定数として定義」「リテラル文字列を複数箇所に散在させない」の趣旨は、名前付き定数の導入で満たされる。位置インデックスは字面（5 箇所目のリテラルを作らない）は満たすが趣旨からは外れる。
- **推奨**：`combo-list.ts` に `export const HIT_TYPE_PUNISH_COUNTER = "punish_counter" as const;` 等を追加し `HIT_TYPE_VALUES` をそこから構成、`punish.ts` は名前で参照する。**ただし §8.3（スコープを広げない）に触れるため、M18 では現状維持のうえ followup 送りが妥当**。

### 【中-3】`ComboEditor` でキャラクターを切り替えて保存すると、別キャラのコンボが `combo_punishes` に紐づく

- **場所**：`web/src/features/combo/components/ComboEditor.tsx:88-95`（`punishOpponentMoveId` の決定）と `:353-364`（紐づけ）。
- **事実**：`punishOpponentMoveId` は `location.state` から一度だけ決まり、その後のキャラクター変更（`ComboEditor` はキャラ切替 UI を持ち、CHANGE-036 の確認ダイアログ経由で切替可能）に追随しない。探す画面から遷移して**キャラを変えて保存**すると、`combo_punishes(combo_id, opponent_move_id)` は成功裏に作られるが、そのコンボは `self` のマイリスト（`character_id = self` で絞る）に現れない。
- **影響**：孤児レコードが 1 行できるだけでデータ破壊はなく、`RemovePunish` 相当の解除手段は当該キャラのマイリストから到達可能。発生条件も限定的（探す画面から遷移して、わざわざキャラを変える）。
- **推奨**：`basic.characterId !== self` のときは紐づけをスキップして「別キャラへ変更したため確定反撃の紐づけは行いませんでした」を出す、または紐づけ前にキャラ一致を確認する。**M18 クローズを遅らせる価値はないため followup 相当**。

### 【低-1】seed 依存のマジックナンバー 21／23／7 がテストに直書きされている

- **場所**：`internal/service/punishfinder/service_test.go`（`TestScan_JumpLane_SeedRegression_Existing21PlusNeutral2`）。
- **事実**：`len(oldCandidates) != 21` / `len(newCandidates) != 23` / `len(uniqueAerial) != 7` を `t.Fatalf` で固定している。チェックリスト §8 が要求した内容そのものではあるが、**将来キャラや技を seed に追加した時点で必ず赤くなる**。
- **評価**：意図的な canary（seed 変更時に案C の影響を必ず再確認させる）であれば有効。ただしテスト内に「これは基準時点 2026-07-28 の seed に対する canary であり、seed 追加時は期待値を更新すること」という趣旨のコメントが無いため、次に踏んだ担当者が「壊れたテスト」と誤認して安易に数字だけ書き換える恐れがある。CLAUDE.md 共通規約「マジックナンバーは定数化」の観点でも、`wantLegacyJumpHeavy = 21` 等の名前付き定数＋根拠コメントが望ましい。
- **推奨**：定数化＋根拠コメント（一次源・基準時点）の追加。低優先。

### 【低-2】生成時メッセージが指示書 §4.6-2 の趣旨後半を落としている

- **場所**：`web/src/constants/punish.ts:52-53`。`MATERIALIZE_DAMAGE_ESTIMATE_NOTICE = "始動技が多段の場合、ダメージ加算量は概算です"`。
- **事実**：指示書 §4.6-2 は「始動技が多段の場合、**加算量は概算です。実測値で調整してください**」の趣旨と書いている。実装は前半のみ。§8.2 が細部文言を製造判断としているため規約違反ではないが、**ユーザーが取るべき行動（実測で直す）が伝わらない**。
- **さらに**：完了報告 §2.4 と `progress-log.md` の追記は「『始動技が多段の場合、加算量は概算です。実測値で調整してください』の趣旨を条件判定せず表示する」と書いており、**実装より広く報告している**。DES 反映時に食い違う。
- **推奨**：文言に「実測値で調整してください」を足すか、完了報告の記述を実装に合わせる。

### 【低-3】未知の `damageSkipReason` が silent に落ちる

- **場所**：`web/src/constants/punish.ts:55-64` `materializeDamageDescription()`。
- **事実**：`MATERIALIZE_DAMAGE_SKIP_LABELS[damageSkipReason]` が `undefined` のとき、理由が**何も表示されずに**概算注意だけが出る。BE が将来 4 つ目以降のコードを足して FE 同期を忘れると、「加算されていないのに理由が出ない」＝指示書 §4.3 が繰り返し戒める silent 失敗になる。
- **評価**：M18-03b から続く既存挙動であり本サブの新規劣化ではない。ただし本サブでまさに「コードを 1 つ足す」変更をしており、同期漏れの現実味が上がっている。
- **推奨**：未知コード時に `理由コード: ${code}` 等のフォールバック文言を出す。低優先。

### 【低-4】`PUNISH_COUNTER_HIT_TYPES` の構成に non-null assertion（`!`）が 2 箇所

- **場所**：`web/src/constants/punish.ts:31-32`。`PUNISH_HIT_TYPE_BY_GUARD` の型が `Partial<Record<string, HitType>>` のため `!` が必要になっている。中-2 を解消すれば自然に消える。CLAUDE.md は `any` を禁じているが `!` には言及がないため規約違反ではない。

### 【低-5】curation note のローカル state が送信後にクリアされない

- **場所**：`web/src/features/punish/components/PunishList.tsx:211`（`curationNotes`）。
- **事実**：`使わない` 成功後も `curationNotes[key]` が残る。ただし当該行は第3セクションから消えるため実害はほぼない。解除して戻した際に前回の理由が残っている、という程度。

---

## 推奨修正（優先度別）

### 高（M18 完了前に修正必須）

**なし。** チェックリスト §9 の重大問題に該当する逸脱は検出されなかった。差分は単体・E2E ともに green と報告されており（`make test`：Go 全 package＋Web 118 files/898 tests、E2E 直列 65/65）、本レビューでは静的検証の範囲でこれを覆す事実を見つけていない。

### 中（M19 着手と並行可 ／ ただし 1 件は開発者判断が先）

1. **【中-1・要開発者判断】成立ツリー側「このコンボを新規登録する」の自動採用の扱いを確定する。** 追認するなら完了報告への追記・DES 反映要点への 1 行追加・テスト 1 本の追加。追認しないなら `opponentMoveId` の受け渡しを手動確認レーンに限定。**M18 のクローズ可否そのものは左右しないが、DES 反映の前に決める必要がある**（as-built が実装とずれるため）。
2. **【低-2】完了報告／progress-log と実装の文言不一致を解消する。** DES 反映要点が完了報告を一次源にするため、中央へ渡る前に片付けるのが安い。
3. **【中-2】`hit_type` の名前付き定数化**（`combo-list.ts` への追加＋`punish.ts` の参照差し替え）。§8.3 に照らし M18 では実施せず、followup スラッグ（例 `hit-type-named-constants`）で backlog へ。

### 低（将来対応）

4. 【中-3】`ComboEditor` でキャラ切替後に punish 紐づけをスキップする、または警告する。
5. 【低-1】seed 依存テストの期待値を名前付き定数化し、基準時点・一次源のコメントを添える。
6. 【低-3】未知 `damageSkipReason` のフォールバック文言。
7. 【低-4】中-2 解消に伴う `!` の除去。
8. 【低-5】curation note の送信後クリア。

---

## 良かった点

- **設計思想の核を外していない。** 「変換済みを消さずに理由付きで畳む」「畳む判定に相手技を持ち込まない」「curation をマイリスト本体に置かない」という、指示書が §8.4 で「取り違えの可能性が高い」と名指しした 3 点をすべて正しい側で実装している。§8.4 の警告が機能した形。
- **BE／FE の分界が明確。** 判定は `EXISTS` 相当の SQL 1 本＋出力専用フラグ 1 個に閉じ、FE は `filter` するだけ。レーン別配列に逃げず、走査規則の FE 複製もない。M18-02 で確立した分界を素直に継承している。
- **`TestScan_MaterializedFlagDoesNotDependOnOpponentMove` の作り。** fake を経由せず実 repository／service を通し、相手技 A で採用・変換した基底が相手技 B の走査でも畳まれることを固定している。これは「将来 `opponent_move_id` を判定に混ぜてしまう」という、チェックリスト §9 が重大問題に挙げた退行を確実に捕まえる。fake で済ませなかった判断が良い。
- **部分失敗の設計が明快。** コンボ保存成功＋紐づけ失敗を「ユーザー入力を失わせない方が害が小さい」で一貫させ、toast で両方の事実（保存された／紐づかなかった）を伝え、コンボ詳細へ退避させている。§4.3-3 の指示を字面でなく意図で実装している。
- **`renderCombo` への抽出。** 通常行と折りたたみ行で 60 行超のコンボ行 JSX を二重管理せず、`materialized` フラグ 1 個で差分を表現している。3 サブ連続で触られている `PunishTree.tsx` に対して、行数を増やさない方向に働く良いリファクタ。
- **前提の食い違いを隠さず報告している。** マイグレ末尾 000041→000042、`M18-materialize-damage-scope.md` の不在→relay 読み替え、`M18-01-lessons-learned.md` 単独ファイルの不在。いずれも「指示書と違った」ことを完了報告 §1.1 に事実として残しており、推測で埋めていない（§9 協同方針・E-24 に沿う）。
- **E2E の決定論性への配慮。** 新規 spec が read-only 走査結果と既存 seed 属性からのみ前提を得る設計で、`moves` へ書き込まない流儀（03a・03b）を守っている。並列 flaky も spec 名を列挙し `--workers=1` 65/65 で切り分けており、「既知の flaky」で片付けていない。

---

## 制約事項

- 本レビューは**コード上で判定可能な範囲のみ**を対象とする。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **テストは実行していない**（本コマンドは read-only のレビュー専任のため）。`make test` / `make build` / E2E の green は完了報告 §4 および Codex 側レビューの実行記録に依拠しており、本レビューで再現確認はしていない。
- 開発者の指示により、**検出した指摘の修正は一切行っていない**。コード・テスト・既存ドキュメントへの変更は 0 で、新規作成は本ファイルのみ。Git 操作は `status` / `diff` / `log` の読み取り系のみ。
- `docs/instructions/M18-materialize-damage-scope.md`（指示書 §3.1 の必読資料）は作業ツリーに存在しないため、`M18-materialize-damage-scope-relay.md` を通じた完了報告 §1.1 の読み替え記録を前提に評価した。**原典との照合はできていない**（不明：relay が原典の裁定を過不足なく写しているか）。
- 索引の有無（`combos.materialized_from_combo_id`）およびフルスイート E2E の実測時間は確認していない。
- 既存の `docs/progress/phase3/m18-03c-review.md`（Codex 側レビュー）と本レビューは独立に実施した。中-1／中-2／中-3 および低-1〜低-5 は Codex 側レビューでは挙がっていない。Codex 側の中指摘 1 件（既存 21 件不変・相手技 A→B の回帰テスト不足）は、本レビュー時点で解消済みであることを確認している。

---

*以上、M18-03c レビュー報告書（Claude 版）。配置 `docs/progress/phase3/m18-03c-review_claude.md`。*

---

## 取り込み結果（自動トリアージ）

2026-07-29 に開発者の一次回答と再プラン承認を受け、次のとおり取り込んだ。

| 指摘 | 判定 | 取り込み結果 |
|---|---|---|
| 中-1 成立ツリー側にも自動採用が波及 | **採用・実機FB追補** | `combo_punishes` の自動採用は手動確認レーンだけに限定した。初回取り込みでは `hit_type` プリフィルも成立ツリーから外したが、実機確認後に責務を分離し、両レーンで検索キャラクターとタブ別 `hit_type` を固定する形へ是正した。成立ツリーは保存後に探す画面から明示的に採用する。 |
| 中-2 `hit_type` の名前付き定数化 | **M18 後へ延期** | 現行実装は既存 SSOT を参照しており直近の誤動作はない。M18 の設計凍結範囲を越えるため、`hit-type-named-constants` として後続設計で扱う。これに伴う低-4 の non-null assertion 解消も同時に行う。製造側から中央 backlog／DES 本体は編集していない。 |
| 中-3 キャラクター変更後の誤紐づけ | **採用・強化** | 手動確認レーンからの登録中はキャラクター選択を非活性化した。さらに保存要求値または保存結果が検索時キャラクターと異なる場合は、コンボを保存したまま `combo_punishes` の紐づけをスキップし、理由を警告する防御を追加した。 |
| 低-1 seed 依存の 21／23／7 | **採用** | 基準日と一次源をコメントし、3 数値を用途が分かる名前付き canary 定数へ置き換えた。seed 変更時は案 C の差分を再計測する旨も明記した。 |
| 低-2 materialize の概算通知 | **採用・強化** | 通知は通常のコンボ登録時ではなく、「パニッシュカウンター版を作る」の生成成功時だけに表示する。加算有無と理由に応じて前提から説明し、通常時は「通常版合計＋始動技ダメージの20%」、全経路で多段技の実測差と生成後の調整を案内する。既存 PC 版を返すだけの経路では表示しない。 |
| 低-3 未知の `damageSkipReason` | **採用** | 現時点の既知コード以外は通常発生しないが、BE／FE のバージョンずれや将来コードの同期漏れに備え、未対応理由コードを含むフォールバック表示を追加した。 |
| 低-4 non-null assertion | **M18 後へ延期** | 中-2 と同一の構造課題として `hit-type-named-constants` に統合した。 |
| 低-5 curation note のローカル state | **採用** | 行ごとに保持するブラウザ上の入力値を curation 成功時に削除する。解除後に同じ行が戻った際、古い理由が再表示される将来負債を防ぐ。 |

取り込み後のコード上の未解決指摘は **0 件**。設計判断を伴う後続候補は `hit-type-named-constants` の **1 クラス**であり、M18-03c のクローズを妨げない。

### 実機フィードバック追補（2026-07-29）

開発者の実機確認で次の4点を追加反映した。

1. materialize 新規生成時の説明は文章量が多く既定時間では読み切れないため、当該 toast だけを自動消去しない。×ボタンで明示的に閉じられ、「開く」操作も維持する。共通 `Toaster` の既定値は変更せず、短い通知へ波及させない。
2. 手動確認レーンでは検索タブから `hit_type` が一意に決まるため、プリフィルに加えて選択欄を非活性化する。
3. 成立ツリーでもガード／ジャストパリィに応じた `hit_type` をプリフィル・固定する。ただし `opponentMoveId` は渡さず、`combo_punishes` の自動採用は引き続き行わない。
4. 成立ツリーでも検索時の自キャラクターを固定する。

最終的な分界は、**両レーンでキャラクターと `hit_type` を固定し、自動採用だけを手動確認レーンに限定**する。

最終フィードバックとして、materialize 長文通知の×ボタンを一般的な配置である右上へ変更した。専用 toast クラスの CSS 変数だけを上書きし、共通 `Toaster` と他の通知の左上配置には波及させていない。
