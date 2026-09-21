# M40-01 完了報告 — 帰属と宣言の是正

| 項目 | 内容 |
|------|------|
| 作業 ID | `M40-01` |
| 指示書 | `docs/instructions/M40-01-attribution-and-declarations.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M40-01-review-checklist.md` **v1.1.0** |
| 上位 | `docs/instructions/M40-overview.md` **v1.0.0** |
| 実施日 | 2026-09-20 |
| ブランチ | `claude/focused-cannon-arp5uy` |
| 枝元のコミット | `c788714` |
| CHANGE 消費 | **0 本**（★自採番しない＝`D-293`。**原稿 2 本を設計伝達レポート §1 / §6 へ出す**） |
| マイグレ消費 | **0 本** |

---

## 0. 着手前の版ゲート（指示書 §0.5・完了条件 12）

| # | 確かめたこと | 結果 |
|---|---|---|
| 1 | チェックリストの存在 | **在り・v1.1.0** |
| 2 | 上位 `M40-overview.md` が v1.0.0 | **v1.0.0**（ヘッダ実査） |
| 3 | `web/src/components/ui/` の件数を実査 | **21 件**（§1.1 で 19 との食い違いを解消） |
| 4 | `public-snapshot-manifest.txt` が `ALLOW docs/**` | **L104 で確認**（変わっていない） |
| 5 | `check-public-snapshot.sh` が EXIT=0 | **EXIT=0 / 母数 3095・公開 3082・除外 13・違反なし** |
| 6 | 枝元のコミット | `c788714` |

---

## 1. 段 1 — shadcn/ui の帰属（射程 1）

### 1.1 対象ファイルの全数（★実査。21 / 19 を引き写していない）

出力をファイルへ落として計数した。

```
$ find web/src/components/ui -type f | sort > /tmp/ui-files.txt && wc -l < /tmp/ui-files.txt
21
$ awk -F'","' 'NR>1 && $2=="file"{print $1}' \
    docs/progress/evidence/m26-04-scanoss/scan-matches-initial.csv | tr -d '"' | sort -u | wc -l
19
```

| 母集団 | 件数 |
|---|---:|
| `web/src/components/ui/` 配下の追跡ファイル | **21** |
| ＋ `web/src/lib/utils.ts` | **22** |
| SCANOSS の `Id=file`（完全一致） | **19** ＝ `ui/` の 18 件 ＋ `utils.ts` |
| SCANOSS の `Id=snippet`（高率） | **3** ＝ `sheet.tsx` 96% ／ `alert-dialog.tsx` 95% ／ `dialog.tsx` 93% |

**⇒ 22 = 19 + 3。取りこぼしは 0 件である。**

**★食い違いの原因を特定した。** その 3 件だけが本体側で `ModalPresenceMarker` を import しており、ファイルハッシュが崩れて `file` 一致にならなかった。**⇒ 19 は「対象が 19 件」ではなく「完全一致が 19 件」である。**

**★副次の観測を 1 件残す。** `sonner.tsx` は本体側で改変されている（`theme="light"` 固定 ＋ `lucide-react` のアイコン注入）のに `file` 100% 一致であった。**⇒ SCANOSS の `file` 100% は「上流と逐語で同一」を意味しない。** 件数の解釈に影響しないが、次にこの数字を読む人のために書いておく。

### 1.2 根拠（`web/components.json` の `$schema`）

```json
"$schema": "https://ui.shadcn.com/schema.json",
```

これが shadcn/ui 由来であることの根拠である（`M26-03` の実測と一致）。取得経路は M7 での shadcn/ui CLI 導入。

### 1.3 帰属の置き場＝`NOTICE` に §6 を新設した（**開発者確定・2026-09-20 Plan Mode**）

**★採った形と理由。**

| # | 理由 |
|---|---|
| **★★★1** | **`NOTICE` は既に配布アーカイブへ同梱されている。** `scripts/release-targets.sh` の `RELEASE_EXTRA_FILES` に入っており、`check-release-archive.sh` が**アーカイブ内での存在を機械で確かめている**。**⇒ MIT が求める「コピーに含める」が*配布物の側*で担保される。** 新規ファイルを立てる場合は `release-targets.sh` と `public-snapshot-manifest.txt` の両方へ足さないと、**宣言だけ在って配布物に入らない**状態になる |
| **★★2** | **`NOTICE` §5 の生成源泉を広げる案は採らなかった。** §5 は `go.mod` / `web/package.json` を源泉とする**依存の棚卸し**であり、**コピーして持ち込んだものが載らないのは構造的に正しい**（指示書 §0.2 の機序）。**⇒ 混ぜると §5 の意味が壊れる。** 別節にして、§6 の冒頭でその切り分けを明記した |
| **★3** | `NOTICE` は `ALLOW` 済みで、`LICENSE` と `REUSE.toml` の双方から参照されている |

**★何を書いたか。** `Copyright (c) 2023 shadcn` を逐語で置き、**MIT の許諾・免責条項を全文インラインで**掲げた。対象パスと件数、取得経路、改変 4 件、上流 URL と参照日を併記した。

**★逐語の一次情報を直接確認した。** 外部照会結果（`docs/progress/20260920-shadcn-license-external-inquiry-report.md`）が述べる `Copyright (c) 2023 shadcn` を、上流の `LICENSE.md` を取得して確認した。

- `https://github.com/shadcn-ui/ui`
- `https://github.com/shadcn-ui/ui/blob/main/LICENSE.md` （2026-09-20 参照）

**⇒ 二次情報を一次情報として書かない**（`M36-02` §7-1 の教訓）。

### 1.4 `TODO(外部照会)` は 1 つも置いていない

外部照会は 2026-09-20 に返っている（`D-922`）。**決まっているのは「何を保持するか」と「各 `.tsx` のヘッダである必要は無いこと」であり、決まっていないのは「本 repo のどのファイルへ書くか」だけであった。⇒ それは §1.3 で決めた。**

**★「You own the code」を表示保存の免除の根拠にしていない。** 照会結果 §1-3 は「免除する正式な追加許諾であることは確認できなかった」と結論している。**⇒ 表示を維持した。**

### 1.5 `REUSE.toml` にも宣言した（理由つき）

**宣言した。** 理由＝`NOTICE` は人が読む帰属であり、**パス単位の割当の正本は `REUSE.toml` である**（同ファイル L3-4 の方針＝パス単位の宣言に集約する）。片方だけでは、どちらかを見た人が取り違える。

**★改変 4 件があるため著作権者を並記した。** `dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` が `ModalPresenceMarker` を import し、`sonner.tsx` がアイコンとテーマを差し替えている。**⇒ 派生物であるから `["2023 shadcn", "2026 plexiblinp"]` とした。**

### 1.6 射程を広げていないこと

