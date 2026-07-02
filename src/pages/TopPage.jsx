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

// ペットのアイコン値（絵文字 or JSON写真）をパース
const parsePetIcon = (iconType, iconValue) => {
  if (iconType !== 'photo' || !iconValue) return { type: 'emoji', emoji: iconValue ?? '🐾' }
  try {
    const p = JSON.parse(iconValue)
    return { type: 'photo', url: p.url, x: p.x ?? 50, y: p.y ?? 50 }
  } catch {
    return { type: 'photo', url: iconValue, x: 50, y: 50 }
  }
}

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

// "HH:MM" を分に変換（時刻ソートのキー計算用）
// 05:00 未満は深夜帯（翌日扱い）として +1440 し、晩などの 23 時以降より後に並ぶようにする
const timeToMinutes = (t) => {
  const [h, m] = (t ?? '00:00').split(':').map(Number)
  const mins = h * 60 + (m || 0)
  return mins < 5 * 60 ? mins + 24 * 60 : mins
}

// Date オブジェクトをローカル日付文字列（YYYY-MM-DD）に変換
// UTC変換によるタイムゾーンずれを回避するため、ローカルの年月日を使用
const toLocalDateStr = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
  // フェッチ競合防止用エポック：新しいフェッチが始まると古いfetchの結果を破棄する
  const fetchEpochRef = useRef(0)

  // ===== DBからスケジュールを取得 =====
  const fetchSchedule = async (date) => {
    const epoch = ++fetchEpochRef.current
    setLoading(true)
    try {
      const { data: medicines, error } = await supabase
        .from('medicines')
        .select('id, name, icon, efficacy, timings, time_settings, dose_amount, interval_hours, is_active, end_date, pets(id, name, icon_type, icon_value, in_heaven, death_date)')

      if (error || !medicines?.length) {
        if (epoch !== fetchEpochRef.current) return
        setSchedule([])
        setLoading(false)
        return
      }

      // medication_logs はUTCベースで保存されているのでUTC文字列で照合
      const logDate = date.toISOString().slice(0, 10)
      // death_date / end_date はユーザー入力のカレンダー日付なのでローカル日付で比較
      const localDate = toLocalDateStr(date)

      // 表示対象の薬を絞り込む
      const activeMedicines = medicines.filter((m) => {
        const pet = m.pets
        if (!pet) return false
        if (pet.in_heaven) {
          // お空の子：death_dateまでのみ表示（終了日当日を含む）
          if (!pet.death_date) return false
          if (localDate > pet.death_date) return false
          // death_date内：薬のend_dateがあればその日まで、なければdeath_dateまで（is_active不問）
          if (m.end_date) return localDate <= m.end_date
          return true
        }
        // 通常ペット：end_dateがあればその日まで（終了日当日を含む）、なければis_activeで制御
        if (m.end_date) return localDate <= m.end_date
        return m.is_active
      })

      if (!activeMedicines.length) {
        if (epoch !== fetchEpochRef.current) return
        setSchedule([])
        setLoading(false)
        return
      }

      // 対象日の投薬ログを取得
      const { data: logs } = await supabase
        .from('medication_logs')
        .select('medicine_id, timing, administered_percent, note, shared_note')
        .eq('log_date', logDate)

      const logsMap = {}
      const sharedNoteByTiming = {}
      ;(logs ?? []).forEach((l) => {
        logsMap[`${l.medicine_id}_${l.timing}`] = l
        if (l.shared_note && !sharedNoteByTiming[l.timing]) {
          sharedNoteByTiming[l.timing] = l.shared_note
        }
      })

      // タイミングごとにエントリをグループ化
      const timingMap = {}
      activeMedicines.forEach((med) => {
        const pet = med.pets
        if (!pet) return
        const petIcon = parsePetIcon(pet.icon_type, pet.icon_value)

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
            medIcon: parseMedIcon(med.icon),
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

      // 投薬時刻順にソート（グループ内で最も早い timeStart 基準、同時刻は TIMING_ORDER 順でタイブレーク）
      const newSchedule = Object.entries(timingMap)
        .map(([t, entries]) => ({
          timing: t,
          entries: [...entries].sort((a, b) => timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart)),
          sharedNote: sharedNoteByTiming[t] ?? '',
        }))
        .sort((a, b) => {
          const aMin = Math.min(...a.entries.map((e) => timeToMinutes(e.timeStart)))
          const bMin = Math.min(...b.entries.map((e) => timeToMinutes(e.timeStart)))
          if (aMin !== bMin) return aMin - bMin
          const aOrd = TIMING_ORDER.indexOf(a.timing)
          const bOrd = TIMING_ORDER.indexOf(b.timing)
          return (aOrd === -1 ? 99 : aOrd) - (bOrd === -1 ? 99 : bOrd)
        })

      if (epoch !== fetchEpochRef.current) return
      setSchedule(newSchedule)
      setLoading(false)
    } catch {
      if (epoch !== fetchEpochRef.current) return
      setSchedule([])
      setLoading(false)
    }
  }

  // 日付変更時のみDBから再取得
  useEffect(() => {
    const dateStr = selectedDate.toDateString()
    if (lastLoadedDate.current === dateStr) return
    lastLoadedDate.current = dateStr
    fetchSchedule(selectedDate)
  }, [selectedDate])

  // MedicationStatusPageから戻った時の処理
  // ※ このeffectは日付effectより後に定義されているため、同一レンダーでは後に実行される
  //   fetchEpochRef をインクリメントすることで、日付effectが起動した古いfetchをキャンセルできる
  useEffect(() => {
    const { updatedSchedule, returnDate } = location.state ?? {}
    if (!updatedSchedule && !returnDate) return

    // 進行中のフェッチをキャンセル（再マウント直後の今日分フェッチによる上書きを防ぐ）
    fetchEpochRef.current++

    if (returnDate) {
      const d = new Date(returnDate)
      setSelectedDate(d)
      if (updatedSchedule) {
        // 保存後：スケジュールを直接反映しDB再取得を行わない
        setSchedule(updatedSchedule)
        setLoading(false)
        lastLoadedDate.current = d.toDateString()
      } else {
        // 戻るボタンの場合：lastLoadedDate をリセットして日付effectにDB再取得させる
        lastLoadedDate.current = ''
      }
    }

    window.history.replaceState({}, document.title)
  }, [location.state])

  // 投薬状況登録画面へ遷移
  const handleRegister = (group) => {
    navigate('/medication-status', {
      state: {
        timing: group.timing,
        date: selectedDate.toISOString(),
        entries: group.entries,
        fullSchedule: schedule,
        sharedNote: group.sharedNote ?? '',
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
                        {/* ペットアイコン（写真 or 絵文字）クリックでペット設定へ */}
                        <button
                          type="button"
                          onClick={() => navigate(`/pets/${entry.petId}/edit`)}
                          className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-purple-400 transition-all"
                          title={`${entry.petName}の設定を開く`}
                        >
                          {entry.petIcon.type === 'photo' ? (
                            <img
                              src={entry.petIcon.url}
                              alt={entry.petName}
                              className="w-full h-full object-cover"
                              style={{ objectPosition: `${entry.petIcon.x}% ${entry.petIcon.y}%` }}
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            entry.petIcon.emoji
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="text-xs font-bold text-purple-700">{entry.petName}</span>
                            <span className="inline-flex w-5 h-5 rounded-full overflow-hidden bg-amber-100 items-center justify-center text-xs flex-shrink-0">
                              {entry.medIcon.isPhoto ? (
                                <img src={entry.medIcon.url} alt="" className="w-full h-full object-cover"
                                  style={{ objectPosition: `${entry.medIcon.x}% ${entry.medIcon.y}%` }}
                                  onError={(e) => { e.currentTarget.style.display = 'none' }} />
                              ) : entry.medIcon.emoji}
                            </span>
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
