# shadcn/ui のライセンス条件 外部照会 結果（2026-09-20）

| 項目 | 内容 |
|------|------|
| 文書ID | SHADCN-LICENSE-INQUIRY-REPORT |
| バージョン | **1.0.0**（2026-09-20・受領） |
| 種別 | **日付つきの単発 調査・報告**（`docs/progress/` の型。`check-doc-inventory.sh --list-allow`） |
| 照会のプロンプト | `docs/handover/session-prompts/20260920-shadcn-license-external-inquiry.md` |
| 誰が回したか | **開発者**（`CLAUDE.md` §10＝法務の自己判断禁止。**⇒ Claude はライセンス条件を自分で決めない**） |
| 回答者 | **外部生成 AI**（一次情報の URL と参照日を伴う） |
| 調査日 | **2026-09-20** |
| 受領・登録 | 設計卓（`D-922`） |
| 使う先 | **`M40-01`**（§2.1 段 1 ／ §2.2 段 2 ／ §3 やらないこと） |

---

## 0. ★★★本書の位置づけ（**設計卓が付けた枠**）

**★★★本書は一次情報そのものではない。⇒ 一次情報の URL と参照日を伴う*整理*である。**

**★★`M36-02` §7-1 の教訓＝一次情報へ到達できないとき、二次情報を一次情報として書くのが最も危ない。⇒ 本書を引くときは、必ず §1 の URL を併記すること。**

**★★★本書は法律相談ではない**（回答末尾の自己申告）**。⇒ 最終的な採否は開発者が決める。**

### 0.1 ★★★本書で決まったこと / 決まらなかったこと

| 区分 | 内容 |
|---|---|
| **★★★決まった (1)** | **shadcn/ui のライセンスは MIT であり、著作権表示の逐語は `Copyright (c) 2023 shadcn` である** |
| **★★★決まった (2)** | **帰属の「置き場所」は各 `.tsx` のヘッダである必要は無い。⇒ `NOTICE` 等の別ファイルで管理できる**（**★MIT 上必須とは確認できなかった**、が回答の逐語） |
| **★★★決まった (3)** | **「You own the code」は MIT の表示保存条件を免除する追加許諾*ではない*。⇒ 表示は維持する** |
| **★★決まった (4)** | **MIT を AGPL-3.0-or-later のプロジェクトへ組み込むことに、通常ライセンス上の矛盾は無い** |
| **★★決まった (5)** | **`package.json` 依存としての Radix UI は、shadcn 由来ファイル*内*への著作権表示追加を要しない。⇒ 別問題として扱う** |
| **★★★決まらなかった** | **本プロジェクトで*どのファイルへ何を書くか*。⇒ 回答は `THIRD_PARTY_NOTICES.md` ／ `LICENSES/MIT.txt` ／ REUSE を例示しただけであり、本 repo の既存構成には踏み込んでいない。★決めるのは開発者である** |

---

## 1. ★★回答（**受領した内容。★編集していない**）

### 結論

shadcn/ui のコンポーネントをソースコードとして自リポジトリへコピーし、プロジェクトを AGPL-3.0-or-later で公開・配布することは可能と判断する。ただし、shadcn/ui 由来コードについては、元の MIT License と著作権表示を維持するのが適切である。

### 1. shadcn/ui のライセンス

shadcn/ui 公式リポジトリは MIT License。LICENSE の著作権表示は逐語で `Copyright (c) 2023 shadcn` である。LICENSE は、著作権表示および MIT の許諾表示を、ソフトウェアのコピーまたは重要な部分に含めることを要求している。

- 公式リポジトリ: `https://github.com/shadcn-ui/ui`
- LICENSE: `https://github.com/shadcn-ui/ui/blob/main/LICENSE.md`

### 2. コピー時の帰属表示

MIT License は、Web 画面や README など特定の場所へのクレジット表示を要求していない。必要なのは、再配布するコードについて次を保持することである。

- `Copyright (c) 2023 shadcn`
- MIT License の許諾・免責条項

したがって `THIRD_PARTY_NOTICES.md` や `LICENSES/MIT.txt`、REUSE のライセンス情報などで管理できる。各 `.tsx` ファイルへの表示が MIT License 上必須とは確認できなかった。

### 3. 「コピーしたコードはあなたのもの」という公式説明

公式ドキュメントには `You own the code and can customize it however you want.` との記載がある。shadcn/ui がパッケージを参照する方式ではなく、コンポーネントのソースをプロジェクトへ直接追加する設計であることを説明した文脈である。

- 公式ドキュメント: `https://ui.shadcn.com/docs/new`

ただし、この文言が MIT License の表示保存条件を免除する正式な追加許諾であることは確認できなかった。したがって、MIT の著作権・ライセンス表示は維持する。

### 4. AGPL-3.0-or-later との組み合わせ

MIT は GPL 互換の permissive license とされており、MIT コードを AGPL-3.0-or-later のプロジェクトへ組み込むことに、通常ライセンス上の矛盾はない。AGPLv3 自体も、合理的な法的表示・著作者表示の保存を追加条件として認めている。

