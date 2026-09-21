# 改善レーン D1 / D2 完了報告

- **作業 ID**: `20260908-improvement-lane-d1-d2`
- **ブランチ**: `claude/improvement-lane-d1-d2-g18pqg`
- **起点コミット**: `a6a072f`
- **窓**: 実装レーン並列 0 本（`D-335`）。`scripts/` と `.claude/` を触るため
- **源泉**: `followup-backlog.md` の 2 行 = `completion-report-md-emphasis-marker-unchecked` ／ `add-e2e-spec-template-stale-ports`

---

## 0. 要旨

| # | 項目 | 結果 |
|---|---|---|
| 1 | D1 の検査が在り、陽性対照が実測で示されている | **達成**（陽性対照は **2 系統とも**採った。§2） |
| 2 | D1 の `--self-test` が通り、`check-artifact-integrity.sh` が拾う | **達成**（自己検査 14 件 → **15 件**。§1.4） |
| 3 | `CLAUDE.md` §8 の表に 1 行足りている | **達成**（§1.5） |
| 4 | D2 の 2 か所が直り、走査で同型が残っていない | **達成**。ただし **同型は 2 か所ではなく 8 か所あった**（§3） |
| 5 | `make e2e-only P=m12-06` が緑 | **達成**（3 passed。触った他 5 spec も回して 8 passed。§4） |
| 6 | 常設検査がすべて緑 | **達成**（出力で判定。§5） |
| 7 | 完了報告 ＋ progress-log 索引行 | 本書 ＋ 索引行 1 行 |
| 8 | 設計伝達レポート | `/design_handover_report` で生成 |

**★本手番の最大の発見は D1 の前提が誤っていたことである。** 詳細は §1.1。

---

## 1. D1 — `<!-- COMPLETION-REPORT-MD-EMPHASIS -->` の存在検査

### 1.1 ★★実測 = マーカーは **4 本**であり、5 本ではない

投入プロンプトは **「想定は 5 本です」** とし、5 本目に
`docs/instructions/templates/M{N}-{NN}-{slug}.template.md` §7.4 を挙げていた。
**5 本でなければ事実を報告せよ**という条件が付いていたので、まず数えた。

```
$ grep -rn "COMPLETION-REPORT-MD-EMPHASIS" . --exclude-dir=.git
```

実装ファイルの該当は **製造 CLI 4 本だけ**である。

| # | ファイル | マーカー | 行 |
|---|---|---|---|
| 1 | `.claude/commands/implement_plan.md` | **あり** | 201 |
| 2 | `.claude/commands/implement_plan_full.md` | **あり** | 337 |
| 3 | `.claude/commands/incorporate_plan.md` | **あり** | 150 |
| 4 | `.claude/commands/review_plan.md` | **あり** | 216 |
| 5 | `docs/instructions/templates/M{N}-{NN}-{slug}.template.md` §7.4 | **★無い** | — |

残りの該当は `CLAUDE.md` §8 の説明文、`check-md-emphasis.sh` の冒頭コメント、
`followup-backlog.md`、および歴史記録（完了報告・設計伝達レポート・progress-log）であって、
**マーカーの設置箇所ではない**。

**★「消えた」のではなく「一度も入っていない」。** git で確かめた。

```
$ git log -S 'COMPLETION-REPORT-MD-EMPHASIS' --oneline -- 'docs/instructions/templates/M{N}-{NN}-{slug}.template.md'
（0 件）
```

`-S` は当該文字列の出現数が変化したコミットを拾う。**1 件も返らない**ということは、
**テンプレートへこの文字列が入ったことも消えたことも一度も無い**という意味である。

**⇒ 先行資料 3 つの記述が誤っている。**

| 資料 | 誤っている記述 |
|---|---|
| `followup-backlog.md` `completion-report-md-emphasis-marker-unchecked` | **「対象は 5 本である〔製造 CLI 4 本 ＋ 指示書テンプレート §7.4〕」** |
| `docs/progress/20260907-improvement-lane-c1-c3-completion-report.md` | 表の 5 行目に **「○」**、直後に **「節にはマーカーを置き」** |
| `docs/handover/design-reports/20260907-improvement-lane-c1-c3-design-exceptions.md` §1-3 | 見出しが **「5 本 ＋ テンプレートへ置いた」** |

テンプレート §7.4 に実際に入っているのは **手順の本文と記入指針コメントだけ**である
（マーカー行が無い）。**★C1〜C3 の手番は「置いた」と報告したが、置かれたのは本文であってマーカーではない。**

