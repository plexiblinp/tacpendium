# M7-04-2 製造 → 設計担当 連携メモ

| 項目 | 内容 |
|------|------|
| 作成 | 製造担当 Claude、2026-06-03 |
| 対象 | M7-04-2(残り4プリセット切替確認 + AKI/ジェイミー/ガイル追加 + スキーマ耐久テスト)完了後の申し送り |
| 関連 | 指示書 `docs/instructions/M7-04-2-presets-characters-schema-durability.md` v1.1.0 / レビュー `docs/progress/m7-04-2-review.md` / 実装記録 `docs/progress/progress-log.md` M7-04-2 節 |
| 位置づけ | 製造時の確定判断・指示書/設計書の不整合・フェーズ2以降に設計が必要な残課題の伝達。**スキーマ変更は発生せず CHANGE 通知書の起票には至らない**(製造担当は起票しない方針)。A群は設計担当による指示書/設計書修正、B群はフェーズ2マイルストーン設計時の拾い上げを想定 |

---

## A. 指示書/設計書の記述修正候補（設計側ドキュメントの修正案件）

### A-1. HTML フォルダ名の表記ミス: `html_work/` → `work_html/`

- **箇所**: M7-04-2 指示書 §0.2 / §2.1 / §3.1 / §3.4.5 / §3.4.11 ほか(`html_work/` と複数箇所で記載)。
- **事実**: 開発者が実際に配置したフォルダは **`work_html/`**(`work_html/{aki,jamie,guile}.html`)。`.gitignore` も `work_html/` で除外済み。製造は実体を使用し、生成した seed SQL のコメントも `work_html/` を参照。
- **対応案**: 指示書の `html_work/` 記述を `work_html/` に統一。実装の正確性には影響なし(seed は HTML から正しく抽出済み)。

### A-2. DoD §7.3 の項目数が §3.4.10 と不整合（6 → 5 の取り残し）

- **箇所**: M7-04-2 指示書 §7.3「[ ] **§3.4.10 必須 6 項目**の確定内容に従って実装されている」。
- **事実**: §3.4.10 は v1.1.0 で **5 項目に整理済み**(更新履歴に「§3.4.10 を 6 項目 → 5 項目に整理」と明記)。DoD §7.3 のみ「6 項目」の旧表記が残存。
- **対応案**: §7.3 を「5 項目」に修正。

### A-3. ジェイミー custom_states の表記が DES-003 正準例・実装と不整合

- **箇所**: M7-04-2 指示書 §0.1 表 / §4.2(ジェイミー = `subject: self` / **`type: level`** / integer min-max と簡略表記)。
- **事実**: DES-003 §3.2 の正準例は `drunk_level` を **`type: composite`(value_definition = level:integer 0-4 + unlocked_moves:string_list)** として定義。開発者確定(2026-06-03 AskUserQuestion)で **composite を採用**し、実装も composite で投入(seed の JSON は DES-003 example と一字一句一致、レビュー §1 で確認済み)。
- **対応案**: 指示書 §0.1/§4.2 のジェイミー記述を `composite` に揃える(DES-003 および実装に整合)。AKI 毒 = `opponent/flag/boolean`、ガイル = NULL は表記どおりで問題なし。

---

## B. 設計判断が必要な残課題（フェーズ2以降、設計の関与が要る）

### B-1. ComboEditor がリュウ固定のまま = フェーズ1ではUI経由で他キャラのコンボを作成できない

- **背景**: 指示書 §2.2/§3.4.4 は「M3-04 で `useCharacters` フック化済みのため**大半は対応済みのはず**」と想定。しかし製造時の実態確認で、以下4箇所が**リュウ固定のまま**だった:
  - `ComboListFilters.tsx`(キャラ絞り込みドロップダウンがハードコードの単一リュウ option、`useCharacters` 未使用)
  - `ComboEditor.tsx`(`const RYU_CHARACTER_ID = 1` + `useMovesByCharacter(RYU_CHARACTER_ID)`)
  - `MyComboPage.tsx`(`characterId` 定数固定 + `CharacterSelector` の `onChange` が no-op)
  - `ComboDetailHeader.tsx`(キャラ名/バッジが "リュウ" 固定)
- **今回の対応**: 開発者確定(閲覧のみ)に従い、**閲覧系3箇所のみ de-hardcode**(ComboListFilters / MyComboPage / ComboDetailHeader)。**ComboEditor は据え置き**。AKI/ジェイミー/ガイルのコンボは seed SQL でのみ存在。
- **設計への申し送り**: **フェーズ1ではユーザーがUIから登録できるのはリュウのコンボのみ**。M7-05 のフェーズ1完了判定で、これを「フェーズ1の既知の範囲」として認識すべき。他キャラのコンボ登録UI(ComboEditor のキャラ選択化 + キャラ別 moves 取得)はフェーズ2の設計案件。

