import { INITIAL_CHARACTER_ID } from "@/lib/constants";

/**
 * 「いま対象にしているキャラ」を決める規則(M24-01 §4.1)。
 *
 * 本サブ以前は、画面ごとに `INITIAL_CHARACTER_ID` を直接参照する形がばらばらに置かれており、
 * 初回起動ウィザードが書いた `config.toml [defaults] character_id` がどの画面へも届いていなかった
 * (memo `SM-041`)。規則を 1 本にして、A 群の全画面がここを通るようにする。
 *
 * ★段を足すときは CHARACTER_RESOLUTION_STAGES へ 1 行足す。段ごとに if を散らさないこと。
 */

/** 解決関数の入力。呼び出し側(フック)が各段の材料を集めて渡す。 */
export interface CharacterSources {
  /** 段 1: URL のクエリ(`?character=` / `?character_id=`)。M10-02 由来の既存の仕組み。 */
  urlCharacterId?: number | null;
  /**
   * 段 2: 同一セッション内で最後に選択したキャラ。
   * 供給元は既存のフィルタ保持キー `combo-list-filters-v1` である
   * (読み取りは useComboListFilters の readSessionCharacterId が行う)。
   * ★本ファイルはブラウザストレージに触れない。純粋関数として保つ。
   */
  sessionCharacterId?: number | null;
  /**
   * 段 3a: いま選ばれている利用者の既定キャラ(`users.main_character_id`)。
   * ★本サブでは未実装(M24-01 §4.1-2a / D-545)。呼び出し側は常に undefined を渡す。
   */
  userMainCharacterId?: number | null;
  /** 段 3b: アプリ全体の既定(`config.toml [defaults] character_id`)。初回起動ウィザードが書く。 */
  configCharacterId?: number | null;
  /**
   * 実在検査に使うキャラ ID の集合。未取得のあいだは null/undefined を渡す
   * (そのときは検査をスキップして採用する = 取得前に段 4 へ落ちて表示が飛ぶのを避ける)。
   */
  knownCharacterIds?: readonly number[] | null;
}

interface ResolutionStage {
  /** 段の識別子。テストと破壊確認が「どの段で決まったか」を主張するために使う。 */
  readonly id: string;
  readonly pick: (sources: CharacterSources) => number | null | undefined;
  /**
   * 採用前にキャラの実在を確かめるか。
   * ★段 3 系だけ true。段 1・段 2 に掛けると `?character=` の現行挙動(正の整数なら採用)が変わる。
   */
  readonly verifyExists: boolean;
}

/**
 * 解決順(優先度の高い順)。★段を足すときは、この配列へ 1 行足すだけでよい。
 *
 * 段 3a(`users.main_character_id` = 利用者ごとの既定)は本サブでは実装しない
 * (D-545: 優先度は低い。いったん未実装でよい)。実装するときは下のコメント位置へ 1 行足す。
 * 単一利用者なら 3a と 3b は実質同じ値になり、複数利用者になったとき 3a が効く。
 */
export const CHARACTER_RESOLUTION_STAGES: readonly ResolutionStage[] = [
  { id: "1-url", pick: (s) => s.urlCharacterId, verifyExists: false },
  { id: "2-session", pick: (s) => s.sessionCharacterId, verifyExists: false },
  // ★段 3a を実装するときはここへ 1 行足す:
  //   { id: "3a-user", pick: (s) => s.userMainCharacterId, verifyExists: true },
  { id: "3b-config", pick: (s) => s.configCharacterId, verifyExists: true },
];

/** 段 4(フォールバック)の識別子。 */
export const CHARACTER_FALLBACK_STAGE_ID = "4-fallback";

function isPositiveInt(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function existsAsCharacter(
  id: number,
  knownCharacterIds: readonly number[] | null | undefined,
): boolean {
  // 未取得のあいだは検査できない。検査できないことを「不在」と読まない。
  if (knownCharacterIds == null || knownCharacterIds.length === 0) return true;
  return knownCharacterIds.includes(id);
}

/**
 * 解決結果と、それを決めた段。テスト・破壊確認が段を名指しできるようにするため公開している。
 */
export function resolveCharacterIdWithStage(sources: CharacterSources): {
  characterId: number;
  stageId: string;
} {
  for (const stage of CHARACTER_RESOLUTION_STAGES) {
    const candidate = stage.pick(sources);
    if (!isPositiveInt(candidate)) continue;
    if (stage.verifyExists && !existsAsCharacter(candidate, sources.knownCharacterIds)) {
      // 設定の既定キャラが実在しないキャラを指している。次の段へ落とす。
      continue;
    }
    return { characterId: candidate, stageId: stage.id };
  }
  // 段 4: フォールバック定数。★この 1 か所だけが INITIAL_CHARACTER_ID を直接参照する
  //       (M24-01 §4.1-5。呼び出し元は本関数のみ)。
  return {
    characterId: INITIAL_CHARACTER_ID,
    stageId: CHARACTER_FALLBACK_STAGE_ID,
  };
}

/** 「いま対象にしているキャラ ID」を返す。 */
export function resolveCharacterId(sources: CharacterSources): number {
  return resolveCharacterIdWithStage(sources).characterId;
}
