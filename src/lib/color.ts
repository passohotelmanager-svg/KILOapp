// 색을 어둡게 / 밝게 조절 (하위 부위 3단계 표시용)
function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

export function darken(hex: string, amt = 0.3): string {
  const [r, g, b] = parse(hex)
  return toHex(r * (1 - amt), g * (1 - amt), b * (1 - amt))
}

export function lighten(hex: string, amt = 0.4): string {
  const [r, g, b] = parse(hex)
  return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt)
}
