# M6-02 レビュー報告書

## 1. レビュー実施日

2026-05-24

## 2. レビュー結果サマリ

| セクション | 結果 | 備考 |
|-----------|------|------|
| §1 ファイル一覧チェック(network 系 + defaults 系 + ヘッダ修正) | ⚠️ | SettingsPage/WizardPage テストファイル未作成 |
| §2 着手前確認結果 | ❌ | 完了報告が progress-log.md に存在しないため確認不可 |
| §3 Plan Mode 必須項目 8 件 | ❌ | 完了報告不在のため承認結果確認不可 |
| §4 ConfigResponse.network 拡張 | ✅ | 指示書通り、architecture-patterns §2.1 準拠 |
| §5 Config.Defaults 拡張(v1.0.1 新規) | ✅ | 指示書通り |
| §6 フロントエンド API クライアント | ✅ | X-Requested-With 明示付与、型定義完全 |
| §7 アプリ起動時の初回判定リダイレクト | ✅ | App.tsx で正常実装 |
| §8 初回起動ウィザード | ⚠️ | Step 6 内容が指示書と相違、スキップボタン未実装 |
| §9 設定画面 | ⚠️ | ローカルモード接続情報の表示が仕様と微妙に異なる |
| §10 テスト要件(BE 14 件 + フロント 20 件以上) | ❌ | フロントエンドテスト大幅不足(20件以上 → 実装7件) |
| §11 E2E シナリオ A〜I | ❌ | 完了報告不在のため確認不可 |
| §12 コード品質・規約遵守 | ✅ | CLAUDE.md §4 規約準拠、architecture-patterns 準拠 |
| §13 ドキュメント | ❌ | progress-log.md に M6-02 完了報告が追記されていない |

---

## 3. Plan Mode 必須項目 8 件の開発者承認結果確認

**確認不可**: progress-log.md に M6-02 完了報告が存在しないため、§3.4.8 必須項目 8 件の開発者承認結果を確認できない。チェックリスト §14 重大判定基準「§3 Plan Mode 必須項目(8件)の開発者承認結果が完了報告に含まれていない」に該当する可能性がある。

コードから推定できる範囲:
- 必須項目 1(`ConfigResponse.network` 最終形): 空文字 + ログ警告の実装 → 設計担当推奨と一致
- 必須項目 2(QR ライブラリ): `qrcode.react@^4.2.0` 採用 → 設計担当推奨と一致
- 必須項目 3(初回判定リダイレクト位置): `App.tsx` 実装 → 設計担当推奨と一致
- 必須項目 4(進捗バー実装方式): `WizardProgress` 専用コンポーネント → 設計担当推奨と一致
- 必須項目 5(レスポンシブ実装): Tailwind クラスで実装 → 設計担当推奨と一致
- 必須項目 6(言語選択実装): react-i18next 初期化 + キー追加 → 設計担当推奨と一致
- 必須項目 7(ウィザード完了遷移先): `navigate("/", { replace: true })` → 設計担当推奨と一致
- 必須項目 8(`[defaults]` フィールド設計): TOML snake_case / JSON camelCase / Go PascalCase / int64 値型 → 設計担当推奨と一致

---

## 4. architecture-patterns.md v1.0.4 §2.1 準拠確認

### 4.1 network 拡張(§4.1)

| 確認項目 | 結果 |
|----------|------|
| `Service` インターフェース定義(`internal/service/config/service.go`) | ○ - `type Service interface` として公開定義 |
| 非公開 `service` 構造体実装 | ○ - `type service struct` で非公開実装 |
| `NewService` がインターフェース型返却 | ○ - `func NewService(...) Service` でインターフェース返却 |
| `*service` 具象型ポインタを返していない | ○ - 適切 |
| `LanIpResolver` による依存性注入 | ○ - `func() (net.IP, error)` 型で注入 |

### 4.2 defaults 拡張(§4.1bis、v1.0.1 新規)

| 確認項目 | 結果 |
|----------|------|
| `Service` インターフェース戻り値拡張が同パターン踏襲 | ○ - `Get()` / `Update()` の戻り値に `network NetworkInfo` を追加、`*service` を返していない |
| 既存 4 サブ構造体(Server / Database / Logging / Security)の変更なし | ○ - `DefaultsConfig` 追加のみ、既存 4 サブ構造体は変更なし |
| `DefaultsConfig` 構造体追加が `internal/config/config.go` 内で完結 | ○ - 同ファイルに定義済み |

---

## 5. 設定画面 6 セクション ↔ 既存実装実態の対応表確認

- **製造担当の Plan Mode 計画提示に対応表 15 項目が完全に埋められているか**: 確認不可(完了報告不在)
- **未確認項目の有無**: 確認不可

ただし実装コードから検証すると、6 セクション全コンポーネントが実装されており、指示書 §3.4.7 の表に示された全アクション(既存値表示 / disabled + ツールチップ / サービス層拡張)が対応されている。

---

## 6. 検出した問題

### 6.1 重大な問題(完了承認保留)

#### [重大-1] フロントエンドテスト大幅不足