| 対象 | 実査の結果 | 判断 |
|---|---|---|
| **Radix UI** | `package.json` 依存として `NOTICE` §5 の母集団に居る。バンドル側は `release-zip-missing-license-files` が 2026-09-16 に解消済み（7 件同梱） | **広げない**（指示書 §3-10 ／ 照会結果 §1-5） |
| **`web/src/features/combo-io/export-image/{capture,pdf}.ts`** | **実査した。** 冒頭コメントの逐語＝「出典: `autopilot-combomgr/projects/combo-export-image` … **本プロジェクトの先行内製成果物**（LICENSE ファイル無し＝本体ライセンス下に取込）」 | **第三者素材ではない。⇒ 射程外。** ランタイム依存の `html-to-image` / `pdf-lib` は §5 の母集団に居る |
| **`web/src/` のコード** | 1 行も触っていない | `M40-02` の面（E-4） |

---

## 2. 段 2 — 三層へ来歴の軸を足した（射程 2・**本命**）

### 2.1 現行の三層へ*実際に当てはめた*結果（★述べるだけにしていない）

`REUSE.toml` の全ブロックの `SPDX-FileCopyrightText` を実査し、対象パスを当てはめた。

| 対象 | 現行の解決先 | 宣言される著作権者 | 判定 |
|---|---|---|---|
| `web/src/components/ui/**` ＋ `web/src/lib/utils.ts` | ブロック(1) `path = "**"` → **層 A `AGPL-3.0-or-later`** | **`2026 plexiblinp`** | **✗ 第三者の著作物に本体の著作権表示を付けている** |
| `docs/seed-data/**` | ブロック(3) → **層 B `CC-BY-SA-4.0`** | **`2026 plexiblinp and the Tacpendium contributors`** | **✗ 第三者素材を含むと自分で判定した範囲に、自分の表示と継承許諾を付けている** |
| 層 C（`MIT`） | — | **`2026 plexiblinp`** | **✗ 受け皿にならない。層 C の MIT は「本 repo の MIT」であって「第三者の MIT」ではない** |

**★★★したがって「置く場所が無い」という言い方は不正確である。⇒ 正確には「どこへ落ちても著作権者の宣言が偽になる」である。**

**★★しかも既定は `path = "**"` である。⇒ 次に第三者素材を持ち込んでも、黙って層 A へ落ちて `© plexiblinp / AGPL` と宣言される。** どの検査も赤くならない（`D-777` の一般形）。

### 2.2 採った形＝**(a) 軸を足す**（開発者確定・2026-09-20 Plan Mode）

**★理由。**

| 案 | 評価 |
|---|---|
| **(a) 軸を足す** | **採用。** 三層は*内容*の分類であり、来歴はそれと**直交**する。直交する軸を層として畳まないほうが、層の定義もパスの振り分けも 1 つも変えずに済む |
| (b) 層を足す | **不採用。** 層 D の中身が「shadcn の MIT」と「seed-data の配布不可」のように**互いに無関係なものの寄せ集め**になる（ライセンスも公開可否も揃わない）。**⇒ 性質の異なる第三者素材が来るたびに層を増やす圧力がかかる** |
| (c) 宣言だけ | **不採用。** 次に持ち込んだとき誰も気づかない。**⇒ チェックリスト B-3 が要求する答えを機械で用意できるなら (a) でも同じ答えが出せるため、わざわざ設計書に何も残さない形を選ぶ理由が無い** |

**★(c) を採っていないが、B-3 の問い**〔次に第三者素材を持ち込んだとき誰が気づくか〕**にも答えておく。⇒ `scripts/check-third-party-attribution.sh` である**（§2.4）。**★ただし同検査の限界は「宣言された範囲が実態と合っているか」までであり、*宣言されていない第三者素材が新しく持ち込まれたこと*は検出できない。⇒ そこに oracle は無く、人か外部スキャン**（SCANOSS）**の仕事である。同じことをスクリプトの限界節にも書いた。**

### 2.3 軸の定義（`DES-001` §5 の原稿は設計伝達レポート §1 / §6 へ）

> 三層は「何の内容か」で切る軸である。これと**直交する軸として「誰の著作物か（来歴）」を置く**。`SPDX-FileCopyrightText` が `plexiblinp` 以外になるファイルは、層の割当より先に来歴で宣言する。種別は 2 つ。
> - **T1 第三者の許諾の下で同梱・再配布するもの** → 上流のライセンスと著作権者をそのまま宣言する。
> - **T2 第三者素材を含むが配布しないもの** → `LicenseRef-` で「配らない範囲」を宣言し、公開スナップショットの `DENY` と同じことを言わせる。

**★設計書本体は 1 文字も編集していない**（`CLAUDE.md` §8）。**★`CLAUDE.md` §6 の禁止ライセンス列も 1 行も変えていない**（inbound の規定・B-5）。

実装は `REUSE.toml` の (6) である。**★(1) の既定より後ろに置く必要がある**（REUSE 3.3＝同一ファイル内では最後に一致した表だけが使われる）。**⇒ 上へ動かすと既定の層 A へ静かに戻るため、その旨をコメントに書き、検査でも見るようにした。**

### 2.4 機械で守る経路を用意した（段 1-5・**実装した**）

`scripts/check-third-party-attribution.sh`（決定論・read-only・`--self-test` 付き）。

| # | 見るもの |
|---|---|
| R1 | `REUSE.toml` が読め、`version = 1` であること |
| R2 | 来歴ブロック（`SPDX-FileCopyrightText` に `plexiblinp` 以外の権利者を含む表）が 1 つ以上あること |
| **R3** | **来歴ブロックの各グロブが 1 件以上の追跡ファイルに当たること。⇒ `D-777` の穴をここで塞ぐ** |
| R4 | 来歴ブロックが既定ブロック（`path = "**"`）より後ろに在ること |
| R5 | `LicenseRef-` を使うなら `LICENSES/<識別子>.txt` が在り非空であること |
| R6 | `NOTICE` に非 `plexiblinp` の権利者の逐語が在ること |
| **R7** | **`NOTICE` が述べる件数と実測が一致すること。⇒ `web/src/components/ui/` にファイルが増えたのに帰属が古い、を捕まえる** |
| **R8** | **必須被覆。`REQUIRED_PROVENANCE_PATHS` の各グロブに当たる追跡ファイルが、REUSE の「最後に一致した表が勝つ」解決で*来歴ブロックへ解決する*こと。⇒ 宣言を消す・名前を変える・順序を崩す、のいずれでも赤くなる**（★レビュー 高-2 の是正。§8b） |
| **R9** | **`LicenseRef-`（配布しない範囲）の各グロブが、公開スナップショットの `DENY` にも在ること。⇒ 「宣言と `DENY` が同じことを言う」を機械で結ぶ**（★レビュー 中-2 の是正） |

自己検査＝**陰性 2 / 陽性 9**。**★陽性対照は「どの規則が鳴ったか」まで照合する**（★レビュー 高-3 の是正。§8b）。`check-artifact-integrity.sh` が `scripts/check-*.sh` の `--self-test` を機械で見るため、**持たせないと 1 本目の検査が赤くなる**。実際に拾われて緑であることを確認した（§6）。

登録先＝`README.md`（`check-migration-license.sh` / `check-public-snapshot.sh` と同じ場所） ＋ `CLAUDE.md` §8 の常設検査表。

