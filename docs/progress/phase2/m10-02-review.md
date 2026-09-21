# M10-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象マイルストーン | M10-02（A-2 リュウ固定依存 UX の画面横断解消） |
| 対象コミット | 2b1133e（feat(M10/combo): 既定キャラの文脈追従と一覧情報バーの動的化(A-2)） |
| レビュー実施日 | 2026-06-20 |
| レビュー担当 | 品質レビュー担当 Claude（Opus 4.8） |
| 対象チェックリスト | docs/instructions/reviews/M10-02-review-checklist.md v1.0.0 |
| スコープ | フロント完結（コード上判定可能な範囲のみ。実機 E2E は別途） |

## 総評

CHANGE-039（DES-005 v2.21.0 §4.3/§5.7/§5.8）の意図に沿った、過不足のない実装である。後方互換（プロップ不在時 `INITIAL_CHARACTER_ID` フォールバック）は4経路すべてで担保され、編集/コピーモードでの `initialCharacterId` 無視も明示テストで確認できる。「初期値を外から渡すのみ・内部選択ロジック不変」という設計原則を厳守しており、スコープ外（`useSelectMode`・BE/スキーマ・編集モードのキャラ固定）への侵食もない。テストは指示書 §5.1 の5ケースを過不足なく充足する。
全体として完了承認可能な水準。優先度「高」の指摘はなし。中・低の改善余地と申し送り事項の追認のみ。

## 設計準拠性レビュー結果

### §1. 設計書本体との照合

- **§1.1 新規登録の既定キャラの文脈追従**: ◎
  - `ComboEditor` に `initialCharacterId?: number` を追加。`initialBasic(initial, initialCharacterId)` で新規時のみ `initialCharacterId ?? INITIAL_CHARACTER_ID` を採用（ComboEditor.tsx:523-532）。
  - 編集/コピー（`initial` あり）では `if (!initial)` ブロックに入らず `initial.characterId` が優先＝DES-005 §5.7「編集モードのキャラ固定表示は不変」と整合。ComboEditor.test.tsx の「編集モードでは initialCharacterId が無視され initial.characterId が優先される」で立証。
  - フッター汎用導線は `?character=` を付与しない（code-facts §6 Footer `/combos/new` は素のまま）ため、文脈なし＝`INITIAL_CHARACTER_ID` にフォールバックする。
- **§1.2 コンボ追加モーダルの既定キャラ**: ◎
  - `ComparePage` が `combos.find((c) => c != null)?.characterId ?? INITIAL_CHARACTER_ID` を算出し（ComparePage.tsx:87-88）`AddComboToCompareModal` に渡す。DES-005 §5.8「比較リスト先頭コンボの characterId（空なら `INITIAL_CHARACTER_ID`）」と一致。
  - `combos` は `ids` 順を保持（`useCompareCombos(ids)` → `queries.map`）するため「先頭コンボ」の意味が正しい。先頭がロード中/エラーで `undefined` の場合は次の非 null コンボを採用する穏当な実装（`.find((c) => c != null)`）。
  - モーダル既定はリュウ固定でなく `defaultCharacterId` 駆動。内部 `CharacterSelector` による手動切替は不変（既存 `setCharacterId` 経路維持、既存テスト「他キャラに切替で useCombos が新 characterId で呼ばれる」も非回帰）。
- **§1.3 伝播機構**: ◎
  - `?character=` route param 方式（指示書推奨）を採用。`ComboEditorPage` が `searchParams.get("character")` を読み、`Number.isFinite` かつ `> 0` かつ `mode === "new"` のときのみ採用（ComboEditorPage.tsx:25-35）。`character=0`/`abc` を弾く堅牢なパースで、テストでも 0・非数値の無視を立証。ComboEditor/モーダルは初期値を受けるのみで内部選択ロジックは不変。

### §2. API・スキーマ整合性: ◎

- 変更9ファイルはすべて `web/src/` 配下のフロント。`internal/` 配下・`migrations/` への変更なし（git show --stat で確認）。登録系 API 契約（POST/PUT/check-duplicate）不変。

### §3. フロントエンドの動作仕様: ◎

- 文脈あり→文脈キャラ、文脈なし→`INITIAL_CHARACTER_ID` の挙動が4経路（新規登録リンク・フッター・モーダル・空リスト）で成立。プロップ不在時の後方互換も `?? INITIAL_CHARACTER_ID` で担保。M10-01 内部挙動・モーダル手動セレクタは不変。

### §4. テストの妥当性: ◎

- 指示書 §5.1 の5ケースを充足:
  1. 新規登録の文脈追従 → ComboEditor.test.tsx「initialCharacterId 指定時…」
  2. 文脈なしで INITIAL → ComboEditor.test.tsx + ComboEditorPage.character.test.tsx「文脈なし…none」
  3. モーダル既定が先頭コンボのキャラ → ComparePage.character.test.tsx「先頭コンボの characterId が…」+ AddComboToCompareModal.test.tsx「defaultCharacterId 指定時…2」
  4. 比較リスト空で INITIAL → ComparePage.character.test.tsx「空のとき…1」
  5. プロップ不在時の後方互換 → ComboEditor.test.tsx + AddComboToCompareModal.test.tsx「不在時は INITIAL…1」
