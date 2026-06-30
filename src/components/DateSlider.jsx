// 日付スライダーコンポーネント
// selectedDate: Date オブジェクト
// onSelect: (Date) => void
export default function DateSlider({ selectedDate, onSelect }) {
  // 表示する日付範囲の起点（selectedDate の2日前）
  const getDateList = (center) => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(center)
      d.setDate(center.getDate() - 2 + i)
      return d
    })
  }

  const dates = getDateList(selectedDate)

  const shiftDate = (delta) => {
    const next = new Date(selectedDate)
    next.setDate(selectedDate.getDate() + delta)
    onSelect(next)
  }

  const isToday = (d) => {
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }

  const isSelected = (d) => d.toDateString() === selectedDate.toDateString()

  const weekdays = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="bg-white border-b border-gray-100 py-3 sticky top-14 z-30">
      <div className="max-w-2xl mx-auto px-2 flex items-center gap-1">
        {/* 前へボタン */}
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
          aria-label="前の日へ"
        >
          ◀
        </button>

        {/* 日付一覧 */}
        <div className="flex-1 flex items-center justify-around">
          {dates.map((d) => {
            const selected = isSelected(d)
            const today = isToday(d)
            return (
              <button
                key={d.toISOString()}
                onClick={() => onSelect(d)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-xl transition-all ${
                  selected
                    ? 'bg-purple-600 text-white shadow-md scale-105'
                    : today
                    ? 'bg-purple-50 text-purple-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xs">{weekdays[d.getDay()]}</span>
                <span className={`text-base font-bold leading-none ${selected ? 'text-white' : ''}`}>
                  {d.getDate()}
                </span>
                {today && !selected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* 次へボタン */}
        <button
          onClick={() => shiftDate(1)}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
          aria-label="次の日へ"
        >
          ▶
        </button>
      </div>

      {/* 選択日の年月表示 */}
      <p className="text-center text-xs text-gray-400 mt-1">
        {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
        （{weekdays[selectedDate.getDay()]}）
        {isToday(selectedDate) && <span className="ml-1 text-purple-500 font-medium">今日</span>}
      </p>
    </div>
  )
}
