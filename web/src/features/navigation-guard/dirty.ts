// M24-04(CO-003): 「保存していない変更があるか」の判定。
//
// ★★判定は「初期値と現在値の比較」で行う(指示書 §4.1)。
//   「欄に触ったら dirty」にはしない——フォーカスしただけで確認が出ると、
//   機能そのものが邪魔になる。
//
// ★★空文字・null・undefined は「未設定」として同一視する。
//   入力欄は未入力を "" で持ち、API から読んだ値は null で来るため、
//   同一視しないと編集画面が開いた瞬間に dirty になる。
//   ★ただし 0 と false は値である。未設定に丸めないこと。

/** 比較用に値を正規化する。未設定(空文字・null・undefined)はすべて null になる。 */
export function normalizeForDirtyCheck(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value.map(normalizeForDirtyCheck);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const normalized = normalizeForDirtyCheck(
        (value as Record<string, unknown>)[key],
      );
      // 未設定のキーは落とす。「キーが無い」と「空文字が入っている」を同じに扱うため。
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return value;
}

/**
 * 比較用のキー文字列を作る。キーが等しければ「変更なし」。
 * ★オブジェクトのキーは正規化の中で並べ替えてあるので、
 *   同じ内容が違う順で入っていても同じキーになる。
 */
export function dirtyKey(snapshot: unknown): string {
  return JSON.stringify(normalizeForDirtyCheck(snapshot));
}

/** 初期値と現在値を比べ、変更があれば true。 */
export function isChangedFromInitial(
  initial: unknown,
  current: unknown,
): boolean {
  return dirtyKey(initial) !== dirtyKey(current);
}
