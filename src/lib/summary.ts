// 공유 이미지용 운동 요약: 기간 내 기록을 요약 카드와 종목별 세트 목록으로 정리한다
import { tr } from './i18n'
import type { AppState, Exercise, SetRec } from '../types'
import { PART_NAME } from './constants'
import { setFilled, sessionSeconds, workoutKcal } from './calc'
import { exName } from '../store'
import { agg, lookupFor, recordedSessions } from './stats'
import { comma, hm, vol } from './format'
import { mdDash, ymd } from './dates'

export interface SummaryItem {
  name: string
  right: string // 예: 6세트 x 10회
}

export interface DetailRow {
  no: string // 세트 번호, 워밍업은 W
  warmup: boolean
  left: string // 무게 등
  right: string // 횟수 등
}

export interface DetailCard {
  title: string // 부위 | 운동 이름
  rows: DetailRow[]
}

export interface PeriodSummary {
  seconds: number
  exerciseCount: number
  volume: number
  kcal: number
  items: SummaryItem[]
  cards: DetailCard[]
}

const nonEmpty = (n: number) => n > 0

// 종목 한 줄 요약. 무게 종목은 "6세트 x 10회", 횟수가 다르면 "6세트 x 8~10회"
function summaryRight(ex: Exercise, sets: SetRec[]): string {
  const n = sets.length
  switch (ex.type) {
    case 'weight':
    case 'bodyweight': {
      const reps = sets.map((s) => s.reps)
      const lo = Math.min(...reps)
      const hi = Math.max(...reps)
      return tr('{0}세트 x {1}회', [n, lo === hi ? lo : `${lo}~${hi}`])
    }
    case 'time':
      return tr('{0}세트 · {1}초', [n, comma(sets.reduce((a, s) => a + s.seconds, 0))])
    default: {
      const min = sets.reduce((a, s) => a + s.minutes, 0)
      const km = sets.reduce((a, s) => a + s.distanceKm, 0)
      return [nonEmpty(min) ? tr('{0}분', [comma(min)]) : '', nonEmpty(km) ? `${Math.round(km * 10) / 10}km` : ''].filter(Boolean).join(' · ')
    }
  }
}

function detailRow(ex: Exercise, s: SetRec, no: string): DetailRow {
  const warmup = !!s.warmup
  switch (ex.type) {
    case 'weight':
      return { no, warmup, left: `${s.weight}kg`, right: tr('{0}회', [s.reps]) }
    case 'bodyweight':
      return { no, warmup, left: '', right: tr('{0}회', [s.reps]) }
    case 'time':
      return { no, warmup, left: '', right: tr('{0}초', [s.seconds]) }
    default:
      return { no, warmup, left: s.distanceKm ? `${s.distanceKm}km` : '', right: s.minutes ? tr('{0}분', [s.minutes]) : '' }
  }
}

const hasData = (ex: Exercise, s: SetRec) => (s.warmup ? s.reps > 0 && (ex.type !== 'weight' || s.weight > 0) : setFilled(ex, s))

export function buildSummary(s: AppState, from: Date, to: Date, weightKg: number): PeriodSummary {
  const f = ymd(from)
  const t = ymd(to)
  const lookup = lookupFor(s)
  const sessions = recordedSessions(s).filter((x) => x.date >= f && x.date <= t).sort((a, b) => a.startedAt - b.startedAt)
  const multiDay = f !== t

  const items = new Map<string, { ex: Exercise; sets: SetRec[] }>()
  const cards: DetailCard[] = []
  for (const ss of sessions) {
    for (const item of ss.items) {
      const ex = lookup(item.exerciseId)
      if (!ex) continue
      const work = item.sets.filter((x) => setFilled(ex, x))
      if (work.length === 0) continue
      const acc = items.get(ex.id) ?? { ex, sets: [] }
      acc.sets.push(...work)
      items.set(ex.id, acc)

      let n = 0
      const rows = item.sets.filter((x) => hasData(ex, x)).map((x) => detailRow(ex, x, x.warmup ? 'W' : String(++n)))
      const title = `${PART_NAME[ex.part]} | ${exName(s, ex)}`
      cards.push({ title: multiDay ? `${mdDash(new Date(`${ss.date}T00:00:00`))}  ${title}` : title, rows })
    }
  }

  const a = agg(s, from, to)
  return {
    seconds: sessions.reduce((acc, x) => acc + sessionSeconds(x), 0),
    exerciseCount: items.size,
    volume: a.total,
    kcal: weightKg > 0 ? workoutKcal(sessions, f, t, lookup, weightKg) : 0,
    items: [...items.values()].map(({ ex, sets }) => ({ name: exName(s, ex), right: summaryRight(ex, sets) })),
    cards,
  }
}

export function summaryCards(p: PeriodSummary): { value: string; label: string }[] {
  return [
    { value: hm(p.seconds), label: tr('운동 시간') },
    { value: tr('{0}개', [p.exerciseCount]), label: tr('운동 개수') },
    { value: `${vol(p.volume)}kg`, label: tr('전체 볼륨') },
    { value: `${comma(p.kcal)}kcal`, label: tr('칼로리') },
  ]
}
