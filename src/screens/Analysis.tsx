// 분석 화면 (PRD 7.6, 7.10) : 사진 기준 기본 구역 1~10 + 부위별 볼륨 그래프 11~15
import { useMemo, useState } from 'react'
import { exName, useAppState } from '../store'
import { useNav } from '../nav'
import { Card, Page, Segmented, Sheet, TopBar, useToast } from '../components/ui'
import { Icon } from '../components/Icon'
import { BodyMap, Donut, RoundBars, StackedBars, type Seg, type StackBar } from '../components/Charts'
import {
  OTHER_COLOR, PARTS, PART_COLOR, PART_NAME, SUBS_OF, SUB_NAME,
} from '../lib/constants'
import {
  WEEK_HEADERS, addDays, addMonths, dayLabel, endOfMonth, isFuture, mdDash, mdLabel, monthLabel,
  parseYmd, startOfMonth, startOfWeek, weekLabel, ymd,
} from '../lib/dates'
import { abbr, comma, hm, mmss, pct } from '../lib/format'
import { dailyTarget, sessionSeconds, tdee, type Aggregate } from '../lib/calc'
import { agg, kcalOn, macrosOn, monthStat, recordedSessions, secondsByDay, workoutDays } from '../lib/stats'
import { darken, lighten } from '../lib/color'
import { renderShareImage, shareImage } from '../lib/share'
import type { Exercise, PartCode, SubPartCode } from '../types'

type Tab = 'day' | 'week' | 'month'
type Drill = { part: PartCode; mode: 'all' | 'sub' | 'exercise' } | null

