// 운동 목표 진행바에 쓰는 보디빌딩 포즈 3종: 포즈 그림 시트(public/poses.png)의 왼쪽, 가운데, 오른쪽 그림.
// 영역은 시트(720x240)에서 각 포즈만 담고 왼쪽 아래 왕관 표시는 피하도록 정했다.
import { PoseCut, type PoseRegion } from './PoseCut'

export const POSE_REGIONS: PoseRegion[] = [
  { x: 100, y: 15, w: 115, h: 197 },
  { x: 318, y: 15, w: 120, h: 197 },
  { x: 538, y: 15, w: 124, h: 197 },
]

export function Pose({ index, color, size }: { index: 0 | 1 | 2; color: string; size: number }) {
  return <PoseCut region={POSE_REGIONS[index]} color={color} size={size} />
}
