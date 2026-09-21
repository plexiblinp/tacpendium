import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function OnboardingGuideDialog() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
        {t("settings.details.onboardingShow")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("onboarding.bannerTitle")}</DialogTitle>
          <DialogDescription>{t("onboarding.bannerBody")}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
