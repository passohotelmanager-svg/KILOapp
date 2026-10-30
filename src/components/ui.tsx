import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useNav } from '../nav'

export function TopBar({
  title,
  back,
  right,
  onBack,
}: {
  title?: string
  back?: boolean
  right?: ReactNode
  onBack?: () => void
}) {
  const nav = useNav()
  return (
    <div className="topbar">
      {back && (
        <div className="left">
          <button className="iconbtn" aria-label="뒤로가기" onClick={onBack ?? nav.pop}>
            <Icon name="back" />
          </button>
        </div>
      )}
      {title}
      {right && <div className="right">{right}</div>}
    </div>
  )
}

export function Card({
  title,
  onMore,
  children,
  className = '',
}: {
  title?: string
  onMore?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <h3 className="card-title">{title}</h3>
          {onMore && (
            <button className="round-arrow" onClick={onMore} aria-label={`${title} 상세`}>
              <Icon name="chevron" size={16} />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export function Sheet({
  onClose,
  children,
  full,
  mid,
}: {
  onClose: () => void
  children: ReactNode
  full?: boolean
  mid?: boolean
}) {
  return (
    <div className={`overlay ${mid ? 'mid' : ''}`} onClick={onClose}>
      {mid ? (
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      ) : (
        <div className={`sheet ${full ? 'full' : ''}`} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
  )
}

// 짧은 알림 문구
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState('')
  const timer = useRef<number>()
  const show = (m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(''), 2200)
  }
  return [msg ? <div className="toast" role="status">{msg}</div> : null, show]
}

// 세로 휠 선택기 (생년월일, 키, 체중)
export function Wheel({
  options,
  value,
  onChange,
  unit,
}: {
  options: { value: number; label: string }[]
  value: number
  onChange: (v: number) => void
  unit?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()
  const idx = Math.max(0, options.findIndex((o) => o.value === value))

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = idx * 44
    // 옵션 목록이 바뀌어도(월에 따른 일수) 현재 값 위치를 유지한다
  }, [options.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (!ref.current) return
      const i = Math.min(options.length - 1, Math.max(0, Math.round(ref.current.scrollTop / 44)))
      if (options[i] && options[i].value !== value) onChange(options[i].value)
    }, 90)
  }

  return (
    <div className="wheel-wrap">
      <div className="wheel" ref={ref} onScroll={onScroll} role="listbox">
        <div className="pad" />
        {options.map((o, i) => (
          <div
            key={o.value}
            className={`opt ${i === idx ? 'on' : ''}`}
            role="option"
            aria-selected={i === idx}
            onClick={() => {
              if (ref.current) ref.current.scrollTo({ top: i * 44, behavior: 'smooth' })
            }}
          >
            {o.label}
          </div>
        ))}
        <div className="pad" />
      </div>
      {unit && <span className="wheel-unit">{unit}</span>}
    </div>
  )
}

// 길게 누르기 감지
export function useLongPress(cb: () => void, ms = 500) {
  const t = useRef<number>()
  const clear = () => window.clearTimeout(t.current)
  return {
    onPointerDown: () => {
      clear()
      t.current = window.setTimeout(cb, ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      clear()
      cb()
    },
  }
}

// 스크롤 영역. 탭과 화면별로 스크롤 위치를 기억한다 (F-51).
export function Page({ children, fixed }: { children: ReactNode; fixed?: boolean }) {
  const nav = useNav()
  const ref = useRef<HTMLDivElement>(null)
  const key = nav.scrollKey
  useLayoutEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = nav.scrolls.current[key] ?? 0
    return () => {
      if (el) nav.scrolls.current[key] = el.scrollTop
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`scroll ${fixed ? 'has-fixed' : ''}`} ref={ref}>
      {children}
    </div>
  )
}
