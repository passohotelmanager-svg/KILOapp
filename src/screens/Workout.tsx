// 운동 기록 화면: 세트 입력, 추가/삭제, 휴식 시작 (F-02, F-24, F-25, F-26, F-31)
import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { actions, activeSession, exName, findExercise, useAppState } from '../store'
import { useNav } from '../nav'
import { Page, Sheet, TopBar, useToast } from '../components/ui'
import { Icon } from '../components/Icon'
import { openRestScreen } from '../components/RestEngine'
import { unlockAudio, requestNotifPermission } from '../lib/alarm'
import { PART_NAME } from '../lib/constants'
import { comma, mmss } from '../lib/format'
import { ASSIST_PRESETS, buildAssist, previousSets, sessionSeconds, setVolume } from '../lib/calc'
import type { AssistPreset } from '../lib/calc'
import type { Exercise, SetRec } from '../types'

function NumInput({ value, onChange, label, step = 1, decimal }: { value: number; onChange: (n: number) => void; label: string; step?: number; decimal?: boolean }) {
  return (
    <input
      type="number"
      inputMode={decimal ? 'decimal' : 'numeric'}
      min={0}
      step={step}
      value={value === 0 ? '' : value}
      placeholder="0"
      aria-label={label}
      onChange={(e) => {
        const n = parseFloat(e.target.value)
        onChange(Number.isFinite(n) && n >= 0 ? n : 0)
      }}
    />
  )
}

