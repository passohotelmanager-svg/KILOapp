import { describe, expect, it } from 'vitest'
import { chooseInitialSource, isSyncPayload, mergeServerPayload, signature, toSyncPayload } from './syncData'
import type { AppState, NutritionRecord } from '../types'

const meal = (id: string, photo: string | null): NutritionRecord => ({
  id, date: '2026-10-30', meal: 'lunch', name: '밥', carb: 10, protein: 5, fat: 1, kcal: 80, photo,
})

const base = (over: Partial<AppState> = {}): AppState => ({
  user: { id: 'u1', nickname: '닉', email: 'a@b.c', providers: ['google'], joinedAt: 1 },
  onboarded: true,
  profile: null,
  bodyLog: [],
  settings: {
    nameLang: 'ko', lang: 'ko', developerMode: true, restDefault: 30, remindOn: false, remindDays: [1], remindTime: '19:00',
    notifConsent: null, nutritionConsent: false,
  },
  customExercises: [],
  favorites: [],
  recent: [],
  routines: [],
  sessions: [],
  activeSessionId: null,
  rest: null,
  nutrition: [],
  comments: [],
  blocks: [],
  lastReminderDate: '',
  updatedAt: 100,
  syncedUserId: null,
  ...over,
})

describe('서버 저장 데이터', () => {
  it('로그인 정보, 커뮤니티 글, 개발자 모드는 서버로 보내지 않는다', () => {
    const p = toSyncPayload(base({ comments: [{ id: 'c', userId: 'u', nickname: 'n', text: 't', at: 1, deleted: false, reporters: [] }] }))
    expect(p).not.toHaveProperty('user')
    expect(p).not.toHaveProperty('comments')
    expect(p).not.toHaveProperty('rest')
    expect(p.settings).not.toHaveProperty('developerMode')
  })

  it('식단 사진은 서버로 보내지 않는다', () => {
    const p = toSyncPayload(base({ nutrition: [meal('m1', 'data:image/png;base64,AAAA')] }))
    expect(p.nutrition[0].photo).toBeNull()
  })

  it('저장 시각만 달라도 내용이 같으면 같은 값으로 본다', () => {
    expect(signature(base({ updatedAt: 1 }))).toBe(signature(base({ updatedAt: 999 })))
    expect(signature(base({ favorites: ['a'] }))).not.toBe(signature(base()))
  })

  it('서버 값을 합쳐도 이 기기의 로그인 정보, 개발자 모드, 식단 사진은 남는다', () => {
    const local = base({ nutrition: [meal('m1', 'data:image/png;base64,LOCAL')] })
    const server = toSyncPayload(base({ favorites: ['x'], updatedAt: 500, nutrition: [meal('m1', null), meal('m2', null)] }))
    const merged = mergeServerPayload(local, server)
    expect(merged.favorites).toEqual(['x'])
    expect(merged.updatedAt).toBe(500)
    expect(merged.settings?.developerMode).toBe(true)
    expect(merged.nutrition?.find((n) => n.id === 'm1')?.photo).toBe('data:image/png;base64,LOCAL')
    expect(merged.nutrition?.find((n) => n.id === 'm2')?.photo).toBeNull()
    expect(merged).not.toHaveProperty('user')
  })

  it('서버 설정에 없는 새 항목은 이 기기의 값을 쓴다', () => {
    const server = toSyncPayload(base())
    // 옛 버전이 저장한 설정에는 lang이 없을 수 있다
    delete (server.settings as Record<string, unknown>).lang
    const merged = mergeServerPayload(base({ settings: { ...base().settings, lang: 'en' } }), server)
    expect(merged.settings?.lang).toBe('en')
    expect(merged.settings?.restDefault).toBe(30)
  })

  it('모양이 이상한 서버 값은 거른다', () => {
    expect(isSyncPayload(null)).toBe(false)
    expect(isSyncPayload({})).toBe(false)
    expect(isSyncPayload({ updatedAt: 1, sessions: [], settings: {} })).toBe(true)
  })
})

describe('로그인 직후 어느 쪽을 쓸지', () => {
  const U = 'user-1'
  it('서버에 데이터가 없으면 이 기기 것을 올린다', () => {
    expect(chooseInitialSource({ serverUpdatedAt: null, localUpdatedAt: 5, syncedUserId: null, userId: U })).toBe('push')
  })
  it('새 기기에서 시작한 몸 정보가 기존 서버 기록을 덮어쓰지 않는다', () => {
    // 이 기기는 아직 이 계정과 연결된 적이 없으므로, 이 기기의 값이 더 새롭더라도 서버 것을 쓴다
    expect(chooseInitialSource({ serverUpdatedAt: 100, localUpdatedAt: 9999, syncedUserId: null, userId: U })).toBe('apply')
  })
  it('같은 계정의 기기에서 오프라인으로 더 새로 바꿨으면 이 기기 것을 올린다', () => {
    expect(chooseInitialSource({ serverUpdatedAt: 100, localUpdatedAt: 200, syncedUserId: U, userId: U })).toBe('push')
  })
  it('같은 계정이어도 서버가 더 새로우면 서버 것을 쓴다', () => {
    expect(chooseInitialSource({ serverUpdatedAt: 300, localUpdatedAt: 200, syncedUserId: U, userId: U })).toBe('apply')
  })
  it('다른 계정이 쓰던 기기의 데이터는 쓰지 않는다', () => {
    expect(chooseInitialSource({ serverUpdatedAt: 100, localUpdatedAt: 900, syncedUserId: 'someone-else', userId: U })).toBe('apply')
  })
})
