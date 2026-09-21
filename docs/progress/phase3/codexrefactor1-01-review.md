# CodexRefactor1-01 レビュー報告書

## 総評

CR1-01〜04はいずれも指示書の変更境界と凍結契約を守って実装されており、重大・中程度の指摘はない。
追加・更新されたテストは要求された境界を直接検証しており、レビュー時に対象3 file・26 test、lint、
E2E TypeScript typecheck、production buildの成功を再確認した。コードレビューは合格と判定する。
Phase Cの採否記録と開発者の手動アプリ確認は未実施のため、タスク全体は引き続き手動確認待ちとする。

## 設計準拠性レビュー結果

### §1 scopeと並列安全性

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | source/config/testの変更file一覧は指示書§2.1の7件だけである（実装報告「変更file」で確認）。 |
| 2 | ✓ | progress成果物は専用folderの`status.md`・`implementation-report.md`とworkflow標準review reportだけである。 |
| 3 | ✓ | `Memo_Someday.txt`は本実装の変更対象に含まれず、非編集が実装報告とstatusに明記されている。 |
| 4 | ✓ | `web/src/constants/combo-list.ts`は変更file一覧に含まれず、対象実装からも参照追加されていない。 |
| 5 | ✓ | M18/M19のcode、design、instruction、review、progressは変更file一覧に含まれない。 |
| 6 | ✓ | `docs/progress/progress-log.md`と`docs/progress/progress-summary.md`は変更file一覧に含まれない。 |
| 7 | ✓ | package、lockfile、Go、API、schema、migrationに変更がないことが実装報告に明記されている。 |
| 8 | ✓ | 新しい依存libraryは追加されておらず、既存React・Vitest・Testing Libraryだけで実装されている。 |

注: Gitコマンド禁止のため、scope項目は指示書§0.4・checklist §0.1に従い、実装報告の変更file一覧と
対象7 fileの現物を照合して判定した。

### §2 CR1-01: TypeScript設定

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | `web/tsconfig.json`に`baseUrl`は存在しない（指示書§4.1）。 |
| 2 | ✓ | aliasは`"@/*": ["./src/*"]`である（`web/tsconfig.json:21-23`）。 |
| 3 | ✓ | target、module、moduleResolution、strict、include、exclude、typesは指定値を維持している。 |
| 4 | ✓ | `web/e2e/tsconfig.json`とimport文は変更file一覧に含まれない。 |
| 5 | ✓ | frontend typecheckは実装報告で成功、E2E tsconfig typecheckは実装報告およびレビュー時再実行で成功した。 |
| 6 | ✓ | production buildは実装報告およびレビュー時再実行で成功し、`@/` alias解決errorはない。 |

### §3 CR1-02: 省略タグ

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | `hidden`はcategory除外後の`visible`を`maxVisible`からsliceしている（`web/src/features/tag/components/TagBadgeList.tsx:30-38`、指示書§4.2）。 |
| 2 | ✓ | `overflow`は`hidden.length`から算出される（同file:38）。 |
| 3 | ✓ | overflow badgeの可視文字列は`+{overflow}`を維持する（同file:58-66）。 |
| 4 | ✓ | `title`と`aria-label`は同一の`省略されたタグ{N}件: {日本語読点区切りの名前}`である（同file:39,62-63）。 |
| 5 | ✓ | `filter`と`slice`が配列順を保ち、hidden tag名は入力順でjoinされる（同file:30-39）。 |
| 6 | ✓ | category除外を`visible`導出時に先行し、除外tag名はoverflow属性へ混入しない。testでも直接検証している（`TagBadgeList.test.tsx:52-69`）。 |
| 7 | ✓ | overflow 0では条件renderされず、`maxVisible`未指定では`hidden=[]`となるためoverflow badgeを生成しない。testは両境界を検証している（同test:24-34,71-79）。 |
| 8 | ✓ | visible badgeの色、fallback、size、順序の処理は維持されている（`TagBadgeList.tsx:41-57`）。 |
| 9 | ✓ | Radix Tooltip、state、dependencyは追加されていない。native `title`だけを使用している。 |
| 10 | ✓ | 指示書§4.2の3 test caseが、hidden 2件、category除外先行、overflow 0を直接assertしている（`TagBadgeList.test.tsx:36-79`）。 |

