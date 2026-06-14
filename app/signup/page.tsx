import { redirect } from "next/navigation";

// Email sign-up removed — Google-only auth.
// Redirect any /signup links to the login page.
export default function SignupPage() {
  redirect("/login");
}
