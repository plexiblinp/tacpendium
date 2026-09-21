---
paths:
  - "internal/model/*.go"
  - "web/src/**/*.{ts,tsx}"
---

# 列挙定数の同期（バックエンド ⇄ フロントエンド）

バックエンドとフロントの**両側にまたがる規則**のため、path-scoped rule として両方の階層へ届くようにしている（`web/CLAUDE.md` に置くと、`internal/model/` を編集する人に届かない）。

## 規則

1. **バックエンド**: 列挙的文字列定数は `internal/model/` にパッケージ定数として定義する。リテラル文字列を複数箇所へ散在させない。
2. **フロントエンド**: 対応する定数を `web/src/constants/<domain>.ts` に定義して参照する。**画面側のコードに生リテラルを書かない。**
3. **新規列挙値を追加するときは両側を同時に更新する。** 片側だけの追加は、表記揺れ（typo）が実行時まで見つからない形の欠陥になる。

## 定義形式は 2 種類ある（検索時の注意）

`internal/model/` の列挙定数には次の 2 形式が混在している。片方だけを grep すると取りこぼす。

```go
// (a) const ブロック内
const (
    HitTypeNormal = "normal"
    HitTypeCounter = "counter"
)

// (b) 単独 const 宣言
const TagCategoryMyComboStatus = "mycombo_status"
```

> 2026-08-10 まで `CLAUDE.md` §4 に載っていた確認用 grep は `model\.[A-Z]...` というパターンで、**0 件ヒットの壊れた状態だった**（定義側に `model.` 接頭辞は付かない）。手順を散文で持たせると壊れても気づけないため、実際の抽出は下記スクリプトに持たせてある。

## 検査

```bash
bash scripts/check-enum-sync.sh          # warning（常に exit 0）
bash scripts/check-enum-sync.sh --list   # 定数・値・constants/ 有無・散在ファイル数の一覧
bash scripts/check-enum-sync.sh --strict # ベースライン超過があれば exit 1
```

**既定を warning にしている理由**: 散在検査は現在 26 件当たるが、その多くは `normal` / `system` / `throw` / `block` / `special` / `unique` のような汎用英単語による誤検出である（CSS 値・i18n キー・無関係な比較にも一致する）。誤検出率を測る前に blocking へ昇格させない（改善計画 Stage 4「当初 warning にする検査」）。

**見るべきは件数ではなくベースラインからの増加**。増えていたら、新しく足した列挙値が `web/src/constants/` を経由していない可能性がある。

## 関連

- 指示書執筆時の運用ルール: `design-instruction-playbook.md` §4.8
- 横断パターン: `docs/handover/architecture-patterns.md` §4
