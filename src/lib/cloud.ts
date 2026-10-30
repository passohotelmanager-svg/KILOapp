// Supabase 서버와 주고받는 호출 모음 (저장, 닉네임, 탈퇴). 화면과 sync.ts는 이 파일만 통해서 서버와 이야기한다.
// 서버 쪽 표와 규칙은 supabase/migrations/20261031000000_user_data.sql 에 있다.
import { supabase } from './supabase'
import { isSyncPayload, type SyncPayload } from './syncData'
import { toComment, type CommentRow } from './commentData'
import type { Comment } from '../types'

// 실패 이유: setup(서버 표가 아직 없음), network(연결 문제), taken(닉네임 중복), invalid(닉네임 형식), mismatch(이메일이 다름)
// rate(너무 빨리 보냄), nonick(닉네임이 없어 글을 쓸 수 없음)
export type CloudFail = 'setup' | 'network' | 'taken' | 'invalid' | 'mismatch' | 'rate' | 'nonick'
export type CloudResult<T> = { ok: true; value: T } | { ok: false; reason: CloudFail }

interface PgError {
  code?: string
  message?: string
  status?: number
}

function failOf(e: PgError): CloudFail {
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()
  // 표나 함수가 없을 때 (SQL을 아직 적용하지 않은 경우)
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883' || e.status === 404) return 'setup'
  if (code === '23505') return 'taken'
  if (code === '23514') return 'invalid'
  if (code === 'P0002' || msg.includes('rate limit')) return 'rate'
  if (msg.includes('nickname required')) return 'nonick'
  if (msg.includes('email mismatch')) return 'mismatch'
  return 'network'
}

const off = (): CloudResult<never> => ({ ok: false, reason: 'setup' })

export async function fetchNickname(): Promise<CloudResult<string | null>> {
  if (!supabase) return off()
  const { data, error } = await supabase.from('profiles').select('nickname').maybeSingle()
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: (data?.nickname as string | undefined) ?? null }
}

// 이 닉네임을 쓸 수 있는지 (다른 사람이 쓰고 있지 않은지)
export async function nicknameAvailable(nickname: string): Promise<CloudResult<boolean>> {
  if (!supabase) return off()
  const { data, error } = await supabase.rpc('nickname_available', { p_nickname: nickname })
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: data === true }
}

// 닉네임을 내 것으로 저장한다. 동시에 같은 닉네임을 쓰려 해도 서버가 한 명만 허락한다
export async function claimNickname(userId: string, nickname: string): Promise<CloudResult<true>> {
  if (!supabase) return off()
  const { error } = await supabase.from('profiles').upsert({ user_id: userId, nickname, updated_at: new Date().toISOString() })
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: true }
}

export async function fetchUserData(): Promise<CloudResult<SyncPayload | null>> {
  if (!supabase) return off()
  const { data, error } = await supabase.from('user_data').select('data').maybeSingle()
  if (error) return { ok: false, reason: failOf(error) }
  if (!data) return { ok: true, value: null }
  return isSyncPayload(data.data) ? { ok: true, value: data.data } : { ok: false, reason: 'network' }
}

export async function saveUserData(userId: string, payload: SyncPayload): Promise<CloudResult<true>> {
  if (!supabase) return off()
  const { error } = await supabase.from('user_data').upsert({ user_id: userId, data: payload, updated_at: new Date().toISOString() })
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: true }
}

// 회원 탈퇴: 가입한 이메일 주소가 맞아야만 서버가 계정과 모든 데이터를 지운다
export async function deleteMyAccount(email: string): Promise<CloudResult<true>> {
  if (!supabase) return off()
  const { error } = await supabase.rpc('delete_my_account', { p_email: email })
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: true }
}

// ----- 커뮤니티 (이번 달 글만 서버가 돌려준다) -----

const COMMENT_COLS = 'id, user_id, nickname, text, created_at, deleted, report_count'

export async function fetchComments(): Promise<CloudResult<Comment[]>> {
  if (!supabase) return off()
  const { data, error } = await supabase.from('comments').select(COMMENT_COLS).order('created_at', { ascending: true }).limit(500)
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: (data as CommentRow[]).map(toComment) }
}

// 글 올리기. 닉네임과 작성자는 서버가 정한다
export async function postCommentToServer(text: string): Promise<CloudResult<Comment>> {
  if (!supabase) return off()
  const { data, error } = await supabase.from('comments').insert({ text }).select(COMMENT_COLS).single()
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: toComment(data as CommentRow) }
}

export async function deleteCommentOnServer(id: string): Promise<CloudResult<true>> {
  if (!supabase) return off()
  const { error } = await supabase.from('comments').update({ deleted: true }).eq('id', id)
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: true }
}

export async function reportCommentOnServer(id: string): Promise<CloudResult<true>> {
  if (!supabase) return off()
  const { error } = await supabase.rpc('report_comment', { p_id: id })
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: true }
}

// 다른 사람이 글을 올리거나 지우면 알려준다 (채팅처럼 바로 보이게). 해제하는 함수를 돌려준다
export function subscribeComments(onChange: () => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client
    .channel('comments-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, onChange)
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}

// ----- 개발자의 볼륨 (개발자 계정만 올릴 수 있고, 로그인한 사용자는 모두 읽는다) -----

// 내가 개발자 계정인지. 개발자 계정은 소유자가 SQL로 지정한다
export async function checkIsDeveloper(): Promise<CloudResult<boolean>> {
  if (!supabase) return off()
  const { data, error } = await supabase.rpc('is_developer')
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: data === true }
}

// 서버에 저장된 개발자의 볼륨 (값의 모양은 developerVolume.ts가 확인한다)
export async function fetchDeveloperVolumeRow(): Promise<CloudResult<unknown | null>> {
  if (!supabase) return off()
  const { data, error } = await supabase.from('developer_volume').select('data').maybeSingle()
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: data?.data ?? null }
}

export async function publishDeveloperVolumeRow(payload: unknown): Promise<CloudResult<true>> {
  if (!supabase) return off()
  const { error } = await supabase.rpc('publish_developer_volume', { p_data: payload })
  return error ? { ok: false, reason: failOf(error) } : { ok: true, value: true }
}