実務上は、例えば次の構成が分かりやすい。

```text
LICENSE
    AGPL-3.0-or-later

LICENSES/
    AGPL-3.0-or-later.txt
    MIT.txt

THIRD_PARTY_NOTICES.md
    shadcn/ui
    Copyright (c) 2023 shadcn
    License: MIT
```

REUSE を利用する場合は、shadcn/ui 由来ファイルを `MIT`、自作コードを `AGPL-3.0-or-later` として区別できる。REUSE は `REUSE.toml` によるディレクトリ単位等のライセンス指定にも対応している。

### 5. Radix UI 等の依存関係

Radix UI 等を `package.json` の dependency として利用することと、shadcn/ui からコピーしたコンポーネントの帰属表示は別問題として扱う。Radix Primitives 自体も MIT License で、公式 LICENSE には `Copyright (c) 2022 WorkOS` と記載されている。

- Radix UI LICENSE: `https://github.com/radix-ui/primitives/blob/main/LICENSE`

単に `package.json` から依存する場合、shadcn/ui 由来ファイル内へ Radix の著作権表示を追加する必要があるとは確認できなかった。一方、Radix 等のコードをバンドルした成果物として配布する場合は、その第三者ライセンスも配布物のライセンス管理対象として扱うのが適切である。

### 推奨方針

本プロジェクトでは次のとおりとし、`LICENSES/`、`THIRD_PARTY_NOTICES.md`、必要に応じて `REUSE.toml` で明示する方式を推奨する。

- 自作コード: `AGPL-3.0-or-later`
- shadcn/ui 由来コード: `MIT / Copyright (c) 2023 shadcn`
- その他の依存 OSS: 各ライセンスを別途管理

なお、本資料は公開されている一次情報を整理したものであり、個別案件に対する法律相談ではない。

---

## 2. ★★★設計卓の注記（**回答と本 repo の現状の突き合わせ**）

**★★★以下は回答そのものではない。⇒ 回答を本 repo の実測と突き合わせた設計卓の所見であり、`M40-01` の製造が*実査で覆ってよい*。**

| # | 突き合わせ |
|---|---|
| **★★★1** | **回答の推奨構成のうち `LICENSES/` は既に在る**〔`LICENSES/AGPL-3.0-or-later.txt` ／ `CC-BY-SA-4.0.txt` ／ **`MIT.txt`**〕**。⇒ MIT の全文は置き場が既に在る。★足りないのは「誰の著作物か」の側である** |
| **★★★2** | **`REUSE.toml` の 3 ブロックは、どれも `SPDX-FileCopyrightText = "2026 plexiblinp"` である**（2026-09-20 実測）**。⇒ *第三者が著作権者であるブロックが 1 つも無い*。★これが `three-layer-lacks-third-party-axis` の実体である** |
| **★★3** | **したがって三層は「何の内容か」で切られており**〔本体 ／ SF6 の事実 ／ AI 運用〕**、「誰の著作物か」では切られていない。⇒ 層 C が MIT なのは*本 repo の MIT* であって、*第三者の MIT* ではない** |
| **★★4** | **`NOTICE` §5 はフロントエンドの直接依存を*件数*で持つ**〔`MIT 40 / Apache-2.0 3 / ISC 2`〕**。⇒ Radix は `package.json` 依存としてこの母集団に居る。★回答 §5 の前段**〔shadcn 由来ファイル内への表示は不要〕**と整合する** |
| **★★★5** | **回答 §5 の後段**〔バンドルした成果物の第三者ライセンス管理〕**は、既に `release-zip-missing-license-files` が扱って*解消済み*である**（2026-09-16 開発者判断＝7 件を同梱。`M36-01` レポート §4-5 / §4-6）**。⇒ 新しい穴ではない。★`M40-01` の射程を広げる理由にはならない** |
| **★★6** | **回答が例示した `THIRD_PARTY_NOTICES.md` は本 repo に無い。⇒ 新設するか `NOTICE` へ節を立てるかは、`M40-01` §2.1 段 1-2 の判断そのものである。★設計卓は形を指定しない**（計測点 `M-206`） |

---

## 3. 参照

| パス | 何が在るか |
|----|------|
| `docs/handover/session-prompts/20260920-shadcn-license-external-inquiry.md` | 照会のプロンプト（**★再照会するときはここから**） |
| `docs/instructions/M40-01-attribution-and-declarations.md` | **§0.4**（照会の位置） ／ **§2.1**（段 1） ／ **§3**（やらないこと） |
| `docs/handover/followup-backlog.md` | **§CR** の `shadcn-ui-vendored-without-attribution` ／ `three-layer-lacks-third-party-axis` |
| `REUSE.toml` ／ `NOTICE` ／ `LICENSES/` | 宣言の正本 |
| `docs/process/parallel-board.md` | `D-919`（`M40` 起票） ／ **`D-922`**（本書の受領） |

---

*以上、外部照会 結果 **v1.0.0**。* **★★★本書が決めたのは「何を保持するか」までである。⇒ 「本 repo のどのファイルへ書くか」は決まっていない。★それは `M40-01` が候補を出し、開発者が決める。**
