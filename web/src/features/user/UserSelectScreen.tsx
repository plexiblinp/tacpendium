import { useTranslation } from "react-i18next";

import type { User } from "./types";

interface Props {
  users: User[];
  onSelect: (id: number) => void;
}

/**
 * UserSelectScreen は「誰として操作するか」を選ばせる(DES-005 §5.3)。
 *
 * ★これは認証ではない。パスワードは求めない——簡易パスワードは全員共通の 1 本で
 * 入場ゲートとして働き、誰が入ったかは区別しない(DES-002 §8 / CHANGE-112)。
 * ★`DES-005` §5.3 の現行記述(「パスワード設定ユーザーはパスワード入力→認証」)は
 * as-built と食い違っており、CHANGE-113 で改訂される。
 *
 * ★2 人以上のときだけ出る(FR502)。PC・スマホともグリッド表示(§5.3)。
 */
export default function UserSelectScreen({ users, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-lg w-full">
        <h1 className="text-lg font-semibold mb-2" data-testid="user-select-title">
          {t("user.select.title")}
        </h1>
        <p className="text-sm text-gray-600 mb-6">{t("user.select.description")}</p>

        <div className="grid grid-cols-2 gap-3" data-testid="user-select-grid">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelect(user.id)}
              className="px-4 py-3 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 break-all"
              data-testid={`user-select-item-${user.id}`}
            >
              {user.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
