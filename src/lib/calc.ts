// 볼륨, 1RM, 영양 계산 (PRD 8.1, 8.3)
import type { Exercise, Goal, PartCode, Profile, Session, SetRec, SubPartCode } from '../types'
import { ageFrom } from './dates'

// 세트 하나의 무게 볼륨. 무게 유형만 볼륨으로 센다.
export function setVolume(ex: Exercise, s: SetRec): number {
  if (ex.type !== 'weight' || s.warmup) return 0
  return s.weight > 0 && s.reps > 0 ? s.weight * s.reps : 0
}

// 기록이 채워진 세트인지 (세트 수 집계용)
export function setFilled(ex: Exercise, s: SetRec): boolean {
  if (s.warmup) return false
  switch (ex.type) {
    case 'weight':
      return s.weight > 0 && s.reps > 0
    case 'bodyweight':
      return s.reps > 0
    case 'time':
      return s.seconds > 0
    case 'cardio_distance':
      return s.distanceKm > 0 || s.minutes > 0
    case 'cardio_time':
      return s.minutes > 0
  }
}

export interface Stat {
  volume: number
  sets: number
}

export interface Aggregate {
  byPart: Record<PartCode, Stat>
  bySub: Partial<Record<SubPartCode, Stat>>
  byExercise: Record<string, Stat & { exercise: Exercise }>
  total: number
  bodyReps: number // 맨몸 총 횟수
  timeSec: number // 시간 운동 총 초
  cardioKm: number
  cardioMin: number
  sessions: number
}

export function emptyAggregate(): Aggregate {
  const zero = (): Stat => ({ volume: 0, sets: 0 })
  return {
    byPart: { chest: zero(), back: zero(), shoulders: zero(), legs: zero(), arms: zero(), abs: zero(), cardio: zero() },
    bySub: {},
    byExercise: {},
    total: 0,
    bodyReps: 0,
    timeSec: 0,
    cardioKm: 0,
    cardioMin: 0,
    sessions: 0,
  }
}

// 기간 내 세션을 모아 부위, 하위 부위, 종목별로 집계한다
export function aggregate(
  sessions: Session[],
  from: string,
  to: string,
  lookup: (id: string) => Exercise | undefined,
): Aggregate {
  const agg = emptyAggregate()
  for (const ss of sessions) {
    if (ss.date < from || ss.date > to) continue
    let any = false
    for (const item of ss.items) {
      const ex = lookup(item.exerciseId)
      if (!ex) continue
      for (const s of item.sets) {
        if (!setFilled(ex, s)) continue
        any = true
        const vol = setVolume(ex, s)
        const p = agg.byPart[ex.part]
        p.sets += 1
        p.volume += vol
        if (ex.subPart) {
          const sub = (agg.bySub[ex.subPart] ??= { volume: 0, sets: 0 })
          sub.sets += 1
          sub.volume += vol
        }
        const e = (agg.byExercise[ex.id] ??= { volume: 0, sets: 0, exercise: ex })
        e.sets += 1
        e.volume += vol
        agg.total += vol
        if (ex.type === 'bodyweight') agg.bodyReps += s.reps
        if (ex.type === 'time') agg.timeSec += s.seconds
        if (ex.type === 'cardio_distance') {
          agg.cardioKm += s.distanceKm
          agg.cardioMin += s.minutes
        }
        if (ex.type === 'cardio_time') agg.cardioMin += s.minutes
      }
    }
    if (any) agg.sessions += 1
  }
  return agg
}

// 세션 길이(초). 진행 중이면 현재까지.
export function sessionSeconds(ss: Session, now = Date.now()): number {
  const end = ss.endedAt ?? now
  return Math.max(0, Math.round((end - ss.startedAt) / 1000))
}

// 추정 1RM (Epley). 1회면 그대로.
export function est1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

// 종목 하나의 전체 기간 최고 추정 1RM
export function best1RM(sessions: Session[], exerciseId: string): number {
  let best = 0
  for (const ss of sessions) {
    for (const item of ss.items) {
      if (item.exerciseId !== exerciseId) continue
      for (const s of item.sets) if (!s.warmup) best = Math.max(best, est1RM(s.weight, s.reps))
    }
  }
  return best
}

// 세트 어시스턴트: 메인 무게 기준으로 세트 구성을 만든다 (2.5kg 단위 반올림)
export type AssistPreset = 'basic' | 'up' | 'down' | 'five' | 'top' | 'backoff'

