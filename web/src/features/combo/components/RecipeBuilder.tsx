import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { InfoMark } from "@/components/InfoMark";
import type { Move } from "@/features/moves/types";
import {
  MOVE_CATEGORY_LABEL_JA,
  MOVE_CATEGORY_ORDER,
} from "@/features/moves/types";

import { isOdVariantApplicable } from "../inputResolution";
import {
  MODIFIER_FLAGS_COMMON,
  MODIFIER_OD_VARIANT_FLAGS,
  MODIFIER_NON_MOVE_TYPES,
  MOVE_SELECT_PLACEHOLDER_JA,
  NON_MOVE_FILTER,
  NON_MOVE_GROUP_LABEL_JA,
} from "../labels";
import type { Modifiers, Step } from "../types";
import { formatRecipeLine } from "../utils";
import {
  useClearHiddenSelection,
  useControllerInputOmission,
} from "../hooks/useControllerInputOmission";
import { CollapsibleFieldset } from "./CollapsibleFieldset";
import { ControllerInputOmissionToggle } from "./ControllerInputOmissionToggle";
import { ModifierOdVariantFields } from "./ModifierOdVariantFields";
import { ModifiersEditor } from "./ModifiersEditor";
import { StepRow } from "./StepRow";
import type { StepInput } from "./VirtualController/useControllerInput";
import { VirtualController } from "./VirtualController/VirtualController";
import {
  RECIPE_EMPTY_LABEL,
  RECIPE_STEPS_EMPTY_LABEL,
} from "../recipeDisplay";

interface Props {
  characterId: number;
  steps: Step[];
  moves: Move[];
  movesLoading: boolean;
  onChange: (next: Step[]) => void;
  /**
   * レシピ全体を保存する（M21-04）。★保存導線は ComboEditor が持つため上から渡す。
   * ★物理コントローラのショートカットから呼ぶためだけの入口であり、画面の保存ボタンは動かさない。
   */
  onSave?: () => void;
  /** いま保存できる状態か。★画面の保存ボタンの `disabled` と同じ式を渡すこと。 */
  canSave?: boolean;
}

const NOTES_MAX_LENGTH = 50;

