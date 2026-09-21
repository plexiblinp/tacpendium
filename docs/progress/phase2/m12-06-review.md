# M12-06 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M12-06-integration-e2e-and-release-decision.md` v1.0.0 |
| レビュー対象コミット | `df692a4` test(M12-06/e2e): E-1 presence-detection 多項目保持/クリア + 仮登録昇格スモーク |
| 対象成果物 | `web/e2e/m12-06-presence-detection.spec.ts` / `web/e2e/m12-06-draft-promotion.spec.ts` |
| レビュー担当 | 品質レビュー担当 Claude(Opus 4.8) |
| レビュー日 | 2026-06-26 |

## 総評

E-1(presence-detection 単一トライステート後の「未編集項目が消える」退行)の回帰ネットとして、最重点要件「保持/クリアの両検証」「複数型をまたぐ網羅」「実装方式非依存」を満たしており、品質は高い。fixture を API・編集を UI・アサートを API GET で構成する方式は、E-1 の本質(editor がロード→`buildPatchPayload` が全キー再送)を UI 経由で確実に通しつつ DOM 非依存を達成しており、批判的に検証しても本質の取りこぼしは無い(`ComboEditor.tsx:174-211` で対象全項目が `initial` からロード・再送されることを確認)。`git diff HEAD~1 HEAD` は新規 spec 2 本のみで、アプリ本体/DES/seed/マイグレへの変更ゼロ=非回帰違反なし。残る指摘は軽微であり、完了承認を妨げる重大問題は無い。ただし完了承認の前提として、§3.4 棚卸し対応表と nullable 項目セットが**完了報告に明記されていること**を別途確認する必要がある(本レビューは spec とコミットのみ参照のため未確認)。

## 設計準拠性レビュー結果

### §1 着手前確認 + 設計判断

- △ **§3.4.1 棚卸し対応表**: presence-detection spec 冒頭(5-8 行目)に「既存 E-1 相当は combo-crud / combo-custom-states の situation 1 種のみ」、draft-promotion spec 冒頭(5-7 行目)に「既存は draft 作成までで昇格操作が未検証」と棚卸し結論が記されており、判断根拠は妥当。実際に既存 spec を全数確認した結果、`combo-crud.spec.ts:63-102` の E-1 が situation のみ・`combo-custom-states.spec.ts` が situation クリアのみ・昇格 E2E は不在であることと一致する。ただし**指示書 §5.2/§8.3 が要求する「対応表(覆うフロー一覧)」は完了報告側の成果物**であり、spec コメントは要約に留まる。報告書に主要フロー(5体登録・閲覧/取込表示/custom_states/CRUD/比較/セットプレイ/仮登録昇格/仮想コントローラ)の対応表が揃っているかを別途確認すること。
- ◎ **§3.4.2 nullable 項目 HEAD 確認**: presence spec 20-24 行目が対象 13 項目を型別(文字列 memo/situation、整数 damage/drive・sa ゲージ/knockdown、小数 drive_damage、BOOLEAN 起き攻め6)で列挙。`internal/api/combo/dto.go:21-48`(CreateRequest)・`84-92`(UpdateMetadataRequest Optional)・DES-002 §4.2 の対象集合と完全一致。fixture のフィールド名も全て CreateRequest の JSON タグと一致する。
- ◎ **§10 設計判断**: 10-1(保持+クリア両方)・10-2(test-id/API ベース)・10-3(配布判定を spec で行わない)・10-5(過剰作成回避=昇格のみ穴埋め)を遵守。

### §2 E-1 回帰 spec(最重点)

- ◎ **保持検証**(`m12-06-presence-detection.spec.ts:80-100`): 多項目 fixture を作成 → editor で memo のみ書換 → API GET で `memo` 更新かつ `expectUntouchedFieldsRetained`(damage/drive・sa ゲージ/knockdown/起き攻め3/situation)を一括アサート。presence-detection(キー不在/同値再送=不変更)の回帰ネットとして成立。
- ○ **クリア検証**(`:104-124`): drive_damage(小数)を空入力 → present+null 送信 → `driveDamage` のみ undefined(`json:"driveDamage,omitempty"` を `dto.go:147` で確認)・memo と他項目は保持。クリア方向として成立。ただし**クリアは小数型 1 種のみ**で、文字列クリア(situation)は既存 `combo-custom-states.spec` に依存、整数・BOOLEAN のクリアは未カバー。指示書 §4.1 は「1 項目をクリア」しか要求しないため準拠だが、型網羅は保持側ほど厚くない(§推奨修正 中)。
- ◎ **複数型網羅**: 保持側で文字列/整数/小数/BOOLEAN/JSON を横断。指示書 §3.4.2 の確定項目セットを覆う。
- ◎ **実装方式非依存**: 編集は UI(test-id `combo-editor-drive-damage`〔`ComboEditorBasicFields.tsx:230` 実在〕/ placeholder `MEMO_PLACEHOLDER` / role `保存`)、アサートは API GET。特定 DOM 構造に依存しない。**批判的評価**: API fixture + API assert でも、編集本体は UI を通すため editor のロード→`buildPatchPayload` 再送は実検証される(`ComboEditor.tsx:174-211` で全項目が再送対象であることを確認済)。「UI を通さず本質を取りこぼす」懸念は当たらない。むしろ DOM 表現を持たない nullable 項目まで確実に検証でき、純 DOM 方式より堅牢。

