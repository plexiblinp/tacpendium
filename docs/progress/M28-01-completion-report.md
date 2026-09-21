# M28-01 完了報告: 正式名リネーム（`combomgr` → `Tacpendium`）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M28-01-official-name-rename.md` **v1.0.1** |
| チェックリスト | `docs/instructions/reviews/M28-01-review-checklist.md` v1.0.0 |
| 実施日 | 2026-09-05 |
| 着手基点 | `fae8118e6d840e1174acc7be782463fadd8b483a` |
| ブランチ | `claude/m28-01-implementation-plan-wmkyq0` |
| CHANGE 消費 | **0 本**（★`docs/design/` に 37 箇所残る。**自採番せず設計卓へ請求する**＝§5） |
| マイグレ消費 | **0 本**（スキーマに触っていない） |

---

## 0. 変更統計（`git diff --stat <着手基点>`）

```
290 files changed, 3395 insertions(+), 936 deletions(-)
```

### 新規追加ファイル（**★`+` のみであること**＝教訓 `E-225`）

```
 internal/api/notice/handler.go                      |  78 +++
 internal/api/notice/handler_test.go                 | 102 +++
 internal/api/notice/routes.go                       |  12 +
 internal/infra/datadir/copy.go                      | 171 +++
 internal/infra/datadir/decide.go                    | 106 +++
 internal/infra/datadir/doc.go                       |  17 +
 internal/infra/datadir/lock.go                      |  82 +++
 internal/infra/datadir/migrate.go                   | 449 +++
 internal/infra/datadir/migrate_test.go              | 683 +++
 internal/infra/datadir/notice.go                    | 114 +++
 internal/infra/datadir/urlpath.go                   |  11 +
 internal/infra/datadir/verify.go                    | 186 +++
 web/src/features/data-migration/DataMigrationBanner.tsx |  58 ++
 web/src/features/data-migration/types.ts            |  12 +
 web/src/features/data-migration/useDataMigrationNotice.ts |  30 +
 15 files changed, 2111 insertions(+)
```

**新規 15 本すべてが `+` のみで `deletions` は 0**。作成前に `ls` / `find` で同名の不在を確認した
（`internal/infra/datadir/` と `internal/api/notice/` と `web/src/features/data-migration/` は
いずれも新設。既存ディレクトリ一覧で不在を実測してから作成）。

`cmd/combomgr/` → `cmd/tacpendium/` の 3 ファイルは Git が rename として認識している
（`R  cmd/combomgr/main.go -> cmd/tacpendium/main.go` 等）。

---

## 1. §2.1 母数（§3-1 の規約: **置換前と置換後の両方・区分ごと**）

### 1.1 ★★綴りの数え落としと、その是正

**初回に提出した内訳は誤っていた。** 区分表は正規表現 `comb[o]?[-_ ]?mgr` で数え、綴り内訳は
綴りを 1 つずつ数えていたが、**両者が別の集合を数えていた**。

| | 正規表現側 | 綴り内訳側（初回） |
|---|---|---|
| `combmgr`（**`o` が無い**綴り） | **拾う（329 件）** | **★列挙していなかった** |
| `Combo Manager` | 拾わない（`mgr` ではない） | 拾う（11 件） |

`2523 − 11 + 329 = 2841` で正規表現側の総計と一致する。**⇒ 区分表が超過していたのではなく、綴り内訳が 329 件不足し 11 件過剰だった**。

**これは指示書 §2.1-3「★1 つの綴りだけを数えない」に、初回で正面から失敗したものである。**
設計卓の指摘（母数レビュー）で発覚した。以後の数えは**全綴りを 1 本のパターンで拾い、パスで排他的に振り分け、未分類が出たら表に出る**形へ改めた。

### 1.2 綴り別（全綴り・出現単位・着手前）

| 綴り | 件数 |
|---|---:|
| `combomgr` | 2168 |
| `combmgr`（小文字。**是正で計上**） | 328 |
| `CombMgr` | 173 |
| `COMBOMGR` | 165 |
| `Combo Manager` | 11 |
| `ComboMgr` | 3 |
| `combo-mgr` | 3 |
| `COMBMGR`（**是正で計上**） | 1 |
| `Combomgr` / `comboMgr` / `combo_mgr` / `Combmgr` / `combo manager` | 各 0 |
| **合計** | **2852** |

### 1.3 区分別 前後比較（**排他分割・未分類 0**）

パターン `comb[o]?[-_ ]?mgr|combo manager`（大小無視・出現単位）。

| 区分 | 着手前 | 現在 | 差 | 扱い |
|---|---:|---:|---:|---|
| 歴史記録 | 1150 (229 file) | **1150 (229 file)** | **0** | ★書き換えない |
| 実装（Go・`go.mod`） | 821 (238) | 41 (13) | −780 | 書き換えた |
| `docs/human-notes` | 388 (66) | **388 (66)** | **0** | ★触らない（開発者承認済み） |
| 指示書（現役） | 124 (34) | **124 (34)** | **0** | ★完了済みサブの記録（§4.2） |
| 現役ドキュメント | 90 (13) | 46 (10) | −44 | 書き換えた |
| エージェント設定（`.claude` / `.agents` / `human-notes/codex`） | 65 (21) | **65 (21)** | **0** | ★製造は編集しない |
| その他 docs | 55 (13) | 54 (12) | −1 | `code-facts.md` の再生成分のみ |
| 実装（web） | 46 (25) | 11 (9) | −35 | 書き換えた |
| `docs/design` | 37 (2) | **37 (2)** | **0** | ★製造は触らない（§5 に一覧） |
| ビルド・CI | 27 (2) | **0** | −27 | 書き換えた |
| 設定 | 26 (5) | 7 (4) | −19 | 書き換えた |
| スクリプト | 23 (7) | 4 (2) | −19 | ★1 本ずつ判断（§3） |
| **★未分類** | **0** | **0** | — | 分割の網羅性の証拠 |
| **合計** | **2852** | **1927** | **−925** | |

再実測は `bash scripts/…`（本報告に添えた census スクリプト、下記 §9）で誰でも再現できる。

### 1.4 ★「数えて 0 だった」区分（**数えていないのではない**）

| 対象 | 実測 |
|---|---:|
| `migrations/` | **0 件**（全ファイル走査。SQL のヘッダコメントにも製品名は無い） |
| `docs/handover/session-prompts/` | **0 件** |
| `web/e2e/.tmp/` | 0 件（git 管理外） |

`character_data/` は **0 ではなく 14 件**で、**うち 12 件が `combomgr-importer`**（別リポジトリ）。

### 1.4.1 ★現役ドキュメントに残した 46 件の内訳（レビュー指摘 中-7）

「46 件残っている」だけでは、**未着手なのか意図して残したのかが読めない**。仕分けを示す。

| 区分 | 件数 | 内訳 |
|---|---:|---|
| **他プロジェクト参照**（置換すると出典が偽になる） | **26** | `character_data/command-correction-history.md` 11 ／ `docs/seed-data/official-data-edge-cases.md` 8 ／ `character_data/seed-progress.md` 3 ／ `docs/seed-data/check-criteria.md` 3 ／ `docs/seed-data/moves-input-background.md` 1。すべて `combomgr-importer` |
| **「(SF6 Combo Manager)」の説明** | **4** | `README.md:1` ／ `README.txt:2` ／ `CLAUDE.md:1` ／ `AGENTS.md:1`。**旧名ではなく「何をするアプリか」の説明**（`ja.json` の「SF6 コンボマネージャー」と対になっている） |
| **開発リポジトリのパス接頭辞** | **13** | `docs/seed-data/check-criteria.md` の `combomgr/character_data/` 等。**チェックアウト先のディレクトリ名**を指しており、開発リポジトリ名は `combomgr` のまま存続する（§4.1） |
| **当時の記録** | **2** | `docs/seed-data/check-criteria.md:6` の作成者欄「combmgr 本体 設計担当 Claude（M14-03b/M17 期）」／ 同 `:8` |
| **意図して据え置いた識別子** | **1** | `AGENTS.md:11` の `combomgr-manufacturing-workflow`（§8 開発者手番 3） |
| **合計** | **46** | **★未着手は 0 件** |

### 1.5 ★★他プロジェクト参照は置換対象外（**206 出現**）

`combomgr-importer`（FR701 公式データ取込の別リポジトリ）と `autopilot-combomgr`（別サブプロジェクト）は
**本アプリの名前ではない**。`.gitignore` の「# 他プロジェクト」節、`web/src/features/combo-io/export-image/`
の出典コメント 3 本、`character_data/*.md` 12 箇所、`docs/seed-data/` の大半、
`docs/process/remote-ops*.md`、`.claude/settings.json:12` がこれに当たる。
**一括置換すれば出典が偽になる。⇒ 全件を対象外にした。**

---

## 2. §3-2 書き換えなかった範囲（**歴史記録の非改変を数えて示す**）

