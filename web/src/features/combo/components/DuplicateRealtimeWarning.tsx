import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { jaLabel, type Translate } from "@/lib/ja-label";

import { useCharacterName } from "@/features/character/hooks/useCharacters";
import type { Move } from "../../moves/types";
import { useCombo } from "../api";
import type { DuplicateInfo } from "../hooks/useCheckDuplicate";
import {
  HIT_TYPE_LABEL_KEYS,
  OPPONENT_SIZE_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  POSITION_LABEL_KEYS,
  labelFor,
} from "../utils";

export interface DuplicateLabelParts {
  character: string;
  starter: string;
  hitType: string;
  position: string;
  stance: string;
  size: string;
}

// ★M24-07: 状況ラベルを locale から引くため、文言の解決関数を引数で受ける。
//   既定は日本語固定(本関数は i18n を通らない呼び手からも使える形を保つ)。
export function buildDuplicateLabel(
  dup: DuplicateInfo,
  moves: Move[],
  characterName: string,
  translate: Translate = jaLabel,
): DuplicateLabelParts {
  return {
    // ★★M24-07 レビュー(中-2): 代替表示だけ直書きの日本語が残っていた。
    //   ⇒ 解決関数を通す(英語 UI で「キャラ#3」と出ない)。
    character:
      characterName ||
      translate("comboCommon.characterFallback", { id: dup.characterId }),
    starter: resolveStarterLabel(dup.starterMoveId, moves, translate),
    hitType: labelFor(HIT_TYPE_LABEL_KEYS, dup.hitType, translate),
    position: labelFor(POSITION_LABEL_KEYS, dup.position, translate),
    stance: labelFor(OPPONENT_STANCE_LABEL_KEYS, dup.opponentStance, translate),
    size: labelFor(OPPONENT_SIZE_LABEL_KEYS, dup.opponentSize, translate),
  };
}

/**
 * 判定に使わない項目の、いま入力中の値(M24-08 第 2 部 C)。
 *
 * ★★重複判定は「判定キー 7 項の完全一致 ＋ recipe_hash の完全一致」で成立する。
 * ★M37-07 で 6 項 → 7 項になった(starter_meaty を追加)。
 *   ⇒ 一致した時点で、キー項目もレシピも差分は原理的にゼロである。
 *   着手前の文面はその「必ず一致する項目」だけを並べており、しかも表示していたのは
 *   利用者自身の入力のエコーバックだった(dto.go の DuplicateInfoResponse が明記)。
 *   ⇒ 「どこが差分か」を見せるには、判定に使わない項目を突き合わせるしかない。
 */
export interface DuplicateDraftValues {
  memo: string;
  damage: string;
  driveDamage: string;
  saGaugeConsumed: string;
  driveGaugeConsumed: string;
  knockdownAdvantage: string;
  tagIds: number[];
}

interface DiffRow {
  labelKey: string;
  mine: string;
  theirs: string;
}

