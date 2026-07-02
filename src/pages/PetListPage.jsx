import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// 薬のアイコン値（絵文字 or JSON写真）をパース
const parseMedIcon = (iconValue) => {
  if (!iconValue) return { isPhoto: false, emoji: '💊' }
  try {
    const p = JSON.parse(iconValue)
    if (p.url) return { isPhoto: true, url: p.url, x: p.x ?? 50, y: p.y ?? 50 }
  } catch {}
  if (iconValue.startsWith('http') || iconValue.startsWith('/')) return { isPhoto: true, url: iconValue, x: 50, y: 50 }
  return { isPhoto: false, emoji: iconValue }
}

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
  if (iconType !== 'photo' || !iconValue) return { type: 'emoji', emoji: iconValue ?? '🐾' }
  try {
    const p = JSON.parse(iconValue)
    return { type: 'photo', url: p.url, x: p.x ?? 50, y: p.y ?? 50 }
  } catch {
    return { type: 'photo', url: iconValue, x: 50, y: 50 }
  }
}

// ペット一覧画面
export default function PetListPage() {
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  const fetchPets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('pets')
      .select('*, medicines(id, name, is_active, icon)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(30)
    if (!error) setPets(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchPets() }, [])

  const handleDelete = async (pet) => {
    const confirmed = window.confirm(
      `「${pet.name}」を削除しますか？\n登録されている薬や投薬記録もすべて削除されます。\nこの操作は取り消せません。`
    )
    if (!confirmed) return
    setDeletingId(pet.id)
    const { error } = await supabase.from('pets').delete().eq('id', pet.id)
    if (error) {
      alert('削除に失敗しました。しばらく後にもう一度お試しください。')
    } else {
      setPets((prev) => prev.filter((p) => p.id !== pet.id))
    }
    setDeletingId(null)
  }

  if (loading) return (
    <div className="min-h-screen">
      <Header title="ペット一覧" />
      <div className="flex justify-center items-center py-20 text-gray-400">読み込み中...</div>
    </div>
  )

  const regularPets  = pets.filter((p) => !p.in_heaven)
  const inHeavenPets = pets.filter((p) =>  p.in_heaven)

  const PetCard = ({ pet, dimmed = false }) => {
    const age    = calcAge(pet.birthday)
    const active = (pet.medicines ?? []).filter((m) => m.is_active)
    const icon   = parseIcon(pet.icon_type, pet.icon_value)

    return (
      <div className={`card flex items-center gap-4 transition-all ${dimmed ? 'opacity-70' : 'hover:shadow-md'}`}>
        {/* アイコン（クリックで設定画面へ） */}
        <button
          onClick={() => navigate(`/pets/${pet.id}/edit`)}
          className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden border-2 border-purple-200 hover:ring-2 hover:ring-purple-400 transition-all"
        >
          {icon.type === 'photo' ? (
            <img
              src={icon.url}
              alt={pet.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: `${icon.x}% ${icon.y}%` }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <span>{icon.emoji}</span>
          )}
        </button>

        {/* ペット情報（クリックで設定画面へ） */}
        <button
          onClick={() => navigate(`/pets/${pet.id}/edit`)}
          className="flex-1 min-w-0 text-left"
        >
          <h2 className="text-base font-bold text-gray-800">{pet.name}</h2>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {pet.birthday && (
              <span className="text-xs text-gray-500">
                🎂 {pet.birthday}{age !== null && ` (${age}歳)`}
              </span>
            )}
            {pet.weight && <span className="text-xs text-gray-500">⚖️ {pet.weight}kg</span>}
          </div>
          {active.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {active.map((m) => {
                const medIcon = parseMedIcon(m.icon)
                return (
                  <span key={m.id} className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    {medIcon.isPhoto ? (
                      <img src={medIcon.url} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0"
                        style={{ objectPosition: `${medIcon.x}% ${medIcon.y}%` }}
                        onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    ) : medIcon.emoji}
                    {m.name}
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              {dimmed ? 'お薬の記録なし' : '投薬中の薬なし'}
            </p>
          )}
        </button>

        {/* 削除ボタン */}
        <button
          onClick={() => handleDelete(pet)}
          disabled={deletingId === pet.id}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-all"
          title="削除"
        >
          {deletingId === pet.id ? (
            <span className="text-xs text-gray-300">...</span>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header title="ペット一覧" />

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4 pb-24">
        {/* 戻るリンク（トップへ） */}
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800">
          ← トップへ戻る
        </button>

        {regularPets.length === 0 && inHeavenPets.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🐾</p>
            <p className="font-medium">まだペットが登録されていません</p>
            <p className="text-sm mt-1">下のボタンから登録しましょう</p>
          </div>
        ) : (
          <>
            {/* 通常ペット一覧 */}
            {regularPets.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}

            {/* お空の子セクション（絵本のようなあたたかみのあるレイアウト） */}
            {inHeavenPets.length > 0 && (
              <div className="mt-4">
                {/* 区切り線 */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                  <span className="text-xs text-amber-400 font-medium tracking-wide">☁️ お空のこたち</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                </div>

                {/* あたたかみのあるメッセージ */}
                <div className="rounded-3xl border border-amber-100 bg-gradient-to-b from-amber-50/60 to-orange-50/30 px-5 pt-4 pb-5">
                  <p className="text-center text-xs text-amber-600/80 font-medium mb-4 leading-relaxed">
                    虹の橋のたもとで、いつもそばにいるよ ✨
                  </p>
                  <div className="flex flex-col gap-3">
                    {inHeavenPets.map((pet) => (
                      <PetCard key={pet.id} pet={pet} dimmed />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 新規登録ボタン（画面下部固定） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          {pets.length >= 30 ? (
            <p className="text-center text-sm text-gray-400">登録上限（30頭）に達しています</p>
          ) : (
            <button onClick={() => navigate('/pets/new')} className="btn btn-primary w-full text-base">
              ＋ 新しいペットを登録する
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