**★一般形**（本プロジェクトで繰り返し出ている型）**＝「置いた」という報告は、置かれたことの証拠にならない。**
`check-artifact-integrity.sh` の冒頭が同じ趣旨を書いている
（引き継ぎ書が **「すべて `--self-test` を持つ」** と書いていたが、走らせたら 1 本は持っていなかった）。
**⇒ 今回もその再発である。1 回 grep すれば分かる誤りが、3 つの資料へ複製されていた。**

### 1.2 設計判断 — テンプレートは本文パターンで見る

「やらないこと」が **マーカーそのものを増減させること**を禁じている。
**⇒ テンプレートへマーカーを足すのは本手番の射程外**である（足せば増加になる）。
一方で、テンプレートを検査から外すと **backlog が求めた 5 つ目の口が素手のまま残る**。

**⇒ 2 ブロック構成を採った。**

| ブロック | 対象 | 判定 |
|---|---|---|
| 1 | 製造 CLI 4 本 | マーカー `<!-- COMPLETION-REPORT-MD-EMPHASIS -->` の存在 |
| 2 | 指示書テンプレート | 本文パターン `scripts/check-md-emphasis.sh <path>` の存在 |

**★これは新しい流儀ではない。** `check-stop-discipline.sh` が既に
**ファイル種別ごとに別パターン**を持つ（`SECTION_MARKER` は `followup-backlog.md`、
`TEMPLATE_MARKER` は CLI 4 本）。**同じ体系の 3 本目として揃えた。**
ブロック 1 の形は指示どおり `check-progress-log-index.sh` の `CLI_FILES` ブロックの写しである。

**★ブロック 2 の弱さは自覚している**。本文パターンは文言に依存し、マーカーより壊れやすい。
スクリプト冒頭の「限界」節と、赤くなったときの `note` に
**「言い換えただけなら `TEMPLATE_RULE_PATTERN` を追随させること」** と明記した。
**⇒ 恒久的にはテンプレートへマーカーを足すのが正しい。§6-1 で判断を請う。**

### 1.3 `review_plan.md` が入る点が `check-progress-log-index.sh` と違う

`check-progress-log-index.sh` の `CLI_FILES` は 3 本（`review_plan.md` を含まない）。
索引行は完了時に書くものでレビュー工程には無いからである。
一方 md-emphasis の手順は **レビュー報告書も `docs/progress/` へ新規ファイルを作る**ため
`review_plan.md` にも在る。**⇒ 本検査の `CLI_FILES` は 4 本**とし、その理由をコード内に書いた。

### 1.4 `--self-test` と `check-artifact-integrity.sh` への載り方

`--self-test` は 7 対照。**`SELFTEST_MARKER`（`自己検査: 合格`）を出力する**ため、
`check-artifact-integrity.sh` の「宣言だけで実装が無い」判定を通る。

```
$ bash scripts/check-completion-report-md-emphasis.sh --self-test
OK  陰性対照(マーカーあり) → 緑
OK  陽性対照(マーカーなし) → 赤
OK  陽性対照(ファイル不在) → 赤
OK  陽性対照(PROGRESS-LOG-INDEX / STOP-DISCIPLINE だけが在る) → 赤
OK  陰性対照(テンプレートに手順あり) → 緑
OK  陽性対照(テンプレートに手順なし) → 赤
OK  陽性対照(スクリプト名だけが別文脈で出る) → 赤

自己検査: 合格(陽性は赤・陰性は緑)
```

**★4 番目の対照を足した理由**——`<!-- PROGRESS-LOG-INDEX -->` と `<!-- STOP-DISCIPLINE -->` は
同じ節の近くに置かれる。**それらだけが在る状態を緑にすると、本検査は「隣のマーカーを数えているだけ」になる。**

**★`check-artifact-integrity.sh` の編集は不要だった**（指示 D1-4）。
同スクリプトは `find scripts -maxdepth 1 -name 'check-*.sh'` の **glob で自動発見**する。
**⇒ `check-*.sh` の名で置いた時点で「既存 2 本と同じ扱い」になる。** 想定ではなく実測で確かめた。

```
（変更前）  検査 14 件 / ALLOW 除外 1 件
（変更後）  OK  check-completion-report-md-emphasis.sh の自己検査が通る
            検査 15 件 / ALLOW 除外 1 件
```

