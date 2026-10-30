// 오늘의 추천 운동. 로그인한 상태면 서버의 AI(recommend-workout)에 물어보고,
// 로그인이 없거나 호출이 실패하면 가장 오래 쉰 부위를 고르는 규칙 추천으로 대신한다.
import type { AppState, Exercise, PartCode } from '../types'
import { BUILTIN, findExercise } from '../store'
import { PART_NAME, PARTS } from './constants'
import { recordedSessions } from './stats'

export interface Recommendation {
  part: PartCode
  reason: string
  exercises: Exercise[]
  source: 'ai' | 'local'
}

const PICK_COUNT = 5
// 기록이 없는 부위. Infinity는 뺄셈이 NaN이 되어 정렬이 깨지므로 큰 수를 쓴다
const NEVER = 100_000
// AI에 보내는 후보 수 (부위당). 요청 크기 제한(16KB) 안에 들어오도록 한다
const CANDIDATES_PER_PART = 15

const DAY_MS = 86_400_000

// 부위별로 마지막 운동일, 최근 14일 세트 수, 운동별 수행 횟수를 센다
function history(s: AppState, today: Date) {
  const lastDone: Partial<Record<PartCode, string>> = {}
  const sets14d: Partial<Record<PartCode, number>> = {}
  const freq: Record<string, number> = {}
  const cutoff = today.getTime() - 14 * DAY_MS

  for (const ss of recordedSessions(s)) {
    const recent = new Date(`${ss.date}T00:00:00`).getTime() >= cutoff
    for (const it of ss.items) {
      const ex = findExercise(s, it.exerciseId)
      if (!ex) continue
      freq[ex.id] = (freq[ex.id] ?? 0) + 1
      if (!lastDone[ex.part] || ss.date > lastDone[ex.part]!) lastDone[ex.part] = ss.date
      if (recent) sets14d[ex.part] = (sets14d[ex.part] ?? 0) + it.sets.length
    }
  }
  const daysSince = (part: PartCode): number => {
    const d = lastDone[part]
    if (!d) return NEVER
    return Math.floor((today.getTime() - new Date(`${d}T00:00:00`).getTime()) / DAY_MS)
  }
  return { daysSince, sets14d, freq }
}

// 내가 자주 한 운동을 먼저, 부족하면 기본 운동 순서대로
function rankedFor(s: AppState, part: PartCode, freq: Record<string, number>): Exercise[] {
  return [...s.customExercises, ...BUILTIN]
    .filter((e) => e.part === part)
    .map((e, i) => ({ e, f: freq[e.id] ?? 0, i }))
    .sort((a, b) => b.f - a.f || a.i - b.i)
    .map((x) => x.e)
}

export function recommendLocal(s: AppState, today = new Date()): Recommendation {
  const { daysSince, freq } = history(s, today)
  // 기록이 없는 부위가 먼저, 그다음 가장 오래 쉰 부위. 같으면 PARTS 순서를 따른다
  const part = [...PARTS].sort((a, b) => daysSince(b) - daysSince(a))[0]
  const gap = daysSince(part)
  const reason = gap === NEVER ? '아직 기록이 없는 부위예요' : gap === 0 ? '오늘 이미 한 부위예요' : `${gap}일 동안 쉬었어요`
  return { part, reason, exercises: rankedFor(s, part, freq).slice(0, PICK_COUNT), source: 'local' }
}

// ----- AI 추천 -----

const KO_TO_PART = Object.fromEntries(PARTS.map((p) => [PART_NAME[p], p])) as Record<string, PartCode>

export interface AiConfig {
  url: string
  publishableKey: string
  // 로그인한 사용자의 액세스 토큰. 로그인이 없으면 null
  accessToken: string | null
}

export function buildAiRequest(s: AppState, today = new Date()) {
  const { daysSince, sets14d, freq } = history(s, today)
  return {
    parts: PARTS.map((p) => ({
      bodyPart: PART_NAME[p],
      daysSince: daysSince(p) === NEVER ? null : daysSince(p),
      sets14d: sets14d[p] ?? 0,
    })),
    candidates: PARTS.flatMap((p) =>
      rankedFor(s, p, freq)
        .slice(0, CANDIDATES_PER_PART)
        .map((e) => ({ id: e.id, name: e.nameKo, bodyPart: PART_NAME[p] })),
    ),
  }
}

// 서버가 돌려준 결과를 화면용으로 바꾼다. 후보에 없는 운동이 섞여 있으면 null
export function fromAiResponse(s: AppState, data: unknown): Recommendation | null {
  const r = (data as { recommendation?: { bodyPart?: string; reason?: string; exerciseIds?: unknown } })?.recommendation
  const part = r?.bodyPart ? KO_TO_PART[r.bodyPart] : undefined
  if (!part || typeof r?.reason !== 'string' || !Array.isArray(r.exerciseIds)) return null
  const exercises = r.exerciseIds
    .map((id) => (typeof id === 'string' ? findExercise(s, id) : undefined))
    .filter((e): e is Exercise => !!e && e.part === part)
  if (exercises.length === 0) return null
  return { part, reason: r.reason, exercises, source: 'ai' }
}

// 실패하면 null을 돌려주므로 호출하는 쪽에서 규칙 추천으로 대신한다
export async function recommendWithAi(s: AppState, cfg: AiConfig): Promise<Recommendation | null> {
  if (!cfg.accessToken) return null
  try {
    const res = await fetch(`${cfg.url}/functions/v1/recommend-workout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.publishableKey,
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(buildAiRequest(s)),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return fromAiResponse(s, await res.json())
  } catch {
    return null
  }
}
