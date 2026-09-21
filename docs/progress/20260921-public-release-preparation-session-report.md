# 公開前残作業整理・private staging 実施報告

| 項目 | 内容 |
|---|---|
| 記録日 | 2026-09-21 |
| 対象 | Tacpendium 初回公開前の A-0 棚卸し、公開用リポジトリの private staging、CI 実走 |
| 公開側 | `plexiblinp/tacpendium`（配布専用 snapshot） |
| 状態 | **private staging と事前検査は完了。公開前に設計卓の反映が必要な残件 1 件あり** |

## 1. 結論

公開用リポジトリを「第二の開発リポジトリ」ではなく、非公開開発リポジトリから一方向同期する**配布専用 snapshot**として準備した。初回 snapshot の同期、公開側の機能制限、`main` の ruleset 作成、通常 CI と Nightly の実走は完了し、全ジョブが緑である。

一方、`docs/handover/followup-backlog.md` を「未着手」「公開前」等で再走査した結果、`restore-real-user-premise-before-public-release` が未解消である。これは公開後に実ユーザー DB が存在する前提へ運用規則を戻す作業であり、**公開前の確定ブロッカー**である。設計ルール文書の変更を伴うため、設計卓へ反映を依頼する。

## 2. 今回完了した作業

### 2.1 A-1 / A9 — SCANOSS・静的解析・シークレット走査

- A-1 / A9 は開発者確認により完了扱いとした。
- SCANOSS は固定した公開候補に対して再実行済み。
- 初回 81 件から最終 80 件となり、2 件解消、79 件維持、新規 1 件であった。
- 新規 1 件は低優先度の偽陽性として disposition 済みである。
- 維持した一致は、既知 vendored source または収束理由を記録済みである。
- 全履歴シークレット走査は Windows ホストの full clone（全 ref、3,116 commits）で実施した。
  - Betterleaks v1.8.1: 57 件。全件 `generic-password`。
  - Gitleaks v8.30.1: 17 件。全件 `generic-api-key`。
  - いずれも既知のテストデータ・文書・seed SQL 等の同じ偽陽性分類で、新しい候補分類は 0 件。
- `govulncheck` は devContainer で完走済み。自コードが呼ぶ脆弱性 0 件、import 対象 0 件、`require` にのみ 1 件で、未使用 `openpgp` の修正版なし案件として対応不要を記録済み。
- `golangci-lint` は、導入済みバイナリと対象 Go 版の不整合により実行不可として記録済み。再実施は行わない。

### 2.2 A-2 — SSH リリースタグ署名の準備

- リリースタグ署名用 Ed25519 鍵を Windows ホストに作成した。
- 公開鍵を `.github/allowed_signers` へ principal `tacpendium-release`、namespace `git` として登録した。
- 秘密鍵はリポジトリへ含めていない。
- GitHub への通常の push は HTTPS と Git Credential Manager を使用する。これはリリースタグへの SSH 署名とは別経路である。
- コード署名は費用対効果の判断により公開必須条件にしない。SSH タグ署名は引き続き必須である。

### 2.3 公開用リポジトリの private staging

- `plexiblinp/tacpendium` を private staging に変更した。
- 公開側は配布専用 snapshot とし、直接編集しない方針を確認した。
- Issues、Discussions、Projects、Wiki、Pull requests をすべて無効化した。
- 公開 snapshot を生成し、内容のあるディレクトリへ Git リポジトリを初期化して初回 commit を作成・同期した。
- 後続の文書同期を含め、ローカル `main`、tracking branch、GitHub の `main` が同一 commit であることを確認した。
- `protect-main` ruleset を Default branch（`main`）対象で作成した。
  - deletion 禁止
  - force push 禁止
  - linear history 必須
- private リポジトリでは現在のプラン上 ruleset が強制されない旨の警告が出ている。public 化直後に適用状態を再確認する。

### 2.4 CI 実走

公開側 private staging で次を実走し、すべて緑である。

| Workflow | Job | 結果 |
|---|---|---|
| PR checks | go vet + go build | 緑 |
| PR checks | go test | 緑 |
| PR checks | web test（Vitest） | 緑 |
| Nightly | cross-build | 緑 |
| Nightly | E2E | 緑 |

### 2.5 その他の公開前判断

- `SECURITY.md` の窓口、`NOTICE` の実アドレス、公開リポジトリ URL は実値へ反映済みで、プレースホルダーは残っていない。
- M26-03 の法務確認は公開前に再実施せず、完了済みの結果を採用する。
- SF6 データは 2026-08-03 版、31 キャラクターで最新と確認した。次回更新は 2026 年 10 月予定として公開後の更新運用で扱う。
- 押せないバックアップ／リストアボタンは、説明書とツールチップで将来実装を明示した現状のまま公開を許容する。
- 紹介動画とブログは開発者が別途進めるため、本セッションの公開ゲートに含めない。
- Dependabot version updates の自動 PR は別判断とする。Pull requests を無効化している現状では有効化しない。

