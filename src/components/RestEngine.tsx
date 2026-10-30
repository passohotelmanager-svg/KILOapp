// 휴식 타이머 전체 화면과 종료 알람. 앱 어디서든 유지된다 (F-06, 7.4).
import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { actions, useStore } from '../store'
import { holdScreen, releaseScreen, showNotification, startAlarm, stopAlarm } from '../lib/alarm'
import { mmss } from '../lib/format'

export function openRestScreen() {
  window.dispatchEvent(new Event('kilo-rest-open'))
}

export function RestEngine() {
  const rest = useStore((s) => s.rest)
  const consent = useStore((s) => s.settings.notifConsent)
  const [now, setNow] = useState(Date.now())
  const [open, setOpen] = useState(false)
  const [ringing, setRinging] = useState(false)
  const firedFor = useRef<number>(0)

  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener('kilo-rest-open', h)
    return () => window.removeEventListener('kilo-rest-open', h)
  }, [])

  // 타이머 진행 중에만 0.25초 간격으로 갱신하고 화면을 켜 둔다
  useEffect(() => {
    if (!rest) {
      void releaseScreen()
      return
    }
    void holdScreen()
    setNow(Date.now())
    const t = window.setInterval(() => setNow(Date.now()), 250)
    const vis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [rest?.endsAt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rest || ringing) return
    if (now >= rest.endsAt && firedFor.current !== rest.endsAt) {
      firedFor.current = rest.endsAt
      setRinging(true)
      setOpen(false)
      startAlarm()
      if (consent) showNotification(tr('휴식이 끝났어요'), tr('다음 세트를 시작해주세요'))
    }
  }, [now, rest, ringing, consent])

  useEffect(() => {
    if (!rest) {
      setOpen(false)
      if (ringing) {
        setRinging(false)
        stopAlarm()
      }
    }
  }, [rest, ringing])

  const dismiss = () => {
    stopAlarm()
    setRinging(false)
    actions.clearRest()
  }

  if (ringing && rest) {
    return (
      <div className="alarm" role="alertdialog" aria-label={tr('휴식 종료')}>
        <h1>{tr('휴식 끝!')}</h1>
        <p>{rest.label}</p>
        <p style={{ opacity: 0.85, marginTop: 4 }}>{tr('다음 세트를 시작해주세요')}</p>
        <button onClick={dismiss}>{tr('다음 세트 시작')}</button>
      </div>
    )
  }

  if (open && rest) {
    const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
    const adjust = (d: number) => {
      const endsAt = Math.max(Date.now() + 1000, rest.endsAt + d * 1000)
      actions.startRest(Math.ceil((endsAt - Date.now()) / 1000), rest.label)
    }
    return (
      <div className="rest-full" role="dialog" aria-label={tr('휴식 타이머')}>
        <p style={{ opacity: 0.7 }}>{rest.label}</p>
        <div className="big" aria-live="off">{mmss(left)}</div>
        <div className="row gap12 mt24">
          <button className="btn ghost sm" onClick={() => adjust(-10)}>{tr('-10초')}</button>
          <button className="btn ghost sm" onClick={() => adjust(10)}>{tr('+10초')}</button>
        </div>
        <div className="row gap12 mt24">
          <button className="btn line sm" onClick={() => setOpen(false)}>{tr('접어두기')}</button>
          <button className="btn sm" onClick={dismiss}>{tr('건너뛰기')}</button>
        </div>
      </div>
    )
  }
  return null
}

// 푸터 위 미니 바에 쓰는 남은 시간
export function useRestLeft(): number | null {
  const rest = useStore((s) => s.rest)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!rest) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [rest])
  return rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : null
}
