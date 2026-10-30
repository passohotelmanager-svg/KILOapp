-- AI 분석(F-09) 사용자별 하루 호출 횟수
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- 행 단위 보안을 켜고 정책은 만들지 않는다.
-- 앱(anon, authenticated)에서는 읽기와 쓰기가 모두 막히고, Edge Function의 관리자 권한만 접근한다.
alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

-- 오늘 호출 횟수를 1 늘리고 늘어난 값을 돌려준다.
-- 이미 한도에 도달했으면 늘리지 않고 null을 돌려준다.
-- SQL 한 문장으로 처리해 동시에 여러 번 호출해도 한도를 넘지 않는다.
create or replace function public.consume_ai_quota(p_user_id uuid, p_day date, p_limit integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.ai_usage as u (user_id, day, count, updated_at)
  values (p_user_id, p_day, 1, now())
  on conflict (user_id, day) do update
    set count = u.count + 1, updated_at = now()
    where u.count < p_limit
  returning u.count;
$$;

-- Gemini 호출이 서버 쪽 문제로 실패했을 때 차감한 횟수를 되돌린다
create or replace function public.refund_ai_quota(p_user_id uuid, p_day date)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.ai_usage
     set count = count - 1, updated_at = now()
   where user_id = p_user_id and day = p_day and count > 0;
$$;

-- 두 함수는 Edge Function(service_role)만 실행할 수 있다
revoke execute on function public.consume_ai_quota(uuid, date, integer) from public, anon, authenticated;
revoke execute on function public.refund_ai_quota(uuid, date) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, date, integer) to service_role;
grant execute on function public.refund_ai_quota(uuid, date) to service_role;
