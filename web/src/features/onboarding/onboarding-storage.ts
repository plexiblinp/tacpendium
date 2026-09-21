import { createLocalStorageHelper } from "@/lib/browser-storage";

export const ONBOARDING_STORAGE_KEY = "onboarding-seen-v1";
export const onboardingStorage = createLocalStorageHelper<boolean>(ONBOARDING_STORAGE_KEY);