export function Workout() {
  const s = useAppState()
  const nav = useNav()
  const ss = activeSession(s)
  const [undo, setUndo] = useState<{ ex: string; set: SetRec; index: number } | null>(null)
  const undoTimer = useRef<number>()
  const [toast, show] = useToast()
  const [askConsent, setAskConsent] = useState<{ sec: number; label: string } | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [assistFor, setAssistFor] = useState<Exercise | null>(null)

  if (!ss) {
    return (
      <>
        <TopBar title={tr('운동 기록')} back />
        <Page>
          <div className="empty">{tr('진행 중인 운동이 없어요')}</div>
        </Page>
      </>
    )
  }

  const total = ss.items.reduce((a, it) => {
    const ex = findExercise(s, it.exerciseId)
    return a + (ex ? it.sets.reduce((b, x) => b + setVolume(ex, x), 0) : 0)
  }, 0)

  const startRest = (ex: Exercise, set: SetRec, n: number) => {
    const go = () => {
      unlockAudio()
      actions.startRest(set.rest, tr('{0} {1}세트 후 휴식', [exName(s, ex), n]))
      openRestScreen()
    }
    if (s.settings.notifConsent === null) {
      setAskConsent({ sec: set.rest, label: tr('{0} {1}세트 후 휴식', [exName(s, ex), n]) })
      return
    }
    go()
  }

  const remove = (ex: Exercise, set: SetRec, index: number) => {
    actions.removeSet(ss.id, ex.id, set.id)
    window.clearTimeout(undoTimer.current)
    setUndo({ ex: ex.id, set, index })
    undoTimer.current = window.setTimeout(() => setUndo(null), 3000)
  }

  const consent = async (agree: boolean) => {
    const ok = agree ? await requestNotifPermission() : false
    actions.updateSettings({ notifConsent: ok })
    const c = askConsent
    setAskConsent(null)
    if (c) {
      unlockAudio()
      actions.startRest(c.sec, c.label)
      openRestScreen()
    }
  }

  return (
    <>
      <TopBar
        title={tr('운동 기록')}
        back
        right={
          <button className="btn sm" style={{ padding: '8px 14px' }} onClick={() => setFinishing(true)}>
            
            {tr('종료')}
          </button>
        }
      />
      <Page fixed>
        <div className="card">
          <div className="row between">
            <div>
              <p className="muted">{tr('총 볼륨')}</p>
              <div className="num">{comma(total)}<small>kg</small></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="muted">{tr('운동 시간')}</p>
              <div className="num"><Elapsed start={ss.startedAt} /></div>
            </div>
          </div>
        </div>

        {ss.items.length === 0 && <div className="empty">{tr('종목을 추가해서 운동을 시작해보세요')}</div>}

        {ss.items.map((it) => {
          const ex = findExercise(s, it.exerciseId)
          if (!ex) return null
          const prev = previousSets(s.sessions, ex.id, ss.id)
          const sum = it.sets.reduce((a, x) => a + setVolume(ex, x), 0)
          return (
            <div className="ex-card" key={it.exerciseId}>
              <div className="row between">
                <div>
                  <b style={{ fontSize: 16 }}>{exName(s, ex)}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{PART_NAME[ex.part]}</div>
                </div>
                <button className="iconbtn" aria-label={tr('{0} 삭제', [exName(s, ex)])} onClick={() => actions.removeExerciseFromSession(ss.id, ex.id)}>
                  <Icon name="trash" size={20} color="var(--text2)" />
                </button>
              </div>
              {ex.part !== 'cardio' && (
                <label className="row gap8 mt8" style={{ fontSize: 13 }}>
                  <span className="muted">{tr('휴식 시간')}</span>
                  <select
                    value={it.sets[0]?.rest ?? s.settings.restDefault}
                    onChange={(e) => it.sets.forEach((x) => actions.updateSet(ss.id, ex.id, x.id, { rest: Number(e.target.value) }))}
                    aria-label={tr('{0} 휴식 시간', [exName(s, ex)])}
                  >
                    {[10, 20, 30, 45, 60, 90, 120, 180].map((v) => (
                      <option key={v} value={v}>{tr('{0}초', [v])}</option>
                    ))}
                  </select>
                </label>
              )}
              {prev && (
                <p className="prev">
                  {tr('지난번:')} {prev.map((p) => (ex.type === 'weight' ? `${p.weight}kg x ${p.reps}` : ex.type === 'bodyweight' ? tr('{0}회', [p.reps]) : ex.type === 'time' ? tr('{0}초', [p.seconds]) : ex.type === 'cardio_distance' ? tr('{0}km {1}분', [p.distanceKm, p.minutes]) : tr('{0}분', [p.minutes]))).join(' / ')}
                </p>
              )}
              <SetHeader type={ex.type} />
              {it.sets.map((set, idx) => {
                // 워밍업(W)은 번호를 매기지 않는다
                const n = it.sets.slice(0, idx + 1).filter((x) => !x.warmup).length
                return (
                  <SetRow
                    key={set.id}
                    ex={ex}
                    set={set}
                    n={n}
                    onChange={(p) => actions.updateSet(ss.id, ex.id, set.id, p)}
                    onRest={() => startRest(ex, set, n)}
                    onRemove={() => remove(ex, set, idx)}
                  />
                )
              })}
              <div className="row between mt8">
                <div className="row gap8">
                  <button className="btn ghost sm" onClick={() => actions.addSet(ss.id, ex.id)}>
                    {ex.part === 'cardio' ? tr('회차 추가') : tr('세트 추가')}
                  </button>
                  {ex.type === 'weight' && (
                    <button className="btn ghost sm" onClick={() => setAssistFor(ex)}>{tr('세트 어시스턴트')}</button>
                  )}
                </div>
                {ex.type === 'weight' && <b>{tr('합계 {0}kg', [comma(sum)])}</b>}
              </div>
            </div>
          )
        })}

        <div style={{ padding: '4px 16px' }}>
          <button className="btn line" onClick={() => nav.push('picker', { mode: 'session' })}>
            
            {tr('종목 추가')}
          </button>
        </div>

        <div className="card">
          <p className="field-label" style={{ marginTop: 0 }}>{tr('운동 메모')}</p>
          <textarea className="input" rows={2} value={ss.memo} onChange={(e) => actions.setMemo(ss.id, e.target.value)} placeholder={tr('오늘 운동은 어땠나요?')} aria-label={tr('운동 메모')} />
        </div>
      </Page>

      {undo && (
        <div className="undo" role="status">
          <span>{tr('세트를 삭제했어요')}</span>
          <button
            onClick={() => {
              actions.restoreSet(ss.id, undo.ex, undo.set, undo.index)
              window.clearTimeout(undoTimer.current)
              setUndo(null)
            }}
          >
            
            {tr('실행 취소')}
          </button>
        </div>
      )}

      {assistFor && (
        <AssistSheet
          ex={assistFor}
          title={`${PART_NAME[assistFor.part]} | ${exName(s, assistFor)}`}
          initial={ss.items.find((i) => i.exerciseId === assistFor.id)?.sets.filter((x) => !x.warmup).slice(-1)[0]}
          onClose={() => setAssistFor(null)}
          onApply={(list) => {
            actions.applyAssist(ss.id, assistFor.id, list)
            setAssistFor(null)
          }}
        />
      )}

      {askConsent && (
        <Sheet mid onClose={() => consent(false)}>
          <h3 className="card-title">{tr('알림 권한 안내')}</h3>
          <p className="sub">{tr('휴식이 끝나면 화면이 꺼져 있어도 알려드리기 위해 알림 권한을 사용해요. 허용하지 않아도 앱 화면 안에서 소리와 진동으로 알려드려요.')}</p>
          <button className="btn mt16" onClick={() => consent(true)}>{tr('허용할게요')}</button>
          <button className="btn ghost mt8" onClick={() => consent(false)}>{tr('허용하지 않을래요')}</button>
        </Sheet>
      )}

      {finishing && (
        <Sheet mid onClose={() => setFinishing(false)}>
          <h3 className="card-title">{tr('운동을 마칠까요?')}</h3>
          <p className="sub">{tr('총 볼륨 {0}kg', [comma(total)])} · {mmss(sessionSeconds(ss))}</p>
          <button
            className="btn mt16"
            onClick={() => {
              actions.finishSession()
              setFinishing(false)
              nav.pop()
            }}
          >
            
            {tr('운동 종료')}
          </button>
          <button
            className="btn danger mt8"
            onClick={() => {
              actions.discardSession()
              setFinishing(false)
              nav.pop()
            }}
          >
            
            {tr('기록 버리기')}
          </button>
          <button className="btn ghost mt8" onClick={() => setFinishing(false)}>{tr('계속 운동하기')}</button>
        </Sheet>
      )}
      {toast}
    </>
  )
}

