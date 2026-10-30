// 커뮤니티: 말풍선 코멘트 (F-48, 7.9)
import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { actions, useAppState } from '../store'
import { Sheet, TopBar, useLongPress, useToast } from '../components/ui'
import { monthLabel, timeAgo } from '../lib/dates'
import { authEnabled } from '../lib/auth'
import type { Comment } from '../types'

function Bubble({ c, mine, now, onMenu }: { c: Comment; mine: boolean; now: number; onMenu: (c: Comment) => void }) {
  const lp = useLongPress(() => onMenu(c))
  return (
    <div className={`msg ${mine ? 'me' : ''}`}>
      {!mine && <span className="nick">{c.nickname}</span>}
      <div className="line">
        <div className="bub" {...lp}>{c.text}</div>
        <span className="ago">{timeAgo(c.at, now)}</span>
      </div>
    </div>
  )
}

export function Community() {
  const s = useAppState()
  const [text, setText] = useState('')
  const [now, setNow] = useState(Date.now())
  const [menu, setMenu] = useState<Comment | null>(null)
  const [visible, setVisible] = useState(30)
  const [sending, setSending] = useState(false)
  const [toast, show] = useToast()
  const box = useRef<HTMLDivElement>(null)
  const me = s.user?.id

  // 경과 시간 1분마다 갱신
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // 숨김 조건: 삭제됨, 신고 3회 누적, 내가 차단한 사용자
  const list = s.comments
    .filter((c) => !c.deleted && c.reporters.length < 3 && !s.blocks.includes(c.userId))
    .sort((a, b) => a.at - b.at)
  const shown = list.slice(-visible)

  const lastId = shown[shown.length - 1]?.id
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [lastId])

  const submit = async () => {
    if (sending) return
    setSending(true)
    const r = await actions.postComment(text)
    setSending(false)
    if (r === 'ok') setText('')
    else if (r === 'rate') show(tr('너무 빨리 보내고 있어요. 잠시 후 다시 시도해주세요'))
    else if (r === 'failed') show(tr('보내지 못했어요. 잠시 후 다시 시도해주세요'))
    else if (r === 'banned') show(tr('사용할 수 없는 표현이 포함되어 있어요'))
    else if (r === 'long') show(tr('100자까지 쓸 수 있어요'))
    else if (r === 'nouser') show(tr('로그인 후 작성할 수 있어요'))
  }

  return (
    <>
      <TopBar title={tr('커뮤니티')} />
      {authEnabled && !!s.user && !s.user.id.startsWith('me-') && (
        <p className="muted center" style={{ fontSize: 12, margin: '0 0 6px' }}>{tr('{0} 대화예요 · 매달 1일에 새로 시작해요', [monthLabel(new Date())])}</p>
      )}
      <div
        className="chat"
        ref={box}
        onScroll={(e) => {
          // 위로 스크롤하면 이전 코멘트를 더 불러온다
          if ((e.currentTarget.scrollTop ?? 0) < 20 && visible < list.length) setVisible((v) => v + 20)
        }}
      >
        {shown.length === 0 && <div className="empty">{tr('첫 코멘트를 남겨보세요')}</div>}
        {shown.map((c) => (
          <Bubble key={c.id} c={c} mine={c.userId === me} now={now} onMenu={setMenu} />
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder={tr('짧은 코멘트를 남겨보세요 (100자)')} aria-label={tr('코멘트 입력')} />
        <button type="submit" disabled={!text.trim()}>{tr('등록')}</button>
      </form>

      {menu && (
        <Sheet onClose={() => setMenu(null)}>
          {menu.userId === me ? (
            <button className="btn danger" onClick={() => { actions.deleteComment(menu.id); setMenu(null) }}>{tr('삭제')}</button>
          ) : (
            <>
              <button className="btn ghost" onClick={() => { actions.reportComment(menu.id); setMenu(null); show(tr('신고가 접수됐어요')) }}>{tr('신고')}</button>
              <button className="btn danger mt8" onClick={() => { actions.blockUser(menu.userId); setMenu(null); show(tr('{0}님을 차단했어요', [menu.nickname])) }}>{tr('이 사용자 차단')}</button>
            </>
          )}
          <button className="btn line mt8" onClick={() => setMenu(null)}>{tr('닫기')}</button>
        </Sheet>
      )}
      {toast}
    </>
  )
}
