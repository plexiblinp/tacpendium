# M11-RESEARCH-02 調査指示書: PATCH メタデータ更新経路の現状調査

| 項目 | 内容 |
|------|------|
| 指示書ID | M11-RESEARCH-02 |
| バージョン | 1.0.0 |
| 作成日 | 2026-06-20 |
| 作成者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 対象 | M11-02(nullable メタデータの PATCH クリア一般化)の方式確定の前提裏取り |
| 実装モデル | Sonnet 4.6（read-only 全数調査・創発的判断を含まない。architecture-patterns §6 調査担当運用） |
| レビュー | 不要（事実列挙のみ） |
| 種別 | **read-only 調査**（コード変更・テスト追加・設計判断を一切行わない） |
| 関連 | M11-overview §3.3 / CHANGE-041(PATCH に situation 加算)/ CHANGE-042(situation 空文字センチネル=NULL クリア)/ 製造担当伝達レポート §5.1 |

---

## §1 背景と目的

M11-01 事後に、`PATCH /api/combos/:id`（メタデータ編集）で **nullable メタデータ(memo / damage / ゲージ / knockdown_advantage 等)を空に戻しても永続化されない**同型バグ(伝達レポート §5.1)が判明した。M11-02 でこれを一般解(full-replace 〔送られた null=クリア〕か、presence-detection トライステート 〔フィールド不在=不変更・null=クリア〕か)で修正する。

**どちらの方式が適切かは「フロントが PATCH ペイロードを全フィールド毎回送るか / 変更分のみか」と「バックエンドの per-field nil 判定の実装」に依存する。** 本調査はその実態を read-only で確定する。**設計判断（方式選定）は行わず、事実のみ列挙する**(judgement-free)。

---

## §2 調査項目

> 各項目、実コードを `view` し、ファイル名:行番号と該当コード断片(短く)を添えて回答。0 件・不在も明示。推測は禁止し、確認できない点は「未確認」と書く。

### Q1. フロント `buildPatchPayload` のペイロード構造（最重要）
`web/src/features/combo/components/ComboEditor.tsx` の `buildPatchPayload`(:173 付近)を中心に:
- (1-a) `UpdateMetadataRequest`(PATCH ボディ)に**どのフィールドを含めるか**。**全メタデータフィールドを毎回含めるか / その時点の値があるフィールドのみか / 変更されたフィールドのみか**。
- (1-b) 各フィールドの値生成と**空入力時の送出値**: memo(`nullIfEmpty` 等)、damage / drive_damage(`parseOptInt` 等)、drive_available_at_start、sa_available_at_start、knockdown_advantage、起き攻め 6 BOOLEAN、tags、is_draft、situation(CHANGE-042 で `?? ""`)。**空のとき `null` を入れるか、キー自体を出さない(undefined→JSON で omit)か**を各フィールドで明記。
- (1-c) ペイロードは `JSON.stringify`(または同等)で送られるか。`undefined` のフィールドが**シリアライズ時に脱落するか**(=「キーを送らない」が技術的に成立するか)。

### Q2. `UpdateMetadataRequest` DTO 定義
`internal/api/combo/dto.go`(実パスは `grep` で特定):
- (2-a) `UpdateMetadataRequest` の**全フィールドの型と json タグ**(`*string`/`*int`/`*bool` 等・`omitempty` 有無)。
- (2-b) Go の `json.Unmarshal` で、現状この DTO は**「キー不在」と「キーあり値 null」を区別できるか**(`*T` では両方 nil に落ちる。`json.RawMessage`・`map`・カスタム `UnmarshalJSON` 等の有無)。

### Q3. service / repository の `UpdateMetadata` 実装
`internal/service/combo/`・`internal/repository/combo/repository.go`:
- (3-a) `UpdateMetadata`(repository)の SET 句組み立て。**各フィールドが `if input.X != nil { add(col, *input.X) }` の per-field nil チェック(=部分更新 / nil=不変更)か**を、対象フィールドを列挙して確認。
- (3-b) situation の `== "" → add("situation", nil)`(NULL クリア・CHANGE-042)分岐の実装箇所と、他フィールドに同種のセンチネル分岐があるか。
- (3-c) `UpdateMetadataInput`(service)の各フィールド型と、DTO→Input の受け渡し(nil/値の伝播)。

### Q4. クリア対象 nullable メタデータの全数
- (4-a) `combos` テーブルの**nullable 列**のうち、PATCH メタデータ更新の対象でフロントが空に戻し得るものを全列挙(memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / その他)。
- (4-b) 各列について現状**クリア可能か**(空入力→null 送出→nil=不変更で**温存(クリア不能)**か、`false` 等の非 null 送出で**クリア可**か)。起き攻め 6 BOOLEAN が `false`(非 null)送出でクリアできている点の確認。

### Q5. 既存テスト・契約への影響材料
- (5-a) `internal/repository/combo/repository_test.go` の (16)(17)(18) ほか、`UpdateMetadata` の **nil=不変更 / situation ""=NULL を前提するテスト**を列挙(方式変更時に壊れ得るもの)。
- (5-b) フロント `ComboEditor.test.tsx` の PATCH ペイロード検証(situation/memo 等)の前提。

### Q6（補足）
- full-replace（送られた null=クリア）に倒した場合に**「送り忘れフィールドが誤クリアされる」リスク**となる経路(buildPatchPayload が条件付きで一部フィールドを省略していないか、is_draft 切替や別フローで部分的な PATCH を投げていないか)。

---

## §3 制約・姿勢

- **read-only**。コード・テスト・設計書を一切編集しない。
- **judgement-free**。方式の良し悪し・推奨を書かない(設計判断は設計担当が行う)。事実と該当コードのみ。
- **全数性**。「対象フィールド全部」「nullable 列全部」を網羅し、0 件・不在も明示。
- code-facts は参考に留め、**最終根拠は実コード**(retrospective-digest §1-A)。
- 確認できない点は「未確認」と明記し、憶測で埋めない。

---

## §4 成果物

`docs/progress/M11-RESEARCH-02-report.md` に以下を含める:
- §0 サマリ表(Q1〜Q6 の要点 1 行ずつ)。
- §1〜§6 各項目の回答(ファイル名:行番号 + 短いコード断片 + 事実)。
- 特に **Q1-a(全送出 / 変更分) と Q2-b(不在と null の区別可否)** は、方式選定(full-replace vs presence-detection)の決め手のため明確に。
- 末尾に「未確認事項」一覧(あれば)。

---

*M11-RESEARCH-02 調査指示書 v1.0.0。配置 `docs/instructions/M11-RESEARCH-02-patch-metadata-update-current-state.md`。報告は `docs/progress/M11-RESEARCH-02-report.md`。*
