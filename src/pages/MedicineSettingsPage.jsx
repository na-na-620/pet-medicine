import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIMING_OPTIONS = ['朝', '昼', '晩', '食前', '食後', '起床時', '就寝前', 'その他']
const DOSE_OPTIONS = ['全量', '半錠', '1/3', '2/3', '1錠', '1.5錠', '2錠', '3錠']
// 薬アイコン絵文字（写真選択も可能）
const MED_ICONS = ['💊', '🧴', '💉', '🩹', '🩺', '🔬', '⚗️', '🫁']

// 薬設定画面（新規登録 / 既存編集）
export default function MedicineSettingsPage() {
  const { petId, medicineId } = useParams()
  const isEdit = !!medicineId
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef()

  // 薬アイコン（絵文字 or 写真URL）
  const [icon, setIcon] = useState('💊')
  const [iconPreview, setIconPreview] = useState(null)  // 写真のプレビューURL
  const [iconIsPhoto, setIconIsPhoto] = useState(false)  // 写真かどうか
  const [iconUploading, setIconUploading] = useState(false)

  const [name, setName] = useState('')
  const [efficacy, setEfficacy] = useState('')
  const [timings, setTimings] = useState([])
  const [timeSettings, setTimeSettings] = useState({})
  const [doseAmount, setDoseAmount] = useState('1錠')
  const [intervalHours, setIntervalHours] = useState('8')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  // 編集時は既存データを取得
  useEffect(() => {
    if (!isEdit) return
    const fetch = async () => {
      const { data } = await supabase.from('medicines').select('*').eq('id', medicineId).single()
      if (data) {
        const isPhoto = data.icon?.startsWith('http') || data.icon?.startsWith('/')
        setIcon(data.icon ?? '💊')
        setIconIsPhoto(isPhoto)
        if (isPhoto) setIconPreview(data.icon)
        setName(data.name ?? '')
        setEfficacy(data.efficacy ?? '')
        setTimings(data.timings ?? [])
        setTimeSettings(data.time_settings ?? {})
        setDoseAmount(data.dose_amount ?? '1錠')
        setIntervalHours(data.interval_hours?.toString() ?? '8')
        setIsActive(data.is_active ?? true)
      }
      setLoading(false)
    }
    fetch()
  }, [medicineId])

  // 薬アイコン写真アップロード
  const handleIconPhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const preview = URL.createObjectURL(file)
    setIconPreview(preview)
    setIconIsPhoto(true)
    setIconUploading(true)

    const ext = file.name.split('.').pop()
    const path = `medicines/${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('pet-icons')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError('写真のアップロードに失敗しました')
      setIconPreview(null)
      setIconIsPhoto(false)
      setIconUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('pet-icons').getPublicUrl(path)
    setIcon(urlData.publicUrl)
    setIconUploading(false)
  }

  // 絵文字アイコンを選択
  const handleEmojiSelect = (emoji) => {
    setIcon(emoji)
    setIconIsPhoto(false)
    setIconPreview(null)
  }

  // 投薬タイミングの選択/解除（複数選択可）
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

  // 保存処理
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
    const payload = {
      pet_id: petId,
      user_id: user.id,
      icon,
      name: name.trim(),
      efficacy: efficacy.trim(),
      timings,
      time_settings: timeSettings,
      dose_amount: doseAmount,
      interval_hours: parseFloat(intervalHours) || 8,
      is_active: isActive,
    }

    let err
    if (isEdit) {
      ({ error: err } = await supabase.from('medicines').update(payload).eq('id', medicineId))
    } else {
      ({ error: err } = await supabase.from('medicines').insert(payload))
    }

    setSaving(false)
    if (err) { setError('保存に失敗しました'); return }
    navigate(`/pets/${petId}/edit`)
  }

  if (loading) return (
    <div className="min-h-screen">
      <Header title="薬設定" />
      <div className="flex justify-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Header title={isEdit ? '薬設定（編集）' : '薬を新規登録'} />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* 戻るリンク */}
        <button onClick={() => navigate(`/pets/${petId}/edit`)} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-4">
          ← ペット設定へ戻る
        </button>

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* 薬アイコン（絵文字 or 写真） */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-3">薬アイコン</h2>

            {/* 現在のアイコンプレビュー */}
            <div className="flex justify-center mb-4">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-amber-100 flex items-center justify-center text-4xl border-4 border-amber-200">
                  {iconIsPhoto && iconPreview
                    ? <img src={iconPreview} alt="icon" className="w-full h-full object-cover" />
                    : <span>{icon}</span>
                  }
                </div>
                {/* カメラバッジ */}
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

            {iconUploading && <p className="text-xs text-center text-purple-500 mb-2">アップロード中...</p>}

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconPhotoChange} />

            {/* 絵文字選択 */}
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
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="アモキシシリン" required />
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

            {/* タイミングごとの時間設定（ピンポイント or 時間帯） */}
            {timings.map((timing) => {
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
