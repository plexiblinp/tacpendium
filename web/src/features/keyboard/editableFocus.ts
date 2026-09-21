// 「編集可能な要素にフォーカスがあるか」の判定（M21-05 §4.4／チェックリスト重大 6・7）。
//
// ★**要素の種類を列挙して分岐しない**（§4.4-2）。`tagName === "INPUT"` のような列挙は必ず
//   取りこぼす——`<textarea>` / `contenteditable` / `type` の増える `<input>` / 将来の
//   カスタム要素のどれかが漏れる。**漏れた 1 種類の上で、文字を打つたびにステップが入る。**
//
// ★これを落とすと何が起きるか。レシピ入力面はコンボのメモ欄・ステップメモ・セットプレイ名と
//   同居している（実査で確認済み＝入力面を持つ全画面が最低 1 つの自由入力欄を持つ）。
//   ⇒ **文字を打つたびにステップが入り、しかも文字は正しく入る。** 動作を見ても原因が分からず、
//   利用者は「勝手にステップが増える」としか言えない。
//
// ★判定は**性質**で行う。次の 2 つの **OR** であり、どちらが真でも「編集可能」とみなす。
//   - `isContentEditable` ＝ `contenteditable` を持つ要素。**安価なプロパティ参照**であるため
//     先に見る（`matches` の呼び出しを省ける）。
//   - `:read-write` ＝ CSS Selectors Level 4 の「利用者が編集できる要素」擬似クラス。
//     `readonly` / `disabled` は自動的に外れ、チェックボックスやボタンには当たらない。
//     **要素の種類ではなく「編集できるか」そのものを問う**ため、種類が増えても追随する。
//
// ★**判定の主役は `:read-write` である。** jsdom（nwsapi）がこれを解釈することは着手時に
//   実測で確認した（2026-08-14）——text / number / textarea / contenteditable = 真、
//   readonly / disabled / checkbox / button / ただの div = 偽。
//   **一方 jsdom は `isContentEditable` を実装していない**（`undefined` を返す）。
//   ⇒ **`isContentEditable` だけに頼る形は採れない**（テストは通るのに本番でしか効かない
//     ガードになる）。**先に見るのは安さのためであって、こちらが主役だからではない。**
//   ★OR であるため評価順は結果を変えない。順序を入れ替えても挙動は同じである。

/**
 * いま編集可能な要素にフォーカスがあるか。
 *
 * @param root 判定に使う Document。省略時は `document`。
 *
 * ★`activeElement` が無い／取得できない場合は **false**（＝入力を通す）を返す。フォーカスが
 *   どこにも無い状態は「文字を打っている最中」ではないためである。
 */
export function isEditableElementFocused(root?: Document): boolean {
  const doc = root ?? (typeof document === "undefined" ? null : document);
  if (doc === null) return false;

  const active = doc.activeElement;
  if (active === null || active === undefined) return false;

  // ★安価なプロパティ参照を先に見るだけであり、これが主役ではない
  //   （jsdom では undefined になるため、単独では成立しない）。
  if ((active as HTMLElement).isContentEditable === true) return true;

  // ★`matches` は未知の擬似クラスで例外を投げうる。投げた場合に入力を止めてしまうと
  //   キーボード入力が恒久的に効かなくなるため、例外は「編集可能ではない」に倒す。
  try {
    return active.matches(":read-write");
  } catch {
    return false;
  }
}
