// 결과 공유: 요약을 이미지로 그려 공유 시트 또는 파일 저장 (F-08)
import { tr } from './i18n'
import type { PeriodSummary } from './summary'
import { summaryCards } from './summary'

export interface ShareRow {
  label: string
  color: string
  volume: string
  sets: string
  percent: number
}

export interface ShareData {
  title: string
  period: string
  total: string
  rows: ShareRow[]
}

export function renderShareImage(d: ShareData): Promise<Blob | null> {
  const W = 720
  const rowH = 64
  const H = 330 + Math.max(1, d.rows.length) * rowH + 70
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return Promise.resolve(null)
  g.fillStyle = '#f6f1f0'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#fff'
  g.beginPath()
  g.roundRect(30, 30, W - 60, H - 60, 28)
  g.fill()
  g.fillStyle = '#e5534b'
  g.font = '800 30px Pretendard, sans-serif'
  g.fillText('KILO', 70, 100)
  g.fillStyle = '#8b95a1'
  g.font = '500 26px Pretendard, sans-serif'
  g.fillText(d.title, 70, 150)
  g.fillText(d.period, 70, 190)
  g.fillStyle = '#191f28'
  g.font = '800 64px Pretendard, sans-serif'
  g.fillText(d.total, 70, 280)

  let y = 330
  g.font = '600 26px Pretendard, sans-serif'
  if (d.rows.length === 0) {
    g.fillStyle = '#8b95a1'
    g.fillText(tr('기록이 없어요'), 70, y + 30)
  }
  for (const r of d.rows) {
    g.fillStyle = r.color
    g.beginPath()
    g.roundRect(70, y + 6, 22, 22, 5)
    g.fill()
    g.fillStyle = '#191f28'
    g.fillText(r.label, 106, y + 26)
    g.textAlign = 'right'
    g.fillText(`${r.volume}  (${r.percent}%)`, W - 70, y + 26)
    g.textAlign = 'left'
    g.fillStyle = '#f6f1f0'
    g.fillRect(70, y + 40, W - 140, 8)
    g.fillStyle = r.color
    g.fillRect(70, y + 40, ((W - 140) * r.percent) / 100, 8)
    y += rowH
  }
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

// 기기 공유 시트가 있으면 공유하고, 없으면 파일로 내려받는다
export async function shareImage(blob: Blob, name: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData2) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'KILO' })
      return 'shared'
    } catch {
      // 사용자가 취소하면 저장으로 넘어가지 않고 그대로 종료
      return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'saved'
}

type ShareData2 = { files: File[] }

// ----- 운동 요약 / 세트 상세 이미지 -----

const FONT = 'Pretendard, sans-serif'
const MAX_ITEMS = 10
const MAX_CARDS = 8
const MAX_SET_ROWS = 12

