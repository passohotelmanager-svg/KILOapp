// 공유할 이미지를 미리 보고 골라서 저장 / 공유하는 시트
import { tr } from '../lib/i18n'
import { useEffect, useState } from 'react'
import { Sheet } from './ui'
import { shareImages } from '../lib/share'

export interface ShareChoice {
  key: string
  label: string
  name: string // 저장할 파일 이름
  blob: Blob
}

export function ShareSheet({
  build,
  onClose,
  onDone,
}: {
  // 이미지를 그려서 돌려준다. 시트가 열릴 때 한 번 호출한다
  build: () => Promise<ShareChoice[]>
  onClose: () => void
  onDone: (r: 'shared' | 'saved') => void
}) {
  const [choices, setChoices] = useState<(ShareChoice & { url: string })[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    let urls: string[] = []
    let alive = true
    build().then((list) => {
      if (!alive) return
      const withUrl = list.map((c) => ({ ...c, url: URL.createObjectURL(c.blob) }))
      urls = withUrl.map((c) => c.url)
      setChoices(withUrl)
      // 기본으로 첫 번째 이미지를 선택해 둔다
      setPicked(new Set(withUrl.slice(0, 1).map((c) => c.key)))
    })
    return () => {
      alive = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  const go = async () => {
    const files = (choices ?? []).filter((c) => picked.has(c.key))
    if (files.length === 0) return
    onDone(await shareImages(files))
    onClose()
  }

  return (
    <Sheet onClose={onClose} full>
      <h3 className="card-title">{tr('이미지로 저장 · 공유')}</h3>
      <p className="muted mt8">{tr('저장하거나 공유할 이미지를 골라주세요')}</p>
      {!choices ? (
        <p className="empty">{tr('이미지를 만드는 중이에요')}</p>
      ) : (
        <div className="share-grid mt12">
          {choices.map((c) => (
            <button key={c.key} className={`share-opt ${picked.has(c.key) ? 'on' : ''}`} onClick={() => toggle(c.key)} aria-pressed={picked.has(c.key)} aria-label={tr('{0} 선택', [c.label])}>
              <img src={c.url} alt={c.label} />
              <b>{c.label}</b>
            </button>
          ))}
        </div>
      )}
      <button className="btn mt16" disabled={picked.size === 0} onClick={go}>
        {tr('{0}장 저장 · 공유', [picked.size])}
      </button>
    </Sheet>
  )
}