### B-2. custom_states は「保存+API返却」のみで、消費・表示・参照が一切未実装

- **事実**: `characters.custom_states` はバックエンドが JSON 文字列をそのまま保持して API で返すだけ。combos/combo_steps/modifiers のどこからも参照されず、フロントにも表示UIが無い(型定義に `customStates?` はあるが未使用)。
- **帰結**: C系統「custom_states エンドツーエンド耐久」は、実態としては **seed投入 → API ラウンドトリップ → 当該キャラのコンボが破綻しない、の確認に限定**される(毒/酔いレベルがレシピ・状況・バリデーションに作用する経路は存在しないため確認しようがない)。
- **設計への申し送り**: 毒(AKI)・酔いレベル(ジェイミー)が実際に機能する仕組み(コンボステップ/状況/レシピ表記への反映、レベルで使用可能技が変わる等)は **フェーズ2+で要設計**。「custom_states を持つキャラの耐久を確認した」の意味範囲(=ストレージ往復まで)を設計側も同じ解像度で押さえておくべき。

### B-3. recipe_cache の無効化戦略が無い（既存設計のギャップ、フェーズ2で顕在化）

- **事実**: `service/notation/cache.go` の `ResolveComboRecipe` は **recipe_cache に該当プリセットのキーが既にあれば再計算せずそのまま返す**。再計算が走るのは combo 自体の作成/更新/復元(`RecomputeComboCache`)経由のみ。プリセットのエイリアスを後から追加・編集しても、**キャッシュ済みコンボの recipe_cache は自動更新されず stale になる**。
- **今回との関係**: M7-04-2 の seed コンボ(000012)は「空4プリセットは official_ja_move へフォールバック=全プリセット同一文字列」という**フェーズ1の前提**で recipe_cache を投入済み。フェーズ2で numeric_ja/srk 等のエイリアスを整備すると、これら seed コンボの recipe_cache は古い表記のまま齟齬が出る。
  - ただし**これは私の変更で生じた欠陥ではなく既存設計の性質**であり、かつ当該 seed コンボは M7-05 で全クリア予定(§3.4.10 項目3)のため**当面の実害はなし**。
- **設計への申し送り**: フェーズ2の「残り4プリセットのエイリアス実データ整備」「プリセット管理UI / カスタムプリセット作成(DES-004 §6)」着手時に、**プリセット/エイリアス変更時の recipe_cache 無効化(全コンボ再計算 or 遅延無効化)方式の設計が必須**。

---

## C. 軽微 FYI

### C-1. ロード中フォールバック文言が "リュウ" 固有（レビュー指摘#4・低）

- `ComboListFilters.tsx`(取得前/0件時の option)と `ComboDetailHeader.tsx`(`characterName || t("comboDetail.characterRyu")`)で、キャラ未解決時のフォールバックに `characterRyu`("リュウ")キーを使用。
- 今回の変更は従来の**無条件 "リュウ" 固定**を動的化した上での**短命なロードフォールバック**であり既存挙動より改善済み。レビューも将来対応評価。フェーズ2の i18n フォールバック整備時に汎用キー(`common.unknown` 等)へ寄せるのが望ましい。

### C-2. down マイグレーションの恒久テストは未追加

- 製造側で up → down(4段)→ up の冪等性を手動検証し、down でリュウのみ(moves 56/aliases 56 温存・combos 0)へ正しく戻り、up 再適用で4キャラ/耐久コンボ36に復帰することを確認済み。
- ただし `internal/infra/migration/migrate_test.go` に**ロールバックの恒久テストは無いまま**(M7-04-2 以前から未整備)。QA 観点で恒久化を検討する余地あり(本タスクのスコープ外と判断し未追加)。

---

## 参考: 今回の確定事項(§3.4.10 必須5項目、2026-06-03 開発者 AskUserQuestion 回答)

1. HTML→スキーマ対応付け: 技名セル → official_ja_move エイリアス + code(DES-004 §2.1 命名)、数値カラムは全 NULL。
2. custom_states 耐久範囲: 既存 JSON 列で完結、**スキーマ変更不要**、表示UIは作らない(B-2)。
3. 検証用リュウデータ全クリア: **M7-05 送り**。
4. 代表コンボ投入方式: **seed SQL**(各キャラ12件=36件)。
5. キャラ固有技名のプリセット扱い: **フェーズ2送り**(official_ja_move のみ投入、空4プリセットはフォールバック)。
- フロント de-hardcode 範囲: **閲覧のみ**(B-1)。
- ジェイミー飲酒レベル: **composite**(A-3)。

*以上*
