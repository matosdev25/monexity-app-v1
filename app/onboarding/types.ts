export type OnboardingState = {
  success: boolean;
  message: string;
  companyId?: string;
  planId?: string;
  billingCycle?: "monthly" | "annual";
  discountCode?: string;
  requiresConfirmation?: boolean;
};

export const initialOnboardingState: OnboardingState = {
  success: false,
  message: "",
};