`git diff --stat <着手基点> -- <対象>` が **1 行も出ない**ことを実測した。

| 対象 | ファイル数 | 残存出現数 | 差分 |
|---|---:|---:|---|
| `docs/progress/`（既存の完了報告・レビュー報告） | 119 | 756 | **0** |
| `docs/instructions/phase1/` | 26 | 123 | **0** |
| `docs/handover/design-reports/` | 21 | 64 | **0** |
| `docs/instructions/phase3/` | 20 | 56 | **0** |
| `docs/change-notes/` | 14 | 28 | **0** |
| `docs/process/parallel-board.md`（裁定本文） | 1 | 26 | **0** |
| `docs/human-notes/future-notes/archive/` | 6 | 26 | **0** |
| `docs/handover/phase1/` | 3 | 18 | **0** |
| `docs/handover/phase3/` | 7 | 16 | **0** |
| `docs/instructions/phase2/` | 4 | 13 | **0** |
| `docs/human-notes/archive/` | 3 | 12 | **0** |
| `docs/handover/archive/` | 2 | 4 | **0** |
| `docs/handover/retrospective-log.md` | 1 | 4 | **0** |
| `docs/process/archive/` | 1 | 3 | **0** |
| `docs/handover/phase2/` | 1 | 1 | **0** |
| `docs/handover/session-prompts/` | 0 | 0 | **0** |
| **歴史記録 計** | **229** | **1150** | **0** |
| `docs/design/` | 2 | 37 | **0**（§5 に一覧） |
| `docs/human-notes/`（archive を除く） | **66** | **388** | — ★追補 2 で書き換えた（下記） |
| `docs/process/`（ボード・archive を除く） | **5** | **21** | **0** |
| `.claude/` / `.agents/` / `human-notes/codex/` | 21 | 65 | **0** |
| `docs/handover/followup-backlog.md`（`D-382`） | 1 | 23 | **0** |
| `migrations/` / `character_data/` | — | 0 / 14 | **0** |

**★初版の本表は各行の合計が 1061 / 207 で、同じ報告内の合計 1150 / 229 と合っていなかった**
（レビュー指摘 中-6）。**歴史記録として扱いながら表に載せていなかった行が 6 つあり**
（`docs/handover/phase1|2|3/` ／ `docs/human-notes/archive/` と `future-notes/archive/` ／
`docs/process/archive/` ／ `retrospective-log.md`）、**ボードの行も 26 を 17 と書いていた**。
上表は全行を再実測して合計と一致させたもので、`bash <census>` で再現できる。
**★0 差分という結論は動かない**（レビュー側も独立に確認している）。

**★★【2026-09-05 追補 2】本表にさらに 2 件の誤りがあった。**
`docs/human-notes/`（archive 除く）を **57 ファイル / 350 出現**、
`docs/process/`（ボード・archive 除く）を **10 ファイル / 25 出現**と書いていたが、
実測は **66 / 388** と **5 / 21** である。**中-6 の是正で「全行を再実測した」と書いたのに、実際には歴史記録の内訳だけを数え直し、その下の行は元の値を引き写していた。**
⇒ 上表は実測値へ差し替えた。**同じ種類の誤りを、是正の手番で作り込んでいた。**

**★`docs/instructions/` 直下（現役ディレクトリ）の 124 件も 0 差分である。** 該当は
`M20-04` / `M21-07` / `M24-09c` 等**完了済みサブの指示書とレビューチェックリスト**であり、
当時の作業を記述した記録である。指示書 §0.2 が挙げる `phase1/`〜`phase3/` と同種と判断した。
**★これは製造の判断であり、設計卓が別扱いを望むなら差し戻せる。**

---

## 3. §2.4 検査スクリプトの扱い（**★1 本ずつ判断した根拠**）

### 3.1 `check-*.sh` のうち `combomgr` を含むもの

**全 11 本を実測し、含んでいたのは 1 本だけだった。**

| 検査 | 含むか | 箇所の性格 | 判断 |
|---|---|---|---|
| `check-browser-storage-keys.sh` | **含む**（L28 / L84） | **説明文**。「規約外のキー名の例」として `combomgr.foo.v1` を挙げている。ベースライン値でも禁止語リストでもない | **★置換しない。** 当時の実例であり、書き換えると例が例でなくなる |
| `check-artifact-integrity` / `check-stop-discipline` / `check-progress-log-index` / `check-instruction-format` / `check-doc-refs` / `check-enum-sync` / `check-import-order` / `check-md-emphasis` / `check-derived-docs` / `check-doc-inventory` | **含まない**（実測） | — | 対象外 |

**`scripts/collect-doc-refs.sh`（`check-*` ではないが同種）の 2 件も据え置いた**——
`combmgr-release-checklist.html` という `docs/human-notes/` の**実ファイル名**の例であり、
当該ファイルを改名していないため。

### 3.2 followup `bulk-rename-must-exclude-check-scripts` の逐語との照合

逐語は「`check-*.sh` の**禁止語リスト**内の語まで書き換わり、自リポジトリ名が禁止語になる」。
**本リポジトリでは起こらない**ことを実測で確かめた——`check-instruction-format.sh` の
`FORBIDDEN` 配列は日本語の曖昧語 9 語（`あれば` / `必要に応じて` / …）のみで製品名を含まない。
ベースライン固定型 5 本の値は**すべて数値**であり文字列を含まない
（`check-md-emphasis`=436 行 / `check-import-order`=101 ファイル /
`check-instruction-format`=78 件・14 件 / `check-enum-sync`=28 件）。

**⇒ それでも一括置換はしていない。** 上表のとおり 1 本ずつ中身を読んで判断した。

### 3.3 §3-4 ベースラインが動いたか

**★2 本が動いているが、いずれも M28-01 が動かしたものではない。⇒ ベースラインは更新しない。**

| 検査 | 着手前の基準 | 現在 | 判定 |
|---|---|---|---|
| `check-md-emphasis` | 436 行 | **431 行（−5）** | **★本サブ由来ではない。** 本サブで変更した `.md` 8 本すべてについて、着手前（`git show fae8118:<file>`）と現在を同スクリプトへ個別に食わせて比較した結果、**全 8 本が同数**（`README.md` 5→5 ／ `resource-exhaustion-audit-runbook.md` 4→4 ／ 他 6 本 0→0）。検出 148 ファイルのうち本サブで変更したものは **0 件**。⇒ 着手前からのドリフト |
| `check-import-order` | 101 ファイル | **102 ファイル（NG）** | **★着手前から NG。** 違反 102 ファイルの全件を確かめた。**★初版は「1 件も本サブで変更されていない」と書いたが誤り**（レビュー指摘 低-4）——実際は `useConfig.test.ts` / `useUpdateConfig.test.ts` / `MyComboPage.test.tsx` / `ComparePage.test.tsx` / `SettingsPage.test.tsx` の **5 本を変更している**。**ただし変更はいずれも文字列の期待値のみで import 行は 1 行も動いていない**ため、結論（本サブ由来ではない）は変わらない。新規追加した 3 本の `.ts`/`.tsx` はいずれも違反リストに出ない |
| `check-instruction-format` | 78 / 14 | 78 / 14 | 不動・緑 |
| `check-enum-sync` | 28 | 28 | 不動・緑（WARN） |
| `check-browser-storage-keys` | 台帳 11 / 実装 10 | 同左 | 不動・緑（§4.3） |

**★「減ったから下げてよい」の指示に従わなかった理由**——`check-md-emphasis` は自ら
「減ったら BASELINE_BROKEN を下げること」と出すが、**減らしたのは本サブではない**。
本サブの成果でない改善を本サブの手番で床にすると、実際に減らした変更の記録が失われる。
**⇒ 開発者・設計卓の手番へ回す。**

### 3.4 §2.4-3 パスの直書き

| 場所 | 扱い |
|---|---|
| `scripts/generate-code-facts.sh:270,274,286` | **★直した。** `cmd/combomgr/main.go` を `2>/dev/null` 付きの `grep` 対象として直書きしており、**ディレクトリ移動でエラーにならず §4 のルート表が空になる**（followup `code-facts-generator-drifts-with-refactor` が予告していた型そのもの）。再生成して **§4 に 71 本のルートが出る**ことを実測 |
| `docs/audits/resource-exhaustion-audit-runbook.md:89` | **★直した。** 監査コマンドの `grep` 対象。直さないと goroutine のベースラインが照合できず**監査が過小報告する**（差分 2 行） |
| `docs/audits/20260804-resource-exhaustion-audit.md`（3 箇所） | **★直した。★日付つきの監査記録である**（差分 3 行）。根拠行として `cmd/combomgr/main.go:109-117` 等を引いており、**パスが消えると根拠を辿れなくなる**ため追随させた。**ただし「その日に観測した事実」の記録でもあり、`E-111` 分類 (2) の性格を持つ。⇒ `docs/audits/<日付>-*.md` を歴史記録として扱うかは設計卓へ確認したい**（レビュー指摘 中-8） |
| `scripts/design-desk-arm.sh` | `combomgr` を**含まない**（実測）。手当て不要 |
| `.claude/hooks/*.sh` | **6 本すべて 0 件**（実測）。手当て不要 |
| `.devcontainer/Dockerfile:192` | **★直した**（§4.4） |

