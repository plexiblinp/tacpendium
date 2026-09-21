import { useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GamepadInputNotice, {
  GamepadNoticeOpenButton,
} from "@/features/gamepad/components/GamepadInputNotice";
import GamepadRecipeReadout from "@/features/gamepad/components/GamepadRecipeReadout";
import GamepadStatusControl from "@/features/gamepad/components/GamepadStatusControl";
import { numpadFromDirection } from "@/features/gamepad/recipeInputResolution";
import { usePhysicalRecipeInput } from "@/features/physical-input/usePhysicalRecipeInput";
import KeyboardStatusControl from "@/features/keyboard/components/KeyboardStatusControl";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import { useCommandIndex, useMotionCommands } from "@/features/moves/api";
import type { MotionCommandDTO, Move } from "@/features/moves/types";

import { hasUniqueRushVariant } from "../../inputResolution";
import type {
  CommandIndexEntries,
  NumpadDirection,
} from "../../inputResolutionStage2";
import { parseCustomStateDefs } from "../../customStates";
import type { RecipeInputContext } from "../../moveSurfacing";
import { surfaceBuckets } from "../../moveSurfacing";
import type { LogicalButton } from "./controllerTypes";
import { CommonMovePanel } from "./CommonMovePanel";
import { DirectSpecPanel } from "./DirectSpecPanel";
import { RushToggleRow } from "./RushToggleRow";
import { HitBoxLayout } from "./HitBoxLayout";
import { SpecialMovePanel } from "./SpecialMovePanel";
import { DeleteRow } from "./DeleteRow";
import type { StepInput } from "./useControllerInput";
import {
  SYSTEM_BUTTON_TO_MOVE_CODE,
  useControllerInput,
} from "./useControllerInput";
import { useTranslation } from "react-i18next";

interface Props {
  characterId: number;
  moves: Move[];
  /**
   * この面はコンボのレシピ入力かセットプレイのレシピ入力か(M31-06)。
   *
   * ★★**任意にしない。** 本部品は 2 面が共有しており、`setup_only` の技は
   *   **コンボ側だけ**外してセットプレイ側では出す必要がある。既定値を置くと、
   *   渡し忘れた面で静かに技が減る(または漏れる)。⇒ 型検査で止める。
   */
  context: RecipeInputContext;
  onStepAdd: (step: StepInput) => void;
  onStepDelete: () => void;
  /**
   * ★以下 4 つは M21-04（コントローラ完結入力）が物理側から呼ぶための入口である。
   *   いずれも**既存の画面側の導線をそのまま渡す**こと（物理側で中身を作り直さない）。
   *   渡さなければ、その操作は「この面では行えません」として読取表示に出る。
   *   ★画面側の操作を取り上げるものではない。物理からの入口を足すだけである（指示書 §4.4-1）。
   */
  /** レシピ全体を保存する。★画面の保存ボタンが呼ぶ関数をそのまま渡す。 */
  onSave?: () => void;
  /** いま保存できる状態か。★画面の保存ボタンの `disabled` と同じ式を渡す。 */
  canSave?: boolean;
  /** 直前に確定したステップの修飾情報の編集を開く。★既存ダイアログの入口をそのまま渡す。 */
  onOpenLastStepModifiers?: () => void;
  /**
   * いまレシピに入っているステップ数。★削除・修飾の「対象が無い」判定に使う。
   *
   * ★**任意にしない。** 省略できる形だと、渡し忘れた面で削除・修飾が常に「対象がない」になり、
   *   型検査も lint も緑のまま静かに機能が死ぬ（他の 4 つと違い、既定値が成立してしまうため）。
   */
  stepCount: number;
}

// 解決表の取得失敗・取得中は空 entries = 段階1 だけで動く(壊れない、DES-002 §4.2)。
// インライン `?? {}` の毎レンダー新オブジェクトを避けるため module 定数で参照を安定させる。
const EMPTY_ENTRIES: CommandIndexEntries = {};

// ★同上。コマンド技入力モード用の索引も、取得失敗・取得中は空配列で「モードに入れないだけ」に
//   なる(M21-06 §4.6-6)。既存の入力経路は今までどおり動く。
const EMPTY_MOTION_COMMANDS: MotionCommandDTO[] = [];

// 仮想コントローラ = カテゴリタブ式クイック入力面(M15-03、FB④ / M30-01 でタブ 4 → 7 枚)。
//
// ★★タブ 7 枚の as-built(M30-01。★増減させたら本注記も同じ手番で直すこと):
//   1 通常技      = 段階2(解決表)＋段階1 一様フォールバック(方向パッド×ボタン、M17-03)
//   2 特殊技      = 直接指定(category='unique')
//   3 ターゲットコンボ = 直接指定(category='target_combo' の全行。P4M-007 / SM-135)
//   4 必殺技      = ファミリー＋弱中強＋OD4種
//   5 SA          = 直接指定(super_art / critical_art)
//   6 未分類      = 他のどの面からも入力できない技(P4M-008 (a))
//   7 キャラ固有状態 = custom_states の code を含む move(P4M-008 (b)。★経路であって区分ではない)
// システム行(DI/DP/投げ/ラッシュ/削除)はタブ外に常設(既存挙動温存・E2E 非回帰)。
//
// ★★「全技から選ぶ」網羅入力の担保は 2 本になった(M30-01)。
//   (a) RecipeBuilder / SetupRecipeEditor のプルダウン(残置)
//   (b) 未分類タブ ——(a) にしか無かった技のうち、押せるものはここからも入る。
//   ★(b) ができたことで「ファミリー UI に載らない技はプルダウンからしか入力できない」は
//     失効した。★ただしファミリー UI の規則そのもの(CHANGE-166)は変えていない。
//
// ★M21-03: 物理コントローラ入力の接続層をここへ置く。本コンポーネントは
//   コンボのレシピ入力面(RecipeBuilder)とセットプレイ入力面(SetupRecipeEditor)の
//   両方が既に共有しており、かつ moves / 解決表 / ラッシュトグルの 3 つが揃う唯一の場所である。
//   ⇒ 接続を 1 か所へ置くだけで 2 面が同じ解決経路を通る(指示書 §4.9-3)。
export function VirtualController({
  characterId,
  moves,
  context,
  onStepAdd,
  onStepDelete,
  onSave,
  canSave,
  onOpenLastStepModifiers,
  stepCount,
}: Props) {
  const { t } = useTranslation();
  const { addResolvedMove, handleSystemButton } = useControllerInput({
    characterId,
    moves,
    onStepAdd,
    onStepDelete,
  });
  // 段階2 解決表(キャラ選択時に 1 回取得。キャラ切替は queryKey 変化で自動再取得)。
  const { data: commandIndex } = useCommandIndex(characterId);
  const entries = commandIndex?.entries ?? EMPTY_ENTRIES;
  // コマンド技入力モード用の索引(同じくキャラ選択時に 1 回取得＝M21-06 §4.6-3)。
  const { data: motionIndex } = useMotionCommands(characterId);
  const motionCommands = motionIndex?.commands ?? EMPTY_MOTION_COMMANDS;
  const [direction, setDirection] = useState<NumpadDirection>(5);
  const [rushOn, setRushOn] = useState(false);
  // ★★M30-01: タブに何を並べるかは features/combo/moveSurfacing.ts の 1 本が決める。
  //   ここで 1 回だけ畳み、各パネルへ配る(同じ規則を画面側へ散らさない＝指示書 §2.5-2)。
  // ★★M30-01(P4M-008 (b)): キャラ固有状態タブ。判定軸は characters.custom_states の
  //   code であり、新しい列も新しい API も要らない(moveSurfacing の逐語注記に限界も書いた)。
  //   ★取得に失敗しても壊れない——定義が無ければタブが空状態になるだけである。
  const { data: characters } = useCharacters();
  const stateCodes = useMemo(() => {
    const raw = characters?.find((c) => c.id === characterId)?.customStates;
    return parseCustomStateDefs(raw).map((d) => d.code);
  }, [characters, characterId]);
  const buckets = useMemo(
    () => surfaceBuckets(moves, entries, stateCodes, context),
    [moves, entries, stateCodes, context],
  );
  // ★★タブが並べる母集団は buckets.inputMoves である(M31-06)。⇒ 生の moves ではない。
  //   ★通常技タブ(押下時に解決)と必殺技タブ(ファミリーへ畳む)はバケットを持たないため、
  //     ここから引かないと**その 2 タブにだけ除外が効かない**。
  //   ★生の moves を渡し続ける先は 3 つだけである —— useControllerInput(moveId の逆引きと
  //     システムボタン)／ usePhysicalRecipeInput ／ GamepadRecipeReadout。
  //     **物理入力は「入力面」の数え上げに含めない**(指示書 M31-06 §2.2-6・M31-04 の
  //     開発者逐語＝入力面はタブとプルダウンの 2 面)。⇒ 塞ぎ忘れではなく対象外である。
  const inputMoves = buckets.inputMoves;
  // 特殊技のラッシュ版が seed に存在するときだけ特殊技タブにラッシュトグルを出す(データ駆動)。
  // ★母集団は inputMoves である(M31-06)。⇒ 外した技のラッシュ版だけを根拠にトグルを出さない。
  const uniqueRushAvailable = hasUniqueRushVariant(inputMoves);

  // 物理コントローラ入力(headless)。★解決は本フックの内側 1 か所で行われる。
  const gamepad = usePhysicalRecipeInput({
    moves,
    entries,
    motionCommands,
    rushOn,
    onStepAdd,
    // ★削除は画面の「削除」ボタンと同じ関数を渡す（別の削除経路を書かない＝指示書 §4.2-2）。
    onStepDelete,
    onSave,
    canSave,
    onOpenLastStepModifiers,
    stepCount,
  });

  // 点灯用(§4.4)。状態源は論理ボタン層であって確定したステップではない。
  // ★ニュートラル(5)は点灯させない。方向は「状態」であるため未入力でも direction_neutral が
  //   入っており、そのまま点灯へ回すと「押している間だけ光る」の規約と食い違う
  //   (何も押していないのに recipe-dir-5 が光る。レビュー指摘 中-2)。
  // ★M21-05: 出し分けを `connected`(パッドを観測できている)から `inputActive`
  //   (パッド **または** 登録済みキーボード)へ広げた。`connected` のままだと、
  //   コントローラを持たない利用者はキーボードで入力しても点灯しない。
  const heldDirection =
    gamepad.inputActive && gamepad.held.direction !== "direction_neutral"
      ? numpadFromDirection(gamepad.held.direction)
      : null;
  const heldAttacks = useMemo(
    () => new Set<string>(gamepad.held.buttons),
    [gamepad.held.buttons],
  );
  // マクロの「投げ」は解決時に前投げ/後ろ投げへ分かれる(§9.2-7)。点灯も同じ向きに合わせる。
  const heldSystemButtons = useMemo(() => {
    const set = new Set<LogicalButton>();
    for (const button of gamepad.held.buttons) {
      if (button === "throw") {
        set.add(
          heldDirection === 1 || heldDirection === 4 || heldDirection === 7
            ? "throw_back"
            : "throw_forward",
        );
        continue;
      }
      set.add(button);
    }
    return set;
  }, [gamepad.held.buttons, heldDirection]);

  // ★共通技を常設行からタブへ移設したため、点灯も move_code の集合で渡す(M30-01 追補)。
  //   ★移設前は SystemRow が論理ボタンで受けていた。渡さないと点灯が静かに消える。
  const heldCommonCodes = useMemo(() => {
    const set = new Set<string>();
    for (const button of heldSystemButtons) {
      const code = SYSTEM_BUTTON_TO_MOVE_CODE[button];
      if (code) set.add(code);
    }
    return set;
  }, [heldSystemButtons]);

  const handleRushToggle = () => {
    setRushOn((prev) => {
      const next = !prev;
      // ラッシュ ON で上系(7/8/9 = 空中)方向にいた場合はニュートラルに戻す(空中ラッシュ不可)。
      if (next && direction >= 7) setDirection(5);
      return next;
    });
  };

  return (
    <div
      className="space-y-2"
      // ★M37-02 段 1: 縦寸法の前後比較で使う計測アンカー。**描画には影響しない**——
      //   段 1(変更前)と段 6(変更後)が同じ要素を測るために、レイアウト変更の前に足した。
      data-testid="recipe-controller-root"
      // 最後に触った面を物理入力の受け手にする(2026-08-13 開発者判断)。
      // ★入力面は同時に複数マウントされうるため、受け手を 1 面に絞らないと多重追加になる。
      onPointerDownCapture={gamepad.claim}
      onFocusCapture={gamepad.claim}
    >
      {/* 見出し行。接続状態表示は右寄せで既存の空き幅へ収める(縦の行数を増やさない)。 */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="text-xs font-medium text-gray-600">{t("controller.panel.heading")}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <GamepadStatusControl
            active={gamepad.active}
            connected={gamepad.connected}
          />
          {/*
            ★キーボードの状態表示は**常に出す**(M21-05 §4.1-3)。パッドの読取表示と違い、
            「まだ登録していない」ことこそ利用者へ伝える必要がある——キーボードは既定の割当を
            持たないため、登録しないと 1 つも入力できない(D-370)。
            ★これは失敗ではなく状態である(§4.1-4)。エラー表示にしない。
          */}
          <KeyboardStatusControl />
          {/*
            ★★M37-02(B10 / 高-1 の是正): 告知を畳んだ形が `"hidden"` のときの**開く導線**。
              見出し行は既に横へ空きがあるため、縦を 1px も増やさない。
            ★`"label-row"` 形では本部品は何も描かない（開くボタンが 2 か所に出ないため）。
            ★★これが無いと `"hidden"` を選んだ瞬間に告知へ到達できなくなり、
              `D-347`「畳むことは落とすことではない —— 明示操作で開ける限り伝える場所は在る」
              という本サブの成立根拠が崩れる。
          */}
          {gamepad.inputActive && <GamepadNoticeOpenButton />}
        </div>
      </div>

      {/*
        物理入力の告知(§4.6)と読取表示(§4.3)。★2 面が同じ部品を描画する。
        ★出し分けは `connected`(機体を観測できている)で行う。`available`(provider の内側か)は
        アプリ全体に provider が常設されるため本番では常に true であり、それで出し分けると
        物理コントローラを一度も接続していない利用者にも常設されてしまう(レビュー指摘 中-1)。
      */}
      {gamepad.inputActive && (
        <div className="space-y-1.5">
          <GamepadInputNotice />
          <GamepadRecipeReadout
            held={gamepad.held}
            resolved={gamepad.resolved}
            unresolved={gamepad.unresolved}
            moves={moves}
            active={gamepad.active}
            shortcut={gamepad.shortcut}
            lastAction={gamepad.lastAction}
            commandMode={gamepad.commandMode}
            commandModeAvailable={gamepad.commandModeAvailable}
            motionReadout={gamepad.motionReadout}
          />
        </div>
      )}

      <Tabs defaultValue="normal">
        {/*
          ★★M30-02 追補(2026-09-09 開発者の実機確認): 最低幅まで縮めるとタブ表示が崩れていた。
            原因＝共通部品 ui/tabs.tsx の TabsList が `h-10`(高さ 40px 固定)を持つこと。
            M30-01 がタブを 4 → 8 枚にしたとき `flex-wrap` だけを足し、高さを開放していなかった。
            ⇒ 折り返した 2 行目以降が箱の外へはみ出す(崩れるのが末尾 3 枚なのはそのため)。
          ★共通部品は触らない —— `h-10` は 1 行に収まる他画面のタブが依存する既定であり、
            変えると波及先が読み切れない。⇒ 呼び出し側で上書きする(cn() が後勝ちで解決する)。
          ★`justify-start` は折り返した 2 行目を左寄せにするため(既定は justify-center)。
        */}
        <TabsList className="h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="normal" data-testid="recipe-tab-normal">
            {t("controller.panel.tabNormal")}
          </TabsTrigger>
          <TabsTrigger value="unique" data-testid="recipe-tab-unique">
            {t("controller.panel.tabUnique")}
          </TabsTrigger>
          {/*
            ★★M30-01(P4M-007 / SM-135): ターゲットコンボタブは**特殊技の隣**へ置く
              (開発者の逐語「特殊技タブの隣にターゲットコンボタブが欲しい」)。
            ★母集団は category='target_combo' の全行である。`is_derived` で絞らない——
              M19-DESIGN-08 §0 が決着させた `NOT (category='target_combo' AND is_derived=1)`
              は **filler 候補から何を除くか**の述語であり、本タブは「出す」側である。
              同じ軸をそのまま裏返すと 126 行中 117 行が入力できず、
              開発者の逐語(SM-135「ターゲットコンボも入力に欲しい」)と真逆になる。
          */}
          <TabsTrigger value="target_combo" data-testid="recipe-tab-target-combo">
            {t("controller.panel.tabTargetCombo")}
          </TabsTrigger>
          <TabsTrigger value="special" data-testid="recipe-tab-special">
            {t("controller.panel.tabSpecial")}
          </TabsTrigger>
          <TabsTrigger value="super_art" data-testid="recipe-tab-super-art">
            SA
          </TabsTrigger>
          {/*
            ★★M30-01(P4M-008 (a)): 未分類タブは**SA の隣**へ置く
              (開発者の逐語「SA の隣に何らかの理由で表示していない技〔強化版必殺技等〕
              だけを出すタブが欲しい」)。
            ★母集団は「他のどのタブからも入力できない技」であり、
              features/combo/moveSurfacing.ts の述語が false を返す行そのものである。
              ⇒ 「非表示」を別途定義していない。定義が 2 つになると必ずずれる。
            ★★【2026-09-10 更新・M30-03】ここに並ぶ族が入れ替わり、**必殺技は 1 件も残らなくなった**。
              ★着手時点(M30-01)の最大の族は「強度接尾辞を持たない必殺技」(seed 実測 291/330)。
                ★A1(強度語がどこにも無い形・実測 187 件)は M30-02 で必殺技タブへ移り
                  (P4M-016・開発者判断 2026-09-09)、
                ★A2(強度語が move_code の**途中**に在る形・実測 105 件)は M30-03 で移った。
              ★★⇒ **いま残るのは必殺技以外の 3 区分だけである**
                (段階1/2 で解決しない normal / 共通技 13 code 以外の投げ / rush_variant の孤児)。
                CSV 由来の基準で 39 行、実 DB・実設定で 41 行。
              ★実 DB での件数は m30-01-controller-surfacing.spec.ts が主張する
                (jamie 2 / mai 1 / blanka 2 / manon 0 / cammy 1 / m_bison 0)。
          */}
          <TabsTrigger value="unclassified" data-testid="recipe-tab-unclassified">
            {t("controller.panel.tabUnclassified")}
          </TabsTrigger>
          {/*
            ★★M30-01(P4M-008 (b)): キャラ固有状態タブ。開発者判断 2026-09-08 の「読み2」
              ＝「キャラ固有の状態(酔いレベル・エレキ溜め・ホールド等)で分岐する技を集めたタブ」。
            ★(a) の未分類タブとは別の 1 枚にする(同判断)。⇒ 2 タブである。
            ★定義を持たないキャラでもタブは出す。空状態の文言で「無い」ことを伝える方が、
              キャラによってタブの枚数が変わるより読み取りやすい。
          */}
          <TabsTrigger value="character_state" data-testid="recipe-tab-character-state">
            {t("controller.panel.tabCharacterState")}
          </TabsTrigger>
          {/*
            ★★M30-01 追補(2026-09-08 開発者指示): 共通技はタブ外の常設行から**タブへ移設**した。
            ★位置は**一番右**である(2026-09-08 開発者の実機確認を経た指示)。
              ⇒ 一度は通常技の次へ置いたが、開発者判断で末尾へ移した。並びは開発者が決める。
          */}
          <TabsTrigger value="common" data-testid="recipe-tab-common">
            {t("controller.panel.tabCommon")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="normal">
          <HitBoxLayout
            moves={inputMoves}
            entries={entries}
            direction={direction}
            onDirectionChange={setDirection}
            rushOn={rushOn}
            onRushToggle={handleRushToggle}
            onAdd={(moveId) => addResolvedMove(moveId)}
            heldDirection={heldDirection}
            heldAttacks={heldAttacks}
          />
        </TabsContent>

        <TabsContent value="unique">
          {/*
            ★★M37-02(B07): ラッシュ版トグルを**枠の中の末尾**へ移した。着手前はパネルの
              外・上・全幅に在り、通常技タブ(枠の中・下)と形が違った。
              ⇒ 通常技側へ揃えた。理由は `RushToggleRow` の冒頭に書いてある。
            ★`recipe-unique-rush-toggle` の testid は変えていない。
            ★通常技タブと同じ `handleRushToggle` を通す(上系方向のリセット補正を共有。
              M17-03 レビュー指摘)。
          */}
          <DirectSpecPanel
            moves={inputMoves}
            list={buckets.unique}
            emptyLabel={t("controller.panel.uniqueEmpty")}
            onAdd={(moveId) => addResolvedMove(moveId)}
            rushOn={uniqueRushAvailable && rushOn}
            footer={
              uniqueRushAvailable ? (
                <RushToggleRow
                  checked={rushOn}
                  onToggle={handleRushToggle}
                  ariaLabel={t("controller.rush.specialToggleAria")}
                  label={t("controller.rush.label")}
                  hint={t("controller.rush.specialHint")}
                  testId="recipe-unique-rush-toggle"
                />
              ) : undefined
            }
          />
        </TabsContent>

        <TabsContent value="target_combo">
          <DirectSpecPanel
            moves={inputMoves}
            list={buckets.targetCombo}
            emptyLabel={t("controller.panel.targetComboEmpty")}
            onAdd={(moveId) => addResolvedMove(moveId)}
            testIdPrefix="recipe-target-combo"
          />
        </TabsContent>

        <TabsContent value="special">
          <SpecialMovePanel moves={inputMoves} onAdd={addResolvedMove} />
        </TabsContent>

        <TabsContent value="super_art">
          <DirectSpecPanel
            moves={inputMoves}
            list={buckets.superArt}
            emptyLabel={t("controller.panel.saEmpty")}
            onAdd={(moveId) => addResolvedMove(moveId)}
          />
        </TabsContent>
        <TabsContent value="unclassified">
          <DirectSpecPanel
            moves={inputMoves}
            list={buckets.unclassified}
            emptyLabel={t("controller.panel.unclassifiedEmpty")}
            onAdd={(moveId) => addResolvedMove(moveId)}
            testIdPrefix="recipe-unclassified"
          />
        </TabsContent>

        <TabsContent value="character_state">
          <DirectSpecPanel
            moves={inputMoves}
            list={buckets.characterState}
            emptyLabel={t("controller.panel.characterStateEmpty")}
            onAdd={(moveId) => addResolvedMove(moveId)}
            testIdPrefix="recipe-character-state"
          />
        </TabsContent>
        <TabsContent value="common">
          <CommonMovePanel
            moves={inputMoves}
            list={buckets.common}
            onAdd={(moveId) => addResolvedMove(moveId)}
            onRawRush={() => handleSystemButton("parry_drive_rush")}
            heldCodes={heldCommonCodes}
          />
        </TabsContent>
      </Tabs>

      <DeleteRow onDelete={() => handleSystemButton("step_delete")} />
    </div>
  );
}
