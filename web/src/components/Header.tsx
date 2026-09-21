import { Link, useLocation } from "react-router-dom";
import { Menu, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/user/CurrentUserProvider";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavLink {
  to: string;
  label: string;
}

// ★M20-04(2026-08-13): 「プリセット管理」が最後の disabled リンクだった。
// /presets を実装して有効化したため、NavLink の disabled / tooltip と
// span + cursor-not-allowed の分岐は到達不能になり削除した。
// 再び未実装リンクを置くときは Git 履歴から戻せる。
const NAV_LINKS: NavLink[] = [
  { to: "/combos", label: "コンボ一覧" },
  { to: "/mycombo", label: "マイコンボ" },
  { to: "/compare", label: "コンボ比較" },
  { to: "/punish/search", label: "確定反撃サーチ" },
  { to: "/punish/list", label: "確定反撃マイリスト" },
  { to: "/tags/manage", label: "タグ管理" },
  // ★M24-07(SM-110): 「インポート」→「取込」へ統一(開発者判断 2026-08-30)。
  //   画面表示の実数は「取込」約 43 件に対し「インポート」3 件であり、少数側を寄せた。
  // ★取込ヘルパーは「引っ越し取込」へ改称——他のアプリ・メモ・表計算で管理していた
  //   コンボを本アプリへ移すための支援機能である、という目的を名前に出す。
  // ★★M38-02(2026-09-17・D-892): その「引っ越し取込」を「他から引っ越し」へ再改称した
  //   (2 度目の改名)。旧名が書き戻らないよう retired-words.test.ts が見張っている。
  { to: "/import/combo", label: "取込" },
  { to: "/import/combo/helper", label: "他から引っ越し" },
  // ★★M38-02(2026-09-17・D-892): 技編集(/moves/edit)のナビをここから外した。
  //   理由は「利用者に見せない」であり、技データの是正はマイグレーションで行う。
  //   ★ルートと画面を残したのは、削除コストが高かったからである。
  //   ⇒ 「導線が無い＝不要」ではない(詳細は MovesEditGridPage.tsx 冒頭)。
  //   URL 直打ちでは従来どおり着ける。
  { to: "/presets", label: "プリセット管理" },
  { to: "/trash", label: "ゴミ箱" },
  { to: "/settings", label: "設定" },
];

interface HeaderProps {
  sticky?: boolean;
}

export default function Header({ sticky }: HeaderProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { current, multiUser, reselect } = useCurrentUser();

  // ★「誰として操作しているか」は 2 人以上のときだけ出す(開発者裁定 2026-08-16)。
  // 1 人しかいない環境では選択画面も出ない(FR502)。同じ考え方で、ヘッダにも
  // 出さない——1 人運用の画面をいままでと変えないためである。
  // ★Provider の外で描かれたとき(既存の Header 単体テスト)は context の既定値が
  // multiUser: false のため、ここは描かれない。
  const showCurrentUser = multiUser && current !== null;

  return (
    <header
      className={cn(
        "bg-white border-b border-slate-200 shadow-sm",
        sticky && "sticky top-0 z-10"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/combos" className="font-bold text-lg text-slate-800">
          Tacpendium
        </Link>

        {/* min-w-0 + overflow-x-auto: リンクが増えて 1 行に収まらなくなったとき、nav の外へ
            はみ出して本文のクリックを妨げるのではなく nav 内でスクロールさせる(M18-03a で
            13 本目を足した際、1280px 幅ではみ出し全画面のクリックが詰まった)。収まる幅では
            見た目は従来どおり。 */}
        <nav className="hidden sm:flex items-center gap-4 min-w-0 overflow-x-auto whitespace-nowrap">
          {NAV_LINKS.map((link) => {
            const isCurrent = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "text-sm text-slate-600 hover:text-blue-600",
                  isCurrent && "font-bold text-blue-600 pointer-events-none"
                )}
                aria-current={isCurrent ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* ★押すと利用者選択へ戻る(開発者裁定 2026-08-16)。設定画面まで行かずに
              切り替えられる。URL は動かない——選択画面は条件表示であり、履歴に
              「済んだ画面」を積まないためである(指示書 §4.8-5)。 */}
          {showCurrentUser && (
            <button
              type="button"
              onClick={reselect}
              aria-label={t("user.headerAria", { name: current.name })}
              title={t("user.reselect")}
              className="flex items-center gap-1 shrink-0 max-w-[8rem] px-2 py-1 rounded text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              data-testid="header-current-user"
            >
              <User className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{current.name}</span>
            </button>
          )}

          <Sheet>
            <SheetTrigger className="sm:hidden p-1" aria-label="メニューを開く">
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>メニュー</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-2">
                {NAV_LINKS.map((link) => {
                  const isCurrent = pathname === link.to;
                  return (
                    <SheetClose asChild key={link.to}>
                      <Link
                        to={link.to}
                        className={cn(
                          "py-2 text-slate-700 hover:text-blue-600",
                          isCurrent && "font-bold text-blue-600 pointer-events-none"
                        )}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
