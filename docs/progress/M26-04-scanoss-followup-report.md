# M26-04 SCANOSS ローカル実行・追補報告

- 記録日: 2026-09-20
- 状態: **公開候補の再スキャンと差分判定まで完了。A9 / A-1 は新規一致 1 件の扱いが現行完了条件と衝突するため未完了のまま**
- 検査対象コミット: **非公開リポの固定 commit**（SHA 非掲載＝下記「★本書からの非掲載」）
- SCANOSS CLI: `scanoss 1.54.2`
- SCANOSS server: `5.4.25`
- KB: daily `26.09.20` / monthly `26.08`

> **★本書からの非掲載**（2026-09-20・`M40-01`・開発者確定）
>
> **本書には非公開リポ `combomgr` の commit SHA が 3 件あった**〔検査対象コミット ／ §5.4 ／ §5.5〕**。⇒ 本書 §7.1「非公開履歴を常時掲載しない」に実装を合わせ、SHA の値だけを伏せた。**
>
> **★落としていないもの＝日付・一致率・外部ファイルの MD5・判定・差分統計・件数。** ⇒ 本書の主張は SHA の値を引かずに成立する。**★SHA は非公開リポ側に保持しており、来歴の問い合わせを受けたときに範囲を限定して提示できる**（`docs/process/public-release-runbook.md` §2.A.2）。
>
> **★外部プロジェクトの tag commit は公開情報であり伏せていない**（実査＝一意 6 件）。**★`D-274` (3) が禁じているのは内容の訂正であり、公開してはいけない値を残すことではない**（`D-823` の一般則と同型）。

本報告は、`M26-04` でネットワーク制約により未実施だった SCANOSS を開発者の
Windows ローカル環境で実行した追補記録である。初回スキャンの全 match はトリアージ済み
だが、§7 の是正と再スキャンが残るため、A9 の最終完了報告ではない。

是正後の再スキャンは `docs/handover/scanoss-local-rescan-handover.md` に従う。同手順では、
Windows ローカルで clone、固定 SHA 検証、抽出、SCANOSS 実行、持込 ZIP 作成までを自動化し、
devContainer で Git blob、成果物ハッシュ、件数、初回結果との差分を自動検証する。

リポジトリ内の初回 evidence:

- `docs/progress/evidence/m26-04-scanoss/scan-matches-initial.csv`
- `docs/progress/evidence/m26-04-scanoss/scan-review-chronology-initial.csv`
  **★本ファイルは公開スナップショットから `DENY` した**（2026-09-20・`M40-01`・開発者確定）**。⇒ 非公開リポの初出 commit SHA と author date を持ち、公開リポにその SHA は存在しないため第三者が検証できない。★リポジトリ内には残る。**
- `docs/progress/evidence/m26-04-scanoss/scan-unknown-license-priority-initial.csv`
- `docs/progress/evidence/m26-04-scanoss/scan-anomalous-license-priority-initial.csv`

## 1. 検査対象と成果物

Windows ローカル環境で、Git の固定コミットから次のパスだけを `git archive` で抽出して検査した。

- `cmd/`
- `internal/`
- `web/src/`

作業ディレクトリ:

`C:\Users\altle\tacpendium\scanoss-20260920-165759`

主要成果物:

- `tacpendium-source.tar`: 10,547,200 bytes
- `tacpendium.wfp`: 1,190,148 bytes
- `scan-results.json`: 356,330 bytes
- `scan-results-formatted.json`: 356,417 bytes
- `scan-matches.csv`
- `scan-review-queue.csv`
- `scan-review-chronology.csv`

抽出元と抽出先のファイル数はともに 1,078 件。`.env`、秘密鍵、DB、`.git`、`node_modules` 等の想定外ファイルは検出されなかった。Norton で `C:\Users\altle\tacpendium` をスキャンし、問題なし。

WFP に記録されたファイルは 1,040 件。WFP 生成と SCANOSS scan はいずれも終了コード 0。

## 2. SCANOSS 全体結果

| ID | 件数 | 意味 |
|---|---:|---|
| `none` | 959 | 一致なし |
| `snippet` | 62 | 部分一致候補 |
| `file` | 19 | ファイル一致候補 |
| 合計 | 1,040 | WFP に含まれたファイル数 |

ライセンス名は SCANOSS が一致先コンポーネントについて返した値であり、Tacpendium のコードへそのまま適用されるものではない。`status: pending` も違反判定ではなく未分類を表す。

## 3. shadcn/ui 系の判定

