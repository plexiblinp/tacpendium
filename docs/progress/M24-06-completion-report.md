# M24-06 完了報告: 取込・出力の UX

| 項目 | 内容 |
|------|------|
| 作業ID | M24-06 |
| 対象指示書 | `docs/instructions/M24-06-import-export-ux.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M24-06-review-checklist.md` **v1.2.0** |
| CHANGE | `CHANGE-144` v1.2.0（設計卓が起票済み。**製造は番号を消費していない**） |
| 実施日 | 2026-08-30 |
| ブランチ | `claude/m24-06-implementation-plan-7zsm93` |
| 着手基点 | `87e4e73`（Merge pull request #123） |
| モック HTML | `docs/progress/M24-06-mock/m24-06-import-export-ux.html` |

---

## 0. 要旨

ledger 7 項目（`SM-071` / `SM-076` / `SM-072`(=`SM-073`/`SM-077`) / `SM-075` / `SM-110` / `SM-121` / `CO-023`）を扱った。

**★核心は 3 つ。**

1. **`/export/combo` を廃止した。** 実態確認で「しかできないこと」が 4 件見つかったため**いったん停止し、開発者の判断を仰いだ**（指示書 §4.3 / §9.1 / §11 確認事項 2）。**開発者の逐語＝「廃止する (memo の方向)」**。判断材料として「アプリ内バックアップは未実装だが DB ファイルのコピーが成立していること」「CSV は 1000 件で静かに打ち切られるためバックアップとして成立していないこと」を提示した（§2-A）。
2. **`CO-023` の StrictMode 対策は着手時点で既に入っていた。** 実装せず、成立をテストで固定した（§3-9）。**これは欠陥ではない**（指示書 §9.3）。
3. **ZIP の中のエントリ名には自動命名を及ぼしていない。** 取込側が `switch base` でエントリ名を**完全一致**で探していることを実査で確かめ（§3-13）、往復対称を E2E (4) と破壊確認 5 で固定した。

**★`internal/` の差分は 0 行。** スキーマ変更 0・マイグレ消費 0 本（次は `000080`）・新規依存 0・ブラウザストレージ新キー 0。

---

## 1. 変更統計（着手基点 `87e4e73` から）

`git diff --stat 87e4e73`（モックを除く。本節の数値はこのコマンドの出力そのものである）:

```
 26 files changed, 1432 insertions(+), 388 deletions(-)
```

**★新規追加ファイルに deletions が付いていないことを確認した**（教訓 `E-225`）。`git diff --numstat 87e4e73 --diff-filter=A` の出力は 9 ファイルすべてが `N 0`（insertions のみ）である。

| ファイル | +/- | 種別 |
|---|---|---|
| `web/src/pages/ComboExportPage.tsx` | **0 / 289** | **削除**（§4.3） |
| `web/src/features/combo-io/export-filename.ts` | 106 / 0 | 新規 |
| `web/src/features/combo-io/import-draft.ts` | 56 / 0 | 新規 |
| `web/src/features/combo-io/components/ImportCommitConfirmDialog.tsx` | 60 / 0 | 新規 |
| `web/src/pages/ComboImportPage.test.tsx` | 244 / 0 | 新規 |
| `web/src/features/combo-io/export-filename.test.ts` | 170 / 0 | 新規 |
| `web/src/features/combo-io/import-draft.test.ts` | 95 / 0 | 新規 |
| `web/e2e/m24-06-import-export-ux.spec.ts` | 191 / 0 | 新規 |
| `web/e2e/support/combo-io.ts` | 132 / 0 | 新規 |

**`internal/` / `cmd/` / `migrations/` はいずれも上記一覧に現れない＝差分 0。**

---

## 2. 実査 14 件の結果（§3.3）

**★すべて現物の `ファイル:行` で裏を取った。設計卓は「ある」も「無い」も断定していなかった。**

