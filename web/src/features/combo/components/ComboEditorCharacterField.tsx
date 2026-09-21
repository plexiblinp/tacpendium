import { useTranslation } from "react-i18next";

import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { useCharacterName } from "@/features/character/hooks/useCharacters";

interface Props {
  characterId: number;
  // new/copy: プルダウンで選択可。edit: 固定表示(変更不可)。
  mode: "new" | "edit" | "copy";
  onChange: (characterId: number) => void;
  // 確定反撃サーチ等、遷移元の文脈でキャラクターが固定される場合の説明。
  lockedReason?: string;
}

// コンボ登録/編集画面のキャラクター選択 UI(DES-005 §5.7 表示項目1・2)。
//   - 表示項目1: 現在選択中キャラクターの情報バー(アイコン+名前)
//   - 表示項目2: キャラクター選択プルダウン(新規/コピー時のみ。編集時は固定表示)
//
// M15-05 追補: 縦幅圧縮のため単一行のコンパクト表示にした。new/copy では名前が
// CharacterSelector のトリガに出るため、情報バーの大きな名前(重複)は出さず小アバターのみ。
// edit では小アバター + 名前 + 変更不可注記を1行で表示する。
//
// M24-01 §4.1-4(SM-119): 見出し「このコンボのキャラ」を付けて、フィルタから伝播してきた値では
// なく「このコンボの属性」であることを読めるようにした。★入力部品(CharacterSelector)は
// 触っていない——memo が言う「不自然」は、フィルタと新規登録の入力を概念として分けることで
// 解く。伝播そのものは切らない(切ると SM-044「戻ったときにキャラを維持したい」と衝突する)。
export function ComboEditorCharacterField({
  characterId,
  mode,
  onChange,
  lockedReason,
}: Props) {
  const { t } = useTranslation();
  const characterName = useCharacterName(characterId);
  const initial = characterName ? characterName.charAt(0) : "?";
  const isFixed = mode === "edit" || lockedReason != null;
  const fixedReason =
    lockedReason ?? (mode === "edit" ? "編集モードでは変更不可" : "");

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
      <div className="mb-1 text-xs font-bold text-emerald-700">
        {t("comboEditor.characterField")}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
          {initial}
        </div>
        {isFixed ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-emerald-900">
              {characterName || "—"}
            </span>
            <span className="text-xs text-emerald-700">({fixedReason})</span>
          </div>
        ) : (
          <CharacterSelector selectedCharacterId={characterId} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
