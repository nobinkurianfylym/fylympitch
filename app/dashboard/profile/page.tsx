import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import type { Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>();
  if (!profile) return null;

  return (
    <div>
      <p className="eyebrow mb-3">{profile.role} {profile.approval_status === "pending" ? "· verification pending" : ""}</p>
      <h1 className="font-display text-[34px]">Profile</h1>
      <p className="mt-3 text-[14px] text-ash max-w-lg">A complete profile builds trust with funds and producers reviewing your applications.</p>
      <div className="mt-10">
        <ProfileForm profile={profile} />
      </div>
    </div>
  );
}