### §4 CR1-03: 技編集tooltip

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | dirty時のtitleは`空中設定を変更したら先に保存してください`と完全一致する（`web/src/features/moves/MoveEditGrid.tsx:238-246`）。 |
| 2 | ✓ | 利用者向けdirty titleに`is_aerial`は残っていない。 |
| 3 | ✓ | `isAerial`、`isAerialDirty`等の技術用identifierは維持されている（同file:68-89）。 |
| 4 | ✓ | `rushVariantExists`→`isAerialDirty`→`rushEligible`のtitle分岐順と既存判定値を維持している（同file:238-246）。 |
| 5 | ✓ | disabled条件、click handler、mutationは既存契約を維持している（同file:136-150,231-249）。 |
| 6 | ✓ | 非空中→空中と空中→非空中の両dirty経路がtestされている（`MoveEditGrid.test.tsx:93-125`）。 |
| 7 | ✓ | 両経路でbutton disabledとexact titleをassertしている。exact title自体が内部名非露出を保証し、後者では`not.toContain("is_aerial")`も明示している（同test:101-105,117-124）。 |

### §5 CR1-04: 折りたたみ状態ラベル

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | open時`隠す`、closed時`表示`をbutton内のchevron隣に表示する（`web/src/features/combo/components/CollapsibleFieldset.tsx:44-61`）。 |
| 2 | ✓ | control groupは`ml-2 flex shrink-0 items-center gap-1`、labelは`text-xs font-normal text-gray-500`である（同file:52-55）。 |
| 3 | ✓ | chevronは`aria-hidden="true"`で、`transition-transform`とopen時`rotate-180`を維持する（同file:56-59）。 |
| 4 | ✓ | Propsのフィールドは`code-facts.md`記載契約と一致し、増減していない（同file:4-18）。 |
| 5 | ✓ | `defaultOpen = true`を維持する（同file:26-34）。 |
| 6 | ✓ | summaryはopen条件の外側にあり、open/closedの両方で表示される（同file:62）。 |
| 7 | ✓ | childrenは`open &&`配下にあり、closed時にDOMから外れる（同file:63-67）。 |
| 8 | ✓ | buttonの`aria-expanded`と、展開contentのidを指す`aria-controls`の対応を維持する（同file:35-36,47-48,64）。 |
| 9 | ✓ | i18n keyは追加せず、固定ja境界を維持している。 |
| 10 | ✓ | buttonのaccessible nameにはlegendと状態labelが含まれ、testは利用者視点のrole/name queryで確認している（`CollapsibleFieldset.test.tsx:14,29-30,36,53`）。 |
| 11 | ✓ | 指示書§4.4の3 test caseが既定open、往復toggle、default closedを検証している（同test:7-57）。 |

### §6 testとbuild

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | `TagBadgeList.test.tsx`は属性の完全一致とcategory除外先行を直接検証する（同test:36-79）。 |
| 2 | ✓ | `MoveEditGrid.test.tsx`は既存dirty guardのdisabled assertionを維持し、両方向へ拡張している（同test:93-125）。 |
| 3 | ✓ | `CollapsibleFieldset.test.tsx`はReact Testing Libraryのrole/name、text、testid queryで利用者視点の状態遷移を検証する。 |
| 4 | ✓ | 対象testに`.only`、恒久skip、snapshot更新はない。 |
| 5 | ✓ | cast・抑止directiveによる型error隠蔽はない。既存のDOM型castは要素API利用のためであり、型error抑止ではない。 |
| 6 | ✓ | focused test結果はimplementation reportにfile数・test数付きで記録されている。 |
| 7 | ✓ | lint、全Vitest、E2E TS typecheck、frontend build、`make test`、`make build`の結果がimplementation reportにある。指示書の`pnpm test --run`がpnpmに拒否された事実と、開発者承認済みの`pnpm test -- --run`成功も記録されている。 |
| 8 | ✓ | 初回command failureを隠さず、原因、未起動、承認後の読替をstatusとimplementation reportへ記録している。 |
| 9 | ✓ | E2E spec非追加はroute/API/保存flow不変という指示書の境界と整合する。 |

レビュー時再検証:

- `pnpm test -- --run src/features/tag/components/TagBadgeList.test.tsx src/features/moves/MoveEditGrid.test.tsx src/features/combo/components/CollapsibleFieldset.test.tsx`: 3 files、26 tests成功。
- `pnpm lint`: 成功。
- `pnpm exec tsc --noEmit -p e2e/tsconfig.json`: 成功。
- `pnpm build`: 成功（既知の500 kB超chunk warningのみ）。

### §7 checkpointと再開性

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | statusはCP0〜CP4完了と、CP5 Phase B fresh review中の現在地を示す（`docs/progress/phase3/CodexRefactor1-refactoring-group/status.md:9-15`）。 |
| 2 | ✓ | 各CPの対象/変更file、test、日時、再開後の操作が作業ログに記録されている。 |
| 3 | ✓ | CP1〜CP4に開発者提示commit hashがあり、CP5はPhase B/C成果物と合わせたcommit予定である。 |
| 4 | ✓ | 実装担当がcommitを実行した記録はなく、hashは一貫して開発者提示として記録される。 |
| 5 | ✓ | 実装担当・reviewerがGitコマンドを実行した記録はない。本レビューでもGitコマンドを実行していない。 |
| 6 | ✓ | crash時に変更破棄、stash、restore、reset、checkoutを行わず停止する手順になっている。 |
| 7 | ✓ | implementation reportは変更file、test、review状態、設計変更不要判定、手動確認状態を含む。 |

