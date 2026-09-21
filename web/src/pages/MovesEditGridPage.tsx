import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Header from "@/components/Header";
import { useCharacters } from "@/features/character/hooks/useCharacters";
import CharacterSelector from "@/features/mycombo/components/CharacterSelector";
import { useMovesByCharacter } from "@/features/moves/api";
import { MoveEditGrid } from "@/features/moves/MoveEditGrid";

// MovesEditGridPage は取込済み moves をキャラ単位で手動修正する画面(FR703、DES-005 §5.18 画面18)。
// 取込プレビュー(画面17)とは別画面であった(画面17 は CHANGE-055 / M14-02 で削除済)。
//
// ★★★M38-02(2026-09-17・D-892): 本画面へのナビ導線を Header から外した。
//   ⇒ 消したのではない。**この画面・ルート・テストは意図して残してある。**
//   外した理由: 利用者に見せないため。★技データの是正はマイグレーションで行うので、
//   本画面はその手段ではない。
//   残す理由: **削除コストが高かったから**である(開発者判断 2026-09-17)。
//   ★つまり「積極的に活かす予定があるから残っている」のではない。
//   ⇒ それでも消してよいことにはならない —— 消すには本画面・ルート・API 経路
//   (GET/PATCH /api/moves、POST /api/moves/:id/rush-variant)・14 本の単体テスト・
//   4 本の E2E を一括で畳む必要があり、その判断は開発者の手番である。
//   ★「どこからも参照されていないから消してよい」と判断しないこと。
//   URL 直打ち(/moves/edit)で着ける状態は維持する。
export default function MovesEditGridPage() {
  const { data: characters } = useCharacters();
  const [characterId, setCharacterId] = useState<number | null>(null);
  const moves = useMovesByCharacter(characterId);

  // URL の ?character=<code> で、当該キャラを事前選択する。
  // characters ロード後・未選択時のみ解決し、ユーザーが手動で別キャラに変えた後は上書きしない。
  // ★M38-02 是正: 旧記述は「取込画面からの導線」と書いていたが、その生成元であった
  //   moves 取込プレビュー(画面17)は CHANGE-055 / M14-02 で削除済であり、現在この
  //   クエリを付けて遷移してくる画面はコード上に 1 つも無い。⇒ 実体は URL 直打ち
  //   (およびブックマーク)のための口である。M38-02 でナビ導線を外した後も同じ。
  const [searchParams] = useSearchParams();
  const characterParam = searchParams.get("character");
  useEffect(() => {
    if (characterId != null || !characterParam || !characters) return;
    const match = characters.find((c) => c.code === characterParam);
    if (match) setCharacterId(match.id);
  }, [characters, characterParam, characterId]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-screen-2xl space-y-4 p-4">
        <h1 className="text-xl font-bold">技マスタ編集</h1>
        <p className="text-sm text-muted-foreground">
          取込済みの技を手動修正します(total・各フレーム・属性・空中判定・notes
          付記の編集、ラッシュ版の生成)。
        </p>

        <div className="max-w-xs">
          <CharacterSelector
            selectedCharacterId={characterId}
            onChange={setCharacterId}
            placeholder="キャラクターを選択"
            ariaLabel="キャラクター選択"
          />
        </div>

        {characterId != null && (
          <>
            {moves.isLoading && (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            )}
            {moves.data && (
              <MoveEditGrid characterId={characterId} moves={moves.data} />
            )}
          </>
        )}
      </main>
    </>
  );
}