完全一致 19 件は `web/src/components/ui/` と `web/src/lib/utils.ts` に集中している。さらに `sheet.tsx`、`alert-dialog.tsx`、`dialog.tsx` が高率 snippet 一致になった。

Git 履歴および設計・実装記録から、これらは M7 で shadcn/ui CLI を用いて導入した既知の vendored source である。SCANOSS が示した `utmist2`、`smart_spore_hub`、`openfields`、その他のリポジトリは、同じ shadcn/ui コードを取り込んだ派生先であり、Tacpendium の実際の取得元とは扱わない。

暫定結論:

- SCANOSS が派生先について表示した GPL / LGPL / Apache 等を Tacpendium に適用しない。
- 公式上流 shadcn/ui の MIT 由来として扱う。
- **公開前の実対応として、shadcn/ui 由来ファイルの MIT 帰属表示を追加する必要がある。**
- この帰属欠落は SCANOSS で初めて判明したものではなく、`M26-03` 完了報告ですでに指摘されている。

## 4. 優先目視対象の選定

次の条件を重ね、外部ファイルそのものを取得して確認する対象を 5 件に絞った。

- snippet 一致
- GPL / AGPL / LGPL 表示
- 一致率 50% 以上
- SCANOSS の release date が Tacpendium 側の初出日より前

対象:

1. `web/src/features/tag/components/TagDeleteConfirmDialog.test.tsx`
2. `web/src/features/combo/components/DuplicateWarning.tsx`
3. `web/src/features/combo/components/PutConfirmDialog.tsx`
4. `web/src/hooks/useIsMobile.ts`
5. `internal/service/validation/result.go`

## 5. 完了した個別判定

### 5.1 TagDeleteConfirmDialog.test.tsx — 偽陽性

SCANOSS 結果:

- 一致先: `jfolcini/agaric`
- 版: `0.1.3`
- tag commit: `bcd95911596f2a79b70894c3badf2cb88f29d5c0`
- 外部ファイル: `src/components/__tests__/UnpairConfirmDialog.test.tsx`
- ライセンス表示: `GPL-3.0-only`
- snippet 一致率: 91%
- 外部ファイル MD5: `1b73e36eac1c7063905d7132a2d9b940`
- SCANOSS の `file_hash` と取得ファイルの MD5: 一致

目視結果:

- 外部側はデバイスの unpair 確認ダイアログのテスト。
- Tacpendium 側はタグ削除時の `usageCount` 分岐のテスト。
- 外部側にあるクリック操作、Cancel、axe アクセシビリティ検査は Tacpendium 側にない。
- Tacpendium 側のタグ型、i18n、使用件数分岐は外部側にない。
- 共通するのは React Testing Library / Vitest の一般的なテスト構造。

暫定分類:

`false positive / common test structure`

対応:

GPL 帰属追加・ライセンス変更は不要。

### 5.2 DuplicateWarning.tsx — 偽陽性

SCANOSS 結果:

- 一致先: `mai-with-u/maibot`
- 版: `1.0.0-pre.1`
- tag commit: `8c8115b5015d3e28e4fb9e345e7bcb8c408bc5b0`
- 外部ファイル: `dashboard/src/routes/resource/expression/ExpressionDialogs.tsx`
- ライセンス表示: `GPL-3.0-only`
- snippet 一致率: 80%
- 外部ファイル MD5: `2053fd96396cf6ad3f9145ceb5e05e50`
- SCANOSS の `file_hash` と取得ファイルの MD5: 一致

目視結果:

- SCANOSS の外部側一致範囲は 11--40 行。
- 一致範囲はほぼすべて shadcn/ui の import 宣言。
- 外部ファイルは 557 行以上の複数ダイアログ実装、Tacpendium 側は短い単一目的の警告ダイアログ。

暫定分類:

`false positive / shared shadcn/ui imports and dialog structure`

対応:

GPL 帰属追加・ライセンス変更は不要。shadcn/ui の MIT 帰属対応へ集約する。

### 5.3 PutConfirmDialog.tsx — 偽陽性

SCANOSS 結果:

- 一致先: `mai-with-u/maibot`
- 版: `1.0.0-pre.1`
- tag commit: `8c8115b5015d3e28e4fb9e345e7bcb8c408bc5b0`
- 外部ファイル: `dashboard/src/routes/resource/expression/ExpressionDialogs.tsx`
- ライセンス表示: `GPL-3.0-only`
- snippet 一致率: 75%
- 外部ファイル MD5: `2053fd96396cf6ad3f9145ceb5e05e50`
- SCANOSS の `file_hash` と取得ファイルの MD5: 一致

目視結果:

