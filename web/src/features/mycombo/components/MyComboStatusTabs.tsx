import { cn } from "@/lib/utils";
import {
  MYCOMBO_STATUS_VALUES,
  MYCOMBO_STATUS_IN_USE,
  MYCOMBO_STATUS_PRACTICING,
  MYCOMBO_STATUS_REDUCED,
  MYCOMBO_STATUS_LABELS,
  type MyComboStatus,
} from "@/constants/mycombo";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MyComboStatusCounts } from "../hooks/useMyComboStatusCounts";

interface MyComboStatusTabsProps {
  selected: MyComboStatus;
  onSelect: (status: MyComboStatus) => void;
  counts: MyComboStatusCounts;
}

const STATUS_TO_COUNT_KEY: Record<MyComboStatus, keyof MyComboStatusCounts> = {
  [MYCOMBO_STATUS_IN_USE]: "inUse",
  [MYCOMBO_STATUS_PRACTICING]: "practicing",
  [MYCOMBO_STATUS_REDUCED]: "reduced",
};

const TAB_STYLES: Record<MyComboStatus, string> = {
  [MYCOMBO_STATUS_IN_USE]:
    "data-[state=active]:text-emerald-700 data-[state=active]:bg-emerald-50 data-[state=active]:border-emerald-600 text-emerald-500 hover:bg-emerald-50",
  [MYCOMBO_STATUS_PRACTICING]:
    "data-[state=active]:text-blue-700 data-[state=active]:bg-blue-50 data-[state=active]:border-blue-600 text-blue-500 hover:bg-blue-50",
  [MYCOMBO_STATUS_REDUCED]:
    "data-[state=active]:text-slate-700 data-[state=active]:bg-slate-100 data-[state=active]:border-slate-600 text-slate-400 hover:bg-slate-50",
};

export default function MyComboStatusTabs({
  selected,
  onSelect,
  counts,
}: MyComboStatusTabsProps) {
  return (
    <Tabs
      value={selected}
      onValueChange={(v) => onSelect(v as MyComboStatus)}
      className="mb-4"
    >
      <TabsList className="flex w-full rounded-none border-b border-slate-200 bg-transparent p-0 h-auto">
        {MYCOMBO_STATUS_VALUES.map((status) => {
          const count = counts[STATUS_TO_COUNT_KEY[status]];
          return (
            <TabsTrigger
              key={status}
              value={status}
              className={cn(
                "flex-1 rounded-none border-b-2 border-transparent px-4 py-3 font-semibold shadow-none",
                TAB_STYLES[status],
              )}
            >
              {MYCOMBO_STATUS_LABELS[status]}{" "}
              <span className="text-xs ml-1">({count})</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
