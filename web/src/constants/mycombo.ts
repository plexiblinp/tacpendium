export const TAG_CATEGORY_MYCOMBO_STATUS = "mycombo_status";

export const MYCOMBO_STATUS_VALUES = ["in_use", "practicing", "reduced"] as const;
export type MyComboStatus = (typeof MYCOMBO_STATUS_VALUES)[number];

export const MYCOMBO_STATUS_IN_USE = "in_use" satisfies MyComboStatus;
export const MYCOMBO_STATUS_PRACTICING = "practicing" satisfies MyComboStatus;
export const MYCOMBO_STATUS_REDUCED = "reduced" satisfies MyComboStatus;
export const DEFAULT_MYCOMBO_STATUS = MYCOMBO_STATUS_IN_USE;

export const MYCOMBO_STATUS_LABELS: Record<MyComboStatus, string> = {
  in_use: "使用中",
  practicing: "練習中",
  reduced: "頻度低下",
};

/**
 * 「マイコンボから外す」＝状態なしを選ぶときの呼び名。
 *
 * ★M24-12(レビュー 中-7): エディタのボタン群と `MyComboStatusSelect` の両方が使う。
 *   画面側へ生リテラルを書かないための正典である。
 * ★★「状態なし」を表す**値**は 2 つの流儀が並存している——`MyComboStatusSelect` は
 *   `"__remove__"`（Radix Select が空文字を値にできないため）、エディタのボタン群は
 *   `""`（そのまま状態なしを意味する）。**ラベルだけは共有し、値は各面の都合のまま
 *   にしてある。** 統一するなら Select 側の制約から設計し直す必要があり、本サブの
 *   射程を超えるため申し送りとした。
 */
export const MYCOMBO_STATUS_REMOVE_LABEL = "マイコンボから外す";

export const MYCOMBO_STATUS_TAG_NAMES: Record<MyComboStatus, string> = {
  in_use: "使用中",
  practicing: "練習中",
  reduced: "頻度低下",
};
