// 보디빌더 그림(public/pose.png) 전신을 자르지 않고 원하는 색 선으로 그린다.
// 그림 둘레의 흰 여백만 걷어내고, 비율을 지켜 정사각형 안에 꽉 차게 맞춘다.
import { useEffect, useRef } from 'react'
import { tr } from '../lib/i18n'

const SRC = '/poses.png'

export interface PoseRegion {
  x: number
  y: number
  w: number
  h: number
}
let loading: Promise<HTMLImageElement> | null = null

function loadImage(): Promise<HTMLImageElement> {
  loading ??= new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = SRC
  })
  return loading
}

// '#fff', '#4c8bf5' 형식의 색을 [r, g, b]로 바꾼다
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}

// 그림 둘레의 흰 여백을 뺀, 선이 있는 영역
function contentBox(img: HTMLImageElement, r: PoseRegion): PoseRegion {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return r
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let x0 = r.x + r.w
  let y0 = r.y + r.h
  let x1 = -1
  let y1 = -1
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * c.width + x) * 4
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 225) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return r
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export function PoseCut({ region, color, size }: { region: PoseRegion; color: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    loadImage()
      .then((img) => {
        const canvas = ref.current
        const g = canvas?.getContext('2d', { willReadFrequently: true })
        if (!alive || !canvas || !g) return
        const px = Math.round(size * (window.devicePixelRatio || 1))
        canvas.width = px
        canvas.height = px
        const box = contentBox(img, region)
        const scale = Math.min(px / box.w, px / box.h)
        const dw = box.w * scale
        const dh = box.h * scale
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, box.x, box.y, box.w, box.h, (px - dw) / 2, (px - dh) / 2, dw, dh)
        // 흰 바탕은 투명하게, 검은 선은 고른 색으로 바꾼다
        const data = g.getImageData(0, 0, px, px)
        const [r, gr, b] = rgb(color)
        for (let i = 0; i < data.data.length; i += 4) {
          const a = data.data[i + 3] / 255
          const lum = (0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]) * a + 255 * (1 - a)
          data.data[i] = r
          data.data[i + 1] = gr
          data.data[i + 2] = b
          data.data[i + 3] = Math.min(255, (255 - lum) * 3)
        }
        g.putImageData(data, 0, 0)
      })
      .catch(() => {
        // 그림을 못 불러오면 빈 칸으로 둔다
      })
    return () => {
      alive = false
    }
  }, [region, color, size])

  return <canvas ref={ref} style={{ width: size, height: size }} role="img" aria-label={tr('보디빌딩 포즈')} />
}
