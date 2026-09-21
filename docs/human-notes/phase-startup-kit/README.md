# phase-startup-kit — 使い方

開発者向けメモ。新フェーズ着手時に、**設計卓(親)＝Claude Code(メインツリー)** のセッションを立ち上げる
ための「**貼るプロンプト 1 本 ＋ 読む資料の一覧**」の完成品を置くフォルダ。
**★`phase3` 以前のキットは Claude Web 版チャットへの添付投入を前提にしている**(2026-08-11 の面の移行より前に作られたため)。

`/next_phase_kit` コマンドが本フォルダへキットを生成する。

---

## 1. このフォルダの中身

| ファイル | 内容 |
|---------|------|
| `phase{N}-kickoff-startup-kit.md` | フェーズ {N} キックオフ用の、コピペで使える起動プロンプト + 投入ファイル一覧 |
| `README.md` | 本ファイル(用途・流用手順) |

> **★以下は `phase3` 以前のキットに対する記述である**(`phase4` 以降は A〜E グループも添付運用も存在しない)。投入資料には、各成果物の書式・粒度の手本テンプレ集 `../../instructions/templates/`(テンプレ実体)を B グループ(恒久資料)として含める。従来の「過去成果物の実物を個別添付」を代替する。**2026-07-20 直読切替**: コミット済みのため Web 版の GitHub ナレッジで直読させる。添付フォールバック時のみ `/next_phase_kit` の Step 3-0e で `bash scripts/generate-template-zip.sh` により `design-templates.zip` を再生成して添付(zip は .gitignore・commit 対象外)。

現在は **`phase4-kickoff-startup-kit.md`**(フェーズ4 = **スコープ再編 → 初回全体公開**)が最新。

> **★★2026-08-11 以降、投入方式が変わっています。** 親(設計卓)の面は **Claude Web → Claude Code(メインツリー)** へ移り、
> 反映係の層は廃止されました(開発者裁定・正本 `docs/progress/20260811-design-desk-surface-study.md` §9)。
> **⇒ キットは「ファイルを添付する」ものではなく、`§2` のプロンプト 1 本を Claude Code へ貼るものになりました。**
> 資料は **HEAD から直接読まれ**、親は **武装**(`scripts/design-desk-arm.sh`)により実装ソースを物理排除した状態で動きます。
> **上表の A〜E グループ・GitHub 直読・添付フォールバックの記述は `phase3` 以前のキットに対するもの**で、
> **`phase4` 以降は「起動時に必ず読むパス / 必要時に引くパス」の 2 列**になっています。
> Web 版は `parallel-ops` §06 の**個別設計チャット**へ配置換えされ、添付運用はそちら向けの注記として残ります。

## 2. milestone-startup-kit/ との違い

| フォルダ | 粒度 | 生成チャットの最初の仕事 | 生成コマンド |
|---------|------|------------------------|-------------|
| `../milestone-startup-kit/` | マイルストーン(M{N}) | 単一マイルストーンの指示書作成 | `/next_milestone_kit` |
| 本フォルダ `phase-startup-kit/` | フェーズ(1〜4) | **phase-overview ドラフト(マイルストーン分割策定)** → 余力で序盤マイルストーン着手 | `/next_phase_kit` |

フェーズキックオフは「新フェーズの立ち上げ」が主眼で、最初に **そのフェーズのマイルストーン分割**を
策定する点がマイルストーン連番キットと異なる。

## 3. 流用手順(次フェーズ着手時)

1. 前フェーズのキックオフ完了時、設計担当が `phase{N+1}-kickoff-handover.md` を `docs/handover/` に作成する。
2. `/next_phase_kit docs/handover/phase{N+1}-kickoff-handover.md` を実行する(Plan Mode 必須)。
   - コマンドが当該 handover を一次資料に、本フォルダへ `phase{N+1}-kickoff-startup-kit.md` を生成する。
   - 既存の前フェーズ kit があれば構造ベースに流用し、無ければ最新の `m{N}-startup-kit.md` 構造から
     bootstrap する。
3. **`git status` をクリーンにし、`claude/desk-YYYYMMDD-N` ブランチで Claude Code を開いて、生成された kit の `§2` の
   プロンプト 1 本を貼る**(`phase4` 以降)。**★設計卓が最初に `bash scripts/design-desk-arm.sh` を実行して武装を報告する**のを
   確認すること。`phase3` 以前のキットは Web チャットへの添付投入を前提にしている。

## 4. 流用時の注意点

- **一次資料 = `phase{N+1}-kickoff-handover.md`**。これが無いとキットは生成できない。フェーズ完了 /
  キックオフ準備時の handover 作成を忘れないこと。
