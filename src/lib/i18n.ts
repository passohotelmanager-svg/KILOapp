// 화면 언어. 문구는 한국어 원문을 키로 쓰고, 영어일 때만 en.ts에서 찾아 바꾼다.
// 영어 번역이 없는 문구는 한국어 그대로 보인다.
import { EN } from './en'

export type Lang = 'ko' | 'en'

let current: Lang = 'ko'

export function setLang(lang: Lang) {
  current = lang
}

export function getLang(): Lang {
  return current
}

// tr('가슴'), tr('{0}개 운동', [n]), tr('{n}일', { n })
export function tr(ko: string, vars?: (string | number)[] | Record<string, string | number>): string {
  const text = current === 'en' ? (EN[ko] ?? ko) : ko
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, k) => {
    const v = Array.isArray(vars) ? vars[Number(k)] : vars[k]
    return v === undefined ? m : String(v)
  })
}

// 모듈 맨 위에서 만든 상수(부위 이름, 요일 등)가 언어를 바꿔도 따라가도록, 값을 읽을 때 번역한다.
export function lazy<T extends object>(src: T): T {
  return new Proxy(src, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver)
      if (typeof v === 'string') return tr(v)
      return v !== null && typeof v === 'object' ? lazy(v as object) : v
    },
  })
}