---

## 4. 実施内容

### 4.1 Go module path とディレクトリ（最大の差分）

- `go.mod` の `module github.com/plexiblinp/combomgr` → `github.com/plexiblinp/tacpendium`
- `cmd/combomgr/` → `cmd/tacpendium/`（`mv`。Git は rename として記録）
- ルート embed ホルダ 3 本の `package combomgr` → `package tacpendium`、
  参照側の `combomgr.MigrationsFS` / `WebFS` / `WebEmbedded` と import エイリアスを追随
- `_test.go` を含む全 import 684 箇所。`//go:embed` は相対パスなので不変

**★リポジトリ名は変えていない。** 開発者の方針（2026-09-05 確認）＝
**開発リポジトリ `plexiblinp/combomgr` はプライベートで存続し、公開用 `plexiblinp/tacpendium` を新設して一方向同期**。module path はローカルモジュールとして解決されるためビルドに影響せず、
公開側リポジトリ名と一致する形になっている。

### 4.2 識別子・定数

| 現在 | 変更後 | 場所 |
|---|---|---|
| `COMBOMGR_{LOG_LEVEL,DB_PATH,PORT,CONFIG_PATH}` | `TACPENDIUM_*` | `internal/config/config.go` の 4 定数。Go 側の参照はすべてこの定数経由（実査）。`web/playwright.config.ts` / `scripts/dev-throwaway-db.sh` / CI / Makefile / README のコメントも同時 |
| `combomgr_session` | `tacpendium_session` | `internal/api/auth/cookie.go` ＋ `web/e2e/m22-01-auth-gate.spec.ts:115` |
| `combomgr_user_id` | `tacpendium_user_id` | `internal/api/middleware/user.go` |
| `logs/combomgr.log` | `logs/tacpendium.log` | `internal/config/config.go` ＋ `config.toml.example` ＋ web の fixture |
| `combomgr-export.zip` | `tacpendium-export.zip` | `internal/api/comboio/handler.go:62` |
| `APP_NAME = "CombMgr"` | `"Tacpendium"` | `web/src/lib/constants.ts` |
| `__combomgrNavigationGuardSentinel` | `__tacpendium…` | `NavigationGuardProvider.tsx` |
| `.tmp/combomgr-e2e.{db,toml}` | `tacpendium-e2e.*` | Makefile / CI / playwright.config.ts / Go テスト の 5 か所 |

**★既存セッションは 1 度切れる**（Cookie 名が変わるため）。データは失われない。

### §2.2-2 ★定数化されていない直書き（**報告のみ。本サブでは定数化しない**）

| 箇所 | 内容 |
|---|---|
| `internal/api/comboio/handler.go:62` | export の `Content-Disposition` に `tacpendium-export.zip` を**直書き**。`internal/model/` 等の定数になっていない |
| `web/index.html:6` ／ `web/src/components/Header.tsx:68` ／ `web/src/locales/{ja,en}.json` の 3 系統 | **`web/src/lib/constants.ts` に `APP_NAME` があるのに表示名が直書きで散っている**。i18n の `app.title` はロケールに置くのが妥当だが、`Header.tsx` の直書きは `APP_NAME` を使うべきに見える |
| 各ページテスト 4 本 | 表示名の期待値を直書き |

**★勝手に定数化していない**（チェックリスト §1-7 の「製造が勝手に定数化していたら射程外として指摘する」）。

### 4.3 ★★既定データディレクトリの移行（指示書 §2.3・規則 6 件）

新パッケージ **`internal/infra/datadir`**。順序は
**判定 → ロック → WAL 畳み込みと計数 → 複製 → 検証 → 移行先の確定**（ここまで `Migrate`）、
そのあと呼出側が **config.toml の書き換え → 旧の退避（`RetireOld`）**。

| 規則 | 実装 |
|---|---|
| **1** 旧を消さない。コピーしてから `<旧名>.migrated-<日付>` へリネームして残す | `RetireOld`。**退避先が衝突したら別名にする**（`-HHMMSS`、さらに `-2`…）。★既存の退避先を上書きしない |
| **2** コピー → 検証 → 退避。検証＝新の DB が開ける ＋ 主要テーブルの行数が一致。**一致しなければ何も動かさずに止まる** | 検証は**作業ディレクトリの中**で行い、通ってから移行先の名前を確定する。失敗時は作業ディレクトリを消すだけで、**旧は 1 バイトも動いていない**。検証内容は**テーブル名の集合 ＋ 各行数 ＋ `user_version` ＋ `integrity_check`** |
| **3** WAL / SHM を取り残さない。DB を開いたまま copy しない | `PRAGMA wal_checkpoint(TRUNCATE)` の**戻り値 3 列を読み**、`busy != 0` や `log != checkpointed` なら中止。DB 本体は**バイトコピーではなく `VACUUM INTO`**。移行元・移行先の双方で `-wal` / `-shm` の不在を確かめる |
| **4** `config.toml` も移す。中の絶対パスが旧を指していたら書き換える | **★解釈あり（§7-1）**。`config.RewriteRelocatedPaths` |
| **5** 移行したことを起動ログと画面に 1 度だけ出す | 起動ログは `applog.Init` 後に 1 度。画面は `.migration-notice.json` ＋ `GET /api/notices/data-migration` ＋ `DataMigrationBanner` |
| **6** 二重起動・中断に耐える。中断したら旧が正本のまま残る | ロックは**寿命つきファイル**、作業領域は**毎回ユニークな一時ディレクトリ**。放置された作業ディレクトリは掃く |

#### ★設計上、意図的に外した実装（いずれも「静かに壊れる」型）

| 素朴な実装 | なぜ採らなかったか |
|---|---|
| 「`database.path` が空なら移行、空でなければ飛ばす」 | **リネーム前の `config.toml` は旧既定の絶対パスを持ちうる。**空でないことを理由に飛ばすと利用者のデータが永久に旧へ取り残される。⇒ 「解決結果が旧既定と**同じ場所**を指すか」で判定（`UsesLegacyDefault`） |
| 「移行先が**空でなければ** skip」 | `applog.Init` / `migration.Run` / `db.Open` は**いずれも書き込み先の親を `MkdirAll` する**。どれかが移行より先に走ると「ディレクトリはあるが DB は無い」になり、経路 a が黙って経路 b へ化ける。⇒ **新 DB ファイルが在り非空か**だけで判定 |
| `PRAGMA wal_checkpoint(TRUNCATE)` を `Exec` で流す | 同 PRAGMA は `(busy, log, checkpointed)` の**行を返す**。捨てると `busy=1`（畳めなかった）を見逃す。ファイル名が変わるので `-wal` は孤児になり**後から拾い直せない** |
| DB 本体のバイトコピー | 裂ける／`-wal`・`-shm` を連れ回す／壊れた元をそのまま複製する。`VACUUM INTO` は全ページを読み直すので**元が壊れていればその場で落ちる** |
| 作業ディレクトリの排他作成をロック代わりにする | **中断すると永久に残り、以後の起動が毎回はじかれる**。指示書 §2.3-6 が求めるのは「旧が正本のまま残る」であって「起動できない」ではない。⇒ ロックと作業領域を分けた |
| 「コピー → 退避 → config 書き換え」 | 書き換えに失敗すると `config.toml` が**消えた旧**を指したまま残り、次回起動で SQLite が**空の DB を新規作成**する。利用者からはデータが消えたように見える。⇒ **退避は最後** |
| `config.Save(path, runtimeCfg)` | 実行時 `*Config` は env の一時上書きを含む。そのまま書き戻すと `TACPENDIUM_LOG_LEVEL` 等が**焼き付く**（`PersistPort` が避けている既知の穴）。⇒ ディスクから読み直して 2 キーだけ触る |
| ルート付け替えだけの config 書き換え | 移行はファイル名も変える（`combomgr.db` → `tacpendium.db`）。ルートだけ替えると `<新>/combomgr.db` という**存在しないパス**を書き込む。⇒ **移行が実際に作った対応表**で引く |

#### ★あわせて必要になった `internal/config` の変更

`appDataRoots()` に **`db.LegacyDataDir()` を追加**した。**これが無いと起動そのものが落ちる**——
リネーム前の `config.toml` が `.../combomgr/combomgr.db` のような絶対パスを持つ場合、
`validate()` → `ValidateDataPath()` が新ルートしか許さないため `config.Load` がエラーを返し、
**移行が走る前に落ちる**（移行は判定に `cfg.Database.Path` が要るので `config.Load` の後ろにしか置けない）。
経過措置である旨をコード注記に書いた。