### 2.5 先例の調査（**開発者承認のうえ外部調査を実施**・すべて 2026-09-20 参照）

**★開発者の追加指示＝「他の OSS 等で参考にできるものがあればそれも見る。調査は外部 AI に任せても良い」。⇒ 実施した。**

| # | 分かったこと | 本サブへの反映 |
|---|---|---|
| **★★★1** | **REUSE 仕様 3.3 §License Files の逐語＝"A Project MUST include a License File for every license under which Covered Files are licensed." / "If a license does not exist in the SPDX License List, its SPDX License Identifier MUST be `LicenseRef-[idstring]`"。FAQ #custom-license＝"place your license in the file `LICENSES/LicenseRef-MyLicense.txt`"** | **`LICENSES/LicenseRef-Tacpendium-NotForDistribution.txt` を置いた根拠。★初稿では「一次情報で確認できなかった」と書いていたが、調査が source markdown を一次情報として取得したため逐語へ差し替えた** |
| **★★★2** | **REUSE には「リポジトリに在るが配布しない」を表す仕組みは無い**（明確な否定的発見）**。FAQ #exclude-file の逐語＝"you cannot exclude files from REUSE compliance testing" / "If you have an entire directory that you want to 'exclude' … you can use `REUSE.toml`"** | **⇒ REUSE の答えは「除外」ではなく「注釈」である。★T2 はその形に従っている。★この否定的発見を `LicenseRef-*.txt` 本文へ明記した** |
| **★★★3** | **`LICENSES/MIT.txt` に具体的な著作権者名を入れる問題を、REUSE FAQ #license-templates が名指しで扱っている。逐語＝"Instead of inserting your copyright notice into the license text itself, you add copyright statements to your project's files" / "put the unmodified license text … in your `LICENSES/` folder"。★実在の REUSE 準拠リポ 5 本がいずれもテンプレートのまま**〔`fsfe/fsfe-website` ／ `KDE/kdenlive` ／ `KDE/plasma-desktop` ／ `KDE/krita` ／ `SecPal/frontend`〕 | **★開発者へ諮り、確定を得て `Copyright (c) <year> <copyright holders>` へ戻した**（§5） |
| **★★4** | **`SecPal/frontend` が本 repo とほぼ同じ構成である**〔AGPL-3.0-or-later ／ REUSE ／ shadcn vendored 27 件〕**。⇒ `REUSE.toml` の `[[annotations]]`（`precedence = "aggregate"`）＋ `THIRD-PARTY-NOTICES.md` ＋ ファイル先頭の自分の SPDX ヘッダ ＋ Vitest の provenance テスト** | **★本 repo は `precedence = "override"` を採る**（`D-702` (f)＝パス単位の宣言に集約し、ファイル 1 本ずつの SPDX ヘッダを書かない）**。⇒ `aggregate` はファイル内ヘッダと併用する形であり、本 repo の方針と噛み合わない。★また `web/src/` は `M40-02` の面であり触れない**（E-4） |
| **★★5** | **`NOTICE` へライセンス全文をインラインで持つ形は実在する**〔`kubernetes`（コンポーネントごとに全文 ＋ md5 の trailer） ／ `JoshMayerr/btcp-ui`（1 文 ＋ MIT 全文）〕**。一方 `apache/kafka` は「copied from X:」＋パス列挙で全文は共有ディレクトリへ参照、`elastic` / `grafana` はルート NOTICE に何も列挙しない** | **★本サブは「全文インライン」を採った。⇒ 層 C の MIT と第三者の MIT を取り違えさせないためである**（§5 と同じ根） |
| **★★6** | **ASF の方針の逐語＝"Do not add the standard Apache License header to the top of third-party source files." / "Make sure that every third-party work includes its associated license"** | **★本サブがファイル先頭へ書かない形を採ったことと整合する**（照会結果 §1-2 とも一致） |
| **★★★7** | **広く使われている AGPL/OSS 製品で shadcn を vendored しているもの 9 本**〔`documenso` ／ `openstatus` ／ `twenty` ／ `formbricks` ／ `dub` ／ `unkey` ／ `teable` ／ `glasskube/distr` ／ `cal.com`〕**は、帰属の成果物を 1 つも持っていなかった**（`NOTICE` / `THIRD_PARTY_NOTICES` 等が全滅で 404。ファイル先頭のヘッダも無し） | **★「他がやっていないから要らない」とは読まない。⇒ 指示書 §0.1 のとおり、直す理由は「帰属が要るから」であって「他がやっているから」でも「スキャナが黙るから」でもない。★事実として報告に残す** |
| **★8** | 上流の docs にあった "No attribution required" は削除されている（`shadcn-ui/ui` discussion #2339 で指摘され、PR #6605 で除去） | 照会結果 §1-3 と整合する |

**★調査の限界（そのまま残す）。** `grep.app` / `sourcegraph.com` / `searchcode.com` と GitHub の code search が本環境の egress で塞がれていたため、**#7 の母集団は網羅的な走査ではなく候補の手当たりである**。`reuse.software` 本体も塞がれていたため、**同ページを生成している source markdown**（`fsfe/reuse-website@master`）**を一次情報として引いた。**

---

## 3. 段 3 — `name_ja` の取得経路（射程 3）

**正本は `NOTICE` §2 に置いた。** 1 句ではなく 1 段落になったが、既存の「手入力と観測に基づく事実情報」の直後に置いて同じ原則であることを示している。

**★「独自表記 ／ 公式表記」の軸では書いていない**（followup の明示的な禁止）。**⇒ 分かれ目は取得経路であると書いた。**

**★`DATA-LICENSE.md` §5 には参照を 1 行だけ置いた**（`E-76`＝二重に書かない）。**⇒ 正本は `NOTICE` §2 であり、本書では繰り返さない、と明記している。**

---

## 4. 段 4 — `REUSE.toml` の「暫定」を外した（射程 4）

### 4.1 外せた。ただし現状維持のままでは外せなかった

`REUSE.toml:73-77` の暫定コメントが名指しした再判定は **`M26-03` で完了済み**（完了報告 §4.1 / §4.3・2026-09-11）＝**3 件（＋境界 1 件）に第三者素材が現存する**。

**⇒ 「暫定」を外す条件は*宣言を実態へ合わせること*であって、注記を消すことではない。**

| 案 | 評価 |
|---|---|
| A. 層 A へ落とす | **悪化する。** 層 A も `plexiblinp` の表示であり、**問題が層を移動するだけ**である |
| **B. `LicenseRef-` で宣言する** | **採用**（`M26-03` の推奨と一致） |
| C. 現状維持 | **注記が既に 1 度「再判定せよ」と送っている。⇒ 答えないと注記だけが残る** |

### 4.2 実装

