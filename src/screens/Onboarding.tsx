// 온보딩 10단계 (PRD 7.3)
import { tr } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { actions, nicknameTaken, useAppState } from '../store'
import { Icon } from '../components/Icon'
import { Wheel, useToast } from '../components/ui'
import { WEEKLY_HINT } from '../lib/constants'
import { activityFromWeekly } from '../lib/calc'
import { requestNotifPermission } from '../lib/alarm'
import { claimNickname, nicknameAvailable } from '../lib/cloud'
import { authEnabled, googleLoginEnabled, sendPasswordReset, signInWithEmail, signInWithProvider, signUpWithEmail, type AuthFail, type AuthProvider } from '../lib/auth'
import type { Goal, Profile, Provider, Sex } from '../types'

const range = (a: number, b: number, fmt: (n: number) => string = String) =>
  Array.from({ length: b - a + 1 }, (_, i) => ({ value: a + i, label: fmt(a + i) }))


function Back({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ height: 52, display: 'flex', alignItems: 'center', marginLeft: -8 }}>
      <button className="iconbtn" aria-label={tr('뒤로가기')} onClick={onBack}>
        <Icon name="back" />
      </button>
    </div>
  )
}

function Footer({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <div className="bottom-fixed">
      <button className="btn" disabled={disabled} onClick={onClick}>
        {label}
      </button>
    </div>
  )
}

