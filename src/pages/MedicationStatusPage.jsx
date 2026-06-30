import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import PillBar from '../components/PillBar'

// 投薬状況登録画面
// TopPageから location.state で timing・date・entries（薬一覧）を受け取る
export default function MedicationStatusPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { timing, date, entries: initialEntries } = location.state ?? {}

  // 各薬の投薬済み%（手入力）と備考（自由記入）を管理
  const [entries, setEntries] = useState(
    (initialEntries ?? []).map((e) => ({ ...e, note: '' }))
  )
  const [allDoneMode, setAllDoneMode] = useState(false) // 全済トグル
  const [sharedNote, setSharedNote] = useState('')       // 投薬状況共有のための自由記入欄（共通）
  const [saving, setSaving] = useState(false)

  // 日付表示
  const dateLabel = date
    ? new Date(date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  // 全済トグルON → 全薬100%、OFF → 元の値に戻す
  const handleAllDoneToggle = (checked) => {
    setAllDoneMode(checked)
    if (checked) {
      setEntries((prev) => prev.map((e) => ({ ...e, administered: 100 })))
    } else {
      setEntries(
        (initialEntries ?? []).map((e) => ({ ...e, note: '' }))
      )
    }
  }

  // 個別の投薬済み%を手入力（0〜100の整数）
  const handlePercentChange = (id, value) => {
    const pct = value === '' ? 0 : Math.min(100, Math.max(0, parseInt(value, 10) || 0))
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, administered: pct } : e))
    if (allDoneMode) setAllDoneMode(false)
  }

  // 個別の備考入力
  const handleNoteChange = (id, value) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, note: value } : e))
  }

  // 通知スケジューリング（全薬100%になったとき）
  const scheduleNotification = async () => {
    if (!('Notification' in window)) return
    const perm = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
    if (perm !== 'granted') return

    const now = Date.now()
    const earliestMs = Math.min(
      ...entries.map((e) => now + (e.intervalHours ?? 8) * 3600 * 1000)
    )
    const nextTime = new Date(earliestMs).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

    setTimeout(() => {
      new Notification(`🐾 ${timing}の次の投薬時間です`, {
        body: `${nextTime}頃に投薬してください。`,
        icon: '/favicon.svg',
      })
    }, earliestMs - now)
  }

  // 保存して戻る
  const handleSave = async () => {
    setSaving(true)
    const allDone = entries.every((e) => e.administered >= 100)
    if (allDone) await scheduleNotification()

    // TODO: Supabase の medication_logs テーブルに保存（スキーマ作成後に有効化）
    // await supabase.from('medication_logs').upsert(...)

    setSaving(false)
    navigate(-1)
  }

  if (!timing || !entries) {
    return (
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
      <Header title="投薬状況登録" />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24 flex flex-col gap-4">

        {/* タイミング・日付ヘッダー + 全済トグル */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">{dateLabel}</p>
            <h2 className="text-lg font-bold text-purple-700">{timing}の投薬</h2>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-gray-600">全済 ON/OFF</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={allDoneMode}
                onChange={(e) => handleAllDoneToggle(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
            <span className={`text-xs ${allDoneMode ? 'text-purple-600 font-bold' : 'text-gray-400'}`}>
              {allDoneMode ? 'ON（全薬100%）' : 'OFF'}
            </span>
          </div>
        </div>

        {/* 全済説明テキスト */}
        {allDoneMode && (
          <div className="bg-purple-50 border border-purple-200 text-purple-700 text-sm rounded-xl px-4 py-3">
            全済ONになっています。全薬を100%投薬済みに設定しています。
            チュールに混ぜるなど一括完食の場合に便利です。個別に変更する場合はOFFにしてください。
          </div>
        )}

        {/* 各薬の投薬済み%入力カード */}
        {entries.map((entry) => (
          <div key={entry.id} className="card">
            {/* 薬ヘッダー */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl flex-shrink-0">
                {entry.petIcon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-700">{entry.petName}</span>
                  <span className="text-sm font-bold text-gray-800">{entry.medicineName}</span>
                </div>
                <p className="text-xs text-gray-400">{entry.efficacy}｜処方量：{entry.doseAmount}</p>
              </div>
            </div>

            {/* 薬型モチーフ棒グラフ */}
            <PillBar doseAmount={entry.doseAmount} administered={entry.administered} />

            {/* 投薬済み%手入力 */}
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-gray-600 flex-shrink-0">投薬済み量</label>
              <input
                type="number"
                min={0} max={100} step={1}
                value={entry.administered}
                onChange={(e) => handlePercentChange(entry.id, e.target.value)}
                disabled={allDoneMode}
                className="input text-center font-bold text-purple-700"
                style={{ maxWidth: 90 }}
                placeholder="0"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>

            {/* 薬ごとの備考（自由記入） */}
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

        {/* 投薬状況の共有メモ（全体の自由記入欄） */}
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

        {/* 全薬済み完了メッセージ */}
        {allCurrentlyDone && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 text-center font-medium">
            ✅ このタイミングの投薬がすべて完了しました！次回投薬時間に通知します。
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary w-full text-base"
        >
          {saving ? '保存中...' : '投薬状況を保存する'}
        </button>

        <button onClick={() => navigate(-1)} className="btn btn-secondary w-full">
          キャンセル
        </button>
      </main>
    </div>
  )
}
