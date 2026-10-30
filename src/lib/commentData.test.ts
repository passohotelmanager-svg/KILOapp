import { describe, expect, it } from 'vitest'
import { monthStartKst, toComment } from './commentData'

describe('커뮤니티 이번 달 기준', () => {
  it('한국 시간 1일 0시가 이번 달의 시작이다', () => {
    // 2026-10-15 12:00 KST -> 2026-10-01 00:00 KST = 2026-09-30 15:00 UTC
    expect(new Date(monthStartKst(Date.parse('2026-10-15T03:00:00Z'))).toISOString()).toBe('2026-09-30T15:00:00.000Z')
  })

  it('한국 시간으로 11월 1일이 되면 다음 달로 넘어간다 (UTC로는 아직 10월 31일)', () => {
    const justBefore = Date.parse('2026-10-31T14:59:59Z') // 10-31 23:59:59 KST
    const justAfter = Date.parse('2026-10-31T15:00:00Z') // 11-01 00:00:00 KST
    expect(new Date(monthStartKst(justBefore)).toISOString()).toBe('2026-09-30T15:00:00.000Z')
    expect(new Date(monthStartKst(justAfter)).toISOString()).toBe('2026-10-31T15:00:00.000Z')
  })

  it('연말에도 다음 해 1월로 넘어간다', () => {
    expect(new Date(monthStartKst(Date.parse('2026-12-31T15:00:00Z'))).toISOString()).toBe('2026-12-31T15:00:00.000Z')
  })
})

describe('서버 글을 앱의 글로 바꾸기', () => {
  it('신고 횟수만큼 신고 항목을 만든다', () => {
    const c = toComment({
      id: 'a', user_id: 'u', nickname: '닉', text: '안녕', created_at: '2026-10-30T01:00:00Z', deleted: false, report_count: 3,
    })
    expect(c.reporters).toHaveLength(3)
    expect(c.userId).toBe('u')
    expect(c.at).toBe(Date.parse('2026-10-30T01:00:00Z'))
  })
})