- 加えて伝播機構の堅牢性（character=0/abc の無視、編集モードでの無視）も追加検証。全488件通過の旨がコミットメッセージに記載（コード上は妥当だが実行結果は未再現。下記制約事項参照）。
- E2E（§5.2 A〜D）はコード判定対象外。**E2E-A（マイコンボ→新規→ダルシム）は導線非存在で非該当**＝製造側申し送りどおり。MyComboPage 配下に `/combos/new` 導線が存在しないことを grep で確認済み（後述「設計準拠性以外」参照）。

### §5. 設計意図との整合: ◎

- フロント完結・初期値外部注入のみ・文脈なし INITIAL フォールバック・スコープ2点（+ 申し送りの情報バー defect 修正）すべて整合。`useSelectMode` 不変。situation/custom_states 不変（M11 送り維持）。

### §6. コード品質・規約: ○

- `useCharacterName`（既存 `["characters",{gameId}]` query 利用）で情報バー名を導出＝queryKey 規約整合。`?character=` の命名・型（number パース）も既存ルーティングと整合。camelCase 維持。
- 軽微: 下記「設計準拠性以外の指摘事項」参照。

### §7. 既存挙動の温存（非破壊性）: ◎

- 編集モードのキャラ固定表示不変（テスト立証）。閲覧系 `useCharacters`/`CharacterSelector` 呼び出し元不変。`useSelectMode` 不変。登録系 API/スキーマ不変。既存テスト（M10-01 切替・モーダル手動切替）に手を入れておらず非回帰の蓋然性が高い（実行は別途）。

### §8. ドキュメント: ◎（製造側で確認すべき残件あり）

- DES-005 への直接編集なし（製造は DES を触っていない＝CHANGE-039 で設計担当反映済み）。
- 申し送り2件（MyComboPage に新規登録リンクを追加しない方針／ComboListPage 情報バーのリュウ固定解消を今回スコープに追加）は本報告で追認済み。後者は DES-005 §5.4「現在選択中キャラクター情報バー（アイコン+名前）」の既述に沿った defect 修正であり、新規 CHANGE 不要との製造判断は妥当。
- 注意: 本報告は完了報告書（Plan Mode 最終 view 確認3項目・推測内容・テストケース数の記載）そのものの所在を確認していない。チェックリスト §8 の「完了報告にこれらを含むか」は完了報告書側で別途確認されたい（不明: 完了報告書の所在）。

## 設計準拠性以外の指摘事項

1. **【中】AddComboToCompareModal の open 同期 useEffect が、開いている間の `defaultCharacterId` 変化で手動選択をリセットしうる**（AddComboToCompareModal.tsx:40-44）
   - 依存配列 `[open, defaultCharacterId]`。コメントは「開くたびに同期・開いている間の手動切替は維持」と意図表明しているが、実装上は **open=true のまま `defaultCharacterId` が変化**すると effect が再発火し、手動で切り替えた `characterId` を `defaultCharacterId` に上書きする。
   - 現状の `ComparePage` ではモーダルが背面操作をブロックするモーダルダイアログであり、開いている間に比較リスト（先頭コンボ）が変わる導線がないため**実害が顕在化しない**。よって実挙動上は問題なし＝中（将来 ComparePage 以外から再利用する／背面操作可能な UI に変わると顕在化）。
   - 無限ループ懸念は**なし**: 依存は primitive（boolean/number）であり、`setCharacterId` を同値で呼んでも React がバイルアウトする。再レンダーは defaultCharacterId が実際に変わったときのみ。安全。
   - 推奨（任意）: 「開いた瞬間のみ同期」を厳密化したいなら、前回 open 値を ref で持ち false→true の立ち上がりエッジでのみ同期する、または `[open]` のみを依存にして `defaultCharacterId` を effect 内で参照（eslint exhaustive-deps と要相談）。ただし現状実害なしのため必須ではない。
   - なお `useState` 初期化子（:35-37）と open 時 effect（:40-42）で初期同期がやや二重だが、open=false で初回マウントされる呼び出し方（ComparePage は常時マウント・open 切替）に対し effect が確実に同期するための妥当な冗長で、害はない。

