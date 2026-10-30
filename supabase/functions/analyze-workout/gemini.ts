import { GoogleGenAI, Type } from "npm:@google/genai@2.32.0";
import { parseAnalysis, SYSTEM_INSTRUCTION, buildPrompt, type WorkoutAnalysis } from "../_shared/analysis.ts";
import { BODY_PARTS, GEMINI_MODEL } from "../_shared/config.ts";
import type { WorkoutSummary } from "../_shared/validate.ts";

// Gemini가 반드시 이 구조의 JSON으로 답하도록 지정한다
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "전체 평가 한두 문장" },
    strengths: {
      type: Type.ARRAY,
      description: "잘한 점 1~3개",
      items: { type: Type.STRING },
    },
    weakBodyParts: {
      type: Type.ARRAY,
      description: "부족한 부위 0~3개",
      items: {
        type: Type.OBJECT,
        properties: {
          bodyPart: { type: Type.STRING, enum: [...BODY_PARTS] },
          reason: { type: Type.STRING },
        },
        required: ["bodyPart", "reason"],
      },
    },
    nextWorkout: {
      type: Type.ARRAY,
      description: "다음 운동 제안 2~4개 (종목, 세트, 횟수 포함)",
      items: { type: Type.STRING },
    },
  },
  required: ["summary", "strengths", "weakBodyParts", "nextWorkout"],
};

// Gemini를 호출해 분석 결과를 받는다. API 키는 호출하는 쪽에서 비밀값으로 넘겨준다
export async function analyzeWithGemini(
  apiKey: string,
  summary: WorkoutSummary,
): Promise<WorkoutAnalysis> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(summary),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });
  return parseAnalysis(response.text);
}