- SCANOSS の外部側一致範囲は 7--31 行。
- 一致範囲は shadcn/ui の import 宣言。
- 空白無視のファイル差分は 13 insertions / 544 deletions で、ファイル全体は別物。

暫定分類:

`false positive / shared shadcn/ui imports and dialog structure`

対応:

GPL 帰属追加・ライセンス変更は不要。shadcn/ui の MIT 帰属対応へ集約する。

### 5.4 useIsMobile.ts — 要レビュー・書き換え候補

SCANOSS 結果:

- 一致先: `kenlasko/monize`
- 版: `v1.9.7`
- tag commit: `389d7e126254ae69d982fd8c1c850bbebc2c05c1`
- 外部ファイル: `frontend/src/hooks/useIsMobile.ts`
- ライセンス表示: `AGPL-3.0, AGPL-3.0-only`
- snippet 一致率: 70%
- 外部ファイル MD5: `9fab4badc0c2dac5ba0c0485b6bf681b`
- SCANOSS の `file_hash` と取得ファイルの MD5: 一致
- monize release date: 2026-05-05
- Tacpendium 側初出: 2026-05-24、**非公開リポの commit**（SHA 非掲載＝冒頭の注記）

目視結果:

- monize 側の `"use client"` の有無と引用符・空行を除き、実装は実質同一。
- `MOBILE_QUERY` の値 `(max-width: 639px)`、関数名、関数分割、購読・解除、server snapshot、最終 return が一致する。
- `useSyncExternalStore` と `matchMedia` の組合せ自体は一般的・機能的な短い実装であり、同様の公開例は存在する。
- それでも、前 3 件のように単なる import やテスト雛形だけが一致したケースより一致の実質が強い。

暫定分類:

`needs review / substantially identical short utility`

推奨対応:

- monize から取得した根拠がない場合、公開前に独立した別実装へ書き換えるのが最も明快。
- 現時点では monize 由来と断定せず、AGPL 帰属も追加しない。
- 書き換え後は対象コミットで WFP / SCANOSS を再実行し、この一致が消えることを確認する。

### 5.5 validation/result.go — 偽陽性

SCANOSS 結果:

- 一致先: `vrooli/vrooli`
- 版: `v3.1.0`
- tag commit: `20339bdedee908bfa0454ec7757e8fa16207fd6f`
- 外部ファイル: `scenarios/test-genie/api/internal/requirements/types/errors.go`
- ライセンス表示: `AGPL-3.0, AGPL-3.0-only`
- snippet 一致率: 61%
- 外部ファイル MD5: `eaffd7d64f1d0529303856fe1e4a0883`
- SCANOSS の `file_hash` と取得ファイルの MD5: 一致
- vrooli release date: 2026-01-09
- Tacpendium 側初出: 2026-04-30、**非公開リポの commit**（SHA 非掲載＝冒頭の注記）

目視結果:

- 共通するのは `ValidationResult`、issue slice、error / warning の追加、severity の走査という Go の一般的なバリデーション集約構造。
- vrooli 側は `FilePath`、`RequirementID`、`SeverityInfo`、constructor、件数集計を持つ。
- Tacpendium 側は `Code`、JSON tag、`Details`、`Add(ValidationIssue)`、details 付き warning、severity 別 slice の返却を持つ。
- コメント、データ契約、公開メソッド、対象ドメインは異なる。
- ファイル全体の差分は 76 insertions / 246 deletions であり、外部ファイル全体のコピーではない。

暫定分類:

`false positive / conventional Go validation-result structure`

対応:

AGPL 帰属追加・ライセンス変更は不要。

## 6. 未完了

### 6.1 全体の最終分類

重点 5 件の確認完了後、残る低～中率 snippet は次の類型で一括分類する。

- テストフレームワークの定型構造
- CRUD / API handler の定型構造
- shadcn/ui / Radix UI の共通構造
- 短い汎用 hook / utility
- Tacpendium 側が検出先より先に存在するもの

#### ライセンス空欄・高率一致の追加確認

ライセンス空欄、検出先が先、一致率 50% 以上の候補は 5 件。

1. `web/src/hooks/useRecentCombos.test.ts` — `ai-kanban`、95%
2. `web/src/hooks/useSessionStorage.ts` — `aia-product-compass-hub`、80%
3. `web/src/features/setup/hooks/useUpdateSetup.ts` — `octant`、60%
4. `web/src/features/tag/components/TagFormDialog.test.tsx` — `go-copilot`、55%
5. `web/src/features/combo/components/CharacterChangeConfirmDialog.tsx` — `sgte-app`、54%

