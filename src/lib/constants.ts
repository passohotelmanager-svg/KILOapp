import type { PartCode, SubPartCode, MealCode } from '../types'

// 부위 고정 순서 (누적 그래프 아래 -> 위)
export const PARTS: PartCode[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'abs']

export const PART_NAME: Record<PartCode, string> = {
  chest: '가슴',
  back: '등',
  shoulders: '어깨',
  legs: '하체',
  arms: '팔',
  abs: '복근',
  cardio: '유산소',
}

// 7.2.1 부위 색상 (밝은 화면 기준)
export const PART_COLOR: Record<PartCode, string> = {
  chest: '#D6455D',
  back: '#EB6834',
  shoulders: '#1BAF7A',
  legs: '#EDA100',
  arms: '#E87BA4',
  abs: '#6250D6',
  cardio: '#e5534b',
}

export const SUB_NAME: Record<SubPartCode, string> = {
  lats_mid: '광배·중부',
  lower: '하부',
  traps: '승모근',
  biceps: '이두',
  triceps: '삼두',
  forearms: '전완',
}

export const SUBS_OF: Partial<Record<PartCode, SubPartCode[]>> = {
  back: ['lats_mid', 'lower', 'traps'],
  arms: ['biceps', 'triceps', 'forearms'],
}

export const MEALS: { code: MealCode; name: string }[] = [
  { code: 'breakfast', name: '아침' },
  { code: 'lunch', name: '점심' },
  { code: 'dinner', name: '저녁' },
  { code: 'snack', name: '간식' },
]

export const OTHER_COLOR = '#B0B8C1'

export const DISCLAIMER =
  '본 정보는 일반적인 건강 관리 참고용이며 의료 정보가 아닙니다. 질환이 있거나 식단 변경이 필요한 경우 의사 또는 전문가와 상담하세요.'

export const WEEKLY_HINT: Record<number, string> = {
  1: '가볍게 시작하기 좋은 횟수예요',
  2: '습관을 만들기 시작하는 횟수예요',
  3: '변화를 느끼기 시작하는 좋은 횟수예요',
  4: '꾸준한 성장을 기대할 수 있는 횟수예요',
  5: '부위를 나눠 운동하기 좋은 횟수예요',
  6: '충분한 회복도 함께 챙겨주세요',
  7: '휴식일 없이 무리하지 않도록 주의해주세요',
}

// 비속어 필터 기본 목록 (13장 오픈 이슈 12: 금지어 목록은 운영 중 확정)
export const BANNED_WORDS = ['씨발', '시발', '병신', '개새끼', '지랄', 'fuck', 'shit']

// 활동 수준 표 (8.3)
export const ACTIVITY_LEVELS = [
  { factor: 1.2, name: '비활동', desc: '운동 거의 없음' },
  { factor: 1.375, name: '가벼운 활동', desc: '주 1~3일 가벼운 운동' },
  { factor: 1.55, name: '보통 활동', desc: '주 3~5일 중간 강도 운동' },
  { factor: 1.725, name: '높은 활동', desc: '주 6~7일 고강도 운동' },
  { factor: 1.9, name: '매우 높은 활동', desc: '고강도 운동 + 육체 노동 또는 하루 2회 훈련' },
]
