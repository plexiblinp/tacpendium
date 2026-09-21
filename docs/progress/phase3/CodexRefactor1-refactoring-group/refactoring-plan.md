# CodexRefactor1 リファクタリンググループ 修正計画（Claude レビュー待ち）

作成日: 2026-07-23
状態: **Claude レビュー承認済み。実装未着手。**

## 更新履歴

| 版 | 更新日 | 更新内容 |
|---|---|---|
| 1.0.0 | 2026-07-23 | 初版。Claude レビュー用ドラフト。 |
| 1.0.1 | 2026-07-23 | Claude の「問題なし」判定を反映。`implement_plan_full_wt` の最優先ガードに合わせ、実装担当による Git 参照を開発者確認へ置換。workflow 標準のレビュー報告先を明記。 |

## 1. 目的と境界

`docs/human-notes/Memo_Someday.txt` から、次の条件を同時に満たす小規模改修を切り出す。

- 進行中の Phase 3 / M18-02 / M19-01 の設計・製造と競合しにくい。
- REQ / DES / CHANGE、DB schema、migration、API 契約の変更を要しない。
- 既存仕様の意図を変えず、保守警告、表示漏れ、内部名露出、既存の折りたたみ操作の可読性を局所的に直す。
- 一つの worktree 内でチェックポイント単位に停止・再開できる。
- 実装者が Codex でも Claude でも同じ完了条件を判断できる。

本計画で変更してよい範囲は `web/` と、本グループ専用の
`docs/progress/CodexRefactor1-refactoring-group/` に限定する。設計書、M18/M19 の指示書・レビュー票、
`.claude/commands/`、`.claude/hooks/`、`.codex/` は変更しない。

## 2. 調査した正本とコード

最初に次を通読し、その後に設計・実装を照合した。

- `docs/handover/docs-map.md`
- `docs/handover/code-facts.md`
- `CLAUDE.md`
- `docs/handover/design-instruction-playbook.md`
- `docs/human-notes/parallel-execution-guide.md`
- `docs/human-notes/worktree-scripts-guide.md`
- `docs/human-notes/Memo_Someday.txt`
- `docs/design/phase3-overview.md`
- `docs/design/M18-overview.md` と M18-02 関連資料
- `docs/design/M19-overview.md` と M19 調査資料
- 候補箇所の React component、テスト、`web/tsconfig.json`

