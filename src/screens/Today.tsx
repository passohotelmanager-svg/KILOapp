// 투데이 화면 (PRD 7.5)
import { tr } from '../lib/i18n'
import { useState } from 'react'
import { actions, activeSession, exName, findExercise, useAppState } from '../store'
import { useNav } from '../nav'
import { Card, Page, Sheet, TopBar } from '../components/ui'
import { Icon } from '../components/Icon'
import { Pose } from '../components/Pose'
import { DailyVolume } from '../components/DailyVolume'
import { MEALS, PART_NAME } from '../lib/constants'
import { WEEK_HEADERS, addDays, addMonths, dayName, endOfMonth, mdLabel, monthLabel, parseYmd, startOfMonth, startOfWeek, ymd } from '../lib/dates'
import { vol, comma, hm } from '../lib/format'
import { dailyTarget } from '../lib/calc'
import { agg, kcalOn, macrosOn, monthDoneCount, nutritionOn, recordedSessions, weekDoneCount, workoutDays } from '../lib/stats'
import { sessionSeconds, setFilled } from '../lib/calc'

export function Today() {
  const s = useAppState()
  const nav = useNav()
  const today = new Date()
  const todayKey = ymd(today)
  const [sel, setSel] = useState(todayKey)

  const weekStart = startOfWeek(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const done = workoutDays(s)
  const running = activeSession(s)

  const start = () => {
    actions.startSession()
    nav.openWorkout()
  }

  const target = s.profile ? dailyTarget(s.profile) : 0
  const eaten = kcalOn(s, todayKey)
  const weekDone = weekDoneCount(s)
  // 월간 운동 목표: 이번 달 운동한 날 / 이번 달 일수
  const monthDays = endOfMonth(today).getDate()
  const monthDone = monthDoneCount(s, today)
  const pct = Math.min(100, (monthDone / monthDays) * 100)
  const [calOpen, setCalOpen] = useState(false)
  // 진행바의 각 지점(0%, 50%, 100%)을 지났는지
  const on = (at: number) => (at === 0 ? pct > 0 : pct >= at)

  // 지난주 요약
  const lastStart = addDays(weekStart, -7)
  const lastEnd = addDays(weekStart, -1)
  const lastAgg = agg(s, lastStart, lastEnd)
  const lastSessions = recordedSessions(s).filter((x) => x.date >= ymd(lastStart) && x.date <= ymd(lastEnd))
  const lastAvgSec = lastSessions.length ? lastSessions.reduce((a, x) => a + sessionSeconds(x), 0) / lastSessions.length : 0
  const lastMacro = macrosOn(s, lastStart, lastEnd)
  const lastAvgKcal = lastMacro.days ? lastMacro.kcal / lastMacro.days : 0

  const lastBody = s.bodyLog[s.bodyLog.length - 1]
  const selSessions = recordedSessions(s).filter((x) => x.date === sel)

  return (
    <>
      <TopBar title={tr('투데이')} />
      <Page>
        <div className="weekstrip" role="group" aria-label={tr('이번 주')}>
          <div className="days">
            {days.map((d) => {
              const k = ymd(d)
              return (
                <button key={k} className={`${k === todayKey ? 'today' : ''} ${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)} aria-label={tr('{0}월 {1}일', [d.getMonth() + 1, d.getDate()])}>
                  {dayName(d)}
                  <b>{d.getDate()}</b>
                  {done.has(k) && <div className="dot" />}
                </button>
              )
            })}
          </div>
        </div>

        {sel !== todayKey && (
          <Card title={tr('{0} 기록', [mdLabel(parseYmd(sel))])}>
            {selSessions.length === 0 ? (
              <p className="muted">{tr('기록이 없어요')}</p>
            ) : (
              selSessions.flatMap((ss) =>
                ss.items.map((it) => {
                  const ex = findExercise(s, it.exerciseId)
                  if (!ex) return null
                  const n = it.sets.filter((x) => setFilled(ex, x)).length
                  return (
                    <div key={ss.id + it.exerciseId} className="row between" style={{ padding: '6px 0' }}>
                      <span>{exName(s, ex)}</span>
                      <span className="muted">{PART_NAME[ex.part]} {tr('{0}세트', [n])}</span>
                    </div>
                  )
                }),
              )
            )}
          </Card>
        )}

        <Card>
          <div className="row gap12">
            <div style={{ color: 'var(--primary)' }}><Icon name="dumbbell" size={36} /></div>
            <div className="grow">
              <h3 className="card-title">{running ? tr('운동이 진행 중이에요') : tr('운동을 시작해 볼까요?')}</h3>
            </div>
          </div>
          <button className="btn mt16" onClick={start}>{running ? tr('운동 이어하기') : tr('운동 시작하기')}</button>
          <button className="btn line mt8" onClick={() => nav.push('aiRecommend')}>{tr('AI 추천 오늘의 운동으로 시작하기')}</button>
        </Card>

        <Card title={tr('식단')} onMore={() => nav.push('nutrition')}>
          <div className="num">
            {comma(eaten)}
            <small>kcal</small>
            {target > 0 && <span className="unit"> / {comma(target)}kcal</span>}
          </div>
          <div className="bar-track mt12">
            <div className="bar-fill" style={{ width: `${target ? Math.min(100, (eaten / target) * 100) : 0}%` }} />
          </div>
          <div className="meal-row">
            {MEALS.map((m) => {
              const k = nutritionOn(s, todayKey).filter((n) => n.meal === m.code).reduce((a, n) => a + n.kcal, 0)
              return (
                <button key={m.code} className="meal-box" onClick={() => nav.push('mealEdit', { meal: m.code, date: todayKey })} aria-label={tr('{0} 식사 추가', [m.name])}>
                  <b>{m.name}</b>
                  <div className="muted">{k ? `${comma(k)}kcal` : '-'}</div>
                  <div className="plus"><Icon name="plus" size={16} /></div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card
          title={tr('운동 목표')}
          action={
            <button className="round-arrow" onClick={() => setCalOpen(true)} aria-label={tr('월간 운동 달력')}>
              <Icon name="calendar" size={16} />
            </button>
          }
        >
          <div className="num">
            {monthDone}
            <span className="unit"> / {monthDays}</span>
          </div>
          <p className="muted">{tr('이번 달 운동한 날 · 이번 주 {0} / 7', [weekDone])}</p>
          <div className="goal-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={tr('이번 달 운동 달성률')}>
            <div className="goal-rail" />
            <div className="goal-fill" style={{ width: `calc((100% - 56px) * ${pct / 100})` }} />
            {[0, 50, 100].map((at, i) => (
              <div key={at} className={`goal-dot ${on(at) ? 'on' : ''}`}><Pose index={i as 0 | 1 | 2} color={on(at) ? '#ffffff' : '#4c8bf5'} size={44} /></div>
            ))}
          </div>
        </Card>

        <div className="carousel">
          <Card title={tr('시간 분석')}>
            <p className="muted">{tr('지난주 평균 운동 시간')}</p>
            <div className="num mt8">{lastAvgSec ? hm(lastAvgSec) : '-'}</div>
            {!lastAvgSec && <p className="muted">{tr('지난주 기록 없음')}</p>}
          </Card>
          <Card title={tr('볼륨 분석')}>
            <p className="muted">{tr('지난주 총 볼륨')}</p>
            <div className="num mt8">{lastAgg.total ? vol(lastAgg.total) : '-'}{lastAgg.total ? <small>kg</small> : null}</div>
            {!lastAgg.total && <p className="muted">{tr('지난주 기록 없음')}</p>}
          </Card>
          <Card title={tr('칼로리')}>
            <p className="muted">{tr('지난주 평균 섭취')}</p>
            <div className="num mt8">{lastAvgKcal ? comma(lastAvgKcal) : '-'}{lastAvgKcal ? <small>kcal</small> : null}</div>
            {!lastAvgKcal && <p className="muted">{tr('지난주 기록 없음')}</p>}
          </Card>
        </div>

        <Card title={tr('체중')} onMore={() => nav.push('bodyInfo')}>
          <div className="num">{lastBody?.weightKg ?? '-'}{lastBody?.weightKg ? <small>kg</small> : null}</div>
          {lastBody && (
            <p className="muted">
              {tr('최근 업데이트: {0}', [mdLabel(new Date(lastBody.at))])}{' '}
              {String(new Date(lastBody.at).getHours()).padStart(2, '0')}:{String(new Date(lastBody.at).getMinutes()).padStart(2, '0')}
            </p>
          )}
        </Card>

        <div className="shortcuts mt16">
          <button className="card" onClick={() => nav.push('routines')}>
            <Icon name="list" size={26} color="var(--primary)" />
            <h3 className="card-title mt8">{tr('루틴')}</h3>
            <p className="sub">{tr('자주 사용하는 운동을 루틴으로 관리하세요')}</p>
          </button>
          <button className="card" onClick={() => nav.push('picker', { mode: 'library' })}>
            <Icon name="folder" size={26} color="var(--primary)" />
            <h3 className="card-title mt8">{tr('라이브러리')}</h3>
            <p className="sub">{tr('나만의 운동 라이브러리를 만드세요')}</p>
          </button>
        </div>

        <div style={{ padding: '0 16px' }}>
          <DailyVolume />
        </div>
      </Page>
      {calOpen && <MonthSheet s={s} todayKey={todayKey} onClose={() => setCalOpen(false)} />}
    </>
  )
}

// 월간 운동 달력: 운동한 날을 표시하고 그 달의 운동한 날 수를 보여준다
function MonthSheet({ s, todayKey, onClose }: { s: ReturnType<typeof useAppState>; todayKey: string; onClose: () => void }) {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const done = workoutDays(s)
  const dim = endOfMonth(month).getDate()
  const lead = (startOfMonth(month).getDay() + 6) % 7
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <button className="iconbtn" aria-label={tr('이전 달')} onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" /></button>
        <b>{monthLabel(month)}</b>
        <button className="iconbtn" aria-label={tr('다음 달')} onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" /></button>
      </div>
      <div className="num center mt8">
        {monthDoneCount(s, month)}
        <span className="unit"> / {dim}</span>
      </div>
      <div className="cal-grid mt8">
        {WEEK_HEADERS.map((h) => <div key={h} className="hd">{h}</div>)}
        {cells.map((d, i) =>
          d ? (
            <div key={ymd(d)} className="cal-cell">
              <div className={`cal-day ${done.has(ymd(d)) ? 'done' : ''} ${ymd(d) === todayKey ? 'today' : ''}`}>{d.getDate()}</div>
            </div>
          ) : (
            <div key={'e' + i} />
          ),
        )}
      </div>
      <button className="btn line mt16" onClick={onClose}>{tr('닫기')}</button>
    </Sheet>
  )
}
