// 커뮤니티 글: 서버 행을 앱의 글 모양으로 바꾸고, "이번 달" 기준(한국 시간 1일 0시)을 계산한다. 서버 호출 없는 순수 함수.
import type { Comment } from '../types'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// 이번 달이 시작된 시각(ms). 한국 시간 기준 1일 0시. 이보다 오래된 글은 지난달 글이라 보이지 않는다.
export function monthStartKst(now: number = Date.now()): number {
  const kst = new Date(now + KST_OFFSET_MS)
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - KST_OFFSET_MS
}

export interface CommentRow {
  id: string
  user_id: string
  nickname: string
  text: string
  created_at: string
  deleted: boolean
  report_count: number
}

export function toComment(r: CommentRow): Comment {
  return {
    id: r.id,
    userId: r.user_id,
    nickname: r.nickname,
    text: r.text,
    at: Date.parse(r.created_at),
    deleted: r.deleted,
    // 신고한 사람 목록은 서버가 알려주지 않고 횟수만 준다. 화면은 개수(3회 이상 숨김)만 쓴다
    reporters: Array.from({ length: r.report_count }, (_, i) => `report-${i}`),
  }
}