export function Onboarding() {
  const s = useAppState()
  const [stepState, setStep] = useState(1)
  // 로그인이 끝나 계정이 생기면(로그인 창에서 돌아온 경우 포함) 닉네임 단계로 간다
  const needNickname = !!s.user && !s.user.nickname && !!s.profile
  const step = needNickname ? 10 : stepState

  // 이미 계정이 있는 사람이 로그인하면(이 기기에 정보가 없으면) 몸 정보를 묻는 단계로 보낸다
  useEffect(() => {
    if (s.user && !s.profile && (stepState === 1 || stepState === 11)) setStep(2)
  }, [s.user, s.profile, stepState])
  // 몸 정보를 다 묻고 로그인 단계에 왔는데 이미 로그인돼 있으면 로그인을 건너뛴다
  useEffect(() => {
    if (stepState === 9 && s.user && !s.onboarded) setStep(10)
  }, [stepState, s.user, s.onboarded])
  // 계정에 닉네임이 이미 있으면 닉네임 단계를 건너뛰고 바로 시작한다
  useEffect(() => {
    if (step === 10 && s.user?.nickname && !s.onboarded) actions.completeOnboarding(profile())
  }, [step, s.user, s.onboarded]) // eslint-disable-line react-hooks/exhaustive-deps
  const [goal, setGoal] = useState<Goal | null>(null)
  const [weekly, setWeekly] = useState(3)
  const [y, setY] = useState(1995)
  const [m, setM] = useState(1)
  const [d, setD] = useState(1)
  const [sex, setSex] = useState<Sex | null>(null)
  const [height, setHeight] = useState(170)
  const [kgInt, setKgInt] = useState(65)
  const [kgDec, setKgDec] = useState(0)
  const [nick, setNick] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [serverTaken, setServerTaken] = useState(false)
  const [toast, show] = useToast()

  const thisYear = new Date().getFullYear()
  const days = new Date(y, m, 0).getDate()
  const dayOpts = useMemo(() => range(1, days, (n) => tr('{0}일', [n])), [days])
  const next = () => setStep((n) => n + 1)
  const prev = () => setStep((n) => Math.max(1, n - 1))
  const clampedDay = Math.min(d, days)

  const profile = (): Profile => ({
    goal: goal ?? 'health',
    weeklyGoal: weekly,
    birth: `${y}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`,
    sex: sex ?? 'male',
    heightCm: height,
    weightKg: kgInt + kgDec / 10,
    activity: activityFromWeekly(weekly),
  })

  const login = async (p: Provider) => {
    if (!authEnabled) {
      actions.login(p)
      setStep(10)
      return
    }
    if (p !== 'google' && p !== 'apple') return
    // 로그인 창에 갔다 돌아오면 이 화면의 입력값이 사라지므로, 지금까지 입력한 정보를 먼저 저장해 둔다
    actions.completeOnboarding(profile())
    const err = await signInWithProvider(p as AuthProvider)
    if (err) show(tr('로그인을 시작하지 못했어요. 잠시 후 다시 시도해주세요'))
  }

  // 닉네임을 입력하면 서버에서 중복을 확인한다 (입력이 멈춘 뒤 0.4초)
  useEffect(() => {
    const t = nick.trim()
    setServerTaken(false)
    if (!authEnabled || step !== 10 || t.length < 2 || t.length > 12) return
    const h = window.setTimeout(async () => {
      const r = await nicknameAvailable(t)
      if (r.ok) setServerTaken(!r.value)
    }, 400)
    return () => window.clearTimeout(h)
  }, [nick, step])

  const failText = (f: AuthFail): string =>
    ({
      invalid: tr('이메일 또는 비밀번호가 맞지 않아요'),
      unconfirmed: tr('메일 확인이 아직 안 됐어요. 받은 메일의 링크를 눌러주세요'),
      exists: tr('이미 가입된 이메일이에요. 로그인해주세요'),
      rate: tr('요청이 너무 많아요. 잠시 후 다시 시도해주세요'),
      weak: tr('비밀번호가 너무 약해요'),
      off: tr('이메일 로그인을 사용할 수 없어요'),
      unknown: tr('실패했어요. 잠시 후 다시 시도해주세요'),
    })[f]

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const submitEmail = async (kind: 'signup' | 'login') => {
    if (!emailOk) return setMsg(tr('이메일 주소를 확인해주세요'))
    if (pw.length < 8) return setMsg(tr('비밀번호는 8자 이상이에요'))
    setBusy(true)
    setMsg('')
    if (kind === 'signup') {
      // 확인 메일 링크로 돌아와도 지금까지 입력한 정보가 남도록 먼저 저장해 둔다
      actions.completeOnboarding(profile())
      const r = await signUpWithEmail(email.trim(), pw)
      if (r.fail) setMsg(failText(r.fail))
      else if (r.needsConfirm) setMsg(tr('확인 메일을 보냈어요. 메일의 링크를 누르면 로그인돼요'))
    } else {
      const f = await signInWithEmail(email.trim(), pw)
      if (f) setMsg(failText(f))
    }
    setBusy(false)
  }
  const forgot = async () => {
    if (!emailOk) return setMsg(tr('이메일 주소를 먼저 입력해주세요'))
    setBusy(true)
    const f = await sendPasswordReset(email.trim())
    setMsg(f ? failText(f) : tr('비밀번호 재설정 메일을 보냈어요'))
    setBusy(false)
  }

  const nickErr = (() => {
    const t = nick.trim()
    if (t.length > 0 && (t.length < 2 || t.length > 12)) return tr('2~12자로 입력해주세요')
    if (t && (nicknameTaken(s, t) || serverTaken)) return tr('이미 사용 중인 닉네임이에요')
    return ''
  })()

  const shell = (children: React.ReactNode, footer?: React.ReactNode, noBack = false) => (
    <>
      <div className="onb">
        {!noBack && <Back onBack={prev} />}
        <div className="onb-body">{children}</div>
      </div>
      {footer}
      {toast}
    </>
  )

  if (step === 1) {
    return (
      <div className="start-bg" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontWeight: 800, letterSpacing: 4, color: '#c4392f' }}>KILO</p>
          <h1 className="h1" style={{ fontSize: 30, marginTop: 8 }}>{tr('기록을 습관으로,')}<br />{tr('작심삼일 끝!')}</h1>
          <p className="sub">{tr('세트 기록부터 휴식 타이머, 볼륨 통계, 영양 기록까지 한 번에 관리해요')}</p>
          {/* 실제 사용자 데이터가 쌓이기 전에는 지속률 수치를 표시하지 않는다 */}
        </div>
        <div style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))', textAlign: 'center' }}>
          <button className="btn" onClick={next}>{tr('시작하기')}</button>
          <button
            className="link mt16"
            style={{ background: 'none' }}
            onClick={() => (authEnabled ? setStep(11) : show(tr('이 기기에는 저장된 계정이 없어요. 시작하기로 새로 만들어주세요')))}
          >
            
            {tr('이미 계정이 있어요')}
          </button>
        </div>
        {toast}
      </div>
    )
  }

  if (step === 2) {
    const goals: { v: Goal; t: string; d: string }[] = [
      { v: 'lose', t: tr('체중 감량'), d: tr('지방을 줄이고 가벼워지고 싶어요') },
      { v: 'strength', t: tr('근력 증가'), d: tr('더 무겁게, 더 강하게 만들고 싶어요') },
      { v: 'health', t: tr('건강 관리'), d: tr('꾸준히 건강한 몸을 유지하고 싶어요') },
    ]
    return shell(
      <>
        <h1 className="h1">{tr('KILO에서 어떤 변화를')}<br />{tr('기대하나요?')}</h1>
        <p className="sub">{tr('목표를 이룰 수 있도록 KILO가 도와드릴게요')}</p>
        <div className="mt24">
          {goals.map((g) => (
            <button key={g.v} className={`pick ${goal === g.v ? 'on' : ''}`} onClick={() => setGoal(g.v)}>
              <b>{g.t}</b>
              <span>{g.d}</span>
            </button>
          ))}
        </div>
      </>,
      <Footer label={tr('다음')} disabled={!goal} onClick={next} />,
    )
  }

  if (step === 3) {
    return shell(
      <>
        <h1 className="h1">{tr('일주일에 몇 번')}<br />{tr('운동할 수 있나요?')}</h1>
        <p className="sub">{tr('현실적으로 가능한 횟수로 선택해주세요')}</p>
        <div className="slider-dots" role="radiogroup" aria-label={tr('주간 운동 횟수')}>
          <div className="slider-line" />
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <div key={n} style={{ position: 'relative' }}>
              {n === 3 && <span className="bubble-rec" style={{ left: '50%' }}>{tr('추천')}</span>}
              <button className={weekly === n ? 'on' : ''} role="radio" aria-checked={weekly === n} onClick={() => setWeekly(n)}>
                {n}
              </button>
            </div>
          ))}
        </div>
        <div className="hintbox">{WEEKLY_HINT[weekly]}</div>
      </>,
      <Footer label={tr('다음')} onClick={next} />,
    )
  }

  if (step === 4) {
    return shell(
      <>
        <h1 className="h1">{tr('생년월일을')}<br />{tr('입력해주세요')}</h1>
        <p className="sub">{tr('연령에 맞는 운동 분석을 위해 필요해요')}</p>
        <div className="wheels">
          <Wheel options={range(thisYear - 90, thisYear - 10, (n) => tr('{0}년', [n]))} value={y} onChange={setY} />
          <Wheel options={range(1, 12, (n) => tr('{0}월', [n]))} value={m} onChange={setM} />
          <Wheel options={dayOpts} value={clampedDay} onChange={setD} />
        </div>
      </>,
      <Footer label={tr('다음')} onClick={next} />,
    )
  }

  if (step === 5) {
    return shell(
      <>
        <h1 className="h1">{tr('성별을 알려주세요')}</h1>
        <p className="sub">{tr('신체 특성에 맞는 운동 분석에 활용돼요')}</p>
        <div className="row gap12 mt24">
          {(['male', 'female'] as Sex[]).map((v) => (
            <button key={v} className={`square-pick ${sex === v ? 'on' : ''}`} onClick={() => setSex(v)}>
              <span>{v === 'male' ? tr('남성') : tr('여성')}</span>
              <span style={{ alignSelf: 'flex-end' }}>
                <Icon name={v} size={32} />
              </span>
            </button>
          ))}
        </div>
      </>,
      <Footer label={tr('다음')} disabled={!sex} onClick={next} />,
    )
  }

  if (step === 6) {
    return shell(
      <>
        <h1 className="h1">{tr('최근 측정한 키와')}<br />{tr('체중을 입력해주세요')}</h1>
        <p className="sub">{tr('현재 몸 상태에 맞는 분석에 활용돼요')}</p>
        <div className="wheels">
          <Wheel options={range(120, 220)} value={height} onChange={setHeight} unit="cm" />
          <Wheel options={range(30, 200)} value={kgInt} onChange={setKgInt} />
          <Wheel options={range(0, 9, (n) => `.${n}`)} value={kgDec} onChange={setKgDec} unit="kg" />
        </div>
      </>,
      <Footer label={tr('다음')} onClick={next} />,
    )
  }

  if (step === 7) {
    return shell(
      <>
        <h1 className="h1">{tr('입력해주신 정보를 바탕으로')}<br />{tr('매주 맞춤 리포트를 보내드릴게요')}</h1>
        <p className="sub">{tr('운동 변화와 기록 흐름을 한 눈에 확인하세요')}</p>
        <div className="reports" aria-hidden="true">
          <div style={{ left: 0, top: 50, transform: 'rotate(-8deg)', opacity: 0.6 }}>{tr('주간 볼륨')}</div>
          <div style={{ left: 60, top: 36, transform: 'rotate(5deg)', opacity: 0.8 }}>{tr('운동 시간')}</div>
          <div style={{ left: 30, top: 10 }}>{tr('이번 주 요약')}</div>
        </div>
      </>,
      <Footer label={tr('다음')} onClick={next} />,
    )
  }

  if (step === 8) {
    const agree = async () => {
      const ok = await requestNotifPermission()
      actions.updateSettings({ notifConsent: ok })
      next()
    }
    return shell(
      <>
        <h1 className="h1">{tr('꾸준한 운동 습관을 만들 수 있도록')}<br />{tr('필요한 순간에 알려드릴게요')}</h1>
        <p className="sub">{tr('휴식 종료 알람과 운동 리마인더에 알림 권한을 사용해요. 허용하지 않아도 앱 화면 안에서 소리와 진동으로 알려드려요.')}</p>
        <div className="center mt24" style={{ color: 'var(--primary)' }}>
          <Icon name="bell" size={120} strokeWidth={1.2} />
        </div>
      </>,
      <div className="bottom-fixed">
        <button className="btn" onClick={agree}>{tr('좋아요')}</button>
        <button
          className="link mt12"
          style={{ display: 'block', margin: '12px auto 0', background: 'none' }}
          onClick={() => {
            actions.updateSettings({ notifConsent: false })
            next()
          }}
        >
          
          {tr('나중에 할게요')}
        </button>
      </div>,
    )
  }

  if (step === 9 || step === 11) {
    const signup = step === 9
    // 데모 로그인일 때는 이 버튼이 유일한 시작 버튼이라 항상 보여준다
    const showGoogle = !authEnabled || googleLoginEnabled
    const googleBtn = showGoogle && (
      <button className="btn line" style={{ marginBottom: 10 }} onClick={() => login('google')}>
        {tr('Google로 계속하기')}
      </button>
    )
    return shell(
      <>
        <h1 className="h1">{signup ? <>{tr('로그인하고')}<br />{tr('기록을 시작해요')}</> : <>{tr('다시 만나서')}<br />{tr('반가워요')}</>}</h1>
        <p className="sub">{authEnabled ? tr(googleLoginEnabled ? 'Google 계정 또는 이메일로 {0}해요' : '이메일로 {0}해요', [signup ? tr('가입') : tr('로그인')]) : tr('이 버전은 데모 로그인이라 계정 정보가 이 기기에만 저장돼요')}</p>
        <div className="mt24">
          {googleBtn}
          {authEnabled && (
            <>
              {showGoogle && <p className="sub center" style={{ margin: '14px 0' }}>{tr('또는')}</p>}
              <input className="input" type="email" autoComplete="email" inputMode="email" placeholder={tr('이메일')} value={email} onChange={(e) => setEmail(e.target.value)} aria-label={tr('이메일')} />
              <input className="input mt8" type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? tr('비밀번호 (8자 이상)') : tr('비밀번호')} value={pw} onChange={(e) => setPw(e.target.value)} aria-label={tr('비밀번호')} />
              {msg && <p className="sub" style={{ color: 'var(--dec)', marginTop: 10 }} role="status">{msg}</p>}
              <button className="btn mt16" disabled={busy || !email || !pw} onClick={() => submitEmail(signup ? 'signup' : 'login')}>
                {signup ? tr('이메일로 회원가입') : tr('이메일로 로그인')}
              </button>
              {!signup && (
                <button className="link mt16" style={{ display: 'block', margin: '16px auto 0', background: 'none' }} disabled={busy} onClick={forgot}>
                  {tr('비밀번호를 잊었어요')}
                </button>
              )}
              <button className="link" style={{ display: 'block', margin: '12px auto 0', background: 'none' }} onClick={() => { setMsg(''); setStep(signup ? 11 : 2) }}>
                {signup ? tr('이미 계정이 있어요') : tr('처음이에요. 회원가입할게요')}
              </button>
            </>
          )}
        </div>
      </>,
    )
  }

  // 10 닉네임
  const t = nick.trim()
  const ok = t.length >= 2 && t.length <= 12 && !nickErr
  return shell(
    <>
      <h1 className="h1">{tr('커뮤니티에서 사용할')}<br />{tr('닉네임을 정해주세요')}</h1>
      <p className="sub">{tr('언제든 프로필에서 바꿀 수 있어요')}</p>
      <input className="input mt24" value={nick} maxLength={12} placeholder={tr('닉네임 (2~12자)')} onChange={(e) => setNick(e.target.value)} aria-label={tr('닉네임')} />
      <p className="sub" style={{ color: nickErr ? 'var(--dec)' : undefined }}>{nickErr || tr('중복되는 닉네임은 사용할 수 없어요')}</p>
    </>,
    <Footer
      label={tr('시작하기')}
      disabled={!ok}
      onClick={async () => {
        // 로그인한 계정이면 서버에 먼저 등록한다. 서버가 같은 닉네임을 한 명에게만 허락한다
        if (authEnabled && s.user && !s.user.id.startsWith('me-')) {
          const r = await claimNickname(s.user.id, t)
          if (!r.ok && r.reason === 'taken') return setServerTaken(true)
          if (!r.ok && r.reason === 'invalid') return show(tr('쓸 수 없는 닉네임이에요'))
        }
        actions.setNickname(t)
        actions.completeOnboarding(profile())
      }}
    />,
    true,
  )
}