#### §3-3 移行の 4 経路のテスト結果（**実ファイル・`t.TempDir()`。モックにしていない**）

| 経路 | テスト | 結果 |
|---|---|---|
| **(a)** 旧のみ | `TestMigrate_A_OldOnly` | **PASS**。全行が新へ／旧が `.migrated-20260905` として**開けることまで**確認／`-wal`・`-shm` なし／作業領域・ロックの残骸なし |
| **(a2)** ★WAL にしかコミットが無い | `TestMigrate_A2_CommitsOnlyInWAL` | **PASS**。`.db` だけ運ぶ実装ならここで 2 行落ちる |
| **(a3)** DB 以外のファイル・入れ子 | 同 (a) 内 | **PASS** |
| **(b)** 新旧の両方 | `TestMigrate_B_BothExist` | **PASS**。両方の sha256 が不変／旧は退避されない／**黙って飛ばさず理由を出す** |
| **(b2)** ★新ディレクトリは在るが DB が無い | `TestMigrate_B2_NewDirExistsButNoDB` | **PASS**。**移行する**（「空でなければ skip」実装を落とすテスト） |
| **(c)** 旧が無い | `TestMigrate_C_NoLegacyDir` / `…LegacyDirWithoutDB` | **PASS**。**移行先を作らない**ことまで確認 |
| **(d1)** ★★検証失敗（行数不一致） | `TestMigrate_D1_RowCountMismatch_MovesNothing` | **PASS**（下記） |
| **(d2)** ★★検証失敗（コピー破損） | `TestMigrate_D2_CorruptCopy_MovesNothing` | **PASS** |
| 二重起動 | `TestMigrate_LockHeldByLiveInstance` | **PASS**。他プロセスのロックを消さない |
| 中断（ロック） | `TestMigrate_StaleLockIsReclaimed` | **PASS**。永久に止まらない |
| 中断（作業領域） | `TestMigrate_StaleStagingIsSwept` | **PASS** |
| 退避の衝突 | `TestRetireOld_DateCollisionKeepsBoth` | **PASS**。**先にあった退避先が失われない** |
| 検証層の単体 | `TestVerify_DetectsRowCountMismatch` / `…MissingTable` / `…IgnoresSqliteInternalTables` / `…UserVersionMismatch` | **PASS** |
| 旧既定パスの固定 | `TestLegacyResolveDBPath_IsTheOldDefault` / `TestDataDirNames_AreDistinct` | **PASS** |

**★★(d) で「何も動かさずに止まる」ことの確認内容**（`assertNothingMoved`）:

```
旧ディレクトリが在り、名前が変わっていない
root 配下に *.migrated-* が 1 つも無い
sha256(旧/combomgr.db) が実行前と完全に一致          ← 1 バイトも変わっていない
旧 DB を開いた combos の行数が実行前と一致            ← 旧が使える状態のまま
移行先ディレクトリが存在しない
作業ディレクトリ tacpendium.migrating-* が残っていない
ロック .migrating.lock が残っていない                ← エラー経路でも解放される
```

#### §7 破壊確認（**実際に壊して、検出できることを見た**）

`verify.go` の行数比較を `if want := oldByName[c.Table]; false && want != c.Rows` へ**意図的に無力化**し、
テストを回した。

```
--- FAIL: TestMigrate_D1_RowCountMismatch_MovesNothing
    Status = "migrated", want failed —— 行数の食い違いを見逃している
--- FAIL: TestVerify_DetectsRowCountMismatch
    err = <nil>, want *MismatchError
FAIL
```

**⇒ (d) 経路のテストは実際に効いている**。復元後 green を確認した。

### 4.4 ビルド・CI・設定・devContainer

- `Makefile` / `.github/workflows/nightly-crossbuild.yml` / `.gitignore`（**「# 他プロジェクト」節は据え置き**）/
  `config.toml.example` / `web/package.json` / `web/playwright.config.ts`
- **devContainer（★要注意）**
  - volume の **`target` のみ** `/home/node/.local/share/tacpendium` へ。
    **★`source=sf6-combomgr-data-${devcontainerId}` は変えていない。**
    source を変えると空 volume になり、**既存の dev DB が見えなくなる**
  - `Dockerfile` の `mkdir` / `chown` パス、表示名（`devcontainer.json` / `Dockerfile` / `init-firewall.sh`）
  - **★`cmds` エイリアスの `/workspaces/combomgr` 直書きをやめた。**
    チェックアウト先のディレクトリ名はリポジトリ名に従うため、
    **一方向同期のミラー先（`tacpendium`）で必ず外れる**。実行時に
    `/workspaces/*/scripts/list-commands.sh` を 1 つ選ぶ形にした。
    ★Docker のエスケープに依存しない単一引用符の形を採り、
    **rc へ書かれる行と、別名チェックアウトでの実行を実測で確かめた**
    （最初に書いた `\"\$(...)\"` 形は、ビルド時にコマンド置換が走って
    `alias cmds='bash '` になることを実測で確認し、破棄した）

---

## 5. §3-5 `docs/design/` に残っている `combomgr`（**★製造は直さない。設計卓が CHANGE で処理する**）

**2 ファイル・37 出現。** 内訳を性格別に分けた。

### 5.1 ★★他プロジェクトの名前（**設計卓も置換してはならない**）

| 箇所 | 内容 |
|---|---|
| `02-architecture.md:882` | 「別バイナリ（例：`combomgr-importer`、仮称）」 |
| `02-architecture.md:918` | 「別ツール（FR701 `combomgr-importer` / `moves-input…`）」 |

**★この 2 件は FR701 の別リポジトリを指しており、本アプリの名前ではない。**

### 5.2 本アプリの名前（**改訂対象**・35 出現）

