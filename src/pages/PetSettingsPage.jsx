import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// デフォルトアイコン（正面向きの絵文字に統一）
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

// アイコン値のパース
const parseIcon = (iconType, iconValue) => {
  if (iconType !== 'photo' || !iconValue) return { type: 'emoji', emoji: iconValue ?? '🐶' }
  try {
    const p = JSON.parse(iconValue)
    return { type: 'photo', url: p.url, x: p.x ?? 50, y: p.y ?? 50 }
  } catch {
    return { type: 'photo', url: iconValue, x: 50, y: 50 }
  }
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

  // アイコン状態
  const [iconType, setIconType] = useState('emoji')
  const [selectedEmoji, setSelectedEmoji] = useState('🐶')
  const [photoPreview, setPhotoPreview] = useState(null)  // ローカルblob URL（表示用）
  const [photoPublicUrl, setPhotoPublicUrl] = useState(null) // Storageの公開URL（保存用）
  const [photoPos, setPhotoPos] = useState({ x: 50, y: 50 }) // 写真の表示位置（%）
  const [uploading, setUploading] = useState(false)

  // ドラッグ状態（refで管理してrerender不要に）
  const isDragging = useRef(false)
  const dragOrigin = useRef({ clientX: 0, clientY: 0, x: 50, y: 50 })

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

  // 写真選択 → プレビュー表示 → Supabase Storageにアップロード
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // 同じファイルの再選択を可能にする

    // まずローカルプレビューを表示
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    setPhotoPos({ x: 50, y: 50 })
    setUploading(true)

    // Supabase Storageにアップロード
    const ext = file.name.split('.').pop()
    const path = `pets/${user.id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('pet-icons')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError('写真のアップロードに失敗しました。Storageの設定を確認してください。')
      setPhotoPreview(null)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('pet-icons').getPublicUrl(path)
    // アップロード成功後にのみ iconType を photo に設定
    setPhotoPublicUrl(urlData.publicUrl)
    setIconType('photo')
    setUploading(false)
  }

  // ドラッグ開始（マウス）
  const handleMouseDown = (e) => {
    if (iconType !== 'photo') return
    isDragging.current = true
    dragOrigin.current = { clientX: e.clientX, clientY: e.clientY, x: photoPos.x, y: photoPos.y }
    e.preventDefault()
  }

  // ドラッグ移動（マウス）
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

  // ドラッグ開始（タッチ）
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

  // 保存処理（アイコン値はJSONで位置情報も保持）
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
    }

    let err
    if (isEdit) {
      ({ error: err } = await supabase.from('pets').update(payload).eq('id', petId))
    } else {
      ({ error: err } = await supabase.from('pets').insert(payload))
    }

    setSaving(false)
    if (err) { setError('保存に失敗しました'); return }
    navigate('/pets')
  }

  if (loading) return (
    <div className="min-h-screen">
      <Header title="ペット設定" />
      <div className="flex justify-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  const age = calcAge(birthday)

  // 現在表示するアイコン情報
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
        {/* 戻るリンク */}
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 mb-4">
          ← トップへ戻る
        </button>

        <form onSubmit={handleSave} className="flex flex-col gap-5">

          {/* アイコン設定 */}
          <div className="card">
            <h2 className="text-sm font-bold text-gray-700 mb-4">アイコン</h2>

            {/* Gmail風アバター（アバター本体 or 右下カメラバッジをクリックで写真選択） */}
            <div className="flex flex-col items-center mb-5">
              <div className="relative inline-block">
                {/* アバター本体 */}
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

                {/* 右下カメラバッジ（クリックで写真選択） */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-1 right-1 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center border-2 border-white hover:bg-gray-700 transition-colors shadow-md"
                  title="写真を変更"
                >
                  {/* カメラアイコン */}
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>

              {/* 写真選択時のドラッグ説明 */}
              {displayPhoto && (
                <p className="text-xs text-gray-400 mt-2">ドラッグして表示位置を調整できます</p>
              )}
              {uploading && (
                <p className="text-xs text-purple-500 mt-1">アップロード中...</p>
              )}
            </div>

            {/* 隠しファイル入力 */}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

            {/* デフォルト絵文字選択 */}
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
            <div>
              <label className="label">誕生日</label>
              <input className="input" type="date" value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={new Date().toISOString().slice(0, 10)} />
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
                  // 薬アイコンがURL形式（写真）かどうか判定
                  const isPhotoIcon = med.icon?.startsWith('http') || med.icon?.startsWith('/')
                  return (
                    <button
                      key={med.id}
                      onClick={() => navigate(`/pets/${petId}/medicines/${med.id}/edit`)}
                      className="card flex items-center gap-3 text-left hover:shadow-md transition-all"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">
                        {isPhotoIcon
                          ? <img src={med.icon} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display='none' }} />
                          : <span>{med.icon ?? '💊'}</span>
                        }
                      </div>
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
