-- 개발자의 볼륨: 개발자 계정이 운동을 기록하면 모든 사용자가 투데이에서 보고 자기 기록과 비교한다.
-- Supabase 대시보드 > SQL Editor 에서 실행합니다 (앞의 두 파일을 적용한 뒤).
--
-- 실행 후, 개발자 계정으로 앱에 가입하고 나서 아래 "개발자 계정 지정" SQL 을 한 번 실행합니다 (파일 맨 아래 주석 참고).

-- 1. 개발자 계정 목록: 소유자가 SQL Editor 에서만 넣을 수 있다. 앱(로그인한 사용자 포함)은 읽고 쓸 수 없다.
create table public.developer_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.developer_accounts enable row level security;
revoke all on table public.developer_accounts from anon, authenticated;

-- 2. 개발자의 볼륨: 한 줄만 둔다 (id 는 항상 1)
create table public.developer_volume (
  id integer primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.developer_volume enable row level security;
revoke all on table public.developer_volume from anon, authenticated;
grant select on table public.developer_volume to authenticated;

-- 로그인한 사용자는 모두 읽을 수 있다. 쓰기는 아래 함수로만 가능하다.
create policy "developer_volume: 로그인한 사람은 읽기" on public.developer_volume
  for select to authenticated using (true);

-- 3. 내가 개발자 계정인지 (앱이 개발자 화면을 보여줄지 정하는 데 쓴다)
create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.developer_accounts where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_developer() from public, anon;
grant execute on function public.is_developer() to authenticated;

-- 4. 개발자의 볼륨 올리기: 개발자 계정만 할 수 있고, 값의 모양과 크기를 서버가 한 번 더 확인한다
create or replace function public.publish_developer_volume(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_developer() then
    raise exception 'not developer' using errcode = '42501';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object'
     or pg_column_size(p_data) > 20000
     or jsonb_typeof(p_data -> 'items') is distinct from 'array'
     or (p_data ->> 'date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid data' using errcode = '22023';
  end if;
  insert into public.developer_volume (id, data, updated_at)
  values (1, p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

revoke execute on function public.publish_developer_volume(jsonb) from public, anon;
grant execute on function public.publish_developer_volume(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 개발자 계정 지정 (개발자 계정으로 앱에 가입한 뒤, 아래 줄의 이메일을 바꿔서 한 번만 실행합니다)
--
--   insert into public.developer_accounts (user_id)
--   select id from auth.users where email = '여기에_가입한_내_이메일@example.com';
--
-- 확인: select * from public.developer_accounts;   (한 줄이 나오면 성공)
-- 해제: delete from public.developer_accounts where user_id = (select id from auth.users where email = '...');
