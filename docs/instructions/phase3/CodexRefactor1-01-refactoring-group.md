# 指示書 CodexRefactor1-01: リファクタリンググループ1

| 項目 | 内容 |
|---|---|
| 指示書ID | CodexRefactor1-01 |
| バージョン | 1.0.0 |
| 推奨モデル | Claude Sonnet 4.6 または Codex（Plus）。4件を独立チェックポイントへ分割し、利用枠を跨いで再開可能 |
| Plan Mode | **必須**。CP0 の競合・既存変更・baseline を提示し、開発者承認後に CR1-01 へ進む |
| 製造workflow | `implement_plan_full_wt` |
| 機械レビュー | 必須（`docs/instructions/phase3/reviews/CodexRefactor1-01-review-checklist.md`） |
| 並列性 | M18-02 / M19-01 とファイル非重複を開発者が確認した後のみ並列可 |
| 依存 | Claude 承認済み計画 `docs/progress/phase3/CodexRefactor1-refactoring-group/refactoring-plan.md` v1.0.1 |
| 想定所要時間 | 実装・自動検証 120〜180分 + 開発者のcheckpoint commitと手動アプリ確認 |
| 作成者・作成日 | Codex（CodexRefactor1 指示書担当）/ 2026-07-23 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|---|---|---|
| 1.0.0 | 2026-07-23 | Claude承認済み計画を製造可能な4チェックポイントへ具体化。worktree guard、開発者commit、停止・再開、fresh reviewerを明文化。 |

---

## 0. workflow互換情報と最優先ガード

### 0.1 起動方法

- Claude Code: `/implement_plan_full_wt CodexRefactor1-01-refactoring-group.md`
- Codex: Skill `$combomgr-manufacturing-workflow` で workflow
  `implement_plan_full_wt`、引数 `CodexRefactor1-01-refactoring-group.md` を指定する。

`.claude/commands/implement_plan_full_wt.md` と
`.claude/commands/implement_plan_full.md` はworkflowの正本である。本指示書は4件の実装仕様だけを追加し、
正本を複製・改訂しない。

### 0.2 非マイルストーン名の明示的な導出値

`implement_plan_full` は通常 `M{X}-{YZ}` を解析する。本タスクは開発者承認済みの非マイルストーン名なので、
次の値を使用する。

| 導出対象 | 本タスクの値 |
|---|---|
| タスク識別子 | `CodexRefactor1-01` |
| 小文字タスク識別子 | `codexrefactor1-01` |
| 指示書 | `docs/instructions/phase3/CodexRefactor1-01-refactoring-group.md` |
| checklist | `docs/instructions/phase3/reviews/CodexRefactor1-01-review-checklist.md` |
| workflow標準review report | `docs/progress/phase3/codexrefactor1-01-review.md` |
| 現タスクの重大指摘ラベル | `CodexRefactor1完了前に修正必須` |
| 次グループ指摘ラベル | `CodexRefactor2以降で対応` |

マイルストーン番号 `X` と `X+1` は算出しない。review promptとreview reportで
`M{X}` / `M{X+1}` の代わりに上表のラベルを使用する。

### 0.3 worktree guardとGit

`implement_plan_full_wt` のguardを全工程の最優先とする。

- 現在地がパスセグメント `/wt-` を含むworktree内であることをworkflow開始時に確認する。
- 読み書きはworktree内の相対パスだけを使う。`../` でworktree外へ出ない。
- 実装担当・fresh reviewerは、`git status`、`git diff`、`git log`、`git add`、`git commit`を含む
  Gitコマンドを実行しない。品質フックが内部で行うread-only Gitだけはworkflow guardの例外とする。
- branch作成、切替、commit、merge、pushは開発者が行う。
- 各CPの実装担当は検証と`status.md`更新後、`開発者commit待ち`で停止する。
  開発者がcommit hashを返信するまで次のCPへ進まない。
- `docs/human-notes/Memo_Someday.txt`には本タスク開始前から未commit変更がある。
  実装担当は編集せず、checkpoint commitにも含めない。

### 0.4 fresh reviewer