| # | 確かめたこと | 結果 |
|---|---|---|
| **1** | 取込プレビューでの仮登録の扱い | **除外 UI・フィルタは無かった。** 表示のみ＝`ComboImportPage.tsx:302`（列見出し「仮登録」）／`:331`（`{r.isDraft ? "○" : "—"}`）。チェックボックス（`:314-323`）・`toggleAll`（`:143-148`）・`selectedLocalIds`（`:109-117`）はいずれも `r.importable` しか見ておらず **draft 非依存**だった。⇒ ledger の記述と一致 |
| **2** | 取込 API の `is_draft` の扱い | **読むが弾かない。** `csvcore/contract.go:27` `ColIsDraft`（**必須列**＝`optionalImportColumns` に無い）／`validate.go:44-45` で厳密 bool パース。draft 固有の分岐は**検証を緩める向きだけ**（`validate.go:65-66` VAL-C11 不適用 ／ `:83-86` VAL-C10 の範囲外し ／ `import.go:60-72` VAL-C02 の対象外）。commit は `import.go:202` で「仮登録は常に新規作成へ進む」、`import.go:378` `IsDraft: dto.IsDraft` を `Create` へ渡す |
| **3** | 0 件ファイルのプレビュー | **「何も出ない」だった（「出ているが気づけない」ではない）。** `ComboImportPage.tsx:245` `{preview && preview.combos.length > 0 && (` ／ `:364` 同型で、**0 行の else 分岐が無い**。空ファイル・ヘッダのみはどちらも BE が `FileError` を立てない（`csvimport.go:113-115`「空入力 → 0 件」）ため、エラー表示 3 本（`:228`/`:233`/`:238`）も出なかった |
| **4** | `/export` の対象指定の形 | **3 つとも素の `<Input>` に数値 ID を手打ち**だった（`ComboExportPage.tsx:200-212` / `:213-224` / `:225-236`）。`parseIdList`（`:282-289`）は `Number.isFinite` のみで**存在確認もエラー表示も無かった** |
| **★5** | **`/export/combo` でしかできないこと（母数付き）** | **母数 12・該当 4 件。**§2-A に全数の突合表を載せた |
| **6** | エクスポートのファイル名の決まり方 | **全経路が固定リテラル・利用者入力なし・形式ごとに別**だった。全数＝`api.ts:64` `"combomgr-export.zip"` ／ `render-and-capture.tsx:178` `combomgr-combo(s).png` ／ `:191` `combomgr-combo(s).pdf` ／ `ComboExportPage.tsx:274`（成功文言に直書き）。**`triggerDownload` の本番呼び出しは 3 か所のみ**。BE の `Content-Disposition`（`internal/api/comboio/handler.go:62`）も固定だが **FE は読んでいない**（`api.ts:52-67` は `res.blob()` のみ）＝**外側の名前を決めているのは FE だけ** |
| **★7** | 確認ダイアログが無い操作の全数（母数付き） | **母数 6・「無いと事故になる」1 件。**§2-B |
| **★8** | 利用者に見えている用語の全数（母数付き） | **20 語。**§2-C |
| **9** | `CO-023` の StrictMode 対策 | **4 点すべて入っていた。** `ComboImportPage.tsx:58-70`（`previewM.data` 購読 ＋ `lastPreviewData` ref）／`:72-94`（`previewMRef` ＋ `setTimeout(0)` ＋ `clearTimeout` cleanup）／`:100`（reset で ref クリア）。**⇒ 実装していない。成立を固定した**（§3-9） |
| **★10** | 取込ヘルパーの連携口 | **通常のプレビュー画面を通る。** `IntakeHelperPage.tsx:137` `navigate("/import/combo", { state: { intakeCsvText } })` → `ComboImportPage.tsx:78-92` が File 化して **`useImportComboPreview`（`api.ts:83-99`）を手動経路と同一に叩く**。**⇒ 仮登録のフィルタが効かない経路は残っていない。** なお `intake/review.ts:129` は常に `isDraft: false` を出すため、ヘルパー由来の行は元から draft を含まない |
| **★13** | **ZIP 内エントリ名の探し方** | **エントリ名の basename 完全一致。** `internal/api/comboio/handler.go:163-188` の `switch base { case comboEntryName: ... case setupEntryName: ... }`。定数は `:42-43`。**大文字小文字も区別する**（`strings.EqualFold` ではない）。**拡張子判定も順序依存も無い。⇒ 名前は契約であり、自動命名を及ぼしてはいけない** |
| **★14** | 個別アップロードの見分け方 | **multipart のフィールド名。** `handler.go:39-40` `combo_file` / `setup_file`、`readImportFiles`（`:148-161`）。**`fh.Filename` は `handler.go` 全文で 1 度も参照されていない。** FE も `api.ts:90-92` / `:115-117` でフィールド名を指定。**⇒ 外側のファイル名を変えても個別アップロードは壊れない**（設計卓の見込みどおり） |
| **11** | 出力の E2E spec の全数（母数付き） | **spec 総数 59 本 ／ 出力に触れる 5 本 ／ ファイル名をアサートしている 8 ステートメント。**§5.2 |
| **12** | `M24-13` / `M24-05` との交差 | **交わらない。** 両サブとも merge 済み（`M24-05`＝PR #122・`M24-13`＝受理済）。着手時の作業ツリーは clean |

### 2-A. `/export/combo` でしかできないこと（実査 5・母数 12）

母数の採り方＝`ComboExportPage` が提供していた機能を数え、`ExportDialog`（§5.13a）と 1 対 1 で突き合わせた。

| # | `ComboExportPage` の機能 | ダイアログに在るか |
|---|---|---|
| P1 | 対象 `range=all`（全コンボ） | **★無い（代替なし）。** ダイアログは常に `{range:"selected", ids}`（`ExportDialog.tsx:113`）。一覧は `useResolvedCharacterId` が**必ず正の整数 1 件を返す**（`useResolvedCharacterId.ts:52` → `defaultCharacter.ts` の段 1 URL → 段 2 セッション → 段 3b config → 段 4 `INITIAL_CHARACTER_ID`）ため、**「全キャラ」という状態が存在しない** |
| P2 | `filter` ＋ キャラ ID 指定 | UI としては無い。**一覧のキャラ選択で同じことができる＝代替あり** |
| P3 | `mycombo` ＋ タグ ID 複数指定 | UI としては無い。**一覧・マイコンボのタグフィルタが配列を受ける**（`ComboListPage.tsx:63`）＝代替あり |
| P4 | `selected` ＋ **任意コンボ ID の直接入力** | **★無い（代替なし）** |
| P5〜P8 | 形式 CSV / PDF / PNG / クリップボード | **在る**（4 種で一致） |
| P9 | 形式は単一選択（radio） | ダイアログは複数同時＝**ダイアログが上位** |
| P10 | 表示項目 常に 17 | ダイアログは形式別に 15/17 出し分け＝**ダイアログが上位** |
| P11 | 視覚出力にも `videoPath`/`imagePath` を出せる | **★機能ではなく欠陥候補**（下記） |
| P12 | 件数警告を PDF・PNG 両方で発火 | ダイアログは PNG のみ＝**M17-05c の意図的仕様** |

**⇒ 該当 4 件（P1〜P4）。うち代替が本当に無いのは P1・P4 の 2 件。**

**★開発者へ提示した判断材料**（廃止の可否はこの 2 件の価値で決まるため）:

- **アプリ内のバックアップ機能は未実装**である。設定画面の「バックアップ」「リストア」「キャッシュ再構築」の 3 ボタンはいずれも `disabled` ＋ ツールチップ「今後実装予定」（`SettingsSectionData.tsx:22-45`）。**ただし DB ファイルパスは表示されている**（`:17-18`）＝`.db` のコピーが現に成立している唯一のバックアップ手段。
- **CSV はバックアップとして成立していない。** ① **1000 件で静かに打ち切られる**（`export.go:18` `exportRowLimit = csvcore.DefaultMaxRows` ＝ `rules.go:8` の **1000**。上限到達は `slog.WarnContext` のみで**利用者へ通知しない**＝`export.go:28-32`、コメントも「利用者通知は将来サブで検討」）／ ② DB 管理列が落ちる（`DES-002` §7.6）／ ③ タグは操作した利用者のものしか載らない（`CHANGE-113`）。
- コンボ ID は詳細画面の URL でしか見えず、P4 の実用場面が想像しにくい。

**⇒ 開発者判断＝廃止する。**

**★P11 は報告に留めた（是正していない）。** `/export/combo` は視覚出力（PDF/PNG/クリップボード）に `videoPath` / `imagePath` を通していた（`toVisualSelected` を経由していなかった）。ダイアログ側は `run-export.ts:70` で除去している。**`CHANGE-073` は「視覚出力にローカルパスを出さない」と決めており、ページ側の取りこぼしだった**と見る。**出力形式の中身の変更はスコープ外（§1.6-6）**であり、かつ**廃止によって面ごと消えた**ため、直さずここに記録する。

