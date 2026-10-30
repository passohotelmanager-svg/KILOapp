// 서버에 저장하는 데이터를 고르고 합치는 로직 (서버 호출 없는 순수 함수라 테스트하기 쉽다)
import type { AppState, Settings } from '../types'

// 이 항목들이 바뀌면 서버에 저장한다. 로그인 정보(user), 커뮤니티 글(comments), 휴식 타이머(rest)는 제외한다.
export const SYNC_KEYS = new Set<string>([
  'onboarded',
  'profile',
  'bodyLog',
  'settings',
  'customExercises',
  'favorites',
  'recent',
  'routines',
  'sessions',
  'activeSessionId',
  'nutrition',
  'blocks',
  'lastReminderDate',
])

export interface SyncPayload {
  onboarded: boolean
  profile: AppState['profile']
  bodyLog: AppState['bodyLog']
  settings: Omit<Settings, 'developerMode'>
  customExercises: AppState['customExercises']
  favorites: string[]
  recent: string[]
  routines: AppState['routines']
  sessions: AppState['sessions']
  activeSessionId: string | null
  nutrition: AppState['nutrition']
  blocks: string[]
  lastReminderDate: string
  updatedAt: number
}

// 서버로 보낼 값. 식단 사진(data URL)은 용량이 커서 보내지 않는다. 개발자 모드는 기기별 설정이라 제외한다.
export function toSyncPayload(s: AppState): SyncPayload {
  const { developerMode: _dev, ...settings } = s.settings
  void _dev
  return {
    onboarded: s.onboarded,
    profile: s.profile,
    bodyLog: s.bodyLog,
    settings,
    customExercises: s.customExercises,
    favorites: s.favorites,
    recent: s.recent,
    routines: s.routines,
    sessions: s.sessions,
    activeSessionId: s.activeSessionId,
    nutrition: s.nutrition.map((n) => ({ ...n, photo: null })),
    blocks: s.blocks,
    lastReminderDate: s.lastReminderDate,
    updatedAt: s.updatedAt,
  }
}

// 바뀌었는지 비교하는 값 (저장 시각은 빼고 내용만 본다)
export function signature(s: AppState): string {
  const { updatedAt: _u, ...rest } = toSyncPayload(s)
  void _u
  return JSON.stringify(rest)
}

const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)

// 서버에서 읽은 값이 쓸 수 있는 모양인지 확인한다
export function isSyncPayload(x: unknown): x is SyncPayload {
  if (typeof x !== 'object' || x === null) return false
  const p = x as Record<string, unknown>
  return typeof p.updatedAt === 'number' && Array.isArray(p.sessions) && typeof p.settings === 'object' && p.settings !== null
}

// 서버 값을 이 기기의 상태에 합친다. 이 기기에만 있는 것(로그인 정보, 커뮤니티 글, 개발자 모드, 식단 사진)은 그대로 둔다.
export function mergeServerPayload(local: AppState, p: SyncPayload): Partial<AppState> {
  const photos = new Map(local.nutrition.filter((n) => n.photo).map((n) => [n.id, n.photo]))
  return {
    onboarded: !!p.onboarded,
    profile: p.profile ?? null,
    bodyLog: arr(p.bodyLog, []),
    settings: { ...local.settings, ...p.settings, developerMode: local.settings.developerMode },
    customExercises: arr(p.customExercises, []),
    favorites: arr(p.favorites, []),
    recent: arr(p.recent, []),
    routines: arr(p.routines, []),
    sessions: arr(p.sessions, []),
    activeSessionId: p.activeSessionId ?? null,
    nutrition: arr<AppState['nutrition'][number]>(p.nutrition, []).map((n) => ({ ...n, photo: photos.get(n.id) ?? n.photo ?? null })),
    blocks: arr(p.blocks, []),
    lastReminderDate: typeof p.lastReminderDate === 'string' ? p.lastReminderDate : '',
    updatedAt: p.updatedAt,
  }
}

// 로그인 직후 어느 쪽 데이터를 쓸지 정한다.
// - 서버에 이 계정의 데이터가 없으면: 이 기기의 데이터를 올린다 (새 계정)
// - 서버에 있으면: 서버 것을 쓴다. 단 이 기기가 같은 계정의 데이터를 갖고 있고 더 새로 바뀌었을 때만 이 기기 것을 올린다.
//   (다른 기기에서 새로 시작한 몸 정보가 기존 기록을 덮어쓰지 않게 하기 위해서다)
export function chooseInitialSource(a: {
  serverUpdatedAt: number | null
  localUpdatedAt: number
  syncedUserId: string | null
  userId: string
}): 'push' | 'apply' {
  if (a.serverUpdatedAt === null) return 'push'
  if (a.syncedUserId === a.userId && a.localUpdatedAt > a.serverUpdatedAt) return 'push'
  return 'apply'
}