TypeScript 設定については、TypeScript 4.1 以降 `paths` に `baseUrl` が不要であることを
[公式 TSConfig Reference](https://www.typescriptlang.org/tsconfig/baseUrl.html) で確認した。
また、TypeScript 6.0 で `baseUrl` が非推奨化され、TypeScript 7.0 では無効化される予定であることを
[TypeScript 6.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
で確認した。

## 3. 採用候補

確信度は「この変更が設計書改訂を要さず、M18/M19 の進行中作業へ影響しない」という観点で評価する。
実装の容易さだけの評価ではない。

### CR1-01: `tsconfig` の `baseUrl` 非推奨対応

- Memo: 93 行目
- 確信度: **大（98%）**
- 変更候補:
  - `web/tsconfig.json`
- 現状:
  - `baseUrl: "."` と `paths: { "@/*": ["src/*"] }` を併用している。
  - リポジトリ内で `baseUrl` を使用する設定は当該箇所のみ。
- 修正案:
  - `baseUrl` を削除する。
  - `paths` の値を `["./src/*"]` とし、設定ファイル起点の相対パスであることを明示する。
- 完了条件:
  - `pnpm lint`、対象テスト、`pnpm build` が成功する。
  - `@/` import の解決結果が変わらない。
- M18/M19 影響:
  - 実行時仕様、API、画面、データに変更なし。
  - M18/M19 の新規 TypeScript ファイルも同じ alias を使えるため、製造ブランチ取り込み後の再検証は必要だが、競合対象は設定ファイル1個だけ。

### CR1-02: 省略タグ `+N` に隠れたタグ名を表示

- Memo: 136 行目
- 確信度: **大（93%）**
- 変更候補:
  - `web/src/features/tag/components/TagBadgeList.tsx`
  - `web/src/features/tag/components/TagBadgeList.test.tsx`
- 現状:
  - `maxVisible` 超過分は `+N` のみで、隠れたタグ名を確認できない。
- 修正案:
  - `+N` badge に、隠れたタグ名を列挙する native `title` と同義の `aria-label` を付ける。
  - 新規 UI dependency、popover 状態、layout 変更は導入しない。
  - `excludeCategories` 適用後かつ `maxVisible` より後ろのタグだけを列挙する。
- 完了条件:
  - マウス hover で隠れたタグ名を確認できる。
  - 支援技術向けの名称にも隠れたタグ名と件数の意味が含まれる。
  - 省略なし、除外カテゴリあり、複数の隠れタグをテストする。
- M18/M19 影響:
  - M18-02 のヒット種別定数や検索 UI、M19 の提案 engine/setup UI を触らない。
  - 共通 badge component 自体は変更せず、タグ専用 component 内で閉じる。

### CR1-03: 技編集の tooltip から内部フィールド名を除去

- Memo: 40 行目
- 確信度: **大（97%）**
- 変更候補:
  - `web/src/features/moves/MoveEditGrid.tsx`
  - `web/src/features/moves/MoveEditGrid.test.tsx`
- 現状:
  - ラッシュ版生成ボタンの tooltip に
    `is_aerial を変更したら先に保存してください` と内部フィールド名が露出する。
  - C-20 対応テストは入力の `aria-label` を確認しているが、この `title` は対象外である。
- 修正案:
  - 表示文言を `空中設定を変更したら先に保存してください` に置換する。
  - ラッシュ版生成の活性条件、保存順、mutation は変更しない。
  - 未保存の空中設定変更時に、内部名を含まない tooltip になることを回帰テストへ追加する。
- 完了条件:
  - `is_aerial` が利用者向け属性に露出しない。
  - 未保存時のボタン非活性と保存を促す挙動が維持される。
- M18/M19 影響:
  - Move のデータ構造、frame 値、M19 の派生技計算には触れない。
  - 利用者向け文言1箇所とテストだけの変更である。

### CR1-04: 折りたたみ操作に状態ラベルを追加

- Memo: 302 行目
- 確信度: **中〜大（82%）**
- 変更候補:
  - `web/src/features/combo/components/CollapsibleFieldset.tsx`
  - 同 component の新規 unit test
- 現状:
  - 見出しと chevron だけで開閉し、押した結果が文字では示されない。
  - component は登録・編集画面の基本情報、起き攻め、マイコンボ、タグ、セットプレイ、
    レシピの折りたたみに共用されている。
- 修正案:
  - 開いているときは `隠す`、閉じているときは `表示` を chevron の隣に表示する。
  - `aria-expanded`、`aria-controls`、初期全展開、summary 常時表示、children の mount 条件は維持する。
  - component 単体テストを新設し、初期状態、開閉後の文言、summary、children、
    accessibility 属性を固定する。
- 完了条件:
  - 開閉前後で利用可能な操作が文字で判別できる。
  - PC 2 column と mobile 1 column の幅・折返しに破綻がない。
  - 既存 section の表示順、入力値、開閉状態以外の layout は変わらない。
- M18/M19 影響:
  - M18-02 の検索画面には関与しない。
  - M19 は将来 ComboEditor/setup UI に接続する可能性があるため、4件中では相対的に競合可能性が高い。
    ただし Props 追加や呼出側変更をせず共通 component 内で閉じるため、現時点では低リスクと判断する。
  - Claude レビュー時に M19-01 の実作業ファイルがこの component を変更予定なら、CR1-04 は次グループへ分離する。

## 4. 今回採用しない Memo 項目

| 項目 | 判断 | 理由 |
|---|---|---|
| マイコンボ件数表示がタブと紛らわしい（27行目） | 保留 | M12-01 では重複内訳を `CharacterInfoBar` から除去し、tab 件数は残す判断だった。新しい表示案と目視判断が必要。 |
| 始動技 ID の sort 表記 | 保留 | `web/src/constants/combo-list.ts` は M18-02 が参照するヒット種別定数と同居する。sort が実際には数値 ID 順で、自然言語への置換だけでは意味が曖昧。 |
| toast が邪魔・長い | 保留 | global `Toaster` と多数の成功・失敗通知へ波及する。位置変更、成功だけ短縮、個別対応のいずれかを設計判断する必要がある。 |
| コンボ比較から詳細へ移動、キャラ名表示 | 対象外 | DES の比較画面 action 定義を変更するため、設計書修正なしの条件を満たさない。 |
| 長い recipe で画面が崩れる | 調査待ち | 現 component は `whitespace-pre-wrap break-words` を持つ。再現条件が特定できず、修正対象を確定できない。 |
| リンクを目押しへ変更 | 対象外 | M17 で `link` は media URL として再定義済みで、Memo の前提が現仕様と異なる。 |
| 検索 filter の折りたたみ（239/301行目） | 次グループ候補 | 一覧 layout と検索操作を変えるため、小さくても画面仕様の判断が必要。M18-02 の検索 UI と隣接する。 |
| 左右 editor panel の折りたたみと他方拡張（303行目） | 次グループ候補 | PC 2 column の責務・responsive layout・入力領域優先度を変更する。M19 の editor/setup UI と隣接する。 |
| tag placeholder、filter reset、技保存 feedback | 対応不要 | 現コードとテストで既に実装されている。 |

## 5. 実装チェックポイント案

各チェックポイントは、対象テストと `pnpm lint` が green、進捗記録更新、開発者による commit の順で閉じる。
前チェックポイントの commit hash が記録されるまで次へ進まない。

### CP0: 製造開始前 preflight

1. Claude レビューの指摘が本計画へ反映済みであることを確認する。
2. M18-02 / M19-01 の最新指示書と実作業ファイルを再照合する。
3. 開発者が Git 状態を確認し、既存変更を実装担当へ伝える。実装担当は Git コマンドを実行しない。
4. `docs/human-notes/Memo_Someday.txt` の既存変更を本グループの commit に混ぜない。
5. baseline として `cd web && pnpm lint && pnpm test --run` を実行し、結果を進捗記録へ残す。

停止条件:

- M18/M19 が本計画の候補ファイルを変更中、または変更予定である。
- baseline failure が候補箇所に関係する。
- `Memo_Someday.txt` 以外にも所有者不明の既存変更がある。

### CP1: CR1-01

`web/tsconfig.json` だけを変更する。`pnpm lint`、`pnpm test --run`、`pnpm build` を実行する。
成功後に停止し、開発者が CR1-01 だけを checkpoint commit する。

### CP2: CR1-02

`TagBadgeList` とその test だけを変更する。focused test、`pnpm lint` を実行する。
実画面でタグ省略の hover と狭幅表示を確認可能な状態にして停止し、開発者が checkpoint commit する。

### CP3: CR1-03

`MoveEditGrid` の文言と test だけを変更する。focused test、`pnpm lint` を実行する。
ラッシュ版生成の既存活性条件を変更していないことを差分確認し、開発者が checkpoint commit する。

### CP4: CR1-04

`CollapsibleFieldset` と新規 test だけを変更する。focused test、`pnpm lint` を実行する。
登録・編集画面の全利用箇所を PC/mobile で目視確認できる状態にして停止し、開発者が checkpoint commit する。

### CP5: 統合確認と計画された中断

1. `cd web && pnpm lint`
2. `cd web && pnpm test --run`
3. `cd web && pnpm build`
4. 変更ファイルが許可リスト内だけであることを確認する。
5. 後述の手動アプリ確認を開発者が行う。
6. 問題発生時は該当 CP へ戻し、修正と checkpoint commit を追加する。
7. 問題がなければ本グループを完了とし、開発者が main へ統合する。

## 6. 停止・再開用の進捗管理

製造指示書作成時に、同じ専用フォルダへ次を追加する。

- `status.md`: 常に最新の再開地点を示す単一の正本
- `implementation-report.md`: 最終的な変更・検証結果
- `docs/progress/phase3/codexrefactor1-01-review.md`: `implement_plan_full_wt` が生成するレビュー結果

`status.md` は各 CP の開始前と停止前に更新し、少なくとも次を記録する。

- 状態: 未着手 / 実装中 / 開発者 commit 待ち / 手動確認待ち / blocked / 完了
- 現在の CP と完了した CP
- 変更したファイル
- 最後に成功・失敗したコマンドと日時
- 最後の checkpoint commit hash
- 未解決事項
- 再開後に最初に行う一つの具体的操作

実装途中のクラッシュや利用枠終了では、再開者は `status.md` と開発者から提示された
worktree 状態・commit hash を照合する。実装担当は Git コマンドを実行しない。
記録と開発者提示が一致しなければ実装を進めず、差異を報告する。

## 7. `_wt` workflow と checkpoint commit の扱い

指定された `implement_plan_full_wt` の worktree guard は、実装 agent に
`git add`、`git commit` を含む全 Git 操作を禁止している。一方、本タスクはチェックポイントごとの commit を求めている。
両方を守るため、次の役割分担を採用する。

1. 実装 agent は各 CP のコード変更・検証・`status.md` 更新まで行い、`開発者 commit 待ち` で停止する。
2. 開発者が対象ファイルだけを確認して checkpoint commit する。
3. 再開した agent は、開発者が提示した hash と worktree 状態を `status.md` に記録して次の CP へ進む。agent 自身は Git コマンドを実行しない。

実装 agent に commit させる指示は、`_wt` workflow の最高優先 guard と矛盾するため作成しない。
agent 自身による commit が必要なら、製造前に開発者が `_wt` ではない別 workflow を明示的に選び直す必要がある。

もう一つの互換性注意点として、既存 `implement_plan_full` は通常の `M{X}-{YZ}-...` filename から
milestone 番号と review checklist path を導出する。指定の `CodexRefactor{N}-...` はその規則外である。
Claude レビューでは次の案のどちらを採るかも判定してもらう。

- 推奨案: `CodexRefactor1-01-refactoring-group.md` と
  `CodexRefactor1-01-review-checklist.md` を明示的な組として扱い、非 milestone task であることを
  製造開始時に workflow へ明示する。優先度見出しは M 番号へ変換せず
  `CodexRefactor1 完了前 / 後続グループ` とする。
- 代替案: 既存 workflow の filename 導出規則を変更する。共有 Claude command への変更になるため、
  本グループでは採用せず、別途明示承認を要する。

## 8. 開発者の手動アプリ確認

CP5 では次を確認する。

- タグが上限を超えた一覧行で、`+N` hover に隠れた全タグ名が表示される。
- タグ0件、上限以下、除外 category 適用時の表示が変わらない。
- 技編集で空中設定を変更して未保存の間、ラッシュ版ボタンが無効で、tooltip が日本語だけになる。
- コンボ新規・編集の各折りたたみ section で、展開時 `隠す`、収納時 `表示` が判別できる。
- 折りたたみ section の summary と入力値が開閉で壊れない。
- PC 2 column、mobile 1 column でラベルと chevron が重ならず、横 overflow が発生しない。
- `@/` import を利用する代表画面が production build で解決される。

## 9. branch / worktree 戦略

推奨は次の運用である。

1. Claude の計画レビュー、指示書作成、CodexRefactor1 の実装、手動確認までは、現在の
   `wt/codex-refactor` と対応 worktree を一つの作業単位として使う。
2. CP5 の手動確認が通った時点で計画された中断とし、開発者が main へ統合する。
3. CodexRefactor2 を行う場合は、統合後の最新 main から新しい branch/worktree を作る。
   main へ統合済みの古い branch をそのまま次グループに延命しない。

この方法なら、一つのレビュー単位に未統合変更が混在せず、次グループが M18/M19 の最新統合結果を基点にできる。
同じ branch の継続は **最初の main 統合までの CodexRefactor1 内** に限るのが安全である。

現在 `docs/human-notes/Memo_Someday.txt` に本計画作成前からの未 commit 変更がある。
製造開始前に開発者がその変更の所有先を確定し、本グループの checkpoint commit へ混入しない状態にする必要がある。
実装 agent は stash、restore、checkout、reset で整理しない。

## 10. Claude レビューで確認してほしい点

1. CR1-01〜04 が M18-02 / M19-01 の実作業ファイルと競合しないか。
2. CR1-04 の `隠す` / `表示` が既存設計の範囲か。設計判断になるなら CR1-04 を次グループへ外す。
3. CR1-02 の native `title` + `aria-label` が要望の最小実装として妥当か。
4. CP ごとに開発者 commit とする `_wt` guard 対応が妥当か。
5. `CodexRefactor1-01-...` の非 milestone filename を明示指定する運用で
   `implement_plan_full_wt` 相当の三段階を安全に実施できるか。
6. 採用候補または保留項目に、見落としている REQ / DES / CHANGE の制約がないか。

レビュー結果が「問題なし」または指摘反映後に承認となった段階でのみ、次を作成する。

- `docs/instructions/phase3/CodexRefactor1-01-refactoring-group.md`
- `docs/instructions/phase3/reviews/CodexRefactor1-01-review-checklist.md`
- `docs/progress/phase3/CodexRefactor1-refactoring-group/status.md`
