// 종목 선택 / 라이브러리 (F-23, F-27, F-28, F-29)
import { useMemo, useState } from 'react'
import { actions, activeSession, allExercises, exName, useAppState } from '../store'
import { useNav } from '../nav'
import { Page, Segmented, Sheet, TopBar, useToast } from '../components/ui'
import { Icon } from '../components/Icon'
import { PARTS, PART_NAME, SUBS_OF, SUB_NAME } from '../lib/constants'
import type { Exercise, NameLang, PartCode, RecordType, SubPartCode } from '../types'

const TYPE_NAME: Record<RecordType, string> = {
  weight: '무게',
  bodyweight: '맨몸',
  time: '시간',
  cardio_distance: '유산소 거리형',
  cardio_time: '유산소 시간형',
}

type Filter = 'all' | 'fav' | 'recent' | PartCode

export function Picker({ mode }: { mode: 'session' | 'routine' | 'library' }) {
  const s = useAppState()
  const nav = useNav()
  const routineAdd = nav.stack[nav.stack.length - 1].params?.onPick as ((id: string) => void) | undefined
  const picked = (nav.stack[nav.stack.length - 1].params?.picked as string[] | undefined) ?? []
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sub, setSub] = useState<SubPartCode | null>(null)
  const [creating, setCreating] = useState(false)
  const [added, setAdded] = useState<string[]>(picked)
  const [toast, show] = useToast()

  const ss = activeSession(s)
  const inSession = (id: string) => (mode === 'session' ? !!ss?.items.some((i) => i.exerciseId === id) : added.includes(id))

  const list = useMemo(() => {
    const all = allExercises(s)
    const needle = q.trim().toLowerCase()
    let base: Exercise[] = all
    if (filter === 'fav') base = all.filter((e) => s.favorites.includes(e.id))
    else if (filter === 'recent') base = s.recent.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
    else if (filter !== 'all') base = all.filter((e) => e.part === filter)
    if (sub) base = base.filter((e) => e.subPart === sub)
    if (needle) base = base.filter((e) => e.nameKo.toLowerCase().includes(needle) || e.nameEn.toLowerCase().includes(needle))
    // 즐겨찾기를 목록 상단에 둔다
    if (filter !== 'recent') base = [...base].sort((a, b) => Number(s.favorites.includes(b.id)) - Number(s.favorites.includes(a.id)))
    return base
  }, [s, q, filter, sub])

  const pick = (e: Exercise) => {
    if (mode === 'session') {
      if (inSession(e.id)) return show('이미 오늘 운동에 있어요')
      actions.addExerciseToSession(e.id)
      show(`${e.nameKo} 추가`)
    } else if (mode === 'routine') {
      if (inSession(e.id)) return
      routineAdd?.(e.id)
      setAdded((a) => [...a, e.id])
    }
  }

  const chips: { v: Filter; label: string }[] = [
    { v: 'all', label: '전체' },
    { v: 'fav', label: '즐겨찾기' },
    { v: 'recent', label: '최근' },
    ...[...PARTS, 'cardio' as PartCode].map((p) => ({ v: p as Filter, label: PART_NAME[p] })),
  ]

  return (
    <>
      <TopBar
        title={mode === 'library' ? '운동 라이브러리' : '종목 선택'}
        back
        right={
          <button className="iconbtn" aria-label="종목 직접 추가" onClick={() => setCreating(true)}>
            <Icon name="plus" />
          </button>
        }
      />
      <div style={{ padding: '0 16px 8px' }}>
        <div className="row" style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, color: 'var(--text2)' }}><Icon name="search" size={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="한글 또는 영어로 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="종목 검색" />
        </div>
      </div>
      <div className="chips" role="tablist">
        {chips.map((c) => (
          <button key={c.v} className={`chip ${filter === c.v ? 'on' : ''}`} onClick={() => { setFilter(c.v); setSub(null) }}>
            {c.label}
          </button>
        ))}
      </div>
      {filter !== 'all' && filter !== 'fav' && filter !== 'recent' && SUBS_OF[filter] && (
        <div className="chips" style={{ paddingTop: 0 }}>
          <button className={`chip ${sub === null ? 'on' : ''}`} onClick={() => setSub(null)}>전체</button>
          {SUBS_OF[filter]!.map((sp) => (
            <button key={sp} className={`chip ${sub === sp ? 'on' : ''}`} onClick={() => setSub(sp)}>{SUB_NAME[sp]}</button>
          ))}
        </div>
      )}
      <Page fixed={mode !== 'library'}>
        <div className="list-group">
          {list.length === 0 && <div className="empty">조건에 맞는 종목이 없어요</div>}
          {list.map((e) => {
            const on = inSession(e.id)
            return (
              <div key={e.id} className="list-item">
                <button className="grow" style={{ textAlign: 'left' }} onClick={() => pick(e)} disabled={mode === 'library'} aria-label={exName(s, e)}>
                  <div style={{ fontWeight: 700 }}>{exName(s, e)}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {PART_NAME[e.part]}{e.subPart ? ` · ${SUB_NAME[e.subPart]}` : ''} · {TYPE_NAME[e.type]}{e.builtin ? '' : ' · 내 종목'}
                  </div>
                </button>
                {mode !== 'library' && on && <Icon name="check" color="var(--primary)" />}
                {!e.builtin && mode === 'library' && (
                  <button className="iconbtn" aria-label="내 종목 삭제" onClick={() => actions.deleteCustomExercise(e.id)}>
                    <Icon name="trash" size={18} color="var(--text2)" />
                  </button>
                )}
                <button className="iconbtn" aria-label="즐겨찾기" aria-pressed={s.favorites.includes(e.id)} onClick={() => actions.toggleFavorite(e.id)}>
                  <Icon name="star" size={20} color={s.favorites.includes(e.id) ? '#EDA100' : '#c9d1d9'} fill={s.favorites.includes(e.id) ? '#EDA100' : 'none'} />
                </button>
              </div>
            )
          })}
        </div>
      </Page>
      {mode !== 'library' && (
        <div className="bottom-fixed" style={{ position: 'absolute', left: 0, right: 0, bottom: 'var(--footer-h)' }}>
          <button className="btn" onClick={nav.pop}>완료</button>
        </div>
      )}
      {creating && <CustomForm onClose={() => setCreating(false)} onCreated={(e) => { pick(e); show('종목을 추가했어요') }} />}
      {toast}
    </>
  )
}

