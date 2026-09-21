import { useTranslation } from "react-i18next";

import { ControllerButton } from "./ControllerButton";

// 削除ボタンの行(旧 SystemRow)。
//
// ★★M30-01 追補(2026-09-08 開発者指示): 共通技グループを**共通技タブへ移設**したため、
//   この行に残るのは削除だけになった。⇒ 部品名も `SystemRow` から改めてある
//   (「共通技の行」という名前のまま削除だけを持つと、次の担当が読み違える)。
// ★削除はタブへ入れない。どのタブに居ても直前のステップを消せる必要があるためであり、
//   移設の対象は「共通技」だけである(開発者の逐語＝「下部の共通技は移動に伴い削除」)。
interface Props {
  onDelete: () => void;
}

export function DeleteRow({ onDelete }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex items-stretch justify-end">
      <ControllerButton
        label={t("controller.system.delete.label")}
        aria={t("controller.system.delete.aria")}
        size="system"
        variant="danger"
        onClick={onDelete}
        testId="recipe-system-delete"
      />
    </div>
  );
}
