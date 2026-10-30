import { describe, expect, it } from 'vitest'
import { vol } from './format'
import { aggregate, bmr, buildAssist, dailyTarget, est1RM, macroKcal, setVolume, tdee } from './calc'
import { startOfWeek, ymd, timeAgo } from './dates'
import type { Exercise, Profile, Session } from '../types'

const bench: Exercise = { id: 'b', nameKo: '벤치', nameEn: 'Bench', part: 'chest', subPart: null, type: 'weight', builtin: true }
const set = (weight: number, reps: number) => ({ id: 'x', weight, reps, seconds: 0, distanceKm: 0, minutes: 0, rest: 30 })

describe('볼륨', () => {
  it('PRD 예시 합계 1,640', () => {
    const v = [set(60, 10), set(70, 8), set(80, 6)].reduce((a, s) => a + setVolume(bench, s), 0)
    expect(v).toBe(1640)
  })
  it('부위별 집계', () => {
    const ss: Session = {
      id: '1',
      date: '2026-10-29',
      startedAt: 0,
      endedAt: null,
      memo: '',
      items: [{ exerciseId: 'b', sets: [set(60, 10), set(70, 8)] }],
    }
    const a = aggregate([ss], '2026-10-26', '2026-11-01', () => bench)
    expect(a.byPart.chest.volume).toBe(1160)
    expect(a.byPart.chest.sets).toBe(2)
  })
})

describe('표기', () => {
  it('볼륨 표기', () => {
    expect(vol(12500)).toBe('12500')
    expect(vol(999)).toBe('999')
    expect(vol(3500.4)).toBe('3500')
  })
  it('경과 시간', () => {
    const now = 1_000_000_000_000
    expect(timeAgo(now - 30_000, now)).toBe('방금 전')
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5분 전')
    expect(timeAgo(now - 3 * 3600_000, now)).toBe('3시간 전')
    expect(timeAgo(now - 2 * 86400_000, now)).toBe('2일 전')
  })
})

describe('날짜', () => {
  it('주는 월요일 시작', () => {
    expect(ymd(startOfWeek(new Date(2026, 9, 29)))).toBe('2026-10-26')
    expect(ymd(startOfWeek(new Date(2026, 10, 1)))).toBe('2026-10-26')
  })
})

describe('영양', () => {
  const p: Profile = { goal: 'lose', weeklyGoal: 3, birth: '1996-10-29', sex: 'male', heightCm: 175, weightKg: 70, activity: 1.55 }
  const today = new Date(2026, 9, 29)
  it('열량 환산', () => expect(macroKcal(100, 100, 50)).toBe(1250))
  it('BMR Mifflin-St Jeor 남성 30세', () => expect(bmr(p, today)).toBeCloseTo(10 * 70 + 6.25 * 175 - 150 + 5, 5))
  it('감량은 TDEE - 500', () => expect(dailyTarget(p, 'lose', today)).toBe(Math.round(tdee(p, today) - 500)))
  it('1RM Epley', () => expect(est1RM(100, 5)).toBeCloseTo(116.67, 1))
})

describe('세트 어시스턴트', () => {
  it('기본: 같은 무게, 워밍업은 20kg·50%·70%', () => {
    const l = buildAssist('basic', 100, 4, 10, true)
    expect(l.filter((x) => x.warmup).map((x) => x.weight)).toEqual([20, 50, 70])
    expect(l.filter((x) => !x.warmup)).toEqual(Array(4).fill({ weight: 100, reps: 10, warmup: false }))
  })
  it('점점 강하게: 70%에서 100%로 상승', () => {
    const w = buildAssist('up', 100, 4, 5, false).map((x) => x.weight)
    expect(w[0]).toBe(70)
    expect(w[w.length - 1]).toBe(100)
  })
  it('탑세트는 마지막, 백오프는 첫 세트가 최고 무게', () => {
    const top = buildAssist('top', 100, 4, 5, false)
    expect(top[top.length - 1].weight).toBe(100)
    expect(buildAssist('backoff', 100, 4, 5, false)[0].weight).toBe(100)
  })
  it('워밍업 세트는 볼륨에서 제외', () => {
    expect(setVolume(bench, { ...set(100, 5), warmup: true })).toBe(0)
  })
})