| ファイル | 行 | 何を定めているか | 実装との食い違い |
|---|---|---|---|
| `02-architecture.md` | **71** | **「本書内の `combomgr.exe` / `combomgr` は仮称である。プロジェクト名は完成時に確定させる」** | **★この注記そのものが失効した。** 名称は `D-664` で確定し、`M28-01` で実装へ反映済み。**⇒ ここが改訂の起点になる** |
| `02-architecture.md` | 25 / 76 | 構成図・シーケンス図の `combomgr.exe` | 実物は `tacpendium-windows-amd64.exe` |
| `02-architecture.md` | **1197〜1202** | **リリースアーカイブの構成**（`combomgr-windows-amd64.zip` / `combomgr.exe` / `combomgr-macos-arm64.tar.gz` / `combomgr-linux-amd64.tar.gz`） | **★実物は Makefile / CI ともに `tacpendium-*` へ動いた。設計書だけが旧名** |
| `02-architecture.md` | 703 | **`combomgr_session` Cookie** | **★実物は `tacpendium_session`** |
| `02-architecture.md` | 769 | データディレクトリ `%APPDATA%\combomgr\` | **★実物は `…\tacpendium\`。あわせて自動移行が入った（本報告 §4.3）。SUPP-001 §5.8 側にも及ぶ** |
| `02-architecture.md` | 1269 / 1271 | ディレクトリ構成図のリポジトリルートと `cmd/combomgr/` | **★実物は `cmd/tacpendium/`** |
| `supp-001-detailed-design.md` | 624 / 626 | **§5.2 Go 側ディレクトリ構成**のルートと `cmd/combomgr/` | **★実物は `cmd/tacpendium/`** |
| `supp-001-detailed-design.md` | 1090 / 1091 / 1213 | **§5.6 ロギング**の出力先 `logs/combomgr.log` | **★実物は `logs/tacpendium.log`** |
| `supp-001-detailed-design.md` | 1094 / 1160〜1162 | **§5.8 環境変数 4 本**（`COMBOMGR_CONFIG_PATH` / `_LOG_LEVEL` / `_DB_PATH` / `_PORT`） | **★実物は `TACPENDIUM_*`。4 本すべて** |
| `supp-001-detailed-design.md` | 1178〜1180 / 1186 | **§5.8 設定ファイルの書式**（OS 別 DB 既定パス 3 行と `logging.file`） | **★実物は `tacpendium/tacpendium.db` / `logs/tacpendium.log`** |
| `supp-001-detailed-design.md` | 21 / 579 / 584 / 587 | **更新履歴と実装メモの本文**（`CHANGE-135` の記録、`cmd/combomgr/main.go` への言及） | **★これらは当時の記録に近い。改訂するかは設計卓の判断** |

**⇒ CHANGE 1 本が要る見込み。★自採番していない**（`D-293`）。設計卓へ請求する。

**★あわせて設計卓へ**: 上表の「実装との食い違い」は、レビュー較正上
「撤回済み・失効した記述がコード上に残っている」と同型（＝**「高」**）である。
とくに `02-architecture.md:71` は、**「仮称である」と述べたその注記自体が失効している**。
ここを直さないと後任が「名前はまだ仮」という前提を複製する。

## 6. §3-6 `README.md` / `README.txt` の二重についての案（**★案を出すだけ。消していない**）

### 実査結果: **二重ではない。役割が違う。**

| | 行数 | 読者 | 配布 |
|---|---:|---|---|
| `README.md` | 199 | 開発者（Go/pnpm/devContainer・クイックスタート・**CI 運用 L72-190**） | GitHub 上のみ |
| `README.txt` | 123 | エンドユーザー（起動・ポート・**LAN の FW/AV トラブルシューティング L64-107**・DB の場所） | **リリース zip に同梱** |

重なるのは題と配布バイナリ 3 名だけ。**3 つの独立した根拠が `README.txt` を必須成果物としている:**

1. `nightly-crossbuild.yml:109-112` の逐語＝
   「**同梱すべき README.txt こそが、LAN の FW/AV トラブルシューティングの本体である**」
2. `docs/design/02-architecture.md:1199` がアーカイブ構成の一部として定義
3. `cmd/tacpendium/main.go:447` が起動時に「詳細は README.txt を参照してください」と表示

### 案（推奨順）

| # | 案 | 評価 |
|---|---|---|
| **1（推奨）** | **両方残す。** 題を読者で分ける（`README.md` = 開発者向け ／ `README.txt` = 配布版・利用者向け。**既にそうなっている**）。`README.md` から `README.txt` への相互参照を 1 行張る | 変更が最小で、3 つの根拠のいずれとも衝突しない |
| 2 | `README.txt` を `dist/README.txt` へ**移す** | 「同梱物である」ことが置き場で分かる。ただし `nightly-crossbuild.yml` と `02-architecture.md` の参照を追う必要があり、**移動は開発者の手番**（`D-196` 境界条件 3） |
| 3 | `README-distribution.txt` へ**改名** | 2 と同じ手当てが要る割に、得られるものは名前だけ |

**★あわせて報告**: `README.txt:77` は Windows ファイアウォール規則名を案内している。
本サブで `"CombMgr"` → `"Tacpendium"` へ変えたため、
**既に古い名前で規則を作っている利用者には、使われない規則が残る**。
削除の案内を足すかは開発者の判断（本サブでは足していない）。

---

## 7. §3-7 ★確かめられなかったこと・解釈したこと（**断定に化けさせない**）

### 7-1 ★指示書 §2.3-4「`config.toml` も移す」——**移すものが無い**

**`config.toml` はアプリ実行ディレクトリ直下にあり、データディレクトリの中には無い**
（`cmd/tacpendium/main.go` の `defaultConfigPath = "config.toml"`。実査）。
ログ既定 `logs/tacpendium.log` も同じくカレント基準である。

**⇒ 規則 4 で実際にやることは「移す」ではなく「中の絶対パスの書き換え」だけになった。**
後半（`★中の絶対パスが旧を指していたら書き換える`）は `config.RewriteRelocatedPaths` で実装した。

### ★★【2026-09-05 承認済み】設計卓の裁定と、その根拠

**設計卓の逐語**＝「規則 4 の目的は『旧データディレクトリに置かれた `config.toml` を新へ運ぶ』こと。
実行ディレクトリ直下にあるなら、そもそもデータディレクトリの移行の対象ではありません。
**存在しない経路の実装を作らせる意味はありません**」。**⇒ 承認。**

**あわせて求められた根拠**——「**たまたま今そこに無かった**」のか「**設計上そこには置かれない**」のか。
**後者である。** 出所が 3 つあり、いずれも一致している。

| # | 出所 | 逐語 |
|---|---|---|
| 1 | **`SUPP-001` §5.8**（設計書の定義） | **「配置場所: アプリ実行ディレクトリ直下」** |
| 2 | `README.txt:20`（利用者向け） | 「設定ファイル(config.toml)とログ(logs/)は、**アプリを起動したフォルダ(カレントディレクトリ)に作成されます**」 |
| 3 | **`README.txt:117-118`**（利用者向け・**★両者を対比している**） | 「アプリを更新する際は…**データベースは上記の場所に、config.toml は起動フォルダに残るため**、そのまま引き継げます」 |
| 4 | 実装 `cmd/tacpendium/main.go:85` | `// defaultConfigPath はアプリ実行ディレクトリ直下の設定ファイル名(SUPP-001 §5.8)` |

**★とくに 3 が決め手である。** 利用者向けの文書が **DB の置き場と `config.toml` の置き場を並べて対比**し、
「更新しても両方それぞれの場所に残る」ことを説明の前提にしている。
**⇒ `config.toml` をデータディレクトリへ置く経路は、設計にも実装にも存在しない。将来の穴ではない。**

### 7-2 ★指示書 §2.3-2「何も動かさずに**止まり**、利用者へ理由を出す」——**止めるのは移行**と読んだ

検証に失敗したとき（経路 d）、**アプリの起動は止めず、旧データディレクトリで起動する**実装にした。

- 旧は構成上 1 バイトも動いていないので、そこで起動するほうが「起動できない」より安全
- **「利用者へ理由を出す」には画面が要る**。起動を止めると理由を出す先が無くなる
- ログは `ERROR`、画面は**赤いバナー**で出す

**★例外は 1 つだけ**——**別プロセスが移行中のときは起動を止める**。
2 系統から旧を書くと、勝ったほうが旧をリネームした後も負けたほうが旧を掴んだまま書き続け、
**その書き込みが利用者から見えなくなる**ため。

### ★★【2026-09-05 承認済み】設計卓の裁定と、付された条件 3 つ

**設計卓の逐語**＝「読みは正しいです。承認します。根拠は規則 1『旧を消さない』と
規則 6『中断したら旧が正本のまま残る形にする』です。**設計の意図は『旧が正本のまま残る』であって、アプリが起動しないことではありません**」。

**条件 3 つが付き、いずれも実装した**（`M28-01` 追補）。

| # | 条件 | 対応 |
|---|---|---|
| **(a)** | 検証に失敗したときアプリが掴むのは**旧**でなければならない | **実装は満たしていたが、テストが無かった**——`datadir` 側の (d1)/(d2)/(d3) は `Migrate` の戻り値までしか見ておらず、**`run()` がどちらの DB を開くかは誰も確かめていなかった**。⇒ `TestPrepareDataDirWith_VerifyFails_OpensLegacyDB` を新設し、**返るパスが旧を指すことに加えて、そこを開くと `combos` が 3 行読める**ところまで見る。あわせて `prepareDataDirWith` を切り出して検証の失敗を注入できるようにした（本番の挙動は不変） |
| **(b)** | 規則 5 の「1 度だけ」は成功時の話。**失敗時は毎回出す** | **★現状は逆だった。** レビュー是正（中-1）で入れた `UpsertNotice` の dedup が失敗にも効き、**一度閉じたら二度と出なくなっていた**。⇒ 規則を 1 本にした——**「完全に解決した状態だけが 1 度だけ。未解決の状態は毎回」**（`keepsAcknowledgement`） |
| **(c)** | 失敗後に残った新ディレクトリを、次回起動の経路 (b) が正本として掴んではならない | **★前提が成立しないことを実測した**（下記 §7-2.1） |

**★★開発者の判断（2026-09-05）**——**「`combomgr` の利用者は開発者しかいない。`tacpendium` への移行は考えなくてよい」**。⇒ 本追補の射程はこの前提で決めた（§7-2.2）。

### 7-2.1 ★条件 (c) —— 前提が成立しなかった

条件 (c) は「検証に失敗して止まった後、**新ディレクトリは残ります**」を前提にしている。
**実測した結果、通常の検証失敗では新ディレクトリは作られない。**

`populateStaging` が失敗すると `committed = false` のまま `defer` が作業ディレクトリを
`os.RemoveAll` し、**`newDir` を作る唯一の場所である `commitStaging` に到達しない**。
(d1)/(d2)/(d3) の各テストも `mustNotExist(t, newDir, "移行先")` を実測している。

残骸が出るのは `commitStaging` の途中失敗だけで、そこでも
**DB を最後に置く**ため次回の `Decide`（`isNonEmptyFile(newDir/<新 DB>)` だけを見る）は
残骸を正本にしない。

**⇒ マーカー機構は作らなかった。** 塞ぐべき穴が実在せず、「起こらないことへの備え」になるため。
**代わりに、失敗の出口で残骸を実測して `Result.RemnantDir` / `RemnantDB` に載せた**——
「残っていない」を**主張ではなく観測**にし、将来 `commitStaging` を先に呼ぶ形へ変えたら
報告とテストから見えるようにした（`observeRemnant`）。
新設した (a) のテストもこの 2 つが false であることを確かめている。

### 7-2.2 ★条件の外で見つけた穴 —— 明示パスが新既定を指すと、移行も告知も起きなかった

条件 (b) の射程を検討する過程で、**条件よりも静かな経路**を見つけた。

