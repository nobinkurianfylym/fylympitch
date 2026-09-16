import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Join PITCH.FYLYM — Free for Filmmakers",
  description:
    "Create a free account to match your film against funds, grants and labs worldwide, see what you qualify for, and be found by producers seeking projects.",
  path: "/signup",
});

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
