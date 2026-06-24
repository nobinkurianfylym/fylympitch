"use client";

import { useState } from "react";
import { updateProfile } from "@/lib/actions";
import type { Profile } from "@/types";
import AvatarUpload from "@/components/AvatarUpload";
import UsernameForm from "@/components/UsernameForm";

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  async function action(formData: FormData) {
    setError(null); setSaved(false);
    if (avatarUrl) formData.set("avatar_url", avatarUrl);
    const result = await updateProfile(formData);
    if (result?.error) setError(result.error);
    else setSaved(true);
  }

  return (
    <form action={action} className="space-y-6">
      {/* Avatar */}
      <div className="pb-2">
        <AvatarUpload
          currentUrl={avatarUrl || null}
          userId={profile.id}
          name={profile.full_name}
          onUpload={setAvatarUrl}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" className="field" defaultValue={profile.full_name} required />
      </div>

      <UsernameForm profile={profile} />

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="field-label" htmlFor="company">Company</label>
          <input id="company" name="company" className="field" defaultValue={profile.company ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="country">Country</label>
          <input id="country" name="country" className="field" defaultValue={profile.country ?? ""} />
        </div>
        <div>
          <label className="field-label" htmlFor="website">Website</label>
          <input id="website" name="website" type="url" className="field" defaultValue={profile.website ?? ""} placeholder="https://" />
        </div>
        <div>
          <label className="field-label" htmlFor="imdb_url">IMDb profile</label>
          <input id="imdb_url" name="imdb_url" type="url" className="field" defaultValue={profile.imdb_url ?? ""} placeholder="https://www.imdb.com/name/…" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="bio">Bio</label>
        <textarea id="bio" name="bio" rows={4} className="field" defaultValue={profile.bio ?? ""} placeholder="Credits, focus, what you're looking for." />
      </div>

      {error && <p className="text-[13px] text-red-700">{error}</p>}
      {saved && <p className="text-[13px] text-[#8A6F3E]">Profile saved.</p>}
      <button className="btn-gold">Save changes</button>
    </form>
  );
}
