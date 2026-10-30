// 커뮤니티 글을 서버와 맞춘다. 로그인한 계정이면 이번 달 글을 불러오고, 다른 사람이 글을 올리면 바로(실시간) 반영한다.
// 매달 1일(한국 시간)에 지난달 글은 서버가 보여주지 않고, 앱은 열려 있어도 1분마다 다시 읽어 새 달로 넘어간다.
import { authEnabled } from './auth'
import { fetchComments, subscribeComments } from './cloud'
import { monthStartKst } from './commentData'
import { actions, getState, subscribe } from '../store'

const REFRESH_MS = 60_000
const DEBOUNCE_MS = 300

let activeUser: string | null = null
let unsubscribeFeed: (() => void) | null = null
let interval: number | undefined
let debounce: number | undefined

const realUserId = (): string | null => {
  const u = getState().user
  return u && !u.id.startsWith('me-') ? u.id : null
}

async function refresh() {
  const r = await fetchComments()
  // 이번 달 글만 보여준다 (서버도 같은 기준으로 거르지만, 달이 바뀐 직후에도 앱이 먼저 정리한다)
  if (r.ok) actions.setComments(r.value.filter((c) => c.at >= monthStartKst()))
}

function refreshSoon() {
  window.clearTimeout(debounce)
  debounce = window.setTimeout(() => void refresh(), DEBOUNCE_MS)
}

function stop() {
  unsubscribeFeed?.()
  unsubscribeFeed = null
  window.clearInterval(interval)
  window.clearTimeout(debounce)
}

function onChange() {
  const uid = realUserId()
  if (uid === activeUser) return
  stop()
  activeUser = uid
  if (!uid) return
  void refresh()
  unsubscribeFeed = subscribeComments(refreshSoon)
  interval = window.setInterval(() => void refresh(), REFRESH_MS)
}

// 앱이 켜질 때 한 번 부른다
export function startCommunitySync(): () => void {
  if (!authEnabled) return () => {}
  const unsub = subscribe(onChange)
  const onVisible = () => {
    if (document.visibilityState === 'visible' && activeUser) void refresh()
  }
  document.addEventListener('visibilitychange', onVisible)
  onChange()
  return () => {
    unsub()
    document.removeEventListener('visibilitychange', onVisible)
    stop()
    activeUser = null
  }
}
