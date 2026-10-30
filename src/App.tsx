import { lazy, tr } from './lib/i18n'
import { useEffect, useState } from 'react'
import { NavProvider, useNav, type Tab } from './nav'
import { actions, useAppState, activeSession } from './store'
import { Icon } from './components/Icon'
import { RestEngine, openRestScreen, useRestLeft } from './components/RestEngine'
import { mmss } from './lib/format'
import { ymd } from './lib/dates'
import { publishDeveloperVolume, toDeveloperVolume } from './lib/developerVolume'
import { authEnabled, startAuthSync } from './lib/auth'
import { startSync, useSyncStatus } from './lib/sync'
import { startCommunitySync } from './lib/communitySync'
import { showNotification } from './lib/alarm'
import { Onboarding } from './screens/Onboarding'
import { Today } from './screens/Today'
import { Workout } from './screens/Workout'
import { AiRecommend } from './screens/AiRecommend'
import { Picker } from './screens/Picker'
import { Routines, RoutineEdit } from './screens/Routines'
import { Analysis, AnalysisDetail } from './screens/Analysis'
import { Nutrition, MealEdit, MealAlbum } from './screens/Nutrition'
import { Community } from './screens/Community'
import { Profile, Settings, Account, BodyInfo, Memos } from './screens/Profile'

const TABS: { tab: Tab; label: string; icon: string }[] = lazy([
  { tab: 'today', label: '투데이', icon: 'today' },
  { tab: 'community', label: '커뮤니티', icon: 'community' },
  { tab: 'analysis', label: '분석', icon: 'analysis' },
  { tab: 'profile', label: '프로필', icon: 'profile' },
])

function Screen() {
  const { stack } = useNav()
  const r = stack[stack.length - 1]
  const p = r.params ?? {}
  switch (r.name) {
    case 'today': return <Today />
    case 'workout': return <Workout />
    case 'aiRecommend': return <AiRecommend />
    case 'picker': return <Picker mode={(p.mode as 'session' | 'routine' | 'library') ?? 'library'} />
    case 'routines': return <Routines />
    case 'routineEdit': return <RoutineEdit id={p.id as string | undefined} />
    case 'nutrition': return <Nutrition date={p.date as string | undefined} />
    case 'mealEdit': return <MealEdit meal={p.meal as never} date={p.date as string} />
    case 'album': return <MealAlbum />
    case 'community': return <Community />
    case 'analysis': return <Analysis />
    case 'detail': return <AnalysisDetail kind={p.kind as string} />
    case 'profile': return <Profile />
    case 'settings': return <Settings />
    case 'account': return <Account />
    case 'bodyInfo': return <BodyInfo />
    case 'memos': return <Memos />
    default: return null
  }
}

function MiniBar() {
  const s = useAppState()
  const nav = useNav()
  const left = useRestLeft()
  const ss = activeSession(s)
  const top = nav.stack[nav.stack.length - 1].name
  if (!ss || (nav.tab === 'today' && top === 'workout')) return null
  return (
    <button className="minibar" onClick={nav.openWorkout}>
      <span>{tr('운동 중')}</span>
      <small>{left !== null ? tr('휴식 남은 시간 {0}', [mmss(left)]) : tr('기록 화면으로 돌아가기')}</small>
    </button>
  )
}

// 정해진 요일, 시각에 앱이 열려 있으면 운동 리마인더 알림 (F-47)
function useReminder() {
  const s = useAppState()
  useEffect(() => {
    if (!s.settings.remindOn) return
    const t = window.setInterval(() => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const today = ymd(now)
      const st = s.settings
      if (st.remindDays.includes(now.getDay()) && hhmm === st.remindTime && s.lastReminderDate !== today) {
        actions.setReminderDate(today)
        if (st.notifConsent) showNotification('KILO', tr('오늘 운동할 시간이에요'))
      }
    }, 20_000)
    return () => window.clearInterval(t)
  }, [s.settings, s.lastReminderDate])
}

// 개발자 모드일 때 운동 기록이 바뀌면 잠시 뒤 개발자 볼륨을 갱신한다 (같은 값이면 다시 올리지 않는다)
let lastPublished = ''
function useDeveloperPublish() {
  const s = useAppState()
  useEffect(() => {
    if (!s.settings.developerMode) return
    const timer = window.setTimeout(() => {
      const weightKg = [...s.bodyLog].reverse().find((l) => l.weightKg)?.weightKg ?? s.profile?.weightKg ?? 0
      const d = toDeveloperVolume(s, weightKg)
      if (!d) return
      const body = JSON.stringify(d)
      if (body === lastPublished) return
      publishDeveloperVolume(d).then((ok) => {
        if (ok) lastPublished = body
      })
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [s.sessions, s.bodyLog, s.profile, s.settings.developerMode]) // eslint-disable-line react-hooks/exhaustive-deps
}

function Main() {
  const nav = useNav()
  useReminder()
  useDeveloperPublish()
  return (
    <div className="shell">
      <Screen key={nav.scrollKey} />
      <MiniBar />
      <nav className="footer" aria-label={tr('주요 메뉴')}>
        {TABS.map((t) => (
          <button key={t.tab} className={nav.tab === t.tab ? 'on' : ''} onClick={() => nav.switchTab(t.tab)} aria-current={nav.tab === t.tab ? 'page' : undefined}>
            <Icon name={t.icon} size={24} />
            {t.label}
          </button>
        ))}
      </nav>
      <RestEngine />
    </div>
  )
}

export function App() {
  const s = useAppState()
  // 로그인 상태를 읽어 오는 동안(로그인 창에서 돌아온 직후 포함)에는 처음 화면이 잠깐 보이지 않게 비워 둔다
  const [authReady, setAuthReady] = useState(false)
  useEffect(() => startAuthSync((u) => actions.applyAuthUser(u), () => setAuthReady(true)), [])
  useEffect(() => startSync(), [])
  useEffect(() => startCommunitySync(), [])
  const sync = useSyncStatus()
  // 로그인 직후 서버의 내 데이터를 불러오는 동안에는 화면을 비워 둔다 (처음 화면이 잠깐 보이지 않게)
  const loadingMine = authEnabled && !!s.user && !s.user.id.startsWith('me-') && sync.phase === 'loading'
  if (!authReady || loadingMine) return <div className="shell" />
  // 온보딩, 로그인, 닉네임 설정이 끝나기 전에는 푸터를 숨긴다
  if (!s.onboarded || !s.user || !s.user.nickname) {
    return (
      <div className="shell">
        <Onboarding />
      </div>
    )
  }
  return (
    <NavProvider>
      <Main />
    </NavProvider>
  )
}

export { openRestScreen }
