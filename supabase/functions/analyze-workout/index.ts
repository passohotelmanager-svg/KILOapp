import { createSupabaseContext } from "npm:@supabase/server@1.9.2";
import { todayKey } from "../_shared/analysis.ts";
import { DAILY_CALL_LIMIT, MAX_BODY_BYTES } from "../_shared/config.ts";
import { parseWorkoutSummary, ValidationError } from "../_shared/validate.ts";
import { analyzeWithGemini } from "./gemini.ts";

// 운동 기록 AI 분석 (F-09)
// 입력: 최근 운동 기록 요약 (기간, 부위별 볼륨, 세트 수, 운동 시간)
// 출력: 잘한 점, 부족한 부위, 다음 운동 제안 (한글)
//
// Gemini API 키는 Supabase Edge Function 비밀값 GEMINI_API_KEY에서만 읽는다.
// 키 값은 코드, 설정 파일, 로그 어디에도 남기지 않는다.

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

// 앱이 읽는 오류 응답 형식: { code, message }
function errorResponse(code: ErrorCode, message: string): Response {
  return Response.json({ code, message }, { status: STATUS[code] });
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }

    // 1. 로그인 확인 (플랫폼의 verify_jwt에 더해 함수 안에서도 확인)
    const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: "user" });
    if (authError || !ctx?.userClaims?.id) {
      return errorResponse("unauthenticated", "로그인이 필요합니다.");
    }
    // 익명 로그인은 계정을 무한히 만들어 한도를 우회할 수 있어 막는다
    if (ctx.jwtClaims?.is_anonymous === true) {
      return errorResponse("permission-denied", "계정으로 로그인한 뒤 이용할 수 있습니다.");
    }
    const userId = ctx.userClaims.id;

    // 2. 입력 검증. 허용된 필드만 남기므로 이메일, 이름 등은 여기서 걸러진다
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse("invalid-argument", "요청이 너무 큽니다.");
    }
    let summary;
    try {
      summary = parseWorkoutSummary(JSON.parse(raw));
    } catch (e) {
      const message = e instanceof ValidationError ? e.message : "요청 형식이 올바르지 않습니다.";
      return errorResponse("invalid-argument", message);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY 비밀값이 등록되지 않았습니다.");
      return errorResponse("unavailable", "AI 분석을 잠시 사용할 수 없습니다.");
    }

    // 3. 하루 호출 한도 차감. 사용량 표는 관리자 권한(supabaseAdmin)으로만 접근한다
    const day = todayKey();
    const { data: count, error: quotaError } = await ctx.supabaseAdmin.rpc("consume_ai_quota", {
      p_user_id: userId,
      p_day: day,
      p_limit: DAILY_CALL_LIMIT,
    });
    if (quotaError) {
      console.error("호출 횟수 기록 실패", { userId, message: quotaError.message });
      return errorResponse("unavailable", "AI 분석을 잠시 사용할 수 없습니다.");
    }
    if (count === null) {
      return errorResponse(
        "resource-exhausted",
        `오늘 AI 분석은 ${DAILY_CALL_LIMIT}회까지 이용할 수 있습니다. 내일 다시 시도해 주세요.`,
      );
    }

    // 4. Gemini 호출. 실패하면 차감한 횟수를 되돌린다
    try {
      const analysis = await analyzeWithGemini(apiKey, summary);
      return Response.json({
        analysis,
        remaining: DAILY_CALL_LIMIT - (count as number),
        limit: DAILY_CALL_LIMIT,
      });
    } catch (e) {
      // 오류 내용에 키가 섞이지 않도록 메시지만 남긴다
      console.error("Gemini 분석 실패", {
        userId,
        message: e instanceof Error ? e.message : String(e),
      });
      const { error: refundError } = await ctx.supabaseAdmin.rpc("refund_ai_quota", {
        p_user_id: userId,
        p_day: day,
      });
      if (refundError) {
        console.error("호출 횟수 복구 실패", { userId, message: refundError.message });
      }
      return errorResponse("unavailable", "AI 분석을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  },
};
