import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ConflictDialog, type ConflictKind } from "@/components/ConflictDialog";
import { dirtyKey } from "@/features/navigation-guard/dirty";
import {
  useLeaveWithoutConfirm,
  useRequestLeave,
  useUnsavedChangesGuard,
} from "@/features/navigation-guard/useUnsavedChangesGuard";
import { useCombo } from "@/features/combo/api";
import { ValidationDisplay } from "@/features/combo/components/ValidationDisplay";
import type { ValidationResult } from "@/features/combo/types";
import { SetupBasicInfoForm } from "@/features/setup/components/SetupBasicInfoForm";
import { SetupRecipeEditor } from "@/features/setup/components/SetupRecipeEditor";
import { VerifiedConditionsField } from "@/features/setup/components/VerifiedConditionsField";
import { parseSetupApiError } from "@/features/setup/errors";
import { useSetup } from "@/features/setup/hooks/useSetup";
import { useCreateSetup } from "@/features/setup/hooks/useCreateSetup";
import { useUpdateSetup } from "@/features/setup/hooks/useUpdateSetup";
import { PreSaveDuplicateDialog } from "@/components/PreSaveDuplicateDialog";
import {
  checkSetupTrashDuplicates,
  type DuplicateCandidate,
} from "@/features/trash/preSaveDuplicateCheck";
import { formatRestoreWarnings } from "@/features/trash/restoreWarnings";
import {
  dropAcknowledgedTrashDuplicates,
  formatSaveWarnings,
} from "@/features/trash/saveWarnings";
import { useRestoreSetup } from "@/features/setup/hooks/useRestoreSetup";
import type {
  SetupResultCondition,
  SetupStepInput,
} from "@/features/setup/types";

