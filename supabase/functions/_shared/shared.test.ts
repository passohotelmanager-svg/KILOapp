// 실행: node --test supabase/functions/_shared/shared.test.ts  (Node 23.6 이상)
// 또는: deno test supabase/functions/_shared/
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPrompt, parseAnalysis, todayKey } from "./analysis.ts";
import { parseWorkoutSummary, ValidationError } from "./validate.ts";

const valid = {
  periodStart: "2026-10-23",
  periodEnd: "2026-10-29",
  sessionCount: 4,
  totalSets: 60,
  totalDurationMin: 240,
  bodyParts: [
    { bodyPart: "가슴", volumeKg: 4200, sets: 20 },
    { bodyPart: "하체", volumeKg: 6100, sets: 24 },
  ],
};

test("허용된 필드만 남기고 개인정보는 버린다", () => {
  const summary = parseWorkoutSummary({
    ...valid,
    email: "user@example.com",
    name: "홍길동",
    bodyParts: [{ ...valid.bodyParts[0], memo: "비밀" }],
  });
  const prompt = buildPrompt(summary);
  assert.equal("email" in summary, false);
  assert.equal("name" in summary, false);
  assert.equal(prompt.includes("user@example.com"), false);
  assert.equal(prompt.includes("홍길동"), false);
  assert.equal(prompt.includes("비밀"), false);
});

test("알 수 없는 부위는 거부한다", () => {
  assert.throws(
    () => parseWorkoutSummary({ ...valid, bodyParts: [{ bodyPart: "목", volumeKg: 1, sets: 1 }] }),
    ValidationError,
  );
});

test("음수, 잘못된 날짜, 긴 기간은 거부한다", () => {
  assert.throws(() => parseWorkoutSummary({ ...valid, totalSets: -1 }), ValidationError);
  assert.throws(() => parseWorkoutSummary({ ...valid, periodEnd: "2026-02-30" }), ValidationError);
  assert.throws(() => parseWorkoutSummary({ ...valid, periodStart: "2026-01-01" }), ValidationError);
});

test("Gemini 응답 형식을 검사한다", () => {
  const ok = parseAnalysis(
    JSON.stringify({
      summary: "꾸준합니다",
      strengths: ["하체 볼륨 증가"],
      weakBodyParts: [{ bodyPart: "등", reason: "기록 없음" }],
      nextWorkout: ["랫풀다운 4세트 10회"],
    }),
  );
  assert.equal(ok.weakBodyParts[0].bodyPart, "등");
  assert.throws(() => parseAnalysis("{}"));
  assert.throws(() => parseAnalysis("not json"));
});

test("한도 날짜는 한국 시간 기준이다", () => {
  // UTC 10월 29일 15시 = 한국 10월 30일 0시
  assert.equal(todayKey(new Date("2026-10-29T15:00:00Z")), "2026-10-30");
  assert.equal(todayKey(new Date("2026-10-29T14:59:00Z")), "2026-10-29");
});
