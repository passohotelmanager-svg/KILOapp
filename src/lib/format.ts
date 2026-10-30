// 숫자 표기 유틸

export function comma(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

// 큰 볼륨 축약: 12,500 -> 12.5K (1,000 미만은 그대로)
export function abbr(n: number): string {
  if (n >= 1000) {
    const v = Math.round(n / 100) / 10
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`
  }
  return String(Math.round(n))
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// 초 -> 분:초
export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}

// 초 -> N시간 M분
export function hm(sec: number): string {
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