Phase Bだけでfresh reviewerを起動する。会話文脈を継承するforkは使用しない。
fresh reviewerも本worktree内だけを読み、Gitコマンドを実行しない。
変更範囲は本指示書§2.1、実装結果は
`docs/progress/phase3/CodexRefactor1-refactoring-group/implementation-report.md` から確認する。

---

## 1. 背景と目的

### 1.1 背景

`docs/human-notes/Memo_Someday.txt` には、小規模な保守・表示改善と、
画面設計やM18/M19に接続する大きな要望が混在している。Claudeレビューで承認された計画は、
M18-02 / M19-01の共有定数、検索、提案engine、setup保存、DB/APIを避け、次の4件だけを採用した。

1. TypeScriptの`baseUrl`非推奨対応（Memo 93行目）。
2. 省略タグ`+N`から隠れたタグ名を確認できる表示（Memo 136行目）。
3. 技編集tooltipから内部フィールド名`is_aerial`を除去（Memo 40行目）。
4. 既存折りたたみ操作へ`隠す` / `表示`ラベルを追加（Memo 302行目）。

既存実装の構造・責務・Propsは次のとおりである。

- `TagBadgeList`: タグ配列をcategory除外後にbadge表示し、`maxVisible`超過を`+N`へ畳む。
  Propsは`tags` / `excludeCategories` / `maxVisible` / `size`。
- `MoveEditGrid`: 技編集とラッシュ版生成を扱う。未保存の`isAerial`変更中はラッシュ版生成を無効化する。
- `CollapsibleFieldset`: `legend` / `defaultOpen` / `summary` / `children` /
  `contentClassName` / `data-testid`を受け、summaryを開閉状態に関係なく表示する。
- `web/e2e/tsconfig.json`は`web/tsconfig.json`をextendsする。

### 1.2 目的

完了時に次を達成する。

- `@/` aliasを維持したまま`web/tsconfig.json`から`baseUrl`を除去する。
- コンボ一覧で省略された通常タグ名を、`+N`のhoverとaccessible nameから確認できる。
- 技編集の利用者向けtooltipに`is_aerial`が出ない。
- コンボ新規・編集の折りたたみ操作が文字でも判別できる。
- API、schema、migration、保存データ、M18/M19の実装を変更しない。
- 各CPで停止しても`status.md`から再開できる。

### 1.3 このグループで作らないもの

- 検索filterの折りたたみ（Memo 239/301行目）。
- editor左右panelの折りたたみと他方拡張（Memo 303行目）。
- マイコンボ件数表示、toastの位置・表示時間、比較画面の新規導線。
- 始動技ID sort表示、hit type定数、M18確反検索、M19セットプレイ提案。
- Radix Tooltipなどを使う新しいtooltip component。
- i18n key。編集面の`隠す` / `表示`と技編集tooltipは固定jaとする。
- E2E specの新設。
- REQ / DES / CHANGE、DB schema、migration、API、Goコード、依存packageの変更。

上記を実装で補完しない。新しい仕様判断が要る場合は`status.md`を`blocked`へ更新して停止する。

---

## 2. 成果物と変更境界

### 2.1 作成・修正を許可するファイル

| ファイル | 操作 | 内容 |
|---|---|---|
| `web/tsconfig.json` | 修正 | `baseUrl`除去、alias相対path明示 |
| `web/src/features/tag/components/TagBadgeList.tsx` | 修正 | 隠れたタグ名の`title` / `aria-label` |
| `web/src/features/tag/components/TagBadgeList.test.tsx` | 修正 | overflow表示の回帰テスト |
| `web/src/features/moves/MoveEditGrid.tsx` | 修正 | 内部名を含むtooltip文言の置換 |
| `web/src/features/moves/MoveEditGrid.test.tsx` | 修正 | tooltipとdirty guardの回帰テスト |
| `web/src/features/combo/components/CollapsibleFieldset.tsx` | 修正 | `隠す` / `表示`ラベル |
| `web/src/features/combo/components/CollapsibleFieldset.test.tsx` | 新規 | 開閉・summary・accessibilityの単体テスト |
| `docs/progress/phase3/CodexRefactor1-refactoring-group/status.md` | 更新 | 再開地点の正本 |
| `docs/progress/phase3/CodexRefactor1-refactoring-group/implementation-report.md` | CP5で新規 | 実装・検証・手動確認待ちの報告 |
| `docs/progress/phase3/codexrefactor1-01-review.md` | Phase Bで新規 | workflow標準のfresh review報告 |