## 3. A-0 再棚卸し結果

### 3.1 本当に公開前必須

#### `restore-real-user-premise-before-public-release`

公開前の緩和として残っている「実ユーザー不在・dev DB のみを考慮する」という条件を解除し、公開後の通常運用へ戻す必要がある。

設計卓への依頼内容:

1. `docs/handover/design-instruction-playbook.md` §4.17 の導入部を、実ユーザー DB と開発者が作成していない行が存在する前提へ戻す。
2. 同 §4.17.3 を、破壊的 migration の down は忠実復元と ground-truth 検証を既定とし、no-op down を通常許容しない規則へ戻す。
3. `docs/handover/retrospective-log.md` §1 パターン G の公開前限定の発動条件を解除する。
4. `docs/handover/retrospective-digest.md` §5 の destructive migration 項目から「★発動条件」の公開前緩和を除き、常時有効な規則へ戻す。
5. `docs/handover/followup-backlog.md` の当該行を、上記 4 点の反映後に完了へ更新する。

当該 backlog に併記された C.Viper / Dhalsim の未 seed 懸念は古い。現在は `character_data/c_viper.csv` と `character_data/dhalsim.csv` が存在するため、この部分を再作業の根拠にしない。

### 3.2 公開前の確認候補

`M16-06-notation-followup` に、長い日本語ラベルをスマートフォン幅・画像出力・PDFで目視する確認が「未着手（リリース前／別途）」として残っている。機能実装ではなく表示確認であるが、記述どおりなら公開前確認に分類される。実施済みなら台帳更新、未実施なら公開前に目視確認が必要である。

### 3.3 public 化直後に実施するもの

- `protect-main` ruleset が `main` に強制適用されたことを確認する。
- Private vulnerability reporting を有効化する。
- Dependabot alerts を有効化する。

これらは private staging 中には完了できない、または public 化と同じ手番で確認すべき項目であり、現時点では公開前ブロッカーの「未実装」とは扱わない。ただし public 化した手番で続けて実施する。

### 3.4 RC・本番リリース時に実施するもの

- 公開側で SSH 署名付き注釈 RC タグを作成する。
- release workflow を通し、3 OS アーカイブ、SBOM、attestation を確認する。
- `gh attestation verify` を 3 アーカイブすべてに対して実行する。
- RC が通るまで本番タグを作成しない。
- 本番リリース後、利用者目線で SHA-256 と attestation を確認する。

### 3.5 完了済みだが台帳が古いもの

- 公開リポジトリの運用モデル確定と private staging
- 全履歴シークレット走査
- Nightly の cross-build / E2E 実走
- 公開用連絡先、`NOTICE`、公開 URL の確定
- M40-01 由来の第三者 attribution と三層ライセンス整理
- 公開前の法務再実施を行わない判断
- disabled のバックアップ／リストアボタンを許容する判断
- SF6 データ鮮度確認

設計卓は、これらに対応する `followup-backlog.md` の行を現物と本報告に照らして完了・裁定済みへ更新する必要がある。

### 3.6 後回し／非ブロッカー

- コード署名とウイルス誤検知対策
- Dependabot version updates の自動 PR
- 紹介動画とブログ
- 2026 年 10 月の SF6 更新追従
- Claude / GPT との接続

## 4. 公開までの残り順序

1. 設計卓が §3.1 の実ユーザー前提復元を反映する。
2. `M16-06-notation-followup` の目視確認状況を確定する。
3. A-0 を再走査し、公開前必須残件が 0 であることを確認する。
4. private staging の最終 snapshot 内容を確認する。
5. 開発者確認後に公開側を public へ変更する。
6. 同じ手番で ruleset、Private vulnerability reporting、Dependabot alerts を確認・有効化する。
7. SSH 署名付き RC タグを作り、release workflow と attestation を実走する。
8. RC の全検証が通った後だけ本番タグを作る。

## 5. 設計卓へ返す要点

- **公開前ブロッカーは、現時点で `restore-real-user-premise-before-public-release` の 1 件。**
- C.Viper / Dhalsim の未 seed 記述は古く、復元対象は運用規則 4 点である。
- `M16-06-notation-followup` の目視確認を公開ゲートに残すか、既実施として閉じるかを確定する。
- 完了済み・裁定済みなのに未着手表記の残る backlog 行を実測へ同期する。
- A-0 は上記が決着して再走査が 0 件になるまで完了にしない。

---

本報告には、公開 snapshot に載せない非公開開発リポジトリの commit SHA、ローカル作業パス、秘密鍵の保存場所を記載していない。
