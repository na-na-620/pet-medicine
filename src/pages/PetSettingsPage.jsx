import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// デフォルトアイコン選択肢
const DEFAULT_ICONS = ['🐕', '🐈', '🐇', '🐹', '🦜', '🐢', '🐠', '🦎', '🐾']

// 年齢計算
const calcAge = (birthday) => {
  if (!birthday) return null
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() - birth.getMonth() < 0 ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

// ペット設定画面（新規登録 / 既存編集）
export default function PetSettingsPage() {
  const { petId } = useParams()
  const isEdit = !!petId
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef()

  const [name, setName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [weight, setWeight] = useState('')
  const [iconType, setIconType] = useState('emoji')   // 'emoji' or 'photo'
  const [iconValue, setIconValue] = useState('🐕')
  const [iconPreview, setIconPreview] = useState(null) // photoのプレビューURL
  const [medicines, setMedicines] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  // 編集時は既存データを取得
  useEffect(() => {
    if (!isEdit) return
    const fetchPet = async () => {
      const { data } = await supabase
        .from('pets')
        .select('*, medicines(*)')
        .eq('id', petId)
        .single()
      if (data) {
        setName(data.name ?? '')
        setBirthday(data.birthday ?? '')
        setWeight(data.weight?.toString() ?? '')
        setIconType(data.icon_type ?? 'emoji')
        setIconValue(data.icon_value ?? '🐕')
        if (data.icon_type === 'photo') setIconPreview(data.icon_value)
        setMedicines(data.medicines ?? [])
      }
      setLoading(false)
    }
    fetchPet()
  }, [petId])

  // 写真選択 → Supabase Storageにアップロード
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // プレビュー表示
    const previewUrl = URL.createObjectURL(file)
    setIconPreview(previewUrl)
    setIconType('photo')

    // Supabase Storageにアップロード
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('pet-icons').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('pet-icons').getPublicUrl(path)
      setIconValue(urlData.publicUrl)
    }
  }

  // 保存処理（新規 or 更新）
  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('名前を入力してください'); return }
    setSaving(true)

    const payload = {
      user_id: user.id,
      name: name.trim(),
      birthday: birthday || null,
      weight: weight ? parseFloat(weight) : null,
      icon_type: iconType,
      icon_value: iconValue,
    }

    let error
    if (isEdit) {
      ({ error } = await supabase.from('pets').update(payload).eq('id', petId))
    } else {
      ({ error } = await supabase.from('pets').insert(payload))
    }

    setSaving(false)
    if (error) { setError('保存に失敗しました'); return }
    navigate('/pets')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Header title="ペット設定" />
      <div className="flex justify-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  const age = calcAge(birthday)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={isEdit ? 'ペット設定（編集）' : 'ペットを新規登録'} />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* アイコン設定 */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-3">アイコン</h2>

            {/* アイコンプレビュー */}
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center text-5xl overflow-hidden border-2 border-purple-200">
                {iconType === 'photo' && iconPreview
                  ? <img src={iconPreview} alt="icon" className="w-full h-full object-cover" />
                  : <span>{iconValue}</span>
                }
              </div>
            </div>

            {/* デフォルト絵文字 */}
            <p className="label">デフォルトアイコンから選択</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {DEFAULT_ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon}
                  onClick={() => { setIconType('emoji'); setIconValue(icon); setIconPreview(null) }}
                  className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all ${
                    iconType === 'emoji' && iconValue === icon
                      ? 'bg-purple-200 ring-2 ring-purple-500'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>

            {/* 写真アップロード */}
            <p className="label">または写真をアップロード</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary text-sm">
              📷 写真を選択
            </button>
          </div>

          {/* 基本情報 */}
          <div className="card flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-700">基本情報</h2>

            <div>
              <label className="label">名前 <span className="text-red-400">*</span></label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ポチ" required />
            </div>

            <div>
              <label className="label">誕生日</label>
              <input className="input" type="date" value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={new Date().toISOString().slice(0, 10)} />
              {age !== null && (
                <p className="text-xs text-gray-400 mt-1">→ 現在 {age}歳</p>
              )}
            </div>

            <div>
              <label className="label">体重（kg）</label>
              <input className="input" type="number" step="0.1" min="0" value={weight}
                onChange={(e) => setWeight(e.target.value)} placeholder="3.5" />
            </div>
          </div>

          {/* エラー */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary w-full text-base">
            {saving ? '保存中...' : '保存する'}
          </button>
        </form>

        {/* 薬設定セクション（編集時のみ） */}
        {isEdit && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700">登録済みの薬</h2>
              <button
                onClick={() => navigate(`/pets/${petId}/medicines/new`)}
                className="btn btn-secondary text-sm py-1.5 px-3"
              >
                ＋ 薬を追加
              </button>
            </div>

            {medicines.length === 0 ? (
              <div className="card text-center py-6 text-gray-400 text-sm">
                <p>まだ薬が登録されていません</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {medicines.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => navigate(`/pets/${petId}/medicines/${med.id}/edit`)}
                    className="card flex items-center gap-3 text-left hover:shadow-md transition-all"
                  >
                    <span className="text-2xl">{med.icon ?? '💊'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{med.name}</p>
                      <p className="text-xs text-gray-400">{med.efficacy}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      med.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {med.is_active ? '投薬中' : '停止中'}
                    </span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
