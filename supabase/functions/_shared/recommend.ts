import { BODY_PARTS, type BodyPart } from "./config.ts";
import { ValidationError } from "./validate.ts";

// 추천 요청에 담기는 부위별 최근 상태. daysSince가 null이면 기록이 없는 부위
export interface PartStatus {
  bodyPart: BodyPart;
  daysSince: number | null;
  sets14d: number;
}

// Gemini가 고를 수 있는 운동 후보. 이름과 부위만 보내고 개인정보는 없다
export interface Candidate {
  id: string;
  name: string;
  bodyPart: BodyPart;
}

export interface RecommendInput {
  parts: PartStatus[];
  candidates: Candidate[];
}

export interface Recommendation {
  bodyPart: BodyPart;
  reason: string;
  exerciseIds: string[];
}

export const MAX_CANDIDATES = 120;
export const PICK_MIN = 3;
export const PICK_MAX = 6;

function isBodyPart(v: unknown): v is BodyPart {
  return typeof v === "string" && (BODY_PARTS as readonly string[]).includes(v);
}

function readCount(v: unknown, name: string, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) {
    throw new ValidationError(`${name} 값이 올바르지 않습니다.`);
  }
  return Math.round(v);
}

// 앱에서 받은 값을 검증하고 허용된 필드만 담아 새 객체로 만든다
export function parseRecommendInput(data: unknown): RecommendInput {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("요청 형식이 올바르지 않습니다.");
  }
  const input = data as Record<string, unknown>;
  if (!Array.isArray(input.parts) || input.parts.length === 0 || input.parts.length > BODY_PARTS.length) {
    throw new ValidationError("부위 정보가 올바르지 않습니다.");
  }
  if (!Array.isArray(input.candidates) || input.candidates.length === 0 || input.candidates.length > MAX_CANDIDATES) {
    throw new ValidationError("운동 후보가 올바르지 않습니다.");
  }

  const parts = input.parts.map((p): PartStatus => {
    const row = (p ?? {}) as Record<string, unknown>;
    if (!isBodyPart(row.bodyPart)) throw new ValidationError("알 수 없는 부위가 포함되어 있습니다.");
    return {
      bodyPart: row.bodyPart,
      daysSince: row.daysSince === null ? null : readCount(row.daysSince, "경과 일수", 100_000),
      sets14d: readCount(row.sets14d, "세트 수", 10_000),
    };
  });

  const seen = new Set<string>();
  const candidates = input.candidates.map((c): Candidate => {
    const row = (c ?? {}) as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id.length === 0 || row.id.length > 64 || seen.has(row.id)) {
      throw new ValidationError("운동 후보 id가 올바르지 않습니다.");
    }
    if (typeof row.name !== "string" || row.name.length === 0 || row.name.length > 80) {
      throw new ValidationError("운동 이름이 올바르지 않습니다.");
    }
    if (!isBodyPart(row.bodyPart)) throw new ValidationError("알 수 없는 부위가 포함되어 있습니다.");
    seen.add(row.id);
    return { id: row.id, name: row.name, bodyPart: row.bodyPart };
  });

  return { parts, candidates };
}

export const RECOMMEND_SYSTEM_INSTRUCTION = [
  "너는 헬스 기록 앱 KILO의 운동 코치다.",
  "부위별 최근 운동 상태를 보고 오늘 할 운동 부위 하나와, 후보 목록 안의 운동 3~6개를 고른다.",
  "운동 id는 반드시 후보 목록에 있는 값만 쓰고, 고른 부위의 운동만 고른다.",
  "이유는 한국어로 한 문장, 이모지와 특수 기호 장식은 쓰지 않는다.",
  "의학적 진단이나 부상 치료 조언은 하지 않는다.",
].join("\n");

export function buildRecommendPrompt(input: RecommendInput): string {
  const parts = input.parts.map(
    (p) => `- ${p.bodyPart}: ${p.daysSince === null ? "기록 없음" : `${p.daysSince}일 전`}, 최근 14일 ${p.sets14d}세트`,
  );
  const cands = input.candidates.map((c) => `${c.id} | ${c.bodyPart} | ${c.name}`);
  return ["부위별 상태:", ...parts, "", "운동 후보 (id | 부위 | 이름):", ...cands, "", "오늘의 운동을 추천해줘."].join("\n");
}

// Gemini 응답을 검증한다. 후보에 없는 id, 다른 부위의 운동은 버린다
export function parseRecommendation(text: string | undefined, input: RecommendInput): Recommendation {
  let r: Record<string, unknown>;
  try {
    r = JSON.parse(text ?? "") as Record<string, unknown>;
  } catch {
    throw new Error("추천 결과를 읽을 수 없습니다.");
  }
  if (!isBodyPart(r?.bodyPart) || typeof r.reason !== "string" || !Array.isArray(r.exerciseIds)) {
    throw new Error("추천 결과 형식이 올바르지 않습니다.");
  }
  const byId = new Map(input.candidates.map((c) => [c.id, c]));
  const ids = [...new Set(r.exerciseIds.filter((x): x is string => typeof x === "string"))]
    .filter((id) => byId.get(id)?.bodyPart === r.bodyPart)
    .slice(0, PICK_MAX);
  if (ids.length < PICK_MIN) throw new Error("추천된 운동이 부족합니다.");
  return { bodyPart: r.bodyPart, reason: r.reason, exerciseIds: ids };
}
