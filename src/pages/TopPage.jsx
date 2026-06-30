import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import DateSlider from '../components/DateSlider'
import PillBar from '../components/PillBar'

// ダミーデータ
// timeType: 'point'（ピンポイント）または 'range'（時間帯）
// timeStart / timeEnd: HH:MM 形式
const DUMMY_SCHEDULE = [
  {
    timing: '朝',
    entries: [
      {
        id: 1, petName: 'ポチ', petIcon: '🐕',
        medicineName: 'アモキシシリン', efficacy: '抗生物質',
        doseAmount: '1錠', administered: 0, intervalHours: 8,
        timeType: 'range', timeStart: '07:00', timeEnd: '09:00',
      },
      {
        id: 2, petName: 'ポチ', petIcon: '🐕',
        medicineName: 'プレドニゾロン', efficacy: 'ステロイド',
        doseAmount: '半錠', administered: 100, intervalHours: 12,
        timeType: 'point', timeStart: '08:00', timeEnd: '08:00',
      },
      {
        id: 3, petName: 'ミケ', petIcon: '🐈',
        medicineName: 'メトロニダゾール', efficacy: '抗原虫薬',
        doseAmount: '1錠', administered: 50, intervalHours: 12,
        timeType: 'range', timeStart: '08:00', timeEnd: '10:00',
      },
    ],
  },
  {
    timing: '昼',
    entries: [
      {
        id: 4, petName: 'ミケ', petIcon: '🐈',
        medicineName: 'メトロニダゾール', efficacy: '抗原虫薬',
        doseAmount: '1錠', administered: 0, intervalHours: 12,
        timeType: 'point', timeStart: '12:00', timeEnd: '12:00',
      },
    ],
  },
  {
    timing: '晩',
    entries: [
      {
        id: 5, petName: 'ポチ', petIcon: '🐕',
        medicineName: 'アモキシシリン', efficacy: '抗生物質',
        doseAmount: '1錠', administered: 0, intervalHours: 8,
        timeType: 'range', timeStart: '19:00', timeEnd: '21:00',
      },
      {
        id: 6, petName: 'ポチ', petIcon: '🐕',
        medicineName: 'ビオフェルミン', efficacy: '整腸剤',
        doseAmount: '1錠', administered: 0, intervalHours: 8,
        timeType: 'point', timeStart: '20:00', timeEnd: '20:00',
      },
      {
        id: 7, petName: 'ミケ', petIcon: '🐈',
        medicineName: 'インターフェロン', efficacy: '免疫調整',
        doseAmount: '全量', administered: 0, intervalHours: 24,
        timeType: 'range', timeStart: '19:00', timeEnd: '22:00',
      },
    ],
  },
]

// 時間表示テキスト（ピンポイント or 時間帯）
const formatTime = (entry) => {
  if (entry.timeType === 'range') return `${entry.timeStart}〜${entry.timeEnd}`
  return entry.timeStart
}

// タイミンググループ全体の時間帯テキスト（最早〜最遅）
const getGroupTimeLabel = (entries) => {
  const starts = entries.map((e) => e.timeStart).sort()
  const ends = entries.map((e) => e.timeEnd).sort()
  const earliest = starts[0]
  const latest = ends[ends.length - 1]
  return earliest === latest ? earliest : `${earliest}〜${latest}`
}

// 投薬ステータスバッジ
const getStatusBadge = (pct) => {
  if (pct >= 100) return { label: '投薬済み', cls: 'bg-emerald-100 text-emerald-700' }
  if (pct > 0)   return { label: '一部投薬済み', cls: 'bg-amber-100 text-amber-700' }
  return { label: '未投薬', cls: 'bg-gray-100 text-gray-500' }
}

// トップ画面：選択日の投薬予定一覧
export default function TopPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedule, setSchedule] = useState(DUMMY_SCHEDULE)
  const navigate = useNavigate()

  useEffect(() => {
    // 日付変更時はスケジュールを再取得（本番はDB呼び出し）
    setSchedule(DUMMY_SCHEDULE)
  }, [selectedDate])

  // 通知スケジューリング（タイミング内で最も早い次回投薬時間に通知）
  const scheduleNotification = async (timing, entries) => {
    if (!('Notification' in window)) return
    const perm = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
    if (perm !== 'granted') return

    const now = Date.now()
    const earliestMs = Math.min(...entries.map((e) => now + e.intervalHours * 3600 * 1000))
    setTimeout(() => {
      new Notification('🐾 投薬時間です', {
        body: `${timing}の投薬時間になりました。投薬を確認してください。`,
        icon: '/favicon.svg',
      })
    }, earliestMs - now)
  }

  // 投薬状況登録画面へ遷移（タイミングと投薬情報をstateで渡す）
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
    <div className="min-h-screen bg-gray-50">
      <Header title="本日の投薬予定" />
      <DateSlider selectedDate={selectedDate} onSelect={setSelectedDate} />

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4 pb-10">
        {schedule.length === 0 && (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">🎉</p>
            <p>この日の投薬予定はありません</p>
          </div>
        )}

        {schedule.map((group) => {
          const allDone = group.entries.every((e) => e.administered >= 100)
          const groupTimeLabel = getGroupTimeLabel(group.entries)

          return (
            <section key={group.timing} className="card">
              {/* タイミングヘッダー行 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {group.timing}
                  </span>
                  {/* タイミング全体の時間帯（ピンポイント or 範囲） */}
                  <span className="text-xs text-gray-400">{groupTimeLabel}</span>
                </div>
                <button
                  onClick={() => handleRegister(group)}
                  className={`btn text-sm py-1.5 px-4 ${allDone ? 'btn-success' : 'btn-primary'}`}
                >
                  {allDone ? '✓ 投薬済み' : '投薬状況を登録'}
                </button>
              </div>

              {/* 各薬の投薬カード */}
              <div className="flex flex-col gap-3">
                {group.entries.map((entry) => {
                  const badge = getStatusBadge(entry.administered)
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
                      {/* ペットアイコン */}
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl flex-shrink-0">
                        {entry.petIcon}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* ペット名・薬名・効能・ステータスバッジ */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-xs font-bold text-purple-700">{entry.petName}</span>
                          <span className="text-sm font-bold text-gray-800">{entry.medicineName}</span>
                          <span className="text-xs text-gray-400">{entry.efficacy}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* 投薬時間（ピンポイント or 時間帯） */}
                        <p className="text-xs text-gray-400 mb-1.5">
                          投薬時間：{formatTime(entry)}
                        </p>

                        {/* 薬型モチーフ棒グラフ */}
                        <PillBar doseAmount={entry.doseAmount} administered={entry.administered} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        <button
          onClick={() => navigate('/pets')}
          className="btn btn-secondary w-full"
        >
          🐾 ペット・薬の設定を管理する
        </button>
      </main>
    </div>
  )
}
