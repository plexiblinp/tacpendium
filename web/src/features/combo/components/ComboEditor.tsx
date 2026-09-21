import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useMovesByCharacter } from "@/features/moves/api";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import type { CreateSetupInput, SetupSummary } from "@/features/setup/types";
import { useCreateSetupLink } from "@/features/setup/hooks/useSetupLinks";
import { useRestoreCombo } from "@/features/combo/hooks/useRestoreCombo";
import { useTagSelectorForm } from "@/features/tag/hooks/useTagSelectorForm";
import { useAddPunish } from "@/features/punish/api";
import {
  HIT_TYPE_NORMAL,
  HIT_TYPE_VALUES,
  OPPONENT_STANCE_ANY,
  type HitType,
} from "@/constants/combo-list";
import { cn } from "@/lib/utils";
import {
  COMBO_EDITOR_TABS,
  COMBO_EDITOR_TAB_LABEL_JA,
  countErrorsByTab,
  type ComboEditorTab,
} from "../editorTabs";
import { dirtyKey } from "@/features/navigation-guard/dirty";
import {
  useLeaveWithoutConfirm,
  useRequestLeave,
  useUnsavedChangesGuard,
} from "@/features/navigation-guard/useUnsavedChangesGuard";
import { PUNISH_SEARCH_LOCK_REASON } from "@/constants/punish";
import { STARTER_MEATY_LABEL } from "@/constants/combo-list";
import {
  GAUGE_AT_START_LABEL_JA,
  GAUGE_CONSUMED_LABEL_JA,
} from "@/features/combo/labels";
import { ModalPresenceMarker } from "@/lib/modal-presence";
import { PreSaveDuplicateDialog } from "@/components/PreSaveDuplicateDialog";
import {
  checkComboTrashDuplicates,
  type DuplicateCandidate,
} from "@/features/trash/preSaveDuplicateCheck";
import { formatRestoreWarnings } from "@/features/trash/restoreWarnings";
import {
  dropAcknowledgedTrashDuplicates,
  formatSaveWarnings,
} from "@/features/trash/saveWarnings";
import { ConflictDialog, type ConflictKind } from "@/components/ConflictDialog";

import {
  buildSituation,
  parseCustomStateDefs,
  parseSituationCustomStates,
} from "../customStates";

import {
  useCreateCombo,
  useUpdateComboMetadata,
  useUpdateComboWithKeyChange,
} from "../api";
import { classifySaveError, isConflictDialogKind } from "../saveError";
import { useCheckDuplicate } from "../hooks/useCheckDuplicate";
import type { CheckDuplicateInput } from "../hooks/useCheckDuplicate";
import { parseComboForm } from "../schema";
import type {
  Combo,
  ComboDetail,
  CreateComboRequest,
  SetupCarryOptionsInput,
  Step,
  UpdateMetadataRequest,
  ValidationIssue,
  ValidationResult,
} from "../types";
import {
  extractKeyFields,
  hasKeyChanges,
  isFormReadyForDuplicateCheck,
  type ComboKeyFields,
} from "../utils";
import { useResolvedCharacterId } from "../hooks/useResolvedCharacterId";
import type { BasicFieldsValue } from "./ComboEditorBasicFields";
import { ComboEditorBasicFields } from "./ComboEditorBasicFields";
import { ComboDraftToggleField } from "./ComboDraftToggleField";
import { CharacterChangeConfirmDialog } from "./CharacterChangeConfirmDialog";
import { ComboEditorCharacterField } from "./ComboEditorCharacterField";
import { DuplicateRealtimeWarning } from "./DuplicateRealtimeWarning";
import { DuplicateWarning } from "./DuplicateWarning";
import { PromoteToFinalButton } from "./PromoteToFinalButton";
import { KnockdownAdvantageChangeModal } from "./KnockdownAdvantageChangeModal";
import { PutConfirmDialog } from "./PutConfirmDialog";
import { RecipeBuilder } from "./RecipeBuilder";
import { SetupRegistrationSection } from "./SetupRegistrationSection";
import { ValidationDisplay } from "./ValidationDisplay";

/**
 * ★★M24-13(CHANGE-139): レシピのステップが 0 本のとき、保存できない理由として出す文面。
 *
 * ★仮登録でも本登録でも同じ文面である(トグルで分岐しない)。
 * ★「1 つ以上」であって「技を選べ」ではない——技が未指定のステップ 1 本でも保存できる
 *   (VAL-D02 の「うろ覚え」は変えていない)。文面がそれ以上を要求しないようにしている。
 */
export const SAVE_BLOCKED_EMPTY_RECIPE =
  "レシピを 1 つ以上入力してください(仮登録でも必要です)。";

/** 保存ボタンの aria-describedby が指す、理由テキストの id。 */
export const SAVE_BLOCKED_REASON_ID = "combo-editor-save-blocked-reason";

interface Props {
  mode: "new" | "edit" | "copy";
  initial?: ComboDetail;
  // 新規モードの既定キャラクター(M10-02 文脈追従)。一覧などのキャラ文脈から
  // 伝播された characterId を初期選択に用いる。不在時は既定キャラの解決順
  // (M24-01 §4.1-2)の段 2 以降へ落ちる。
  // 編集/コピー(initial あり)では無視され initial.characterId が優先される。
  initialCharacterId?: number;
}

