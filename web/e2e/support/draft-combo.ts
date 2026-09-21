/**
 * ★★M24-13(CHANGE-139): 仮登録でもレシピのステップ 1 本以上が要る。
 *
 * それまで多くの spec が「仮登録ならレシピ無しで作れる」ことを使って fixture を
 * 作っていた。★足りないのはレシピだけであり、各 spec が見ているものは変わらない。
 * ⇒ 共通の下ごしらえをここへ寄せる(D-553)。
 */

/**
 * minimalDraftSteps は「1 本だけの最小レシピ」を返す。
 *
 * ★★技を指定しない「非技ステップ」である(DES-004 §2.2 の正規表現)。
 *   ⇒ move の解決が要らず、どのキャラでもそのまま使える。
 *
 * ★★これを選んだ理由は「新しい警告を足さないこと」である———————————————
 *   - VAL-C03(始動技とレシピ 1 手目の一致)は starter_move_id が NULL ならスキップ
 *     される。技を持たないステップ 1 本だけのレシピでは始動技が決まらないため、
 *     VAL-C03 は発火しない。
 *   - VAL-C08(技の存在確認)は move_id が NULL のステップを飛ばす(VAL-D02)。
 *   - VAL-C12(ラッシュ版の元技)も move_id を要求する。
 *   ⇒ 実在の技を足す形と違い、fixture へ警告が 1 件も増えない。警告の件数を見て
 *     いる spec を巻き込まない。
 *
 * ★毎回新しい配列を返す。使い回すと、呼び出し側が stepOrder を書き換えたときに
 *   他の fixture へ漏れる。
 */
export function minimalDraftSteps(): Array<{
  stepOrder: number;
  modifiers: { type: string };
}> {
  return [{ stepOrder: 1, modifiers: { type: "parry_drive_rush" } }];
}
