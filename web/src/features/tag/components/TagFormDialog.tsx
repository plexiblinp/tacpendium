import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Tag } from "@/types/tag";
import { useTagFormDialog, type TagFormSubmitValues } from "../hooks/useTagFormDialog";
import { TagColorPalette } from "./TagColorPalette";

interface Props {
  open: boolean;
  tag?: Tag | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TagFormSubmitValues) => Promise<void>;
}

export function TagFormDialog({ open, tag, onOpenChange, onSubmit }: Props) {
  const { t } = useTranslation();
  const isEdit = tag != null;
  const { form, handleSubmit } = useTagFormDialog(
    open,
    tag,
    onSubmit,
    () => onOpenChange(false),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("tag.form.editTitle") : t("tag.form.createTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("tag.form.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {form.formState.errors.root && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {form.formState.errors.root.message}
                </p>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("tag.form.name")} <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tag.form.category")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("tag.form.categoryPlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tag.form.color")}</FormLabel>
                    <TagColorPalette value={field.value} onChange={field.onChange} />
                    <p className="text-xs text-slate-400 mt-2">
                      {t("tag.form.colorHexHint")}
                    </p>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="color-input"
                          placeholder="#10B981"
                        />
                      </FormControl>
                      {field.value && /^#[0-9A-Fa-f]{6}$/.test(field.value) && (
                        <span
                          className="w-8 h-8 rounded border border-slate-200 flex-shrink-0"
                          style={{ backgroundColor: field.value }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 border-t mt-4 pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                {t("tag.form.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? t("tag.form.saving")
                  : isEdit
                    ? t("tag.form.save")
                    : t("tag.form.create")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
