import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEFAULT_ICONS = ['🐶', '🐱', '🐰', '🐹', '🦜', '🐢', '🐠', '🦎', '🐾']

const calcAge = (birthday) => {
  if (!birthday) return null
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() - birth.getMonth() < 0 ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

const parseIcon = (iconType, iconValue) => {
  if (iconType !== 'photo' || !iconValue) return { type: 'emoji', emoji: iconValue ?? '🐶' }
  try {
    const p = JSON.parse(iconValue)
    return { type: 'photo', url: p.url, x: p.x ?? 50, y: p.y ?? 50 }
  } catch {
    return { type: 'photo', url: iconValue, x: 50, y: 50 }
  }
}

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

// ペット設定画面（新規登録 / 既存編集）
export default function PetSettingsPage() {
  const { petId } = useParams()
  const isEdit = !!petId
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef()

  const [name, setName] = useState('')
  // 誕生日：年・月・日に分けて管理（一桁ずつ編集しやすいように）
  const [birthYear,  setBirthYear]  = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay,   setBirthDay]   = useState('')
  const [weight, setWeight] = useState('')
  const [inHeaven, setInHeaven] = useState(false)
  // 旅立った日：年・月・日に分けて管理
  const [deathYear,  setDeathYear]  = useState('')
  const [deathMonth, setDeathMonth] = useState('')
  const [deathDay,   setDeathDay]   = useState('')

  // アイコン状態
  const [iconType, setIconType] = useState('emoji')
  const [selectedEmoji, setSelectedEmoji] = useState('🐶')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoPublicUrl, setPhotoPublicUrl] = useState(null)
  const [photoPos, setPhotoPos] = useState({ x: 50, y: 50 })
  const [uploading, setUploading] = useState(false)

  const isDragging = useRef(false)
  const dragOrigin = useRef({ clientX: 0, clientY: 0, x: 50, y: 50 })

  const [medicines, setMedicines] = useState([])
  const [deletingMedId, setDeletingMedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(isEdit)

  // 結合した誕生日・旅立ち日（YYYY-MM-DD）
  const birthday = birthYear && birthMonth && birthDay
    ? `${String(birthYear).padStart(4, '0')}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`
    : ''
  const deathDate = deathYear && deathMonth && deathDay
    ? `${String(deathYear).padStart(4, '0')}-${String(deathMonth).padStart(2, '0')}-${String(deathDay).padStart(2, '0')}`
    : ''

  const age = calcAge(birthday)

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
        if (data.birthday) {
          const [y, m, d] = data.birthday.split('-')
          setBirthYear(y)
          setBirthMonth(String(parseInt(m, 10)))
          setBirthDay(String(parseInt(d, 10)))
        }
        setWeight(data.weight?.toString() ?? '')
        setInHeaven(data.in_heaven ?? false)
        if (data.death_date) {
          const [y, m, d] = data.death_date.split('-')
          setDeathYear(y)
          setDeathMonth(String(parseInt(m, 10)))
          setDeathDay(String(parseInt(d, 10)))
        }
        const icon = parseIcon(data.icon_type, data.icon_value)
        if (icon.type === 'photo') {
          setIconType('photo')
          setPhotoPreview(icon.url)
          setPhotoPublicUrl(icon.url)
          setPhotoPos({ x: icon.x, y: icon.y })
        } else {
          setIconType('emoji')
          setSelectedEmoji(icon.emoji ?? '🐶')
        }
        setMedicines(data.medicines ?? [])
      }
      setLoading(false)
    }
    fetchPet()
  }, [petId])

  // 写真アップロード
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    setPhotoPos({ x: 50, y: 50 })
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `pets/${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('pet-icons')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      const msg = uploadErr.message?.toLowerCase().includes('not found')
        ? '写真のアップロードに失敗しました。Supabase Storageの「pet-icons」バケットとアップロードポリシーが設定されているか確認してください。'
        : `写真のアップロードに失敗しました（${uploadErr.message}）。Storage設定を確認してください。`
      setError(msg)
      setIconType('emoji')
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('pet-icons').getPublicUrl(path)
    setPhotoPublicUrl(urlData.publicUrl)
    setIconType('photo')
    setUploading(false)
  }

  // ドラッグ（マウス）
  const handleMouseDown = (e) => {
    if (iconType !== 'photo') return
    isDragging.current = true
    dragOrigin.current = { clientX: e.clientX, clientY: e.clientY, x: photoPos.x, y: photoPos.y }
    e.preventDefault()
  }

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragOrigin.current.clientX
    const dy = e.clientY - dragOrigin.current.clientY
    setPhotoPos({
      x: Math.min(100, Math.max(0, dragOrigin.current.x - dx * 0.5)),
      y: Math.min(100, Math.max(0, dragOrigin.current.y - dy * 0.5)),
    })
  }, [])

  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])

  // ドラッグ（タッチ）
  const handleTouchStart = (e) => {
    if (iconType !== 'photo') return
    const t = e.touches[0]
    isDragging.current = true
    dragOrigin.current = { clientX: t.clientX, clientY: t.clientY, x: photoPos.x, y: photoPos.y }
  }

  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current) return
    const t = e.touches[0]
    const dx = t.clientX - dragOrigin.current.clientX
    const dy = t.clientY - dragOrigin.current.clientY
    setPhotoPos({
      x: Math.min(100, Math.max(0, dragOrigin.current.x - dx * 0.5)),
      y: Math.min(100, Math.max(0, dragOrigin.current.y - dy * 0.5)),
    })
    e.preventDefault()
  }, [])

  // 「旅立った子」トグル変更
  // ONにしたら：旅立ち日をクリア待ち表示 + すべての薬を投薬停止に
  const handleInHeavenChange = async (checked) => {
    setInHeaven(checked)
    if (!checked) {
      setDeathYear('')
      setDeathMonth('')
      setDeathDay('')
    }
    if (checked && isEdit && medicines.length > 0) {
      const { error: updErr } = await supabase
        .from('medicines')
        .update({ is_active: false })
        .eq('pet_id', petId)
      if (!updErr) {
        setMedicines((prev) => prev.map((m) => ({ ...m, is_active: false })))
      }
    }
  }

  // 保存
  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('名前を入力してください'); return }
    setSaving(true)

    let saveIconType = iconType
    let saveIconValue = ''
    if (iconType === 'photo' && photoPublicUrl) {
      saveIconValue = JSON.stringify({ url: photoPublicUrl, x: photoPos.x, y: photoPos.y })
    } else {
      saveIconType = 'emoji'
      saveIconValue = selectedEmoji
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      birthday: birthday || null,
      weight: weight ? parseFloat(weight) : null,
      icon_type: saveIconType,
      icon_value: saveIconValue,
      in_heaven: inHeaven,
      death_date: inHeaven && deathDate ? deathDate : null,
    }

    let err
    if (isEdit) {
      ({ error: err } = await supabase.from('pets').update(payload).eq('id', petId))
    } else {
      ({ error: err } = await supabase.from('pets').insert(payload))
    }

    if (!err && isEdit && inHeaven && deathDate) {
      // お空の子として保存する場合、すべての薬を停止にして旅立ち日を終了日に設定
      const { error: medErr } = await supabase
        .from('medicines')
        .update({ is_active: false, end_date: deathDate })
        .eq('pet_id', petId)
      if (!medErr) {
        setMedicines((prev) => prev.map((m) => ({ ...m, is_active: false, end_date: deathDate })))
      }
    }

    setSaving(false)
    if (err) { setError('保存に失敗しました'); return }
    navigate('/pets')
  }

  // 薬を削除
  const handleDeleteMedicine = async (med) => {
    const confirmed = window.confirm(`「${med.name}」を削除しますか？\nこの操作は取り消せません。`)
    if (!confirmed) return
    setDeletingMedId(med.id)
    const { error: delErr } = await supabase.from('medicines').delete().eq('id', med.id)
    if (delErr) {
      setError('薬の削除に失敗しました')
    } else {
      setMedicines((prev) => prev.filter((m) => m.id !== med.id))
    }
    setDeletingMedId(null)
  }

  if (loading) return (
    <div className="min-h-screen">
      <Header title="ペット設定" />
      <div className="flex justify-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  const displayPhoto = iconType === 'photo' && photoPreview
  const displayEmoji = !displayPhoto ? selectedEmoji : null

  return (
    <div
      className="min-h-screen"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Header title={isEdit ? 'ペット設定（編集）' : 'ペットを新規登録'} />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        <button onClick={() => navigate('/pets')} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-4">
          ← ペット一覧へ戻る
        </button>

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* アイコン設定 */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-4">アイコン</h2>

            <div className="flex flex-col items-center mb-5">
              <div className="relative inline-block">
                <div
                  className={`w-28 h-28 rounded-full overflow-hidden border-4 border-purple-200 select-none flex items-center justify-center bg-purple-100 ${
                    displayPhoto ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  }`}
                  onClick={() => !displayPhoto && fileRef.current?.click()}
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleMouseUp}
                >
                  {displayPhoto ? (
                    <img
                      src={photoPreview}
                      alt="アイコン"
                      className="w-full h-full object-cover pointer-events-none"
                      style={{ objectPosition: `${photoPos.x}% ${photoPos.y}%` }}
                      draggable={false}
                    />
                  ) : (
                    <span className="text-6xl">{displayEmoji}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-1 right-1 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center border-2 border-white hover:bg-gray-700 transition-colors shadow-md"
                  title="写真を変更"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {displayPhoto && (
                <p className="text-xs text-gray-400 mt-2">ドラッグして表示位置を調整できます</p>
              )}
              {uploading && (
                <p className="text-xs text-purple-500 mt-1">アップロード中...</p>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

            <p className="label mb-2">デフォルトアイコンから選択</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_ICONS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => { setIconType('emoji'); setSelectedEmoji(emoji); setPhotoPreview(null); setPhotoPublicUrl(null) }}
                  className={`w-11 h-11 rounded-2xl text-2xl flex items-center justify-center transition-all ${
                    iconType === 'emoji' && selectedEmoji === emoji
                      ? 'bg-purple-200 ring-2 ring-purple-500 scale-110'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 基本情報 */}
          <div className="card flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-700">基本情報</h2>

            <div>
              <label className="label">名前 <span className="text-red-400">*</span></label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ポチ" required />
            </div>

            {/* 誕生日：年・月・日を分けて入力 */}
            <div>
              <label className="label">誕生日</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 80 }}
                  placeholder="2020" value={birthYear} onChange={(e) => setBirthYear(e.target.value)}
                  min="1990" max={new Date().getFullYear()} />
                <span className="text-gray-500 text-sm">年</span>
                <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 60 }}
                  placeholder="1" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} min="1" max="12" />
                <span className="text-gray-500 text-sm">月</span>
                <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 60 }}
                  placeholder="1" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} min="1" max="31" />
                <span className="text-gray-500 text-sm">日</span>
              </div>
              {age !== null && <p className="text-xs text-gray-400 mt-1">→ 現在 {age}歳</p>}
            </div>

            <div>
              <label className="label">体重（kg）</label>
              <input className="input" type="number" step="0.1" min="0" value={weight}
                onChange={(e) => setWeight(e.target.value)} placeholder="3.5" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">{error}</div>
          )}

          <button type="submit" disabled={saving || uploading} className="btn btn-primary w-full text-base">
            {saving ? '保存中...' : uploading ? 'アップロード中...' : '保存する'}
          </button>

          {/* お空の子設定（フォーム末尾にひそやかに） */}
          {isEdit && (
            <div className="rounded-2xl bg-gray-50/80 border border-gray-100 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">⭐ 旅立った子として記録する</p>
                  <p className="text-xs text-gray-300 mt-0.5">投薬予定から除かれ、大切な記録として残ります</p>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={inHeaven} onChange={(e) => handleInHeavenChange(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              {/* 旅立った日付入力（ONのときのみ表示） */}
              {inHeaven && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">旅立った日</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 80 }}
                      placeholder="2025" value={deathYear} onChange={(e) => setDeathYear(e.target.value)} />
                    <span className="text-gray-400 text-sm">年</span>
                    <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 60 }}
                      placeholder="1" value={deathMonth} onChange={(e) => setDeathMonth(e.target.value)} min="1" max="12" />
                    <span className="text-gray-400 text-sm">月</span>
                    <input type="number" inputMode="numeric" className="input text-center" style={{ maxWidth: 60 }}
                      placeholder="1" value={deathDay} onChange={(e) => setDeathDay(e.target.value)} min="1" max="31" />
                    <span className="text-gray-400 text-sm">日</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1.5">
                    この日までのトップ画面に投薬予定が残ります
                  </p>
                </div>
              )}
            </div>
          )}
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
              <div className="card text-center py-6 text-gray-400 text-sm">まだ薬が登録されていません</div>
            ) : (
              <div className="flex flex-col gap-2">
                {medicines.map((med) => {
                  const medIcon = parseMedIcon(med.icon)
                  return (
                    <div key={med.id} className="card flex items-center gap-3">
                      {/* 薬アイコン */}
                      <button
                        onClick={() => navigate(`/pets/${petId}/medicines/${med.id}/edit`)}
                        className="w-10 h-10 rounded-full overflow-hidden bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0"
                      >
                        {medIcon.isPhoto
                          ? <img src={medIcon.url} alt="" className="w-full h-full object-cover"
                              style={{ objectPosition: `${medIcon.x}% ${medIcon.y}%` }}
                              onError={(e) => { e.currentTarget.style.display = 'none' }} />
                          : <span>{medIcon.emoji}</span>
                        }
                      </button>

                      {/* 薬名・投薬量・タイミング */}
                      <button
                        onClick={() => navigate(`/pets/${petId}/medicines/${med.id}/edit`)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-bold text-gray-800">{med.name}</p>
                        {med.efficacy && <p className="text-xs text-gray-400">{med.efficacy}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {med.dose_amount && (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-full">
                              {med.dose_amount}
                            </span>
                          )}
                          {(med.timings ?? []).map((t) => (
                            <span key={t} className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full">
                              {t}
                            </span>
                          ))}
                        </div>
                      </button>

                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        med.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {med.is_active ? '投薬中' : '停止中'}
                      </span>

                      {/* 削除ボタン */}
                      <button
                        onClick={() => handleDeleteMedicine(med)}
                        disabled={deletingMedId === med.id}
                        className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-all flex-shrink-0"
                        title="削除"
                      >
                        {deletingMedId === med.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