### 2-B. 確認ダイアログの監査（実査 7・面は取込／出力に限る・母数 6）

| # | 操作 | 面 | 着手時 | 判定 |
|---|---|---|---|---|
| 1 | **取込実行**（`ComboImportPage.tsx:127` `handleCommit`） | `/import/combo` | **無い** | **★「無いと事故になる」。** DB へ行を作る取り消せない操作が押した瞬間に走る。**⇒ 是正した**（§3-6） |
| 2 | 取込プレビュー | `/import/combo` | 無い | **無くてよい**（DB 書込なし＝`handler.go:66`） |
| 3 | エクスポート実行（`/export/combo`） | `/export/combo` | 無い | **無くてよい**（読み取りのみ）。**★本サブで面ごと廃止した** |
| 4 | エクスポート実行（ダイアログ） | 一覧／マイコンボ | 無い | **無くてよい**（読み取りのみ・ダイアログ自体が確認段） |
| 5 | 取込ヘルパーの CSV 生成 → `/import` へ遷移 | `/import/combo/helper` | 無い | **無くてよい**（遷移先のプレビューが確認段） |
| 6 | 取込ファイルの選び直し（`resetResults`） | `/import/combo` | 無い | **無くてよい**（プレビューを捨てるだけ・再取得できる） |

**★一律にダイアログにしていない。** 原文が「永続、一時的なものは除く」と自ら除外を書いており、「動作していないのでは？と誤解しそう」への手当ては既存のトースト（`M17-05a` B-5）と進行表示（`ComboImportPage.tsx` の「取込中… 完了までお待ちください。」）が担っている。

**★他面で目に入ったもの（是正せず報告のみ・§1.6-4）**: `web/src/features/gamepad/components/GamepadCalibrationDialog.tsx:348` に **`window.confirm` が 1 か所残存**している（`if (!window.confirm("この機体の設定を初期化しますか？"))`）。`DeleteComboConfirm.tsx:22-23` が `architecture-patterns` §1.2.4 で「`window.confirm` 使用禁止」と明記している作法に反する。**本サブの面ではないため触っていない。**

### 2-C. 用語の全数（実査 8・母数 20 語）——**★1 語も変えていない**

数え直したコマンド（`ja.json` の `export.*` 25 ＋ `comboImport.*` 30 の値 ＋ `selectMode.enter` ＋ `ComboImportPage.tsx` の直書き日本語 16 か所 ＋ 新設ダイアログの本文を対象に、候補語 23 のうち出現したものを数えた）:

```bash
python3 - <<'PY'
import json, re
d = json.load(open("web/src/locales/ja.json", encoding="utf-8"))
def leaves(o, pre=""):
    for k, v in o.items():
        if isinstance(v, dict): yield from leaves(v, f"{pre}{k}.")
        else: yield f"{pre}{k}", v
vals = [v for k, v in leaves(d) if k.startswith(("export.", "comboImport.")) or k == "selectMode.enter"]
vals += re.findall(r'"([^"]*[ぁ-んァ-ヶ一-龠][^"]*)"', open("web/src/pages/ComboImportPage.tsx", encoding="utf-8").read())
vals += [open("web/src/features/combo-io/components/ImportCommitConfirmDialog.tsx", encoding="utf-8").read()]
blob = " ".join(vals)
terms = ["エクスポート","インポート","取込","取り込み","プレビュー","CSV","zip","ZIP","PDF","PNG","クリップボード","ファイル","ダウンロード","出力形式","出力項目","仮登録","レシピ","スキップ","セットプレイ","重複","検証","解析","ローカル"]
hit = [(t, blob.count(t)) for t in terms if blob.count(t)]
print(len(hit), hit)
PY
# → 20 語
```

**★`M24-07`（用語・i18n）へ渡す表。★印＝「エンジニア向けに見える」候補。**

| 用語 | 出ている面 | 言い換えの候補 |
|---|---|---|
| **★エクスポート**（13） | 一覧・マイコンボのボタン／ダイアログの題・実行ボタン／トースト／`selectMode.enter` | 「書き出し」「ファイルに保存」「持ち出す」 |
| **★インポート**（1） | ヘッダのナビ項目 | 「取り込み」（**★アプリ内に既に「取込」がある＝表記が 2 本立てになっている**） |
| **★取込 / 取り込み**（25 / 6） | 取込画面の見出し・ボタン・結果表／取込ヘルパー | **★まず「インポート」との統一が要る**。統一先を決めるのが `M24-07` の手番 |
| **★プレビュー**（11） | 取込画面のボタン・節見出し | 「取り込む前に確認」「下見」 |
| CSV（22） / zip（5） / PDF（3） / PNG（3） | 形式選択・入力欄のラベル | **★変えにくい**（ファイル形式の固有名。説明を添える方向） |
| **★クリップボード**（2） | ダイアログの形式選択 | 「コピーする」 |
| ファイル（6） | 入力欄・ファイル名欄 | そのまま |
| 出力形式（2） / 出力項目（1） | ダイアログの見出し | 「どの形で出すか」「何を出すか」 |
| 仮登録（8） | 取込プレビューの列・除外の説明 | **★アプリ全体の語であり単独で変えられない** |
| レシピ（2） / セットプレイ（14） | プレビュー表・列見出し | **★ドメイン語。変えない** |
| **★スキップ**（5） | 重複時の動作・取込結果 | 「取り込まない」「とばす」 |
| **★重複**（9） | 重複警告・重複時の動作 | 「同じコンボが既にある」 |
| **★検証**（2） / **★解析**（1） | 取込のエラー表示／プレビューボタンの実行中表示 | 「チェック」「読み込み中」 |

**★語を 1 つも変えていない**（指示書 §1.6-1 / §4.5・チェックリスト §0.3-1 / 1-8）。原文が「ただ私の感覚なので改めて検討は必要」と留保しており、`M24-07` が新語彙を確定させる手番である。

---

## 3. as-built（実装とテストを見て書いた。指示書からの転記ではない）

### 3-1. `SM-071` 取込で仮登録を除外する

