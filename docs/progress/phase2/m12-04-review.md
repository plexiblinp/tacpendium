# M12-04 レビュー報告書

対象コミット: `07a743b` feat(M12/character,moves): キャラ選択を技マスタ編集で共通セレクタへ統一 + MoveEditGrid aria 内部値掃除(N-29/C-20)
レビュー実施日: 2026-06-24 / レビュー担当: 品質レビュー担当 Claude(Opus 4.8）

## 総評

承認可能。指示書 §1.3/§4 の最重点(画面別の既定/挙動の温存・aria 内部値の掃除・過剰抽象化回避)をいずれも満たしている。実態調査(7 箇所中 5 箇所は既に共通 `CharacterSelector` を使用済み、一覧フィルタは native 維持の開発者確定)を踏まえ、実変更を「技マスタ編集 1 画面の置換」と「`MoveEditGrid` の aria/可視文言の日本語化」へ正しく絞り込んでいる。`CharacterSelector` への 2 プロップ追加(`placeholder` / `ariaLabel`)は後方互換で、既存 5 消費側の挙動を壊さない設計。BE 不変、テスト 535 件全通過。重大(§8)指摘はゼロ。軽微な観察事項のみ。

## 設計準拠性レビュー結果

### 1. 着手前確認の実施(チェックリスト §1) ◎
- §3.4.2 実態(共通化済み 5 / 個別実装 1 = 技マスタ編集)と統一先(共通 `CharacterSelector`)が特定済みで、コミットメッセージ・指示書文脈と整合。
- §3.4.3 温存対象(CHANGE-039 文脈追従・編集固定・CHANGE-036 確認破棄・複数キャラ切替・1 体選択)はいずれも本変更の対象外で、該当ファイルに手が入っていないことをコードで確認。

### 2. キャラ選択方式の統一(§4.1 / チェックリスト §2) ◎
- 技マスタ編集 `MovesEditGridPage.tsx` の生 Radix `Select` を共通 `CharacterSelector` へ置換。選択先行→グリッド表示フロー(`characterId != null` ガード、`?character=<code>` 事前選択 useEffect)は温存。
- 比較追加モーダル(`AddComboToCompareModal.tsx`)は従来どおりモーダル内 `CharacterSelector` のみで、ページレベル選択の新設なし(チェックリスト §2 / §8 のスコープ逸脱に該当せず)。
- 一覧の絞り込みフィルタは native `<select>` 維持(開発者確定。隣接フィルタ列との一貫性。指示書 §10 暫定案からの逸脱だが Plan Mode 承認済みの妥当判断)。

### 3. 画面別の既定/挙動の温存(チェックリスト §3・最重点) ◎
- 文脈追従・編集固定・確認破棄・複数キャラ切替・設定/初回 1 体選択を担うファイル(`ComboEditorCharacterField.tsx` / `MyComboPage.tsx` / `SettingsSectionBasic.tsx` / `Step03Character.tsx` / `AddComboToCompareModal.tsx`)はいずれも `placeholder` 未指定で呼び出すため pick モードに入らず、従来の「単一キャラ時は無効化 + `---` フォールバック item」挙動を維持。
- `disabled` ロジックの非回帰確認: 旧 `isSingleCharacter || isLoading` → 新 `isLoading || (!pickMode && Boolean(isSingleCharacter))`。非 pick モードかつ全ロード状態で論理同値(`characters` 未定義時も `isLoading` で disabled になる経路が保たれる)。
- `---` フォールバック item に `selectedCharacterId != null` ガードを追加した点も、number を渡す既存 5 消費側では従来挙動と同一。pick モード(`selectedCharacterId=null`)では placeholder が出るためフォールバック item 不要で、Radix の空 value 制約にも抵触しない。

### 4. MoveEditGrid aria-label(§4.2 / チェックリスト §4) ◎
- `total`/`startup`/`active`/`onHit`/`onBlock`/`properties`/`is_aerial`/`combo_scaling`/`notes_tool` の内部値 aria-label を、可視列ヘッダ(`SORT_COLUMNS` の `全体`/`発生`/`持続`/`ヒット`/`ガード`/`属性`/`空中`)と一致する日本語へ是正。可視↔aria の不一致解消も両立。
- `grep` で内部値 aria-label の残存ゼロを確認。編集ロジック・データ(`buildUpdate` の PATCH 差分、`raw_data` の `notes_tool` 保持等)は不変。
- 非回帰テスト(C-20)を追加し、内部値ラベル不在 + 日本語ラベル取得可を明示的に固定化。良い。

### 5. 既存挙動の温存・BE 不変(チェックリスト §6) ◎
- `internal/` `cmd/` `migrations/` の diff ゼロ。`GET /api/characters` 等の API・データ不変。
- e2e `moves-edit.spec.ts` のラベル更新(`total`→`全体`)は aria 日本語化に追随した正しい修正。`getByLabel("キャラクター選択")` は新 `ariaLabel` プロップで温存されており E2E 経路が壊れていない。
- フロントテスト 535 件全通過(`pnpm test -- --run` で確認)。

## 設計準拠性以外の指摘事項

- **命名・規約**: 追加プロップは camelCase(`placeholder`/`ariaLabel`)、コメントで pick モードの意図を明記しており CLAUDE.md §4 TypeScript 規約に準拠。不要 `console.log` / `eslint-disable` なし。
- **過剰抽象化の回避(CLAUDE.md §6・チェックリスト §5)**: 新 hook を作らず、既存共通コンポーネントへ最小 2 プロップを足す方針。`pickMode = placeholder !== undefined` の派生はやや暗黙的だが、コメントで補われており個人開発の規模感として許容範囲。密結合・条件分岐の散在はない。
- **軽微(観察)**: `MovesEditGridPage.tsx` は `useCharacters` を `?character=<code>` 解決の useEffect でのみ使用しており(描画では未使用)、import は妥当。死蔵 import ではない。

## 推奨修正(優先度別)

- 高(M12 完了前に修正必須): なし。
- 中(M13 着手と並行可): なし。
- 低(将来対応):
  - `pickMode` の判定が `placeholder` の有無に暗黙依存している点は、消費側が「placeholder を出したいが pick モードにはしたくない」要件が将来出た場合に分離が必要になり得る。現状その要件はなく、過剰な前倒し抽象化は避ける方が良いため、明示プロップ化は実需要が出てから検討で可。
  - `MoveEditRow` 詳細セクションの aria `備考付記`(可視ラベルは `備考(付記)`)はラベル文言が完全一致ではないが、内部値露出は解消済みで a11y 上の実害なし。気になれば将来統一。

## 良かった点(Claude Code へのフィードバック)

- 指示書 §10 の前提(7 画面バラバラ)を鵜呑みにせず実態調査し、実変更を 1 画面+aria 掃除に正しく絞り込んだ。retrospective-digest §1「あるはずで書かない」の実践として模範的。
- 後方互換を保つプロップ追加設計(既存 5 消費側ゼロ改修)と、`disabled` の論理同値性を崩さない実装。
- C-20 非回帰テストを内部値ラベル不在の形で固定化し、回帰を機械的に検出可能にした点が良い。
- BE 不変・スコープ厳守(一覧フィルタを開発者確定どおり native 維持し、勝手に統一しなかった)。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機(スクリーンリーダー)テストは別途実施が必要。
- E2E(`moves-edit.spec.ts` 等)はラベル整合をコード上で確認したのみで、実 Playwright 実行による通過は未検証(別途 CI/実行で確認のこと)。
- CHANGE 要否(DES-005 §5 共通要素 + 各画面節の統一方式整合)は設計担当が完了報告を受けて起票する運用のため、本レビューでは判定対象外。

---

## 取り込み結果(自動トリアージ)

`implement_plan_full` Phase C による自動トリアージ結果(採否と理由)。優先度「高」の不採用はゼロのためエスカレーション不要。

| 指摘(優先度) | 採否 | 理由 |
|---|---|---|
| 低#1: `pickMode = placeholder !== undefined` の暗黙依存を明示プロップ化 | **不採用** | 消費側が技マスタ編集 1 箇所のみの現状で専用プロップを増やすのは過剰抽象化(CLAUDE.md §6 / チェックリスト §8 の警戒対象)。レビュアーも「実需要が出てから明示プロップ化を検討で可」と評価。将来 pick モード消費者が増えた時点で再検討する。 |
| 低#2: 詳細セクション aria と可視ラベルの完全一致(`コンボ補正`↔`コンボ補正(JSON)` / `備考付記`↔`備考(付記)`) | **採用** | 「可視↔aria 一致」の a11y 趣旨に沿う低コスト改善。aria-label を可視ラベルに完全一致させた(`コンボ補正(JSON)` / `備考(付記)`)。後続コミットで反映。 |

高・中の指摘はゼロ。重大(§8)ゼロにつき本サブは完了承認可能。
