import type { Metadata } from "next";
import { ROBOTS_NOINDEX } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";

// A redirect to /u/{username}. The canonical profile page is the one that should rank.
export const metadata: Metadata = {
  title: "Producer",
  robots: ROBOTS_NOINDEX,
};

export const dynamic = "force-dynamic";

export default async function ProducerProfileRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/producers/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  redirect(`/u/${profile.username}`);
}
