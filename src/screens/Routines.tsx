// 루틴 목록과 편집 (F-01)
import { useState } from 'react'
import { actions, exName, findExercise, useAppState } from '../store'
import { useNav } from '../nav'
import { Page, TopBar, useToast } from '../components/ui'
import { Icon } from '../components/Icon'
import { uid } from '../lib/format'
import type { Routine } from '../types'

export function Routines() {
  const s = useAppState()
  const nav = useNav()
  return (
    <>
      <TopBar title="운동 루틴" back right={<button className="iconbtn" aria-label="루틴 만들기" onClick={() => nav.push('routineEdit')}><Icon name="plus" /></button>} />
      <Page>
        {s.routines.length === 0 && <div className="empty">아직 루틴이 없어요<br />자주 하는 운동을 루틴으로 만들어보세요</div>}
        <div className="list-group">
          {s.routines.map((r) => (
            <div key={r.id} className="list-item">
              <button className="grow" style={{ textAlign: 'left' }} onClick={() => nav.push('routineEdit', { id: r.id })}>
                <b>{r.name}</b>
                <div className="muted" style={{ fontSize: 13 }}>
                  {r.items.map((i) => { const e = findExercise(s, i.exerciseId); return e ? exName(s, e) : '' }).filter(Boolean).slice(0, 3).join(', ')}
                  {r.items.length > 3 ? ` 외 ${r.items.length - 3}개` : ''}
                </div>
              </button>
              <button
                className="btn sm"
                onClick={() => {
                  actions.startSession(r)
                  nav.openWorkout()
                }}
              >
                시작
              </button>
            </div>
          ))}
        </div>
      </Page>
    </>
  )
}

// 종목 선택 화면을 다녀와도 편집 내용이 유지되도록 모듈 변수에 보관한다
let draft: { key: string; routine: Routine } | null = null

export function RoutineEdit({ id }: { id?: string }) {
  const s = useAppState()
  const nav = useNav()
  const key = id ?? 'new'
  if (!draft || draft.key !== key) {
    const found = s.routines.find((r) => r.id === id)
    draft = { key, routine: found ? structuredClone(found) : { id: uid(), name: '', items: [] } }
  }
  const [, force] = useState(0)
  const [toast, show] = useToast()
  const r = draft.routine
  const update = (p: Partial<Routine>) => {
    draft!.routine = { ...draft!.routine, ...p }
    force((n) => n + 1)
  }

  const save = () => {
    if (!r.name.trim()) return show('루틴 이름을 입력해주세요')
    if (r.items.length === 0) return show('종목을 1개 이상 추가해주세요')
    actions.saveRoutine({ ...r, name: r.name.trim() })
    draft = null
    nav.pop()
  }

  return (
    <>
      <TopBar title={id ? '루틴 편집' : '루틴 만들기'} back onBack={() => { draft = null; nav.pop() }} />
      <Page fixed>
        <div style={{ padding: '0 16px' }}>
          <p className="field-label">루틴 이름</p>
          <input className="input" value={r.name} maxLength={20} placeholder="예: 가슴 + 삼두 데이" onChange={(e) => update({ name: e.target.value })} aria-label="루틴 이름" />
        </div>
        <div className="list-group">
          {r.items.map((it, idx) => {
            const e = findExercise(s, it.exerciseId)
            if (!e) return null
            return (
              <div className="list-item" key={it.exerciseId}>
                <div className="grow"><b>{exName(s, e)}</b></div>
                <div className="row gap8">
                  <button className="iconbtn" aria-label="세트 수 줄이기" onClick={() => update({ items: r.items.map((x, i) => (i === idx ? { ...x, sets: Math.max(1, x.sets - 1) } : x)) })}><Icon name="minus" size={16} /></button>
                  <span style={{ minWidth: 40, textAlign: 'center' }}>{it.sets}세트</span>
                  <button className="iconbtn" aria-label="세트 수 늘리기" onClick={() => update({ items: r.items.map((x, i) => (i === idx ? { ...x, sets: x.sets + 1 } : x)) })}><Icon name="plus" size={16} /></button>
                  <button className="iconbtn" aria-label="종목 삭제" onClick={() => update({ items: r.items.filter((_, i) => i !== idx) })}><Icon name="trash" size={18} color="var(--text2)" /></button>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0 16px' }}>
          <button
            className="btn line"
            onClick={() =>
              nav.push('picker', {
                mode: 'routine',
                picked: r.items.map((i) => i.exerciseId),
                onPick: (exId: string) => update({ items: [...draft!.routine.items, { exerciseId: exId, sets: 3 }] }),
              })
            }
          >
            종목 추가
          </button>
          {id && (
            <button className="btn danger mt12" onClick={() => { actions.deleteRoutine(id); draft = null; nav.pop() }}>
              루틴 삭제
            </button>
          )}
        </div>
      </Page>
      <div className="bottom-fixed" style={{ position: 'absolute', left: 0, right: 0, bottom: 'var(--footer-h)' }}>
        <button className="btn" onClick={save}>저장</button>
      </div>
      {toast}
    </>
  )
}
