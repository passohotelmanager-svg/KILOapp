// 탭별 화면 스택 내비게이션. 탭마다 마지막 화면과 스크롤 위치를 기억한다 (PRD 7.4).
import { tr } from './lib/i18n'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type Tab = 'today' | 'community' | 'analysis' | 'profile'

export interface Route {
  name: string
  params?: Record<string, unknown>
}

interface Nav {
  tab: Tab
  stack: Route[]
  push: (name: string, params?: Record<string, unknown>) => void
  pop: () => void
  switchTab: (t: Tab) => void
  openWorkout: () => void
  scrollKey: string
  scrolls: React.MutableRefObject<Record<string, number>>
}

const NavCtx = createContext<Nav | null>(null)

const ROOT: Record<Tab, Route> = {
  today: { name: 'today' },
  community: { name: 'community' },
  analysis: { name: 'analysis' },
  profile: { name: 'profile' },
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('today')
  const [stacks, setStacks] = useState<Record<Tab, Route[]>>({
    today: [ROOT.today],
    community: [ROOT.community],
    analysis: [ROOT.analysis],
    profile: [ROOT.profile],
  })
  const scrolls = useRef<Record<string, number>>({})

  const push = useCallback(
    (name: string, params?: Record<string, unknown>) => {
      setStacks((s) => ({ ...s, [tab]: [...s[tab], { name, params }] }))
    },
    [tab],
  )
  const pop = useCallback(() => {
    setStacks((s) => (s[tab].length > 1 ? { ...s, [tab]: s[tab].slice(0, -1) } : s))
  }, [tab])
  const switchTab = useCallback(
    (t: Tab) => {
      // 이미 선택된 탭을 다시 누르면 첫 화면으로 돌아간다
      if (t === tab) setStacks((s) => ({ ...s, [t]: [ROOT[t]] }))
      setTab(t)
    },
    [tab],
  )
  // 운동 기록 화면으로 이동 (현재 탭 스택 위에 올린다)
  const openWorkout = useCallback(() => {
    setStacks((s) => {
      const cur = s.today
      if (cur[cur.length - 1]?.name === 'workout') return s
      return { ...s, today: [...cur.filter((r) => r.name !== 'workout'), { name: 'workout' }] }
    })
    setTab('today')
  }, [])

  const stack = stacks[tab]
  const scrollKey = `${tab}:${stack.length}:${stack[stack.length - 1].name}`
  const value = useMemo<Nav>(
    () => ({ tab, stack, push, pop, switchTab, openWorkout, scrollKey, scrolls }),
    [tab, stack, push, pop, switchTab, openWorkout, scrollKey],
  )
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>
}

export function useNav(): Nav {
  const n = useContext(NavCtx)
  if (!n) throw new Error(tr('NavProvider 밖에서 사용할 수 없습니다'))
  return n
}
