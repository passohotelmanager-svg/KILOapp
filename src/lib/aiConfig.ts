// AI 추천 서버 접속 정보. 둘 다 앱에 들어가도 되는 공개 값이다 (Gemini 키와 secret 키는 넣지 않는다).
// .env.local 에 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY 를 적는다.
import type { AiConfig } from './recommend'

// 로그인 연결 전이라 토큰은 항상 null이다. Supabase 로그인을 붙이면 세션의 access_token을 돌려준다.
function currentAccessToken(): string | null {
  return null
}

export function aiConfig(): AiConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !publishableKey) return null
  return { url, publishableKey, accessToken: currentAccessToken() }
}