`config.toml` の `database.path`（または `TACPENDIUM_DB_PATH`）に**新既定のパスを明示**すると、
`prepareDataDir` は `Decide` に**到達する前に** `ReasonExplicitDBPath` で抜け、
`NoticeFor` はその理由を告知の対象にしていない。
**⇒ 移行もせず、告知も出さず、`db.Open` がそこへ空の DB を作り、旧のデータが黙って取り残される。**

**★`README.txt` は既定パスを OS 別に印字している。**「保存場所を明示しておこう」と
それを書き写す利用者は現実にいて、**移行が要るのはまさにその人である。**

**⇒ 直した。** 飛ばすのは「明示先が**旧既定でも新既定でもない**」ときだけにした
（`datadir.SamePath` で判定）。明示先が別の場所なら、利用者が意図しているので従来どおり黙って従う。

**★これはリネーム固有の穴ではない**——「移行を飛ばす判定が、データの所在を見る前に走る」形の問題である。
ただし `internal/infra/datadir` は `combomgr` → `tacpendium` の 1 回きり専用であり
（旧名を定数で直書きしている）、移行が済めば以後は永久に経路 c になる。
**`tacpendium` v1 → v2 では再発しない**——スキーマ変更は `golang-migrate`（`migrations/`）の担当であり、ディレクトリを動かさないためである。

### 7-2.3 経路 b（新旧の両方が在る）を中身で分けた

経路 b は **3 通りの状況を 1 つにまとめており**、`Decide` は `os.Stat` のサイズしか見ないので区別できない。

| # | 状況 | 新の中身 | 性格 |
|---|---|---|---|
| 1 | 退避に失敗（Windows のファイルロック等） | 検証済み | 良性・**頻度は高い** |
| 2 | 確定と退避の間で落ちた | 検証済み | 良性 |
| 3 | **移行前に新の場所へ空 DB が作られた** | **空** | **危険** |

**⇒ 経路 b のときだけ両方の行数を数え**（`CheckStranded`。`verify.go` の
`userTables` / `countTables` を再利用）、3 を `ReasonOldDataStranded` として分けた。

| 経路 b の中身 | 扱い |
|---|---|
| 新にデータが在る（1・2） | **1 度だけ**。閉じたら出ない。旧を消すのは開発者の手番（`D-196`）であり、**先送りしている作業を毎起動で催促しない** |
| **新が空で旧にデータが在る（3）** | **毎起動・赤**。「いま開いているデータは空です。以前のデータ(N 件)は〈旧〉に残っています」 |

**★`schema_migrations` は行数に入れない。** 入れると `golang-migrate` が版を 1 行書いた時点で
「空ではない」ことになり、**危険形の判定が永久に効かなくなる**（回帰テストで固定した）。

**★この形が現実に効く場面は 1 つある**——**devContainer をリビルドせずに起動した場合**
（新が volume の外に作られ、リビルド後に実データが取り残される）。§8 の開発者手番 1 と対になる。

**★これは製造の解釈である。設計卓が別の読みを採るなら実装を変える。**

### 7-3 ★確かめられなかったもの

| # | 内容 |
|---|---|
| ~~1~~ | ~~**実機での移行**~~ → **★【2026-09-06】消化した。** 開発者環境の実データ（1.1 MB・コンボ 97 件・`backups/` と `-bak` 8 本が同居）で全経路を実走行した。結果と、そこで新たに分かった 3 件は **§7-4** |
| 2 | **Windows / macOS での挙動**。`ResolveDBPath` の OS 分岐と `os.Rename` の Windows 差（ファイルを掴まれているとリネームが失敗する）はコード上で手当てしたが、**実機確認はしていない**。退避の失敗を非致命にして 3 回リトライする形にしてある |
| 3 | **CI の nightly-crossbuild が新しい成果物名で通るか**。ワークフローは書き換えたが、nightly は本セッションでは走っていない |
| 4 | **`.agents/skills/combomgr-manufacturing-workflow/` を改名した場合の Codex 側の挙動**。触っていないため未確認 |

### 7-4 ★【2026-09-06】実データでの移行検証（開発者環境）

**§7-3 の 1 を消化するために実施した。** 本番のデータディレクトリには触らず、`XDG_DATA_HOME` を捨て場へ向けて**実データの複製**に対して本物の移行コードを走らせた。

```
cp -a ~/.local/share/tacpendium /tmp/mig-rehearsal/share/combomgr   # 旧名の側へ置く
XDG_DATA_HOME=/tmp/mig-rehearsal/share TACPENDIUM_PORT=47399 TACPENDIUM_LOG_LEVEL=debug go run ./cmd/tacpendium
```

**★`TACPENDIUM_DB_PATH` では代用できない**——明示パス扱いになり `ReasonExplicitDBPath` で移行判定を素通りする（§7-2 の 14 で塞いだ入口そのもの）。効かせるのは `XDG_DATA_HOME` の側である。

#### 結果（全項目パス）

| 確認点 | 実測 |
|---|---|
| `copied_files` | **12**。内訳 = DB 1 ＋ 直下の `-bak` 8 本 ＋ `backups/` 配下 3 本。`combomgr.db-wal` / `-shm` は skip 集合なので数に入らない |
| 新側 | `-bak` 8 本が名前そのまま・サイズ一致・パーミッション 644 保存。`combomgr.db` は無い |
| 退避側 | 中身が丸ごと残り、**mtime も全件（Jul 15 / Jul 16 / Aug 8 / Aug 31）が保存**。旧を書き換えていないことの実証 |
| 退避側の `combomgr.db-wal` / `-shm` | **消えている**。checkpoint → close を経た証拠であり、§7-2 の 10 で改めた不変条件（検証が通るまで旧の中身は失われない／WAL は本体へ畳まれる）が実データで成立した |
| ロック・staging | どちらも残骸なし |
| 告知ファイル | `status=migrated` ／ `retiredTo` 有り ／ `reason` と `retireFailed` は omitempty で省略 |
| **実 HTTP の往復** | `GET` → 200 ＋ JSON、`POST /ack` → 204、`GET` 再 → **204**（`handler.go:60-61`）、ファイルの `acknowledged` が **true へ反転**。**どのテストも通っていなかった一本道である** |
| `migration.Run` | `from_version=80` → `102`。**dev DB は 22 本遅れていた** |

#### ★DB が大きくなるのは正常である

移行元 1,126,400 → 移行先 1,679,360 バイト。`VACUUM INTO` は縮める方向なので一見おかしいが、**増えたのは移行の後である**。`Verify`（テーブル集合・全表の行数・`user_version`）は `populateStaging` の中で複製直後に通っており、その時点では一致していた。その後 `main.go` の `migration.Run` が 22 本を適用し、うち大半が `seed_characters_fourth_wave` / `seed_moves_fourth_wave` / `seed_move_derivations_*` 等の**行を挿入するシード**である。

#### ★新たに分かった 3 件（いずれも害は無い。設計卓へ回す候補）

| # | 内容 |
|---|---|
| a | **ディレクトリのパーミッションが保存されない。** `copy.go:51-52` が `os.MkdirAll(target, 0o755)` 固定であるのに対し、ファイルは `info.Mode().Perm()` で保存する。⇒ 実データの `backups/` が **700 から 755 へ緩んだ**（中のファイルは 600 のまま保存されたので読まれはしない）。直すなら `MkdirAll` の後に `os.Chmod` が要る。**`MkdirAll` に権限を渡すだけでは umask で削られるので一行では済まない** |
| b | **移行してきた環境だけ、新データディレクトリが 700 になる。** staging を `os.MkdirTemp`（0700 固定）で作り、それをリネームして確定させるため。**新規インストールは `MkdirAll(dir, 0o755)` で 755** なので、経路によって差が出る。厳しい側なので実害は無い。★a と並べると元と結果でちょうど反転している——元 `dir 755 / backups 700`、後 `dir 700 / backups 755` |
| c | **`Notice.AcknowledgedAt` の `omitempty` が効いていない。** `encoding/json` の `omitempty` は `time.Time` のような構造体には作用しないため、常に `0001-01-01T00:00:00Z` が書かれる。読み戻しは正常。フロントの `DataMigrationNotice` は当該フィールドを持たないので影響ゼロ |

#### ★併せて分かったこと

- **バナーは `HomePage`（`/`）にのみ置いてある**（`web/src/pages/HomePage.tsx:31`。マウント箇所は 1 つ）。別ルートを開いていると出ない
- **dev ビルドはフロントを同梱しない**（`embed_web_stub.go` = `//go:build !embed_web`）。`go run ./cmd/tacpendium` 単体で `/` が 404 なのは正常であり、画面を見るには Vite 側（`VITE_API_PORT` で proxy を向ける）が要る
- 開発者のローカル `config.toml`（gitignore 対象）が `logs/combomgr.log` のままだった。**`RewriteRelocatedPaths` は旧ルート配下の絶対パスしか書き換えない**ので `config_rewritten=false` は正しい挙動である（相対パスは対象外）

