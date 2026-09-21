# M14-03a レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象サブ | M14-03a(画面18 E2E 再有効化のみ・指示書 v1.0.1 是正後スコープ) |
| 対象コミット | `1f85709`(spec 全面書換え＋ドキュメント 2 件) |
| レビュー担当 | 品質レビュー担当 Claude / 2026-07-01 |
| 参照 | 指示書 v1.0.1・チェックリスト v1.0.1・設計担当伝達メモ・progress-log §M14-03a |

## 総評

指示書 v1.0.1 の是正後スコープ(**画面18 E2E の import 非依存 再有効化のみ**)に完全に沿っている。commit の変更は `moves-edit.spec.ts`(全面書換え)とドキュメント 2 件のみで、**マイグレ 000019 を作らず・既存マイグレ非改変・moves スキーマ不変・取込経路(FR704)を復活させていない**ことを実ファイルで確認した(重大判定基準はすべて非該当)。冪等性の設計(id 昇順先頭の決め打ち・rush 既存時の disabled 分岐・GET 最終状態の toPass 検証)はロジック上成立しており、旧 spec の非アンカー正規表現を `^...\b` へ改めた点で target 行と rush 行の取り違えも解消されている。Plan Mode 5 項目・前提破綻の申し送りも progress-log / handoff に過不足なく記載されている。指摘は堅牢性・保守性の軽微事項のみで、完了承認を妨げる問題は無い。

## 設計準拠性レビュー結果

### §1 設計・実装の照合

- ◎ `test.describe.skip` 解除・`TODO(M14-03)` 除去・import(`/import/moves`・22 列 CSV ヘッダ・`csvRow`)の完全撤去を確認。編集対象は既存 seed の ryu 技へ切替済み(spec L19-55)。
- ◎ recovery を含む編集→保存→GET 反映を検証(L66-79)。`recovery=8`・`total=25` を GET `/api/moves` の `toPass` で確認しトーストに非依存。DTO(`MoveResponse.Recovery *int json:"recovery,omitempty"`)が list に recovery を含むこと、`total`/`recovery` がいずれも**素の INTEGER 列**(000013 で total 追加・000018 で recovery 追加、生成列ではない)で PATCH により独立設定可能なことを確認済み。したがって `total=25` の断定は recovery 値と独立に成立する。
- N/A(v1.0.1 非適用) 000019 backfill / total 整合式検証。チェックリスト v1.0.1 §注記どおり本サブでは非適用。
- ◎ 設計判断を DES 本体へ直接書かず、伝達メモ(`m14-03a-design-handoff.md`)で申し送り。REQ/DES 非編集を確認。

### §2 マイグレの健全性

- N/A 000019 を作成していないため対象なし。`dbtest.Setup` 波及も無い(Go/マイグレ変更ゼロを `git show --name-only` で確認)。

### §3 温存対象の非破壊

- ◎ moves スキーマ不変・既存マイグレ(000001〜000018)非改変。commit 変更ファイルは spec＋docs 3 件のみ。
- ◎ 技編集経路(`service/move`・`GET/PATCH /api/moves`・rush 生成・notes_tool)不変。`handler.go`/`routes.go` に変更なし。
- ◎ 本体ランタイムへ取込経路を復活させていない(FR704 降格維持)。spec から import 依存を除去したのみで、削除済みパイプラインを参照しない。

### §4 テストの妥当性

- N/A 000019 up/down・total 整合の Go テスト(本サブ対象外)。
- ○ `moves-edit.spec.ts` の import 非依存通過。コード上は成立と判断(seed に normal/unique 非空中技が必ず存在し target が決まる/row・input・button の locator がスコープ内で一意/rush 既存時は disabled 分岐で二重生成回避)。ただし実機 Playwright 実行の証跡は本レビュー範囲外(§制約事項)。
- N/A recovery/件数前提テストの追従(件数前提を持つ `migrate_test.go TestRun_SeedRowCounts` は 000019 未作成のため変更不要、実際に未変更)。

### §5 ドキュメント

- ◎ 完了報告(progress-log §M14-03a)に Plan Mode 5 項目の確定内容・テストケース数(E2E 1 シナリオ)を明記。
- ◎ backfill の残扱いを M14-03b へ移設として設計担当へ申し送り(handoff §3・followup §C-1 更新依頼)。前提破綻(aki/jamie/guile は 000017 で削除済み)の監査証跡も適切。

### §6 重大な問題の判定基準

- すべて非該当。Plan Mode 5 項目確認済み / skip 解除済み・取込非依存 / 既存マイグレ・スキーマ不変 / 取込経路復活なし / backfill 由来の total 破壊なし(backfill 自体を実施せず) / マイグレ改変なし / FK×DELETE 同居なし。

## 設計準拠性以外の指摘事項

1. **【低】正規表現メタ文字の未エスケープ**(spec L62, L106): `new RegExp(\`^${code}\\b\`)` は seed 由来の `code` を直接埋め込む。現行 ryu の code は `[a-z_]` のみ(例 `standing_light_punch`)で安全だが、将来 seed に `.` や `+` 等を含む move_code(例 モダン系や記号表記)が加わると誤マッチし得る。`code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` で防御しておくと将来の seed 変更に強い。

