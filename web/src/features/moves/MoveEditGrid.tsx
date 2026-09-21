import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { WARNING_LABEL_JA } from "@/constants/move-warning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { useGenerateRushVariant, useMoveDetail, useUpdateMove } from "./api";
import {
  isRushEligible,
  moveNeedsConfirmation,
  MOVE_CATEGORY_LABEL_JA,
  type Move,
  type UpdateMoveRequest,
} from "./types";

// 数値入力の文字列 → number|undefined 変換。空文字は undefined(未変更扱い)。
function parseNum(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function numStr(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

// raw_data(JSON)から notes(原文・表示のみ)と notes_tool(付記・編集可)を取り出す。
// 他のキー(command / condition_* / properties_extra / import_notes)は保持する(CHANGE-030)。
function parseRawData(raw: string | null | undefined): {
  notes: string;
  notesTool: string;
  obj: Record<string, unknown>;
} {
  if (!raw) return { notes: "", notesTool: "", obj: {} };
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return {
      notes: typeof obj.notes === "string" ? obj.notes : "",
      notesTool: typeof obj.notes_tool === "string" ? obj.notes_tool : "",
      obj,
    };
  } catch {
    return { notes: "", notesTool: "", obj: {} };
  }
}

interface MoveEditRowProps {
  move: Move;
  characterId: number;
  // この技のラッシュ版(rush_<code>)が既に同キャラ一覧に存在するか。存在時はラッシュ版ボタンを
  // 事前に非活性化する(M9-04、§4.2。後段の 409 経路は保険として残す)。
  rushVariantExists: boolean;
}

// MoveEditRow は 1 技の編集行。インライン編集・is_aerial トグル・ラッシュ版生成・notes 付記編集を担う。
function MoveEditRow({ move, characterId, rushVariantExists }: MoveEditRowProps) {
  const updateMut = useUpdateMove(characterId);
  const rushMut = useGenerateRushVariant(characterId);

  const [total, setTotal] = useState(numStr(move.total));
  const [startup, setStartup] = useState(numStr(move.startup));
  const [active, setActive] = useState(numStr(move.active));
  const [onHit, setOnHit] = useState(numStr(move.onHit));
  const [onBlock, setOnBlock] = useState(numStr(move.onBlock));
  const [recovery, setRecovery] = useState(numStr(move.recovery));
  const [isAerial, setIsAerial] = useState(move.isAerial);

  const [expanded, setExpanded] = useState(false);
  const detail = useMoveDetail(expanded ? move.id : null);
  const [notesTool, setNotesTool] = useState<string | null>(null);

  const needsConfirm = moveNeedsConfirmation(move);
  const rushEligible = isRushEligible({ category: move.category, isAerial });
  // is_aerial をトグルしたが未保存の状態では、サーバは永続値で判定するためラッシュ生成は
  // デシンク(400)になり得る。未保存トグル中はラッシュ版ボタンを無効化し保存を促す(レビュー #2)。
  const isAerialDirty = isAerial !== move.isAerial;

  // 詳細セクションを開いたタイミングで取得済みなら初期値を流し込む。
  const parsedRaw = parseRawData(detail.data?.rawData);
  const notesToolValue = notesTool ?? parsedRaw.notesTool;

  const buildUpdate = (): UpdateMoveRequest => {
    const upd: UpdateMoveRequest = {};
    const t = parseNum(total);
    if (t !== undefined && t !== move.total) upd.total = t;
    const s = parseNum(startup);
    if (s !== undefined && s !== move.startup) upd.startup = s;
    const a = parseNum(active);
    if (a !== undefined && a !== move.active) upd.active = a;
    const oh = parseNum(onHit);
    if (oh !== undefined && oh !== move.onHit) upd.onHit = oh;
    const ob = parseNum(onBlock);
    if (ob !== undefined && ob !== move.onBlock) upd.onBlock = ob;
    const rec = parseNum(recovery);
    if (rec !== undefined && rec !== move.recovery) upd.recovery = rec;
    if (isAerial !== move.isAerial) upd.isAerial = isAerial;
    if (expanded && detail.data) {
      if (notesTool !== null && notesTool !== parsedRaw.notesTool) {
        const obj = { ...parsedRaw.obj };
        if (notesTool.trim() === "") delete obj.notes_tool;
        else obj.notes_tool = notesTool;
        upd.rawData = JSON.stringify(obj);
      }
    }
    return upd;
  };

  const handleSave = () => {
    const input = buildUpdate();
    if (Object.keys(input).length === 0) {
      toast.info("変更がありません。");
      return;
    }
    updateMut.mutate(
      { id: move.id, input },
      {
        onSuccess: () => toast.success(`${move.code} を保存しました。`),
        onError: (e) => toast.error(`保存に失敗しました: ${e.message}`),
      },
    );
  };

  const handleRush = () => {
    rushMut.mutate(
      { id: move.id },
      {
        onSuccess: (d) => toast.success(`ラッシュ版 ${d.code} を生成しました。`),
        onError: (e) => {
          // 409(既存)はハードエラーにせず「既に存在」を案内する(CHANGE-032)。
          if (e.message.includes("HTTP 409")) {
            toast.info("この技のラッシュ版は既に存在します。");
            return;
          }
          toast.error(`ラッシュ版生成に失敗しました: ${e.message}`);
        },
      },
    );
  };

  return (
    <>
      <TableRow
        data-needs-confirmation={needsConfirm}
        className={needsConfirm ? "bg-amber-50" : undefined}
      >
        <TableCell className="whitespace-nowrap font-mono text-xs">
          {move.code}
          {/* 要確認は warnings 全種を取込プレビュー(§5.17)と同じラベルで強調する(M9-04、§4.1)。 */}
          {(move.warnings ?? []).map((w) => (
            <Badge key={w} variant="secondary" className="ml-1">
              {WARNING_LABEL_JA[w]}
            </Badge>
          ))}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {MOVE_CATEGORY_LABEL_JA[move.category] ?? move.category}
        </TableCell>
        <TableCell className="whitespace-nowrap">{move.nameJa ?? "—"}</TableCell>
        <TableCell>
          <Input
            aria-label="全体"
            className="w-16"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label="発生"
            className="w-16"
            value={startup}
            onChange={(e) => setStartup(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label="持続"
            className="w-16"
            value={active}
            onChange={(e) => setActive(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label="ヒット"
            className="w-16"
            value={onHit}
            onChange={(e) => setOnHit(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label="ガード"
            className="w-16"
            value={onBlock}
            onChange={(e) => setOnBlock(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Input
            aria-label="硬直"
            className="w-16"
            value={recovery}
            onChange={(e) => setRecovery(e.target.value)}
          />
        </TableCell>
        <TableCell>
          <Switch
            aria-label="空中"
            checked={isAerial}
            onCheckedChange={setIsAerial}
          />
        </TableCell>
        <TableCell className="space-x-1 whitespace-nowrap">
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
            保存
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRush}
            disabled={
              !rushEligible || rushMut.isPending || isAerialDirty || rushVariantExists
            }
            title={
              rushVariantExists
                ? "この技のラッシュ版は既に生成済みです"
                : isAerialDirty
                  ? "空中設定を変更したら先に保存してください"
                  : rushEligible
                    ? "ラッシュ版を生成"
                    : "通常技・特殊技かつ非空中技のみ生成できます"
            }
          >
            ラッシュ版
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "閉じる" : "詳細"}
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={11} className="bg-muted/30">
            {detail.isLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm">
                  備考(付記)
                  <Textarea
                    aria-label="備考(付記)"
                    value={notesToolValue}
                    onChange={(e) => setNotesTool(e.target.value)}
                  />
                </label>
                {parsedRaw.notes && (
                  <div className="text-sm md:col-span-2">
                    <span className="text-muted-foreground">備考(原文・表示のみ):</span>
                    <p className="whitespace-pre-wrap">{parsedRaw.notes}</p>
                  </div>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

interface MoveEditGridProps {
  characterId: number;
  moves: Move[];
}

// 表示順並び替えのソート対象列(表示のみ。DB の並び・API は不変。M9-04、§4.3)。
type SortKey =
  | "code"
  | "category"
  | "nameJa"
  | "total"
  | "startup"
  | "active"
  | "onHit"
  | "onBlock"
  | "recovery"
  | "isAerial";

type SortState = { key: SortKey; dir: "asc" | "desc" };

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "code", label: "コード" },
  { key: "category", label: "分類" },
  { key: "nameJa", label: "表示名" },
  { key: "total", label: "全体" },
  { key: "startup", label: "発生" },
  { key: "active", label: "持続" },
  { key: "onHit", label: "ヒット" },
  { key: "onBlock", label: "ガード" },
  { key: "recovery", label: "硬直" },
  { key: "isAerial", label: "空中" },
];

// getSortValue はソート用の比較値を取り出す。null は常に末尾へ送る。
function getSortValue(m: Move, key: SortKey): string | number | null {
  switch (key) {
    case "code":
      return m.code;
    case "category":
      return MOVE_CATEGORY_LABEL_JA[m.category] ?? m.category;
    case "nameJa":
      return m.nameJa ?? null;
    case "recovery":
      return m.recovery ?? null;
    case "isAerial":
      return m.isAerial ? 1 : 0;
    case "total":
      return m.total ?? null;
    case "startup":
      return m.startup ?? null;
    case "active":
      return m.active ?? null;
    case "onHit":
      return m.onHit ?? null;
    case "onBlock":
      return m.onBlock ?? null;
  }
}

// compareBySort は sort 指定で 2 技を比較する。null は dir に依らず末尾。
function compareBySort(a: Move, b: Move, sort: SortState): number {
  const av = getSortValue(a, sort.key);
  const bv = getSortValue(b, sort.key);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  const cmp =
    typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "ja");
  return sort.dir === "asc" ? cmp : -cmp;
}

// MoveEditGrid は取込済み moves をキャラ単位で編集するグリッド(DES-005 §5.18、画面18)。
export function MoveEditGrid({ characterId, moves }: MoveEditGridProps) {
  // 表示順の並び替え(表示のみ)。null = 受領順(= DB の id 昇順)。API・保存は呼ばない(§4.3)。
  const [sort, setSort] = useState<SortState | null>(null);

  // ラッシュ版が既に存在する元技の id 集合(rush_variant 行の originalMoveId)。事前非活性に使う(§4.2)。
  const rushVariantOriginIds = useMemo(() => {
    const s = new Set<number>();
    for (const m of moves) {
      if (m.category === "rush_variant" && m.originalMoveId != null) {
        s.add(m.originalMoveId);
      }
    }
    return s;
  }, [moves]);

  const sortedMoves = useMemo(() => {
    if (!sort) return moves;
    return [...moves].sort((a, b) => compareBySort(a, b, sort));
  }, [moves, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  if (moves.length === 0) {
    return <p className="text-sm text-muted-foreground">技がありません。</p>;
  }
  return (
    <div className="space-y-2">
      {/* 並び替えクリア: sort 指定時のみ表示。null へ戻すと受領順(= DB id 昇順)に復帰する(表示のみ、§4.3)。 */}
      {sort && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSort(null)}
            className="gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            並び替えをクリア
          </Button>
        </div>
      )}
      {/* Table 内部の overflow-auto div(table.tsx)に高さ上限を注入し、その div を唯一の縦横
          スクロールコンテナにする。これにより sticky ヘッダがそのスクロール領域基準で固定される。
          見出し・キャラ選択はスクロールアウト許容のため、ビューポートをほぼ使い切る高さにして
          1 スクロールあたりの表示行数を増やす。 */}
      <div className="[&>div]:max-h-[calc(100vh-2rem)]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {SORT_COLUMNS.map((col) => (
                <TableHead key={col.key}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:underline"
                    aria-label={`${col.label} で並び替え`}
                  >
                    {col.label}
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
              ))}
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMoves.map((m) => (
              <MoveEditRow
                key={m.id}
                move={m}
                characterId={characterId}
                rushVariantExists={rushVariantOriginIds.has(m.id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
