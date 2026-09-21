import { AlertCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ValidationResult } from "../types";

interface Props {
  result?: ValidationResult | null;
  /**
   * M24-04(SM-148): issue の `field` を画面の呼び名へ写す関数(任意)。
   * ★渡さなければ従来どおり field をそのまま出す。
   * ★★`field` はデータとしては生のフィールド名のまま持つ——タブの振り分け
   *   (editorTabs.ts)が同じ値を見るため、表示のために書き換えると照合できなくなる。
   *   ⇒ 翻訳は表示のここで行う(語彙を 2 つ持たない)。
   */
  fieldLabel?: (field: string) => string;
}

export function ValidationDisplay({ result, fieldLabel }: Props) {
  const labelOf = fieldLabel ?? ((field: string) => field);
  if (!result || result.issues.length === 0) {
    return null;
  }
  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-3">
            <ul className="space-y-1 text-sm text-red-800">
              {errors.map((e, idx) => (
                <li key={`err-${idx}`} className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    <Badge variant="destructive" className="mr-1 text-xs font-mono">{e.code}</Badge>
                    {e.field ? <span className="font-semibold">{labelOf(e.field)}: </span> : null}
                    {e.message}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {warnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-3">
            <ul className="space-y-1 text-sm text-yellow-800">
              {warnings.map((w, idx) => (
                <li key={`warn-${idx}`} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
                  <span>
                    <Badge variant="secondary" className="mr-1 text-xs font-mono bg-yellow-200 text-yellow-800">{w.code}</Badge>
                    {w.field ? <span className="font-semibold">{labelOf(w.field)}: </span> : null}
                    {w.message}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
