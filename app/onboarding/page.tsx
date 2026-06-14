import { redirect } from "next/navigation";

// Onboarding is no longer needed — Google sign-in provides the
// user's name and all new accounts default to filmmaker (approved).
// This redirect keeps any bookmarked or linked /onboarding URLs working.
export default function OnboardingPage() {
  redirect("/dashboard");
}
