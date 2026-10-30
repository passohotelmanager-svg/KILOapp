// 휴식 종료 알람: 소리, 진동, 시스템 알림, 화면 켜짐 유지
// 웹 한계: 브라우저가 완전히 종료되거나 화면이 꺼져 탭이 정지되면 알람이 지연될 수 있다 (PRD 12장 리스크).

let ctx: AudioContext | null = null
let loop: number | undefined
let wake: { release: () => Promise<void> } | null = null

// 사용자 터치 직후 호출해 오디오를 미리 깨운다
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // 오디오 미지원 환경은 진동과 화면 표시로 대체
  }
}

function beep(freq: number, dur: number, vol = 0.5) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.value = freq
  g.gain.setValueAtTime(vol, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  o.connect(g)
  g.connect(ctx.destination)
  o.start()
  o.stop(ctx.currentTime + dur)
}

export function startAlarm() {
  stopAlarm()
  const burst = () => {
    beep(1040, 0.18)
    window.setTimeout(() => beep(1040, 0.18), 240)
    window.setTimeout(() => beep(1320, 0.3), 480)
    try {
      navigator.vibrate?.([300, 120, 300, 120, 500])
    } catch {
      // 진동 미지원
    }
  }
  burst()
  loop = window.setInterval(burst, 1600)
}

export function stopAlarm() {
  if (loop !== undefined) window.clearInterval(loop)
  loop = undefined
  try {
    navigator.vibrate?.(0)
  } catch {
    // 진동 미지원
  }
}

export async function holdScreen() {
  try {
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (nav.wakeLock && !wake) wake = await nav.wakeLock.request('screen')
  } catch {
    wake = null
  }
}

export async function releaseScreen() {
  try {
    await wake?.release()
  } catch {
    // 이미 해제됨
  }
  wake = null
}

export function notifySupported(): boolean {
  return typeof Notification !== 'undefined'
}

// 사용자 동의 후에만 호출한다
export async function requestNotifPermission(): Promise<boolean> {
  if (!notifySupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const r = await Notification.requestPermission()
  return r === 'granted'
}

export function showNotification(title: string, body: string) {
  if (!notifySupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag: 'kilo' })
  } catch {
    // 일부 모바일 브라우저는 생성자 알림을 막는다
  }
}
