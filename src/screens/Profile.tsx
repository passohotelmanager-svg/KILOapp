// 프로필, 설정, 계정 연결, 신체 정보, 운동 메모 (F-32, F-39, F-40, F-41, F-42)
import { useState } from 'react'
import { actions, exName, findExercise, nicknameTaken, useAppState } from '../store'
import { useNav } from '../nav'
import { Card, Page, Segmented, Sheet, Toggle, TopBar, useToast } from '../components/ui'
import { Icon } from '../components/Icon'
import { ACTIVITY_LEVELS } from '../lib/constants'
import { best1RM, sessionSeconds } from '../lib/calc'
import { vol, comma, hm } from '../lib/format'
import { mdLabel, parseYmd } from '../lib/dates'
import { agg, recordedSessions } from '../lib/stats'
import { requestNotifPermission } from '../lib/alarm'
import { NAME_LANG_OPTIONS } from './Picker'
import type { Provider } from '../types'

const BIG3 = [
  { id: 'legs-01', label: '스쿼트' },
  { id: 'chest-01', label: '벤치프레스' },
  { id: 'back-01', label: '데드리프트' },
]

// 업적: 주간 연속 기록(스트릭) = 이번 주부터 거슬러 올라가며 운동한 주가 이어진 횟수
function weekStreak(days: Set<string>): number {
  const monday = (d: Date) => {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
    return r
  }
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const weeks = new Set([...days].map((x) => key(monday(parseYmd(x)))))
  let cur = monday(new Date())
  // 이번 주에 아직 운동하지 않았다면 지난주부터 센다
  if (!weeks.has(key(cur))) cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7)
  let n = 0
  while (weeks.has(key(cur))) {
    n += 1
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 7)
  }
  return n
}

