import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import Header from "@/components/Header";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { useConfig } from "@/features/config/useConfig";
import {
  useInvalidateRecipeCacheConsumers,
  usePresetAliases,
  usePresets,
  useRebuildRecipeCache,
  useUpdatePreset,
} from "@/features/preset/api";
import PresetAliasEditor from "@/features/preset/components/PresetAliasEditor";
import { presetErrorMessage } from "@/features/preset/errorMessage";

/**
 * collectDirtyAliases は「値が実際に変わった行」だけを抽出する。
 *
 * ★全件送らない。1 キャラ分でも最大 77 行あり、キャラを跨いで編集すると
 * 送信量が膨らむうえ、触っていない行まで UPDATE が走る。
 * 前後の空白は API 側でも落とすが、差分判定はここでも trim して行う
 * (空白だけの違いを「変更」と数えない)。
 */
export function collectDirtyAliases(
  edits: Record<number, string>,
  original: Map<number, string>,
): { moveId: number; aliasText: string }[] {
  const out: { moveId: number; aliasText: string }[] = [];
  for (const [key, value] of Object.entries(edits)) {
    const moveId = Number(key);
    const before = original.get(moveId);
    if (before === undefined) continue;
    if (value.trim() === before.trim()) continue;
    out.push({ moveId, aliasText: value });
  }
  return out;
}

/**
 * PresetEditPage はプリセット編集画面(DES-005 §5.11 / ルート /presets/:id/edit)。
 *
 * ★組み込みプリセットを開いた場合は読み取り専用で表示する。保護そのものは
 * サービス層が 403 で行っており(D-290)、ここは案内であって防御ではない。
 */