- ブロック(3)（層 B）のパス列から `docs/seed-data/**` を抜いた
- (6-T2) として `SPDX-License-Identifier = "LicenseRef-Tacpendium-NotForDistribution"` を宣言した
- `LICENSES/LicenseRef-Tacpendium-NotForDistribution.txt` を新設した（REUSE 仕様が本文ファイルを要求する。§2.5-1）
- `scripts/release-targets.sh` の `RELEASE_EXTRA_FILES` へ同本文を足した。**★`REUSE.toml` は配布アーカイブへ同梱され新しい識別子を参照する。⇒ 本文が無いと*配布物の中で宣言が宙に浮く***（同ファイルの既存注記＝「LICENSES/ 配下に全本文が揃っている前提のツールがあり、欠けると `REUSE.toml` の宣言と実態がずれる」）
- `scripts/public-snapshot-manifest.txt:26` の注記「★`M26-03`(A3) で再判定する」を**再判定の結果へ追随させた**（C-3）

**★層 B の対象定義が変わるため `DES-001` §5.1 に差分が出る。⇒ CHANGE 原稿を設計伝達レポートへ出す。**

---

## 5. `LICENSES/MIT.txt` をテンプレートへ戻した（★本サブの射程外・開発者確定）

**★帰属の置き場を決める過程で出てきた。** `LICENSES/MIT.txt` の本文が逐語で `Copyright (c) 2026 plexiblinp` を持っており、**第三者（shadcn）の MIT と本 repo（層 C）の MIT が同居するため、どちらの MIT かが本文から決まらない**状態だった。

**⇒ 開発者へ諮り、確定を得て `Copyright (c) <year> <copyright holders>` へ戻した**（根拠は §2.5-3）。**★層 C の著作権表示は失われない。`REUSE.toml` の `SPDX-FileCopyrightText` が正本である。**

`NOTICE` §6 の該当段も追随させた（「本 repo 自身の MIT の表示」→「著作権表示を含まないテンプレート」へ。**⇒ なぜ §6 が MIT 条項を直接掲げるのかの説明も書き直した**）。

---

## 5b. ★★★22 ファイルの outbound 宣言が `AGPL-3.0-or-later` から `MIT` へ変わった

**★初稿はこの事実を 1 行も書いていなかった**（レビュー 高-4）**。⇒ 採用して書く。**

| | `web/src/components/ui/**` 21 件 ＋ `web/src/lib/utils.ts` |
|---|---|
| **変更前** | ブロック(1) `path = "**"` → **`AGPL-3.0-or-later`** ／ `SPDX-FileCopyrightText = "2026 plexiblinp"` |
| **変更後** | (6-T1) → **`MIT`** ／ `SPDX-FileCopyrightText = ["2023 shadcn", "2026 plexiblinp"]` |

**★これは inbound ではなく outbound の変更である。⇒ 受け取った人が、この 22 ファイルを MIT の条件で使えるようになる。**

**★★2 つに分けて見る必要がある。**

| 区分 | 件数 | 何が起きるか |
|---|---:|---|
| **上流の内容のままのもの** | **18**（`ui/` 17 件 ＋ `web/src/lib/utils.ts`） | **本 repo が著作した実質は無い**（`utils.ts` は整形の差があるのみで、6 行の `cn()` に本 repo の創作は無い）**。⇒ 宣言が上流の事実**（MIT / shadcn）**へ一致しただけであり、手放したものは無い。★むしろ変更前のほうが偽であった**——**他人の著作物に本 repo の著作権表示と AGPL を付けていた** |
| **本 repo で改変したもの** | **4**（`dialog.tsx` ／ `alert-dialog.tsx` ／ `sheet.tsx` ／ `sonner.tsx`） | **★本 repo の改変分も MIT で提供する宣言になる。⇒ ここだけは*手放す側*の変更である** |

**★改変の実体**（実査）＝前 3 件は `ModalPresenceMarker` の import と 1 行のラップ、`sonner.tsx` は `theme` の固定と `lucide-react` アイコンの差し替え。**⇒ 分量は小さい。★ただし「小さいから問題ない」は法務の判断であり、製造が決めることではない**（`CLAUDE.md` §10）。

### 5b.1 なぜこの形になったか（★製造が勝手に決めたのではない）

| # | 根拠 |
|---|---|
| 1 | **開発者確定（2026-09-20 Plan Mode）＝(a) 軸を足す。** その T1 の定義は「**上流のライセンスと著作権者をそのまま宣言する**」である |
| 2 | **外部照会の推奨方針の逐語**＝「自作コード: `AGPL-3.0-or-later` ／ **shadcn/ui 由来コード: `MIT / Copyright (c) 2023 shadcn`**」 |
| 3 | REUSE は 1 つの `[[annotations]]` 表に 1 つの `SPDX-License-Identifier` を持つ。**⇒ 22 件を 1 表で宣言すると、改変 4 件も同じ識別子になる** |

### 5b.2 ★★★開発者の裁定（2026-09-20）＝**現状維持（22 件を 1 表で `MIT`）**

**★諮った理由＝「(a) 軸を足す」の確定は、*改変分を MIT で出すこと*までを名指しで承認したものではなかった。⇒ `roles-and-routing` のハード列（公開・法務）に当たるため返した。**

| 案 | 内容 | 裁定 |
|---|---|---|
| **現状** | 22 件を 1 表で `MIT` | **★★採用。** 最も単純で、外部照会の推奨方針とも一致する |
| 代案 1 | 改変 4 件だけ別表にし `SPDX-License-Identifier = "MIT AND AGPL-3.0-or-later"` | **不採用。** 事実としては最も正確だが、**受け取る側は両方の条件を満たす必要があり、実質は代案 2 と同じ拘束になる。⇒ 正確さと引き換えに読む側の負担だけが増える** |
| 代案 2 | 改変 4 件は層 A（`AGPL-3.0-or-later`）に残し、`SPDX-FileCopyrightText` にだけ shadcn を並記する | **不採用。** 改変分を手放さずに済むが、**「shadcn 由来なのに MIT で取り出せない 4 件」が生まれ、来歴の軸の説明が 1 段複雑になる** |

**★★裁定を支えた実測（諮る際に提示した）。**

| ファイル | 行数 | 本体側の改変 |
|---|---:|---|
| `dialog.tsx` | 129 | **2 行**（`import { ModalPresenceMarker }` ＋ `<ModalPresenceMarker />` 1 個） |
| `alert-dialog.tsx` | 147 | **2 行**（同上） |
| `sheet.tsx` | 144 | **2 行**（同上） |
| `sonner.tsx` | 40 | `theme="light"` 固定 ＋ `lucide-react` のアイコン 5 個を注入 |

**★★★`ModalPresenceMarker` の*実装本体*（`web/src/lib/modal-presence.ts`）は (6-T1) のグロブに当たらない。⇒ 層 A（AGPL）のまま残る。★MIT で出るのは呼び出し側の 2 行であって、ロジックではない。**

**★★取り消せない判断である。** 一度 MIT で配ったものは、後から AGPL へ戻しても既に受け取った人には効かない。**⇒ `REUSE.toml` の (6-T1) コメントへ裁定の事実・採らなかった代案・上記の実測・取り消せないことを書いた。★次に同表を触る人が、判断の重みを知らないまま編集できないようにするためである。**

**⇒ 本件は決着した。`followup-backlog.md` へは登録しない**（再開に必要な条件が無いため）**。記録は設計伝達レポート §4-1 と `REUSE.toml` (6-T1) に在る。**

