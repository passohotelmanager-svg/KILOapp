// 로컬 저장소 기반 전역 상태. 서버 연동 시 이 파일의 저장/불러오기만 교체한다.
import { useSyncExternalStore } from 'react'
import seed from './data/exercises.json'
import type {
  AppState,
  BodyLog,
  Comment,
  Exercise,
  NutritionRecord,
  Provider,
  Routine,
  Session,
  SetRec,
  Settings,
  Profile,
  User,
} from './types'
import { uid } from './lib/format'
import { ymd } from './lib/dates'
import { BANNED_WORDS } from './lib/constants'
import { setLang } from './lib/i18n'
import { activityFromWeekly } from './lib/calc'

const KEY = 'kilo.state.v1'

export const BUILTIN: Exercise[] = seed as Exercise[]

const defaultSettings: Settings = {
  nameLang: 'ko',
  lang: 'ko',
  developerMode: false,
  restDefault: 30,
  remindOn: false,
  remindDays: [1, 3, 5],
  remindTime: '19:00',
  notifConsent: null,
  nutritionConsent: false,
}

// 로컬 데모용 다른 사용자 (실서버 전환 시 제거)
export const DEMO_USERS = [
  { id: 'demo-1', nickname: '스쿼트왕' },
  { id: 'demo-2', nickname: '벤치러버' },
  { id: 'demo-3', nickname: '아침런' },
]

function seedComments(): Comment[] {
  const now = Date.now()
  const mk = (i: number, ago: number, text: string): Comment => ({
    id: `seed-${i}`,
    userId: DEMO_USERS[i % 3].id,
    nickname: DEMO_USERS[i % 3].nickname,
    text,
    at: now - ago,
    deleted: false,
    reporters: [],
  })
  return [
    mk(0, 3 * 86400_000, '오늘 하체 데이 끝냈어요'),
    mk(1, 5 * 3600_000, '벤치 80kg 드디어 성공'),
    mk(2, 40 * 60_000, '다들 이번 주 목표 채우고 계신가요?'),
    mk(0, 8 * 60_000, '휴식 타이머 덕분에 세트 간격이 일정해졌어요'),
  ]
}

function initial(): AppState {
  return {
    user: null,
    onboarded: false,
    profile: null,
    bodyLog: [],
    settings: defaultSettings,
    customExercises: [],
    favorites: [],
    recent: [],
    routines: [],
    sessions: [],
    activeSessionId: null,
    rest: null,
    nutrition: [],
    comments: seedComments(),
    blocks: [],
    lastReminderDate: '',
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      const base = initial()
      return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } }
    }
  } catch {
    // 손상된 저장값은 무시하고 초기 상태로 시작
  }
  return initial()
}

let state: AppState = load()
setLang(state.settings.lang)
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 공간 부족 등은 조용히 넘어간다 (메모리 상태는 유지)
  }
}

function set(next: AppState) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

function patch(p: Partial<AppState>) {
  set({ ...state, ...p })
}

export function getState(): AppState {
  return state
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => selector(state),
  )
}

export function useAppState(): AppState {
  return useStore((s) => s)
}

// 다른 탭에서 바뀐 값 반영 (커뮤니티 실시간 흉내)
window.addEventListener('storage', (e) => {
  if (e.key === KEY && e.newValue) {
    state = load()
    listeners.forEach((l) => l())
  }
})

// ----- 조회 헬퍼 -----

export function allExercises(s: AppState): Exercise[] {
  return [...s.customExercises, ...BUILTIN]
}

export function findExercise(s: AppState, id: string): Exercise | undefined {
  return s.customExercises.find((e) => e.id === id) ?? BUILTIN.find((e) => e.id === id)
}

export function exName(s: AppState, ex: Exercise): string {
  const lang = s.settings.nameLang
  if (lang === 'en') return ex.nameEn
  if (lang === 'both') return `${ex.nameKo} ${ex.nameEn}`
  return ex.nameKo
}

