-- 로그인한 사용자의 앱 데이터 저장, 닉네임 중복 방지, 이메일 확인 탈퇴
-- Supabase 대시보드 > SQL Editor 에 이 파일 내용을 붙여넣고 Run 하거나, supabase db push 로 적용합니다.

-- 1. 사용자 데이터: 앱 상태(프로필, 기록, 식단, 루틴 등)를 사용자별로 JSON 한 줄에 저장
create table public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 행 단위 보안: 본인 행만 읽고 쓸 수 있다. 로그인하지 않은 사람은 접근할 수 없다.
alter table public.user_data enable row level security;
revoke all on table public.user_data from anon;
grant select, insert, update on table public.user_data to authenticated;

create policy "user_data: 본인만 읽기" on public.user_data
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_data: 본인만 만들기" on public.user_data
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_data: 본인만 고치기" on public.user_data
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2. 닉네임: 대소문자를 구분하지 않고 서버에서 중복을 막는다 (동시에 같은 닉네임을 써도 한 명만 성공)
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  updated_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 2 and 12),
  constraint nickname_trimmed check (nickname = btrim(nickname))
);
create unique index profiles_nickname_lower_idx on public.profiles (lower(nickname));

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;

-- 다른 사람의 닉네임 목록은 볼 수 없고, 본인 행만 읽고 쓴다
create policy "profiles: 본인만 읽기" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: 본인만 만들기" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profiles: 본인만 고치기" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 닉네임을 쓸 수 있는지 확인한다 (내 닉네임은 쓸 수 있는 것으로 본다). 다른 사람의 정보는 돌려주지 않고 true/false만 돌려준다.
create or replace function public.nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where lower(nickname) = lower(btrim(p_nickname))
      and user_id <> (select auth.uid())
  );
$$;

revoke execute on function public.nickname_available(text) from public, anon;
grant execute on function public.nickname_available(text) to authenticated;

-- 3. 회원 탈퇴: 가입한 이메일 주소를 정확히 입력해야만 본인 계정과 모든 데이터를 삭제한다.
-- auth.users 에서 지우면 user_data, profiles 는 on delete cascade 로 함께 지워진다.
create or replace function public.delete_my_account(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select email into v_email from auth.users where id = v_uid;
  if v_email is null or lower(btrim(p_email)) <> lower(v_email) then
    raise exception 'email mismatch' using errcode = 'P0001';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