**判定根拠**: チェックリスト §10.2「必須 20 件以上」、§14 重大判定基準「§10 必須テスト(フロント 20 件以上)のいずれかが未実装または失敗」

**実態**: M6-02 で新規追加されたフロントエンドテストは 7 件のみ:
- `useConfig.test.ts`: 1 件
- `useUpdateConfig.test.ts`: 1 件
- `QRCodeModal.test.tsx`: 3 件
- `WizardProgress.test.tsx`: 2 件

**不足テスト(計 16件以上)**:

以下の指示書 §5.1.2 必須テストファイル・テストケースが未実装:

| ファイル | 必須テスト | 優先度 |
|----------|-----------|--------|
| `SettingsPage.test.tsx` | 6 セクション全レンダリングテスト | 必須 |
| `SettingsPage.test.tsx` | ネットワークセクション QR ボタン有効・無効テスト | 必須 |
| `SettingsPage.test.tsx` | バックアップ/リストア/キャッシュ再構築 disabled + ツールチップテスト | 必須 |
| `SettingsPage.test.tsx` | ユーザー追加・編集ボタン disabled テスト | 必須 |
| `SettingsPage.test.tsx` | デフォルトキャラ変更 → PUT `/api/config` に `{ defaults: { characterId } }` 送信テスト | 必須 |
| `SettingsPage.test.tsx` | デフォルトプリセット変更 → PUT `/api/config` に `{ defaults: { presetId } }` 送信テスト | 必須 |
| `SettingsPage.test.tsx` | セクション 5 プリセット管理リンク disabled + ツールチップテスト | 必須 |
| `WizardPage.test.tsx` | 7 ステップ全件レンダリングテスト | 必須 |
| `WizardPage.test.tsx` | LAN 無効時の 6 ステップ遷移テスト(ステップ 5 → 7) | 必須 |
| `WizardPage.test.tsx` | LAN 有効時の 7 ステップ遷移テスト(ステップ 5 → 6 → 7) | 必須 |
| `WizardPage.test.tsx` | 完了ボタンで PUT `/api/config` + コンボ一覧遷移テスト | 必須 |
| `WizardPage.test.tsx` | ステップ 3 で defaults.characterId がリクエストに含まれるテスト | 必須 |
| `WizardPage.test.tsx` | ステップ 4 で defaults.presetId がリクエストに含まれるテスト | 必須 |
| `WizardPage.test.tsx` | ステップ 3 スキップ時 defaults.characterId がデフォルト値 1 で送信テスト | 必須 |
| App.tsx リダイレクトテスト | `isInitialized: false` → `/wizard` リダイレクトテスト | 必須 |
| App.tsx リダイレクトテスト | `isInitialized: true` → 通常起動テスト | 必須 |
| Header | プリセットリンク disabled + ツールチップテスト | 必須 |

---

#### [重大-2] progress-log.md に M6-02 完了報告が存在しない

**判定根拠**: チェックリスト §14 重大判定基準「§13 progress-log.md 完了報告に必須項目が含まれていない」、指示書 §7.4 義務付け事項

progress-log.md の最後のエントリは M6-01(行 1783)であり、M6-02 のエントリが追記されていない。

結果として以下の必須確認が不可能となっている:
- §3.4 着手前確認結果(§3.4.1〜§3.4.7)
- §3.4.8 Plan Mode 必須項目 8 件の開発者承認結果
- §5.2 E2E シナリオ A〜I の実行結果
- 例外条項適用箇所(§2.4 (a)〜(h))の明示

---

### 6.2 軽微な問題(完了承認可、改善推奨)

#### [軽微-1] ウィザード Step 6 の内容が指示書と異なる

**指示書 §4.4.1**: Step 6 = 「パスワード設定」(LAN 有効時のみ、UI 表示のみ)

**実装**: `Step06LanInfo.tsx` = LAN 接続情報表示(LAN URL + QR コード表示)

パスワード設定 UI は未実装。LAN 接続情報は Step 6 として独立、指示書の Step 6 役割が差し替えられた形。完了報告不在のため Plan Mode で開発者承認済みか不明。機能的には「LAN 有効時のみ表示」という条件は満たしており、§1.3 のパスワード認証ロジック組み込み禁止は遵守されている。

#### [軽微-2] SettingsSectionNetwork: ローカルモード時の接続情報表示

**指示書 §4.5.4**: `local` 時に `127.0.0.1:<port>` を表示

**実装**: ローカルモード時は port のみ表示し、LAN 詳細情報(IP アドレス / URL / QR ボタン)を非表示にする設計。また、QR ボタンは ローカルモード時に「disabled + ツールチップ」ではなく非表示。チェックリスト §9.4 の「ローカルモード時は disabled + ツールチップ "LAN 共有モード時のみ利用可能"」と完全には一致しない。

#### [軽微-3] Step03Character にスキップボタン非表示

**指示書 §4.4.1**: 「スキップ可能」。**チェックリスト §8.1**: 「スキップボタンがステップ 3(デフォルトキャラ選択)で動作する」