// 세트 어시스턴트: 프리셋 선택 → 미리보기 → 적용 후에도 세트는 직접 수정 가능
function AssistSheet({ title, initial, onClose, onApply }: { ex: Exercise; title: string; initial?: SetRec; onClose: () => void; onApply: (list: ReturnType<typeof buildAssist>) => void }) {
  const [preset, setPreset] = useState<AssistPreset>('basic')
  const [main, setMain] = useState(initial?.weight || 20)
  const [sets, setSets] = useState(4)
  const [reps, setReps] = useState(initial?.reps || 10)
  const [warmup, setWarmup] = useState(false)
  const list = buildAssist(preset, main, sets, reps, warmup)
  const desc = ASSIST_PRESETS.find((p) => p.id === preset)!.desc
  let n = 0
  return (
    <Sheet onClose={onClose}>
      <div className="row between">
        <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>
        <button className="iconbtn" aria-label={tr('닫기')} onClick={onClose}><Icon name="close" size={20} /></button>
      </div>
      <div className="chips" style={{ padding: '12px 0 8px' }}>
        {ASSIST_PRESETS.map((p) => (
          <button key={p.id} className={`chip ${p.id === preset ? 'on' : ''}`} onClick={() => setPreset(p.id)}>{p.label}</button>
        ))}
      </div>
      <p className="sub">{desc}</p>
      <p className="field-label center">{tr('메인 무게')}</p>
      <div className="row gap8" style={{ justifyContent: 'center' }}>
        <button className="iconbtn" aria-label={tr('무게 줄이기')} onClick={() => setMain(Math.max(0, main - 2.5))}><Icon name="minus" size={16} /></button>
        <b style={{ fontSize: 22, minWidth: 90, textAlign: 'center' }}>{main} kg</b>
        <button className="iconbtn" aria-label={tr('무게 늘리기')} onClick={() => setMain(main + 2.5)}><Icon name="plus" size={16} /></button>
      </div>
      <div className="row between mt16" style={{ fontSize: 14 }}>
        <label className="row gap8">{tr('세트')}
          <select value={sets} disabled={preset === 'five'} onChange={(e) => setSets(Number(e.target.value))} aria-label={tr('세트 수')}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="row gap8">{tr('횟수')}
          <select value={reps} disabled={preset === 'five'} onChange={(e) => setReps(Number(e.target.value))} aria-label={tr('횟수')}>
            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="row gap8">{tr('워밍업')}
          <button className={`toggle ${warmup ? 'on' : ''}`} role="switch" aria-checked={warmup} aria-label={tr('워밍업 세트 포함')} onClick={() => setWarmup(!warmup)} />
        </label>
      </div>
      <div className="assist-list mt16">
        {list.map((a, i) => (
          <div className="row between" key={i}>
            <span className={a.warmup ? 'w' : 'muted'} style={{ fontWeight: 800, width: 24 }}>{a.warmup ? 'W' : ++n}</span>
            <span>{a.weight} kg</span>
            <span>{tr('{0}회', [a.reps])}</span>
          </div>
        ))}
      </div>
      <p className="muted center mt8" style={{ fontSize: 13 }}>{tr('적용한 후에도 세트 정보를 변경할 수 있어요. 기존 세트는 교체돼요.')}</p>
      <button className="btn mt16" onClick={() => onApply(list)}>{tr('적용하기')}</button>
    </Sheet>
  )
}

