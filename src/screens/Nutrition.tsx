// 영양 기록, 섭취 가능량, 면책 고지 (F-10, F-11, F-12, F-43)
import { useState } from 'react'
import { actions, useAppState } from '../store'
import { useNav } from '../nav'
import { Card, Page, Sheet, TopBar, useToast } from '../components/ui'
import { Icon } from '../components/Icon'
import { DISCLAIMER, MEALS } from '../lib/constants'
import { addDays, dayLabel, isFuture, parseYmd, startOfWeek, ymd } from '../lib/dates'
import { comma } from '../lib/format'
import { dailyTarget, macroKcal, weeklyTarget } from '../lib/calc'
import { kcalOn, macrosOn, nutritionOn } from '../lib/stats'
import type { MealCode } from '../types'

export function Nutrition({ date }: { date?: string }) {
  const s = useAppState()
  const nav = useNav()
  const [day, setDay] = useState(date ?? ymd(new Date()))
  const d = parseYmd(day)

  const target = s.profile ? dailyTarget(s.profile) : 0
  const wTarget = s.profile ? weeklyTarget(s.profile) : 0
  const ws = startOfWeek(d)
  const week = macrosOn(s, ws, addDays(ws, 6))
  const dayM = macrosOn(s, d, d)
  const eaten = kcalOn(s, day)
  const shift = (n: number) => {
    const next = addDays(d, n)
    if (n > 0 && isFuture(next)) return
    setDay(ymd(next))
  }

  return (
    <>
      <TopBar title="영양 기록" back />
      <Page fixed>
        <div className="row between" style={{ padding: '0 16px' }}>
          <button className="iconbtn" aria-label="이전 날" onClick={() => shift(-1)}><Icon name="left" /></button>
          <b>{dayLabel(d)}</b>
          <button className="iconbtn" aria-label="다음 날" onClick={() => shift(1)} style={{ opacity: isFuture(addDays(d, 1)) ? 0.3 : 1 }}><Icon name="right" /></button>
        </div>

        <Card title="하루 섭취 가능량">
          <div className="num">{comma(eaten)}<small>kcal</small> <span className="unit">/ {target ? `${comma(target)}kcal` : '-'}</span></div>
          <div className="bar-track mt12"><div className="bar-fill" style={{ width: `${target ? Math.min(100, (eaten / target) * 100) : 0}%`, background: eaten > target && target ? 'var(--dec)' : undefined }} /></div>
          <p className="muted mt8">
            {target ? (eaten <= target ? `${comma(target - eaten)}kcal 더 먹을 수 있어요` : `${comma(eaten - target)}kcal 초과했어요`) : '신체 정보를 입력하면 섭취 가능량을 알려드려요'}
          </p>
          <div className="three mt16">
            {[
              { n: '탄수화물', c: 'var(--carb)', g: dayM.carb, range: target ? `${Math.round((target * 0.45) / 4)}~${Math.round((target * 0.65) / 4)}g` : '' },
              { n: '단백질', c: 'var(--protein)', g: dayM.protein, range: '' },
              { n: '지방', c: 'var(--fat)', g: dayM.fat, range: target ? `${Math.round((target * 0.2) / 9)}~${Math.round((target * 0.35) / 9)}g` : '' },
            ].map((x) => (
              <div key={x.n}>
                <div style={{ fontSize: 13 }}><span className="swatch" style={{ background: x.c, borderRadius: '50%' }} />{x.n}</div>
                <b>{Math.round(x.g)}</b><span className="unit">g</span>
                <div className="muted" style={{ fontSize: 11 }}>{x.range ? `권장 ${x.range}` : '목표 준비 중'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="주간 섭취 가능량">
          <div className="num">{comma(week.kcal)}<small>kcal</small> <span className="unit">/ {wTarget ? `${comma(wTarget)}kcal` : '-'}</span></div>
          <div className="bar-track mt12"><div className="bar-fill" style={{ width: `${wTarget ? Math.min(100, (week.kcal / wTarget) * 100) : 0}%` }} /></div>
          <p className="muted mt8">월요일부터 일요일까지 합산해요</p>
        </Card>

        {MEALS.map((m) => {
          const list = nutritionOn(s, day).filter((n) => n.meal === m.code)
          return (
            <Card key={m.code} title={m.name}>
              {list.length === 0 && <p className="muted">기록이 없어요</p>}
              {list.map((n) => (
                <div key={n.id} className="row gap12" style={{ padding: '8px 0' }}>
                  {n.photo && <img src={n.photo} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: 'cover' }} />}
                  <div className="grow">
                    <b>{n.name || m.name}</b>
                    <div className="muted" style={{ fontSize: 13 }}>탄 {n.carb}g · 단 {n.protein}g · 지 {n.fat}g</div>
                  </div>
                  <b>{comma(n.kcal)}<span className="unit">kcal</span></b>
                  <button className="iconbtn" aria-label="기록 삭제" onClick={() => actions.deleteNutrition(n.id)}><Icon name="trash" size={18} color="var(--text2)" /></button>
                </div>
              ))}
              <button className="btn ghost mt8" onClick={() => nav.push('mealEdit', { meal: m.code, date: day })}>
                {m.name} 추가
              </button>
            </Card>
          )
        })}
        <p className="disclaimer">{DISCLAIMER}</p>
      </Page>

      {!s.settings.nutritionConsent && (
        <Sheet mid onClose={() => nav.pop()}>
          <h3 className="card-title">영양 정보 안내</h3>
          <p className="sub">KILO가 제공하는 칼로리 및 영양소 권장량은 NASM(미국국가운동의학회)의 공개 계산 방식을 참고한 추정치입니다.</p>
          <ul className="sub" style={{ paddingLeft: 18 }}>
            <li>이 정보는 의학적 진단, 치료, 처방을 대신하지 않습니다.</li>
            <li>개인의 건강 상태, 질환, 복용 약물, 임신 및 수유 여부에 따라 적정 섭취량은 달라질 수 있습니다.</li>
            <li>당뇨, 신장 질환 등 질환이 있거나 식이 제한이 필요한 경우 반드시 의료 전문가와 상담하세요.</li>
            <li>극단적인 열량 제한은 건강에 해로울 수 있습니다.</li>
          </ul>
          <button className="btn mt16" onClick={() => actions.updateSettings({ nutritionConsent: true })}>확인했습니다</button>
        </Sheet>
      )}
    </>
  )
}

// 이미지를 작게 줄여 data URL로 저장
function shrink(file: File, max = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => reject(new Error('이미지를 읽을 수 없어요'))
    img.src = url
  })
}

