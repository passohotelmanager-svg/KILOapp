// AI 추천 오늘의 운동 선택 화면. 추천 목록에서 고른 운동으로 바로 운동을 시작한다.
import { tr } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { actions, exName, useAppState } from '../store'
import { useNav } from '../nav'
import { Card, Page, TopBar } from '../components/ui'
import { PART_NAME } from '../lib/constants'
import { recommendLocal, recommendWithAi, type Recommendation } from '../lib/recommend'
import { aiConfig } from '../lib/aiConfig'

export function AiRecommend() {
  const s = useAppState()
  const nav = useNav()
  const local = useMemo(() => recommendLocal(s), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [rec, setRec] = useState<Recommendation>(local)
  const [loading, setLoading] = useState(() => aiConfig()?.accessToken != null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(local.exercises.map((e) => e.id)))

  // 로그인되어 있으면 AI 추천으로 바꾼다. 실패하면 규칙 추천을 그대로 보여준다
  useEffect(() => {
    const cfg = aiConfig()
    if (!cfg?.accessToken) return
    let alive = true
    recommendWithAi(s, cfg).then((r) => {
      if (!alive) return
      if (r) {
        setRec(r)
        setPicked(new Set(r.exercises.map((e) => e.id)))
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const start = () => {
    rec.exercises.filter((e) => picked.has(e.id)).forEach((e) => actions.addExerciseToSession(e.id))
    nav.pop()
    nav.openWorkout()
  }

  return (
    <>
      <TopBar title={tr('AI 추천 운동')} back />
      <Page fixed>
        <Card title={tr('오늘은 {0} 운동', [PART_NAME[rec.part]])}>
          <p className="muted">{loading ? tr('AI가 추천을 만드는 중이에요') : rec.reason}</p>
          {!loading && (
            <p className="muted" style={{ fontSize: 12 }}>
              {rec.source === 'ai' ? tr('AI 추천') : tr('기록 기반 추천 (AI는 로그인 후 이용)')}
            </p>
          )}
          <div className="mt12">
            {rec.exercises.map((e) => (
              <label key={e.id} className="row between" style={{ padding: '10px 0' }}>
                <span>{exName(s, e)}</span>
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} aria-label={tr('{0} 선택', [exName(s, e)])} />
              </label>
            ))}
          </div>
        </Card>
      </Page>
      <div className="bottom-fixed" style={{ position: 'absolute', left: 0, right: 0, bottom: 'var(--footer-h)' }}>
        <button className="btn" disabled={loading || picked.size === 0} onClick={start}>
          {tr('{0}개 운동으로 시작하기', [picked.size])}
        </button>
      </div>
    </>
  )
}