`ai-kanban` は SCANOSS 上の版 `nightly-2026-04-28`、外部ファイル
`frontend/src/hooks/use-analytics.test.ts`、期待 MD5
`0e537dfc932a02107763679a700e3724`。2026-09-20 の確認時点で、SCANOSS が示す
GitHub archive URLと npm exact-version endpointはいずれも HTTP 404 で、参照ファイルを
再取得できなかった。

暫定分類:

`unverifiable upstream / high-similarity test candidate`

推奨対応:

- 取得不能を理由に「問題なし」とはしない。
- 短いテストであるため、`useRecentCombos.test.ts` を既存ファイルを参照せず独立した構造へ
  書き換え、再スキャンで一致が消えることを確認する候補とする。
- 残る 4 件は、取得前に参照の存在と容量を確認し、必要最小限のファイルだけを取得する。

`aia-product-compass-hub` は tag `fastrack-training-2`（commit
`5ebd02abbe99d3db9221fcf4ff6938fdb783639e`）を partial clone + sparse checkout で取得。
Git metadata 取得後 0.10 MB、対象ファイル checkout 後 0.28 MB。Norton scan は問題なし。
`src/hooks/useLocalStorage.ts` の MD5 は
`6a61344044e074bdbf858853d8f2d789` で SCANOSS の `file_hash` と一致した。

`useSessionStorage` の一致範囲は、state 初期化、`sessionStorage.getItem`、JSON parse、
functional update、JSON stringify、例外処理、戻り値まで実質同一。差は型注釈、整形、
警告ログをコメントに変えた点である。外部 release date は 2026-05-04、Tacpendium 側初出は
2026-05-31。

暫定分類:

`needs review / substantially identical short storage hook`

推奨対応:

- 取得元である根拠がなくライセンスも空欄のため、外部由来とは断定しない。
- 公開前に、既存ファイルを参照せず独立した別実装へ書き換える候補とする。
- 書き換え後の再スキャンで一致が消えることを確認する。

`octant` は SCANOSS 上の版 `9ebb6b85`、外部ファイル
`octant-9ebb6b85/client/src/hooks/mutations/useUserAcceptsTOS.ts`、期待 MD5
`029abe1abfd1aaa3e7f167b3e1764874`。2026-09-20 の匿名確認では、GitLab archive URL が
HTTP 302 で `https://gitlab.com/users/sign_in` へ転送された。Git credential manager も
認証画面を表示したため中止し、資格情報は入力していない。今回の調査のために GitLab
アカウントは作成しない。

暫定分類:

`unverifiable upstream / generic mutation-hook candidate`

推奨対応:

- 取得不能を理由に「問題なし」とはしない。
- `useUpdateSetup.ts` は短い hook であるため、既存外部ファイルを参照せず独立した構造へ
  書き換え、再スキャンで一致が消えることを確認する候補とする。

`go-copilot` は Go module proxy から版
`v0.0.0-20260224160801-ff241635b7af` を取得。ZIP は 625,307 bytes、SHA-256
`84fbed5aa242ffeee93fd84d609af94f16f8d3b44b68fcb399b94b72b85bae1d` で配信時の
ETag と一致した。展開後は 331 files / 1.80 MB。ZIP と展開先の Norton scan はともに
問題なし。外部ファイル `frontend/src/features/users/components/user-form-dialog.test.tsx` の
MD5 は `f827bbbcd6ea01c755e72a98ab560522` で SCANOSS の `file_hash` と一致した。

目視結果:

- 外部側は user create / edit form のテスト、Tacpendium 側は tag create / edit form のテスト。
- 共通するのは create / edit 表示、必須入力、形式検証、submit を検査する一般的なフォーム
  テストの並びと React Testing Library / Vitest の定型コード。
- データ型、入力項目、検証規則、文言、assertion、ResizeObserver stub 等は異なる。
- 空白無視のファイル差分は 79 insertions / 121 deletions。

暫定分類:

`false positive / common create-edit form test structure`

対応:

外部コードの帰属追加・ライセンス変更・書き換えは不要。

`sgte-app` は tag `v1.2.0` を partial clone + sparse checkout で取得。Git metadata は
約 0.08 MB、対象ファイル checkout 後は約 203 KB。Norton scan は問題なし。
`resources/js/components/admin/delete-user-dialog.tsx` の MD5 は
`31d757aac2ad425c410f50b968203457` で SCANOSS の `file_hash` と一致した。

目視結果:

- 共通するのは shadcn/ui `AlertDialog` の import、props、JSX 骨格。
- 外部側は Inertia form による user 削除、Tacpendium 側はコールバックによる character
  変更確認。
