# M25-RESEARCH-01 調査報告: フェーズ4 スコープ 3 層 ledger

## §0 調査条件

### §0.1 baseline と実施日

- baseline commit: `841e8ecda9fe44f0c9ac51a4d98befbbfb1d501c`（開発者提示値。worktree 規律により本調査中は Git 操作を行っていない）
- 実施日: 2026-09-01 UTC
- 指示書: `docs/instructions/M25-RESEARCH-01-phase4-scope-ledger.md` v1.1.0
- 書き込み: 本報告と `docs/progress/progress-log.md` の索引行だけ。実装・マイグレ・seed・設計書・followup は変更していない。

### §0.2 走査コマンド全文

```bash
awk -F'|' '/^\\| `SM-[0-9]+`/ {id=$2; gsub(/`|^[ \\t]+|[ \\t]+$/, "", id); x=$3; gsub(/^[ \\t]+|[ \\t]+$/, "", x); if (!seen[id]++) print id "\\t" x}' docs/progress/M24-RESEARCH-01-report.md
awk -F'|' '((NR>=764 && NR<=1149) || (NR>=1150 && NR<=1200)) && /^\\|/ && $2 ~ /\\`[a-z0-9][a-z0-9-]+\\`/ { print NR, $2 }' docs/handover/followup-backlog.md
awk 'NR>=354 && /^・/ {n++} END{print n}' docs/human-notes/Memo_Someday.txt
rg -n '^・' docs/human-notes/phase4-memo.txt
rg --files docs/human-notes/future-notes | sort
rg 'g\\.(GET|POST|PUT|PATCH|DELETE)\\(' internal/api -g 'routes.go'
sed -n '1,115p' internal/api/middleware/auth.go
sed -n '295,370p' cmd/combomgr/main.go
rg -n -i 'LAN モード API 無認証一般|password_enabled|簡易ログイン' docs/design docs/handover
rg -n 'INSERT INTO characters|DELETE FROM characters' migrations/*.up.sql
rg --files character_data -g '*.csv' | sort
rg -n -i 'リバーサル|reversal|Dリバ|ドライブリバーサル' docs/instructions/M18* docs/progress/M18*
env GOCACHE=/tmp/combomgr-m25-research-go-cache go test -count=1 -json -run '^TestInsert_OnlyEmitsGivenColumns$' ./internal/testutil/dbtest
TIMEFORMAT='M25_FULL_TEST_ELAPSED=%R'; time env GOCACHE=/tmp/combomgr-m25-research-go-cache go test -count=1 ./...
```

### §0.3 数えた範囲

基準時点は上記 baseline の指定 worktree。単位は、源泉1は M24 §2.2 の SM 行、源泉2は正式リリース前後の要求 identity、源泉3は followup §AF〜§BA と §J のスラッグ行、源泉4は INDEX の「将来機能・研究ノート」のファイル行、源泉5は checklist 指定項目、源泉6は箇条書き、源泉7は §3-1 と指示書 F の和集合、補は末尾未分類領域の意味単位である。line 405 は line 391 の逐語重複なので補の raw identity では1件と数えた。

## §1 母集団（軸 A）

### §1.1 M24 集計と正本 ledger の照合

| 返却先 | §2.1 記載 | §2.1 ID 列挙数 | §2.2 正本実数 | 判定 |
|---|---:|---:|---:|---|
| フェーズ4 | 30 | 29 | 28 | §2.2 の 28 が正本 |
| M14 / update wave | 12 | 14 | 14 | §2.2 の 14 が正本 |

フェーズ4の実数は 28 件: `SM-023` / `SM-024` / `SM-025` / `SM-026` / `SM-027` / `SM-028` / `SM-030` / `SM-031` / `SM-032` / `SM-033` / `SM-034` / `SM-035` / `SM-042` / `SM-046` / `SM-050` / `SM-081` / `SM-087` / `SM-100` / `SM-105` / `SM-106` / `SM-116` / `SM-123` / `SM-124` / `SM-125` / `SM-134` / `SM-135` / `SM-138` / `SM-147`。

M14/update wave は 14 件: `SM-055` / `SM-056` / `SM-063` / `SM-070` / `SM-082` / `SM-091` / `SM-102` / `SM-108` / `SM-113` / `SM-114` / `SM-115` / `SM-132` / `SM-137` / `SM-140`。

食い違いは SM-029 の注記だけでは説明できない。§2.1 のフェーズ4列挙は SM-029 を含む29件だが、§2.2 の SM-029 の返却先は「正式リリース前後」であるため、重複を除くと28件になる。一方 M14 は列挙自体が14件であり、セルの12が誤っている。28 + 14 + 5 + 1 + 2 + 2 = 52 で disposition 集計の返却52件と一致する。

### §1.2 源泉別内訳

| 源泉 | raw 件数 | 内容 |
|---|---:|---|
| 1 | 28 | 上記 Phase4 SM-ID |
| 2 | 6 | 指示書指定5 identity + 正本で正式リリース前後に残る SM-029 1件 |
| 3 | 173 | §AF〜§BA 159スラッグ + §J 14スラッグ |
| 4 | 16 | INDEX「将来機能・研究ノート」の16ファイル |
| 5 | 25 | A 9 + B 6 + §3.4 3 + §3.5 4 + §4 3 |
| 6 | 25 | 冒頭3 + UI/データ22 |
| 7 | 5 | 実際の §3-1 四件 + 指示書 F-1 が加えた CO-020 |
| 補 | 26 | 未分類の意味単位26。line 405 の重複は除外 |
| 合計 | 304 | 名寄せ前。source2/source7 の矛盾を脱落防止のため和集合化 |

源泉3の全スラッグは §3 の locator `followup-backlog.md:<line>` をもって全数列挙している。源泉4〜補も同じ表に全行を載せた。

### §1.3 合計（A-9）

名寄せ前304件。さらに軸Eの否定形記録5件を ledger に加え、ledger 行は 309 行である。これは「源泉に現れた行」を残す行数であり、名寄せ後の identity 数とは別である。

## §2 名寄せ（軸 B）

### §2.1 一致・部分一致・片方のみ

| 組合せ | 分類 | 件数 | 内容 |
|---|---|---:|---|
| phase4-memo ↔ Memo_Someday | 一致 | 19 | P4M-004〜P4M-022 のうち custom_state を除く19件 |
| phase4-memo ↔ Memo_Someday | 部分一致 | 1 | P4M-023 custom_state 拡張 ↔ line 362 複雑状態遷移 |
| phase4-memo のみ | 片方のみ | 2 | P4M-024 基本情報の始動状態表示 / P4M-025 DI系ヒット種別 |
| Memo_Someday のみ | 片方のみ | 6 | tmp指示2件、相手状態UI、DR自動チェック、porting文書、OD強度既定非表示 |
| checklist ↔ future-notes | 一致 | 4 | メモ、比較、VOD、HTML export |
| source2 ↔ checklist/source3 | 一致 | 5 | 正式名、署名、AV、別repo、不要ファイル |
| future-notes 内 | 一致する概念の伴走資料 | 1 | 比較設計と resolution |
| followup 内 | 同一スラッグの重複 | 2 | gofmt-not-in-pr-checks / combo-labels-normal-counter-split |
| M24 §3.2 の SM↔CO | 同一要求5組／同一面5組 | 計10組 | 既存表を参照。今回の源泉3は §AF以降の別範囲なので、同一要求5組を B-4 の減算には使わない |

### §2.2 名寄せ後の件数

304 raw identity から、確認できた重複32件（phase4-memo↔Someday 20、source2 5、checklist↔future 4、future内部1、followup内部2）を畳み、名寄せ後は272 identity。ledger は監査可能性のため raw 行を消さず `代表 ID` で結んでいる。軸Eの否定形5件を加えた追跡表は277 identity 相当である。

### §2.3 future-notes と checklist §3.5 の矛盾

future-notes の対象メモは 2026-06-26〜2026-07-27、checklist は 2026-08-19 で checklist のほうが新しい。checklist は4機能を「フェーズ4が既定の置き場」と書く一方、2026-09-02 の開発者説明は future-notes を「フェーズ6以降のイメージ」とする。さらに HTML export は M17への軽い形式追加、比較は R1/R2 sign-off後に実装可能と checklist が記す。時期の確定根拠が二方向なので、4機能と比較 resolution は `要判断` とした。

## §3 3 層 ledger（軸 C・E・F）

disposition 集計: フェーズ4 96 / 要判断 143 / 判断済み・再開しない 35 / フェーズ5 24 / フェーズ6 以降 11。未付与0件。フェーズ4行はすべて A1〜A9 / B1〜B6 / α①〜α③のいずれかを根拠欄に持つ。

| ID | identity | locator | 源泉 | disposition | 根拠 | 触る面 | 代表 ID | 備考 |
|---|---|---|---:|---|---|---|---|---|
| `SM-023` | モダン対応（取り扱い方の決定）　…クラシックのみ＝先行前は不要。ISSUE-00 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | B6 | データ・画面 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-024` | ゲームテーブルはもう要らない／別ゲー対応は別プロジェクト化したい　…NFR407 | `M24-RESEARCH-01-report.md §2.2` | 1 | 判断済み・再開しない | D-634(2): NFR407 の他ゲーム対応意思を撤回 | 要求・文書 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-025` | セットプレイの重ねた技から始められるコンボの管理　…複雑・要打合せ・要設計 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-026` | 連携も管理したい　／【2026-07-21】未対応(フェーズ4寄り) | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-027` | セットプレイ自動発見機能（独立モジュール化、規格を守れば単独で他アプリ組込可）　 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-028` | 全体一括で仮登録にする機能（アプデ後にユーザーが検証して本登録に直す等）　／【2 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-030` | 中国語対応　…NFR307は日英のみ。拡張（フェーズ4寄りでも可）　／【2026 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-031` | コンボ/セットプレイに画像や動画も添付可能に　／【2026-07-21】M17- | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-032` | 始動状況や始動技を細かく指定したい（中Pで表示、その他の始動状況で表示等）　…射 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-033` | ヒット状況をもっと拡充（壁やられ(ガード)、壁やられ(ヒット)、ガークラ等）／区 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（P4M-025 と同一のヒット種別品質課題） | データ・画面 | `P4M-025` | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-034` | 微妙な当て方で起き上がりが変わる奴（今はフレーム一定扱い、ユーザー説明もない）　 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-035` | 連キャンを扱いたい（弱P-弱P と 弱P(キャンセル)-弱P で全体フレームが変 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-042` | ノーキャン（通常技ヒット後にキャンセルせずに必殺技を出して当てる事）とキャンセル | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-046` | modifyあたりを再検討 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-050` | 連携を割る（無敵、小技、昇竜、インパクト、ドライブリバーサル等）も管理したい。　 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-081` | 仮想コントローラを子ウィンドウ化？　／【2026-07-21】未対応 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（仮想コントローラ品質） | 画面: 仮想コントローラ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-087` | なっちゃってレバー機能を仮想コントローラにつける　／【2026-07-21】未対 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（仮想コントローラ品質） | 画面: 仮想コントローラ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-100` | 全技一覧について、仮想コントローラで入力できる技は省いてもいいかも　／【2026 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（仮想コントローラ品質） | 画面: 仮想コントローラ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-105` | タグについてタイプ列みたいなものを作って、コンボ以外の用途にも拡張したい。個別の | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-106` | ヒット区分、ジャスパ反撃、インパクト壁やられ、インパクトヒット壁やられも追加した | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（P4M-025 と同一のヒット種別品質課題） | データ・画面 | `P4M-025` | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-116` | ヒット区分にインパクト壁やられ、インパクトヒット壁やられ、パニッシュカウンター（ | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（P4M-025 と同一のヒット種別品質課題） | データ・画面 | `P4M-025` | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-123` | セットプレイ。いまは持続当てと汚連携対応。ただ普通に4F暴れに勝てる重ねも対象に | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-124` | セットプレイが何に勝つのかも管理したい。無敵暴れにも勝つとかもあるし。　／【20 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-125` | セットプレイに汚インパクト、各種詐欺飛び等、頻出の連携を探す事に特化したボタンも | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-134` | 確定反撃ない技についても対策をメモしたい需要はある。これをどうするか？ガードした | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・機能 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-135` | ターゲットコンボも入力に欲しい　／【2026-08-11】未対応。M16-05 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ4 | α②（P4M-007 と同一のターゲットコンボ入力課題） | 画面: 仮想コントローラ | `P4M-007` | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-138` | セットプレイについて特定の有利フレームを取るためのレシピ。を探せるようにしたい。 | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ5 | 公開可否に影響しない機能拡張 | 画面・データ | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-147` | クラウドストレージへのエクスポート対応（これはかなり先でもいい）　／【2026- | `M24-RESEARCH-01-report.md §2.2` | 1 | フェーズ6 以降 | 原文が「かなり先でもいい」と明記する構想 | 配布・構想 | — | M24旧Phase4返却を新しい公開基準で再分類 |
| `SM-152` | コード署名 | `M24 report §2.2 / checklist B1` | 2 | フェーズ4 | B1 | 配布 | — | 源泉2の規定項目 |
| `SM-153` | AV 誤検知対策 | `M24 report §2.2 / checklist B2` | 2 | フェーズ4 | B2 | 配布 | — | — |
| `SM-158` | 公開用別リポジトリ化 | `M24 report §2.2` | 2 | フェーズ4 | α③ | リポジトリ運用 | — | — |
| `SM-160` | 不要ファイルの除去 | `M24 report §2.2` | 2 | フェーズ4 | α③ | リポジトリ運用 | — | — |
| `SM-053/SM-157` | 正式名称の決定と反映 | `M24 report §3-3 / checklist A5` | 2 | フェーズ4 | A5 | 配布・リポジトリ | — | — |
| `SM-029` | ダークモード | `M24 report §2.1/§2.2` | 2 | 要判断 | 指示書 A-2 の五項目から外れる一方、正本 ledger は正式リリース前後へ返却 | 画面 | — | source2 例外として脱落防止 |
| `per-user-default-character-not-wired` | per-user-default-character-not-wired | `followup-backlog.md:770` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `combo-list-filters-key-readers-expanded` | combo-list-filters-key-readers-expanded | `followup-backlog.md:772` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `character-display-names-diverge-from-in-game` | character-display-names-diverge-from-in-game | `followup-backlog.md:773` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | データ・seed | — | — |
| `combo-list-setup-count-hides-fetch-failure` | combo-list-setup-count-hides-fetch-failure | `followup-backlog.md:774` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `manon-medal-situation-rows-unscanned-on-dev-db` | manon-medal-situation-rows-unscanned-on-dev-db | `followup-backlog.md:788` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `custom-states-seeding-not-allocated-to-any-m24-sub` | custom-states-seeding-not-allocated-to-any-m24-sub | `followup-backlog.md:789` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | データ・seed | — | — |
| `jamie-drunk-level-retraction-unconfirmed` | jamie-drunk-level-retraction-unconfirmed | `followup-backlog.md:790` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `design-doc-meta-prerequisite-versions-drifted` | design-doc-meta-prerequisite-versions-drifted | `followup-backlog.md:791` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 画面・API | — | — |
| `character-down-migrations-orphan-user-combos` | character-down-migrations-orphan-user-combos | `followup-backlog.md:801` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `e2e-flake-seven-records-have-no-bundle-target` | e2e-flake-seven-records-have-no-bundle-target | `followup-backlog.md:802` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `check-progress-log-index-substring-false-green` | check-progress-log-index-substring-false-green | `followup-backlog.md:803` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `config-save-fsync-untested` | config-save-fsync-untested | `followup-backlog.md:804` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `inline-insert-consolidation-remaining（CO-006 の残り）` | inline-insert-consolidation-remaining（CO-006 の残り） | `followup-backlog.md:805` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `character-display-name-unverified-three` | character-display-name-unverified-three | `followup-backlog.md:815` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | データ・seed | — | — |
| `combo-export-character-id-is-raw-input` | combo-export-character-id-is-raw-input | `followup-backlog.md:816` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `tag-management-page-not-i18n` | tag-management-page-not-i18n | `followup-backlog.md:817` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `filter-value-labels-hardcoded-ja` | filter-value-labels-hardcoded-ja | `followup-backlog.md:818` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `character-selector-label-is-ja-fixed` | character-selector-label-is-ja-fixed | `followup-backlog.md:819` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `filter-summary-pills-wrap-at-full-filters` | filter-summary-pills-wrap-at-full-filters | `followup-backlog.md:820` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `searchable-select-aria-controls-points-to-dialog` | searchable-select-aria-controls-points-to-dialog | `followup-backlog.md:821` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `val-c02-check-then-act-race-on-combo-create` | val-c02-check-then-act-race-on-combo-create | `followup-backlog.md:831` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `e2e-depends-on-implicit-default-character` | e2e-depends-on-implicit-default-character | `followup-backlog.md:832` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `claude-md-e2e-isolation-claim-false-both-ways` | claude-md-e2e-isolation-claim-false-both-ways | `followup-backlog.md:833` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `e2e-does-not-exercise-production-static-serving` | e2e-does-not-exercise-production-static-serving | `followup-backlog.md:834` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `e2e-ci-gate-remaining-two-conditions` | e2e-ci-gate-remaining-two-conditions | `followup-backlog.md:835` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `e2e-retry-absorption-normalized-in-acceptance-criteria` | e2e-retry-absorption-normalized-in-acceptance-criteria | `followup-backlog.md:836` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `e2e-build-step-lives-only-in-playwright-config` | e2e-build-step-lives-only-in-playwright-config | `followup-backlog.md:837` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `getbyrole-name-is-substring-match-by-default` | getbyrole-name-is-substring-match-by-default | `followup-backlog.md:838` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `e2e-measurement-env-not-representative` | e2e-measurement-env-not-representative | `followup-backlog.md:839` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `setup-recipe-display-not-through-shared-component` | setup-recipe-display-not-through-shared-component | `followup-backlog.md:849` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `combo-detail-back-link-is-hardcoded` | combo-detail-back-link-is-hardcoded | `followup-backlog.md:850` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `memo-shown-twice-on-detail` | memo-shown-twice-on-detail | `followup-backlog.md:851` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `preset-switcher-uncontrolled-to-controlled-warning` | preset-switcher-uncontrolled-to-controlled-warning | `followup-backlog.md:852` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `oki-no-gauge-label-hardcoded-ja` | oki-no-gauge-label-hardcoded-ja | `followup-backlog.md:853` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `setup-val-s04-check-then-act-race` | setup-val-s04-check-then-act-race | `followup-backlog.md:863` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `tag-duplicate-constraint-not-translated` | tag-duplicate-constraint-not-translated | `followup-backlog.md:864` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `sqlite-busy-translation-remaining-paths` | sqlite-busy-translation-remaining-paths | `followup-backlog.md:865` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `combo-duplicate-key-predicates-duplicated` | combo-duplicate-key-predicates-duplicated | `followup-backlog.md:866` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `opponent-stance-vocabulary-split` | opponent-stance-vocabulary-split | `followup-backlog.md:876` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `opponent-stance-label-too-vague` | opponent-stance-label-too-vague | `followup-backlog.md:877` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `sa-gauge-unit-suffix-split` | sa-gauge-unit-suffix-split | `followup-backlog.md:878` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `field-labels-start-side-mismatch` | field-labels-start-side-mismatch | `followup-backlog.md:879` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `editor-optional-fields-input-effort` | editor-optional-fields-input-effort | `followup-backlog.md:880` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `setup-editor-not-on-shared-editor-parts` | setup-editor-not-on-shared-editor-parts | `followup-backlog.md:881` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `move-category-system-label-review` | move-category-system-label-review | `followup-backlog.md:882` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `test-only-dom-marker-ledger` | test-only-dom-marker-ledger | `followup-backlog.md:883` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `virtual-controller-key-layout-not-like-real-pad` | virtual-controller-key-layout-not-like-real-pad | `followup-backlog.md:895` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `draft-allows-zero-step-recipe` | draft-allows-zero-step-recipe | `followup-backlog.md:896` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `gauge-value-non-canonical-notation-round-trip` | gauge-value-non-canonical-notation-round-trip | `followup-backlog.md:897` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `drive-gauge-half-step-invariant-removed` | drive-gauge-half-step-invariant-removed | `followup-backlog.md:898` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `custom-states-flag-widget-changed-to-buttons` | custom-states-flag-widget-changed-to-buttons | `followup-backlog.md:899` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | 実装・文書 | — | — |
| `custom-states-flag-label-readability` | custom-states-flag-label-readability | `followup-backlog.md:900` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | 実装・文書 | — | — |
| `sa-gauge-unit-suffix-split（更新②）` | sa-gauge-unit-suffix-split（更新②） | `followup-backlog.md:901` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `editor-shortcuts-warn-at-keyboard-binding` | editor-shortcuts-warn-at-keyboard-binding | `followup-backlog.md:913` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `editor-plain-navigate-remaining` | editor-plain-navigate-remaining | `followup-backlog.md:914` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `tag-field-keyboard-unreachable` | tag-field-keyboard-unreachable | `followup-backlog.md:915` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `mock-presentation-timing-vs-plan-mode` | mock-presentation-timing-vs-plan-mode | `followup-backlog.md:916` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `editor-number-arrow-keys-do-not-advance` | editor-number-arrow-keys-do-not-advance | `followup-backlog.md:917` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `combo-editor-basic-fields-draft-toggle-prop-dead` | combo-editor-basic-fields-draft-toggle-prop-dead | `followup-backlog.md:918` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `oki-legend-lacks-post-combo-annotation` | oki-legend-lacks-post-combo-annotation | `followup-backlog.md:919` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `combo-editor-stale-revert-comment` | combo-editor-stale-revert-comment | `followup-backlog.md:920` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `des005-change137-blocks-placed-in-section-5-6` | des005-change137-blocks-placed-in-section-5-6 | `followup-backlog.md:921` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `des005-gauge-decimal-notation-rule` | des005-gauge-decimal-notation-rule | `followup-backlog.md:922` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `setup-to-combo-navigation-by-last-move（SM-146）` | setup-to-combo-navigation-by-last-move（SM-146） | `followup-backlog.md:932` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `meaty-hit-not-modeled-in-combo` | meaty-hit-not-modeled-in-combo | `followup-backlog.md:933` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `combo-list-lacks-starter-move-filter` | combo-list-lacks-starter-move-filter | `followup-backlog.md:934` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `editor-validation-errors-unreachable-from-ui` | editor-validation-errors-unreachable-from-ui | `followup-backlog.md:944` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `editor-tab-badge-misroutes-setups-errors` | editor-tab-badge-misroutes-setups-errors | `followup-backlog.md:945` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `val-dup-adapter-wiring-unobserved` | val-dup-adapter-wiring-unobserved | `followup-backlog.md:946` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `csv-preview-commit-severity-asymmetry` | csv-preview-commit-severity-asymmetry | `followup-backlog.md:947` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `csv-import-opponent-size-whitelist-stale` | csv-import-opponent-size-whitelist-stale | `followup-backlog.md:948` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `csv-import-failed-to-fetch-unreproduced` | csv-import-failed-to-fetch-unreproduced | `followup-backlog.md:949` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `combo-put-error-message-empty` | combo-put-error-message-empty | `followup-backlog.md:950` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `gofmt-not-machine-checked` | gofmt-not-machine-checked | `followup-backlog.md:951` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `m24-13-stale-design-statements` | m24-13-stale-design-statements | `followup-backlog.md:952` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `des006-val-s04-tx-scoped-record` | des006-val-s04-tx-scoped-record | `followup-backlog.md:953` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `e2e-not-in-ci-nor-nightly` | e2e-not-in-ci-nor-nightly | `followup-backlog.md:963` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `test-cost-table-permanent-home` | test-cost-table-permanent-home | `followup-backlog.md:964` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `playwright-narrow-run-env-trap` | playwright-narrow-run-env-trap | `followup-backlog.md:965` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `e2e-specs-not-type-checked` | e2e-specs-not-type-checked | `followup-backlog.md:966` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `test-db-template-effect-in-wall-time` | test-db-template-effect-in-wall-time | `followup-backlog.md:967` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `setup-link-by-ka-search` | setup-link-by-ka-search | `followup-backlog.md:977` | 3 | フェーズ5 | 公開可否に影響しない後付け機能。D-635(A) | 画面・API | — | — |
| `setup-validate-comment-contradicts-caller` | setup-validate-comment-contradicts-caller | `followup-backlog.md:978` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `setup-trash-restore-bypasses-leave-guard` | setup-trash-restore-bypasses-leave-guard | `followup-backlog.md:979` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `setup-unsaved-steps-cannot-use-recipetext` | setup-unsaved-steps-cannot-use-recipetext | `followup-backlog.md:980` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `empty-recipe-label-four-variants` | empty-recipe-label-four-variants | `followup-backlog.md:981` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `copy-idiom-three-ways` | copy-idiom-three-ways | `followup-backlog.md:982` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `recipe-view-toggle-vocabulary` | recipe-view-toggle-vocabulary | `followup-backlog.md:983` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `setup-editor-page-hardcoded-ja` | setup-editor-page-hardcoded-ja | `followup-backlog.md:984` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `adopt-name-format-is-a-locale-string` | adopt-name-format-is-a-locale-string | `followup-backlog.md:985` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `setup-accordion-recipe-now-numbered-vertical` | setup-accordion-recipe-now-numbered-vertical | `followup-backlog.md:986` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `review-checklist-target-field-missing` | review-checklist-target-field-missing | `followup-backlog.md:987` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `export-cross-character-bulk-lost` | export-cross-character-bulk-lost | `followup-backlog.md:997` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `csv-export-row-limit-silent-truncation` | csv-export-row-limit-silent-truncation | `followup-backlog.md:998` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `backup-restore-buttons-disabled` | backup-restore-buttons-disabled | `followup-backlog.md:999` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `draft-not-restorable-by-roundtrip` | draft-not-restorable-by-roundtrip | `followup-backlog.md:1000` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `zip-entry-name-constants-duplicated` | zip-entry-name-constants-duplicated | `followup-backlog.md:1001` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `import-export-terminology-candidates` | import-export-terminology-candidates | `followup-backlog.md:1002` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `co023-g15-not-fully-closed` | co023-g15-not-fully-closed | `followup-backlog.md:1003` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `window-confirm-in-gamepad-calibration` | window-confirm-in-gamepad-calibration | `followup-backlog.md:1004` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `export-page-media-path-leak-resolved-by-removal` | export-page-media-path-leak-resolved-by-removal | `followup-backlog.md:1005` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `des002-ci-contract-e2e-not-in-ci-stale` | des002-ci-contract-e2e-not-in-ci-stale | `followup-backlog.md:1006` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `go-test-wall-floor-is-migration-package` | go-test-wall-floor-is-migration-package | `followup-backlog.md:1007` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `nightly-e2e-ci-mitigations-unverified` | nightly-e2e-ci-mitigations-unverified | `followup-backlog.md:1008` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `template-exclusion-is-currently-a-no-op` | template-exclusion-is-currently-a-no-op | `followup-backlog.md:1009` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `review-report-path-mismatch` | review-report-path-mismatch | `followup-backlog.md:1010` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | リポジトリ運用・文書 | — | — |
| `des006-section-number-in-three-docs` | des006-section-number-in-three-docs | `followup-backlog.md:1011` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | リポジトリ運用・文書 | — | — |
| `trash-scoped-to-single-character` | trash-scoped-to-single-character | `followup-backlog.md:1021` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | データ・seed | — | — |
| `seed-wave-per-wave-work-inventory` | seed-wave-per-wave-work-inventory | `followup-backlog.md:1022` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | データ・seed | — | — |
| `ground-dash-label-split-two-ways` | ground-dash-label-split-two-ways | `followup-backlog.md:1023` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `step-word-used-in-two-senses` | step-word-used-in-two-senses | `followup-backlog.md:1024` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `m24-10-is-a-gap` | m24-10-is-a-gap | `followup-backlog.md:1025` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `combo-step-unit-word-deferred` | combo-step-unit-word-deferred | `followup-backlog.md:1035` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `english-locale-incomplete-shipped` | english-locale-incomplete-shipped | `followup-backlog.md:1036` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `csv-column-contract-unobserved-in-pr` | csv-column-contract-unobserved-in-pr | `followup-backlog.md:1037` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `gofmt-not-in-pr-checks` | gofmt-not-in-pr-checks | `followup-backlog.md:1038` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `combo-labels-normal-counter-split` | combo-labels-normal-counter-split | `followup-backlog.md:1039` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `recipetext-compactclassname-contract-mismatch` | recipetext-compactclassname-contract-mismatch | `followup-backlog.md:1040` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `des005-screen-names-stale` | des005-screen-names-stale | `followup-backlog.md:1041` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `instruction-ledger-stale-counts-m24-07` | instruction-ledger-stale-counts-m24-07 | `followup-backlog.md:1042` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `sm008-already-satisfied` | sm008-already-satisfied | `followup-backlog.md:1043` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `m24-07-review-report-path` | m24-07-review-report-path | `followup-backlog.md:1044` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | リポジトリ運用・文書 | — | — |
| `querykey-flattening-would-change-behavior` | querykey-flattening-would-change-behavior | `followup-backlog.md:1054` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `trash-bulk-permanent-delete-reason-hidden（本表 §V の行を参照）` | trash-bulk-permanent-delete-reason-hidden（本表 §V の行を参照） | `followup-backlog.md:1055` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `stale-identifiers-after-querykey-unification` | stale-identifiers-after-querykey-unification | `followup-backlog.md:1056` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `import-order-unchecked` | import-order-unchecked | `followup-backlog.md:1057` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `instruction-ledger-stale-counts-m24-08` | instruction-ledger-stale-counts-m24-08 | `followup-backlog.md:1058` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `des005-5-16-progress-and-resumability-unmet` | des005-5-16-progress-and-resumability-unmet | `followup-backlog.md:1059` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `d415-scope-vs-sm068` | d415-scope-vs-sm068 | `followup-backlog.md:1060` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `des002-4-2-new-route-addendum` | des002-4-2-new-route-addendum | `followup-backlog.md:1061` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `gofmt-not-in-pr-checks@1062` | gofmt-not-in-pr-checks | `followup-backlog.md:1062` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | `gofmt-not-in-pr-checks` | 同じ既存スラッグが line 1038 と 1062 に重複 |
| `combo-labels-normal-counter-split@1063` | combo-labels-normal-counter-split | `followup-backlog.md:1063` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 画面・API | `combo-labels-normal-counter-split` | 同じ既存スラッグが line 1039 と 1063 に重複 |
| `preset-edit-page-hardcoded-ja（CO-026 の一部）` | preset-edit-page-hardcoded-ja（CO-026 の一部） | `followup-backlog.md:1064` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `doc-inventory-five-off-type-files` | doc-inventory-five-off-type-files | `followup-backlog.md:1065` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | 実装・文書 | — | — |
| `ci-summary-count-extraction-anchored-to-line-head` | ci-summary-count-extraction-anchored-to-line-head | `followup-backlog.md:1066` | 3 | 判断済み・再開しない | followup 行が解消／決着済みと明記 | テスト・工程 | — | — |
| `commit-granularity-add-all` | commit-granularity-add-all | `followup-backlog.md:1067` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `main-lacks-graceful-shutdown` | main-lacks-graceful-shutdown | `followup-backlog.md:1113` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `bulk-rename-must-exclude-check-scripts` | bulk-rename-must-exclude-check-scripts | `followup-backlog.md:1114` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `no-single-verify-command` | no-single-verify-command | `followup-backlog.md:1115` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `no-periodic-lesson-lint-review` | no-periodic-lesson-lint-review | `followup-backlog.md:1116` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `code-facts-generator-drifts-with-refactor` | code-facts-generator-drifts-with-refactor | `followup-backlog.md:1117` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `check-guard-cannot-see-partial-extraction` | check-guard-cannot-see-partial-extraction | `followup-backlog.md:1118` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `playbook-has-no-retirement-turn` | playbook-has-no-retirement-turn | `followup-backlog.md:1119` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `playbook-does-not-know-its-own-checks` | playbook-does-not-know-its-own-checks | `followup-backlog.md:1120` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `d510-misattribution-errata` | d510-misattribution-errata | `followup-backlog.md:1121` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `progress-summary-section-numbering-disordered` | progress-summary-section-numbering-disordered | `followup-backlog.md:1122` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `check-doc-inventory-except-only-references` | check-doc-inventory-except-only-references | `followup-backlog.md:1123` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `readme-md-and-txt-coexist` | readme-md-and-txt-coexist | `followup-backlog.md:1135` | 3 | フェーズ4 | B4 | リポジトリ運用・文書 | — | — |
| `repo-folder-structure-cleanup` | repo-folder-structure-cleanup | `followup-backlog.md:1136` | 3 | フェーズ4 | α③ | リポジトリ運用・文書 | — | — |
| `archive-backlog-not-processed` | archive-backlog-not-processed | `followup-backlog.md:1137` | 3 | フェーズ4 | α③ | リポジトリ運用・文書 | — | — |
| `usermanual-not-written` | usermanual-not-written | `followup-backlog.md:1138` | 3 | フェーズ4 | B4 | 実装・文書 | — | — |
| `public-repo-operating-model` | public-repo-operating-model | `followup-backlog.md:1139` | 3 | フェーズ4 | A7・α③ | リポジトリ運用・文書 | — | — |
| `devcontainer-publication-decision` | devcontainer-publication-decision | `followup-backlog.md:1140` | 3 | フェーズ4 | A8・α③ | リポジトリ運用・文書 | — | — |
| `design-report-lesson-section-not-uniform` | design-report-lesson-section-not-uniform | `followup-backlog.md:1141` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | リポジトリ運用・文書 | — | — |
| `instruction-template-port-check-command-broken` | instruction-template-port-check-command-broken | `followup-backlog.md:1142` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `secret-scan-before-release` | secret-scan-before-release | `followup-backlog.md:1143` | 3 | フェーズ4 | A9 | リポジトリ運用・文書 | — | — |
| `public-docs-full-disclosure` | public-docs-full-disclosure | `followup-backlog.md:1144` | 3 | フェーズ4 | A3・α③ | リポジトリ運用・文書 | — | — |
| `future-notes-inventory-before-phase4` | future-notes-inventory-before-phase4 | `followup-backlog.md:1145` | 3 | 判断済み・再開しない | 本 RESEARCH 自身で処理済み | 実装・文書 | — | — |
| `public-snapshot-exclusion-rules` | public-snapshot-exclusion-rules | `followup-backlog.md:1146` | 3 | フェーズ4 | A7・A8・α③ | リポジトリ運用・文書 | — | — |
| `cloud-env-cannot-reach-vuln-go-dev` | cloud-env-cannot-reach-vuln-go-dev | `followup-backlog.md:1183` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | セキュリティ | — | — |
| `codex-hooks-sessionstart-sync-pending` | codex-hooks-sessionstart-sync-pending | `followup-backlog.md:1184` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `seed-alias-collision-change-unfiled` | seed-alias-collision-change-unfiled | `followup-backlog.md:1185` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | データ・seed | — | — |
| `seed-precheck-batch6-residuals` | seed-precheck-batch6-residuals | `followup-backlog.md:1186` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | データ・seed | — | — |
| `md-emphasis-baseline-regression-222` | md-emphasis-baseline-regression-222 | `followup-backlog.md:1187` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `m23-06-unnamed-setup-unreachable-by-api` | m23-06-unnamed-setup-unreachable-by-api | `followup-backlog.md:1188` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `progress-log-index-check-false-green-recurrence` | progress-log-index-check-false-green-recurrence | `followup-backlog.md:1189` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | テスト・工程 | — | — |
| `recipe-resolver-preset-lookup-per-step` | recipe-resolver-preset-lookup-per-step | `followup-backlog.md:1190` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `tag-count-usage-inflated-by-orphan-combo-tags` | tag-count-usage-inflated-by-orphan-combo-tags | `followup-backlog.md:1191` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `combos-orphan-child-rows-count-unmeasured` | combos-orphan-child-rows-count-unmeasured | `followup-backlog.md:1192` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 画面・API | — | — |
| `db-open-file-uri-unverified-on-windows` | db-open-file-uri-unverified-on-windows | `followup-backlog.md:1193` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `seed-precheck-batch7-residuals` | seed-precheck-batch7-residuals | `followup-backlog.md:1194` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | データ・seed | — | — |
| `shipped-move-code-plural-suffix-violations` | shipped-move-code-plural-suffix-violations | `followup-backlog.md:1195` | 3 | フェーズ4 | α①（残キャラクター挿入の完遂に必要） | データ・seed | — | — |
| `shipped-name-ja-double-space-ken-sa2` | shipped-name-ja-double-space-ken-sa2 | `followup-backlog.md:1196` | 3 | 要判断 | 公開ゲートとの直接対応または公開非影響の根拠が本文だけでは確定しない | 実装・文書 | — | — |
| `FN-01` | 将来機能の願望リスト | `future-notes/combmgr-future-features.html` | 4 | フェーズ6 以降 | 公開ゲート外の構想一覧 | 構想・文書 | — | — |
| `FN-02` | 対外向け機能一覧 | `future-notes/combmgr-features.txt` | 4 | 要判断 | モダン両対応との過大表示を直す扱いが未確定 | 構想・文書 | — | — |
| `FN-03` | 知識管理と AI の仮設計 | `future-notes/combmgr-ai-feature-draft.md` | 4 | フェーズ6 以降 | 構想段階 | 構想・文書 | — | — |
| `FN-04` | 一人SNSメモ機能の背骨 | `future-notes/combmgr-memo-spine-design.md` | 4 | 要判断 | checklist §3.5 はフェーズ4、開発者はフェーズ6以降と説明 | 構想・文書 | — | — |
| `FN-05` | 他プレイヤー比較分析 | `future-notes/combmgr-player-comparison-design.md` | 4 | 要判断 | checklist §3.5 はフェーズ4、開発者はフェーズ6以降と説明 | 構想・文書 | — | — |
| `FN-06` | 比較分析の設計解決資料 | `future-notes/combmgr-player-comparison-design-resolution.md` | 4 | 要判断 | FN-05 の伴走資料。R1/R2 sign-off 状態の確認が必要 | 構想・文書 | `FN-05` | — |
| `FN-07` | 対戦動画分析 | `future-notes/combmgr-vod-analysis-design-memo.md` | 4 | 要判断 | checklist §3.5 はフェーズ4、開発者はフェーズ6以降と説明 | 構想・文書 | — | — |
| `FN-08` | 単一 HTML エクスポート | `future-notes/combmgr-html-export-design-memo.md` | 4 | 要判断 | checklist §3.5 はフェーズ4、開発者はフェーズ6以降と説明 | 構想・文書 | — | — |
| `FN-09` | AI 連携方式の横断設計 | `future-notes/combmgr-ai-integration-design-memo.md` | 4 | フェーズ6 以降 | 構想段階 | 構想・文書 | — | — |
| `FN-10` | 一人SNS基盤プロンプト | `future-notes/combmgr-prompt-memo-foundation-draft.md` | 4 | フェーズ6 以降 | 投入前の草案 | 構想・文書 | — | — |
| `FN-11` | ダメージ＋削りきり計算ツール | `future-notes/combmgr-prompt-damage-lethal-calc.md` | 4 | フェーズ6 以降 | 本体組込対象外の独立案 | 構想・文書 | — | — |
| `FN-12` | ペルソナ分析フレームワーク | `future-notes/combmgr-persona-analysis-frameworks.html` | 4 | フェーズ6 以降 | 研究ノート | 構想・文書 | — | — |
| `FN-13` | 知識管理リソース集 | `future-notes/combmgr-knowledge-mgmt-resources.html` | 4 | フェーズ6 以降 | 研究資料 | 構想・文書 | — | — |
| `FN-14` | 性能改善方針 | `future-notes/combmgr-performance-strategy.html` | 4 | フェーズ6 以降 | handover 昇格候補で公開ゲート外 | 構想・文書 | — | — |
| `FN-15` | AI 開発方法論 | `future-notes/combmgr-dev-methodology.html` | 4 | フェーズ6 以降 | handover 昇格候補で公開ゲート外 | 構想・文書 | — | — |
| `FN-16` | 自律実装の受入ルーブリック | `future-notes/combmgr-autonomous-acceptance-criteria.md` | 4 | フェーズ6 以降 | handover 昇格候補で公開ゲート外 | 構想・文書 | — | — |
| `A1` | ライセンス三層の承認 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A1 | 法務・文書 | — | — |
| `A2` | 依存ライセンスの棚卸し | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A2 | 法務・配布 | — | — |
| `A3` | 配布物のデータ来歴の切り分け | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A3 | 法務・データ | — | — |
| `A4` | 法務ポスチャの追従確認 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A4 | 法務 | — | — |
| `A5` | 正式名の決定と反映 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A5 | 配布・リポジトリ | — | — |
| `A6` | LAN モード API の認証実査 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A6 | セキュリティ | — | — |
| `A7` | 段階的公開モデルの実務設定 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A7 | リポジトリ運用 | — | — |
| `A8` | devContainer の公開判断 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A8 | リポジトリ運用 | — | — |
| `A9` | 静的解析・SCANOSS | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A9 | セキュリティ・法務 | — | — |
| `B1` | コード署名の取得 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B1 | 配布 | — | — |
| `B2` | ウイルス誤検知対策 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B2 | 配布 | — | — |
| `B3` | データ鮮度の確認 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B3 | データ | — | — |
| `B4` | 操作説明書・動画 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B4 | 文書 | — | — |
| `B5` | 宣伝ブログ記事 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B5 | 文書・配布 | — | — |
| `B6` | クラシック前提の明示 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B6 | 文書・画面 | — | — |
| `CL-3.4-1` | FTS5 全文検索強化 | `combmgr-prerelease-checklist.md` | 5 | フェーズ5 | 公開可否に影響しない機能拡張 | 検索 | — | — |
| `CL-3.4-2` | 差し返し・技相性との線引き | `combmgr-prerelease-checklist.md` | 5 | フェーズ5 | 公開可否に影響しない後続機能 | データ・画面 | — | — |
| `CL-3.4-3` | 動画実体の配布・容量設計 | `combmgr-prerelease-checklist.md` | 5 | フェーズ5 | 参照だけで公開可能、実体配布は分離済み | 配布・データ | — | — |
| `CL-3.5-1` | メモ（一人SNS）の本体組込 | `combmgr-prerelease-checklist.md` | 5 | 要判断 | future-notes との時期矛盾 | 画面・データ | `FN-04` | — |
| `CL-3.5-2` | 他プレイヤー比較 | `combmgr-prerelease-checklist.md` | 5 | 要判断 | future-notes との時期矛盾 | 画面・データ | `FN-05` | — |
| `CL-3.5-3` | VOD 分析の本体組込 | `combmgr-prerelease-checklist.md` | 5 | 要判断 | future-notes との時期矛盾 | 画面・データ | `FN-07` | — |
| `CL-3.5-4` | HTML エクスポート | `combmgr-prerelease-checklist.md` | 5 | 要判断 | future-notes との時期矛盾 | 出力 | `FN-08` | — |
| `CL-4-1` | 正式名リネーム | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | A5 | 配布・リポジトリ | `A5` | — |
| `CL-4-2` | マイグレーションのベースライン化 | `combmgr-prerelease-checklist.md` | 5 | 要判断 | 測定値を基に実施可否を決める必要 | データ・テスト | — | — |
| `CL-4-3` | FR702 が要求するスキーマ変更 | `combmgr-prerelease-checklist.md` | 5 | フェーズ4 | B3 | データ・スキーマ | — | — |
| `P4M-001` | 教訓肥大化を機械検査へ昇華 | `phase4-memo.txt:5` | 6 | フェーズ4 | α② | 工程・検査 | — | — |
| `P4M-002` | Memo_Someday の更新 | `phase4-memo.txt:6` | 6 | 判断済み・再開しない | D-635(C) により対象外・別担当へ移管済み | 文書 | — | — |
| `P4M-003` | 工程で発見済みの問題の解消 | `phase4-memo.txt:7` | 6 | 判断済み・再開しない | D-635(C) により教訓以外は完了扱い | 工程 | — | — |
| `P4M-004` | セットプレイ編集の戻るボタン位置 | `phase4-memo.txt:18` | 6 | フェーズ4 | α② | 画面: セットプレイ編集 | — | — |
| `P4M-005` | setplay only フラグの活用 | `phase4-memo.txt:20` | 6 | フェーズ4 | α② | データ・セットプレイ | — | — |
| `P4M-006` | ドライブダメージの符号説明と表示 | `phase4-memo.txt:24` | 6 | フェーズ4 | α② | 画面・文書 | — | — |
| `P4M-007` | ターゲットコンボタブ | `phase4-memo.txt:29` | 6 | フェーズ4 | α② | 画面: 仮想コントローラ | — | — |
| `P4M-008` | 非表示技・キャラ別技タブ | `phase4-memo.txt:30` | 6 | フェーズ4 | α② | 画面: 仮想コントローラ | — | — |
| `P4M-009` | ダメージ等の必須入力化 | `phase4-memo.txt:33` | 6 | フェーズ4 | α② | 画面・検証 | — | — |
| `P4M-010` | 必須・任意ラベル | `phase4-memo.txt:34` | 6 | フェーズ4 | α② | 画面・検証 | — | — |
| `P4M-011` | 起き攻めの未検証／false 区別 | `phase4-memo.txt:35` | 6 | フェーズ4 | α② | データ・画面 | — | — |
| `P4M-012` | キャラ選択後 Enter が反応しない | `phase4-memo.txt:37` | 6 | フェーズ4 | α② | 共通画面部品 | — | — |
| `P4M-013` | キャラ選択のドラッグ判定 | `phase4-memo.txt:39` | 6 | フェーズ4 | α② | 共通画面部品 | — | — |
| `P4M-014` | 確定反撃マイリストの区分整理 | `phase4-memo.txt:42` | 6 | フェーズ4 | α② | 画面: 確定反撃 | — | — |
| `P4M-015` | 確定反撃の自キャラ既定値 | `phase4-memo.txt:54` | 6 | フェーズ4 | α② | 画面: 確定反撃 | — | — |
| `P4M-016` | 強度なし技の選択 | `phase4-memo.txt:56` | 6 | フェーズ4 | α② | 画面: 仮想コントローラ | — | — |
| `P4M-017` | 仮想コントローラの技表示基準 | `phase4-memo.txt:58` | 6 | フェーズ4 | α② | 画面: 仮想コントローラ | — | — |
| `P4M-018` | ホールド／ジャスト版の表示 | `phase4-memo.txt:61` | 6 | フェーズ4 | α② | 画面: 仮想コントローラ | — | — |
| `P4M-019` | セットプレイ削除時の紐付け解除 | `phase4-memo.txt:63` | 6 | フェーズ4 | α② | 画面: セットプレイ | — | — |
| `P4M-020` | 一覧の始動技欄を除去 | `phase4-memo.txt:65` | 6 | フェーズ4 | α② | 画面: 一覧 | — | — |
| `P4M-021` | ヒット種別フィルタ短縮 | `phase4-memo.txt:67` | 6 | フェーズ4 | α② | 画面: 一覧 | — | — |
| `P4M-022` | 始動技フィルタ | `phase4-memo.txt:69` | 6 | フェーズ4 | α② | 画面: 一覧 | — | — |
| `P4M-023` | 各キャラ custom_state 拡張 | `phase4-memo.txt:71` | 6 | フェーズ4 | α② | データ・seed | — | — |
| `P4M-024` | 基本情報が始動状態であることを表示 | `phase4-memo.txt:73` | 6 | フェーズ4 | α② | 画面: 編集 | — | — |
| `P4M-025` | ヒット種別へ DI 等を追加 | `phase4-memo.txt:75` | 6 | フェーズ4 | α② | データ・画面 | — | — |
| `SM-051` | キャラクター増加時の importer 見直し | `m24-close-report.md §3-1` | 7 | フェーズ4 | α① | データ・importer | — | M14 レーンへ継承 |
| `SM-080` | 仮想コントローラのボタン名見直し | `m24-close-report.md §3-1` | 7 | フェーズ4 | α② | 画面: 仮想コントローラ | — | SM-149・CO-020 と同一クラスタ |
| `SM-098` | 確定反撃での D リバの扱い | `m24-close-report.md §3-1` | 7 | フェーズ4 | α② | 画面・要件: 確定反撃 | — | 全キャラ同値だが到達可否あり。要件整理が必要 |
| `SM-149` | 仮想コントローラのボタン配置 | `m24-close-report.md §3-1` | 7 | フェーズ4 | α② | 画面: 仮想コントローラ | — | SM-080・CO-020 と同一クラスタ |
| `CO-020` | HitBoxLayout の i18n 未対応 | `M25 instruction F-1/F-2` | 7 | フェーズ4 | α② | 画面・locale | — | 実際の §3-1 四件には含まれないが F-1 が継承を要求 |
| `SD-001` | セットプレイ編集の戻るボタン位置 | `Memo_Someday.txt:355` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-004` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-002` | tmp/implementplanfullphaseorderissue.md の実行 | `Memo_Someday.txt:357` | 補 | 要判断 | 未マーカーで公開ゲートとの対応が未確定 | 工程・文書 | — | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-003` | setplay only フラグの活用 | `Memo_Someday.txt:359` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-005` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-004` | 複雑な状態遷移キャラのセットプレイ対応 | `Memo_Someday.txt:362` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-023` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-005` | 相手状態をより速く指定する UI | `Memo_Someday.txt:365` | 補 | 要判断 | 未マーカーで公開ゲートとの対応が未確定 | 画面・データ | — | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-006` | 起き攻め DR なし選択時の自動チェック | `Memo_Someday.txt:366` | 補 | 要判断 | 未マーカーで公開ゲートとの対応が未確定 | 画面・データ | — | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-007` | m24refactoringproposal.md の実行 | `Memo_Someday.txt:368` | 補 | 要判断 | 未マーカーで公開ゲートとの対応が未確定 | 工程・文書 | — | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-008` | combomgrfixesfromporting.md の実行 | `Memo_Someday.txt:370` | 補 | 要判断 | 未マーカーで公開ゲートとの対応が未確定 | 工程・文書 | — | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-009` | ドライブダメージの符号説明と表示 | `Memo_Someday.txt:372` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-006` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-010` | ターゲットコンボタブ | `Memo_Someday.txt:378` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-007` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-011` | 非表示技・キャラ別技タブ | `Memo_Someday.txt:379` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-008` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-012` | ダメージ等の必須入力化 | `Memo_Someday.txt:383` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-009` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-013` | 必須・任意ラベル | `Memo_Someday.txt:384` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-010` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-014` | 起き攻めの未検証／false 区別 | `Memo_Someday.txt:385` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-011` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-015` | キャラ選択後 Enter が反応しない | `Memo_Someday.txt:388` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-012` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-016` | キャラ選択のドラッグ判定 | `Memo_Someday.txt:389` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-013` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-017` | 確定反撃の自キャラ既定値 | `Memo_Someday.txt:391` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-015` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-018` | 確定反撃マイリストの区分整理 | `Memo_Someday.txt:393` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-014` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-019` | 強度なし技の選択 | `Memo_Someday.txt:407` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-016` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-020` | OD 強度組合せを既定非表示 | `Memo_Someday.txt:409` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | — | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-021` | 仮想コントローラの技表示基準 | `Memo_Someday.txt:411` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-017` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-022` | ホールド／ジャスト版の表示 | `Memo_Someday.txt:414` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-018` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-023` | セットプレイ削除時の紐付け解除 | `Memo_Someday.txt:416` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-019` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-024` | 一覧の始動技欄を除去 | `Memo_Someday.txt:418` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-020` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-025` | ヒット種別フィルタ短縮 | `Memo_Someday.txt:420` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-021` | line 405 は line 391 の逐語重複のため同一 identity |
| `SD-026` | 始動技フィルタ | `Memo_Someday.txt:422` | 補 | フェーズ4 | α②（phase4-memo と一致／同種の UI 品質課題） | 画面・データ | `P4M-022` | line 405 は line 391 の逐語重複のため同一 identity |
| `CO-026` | 英語 UI 未完成 | `m24-close-report.md §2-1` | 除外 | フェーズ5 | D-634(9): 公開後に徐々に整理 | locale | — | 判断済み |
| `SM-016` | 一工程の単位語統一 | `m24-close-report.md §2-2` | 除外 | フェーズ5 | D-634(10): 後回し | 画面・locale | — | 判断済み |
| `EX-003` | 再構築の中断耐性 | `m24-close-report.md §2-3` | 除外 | 判断済み・再開しない | D-620: 要求撤回、followup も立てない | 設計 | — | — |
| `EX-004` | 一括バーの紐付け解除導線 | `m24-close-report.md §2-4` | 除外 | 判断済み・再開しない | 開発者判断: 行部品と重複 | 画面 | — | — |
| `EX-005` | queryKey 3箇所の平坦化 | `m24-close-report.md §2-5` | 除外 | 判断済み・再開しない | D-620: invalidate の意味を変えない | FE キャッシュ | — | — |

## §4 到達条件との突合（軸 D）

### §4.1 A 9件・B 6件の現在状態

| 条件 | 実査状態 |
|---|---|
| A1 | 三層案はあるが承認・設計反映は未完 |
| A2 | 依存 license / 維持 / 脆弱性 / notices の棚卸し未完 |
| A3 | 許可リスト型スナップショット方針は D-637 で確定。生成工程と来歴切分けは未完 |
| A4 | framedata / battlelog の再点検未完 |
| A5 | 商標クリアランスは D-636 で完了。正式名の全反映は未完 |
| A6 | as-built 実査済み。password_enabled=true 時は71本中66本が認証対象、5本が公開。既定false時は設計どおり全71本を素通し |
| A7 | 公開モデルは確定。GitHub設定・SECURITY.md等の実務は未完 |
| A8 | devContainer は D-637 で公開判断を後送。許可リスト生成への反映未完 |
| A9 | SCANOSS・静的解析の公開前実行未完 |
| B1 | コード署名未完 |
| B2 | AV申請未完。B1が先行条件 |
| B3 | DB seed 19/31。CSV 30/31で dhalsim CSV が無く、yasmine はCSVのみ。公開時鮮度未達 |
| B4 | friend READMEは存在するが、followup usermanual-not-written が未解消 |
| B5 | 宣伝ブログ記事未完 |
| B6 | 現行 features.txt は「クラシック/モダン両対応」と過大表示し、クラシック前提の明示は未完 |

### §4.2 A6 LAN 認証の as-built

本番ルートは routes.go の70本 + `GET /api/health` 1本 = 71本（debug build はさらに2本）。`e.Use(mw.Auth(authService))` は CORS 後、全ルート登録前のグローバル middleware である。password_enabled=true のとき認証不要なのは次の5本だけで、残り66本を保護する。

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/status`
- `POST /api/auth/password`

password_enabled=false のとき middleware は全APIを意図的に素通しする。既定値もfalseであり、設計書は LAN を信頼ネットワークとして「パスワードは任意」とする。したがって「M22で簡易ログイン機能が無い」という意味では解消済みだが、「LAN APIは常に認証必須」という意味では解消していない。SUPP-001 の「無認証一般の是正は対象外」は changelog の過去記録として残るだけで、現行の normative 記述は任意認証である。侵入テストは行っていない。

### §4.3 α① 残キャラ

マイグレーションの最終状態で characters と moves を持つ seed 済みは19体:
`ryu ken ingrid c_viper dhalsim terry guile lily kimberly juri mai zangief manon m_bison rashid jamie luke marisa jp`。

全31体との差は12体:
`aki akuma alex blanka cammy chun_li dee_jay e_honda ed elena sagat yasmine`。

`character_data/*.csv` は30ファイル。seed済み19のうち `dhalsim` CSVが無く、未seed12は全てCSVがある。旧記録の17は manon と c_viper/dhalsim の扱いを数え違えており、開発者列挙12は `blanka` と `yasmine` が抜ける一方、既seedの `c_viper` / `dhalsim` を含んでいた。これで「差2」は説明できる。

### §4.4 α③ 既存スラッグ

`public-repo-operating-model` / `devcontainer-publication-decision` / `public-snapshot-exclusion-rules` / `public-docs-full-disclosure` / `secret-scan-before-release`。新規スラッグは作っていない。

### §4.5 checklist §6 順序との整合

A/B gateは§6の10段と同じ依存を持つ。確認された依存は A2→A1、A6を先に実査、A5・FR702 schema・migration判断を同じ破壊窓、B1→B2。矛盾は2件: (1) §6は公開後にC機能とする一方、D-634はFR702とα②を公開前Phase4に含める。(2) §3.5は4機能をPhase4既定とする一方、開発者の新しい説明はPhase6以降とする。順序は本報告では決め直していない。

## §5 マイルストーン構成の材料（軸 G）

### §5.1 面ごとの行数

1行が複数面に跨るため、下記の延べ数はフェーズ4実行数 96 と一致しない。

| 面（文字列分割による集計） | 延べ行数 |
|---|---:|
| データ | 39 |
| 画面 | 33 |
| 文書 | 16 |
| リポジトリ運用 | 12 |
| 画面: 仮想コントローラ | 11 |
| 配布 | 9 |
| seed | 7 |
| 法務 | 5 |
| リポジトリ | 3 |
| 実装 | 3 |
| 画面: 一覧 | 3 |
| セキュリティ | 2 |
| 検証 | 2 |
| 共通画面部品 | 2 |
| 画面: 確定反撃 | 2 |
| スキーマ | 1 |
| 工程 | 1 |
| 検査 | 1 |
| 画面: セットプレイ編集 | 1 |
| セットプレイ | 1 |
| 画面: セットプレイ | 1 |
| 画面: 編集 | 1 |
| importer | 1 |
| 要件: 確定反撃 | 1 |
| locale | 1 |

### §5.2 依存関係

- A2 の依存棚卸し結果が A1 の三層 license 承認に先行する。
- A5正式名、FR702 schema、migration baseline化は同一の破壊的変更窓で相互干渉する。
- B1コード署名が B2 AV申請に先行する。
- 許可リスト型スナップショット生成が A3/A7/A8/α③の確認基盤になる。
- 残キャラ seed（α①）には M14-RESEARCH-03 の inventory と未seed12体の確定が先行する。
- 比較機能は R1/R2 sign-off、migration baseline化は G-4測定結果が判定材料になる。
- SM-080 / SM-149 / CO-020 は HitBoxLayout 同一クラスタ。
- F12-3/E-1 は setup-link-by-ka-search に一本化され、公開後の同一先行機能を参照する。

### §5.3 dbtest.Setup 実測

1回だけ `dbtest.Setup` を呼ぶ `TestInsert_OnlyEmitsGivenColumns` は1.07秒。全Goテスト1回の wall は84.410秒。単純比は1.27%。単体値には同テストの小さいSELECT/INSERTとtest harnessが含まれるため、Setupの上限寄りの値である。

全テストは sandbox のネットワーク名前空間制約で5テストが失敗した（LAN interface列挙1、listen 3、cmdのLAN origin 1）。失敗後も全packageが走り、測定は再実行していない。旧M24測定43.2秒との差は実行環境・負荷が異なるため、比較判定は行わない。

報告作成後に `bash scripts/check-md-emphasis.sh` を実行した。exit 1、現在926行／固定ベースライン436行（+490）だった。本報告内で code span を除いた literal `**` は0行であり、既存 followup の `md-emphasis-baseline-regression-222` が記録する先行赤を含むため、本報告由来とは判定できない。

## §6 要判断の一覧

| ID | 何が分かれば判定できるか | 宛先 |
|---|---|---|
| `SM-029` | ダークモードを正式リリース条件から外したのか | 開発者 |
| `per-user-default-character-not-wired` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-list-filters-key-readers-expanded` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-list-setup-count-hides-fetch-failure` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `character-down-migrations-orphan-user-combos` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `check-progress-log-index-substring-false-green` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `config-save-fsync-untested` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `inline-insert-consolidation-remaining（CO-006 の残り）` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-export-character-id-is-raw-input` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `tag-management-page-not-i18n` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `filter-value-labels-hardcoded-ja` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `character-selector-label-is-ja-fixed` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `searchable-select-aria-controls-points-to-dialog` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-depends-on-implicit-default-character` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `claude-md-e2e-isolation-claim-false-both-ways` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-does-not-exercise-production-static-serving` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-ci-gate-remaining-two-conditions` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-retry-absorption-normalized-in-acceptance-criteria` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-build-step-lives-only-in-playwright-config` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `getbyrole-name-is-substring-match-by-default` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-measurement-env-not-representative` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-recipe-display-not-through-shared-component` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-detail-back-link-is-hardcoded` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `memo-shown-twice-on-detail` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `preset-switcher-uncontrolled-to-controlled-warning` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `oki-no-gauge-label-hardcoded-ja` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `tag-duplicate-constraint-not-translated` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `sqlite-busy-translation-remaining-paths` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-duplicate-key-predicates-duplicated` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `opponent-stance-vocabulary-split` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `opponent-stance-label-too-vague` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `sa-gauge-unit-suffix-split` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `field-labels-start-side-mismatch` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-editor-not-on-shared-editor-parts` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `move-category-system-label-review` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `test-only-dom-marker-ledger` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `virtual-controller-key-layout-not-like-real-pad` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `gauge-value-non-canonical-notation-round-trip` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `drive-gauge-half-step-invariant-removed` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `sa-gauge-unit-suffix-split（更新②）` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `editor-shortcuts-warn-at-keyboard-binding` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `editor-plain-navigate-remaining` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `tag-field-keyboard-unreachable` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `mock-presentation-timing-vs-plan-mode` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `editor-number-arrow-keys-do-not-advance` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-editor-basic-fields-draft-toggle-prop-dead` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `oki-legend-lacks-post-combo-annotation` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-editor-stale-revert-comment` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-to-combo-navigation-by-last-move（SM-146）` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `meaty-hit-not-modeled-in-combo` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-list-lacks-starter-move-filter` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `editor-validation-errors-unreachable-from-ui` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `editor-tab-badge-misroutes-setups-errors` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `val-dup-adapter-wiring-unobserved` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `csv-preview-commit-severity-asymmetry` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `csv-import-opponent-size-whitelist-stale` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `csv-import-failed-to-fetch-unreproduced` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-put-error-message-empty` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `gofmt-not-machine-checked` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `e2e-specs-not-type-checked` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-validate-comment-contradicts-caller` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-trash-restore-bypasses-leave-guard` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-unsaved-steps-cannot-use-recipetext` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `empty-recipe-label-four-variants` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `copy-idiom-three-ways` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `recipe-view-toggle-vocabulary` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-editor-page-hardcoded-ja` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `adopt-name-format-is-a-locale-string` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `setup-accordion-recipe-now-numbered-vertical` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `review-checklist-target-field-missing` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `export-cross-character-bulk-lost` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `csv-export-row-limit-silent-truncation` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `backup-restore-buttons-disabled` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `draft-not-restorable-by-roundtrip` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `zip-entry-name-constants-duplicated` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `import-export-terminology-candidates` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `co023-g15-not-fully-closed` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `window-confirm-in-gamepad-calibration` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `export-page-media-path-leak-resolved-by-removal` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `des002-ci-contract-e2e-not-in-ci-stale` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `go-test-wall-floor-is-migration-package` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `nightly-e2e-ci-mitigations-unverified` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `template-exclusion-is-currently-a-no-op` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `review-report-path-mismatch` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `des006-section-number-in-three-docs` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `trash-scoped-to-single-character` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `ground-dash-label-split-two-ways` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `step-word-used-in-two-senses` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `m24-10-is-a-gap` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-step-unit-word-deferred` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `english-locale-incomplete-shipped` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `csv-column-contract-unobserved-in-pr` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `gofmt-not-in-pr-checks` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combo-labels-normal-counter-split` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `des005-screen-names-stale` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `instruction-ledger-stale-counts-m24-07` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `m24-07-review-report-path` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `querykey-flattening-would-change-behavior` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `trash-bulk-permanent-delete-reason-hidden（本表 §V の行を参照）` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `stale-identifiers-after-querykey-unification` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `import-order-unchecked` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `instruction-ledger-stale-counts-m24-08` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `preset-edit-page-hardcoded-ja（CO-026 の一部）` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `commit-granularity-add-all` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `main-lacks-graceful-shutdown` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `bulk-rename-must-exclude-check-scripts` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `no-single-verify-command` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `no-periodic-lesson-lint-review` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `code-facts-generator-drifts-with-refactor` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `check-guard-cannot-see-partial-extraction` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `playbook-has-no-retirement-turn` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `playbook-does-not-know-its-own-checks` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `d510-misattribution-errata` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `progress-summary-section-numbering-disordered` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `check-doc-inventory-except-only-references` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `design-report-lesson-section-not-uniform` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `instruction-template-port-check-command-broken` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `cloud-env-cannot-reach-vuln-go-dev` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `codex-hooks-sessionstart-sync-pending` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `md-emphasis-baseline-regression-222` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `m23-06-unnamed-setup-unreachable-by-api` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `progress-log-index-check-false-green-recurrence` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `recipe-resolver-preset-lookup-per-step` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `tag-count-usage-inflated-by-orphan-combo-tags` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `combos-orphan-child-rows-count-unmeasured` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `db-open-file-uri-unverified-on-windows` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `shipped-name-ja-double-space-ken-sa2` | 公開前に必要か、公開後でも信用・配布・安全性へ影響しないかの根拠 | 設計担当＋開発者 |
| `FN-02` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `FN-04` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `FN-05` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `FN-06` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `FN-07` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `FN-08` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `CL-3.5-1` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `CL-3.5-2` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `CL-3.5-3` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `CL-3.5-4` | 2026-08-19 checklist と 2026-09-02説明のどちらを採るか | 開発者＋設計担当 |
| `CL-4-2` | 1.07秒・全体1.27%を許容するか | 開発者 |
| `SD-002` | 未分類メモをα②へ含めるか、別の後続課題か | 開発者 |
| `SD-005` | 未分類メモをα②へ含めるか、別の後続課題か | 開発者 |
| `SD-006` | 未分類メモをα②へ含めるか、別の後続課題か | 開発者 |
| `SD-007` | 未分類メモをα②へ含めるか、別の後続課題か | 開発者 |
| `SD-008` | 未分類メモをα②へ含めるか、別の後続課題か | 開発者 |

## §7 followup-backlog 本表への登録候補

followup-backlog 本表は編集していない。次を設計担当へ登録依頼する。

- `main-health-only-comment-stale`: cmd/combomgr/main.go 冒頭コメントが「/api/healthのみ登録」のまま。
- `code-facts-auth-routes-extractor-miss`: code-facts が auth handler 4本を未登録と誤表示する。
- `m25-source2-five-conflict`: 指示書A-2の五identityと M24正本の正式リリース前後五SMが一致しない。
- `m25-f1-source7-conflict`: 指示書A-7の四件とF-1表の四件が一致しない（SM-098対CO-020）。
- 既存項目は新規登録せず、§4.4の5スラッグ、`setup-link-by-ka-search`、`future-notes-inventory-before-phase4` を参照する。

## §8 想定外の発見・矛盾の事実指摘

1. M24 §2.1 の30/12は正本§2.2の28/14と不一致だが、正本を数えると総数52に一致する。
2. 指示書A-2は正式名を含む五identityを要求するが、M24正本の五SMはSM-029ダークモードを含み、正式名は含まない。脱落防止のため和集合6行を保持した。
3. 指示書A-7は SM-051/080/098/149、F-1表は SM-051/080/149/CO-020 を「§3-1の4件」とする。実際の m24-close §3-1 は前者である。F-2がCO-020継承も要求するため和集合5行を保持した。
4. M14 instruction の seed済17は現マイグレーション最終状態19へ進んでいる。差2は blanka/yasmine の列挙漏れと、c_viper/dhalsimが既seedであることの入替えで説明できる。
5. code-facts の route抽出は auth.RegisterRoutes を辿れず、auth4本を未登録扱いする。実装では登録済みである。
6. cmd/combomgr/main.go 冒頭の起動手順コメント「/api/healthのみ登録」は71本の現行経路表と不一致。
7. SUPP-001 の「LAN無認証一般は対象外」は現行本文の要求ではなく changelog の過去記録。現行設計は任意認証である。
8. Memo_Someday line391と405は逐語重複。phase4-memo 22件との内容一致は19、部分一致1で、申し送りの「逐語19」とは現在のファイルでは成立しない。
9. phase4-memo に無い補足要求が6件あり、逆に phase4-memo のみが2件ある。
10. followup の既存スラッグ `gofmt-not-in-pr-checks` と `combo-labels-normal-counter-split` は、それぞれ2行ずつ存在し、先行行は未解決、後続行は解消済みと状態も食い違う。ledger は後続行へ locator suffix を付けて両方を保持した。

## §9 教訓（retrospective-log 行き）

- 集計表と列挙が衝突したとき、正本行を直接数えると総数保存則で誤りの位置を特定できる。
- 「五件」「四件」のような自然言語の束は、別節でメンバーが差し替わっても件数だけ一致して見える。ID集合の比較が必要。
- 実装ルート表は登録関数を辿る必要があり、handler名の静的抽出だけでは未登録と誤判定する。
- 時点の違う seed 数は差分だけでなく、集合差を名指しすると「差2」の入替えまで説明できる。
- 性能比率は測定コマンド・失敗条件・再実行有無をセットで残す。