function Elapsed({ start }: { start: number }) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <>{mmss((Date.now() - start) / 1000)}</>
}

function SetHeader({ type }: { type: Exercise['type'] }) {
  const cols =
    type === 'weight' ? [tr('무게(kg)'), tr('횟수(회)'), tr('볼륨')]
      : type === 'bodyweight' ? [tr('추가무게(kg)'), tr('횟수(회)'), '']
        : type === 'time' ? [tr('시간(초)'), '', '']
          : type === 'cardio_distance' ? [tr('거리(km)'), tr('시간(분)'), '']
            : [tr('시간(분)'), '', '']
  return (
    <div className="set-head">
      <span>{tr('세트')}</span>
      <span>{cols[0]}</span>
      <span>{cols[1]}</span>
      <span>{cols[2]}</span>
      <span />
      <span />
    </div>
  )
}

function SetRow({ ex, set, n, onChange, onRest, onRemove }: { ex: Exercise; set: SetRec; n: number; onChange: (p: Partial<SetRec>) => void; onRest: () => void; onRemove: () => void }) {
  const startX = useRef<number | null>(null)
  const [dx, setDx] = useState(0)
  const t = ex.type
  return (
    <div
      className="set-row"
      style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? 'transform .15s' : 'none' }}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchMove={(e) => {
        if (startX.current !== null) setDx(Math.min(0, e.touches[0].clientX - startX.current))
      }}
      onTouchEnd={() => {
        // 밀어서 삭제
        if (dx < -90) onRemove()
        setDx(0)
        startX.current = null
      }}
    >
      {t === 'weight' ? (
        <button className={`n ${set.warmup ? 'w' : ''}`} aria-label={set.warmup ? tr('워밍업 해제') : tr('워밍업으로 표시')} onClick={() => onChange({ warmup: !set.warmup || undefined })}>
          {set.warmup ? 'W' : n}
        </button>
      ) : (
        <span className="n">{n}</span>
      )}
      {t === 'weight' && (
        <>
          <NumInput value={set.weight} onChange={(v) => onChange({ weight: v })} label={tr('{0}세트 무게', [n])} step={0.5} decimal />
          <NumInput value={set.reps} onChange={(v) => onChange({ reps: v })} label={tr('{0}세트 횟수', [n])} />
          <span className="vol">{comma(setVolume(ex, set))}</span>
        </>
      )}
      {t === 'bodyweight' && (
        <>
          <NumInput value={set.weight} onChange={(v) => onChange({ weight: v })} label={tr('{0}세트 추가 무게', [n])} step={0.5} decimal />
          <NumInput value={set.reps} onChange={(v) => onChange({ reps: v })} label={tr('{0}세트 횟수', [n])} />
          <span />
        </>
      )}
      {t === 'time' && (
        <>
          <NumInput value={set.seconds} onChange={(v) => onChange({ seconds: v })} label={tr('{0}세트 시간(초)', [n])} />
          <span />
          <span />
        </>
      )}
      {t === 'cardio_distance' && (
        <>
          <NumInput value={set.distanceKm} onChange={(v) => onChange({ distanceKm: v })} label={tr('{0}회차 거리', [n])} step={0.1} decimal />
          <NumInput value={set.minutes} onChange={(v) => onChange({ minutes: v })} label={tr('{0}회차 시간', [n])} />
          <span />
        </>
      )}
      {t === 'cardio_time' && (
        <>
          <NumInput value={set.minutes} onChange={(v) => onChange({ minutes: v })} label={tr('{0}회차 시간', [n])} />
          <span />
          <span />
        </>
      )}
      {ex.part === 'cardio' ? (
        <span />
      ) : (
        <button className="rest-btn" onClick={onRest} aria-label={tr('{0}세트 휴식 시작', [n])}>{tr('휴식')}</button>
      )}
      <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label={tr(ex.part === 'cardio' ? '{0}회차 삭제' : '{0}세트 삭제', [n])} onClick={onRemove}>
        <Icon name="close" size={16} color="var(--text2)" />
      </button>
    </div>
  )
}
