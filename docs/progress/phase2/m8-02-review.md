# M8-02 レビュー報告書

## 総評

Playwright 基盤の導入・設定・スモーク spec 作成という骨格は概ね正確に実装されている。チェックリスト §1〜§4 の機械的確認事項（ポート、testid 命名、セレクタ優先順位、スコープ遵守）に重大な逸脱は見られない。ただし、DoD §7 の必須条件である「開発者ローカル実行確認(make e2e 実行・スモーク spec 通過)」が progress-log に未記入のまま完了扱いになっている点が最大の懸案事項。また、M7-02 以前から存在する `data-testid="color-input"` が新設の規約ドキュメントに漏れている軽微な不整合がある。コード品質・設計遵守の面では合格水準であり、主な残課題は DoD の証跡確認と規約ドキュメントの補完。

---

## 設計準拠性レビュー結果

### チェックリスト §1: 基盤導入

| 項目 | 判定 | 詳細 |
|------|------|------|
| `@playwright/test` が devDependencies にあり `e2e` script が追加されている | ◎ | `web/package.json` L13: `"e2e": "playwright test"`、L47: `"@playwright/test": "^1.60.0"` — 正確に追加 |
| `playwright.config.ts` の testDir・baseURL・webServer・chromium project | ◎ | `web/playwright.config.ts`: `testDir: "./e2e"`・`baseURL: "http://localhost:5173"`・dual webServer(47318+5173)・`projects: [chromium]` — すべて揃っている |
| ポートが現行値(vite 5173 / backend 47318)で陳腐化ポートを使っていない | ◎ | 47318 / 5173 を使用。旧シナリオの 3000 / 8080 は使用なし |

### チェックリスト §2: test-id 規約と付与

| 項目 | 判定 | 詳細 |
|------|------|------|
| test-id 規約がドキュメント化されている | ◎ | `docs/design/testid-convention.md` に命名規則・付与方針・付与済み一覧・セレクタ優先順位が記載 |
| 付与は最小限(role で取れる要素に付与しない) | ◎ | 本番コードへの付与は `ComboEditorBasicFields.tsx:285` の1件のみ。Radix Checkbox の role 非対応という正当な理由あり |
| testid 付与はコンポーネントのロジック・構造・見た目を変更していない | ◎ | `data-testid` 属性の追加のみ。`checked`・`onCheckedChange` には変更なし |

### チェックリスト §3: スモーク/回帰 spec

| 項目 | 判定 | 詳細 |
|------|------|------|
| §3.4.1 で合意したフローの spec が `e2e/` にある | ◎ | `web/e2e/combo-crud.spec.ts` — コンボ登録→詳細→編集→削除 の 1本 |
| セレクタが `getByRole` / `getByLabel` 優先で、足りない箇所のみ `getByTestId` | ◎ | `getByTestId` 使用は仮登録チェックボックス1箇所のみ。他は `getByRole`・`getByPlaceholder`・`getByText` を使用 |
| 視覚・レイアウト・レスポンシブのアサートを入れていない | ◎ | URL・テキスト表示・ダイアログ表示・ページ遷移のみ検証。`toHaveScreenshot` 等なし |
| spec が特定 seed の件数に過度に依存していない | ◎ | `Date.now()` でユニーク値生成、spec が自前でデータ作成・削除。件数依存なし |

### チェックリスト §4: スコープ遵守

| 項目 | 判定 | 詳細 |
|------|------|------|
| 視覚・レスポンシブ・LAN 実機・UX 自動化なし | ◎ | 対象なし |
| CI(GitHub Actions 等)を新設していない | ◎ | CI 設定ファイルの追加なし |
| 全 177 シナリオ spec 化・全 UI への testid 乱付けなし | ◎ | 1本・1件に抑制 |
| アプリ挙動・API・DB スキーマに手を入れていない | ◎ | E2E は外側からの検証のみ |

### チェックリスト §5: 実行とテスト

| 項目 | 判定 | 詳細 |
|------|------|------|
| `pnpm e2e` / `make e2e` で webServer 起動 → spec 実行できる | △ | 構成は正しいが、開発者による実機確認未済み(後述) |
| 既存ユニットテスト(Go test / Vitest)が非破壊 | ◎ | progress-log に `go test ./...` 全通過・`pnpm test -- --run` 439テスト全通過と記載 |
| **開発者のローカル実行結果が完了報告に記載されている** | **×** | progress-log §5.2 の実行日・結果欄が空白のまま完了扱いになっている。DoD §7 の必須条件が未充足 |

### チェックリスト §6: ドキュメント

