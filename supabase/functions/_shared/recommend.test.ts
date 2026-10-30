// 실행: node --test supabase/functions/_shared/recommend.test.ts  (Node 23.6 이상)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecommendation, parseRecommendInput } from "./recommend.ts";
import { ValidationError } from "./validate.ts";

const valid = {
  parts: [
    { bodyPart: "가슴", daysSince: 2, sets14d: 20 },
    { bodyPart: "어깨", daysSince: null, sets14d: 0 },
  ],
  candidates: [
    { id: "a", name: "A", bodyPart: "어깨" },
    { id: "b", name: "B", bodyPart: "어깨" },
    { id: "c", name: "C", bodyPart: "어깨" },
    { id: "d", name: "D", bodyPart: "가슴" },
  ],
};

test("허용된 필드만 남긴다", () => {
  const out = parseRecommendInput({ ...valid, email: "x@y.z" }) as unknown as Record<string, unknown>;
  assert.equal("email" in out, false);
});

test("알 수 없는 부위와 중복 id는 거부한다", () => {
  assert.throws(() => parseRecommendInput({ ...valid, parts: [{ bodyPart: "목", daysSince: 1, sets14d: 1 }] }), ValidationError);
  assert.throws(() => parseRecommendInput({ ...valid, candidates: [valid.candidates[0], valid.candidates[0]] }), ValidationError);
});

test("후보에 없는 id와 다른 부위의 운동은 버린다", () => {
  const input = parseRecommendInput(valid);
  const text = JSON.stringify({ bodyPart: "어깨", reason: "r", exerciseIds: ["a", "b", "c", "d", "zzz"] });
  assert.deepEqual(parseRecommendation(text, input).exerciseIds, ["a", "b", "c"]);
});

test("고른 운동이 3개 미만이면 실패한다", () => {
  const input = parseRecommendInput(valid);
  const text = JSON.stringify({ bodyPart: "어깨", reason: "r", exerciseIds: ["a", "zzz"] });
  assert.throws(() => parseRecommendation(text, input));
});