export function Analysis() {
  const s = useAppState()
  const nav = useNav()
  const today = new Date()
  const todayKey = ymd(today)
  const [toast, show] = useToast()

  // ---- 사진 기준 기본 구역 (고정 기간) ----
  const from7 = addDays(today, -6)
  const secDays = secondsByDay(s, from7, today)
  const totalSec = Object.values(secDays).reduce((a, b) => a + b, 0)
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(from7, i))
  const a7 = agg(s, from7, today)
  const vol7: Record<string, number> = {}
  PARTS.forEach((p) => (vol7[p] = a7.byPart[p].volume))
  const [open7, setOpen7] = useState<PartCode | null>(null)

  const mNow = monthStat(s, today)
  const mPrev = monthStat(s, addMonths(today, -1))
  const avgNow = mNow.count ? mNow.seconds / mNow.count : 0
  const avgPrev = mPrev.count ? mPrev.seconds / mPrev.count : 0

  const [calTab, setCalTab] = useState<'in' | 'out'>('in')
  const intake = days7.map((d) => kcalOn(s, ymd(d)))
  const eatenDays = intake.filter((v) => v > 0)
  const avgIntake = eatenDays.length ? eatenDays.reduce((a, b) => a + b, 0) / eatenDays.length : 0
  const burn = s.profile ? Math.round(tdee(s.profile)) : 0
  const mac = macrosOn(s, from7, today)
  const macAvgK = mac.days ? mac.kcal / mac.days : 0
  const cK = mac.carb * 4
  const pK = mac.protein * 4
  const fK = mac.fat * 9
  const macTotal = cK + pK + fK

  const diff = (cur: number, prev: number, fmt: (n: number) => string, prevLabel: string) => {
    if (!prev) return <span className="muted">{prevLabel}</span>
    const d = cur - prev
    if (d === 0) return <b>변동 없음</b>
    return (
      <b style={{ color: d > 0 ? 'var(--inc)' : 'var(--dec)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <Icon name={d > 0 ? 'tri_up' : 'tri_down'} size={12} fill="currentColor" strokeWidth={0} />
        {fmt(Math.abs(d))}
      </b>
    )
  }

  return (
    <>
      <TopBar
        title="분석"
        right={
          <button className="iconbtn" aria-label="설정" onClick={() => nav.push('settings')}>
            <Icon name="settings" />
            {s.settings.notifConsent === null && <span className="badge-dot" />}
          </button>
        }
      />
      <Page>
        {/* 2 운동 현황 */}
        <Card title="운동 현황" onMore={() => nav.push('detail', { kind: 'workout' })}>
          <div className="num">{totalSec ? hm(totalSec) : '-'}</div>
          <p className="muted">최근 7일 합계</p>
          <div className="hr" />
          <div className="circle-days">
            {days7.map((d) => {
              const sec = secDays[ymd(d)]
              return (
                <div key={ymd(d)}>
                  <i className={sec ? 'on' : ''}>{sec ? mmss(sec) : '-'}</i>
                  {['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}
                </div>
              )
            })}
          </div>
        </Card>

        {/* 3 근육 피로도 */}
        <Card title="근육 피로도">
          <p className="muted" style={{ marginBottom: 10 }}>{mdLabel(from7)} ~ {mdLabel(today)}</p>
          <div className="graybox">
            <BodyMap volumes={vol7} />
          </div>
        </Card>

        {/* 4 부위별 볼륨 표 */}
        <Card className="">
          <table className="tbl">
            <thead>
              <tr><th>부위</th><th className="r">볼륨</th><th className="r">세트</th></tr>
            </thead>
            <tbody>
              {PARTS.map((p) => {
                const r = a7.byPart[p]
                const expanded = open7 === p
                return (
                  <PartRows key={p} part={p} stat={r} expanded={expanded} onToggle={() => setOpen7(expanded ? null : p)} a={a7} />
                )
              })}
            </tbody>
          </table>
          {PARTS.every((p) => a7.byPart[p].sets === 0) && <p className="muted center mt8">최근 7일 기록 없음</p>}
        </Card>

        {/* 5 월간 운동 현황 */}
        <Card title={`${today.getMonth() + 1}월 운동 현황`} onMore={() => nav.push('detail', { kind: 'month' })}>
          <div className="three">
            <div><Icon name="clock" color="var(--primary)" /><div className="num" style={{ fontSize: 20 }}>{mNow.seconds ? hm(mNow.seconds) : '-'}</div></div>
            <div><Icon name="muscle" color="var(--primary)" /><div className="num" style={{ fontSize: 20 }}>{mNow.volume ? abbr(mNow.volume) : '-'}{mNow.volume ? <small>kg</small> : null}</div></div>
            <div><Icon name="dumbbell" color="var(--primary)" /><div className="num" style={{ fontSize: 20 }}>{mNow.count || '-'}{mNow.count ? <small>회</small> : null}</div></div>
          </div>
        </Card>

        {/* 6 전월 대비 */}
        <Card title="전월 대비" onMore={() => nav.push('detail', { kind: 'month' })}>
          <div className="two">
            <div><p className="muted">평균 운동 시간</p><div className="num" style={{ fontSize: 20 }}>{avgNow ? hm(avgNow) : '-'}</div></div>
            <div><p className="muted">현재 볼륨 총합</p><div className="num" style={{ fontSize: 20 }}>{mNow.volume ? abbr(mNow.volume) : '-'}{mNow.volume ? <small>kg</small> : null}</div></div>
            <div><p className="muted">전월 대비 시간</p>{diff(avgNow, avgPrev, (n) => hm(n), '지난달 기록 없음')}</div>
            <div><p className="muted">전월 대비 볼륨</p>{diff(mNow.volume, mPrev.volume, (n) => `${abbr(n)}kg`, '지난달 기록 없음')}</div>
          </div>
        </Card>

        {/* 7 식단 구역 제목 */}
        <h2 className="section-title">식단</h2>

        {/* 8 칼로리 변화 */}
        <Card title="칼로리 변화" onMore={() => nav.push('detail', { kind: 'calories' })}>
          <Segmented value={calTab} onChange={setCalTab} options={[{ value: 'in', label: '섭취' }, { value: 'out', label: '소비' }]} />
          <p className="muted mt12">{mdLabel(from7)} ~ {mdLabel(today)}</p>
          {calTab === 'in' ? (
            <p className="sentence" style={{ fontSize: 18, fontWeight: 700 }}>
              {avgIntake ? <>하루 평균 <b>{comma(avgIntake)}</b>kcal 먹었어요</> : '아직 식단 기록이 없어요'}
            </p>
          ) : (
            <p className="sentence" style={{ fontSize: 18, fontWeight: 700 }}>
              {burn ? <>하루 평균 <b>{comma(burn)}</b>kcal 소비했어요</> : '신체 정보가 필요해요'}
            </p>
          )}
          <div className="graybox mt12">
            <RoundBars
              items={days7.map((d, i) => ({ label: mdDash(d), value: calTab === 'in' ? intake[i] : burn }))}
              todayIndex={6}
              avg={calTab === 'in' ? avgIntake || undefined : burn || undefined}
              unit="kcal"
            />
          </div>
          {calTab === 'out' && <p className="muted mt8" style={{ fontSize: 12 }}>소비 열량은 기초대사량과 활동 계수로 계산한 하루 총 소비 열량(TDEE) 추정치예요</p>}
        </Card>

        {/* 9 영양소 */}
        <Card title="영양소" onMore={() => nav.push('detail', { kind: 'nutrients' })}>
          <p className="muted">7일 평균 | {mdLabel(from7)} ~ {mdLabel(today)}</p>
          <div className="num">{macAvgK ? comma(macAvgK) : '-'}{macAvgK ? <small>kcal</small> : null}</div>
          <div className="center mt12"><Donut slices={[{ value: cK, color: '#FFC978' }, { value: pK, color: '#F27052' }, { value: fK, color: '#6FD6A0' }]} /></div>
          <div className="three mt12">
            {[
              { n: '탄수화물', c: 'var(--carb)', k: cK, g: mac.carb },
              { n: '단백질', c: 'var(--protein)', k: pK, g: mac.protein },
              { n: '지방', c: 'var(--fat)', k: fK, g: mac.fat },
            ].map((x) => (
              <div key={x.n}>
                <div style={{ fontSize: 13 }}><span className="swatch" style={{ background: x.c, borderRadius: '50%' }} />{x.n}</div>
                <b>{mac.days ? comma(x.k / mac.days) : '-'}</b><span className="unit">kcal</span>
                <div className="muted" style={{ fontSize: 12 }}>{mac.days ? `${(x.g / mac.days).toFixed(0)}g` : '-'}</div>
              </div>
            ))}
          </div>
          {macTotal === 0 && <p className="muted center mt8">기록 없음</p>}
        </Card>

        {/* 11 볼륨 그래프 */}
        <h2 className="section-title">볼륨 그래프</h2>
        <VolumeGraph showToast={show} workoutDaySet={workoutDays(s)} todayKey={todayKey} />
      </Page>
      {toast}
    </>
  )
}

function PartRows({ part, stat, expanded, onToggle, a }: { part: PartCode; stat: { volume: number; sets: number }; expanded: boolean; onToggle: () => void; a: Aggregate }) {
  const s = useAppState()
  const subs = SUBS_OF[part] ?? []
  const exs = Object.values(a.byExercise).filter((e) => e.exercise.part === part).sort((x, y) => y.volume - x.volume)
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }} aria-expanded={expanded}>
        <td><span className="swatch" style={{ background: PART_COLOR[part] }} />{PART_NAME[part]}</td>
        <td className="r">{stat.volume ? <><b>{comma(stat.volume)}</b><span className="unit">kg</span></> : '-'}</td>
        <td className="r">{stat.sets || '-'}</td>
      </tr>
      {expanded && stat.sets === 0 && <tr className="sub"><td colSpan={3} className="muted">기록 없음</td></tr>}
      {expanded && subs.map((sp) => a.bySub[sp] && (
        <tr className="sub" key={sp}>
          <td>{SUB_NAME[sp]}</td>
          <td className="r">{a.bySub[sp]!.volume ? `${comma(a.bySub[sp]!.volume)}kg` : '-'}</td>
          <td className="r">{a.bySub[sp]!.sets}</td>
        </tr>
      ))}
      {expanded && exs.map((e) => (
        <tr className="sub" key={e.exercise.id}>
          <td>{exName(s, e.exercise)}</td>
          <td className="r">{e.volume ? `${comma(e.volume)}kg` : '-'}</td>
          <td className="r">{e.sets}</td>
        </tr>
      ))}
    </>
  )
}

