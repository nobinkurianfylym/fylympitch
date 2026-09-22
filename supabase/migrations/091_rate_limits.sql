-- ============================================================================
-- FYLYMPITCH - Migration 091: a rate limit that survives a serverless app
--
-- /api/ai-extract requires a login and then calls OpenAI with whatever it is
-- handed. One account, scripted, can run up a bill overnight.
--
-- The usual in-memory counter is useless here. The app runs on Cloudflare
-- Workers: every request may hit a different isolate, in a different city,
-- with its own empty Map. A counter in process counts almost nothing.
--
-- The database is the only thing all of them share, so the limit lives here.
--
-- SECURITY DEFINER for the same reason as 089: the table must not be writable
-- by the ordinary client, or the limit is bypassed by deleting your own rows.
-- The caller passes an action name and gets back allowed / not, nothing else.
--
-- $fn$ and a comment-free body: the Supabase SQL editor misreads a DECLARE
-- block as a table and splices an ALTER TABLE into $$ bodies.
-- ============================================================================

create table if not exists public.rate_limits (
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  action       text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (user_id, action, window_start)
);

alter table public.rate_limits enable row level security;

-- No policies at all, deliberately. Nothing reaches this table except the
-- function below, which runs as its owner. A user who could read it would
-- learn nothing useful; one who could write it would have no limit.
revoke all on public.rate_limits from anon, authenticated;

create index if not exists idx_rate_limits_window
  on public.rate_limits (window_start);


-- Fixed window: now() rounded down to the window size. Simpler than a sliding
-- window and, for "stop one account spending money all night", just as good.
create or replace function public.consume_rate_limit(
  p_action         text,
  p_limit          int,
  p_window_seconds int
) returns jsonb
  language plpgsql security definer set search_path = public
as $fn$
declare
  v_user   uuid := auth.uid();
  v_start  timestamptz;
  v_count  int;
begin
  if v_user is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_limit is null or p_limit < 1 then
    return jsonb_build_object('allowed', false, 'reason', 'bad_arguments');
  end if;

  v_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (user_id, action, window_start, count)
  values (v_user, p_action, v_start, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return jsonb_build_object(
    'allowed',   v_count <= p_limit,
    'count',     v_count,
    'limit',     p_limit,
    'reset_at',  v_start + make_interval(secs => p_window_seconds)
  );
end;
$fn$;

grant execute on function public.consume_rate_limit(text, int, int) to authenticated;


-- ---------- Check ----------
select 'table'    as item, case when to_regclass('public.rate_limits') is null then 'MISSING' else 'ok' end as status
union all
select 'rls on',  case when relrowsecurity then 'ok' else 'OFF - WRONG' end
  from pg_class where oid = 'public.rate_limits'::regclass
union all
select 'policies (expect 0)', count(*)::text from pg_policies where tablename = 'rate_limits'
union all
select 'function', case when prosecdef then 'security definer' else 'INVOKER - WRONG' end
  from pg_proc where proname = 'consume_rate_limit';

-- Expected: ok / ok / 0 / security definer.