export default function PresetEditPage() {
  const { id } = useParams<{ id: string }>();
  const presetId = Number(id);
  const navigate = useNavigate();

  const presetsQuery = usePresets();
  const configQuery = useConfig();
  const updateMutation = useUpdatePreset();

  const preset = useMemo(
    () => presetsQuery.data?.find((p) => p.id === presetId),
    [presetsQuery.data, presetId],
  );
  const readOnly = preset?.isBuiltin ?? false;
  const rebuildCache = useRebuildRecipeCache();
  const invalidateRecipeConsumers = useInvalidateRecipeCacheConsumers();

  const [characterId, setCharacterId] = useState<number | undefined>();
  useEffect(() => {
    if (characterId === undefined && configQuery.data) {
      setCharacterId(configQuery.data.defaults.characterId);
    }
  }, [characterId, configQuery.data]);

  const aliasesQuery = usePresetAliases(presetId, characterId);

  const [name, setName] = useState("");
  useEffect(() => {
    if (preset) setName(preset.name);
  }, [preset]);

  // moveId → 編集中の値。★キャラを切り替えても保持する(キャラを跨いで
  // 編集してから 1 回で保存できるようにするため)。
  const [edits, setEdits] = useState<Record<number, string>>({});
  // moveId → 保存前の値。差分判定に使う。
  const [original, setOriginal] = useState<Map<number, string>>(new Map());

  // ★プリセットを跨いだら両方を捨てる。moveId はプリセット間で共通のため、
  // 持ち越すと別プリセットの値を baseline にして差分判定が狂う
  // (現行 UI は必ず一覧を経由するので該当遷移路は無いが、URL 直打ちで起こる)。
  useEffect(() => {
    setEdits({});
    setOriginal(new Map());
  }, [presetId]);
  useEffect(() => {
    if (!aliasesQuery.data) return;
    setOriginal((prev) => {
      const next = new Map(prev);
      for (const d of aliasesQuery.data) {
        if (!next.has(d.moveId)) next.set(d.moveId, d.aliasText);
      }
      return next;
    });
  }, [aliasesQuery.data]);

  const dirtyAliases = useMemo(
    () => collectDirtyAliases(edits, original),
    [edits, original],
  );
  const nameDirty = preset != null && name.trim() !== preset.name;
  const hasChanges = nameDirty || dirtyAliases.length > 0;

  const handleSave = () => {
    if (!preset) return;
    updateMutation.mutate(
      {
        id: preset.id,
        input: {
          ...(nameDirty ? { name: name.trim() } : {}),
          ...(dirtyAliases.length > 0 ? { aliases: dirtyAliases } : {}),
        },
      },
      {
        onSuccess: () => {
          // 保存できた分を「保存前の値」へ畳み、編集中の差分を消す。
          setOriginal((prev) => {
            const next = new Map(prev);
            for (const a of dirtyAliases) next.set(a.moveId, a.aliasText.trim());
            return next;
          });
          setEdits({});
          toast.success("プリセットを保存しました");
        },
        onError: (err) =>
          toast.error(presetErrorMessage(err, "プリセットの保存に失敗しました")),
      },
    );
  };

  if (presetsQuery.isLoading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <p className="p-6 text-sm text-slate-500">読み込み中...</p>
      </main>
    );
  }

  if (!preset) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header />
        <div className="mx-auto max-w-5xl px-4 py-6">
          <p className="text-sm text-red-600">プリセットが見つかりません。</p>
          <Link to="/presets" className="text-sm text-blue-600 underline">
            プリセット一覧へ戻る
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-800">プリセット編集</h1>
          <Link to="/presets" className="text-sm text-blue-600 underline">
            一覧へ戻る
          </Link>
        </div>

        {readOnly && (
          <p
            className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
            data-testid="preset-readonly-notice"
          >
            組み込みプリセットは編集できません。変更したい場合は一覧から
            「コピー」でカスタムプリセットを作ってください。
          </p>
        )}

        {/* ★★M24-08 第 2 部 B: このプリセット 1 枚分の recipe_cache を作り直す。
            ★readOnly では抑止しない —— 組み込みこそこのボタンが要る。
              組み込みは PUT が 403 のため、エイリアス更新経由の再計算に乗せられず、
              ここを塞ぐと作り直す手段が無くなる(地上ダッシュの是正が配布後に直らない)。
            ★全プリセットをまとめて直したいときは 設定 → データ管理 のボタンを使う。 */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              rebuildCache.mutate(preset.id, {
                onSuccess: () => {
                  invalidateRecipeConsumers();
                  toast.success("このプリセットのレシピキャッシュを再構築しました");
                },
                onError: () =>
                  toast.error("レシピキャッシュの再構築に失敗しました"),
              });
            }}
            disabled={rebuildCache.isPending}
            data-testid="preset-cache-rebuild"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {rebuildCache.isPending
              ? "再構築中…"
              : "レシピキャッシュを再構築"}
          </button>
          <span className="text-xs text-slate-500">
            表記を直した後、レシピの表示が古いままのときに使います。
          </span>
        </div>

        <div className="mb-6 space-y-3 rounded border border-slate-200 bg-white p-4">
          <div>
            <label
              htmlFor="preset-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              プリセット名
            </label>
            <input
              id="preset-name"
              type="text"
              value={name}
              readOnly={readOnly}
              disabled={readOnly}
              onChange={(e) => setName(e.target.value)}
              data-testid="preset-name-input"
              className="w-full max-w-md rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              ベースプリセット
            </span>
            <span className="text-sm text-slate-500" data-testid="preset-base-code">
              {preset.basePresetCode ?? "—"}
            </span>
            <p className="mt-1 text-xs text-slate-400">
              ベースプリセット・連結子・未定義時のフォールバック挙動・技の追加削除は変更できません。
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              キャラクター
            </span>
            <CharacterSelector
              selectedCharacterId={characterId ?? null}
              onChange={setCharacterId}
              ariaLabel="編集するキャラクター"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-blue-700" data-testid="preset-dirty-count">
                未保存の変更 {dirtyAliases.length + (nameDirty ? 1 : 0)} 件
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate("/presets")}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={readOnly || !hasChanges || updateMutation.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              data-testid="preset-save"
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        {aliasesQuery.isLoading && (
          <p className="text-sm text-slate-500">エイリアスを読み込み中...</p>
        )}
        {aliasesQuery.isError && (
          <p className="text-sm text-red-600">エイリアスの取得に失敗しました。</p>
        )}
        {aliasesQuery.data && (
          <PresetAliasEditor
            details={aliasesQuery.data}
            edits={edits}
            readOnly={readOnly}
            onChange={(moveId, value) =>
              setEdits((prev) => ({ ...prev, [moveId]: value }))
            }
          />
        )}
      </div>
    </main>
  );
}