- **新規** `web/src/features/combo-io/import-draft.ts`。判定を 1 か所に閉じた:
  - `isDraftExcluded(row)` ＝ `row.isDraft === true`
  - `isImportSelectable(row)` ＝ `row.importable && !isDraftExcluded(row)`
  - `splitDraftRows` / `countExcludedDrafts` / `selectableLocalIds`
- `ComboImportPage.tsx` の**3 か所**が `isImportSelectable` を通る（既定チェックの初期化 `:66` ／ `selectedLocalIds` `:115` ／ `toggleAll` `:150`）。**条件を散らさないのが要点**——1 か所だけ漏れると「除外したつもりの行が送られる」。
- 行チェックボックスは `disabled={!isImportSelectable(r)}`（`:322`）。**行は消していない。**「要確認 / エラー」列に `仮登録のため取込対象外` のバッジを出す（`:356`）。
- 件数行の下に `data-testid="import-draft-excluded"` の帯で **「仮登録の N 行を取込対象から除外しました(仮登録は取り込みません)。」**（`:283-291`）。

**★★BE は弾かない。** `internal/` は 1 行も触っていない。**⇒ API を直に叩けば仮登録は入る**（実査 2 のとおり、BE は `is_draft` を読んでそのまま `Create` へ渡す）。**これは不変条件ではなく「うっかり混ざるのを防ぐ」ための形である**（開発者裁定 2026-08-29・指示書 §4.1.1）。**害の形は「仮登録として DB に行が増えるだけ」であり、データは壊れず利用者は削除できる。**

**★§3.3-10 の連携口も同じフィルタを通る。** 取込ヘルパーは `useImportComboPreview` を手動経路と同一に叩く（実査 10）。**⇒ フィルタが効かない経路は残っていない。**

### 3-2. `SM-076` 0 件ファイル

- **「0 件」の定義（実装が採った定義）**＝**`comboFileError` が無く、`preview.combos.length === 0`**（`ComboImportPage.tsx:395`）。**空ファイルとヘッダ行だけの CSV は両方ともここに落ちる**（実査 3 で BE が同じ結果を返すことを確認済み）。**全行エラーは 0 件ではない**——行は返るので既存の表が理由を説明する。**ファイル自体が拒否された場合（`VAL-I04` 等）も 0 件表示は出さない**——理由が別だからである（テストで固定＝`ComboImportPage.test.tsx`）。
- 出す文＝**「取り込めるコンボ行がありません(0 件)。」**＋補足「ファイルが空か、見出し行だけの可能性があります。」（`data-testid="import-empty-preview"`）。

### 3-3. `SM-072` `/export/combo` の廃止

除去の全数は着手時に数えた **8 参照**（`grep -rn "/export/combo\|ComboExportPage" web/src web/e2e`）:

| 扱い | 対象 |
|---|---|
| **除去** | `web/src/router.tsx`（import 1 行・`<Route path="/export/combo">` 1 行）／`web/src/components/Header.tsx:31`（ナビ項目「エクスポート」）／`web/src/pages/ComboExportPage.tsx`（**289 行・ファイルごと**） |
| **失効記述の是正 3 件** | `ExportDialog.tsx:37`「エクスポート画面(ComboExportPage)は温存対象のため変更しない」／`CharacterSelector.tsx:25`「ComboExportPage の『キャラクター ID』数値入力…」／`m17-05b-export-flow.spec.ts:15`「本サブで温存対象であり」 |
| **E2E の書き換え** | `combo-csv-io.spec.ts:157` が唯一 `/export/combo` へ遷移していた。**ダイアログ経由へ書き換えた**（§5.2） |

**★§5.13a のダイアログへ移植していない**（指示書 §9.1）。**★`DES-005` §5.13 の節の廃止は設計卓の手番**であり、製造は設計書を編集していない（§7.4.1 の #4 に該当として報告）。

### 3-4. `SM-075` ファイル名の自動命名

- **新規** `web/src/features/combo-io/export-filename.ts`:
  - `EXPORT_RANGE_SLUG` ＝ `{ all:"all", filter:"filtered", selected:"selected", mycombo:"mycombo" }`（**日本語を入れない**）
  - `formatExportTimestamp(now)` → ローカル時刻の `YYYYMMDD-HHmmss`
  - `formatExportBaseName({range,count,now})` → **`combos_{slug}_{count}_{YYYYMMDD-HHmmss}`**（純粋）
  - `createExportBaseNameIssuer()` / `issueExportBaseName` → **直前と同じ名前なら連番を足す**
  - `sanitizeExportBaseName(input)` → 利用者が書き換えた名前からパス区切り・制御文字・環境依存文字を落とす
  - `withExtension(base, ext)`
- **★連番の払い出しが要る理由（実装判断・指示書に無い）**: 書式は**秒までしか持たない**ため、同じ秒に 2 回出すと書式だけでは衝突する。§4.4 の核心は「連続エクスポートで衝突しない形にすること」であり、§5.1 が純粋関数テストへ **「連続で呼んで衝突しないこと」** を明示的に課している。**⇒ 衝突しないことは書式ではなくここで守られている**（破壊確認 4b で確かめた＝§6）。
- **編集可能な欄**（`ExportDialog.tsx`）: 自動生成値を**初期値として入れる**。**利用者が書き換えていない間**は対象・件数の変化に追従し（`useEffect`）、**出力のたびに `issueExportBaseName` で採り直す**。**書き換えていれば尊重する**（`SM-088` と同じ作法）。**空にして実行したら自動値へ倒す**（名前の無いファイルを作らない）。
- **★名前に載る対象の種別**: ワイヤ値は常に `"selected"`（§5.13a の WYSIWYG 契約）だが、**利用者から見た対象は「選択中」か「現フィルタ結果」かで違う**ため、`isSelectionActive` で `selected` / `filtered` を出し分けた。
- ベース名は `triggerDownload` の**本番 3 か所すべて**へ通した（`api.ts:52-67` の `useExportCombo`（`ExportCsvVariables` を新設）／`render-and-capture.tsx:178,191`／経由する `run-export.ts`）。**拡張子は形式ごとに付く**ため、複数形式を同時に出しても 1 つのベース名を共有する。
- **★`combomgr-combo` / `combomgr-combos` の単数・複数の出し分けは無くなった**——名前に入る件数がその区別を担うためである（`render-and-capture.tsx` の `single` 変数は PDF のページ計画側にだけ残っている）。