export function SetupEditorPage() {
  const { comboId: comboIdStr, setupId: setupIdStr } = useParams<{
    comboId?: string;
    setupId?: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [searchParams] = useSearchParams();

  const comboId = comboIdStr ? Number(comboIdStr) : null;
  const setupId = setupIdStr ? Number(setupIdStr) : null;
  const mode: "create" | "edit" = setupId != null ? "edit" : "create";

  // ★★M24-05(SM-011): コピーは「create の一種」であって第 3 のモードではない。
  //   mode を 3 値にすると、この画面に 6 か所ある `mode === "create"` の分岐
  //   〔キャラの引き元 / 上部キャンセルの形 / 成立条件の表示 / 保存前ゴミ箱チェック /
  //     保存経路 / 読み込み判定〕をすべて `mode !== "edit"` へ書き換えることになり、
  //   M19-07・M22-04・M23-09・M24-04 が積んだ分岐を丸ごと触ることになる。
  //   ⇒ フラグを 1 本足すだけにして、既存の分岐を 1 つも動かさない。
  //   ★コンボ側と同じ作法(query の ?copyFrom=)である。新しい作法は作っていない。
  const copyFromStr = searchParams.get("copyFrom");
  const copyFromId =
    mode === "create" && copyFromStr != null && Number(copyFromStr) > 0
      ? Number(copyFromStr)
      : null;

  const comboQ = useCombo(mode === "create" ? comboId : null);
  const setupQ = useSetup(mode === "edit" ? setupId : null);
  // コピー元。★編集モードでは引かない(自分自身を二重に読むことになる)。
  const copySourceQ = useSetup(copyFromId);

  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [steps, setSteps] = useState<SetupStepInput[]>([]);
  // M19-07 追補: 「確認できた条件」。新規登録時のみ入力でき、作成 API の
  // verifiedConditions として同一トランザクションで記録される。
  // 編集モードでは扱わない(DES-005 §5.6 = /setups/:id には置かない)。
  const [verifiedConditions, setVerifiedConditions] = useState<SetupResultCondition[]>([]);
  // 競合で保存が止まったときのモーダル(M22-04)。null = 出ていない。
  // ★入力を保持したまま表示する。ここが立っても name / description / steps には触らない。
  const [conflictKind, setConflictKind] = useState<ConflictKind | null>(null);
  // 同一レシピ重複(duplicate_setup)。★版不一致とは別物であり、別の文言で出す(§4.2-5)。
  const [duplicateSetup, setDuplicateSetup] = useState(false);
  // バグ #6(VAL-S02): 登録・編集のバリデーションエラー(HTTP 400)を全幅表示する。
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // ★★M24-04(CO-003): 離脱ガードの基準値。
  //   新規モードの初期値は空。編集モードは読み込んだセットプレイが初期値になるため、
  //   下の useEffect(hydrate)で採り直す——採り直さないと、読み込みが終わった瞬間に
  //   「入力が変わった」ことになり、何も触っていないのに確認が出る。
  // ★verifiedConditions を基準値では常に空にしている——同フィールドは新規登録時のみ
  //   入力でき（DES-005 §5.6 = 編集画面には置かない）、初期値も常に空だからである。
  //   ★現在値の側には含める。含めないと「成立条件だけを入れた」状態が dirty にならない。
  const [dirtyBaseline, setDirtyBaseline] = useState<string>(() =>
    setupDirtyKey(null, null, [], []),
  );

  useEffect(() => {
    if (setupQ.data) {
      const loadedName = setupQ.data.name ?? null;
      const loadedDescription = setupQ.data.description ?? null;
      const loadedSteps = setupQ.data.steps.map((s) => ({
        moveId: s.moveId ?? undefined,
        modifiers: s.modifiers ?? undefined,
      }));
      setName(loadedName);
      setDescription(loadedDescription);
      setSteps(loadedSteps);
      // ★読み込んだ値をそのまま基準値にする(編集モードの初期値)。
      setDirtyBaseline(
        setupDirtyKey(loadedName, loadedDescription, loadedSteps, []),
      );
    }
  }, [setupQ.data]);

  // ★★M24-05(SM-011): コピー元を投入する。
  //   ★成立条件(verifiedConditions)は引き継がない——DES-005 §5.6 が
  //     「コピー時は成立条件を引き継がない(全セル未検証で開始)」と定めている。
  //     引き継ぐと、未検証のものが検証済みに見える。
  //   ★★投入したら基準値も採り直す。採らないと、読み込みが終わった瞬間に
  //     「入力が変わった」ことになり、何も触っていないのに離脱確認が出る
  //     (編集モードの hydrate と同じ罠である)。
  useEffect(() => {
    if (copySourceQ.data) {
      const loadedName = copySourceQ.data.name ?? null;
      const loadedDescription = copySourceQ.data.description ?? null;
      const loadedSteps = copySourceQ.data.steps.map((s) => ({
        moveId: s.moveId ?? undefined,
        modifiers: s.modifiers ?? undefined,
      }));
      setName(loadedName);
      setDescription(loadedDescription);
      setSteps(loadedSteps);
      setDirtyBaseline(
        setupDirtyKey(loadedName, loadedDescription, loadedSteps, []),
      );
    }
  }, [copySourceQ.data]);

  const isUnsaved =
    setupDirtyKey(name, description, steps, verifiedConditions) !==
    dirtyBaseline;
  useUnsavedChangesGuard(isUnsaved);

  // ★★M24-04(CO-003): キャンセルは画面に 2 つある(上部と保存ボタンの隣)。
  //   ハンドラを 1 つに寄せる——片方だけ直る事故を塞ぐため。
  // ★行き先の形で渡す。ガードが積んだ番人の履歴エントリぶんを補正できるのは
  //   「どこへ」か「戻る」かが分かっているときだけである。
  const handleCancel = () => {
    if (mode === "create") {
      leaveTo(`/combos/${comboId}`);
    } else {
      leaveBack();
    }
  };

  // ★★保存が成功したら dirty を落とす。落とさないと、保存が済んでいるのに
  //   離脱の確認が出る(そのうえ番人の履歴エントリが残るため遷移も空振りする)。
  //   ★ComboEditor 側と同じ要求である(指示書 §4.1 / CHANGE-137 判断 5)。
  const markSaved = () => {
    setDirtyBaseline(
      setupDirtyKey(name, description, steps, verifiedConditions),
    );
  };
  const { leaveTo, leaveBack } = useRequestLeave();
  // ★保存が済んだあとの遷移はこちらを通す（確認は出さないが番人の補正はする）。
  const { leaveTo: leaveAfterSaveTo, leaveBack: leaveAfterSaveBack } =
    useLeaveWithoutConfirm();

  const createMutation = useCreateSetup();
  const updateMutation = useUpdateSetup();
  // M23-09: 保存前ダイアログの「ゴミ箱から復元する」。★復元 API は変えていない。
  const restoreMutation = useRestoreSetup();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // M23-09: 保存前の重複ダイアログ。★候補が空＝閉じている。
  const [trashCandidates, setTrashCandidates] = useState<DuplicateCandidate[]>(
    [],
  );
  const [checkingTrash, setCheckingTrash] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  // ★★再入ガード。ダイアログを挟むと押下から送信までの間が長くなり、その間は
  //   isSaving が false のままなので disabled だけでは窓が閉じない(§4.6-3)。
  //   ★state ではなく ref である——同じイベントハンドラ内で読むため。
  const saveInFlightRef = useRef(false);

  const characterId =
    mode === "create"
      ? (comboQ.data?.characterId ?? null)
      : (setupQ.data?.characterId ?? null);

  // 「ほかの人の内容を見る」の遷移先(M22-04 §4.3-3)。編集モードでは親コンボが
  // 複数あり得るため先頭を使う。★不在なら導線を出さない(null)。
  const parentComboId =
    mode === "create" ? comboId : (setupQ.data?.parentComboIds?.[0] ?? null);

  // 「読み込み直す」の実処理(§4.3-3)。★2 段目の確認を通ったときだけ呼ばれる。
  // ★ComboEditor と同じ理由で画面ごと読み込み直す——初期化が useEffect / useState に
  //   散っており、再初期化を別に書くと初期化経路が 2 本になってドリフトする(E-76)。
  const handleConflictReload = () => {
    setConflictKind(null);
    window.location.reload();
  };

  // ★保存できない条件の定義はここ 1 か所。画面の保存ボタンと、物理コントローラの
  //   ショートカット(M21-04)が同じ式を見る。2 か所へ書くと片方だけ直って食い違う。
  // ★M23-09 §4.6: 保存前チェックの待ちとダイアログ表示中も「保存できない」に含める。
  const saveDisabled =
    isSaving ||
    checkingTrash ||
    trashCandidates.length > 0 ||
    characterId == null ||
    !name ||
    name.trim() === "";

  const handleFormChange = (
    changes: Partial<{ name: string | null; description: string | null }>,
  ) => {
    if ("name" in changes) setName(changes.name!);
    if ("description" in changes) setDescription(changes.description!);
  };

  // 保存が拒否されたときの見せ方(M22-04 §4.1〜§4.3・§4.2-5)。
  //
  // ★★フォームの state を触らないこと。競合は利用者が書いたあとに起きる。
  // ★分岐はエラーコードで行う。★M22-04 以前は status === 409 だけで判定しており、
  //   同一レシピ重複(duplicate_setup)まで版不一致の文言で出ていた(§4.2-5)。
  const handleError = (err: unknown) => {
    const parsed = parseSetupApiError(err);
    setValidationError(parsed.validations);
    setDuplicateSetup(parsed.kind === "duplicateSetup");
    // ★404 は競合モーダルへ寄せない(下記の理由)。従来どおりサーバのメッセージを出す。
    setFatalError(
      parsed.kind === "other" || parsed.kind === "notFound" ? parsed.fatalMessage : null,
    );

    // ★★モーダルへ寄せるのは版不一致だけである。404 は寄せない。
    //
    // 指示書 §4.3-7 が 404 を扱えと言っているのは「キー変更編集に負けた側」であり、
    // それは PUT /api/combos/:id を持つコンボ編集の話である。セットプレイには
    // キー変更編集が無い(routes.go は PATCH /setups/:id のみ)。
    //
    // ⇒ この画面の 404 の由来は次の 2 つで、どちらも「作り直された」ではない:
    //   - POST /combos/:comboId/setups が親コンボを見つけられない
    //     (internal/api/setup/handler.go:49。「コンボが見つかりません」)
    //   - PATCH /setups/:id の対象が本当に削除されている
    // ⇒ 「ほかの人がこのセットプレイを作り直したか」と書くと事実と食い違う。
    //    とくに新規登録では、まだ 1 件も作られていないものについてそう述べる形になる。
    if (parsed.kind === "versionConflict") {
      setConflictKind(parsed.kind);
      return;
    }
    // C-04: スクロール位置に依存しない補助シグナルとしてトーストも出す(コンボ編集と統一)。
    if (parsed.validations) {
      toast.error(t("setup.editor.saveFailed"));
    } else if (parsed.kind === "duplicateSetup") {
      toast.error(t("setup.editor.saveFailed"));
    } else {
      toast.error(t("setup.editor.networkError"));
    }
  };

  const handleSave = () => {
    // ★★再入ガード(§4.6-3)。画面の保存ボタンと物理コントローラのショートカットは
    //   同じ関数を呼ぶため、ここで止めれば両方に効く。
    if (saveInFlightRef.current) return;

    setConflictKind(null);
    setDuplicateSetup(false);
    setValidationError(null);
    setFatalError(null);
    if (mode === "create") {
      if (!comboId || !characterId) return;
      void runCreateWithTrashCheck();
      return;
    }
    if (!setupId || !setupQ.data) return;
    updateMutation.mutate(
      {
        id: setupId,
        input: { name, description, steps, version: setupQ.data.version },
      },
      {
        onSuccess: () => {
          markSaved();
          // ★★素の navigate(-1) では、ガードが積んだ番人のエントリぶんしか戻らず
          //   編集画面自身へ着地する。markSaved() の state 更新は非同期であり、
          //   この時点ではガードもまだ張られているため確認ダイアログまで出る。
          leaveAfterSaveBack();
        },
        onError: handleError,
      },
    );
  };

  // ★★保存ボタンを押したときに 1 回だけチェックを叩く(§4.2-1＝入力中には出さない)。
  //
  // ★セットプレイに仮登録の概念は無いため、コンボ側のような isDraft の分岐は要らない。
  const runCreateWithTrashCheck = async () => {
    if (!comboId || !characterId) return;
    setCheckingTrash(true);
    const result = await checkSetupTrashDuplicates(
      comboId,
      {
        characterId,
        steps: steps.map((s) => ({
          moveId: s.moveId ?? null,
          modifiers: s.modifiers,
        })),
      },
      t,
    );
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
    if (!comboId || !characterId) return;
    const suppressSaveWarnings = opts?.suppressSaveWarnings ?? false;
    saveInFlightRef.current = true;
    createMutation.mutate(
      {
        comboId,
        input: { characterId, name, description, steps, verifiedConditions },
      },
      {
        onSuccess: (data) => {
          markSaved();
          // M23-05 §4.6: 同じ親コンボのゴミ箱に同じレシピがある(VAL-S07)。
          // ★登録は成功しているので遷移を止めない。★モーダルにしない。
          // ★0 件のときはキー自体が無い(M23-04 §4.3-2)。
          // ★M23-09 §4.5: ダイアログで既に告げた重複は、保存後にもう一度告げない。
          //   ★落とすのは VAL-C14 / VAL-S07 だけである(未知コードは出し続ける)。
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
          leaveAfterSaveTo(`/combos/${comboId}`);
        },
        onError: handleError,
        onSettled: () => {
          saveInFlightRef.current = false;
        },
      },
    );
  };

  // M23-09: ダイアログの 3 つの選択肢。
  const handleTrashRestore = (id: number) => {
    setRestoreFailed(false);
    restoreMutation.mutate(id, {
      onSuccess: (restored) => {
        setTrashCandidates([]);
        // ★復元応答の警告を捨てない(VAL-R02 / VAL-R04 / VAL-S03 等)。既存の復元導線
        //   4 か所と同じ形へ揃える——警告があるときは 1 枚に畳み、完了と警告で
        //   2 枚出さない(M23-06 §4.6-1)。
        // ★★このダイアログ経路では VAL-R04 が実際に起きうる。応答の duplicates
        //   (生きた側)が非空のまま復元すれば必ず発火する。
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
        // ★復元して詳細画面へ行く。編集画面へは行かない(§4.3-3)。
        //   ★セットプレイの「詳細」は親コンボの詳細画面である——/setups/:id は編集画面で
        //     あり §1.4-8 が禁じている。登録成功時と同じ遷移先で、新しい規則を作らない。
        navigate(`/combos/${comboId}`);
      },
      // ★★失敗してもダイアログを閉じない(§4.9)。閉じると導線が 1 つも残らない。
      onError: () => setRestoreFailed(true),
    });
  };

  const handleTrashCreateNew = () => {
    setTrashCandidates([]);
    runCreate({ suppressSaveWarnings: true });
  };

  // ★閉じるだけ。フォームの state には触れない(§4.6-2)。
  const handleTrashCancel = () => {
    setTrashCandidates([]);
    setRestoreFailed(false);
  };

  const isLoading =
    (mode === "create" && comboQ.isLoading) ||
    (mode === "edit" && setupQ.isLoading) ||
    // ★コピー元の読み込み中に空のフォームを出さない(投入前に触られると
    //   直後の hydrate で入力が消える)。
    copySourceQ.isLoading;

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-gray-500">{t("setup.editor.loading")}</p>
      </main>
    );
  }

  if (mode === "edit" && setupQ.isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-red-600">{t("setup.editor.loadError")}</p>
      </main>
    );
  }

  // ★コンボ側の「コンボ新規登録（コピー元: #N）」と同じ形にする。
  const title =
    mode === "edit"
      ? t("setup.editor.editTitle")
      : copyFromId != null
        ? t("setup.editor.createFromCopyTitle", { id: copyFromId })
        : t("setup.editor.createTitle");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      {/* ★★M31-01(P4M-004): 戻る導線を左端へ移した。
          逐語＝「セットプレイ編集画面で元の画面に戻るボタンが他と不統一で
          左上ではなく右上にある」(phase4-memo.txt:18)。
          ★実測した本プロジェクトの作法＝**戻るは左端・操作は右端・見出しはその下**
            (ComboDetailPage / TrashComboDetailPage が同じ形)。⇒ それに揃えた。
          ★DES-005 §5.9 は戻る導線の位置を定めていない(表示項目 7 の
            「保存 / キャンセル」はフォーム下部の話)。⇒ 契約は動かない。
          ★★モード分岐は 1 文字も変えていない——create は <Link>、edit は
            離脱ガードを通す <button> のままである(M24-04 / CO-003)。
            移したのは配置だけである。 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "create" ? (
          <Link to={`/combos/${comboId}`} className="text-sm text-blue-600 hover:underline">
            {t("setup.editor.backCancel")}
          </Link>
        ) : (
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            /* ★M24-04(CO-003): リンクではないので click キャプチャに掛からない。
               離脱ガードを通す(未保存の変更が無ければそのまま遷移する)。 */
            onClick={handleCancel}
          >
            {t("setup.editor.backCancel")}
          </button>
        )}
        <div className="flex items-center gap-3">
          {/* ★★M24-05(SM-011): セットプレイ編集にもコピー。
              ★コンボ側と同じ形である——新規登録モードへ ?copyFrom= で初期値を投入する
                (ComboDetailPage の「コピー」→ /combos/new?copyFrom=N と同型)。
                新しい作法は作らない。
              ★★親コンボはコピー元の先頭の親を採り、不在なら導線を出さない。
                これは DES-005 §5.9 が「ほかの人の内容を見る」で定めた既存の規則で
                あり(この画面の parentComboId がまさにそれ)、第 2 の規則を作らない。
                VAL-S05 が親コンボ ID 必須のため、親が無いとそもそも作成できない。
              ★成立条件は引き継がない(DES-005 §5.6)。投入するのは名前・説明・レシピだけ。
              ★<Link> なので離脱ガードの click キャプチャに掛かる。 */}
          {mode === "edit" && setupId != null && parentComboId != null && (
            <Link
              to={`/combos/${parentComboId}/setups/new?copyFrom=${setupId}`}
              className="text-sm text-blue-600 hover:underline"
              data-testid="setup-editor-copy"
            >
              {t("setup.editor.copy")}
            </Link>
          )}
        </div>
      </div>

      <h1 className="text-xl font-semibold">{title}</h1>

      {/* ★同一レシピ重複(duplicate_setup)。版不一致とは別物であり、別の文言で出す。
          M22-04 以前は status === 409 だけで判定していたため、ここが「他のタブで
          更新されています」と表示されていた(§4.2-5・最重要ゲート 2)。 */}
      {duplicateSetup && (
        <div
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="setup-editor-duplicate-setup"
        >
          {t("conflict.duplicateSetup")}
        </div>
      )}

      {fatalError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fatalError}
        </div>
      )}

      {characterId != null && (
        <SetupBasicInfoForm
          characterId={characterId}
          name={name}
          description={description}
          onChange={handleFormChange}
        />
      )}

      {characterId != null && (
        <SetupRecipeEditor
          characterId={characterId}
          steps={steps}
          onChange={setSteps}
          // 物理コントローラのショートカットから保存する入口(M21-04 §4.2 の 3)。
          // ★画面の保存ボタンと同じ関数・同じ活性条件を渡す。
          onSave={handleSave}
          canSave={!saveDisabled}
        />
      )}

      {/* M19-07 追補: 新規登録時のみ「確認できた条件」を入力できる。
          この面は URL に comboId があり親コンボが確定しているため、v3 原則
          (DES-005 §5.6)を満たす。★編集モード(/setups/:id)には出さない ——
          親が複数あり得るため「実装しない」= 開発者判断 2026-07-28。 */}
      {mode === "create" && (
        <VerifiedConditionsField
          value={verifiedConditions}
          onChange={setVerifiedConditions}
          testIdPrefix="setup-editor-confirmed"
          variant="section"
        />
      )}

      {/* C-04: バリデーション警告は保存ボタンの直上に表示し、スクロールして保存
          しようとした位置でエラーを確認できるようにする(コンボ編集と統一)。 */}
      <ValidationDisplay result={validationError} />

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          onClick={handleSave}
          disabled={saveDisabled}
        >
          {isSaving ? t("setup.editor.saving") : t("setup.editor.save")}
        </button>
        <button
          type="button"
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          /* ★★M24-04(CO-003): ここも離脱ガードを通す。
             この画面で最も押される離脱導線であり、上部だけ直すと穴が残る。 */
          onClick={handleCancel}
        >
          {t("setup.editor.cancel")}
        </button>
      </div>

      {/* 保存前の重複ダイアログ(M23-09)。★候補が 0 件では開かない。
          ★ここに置くのは、下の ConflictDialog のコメント(M22-04)から離すためでもある——
            間に挟むと、あのコメントが本部品の説明として読める位置に来る。 */}
      <PreSaveDuplicateDialog
        candidates={trashCandidates}
        kind="setup"
        busy={createMutation.isPending || restoreMutation.isPending}
        restoreFailed={restoreFailed}
        onRestore={handleTrashRestore}
        onCreateNew={handleTrashCreateNew}
        onCancel={handleTrashCancel}
      />

      {/* 競合で保存が止まったときの導線(M22-04 §4.3)。
          ★「ほかの人の内容を見る」は親コンボの詳細画面を別枠で開く——
            /setups/:id は編集画面であり、読み取り専用の詳細画面が無いため。
          ★404 のときは行がもう無いため、見る先も読み込み直す先も無い。 */}
      <ConflictDialog
        open={conflictKind !== null}
        kind={conflictKind ?? "versionConflict"}
        resource="setup"
        viewTheirsHref={
          conflictKind === "versionConflict" && parentComboId != null
            ? `/combos/${parentComboId}`
            : null
        }
        onReload={conflictKind === "versionConflict" ? handleConflictReload : null}
        onSaveAsNew={
          // ★セットプレイ編集ではどちらも出さない。§4.7 の行き止まりはコンボ編集の
          //   キー変更編集(PUT)に負けた側で起きるものであり、setups には PUT が無い
          //   (§4.7.4-3)。⇒ null を明示的に渡す(省略できる形にしない = D-417 の再発防止)。
          null
        }
        onGoToList={null}
        onClose={() => setConflictKind(null)}
      />
    </main>
  );
}

// ★★M24-04(CO-003): 離脱ガード用の「いまの入力内容」のキー。
//   初回(新規)または読み込み完了時(編集)のキーを基準値として持ち、等しくなければ
//   「保存していない変更がある」。
// ★name / description は未入力を null、読み込み値を文字列で持つため、
//   空文字と null を同一視する dirtyKey に通す(そうしないと空欄を触るだけで dirty になる)。
function setupDirtyKey(
  name: string | null,
  description: string | null,
  steps: SetupStepInput[],
  verifiedConditions: SetupResultCondition[],
): string {
  return dirtyKey({ name, description, steps, verifiedConditions });
}
