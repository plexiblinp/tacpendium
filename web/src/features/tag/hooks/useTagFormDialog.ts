import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TagApiError } from "@/features/tag/api/tagApi";
import { DEFAULT_TAG_COLOR } from "@/features/tag/constants/tagColorPalette";
import type { CreateTagInput, Tag } from "@/types/tag";

/** 文言の解決関数。i18next の `t` を受け取る想定(テストからは恒等関数を渡せる)。 */
type Translate = (key: string) => string;

// ★M24-07: 検証メッセージを locale へ出したためファクトリにした。
//   モジュール読込時に文言を焼くと、言語切替後も旧言語のメッセージが残る。
//   ⇒ 呼び手(フック)が `t` を渡して毎回組み立てる。
export function createTagFormSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(1, t("tag.form.nameRequired")),
    category: z.string().optional(),
    color: z.string().regex(/^(#[0-9A-Fa-f]{6}|)$/, t("tag.form.colorFormat")),
  });
}

type TagFormValues = z.infer<ReturnType<typeof createTagFormSchema>>;

// TagFormDialog の onSubmit に渡す送信ペイロード。TagFormValues(RHF/zod 管理下、color は
// 常に string)と異なり color は正規化後に undefined を取り得るため、既存 DTO 型を再利用する。
export type TagFormSubmitValues = CreateTagInput;

export function useTagFormDialog(
  open: boolean,
  tag: Tag | null | undefined,
  onSubmit: (values: TagFormSubmitValues) => Promise<void>,
  onClose: () => void,
) {
  const { t } = useTranslation();
  const schema = useMemo(() => createTagFormSchema(t), [t]);
  const form = useForm<TagFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", category: "", color: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: tag?.name ?? "",
        category: tag?.category ?? "",
        color: tag ? (tag.color ?? "") : DEFAULT_TAG_COLOR,
      });
    }
  }, [open, tag, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({
        name: values.name,
        category: values.category || undefined,
        color: values.color || undefined,
      });
      onClose();
    } catch (err) {
      if (err instanceof TagApiError) {
        if (err.code === "tag_name_duplicate") {
          form.setError("name", { message: t("tag.form.duplicateName") });
        } else {
          form.setError("root", {
            message: err.body?.error.message ?? t("tag.form.genericError"),
          });
        }
      } else {
        form.setError("root", { message: t("tag.form.unexpectedError") });
      }
    }
  });

  return { form, handleSubmit };
}
