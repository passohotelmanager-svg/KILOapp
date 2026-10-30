import { GoogleGenAI, Type } from "npm:@google/genai@2.32.0";
import {
  buildRecommendPrompt,
  parseRecommendation,
  PICK_MAX,
  PICK_MIN,
  RECOMMEND_SYSTEM_INSTRUCTION,
  type RecommendInput,
  type Recommendation,
} from "../_shared/recommend.ts";
import { BODY_PARTS, GEMINI_MODEL } from "../_shared/config.ts";

// Gemini가 반드시 이 구조의 JSON으로 답하도록 지정한다
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    bodyPart: { type: Type.STRING, enum: [...BODY_PARTS], description: "오늘 운동할 부위" },
    reason: { type: Type.STRING, description: "이 부위를 고른 이유 한 문장" },
    exerciseIds: {
      type: Type.ARRAY,
      description: `후보 목록에 있는 운동 id ${PICK_MIN}~${PICK_MAX}개`,
      items: { type: Type.STRING },
    },
  },
  required: ["bodyPart", "reason", "exerciseIds"],
};

export async function recommendWithGemini(apiKey: string, input: RecommendInput): Promise<Recommendation> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildRecommendPrompt(input),
    config: {
      systemInstruction: RECOMMEND_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 512,
    },
  });
  return parseRecommendation(response.text, input);
}