- **★`phase4` 以降、投入ファイルの A〜E グループは存在しない。**「**起動時に必ず読むパス / 必要時に引くパス**」の 2 列にし、
  **入力 handover の引き継ぎ節と直前の close-report を基準にする**。**★handover の節番号を決め打ちしないこと**——
  旧記載は「handover §7.2(最初に読む資料)を基準にする」だったが、**`phase3-to-phase4-handover.md` に §7 は存在しない**(§0〜§6)。
  **⇒ 毎回 `grep -n '^## '` で実査する。**
- **設計書本体・補足資料のバージョンは handover の記述を写さず、生成時に実物で実査する。**
  **★handover は発行後に更新されない文書であり、そこに書かれた版は必ず失効する**(`D-247`)。
  **実際に `phase4` 生成時、handover の値のうち 4 件が失効していた**——裁定の次番号(`D-628` → **`D-631`**)/
  `progress-summary` の遅れ(2 MS 遅れ → **解消済み**)/ `code-facts` の鮮度(古い → **最新**)/ `DES-002`(1.72.0 → **1.73.0**)。
- **個別チャットの作業メモは残さない**。本フォルダはコミット対象だが、置くのは再利用する
  `phase{N}-kickoff-startup-kit.md` と本 README のみ。

## 5. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-06-07 | 新設。フェーズ1完了 → フェーズ2 着手に伴い `/next_phase_kit` を新設し、`phase2-kickoff-handover.md` を一次資料に `phase2-kickoff-startup-kit.md` を bootstrap 生成(前フェーズ kit 不在のため `m7-startup-kit.md` 構造から起こした)。CHANGE 次回 022、設計書現行版(REQ-001 v2.15.0 / DES-003 v1.16.0 等)反映 |
| 2026-06-27 | フェーズ2完了 → フェーズ3 着手に伴い `/next_phase_kit docs/handover/phase2-to-phase3-handover.md` で `phase3-kickoff-startup-kit.md` を生成(前フェーズ kit `phase2-kickoff-startup-kit.md` を構造ベースに流用)。B グループに code-facts / docs-map / retrospective-digest を追加(retrospective-log は全期間アーカイブ参照へ)。**CHANGE-049(2026-06-27)反映後の現行版を採用**(handover の stale 値を補正): CHANGE 次回 050、REQ-001 v2.15.0 / DES-002 v1.24.0 / SUPP-001 v1.25.0 等。投入直前リフレッシュ(code-facts / docs-map 再生成、retrospective-digest 再蒸留、progress-summary を M12 まで更新)実施 |
| 2026-09-01 | フェーズ3完了 → フェーズ4 着手に伴い `/next_phase_kit docs/handover/phase3-to-phase4-handover.md` で **`phase4-kickoff-startup-kit.md`** を生成。**★base に前フェーズ kit(`phase3-kickoff-startup-kit.md`)を採らず、`../milestone-startup-kit/m23-startup-kit.md` を構造ベースにした**——前フェーズ kit は Web 版・添付投入・反映係ありの時代のもので、**2026-08-11 の面の移行を 1 行も反映していないため**。A〜E グループ+受領マニフェストを「起動時に必ず読むパス / 必要時に引くパス」の 2 列 + 武装の確認へ**全面置換**。**★本キット最大の論点はスコープの食い違い**——**現行 `REQ-001` §7 のフェーズ4(外部データ追従・拡張)と開発者が意図するフェーズ4(リリースまでにやるべき事)が別物**であり、取り違えるとまったく違う overview が書かれる。⇒ キット冒頭・§0.1・§2 の 3 か所へ置いた。材料の源泉を handover §3-1 の 4 → **6** へ拡張(開発者提供の `combmgr-prerelease-checklist.md` / `phase4-memo.txt` を追加。**後者の約 25 件は他のどの台帳にも無い**)。採番は **CHANGE `150`〜 の新ブロック**(`149` は流用しない)。派生資料: `docs-map` 再生成 / `code-facts`・`progress-summary` は実査の結果いずれも最新のため更新不要 / **digest 再蒸留は前提未達でスキップし親のタスクへ引き渡し** / `Memo_Someday.txt` を再仕分け(`[予定 M**]` 10 行を再判定し 0 行化)。**★同日、独立 3 体によるクリーンルームレビューを受けて第 2 稿へ是正した**(【重】6 件・【中】13 件。詳細はキット §6 改訂履歴)。**★★あわせて検査の穴が判明した**——**`scripts/check-md-emphasis.sh` の既定対象範囲に `docs/human-notes/` が含まれず、本フォルダは検査の射程外である**。**⇒ キットを生成したら、生成物を明示指定して `bash scripts/check-md-emphasis.sh <パス>` を回すこと**(既定実行が緑でも本フォルダは検査されていない) |
