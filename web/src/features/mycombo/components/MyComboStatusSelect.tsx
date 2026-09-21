import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MYCOMBO_STATUS_VALUES,
  MYCOMBO_STATUS_LABELS,
  MYCOMBO_STATUS_REMOVE_LABEL,
  type MyComboStatus,
} from "@/constants/mycombo";

interface MyComboStatusSelectProps {
  currentStatus: MyComboStatus | "";
  onChange: (newStatus: MyComboStatus | "") => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export default function MyComboStatusSelect({
  currentStatus,
  onChange,
  disabled,
  isLoading,
}: MyComboStatusSelectProps) {
  return (
    <Select
      value={currentStatus || "__remove__"}
      onValueChange={(v) => onChange(v === "__remove__" ? "" : v as MyComboStatus)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-auto min-w-[120px] h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MYCOMBO_STATUS_VALUES.map((s) => (
          <SelectItem key={s} value={s}>
            {MYCOMBO_STATUS_LABELS[s]}
          </SelectItem>
        ))}
        <SelectItem value="__remove__">{MYCOMBO_STATUS_REMOVE_LABEL}</SelectItem>
      </SelectContent>
    </Select>
  );
}
