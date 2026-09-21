import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoMarkProps {
  /** test-id / aria 用の識別子（例: "modifier" → data-testid="info-mark-modifier"） */
  topic: string;
  /** 表示する説明文（呼び出し側で i18n 解決済みの文字列を渡す） */
  text: string;
  /** トリガの aria-label（省略時は「説明を表示」） */
  ariaLabel?: string;
  /** トリガボタンに付与する追加クラス */
  className?: string;
}

/**
 * InfoMark は項目の横に置く ⓘ アイコンで、クリック/タップで説明文を表示する
 * 再利用可能なヘルプ機構。表示専用で、押下しても既存操作に副作用を与えない
 * （type="button" によりフォーム送信を起こさない）。モバイル/LAN 利用を想定し、
 * ホバー限定でなくクリック/タップで開く Popover を用いる。
 */
export function InfoMark({ topic, text, ariaLabel, className }: InfoMarkProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`info-mark-${topic}`}
          aria-label={ariaLabel ?? "説明を表示"}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-slate-400 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            className,
          )}
        >
          <Info size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <p
          data-testid={`info-mark-${topic}-content`}
          className="text-sm text-slate-700"
        >
          {text}
        </p>
      </PopoverContent>
    </Popover>
  );
}
