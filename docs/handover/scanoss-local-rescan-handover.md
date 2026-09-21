# SCANOSS ローカル実行・devContainer 持込手順

## 1. 目的

公開前の SCANOSS 再スキャンを、次の二段構成で再現可能に実行する。

1. Windows ローカルで clone、固定 commit の正当性確認、対象抽出、SCANOSS 実行、持込 ZIP 作成まで行う。
2. devContainer で持込 ZIP、Git blob、結果件数、初回結果との差分を検証する。

正常時は要約だけを表示し、異常時は処理を停止して日本語の理由を表示する。実行者が途中の
`True` / `False` や大量の JSON を読み取って判定する必要はない。

## 2. 前提

Windows 側:

- PowerShell 7
- Git for Windows
- Python 3.13 と Python Launcher (`py.exe`)
- `tar`（Git for Windows または Windows 付属）
- GitHub と SCANOSS API へ接続できること
- Norton 等のウイルス対策ソフト

devContainer 側では、検査対象 commit を含む `combomgr` clone と Python 3 が必要である。

SCANOSS CLI はスクリプトが専用 venv
`<作業ルート>\.scanoss-tools\venv-1.54.2` に固定版を準備する。プロジェクトの Python 環境や
devContainer の firewall を変更しない。

## 3. Windows ローカルでの実行

### 3.1 検査対象 SHA を決める

是正用マイルストーンを完了して `main` へマージした後、公開候補の 40 桁 commit SHA を決める。
ブランチ名や `HEAD` は指定しない。以下では `<40桁SHA>` をその値へ置き換える。

### 3.2 スクリプトを実行する

Windows 側の作業ルート（例: `C:\Users\altle\tacpendium`）で、公開候補の clone に含まれる
スクリプトを実行する。

```powershell
Set-Location C:\Users\altle\tacpendium

& .\combomgr-source\scripts\run-scanoss-local.ps1 `
    -Ref "<40桁SHA>" `
    -WorkspaceRoot (Get-Location).Path
```

初回は `combomgr-source` がなければ HTTPS で clone する。既にある場合はその clone を使う。
SSH 鍵は使わない。スクリプトは次を自動検証する。

- origin が `https://github.com/plexiblinp/combomgr.git` であること
- clone が clean かつ非 shallow であること
- 指定 SHA が commit として同一に解決されること
- `cmd/`、`internal/`、`web/src/` の抽出一覧が Git tree と一致すること
- 抽出した全ファイルの Git blob SHA-1 が元 commit と一致すること
- `.env`、秘密鍵、DB、`.git`、`node_modules` 等が対象へ混入していないこと
- WFP と結果 JSON のファイル件数が一致すること
- SCANOSS CLI が固定版で、Python 依存関係が壊れていないこと

成功すると、次のような一つの持込 ZIP が表示される。

```text
C:\Users\altle\tacpendium\scanoss-YYYYMMDD-HHMMSS-<短縮SHA>\scanoss-import-<短縮SHA>.zip
```

ローカルの run directory には source、WFP、元 JSON も残る。持込 ZIP にはソース本体と WFP を
含めず、検証に必要な manifest、結果、要約、ハッシュだけを含める。

### 3.3 ウイルススキャンと持込

表示された持込 ZIP を Norton でスキャンする。問題がなければ、その ZIP 一つだけを
devContainer の次の場所へコピーする。

```text
/workspaces/combomgr/tmp/
```

ZIP を展開してから持ち込む必要はない。ローカル側の source directory、venv、tar、WFP を
リポジトリへコピーまたは commit しない。

## 4. devContainer での検証

ブランチが公開候補 commit を含むことを確認したうえで、次だけを実行する。

```bash
python3 scripts/verify-scanoss-import.py \
  tmp/scanoss-import-<短縮SHA>.zip
```

検証スクリプトは次を自動確認する。

- ZIP のファイル構成、全成果物の SHA-256 とサイズ
- 持込元で固定した commit が devContainer の Git に存在すること
- 持込元の source manifest と devContainer 側 commit の全 path / blob SHA-1 が一致すること
- 元 JSON と整形 JSON が同値であること
- metadata、JSON、CSV の件数が一致すること
- 初回 evidence に対する match の追加、解消、継続

成功時の出力先:

```text
tmp/scanoss-validated-<短縮SHA>/
```

実行者が確認するのは次の二つだけでよい。

1. `validation-report.md`: 全体件数と検証結果
2. `scan-match-delta.csv`: `added`（新規）、`removed`（解消）、`unchanged`（継続）

検証失敗時は持込結果を採用しない。表示された理由を解消し、新しい run directory で Windows
側から再実行する。既存 run directory や検証済み出力を上書きしない。

## 5. 是正後スキャンの合格条件

- `web/src/hooks/useIsMobile.ts`
- `web/src/hooks/useSessionStorage.ts`
- `web/src/hooks/useRecentCombos.test.ts`
- `web/src/features/setup/hooks/useUpdateSetup.ts`
- `web/src/features/setup/hooks/useDeleteSetup.test.ts`

上記 5 件について、初回の要レビュー一致が `removed` になっていることを確認する。shadcn/ui
由来コードは MIT 帰属を追加したうえで、SCANOSS の派生リポジトリ名ではなく公式上流由来として
扱う。新規の `added`、copyleft 表示、ライセンス空欄、高率一致があれば、公開前に個別確認する。

最終的に永続化する資料は、公開候補 SHA、ツール版、集計、差分、個別判定を含む最終報告と
必要最小限の CSV である。source、WFP、外部リポジトリ clone、巨大な生 JSON は Git に入れない。

## 6. 証拠の扱い

非公開の `combomgr` が検出先より先に実装していても、公開 `tacpendium` の履歴だけを見ると
後追いに見える場合がある。公開文書へ非公開履歴を丸ごと出す必要はない。問い合わせを受けた場合に、
非公開側の first commit SHA、author date、当時の内容、SCANOSS の検出先 release date を提示できる
状態で保持する。方針の正本は
`docs/progress/M26-04-scanoss-followup-report.md` §7.1 とする。

## 7. 関連資料

- `docs/process/public-release-runbook.md` §2.A A-1
- `docs/progress/M26-04-scanoss-followup-report.md`
- `docs/progress/evidence/m26-04-scanoss/`
- `scripts/run-scanoss-local.ps1`
- `scripts/verify-scanoss-import.py`