- 外部側固有の user data、削除 API、processing state、icon と、Tacpendium 側固有の
  confirm / cancel 契約およびゲーム内説明は異なる。

暫定分類:

`false positive / shared shadcn-ui AlertDialog structure`

対応:

外部コードの帰属追加・ライセンス変更・書き換えは不要。shadcn/ui の MIT 帰属対応へ
集約する。

#### 特殊ライセンス表示の追加確認

通常の permissive license ではない高率一致は 2 件。

1. `web/src/features/setup/hooks/useDeleteSetup.test.ts` — `GIRO` v2.0.2、83%、JSON
2. `web/src/lib/api-client.test.ts` — `bastion` v0.2.2、76%、Apache-2.0 / TORQUE-1.1

`GIRO` は外部ファイル
`apps/desktop/src/hooks/enterprise/__tests__/useActivities.test.ts`、期待 MD5
`2bac91187a682d107ca2f65e173e8b99`。2026-09-20 の確認時点で、SCANOSS が示す
`https://github.com/jhonslife/GIRO.git` は `Repository not found` を返し、tag `v2.0.2`
を再取得できなかった。

暫定分類:

`unverifiable upstream / high-similarity test with anomalous license metadata`

推奨対応:

- 取得不能を理由に「問題なし」とはしない。
- JSON license 表示かつ 83% 一致のため、`useDeleteSetup.test.ts` を外部ファイルを参照せず
  独立したテスト構造へ書き換え、再スキャンで一致が消えることを確認する候補とする。

`bastion` は tag `v0.2.2`（commit
`4182872e14d176091ac0a4a9a1ef22c22e0c5900`）を partial clone + sparse checkout で取得。
Git metadata は 0.13 MB、対象ファイル checkout 後は 0.34 MB。Norton scan は問題なし。
`ui/src/stores/jobs.spec.ts` の MD5 は
`89ec20271ed5dc568f06838064b57727` で SCANOSS の `file_hash` と一致した。

目視結果:

- 外部側は 257 行の Pinia job store テスト、Tacpendium 側は 55 行の汎用 `fetchJSON`
  テスト。
- 共通するのは `fetch` mock、JSON `Response`、HTTP method / header の検査という一般的な
  API client test の構造。
- 外部側固有の jobs、Pinia、auth / CSRF、retention と、Tacpendium 側の個別 API client
  契約は異なる。
- 空白無視のファイル差分は 42 insertions / 244 deletions。

暫定分類:

`false positive / common fetch-mock and API-client test structure`

対応:

TORQUE-1.1 または Apache-2.0 の帰属追加・ライセンス変更・書き換えは不要。

#### 残る permissive-license 高率一致の分類

個別確認済みファイルを除く 50% 以上の候補は 13 件。このうち 8 件は Tacpendium 側の
初出が SCANOSS の一致先 release date より前であり、少なくとも表示された一致先を取得元
とは扱えない。

Tacpendium-first の 8 件:

- `useTrashCombos.test.ts`
- `useUpdateSetup.test.ts`
- `useCharacterSetups.test.ts`
- `PermanentDeleteConfirm.tsx`
- `useCreateSetup.test.ts`
- `useSetup.test.ts`
- `permanent_delete_handler_test.go`
- `useConfig.test.ts`

残る matched-project-first の 5 件をローカル実装・導入コミットと照合した。

| Tacpendium file | SCANOSS match | 判定根拠 |
|---|---|---|
| `useSetupCandidates.test.ts` | `verifywise` / ISC / 94% | M4-03 の setup candidate 機能と同時導入。combo ID の有効・無効値と React Query enabled 契約を検査するプロジェクト固有テスト。外部側は task entity links。共通部は React Query hook test の定型 |
| `web/src/lib/i18n.ts` | `spotify-nowplaying` / MIT / 77% | M1-01 project skeleton で ja/en resource と i18next を初期化。15 行の一般的な i18next bootstrap |
| `safe-url.test.ts` | `thuki` / Apache-2.0 / 68% | M17-01 の media URL/XSS 要件と同時導入。危険 scheme、相対 path、偽装 prefix 等の Tacpendium 固有受入条件。外部側は export serializer test |
| `useDataMigrationNotice.ts` | `aachat-releases` / MIT / 62% | M28-01 の backend notice API と同時導入。`/api/notices/data-migration`、204、acknowledged、TanStack Query の undefined no-op 対策を含む。外部側は projects query |
| `PresetDeleteConfirmDialog.tsx` | `homepage` / MIT / 50% | M20-04 preset 画面と同時導入。既定 preset の削除禁止、alias 削除、固有 test id を含む。外部側は admin page。共通部は確認 dialog の定型 |

