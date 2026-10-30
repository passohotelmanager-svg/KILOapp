import { createSupabaseContext } from "npm:@supabase/server@1.9.2";
import { todayKey } from "../_shared/analysis.ts";
import { DAILY_CALL_LIMIT, MAX_BODY_BYTES } from "../_shared/config.ts";
import { parseRecommendInput } from "../_shared/recommend.ts";
import { ValidationError } from "../_shared/validate.ts";
import { recommendWithGemini } from "./gemini.ts";

// 오늘의 운동 AI 추천
// 입력: 부위별 최근 상태와 운동 후보 목록
// 출력: { recommendation: { bodyPart, reason, exerciseIds }, remaining, limit }
//
// 인증, 하루 호출 한도(analyze-workout과 같은 표를 함께 쓴다), 오류 응답 형식은 analyze-workout과 같다.
// Gemini API 키는 비밀값 GEMINI_API_KEY에서만 읽고 어디에도 남기지 않는다.

type ErrorCode =
  | "unauthenticated"
  | "permission-denied"
  | "invalid-argument"
  | "resource-exhausted"
  | "unavailable";

const STATUS: Record<ErrorCode, number> = {
  "unauthenticated": 401,
  "permission-denied": 403,
  "invalid-argument": 400,
  "resource-exhausted": 429,
  "unavailable": 503,
};

function errorResponse(code: ErrorCode, message: string): Response {
  return Response.json({ code, message }, { status: STATUS[code] });
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: "user" });
    if (authError || !ctx?.userClaims?.id) {
      return errorResponse("unauthenticated", "로그인이 필요합니다.");
    }
    if (ctx.jwtClaims?.is_anonymous === true) {
      return errorResponse("permission-denied", "계정으로 로그인한 뒤 이용할 수 있습니다.");
    }
    const userId = ctx.userClaims.id;

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse("invalid-argument", "요청이 너무 큽니다.");
    }
    let input;
    try {
      input = parseRecommendInput(JSON.parse(raw));
    } catch (e) {
      const message = e instanceof ValidationError ? e.message : "요청 형식이 올바르지 않습니다.";
      return errorResponse("invalid-argument", message);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY 비밀값이 등록되지 않았습니다.");
      return errorResponse("unavailable", "AI 추천을 잠시 사용할 수 없습니다.");
    }

    const day = todayKey();
    const { data: count, error: quotaError } = await ctx.supabaseAdmin.rpc("consume_ai_quota", {
      p_user_id: userId,
      p_day: day,
      p_limit: DAILY_CALL_LIMIT,
    });
    if (quotaError) {
      console.error("호출 횟수 기록 실패", { userId, message: quotaError.message });
      return errorResponse("unavailable", "AI 추천을 잠시 사용할 수 없습니다.");
    }
    if (count === null) {
      return errorResponse(
        "resource-exhausted",
        `오늘 AI 이용은 ${DAILY_CALL_LIMIT}회까지 가능합니다. 내일 다시 시도해 주세요.`,
      );
    }

    try {
      const recommendation = await recommendWithGemini(apiKey, input);
      return Response.json({
        recommendation,
        remaining: DAILY_CALL_LIMIT - (count as number),
        limit: DAILY_CALL_LIMIT,
      });
    } catch (e) {
      console.error("Gemini 추천 실패", { userId, message: e instanceof Error ? e.message : String(e) });
      const { error: refundError } = await ctx.supabaseAdmin.rpc("refund_ai_quota", {
        p_user_id: userId,
        p_day: day,
      });
      if (refundError) {
        console.error("호출 횟수 복구 실패", { userId, message: refundError.message });
      }
      return errorResponse("unavailable", "AI 추천을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  },
};