**★★逸脱として報告する 1 件**（playbook §4.42）: 指示書 §4.4 は **「適用面＝`/export` と §5.13a のダイアログの両方（片方だけだと作法が割れる）」** と定めているが、**`/export` は §4.3 の実態確認と開発者判断により廃止したため、その面が存在しなくなった**。適用先はダイアログのみである。**これは「片方だけに入れた」のではなく「片方が消えた」結果であり、作法は割れていない。**

#### 3-4-1. ZIP の中のエントリ名には及ぼしていない

`internal/service/comboio/types.go:11-13`（`comboCSVName` / `setupCSVName`）と `internal/api/comboio/handler.go:42-43`（`comboEntryName` / `setupEntryName`）は **1 文字も変えていない**（`internal/` の差分 0）。自動命名は **FE の `triggerDownload` の第 2 引数まで**で止めた。

**★同じ文字列が 2 パッケージに独立して定義されている**（export 側と import 側）。**片方だけ変えると往復対称が黙って壊れる形である。** 破壊確認 5 で実際に壊して確かめた（§6）。

### 3-5. `SM-110` 用語

**候補を挙げるまで。1 語も変えていない**（§2-C）。

### 3-6. `SM-121` 確認ダイアログ

- **新規** `web/src/features/combo-io/components/ImportCommitConfirmDialog.tsx`。**`web/src/components/ui/alert-dialog.tsx` を土台にした**（規則9。自作オーバーレイは `lib/modal-presence` の物理入力抑止に乗らない＝`ConflictDialog.tsx:32-33` / `PreSaveDuplicateDialog.tsx:15-16` が同じ注意を書いている）。
- **★汎用の `ConfirmDialog` は本リポに存在しない。** 用途別の薄いラッパを `alert-dialog` の上に並べるのが流儀であり（本番の使用は 14 ファイル）、その流儀に合わせた。
- 本文に**取込対象の件数と除外した仮登録の件数**を出す（「N 件のコンボを取り込みます。仮登録の M 件は取り込みません。この操作は取り消せません。」）。
- **★文言は固定 ja**（実装判断）。`ComboImportPage` は可視文言をすべて直書きしており（`useTranslation` は取るが `t()` の直接呼び出しは 0 件・i18n は VAL コードの写像だけ）、**`DES-005` §5.19 も import/export 系を固定 ja の流儀と明記している**（「i18n キーは追加しない（import/export 系の**固定 ja** 流儀＝§5.13 の i18n 境界注記）」）。**新しい流儀を作らないことを優先した。**
- 一方 **`ExportDialog` は i18n 済み**のため、ファイル名欄の 2 キー（`export.dialog.fileNameLabel` / `fileNameHint`）は **ja / en の両方**へ足した（`locales.test.ts` が双方向で parity を強制する）。

### 3-7. `CO-023`（`G-15`）

**実装していない。着手時点で 4 点すべて入っていた**（実査 9）。**⇒ 成立をテストで固定した。** `ComboImportPage.test.tsx` に「mutate の onSuccess ではなく `previewM.data` を購読して表示する」を置き、**`previewMutate` が 1 度も呼ばれていないのに表が出ること**をアサートしている。**着手時点で `ComboImportPage` のコンポーネントテストは 1 本も無かった。**

**★残っている余地**: followup `G-15`(a) が挙げる「将来 router 層で 1 回だけ値を渡す形へリファクタする余地」は**本サブでも未実施**（指示書がスコープに含めておらず、推測でスコープを広げない）。`G-15`(b)（「候補:」先頭提示が実質フォールバック）も本サブの面ではない。**⇒ `G-15` は閉じきっていない**（§8）。

---

## 4. モック HTML

`docs/progress/M24-06-mock/m24-06-import-export-ux.html`（単一 HTML・外部依存なし）。**承認直後・コード変更前**に提示した（followup `mock-presentation-timing-vs-plan-mode`）。変更前と変更後を並べ、赤枠＝無くなるもの／緑枠＝増えるもの で示した。

---

## 5. テスト

### 5.1 追加したテスト

| 層 | ファイル | 内容 |
|---|---|---|
| 純粋関数 | `export-filename.test.ts`（23 ケース） | 書式 ／ 4 slug ／ 件数・日時の埋め込み ／ **連続で呼んで衝突しないこと**（同一秒 2 回・3 回以上・秒が変われば連番なし・対象や件数が違えば連番なし・払い出し口の独立） ／ 名前の均し |
| 純粋関数 | `import-draft.test.ts`（14 ケース） | 仮登録の判定 ／ **`isImportSelectable` の条件漏れの固定**（4 通りの組み合わせ全部） ／ 行を落とさないこと ／ 並びを保つこと |
| コンポーネント | `ComboImportPage.test.tsx`（11 ケース・**新設**） | `previewM.data` 購読（`CO-023` の成立固定） ／ 除外件数 ／ 0 件表示（ファイル拒否時は出さない対照つき） ／ 確認ダイアログ（押しただけでは取り込まない・本文の件数・キャンセル） |
| コンポーネント | `ExportDialog.test.tsx`（+6 ケース） | 自動生成値が初期値に入る ／ 種別と件数 ／ 書き換えを尊重 ／ 空なら自動値へ倒す ／ **連続実行で同じ名前を渡さない** |
| E2E | `m24-06-import-export-ux.spec.ts`（**4 ケース**） | (1) 仮登録の除外と件数 ／ (2) 0 件ファイル ／ (3) **連続エクスポートでファイル名が衝突しない** ／ (4) **自動命名で出した ZIP をそのまま取り込める（往復対称）** |

**★E2E の共通の下ごしらえを `web/e2e/support/combo-io.ts` へ寄せた**（`D-553`）。**着手時点で CSV アップロードの共通ヘルパは存在せず、`setInputFiles` は `combo-csv-io.spec.ts` の 2 か所だけだった。**

### 5.2 既存テストの扱い

**ファイル名をアサートしていた箇所＝8 ステートメント**（母数）。**全部書き換えた。★検証内容は緩めていない。**

**★母数を数え直したコマンド**（レビュー 中-1 で「7」が誤りと分かったため、着手基点で採り直した。**内訳表の 4+2+2 は 8 であり、当初の本文 7 と食い違っていた**）:

