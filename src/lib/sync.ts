// 로그인한 사용자의 데이터를 서버에 자동으로 저장하고 불러온다.
// - 로그인하면: 서버에 이 계정의 데이터가 있으면 불러오고, 없으면 이 기기의 데이터를 올린다.
// - 그 뒤로 데이터가 바뀔 때마다 잠시 뒤 자동으로 올린다. 다른 기기에서 더 새로 저장했으면 앱으로 돌아올 때 불러온다.
import { useSyncExternalStore } from 'react'
import { authEnabled } from './auth'
import { claimNickname, fetchNickname, fetchUserData, saveUserData, type CloudFail } from './cloud'
import { actions, getState, subscribe } from '../store'
import { chooseInitialSource, signature, toSyncPayload } from './syncData'

export interface SyncStatus {
  // off: 로그인 안 함, loading: 처음 불러오는 중, saving: 올리는 중, saved: 저장됨, error: 실패
  phase: 'off' | 'loading' | 'saving' | 'saved' | 'error'
  error?: CloudFail
  at?: number // 마지막으로 저장한 시각
}

let status: SyncStatus = { phase: 'off' }
const listeners = new Set<() => void>()
function setStatus(next: SyncStatus) {
  status = next
  listeners.forEach((l) => l())
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => status,
  )
}

const PUSH_DELAY_MS = 1500

let activeUser: string | null = null
let ready = false // 처음 불러오기가 끝나 저장할 수 있는 상태
let applying = false
let lastSig = ''
let timer: number | undefined

const realUserId = (): string | null => {
  const u = getState().user
  return u && !u.id.startsWith('me-') ? u.id : null
}

async function push(uid: string): Promise<boolean> {
  window.clearTimeout(timer)
  timer = undefined
  const s = getState()
  const sig = signature(s)
  setStatus({ phase: 'saving', at: status.at })
  const r = await saveUserData(uid, toSyncPayload(s))
  if (!r.ok) {
    setStatus({ phase: 'error', error: r.reason, at: status.at })
    return false
  }
  lastSig = sig
  actions.markSynced(uid)
  setStatus({ phase: 'saved', at: Date.now() })
  return true
}

function schedulePush(uid: string) {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => void push(uid), PUSH_DELAY_MS)
}

// 로그인 직후: 닉네임과 데이터를 서버와 맞춘다
async function initialSync(uid: string) {
  setStatus({ phase: 'loading' })
  // 다른 계정이 쓰던 기기라면 그 데이터를 먼저 비운다 (계정끼리 데이터가 섞이지 않게)
  if (getState().syncedUserId && getState().syncedUserId !== uid) actions.resetData()

  const nick = await fetchNickname()
  if (!nick.ok) return setStatus({ phase: 'error', error: nick.reason })
  if (nick.value) {
    if (getState().user?.nickname !== nick.value) actions.setNickname(nick.value)
  } else if (getState().user?.nickname) {
    // 서버에 닉네임이 없는데 이 기기에는 있으면 서버에 등록한다. 이미 쓰는 사람이 있으면 새로 정하게 비운다
    const c = await claimNickname(uid, getState().user!.nickname)
    if (!c.ok && c.reason === 'taken') actions.setNickname('')
  }

  const server = await fetchUserData()
  if (!server.ok) return setStatus({ phase: 'error', error: server.reason })

  const local = getState()
  // 서버에 있으면 서버 것을 쓴다. 단 이 기기가 같은 계정의 데이터를 갖고 있고 더 새로 바뀌었으면 이 기기 것을 올린다
  const useLocal = chooseInitialSource({ serverUpdatedAt: server.value?.updatedAt ?? null, localUpdatedAt: local.updatedAt, syncedUserId: local.syncedUserId, userId: uid }) === 'push'
  if (useLocal) {
    ready = true
    activeUser = uid
    await push(uid)
  } else {
    applying = true
    actions.applyServerPayload(server.value!, uid)
    applying = false
    lastSig = signature(getState())
    ready = true
    setStatus({ phase: 'saved', at: Date.now() })
  }
}

// 처음 불러오기가 실패한 채로 멈춰 있으면 다시 시도한다
function retryIfFailed(uid: string) {
  if (!ready && status.phase === 'error' && status.error !== 'setup') void initialSync(uid)
}

// 앱으로 돌아왔을 때 다른 기기에서 더 새로 저장했으면 불러온다
async function pullIfNewer(uid: string) {
  if (!ready || timer !== undefined || status.phase === 'saving') return
  const server = await fetchUserData()
  if (!server.ok || !server.value) return
  if (server.value.updatedAt > getState().updatedAt && signature(getState()) === lastSig) {
    applying = true
    actions.applyServerPayload(server.value, uid)
    applying = false
    lastSig = signature(getState())
    setStatus({ phase: 'saved', at: Date.now() })
  }
}

function onChange() {
  const uid = realUserId()
  if (uid !== activeUser) {
    activeUser = uid
    ready = false
    window.clearTimeout(timer)
    timer = undefined
    if (uid) void initialSync(uid)
    else setStatus({ phase: 'off' })
    return
  }
  if (!uid || !ready || applying) return
  if (signature(getState()) !== lastSig) schedulePush(uid)
}

// 앱이 켜질 때 한 번 부른다
export function startSync(): () => void {
  if (!authEnabled) return () => {}
  const unsub = subscribe(onChange)
  const onVisible = () => {
    const uid = realUserId()
    if (!uid) return
    if (document.visibilityState === 'hidden') {
      // 앱을 닫거나 다른 창으로 가기 전에 아직 못 올린 변경을 바로 올린다
      if (ready && timer !== undefined) void push(uid)
    } else {
      retryIfFailed(uid)
      void pullIfNewer(uid)
    }
  }
  const onOnline = () => {
    const uid = realUserId()
    if (uid) retryIfFailed(uid)
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  onChange()
  return () => {
    unsub()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.clearTimeout(timer)
  }
}

// 로그아웃: 아직 못 올린 변경을 올린 뒤, 저장이 확인되면 이 기기의 데이터를 비운다 (공용 기기에서 남지 않게)
export async function logoutAndClear(): Promise<'cleared' | 'kept'> {
  const uid = realUserId()
  // 서버에 저장하는 계정이 아니면(데모 계정) 데이터를 지우지 않고 로그아웃만 한다
  if (!uid) {
    actions.logout()
    return 'kept'
  }
  let saved = false
  if (uid && ready) saved = signature(getState()) === lastSig || (await push(uid))
  const keep = !saved && !!uid
  actions.logout()
  if (!keep) actions.resetData()
  return keep ? 'kept' : 'cleared'
}
