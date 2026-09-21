# M4-03 開発者 E2E 不具合 3 件 修正依頼

開発者の E2E テストで以下 3 件の不具合が発覚しました。M4-03 担当チャットで継続修正をお願いします。指示書側の修正は不要、すべて実装側で対応可能です。

**注**: 元の E2E 報告では指摘④に加えて指摘③(別コンボに紐付くセットプレイが消える)も含まれていましたが、開発者の再確認で **誤解の可能性が高い** ため本依頼から削除しました(2026-05-19)。何らかのレアケースで起きたバグの可能性もあるため、本依頼の修正後の E2E で開発者が注視して検証します。指摘番号は元の通り(① / ② / ④)で維持します。

---

## 指摘①: 「(セットプレイ機能は M4 で実装予定)」表示が残っている

### 現象

セットプレイがないコンボの詳細画面に「(セットプレイ機能は M4 で実装予定)」のプレースホルダ文字列が表示される。

### 原因

M4-02 で setup 単体 UI + 紐付け操作 UI を実装した際に、プレースホルダ文字列の削除が漏れていた。M4-03 のスコープ外だが、M4-03 担当チャットで一括修正する判断。

### 修正方針

該当プレースホルダ文字列(「セットプレイ機能は M4 で実装予定」)を `web/src/` 配下から grep して **削除** してください。代わりに `useCombo` レスポンスの `combo.setups` が空配列(または undefined)のときに「紐付くセットプレイはありません」等の通常メッセージを表示する。

### 根拠

- M4-02 §4.10 ComboDetailPage 修正で setup 関連 UI が完成済み、プレースホルダは不要
- DES-005 §5.6 item 8 のセットプレイ一覧表示は M4-02 で完成済み

### 検証

- セットプレイ 0 件のコンボの詳細画面でプレースホルダ文字列が表示されない
- セットプレイ ≥ 1 件のコンボの詳細画面で setup 一覧が表示される(従来通り)

---

## 指摘②: 「このコンボにも紐付ける」後、転用可能なセットプレイ候補欄から消えない

### 現象

§5.6 item 9「転用可能なセットプレイ候補」の「このコンボにも紐付ける」ボタンを押下後、当該 setup が候補欄から **消えない**(画面リロードで消える)。

### 原因

`useCreateSetupLink` の `onSuccess` で **`['setupCandidates', comboId]` の queryKey を invalidate していない** ことが原因と推測。新規 queryKey の invalidate 漏れ。

### 修正方針

`useCreateSetupLink` の `onSuccess` で以下の queryKey を invalidate する処理を追加してください:

```typescript
onSuccess: (_data, variables) => {
  // 既存(M4-02 で実装済み):
  queryClient.invalidateQueries({ queryKey: ['combo', variables.comboId] });
  queryClient.invalidateQueries({ queryKey: ['setup', variables.setupId] });
  
  // M4-03 で追加(本件修正):
  queryClient.invalidateQueries({ queryKey: ['setupCandidates', variables.comboId] });
},
```

同様に `useDeleteSetupLink` の `onSuccess` でも `setupCandidates` を invalidate 対象に追加してください(紐付け解除時にも候補欄に復活させる必要があるため)。

### 根拠

- M4-03 指示書 v1.0.1 §4.7.2「紐付け成功時: TanStack Query キャッシュ無効化により候補一覧と紐付き setup 一覧が連動して更新される」
- M4-03 指示書 v1.0.1 §5.2 シナリオ C「紐付け追加成功 → 候補一覧から該当 setup が消える」

### 検証

- M4-03 §5.2 シナリオ C を再実行: 「このコンボにも紐付ける」ボタンクリック → 候補欄から該当 setup が **即座に消える**(画面リロード不要)
- M4-03 §5.2 シナリオ D を再実行(回帰確認): 紐付け解除 → 候補欄に該当 setup が **復活する**(再度紐付け可能になる)

---


## 指摘④: トースト通知(topMessage 流用)が表示されない

### 現象

§4.10.2 規定の「(a) 保存方式 + knockdown_advantage 変わらない + 紐付き setup ≥ 1 件」の状態で保存しても、画面のどこにも「紐づくセットプレイ N 件を引き継ぎました。必要に応じて内容を確認してください」が表示されない。