/** 空・未入力を 1 つの表現へ畳む。"" と undefined と null を区別しない。 */
function norm(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

interface Props {
  duplicates: DuplicateInfo[];
  moves: Move[];
  /** 未指定なら差分欄を出さない(既存の呼び手を壊さないため任意にしてある)。 */
  draft?: DuplicateDraftValues;
}

export function DuplicateRealtimeWarning({ duplicates, moves, draft }: Props) {
  const { t } = useTranslation();
  const first = duplicates.length > 0 ? duplicates[0] : null;
  const characterName = useCharacterName(first?.characterId);

  // ★既存の GET /api/combos/:id をそのまま使う。BE の応答は 1 バイトも増やしていない
  //   (重複判定の応答へ項目を足すと契約が広がるため＝D-415 の周辺)。
  const existing = useCombo(first?.id);

  if (!first) return null;

  const label = buildDuplicateLabel(first, moves, characterName, t);

  const other = existing.data;
  const diffs: DiffRow[] = [];
  if (draft && other) {
    const pairs: Array<[string, string, string]> = [
      ["comboEditor.duplicateDiff.memo", norm(draft.memo), norm(other.memo)],
      ["comboEditor.duplicateDiff.damage", norm(draft.damage), norm(other.damage)],
      [
        "comboEditor.duplicateDiff.driveDamage",
        norm(draft.driveDamage),
        norm(other.driveDamage),
      ],
      [
        "comboEditor.duplicateDiff.saGaugeConsumed",
        norm(draft.saGaugeConsumed),
        norm(other.saGaugeConsumed),
      ],
      [
        "comboEditor.duplicateDiff.driveGaugeConsumed",
        norm(draft.driveGaugeConsumed),
        norm(other.driveGaugeConsumed),
      ],
      [
        "comboEditor.duplicateDiff.knockdownAdvantage",
        norm(draft.knockdownAdvantage),
        norm(other.knockdownAdvantage),
      ],
      [
        "comboEditor.duplicateDiff.tags",
        String(draft.tagIds.length),
        String(other.tags?.length ?? 0),
      ],
    ];
    for (const [labelKey, mine, theirs] of pairs) {
      if (mine !== theirs) diffs.push({ labelKey, mine, theirs });
    }
  }

  const blank = t("comboEditor.duplicateDiff.blank");

  return (
    <div
      role="alert"
      data-testid="duplicate-realtime-warning"
      className="rounded border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
    >
      {/* ★DES-005 §5.7 は「何をすべきか」を言う文面を求めている。
          着手前は状況の羅列で止まっており、それが SM-068 の「ちょっと不自然」の正体だった。 */}
      <p className="font-medium">
        {t("comboEditor.duplicateRealtimeHeading", {
          id: first.id,
          name: norm(first.memo) || t("comboEditor.duplicateNoMemo"),
        })}
      </p>

      <p className="mt-1 text-xs">
        {t("comboEditor.duplicateMatchedOn", {
          character: label.character,
          starter: label.starter,
          hitType: label.hitType,
          position: label.position,
          stance: label.stance,
          size: label.size,
        })}
      </p>

      {/* ★★差分。遷移しなくてもここで読める(SM-068 の逐語要求)。 */}
      {draft && (
        <div className="mt-2" data-testid="duplicate-diff">
          {existing.isLoading ? (
            <p className="text-xs">{t("comboEditor.duplicateDiff.loading")}</p>
          ) : other == null ? (
            // ★★取得に失敗したときに「違いはありません」と言わないこと。
            //   比較を 1 度も行っていないのに断定すると、差分欄そのものが
            //   利用者を誤らせる(SM-068 の要求は「差分が読めること」である)。
            <p className="text-xs">{t("comboEditor.duplicateDiff.loadError")}</p>
          ) : diffs.length === 0 ? (
            <p className="text-xs">{t("comboEditor.duplicateDiff.none")}</p>
          ) : (
            <>
              <p className="text-xs font-medium">
                {t("comboEditor.duplicateDiff.heading")}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {diffs.map((d) => (
                  <li key={d.labelKey}>
                    {t(d.labelKey)}:{" "}
                    <span className="font-mono">{d.theirs || blank}</span>
                    {" → "}
                    <span className="font-mono font-medium">
                      {d.mine || blank}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Link
        to={`/combos/${first.id}`}
        className="mt-2 inline-block text-yellow-700 underline hover:text-yellow-900"
      >
        {t("comboEditor.duplicateRealtimeLink")}
      </Link>
    </div>
  );
}

function resolveStarterLabel(
  starterMoveId: number | null,
  moves: Move[],
  translate: Translate = jaLabel,
): string {
  if (starterMoveId == null) return "-";
  const move = moves.find((m) => m.id === starterMoveId);
  if (move?.nameJa) return move.nameJa;
  return translate("comboCommon.moveFallback", { id: starterMoveId });
}