// 技セレクタ + 仮想コントローラ + ステップリスト + modifiers 編集を提供するレシピビルダー(M2-01)。
export function RecipeBuilder({
  characterId,
  steps,
  moves,
  movesLoading,
  onChange,
  onSave,
  canSave,
}: Props) {
  const { t } = useTranslation();
  // 全技プルダウンは既定折りたたみ(指摘16)。
  const [pulldownOpen, setPulldownOpen] = useState(false);
  // 技/非技ステップを 1 セレクタへ統合(指摘17)。値は moveId(数値文字列)or "nonmove:<type>"、未選択は ""。
  const [selectedValue, setSelectedValue] = useState<string>("");
  // プルダウンの区分絞り込み(FB④)。"all"=全カテゴリ、NON_MOVE_FILTER=非技ステップのみ。
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [draftFlags, setDraftFlags] = useState<string[]>([]);
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const notesOver = draftNotes.length > NOTES_MAX_LENGTH;

  useEffect(() => {
    if (draftNotes.length > NOTES_MAX_LENGTH) {
      console.warn(`draftNotes が 50 文字を超えています: ${draftNotes.length} 文字`);
    }
  }, [draftNotes]);

  const movesById = useMemo(() => {
    const m = new Map<number, Move>();
    for (const mv of moves) m.set(mv.id, mv);
    return m;
  }, [moves]);

  // ★★M30-01(SM-100): 全技一覧から「ボタンで入力できる技」を省く切替。
  //   述語は moveSurfacing の isControllerSurfaced の裏返し 1 本である。
  // ★面は "combo" である(M31-06)。⇒ setup_only の技はこの面から外れる。
  const { omitSurfaced, setOmitSurfaced, visibleMoves, omittedCount } =
    useControllerInputOmission(characterId, moves, "combo");
  const grouped = useMemo(
    () => groupMovesByCategory(visibleMoves),
    [visibleMoves],
  );
  // ★M30-01(レビュー 高-4): 一覧から消えた技が選ばれたままだと、画面に出ていない技を
  //   ［追加］で積めてしまう。⇒ 消えた時点で選択を外す。
  useClearHiddenSelection(visibleMoves, selectedValue, setSelectedValue);

  // ★M30-02(SD-020): これから足すステップの move。OD 強度組合せの活性条件に使う。
  //   非技ステップ(`nonmove:`)・未選択のときは undefined —— そのとき OD 組は選べない。
  const draftMove = useMemo(() => {
    if (selectedValue === "" || selectedValue.startsWith("nonmove:")) return undefined;
    return moves.find((m) => m.id === Number(selectedValue));
  }, [moves, selectedValue]);

  const handleAdd = () => {
    if (selectedValue === "") return;
    const nonMoveType = selectedValue.startsWith("nonmove:")
      ? selectedValue.slice("nonmove:".length)
      : null;

    // dash は M16-04 で system move へ一本化。「システム」optgroup(moveId)から選ぶと
    // 下の moveId 経路で system move step として追加される(modifiers.type dash は撤去済み)。
    // ★★M30-02(SD-020・レビュー 高-3): 追加時にも活性条件を当てる。
    //   画面側の `disabled` は「既に入っている値を外せるようにする」ために checked を
    //   除外しているため、**OD 技で選んでから通常技へ変えると draftFlags が素通りする**。
    //   ⇒ SD-020 が塞いだはずの「しゃがみ弱P に OD(弱中)」が復活してしまう。
    //   ★抑止するのは新規付与だけという方針は変わらない —— これは新規付与の経路である。
    const flags = isOdVariantApplicable(draftMove)
      ? draftFlags
      : draftFlags.filter(
          (f) => !MODIFIER_OD_VARIANT_FLAGS.some((o) => o.value === f),
        );
    const modifiers = buildModifiers(nonMoveType, flags, draftNotes);
    const nextStep: Step =
      nonMoveType != null
        ? { stepOrder: steps.length + 1, moveId: undefined, modifiers }
        : { stepOrder: steps.length + 1, moveId: Number(selectedValue), modifiers };
    onChange(reorder([...steps, nextStep]));
    // 入力欄のうち重め(notes、flags)はクリア。技選択はそのまま残してリプライム。
    setDraftFlags([]);
    setDraftNotes("");
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...steps];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(reorder(next));
  };

  const handleMoveDown = (idx: number) => {
    if (idx === steps.length - 1) return;
    const next = [...steps];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(reorder(next));
  };

  const handleDelete = (idx: number) => {
    const next = steps.filter((_, i) => i !== idx);
    onChange(reorder(next));
  };

  // VirtualController 経由のステップ追加(§4.5.1)
  const handleVCStepAdd = (partial: StepInput) => {
    const nextStep: Step = { ...partial, stepOrder: steps.length + 1 };
    onChange(reorder([...steps, nextStep]));
  };

  // VirtualController の削除ボタン: 最後のステップを削除(§4.2.2)
  const handleVCStepDelete = () => {
    if (steps.length === 0) return;
    onChange(reorder(steps.slice(0, -1)));
  };

  // 物理コントローラのショートカットから、直前に確定したステップの修飾情報を開く(M21-04 §4.2 の 4)。
  // ★既存の編集ダイアログの入口(editingStepIndex)をそのまま使う。修飾の選択肢は物理側に持たない。
  const handleVCOpenLastStepModifiers = () => {
    if (steps.length === 0) return;
    setEditingStepIndex(steps.length - 1);
  };

  // ModifiersEditor の保存(§4.6.3)
  const handleModifiersSave = (idx: number, newMods: Modifiers | undefined) => {
    onChange(steps.map((s, i) => (i === idx ? { ...s, modifiers: newMods } : s)));
    setEditingStepIndex(null);
  };

  const toggleFlag = (flag: string) => {
    setDraftFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    );
  };

  // M15-05 追補: 折りたたんでも一目で分かるよう、編集中 steps の技名 1 行プレビューを
  // 常時表示する(サーバ正規 notation は保存後のみ・プリセット未実装のため技名で近似)。
  const recipeLine = formatRecipeLine(steps, moves);
  // ★B12: サマリを縦へ展開しているか。既定は 1 行(truncate)。
  const [recipeExpanded, setRecipeExpanded] = useState(false);

  return (
    <CollapsibleFieldset
      legend="レシピ"
      contentClassName="space-y-3"
      data-testid="combo-editor-recipe-section"
      /*
        ★★★M37-02(B12 / B09): このサマリ行が「レシピが見えたまま入力できる」の担保である。
          `CollapsibleFieldset` は summary を**開閉に関わらず常時**描くため、仮想コントローラの
          真上に必ず在る。⇒ `sticky top-0` にすると、コントローラを操作している間ずっと
          レシピが視界に残る。★局所スクロール(B09)だけでは担保にならない。
        ★`-mx-4 px-4` は親の `p-4` を打ち消して端まで塗るため。不透明な背景が無いと
          下の技ボタンが透けて読めなくなる。
      */
      summaryClassName="sticky top-0 z-10 -mx-4 mt-1 bg-white px-4 py-1"
      summary={
        <div className="flex items-start gap-2">
          <p
            data-testid="combo-editor-recipe-summary"
            className={
              recipeExpanded
                ? // ★上限を置く。20 ステップで 6 行の sticky バーになると
                  //   B09 が取り戻した縦を食い返す(3 行 = 4.5rem で頭打ち)。
                  "max-h-[4.5rem] flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words font-mono text-xs text-gray-600"
                : "flex-1 truncate font-mono text-xs text-gray-600"
            }
            title={recipeLine || undefined}
          >
            {recipeLine || (
              <span className="text-gray-400">{RECIPE_EMPTY_LABEL}</span>
            )}
          </p>
          {/*
            ★★既定は 1 行のままで、明示操作で縦へ展開する(2026-09-13 開発者選択)。
              常時全文にすると長いレシピほど縦を食い、B14 と正面衝突する。
            ★開閉は素の useState である。**ストレージキーを増やさない**(指示書 §3-5)。
            ★`recipe-full-view-v1` へ相乗りしない —— あれは閲覧 5 面の設定であり、
              閲覧で「省略」を選んだ利用者が編集中にレシピを見失うことになる。
          */}
          {recipeLine !== "" && (
            <button
              type="button"
              onClick={() => setRecipeExpanded((v) => !v)}
              aria-expanded={recipeExpanded}
              data-testid="combo-editor-recipe-summary-toggle"
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              {recipeExpanded ? "1 行" : "全文"}
            </button>
          )}
        </div>
      }
    >
      {/* 仮想コントローラ(レバーレス) */}
      {/*
        M21-03: 物理コントローラの接続状態表示・告知・読取表示は VirtualController が
        内部で持つ形へ移した(セットプレイ入力面へも同時に届かせるため。指示書 §4.9)。
        M21-01 で足していた headerSlot 経由の受け渡しは撤去した。
      */}
      <VirtualController
        characterId={characterId}
        moves={moves}
        context="combo"
        onStepAdd={handleVCStepAdd}
        onStepDelete={handleVCStepDelete}
        onSave={onSave}
        canSave={canSave}
        onOpenLastStepModifiers={handleVCOpenLastStepModifiers}
        stepCount={steps.length}
      />

      {/* 全技から選ぶプルダウン(既定折りたたみ・網羅フォールバック、指摘16/17) */}
      <div className="space-y-2 rounded bg-gray-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPulldownOpen((v) => !v)}
            aria-expanded={pulldownOpen}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
            data-testid="recipe-pulldown-toggle"
          >
            {pulldownOpen ? "▼ 全技一覧を閉じる" : "▶ 全技一覧から選ぶ"}
          </button>
          <span className="text-xs text-gray-500">
            ボタンで入れられない細かい技名はこちら
          </span>
        </div>

        {pulldownOpen && (
          <div className="space-y-2">
            {/* ★M30-01(SM-100): 既定 OFF。省かれるのはコントローラのどれかの面から
                押せる技だけであり、残る集合は未掲載タブと完全に一致する。 */}
            <ControllerInputOmissionToggle
              checked={omitSurfaced}
              onChange={setOmitSurfaced}
              omittedCount={omittedCount}
            />
            {/* 区分で絞り込み(FB④、非技ステップ統合=指摘17) */}
            <label className="flex items-center gap-2 text-xs text-gray-600">
              区分で絞り込み:
              <select
                className="rounded border border-gray-300 px-2 py-1 text-xs"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                data-testid="recipe-category-filter"
              >
                <option value="all">すべて</option>
                {MOVE_CATEGORY_ORDER.map((cat) => {
                  const list = grouped.get(cat);
                  if (!list || list.length === 0) return null;
                  return (
                    <option key={cat} value={cat}>
                      {MOVE_CATEGORY_LABEL_JA[cat] ?? cat}
                    </option>
                  );
                })}
                <option value={NON_MOVE_FILTER}>{NON_MOVE_GROUP_LABEL_JA}</option>
              </select>
            </label>
            <select
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={selectedValue}
              onChange={(e) => setSelectedValue(e.target.value)}
              disabled={movesLoading}
              data-testid="recipe-move-select"
            >
              <option value="">
                {movesLoading ? "技を読み込み中..." : MOVE_SELECT_PLACEHOLDER_JA}
              </option>
              {MOVE_CATEGORY_ORDER.filter(
                (cat) => filterCategory === "all" || cat === filterCategory,
              ).map((cat) => {
                const list = grouped.get(cat);
                if (!list || list.length === 0) return null;
                return (
                  <optgroup
                    key={cat}
                    label={MOVE_CATEGORY_LABEL_JA[cat] ?? cat}
                  >
                    {list.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.nameJa ?? m.code}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              {(filterCategory === "all" || filterCategory === NON_MOVE_FILTER) && (
                <optgroup label={NON_MOVE_GROUP_LABEL_JA}>
                  {MODIFIER_NON_MOVE_TYPES.map((tp) => (
                    <option key={tp.value} value={`nonmove:${tp.value}`}>
                      {tp.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/*
              ★M37-06 段 1/段 4 の計測アンカー(描画には影響しない)。

              ★★★段 4: 行間(gap-y)と項目間(gap-x)を詰めた。**横並びの形そのものは変えていない。**
                理由＝選択肢が 7 → 11 になり、狭幅(390px)で折返しが 1 行増えて縦が
                +24px になった(段 4 の 1 回目の実測)。`M37-02` は縦の消費を減らすサブで
                あり、その成果を食う(指示書 §4.5 / §2.4-3)。
              ★★2 列グリッドにはしない —— こちらは横に流せる面であり、広い幅では
                1 行に収まっている(1280px で 16px)。グリッドにすると**広い幅で縦が伸びる。**
                ⇒ ダイアログ側(縦 1 列だった)とは最適な形が違う。同じ形へ揃えないこと。
            */}
            <div
              className="flex flex-wrap items-center gap-x-1.5 gap-y-0"
              data-testid="modifier-flags-inline"
            >
              {/*
                ★M37-06: 見出しを「補足(入力のコツ・状況):」から「補足:」へ縮めた。
                  ★同じ行に横並びで載る見出しであり、狭幅では**見出しだけで 1 行を使い切る**。
                  ⇒ 選択肢が 4 つ増えたぶんを、見出しの短縮と行間で吸収した(縦 ±0)。
                ★★ダイアログ側の見出し(「補足(入力のコツ・状況、複数選択可)」)は縮めていない
                  —— あちらは独立した行に置かれており、縮めても縦は 1px も減らない。
              */}
              <span className="text-xs text-gray-600">補足:</span>
              {MODIFIER_FLAGS_COMMON.map((f) => (
                <label key={f.value} className="flex items-center gap-0.5 text-xs">
                  <input
                    type="checkbox"
                    checked={draftFlags.includes(f.value)}
                    onChange={() => toggleFlag(f.value)}
                  />
                  {f.label}
                </label>
              ))}
            </div>

            {/*
              ★M30-02(SD-020): OD 強度組合せは既定非表示 ＋ 必殺技の OD のときだけ選択可。
              ★対象はこれから足すステップ = 全技一覧で選んでいる move である。
                非技ステップ(nonmove:)を選んでいるときは move が無いので選べない。
            */}
            <ModifierOdVariantFields
              flags={draftFlags}
              onToggle={toggleFlag}
              move={draftMove}
              layout="inline"
            />

            <input
              type="text"
              placeholder="ステップメモ(任意)"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              className={`w-full rounded border px-2 py-1.5 text-sm ${
                notesOver
                  ? "border-red-400 bg-red-50 text-red-900"
                  : "border-gray-300"
              }`}
              maxLength={200}
            />
            {notesOver && (
              <p className="mt-0.5 text-xs text-red-600">
                {draftNotes.length} 文字 — 50文字超です
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAdd}
                disabled={selectedValue === ""}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                data-testid="recipe-add-step"
              >
                追加
              </button>
            </div>
          </div>
        )}
      </div>

      {steps.length === 0 ? (
        <p
          className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500"
          data-testid="combo-recipe-steps-empty"
        >
          {RECIPE_STEPS_EMPTY_LABEL}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1 px-1 text-xs text-gray-600">
            <span>編集ボタンについて</span>
            <InfoMark
              topic="recipe-modifier"
              text={t("help.recipeModifier")}
              ariaLabel="編集ボタン(ステップ補足設定)の説明"
            />
          </div>
          {/*
            ★test-id は M21-05 で追加した(既存 test-id は変更していない = DES-005 §6.8)。
            理由: 読取表示(GamepadRecipeReadout)も ol > li を描画するため、素の `ol > li` では
            ステップ一覧と読取表示が区別できない。M21-04 までは読取表示がパッド接続時にしか
            出なかったため露見しなかったが、M21-05 でキーボード登録済みでも出るようになった。
          */}
          <ol className="space-y-1" data-testid="recipe-step-list">
            {steps.map((s, idx) => (
            <StepRow
              key={`${s.stepOrder}-${idx}`}
              step={s}
              index={idx}
              total={steps.length}
              movesById={movesById}
              onMoveUp={() => handleMoveUp(idx)}
              onMoveDown={() => handleMoveDown(idx)}
              onDelete={() => handleDelete(idx)}
              onEdit={() => setEditingStepIndex(idx)}
            />
          ))}
          </ol>
        </>
      )}

      <ModifiersEditor
        open={editingStepIndex !== null}
        step={editingStepIndex !== null ? steps[editingStepIndex] : undefined}
        stepIndex={editingStepIndex}
        movesById={movesById}
        onSave={handleModifiersSave}
        onOpenChange={(open) => { if (!open) setEditingStepIndex(null); }}
      />
    </CollapsibleFieldset>
  );
}

function groupMovesByCategory(moves: Move[]): Map<string, Move[]> {
  const out = new Map<string, Move[]>();
  for (const m of moves) {
    const list = out.get(m.category) ?? [];
    list.push(m);
    out.set(m.category, list);
  }
  return out;
}

function reorder(steps: Step[]): Step[] {
  return steps.map((s, i) => ({ ...s, stepOrder: i + 1 }));
}

function buildModifiers(
  nonMoveType: string | null,
  flags: string[],
  notes: string,
): Modifiers | undefined {
  const m: Modifiers = {};
  if (flags.length > 0) m.flags = flags;
  if (nonMoveType) m.type = nonMoveType;
  if (notes.trim().length > 0) m.notes = notes.trim();
  if (
    (m.flags == null || m.flags.length === 0) &&
    !m.type &&
    !m.notes
  ) {
    return undefined;
  }
  return m;
}
