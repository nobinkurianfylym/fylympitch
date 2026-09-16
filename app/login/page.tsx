import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { pageMetadata } from "@/lib/seo";

// Deliberately noindex. A sign-in form has nothing a searcher wants, and
// letting it compete with /signup splits the intent — someone searching for
// the site should land on the page that lets them join, not the one that
// assumes they already have.
export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to your PITCH.FYLYM account.",
  path: "/login",
  index: false,
});

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