暫定分類:

`false positives / framework boilerplate or project-specific implementations sharing common patterns`

対応:

- 上記 13 件について一致先の帰属追加・ライセンス変更・書き換えは不要。
- 日付だけでなく、機能と同時に追加された履歴、プロジェクト固有の契約、検出先との
  ドメイン差を根拠とする。

#### 50% 未満の snippet 34 件

全 81 件の `scan-matches.csv` を再集計し、50% 未満は 34 件と確認した。そのうち
ライセンス空欄、copyleft、または特殊表示を含むものは 11 件。

- 48% `MyComboStatusSelect.test.tsx` — agaric GPL: shadcn select と UI test の定型
- 43% `PutConfirmDialog.test.tsx` — agaric GPL: destructive confirmation test の定型
- 42% `useUpdateConfig.ts` — pillar / license blank: React Query mutation hook の冒頭が一致。
  Tacpendium 側は config API、query key、session character clear という固有契約を持つ
- 38% `TagDeleteConfirmDialog.tsx` — zako3 AGPL: shadcn AlertDialog の定型
- 37% `useSetupLinks.test.ts` — AutoRouter AGPL: hook test の定型
- 33% `CharacterInfoBar.tsx` — proxycast / license blank: avatar initial と summary card の短い UI 定型
- 28% `internal/api/middleware/logger.go` — don MIT/GPL: HTTP logger middleware の定型。
  Echo、slog、request ID、属性集合は Tacpendium 固有契約
- 27% `QRCodeModal.tsx` — web Vim/Zed/AGPL: portal modal の escape / overlay 定型。
  QR、i18n、modal presence 契約は Tacpendium 固有
- 23% `useCompareCombos.test.tsx` — daimon-frontend / license blank: hook test の定型
- 23% `PresetCopyDialog.tsx` — maps-by-any-means / license blank: 長大な外部ファイル内の短い dialog 断片
- 21% `internal/service/auth/password.go` — bbsoric / license blank: PBKDF2 verifier の機能的定型。
  Go standard `crypto/pbkdf2`、反復上限、保存形式、エラー契約は Tacpendium 固有

残る 23 件は MIT / Apache / BSD 等の permissive 表示で 4--47%。いずれも import、
UI component、HTTP handler、hook/test、locale、tray といった短い定型断片であり、追加の
固有出所を示すものはない。

暫定分類:

`low-confidence snippets / common framework, test, UI, HTTP, or cryptographic patterns`

対応:

- 34 件とも個別の一致先帰属、ライセンス変更、書き換えは不要。
- 完全一致、高率一致、特殊ライセンス、取得不能候補を別途優先確認したリスクベースの
  トリアージ結果として閉じる。

## 7. 暫定結論

全 81 match のトリアージは完了した。

| 区分 | 結論 |
|---|---|
| file match 19 件 + shadcn 高率 snippet 3 件 | 既知の shadcn/ui vendored source。公式 MIT 帰属を追加する |
| 個別外部ファイルまで照合した重点候補 | agaric、maibot、vrooli、go-copilot、sgte-app、bastion は偽陽性 |
| 実質同一の短い utility | `useIsMobile.ts`、`useSessionStorage.ts` は独立実装へ書き換える候補 |
| 外部版を再取得不能 | `useRecentCombos.test.ts`、`useUpdateSetup.ts`、`useDeleteSetup.test.ts` は独立構造へ書き換える候補 |
| その他の高率一致 | chronology、導入コミット、プロジェクト固有契約から偽陽性 |
| 50% 未満 34 件 | 低 confidence の定型断片として追加対応不要 |

公開前の残対応は次の 3 系統。

1. shadcn/ui の MIT 帰属表示を正式文書へ追加する。
2. 上記 5 ファイルを、検出先を参照せず独立した構造へ書き換える。
3. 変更後の公開対象 commit を固定し直し、同一 scope で WFP / SCANOSS を再実行する。

### 7.1 非公開開発履歴と公開日時の見え方

Tacpendium の公開リポジトリは、非公開の開発リポジトリ `combomgr` の履歴をそのまま
公開するのではなく、リリースごとの snapshot として生成する。このため、`combomgr` 内では
Tacpendium 側の実装が先に存在していても、公開リポジトリだけを見た第三者には、先に公開
されていた類似コードを Tacpendium が後から取り込んだように見える場合がある。

本調査では、この見かけ上の時系列と実際の開発時系列を混同しない。`Tacpendium-first` と
判定した一致については、非公開開発リポジトリの次の証跡を保持する。