---

---

## 8. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の消費** | **無し**（起票していない）。★`docs/design/` の 37 箇所は設計卓へ請求する（§5）。**自採番していない** |
| 2 | 番号の写し先（registry §1 / 契約 §4 / ボード §2.1 / §2.4） | **該当なし**（番号を消費していないため） |
| 3 | **マイグレ連番** | **消費なし**。`ls migrations/` の最大は `000102` のままで、ボード §2.2 の「次に払い出す番号 `000103`」とずれていない |
| 4 | 版を上げた文書の参照元 | **該当なし**（設計書・指示書の版を上げていない） |
| 5 | **派生資料** | `docs/handover/code-facts.md` を **`generate-code-facts.sh` 経由で再生成**（§4 ルート表に 71 本。空でないことを実測）。`docs-map.md` は `docs/` の構成が変わっていないため再生成不要 |

### ★★開発者の手番（**本サブでは実施していない**）

| # | 内容 | なぜ開発者の手番か |
|---|---|---|
| ~~**1**~~ | ~~**devContainer のリビルド**~~ | **★【2026-09-06】完了。** ★★**初版の「`source` は変えていないので、リビルドすれば既存の dev データはそのまま新しいパスに現れる」は、読んだ人が導く結論が誤りだった。** ファイルは現れるが **DB のファイル名も `combomgr.db` → `tacpendium.db` へ変わっている**ため、アプリは新パスに `tacpendium.db` を見つけられず**空の DB を作る**。しかも `Decide` の入口は旧**ディレクトリ**の有無であり、リビルド後は旧パスがマウント点でなくなって存在しないので `ReasonNoLegacyDir` で skip、`NoticeFor` も対象外で**告知も出ない**。⇒ **無言で空のアプリが立ち上がる。** 実際の復旧は同一ディレクトリ内での改名 1 回で済んだ（§7-4） |
| **2** | `<旧名>.migrated-<日付>` をいつ消すか | `D-196` 境界条件 3 |
| ~~**3**~~ | ~~`.agents/skills/combomgr-manufacturing-workflow/` の改名~~ | **★【2026-09-05 追補 2】開発者の明示指示により製造が実施した**（§10）。**★初版は「4 か所」と書いたが実測 11 か所だった** |
| **4** | `docs/usermanual/combmgr-friend-readme.html` の**ファイル名** | 本文は直した。改名は `docs-map` / `cleanup_docs` などの参照元を追う必要がある |
| **5** | `README.txt` の置き場（§6） | `D-196` 境界条件 3 |
| **6** | `.claude/` 配下（`settings.json` 1 箇所は残る） | 開発者のルールファイル（指示書 §4-4）。**★【追補 2】`*_wt.md` 5 本と `sync_codex_config.md` は開発者の明示指示により実施した**（§10）。**★初版は「worktree ガードが `pwd` と突き合わせる実パス」と書いたが誤り**——ガードの判定は「パスに `/wt-` を含む」であり、`/workspaces/combomgr` は「例」と明記された例示にすぎない。**⇒ 機能は壊れない。**`.claude/settings.json:12` の `autopilot-combomgr` は他プロジェクト名なので据え置き |
| ~~**7**~~ | ~~`docs/human-notes/` 388 箇所~~ | **★【2026-09-05 追補 2】開発者の明示指示により製造が実施した**（§10）。**★ファイル名 52 件は据え置いた**。理由は §10.3 |
| **8** | 公開リポジトリ `plexiblinp/tacpendium` の新設と一方向同期の設定 | 開発者の運用判断 |

---

## 8.1 ★【2026-09-05 追補 2】開発者の明示指示で実施した 3 件

**指示書 §4-4 は「`.claude/` の編集」を「やらないこと」に挙げているが、開発者の明示指示によりこれを上書きした。** `.agents/` と `human-notes/codex/` も同様。

### 10.1 skill 識別子 `combomgr-` → `tacpendium-manufacturing-workflow`

**★初版は「`AGENTS.md:11` と README の 4 か所」と書いたが、実測 11 か所だった。**
漏らしていたのは `agents/openai.yaml:4` ／ `.claude/commands/sync_codex_config.md:31` ／
`docs/instructions/phase3/CodexRefactor1-01-…:29`、および README が 1 行ではなく **5 行**だったこと。

動かした 10 か所: ディレクトリ名 ／ `SKILL.md` の `name:` と `description` の `CombMgr` ／
`agents/openai.yaml` の `display_name` と `default_prompt` ／ `AGENTS.md:11` ／
`human-notes/codex/README.md` の呼び出し 4 行・派生物表 1 行・branding 1 行 ／
`sync_codex_config.md:31`（**「Codex アダプタの実在を確認する」5 パスの 1 つ**）。

**★据え置いたもの**: `human-notes/codex/README.md:142` の**実際のエラー出力の引用**
（`failed to parse hooks config /workspaces/combomgr/.codex/hooks.json: …`）と、
`docs/instructions/phase3/` の歴史記録。

**★確かめられなかったこと**: **Codex 側の実機確認はできていない**（本セッションに Codex が無い）。
「改名後に Codex が skill を読めるか」は開発者の手番。`sync_codex_config` も走らせていない。
`name:` とディレクトリ名の一致が必須かはリポジトリ内に規約文書が無く、**両方動かす**選択をした。

### 10.2 `.claude/commands/*_wt.md` の `/workspaces/combomgr`

**★実体は機能の修正ではなかった。** ガードは自然言語の指示であり、
実装したスクリプトもフックも無い（`.claude/hooks/*.sh` と `settings.json` に `/workspaces` は **0 件**）。
判定は「パスに `/wt-` セグメントを含む」で、`scripts/wt-*.sh` は 3 本とも
`git rev-parse --show-toplevel` で親を解決しており**完全にパス非依存**。

**⇒ 単純な改名はしなかった。** 開発リポジトリのディレクトリ名は `combomgr` のまま存続するので、
`/workspaces/tacpendium` と書くと**いまの開発環境で嘘になる**。
`cmds` エイリアスに採ったのと同じ**チェックアウト名に依存しない形**へ直した
（例示は `<リポジトリのチェックアウト>/wt-setplay`、言い換えは `git rev-parse --show-toplevel` の直下）。

**★あわせて、本サブの変更が原因で古くなっていた記述を直した**——
`scripts/wt-new.sh` を `tacpendium-dev.db` に変えたのに
`docs/human-notes/worktree-scripts-guide.md:26,59` が `combomgr-dev.db` のままだった。
**レビューも見落としていた。**

### 10.3 `docs/human-notes/` —— 本文 177 箇所を置換し、★ファイル名 52 件は据え置いた

| 区分 | 出現 |
|---|---:|
| 非 archive の総数（置換前） | 385 |
| **置換した** | **177**（`CombMgr` 113 ／ `combomgr` 46 ／ `COMBOMGR` 11 ／ `combmgr` 6 ／ `COMBMGR` 1） |
| 据え置いた | 208 |

**★★ファイル名を据え置いた理由（作業を省いたのではない）**

ファイル名に旧名を含むのは **52 件**。被参照を全数調べたところ、
**歴史記録から約 86 行が参照しており**（`docs/progress/M25-RESEARCH-01-report.md` の 1 ファイルだけで **42 行**）、
**歴史記録は編集できないのでその参照切れは直せない**。

**★さらに悪いのは、どの機械検査も捕まえないことである。**
`check-doc-refs.sh` の走査範囲は `CLAUDE.md` / `web/CLAUDE.md` / `.claude/rules/` / `.claude/commands/` だけで、
抽出正規表現は**リポジトリ相対のフルパスしか拾わない**。参照はほぼすべて裸のファイル名なので
**1 件も検出されない**。`check-doc-inventory.sh` は `docs/human-notes/` を走査しない。
**⇒ 約 86 行が黙って壊れ、誰も気づかない。**

**★`archive/` の 8 件を除いて 44 件だけ改名しても解決しない**——
`future-notes/archive/` の 2 ファイルが**非 archive のファイル名を引用している**ため、
archive を触らなくても archive 側が失効する。

**★据え置いた 208 件の内訳**（すべて据え置きが正しいことを全数目視した）

| 区分 | 件数 | 例 |
|---|---:|---|
| 据え置くファイル名への参照 | 181 | `combmgr-pending-decisions.md` 等。**拡張子なしの参照も保護した**（`future-notes の combmgr-license-strategy-outline`） |
| 他プロジェクト | 8 | `combomgr-importer` ／ `autopilot-combomgr` |
| **リポジトリのチェックアウトパス** | 8 | `cd ~/projects/combomgr` ／ `../combomgr-m1-04` ／ ツリー図の `combomgr/ ← 親`。**リポジトリ名は `combomgr` のまま存続する** |
| **リネームの経緯を語る記述** | 3 | 「**仮名 `combomgr` → 正式名**」。書き換えると無意味になる |
| **実際に起きた事故のコマンド引用** | 2 | `sed -i 's/combomgr/recurfold/g' scripts/*.sh`（Recurfold 移植中の自己事故）。書き換えると引用でなくなる |
| その他の固有名 | 6 | `combomgr-conventions-and-lisence` 等 |

