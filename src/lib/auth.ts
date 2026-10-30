// 로그인(Google, Apple). Supabase 인증을 쓰고, 설정이 없으면 authEnabled가 false가 되어 데모 로그인으로 동작한다.
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AuthProvider = 'google' | 'apple'

export const authEnabled = supabase !== null

// 앱이 쓰는 로그인 사용자 정보
export interface AuthUser {
  id: string
  email: string
  nickname: string // 계정에 저장된 닉네임 (없으면 빈 문자열)
  providers: string[]
  joinedAt: number
}

let accessToken: string | null = null

// 서버 함수(AI 추천 등)를 부를 때 쓰는 로그인 토큰. 로그인하지 않았으면 null
export function getAccessToken(): string | null {
  return accessToken
}

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user
  if (!u) return null
  const providers = [...new Set((u.identities ?? []).map((i) => i.provider))]
  const meta = (u.user_metadata ?? {}) as { nickname?: unknown }
  return {
    id: u.id,
    email: u.email ?? '',
    nickname: typeof meta.nickname === 'string' ? meta.nickname : '',
    providers: providers.length ? providers : u.app_metadata?.provider ? [String(u.app_metadata.provider)] : [],
    joinedAt: Date.parse(u.created_at) || Date.now(),
  }
}

// 로그인 창(구글 또는 애플)으로 이동한다. 로그인이 끝나면 이 앱 주소로 돌아온다
export async function signInWithProvider(provider: AuthProvider): Promise<string | null> {
  if (!supabase) return 'not-configured'
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
  return error ? error.message : null
}

// 이메일 회원 기능이 돌려주는 실패 종류. 화면에서 문구로 바꿔 보여준다
export type AuthFail = 'invalid' | 'unconfirmed' | 'exists' | 'rate' | 'weak' | 'unknown' | 'off'

function failOf(message: string): AuthFail {
  const m = message.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalid'
  if (m.includes('not confirmed')) return 'unconfirmed'
  if (m.includes('already') && m.includes('registered')) return 'exists'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'rate'
  if (m.includes('password') && (m.includes('least') || m.includes('weak') || m.includes('short'))) return 'weak'
  return 'unknown'
}

// 이메일 회원가입. needsConfirm이 true면 확인 메일의 링크를 눌러야 로그인된다
export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ fail: AuthFail | null; needsConfirm: boolean }> {
  if (!supabase) return { fail: 'off', needsConfirm: false }
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
  if (error) return { fail: failOf(error.message), needsConfirm: false }
  // 이미 가입된 이메일이면 Supabase는 오류 대신 identities가 빈 사용자를 돌려준다
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { fail: 'exists', needsConfirm: false }
  return { fail: null, needsConfirm: !data.session }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthFail | null> {
  if (!supabase) return 'off'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? failOf(error.message) : null
}

// 비밀번호 재설정 메일 보내기. 메일의 링크를 누르면 로그인된 채로 앱이 열린다
export async function sendPasswordReset(email: string): Promise<AuthFail | null> {
  if (!supabase) return 'off'
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  return error ? failOf(error.message) : null
}

export async function changePassword(password: string): Promise<AuthFail | null> {
  if (!supabase) return 'off'
  const { error } = await supabase.auth.updateUser({ password })
  return error ? failOf(error.message) : null
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
  accessToken = null
}

// 닉네임을 계정에도 저장해서 다른 기기에서 로그인해도 이어지게 한다
export async function saveNickname(nickname: string): Promise<void> {
  await supabase?.auth.updateUser({ data: { nickname } })
}

// 시작할 때 한 번 부르면, 로그인 상태가 바뀔 때마다 onUser가 불린다 (null이면 로그아웃)
export function startAuthSync(onUser: (u: AuthUser | null) => void, onReady: () => void): () => void {
  if (!supabase) {
    onReady()
    return () => {}
  }
  const apply = (session: Session | null) => {
    accessToken = session?.access_token ?? null
    onUser(toUser(session))
  }
  supabase.auth.getSession().then(({ data }) => {
    apply(data.session)
    onReady()
  })
  const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
  return () => data.subscription.unsubscribe()
}