export function Profile() {
  const s = useAppState()
  const nav = useNav()
  const [info, setInfo] = useState(false)
  const sessions = recordedSessions(s)
  const totalSec = sessions.reduce((a, x) => a + sessionSeconds(x), 0)
  const a = agg(s, new Date(2000, 0, 1), new Date(2100, 0, 1))
  const days = new Set(sessions.map((x) => x.date))
  const streak = weekStreak(days)
  const one = BIG3.map((b) => Math.round(best1RM(s.sessions, b.id)))
  const sum = one.reduce((x, y) => x + y, 0)
  const last = [...s.bodyLog].reverse()
  const latest = (k: 'weightKg' | 'muscleKg' | 'fatPct') => last.find((l) => l[k] != null)?.[k] ?? null

  const tile = (icon: string, label: string, v: string) => (
    <div className="stat-tile">
      <div className="l"><Icon name={icon} size={16} color="var(--primary)" />{label}</div>
      <div className="v">{v}</div>
    </div>
  )

  return (
    <>
      <TopBar
        title="프로필"
        right={
          <button className="iconbtn" aria-label="설정" onClick={() => nav.push('settings')}>
            <Icon name="settings" />
            {s.settings.notifConsent === null && <span className="badge-dot" />}
          </button>
        }
      />
      <Page>
        <div style={{ padding: '0 20px 4px' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{s.user?.nickname}</h2>
        </div>

        <Card title="업적">
          <div className="two">
            {tile('clock', '운동 시간', totalSec ? hm(totalSec) : '-')}
            {tile('muscle', '총 볼륨', a.total ? `${vol(a.total)}kg` : '-')}
            {tile('dumbbell', '총 운동 횟수', days.size ? `${days.size}회` : '-')}
            {tile('flame', '주간 스트릭', streak ? `${streak}주` : '-')}
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3 className="card-title">3대 중량 (1RM)</h3>
            <button className="iconbtn" aria-label="1RM 추정 방식 설명" onClick={() => setInfo(true)}><Icon name="info" size={20} color="var(--text2)" /></button>
          </div>
          <div className="stat-tile center" style={{ marginBottom: 10 }}>
            <div className="l" style={{ justifyContent: 'center' }}>TOTAL</div>
            <div className="v">{sum ? `${comma(sum)}kg` : '-'}</div>
          </div>
          <div className="three" style={{ gap: 8 }}>
            {BIG3.map((b, i) => (
              <div key={b.id} className="stat-tile center" style={{ borderLeft: 0 }}>
                <div className="l" style={{ justifyContent: 'center' }}>{b.label}</div>
                <div className="v">{one[i] ? `${one[i]}kg` : '-'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="최근 신체 정보" onMore={() => nav.push('bodyInfo')}>
          <div className="three" style={{ gap: 8 }}>
            {[
              { l: '체중', v: latest('weightKg'), u: 'kg' },
              { l: '골격근량', v: latest('muscleKg'), u: 'kg' },
              { l: '체지방률', v: latest('fatPct'), u: '%' },
            ].map((x) => (
              <div key={x.l} className="stat-tile center">
                <div className="l" style={{ justifyContent: 'center' }}>{x.l}</div>
                <div className="v">{x.v != null ? `${x.v}${x.u}` : '-'}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="list-group">
          <button className="list-item" onClick={() => nav.push('routines')}>
            <Icon name="list" color="var(--primary)" /><span className="grow"><b>운동 루틴</b></span><span className="menu-count">{s.routines.length}</span><Icon name="chevron" size={16} color="var(--text2)" />
          </button>
          <button className="list-item" onClick={() => nav.push('picker', { mode: 'library' })}>
            <Icon name="folder" color="var(--primary)" /><span className="grow"><b>운동 라이브러리</b><div className="muted" style={{ fontSize: 13 }}>모든 운동 종목 둘러보기</div></span><Icon name="chevron" size={16} color="var(--text2)" />
          </button>
          <button className="list-item" onClick={() => nav.push('memos')}>
            <Icon name="note" color="var(--primary)" /><span className="grow"><b>운동 메모</b><div className="muted" style={{ fontSize: 13 }}>기록한 메모 모아보기</div></span><Icon name="chevron" size={16} color="var(--text2)" />
          </button>
          <button className="list-item" onClick={() => nav.push('album')}>
            <Icon name="image" color="var(--primary)" /><span className="grow"><b>식단 앨범</b><div className="muted" style={{ fontSize: 13 }}>식단 사진 모아보기</div></span><Icon name="chevron" size={16} color="var(--text2)" />
          </button>
        </div>
      </Page>

      {info && (
        <Sheet mid onClose={() => setInfo(false)}>
          <h3 className="card-title">1RM 추정 방식</h3>
          <p className="sub">스쿼트, 벤치프레스, 데드리프트의 기록 중 가장 높은 값을 Epley 공식으로 계산해요.</p>
          <p className="sub"><b>1RM = 무게 x (1 + 횟수 / 30)</b></p>
          <p className="sub">바벨 백스쿼트, 바벨 벤치프레스, 데드리프트 기록을 기준으로 해요. 실제 1회 최대 중량과는 차이가 있을 수 있어요.</p>
          <button className="btn mt16" onClick={() => setInfo(false)}>확인</button>
        </Sheet>
      )}
    </>
  )
}

export function Memos() {
  const s = useAppState()
  const list = s.sessions.filter((x) => x.memo.trim()).sort((a, b) => b.startedAt - a.startedAt)
  return (
    <>
      <TopBar title="운동 메모" back />
      <Page>
        {list.length === 0 && <div className="empty">작성한 메모가 없어요</div>}
        {list.map((x) => (
          <Card key={x.id}>
            <p className="muted">{mdLabel(parseYmd(x.date))}</p>
            <p className="mt8" style={{ whiteSpace: 'pre-wrap' }}>{x.memo}</p>
          </Card>
        ))}
      </Page>
    </>
  )
}

export function BodyInfo() {
  const s = useAppState()
  const [w, setW] = useState('')
  const [m, setM] = useState('')
  const [f, setF] = useState('')
  const [toast, show] = useToast()
  const num = (v: string) => (Number.isFinite(parseFloat(v)) && parseFloat(v) > 0 ? parseFloat(v) : null)
  const logs = [...s.bodyLog].sort((a, b) => b.at - a.at)

  const save = () => {
    if (num(w) === null && num(m) === null && num(f) === null) return show('값을 하나 이상 입력해주세요')
    actions.addBodyLog({ weightKg: num(w), muscleKg: num(m), fatPct: num(f) })
    setW(''); setM(''); setF('')
    show('기록했어요')
  }

  // 체중 추이 (최근 12개)
  const pts = [...s.bodyLog].filter((l) => l.weightKg).slice(-12)
  const min = Math.min(...pts.map((p) => p.weightKg!))
  const max = Math.max(...pts.map((p) => p.weightKg!))
  const path = pts
    .map((p, i) => {
      const x = pts.length === 1 ? 160 : (i / (pts.length - 1)) * 300 + 10
      const y = max === min ? 50 : 90 - ((p.weightKg! - min) / (max - min)) * 70
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const input = (label: string, v: string, set: (x: string) => void, unit: string) => (
    <label style={{ flex: 1 }}>
      <p className="field-label" style={{ marginTop: 0 }}>{label}</p>
      <input className="input" type="number" inputMode="decimal" min={0} step={0.1} value={v} onChange={(e) => set(e.target.value)} placeholder={unit} aria-label={label} />
    </label>
  )

  return (
    <>
      <TopBar title="신체 정보" back />
      <Page>
        <Card title="오늘 기록하기">
          <div className="row gap8">
            {input('체중', w, setW, 'kg')}
            {input('골격근량', m, setM, 'kg')}
            {input('체지방률', f, setF, '%')}
          </div>
          <button className="btn mt16" onClick={save}>저장</button>
        </Card>
        <Card title="체중 변화">
          {pts.length < 2 ? (
            <p className="muted">기록이 2개 이상 쌓이면 그래프로 보여드려요</p>
          ) : (
            <svg viewBox="0 0 320 100" width="100%" role="img" aria-label="체중 변화 그래프">
              <path d={path} fill="none" stroke="#e5534b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => {
                const x = (i / (pts.length - 1)) * 300 + 10
                const y = max === min ? 50 : 90 - ((p.weightKg! - min) / (max - min)) * 70
                return <circle key={p.id} cx={x} cy={y} r="3.5" fill="#e5534b" />
              })}
            </svg>
          )}
        </Card>
        <Card title="기록">
          <table className="tbl">
            <thead><tr><th>날짜</th><th className="r">체중</th><th className="r">골격근</th><th className="r">체지방</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{mdLabel(new Date(l.at))}</td>
                  <td className="r">{l.weightKg ?? '-'}</td>
                  <td className="r">{l.muscleKg ?? '-'}</td>
                  <td className="r">{l.fatPct ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Page>
      {toast}
    </>
  )
}

export function Settings() {
  const s = useAppState()
  const nav = useNav()
  const [toast, show] = useToast()
  const [nick, setNick] = useState(s.user?.nickname ?? '')
  const [confirmDel, setConfirmDel] = useState(false)
  const st = s.settings
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']

  const saveNick = () => {
    const t = nick.trim()
    if (t.length < 2 || t.length > 12) return show('닉네임은 2~12자로 입력해주세요')
    if (t !== s.user?.nickname && nicknameTaken(s, t)) return show('이미 사용 중인 닉네임이에요')
    actions.setNickname(t)
    show('닉네임을 바꿨어요')
  }

  const toggleNotif = async (on: boolean) => {
    if (on) {
      const ok = await requestNotifPermission()
      actions.updateSettings({ notifConsent: ok })
      if (!ok) show('알림 권한이 꺼져 있어 앱 화면 안 알림만 사용해요')
    } else {
      actions.updateSettings({ notifConsent: false })
    }
  }

  return (
    <>
      <TopBar title="설정" back />
      <Page>
        <Card title="닉네임">
          <div className="row gap8">
            <input className="input" value={nick} maxLength={12} onChange={(e) => setNick(e.target.value)} aria-label="닉네임" />
            <button className="btn sm" onClick={saveNick}>변경</button>
          </div>
        </Card>

        <div className="list-group">
          <button className="list-item" onClick={() => nav.push('account')}>
            <Icon name="link" color="var(--primary)" /><span className="grow"><b>계정 연결</b><div className="muted" style={{ fontSize: 13 }}>{s.user?.providers.length ?? 0}개 연결됨</div></span><Icon name="chevron" size={16} color="var(--text2)" />
          </button>
          <button className="list-item" onClick={() => nav.push('bodyInfo')}>
            <Icon name="scale" color="var(--primary)" /><span className="grow"><b>신체 정보 수정</b></span><Icon name="chevron" size={16} color="var(--text2)" />
          </button>
        </div>

        <Card title="종목명 표기 언어">
          <Segmented value={st.nameLang} onChange={(v) => actions.updateSettings({ nameLang: v })} options={NAME_LANG_OPTIONS} />
          <p className="muted mt8">예: {exName(s, findExercise(s, 'chest-01')!)}</p>
        </Card>

        <Card title="기본 휴식 시간">
          <div className="row between">
            <span className="muted">세트 사이 기본 휴식</span>
            <select value={st.restDefault} onChange={(e) => actions.updateSettings({ restDefault: Number(e.target.value) })} aria-label="기본 휴식 시간">
              {[10, 20, 30, 45, 60, 90, 120, 180].map((v) => <option key={v} value={v}>{v}초</option>)}
            </select>
          </div>
        </Card>

        <Card title="알림">
          <div className="row between">
            <span>알림 및 알람 사용</span>
            <Toggle on={!!st.notifConsent} onChange={toggleNotif} label="알림 사용" />
          </div>
          <p className="muted mt8" style={{ fontSize: 12 }}>끄면 휴식 종료 알람은 앱 화면 안에서 소리와 진동으로만 알려드려요</p>
          <div className="hr" />
          <div className="row between">
            <span>운동 리마인더</span>
            <Toggle on={st.remindOn} onChange={(v) => actions.updateSettings({ remindOn: v })} label="운동 리마인더" />
          </div>
          {st.remindOn && (
            <>
              <div className="chips" style={{ padding: '12px 0 0' }}>
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    className={`chip ${st.remindDays.includes(i) ? 'on' : ''}`}
                    onClick={() => actions.updateSettings({ remindDays: st.remindDays.includes(i) ? st.remindDays.filter((x) => x !== i) : [...st.remindDays, i] })}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input className="input mt8" type="time" value={st.remindTime} onChange={(e) => actions.updateSettings({ remindTime: e.target.value })} aria-label="리마인더 시각" />
              <p className="muted mt8" style={{ fontSize: 12 }}>웹 앱은 앱이 열려 있을 때만 정해진 시각에 알려드릴 수 있어요</p>
            </>
          )}
        </Card>

        {s.profile && (
          <Card title="활동 계수">
            {ACTIVITY_LEVELS.map((a) => (
              <button key={a.factor} className={`pick ${s.profile!.activity === a.factor ? 'on' : ''}`} style={{ padding: 12, marginBottom: 8 }} onClick={() => actions.updateProfile({ activity: a.factor })}>
                <b style={{ fontSize: 15 }}>{a.name} ({a.factor})</b>
                <span>{a.desc}</span>
              </button>
            ))}
          </Card>
        )}

        {s.blocks.length > 0 && (
          <Card title="차단한 사용자">
            {s.blocks.map((b) => (
              <div key={b} className="row between" style={{ padding: '6px 0' }}>
                <span>{s.comments.find((c) => c.userId === b)?.nickname ?? '알 수 없음'}</span>
                <button className="btn ghost sm" onClick={() => actions.unblockUser(b)}>해제</button>
              </div>
            ))}
          </Card>
        )}

        <div style={{ padding: '8px 16px' }}>
          <button className="btn danger" onClick={() => setConfirmDel(true)}>회원 탈퇴</button>
        </div>
      </Page>

      {confirmDel && (
        <Sheet mid onClose={() => setConfirmDel(false)}>
          <h3 className="card-title">정말 탈퇴할까요?</h3>
          <p className="sub">운동, 영양, 신체 기록과 작성한 코멘트가 즉시 삭제되며 되돌릴 수 없어요.</p>
          <button className="btn danger mt16" onClick={() => actions.deleteAccount()}>탈퇴하고 모두 삭제</button>
          <button className="btn ghost mt8" onClick={() => setConfirmDel(false)}>취소</button>
        </Sheet>
      )}
      {toast}
    </>
  )
}

const PROVIDERS: { id: Provider; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'apple', name: 'Apple' },
]

export function Account() {
  const s = useAppState()
  const [toast, show] = useToast()
  const linked = s.user?.providers ?? []
  return (
    <>
      <TopBar title="계정 연결" back />
      <Page>
        <p className="sub" style={{ padding: '0 20px' }}>여러 로그인 수단을 하나의 계정에 연결할 수 있어요. 로그인 수단이 1개만 남으면 해제할 수 없어요.</p>
        <div className="list-group">
          {PROVIDERS.map((p) => {
            const on = linked.includes(p.id)
            return (
              <div className="list-item" key={p.id}>
                <span className="grow"><b>{p.name}</b><div className="muted" style={{ fontSize: 13 }}>{on ? '연결됨' : '연결 안 됨'}</div></span>
                <button
                  className={`btn sm ${on ? 'ghost' : ''}`}
                  onClick={() => {
                    if (on) {
                      if (!actions.unlinkProvider(p.id)) show('로그인 수단이 1개만 남으면 해제할 수 없어요')
                    } else {
                      actions.linkProvider(p.id)
                    }
                  }}
                >
                  {on ? '해제' : '연결'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="sub" style={{ padding: '0 20px' }}>이 버전은 데모 로그인이에요. 실제 로그인은 Firebase Authentication 연결 후 동작해요.</p>
      </Page>
      {toast}
    </>
  )
}