export function activeSession(s: AppState): Session | null {
  return s.sessions.find((x) => x.id === s.activeSessionId) ?? null
}

export function profanity(text: string): boolean {
  const t = text.toLowerCase().replace(/\s/g, '')
  return BANNED_WORDS.some((w) => t.includes(w))
}

export function nicknameTaken(s: AppState, nick: string): boolean {
  const n = nick.trim().toLowerCase()
  if (DEMO_USERS.some((u) => u.nickname.toLowerCase() === n)) return true
  const others = s.comments.filter((c) => c.userId !== s.user?.id)
  return others.some((c) => c.nickname.toLowerCase() === n)
}

// ----- 동작 -----

function blankSet(rest: number, from?: SetRec): SetRec {
  return {
    id: uid(),
    weight: from?.weight ?? 0,
    reps: from?.reps ?? 0,
    seconds: from?.seconds ?? 0,
    distanceKm: from?.distanceKm ?? 0,
    minutes: from?.minutes ?? 0,
    rest,
  }
}

function mapSession(id: string, fn: (ss: Session) => Session) {
  patch({ sessions: state.sessions.map((x) => (x.id === id ? fn(x) : x)) })
}

export const actions = {
  // 로그인: 실제 인증 대신 로컬 가짜 계정 생성
  login(provider: Provider) {
    const existing = state.user
    if (existing) {
      if (!existing.providers.includes(provider)) {
        patch({ user: { ...existing, providers: [...existing.providers, provider] } })
      }
      return
    }
    const user: User = {
      id: 'me-' + uid(),
      nickname: '',
      email: `demo-${provider}@kilo.local`,
      providers: [provider],
      joinedAt: Date.now(),
    }
    patch({ user })
  },
  linkProvider(p: Provider) {
    const u = state.user
    if (u && !u.providers.includes(p)) patch({ user: { ...u, providers: [...u.providers, p] } })
  },
  // 로그인 수단이 1개만 남으면 해제할 수 없다
  unlinkProvider(p: Provider): boolean {
    const u = state.user
    if (!u || u.providers.length <= 1) return false
    patch({ user: { ...u, providers: u.providers.filter((x) => x !== p) } })
    return true
  },
  setNickname(nickname: string) {
    const u = state.user
    if (!u) return
    patch({
      user: { ...u, nickname },
      comments: state.comments.map((c) => (c.userId === u.id ? { ...c, nickname } : c)),
    })
  },
  logout() {
    patch({ user: null })
  },
  // 회원 탈퇴: 모든 데이터 즉시 삭제 (오픈 이슈 6 기본 처리)
  deleteAccount() {
    set(initial())
  },
  completeOnboarding(profile: Profile) {
    const log: BodyLog = { id: uid(), at: Date.now(), weightKg: profile.weightKg, muscleKg: null, fatPct: null }
    patch({ profile, onboarded: true, bodyLog: [log] })
  },
  updateProfile(p: Partial<Profile>) {
    if (!state.profile) return
    // 주간 운동 횟수를 바꾸면 활동 계수도 그에 맞춰 바뀐다 (활동 계수를 함께 지정하면 그 값을 쓴다)
    const next = p.weeklyGoal !== undefined && p.activity === undefined ? { ...p, activity: activityFromWeekly(p.weeklyGoal) } : p
    patch({ profile: { ...state.profile, ...next } })
  },
  updateSettings(p: Partial<Settings>) {
    if (p.lang) setLang(p.lang)
    // 종목명 표기는 화면 언어를 따라가게 한다 (기본값일 때만)
    if (p.lang === 'en' && state.settings.nameLang === 'ko') p = { ...p, nameLang: 'en' }
    if (p.lang === 'ko' && state.settings.nameLang === 'en') p = { ...p, nameLang: 'ko' }
    patch({ settings: { ...state.settings, ...p } })
  },
  addBodyLog(l: Omit<BodyLog, 'id' | 'at'>) {
    const log: BodyLog = { id: uid(), at: Date.now(), ...l }
    const profile =
      state.profile && l.weightKg ? { ...state.profile, weightKg: l.weightKg } : state.profile
    patch({ bodyLog: [...state.bodyLog, log], profile })
  },

  // 종목
  toggleFavorite(id: string) {
    const f = state.favorites
    patch({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] })
  },
  touchRecent(id: string) {
    patch({ recent: [id, ...state.recent.filter((x) => x !== id)].slice(0, 12) })
  },
  addCustomExercise(e: Omit<Exercise, 'id' | 'builtin'>) {
    const ex: Exercise = { ...e, id: 'custom-' + uid(), builtin: false }
    patch({ customExercises: [...state.customExercises, ex] })
    return ex
  },
  deleteCustomExercise(id: string) {
    patch({ customExercises: state.customExercises.filter((e) => e.id !== id) })
  },

  // 루틴
  saveRoutine(r: Routine) {
    const exists = state.routines.some((x) => x.id === r.id)
    patch({ routines: exists ? state.routines.map((x) => (x.id === r.id ? r : x)) : [...state.routines, r] })
  },
  deleteRoutine(id: string) {
    patch({ routines: state.routines.filter((x) => x.id !== id) })
  },

  // 운동 세션
  startSession(routine?: Routine): string {
    const cur = activeSession(state)
    if (cur) return cur.id
    const rest = state.settings.restDefault
    const ss: Session = {
      id: uid(),
      date: ymd(new Date()),
      startedAt: Date.now(),
      endedAt: null,
      memo: '',
      items: (routine?.items ?? []).map((i) => ({
        exerciseId: i.exerciseId,
        sets: Array.from({ length: Math.max(1, i.sets) }, () => blankSet(rest)),
      })),
    }
    patch({ sessions: [...state.sessions, ss], activeSessionId: ss.id })
    return ss.id
  },
  finishSession() {
    const ss = activeSession(state)
    if (!ss) return
    const items = ss.items.filter((i) => i.sets.length > 0)
    mapSession(ss.id, (x) => ({ ...x, items, endedAt: Date.now() }))
    patch({ activeSessionId: null, rest: null })
    // 빈 세션은 남기지 않는다
    const has = items.some((i) => i.sets.length)
    if (!has) patch({ sessions: state.sessions.filter((x) => x.id !== ss.id) })
  },
  discardSession() {
    const ss = activeSession(state)
    if (!ss) return
    patch({ sessions: state.sessions.filter((x) => x.id !== ss.id), activeSessionId: null, rest: null })
  },
  setMemo(id: string, memo: string) {
    mapSession(id, (x) => ({ ...x, memo }))
  },
  addExerciseToSession(exerciseId: string) {
    const sid = state.activeSessionId ?? actions.startSession()
    const cur = state.sessions.find((x) => x.id === sid)
    if (!cur || cur.items.some((i) => i.exerciseId === exerciseId)) return
    const sets = [blankSet(state.settings.restDefault)]
    mapSession(cur.id, (x) => ({ ...x, items: [...x.items, { exerciseId, sets }] }))
    actions.touchRecent(exerciseId)
  },
  removeExerciseFromSession(sessionId: string, exerciseId: string) {
    mapSession(sessionId, (x) => ({ ...x, items: x.items.filter((i) => i.exerciseId !== exerciseId) }))
  },
  addSet(sessionId: string, exerciseId: string) {
    mapSession(sessionId, (x) => ({
      ...x,
      items: x.items.map((i) => {
        if (i.exerciseId !== exerciseId) return i
        // 직전 세트의 값을 자동 복사한다
        const last = i.sets[i.sets.length - 1]
        return { ...i, sets: [...i.sets, blankSet(last?.rest ?? state.settings.restDefault, last)] }
      }),
    }))
  },
  updateSet(sessionId: string, exerciseId: string, setId: string, p: Partial<SetRec>) {
    mapSession(sessionId, (x) => ({
      ...x,
      items: x.items.map((i) =>
        i.exerciseId !== exerciseId ? i : { ...i, sets: i.sets.map((s) => (s.id === setId ? { ...s, ...p } : s)) },
      ),
    }))
  },
  // 세트 어시스턴트 적용: 종목의 세트를 통째로 교체 (휴식 시간은 기존 값 유지)
  applyAssist(sessionId: string, exerciseId: string, list: { weight: number; reps: number; warmup: boolean }[]) {
    mapSession(sessionId, (x) => ({
      ...x,
      items: x.items.map((i) => {
        if (i.exerciseId !== exerciseId) return i
        const rest = i.sets[0]?.rest ?? state.settings.restDefault
        return { ...i, sets: list.map((a) => ({ ...blankSet(rest), weight: a.weight, reps: a.reps, warmup: a.warmup || undefined })) }
      }),
    }))
  },
  removeSet(sessionId: string, exerciseId: string, setId: string) {
    mapSession(sessionId, (x) => ({
      ...x,
      items: x.items.map((i) =>
        i.exerciseId !== exerciseId ? i : { ...i, sets: i.sets.filter((s) => s.id !== setId) },
      ),
    }))
  },
  // 삭제 취소용 복원
  restoreSet(sessionId: string, exerciseId: string, set: SetRec, index: number) {
    mapSession(sessionId, (x) => ({
      ...x,
      items: x.items.map((i) => {
        if (i.exerciseId !== exerciseId) return i
        const sets = [...i.sets]
        sets.splice(Math.min(index, sets.length), 0, set)
        return { ...i, sets }
      }),
    }))
  },
  deleteSessionOnDate(sessionId: string) {
    patch({ sessions: state.sessions.filter((x) => x.id !== sessionId) })
  },

  // 휴식 타이머
  startRest(seconds: number, label: string) {
    patch({ rest: { endsAt: Date.now() + seconds * 1000, total: seconds, label } })
  },
  clearRest() {
    if (state.rest) patch({ rest: null })
  },

  // 영양
  addNutrition(n: Omit<NutritionRecord, 'id'>) {
    patch({ nutrition: [...state.nutrition, { ...n, id: uid() }] })
  },
  deleteNutrition(id: string) {
    patch({ nutrition: state.nutrition.filter((n) => n.id !== id) })
  },

  // 커뮤니티
  postComment(text: string): 'ok' | 'empty' | 'long' | 'banned' | 'nouser' {
    const u = state.user
    if (!u || !u.nickname) return 'nouser'
    const t = text.trim()
    if (!t) return 'empty'
    if (t.length > 100) return 'long'
    if (profanity(t)) return 'banned'
    const c: Comment = {
      id: uid(),
      userId: u.id,
      nickname: u.nickname,
      text: t,
      at: Date.now(),
      deleted: false,
      reporters: [],
    }
    patch({ comments: [...state.comments, c] })
    return 'ok'
  },
  deleteComment(id: string) {
    patch({ comments: state.comments.map((c) => (c.id === id ? { ...c, deleted: true } : c)) })
  },
  // 신고 3회 누적 시 자동 숨김 (오픈 이슈 12 기본안)
  reportComment(id: string) {
    const me = state.user?.id
    if (!me) return
    patch({
      comments: state.comments.map((c) =>
        c.id === id && !c.reporters.includes(me) ? { ...c, reporters: [...c.reporters, me] } : c,
      ),
    })
  },
  blockUser(userId: string) {
    if (!state.blocks.includes(userId)) patch({ blocks: [...state.blocks, userId] })
  },
  unblockUser(userId: string) {
    patch({ blocks: state.blocks.filter((b) => b !== userId) })
  },
  setReminderDate(d: string) {
    patch({ lastReminderDate: d })
  },
}