Phase Cでreview reportへトリアージ結果を追記することは許可する。

### 2.2 変更禁止

- §2.1にないソース、test、config。
- `web/src/constants/combo-list.ts`。
- `web/package.json`、`web/pnpm-lock.yaml`。
- `docs/design/`、`docs/change-notes/`。
- M18/M19のoverview、指示書、review checklist、progress report。
- `docs/progress/progress-log.md`、`docs/progress/progress-summary.md`。
- `.claude/`、`.codex/`、`.agents/`。
- `docs/human-notes/Memo_Someday.txt`。

§2.1外の変更が不可欠と判明した場合、変更せずに停止して開発者へ対象pathと理由を報告する。

### 2.3 凍結する既存契約

- `TagBadgeListProps`とvisible tagの順序・色・size・category除外。
- `+N`という可視文字列。
- `MoveEditGrid`の保存、mutation、ラッシュ適格性、dirty guard。
- `CollapsibleFieldset`のProps、初期全展開、summary常時表示、childrenのmount条件、
  `aria-expanded`、`aria-controls`。
- 全API request/response、queryKey、永続化、route。

### 2.4 例外条項

該当なし。バックエンド、依存package、design documentへ変更を広げない。

---

## 3. 前提条件とCP0

### 3.1 必読

1. `AGENTS.md`
2. `CLAUDE.md`
3. 本指示書
4. `docs/instructions/phase3/reviews/CodexRefactor1-01-review-checklist.md`
5. `docs/progress/phase3/CodexRefactor1-refactoring-group/refactoring-plan.md`
6. `docs/progress/phase3/CodexRefactor1-refactoring-group/status.md`
7. `docs/handover/docs-map.md`
8. `docs/handover/code-facts.md`の`CollapsibleFieldset`、`MoveEditGrid`、`TagBadgeList` Props行
9. `docs/instructions/phase1/M3-02-tag-assignment-ui.md` §4.5
10. `docs/instructions/phase2/M12-04-character-selector-unification.md` §4.2 / §5.1
11. `docs/instructions/phase3/M15-05-display-tidy-compare-id-bug.md` §4.1 / §5
12. `docs/instructions/phase3/M18-02-design-outline.md`と`docs/instructions/M19-overview.md`のスコープ

### 3.2 参照不要

- M18/M19のDB・engine・migration詳細。
- import/export、virtual controller、seedgen。
- retrospective-log全量。

### 3.3 CP0で開発者から確認する事項

実装担当は次をPlan Modeに列挙し、回答を待つ。

1. 現在地が対象`wt-*` worktreeである。
2. `Memo_Someday.txt`の既存変更は別所有で、CodexRefactor1のcommitに含めない。
3. M18-02 / M19-01の並列作業は§2.1のソース・test・configを変更していない。
4. 開発者が確認したworktree状態に、所有者不明の変更がない。

4項目の回答が揃わない状態ではコード編集へ進まない。

### 3.4 CP0 baseline

開発者確認後、実装担当はGitを使わず次を実行する。

```bash
cd web
pnpm lint
pnpm test --run
pnpm exec tsc --noEmit -p e2e/tsconfig.json
```

結果を`status.md`へ、コマンド、成功/失敗、実行日時、失敗test名まで記録する。
baseline failureが本タスク候補に関係する場合は停止する。
候補外のbaseline failureも無視せず、開発者へ切り分けを依頼する。

---

## 4. 詳細仕様

### 4.1 CR1-01: `baseUrl`除去

対象は`web/tsconfig.json`だけである。

変更後のalias設定を次へ固定する。

```json
"paths": {
  "@/*": ["./src/*"]
}
```

- `"baseUrl": "."`を削除する。
- target、module、moduleResolution、strict、include、exclude、typesを変更しない。
- `web/e2e/tsconfig.json`のextends関係を変更しない。
- import文を一括変更しない。

検証:

```bash
cd web
pnpm lint
pnpm test --run
pnpm exec tsc --noEmit -p e2e/tsconfig.json
pnpm build
```

