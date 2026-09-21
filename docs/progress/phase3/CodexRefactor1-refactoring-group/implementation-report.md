# CodexRefactor1-01 実装報告

作成日: 2026-07-23
完了日: 2026-07-25

## 総括

指示書`CodexRefactor1-01-refactoring-group.md`のCR1-01〜04を、指定された
worktree checkpoint運用で実装した。API、schema、migration、Goコード、依存package、
REQ / DES / CHANGE、M18/M19関連成果物は変更していない。

Phase Bのfresh review、Phase Cの自動トリアージ、外部レビュワーの追加修正、
開発者の最終受入れまで完了した。

## checkpoint結果

| CP | 内容 | 結果 | 開発者提示commit hash |
|---|---|---|---|
| CP0 | preflight / baseline | 完了 | N-A |
| CP1 | `baseUrl`除去 | 完了 | `4095a8d0f26a1385fe076de155d133a45b4ffc71` |
| CP2 | 省略tag名表示 | 完了 | `a54c591ef7856be703b4bcd24e43cabb3f44861a` |
| CP3 | 技編集tooltip | 完了 | `c8b1d10a1a4d2a44fadc00179e9b541278e0186f` |
| CP4 | 折りたたみ状態label | 完了 | `81c0cebe0ff1d660e26e3db7d00246534e5d2070` |
| CP5 | 統合検証 | 完了 | `431b54003479770a4d2a04d662ecec72b9bf562b` |
| CP-R | review指摘修正 | 完了 | `431b54003479770a4d2a04d662ecec72b9bf562b` |

## 変更file

### source / config / test

- `web/tsconfig.json`
- `web/src/features/tag/components/TagBadgeList.tsx`
- `web/src/features/tag/components/TagBadgeList.test.tsx`
- `web/src/features/moves/MoveEditGrid.tsx`
- `web/src/features/moves/MoveEditGrid.test.tsx`
- `web/src/features/combo/components/CollapsibleFieldset.tsx`
- `web/src/features/combo/components/CollapsibleFieldset.test.tsx`

### progress成果物

- `docs/progress/phase3/CodexRefactor1-refactoring-group/status.md`
- `docs/progress/phase3/CodexRefactor1-refactoring-group/implementation-report.md`
- `docs/progress/phase3/codexrefactor1-01-review.md`（Phase Bで作成）

## 実装内容

### CR1-01

- `web/tsconfig.json`から`baseUrl`を除去。
- aliasを`"@/*": ["./src/*"]`へ変更。
- E2E tsconfigのextends関係、import文、その他compiler optionは変更していない。

### CR1-02

- category除外後の`visible`から`shown`と`hidden`を導出。
- `overflow`を`hidden.length`から算出。
- `+N` badgeへ`省略されたタグ{N}件: {日本語読点区切りのtag名}`形式の
  `title`と`aria-label`を付与。
- hidden名の入力順、category除外順、overflow 0、`maxVisible`未指定をtestで固定。

### CR1-03

- dirty時のtooltipを`空中設定を変更したら先に保存してください`へ置換。
- 非空中→空中、空中→非空中の両dirty経路でdisabledとexact titleをtest。
- rush適格性、dirty guard、既存variant判定、mutationは変更していない。

### CR1-04

- open時`隠す`、closed時`表示`の状態labelをbutton内部へ追加。
- labelと既存chevronを指定classのcontrol groupへ配置し、chevronを
  `aria-hidden="true"`とした。
- 既定open、toggle往復、default closed、summary、children mount、ARIA、
  accessible nameを3件の新規testで固定。

## 検証結果

### CP0 baseline

実行日時: 2026-07-23 14:08〜14:10 UTC

- `cd web && pnpm lint`: 成功。
- 指示書記載の`pnpm test --run`はpnpm 9.13.0が`Unknown option: 'run'`として
  test起動前に拒否。開発者承認を得て、Makefileと同じ
  `pnpm test -- --run`へ読替。
- `cd web && pnpm test -- --run`: 成功（110 files、784 tests）。
- `cd web && pnpm exec tsc --noEmit -p e2e/tsconfig.json`: 成功。

### focused検証

