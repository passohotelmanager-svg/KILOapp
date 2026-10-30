-- 커뮤니티 (채팅처럼 이어지는 글). 한 달 동안 유지되고, 매달 1일(한국 시간)에 새로 시작한다.
-- 먼저 20261031000000_user_data.sql 을 적용한 뒤(profiles 표가 필요함) 이 파일을 Supabase SQL Editor 에서 실행합니다.

-- 이번 달이 시작된 시각 (한국 시간 기준 1일 0시). 이보다 오래된 글은 보이지 않고, 새 글이 올라올 때 지워진다.
create or replace function public.current_month_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
$$;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null,
  text text not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  report_count integer not null default 0,
  constraint comment_length check (char_length(text) between 1 and 100)
);
create index comments_created_at_idx on public.comments (created_at desc);
create index comments_user_id_idx on public.comments (user_id, created_at desc);

-- 신고한 사람 목록은 따로 두고 아무에게도 보여주지 않는다 (글에는 신고 횟수만 둔다)
create table public.comment_reports (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (comment_id, user_id)
);
alter table public.comment_reports enable row level security;
revoke all on table public.comment_reports from anon, authenticated;

alter table public.comments enable row level security;
revoke all on table public.comments from anon, authenticated;
grant select on table public.comments to authenticated;
-- 글쓴이는 내용(text)만 정할 수 있다. 닉네임과 작성자, 시각은 서버가 정한다.
grant insert (text) on table public.comments to authenticated;
-- 내 글을 지우는 것(숨김)만 할 수 있다
grant update (deleted) on table public.comments to authenticated;

-- 이번 달 글만 로그인한 사람에게 보인다
create policy "comments: 이번 달 글 읽기" on public.comments
  for select to authenticated using (created_at >= public.current_month_start());
create policy "comments: 내 글 쓰기" on public.comments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "comments: 내 글 지우기" on public.comments
  for update to authenticated
  using (user_id = (select auth.uid()) and created_at >= public.current_month_start())
  with check (user_id = (select auth.uid()));

-- 글을 올리기 직전: 닉네임을 서버의 내 닉네임으로 채우고(위조 방지), 닉네임이 없으면 거절, 1분에 10개까지만 허용
create or replace function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nick text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select nickname into v_nick from public.profiles where user_id = v_uid;
  if v_nick is null then
    raise exception 'nickname required' using errcode = 'P0001';
  end if;
  if (select count(*) from public.comments where user_id = v_uid and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate limit' using errcode = 'P0002';
  end if;
  new.user_id := v_uid;
  new.nickname := v_nick;
  new.text := btrim(new.text);
  new.deleted := false;
  new.report_count := 0;
  return new;
end;
$$;

create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

-- 글이 올라올 때 지난달 글을 지운다 (매달 1일이 지나면 새 글이 올라오는 순간 정리됨)
create or replace function public.comments_purge_old()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.comments where created_at < public.current_month_start();
  return null;
end;
$$;

create trigger comments_purge_old
  after insert on public.comments
  for each statement execute function public.comments_purge_old();

-- 닉네임을 바꾸면 내가 쓴 이번 달 글의 닉네임도 같이 바뀐다
create or replace function public.profiles_sync_comment_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.comments set nickname = new.nickname where user_id = new.user_id;
  return null;
end;
$$;

create trigger profiles_sync_comment_nickname
  after update of nickname on public.profiles
  for each row execute function public.profiles_sync_comment_nickname();

-- 신고: 사람마다 한 번만 센다. 내 글은 신고할 수 없다.
create or replace function public.report_comment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.comment_reports (comment_id, user_id)
  select c.id, v_uid from public.comments c
  where c.id = p_id and c.user_id <> v_uid and c.created_at >= public.current_month_start()
  on conflict do nothing;
  update public.comments c
     set report_count = (select count(*) from public.comment_reports r where r.comment_id = c.id)
   where c.id = p_id;
end;
$$;

revoke execute on function public.report_comment(uuid) from public, anon;
grant execute on function public.report_comment(uuid) to authenticated;

-- 실시간: 다른 사람이 글을 올리면 바로 나타나게 한다
alter publication supabase_realtime add table public.comments;