```bash
for f in $(git ls-tree -r --name-only 87e4e73 web/e2e | grep '\.spec\.ts$'); do
  git show "87e4e73:$f" | grep -cE 'suggestedFilename\(\)\)\.(toBe|toContain)|filenames\.some|f\.endsWith'
done | paste -sd+ | bc
# → 8
```

| 種別 | 箇所 | 旧 → 新 |
|---|---|---|
| 厳密一致 `toBe` 4 | `m17-05c-pdf-pagination.spec.ts:75,105` ／ `m17-05c-fix-output.spec.ts:100,119` | `toBe("combomgr-combo(s).pdf")` → `expectExportFilename(name, { extension:"pdf", count })`。**★旧アサートが「単数／複数」で表していた区別は、件数セグメントの明示（`count: 1` / `count: ids.length`）で引き継いだ。書式全体も正規表現で固定しているため、旧より強い** |
| `toContain(".zip")` 2 | `combo-csv-io.spec.ts:161` ／ `m17-05b-export-flow.spec.ts:185` | 拡張子だけ → **書式全体を固定** |
| `endsWith` 2 | `m17-05b-export-flow.spec.ts:77-79` | 拡張子だけ → **書式全体 ＋ 件数 2 を固定** |

**★`combo-csv-io.spec.ts` は取り込む行を仮登録から本登録へ変えた（構造の変更）。** 従来 仮登録を使っていた理由は `VAL-C02` の重複判定を避けて再実行を冪等にすることだったが、**`SM-071` により仮登録は 1 行も取り込めなくなった**ため成立しない。**代わりに前後で fixture を掃除して冪等性を保つ**（`deleteCombosByMemoPrefix`。論理削除した行は `FindActivePublishedDuplicates` の母集団から外れる）。**spec ヘッダの説明も同時に直した**（本文を直してヘッダを残すと失効記述になる）。

- **`M17-05a` / `M17-05b` / `M17-05c` の spec は 1 本も落としていない**（`make e2e` 226 passed に含まれる）。
- **`m17-04-intake-helper.spec.ts:59-61`（取込ヘルパーの連携口）も落としていない**——§3.3-10 の連携口を守る唯一の観測である。
- **`getByRole` の `name` の部分一致対策**: 破壊確認は文言の「追記」ではなく**実装の構造を変える形**で行った（§6）。

### 5.3 自己テスト結果

**★着手前の `make e2e`（基準値）は採っていない**（`D-594` / `D-600`。開発者の追加指示 1）。直前にマージされたサブ（`M24-05`・PR #122）の完了報告が `make e2e` の全数緑を明記していることだけを確認した（`M24-05-completion-report.md:176`）。**⇒ 本報告は件数の増減を主張しない。**

| コマンド | 結果 |
|---|---|
| `go test ./... -count=1` | **全パッケージ ok**（`FAIL` 行なし）。**★本サブは Go を触っていないことの対照**——`git diff --stat 87e4e73` に `internal/` / `cmd/` / `migrations/` が 1 ファイルも現れない |
| `cd web && pnpm test`（vitest） | **全数緑（202 files / 2246 tests passed）** |
| `cd web && pnpm build` | **緑**（`error TS` なし）。**★フロントの型検査はここで見る**（開発者の追加指示 3。`tsc --noEmit` はテストファイルを型検査しないため、緑のまま `make e2e` の webServer 起動で落ちる） |
| `make e2e` | **全数緑（226 件）** |

**★`make e2e` 実行直前のポート確認**（§2.4）——**ここで計測器そのものを取り違えかけた。以下は是正後の手順である。**

```
$ (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E '47390|5273' || echo "→ 47390 / 5273 ともに空き"
→ 47390 / 5273 ともに空き        ← ★この出力は無意味だった

$ command -v ss; command -v netstat
（どちらも無い）
```

**★★`ss` も `netstat` も本環境に存在しない。⇒ grep が常に空振りし、ポートが埋まっていても「空き」と答える**（`M24-09c` / `D-570` と同じ機序）。**playbook §4.37 のとおり計測器を対照実験で確かめて差し替えた。**

```
$ # 対照実験: 既知の listener を立てて、計測器が USED と答えるか
47999: USED     ← 実際に listen しているポート
47998: free     ← していないポート
$ # 本番(make e2e 実行直前・毎回)
47390: free
5273: free
```

計測器は python の `socket.connect_ex(("127.0.0.1", port)) == 0` で判定する 6 行のスクリプトである。**対照が通ることを確かめてから使った。**

### 5.4 開発者の実機確認（2026-08-30）

**★製造環境では実画面を見られないため、開発者が実機で確認した。3 件とも通過。**

| # | 確認したこと | 結果 |
|---|---|---|
| **1** | ヘッダのナビから「エクスポート」が消え、`/export/combo` を直接開くとホームへリダイレクトされる（`router.tsx:51` の catch-all） | **確認できた** |
| **2** | ファイル名欄に自動生成値が入り、**続けて 2 回出したファイル名が違う**こと。ブラウザを「保存場所を確認する」設定にしたとき、**保存ダイアログに自動生成名が入る**こと | **確認できた**（★`suggestedFilename()` は「ブラウザの提案名」までしか見ないため、実保存の経路はここでしか確かめられない） |
| **3** | 取込の 3 つの見え方——仮登録の除外の帯と灰色の行 ／ 0 件ファイルの文 ／ 取込実行の確認ダイアログ | **確認できた** |

**★この節を置いた理由**: レビューが **「開発者判断の逐語の痕跡が完了報告の引用以外に無く、レビュー側で検証できない」** と指摘した（正当な指摘である）。**⇒ 開発者が確認・判断した事実は、会話ログではなく報告書側へ残す。** 同じ趣旨をプロセスの申し送りにも上げてある（設計伝達レポート §5-5）。

---

## 6. 破壊確認（**5 件 ＋ 追加 1 件**）

**書く前に 3 つを確かめた**（playbook §4.32）——(a) 壊す対象が実在するか ／ (b) その壊し方で観測が変わるか ／ (c) 期待経路は「その観測が何を見ているか」から立てる。**クラスを足す形は採っていない**（jsdom は Tailwind を読まない＝`M24-12` の教訓）。**すべて構造を変える側で壊した。**

