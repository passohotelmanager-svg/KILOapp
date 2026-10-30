// SVG 차트 모음: 누적 막대, 단순 막대, 도넛, 인체 그림
import { useState } from 'react'
import { vol, comma, pct } from '../lib/format'

export interface Seg {
  key: string
  label: string
  value: number
  color: string
}

export interface StackBar {
  label: string
  segs: Seg[]
}

// 부위별 색 누적 막대 (F-53, 7.2.1)
export function StackedBars({ bars, dim }: { bars: StackBar[]; dim: string | null }) {
  const [sel, setSel] = useState<number | null>(null)
  const W = 320
  const H = 190
  const top = 24
  const bottom = 26
  const plotH = H - top - bottom
  const totals = bars.map((b) => b.segs.reduce((a, s) => a + s.value, 0))
  const max = Math.max(1, ...totals)
  const n = Math.max(1, bars.length)
  const slot = W / n
  const bw = Math.min(34, slot * 0.6)

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="부위별 볼륨 누적 막대 그래프">
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="#e5e8eb" />
        {bars.map((b, i) => {
          const total = totals[i]
          const cx = slot * i + slot / 2
          const x = cx - bw / 2
          let y = H - bottom
          const parts = b.segs.filter((s) => s.value > 0)
          const showLabel = n <= 12 || i % Math.ceil(n / 10) === 0
          return (
            <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={slot * i} y={0} width={slot} height={H - bottom} fill="transparent" />
              {parts.map((s, j) => {
                const h = Math.max(1, (s.value / max) * plotH)
                const gap = j > 0 ? 2 : 0
                y -= h
                const isTop = j === parts.length - 1
                const opacity = dim && dim !== s.key ? 0.2 : 1
                const hh = Math.max(1, h - gap)
                const r = isTop ? Math.min(4, hh) : 0
                const d = isTop
                  ? `M${x},${y + gap + hh} V${y + gap + r} Q${x},${y + gap} ${x + r},${y + gap} H${x + bw - r} Q${x + bw},${y + gap} ${x + bw},${y + gap + r} V${y + gap + hh} Z`
                  : `M${x},${y + gap} H${x + bw} V${y + gap + hh} H${x} Z`
                return <path key={s.key} d={d} fill={s.color} opacity={opacity} />
              })}
              {total > 0 && (
                <text x={cx} y={H - bottom - (total / max) * plotH - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#191f28">
                  {vol(total)}
                </text>
              )}
              {showLabel && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="#8b95a1">
                  {b.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {sel !== null && bars[sel] && (
        <Tooltip bar={bars[sel]} left={((sel + 0.5) / n) * 100} />
      )}
    </div>
  )
}

function Tooltip({ bar, left }: { bar: StackBar; left: number }) {
  const total = bar.segs.reduce((a, s) => a + s.value, 0)
  const parts = bar.segs.filter((s) => s.value > 0)
  const pos = Math.min(62, Math.max(0, left - 20))
  return (
    <div className="tip" style={{ top: 0, left: `${pos}%` }} role="status">
      <b>{bar.label}</b>
      {parts.length === 0 && <div>기록 없음</div>}
      {parts.map((s) => (
        <div key={s.key}>
          {s.label} {comma(s.value)}kg ({pct(s.value, total)}%)
        </div>
      ))}
      {parts.length > 0 && (
        <>
          <hr />
          <div>합계 {comma(total)}kg</div>
        </>
      )}
    </div>
  )
}

// 둥근 막대 그래프 (칼로리, 유산소 등)
export function RoundBars({
  items,
  color = '#e5534b',
  todayIndex,
  avg,
  unit,
}: {
  items: { label: string; value: number }[]
  color?: string
  todayIndex?: number
  avg?: number
  unit?: string
}) {
  const W = 320
  const H = 170
  const top = 18
  const bottom = 34
  const plotH = H - top - bottom
  const max = Math.max(1, ...items.map((i) => i.value), avg ?? 0)
  const n = Math.max(1, items.length)
  const slot = W / n
  const bw = Math.min(26, slot * 0.55)
  const avgY = avg ? H - bottom - (avg / max) * plotH : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`막대 그래프${unit ? ` (${unit})` : ''}`}>
      {avgY !== null && (
        <>
          <line x1="0" x2={W} y1={avgY} y2={avgY} stroke="#8b95a1" strokeDasharray="4 4" />
          <text x={W - 2} y={avgY - 4} textAnchor="end" fontSize="10" fill="#8b95a1">평균</text>
        </>
      )}
      {items.map((it, i) => {
        const cx = slot * i + slot / 2
        const h = (it.value / max) * plotH
        const isToday = i === todayIndex
        return (
          <g key={i}>
            {it.value > 0 && (
              <rect x={cx - bw / 2} y={H - bottom - h} width={bw} height={Math.max(h, 2)} rx={bw / 2} fill={color} opacity={isToday ? 1 : 0.45} />
            )}
            <text x={cx} y={H - 16} textAnchor="middle" fontSize="10" fill="#8b95a1">{it.label}</text>
            {isToday && (
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#191f28">오늘</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// 도넛 차트 (영양소)
export function Donut({ slices, size = 150 }: { slices: { value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const r = 54
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 150 150" width={size} height={size} role="img" aria-label="영양소 비율 도넛 차트">
      <circle cx="75" cy="75" r={r} fill="none" stroke="#f6f1f0" strokeWidth="26" />
      {total > 0 &&
        slices.map((s, i) => {
          const len = (s.value / total) * c
          const el = (
            <circle
              key={i}
              cx="75"
              cy="75"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="26"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 75 75)"
            />
          )
          const mid = acc + len / 2
          const ang = (mid / c) * 2 * Math.PI - Math.PI / 2
          const p = Math.round((s.value / total) * 100)
          const label =
            p >= 6 ? (
              <text key={'t' + i} x={75 + r * Math.cos(ang)} y={75 + r * Math.sin(ang) + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#191f28">
                {p}%
              </text>
            ) : null
          acc += len
          return [el, label]
        })}
    </svg>
  )
}

// 앞 / 뒤 인체 그림. 부위별 볼륨 진하기로 칠한다 (F-37).
const FRONT: { part: string; d: string }[] = [
  { part: 'shoulders', d: 'M36 40 q-14 2-16 16 l8 2 q2-10 10-12z' },
  { part: 'shoulders', d: 'M84 40 q14 2 16 16 l-8 2 q-2-10-10-12z' },
  { part: 'chest', d: 'M38 42 h44 q2 12-4 22 h-36 q-6-10-4-22z' },
  { part: 'abs', d: 'M42 66 h36 l-3 34 h-30z' },
  { part: 'arms', d: 'M18 58 l9 2 -4 36 -9-2z' },
  { part: 'arms', d: 'M102 58 l-9 2 4 36 9-2z' },
  { part: 'legs', d: 'M42 104 h17 l-2 78 h-12z' },
  { part: 'legs', d: 'M61 104 h17 l-3 78 h-12z' },
]
const BACK: { part: string; d: string }[] = [
  { part: 'shoulders', d: 'M36 40 q-14 2-16 16 l8 2 q2-10 10-12z' },
  { part: 'shoulders', d: 'M84 40 q14 2 16 16 l-8 2 q-2-10-10-12z' },
  { part: 'back', d: 'M38 42 h44 l-2 34 h-40z' },
  { part: 'back', d: 'M44 78 h32 l-2 22 h-28z' },
  { part: 'arms', d: 'M18 58 l9 2 -4 36 -9-2z' },
  { part: 'arms', d: 'M102 58 l-9 2 4 36 9-2z' },
  { part: 'legs', d: 'M42 104 h17 l-2 78 h-12z' },
  { part: 'legs', d: 'M61 104 h17 l-3 78 h-12z' },
]

export function BodyMap({ volumes }: { volumes: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(volumes))
  const fill = (part: string) => {
    const v = volumes[part] ?? 0
    if (v <= 0) return '#d5dbe1'
    const t = 0.25 + 0.75 * (v / max)
    return `rgba(229,83,75,${t.toFixed(2)})`
  }
  const fig = (shapes: { part: string; d: string }[], title: string) => (
    <div className="center">
      <svg viewBox="0 0 120 190" width="120" role="img" aria-label={`${title} 근육 피로도`}>
        <circle cx="60" cy="22" r="14" fill="#d5dbe1" />
        <rect x="52" y="34" width="16" height="8" fill="#d5dbe1" />
        {shapes.map((s, i) => (
          <path key={i} d={s.d} fill={fill(s.part)} />
        ))}
      </svg>
      <div className="muted" style={{ fontSize: 12 }}>{title}</div>
    </div>
  )
  return (
    <div className="body-figs">
      {fig(FRONT, '앞')}
      {fig(BACK, '뒤')}
    </div>
  )
}
