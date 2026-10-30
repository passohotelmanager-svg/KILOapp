// 투데이 화면 (PRD 7.5)
import { useState } from 'react'
import { actions, activeSession, exName, findExercise, useAppState } from '../store'
import { useNav } from '../nav'
import { Card, Page, TopBar } from '../components/ui'
import { Icon } from '../components/Icon'
import { MEALS, PART_NAME } from '../lib/constants'
import { addDays, dayName, startOfWeek, ymd } from '../lib/dates'
import { vol, comma, hm } from '../lib/format'
import { dailyTarget } from '../lib/calc'
import { agg, kcalOn, macrosOn, nutritionOn, recordedSessions, weekDoneCount, workoutDays } from '../lib/stats'
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
  const goal = s.profile?.weeklyGoal ?? 3
  const doneCount = weekDoneCount(s)

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
      <TopBar title="투데이" />
      <Page>
        <div className="weekstrip" role="group" aria-label="이번 주">
          <div className="days">
            {days.map((d) => {
              const k = ymd(d)
              return (
                <button key={k} className={`${k === todayKey ? 'today' : ''} ${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)} aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일`}>
                  {dayName(d)}
                  <b>{d.getDate()}</b>
                  {done.has(k) && <div className="dot" />}
                </button>
              )
            })}
          </div>
        </div>

        {sel !== todayKey && (
          <Card title={`${sel.slice(5).replace('-', '월 ')}일 기록`}>
            {selSessions.length === 0 ? (
              <p className="muted">기록이 없어요</p>
            ) : (
              selSessions.flatMap((ss) =>
                ss.items.map((it) => {
                  const ex = findExercise(s, it.exerciseId)
                  if (!ex) return null
                  const n = it.sets.filter((x) => setFilled(ex, x)).length
                  return (
                    <div key={ss.id + it.exerciseId} className="row between" style={{ padding: '6px 0' }}>
                      <span>{exName(s, ex)}</span>
                      <span className="muted">{PART_NAME[ex.part]} {n}세트</span>
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
              <h3 className="card-title">{running ? '운동이 진행 중이에요' : '운동을 시작해 볼까요?'}</h3>
            </div>
          </div>
          <button className="btn mt16" onClick={start}>{running ? '운동 이어하기' : '운동 시작하기'}</button>
          <button className="btn line mt8" onClick={() => nav.push('aiRecommend')}>AI 추천 오늘의 운동으로 시작하기</button>
        </Card>

        <Card title="식단" onMore={() => nav.push('nutrition')}>
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
                <button key={m.code} className="meal-box" onClick={() => nav.push('mealEdit', { meal: m.code, date: todayKey })} aria-label={`${m.name} 식사 추가`}>
                  <b>{m.name}</b>
                  <div className="muted">{k ? `${comma(k)}kcal` : '-'}</div>
                  <div className="plus"><Icon name="plus" size={16} /></div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card title="운동 목표">
          <div className="num">
            {doneCount}
            <span className="unit"> / {goal}</span>
          </div>
          <div className="goal-line">
            {Array.from({ length: goal }, (_, i) => (
              <div key={i} className="row" style={{ flex: i === goal - 1 ? 'none' : 1 }}>
                <div className={`goal-dot ${i < doneCount ? 'on' : ''}`}><Icon name="dumbbell" size={20} /></div>
                {i < goal - 1 && <div className={`goal-link ${i < doneCount - 1 ? 'on' : ''}`} />}
              </div>
            ))}
          </div>
        </Card>

        <div className="carousel">
          <Card title="시간 분석">
            <p className="muted">지난주 평균 운동 시간</p>
            <div className="num mt8">{lastAvgSec ? hm(lastAvgSec) : '-'}</div>
            {!lastAvgSec && <p className="muted">지난주 기록 없음</p>}
          </Card>
          <Card title="볼륨 분석">
            <p className="muted">지난주 총 볼륨</p>
            <div className="num mt8">{lastAgg.total ? vol(lastAgg.total) : '-'}{lastAgg.total ? <small>kg</small> : null}</div>
            {!lastAgg.total && <p className="muted">지난주 기록 없음</p>}
          </Card>
          <Card title="칼로리">
            <p className="muted">지난주 평균 섭취</p>
            <div className="num mt8">{lastAvgKcal ? comma(lastAvgKcal) : '-'}{lastAvgKcal ? <small>kcal</small> : null}</div>
            {!lastAvgKcal && <p className="muted">지난주 기록 없음</p>}
          </Card>
        </div>

        <Card title="체중" onMore={() => nav.push('bodyInfo')}>
          <div className="num">{lastBody?.weightKg ?? '-'}{lastBody?.weightKg ? <small>kg</small> : null}</div>
          {lastBody && (
            <p className="muted">
              최근 업데이트: {new Date(lastBody.at).getMonth() + 1}월 {new Date(lastBody.at).getDate()}일{' '}
              {String(new Date(lastBody.at).getHours()).padStart(2, '0')}:{String(new Date(lastBody.at).getMinutes()).padStart(2, '0')}
            </p>
          )}
        </Card>

        <div className="shortcuts mt16">
          <button className="card" onClick={() => nav.push('routines')}>
            <Icon name="list" size={26} color="var(--primary)" />
            <h3 className="card-title mt8">루틴</h3>
            <p className="sub">자주 사용하는 운동을 루틴으로 관리하세요</p>
          </button>
          <button className="card" onClick={() => nav.push('picker', { mode: 'library' })}>
            <Icon name="folder" size={26} color="var(--primary)" />
            <h3 className="card-title mt8">라이브러리</h3>
            <p className="sub">나만의 운동 라이브러리를 만드세요</p>
          </button>
        </div>
      </Page>
    </>
  )
}
