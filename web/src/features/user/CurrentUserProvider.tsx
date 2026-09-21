import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { setUserIdProvider } from "@/lib/http-interceptor";
import UserSelectScreen from "./UserSelectScreen";
import { useUsers } from "./useUsers";
import type { User } from "./types";

interface CurrentUserValue {
  /** 選択中の利用者。未選択なら null。 */
  current: User | null;
  /**
   * 利用者が 2 人以上いるか。
   *
   * ★「誰として操作しているか」を画面へ出すかの判定に使う(ヘッダ表示＝指摘 ⑤)。
   * 1 人しかいない環境では選択画面も出さない(FR502)。同じ考え方で、
   * ヘッダにも出さない——1 人運用の画面はいままでと変わらないままにする。
   */
  multiUser: boolean;
  /** 選び直しを始める(選択画面へ戻す)。 */
  reselect: () => void;
}

// ★既定値は「1 人・未選択」。Provider の外で描かれた画面(既存の Header の
// 単体テスト等)が、利用者表示を出さずにそのまま動くようにするためである。
const CurrentUserContext = createContext<CurrentUserValue>({
  current: null,
  multiUser: false,
  reselect: () => {},
});

/** useCurrentUser は選択中の利用者と選び直しの導線を返す。 */
export function useCurrentUser(): CurrentUserValue {
  return useContext(CurrentUserContext);
}

interface Props {
  children: ReactNode;
}

/**
 * CurrentUserProvider は「誰として操作するか」を決め、その値を送信経路へ供給する。
 *
 * ★選んだ利用者は保持しない(CHANGE-113 §7-1 の案 (α)＝D-401)。
 * 保持先を持たず React の状態だけに置くため、画面を再読み込みすると選択画面へ戻る。
 * ★これは欠陥ではなく、採った案の帰結である。ブラウザストレージのキーを増やさず、
 * サーバにも状態を増やさない——「無効なら何も増えない」と衝突しない唯一の案だった。
 *
 * ★利用者が 1 人なら選択画面を出さず自動で選ぶ(FR502)。
 * ⇒ 無効かつ 1 人なら、いままでと変わらない。
 *
 * ★URL を持たせない条件表示にしてある。戻る・進むで「選択済みなのに選択画面へ戻る」
 * ことを避けるためである(指示書 §4.8-5)。
 */
export default function CurrentUserProvider({ children }: Props) {
  const { t } = useTranslation();
  const { data: users, isLoading } = useUsers();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // ★送信経路(fetch ラッパ)は同期的に読む。state ではなく ref を見せる。
  const selectedIdRef = useRef<number | null>(null);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    setUserIdProvider(() => selectedIdRef.current);
    return () => setUserIdProvider(null);
  }, []);

  // 1 人なら自動で選ぶ(FR502)。
  useEffect(() => {
    if (selectedId === null && users?.length === 1) {
      setSelectedId(users[0].id);
    }
  }, [users, selectedId]);

  const reselect = useCallback(() => setSelectedId(null), []);

  const current = useMemo(
    () => users?.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  const multiUser = (users?.length ?? 0) > 1;

  const value = useMemo<CurrentUserValue>(
    () => ({ current, multiUser, reselect }),
    [current, multiUser, reselect],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  // ★一覧が読めなかったときはアプリを止めない。サーバ側は X-User-Id が無ければ
  // users.id の最小値へ倒すため、いままでどおり動く。
  const needsSelection = multiUser && selectedId === null;
  if (needsSelection && users) {
    return <UserSelectScreen users={users} onSelect={setSelectedId} />;
  }

  return (
    <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
  );
}
