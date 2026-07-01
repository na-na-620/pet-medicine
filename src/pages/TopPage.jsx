import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import DateSlider from '../components/DateSlider'
import PillBar from '../components/PillBar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIMING_ORDER = ['朝', '昼', '晩', '食前', '食後', '起床時', '就寝前', 'その他']

const getStatusBadge = (pct) => {
  if (pct >= 100) return { label: '投薬済み', cls: 'bg-emerald-100 text-emerald-700' }
  if (pct > 0)    return { label: '一部済み', cls: 'bg-amber-100 text-amber-700' }
  return { label: '未投薬', cls: 'bg-gray-100 text-gray-500' }
}

const formatTime = (entry) => {
  if (entry.timeType === 'range') return `${entry.timeStart}〜${entry.timeEnd}`
  return entry.timeStart
}

const getGroupTimeLabel = (entries) => {
  const starts = entries.map((e) => e.timeStart).sort()
  const ends   = entries.map((e) => e.timeEnd).sort()
  const earliest = starts[0]
  const latest   = ends[ends.length - 1]
  return earliest === latest ? earliest : `${earliest}〜${latest}`
}

// トップ画面
export default function TopPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const lastLoadedDate = useRef('')

  // ===== DBからスケジュールを取得 =====
  const fetchSchedule = async (date) => {
    setLoading(true)
    try {
      // アクティブな薬とペット情報を取得（RLSにより自分の薬のみ返る）
      const { data: medicines, error } = await supabase
        .from('medicines')
        .select('id, name, efficacy, timings, time_settings, dose_amount, interval_hours, pets(id, name, icon_type, icon_value)')
        .eq('is_active', true)

      if (error || !medicines?.length) {
        setSchedule([])
        setLoading(false)
        return
      }

      // 対象日の投薬ログを取得
      const logDate = date.toISOString().slice(0, 10)
      const { data: logs } = await supabase
        .from('medication_logs')
        .select('medicine_id, timing, administered_percent, note')
        .eq('log_date', logDate)

      // medicine_id + timing をキーにログをマップ化
      const logsMap = {}
      ;(logs ?? []).forEach((l) => { logsMap[`${l.medicine_id}_${l.timing}`] = l })

      // タイミングごとにエントリをグループ化
      const timingMap = {}
      medicines.forEach((med) => {
        const pet = med.pets
        if (!pet) return
        // ペットアイコンは絵文字のみ表示（一覧での写真表示はPetListPageで行う）
        const petIcon = pet.icon_type === 'emoji' ? (pet.icon_value ?? '🐾') : '🐾'

        ;(med.timings ?? []).forEach((timing) => {
          if (!timingMap[timing]) timingMap[timing] = []
          const ts = med.time_settings?.[timing] ?? { type: 'point', start: '08:00', end: '08:00' }
          const log = logsMap[`${med.id}_${timing}`]

          timingMap[timing].push({
            id: `${med.id}_${timing}`,
            petId: pet.id,
            petName: pet.name,
            petIcon,
            medicineId: med.id,
            medicineName: med.name,
            efficacy: med.efficacy ?? '',
            doseAmount: med.dose_amount ?? '1錠',
            administered: log?.administered_percent ?? 0,
            intervalHours: med.interval_hours ?? 8,
            timeType: ts.type ?? 'point',
            timeStart: ts.start ?? '08:00',
            timeEnd: ts.end ?? '08:00',
            note: log?.note ?? '',
          })
        })
      })

      // タイミング順にソートしてスケジュールを構築
      const newSchedule = []
      TIMING_ORDER.forEach((t) => { if (timingMap[t]) newSchedule.push({ timing: t, entries: timingMap[t] }) })
      Object.keys(timingMap).forEach((t) => {
        if (!TIMING_ORDER.includes(t)) newSchedule.push({ timing: t, entries: timingMap[t] })
      })

      setSchedule(newSchedule)
    } catch {
      setSchedule([])
    }
    setLoading(false)
  }

  // 日付変更時のみDBから再取得（同じ日付なら再取得しない）
  useEffect(() => {
    const dateStr = selectedDate.toDateString()
    if (lastLoadedDate.current === dateStr) return
    lastLoadedDate.current = dateStr
    fetchSchedule(selectedDate)
  }, [selectedDate])

  // ===== MedicationStatusPageから戻った時に更新済みスケジュール全体を受け取る =====
  // 【バグ修正】以前はlocation.stateでエントリのみを更新していたが、
  // TopPageが再マウント時にDBから再取得してしまうため反映されなかった。
  // 修正：スケジュール全体をMedicationStatusPageに渡し、更新済み全体を受け取る。
  useEffect(() => {
    if (!location.state?.updatedSchedule) return
    setSchedule(location.state.updatedSchedule)
    lastLoadedDate.current = selectedDate.toDateString() // 日付変更時の再取得を防ぐ
    window.history.replaceState({}, document.title)
  }, [location.state])

  // 投薬状況登録画面へ遷移（スケジュール全体も渡す）
  const handleRegister = (group) => {
    navigate('/medication-status', {
      state: {
        timing: group.timing,
        date: selectedDate.toISOString(),
        entries: group.entries,
        fullSchedule: schedule,  // 全タイミングのスケジュールも渡す
      },
    })
  }

  return (
    <div className="min-h-screen">
      <Header title="本日の投薬予定" />
      <DateSlider selectedDate={selectedDate} onSelect={setSelectedDate} />

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4 pb-10">
        {loading ? (
          <div className="text-center py-16 text-gray-400">読み込み中...</div>
        ) : schedule.length === 0 ? (
          <div className="card text-center py-14">
            <p className="text-4xl mb-3">🐾</p>
            <p className="font-bold text-gray-600 mb-1">この日の投薬予定はありません</p>
            <p className="text-sm text-gray-400 mb-5">ペット・薬の設定をすると投薬予定が表示されます</p>
            <button onClick={() => navigate('/pets')} className="btn btn-primary px-6">
              ペット・薬を設定する
            </button>
          </div>
        ) : (
          schedule.map((group) => {
            const allDone = group.entries.every((e) => e.administered >= 100)
            const groupTimeLabel = getGroupTimeLabel(group.entries)
            return (
              <section key={group.timing} className="card">
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
                          <PillBar doseAmount={entry.doseAmount} administered={entry.administered} showLabel />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </main>
    </div>
  )
}
