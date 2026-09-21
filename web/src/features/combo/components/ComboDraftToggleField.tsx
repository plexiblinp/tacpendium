import { Switch } from "@/components/ui/switch";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * コンパクト表示。最上部のキャンセル導線と同一行に置く用途(M15-05 追補)。
   * fieldset の枠・見出しを省き、Switch + 短ラベルのみをインライン表示する。
   */
  inline?: boolean;
}

/**
 * 仮登録(is_draft)トグルの描画コンポーネント。
 *
 * コンボ登録(新規/コピー)では画面最上部(キャンセル導線の隣・inline)、編集モードでは
 * 基本情報フィールド末尾に配置されるため、描画位置に依存しない純粋な表示コンポーネント
 * として切り出している(M12-02 / C-15)。トグルは仮想コントローラのラッシュ版と同じ
 * shadcn Switch に統一(M15-05 追補)。
 */
/**
 * ★★仮登録トグルのラベル(**唯一の正典**)。
 *
 * ★★M24-12(§4.10.2・D-582): **inline 版と非 inline 版で同じ文字列を使う。**
 *   ★以前は inline 版が「仮登録」の 2 文字だけで、機能の意味が読めなかった
 *     (開発者の実機確認 2026-08-29)。
 *   ★★同じ機能に 2 つの呼び名を持たせない——先例＝`M24-04` の followup
 *     `opponent-stance-vocabulary-split`(同じ列挙値に「どちらでも可」と「不問」の
 *     2 つの呼び名ができた)。**⇒ 今から同じ型の欠陥を作らない。**
 *
 * ★「重複コンボの登録等」は事実に合っている——`VAL-C02`(重複判定)は仮登録では
 *   走らない(`DES-006` §2.2)。
 *
 * ★★2026-08-29・`M24-13`/`CHANGE-139`: 括弧の中から「レシピ未入力」を落とした。
 *   ★仮登録でもレシピのステップ 1 本以上が要るようになったため、事実でなくなった
 *   ——`VAL-C09` を仮登録へ適用した。**同じ画面の下で保存ボタンが `disabled` になり
 *   「レシピを 1 つ以上入力してください(仮登録でも必要です)。」と出るため、
 *   残すと画面が上下で正反対のことを言う状態になっていた。**
 * ★`DES-006` §2.2 の「VAL-C01〜C11 のうち D01〜D03 以外は全て適用しない」は、
 *   `CHANGE-139` が例外を 1 件立てた文である。⇒ 根拠として引くのは `VAL-C02` の
 *   ぶんだけにしてある。
 */
export const DRAFT_TOGGLE_LABEL = "仮登録として保存(重複コンボの登録等を許容)";

/** 主ラベル(短い呼び名)。★行に収まらないときの見出しとして使う。 */
const DRAFT_TOGGLE_HEAD = "仮登録として保存";
/** 補足(許容するものの説明)。★{@link DRAFT_TOGGLE_LABEL} の括弧の中と同一。 */
const DRAFT_TOGGLE_NOTE = "重複コンボの登録等を許容";

export function ComboDraftToggleField({ checked, onChange, inline }: Props) {
  const toggle = (
    <Switch
      data-testid="combo-editor-draft-checkbox"
      checked={checked}
      onCheckedChange={(c) => onChange(c === true)}
      aria-label={DRAFT_TOGGLE_LABEL}
    />
  );

  if (inline) {
    // ★★M24-12(§9.2 で委任・選んだ形を報告する): 最上部の 1 行には収まらないため、
    //   **主ラベルと補足を 2 行に分けて出す**。★文字列は上の正典を組み替えているだけで、
    //   非 inline 版と同じものを見せている(語を足しても減らしてもいない)。
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        {toggle}
        <span className="leading-tight">
          {DRAFT_TOGGLE_HEAD}
          <span className="block text-xs text-gray-500">
            ({DRAFT_TOGGLE_NOTE})
          </span>
        </span>
      </label>
    );
  }

  return (
    <fieldset className="rounded-lg border border-gray-300 p-3">
      <legend className="px-2 text-sm font-semibold">仮登録モード</legend>
      <label className="flex items-center gap-2 text-sm">
        {toggle}
        {DRAFT_TOGGLE_LABEL}
      </label>
    </fieldset>
  );
}
