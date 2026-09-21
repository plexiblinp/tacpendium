import { Navigate, Route, Routes } from "react-router-dom";
import HealthCheckPage from "@/pages/HealthCheckPage";
import ComboListPage from "@/pages/ComboListPage";
import HomePage from "@/pages/HomePage";
import ComboDetailPage from "@/pages/ComboDetailPage";
import { ComboEditorPage } from "@/pages/ComboEditorPage";
import { TrashPage } from "@/pages/TrashPage";
import TrashComboDetailPage from "@/pages/TrashComboDetailPage";
import TagManagementPageRoute from "@/pages/TagManagementPageRoute";
import MyComboPageRoute from "@/pages/MyComboPageRoute";
import { SetupEditorPage } from "@/pages/SetupEditorPage";
import ComparePage from "@/pages/ComparePage";
import WizardPage from "@/pages/WizardPage";
import SettingsPage from "@/pages/SettingsPage";
import MovesEditGridPage from "@/pages/MovesEditGridPage";
import ComboImportPage from "@/pages/ComboImportPage";
import IntakeHelperPage from "@/pages/IntakeHelperPage";
import PunishListPage from "@/pages/PunishListPage";
import PunishSearchPage from "@/pages/PunishSearchPage";
import PresetListPage from "@/pages/PresetListPage";
import PresetEditPage from "@/pages/PresetEditPage";
import GameUpdateCombosPage from "@/pages/GameUpdateCombosPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/combos" element={<ComboListPage />} />
      <Route path="/combos/new" element={<ComboEditorPage />} />
      <Route path="/combos/:id/edit" element={<ComboEditorPage />} />
      <Route path="/combos/:comboId/setups/new" element={<SetupEditorPage />} />
      <Route path="/combos/:id" element={<ComboDetailPage />} />
      <Route path="/setups/:setupId" element={<SetupEditorPage />} />
      <Route path="/trash" element={<TrashPage />} />
      {/* M23-07 §4.2-3: ゴミ箱の読み取り専用コンボ詳細。
          ★URL を /combos/:id と分ける——読み取り専用であることが URL から分かる形にする。 */}
      <Route path="/trash/combos/:id" element={<TrashComboDetailPage />} />
      <Route path="/tags/manage" element={<TagManagementPageRoute />} />
      <Route path="/mycombo" element={<MyComboPageRoute />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/health" element={<HealthCheckPage />} />
      <Route path="/wizard" element={<WizardPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      {/* ★M38-02(2026-09-17・D-892): ナビ導線は Header から外したが、ルートは残す。
          ⇒ URL 直打ち専用になっただけであり、消してはならない(MovesEditGridPage.tsx 冒頭)。 */}
      <Route path="/moves/edit" element={<MovesEditGridPage />} />
      <Route path="/import/combo" element={<ComboImportPage />} />
      <Route path="/import/combo/helper" element={<IntakeHelperPage />} />
      <Route path="/punish/search" element={<PunishSearchPage />} />
      <Route path="/punish/list" element={<PunishListPage />} />
      {/* M20-04: プリセット管理(DES-005 §5.10・§5.11)。それまで未定義だった */}
      <Route path="/presets" element={<PresetListPage />} />
      <Route path="/presets/:id/edit" element={<PresetEditPage />} />
      {/* M28-02c / DES-005 §5.19b: ゲーム更新の影響コンボ。
          ★/combos/affected を採らない——この画面はコンボ一覧の別名ではなく独立した面
          である(/combos/* の下はコンボ 1 件を操作する経路で埋まっている)。 */}
      <Route path="/game-update/combos" element={<GameUpdateCombosPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
