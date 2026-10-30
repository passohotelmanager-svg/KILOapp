import type { PartCode, SubPartCode, MealCode } from '../types'
import { lazy } from './i18n'

// 부위 고정 순서 (누적 그래프 아래 -> 위)
export const PARTS: PartCode[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'abs']

// 서버(AI 추천)와 주고받는 부위 이름은 언어와 상관없이 항상 한국어다
export const PART_NAME_KO: Record<PartCode, string> = {
  chest: '가슴',
  back: '등',
  shoulders: '어깨',
  legs: '하체',
  arms: '팔',
  abs: '복근',
  cardio: '유산소',
}

export const PART_NAME: Record<PartCode, string> = lazy(PART_NAME_KO)

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

export const SUB_NAME: Record<SubPartCode, string> = lazy({
  lats_mid: '광배·중부',
  lower: '하부',
  traps: '승모근',
  biceps: '이두',
  triceps: '삼두',
  forearms: '전완',
})

export const SUBS_OF: Partial<Record<PartCode, SubPartCode[]>> = {
  back: ['lats_mid', 'lower', 'traps'],
  arms: ['biceps', 'triceps', 'forearms'],
}

export const MEALS: { code: MealCode; name: string }[] = lazy([
  { code: 'breakfast', name: '아침' },
  { code: 'lunch', name: '점심' },
  { code: 'dinner', name: '저녁' },
  { code: 'snack', name: '간식' },
])

export const OTHER_COLOR = '#B0B8C1'

export const DISCLAIMER =
  '본 정보는 일반적인 건강 관리 참고용이며 의료 정보가 아닙니다. 질환이 있거나 식단 변경이 필요한 경우 의사 또는 전문가와 상담하세요.'

export const WEEKLY_HINT: Record<number, string> = lazy({
  1: '가볍게 시작하기 좋은 횟수예요',
  2: '습관을 만들기 시작하는 횟수예요',
  3: '변화를 느끼기 시작하는 좋은 횟수예요',
  4: '꾸준한 성장을 기대할 수 있는 횟수예요',
  5: '부위를 나눠 운동하기 좋은 횟수예요',
  6: '충분한 회복도 함께 챙겨주세요',
  7: '휴식일 없이 무리하지 않도록 주의해주세요',
})

// 비속어 필터 기본 목록 (13장 오픈 이슈 12: 금지어 목록은 운영 중 확정)
export const BANNED_WORDS = ['씨발', '시발', '병신', '개새끼', '지랄', 'fuck', 'shit']

// 활동 수준 표 (8.3)
export const ACTIVITY_LEVELS = lazy([
  { factor: 1.2, name: '비활동', desc: '운동 거의 없음' },
  { factor: 1.375, name: '가벼운 활동', desc: '주 1~3일 가벼운 운동' },
  { factor: 1.55, name: '보통 활동', desc: '주 3~5일 중간 강도 운동' },
  { factor: 1.725, name: '높은 활동', desc: '주 6~7일 고강도 운동' },
  { factor: 1.9, name: '매우 높은 활동', desc: '고강도 운동 + 육체 노동 또는 하루 2회 훈련' },
])

// 유산소 운동별 MET (Compendium of Physical Activities 기준 대표값, 중간 강도).
// 소모 칼로리(kcal) = MET x 체중(kg) x 시간(h). 속도, 경사, 개인차는 반영하지 않은 추정치다.
export const CARDIO_MET: Record<string, number> = {
  'cardio-01': 9.8, // 러닝머신 달리기
  'cardio-02': 3.5, // 러닝머신 걷기
  'cardio-03': 6.0, // 인클라인 걷기
  'cardio-04': 9.8, // 야외 달리기
  'cardio-05': 3.8, // 야외 걷기
  'cardio-06': 6.8, // 실내 사이클
  'cardio-07': 8.5, // 스피닝
  'cardio-08': 5.5, // 리컴번트 사이클
  'cardio-09': 7.5, // 야외 자전거
  'cardio-10': 5.0, // 일립티컬
  'cardio-11': 7.0, // 로잉머신
  'cardio-12': 8.0, // 스키 에르그
  'cardio-13': 8.5, // 에어 바이크
  'cardio-14': 6.0, // 수영
  'cardio-15': 6.5, // 등산
  'cardio-16': 9.0, // 천국의 계단
  'cardio-17': 9.0, // 스텝밀
  'cardio-18': 11.8, // 줄넘기
  'cardio-19': 8.0, // 버피
  'cardio-20': 8.0, // 배틀 로프
}
// 목록에 없는 유산소(직접 추가한 운동 등)에 쓰는 기본값
export const CARDIO_MET_DEFAULT = 6.0

// 근력 운동 MET (Compendium of Physical Activities, 웨이트 트레이닝 중간~높은 강도 대표값).
// 근력 운동 시간은 세션 길이에서 유산소 시간을 뺀 값을 쓴다.
export const STRENGTH_MET = 5.0