2. **【低】情報バーのアバター文字 `selectedCharacterName.charAt(0)` は表示用途上は妥当だが、`useCharacterName` 未ロード時に一瞬 `"?"`／名称欄が i18n フォールバック表記（`comboList.characterRyu`）になりうる**（ComboListPage.tsx:115,119）
   - `useCharacterName` は characters 取得前は `""` を返すため、ロード直後は アバター `"?"`・名称が `t("comboList.characterRyu")`（=「リュウ」相当の旧固定文言）に落ちる。選択キャラがリュウ以外の場合、ロード中の極短時間だけ「リュウ」が見える可能性。
   - 実害は瞬間的でキャッシュ後は解消するため低。気になる場合はロード中スケルトン/空表示にするか、フォールバック文言を中立な値（例: 空文字や汎用ラベル）にすることを検討。`comboList.characterRyu`（リュウ固定の名残り）をフォールバックに使い続けるのはリュウ固定解消の趣旨とわずかに不整合。

3. **【低】`selectedCharacterName.charAt(0)` は将来 i18n（英語名表示）時に頭文字ロジックの再検討余地**
   - 現状 `nameJa` 由来の先頭1文字。英語ロケールで `nameJa` をそのまま使うと不整合になりうるが、これは情報バー全体の i18n 課題であり M10-02 スコープ外。記録のみ。

## 推奨修正（優先度別）

- 高（M10完了前に修正必須）: **なし**
- 中（次マイルストーン着手と並行可）:
  - 指摘1: `AddComboToCompareModal` の open 同期 effect を「立ち上がりエッジのみ同期」に厳密化（再利用時の手動選択リセット予防）。現状実害なしのため任意。
- 低（将来対応）:
  - 指摘2: 情報バー名称ロード中フォールバックの中立化（`comboList.characterRyu` 依存の解消）。
  - 指摘3: 情報バー頭文字の i18n 対応（情報バー全体課題として別途）。

## 良かった点

- `?character=` パースが `Number.isFinite` + `> 0` + `mode === "new"` の三条件で堅牢。`character=0`/`abc` を弾き、編集/コピーへの混入も防止。テストで0・非数値・編集モードの3異常系まで明示検証している。
- `ComparePage` の `defaultCharacterId` 算出が `.find((c) => c != null)` でロード中/エラー先頭をスキップしつつ ids 順を尊重＝「先頭コンボ」の意味を崩さない。
- 後方互換が全4経路で `?? INITIAL_CHARACTER_ID` に一本化され、プロップ追加が純粋な拡張（既存挙動を変えない）になっている。
- コメントが各変更点に意図（無視条件・フォールバック・手動切替維持）を簡潔明記しており、CLAUDE.md §4 のマジック回避・意図明示の方針に沿う。
- スコープ厳守（`useSelectMode`・BE/スキーマ・編集モード固定・閲覧系に未着手）。申し送りの情報バー defect 修正も DES-005 §5.4 既述準拠で逸脱なし。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実機 E2E（§5.2 A〜D）・パフォーマンスは別途。
- 「全488件通過」はコミットメッセージ記載であり、本レビューでテスト実行による再現確認は行っていない（コード上の妥当性のみ判定）。
- 完了報告書本体（Plan Mode 最終 view 確認3項目・推測内容・テストケース数の記載＝チェックリスト §8）の所在・内容は本レビューでは未確認（不明: 完了報告書の所在）。完了承認ゲートとして別途確認されたい。

---

## 取り込み結果（自動トリアージ）

`implement_plan_full` Phase C による自動トリアージ。優先度「高」の指摘は **なし**のためエスカレーション不要。各指摘の採否と理由を以下に記録（事後監査用）。

| 指摘 | 優先度 | 採否 | 理由 |
|------|--------|------|------|
| 指摘1: AddComboToCompareModal の open 同期 useEffect が `defaultCharacterId` 変化で手動選択を上書きしうる | 中 | **採用** | 根本原因修正を選好。`prevOpenRef` による「立ち上がりエッジのみ同期」へ厳密化（open のまま defaultCharacterId が変わっても手動選択を保持）。低リスクで再利用時の潜在バグを予防。既存テスト10件＋ComparePage 2件すべて通過を確認。 |
| 指摘2: 情報バー名称のロード中フォールバックが `comboList.characterRyu`（リュウ固定の名残り） | 低 | **不採用（持ち越し）** | 表示はキャラ取得前のサブ秒の一過性で実害軽微。中立フォールバックの選定は UX/i18n の意図的判断（新規 i18n キーの是非含む）を要するため、拙速な自動修正を避け backlog 化。 |
| 指摘3: アバター頭文字 `charAt(0)` の i18n（英語名表示時）再検討 | 低 | **不採用（持ち越し）** | 情報バー全体の i18n 課題であり M10-02 スコープ外。記録のみ（将来フェーズ）。 |

**適用コミット**: 指摘1 の修正は本トリアージのチェックポイントコミットに含む。

### 完了報告書の所在（レビュー §8 / 制約事項への回答）
- レビューが「不明」とした完了報告書は、本トリアージ後に `docs/progress/progress-log.md` の M10-02 節として記録した（Plan Mode 最終 view 確認3項目・推測内容・テストケース数・乖離報告を含む）。

---

*以上、M10-02 レビュー報告書（取り込み結果追記済み）*