// 글자가 너비를 넘으면 말줄임표로 줄인다
function fit(g: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t}…`
}

function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = '#fff'
  g.beginPath()
  g.roundRect(x, y, w, h, 22)
  g.fill()
}

// 공통 머리: KILO 로고, 제목, 요약 카드 4개. 다음에 그릴 y 위치를 돌려준다
function drawHead(g: CanvasRenderingContext2D, W: number, title: string, p: PeriodSummary): number {
  const M = 36
  g.fillStyle = '#e5534b'
  g.font = `800 44px ${FONT}`
  g.fillText('KILO', M, 90)
  g.fillStyle = '#4e5968'
  g.font = `700 34px ${FONT}`
  g.fillText(title, M, 156)

  const cw = (W - M * 2 - 16) / 2
  summaryCards(p).forEach((c, i) => {
    const x = M + (i % 2) * (cw + 16)
    const y = 190 + Math.floor(i / 2) * 136
    card(g, x, y, cw, 120)
    g.fillStyle = '#4e5968'
    g.font = `700 36px ${FONT}`
    g.fillText(fit(g, c.value, cw - 40), x + 24, y + 56)
    g.fillStyle = '#8b95a1'
    g.font = `500 24px ${FONT}`
    g.fillText(c.label, x + 24, y + 94)
  })
  return 190 + 2 * 136 + 8
}

function canvasFor(W: number, H: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#f1f3f5'
    g.fillRect(0, 0, W, H)
  }
  return [c, g]
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/png'))

// 운동 요약: 요약 카드 4개 + 종목별 "6세트 x 10회" 목록
export function renderSummaryImage(title: string, p: PeriodSummary): Promise<Blob | null> {
  const W = 720
  const M = 36
  const shown = p.items.slice(0, MAX_ITEMS)
  const more = p.items.length - shown.length
  const rowH = 70
  const listH = Math.max(1, shown.length) * rowH + (more > 0 ? 50 : 0) + 20
  const H = 190 + 2 * 136 + 8 + listH + 70
  const [c, g] = canvasFor(W, H)
  if (!g) return Promise.resolve(null)

  let y = drawHead(g, W, title, p)
  card(g, M, y, W - M * 2, listH)
  y += 10
  if (shown.length === 0) {
    g.fillStyle = '#8b95a1'
    g.font = `500 26px ${FONT}`
    g.fillText(tr('기록이 없어요'), M + 28, y + 46)
  }
  shown.forEach((it, i) => {
    const cy = y + i * rowH + 44
    g.fillStyle = '#c9d1d9'
    g.font = `italic 700 28px ${FONT}`
    g.fillText(String(i + 1), M + 28, cy)
    g.fillStyle = '#4e5968'
    g.font = `600 28px ${FONT}`
    g.textAlign = 'right'
    const right = it.right
    g.fillText(right, W - M - 28, cy)
    const rw = g.measureText(right).width
    g.textAlign = 'left'
    g.fillText(fit(g, it.name, W - M * 2 - 56 - 60 - rw - 20), M + 84, cy)
  })
  if (more > 0) {
    g.fillStyle = '#8b95a1'
    g.font = `500 24px ${FONT}`
    g.fillText(tr('외 {0}개 운동', [more]), M + 84, y + shown.length * rowH + 40)
  }
  g.fillStyle = '#b0b8c1'
  g.font = `700 22px ${FONT}`
  g.textAlign = 'center'
  g.fillText('KILO', W / 2, H - 28)
  g.textAlign = 'left'
  return toBlob(c)
}

// 세트 상세: 요약 카드 4개 + 종목별 세트(워밍업 W, 무게, 횟수)
export function renderDetailImage(title: string, p: PeriodSummary): Promise<Blob | null> {
  const W = 720
  const M = 36
  const cards = p.cards.slice(0, MAX_CARDS)
  const more = p.cards.length - cards.length
  const rowH = 46
  const heights = cards.map((c) => Math.min(c.rows.length, MAX_SET_ROWS + 1) * rowH + 44)
  const bodyH = (heights.length ? heights.reduce((a, h) => a + h + 16, 0) : 80) + (more > 0 ? 50 : 0)
  const H = 190 + 2 * 136 + 8 + bodyH + 70
  const [c, g] = canvasFor(W, H)
  if (!g) return Promise.resolve(null)

  let y = drawHead(g, W, title, p)
  if (cards.length === 0) {
    g.fillStyle = '#8b95a1'
    g.font = `500 26px ${FONT}`
    g.fillText(tr('기록이 없어요'), M, y + 46)
  }
  cards.forEach((cd, ci) => {
    const h = heights[ci]
    card(g, M, y, W - M * 2, h)
    g.fillStyle = '#4e5968'
    g.font = `600 24px ${FONT}`
    g.fillText(fit(g, cd.title, 285), M + 24, y + 46)
    const rows = cd.rows.slice(0, MAX_SET_ROWS)
    rows.forEach((r, ri) => {
      const ry = y + 46 + ri * rowH
      g.font = `700 26px ${FONT}`
      g.fillStyle = r.warmup ? '#1bb36a' : '#c9d1d9'
      g.fillText(r.no, 366, ry)
      g.fillStyle = '#4e5968'
      g.font = `500 26px ${FONT}`
      g.textAlign = 'right'
      g.fillText(r.left, 540, ry)
      g.fillText(r.right, W - M - 24, ry)
      g.textAlign = 'left'
    })
    if (cd.rows.length > MAX_SET_ROWS) {
      g.fillStyle = '#8b95a1'
      g.font = `500 24px ${FONT}`
      g.fillText(tr('외 {0}세트', [cd.rows.length - MAX_SET_ROWS]), 366, y + 46 + MAX_SET_ROWS * rowH)
    }
    y += h + 16
  })
  if (more > 0) {
    g.fillStyle = '#8b95a1'
    g.font = `500 24px ${FONT}`
    g.fillText(tr('외 {0}개 운동', [more]), M, y + 30)
  }
  g.fillStyle = '#b0b8c1'
  g.font = `700 22px ${FONT}`
  g.textAlign = 'center'
  g.fillText('KILO', W / 2, H - 28)
  g.textAlign = 'left'
  return toBlob(c)
}

// 여러 장을 한 번에 공유한다. 공유 시트가 없으면 한 장씩 내려받는다
export async function shareImages(files: { blob: Blob; name: string }[]): Promise<'shared' | 'saved'> {
  const list = files.map((f) => new File([f.blob], f.name, { type: 'image/png' }))
  const nav = navigator as Navigator & { canShare?: (d: ShareData2) => boolean }
  if (nav.canShare?.({ files: list })) {
    try {
      await navigator.share({ files: list, title: 'KILO' })
    } catch {
      // 사용자가 취소하면 저장으로 넘어가지 않고 그대로 종료
    }
    return 'shared'
  }
  for (const f of files) {
    const url = URL.createObjectURL(f.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    await new Promise((r) => setTimeout(r, 250))
  }
  return 'saved'
}
