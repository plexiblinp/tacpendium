import { useState } from "react";
import { useTranslation } from "react-i18next";

import Header from "@/components/Header";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { useResolvedCharacterId } from "@/features/combo/hooks/useResolvedCharacterId";
import { useTrashCombos } from "@/features/combo/hooks/useTrashCombos";
import { TrashList } from "@/features/combo/components/TrashList";
import { TrashBulkActions } from "@/features/combo/components/TrashBulkActions";
import { useTrashSetups } from "@/features/setup/hooks/useTrashSetups";
import { TrashSetupList } from "@/features/setup/components/TrashSetupList";

export function TrashPage() {
  const { t } = useTranslation();

  // ★★M24-08 第 2 部 A: キャラを選べるようにした(D-611 / D-617)。
  //
  // 着手前はキャラ ID が 1 に固定され、「複数キャラ対応時に CharacterSelector へ
  // 差し替える」旨の申し送りが付いていた(M23-RESEARCH-01 が発見・計測点 M-102)。
  // サーバは着手前から character_id を変数として扱っており、BE は変えていない。
  //
  // ★既定値は useResolvedCharacterId に合流させた(本画面が 6 番目の呼び手)。
  //   画面ごとに既定を決めると「いま対象にしているキャラ」の規則がその画面の分だけ
  //   増えるため、lib/constants.ts:19-21 がそれを明示的に禁じている。
  //   固定値 1 はまさにその残骸だった。
  // ★選択後は選択値が勝つ。未選択の間は解決値が効く(config の取得完了で解決値が
  //   動きうるため、null を「まだ選んでいない」の意味で保持する)。
  const resolvedCharacterId = useResolvedCharacterId();
  const [pickedCharacterId, setPickedCharacterId] = useState<number | null>(null);
  const characterId = pickedCharacterId ?? resolvedCharacterId;

  // ★★選択状態はコンボ用とセットプレイ用の 2 本に分ける(M23-06 §4.4 案 b)。
  //   1 本の id 配列に混ぜない——id が衝突し、コンボの id でセットプレイの API を
  //   叩く経路が構造的に作れてしまう。★取り違えると別のデータが消える。
  // ★2 本に分けたことで「全選択」の対象が自然に「表示中のテーブルの中だけ」になる
  //   (§4.4-2)。各テーブルは自分のぶんの配列しか受け取らない。
  // ★ブラウザストレージへは保存しない。画面内の一時状態である(CLAUDE.md §10.X)。
  const [selectedComboIds, setSelectedComboIds] = useState<number[]>([]);
  const [selectedSetupIds, setSelectedSetupIds] = useState<number[]>([]);

  const { data, isLoading, error, refetch } = useTrashCombos(characterId);

  // M23-02: セットプレイのゴミ箱。★コンボ側とは別のクエリ・別のテーブルである。
  const {
    data: trashSetups,
    isLoading: setupsLoading,
    error: setupsError,
    refetch: refetchSetups,
  } = useTrashSetups(characterId);

  const combos = data?.items ?? [];
  const setups = trashSetups ?? [];

  const selectedCombos = combos.filter((c) => selectedComboIds.includes(c.id));
  const selectedSetups = setups.filter((s) => selectedSetupIds.includes(s.id));

  // ★キャラを切り替えたら選択を捨てる。残すと、画面に出ていない行を
  //   一括操作バーが掴んだままになる(id はグローバルに一意なので実害は出ないが、
  //   キャラを戻したときに選択が甦って利用者を驚かせる)。
  const handleCharacterChange = (nextCharacterId: number) => {
    setPickedCharacterId(nextCharacterId);
    setSelectedComboIds([]);
    setSelectedSetupIds([]);
  };

  const handleComplete = () => {
    setSelectedComboIds([]);
    setSelectedSetupIds([]);
    void refetch();
    void refetchSetups();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header sticky />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* ★★キャラ選択は見出しと同じ帯へ置く。コンボ表とセットプレイ表の
            「両方」を 1 つのセレクタが支配することが視覚的に読めるようにするため。
            ★セットプレイ節(下の <section>)の中へ置いてはいけない——
              セットプレイ側だけに効くように見え、まさに「片方だけ直した」と
              誤読される形になる。 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-800">{t("trash.heading")}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {t("trash.characterLabel")}
            </span>
            <CharacterSelector
              selectedCharacterId={characterId}
              onChange={handleCharacterChange}
              ariaLabel={t("trash.characterLabel")}
              data-testid="trash-character-selector"
            />
          </div>
        </div>
        <p className="mb-4 text-xs text-slate-400">{t("trash.characterNote")}</p>

        {isLoading && (
          <p className="py-8 text-center text-slate-500">{t("trash.loading")}</p>
        )}

        {error && (
          <p className="py-8 text-center text-red-500">
            {t("trash.combo.loadError")}
          </p>
        )}

        {!isLoading && !error && (
          <TrashList
            combos={combos}
            selectedIds={selectedComboIds}
            onSelectionChange={setSelectedComboIds}
            onComboChanged={() => void refetch()}
          />
        )}

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-slate-800">
            {t("trash.setup.heading")}
          </h2>

          {setupsLoading && (
            <p className="py-6 text-center text-slate-500">{t("trash.loading")}</p>
          )}

          {setupsError && (
            <p className="py-6 text-center text-red-500">
              {t("trash.setup.loadError")}
            </p>
          )}

          {!setupsLoading && !setupsError && (
            <TrashSetupList
              setups={setups}
              selectedIds={selectedSetupIds}
              onSelectionChange={setSelectedSetupIds}
              onSetupChanged={() => void refetchSetups()}
            />
          )}
        </section>

        {/* ★★M23-07 §4.4-2: 一括操作バーの置き場。★コンボ表の上ではなく、両方の表の
            下へ置いて画面下部へ sticky で貼り付ける。
            理由——バーはコンボ表とセットプレイ表の両方を受け持つ(§4.4)のに、
            コンボ表の上に固定されていたため、セットプレイだけを選んだ利用者は
            操作するために画面上部まで戻る必要があった。
            ★M23-06 により結果が残る間はバーが表示され続けるようになったため、
            上に居座る時間も長くなっている(CHANGE-127)。
            ★表ごとに 2 本置かない——混在した選択を 1 回の操作で処理できないと、
            利用者は表を往復することになる。
            ★sticky の指定はバー自身が持つ。ここでラッパ div を被せると、バーが
            null を返している間も枠線だけが残る。 */}
        <TrashBulkActions
          selectedCombos={selectedCombos}
          selectedSetups={selectedSetups}
          onComplete={handleComplete}
        />
      </main>
    </div>
  );
}
