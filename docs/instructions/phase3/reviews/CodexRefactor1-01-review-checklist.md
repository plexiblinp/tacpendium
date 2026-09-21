# CodexRefactor1-01 レビューチェックリスト

| 項目 | 内容 |
|---|---|
| 対象指示書 | `docs/instructions/phase3/CodexRefactor1-01-refactoring-group.md` v1.0.0 |
| 対象指示書ID | CodexRefactor1-01 |
| レビューモデル | Claude Sonnet 4.6 または同等以上。fresh reviewerを使用 |
| バージョン | 1.0.0 |
| 作成者・作成日 | Codex（CodexRefactor1 指示書担当）/ 2026-07-23 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|---|---|---|
| 1.0.0 | 2026-07-23 | 初版。CR1-01〜04、非破壊性、worktree guard、再開性を検査対象化。 |

---

## 0. reviewerへの前置き

### 0.1 独立性と操作制限

- 製造担当の会話文脈を継承しないfresh reviewerとして実施する。forkを使用しない。
- コードを変更しない。
- Gitコマンドを実行しない。
- 作成可能なfileは`docs/progress/phase3/codexrefactor1-01-review.md`だけ。
- review対象差分は指示書§2.1と
  `docs/progress/phase3/CodexRefactor1-refactoring-group/implementation-report.md`
  の変更file一覧から特定する。

### 0.2 必読

1. `AGENTS.md`
2. `CLAUDE.md`
3. 対象指示書
4. 本checklist
5. `docs/progress/phase3/CodexRefactor1-refactoring-group/refactoring-plan.md`
6. `docs/progress/phase3/CodexRefactor1-refactoring-group/status.md`
7. `docs/progress/phase3/CodexRefactor1-refactoring-group/implementation-report.md`
8. `docs/handover/code-facts.md`の対象3component Props
9. `docs/instructions/phase1/M3-02-tag-assignment-ui.md` §4.5
10. `docs/instructions/phase2/M12-04-character-selector-unification.md` §4.2 / §5.1
11. `docs/instructions/phase3/M15-05-display-tidy-compare-id-bug.md` §4.1 / §5

### 0.3 報告形式

各check項目を`✓ / ✗ / N-A`で評価する。
`✗`には指示書節、実file path、行番号、再現または検証方法を付ける。

優先度は次を使用する。

- 高: CodexRefactor1完了前に修正必須。
- 中: 手動確認前の修正を推奨。完了を妨げるかは影響を明記。
- 低: CodexRefactor2以降で対応可能。

---

## 1. scopeと並列安全性

- [ ] 変更source/config/testが指示書§2.1の7件だけである。
- [ ] progress成果物が専用folderとworkflow標準review reportだけである。
- [ ] `Memo_Someday.txt`を本実装が編集していない。
- [ ] `web/src/constants/combo-list.ts`を変更していない。
- [ ] M18/M19のcode、design、instruction、review、progressを変更していない。
- [ ] `docs/progress/progress-log.md`と`progress-summary.md`を変更していない。
- [ ] package、lockfile、Go、API、schema、migrationに変更がない。
- [ ] 新しい依存libraryを追加していない。

---

## 2. CR1-01: TypeScript設定

- [ ] `web/tsconfig.json`から`baseUrl`だけが除去されている（指示書§4.1）。
- [ ] aliasが`"@/*": ["./src/*"]`である。
- [ ] target、module、moduleResolution、strict、include、exclude、typesが不変。
- [ ] `web/e2e/tsconfig.json`とimport文を変更していない。
- [ ] frontend typecheckとE2E tsconfig typecheckがgreen。
- [ ] production buildがgreenで、`@/` alias解決errorがない。

---

## 3. CR1-02: 省略タグ

- [ ] `hidden`はcategory除外後の`visible`から`maxVisible`以降を取り出している（指示書§4.2）。
- [ ] `overflow`はhidden tag件数と一致する。
- [ ] 可視文字列`+N`が不変。
- [ ] `title`と`aria-label`が
  `省略されたタグ{N}件: {名前を日本語読点区切り}`に一致する。
- [ ] hidden tagの順序が入力順。
- [ ] 除外categoryのtag名がoverflow属性へ混入しない。
- [ ] overflow 0と`maxVisible`未指定ではoverflow badgeを生成しない。
- [ ] visible badgeの色、fallback、size、順序が不変。
- [ ] Radix Tooltip、state、dependencyを追加していない。
- [ ] 指示書§4.2の3 test caseが境界を実際にassertしている。

---

## 4. CR1-03: 技編集tooltip

- [ ] dirty時のtitleが`空中設定を変更したら先に保存してください`と完全一致する。
- [ ] 利用者向けDOM属性に`is_aerial`が残っていない。
- [ ] sourceの技術用identifierを無意味にrenameしていない。
- [ ] `rushVariantExists`、`isAerialDirty`、`rushEligible`の分岐順が不変。
- [ ] disabled条件、click handler、mutationが不変。
- [ ] 非空中→空中と空中→非空中の両dirty経路がtestされている。
- [ ] 両経路でbutton disabled、exact title、内部名非露出をassertしている。

