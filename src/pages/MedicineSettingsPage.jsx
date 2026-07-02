import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIMING_OPTIONS = ['朝', '昼', '晩', 'その他']
const MEAL_TIMINGS = ['朝', '昼', '晩']
const DOSE_OPTIONS = ['全量（粉）', '全量（液体）', '半錠', '1/3', '2/3', '1錠', '1.5錠', '2錠', '3錠']
const MED_ICONS = ['💊', '💉', '🧴', '🫙', '🦟', '🩺', '🌡️', '💧']
// 💊錠剤 💉注射/シリンジ 🧴液体薬 🫙粉薬 🦟防虫薬 🩺内科系 🌡️解熱系 💧点眼・点鼻薬

// 薬アイコン値（JSON or URL or 絵文字）をパース
const parseMedIcon = (iconValue) => {
  if (!iconValue) return { isPhoto: false, url: null, x: 50, y: 50, emoji: '💊' }
  try {
    const p = JSON.parse(iconValue)
    if (p.url) return { isPhoto: true, url: p.url, x: p.x ?? 50, y: p.y ?? 50, emoji: null }
  } catch {}
  if (iconValue.startsWith('http') || iconValue.startsWith('/')) {
    return { isPhoto: true, url: iconValue, x: 50, y: 50, emoji: null }
  }
  return { isPhoto: false, url: null, x: 50, y: 50, emoji: iconValue }
}