export const ASSIST_PRESETS: { id: AssistPreset; label: string; desc: string }[] = [
  { id: 'basic', label: '기본', desc: '모든 세트가 같은 무게로 구성돼요.' },
  { id: 'up', label: '점점 강하게', desc: '70%에서 시작해 메인 무게까지 단계적으로 올려요.' },
  { id: 'down', label: '점점 약하게', desc: '메인 무게로 시작해 70%까지 내려가요.' },
  { id: 'five', label: '5×5 스트렝스', desc: '메인 무게로 5세트 × 5회를 해요.' },
  { id: 'top', label: '탑세트', desc: '무게를 올려 마지막 한 세트에서 오늘의 최고 기록에 도전해요.' },
  { id: 'backoff', label: '백오프', desc: '탑세트를 먼저 하고, 이후 80% 무게로 볼륨을 채워요.' },
]

const round25 = (w: number) => Math.max(0, Math.round(w / 2.5) * 2.5)

export interface AssistSet {
  weight: number
  reps: number
  warmup: boolean
}

export function buildAssist(preset: AssistPreset, main: number, sets: number, reps: number, warmup: boolean): AssistSet[] {
  const n = Math.max(1, sets)
  const w = (r: number) => round25(main * r)
  const ramp = (from: number, to: number) => Array.from({ length: n }, (_, i) => w(n === 1 ? to : from + ((to - from) * i) / (n - 1)))
  let work: { weight: number; reps: number }[]
  switch (preset) {
    case 'up':
      work = ramp(0.7, 1).map((weight) => ({ weight, reps }))
      break
    case 'down':
      work = ramp(1, 0.7).map((weight) => ({ weight, reps }))
      break
    case 'five':
      work = Array.from({ length: 5 }, () => ({ weight: round25(main), reps: 5 }))
      break
    case 'top': {
      const lead = n === 1 ? [] : ramp(0.7, 0.9).slice(0, n - 1)
      work = [...lead.map((weight) => ({ weight, reps })), { weight: round25(main), reps: Math.min(reps, 3) }]
      break
    }
    case 'backoff':
      work = [{ weight: round25(main), reps: Math.min(reps, 3) }, ...Array.from({ length: n - 1 }, () => ({ weight: w(0.8), reps }))]
      break
    default:
      work = Array.from({ length: n }, () => ({ weight: round25(main), reps }))
  }
  const warm: AssistSet[] = warmup
    ? [...new Set([20, w(0.5), w(0.7)])].filter((x) => x > 0 && x < main).sort((a, b) => a - b).map((weight) => ({ weight, reps: 5, warmup: true }))
    : []
  return [...warm, ...work.map((x) => ({ ...x, warmup: false }))]
}

// 직전 기록 (같은 종목, 현재 세션 제외)
export function previousSets(sessions: Session[], exerciseId: string, excludeId: string): SetRec[] | null {
  const list = sessions.filter((s) => s.id !== excludeId).sort((a, b) => b.startedAt - a.startedAt)
  for (const ss of list) {
    const it = ss.items.find((i) => i.exerciseId === exerciseId && i.sets.length)
    if (it) return it.sets
  }
  return null
}

// ----- 영양 -----

export function macroKcal(carb: number, protein: number, fat: number): number {
  return Math.round(carb * 4 + protein * 4 + fat * 9)
}

export function bmr(p: Profile, today = new Date()): number {
  const age = ageFrom(p.birth, today)
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age
  return p.sex === 'male' ? base + 5 : base - 161
}

export function tdee(p: Profile, today = new Date()): number {
  return bmr(p, today) * p.activity
}

// 주간 운동 횟수 -> 활동 계수 기본값 (7.3)
export function activityFromWeekly(n: number): number {
  if (n <= 0) return 1.2
  if (n <= 2) return 1.375
  if (n <= 5) return 1.55
  return 1.725
}

// 목표별 하루 열량. 근력 증가는 오픈 이슈 7이라 유지 열량으로 둔다.
export function dailyTarget(p: Profile, goal: Goal = p.goal, today = new Date()): number {
  const t = tdee(p, today)
  if (goal === 'lose') return Math.max(1200, Math.round(t - 500))
  return Math.round(t)
}

export function weeklyTarget(p: Profile, today = new Date()): number {
  return dailyTarget(p, p.goal, today) * 7
}
