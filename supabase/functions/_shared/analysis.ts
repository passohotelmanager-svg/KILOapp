import { LIMIT_TIME_ZONE } from "./config.ts";
import type { WorkoutSummary } from "./validate.ts";

// 앱에 돌려주는 분석 결과
export interface WorkoutAnalysis {
  summary: string;
  strengths: string[];
  weakBodyParts: { bodyPart: string; reason: string }[];
  nextWorkout: string[];
}

// Gemini 응답 형식이 기대와 다를 때 던지는 오류
export class AnalysisFormatError extends Error {}

export const SYSTEM_INSTRUCTION = [
  "너는 헬스 기록 앱 KILO의 운동 코치다.",
  "사용자의 최근 운동 기록 요약을 보고 한국어로 짧고 구체적으로 분석한다.",
  "부위 이름은 가슴, 등, 어깨, 하체, 팔, 복근, 유산소 중에서만 쓴다.",
  "의학적 진단이나 부상 치료 조언은 하지 않는다.",
  "이모지와 특수 기호 장식은 쓰지 않는다.",
].join("\n");

// 한국 시간 기준 오늘 날짜를 YYYY-MM-DD로 돌려준다 (하루 호출 한도의 날짜 키)
export function todayKey(now: Date = new Date()): string {
  // en-CA 형식은 YYYY-MM-DD로 출력된다
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// 검증을 마친 요약만으로 프롬프트를 만든다 (개인정보 필드는 존재하지 않음)
export function buildPrompt(summary: WorkoutSummary): string {
  const lines = summary.bodyParts.map(
    (p) => `- ${p.bodyPart}: 볼륨 ${p.volumeKg}kg, ${p.sets}세트`,
  );
  return [
    `기간: ${summary.periodStart} ~ ${summary.periodEnd}`,
    `운동 횟수: ${summary.sessionCount}회`,
    `총 세트 수: ${summary.totalSets}세트`,
    `총 운동 시간: ${summary.totalDurationMin}분`,
    "부위별 기록:",
    ...lines,
    "",
    "위 기록을 보고 잘한 점, 부족한 부위, 다음 운동 제안을 알려줘.",
  ].join("\n");
}

// 문자열 배열인지 확인한다
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

// Gemini 응답 JSON이 약속한 구조인지 확인한다
export function parseAnalysis(text: string | undefined): WorkoutAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text ?? "");
  } catch {
    throw new AnalysisFormatError("분석 결과를 읽을 수 없습니다.");
  }
  const r = parsed as Record<string, unknown>;
  const weak = r?.weakBodyParts;
  const weakValid =
    Array.isArray(weak) &&
    weak.every(
      (w) =>
        typeof w === "object" &&
        w !== null &&
        typeof (w as Record<string, unknown>).bodyPart === "string" &&
        typeof (w as Record<string, unknown>).reason === "string",
    );
  if (
    typeof r?.summary !== "string" ||
    !isStringArray(r.strengths) ||
    !weakValid ||
    !isStringArray(r.nextWorkout)
  ) {
    throw new AnalysisFormatError("분석 결과 형식이 올바르지 않습니다.");
  }
  return {
    summary: r.summary,
    strengths: r.strengths,
    weakBodyParts: weak as WorkoutAnalysis["weakBodyParts"],
    nextWorkout: r.nextWorkout,
  };
}
