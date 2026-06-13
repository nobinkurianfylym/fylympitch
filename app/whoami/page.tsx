import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminSelfPromote } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function WhoAmI({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: promoteError } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/whoami");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { count: adminCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  return (
    <main className="min-h-screen bg-ivory text-ink font-sans p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl mb-4">Who am I?</h1>

      <div className="card p-5 mb-4">
        <p className="eyebrow mb-2">Auth user</p>
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify({ id: user.id, email: user.email }, null, 2)}</pre>
      </div>

      <div className="card p-5 mb-4">
        <p className="eyebrow mb-2">Profile row (public.profiles)</p>
        {error ? (
          <p className="text-red-700 text-sm">Error reading profile: {error.message}</p>
        ) : (
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(profile, null, 2)}</pre>
        )}
      </div>

      <div className="card p-5 mb-4">
        <p className="eyebrow mb-2">Admins currently in system</p>
        <p className="text-sm">{adminCount ?? 0} account(s) with role = admin</p>
      </div>

      {promoteError && (
        <div className="card p-5 mb-4 border-red-300">
          <p className="text-sm text-red-700 mb-2">Could not self-promote: {promoteError}</p>
          <p className="text-xs text-ash mb-2">
            Run this in Supabase SQL editor instead (replace the id if different):
          </p>
          <pre className="text-xs whitespace-pre-wrap bg-deep text-ivory p-3 rounded-card">
{`update public.profiles set role = 'admin' where id = '${user.id}';`}
          </pre>
        </div>
      )}

      {!error && profile?.role !== "admin" && (
        <form action={adminSelfPromote} className="card p-5 mb-4">
          <p className="eyebrow mb-2">Bootstrap</p>
          <p className="text-sm text-ash mb-3">
            {(adminCount ?? 0) === 0
              ? `No admin exists yet. Click below to make this account (${user.email}) the admin.`
              : `An admin already exists, but you can still try to self-promote (will be blocked by RLS unless you're already permitted).`}
          </p>
          <button className="btn-gold">Make me admin</button>
        </form>
      )}

      {profile?.role === "admin" && (
        <div className="card p-5 mb-4 border-emerald-300">
          <p className="text-sm">
            This account is admin. Go to <Link href="/admin" className="underline text-gold">/admin</Link>.
          </p>
        </div>
      )}

      <p className="text-xs text-ash mt-6">
        Remove this page (app/whoami) once admin access is confirmed working — it's a temporary diagnostic tool.
      </p>
    </main>
  );
}