### §3 統合 E2E の棚卸し・穴埋め

- ○ **対応表**: §1 で述べた通り、spec コメントに結論はあるが完全な対応表は完了報告側成果物。報告書での網羅確認を要する。
- ◎ **重複なし/穴埋めの妥当性**: 仮登録→本登録昇格は既存 E2E に不在(`PromoteToFinalButton` の単体テストはあるが E2E は無い)で、genuine gap の最小スモーク(1 ケース)穴埋め。指示書 §10-5 過剰作成回避に合致。既存フロー(CRUD/custom_states/取込/B-7)への重複追加は無し。

### §4 既存挙動の温存(非回帰)

- ◎ **既存 spec 非破壊**: 新規 2 ファイルの追加のみ。既存 spec への編集なし。
- ◎ **スコープ厳守**: `git diff HEAD~1 HEAD --stat` は `web/e2e/` 配下 2 ファイル(+187 行)のみ。アプリ本体(FE/BE)・DES・seed・マイグレ・新規 test-id 付与いずれも変更なし(既存 test-id を流用)。

### §5 実行・報告

- △ **ローカル緑**: 製造環境はブラウザ未導入のため未実行。両 spec とも冒頭に「実機は開発者ゲート」を明記しており方針通り。緑確認は開発者ゲート。コード上は live スタック(:47318 / :5173・マイグレ 000017)前提が明示され、参照 API・セレクタは実在を確認済。
- △ **報告**: 追加ケース数(保持1+クリア1+昇格1=3)・棚卸し対応表・nullable 項目セットの完了報告への記載は本レビューでは未確認(spec とコミットのみ参照)。完了報告に揃っているか開発者確認を要する。

### §6 ドキュメント

- ◎ **nullable 項目セット明記**: presence spec 20-24 行目に明記。
- ◎ **配布判定の主体**: 両 spec とも §7 配布判定の可否判断を一切行わず、開発者ゲートを尊重。

## 設計準拠性以外の指摘事項

- **セレクタ堅牢性(中〜低)**: `m12-06-draft-promotion.spec.ts:29,31` の `page.locator("ol > li")` は DOM 構造依存で、§10-2「実装方式非依存」の理想からはやや外れる。ただし既存 `m12-05-*.spec.ts:53,57` と同一パターンで、リスト構造変更時に共倒れする前提が揃っているため新規導入の劣化ではない。将来 test-id 化が望ましい。
- **昇格確認ダイアログのボタン名(問題なし・確認済)**: `:48` の `dialog.getByRole("button", { name: "OK" })` は、`PromoteToFinalButton.tsx:99` の `AlertDialogAction = t("common.confirm")` = `ja.json` で "OK" と一致。キャンセルは "キャンセル" で衝突せず一意。フレーク無し。
- **保持テストの false-positive ガード欠如(低)**: fixture が起き攻め6のうち代表3のみ true、残り3は null。`expectUntouchedFieldsRetained` は true 側3項目しか検証せず、「未設定3項目が誤って true 化されない」逆方向は未アサート。E-1 の主目的(消えない)からは外れるため軽微。
- **後始末の堅牢性(低)**: 各テストの `page.request.delete(...)`(`:99,123` / draft `:60`)を await/ok 検証せず、テストが delete 前に失敗すると draft コンボがリーク。ただし memo は `Date.now()` で一意・draft は C02 重複対象外のため害は無く許容範囲。
- **マジックナンバー(低)**: `fixturePayload` の 3500/3/2/-2.5/4 はインラインだが、コメントで VAL 範囲根拠(C04/C05/C10/C11/C13)を明示しており spec としては可読。
- **型安全**: `(await ...).json()` 由来の `any` を helper では `Record<string, unknown>` で受けており、テストコードとして妥当(CLAUDE.md §4 TypeScript の `any` 原則禁止はプロダクトコード向け)。

## 推奨修正(優先度別)

- **高(M12 完了前に確認必須)**:
  - 完了報告に (1) §3.4.1 主要フロー全数棚卸し対応表、(2) E-1 が検証する nullable 項目セット(§3.4.2 確定)、(3) 追加ケース数、(4) 実機ゲート手順 が揃っていることを開発者が確認する(指示書 §8.3/§8.4・チェックリスト §1/§10 の完了前提)。spec コメントは要約のみで、対応表本体は別途必要。**コード修正は不要**。