- CP1:
  - `pnpm lint`: 成功。
  - 全Vitest: 110 files、784 tests成功。
  - E2E TypeScript検査: 成功。
  - `pnpm build`: 成功。
- CP2:
  - `TagBadgeList.test.tsx`: 1 file、9 tests成功。
  - `pnpm lint`: 成功。
- CP3:
  - `MoveEditGrid.test.tsx`: 1 file、14 tests成功。
  - `pnpm lint`: 成功。
- CP4:
  - `CollapsibleFieldset.test.tsx`: 1 file、3 tests成功。
  - `pnpm lint`: 成功。

### CP5統合検証

実行日時: 2026-07-23 14:29〜14:33 UTC

- `cd web && pnpm lint`: 成功。
- `cd web && pnpm test -- --run`: 成功（111 files、788 tests）。
- `cd web && pnpm exec tsc --noEmit -p e2e/tsconfig.json`: 成功。
- `cd web && pnpm build`: 成功（2185 modules transformed）。
- `make test`: sandbox内の初回はread-only Go build cacheによりtest起動前に失敗。
  承認済みの通常Go cache環境で同一コマンドを実行し、Go全packageとfrontend
  111 files・788 testsが成功。
- `make build`: 成功。frontend production buildと
  `go build -tags=embed_web -o combomgr ./cmd/combomgr`が終了コード0。

production buildの500 kB超chunk warningと、`make build`時のGo stat cache
read-only warningは非失敗。alias解決error、test failure、build failureはない。

## 設計・契約判定

- REQ / DES / CHANGE: 変更不要。
- schema / migration / API: 変更なし。
- Goコード: 変更なし。
- 依存package / lockfile: 変更なし。
- M18 / M19: 変更なし、先回り実装なし。
- `Memo_Someday.txt`: 本タスクでは編集していない。
- 凍結されたProps、route、queryKey、保存flow: 変更なし。

## 実装裁量

- CR1-02はcomponent local constとして`hidden`と`overflowLabel`を配置した。
- CR1-03は既存2 test caseへassertionを追加し、test case分割は行わなかった。
- CR1-04のJSXは指定class群を保ってcontrol group単位に改行した。

## review

- review report: `docs/progress/phase3/codexrefactor1-01-review.md`
- Phase B: fresh reviewerによるコードreview合格。高・中指摘なし、低指摘1件。
- Phase C採否要約:
  - 低指摘「`TagBadgeList.test.tsx`のimport順」を採用。
  - 理由: CLAUDE.md §4の明示規約違反で、許可file内の単純な並べ替えにより
    機能リスクなく解消できるため。
  - 高・中指摘、不採用指摘、不明点なし。
- CP-R: import順修正と再検証を完了。
- CP-R検証:
  - focused `TagBadgeList.test.tsx`: 1 file、9 tests成功。
  - `pnpm lint`: 成功。
  - 全Vitest: 111 files、788 tests成功。
  - E2E TypeScript検査: 成功。
  - frontend production build: 成功。
  - `make test`: Go全packageとfrontend 111 files・788 tests成功。
  - `make build`: frontend buildとembed付きGo build成功。
- CP5 / CP-Rは開発者commit
  `431b54003479770a4d2a04d662ecec72b9bf562b`で完了。

## 手動確認

状態: **合格・完了**。

2026-07-25、外部レビュワーによる追加修正後に、開発者から合格・完了指示を受領した。
これを指示書§6.4の最終確認gate合格として記録し、statusを完了へ更新した。

## 外部レビュー後の最終検証

実行日: 2026-07-25

- `cd web && pnpm lint`: 成功。
- `cd web && pnpm test -- --run`: 成功（111 files、790 tests）。
- `cd web && pnpm exec tsc --noEmit -p e2e/tsconfig.json`: 成功。
- 未解決事項: なし。
- 最終判定: CodexRefactor1-01完了。

## 既知の制約

- E2E spec新設と`make e2e`は指示書の自動DoD対象外。
- native `title`の実ブラウザhover表示、PC/mobileの狭幅layout、入力値保持は
  開発者の最終受入れで合格済み。これらを直接検証するE2E specは追加していない。
