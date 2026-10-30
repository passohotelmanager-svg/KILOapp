// 투데이 맨 아래 카드: 개발자의 하루 볼륨(보디빌더 그림과 운동 요약 이미지)과 내 기록 비교.
// 개발자 볼륨은 모든 사용자에게 같게 보이고, 사용자는 자기 오늘 기록과 나란히 비교한다.
import { useEffect, useState } from 'react'
import { useAppState } from '../store'
import { Card } from './ui'
import { renderSummaryImage } from '../lib/share'
import { buildSummary, type PeriodSummary } from '../lib/summary'
import { dayLabel, parseYmd, ymd } from '../lib/dates'
import { developerSummary, fetchDeveloperVolume, type DeveloperVolume } from '../lib/developerVolume'
import { comma, hm, vol } from '../lib/format'
import { tr } from '../lib/i18n'
import { authEnabled } from '../lib/auth'

// 비교 표의 한 줄: 개발자 값과 내 값, 차이
function Row({ label, dev, me, fmt, unit = '' }: { label: string; dev: number; me: number; fmt: (n: number) => string; unit?: string }) {
  const diff = me - dev
  return (
    <tr>
      <td className="muted">{label}</td>
      <td className="r">{fmt(dev)}{unit}</td>
      <td className="r"><b>{fmt(me)}{unit}</b></td>
      <td className="r" style={{ color: diff > 0 ? 'var(--inc)' : diff < 0 ? 'var(--goal-blue)' : 'var(--text2)' }}>
        {diff === 0 ? '-' : `${diff > 0 ? '+' : '-'}${fmt(Math.abs(diff))}${unit}`}
      </td>
    </tr>
  )
}

export function DailyVolume() {
  const s = useAppState()
  const [dev, setDev] = useState<DeveloperVolume | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  // 열 때 한 번, 그 뒤로 1분마다 다시 읽어 개발자가 올린 새 기록을 반영한다
  useEffect(() => {
    let alive = true
    const load = () =>
      fetchDeveloperVolume().then((d) => {
        if (!alive) return
        setDev((old) => (JSON.stringify(old) === JSON.stringify(d) ? old : d))
        setLoaded(true)
      })
    load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  // 개발자 요약 이미지 (분석의 공유 이미지와 같은 모양)
  useEffect(() => {
    if (!dev) return
    let alive = true
    let made = ''
    const title = tr('개발자 운동 요약 · {0}', [dayLabel(parseYmd(dev.date))])
    renderSummaryImage(title, developerSummary(dev)).then((blob) => {
      if (!alive || !blob) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [dev, s.settings.lang])

  // 내 기록은 개발자와 같은 날 기준으로 비교한다
  const weightKg = [...s.bodyLog].reverse().find((l) => l.weightKg)?.weightKg ?? s.profile?.weightKg ?? 0
  const day = parseYmd(dev?.date ?? ymd(new Date()))
  const me: PeriodSummary = buildSummary(s, day, day, weightKg)

  return (
    <Card title={tr('개발자의 볼륨')}>
      <p className="muted" style={{ marginBottom: 8 }}>{tr('개발자의 기록과 내 기록을 비교해 보세요')}</p>
      <img src="/bodybuilder.png" alt={tr('보디빌딩 포즈')} style={{ display: 'block', width: 150, height: 150, margin: '0 auto 12px', objectFit: 'contain' }} />
      {dev && url && <img src={url} alt={tr('개발자 운동 요약 · {0}', [dev.date])} style={{ display: 'block', width: '100%', borderRadius: 12 }} />}
      {loaded && !dev && <p className="muted center">{authEnabled ? tr('개발자 기록이 아직 없어요') : tr('개발자 기록을 불러오지 못했어요')}</p>}
      {dev && (
        <table className="tbl mt12">
          <thead>
            <tr className="muted" style={{ fontSize: 12 }}>
              <th style={{ textAlign: 'left', fontWeight: 600 }}>{tr('항목')}</th>
              <th className="r">{tr('개발자')}</th>
              <th className="r">{tr('나')}</th>
              <th className="r">{tr('차이')}</th>
            </tr>
          </thead>
          <tbody>
            <Row label={tr('운동 시간')} dev={dev.seconds} me={me.seconds} fmt={hm} />
            <Row label={tr('운동 개수')} dev={dev.exerciseCount} me={me.exerciseCount} fmt={(n) => tr('{0}개', [n])} />
            <Row label={tr('전체 볼륨')} dev={dev.volume} me={me.volume} fmt={vol} unit="kg" />
            <Row label={tr('칼로리')} dev={dev.kcal} me={me.kcal} fmt={comma} unit="kcal" />
          </tbody>
        </table>
      )}
    </Card>
  )
}