- **中(M13 着手と並行可)**:
  - クリア検証の型網羅を補強(任意): 現状は drive_damage〔小数〕クリアのみ。整数(damage)または BOOLEAN(起き攻め)のクリアケースを1つ追加すると、クリア方向の型横断が保持方向と対称になる。指示書要求は満たすため必須ではない。

- **低(将来対応)**:
  - draft-promotion の `ol > li` を recipe ステップ用 test-id へ置換(既存 m12-05 と共通の課題)。
  - 保持テストに「未設定の起き攻め3項目が null のまま」の逆方向アサートを追加。
  - 後始末 delete の ok 検証(リーク防止の堅牢化)。

## 良かった点

- **API fixture + UI 編集 + API assert の三層構成**が秀逸。新規 test-id 付与(スコープ逸脱)を避けつつ、editor のロード→`buildPatchPayload` 再送という E-1 の本質を UI 経由で確実に通し、DOM 表現を持たない nullable 項目まで網羅できている。純 DOM 方式より堅牢。
- **複数型横断 + helper(`expectUntouchedFieldsRetained`)による DRY**。保持アサートが一箇所に集約され可読性・保守性が高い。
- **既存 E-1(situation のみ)との差分を明示**し、numeric/boolean への拡張という穴埋めの意図を spec 冒頭で根拠化(retrospective-digest §1 パターン A「あるはずで書かない」を実践)。
- **穴埋めが genuine gap(仮登録昇格 E2E 不在)に限定**され、過剰作成を回避(§10-5 準拠)。
- 各 spec 冒頭の方式・前提・実機ゲート注記が丁寧で、開発者ゲートでの実行手順が明確。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認(ブラウザ実機・E2E 緑)・パフォーマンスは別途実施が必要。
- 完了報告(棚卸し対応表・ケース数・nullable 項目セットの記載)は本レビューでは未参照のため、その充足は開発者が確認すること(コミットメッセージには要約のみ存在)。

---

## 取り込み結果(自動トリアージ)

製造担当 Claude(implement_plan_full Phase C)による自動トリアージ結果。各指摘の採否と理由を事後監査可能化のため記録する。
**安全弁**: 「高」指摘の不採用は開発者エスカレーション対象だが、本レビューの「高」は採用済みのためエスカレーション不要。

| # | 指摘(優先度) | 採否 | 理由 |
|---|---------------|------|------|
| 1 | 完了報告に棚卸し対応表・nullable 項目セット・ケース数・実機手順を揃える(**高**) | **採用** | コード修正不要。完了報告(本工程の最終出力)に §3.4.1 棚卸し対応表・§3.4.2 確定項目セット・追加ケース数(3)・実機ゲート手順を明記して充足。 |
| 2 | クリア検証に整数/BOOLEAN 型を追加(中) | **不採用** | 整数(damage)/BOOLEAN(起き攻め)を UI でクリアするには新規 test-id 付与が必要 → 指示書 §2.3「E2E spec のみ・FE 変更不可」/レビュー §7「アプリ本体変更=スコープ逸脱」に違反する。drive_damage は既存 test-id を持つ唯一の数値フィールド。presence-detection 機構は `Optional[T]` で型非依存のため型網羅の追加価値は小さく、指示書 §4.1 は「クリア1項目」で充足。中指摘につき理由記載のうえ不採用。 |
| 3 | 保持テストに逆方向ガード(未設定起き攻め3項目が null のまま)(低) | **採用** | スコープ内・低コスト・E-1 の核心(未編集項目を誤変更しない)の対称的健全性を強化。`expectUntouchedFieldsRetained` に `okiMeatyBackTechThrow`/`okiMeatyBackTechThrowDr`/`okiShimmyNeutralTech` の `toBeUndefined()` を追加(コミット参照)。 |
| 4 | `ol > li` を recipe ステップ用 test-id へ置換(低) | **不採用** | RecipeBuilder への test-id 付与=FE 変更でスコープ逸脱。既存 `m12-05-*.spec.ts` と同一パターンで新規劣化ではない。将来 FE 変更を伴うサブで対応。 |
| 5 | 後始末 delete の ok 検証(低) | **不採用** | 後始末の失敗で本質アサート成功後に偽陽性 fail するのを避ける。既存 spec(combo-crud 等)も delete 結果を検証せず一貫。memo は `Date.now()` 一意・リークは draft のみで C02 重複対象外のため害なし。 |

**結論**: 重大(完了承認を妨げる)指摘ゼロ。採用2件(高1=報告書対応 / 低1=コード追補)、不採用3件(いずれも理由明記、スコープ制約 or 既存パターン整合)。「高」不採用なしのためエスカレーション不要。
