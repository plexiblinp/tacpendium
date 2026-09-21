// moves の要確認コード(WarningCode)。バックエンド service/movewarning の WarningCode と同期する
// (CLAUDE.md §4 バックエンド列挙定数との同期)。技編集グリッド(画面18、§5.18)で
// 保存済みデータから再導出した要確認の強調表示に用いる単一情報源。
//
// 取込パイプライン(画面17・movesimport)を M14-02 で削除したため、取込プレビュー専用だった
// recovery_word と、M14-01 で moves から列ごと消えた unknown_combo_scaling_key / unknown_properties は
// いずれも再導出されず死蔵となったため除去した。再導出される live なコードは total_null / extra_throw のみ。
export const WARNING_CODE_VALUES = ["total_null", "extra_throw"] as const;

export type WarningCode = (typeof WARNING_CODE_VALUES)[number];

export const WARNING_LABEL_JA: Record<WarningCode, string> = {
  total_null: "total 未算出",
  extra_throw: "3 件目以降の投げ",
};
