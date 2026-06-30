import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// 年齢計算（誕生日 → 歳）
const calcAge = (birthday) => {
  if (!birthday) return null
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ペット一覧画面：ペットカードを縦1列で表示（カード2枚並べず）
export default function PetListPage() {
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuth()

  // ペット一覧をSupabaseから取得
  const fetchPets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('pets')
      .select('*, medicines(id, name, is_active)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(30)   // 上限30頭

    if (!error) setPets(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchPets() }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="ペット一覧" />
        <div className="flex justify-center items-center py-20 text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="ペット一覧" />

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-4 pb-24">
        {pets.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🐾</p>
            <p className="font-medium">まだペットが登録されていません</p>
            <p className="text-sm mt-1">下のボタンから登録しましょう</p>
          </div>
        ) : (
          pets.map((pet) => {
            const age = calcAge(pet.birthday)
            const activeMeds = (pet.medicines ?? []).filter((m) => m.is_active)

            return (
              // カード全体がボタン → ペット設定画面へ
              <button
                key={pet.id}
                onClick={() => navigate(`/pets/${pet.id}/edit`)}
                className="card text-left hover:shadow-md active:scale-[0.99] transition-all w-full"
              >
                <div className="flex items-center gap-4">
                  {/* ペットアイコン */}
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden border-2 border-purple-200">
                    {pet.icon_type === 'photo' && pet.icon_value
                      ? <img src={pet.icon_value} alt={pet.name} className="w-full h-full object-cover" />
                      : <span>{pet.icon_value ?? '🐾'}</span>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* 名前 */}
                    <h2 className="text-base font-bold text-gray-800">{pet.name}</h2>

                    {/* 誕生日・年齢・体重 */}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {pet.birthday && (
                        <span className="text-xs text-gray-500">
                          🎂 {pet.birthday}
                          {age !== null && ` (${age}歳)`}
                        </span>
                      )}
                      {pet.weight && (
                        <span className="text-xs text-gray-500">⚖️ {pet.weight}kg</span>
                      )}
                    </div>

                    {/* 投薬中の薬タグ */}
                    {activeMeds.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {activeMeds.map((m) => (
                          <span key={m.id} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            💊 {m.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">投薬中の薬なし</p>
                    )}
                  </div>

                  {/* 矢印 */}
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })
        )}
      </main>

      {/* 新規ペット登録ボタン（画面下部固定） */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          {pets.length >= 30 ? (
            <p className="text-center text-sm text-gray-400">登録上限（30頭）に達しています</p>
          ) : (
            <button
              onClick={() => navigate('/pets/new')}
              className="btn btn-primary w-full text-base"
            >
              ＋ 新しいペットを登録する
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