// コンボ登録/編集の中核コンポーネント。
//
// 動作:
//   - mode="new":  新規登録モード。POST /api/combos。
//   - mode="copy": コピー登録モード。POST /api/combos。hasKeyChanges 判定をスキップ。
//   - mode="edit": 編集モード。hasKeyChanges() で PATCH/PUT を分岐。
//     PUT 時は確認ダイアログを挟む（指示書 §4.4.3、HANDOVER-001 §3.1）。
export function ComboEditor({ mode, initial, initialCharacterId }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const punishState = location.state as {
    punishReturn?: string;
    /**
     * 出発点の URL(M28-02c / CHANGE-162 §7)。
     *
     * ★★確定反撃サーチの punishReturn と同じ仕組みに 1 値足しただけである ——
     *   新しい戻り方を作らない。⇒ 履歴の形は 1 枚も変えていない
     *   (M24-12 (3) の「戻る 1 回で編集画面、2 回目でその前へ抜ける」契約と
     *   NavigationGuardProvider の history.go の勘定はそのまま)。
     * ★いま渡してくるのは影響コンボの専用画面だけである。
     */
    returnTo?: string;
    punishContext?: { opponentLabel: string; starterLabel?: string };
    punishSelfCharacterId?: number;
    opponentMoveId?: number;
    hitType?: string;
  } | null;
  // 確定反撃サーチ(M18-02)からの遷移時に戻り先 URL が state で渡される。
  // 存在すれば保存後・キャンセル時にそこへ復帰する(無ければ従来どおり=フォールバック必須)。
  const punishReturn = punishState?.punishReturn ?? null;
  // ★出発点があればそこへ戻す。punishReturn と併存するが、渡す側が別なので競合しない。
  //   ⇒ 変えるのは「どこへ navigate するか」だけである。
  const returnTo = punishReturn ?? punishState?.returnTo ?? null;
  // 確定反撃サーチからの登録時、どの相手技/始動技向けかを保存メッセージで示すための文脈。
  const punishContext = punishState?.punishContext ?? null;
  // 新規登録導線だけで使う。未知値や不正 id は通常の新規登録へ安全にフォールバックする。
  const punishOpponentMoveId =
    mode === "new" &&
    Number.isInteger(punishState?.opponentMoveId) &&
    (punishState?.opponentMoveId ?? 0) > 0
      ? punishState!.opponentMoveId!
      : null;
  const punishSelfCharacterId =
    mode === "new" &&
    Number.isInteger(punishState?.punishSelfCharacterId) &&
    (punishState?.punishSelfCharacterId ?? 0) > 0
      ? punishState!.punishSelfCharacterId!
      : null;
  const punishHitType =
    mode === "new" && punishSelfCharacterId != null
      ? parsePunishHitType(punishState?.hitType)
      : undefined;
  const isPunishSearchContext =
    punishSelfCharacterId != null && punishHitType != null;
  const isPunishRegistration =
    punishOpponentMoveId != null && isPunishSearchContext;

  // 新規モードの初期キャラ(M24-01 §4.1-4)。段 1 = ?character= の伝播値。
  // ★遅延初期化子で読んでよいのは config までである——App.tsx が GET /api/config の完了まで
  //   描画を止めるため、初回描画時点で config はキャッシュ済みである。
  // ★★ただしキャラ一覧(GET /api/games/:id/characters)はゲートされていない。初回描画時点では
  //   未取得であり、そのあいだ段 3b の実在検査はスキップされる(検査できないことを「不在」と
  //   読まないため＝defaultCharacter.ts)。⇒ 遅延初期化子で 1 回だけ読むと、config が実在しない
  //   キャラを指しているとき段 4 へ落ちないまま固定される(M24-01 レビュー 中-2)。
  //   一覧・マイコンボは毎描画で解決し直すため自己修復するが、本画面は修復しない。
  //   ⇒ 下の useEffect で「利用者がまだキャラに触れていないあいだ」だけ解決値を採り直す。
  const resolvedCharacterId = useResolvedCharacterId({
    urlCharacterId: initialCharacterId,
  });
  const [basic, setBasic] = useState<BasicFieldsValue>(() =>
    initialBasic(initial, resolvedCharacterId, punishHitType),
  );
  // 利用者がキャラを選び直したか。★立ったら二度と自動採用しない
  //   ——dirty 判定は characterId を除いて行うため(isFormDirty)、
  //   「キャラだけ変えた」状態は dirty にならず、それだけでは守れない。
  const characterTouchedRef = useRef(false);
  useEffect(() => {
    if (mode !== "new") return; // 編集・コピーは initial.characterId が正である
    if (characterTouchedRef.current) return;
    if (initialCharacterId != null) return; // 段 1(URL 文脈)が在るなら解決済みで動かない
    setBasic((prev) =>
      prev.characterId === resolvedCharacterId
        ? prev
        : { ...prev, characterId: resolvedCharacterId },
    );
  }, [mode, initialCharacterId, resolvedCharacterId]);
  const [steps, setSteps] = useState<Step[]>(() => initial?.steps ?? []);
  const [showPutConfirm, setShowPutConfirm] = useState(false);
  // 新規/コピーモードのキャラ変更確認(CHANGE-036)。dirty 時のみ発火し、
  // 確定で全体リセット・取消で revert(選択は basic.characterId 制御のため変更しないだけ)。
  const [pendingCharacterId, setPendingCharacterId] = useState<number | null>(
    null,
  );

  // 選択中キャラの moves を取得。キャラ変更で characterId が変わると自動で再取得される。
  const movesQ = useMovesByCharacter(basic.characterId);

  // 選択中キャラのキャラ固有状態定義(custom_states)を useCharacters の戻りから解決する(M11-01)。
  // 既存クエリ(queryKey ["characters",{gameId}])の戻りに customStates(raw 文字列)が含まれる。
  const { data: characters } = useCharacters();
  const customStateDefs = useMemo(
    () =>
      parseCustomStateDefs(
        characters?.find((c) => c.id === basic.characterId)?.customStates,
      ),
    [characters, basic.characterId],
  );
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [duplicateIssue, setDuplicateIssue] = useState<ValidationIssue | null>(
    null,
  );
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(
    null,
  );
  const [showKnockdownModal, setShowKnockdownModal] = useState(false);
  // 競合で保存が止まったときのモーダル(M22-04)。null = 出ていない。
  // ★入力を保持したまま表示する。ここが立っても basic / steps には触らない。
  const [conflictKind, setConflictKind] = useState<ConflictKind | null>(null);
  const [pendingCarryOptions, setPendingCarryOptions] = useState<SetupCarryOptionsInput | undefined>();
  const [setupsToCreate, setSetupsToCreate] = useState<CreateSetupInput[]>([]);
  const [linkedSetups, setLinkedSetups] = useState<SetupSummary[]>([]);

  // ★★M24-12: どの幅でも出すタブ。M24-04 は lg 未満だけに出していたが、幅による
  //   分岐は本サブで消えた(CHANGE-138 §2「lg 以上の枝をタブへ寄せる」)。
  //   ★機構そのものは M24-04 のまま——出し分けは CSS で行い、アンマウントしない。
  //   ★状態は保存しない(ブラウザストレージの新キーを作っていない)。
  const [activeTab, setActiveTab] = useState<ComboEditorTab>("basic");

  // ★★M24-04(CO-003): 離脱ガードの基準値。初回描画時の値がそのまま初期値になる
  //   ——上の 4 つの useState はいずれも遅延初期化子で initial から組んでおり、
  //   ここで initialBasic(...) を書き直すと second source of truth になる。
  // ★characterId は比較に入れない。既定キャラは characters の取得完了後に採り直される
  //   ことがあり(上の useEffect)、それは利用者の入力ではないため dirty にしてはならない。
  //   ★キャラ変更そのものは CHANGE-036 の確認ダイアログが受け持ち、確定するとフォームは
  //     初期状態へリセットされる。編集モードではそもそも変更できない。⇒ 落としても失うものは無い。
  const [dirtyBaseline, setDirtyBaseline] = useState<string>(() =>
    formDirtyKey(basic, steps, setupsToCreate, linkedSetups),
  );
  const currentDirtyKey = useMemo(
    () => formDirtyKey(basic, steps, setupsToCreate, linkedSetups),
    [basic, steps, setupsToCreate, linkedSetups],
  );
  const isUnsaved = currentDirtyKey !== dirtyBaseline;
  useUnsavedChangesGuard(isUnsaved);
  const { leaveTo, leaveBack } = useRequestLeave();
  // ★保存が済んだあとの遷移はこちらを通す（確認は出さないが番人の補正はする）。
  const { leaveTo: leaveAfterSaveTo } = useLeaveWithoutConfirm();
  // M23-09: 保存前の重複ダイアログ。★候補が空＝閉じている。
  const [trashCandidates, setTrashCandidates] = useState<DuplicateCandidate[]>(
    [],
  );
  const [checkingTrash, setCheckingTrash] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  // ★★再入ガード。ダイアログを挟むと押下から送信までの間が長くなり、その間は
  //   createMut.isPending が false のままなので disabled だけでは窓が閉じない(§4.6-3)。
  //   ★state ではなく ref である——同じイベントハンドラ内で読むため、state だと
  //     更新前の値を掴む。
  const saveInFlightRef = useRef(false);

  const { t } = useTranslation();
  const createMut = useCreateCombo();
  const createSetupLinkMut = useCreateSetupLink();
  const addPunishMut = useAddPunish();
  const patchMut = useUpdateComboMetadata(initial?.id ?? 0);
  const putMut = useUpdateComboWithKeyChange(initial?.id ?? 0);
  // M23-09: 保存前ダイアログの「ゴミ箱から復元する」。★復元 API は変えていない。
  const restoreMut = useRestoreCombo();
  const { handleCreateTag, creating: tagCreating } = useTagSelectorForm();

  const initialKey: ComboKeyFields | null = useMemo(
    () => (initial && mode === "edit" ? extractKeyFields(initial) : null),
    [initial, mode],
  );

  const autoStarterMoveId = useMemo(
    () => steps.find((s) => s.moveId != null)?.moveId ?? null,
    [steps],
  );

  // C-12: 始動技はレシピ先頭 move から自動確定に一本化(手動プルダウン廃止)。
  // 手動 basic.starterMoveId は参照せず、常に autoStarterMoveId(レシピ先頭)を送る。
  const effectiveStarterMoveId = autoStarterMoveId;

  // リアルタイム重複検知（M2-02 §4.2）
  const checkInput: CheckDuplicateInput | null = useMemo(() => {
    if (
      !isFormReadyForDuplicateCheck({
        characterId: basic.characterId,
        starterMoveId: effectiveStarterMoveId,
        position: nullIfEmpty(basic.position),
        opponentStance: nullIfEmpty(basic.opponentStance),
        hitType: nullIfEmpty(basic.hitType),
        opponentSize: nullIfEmpty(basic.opponentSize),
        steps,
      })
    ) {
      return null;
    }
    return {
      characterId: basic.characterId,
      starterMoveId: effectiveStarterMoveId,
      position: nullIfEmpty(basic.position),
      opponentStance: nullIfEmpty(basic.opponentStance),
      hitType: nullIfEmpty(basic.hitType),
      opponentSize: nullIfEmpty(basic.opponentSize),
      starterMeaty: basic.starterMeaty,
      steps: steps.map((s, i) => ({
        stepOrder: i + 1,
        moveId: s.moveId ?? null,
        modifiers: s.modifiers,
      })),
      excludeComboId: mode === "edit" ? initial?.id : undefined,
    };
  }, [basic, effectiveStarterMoveId, steps, mode, initial?.id]);

  // ★★保存前チェック(M23-09)の入力は checkInput を流用しない。
  //   checkInput は isFormReadyForDuplicateCheck で絞られており、状況 4 項が 1 つでも
  //   空だと null になる——あれは「入力のたびに叩く」リアルタイム検知が未完成のフォームで
  //   API を打たないための門であり、保存時の判定条件ではない。
  //   ★流用すると、状況を空のまま保存したコンボでダイアログが出ないのに VAL-C14 だけが
  //     保存後に出る(NULL 同士は一致するため)。⇒ 保存前と保存後で見えるものがずれる。
  const buildCheckDuplicateInput = (): CheckDuplicateInput => ({
    characterId: basic.characterId,
    starterMoveId: effectiveStarterMoveId,
    position: nullIfEmpty(basic.position),
    opponentStance: nullIfEmpty(basic.opponentStance),
    hitType: nullIfEmpty(basic.hitType),
    opponentSize: nullIfEmpty(basic.opponentSize),
    starterMeaty: basic.starterMeaty,
    steps: steps.map((s, i) => ({
      stepOrder: i + 1,
      moveId: s.moveId ?? null,
      modifiers: s.modifiers,
    })),
  });

  const { duplicates } = useCheckDuplicate(checkInput, {
    debounceMs: 300,
    enabled: !basic.isDraft,
  });

  const buildCreatePayload = (): CreateComboRequest => ({
    characterId: basic.characterId,
    isDraft: basic.isDraft,
    damage: parseOptInt(basic.damage),
    starterMoveId: effectiveStarterMoveId,
    position: nullIfEmpty(basic.position),
    // ★★M37-01: 利用者が入れた値をそのまま送る。★ここで導出しない ——
    //   区分とマス数が食い違って届いた場合はサーバの normalizePositionAndMass が
    //   マス数を優先して position を導出し直す(指示書 §0.2)。
    startPositionMass: parseOptInt(basic.startPositionMass),
    carryDistanceMass: parseOptInt(basic.carryDistanceMass),
    opponentStance: nullIfEmpty(basic.opponentStance),
    hitType: nullIfEmpty(basic.hitType),
    opponentSize: nullIfEmpty(basic.opponentSize),
    // ★M37-07: 重複判定キーであるため POST / PUT にだけ載る。
    //   buildPatchPayload には**足さない**(識別キーを変える編集は PUT へ行く)。
    starterMeaty: basic.starterMeaty,
    driveAvailableAtStart: parseOptFloat(basic.driveAvailableAtStart),
    saAvailableAtStart: parseOptInt(basic.saAvailableAtStart),
    driveDamage: parseOptFloat(basic.driveDamage),
    saGaugeConsumed: parseOptInt(basic.saGaugeConsumed),
    driveGaugeConsumed: parseOptFloat(basic.driveGaugeConsumed),
    knockdownAdvantage: parseOptInt(basic.knockdownAdvantage),
    memo: nullIfEmpty(basic.memo),
    // M17-01: メディア 3 フィールド(空入力=null=クリア)。
    link: nullIfEmpty(basic.link),
    videoPath: nullIfEmpty(basic.videoPath),
    imagePath: nullIfEmpty(basic.imagePath),
    situation: buildSituation(initial?.situation, basic.customStates, customStateDefs) ?? null,
    okiOptions: basic.okiOptions,
    okiVerified: basic.okiVerified,
    tagIds: basic.tagIds,
    steps: steps.map((s, i) => ({
      stepOrder: i + 1,
      moveId: s.moveId ?? null,
      modifiers: s.modifiers,
    })),
    setups: setupsToCreate.length > 0 ? setupsToCreate : undefined,
  });

  // 対象コンボを引数で受け取る。★既定値を置かない(M22-03 §4.4)。
  //
  // 旧実装は version: initial?.version ?? 0 だったが、combos.version は
  // NOT NULL DEFAULT 1 であり 0 の行は生成経路が無い。⇒ 0 を送れば必ず版不一致になる。
  // 既定値を 1 等へ差し替えるのは「必ず失敗する」を「静かに他人の編集を上書きしうる」
  // に変えるため採らない。呼び出し側(proceedSave)が initial の存在を確かめた位置から
  // 渡すことで、既定値そのものを不要にする。
  const buildPatchPayload = (target: ComboDetail): UpdateMetadataRequest => ({
    version: target.version,
    // ★★M29-02 §2.4: 仮登録フラグを送る。
    //
    //   着手前はここに isDraft が無く、hasKeyChanges も isDraft を見ていなかった
    //   (= PUT にも回らない)。サーバは IsDraft == nil を「不変更」として扱うため、
    //   ★編集モードでトグルを切り替えて保存すると「保存しました」が出て詳細画面へ
    //   遷移するのに is_draft は 1 ビットも変わらなかった。
    //   ⇒ これは §0.1 の「成功の自動断定」そのものである。
    //
    //   ★トグルを消す案は採らない —— M24-12 / D-582 が編集モードの最上部へ置くと
    //   決めており、E2E(m24-12-editor-rebuild)がその配置を固定している。
    //   在る操作を消すのではなく、在る操作が効くようにする。
    //
    //   ★昇格(仮→本)はサーバ側の promoting 分岐が全検証を再実行するため、
    //   VAL-C15(本登録の必須欄)を正しく通る。
    isDraft: basic.isDraft,
    damage: parseOptInt(basic.damage),
    driveAvailableAtStart: parseOptFloat(basic.driveAvailableAtStart),
    saAvailableAtStart: parseOptInt(basic.saAvailableAtStart),
    driveDamage: parseOptFloat(basic.driveDamage),
    saGaugeConsumed: parseOptInt(basic.saGaugeConsumed),
    driveGaugeConsumed: parseOptFloat(basic.driveGaugeConsumed),
    knockdownAdvantage: parseOptInt(basic.knockdownAdvantage),
    // ★★M37-01: PATCH でもマス数 2 欄を送る(2026-09-13 開発者裁定で契約を拡張した)。
    //   ★これが無いと、編集モードでマス数・運び量だけを直したときに値が黙って落ちる。
    //   ★キーは常に送るため、null は「NULL クリア」の意味になる(CHANGE-043 と同じ)。
    startPositionMass: parseOptInt(basic.startPositionMass),
    carryDistanceMass: parseOptInt(basic.carryDistanceMass),
    memo: nullIfEmpty(basic.memo),
    // M17-01: メディア 3 フィールド。memo と同じく空入力=null 送信=NULL クリア(CHANGE-043 トライステート)。
    link: nullIfEmpty(basic.link),
    videoPath: nullIfEmpty(basic.videoPath),
    imagePath: nullIfEmpty(basic.imagePath),
    // CHANGE-043: presence-detection 下では null=NULL クリアが効く(キーは常に送るため不在にはならない)。
    // custom_states を全 off にすると buildSituation が undefined → null 送信で旧値がクリアされる。
    situation: buildSituation(target.situation, basic.customStates, customStateDefs) ?? null,
    okiOptions: basic.okiOptions,
    okiVerified: basic.okiVerified,
    tagIds: basic.tagIds,
  });

  const onSave = () => {
    // ★★再入ガード(§4.6-3)。物理コントローラのショートカットと画面のボタンは同じ関数を
    //   呼ぶため、ここで止めれば両方に効く。handleConflictSaveAsNew のような
    //   「ダイアログから runCreate を直接呼ぶ」経路とも二重にならない。
    if (saveInFlightRef.current) return;

    setValidationResult(null);
    setDuplicateIssue(null);

    const payload = buildCreatePayload();
    const parsed = parseComboForm(payload);
    // ★★★M38-01 追補2(2026-09-18): VAL-C15 の門を**フロントから撤去した**。
    //   ⇒ 開始残量 2 欄は必須ではなくなり、空欄はそのまま NULL＝「不問」として保存される。
    //   ★着手前は features/combo/requiredPublished.ts が zod とは別に走っていた ——
    //     「不問を選んだ」と「空のまま」を payload では区別できず(どちらも null)、
    //     フォーム state だけが区別を持っていたためである。**その区別を諦めたので門も消えた**
    //     (開発者裁定＝「空欄と NULL の状態がわかりにくい」)。
    //   ⇒ 判定は zod だけに戻った。必須は damage / knockdownAdvantage の 2 欄である。
    if (!parsed.success) {
      const issues: ValidationIssue[] = parsed.error.issues.map((i) => ({
        code: "CLIENT",
        severity: "error" as const,
        // ★★M24-04: 生のフィールド名のまま持つ。日本語の呼び名は表示側
        //   (ValidationDisplay の fieldLabel)で付ける——タブの振り分けが
        //   同じ値を見るため、ここで書き換えると照合できなくなる。
        field: i.path.map(String).join("."),
        message: i.message,
      }));
      setValidationResult({ issues });
      toast.error("入力内容に誤りがあります。");
      return;
    }

    // copy/new → 常に POST。edit → hasKeyChanges で PATCH/PUT を分岐。
    if (mode === "new" || mode === "copy") {
      void runCreateWithTrashCheck();
      return;
    }

    // M4-03: knockdownAdvantage 変更 + 紐付きセットプレイあり → 確認モーダル
    const existingSetups = initial?.setups ?? [];
    if (existingSetups.length > 0 && !pendingCarryOptions) {
      const oldKA = initial?.knockdownAdvantage ?? null;
      const newKA = parseOptInt(basic.knockdownAdvantage);
      if (oldKA !== newKA) {
        setShowKnockdownModal(true);
        return;
      }
    }

    proceedSave(pendingCarryOptions);
  };

  const proceedSave = (setupCarryOptions?: SetupCarryOptionsInput) => {
    if (initial && initialKey) {
      const currentKey: ComboKeyFields = {
        characterId: basic.characterId,
        starterMoveId: effectiveStarterMoveId,
        position: nullIfEmpty(basic.position),
        opponentStance: nullIfEmpty(basic.opponentStance),
        hitType: nullIfEmpty(basic.hitType),
        opponentSize: nullIfEmpty(basic.opponentSize),
        starterMeaty: basic.starterMeaty,
        steps,
      };
      if (hasKeyChanges(initialKey, currentKey)) {
        setPendingCarryOptions(setupCarryOptions);
        setShowPutConfirm(true);
        return;
      }
      // ★initial はこのブロックで存在が確定している。そのまま渡すことで
      //   buildPatchPayload 側に version の既定値が要らなくなる(M22-03 §4.4)。
      runPatch(initial, setupCarryOptions);
      return;
    }
    runCreate();
  };

  const handleKnockdownConfirm = (options: SetupCarryOptionsInput) => {
    setShowKnockdownModal(false);
    setPendingCarryOptions(options);
    proceedSave(options);
  };

  // 保存後の遷移先(M24-01 §4.4 / SM-084)。
  //
  // ★新規登録だけ一覧へ返す。編集(mode === "edit")の遷移先は変えない
  //   ——SM-084 は「新規登録の」遷移先だけを言っている。
  // ★mode === "copy" も現行どおり詳細へ返す(2026-08-25 開発者判断で確定)。
  //   コピーは元から値が入っている分、入力ミスに気づきにくい。まず 1 件を詳細で
  //   確かめられるようにする。SM-084 の memo も「新規登録の」遷移先しか言っていない。
  // ★戻り先の一覧が「いま保存したコンボのキャラ」を対象にしていること(§4.4)は、
  //   既定キャラ解決の段 1(URL クエリ)で成立させる。段 2 の sessionStorage 経由に頼らない
  //   ——一覧側が URL を空で開いたときにしか復元しないため、確実なのは段 1 である。
  const saveDestination = (data: Combo): string => {
    if (mode !== "new") return `/combos/${data.id}`;
    const characterId = data.characterId ?? basic.characterId;
    return `/combos?character_id=${characterId}`;
  };

  // 保存後の警告ダイアログが案内する遷移先の呼び名。遷移先そのものから導く。
  //
  // ★遷移先は 3 通りある(M24-01 レビュー 高-2)。2 分岐にすると、確定反撃サーチから
  //   登録して警告が付いたとき「詳細画面へ移動しますか?」と言いながら
  //   /punish/search へ飛ぶ——固定文言だった頃と同じ失効した記述に戻る。
  const pendingNavigateLabel = !pendingNavigateTo
    ? "次の画面"
    : pendingNavigateTo.startsWith("/combos?")
      ? "一覧"
      : pendingNavigateTo.startsWith("/combos/")
        ? "詳細画面"
        : "元の画面";

  const handleSaveSuccess = (data: Combo, implicitCarry = false) => {
    setValidationResult(data.validations ?? null);
    // ★★M24-04(CO-003): 保存が成功したら dirty を落とす。落とさないと保存直後の遷移で
    //   毎回「保存していない変更があります」が出て、機能そのものが邪魔になる。
    // ★警告つきで留まる分岐(pendingNavigateTo)でも保存自体は成立しているため、
    //   data.id の検査より前に落とす。
    setDirtyBaseline(formDirtyKey(basic, steps, setupsToCreate, linkedSetups));
    if (!data.id) return;
    // 確定反撃サーチからの遷移なら元の位置へ復帰する(登録したコンボが孫に現れる)。
    const dest = returnTo ?? saveDestination(data);
    const hasWarning = data.validations?.issues?.some((i) => i.severity === "warning") ?? false;
    if (hasWarning) {
      setPendingNavigateTo(dest);
    } else {
      const linkedCount = initial?.setups?.length ?? 0;
      if (implicitCarry && linkedCount > 0) {
        toast.success(
          `紐づくセットプレイ ${linkedCount} 件を引き継ぎました。必要に応じて内容を確認してください。`,
        );
      } else if (punishContext && isPunishRegistration) {
        // 確定反撃サーチ経由の登録。どの相手技(と始動技)向けに反映されたか見失わないよう明示する。
        toast.success(
          punishContext.starterLabel
            ? `「${punishContext.opponentLabel}」への確定反撃を登録しました(始動技: ${punishContext.starterLabel})`
            : `「${punishContext.opponentLabel}」への確定反撃を登録しました`,
        );
      } else if (punishContext) {
        toast.success(
          `「${punishContext.opponentLabel}」向けのコンボを保存しました。確定反撃への採用は探す画面で行えます`,
        );
      } else {
        toast.success("保存しました");
      }
      // ★保存が済んだあとの遷移は番人の補正を通す。通さないと履歴に編集画面の
      //   複製が 1 枚残り、戻るを 1 回多く押すことになる。
      leaveAfterSaveTo(dest);
    }
  };

  // ★★M24-12: 保存(POST)は成功したが、後続の紐付け(既存セットプレイ / 確定反撃)で
  //   落ちた経路。handleSaveSuccess を通らないため、dirty を落とすのも番人の補正も
  //   ここで行う必要がある。
  //   ★★素の navigate を書くと「離れたつもりで編集画面自身へ戻る」状態になる——
  //     ガードはブラウザ履歴に 1 枚積んでおり、離脱はその 1 枚ぶんの補正を要する
  //     (DES-005 §5.7)。しかも dirty が落ちていないため確認ダイアログまで出る。
  //   ★M24-04 の手動確認で出た欠陥(④-1)と同型である。当時は保存の正常系だけが
  //     直され、この 3 経路は残っていた(既存のテストが 1 本も踏んでいない)。
  const leaveAfterPartialFailure = (dest: string) => {
    setDirtyBaseline(formDirtyKey(basic, steps, setupsToCreate, linkedSetups));
    leaveAfterSaveTo(dest);
  };

  // ★★runCreateWithTrashCheck は「保存ボタンを押したとき」に 1 回だけチェックを叩き、
  //   ゴミ箱に一致があればダイアログを出す(§4.2-1＝入力中には出さない)。
  //
  // ★仮登録では走らせない。VAL-C14 / VAL-S07 は仮登録では判定されないため
  //   (DES-006 §2.3 / CHANGE-125)、走らせると「保存後には出ない警告が保存前だけ出る」
  //   非対称になる。既存のリアルタイム警告も enabled: !isDraft で同じ線を引いている。
  //   ★推測: 指示書は仮登録の扱いを明示していないため、VAL-C14 の先例へ揃えると仮定した。
  const runCreateWithTrashCheck = async () => {
    if (basic.isDraft) {
      runCreate();
      return;
    }
    setCheckingTrash(true);
    const result = await checkComboTrashDuplicates(buildCheckDuplicateInput(), t);
    setCheckingTrash(false);

    // ★チェックが失敗しても保存を止めない(§4.2-3)。ダイアログを出さなかったので
    //   保存後トーストは従来どおり出す(＝抑制しすぎない・§4.5-2)。
    if (!result.ok || result.deleted.length === 0) {
      runCreate();
      return;
    }
    setRestoreFailed(false);
    setTrashCandidates(result.deleted);
  };

  // ★★suppressSaveWarnings は引数で渡す。state で持ってはならない——
  //   「新しく作る」は setState と runCreate を同じイベントハンドラで行うため、
  //   state だと runCreate が捉えるのは更新前の値になり抑制が効かない。
  const runCreate = (opts?: { suppressSaveWarnings?: boolean }) => {
    const suppressSaveWarnings = opts?.suppressSaveWarnings ?? false;
    saveInFlightRef.current = true;
    createMut.mutate(buildCreatePayload(), {
      onSuccess: async (data) => {
        // M23-05 §4.6: ゴミ箱に同じものがある(VAL-C14)。★登録は成功しているので、
        // 遷移や完了トーストを止めずに併せて出す。★モーダルにしない(DES-006 §11.2 は
        // ERROR の見せ方であり、本警告は ERROR ではない)。
        // ★0 件のときはキー自体が無い。空配列で来ることはない(M23-04 §4.3-2)。
        // ★M23-09 §4.5: ダイアログで既に告げた重複は、保存後にもう一度告げない。
        //   ★落とすのは VAL-C14 / VAL-S07 だけである。warnings を丸ごと捨てないこと——
        //     未知のコードが足されたときに画面が何も出さなくなる。
        const saveWarnings = suppressSaveWarnings
          ? dropAcknowledgedTrashDuplicates(data.warnings ?? [])
          : (data.warnings ?? []);
        if (saveWarnings.length > 0) {
          toast.warning(
            t("trash.warning.savedWithWarnings", {
              warnings: formatSaveWarnings(saveWarnings, t),
            }),
          );
        }
        if (data.id && linkedSetups.length > 0) {
          try {
            for (const setup of linkedSetups) {
              await createSetupLinkMut.mutateAsync({
                setupId: setup.id,
                comboId: data.id,
              });
            }
          } catch {
            toast.error(
              "コンボは作成されましたが、既存セットプレイの紐付けに失敗しました。詳細画面から再度紐付けてください。",
            );
            leaveAfterPartialFailure(`/combos/${data.id}`);
            return;
          }
        }
        if (
          data.id &&
          punishOpponentMoveId != null &&
          punishSelfCharacterId != null
        ) {
          if (
            basic.characterId !== punishSelfCharacterId ||
            data.characterId !== punishSelfCharacterId
          ) {
            toast.warning(
              "コンボは保存されましたが、キャラクターが検索条件と異なるため確定反撃には登録しませんでした。",
            );
            leaveAfterPartialFailure(`/combos/${data.id}`);
            return;
          }
          try {
            await addPunishMut.mutateAsync({
              comboId: data.id,
              opponentMoveId: punishOpponentMoveId,
            });
          } catch {
            toast.error(
              "コンボは保存されましたが、確定反撃の紐づけに失敗しました。コンボ詳細から内容を確認してください。",
            );
            leaveAfterPartialFailure(`/combos/${data.id}`);
            return;
          }
        }
        handleSaveSuccess(data);
      },
      onError: (err) => handleError(err),
      onSettled: () => {
        saveInFlightRef.current = false;
      },
    });
  };

  // M23-09: ダイアログの 3 つの選択肢。
  const handleTrashRestore = (id: number) => {
    setRestoreFailed(false);
    restoreMut.mutate(id, {
      onSuccess: (restored) => {
        setTrashCandidates([]);
        // ★復元応答の警告を捨てない(VAL-R01 / VAL-R03 / VAL-C08 等)。既存の復元導線
        //   4 か所(TrashListRow / TrashSetupListRow / TrashComboDetailPage /
        //   TrashBulkActions)と同じ形へ揃える——警告があるときは 1 枚に畳み、
        //   完了と警告で 2 枚出さない(M23-06 §4.6-1)。
        // ★★このダイアログ経路では VAL-R03 が実際に起きうる。応答の duplicates
        //   (生きた側)が非空のまま復元すれば必ず発火する。握り潰すと、利用者は
        //   「重複が並んだこと」を知る手段を失う。
        const restoreWarnings = restored.warnings ?? [];
        if (restoreWarnings.length > 0) {
          toast.warning(
            t("trash.warning.restoredWithWarnings", {
              warnings: formatRestoreWarnings(restoreWarnings, t),
            }),
          );
        } else {
          toast.success(t("trash.warning.restored"));
        }
        // ★復元して詳細画面へ行く。編集画面へは行かない(§4.3-3)——復元したものと
        //   いま入力した内容は違いうるため、まず「戻したものを見る」機会を与える。
        navigate(`/combos/${restored.id ?? id}`);
      },
      // ★★失敗してもダイアログを閉じない(§4.9)。閉じると「新しく作る」も
      //   「戻って編集を続ける」も消え、利用者の手元に導線が 1 つも残らない。
      onError: () => setRestoreFailed(true),
    });
  };

  const handleTrashCreateNew = () => {
    setTrashCandidates([]);
    // ★引数で渡す。state 経由にすると更新前の値を掴む(runCreate の godoc 参照)。
    runCreate({ suppressSaveWarnings: true });
  };

  // ★閉じるだけ。フォームの state には触れない(§4.6-2＝キャンセルで入力が失われない)。
  const handleTrashCancel = () => {
    setTrashCandidates([]);
    setRestoreFailed(false);
  };

  const runPatch = (
    target: ComboDetail,
    setupCarryOptions?: SetupCarryOptionsInput,
  ) => {
    patchMut.mutate(
      { ...buildPatchPayload(target), setupCarryOptions },
      {
        onSuccess: (data) => handleSaveSuccess(data, false),
        onError: (err) => handleError(err),
      },
    );
  };

  const runPut = () => {
    setShowPutConfirm(false);
    if (!initial) return;
    const implicitCarry = !pendingCarryOptions && (initial?.setups?.length ?? 0) > 0;
    const payload = {
      ...buildCreatePayload(),
      version: initial.version,
      setupCarryOptions: pendingCarryOptions,
    };
    putMut.mutate(payload, {
      onSuccess: (data) => handleSaveSuccess(data, implicitCarry),
      onError: (err) => handleError(err),
    });
  };

  // 「読み込み直す」の実処理(M22-04 §4.3-3)。★2 段目の確認を通ったときだけ呼ばれる。
  //
  // ★フォーム state の部分的な作り直しではなく、画面ごと読み込み直す。理由——
  //   本コンポーネントの初期化は useState の遅延初期化(initialBasic / initial.steps /
  //   linkedSetups …)に散っており、「読み込み直し用の再初期化」を別に書くと
  //   初期化経路が 2 本になって必ずドリフトする(E-76)。読み込み直しは
  //   利用者が入力の消失を承知して選んだ操作であり、部分的に残す意味も無い。
  const handleConflictReload = () => {
    setConflictKind(null);
    window.location.reload();
  };

  // ★【追補・M22-04 §4.7.2-1】404 のときに「保存する道」を出す。
  //
  // ★★これは上書きの道ではない。旧行はもう無いのだから、誰の編集も壊さない——
  //   別の行を新しく作るだけである。⇒ 上書きの道を出さないと決めた §4.4 案 (A) とも
  //   FR501(誤上書きの防止)とも矛盾しない。
  //   ★この一文を消さないこと。書かないと、次の担当が「案 (A) に反する」と読んで削る。
  //
  // ★重複(VAL-C02)になったら、新しい見せ方は作らず既存の DuplicateWarning へ落ちる
  //   (§4.7.3)。runCreate の onError → handleError → validation 分岐がそれを行う。
  //   ⇒ そのためにモーダルを先に閉じる(閉じないと重複の表示が裏に隠れる)。
  const handleConflictSaveAsNew = () => {
    setConflictKind(null);
    runCreate();
  };

  // ★【追補・M22-04 §4.7.2-2】最小の脱出路。「新しく登録する」を選ばない利用者に要る。
  const handleConflictGoToList = () => {
    setConflictKind(null);
    navigate("/combos");
  };

  // 保存が拒否されたときの見せ方(M22-04 §4.1〜§4.3)。
  //
  // ★★ここでフォームの state を触らないこと。競合は「利用者が時間をかけて何かを
  //   書いたあと」に起き、保存を押すまで気づかない。⇒ 「安全側に倒す」つもりの
  //   自動再読込・自動リセットが、そのまま作業の消失になる(§4.1-1・§4.1-2)。
  //   読み込み直すかどうかは、2 段階の確認を経て利用者が決める。
  //
  // ★分岐はエラーコードで行う(classifySaveError)。ステータス 409 で分けてはならない。
  const handleError = (err: unknown) => {
    const parsed = classifySaveError(err);

    if (isConflictDialogKind(parsed.kind)) {
      setConflictKind(parsed.kind);
      return;
    }
    if (parsed.kind === "validation" && parsed.validations) {
      setValidationResult(parsed.validations);
      const dup = parsed.validations.issues.find(
        (i) => i.code === "VAL-C02" && i.severity === "error",
      );
      if (dup) {
        setDuplicateIssue(dup);
      }
      toast.error("保存できませんでした。");
      return;
    }
    // ★サーバ由来のメッセージだけを出す。通信断など API 応答が無い経路
    //   (fetch が TypeError を投げる)では parsed.code が null になり、
    //   そのまま出すと "Failed to fetch" が利用者へ出る。
    toast.error(
      parsed.code !== null ? parsed.message! : "通信エラーが発生しました。",
    );
  };

  // ★★「押せない条件」と「保存中の表示」は別物である。分けること。
  //   ダイアログが開いて利用者の選択を待っている間、保存は押せないが**何も保存していない**。
  //   同じ式をラベルにも使うと、保存ボタンが「保存中...」と嘘をつく。
  //   ⇒ 本サブは「文面が実装のしないことを言っていないか」を主題に置いたサブであり、
  //     この 1 語もその規律にそのまま当たる(SetupEditorPage.tsx と同じ作法へ揃える)。

  // isSavingNow は「実際に送信中」だけ。保存ボタンのラベルはこちらを見る。
  const isSavingNow =
    createMut.isPending ||
    patchMut.isPending ||
    putMut.isPending ||
    createSetupLinkMut.isPending ||
    addPunishMut.isPending;

  // ★M23-09 §4.6: 保存前チェックの待ちとダイアログ表示中も「保存できない」に含める。
  //   定義はここ 1 か所であり、画面の保存ボタンと物理コントローラの canSave が同じ式を見る。
  const isMutating = checkingTrash || trashCandidates.length > 0 || isSavingNow;

  // ★★M24-13(CHANGE-139): レシピのステップが 0 本なら保存できない。
  //   BE も VAL-C09 を仮登録へ適用したため、押せてもサーバが 400 を返す。
  //   ★数えるのはステップの本数だけである。move_id の中身は見ない
  //     ——技が未指定のステップも非技ステップも 1 本として数える(VAL-D02 は不変)。
  //   ★★タブ依存にしない。どちらのタブに居てもレシピ未入力は同じ事実であり、
  //     タブ条件を足すと「レシピタブへ行けば保存できる」＝M24-12 §4.5 が禁じた形になる。
  //   ★★仮登録トグルでも分岐しない。本登録でも仮登録でも 0 本は保存できない。
  const saveBlockedReason =
    steps.length === 0 ? SAVE_BLOCKED_EMPTY_RECIPE : null;
  // ★押せる条件もここ 1 か所である(上記 isMutating と同じ規律)。
  const canSaveNow = !isMutating && saveBlockedReason === null;

  // ★★M24-04(SM-148): 保存に失敗したとき、エラーが「今見ていないタブ」に在ることが
  //   分かるようにする(落とせない条件)。エラーのリスト本体は下に据え置いたまま、
  //   タブの見出しに件数を出す。
  const tabErrorCounts = useMemo(
    () => countErrorsByTab(validationResult?.issues),
    [validationResult],
  );

  // キャラクター変更ハンドラ(CHANGE-036 / DES-005 §5.7)。
  // dirty(入力あり)なら確認ダイアログを開き、未入力なら無確認で切替。編集モードは
  // ComboEditorCharacterField 側で固定表示のため本ハンドラは呼ばれない。
  const handleCharacterChange = (nextCharacterId: number) => {
    if (nextCharacterId === basic.characterId) return;
    // ★利用者が触れた時点で自動採用を止める(上の useEffect を参照)。
    characterTouchedRef.current = true;
    if (isFormDirty(basic, steps, setupsToCreate, linkedSetups)) {
      setPendingCharacterId(nextCharacterId);
      return;
    }
    applyCharacterChange(nextCharacterId);
  };

  // 「変更して入力を破棄」: フォーム全体を新キャラの新規初期状態へリセット。
  const applyCharacterChange = (nextCharacterId: number) => {
    setBasic(initialBasic(undefined, nextCharacterId));
    setSteps([]);
    setSetupsToCreate([]);
    setLinkedSetups([]);
    setValidationResult(null);
    setDuplicateIssue(null);
    setPendingCharacterId(null);
  };

  const confirmCharacterChange = () => {
    if (pendingCharacterId != null) applyCharacterChange(pendingCharacterId);
  };

  // 「キャンセル」: 変更取消。選択は basic.characterId 制御のため state を変えなければ
  // プルダウン表示は自動で変更前へ戻る(revert)。
  const cancelCharacterChange = () => {
    setPendingCharacterId(null);
  };

  // キャンセル: 確定反撃サーチからの遷移なら同じ戻り先へ、無ければ従来どおり履歴を戻る。
  // ★M24-04(CO-003): リンクではなくボタンなので click キャプチャには掛からない。
  //   離脱ガードを通して確認を挟む(未保存の変更が無ければそのまま遷移する)。
  // ★★行き先の形で渡す——ガードが積んだ番人の履歴エントリぶんを補正できるのは
  //   「どこへ」か「戻る」かが分かっているときだけである(任意の関数は預けられない)。
  const handleCancel = () => {
    if (returnTo) {
      leaveTo(returnTo);
    } else {
      leaveBack();
    }
  };

  return (
    <div className="space-y-4">
      {/* C-09: 最上部キャンセル導線。C-15 + M15-05 追補: 新規/コピーは仮登録トグル(Switch)を
          同一行に併置して縦を圧縮する。
          ★★M24-12(§4.10・D-582): **編集モードも最上部へ統一する**。
            `DES-005` §5.7 項目3 の「編集モードは本位置(基本情報フィールド群の末尾)を維持」を
            撤回した。★撤回の理由は「開発者がそう言ったから」ではない——**元の規則は
            「最上部の『← キャンセル』導線と同一行に置く」であり、編集モードにはその相手が
            無かったから末尾に残していた。本サブでタブ化した結果、最上部の行構成そのものが
            変わり、根拠が消えた**(指示書 §4.10.1)。 */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm text-blue-600 hover:underline"
        >
          ← キャンセル
        </button>
        {/* ★M24-12: モードによる分岐を消した(上のコメント)。 */}
        <ComboDraftToggleField
          inline
          checked={basic.isDraft}
          onChange={(checked) => setBasic({ ...basic, isDraft: checked })}
        />
      </div>

      <ComboEditorCharacterField
        characterId={basic.characterId}
        mode={mode}
        onChange={handleCharacterChange}
        lockedReason={
          isPunishSearchContext ? PUNISH_SEARCH_LOCK_REASON : undefined
        }
      />

      {/* ★M24-08 第 2 部 C(SM-068): 判定に使わない項目を渡し、遷移しなくても
          「どこが差分か」が読めるようにする。判定キーとレシピは一致が確定しているため、
          差が出うるのはここに渡した項目だけである。 */}
      <DuplicateRealtimeWarning
        duplicates={duplicates}
        moves={movesQ.data ?? []}
        draft={{
          memo: basic.memo,
          damage: basic.damage,
          driveDamage: basic.driveDamage,
          saGaugeConsumed: basic.saGaugeConsumed,
          driveGaugeConsumed: basic.driveGaugeConsumed,
          knockdownAdvantage: basic.knockdownAdvantage,
          tagIds: basic.tagIds,
        }}
      />

      {/* ★★M24-12(CHANGE-138): 幅による分岐を消し、どの幅でも 2 タブにする。
          - タブ 1 …… 基本情報 / キャラ固有状態 / 起き攻め / その他情報
          - タブ 2 …… レシピ / セットプレイ
          ★M24-04 は「lg 未満だけタブ / lg 以上は 2 カラム ＋ メタデータを隠す」で
            着地していた。理由は E2E の被害範囲だったが、本サブはその被害を承知の
            うえで踏み込む(D-580)。「メタデータを隠す」は役割が消えたので撤去した
            ——タブに分けた時点でレシピタブは全幅であり、SM-118 の要求
            「隠したぶん、もう一方が広がってほしい」は満たされる。
          ★★DOM は 1 つで、出し分けは CSS で行う——タブを切り替えても入力は
            アンマウントされないため、原理的に消えない(M24-04 の機構のまま)。 */}
      <div
        role="tablist"
        aria-label="コンボ入力の切り替え"
        className="flex gap-1 border-b-2 border-gray-200"
      >
        {COMBO_EDITOR_TABS.map((tab) => {
          const active = activeTab === tab;
          const errorCount = tabErrorCounts[tab];
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`combo-editor-tab-${tab}`}
              aria-selected={active}
              aria-controls={`combo-editor-panel-${tab}`}
              data-testid={`combo-editor-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "-mb-0.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm font-medium",
                active
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-transparent text-gray-500",
              )}
            >
              {COMBO_EDITOR_TAB_LABEL_JA[tab]}
              {errorCount > 0 && (
                <span
                  data-testid={`combo-editor-tab-errors-${tab}`}
                  className="ml-1.5 inline-block rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
                >
                  {errorCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ★★M24-12: 常に 1 カラム。M15-05 の非対称 2 カラム(lg:grid-cols-[5fr_7fr])は
          撤去した——レシピは非常に長くなることがあり、2 カラムと相性が悪い
          (開発者逐語・D-578)。タブで割ったぶん、どちらの面も全幅を使える。 */}
      <div className="grid grid-cols-1 gap-4">
        <div
          role="tabpanel"
          id="combo-editor-panel-basic"
          // ★aria-labelledby ではなく aria-label である——タブ見出しは M24-04 当時
          //   lg 以上で隠れており、隠れた要素を参照するラベルは読み上げに乗らなかった。
          //   ★M24-12 で見出しは常に出るようになったが、aria-label のままにしてある
          //     ——読み上げ結果は変わらず、変える理由が無い。
          aria-label={COMBO_EDITOR_TAB_LABEL_JA.basic}
          data-testid="combo-editor-panel-basic"
          className={activeTab === "basic" ? "" : "hidden"}
        >
          <ComboEditorBasicFields
            value={basic}
            customStateDefs={customStateDefs}
            onChange={setBasic}
            onCreateTag={handleCreateTag}
            tagCreating={tagCreating}
            hitTypeLockedReason={
              isPunishSearchContext ? PUNISH_SEARCH_LOCK_REASON : undefined
            }
            // ★★M24-12(§4.10): 末尾配置は廃止。最上部の 1 個に統一した。
            showDraftToggle={false}
            // ★M24-12: メモ欄の直後に置く「レシピへ」ボタンの行き先。
            //   ★★順送りが末尾を越えたときに自動で移る形は**採っていない**——
            //     開発者の逐語は「タブのみ。あるいは普通にクリックでレシピ遷移の
            //     ボタンを押す。」(D-578(5)) であり、自動遷移は求められていない。
            //     そもそも末尾はメモ欄で順送りを無効にしてあるため到達しない。
            onGoToRecipe={() => setActiveTab("recipe")}
          />
        </div>

        <div
          role="tabpanel"
          id="combo-editor-panel-recipe"
          aria-label={COMBO_EDITOR_TAB_LABEL_JA.recipe}
          data-testid="combo-editor-panel-recipe"
          className={cn("space-y-4", activeTab === "recipe" ? "" : "hidden")}
        >
          <RecipeBuilder
            characterId={basic.characterId}
            steps={steps}
            moves={movesQ.data ?? []}
            movesLoading={movesQ.isLoading}
            onChange={setSteps}
            // 物理コントローラのショートカットから保存する入口(M21-04 §4.2 の 3)。
            // ★画面の保存ボタンと同じ関数・同じ活性条件を渡す。検証もエラー表示も遷移も
            //   onSave の内側が持っており、物理側では作り直さない。
            onSave={onSave}
            canSave={canSaveNow}
          />

          {(mode === "new" || mode === "copy") && (
            <SetupRegistrationSection
              value={setupsToCreate}
              onChange={setSetupsToCreate}
              characterId={basic.characterId}
              knockdownAdvantage={parseOptInt(basic.knockdownAdvantage)}
              linkedSetups={linkedSetups}
              onLinkedSetupsChange={setLinkedSetups}
              moves={movesQ.data ?? []}
            />
          )}
        </div>
      </div>

      <ValidationDisplay
        result={validationResult ?? undefined}
        fieldLabel={fieldLabel}
      />

      {/*
        ★★M24-13: 押せない理由の置き場。
          `disabled` なボタンはフォーカスを受けないため、ボタン自身に説明を持たせても
          キーボードの順送りでは読めない。⇒ 理由の側を順送りの停止点にし
          (tabIndex=0)、保存ボタンの**直前**に置く(指示書 §3.3-6 / §4.3)。
          ★エラーのリスト本体(ValidationDisplay)の位置は変えていない。
        ★★live region の器は常設する(レビュー 低-3)——
          aria-live は「その領域が DOM に在る状態で中身が変わったとき」に読まれる。
          器ごと出現させると初回の読み上げが起きない実装がある。
          ★器には test-id を付けない。中身の有無を toHaveCount で見ている spec が
            あるためである。
      */}
      {/* ★理由が無いときは箱ごと隠す(レビュー 2 回目 低-D)——ルートが space-y-4 で
          あるため、空の箱が残ると保存ボタン行の上に 1 行ぶんの余白が増える。
          ★`display:none` でも要素は DOM に在り続けるので、live region の器を
            常設する目的(初回の読み上げ)は損なわれない。 */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {saveBlockedReason && (
          <p
            id={SAVE_BLOCKED_REASON_ID}
            data-testid="combo-editor-save-blocked-reason"
            tabIndex={0}
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {saveBlockedReason}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {mode === "edit" && initial?.isDraft && (
          <PromoteToFinalButton
            combo={initial}
            // ★★M24-12(レビュー 高-4): 本登録への昇格は PATCH による**保存**である。
            //   ⇒ 保存後の遷移として dirty を落とし、離脱ガードの補正を通す
            //     (DES-005 §5.7「保存後の遷移も補正を通すこと」)。
            //   ★素の navigate だと番人のエントリが残り、戻るを 1 回多く押すことになる。
            //   ★PromoteToFinalButton 側には触っていない。
            onPromoted={(updated) =>
              leaveAfterPartialFailure(`/combos/${updated.id}`)
            }
            onValidationError={setValidationResult}
          />
        )}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isMutating}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          // ★★M24-13: レシピ 0 本でも**ボタンは消さない**(D-582)。消すと理由が
          //   伝わらず、M24-12 のキーボード順送りの経路そのものが消える。
          disabled={!canSaveNow}
          aria-describedby={
            saveBlockedReason ? SAVE_BLOCKED_REASON_ID : undefined
          }
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSavingNow ? "保存中..." : "保存"}
        </button>
      </div>

      <KnockdownAdvantageChangeModal
        open={showKnockdownModal}
        linkedSetups={initial?.setups ?? []}
        onConfirm={handleKnockdownConfirm}
        onOpenChange={(open) => { if (!open) setShowKnockdownModal(false); }}
      />

      <PutConfirmDialog
        open={showPutConfirm}
        onOpenChange={(open) => { if (!open) setShowPutConfirm(false); }}
        onConfirm={runPut}
      />

      {/* 保存前の重複ダイアログ(M23-09)。★候補が 0 件では開かない。
          ★ここに置くのは、下の ConflictDialog のコメント(M22-04)から離すためでもある——
            間に挟むと、あのコメントが本部品の説明として読める位置に来る。 */}
      <PreSaveDuplicateDialog
        candidates={trashCandidates}
        kind="combo"
        busy={createMut.isPending || restoreMut.isPending}
        restoreFailed={restoreFailed}
        onRestore={handleTrashRestore}
        onCreateNew={handleTrashCreateNew}
        onCancel={handleTrashCancel}
      />

      {/* 競合で保存が止まったときの導線(M22-04 §4.3)。
          ★「ほかの人の内容を見る」は既存のコンボ詳細画面を別枠で開いて代替する
            (差分の自動提示は作らない = D-415)。
          ★404 のときは旧行がもう無いため、見る先も読み込み直す先も無い。
          ★★その代わりに「この内容で新しく登録する」と「コンボ一覧へ」を出す(§4.7.2)。
            初版はここを「閉じる」だけにしており、利用者が入力を抱えたまま保存する道を
            失っていた。⇒ 選択肢が 0 になる形を作らないこと。 */}
      <ConflictDialog
        open={conflictKind !== null}
        kind={conflictKind ?? "versionConflict"}
        resource="combo"
        viewTheirsHref={
          conflictKind === "versionConflict" && initial ? `/combos/${initial.id}` : null
        }
        onReload={
          // ★`initial` の有無を viewTheirsHref と揃える。読み込み直す先が無い状態で
          //   導線だけ出すと、押した瞬間に入力が全部消えて何も戻らない。
          conflictKind === "versionConflict" && initial ? handleConflictReload : null
        }
        onSaveAsNew={
          // ★404 のときだけ出す。版不一致では旧行が生きており、「読み込み直す」と
          //   「ほかの人の内容を見る」の 2 本が既に進む道として在るため、
          //   ここで別の行を新しく作らせる必要が無い(選択肢を増やすだけになる)。
          //   ★「必ず重複になるから」ではない——キー項目を変えていれば重複しない。
          conflictKind === "notFound" ? handleConflictSaveAsNew : null
        }
        onGoToList={conflictKind === "notFound" ? handleConflictGoToList : null}
        onClose={() => setConflictKind(null)}
      />

      <CharacterChangeConfirmDialog
        open={pendingCharacterId !== null}
        onOpenChange={(open) => { if (!open) cancelCharacterChange(); }}
        onConfirm={confirmCharacterChange}
        onCancel={cancelCharacterChange}
      />

      <DuplicateWarning
        open={duplicateIssue !== null}
        issue={duplicateIssue}
        onOpenChange={(open) => { if (!open) setDuplicateIssue(null); }}
      />

      {pendingNavigateTo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="warning-confirm-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
        >
          {/* ★本ダイアログは共有プリミティブ（`components/ui/dialog`）を通らない自作である。
              ⇒ 「モーダルが開いている間は物理入力を受け手へ配送しない」（`DES-005` §6.4.3
              項目 4″）に自分で参加する必要がある。
              ★★**本ファイルはレシピ入力面（`RecipeBuilder`）と同じツリーに居る。** 参加しないと、
              このダイアログを表示している最中に技ボタンを押すと**裏のレシピにステップが入る**
              ——`D-383` の欠陥がそのまま残る。**M21-07 のレビューで実際に検出された。** */}
          <ModalPresenceMarker />
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-4 py-3">
              <h2
                id="warning-confirm-title"
                className="text-base font-semibold text-yellow-700"
              >
                保存完了 — 警告があります
              </h2>
            </div>
            <div className="px-4 py-4">
              <ValidationDisplay
                result={validationResult ?? undefined}
                fieldLabel={fieldLabel}
              />
              <p className="mt-3 text-sm text-gray-700">
                {/* M24-01 §4.4: 新規登録の遷移先が一覧になったため、文面を遷移先から導く。
                    ★固定文言のままだと「詳細へ移動」と言いながら一覧へ飛ぶ失効した記述になる。 */}
                警告を確認した上で{pendingNavigateLabel}へ移動しますか?
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setPendingNavigateTo(null);
                  toast.success("保存しました(警告あり)。");
                }}
                className="rounded bg-gray-200 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
              >
                このページに留まる
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = pendingNavigateTo;
                  setPendingNavigateTo(null);
                  leaveAfterSaveTo(dest);
                }}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                続行（{pendingNavigateLabel}へ移動）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ★★M27-02b(`P4M-009`): 消費ゲージ 2 欄の既定値(開発者指示 2026-09-03)。
//
// ★フォームの state は文字列である(BasicFieldsValue は全欄 string)。⇒ "0" を置く。
// ★2 か所(新規 / 既存の NULL)で使うため定数にする(CLAUDE.md §4 マジックストリング)。
const GAUGE_CONSUMED_DEFAULT = "0";

// ★fallbackCharacterId は必須である(M24-01 §4.1-5)。定数へのフォールバックは
//   既定キャラの解決関数 1 か所へ畳んであり、ここで second source of truth を作らない。
function initialBasic(
  initial: ComboDetail | undefined,
  fallbackCharacterId: number,
  initialHitType?: HitType,
): BasicFieldsValue {
  if (!initial) {
    return {
      characterId: fallbackCharacterId,
      isDraft: false,
      damage: "",
      position: "",
      // ★★M37-01: マス数 2 欄の既定は空である。★消費ゲージのように "0" を既定に
      //   しないこと —— 未入力(null)を表現できる必要があり(指示書 §2.2-5)、
      //   "0" を既定にすると「編集画面を開いただけ」で 0 マスが全コンボへ書かれる。
      startPositionMass: "",
      carryDistanceMass: "",
      // M24-04(SM-093): 「状態はデフォルトで不問であるべき」。新規登録の既定は
      // 未指定(空文字)ではなく「不問」(= OPPONENT_STANCE_ANY)にする。
      // ★空文字と "any" は同じ扱いではない(保存時に NULL / "any" へ分かれる)。
      //   ⇒ これは表示だけの変更ではなく、以後の新規登録の保存値が変わる。
      opponentStance: OPPONENT_STANCE_ANY,
      // ★★★M38-01(射程 5): 新規登録の既定を「通常」(= HIT_TYPE_NORMAL)にした。
      //   ★着手前の既定は空文字であり、`withUnspecifiedFirst` が足した値域外の
      //     「不問」が選ばれた状態で開いていた(SUPP-001 §3.2 の 8 値に「不問」は無い)。
      //   ★★これは表示だけの変更ではない —— 以後の新規登録の保存値が
      //     NULL → "normal" へ変わる。`hit_type` は重複判定キーの 1 つである。
      //   ★確定反撃サーチ経由(initialHitType あり)は従来どおりそちらが勝ち、
      //     欄は `hitTypeLockedReason` で全数 disabled になる。
      hitType: initialHitType ?? HIT_TYPE_NORMAL,
      opponentSize: "",
      starterMeaty: false,
      driveAvailableAtStart: "",
      saAvailableAtStart: "",
      // ★★★M38-01 追補2(射程 4): 開始残量 2 欄は**空で始まり、空のまま保存できる**。
      //   ⇒ 空欄は NULL＝「不問」であり、画面では placeholder に「不問」と薄く出る。
      //   ★★消費 2 欄が `GAUGE_CONSUMED_DEFAULT = "0"` を先入れするのとは
      //     意図的に非対称である —— 「消費 0」は実在の多数派だが、開始残量に
      //     多数派の値は無い(キャラ・状況依存)。既定を入れると嘘の値が全コンボへ入る。
      driveDamage: "",
      // ★★M27-02b(`P4M-009`・開発者指示 2026-09-03): 消費ゲージ 2 欄は既定値 0 を
      //   あらかじめ入れておく。逐語＝「初期値として0をあらかじめテキストボックスに
      //   入れて置いて欲しい」。
      //
      // ★★★M38-01(射程 3): **根拠の半分が失効した。挙動は変えていない。**
      //   ★以下は失効した記述:「この 2 欄は必須化の対象であり、既定が空だと
      //     新規登録のたびに『消費なし』を手で打つことになる」——
      //     同 2 欄は VAL-C15 の必須から外れたため、空でも保存できる。
      //   ★★★残る根拠は開発者の逐語そのものであり、そちらは必須化と独立している。
      //     ⇒ 「消費 0」は実在の多数派であり、先入れは今も利用者の手数を減らす。
      //   ★★開始残量 2 欄に同じ先入れをしないのは意図的である ——
      //     あちらに多数派の値は無く(キャラ・状況依存)、既定を入れると嘘の値が
      //     全コンボへ書かれる。⇒ 代わりに「不問」を明示的に選ばせる。
      saGaugeConsumed: GAUGE_CONSUMED_DEFAULT,
      driveGaugeConsumed: GAUGE_CONSUMED_DEFAULT,
      knockdownAdvantage: "",
      memo: "",
      link: "",
      videoPath: "",
      imagePath: "",
      tagIds: [],
      customStates: {},
      okiOptions: [],
      // ★M27-02b: 新規は未検証から始まる。チェックに触れると自動で就く。
      okiVerified: false,
    };
  }
  return {
    characterId: initial.characterId,
    isDraft: initial.isDraft,
    damage: initial.damage == null ? "" : String(initial.damage),
    position: initial.position ?? "",
    // ★M37-01: null は "" へ(既存の数値欄と同じ流儀)。
    startPositionMass:
      initial.startPositionMass == null ? "" : String(initial.startPositionMass),
    carryDistanceMass:
      initial.carryDistanceMass == null ? "" : String(initial.carryDistanceMass),
    opponentStance: initial.opponentStance ?? "",
    // ★★★M38-01(射程 5): **編集は読込値のまま**である。ここを `?? HIT_TYPE_NORMAL`
    //   にしないこと —— `hit_type` が NULL の既存行を開いて保存しただけで値が
    //   "normal" へ化け、**重複判定キーが変わる**(指示書 §4.2)。
    //   ⇒ 空のまま渡し、`hitTypeOptionsFor` が末尾へ「(未指定)」を出して見せる。
    //   ★既存行を寄せるマイグレは作らない(2026-09-17 開発者裁定)。
    hitType: initial.hitType ?? "",
    opponentSize: initial.opponentSize ?? "",
    starterMeaty: initial.starterMeaty ?? false,
    driveAvailableAtStart:
      initial.driveAvailableAtStart == null
        ? ""
        : String(initial.driveAvailableAtStart),
    saAvailableAtStart:
      initial.saAvailableAtStart == null
        ? ""
        : String(initial.saAvailableAtStart),
    // ★★★M38-01 追補2(射程 4): 既存行の NULL は**空欄**として読み込まれ、
    //   placeholder の「不問」で意味が画面に出る(指示書 §0.2-4)。
    //   ★★着手前は `driveAvailableAtStartAny` という UI 専用 flag を立てて
    //     「不問」を別状態として持っていたが、**空欄そのものが不問になったので消えた**
    //     (2026-09-18 開発者裁定。区別する意味が無くなったため)。
    driveDamage:
      initial.driveDamage == null ? "" : String(initial.driveDamage),
    // ★★M27-02b: 既存コンボでも未入力(NULL)なら 0 を入れる。
    //   ★★これは表示だけの話ではない——**開いて保存すると「消費 0」が書き込まれる**。
    //
    // ★★★M38-01(射程 3): **根拠が失効した。挙動は射程外なので変えていない。**
    //   ★以下は失効した記述:「必須化した 2 欄を空のまま開くと保存が止まるため、
    //     開発者指示の『あらかじめ 0』を既存行にも適用する」——
    //     同 2 欄は必須から外れ、空のまま開いても保存は止まらなくなった。
    //   ⇒ いま残るのは「既存行の NULL を開いて保存すると 0 が書かれる」という
    //     副作用だけであり、それを正当化していた理由は消えている。
    //   ★★戻すか残すかは開発者の判断である(本サブの射程 5 件に無く、戻すと
    //     既存の運用が変わる)。⇒ 設計伝達レポート §4 の横断課題へ回した。
    saGaugeConsumed:
      initial.saGaugeConsumed == null
        ? GAUGE_CONSUMED_DEFAULT
        : String(initial.saGaugeConsumed),
    driveGaugeConsumed:
      initial.driveGaugeConsumed == null
        ? GAUGE_CONSUMED_DEFAULT
        : String(initial.driveGaugeConsumed),
    knockdownAdvantage:
      initial.knockdownAdvantage == null
        ? ""
        : String(initial.knockdownAdvantage),
    memo: initial.memo ?? "",
    link: initial.link ?? "",
    videoPath: initial.videoPath ?? "",
    imagePath: initial.imagePath ?? "",
    tagIds: initial.tags.map((t) => t.id),
    // round-trip: 既存 situation の custom_states を付与値 state へ復元(M11-01)。
    customStates: parseSituationCustomStates(initial.situation),
    okiOptions: initial.okiOptions ?? [],
    okiVerified: initial.okiVerified ?? false,
  };
}

function parsePunishHitType(value: string | undefined): HitType | undefined {
  return value != null &&
    (HIT_TYPE_VALUES as readonly string[]).includes(value)
    ? (value as HitType)
    : undefined;
}

// ★★M24-04(CO-003): 離脱ガード用の「いまの入力内容」のキー。
//   初回描画時のキーを基準値として保持し、等しくなければ「保存していない変更がある」。
//
// ★★下の isFormDirty(CHANGE-036・キャラ変更確認用)とは別物である。混ぜないこと。
//   - isFormDirty …… 「ユーザー入力が何かあるか」。★編集モードでは初期状態と比べていない
//     ため常に真に近い。キャラを変えると入力が捨てられることを警告する用途に限る。
//   - formDirtyKey … 「初期値から変わったか」。編集モードでは読み込んだコンボが初期値になる。
//
// ★characterId は入れない(呼び出し側のコメントを参照)。
function formDirtyKey(
  basic: BasicFieldsValue,
  steps: Step[],
  setupsToCreate: CreateSetupInput[],
  linkedSetups: SetupSummary[],
): string {
  const { characterId: _characterId, ...rest } = basic;
  return dirtyKey({
    basic: rest,
    steps,
    setupsToCreate,
    // ★紐付けは id の集合だけを見る。SetupSummary の他の列はサーバ由来で、
    //   再取得のたびに入れ替わりうる(それは利用者の入力ではない)。
    linkedSetupIds: [...linkedSetups.map((s) => s.id)].sort((a, b) => a - b),
  });
}

// フォームに「ユーザー入力が何かあるか」(dirty)を判定する(CHANGE-036)。
// レシピ/束ねセットプレイ/既存セットプレイ紐付けのいずれかがあれば dirty。
// 基本情報は新規初期状態(characterId を除く)との差分で判定する。
// コピーモードは initialBasic(initial) で内容が投入済みのため、初回から dirty=true となる。
function isFormDirty(
  basic: BasicFieldsValue,
  steps: Step[],
  setupsToCreate: CreateSetupInput[],
  linkedSetups: SetupSummary[],
): boolean {
  if (steps.length > 0 || setupsToCreate.length > 0 || linkedSetups.length > 0) {
    return true;
  }
  const pristine = initialBasic(undefined, basic.characterId);
  return JSON.stringify(basic) !== JSON.stringify(pristine);
}

function nullIfEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

function parseOptInt(s: string): number | null {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// C-11: drive_damage は小数許容のため truncate しない。
function parseOptFloat(s: string): number | null {
  const t = s.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ★★M29-01: 始動側 2 件が短縮形「ドライブゲージ」「SAゲージ」だった。
//   ⇒ 正典(GAUGE_AT_START_LABEL_JA)へ寄せた。**同じ欄がエラー表示のときだけ
//     別の呼び名になる**状態だったためである。★語は 2 か所に書かない(E-76)。
const FIELD_LABELS: Record<string, string> = {
  damage: "ダメージ",
  driveAvailableAtStart: GAUGE_AT_START_LABEL_JA.drive,
  saAvailableAtStart: GAUGE_AT_START_LABEL_JA.sa,
  driveDamage: "ドライブダメージ",
  saGaugeConsumed: GAUGE_CONSUMED_LABEL_JA.sa,
  driveGaugeConsumed: GAUGE_CONSUMED_LABEL_JA.drive,
  knockdownAdvantage: "有利フレーム",
  memo: "メモ",
  link: "リンク",
  videoPath: "動画パス",
  imagePath: "画像パス",
  characterId: "キャラクター",
  starterMoveId: "始動技",
  // ★M24-04: レシピのエラー(VAL-C09 等)が「steps: …」と出ていた。タブの見出しが
  //   「レシピ」を名乗る以上、リスト側も同じ呼び名にする。
  steps: "レシピ",
  position: "始動位置",
  // ★M37-01: position と同じラベルにしないこと —— ValidationDisplay は field で
  //   引くため、同名だと 2 つのエラーが見分けられなくなる。
  startPositionMass: "始動位置(マス数)",
  carryDistanceMass: "運び量",
  opponentStance: "相手の状態",
  hitType: "ヒット種別",
  opponentSize: "相手の大きさ",
  starterMeaty: STARTER_MEATY_LABEL,
};

function fieldLabel(path: string): string {
  const direct = FIELD_LABELS[path];
  if (direct) return direct;
  // ★★ステップ配下は添字付きで来る。そのまま出すと利用者に「steps[0].moveId」と見える。
  //   - バックエンド: `steps[1].moveId`（`stepOrder` は 1 始まり）
  //   - フロント zod: `steps.0.moveId`（配列の添字なので 0 始まり）
  //   ★★何ステップ目かは出さない——2 つの経路で基点が違い、片方に合わせると
  //     もう片方が 1 つずれた番号を表示する。誤った番号を出すより出さない方がよい。
  if (/^steps[[.]\d+[\].]/.test(path)) return "レシピ";
  // ★★M27-02a: 同梱セットプレイも同じ形で来る(`setups[1].steps` / `setups[1]`)。
  //   足すまでは「setups[0].steps: レシピは 1 ステップ以上必要です」と生のまま出ていた。
  //   ★★何件目かを出さない理由は steps とは違う。steps は BE(1 始まり)と
  //     FE zod(0 始まり)で基点が食い違うためだが、setups は FE zod が検証しないので
  //     基点が 2 つ無い(BE の添字は setupsToCreate の添字とそのまま一致する)。
  //   ⇒ setups で出さないのは「同時に 2 件以上出ないため要らない」からである
  //     (BE は最初のエラー setup で打ち切る＝internal/service/combo/service.go)。
  if (/^setups[[.]\d+/.test(path)) return "セットプレイ";
  return path;
}
