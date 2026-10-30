import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 개발용 서버에서만 쓰는 임시 저장소: 개발자 모드 앱이 보낸 하루 볼륨을 public/developer-volume.json에 쓴다.
// 서버(Supabase)를 붙이면 이 플러그인은 필요 없다. 같은 컴퓨터(localhost)에서 온 요청만 받는다.
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined)
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined)

function cleanVolume(d: Record<string, unknown>) {
  const date = str(d.date, 10)
  const items = Array.isArray(d.items) ? d.items.slice(0, 30) : []
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date')
  return {
    name: str(d.name, 40) ?? 'KILO',
    date,
    seconds: num(d.seconds, 1_000_000) ?? 0,
    exerciseCount: num(d.exerciseCount, 1000) ?? 0,
    volume: num(d.volume, 100_000_000) ?? 0,
    kcal: num(d.kcal, 1_000_000) ?? 0,
    items: items.map((it: Record<string, unknown>) => ({
      name: str(it.name, 80) ?? '',
      nameEn: str(it.nameEn, 80),
      sets: num(it.sets, 10_000),
      repsLo: num(it.repsLo, 10_000),
      repsHi: num(it.repsHi, 10_000),
      seconds: num(it.seconds, 1_000_000),
      minutes: num(it.minutes, 100_000),
      km: num(it.km, 10_000),
    })),
  }
}

function developerVolumeApi(): Plugin {
  return {
    name: 'developer-volume-api',
    configureServer(server) {
      server.middlewares.use('/api/developer-volume', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        const ip = req.socket.remoteAddress ?? ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
          res.statusCode = 403
          return res.end()
        }
        let body = ''
        req.on('data', (c) => {
          body += c
          if (body.length > 50_000) req.destroy()
        })
        req.on('end', () => {
          try {
            const clean = cleanVolume(JSON.parse(body))
            fs.writeFileSync(path.resolve('public/developer-volume.json'), JSON.stringify(clean, null, 2) + '\n')
            res.statusCode = 204
          } catch {
            res.statusCode = 400
          }
          res.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), developerVolumeApi()],
  // 서버 함수 테스트(supabase/functions)는 node:test 방식이라 npm run test:functions로 따로 돌린다
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
