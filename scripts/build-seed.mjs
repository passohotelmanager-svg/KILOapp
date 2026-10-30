// PRD 14장 표를 읽어 종목 라이브러리 시드 JSON을 생성한다.
import fs from 'node:fs'

const prdPath = process.argv[2]
if (!prdPath) throw new Error('사용법: node scripts/build-seed.mjs <PRD 경로>')
const lines = fs.readFileSync(prdPath, 'utf8').split(/\r?\n/)

const TYPE = { 무게: 'weight', 맨몸: 'bodyweight', 시간: 'time', 거리형: 'cardio_distance', 시간형: 'cardio_time' }
const SUB = { '광배·중부': 'lats_mid', 하부: 'lower', 승모근: 'traps', 이두: 'biceps', 삼두: 'triceps', 전완: 'forearms' }
const PART = { '14.1': 'chest', '14.2': 'back', '14.3': 'shoulders', '14.4': 'legs', '14.5': 'arms', '14.6': 'abs', '14.7': 'cardio' }

const out = []
let part = null
for (const line of lines) {
  const h = line.match(/^### (14\.\d)/)
  if (h) { part = PART[h[1]] ?? null; continue }
  if (!part || !line.startsWith('|')) continue
  const c = line.split('|').slice(1, -1).map((s) => s.trim())
  if (!/^\d+$/.test(c[0])) continue
  const hasSub = c.length === 5
  const type = TYPE[c[c.length - 1]]
  if (!type) throw new Error('알 수 없는 기록 유형: ' + line)
  out.push({
    id: `${part}-${String(c[0]).padStart(2, '0')}`,
    nameKo: c[1],
    nameEn: c[2],
    part,
    subPart: hasSub ? SUB[c[3]] : null,
    type,
    builtin: true,
  })
}
fs.writeFileSync(new URL('../src/data/exercises.json', import.meta.url), JSON.stringify(out, null, 1))
console.log('종목 수:', out.length)