成功後、`status.md`を`CP1 開発者commit待ち`へ更新して停止する。
開発者向けcommit例:
`chore(CodexRefactor1/ts): remove deprecated baseUrl`

### 4.2 CR1-02: 省略タグ名

対象は`TagBadgeList.tsx`と同testだけである。

1. `excludeCategories`適用後の`visible`を正本とする。
2. `shown`の後ろにあるtagを`hidden`として配列化する。
3. `overflow`は`hidden.length`から算出する。
4. `overflow > 0`のbadgeは可視文字列`+N`を維持する。
5. 同badgeの`title`と`aria-label`を次の形式へ固定する。

```text
省略されたタグ{N}件: {タグ名1}、{タグ名2}
```

例:

```text
省略されたタグ2件: 対空、端限定
```

- tag名の順序は入力順を維持する。
- 区切りは日本語読点`、`とする。
- `maxVisible`未指定、またはoverflow 0ではoverflow badgeと属性を生成しない。
- `Badge`、色計算、fallback色、visible badgeには変更を加えない。
- 新規tooltip componentとdependencyを追加しない。

追加・更新するtestは3ケースとする。

1. `maxVisible=1`、3 tagsで`+2`、`title`、`aria-label`が隠れた2名を入力順で含む。
2. category除外を先に適用し、除外tag名が`title`と`aria-label`へ混入しない。
3. overflow 0では`+N`とoverflow用`title`が存在しない。

検証:

```bash
cd web
pnpm test --run src/features/tag/components/TagBadgeList.test.tsx
pnpm lint
```

成功後、`status.md`を`CP2 開発者commit待ち`へ更新して停止する。
開発者向けcommit例:
`fix(CodexRefactor1/tag): expose hidden tag names`

### 4.3 CR1-03: 技編集tooltip

対象は`MoveEditGrid.tsx`と同testだけである。

ラッシュ版buttonの`isAerialDirty`分岐で、利用者向け`title`を次へ置換する。

```text
空中設定を変更したら先に保存してください
```

- source code内の変数名、コメント、test名で技術的に必要な`is_aerial` / `isAerial`は変更しない。
- 利用者が読むDOM属性へ`is_aerial`を出さない。
- `rushVariantExists`、`isAerialDirty`、`rushEligible`の分岐順と値を変更しない。
- buttonのdisabled条件、click handler、mutationを変更しない。

testは次の2経路を固定する。

1. 非空中技を空中へ変更した未保存状態でbuttonがdisabled、`title`が上記日本語と一致する。
2. 空中技を非空中へ変更した未保存状態でもbuttonがdisabled、同じ`title`になり、
   `title`に`is_aerial`を含まない。

既存testへassertionを追加してよい。テスト目的が1件に混在して読みにくくなる場合はtest caseを分ける。

検証:

```bash
cd web
pnpm test --run src/features/moves/MoveEditGrid.test.tsx
pnpm lint
```

成功後、`status.md`を`CP3 開発者commit待ち`へ更新して停止する。
開発者向けcommit例:
`fix(CodexRefactor1/moves): hide internal field name`

### 4.4 CR1-04: 折りたたみ状態ラベル

対象は`CollapsibleFieldset.tsx`と新規unit testだけである。

button右側に、状態ラベルと既存chevronをまとめたcontrol groupを置く。

- `open === true`: `隠す`
- `open === false`: `表示`
- labelはbutton内部でchevronの隣に表示する。
- control groupは`shrink-0`、labelとiconの間は`gap-1`とする。
- labelは`text-xs font-normal text-gray-500`とする。
- legendとcontrol groupの間に`ml-2`を置く。
- chevronへ`aria-hidden="true"`を付ける。
- 既存の回転animationを維持する。
- Propsを増減しない。
- `summary`は閉じた後もDOMに残す。
- `children`は閉じたときDOMから外す既存挙動を維持する。
- `aria-expanded`と`aria-controls`を維持する。
- 固定jaの編集面なのでi18n keyを追加しない。

新規`CollapsibleFieldset.test.tsx`は3ケースとする。

1. 既定openで`隠す`、children、summary、`aria-expanded="true"`、`aria-controls`対応を確認する。
2. click後に`表示`、children非表示、summary表示継続、`aria-expanded="false"`を確認し、
   再clickでopenへ戻る。
