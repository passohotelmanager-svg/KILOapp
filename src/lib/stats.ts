// 화면 공통 집계 도우미
import type { AppState, NutritionRecord, Session } from '../types'
import { aggregate, sessionSeconds, setFilled } from './calc'
import { addDays, endOfMonth, startOfMonth, startOfWeek, ymd } from './dates'
import { findExercise } from '../store'

export function lookupFor(s: AppState) {
  return (id: string) => findExercise(s, id)
}

export function agg(s: AppState, from: Date, to: Date) {
  return aggregate(s.sessions, ymd(from), ymd(to), lookupFor(s))
}

// 기록된 세트가 하나라도 있는 세션인지
export function hasRecords(s: AppState, ss: Session): boolean {
  return ss.items.some((i) => {
    const ex = findExercise(s, i.exerciseId)
    return ex ? i.sets.some((x) => setFilled(ex, x)) : false
  })
}

export function recordedSessions(s: AppState): Session[] {
  return s.sessions.filter((x) => hasRecords(s, x))
}

// 기간 내 하루 단위 운동 시간(초)
export function secondsByDay(s: AppState, from: Date, to: Date): Record<string, number> {
  const out: Record<string, number> = {}
  const f = ymd(from)
  const t = ymd(to)
  for (const ss of recordedSessions(s)) {
    if (ss.date < f || ss.date > t) continue
    out[ss.date] = (out[ss.date] ?? 0) + sessionSeconds(ss)
  }
  return out
}

export function workoutDays(s: AppState): Set<string> {
  return new Set(recordedSessions(s).map((x) => x.date))
}

// 해당 달에 운동한 날 수 (같은 날 여러 번 해도 1번으로 센다)
export function monthDoneCount(s: AppState, month: Date): number {
  const prefix = ymd(startOfMonth(month)).slice(0, 7)
  return new Set(recordedSessions(s).filter((x) => x.date.startsWith(prefix)).map((x) => x.date)).size
}

// 이번 주(월~일) 운동한 날 수
export function weekDoneCount(s: AppState, today = new Date()): number {
  const start = startOfWeek(today)
  const f = ymd(start)
  const t = ymd(addDays(start, 6))
  const days = new Set<string>()
  for (const ss of recordedSessions(s)) if (ss.date >= f && ss.date <= t) days.add(ss.date)
  return days.size
}

export interface MonthStat {
  seconds: number
  volume: number
  count: number
}

export function monthStat(s: AppState, anchor: Date): MonthStat {
  const f = startOfMonth(anchor)
  const t = endOfMonth(anchor)
  const a = agg(s, f, t)
  let seconds = 0
  const days = new Set<string>()
  for (const ss of recordedSessions(s)) {
    if (ss.date >= ymd(f) && ss.date <= ymd(t)) {
      seconds += sessionSeconds(ss)
      days.add(ss.date)
    }
  }
  return { seconds, volume: a.total, count: days.size }
}

export function nutritionOn(s: AppState, date: string): NutritionRecord[] {
  return s.nutrition.filter((n) => n.date === date)
}

export function kcalOn(s: AppState, date: string): number {
  return nutritionOn(s, date).reduce((a, n) => a + n.kcal, 0)
}

export function macrosOn(s: AppState, from: Date, to: Date) {
  const f = ymd(from)
  const t = ymd(to)
  const list = s.nutrition.filter((n) => n.date >= f && n.date <= t)
  return {
    carb: list.reduce((a, n) => a + n.carb, 0),
    protein: list.reduce((a, n) => a + n.protein, 0),
    fat: list.reduce((a, n) => a + n.fat, 0),
    kcal: list.reduce((a, n) => a + n.kcal, 0),
    days: new Set(list.map((n) => n.date)).size,
  }
}
