// 날짜 유틸. 한 주는 월요일 시작으로 고정한다 (PRD 7.10).

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  return r
}

export function startOfWeek(d: Date): Date {
  const dow = (d.getDay() + 6) % 7 // 월=0
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -dow)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function dayName(d: Date): string {
  return DAY_KO[d.getDay()]
}

// 월~일 순서의 요일 머리글
export const WEEK_HEADERS = ['월', '화', '수', '목', '금', '토', '일']

export function mdLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function mdDash(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayLabel(d: Date): string {
  return `${mdLabel(d)} (${dayName(d)})`
}

export function weekLabel(start: Date): string {
  return `${mdLabel(start)} ~ ${mdLabel(addDays(start, 6))}`
}

export function monthLabel(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

export function isFuture(d: Date, today = new Date()): boolean {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return d.getTime() > t.getTime()
}

// 생년월일로 나이를 매번 계산한다
export function ageFrom(birth: string, today = new Date()): number {
  const b = parseYmd(birth)
  let age = today.getFullYear() - b.getFullYear()
  const beforeBirthday =
    today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())
  if (beforeBirthday) age -= 1
  return age
}

// 커뮤니티 작성 경과 시간 표시 (PRD 7.9)
export function timeAgo(at: number, now = Date.now()): string {
  const sec = Math.floor((now - at) / 1000)
  if (sec < 60) return '방금 전'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  return mdLabel(new Date(at))
}