### §8 手動アプリ確認gate

| # | 評価 | 結果 |
|---|---|---|
| 1 | N-A | Phase C完了後に提示するgateであり、本レビュー時点はPhase B中。指示書§6.4とimplementation reportに7項目の提示予定が明記されている。 |
| 2 | N-A | Phase C完了時点で実施する状態遷移のため、本レビュー時点では未到達。 |
| 3 | ✓ | statusは`実装中`で、開発者手動確認前に`完了`としていない（`status.md:9-15`）。 |
| 4 | ✓ | 手動確認不合格時は該当test再実行、CP-R、開発者commit gateへ戻す手順が指示書§6.4にある。 |

### §9 設計意図との整合

| # | 評価 | 結果 |
|---|---|---|
| 1 | ✓ | 4件とも既存仕様の具体化・局所修正に留まり、REQ / DES / CHANGEを要する新仕様を追加していない。 |
| 2 | ✓ | `excludeCategories`を先に適用し、TagBadgeListの通常tag表示と`mycombo_status`責務分離を維持する。 |
| 3 | ✓ | MoveEditGridのC-20「内部値を利用者へ出さない」をdirty tooltipへ一貫させている。 |
| 4 | ✓ | CollapsibleFieldsetはM15-05のProps、初期open、summary、children mount、ARIAを維持し、左右panel拡張へ踏み込んでいない。 |
| 5 | ✓ | M18検索とM19提案UIに関するcode、契約、状態は追加していない。 |

## 設計準拠性以外の指摘事項

- 低: `web/src/features/tag/components/TagBadgeList.test.tsx:4-5`は相対import
  `./TagBadgeList`の後にalias import `@/types/tag`を置いており、CLAUDE.md §4 TypeScriptの
  「エイリアスパス → 相対パス」というimport順に反する。`pnpm lint`では検出されない。
  検証方法: file先頭のimport順を目視し、alias importを相対importより前へ並べる。
  機能・型・accessibilityへの影響はなく、CodexRefactor1の完了を妨げない。

セキュリティ上の新規懸念、危険なDOM挿入、ブラウザストレージ利用、新規library選択、
不要な抑止directive、`console.log`は確認されなかった。

## 推奨修正（優先度別）

- 高（CodexRefactor1完了前に修正必須）: なし。
- 中（手動確認前の修正を推奨）: なし。
- 低（CodexRefactor2以降で対応可能）:
  - `TagBadgeList.test.tsx:4-5`のimportを、alias pathの後に相対pathが来る順へ整理する。

## 良かった点

- `hidden`をcategory除外後の配列から明示的に導出したため、件数・表示名・順序の正本が一つになっている。
- tooltip文言だけを変更し、ラッシュ版生成のdirty guard・mutation・分岐優先順位を温存している。
- CollapsibleFieldsetは状態label追加と同時にchevronを`aria-hidden`とし、accessible nameの重複を避けている。
- testは実装詳細のstateを直接見るのではなく、利用者が観測する文言、disabled、DOM mount、ARIAを検証している。
- 初回の不正なpnpm引数による失敗を隠さず記録し、開発者承認後の読替と成功結果を分離している。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- Gitコマンド禁止のため、変更scopeの独立判定は実装報告の変更file一覧と対象file現物の照合による。
- native `title`の実ブラウザhover、PC/mobile狭幅layout、折りたたみ前後の入力値保持は、
  指示書§6.4の開発者手動確認で判定する。

## 取り込み結果（自動トリアージ）

実施日時: 2026-07-23T14:41:00Z

| 優先度 | 指摘 | 採否 | 理由 |
|---|---|---|---|
| 低 | `TagBadgeList.test.tsx`のalias / relative import順 | 採用 | CLAUDE.md §4の明示規約に違反しており、許可済みtest file内の単純な並べ替えで機能リスクなく解消できるため。 |

- 高指摘: なし。
- 中指摘: なし。
- 不採用指摘: なし。
- 採用修正: `@/types/tag`を`./TagBadgeList`より前へ移動。
- CP-R検証: 完了。
  - focused `TagBadgeList.test.tsx`: 1 file、9 tests成功。
  - `pnpm lint`: 成功。
  - 全Vitest: 111 files、788 tests成功。
  - E2E TypeScript typecheck: 成功。
  - frontend production build: 成功。
  - `make test`: Go全packageとfrontend 111 files・788 tests成功。
  - `make build`: frontend buildとembed付きGo build成功。
