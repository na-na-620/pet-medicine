import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// 投薬タイミング選択肢
const TIMING_OPTIONS = ['朝', '昼', '晩', '食前', '食後', '起床時', '就寝前', 'その他']

// 投薬量選択肢
const DOSE_OPTIONS = ['全量', '半錠', '1/3', '2/3', '1錠', '1.5錠', '2錠', '3錠']

// 薬アイコン選択肢
const MED_ICONS = ['💊', '🧴', '💉', '🩹', '🩺', '🔬', '⚗️', '🫁']

// 薬設定画面（新規登録 / 既存編集）
export default function MedicineSettingsPage() {
  const { petId, medicineId } = useParams()
  const isEdit = !!medicineId
  const navigate = useNavigate()
  const { user } = useAuth()

  const [icon, setIcon] = useState('💊')
  const [name, setName] = useState('')
  const [efficacy, setEfficacy] = useState('')
  const [timings, setTimings] = useState([])          // 選択した投薬タイミング（複数可）
  // 時間設定：各タイミングに対してピンポイントまたは時間帯を設定
  const [timeSettings, setTimeSettings] = useState({})// { '朝': { type:'point'|'range', start:'08:00', end:'08:00' } }
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
        setIcon(data.icon ?? '💊')
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

  // 時間設定の更新
  const updateTimeSetting = (timing, field, value) => {
    setTimeSettings((prev) => ({
      ...prev,
      [timing]: { ...prev[timing], [field]: value },
    }))
  }

  // 保存処理
  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('薬名を入力してください'); return }
    if (timings.length === 0) { setError('投薬タイミングを1つ以上選択してください'); return }

    // ペットの薬が上限(20)に達していないか確認
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
      time_settings: timeSettings,  // タイミングごとの時間設定（JSON）
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
    <div className="min-h-screen bg-gray-50">
      <Header title="薬設定" />
      <div className="flex justify-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={isEdit ? '薬設定（編集）' : '薬を新規登録'} />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* 薬アイコン */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-3">薬アイコン</h2>
            <div className="flex gap-2 flex-wrap">
              {MED_ICONS.map((ic) => (
                <button type="button" key={ic} onClick={() => setIcon(ic)}
                  className={`w-10 h-10 text-2xl rounded-xl flex items-center justify-center transition-all ${
                    icon === ic ? 'bg-purple-200 ring-2 ring-purple-500' : 'bg-gray-100 hover:bg-gray-200'
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
              <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="アモキシシリン" required />
            </div>

            <div>
              <label className="label">効能・メモ</label>
              <input className="input" value={efficacy} onChange={(e) => setEfficacy(e.target.value)}
                placeholder="抗生物質" />
            </div>

            <div>
              <label className="label">投薬量</label>
              <div className="flex flex-wrap gap-2">
                {DOSE_OPTIONS.map((opt) => (
                  <button type="button" key={opt} onClick={() => setDoseAmount(opt)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
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
                  value={intervalHours} onChange={(e) => setIntervalHours(e.target.value)}
                  style={{ maxWidth: 120 }} />
                <span className="text-sm text-gray-500">時間後に通知</span>
              </div>
            </div>

            {/* 投薬中/停止中トグル */}
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

            {/* タイミング選択ボタン */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TIMING_OPTIONS.map((t) => (
                <button type="button" key={t} onClick={() => toggleTiming(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    timings.includes(t)
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {/* 各タイミングの時間設定 */}
            {timings.map((timing) => {
              const ts = timeSettings[timing] ?? { type: 'point', start: '08:00', end: '08:00' }
              return (
                <div key={timing} className="p-3 bg-gray-50 rounded-xl mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-purple-700">{timing}</span>
                    {/* ピンポイント / 時間帯 切り替え */}
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
                    /* ピンポイント時間 */
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-10">時刻</label>
                      <input type="time" className="input" style={{ maxWidth: 130 }}
                        value={ts.start}
                        onChange={(e) => { updateTimeSetting(timing, 'start', e.target.value); updateTimeSetting(timing, 'end', e.target.value) }} />
                    </div>
                  ) : (
                    /* 時間帯（開始〜終了） */
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
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary w-full text-base">
            {saving ? '保存中...' : '保存する'}
          </button>

          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary w-full">
            キャンセル
          </button>
        </form>
      </main>
    </div>
  )
}