**★★2 件で「壊し方そのもの」を作り直した。** 単純な早期 return で壊すと **`noUnusedParameters` / `TS18047` でビルドが落ち、「テストが赤い」ではなく「起動しない」**になる（`make e2e` は `pnpm build` を通るため webServer が上がらない＝**赤の意味が確かめられない**）。**⇒ 引数を使ったまま結果を捨てる形／条件を never true にする形へ変えた**（`M24-05` が同じ壁に当たっており、その記録が役に立った）。

| # | 壊したもの | 実際の結果 | 赤くなった経路 |
|---|---|---|---|
| **1** | `isDraftExcluded` を `row.isDraft === true && false` にする（フィルタを外す） | **予測どおり赤。** `import-draft.test.ts` **6 failed / 8 passed**、`ComboImportPage.test.tsx` **4 failed / 7 passed**、E2E (1) 赤（retry も赤） | **3 層 11 経路**（純粋関数 6 ／ コンポーネント 4 ／ E2E 1） |
| **2** | 除外件数の帯の描画条件を `false && …` にする | **予測どおり赤。** `ComboImportPage.test.tsx` **1 failed / 10 passed**、E2E (1) 赤（`toHaveText` 失敗） | **2 層 2 経路** |
| **3** | 0 件表示の条件を `preview.combos.length < 0` にする | **予測どおり赤。** `ComboImportPage.test.tsx` **1 failed / 10 passed**、E2E (2) 赤（retry も赤） | **2 層 2 経路** |
| **4a** | `formatExportBaseName` から日時を外す（`combos_{slug}_{count}` へ） | **予測どおり赤。** `export-filename.test.ts` ＋ `ExportDialog.test.tsx` で **11 failed / 28 passed**、**E2E (3) 赤 ／ E2E (4) 赤 ／ `m17-05c-fix-output` の 2 ケースも赤** | **3 層 15 経路** |
| **★4b** | **連番の払い出しだけを外す**（書式は保つ＝衝突回避だけを外す） | **★1 回目 E2E (3) が赤（`expect(names[0]).not.toBe(names[1])` で失敗）だが、retry は緑になった。** `export-filename.test.ts` ＋ `ExportDialog.test.tsx` は **3 failed / 36 passed** で決定的に赤 | **下記のとおり要注意** |
| **5** | **ZIP 内エントリ名にも自動命名を及ぼす**（`comboCSVName` を `combos_filtered_1_20260830-143512.csv` へ） | **予測どおり赤。** **E2E (4) 赤（retry も赤）** ＋ **Go の `internal/service/comboio` が 4 テスト赤**（`TestExportRoundTripAndDuplicateSkip` / `TestMediaFieldsExportImportRoundTrip` / `TestExport_TagsAreScopedToExportingUser` / `TestImportSetupsOnlyParentResolution`）。E2E (1)(2)(3) は緑のまま＝**往復対称だけを狙って壊せている** | **2 層 5 経路** |

**★★破壊確認 4b が示したこと（指示書に無い発見）。** **E2E (3) 単独は「衝突しないこと」の信頼できる検出器ではない。** 2 回の出力が同じ秒に落ちたときだけ衝突が起き、retry が秒をまたぐと緑になる。**衝突しないことを決定的に守っているのは純粋関数テスト**（`createExportBaseNameIssuer > 同じ秒に連続で呼んでも名前が衝突しない`。クロックを注入するため決定的）である。**⇒ 4a で E2E (3) が赤くなったのは「書式の正規表現」が捕まえたからであって、衝突の検出ではない。** 出荷される実装では連番があるため E2E (3) は決定的に緑であり、**flaky ではない**（壊した状態でだけ揺れる）。

**★破壊確認 5 の副産物**: 当初「Go は全緑のまま」と読んだが、それは `head -20` で出力を切っていたための誤読だった。**Go の `internal/service/comboio` は 4 テストが赤くなる＝往復対称は Go 側でも守られている。** ただし**エントリ名の定数が export 側と import 側で独立に定義されている**ため、**両方を同時に変えれば Go テストも E2E も緑のまま契約が壊れうる**（両者が一致してしまうため）。**⇒ この形は残っている**（§8）。

**★5 件（＋1 件）とも実施後に完全に復元し、`git status --short` が空であることを確認したうえで全テストを再実行して緑に戻した**（`go test ./...` 全 ok ／ vitest 202 files / 2246 tests ／ `pnpm build` 緑 ／ `make e2e` **226 passed**）。

---

## 7. ■ 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **消費した CHANGE 番号の登録** | **なし。** `CHANGE-144` は設計卓が起票済みで、**製造は番号を消費していない**。`change-number-registry.md` §1 への追記は不要 |
| **「次の番号」の写し先（実査 4 か所）** | **なし。** 番号を消費していないため動かない |
| **消費したマイグレ連番** | **なし。** `ls migrations/ \| tail -1` ＝ `000079_*`。**次に払い出す番号は `000080`** で、ボード §2.2 と一致している（動かしていない） |
| **版を上げた文書の参照元** | **なし。** 本サブで版を上げた文書は無い（指示書・チェックリスト・通知書はいずれも設計卓が v1.2.0 まで上げ済み） |
| **ブラウザストレージ台帳** | **なし。** 新キー 0（`check-browser-storage-keys.sh` 緑・台帳と実装が一致） |
| **`web/CLAUDE.md`** | **なし。** 台帳にも §2 のコンボ型 3 分岐にも変更なし |

---

## 8. §7.4.1 CHANGE 要否の判定（as-built で 1 件ずつ）

| # | 条件 | 判定 |
|---|---|---|
| **1** | `DES-002` §4.2 の経路表に載る API を新設・変更したか | **していない。** `internal/` の差分 0。確認事項 1 は FE 案で決着済みのため案 B の分岐に入っていない |
| **2** | `DES-006` の取込 VAL に触れたか | **していない。** `csvcore` / `import.go` とも無変更。**★指示書・チェックリスト・通知書は一貫して「`DES-006` §5（取込 VAL）」と書いているが、`docs/design/06-validation.md` の §5 はタグ編集のバリデーションであり、取込 VAL（`VAL-I01`〜`I10`）は §6 である。⇒ §6 を正として扱った**（§9 の申し送り） |
| **3** | `DES-003` のスキーマに触れたか | **していない。** マイグレ消費 0 本 |
| **★4** | **`DES-005` §5.13 を廃止したか** | **★★該当する。** `/export/combo`（`ComboExportPage`）を廃止した。**⇒ 設計卓へ報告する。★節の廃止は設計卓の判断であり、製造は設計書を編集していない。** あわせて **§5.13a（ダイアログ）へファイル名欄が増えた**ことも `CHANGE-144` の射程である |
| **5** | `SUPP-001` の契約を持つ節に触れたか | **していない**（`D-564`） |
| **6** | ブラウザストレージのキーを新設・変更したか | **していない。** `check-browser-storage-keys.sh` 緑 |
| **7** | マイグレーションを消費したか | **していない**（見込みどおり 0 本）。**⇒ ボード §2.2 の連番セルの更新は不要** |

