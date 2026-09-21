import { useTranslation } from "react-i18next";

import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/SearchableSelect";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import { characterDisplayName, sortCharactersByLocale } from "@/lib/character-sort";

// キャラ選択の共有部品(M24-02 §4.3 / CHANGE-133)。
//
// ★M24-02 で「平坦な <select>」から「検索欄付きコンボボックス + ロケール依存の昇順」へ変えた。
//   キャラは現行 19 体で今後も増えるため、並べるだけでは探せなくなる(ledger SM-043 / SM-120 / SM-136)。
//
// ★★本部品を直すと、キャラを選ぶ UI が一括で揃う。
//   ★件数は数え直した値である(M24-02 レビュー 高-4。初出の「12 / 9」は誤りだった)。
//   現在の実測 = 14 コントロール / 12 ファイル。
//     - M24-02 まで: 13 コントロール / 11 ファイル
//       (マイコンボ / エディタ / 比較の追加モーダル / パニッシュ一覧〔自・相手〕 /
//        パニッシュ検索〔自・相手〕 / 技マスタ編集 / プリセット編集 / ウィザード / 設定
//        ＋ M24-02 で寄せた 一覧のヘッダ帯 ComboListPage / 他から引っ越し IntakeHelperPage)
//     - M24-08 で寄せた: 1 コントロール / 1 ファイル
//       (ゴミ箱 TrashPage。★着手前はキャラ ID が 1 に固定されていた＝D-611 / D-617)
//   ★数え方は `grep -rn "<CharacterSelector" web/src --include=*.tsx | grep -v test`
//     (★本コメント自身がこの grep に当たるため、数えるときは 1 引くこと)。
//   ★「利用者がキャラを選ぶ UI」の全数は別の量である。
//     ComboExportPage の「キャラクター ID」数値入力は M24-06 で画面ごと廃止したため
//     対象から外れた。**M24-08 で TrashPage の固定値も畳んだため、
//     本部品を通らないキャラ選択は現在残っていない。**
//
// ★並び順の既知の例外(漢字は末尾・ラテン文字は先頭)は lib/character-sort.ts に書いてある。

interface CharacterSelectorProps {
  // null は「未選択」を表す(pick モード用)。閲覧/設定系の呼び出しは number を渡す。
  selectedCharacterId: number | null;
  onChange: (characterId: number) => void;
  // 指定時 = pick モード。未選択(null)で placeholder を表示し、単一キャラでも無効化しない。
  // 技マスタ編集の「キャラ選択 → グリッド表示」フローのように、初回選択が画面の起点になる用途で使う。
  placeholder?: string;
  // トリガに付与するアクセシブル名。スクリーンリーダー/E2E のラベル特定に用いる。
  ariaLabel?: string;
  // トリガに足すクラス(面ごとの幅・高さの調整用)。
  triggerClassName?: string;
  "data-testid"?: string;
}

export default function CharacterSelector({
  selectedCharacterId,
  onChange,
  placeholder,
  ariaLabel,
  triggerClassName,
  ...rest
}: CharacterSelectorProps) {
  const { t, i18n } = useTranslation();
  const { data: characters, isLoading } = useCharacters();
  const isSingleCharacter = characters && characters.length <= 1;
  // pick モード(placeholder 指定)では単一キャラでも初回選択を許可する(無効化しない)。
  const pickMode = placeholder !== undefined;
  const disabled = isLoading || (!pickMode && Boolean(isSingleCharacter));

  // ★並べ替えは表示時に行う。データ取得時に固定しない(§4.3.1)。
  // ★★M24-07: ラベルと並べ替えキーを**同時に**ロケールへ従わせる(followup
  //   character-selector-label-is-ja-fixed)。片方だけ変えると、表示が日本語のまま
  //   並びだけ英語順になり無順序に見える(M24-02 で実際に起きた = レビュー 高-5)。
  //   ⇒ 同じ locale を両方へ渡す。
  const sorted = sortCharactersByLocale(characters ?? [], i18n.language);

  const options: SearchableSelectOption<number>[] = sorted.map((char) => ({
    value: char.id,
    label: characterDisplayName(char, i18n.language),
    // ★「ryu」でも「リュウ」でも引けるようにする。
    searchTexts: [char.nameJa, char.nameEn, char.code],
  }));

  // 一覧がまだ取得できていないのに選択 id だけある場合の受け皿。
  // 旧実装(Radix Select)の "---" 項目と同じ役割で、トリガが空白になるのを防ぐ。
  if (options.length === 0 && selectedCharacterId != null) {
    options.push({
      value: selectedCharacterId,
      label: "---",
      searchTexts: ["---"],
    });
  }

  return (
    <SearchableSelect
      mode="single"
      options={options}
      selected={selectedCharacterId}
      onChange={onChange}
      placeholder={placeholder ?? ""}
      searchPlaceholder={t("common.characterSearchPlaceholder")}
      emptyMessage={t("common.characterNotFound")}
      triggerAriaLabel={ariaLabel}
      disabled={disabled}
      triggerClassName={triggerClassName ?? "min-w-[120px] h-9"}
      data-testid={rest["data-testid"]}
    />
  );
}