3. `defaultOpen={false}`で初期`表示`、children非表示、summary表示を確認する。

accessibility queryはbuttonのaccessible nameにlegendと状態ラベルが含まれることを確認する。

検証:

```bash
cd web
pnpm test --run src/features/combo/components/CollapsibleFieldset.test.tsx
pnpm lint
```

成功後、`status.md`を`CP4 開発者commit待ち`へ更新して停止する。
開発者向けcommit例:
`fix(CodexRefactor1/combo): label collapsible sections`

---

## 5. checkpoint、停止、再開

### 5.1 各CPの共通手順

1. `status.md`を`実装中`へ更新する。
2. 当該CPの許可fileだけを編集する。
3. focused testと指定quality commandを実行する。
4. `status.md`へ変更file、test結果、日時、未解決事項、再開後の最初の操作を記録する。
5. `status.md`を`開発者commit待ち`へ更新する。
6. 実装担当はGitを使わず停止し、開発者へcommit対象fileとcommit例を報告する。
7. 開発者がcommit hashを返信した後、実装担当はhashを`status.md`へ記録して次のCPへ進む。

### 5.2 クラッシュ・利用枠終了からの再開

再開者は次の順に読む。

1. 本指示書。
2. `status.md`。
3. 開発者が提示した最後のcommit hashとworktree状態。
4. 現在CPの許可file。

`status.md`と開発者提示が一致しない場合は編集せず停止する。
途中の変更を破棄、stash、restore、reset、checkoutしない。

### 5.3 Phase C修正

fresh reviewの指摘をPhase Cで採用してコードを変更した場合、`CP-R`として扱う。
対象testと§6.1の統合検証を再実行し、開発者commit待ちで停止する。
優先度「高」を不採用にする場合はworkflow正本どおり開発者へエスカレーションする。

---

## 6. 統合検証と手動確認

### 6.1 CP5自動検証

CR1-01〜04の開発者commit完了後に次を実行する。

```bash
cd web
pnpm lint
pnpm test --run
pnpm exec tsc --noEmit -p e2e/tsconfig.json
pnpm build
cd ..
make test
make build
```

同じ失敗を隠す再実行はしない。失敗時は最初の失敗内容を`status.md`へ記録し、
本タスク変更との因果を切り分けて停止する。

`make e2e`とE2E spec新設は本グループの自動DoDへ含めない。
route/API/保存flowを変更しないため、component unit test、全frontend test、E2E TypeScript検査、
production build、開発者の手動確認を受入れgateとする。

### 6.2 Phase B / C

§6.1成功後、`implement_plan_full_wt`のPhase Bへ進む。

- fresh reviewerはchecklistに従い、コードを変更しない。
- review reportは`docs/progress/phase3/codexrefactor1-01-review.md`へ作成する。
- reviewerはGitコマンドを使わない。
- Phase Cは全指摘の採否と理由をreview report末尾へ追記する。
- Phase Cの修正は§5.3の開発者commit gateを通す。

### 6.3 implementation report

`docs/progress/phase3/CodexRefactor1-refactoring-group/implementation-report.md`へ次を記録する。

- CP0〜CP5の結果。
- 各CPの開発者提示commit hash。
- 変更file全件。
- focused test、全test、typecheck、buildの結果と実行日時。
- review report pathとPhase Cの採否要約。
- REQ / DES / CHANGE不要、schema/API/依存変更なしという判定。
- 開発者手動確認の未実施/合格/不合格。
- 既知の制約。

### 6.4 計画された中断: 開発者の手動アプリ確認

Phase Cと再検証が完了したら、`status.md`を`手動確認待ち`へ更新して停止する。
開発者へ次を依頼する。

1. コンボ一覧で通常tagを4件以上持つ行を表示し、`+N` hoverで隠れたtag名を全件確認する。
2. `mycombo_status` categoryが通常tagのoverflow表示へ混入しないことを確認する。
3. 技編集で空中設定を切り替え、未保存中のラッシュ版buttonがdisabledかつtooltipが日本語だけであることを確認する。
4. コンボ新規・編集で、各sectionのopen時`隠す`、closed時`表示`を確認する。
5. recipe summaryと入力値が開閉で壊れないことを確認する。
6. PC 2 columnとmobile 1 columnでlabelとchevronの重なり、横overflowがないことを確認する。
7. 代表画面を再読込し、`@/` import解決に起因するblank screenがないことを確認する。