export function MealEdit({ meal, date }: { meal: MealCode; date: string }) {
  const nav = useNav()
  const [name, setName] = useState('')
  const [carb, setCarb] = useState('')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [toast, show] = useToast()
  const num = (v: string) => (Number.isFinite(parseFloat(v)) && parseFloat(v) > 0 ? parseFloat(v) : 0)
  const kcal = macroKcal(num(carb), num(protein), num(fat))
  const mealName = MEALS.find((m) => m.code === meal)?.name ?? ''

  const save = () => {
    if (kcal <= 0) return show('탄수화물, 단백질, 지방 중 하나는 입력해주세요')
    actions.addNutrition({ date, meal, name: name.trim(), carb: num(carb), protein: num(protein), fat: num(fat), kcal, photo })
    nav.pop()
  }

  const field = (label: string, v: string, set: (s: string) => void) => (
    <>
      <p className="field-label">{label} (g)</p>
      <input className="input" type="number" inputMode="decimal" min={0} value={v} onChange={(e) => set(e.target.value)} aria-label={label} placeholder="0" />
    </>
  )

  return (
    <>
      <TopBar title={`${mealName} 기록`} back />
      <Page fixed>
        <div style={{ padding: '0 16px' }}>
          <p className="field-label">메뉴 이름 (선택)</p>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="메뉴 이름" placeholder="예: 닭가슴살 샐러드" />
          {field('탄수화물', carb, setCarb)}
          {field('단백질', protein, setProtein)}
          {field('지방', fat, setFat)}
          <div className="card" style={{ margin: '16px 0' }}>
            <p className="muted">열량 (자동 계산)</p>
            <div className="num">{comma(kcal)}<small>kcal</small></div>
            <p className="muted" style={{ fontSize: 12 }}>탄수화물 x 4 + 단백질 x 4 + 지방 x 9</p>
          </div>
          <p className="field-label">식단 사진 (선택)</p>
          <label className="dashed" style={{ aspectRatio: '16/9', overflow: 'hidden', cursor: 'pointer' }}>
            {photo ? <img src={photo} alt="식단 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={28} />}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setPhoto(await shrink(f).catch(() => null))
              }}
            />
          </label>
        </div>
      </Page>
      <div className="bottom-fixed" style={{ position: 'absolute', left: 0, right: 0, bottom: 'var(--footer-h)' }}>
        <button className="btn" onClick={save}>저장</button>
      </div>
      {toast}
    </>
  )
}

export function MealAlbum() {
  const s = useAppState()
  const photos = s.nutrition.filter((n) => n.photo).sort((a, b) => (a.date < b.date ? 1 : -1))
  return (
    <>
      <TopBar title="식단 앨범" back />
      <Page>
        {photos.length === 0 ? (
          <div className="empty">식단 사진이 아직 없어요</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: '0 16px' }}>
            {photos.map((p) => (
              <img key={p.id} src={p.photo!} alt={`${p.date} 식단`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        )}
      </Page>
    </>
  )
}