### 1.5 `CLAUDE.md` §8 の常設検査表へ 1 行

`check-progress-log-index.sh` の直後（マーカー存在検査の 3 本を隣り合わせにする位置）へ 1 行足した。
他の行と同じく **走査範囲の実数やベースラインの値を書いていない**——陳腐化しない書き方に揃えた。

---

## 2. ★★D1 の陽性対照（**実測**。2 系統とも採った）

**これが無い検査は、マーカーが全部消えても緑を返す**（`E-84`）。
**⇒ 2 つのブロックは判定機序が違うので、両方で採った。**

### 2.1 系統 1 — 製造 CLI からマーカーを 1 本消す

`.claude/commands/incorporate_plan.md` からマーカー行を `sed` で削除して回した。

```
NG  .claude/commands/incorporate_plan.md に完了報告 md-emphasis の節がない(マーカー <!-- COMPLETION-REPORT-MD-EMPHASIS --> を含む節を追加すること)
  手順の内容は .claude/commands/implement_plan.md の同マーカー節を参照

結果: 違反 1 件
EXIT=1
```

**★他の 3 本は OK のまま**であり、**消した 1 本だけを名指しした**。

### 2.2 系統 2 — テンプレートの本文を言い換える

`scripts/check-md-emphasis.sh <path>` → `scripts/check-md-emphasis.sh (言い換えた)` へ置換して回した。

```
NG  docs/instructions/templates/M{N}-{NN}-{slug}.template.md §7.4 から手順の本文が消えた
  期待するパターン: scripts/check-md-emphasis.sh <path>
  言い換えただけなら本スクリプトの TEMPLATE_RULE_PATTERN を追随させること

結果: 違反 1 件
EXIT=1
```

### 2.3 後始末（**ハッシュで確認**）

`git checkout` / `git restore` は `.claude/settings.json` の `deny` により実行できない。
**⇒ 事前にスクラッチへ退避し、`cp` で戻して `sha256sum -c` と `git diff` で確認した。**

```
$ sha256sum -c before.sha
.claude/commands/incorporate_plan.md: OK
$ sha256sum -c tpl-before.sha
docs/instructions/templates/M{N}-{NN}-{slug}.template.md: OK
$ git diff --stat -- <両ファイル>
（空）
```

**⇒ 2 本とも 1 バイトも変わっていない。** 戻したあと本検査は再び `違反なし` / `EXIT=0`。

---

## 3. D2 — 旧ポートを持つ雛形とコメント

### 3.1 ★同型は 2 か所ではなく **8 か所**あった

指示は 2 か所（`add_e2e_spec.md:91` と `m12-06-presence-detection.spec.ts:17-19`）を名指しし、
**「★同型が他に無いかを走査してください」** と求めていた。走査の結果 **6 か所が追加で見つかった**
（雛形 1 か所 ＋ spec 7 本 = 計 8 か所。うち名指しは 2 か所）。

| # | ファイル | 何が旧か | 措置 |
|---|---|---|---|
| 1 | `.claude/commands/add_e2e_spec.md` 雛形 | 旧ポート | **是正**（指示の名指し） |
| 2 | `web/e2e/m12-06-presence-detection.spec.ts` | 旧ポート ＋ ブラウザ未導入 | **是正**（指示の名指し） |
| 3 | `web/e2e/m12-06-draft-promotion.spec.ts` | 旧ポート ＋ ブラウザ未導入 | **是正** |
| 4 | `web/e2e/m12-05-seed-cleanup-and-controller-resolve.spec.ts` | 旧ポート ＋ ブラウザ未導入 | **是正** |
| 5 | `web/e2e/character-default.spec.ts` | 旧ポート | **是正** |
| 6 | `web/e2e/combo-custom-states.spec.ts` | 旧ポート | **是正** |
| 7 | `web/e2e/m12-03-oki-starter-validation.spec.ts` | ブラウザ未導入（ポートは無し） | **是正** |
| 8 | `web/e2e/m15-03-recipe-input.spec.ts` | ブラウザ未導入（ポートは無し） | **是正** |

**★7 番・8 番は `grep "47318\|5173"` では出ない。** 旧ポートを持たず
「**製造環境はブラウザ未導入のため未実行**」だけを持つ形である。
**⇒ 指示の走査式だけでは取りこぼす。** `grep -rn "ブラウザ未導入"` を追加で回して見つけた。
**★指示 D2-2 はこの記述も是正対象として名指ししている**ので、同じ措置を採った。

