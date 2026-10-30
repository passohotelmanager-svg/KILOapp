import { BODY_PARTS, type BodyPart } from "./config.ts";

// 부위별 운동 요약
export interface BodyPartSummary {
  bodyPart: BodyPart;
  volumeKg: number;
  sets: number;
}

// Gemini로 보내는 운동 기록 요약.
// 여기에 정의된 필드만 골라서 새 객체로 만들기 때문에, 앱이 이메일이나 이름 같은 값을 함께 보내도 Gemini에는 전달되지 않는다.
export interface WorkoutSummary {
  periodStart: string;
  periodEnd: string;
  sessionCount: number;
  totalSets: number;
  totalDurationMin: number;
  bodyParts: BodyPartSummary[];
}

// 입력 검증 실패 시 던지는 오류
export class ValidationError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIOD_DAYS = 31;

// 0 이상 max 이하의 유한한 숫자인지 확인한다
function readNumber(value: unknown, name: string, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
    throw new ValidationError(`${name} 값이 올바르지 않습니다.`);
  }
  return value;
}

// YYYY-MM-DD 형식의 실제 날짜인지 확인한다
function readDate(value: unknown, name: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new ValidationError(`${name} 날짜 형식이 올바르지 않습니다.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ValidationError(`${name} 날짜가 존재하지 않습니다.`);
  }
  return value;
}

// 앱에서 받은 값을 검증하고, 허용된 필드만 담은 요약 객체를 새로 만든다
export function parseWorkoutSummary(data: unknown): WorkoutSummary {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("요청 형식이 올바르지 않습니다.");
  }
  const input = data as Record<string, unknown>;

  const periodStart = readDate(input.periodStart, "시작일");
  const periodEnd = readDate(input.periodEnd, "종료일");
  const days = (Date.parse(periodEnd) - Date.parse(periodStart)) / 86_400_000;
  if (days < 0 || days > MAX_PERIOD_DAYS) {
    throw new ValidationError(`기간은 ${MAX_PERIOD_DAYS}일 이내여야 합니다.`);
  }

  if (!Array.isArray(input.bodyParts) || input.bodyParts.length === 0) {
    throw new ValidationError("부위별 기록이 없습니다.");
  }
  if (input.bodyParts.length > BODY_PARTS.length) {
    throw new ValidationError("부위 개수가 너무 많습니다.");
  }

  const seen = new Set<BodyPart>();
  const bodyParts = input.bodyParts.map((item): BodyPartSummary => {
    if (typeof item !== "object" || item === null) {
      throw new ValidationError("부위별 기록 형식이 올바르지 않습니다.");
    }
    const row = item as Record<string, unknown>;
    const bodyPart = row.bodyPart;
    if (typeof bodyPart !== "string" || !(BODY_PARTS as readonly string[]).includes(bodyPart)) {
      throw new ValidationError("알 수 없는 부위가 포함되어 있습니다.");
    }
    if (seen.has(bodyPart as BodyPart)) {
      throw new ValidationError("같은 부위가 중복되어 있습니다.");
    }
    seen.add(bodyPart as BodyPart);
    return {
      bodyPart: bodyPart as BodyPart,
      volumeKg: Math.round(readNumber(row.volumeKg, "볼륨", 10_000_000)),
      sets: Math.round(readNumber(row.sets, "세트 수", 10_000)),
    };
  });

  return {
    periodStart,
    periodEnd,
    sessionCount: Math.round(readNumber(input.sessionCount, "운동 횟수", 1_000)),
    totalSets: Math.round(readNumber(input.totalSets, "총 세트 수", 10_000)),
    totalDurationMin: Math.round(readNumber(input.totalDurationMin, "운동 시간", 100_000)),
    bodyParts,
  };
}
