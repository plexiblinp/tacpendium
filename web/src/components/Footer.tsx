import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { List, Bookmark, Plus, Settings } from "lucide-react";

export default function Footer() {
  const { t } = useTranslation();
  const location = useLocation();

  const buttons = [
    { label: t("footer.combos"), icon: <List size={20} />, to: "/combos" },
    { label: t("footer.myCombos"), icon: <Bookmark size={20} />, to: "/mycombo" },
    { label: t("footer.newCombo"), icon: <Plus size={24} />, to: "/combos/new", highlighted: true },
    { label: t("footer.settings"), icon: <Settings size={20} />, to: "/settings" },
  ];

  const isActive = (to: string): boolean => {
    if (to === "/combos") {
      return location.pathname === "/combos" || location.pathname === "/";
    }
    return location.pathname.startsWith(to);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 sm:hidden"
      aria-label={t("footer.nav")}
    >
      <div className="flex items-end justify-around px-2 py-1">
        {buttons.map((btn) => {
          const active = !btn.highlighted && isActive(btn.to);
          return (
            <Link
              key={btn.to}
              to={btn.to}
              className={
                btn.highlighted
                  ? "flex flex-col items-center justify-center w-14 h-14 -mt-4 rounded-full bg-blue-600 text-white shadow-lg"
                  : `flex flex-col items-center justify-center px-2 py-1.5 ${active ? "text-blue-600" : "text-slate-500"}`
              }
            >
              {btn.icon}
              <span className={btn.highlighted ? "text-[10px] mt-0.5" : "text-xs mt-0.5"}>
                {btn.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
