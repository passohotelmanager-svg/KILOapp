// 숫자 표기 유틸
import { tr } from './i18n'

export function comma(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

// 볼륨 표기: K 같은 축약 없이 숫자 그대로 (3500 -> 3500)
export function vol(n: number): string {
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
  if (h > 0) return tr('{0}시간 {1}분', [h, m])
  return tr('{0}분', [m])
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
