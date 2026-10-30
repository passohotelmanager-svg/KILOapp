// Gemini 모델 이름. 모델을 바꿀 때는 이 값 하나만 수정한다.
// 2026-10 기준 공식 문서(ai.google.dev/gemini-api/docs/models)에서 빠르고 저렴한 텍스트 작업용으로 권장하는 모델.
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

// 사용자 1명당 하루 AI 분석 호출 한도
export const DAILY_CALL_LIMIT = 10;

// 하루 경계를 나누는 시간대 (한국 시간 자정 기준으로 한도 초기화)
export const LIMIT_TIME_ZONE = "Asia/Seoul";

// 요청 본문 최대 크기 (바이트). 운동 요약은 이보다 훨씬 작다
export const MAX_BODY_BYTES = 16 * 1024;

// 분석 대상 부위 목록 (PRD 7.2.1 부위 순서 + 유산소)
export const BODY_PARTS = ["가슴", "등", "어깨", "하체", "팔", "복근", "유산소"] as const;
export type BodyPart = (typeof BODY_PARTS)[number];
