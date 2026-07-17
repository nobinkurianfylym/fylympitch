"use client";

import { useActionState } from "react";
import { updateUsername } from "@/lib/actions";
import type { Profile } from "@/types";

export default function UsernameForm({ profile }: { profile: Pick<Profile, "username"> }) {
  const [state, action, pending] = useActionState(updateUsername, null);

  return (
    <div>
      <p className="text-[11px] tracking-[0.22em] uppercase text-ash mb-1">Username</p>
      <p className="text-[13px] text-ash mb-4">
        Your public handle — appears on your profile URL{" "}
        <span className="text-ink">pitch.fylym.com/u/{profile.username}</span>
      </p>
      <form action={action} className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ash select-none">@</span>
          <input
            name="username"
            className="field !pl-7 w-full"
            defaultValue={profile.username ?? ""}
            placeholder="yourname"
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9_]+"
          />
        </div>
        <button className="btn-ghost !py-2.5" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-[13px] text-red-700">{state.error}</p>}
      {state?.ok    && <p className="mt-2 text-[13px] text-[#8A6F3E]">Username updated.</p>}
      <p className="mt-2 text-[11px] text-ash">Lowercase letters, numbers and underscores only.</p>
    </div>
  );
}
