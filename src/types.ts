// 앱 전역 타입 정의 (PRD 8.2 데이터 모델 기준)
import type { Lang } from './lib/i18n'

export type PartCode = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'abs' | 'cardio'
export type SubPartCode = 'lats_mid' | 'lower' | 'traps' | 'biceps' | 'triceps' | 'forearms'
export type RecordType = 'weight' | 'bodyweight' | 'time' | 'cardio_distance' | 'cardio_time'
export type MealCode = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Provider = 'google' | 'facebook' | 'apple' | 'email'
export type Goal = 'lose' | 'strength' | 'health'
export type Sex = 'male' | 'female'
export type NameLang = 'ko' | 'en' | 'both'

export interface Exercise {
  id: string
  nameKo: string
  nameEn: string
  part: PartCode
  subPart: SubPartCode | null
  type: RecordType
  builtin: boolean
}

// 세트 한 줄. 기록 유형에 따라 쓰는 필드가 다르다.
export interface SetRec {
  id: string
  weight: number // kg
  reps: number
  seconds: number // 시간형
  distanceKm: number // 유산소 거리형
  minutes: number // 유산소
  rest: number // 이 세트 뒤 휴식(초)
  warmup?: boolean // 워밍업 세트(W): 볼륨·세트 수·1RM에서 제외
}

export interface SessionItem {
  exerciseId: string
  sets: SetRec[]
}

export interface Session {
  id: string
  date: string // YYYY-MM-DD
  startedAt: number
  endedAt: number | null
  items: SessionItem[]
  memo: string
}

export interface RoutineItem {
  exerciseId: string
  sets: number
}

export interface Routine {
  id: string
  name: string
  items: RoutineItem[]
}

export interface NutritionRecord {
  id: string
  date: string
  meal: MealCode
  name: string
  carb: number
  protein: number
  fat: number
  kcal: number
  photo: string | null // 압축된 data URL
}

export interface BodyLog {
  id: string
  at: number
  weightKg: number | null
  muscleKg: number | null
  fatPct: number | null
}

export interface Comment {
  id: string
  userId: string
  nickname: string
  text: string
  at: number
  deleted: boolean
  reporters: string[]
}

export interface User {
  id: string
  nickname: string
  email: string
  providers: Provider[]
  joinedAt: number
}

export interface Profile {
  goal: Goal
  weeklyGoal: number
  birth: string // YYYY-MM-DD
  sex: Sex
  heightCm: number
  weightKg: number
  activity: number // 활동 계수
}

export interface Settings {
  nameLang: NameLang
  lang: Lang // 화면 언어
  developerMode: boolean // 내 운동 기록을 개발자 볼륨으로 올린다
  restDefault: number
  remindOn: boolean
  remindDays: number[] // 0=일 ~ 6=토
  remindTime: string // HH:MM
  notifConsent: boolean | null
  nutritionConsent: boolean
}

export interface RestTimer {
  endsAt: number
  total: number
  label: string
}

export interface AppState {
  user: User | null
  onboarded: boolean
  profile: Profile | null
  bodyLog: BodyLog[]
  settings: Settings
  customExercises: Exercise[]
  favorites: string[]
  recent: string[]
  routines: Routine[]
  sessions: Session[]
  activeSessionId: string | null
  rest: RestTimer | null
  nutrition: NutritionRecord[]
  comments: Comment[]
  blocks: string[]
  lastReminderDate: string
  // 서버 저장: 마지막으로 바뀐 시각(ms)과, 이 기기의 데이터가 어느 계정의 것인지
  updatedAt: number
  syncedUserId: string | null
}
