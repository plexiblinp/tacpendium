import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchJSON } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { CheckDuplicateResponse, Modifiers } from "../types";

export interface CheckDuplicateInput {
  characterId: number;
  starterMoveId: number | null;
  position: string | null;
  opponentStance: string | null;
  hitType: string | null;
  opponentSize: string | null;
  /** ★M37-07: 重複判定キーの 8 つ目。列は NOT NULL のため null を取らない。 */
  starterMeaty: boolean;
  steps: Array<{
    stepOrder: number;
    moveId?: number | null;
    modifiers?: Modifiers;
  }>;
  excludeComboId?: number;
}

export interface DuplicateInfo {
  id: number;
  characterId: number;
  starterMoveId: number | null;
  position: string | null;
  opponentStance: string | null;
  hitType: string | null;
  opponentSize: string | null;
  /** ★M37-07。要求値のエコーバックである。 */
  starterMeaty: boolean;
  stepCount: number;
  /**
   * ★M24-08 第 2 部 C で足した。BE は着手前から返しており(dto.go の
   * DuplicateInfoResponse.Memo)、web/src/features/combo/types.ts にも在ったが、
   * 本フックの型で落ちていたため画面へ届いていなかった。
   * ★combos に name 列は無く、memo が「どのコンボか」を人が読める形で示す唯一の材料である。
   */
  memo?: string | null;
}

const EMPTY: DuplicateInfo[] = [];

/**
 * useCheckDuplicate は入力中の内容が既存コンボと重複するかを問い合わせる。
 *
 * ★★M24-08 第 2 部 C(CO-010)で TanStack Query へ移した。
 *   着手前は 生 fetch + useEffect + AbortController + 手書き 3 state +
 *   手書き debounce であり、hooks/ の中で唯一データ層の作法から外れていた。
 *   ⇒ 重複排除・キャッシュ・状態管理は TanStack が持つ。ここに残るのは
 *     「入力を落ち着かせる(debounce)」だけである。
 *
 * ★★in-flight の中断は無くなった(着手前の AbortController 相当は無い)。
 *   本フックは queryFn へ signal を渡していないため、応答が返り切る前に入力が
 *   変わっても前の往復は最後まで走る。**それでも表示は壊れない**——
 *   TanStack は queryKey ごとに結果を保持し、画面が読むのは現在のキーの結果だけ
 *   だからである(着手前の AbortController は「古い応答で state を上書きしない」
 *   ためのものであり、その役割はキーの分離が代替している)。
 *   ★通信を実際に止めたいなら queryFn の引数の signal を fetch へ渡すこと。
 *     本サブでは挙動を増やさないため入れていない。
 *
 * ★debounce は入力側に掛ける。問い合わせ側ではない——
 *   打鍵のたびに queryKey が変わると、TanStack は「別のクエリ」として
 *   全部を走らせてしまう(中断はしても往復は作る)。
 */
export function useCheckDuplicate(
  input: CheckDuplicateInput | null,
  options?: { debounceMs?: number; enabled?: boolean },
): {
  duplicates: DuplicateInfo[];
  isLoading: boolean;
  error: Error | null;
} {
  const debounceMs = options?.debounceMs ?? 300;
  const enabled = options?.enabled ?? true;

  const [settled, setSettled] = useState<CheckDuplicateInput | null>(null);

  // ★依存は入力の値そのものではなく安定ハッシュにする。
  //   object を依存に置くと、値が同じでも参照が変わるたびに再実行される。
  const inputHash = input ? JSON.stringify(input) : "";

  // ★依存は inputHash だけで閉じている。effect の中で input を直接読まず、
  //   ハッシュから起こし直しているのはそのためである
  //   (input を読むと依存の宣言と実際の参照が食い違い、抑制コメントが要る形になる)。
  useEffect(() => {
    if (!inputHash || !enabled) {
      setSettled(null);
      return;
    }
    const timer = setTimeout(
      () => setSettled(JSON.parse(inputHash) as CheckDuplicateInput),
      debounceMs,
    );
    return () => clearTimeout(timer);
  }, [inputHash, enabled, debounceMs]);

  const query = useQuery({
    queryKey: queryKeys.combo.duplicateCheck(settled),
    queryFn: () =>
      fetchJSON<CheckDuplicateResponse>("/api/combos/check-duplicate", {
        method: "POST",
        body: JSON.stringify(settled),
      }),
    enabled: settled != null && enabled,
  });

  // ★入力が変わって再問い合わせ中の間も「読み込み中」と見せる。
  //   settled が追いついていない間に前回の結果を「確定」として出すと、
  //   利用者は消したはずの警告を見続けることになる。
  const pending = enabled && input != null && inputHash !== JSON.stringify(settled);

  return {
    duplicates: query.data?.duplicates ?? EMPTY,
    isLoading: pending || query.isFetching,
    error: (query.error as Error | null) ?? null,
  };
}