**★判断の根拠**（自己判断で進めた理由。`CLAUDE.md` §9 共通原則 1 / 3）——
完了条件 4 が **「走査で同型が残っていないことが示されている」** を求めており、
名指しの 2 か所だけを直すと条件を満たせない。いずれもコメントのみで挙動に触れない。

### 3.2 直した内容

雛形（`add_e2e_spec.md`）は **ポートを差し替えるだけにしなかった**。
指示が **「使い捨てスタックであり dev DB・dev サーバに影響しないことが伝わる形に」** を求めているためである。

```typescript
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//       (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//       DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//       ⇒ dev 側の状態(既存データ件数・開発者が最後に選んだ既定キャラ等)を仮定しないこと。
```

**★「既定は」と「worktree ごとにオフセットされる」を入れた。**
`web/playwright.config.ts:13-14` / `:29` の値は **worktree の dev ポートから決定的に導出される**ので、
`47390` / `5273` は固定値ではなく既定値である。**旧記述と同じ「固定値だと信じさせる」誤りを繰り返さないため。**

雛形の直後へ 2 つの禁止を足した（**雛形が複製する以上、雛形の隣に書くのが効く**）。

- **ポート番号を spec 本文へハードコードしないこと**（値は `playwright.config.ts` が持つ）
- **「ブラウザ未導入のため未実行」と書かないこと**（Chromium はプリインストール済み）

spec 側 7 本も同じ本文へ揃えた。`マイグレ 000017 適用済み` は
**使い捨て DB で毎回自動適用される**ため落とした（現行では前提ではなく自動である）。

### 3.3 走査の残置と、その弁別

再走査の結果、**同型は 0 件**。残るヒットは **すべて現行の dev スタックの実値**であり旧ポートではない。

| 残置 | なぜ直さないか |
|---|---|
| `web/vite.config.ts:7,11,13,37` | `47318` / `5173` は **dev の実既定値**。E2E とは別のスタック |
| `web/src/features/config/useConfig.test.ts` ／ `useUpdateConfig.test.ts` | config DTO のフィクスチャ。dev 既定値そのもの |
| `README.md:30,33,36` ／ `scripts/dev-throwaway-db-guide.md:42` | **dev サーバの起動手順**。E2E の話ではない |
| `web/playwright.config.ts:158` | **「通常の dev サーバ(5173)と共存でき」** = 正しい記述 |
| `web/e2e/m22-06-connection-qr.spec.ts:29` `LAN_PORT = 47318` | **意図的**。注入する偽 LAN URL のポートで、直前 5 行のコメントが理由を説明済み |
| `docs/` 配下（完了報告・設計伝達レポート・board・handover） | **歴史記録**。書き換えない（`D-274` (3)） |
| `docs/design/testid-convention.md:62` | **`docs/design/` は編集禁止**（`CLAUDE.md` §8 / 本手番の前提）。§6-2 で請求 |

---

## 4. E2E（**実測**）

```
$ make e2e-only P=m12-06
Running 3 tests using 1 worker
  ✓  1 e2e/m12-06-draft-promotion.spec.ts:26:3 … isDraft=false が永続化 (2.2s)
  ✓  2 e2e/m12-06-presence-detection.spec.ts:98:3 … 他の全 nullable 項目が保持される (693ms)
  ✓  3 e2e/m12-06-presence-detection.spec.ts:122:3 … 当該のみ NULL・他項目は保持 (639ms)
  3 passed (1.1m)
```

**★触った面は全部回した**（指示 D2-4 は `m12-06` のみを求めているが、7 spec を触ったため）。

```
$ make e2e-only P="character-default combo-custom-states m12-05 m12-03 m15-03"
Running 8 tests using 1 worker
  ✓ 1..8 （character-default 2 / combo-custom-states 1 / m12-03 2 / m12-05 2 / m15-03 1）
  8 passed (33.1s)
```

**⇒ 触った 7 spec の全 11 テストが緑。** コメントのみの変更なので想定どおりだが、実測で確かめた。

**★副産物 = `make e2e-only` の `P` に `|` を渡せない。** §6-4 に記す。

---

## 5. 検査（**★最後に回した。終了コードではなくコマンド自身の出力で判定**）