| 項目 | 判定 | 詳細 |
|------|------|------|
| progress-log に M8-02 完了報告が追記されている | △ | 追記済みだが §5.2 ローカル実行結果欄が空白 |
| 追加付与した testid 要素が完了報告に列挙されている | ◎ | `combo-editor-draft-checkbox` を progress-log と testid-convention.md 付与済み一覧に記載 |

---

## 設計準拠性以外の指摘事項

### [A] `playwright.config.ts` が TypeScript 型チェック対象外

`web/tsconfig.json` の `include: ["src", "vite.config.ts"]` に `playwright.config.ts` が含まれていない。`pnpm lint`(`tsc --noEmit`)では型チェックされない。Playwright は独自の TS 解釈を行うため実害は薄いが、型エラーがあっても `pnpm lint` で検出されない。

### [B] 既存 `data-testid="color-input"` が規約ドキュメントの付与済み一覧に未記載

`web/src/features/tag/components/TagFormDialog.tsx:103` に `data-testid="color-input"` が存在する(M7-02 コミット `ea0cdfe` 由来)。M8-02 で新設した `docs/design/testid-convention.md` の「付与済み一覧」には `combo-editor-draft-checkbox` のみ記載されており、既存 testid が漏れている。将来の開発者が規約ファイルを一覧として参照した際にプロジェクト全体の testid 全容を把握できない。

### [C] ウィザード完了前提が暗黙的環境依存として残る

spec の冒頭コメントに「ウィザードが完了済みのローカル開発環境で実行すること」と記されているが、これは `testid-convention.md` や README に記載がなく、spec を初めて実行した開発者が前提を見逃すリスクがある。DB 前提(seed 非依存)は §3.4.4 で確認済みだが、ウィザード完了という別次元の環境依存が未整備な状態。

### [D] `headless` が設定で明示されていない

指示書 §4.2 は `use: headless: true` を推奨しているが、`playwright.config.ts` では明示されていない。Playwright のデフォルトが headless なので動作上の問題はないが、設定が明示的でないため意図が読み取りにくい。

---

## 推奨修正(優先度別)

- **高(M8 完了前に修正必須)**:
  - **[開発者タスク]** `make e2e` を実行し、`combo-crud.spec.ts` の PASS/FAIL を progress-log §5.2 に記入する。DoD §7「合意したスモーク spec がローカルで通過する」の証跡が未確認のため、M8-02 の正式完了には開発者によるこの確認が必要。

- **中(M9 着手と並行可)**:
  - **[C]** `testid-convention.md` または `docs/design/e2e-setup.md` 相当のファイルに「spec 実行前提: ウィザード完了が必要」を明記し、初回実行者への案内を整備する。
  - **[B]** `testid-convention.md` の付与済み一覧に既存の `combo-editor-draft-checkbox` 以外の testid(`color-input` @ `TagFormDialog.tsx`) を追記し、一覧を完全にする。

- **低(将来対応)**:
  - **[A]** `playwright.config.ts` を `web/tsconfig.json` の `include` に追加するか、`playwright.config.ts` 専用の `tsconfig.playwright.json` を整備して `pnpm lint` の型チェック対象に含める。
  - **[D]** `playwright.config.ts` の `use:` に `headless: true` を明示し、意図を可読化する。

---

## 良かった点

- **seeed 非依存な spec 設計**: `Date.now()` でユニーク値を生成し、spec 自身がデータ作成・削除を完結させる設計は M9 の seed ツール再生成(CHANGE-025)の影響を受けず堅牢。
- **testid 付与の最小限徹底**: Radix Checkbox に対して正当な理由(accessible name 自動設定非対応)を根拠に1件のみ付与し、他はすべて `getByRole` / `getByPlaceholder` で対応。設計意図の理解が正確。
- **dual webServer 設定**: backend と vite を配列で指定し `reuseExistingServer: true` を双方に設定した構成は、既存起動サーバ再利用とコールドスタートの両方を自然に処理する。
- **testid-convention.md の品質**: 命名規則・付与理由の例(Radix Checkbox の例)・セレクタ優先順位が1ファイルに整理されており、後続の spec 作成者が即参照できる。
- **e2e/tsconfig.json の適切な調整**: `moduleResolution: "node"` へのオーバーライドにより Playwright/Node.js 実行環境との整合を取っており、メイン tsconfig の `bundler` 設定と競合しない。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `make e2e` の実際の実行・spec 通過確認は開発者環境で行う必要があり、本レビューでは確認できていない。

---

**総合判定**: 軽微指摘あり・合格(開発者ローカル実行確認を条件)。コード品質・設計遵守の面で重大指摘は 0 件。DoD の最終確認(開発者による `make e2e` 実行と結果記入)のみが M8-02 正式完了の残課題。