**★`archive/` 2 ディレクトリ（38 出現・9 ファイル）は 0 差分**——
§2 で「歴史記録」として 0 差分を主張した範囲であり、触ると本体の報告の主張が偽になる。

### 10.4 ★`docs/handover/docs-map.md` の再生成について（開示）

再生成したところ **+29 / −22 行**の差分が出たが、**本追補の変更に由来する行は 0 行である**
（`human-notes` を含む行は 1 行も差分に現れない）。
差分の中身は `b7d150d` 以降に溜まった**着手前からのドリフト**（M27 の指示書群の追加、
設計書の版更新、削除済み `m19-desk-status.md` の除去など）。
**`git restore` は禁止操作のため戻せなかった**ので、
**別コミットに分けて**混入が履歴から見えるようにした。

---

## 9. 検証の実測

| 検証 | 結果 |
|---|---|
| `go build ./...` | **通過** |
| `go vet ./...` | **通過** |
| `go test ./...` | **green**（全パッケージ。Phase C で `prepareDataDir` 4 経路 ＋ `ReadyToRetire` ＋ (d3) ＋ 告知の ack 2 本を追加） |
| `cd web && pnpm exec tsc --noEmit` | **通過** |
| `cd web && pnpm test` | **green**（**211 ファイル / 2380 件**。Phase C でフロントのテスト 7 件を追加） |
| `make e2e` | **green**（**239 passed / 4.0m**） |
| `bash scripts/check-artifact-integrity.sh` | **違反なし**（★1 本目に実行） |
| `bash scripts/check-instruction-format.sh` | **緑**（78/78・14/14・版数一致 65 件） |
| `bash scripts/check-doc-refs.sh` | **dead reference なし** |
| `bash scripts/check-stop-discipline.sh` | **緑** |
| `bash scripts/check-doc-inventory.sh` | **型に無いファイルなし** |
| `bash scripts/check-browser-storage-keys.sh` | **緑**（★移行の告知にブラウザストレージを使わなかったため台帳が動かない） |
| `bash scripts/check-enum-sync.sh` | **緑**（WARN 28 = ベースラインどおり） |
| `bash scripts/check-md-emphasis.sh` | 431 / 436 —— **★本サブ由来ではない**（§3.3） |
| `bash scripts/check-import-order.sh` | **NG** 102 / 101 —— **★着手前から NG**（§3.3） |
| `bash scripts/check-progress-log-index.sh` | **緑**（`progress-log.md` へ追記後に実測） |
| `bash scripts/generate-code-facts.sh` | 生成 OK・§4 ルート表に **71 本**（空でない） |

### ★Phase C で追加した破壊確認

`prepareDataDir` の退避ガード（`datadir.ReadyToRetire`）を `false &&` で無力化して
該当テストを回すと:

```
--- FAIL: TestPrepareDataDir_ConfigRewriteMissed_DoesNotRetire
    config が書き換わっていないのに旧を退避した: "…/combomgr.migrated-20260905"
    —— 次の起動で空の DB が作られる
```

**⇒ レビュー 高-6 が指摘した経路は実在し、新設したガードは効いている**。復元後 green。

### ★E2E だけが捕まえた取りこぼし（**記録として残す**）

`web/playwright.config.ts:136` の `go run ./cmd/combomgr` を直していなかった。
1 回目の `make e2e` が `stat /home/user/combomgr/cmd/combomgr: directory not found` で
**webServer の起動に失敗し全滅**した。

**★`go build` も `go vet` も `go test` も `pnpm test` も `tsc` も緑のままだった。**
TypeScript の文字列リテラルの中に在るパスであり、型検査の対象ではない。
**⇒ ディレクトリを動かす変更では、E2E を通すまで「緑」を信用してはいけない。**

### 母数の再実測に使ったスクリプト

区分の排他性と網羅性を機械的に保証するため、
**1 出現 = 1 行に落としてからパスで排他的に振り分け、どの区分にも入らなかった残差を表に出す**
形の census を使った（残差 0 を確認）。スクリプト本体は本報告の作業領域に置いてあり、
恒久化するかは開発者の判断（`CLAUDE.md` §10.Y。**`docs/` へは新設していない**）。

---

## 10. レビュー結果

レビュー報告書: `docs/progress/m28-01-review.md`（トリアージの全件は同書末尾
「## 取り込み結果（自動トリアージ）」が正本）。

| 項目 | 実測 |
|---|---|
| **重大** | **0 件**（完了承認を妨げるものは無し。チェックリスト §8 の 8 項目はすべて非該当） |
| **高** | **6 件 —— 全件採用。★不採用 0 件**（安全弁の発火なし） |
| **中** | 9 件 —— 8 件採用 / 1 件（中-3）一部採用 |
| **低** | 7 件 —— 2 件採用 / 5 件は理由を付けて不採用 |
| **再レビュー往復** | **0 回**（上限 2 回に未達。未解消の指摘が無いため §J への停止時記録は不要） |

### ★レビューが捕まえた実バグ 2 件（体裁の指摘ではない）

| # | 内容 |
|---|---|
| **1** | **高-6: config の書き換えが空振りしても旧を退避していた。** 移行の判定 `UsesLegacyDefault` は `EvalSymlinks` で正規化するのに対し、書き換え側の `withinRoot` は純粋な字句一致である。両者が食い違う綴りで `database.path` が書かれていると「**移行はする ／ config は書き換わらない ／ 旧は退避される**」が成立し、次の起動で SQLite が消えた旧パスへ**空の DB を作る**。`RetireOld` の注記自身が警告していた経路を、`prepareDataDir` が踏んでいた。⇒ `datadir.ReadyToRetire` で「開く先が実在するか」を見る形に是正。**ガードを無力化すると新設テストが赤くなることを実測した** |
| **2** | **中-5 のテストが `useAckDataMigrationNotice` の実バグを露出させた。** `queryClient.setQueryData(key, undefined)` は TanStack Query では **no-op**（`undefined` は「更新しない」の合図）であり、**バナーを閉じても消えなかった**。フロントにテストが 1 本も無かったため、それまで誰も踏んでいなかった。⇒ `onMutate` で `acknowledged: true` を書く形へ是正 |

**★どちらも「テストが無い領域」から出ている。** `datadir` の 683 行のテストは `prepareDataDir` を
1 度も通っておらず、フロントは全層で未実行だった。**⇒ 行数ではなく「どの関数を通るか」でテストの空白を見ること**。

### 本サブで新たに書いた記述の是正（レビュー由来）

- **高-5**: `doc.go` の不変条件「旧ディレクトリは、検証が通るまで 1 バイトも動かさない」は
  **literal には成立していなかった**（ロックファイルの作成と `wal_checkpoint(TRUNCATE)` の書き戻し）。
  「検証が通るまで、旧ディレクトリの**中身は失われない**」へ書き直し、
  **バイト列で見てよい経路と行数で見るべき経路をテスト側でも書き分けた**（(d3) を新設）。
- **高-4**: `internal/api/notice` の注記が「認証で保護されているから絶対パスを載せてよい」と
  述べていたが、`mw.Auth` は `password_enabled = false` のとき素通しであり、それが既定である。
  **⇒ 注記を実態へ書き直した**（露出そのものは `GET /api/config` と同条件で新種ではない）。

## 11. 完了条件（指示書 §5）との照合

| # | 条件 | 状態 |
|---|---|---|
| 1 | 母数が区分ごとに出ており、Plan Mode で範囲の承認を得ている | **満たす**（§1。承認は 2026-09-05。★綴りの数え落としは設計卓の指摘で是正済み） |
| 2 | `go.mod` の `module` が新名になり `go build ./...` が通る | **満たす** |
| 3 | `go test ./...` / `pnpm test` / `make e2e` が緑 | **満たす**（239 passed / 4.0m） |
| 4 | 移行の 4 経路のテストが在り、(d) で「何も動かさずに止まる」ことが確かめられている | **満たす**（§4.3。破壊確認つき） |
| 5 | 歴史記録が 1 件も書き換わっていない | **満たす**（§2。差分 0 を区分ごとに実測） |
| 6 | 検査 7 本が緑。ベースラインが動いたなら理由が報告に在る | **6 本緑 / `check-import-order` のみ NG。★着手前から NG であり本サブ由来ではない**（§3.3 に根拠） |
| 7 | `docs/design/` に残った `combomgr` が一覧になっている | **満たす**（§5） |
| 8 | `docs/progress/progress-log.md` へ追記されている | **満たす**（Phase D） |

---

*以上*