---

## 5. CR1-04: 折りたたみ状態ラベル

- [ ] open時`隠す`、closed時`表示`がbutton内のchevron隣に出る。
- [ ] control groupに`shrink-0`と`gap-1`、labelに`text-xs font-normal text-gray-500`、
  legendとの間に`ml-2`がある。
- [ ] chevronが`aria-hidden="true"`で、既存回転animationを維持する。
- [ ] Propsを変更していない。
- [ ] `defaultOpen`既定trueが不変。
- [ ] summaryがopen/closedの両方で表示される。
- [ ] childrenがclosed時にDOMから外れる。
- [ ] `aria-expanded`と`aria-controls`の対応が正しい。
- [ ] i18n keyを追加せず、固定ja境界を維持する。
- [ ] buttonのaccessible nameにlegendと状態ラベルが含まれる。
- [ ] 指示書§4.4の3 test caseがopen、往復toggle、default closedを検証する。

---

## 6. testとbuild

- [ ] `TagBadgeList.test.tsx`の追加testが属性値と除外順を直接検証する。
- [ ] `MoveEditGrid.test.tsx`が既存dirty guardを弱めていない。
- [ ] `CollapsibleFieldset.test.tsx`がReact Testing Libraryで利用者視点のqueryを使う。
- [ ] testに`.only`、恒久skip、無条件snapshot更新がない。
- [ ] 型errorをcastや抑止directiveで隠していない。
- [ ] focused test結果がimplementation reportにある。
- [ ] `pnpm lint`、`pnpm test --run`、E2E TS typecheck、`pnpm build`、
  `make test`、`make build`の結果がimplementation reportにある。
- [ ] 失敗を再実行だけで消した扱いにしていない。
- [ ] E2E spec非追加がroute/API/保存flow不変という本指示書の境界と整合する。

---

## 7. checkpointと再開性

- [ ] statusがCP0〜CP5の結果を示す。
- [ ] 各CPの変更file、test、日時、再開後の最初の操作が記録されている。
- [ ] 各CPに開発者提示commit hash、または現在の`開発者commit待ち`が記録されている。
- [ ] 実装担当がcommitを実行した記録がない。
- [ ] 実装担当・reviewerがGitコマンドを実行した記録がない。
- [ ] crash時に変更破棄、stash、restore、reset、checkoutを指示していない。
- [ ] implementation reportが変更file、test、review、設計変更不要判定、手動確認状態を含む。

---

## 8. 手動アプリ確認gate

- [ ] 指示書§6.4の7項目が開発者へ提示されている。
- [ ] Phase C完了時点でstatusを`手動確認待ち`にして停止している。
- [ ] 開発者合格前にstatusを`完了`としていない。
- [ ] 不合格修正は該当testとCP-Rのcommit gateへ戻す手順になっている。

---

## 9. 設計意図との整合

- [ ] 4件とも既存仕様を具体化・修正する範囲で、REQ / DES / CHANGEを要する新仕様を作っていない。
- [ ] TagBadgeListの通常tag表示と`mycombo_status`責務分離を維持する。
- [ ] MoveEditGridのC-20「内部値を利用者へ出さない」をtooltipまで一貫させる。
- [ ] CollapsibleFieldsetはM15-05の折りたたみ責務を保ち、左右panel拡張へ踏み込んでいない。
- [ ] M18検索とM19提案UIへ先回り実装していない。

---

## 10. 重大な問題の判定基準

次は完了承認を妨げる。

- §2.1外のsource/config変更、またはM18/M19変更。
- API、schema、migration、保存data、dependency、design documentの変更。
- `@/` alias解決の破壊。
- overflow件数・hidden名・category除外順の誤り。
- `is_aerial`が利用者向けtooltipへ残る、またはrush dirty guardの破壊。
- CollapsibleFieldsetのProps、summary、children mount、初期open、ARIAの破壊。
- test/build failure、testの無効化、型errorの抑止。
- freshでないreviewer、review report欠落、Phase C採否理由欠落。
- 実装担当またはreviewerによるGit操作。
- 開発者手動確認前の完了判定。

---

## 11. 軽微な問題の判定基準

- 指示書で固定していないtest case名の改善。
- implementation reportの文言整理。
- 機能・accessibility・狭幅表示に影響しないJSX改行。

軽微と判定した理由と、CodexRefactor2へ送るかをreportへ記録する。

---

## 12. review完了判定

- §1〜§9が全て`✓`または根拠付き`N-A`。
- §10の重大問題がゼロ。
- 自動検証が全件green。
- review reportが`docs/progress/phase3/codexrefactor1-01-review.md`にある。
- Phase Cの採否と理由がreport末尾に追記されている。
- 開発者手動確認だけが残る場合、コードreviewは合格とし、タスク状態は`手動確認待ち`のままにする。

---

*以上、CodexRefactor1-01 レビューチェックリスト v1.0.0。非破壊性、4件の境界、worktree guardを最重要gateとする。*
