import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppRouter from "@/router";
import { PhysicalInputProvider } from "@/features/physical-input/PhysicalInputProvider";
import { useConfig } from "@/features/config/useConfig";
import { useIsMobile } from "@/hooks/useIsMobile";
import Footer from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";
import { NavigationGuardProvider } from "@/features/navigation-guard/NavigationGuardProvider";

// M24-04(SM-060): ヘッダの帯(h-14 = 56px)を越える位置へトーストを出す。
// ★ヘッダの高さを変えたらここも変える。数字を 2 か所に散らさないため定数にしてある。
const TOAST_TOP_OFFSET = "72px";

export default function App() {
  const { t } = useTranslation();
  const { data, isLoading } = useConfig();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (data && !data.isInitialized && location.pathname !== "/wizard") {
    return <Navigate to="/wizard" replace />;
  }

  if (location.pathname === "/" && !isMobile) {
    return <Navigate to="/combos" replace />;
  }

  const showFooter = location.pathname !== "/wizard";

  return (
    // M21-03: 物理入力の受け手の調停・判定・配送チャネルを 1 組だけ持つ(rAF ループ・
    // 同時押し判定・プロファイル解決・受け手の調停)。入力面は同時に複数マウントされうるため、
    // 面ごとに持たせると入力が多重にステップ化される。★入力面が 1 つも無い間はループを回さない。
    //
    // ★M21-05 で供給元は 2 つになった(Gamepad の rAF ＋ キーボードの KeyboardEvent)。
    //   1 組なのは受け手・判定・配送であって供給元ではない。2 源は `mergeNormalized` が
    //   1 本の押下集合へ合流させてから判定へ渡す(詳細は PhysicalInputProvider.tsx 冒頭)。
    <PhysicalInputProvider>
      {/* M24-04(CO-003): 未保存のまま離れようとしたときの確認。★ルータの内側に置く
          ——遷移先の解決に useNavigate を使うため。★1 組だけ持つ(離脱の入口を
          1 か所で捕まえる形にしてあり、面ごとに持たせる部品ではない)。 */}
      <NavigationGuardProvider>
        <div className={showFooter ? "pb-16 sm:pb-0" : ""}>
          <AppRouter />
        </div>
        {showFooter && <Footer />}
      </NavigationGuardProvider>
      {/* M24-04(SM-060): 「保存成功のダイアログがしばらく消えず、ヘッダでの画面遷移を
          一時的に邪魔する」への対処。
          ★実測(2026-08-27)——表示時間は sonner 既定の 4000ms、位置は top-center で
            実効 top:24px、z-index は 999999999。ヘッダは高さ 56px(h-14)・z-10 なので、
            トーストは常に前面でヘッダの帯と重なる。⇒ 症状は「長い」ではなく「重なる」であり、
            指示書 §4.6 の分岐は (b)「位置を変える」が正しい。表示時間は変えない。
          ★offset はヘッダ(56px)の下端を越える値。mobileOffset はフッタではなく上端側の
            指定で、モバイルのヘッダ高も同じ 56px であるため同値にする。
          ★closeButton: 利用者が明示的に消せる経路を 1 つ残すため(指示書 §4.6)。 */}
      <Toaster
        position="top-center"
        offset={{ top: TOAST_TOP_OFFSET }}
        mobileOffset={{ top: TOAST_TOP_OFFSET }}
        closeButton
      />
    </PhysicalInputProvider>
  );
}
