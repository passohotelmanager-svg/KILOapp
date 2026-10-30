// 커뮤니티: 말풍선 코멘트 (F-48, 7.9)
import { useEffect, useRef, useState } from 'react'
import { actions, useAppState } from '../store'
import { Sheet, TopBar, useLongPress, useToast } from '../components/ui'
import { timeAgo } from '../lib/dates'
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

  const submit = () => {
    const r = actions.postComment(text)
    if (r === 'ok') setText('')
    else if (r === 'banned') show('사용할 수 없는 표현이 포함되어 있어요')
    else if (r === 'long') show('100자까지 쓸 수 있어요')
    else if (r === 'nouser') show('로그인 후 작성할 수 있어요')
  }

  return (
    <>
      <TopBar title="커뮤니티" />
      <div
        className="chat"
        ref={box}
        onScroll={(e) => {
          // 위로 스크롤하면 이전 코멘트를 더 불러온다
          if ((e.currentTarget.scrollTop ?? 0) < 20 && visible < list.length) setVisible((v) => v + 20)
        }}
      >
        {shown.length === 0 && <div className="empty">첫 코멘트를 남겨보세요</div>}
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
        <input value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder="짧은 코멘트를 남겨보세요 (100자)" aria-label="코멘트 입력" />
        <button type="submit" disabled={!text.trim()}>등록</button>
      </form>

      {menu && (
        <Sheet onClose={() => setMenu(null)}>
          {menu.userId === me ? (
            <button className="btn danger" onClick={() => { actions.deleteComment(menu.id); setMenu(null) }}>삭제</button>
          ) : (
            <>
              <button className="btn ghost" onClick={() => { actions.reportComment(menu.id); setMenu(null); show('신고가 접수됐어요') }}>신고</button>
              <button className="btn danger mt8" onClick={() => { actions.blockUser(menu.userId); setMenu(null); show(`${menu.nickname}님을 차단했어요`) }}>이 사용자 차단</button>
            </>
          )}
          <button className="btn line mt8" onClick={() => setMenu(null)}>닫기</button>
        </Sheet>
      )}
      {toast}
    </>
  )
}
