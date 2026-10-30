// 결과 공유: 요약을 이미지로 그려 공유 시트 또는 파일 저장 (F-08)

export interface ShareRow {
  label: string
  color: string
  volume: string
  sets: string
  percent: number
}

export interface ShareData {
  title: string
  period: string
  total: string
  rows: ShareRow[]
}

export function renderShareImage(d: ShareData): Promise<Blob | null> {
  const W = 720
  const rowH = 64
  const H = 330 + Math.max(1, d.rows.length) * rowH + 70
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) return Promise.resolve(null)
  g.fillStyle = '#f6f1f0'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#fff'
  g.beginPath()
  g.roundRect(30, 30, W - 60, H - 60, 28)
  g.fill()
  g.fillStyle = '#e5534b'
  g.font = '800 30px Pretendard, sans-serif'
  g.fillText('KILO', 70, 100)
  g.fillStyle = '#8b95a1'
  g.font = '500 26px Pretendard, sans-serif'
  g.fillText(d.title, 70, 150)
  g.fillText(d.period, 70, 190)
  g.fillStyle = '#191f28'
  g.font = '800 64px Pretendard, sans-serif'
  g.fillText(d.total, 70, 280)

  let y = 330
  g.font = '600 26px Pretendard, sans-serif'
  if (d.rows.length === 0) {
    g.fillStyle = '#8b95a1'
    g.fillText('기록이 없어요', 70, y + 30)
  }
  for (const r of d.rows) {
    g.fillStyle = r.color
    g.beginPath()
    g.roundRect(70, y + 6, 22, 22, 5)
    g.fill()
    g.fillStyle = '#191f28'
    g.fillText(r.label, 106, y + 26)
    g.textAlign = 'right'
    g.fillText(`${r.volume}  (${r.percent}%)`, W - 70, y + 26)
    g.textAlign = 'left'
    g.fillStyle = '#f6f1f0'
    g.fillRect(70, y + 40, W - 140, 8)
    g.fillStyle = r.color
    g.fillRect(70, y + 40, ((W - 140) * r.percent) / 100, 8)
    y += rowH
  }
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

// 기기 공유 시트가 있으면 공유하고, 없으면 파일로 내려받는다
export async function shareImage(blob: Blob, name: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData2) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'KILO' })
      return 'shared'
    } catch {
      // 사용자가 취소하면 저장으로 넘어가지 않고 그대로 종료
      return 'shared'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'saved'
}

type ShareData2 = { files: File[] }