### 原因の推測

(a) (a) 保存方式の検出ロジックが実装されていない、または
(b) topMessage 発火処理が実装されていない、または
(c) (a) 保存方式の判定条件と topMessage 発火の連動が組まれていない

### 修正方針

ComboEditorPage(または相当)の保存成功ハンドラに、以下の条件分岐を追加してください:

```typescript
const handleSaveSuccess = (response: ComboResponse) => {
  // (a) 保存方式の検出: M2-02 編集 2 方式分離の判定ロジックを再利用
  // - レシピ・始動技・position・opponent_stance・hit_type・opponent_size のいずれか変更で (a)
  const isReplaceMode = /* M2-02 で確立された判定ロジックを再利用 */;
  
  // knockdown_advantage 変更検知
  const knockdownAdvantageChanged = originalCombo.knockdownAdvantage !== editedKnockdownAdvantage;
  
  // 紐付き setup 数(保存前の linkedSetups から取得)
  const linkedSetupsCount = (originalCombo.setups ?? []).length;
  
  // (a) 保存方式 + knockdown_advantage 変わらない + 紐付き setup ≥ 1 件 のみで topMessage 表示
  if (isReplaceMode && !knockdownAdvantageChanged && linkedSetupsCount > 0) {
    setTopMessage(`紐づくセットプレイ ${linkedSetupsCount} 件を引き継ぎました。必要に応じて内容を確認してください`);
  }
};
```

### 根拠

- M4-03 指示書 v1.0.1 §4.10.2「保存成功直後に『紐づくセットプレイ N 件を引き継ぎました。必要に応じて内容を確認してください』を topMessage として表示」
- M4-03 指示書 v1.0.1 §4.10.2「N は引き継がれたセットプレイ数(レスポンスから取得、または保存前の `linkedSetups.length` を流用)」
- M4-03 指示書 v1.0.1 §5.2 シナリオ H ステップ 3

### 検証

- M4-03 §5.2 シナリオ H を再実行:
  - (a) 保存方式 + 紐付き setup ≥ 1 件 + knockdown_advantage 変わらない場合: topMessage 表示
  - (b) 保存方式 + knockdown_advantage 変わらない場合: topMessage 非表示
  - knockdown_advantage 変更時(モーダル経由): topMessage 非表示(モーダル動作のみ)
  - 紐付き setup 0 件の場合: topMessage 非表示

---

## まとめ

| 指摘 | 修正範囲 | 優先度 |
|------|---------|-------|
| ① プレースホルダ表示 | 該当文字列削除 | 低 |
| ② キャッシュ無効化漏れ | onSuccess に setupCandidates invalidate 追加 | 中 |
| ④ topMessage 非表示 | 保存成功時の topMessage 発火実装 | 中 |

すべて修正完了後、M4-03 §5.2 シナリオ A〜I を E2E で再実行してください。

修正完了後、再度開発者の E2E テストを実施 → 問題なければ M4-03 完了承認、続いて M4-04 起票に進みます。なお、元の E2E 報告で挙がっていた指摘③(別コンボに紐付くセットプレイが消える、現在は誤解の可能性で本依頼から削除)について、開発者が修正後の E2E で再現可能か注視します。再現した場合は別途修正依頼として連絡が来ます。

---

## 設計担当からの補足(運用知見の共有)

本件 3 件のうち ②④ は、設計担当(私)の指示書 v1.0.0〜v1.0.1 で **以下の点が明示不足だった** ことが間接的な原因として関与している可能性があります。retrospective-log v1.0.11 §5.3 に運用知見として記録しました:

- **指摘②④の原因(設計担当の指示書曖昧さ)**: 新規 queryKey `['setupCandidates', comboId]` を追加するマイルストーンで、**既存 mutation の onSuccess で当該 queryKey を invalidate 対象に含める必要があるか** を指示書 §x.y で明示すべきでした(retrospective-log v1.0.11 §5.3 教訓に追加済み)

ただし、指摘②④について **指示書 v1.0.1 §4.7.2 §4.10.2 で動作要件は明示している** ため、製造担当の実装側のバグとして整理しています(指示書 v1.0.x への遡及修正は不要)。

---

*以上*