---

## 6. 段 5 — evidence の公開範囲（射程 5）

### 6.1 ファイル単位の判定表（★実査。一括で決めていない）

40 桁 hex の**全量走査**で計数した（`head` / `tail` で切っていない）。

| # | ファイル | 中身 | 非公開リポの SHA | 公開する値打ち | 公開する損 | 判定 |
|---|---|---|---:|---|---|---|
| 1 | `scan-matches-initial.csv` | SCANOSS 全 81 match・16 列 | **0 件** | **高**。「81 件をこう判断した」を第三者が追検証できる | ほぼ無し。公開 URL と上流識別子のみ（`Version` に含まれる短縮 SHA は*外部*プロジェクトのもの） | **公開** |
| 2 | `scan-unknown-license-priority-initial.csv` | ライセンス空欄の重点 5 件・13 列 | **0 件** | 中。トリアージの根拠 | 無し。ハッシュは*外部*ファイルの MD5 | **公開** |
| 3 | `scan-anomalous-license-priority-initial.csv` | 異常表示の重点 2 件・13 列 | **0 件** | 中。同上 | 無し | **公開** |
| 4 | `scan-review-chronology-initial.csv` | 時系列判定 58 行・10 列（`Matched-project-first` 47 ／ `Tacpendium-first` 11。対象は `web/src` 54 行・`internal/service` 2 行・`internal/api` 2 行） | **一意 21 件** ＋ `TacpendiumAdded`＝非公開リポの author date（2026-04-30 〜 09-05） | **低。⇒ 公開リポにその SHA は存在せず、第三者は 1 件も検証できない** | **高。どのファイルが、いつ、どの commit で入ったかという*非公開開発履歴の部分地図*である** | **`DENY`** |
| 5 | `docs/progress/M26-04-scanoss-followup-report.md` | 追補報告本体 | **3 件** | **高**。SCANOSS の実施と判断の記録そのもの | 中。SHA 3 件のみ | **SHA 3 件だけ伏せ、本文は公開** |

**★★「公開する値打ち」と「公開する損」の両方を書いてある**（D-5）。**⇒ 片方だけなら判定ではない。**

### 6.2 追補報告も同じ判定にかけた（§2.5-4 / D-4）

**★実査で指示書の見込みが 1 件ずれていた。** 指示書 §2.5-4 は「§5.4 / §5.5 に非公開リポの SHA が 2 件」と述べているが、**本文の 40 桁 hex を全量走査したところ一意 9 件**であり、内訳は次のとおりであった。

| 区分 | 件数 | 実体 |
|---|---:|---|
| **非公開リポ（`combomgr`）の SHA** | **3** | ヘッダの「検査対象コミット」 ／ §5.4 の「Tacpendium 側初出」 ／ §5.5 の「Tacpendium 側初出」 |
| 外部プロジェクトの SHA | 6 | 一致先の `tag commit` 4 件 ／ partial clone で取得した外部リビジョン 2 件。**公開情報であり伏せていない** |

**⇒ ヘッダの 1 件は指示書が挙げていなかった。★実査しなければ 1 件残していた。**

### 6.3 実施したこと（★`DENY` の投入は承認後）

**★指示書 §3-3 / チェックリスト D-3 は「承認前に `DENY` を入れない」である。⇒ Plan Mode で候補と根拠を提示し、開発者の確定を得てから入れた。**

- `scripts/public-snapshot-manifest.txt` へ chronology の `DENY` を 1 行追加（理由列に承認日を記載）
- 追補報告の非公開 SHA 3 件を伏せ、**落とした事実と理由を冒頭に注記**した。件数・日付・一致率・外部 MD5・判定・差分統計は 1 つも落としていない。**⇒ 本書の主張は SHA の値を引かずに成立する**（先例＝`M26-03` の `D-823` 処置）
- 追補報告の evidence 一覧に、chronology が `DENY` された旨を注記

**★実測で効いたことを確認した。**

```
（変更前）母数 3095 件 / 公開 3082 件 / 除外 13 件
（変更後）母数 3095 件 / 公開 3081 件 / 除外 14 件
```

### 6.4 ★判断に効く文脈（本サブでは広げない）

**`docs/progress/**` は `ALLOW` であり、完了報告・レビュー報告は日常的に短縮 SHA を引用している**（本報告も §0 で枝元 commit を書いている）。**⇒ ファイル単位の `DENY` は chronology のような*塊*には効くが、`docs/progress/` 全体の SHA 混入には効かない。**

**★あわせて、開発者確定は「SHA 3 件だけ伏せる」であった。⇒ 追補報告に残る非公開リポの*日付***〔§5.4 の 2026-05-24 ／ §5.5 の 2026-04-30 ／ §6 の 2026-05-31 等〕**は伏せていない。** 追補報告 §7.1 が保持対象に挙げるのは「初出 commit SHA **と author date**」の両方であるため、**残差があることを事実として書いておく。⇒ 広げるかどうかは開発者の判断であり、本サブでは広げない。**

---

## 7. 変更したファイル

```
$ git diff --stat c788714 HEAD
 CLAUDE.md                                          |   1 +
 DATA-LICENSE.md                                    |   9 +
 .../LicenseRef-Tacpendium-NotForDistribution.txt   |  71 ++++
 LICENSES/MIT.txt                                   |   2 +-
 NOTICE                                             |  71 ++++
 README.md                                          |  11 +-
 REUSE.toml                                         |  84 ++++-
 docs/progress/M26-04-scanoss-followup-report.md    |  15 +-
 scripts/check-third-party-attribution.sh           | 368 +++++++++++++++++++++
 scripts/public-snapshot-manifest.txt               |   3 +-
 scripts/release-targets.sh                         |   5 +
 11 files changed, 626 insertions(+), 14 deletions(-)
```

**★`E-225` の観点で 1 度読んだ。** 新規のつもりのファイルは 2 本＝`LICENSES/LicenseRef-Tacpendium-NotForDistribution.txt`（**71 行の追加のみ・deletions 0**） と `scripts/check-third-party-attribution.sh`（**368 行の追加のみ・deletions 0**）。**⇒ どちらも `+` だけであり、既存ファイルを上書きしていない。** 作る前に `ls` で同名の有無も確かめている。

deletions 14 行の内訳は既存ファイルの書き換え（`REUSE.toml` の暫定コメント置換とパス列からの 1 行除去 ／ 追補報告の SHA 置換 ／ `LICENSES/MIT.txt` の 1 行 ／ `README.md` と `public-snapshot-manifest.txt` の行差し替え）であり、いずれも意図したものである。

---

## 8. 検査（**出力で判定した。パイプで切っていない**）