**実装**: Step03Character.tsx は「次へ」ボタンのみで専用の「スキップ」ボタンなし。「次へ」を押せば現在のデフォルト値(characterId=1)が保持されるため機能的には同等だが、チェックリストの明示要件を厳密には満たさない。

#### [軽微-4] 言語選択の永続化確認不可

`SettingsSectionBasic.tsx` では `i18n.changeLanguage()` のみ呼び出しており、config.toml への保存なし。指示書 §4.5.2 で「言語選択もブラウザストレージ保存」が設計担当暫定推奨とされているが、Plan Mode 承認記録が不在のため確認不可。react-i18next のデフォルト挙動によりローカルストレージへの言語保存が行われているかどうかは実機確認が必要。

#### [軽微-5] 共有 Header.tsx の不在と各ページの独立ナビゲーション

プロジェクト構造として共有 `Header.tsx` コンポーネントが存在せず、各ページが独自ナビゲーションヘッダを内包。SettingsPage.tsx の内部ヘッダには disabled プリセットリンク(`<span>`タグ)を実装済み。ComboListPage.tsx 等の他ページにはそもそもプリセットリンクが存在しないため、disabled 化の適用範囲は SettingsPage のみとなっている。チェックリスト §9.7 は「Header.tsx または相当ファイル」の修正を前提としているが、構造上の差異として軽微扱いとする。

---

### 6.3 改善提案(次回マイルストーン以降)

1. **WizardPage.test.tsx / SettingsPage.test.tsx の整備**: M6-03 着手前に M6-02 必須テスト 16 件以上を補完することを強く推奨。ウィザードのステップ遷移・デフォルト値送信のテストは回帰防止の観点で重要。

2. **Step 6 の設計意図の明文化**: Step 6 を「パスワード設定」から「LAN Info」に変更した経緯を progress-log.md の CHANGE 事項として記録し、設計担当に通知することを推奨。

3. **ネットワークセクションのローカルモード接続情報表示**: 指示書との乖離を M7 以降で修正し、`127.0.0.1:<port>` 表示 + QR ボタン disabled + ツールチップを追加する。

---

## 7. 制約事項

本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、E2E シナリオ A〜I の実行、LAN モード切替の実機検証、QR コード読取テスト、`config.toml` の `[defaults]` セクション確認、ヘッダのプリセットリンク disabled 視覚確認)は別途実施が必要**(playbook §14)。

動作確認シナリオの手動確認は開発者の責任範囲。

---

## 8. 完了承認判定

**⚠️ 条件付き承認** — 以下の対応が完了したことを確認後に M6-02 承認とする:

1. **[重大-1] フロントエンドテスト補完**: SettingsPage.test.tsx / WizardPage.test.tsx / App.tsx リダイレクトテスト / Header プリセット disabled テスト を実装し、pnpm test 全件通過を確認する。
2. **[重大-2] progress-log.md への M6-02 完了報告追記**: §3.4.1〜§3.4.8 確認結果 / 例外条項 (a)〜(h) / E2E シナリオ A〜I 実行結果 / Plan Mode 必須項目 8 件承認結果を含む完了報告を追記する。

**なお、上記 2 点以外のコア実装品質(バックエンド全体・フロントエンド主要コンポーネント・ビルド・既存回帰)は高水準であり、完了報告補完後の承認を妨げる問題はない。**

---

## 9. 良かった点

- **architecture-patterns §2.1 の厳格な遵守**: `Service` インターフェース定義 + `NewService` がインターフェース型返却 + `LanIpResolver` 依存性注入 + `*service` 具象型非公開実装。M6-01 で確立したパターンを完全に踏襲。
- **`writeAtomic` の堅牢な実装**: `.tmp` → `f.Sync()` → `f.Close()` → `os.Rename()` の順でエラー処理を分離し、各ステップでのロールバック(`.tmp` 削除)も確実に行う実装。
- **`X-Requested-With` ヘッダの明示付与**: `configApi.ts` の `update` メソッドで CSRF ヘッダを明示付与。既存の `api-client.ts` の `fetchJSON` が `GET` でヘッダ不要なため、PUT のみで明示付与する正しい実装。
- **QRCodeModal のアクセシビリティ**: `role="dialog"`, `aria-modal="true"`, `aria-label`, `tabIndex={-1}`, ESC キーでの閉じる動作まで実装。
- **6 セクション独立コンポーネント分離**: `SettingsSectionBasic` / `User` / `Network` / `Data` / `PresetLink` / `Details` の責務分離が明確。
- **`DefaultsConfig` TOML / JSON / Go 命名規則の完全準拠**: TOML `character_id` / JSON `characterId` / Go `CharacterID` の三層命名を CLAUDE.md §4 規約に完全準拠。
- **バックエンドテスト全件通過**: M6-01 既存 7 件 + 新規 network 系 3 件 + defaults 系 3 件(サービス層)/ network 系 2 件 + defaults 系 2 件(ハンドラ層)/ defaults 系 4 件(`config_test.go`)の計 21 件が全通過。
