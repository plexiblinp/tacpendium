import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";

import { useCombo } from "@/features/combo/api";
import { ComboEditor } from "@/features/combo/components/ComboEditor";

export function ComboEditorPage() {
  const { t } = useTranslation();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const idStr = params.id;
  const id = idStr ? Number(idStr) : null;
  const isEditMode = id != null && Number.isFinite(id) && id > 0;

  const copyFromId = searchParams.get("copyFrom");
  const isCopyMode = !isEditMode && copyFromId != null;

  const mode: "new" | "edit" | "copy" = isEditMode
    ? "edit"
    : isCopyMode
      ? "copy"
      : "new";

  // 新規モードの文脈キャラ(M10-02)。一覧などから ?character= で伝播される。
  // これは既定キャラ解決の段 1(M24-01 §4.1-2)にあたる。正の整数のみ採用し、無効値は
  // 無視する(ComboEditor 側が段 2 以降へ落とす)。
  // 編集/コピーは initial.characterId が優先のため new モードのみ渡す。
  const characterParam = searchParams.get("character");
  const parsedCharacterId =
    characterParam != null ? Number(characterParam) : NaN;
  const initialCharacterId =
    mode === "new" &&
    Number.isFinite(parsedCharacterId) &&
    parsedCharacterId > 0
      ? parsedCharacterId
      : undefined;

  const comboQ = useCombo(isEditMode ? id : null);
  const copyFromQ = useCombo(isCopyMode ? copyFromId : null);

  const activeQ = isEditMode ? comboQ : isCopyMode ? copyFromQ : null;

  if (activeQ?.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">
          {mode === "edit" ? t("comboEditor.titleEdit") : t("comboEditor.titleNew")}
        </h1>
        <p className="text-sm text-gray-500">{t("comboEditor.loading")}</p>
      </main>
    );
  }

  if (activeQ?.isError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">
          {mode === "edit" ? t("comboEditor.titleEdit") : t("comboEditor.titleNew")}
        </h1>
        <p className="text-sm text-red-600">
          {t("comboEditor.loadError", { message: activeQ.error.message })}
        </p>
      </main>
    );
  }

  const title =
    mode === "edit"
      ? t("comboEditor.titleEdit")
      : mode === "copy"
        ? t("comboEditor.titleCopy", { id: copyFromId })
        : t("comboEditor.titleNew");

  const initial =
    mode === "edit"
      ? comboQ.data
      : mode === "copy"
        ? copyFromQ.data
        : undefined;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <ComboEditor
        mode={mode}
        initial={initial}
        initialCharacterId={initialCharacterId}
      />
    </main>
  );
}
