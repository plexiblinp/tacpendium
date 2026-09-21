// 一覧・マイコンボの「選択→エクスポート」(M17-05b)における選択数上限。
// 比較対象選択の上限(MAX_COMPARE_COMBOS=5、比較表の可読性由来)とは意味が異なるため分離する。
// エクスポートは BE の既存上限 exportRowLimit(internal/service/comboio/export.go
// = csvcore.DefaultMaxRows。DES-002 §7.6 VAL-I03 と対称)に合わせる。
export const MAX_EXPORT_SELECTION = 1000;