- 対象ファイルの初出 commit SHA と author date
- 当該 commit の変更統計および milestone 名
- 同時に追加された設計・指示・レビュー・進捗記録
- 初回 SCANOSS の chronology CSV と固定した検査対象 SHA

これらを公開リポジトリへ常時掲載したり、非公開履歴全体を開示したりはしない。ただし、
コードの来歴について具体的な問い合わせを受けた場合は、必要なファイル・期間・一致箇所に
限定し、`git log` / `git show` の出力、該当文書、SHA、日時等の証拠を提示できる状態を
維持する。提示方法と範囲は、問い合わせ内容および非公開情報への影響を確認して個別に決める。

この方針は「日付が先なら自動的に独自実装と証明できる」という意味ではない。日付、機能と
同時に入った履歴、プロジェクト固有契約、実コード差分を組み合わせて説明するための監査証跡
保全方針である。

### 7.2 是正と再スキャンの実施順

是正は既存 milestone への無記録な差し込みではなく、設計担当が新しい milestone を起票して
製造へ渡す。番号と分割は設計担当が決めるが、完了条件には次を含める。

1. **設計・起票**
   - shadcn/ui の MIT 帰属の配置先、文言、対象範囲を確定する。
   - 5 ファイルの現行挙動、外部契約、保持すべきテスト意図を列挙する。
   - 一致先コードを実装資料として再利用せず、現行要件から独立実装するよう明記する。
2. **製造**
   - `NOTICE` 等へ shadcn/ui の帰属を追加する。
   - `useIsMobile.ts`、`useSessionStorage.ts`、`useRecentCombos.test.ts`、
     `useUpdateSetup.ts`、`useDeleteSetup.test.ts` を独立した構造へ変更する。
   - 対象単体テスト、frontend test、build 等、milestone が定めた gate を通す。
3. **取り込みと対象 SHA の固定**
   - 是正 milestone のレビューと取り込みを完了する。
   - 公開候補の merge commit SHA を固定する。再スキャン中に branch head が進んでも対象を
     変更しない。
4. **Codex による再スキャン**
   - 本セッションの続き、または別の Codex セッションが担当する。
   - 初回と同じ `cmd`、`internal`、`web/src` を `git archive` で抽出する。
   - 使用した Python、SCANOSS CLI、server / KB 版を記録する。CLI 版が変わった場合は
     初回との差として明記する。
   - WFP を新規生成し、固定 SHA に対して SCANOSS を実行する。初回 WFP や結果 JSON を
     上書きしない。
5. **差分判定**
   - 上記 5 ファイルの問題となった一致が消えたことを確認する。
   - shadcn/ui の一致は、MIT 帰属済みの既知 vendored source として確認する。
   - 新規の file / snippet match が増えていないか、初回 81 件と比較する。
   - 残存 match は本報告と同じ基準で disposition を記録する。
6. **完了記録**
   - final match CSV と initial / final の差分表を
     `docs/progress/evidence/m26-04-scanoss/` へ追加する。
   - 本報告を最終結果へ更新し、`docs/progress/progress-log.md` から索引する。
   - `docs/human-notes/combmgr-prerelease-checklist.md` の A9 と
     `docs/process/public-release-runbook.md` の A-1 を、実測結果に基づいて完了へ更新する。

再スキャンの完了条件は、単なる終了コード 0 ではない。対象 SHA と scope が固定され、5 件の
是正結果、shadcn/ui の帰属、新規 match の有無、残存 match の判断が記録されて初めて A9 / A-1
を完了とする。

## 8. 注意事項

- 本文書は暫定調査記録であり、法的助言ではない。
- SCANOSS の一致先は実際の取得元とは限らない。
- 一致先リポジトリのライセンスは、Tacpendium の一致コードへ自動的に適用されない。
- 日付の前後だけではコピーの有無を証明できない。
- 外部比較用 clone と SCANOSS の JSON / CSV / WFP は最終判断が終わるまで削除しない。

## 9. 公開候補の再スキャン結果（2026-09-21）

### 9.1 固定対象と検証