// ---------------- 부위별 볼륨 그래프 (11~15) ----------------

function periodOf(tab: Tab, anchor: Date) {
  if (tab === 'day') return { from: anchor, to: anchor }
  if (tab === 'week') {
    const st = startOfWeek(anchor)
    return { from: st, to: addDays(st, 6) }
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
}

function VolumeGraph({ showToast, workoutDaySet, todayKey }: { showToast: (m: string) => void; workoutDaySet: Set<string>; todayKey: string }) {
  const s = useAppState()
  const [tab, setTab] = useState<Tab>('week')
  const [anchor, setAnchor] = useState(new Date())
  const [dim, setDim] = useState<string | null>(null)
  const [drill, setDrill] = useState<Drill>(null)
  const [pick, setPick] = useState(false)

  const { from, to } = periodOf(tab, anchor)
  const buckets = useMemo(() => {
    const out: { label: string; d: Date }[] = []
    for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) {
      const label = tab === 'week' ? WEEK_HEADERS[(d.getDay() + 6) % 7] : tab === 'month' ? String(d.getDate()) : mdDash(d)
      out.push({ label, d })
    }
    return out
  }, [tab, from.getTime(), to.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const aggs = buckets.map((b) => agg(s, b.d, b.d))
  const pa = agg(s, from, to)

  // 종목별 보기에서 상위 5개 종목 (볼륨 기준)
  const top5 = useMemo(() => {
    if (!drill || drill.mode !== 'exercise') return []
    return Object.values(pa.byExercise)
      .filter((e) => e.exercise.part === drill.part && e.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((e) => e.exercise.id)
  }, [pa, drill])

  const segDefs: { key: string; label: string; color: string }[] = useMemo(() => {
    if (!drill || drill.mode === 'all') return PARTS.map((p) => ({ key: p, label: PART_NAME[p], color: PART_COLOR[p] }))
    if (drill.mode === 'sub') {
      const base = PART_COLOR[drill.part]
      const shades = [darken(base), base, lighten(base)]
      return (SUBS_OF[drill.part] ?? []).map((sp, i) => ({ key: sp, label: SUB_NAME[sp], color: shades[i % 3] }))
    }
    const defs = top5.map((id, i) => {
      const ex = pa.byExercise[id].exercise
      return { key: id, label: exName(s, ex), color: PART_COLOR[PARTS[i % 6]] }
    })
    return [...defs, { key: 'other', label: '기타', color: OTHER_COLOR }]
  }, [drill, top5, pa, s])

  const valueOf = (a: Aggregate, key: string): number => {
    if (!drill || drill.mode === 'all') return a.byPart[key as PartCode].volume
    if (drill.mode === 'sub') return a.bySub[key as SubPartCode]?.volume ?? 0
    if (key === 'other') {
      return Object.values(a.byExercise)
        .filter((e) => e.exercise.part === drill.part && !top5.includes(e.exercise.id))
        .reduce((x, e) => x + e.volume, 0)
    }
    return a.byExercise[key]?.volume ?? 0
  }
  const setsOf = (a: Aggregate, key: string): number => {
    if (!drill || drill.mode === 'all') return a.byPart[key as PartCode].sets
    if (drill.mode === 'sub') return a.bySub[key as SubPartCode]?.sets ?? 0
    if (key === 'other') {
      return Object.values(a.byExercise)
        .filter((e) => e.exercise.part === drill.part && !top5.includes(e.exercise.id))
        .reduce((x, e) => x + e.sets, 0)
    }
    return a.byExercise[key]?.sets ?? 0
  }

  const bars: StackBar[] = buckets.map((b, i) => ({
    label: b.label,
    segs: segDefs.map<Seg>((d) => ({ ...d, value: valueOf(aggs[i], d.key) })),
  }))
  const rows = segDefs
    .map((d) => ({ ...d, volume: valueOf(pa, d.key), sets: setsOf(pa, d.key) }))
    .filter((r) => r.sets > 0 || r.volume > 0)
  const total = rows.reduce((a, r) => a + r.volume, 0)

  // 기간 이동
  const shift = (dir: 1 | -1) => {
    const next = tab === 'day' ? addDays(anchor, dir) : tab === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir)
    const p = periodOf(tab, next)
    if (dir > 0 && isFuture(p.from)) return
    setAnchor(next)
  }
  const canNext = !isFuture(periodOf(tab, tab === 'day' ? addDays(anchor, 1) : tab === 'week' ? addDays(anchor, 7) : addMonths(anchor, 1)).from)
  const periodText = tab === 'day' ? dayLabel(anchor) : tab === 'week' ? weekLabel(from) : monthLabel(anchor)

  const hasBody = pa.bodyReps > 0
  const hasTime = pa.timeSec > 0
  const hasCardio = pa.cardioKm > 0 || pa.cardioMin > 0

  const extra = (pick: (a: Aggregate) => number) => buckets.map((b, i) => ({ label: b.label, value: pick(aggs[i]) }))

  const share = async () => {
    const blob = await renderShareImage({
      title: `부위별 볼륨${drill ? ` · ${PART_NAME[drill.part]}` : ''}`,
      period: periodText,
      total: `${comma(total)}kg`,
      rows: rows.map((r) => ({ label: r.label, color: r.color, volume: `${comma(r.volume)}kg`, sets: `${r.sets}세트`, percent: pct(r.volume, total) })),
    })
    if (!blob) return showToast('이미지를 만들지 못했어요')
    const r = await shareImage(blob, `kilo-volume-${ymd(from)}.png`)
    showToast(r === 'saved' ? '이미지를 저장했어요' : '공유했어요')
  }

  return (
    <>
      {/* 12 기간 선택 */}
      <div style={{ padding: '8px 16px' }}>
        <Segmented value={tab} onChange={(v) => { setTab(v); setDrill(null); setDim(null) }} options={[{ value: 'day', label: '일' }, { value: 'week', label: '주' }, { value: 'month', label: '월' }]} />
        <div className="row between mt12">
          <button className="iconbtn" aria-label="이전 기간" onClick={() => shift(-1)}><Icon name="left" /></button>
          {tab === 'month' ? (
            <b>{monthLabel(anchor)}</b>
          ) : (
            <button className="row gap8" style={{ fontWeight: 700 }} onClick={() => setPick(true)} aria-label="날짜 선택">
              <Icon name="calendar" size={18} color="var(--primary)" />
              {periodText}
            </button>
          )}
          <button className="iconbtn" aria-label="다음 기간" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.3 }} onClick={() => shift(1)}><Icon name="right" /></button>
        </div>
      </div>

      {/* 13 누적 막대 */}
      <Card>
        {drill && (
          <div className="row between" style={{ marginBottom: 10 }}>
            <b>{PART_NAME[drill.part]}</b>
            <div className="row gap8">
              {SUBS_OF[drill.part] && (
                <button className={`chip ${drill.mode === 'sub' ? 'on' : ''}`} onClick={() => { setDrill({ part: drill.part, mode: 'sub' }); setDim(null) }}>하위 부위</button>
              )}
              <button className={`chip ${drill.mode === 'exercise' ? 'on' : ''}`} onClick={() => { setDrill({ part: drill.part, mode: 'exercise' }); setDim(null) }}>종목별</button>
              <button className="chip" onClick={() => { setDrill(null); setDim(null) }}>전체</button>
            </div>
          </div>
        )}
        {rows.length > 0 ? (
          <>
            <div className="legend">
              {rows.map((r) => (
                <button key={r.key} onClick={() => setDim(dim === r.key ? null : r.key)} aria-pressed={dim === r.key} style={{ opacity: dim && dim !== r.key ? 0.4 : 1 }}>
                  <span className="swatch" style={{ background: r.color, marginRight: 6 }} />
                  {r.label}
                </button>
              ))}
            </div>
            <StackedBars bars={bars} dim={dim} />
          </>
        ) : (
          <p className="empty">
            {tab === 'day' ? '이 날은 기록이 없어요' : tab === 'week' ? '이 주는 기록이 없어요' : '이 달은 기록이 없어요'}
          </p>
        )}
      </Card>

      {/* 14 숫자 표 */}
      <Card>
        <table className="tbl">
          <thead>
            <tr><th>{drill ? '구분' : '부위'}</th><th className="r">볼륨</th><th className="r">세트</th><th className="r">비율</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                style={{ cursor: !drill ? 'pointer' : 'default', opacity: dim && dim !== r.key ? 0.4 : 1 }}
                onClick={() => { if (!drill) setDrill({ part: r.key as PartCode, mode: SUBS_OF[r.key as PartCode] ? 'sub' : 'exercise' }) }}
              >
                <td><span className="swatch" style={{ background: r.color }} />{r.label}</td>
                <td className="r">{r.volume ? `${comma(r.volume)}kg` : '-'}</td>
                <td className="r">{r.sets}</td>
                <td className="r">{r.volume ? `${pct(r.volume, total)}%` : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted center">기록 없음</td></tr>}
            {rows.length > 0 && (
              <tr><td><b>합계</b></td><td className="r"><b>{comma(total)}kg</b></td><td className="r"><b>{rows.reduce((a, r) => a + r.sets, 0)}</b></td><td className="r">100%</td></tr>
            )}
          </tbody>
        </table>
        {!drill && rows.length > 0 && <p className="muted mt8" style={{ fontSize: 12 }}>부위를 누르면 하위 부위와 종목별로 나눠 볼 수 있어요</p>}
      </Card>

      {/* 단위가 다른 기록은 따로 */}
      {hasBody && (
        <Card title="맨몸 운동">
          <div className="num">{comma(pa.bodyReps)}<small>회</small></div>
          <RoundBars items={extra((a) => a.bodyReps)} unit="회" />
        </Card>
      )}
      {hasTime && (
        <Card title="시간 운동">
          <div className="num">{comma(pa.timeSec)}<small>초</small></div>
          <RoundBars items={extra((a) => a.timeSec)} unit="초" />
        </Card>
      )}
      {hasCardio && (
        <Card title="유산소">
          <div className="num">{pa.cardioKm.toFixed(1)}<small>km</small> <span className="num" style={{ fontSize: 20 }}>{comma(pa.cardioMin)}<small>분</small></span></div>
          <RoundBars items={extra((a) => a.cardioMin)} color="#e5534b" unit="분" />
        </Card>
      )}

      {/* 15 공유 */}
      <div style={{ padding: '4px 16px 0' }}>
        <button className="btn line" onClick={share}><span className="row gap8" style={{ justifyContent: 'center' }}><Icon name="share" size={18} />이미지로 저장 · 공유</span></button>
      </div>

      {pick && (
        <DateSheet
          initialMode={tab === 'week' ? 'week' : 'day'}
          anchor={anchor}
          workoutDaySet={workoutDaySet}
          todayKey={todayKey}
          onClose={() => setPick(false)}
          onDone={(mode, d) => {
            setTab(mode)
            setAnchor(d)
            setDrill(null)
            setPick(false)
          }}
        />
      )}
    </>
  )
}

// 7.10 날짜 선택 시트
function DateSheet({ initialMode, anchor, workoutDaySet, todayKey, onClose, onDone }: { initialMode: 'day' | 'week'; anchor: Date; workoutDaySet: Set<string>; todayKey: string; onClose: () => void; onDone: (m: 'day' | 'week', d: Date) => void }) {
  const [mode, setMode] = useState<'day' | 'week'>(initialMode)
  const [sel, setSel] = useState(anchor)
  const [month, setMonth] = useState(startOfMonth(anchor))
  const today = new Date()

  const first = startOfMonth(month)
  const lead = (first.getDay() + 6) % 7
  const dim = endOfMonth(month).getDate()
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  const weekStart = startOfWeek(sel)
  const inWeek = (d: Date) => mode === 'week' && d.getTime() >= weekStart.getTime() && d.getTime() <= addDays(weekStart, 6).getTime()

  return (
    <Sheet onClose={onClose}>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'day', label: '하루 선택' }, { value: 'week', label: '한 주 선택' }]} />
      <div className="row between mt16">
        <button className="iconbtn" aria-label="이전 달" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" /></button>
        <b>{monthLabel(month)}</b>
        <button className="iconbtn" aria-label="다음 달" onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" /></button>
      </div>
      <div className="cal-grid mt8">
        {WEEK_HEADERS.map((h) => <div key={h} className="hd">{h}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={'e' + i} />
          const future = isFuture(d, today)
          const k = ymd(d)
          const col = (d.getDay() + 6) % 7
          const selected = mode === 'day' && ymd(sel) === k
          return (
            <div key={k} className={`cal-cell ${inWeek(d) ? 'weeksel' : ''} ${inWeek(d) && col === 0 ? 'first' : ''} ${inWeek(d) && col === 6 ? 'last' : ''}`}>
              <button disabled={future} className={selected ? 'sel' : ''} onClick={() => setSel(d)} aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일`}>
                {d.getDate()}
              </button>
              {workoutDaySet.has(k) && <span className="d" />}
            </div>
          )
        })}
      </div>
      <div className="row gap8 mt16">
        <button className="btn ghost" onClick={() => { setSel(today); setMonth(startOfMonth(today)) }}>오늘로 이동</button>
        <button className="btn" onClick={() => onDone(mode, sel)}>선택 완료</button>
      </div>
      <p className="muted center mt8" style={{ fontSize: 12 }} aria-hidden={todayKey === ''}>
        {mode === 'day' ? dayLabel(sel) : weekLabel(weekStart)}
      </p>
    </Sheet>
  )
}

// ---------------- 카드별 상세 ----------------

export function AnalysisDetail({ kind }: { kind: string }) {
  const s = useAppState()
  const today = new Date()
  const titles: Record<string, string> = { workout: '운동 현황', month: '월간 운동 현황', calories: '칼로리 변화', nutrients: '영양소' }

  const body = (() => {
    if (kind === 'workout') {
      const list = recordedSessions(s).filter((x) => x.date >= ymd(addDays(today, -29))).sort((a, b) => b.startedAt - a.startedAt)
      if (!list.length) return <p className="empty">최근 30일 기록 없음</p>
      return (
        <div className="list-group">
          {list.map((x) => (
            <div className="list-item" key={x.id}>
              <div className="grow"><b>{parseYmd(x.date).getMonth() + 1}월 {parseYmd(x.date).getDate()}일</b><div className="muted" style={{ fontSize: 13 }}>{x.items.length}종목</div></div>
              <b>{mmss(sessionSeconds(x))}</b>
            </div>
          ))}
        </div>
      )
    }
    if (kind === 'month') {
      const rows = Array.from({ length: 6 }, (_, i) => {
        const d = addMonths(today, -i)
        return { d, m: monthStat(s, d) }
      })
      return (
        <Card>
          <table className="tbl">
            <thead><tr><th>월</th><th className="r">시간</th><th className="r">볼륨(kg)</th><th className="r">횟수</th></tr></thead>
            <tbody>
              {rows.map(({ d, m }) => (
                <tr key={d.getTime()}>
                  <td>{d.getMonth() + 1}월</td>
                  <td className="r">{m.seconds ? hm(m.seconds) : '-'}</td>
                  <td className="r">{m.volume ? comma(m.volume) : '-'}</td>
                  <td className="r">{m.count || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )
    }
    const days = Array.from({ length: kind === 'calories' ? 14 : 7 }, (_, i) => addDays(today, i - (kind === 'calories' ? 13 : 6)))
    const target = s.profile ? dailyTarget(s.profile) : 0
    if (kind === 'calories') {
      return (
        <>
          <Card>
            <RoundBars items={days.map((d) => ({ label: mdDash(d), value: kcalOn(s, ymd(d)) }))} todayIndex={days.length - 1} avg={target || undefined} />
            <p className="muted" style={{ fontSize: 12 }}>점선은 목표 열량({comma(target)}kcal)이에요</p>
          </Card>
        </>
      )
    }
    return (
      <Card>
        <table className="tbl">
          <thead><tr><th>날짜</th><th className="r">탄수</th><th className="r">단백</th><th className="r">지방</th><th className="r">kcal</th></tr></thead>
          <tbody>
            {days.map((d) => {
              const m = macrosOn(s, d, d)
              return (
                <tr key={ymd(d)}>
                  <td>{mdDash(d)}</td>
                  <td className="r">{m.days ? `${Math.round(m.carb)}g` : '-'}</td>
                  <td className="r">{m.days ? `${Math.round(m.protein)}g` : '-'}</td>
                  <td className="r">{m.days ? `${Math.round(m.fat)}g` : '-'}</td>
                  <td className="r">{m.days ? comma(m.kcal) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    )
  })()

  return (
    <>
      <TopBar title={titles[kind] ?? '상세'} back />
      <Page>{body}</Page>
    </>
  )
}

export type { Exercise }
