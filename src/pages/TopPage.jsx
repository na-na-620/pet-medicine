import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import DateSlider from '../components/DateSlider'
import PillBar from '../components/PillBar'

// 投薬ステータスのバッジ
const getStatusBadge = (pct) => {
  if (pct >= 100) return { label: '投薬済み', cls: 'bg-emerald-100 text-emerald-700' }
  if (pct > 0)    return { label: '一部済み', cls: 'bg-amber-100 text-amber-700' }
  return { label: '未投薬', cls: 'bg-gray-100 text-gray-500' }
}

// 時間表示（ピンポイント or 時間帯）
const formatTime = (entry) => {
  if (entry.timeType === 'range') return `${entry.timeStart}〜${entry.timeEnd}`
  return entry.timeStart
}

// タイミンググループ全体の時間帯テキスト（最早〜最遅）
const getGroupTimeLabel = (entries) => {
  const starts = entries.map((e) => e.timeStart).sort()
  const ends   = entries.map((e) => e.timeEnd).sort()
  const earliest = starts[0]
  const latest   = ends[ends.length - 1]
  return earliest === latest ? earliest : `${earliest}〜${latest}`
}

// トップ画面：選択日の投薬予定一覧
// ダミーデータなし → 初ログイン時は「投薬予定なし」表示
// MedicationStatusPageから戻った際に location.state で投薬状況を受け取り反映する
export default function TopPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedule, setSchedule] = useState([])
  const navigate = useNavigate()
  const location = useLocation()

  // 日付変更時にスケジュールを取得（本番はSupabase DBからフェッチ）
  useEffect(() => {
    // TODO: supabase から log_date = selectedDate のデータを取得
    // 現在はDBが未連携のため空リスト
    setSchedule([])
  }, [selectedDate])

  // MedicationStatusPageで変更した投薬状況をstateで受け取ってトップ画面に反映
  useEffect(() => {
    if (!location.state?.updatedTiming) return
    const { updatedTiming, updatedEntries } = location.state
    setSchedule((prev) =>
      prev.map((g) => g.timing === updatedTiming ? { ...g, entries: updatedEntries } : g)
    )
    // 二重適用を防ぐためstateをクリア
    window.history.replaceState({}, document.title)
  }, [location.state])

  // 投薬状況登録画面へ遷移（タイミングと薬一覧をstateで渡す）
  const handleRegister = (group) => {
    navigate('/medication-status', {
      state: {
        timing: group.timing,
        date: selectedDate.toISOString(),
        entries: group.entries,
      },
    })
  }

  return (
    <div className="min-h-screen">
      <Header title="本日の投薬予定" />
      <DateSlider selectedDate={selectedDate} onSelect={setSelectedDate} />

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4 pb-10">
        {/* スケジュールが空の場合（初ログイン時や投薬設定なし） */}
        {schedule.length === 0 && (
          <div className="card text-center py-14">
            <p className="text-4xl mb-3">🐾</p>
            <p className="font-bold text-gray-600 mb-1">この日の投薬予定はありません</p>
            <p className="text-sm text-gray-400 mb-5">ペット・薬の設定をすると投薬予定が表示されます</p>
            <button onClick={() => navigate('/pets')} className="btn btn-primary px-6">
              ペット・薬を設定する
            </button>
          </div>
        )}

        {schedule.map((group) => {
          const allDone = group.entries.every((e) => e.administered >= 100)
          const groupTimeLabel = getGroupTimeLabel(group.entries)

          return (
            <section key={group.timing} className="card">
              {/* タイミングヘッダー */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {group.timing}
                  </span>
                  <span className="text-xs text-gray-400">{groupTimeLabel}</span>
                </div>
                <button
                  onClick={() => handleRegister(group)}
                  className={`btn text-sm py-1.5 px-4 ${allDone ? 'btn-success' : 'btn-primary'}`}
                >
                  {allDone ? '✓ 投薬済み' : '投薬状況を登録'}
                </button>
              </div>

              {/* 各薬カード */}
              <div className="flex flex-col gap-3">
                {group.entries.map((entry) => {
                  const badge = getStatusBadge(entry.administered)
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl flex-shrink-0">
                        {entry.petIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-xs font-bold text-purple-700">{entry.petName}</span>
                          <span className="text-sm font-bold text-gray-800">{entry.medicineName}</span>
                          <span className="text-xs text-gray-400">{entry.efficacy}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mb-1.5">投薬時間：{formatTime(entry)}</p>
                        {/* showLabel=true でPillBar内に処方量を表示 */}
                        <PillBar doseAmount={entry.doseAmount} administered={entry.administered} showLabel />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