2. **【低/情報】共有 dev DB への恒久的副作用**: 本 spec は共有 seed(ryu)の先頭技の `recovery`/`total` を恒久書換えし `rush_<code>` を 1 件生成する。move 新規作成 API が無い制約上不可避であり handoff/log で明示されているため許容範囲だが、combo-csv-io.spec.ts が `is_draft=true` で隔離しているのに対し本 spec は隔離不能で dev DB がクリーン seed から恒久ドリフトする点は残課題。将来 E2E 専用の使い捨て DB(Go の dbtest 相当)を用意できれば根治する。スコープ外の infra 事項として記録に留める。

3. **【低】`\b` アンカーの前提**: 末尾アンカーに `\b`(単語境界)を用いており、code が単語文字で終わることに依存する。現 seed は全 code が単語文字終端で問題ないが、上記 1 と同様に seed 命名規則(DES-004 §2.1)へ暗黙依存している旨をコメントに一言残すと保守者に親切。

（コーディング規約: TypeScript strict・`any` 不使用・命名・import 順は準拠。`console.log` 等の混入なし。マジックストリング `"rush_"` 相当は `rush_${code}` として rushCode に集約済みで散在なし。）

## 推奨修正（優先度別）

- 高（M14 完了前に修正必須）: なし。
- 中（M15 着手と並行可）: なし。
- 低（将来対応）:
  - 指摘 1: `code` の正規表現エスケープを施す(将来 seed の記号 code に対する堅牢化)。
  - 指摘 2: E2E 隔離不能な dev DB 副作用の恒久化。infra 側で使い捨て DB を整備できた段階で本 spec を移行検討(followup 化推奨)。
  - 指摘 3: `\b` アンカーが seed 命名規則に依存する旨のコメント補記。

## 良かった点

- 旧 spec の非アンカー `new RegExp(code)` を `^${code}\\b` / `^${rushCode}\\b` へ改め、target 行と `rush_<code>` 行の取り違えを構造的に排除している(rush 行は `rush_` 前置のため `^` アンカーで確実に非マッチ)。
- 冪等性の設計が丁寧: id 昇順先頭の決め打ち・保存差分ゼロ時の握り(`buildUpdate` の未変更判定)・rush ボタン disabled 分岐(`rushVariantExists`)・GET 最終状態の `toPass` 検証、の 4 点が噛み合い再実行安全性が実コード上で成立している。
- locator を `row` にスコープした上で aria-label(`硬直`/`全体`/`ラッシュ版`)で選んでおり、ヘッダのソートボタン(`○○ で並び替え`)との衝突を回避できている。
- Plan Mode で指示書 v1.0.0 の前提破綻(ajg 削除・ryu recovery 値未受領)を実マイグレ・`migrate_test.go` に照らして検出し、設計担当の v1.0.1 是正へ正しく接続。監査証跡(handoff)と進捗ログの粒度が高い。
- スコープ厳守: 便乗した既存ファイル改変・付随改善が一切なく、変更は spec＋docs 3 件に限定されている。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認(Playwright 実機実行での spec pass)・パフォーマンス・実機テストは別途実施が必要。

---

## 取り込み結果（自動トリアージ）

`implement_plan_full` Phase C により、製造担当が本報告書の各指摘を自動トリアージした（採否と理由を以下に記録・事後監査用）。重大（高）指摘はゼロのためエスカレーションなし。

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|--------|------|------|------|
| 1 | 低 | 正規表現メタ文字の未エスケープ（spec の code 埋め込み） | **採用** | 私が書いた新コードへの根本的な堅牢化で低コスト。`rowNameRe()` ヘルパーを新設し `code`/`rushCode` を `code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` でエスケープ。将来 seed に記号入り code が来ても誤マッチしない。 |
| 3 | 低 | `\b` アンカーが seed 命名規則に依存する旨のコメント補記 | **採用** | 指摘 1 と同一ファイル・同一ヘルパーに集約。`rowNameRe()` の doc コメントに DES-004 §2.1 命名規則依存を明記。 |
| 2 | 低/情報 | 共有 dev DB への恒久的副作用（ryu 先頭技の recovery/total 恒久書換え・rush 1 件生成） | **不採用** | move 新規作成 API 不在のため本サブでは不可避。handoff/progress-log に明示済みで、Plan Mode で開発者が「冪等配慮」の副作用込みで承認済み。根治には E2E 専用の使い捨て DB という **M14-03a スコープ外の infra 整備**が必要。**followup 化を推奨**（将来 infra 整備時に本 spec を移行検討）。優先度「低」のため自動で不採用・エスカレーション不要。 |

### 適用後の再検証

- `pnpm exec tsc --noEmit -p e2e/tsconfig.json` = clean。
- `pnpm exec playwright test e2e/moves-edit.spec.ts` = 1 passed（エスケープヘルパー化後も target 行・rush 行のマッチが不変）。冪等再実行も pass 済み。

### followup 申し送り（不採用#2 由来）

- **E2E 隔離不能な dev DB 副作用の恒久化**: 将来 E2E 専用の使い捨て DB（Go の `dbtest` 相当）を整備できた段階で `moves-edit.spec.ts` を移行検討。設計担当は followup-backlog へ登録を検討されたい（M14-03a スコープ外）。