| 検査 | 結果 |
|---|---|
| **`check-artifact-integrity.sh`**（★1 本目） | **EXIT=0** ／ 検査 20 件・ALLOW 除外 1 件 ／ 生成物 4 件 OK ／ **新設した `check-third-party-attribution.sh` も自動で拾われ自己検査が通った** |
| `check-public-snapshot.sh` | **EXIT=0** ／ 母数 3095・公開 3081・除外 14・違反なし |
| `check-public-snapshot.sh --self-test` | **EXIT=0**（`check-artifact-integrity.sh` 経由で実行） |
| `check-migration-license.sh` | **EXIT=0** ／ 違反なし |
| `check-migration-license.sh --self-test` | **EXIT=0** ／ 合格 |
| **`check-third-party-attribution.sh`**（新規） | **EXIT=0** ／ 来歴ブロック 2 個 ／ グロブ 21 件・1 件・8 件 ／ `NOTICE` の逐語と件数が一致 |
| **`check-third-party-attribution.sh --self-test`** | **EXIT=0** ／ **陰性 2・陽性 5 すべて期待どおり** |
| `check-release-archive.sh --self-test` | **EXIT=0** ／ 陰性 5・陽性 6 |
| **`check-release-archive.sh`**（本検査・実アーカイブ） | **EXIT=0** ／ 違反なし・検査したアーカイブ 3 本。**⇒ 新設した `LICENSES/LicenseRef-*.txt` が 3 本すべてに入っていることを実物で確認**（§11） |
| `make release-archives` | **EXIT=0** ／ 3 OS ぶん生成 |
| `check-doc-refs.sh` | **EXIT=0** ／ dead reference なし |
| `check-doc-inventory.sh` | **EXIT=0** ／ 型に無いファイル 2 件（**着手前と同数**＝`scanoss-local-rescan-handover.md` と `M26-04-scanoss-followup-report.md`。**本サブで増やしていない**） |
| `check-md-emphasis.sh`（全体） | **EXIT=0** ／ ベースラインどおり・増加なし |
| `check-md-emphasis.sh docs/progress/M40-01-completion-report.md` | **検出 1 行**。**★フェンス内のコード引用による構造上の偽陽性である**（`followup` の `md-emphasis-check-fenced-block-false-positive`）——§8b.1 に貼った検査出力の逐語に `web/src/components/ui/**` が含まれるため。**⇒ 逐語引用であり直せない。直さずにこの 1 行を残す** |
| `check-progress-log-index.sh` | **★Phase D の手番であるため、この時点では EXIT=1 である**（`m40-01` の索引行が未追記）。**⇒ §12 に追記後の出力を貼る。★「緑」とは書かない** |
| **`go test ./...`** | **EXIT=0** ／ `grep -cE "^--- FAIL"` = **0** |
| **`cd web && pnpm test`** | **EXIT=0** ／ **234 ファイル / 2974 件 passed** |

実行の逐語（`D-881` の形式）:

```
$ go test ./... > /tmp/gotest.txt 2>&1; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" /tmp/gotest.txt
0
```

**★`make e2e` は回していない。** 本サブは `web/src/` も Go の実装も 1 行も触っておらず（E-4 の裏返し）、変更は宣言ファイルと検査スクリプトに閉じている。**⇒ 回さなかった事実と理由をここに書いておく。「緑」とは書かない。**

**★`check-release-archive.sh` の本検査**（`--self-test` ではないほう）**も実アーカイブに対して回した。⇒ §11 を見ること。**

**★完了報告を書いた*後に*回し直した検査の出力は §12 に在る**（`D-890` / 完了条件 13）。

---

## 8b. ★★★レビュー指摘への是正と、その回帰確認（**変異で確かめた**）

**★レビューが実測で 2 つの穴を出した。⇒ どちらも「本検査が防ぐはずだった当の事故を素通りする」型であった。**

### 8b.1 高-2 — 宣言ブロックを丸ごと消しても緑だった

**★是正前の実測**（レビューの指摘を製造が再現した）:

```
$ # REUSE.toml から (6-T1) の shadcn ブロックを丸ごと削除して回す
$ bash scripts/check-third-party-attribution.sh ; echo "EXIT=$?"
結果: 違反なし
EXIT=0
```

**★原因＝R2 は「来歴ブロックが 1 つ以上」しか見ておらず、T2 が残っていれば T1 を消しても通った。R7 は `NOTICE` の件数とファイル実数を比べるだけで、*宣言の有無*を見ていなかった。**

**⇒ 22 ファイルが既定の層 A（© plexiblinp / AGPL）へ静かに戻る。★`D-777` の一般形そのものであり、本検査はそれを防ぐために書かれたものであった。**

**★是正＝R8（必須被覆）を足した。** 是正後、同じ変異で:

```
$ bash scripts/check-third-party-attribution.sh ; echo "EXIT=$?"
NG  R8: 来歴ブロックへ解決していないファイルが 21 件あります: web/src/components/ui/** (...)
NG  R8: 来歴ブロックへ解決していないファイルが 1 件あります: web/src/lib/utils.ts (...)
結果: 違反 2 件
EXIT=1
```

### 8b.2 高-3 — 自己検査の陽性対照が規則を隔離していなかった

**★原因＝終了コードしか見ていなかった。** 陽性対照 1（グロブを空振りさせる）は R3 と R7 で*同時に*赤くなるため、**R3 を壊した変異版スクリプトでも「合格」を返した**。R1 / R2 には陽性対照が無かった。

**★是正＝陽性対照が「どの規則が鳴ったか」まで照合する形にした。** 是正後、R3 の `fail` を潰した変異版で:

```
$ bash scripts/check-third-party-attribution.sh --self-test ; echo "EXIT=$?"
NG  陽性対照(グロブが 0 件に当たる) は赤くなったが R3 が鳴っていない(別の規則で赤くなった)
自己検査: 不合格
EXIT=1
```

**★あわせて R1 / R2 / R8 / R9 の陽性対照を足した。⇒ 陰性 2 / 陽性 9 となり、9 規則すべてに隔離された対照が付いた。**

### 8b.3 ★この 2 件から持ち帰ること

**★★「検査を書いた」は「検査が効く」の証拠にならない。⇒ 初版は全対照が緑で、`check-artifact-integrity.sh` も緑であった。★それでも守るべき最大の回帰を素通りしていた。**

**⇒ 新しい検査を書いたら、*守りたい事故そのものを実際に起こして* 赤くなることを確かめること。** 対照の設計ではなく、**実リポジトリでの変異**でしか分からない。

**★レビュアーがこれを見つけた経路も同じである——報告の「緑」を信用せず、自分で壊して回した。**

---

## 9. 設計判断とその理由（まとめ）

| # | 判断 | 理由 |
|---|---|---|
| 1 | 帰属を `NOTICE` §6 へ | 配布アーカイブへの同梱が既に機械で担保されている（§1.3） |
| 2 | §5 の源泉は広げない | §5 は依存の棚卸しであり、vendored が載らないのは構造的に正しい |
| 3 | MIT 条項を全文インライン | 層 C の MIT と第三者の MIT を取り違えさせない（§2.5-5 の先例とも整合） |
| 4 | 三層は (a) 軸を足す | 来歴は内容と直交する。層に畳むと増え続ける（§2.2） |
| 5 | `precedence = "override"` を維持 | `D-702` (f)＝パス単位の宣言に集約する方針。`SecPal` の `aggregate` はファイル内ヘッダ併用が前提（§2.5-4） |
| 6 | 著作権者を並記 | 改変 4 件は派生物である（§1.5） |
| 7 | `docs/seed-data/**` は `LicenseRef-` | 案 A は層を移すだけで悪化する（§4.1） |
| 8 | 新規検査を実装した | `D-777` の穴に対する唯一の機械的な答え（§2.4） |
| 9 | 検査の登録先を `README.md` 主とした | `check-migration-license.sh` / `check-public-snapshot.sh` と同じ場所に置く。`CLAUDE.md` §8 には製造担当の導線として 1 行だけ足した |