- 公開候補 commit: `51915cf93349deaa1b4a63122fd64c89b2b6d2da`
- scope: `cmd/`、`internal/`、`web/src/`
- source file: 1,078 件
- WFP / SCANOSS result file: 1,040 件
- 持込 ZIP SHA-256: `8f8facfdbc0f44f18550ae9634f853cd4e8ff2381aafa9981c1da856789f09a6`
- source archive SHA-256: `f407f55f08a6696d971335e04d4738e573764bda42cc63b842fa90f0a812a16a`
- WFP SHA-256: `d5b2810dad5897df9d9fcc0f82e30c63ee213d70148f3f7431b1a6081d615efa`
- result JSON SHA-256: `30b3191c43626831720651f333cadc9c5e0b1ee9e6db03cec4728a688070a352`
- Python: `3.13.15`
- SCANOSS CLI: `1.54.2`（初回と同じ）
- SCANOSS server: `5.4.25`（初回と同じ）
- KB: daily `26.09.21` / monthly `26.08`（daily のみ初回 `26.09.20` から更新）

Windows ローカルで固定 SHA から抽出した全 path / Git blob SHA-1 と、devContainer 側の同一
commit の Git tree を完全照合した。持込 ZIP の全成果物について SHA-256 とサイズを照合し、
source manifest、WFP、SCANOSS JSON、match CSV、metadata の件数、および整形前後 JSON の
同値性も確認した。

### 9.2 件数と初回との差分

| 区分 | 初回 | 最終 | 差 |
|---|---:|---:|---:|
| `none` | 959 | 960 | +1 |
| `snippet` | 62 | 61 | -1 |
| `file` | 19 | 19 | 0 |
| match 合計 | 81 | 80 | -1 |

match 単位の差分は **added 1 / removed 2 / unchanged 79**。

### 9.3 M40-02 の 5 ファイル

M40-02 は 5 件すべてを書き換える工程ではなく、開発者確定により `(i) 2 件 / (iii) 3 件`
となった。したがって §7.2 段 5 の「5 件すべてが消える」は失効しており、次の実測を最終判定とする。

| ファイル | M40-02 | 再スキャン | 判定 |
|---|---|---|---|
| `web/src/hooks/useSessionStorage.ts` | 専用 helper 経由へ独立実装 | 旧 80% 一致が `removed` | **解消** |
| `web/src/hooks/useRecentCombos.test.ts` | assertion を独立構造で厳密化 | 旧 95% 一致が `removed` | **解消** |
| `web/src/hooks/useIsMobile.ts` | 制約収束のため据え置き | 70% が `unchanged` | M40-02 §5.1 の収束説明を維持 |
| `web/src/features/setup/hooks/useUpdateSetup.ts` | TanStack Query の定型へ収束するため据え置き | 60% が `unchanged` | M40-02 §5.1 の収束説明を維持 |
| `web/src/features/setup/hooks/useDeleteSetup.test.ts` | 兄弟 test の統一様式を維持 | 83% が `unchanged` | M40-02 §5.1 の収束説明を維持 |

### 9.4 shadcn/ui

初回の file match 19 件と高率 snippet 3 件は継続している。取得元の判定は §3 から変わらない。
M40-01 により `NOTICE` §6 へ `Copyright (c) 2023 shadcn` と MIT 条項全文を置き、
`REUSE.toml` で `web/src/components/ui/**` 21 件と `web/src/lib/utils.ts` を MIT として宣言済みである。
SCANOSS が示す派生リポジトリのライセンスを本体へ適用しない。

### 9.5 新規一致 1 件

- local: `web/src/hooks/useRecentCombos.test.ts`
- match: `github.com/omnigent-ai/omnigent` / `ap-web/src/hooks/useComments.test.ts`
- snippet: 42%（local lines `3-25,73-90`）
- 表示ライセンス: Apache-2.0
- 優先度: **低**
- disposition: `false positive / common React Query hook-test structure`

一致範囲は React Query の `QueryClientProvider`、Vitest の fetch mock、`renderHook` / `waitFor`
という一般的な hook test の骨格である。同じ骨格は本リポジトリ内の多数の test にも存在する。
Tacpendium 固有の `/api/combos`、`sort=updated_at`、`order=desc`、`limit=3`、コンボ内容、
HTTP error 時の再試行回数という主張は別ドメインであり、外部由来を示すものではない。
追加の帰属、ライセンス変更、再書き換えは不要と判定する。

### 9.6 保存した evidence と公開ゲート

- `scan-matches-final-51915cf93349.csv`
- `scan-match-delta-final-51915cf93349.csv`

初回 evidence は上書きしていない。source、WFP、生 JSON、外部 clone、持込 ZIP は Git へ追加しない。

SCANOSS 再スキャンと全 match の disposition は完了した。ただし現行
`docs/process/public-release-runbook.md` §2.A.1 は「新規 match が増えていないこと」を完了条件に
しており、今回は低優先度の偽陽性と判定した新規 1 件がある。この文言と実測が一致しないため、
`A9` / `A-1` のチェック状態は本追補では変更しない。
