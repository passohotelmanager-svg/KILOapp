// 개발자(운영자)의 하루 볼륨. 모든 사용자가 같은 값을 보고 자기 기록과 비교한다.
// 서버 로그인(Supabase)이 켜져 있으면 서버의 developer_volume 표를 쓰고, 데모 모드에서는 public/developer-volume.json 파일을 쓴다.
import { useSyncExternalStore } from 'react'
import { getLang, tr } from './i18n'
import { authEnabled } from './auth'
import { checkIsDeveloper, fetchDeveloperVolumeRow, publishDeveloperVolumeRow } from './cloud'
import { comma } from './format'
import { buildSummary, type PeriodSummary } from './summary'
import { parseYmd } from './dates'
import { setFilled } from './calc'
import { lookupFor, recordedSessions } from './stats'
import type { AppState, Exercise, SetRec } from '../types'

export interface DeveloperVolume {
  name: string
  date: string // YYYY-MM-DD
  seconds: number
  exerciseCount: number
  volume: number
  kcal: number
  items: {
    name: string
    nameEn?: string
    sets?: number
    repsLo?: number
    repsHi?: number
    seconds?: number
    minutes?: number
    km?: number
  }[]
}

const isVolume = (d: unknown): d is DeveloperVolume =>
  typeof d === 'object' && d !== null && typeof (d as DeveloperVolume).volume === 'number' && Array.isArray((d as DeveloperVolume).items)

// 개발자의 볼륨을 읽는다. 없으면 null
export async function fetchDeveloperVolume(): Promise<DeveloperVolume | null> {
  if (authEnabled) {
    const r = await fetchDeveloperVolumeRow()
    return r.ok && isVolume(r.value) ? r.value : null
  }
  try {
    const res = await fetch('/developer-volume.json', { cache: 'no-store' })
    if (!res.ok) return null
    const d: unknown = await res.json()
    return isVolume(d) ? d : null
  } catch {
    return null
  }
}

// 개발자의 볼륨을 올린다. 서버 모드에서는 개발자 계정만 성공하고, 데모 모드에서는 개발 서버(/api/developer-volume)가 파일로 저장한다.
export async function publishDeveloperVolume(d: DeveloperVolume): Promise<boolean> {
  if (authEnabled) return (await publishDeveloperVolumeRow(d)).ok
  try {
    const res = await fetch('/api/developer-volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    })
    return res.ok
  } catch {
    return false
  }
}

// ----- 내가 개발자 계정인지 (서버 모드) -----
let developer = false
const devListeners = new Set<() => void>()
export function useIsDeveloper(): boolean {
  return useSyncExternalStore(
    (cb) => {
      devListeners.add(cb)
      return () => devListeners.delete(cb)
    },
    () => developer,
  )
}
// 로그인할 때 한 번 확인한다. 로그아웃(loggedIn=false)하면 개발자 상태를 지운다
export async function refreshDeveloper(loggedIn: boolean): Promise<void> {
  let next = false
  if (loggedIn && authEnabled) {
    const r = await checkIsDeveloper()
    next = r.ok && r.value
  }
  if (next !== developer) {
    developer = next
    devListeners.forEach((l) => l())
  }
}

// 공유 이미지를 그리는 요약 형식으로 바꾼다
export function developerSummary(d: DeveloperVolume): PeriodSummary {
  return {
    seconds: d.seconds,
    exerciseCount: d.exerciseCount,
    volume: d.volume,
    kcal: d.kcal,
    cards: [],
    items: d.items.map((it) => {
      const name = getLang() === 'en' ? (it.nameEn ?? it.name) : it.name
      if (it.sets !== undefined && it.repsLo !== undefined) {
        const reps = it.repsLo === it.repsHi || it.repsHi === undefined ? it.repsLo : `${it.repsLo}~${it.repsHi}`
        return { name, right: tr('{0}세트 x {1}회', [it.sets, reps]) }
      }
      if (it.sets !== undefined && it.seconds !== undefined) {
        return { name, right: tr('{0}세트 · {1}초', [it.sets, comma(it.seconds)]) }
      }
      const parts = [it.minutes ? tr('{0}분', [comma(it.minutes)]) : '', it.km ? `${it.km}km` : ''].filter(Boolean)
      return { name, right: parts.join(' · ') }
    }),
  }
}

// 가장 최근에 운동한 날의 기록을 개발자 볼륨 형식으로 만든다. 기록이 하나도 없으면 null
export function toDeveloperVolume(s: AppState, weightKg: number): DeveloperVolume | null {
  const recorded = recordedSessions(s)
  if (recorded.length === 0) return null
  const date = recorded.reduce((m, x) => (x.date > m ? x.date : m), '')
  const day = parseYmd(date)
  const sum = buildSummary(s, day, day, weightKg)
  const lookup = lookupFor(s)
  const by = new Map<string, { ex: Exercise; sets: SetRec[] }>()
  for (const ss of recorded.filter((x) => x.date === date)) {
    for (const it of ss.items) {
      const ex = lookup(it.exerciseId)
      const done = ex ? it.sets.filter((x) => setFilled(ex, x)) : []
      if (!ex || done.length === 0) continue
      const acc = by.get(ex.id) ?? { ex, sets: [] }
      acc.sets.push(...done)
      by.set(ex.id, acc)
    }
  }
  const items: DeveloperVolume['items'] = [...by.values()].map(({ ex, sets }) => {
    const base = { name: ex.nameKo, nameEn: ex.nameEn }
    if (ex.type === 'weight' || ex.type === 'bodyweight') {
      const reps = sets.map((x) => x.reps)
      return { ...base, sets: sets.length, repsLo: Math.min(...reps), repsHi: Math.max(...reps) }
    }
    if (ex.type === 'time') return { ...base, sets: sets.length, seconds: sets.reduce((a, x) => a + x.seconds, 0) }
    return {
      ...base,
      minutes: sets.reduce((a, x) => a + x.minutes, 0),
      km: Math.round(sets.reduce((a, x) => a + x.distanceKm, 0) * 10) / 10,
    }
  })
  return { name: 'KILO', date, seconds: sum.seconds, exerciseCount: sum.exerciseCount, volume: sum.volume, kcal: sum.kcal, items }
}