**★推測で進めた点は無い。** ライセンス条件そのものは 1 つも自己判断していない（`CLAUDE.md` §10）——**条件は開発者の外部照会に、置き場と形は Plan Mode での開発者確定に、仕様の逐語は一次情報に依っている。**

---

## 10. ■ 併せて更新が要るもの

| # | 項目 | 結果 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。0 本を消費した**（★自採番しない＝`D-293`）。**⇒ 原稿 2 本を設計伝達レポート §1 / §6 へ出す。採番は設計卓の手番** |
| 2 | **「次の番号」の写し先 4 か所** | **触っていない。⇒ 番号を消費していないため** |
| 3 | **消費したマイグレ連番** | **0 本。`migrations/` を 1 バイトも触っていない** |
| 4 | **版を上げた文書の参照元** | **なし。本サブは文書の版を上げていない** |
| 5 | **`RELEASE_EXTRA_FILES` の変更に伴う追随** | **`check-release-archive.sh` は同じ配列を見るため検査は自動で付いてくる**（`release-targets.sh` の既存注記）。**⇒ 別途の追随は不要** |
| 6 | **`REUSE.toml` のブロック追加に伴う追随** | **`check-migration-license.sh` は `migrations/` と `internal/seedgen/testdata/` だけを走査するため影響なし**（EXIT=0 ＋ `--self-test` で確認済み） |

---

## 11. ★実アーカイブでの確認（**回した。⇒ 自己検査だけで済ませていない**）

**`check-release-archive.sh` の本検査は `dist/release/` を要求する**（無ければ exit 2）。`RELEASE_EXTRA_FILES` へ 1 行足したため、**新しい `LICENSES/LicenseRef-*.txt` が実アーカイブへ入ることを実物で確かめた。**

```
$ make release-archives ; echo "EXIT=$?"
EXIT=0
$ ls dist/release/
tacpendium-darwin-arm64.tar.gz    tacpendium-linux-amd64.tar.gz    tacpendium-windows-amd64.zip
（＋ それぞれの .sha256）

$ bash scripts/check-release-archive.sh ; echo "EXIT=$?"
EXIT=0
OK  tacpendium-linux-amd64.tar.gz: 追加同梱物 LICENSES/LicenseRef-Tacpendium-NotForDistribution.txt
OK  tacpendium-linux-amd64.tar.gz: SHA-256 照合
違反なし(検査したアーカイブ: 3 本)
```

**★さらに「帰属が配布物の中に在るか」を実物で確かめた。⇒ これが §1.3 で置き場を `NOTICE` にした理由そのものだからである。**

```
$ tar xzf dist/release/tacpendium-linux-amd64.tar.gz -C <tmp>
$ grep -c "Copyright (c) 2023 shadcn" <tmp>/NOTICE
2
$ grep -c "Copyright (c) 2023 shadcn" <tmp>/REUSE.toml
1
```

**⇒ 配布アーカイブ 3 本すべてに、shadcn の著作権表示と MIT 条項、そして `LicenseRef-` の本文が入っている。**

**★`--self-test` が EXIT=0 であること**（§8）**は「検査が機能している」ことの証拠であって、「アーカイブに入っている」ことの証拠ではない。⇒ 上の実測がその証拠である。**

---

## 12. 完了報告を書いた後に回し直した検査（`D-890` / 完了条件 13）

**★完了報告と `progress-log` の索引行を書き終えた*後に*回した。⇒ これらの検査は完了報告そのものを入力に取るため、書く前の値は偽になる。**

```
$ bash scripts/check-progress-log-index.sh ; echo "EXIT=$?"
OK  検査した 123 件すべてが progress-log に現れる(ALLOW 除外 17 件)
結果: 違反なし
EXIT=0

$ bash scripts/check-completion-report-md-emphasis.sh ; echo "EXIT=$?"
結果: 違反なし
EXIT=0

$ bash scripts/check-doc-inventory.sh ; echo "EXIT=$?"
?   docs/handover/scanoss-local-rescan-handover.md
?   docs/progress/M26-04-scanoss-followup-report.md
結果: 型に無いファイル 2 件
EXIT=0

$ bash scripts/check-stop-discipline.sh ; echo "EXIT=$?"
結果: 違反なし
EXIT=0
```

**★`check-doc-inventory.sh` の 2 件は着手前と同じである**（§8）**。⇒ 本サブが増やしたものではない。** 本サブが作った 3 ファイルはいずれも型に当たる——`M40-01-completion-report.md`（完了報告） ／ `m40-01-review.md`（レビュー報告） ／ `LICENSES/LicenseRef-*.txt`（`docs/` 配下ではないため走査対象外）。

**★★`M36-01` で起きた事故**（検査を回した時点と報告を書いた時点がずれ、赤い検査を緑と書いた表が残った）**を避けるため、上の 4 本は*この順序で*回している。⇒ 索引行を足す前に回した `check-progress-log-index.sh` は EXIT=1 であり、それも §8 に書いてある。**

---

## 13. レビュー（★Phase C の後に埋めた欄）

| 項目 | 値 |
|---|---|
| レビュー報告書 | `docs/progress/m40-01-review.md` |
| 指摘の件数・優先度別内訳 | **14 件**＝**高 4 / 中 5 / 低 5** |
| 差し戻しに当たる不合格 | **0 件**（チェックリスト §0 の 8 項目はいずれも該当せず） |
| **「高」指摘の不採用** | **0 件。⇒ 4 件すべて採用した。★安全弁は発動していない** |
| 再レビュー往復の回数 | **0 回**（上限 2 回に達していない） |