// 薬設定画面（新規登録 / 既存編集）
export default function MedicineSettingsPage() {
  const { petId, medicineId } = useParams()
  const isEdit = !!medicineId
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  // ペット設定画面から渡されたフォーム状態（戻るときにそのまま返す）
  const { savedPetForm } = location.state ?? {}
  const fileRef = useRef()

  // 薬アイコン
  const [icon, setIcon] = useState('💊')
  const [iconPreview, setIconPreview] = useState(null)
  const [iconIsPhoto, setIconIsPhoto] = useState(false)
  const [iconUploading, setIconUploading] = useState(false)
  // 写真の表示位置（ドラッグリポジション）
  const [iconPos, setIconPos] = useState({ x: 50, y: 50 })
  const isDragging = useRef(false)
  const dragOrigin = useRef({ clientX: 0, clientY: 0, x: 50, y: 50 })

  const [name, setName] = useState('')
  const [efficacy, setEfficacy] = useState('')
  const [timings, setTimings] = useState([])
  const [timeSettings, setTimeSettings] = useState({})
  const [doseAmount, setDoseAmount] = useState('1錠')
  const [intervalHours, setIntervalHours] = useState('8')
  const [isActive, setIsActive] = useState(true)
  // 投薬終了日：年・月・日に分けて管理
  const [endYear,  setEndYear]  = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [endDay,   setEndDay]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  // 結合した投薬終了日（YYYY-MM-DD）
  const endDate = endYear && endMonth && endDay
    ? `${String(endYear).padStart(4, '0')}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    : ''

  useEffect(() => {
    if (!isEdit) return
    const fetch = async () => {
      const { data } = await supabase.from('medicines').select('*').eq('id', medicineId).single()
      if (data) {
        const parsed = parseMedIcon(data.icon)
        if (parsed.isPhoto) {
          setIcon(parsed.url)
          setIconIsPhoto(true)
          setIconPreview(parsed.url)
          setIconPos({ x: parsed.x, y: parsed.y })
        } else {
          setIcon(parsed.emoji)
          setIconIsPhoto(false)
        }
        setName(data.name ?? '')
        setEfficacy(data.efficacy ?? '')
        setTimings(data.timings ?? [])
        setTimeSettings(data.time_settings ?? {})
        setDoseAmount(data.dose_amount ?? '1錠')
        setIntervalHours(data.interval_hours?.toString() ?? '8')
        setIsActive(data.is_active ?? true)
        if (data.end_date) {
          const [y, m, d] = data.end_date.split('-')
          setEndYear(y)
          setEndMonth(String(parseInt(m, 10)))
          setEndDay(String(parseInt(d, 10)))
        }
      }
      setLoading(false)
    }
    fetch()
  }, [medicineId])

  // 写真アップロード
  const handleIconPhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const preview = URL.createObjectURL(file)
    setIconPreview(preview)
    setIconIsPhoto(true)
    setIconPos({ x: 50, y: 50 })
    setIconUploading(true)

    const ext = file.name.split('.').pop()
    const path = `medicines/${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('pet-icons')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      const msg = uploadErr.message?.toLowerCase().includes('not found')
        ? '写真のアップロードに失敗しました。Supabase Storageの「pet-icons」バケットとアップロードポリシーが設定されているか確認してください。'
        : `写真のアップロードに失敗しました（${uploadErr.message}）。Storage設定を確認してください。`
      setError(msg)
      setIconIsPhoto(false)
      setIconUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('pet-icons').getPublicUrl(path)
    setIcon(urlData.publicUrl)
    setIconUploading(false)
  }

  const handleEmojiSelect = (emoji) => {
    setIcon(emoji)
    setIconIsPhoto(false)
    setIconPreview(null)
  }

  // ドラッグ（マウス）
  const handleMouseDown = (e) => {
    if (!iconIsPhoto) return
    isDragging.current = true
    dragOrigin.current = { clientX: e.clientX, clientY: e.clientY, x: iconPos.x, y: iconPos.y }
    e.preventDefault()
  }

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragOrigin.current.clientX
    const dy = e.clientY - dragOrigin.current.clientY
    setIconPos({
      x: Math.min(100, Math.max(0, dragOrigin.current.x - dx * 0.5)),
      y: Math.min(100, Math.max(0, dragOrigin.current.y - dy * 0.5)),
    })
  }, [])

  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])

  // ドラッグ（タッチ）
  const handleTouchStart = (e) => {
    if (!iconIsPhoto) return
    const t = e.touches[0]
    isDragging.current = true
    dragOrigin.current = { clientX: t.clientX, clientY: t.clientY, x: iconPos.x, y: iconPos.y }
  }

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return
    const t = e.touches[0]
    const dx = t.clientX - dragOrigin.current.clientX
    const dy = t.clientY - dragOrigin.current.clientY
    setIconPos({
      x: Math.min(100, Math.max(0, dragOrigin.current.x - dx * 0.5)),
      y: Math.min(100, Math.max(0, dragOrigin.current.y - dy * 0.5)),
    })
    e.preventDefault()
  }, [])

  const toggleTiming = (t) => {
    if (timings.includes(t)) {
      setTimings(timings.filter((x) => x !== t))
      const next = { ...timeSettings }
      delete next[t]
      setTimeSettings(next)
    } else {
      setTimings([...timings, t])
      setTimeSettings({ ...timeSettings, [t]: { type: 'point', start: '08:00', end: '08:00' } })
    }
  }

  const updateTimeSetting = (timing, field, value) => {
    setTimeSettings((prev) => ({ ...prev, [timing]: { ...prev[timing], [field]: value } }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('薬名を入力してください'); return }
    if (timings.length === 0) { setError('投薬タイミングを1つ以上選択してください'); return }

    if (!isEdit) {
      const { count } = await supabase
        .from('medicines')
        .select('*', { count: 'exact', head: true })
        .eq('pet_id', petId)
      if (count >= 20) { setError('1ペットにつき薬は20種類までです'); return }
    }

    setSaving(true)

    // 写真の場合はJSON形式で位置情報も保存
    const saveIcon = iconIsPhoto && icon
      ? JSON.stringify({ url: icon, x: iconPos.x, y: iconPos.y })
      : icon

    const payload = {
      pet_id: petId,
      user_id: user.id,
      icon: saveIcon,
      name: name.trim(),
      efficacy: efficacy.trim(),
      timings,
      time_settings: timeSettings,
      dose_amount: doseAmount,
      interval_hours: parseFloat(intervalHours) || 8,
      is_active: isActive,
      // 投薬中に戻した場合はend_dateをクリア、停止中の場合のみend_dateを保存
      end_date: !isActive && endDate ? endDate : null,
    }

    let err
    if (isEdit) {
      ({ error: err } = await supabase.from('medicines').update(payload).eq('id', medicineId))
    } else {
      ({ error: err } = await supabase.from('medicines').insert(payload))
    }

    setSaving(false)
    if (err) { setError('保存に失敗しました'); return }
    navigate(`/pets/${petId}/edit`, { state: { savedPetForm } })
  }

  if (loading) return (
    <div className="min-h-screen">
      <Header title="薬設定" />
      <div className="flex justify-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  const displayPreview = iconIsPhoto && iconPreview

  return (
    <div
      className="min-h-screen"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Header title={isEdit ? '薬設定（編集）' : '薬を新規登録'} />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <button onClick={() => navigate(`/pets/${petId}/edit`, { state: { savedPetForm } })} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-4">
          ← ペット設定へ戻る
        </button>

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* 薬アイコン */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-3">薬アイコン</h2>

            <div className="flex justify-center mb-4">
              <div className="relative inline-block">
                <div
                  className={`w-20 h-20 rounded-full overflow-hidden bg-amber-100 flex items-center justify-center text-4xl border-4 border-amber-200 select-none ${
                    displayPreview ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                >
                  {displayPreview ? (
                    <img
                      src={iconPreview}
                      alt="icon"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{ objectPosition: `${iconPos.x}% ${iconPos.y}%` }}
                      draggable={false}
                    />
                  ) : (
                    <span>{icon}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center border-2 border-white hover:bg-gray-700 transition-colors shadow-md"
                  title="写真を選択"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {displayPreview && (
              <p className="text-xs text-center text-gray-400 mb-2">ドラッグして表示位置を調整できます</p>
            )}
            {iconUploading && <p className="text-xs text-center text-purple-500 mb-2">アップロード中...</p>}

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconPhotoChange} />

            <p className="label mb-2">絵文字アイコンから選択</p>
            <div className="flex gap-2 flex-wrap">
              {MED_ICONS.map((ic) => (
                <button type="button" key={ic} onClick={() => handleEmojiSelect(ic)}
                  className={`w-11 h-11 text-2xl rounded-2xl flex items-center justify-center transition-all ${
                    !iconIsPhoto && icon === ic
                      ? 'bg-amber-200 ring-2 ring-amber-500 scale-110'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* 基本情報 */}
          <div className="card flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-700">基本情報</h2>

            <div>
              <label className="label">薬名 <span className="text-red-400">*</span></label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="アモキシシリン" />
            </div>
            <div>
              <label className="label">効能・メモ</label>
              <input className="input" value={efficacy} onChange={(e) => setEfficacy(e.target.value)} placeholder="抗生物質" />
            </div>
            <div>
              <label className="label">投薬量</label>
              <div className="flex flex-wrap gap-2">
                {DOSE_OPTIONS.map((opt) => (
                  <button type="button" key={opt} onClick={() => setDoseAmount(opt)}
                    className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                      doseAmount === opt
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">次回投薬まで空ける時間（時間）</label>
              <div className="flex items-center gap-2">
                <input className="input" type="number" step="0.5" min="0.5" max="72"
                  value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)} style={{ maxWidth: 120 }} />
                <span className="text-sm text-gray-500">時間後に通知</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="label mb-0">投薬中</span>
              <label className="toggle">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 投薬終了日（投薬中OFFのときのみ表示） */}
            {!isActive && (
              <div className="bg-gray-50 rounded-2xl px-4 py-3">
                <p className="text-xs font-medium text-gray-500 mb-2">投薬終了日</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 80 }}
                    placeholder="2025" value={endYear} onChange={(e) => setEndYear(e.target.value)} />
                  <span className="text-gray-400 text-sm">年</span>
                  <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 60 }}
                    placeholder="1" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} min="1" max="12" />
                  <span className="text-gray-400 text-sm">月</span>
                  <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 60 }}
                    placeholder="1" value={endDay} onChange={(e) => setEndDay(e.target.value)} min="1" max="31" />
                  <span className="text-gray-400 text-sm">日</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  入力するとこの日までトップ画面に投薬予定が残ります
                </p>
              </div>
            )}
          </div>

          {/* 投薬タイミング・時間設定 */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              投薬タイミング <span className="text-red-400">*</span>
              <span className="text-gray-400 font-normal text-xs ml-1">（複数選択可）</span>
            </h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {TIMING_OPTIONS.map((t) => (
                <button type="button" key={t} onClick={() => toggleTiming(t)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                    timings.includes(t)
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {[...timings].sort((a, b) => TIMING_OPTIONS.indexOf(a) - TIMING_OPTIONS.indexOf(b)).map((timing) => {
              const ts = timeSettings[timing] ?? { type: 'point', start: '08:00', end: '08:00' }
              return (
                <div key={timing} className="p-3 bg-gray-50 rounded-2xl mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-purple-700">{timing}</span>
                    <div className="flex gap-1">
                      {['point', 'range'].map((type) => (
                        <button type="button" key={type}
                          onClick={() => updateTimeSetting(timing, 'type', type)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-all ${
                            ts.type === type
                              ? 'bg-purple-100 text-purple-700 border-purple-300'
                              : 'bg-white text-gray-500 border-gray-200'
                          }`}>
                          {type === 'point' ? 'ピンポイント' : '時間帯'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {ts.type === 'point' ? (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-10">時刻</label>
                      <input type="time" className="input" style={{ maxWidth: 130 }}
                        value={ts.start}
                        onChange={(e) => { updateTimeSetting(timing, 'start', e.target.value); updateTimeSetting(timing, 'end', e.target.value) }} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="time" className="input" style={{ maxWidth: 120 }}
                        value={ts.start} onChange={(e) => updateTimeSetting(timing, 'start', e.target.value)} />
                      <span className="text-gray-400">〜</span>
                      <input type="time" className="input" style={{ maxWidth: 120 }}
                        value={ts.end} onChange={(e) => updateTimeSetting(timing, 'end', e.target.value)} />
                    </div>
                  )}
                  {MEAL_TIMINGS.includes(timing) && (
                    <div className="mt-2 flex items-center gap-4 flex-wrap">
                      <span className="text-xs text-gray-500 w-10 flex-shrink-0">食事</span>
                      {[{ val: '', label: '指定なし' }, { val: '食前', label: '食前' }, { val: '食後', label: '食後' }].map(({ val, label }) => (
                        <label key={val} className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                          <input
                            type="radio"
                            name={`meal-${timing}`}
                            value={val}
                            checked={(ts.meal ?? '') === val}
                            onChange={() => updateTimeSetting(timing, 'meal', val)}
                            className="accent-purple-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">{error}</div>
          )}

          <button type="submit" disabled={saving || iconUploading} className="btn btn-primary w-full text-base">
            {saving ? '保存中...' : '保存する'}
          </button>
        </form>
      </main>
    </div>
  )
}