`M30-01` の教訓 3 に従い、**すべてのファイルを置き終えてから**回した。

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh`（**1 本目**） | `EXIT=0` **結果: 違反なし**。自己検査 **15 件** / ALLOW 除外 1 件 |
| `check-stop-discipline.sh` | `EXIT=0` **結果: 違反なし** |
| `check-progress-log-index.sh` | `EXIT=0` **結果: 違反なし**（検査 **84 件**すべてが progress-log に現れる。ALLOW 除外 17 件） |
| `check-completion-report-md-emphasis.sh`（**新設**） | `EXIT=0` **結果: 違反なし**（CLI 4 本 ＋ テンプレート） |
| `check-instruction-format.sh` | `EXIT=0` **結果: 違反なし**（ベースラインどおり） |
| `check-doc-refs.sh` | `EXIT=0` **結果: dead reference なし** |
| `check-browser-storage-keys.sh` | `EXIT=0` **結果: 違反なし**（台帳と実装が一致） |
| `check-enum-sync.sh` | `EXIT=0` **結果: ベースラインどおり**（増加なし） |
| `check-import-order.sh` | `EXIT=0` **結果: 違反なし**。**★ベースラインより 1 ファイル少ない**（101 → 100）。**本手番と無関係**——走査範囲は `web/src/` のみで、`git diff --name-only a6a072f..HEAD -- web/src` は **0 件**。§6-6 に記す |
| `check-md-emphasis.sh`（常時走査） | `EXIT=0` **結果: 違反なし**（ベースラインどおり。**走査範囲・`BASELINE_BROKEN` は未変更**） |
| `check-md-emphasis.sh <本報告>`（ファイル引数モード・`D-775`） | `EXIT=0` **検出 0 行**。**★初回は 1 行検出した**（`」**だけ` = 閉じ `**` の直前が約物）**。⇒ 自分で直した**（`「**…**」だけ` へ） |
| `check-derived-docs.sh` | `EXIT=0`（**情報提供型**）。`code-facts` 18% ／ `docs-map` 11% ／ `custom-commands` 38% が **陳腐化疑い**。**★いずれも本手番より前からの状態**。§6-6 に記す |
| `check-doc-inventory.sh` | `EXIT=0`（**情報提供型**）**結果: 型に無いファイルなし**（本完了報告は既存の型に合致） |

**★`check-md-emphasis.sh` の走査範囲・`BASELINE_BROKEN` は 1 文字も触っていない**（本手番の「やらないこと」）。

---

## 6. 設計卓・開発者への請求事項

### 6-1. ★★先行資料 3 つの「5 本」「マーカーを置いた（○）」が事実と違う

§1.1 のとおり、**テンプレートにマーカーは一度も入っていない**（`git log -S` で 0 件）。
`followup-backlog.md` の本表は **編集禁止**（`D-382`。製造が書けるのは §J のみ）なので、
**製造は 1 文字も直していない。⇒ 設計卓の手番として訂正を請う。**

あわせて **判断を 1 つ請う**——**テンプレート §7.4 へマーカーを足すか。**

- **足す場合**: 本検査のブロック 2 をブロック 1 へ統合でき、**文言依存が消える**（本文パターンより強い）
- **足さない場合**: 現状の 2 ブロック構成のまま。**テンプレート §7.4 を書き換えるときは `TEMPLATE_RULE_PATTERN` の追随が要る**

**★製造は足していない。** 本手番の「やらないこと」が **マーカーの増減**を禁じているためである。

### 6-2. `docs/design/testid-convention.md:62` に旧ポートの原文が残る

`CHANGE-171`（2026-09-08）が `:55` へ **「旧記述は失効した」** という打消しバナーを置いたが、
**`:62` の原文**——**「ポート 47318(backend)と 5173(vite)が利用可能であること」「`reuseExistingServer: true` のため、起動済みなら再利用」**——**はそのまま残っている**。

**★バナーと原文が同居しており、`:62` だけを読んだ人は旧前提を信じる。**
**⇒ `docs/design/` は編集禁止のため製造は触っていない。設計卓の手番。**

### 6-3. ★`.claude/commands/add_e2e_spec.md` §3-3 が、畳んだはずの運用を今も指示している

同ファイル §3-3 は **「`docs/design/testid-convention.md` の『付与済み一覧』を Edit で更新」** を指示している。
しかし **`CHANGE-171` がその一覧運用を畳んだ**（`D-782` で開発者承認）。
現行の `testid-convention.md` は **「本表は全数ではない」「新規付与時に本表を更新する義務は無い」** と明記している。

**⇒ CLI が設計書に反する手順を指示している状態であり、このコマンドを使うたびに複製される。**
**★D2 と同型**（陳腐化した雛形が陳腐化を複製する）**だが、旧ポートの件ではないので射程外として直していない。**
**⇒ §3-3 を削るか書き換えるかは `CHANGE-171` を起票した側の判断であり、判断を請う。**

### 6-4. `make e2e-only P=<正規表現>` に `|` を渡せない

`Makefile:179` が `cd web && pnpm e2e $(P)` と **クォートせずに展開**するため、
`P="a|b"` はシェルのパイプとして解釈され **`Error 127` ＋ `EPIPE`** で落ちる。

**★エラーメッセージが原因を示さない**（Node のスタックトレースが出る）ため、
**テストが落ちたと誤読しうる。** 回避は **空白区切り**（`P="a b c"`。本手番はこれで回した）。
**⇒ 実害は小さいが、`$(P)` をクォートするか、使い方の例へ「`|` は使えない」を 1 行足すかの判断を請う。**

### 6-6. 情報提供型の検査が出した 2 件（**いずれも本手番と無関係の既存状態**）

- **`check-import-order.sh` が「ベースラインより 1 ファイル少ない → BASELINE を 100 へ下げること」と出す。**
  **★本手番は `web/src/` を 1 ファイルも触っていない**（`git diff --name-only a6a072f..HEAD -- web/src` = **0 件**。同検査の走査範囲は `web/src/` のみ）**。⇒ 先行サブが下げた分である。**
  **★ベースラインを下げるのは本手番の射程外とした**——他の検査の床を、原因を作っていない手番が動かすと、
  **誰がいつ下げたのかが追えなくなる。⇒ 下げる手番の判断を請う。**
- **`check-derived-docs.sh` が 3 件を「陳腐化疑い」と出す**（`code-facts` 18% ／ `docs-map` 11% ／ `custom-commands` 38%）**。**
  **★`custom-commands` の源泉最終コミットは本手番のコミットである**（`.claude/commands/add_e2e_spec.md` を触ったため）。
  **ただしコマンドの新設・削除はしていないので掲載内容は変わっていない。**
  **★3 件とも本手番より前から ⚠ である。**

### 6-5. `followup-backlog.md` の 2 行の状態更新

`completion-report-md-emphasis-marker-unchecked` と `add-e2e-spec-template-stale-ports` は
いずれも **未着手 → 本手番で解消**。**製造は本表を編集していない**（`D-382`）。**⇒ 設計卓の畳み込みを請う。**

`claude-md-e2e-isolation-claim-false-both-ways` の **★(2) と ★(3)** も本手番で解消した
（同行の ★(1) = `testid-convention.md` は §6-2 のとおり残る）。

---

## 7. やらなかったこと（射程外として意識的に外したもの）

- **`check-md-emphasis.sh` の走査範囲・`BASELINE_BROKEN`**（「やらないこと」。レンダラ版の固定は開発者の判断待ち）
- **`docs/design/` の編集**（「やらないこと」。§6-2 で請求）
- **`followup-backlog.md` 本表の編集**（`D-382`。§6-1 / §6-5 で請求）
- **マーカーの増減**（「やらないこと」。§6-1 で判断を請う）
- **`add_e2e_spec.md` §3-3 の是正**（§6-3。D2 の射程外）
- **`_wt` 版 4 本への追記**（基底コマンドを読む薄いラッパで本文を複製しない。C1〜C3 で実物確認済み）

---

## 8. 変更ファイル

| ファイル | 種別 | 内容 |
|---|---|---|
| `scripts/check-completion-report-md-emphasis.sh` | **新規** | D1 の検査本体（`--self-test` 7 対照つき） |
| `CLAUDE.md` | 変更 | §8 常設検査表へ 1 行 |
| `.claude/commands/add_e2e_spec.md` | 変更 | 雛形を現行スタックへ ＋ 禁止 2 件 |
| `web/e2e/*.spec.ts` （7 本） | 変更 | 冒頭の環境前提コメント |
| `docs/progress/20260908-improvement-lane-d1-d2-completion-report.md` | **新規** | 本書 |
| `docs/progress/progress-log.md` | 変更 | 索引行 1 行 |

**★`check-artifact-integrity.sh` は変更していない**（glob で自動発見するため。§1.4）。

---

*以上*
