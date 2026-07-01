import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import PillBar from '../components/PillBar'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// 投薬状況登録画面
// TopPageから location.state で timing・date・entries・fullSchedule を受け取る
export default function MedicationStatusPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { timing, date, entries: initialEntries, fullSchedule } = location.state ?? {}

  const [entries, setEntries] = useState(
    (initialEntries ?? []).map((e) => ({ ...e, note: e.note ?? '' }))
  )
  const [inputValues, setInputValues] = useState(
    Object.fromEntries((initialEntries ?? []).map((e) => [e.id, String(e.administered)]))
  )
  const [allDoneMode, setAllDoneMode] = useState(false)
  const [sharedNote, setSharedNote] = useState(location.state?.sharedNote ?? '')
  const [saving, setSaving] = useState(false)

  const dateLabel = date
    ? new Date(date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  const handleAllDoneToggle = (checked) => {
    setAllDoneMode(checked)
    if (checked) {
      setEntries((prev) => prev.map((e) => ({ ...e, administered: 100 })))
      setInputValues(Object.fromEntries((initialEntries ?? []).map((e) => [e.id, '100'])))
    } else {
      setEntries((initialEntries ?? []).map((e) => ({ ...e, note: e.note ?? '' })))
      setInputValues(Object.fromEntries((initialEntries ?? []).map((e) => [e.id, String(e.administered)])))
    }
  }

  // 手入力（先頭0を除去、0〜100に制限）
  const handlePercentInput = (id, rawStr) => {
    let clean = rawStr.replace(/[^\d]/g, '')
    if (clean.length > 1) clean = clean.replace(/^0+/, '')
    if (parseInt(clean, 10) > 100) clean = '100'
    setInputValues((prev) => ({ ...prev, [id]: clean }))
    const pct = Math.min(100, Math.max(0, parseInt(clean, 10) || 0))
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, administered: pct } : e))
    if (allDoneMode) setAllDoneMode(false)
  }

  const handleNoteChange = (id, value) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note: value } : e))
  }

  // 通知スケジューリング（全薬100%済み → 最も早い次回投薬時間に通知）
  const scheduleNotification = async () => {
    if (!('Notification' in window)) return
    const perm = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
    if (perm !== 'granted') return
    const now = Date.now()
    const earliestMs = Math.min(...entries.map((e) => now + (e.intervalHours ?? 8) * 3600 * 1000))
    const nextTime = new Date(earliestMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    setTimeout(() => {
      new Notification(`🐾 ${timing}の次の投薬時間です`, {
        body: `${nextTime}頃に投薬してください。`,
        icon: '/favicon.svg',
      })
    }, earliestMs - now)
  }

  // 保存 → medication_logsにupsert → 更新済みスケジュール全体をTopPageに返す
  const handleSave = async () => {
    setSaving(true)

    // Supabase DBに保存（schema.sqlのmedicines.petId・medicine_idを利用）
    if (user && date) {
      const logDate = new Date(date).toISOString().slice(0, 10)
      await supabase.from('medication_logs').upsert(
        entries
          .filter((e) => e.medicineId && e.petId) // IDが存在するもののみ
          .map((e) => ({
            medicine_id: e.medicineId,
            pet_id: e.petId,
            user_id: user.id,
            log_date: logDate,
            timing,
            administered_percent: e.administered,
            note: e.note ?? '',
            shared_note: sharedNote,
            administered_at: new Date().toISOString(),
          })),
        { onConflict: 'medicine_id,log_date,timing' }
      )
    }

    const allDone = entries.every((e) => e.administered >= 100)
    if (allDone) await scheduleNotification()

    // 【バグ修正】fullScheduleの該当タイミングだけを更新し、全体を返す
    // こうすることでTopPageが再マウント後もスケジュール全体が保持される
    const updatedSchedule = (fullSchedule ?? []).map((g) =>
      g.timing === timing ? { ...g, entries, sharedNote } : g
    )

    setSaving(false)
    navigate('/', { state: { updatedSchedule, returnDate: date }, replace: true })
  }

  if (!timing || !entries) {
    return (
      <div className="min-h-screen">
        <Header title="投薬状況登録" />
        <div className="text-center py-16 text-gray-400">
          <p>画面情報が見つかりません</p>
          <button onClick={() => navigate('/')} className="btn btn-secondary mt-4">トップへ戻る</button>
        </div>
      </div>
    )
  }

  const allCurrentlyDone = entries.every((e) => e.administered >= 100)

  return (
    <div className="min-h-screen">
      <Header title="投薬状況登録" />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24 flex flex-col gap-4">
        {/* 戻るリンク（入力していた日付のトップ画面へ戻る） */}
        <button onClick={() => navigate('/', { state: { returnDate: date }, replace: true })} className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800">
          ← トップへ戻る
        </button>

        {/* タイミング・日付ヘッダー + 全済トグル */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{dateLabel}</p>
            <h2 className="text-lg font-bold text-purple-700">{timing}の投薬</h2>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-gray-600">全済 ON/OFF</span>
            <label className="toggle">
              <input type="checkbox" checked={allDoneMode} onChange={(e) => handleAllDoneToggle(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
            <span className={`text-xs ${allDoneMode ? 'text-purple-600 font-bold' : 'text-gray-400'}`}>
              {allDoneMode ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {allDoneMode && (
          <div className="bg-purple-50 border border-purple-200 text-purple-700 text-sm rounded-2xl px-4 py-3">
            すべての薬を100%投薬済みに設定しています。個別に投薬済み量を変更する場合はOFFにしてください。
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                {entry.petIcon?.type === 'photo' ? (
                  <img src={entry.petIcon.url} alt={entry.petName} className="w-full h-full object-cover"
                    style={{ objectPosition: `${entry.petIcon.x}% ${entry.petIcon.y}%` }} />
                ) : (
                  entry.petIcon?.emoji ?? entry.petIcon ?? '🐾'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-purple-700">{entry.petName}</span>
                  <span className="text-sm font-bold text-gray-800">{entry.medicineName}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-400">{entry.efficacy}</span>
                  <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                    {entry.doseAmount}
                  </span>
                </div>
              </div>
            </div>

            <PillBar doseAmount={entry.doseAmount} administered={entry.administered} showLabel={false} />

            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-gray-600 flex-shrink-0">投薬済み量</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={allDoneMode ? '100' : (inputValues[entry.id] ?? String(entry.administered))}
                onChange={(e) => handlePercentInput(entry.id, e.target.value)}
                disabled={allDoneMode}
                className="input text-center font-bold text-purple-700"
                style={{ maxWidth: 90 }}
                placeholder="0"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>

            <div className="mt-2">
              <label className="label text-xs">この薬の備考</label>
              <input
                type="text"
                className="input text-sm"
                value={entry.note}
                onChange={(e) => handleNoteChange(entry.id, e.target.value)}
                placeholder="例）チュールに混ぜて半分しか食べなかった"
              />
            </div>
          </div>
        ))}

        <div className="card">
          <label className="label">投薬状況の共有メモ</label>
          <textarea
            className="input resize-none"
            rows={3}
            value={sharedNote}
            onChange={(e) => setSharedNote(e.target.value)}
            placeholder="例）ポチは食欲が少なかった。ミケは薬を嫌がっていたので次回は様子を見る。"
          />
          <p className="text-xs text-gray-400 mt-1">家族での投薬情報共有などに活用できます</p>
        </div>

        {allCurrentlyDone && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 text-center font-medium">
            ✅ このタイミングの投薬がすべて完了しました！次回投薬時間に通知します。
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full text-base">
          {saving ? '保存中...' : '投薬状況を保存する'}
        </button>

        <button onClick={() => navigate(-1)} className="btn btn-secondary w-full">
          キャンセル
        </button>
      </main>
    </div>
  )
}