**★判定した結果「射程は広がらなかった」ではない。#4 で射程は動いている**（`DES-005` §5.13 の節の廃止 ＋ §5.13a への追記）。**いずれも `CHANGE-144` の影響設計書に既に含まれている**ため、新しい CHANGE 番号は要らない。

---

## 9. 品質チェック

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh`（**1 本目に回した**） | **違反なし**（検査 11 件の自己検査 OK ／ 生成物 4 件 OK） |
| `bash scripts/check-md-emphasis.sh` | **違反なし**（ベースラインどおり・増加なし） |
| `bash scripts/check-doc-refs.sh` | **dead reference なし** |
| `bash scripts/check-progress-log-index.sh` | **違反なし**。**★同検査は偽の緑を返しうる**ため（followup §AH）、緑の確認だけでなく `grep -n "M24-06" docs/progress/progress-log.md` で追記行を目で確かめた |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり**（増加なし） |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳と実装が一致） |

---

## 10. 申し送り（設計伝達レポート §4 へ回す候補）

1. **★`DES-006` の節番号の誤り**（§8 の #2）。指示書 v1.2.0・チェックリスト v1.2.0・`CHANGE-144` v1.2.0 の 3 文書が一貫して「`DES-006` §5（取込 VAL）」と書いているが、正しくは **§6** である。**3 文書とも設計卓の手番。**
2. **★`P11` の欠陥候補**（§2-A）。`/export/combo` が視覚出力に `videoPath` / `imagePath` を通していた（`CHANGE-073` の意図に反する）。**廃止で面ごと消えたため実害は消えたが、ダイアログ側にだけ除去があるという非対称の記録として残す。**
3. **★他面の確認ダイアログの不足**（§2-B）。`GamepadCalibrationDialog.tsx:348` の `window.confirm` 残存。**是正は本サブの面ではない。**
4. **★`SM-110` の用語候補 20 語**（§2-C）を `M24-07` へ渡す。**とくに「インポート」と「取込」がアプリ内で 2 本立てになっている**のは、語を選ぶ前に統一の要否を決める必要がある。
5. **★`CO-023`（`G-15`）は閉じきっていない**（§3-7）。(a) の router 層リファクタと (b) の「候補:」先頭提示は本サブの射程外。**⇒ followup を閉じるかは設計卓の判断。**
6. **★ZIP エントリ名の定数が 2 パッケージに独立して定義されている**（§6 の破壊確認 5 の副産物）。`internal/service/comboio/types.go:11-13` と `internal/api/comboio/handler.go:42-43`。**両方を同時に変えると Go テストも E2E も緑のまま `DES-002` §7.6 の契約が壊れる。** 定数の一本化は `internal/` に触るため本サブでは行っていない。
7. **★★`FR401` の見直し（開発者の指示・2026-08-30）。** 開発者が実機確認のあとに **「`FR401` 側の見直しをしたい」** と判断した。**★案の正本は設計伝達レポート §4.1 である**（before / after の逐語・根拠 5 点・設計卓が決めること 3 点）。**本報告では本文を二重に持たない。** 骨子だけ書くと——**`REQ-001` で「バックアップ」に触れるのは `FR401` の括弧書き 1 か所だけで、バックアップの FR は存在せず、実機構は `NFR201` → `DES-002` §6.3 に設計だけが先行している。** ⇒ `FR401` の語が別の責務を肩代わりしている。
8. **★★`/export/combo` の廃止で失われた機能 2 件を、`M24-07` 以降の判断材料として残す**（レビュー 高-3）。**(a) キャラ横断の一括出力（P1）＝代替なし。** `useResolvedCharacterId` は必ず 1 キャラへ解決するため、UI に「全キャラ」という状態が存在しない。**`FR401` が CSV を「バックアップ・データ移行用途」と位置づけていることと直結する。** **(b) 任意コンボ ID の直接指定（P4）＝代替なし。** **★どちらも「残す価値なし」と開発者が判断して廃止したものであり、欠陥ではない。** ただし**将来「全キャラのバックアップが要る」となったら、戻す先はダイアログではなく別の手段（DB ファイルのコピー、またはバックアップ機能の実装）である**ことを記録しておく。
9. **★仮登録のコンボは往復で復元できない**（レビュー 中-5）。エクスポートした CSV は `is_draft=true` を保持するが、**取込側が `SM-071` で仮登録を除外する**ため、出した仮登録は取り込み直せない。**⇒ `DES-002` §7.6 の「往復対称」は本登録のコンボについて成立し、仮登録については成立しない。** これは `SM-071` の要求（仮登録は取り込みたくない）の直接の帰結であり欠陥ではないが、**設計書に 1 行残さないと後任が「往復が壊れている」と起票する。**
10. **★CSV エクスポートの 1000 件の静かな打ち切り**（§2-A）。`export.go:28-32` のコメントも「利用者通知は将来サブで検討」と書いている。**`FR401` が CSV を「バックアップ・データ移行用途」と位置づけている以上、静かに欠けるのは齟齬である。** 本サブの射程外。
11. **★アプリ内バックアップ／リストアが未実装のまま画面に出ている**（`SettingsSectionData.tsx:22-45` の `disabled` 3 ボタン）。**`/export/combo` の廃止判断の前提になった事実**であり、記録として残す。

---

*以上、M24-06 完了報告。* **★★最大の判断は `/export/combo` の廃止であり、実態確認 → 停止 → 開発者判断 → 廃止 の順で行った**（`CO-002` と同じ手順＝消す前に母集団を数える）。**★★`SM-075` の自動命名は外側のファイル名だけに及ぼし、ZIP の中のエントリ名は `combos.csv` / `setups.csv` のまま固定した。** **★`SM-071` は FE で除外し、BE は弾かない（API 直叩きでは入る）。** **★`SM-110` は 1 語も変えていない。**