function CustomForm({ onClose, onCreated }: { onClose: () => void; onCreated: (e: Exercise) => void }) {
  const [ko, setKo] = useState('')
  const [en, setEn] = useState('')
  const [part, setPart] = useState<PartCode>('chest')
  const [sub, setSub] = useState<SubPartCode | null>(null)
  const [type, setType] = useState<RecordType>('weight')
  const isCardio = part === 'cardio'
  const types: RecordType[] = isCardio ? ['cardio_distance', 'cardio_time'] : ['weight', 'bodyweight', 'time']
  const valid = (ko.trim() || en.trim()).length > 0

  const save = () => {
    const ex = actions.addCustomExercise({
      nameKo: ko.trim() || en.trim(),
      nameEn: en.trim() || ko.trim(),
      part,
      subPart: sub,
      type: types.includes(type) ? type : types[0],
    })
    onCreated(ex)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <h3 className="card-title">내 종목 만들기</h3>
      <p className="field-label">이름 (한글)</p>
      <input className="input" value={ko} onChange={(e) => setKo(e.target.value)} aria-label="종목 한글 이름" />
      <p className="field-label">이름 (영문)</p>
      <input className="input" value={en} onChange={(e) => setEn(e.target.value)} aria-label="종목 영문 이름" />
      <p className="field-label">부위</p>
      <div className="chips" style={{ padding: 0 }}>
        {[...PARTS, 'cardio' as PartCode].map((p) => (
          <button key={p} className={`chip ${part === p ? 'on' : ''}`} onClick={() => { setPart(p); setSub(null); setType(p === 'cardio' ? 'cardio_distance' : 'weight') }}>
            {PART_NAME[p]}
          </button>
        ))}
      </div>
      {SUBS_OF[part] && (
        <>
          <p className="field-label">하위 부위</p>
          <div className="chips" style={{ padding: 0 }}>
            {SUBS_OF[part]!.map((sp) => (
              <button key={sp} className={`chip ${sub === sp ? 'on' : ''}`} onClick={() => setSub(sub === sp ? null : sp)}>{SUB_NAME[sp]}</button>
            ))}
          </div>
        </>
      )}
      <p className="field-label">기록 유형</p>
      <Segmented value={type} onChange={setType} options={types.map((t) => ({ value: t, label: TYPE_NAME[t] }))} />
      <button className="btn mt24" disabled={!valid} onClick={save}>추가하기</button>
    </Sheet>
  )
}

export const NAME_LANG_OPTIONS: { value: NameLang; label: string }[] = [
  { value: 'ko', label: '한글만' },
  { value: 'en', label: '영어만' },
  { value: 'both', label: '한글+영어' },
]