開発者が全7項目の合格を返信した後に`status.md`を`完了`へ更新する。
不合格項目は該当CPへ戻し、修正、test、review追記、開発者commit gateを通す。

---

## 7. テスト要件まとめ

| 対象 | 必須確認 |
|---|---|
| CR1-01 | frontend typecheck、E2E tsconfig typecheck、全Vitest、production build |
| CR1-02 | overflow名、category除外順、overflowなしの3ケース |
| CR1-03 | `isAerial`両方向dirty、disabled、exact tooltip、内部名非露出 |
| CR1-04 | 既定open、toggle往復、default closed、summary、children、ARIAの3ケース |
| 統合 | `pnpm lint`、`pnpm test --run`、E2E TS typecheck、`pnpm build`、`make test`、`make build` |
| 実機 | §6.4の7項目 |

testのskip、`.only`、snapshotの無条件更新、型error抑止、`eslint-disable`追加でgreen化しない。

---

## 8. レビュー観点

機械reviewは
`docs/instructions/phase3/reviews/CodexRefactor1-01-review-checklist.md`
を使用する。最重要gateは次の5点である。

1. §2.1外のsource/configを変更していない。
2. API/schema/design/M18/M19へ変更を広げていない。
3. 凍結契約と既存挙動を保っている。
4. 指定testが境界条件とaccessibilityを検証している。
5. worktree guard、開発者commit、停止・再開記録を守っている。

---

## 9. 完了条件（Definition of Done）

### 9.1 機能

- [ ] CR1-01〜04が§4どおり完了。
- [ ] §2.3の凍結契約が不変。
- [ ] 手動確認7項目が開発者合格。

### 9.2 自動検証

- [ ] focused testが全件green。
- [ ] §6.1の7コマンドが全件green。
- [ ] skip、`.only`、error抑止による見かけのgreenがない。

### 9.3 review

- [ ] fresh reviewerがreportを作成。
- [ ] Phase Cの全指摘に採否と理由がある。
- [ ] 重大指摘ゼロ、または採用修正後の再reviewで解消。

### 9.4 progressと再開性

- [ ] `status.md`が現在地と最後の開発者提示hashを示す。
- [ ] `implementation-report.md`が§6.3を満たす。
- [ ] workflow review reportが所定pathにある。

### 9.5 非変更

- [ ] REQ / DES / CHANGE、schema、migration、API、Go、依存packageに差分なし。
- [ ] M18/M19文書・コードに差分なし。
- [ ] `Memo_Someday.txt`の既存変更を本タスクが編集・commitしていない。
- [ ] 実装担当・reviewerがGitコマンドを実行していない。

---

## 10. 注意事項

### 10.1 推測で進めてはいけない事項

- M18/M19との実ファイル競合。
- §2.1外の変更要否。
- native `title`以外のtooltip UIへの拡張。
- `CollapsibleFieldset`のProps、mount、layout責務の変更。
- 設計書改訂の要否。本指示書内の仕様で収まらない場合は不要と断定せず停止する。

### 10.2 実装担当に認める裁量

- test case名。
- §4.4で固定したclass群を保った範囲のJSX改行。
- 既存testへassertionを追加するか、新しいtest caseへ分離するか。
- `hidden`とoverflow labelをcomponent内のlocal constとして置く順序。

裁量を使った箇所はimplementation reportへ記録する。

### 10.3 不明事項

不明点は`status.md`を`blocked`へ更新し、
「対象節」「確認したfile」「決められない選択肢」「推奨案」を開発者へ提示して停止する。

---

## 11. 完了後

開発者の手動確認合格後、開発者がmainへの統合を行う。
CodexRefactor2は統合後の最新mainから新しいbranch/worktreeを作成する。
実装担当はbranch作成、merge、pushを行わない。

---

*以上、CodexRefactor1-01 製造指示書 v1.0.0。4件を独立checkpointで実装し、各checkpointは開発者commit待ちで停止する。*
