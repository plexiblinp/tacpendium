import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Preset } from "../types";

/**
 * defaultCopyName はコピー時の既定名。
 *
 * 「<ベース名> のコピー」とする(指示書 §9.2-4 の推測で進めてよい事項)。
 * ★同名は VAL-P03 で弾かれるため、2 つ目のコピーでは利用者が名前を変える必要がある。
 * 既定値を機械的に連番化しないのは、名前は利用者が付けるものであり
 * 「コピー 2」のような機械名を既定にすると、そのまま残りやすいためである。
 */
export function defaultCopyName(base: Preset | null): string {
  if (!base) return "";
  return `${base.name} のコピー`;
}

interface Props {
  open: boolean;
  base: Preset | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isSubmitting?: boolean;
  errorMessage?: string;
}

export default function PresetCopyDialog({
  open,
  base,
  onOpenChange,
  onSubmit,
  isSubmitting,
  errorMessage,
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(defaultCopyName(base));
  }, [open, base]);

  const trimmed = name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>カスタムプリセットを作成</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium">{base?.name ?? ""}</span>
            {" "}をコピーして、自分用のプリセットを作ります。
            エイリアスはすべてコピーされ、作成後に自由に編集できます。
          </p>

          <div>
            <label
              htmlFor="preset-copy-name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              プリセット名
            </label>
            <input
              id="preset-copy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              data-testid="preset-copy-name-input"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600" data-testid="preset-copy-error">
              {errorMessage}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onSubmit(trimmed)}
            disabled={trimmed === "" || isSubmitting}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="preset-copy-submit"
          >
            作成
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
