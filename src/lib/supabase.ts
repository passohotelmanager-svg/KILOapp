// Supabase 연결. .env.local 에 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY 가 있을 때만 만들어진다.
// 둘 다 앱에 들어가도 되는 공개 값이다 (secret / service_role 키는 절대 넣지 않는다).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// 값이 없으면 null: 이때 앱은 데모 로그인(이 기기에만 저장)으로 동작한다
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
    : null