### 13.1 トリアージ（採否と理由）

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| **高-1** | `REUSE.toml:145-147` に失効した逐語引用（`LICENSES/MIT.txt` の著作権表示） | **採用** | **指摘どおり。★製造の自作の失効記述であった**——§5 で `MIT.txt` をテンプレートへ戻した*後に*、(6) のコメントを追随させていなかった。⇒ 現在の事実（層 C の著作権者は `REUSE.toml` (2) が宣言する／`MIT.txt` はテンプレート）へ書き換えた |
| **高-2** | 宣言ブロックを消しても緑（実測） | **採用** | **製造が変異で再現し、確かに EXIT=0 であった。⇒ R8（必須被覆）を足した。§8b.1 に是正前後の出力を貼った** |
| **高-3** | 陽性対照が規則を隔離していない（実測） | **採用** | **製造が変異で再現し、R3 を壊した版でも「合格」であった。⇒ 対照が「どの規則が鳴ったか」まで照合する形にし、R1 / R2 / R8 / R9 の対照を足した（陰性 2 / 陽性 9）。§8b.2** |
| **高-4** | 22 ファイルの宣言が `AGPL-3.0-or-later` → `MIT` へ変わった事実が報告に無い | **採用** | **指摘どおり書いていなかった。⇒ §5b を新設し、上流そのままの 18 件と本 repo が改変した 4 件を分けて記述した。★改変分を MIT で出す判断は開発者へ諮る（代案 2 つを添えた）。⇒ 設計伝達レポート §4 へ** |
| **中-1** | 設計伝達レポート未作成で `DES-001` §5.1 と `REUSE.toml` が食い違う | **採用** | Phase D で `/design_handover_report` により作成し、CHANGE 原稿を §1 / §6 へ置く |
| **中-2** | `LicenseRef-` と `DENY` が機械で結ばれていない | **採用** | **R9 を足した。⇒ `LicenseRef-` の各グロブが `public-snapshot-manifest.txt` の `DENY` に在ることを見る。★`LicenseRef-*.txt` 本文の「二重の防壁」の主張が、これで初めて機械に支えられた** |
| **中-3** | `LICENSES/` が Covered File でないことと、L-1 / L-2 が射程外であることを申し送りへ | **採用** | §14 へ 2 行足した |
| **中-4** | §8 の検査表に `check-progress-log-index.sh` が無く §12 が空欄 | **採用** | §8 へ 1 行足し（**この時点では EXIT=1 であると明記**）、§12 は Phase D で埋める |
| **中-5** | 軸の説明が 4 か所に散在 | **採用（縮小）** | `DATA-LICENSE.md` の 6 行を 3 行の参照へ落とした。**★`README.md` と `CLAUDE.md` §8 は残す**——前者は三層表を `DATA-LICENSE.md` と重複して持つのが本 repo の既存の型であり、後者は製造担当が検査を見つける導線である。**⇒ 正本は `DES-001` §5（原稿）と `REUSE.toml` (6) であることを各所で明示した** |
| **低-1** | `probe()` の死んだサブシェル | **採用** | スクリプト書き直しで除去した |
| **低-2** | R4 に「既定ブロックが在ること」を足す | **採用** | R4 に足した（既定が無ければ赤） |
| **低-3** | (6-T2) の `SPDX-FileCopyrightText` の値にコメント | **採用** | なぜ 2 つ並べるか・なぜ第三者を実名で書けないかを 5 行で書いた |
| **低-4** | `DATA-LICENSE.md` の参照行から重複説明を落とす | **採用** | 中-5 と同じ手当て |
| **低-5** | chronology の SHA が現リポジトリで解決しないことを記録 | **採用（表現を変えて）** | §14 へ足した。**★ただし「解決しない」を「存在しない」と書かない**——**本作業ツリーは浅いクローンであり、解決しないのはその帰結でありうる。⇒ 観測を観測として書く** |

**★★「高」指摘の不採用は 0 件である。⇒ Phase C の安全弁（重大指摘の自動棄却）は発動していない。**

---

## 14. 申し送り（設計伝達レポート §4 へ出す候補）

| # | 内容 |
|---|---|
| **★★1** | **`docs/change-notes/CHANGE-226-notification.md` が存在しない。** 指示書 §1-6 / §9 とチェックリスト E-3 が参照しているが実体が無い。中身は `docs/handover/change-number-registry.md:203` ／ `DES-001` ／ `SUPP-001` §391・§1472 に在る。**★`check-doc-refs.sh` の走査範囲**（ルール面 37 ファイル）**に指示書は含まれないため、機械では出ない** |
| **★★2** | **`three-layer-lacks-third-party-axis` の選択肢が 2 つの文書で食い違う。** followup は「(a) 軸を足す ／ (b) 除外で切る（現状は (b)）」、チェックリスト B-2 は「(a) 軸を足す ／ (b) 層を足す ／ (c) 宣言だけ」。**★本サブは指示書 v1.1.0 の 3 択に従い (a) を採った。⇒ followup 側の「(b) 除外で切る」にも答えておく——除外は公開範囲の話であって、著作権者の宣言が偽である問題は解けない** |
| **★★3** | **追補報告に残る非公開リポの*日付***（§6.4）**。開発者確定は「SHA 3 件だけ伏せる」であり、日付は伏せていない。⇒ 広げるかどうかは開発者の判断** |
| **★★4** | **`docs/progress/**` 全体に短縮 SHA が日常的に引用されている**（§6.4）**。⇒ ファイル単位の `DENY` はこの面には効かない。公開前に方針を決めるなら別の手番** |
| **★5** | 広く使われている OSS 9 本が shadcn の帰属を 1 つも持っていない（§2.5-7）。**★本サブの判断は変えないが、事実として記録する** |
| **★6** | `sonner.tsx` は改変済みなのに SCANOSS `file` 100% 一致（§1.1）。**⇒ `M40-02` が再スキャンの差分を読むとき、`file` 100% を「上流と逐語同一」と読まないこと** |
| **★★7** | **★★【裁定済み・2026-09-20】改変 4 件の outbound**（§5b）**。⇒ 開発者裁定＝現状維持（22 件を 1 表で `MIT`）。★代案 2 つは検討のうえ不採用。⇒ followup へは登録しない**（決着しており再開条件が無いため）**。記録は §5b.2 ／ 設計伝達レポート §4-1 ／ `REUSE.toml` (6-T1) のコメント** |
| **★8** | **followup `three-layer-lacks-third-party-axis` が名指しする 3 母集団のうち、本サブが触ったのは `web/src/components/ui/` 21 件だけである**（レビュー 中-3）**。⇒ 残り 2 つ＝(i) `LICENSES/` 配下は REUSE 仕様上 Covered File ではなく**（`REUSE.toml:20-21` の逐語）**宣言の対象外である ／ (ii) `docs/progress/` の L-1 / L-2 は `a3-exclusion-cut-by-location-not-content` として 2026-09-11 に処置済みである**（`D-823`）**。⇒ どちらも本サブの射程外で決着しているが、followup を閉じるときに参照が要る** |
| **★9** | **`docs/progress/M26-02-completion-report.md:81` に「`LICENSES/MIT.txt` … 著作権行の `<year> <copyright holders>` を埋めた」と在る。⇒ 本サブ（§5）でその判断が反転した。★歴史記録は書き換えない**（`D-274` (3)）**が、反転を辿れるようにしておく必要がある** |
| **★10** | **chronology CSV の 40 桁 SHA は、本作業ツリーからは解決できなかった**（レビューの独立検証と一致）**。⇒ ただし本ツリーは浅いクローンであり、「解決しない」は「非公開リポに存在しない」を意味しない。★観測を観測として残す** |

---

## 15. 停止規律（`CLAUDE.md` §9）

**★未解消のまま停止した項目は無い。** 往復上限にも達していない。**⇒ `docs/handover/followup-backlog.md` は 1 文字も編集していない**（`D-838`）。§14 は「未解消」ではなく**設計卓へ回す申し送り**であり、設計伝達レポート §4 へ出す。

---

*以上、`M40-01` 完了報告。*
